import { test } from 'node:test';
import assert from 'node:assert/strict';
import { label, applyEvent, mountMultiEntry } from '../site/lib/multi-entry.js';

const g = (id, extra = {}) => ({ id, status: 'online', online: true, rooms: 0, players: 0, joinable: 0, ...extra });
const snap = { type: 'snapshot', seq: 4, server: { players: 0 }, games: [g('a'), g('b', { rooms: 2, players: 3, joinable: 1 }), g('c', { rooms: 1, players: 1 }), g('d', { status: 'offline', online: false }), g('e', { status: 'draining', online: false })] };

test("libellé du bouton Multijoueur selon l'état poussé par le portail", () => {
  const st = applyEvent(null, snap);
  assert.deepEqual(label(st, 'a'), { text: '👥 Multijoueur · aucune partie', status: 'en ligne' });
  assert.deepEqual(label(st, 'b'), { text: '👥 Multijoueur · 2 parties, 3 joueurs', status: 'à rejoindre' });
  assert.deepEqual(label(st, 'c'), { text: '👥 Multijoueur · 1 partie, 1 joueur', status: 'en cours' });
  assert.deepEqual(label(st, 'd'), { text: '👥 Multijoueur · serveur arrêté', status: 'hors ligne' });
  assert.deepEqual(label(st, 'e'), { text: '👥 Multijoueur · maintenance', status: 'maintenance' });
  assert.equal(label(null, 'a').text, '👥 Multijoueur');
  assert.equal(label(st, 'inconnu').status, 'inconnu');
});

test("applyEvent : applique les événements dans l'ordre, refuse un trou", () => {
  let st = applyEvent(null, snap);
  st = applyEvent(st, { type: 'game', seq: 5, game: g('a', { rooms: 1, players: 2 }) });
  assert.equal(st.games.get('a').players, 2);
  st = applyEvent(st, { type: 'server', seq: 6, server: { players: 2 } });
  assert.equal(st.server.players, 2);
  assert.equal(applyEvent(st, { type: 'game', seq: 9, game: g('a') }), null, 'trou : se réabonner');
  assert.equal(applyEvent(null, { type: 'game', seq: 1, game: g('a') }), null, "pas d'état de départ");
});

test('mountMultiEntry : un seul abonnement, le bouton suit les événements poussés', () => {
  const made = [];
  class FakeES {
    constructor(url) { this.url = url; this.l = {}; made.push(this); }
    addEventListener(t, f) { this.l[t] = f; }
    close() { this.closed = true; }
    emit(t, ev) { this.l[t]({ data: JSON.stringify(ev) }); }
  }
  const btn = { dataset: {} };
  const m = mountMultiEntry(btn, { game: 'b', existing: true, EventSourceImpl: FakeES });
  assert.equal(made.length, 1); assert.equal(made[0].url, '/api/v1/multi/stream');
  assert.equal(btn.href, '/multi/?game=b');
  made[0].emit('snapshot', snap);
  assert.equal(btn.textContent, '👥 Multijoueur · 2 parties, 3 joueurs');
  made[0].emit('game', { type: 'game', seq: 5, game: g('b', { rooms: 0 }) });
  assert.equal(btn.textContent, '👥 Multijoueur · aucune partie');
  made[0].emit('game', { type: 'game', seq: 9, game: g('b') }); // trou : on se réabonne
  assert.equal(made.length, 2); assert.equal(made[0].closed, true);
  m.stop();
});
