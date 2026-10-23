// ============================================================
//  scriptMemoryProbe — the ONE wiring module for the DEV-only
//  `window.__EFX_SCRIPT_MEMORY__.snapshot()` measurement
//  (quick 261023-f9c).
//
//  Installed from the Studio engine-ready seam beside
//  installDh1CaptureHook: DEV guard, no effect, no state, no UI.
//  It only READS:
//    - the aquarelle raw registry + projected timeline entries
//    - the current engine's stroke copies (getStrokes() returns copies)
//    - the four named frame caches (separate section, never folded in)
//
//  Brush has no per-frame store: navigation calls engine.clear(), so
//  this measures the CURRENT engine frame only.
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

/**
 * The last engine that reached the ready seam. No signal, no component
 * state — a new engine simply replaces the previous reference.
 */
let brushEngine: EfxPaintEngine | null = null;

export function registerScriptMemoryBrushEngine(engine: EfxPaintEngine | null): void {
  brushEngine = engine;
}

/**
 * Assemble the read-only snapshot. Safe to call repeatedly; nothing is
 * mutated or purged by a read.
 */
export function snapshotScriptMemory(): ScriptMemorySnapshot {
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
export function installScriptMemoryProbe(engine: EfxPaintEngine): void {
  if (!import.meta.env.DEV || typeof window === 'undefined') return;
  registerScriptMemoryBrushEngine(engine);
  installScriptMemoryGlobal(window, { snapshot: snapshotScriptMemory }, true);
}
