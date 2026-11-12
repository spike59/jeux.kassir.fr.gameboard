# retirer le hub des salons

**Statut** : fait le 2026-11-10 (code, tests et déploiement) · créé le 2026-11-10 · chantier `multijoueur-normalise` (`concept/chantiers/multijoueur-normalise/plan.md` du principal)

**En une phrase** : Retirer le hub de salons de gameboard (`/api/v1/hub`) une fois `bulles` et `asteroid_run` passés sur swordfish.

## Détails
Le portail ne garde que les classements et les cartes.

## Fait le 2026-11-10
Le hub est retiré du code de gameboard (`src/hub/` et son test supprimés) ; il reste `src/remote-hub.js` (lecture du realm et du parc depuis swordfish, `SWORDFISH_URL`, 2 s) et les clients du salon pointent sur swordfish. 16 tests. Déployé le 2026-11-10.

**Origine** : décision de l'utilisateur du 2026-11-10 (les trois prochaines étapes principales : serveur de dev, mise à jour des cards, multijoueur normalisé).
