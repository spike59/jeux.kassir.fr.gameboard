import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkGame, checkAll } from '../src/check-multi.js';

async function jeu(root, id, { manifest = { modes: ['solo', 'online-server'], server: 'swordfish:0.3.0' }, page = null, scripts = {} } = {}) {
  const dir = join(root, id);
  await mkdir(dir, { recursive: true });
  if (manifest) await writeFile(join(dir, 'game.json'), JSON.stringify(manifest));
  if (page != null) await writeFile(join(dir, 'index.html'), page);
  for (const [name, text] of Object.entries(scripts)) await writeFile(join(dir, name), text);
  return dir;
}
const page = (script) => `<html><body><script type="module" src="${script}"></script></body></html>`;

test('un jeu conforme : modes, serveur, et entrée montée pour lui dans le script de sa page', async () => {
  const root = await mkdtemp(join(tmpdir(), 'check-multi-'));
  try {
    const dir = await jeu(root, 'bulles', { page: page('bulles.js'), scripts: { 'bulles.js': "import { mountMultiEntry } from '/lib/multi-entry.js';\nmountMultiEntry(document.getElementById('menu'), { game: 'bulles' });" } });
    assert.deepEqual(checkGame('bulles', dir), []);
    const direct = await jeu(root, 'direct', { page: `<script type="module">import { mountMultiEntry } from '/lib/multi-entry.js'; mountMultiEntry(a, { game: "direct", existing: true });</script>` });
    assert.deepEqual(checkGame('direct', direct), []);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('problèmes relevés : manifeste, script absent, entrée non montée, mauvais jeu', async () => {
  const root = await mkdtemp(join(tmpdir(), 'check-multi-'));
  try {
    const sans = await jeu(root, 'sans', { manifest: null, page: page('x.js'), scripts: { 'x.js': '// rien' } });
    const p = checkGame('sans', sans);
    assert.ok(p.includes('game.json absent'));
    assert.ok(p.includes('la page ne charge pas /lib/multi-entry.js'));
    assert.ok(p.some((x) => x.includes('mountMultiEntry')));
    const solo = await jeu(root, 'solo', { manifest: { modes: ['solo'] }, page: page('x.js'), scripts: { 'x.js': "import '/lib/multi-entry.js'; mountMultiEntry(a, { game: 'solo' });" } });
    const ps = checkGame('solo', solo);
    assert.ok(ps.includes('game.json : aucun mode en réseau dans « modes »'));
    assert.ok(ps.includes('game.json : « server » manquant'));
    const autre = await jeu(root, 'a', { page: `<script type="module">import '/lib/multi-entry.js'; mountMultiEntry(m, { game: 'b' });</script>` });
    assert.ok(checkGame('a', autre).some((x) => x.includes('et non pour « a »')));
    const nopage = await jeu(root, 'np', {});
    assert.ok(checkGame('np', nopage).some((x) => x.includes('introuvable')));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('checkAll : seulement les jeux multi prêts ; dossier absent signalé', async () => {
  const root = await mkdtemp(join(tmpdir(), 'check-multi-'));
  try {
    await jeu(root, 'ok', { page: `<script type="module">import '/lib/multi-entry.js'; mountMultiEntry(m, { game: 'ok' });</script>` });
    const r = checkAll([{ id: 'ok', multi: true, ready: true }, { id: 'absent', multi: true, ready: true }, { id: 'solo', ready: true }, { id: 'bientot', multi: true, ready: false }], root);
    assert.deepEqual(r.map((x) => [x.id, x.problems.length]), [['ok', 0], ['absent', 1]]);
  } finally { await rm(root, { recursive: true, force: true }); }
});
