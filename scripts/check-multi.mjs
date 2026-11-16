// node scripts/check-multi.mjs [--games=<dossier des dépôts des jeux>] [--catalog=<games.json>]
// Contrôle de l'interface multijoueur de chaque jeu en réseau (gameboard-010). Code de sortie 1 s'il y a un problème.
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkAll } from '../src/check-multi.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, def) => (process.argv.find((a) => a.startsWith(`--${name}=`)) ?? '').slice(name.length + 3) || def;
const catalog = JSON.parse(readFileSync(resolve(arg('catalog', join(ROOT, 'games.json'))), 'utf8'));
const root = resolve(arg('games', join(ROOT, '..')));

const results = checkAll(catalog, root);
let bad = 0;
for (const r of results) {
  console.log(`${r.problems.length ? '✗' : '✓'} ${r.id}`);
  for (const p of r.problems) { console.log(`    - ${p}`); bad++; }
}
console.log(`${results.length} jeu(x) en réseau, ${bad} problème(s)`);
process.exit(bad ? 1 : 0);
