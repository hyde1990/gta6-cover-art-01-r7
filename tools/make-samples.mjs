// Generates the app's two sample photos (app/samples/*.jpg) as procedural
// neon art drawn by code in a headless browser — no copied image, no photo
// of a real person. Run: node tools/make-samples.mjs
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire('/home/hatch/workspace/makefun/node_modules/');
const { chromium } = require('playwright');

const repo = fileURLToPath(new URL('..', import.meta.url));
const W = 1200;
const H = 800;

// Drawn inside the browser page: two neon Vice City scenes.
const DRAW = `
(ctx, W, H, which) => {
  const rnd = (() => { let a = 4242; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
  if (which === 'boulevard') {
    const sky = ctx.createLinearGradient(0, 0, 0, H * 0.62);
    sky.addColorStop(0, '#2b0a4d'); sky.addColorStop(0.55, '#c2187a'); sky.addColorStop(1, '#ff7a3d');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H * 0.62);
    const sun = ctx.createLinearGradient(0, H * 0.1, 0, H * 0.45);
    sun.addColorStop(0, '#ffe14d'); sun.addColorStop(1, '#ff4fd8');
    ctx.fillStyle = sun; ctx.beginPath(); ctx.arc(W * 0.5, H * 0.34, H * 0.17, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#150b28';
    for (const side of [0, 1]) {
      let x = side ? W * 0.62 : 0;
      const dir = side ? 1 : -1;
      while ((side && x < W) || (!side && x < W * 0.38)) {
        const bw = 70 + rnd() * 90, bh = 140 + rnd() * 220;
        ctx.fillRect(x, H * 0.62 - bh, bw, bh);
        ctx.fillStyle = 'rgba(57,255,136,0.9)';
        for (let wy = H * 0.62 - bh + 12; wy < H * 0.6; wy += 22) for (let wx = x + 8; wx < x + bw - 8; wx += 18) if (rnd() > 0.55) ctx.fillRect(wx, wy, 8, 10);
        ctx.fillStyle = '#150b28';
        x += bw + 6;
      }
    }
    // Road with perspective + neon centre line.
    ctx.fillStyle = '#0b0616';
    ctx.beginPath(); ctx.moveTo(W * 0.38, H * 0.62); ctx.lineTo(W * 0.62, H * 0.62); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#39ff88'; ctx.lineWidth = 5; ctx.shadowColor = '#39ff88'; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.moveTo(W * 0.5, H * 0.64); ctx.lineTo(W * 0.5, H); ctx.stroke();
    ctx.strokeStyle = '#ff4fd8';
    for (let i = 0; i < 5; i++) { const y = H * 0.66 + i * H * 0.07; ctx.beginPath(); ctx.moveTo(W * 0.5 - (y - H * 0.6) * 0.45, y); ctx.lineTo(W * 0.5 + (y - H * 0.6) * 0.45, y); ctx.stroke(); }
    ctx.shadowBlur = 0;
    // Neon sign.
    ctx.fillStyle = '#37e6ff'; ctx.font = '900 64px Arial'; ctx.textAlign = 'center';
    ctx.shadowColor = '#37e6ff'; ctx.shadowBlur = 24; ctx.fillText('VICE', W * 0.5, H * 0.2); ctx.shadowBlur = 0;
    ctx.fillStyle = '#39ff88'; ctx.font = '700 26px Arial'; ctx.fillText('BOULEVARD', W * 0.5, H * 0.2 + 34);
  } else {
    const sky = ctx.createLinearGradient(0, 0, 0, H * 0.55);
    sky.addColorStop(0, '#1b0533'); sky.addColorStop(0.5, '#8a1160'); sky.addColorStop(1, '#ff9a4d');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H * 0.55);
    ctx.fillStyle = '#ffe14d'; ctx.beginPath(); ctx.arc(W * 0.5, H * 0.42, H * 0.15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,225,77,0.25)'; ctx.beginPath(); ctx.arc(W * 0.5, H * 0.42, H * 0.22, 0, Math.PI * 2); ctx.fill();
    const sea = ctx.createLinearGradient(0, H * 0.55, 0, H);
    sea.addColorStop(0, '#ff7a9e'); sea.addColorStop(0.4, '#7a2a6e'); sea.addColorStop(1, '#0b1030');
    ctx.fillStyle = sea; ctx.fillRect(0, H * 0.55, W, H * 0.45);
    ctx.fillStyle = 'rgba(255,225,77,0.7)';
    for (let i = 0; i < 26; i++) { const y = H * 0.56 + rnd() * H * 0.36; const ww = 40 + rnd() * 160; ctx.fillRect(W * 0.5 - ww / 2 + (rnd() - 0.5) * 60, y, ww, 3); }
    // Pier planks in perspective.
    ctx.fillStyle = '#241408';
    ctx.beginPath(); ctx.moveTo(W * 0.42, H * 0.55); ctx.lineTo(W * 0.58, H * 0.55); ctx.lineTo(W * 0.86, H); ctx.lineTo(W * 0.14, H); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#120a04'; ctx.lineWidth = 3;
    for (let i = 0; i < 9; i++) { const t = i / 8; const y = H * 0.55 + t * t * H * 0.45; const hw = (W * 0.08 + t * W * 0.28); ctx.beginPath(); ctx.moveTo(W * 0.5 - hw, y); ctx.lineTo(W * 0.5 + hw, y); ctx.stroke(); }
    ctx.strokeStyle = '#39ff88'; ctx.lineWidth = 4; ctx.shadowColor = '#39ff88'; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.moveTo(W * 0.42, H * 0.55); ctx.lineTo(W * 0.14, H); ctx.moveTo(W * 0.58, H * 0.55); ctx.lineTo(W * 0.86, H); ctx.stroke(); ctx.shadowBlur = 0;
    // Palms at the pier head.
    ctx.strokeStyle = '#04120a'; ctx.lineWidth = 8; ctx.lineCap = 'round';
    for (const px of [W * 0.3, W * 0.7]) {
      ctx.beginPath(); ctx.moveTo(px, H * 0.55); ctx.quadraticCurveTo(px + 14, H * 0.42, px + 4, H * 0.32); ctx.stroke();
      ctx.lineWidth = 5;
      for (let f = 0; f < 5; f++) { const a = -Math.PI * (0.1 + f * 0.16); ctx.beginPath(); ctx.moveTo(px + 4, H * 0.32); ctx.quadraticCurveTo(px + 4 + Math.cos(a) * 46, H * 0.32 + Math.sin(a) * 26, px + 4 + Math.cos(a) * 84, H * 0.32 + 34); ctx.stroke(); }
      ctx.lineWidth = 8;
    }
  }
  return true;
}`;

const browser = await chromium.launch();
const page = await browser.newPage();
for (const name of ['boulevard', 'pier']) {
  await page.setContent(`<canvas id="c" width="${W}" height="${H}"></canvas>`);
  await page.evaluate(
    ({ DRAW, name, W, H }) => {
      const fn = eval(`(${DRAW})`);
      fn(document.getElementById('c').getContext('2d'), W, H, name);
    },
    { DRAW, name, W, H },
  );
  const dataUrl = await page.evaluate(() => document.getElementById('c').toDataURL('image/jpeg', 0.85));
  const out = join(repo, 'app', 'samples', `${name}.jpg`);
  writeFileSync(out, Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log(`wrote ${out}`);
}
await browser.close();
