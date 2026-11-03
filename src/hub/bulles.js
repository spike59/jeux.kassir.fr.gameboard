// Bulles à plusieurs : module de jeu du hub (voir hub.js).
// Chaque joueur a une couleur. Les bulles qui montent portent la couleur d'un joueur (tirée au hasard parmi ceux de la salle) :
// éclater une des siennes = +1 point, éclater celle d'un autre = −5 points. Tout le monde voit les mêmes bulles.
// Le serveur décide : il crée les bulles, et la première pression arrivée gagne (une bulle ne s'éclate qu'une fois).
export const COLORS = ['#ff6b9d', '#4dd4ff', '#6bf178', '#ffd23f', '#b28dff', '#ff9f43'];
export const ROUND_MS = 60_000; // durée d'une manche
export const SPAWN_MS = 600; // une nouvelle bulle toutes les 0,6 s
export const OWN_POINTS = 1;
export const OTHER_POINTS = -5;

export const bulles = {
  id: 'bulles',
  title: 'Bulles à plusieurs',
  min: 2,
  max: COLORS.length,

  // Couleur libre la plus proche dans la palette (un joueur qui part libère la sienne).
  onJoin(room, player) {
    const used = new Set([...room.players.values()].map((p) => p.color));
    player.color = COLORS.find((c) => !used.has(c)) ?? COLORS[0];
    player.score = 0;
  },

  onStart(room, api) {
    const game = (room.state = { bubbles: new Map(), next: 1, stops: [] });
    for (const p of room.players.values()) p.score = 0;
    const endsAt = api.now() + ROUND_MS;
    api.broadcast({ t: 'start', endsAt, roundMs: ROUND_MS });
    game.stops.push(api.every(SPAWN_MS, () => {
      const owners = [...room.players.values()];
      if (!owners.length) return;
      const owner = owners[Math.floor(api.rng() * owners.length)];
      const b = {
        id: game.next++,
        x: Math.round(api.rng() * 1000) / 1000, // part de la largeur de l'écran (0 à 1)
        size: Math.round(60 + api.rng() * 60),
        dur: Math.round(5000 + api.rng() * 4000),
        drift: Math.round((api.rng() - 0.5) * 120),
        color: owner.color,
      };
      game.bubbles.set(b.id, { ...b, popped: false });
      api.broadcast({ t: 'spawn', b });
      // la bulle sort de l'écran : on l'oublie (un éclat tardif est un « raté », pas une erreur)
      game.stops.push(api.after(b.dur + 1000, () => game.bubbles.delete(b.id)));
    }));
    game.stops.push(api.after(ROUND_MS, () => this.finish(room, api)));
  },

  onMessage(room, player, msg, api) {
    if (room.status !== 'playing' || msg.t !== 'pop') return;
    const b = room.state.bubbles.get(Number(msg.b));
    if (!b || b.popped) return api.send(player, { t: 'miss', b: Number(msg.b) });
    b.popped = true;
    const delta = b.color === player.color ? OWN_POINTS : OTHER_POINTS;
    player.score += delta;
    api.broadcast({ t: 'popped', b: b.id, by: player.id, delta, score: player.score });
  },

  onLeave(room, player, api) {
    if (room.status === 'playing' && room.players.size < 2) this.finish(room, api);
  },

  finish(room, api) {
    if (room.status !== 'playing') return;
    for (const stop of room.state.stops) stop();
    room.status = 'finished';
    const scores = [...room.players.values()].map((p) => ({ id: p.id, name: p.name, color: p.color, score: p.score })).sort((a, b) => b.score - a.score);
    api.broadcast({ t: 'end', scores });
    api.changed();
  },

  // « Rejouer » : retour à la salle d'attente, scores à zéro
  reset(room) {
    room.state = null;
    for (const p of room.players.values()) p.score = 0;
  },
};
