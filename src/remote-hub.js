// Le hub des jeux à plusieurs vit dans swordfish (le serveur de jeux multi standard) : gameboard n'en garde que la LECTURE
// (le realm /api/v1/realm et l'état du parc /api/parc/live), copiée toutes les 2 s depuis l'adresse interne de swordfish.
export function createRemoteHub({ baseUrl, fetchImpl = fetch, everyMs = 2000, timeoutMs = 2000 } = {}) {
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
  const timer = baseUrl ? setInterval(poll, everyMs) : null;
  timer?.unref();
  if (baseUrl) poll();
  return { info: () => info, parc: () => parc, poll, close: () => clearInterval(timer) };
}
