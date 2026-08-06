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

describe('loop clip filmstrip capsule (HOLD-06)', () => {
  type FakeCall = {
    method: string;
    args: unknown[];
    fillStyle: unknown;
    strokeStyle: unknown;
    lineWidth: unknown;
    font: unknown;
    globalAlpha: unknown;
    lineDash: unknown[];
    textAlign: unknown;
  };

  function createFakeCtx() {
    const calls: FakeCall[] = [];
    const ctx: Record<string, unknown> = {
      fillStyle: '#000000',
      strokeStyle: '#000000',
      lineWidth: 1,
      font: '',
      globalAlpha: 1,
      textBaseline: 'alphabetic',
      textAlign: 'start',
      lineDash: [] as number[],
      canvas: null,
    };
    const snapshot = () => ({
      fillStyle: ctx.fillStyle,
      strokeStyle: ctx.strokeStyle,
      lineWidth: ctx.lineWidth,
      font: ctx.font,
      globalAlpha: ctx.globalAlpha,
      lineDash: [...(ctx.lineDash as number[])],
      textAlign: ctx.textAlign,
    });
    const record = (method: string) => (...args: unknown[]) => {
      calls.push({ method, args, ...snapshot() });
    };
    for (const method of ['save', 'restore', 'beginPath', 'clip', 'rect', 'roundRect', 'fill', 'stroke',
      'fillRect', 'strokeRect', 'moveTo', 'lineTo', 'arc', 'closePath', 'fillText', 'drawImage',
      'translate', 'scale', 'clearRect', 'setTransform']) {
      ctx[method] = record(method);
    }
    ctx.setLineDash = (segments: number[]) => {
      ctx.lineDash = segments;
      calls.push({ method: 'setLineDash', args: [segments], ...snapshot() });
    };
    ctx.measureText = (text: string) => ({ width: text.length * 6 });
    ctx.createPattern = () => null;
    ctx.createLinearGradient = () => ({ addColorStop: () => undefined });
    return { ctx, calls };
  }

  async function createRendererHarness() {
    vi.stubGlobal('window', { devicePixelRatio: 1 });
    vi.stubGlobal('document', { documentElement: {} });
    vi.stubGlobal('getComputedStyle', () => ({ getPropertyValue: () => '' }));
    // ThumbnailCache starts an Image load for unseeded thumbnails; the stub
    // never completes, so unseeded cells take the placeholder path.
    vi.stubGlobal('Image', class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      complete = false;
      naturalWidth = 0;
      naturalHeight = 0;
      src = '';
    });
    const { ctx, calls } = createFakeCtx();
    const canvas = {
      getContext: () => ctx,
      getBoundingClientRect: () => ({ width: 800, height: 600, top: 0, left: 0, right: 800, bottom: 600 }),
      width: 0,
      height: 0,
    };
    ctx.canvas = canvas;
    const { TimelineRenderer, invalidateColorCache } = await import('./TimelineRenderer');
    invalidateColorCache();
    const renderer = new TimelineRenderer(canvas as never);
    return { renderer, calls };
  }

  function makeCapsule(overrides: Record<string, unknown> = {}) {
    return {
      loopId: 'loop-1',
      placementStart: 0,
      cycleLength: 5,
      repeat: 5,
      requestedEnd: 25,
      effectiveEnd: 25,
      truncated: false,
      partialCycle: false,
      boundaryKind: 'parent-end',
      boundaryFrame: 40,
      mode: 'progressive',
      unresolved: null,
      firstCycleCells: [0, 1, 2, 3, 4].map((frame) => ({
        sourceKeyId: `key-${frame}`,
        sourceAppFrame: frame,
        dataUrl: `data:image/png;base64,${String(frame).padStart(4, 'A')}`,
        realKeyBacked: true,
      })),
      ...overrides,
    };
  }

  function makeFxTrack(loopCapsules?: unknown[]) {
    return {
      sequenceId: 'fx-1',
      sequenceName: 'Roto FX',
      headerLabel: 'PPaint #1',
      kind: 'fx' as const,
      inFrame: 0,
      outFrame: 40,
      color: '#E91E63',
      visible: true,
      layerType: 'physic-paint' as const,
      rotoKeyFrames: [0, 1, 2, 3, 4],
      ...(loopCapsules ? { loopCapsules } : {}),
    };
  }

  function drawCapsule(
    harness: { renderer: { draw: (state: never) => void } },
    zoom: number,
    loopCapsules?: unknown[],
    extras: Record<string, unknown> = {},
  ) {
    harness.renderer.draw({
      frame: 0,
      zoom,
      scrollX: 0,
      scrollY: 0,
      tracks: [],
      fxTracks: [makeFxTrack(loopCapsules)],
      imageStore: {},
      totalFrames: 100,
      ...extras,
    } as never);
  }

  function seedThumbnails(renderer: unknown, keyIds: string[]) {
    const cache = (renderer as { thumbnailCache: { cache: Map<string, unknown> } }).thumbnailCache.cache;
    for (const keyId of keyIds) {
      cache.set(keyId, { complete: true, naturalWidth: 64, naturalHeight: 64 });
    }
  }

  it('draws first-cycle thumbnails downscaled via ThumbnailCache + drawImage at high zoom (D-15)', async () => {
    const { renderer, calls } = await createRendererHarness();
    seedThumbnails(renderer, ['key-0', 'key-1', 'key-2', 'key-3', 'key-4']);
    drawCapsule({ renderer }, 0.4, [makeCapsule()]); // frameWidth 24 → high zoom

    const images = calls.filter((call) => call.method === 'drawImage');
    expect(images).toHaveLength(5);
    // First cell lands at the FX content left edge (header width), one frame wide.
    expect(images[0]!.args.slice(1)).toEqual([80, expect.any(Number), 24, expect.any(Number)]);
    expect(images[1]!.args[1]).toBe(80 + 24);
    // Real-key-backed first-cycle cells keep the solid source-cell border.
    expect(calls.some((call) => call.method === 'strokeRect'
      && call.strokeStyle === 'rgba(255, 255, 255, 0.22)'
      && (call.lineDash as number[]).length === 0)).toBe(true);
  });

  it('draws duplicated-loop first-cycle cells with the shared thumbnails and dashed linked border, no solid border (placement/source correction)', async () => {
    const { renderer, calls } = await createRendererHarness();
    seedThumbnails(renderer, ['key-0', 'key-1', 'key-2', 'key-3', 'key-4']);
    const capsule = makeCapsule({
      placementStart: 20,
      firstCycleCells: [0, 1, 2, 3, 4].map((frame) => ({
        sourceKeyId: `key-${frame}`,
        sourceAppFrame: frame,
        dataUrl: `data:image/png;base64,${String(frame).padStart(4, 'A')}`,
        realKeyBacked: false,
      })),
    });
    drawCapsule({ renderer }, 0.4, [capsule]);

    const images = calls.filter((call) => call.method === 'drawImage');
    expect(images).toHaveLength(5);
    expect(images[0]!.args[1]).toBe(80 + 20 * 24);
    // Linked first-cycle cells: dashed LOOP_GHOST_BORDER, never the solid source-cell border.
    const cellBorders = calls.filter((call) => call.method === 'strokeRect');
    expect(cellBorders.length).toBeGreaterThan(0);
    expect(cellBorders.every((call) => call.strokeStyle === 'rgba(255, 255, 255, 0.24)'
      && JSON.stringify(call.lineDash) === '[4,4]')).toBe(true);
  });

  it('expands repetitions into ghost cells at high zoom (LOOP_GHOST_FILL + dashed LOOP_GHOST_BORDER, no thumbnails)', async () => {
    const { renderer, calls } = await createRendererHarness();
    seedThumbnails(renderer, ['key-0', 'key-1', 'key-2', 'key-3', 'key-4']);
    drawCapsule({ renderer }, 0.4, [makeCapsule()]);

    const ghostFills = calls.filter((call) => call.method === 'fillRect'
      && call.fillStyle === 'rgba(255, 255, 255, 0.06)');
    expect(ghostFills).toHaveLength(4); // repeats 1..4 over [5,25)
    expect(ghostFills[0]!.args[0]).toBe(80 + 5 * 24);
    expect(ghostFills[0]!.args[2]).toBe(5 * 24);
    expect(calls.some((call) => call.method === 'setLineDash'
      && JSON.stringify(call.args[0]) === '[4,4]')).toBe(true);
    // Ghost cells never draw thumbnails: exactly the 5 first-cycle drawImage calls.
    expect(calls.filter((call) => call.method === 'drawImage')).toHaveLength(5);
  });

  it('renders the perforated band at default zoom (LOOP_BAND_BASE + LOOP_BAND_HATCH 45°/4px/1px)', async () => {
    const { renderer, calls } = await createRendererHarness();
    drawCapsule({ renderer }, 0.2, [makeCapsule()]); // frameWidth 12 → default

    expect(calls.some((call) => call.method === 'fillRect'
      && call.fillStyle === 'rgba(255, 255, 255, 0.05)')).toBe(true);
    expect(calls.some((call) => call.method === 'stroke'
      && call.strokeStyle === 'rgba(255, 255, 255, 0.14)'
      && call.lineWidth === 1)).toBe(true);
    // No ghost-cell expansion at default zoom.
    expect(calls.some((call) => call.method === 'fillRect'
      && call.fillStyle === 'rgba(255, 255, 255, 0.06)')).toBe(false);
  });

  it('collapses to solid band + badge only at low zoom', async () => {
    const { renderer, calls } = await createRendererHarness();
    drawCapsule({ renderer }, 0.1, [makeCapsule()]); // frameWidth 6 → low

    expect(calls.some((call) => call.method === 'fillRect'
      && call.fillStyle === 'rgba(255, 255, 255, 0.05)')).toBe(true);
    expect(calls.some((call) => call.method === 'fillRect'
      && call.fillStyle === 'rgba(255, 255, 255, 0.06)')).toBe(false);
    expect(calls.some((call) => call.method === 'stroke'
      && call.strokeStyle === 'rgba(255, 255, 255, 0.14)')).toBe(false);
    expect(calls.some((call) => call.method === 'fillText'
      && call.args[0] === 'Cycle 5f × 5 = 25f')).toBe(true);
  });

  it('draws the compact math badge pill with the locked D-19 form and metrics', async () => {
    const { renderer, calls } = await createRendererHarness();
    drawCapsule({ renderer }, 0.2, [makeCapsule()]);

    const badgeText = calls.find((call) => call.method === 'fillText' && call.args[0] === 'Cycle 5f × 5 = 25f');
    expect(badgeText).toBeDefined();
    expect(badgeText!.font).toBe('600 10px system-ui, sans-serif');
    expect(badgeText!.fillStyle).toBe('rgba(255, 255, 255, 0.85)');
    expect(calls.some((call) => call.method === 'fill' && call.fillStyle === 'rgba(13, 13, 13, 0.85)')).toBe(true);
  });

  it('draws the infinity badge without any Infinityf suffix', async () => {
    const { renderer, calls } = await createRendererHarness();
    drawCapsule({ renderer }, 0.2, [makeCapsule({ repeat: 'infinity', requestedEnd: 'infinity', effectiveEnd: 40 })]);

    const texts = calls.filter((call) => call.method === 'fillText').map((call) => String(call.args[0]));
    expect(texts).toContain('Cycle 5f × ∞');
    expect(texts.every((text) => !text.includes('Infinity'))).toBe(true);
  });

  it('draws the truncation diagonal in #FFB020 1.5px landing per the geometry module (D-21)', async () => {
    const { renderer, calls } = await createRendererHarness();
    const { loopCapsuleFrameToX } = await import('./loopCapsuleGeometry');
    drawCapsule({ renderer }, 0.4, [makeCapsule({ effectiveEnd: 23, truncated: true, partialCycle: true })]);

    const diagonalStroke = calls.find((call) => call.method === 'stroke'
      && call.strokeStyle === '#FFB020' && call.lineWidth === 1.5);
    expect(diagonalStroke).toBeDefined();
    // Partial cycle at frameWidth 24: landing = mid-cell of [20,25) = frame 22.5.
    const expectedX = loopCapsuleFrameToX(22.5, { inFrame: 0, frameWidth: 24, scrollX: 0, headerWidth: 80 });
    const diagonalSegment = calls.find((call) => call.method === 'moveTo' && call.args[0] === expectedX);
    expect(diagonalSegment).toBeDefined();
  });

  it('still draws the diagonal on the band end at low zoom', async () => {
    const { renderer, calls } = await createRendererHarness();
    drawCapsule({ renderer }, 0.1, [makeCapsule({ effectiveEnd: 23, truncated: true, partialCycle: true })]);
    expect(calls.some((call) => call.method === 'stroke'
      && call.strokeStyle === '#FFB020' && call.lineWidth === 1.5)).toBe(true);
  });

  it('renders a zero-effective loop as the greyed anchor flag pinned at the placement start (D-22)', async () => {
    const { renderer, calls } = await createRendererHarness();
    drawCapsule({ renderer }, 0.2, [makeCapsule({ placementStart: 10, effectiveEnd: 10, truncated: true })]);

    const flagText = calls.find((call) => call.method === 'fillText' && call.args[0] === '0f');
    expect(flagText).toBeDefined();
    expect(flagText!.fillStyle).toBe('#E8E8E8');
    expect(calls.some((call) => call.method === 'fill' && call.fillStyle === '#666666')).toBe(true);
    // The anchor flag carries the marker — no badge text, no diagonal.
    expect(calls.some((call) => call.method === 'fillText' && String(call.args[0]).startsWith('Cycle'))).toBe(false);
    expect(calls.some((call) => call.strokeStyle === '#FFB020')).toBe(false);
  });

  it('outlines unresolved loops in #FF4444 2px — the capsule never silently disappears (D-23/D-31)', async () => {
    const { renderer, calls } = await createRendererHarness();
    drawCapsule({ renderer }, 0.2, [makeCapsule({ unresolved: { missingSourceKeyIds: ['key-9'] } })], {
      selectedLoopClipId: 'loop-1',
      hoveredLoopClipId: 'loop-1',
    });

    // Error styling wins over selected + hover (precedence: error > focus > selected > hover).
    const errorIndex = calls.findIndex((call) => call.method === 'stroke'
      && call.strokeStyle === '#FF4444' && call.lineWidth === 2);
    const selectedIndex = calls.findIndex((call) => call.method === 'stroke'
      && call.strokeStyle === '#2D5BE3' && call.lineWidth === 2);
    expect(errorIndex).toBeGreaterThan(-1);
    expect(selectedIndex).toBeGreaterThan(-1);
    expect(errorIndex).toBeGreaterThan(selectedIndex);
  });

  it('paints hover raise, selected accent outline, and focus ring without changing geometry (D-23)', async () => {
    const { renderer, calls } = await createRendererHarness();
    drawCapsule({ renderer }, 0.2, [makeCapsule()], {
      selectedLoopClipId: 'loop-1',
      focusedLoopClipId: 'loop-1',
      hoveredLoopClipId: 'loop-1',
    });

    expect(calls.some((call) => call.method === 'stroke'
      && call.strokeStyle === 'rgba(255, 255, 255, 0.50)' && call.lineWidth === 1.5)).toBe(true);
    const accentStrokes = calls.filter((call) => call.method === 'stroke'
      && call.strokeStyle === '#2D5BE3' && call.lineWidth === 2);
    expect(accentStrokes.length).toBeGreaterThanOrEqual(2); // selected outline + focus ring
  });

  it('renders nothing when the track has no Loop Clips (S1 empty — no capsule, no placeholder)', async () => {
    const { renderer, calls } = await createRendererHarness();
    drawCapsule({ renderer }, 0.2, undefined);
    drawCapsule({ renderer }, 0.2, []);

    expect(calls.some((call) => call.method === 'fillText' && String(call.args[0]).startsWith('Cycle'))).toBe(false);
    expect(calls.some((call) => call.method === 'fillRect'
      && call.fillStyle === 'rgba(255, 255, 255, 0.05)')).toBe(false);
    expect(calls.some((call) => call.method === 'drawImage')).toBe(false);
  });

  it('consumes loopCapsuleGeometry outputs and the locked S1 constants — canvas paint calls only', () => {
    const code = source();
    const capsuleIndex = code.indexOf('private drawLoopCapsules');
    expect(capsuleIndex).toBeGreaterThan(-1);
    const capsuleSource = code.slice(capsuleIndex);

    for (const constant of ['LOOP_BAND_BASE', 'LOOP_BAND_HATCH', 'LOOP_GHOST_FILL', 'LOOP_GHOST_BORDER', "'#FFB020'"]) {
      expect(code).toContain(constant);
    }
    for (const consumed of ['badgeTextForLoop', 'zoomBandForFrameWidth', 'visibleGhostCells',
      'truncationDiagonalFrame', 'anchorFlagGeometry', 'firstCycleCellFrames', 'loopCapsuleFrameToX']) {
      expect(capsuleSource).toContain(consumed);
    }
    expect(capsuleSource).toContain('fxTrack.loopCapsules');
    expect(capsuleSource).toContain('this.thumbnailCache.get');
    expect(capsuleSource).not.toContain('document.createElement');
    expect(capsuleSource).not.toContain('clip bloquant');
    expect(capsuleSource).not.toContain('playScriptMarkers');
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
