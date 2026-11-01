// Stockage : un fichier JSON { jeu: { classement: [ { player, value, date } ] } }, écriture atomique, une à la fois.
// Un joueur n'a qu'une ligne par classement : son meilleur résultat.
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const KEEP = 100; // lignes gardées par classement

export function createStore(dataDir) {
  const file = join(dataDir, 'gameboard.json');
  let data = null;
  let writing = Promise.resolve();

  async function load() {
    if (data) return data;
    try {
      data = JSON.parse(await readFile(file, 'utf8'));
    } catch (err) {
      if (err.code !== 'ENOENT') console.error('gameboard.json illisible, on repart de zéro :', err.message);
      data = {};
    }
    return data;
  }

  function save() {
    writing = writing.then(async () => {
      await mkdir(dataDir, { recursive: true });
      await writeFile(`${file}.tmp`, JSON.stringify(data));
      await rename(`${file}.tmp`, file);
    }).catch((err) => console.error('gameboard.json non enregistré :', err.message));
    return writing;
  }

  const better = (order, a, b) => (order === 'asc' ? a < b : a > b);
  const sorter = (order) => (a, b) => (order === 'asc' ? a.value - b.value : b.value - a.value) || a.date - b.date;

  return {
    async rows(game, boardId) {
      return (await load())[game]?.[boardId] || [];
    },
    // Retourne 'top' (nouveau n°1), 'best' (nouveau record personnel), 'kept' (pas meilleur que le sien)
    async submit(game, board, player, value, now = Date.now()) {
      const all = await load();
      const rows = ((all[game] ??= {})[board.id] ??= []);
      const topBefore = rows[0] && { player: rows[0].player, value: rows[0].value }; // copie : la ligne peut être modifiée plus bas
      const mine = rows.find((r) => r.player === player);
      let result = 'best';
      if (mine) {
        if (!better(board.order, value, mine.value)) return 'kept';
        mine.value = value;
        mine.date = now;
      } else {
        rows.push({ player, value, date: now });
      }
      rows.sort(sorter(board.order));
      rows.length = Math.min(rows.length, KEEP);
      if (rows[0].player === player && (!topBefore || topBefore.player !== player || better(board.order, value, topBefore.value))) result = 'top';
      await save();
      return result;
    },
  };
}
