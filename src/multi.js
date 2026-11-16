// État du multijoueur pour les menus des jeux et le salon : le catalogue (games.json, jeux marqués `multi`) fusionné avec ce que swordfish
// annonce en ce moment (le parc : par jeu, ses parties et leurs joueurs). Un jeu absent du parc est « hors ligne ».
// Lecture seule, sans donnée personnelle : seulement des comptes (pas de prénoms).
export function multiState(catalog, hubInfo, parc) {
  const rides = new Map((parc?.rides ?? []).map((r) => [r.id, r]));
  const games = catalog.filter((g) => g.multi && g.ready).map((g) => {
    const ride = rides.get(g.id);
    const trains = ride?.trains ?? [];
    const online = !!(hubInfo?.online && ride?.online);
    return {
      id: g.id, title: g.title, icon: g.icon, color: g.color ?? null, url: g.url ?? null,
      online,
      rooms: trains.length,
      players: trains.reduce((n, t) => n + (t.players ?? 0), 0),
      joinable: trains.filter((t) => t.status !== 'playing' && t.players < (t.max ?? ride?.max ?? Infinity)).length,
      max: ride?.max ?? null,
      lobby: `/multi/?game=${encodeURIComponent(g.id)}`,
    };
  });
  return { server: { online: !!hubInfo?.online, players: hubInfo?.players ?? 0, rooms: hubInfo?.rooms ?? 0 }, games };
}
