import { test } from 'node:test';
import assert from 'node:assert/strict';
import { label } from '../site/lib/multi-entry.js';

const state = { games: [
  { id: 'a', online: true, rooms: 0, players: 0, joinable: 0 },
  { id: 'b', online: true, rooms: 2, players: 3, joinable: 1 },
  { id: 'c', online: true, rooms: 1, players: 1, joinable: 0 },
  { id: 'd', online: false, rooms: 0, players: 0, joinable: 0 },
] };

test('libellé du bouton Multijoueur selon l\'état annoncé par le portail', () => {
  assert.deepEqual(label(state, 'a'), { text: '👥 Multijoueur · aucune partie', status: 'en ligne' });
  assert.deepEqual(label(state, 'b'), { text: '👥 Multijoueur · 2 parties, 3 joueurs', status: 'à rejoindre' });
  assert.deepEqual(label(state, 'c'), { text: '👥 Multijoueur · 1 partie, 1 joueur', status: 'en cours' });
  assert.deepEqual(label(state, 'd'), { text: '👥 Multijoueur · serveur arrêté', status: 'hors ligne' });
  assert.equal(label(null, 'a').text, '👥 Multijoueur');
  assert.equal(label(state, 'inconnu').status, 'inconnu');
});
