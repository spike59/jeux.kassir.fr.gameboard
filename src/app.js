// Gameboard : API des meilleurs scores.
//   POST /v1/scores        (clé d'un jeu)  { board, entries: [{ player, value }] } -> le meilleur de chaque joueur est gardé
//   GET  /v1/boards        (public)        tous les tops, pour le portail
//   GET  /v1/boards/:game  (public)        les tops d'un jeu
//   GET  /healthz
// Les clés ne servent qu'aux serveurs des jeux : jamais dans un navigateur. Le POST n'est pas fait pour être publié par le proxy.
import express from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';
import { GAMES as DEFAULT_GAMES } from './games.js';
import { createStore } from './store.js';

const NAME = /^[\p{L}\p{N}][\p{L}\p{N} '_-]{0,15}$/u;
const MAX_ENTRIES = 16; // joueurs par envoi
const SHOW = 10; // lignes renvoyées par classement
const RATE = { max: 120, windowMs: 60 * 1000 }; // envois par clé et par minute

const sha = (s) => createHash('sha256').update(s).digest();

// "jeu:clé,jeu2:clé2" -> Map(empreinte de la clé -> jeu). On ne garde que des empreintes en mémoire.
export function parseKeys(raw = '') {
  const keys = new Map();
  for (const part of raw.split(',').map((p) => p.trim()).filter(Boolean)) {
    const i = part.indexOf(':');
    const game = part.slice(0, i);
    const key = part.slice(i + 1);
    if (i < 1 || key.length < 32) throw new Error(`GAMEBOARD_KEYS : entrée invalide pour « ${game || part} » (clé de 32 caractères minimum)`);
    keys.set(sha(key).toString('hex'), game);
  }
  return keys;
}

export function createApp({ games = DEFAULT_GAMES, keys, dataDir, now = () => Date.now() }) {
  for (const game of keys.values()) if (!Object.hasOwn(games, game)) throw new Error(`GAMEBOARD_KEYS : jeu inconnu « ${game} »`);
  const store = createStore(dataDir);
  const boardsOf = (game) => new Map(games[game].boards.map((b) => [b.id, b]));

  function gameOfKey(req) {
    const m = /^Bearer (\S+)$/.exec(req.get('authorization') || '');
    if (!m) return null;
    const h = sha(m[1]);
    // comparaison à temps constant sur les empreintes
    for (const [known, game] of keys) if (timingSafeEqual(h, Buffer.from(known, 'hex'))) return game;
    return null;
  }

  const hits = new Map(); // jeu -> instants des derniers envois
  function rateLimited(game) {
    const t = now();
    const recent = (hits.get(game) || []).filter((x) => t - x < RATE.windowMs);
    recent.push(t);
    hits.set(game, recent);
    return recent.length > RATE.max;
  }

  async function view(game) {
    const out = {};
    for (const b of games[game].boards) {
      const rows = (await store.rows(game, b.id)).slice(0, SHOW);
      out[b.id] = { title: b.title, emoji: b.emoji, order: b.order, unit: b.unit, top: rows.map(({ player, value, date }) => ({ player, value, date })) };
    }
    return out;
  }

  const app = express();
  app.disable('x-powered-by');
  app.get('/healthz', (req, res) => res.type('text').send('ok'));

  app.get('/v1/boards', async (req, res) => {
    const out = {};
    for (const game of Object.keys(games)) out[game] = { title: games[game].title, boards: await view(game) };
    res.set('Cache-Control', 'no-cache').json(out);
  });

  app.get('/v1/boards/:game', async (req, res) => {
    if (!Object.hasOwn(games, req.params.game)) return res.status(404).json({ error: 'jeu inconnu' });
    res.set('Cache-Control', 'no-cache').json({ title: games[req.params.game].title, boards: await view(req.params.game) });
  });

  app.post('/v1/scores', express.json({ limit: '8kb' }), async (req, res) => {
    const game = gameOfKey(req);
    if (!game) return res.status(401).json({ error: 'clé invalide' });
    if (rateLimited(game)) return res.status(429).json({ error: "trop d'envois" });

    const boards = boardsOf(game); // la clé fixe le jeu : impossible d'écrire dans le classement d'un autre
    const board = boards.get(req.body?.board);
    if (!board) return res.status(400).json({ error: 'classement inconnu pour ce jeu' });
    const raw = req.body.entries;
    if (!Array.isArray(raw) || raw.length < 1 || raw.length > MAX_ENTRIES) return res.status(400).json({ error: "nombre d'entrées invalide" });

    // les entrées invalides sont ignorées une à une (un prénom refusé ne fait pas perdre les autres)
    const results = [];
    for (const e of raw) {
      const player = typeof e?.player === 'string' ? e.player.normalize('NFC').trim().replace(/\s+/g, ' ') : '';
      const ok = NAME.test(player) && Number.isInteger(e.value) && e.value >= board.min && e.value <= board.max;
      results.push(ok ? { player, status: await store.submit(game, board, player, e.value, now()) } : { player: player || null, status: 'ignored' });
    }
    if (results.every((r) => r.status === 'ignored')) return res.status(400).json({ error: 'aucune entrée valide', results });
    res.status(201).json({ board: board.id, results });
  });

  // JSON cassé, corps trop gros… : réponse courte, jamais de trace d'erreur
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.status || err.statusCode || 500;
    if (status >= 500) console.error('gameboard :', err);
    res.status(status).json({ error: status === 413 ? 'trop gros' : status < 500 ? 'requête invalide' : 'erreur serveur' });
  });

  return app;
}
