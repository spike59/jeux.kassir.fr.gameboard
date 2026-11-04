// gameboard : le portail jeux.kassir.fr (menu 3D + jeux statiques) et l'API des meilleurs scores, un seul processus, un seul port.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseKeys } from './app.js';
import { createPortal } from './portal.js';
import { createHub } from './hub/hub.js';
import { bulles } from './hub/bulles.js';
import { asteroid_run } from './hub/asteroid_run.js';

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
// serveur01 : le salon des jeux à plusieurs (chat, salles, parties) ; un module par jeu
// Jeux dont le serveur de parties est dans un autre conteneur : le hub lit leurs salles (adresse interne, réseau Docker)
const external = [];
if (process.env.HUB_CAR_RACE_INFO) {
  external.push({
    id: 'car_race', title: 'Police vs voleurs', min: 2, max: 8, infoUrl: process.env.HUB_CAR_RACE_INFO,
    joinUrl: (room) => `/jeux/car_race/?mobile&room=${room}`, createUrl: '/jeux/car_race/?mobile&create=1',
  });
}
const hub = createHub({ external, modules: [bulles, asteroid_run], publicOrigin: `https://${PUBLIC_HOST}`, serverId: 'serveur01', serverName: 'Serveur 01' });
const portal = createPortal({ hub, publicHost: PUBLIC_HOST, menuDir: MENU_DIR, publicDir: PUBLIC_DIR, gamesDir: GAMES_DIR, catalog: CATALOG, releases: RELEASES, trustProxy: TRUST_PROXY, apiOptions: { keys, dataDir: DATA_DIR } });

const server = portal.listen(PORT, HOST, () => console.log(`gameboard sur http://${HOST}:${PORT} (https://${PUBLIC_HOST}) — ${keys.size} jeu(x) avec clé`));
hub.attach(server);
