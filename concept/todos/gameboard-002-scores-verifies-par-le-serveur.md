# scores verifies par le serveur

**Statut** : à faire · relevé le 2026-11-08 · priorité 🔴

**En une phrase** : Remplacer les scores envoyés par le navigateur (falsifiables) par des scores envoyés par le serveur du jeu avec sa clé.

## Détails
`POST /api/v1/public-scores` (Bulles, Police vs voleurs) n'est protégé que par l'en-tête `Origin`, la limite par IP et les bornes min/max. Remède : `/api/v1/scores` avec clé ; pour un jeu sans serveur, accepter le risque ou lui donner un petit serveur. Touche `bulles` et `car_race`.

**Origine** : secure/concept/ideas/securite-hebergement.md, « Scores et gameboard »
