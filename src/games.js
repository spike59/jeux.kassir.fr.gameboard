// Les jeux connus et leurs classements. Ajouter un jeu ou un classement = une entrée ici + une clé dans GAMEBOARD_KEYS.
//   order 'desc' : le plus grand gagne (points) ; 'asc' : le plus petit gagne (temps en ms)
//   min / max    : bornes plausibles (hors bornes = refusé, c'est un garde-fou, pas de l'anti-triche complète)
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
    title: `${c.name} (v${version})`,
    emoji: c.emoji,
    order: 'asc',
    unit: 'ms',
    min: 5000,
    max: 10 * 60 * 1000,
  })),
);

export const GAMES = {
  'police-voleurs': {
    title: 'Police vs voleurs',
    boards: [
      { id: 'police', title: 'Meilleurs flics', emoji: '🚓', order: 'desc', unit: 'points', min: 1, max: 500 },
      { id: 'thieves', title: 'Meilleurs voleurs', emoji: '💰', order: 'desc', unit: 'points', min: 1, max: 500 },
      ...raceBoards,
    ],
  },
  // vulpine, space-run : à ajouter quand leurs classements (missions, circuits) seront décidés
};
