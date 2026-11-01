import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp, parseKeys } from './app.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const DATA_DIR = process.env.DATA_DIR || join(ROOT, 'data');

const keys = parseKeys(process.env.GAMEBOARD_KEYS);
if (!keys.size) console.warn('GAMEBOARD_KEYS est vide : aucun jeu ne pourra envoyer de score (lecture seule)');

createApp({ keys, dataDir: DATA_DIR }).listen(PORT, HOST, () => {
  console.log(`gameboard sur http://${HOST}:${PORT} (${keys.size} jeu(x) autorisé(s))`);
});
