---
version: 1.1.0
date: 2026-11-16
title: "Le multijoueur en direct, salon plus clair"
---

**Importance : mineure** (ajoute des routes et une variable `SWORDFISH_URLS` ; rien n'est retiré).

- **L'état du multijoueur arrive en événements** (gameboard-012) : gameboard s'abonne au flux `GET /api/events` de chaque instance swordfish (`SWORDFISH_URLS`, une par jeu ; à défaut `SWORDFISH_URL`), avec reconnexion automatique, détection des trous de `seq` et des flux muets (`src/multi.js`). Plus d'interrogation.
- `GET /api/v1/multi` (état complet) et **`GET /api/v1/multi/stream`** (événements `snapshot`, `game`, `server`) : les menus des jeux et le salon reçoivent chaque changement tout de suite. Un jeu dont l'instance s'arrête passe « hors ligne », en maintenance « maintenance ». Comptes seulement.
- `site/lib/multi-entry.js` : le bouton « Multijoueur » des menus s'abonne au flux (plus d'interrogation toutes les 5 s).
- **Salon plus clair** (gameboard-011) : la page `/multi/` commence par « 1 · Choisis ton jeu », une bande qui montre l'état de chaque jeu en direct ; le nombre de joueurs en ligne est poussé aussi (plus de lecture toutes les 8 s).
- **Contrôle des interfaces** (gameboard-010) : `node scripts/check-multi.mjs` vérifie que chaque jeu en réseau déclare ses modes et son serveur et monte l'entrée « Multijoueur » de son menu.
- Le relais de lecture du parc (prénoms de la page publique du parc) ne travaille plus que tant que quelqu'un le lit.

Tests : 32 tests passent (4 ajoutés au flux, 3 au contrôle des interfaces).
