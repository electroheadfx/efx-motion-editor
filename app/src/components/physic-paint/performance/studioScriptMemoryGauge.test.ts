// ============================================================
//  studioScriptMemoryGauge.test.ts — suite for the production
//  script-memory read entry point (quick 261023-ors).
//
//  ONE assembler: the Memory tab calls
//  readStudioScriptMemorySnapshot directly. The f9c estimator owns
//  the accounting — this module only supplies its input.
//
//  After engine-1 removal the watercolor registry is the WHOLE script
//  memory: frame rows project the watercolor timeline only, and rails
//  (derived Loop Clips) have no input here and can never be listed.
// ============================================================

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AquarellePoint,
  AquarelleStroke,
} from '@efxlab/efx-watercolor/payload';
import { toStudioStroke } from '@efxlab/efx-watercolor/payload';
import { FRAME_LRU_BYTE_CEILING, frameLru } from '../../../lib/frameLru';
import {
  recordAquarelleStroke,
  resetAquarelleRecordState,
} from '../view/aquarelleRecordState';
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

beforeEach(() => {
  resetAquarelleRecordState();
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
  it('projects the watercolor frames by app frame, ascending, with no brush store', () => {
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
      frameCaches: [],
    });

    const rows = buildStudioScriptMemoryFrameRows(snapshot);

    expect(rows.map((row) => row.frame)).toEqual([0, 4]);
    expect(rows[0]).toEqual({
      frame: 0,
      // The estimator counts BOTH retained copies per watercolor stroke
      // (raw registry + projected entry), so the row carries its figures.
      watercolor: {
        strokes: 1,
        points: snapshot.watercolor.frames[0].points,
        approxBytes: snapshot.watercolor.frames[0].approxBytes,
      },
    });
    expect(rows[1]).toEqual({
      frame: 4,
      watercolor: {
        strokes: 1,
        points: snapshot.watercolor.frames[1].points,
        approxBytes: snapshot.watercolor.frames[1].approxBytes,
      },
    });
    // The row shape is exactly the watercolor pair — no brush member survives.
    expect(Object.keys(rows[0]).sort()).toEqual(['frame', 'watercolor']);
  });

  it('emits no row for an empty snapshot and never invents rails', () => {
    const snapshot = buildScriptMemorySnapshot({
      watercolorStrokes: new Map(),
      watercolorEntries: new Map(),
      isStrokeDeleted: () => false,
      dryEvents: [],
      frameCaches: [],
    });

    expect(buildStudioScriptMemoryFrameRows(snapshot)).toEqual([]);
  });
});

describe('readStudioScriptMemorySnapshot', () => {
  it('reads the live watercolor registry with no engine argument', () => {
    recordAquarelleStroke(11, rawStroke({ mutationId: 11, playFrame: 2 }));

    const snapshot = readStudioScriptMemorySnapshot();

    expect(snapshot.watercolor.frames).toEqual([
      expect.objectContaining({ frame: 2, strokes: 1 }),
    ]);
    expect(snapshot.watercolor.totals.strokes).toBe(1);
    // Engine-1 removal: there is no brush section left in the payload.
    expect(Object.keys(snapshot).sort()).toEqual([
      'approxMethod',
      'capturedAt',
      'frameCache',
      'watercolor',
    ]);
  });

  it('returns an empty watercolor section without throwing when nothing is recorded', () => {
    const snapshot = readStudioScriptMemorySnapshot();

    expect(snapshot.watercolor.frames).toEqual([]);
    expect(snapshot.watercolor.totals).toEqual({
      frames: 0,
      strokes: 0,
      points: 0,
      approxBytes: 0,
    });
  });

  it('reports the four named frame caches separately from every script total', () => {
    recordAquarelleStroke(11, rawStroke({ mutationId: 11, playFrame: 2 }));
    const snapshot = readStudioScriptMemorySnapshot();

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

    // The script totals come from the watercolor registry only — no cache
    // byte leaks in.
    expect(snapshot.watercolor.totals.approxBytes).toBeGreaterThan(0);
    expect(snapshot.watercolor.totals.approxBytes).toBeLessThan(snapshot.frameCache.totalBytes);
  });

  it('is read-only and idempotent: re-reading the same registry is byte-identical', () => {
    recordAquarelleStroke(11, rawStroke({ mutationId: 11, playFrame: 2 }));
    const first = readStudioScriptMemorySnapshot();
    const second = readStudioScriptMemorySnapshot();

    expect({ ...second, capturedAt: '' }).toEqual({ ...first, capturedAt: '' });
    expect(second.watercolor.totals).toEqual(first.watercolor.totals);
  });
});
