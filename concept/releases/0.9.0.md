---
version: 0.9.0
date: 2026-11-04
title: "État public du parc"
---

- `GET /api/parc/live` (public, sans cache) : pour chaque jeu, ses parties (nom, état, joueurs, prénoms) et les visiteurs du salon ; sert la page « Le parc en direct »
- Les salles des jeux hébergés par le serveur annoncent le prénom de leurs joueurs (`names`) ; à défaut, le prénom du maître
- Le jeu « Le parc en direct » (`/jeux/parc/`) dans le catalogue
