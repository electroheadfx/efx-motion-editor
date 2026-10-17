/**
 * 261017-mdr: idle warm-up for the procedural paper fond.
 *
 * The first visible fond used to pay a synchronous full-canvas GPU readback +
 * two full-frame CPU copies. After the blit path (paperFieldGl /
 * projectPaperRaster) the remaining first-call cost is GL init + program
 * compile + sheet generation. This module pre-generates the currently selected
 * sheet (and the PaperPicker thumbs live beside it) in a deferred slot so the
 * first *visible* fond is a proceduralFondCache hit.
 *
 * Best-effort background work: never runs synchronously from the caller, never
 * throws into the Studio, and is idempotent by construction (repeat keys are
 * cache hits in getProjectPaperCanvas / the picker reliefCache).
 */
import { getProjectPaperCanvas, isProceduralPaperTexture } from './projectPaperRaster';

export interface ProceduralPaperWarmupInput {
  paperTexture: string;
  width: number;
  height: number;
  grainScale: number;
}

function isWarmableInput(input: ProceduralPaperWarmupInput): boolean {
  return isProceduralPaperTexture(input.paperTexture)
    && Number.isInteger(input.width)
    && Number.isInteger(input.height)
    && input.width > 0
    && input.height > 0
    && Number.isFinite(input.grainScale)
    && input.grainScale > 0;
}

/**
 * Pre-generate one procedural sheet through getProjectPaperCanvas so it lands
 * in the same proceduralFondCache the flatten path reads. No-op for
 * non-procedural ids / hostile sizes. Never throws.
 */
export function warmProceduralPaperSheet(input: ProceduralPaperWarmupInput): void {
  try {
    if (!isWarmableInput(input)) return;
    getProjectPaperCanvas(input.paperTexture, input.width, input.height, input.grainScale);
  } catch (error) {
    console.warn('paperSheetWarmup: warm-up failed', error);
  }
}

/**
 * Deferred warm-up: setTimeout(0) (the codebase's deferred-work pattern,
 * projectStore.ts), with requestIdleCallback as an optional accelerator when
 * the host exposes it. Never runs inline. A second schedule while one is in
 * flight is fine — it will just cache-hit.
 */
export function scheduleProceduralPaperWarmup(input: ProceduralPaperWarmupInput): void {
  const run = () => warmProceduralPaperSheet(input);
  try {
    const idle = (globalThis as { requestIdleCallback?: (callback: () => void) => unknown }).requestIdleCallback;
    if (typeof idle === 'function') {
      idle(run);
      return;
    }
  } catch {
    // Hostile host without a usable rIC — fall through to setTimeout.
  }
  setTimeout(run, 0);
}
