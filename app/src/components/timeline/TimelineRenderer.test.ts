import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Layer } from '../../types/layer';

vi.mock('../../lib/previewRenderer', () => ({
  createCanvasGradient: vi.fn(),
}));

afterEach(async () => {
  vi.restoreAllMocks();
  const { sequenceStore } = await import('../../stores/sequenceStore');
  const { physicPaintStore } = await import('../../stores/physicPaintStore');
  sequenceStore.sequences.value = [];
  sequenceStore.activeSequenceId.value = null;
  physicPaintStore.reset();
});

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

  it('threads saved Play ranges into one physic-paint FX layout with only the containing range active', async () => {
    const { defaultTransform } = await import('../../types/layer');
    const { fxTrackLayouts } = await import('../../lib/frameMap');
    const { sequenceStore } = await import('../../stores/sequenceStore');
    const { physicPaintStore } = await import('../../stores/physicPaintStore');
    const { timelineStore } = await import('../../stores/timelineStore');

    const layer: Layer = {
      id: 'render-layer-1',
      name: 'Physics Paint',
      type: 'physic-paint',
      visible: true,
      opacity: 1,
      blendMode: 'normal',
      transform: defaultTransform(),
      source: { type: 'physic-paint', layerId: 'phys-source-1' },
    };
    sequenceStore.add({
      id: 'fx-physic-paint',
      kind: 'fx',
      name: 'Physics Paint FX',
      fps: 24,
      width: 1920,
      height: 1080,
      keyPhotos: [],
      layers: [layer],
      inFrame: 0,
      outFrame: 40,
    });
    for (const range of [
      { id: 'play-0', startFrame: 0, frameCount: 5 },
      { id: 'play-8', startFrame: 8, frameCount: 16 },
      { id: 'play-30', startFrame: 30, frameCount: 5 },
    ]) {
      physicPaintStore.upsertPlayScriptRange('phys-source-1', {
        ...range,
        editableState: { version: 2, width: 1000, height: 650, strokes: [], settings: { bgMode: 'canvas1', paperGrain: 'canvas1', embossStrength: 0.45, wetPaper: true } },
        source: 'play',
        cacheStatus: 'cached',
      });
    }

    timelineStore.currentFrame.value = 10;
    expect(fxTrackLayouts.value).toHaveLength(1);
    expect(fxTrackLayouts.value[0].playScriptMarkers).toEqual([
      { id: 'play-0', startFrame: 0, frameCount: 5, active: false },
      { id: 'play-8', startFrame: 8, frameCount: 16, active: true },
      { id: 'play-30', startFrame: 30, frameCount: 5, active: false },
    ]);

    timelineStore.currentFrame.value = 6;
    expect(fxTrackLayouts.value[0].playScriptMarkers).toEqual([
      { id: 'play-0', startFrame: 0, frameCount: 5, active: false },
      { id: 'play-8', startFrame: 8, frameCount: 16, active: false },
      { id: 'play-30', startFrame: 30, frameCount: 5, active: false },
    ]);
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
