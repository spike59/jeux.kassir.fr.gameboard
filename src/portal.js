// Portail jeux.kassir.fr : menu 3D, fichiers du site (catalogue, jeux statiques), API des scores sur /api.
// Uniquement derrière nginx-proxy, uniquement en HTTPS. Les jeux avec serveur ont leur propre conteneur.
import express from 'express';
import { join } from 'node:path';
import { createApi } from './app.js';

const CSP = "default-src 'self'; img-src 'self' data:; media-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'none'";

function securityHeaders(req, res, next) {
  res.set({
    'Content-Security-Policy': CSP,
    'Strict-Transport-Security': 'max-age=31536000',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  });
  next();
}

// fichiers statiques des jeux et du site : cache d'une semaine pour les ressources, revalidation pour le reste
function gameHeaders(res, path) {
  const longCache = /\.(css|js|svg|png|jpg|webp|mp3|ogg|woff2)$/.test(path) && !path.endsWith('sw.js');
  res.set('Cache-Control', longCache ? 'public, max-age=604800' : 'no-cache');
}

// menuDir : menu 3D construit ; publicDir : icône, scores.js ; gamesDir : un dossier par jeu, /jeux/<id>/ sert son sous-dossier public/ (jeux statiques) ;
// catalog : games.json ; apiOptions : voir createApi
export function createPortal({ publicHost, menuDir = '', publicDir, gamesDir, catalog, apiOptions, trustProxy = 'uniquelocal' }) {
  // Toute requête qui n'est pas arrivée en HTTPS au proxy est renvoyée vers HTTPS.
  // La cible est le nom configuré, jamais le Host reçu (pas de redirection ouverte).
  const httpsOnly = (req, res, next) => (req.path === '/healthz' || req.secure ? next() : res.redirect(301, `https://${publicHost}${req.originalUrl}`));

  const site = express();
  site.disable('x-powered-by');
  // nginx-proxy est sur le réseau Docker (adresses privées) : on croit son X-Forwarded-Proto, celui des autres non.
  site.set('trust proxy', trustProxy);
  site.get('/healthz', (req, res) => res.type('text').send('ok'));
  site.use(httpsOnly, securityHeaders);
  site.use('/api', createApi({ ...apiOptions, publicOrigin: `https://${publicHost}` }));

  // Jeux statiques : seulement games/<id>/public/ (le Dockerfile et le serveur d'un jeu avec conteneur ne sont jamais servis)
  const staticGame = (req, res, next) => {
    if (!gamesDir || !/^[a-z0-9_-]+$/i.test(req.params.id)) return next();
    return express.static(join(gamesDir, req.params.id, 'public'), { dotfiles: 'ignore', setHeaders: gameHeaders })(req, res, next);
  };
  site.use('/jeux/:id', staticGame);
  site.get('/games.json', (req, res) => res.set('Cache-Control', 'no-cache').sendFile(catalog, { dotfiles: 'allow' }));
  if (menuDir) {
    site.use(express.static(menuDir, {
      dotfiles: 'ignore',
      setHeaders(res, path) {
        // fichiers Vite nommés par leur contenu (assets/xxx-hash.js) : cache long ; le reste se revalide
        const hashed = /[\\/]assets[\\/][^\\/]+-[\w-]{8,}\.(js|css|woff2?|png|jpg|webp|svg)$/.test(path);
        res.set('Cache-Control', hashed ? 'public, max-age=31536000, immutable' : 'no-cache');
      },
    }));
  }
  site.use(express.static(publicDir, { dotfiles: 'ignore', setHeaders: gameHeaders }));
  site.use((req, res) => res.status(404).type('text').send('Page introuvable'));
  return site;
}
