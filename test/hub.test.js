import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { WebSocket } from 'ws';
import { createHub } from '../src/hub/hub.js';
import { bulles, COLORS, ROUND_MS, SPAWN_MS } from '../src/hub/bulles.js';
import { asteroid_run, ROUND_MS as AR_ROUND, HURT_MS } from '../src/hub/asteroid_run.js';

const ORIGIN = 'https://jeux.test';

// Horloge et minuteries à la main : les parties de 60 s se jouent en un instant.
function clock() {
  let t = 1000;
  const timers = [];
  return {
    now: () => t,
    every(ms, fn) { const x = { at: t + ms, ms, fn, on: true }; timers.push(x); return () => { x.on = false; }; },
    after(ms, fn) { const x = { at: t + ms, fn, on: true }; timers.push(x); return () => { x.on = false; }; },
    advance(ms) {
      const end = t + ms;
      for (;;) {
        const next = timers.filter((x) => x.on && x.at <= end).sort((a, b) => a.at - b.at)[0];
        if (!next) break;
        t = next.at;
        if (next.ms) next.at += next.ms; else next.on = false;
        next.fn();
      }
      t = end;
    },
  };
}

async function start(t) {
  const c = clock();
  let seed = 12345;
  const rng = () => { seed = (seed + 0x6d2b79f5) | 0; let x = Math.imul(seed ^ (seed >>> 15), 1 | seed); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; // mulberry32
  const hub = createHub({ modules: [bulles, asteroid_run], publicOrigin: ORIGIN, now: c.now, rng, every: c.every, after: c.after });
  const server = http.createServer();
  hub.attach(server);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `ws://127.0.0.1:${server.address().port}/api/v1/hub`;
  const sockets = [];
  t.after(() => { for (const s of sockets) s.terminate(); hub.close(); server.close(); });

  async function join(name, origin = ORIGIN) {
    const ws = new WebSocket(url, { origin });
    sockets.push(ws);
    const inbox = [];
    ws.on('message', (raw) => inbox.push(JSON.parse(raw)));
    await new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
    const p = {
      ws, inbox,
      send: (m) => ws.send(JSON.stringify(m)),
      // attend que le prochain message de ce type soit là (ou l'ait déjà été depuis le dernier appel)
      async next(type) {
        for (let i = 0; i < 200; i++) {
          const k = inbox.findIndex((m) => m.t === type);
          if (k >= 0) return inbox.splice(k, 1)[0];
          await new Promise((r) => setTimeout(r, 5));
        }
        throw new Error(`pas de message « ${type} » (reçu : ${inbox.map((m) => m.t).join(', ')})`);
      },
      async idle() { await new Promise((r) => setTimeout(r, 40)); },
    };
    p.send({ t: 'hello', name });
    p.welcome = await p.next('welcome');
    return p;
  }
  return { c, hub, join, url };
}

test("le realm annonce le serveur01 et ses jeux", async (t) => {
  const { hub } = await start(t);
  const info = hub.info();
  assert.equal(info.id, 'serveur01');
  assert.deepEqual(info.games.map((g) => g.id), ['bulles', 'asteroid_run']);
});

test('seules les pages du site peuvent se connecter', async (t) => {
  const { url } = await start(t);
  const ws = new WebSocket(url, { origin: 'https://autre.site' });
  const result = await new Promise((resolve) => { ws.once('open', () => resolve('open')); ws.once('error', () => resolve('refusé')); });
  assert.equal(result, 'refusé');
});

test('un prénom invalide est refusé', async (t) => {
  const { url } = await start(t);
  const ws = new WebSocket(url, { origin: ORIGIN });
  await new Promise((r) => ws.once('open', r));
  const reply = new Promise((r) => ws.once('message', (raw) => r(JSON.parse(raw))));
  ws.send(JSON.stringify({ t: 'hello', name: '!!!' }));
  assert.equal((await reply).t, 'error');
  ws.terminate();
});

test('le chat général arrive à tout le monde, nettoyé et espacé', async (t) => {
  const { c, join } = await start(t);
  const a = await join('Alice');
  const b = await join('Bob');
  a.send({ t: 'chat', text: '  Salut <b>tout</b>   le monde ' });
  const line = await b.next('chat');
  assert.deepEqual([line.from, line.text], ['Alice', 'Salut btout/b le monde']);
  a.send({ t: 'chat', text: 'trop vite' });
  await b.idle();
  assert.equal(b.inbox.filter((m) => m.t === 'chat').length, 0);
  c.advance(1500);
  a.send({ t: 'chat', text: 'ok' });
  assert.equal((await b.next('chat')).text, 'ok');
});

test('une partie de bulles : couleurs, +1 pour les siennes, −5 pour celles des autres, une bulle ne s\'éclate qu\'une fois', async (t) => {
  const { c, join } = await start(t);
  const a = await join('Alice');
  const b = await join('Bob');
  a.send({ t: 'create', game: 'bulles' });
  const room = (await a.next('room')).room;
  assert.equal(room.players[0].color, COLORS[0]);
  b.send({ t: 'join', room: room.id });
  const joined = (await b.next('room')).room;
  assert.deepEqual(joined.players.map((p) => p.color), [COLORS[0], COLORS[1]]);

  // seul le propriétaire lance
  b.send({ t: 'start' });
  await b.idle();
  assert.equal(a.inbox.some((m) => m.t === 'start'), false);
  a.send({ t: 'start' });
  const started = await a.next('start');
  assert.equal(started.roundMs, ROUND_MS);
  await b.next('start');

  // des bulles apparaissent, identiques pour tout le monde
  c.advance(SPAWN_MS * 20);
  await a.idle();
  const seenA = a.inbox.filter((m) => m.t === 'spawn').map((m) => m.b);
  await b.idle();
  const seenB = b.inbox.filter((m) => m.t === 'spawn').map((m) => m.b);
  assert.ok(seenA.length >= 10);
  assert.deepEqual(seenA, seenB);
  const mine = seenA.findLast((x) => x.color === COLORS[0]);
  const theirs = seenA.findLast((x) => x.color === COLORS[1]);
  assert.ok(mine && theirs, 'les deux couleurs apparaissent');

  a.send({ t: 'pop', b: mine.id });
  assert.deepEqual([(await a.next('popped')).delta], [1]);
  a.send({ t: 'pop', b: theirs.id });
  const bad = await a.next('popped');
  assert.deepEqual([bad.delta, bad.score], [-5, -4]);

  // Bob arrive trop tard sur une bulle déjà éclatée
  b.send({ t: 'pop', b: mine.id });
  assert.equal((await b.next('miss')).b, mine.id);

  // fin de manche
  c.advance(ROUND_MS);
  const end = await a.next('end');
  assert.deepEqual(end.scores.map((s) => [s.name, s.score]).sort(), [['Alice', -4], ['Bob', 0]]);
});

test('on ne peut pas lancer seul, et rejoindre une partie commencée est refusé', async (t) => {
  const { join } = await start(t);
  const a = await join('Alice');
  a.send({ t: 'create', game: 'bulles' });
  await a.next('room');
  a.send({ t: 'start' });
  assert.match((await a.next('error')).text, /au moins 2/);
});

test('quand un joueur part, la partie à deux se termine et la salle vide disparaît', async (t) => {
  const { hub, join } = await start(t);
  const a = await join('Alice');
  const b = await join('Bob');
  a.send({ t: 'create', game: 'bulles' });
  const room = (await a.next('room')).room;
  b.send({ t: 'join', room: room.id });
  await b.next('room');
  a.send({ t: 'start' });
  await a.next('start');
  b.send({ t: 'leave' });
  assert.equal((await a.next('end')).scores.length, 1);
  a.send({ t: 'leave' });
  await a.idle();
  assert.equal(hub._rooms.size, 0);
});

test('Asteroid Run : étoiles et astéroïdes arbitrés par le serveur, vies, tirs relayés, fin de manche', async (t) => {
  const { c, join } = await start(t);
  const a = await join('Alice');
  const b = await join('Bob');
  a.send({ t: 'create', game: 'asteroid_run' });
  const room = (await a.next('room')).room;
  b.send({ t: 'join', room: room.id });
  await b.next('room');
  a.send({ t: 'start' });
  await a.next('start');
  c.advance(30_000);
  await a.idle();
  const spawns = a.inbox.filter((m) => m.t === 'spawn').map((m) => m.e);
  assert.ok(spawns.length > 10, 'des objets apparaissent');
  const star = spawns.findLast((e) => e.star);
  const rock = spawns.findLast((e) => !e.star && e.hp === 1) ?? spawns.findLast((e) => !e.star);
  assert.ok(star && rock);

  // l'étoile revient au premier qui l'annonce, une seule fois
  a.send({ t: 'take', a: star.id });
  const took = await a.next('took');
  assert.deepEqual([took.by === a.welcome.id, took.score], [true, 10]);
  b.send({ t: 'take', a: star.id });
  await b.idle();
  assert.equal(b.inbox.filter((m) => m.t === 'took').length, 1, 'deuxième annonce ignorée');

  // les tirs et les positions sont relayés aux autres seulement
  b.send({ t: 'shoot', x: 0.5, y: 0.9 });
  const shot = await a.next('shot');
  assert.deepEqual([shot.id, shot.x, shot.y], [b.welcome.id, 0.5, 0.9]);
  b.send({ t: 'pos', x: 2, y: -1 });
  const pos = await a.next('pos');
  assert.deepEqual([pos.x, pos.y], [1, 0]);

  // un astéroïde à plusieurs points de vie : il faut plusieurs tirs ; le dernier rapporte 5 points
  for (let i = 0; i < rock.hp; i++) a.send({ t: 'hit', a: rock.id });
  const boom = await a.next('boom');
  assert.equal(boom.score, 15);

  // percuter un astéroïde coûte une vie, puis on est invulnérable un instant
  const rocks = spawns.filter((e) => !e.star && e.id !== rock.id);
  b.send({ t: 'crash', a: rocks.at(-1).id });
  assert.equal((await b.next('crashed')).lives, 2);
  b.send({ t: 'crash', a: rocks.at(-2).id });
  await b.idle();
  assert.equal(b.inbox.filter((m) => m.t === 'crashed').length, 0, 'invulnérable après un choc');
  c.advance(HURT_MS + 100);

  c.advance(AR_ROUND);
  const end = await a.next('end');
  assert.deepEqual(end.scores.map((s) => [s.name, s.score]), [['Alice', 15], ['Bob', 0]]);
});
