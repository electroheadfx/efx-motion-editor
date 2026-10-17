/**
 * 261017-mdr: idle warm-up for the procedural paper fond.
 * 261017-mz9: warm-up is a worker prefetch only — the heavy sheet work lives
 * in paperSheet.worker.ts behind requestProceduralSheet. The main-thread cost
 * is a map lookup + postMessage; nothing here builds a fond canvas inline.
 *
 * Best-effort background work: never runs heavy work on the caller's thread,
 * never throws into the Studio, and is idempotent by construction (repeat keys
 * are cache hits in requestProceduralSheet).
 */
import { requestProceduralSheet } from './paperSheetClient';
import { isProceduralPaperTexture } from './projectPaperRaster';

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
 * Prefetch one procedural sheet through the worker client so the first
 * *visible* fond is a cache hit. No-op for non-procedural ids / hostile sizes.
 * Never throws.
 */
export function warmProceduralPaperSheet(input: ProceduralPaperWarmupInput): void {
  try {
    if (!isWarmableInput(input)) return;
    void requestProceduralSheet(input);
  } catch (error) {
    console.warn('paperSheetWarmup: warm-up failed', error);
  }
}

/**
 * Deferred prefetch: setTimeout(0) (the codebase's deferred-work pattern,
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
