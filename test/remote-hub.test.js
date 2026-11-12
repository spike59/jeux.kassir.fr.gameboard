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
