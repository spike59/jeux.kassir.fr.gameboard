# releases des jeux fournies par roadmap

**Statut** : idée à affiner · relevée le 2026-11-08

**En une phrase** : `gameboard` ne ferait que récupérer les releases **des jeux** (un filtre) auprès de l'application `roadmap`, et partagerait avec elle le même composant d'affichage (la prévisualisation du portail dans `roadmap` est la même page).

**Origine** : demande de l'utilisateur, 2026-11-08 ; fiche du principal `concept/ideas/application-roadmap.md`.

## À affiner avant d'en faire une fonctionnalité
- `roadmap` est local (127.0.0.1), `gameboard` est public : comment reçoit-il le fichier filtré (poussé à la publication, ou copie embarquée à la construction) ?
- Où vit le composant d'affichage partagé ?
- Aujourd'hui : `releases.json` complet (89 notes, 23 projets), servi par `gameboard` sur `/releases.json`.
