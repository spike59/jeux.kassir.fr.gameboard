# gameboard

Service des **meilleurs scores** de jeux.kassir.fr. Les jeux en dépendent : leur serveur y envoie les scores avec sa clé, le portail y lit les tops.

À ne pas confondre avec la **progression d'un joueur** (crédits, garage, carte…), qui reste dans le jeu.

## Principe

- Chaque jeu a une **clé d'API**, gardée côté serveur du jeu (jamais dans le navigateur).
- Le serveur du jeu envoie le score d'un joueur ; si c'est son meilleur sur ce classement il est gardé (une ligne par joueur), s'il bat le n°1 il devient le **top**.
- La clé fixe le jeu : un jeu ne peut écrire que dans ses propres classements.
- Le portail ne fait que **lire** (`GET`, sans clé).

## API

| Requête | Accès | Rôle |
| --- | --- | --- |
| `POST /v1/scores` | clé du jeu (`Authorization: Bearer <clé>`) | envoie des scores |
| `GET /v1/boards` | public | tous les tops (portail) |
| `GET /v1/boards/:game` | public | les tops d'un jeu |
| `GET /healthz` | public | santé du conteneur |

Envoi :

```json
{ "board": "police", "entries": [ { "player": "Ana", "value": 12 }, { "player": "Bob", "value": 7 } ] }
```

Réponse `201` : `{ "board": "police", "results": [ { "player": "Ana", "status": "top" }, … ] }` avec `status` = `top` (nouveau n°1), `best` (record personnel), `kept` (pas meilleur que le sien) ou `ignored` (nom ou valeur invalide, ignoré sans bloquer les autres).

Erreurs : `401` clé invalide, `400` classement inconnu pour ce jeu / aucune entrée valide, `429` trop d'envois (120 par minute et par clé).

## Classements

Définis dans [src/games.js](src/games.js) : `order` (`desc` = le plus grand gagne, `asc` = le plus petit, pour les temps en ms), bornes `min`/`max` plausibles, titre. Ajouter un jeu = une entrée dans ce fichier + une clé.

Jeux déclarés : `police-voleurs` (flics, voleurs, record du meilleur tour par circuit et par version). Vulpine et Space Run restent à ajouter.

## Lancer

```bash
npm install
cp .env.example .env     # GAMEBOARD_KEYS=jeu:clé,jeu2:clé2
npm start                # http://127.0.0.1:3000
npm test
```

Variables : `GAMEBOARD_KEYS`, `PORT` (3000), `HOST` (127.0.0.1 ; `0.0.0.0` en conteneur), `DATA_DIR` (`./data`, un volume en ligne).

## Déploiement (dans la stack WEB_STACK)

- Un conteneur sur le réseau `proxy-tier`, **sans** `VIRTUAL_HOST` pour `POST /v1/scores` : les serveurs des jeux l'appellent par le réseau Docker (`http://gameboard:3000`). Seule la lecture est exposée au portail.
- Les clés sont dans le `.env` de la stack (secrets), une par jeu, transmises au conteneur du jeu (`GAMEBOARD_KEY`) et à celui de gameboard (`GAMEBOARD_KEYS`).
- Volume nommé pour `DATA_DIR`.

## Stockage

Un fichier `gameboard.json` (écriture atomique), 100 lignes gardées par classement. Pas de compte ni de donnée personnelle : seulement le prénom saisi (1 à 16 caractères).

## Limites connues

Les bornes `min`/`max` écartent les valeurs impossibles, pas la triche d'un serveur de jeu compromis : la clé prouve quel jeu écrit, pas que le score est honnête.
