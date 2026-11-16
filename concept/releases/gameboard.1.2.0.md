---
version: 1.2.0
date: 2026-11-16
title: "Salon : un clic sur un jeu le sélectionne"
---

**Importance : mineure.**

- **Parcours du salon** (`/multi/`) : un clic sur un jeu de la bande « 1 · Choisis ton jeu » le **sélectionne sans recharger la page** (l'adresse suit : `?game=<jeu>`) et ouvre sa fiche « 2 · <jeu> » : l'état en direct, **Créer une partie** (jeux du hub) ou **Jouer** (jeu qui a son propre serveur, comme lili-kart), ses parties avec « Rejoindre », et le formulaire de création de partie sur le serveur pour les jeux hébergés. Avant, les pastilles ne faisaient que recharger la page.
- **Anciens affichages réseau cachés** : toutes les parties de tous les jeux, les parties entre joueurs et les boutons de création par jeu ne sont visibles qu'avec `?debug=true` dans l'adresse ; ils ne sont pas supprimés.
- Le parcours : le portail (`/`) → un jeu (`/jeux/<jeu>/`, son menu) → son bouton « Multijoueur » → le salon sur ce jeu (`/multi/?game=<jeu>`) → jouer ou créer une partie.

Tests : 36 tests passent ; parcours essayé dans un navigateur sur dev (sélection, actions par type de jeu, anciens affichages cachés et visibles avec debug).
