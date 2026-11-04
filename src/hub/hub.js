// Hub de jeux.kassir.fr : le salon commun à tous les jeux à plusieurs.
//   - un joueur arrive, choisit son prénom, voit les serveurs (le « realm »), le chat général et les salles ouvertes de chaque jeu ;
//   - il crée ou rejoint une salle ; le propriétaire lance la partie ; le jeu (un « module », ex. bulles.js) fait tourner les règles.
// Un serveur = ce processus (serveur01). Le serveur décide de tout : les navigateurs n'envoient que des intentions (« j'éclate la bulle 12 »).
//
// Protocole : JSON sur un WebSocket (chemin /api/v1/hub).
//   client -> serveur : hello{name,id?}  chat{text}  rooms{game}  create{game,name?}  join{room}  leave  start  again  ping{n}  + messages du jeu (ex. pop{b})
//   serveur -> client : welcome{id,name,server,servers}  chat{from,text}  rooms{game,rooms}  room{room}  error{text}  pong{n}  + messages du jeu
// Jeux « externes » (ex. Police vs voleurs) : leur propre serveur fait tourner les parties ; le hub lit leurs salles
//   { id, title, min, max, infoUrl, joinUrl(roomId), createUrl } où infoUrl répond { rooms: [{ id, name, master, status, players }] }
//   et les montre dans le salon avec un lien « Rejoindre » vers le jeu (le prénom est repris par le jeu).
//   host (facultatif) : { url, key, modes: [{ id, label }] } — le serveur du jeu fait tourner des parties lui-même (serveur dédié) :
//   le salon lui demande d'en créer une (POST url avec la clé) puis envoie le joueur la rejoindre. Les salles dont le relais
//   dit « dedicated » sont celles-là ; les autres sont des parties entre joueurs (un joueur fait tourner la partie).
// Module de jeu : { id, title, min, max, onJoin(room,p), onStart(room,api), onMessage(room,p,msg,api), onLeave(room,p,api), reset(room) }
//   api : { now(), rng(), every(ms,fn)->stop, after(ms,fn)->stop, broadcast(msg), others(player,msg), send(player,msg), changed() }
import { WebSocketServer } from 'ws';
import { randomUUID } from 'node:crypto';

const NAME = /^[\p{L}\p{N}][\p{L}\p{N} '_-]{0,15}$/u; // mêmes règles que les classements
const MAX_CLIENTS = 200;
const MAX_ROOMS = 30;
const MAX_MESSAGE = 2048; // octets : le navigateur n'envoie que de petits messages
const RATE = { max: 60, windowMs: 1000 }; // messages par connexion et par seconde
const CHAT_MAX = 120;
const CHAT_EVERY_MS = 1000;
const CHAT_HISTORY = 30;

const clean = (s) => String(s ?? '').normalize('NFC').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().replace(/\s+/g, ' ');

export function createHub({
  modules, publicOrigin = null, serverId = 'serveur01', serverName = 'Serveur 01',
  now = () => Date.now(), rng = Math.random,
  external = [], fetchImpl = fetch,
  every = (ms, fn) => { const t = setInterval(fn, ms); return () => clearInterval(t); },
  after = (ms, fn) => { const t = setTimeout(fn, ms); return () => clearTimeout(t); },
} = {}) {
  const games = new Map(modules.map((m) => [m.id, m]));
  const players = new Map(); // id -> { id, name, ws, room, lastChat }
  const rooms = new Map(); // id -> { id, game, name, owner, status, players: Map, state }
  const history = [];
  const ext = new Map(external.map((e) => [e.id, { ...e, rooms: [], ok: false, sig: '' }]));
  async function pollExternal() {
    let any = false;
    for (const e of ext.values()) {
      try {
        // X-Forwarded-Proto : le serveur du jeu n'accepte que le HTTPS (le proxy le lui dit ; ici on parle en direct sur le réseau Docker)
        const res = await fetchImpl(e.infoUrl, { headers: { 'x-forwarded-proto': 'https' }, signal: AbortSignal.timeout(2500) });
        const body = await res.json();
        e.rooms = (body.rooms ?? []).slice(0, 30);
        e.ok = res.ok;
      } catch {
        e.rooms = [];
        e.ok = false;
      }
      const sig = JSON.stringify([e.ok, e.rooms]);
      if (sig !== e.sig) { e.sig = sig; any = true; }
    }
    if (any) changed(null);
  }
  if (ext.size) { pollExternal(); every(3000, pollExternal); }
  let nextRoom = 1;
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE });

  const send = (p, msg) => { if (p?.ws?.readyState === 1) p.ws.send(JSON.stringify(msg)); };
  const roomView = (r) => ({
    id: r.id, game: r.game, name: r.name, owner: r.owner, status: r.status, max: games.get(r.game).max, min: games.get(r.game).min,
    players: [...r.players.values()].map((p) => ({ id: p.id, name: p.name, color: p.color, score: p.score ?? 0, lives: p.lives, out: !!p.out })),
  });
  const roomRow = (r) => ({ id: r.id, name: r.name, status: r.status, players: r.players.size, max: games.get(r.game).max, names: [...r.players.values()].map((p) => p.name) });
  const listFor = (game) => {
    const e = ext.get(game);
    if (e) {
      return e.rooms.map((r) => ({ id: String(r.id), name: String(r.name ?? 'Partie'), status: r.status === 'waiting' ? 'waiting' : 'playing', players: Number(r.players) || 0, max: e.max, names: (Array.isArray(r.names) && r.names.length ? r.names : [r.master]).map((n) => String(n ?? '').slice(0, 16)).filter(Boolean), url: e.joinUrl(encodeURIComponent(r.id)), dedicated: !!r.dedicated }));
    }
    return [...rooms.values()].filter((r) => r.game === game).map(roomRow);
  };
  const allGames = () => [...games.keys(), ...ext.keys()];

  const info = () => ({
    id: serverId, name: serverName,
    // joueurs : ceux du salon + ceux des parties des jeux externes
    players: players.size + [...ext.values()].reduce((n, e) => n + e.rooms.reduce((k, r) => k + (Number(r.players) || 0), 0), 0),
    rooms: rooms.size + [...ext.values()].reduce((n, e) => n + e.rooms.length, 0),
    games: [
      ...[...games.values()].map((g) => ({ id: g.id, title: g.title, min: g.min, max: g.max, rooms: listFor(g.id).length })),
      ...[...ext.values()].map((e) => ({ id: e.id, title: e.title, min: e.min, max: e.max, rooms: e.rooms.length, external: true, online: e.ok, createUrl: e.createUrl, serverModes: e.host?.key ? e.host.modes : [] })),
    ],
  });

  // les salons voient la liste des salles quand elle change ; les salles voient leur propre état
  function changed(room) {
    if (room) for (const p of room.players.values()) send(p, { t: 'room', room: roomView(room) });
    for (const p of players.values()) if (!p.room) for (const g of allGames()) send(p, { t: 'rooms', game: g, rooms: listFor(g) });
  }

  const apiFor = (room) => ({
    now, rng, every, after,
    broadcast: (msg) => { for (const p of room.players.values()) send(p, msg); },
    others: (from, msg) => { for (const p of room.players.values()) if (p !== from) send(p, msg); },
    send,
    changed: () => changed(room),
  });

  function leave(p) {
    const room = p.room && rooms.get(p.room);
    p.room = null;
    if (!room) return;
    room.players.delete(p.id);
    games.get(room.game).onLeave?.(room, p, apiFor(room));
    if (!room.players.size) {
      rooms.delete(room.id);
    } else if (room.owner === p.id) {
      room.owner = room.players.keys().next().value; // le suivant devient propriétaire
    }
    changed(rooms.has(room.id) ? room : null);
  }

  function handle(p, m) {
    switch (m.t) {
      case 'ping': return send(p, { t: 'pong', n: m.n });
      case 'chat': {
        const text = clean(m.text).slice(0, CHAT_MAX);
        if (!text || now() - p.lastChat < CHAT_EVERY_MS) return;
        p.lastChat = now();
        const line = { t: 'chat', from: p.name, text };
        history.push(line);
        if (history.length > CHAT_HISTORY) history.shift();
        for (const q of players.values()) send(q, line);
        return;
      }
      case 'rooms': return send(p, { t: 'rooms', game: String(m.game), rooms: games.has(m.game) || ext.has(m.game) ? listFor(m.game) : [] });
      case 'create': {
        if (p.room) return send(p, { t: 'error', text: "Tu es déjà dans une salle." });
        if (ext.has(m.game)) return send(p, { t: 'error', text: 'Cette partie se crée depuis le jeu.' });
        if (!games.has(m.game)) return send(p, { t: 'error', text: 'Jeu inconnu.' });
        if (rooms.size >= MAX_ROOMS) return send(p, { t: 'error', text: 'Trop de salles ouvertes, réessaie plus tard.' });
        const room = { id: String(nextRoom++), game: m.game, name: clean(m.name).slice(0, 24) || `Salle de ${p.name}`, owner: p.id, status: 'waiting', players: new Map(), state: null };
        rooms.set(room.id, room);
        return enter(p, room);
      }
      case 'join': {
        const room = rooms.get(String(m.room));
        if (!room) return send(p, { t: 'error', text: "Cette salle n'existe plus." });
        if (p.room === room.id) return;
        if (p.room) return send(p, { t: 'error', text: 'Quitte ta salle avant d\'en rejoindre une autre.' });
        if (room.status !== 'waiting') return send(p, { t: 'error', text: 'La partie a déjà commencé.' });
        if (room.players.size >= games.get(room.game).max) return send(p, { t: 'error', text: 'La salle est pleine.' });
        return enter(p, room);
      }
      case 'server-game': { // créer une partie hébergée par le serveur d'un jeu externe, puis y envoyer le joueur
        const e = ext.get(m.game);
        if (!e?.host?.key) return send(p, { t: 'error', text: "Ce jeu n'a pas de partie sur le serveur." });
        const mode = String(m.mode ?? '');
        if (!e.host.modes.some((x) => x.id === mode)) return send(p, { t: 'error', text: 'Mode inconnu.' });
        const name = clean(m.name).slice(0, 24);
        if (now() - (p.lastServerGame ?? -1e9) < 10_000) return send(p, { t: 'error', text: 'Un instant avant de créer une autre partie.' });
        p.lastServerGame = now(); // pas de salles en rafale
        fetchImpl(e.host.url, {
          method: 'POST',
          headers: { authorization: `Bearer ${e.host.key}`, 'content-type': 'application/json', 'x-forwarded-proto': 'https' },
          body: JSON.stringify({ name, master: p.name, mode }),
          signal: AbortSignal.timeout(20_000),
        })
          .then(async (res) => {
            const body = await res.json().catch(() => ({}));
            if (!res.ok) return send(p, { t: 'error', text: body.error || 'Le serveur de parties ne répond pas.' });
            pollExternal(); // la salle apparaît tout de suite dans la liste
            return send(p, { t: 'server-game', game: e.id, id: String(body.id), url: e.joinUrl(encodeURIComponent(body.id)) });
          })
          .catch(() => send(p, { t: 'error', text: 'Le serveur de parties ne répond pas.' }));
        return undefined;
      }
      case 'leave': return leave(p);
      case 'start': {
        const room = p.room && rooms.get(p.room);
        const game = room && games.get(room.game);
        if (!room || room.owner !== p.id || room.status !== 'waiting') return;
        if (room.players.size < game.min) return send(p, { t: 'error', text: `Il faut au moins ${game.min} joueurs.` });
        room.status = 'playing';
        changed(room);
        return game.onStart(room, apiFor(room));
      }
      case 'again': {
        const room = p.room && rooms.get(p.room);
        if (!room || room.owner !== p.id || room.status !== 'finished') return;
        games.get(room.game).reset?.(room);
        room.status = 'waiting';
        return changed(room);
      }
      default: {
        const room = p.room && rooms.get(p.room);
        if (room) games.get(room.game).onMessage?.(room, p, m, apiFor(room));
      }
    }
  }

  function enter(p, room) {
    p.room = room.id;
    room.players.set(p.id, p);
    games.get(room.game).onJoin?.(room, p);
    changed(room);
  }

  wss.on('connection', (ws) => {
    let me = null;
    let hits = [];
    ws.on('message', (raw) => {
      const t = now();
      hits = hits.filter((x) => t - x < RATE.windowMs);
      if (hits.push(t) > RATE.max) return;
      let m;
      try { m = JSON.parse(raw); } catch { return; }
      if (!m || typeof m !== 'object') return;
      if (!me) {
        if (m.t !== 'hello') return;
        const name = clean(m.name);
        if (!NAME.test(name)) return ws.send(JSON.stringify({ t: 'error', text: 'Un prénom de 1 à 16 lettres ou chiffres, s\'il te plaît.' }));
        if (players.size >= MAX_CLIENTS) return ws.close(1013, 'serveur plein');
        me = { id: randomUUID().slice(0, 8), name, ws, room: null, lastChat: 0 };
        players.set(me.id, me);
        send(me, { t: 'welcome', id: me.id, name, server: info(), history });
        for (const g of allGames()) send(me, { t: 'rooms', game: g, rooms: listFor(g) });
        return;
      }
      handle(me, m);
    });
    ws.on('close', () => {
      if (!me) return;
      leave(me);
      players.delete(me.id);
    });
  });

  // État public du parc d'attractions (page /jeux/parc/) : par jeu, ses parties (les « trains ») et les prénoms de leurs joueurs, plus les visiteurs du salon
  const parc = () => ({
    t: now(),
    rides: allGames().map((id) => {
      const e = ext.get(id);
      const g = e || games.get(id);
      return {
        id, title: g.title, kind: e ? 'server' : 'salon', online: e ? e.ok : true, max: g.max,
        trains: listFor(id).map((r) => ({ id: r.id, name: r.name, status: r.status, players: r.players, max: r.max, names: r.names })),
      };
    }),
    salon: [...players.values()].filter((p) => !p.room).map((p) => String(p.name ?? '').slice(0, 16)).slice(0, 30),
  });

  return {
    info,
    parc,
    // À brancher sur le serveur HTTP : n'accepte que les pages du site (Origin) sur ce chemin.
    attach(httpServer, path = '/api/v1/hub') {
      httpServer.on('upgrade', (req, socket, head) => {
        if (new URL(req.url, 'http://x').pathname !== path) return;
        if (!publicOrigin || req.headers.origin !== publicOrigin) return socket.destroy();
        wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
      });
    },
    close() { for (const ws of wss.clients) ws.terminate(); wss.close(); },
    // pour les tests
    _players: players, _rooms: rooms, _wss: wss,
  };
}
