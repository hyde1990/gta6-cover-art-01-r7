// Vice Cover Studio — wires the editor: photos in, layout, caption, glow,
// panel crop and position, PNG export. A `?shot=` query sets up a fixed
// scene for a screenshot instead (./shots.js).
import { drawCover } from './cover.js';
import { applyGrade } from './glgrade.js';
import { DEFAULT_CAPTION, EXPORT_SIZES, LAYOUTS, clampTransform, panelsFor, pointInPanel } from './layout.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const offscreen = document.createElement('canvas');
const statusEl = document.getElementById('status');
const panelName = document.getElementById('panelName');
const glowInput = document.getElementById('glow');
const glowValue = document.getElementById('glowValue');
const zoomInput = document.getElementById('zoom');
const panXInput = document.getElementById('panX');
const panYInput = document.getElementById('panY');

const state = {
  layoutId: 'slash',
  sizeId: 'square',
  caption1: DEFAULT_CAPTION.line1,
  caption2: DEFAULT_CAPTION.line2,
  glow: 0.6,
  sweepOn: true,
  photos: {}, // panelId -> { img, transform }
  library: [], // loaded images, in load order
  selectedPanel: null,
};

let dirty = true;
let lastFrame = 0;

export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

function photoPanels() {
  return panelsFor(state.layoutId, 1, 1).filter((p) => p.kind === 'photo');
}

/** Assign the loaded library across the photo panels (cycling if needed). */
function dealPhotos() {
  const panels = photoPanels();
  state.photos = {};
  if (state.library.length === 0) return;
  if (state.library.length === 1) {
    for (const p of panels) state.photos[p.id] = { img: state.library[0], transform: { zoom: 1, offsetX: 0, offsetY: 0 } };
  } else {
    panels.forEach((p, i) => {
      state.photos[p.id] = { img: state.library[i % state.library.length], transform: { zoom: 1, offsetX: 0, offsetY: 0 } };
    });
  }
}

function sizeFor(id) {
  return EXPORT_SIZES.find((s) => s.id === id) ?? EXPORT_SIZES[0];
}

function previewSize() {
  const s = sizeFor(state.sizeId);
  const w = 720;
  return { width: w, height: Math.round((w * s.height) / s.width) };
}

/** Paint the preview: 2D cover, then the WebGL2 neon grade when available. */
function redraw(now = 0) {
  const { width, height } = previewSize();
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  offscreen.width = width;
  offscreen.height = height;
  const sweep = state.sweepOn ? (now / 3000) % 1 : null;
  const octx = offscreen.getContext('2d');
  drawCover(octx, width, height, {
    layoutId: state.layoutId,
    photos: state.photos,
    caption1: state.caption1,
    caption2: state.caption2,
    glow: state.glow,
    sweep,
    time: now / 1000,
  });
  if (!applyGrade(offscreen, canvas, { intensity: 0.8, time: now / 1000 })) {
    canvas.getContext('2d').drawImage(offscreen, 0, 0);
  }
  dirty = false;
}

function frame(now) {
  if (state.sweepOn || dirty) redraw(now);
  lastFrame = now;
  requestAnimationFrame(frame);
}

function markDirty() {
  dirty = true;
}

/** Render and download the cover at an export size. Returns the PNG blob. */
export async function exportPNG(sizeId) {
  const size = sizeFor(sizeId ?? state.sizeId);
  const work = document.createElement('canvas');
  work.width = size.width;
  work.height = size.height;
  drawCover(work.getContext('2d'), size.width, size.height, {
    layoutId: state.layoutId,
    photos: state.photos,
    caption1: state.caption1,
    caption2: state.caption2,
    glow: state.glow,
    sweep: 0.35,
    time: 0.6,
  });
  const graded = document.createElement('canvas');
  const done = applyGrade(work, graded, { intensity: 0.8, time: 0.6 });
  const target = done ? graded : work;
  const blob = await new Promise((resolve) => target.toBlob(resolve, 'image/png'));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `vice-cover-${size.id}-${size.width}x${size.height}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
  statusEl.textContent = `Saved ${a.download}`;
  return blob;
}

// --- controls -------------------------------------------------------------

const layoutsEl = document.getElementById('layouts');
for (const layout of LAYOUTS) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = layout.name;
  b.setAttribute('aria-pressed', String(layout.id === state.layoutId));
  b.addEventListener('click', () => {
    state.layoutId = layout.id;
    state.selectedPanel = null;
    panelName.textContent = 'No panel selected.';
    for (const other of layoutsEl.querySelectorAll('button')) {
      other.setAttribute('aria-pressed', String(other === b));
    }
    dealPhotos();
    markDirty();
  });
  layoutsEl.appendChild(b);
}

const sizesEl = document.getElementById('sizes');
for (const size of EXPORT_SIZES) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = size.label;
  b.setAttribute('aria-pressed', String(size.id === state.sizeId));
  b.addEventListener('click', () => {
    state.sizeId = size.id;
    for (const other of sizesEl.querySelectorAll('button')) {
      other.setAttribute('aria-pressed', String(other === b));
    }
    markDirty();
  });
  sizesEl.appendChild(b);
}

document.getElementById('photos').addEventListener('change', async (e) => {
  const files = [...(e.target.files ?? [])];
  if (!files.length) return;
  const loaded = [];
  for (const file of files) {
    try {
      loaded.push(await loadImage(URL.createObjectURL(file)));
    } catch {
      statusEl.textContent = `Could not read ${file.name}.`;
    }
  }
  if (loaded.length) {
    state.library = loaded;
    dealPhotos();
    markDirty();
    statusEl.textContent = `${loaded.length} photo${loaded.length > 1 ? 's' : ''} loaded.`;
  }
});

document.getElementById('caption1').addEventListener('input', (e) => {
  state.caption1 = e.target.value;
  markDirty();
});
document.getElementById('caption2').addEventListener('input', (e) => {
  state.caption2 = e.target.value;
  markDirty();
});
glowInput.addEventListener('input', () => {
  state.glow = Number(glowInput.value) / 100;
  glowValue.textContent = `${glowInput.value}%`;
  markDirty();
});
document.getElementById('sweep').addEventListener('change', (e) => {
  state.sweepOn = e.target.checked;
  markDirty();
});
document.getElementById('export').addEventListener('click', () => {
  exportPNG(state.sizeId).catch(() => {
    statusEl.textContent = 'Export failed in this browser.';
  });
});
document.getElementById('fillAll').addEventListener('click', () => {
  if (!state.library.length) {
    statusEl.textContent = 'Add a photo first.';
    return;
  }
  for (const p of photoPanels()) {
    state.photos[p.id] = { img: state.library[0], transform: { zoom: 1, offsetX: 0, offsetY: 0 } };
  }
  markDirty();
  statusEl.textContent = 'All panels use the first photo.';
});

function syncPanelSliders() {
  const entry = state.selectedPanel ? state.photos[state.selectedPanel] : null;
  const t = entry ? clampTransform(entry.transform) : { zoom: 1, offsetX: 0, offsetY: 0 };
  zoomInput.value = String(Math.round(t.zoom * 100));
  panXInput.value = String(Math.round(t.offsetX * 100));
  panYInput.value = String(Math.round(t.offsetY * 100));
}

function applyPanelSliders() {
  if (!state.selectedPanel || !state.photos[state.selectedPanel]) return;
  state.photos[state.selectedPanel].transform = clampTransform({
    zoom: Number(zoomInput.value) / 100,
    offsetX: Number(panXInput.value) / 100,
    offsetY: Number(panYInput.value) / 100,
  });
  markDirty();
}
zoomInput.addEventListener('input', applyPanelSliders);
panXInput.addEventListener('input', applyPanelSliders);
panYInput.addEventListener('input', applyPanelSliders);

canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
  const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
  const panels = panelsFor(state.layoutId, canvas.width, canvas.height);
  const hit = panels.find((p) => pointInPanel(p, x, y));
  if (!hit) return;
  state.selectedPanel = hit.id;
  panelName.textContent = hit.kind === 'simian'
    ? 'Simian Prime hero panel (drawn by code).'
    : `Photo panel ${hit.id} selected — zoom and pan it below.`;
  syncPanelSliders();
});

// --- shot + test hooks ----------------------------------------------------

const api = {
  setLayout(id) {
    state.layoutId = id;
    dealPhotos();
    markDirty();
  },
  setSize(id) {
    state.sizeId = id;
    markDirty();
  },
  setCaption(line1, line2) {
    state.caption1 = line1;
    state.caption2 = line2;
    document.getElementById('caption1').value = line1;
    document.getElementById('caption2').value = line2;
    markDirty();
  },
  async loadSample(url) {
    const img = await loadImage(url);
    state.library = [img];
    dealPhotos();
    markDirty();
  },
  redraw: () => redraw(lastFrame),
  exportPNG,
  state,
};
window.__vice = api;

const query = new URLSearchParams(location.search);
const shot = query.get('shot');
if (shot) {
  runShot(shot, query, api).catch((err) => {
    statusEl.textContent = `Shot failed: ${err.message}`;
  });
}
requestAnimationFrame(frame);
