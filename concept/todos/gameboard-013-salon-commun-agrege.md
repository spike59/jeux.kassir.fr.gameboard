# salon commun agrégé

**Statut** : à faire · créé le 2026-11-16 · chantier `interface-multijoueur` (`concept/tomove/jeux/chantiers/interface-multijoueur/plan.md` du principal)

**En une phrase** : le salon `/multi/` (présence, chat, parties de tous les jeux) fonctionne avec plusieurs instances de swordfish, une par jeu : gameboard le reconstitue.

## Détails
Aujourd'hui le salon se connecte au hub d'**une** instance (`/jeux/swordfish/hub`) : il ne voit que les jeux de celle-ci. lili-kart a déjà la sienne (`swordfish-lili-kart`) : son état est affiché par le flux d'événements (bande des jeux), mais ses parties ne sont pas listées dans « Parties sur le serveur ».
À faire : (1) lister les parties de toutes les instances (le flux `game` porte déjà les salles, comptes seulement) avec le lien pour les rejoindre ; (2) présence et chat : un seul salon, tenu par gameboard (ou par une instance désignée) ; (3) `createLobby` des jeux à hub (bulles, asteroid_run) : adresse du hub du jeu. **Bloque** les todos « instance swordfish dédiée » de bulles, asteroid_run, space_run, gemma_run, space_hairness et car_race.

**Origine** : demande de l'administrateur du 2026-11-16 (un serveur de jeu dédié par jeu ; lili-kart d'abord, les autres suivent).
