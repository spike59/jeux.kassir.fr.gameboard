// Contrôle de l'interface multijoueur des jeux en réseau (chantier interface-multijoueur, gameboard-010).
// Pour chaque jeu marqué `multi` dans le catalogue, vérifie dans son dépôt :
//   - game.json : des modes (dont un mode en réseau) et un serveur déclarés ;
//   - sa page d'accueil : elle charge /lib/multi-entry.js et monte l'entrée « Multijoueur » de CE jeu (mountMultiEntry(…, { game: '<id>' })).
// Rend la liste des problèmes (vide = conforme). Lecture seule.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const PAGES = ['index.html', 'public/index.html', 'ui/index.html', 'dist/index.html'];
const SCRIPT_DIRS = ['', 'ui', 'src', 'public', 'js'];

const read = (p) => { try { return readFileSync(p, 'utf8'); } catch { return null; } };

// Tout le code que la page de menu charge : la page elle-même et ses scripts locaux (un niveau suffit pour retrouver l'appel).
function menuSources(dir) {
  const pageFile = PAGES.map((p) => join(dir, p)).find((p) => existsSync(p));
  if (!pageFile) return null;
  const html = read(pageFile) ?? '';
  const out = [html];
  for (const m of html.matchAll(/<script[^>]*\bsrc="([^"?#]+)[^"]*"/g)) {
    const src = m[1];
    if (/^https?:|^\/\//.test(src)) continue;
    const rel = src.replace(/^\/+/, '');
    for (const base of [join(pageFile, '..'), dir, ...SCRIPT_DIRS.map((d) => join(dir, d))]) {
      const t = read(join(base, rel));
      if (t != null) { out.push(t); break; }
    }
  }
  return out.join('\n');
}

export function checkGame(id, dir) {
  const problems = [];
  const manifest = read(join(dir, 'game.json'));
  if (manifest == null) problems.push('game.json absent');
  else {
    let g = null;
    try { g = JSON.parse(manifest); } catch { problems.push('game.json illisible'); }
    if (g) {
      if (!Array.isArray(g.modes) || !g.modes.length) problems.push('game.json : « modes » manquant (chantier mise-a-jour-des-cards)');
      else if (!g.modes.some((m) => /^online|^p2p|^lan/.test(m))) problems.push('game.json : aucun mode en réseau dans « modes »');
      if (!g.server) problems.push('game.json : « server » manquant');
    }
  }
  const code = menuSources(dir);
  if (code == null) problems.push('page d\'accueil introuvable (index.html)');
  else {
    if (!/lib\/multi-entry\.js/.test(code)) problems.push('la page ne charge pas /lib/multi-entry.js');
    const mounts = [...code.matchAll(/mountMultiEntry\s*\([^;]{0,300}?game\s*:\s*['"]([\w-]+)['"]/g)].map((m) => m[1]);
    if (!mounts.length) problems.push('l\'entrée « Multijoueur » n\'est pas montée (mountMultiEntry)');
    else if (!mounts.includes(id)) problems.push(`l'entrée « Multijoueur » est montée pour « ${mounts.join(', ')} » et non pour « ${id} »`);
  }
  return problems;
}

// catalog : games.json ; gamesRoot : le dossier qui contient les dépôts des jeux (un dossier par identifiant).
export function checkAll(catalog, gamesRoot) {
  return catalog.filter((g) => g.multi && g.ready).map((g) => {
    const dir = join(gamesRoot, g.id);
    return { id: g.id, dir, problems: existsSync(dir) ? checkGame(g.id, dir) : ['dossier du jeu introuvable'] };
  });
}
