// Salon multijoueur de jeux.kassir.fr (le « realm ») : on choisit un jeu, on voit ses parties et on joue ; discussion avec les autres.
//   1. on arrive d'un jeu (bouton « Multijoueur » de son menu : /multi/?game=<jeu>) ou du portail (/multi/) ;
//   2. un clic sur un jeu le SÉLECTIONNE (sans recharger) : ses parties, jouer ou créer une partie ;
//   3. rejoindre ou créer ouvre le jeu : il se connecte et entre dans la salle (…/jeux/<jeu>/?room=<id> ou ?create=1).
// L'état des jeux (parties, joueurs) est poussé en direct par le portail ; les parties du hub arrivent par WebSocket.
// Les anciens affichages réseau (toutes les parties de tous les jeux, parties entre joueurs) ne sont visibles qu'avec ?debug=true.
import { applyEvent, label } from '/lib/multi-entry.js';

const NAME = /^[\p{L}\p{N}][\p{L}\p{N} '_-]{0,15}$/u; // mêmes règles que les classements
const NAME_KEY = 'kassir.player'; // commun à tous les jeux du site (même origine)
const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === 'true';
let FOCUS = params.get('game') || ''; // le jeu sélectionné
const firstFocus = (a, b) => (b.dataset.game === FOCUS) - (a.dataset.game === FOCUS);

const readName = () => {
  try { return localStorage.getItem(NAME_KEY) || localStorage.getItem('bulles.player') || ''; } catch { return ''; }
};
const writeName = (n) => { try { localStorage.setItem(NAME_KEY, n); localStorage.setItem('bulles.player', n); } catch { /* navigation privée */ } };

function el(tag, props = {}, ...kids) {
  const { dataset, ...rest } = props; // `dataset` est en lecture seule : on remplit l'objet
  const node = Object.assign(document.createElement(tag), rest);
  if (dataset) Object.assign(node.dataset, dataset);
  node.append(...kids.filter((k) => k != null));
  return node;
}

let ws = null;
let games = []; // [{ id, title, min, max }] annoncés par le hub du serveur commun
let info = {}; // id -> { title, icon, url } (games.json)
let rooms = {}; // jeu -> salles (hub)
let streamState = null; // l'état poussé par le portail : { seq, server, games: Map }
let pingTimer = 0;
let ping = 0;
let serverInfo = null;

const catalog = fetch('/games.json').then((r) => r.json()).then((list) => {
  for (const g of list) info[g.id] = { title: g.title, icon: g.icon, url: g.url };
}).catch(() => {});
const iconOf = (id) => info[id]?.icon ?? '🎮';
const titleOf = (id) => info[id]?.title ?? games.find((g) => g.id === id)?.title ?? id;

function header() {
  if (!serverInfo) return;
  $('server').textContent = `🖥️ ${serverInfo.name} · ${serverInfo.players} joueur${serverInfo.players > 1 ? 's' : ''} en ligne${ping ? ` · ping ${ping} ms` : ''}`;
}

function connect(name) {
  const url = new URL('/jeux/swordfish/hub', location.href);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(url);
  $('server').textContent = 'Connexion au serveur…';
  ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', name }));
  ws.onmessage = (e) => { try { onMessage(JSON.parse(e.data)); } catch { /* illisible : ignoré */ } };
  ws.onerror = () => { $('server').textContent = 'Serveur injoignable.'; };
  ws.onclose = () => {
    clearInterval(pingTimer);
    $('server').textContent = 'Connexion perdue. Recharge la page pour revenir.';
  };
}
const send = (m) => { if (ws?.readyState === 1) ws.send(JSON.stringify(m)); };

async function onMessage(m) {
  switch (m.t) {
    case 'welcome': {
      await catalog;
      serverInfo = m.server;
      games = m.server.games;
      $('login').hidden = true;
      $('lobby').hidden = false;
      $('legacy').hidden = !DEBUG;
      $('me').textContent = `— tu es ${m.name}`;
      $('chat').replaceChildren();
      for (const line of m.history ?? []) chat(line);
      chat({ sys: true, text: 'Bienvenue dans le salon !' });
      renderAll();
      header();
      sendPing();
      pingTimer = setInterval(sendPing, 3000);
      break;
    }
    case 'pong': ping = Math.max(1, Date.now() - m.n); header(); break;
    case 'chat': chat(m); break;
    case 'rooms': rooms[m.game] = m.rooms; renderRooms(); renderGameCard(); break;
    case 'server-game': location.href = m.url; break; // partie créée sur le serveur : on la rejoint
    case 'error': { const h = $('sf-hint'); h.textContent = m.text; h.hidden = false; $('sf-submit')?.removeAttribute('disabled'); break; }
    default: break;
  }
}
const sendPing = () => send({ t: 'ping', n: Date.now() });

// ---- l'état des jeux, poussé par le portail à chaque changement (aucune interrogation) : voir src/multi.js de gameboard ----

function paintStrip() {
  if (!streamState) return;
  $('games-strip').replaceChildren(...[...streamState.games.values()].map((g) => {
    const l = label(streamState, g.id);
    return el('button', { type: 'button', className: `chip${g.id === FOCUS ? ' focus' : ''}`, dataset: { status: l.status, game: g.id }, onclick: () => selectGame(g.id), ariaPressed: String(g.id === FOCUS) },
      `${g.icon ?? '🎮'} ${g.title}`, el('small', { textContent: l.text.replace('👥 Multijoueur · ', '').replace('👥 Multijoueur', 'état inconnu') }));
  }));
}

function openStream() {
  const es = new EventSource('/api/v1/multi/stream');
  for (const type of ['snapshot', 'game', 'server']) {
    es.addEventListener(type, (e) => {
      let ev; try { ev = JSON.parse(e.data); } catch { return; }
      const next = applyEvent(type === 'snapshot' ? null : streamState, ev);
      if (!next) { es.close(); openStream(); return; } // un trou : on repart d'un état complet
      streamState = next;
      paintStrip();
      renderGameCard();
      if (serverInfo && streamState.server) { serverInfo = { ...serverInfo, players: streamState.server.players }; header(); }
    });
  }
}
if (typeof EventSource !== 'undefined') openStream();

function chat({ from, text, sys }) {
  const log = $('chat');
  log.append(sys ? el('p', { className: 'sys', textContent: text }) : el('p', {}, el('b', { textContent: `${from} : ` }), text));
  while (log.childElementCount > 80) log.firstChild.remove();
  log.scrollTop = log.scrollHeight;
}

const gameOf = (id) => games.find((g) => g.id === id);

// ---- choisir un jeu ----

// Un clic sur un jeu le sélectionne ici, sans recharger la page ; l'adresse suit (on peut la partager, et « précédent » ne piège pas).
function selectGame(id) {
  FOCUS = id;
  const u = new URL(location.href);
  u.searchParams.set('game', id);
  try { history.replaceState(null, '', u); } catch { /* adresse non modifiable : sans importance */ }
  renderAll();
  $('game-card').scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
}

function renderAll() {
  paintStrip();
  renderGameCard();
  renderRooms();
  renderNewGames();
  renderServerForm();
}

// Les parties d'une salle du hub, une ligne : qui joue, et le moyen de la rejoindre.
function roomRow(game, r) {
  const waiting = r.status === 'waiting';
  const full = r.players >= r.max;
  // une partie du serveur se rejoint à tout moment (en cours : on regarde, on joue à la course suivante)
  const joinable = r.url ? !full : waiting && !full;
  return el('li', { dataset: { game }, className: game === FOCUS ? 'focus' : '' },
    el('span', { className: 'ico', textContent: iconOf(game), title: titleOf(game) }),
    el('span', { className: 't' },
      el('strong', { textContent: `${r.name}` }),
      el('small', { textContent: `${titleOf(game)} · ${r.names.join(', ')} (${r.players}/${r.max})` })),
    joinable
      ? el('a', { href: r.url ?? `/jeux/${game}/?room=${encodeURIComponent(r.id)}`, textContent: 'Rejoindre' })
      : el('span', { className: `badge ${waiting ? 'wait' : 'run'}`, textContent: waiting ? 'Complète' : 'En cours' }));
}

// La fiche du jeu choisi : l'état en direct, jouer ou créer une partie, ses parties.
function renderGameCard() {
  const card = $('game-card');
  card.hidden = !FOCUS;
  $('pick-hint').hidden = !!FOCUS;
  if (!FOCUS) return;
  const hub = gameOf(FOCUS);
  const url = info[FOCUS]?.url ?? `/jeux/${FOCUS}/`;
  $('game-title').textContent = `2 · ${iconOf(FOCUS)} ${titleOf(FOCUS)}`;
  const st = streamState ? label(streamState, FOCUS) : null;
  $('game-state').textContent = st ? st.text.replace('👥 Multijoueur · ', '').replace('👥 Multijoueur', 'état inconnu') : 'état en cours de lecture…';
  // jouer : un jeu du hub crée sa salle en s'ouvrant (?create=1) ; un jeu qui a son propre serveur (lili-kart) a sa file d'attente dans son menu
  const actions = [];
  if (hub && !hub.external) actions.push(el('a', { className: 'primary', href: `/jeux/${FOCUS}/?create=1`, textContent: `➕ Créer une partie (${hub.min} à ${hub.max} joueurs)` }));
  else if (hub?.external && hub.createUrl !== null) actions.push(el('a', { className: 'primary', href: hub.createUrl ?? `/jeux/${FOCUS}/?create=1`, textContent: '➕ Créer une partie' }));
  else if (!hub) actions.push(el('a', { className: 'primary', href: url, textContent: '▶ Jouer (la file d\'attente et le jeu libre sont dans le jeu)' }));
  actions.push(el('a', { href: url, textContent: hub ? 'Ouvrir le jeu' : 'Ouvrir le menu du jeu' }));
  $('game-actions').replaceChildren(...actions);
  // ses parties : celles du hub, sinon ce que le portail annonce (comptes seulement)
  const mine = (rooms[FOCUS] ?? []).map((r) => roomRow(FOCUS, r));
  const live = streamState?.games.get(FOCUS);
  $('game-rooms').replaceChildren(...mine);
  $('game-empty').hidden = mine.length > 0;
  $('game-empty').textContent = live?.rooms ? `${live.rooms} partie${live.rooms > 1 ? 's' : ''} en cours, ${live.players} joueur${live.players > 1 ? 's' : ''} : rejoins-les depuis le jeu.` : 'Aucune partie en cours. Lance la première !';
}

// Anciens affichages (?debug=true) : toutes les parties de tous les jeux, deux listes qui ne se mélangent pas.
function renderRooms() {
  const server = [];
  const peer = [];
  for (const [game, list] of Object.entries(rooms)) {
    for (const r of list) (r.url && !r.dedicated ? peer : server).push(roomRow(game, r));
  }
  server.sort(firstFocus); peer.sort(firstFocus);
  $('rooms').replaceChildren(...server);
  $('rooms-empty').hidden = server.length > 0;
  $('rooms-peer').replaceChildren(...peer);
  $('peer-empty').hidden = peer.length > 0;
}

// Créer une partie sur le serveur : pour les jeux qui l'offrent (serverModes), le serveur du jeu fait tourner la partie.
// Dans la fiche du jeu choisi, seulement pour ce jeu.
function renderServerForm() {
  const hosted = games.filter((g) => g.serverModes?.length);
  const mine = hosted.find((g) => g.id === FOCUS);
  $('server-form').hidden = !mine;
  if (!mine) return;
  const gameSel = $('sf-game');
  const modeSel = $('sf-mode');
  gameSel.replaceChildren(...hosted.map((g) => el('option', { value: g.id, textContent: `${iconOf(g.id)} ${g.title}` })));
  gameSel.value = FOCUS;
  gameSel.hidden = true; // le jeu est déjà choisi
  const paint = () => modeSel.replaceChildren(...hosted.find((g) => g.id === gameSel.value).serverModes.map((x) => el('option', { value: x.id, textContent: x.label })));
  paint();
  const submit = $('server-form').querySelector('button[type=submit]');
  submit.id = 'sf-submit';
  $('server-form').onsubmit = (e) => {
    e.preventDefault();
    const name = $('sf-name').value.normalize('NFC').trim();
    if (!name) { $('sf-hint').textContent = 'Donne un nom à ta partie.'; $('sf-hint').hidden = false; return; }
    $('sf-hint').hidden = true;
    submit.disabled = true;
    send({ t: 'server-game', game: gameSel.value, mode: modeSel.value, name });
  };
}

// Anciens affichages (?debug=true) : un bouton de création par jeu.
function renderNewGames() {
  $('new-hub').replaceChildren(...games.filter((g) => !g.external).map((g) =>
    el('a', { href: `/jeux/${g.id}/?create=1`, dataset: { game: g.id }, className: g.id === FOCUS ? 'focus' : '' }, el('span', { textContent: iconOf(g.id) }), `${g.title} (${g.min} à ${g.max} joueurs)`)));
  [...$('new-hub').children].sort(firstFocus).forEach((n) => $('new-hub').append(n));
  $('new-games').replaceChildren(...games.filter((g) => g.external && g.createUrl !== null).map((g) =>
    el('a', { href: g.createUrl ?? `/jeux/${g.id}/?create=1`, dataset: { game: g.id }, className: g.id === FOCUS ? 'focus' : '' }, el('span', { textContent: iconOf(g.id) }), `${g.title} (${g.min} à ${g.max} joueurs)`)));
}

$('login-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = $('name').value.normalize('NFC').trim().replace(/\s+/g, ' ');
  if (!NAME.test(name)) {
    $('login-hint').textContent = "Un prénom de 1 à 16 lettres ou chiffres, s'il te plaît.";
    $('login-hint').className = 'hint err';
    $('login-hint').hidden = false;
    return;
  }
  writeName(name);
  connect(name);
});

$('chat-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = $('chat-text');
  if (input.value.trim()) send({ t: 'chat', text: input.value });
  input.value = '';
});

const known = readName();
if (known && NAME.test(known)) connect(known);
else {
  $('login').hidden = false;
  $('server').textContent = 'Choisis ton prénom pour entrer.';
  $('name').focus();
}
