// Asteroid Run à plusieurs : module de jeu du hub (voir hub.js).
// Tout le monde vole dans le même champ d'astéroïdes : le serveur crée les astéroïdes et les étoiles (comme les bulles de Bulles),
// chaque navigateur les fait descendre et détecte ce que touche SON vaisseau et SES tirs, puis le dit au serveur.
// Le serveur arbitre : le premier à l'annoncer gagne les points d'une étoile ou d'un astéroïde détruit, et il compte les vies.
// Coordonnées envoyées : fractions de l'écran (0 à 1) et tailles en fraction de la plus petite dimension, pour que tous les écrans voient pareil.
export const COLORS = ['#4dd4ff', '#ff6b9d', '#6bf178', '#ffd23f', '#b28dff', '#ff9f43'];
export const ROUND_MS = 90_000; // durée d'une manche
export const TICK_MS = 250; // le serveur décide d'une apparition à chaque tick
export const LIVES = 3;
export const HURT_MS = 1600; // invulnérable après un choc
export const ROCK_POINTS = 5;
export const STAR_POINTS = 10;

export const asteroid_run = {
  id: 'asteroid_run',
  title: 'Asteroid Run',
  min: 2,
  max: COLORS.length,

  onJoin(room, player) {
    const used = new Set([...room.players.values()].map((p) => p.color));
    player.color = COLORS.find((c) => !used.has(c)) ?? COLORS[0];
    player.score = 0;
    player.lives = LIVES;
    player.out = false;
  },

  onStart(room, api) {
    const game = (room.state = { ents: new Map(), next: 1, stops: [], t0: api.now() });
    for (const p of room.players.values()) { p.score = 0; p.lives = LIVES; p.out = false; p.hurtUntil = 0; }
    api.broadcast({ t: 'start', roundMs: ROUND_MS });
    game.stops.push(api.every(TICK_MS, () => {
      const elapsed = api.now() - game.t0;
      // de plus en plus d'astéroïdes, de plus en plus vite (plafonné)
      if (api.rng() > Math.min(0.85, 0.4 + elapsed / 150_000)) return;
      const star = api.rng() < 0.28;
      const r = star ? 0.03 : 0.035 + api.rng() * 0.04;
      const speed = Math.min(0.2 + elapsed / 400_000, 0.5); // hauteurs d'écran par seconde
      const e = {
        id: game.next++, star,
        x: Math.round((0.06 + api.rng() * 0.88) * 1000) / 1000,
        r: Math.round(r * 1000) / 1000,
        vx: star ? 0 : Math.round((api.rng() - 0.5) * 100) / 1000,
        vy: Math.round(speed * (star ? 0.85 : 0.9 + api.rng() * 0.35) * 1000) / 1000,
        hp: star ? 1 : r > 0.06 ? 3 : r > 0.047 ? 2 : 1,
      };
      game.ents.set(e.id, { ...e, alive: true });
      api.broadcast({ t: 'spawn', e });
      game.stops.push(api.after(6000, () => game.ents.delete(e.id))); // hors de l'écran
    }));
    game.stops.push(api.after(ROUND_MS, () => this.finish(room, api)));
  },

  onMessage(room, player, msg, api) {
    if (room.status !== 'playing' || player.out) return;
    const game = room.state;
    const num = (v) => Math.min(1, Math.max(0, Number(v) || 0));
    switch (msg.t) {
      case 'pos': return api.others(player, { t: 'pos', id: player.id, x: num(msg.x), y: num(msg.y) });
      case 'shoot': return api.others(player, { t: 'shot', id: player.id, x: num(msg.x), y: num(msg.y) });
      case 'hit': { // un tir touche un astéroïde
        const e = game.ents.get(Number(msg.a));
        if (!e?.alive || e.star) return;
        e.hp--;
        if (e.hp > 0) return api.broadcast({ t: 'dmg', a: e.id, hp: e.hp });
        e.alive = false;
        player.score += ROCK_POINTS;
        return api.broadcast({ t: 'boom', a: e.id, by: player.id, score: player.score });
      }
      case 'take': { // le vaisseau attrape une étoile
        const e = game.ents.get(Number(msg.a));
        if (!e?.alive || !e.star) return;
        e.alive = false;
        player.score += STAR_POINTS;
        return api.broadcast({ t: 'took', a: e.id, by: player.id, score: player.score });
      }
      case 'crash': { // le vaisseau percute un astéroïde
        const e = game.ents.get(Number(msg.a));
        if (!e?.alive || e.star || api.now() < (player.hurtUntil ?? 0)) return;
        e.alive = false;
        player.hurtUntil = api.now() + HURT_MS;
        player.lives--;
        api.broadcast({ t: 'crashed', a: e.id, by: player.id, lives: player.lives });
        if (player.lives <= 0) {
          player.out = true;
          api.broadcast({ t: 'out', id: player.id });
          if ([...room.players.values()].every((p) => p.out)) this.finish(room, api);
        }
        return undefined;
      }
      default: return undefined;
    }
  },

  onLeave(room, player, api) {
    if (room.status === 'playing' && room.players.size < 2) this.finish(room, api);
  },

  finish(room, api) {
    if (room.status !== 'playing') return;
    for (const stop of room.state.stops) stop();
    room.status = 'finished';
    const scores = [...room.players.values()].map((p) => ({ id: p.id, name: p.name, color: p.color, score: p.score, out: !!p.out })).sort((a, b) => b.score - a.score);
    api.broadcast({ t: 'end', scores });
    api.changed();
  },

  reset(room) {
    room.state = null;
    for (const p of room.players.values()) { p.score = 0; p.lives = LIVES; p.out = false; }
  },
};
