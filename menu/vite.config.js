import { defineConfig } from 'vite';
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

// Le menu n'est que la page d'accueil de gameboard : le catalogue (../games.json), l'icône et scores.js (../site)
// sont servis tels quels en développement ; on relaie vers le site en ligne l'API des scores et les jeux (jeux statiques
// et jeux qui ont leur propre conteneur).
const SITE_DIR = resolve(process.env.JEUX_SITE_DIR || '../site');
const CATALOG = resolve('../games.json');
const SITE_URL = process.env.JEUX_URL || 'https://jeux.kassir.fr';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg',
};

const siteFiles = () => ({
  name: 'site-files',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (path === '/games.json') { res.setHeader('Content-Type', TYPES['.json']); return createReadStream(CATALOG).pipe(res); }
      if (path === '/' || path.startsWith('/@') || path.startsWith('/src/') || path.startsWith('/node_modules/')) return next();
      let file = normalize(join(SITE_DIR, path));
      if (!file.startsWith(SITE_DIR) || !existsSync(file)) return next();
      if (statSync(file).isDirectory()) file = join(file, 'index.html');
      if (!existsSync(file)) return next();
      res.setHeader('Content-Type', TYPES[extname(file)] || 'application/octet-stream');
      createReadStream(file).pipe(res);
    });
  },
});

// Service worker : la page et ses fichiers (nommés par leur contenu) en cache dès la première visite,
// version recalculée à chaque build (l'ancien cache est vidé tout seul).
const SITE_PRECACHE = ['/', '/index.html', '/manifest.webmanifest', '/games.json', '/scores.js', '/icon.svg'];
const serviceWorker = () => ({
  name: 'service-worker',
  apply: 'build',
  generateBundle(options, bundle) {
    const built = Object.keys(bundle).filter((f) => f.startsWith('assets/')).map((f) => `/${f}`);
    const version = createHash('sha1').update(built.join()).digest('hex').slice(0, 8);
    const source = readFileSync('src/sw.js', 'utf8')
      .replace('__VERSION__', `jeux-${version}`)
      .replace('__PRECACHE__', JSON.stringify([...SITE_PRECACHE, ...built]));
    this.emitFile({ type: 'asset', fileName: 'sw.js', source });
  },
});

export default defineConfig({
  plugins: [siteFiles(), serviceWorker()],
  server: {
    host: true,
    proxy: {
      '/api': { target: SITE_URL, changeOrigin: true },
      '/jeux': { target: SITE_URL, changeOrigin: true },
    },
  },
  build: { chunkSizeWarningLimit: 4000 },
});
