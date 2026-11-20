// Vice Cover Studio — draws the whole cover onto a 2D context.
//
// drawCover(ctx, width, height, state) paints, in order: the panel layout
// (photos in the photo panels, the code-drawn Simian Prime hero in its
// panel), neon panel edges, a halftone + grain neon grade, and the chrome
// caption with its light sweep. A photo panel with no photo yet shows the
// neon jungle backdrop, so the cover always looks finished.
//
// state: { layoutId, photos, caption1, caption2, glow, sweep, time }
//   photos: { [panelId]: { img, transform } } — img is any drawable image.
//   glow: 0..1 neon glow strength. sweep: null (off) or 0..1, the light
//   sweep's position across the caption; the preview animates it, the
//   export freezes it. time: seconds, frozen for exports.

import { captionBlock, fitCaptionSize, panelsFor, photoDrawRect, sanitizeCaption } from './layout.js';
import { drawJungleBackdrop, drawSimian } from './simian.js';

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clipPanel(ctx, panel) {
  ctx.beginPath();
  ctx.moveTo(panel.points[0][0], panel.points[0][1]);
  for (let i = 1; i < panel.points.length; i++) ctx.lineTo(panel.points[i][0], panel.points[i][1]);
  ctx.closePath();
  ctx.clip();
}

function chromeText(ctx, text, x, y, size, glow) {
  const grad = ctx.createLinearGradient(0, y - size, 0, y + size * 0.15);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.4, '#d9f6ff');
  grad.addColorStop(0.6, '#8fa8bc');
  grad.addColorStop(0.75, '#f2feff');
  grad.addColorStop(1, '#39ff88');
  ctx.font = `900 ${size}px "Arial Black", "Helvetica Neue", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.shadowColor = `rgba(255,79,216,${0.25 + glow * 0.55})`;
  ctx.shadowBlur = size * (0.12 + glow * 0.3);
  ctx.strokeStyle = '#12041f';
  ctx.lineWidth = Math.max(2, size * 0.07);
  ctx.strokeText(text, x, y);
  ctx.fillStyle = grad;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = 0;
}

export function drawCover(ctx, width, height, state) {
  const w = width;
  const h = height;
  const glow = Math.min(1, Math.max(0, state.glow ?? 0.6));
  const time = state.time ?? 0;
  const panels = panelsFor(state.layoutId ?? 'slash', w, h);

  ctx.save();
  ctx.fillStyle = '#07030f';
  ctx.fillRect(0, 0, w, h);

  // Panels.
  for (const panel of panels) {
    ctx.save();
    clipPanel(ctx, panel);
    const photo = state.photos?.[panel.id];
    if (panel.kind === 'simian') {
      drawSimian(ctx, panel.bbox, time);
    } else if (photo?.img) {
      const r = photoDrawRect(photo.img.naturalWidth || photo.img.width, photo.img.naturalHeight || photo.img.height, panel.bbox, photo.transform);
      ctx.drawImage(photo.img, r.x, r.y, r.width, r.height);
      // Neon wash over the photo so panels share one grade.
      const wash = ctx.createLinearGradient(0, panel.bbox.y, 0, panel.bbox.y + panel.bbox.height);
      wash.addColorStop(0, 'rgba(255,79,216,0.10)');
      wash.addColorStop(1, 'rgba(57,255,136,0.14)');
      ctx.fillStyle = wash;
      ctx.fillRect(panel.bbox.x, panel.bbox.y, panel.bbox.width, panel.bbox.height);
    } else {
      drawJungleBackdrop(ctx, panel.bbox);
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = `700 ${Math.max(14, h * 0.02)}px Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('ADD A PHOTO', panel.bbox.x + panel.bbox.width / 2, panel.bbox.y + panel.bbox.height / 2);
    }
    ctx.restore();
  }

  // Neon edges between panels.
  ctx.save();
  ctx.lineJoin = 'round';
  for (const panel of panels) {
    ctx.beginPath();
    ctx.moveTo(panel.points[0][0], panel.points[0][1]);
    for (let i = 1; i < panel.points.length; i++) ctx.lineTo(panel.points[i][0], panel.points[i][1]);
    ctx.closePath();
    ctx.strokeStyle = 'rgba(57,255,136,0.9)';
    ctx.lineWidth = Math.max(2, h * 0.004);
    ctx.shadowColor = '#39ff88';
    ctx.shadowBlur = h * 0.008 * (0.5 + glow);
    ctx.stroke();
  }
  ctx.restore();

  // Halftone dots rising from the foot + grain, seeded so exports repeat.
  const rnd = mulberry(77);
  ctx.save();
  const dotZone = h * 0.3;
  for (let yy = h - dotZone; yy < h; yy += Math.max(6, h * 0.012)) {
    const depth = (yy - (h - dotZone)) / dotZone;
    for (let xx = 0; xx < w; xx += Math.max(6, h * 0.012)) {
      const r = Math.max(0.6, depth * h * 0.004);
      ctx.fillStyle = `rgba(0,0,0,${0.10 + depth * 0.22})`;
      ctx.beginPath();
      ctx.arc(xx + h * 0.006, yy + h * 0.006, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  for (let i = 0; i < w * h * 0.00012; i++) {
    const gx = rnd() * w;
    const gy = rnd() * h;
    ctx.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)';
    ctx.fillRect(gx, gy, 1.5, 1.5);
  }
  ctx.restore();

  // Caption scrim + chrome lettering.
  const block = captionBlock(state.caption1, state.caption2, h);
  const scrim = ctx.createLinearGradient(0, h * 0.62, 0, h);
  scrim.addColorStop(0, 'rgba(7,3,15,0)');
  scrim.addColorStop(0.55, 'rgba(7,3,15,0.55)');
  scrim.addColorStop(1, 'rgba(7,3,15,0.88)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, h * 0.62, w, h * 0.38);

  if (block.line1) {
    const size1 = fitCaptionSize(block.line1, w * 0.92, block.size1, (s) => {
      ctx.font = `900 ${s}px "Arial Black", "Helvetica Neue", Arial, sans-serif`;
      return ctx.measureText(block.line1.toUpperCase()).width;
    });
    if (size1 > 0) chromeText(ctx, block.line1.toUpperCase(), w / 2, block.y1, size1, glow);
  }
  if (block.line2) {
    const size2 = fitCaptionSize(block.line2, w * 0.8, block.size2, (s) => {
      ctx.font = `700 ${s}px Arial, sans-serif`;
      return ctx.measureText(block.line2.toUpperCase()).width;
    });
    if (size2 > 0) {
      ctx.font = `700 ${size2}px Arial, sans-serif`;
      ctx.textAlign = 'center';
      try { ctx.letterSpacing = `${Math.max(2, size2 * 0.18)}px`; } catch { /* older canvas */ }
      ctx.fillStyle = '#39ff88';
      ctx.shadowColor = '#39ff88';
      ctx.shadowBlur = size2 * (0.3 + glow * 0.5);
      ctx.fillText(block.line2.toUpperCase(), w / 2, block.y2);
      ctx.shadowBlur = 0;
      try { ctx.letterSpacing = '0px'; } catch { /* older canvas */ }
    }
  }

  // Light sweep across the caption: a diagonal band of light.
  if (typeof state.sweep === 'number') {
    const sx = state.sweep * (w + h * 0.4) - h * 0.2;
    const sweepGrad = ctx.createLinearGradient(sx - h * 0.12, 0, sx + h * 0.12, 0);
    sweepGrad.addColorStop(0, 'rgba(255,255,255,0)');
    sweepGrad.addColorStop(0.5, 'rgba(255,255,255,0.20)');
    sweepGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = sweepGrad;
    ctx.fillRect(0, h * 0.6, w, h * 0.4);
    ctx.restore();
  }

  // Vignette.
  const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.max(w, h) * 0.75);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/** Caption lines as the cover will draw them (empty caption draws nothing). */
export function coverCaption(state) {
  return { line1: sanitizeCaption(state.caption1), line2: sanitizeCaption(state.caption2) };
}
