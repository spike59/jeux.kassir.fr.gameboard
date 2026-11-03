// Page d'accueil de jeux.kassir.fr : les jeux de /games.json en trois vues.
//   🏆 Scores     tableau des scores (HTML) devant le décor 3D qui tourne doucement
//   🎠 Carrousel  les vignettes tournent tout autour de nous (scene.js)
//   🔲 Vignettes  les mêmes cartes rangées en mur devant nous
// Ajouter un jeu = une ligne dans games.json du site (pas dans ce dépôt) ; "scores": true pour le tableau des scores.
// Sans WebGL, la liste des liens #games s'affiche en vignettes classiques : on peut toujours jouer.
import { createMenuScene } from './scene.js';
import { renderBoards, gameLink, isReady, el } from './boards.js';
import { topScores } from './scores.js';

const VIEWS = ['scores', 'carrousel', 'vignettes'];
const SCENE_MODE = { scores: 'backdrop', carrousel: 'ring', vignettes: 'grid' };
const $ = (id) => document.getElementById(id);

let games = [];
let online = null; // réponse de /api/v1/boards, null = pas encore chargée, false = indisponible
let menu = null;

const say = (text) => { $('live').textContent = text; };

// --- décor 3D (ou repli en vignettes HTML si le téléphone ne sait pas faire) ---
try {
  menu = createMenuScene($('scene'), {
    onLaunch: (game) => location.assign(game.url),
    onFocus: (game) => {
      say(`${game.title}${isReady(game) ? '' : ', bientôt'}`);
      document.querySelectorAll('#games a, #games div').forEach((node) => node.classList.toggle('focus', node.dataset.id === game.id));
    },
    onSoon: (game) => say(`${game.title} : bientôt disponible !`),
    onViewCycle: (dir) => {
      const i = VIEWS.indexOf(currentView());
      location.hash = VIEWS[(i + dir + VIEWS.length) % VIEWS.length];
    },
  });
} catch (err) {
  console.warn('3D indisponible, vignettes simples', err);
  document.documentElement.classList.add('no3d');
}

// Zones de l'écran occupées par le titre et les barres : la 3D se place entre les deux
function measureInsets() {
  if (!menu) return;
  const h = window.innerHeight;
  let top = 0;
  let bottom = 0;
  for (const node of document.querySelectorAll('.hero, .views, .view:not([hidden]) .hint')) {
    const r = node.getBoundingClientRect();
    if (!r.height) continue;
    if (r.top + r.height / 2 < h / 2) top = Math.max(top, r.bottom);
    else bottom = Math.max(bottom, h - r.top);
  }
  menu.setInsets({ top: (top + 8) / h, bottom: (bottom + 8) / h });
}
window.addEventListener('resize', measureInsets);

// --- données ---
function withBest(list) {
  // meilleur score enregistré sur ce téléphone, affiché sur la vignette (pas pour les jeux à classement en ligne)
  return list.map((g) => ({ ...g, best: g.scores && !g.online ? topScores(g.id, 1)[0]?.score : undefined }));
}

function renderLinks() {
  $('games').replaceChildren(...games.map((game, i) => {
    const li = el('li');
    const link = gameLink(game, 'tile');
    link.dataset.id = game.id;
    // au clavier (Tab), la carte 3D suit le lien qui a le focus
    link.tabIndex = 0;
    link.addEventListener('focus', () => menu?.focusGame(i));
    li.append(link);
    return li;
  }));
}

function renderAll() {
  renderBoards($('boards'), games, online);
  renderLinks();
  menu?.setGames(withBest(games));
}

async function loadGames() {
  try {
    games = await (await fetch('/games.json', { cache: 'no-store' })).json();
    renderAll();
  } catch {
    for (const id of ['boards', 'games']) $(id).replaceChildren(el('p', 'note', 'Impossible de charger les jeux. Réessaie plus tard.'));
  }
}

async function loadOnline() {
  try {
    const res = await fetch('/api/v1/boards', { cache: 'no-store' });
    if (!res.ok) throw new Error(res.status);
    online = await res.json();
  } catch {
    online = false;
  }
  if (games.length) renderBoards($('boards'), games, online);
}

// --- choix de la vue : #scores, #carrousel, #vignettes (mémorisé sur le téléphone) ---
function currentView() {
  const fromHash = location.hash.slice(1);
  if (VIEWS.includes(fromHash)) return fromHash;
  try {
    const saved = localStorage.getItem('view');
    if (VIEWS.includes(saved)) return saved;
  } catch { /* stockage indisponible */ }
  return 'carrousel';
}

function showView() {
  const view = currentView();
  for (const v of VIEWS) $(`view-${v}`).hidden = v !== view;
  document.body.dataset.view = view;
  document.querySelectorAll('.views a').forEach((a) => {
    if (a.dataset.view === view) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  try { localStorage.setItem('view', view); } catch { /* stockage indisponible */ }
  menu?.setMode(SCENE_MODE[view]);
  measureInsets();
}
window.addEventListener('hashchange', showView);

// --- clavier : flèches pour tourner / se déplacer, Entrée pour jouer (pas sur les scores : les flèches y font défiler) ---
window.addEventListener('keydown', (e) => {
  if (!menu || currentView() === 'scores' || e.altKey || e.ctrlKey || e.metaKey) return;
  if (e.target.closest?.('a, button') && !e.target.closest('#games') && (e.key === 'Enter' || e.key === ' ')) return;
  const keys = {
    ArrowLeft: () => menu.turn(-1),
    ArrowRight: () => menu.turn(1),
    ArrowUp: () => menu.moveGrid(-1),
    ArrowDown: () => menu.moveGrid(1),
    Enter: () => menu.launch(),
    ' ': () => menu.launch(),
  };
  if (!keys[e.key]) return;
  e.preventDefault();
  keys[e.key]();
});
document.querySelector('.turn.prev').addEventListener('click', () => menu?.turn(-1));
document.querySelector('.turn.next').addEventListener('click', () => menu?.turn(1));

// retour d'un jeu (page restaurée depuis le cache du navigateur) ou score enregistré dans un autre onglet
window.addEventListener('pageshow', (e) => {
  if (!e.persisted) return;
  menu?.reset();
  if (games.length) { renderAll(); loadOnline(); }
});
window.addEventListener('storage', (e) => { if (e.key?.startsWith('scores.') && games.length) renderAll(); });

// --- installation sur l'écran d'accueil (Android/Chrome) + mode hors ligne ---
let installPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt = e;
  $('install').hidden = false;
});
$('install').addEventListener('click', async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  $('install').hidden = true;
});

// --- plein écran : bouton + premier toucher sur mobile (le navigateur l'exige pour un geste de l'utilisateur) ---
// Le plein écran s'arrête quand on change de page : chaque jeu le redemande à son premier toucher.
// Pour garder le plein écran partout, installer le site sur l'écran d'accueil (manifeste « fullscreen »).
const fsRoot = document.documentElement;
const fsRequest = fsRoot.requestFullscreen || fsRoot.webkitRequestFullscreen;
const inFullscreen = () => document.fullscreenElement || document.webkitFullscreenElement;
const enterFullscreen = () => {
  if (!fsRequest || inFullscreen()) return;
  Promise.resolve(fsRequest.call(fsRoot)).then(() => screen.orientation?.lock?.('landscape')).catch(() => {});
};
if (fsRequest) {
  $('fullscreen').hidden = false;
  $('fullscreen').addEventListener('click', () => {
    if (inFullscreen()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else enterFullscreen();
  });
  if (matchMedia('(pointer: coarse)').matches) window.addEventListener('pointerdown', enterFullscreen, { once: true });
}

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => { /* pas de hors-ligne, pas grave */ });
}

// --- carte Multijoueur : combien de jeux, combien de joueurs en ligne (se met à jour toute seule) ---
async function loadMulti() {
  try {
    const { servers } = await (await fetch('/api/v1/realm', { cache: 'no-store' })).json();
    const games = new Set(servers.flatMap((s) => s.games.map((g) => g.id))).size;
    const players = servers.reduce((n, s) => n + s.players, 0);
    const rooms = servers.reduce((n, s) => n + s.rooms, 0);
    $('multi-stats').textContent = `${games} jeu${games > 1 ? 'x' : ''} · ${players} joueur${players > 1 ? 's' : ''}${rooms ? ` · ${rooms} partie${rooms > 1 ? 's' : ''}` : ''}`;
  } catch {
    $('multi-stats').textContent = 'Jouer avec les autres';
  }
}
loadMulti();
setInterval(() => { if (document.visibilityState === 'visible') loadMulti(); }, 15000);

showView();
loadGames();
loadOnline();
