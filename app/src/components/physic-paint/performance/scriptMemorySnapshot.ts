// ============================================================
//  scriptMemorySnapshot — read-only Studio script-memory stats
//  (quick 261023-f9c).
//
//  WHERE THIS RUNS: inside the Studio webview, on demand, from the
//  devtools console. It walks module-level state that lives until
//  the Studio closes and returns plain numbers. It writes nothing:
//  no signal, no map, no cache, no file.
//
//  approxBytes METHOD (deterministic, documented):
//    approxBytes = UTF-8 byte length of JSON.stringify(counted object)
//  It approximates retained heap, not allocator overhead. Watercolor
//  counts BOTH retained copies per stroke — the raw registry
//  `AquarelleStroke` (points + params) and its projected
//  `StudioStroke<AquarelleStrokePayload>` entry (a second point copy) —
//  which is exactly what stays resident until Studio close.
//
//  Frame caches (decoded ImageBitmap LRU, compressed WebP bytes) are
//  reported in their own `frameCache` section and are NEVER folded
//  into watercolor or brush totals.
//
//  Brush counts only the current engine frame: navigation calls
//  `engine.clear()` and there is no per-frame brush script store.
// ============================================================

import type {
  AquarelleDryEvent,
  AquarelleStroke,
  AquarelleStrokePayload,
} from '@efxlab/efx-watercolor/payload';
import type { StudioStroke } from '@efxlab/efx-paint-host/animation';
import type { PaintStroke } from '@efxlab/efx-physic-paint';

/** One counted script bucket (watercolor row, deleted bucket, or brush). */
export interface ScriptMemoryScriptStats {
  strokes: number;
  points: number;
  approxBytes: number;
}

/** One watercolor frame row. */
export interface ScriptMemoryFrameStats extends ScriptMemoryScriptStats {
  frame: number;
}

export type ScriptMemoryCacheKind = 'decoded-image' | 'compressed-bytes';

/** One named frame cache, reported separately from script bytes. */
export interface ScriptMemoryCacheStat {
  name: string;
  kind: ScriptMemoryCacheKind;
  byteTotalBytes: number;
  entryCount: number;
  ceilingBytes?: number;
  note?: string;
}

/** The DEV-only snapshot payload. */
export interface ScriptMemorySnapshot {
  /** ISO timestamp of the read. */
  capturedAt: string;
  /** The one documented approximation method. */
  approxMethod: 'json-utf8-byte-length';
  watercolor: {
    /** Live frame rows, ascending by frame. */
    frames: ScriptMemoryFrameStats[];
    /** Deleted strokes still retained in the two registry maps. */
    deleted: ScriptMemoryScriptStats;
    /** Raw strokes with no projected timeline entry (non-deleted). */
    orphanedStrokes: number;
    /** Strokes whose points were malformed or whose JSON failed. */
    skippedStrokes: number;
    dryEvents: { count: number; approxBytes: number };
    /** frames + deleted (deleted bytes are retained memory too). */
    totals: ScriptMemoryScriptStats & { frames: number };
  };
  brush: ScriptMemoryScriptStats & {
    available: boolean;
    scope: 'current-frame-only';
    note: string;
    skippedStrokes: number;
  };
  frameCache: {
    scope: 'this-webview';
    totalBytes: number;
    caches: ScriptMemoryCacheStat[];
  };
}

/** The single input bag — all reads, no writes. */
export interface ScriptMemorySnapshotInput {
  /** Raw registry: every recorded stroke, including deleted ones. */
  watercolorStrokes: ReadonlyMap<number, AquarelleStroke>;
  /** Projected timeline entries (`captureAquarelleStrokeRegistry().pairs`). */
  watercolorEntries: ReadonlyMap<number, StudioStroke<AquarelleStrokePayload>>;
  isStrokeDeleted: (mutationId: number) => boolean;
  /** Global Dry events (no frame anchor). */
  dryEvents: readonly AquarelleDryEvent[];
  /** `engine.getStrokes()` for the current frame, or null when no engine. */
  brushStrokes: readonly PaintStroke[] | null;
  frameCaches: readonly ScriptMemoryCacheStat[];
}

/** The API installed on `window.__EFX_SCRIPT_MEMORY__`. */
export interface ScriptMemoryGlobal {
  snapshot: () => ScriptMemorySnapshot;
}

/** Structural target for the installer (kept DOM-free for tests). */
export interface ScriptMemoryWindowLike {
  __EFX_SCRIPT_MEMORY__?: ScriptMemoryGlobal;
}

export const SCRIPT_MEMORY_APPROX_METHOD = 'json-utf8-byte-length' as const;

export const SCRIPT_MEMORY_BRUSH_NOTE =
  'Brush counts only the current engine frame: navigation calls engine.clear() and there is no per-frame brush script store.';

function countPoints(points: unknown): number {
  return Array.isArray(points) ? points.length : 0;
}

/** UTF-8 JSON byte length, or null when the value cannot be serialized. */
function safeJsonBytes(value: unknown, encoder: TextEncoder): number | null {
  try {
    const json = JSON.stringify(value);
    if (typeof json !== 'string') return null;
    return encoder.encode(json).byteLength;
  } catch {
    return null;
  }
}

/**
 * Build the snapshot. Pure: reads the supplied maps/arrays only.
 * Malformed input never throws — it increments `skippedStrokes`.
 */
export function buildScriptMemorySnapshot(
  input: ScriptMemorySnapshotInput,
): ScriptMemorySnapshot {
  const encoder = new TextEncoder();
  const framesById = new Map<number, ScriptMemoryFrameStats>();
  const deleted: ScriptMemoryScriptStats = { strokes: 0, points: 0, approxBytes: 0 };
  let orphanedStrokes = 0;
  let skippedStrokes = 0;

  for (const [mutationId, stroke] of input.watercolorStrokes) {
    const entry = input.watercolorEntries.get(mutationId);

    const rawPoints = countPoints(stroke.points);
    if (!Array.isArray(stroke.points)) skippedStrokes += 1;
    const entryPoints = entry ? countPoints(entry.pts) : 0;
    if (entry && !Array.isArray(entry.pts)) skippedStrokes += 1;

    let approxBytes = 0;
    const rawBytes = safeJsonBytes(stroke, encoder);
    if (rawBytes === null) skippedStrokes += 1;
    else approxBytes += rawBytes;

    if (entry) {
      const entryBytes = safeJsonBytes(entry, encoder);
      if (entryBytes === null) skippedStrokes += 1;
      else approxBytes += entryBytes;
    }

    if (input.isStrokeDeleted(mutationId)) {
      deleted.strokes += 1;
      deleted.points += rawPoints + entryPoints;
      deleted.approxBytes += approxBytes;
      continue;
    }

    if (!entry) orphanedStrokes += 1;

    const frame = entry?.playFrame ?? stroke.playFrame ?? 0;
    let row = framesById.get(frame);
    if (!row) {
      row = { frame, strokes: 0, points: 0, approxBytes: 0 };
      framesById.set(frame, row);
    }
    row.strokes += 1;
    row.points += rawPoints + entryPoints;
    row.approxBytes += approxBytes;
  }

  const frames = [...framesById.values()].sort((a, b) => a.frame - b.frame);

  let totalStrokes = deleted.strokes;
  let totalPoints = deleted.points;
  let totalApproxBytes = deleted.approxBytes;
  for (const row of frames) {
    totalStrokes += row.strokes;
    totalPoints += row.points;
    totalApproxBytes += row.approxBytes;
  }

  const dryEvents = {
    count: input.dryEvents.length,
    // An empty list has no retained event objects to measure.
    approxBytes:
      input.dryEvents.length === 0 ? 0 : (safeJsonBytes(input.dryEvents, encoder) ?? 0),
  };

  const brushStrokes = input.brushStrokes;
  let brushStrokeCount = 0;
  let brushPoints = 0;
  let brushApproxBytes = 0;
  let brushSkipped = 0;

  if (brushStrokes !== null) {
    brushStrokeCount = brushStrokes.length;
    for (const stroke of brushStrokes) {
      brushPoints += countPoints(stroke.points);
      if (!Array.isArray(stroke.points)) brushSkipped += 1;
    }
    // One serialization for the whole array; per-stroke sums only on failure.
    const wholeBytes = safeJsonBytes(brushStrokes, encoder);
    if (wholeBytes === null) {
      for (const stroke of brushStrokes) {
        const bytes = safeJsonBytes(stroke, encoder);
        if (bytes === null) brushSkipped += 1;
        else brushApproxBytes += bytes;
      }
    } else {
      brushApproxBytes = wholeBytes;
    }
  }

  const caches = input.frameCaches.map((cache) => ({ ...cache }));
  const cacheTotalBytes = caches.reduce(
    (sum, cache) => sum + (Number.isFinite(cache.byteTotalBytes) ? cache.byteTotalBytes : 0),
    0,
  );

  return {
    capturedAt: new Date().toISOString(),
    approxMethod: SCRIPT_MEMORY_APPROX_METHOD,
    watercolor: {
      frames,
      deleted,
      orphanedStrokes,
      skippedStrokes,
      dryEvents,
      totals: {
        frames: frames.length,
        strokes: totalStrokes,
        points: totalPoints,
        approxBytes: totalApproxBytes,
      },
    },
    brush: {
      available: brushStrokes !== null,
      strokes: brushStrokeCount,
      points: brushPoints,
      approxBytes: brushApproxBytes,
      skippedStrokes: brushSkipped,
      scope: 'current-frame-only',
      note: SCRIPT_MEMORY_BRUSH_NOTE,
    },
    frameCache: {
      scope: 'this-webview',
      totalBytes: cacheTotalBytes,
      caches,
    },
  };
}

/**
 * Install (or replace) the DEV-only global. Returns false without
 * touching the target when `dev` is false.
 */
export function installScriptMemoryGlobal(
  target: ScriptMemoryWindowLike,
  api: ScriptMemoryGlobal,
  dev: boolean,
): boolean {
  if (!dev) return false;
  Object.defineProperty(target, '__EFX_SCRIPT_MEMORY__', {
    configurable: true,
    enumerable: true,
    value: api,
  });
  return true;
}

declare global {
  interface Window {
    __EFX_SCRIPT_MEMORY__?: ScriptMemoryGlobal;
  }
}
