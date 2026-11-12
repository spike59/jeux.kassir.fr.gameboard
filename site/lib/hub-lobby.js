// Salon des jeux à plusieurs, prêt à l'emploi : un jeu l'importe et n'a plus qu'à gérer sa partie.
//   import { createLobby } from '/lib/hub-lobby.js';
//   const lobby = createLobby({ game: 'asteroid_run', title: 'Asteroid Run à plusieurs', onStart, onGame, onEnd, onRoom, onClose });
//   lobby.open();                  // fenêtre : prénom, serveur, salles, chat, salle d'attente, résultats
//   lobby.open({ room: '3' });     // arrivée depuis le salon du site : rejoint la salle 3 (ou { create: true } pour en créer une)
//   lobby.send({ t: 'pop', b: 1 }) // un message du jeu vers le serveur (voir le module du jeu dans gameboard/src/hub/)
// Rappels : onStart(msg, room) quand la manche commence (la fenêtre se ferme), onGame(msg) pour chaque message du jeu (spawn…),
// onRoom(room) quand les joueurs changent pendant la partie, onEnd(scores, room) à la fin, onClose() quand on quitte le salon.
// Protocole et modules : apps/gameboard/src/hub/hub.js.
const NAME = /^[\p{L}\p{N}][\p{L}\p{N} '_-]{0,15}$/u; // mêmes règles que les classements
const NAME_KEY = 'kassir.player'; // prénom commun à tous les jeux du site

function el(tag, props = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'dataset') Object.assign(node.dataset, v); // en lecture seule : on remplit l'objet
    else if (/^aria[A-Z]/.test(k)) node.setAttribute(k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`), v); // ariaLabel -> aria-label (tous navigateurs)
    else node[k] = v;
  }
  node.append(...kids.filter((k) => k != null));
  return node;
}

export const savedName = () => { try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; } };
const saveName = (n) => { try { localStorage.setItem(NAME_KEY, n); } catch { /* navigation privée */ } };
const clean = (s) => s.normalize('NFC').trim().replace(/\s+/g, ' ');

export function createLobby({ game, title = 'Jouer à plusieurs', onStart, onGame, onEnd, onRoom, onClose, nameFallback = () => '' }) {
  if (!document.querySelector('link[data-hub-lobby]')) {
    document.head.append(el('link', { rel: 'stylesheet', href: new URL('hub-lobby.css?v=1', import.meta.url).href, dataset: { hubLobby: '' } }));
  }
  let ws = null;
  let me = null;
  let room = null;
  let mode = 'login'; // login | lobby | room | playing | result
  let intent = null;
  let pingTimer = 0;

  // --- la fenêtre ---
  const dlg = el('dialog', { className: 'hl' });
  const x = el('button', { type: 'button', className: 'hl-x', textContent: '✕', ariaLabel: 'Fermer' });
  const hint = el('p', { className: 'hl-hint', hidden: true });

  const nameInput = el('input', { maxLength: 16, autocomplete: 'off', placeholder: 'Prénom' });
  const loginForm = el('form', {}, el('label', {}, 'Ton prénom', nameInput), hint, el('div', { className: 'hl-buttons' }, el('button', { type: 'submit', className: 'hl-primary', textContent: 'Entrer dans le salon' })));
  const login = el('section', {}, loginForm);

  const serverLine = el('p', { className: 'hl-server' });
  const roomsList = el('ul', { className: 'hl-list' });
  const lobbyHint = el('p', { className: 'hl-hint', hidden: true });
  const createBtn = el('button', { type: 'button', className: 'hl-primary', textContent: 'Créer une salle' });
  const chatLog = el('div', { className: 'hl-chat', ariaLive: 'polite' });
  const chatInput = el('input', { maxLength: 120, autocomplete: 'off', placeholder: 'Écrire un message' });
  const chatForm = el('form', { className: 'hl-chat-form' }, chatInput, el('button', { type: 'submit', textContent: 'Envoyer' }));
  const lobby = el('section', { hidden: true }, serverLine, el('h3', { textContent: 'Salles ouvertes' }), roomsList, lobbyHint, el('div', { className: 'hl-buttons' }, createBtn), el('h3', { textContent: 'Discussion' }), chatLog, chatForm);

  const roomTitle = el('h3');
  const playersList = el('ul', { className: 'hl-list' });
  const wait = el('p', { className: 'hl-hint ok' });
  const roomHint = el('p', { className: 'hl-hint', hidden: true });
  const startBtn = el('button', { type: 'button', className: 'hl-primary', textContent: 'Lancer la partie' });
  const leaveBtn = el('button', { type: 'button', textContent: 'Quitter la salle' });
  const roomPanel = el('section', { hidden: true }, roomTitle, playersList, wait, roomHint, el('div', { className: 'hl-buttons' }, startBtn, leaveBtn));

  const scoresList = el('ol', { className: 'hl-list' });
  const againBtn = el('button', { type: 'button', className: 'hl-primary', textContent: 'Rejouer' });
  const resultLeave = el('button', { type: 'button', textContent: 'Quitter' });
  const result = el('section', { hidden: true }, el('h3', { textContent: '🏁 Résultats' }), scoresList, el('div', { className: 'hl-buttons' }, againBtn, resultLeave));

  const panels = { login, lobby, room: roomPanel, result };
  dlg.append(el('h2', { textContent: `👥 ${title}` }), x, login, lobby, roomPanel, result);
  document.body.append(dlg);

  const say = (node, text) => { node.textContent = text; node.hidden = !text; };
  function show(name) {
    mode = name;
    for (const [k, p] of Object.entries(panels)) p.hidden = k !== name;
  }
  const send = (m) => { if (ws?.readyState === 1) ws.send(JSON.stringify(m)); };
  const dot = (c) => { const d = el('i', { className: 'hl-dot' }); d.style.setProperty('--c', c); return d; };

  // --- connexion ---
  function connect(name) {
    const url = new URL('/jeux/swordfish/hub', location.href);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    say(hint, 'Connexion…');
    ws = new WebSocket(url);
    ws.onopen = () => send({ t: 'hello', name });
    ws.onmessage = (e) => { try { onMessage(JSON.parse(e.data)); } catch { /* message illisible : ignoré */ } };
    ws.onerror = () => say(hint, 'Impossible de joindre le serveur.');
    ws.onclose = () => {
      clearInterval(pingTimer);
      if (mode !== 'login') {
        say(hint, 'Connexion perdue.');
        room = null;
        show('login');
        if (!dlg.open) dlg.showModal();
        onClose?.();
      }
      ws = null;
    };
  }

  function onMessage(m) {
    switch (m.t) {
      case 'welcome':
        me = { id: m.id, name: m.name };
        serverLine.replaceChildren('🖥️ ', el('b', { textContent: m.server.name }), ' · ping ', el('b', { id: 'hl-ping', textContent: '…' }));
        chatLog.replaceChildren();
        for (const line of m.history ?? []) chat(line);
        show('lobby');
        if (intent) { send(intent.room ? { t: 'join', room: intent.room } : { t: 'create', game }); intent = null; }
        send({ t: 'ping', n: Date.now() });
        pingTimer = setInterval(() => send({ t: 'ping', n: Date.now() }), 2000);
        break;
      case 'pong': { const p = dlg.querySelector('#hl-ping'); if (p) p.textContent = `${Math.max(1, Date.now() - m.n)} ms`; break; }
      case 'chat': chat(m); break;
      case 'rooms': if (m.game === game) renderRooms(m.rooms); break;
      case 'room': onRoomMsg(m.room); break;
      case 'start': mode = 'playing'; onStart?.(m, room); if (dlg.open) dlg.close(); break;
      case 'end': endGame(m.scores); break;
      case 'error': say(mode === 'login' ? hint : mode === 'room' ? roomHint : lobbyHint, m.text); break;
      default: onGame?.(m);
    }
  }

  function chat({ from, text }) {
    chatLog.append(el('p', {}, el('b', { textContent: `${from} : ` }), text));
    while (chatLog.childElementCount > 40) chatLog.firstChild.remove();
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  function renderRooms(list) {
    say(lobbyHint, '');
    roomsList.replaceChildren(...(list.length ? list.map((r) => {
      const btn = el('button', { type: 'button', textContent: 'Rejoindre', disabled: r.status !== 'waiting' || r.players >= r.max });
      btn.addEventListener('click', () => send({ t: 'join', room: r.id }));
      return el('li', {}, el('span', { textContent: `${r.name} · ${r.players}/${r.max}${r.status === 'waiting' ? '' : ' · en cours'}` }), btn);
    }) : [el('li', { className: 'hl-empty', textContent: 'Aucune salle : crée la tienne !' })]));
  }

  function onRoomMsg(r) {
    room = r;
    if (mode === 'playing') { onRoom?.(r); return; }
    if (r.status === 'finished') return; // les résultats arrivent avec « end »
    show('room');
    say(roomHint, '');
    roomTitle.textContent = r.name;
    playersList.replaceChildren(...r.players.map((p) => el('li', {}, dot(p.color), el('span', { textContent: p.name + (p.id === r.owner ? ' 👑' : '') + (p.id === me.id ? ' (toi)' : '') }))));
    const owner = r.owner === me.id;
    startBtn.hidden = !owner;
    startBtn.disabled = r.players.length < r.min;
    wait.textContent = owner ? (r.players.length < r.min ? `Il faut au moins ${r.min} joueurs.` : 'Tout le monde est prêt ? Lance la partie !') : 'En attente du lancement par le chef de la salle…';
    onRoom?.(r);
  }

  function endGame(scores) {
    mode = 'result';
    scoresList.replaceChildren(...scores.map((s, i) => el('li', {}, el('b', { textContent: `${i + 1}.` }), dot(s.color), el('span', { textContent: `${s.name}${s.id === me.id ? ' (toi)' : ''}${s.out ? ' 💥' : ''}` }), el('strong', { textContent: String(s.score) }))));
    againBtn.hidden = room?.owner !== me.id;
    show('result');
    onEnd?.(scores, room);
    if (!dlg.open) dlg.showModal();
  }

  async function leave() {
    clearInterval(pingTimer);
    if (ws) { send({ t: 'leave' }); ws.onclose = null; ws.close(); ws = null; }
    room = null;
    mode = 'login';
    onClose?.();
  }

  // --- boutons ---
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = clean(nameInput.value);
    if (!NAME.test(name)) return say(hint, "Un prénom de 1 à 16 lettres ou chiffres, s'il te plaît.");
    saveName(name);
    connect(name);
  });
  createBtn.addEventListener('click', () => send({ t: 'create', game }));
  startBtn.addEventListener('click', () => send({ t: 'start' }));
  leaveBtn.addEventListener('click', () => { send({ t: 'leave' }); room = null; show('lobby'); send({ t: 'rooms', game }); });
  againBtn.addEventListener('click', () => send({ t: 'again' }));
  resultLeave.addEventListener('click', async () => { send({ t: 'leave' }); await leave(); dlg.close(); });
  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (chatInput.value.trim()) send({ t: 'chat', text: chatInput.value });
    chatInput.value = '';
  });
  x.addEventListener('click', () => dlg.close());
  dlg.addEventListener('close', () => { if (mode !== 'playing') leave(); }); // fermer la fenêtre hors partie = quitter le salon

  return {
    open(opts = null) {
      intent = opts;
      nameInput.value = savedName() || nameFallback();
      say(hint, '');
      show('login');
      if (!dlg.open) dlg.showModal();
      const known = clean(nameInput.value);
      if (intent && NAME.test(known)) { saveName(known); connect(known); } else nameInput.focus();
    },
    send,
    leave,
    get me() { return me; },
    get room() { return room; },
    get playing() { return mode === 'playing'; },
    // retour à la fenêtre (ex. bouton Pause pendant la partie) : affiche l'état sans quitter
    reopen() { if (!dlg.open) dlg.showModal(); },
  };
}
