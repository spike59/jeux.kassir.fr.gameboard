import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRemoteHub } from '../src/remote-hub.js';

test('relais du hub : copie info et parc de swordfish, signale « hors ligne » quand il ne répond plus', async () => {
  let up = true;
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (!up) throw new Error('KO');
    return { ok: true, json: async () => (url.endsWith('/info') ? { id: 'swordfish', name: 'Swordfish', players: 3, rooms: 1, games: [{ id: 'bulles' }] } : { t: 1, rides: [{ id: 'bulles' }], salon: ['Alice'] }) };
  };
  const hub = createRemoteHub({ baseUrl: 'http://sf/jeux/swordfish', fetchImpl, everyMs: 60_000 });
  await hub.poll();
  assert.equal(hub.info().players, 3);
  assert.equal(hub.info().online, true);
  assert.deepEqual(hub.parc().salon, ['Alice']);
  assert.ok(calls.every((u) => u.startsWith('http://sf/jeux/swordfish/api/hub/')));
  up = false;
  await hub.poll();
  assert.equal(hub.info().online, false);
  assert.equal(hub.info().players, 3, 'les dernières valeurs restent affichées');
  hub.close();
});

test("relais du hub : n'interroge swordfish que tant que quelqu'un lit le parc", async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; return { ok: true, json: async () => ({ rides: [], salon: [], players: 0, rooms: 0, games: [] }) }; };
  const hub = createRemoteHub({ baseUrl: 'http://sf/jeux/swordfish', fetchImpl, everyMs: 20, idleMs: 100 });
  await new Promise((r) => setTimeout(r, 80));
  assert.equal(calls, 0, 'personne ne lit : aucune requête');
  hub.parc(); // un lecteur : on lit tout de suite, puis toutes les 20 ms
  await new Promise((r) => setTimeout(r, 90));
  assert.ok(calls >= 4, 'tant que quelqu\'un lit');
  await new Promise((r) => setTimeout(r, 200)); // plus de lecteur depuis plus de 100 ms
  const settled = calls;
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(calls, settled, 'sans lecteur, on s\'arrête');
  hub.close();
});
