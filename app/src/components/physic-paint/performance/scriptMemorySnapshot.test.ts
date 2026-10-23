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

    expect(snapshot.brush.available).toBe(false);
    expect(snapshot.brush.strokes).toBe(0);
    expect(snapshot.brush.points).toBe(0);
    expect(snapshot.brush.approxBytes).toBe(0);
    expect(snapshot.brush.skippedStrokes).toBe(0);
    expect(snapshot.brush.scope).toBe('current-frame-only');
    expect(snapshot.brush.note).toContain('no per-frame brush script store');

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
  it('reports the current engine strokes with the no-per-frame-store flag', () => {
    const from = fixture();
    const snapshot = buildScriptMemorySnapshot({
      ...baseInput(from),
      brushStrokes: BRUSH_STROKES,
    });

    expect(snapshot.brush.available).toBe(true);
    expect(snapshot.brush.strokes).toBe(2);
    expect(snapshot.brush.points).toBe(5);
    expect(snapshot.brush.approxBytes).toBe(687);
    expect(snapshot.brush.skippedStrokes).toBe(0);
    expect(snapshot.brush.scope).toBe('current-frame-only');
    expect(snapshot.brush.note).toContain('no per-frame brush script store');
  });

  it('keeps the scope and note when the engine has no strokes', () => {
    const from = fixture();
    const snapshot = buildScriptMemorySnapshot({
      ...baseInput(from),
      brushStrokes: null,
    });

    expect(snapshot.brush.available).toBe(false);
    expect(snapshot.brush.strokes).toBe(0);
    expect(snapshot.brush.scope).toBe('current-frame-only');
    expect(snapshot.brush.note).toContain('no per-frame brush script store');
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
