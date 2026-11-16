---
version: 1.1.1
date: 2026-11-16
title: "Le contrôle des interfaces signale les scripts en ligne"
---

**Importance : correctif.**

- `scripts/check-multi.mjs` signale un jeu statique dont un script en ligne monte l'entrée « Multijoueur » : la politique de sécurité du portail (`default-src 'self'`) l'interdit, il faut un fichier à part.

Tests : 36 tests passent (1 ajouté).
