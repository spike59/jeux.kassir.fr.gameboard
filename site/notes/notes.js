// Page /notes/ : la frise des notes de version (releases.json, rassemblé par devops/collect-releases.mjs).
// Une ligne par projet, une colonne par version ; la plus récente à droite. Les positions passent par element.style (la CSP interdit les attributs style).
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
  document.querySelector('#reader-meta').textContent = `${project.icon} ${project.title} · ${fmtDate(rel.date)}`;
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

function build(data) {
  const projects = data.projects.filter((p) => p.releases.length);
  if (!projects.length) { fresco.replaceChildren(h('p', { className: 'loading', textContent: 'Aucune note de version pour l\'instant.' })); return; }

  // colonnes : une par date, aussi large que le plus grand nombre de versions d'un projet ce jour-là
  const dates = [...new Set(projects.flatMap((p) => p.releases.map((r) => r.date)))].sort();
  const start = new Map();
  let col = 2; // la colonne 1 porte les noms des projets
  for (const d of dates) {
    const width = Math.max(...projects.map((p) => p.releases.filter((r) => r.date === d).length));
    start.set(d, [col, width]);
    col += width;
  }

  const grid = h('div', { className: 'grid' });
  grid.style.gridTemplateColumns = `var(--lane) repeat(${col - 2}, var(--col))`;
  const corner = h('div', { className: 'corner' });
  corner.style.gridArea = '1 / 1';
  grid.append(corner);
  for (const [d, [c, w]] of start) {
    const cell = h('div', { className: 'date', textContent: fmtDate(d) });
    cell.style.gridArea = `1 / ${c} / 2 / ${c + w}`;
    grid.append(cell);
  }

  projects.forEach((p, i) => {
    const row = i + 2;
    const color = COLORS[i % COLORS.length];
    const lane = h('div', { className: 'lane' }, h('span', { className: 'ico', textContent: p.icon }), h('span', { textContent: p.title }));
    lane.style.gridArea = `${row} / 1`;
    grid.append(lane);
    const seen = new Map();
    for (const rel of p.releases.slice().sort(byVersion)) {
      const n = seen.get(rel.date) ?? 0;
      seen.set(rel.date, n + 1);
      const card = h('button', { type: 'button', className: 'card', title: rel.title },
        h('span', { className: 'v', textContent: `v${rel.version}` }),
        h('span', { className: 't', textContent: rel.title || 'Voir les notes' }));
      card.style.gridArea = `${row} / ${start.get(rel.date)[0] + n}`;
      card.style.setProperty('--c', color);
      card.addEventListener('click', () => open(p, rel, color));
      grid.append(card);
    }
  });

  fresco.replaceChildren(grid);
  fresco.scrollLeft = fresco.scrollWidth; // on arrive sur les nouveautés
}

try {
  const res = await fetch('/releases.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error(res.status);
  build(await res.json());
} catch {
  fresco.replaceChildren(h('p', { className: 'loading', textContent: 'Impossible de charger les notes de version.' }));
}
