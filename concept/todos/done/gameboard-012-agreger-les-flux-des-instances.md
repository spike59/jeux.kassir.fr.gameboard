# agréger les flux des instances

**Statut** : fait le 2026-11-16 (gameboard 1.1.0) · créé le 2026-11-16 · chantier `interface-multijoueur` (`concept/tomove/jeux/chantiers/interface-multijoueur/plan.md` du principal)

**En une phrase** : gameboard s'abonne au flux d'événements de chaque instance swordfish (un jeu = une instance), garde l'état de tous les jeux et le renvoie en direct aux menus des jeux et au salon (fin de la lecture toutes les 2 s dans `remote-hub.js` et toutes les 5 s dans le bouton du menu).

## Détails
Remplace `createRemoteHub` (interrogation) ; sert `/api/v1/multi` et un flux (événements serveur) pour les menus ; le salon commun (présence, chat) est reconstitué par gameboard puisqu'il n'existe plus dans un hub unique. Adresses des instances lues dans `SWORDFISH_URLS` (une par jeu).

**Origine** : décisions de l'administrateur du 2026-11-16 (un swordfish par jeu, état en événements).
