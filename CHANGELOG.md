# Changelog

## 1.2.0

- **Parcours du salon** (`/multi/`) : un clic sur un jeu de la bande « 1 · Choisis ton jeu » le **sélectionne sans recharger la page** (l'adresse suit : `?game=<jeu>`) et ouvre sa fiche « 2 · <jeu> » : l'état en direct, **Créer une partie** (jeux du hub) ou **Jouer** (jeu qui a son propre serveur, comme lili-kart), ses parties avec « Rejoindre », et le formulaire de création de partie sur le serveur pour les jeux hébergés. Avant, les pastilles ne faisaient que recharger la page.
- **Anciens affichages réseau cachés** : toutes les parties de tous les jeux, les parties entre joueurs et les boutons de création par jeu ne sont visibles qu'avec `?debug=true` dans l'adresse ; ils ne sont pas supprimés.
- Le parcours : le portail (`/`) → un jeu (`/jeux/<jeu>/`, son menu) → son bouton « Multijoueur » → le salon sur ce jeu (`/multi/?game=<jeu>`) → jouer ou créer une partie.

## 1.1.1

- `scripts/check-multi.mjs` signale un jeu statique dont un script en ligne monte l'entrée « Multijoueur » : la politique de sécurité du portail (`default-src 'self'`) l'interdit, il faut un fichier à part.

## 1.1.0

- **L'état du multijoueur arrive en événements** (gameboard-012) : gameboard s'abonne au flux `GET /api/events` de chaque instance swordfish (`SWORDFISH_URLS`, une par jeu ; à défaut `SWORDFISH_URL`), avec reconnexion automatique, détection des trous de `seq` et des flux muets (`src/multi.js`). Plus d'interrogation.
- `GET /api/v1/multi` (état complet) et **`GET /api/v1/multi/stream`** (événements `snapshot`, `game`, `server`) : les menus des jeux et le salon reçoivent chaque changement tout de suite. Un jeu dont l'instance s'arrête passe « hors ligne », en maintenance « maintenance ». Comptes seulement.
- `site/lib/multi-entry.js` : le bouton « Multijoueur » des menus s'abonne au flux (plus d'interrogation toutes les 5 s).
- **Salon plus clair** (gameboard-011) : la page `/multi/` commence par « 1 · Choisis ton jeu », une bande qui montre l'état de chaque jeu en direct ; le nombre de joueurs en ligne est poussé aussi (plus de lecture toutes les 8 s).
- **Contrôle des interfaces** (gameboard-010) : `node scripts/check-multi.mjs` vérifie que chaque jeu en réseau déclare ses modes et son serveur et monte l'entrée « Multijoueur » de son menu.
- Le relais de lecture du parc (prénoms de la page publique du parc) ne travaille plus que tant que quelqu'un le lit.

## 1.0.0

- **`GET /api/v1/multi`** : l'état du multijoueur pour les menus et le salon. Le catalogue (`games.json`, jeux marqués `"multi": true`) fusionné avec ce que swordfish annonce : par jeu, serveur en ligne ou non, parties, joueurs, parties à rejoindre, adresse du salon. Comptes seulement, jamais de prénom (`src/multi.js`).
- **`site/lib/multi-entry.js`** : le bouton « 👥 Multijoueur » commun à tous les menus des jeux, avec l'état en direct (`mountMultiEntry`). Il mène au salon, toujours sur gameboard.
- **Salon `/multi/?game=<jeu>`** : le jeu d'où l'on vient passe en premier (ses parties, sa création de partie) et est entouré.
- `games.json` : les 7 jeux en réseau portent `"multi": true`.
- **Le hub des salons est retiré** de gameboard (`src/hub/` supprimé, 825 lignes) : il vit dans swordfish. `src/remote-hub.js` relaie vers lui.
- Les jeux à plusieurs (`bulles`, `asteroid_run`) joignent désormais `/jeux/swordfish/hub` au lieu de `/api/v1/hub` (`site/lib/hub-lobby.js`, `site/multi/multi.js`).
- Catalogue : `lili-kart` remplace `kart_demo` ; `releases.json` régénéré (jeux publics seulement).
- `src/games.js` : classements ajustés.
- Todos, roadmap et chantiers `serveur-de-dev` et `multijoueur-normalise` mis à jour.

## 0.9.2

- Page `/notes/` : colonne « À venir » quand les données contiennent `upcoming` (utilisée par `roadmap`, absente du portail public).

## 0.9.1

- **`/releases.json` ne contient que les jeux publics** (prêts et avec une adresse dans `games.json`) ; le fichier complet reste local, servi par l'application `roadmap`.
- Page `/notes/` : un bouton « Les jeux » dans le filtre quand les données contiennent aussi des outils (affichage partagé avec `roadmap`).

## 0.9.0

- **`GET /api/parc/live`** : l'état public des parties de tous les jeux (trains, prénoms des joueurs, visiteurs du salon) pour « Le parc en direct ».
- Les salles des jeux externes annoncent le prénom de leurs joueurs (`names`).

## 0.2.0

- **Un seul dépôt pour le portail** : reprend le menu 3D (ancien dépôt `menu`, voir `menu/`), le serveur du portail et l'API des scores (anciens `app/` et `public/` de la stack).
- API en `/api/v1/…` : `boards` (lecture), `scores` (clé d'un jeu), `public-scores` (navigateur, classements `open`, plusieurs classements par requête).
- Le menu lit `/api/v1/boards` ; le catalogue (`games.json`) désigne les classements par `board` / `group`.
- Classement de Bulles (`bulles`, ouvert au navigateur).
- Dockerfile à la racine (menu construit, puis serveur) ; catalogue et jeux statiques montés par la stack.
- Variable `TRUST_PROXY` pour les essais locaux.

## 0.1.0

- Premier jet : envoi de scores par les serveurs des jeux avec une clé d'API par jeu, meilleur score par joueur et par classement, top public.
- Règles de validation reprises de l'ancien `scores.js` du portail (prénom, bornes), classements de `car_race`.
- Stockage JSON atomique, limite d'envois par clé, 8 tests.
