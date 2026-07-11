const PAPER_TEXTURE_URLS: Record<string, string> = {
  canvas1: '/img/paper_1.jpg',
  canvas2: '/img/paper_2.jpg',
  canvas3: '/img/paper_3.jpg',
};

const textureCache = new Map<string, HTMLImageElement>();
const paperCanvasCache = new Map<string, HTMLCanvasElement>();
const loadingTextures = new Map<string, HTMLImageElement>();
const textureListeners = new Map<string, Set<() => void>>();

export function drawProjectPaperRaster(
  context: CanvasRenderingContext2D,
  texture: CanvasImageSource,
  width: number,
  height: number,
): void {
  context.save();
  context.globalCompositeOperation = 'source-over';
  context.globalAlpha = 1;
  context.fillStyle = '#fff';
  context.fillRect(0, 0, width, height);
  context.globalAlpha = 0.18;
  const pattern = typeof context.createPattern === 'function' ? context.createPattern(texture, 'repeat') : null;
  if (pattern) {
    context.fillStyle = pattern;
    context.fillRect(0, 0, width, height);
  } else {
    const source = texture as { width?: number; height?: number };
    const textureWidth = source.width ?? width;
    const textureHeight = source.height ?? height;
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
): HTMLCanvasElement | null {
  const url = paperTexture ? PAPER_TEXTURE_URLS[paperTexture] : undefined;
  if (!url || !paperTexture || width <= 0 || height <= 0) return null;
  const texture = textureCache.get(paperTexture);
  if (!texture) {
    ensurePaperTextureLoading(paperTexture, url);
    return null;
  }
  const cacheKey = `${paperTexture}:${width}x${height}`;
  const cached = paperCanvasCache.get(cacheKey);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return null;
  drawProjectPaperRaster(context, texture, width, height);
  paperCanvasCache.set(cacheKey, canvas);
  return canvas;
}

export function subscribeProjectPaperCanvas(
  paperTexture: string | undefined,
  width: number,
  height: number,
  listener: (canvas: HTMLCanvasElement | null) => void,
): () => void {
  const url = paperTexture ? PAPER_TEXTURE_URLS[paperTexture] : undefined;
  if (!url || !paperTexture || width <= 0 || height <= 0) {
    listener(null);
    return () => {};
  }
  const notify = () => listener(getProjectPaperCanvas(paperTexture, width, height));
  const listeners = textureListeners.get(paperTexture) ?? new Set<() => void>();
  listeners.add(notify);
  textureListeners.set(paperTexture, listeners);
  notify();
  return () => {
    listeners.delete(notify);
    if (listeners.size === 0) textureListeners.delete(paperTexture);
  };
}

export function isProjectPaperTextureResolved(paperTexture: string): boolean {
  return !PAPER_TEXTURE_URLS[paperTexture] || textureCache.has(paperTexture);
}

export function clearProjectPaperRasterCache(): void {
  paperCanvasCache.clear();
}
