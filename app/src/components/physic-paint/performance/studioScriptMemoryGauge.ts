// ============================================================
//  studioScriptMemoryGauge — the PRODUCTION read entry point for
//  the Studio script-memory numbers (quick 261023-ors).
//
//  ONE assembler, two entry points: the Memory tab calls
//  `readStudioScriptMemorySnapshot` directly, and the DEV probe
//  global (quick 261023-f9c) delegates to the same function. The
//  estimator and the accounting law live in `scriptMemorySnapshot`
//  — this module only supplies its input bag and the display
//  helpers the gauge tab needs.
//
//  Read-only: it reads the watercolor registry and the frame caches,
//  never mutating a store, a signal or a cache. After engine-1 removal
//  the watercolor registry is the whole script memory — there is no
//  brush session store and no per-engine frame projection.
//
//  Placement law: Motion/Static Rails are derived Loop Clips with no
//  key scripts. They have no input here, so they can never appear in
//  a row.
// ============================================================

import type { Signal } from '@preact/signals';
import type { AquarelleStrokePayload } from '@efxlab/efx-watercolor/payload';
import type { StudioStroke } from '@efxlab/efx-paint-host/animation';
import { FRAME_LRU_BYTE_CEILING, frameLru } from '../../../lib/frameLru';
import {
  captureAquarelleStrokeRegistry,
  getRecordedAquarelleDryEvents,
  getRecordedAquarelleStrokeEntries,
  isAquarelleStrokeDeleted,
} from '../view/aquarelleRecordState';
import {
  getGeneratedRenderSourceCacheStats,
  getRotoCacheByteStats,
} from '../../../stores/physicPaintStore';
import {
  buildScriptMemorySnapshot,
  type ScriptMemoryScriptStats,
  type ScriptMemorySnapshot,
} from './scriptMemorySnapshot';

/** The Memory tab's ports (identity-stable ref from the Studio). */
export interface StudioScriptMemorySectionPorts {
  /** The current gauge read, or null when this session can provide none. */
  read: () => ScriptMemorySnapshot | null;
  /** Per-key purge: returns true when anything was removed. */
  purgeFrame: (frame: number) => boolean;
  /** Purge the scripts on the selected key rail's frames. */
  purgeRail: (frames: readonly number[]) => boolean;
  /** Clear the ACTIVE rail's scripts: returns true when anything was removed. */
  clearRail: () => boolean;
}

/** The selected key rail's frame span (Loop Clip rails have none). */
export interface StudioScriptMemoryKeyRail {
  frames: readonly number[];
  startFrame: number;
  endFrame: number;
}

/** The active track name and the selected rail (if any). */
export interface StudioScriptMemoryRailContext {
  trackName: string;
  /** True while a key or Loop Clip rail line is selected on the timeline. */
  railSelected: boolean;
  /** The selected KEY rail's frame span; null for a Loop Clip rail or none. */
  keyRail: StudioScriptMemoryKeyRail | null;
}

/** The identity-stable section the Studio hands the right panel. */
export interface StudioScriptMemorySection {
  ports: StudioScriptMemorySectionPorts;
  frame: Signal<number>;
  railContext: Signal<StudioScriptMemoryRailContext | null>;
}

/** One gauge row — watercolor is the only script store left. */
export interface StudioScriptMemoryFrameRow {
  frame: number;
  watercolor: ScriptMemoryScriptStats;
}

/**
 * Assemble the read-only snapshot from the live Studio stores. Safe to call
 * repeatedly; nothing is mutated or purged by a read.
 */
export function readStudioScriptMemorySnapshot(): ScriptMemorySnapshot {
  const strokes = getRecordedAquarelleStrokeEntries();
  const entries = new Map<number, StudioStroke<AquarelleStrokePayload>>();
  for (const [mutationId, , entry] of captureAquarelleStrokeRegistry().pairs) {
    entries.set(mutationId, entry);
  }

  const generated = getGeneratedRenderSourceCacheStats();
  const roto = getRotoCacheByteStats();

  return buildScriptMemorySnapshot({
    watercolorStrokes: strokes,
    watercolorEntries: entries,
    isStrokeDeleted: isAquarelleStrokeDeleted,
    dryEvents: getRecordedAquarelleDryEvents(),
    frameCaches: [
      {
        name: 'frameLru',
        kind: 'decoded-image',
        byteTotalBytes: frameLru.byteTotal,
        entryCount: frameLru.entryCount,
        ceilingBytes: FRAME_LRU_BYTE_CEILING,
        note: 'Decoded ImageBitmap LRU owned by this Studio webview.',
      },
      {
        name: 'generatedRenderSource',
        kind: 'compressed-bytes',
        byteTotalBytes: generated.byteTotalBytes,
        entryCount: generated.entryCount,
        ceilingBytes: generated.ceilingBytes,
        note: 'Compressed WebP bytes of generated interpolation sources in this Studio webview.',
      },
      {
        name: 'rotoCache.realKey',
        kind: 'compressed-bytes',
        byteTotalBytes: roto.realKeyBytes,
        entryCount: roto.realKeyFrames,
        note: 'Roto real-key cache bytes (WebP plus onion previews) in this Studio webview.',
      },
      {
        name: 'rotoCache.generated',
        kind: 'compressed-bytes',
        byteTotalBytes: roto.generatedBytes,
        entryCount: roto.generatedFrames,
        note: 'Generated Roto frame bytes (WebP plus onion previews) in this Studio webview.',
      },
    ],
  });
}

const BYTE_UNITS = ['KB', 'MB', 'GB', 'TB'] as const;

/**
 * Binary-unit display: bytes under 1 KiB render as whole bytes; above that the
 * largest unit that keeps the value under 1024 is used, with one decimal below
 * 100 and a rounded integer at/above it (194_980 -> "190 KB", 79_315_200 ->
 * "75.6 MB"). Negative and non-finite input renders "0 B" and never throws.
 */
export function formatScriptMemoryBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < BYTE_UNITS.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const display = value >= 100 ? String(Math.round(value)) : value.toFixed(1);
  return `${display} ${BYTE_UNITS[unitIndex]}`;
}

/**
 * Project the watercolor frames into one gauge row per app frame, ascending.
 * Rails are never an input.
 */
export function buildStudioScriptMemoryFrameRows(
  snapshot: ScriptMemorySnapshot,
): StudioScriptMemoryFrameRow[] {
  return snapshot.watercolor.frames.map((stats) => ({
    frame: stats.frame,
    watercolor: {
      strokes: stats.strokes,
      points: stats.points,
      approxBytes: stats.approxBytes,
    },
  }));
}
