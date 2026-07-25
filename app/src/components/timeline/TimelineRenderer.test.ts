import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

const frameMapSourcePath = resolve(dirname(fileURLToPath(import.meta.url)), '../../lib/frameMap.ts');
const frameMapSource = () => readFileSync(frameMapSourcePath, 'utf8');

describe('TimelineRenderer play script marker geometry', () => {
  it('uses the derived FX header label with sequence-name fallback and matching reorder ghost', async () => {
    const { getTimelineFxHeaderLabel, getTimelinePlayScriptLabel } = await import('./TimelineRenderer');

    expect(getTimelineFxHeaderLabel({
      layerType: 'physic-paint',
      sequenceName: 'Physic Paint',
      headerLabel: 'PPaint #2',
    })).toBe('PPaint #2');
    expect(getTimelineFxHeaderLabel({
      layerType: 'physic-paint',
      sequenceName: 'Physic Paint',
    })).toBe('Physic Paint');
    expect(getTimelineFxHeaderLabel({
      layerType: 'paint',
      sequenceName: 'Paint',
    })).toBe('Paint');
    expect(source()).toContain('getTimelineFxHeaderLabel(ghostTrack)');
    expect(getTimelinePlayScriptLabel(0)).toBe('Play #2');
    expect(getTimelinePlayScriptLabel(1)).toBe('Play #3');
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
    const markerDrawSource = code.slice(markerDrawIndex, markerDrawIndex + 3600);

    expect(markerDrawIndex).toBeGreaterThan(-1);
    expect(markerDrawSource).toContain('ctx.roundRect');
    expect(markerDrawSource).toContain('ctx.arc');
    expect(markerDrawSource).toContain('marker.active');
    expect(markerDrawSource).toContain('colors.accent');
    expect(markerDrawSource).toContain('rgba(255, 255, 255, 0.38)');
    expect(markerDrawSource).toContain('Math.max(10, Math.min(14, Math.round(barH * 0.7)))');
    expect(markerDrawSource).toContain('const rangeY = barY + barH - rangeH - 2');
    expect(markerDrawSource).toContain('getTimelinePlayScriptLabel(index)');
    expect(markerDrawSource).toContain("ctx.font = '600 10px system-ui, sans-serif'");
    expect(markerDrawSource).toContain('ctx.fillText(this.truncateText(ctx, label, labelMaxW), labelX, centerY)');
    expect(markerDrawSource).toContain('Math.max(markerX, barX, TRACK_HEADER_WIDTH)');
    expect(markerDrawSource).toContain('Math.min(markerX + markerW, barX + barW, canvasWidth)');
  });

  it('draws play script markers inside physic-paint FX bars without DOM rows or overlays', () => {
    const code = source();
    const fxTrackSource = code.slice(code.indexOf('private drawFxTrack'), code.indexOf('/** Draw a Photoshop-style checkerboard'));

    expect(fxTrackSource).toContain("fxTrack.layerType === 'physic-paint'");
    expect(fxTrackSource).toContain('this.drawPhysicPaintPlayScriptMarkers');
    expect(fxTrackSource).toContain("fxTrack.layerType !== 'physic-paint'");
    expect(fxTrackSource).toContain("ctx.font = '600 10px system-ui, sans-serif'");
    expect(code).not.toContain('document.createElement');
    expect(code).not.toContain('play-script-row');
  });
});

describe('physic-paint Roto key markers (C-04)', () => {
  it('computes marker x from (inFrame + appFrame) * frameWidth - scrollX + TRACK_HEADER_WIDTH', async () => {
    const { getPhysicPaintRotoKeyMarkerGeometry, TRACK_HEADER_WIDTH } = await import('./TimelineRenderer');

    const geometry = getPhysicPaintRotoKeyMarkerGeometry({ appFrame: 5, inFrame: 0, frameWidth: 4, scrollX: 12 });
    expect(geometry.x).toBe((0 + 5) * 4 - 12 + TRACK_HEADER_WIDTH);
  });

  it('adds nonzero inFrame to the layer-local appFrame (layer-local vs timeline-global guard)', async () => {
    const { getPhysicPaintRotoKeyMarkerGeometry, TRACK_HEADER_WIDTH } = await import('./TimelineRenderer');

    const geometry = getPhysicPaintRotoKeyMarkerGeometry({ appFrame: 5, inFrame: 10, frameWidth: 4, scrollX: 12 });
    expect(geometry.x).toBe((10 + 5) * 4 - 12 + TRACK_HEADER_WIDTH);
  });

  it('draws always-visible roto key diamonds in the physic-paint branch with the dedicated #F5A623 fill', () => {
    const code = source();
    const fxTrackSource = code.slice(code.indexOf('private drawFxTrack'), code.indexOf('/** Draw a Photoshop-style checkerboard'));

    expect(fxTrackSource).toContain("fxTrack.layerType === 'physic-paint'");
    expect(fxTrackSource).toContain('fxTrack.rotoKeyFrames');
    expect(fxTrackSource).toContain('drawRotoKeyMarkers');

    // The marker pass is gated on rotoKeyFrames, never on playScriptMarkers
    const gateIndex = fxTrackSource.indexOf('fxTrack.rotoKeyFrames');
    const gateLineStart = fxTrackSource.lastIndexOf('\n', gateIndex);
    const gateLineEnd = fxTrackSource.indexOf('\n', gateIndex);
    const gateLine = fxTrackSource.slice(gateLineStart, gateLineEnd);
    expect(gateLine).not.toContain('playScriptMarkers');

    // Marker path: literal #F5A623 fill, no stroke, no shadow, no playScriptMarkers coupling
    const markerIndex = code.indexOf('private drawRotoKeyMarkers');
    expect(markerIndex).toBeGreaterThan(-1);
    const markerSource = code.slice(markerIndex, code.indexOf('private drawFxTrack'));
    expect(markerSource).toContain("'#F5A623'");
    expect(markerSource).not.toContain('playScriptMarkers');
    expect(markerSource).not.toContain('shadowColor');
    expect(markerSource).not.toContain('strokeStyle');
  });

  it('populates rotoKeyFrames from real Roto key records for physic-paint layers only', () => {
    const code = frameMapSource();
    const fxLayoutsIndex = code.indexOf('export const fxTrackLayouts');
    expect(fxLayoutsIndex).toBeGreaterThan(-1);
    const fxLayoutsSource = code.slice(fxLayoutsIndex);

    expect(fxLayoutsSource).toContain('rotoKeyFrames');
    expect(fxLayoutsSource).toContain("primaryLayer?.type === 'physic-paint'");
    expect(fxLayoutsSource).toContain('getRotoRealKeyRecords');
  });
});
