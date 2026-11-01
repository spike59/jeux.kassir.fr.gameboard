// gameboard : le portail jeux.kassir.fr (menu 3D + jeux statiques) et l'API des meilleurs scores, un seul processus, un seul port.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseKeys } from './app.js';
import { createPortal } from './portal.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const PUBLIC_HOST = process.env.PUBLIC_HOST || 'jeux.kassir.fr';
const DATA_DIR = process.env.DATA_DIR || join(ROOT, 'data');
// menu 3D construit (absent en dev local : on sert alors le site seul)
const MENU_DIR = process.env.MENU_DIR || '';
// icône, scores.js, jeux/ (jeux statiques déposés par le déploiement)
const PUBLIC_DIR = process.env.PUBLIC_DIR || join(ROOT, 'site');

// derrière nginx-proxy (réseau Docker) : adresses privées ; pour un essai local : TRUST_PROXY=loopback
const TRUST_PROXY = process.env.TRUST_PROXY || 'uniquelocal';
const CATALOG = process.env.CATALOG || join(ROOT, 'games.json');

const keys = parseKeys(process.env.GAMEBOARD_KEYS);
const portal = createPortal({ publicHost: PUBLIC_HOST, menuDir: MENU_DIR, publicDir: PUBLIC_DIR, catalog: CATALOG, trustProxy: TRUST_PROXY, apiOptions: { keys, dataDir: DATA_DIR } });

portal.listen(PORT, HOST, () => console.log(`gameboard sur http://${HOST}:${PORT} (https://${PUBLIC_HOST}) — ${keys.size} jeu(x) avec clé`));
