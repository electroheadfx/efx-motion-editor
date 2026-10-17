// 56-05 (PAPER-01): the 13-paper library's procedural height fields.
// The `./papers` sub-export is the lean entry (no fluid engine, no brushes).
import { PAPER_REFERENCE_HEIGHT, proceduralHeightMap } from '@efxlab/efx-watercolor/papers';

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
 * 261017-fz3: per-paper bump/mottle from the playground `engine/papers.ts:23-32`.
 * bump scales the relief shade contrast; mottle scales the low-frequency
 * cloudiness. Map studio ids via STUDIO_PAPER_TO_PRESET semantics (cold-press→cold,
 * hot-press→hot, rough→rough, khadi→khadi, washi→washi, laid→laid, canvas→canvas,
 * toned-sand→toned, kraft→kraft, student→cellulose).
 */
const PLAYGROUND_PAPER_LOOK: Readonly<Record<string, { bump: number; mottle: number }>> = Object.freeze({
  'paper/cold-press': { bump: 1.0, mottle: 0.05 },
  'paper/hot-press': { bump: 0.6, mottle: 0.04 },
  'paper/rough': { bump: 0.8, mottle: 0.06 },
  'paper/khadi': { bump: 1.0, mottle: 0.12 },
  'paper/washi': { bump: 0.8, mottle: 0.14 },
  'paper/laid': { bump: 1.0, mottle: 0.05 },
  'paper/canvas': { bump: 1.0, mottle: 0.04 },
  'paper/toned-sand': { bump: 1.0, mottle: 0.06 },
  'paper/kraft': { bump: 0.8, mottle: 0.12 },
  'paper/student': { bump: 1.0, mottle: 0.03 },
});

function playgroundLook(paperTexture: string): { bump: number; mottle: number } {
  return PLAYGROUND_PAPER_LOOK[paperTexture] ?? { bump: 1.0, mottle: 0.05 };
}

/**
 * I-07: proceduralHeightMap is the renderer — never jpeg. Build (and cache) a
 * grayscale relief fond with the PaperPicker shade formula (PaperPicker.tsx
 * `proceduralReliefImage` — h as luminance, one-sided slope toward light) so
 * the picker and the editor fond agree on the paper's look. Unknown ids return
 * null (deterministic fail-soft → the existing flat-color arm).
 *
 * 261017-iwm: the fond is generated at the actual raster W×H — one continuous
 * field, no createPattern repeat. Feature size follows the playground
 * PAPER_REFERENCE_HEIGHT = 1100 law (constant physical size at any canvas
 * size). Per-paper bump/mottle (playground papers.ts) modulate the shade
 * contrast / cloudiness.
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
  // grainScale 2 coarsens the field (referenceHeight doubles → features double),
  // matching the jpg pattern-transform zoom direction.
  const referenceHeight = PAPER_REFERENCE_HEIGHT * normalized;
  const field = proceduralHeightMap(paperTexture, 1, width, height, referenceHeight);
  if (!field) return null;
  const look = playgroundLook(paperTexture);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return null;
  const image = context.createImageData(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const h = field[i];
      const hx = field[y * width + Math.min(x + 1, width - 1)];
      const hy = field[Math.min(y + 1, height - 1) * width + x];
      const slope = (hx - h) + (hy - h);
      // PaperPicker shade formula modulated by playground bump (contrast) and
      // mottle (low-frequency cloudiness) — recognisably the same formula.
      const shade = Math.max(0, Math.min(1,
        0.55 + (h - 0.5) * 0.7 * look.bump - slope * 2.2 * look.bump + (h - 0.5) * look.mottle * 2,
      ));
      const channel = Math.round(shade * 255);
      const offset = i * 4;
      image.data[offset] = channel;
      image.data[offset + 1] = channel;
      image.data[offset + 2] = channel;
      image.data[offset + 3] = 255;
    }
  }
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

export function drawProjectPaperRaster(
  context: CanvasRenderingContext2D,
  texture: CanvasImageSource,
  width: number,
  height: number,
  scale = 1,
): void {
  context.save();
  context.globalCompositeOperation = 'source-over';
  context.globalAlpha = 1;
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
  // I-07: proceduralHeightMap is the renderer — never jpeg. Procedural ids
  // synthesize a full-fond relief raster (261017-iwm: no tile repeat).
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
