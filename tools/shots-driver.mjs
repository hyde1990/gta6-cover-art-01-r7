// Screenshot driver for Vice Cover Studio (Playwright, local only).
// Serves app/ with serve.ts, loads the editor, verifies the real export
// path end to end (click-free: calls the app's export, captures the PNG
// download, checks its dimensions), and writes the four screenshots.
// Run: node tools/shots-driver.mjs
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire('/home/hatch/workspace/makefun/node_modules/');
const { chromium } = require('playwright');

const repo = fileURLToPath(new URL('..', import.meta.url));
const shotsDir = join(repo, 'screenshots');
const PORT = 8123;
const BASE = `http://127.0.0.1:${PORT}`;

mkdirSync(shotsDir, { recursive: true });
const tmpDir = '/tmp/vice-shots-tmp';
mkdirSync(tmpDir, { recursive: true });

function pngSize(buf) {
  if (buf[0] !== 0x89 || buf[1] !== 0x50) throw new Error('not a PNG');
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function jpegSize(buf) {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) throw new Error('not a JPEG');
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) throw new Error('bad JPEG marker');
    const marker = buf[i + 1];
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5) };
    }
    const len = buf.readUInt16BE(i + 2);
    i += 2 + len;
  }
  throw new Error('no JPEG SOF found');
}

async function waitServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`${BASE}/index.html`);
      if (res.ok) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('serve.ts did not come up');
}

const server = spawn(process.execPath, ['serve.ts', '--port', String(PORT)], { cwd: repo, stdio: 'ignore' });
let failures = 0;
const report = [];

try {
  await waitServer();
  const browser = await chromium.launch();
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  page.on('pageerror', (err) => {
    console.error('PAGE ERROR:', err.message);
    failures += 1;
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.error('CONSOLE ERROR:', msg.text());
  });

  // 1. Editor with a photo loaded.
  await page.goto(`${BASE}/?shot=editor&photo=boulevard&caption=SIMIAN%20CITY&sub=Cyber%20Jungle%20Nights`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 15000 });
  const webgl = await page.evaluate(() => !!document.createElement('canvas').getContext('webgl2'));
  console.log(`WebGL2 available in this browser: ${webgl}`);
  await page.screenshot({ path: join(shotsDir, '2-editor.jpg'), type: 'jpeg', quality: 82 });

  // 2. Real exports: capture the downloaded PNG, check dimensions, scale down.
  // The wide cover uses the pier sample; the others the boulevard sample.
  await page.goto(`${BASE}/?shot=editor&photo=pier&caption=SIMIAN%20CITY&sub=Cyber%20Jungle%20Nights`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 15000 });
  async function exportShot(sizeId, outName, targetW, targetH) {
    const downloadPromise = page.waitForEvent('download', { timeout: 20000 });
    await page.evaluate((id) => window.__vice.exportPNG(id), sizeId);
    const download = await downloadPromise;
    const tmpPng = join(tmpDir, `${sizeId}.png`);
    await download.saveAs(tmpPng);
    const pngBuf = (await import('node:fs')).readFileSync(tmpPng);
    const dims = pngSize(pngBuf);
    const expected = { square: [1080, 1080], portrait: [1080, 1350], wide: [1920, 1080] }[sizeId];
    if (dims.width !== expected[0] || dims.height !== expected[1]) {
      throw new Error(`export ${sizeId} is ${dims.width}x${dims.height}, expected ${expected.join('x')}`);
    }
    console.log(`export ${sizeId}: PNG ${dims.width}x${dims.height}, ${pngBuf.length} bytes`);
    // Scale the true exported PNG down to a screenshot-sized JPEG.
    const dataUrl = `data:image/png;base64,${pngBuf.toString('base64')}`;
    const jpeg = await page.evaluate(async ({ dataUrl, targetW, targetH }) => {
      const img = new Image();
      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = rej;
        img.src = dataUrl;
      });
      const c = document.createElement('canvas');
      c.width = targetW;
      c.height = targetH;
      c.getContext('2d').drawImage(img, 0, 0, targetW, targetH);
      return c.toDataURL('image/jpeg', 0.82);
    }, { dataUrl, targetW, targetH });
    const outPath = join(shotsDir, outName);
    writeFileSync(outPath, Buffer.from(jpeg.split(',')[1], 'base64'));
    return outPath;
  }

  await exportShot('wide', '1-cover.jpg', 1280, 720);
  // The portrait and square covers use the other sample.
  await page.goto(`${BASE}/?shot=editor&photo=boulevard&caption=SIMIAN%20CITY&sub=Cyber%20Jungle%20Nights`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 15000 });
  await exportShot('portrait', '3-cover-portrait.jpg', 960, 1200);
  await exportShot('square', '4-cover-square.jpg', 1024, 1024);

  await browser.close();
} catch (err) {
  console.error('DRIVER FAILED:', err);
  failures += 1;
} finally {
  server.kill();
}

// Verify every screenshot against the gate's limits.
for (const name of ['1-cover.jpg', '2-editor.jpg', '3-cover-portrait.jpg', '4-cover-square.jpg']) {
  const p = join(shotsDir, name);
  if (!existsSync(p)) {
    console.error(`MISSING ${name}`);
    failures += 1;
    continue;
  }
  const buf = (await import('node:fs')).readFileSync(p);
  const dims = jpegSize(buf);
  const long = Math.max(dims.width, dims.height);
  const short = Math.min(dims.width, dims.height);
  const ok = buf.length <= 262144 && long <= 1280 && short >= 480;
  report.push(`${name}: ${dims.width}x${dims.height}, ${buf.length} bytes, ${ok ? 'OK' : 'FAIL'}`);
  if (!ok) failures += 1;
}
console.log(report.join('\n'));
if (failures) {
  console.error(`${failures} failure(s)`);
  process.exit(1);
}
console.log('All screenshots verified.');
