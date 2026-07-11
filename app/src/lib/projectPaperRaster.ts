const PAPER_TEXTURE_URLS: Record<string, string> = {
  canvas1: '/img/paper_1.jpg',
  canvas2: '/img/paper_2.jpg',
  canvas3: '/img/paper_3.jpg',
};

const textureCache = new Map<string, HTMLImageElement>();
const paperCanvasCache = new Map<string, HTMLCanvasElement>();
const loadingTextures = new Map<string, HTMLImageElement>();
const failedTextures = new Set<string>();
const resolutionListeners = new Set<() => void>();

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

export function getProjectPaperCanvas(
  paperTexture: string | undefined,
  width: number,
  height: number,
  onResolved?: () => void,
): HTMLCanvasElement | null {
  const url = paperTexture ? PAPER_TEXTURE_URLS[paperTexture] : undefined;
  if (!url || width <= 0 || height <= 0) return null;
  if (onResolved) resolutionListeners.add(onResolved);
  const texture = textureCache.get(paperTexture!);
  if (!texture) {
    if (!loadingTextures.has(paperTexture!) && !failedTextures.has(paperTexture!)) {
      const image = new Image();
      loadingTextures.set(paperTexture!, image);
      image.onload = () => {
        loadingTextures.delete(paperTexture!);
        textureCache.set(paperTexture!, image);
        for (const listener of resolutionListeners) listener();
      };
      image.onerror = () => {
        loadingTextures.delete(paperTexture!);
        failedTextures.add(paperTexture!);
        for (const listener of resolutionListeners) listener();
      };
      image.src = url;
    }
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

export function isProjectPaperTextureResolved(paperTexture: string): boolean {
  return !PAPER_TEXTURE_URLS[paperTexture] || textureCache.has(paperTexture) || failedTextures.has(paperTexture);
}

export function clearProjectPaperRasterCache(): void {
  paperCanvasCache.clear();
}
