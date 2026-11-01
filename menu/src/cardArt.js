// Dessin d'une vignette de jeu (canvas 2D) : posée ensuite comme texture sur une carte 3D.
// Couleur du jeu en dégradé, grand emoji (ou image « image » de games.json), titre, meilleur score, « ▶ Jouer » ou « Bientôt ».
export const CARD_W = 512;
export const CARD_H = 672;

const FONT = 'ui-rounded, "Nunito", "Segoe UI", system-ui, sans-serif';
const EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
const images = new Map(); // url -> Image (chargée une fois, partagée)

function shade(hex, amount) {
  const n = parseInt(hex.replace('#', ''), 16);
  const mix = (c) => Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount);
  return `rgb(${mix(n >> 16)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

// Texte sur une ligne, réduit jusqu'à tenir dans la largeur
function fitText(ctx, text, x, y, maxWidth, size, weight = 800) {
  let s = size;
  do {
    ctx.font = `${weight} ${s}px ${FONT}`;
    s -= 2;
  } while (ctx.measureText(text).width > maxWidth && s > 20);
  ctx.fillText(text, x, y);
}

function pill(ctx, text, cx, cy, { bg, fg, size = 40 }) {
  ctx.font = `800 ${size}px ${FONT}`;
  const w = ctx.measureText(text).width + size * 1.4;
  const h = size * 1.8;
  roundRect(ctx, cx - w / 2, cy - h / 2, w, h, h / 2);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.fillText(text, cx, cy + size * 0.05);
}

// Appelle onReady quand l'image du jeu est chargée (pour redessiner la carte avec)
export function loadImage(url, onReady) {
  if (!url) return null;
  let img = images.get(url);
  if (!img) {
    img = new Image();
    img.src = url;
    images.set(url, img);
  }
  if (!img.complete) img.addEventListener('load', onReady, { once: true });
  return img.complete && img.naturalWidth ? img : null;
}

export function drawCard(ctx, game, { best, ready, image }) {
  const W = CARD_W;
  const H = CARD_H;
  const pad = 14;
  const color = game.color || '#5b3cc4';
  ctx.clearRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // fond : dégradé de la couleur du jeu, ou image du jeu
  roundRect(ctx, pad, pad, W - pad * 2, H - pad * 2, 56);
  ctx.save();
  ctx.clip();
  const bg = ctx.createLinearGradient(0, 0, W * 0.4, H);
  bg.addColorStop(0, shade(color, 0.28));
  bg.addColorStop(1, shade(color, -0.35));
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  if (image) {
    const scale = Math.max(W / image.naturalWidth, H / image.naturalHeight);
    const w = image.naturalWidth * scale;
    const h = image.naturalHeight * scale;
    ctx.drawImage(image, (W - w) / 2, (H - h) / 2, w, h);
    const fade = ctx.createLinearGradient(0, H * 0.5, 0, H);
    fade.addColorStop(0, 'rgb(0 0 0 / 0)');
    fade.addColorStop(1, shade(color, -0.55));
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, W, H);
  }
  // reflet brillant en haut
  const gloss = ctx.createLinearGradient(0, 0, 0, H * 0.45);
  gloss.addColorStop(0, 'rgb(255 255 255 / .32)');
  gloss.addColorStop(1, 'rgb(255 255 255 / 0)');
  ctx.fillStyle = gloss;
  ctx.beginPath();
  ctx.ellipse(W * 0.3, 0, W * 0.75, H * 0.42, -0.25, 0, Math.PI * 2);
  ctx.fill();
  // petites étoiles décoratives
  ctx.fillStyle = 'rgb(255 255 255 / .22)';
  for (const [x, y, r] of [[0.16, 0.2, 9], [0.84, 0.14, 6], [0.78, 0.52, 8], [0.12, 0.6, 5], [0.9, 0.35, 4]]) {
    ctx.beginPath();
    ctx.arc(W * x, H * y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // grand emoji du jeu (seulement sans image)
  if (!image) {
    ctx.save();
    ctx.shadowColor = 'rgb(0 0 0 / .35)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 12;
    ctx.font = `230px ${EMOJI_FONT}`;
    ctx.fillText(game.icon || '🎮', W / 2, H * 0.38);
    ctx.restore();
  }

  // titre
  ctx.save();
  ctx.shadowColor = 'rgb(0 0 0 / .4)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = '#fff';
  fitText(ctx, game.title, W / 2, H * 0.7, W - 80, 60);
  ctx.restore();

  if (ready) pill(ctx, '▶ Jouer', W / 2, H * 0.84, { bg: '#fff', fg: shade(color, -0.2), size: 42 });
  else pill(ctx, 'Bientôt', W / 2, H * 0.84, { bg: 'rgb(0 0 0 / .28)', fg: '#fff', size: 34 });

  if (best) pill(ctx, `🏆 ${best.toLocaleString('fr')}`, W / 2, H * 0.08 + 26, { bg: 'rgb(0 0 0 / .3)', fg: '#fff', size: 28 });

  // pas encore prêt : voile gris
  if (!ready) {
    roundRect(ctx, pad, pad, W - pad * 2, H - pad * 2, 56);
    ctx.fillStyle = 'rgb(30 24 60 / .38)';
    ctx.fill();
  }

  // liseré blanc
  roundRect(ctx, pad, pad, W - pad * 2, H - pad * 2, 56);
  ctx.lineWidth = 10;
  ctx.strokeStyle = ready ? 'rgb(255 255 255 / .92)' : 'rgb(255 255 255 / .45)';
  ctx.stroke();
}
