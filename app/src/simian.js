// Vice Cover Studio — Simian Prime, drawn entirely by code.
//
// No image, no game asset: a stylised ape hero built from canvas paths.
// Neon-cyan visor, chrome headset, chrome jacket, holographic banana,
// against a neon jungle skyline. `drawSimian(ctx, rect, time)` paints the
// whole hero panel; `time` (seconds) only moves the visor shimmer, and the
// export freezes it, so a cover is deterministic.

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function chrome(ctx, x0, y0, x1, y1) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, '#f4feff');
  g.addColorStop(0.35, '#9fb4c4');
  g.addColorStop(0.55, '#e8f6ff');
  g.addColorStop(0.75, '#5f7488');
  g.addColorStop(1, '#d7f7ff');
  return g;
}

function holo(ctx, x0, y0, x1, y1) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, '#39ff88');
  g.addColorStop(0.45, '#37e6ff');
  g.addColorStop(0.75, '#ff4fd8');
  g.addColorStop(1, '#ffe14d');
  return g;
}

/** Neon jungle skyline behind the hero: gradient sky, sun, towers, palms. */
export function drawJungleBackdrop(ctx, rect) {
  const { x, y, width: w, height: h } = rect;
  const sky = ctx.createLinearGradient(0, y, 0, y + h);
  sky.addColorStop(0, '#2b0a4d');
  sky.addColorStop(0.45, '#7a1048');
  sky.addColorStop(0.75, '#12351f');
  sky.addColorStop(1, '#04120a');
  ctx.fillStyle = sky;
  ctx.fillRect(x, y, w, h);

  // Stars.
  const rnd = mulberry(20261121);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  for (let i = 0; i < 26; i++) {
    const sx = x + rnd() * w;
    const sy = y + rnd() * h * 0.35;
    ctx.fillRect(sx, sy, Math.max(1, w * 0.002), Math.max(1, w * 0.002));
  }

  // Low neon sun.
  const sunX = x + w * 0.72;
  const sunY = y + h * 0.42;
  const sunR = w * 0.16;
  const glow = ctx.createRadialGradient(sunX, sunY, sunR * 0.2, sunX, sunY, sunR * 2.2);
  glow.addColorStop(0, 'rgba(255,79,216,0.55)');
  glow.addColorStop(1, 'rgba(255,79,216,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x, y, w, h);
  const sun = ctx.createLinearGradient(0, sunY - sunR, 0, sunY + sunR);
  sun.addColorStop(0, '#ffe14d');
  sun.addColorStop(1, '#ff4fd8');
  ctx.fillStyle = sun;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.fill();

  // Tower silhouettes with lit windows.
  ctx.fillStyle = '#0b0616';
  const towers = [[0.02, 0.5, 0.1, 0.42], [0.14, 0.42, 0.08, 0.5], [0.78, 0.46, 0.09, 0.46], [0.9, 0.52, 0.1, 0.4]];
  for (const [fx, fy, fw, fh] of towers) {
    ctx.fillRect(x + fx * w, y + fy * h, fw * w, fh * h);
  }
  ctx.fillStyle = 'rgba(57,255,136,0.85)';
  for (let i = 0; i < 22; i++) {
    const tx = x + (0.03 + rnd() * 0.94) * w;
    const ty = y + (0.45 + rnd() * 0.4) * h;
    ctx.fillRect(tx, ty, Math.max(1.5, w * 0.006), Math.max(1.5, w * 0.006));
  }

  // Palm silhouettes left and right.
  ctx.strokeStyle = '#04120a';
  ctx.lineWidth = Math.max(2, w * 0.012);
  ctx.lineCap = 'round';
  for (const px of [x + w * 0.06, x + w * 0.96]) {
    const topY = y + h * 0.62;
    ctx.beginPath();
    ctx.moveTo(px, y + h);
    ctx.quadraticCurveTo(px + (px < x + w / 2 ? w * 0.03 : -w * 0.03), y + h * 0.8, px, topY);
    ctx.stroke();
    for (let f = 0; f < 5; f++) {
      const a = -Math.PI * (0.15 + f * 0.14) * (px < x + w / 2 ? 1 : -1);
      const dir = px < x + w / 2 ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(px, topY);
      ctx.quadraticCurveTo(
        px + Math.cos(a) * w * 0.09 * dir, topY + Math.sin(a) * h * 0.05 - h * 0.02,
        px + Math.cos(a) * w * 0.16 * dir, topY + h * 0.06,
      );
      ctx.stroke();
    }
  }
}

/** The Simian Prime hero: visor, headset, chrome jacket, holo banana. */
export function drawSimian(ctx, rect, time = 0) {
  const { x, y, width: w, height: h } = rect;
  drawJungleBackdrop(ctx, rect);

  const cx = x + w * 0.5;
  const headY = y + h * 0.46;
  // Size the hero by the panel's smaller side, so it stays big in tall,
  // narrow panels (portrait covers) as well as wide ones.
  const headR = Math.min(w * 0.4, h * 0.14);
  const u = headR / 27; // unit, so the drawing scales with the head

  // Chrome jacket shoulders.
  ctx.fillStyle = chrome(ctx, cx - 42 * u, y + h, cx + 42 * u, y + h * 0.7);
  ctx.beginPath();
  ctx.moveTo(cx - 44 * u, y + h);
  ctx.quadraticCurveTo(cx - 44 * u, y + h * 0.78, cx - 26 * u, y + h * 0.72);
  ctx.lineTo(cx + 26 * u, y + h * 0.72);
  ctx.quadraticCurveTo(cx + 44 * u, y + h * 0.78, cx + 44 * u, y + h);
  ctx.closePath();
  ctx.fill();
  // Jacket zipper + neon trim.
  ctx.strokeStyle = '#0b0616';
  ctx.lineWidth = 2.2 * u;
  ctx.beginPath();
  ctx.moveTo(cx, y + h * 0.72);
  ctx.lineTo(cx, y + h);
  ctx.stroke();
  ctx.strokeStyle = '#39ff88';
  ctx.lineWidth = 1.4 * u;
  ctx.shadowColor = '#39ff88';
  ctx.shadowBlur = 6 * u;
  ctx.beginPath();
  ctx.moveTo(cx - 26 * u, y + h * 0.74);
  ctx.quadraticCurveTo(cx, y + h * 0.8, cx + 26 * u, y + h * 0.74);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Raised arm holding the banana (behind the head's right side).
  ctx.strokeStyle = '#120a24';
  ctx.lineWidth = 9 * u;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx + 30 * u, y + h * 0.86);
  ctx.quadraticCurveTo(cx + 46 * u, y + h * 0.62, cx + 42 * u, y + h * 0.36);
  ctx.stroke();

  // Fur head.
  const fur = ctx.createRadialGradient(cx - 8 * u, headY - 10 * u, 4 * u, cx, headY, headR * 1.25);
  fur.addColorStop(0, '#3a2b52');
  fur.addColorStop(0.7, '#1a1026');
  fur.addColorStop(1, '#0d0716');
  ctx.fillStyle = fur;
  ctx.beginPath();
  ctx.arc(cx, headY, headR, 0, Math.PI * 2);
  ctx.fill();
  // Fur tuft.
  ctx.fillStyle = '#1a1026';
  ctx.beginPath();
  ctx.moveTo(cx - 12 * u, headY - headR * 0.82);
  ctx.quadraticCurveTo(cx - 2 * u, headY - headR * 1.25, cx + 6 * u, headY - headR * 0.9);
  ctx.quadraticCurveTo(cx - 2 * u, headY - headR * 0.95, cx - 12 * u, headY - headR * 0.82);
  ctx.fill();
  // Ears.
  for (const s of [-1, 1]) {
    ctx.fillStyle = '#241636';
    ctx.beginPath();
    ctx.arc(cx + s * headR * 0.98, headY + 2 * u, 7 * u, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff4fd8';
    ctx.beginPath();
    ctx.arc(cx + s * headR * 0.98, headY + 2 * u, 3.4 * u, 0, Math.PI * 2);
    ctx.fill();
  }

  // Muzzle.
  ctx.fillStyle = '#4a3566';
  ctx.beginPath();
  ctx.ellipse(cx, headY + headR * 0.52, 13 * u, 8 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#120a24';
  ctx.beginPath();
  ctx.ellipse(cx, headY + headR * 0.44, 4 * u, 2.6 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#120a24';
  ctx.lineWidth = 1.6 * u;
  ctx.beginPath();
  ctx.moveTo(cx, headY + headR * 0.48);
  ctx.lineTo(cx, headY + headR * 0.6);
  ctx.quadraticCurveTo(cx - 4 * u, headY + headR * 0.68, cx - 7 * u, headY + headR * 0.62);
  ctx.moveTo(cx, headY + headR * 0.6);
  ctx.quadraticCurveTo(cx + 4 * u, headY + headR * 0.68, cx + 7 * u, headY + headR * 0.62);
  ctx.stroke();

  // Neon-cyan visor.
  const visorY = headY - headR * 0.18;
  const visorH = headR * 0.42;
  ctx.save();
  ctx.shadowColor = '#37e6ff';
  ctx.shadowBlur = 14 * u;
  ctx.fillStyle = '#062a33';
  roundRect(ctx, cx - headR * 0.82, visorY - visorH / 2, headR * 1.64, visorH, visorH * 0.45);
  ctx.fill();
  ctx.restore();
  const visorGlass = ctx.createLinearGradient(cx - headR * 0.8, visorY, cx + headR * 0.8, visorY);
  visorGlass.addColorStop(0, '#0affef');
  visorGlass.addColorStop(0.5, '#37e6ff');
  visorGlass.addColorStop(1, '#0a7dff');
  ctx.fillStyle = visorGlass;
  roundRect(ctx, cx - headR * 0.76, visorY - visorH * 0.38, headR * 1.52, visorH * 0.76, visorH * 0.36);
  ctx.fill();
  // Visor shimmer that sweeps with time; frozen in exports.
  const sweepX = cx - headR * 0.7 + ((time % 2.4) / 2.4) * headR * 1.4;
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.moveTo(sweepX - 3 * u, visorY - visorH * 0.38);
  ctx.lineTo(sweepX + 2 * u, visorY - visorH * 0.38);
  ctx.lineTo(sweepX - 2 * u, visorY + visorH * 0.38);
  ctx.lineTo(sweepX - 7 * u, visorY + visorH * 0.38);
  ctx.closePath();
  ctx.fill();
  // Visor eyes.
  ctx.fillStyle = '#04121a';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cx + s * headR * 0.36, visorY, 5.5 * u, 3 * u, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Chrome headset: band over the head, ear cups, mic boom.
  ctx.strokeStyle = chrome(ctx, cx - headR, headY - headR, cx + headR, headY - headR);
  ctx.lineWidth = 5 * u;
  ctx.beginPath();
  ctx.arc(cx, headY - 2 * u, headR * 1.04, Math.PI * 1.08, Math.PI * 1.92);
  ctx.stroke();
  for (const s of [-1, 1]) {
    ctx.fillStyle = chrome(ctx, cx + s * headR, headY - 8 * u, cx + s * headR, headY + 8 * u);
    roundRect(ctx, cx + s * headR * 1.02 - 5.5 * u, headY - 6 * u, 11 * u, 15 * u, 4 * u);
    ctx.fill();
    ctx.fillStyle = '#39ff88';
    ctx.beginPath();
    ctx.arc(cx + s * headR * 1.02, headY + 1.5 * u, 2 * u, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = '#c8d6e2';
  ctx.lineWidth = 2 * u;
  ctx.beginPath();
  ctx.moveTo(cx - headR * 1.02, headY + 8 * u);
  ctx.quadraticCurveTo(cx - headR * 0.7, headY + headR * 0.72, cx - 8 * u, headY + headR * 0.62);
  ctx.stroke();
  ctx.fillStyle = '#ff4fd8';
  ctx.beginPath();
  ctx.arc(cx - 8 * u, headY + headR * 0.62, 2.6 * u, 0, Math.PI * 2);
  ctx.fill();

  // Holographic banana in the raised hand, clear of the head and inside
  // the panel even when the panel is narrow.
  const bx = Math.min(cx + 44 * u, x + w * 0.9);
  const by = y + h * 0.33;
  ctx.save();
  ctx.translate(bx, by);
  ctx.rotate(0.5);
  ctx.scale(1.5, 1.5);
  ctx.fillStyle = holo(ctx, -4 * u, -14 * u, 4 * u, 14 * u);
  ctx.shadowColor = '#39ff88';
  ctx.shadowBlur = 10 * u;
  ctx.beginPath();
  ctx.moveTo(-3 * u, -13 * u);
  ctx.quadraticCurveTo(7 * u, -6 * u, 5 * u, 6 * u);
  ctx.quadraticCurveTo(4 * u, 13 * u, -1 * u, 14 * u);
  ctx.quadraticCurveTo(-4 * u, 6 * u, -6 * u, -6 * u);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Neon rim light on the fur.
  ctx.strokeStyle = 'rgba(57,255,136,0.75)';
  ctx.lineWidth = 2 * u;
  ctx.beginPath();
  ctx.arc(cx, headY, headR * 0.99, Math.PI * 1.15, Math.PI * 1.85);
  ctx.stroke();
}
