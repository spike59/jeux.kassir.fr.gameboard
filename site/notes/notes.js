// Page /notes/ : la frise des notes de version (releases.json, rassemblé par devops/collect-releases.mjs).
// Une frise du temps : une colonne par jour (la plus récente à droite), les notes d'un jour s'empilent, un filtre choisit les jeux.
// Les positions passent par element.style (la CSP interdit les attributs style).
const COLORS = ['#ffb454', '#5cc8ff', '#ff7a9c', '#7be08f', '#c59bff', '#ffd95c', '#ff9a5c', '#6fe0d0'];
const fresco = document.querySelector('#fresco');
const reader = document.querySelector('#reader');

function h(tag, props = {}, ...kids) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...kids.flat().filter((k) => k != null));
  return node;
}

// **gras** et `code` ; tout le reste reste du texte (jamais de HTML venu du fichier)
function inline(text) {
  const out = [];
  for (const part of text.split(/(\*\*[^*]+\*\*|`[^`]+`)/)) {
    if (part.startsWith('**') && part.length > 4) out.push(h('strong', { textContent: part.slice(2, -2) }));
    else if (part.startsWith('`') && part.length > 2) out.push(h('code', { textContent: part.slice(1, -1) }));
    else if (part) out.push(part);
  }
  return out;
}

function markdown(text) {
  const root = h('div');
  let list = null;
  for (const line of text.split('\n')) {
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    const head = /^(#{2,4})\s+(.*)$/.exec(line);
    if (bullet) {
      if (!list) root.append((list = h('ul')));
      list.append(h('li', {}, inline(bullet[1])));
      continue;
    }
    if (!line.trim()) { list = null; continue; }
    if (/^\s+\S/.test(line) && list?.lastChild) { list.lastChild.append(' ', ...inline(line.trim())); continue; }
    list = null;
    root.append(head ? h(head[1].length < 4 ? 'h3' : 'h4', {}, inline(head[2])) : h('p', {}, inline(line)));
  }
  return root;
}

const fmtDate = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
const byVersion = (a, b) => a.date.localeCompare(b.date) || a.version.localeCompare(b.version, undefined, { numeric: true });

function open(project, rel, color) {
  document.querySelector('#reader-meta').textContent = `${project.icon} ${project.title} · ${rel.date ? fmtDate(rel.date) : 'prochaine version'}`;
  document.querySelector('#reader-title').textContent = `v${rel.version}${rel.title ? ` — ${rel.title}` : ''}`;
  document.querySelector('#reader-body').replaceChildren(markdown(rel.body));
  document.querySelector('.sheet').style.borderTop = `3px solid ${color}`;
  reader.hidden = false;
  document.querySelector('.close').focus();
}
const close = () => { reader.hidden = true; };
reader.addEventListener('click', (e) => { if (e.target === reader) close(); });
document.querySelector('.close').addEventListener('click', close);
addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

// --- la frise : le temps passe de gauche à droite (une colonne par jour, un trait fin par jour, un trait épais par mois) ;
// les mises à jour d'un jour s'empilent dans sa colonne, serrées quand il y en a beaucoup.
const PACK_FROM = 5; // à partir de ce nombre de notes un même jour, les cartes se resserrent sur une ligne
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const WEEKDAYS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const utc = (d) => { const [y, m, j] = d.split('-').map(Number); return Date.UTC(y, m - 1, j); };

let data = null;
let hidden = new Set(JSON.parse(localStorage.getItem('notes-hidden') || '[]')); // jeux décochés dans le filtre

function build() {
  const projects = data.projects.filter((p) => p.releases.length);
  if (!projects.length) { fresco.replaceChildren(h('p', { className: 'loading', textContent: 'Aucune note de version pour l\'instant.' })); return; }
  const color = new Map(projects.map((p, i) => [p.code, COLORS[i % COLORS.length]]));

  // l'axe du temps couvre toujours toutes les notes : filtrer ne déplace rien
  const dates = projects.flatMap((p) => p.releases.map((r) => r.date)).sort();
  const first = utc(dates[0]);
  const last = utc(dates.at(-1));
  const byDay = new Map();
  for (const p of projects) {
    if (hidden.has(p.code)) continue;
    for (const rel of p.releases) {
      if (!byDay.has(rel.date)) byDay.set(rel.date, []);
      byDay.get(rel.date).push({ p, rel });
    }
  }

  const grid = h('div', { className: 'grid' });
  const days = [];
  for (let t = first; t <= last; t += 86400000) days.push(iso(t));
  grid.style.gridTemplateColumns = days.map((d) => (byDay.has(d) ? 'var(--col)' : 'var(--gap)')).join(' ');

  // en-têtes : le mois (collé en haut), puis le jour
  days.forEach((d, i) => {
    const [y, m, j] = d.split('-').map(Number);
    const startsMonth = j === 1 || i === 0;
    if (startsMonth) {
      let end = i + 1;
      while (end < days.length && !days[end].endsWith('-01')) end++;
      const label = h('div', { className: 'month', textContent: `${MONTHS[m - 1]} ${y}` });
      label.style.gridArea = `1 / ${i + 1} / 2 / ${end + 1}`;
      if (j === 1) label.classList.add('first');
      grid.append(label);
    }
    const busy = byDay.has(d);
    const dow = new Date(utc(d)).getUTCDay();
    const head = h('div', { className: `day${busy ? ' busy' : ''}${dow === 0 || dow === 6 ? ' weekend' : ''}${j === 1 ? ' first' : ''}` },
      busy ? h('small', { textContent: WEEKDAYS[dow] }) : null, String(j));
    head.style.gridArea = `2 / ${i + 1}`;
    grid.append(head);

    // la colonne du jour : sa ligne verticale en fond, et ses cartes empilées
    const items = (byDay.get(d) ?? []).sort((a, b) => projects.indexOf(a.p) - projects.indexOf(b.p) || a.rel.version.localeCompare(b.rel.version, undefined, { numeric: true }));
    const column = h('div', { className: `slot${j === 1 ? ' first' : ''}${dow === 0 || dow === 6 ? ' weekend' : ''}${items.length >= PACK_FROM ? ' packed' : ''}` });
    column.style.gridArea = `3 / ${i + 1}`;
    for (const { p, rel } of items) {
      const c = color.get(p.code);
      const card = h('button', { type: 'button', className: 'card', title: `${p.title} v${rel.version}${rel.title ? ` — ${rel.title}` : ''}` },
        h('span', { className: 'v' }, h('span', { className: 'ico', textContent: p.icon }), ` v${rel.version}`, h('span', { className: 'who', textContent: p.title })),
        h('span', { className: 't', textContent: rel.title || 'Voir les notes' }));
      card.style.setProperty('--c', c);
      card.addEventListener('click', () => open(p, rel, c));
      column.append(card);
    }
    grid.append(column);
  });

  // À venir : seulement si les données le fournissent (application roadmap, locale ; jamais le portail public).
  // Une colonne après le dernier jour, une carte par projet : sa prochaine version et ses points.
  const soon = projects.filter((p) => p.upcoming && !hidden.has(p.code));
  if (soon.length) {
    const n = days.length + 1;
    grid.style.gridTemplateColumns += ' var(--col)';
    const label = h('div', { className: 'month first', textContent: 'À venir' });
    label.style.gridArea = `1 / ${n} / 2 / ${n + 1}`;
    const head = h('div', { className: 'day busy first', textContent: '→' });
    head.style.gridArea = `2 / ${n}`;
    const column = h('div', { className: `slot first${soon.length >= PACK_FROM ? ' packed' : ''}` });
    column.style.gridArea = `3 / ${n}`;
    for (const p of soon) {
      const c = color.get(p.code);
      const next = { version: p.upcoming.version, date: '', title: p.upcoming.title, body: p.upcoming.items.map((i) => `- ${i}`).join('\n') };
      const card = h('button', { type: 'button', className: 'card soon', title: `${p.title} v${next.version} (prochaine)${next.title ? ` — ${next.title}` : ''}` },
        h('span', { className: 'v' }, h('span', { className: 'ico', textContent: p.icon }), ` v${next.version}`, h('span', { className: 'who', textContent: p.title })),
        h('span', { className: 't', textContent: next.title || 'Voir les points' }));
      card.style.setProperty('--c', c);
      card.addEventListener('click', () => open(p, next, c));
      column.append(card);
    }
    grid.append(label, head, column);
  }

  const keepLeft = fresco.scrollLeft;
  const keepTop = fresco.scrollTop;
  const fresh = !fresco.querySelector('.grid');
  const z = fresco.querySelector('.grid')?.style.getPropertyValue('--z');
  if (z) grid.style.setProperty('--z', z);
  fresco.replaceChildren(grid);
  if (fresh) fresco.scrollLeft = fresco.scrollWidth; // on arrive sur les nouveautés
  else { fresco.scrollLeft = keepLeft; fresco.scrollTop = keepTop; }
  paintFilter(projects, color);
}

// --- filtre : un bouton qui ouvre la liste des jeux à cocher / décocher
const filterBtn = document.querySelector('#filter');
const filterMenu = document.querySelector('#filter-menu');

function paintFilter(projects, color) {
  const shown = projects.filter((p) => !hidden.has(p.code)).length;
  // le portail public ne montre que des jeux ; l'application roadmap (locale) montre aussi les outils et propose « Les jeux »
  const GAME = (p) => !p.kind || p.kind.startsWith('game');
  const mixed = projects.some((p) => !GAME(p));
  filterBtn.textContent = `⚙ ${mixed ? 'Projets' : 'Jeux'} ${shown}/${projects.length}`;
  filterBtn.classList.toggle('active', shown !== projects.length);
  const count = (p) => p.releases.length;
  const rows = projects.map((p) => {
    const box = h('input', { type: 'checkbox', checked: !hidden.has(p.code) });
    box.addEventListener('change', () => {
      if (box.checked) hidden.delete(p.code); else hidden.add(p.code);
      save();
    });
    const row = h('label', { className: 'opt' }, box, h('span', { className: 'ico', textContent: p.icon }), h('span', { className: 'name', textContent: p.title }), h('span', { className: 'n', textContent: String(count(p)) }));
    row.style.setProperty('--c', color.get(p.code));
    return row;
  });
  const all = h('button', { type: 'button', textContent: 'Tout' });
  const none = h('button', { type: 'button', textContent: 'Aucun' });
  all.addEventListener('click', () => { hidden = new Set(); save(); });
  none.addEventListener('click', () => { hidden = new Set(projects.map((p) => p.code)); save(); });
  const games = h('button', { type: 'button', textContent: 'Les jeux' });
  games.addEventListener('click', () => { hidden = new Set(projects.filter((p) => !GAME(p)).map((p) => p.code)); save(); });
  filterMenu.replaceChildren(h('div', { className: 'bulk' }, all, none, mixed ? games : null), ...rows);
}
function save() {
  localStorage.setItem('notes-hidden', JSON.stringify([...hidden]));
  build();
}
filterBtn.addEventListener('click', () => { filterMenu.hidden = !filterMenu.hidden; filterBtn.setAttribute('aria-expanded', String(!filterMenu.hidden)); });
document.addEventListener('pointerdown', (e) => { if (!filterMenu.hidden && !filterMenu.contains(e.target) && e.target !== filterBtn) { filterMenu.hidden = true; filterBtn.setAttribute('aria-expanded', 'false'); } });
addEventListener('keydown', (e) => { if (e.key === 'Escape' && !filterMenu.hidden) { filterMenu.hidden = true; filterBtn.setAttribute('aria-expanded', 'false'); } });

try {
  const res = await fetch('/releases.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error(res.status);
  data = await res.json();
  build();
} catch {
  fresco.replaceChildren(h('p', { className: 'loading', textContent: 'Impossible de charger les notes de version.' }));
}

// --- déplacement et zoom : on attrape la frise (souris, stylet ou doigt) et on la glisse dans tous les sens, avec un peu d'élan ;
// à deux doigts, on pince pour zoomer (le point entre les doigts reste en place). Molette + Ctrl (ou pincement du pavé tactile) : zoom aussi.
const Z_MIN = 0.4;
const Z_MAX = 2.5;
let zoom = 1;
const gridEl = () => fresco.querySelector('.grid');

// Zoom autour d'un point de l'écran (cx, cy, en pixels dans la frise) : le contenu sous ce point ne bouge pas.
function setZoom(next, cx = fresco.clientWidth / 2, cy = fresco.clientHeight / 2) {
  const grid = gridEl();
  if (!grid) return;
  next = Math.min(Z_MAX, Math.max(Z_MIN, next));
  const ratio = next / zoom;
  const x = fresco.scrollLeft + cx;
  const y = fresco.scrollTop + cy;
  zoom = next;
  grid.style.setProperty('--z', zoom);
  fresco.scrollLeft = x * ratio - cx;
  fresco.scrollTop = y * ratio - cy;
}
document.querySelector('#zin').addEventListener('click', () => setZoom(zoom * 1.25));
document.querySelector('#zout').addEventListener('click', () => setZoom(zoom / 1.25));
fresco.addEventListener('wheel', (e) => {
  const r = fresco.getBoundingClientRect();
  if (e.ctrlKey) { e.preventDefault(); setZoom(zoom * Math.exp(-e.deltaY * 0.01), e.clientX - r.left, e.clientY - r.top); } // pincement du pavé tactile
  else if (e.shiftKey && !e.deltaX) { e.preventDefault(); fresco.scrollLeft += e.deltaY; } // Maj + molette : horizontal
}, { passive: false });

{
  const THRESHOLD = 4; // en dessous, c'est un clic sur une carte
  const pointers = new Map(); // id -> { x, y }
  let drag = null; // un pointeur : { id, x, y, moved, vx, vy, lx, ly, t }
  let pinch = null; // deux pointeurs : { dist, zoom }
  let glide = 0;
  const point = (e) => ({ x: e.clientX, y: e.clientY });
  const two = () => [...pointers.values()];

  fresco.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    cancelAnimationFrame(glide);
    pointers.set(e.pointerId, point(e));
    if (pointers.size === 1) {
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, left: fresco.scrollLeft, top: fresco.scrollTop, moved: false, vx: 0, vy: 0, lx: e.clientX, ly: e.clientY, t: performance.now() };
    } else if (pointers.size === 2) {
      const [a, b] = two();
      pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, zoom, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
      drag = null;
      fresco.classList.add('dragging');
    }
  });

  fresco.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, point(e));
    const r = fresco.getBoundingClientRect();
    if (pinch && pointers.size >= 2) {
      const [a, b] = two();
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      setZoom(pinch.zoom * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.dist), cx - r.left, cy - r.top);
      fresco.scrollLeft -= cx - pinch.cx; // les deux doigts déplacent aussi la frise
      fresco.scrollTop -= cy - pinch.cy;
      pinch.cx = cx;
      pinch.cy = cy;
      return;
    }
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.moved) {
      if (Math.hypot(dx, dy) < THRESHOLD) return;
      drag.moved = true;
      fresco.setPointerCapture(e.pointerId);
      fresco.classList.add('dragging');
    }
    const now = performance.now();
    const dt = Math.max(1, now - drag.t);
    drag.vx = (e.clientX - drag.lx) / dt; // pixels par milliseconde
    drag.vy = (e.clientY - drag.ly) / dt;
    drag.lx = e.clientX;
    drag.ly = e.clientY;
    drag.t = now;
    fresco.scrollLeft = drag.left - dx;
    fresco.scrollTop = drag.top - dy;
  });

  const end = (e) => {
    if (!pointers.delete(e.pointerId)) return;
    if (pinch) {
      // un doigt reste posé : il reprend la main comme un glissement tout neuf
      if (pointers.size < 2) {
        pinch = null;
        const [rest] = two();
        drag = rest ? { id: [...pointers.keys()][0], x: rest.x, y: rest.y, left: fresco.scrollLeft, top: fresco.scrollTop, moved: true, vx: 0, vy: 0, lx: rest.x, ly: rest.y, t: performance.now() } : null;
        if (!rest) fresco.classList.remove('dragging');
      }
      return;
    }
    if (!drag || e.pointerId !== drag.id) return;
    const { moved, vx, vy, t } = drag;
    drag = null;
    fresco.classList.remove('dragging');
    if (!moved || performance.now() - t > 120) return; // arrêté avant de relâcher : pas d'élan
    let sx = vx * 16; // pixels par image, qui ralentissent
    let sy = vy * 16;
    const step = () => {
      if (Math.abs(sx) < 0.5 && Math.abs(sy) < 0.5) return;
      fresco.scrollLeft -= sx;
      fresco.scrollTop -= sy;
      sx *= 0.94;
      sy *= 0.94;
      glide = requestAnimationFrame(step);
    };
    glide = requestAnimationFrame(step);
  };
  fresco.addEventListener('pointerup', end);
  fresco.addEventListener('pointercancel', end);
}

// --- plein écran (absent des iPhone : le bouton reste caché quand le navigateur ne sait pas le faire)
{
  const button = document.querySelector('#fs');
  const root = document.documentElement;
  const request = root.requestFullscreen || root.webkitRequestFullscreen;
  if (request) {
    button.hidden = false;
    const current = () => document.fullscreenElement || document.webkitFullscreenElement;
    button.addEventListener('click', () => {
      if (current()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else request.call(root);
    });
    const paint = () => { const on = !!current(); button.textContent = on ? '✕' : '⛶'; button.title = on ? 'Quitter le plein écran' : 'Plein écran'; button.setAttribute('aria-label', button.title); };
    document.addEventListener('fullscreenchange', paint);
    document.addEventListener('webkitfullscreenchange', paint);
  }
}
