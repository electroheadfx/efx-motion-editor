import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/previewRenderer', () => ({
  createCanvasGradient: vi.fn(),
}));

const sourcePath = resolve(dirname(fileURLToPath(import.meta.url)), 'TimelineRenderer.ts');
const source = () => readFileSync(sourcePath, 'utf8');

describe('TimelineRenderer play script marker geometry', () => {
  it('maps marker frame range through timeline zoom and scroll math', async () => {
    const { TRACK_HEADER_WIDTH, getTimelinePlayScriptMarkerGeometry } = await import('./TimelineRenderer');
    const geometry = getTimelinePlayScriptMarkerGeometry(
      { id: 'play-8', startFrame: 8, frameCount: 4, active: false },
      60,
      120,
    );

    expect(geometry.x).toBe(8 * 60 - 120 + TRACK_HEADER_WIDTH);
    expect(geometry.width).toBe(4 * 60);
  });
});

describe('TimelineRenderer play script marker source contract', () => {
  it('receives play script marker data through timeline layout without importing the physics store', () => {
    const code = source();

    expect(code).toContain('playScriptMarkers');
    expect(code).toContain('TimelinePlayScriptMarker');
    expect(code).not.toContain('physicPaintStore');
  });

  it('keeps marker UI graphical without frame badge or ASCII range rendering', () => {
    const code = source();

    const markerSource = code.slice(
      code.indexOf('export interface TimelinePlayScriptMarkerGeometry'),
      code.indexOf('// Functional colors'),
    );

    for (const literal of ['[4]', '---', '|-----|']) {
      expect(markerSource).not.toContain(literal);
    }
    expect(markerSource).not.toMatch(/fillText\([^)]*startFrame/);
    expect(markerSource).not.toMatch(/fillText\([^)]*frameCount/);
  });

  it('draws nested polished marker ranges with endpoints and active/subdued styles', () => {
    const code = source();
    const markerDrawIndex = code.indexOf('drawPhysicPaintPlayScriptMarkers');
    const markerDrawSource = code.slice(markerDrawIndex, markerDrawIndex + 2600);

    expect(markerDrawIndex).toBeGreaterThan(-1);
    expect(markerDrawSource).toContain('ctx.roundRect');
    expect(markerDrawSource).toContain('ctx.arc');
    expect(markerDrawSource).toContain('marker.active');
    expect(markerDrawSource).toContain('colors.accent');
    expect(markerDrawSource).toContain('rgba(255, 255, 255, 0.38)');
    expect(markerDrawSource).toContain('Math.max(markerX, barX, TRACK_HEADER_WIDTH)');
    expect(markerDrawSource).toContain('Math.min(markerX + markerW, barX + barW, canvasWidth)');
  });

  it('draws play script markers inside physic-paint FX bars without DOM rows or overlays', () => {
    const code = source();
    const fxTrackSource = code.slice(code.indexOf('private drawFxTrack'), code.indexOf('/** Draw a Photoshop-style checkerboard'));

    expect(fxTrackSource).toContain("fxTrack.layerType === 'physic-paint'");
    expect(fxTrackSource).toContain('this.drawPhysicPaintPlayScriptMarkers');
    expect(code).not.toContain('document.createElement');
    expect(code).not.toContain('play-script-row');
  });
});
