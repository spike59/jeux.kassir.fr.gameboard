# scores verifies par le serveur

**Statut** : à faire · relevé le 2026-11-08 · priorité 🔴

**En une phrase** : Remplacer les scores envoyés par le navigateur (falsifiables) par des scores envoyés par le serveur du jeu avec sa clé.

## Détails
`POST /api/v1/public-scores` (Bulles, Police vs voleurs) n'est protégé que par l'en-tête `Origin`, la limite par IP et les bornes min/max. Remède : `/api/v1/scores` avec clé ; pour un jeu sans serveur, accepter le risque ou lui donner un petit serveur. Touche `bulles` et `car_race`.

## Avancement le 2026-11-10
Avancement : les classements à plusieurs de `bulles` et `asteroid_run` ne sont plus ouverts au navigateur (`open: false`) : leurs scores viennent de swordfish avec clé. **Reste** : les classements solo de `bulles` et `asteroid_run` (jeux sans serveur : décision à prendre, garder les garde-fous actuels) et `car_race` (`car_race-001`, `game_server-008` obsolète).

**Origine** : secure/concept/ideas/securite-hebergement.md, « Scores et gameboard »
