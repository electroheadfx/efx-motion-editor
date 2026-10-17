// 56-05 (PAPER-01): the 13-paper library's procedural height fields.
// The `./papers` sub-export is the lean entry (no fluid engine, no brushes).
// 261017-ki6: the fond is a 1:1 port of the watercolor-playground paper
// shader (playgroundPaperField) — not an app-authored equivalent process.
import {
  PAPER_UNITS,
  presetForPaperId,
  renderPaperSheet,
} from '@efxlab/efx-watercolor/papers';
import { renderPaperSheetGl } from './paperFieldGl';

const PAPER_TEXTURE_URLS: Record<string, string> = {
  canvas1: '/img/paper_1.jpg',
  canvas2: '/img/paper_2.jpg',
  canvas3: '/img/paper_3.jpg',
  // 56-05 (PAPER-04): the 13-paper library's recovered real scans ride the
  // same shipped assets under their library ids (D-12 one library).
  'paper/real-1': '/img/paper_1.jpg',
  'paper/real-2': '/img/paper_2.jpg',
  'paper/real-3': '/img/paper_3.jpg',
};

/**
 * 56-05 (PAPER-01): procedural library papers have no image to decode —
 * they are seeded height-map fields, always "resolved".
 */
export function isProceduralPaperTexture(paperTexture: string): boolean {
  return paperTexture.startsWith('paper/') && !(paperTexture in PAPER_TEXTURE_URLS);
}

const textureCache = new Map<string, HTMLImageElement>();
const paperCanvasCache = new Map<string, HTMLCanvasElement>();
const loadingTextures = new Map<string, HTMLImageElement>();
const textureListeners = new Map<string, Set<() => void>>();
/** 261017-iwm: full-fond procedural rasters keyed by content (paper, seed, size, grain). */
const proceduralFondCache = new Map<string, HTMLCanvasElement>();

/**
 * 261017-ki6: the fond is the ported playground sheet. Build (and cache) an
 * opaque paperColour sRGB raster at the fond's full W×H — field → light →
 * colour, no tiling, no createPattern, no grayscale relief overlay. Unknown
 * ids return null (deterministic fail-soft → the existing flat-color arm).
 *
 * Scale law (playground Engine.ts:353): uScale = PAPER_UNITS / (height *
 * grainScale) paper units per texel, so feature size is constant at any
 * canvas size; grainScale 2 halves units-per-texel and coarsens the grain,
 * matching the jpg pattern-transform zoom direction. Offset is [0, 0]; the
 * fond covers the whole sheet. Seed stays 1 (the cache key's seed term).
 */
function buildProceduralPaperFond(
  paperTexture: string,
  width: number,
  height: number,
  scale: number,
): HTMLCanvasElement | null {
  const normalized = normalizeGrainScale(scale);
  const cacheKey = `${paperTexture}|1|${width}x${height}|${normalized}`;
  const cached = proceduralFondCache.get(cacheKey);
  if (cached) return cached;
  const preset = presetForPaperId(paperTexture);
  if (!preset) return null;
  const uScale = PAPER_UNITS / (height * normalized);
  // 261017-lny: GPU first (playground GLSL on offscreen WebGL2), CPU port
  // as the no-WebGL fallback. Same bytes contract — opaque paperColour sRGB.
  const rgba = renderPaperSheetGl(width, height, uScale, 1, preset)
    ?? renderPaperSheet(width, height, uScale, 1, preset);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return null;
  const image = context.createImageData(width, height);
  image.data.set(rgba);
  context.putImageData(image, 0, 0);
  proceduralFondCache.set(cacheKey, canvas);
  return canvas;
}

/** Positive finite grain scale, else 1 (hostile input never hangs a tile loop). */
export function normalizeGrainScale(scale: number): number {
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

/** Tile step for the no-pattern fallback: floored at 1 so 0/negative/NaN still draw. */
function flooredTileStep(base: number, scale: number): number {
  const step = Math.floor(base * scale);
  return Number.isFinite(step) && step >= 1 ? step : 1;
}

/**
 * Draw a paper texture under paint.
 *
 * Two arms, never mixed:
 * - `opaqueSheet` (procedural `paperColour` sheets from buildProceduralPaperFond):
 *   already opaque with their own tint — draw at globalAlpha = 1 with NO white
 *   under-fill and no createPattern repeat. The jpg overlay treatment would
 *   destroy their density (261017-lny reopen wash-out).
 * - default / real-jpg (`paper/real-1..3`, `canvas1..3`): white fill + grain
 *   pattern at globalAlpha = 0.18.
 */
export function drawProjectPaperRaster(
  context: CanvasRenderingContext2D,
  texture: CanvasImageSource,
  width: number,
  height: number,
  scale = 1,
  options?: { opaqueSheet?: boolean },
): void {
  context.save();
  context.globalCompositeOperation = 'source-over';
  context.globalAlpha = 1;
  if (options?.opaqueSheet) {
    // Full-density procedural sheet: no white under-fill, no 0.18 overlay.
    context.drawImage(texture, 0, 0, width, height);
    context.restore();
    return;
  }
  context.fillStyle = '#fff';
  context.fillRect(0, 0, width, height);
  context.globalAlpha = 0.18;
  const pattern = typeof context.createPattern === 'function' ? context.createPattern(texture, 'repeat') : null;
  if (pattern) {
    // Scale 1 stays byte-identical to the natural-size hot path (no setTransform).
    // Guard: some contexts (and fakes) return a bare pattern without setTransform.
    if (scale !== 1 && typeof (pattern as { setTransform?: unknown }).setTransform === 'function') {
      pattern.setTransform({ a: scale, b: 0, c: 0, d: scale, e: 0, f: 0 });
    }
    context.fillStyle = pattern;
    context.fillRect(0, 0, width, height);
  } else {
    const source = texture as { width?: number; height?: number };
    const textureWidth = flooredTileStep(source.width ?? width, scale);
    const textureHeight = flooredTileStep(source.height ?? height, scale);
    for (let y = 0; y < height; y += textureHeight) {
      for (let x = 0; x < width; x += textureWidth) context.drawImage(texture, x, y);
    }
  }
  context.restore();
}

function notifyTextureListeners(paperTexture: string): void {
  const listeners = textureListeners.get(paperTexture);
  if (!listeners) return;
  for (const listener of [...listeners]) listener();
}

function ensurePaperTextureLoading(paperTexture: string, url: string): void {
  if (textureCache.has(paperTexture) || loadingTextures.has(paperTexture)) return;
  const image = new Image();
  loadingTextures.set(paperTexture, image);
  image.onload = () => {
    loadingTextures.delete(paperTexture);
    textureCache.set(paperTexture, image);
    notifyTextureListeners(paperTexture);
  };
  image.onerror = () => {
    loadingTextures.delete(paperTexture);
    notifyTextureListeners(paperTexture);
  };
  image.src = url;
}

export function getProjectPaperCanvas(
  paperTexture: string | undefined,
  width: number,
  height: number,
  scale = 1,
): HTMLCanvasElement | null {
  if (!paperTexture || width <= 0 || height <= 0) return null;
  // I-07: the ported playground field is the renderer — never jpeg.
  // Procedural ids synthesize a full-fond opaque sheet (no tile repeat).
  if (isProceduralPaperTexture(paperTexture)) {
    return buildProceduralPaperFond(paperTexture, width, height, scale);
  }
  let texture: CanvasImageSource;
  {
    const url = PAPER_TEXTURE_URLS[paperTexture];
    if (!url) return null;
    const loaded = textureCache.get(paperTexture);
    if (!loaded) {
      ensurePaperTextureLoading(paperTexture, url);
      return null;
    }
    texture = loaded;
  }
  // Isolate prepared canvases by grain scale so a rescale never reuses a
  // natural-size (or differently scaled) raster.
  const cacheKey = `${paperTexture}:${width}x${height}:${normalizeGrainScale(scale)}`;
  const cached = paperCanvasCache.get(cacheKey);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return null;
  drawProjectPaperRaster(context, texture, width, height, scale);
  paperCanvasCache.set(cacheKey, canvas);
  return canvas;
}

export function subscribeProjectPaperCanvas(
  paperTexture: string | undefined,
  width: number,
  height: number,
  listener: (canvas: HTMLCanvasElement | null) => void,
  scale = 1,
): () => void {
  if (!paperTexture || width <= 0 || height <= 0) {
    listener(null);
    return () => {};
  }
  // I-07: procedural papers are always resolved (isProjectPaperTextureResolved)
  // — deliver the synthesized tile synchronously, no listener table.
  if (isProceduralPaperTexture(paperTexture)) {
    listener(getProjectPaperCanvas(paperTexture, width, height, scale));
    return () => {};
  }
  const url = PAPER_TEXTURE_URLS[paperTexture];
  if (!url) {
    listener(null);
    return () => {};
  }
  const notify = () => listener(getProjectPaperCanvas(paperTexture, width, height, scale));
  const listeners = textureListeners.get(paperTexture) ?? new Set<() => void>();
  listeners.add(notify);
  textureListeners.set(paperTexture, listeners);
  notify();
  return () => {
    listeners.delete(notify);
    if (listeners.size === 0) textureListeners.delete(paperTexture);
  };
}

/**
 * 260925-iy6: the RAW decoded texture behind the decode-once cache — read-only
 * getter for the paper-pass tile builder (build-time pixel probe only). Returns
 * null while the texture is unresolved so callers can take their deterministic
 * skip path; never triggers a load (the resolve subscription owns arrival).
 */
export function getProjectPaperTextureImage(paperTexture: string): HTMLImageElement | null {
  return textureCache.get(paperTexture) ?? null;
}

export function isProjectPaperTextureResolved(paperTexture: string): boolean {
  if (isProceduralPaperTexture(paperTexture)) return true;
  return !PAPER_TEXTURE_URLS[paperTexture] || textureCache.has(paperTexture);
}

/**
 * Resolve-only subscription: fires ONLY when the texture load settles (load or
 * error) — never an immediate notify, never a canvas delivery. For watchers
 * that only need the "texture arrived" signal (the flattened fond watcher)
 * without pre-warming the cache on the query path.
 */
export function subscribeProjectPaperTextureResolve(paperTexture: string, listener: () => void): () => void {
  const listeners = textureListeners.get(paperTexture) ?? new Set<() => void>();
  listeners.add(listener);
  textureListeners.set(paperTexture, listeners);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) textureListeners.delete(paperTexture);
  };
}

export function clearProjectPaperRasterCache(): void {
  paperCanvasCache.clear();
  proceduralFondCache.clear();
}

/**
 * Test-only deep reset: the texture cache, in-flight loads, and listeners are
 * module-level and would otherwise leak across tests (a resolved texture flips
 * getProjectPaperCanvas from the loading null to a real canvas, changing
 * downstream draw logs). Production uses clearProjectPaperRasterCache so live
 * subscribers (leaf paper canvases, the flattened fond watcher) survive.
 */
export function resetProjectPaperRasterForTests(): void {
  paperCanvasCache.clear();
  proceduralFondCache.clear();
  textureCache.clear();
  loadingTextures.clear();
  textureListeners.clear();
}
