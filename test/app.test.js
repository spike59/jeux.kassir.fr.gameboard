import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp, parseKeys } from '../src/app.js';

const KEY = 'a'.repeat(64);
const OTHER = 'b'.repeat(64);
const GAMES = {
  pvv: { title: 'PvV', boards: [
    { id: 'police', title: 'Flics', order: 'desc', unit: 'points', min: 1, max: 500 },
    { id: 'race:x@3', title: 'Circuit X', order: 'asc', unit: 'ms', min: 5000, max: 600000 },
  ] },
  other: { title: 'Autre', boards: [{ id: 'score', title: 'Score', order: 'desc', unit: 'points', min: 1, max: 100 }] },
};

async function start(t) {
  const dir = await mkdtemp(join(tmpdir(), 'gameboard-'));
  const app = createApp({ games: GAMES, keys: parseKeys(`pvv:${KEY},other:${OTHER}`), dataDir: dir });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  t.after(async () => { server.close(); await rm(dir, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    base,
    post: (body, key = KEY) => fetch(`${base}/v1/scores`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(key ? { authorization: `Bearer ${key}` } : {}) },
      body: JSON.stringify(body),
    }),
    get: (path) => fetch(`${base}${path}`).then((r) => r.json()),
  };
}
const entry = (player, value) => ({ board: 'police', entries: [{ player, value }] });
const status = async (res) => (await res.json()).results[0].status;

test('sans clé ou avec une mauvaise clé : 401', async (t) => {
  const s = await start(t);
  assert.equal((await s.post(entry('Ana', 5), null)).status, 401);
  assert.equal((await s.post(entry('Ana', 5), 'c'.repeat(64))).status, 401);
});

test('un meilleur score devient le top, un moins bon est ignoré', async (t) => {
  const s = await start(t);
  assert.equal(await status(await s.post(entry('Ana', 10))), 'top');
  assert.equal(await status(await s.post(entry('Bob', 5))), 'best'); // n°2
  assert.equal(await status(await s.post(entry('Ana', 3))), 'kept'); // moins bon que le sien
  assert.equal(await status(await s.post(entry('Bob', 20))), 'top'); // bat Ana
  assert.equal(await status(await s.post(entry('Bob', 25))), 'top'); // le n°1 s'améliore
  const top = (await s.get('/v1/boards/pvv')).boards.police.top;
  assert.deepEqual(top.map((r) => [r.player, r.value]), [['Bob', 25], ['Ana', 10]]);
});

test('classement en temps : le plus petit gagne, une ligne par joueur', async (t) => {
  const s = await start(t);
  await s.post({ board: 'race:x@3', entries: [{ player: 'Ana', value: 90000 }] });
  await s.post({ board: 'race:x@3', entries: [{ player: 'Ana', value: 80000 }, { player: 'Bob', value: 85000 }] });
  const top = (await s.get('/v1/boards/pvv')).boards['race:x@3'].top;
  assert.deepEqual(top.map((r) => [r.player, r.value]), [['Ana', 80000], ['Bob', 85000]]);
});

test('une clé ne peut écrire que dans les classements de son jeu', async (t) => {
  const s = await start(t);
  assert.equal((await s.post({ board: 'score', entries: [{ player: 'Ana', value: 5 }] })).status, 400); // clé pvv, classement de other
  assert.equal((await s.post({ board: 'score', entries: [{ player: 'Ana', value: 5 }] }, OTHER)).status, 201);
  assert.equal((await s.get('/v1/boards/pvv')).boards.police.top.length, 0);
});

test('valeurs et noms invalides ignorés un à un', async (t) => {
  const s = await start(t);
  const r = await s.post({ board: 'police', entries: [{ player: 'Ana', value: 9999 }, { player: '<b>', value: 5 }, { player: 'Cléo', value: 7 }, { player: 'Dan', value: 1.5 }] });
  const body = await r.json();
  assert.equal(r.status, 201);
  assert.deepEqual(body.results.map((x) => x.status), ['ignored', 'ignored', 'top', 'ignored']);
  assert.equal((await s.post({ board: 'police', entries: [{ player: '', value: 0 }] })).status, 400);
});

test('classement inconnu, jeu inconnu, entrées absentes', async (t) => {
  const s = await start(t);
  assert.equal((await s.post({ board: 'nope', entries: [{ player: 'Ana', value: 5 }] })).status, 400);
  assert.equal((await s.post({ board: 'police' })).status, 400);
  assert.equal((await fetch(`${s.base}/v1/boards/zzz`)).status, 404);
});

test('les scores survivent à un redémarrage', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'gameboard-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const run = async (fn) => {
    const server = createApp({ games: GAMES, keys: parseKeys(`pvv:${KEY}`), dataDir: dir }).listen(0, '127.0.0.1');
    await new Promise((r) => server.once('listening', r));
    try { return await fn(`http://127.0.0.1:${server.address().port}`); } finally { server.close(); }
  };
  await run((b) => fetch(`${b}/v1/scores`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}` },
    body: JSON.stringify(entry('Ana', 42)),
  }));
  const top = await run((b) => fetch(`${b}/v1/boards/pvv`).then((r) => r.json()));
  assert.equal(top.boards.police.top[0].value, 42);
});

test('clés trop courtes et jeu inconnu refusés au démarrage', () => {
  assert.throws(() => parseKeys('pvv:court'), /32 caractères/);
  assert.throws(() => createApp({ games: GAMES, keys: parseKeys(`zzz:${KEY}`), dataDir: tmpdir() }), /jeu inconnu/);
});
