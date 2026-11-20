// Tests for Vice Cover Studio's layout, caption and photo-transform logic
// (app/src/layout.js — pure functions, no DOM).
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  EXPORT_SIZES, LAYOUTS, captionBlock, clampTransform, fitCaptionSize,
  layoutById, panelsFor, photoDrawRect, pointInPanel, sanitizeCaption,
} from '../app/src/layout.js';

describe('layouts', () => {
  it('has six layouts, each with exactly one Simian hero panel', () => {
    assert.equal(LAYOUTS.length, 6);
    for (const layout of LAYOUTS) {
      const simian = layout.panels.filter((p) => p.kind === 'simian');
      const photos = layout.panels.filter((p) => p.kind === 'photo');
      assert.equal(simian.length, 1, `${layout.id} needs one simian panel`);
      assert.ok(photos.length >= 1, `${layout.id} needs a photo panel`);
    }
  });

  it('slash is the default layout', () => {
    assert.equal(layoutById('slash').id, 'slash');
    assert.equal(layoutById('no-such-layout').id, 'slash');
  });

  it('panels stay inside the cover and cover most of it', () => {
    for (const layout of LAYOUTS) {
      const panels = panelsFor(layout.id, 1080, 1080);
      let area = 0;
      for (const p of panels) {
        for (const [x, y] of p.points) {
          assert.ok(x >= 0 && x <= 1080 && y >= 0 && y <= 1080, `${layout.id} point out of bounds`);
        }
        area += p.bbox.width * p.bbox.height;
      }
      assert.ok(area >= 1080 * 1080 * 0.9, `${layout.id} covers too little: ${area}`);
    }
  });

  it('pointInPanel finds the panel under a click', () => {
    const panels = panelsFor('grid', 1000, 1000);
    assert.equal(panels.find((p) => pointInPanel(p, 250, 250))?.id, 'p0');
    assert.equal(panels.find((p) => pointInPanel(p, 750, 750))?.id, 'p3');
    assert.equal(panels.find((p) => pointInPanel(p, 750, 250))?.id, 'p1');
  });
});

describe('captions', () => {
  it('sanitizes: trims, collapses whitespace, caps at 60 chars', () => {
    assert.equal(sanitizeCaption('  SIMIAN   CITY  '), 'SIMIAN CITY');
    assert.equal(sanitizeCaption(''), '');
    assert.equal(sanitizeCaption(null), '');
    assert.equal(sanitizeCaption('x'.repeat(100)).length, 60);
  });

  it('empty caption fits at size 0 (nothing is drawn)', () => {
    assert.equal(fitCaptionSize('', 500, 100, () => 9999), 0);
    assert.equal(fitCaptionSize('   ', 500, 100, () => 9999), 0);
  });

  it('very long caption shrinks until it fits', () => {
    const size = fitCaptionSize('A'.repeat(60), 200, 120, (s) => s * 30);
    assert.ok(size < 120 && size >= 12, `shrunk to ${size}`);
  });

  it('short caption keeps its starting size', () => {
    assert.equal(fitCaptionSize('SIMIAN CITY', 1000, 120, (s) => s * 5), 120);
  });

  it('captionBlock scales with cover height', () => {
    const block = captionBlock('SIMIAN CITY', 'Cyber Jungle Nights', 1350);
    assert.equal(block.line1, 'SIMIAN CITY');
    assert.equal(block.line2, 'Cyber Jungle Nights');
    assert.ok(block.size1 > captionBlock('SIMIAN CITY', '', 1080).size1);
    assert.equal(captionBlock('', '', 1080).line1, '');
  });
});

describe('photo transforms', () => {
  it('clamps zoom and pan into range', () => {
    assert.deepEqual(clampTransform({ zoom: 9, offsetX: 5, offsetY: -5 }), { zoom: 4, offsetX: 1, offsetY: -1 });
    assert.deepEqual(clampTransform({ zoom: 0.1, offsetX: 0, offsetY: 0 }), { zoom: 0.5, offsetX: 0, offsetY: 0 });
    assert.deepEqual(clampTransform({}), { zoom: 1, offsetX: 0, offsetY: 0 });
  });

  it('cover-fits: a wide photo fills the height, a tall photo the width', () => {
    const bbox = { x: 0, y: 0, width: 400, height: 400 };
    const wide = photoDrawRect(800, 400, bbox, { zoom: 1, offsetX: 0, offsetY: 0 });
    assert.equal(wide.height, 400);
    assert.ok(wide.width > 400);
    const tall = photoDrawRect(400, 800, bbox, { zoom: 1, offsetX: 0, offsetY: 0 });
    assert.equal(tall.width, 400);
    assert.ok(tall.height > 400);
  });

  it('empty photo or empty bbox draws nothing', () => {
    const r = photoDrawRect(0, 0, { x: 0, y: 0, width: 100, height: 100 }, {});
    assert.equal(r.width, 0);
  });

  it('zoom 2 doubles the drawn size', () => {
    const bbox = { x: 0, y: 0, width: 400, height: 400 };
    const a = photoDrawRect(400, 400, bbox, { zoom: 1, offsetX: 0, offsetY: 0 });
    const b = photoDrawRect(400, 400, bbox, { zoom: 2, offsetX: 0, offsetY: 0 });
    assert.equal(b.width, a.width * 2);
  });
});

describe('export sizes', () => {
  it('offers exactly 1080x1080, 1080x1350 and 1920x1080', () => {
    assert.deepEqual(
      EXPORT_SIZES.map((s) => [s.width, s.height]),
      [[1080, 1080], [1080, 1350], [1920, 1080]],
    );
  });
});
