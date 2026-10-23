// ============================================================
//  scriptMemoryProbe — the ONE wiring module for the DEV-only
//  `window.__EFX_SCRIPT_MEMORY__.snapshot()` measurement
//  (quick 261023-f9c).
//
//  Installed from the Studio engine-ready seam beside
//  installDh1CaptureHook: DEV guard, no effect, no state, no UI.
//  It only READS (or, for the brush store, refreshes the CURRENT
//  frame from the engine — idempotent, no signal, no file):
//    - the aquarelle raw registry + projected timeline entries
//    - the per-frame brush script store (quick 261023-g4p)
//    - the current engine's stroke copies (getStrokes() returns copies)
//    - the four named frame caches (separate section, never folded in)
//
//  Brush frames are captured per frame for this Studio session; the
//  current engine frame is reported separately because the engine
//  holds only one frame. Navigation to a complete REAL brush key
//  rehydrates its retained script silently (quick 261023-h9v); the
//  probe reports complete/hydratable per row so UAT can see whether a
//  frame would take that path instead of the cached-pixel fallback.
//  The current-frame flush below remains a sanctioned projection
//  point: idempotent, signal-free, and never a hydration trigger.
// ============================================================

import type { EfxPaintEngine } from '@efxlab/efx-physic-paint';
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
  installScriptMemoryGlobal,
  type ScriptMemorySnapshot,
} from './scriptMemorySnapshot';
import { flushBrushScriptFrame, getBrushScriptReport } from '../view/brushScriptRecordState';

/**
 * The last engine that reached the ready seam. No signal, no component
 * state — a new engine simply replaces the previous reference.
 */
let brushEngine: EfxPaintEngine | null = null;
/** The Studio's current frame at read time (never from stroke metadata). */
let brushFrameGetter: (() => number) | null = null;

export function registerScriptMemoryBrushEngine(engine: EfxPaintEngine | null): void {
  brushEngine = engine;
}

export function registerScriptMemoryBrushFrame(getCurrentFrame: (() => number) | null): void {
  brushFrameGetter = getCurrentFrame;
}

/**
 * Assemble the read-only snapshot. Safe to call repeatedly; nothing is
 * mutated or purged by a read.
 */
export function snapshotScriptMemory(): ScriptMemorySnapshot {
  // Refresh the CURRENT frame from the engine first (DEV read only): the
  // stroke-completion path only marks frames dirty, so a probe read is one of
  // the sanctioned O(n) projection points. Idempotent and signal-free.
  const currentFrame = brushFrameGetter ? brushFrameGetter() : 0;
  flushBrushScriptFrame(
    currentFrame,
    brushEngine ? brushEngine.getStrokes() : null,
    brushEngine ? brushEngine.getFramePaintSettings() ?? brushEngine.getPaintRenderSettings() : null,
  );
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
    brushStrokes: brushEngine ? brushEngine.getStrokes() : null,
    brushScript: getBrushScriptReport(),
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

/**
 * Install the DEV global for a freshly-ready engine. Returns early in a
 * production build and outside a window — the double guard in the
 * threat register (T-f9c-03).
 */
export function installScriptMemoryProbe(
  engine: EfxPaintEngine,
  getCurrentFrame?: () => number,
): void {
  if (!import.meta.env.DEV || typeof window === 'undefined') return;
  registerScriptMemoryBrushEngine(engine);
  registerScriptMemoryBrushFrame(getCurrentFrame ?? null);
  installScriptMemoryGlobal(window, { snapshot: snapshotScriptMemory }, true);
}
