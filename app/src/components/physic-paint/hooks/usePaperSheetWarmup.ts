/**
 * 261017-mdr: Studio-side idle warm-up of the selected procedural paper sheet
 * (and the PaperPicker thumbs). One hook call at the working-size + paper seam
 * — the warm-up logic itself lives in lib/paperSheetWarmup + PaperPicker.
 *
 * Not selection-related: a mount/param effect is fine (efx-preact-reactivity
 * rule 4 — primitive identity-stable deps, no useState). Skips non-procedural
 * papers (the jpg arm is decode-cached elsewhere).
 */
import { useEffect, useRef } from 'preact/hooks';
import { isProceduralPaperTexture } from '../../../lib/projectPaperRaster';
import { scheduleProceduralPaperWarmup } from '../../../lib/paperSheetWarmup';
import { warmProceduralReliefThumbs } from '../view/PaperPicker';

export interface PaperSheetWarmupInput {
  paperTexture: string;
  width: number;
  height: number;
  grainScale: number;
}

function isWarmable(input: PaperSheetWarmupInput): boolean {
  return isProceduralPaperTexture(input.paperTexture)
    && Number.isInteger(input.width)
    && Number.isInteger(input.height)
    && input.width > 0
    && input.height > 0
    && Number.isFinite(input.grainScale)
    && input.grainScale > 0;
}

/**
 * Schedule warm-up once per distinct (paperTexture, W, H, grainScale) set.
 * Deferred off first paint; a second schedule with the same inputs is a cache
 * hit at the fond / thumb layers (no rebuild).
 */
export function usePaperSheetWarmup(input: PaperSheetWarmupInput): void {
  const lastKeyRef = useRef<string | null>(null);
  const { paperTexture, width, height, grainScale } = input;
  useEffect(() => {
    if (!isWarmable({ paperTexture, width, height, grainScale })) return;
    const key = `${paperTexture}|${width}x${height}|${grainScale}`;
    if (lastKeyRef.current === key) return;
    lastKeyRef.current = key;
    scheduleProceduralPaperWarmup({ paperTexture, width, height, grainScale });
    try {
      warmProceduralReliefThumbs();
    } catch (error) {
      console.warn('usePaperSheetWarmup: thumb warm-up failed', error);
    }
  }, [paperTexture, width, height, grainScale]);
}
