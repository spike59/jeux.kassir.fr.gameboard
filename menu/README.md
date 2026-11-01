# 🎮 Menu des jeux (jeux.kassir.fr)

Page d'accueil 3D du portail de jeux, faite avec [Babylon.js](https://www.babylonjs.com/) : les vignettes des jeux tournent tout autour de nous.

Trois vues (barre en bas sur téléphone, pastille sous le titre sur ordinateur), choisies par l'adresse `#scores`, `#carrousel`, `#vignettes` et mémorisées :

- **🎠 Carrousel** : un anneau de vignettes autour de la caméra. On glisse (doigt, souris), flèches ‹ ›, flèches du clavier, molette ou manette ; toucher la vignette de devant lance le jeu.
- **🔲 Vignettes** : les mêmes cartes rangées en mur devant nous ; flèches/manette pour se déplacer, toucher pour jouer.
- **🏆 Scores** : le décor tourne doucement, le tableau des scores est devant (classement en ligne de Police vs voleurs, scores locaux des autres jeux).

Sans WebGL, la liste des jeux s'affiche en vignettes simples : on peut toujours jouer. PWA hors ligne (service worker généré au build).

## Données

Le menu ne contient aucun jeu : il lit `/games.json` (catalogue de gameboard : liste, couleur, emoji, `image` facultative, `ready`, `scores`, `online`) et `/api/v1/boards` (classements en ligne, gameboard). Ajouter un jeu = une ligne dans `games.json`.

## Développement

```bash
npm install
npm run dev      # http://localhost:5173 ; sert ../games.json et ../site, relaie /api et /jeux vers jeux.kassir.fr
npm run build    # dist/
```

`JEUX_SITE_DIR` (dossier du site, `../site` par défaut) et `JEUX_URL` (site distant relayé) changent ces valeurs par défaut.

## Structure

```
index.html         page (canvas + HTML des vues)
src/main.js        vues, données, clavier, installation PWA
src/scene.js       scène Babylon.js : anneau, mur, décor, toucher, manette
src/cardArt.js     dessin d'une vignette (texture canvas 2D)
src/boards.js      tableau des scores (HTML)
src/scores.js      lecture des scores locaux (jeux sans classement en ligne)
src/sw.js          modèle du service worker (version et fichiers remplis au build)
```
