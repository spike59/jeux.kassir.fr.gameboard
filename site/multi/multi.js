// Salon multijoueur de jeux.kassir.fr : les parties en cours de tous les jeux, démarrer une partie en réseau, discussion.
// Parle au hub de gameboard (serveur01) par WebSocket. Rejoindre ou créer une partie ouvre le jeu : il se connecte et entre dans la salle
// (…/jeux/<jeu>/?room=<id> ou ?create=1). Ici on ne fait que regarder, discuter et choisir.
const NAME = /^[\p{L}\p{N}][\p{L}\p{N} '_-]{0,15}$/u; // mêmes règles que les classements
const NAME_KEY = 'kassir.player'; // commun à tous les jeux du site (même origine)
const $ = (id) => document.getElementById(id);

const readName = () => {
  try { return localStorage.getItem(NAME_KEY) || localStorage.getItem('bulles.player') || ''; } catch { return ''; }
};
const writeName = (n) => { try { localStorage.setItem(NAME_KEY, n); localStorage.setItem('bulles.player', n); } catch { /* navigation privée */ } };

function el(tag, props = {}, ...kids) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...kids.filter((k) => k != null));
  return node;
}

let ws = null;
let games = []; // [{ id, title, min, max }] annoncés par le serveur
let icons = {}; // id -> emoji (games.json)
let rooms = {}; // jeu -> salles
let pingTimer = 0;
let ping = 0;
let serverInfo = null;

const catalog = fetch('/games.json').then((r) => r.json()).then((list) => {
  for (const g of list) icons[g.id] = g.icon;
}).catch(() => {});

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
      $('me').textContent = `— tu es ${m.name}`;
      $('chat').replaceChildren();
      for (const line of m.history ?? []) chat(line);
      chat({ sys: true, text: 'Bienvenue dans le salon !' });
      renderNewGames();
      renderServerForm();
      header();
      sendPing();
      pingTimer = setInterval(sendPing, 3000);
      break;
    }
    case 'pong': ping = Math.max(1, Date.now() - m.n); header(); break;
    case 'chat': chat(m); break;
    case 'rooms': rooms[m.game] = m.rooms; renderRooms(); break;
    case 'server-game': location.href = m.url; break; // partie créée sur le serveur : on la rejoint
    case 'error': { const h = $('sf-hint'); h.textContent = m.text; h.hidden = false; $('sf-submit')?.removeAttribute('disabled'); break; }
    default: break;
  }
}
const sendPing = () => send({ t: 'ping', n: Date.now() });

// nombre de joueurs en ligne : le serveur le donne dans l'annuaire (realm), on le rafraîchit
setInterval(async () => {
  if (!serverInfo) return;
  try {
    const { servers } = await (await fetch('/api/v1/realm', { cache: 'no-store' })).json();
    serverInfo = servers.find((s) => s.id === serverInfo.id) ?? serverInfo;
    header();
  } catch { /* on garde le dernier chiffre */ }
}, 8000);

function chat({ from, text, sys }) {
  const log = $('chat');
  log.append(sys ? el('p', { className: 'sys', textContent: text }) : el('p', {}, el('b', { textContent: `${from} : ` }), text));
  while (log.childElementCount > 80) log.firstChild.remove();
  log.scrollTop = log.scrollHeight;
}

const gameOf = (id) => games.find((g) => g.id === id);

// Deux listes qui ne se mélangent pas : les parties du serveur (hub ou serveur dédié d'un jeu) et celles entre joueurs
function renderRooms() {
  const server = [];
  const peer = [];
  for (const [game, list] of Object.entries(rooms)) {
    const g = gameOf(game);
    for (const r of list) {
      const waiting = r.status === 'waiting';
      const full = r.players >= r.max;
      // une partie du serveur se rejoint à tout moment (en cours : on regarde, on joue à la course suivante)
      const joinable = r.url ? !full : waiting && !full;
      (r.url && !r.dedicated ? peer : server).push(el('li', {},
        el('span', { className: 'ico', textContent: icons[game] ?? '🎮', title: g?.title ?? game }),
        el('span', { className: 't' },
          el('strong', { textContent: `${r.name}` }),
          el('small', { textContent: `${g?.title ?? game} · ${r.names.join(', ')} (${r.players}/${r.max})` })),
        joinable
          ? el('a', { href: r.url ?? `/jeux/${game}/?room=${encodeURIComponent(r.id)}`, textContent: 'Rejoindre' })
          : el('span', { className: `badge ${waiting ? 'wait' : 'run'}`, textContent: waiting ? 'Complète' : 'En cours' })));
    }
  }
  $('rooms').replaceChildren(...server);
  $('rooms-empty').hidden = server.length > 0;
  $('rooms-peer').replaceChildren(...peer);
  $('peer-empty').hidden = peer.length > 0;
}

// Créer une partie sur le serveur : pour les jeux qui l'offrent (serverModes), le serveur du jeu fait tourner la partie
function renderServerForm() {
  const hosted = games.filter((g) => g.serverModes?.length);
  $('server-form').hidden = !hosted.length;
  if (!hosted.length) return;
  const gameSel = $('sf-game');
  const modeSel = $('sf-mode');
  gameSel.replaceChildren(...hosted.map((g) => el('option', { value: g.id, textContent: `${icons[g.id] ?? '🎮'} ${g.title}` })));
  const paint = () => modeSel.replaceChildren(...hosted.find((g) => g.id === gameSel.value).serverModes.map((x) => el('option', { value: x.id, textContent: x.label })));
  gameSel.onchange = paint;
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

function renderNewGames() {
  // jeux dont le salon est dans le serveur de jeux (Bulles, Asteroid Run…) : on ouvre le jeu qui crée la salle
  $('new-hub').replaceChildren(...games.filter((g) => !g.external).map((g) =>
    el('a', { href: `/jeux/${g.id}/?create=1` }, el('span', { textContent: icons[g.id] ?? '🎮' }), `${g.title} (${g.min} à ${g.max} joueurs)`)));
  $('new-games').replaceChildren(...games.filter((g) => g.external && g.createUrl !== null).map((g) =>
    el('a', { href: g.createUrl ?? `/jeux/${g.id}/?create=1` }, el('span', { textContent: icons[g.id] ?? '🎮' }), `${g.title} (${g.min} à ${g.max} joueurs)`)));
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
