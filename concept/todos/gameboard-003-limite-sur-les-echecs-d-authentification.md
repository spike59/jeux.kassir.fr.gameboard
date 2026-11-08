# limite sur les echecs d authentification

**Statut** : à faire · relevé le 2026-11-08 · priorité 🟠

**En une phrase** : Limiter les échecs d'authentification de `POST /api/v1/scores` par IP.

## Détails
À vérifier : `src/app.js` limite les envois par clé (`keyLimited`) et par IP (`ipLimited`, 429) ; pas de limite propre aux échecs d'authentification trouvée. Les clés sont longues donc le risque est faible.

**Origine** : secure/concept/ideas/securite-hebergement.md, « Scores et gameboard »
