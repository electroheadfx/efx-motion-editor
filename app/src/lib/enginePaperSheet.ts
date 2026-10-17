// 261017-nnu: the ONE paper-sheet door into the vendored WatercolorEngine.
//
// Thin offscreen-engine host + Map cache over `engine.paperSheet` /
// `engine.paperHeight` — a map, never a generator. No field maths, no GLSL,
// no worker. Real jpg papers (`paper/real-1..3`, `canvas*`) return null so
// the grain-over-white arm stays the caller's business.
import { WatercolorEngine, type PaperPreset } from '@efxlab/efx-watercolor';
import {
  STUDIO_PAPER_TO_PRESET,
  paperPresetForStudioId,
} from '../components/physic-paint/engine/AquarelleCanvasLayer';
import { capturePaperFond } from './paperFondCapture';

let engine: WatercolorEngine | null = null;
const sheetCache = new Map<string, HTMLCanvasElement>();
const heightCache = new Map<string, Float32Array>();

function getOffscreenEngine(): WatercolorEngine | null {
  if (engine) return engine;
  if (typeof document === 'undefined') return null;
  try {
    const canvas = document.createElement('canvas');
    engine = new WatercolorEngine(canvas, null, {}, [1, 1]);
    return engine;
  } catch {
    // No WebGL2 / no float targets — the Studio must never throw from paper generation.
    engine = null;
    return null;
  }
}

/**
 * Studio paper id → playground PaperPreset via the one table in
 * AquarelleCanvasLayer. Real / unknown ids are null (jpg arm stays caller-side).
 */
function presetForStudioPaperId(studioPaperId: string): PaperPreset | null {
  if (!(studioPaperId in STUDIO_PAPER_TO_PRESET)) return null;
  return paperPresetForStudioId(studioPaperId);
}

function cacheKey(studioPaperId: string, width: number, height: number, scale: number): string {
  return `${studioPaperId}|${width}x${height}|${scale}`;
}

/** Measure-only: a few sheet pixels so a white readback is visible in the capture. */
function sampleSheetPixels(canvas: HTMLCanvasElement): Array<{ x: number; y: number; rgba: string }> {
  try {
    const context = canvas.getContext('2d');
    if (!context) return [{ x: -1, y: -1, rgba: 'no-2d-context' }];
    const points: Array<[number, number]> = [
      [Math.floor(canvas.width / 2), Math.floor(canvas.height / 2)],
      [Math.floor(canvas.width / 4), Math.floor(canvas.height / 4)],
      [1, 1],
    ];
    return points.map(([x, y]) => {
      const data = context.getImageData(x, y, 1, 1).data;
      return { x, y, rgba: `${data[0]},${data[1]},${data[2]},${data[3]}` };
    });
  } catch (error) {
    return [{ x: -1, y: -1, rgba: `error:${error instanceof Error ? error.message : String(error)}` }];
  }
}

/** Cached engine sheet (fond + thumbs). Repeat of the same key returns the identical canvas. */
export function getEnginePaperSheet(
  studioPaperId: string,
  width: number,
  height: number,
  scale: number,
): HTMLCanvasElement | null {
  if (!studioPaperId || !(width > 0) || !(height > 0) || !(scale > 0) || !Number.isFinite(scale)) return null;
  const key = cacheKey(studioPaperId, width, height, scale);
  const cached = sheetCache.get(key);
  if (cached) return cached;
  const preset = presetForStudioPaperId(studioPaperId);
  if (!preset) {
    capturePaperFond('sheet', { studioPaperId, width, height, scale, ok: false, reason: 'no-preset' });
    return null;
  }
  const eng = getOffscreenEngine();
  if (!eng) {
    capturePaperFond('sheet', { studioPaperId, width, height, scale, ok: false, reason: 'no-engine' });
    return null;
  }
  try {
    const canvas = eng.paperSheet(preset, width, height, scale);
    sheetCache.set(key, canvas);
    capturePaperFond('sheet', {
      studioPaperId,
      width,
      height,
      scale,
      ok: true,
      sheet: `${canvas.width}x${canvas.height}`,
      pixels: sampleSheetPixels(canvas),
    });
    return canvas;
  } catch (error) {
    capturePaperFond('sheet', { studioPaperId, width, height, scale, ok: false, reason: 'throw', error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

/** Cached engine height field (bake tooth). Repeat of the same key returns the identical array. */
export function getEnginePaperHeight(
  studioPaperId: string,
  width: number,
  height: number,
  scale: number,
): Float32Array | null {
  if (!studioPaperId || !(width > 0) || !(height > 0) || !(scale > 0) || !Number.isFinite(scale)) return null;
  const key = cacheKey(studioPaperId, width, height, scale);
  const cached = heightCache.get(key);
  if (cached) return cached;
  const preset = presetForStudioPaperId(studioPaperId);
  if (!preset) return null;
  const eng = getOffscreenEngine();
  if (!eng) return null;
  try {
    const heightMap = eng.paperHeight(preset, width, height, scale);
    heightCache.set(key, heightMap);
    return heightMap;
  } catch {
    return null;
  }
}

/** Test-only deep reset: both maps + the offscreen engine. */
export function resetEnginePaperSheetForTests(): void {
  sheetCache.clear();
  heightCache.clear();
  engine = null;
}
