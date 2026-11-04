import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { testWebpBytes } from '../../testUtils/testWebpBytes';
// 46-01: runtime state is per-track; tests exercise the document's ACTIVE track.
const TEST_TRACK_ID = 'track-1';

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
    expect(markerDrawSource).toContain('palette.line');
    expect(markerDrawSource).toContain("withAlpha(palette.line, '66')");
    expect(markerDrawSource).not.toContain('getThemeColors');
    expect(markerDrawSource).not.toContain('colors.accent');
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
  it('anchors the key on the frame left edge, the same x as the ruler tick and playhead', async () => {
    const { getPhysicPaintRotoKeyMarkerGeometry, TRACK_HEADER_WIDTH } = await import('./TimelineRenderer');

    const geometry = getPhysicPaintRotoKeyMarkerGeometry({ appFrame: 5, inFrame: 0, frameWidth: 4, scrollX: 12 });
    expect(geometry.x).toBe((0 + 5) * 4 - 12 + TRACK_HEADER_WIDTH);
  });

  it('adds nonzero inFrame to the layer-local appFrame (layer-local vs timeline-global guard)', async () => {
    const { getPhysicPaintRotoKeyMarkerGeometry, TRACK_HEADER_WIDTH } = await import('./TimelineRenderer');

    const geometry = getPhysicPaintRotoKeyMarkerGeometry({ appFrame: 5, inFrame: 10, frameWidth: 4, scrollX: 12 });
    expect(geometry.x).toBe((10 + 5) * 4 - 12 + TRACK_HEADER_WIDTH);
  });

  it('clamps the key half-size between 2px and 5px as the zoom changes', async () => {
    const { getPhysicPaintRotoKeyMarkerHalfSize } = await import('./TimelineRenderer');

    expect(getPhysicPaintRotoKeyMarkerHalfSize(60)).toBe(5);
    expect(getPhysicPaintRotoKeyMarkerHalfSize(20)).toBe(5);
    expect(getPhysicPaintRotoKeyMarkerHalfSize(10)).toBe(3);
    expect(getPhysicPaintRotoKeyMarkerHalfSize(4)).toBe(2);
  });

  it('draws always-visible roto key diamonds in the physic-paint branch from the rail palette', () => {
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

    // Marker path: palette key fill + explicit key-rim stroke, no legacy
    // orange literal, no shadow, no playScriptMarkers coupling.
    const markerIndex = code.indexOf('private drawRotoKeyMarkers');
    expect(markerIndex).toBeGreaterThan(-1);
    const markerSource = code.slice(markerIndex, code.indexOf('private drawFxTrack'));
    expect(markerSource).toContain('palette.keyFill');
    expect(markerSource).toContain('ctx.fillStyle = palette.keyFill');
    expect(markerSource).toContain('palette.keyRim');
    expect(markerSource).toContain('ctx.strokeStyle = palette.keyRim');
    expect(markerSource).toContain('ctx.stroke()');
    expect(markerSource).toContain('getPhysicPaintRotoKeyMarkerHalfSize(frameWidth)');
    expect(markerSource).toContain('ctx.rect(TRACK_HEADER_WIDTH, barY, canvasWidth - TRACK_HEADER_WIDTH, barH)');
    expect(markerSource).not.toContain("'#F5A623'");
    expect(markerSource).not.toContain('playScriptMarkers');
    expect(markerSource).not.toContain('shadowColor');
  });

  it('draws stacked keys once per x (no doubled fill on the same frame)', () => {
    const code = source();
    const markerSource = code.slice(code.indexOf('private drawRotoKeyMarkers'), code.indexOf('private drawFxTrack'));

    expect(markerSource).toContain('const drawnX = new Set<number>()');
    expect(markerSource).toContain('if (drawnX.has(stackedKey)) continue');
    expect(markerSource).toContain('drawnX.add(stackedKey)');
  });

  it('joins keys with a straight line, splitting to a sine line across cycle frames', () => {
    const code = source();
    const markerSource = code.slice(code.indexOf('private drawRotoKeyMarkers'), code.indexOf('private drawFxTrack'));

    // Key-to-key connector at the diamond centre line.
    expect(markerSource).toContain('for (let index = 1; index < keyXs.length; index += 1)');
    expect(markerSource).toContain('ctx.strokeStyle = palette.line');
    expect(markerSource).toContain('ctx.lineTo(endX, centerY)');
    // Per-frame split: straight outside cycle frames, sine inside them. A mixed
    // span therefore renders `-~--~--` rather than one style for the whole gap.
    expect(markerSource).toContain('const isCycleX = (x: number): boolean =>');
    expect(markerSource).toContain('if (inCycle !== runIsCycle)');
    expect(markerSource).toContain('strokeRun(runStart, x, runIsCycle)');
    expect(markerSource).toContain('strokeSplitSpan(fromX, toX)');
    expect(markerSource).toContain('Math.sin(');
    expect(markerSource).toContain('const amplitude = 2');
    expect(markerSource).toContain('const period = 10');
    // A cycle run that outlives the last key still draws, and the tail splits
    // at the cycle boundary — no hole between the key and cycle 2.
    expect(markerSource).toContain('const firstKeyX = keyXs[0]');
    expect(markerSource).toContain('const cycleEndX = cycleSpans.reduce(');
    expect(markerSource).toContain('strokeSplitSpan(lastKeyX, Math.min(cycleEndX, canvasWidth))');
    expect(markerSource).toContain('strokeSplitSpan(Math.max(cycleStartX, TRACK_HEADER_WIDTH), firstKeyX)');
    // Connectors are drawn before the diamonds so the glyphs sit on top.
    expect(markerSource.indexOf('for (let index = 1; index < keyXs.length'))
      .toBeLessThan(markerSource.lastIndexOf('ctx.moveTo(x, centerY - halfSize)'));
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

describe('physic-paint document sound stain preview', () => {
  it('rebases the document-local startFrame with the owning sequence inFrame (frame-space law)', async () => {
    const { getPhysicPaintSoundStainGeometry, TRACK_HEADER_WIDTH } = await import('./TimelineRenderer');

    const geometry = getPhysicPaintSoundStainGeometry({
      startFrame: 48,
      inFrame: 10,
      outFrame: 60,
      slipOffset: 0,
      sourceFrames: 80,
      sequenceInFrame: 50,
      frameWidth: 4,
      scrollX: 12,
    });
    expect(geometry.x).toBe((50 + 48) * 4 - 12 + TRACK_HEADER_WIDTH);
    expect(geometry.width).toBe((60 - 10) * 4);
    // Source-space window: the untrimmed waveform starts one trim-in to the left.
    expect(geometry.sourceX).toBe(geometry.x - 10 * 4);
    expect(geometry.sourceWidth).toBe(80 * 4);
  });

  it('slipOffset slides the source under the bar — the waveform moves when Offset moves', async () => {
    // 261010 UAT: the stain geometry ignored slipOffset, so dragging Offset
    // played different audio over an identical drawn waveform.
    const { getPhysicPaintSoundStainGeometry } = await import('./TimelineRenderer');

    const base = {
      startFrame: 48,
      inFrame: 10,
      outFrame: 60,
      sourceFrames: 80,
      sequenceInFrame: 50,
      frameWidth: 4,
      scrollX: 12,
    };
    const atZero = getPhysicPaintSoundStainGeometry({ ...base, slipOffset: 0 });
    const slipped = getPhysicPaintSoundStainGeometry({ ...base, slipOffset: 24 });
    // Bar position is untouched by slip; only the source slides under it.
    expect(slipped.x).toBe(atZero.x);
    expect(slipped.width).toBe(atZero.width);
    expect(slipped.sourceX).toBe(atZero.sourceX - 24 * 4);
  });

  it('draws the Studio stain and hairline overlays for physic-paint rows only, under the key markers', () => {
    const code = source();
    const fxTrackSource = code.slice(code.indexOf('private drawFxTrack'), code.indexOf('/** Draw a Photoshop-style checkerboard'));

    expect(fxTrackSource).toContain("fxTrack.layerType === 'physic-paint' && fxTrack.soundClip");
    expect(fxTrackSource).toContain('drawPhysicPaintSoundStain');
    // The stain paints BEFORE the Roto key diamonds so the keys stay on top.
    expect(fxTrackSource.indexOf('drawPhysicPaintSoundStain')).toBeLessThan(fxTrackSource.indexOf('drawRotoKeyMarkers'));

    const stainIndex = code.indexOf('private drawPhysicPaintSoundStain');
    const stainSource = code.slice(stainIndex, code.indexOf('private drawRotoKeyMarkers'));
    expect(stainSource).toContain('selectSoundPeaks');
    expect(stainSource).toContain('soundWaveformPathD');
    expect(stainSource).toContain('SOUND_WAVEFORM_FILL');
    expect(stainSource).toContain('SOUND_OVERLAY_STROKE');
    expect(stainSource).toContain('soundGainLineSpan');
    expect(stainSource).toContain('soundFadeInPathD');
    expect(stainSource).toContain('soundFadeOutPathD');
    // Read-only preview: no hit-testing, no selection, no trim chrome.
    for (const interactionSurface of ['addEventListener', 'hitTest', 'onClick', 'selected', 'hover', 'focus']) {
      expect(stainSource).not.toContain(interactionSurface);
    }
  });

  it('windows the drawn waveform to the trimmed [in, out] stain rect, not the layer bar', () => {
    // 261010 UAT: the fill was clipped to the FX bar, so the full source
    // spilled past the OUT cut and the layer looked wider than the fade-out.
    const code = source();
    const stainIndex = code.indexOf('private drawPhysicPaintSoundStain');
    const stainSource = code.slice(stainIndex, code.indexOf('private drawRotoKeyMarkers'));

    // The source-space fill must sit behind a clip to geom.x / geom.width.
    expect(stainSource).toContain('ctx.rect(geom.x, barY, geom.width, barH)');
    expect(stainSource).toContain('ctx.translate(geom.sourceX, barY)');
    // And the stain clip must come BEFORE the fill so the window is applied.
    expect(stainSource.indexOf('ctx.rect(geom.x, barY, geom.width, barH)'))
      .toBeLessThan(stainSource.indexOf('ctx.fill(new Path2D(stainD))'));
  });

  it('feeds soundClip + sourceId peaks into the FX layout and refreshes on the document/peaks clocks', () => {
    const code = frameMapSource();
    const fxLayoutsIndex = code.indexOf('export const fxTrackLayouts');
    expect(fxLayoutsIndex).toBeGreaterThan(-1);
    const fxLayoutsSource = code.slice(fxLayoutsIndex);

    expect(fxLayoutsSource).toContain('soundClip');
    expect(fxLayoutsSource).toContain('documentSound.sourceId');
    expect(fxLayoutsSource).toContain('audioPeaksCache.get(documentSound.sourceId)');
    expect(fxLayoutsSource).toContain('audioPeaksCache.getSourceFrames(documentSound.sourceId)');
    // Sound edits bump efxPaintVersion only; peaks arrive under peaksCacheRevision.
    expect(fxLayoutsSource).toContain('efxPaintVersion.value');
    expect(fxLayoutsSource).toContain('peaksCacheRevision.value');
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
      'Synchronized with Script',
      'Modified locally',
      'Script detached',
      'Source Script unavailable',
      'TimelineCapsuleTooltip',
      'openPhysicPaintLoopEdit',
      'requestPhysicPaintLoopOperation',
    ];

    for (const symbol of forbidden) expect(code).not.toContain(symbol);
  });

  it('shows keys only: repeat/loop strips are not drawn on the main timeline', () => {
    const code = source();
    const fxTrackSource = code.slice(
      code.indexOf('private drawFxTrack'),
      code.indexOf('/** Draw a Photoshop-style checkerboard'),
    );

    // UAT 261104: the repeat strip read as a rail line above the bar. The
    // Editor row shows the bar + key connectors; cycle ranges only style the
    // connector runs (sine vs straight), never a bar above the row.
    expect(code).not.toContain('drawPhysicPaintRepeatDurationMarkers');
    expect(code).not.toContain('getTimelineRepeatDurationMarkerGeometry');
    expect(fxTrackSource).toContain('fxTrack.rotoCycleRanges ?? []');
    expect(fxTrackSource).not.toContain('fxTrack.repeatDurationMarkers');
    for (const interactionSurface of ['addEventListener', 'hitTest', 'tooltip']) {
      expect(fxTrackSource).not.toContain(interactionSurface);
    }
  });
});

describe('Loop Clip rendering ownership (43-11, D-33R)', () => {
  it('keeps the rich capsule path and interaction state out of the renderer', () => {
    const fxTrackSource = source().slice(
      source().indexOf('private drawFxTrack'),
      source().indexOf('/** Draw a Photoshop-style checkerboard'),
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
      payload: { frameIndex: 0, appFrame, bytes: testWebpBytes('AAAA') },
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
    const { registerDocument, reset: resetEfxPaintStore } = await import('../../stores/efxPaintStore');
    const { createEfxPaintDocument } = await import('../../efx-paint/document/efxPaintDocument');
    resetEfxPaintStore();
    const document = createEfxPaintDocument(layerId);
    const track = document.tracks[0];
    registerDocument({
      ...document,
      activeTrackId: TEST_TRACK_ID,
      tracks: [{ ...track, id: TEST_TRACK_ID, frames: {}, rotoPhysical: null, loopClips: [] }],
    });
    return sequenceId;
  }

  it('exposes exactly the seeded real key appFrames (generated interiors never appear)', async () => {
    const { physicPaintStore } = await import('../../stores/physicPaintStore');
    const { fxTrackLayouts } = await import('../../lib/frameMap');
    const sequenceId = await seedPhysicPaintFxSequence('roto-layer');

    // Real keys at 0, 4, 8 with interpolation enabled derive generated interiors
    // 1-3 and 5-7; rotoKeyFrames must carry real keys only (D-07).
    const seeded = physicPaintStore.replaceRotoPhysicalRecords(
      'roto-layer', TEST_TRACK_ID,
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
      'roto-layer', TEST_TRACK_ID,
      [makeRotoRecord('key-0', 0), makeRotoRecord('key-4', 4), makeRotoRecord('key-8', 8)],
      { enabled: false, mode: 'duplicate' },
      600,
    );
    if (!first.ok) throw new Error(first.error);
    expect(fxTrackLayouts.value.find((track) => track.sequenceId === sequenceId)?.rotoKeyFrames).toEqual([0, 4, 8]);

    const second = physicPaintStore.replaceRotoPhysicalRecords(
      'roto-layer', TEST_TRACK_ID,
      [makeRotoRecord('key-a', 2), makeRotoRecord('key-b', 7)],
      { enabled: false, mode: 'duplicate' },
      600,
    );
    if (!second.ok) throw new Error(second.error);

    // No manual invalidation: the existing physicPaintVersion subscription drives the recompute.
    expect(fxTrackLayouts.value.find((track) => track.sequenceId === sequenceId)?.rotoKeyFrames).toEqual([2, 7]);
  });

  it('unions real keys across every Roto track and dedupes shared frames', async () => {
    const { physicPaintStore } = await import('../../stores/physicPaintStore');
    const { fxTrackLayouts } = await import('../../lib/frameMap');
    const sequenceId = await seedPhysicPaintFxSequence('roto-layer');

    const trackA = physicPaintStore.replaceRotoPhysicalRecords(
      'roto-layer', TEST_TRACK_ID,
      [makeRotoRecord('a-1', 1), makeRotoRecord('a-3', 3)],
      { enabled: false, mode: 'duplicate' },
      600,
    );
    if (!trackA.ok) throw new Error(trackA.error);
    const trackB = physicPaintStore.replaceRotoPhysicalRecords(
      'roto-layer', 'track-b',
      [makeRotoRecord('b-3', 3), makeRotoRecord('b-5', 5)],
      { enabled: false, mode: 'duplicate' },
      600,
    );
    if (!trackB.ok) throw new Error(trackB.error);

    expect(physicPaintStore.getRotoRealKeyRecordsAcrossTracks('roto-layer').map((record) => record.appFrame))
      .toEqual([1, 3, 3, 5]);
    // The Editor row is per LAYER: keys from every rail/track, one per frame.
    expect(fxTrackLayouts.value.find((track) => track.sequenceId === sequenceId)?.rotoKeyFrames)
      .toEqual([1, 3, 5]);
  });

  it('derives cycle ranges from one source cycle after the loop phase origin', () => {
    const code = frameMapSource();

    // The Studio paints repeatInstance > 0 as cycles: those start one source
    // cycle after phaseOrigin, not at the whole loop placement start.
    expect(code).toContain('getTimelineRepeatProjection');
    expect(code).toContain('Math.max(range.placementStart, range.phaseOrigin + range.cycleLength)');
    expect(code).toContain('rotoCycleRanges: repeatProjection.cycleRanges');
    // Every track contributes: the row never follows the active Studio track.
    expect(code).toContain('for (const source of getTrackPhysicalSources(layerId))');
  });

  it('shows keys from a document track this realm never mounted in its runtime', async () => {
    const { physicPaintStore } = await import('../../stores/physicPaintStore');
    const { registerDocument, getDocument } = await import('../../stores/efxPaintStore');
    const { buildPhysicPaintRotoPhysicalRevision } = await import(
      '../../components/physic-paint/roto/physicsPaintRotoPhysicalModel'
    );
    const { fxTrackLayouts } = await import('../../lib/frameMap');
    const sequenceId = await seedPhysicPaintFxSequence('roto-layer');

    const trackA = physicPaintStore.replaceRotoPhysicalRecords(
      'roto-layer', TEST_TRACK_ID,
      [makeRotoRecord('a-1', 1), makeRotoRecord('a-3', 3)],
      { enabled: false, mode: 'duplicate' },
      600,
    );
    if (!trackA.ok) throw new Error(trackA.error);

    // A track carried by the document but never mounted in this realm's runtime
    // (the sibling Studio realm's non-active tracks): its keys must still show.
    const physical = physicPaintStore.getRotoPhysicalDocument('roto-layer', TEST_TRACK_ID);
    const runtimeRecords = physicPaintStore.getRotoRealKeyRecords('roto-layer', TEST_TRACK_ID);
    if (!physical || runtimeRecords.length === 0) throw new Error('missing physical state');
    const unmountedRecords = runtimeRecords.map((record, index) => ({
      ...record,
      keyId: `unmounted-${index}`,
      appFrame: record.appFrame + 10,
      payload: { ...record.payload, appFrame: record.appFrame + 10 },
    }));
    const unmountedPhysical = {
      ...physical,
      realKeyRecords: unmountedRecords,
      revision: buildPhysicPaintRotoPhysicalRevision(
        unmountedRecords,
        physical.interpolation,
        physical.loopClips,
        physical.incomingInterpolationBreakKeyIds,
        physical.groupOverrideRecords ?? [],
      ),
    };
    const seeded = getDocument('roto-layer');
    if (!seeded) throw new Error('missing document');
    registerDocument({
      ...seeded,
      tracks: [
        seeded.tracks[0],
        { ...seeded.tracks[0], id: 'track-unmounted', name: 'Paint 2', rotoPhysical: unmountedPhysical },
      ],
    });

    expect(fxTrackLayouts.value.find((track) => track.sequenceId === sequenceId)?.rotoKeyFrames)
      .toEqual([1, 3, 11, 13]);
  });

  it('keeps the Editor key list identical when the active Studio track changes', async () => {
    const { physicPaintStore } = await import('../../stores/physicPaintStore');
    const { registerDocument, getDocument, setActiveTrackId } = await import('../../stores/efxPaintStore');
    const { fxTrackLayouts } = await import('../../lib/frameMap');
    const sequenceId = await seedPhysicPaintFxSequence('roto-layer');

    const seeded = getDocument('roto-layer');
    if (!seeded) throw new Error('missing document');
    const baseTrack = seeded.tracks[0];
    registerDocument({
      ...seeded,
      tracks: [
        baseTrack,
        { ...baseTrack, id: 'track-b', name: 'Paint 2', frames: {}, rotoPhysical: null, loopClips: [] },
      ],
    });

    const trackA = physicPaintStore.replaceRotoPhysicalRecords(
      'roto-layer', TEST_TRACK_ID,
      [makeRotoRecord('a-1', 1), makeRotoRecord('a-3', 3)],
      { enabled: false, mode: 'duplicate' },
      600,
    );
    if (!trackA.ok) throw new Error(trackA.error);
    const trackB = physicPaintStore.replaceRotoPhysicalRecords(
      'roto-layer', 'track-b',
      [makeRotoRecord('b-5', 5), makeRotoRecord('b-8', 8)],
      { enabled: false, mode: 'duplicate' },
      600,
    );
    if (!trackB.ok) throw new Error(trackB.error);

    const frames = () => fxTrackLayouts.value.find((track) => track.sequenceId === sequenceId)?.rotoKeyFrames;
    expect(frames()).toEqual([1, 3, 5, 8]);

    setActiveTrackId('roto-layer', 'track-b');
    expect(getDocument('roto-layer')?.activeTrackId).toBe('track-b');
    expect(frames()).toEqual([1, 3, 5, 8]);
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

describe('timeline pointer frame resolution (260918-o0n)', () => {
  it('resolves past the derived end when no ceiling is passed', async () => {
    const { BASE_FRAME_WIDTH, TRACK_HEADER_WIDTH, resolveTimelinePointerFrame } =
      await import('./TimelineRenderer');

    // zoom 1 => 60px frames; the x sits on frame 137, far past a 60-frame timeline.
    expect(resolveTimelinePointerFrame(TRACK_HEADER_WIDTH + 137 * BASE_FRAME_WIDTH, 0, 0, 1, null)).toBe(137);
  });

  it('applies the ceiling when one is given', async () => {
    const { BASE_FRAME_WIDTH, TRACK_HEADER_WIDTH, resolveTimelinePointerFrame } =
      await import('./TimelineRenderer');

    expect(resolveTimelinePointerFrame(TRACK_HEADER_WIDTH + 137 * BASE_FRAME_WIDTH, 0, 0, 1, 59)).toBe(59);
  });

  it('never returns a negative frame', async () => {
    const { TRACK_HEADER_WIDTH, resolveTimelinePointerFrame } = await import('./TimelineRenderer');

    // An x left of the track header resolves to frame 0, not to a negative frame.
    expect(resolveTimelinePointerFrame(TRACK_HEADER_WIDTH - 40, 0, 0, 1, null)).toBe(0);
  });

  it('delegates frameFromX to it and keeps the live-timeline default ceiling', () => {
    const code = source();
    const frameFromXIndex = code.indexOf('frameFromX(');
    expect(frameFromXIndex).toBeGreaterThan(-1);
    const frameFromXSource = code.slice(frameFromXIndex, frameFromXIndex + 400);

    expect(frameFromXSource).toContain('resolveTimelinePointerFrame(');
    // D-10: the default ceiling is N (tick N is reachable), not N-1.
    expect(frameFromXSource).toContain('totalFrames > 0 ? totalFrames : 0');
  });
});

describe('FX track selection + visibility law (UAT 2026-10-19)', () => {
  const fxTrackSource = () => {
    const code = source();
    return code.slice(code.indexOf('private drawFxTrack'), code.indexOf('private drawCoverageGapTail'));
  };

  it('beds only the selected FX name cell in darker tool blue with the accent-orange trait', () => {
    const code = source();
    expect(code).toContain("const FX_SELECTED_BG = '#2B4BB5'");
    expect(code).toContain("const FX_SELECTION_TRAIT = '#F5A623'");

    const fx = fxTrackSource();
    // The lane never takes the selection blue — only the header cell does.
    expect(fx).toContain('ctx.fillStyle = colors.fxTrackBg;');
    expect(fx).not.toContain('isSelected ? FX_SELECTED_BG : colors.fxTrackBg');
    expect(fx).toContain('isSelected ? FX_SELECTED_BG');
    expect(fx).toContain('FX_SELECTION_TRAIT');
    expect(fx).not.toContain('#1A1520');
    expect(fx).not.toContain('#151015');
  });

  it('replaces the header dot with a lucide-style eye/eye-off in a 24px hit zone', () => {
    const code = source();
    expect(code).toContain('export const FX_VISIBILITY_HIT_WIDTH = 24');
    expect(code).toContain('private drawFxVisibilityIcon(');

    const fx = fxTrackSource();
    expect(fx).toContain('drawFxVisibilityIcon');
    expect(fx).not.toContain('ctx.arc(dotX + 3');

    const interaction = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), 'TimelineInteraction.ts'),
      'utf8',
    );
    expect(interaction).toContain('localX < FX_VISIBILITY_HIT_WIDTH');
    expect(interaction).not.toContain('localX < 18');
  });
});

describe('physic-paint row palette (v2.0.1 v7, 261104-q82)', () => {
  const fxTrackSource = () => {
    const code = source();
    return code.slice(code.indexOf('private drawFxTrack'), code.indexOf('/** Draw a Photoshop-style checkerboard'));
  };

  it('keeps the layer bar on its own accent and uses the palette only for keys', () => {
    const fx = fxTrackSource();

    expect(fx).toContain("const isPhysicPaint = fxTrack.layerType === 'physic-paint'");
    expect(fx).toContain("isSelected ? 'selected' : 'unselected'");
    // UAT 261104: the Editor shows keys only — no rail line above the bar.
    expect(source()).not.toContain('drawPhysicPaintRailLine');
    expect(source()).not.toContain('getPhysicPaintRailLineGeometry');
    // The bar keeps the FX accent (reverted by UAT); the palette drives keys.
    expect(fx).toContain('const barColor = resolvedColor');
    expect(fx).not.toContain("railPalette ? railPalette.line : resolvedColor");
    expect(fx).toContain('withAlpha(barColor');
    expect(fx).toContain('ctx.fillStyle = barColor');
    expect(fx).toContain('drawCoverageGapTail(ctx, hatchLeft, barY, hatchW, barH, barColor)');
  });
});
