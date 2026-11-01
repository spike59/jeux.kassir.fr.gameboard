// Scène 3D du menu (Babylon.js) : les vignettes des jeux tournent tout autour de nous.
//   « ring »     carrousel : la caméra est au centre d'un anneau de cartes, on fait tourner l'anneau
//   « grid »     vignettes : les cartes quittent l'anneau et se rangent en mur devant nous
//   « backdrop » décor du tableau des scores : l'anneau tourne tout seul, sans interaction
// Imports ciblés (pas tout @babylonjs/core) : la page d'accueil reste légère sur téléphone.
import { Engine } from '@babylonjs/core/Engines/engine';
import { Constants } from '@babylonjs/core/Engines/constants';
import { Scene } from '@babylonjs/core/scene';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { CreatePlane } from '@babylonjs/core/Meshes/Builders/planeBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { CreateDisc } from '@babylonjs/core/Meshes/Builders/discBuilder';
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder';
import { CreateIcoSphere } from '@babylonjs/core/Meshes/Builders/icoSphereBuilder';
import '@babylonjs/core/Culling/ray'; // scene.pick
import { CARD_W, CARD_H, drawCard, loadImage } from './cardArt.js';

const CARD = { w: 1.6, h: 1.6 * (CARD_H / CARD_W) };
const GAP = 1.3;          // espace entre deux cartes de l'anneau (en largeurs de carte)
const MIN_SLOTS = 12;     // au moins 12 places sur l'anneau : avec peu de jeux, ils sont répétés
const FOCUS_SCALE = 1.14; // la carte de devant est un peu plus grande
const CAM_Y = 0;
const GRID_DIST = 6;
const BG = '#120c2e';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const damp = (from, to, speed, dt) => lerp(from, to, 1 - Math.exp(-speed * dt));

// hasard reproductible : le décor est le même à chaque visite
function seeded(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

function canvasTexture(name, width, height, scene, draw) {
  const tex = new DynamicTexture(name, { width, height }, scene, true);
  draw(tex.getContext(), width, height);
  tex.update();
  return tex;
}

function flatMaterial(name, scene, { texture, opacity, color = Color3.White(), alpha = 1, add = false } = {}) {
  const mat = new StandardMaterial(name, scene);
  mat.disableLighting = true;
  mat.diffuseColor = Color3.Black();
  mat.emissiveColor = color.clone(); // sans éclairage, seule la couleur émissive compte
  if (texture) mat.diffuseTexture = texture; // sans éclairage : couleur finale = émissive × texture diffuse
  if (opacity) mat.opacityTexture = opacity;
  mat.alpha = alpha;
  if (add) mat.alphaMode = Constants.ALPHA_ADD;
  mat.specularColor = Color3.Black();
  return mat;
}

function buildDecor(scene) {
  const decor = new TransformNode('decor', scene);

  // ciel : dégradé violet et étoiles
  const sky = CreateSphere('sky', { diameter: 120, segments: 24, sideOrientation: 1 }, scene);
  const skyTex = canvasTexture('skyTex', 2048, 1024, scene, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#05030f');
    g.addColorStop(0.3, '#1e1260');
    g.addColorStop(0.5, '#5b3cc4');
    g.addColorStop(0.56, '#c04fb0');
    g.addColorStop(0.62, '#1b1145');
    g.addColorStop(1, '#07051a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const rnd = seeded(7);
    for (let i = 0; i < 260; i++) {
      const x = rnd() * w;
      const y = rnd() * h * 0.5;
      const r = rnd() < 0.1 ? 5 : 2 + rnd() * 1.5;
      const star = ctx.createRadialGradient(x, y, 0, x, y, r * 2);
      star.addColorStop(0, rnd() < 0.2 ? 'rgb(255 217 244 / 1)' : 'rgb(255 255 255 / 1)');
      star.addColorStop(0.35, 'rgb(255 255 255 / .55)');
      star.addColorStop(1, 'rgb(255 255 255 / 0)');
      ctx.globalAlpha = 0.35 + rnd() * 0.65;
      ctx.fillStyle = star;
      ctx.fillRect(x - r * 2, y - r * 2, r * 4, r * 4);
    }
    ctx.globalAlpha = 1;
  });
  sky.material = flatMaterial('skyMat', scene, { texture: skyTex });
  sky.material.backFaceCulling = false;
  sky.isPickable = false;
  sky.parent = decor;

  // sol : halo lumineux et cercles concentriques
  const floorTex = canvasTexture('floorTex', 1024, 1024, scene, (ctx, w) => {
    const c = w / 2;
    const glow = ctx.createRadialGradient(c, c, 0, c, c, c);
    glow.addColorStop(0, 'rgb(150 110 255 / .55)');
    glow.addColorStop(0.35, 'rgb(110 60 220 / .25)');
    glow.addColorStop(1, 'rgb(40 20 100 / 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, w);
    ctx.strokeStyle = 'rgb(200 170 255 / .35)';
    for (let r = 40; r < c; r += 40) {
      ctx.lineWidth = r % 120 === 0 ? 3 : 1.2;
      ctx.globalAlpha = 1 - r / c;
      ctx.beginPath();
      ctx.arc(c, c, r, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });
  const floor = CreateDisc('floor', { radius: 22, tessellation: 64 }, scene);
  floor.rotation.x = Math.PI / 2;
  floor.material = flatMaterial('floorMat', scene, { texture: floorTex, opacity: floorTex });
  floor.material.backFaceCulling = false;
  floor.isPickable = false;

  // formes qui flottent autour de l'anneau
  const light = new HemisphericLight('light', new Vector3(0.3, 1, -0.2), scene);
  light.intensity = 1.05;
  light.groundColor = Color3.FromHexString('#3a2290');
  const palette = ['#ff6fb5', '#ffd23f', '#3ee0c5', '#6fa8ff', '#b27bff', '#ff8a4c'];
  const rnd = seeded(42);
  const floaters = [];
  for (let i = 0; i < 18; i++) {
    const kind = i % 3;
    const size = 0.35 + rnd() * 0.6;
    const mesh = kind === 0
      ? CreateTorus(`f${i}`, { diameter: size * 1.6, thickness: size * 0.45, tessellation: 24 }, scene)
      : CreateIcoSphere(`f${i}`, { radius: size, subdivisions: kind === 1 ? 1 : 3, flat: kind === 1 }, scene);
    const mat = new StandardMaterial(`fm${i}`, scene);
    const color = Color3.FromHexString(palette[i % palette.length]);
    mat.diffuseColor = color;
    mat.emissiveColor = color.scale(0.35);
    mat.specularColor = new Color3(0.6, 0.6, 0.6);
    mat.specularPower = 32;
    mesh.material = mat;
    mesh.isPickable = false;
    const a = (i / 18) * TAU + rnd() * 0.3;
    const r = 9 + rnd() * 7;
    mesh.position.set(Math.sin(a) * r, -0.5 + rnd() * 5, Math.cos(a) * r);
    mesh.rotation.set(rnd() * TAU, rnd() * TAU, 0);
    mesh.parent = decor;
    floaters.push({ mesh, y: mesh.position.y, phase: rnd() * TAU, spin: 0.2 + rnd() * 0.5 });
  }

  // halo derrière la carte de devant, de la couleur du jeu
  const haloTex = canvasTexture('haloTex', 256, 256, scene, (ctx, w) => {
    const g = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, 'rgb(255 255 255 / 1)');
    g.addColorStop(0.4, 'rgb(255 255 255 / .35)');
    g.addColorStop(1, 'rgb(255 255 255 / 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, w);
  });
  const halo = CreatePlane('halo', { size: 1 }, scene);
  halo.material = flatMaterial('haloMat', scene, { texture: haloTex, opacity: haloTex, add: true, alpha: 0.75 });
  halo.isPickable = false;

  return { decor, floor, floaters, halo };
}

export function createMenuScene(canvas, { onLaunch, onFocus, onSoon, onViewCycle } = {}) {
  const engine = new Engine(canvas, true, { stencil: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' }, false);
  engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, 2));
  const scene = new Scene(engine);
  scene.clearColor = Color4.FromHexString(`${BG}ff`);
  scene.skipPointerMovePicking = true; // on fait nos propres « pick », seulement quand il faut

  const camera = new FreeCamera('cam', new Vector3(0, CAM_Y, 0), scene);
  camera.setTarget(new Vector3(0, CAM_Y, 1));
  camera.minZ = 0.1;
  camera.maxZ = 200;
  camera.inputs.clear();

  const { decor, floor, floaters, halo } = buildDecor(scene);

  // --- état ---
  let games = [];
  let cards = [];        // une par place de l'anneau : { slot, game, mesh, mirror, mat, mirrorMat, wiggle }
  let textures = [];     // une par jeu, partagée par ses copies
  let slots = 0;
  let step = 0;
  let radius = 4.6;
  let angle = 0;         // position de l'anneau, en places (continue)
  let target = 0;
  let mode = 'ring';
  let blend = 0;         // 0 = anneau, 1 = mur de vignettes
  let back = 0;          // 1 = décor derrière le tableau des scores (cartes assombries)
  let focus = 0;         // jeu choisi (index dans games)
  let hover = -1;        // place survolée à la souris
  let gridSlot = [];     // place de l'anneau qui vole vers le mur, pour chaque jeu
  let grid = { cols: 1, cells: [] };
  let launching = null;  // { card, t }
  let intro = 0;
  let ringY = 0;
  let pxPerSlot = 300;
  let insets = { top: 0.1, bottom: 0.1 };
  let time = 0;

  const wrap = (d) => ((((d % slots) + slots * 1.5) % slots) - slots / 2);
  const frontSlot = () => ((Math.round(target) % slots) + slots) % slots;
  const isReady = (game) => Boolean(game?.ready && game?.url);

  function setFocus(g) {
    if (g === focus || !games.length) return;
    focus = g;
    onFocus?.(games[g], g);
  }

  // --- disposition : champ de vision et mur de vignettes selon la taille de l'écran ---
  function layout() {
    if (!slots) return;
    const aspect = engine.getAspectRatio(camera);
    const free = clamp(1 - insets.top - insets.bottom, 0.4, 1);
    const cardH = CARD.h * FOCUS_SCALE;
    // carte de devant : pas plus de 62 % (paysage) / 78 % (portrait) de la hauteur libre, ni 72 % de la largeur
    const fromHeight = cardH / ((aspect > 1 ? 0.62 : 0.78) * free) / 2 / radius;
    const fromWidth = (CARD.w * FOCUS_SCALE) / 0.72 / 2 / radius / aspect;
    const halfTan = Math.max(fromHeight, fromWidth, Math.tan(0.4));
    camera.fov = 2 * Math.atan(halfTan);
    // centre de la zone libre de l'écran (entre le titre et la barre du bas)
    const centerFrac = insets.top + free / 2;
    ringY = CAM_Y + radius * halfTan * (1 - 2 * centerFrac);
    floor.position.y = ringY - cardH / 2 - 0.22;
    pxPerSlot = (Math.sin(step / 2) / (halfTan * aspect)) * engine.getRenderWidth() * engine.getHardwareScalingLevel() * 0.8;

    // mur : on essaie toutes les colonnes possibles, on garde les cartes les plus grandes
    const halfH = GRID_DIST * halfTan;
    const availH = 2 * halfH * free * 0.94;
    const availW = 2 * halfH * aspect * 0.94;
    const gridY = CAM_Y + halfH * (1 - 2 * centerFrac);
    const n = games.length;
    let best = { scale: 0 };
    for (let cols = 1; cols <= n; cols++) {
      const rows = Math.ceil(n / cols);
      const scale = Math.min(availW / cols / (CARD.w * 1.12), availH / rows / (CARD.h * 1.12));
      if (scale > best.scale) best = { cols, rows, scale };
    }
    const { cols, rows, scale } = best;
    grid = {
      cols,
      cells: games.map((_, i) => {
        const row = Math.floor(i / cols);
        const inRow = Math.min(cols, n - row * cols);
        return {
          x: ((i % cols) - (inRow - 1) / 2) * CARD.w * 1.12 * scale,
          y: gridY + ((rows - 1) / 2 - row) * CARD.h * 1.12 * scale,
          z: GRID_DIST,
          s: scale,
        };
      }),
    };
  }

  // --- cartes ---
  function paint(i) {
    const game = games[i];
    const tex = textures[i];
    const image = loadImage(game.image, () => { if (games[i] === game) paint(i); });
    drawCard(tex.getContext(), game, { best: game.best, ready: isReady(game), image });
    tex.update();
  }

  function setGames(list) {
    const previous = games[focus]?.id;
    for (const c of cards) { c.mesh.dispose(); c.mirror.dispose(); c.mat.dispose(); c.mirrorMat.dispose(); }
    for (const t of textures) t.dispose();
    games = list;
    if (!games.length) { cards = []; textures = []; slots = 0; return; }

    textures = games.map((game) => {
      const tex = new DynamicTexture(`card-${game.id}`, { width: CARD_W, height: CARD_H }, scene, true);
      tex.hasAlpha = true;
      tex.anisotropicFilteringLevel = 8;
      return tex;
    });
    games.forEach((_, i) => paint(i));

    slots = games.length * Math.ceil(MIN_SLOTS / games.length);
    step = TAU / slots;
    radius = Math.max(4.6, (slots * CARD.w * GAP) / TAU);
    cards = Array.from({ length: slots }, (_, slot) => {
      const g = slot % games.length;
      const mat = flatMaterial(`cm${slot}`, scene, { texture: textures[g], opacity: textures[g] });
      const mesh = CreatePlane(`card${slot}`, { width: CARD.w, height: CARD.h }, scene);
      mesh.material = mat;
      mesh.metadata = { slot };
      // reflet sur le sol : la même carte, retournée et pâle
      const mirrorMat = flatMaterial(`rm${slot}`, scene, { texture: textures[g], opacity: textures[g], alpha: 0.16 });
      mirrorMat.backFaceCulling = false;
      const mirror = CreatePlane(`mirror${slot}`, { width: CARD.w, height: CARD.h }, scene);
      mirror.material = mirrorMat;
      mirror.isPickable = false;
      return { slot, game: g, mesh, mirror, mat, mirrorMat, wiggle: 0 };
    });

    const keep = games.findIndex((g) => g.id === previous);
    focus = keep >= 0 ? keep : 0;
    angle = target = focus;
    layout();
    if (mode === 'grid') assignGridSlots(); // la page s'ouvre sur #vignettes : la liste arrive après le choix de la vue
    onFocus?.(games[focus], focus);
  }

  // --- navigation ---
  function turn(dir) {
    if (!slots) return;
    if (mode === 'grid') {
      setFocus((focus + dir + games.length) % games.length);
    } else {
      target = Math.round(target) + dir;
    }
  }

  function moveGrid(rows) {
    if (mode !== 'grid' || !games.length) return;
    const next = focus + rows * grid.cols;
    if (next >= 0 && next < games.length) setFocus(next);
  }

  // amène le jeu g devant (par le plus court chemin parmi ses copies sur l'anneau)
  function focusGame(g) {
    if (!slots || g < 0 || g >= games.length) return;
    if (mode !== 'grid') {
      let bestDelta = Infinity;
      for (let s = g; s < slots; s += games.length) {
        const d = wrap(s - target);
        if (Math.abs(d) < Math.abs(bestDelta)) bestDelta = d;
      }
      target = Math.round(target + bestDelta);
    }
    setFocus(g);
  }

  function launch(g = focus) {
    const game = games[g];
    if (!game || launching) return;
    const card = mode === 'grid' ? cards[gridSlot[g] ?? g] : cards.find((c) => c.slot === frontSlot());
    if (!isReady(game)) {
      if (card) card.wiggle = 1;
      onSoon?.(game);
      return;
    }
    launching = { card, game, t: 0 };
  }

  function tapSlot(slot) {
    const card = cards[slot];
    if (!card) return;
    if (mode === 'grid') {
      setFocus(card.game);
      launch(card.game);
    } else if (Math.abs(wrap(slot - target)) < 0.5) {
      launch(card.game);
    } else {
      target = Math.round(target + wrap(slot - target));
    }
  }

  // pour chaque jeu, la copie la plus proche de l'avant vole vers le mur
  function assignGridSlots() {
    gridSlot = games.map((_, g) => {
      let best = g;
      for (let s = g; s < slots; s += games.length) if (Math.abs(wrap(s - angle)) < Math.abs(wrap(best - angle))) best = s;
      return best;
    });
  }

  function setMode(next) {
    if (next === mode) return;
    if (next === 'grid') assignGridSlots();
    if (mode === 'grid' && next !== 'grid') focusGame(focus);
    if (mode === 'backdrop') target = Math.round(target);
    mode = next;
    hover = -1;
    canvas.style.cursor = '';
  }

  // --- toucher / souris ---
  const pick = (x, y) => scene.pick(x, y, (m) => m.metadata?.slot !== undefined && m.isEnabled())?.pickedMesh?.metadata.slot ?? -1;
  let press = null;

  canvas.addEventListener('pointerdown', (e) => {
    if (mode === 'backdrop' || launching) return;
    canvas.setPointerCapture(e.pointerId);
    press = { id: e.pointerId, x: e.clientX, lastX: e.clientX, lastT: performance.now(), moved: 0, vel: 0 };
  });
  canvas.addEventListener('pointermove', (e) => {
    if (press && e.pointerId === press.id) {
      const now = performance.now();
      const dx = e.clientX - press.lastX;
      press.moved = Math.max(press.moved, Math.abs(e.clientX - press.x));
      if (mode === 'ring' && press.moved > 8) {
        angle -= dx / pxPerSlot;
        target = angle;
        press.vel = damp(press.vel, -dx / pxPerSlot / Math.max((now - press.lastT) / 1000, 0.001), 30, 0.016);
      }
      press.lastX = e.clientX;
      press.lastT = now;
      return;
    }
    if (e.pointerType === 'mouse' && mode !== 'backdrop') {
      hover = pick(e.offsetX, e.offsetY);
      canvas.style.cursor = hover >= 0 ? 'pointer' : '';
    }
  });
  const release = (e) => {
    if (!press || e.pointerId !== press.id) return;
    if (press.moved <= 8) tapSlot(pick(e.offsetX, e.offsetY));
    else if (mode === 'ring') target = Math.round(angle + clamp(press.vel * 0.25, -3, 3));
    press = null;
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', (e) => { if (press?.id === e.pointerId) { target = Math.round(angle); press = null; } });
  let wheelAt = 0;
  canvas.addEventListener('wheel', (e) => {
    if (mode !== 'ring') return;
    e.preventDefault();
    const now = performance.now();
    if (now - wheelAt < 220) return;
    wheelAt = now;
    turn(Math.sign(e.deltaY || e.deltaX));
  }, { passive: false });

  // --- manette (la même que pour Police vs voleurs) : croix ou stick, A pour jouer, LB/RB pour changer de vue ---
  const pad = { dir: '', next: 0, buttons: {} };
  function pollGamepads(now) {
    let dir = '';
    const pressed = {};
    for (const gp of navigator.getGamepads?.() || []) {
      if (!gp) continue;
      const [x = 0, y = 0] = gp.axes;
      const b = (i) => Boolean(gp.buttons[i]?.pressed);
      if (x < -0.5 || b(14)) dir = 'left';
      else if (x > 0.5 || b(15)) dir = 'right';
      else if (y < -0.5 || b(12)) dir = 'up';
      else if (y > 0.5 || b(13)) dir = 'down';
      pressed.a ||= b(0) || b(9);
      pressed.lb ||= b(4);
      pressed.rb ||= b(5);
    }
    if (dir && mode !== 'backdrop' && (dir !== pad.dir || now >= pad.next)) {
      if (dir === 'left') turn(-1);
      if (dir === 'right') turn(1);
      if (dir === 'up') moveGrid(-1);
      if (dir === 'down') moveGrid(1);
      pad.next = now + (dir === pad.dir ? 180 : 380);
    }
    pad.dir = dir;
    if (pressed.a && !pad.buttons.a && mode !== 'backdrop') launch();
    if (pressed.lb && !pad.buttons.lb) onViewCycle?.(-1);
    if (pressed.rb && !pad.buttons.rb) onViewCycle?.(1);
    pad.buttons = pressed;
  }

  // --- animation ---
  const ringPos = new Vector3();
  scene.onBeforeRenderObservable.add(() => {
    const dt = Math.min(engine.getDeltaTime() / 1000, 0.05);
    time += dt;
    intro = Math.min(intro + dt / 1.4, 1);
    pollGamepads(performance.now());

    if (mode === 'backdrop') target += dt * 0.12;
    if (!press) angle = damp(angle, target, mode === 'backdrop' ? 4 : 9, dt);
    blend = damp(blend, mode === 'grid' ? 1 : 0, 6, dt);
    if (Math.abs(blend - (mode === 'grid' ? 1 : 0)) < 0.001) blend = mode === 'grid' ? 1 : 0;
    back = damp(back, mode === 'backdrop' ? 1 : 0, 5, dt);
    const e = ease(blend);

    if (slots && mode !== 'grid') {
      const g = frontSlot() % games.length;
      if (g !== focus) setFocus(g);
    }

    decor.rotation.y = -angle * step * 0.35;
    for (const f of floaters) {
      f.mesh.position.y = f.y + Math.sin(time * 0.8 + f.phase) * 0.25;
      f.mesh.rotation.y += dt * f.spin;
      f.mesh.rotation.x += dt * f.spin * 0.5;
    }

    if (launching) launching.t = Math.min(launching.t + dt / 0.45, 1);

    for (const card of cards) {
      const { slot, mesh, mirror, mat, mirrorMat } = card;
      // sur l'anneau
      const rel = wrap(slot - angle);
      const theta = rel * step;
      const near = Math.max(0, 1 - Math.abs(rel));
      const delay = clamp(intro * 1.6 - Math.abs(rel) * 0.08, 0, 1);
      const pop = ease(delay);
      ringPos.set(Math.sin(theta) * radius, ringY + near * Math.sin(time * 2) * 0.04 - (1 - pop) * 3, Math.cos(theta) * radius);
      let scale = (1 + (FOCUS_SCALE - 1) * near) * pop;
      let level = 1 - Math.min(Math.abs(rel), 2.5) * 0.2;
      let x = ringPos.x;
      let y = ringPos.y;
      let z = ringPos.z;
      let rotY = theta;

      // vers le mur de vignettes : seule une copie de chaque jeu y va, les autres s'effacent
      if (e > 0) {
        const cell = gridSlot[card.game] === slot ? grid.cells[card.game] : null;
        if (cell) {
          const chosen = card.game === focus;
          const hovered = hover === slot;
          x = lerp(x, cell.x, e);
          y = lerp(y, cell.y + (chosen ? Math.sin(time * 2) * 0.03 : 0), e);
          z = lerp(z, cell.z, e);
          rotY = lerp(rotY, 0, e);
          scale = lerp(scale, cell.s * (chosen ? 1.08 : hovered ? 1.04 : 1), e);
          level = lerp(level, chosen ? 1 : 0.85, e);
        } else {
          scale *= 1 - e;
        }
      } else if (hover === slot && Math.abs(rel) >= 0.5) {
        level = Math.min(1, level + 0.15);
      }

      level *= 1 - 0.6 * back;

      // lancement : la carte vient vers nous, les autres pâlissent
      if (launching) {
        const t = ease(launching.t);
        if (card === launching.card) {
          x = lerp(x, 0, t);
          y = lerp(y, CAM_Y, t);
          z = lerp(z, 1.2, t);
          rotY = lerp(rotY, 0, t);
        } else level *= 1 - t * 0.7;
      }

      card.wiggle = Math.max(0, card.wiggle - dt * 1.8);
      mesh.position.set(x, y, z);
      mesh.rotation.y = rotY;
      mesh.rotation.z = Math.sin(card.wiggle * 28) * 0.09 * card.wiggle;
      mesh.scaling.setAll(Math.max(scale, 0.0001));
      mesh.setEnabled(scale > 0.002);
      mat.emissiveColor.set(level, level, level);

      // reflet : symétrique par rapport au sol, s'efface quand la carte quitte l'anneau
      const floorY = floor.position.y;
      mirror.position.set(x, 2 * floorY - y, z);
      mirror.rotation.y = rotY;
      mirror.rotation.z = -mesh.rotation.z;
      mirror.scaling.set(scale, -scale, scale);
      mirror.setEnabled(scale > 0.002 && e < 0.98);
      mirrorMat.alpha = 0.16 * (1 - e) * level;
    }

    // halo derrière la carte choisie
    const g = games[focus];
    if (g) {
      halo.material.emissiveColor = Color3.FromHexString(g.color || '#5b3cc4');
      const cell = grid.cells[focus];
      const hx = lerp(0, cell?.x ?? 0, e);
      const hy = lerp(ringY, cell?.y ?? ringY, e);
      const hz = lerp(radius + 0.4, (cell?.z ?? GRID_DIST) + 0.3, e);
      halo.position.set(hx, hy, hz);
      const size = lerp(CARD.h * 2.6, CARD.h * (cell?.s ?? 1) * 1.9, e) * (1 + Math.sin(time * 2.4) * 0.04);
      halo.scaling.setAll(size * intro);
      halo.material.alpha = (mode === 'backdrop' ? 0.25 : 0.7) * (launching ? 1 - launching.t : 1);
    }

    if (launching?.t === 1 && !launching.done) {
      launching.done = true;
      onLaunch?.(launching.game);
    }
  });

  engine.runRenderLoop(() => scene.render());
  const resize = () => { engine.resize(); layout(); };
  new ResizeObserver(resize).observe(canvas);

  return {
    setGames,
    setMode,
    turn,
    moveGrid,
    focusGame,
    launch,
    setInsets(next) { insets = next; layout(); },
    // retour d'un jeu par le bouton « précédent » (page restaurée telle quelle) : on annule le zoom de lancement
    reset() { launching = null; },
  };
}
