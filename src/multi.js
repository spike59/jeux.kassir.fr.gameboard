// L'état du multijoueur, en direct (chantier interface-multijoueur, gameboard-012).
//
//   instance swordfish (un jeu) --événements--> gameboard (agrège) --événements--> menus des jeux et salon
//
// Aucune interrogation : gameboard s'abonne au flux `GET /api/events` de chaque instance swordfish, garde l'état de tous les jeux,
// le fusionne avec son catalogue (games.json) et le pousse tout de suite à ceux qui le regardent. Comptes seulement, jamais de prénom.

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- 1. une instance swordfish : son flux d'événements, avec reconnexion ----

// Lit un flux « server-sent events » : appelle onEvent({ event, data }) pour chaque bloc, rend la main quand le flux se ferme.
async function readEvents(body, onEvent) {
  const dec = new TextDecoder();
  let buf = '';
  for await (const chunk of body) {
    buf += dec.decode(chunk, { stream: true });
    let i;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const block = buf.slice(0, i); buf = buf.slice(i + 2);
      const data = block.split('\n').find((l) => l.startsWith('data: '));
      if (data) { try { onEvent(JSON.parse(data.slice(6))); } catch { /* bloc illisible : ignoré */ } }
    }
  }
}

// url : base de l'instance (http://swordfish:3000/jeux/swordfish). L'état reste celui du dernier événement ; `online` tombe à false quand le flux se coupe.
export function createInstanceFeed({ url, fetchImpl = fetch, onChange = () => {}, retryMs = 1000, maxRetryMs = 10_000, silenceMs = 45_000 } = {}) {
  const state = { url, online: false, server: null, games: new Map(), seq: -1 };
  let closed = false;
  let ctrl = null;

  const apply = (ev) => {
    if (ev.type === 'snapshot') { state.games = new Map(ev.games.map((g) => [g.id, g])); state.server = ev.server; state.seq = ev.seq; }
    else if (state.seq < 0) return; // pas d'état de départ : on attend le snapshot
    else if (ev.seq !== state.seq + 1) { ctrl?.abort(); return; } // un trou : on se reconnecte pour repartir d'un état complet
    else {
      state.seq = ev.seq;
      if (ev.type === 'game') state.games.set(ev.game.id, ev.game);
      else if (ev.type === 'game-removed') state.games.delete(ev.id);
      else if (ev.type === 'server') state.server = ev.server;
    }
    state.online = true;
    onChange(state);
  };

  async function run() {
    let delay = retryMs;
    while (!closed) {
      ctrl = new AbortController();
      let silence = null;
      const rearm = () => { clearTimeout(silence); silence = setTimeout(() => ctrl.abort(), silenceMs); silence.unref?.(); }; // flux muet (le serveur envoie un battement toutes les 15 s)
      try {
        const res = await fetchImpl(`${url}/api/events`, { headers: { accept: 'text/event-stream', 'x-forwarded-proto': 'https' }, signal: ctrl.signal });
        if (!res.ok) throw new Error(`swordfish ${res.status}`);
        delay = retryMs;
        rearm();
        state.seq = -1;
        await readEvents(res.body, (ev) => { rearm(); apply(ev); });
      } catch { /* coupé ou injoignable : on réessaie */ }
      clearTimeout(silence);
      if (closed) break;
      if (state.online) { state.online = false; onChange(state); }
      await wait(delay);
      delay = Math.min(maxRetryMs, delay * 2);
    }
  }
  run();
  return { state, close() { closed = true; ctrl?.abort(); } };
}

// ---- 2. toutes les instances ----

// urls : une instance par jeu (SWORDFISH_URLS), ou une seule pour tous les jeux (SWORDFISH_URL).
export function createFeeds({ urls = [], fetchImpl, onChange = () => {}, retryMs, maxRetryMs, silenceMs } = {}) {
  const feeds = urls.map((url) => createInstanceFeed({ url, fetchImpl, onChange, retryMs, maxRetryMs, silenceMs }));
  return {
    instances: () => feeds.map((f) => f.state),
    close: () => feeds.forEach((f) => f.close()),
  };
}

// ---- 3. fusion avec le catalogue ----

// catalog : games.json ; instances : les états des instances. Les jeux multi du catalogue (prêts) ; un jeu sans instance, ou dont l'instance ne répond pas, est hors ligne.
export function multiState(catalog, instances) {
  const online = instances.filter((i) => i.online);
  const byGame = new Map();
  for (const inst of online) for (const [id, g] of inst.games) byGame.set(id, { game: g, server: inst.server });
  const games = catalog.filter((g) => g.multi && g.ready).map((g) => {
    const found = byGame.get(g.id);
    const rooms = (found?.game.rooms ?? []).filter((r) => (r.players ?? 0) > 0); // les parties où l'on joue ; une salle libre permanente, vide, n'en est pas une
    const joinable = (found?.game.rooms ?? []).filter((r) => r.joinable).length; // mais on peut la rejoindre
    const status = !found || !found.game.online ? 'offline' : found.server?.status === 'draining' ? 'draining' : 'online';
    return {
      id: g.id, title: g.title, icon: g.icon, color: g.color ?? null, url: g.url ?? null,
      status, online: status === 'online',
      rooms: rooms.length,
      players: rooms.reduce((n, r) => n + (r.players ?? 0), 0),
      joinable: status === 'online' ? joinable : 0,
      max: (found?.game.rooms ?? []).find((r) => r.max)?.max ?? null,
      version: found?.server?.version ?? null,
      lobby: `/multi/?game=${encodeURIComponent(g.id)}`,
    };
  });
  const sum = (key) => games.reduce((n, g) => n + g[key], 0);
  return {
    server: { online: online.length > 0, instances: instances.length, instancesOnline: online.length, players: sum('players'), rooms: sum('rooms') },
    games,
  };
}

// ---- 4. le flux vers les menus ----

// Un événement au format « server-sent events » (même vocabulaire que swordfish : snapshot, game, server).
export const sse = (ev) => `event: ${ev.type}\nid: ${ev.seq}\ndata: ${JSON.stringify(ev)}\n\n`;

// getCatalog() : le catalogue à jour ; instances() : l'état des instances. touch() à chaque changement d'une instance.
export function createMultiBus({ getCatalog, instances, coalesceMs = 40 } = {}) {
  const subs = new Set();
  let seq = 0, timer = null, prevGames = new Map(), prevServer = '';
  const compute = () => multiState(getCatalog(), instances());
  const emit = (ev) => { for (const fn of [...subs]) { try { fn(ev); } catch { subs.delete(fn); } } };

  function flush() {
    timer = null;
    const state = compute();
    for (const g of state.games) {
      const sig = JSON.stringify(g);
      if (prevGames.get(g.id) !== sig) { prevGames.set(g.id, sig); emit({ type: 'game', seq: ++seq, game: g }); }
    }
    const sig = JSON.stringify(state.server);
    if (sig !== prevServer) { prevServer = sig; emit({ type: 'server', seq: ++seq, server: state.server }); }
  }
  const touch = () => { if (!timer) { timer = setTimeout(flush, coalesceMs); timer.unref?.(); } };
  const snapshot = () => { const s = compute(); return { type: 'snapshot', seq, server: s.server, games: s.games }; };
  { const s = compute(); s.games.forEach((g) => prevGames.set(g.id, JSON.stringify(g))); prevServer = JSON.stringify(s.server); }

  return {
    touch, flush, snapshot,
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    get subscribers() { return subs.size; },
    close() { clearTimeout(timer); subs.clear(); },
  };
}
