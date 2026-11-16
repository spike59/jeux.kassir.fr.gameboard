import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { multiState } from '../src/multi.js';

const catalog = [
  { id: 'bulles', title: 'Bulles', icon: '🫧', url: '/jeux/bulles/', ready: true, multi: true },
  { id: 'space_run', title: 'Space Run', icon: '🚀', url: '/jeux/space_run/', ready: true, multi: true },
  { id: 'parc', title: 'Parc', icon: '🎡', url: '/jeux/parc/', ready: true },
  { id: 'taupe', title: 'Taupe', icon: '🔨', ready: false, multi: true },
];
const parc = { rides: [
  { id: 'bulles', online: true, max: 6, trains: [{ id: '1', status: 'waiting', players: 2, max: 6 }, { id: '2', status: 'playing', players: 3, max: 6 }, { id: '3', status: 'waiting', players: 6, max: 6 }] },
  { id: 'space_run', online: false, max: 4, trains: [] },
] };

test('multiState : seulement les jeux multi prêts, avec les comptes des parties', () => {
  const s = multiState(catalog, { online: true, players: 5, rooms: 3 }, parc);
  assert.deepEqual(s.games.map((g) => g.id), ['bulles', 'space_run']);
  const b = s.games[0];
  assert.deepEqual([b.online, b.rooms, b.players, b.joinable, b.max], [true, 3, 11, 1, 6]);
  assert.equal(b.lobby, '/multi/?game=bulles');
  assert.deepEqual(s.server, { online: true, players: 5, rooms: 3 });
});

test('multiState : serveur de jeux injoignable ou jeu absent du parc = hors ligne, sans prénoms', () => {
  assert.equal(multiState(catalog, { online: false }, parc).games[0].online, false);
  const s = multiState(catalog, { online: true }, { rides: [] });
  assert.ok(s.games.every((g) => !g.online && g.rooms === 0));
  assert.ok(!JSON.stringify(multiState(catalog, { online: true }, { rides: [{ id: 'bulles', online: true, trains: [{ players: 1, names: ['Léa'] }] }] })).includes('Léa'));
});

test('catalogue : chaque jeu multi du portail est prêt et a une adresse', () => {
  const games = JSON.parse(readFileSync(new URL('../games.json', import.meta.url), 'utf8'));
  const multi = games.filter((g) => g.multi);
  assert.ok(multi.length >= 7);
  for (const g of multi) assert.ok(g.ready && g.url, `${g.id} doit être prêt et avoir une adresse`);
});
