// Tableau des scores (HTML, par-dessus le décor 3D).
// Jeux « online » : classements partagés venant du serveur (/api/v1/boards, gameboard), top 5 par classement, avec les noms.
// Les autres : top 10 enregistré sur ce téléphone (scores.js).
import { topScores } from './scores.js';

const MEDALS = ['🥇', '🥈', '🥉'];
const ONLINE_TOP = 5;
const dateFmt = new Intl.DateTimeFormat('fr', { day: 'numeric', month: 'short' });

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export const isReady = (game) => Boolean(game.ready && game.url);

// Un lien vers le jeu s'il est prêt, une carte grisée « bientôt » sinon
export function gameLink(game, className) {
  const node = el(isReady(game) ? 'a' : 'div', isReady(game) ? className : `${className} soon`);
  node.style.setProperty('--tile', game.color);
  if (isReady(game)) node.href = game.url;
  else node.setAttribute('aria-disabled', 'true');
  const icon = el('span', 'icon', game.icon);
  icon.setAttribute('aria-hidden', 'true');
  node.append(icon, el('span', 'label', game.title));
  return node;
}

function ranking(scores, emptyText) {
  if (!scores.length) return el('p', 'empty', emptyText);
  const list = el('ol', 'ranking');
  scores.forEach((s, i) => {
    const row = el('li');
    row.append(el('span', 'rank', MEDALS[i] ?? `${i + 1}`));
    if (s.name) row.append(el('span', 'who', s.name));
    row.append(
      el('span', 'points', s.score.toLocaleString('fr')),
      el('span', 'when', dateFmt.format(s.date)),
    );
    list.append(row);
  });
  return list;
}

// 83456 ms -> 1:23.45
const lapTime = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}.${String(Math.floor((ms % 1000) / 10)).padStart(2, '0')}`;

// Records de course : un par circuit (et par version, la plus récente d'abord), le meilleur tour.
// boards : les classements du groupe « race » ({ title, emoji, circuit, version, top })
function records(boards) {
  const byCircuit = new Map();
  for (const b of boards) if (b.top.length) byCircuit.set(b.circuit, [...(byCircuit.get(b.circuit) || []), b]);
  const list = [...byCircuit.values()].flatMap((versions) => versions.sort((a, b) => b.version - a.version)
    .map((b) => ({ name: b.title, emoji: b.emoji, version: b.version, best: { name: b.top[0].player, time: b.top[0].value } })));
  if (!list.length) return el('p', 'empty', 'Aucun record : à toi de jouer !');
  const ul = el('ul', 'ranking records');
  for (const r of list) {
    const row = el('li');
    const circuit = el('span', 'circuit', r.name);
    if (r.version !== 3) circuit.append(el('small', null, ` v${r.version}`));
    circuit.append(el('small', 'driver', r.best.name));
    row.append(el('span', 'rank', r.emoji), circuit, el('span', 'points', lapTime(r.best.time)));
    ul.append(row);
  }
  return ul;
}

// online : réponse de /api/v1/boards, null = pas encore chargée, false = indisponible
function board(game, online) {
  const card = el('article', game.online ? 'board online' : 'board');
  card.style.setProperty('--tile', game.color);
  card.append(gameLink(game, 'board-head'));

  if (game.online) {
    const parts = el('div', 'parts');
    for (const b of game.online) {
      const part = el('section', b.records ? 'part wide' : 'part');
      part.append(el('h3', null, `${b.icon} ${b.title}`));
      const boards = online?.[game.id]?.boards || {};
      if (online === null) part.append(el('p', 'empty', 'Chargement…'));
      else if (online === false) part.append(el('p', 'empty', 'Classement indisponible (hors ligne ?)'));
      else if (b.records) part.append(records(Object.values(boards).filter((x) => x.group === b.group)));
      else part.append(ranking((boards[b.board]?.top || []).slice(0, ONLINE_TOP).map((r) => ({ name: r.player, score: r.value, date: r.date })), 'Personne encore : à toi de jouer !'));
      parts.append(part);
    }
    card.append(parts);
  } else {
    card.append(ranking(topScores(game.id), isReady(game) ? 'Pas encore de score : à toi de jouer !' : 'Bientôt disponible'));
  }
  return card;
}

export function renderBoards(container, games, online) {
  container.replaceChildren(...games.filter((g) => g.scores).map((g) => board(g, online)));
}
