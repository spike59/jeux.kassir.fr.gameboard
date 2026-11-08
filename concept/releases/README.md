# Notes de version

Un fichier par version : `<version>.md` (ex. `1.2.0.md`).

```
---
version: 1.2.0
date: 2026-11-03
title: "Titre court de la version"
---

- Ce qui change, en puces.
```

Ces notes sont lues automatiquement :
- par **Secure** (page du jeu : nouveautés avant de mettre à jour, historique) ;
- par `devops/collect-releases.mjs`, qui les rassemble dans `apps/gameboard/releases.json` (page « Notes de mise à jour » du portail).

Ne pas renommer le dossier ; ce README n'est pas une note.
