// Les jeux connus et leurs classements. Ajouter un jeu ou un classement = une entrée ici + une clé dans GAMEBOARD_KEYS.
//   order 'desc' : le plus grand gagne (points) ; 'asc' : le plus petit gagne (temps en ms)
//   min / max    : bornes plausibles (hors bornes = refusé, c'est un garde-fou, pas de l'anti-triche complète)
//   open         : le navigateur du joueur peut envoyer le score (jeu sans serveur, ou score calculé dans le navigateur) ;
//                  moins fiable qu'une clé d'API (le score vient du client), donc réservé aux classements qui n'ont pas d'autre option
const CIRCUITS = [
  { id: 'newyork', name: 'New York Futuriste', emoji: '🌃' },
  { id: 'paris', name: "Paris à l'ancienne", emoji: '🥖' },
  { id: 'tokyo', name: 'Tokyo Autoroutes High-Tech', emoji: '🗼' },
  { id: 'sydney', name: 'Sydney, le port', emoji: '🦘' },
  { id: 'farmcity', name: 'Farm City', emoji: '🚜' },
  { id: 'lavaland', name: 'Lava Land', emoji: '🌋' },
  { id: 'egypt', name: 'Égypte', emoji: '🐫' },
  { id: 'speedway', name: 'Super Speedway', emoji: '🏁' },
  { id: 'volcano', name: 'Volcano', emoji: '🔥', versions: [3] },
  { id: 'nautica', name: 'Nautica', emoji: '🐠', versions: [3] },
];

const raceBoards = CIRCUITS.flatMap((c) =>
  (c.versions || [1, 2, 3]).map((version) => ({
    id: `race:${c.id}@${version}`,
    group: 'race',
    circuit: c.id,
    version,
    title: c.name,
    emoji: c.emoji,
    open: true,
    order: 'asc',
    unit: 'ms',
    min: 5000,
    max: 10 * 60 * 1000,
  })),
);

export const GAMES = {
  'car_race': {
    title: 'Police vs voleurs',
    boards: [
      { id: 'police', title: 'Meilleurs flics', emoji: '🚓', order: 'desc', unit: 'points', min: 1, max: 500, open: true },
      { id: 'thieves', title: 'Meilleurs voleurs', emoji: '💰', order: 'desc', unit: 'points', min: 1, max: 500, open: true },
      ...raceBoards,
    ],
  },
  bulles: {
    title: 'Bulles',
    boards: [
      { id: 'bulles', title: 'Meilleurs éclateurs', emoji: '🫧', order: 'desc', unit: 'points', min: 1, max: 5000, open: true },
      { id: 'bulles_multi', title: 'Bulles à plusieurs', emoji: '👥', order: 'desc', unit: 'points', min: 1, max: 5000, open: false }, // scores envoyés par swordfish avec clé (gameboard-002)
    ],
  },
  asteroid_run: {
    title: 'Asteroid Run',
    boards: [
      { id: 'asteroid_run', title: 'Meilleurs pilotes', emoji: '🚀', order: 'desc', unit: 'points', min: 1, max: 100000, open: true },
      { id: 'asteroid_run_multi', title: 'Asteroid Run à plusieurs', emoji: '👥', order: 'desc', unit: 'points', min: 1, max: 100000, open: false }, // scores envoyés par swordfish avec clé (gameboard-002)
    ],
  },
  // space_hairness, space_run : à ajouter quand leurs classements (missions, circuits) seront décidés
};
