// ============================================================
//  studioScriptMemoryGauge.test.ts — RED-first suite for the
//  production script-memory read entry point (quick 261023-ors).
//
//  ONE assembler, two entry points: the Memory tab calls
//  readStudioScriptMemorySnapshot directly; the DEV probe global
//  delegates to the same function. The f9c estimator owns the
//  accounting — this module only supplies its input.
//
//  Frame rows merge the watercolor timeline and the brush session
//  store by app frame; rails (derived Loop Clips) have no input
//  here and can never be listed.
// ============================================================

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AquarellePoint,
  AquarelleStroke,
} from '@efxlab/efx-watercolor/payload';
import { toStudioStroke } from '@efxlab/efx-watercolor/payload';
import type { EfxPaintEngine, PaintStroke } from '@efxlab/efx-physic-paint';
import { FRAME_LRU_BYTE_CEILING, frameLru } from '../../../lib/frameLru';
import {
  recordAquarelleStroke,
  resetAquarelleRecordState,
} from '../view/aquarelleRecordState';
import {
  getBrushScriptReport,
  resetBrushScriptStore,
} from '../view/brushScriptRecordState';
import {
  registerScriptMemoryBrushEngine,
  registerScriptMemoryBrushFrame,
  snapshotScriptMemory,
} from './scriptMemoryProbe';
import {
  buildStudioScriptMemoryFrameRows,
  formatScriptMemoryBytes,
  readStudioScriptMemorySnapshot,
} from './studioScriptMemoryGauge';
import { buildScriptMemorySnapshot } from './scriptMemorySnapshot';

// Deterministic frame-cache figures: the gauge must report these in its own
// section and never fold them into a script total.
const GENERATED_STATS = { byteTotalBytes: 4096, entryCount: 2, ceilingBytes: 64 * 1024 * 1024 };
const ROTO_STATS = { realKeyBytes: 1024, realKeyFrames: 1, generatedBytes: 2048, generatedFrames: 3 };

vi.mock('../../../stores/physicPaintStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../stores/physicPaintStore')>();
  return {
    ...actual,
    getGeneratedRenderSourceCacheStats: () => GENERATED_STATS,
    getRotoCacheByteStats: () => ROTO_STATS,
  };
});

function point(x: number, y: number): AquarellePoint {
  return { x, y, p: 0.5, tx: 0, ty: 0, tw: 0 };
}

function rawStroke(overrides: Partial<AquarelleStroke> = {}): AquarelleStroke {
  return {
    tool: 'brush',
    color: '#103c65',
    params: { size: 12, water: 50 },
    brushId: 'round',
    points: [point(0.1, 0.2), point(0.3, 0.4)],
    mutationId: 1,
    timestamp: 1000,
    playFrame: 0,
    ...overrides,
  };
}

const BRUSH_STROKES: PaintStroke[] = [
  {
    tool: 'paint',
    points: [
      { x: 0.1, y: 0.2, p: 0.5, tx: 0, ty: 0, tw: 0, spd: 0.1 },
      { x: 0.3, y: 0.4, p: 0.6, tx: 0, ty: 0, tw: 0, spd: 0.2 },
    ],
    color: '#000000',
    params: {
      size: 8,
      opacity: 80,
      pressure: 100,
      waterAmount: 30,
      dryAmount: 20,
      edgeDetail: 50,
      pickup: 10,
      eraseStrength: 0,
      antiAlias: 2,
    },
    timestamp: 10,
  },
];

function fakeEngine(strokes: readonly PaintStroke[] | null): EfxPaintEngine {
  return {
    getStrokes: vi.fn(() => strokes),
    getFramePaintSettings: vi.fn(() => null),
    getPaintRenderSettings: vi.fn(() => null),
  } as unknown as EfxPaintEngine;
}

beforeEach(() => {
  resetAquarelleRecordState();
  resetBrushScriptStore();
  registerScriptMemoryBrushEngine(null);
  registerScriptMemoryBrushFrame(null);
});

describe('formatScriptMemoryBytes', () => {
  it.each([
    [0, '0 B'],
    [934, '934 B'],
    [1023, '1023 B'],
    [1024, '1.0 KB'],
    [194_980, '190 KB'],
    [79_315_200, '75.6 MB'],
  ])('formats %d bytes as %s', (bytes, expected) => {
    expect(formatScriptMemoryBytes(bytes)).toBe(expected);
  });

  it('renders 0 B for negative, NaN and non-finite input without throwing', () => {
    expect(formatScriptMemoryBytes(-1)).toBe('0 B');
    expect(formatScriptMemoryBytes(Number.NaN)).toBe('0 B');
    expect(formatScriptMemoryBytes(Number.POSITIVE_INFINITY)).toBe('0 B');
    expect(() => formatScriptMemoryBytes(Number.NEGATIVE_INFINITY)).not.toThrow();
  });
});

describe('buildStudioScriptMemoryFrameRows', () => {
  it('merges watercolor and brush frames by app frame, ascending, with zeros for the absent store', () => {
    const wc0 = rawStroke({ mutationId: 1, playFrame: 0 });
    const wc4 = rawStroke({ mutationId: 2, playFrame: 4 });
    const snapshot = buildScriptMemorySnapshot({
      watercolorStrokes: new Map<number, AquarelleStroke>([
        [2, wc4],
        [1, wc0],
      ]),
      watercolorEntries: new Map([
        [1, toStudioStroke(wc0)],
        [2, toStudioStroke(wc4)],
      ]),
      isStrokeDeleted: () => false,
      dryEvents: [],
      brushStrokes: null,
      brushScript: {
        frames: [
          { frame: 7, strokes: 3, points: 9, approxBytes: 900, complete: true, diffusionFrames: 0 },
          { frame: 0, strokes: 1, points: 2, approxBytes: 100, complete: true, diffusionFrames: 0 },
        ],
        totals: { strokes: 4, points: 11, approxBytes: 1000 },
      },
      frameCaches: [],
    });

    const rows = buildStudioScriptMemoryFrameRows(snapshot);

    expect(rows.map((row) => row.frame)).toEqual([0, 4, 7]);
    expect(rows[0]).toEqual({
      frame: 0,
      // The estimator counts BOTH retained copies per watercolor stroke
      // (raw registry + projected entry), so the row carries its figures.
      watercolor: {
        strokes: 1,
        points: snapshot.watercolor.frames[0].points,
        approxBytes: snapshot.watercolor.frames[0].approxBytes,
      },
      brush: { strokes: 1, points: 2, approxBytes: 100 },
    });
    // Watercolor-only frame: the brush side shows zeros, not another frame's data.
    expect(rows[1]).toEqual({
      frame: 4,
      watercolor: {
        strokes: 1,
        points: snapshot.watercolor.frames[1].points,
        approxBytes: snapshot.watercolor.frames[1].approxBytes,
      },
      brush: { strokes: 0, points: 0, approxBytes: 0 },
    });
    // Brush-only frame: the watercolor side shows zeros.
    expect(rows[2]).toEqual({
      frame: 7,
      watercolor: { strokes: 0, points: 0, approxBytes: 0 },
      brush: { strokes: 3, points: 9, approxBytes: 900 },
    });
  });

  it('emits no row for an empty snapshot and never invents rails', () => {
    const snapshot = buildScriptMemorySnapshot({
      watercolorStrokes: new Map(),
      watercolorEntries: new Map(),
      isStrokeDeleted: () => false,
      dryEvents: [],
      brushStrokes: null,
      brushScript: { frames: [], totals: { strokes: 0, points: 0, approxBytes: 0 } },
      frameCaches: [],
    });

    expect(buildStudioScriptMemoryFrameRows(snapshot)).toEqual([]);
  });
});

describe('readStudioScriptMemorySnapshot', () => {
  it('returns an unavailable engine frame without throwing when there is no engine', () => {
    const snapshot = readStudioScriptMemorySnapshot({ engine: null, frame: 2 });

    expect(snapshot.brush.currentEngineFrame).toEqual({
      available: false,
      strokes: 0,
      points: 0,
      approxBytes: 0,
    });
    expect(snapshot.watercolor.frames).toEqual([]);
  });

  it('reports the four named frame caches separately from every script total', () => {
    const engine = fakeEngine(BRUSH_STROKES);
    const snapshot = readStudioScriptMemorySnapshot({ engine, frame: 3 });

    expect(snapshot.frameCache.caches.map((cache) => cache.name)).toEqual([
      'frameLru',
      'generatedRenderSource',
      'rotoCache.realKey',
      'rotoCache.generated',
    ]);
    expect(snapshot.frameCache.caches[0]).toEqual({
      name: 'frameLru',
      kind: 'decoded-image',
      byteTotalBytes: frameLru.byteTotal,
      entryCount: frameLru.entryCount,
      ceilingBytes: FRAME_LRU_BYTE_CEILING,
      note: 'Decoded ImageBitmap LRU owned by this Studio webview.',
    });

    const expectedTotal = frameLru.byteTotal
      + GENERATED_STATS.byteTotalBytes
      + ROTO_STATS.realKeyBytes
      + ROTO_STATS.generatedBytes;
    expect(snapshot.frameCache.totalBytes).toBe(expectedTotal);

    // The script totals come from the stores only — no cache byte leaks in.
    const report = getBrushScriptReport();
    expect(snapshot.brush.totals).toMatchObject(report.totals);
    expect(snapshot.watercolor.totals.approxBytes).toBe(0);
    expect(snapshot.watercolor.totals.approxBytes).toBeLessThan(snapshot.frameCache.totalBytes);
    expect(snapshot.brush.totals.approxBytes).toBeLessThan(snapshot.frameCache.totalBytes);
  });

  it('flushes the CURRENT brush frame from the engine once and is idempotent on re-read', () => {
    const engine = fakeEngine(BRUSH_STROKES);
    const first = readStudioScriptMemorySnapshot({ engine, frame: 3 });

    expect(engine.getStrokes).toHaveBeenCalled();
    expect(getBrushScriptReport().frames.map((row) => row.frame)).toContain(3);
    expect(first.brush.frames.map((row) => row.frame)).toContain(3);

    const framesAfterFirst = getBrushScriptReport().frames.length;
    const second = readStudioScriptMemorySnapshot({ engine, frame: 3 });

    expect(getBrushScriptReport().frames.length).toBe(framesAfterFirst);
    expect({ ...second, capturedAt: '' }).toEqual({ ...first, capturedAt: '' });
  });

  it('is one assembler: the DEV probe returns exactly the gauge read for the same stores', () => {
    const engine = fakeEngine(BRUSH_STROKES);
    recordAquarelleStroke(11, rawStroke({ mutationId: 11, playFrame: 2 }));
    registerScriptMemoryBrushEngine(engine);
    registerScriptMemoryBrushFrame(() => 5);

    const viaProbe = snapshotScriptMemory();
    const viaGauge = readStudioScriptMemorySnapshot({ engine, frame: 5 });

    expect({ ...viaGauge, capturedAt: '' }).toEqual({ ...viaProbe, capturedAt: '' });
    // The watercolor registry is visible through the gauge (not a probe-only read).
    expect(viaGauge.watercolor.frames).toEqual([
      expect.objectContaining({ frame: 2, strokes: 1 }),
    ]);
  });
});
