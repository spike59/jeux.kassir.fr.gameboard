---
version: 1.0.0
date: 2026-11-16
title: "Le hub des salons passe à swordfish"
---

**Importance : majeure (le hub des salons `/api/v1/hub` est retiré : les jeux à plusieurs passent par swordfish).**

- **Le hub des salons est retiré** de gameboard (`src/hub/` supprimé, 825 lignes) : il vit dans swordfish. `src/remote-hub.js` relaie vers lui.
- Les jeux à plusieurs (`bulles`, `asteroid_run`) joignent désormais `/jeux/swordfish/hub` au lieu de `/api/v1/hub` (`site/lib/hub-lobby.js`, `site/multi/multi.js`).
- Catalogue : `lili-kart` remplace `kart_demo` ; `releases.json` régénéré (jeux publics seulement).
- `src/games.js` : classements ajustés.
- **`GET /api/v1/multi`** : l'état du multijoueur pour les menus et le salon. Le catalogue (`games.json`, jeux marqués `"multi": true`) fusionné avec ce que swordfish annonce : par jeu, serveur en ligne ou non, parties, joueurs, parties à rejoindre, adresse du salon. Comptes seulement, jamais de prénom (`src/multi.js`).
- **`site/lib/multi-entry.js`** : le bouton « 👥 Multijoueur » commun à tous les menus des jeux, avec l'état en direct (`mountMultiEntry`). Il mène au salon, toujours sur gameboard.
- **Salon `/multi/?game=<jeu>`** : le jeu d'où l'on vient passe en premier (ses parties, sa création de partie) et est entouré.
- `games.json` : les 7 jeux en réseau portent `"multi": true`.
- Todos, roadmap et chantiers `serveur-de-dev` et `multijoueur-normalise` mis à jour.
- Tests : 21 (état du multijoueur, bouton du menu, route `/api/v1/multi`, catalogue).

Tests : 21 tests passent.
