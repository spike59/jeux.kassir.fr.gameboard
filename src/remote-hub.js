// Le hub des jeux à plusieurs vit dans swordfish (le serveur de jeux multi standard) : gameboard n'en garde que la LECTURE
// (le realm /api/v1/realm et l'état du parc /api/parc/live, avec les prénoms de la page publique du parc). L'état du multijoueur des menus, lui,
// n'est plus lu ici : il arrive en événements (src/multi.js). Ce relais ne travaille que tant que quelqu'un regarde le parc (idleMs).
export function createRemoteHub({ baseUrl, fetchImpl = fetch, everyMs = 2000, timeoutMs = 2000, idleMs = 30_000 } = {}) {
  let asked = 0; // dernière fois que quelqu'un a lu le parc : sans lecteur, on n'interroge pas swordfish
  let info = { id: 'swordfish', name: 'Swordfish', players: 0, rooms: 0, games: [], online: false };
  let parc = { t: 0, rides: [], salon: [], online: false };
  const get = async (path) => {
    const res = await fetchImpl(`${baseUrl}${path}`, { headers: { 'x-forwarded-proto': 'https' }, signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) throw new Error(`swordfish ${res.status}`);
    return res.json();
  };
  async function poll() {
    try { [info, parc] = (await Promise.all([get('/api/hub/info'), get('/api/hub/parc')])).map((x) => ({ ...x, online: true })); }
    catch { info = { ...info, online: false }; parc = { ...parc, online: false }; }
  }
  const timer = baseUrl ? setInterval(() => { if (Date.now() - asked < idleMs) poll(); }, everyMs) : null;
  timer?.unref();
  const ask = () => { if (baseUrl && Date.now() - asked >= idleMs) poll(); asked = Date.now(); }; // premier lecteur : on lit tout de suite
  return { info: () => { ask(); return info; }, parc: () => { ask(); return parc; }, poll, close: () => clearInterval(timer) };
}
