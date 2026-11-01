// Lecture des meilleurs scores enregistrés sur ce téléphone par les jeux (module /scores.js du site, localStorage).
// Même format que /scores.js : clé « scores.<id du jeu> », liste [{ score, date, run }] triée du meilleur au moins bon.
// Le menu ne fait que lire : ce sont les jeux qui écrivent.
export function topScores(gameId, n = 10) {
  try {
    const list = JSON.parse(localStorage.getItem(`scores.${gameId}`) || '[]');
    return Array.isArray(list) ? list.filter((s) => Number.isFinite(s?.score)).slice(0, n) : [];
  } catch {
    return [];
  }
}
