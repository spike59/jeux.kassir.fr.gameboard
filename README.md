# gameboard

Le **portail de jeux.kassir.fr** : on y arrive, on choisit un jeu (menu 3D), et c'est lui qui garde les **meilleurs scores** de tous les jeux. Un seul dépôt, un seul conteneur (`web-app`).

À ne pas confondre avec la **progression d'un joueur** (crédits, garage, carte…), qui reste dans chaque jeu.

```
gameboard/
  src/        serveur Express : portail (portal.js), API des scores (app.js), classements (games.js), stockage (store.js)
  menu/       menu 3D (Vite + Babylon.js) : carrousel, vignettes, tableaux des scores
  site/       fichiers servis tels quels : icon.svg, scores.js
  (games/)    pas dans ce dépôt : web/jeux.kassir.fr/games de la stack, un dossier par jeu, monté sur /games
  games.json  catalogue des jeux affichés par le menu
  test/       tests de l'API (node --test)
  Dockerfile  construit le menu puis le serveur
```

Les jeux ne sont **pas** ici : chacun a son dépôt (`apps/<jeu>`). Le déploiement de la stack les met en ligne :
- jeu **statique** (Bulles) : son `dist/` est copié dans `web/jeux.kassir.fr/games/<id>/public/`, monté dans le conteneur ;
- jeu **avec serveur** (Police vs voleurs) : son propre conteneur, derrière le même proxy.

## Scores

- Chaque classement est défini dans [src/games.js](src/games.js) : `order` (`desc` = le plus grand gagne, `asc` = le plus petit, pour les temps en ms), bornes `min`/`max` plausibles, titre.
- **Une ligne par joueur et par classement : son meilleur résultat.** Un meilleur score que le n°1 devient le **top**.
- Pas de compte ni de donnée personnelle : seulement le prénom saisi (1 à 16 caractères).

Deux façons d'envoyer un score :

| Qui | Route | Protection |
| --- | --- | --- |
| **Serveur d'un jeu** (clé d'API) | `POST /api/v1/scores` `{ board, entries: [{ player, value }] }` | clé secrète par jeu (`Authorization: Bearer`), limite par clé ; la clé fixe le jeu |
| **Navigateur** (jeu sans serveur, ou score calculé dans le navigateur) | `POST /api/v1/public-scores` `{ game, entries: [{ board, player, value }] }` | seulement depuis le site (`Origin`), seulement les classements `open: true`, limite par IP |

La seconde est moins fiable (le score vient du client) : elle est réservée aux jeux qui n'ont pas de serveur. Réponse `201` : `results: [{ board, player, status }]` avec `status` = `top` (nouveau n°1), `best` (record personnel), `kept` (pas meilleur que le sien) ou `ignored` (nom, valeur ou classement invalide, ignoré sans bloquer les autres).

Lecture publique : `GET /api/v1/boards` (tous les jeux) et `GET /api/v1/boards/:game`.

### Ajouter un jeu

1. Un classement dans `src/games.js` (et `open: true` seulement s'il n'a pas de serveur).
2. Une entrée dans `games.json` (id, titre, icône, couleur, `url`, `ready`, `online` : les classements à afficher).
3. Jeu avec serveur : une clé dans `GAMEBOARD_KEYS` (`.env` de la stack), transmise au conteneur du jeu.

## Lancer

```bash
npm install
npm test                      # API et portail : 14 tests
npm run build:menu            # construit menu/dist
GAMEBOARD_KEYS=jeu:clé… MENU_DIR=menu/dist TRUST_PROXY=loopback npm start   # http://127.0.0.1:3000
cd menu && npm run dev        # menu seul, relaie /api et /jeux vers le site en ligne
```

Variables : `PORT` (3000), `HOST` (127.0.0.1 ; `0.0.0.0` en conteneur), `PUBLIC_HOST` (jeux.kassir.fr), `GAMEBOARD_KEYS`, `DATA_DIR` (un volume en ligne), `MENU_DIR`, `PUBLIC_DIR`, `GAMES_DIR`, `CATALOG`, `TRUST_PROXY`. Le portail redirige tout vers HTTPS : derrière le proxy Docker l'adresse est privée (`uniquelocal`) ; pour un essai local, `TRUST_PROXY=loopback` et l'en-tête `X-Forwarded-Proto: https`.

## Stockage

Un fichier `gameboard.json` (écriture atomique), 100 lignes gardées par classement. (Avant la fusion, `scores.json` ; les anciens scores, en test, n'ont pas été repris.)

## Limites connues

Les bornes `min`/`max` écartent les valeurs impossibles, pas la triche : la clé prouve quel jeu écrit, pas que le score est honnête, et un envoi navigateur peut être falsifié dans les bornes. Le proxy voit tous les clients avec la même adresse (voir le TODO du monitor) : la limite par IP des envois navigateur est donc partagée par tous.
