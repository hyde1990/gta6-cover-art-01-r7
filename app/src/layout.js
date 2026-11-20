// Vice Cover Studio — layout, caption and photo-transform logic.
//
// Pure functions only: no DOM, no canvas. Node tests import this module
// directly, and the browser app imports it too, so the numbers the tests
// check are the numbers the app draws.
//
// A layout is a set of panels. Each panel is a polygon (fractions of the
// cover, 0..1) plus a bounding box the photo fit uses. Exactly one panel
// per layout is the Simian Prime hero panel, drawn by code; the rest are
// photo panels the user's photos fill.

export const EXPORT_SIZES = [
  { id: 'square', label: '1080 x 1080', width: 1080, height: 1080 },
  { id: 'portrait', label: '1080 x 1350', width: 1080, height: 1350 },
  { id: 'wide', label: '1920 x 1080', width: 1920, height: 1080 },
];

export const DEFAULT_CAPTION = { line1: 'SIMIAN CITY', line2: 'Cyber Jungle Nights' };
export const MAX_CAPTION_CHARS = 60;

// points are [x, y] fractions; kind 'photo' or 'simian'.
export const LAYOUTS = [
  {
    id: 'slash',
    name: 'Slash',
    panels: [
      { id: 'p0', kind: 'photo', points: [[0, 0], [0.56, 0], [0.38, 1], [0, 1]] },
      { id: 'p1', kind: 'simian', points: [[0.56, 0], [0.84, 0], [0.66, 1], [0.38, 1]] },
      { id: 'p2', kind: 'photo', points: [[0.84, 0], [1, 0], [1, 1], [0.66, 1]] },
    ],
  },
  {
    id: 'grid',
    name: 'Grid',
    panels: [
      { id: 'p0', kind: 'photo', points: [[0, 0], [0.5, 0], [0.5, 0.5], [0, 0.5]] },
      { id: 'p1', kind: 'photo', points: [[0.5, 0], [1, 0], [1, 0.5], [0.5, 0.5]] },
      { id: 'p2', kind: 'photo', points: [[0, 0.5], [0.5, 0.5], [0.5, 1], [0, 1]] },
      { id: 'p3', kind: 'simian', points: [[0.5, 0.5], [1, 0.5], [1, 1], [0.5, 1]] },
    ],
  },
  {
    id: 'trio',
    name: 'Trio',
    panels: [
      { id: 'p0', kind: 'photo', points: [[0, 0], [0.58, 0], [0.58, 1], [0, 1]] },
      { id: 'p1', kind: 'photo', points: [[0.58, 0], [1, 0], [1, 0.5], [0.58, 0.5]] },
      { id: 'p2', kind: 'simian', points: [[0.58, 0.5], [1, 0.5], [1, 1], [0.58, 1]] },
    ],
  },
  {
    id: 'strips',
    name: 'Strips',
    panels: [
      { id: 'p0', kind: 'photo', points: [[0, 0], [0.34, 0], [0.34, 1], [0, 1]] },
      { id: 'p1', kind: 'simian', points: [[0.34, 0], [0.66, 0], [0.66, 1], [0.34, 1]] },
      { id: 'p2', kind: 'photo', points: [[0.66, 0], [1, 0], [1, 1], [0.66, 1]] },
    ],
  },
  {
    id: 'duo',
    name: 'Duo',
    panels: [
      { id: 'p0', kind: 'photo', points: [[0, 0], [0.55, 0], [0.55, 1], [0, 1]] },
      { id: 'p1', kind: 'simian', points: [[0.55, 0], [1, 0], [1, 1], [0.55, 1]] },
    ],
  },
  {
    id: 'center',
    name: 'Center',
    panels: [
      { id: 'p0', kind: 'photo', points: [[0, 0], [0.24, 0], [0.24, 1], [0, 1]] },
      { id: 'p1', kind: 'simian', points: [[0.24, 0], [0.76, 0], [0.76, 1], [0.24, 1]] },
      { id: 'p2', kind: 'photo', points: [[0.76, 0], [1, 0], [1, 1], [0.76, 1]] },
    ],
  },
];

export function layoutById(id) {
  return LAYOUTS.find((l) => l.id === id) ?? LAYOUTS[0];
}

/** Panels of a layout in pixels for a cover of width w and height h. */
export function panelsFor(layoutId, w, h) {
  const layout = layoutById(layoutId);
  return layout.panels.map((p) => {
    const pts = p.points.map(([fx, fy]) => [fx * w, fy * h]);
    const xs = pts.map(([x]) => x);
    const ys = pts.map(([, y]) => y);
    const bx = Math.min(...xs);
    const by = Math.min(...ys);
    return {
      id: p.id,
      kind: p.kind,
      points: pts,
      bbox: { x: bx, y: by, width: Math.max(...xs) - bx, height: Math.max(...ys) - by },
    };
  });
}

/** True when (x, y) in pixels lies inside the panel polygon (ray casting). */
export function pointInPanel(panel, x, y) {
  const pts = panel.points;
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Clean a caption line: trim, collapse whitespace, cap the length. */
export function sanitizeCaption(text) {
  return String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_CAPTION_CHARS);
}

/**
 * Largest font size (px) at which `text` fits `maxWidth`, shrinking from
 * `startSize` by `step` down to `minSize`. `measure(size)` returns the
 * text width at that size. Returns 0 for an empty caption.
 */
export function fitCaptionSize(text, maxWidth, startSize, measure, step = 2, minSize = 12) {
  const clean = sanitizeCaption(text);
  if (!clean) return 0;
  let size = startSize;
  while (size > minSize && measure(size) > maxWidth) size -= step;
  return size;
}

/** Clamp a per-panel photo transform (zoom 0.5..4, pan offsets -1..1). */
export function clampTransform(t) {
  const z = Math.min(4, Math.max(0.5, Number(t?.zoom) || 1));
  const x = Math.min(1, Math.max(-1, Number(t?.offsetX) || 0));
  const y = Math.min(1, Math.max(-1, Number(t?.offsetY) || 0));
  return { zoom: z, offsetX: x, offsetY: y };
}

/**
 * Where a photo of natural size (iw, ih) is drawn inside a bbox, cover-fit
 * with a zoom and pan. Returns {x, y, width, height} in the bbox's space.
 * Pan moves the photo by a fraction of the overflow on each axis.
 */
export function photoDrawRect(iw, ih, bbox, transform) {
  const t = clampTransform(transform);
  if (!iw || !ih || !bbox.width || !bbox.height) return { x: bbox.x, y: bbox.y, width: 0, height: 0 };
  const base = Math.max(bbox.width / iw, bbox.height / ih) * t.zoom;
  const w = iw * base;
  const h = ih * base;
  const overX = Math.max(0, w - bbox.width);
  const overY = Math.max(0, h - bbox.height);
  return {
    x: bbox.x + (bbox.width - w) / 2 - t.offsetX * overX * 0.5,
    y: bbox.y + (bbox.height - h) / 2 - t.offsetY * overY * 0.5,
    width: w,
    height: h,
  };
}

/** The caption block the cover draws: two lines, sizes relative to height. */
export function captionBlock(line1, line2, height) {
  const top = sanitizeCaption(line1);
  const sub = sanitizeCaption(line2);
  return {
    line1: top,
    line2: sub,
    size1: height * 0.115,
    size2: height * 0.042,
    y1: height * 0.86,
    y2: height * 0.925,
  };
}
