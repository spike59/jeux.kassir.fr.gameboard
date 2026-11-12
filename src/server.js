// gameboard : le portail jeux.kassir.fr (menu 3D + jeux statiques) et l'API des meilleurs scores, un seul processus, un seul port.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseKeys } from './app.js';
import { createPortal } from './portal.js';
import { createRemoteHub } from './remote-hub.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const PUBLIC_HOST = process.env.PUBLIC_HOST || 'jeux.kassir.fr';
const DATA_DIR = process.env.DATA_DIR || join(ROOT, 'data');
// menu 3D construit (absent en dev local : on sert alors le site seul)
const MENU_DIR = process.env.MENU_DIR || '';
// icône, scores.js
const PUBLIC_DIR = process.env.PUBLIC_DIR || join(ROOT, 'site');
// un dossier par jeu (stack : web/jeux.kassir.fr/games) ; /jeux/<id>/ sert games/<id>/public/ (jeux statiques)
const GAMES_DIR = process.env.GAMES_DIR || join(ROOT, 'games');

// derrière nginx-proxy (réseau Docker) : adresses privées ; pour un essai local : TRUST_PROXY=loopback
const TRUST_PROXY = process.env.TRUST_PROXY || 'uniquelocal';
const CATALOG = process.env.CATALOG || join(ROOT, 'games.json');
// notes de version rassemblées par devops/collect-releases.mjs (page /notes/)
const RELEASES = process.env.RELEASES || join(ROOT, 'releases.json');

const keys = parseKeys(process.env.GAMEBOARD_KEYS);
// Le hub (salon, salles, jeux à plusieurs) vit dans swordfish : ici seulement la lecture du realm et du parc (chantier multijoueur-normalise)
const hub = createRemoteHub({ baseUrl: process.env.SWORDFISH_URL ?? '' });
const portal = createPortal({ hub, publicHost: PUBLIC_HOST, menuDir: MENU_DIR, publicDir: PUBLIC_DIR, gamesDir: GAMES_DIR, catalog: CATALOG, releases: RELEASES, trustProxy: TRUST_PROXY, apiOptions: { keys, dataDir: DATA_DIR } });

const server = portal.listen(PORT, HOST, () => console.log(`gameboard sur http://${HOST}:${PORT} (https://${PUBLIC_HOST}) — ${keys.size} jeu(x) avec clé`));
