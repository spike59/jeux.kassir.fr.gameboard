import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPortal } from '../src/portal.js';
import { parseKeys } from '../src/app.js';

async function start(t, { releases = false } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'gameboard-portal-'));
  const games = join(dir, 'games');
  await mkdir(join(games, 'bulles', 'public'), { recursive: true });
  await mkdir(join(games, 'serveur-jeu'), { recursive: true });
  await mkdir(join(dir, 'site'));
  await writeFile(join(games, 'bulles', 'public', 'index.html'), '<h1>bulles</h1>');
  await writeFile(join(games, 'bulles', 'game.json'), '{}');
  await writeFile(join(games, 'serveur-jeu', 'Dockerfile'), 'FROM secret');
  await writeFile(join(dir, 'games.json'), JSON.stringify([{ id: 'bulles', ready: true, url: '/jeux/bulles/' }, { id: 'bientot', ready: false }]));
  if (releases) await writeFile(join(dir, 'releases.json'), JSON.stringify({ projects: ['bulles', 'bientot', 'secure', 'kassir_devops'].map((code) => ({ code, releases: [] })) }));
  const portal = createPortal({
    publicHost: 'jeux.test', publicDir: join(dir, 'site'), gamesDir: games, catalog: join(dir, 'games.json'), releases: releases ? join(dir, 'releases.json') : '',
    apiOptions: { keys: parseKeys(''), dataDir: join(dir, 'data') }, trustProxy: true,
  });
  const server = portal.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  t.after(async () => { server.close(); await rm(dir, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${server.address().port}`;
  return (path) => fetch(`${base}${path}`, { headers: { 'x-forwarded-proto': 'https' }, redirect: 'manual' });
}

test('un jeu statique est servi depuis games/<id>/public/ seulement', async (t) => {
  const get = await start(t);
  const ok = await get('/jeux/bulles/');
  assert.equal(ok.status, 200);
  assert.match(await ok.text(), /bulles/);
  assert.equal((await get('/jeux/bulles/game.json')).status, 404); // hors de public/
  assert.equal((await get('/jeux/serveur-jeu/Dockerfile')).status, 404); // jamais servi
  assert.equal((await get('/jeux/..%2Fgames/bulles/game.json')).status, 404);
  assert.equal((await get('/jeux/inconnu/')).status, 404);
});

test('sans HTTPS : redirection vers le nom configuré ; /healthz et /games.json répondent', async (t) => {
  const get = await start(t);
  const plain = await fetch((await get('/healthz')).url.replace(/\/healthz$/, '/jeux/bulles/'), { redirect: 'manual' });
  assert.equal(plain.status, 301);
  assert.equal(plain.headers.get('location'), 'https://jeux.test/jeux/bulles/');
  assert.equal((await get('/healthz')).status, 200);
  assert.equal((await get('/games.json')).status, 200);
});

test('/releases.json ne contient que les jeux publics', async (t) => {
  const get = await start(t, { releases: true });
  const res = await get('/releases.json');
  assert.equal(res.status, 200);
  assert.deepEqual((await res.json()).projects.map((p) => p.code), ['bulles']);
});
