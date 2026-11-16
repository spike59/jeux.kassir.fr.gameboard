// Entrée « Multijoueur » du menu d'un jeu : un bouton qui mène au salon du portail (…/multi/?game=<jeu>) et qui affiche l'état réel des parties,
// EN DIRECT : le portail pousse chaque changement (/api/v1/multi/stream), rien n'est interrogé. Le jeu n'a rien d'autre à faire.
//   import { mountMultiEntry } from '/lib/multi-entry.js';
//   mountMultiEntry(document.getElementById('menu'), { game: 'bulles' });          // ajoute le bouton
//   mountMultiEntry(unBoutonExistant, { game: 'bulles', existing: true });          // enrichit un bouton déjà dans le menu
//   mountMultiEntry(unBouton, { game, existing: true, badge: true });               // garde le texte du bouton : seulement une pastille d'état et un titre
//   mountMultiEntry(el, { game, onState: (g, state) => … });                        // le jeu veut aussi l'état (parties, joueurs)

// Applique un événement du portail à l'état local { server, games: Map }. Rend le nouvel état ; un trou de `seq` demande un nouvel abonnement.
export function applyEvent(state, ev) {
  if (ev.type === 'snapshot') return { seq: ev.seq, server: ev.server, games: new Map(ev.games.map((g) => [g.id, g])) };
  if (!state || ev.seq !== state.seq + 1) return null; // état perdu : on se réabonne (le portail renvoie un snapshot)
  const next = { seq: ev.seq, server: state.server, games: new Map(state.games) };
  if (ev.type === 'game') next.games.set(ev.game.id, ev.game);
  else if (ev.type === 'server') next.server = ev.server;
  return next;
}

export function label(state, game) {
  const g = state?.games?.get?.(game) ?? state?.games?.find?.((x) => x.id === game);
  if (!g) return { text: '👥 Multijoueur', status: 'inconnu' };
  if (g.status === 'draining') return { text: '👥 Multijoueur · maintenance', status: 'maintenance' };
  if (!g.online) return { text: '👥 Multijoueur · serveur arrêté', status: 'hors ligne' };
  if (!g.rooms) return { text: '👥 Multijoueur · aucune partie', status: 'en ligne' };
  const p = (n, un, plusieurs) => `${n} ${n > 1 ? plusieurs : un}`;
  return { text: `👥 Multijoueur · ${p(g.rooms, 'partie', 'parties')}, ${p(g.players, 'joueur', 'joueurs')}`, status: g.joinable ? 'à rejoindre' : 'en cours' };
}

// Pastille d'état (vert : des parties à rejoindre, orange : en cours, grisé : arrêté ou en maintenance), ajoutée une seule fois à la page.
const BADGE_CSS = `[data-multi-game][data-status="à rejoindre"]::after, [data-multi-game][data-status="en cours"]::after { content: ""; display: inline-block; width: 0.6em; height: 0.6em; margin-left: 0.4em; border-radius: 50%; vertical-align: middle; background: #3ddc84; }
[data-multi-game][data-status="en cours"]::after { background: #ffb454; }
[data-multi-game][data-status="hors ligne"], [data-multi-game][data-status="maintenance"] { opacity: 0.6; }`;
function addBadgeStyle() {
  if (typeof document === 'undefined' || !document.head || document.querySelector?.('style[data-multi-entry]')) return;
  const s = document.createElement('style'); s.dataset.multiEntry = ''; s.textContent = BADGE_CSS; document.head.append(s);
}

export function mountMultiEntry(where, { game, existing = false, badge = false, onState = null, EventSourceImpl = globalThis.EventSource } = {}) {
  const a = existing ? where : Object.assign(document.createElement('a'), { className: 'multi-entry' });
  a.href = `/multi/?game=${encodeURIComponent(game)}`;
  a.dataset.multiGame = game;
  if (badge) addBadgeStyle();
  const paint = (state) => {
    const l = label(state, game);
    if (badge) a.title = l.text; else a.textContent = l.text; // pastille : le bouton garde son texte
    a.dataset.status = l.status;
    onState?.(state?.games?.get?.(game) ?? null, state, l);
  };
  paint(null);
  if (!existing) where.append(a);
  if (!EventSourceImpl) return { element: a, stop() {} };

  let state = null, es = null, stopped = false;
  const open = () => {
    es = new EventSourceImpl('/api/v1/multi/stream'); // se reconnecte tout seul ; le portail renvoie l'état complet à chaque connexion
    for (const type of ['snapshot', 'game', 'server']) {
      es.addEventListener(type, (e) => {
        let ev; try { ev = JSON.parse(e.data); } catch { return; }
        const next = applyEvent(ev.type === 'snapshot' ? null : state, ev);
        if (!next) { es.close(); if (!stopped) open(); return; } // un trou : on repart d'un état complet
        state = next; paint(state);
      });
    }
    es.onerror = () => { state = null; paint(null); }; // coupé : EventSource réessaie seul
  };
  open();
  return { element: a, stop() { stopped = true; es?.close(); } };
}
