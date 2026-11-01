// Meilleurs scores, partagés par tous les jeux du site.
// Stockés en localStorage sur le téléphone : rien ne part sur le serveur (aucune donnée sur les enfants).
//   import { saveScore } from '/scores.js';
//   saveScore('bulles', 42, partie);  // partie : identifiant de la partie en cours (mise à jour, pas de doublon)
const MAX = 10;
const key = (gameId) => `scores.${gameId}`;

function read(gameId) {
  try {
    const list = JSON.parse(localStorage.getItem(key(gameId)) || '[]');
    return Array.isArray(list) ? list.filter((s) => Number.isFinite(s?.score)) : [];
  } catch {
    return [];
  }
}

export function topScores(gameId, n = MAX) {
  return read(gameId).slice(0, n);
}

export function newRun() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// Enregistre (ou met à jour) le score d'une partie ; ne garde que les MAX meilleurs.
export function saveScore(gameId, score, run = newRun()) {
  if (!Number.isFinite(score) || score <= 0) return;
  const list = read(gameId).filter((s) => s.run !== run);
  list.push({ score, date: Date.now(), run });
  list.sort((a, b) => b.score - a.score || a.date - b.date);
  try {
    localStorage.setItem(key(gameId), JSON.stringify(list.slice(0, MAX)));
  } catch { /* stockage plein ou interdit (navigation privée) : tant pis */ }
}
