# Roadmap : gameboard

Instantané du 2026-11-08. Version courante : 0.9.0 (portail, menu 3D, scores, état public du parc).

## 0.10.0 (prochaine)
- gameboard-002 : scores vérifiés par le serveur (🔴)
- gameboard-003 : limite sur les échecs d'authentification
- **Classements** pour `space_hairness`, `space_run` et `gemma_run` (`src/games.js`), après le choix : envoi navigateur (falsifiable) ou serveur avec clé.
- Régler `releases.json` : fichier régénéré par `devops/collect-releases.mjs`, aujourd'hui modifié et non commité (le commiter à chaque version ou l'ignorer).

## next
- **Base de l'API des joueurs principale** (la meilleure base d'après le `concept/ideas/todo-historique.md` du principal).
- Clés d'API des jeux enfin utilisées pour les scores.
- Page `/notes/` : reconstruire après chaque nouvelle note de version.

### Mis de côté
- —

## Versions passées

Une ligne par version publiée (détail : `concept/release/<version>.md`).

- **0.9.0** (2026-11-04) : État public du parc
- **0.8.0** (2026-11-04) : Notes de mise à jour : la frise du temps
- **0.7.0** (2026-11-04) : Parties sur le serveur dans le salon
- **0.6.0** (2026-11-04) : Jeux externes dans le salon
- **0.5.0** (2026-11-04) : Salon réutilisable et Asteroid Run
- **0.4.0** (2026-11-04) : Salon multijoueur
- **0.3.0** (2026-11-04) : Hub des jeux à plusieurs (serveur01)
- **0.2.0** (2026-11-01) : Un seul dépôt pour le portail
- **0.1.0** (2026-11-01) : Premier jet
