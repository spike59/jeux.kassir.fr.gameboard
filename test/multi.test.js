// L'état du multijoueur en direct : flux d'une instance swordfish, fusion avec le catalogue, flux vers les menus.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { createInstanceFeed, createFeeds, createMultiBus, multiState, sse } from '../src/multi.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, ms = 3000) => { const t = Date.now(); while (Date.now() - t < ms) { const v = f(); if (v) return v; await wait(10); } throw new Error('délai dépassé'); };

const catalog = [
  { id: 'bulles', title: 'Bulles', icon: '🫧', url: '/jeux/bulles/', ready: true, multi: true },
  { id: 'lili-kart', title: 'Lili Kart', icon: '🏎️', url: '/jeux/lili-kart/', ready: true, multi: true },
  { id: 'parc', title: 'Parc', icon: '🎡', url: '/jeux/parc/', ready: true },
  { id: 'taupe', title: 'Taupe', icon: '🔨', ready: false, multi: true },
];
const room = (id, players, max = 6, joinable = true) => ({ id, name: id, mode: null, state: 'waiting', players, max, joinable });
const entry = (id, rooms, extra = {}) => ({ id, title: id, kind: 'hub', online: true, players: rooms.reduce((n, r) => n + r.players, 0), rooms, ...extra });
const instance = (games, server = {}) => ({ online: true, server: { status: 'online', version: '0.3.0', ...server }, games: new Map(games.map((g) => [g.id, g])) });

test('multiState : seulement les jeux multi prêts ; comptes, parties à rejoindre, version', () => {
  const s = multiState(catalog, [instance([entry('bulles', [room('1', 2), room('2', 6, 6, false)])])]);
  assert.deepEqual(s.games.map((g) => g.id), ['bulles', 'lili-kart']);
  const b = s.games[0];
  assert.deepEqual([b.status, b.rooms, b.players, b.joinable, b.max, b.version, b.lobby], ['online', 2, 8, 1, 6, '0.3.0', '/multi/?game=bulles']);
  assert.equal(s.games[1].status, 'offline', 'jeu sans instance = hors ligne');
  assert.deepEqual([s.server.online, s.server.players, s.server.rooms, s.server.instances], [true, 8, 2, 1]);
});

test('multiState : instance arrêtée, en maintenance ou injoignable', () => {
  const draining = multiState(catalog, [instance([entry('bulles', [room('1', 2)])], { status: 'draining' })]);
  assert.equal(draining.games[0].status, 'draining'); assert.equal(draining.games[0].joinable, 0);
  const down = multiState(catalog, [{ ...instance([entry('bulles', [room('1', 2)])]), online: false }]);
  assert.equal(down.games[0].status, 'offline'); assert.equal(down.games[0].players, 0); assert.equal(down.server.online, false);
  const deux = multiState(catalog, [instance([entry('bulles', [room('1', 1)])]), instance([entry('lili-kart', [room('libre', 3)], { kind: 'kart' })])]);
  assert.deepEqual(deux.games.map((g) => [g.id, g.players]), [['bulles', 1], ['lili-kart', 3]]);
  assert.equal(deux.server.instances, 2, 'une instance par jeu : on les agrège');
});

test('multiState : aucun prénom, même si une instance en envoyait', () => {
  const g = entry('bulles', [{ ...room('1', 1), names: ['Léa'] }]);
  assert.ok(!JSON.stringify(multiState(catalog, [instance([g])])).includes('Léa'));
});

// Un faux swordfish : un flux d'événements qu'on pilote depuis le test
function fakeSwordfish() {
  const clients = new Set(); let seq = 0, conns = 0; const game = entry('bulles', [room('1', 1)]);
  const server = http.createServer((req, res) => {
    if (req.url !== '/jeux/sg/api/events') { res.writeHead(404); return res.end(); }
    conns++;
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    res.write(sse({ type: 'snapshot', seq, server: { status: 'online', version: '0.3.0' }, games: [game] }));
    clients.add(res); res.on('close', () => clients.delete(res));
  });
  return {
    listen: () => new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(`http://127.0.0.1:${server.address().port}/jeux/sg`))),
    push: (ev) => { for (const c of clients) c.write(sse({ ...ev, seq: ++seq })); },
    raw: (ev) => { for (const c of clients) c.write(sse(ev)); },
    connections: () => conns,
    dropAll: () => { for (const c of clients) c.destroy(); },
    heartbeat: () => { for (const c of clients) c.write(': ♥\n\n'); },
    clients: () => clients.size,
    close: () => { for (const c of clients) c.destroy(); server.close(); },
  };
}

test("flux d'une instance : snapshot, puis événements poussés ; coupure = hors ligne ; reconnexion automatique", async () => {
  const sf = fakeSwordfish(); const url = await sf.listen();
  const changes = [];
  const feed = createInstanceFeed({ url, retryMs: 20, maxRetryMs: 40, onChange: (s) => changes.push([s.online, s.games.get('bulles')?.players]) });
  try {
    await until(() => feed.state.online && feed.state.games.get('bulles')?.players === 1);
    sf.push({ type: 'game', game: entry('bulles', [room('1', 3)]) });
    await until(() => feed.state.games.get('bulles').players === 3);
    sf.push({ type: 'server', server: { status: 'draining', version: '0.3.0' } });
    await until(() => feed.state.server.status === 'draining');
    sf.push({ type: 'game-removed', id: 'bulles' });
    await until(() => !feed.state.games.has('bulles'));
    sf.dropAll();
    await until(() => !feed.state.online);
    await until(() => feed.state.online, 3000); // le flux revient tout seul avec un snapshot
    assert.equal(feed.state.games.get('bulles').players, 1, 'repart de l\'état complet du snapshot');
  } finally { feed.close(); sf.close(); }
});

test('flux d\'une instance : un trou de seq force un nouvel abonnement', async () => {
  const sf = fakeSwordfish(); const url = await sf.listen();
  const feed = createInstanceFeed({ url, retryMs: 20, maxRetryMs: 40 });
  try {
    await until(() => feed.state.online);
    assert.equal(sf.connections(), 1);
    sf.raw({ type: 'game', seq: 99, game: entry('bulles', [room('1', 9)]) }); // saute de 1 à 99
    await until(() => sf.connections() >= 2);
    await until(() => feed.state.online);
    assert.equal(feed.state.games.get('bulles').players, 1, "l'événement avec trou est ignoré, on repart du snapshot");
  } finally { feed.close(); sf.close(); }
});

test('flux d\'une instance : instance injoignable = hors ligne, sans planter ; plusieurs instances agrégées', async () => {
  const sf = fakeSwordfish(); const url = await sf.listen();
  const feeds = createFeeds({ urls: [url, 'http://127.0.0.1:1/jeux/x'], retryMs: 20, maxRetryMs: 40 });
  try {
    await until(() => feeds.instances()[0].online);
    assert.equal(feeds.instances()[1].online, false);
    const s = multiState(catalog, feeds.instances());
    assert.equal(s.server.instancesOnline, 1); assert.equal(s.games[0].status, 'online');
  } finally { feeds.close(); sf.close(); }
});

test('bus vers les menus : snapshot, puis un événement par jeu qui change, regroupés', async () => {
  const insts = [instance([entry('bulles', [room('1', 1)])])];
  const bus = createMultiBus({ getCatalog: () => catalog, instances: () => insts, coalesceMs: 5 });
  const got = []; bus.subscribe((e) => got.push(e));
  assert.equal(bus.snapshot().games.find((g) => g.id === 'bulles').players, 1);
  insts[0].games.set('bulles', entry('bulles', [room('1', 2)]));
  bus.touch(); bus.touch(); bus.touch();
  await until(() => got.length >= 2);
  await wait(30);
  const games = got.filter((e) => e.type === 'game');
  assert.equal(games.length, 1, 'trois touches rapprochées = un événement');
  assert.deepEqual([games[0].game.id, games[0].game.players], ['bulles', 2]);
  assert.ok(got.some((e) => e.type === 'server' && e.server.players === 2));
  insts[0].online = false; bus.touch();
  await until(() => got.some((e) => e.type === 'game' && e.game.status === 'offline'));
  bus.close();
});

test('catalogue : chaque jeu multi du portail est prêt et a une adresse', () => {
  const games = JSON.parse(readFileSync(new URL('../games.json', import.meta.url), 'utf8'));
  const multi = games.filter((g) => g.multi);
  assert.ok(multi.length >= 7);
  for (const g of multi) assert.ok(g.ready && g.url, `${g.id} doit être prêt et avoir une adresse`);
});
