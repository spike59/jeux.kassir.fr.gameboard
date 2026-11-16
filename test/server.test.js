// Démarrage réel de gameboard (src/server.js) : le portail écoute, l'état du multijoueur est servi, même sans instance swordfish joignable.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

async function lancer(env) {
  const dir = await mkdtemp(join(tmpdir(), 'gameboard-srv-'));
  const port = 20000 + Math.floor(Math.random() * 20000);
  const child = spawn(process.execPath, [join(import.meta.dirname, '..', 'src', 'server.js')], {
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: dir, PUBLIC_HOST: 'jeux.test', TRUST_PROXY: 'loopback', ...env }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let out = '';
  child.stdout.on('data', (d) => { out += d; }); child.stderr.on('data', (d) => { out += d; });
  const stop = async () => { child.kill(); await rm(dir, { recursive: true, force: true }); };
  const get = (p) => fetch(`http://127.0.0.1:${port}${p}`, { headers: { 'x-forwarded-proto': 'https' } });
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error(`le serveur s'est arrêté : ${out}`);
    try { if ((await get('/healthz')).ok) return { get, stop, out: () => out }; } catch { /* pas encore prêt */ }
    await new Promise((r) => setTimeout(r, 50));
  }
  await stop();
  throw new Error(`le serveur ne démarre pas : ${out}`);
}

test('le serveur démarre sans instance swordfish : état du multijoueur servi, jeux hors ligne', async () => {
  const s = await lancer({ SWORDFISH_URLS: '' });
  try {
    const body = await (await s.get('/api/v1/multi')).json();
    assert.equal(body.server.online, false);
    assert.ok(body.games.length >= 7 && body.games.every((g) => g.status === 'offline'));
  } finally { await s.stop(); }
});

test("le serveur démarre avec une instance injoignable : pas de plantage, l'instance est comptée hors ligne", async () => {
  const s = await lancer({ SWORDFISH_URLS: 'http://127.0.0.1:1/jeux/x, http://127.0.0.1:2/jeux/y' });
  try {
    await new Promise((r) => setTimeout(r, 300));
    const body = await (await s.get('/api/v1/multi')).json();
    assert.deepEqual([body.server.instances, body.server.instancesOnline], [2, 0]);
    assert.equal((await s.get('/api/v1/multi/stream')).status, 200);
  } finally { await s.stop(); }
});
