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
- Todos, roadmap et chantiers `serveur-de-dev` et `multijoueur-normalise` mis à jour.
- Tests : 16 (le test du hub est retiré avec le hub, `remote-hub.test.js` ajouté).

Tests : 16 tests passent.
