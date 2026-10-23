// ============================================================
//  scriptMemorySnapshot.test.ts — RED-first suite for the
//  DEV-only Studio script-memory snapshot (quick 261023-f9c).
//
//  Measurement law: approxBytes is the UTF-8 byte length of
//  JSON.stringify of the counted object(s), computed with ONE
//  TextEncoder. Watercolor counts BOTH retained copies (raw
//  registry stroke + projected timeline entry). Frame caches
//  are reported in their own section and never folded into the
//  script totals.
// ============================================================

import { describe, expect, it } from 'vitest';
import type {
  AquarelleDryEvent,
  AquarellePoint,
  AquarelleStroke,
  AquarelleStrokePayload,
} from '@efxlab/efx-watercolor/payload';
import { toStudioStroke } from '@efxlab/efx-watercolor/payload';
import type { StudioStroke } from '@efxlab/efx-paint-host/animation';
import type { PaintStroke } from '@efxlab/efx-physic-paint';
import {
  buildScriptMemorySnapshot,
  installScriptMemoryGlobal,
  type ScriptMemoryCacheStat,
  type ScriptMemoryGlobal,
  type ScriptMemorySnapshotInput,
  type ScriptMemoryWindowLike,
} from './scriptMemorySnapshot';
import {
  MAX_ATTACH_POINTS,
  MAX_ATTACH_STROKES,
} from '../view/brushScriptHydration';

const encoder = new TextEncoder();
const jsonBytes = (value: unknown): number => encoder.encode(JSON.stringify(value)).byteLength;

function point(x: number, y: number, p = 0.5): AquarellePoint {
  return { x, y, p, tx: 0, ty: 0, tw: 0 };
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

interface Fixture {
  strokes: Map<number, AquarelleStroke>;
  entries: Map<number, StudioStroke<AquarelleStrokePayload>>;
  dry: AquarelleDryEvent[];
}

/**
 * The representative fixture: two raw strokes on frame 0, one on frame 3,
 * one deleted stroke on frame 5, and two Dry events. Insertion order is
 * deliberately NOT frame order (frame 3 first) to prove the sort.
 */
function fixture(): Fixture {
  const m1 = rawStroke();
  const m2 = rawStroke({
    mutationId: 2,
    params: { size: 8, water: 30 },
    points: [point(0.2, 0.3), point(0.4, 0.5), point(0.6, 0.7)],
  });
  const m3 = rawStroke({
    mutationId: 3,
    playFrame: 3,
    timestamp: 3000,
    points: [point(0.9, 0.9)],
  });
  const m4 = rawStroke({ mutationId: 4, playFrame: 5, timestamp: 4000 });

  return {
    strokes: new Map<number, AquarelleStroke>([
      [3, m3],
      [1, m1],
      [2, m2],
      [4, m4],
    ]),
    entries: new Map<number, StudioStroke<AquarelleStrokePayload>>([
      [3, toStudioStroke(m3)],
      [1, toStudioStroke(m1)],
      [2, toStudioStroke(m2)],
      [4, toStudioStroke(m4)],
    ]),
    dry: [
      { kind: 'dry', tick: 10, recordedOrder: 1 },
      { kind: 'dry', tick: 20, recordedOrder: 2 },
    ],
  };
}

function baseInput(from: Fixture): ScriptMemorySnapshotInput {
  return {
    watercolorStrokes: from.strokes,
    watercolorEntries: from.entries,
    isStrokeDeleted: (mutationId) => mutationId === 4,
    dryEvents: from.dry,
    brushStrokes: null,
    brushScript: {
      frames: [],
      totals: { strokes: 0, points: 0, approxBytes: 0 },
    },
    frameCaches: [],
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
  {
    tool: 'paint',
    points: [
      { x: 0.5, y: 0.6, p: 0.7, tx: 0, ty: 0, tw: 0, spd: 0.3 },
      { x: 0.7, y: 0.8, p: 0.8, tx: 0, ty: 0, tw: 0, spd: 0.4 },
      { x: 0.9, y: 0.1, p: 0.9, tx: 0, ty: 0, tw: 0, spd: 0.5 },
    ],
    color: '#ffffff',
    params: {
      size: 4,
      opacity: 60,
      pressure: 90,
      waterAmount: 50,
      dryAmount: 10,
      edgeDetail: 40,
      pickup: 20,
      eraseStrength: 0,
      antiAlias: 1,
    },
    timestamp: 20,
  },
];

describe('buildScriptMemorySnapshot — empty state', () => {
  it('returns an empty, fully labelled snapshot', () => {
    const snapshot = buildScriptMemorySnapshot({
      watercolorStrokes: new Map(),
      watercolorEntries: new Map(),
      isStrokeDeleted: () => false,
      dryEvents: [],
      brushStrokes: null,
      brushScript: {
        frames: [],
        totals: { strokes: 0, points: 0, approxBytes: 0 },
      },
      frameCaches: [],
    });

    expect(typeof snapshot.capturedAt).toBe('string');
    expect(Number.isNaN(Date.parse(snapshot.capturedAt))).toBe(false);
    expect(snapshot.approxMethod).toBe('json-utf8-byte-length');

    expect(snapshot.watercolor.frames).toEqual([]);
    expect(snapshot.watercolor.deleted).toEqual({ strokes: 0, points: 0, approxBytes: 0 });
    expect(snapshot.watercolor.orphanedStrokes).toBe(0);
    expect(snapshot.watercolor.skippedStrokes).toBe(0);
    expect(snapshot.watercolor.dryEvents).toEqual({ count: 0, approxBytes: 0 });
    expect(snapshot.watercolor.totals).toEqual({
      frames: 0,
      strokes: 0,
      points: 0,
      approxBytes: 0,
    });

    expect(snapshot.brush.scope).toBe('per-frame-session-store');
    expect(snapshot.brush.frames).toEqual([]);
    expect(snapshot.brush.totals).toEqual({
      strokes: 0,
      points: 0,
      approxBytes: 0,
      completeFrames: 0,
      partialFrames: 0,
    });
    expect(snapshot.brush.currentEngineFrame).toEqual({
      available: false,
      strokes: 0,
      points: 0,
      approxBytes: 0,
    });
    expect(snapshot.brush.note).toContain('captured per frame');

    expect(snapshot.frameCache).toEqual({ scope: 'this-webview', totalBytes: 0, caches: [] });
  });
});

describe('buildScriptMemorySnapshot — watercolor grouping and totals', () => {
  it('groups by frame, diverts deleted strokes, and sums totals', () => {
    const from = fixture();
    const snapshot = buildScriptMemorySnapshot(baseInput(from));

    // Sorted ascending even though insertion order was 3, 1, 2, 4.
    expect(snapshot.watercolor.frames).toEqual([
      { frame: 0, strokes: 2, points: 10, approxBytes: 1391 },
      { frame: 3, strokes: 1, points: 2, approxBytes: 541 },
    ]);

    // The deleted stroke stays in the registry maps but leaves the frame rows.
    expect(snapshot.watercolor.deleted).toEqual({
      strokes: 1,
      points: 4,
      approxBytes: 645,
    });

    expect(snapshot.watercolor.orphanedStrokes).toBe(0);
    expect(snapshot.watercolor.skippedStrokes).toBe(0);
    expect(snapshot.watercolor.dryEvents).toEqual({ count: 2, approxBytes: 87 });

    // totals = live frame rows + the deleted bucket.
    expect(snapshot.watercolor.totals).toEqual({
      frames: 2,
      strokes: 4,
      points: 16,
      approxBytes: 2577,
    });
  });

  it('counts an orphaned raw stroke in its frame and flags it', () => {
    const from = fixture();
    from.entries.delete(1);
    const snapshot = buildScriptMemorySnapshot(baseInput(from));

    expect(snapshot.watercolor.orphanedStrokes).toBe(1);
    // m1 has no projected copy (2 raw points); m2 keeps both copies (3 + 3).
    expect(snapshot.watercolor.frames[0]).toMatchObject({ strokes: 2, points: 8 });
  });
});

describe('buildScriptMemorySnapshot — approxBytes method', () => {
  it('equals the UTF-8 JSON length of the raw stroke plus the projected entry', () => {
    const from = fixture();
    const snapshot = buildScriptMemorySnapshot(baseInput(from));

    const m1 = from.strokes.get(1)!;
    const m2 = from.strokes.get(2)!;
    const m3 = from.strokes.get(3)!;
    const m4 = from.strokes.get(4)!;

    expect(snapshot.watercolor.frames[0].approxBytes).toBe(
      jsonBytes(m1) + jsonBytes(from.entries.get(1)) + jsonBytes(m2) + jsonBytes(from.entries.get(2)),
    );
    expect(snapshot.watercolor.frames[1].approxBytes).toBe(
      jsonBytes(m3) + jsonBytes(from.entries.get(3)),
    );
    expect(snapshot.watercolor.deleted.approxBytes).toBe(
      jsonBytes(m4) + jsonBytes(from.entries.get(4)),
    );
    expect(snapshot.watercolor.dryEvents.approxBytes).toBe(jsonBytes(from.dry));
  });

  it('is deterministic for identical input', () => {
    const from = fixture();
    const first = buildScriptMemorySnapshot(baseInput(from));
    const second = buildScriptMemorySnapshot(baseInput(from));

    expect({ ...second, capturedAt: '' }).toEqual({ ...first, capturedAt: '' });
  });

  it('never throws on malformed strokes and counts the skip', () => {
    const cyclic = rawStroke({ mutationId: 9 }) as AquarelleStroke & { self?: unknown };
    cyclic.self = cyclic;
    const missingPoints = rawStroke({ mutationId: 10 }) as unknown as { points?: unknown };
    missingPoints.points = undefined;

    const snapshot = buildScriptMemorySnapshot({
      watercolorStrokes: new Map<number, AquarelleStroke>([
        [9, cyclic],
        [10, missingPoints as unknown as AquarelleStroke],
      ]),
      watercolorEntries: new Map(),
      isStrokeDeleted: () => false,
      dryEvents: [],
      brushStrokes: null,
      brushScript: {
        frames: [],
        totals: { strokes: 0, points: 0, approxBytes: 0 },
      },
      frameCaches: [],
    });

    // One skip for the cyclic JSON failure, one for the missing points array.
    expect(snapshot.watercolor.skippedStrokes).toBe(2);
    expect(snapshot.watercolor.orphanedStrokes).toBe(2);
    expect(snapshot.watercolor.frames).toHaveLength(1);
    expect(snapshot.watercolor.frames[0]).toMatchObject({ frame: 0, strokes: 2, points: 2 });
    expect(snapshot.watercolor.frames[0].approxBytes).toBe(
      jsonBytes(missingPoints),
    );
  });
});

describe('buildScriptMemorySnapshot — read-only contract', () => {
  it('never mutates or replaces the input maps, strokes, entries, or dry array', () => {
    const from = fixture();
    const strokeRefs = [...from.strokes.values()];
    const entryRefs = [...from.entries.values()];
    const before = JSON.stringify({
      strokes: [...from.strokes],
      entries: [...from.entries],
      dry: from.dry,
    });

    buildScriptMemorySnapshot(baseInput(from));

    expect(JSON.stringify({ strokes: [...from.strokes], entries: [...from.entries], dry: from.dry })).toBe(before);
    expect(from.strokes.size).toBe(4);
    expect(from.entries.size).toBe(4);
    expect([...from.strokes.values()]).toEqual(strokeRefs);
    expect([...from.entries.values()]).toEqual(entryRefs);
    strokeRefs.forEach((stroke, index) => expect([...from.strokes.values()][index]).toBe(stroke));
    entryRefs.forEach((entry, index) => expect([...from.entries.values()][index]).toBe(entry));
  });
});

describe('installScriptMemoryGlobal', () => {
  const api: ScriptMemoryGlobal = {
    snapshot: () => buildScriptMemorySnapshot({
      watercolorStrokes: new Map(),
      watercolorEntries: new Map(),
      isStrokeDeleted: () => false,
      dryEvents: [],
      brushStrokes: null,
      brushScript: {
        frames: [],
        totals: { strokes: 0, points: 0, approxBytes: 0 },
      },
      frameCaches: [],
    }),
  };

  it('does nothing when dev is false', () => {
    const target: ScriptMemoryWindowLike = {};
    expect(installScriptMemoryGlobal(target, api, false)).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(target, '__EFX_SCRIPT_MEMORY__')).toBe(false);
  });

  it('installs a configurable DEV global and replaces it on reinstall', () => {
    const target: ScriptMemoryWindowLike = {};
    expect(installScriptMemoryGlobal(target, api, true)).toBe(true);

    const descriptor = Object.getOwnPropertyDescriptor(target, '__EFX_SCRIPT_MEMORY__');
    expect(descriptor?.configurable).toBe(true);
    expect(target.__EFX_SCRIPT_MEMORY__?.snapshot).toBe(api.snapshot);

    const replacement: ScriptMemoryGlobal = { snapshot: api.snapshot };
    expect(() => installScriptMemoryGlobal(target, replacement, true)).not.toThrow();
    expect(target.__EFX_SCRIPT_MEMORY__).toBe(replacement);
  });
});

describe('buildScriptMemorySnapshot — brush scope', () => {
  const BRUSH_SCRIPT = {
    frames: [
      { frame: 2, strokes: 1, points: 2, approxBytes: 300, complete: true, diffusionFrames: 0 },
      { frame: 7, strokes: 3, points: 9, approxBytes: 900, complete: false, diffusionFrames: 12 },
    ],
    totals: { strokes: 4, points: 11, approxBytes: 1200 },
  };

  it('reports the per-frame store separately from the current engine frame', () => {
    const from = fixture();
    const snapshot = buildScriptMemorySnapshot({
      ...baseInput(from),
      brushStrokes: BRUSH_STROKES,
      brushScript: BRUSH_SCRIPT,
    });

    expect(snapshot.brush.scope).toBe('per-frame-session-store');
    // Complete rows carry the derived hydratable verdict; the partial row is
    // visible as non-hydratable even though its strokes are retained.
    expect(snapshot.brush.frames).toEqual([
      { ...BRUSH_SCRIPT.frames[0], hydratable: true },
      { ...BRUSH_SCRIPT.frames[1], hydratable: false },
    ]);
    expect(snapshot.brush.totals).toEqual({
      ...BRUSH_SCRIPT.totals,
      completeFrames: 1,
      partialFrames: 1,
    });
    // The current engine frame keeps the documented JSON-byte method and is
    // NOT folded into the session totals.
    expect(snapshot.brush.currentEngineFrame).toEqual({
      available: true,
      strokes: 2,
      points: 5,
      approxBytes: 687,
    });
    expect(snapshot.brush.totals.approxBytes).toBe(1200);
    // The note states session-only retention, the completeness law, and the
    // real-key hydration rule.
    expect(snapshot.brush.note).toContain('captured per frame');
    expect(snapshot.brush.note).toContain('for this Studio session only');
    expect(snapshot.brush.note).toContain('current engine frame is measured separately');
    expect(snapshot.brush.note).toContain('complete when its captured script is the whole content');
    expect(snapshot.brush.note).toContain('attaches its script silently over the cached pixels');
  });

  it('keeps the scope and note when the engine has no strokes', () => {
    const from = fixture();
    const snapshot = buildScriptMemorySnapshot({
      ...baseInput(from),
      brushStrokes: null,
      brushScript: BRUSH_SCRIPT,
    });

    expect(snapshot.brush.currentEngineFrame).toEqual({
      available: false,
      strokes: 0,
      points: 0,
      approxBytes: 0,
    });
    // Session rows survive an engine-less read.
    expect(snapshot.brush.frames).toEqual([
      { ...BRUSH_SCRIPT.frames[0], hydratable: true },
      { ...BRUSH_SCRIPT.frames[1], hydratable: false },
    ]);
    expect(snapshot.brush.scope).toBe('per-frame-session-store');
  });
});

describe('buildScriptMemorySnapshot — brush completeness/hydratability', () => {
  function brushInput(
    frames: Array<{
      frame: number;
      strokes: number;
      points: number;
      approxBytes: number;
      complete: boolean;
      diffusionFrames: number;
    }>,
  ): ScriptMemorySnapshotInput {
    return {
      ...baseInput(fixture()),
      brushScript: {
        frames,
        totals: { strokes: 0, points: 0, approxBytes: 0 },
      },
    };
  }

  const row = (
    complete: boolean,
    points: number,
    diffusionFrames: number,
  ) => ({ frame: 1, strokes: 1, points, approxBytes: 100, complete, diffusionFrames });

  it('marks a complete row within the caps hydratable and counts the split', () => {
    const snapshot = buildScriptMemorySnapshot(
      brushInput([
        row(true, 100, 0),
        row(false, 100, 0),
        { ...row(true, 200, 0), frame: 2 },
      ]),
    );

    expect(snapshot.brush.frames.map((frame) => frame.hydratable)).toEqual([true, false, true]);
    expect(snapshot.brush.totals.completeFrames).toBe(2);
    expect(snapshot.brush.totals.partialFrames).toBe(1);
  });

  it('marks a complete row over the attach point cap non-hydratable', () => {
    const snapshot = buildScriptMemorySnapshot(
      brushInput([row(true, MAX_ATTACH_POINTS + 1, 0), row(true, MAX_ATTACH_POINTS, 0)]),
    );

    expect(snapshot.brush.frames.map((frame) => frame.hydratable)).toEqual([false, true]);
    // Completeness itself is not changed by the cap.
    expect(snapshot.brush.totals.completeFrames).toBe(2);
    expect(snapshot.brush.totals.partialFrames).toBe(0);
  });

  it('marks a complete row with ANY diffusion frame non-hydratable (unaffordable rebake)', () => {
    // 261023-j5b Task 3: a physics-run frame's faithful rebake replays solver
    // frames (~700 ms each at HD), so the probe reports it view-only even
    // though its script is complete and small.
    const snapshot = buildScriptMemorySnapshot(
      brushInput([row(true, 10, 300), row(true, 10, 0)]),
    );

    expect(snapshot.brush.frames.map((frame) => frame.hydratable)).toEqual([false, true]);
  });

  it('marks a complete row over the attach stroke cap non-hydratable', () => {
    const snapshot = buildScriptMemorySnapshot(brushInput([
      { ...row(true, 1, 0), strokes: MAX_ATTACH_STROKES + 1 },
      { ...row(true, 1, 0), strokes: MAX_ATTACH_STROKES },
    ]));

    expect(snapshot.brush.frames.map((frame) => frame.hydratable)).toEqual([false, true]);
  });

  it('never promotes a partial row, even when it is well within the caps', () => {
    const snapshot = buildScriptMemorySnapshot(brushInput([row(false, 1, 0)]));

    expect(snapshot.brush.frames[0]!.complete).toBe(false);
    expect(snapshot.brush.frames[0]!.hydratable).toBe(false);
    expect(snapshot.brush.totals).toMatchObject({ completeFrames: 0, partialFrames: 1 });
  });
});

describe('buildScriptMemorySnapshot — cache separation', () => {
  const caches: ScriptMemoryCacheStat[] = [
    {
      name: 'frameLru',
      kind: 'decoded-image',
      byteTotalBytes: 1024,
      entryCount: 2,
      ceilingBytes: 512 * 1024 * 1024,
    },
    {
      name: 'generatedRenderSource',
      kind: 'compressed-bytes',
      byteTotalBytes: 2048,
      entryCount: 1,
      ceilingBytes: 64 * 1024 * 1024,
    },
  ];

  it('reports caches in their own section without touching script totals', () => {
    const from = fixture();
    const withoutCaches = buildScriptMemorySnapshot({
      ...baseInput(from),
      brushStrokes: BRUSH_STROKES,
    });
    const withCaches = buildScriptMemorySnapshot({
      ...baseInput(from),
      brushStrokes: BRUSH_STROKES,
      frameCaches: caches,
    });

    expect(withCaches.frameCache.scope).toBe('this-webview');
    expect(withCaches.frameCache.caches).toEqual(caches);
    expect(withCaches.frameCache.totalBytes).toBe(3072);
    expect(withCaches.watercolor).toEqual(withoutCaches.watercolor);
    expect(withCaches.brush).toEqual(withoutCaches.brush);
  });
});
