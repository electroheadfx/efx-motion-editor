// ============================================================
//  scriptMemoryProbe — the DEV-only `window.__EFX_SCRIPT_MEMORY__`
//  measurement (quick 261023-f9c), now a thin delegation to the
//  PRODUCTION read entry point (quick 261023-ors).
//
//  ONE assembler, two entry points: `readStudioScriptMemorySnapshot`
//  in studioScriptMemoryGauge.ts does the assembly for both the
//  Memory tab and this DEV global, so the probe can never drift
//  from what the artist sees.
//
//  Installed from the Studio engine-ready seam beside
//  installDh1CaptureHook: DEV guard, no effect, no state, no UI.
//  It only READS (or, for the brush store, refreshes the CURRENT
//  frame from the engine — idempotent, no signal, no file).
// ============================================================

import type { EfxPaintEngine } from '@efxlab/efx-physic-paint';
import {
  installScriptMemoryGlobal,
  type ScriptMemorySnapshot,
} from './scriptMemorySnapshot';
import { readStudioScriptMemorySnapshot } from './studioScriptMemoryGauge';

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
 * Assemble the read-only snapshot through the shared gauge assembler.
 * Safe to call repeatedly; nothing is mutated or purged by a read.
 */
export function snapshotScriptMemory(): ScriptMemorySnapshot {
  return readStudioScriptMemorySnapshot({
    engine: brushEngine,
    frame: brushFrameGetter ? brushFrameGetter() : 0,
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
