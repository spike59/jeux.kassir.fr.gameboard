---
version: 0.2.0
date: 2026-11-01
title: "Un seul dépôt pour le portail"
---

- **Un seul dépôt pour le portail** : reprend le menu 3D (ancien dépôt `menu`, voir `menu/`), le serveur du portail et l'API des scores (anciens `app/` et `public/` de la stack).
- API en `/api/v1/…` : `boards` (lecture), `scores` (clé d'un jeu), `public-scores` (navigateur, classements `open`, plusieurs classements par requête).
- Le menu lit `/api/v1/boards` ; le catalogue (`games.json`) désigne les classements par `board` / `group`.
- Classement de Bulles (`bulles`, ouvert au navigateur).
- Dockerfile à la racine (menu construit, puis serveur) ; catalogue et jeux statiques montés par la stack.
- Variable `TRUST_PROXY` pour les essais locaux.
