# Changelog

## 0.2.0

- **Un seul dépôt pour le portail** : reprend le menu 3D (ancien dépôt `menu`, voir `menu/`), le serveur du portail et l'API des scores (anciens `app/` et `public/` de la stack).
- API en `/api/v1/…` : `boards` (lecture), `scores` (clé d'un jeu), `public-scores` (navigateur, classements `open`, plusieurs classements par requête).
- Le menu lit `/api/v1/boards` ; le catalogue (`games.json`) désigne les classements par `board` / `group`.
- Classement de Bulles (`bulles`, ouvert au navigateur).
- Dockerfile à la racine (menu construit, puis serveur) ; catalogue et jeux statiques montés par la stack.
- Variable `TRUST_PROXY` pour les essais locaux.

## 0.1.0

- Premier jet : envoi de scores par les serveurs des jeux avec une clé d'API par jeu, meilleur score par joueur et par classement, top public.
- Règles de validation reprises de l'ancien `scores.js` du portail (prénom, bornes), classements de `police-voleurs`.
- Stockage JSON atomique, limite d'envois par clé, 8 tests.
