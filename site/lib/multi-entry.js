// Entrée « Multijoueur » du menu d'un jeu : un bouton qui mène au salon du portail (…/multi/?game=<jeu>) et qui affiche l'état réel
// des parties (lu sur /api/v1/multi, lui-même lu sur swordfish). Le jeu n'a rien d'autre à faire.
//   import { mountMultiEntry } from '/lib/multi-entry.js';
//   mountMultiEntry(document.getElementById('menu'), { game: 'bulles' });          // ajoute le bouton
//   mountMultiEntry(unBoutonExistant, { game: 'bulles', existing: true });          // enrichit un bouton déjà dans le menu
export function label(state, game) {
  const g = state?.games?.find((x) => x.id === game);
  if (!state || !g) return { text: '👥 Multijoueur', status: 'inconnu' };
  if (!g.online) return { text: '👥 Multijoueur · serveur arrêté', status: 'hors ligne' };
  if (!g.rooms) return { text: '👥 Multijoueur · aucune partie', status: 'en ligne' };
  const p = (n, un, plusieurs) => `${n} ${n > 1 ? plusieurs : un}`;
  return { text: `👥 Multijoueur · ${p(g.rooms, 'partie', 'parties')}, ${p(g.players, 'joueur', 'joueurs')}`, status: g.joinable ? 'à rejoindre' : 'en cours' };
}

export function mountMultiEntry(where, { game, existing = false, everyMs = 5000, fetchImpl = fetch } = {}) {
  const a = existing ? where : Object.assign(document.createElement('a'), { className: 'multi-entry' });
  a.href = `/multi/?game=${encodeURIComponent(game)}`;
  a.dataset.multiGame = game;
  const paint = (state) => { const l = label(state, game); a.textContent = l.text; a.dataset.status = l.status; };
  paint(null);
  if (!existing) where.append(a);
  const refresh = () => fetchImpl('/api/v1/multi', { cache: 'no-store' }).then((r) => r.json()).then(paint).catch(() => paint(null));
  refresh();
  const timer = setInterval(() => (document.hidden ? null : refresh()), everyMs);
  return { element: a, refresh, stop: () => clearInterval(timer) };
}
