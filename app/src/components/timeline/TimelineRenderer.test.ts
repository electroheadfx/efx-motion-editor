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

describe('Motion Editor Group lifecycle regression boundary (43.2-17, D-05/D-38)', () => {
  it('keeps Group lifecycle copy, identity, status, tooltip, and navigation out of the Motion Editor renderer', () => {
    const code = source();
    const forbidden = [
      'syncState',
      'provenanceState',
      'linkedRotoLoopClipIds',
      'linkedRotoActionName',
      'selectedLoopClipId',
      'activeLinkedLoopClipId',
      'Linked Groups',
      'Synchronized with Action',
      'Modified locally',
      'Action detached',
      'Source Action unavailable',
      'TimelineCapsuleTooltip',
      'openPhysicPaintLoopEdit',
      'requestPhysicPaintLoopOperation',
    ];

    for (const symbol of forbidden) expect(code).not.toContain(symbol);
  });

  it('keeps the main-timeline projection limited to passive ranges and ordinary real-key diamonds', () => {
    const code = source();
    const markerStart = code.indexOf('private drawPhysicPaintRepeatDurationMarkers');
    const markerEnd = code.indexOf('private drawRotoKeyMarkers', markerStart);
    const markerSource = code.slice(markerStart, markerEnd);

    expect(markerStart).toBeGreaterThan(-1);
    expect(markerSource).toContain('marker.mode');
    expect(markerSource).toContain('ctx.fillRect(clippedLeft, markerY, clippedW, markerH)');
    for (const interactionSurface of ['addEventListener', 'hitTest', 'tooltip', 'selected', 'hover', 'focus', 'onClick']) {
      expect(markerSource).not.toContain(interactionSurface);
    }
  });
});

describe('Loop Clip rendering ownership (43-11, D-33R)', () => {
  it('projects layer-local passive marker geometry into main-timeline coordinates', async () => {
    const { getTimelineRepeatDurationMarkerGeometry, TRACK_HEADER_WIDTH } = await import('./TimelineRenderer');

    expect(getTimelineRepeatDurationMarkerGeometry({
      startFrame: 5,
      frameCount: 12,
      inFrame: 10,
      frameWidth: 4,
      scrollX: 12,
    })).toEqual({
      x: (10 + 5) * 4 - 12 + TRACK_HEADER_WIDTH,
      width: 12 * 4,
    });
  });

  it('draws exact passive strips without restoring the rich capsule path or interaction state', () => {
    const code = source();
    const markerIndex = code.indexOf('private drawPhysicPaintRepeatDurationMarkers');
    const markerSource = code.slice(markerIndex, code.indexOf('private drawRotoKeyMarkers'));
    const fxTrackSource = code.slice(
      code.indexOf('private drawFxTrack'),
      code.indexOf('/** Draw a Photoshop-style checkerboard'),
    );

    expect(markerIndex).toBeGreaterThan(-1);
    expect(markerSource).toContain("marker.mode === 'static' ? '#06B6D4' : '#8B5CF6'");
    expect(markerSource).toContain("ctx.fillStyle = '#F8FAFC'");
    expect(markerSource).toContain('markerX === clippedLeft');
    expect(markerSource).toContain('markerX + markerW === clippedRight');
    expect(markerSource).toContain('const markerY = barY + 1');
    expect(markerSource).toContain('const markerH = 3');
    expect(markerSource).toContain('Math.max(markerX, barX, TRACK_HEADER_WIDTH)');
    expect(markerSource).toContain('Math.min(markerX + markerW, barX + barW, canvasWidth)');
    expect(markerSource).toContain('ctx.fillRect(clippedLeft, markerY, clippedW, markerH)');
    expect(markerSource).not.toContain('fillText');
    expect(markerSource).not.toContain('selected');
    expect(markerSource).not.toContain('hover');
    expect(markerSource).not.toContain('focus');
    expect(markerSource).not.toContain('tooltip');

    expect(fxTrackSource).toContain('fxTrack.repeatDurationMarkers');
    expect(fxTrackSource).toContain('this.drawPhysicPaintRepeatDurationMarkers');
    expect(fxTrackSource.indexOf('this.drawPhysicPaintRepeatDurationMarkers')).toBeLessThan(
      fxTrackSource.indexOf('this.drawPhysicPaintPlayScriptMarkers'),
    );
    expect(fxTrackSource.indexOf('this.drawPhysicPaintRepeatDurationMarkers')).toBeLessThan(
      fxTrackSource.indexOf('this.drawRotoKeyMarkers'),
    );
    expect(fxTrackSource).not.toContain('this.drawLoopCapsules(');
    expect(fxTrackSource).not.toContain('fxTrack.loopCapsules');
  });
});

describe('rotoKeyFrames reactivity through fxTrackLayouts', () => {
  function makeRotoRecord(keyId: string, appFrame: number) {
    return {
      keyId,
      appFrame,
      kind: 'real-key' as const,
      payload: { frameIndex: 0, appFrame, dataUrl: 'data:image/png;base64,AAAA' },
    };
  }

  async function seedPhysicPaintFxSequence(layerId: string, sequenceId = 'fx-roto') {
    const { sequenceStore } = await import('../../stores/sequenceStore');
    const { defaultTransform } = await import('../../types/layer');
    const contentSequence = {
      id: 'seq-content',
      name: 'Content',
      kind: 'content',
      fps: 24,
      width: 1920,
      height: 1080,
      layers: [],
      keyPhotos: [{ id: 'kp-1', imageId: 'img-1', holdFrames: 2 }],
    };
    const fxSequence = {
      id: sequenceId,
      name: 'Roto FX',
      kind: 'fx',
      fps: 24,
      width: 1920,
      height: 1080,
      keyPhotos: [],
      layers: [{
        id: layerId,
        name: 'Roto',
        type: 'physic-paint',
        visible: true,
        opacity: 1,
        blendMode: 'normal',
        transform: defaultTransform(),
        source: { type: 'physic-paint', layerId },
      }],
      inFrame: 0,
      outFrame: 12,
    };
    sequenceStore.sequences.value = [contentSequence, fxSequence] as never;
    return sequenceId;
  }

  it('exposes exactly the seeded real key appFrames (generated interiors never appear)', async () => {
    const { physicPaintStore } = await import('../../stores/physicPaintStore');
    const { fxTrackLayouts } = await import('../../lib/frameMap');
    const sequenceId = await seedPhysicPaintFxSequence('roto-layer');

    // Real keys at 0, 4, 8 with interpolation enabled derive generated interiors
    // 1-3 and 5-7; rotoKeyFrames must carry real keys only (D-07).
    const seeded = physicPaintStore.replaceRotoPhysicalRecords(
      'roto-layer',
      [makeRotoRecord('key-0', 0), makeRotoRecord('key-4', 4), makeRotoRecord('key-8', 8)],
      { enabled: true, mode: 'duplicate' },
      600,
    );
    if (!seeded.ok) throw new Error(seeded.error);

    const layout = fxTrackLayouts.value.find((track) => track.sequenceId === sequenceId);
    expect(layout?.layerType).toBe('physic-paint');
    expect(layout?.rotoKeyFrames).toEqual([0, 4, 8]);
  });

  it('recomputes rotoKeyFrames when replaceRotoPhysicalRecords changes the record set', async () => {
    const { physicPaintStore } = await import('../../stores/physicPaintStore');
    const { fxTrackLayouts } = await import('../../lib/frameMap');
    const sequenceId = await seedPhysicPaintFxSequence('roto-layer');

    const first = physicPaintStore.replaceRotoPhysicalRecords(
      'roto-layer',
      [makeRotoRecord('key-0', 0), makeRotoRecord('key-4', 4), makeRotoRecord('key-8', 8)],
      { enabled: false, mode: 'duplicate' },
      600,
    );
    if (!first.ok) throw new Error(first.error);
    expect(fxTrackLayouts.value.find((track) => track.sequenceId === sequenceId)?.rotoKeyFrames).toEqual([0, 4, 8]);

    const second = physicPaintStore.replaceRotoPhysicalRecords(
      'roto-layer',
      [makeRotoRecord('key-a', 2), makeRotoRecord('key-b', 7)],
      { enabled: false, mode: 'duplicate' },
      600,
    );
    if (!second.ok) throw new Error(second.error);

    // No manual invalidation: the existing physicPaintVersion subscription drives the recompute.
    expect(fxTrackLayouts.value.find((track) => track.sequenceId === sequenceId)?.rotoKeyFrames).toEqual([2, 7]);
  });

  it('leaves rotoKeyFrames undefined for non-physic-paint FX layers', async () => {
    const { sequenceStore } = await import('../../stores/sequenceStore');
    const { defaultTransform } = await import('../../types/layer');
    const { fxTrackLayouts } = await import('../../lib/frameMap');

    sequenceStore.sequences.value = [{
      id: 'fx-grain',
      name: 'Film Grain',
      kind: 'fx',
      fps: 24,
      width: 1920,
      height: 1080,
      keyPhotos: [],
      layers: [{
        id: 'grain-layer',
        name: 'Film Grain',
        type: 'generator-grain',
        visible: true,
        opacity: 1,
        blendMode: 'normal',
        transform: defaultTransform(),
        source: { type: 'generator-grain', density: 0.3, size: 1, intensity: 0.5, lockSeed: true, seed: 42 },
      }],
      inFrame: 0,
      outFrame: 12,
    }] as never;

    const layout = fxTrackLayouts.value.find((track) => track.sequenceId === 'fx-grain');
    expect(layout?.layerType).toBe('generator-grain');
    expect(layout?.rotoKeyFrames).toBeUndefined();
  });
});
