import type {Layer, BlendMode} from '../types/layer';
import type {FrameEntry} from '../types/timeline';
import {imageStore} from '../stores/imageStore';
import {assetUrl} from './ipc';

/**
 * Map our BlendMode enum to Canvas 2D globalCompositeOperation values.
 */
function blendModeToCompositeOp(mode: BlendMode): GlobalCompositeOperation {
  switch (mode) {
    case 'normal':
      return 'source-over';
    case 'screen':
      return 'screen';
    case 'multiply':
      return 'multiply';
    case 'overlay':
      return 'overlay';
    case 'add':
      return 'lighter';
    default:
      return 'source-over';
  }
}

/**
 * Canvas 2D compositing engine that renders all visible layers bottom-to-top.
 *
 * Designed to be reusable by Phase 10 (export) at arbitrary resolutions.
 * The renderer is decoupled from UI — it only needs a canvas and layer data.
 */
export class PreviewRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private imageCache: Map<string, HTMLImageElement>; // imageId -> loaded HTMLImageElement
  private loadingImages: Set<string>; // imageIds currently loading
  private videoElements: Map<string, HTMLVideoElement>; // layerId -> video element
  private videoReadyHandlers: Map<string, () => void>; // layerId -> shared loadeddata/seeked handler
  private offscreenCanvas: HTMLCanvasElement | null = null; // reusable offscreen canvas for video rasterization

  /** Callback invoked after an image finishes loading (triggers re-render) */
  onImageLoaded: (() => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('PreviewRenderer: failed to get 2d context');
    }
    this.ctx = ctx;
    this.imageCache = new Map();
    this.loadingImages = new Set();
    this.videoElements = new Map();
    this.videoReadyHandlers = new Map();
  }

  /**
   * Render all visible layers for the given frame number.
   * Called on every frame change and on layer property changes.
   * @param layers - layers array in bottom-to-top order (index 0 = bottom)
   * @param frame - current frame number (0-based)
   * @param frames - flattened frame map for image-sequence base layer lookup
   * @param fps - frames per second from the active sequence, needed for video layer time sync
   */
  renderFrame(
    layers: Layer[],
    frame: number,
    frames: FrameEntry[],
    fps: number,
  ): void {
    // Sync canvas internal resolution to display size (Retina DPI)
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const displayW = Math.round(rect.width * dpr);
    const displayH = Math.round(rect.height * dpr);
    if (this.canvas.width !== displayW || this.canvas.height !== displayH) {
      this.canvas.width = displayW;
      this.canvas.height = displayH;
    }

    // Pre-resolve all layer sources before clearing canvas.
    // If no layer has a drawable source, keep the previous frame visible
    // (avoids black flashes while images load asynchronously).
    const resolved: { layer: Layer; source: CanvasImageSource }[] = [];
    const logicalW = rect.width;
    const logicalH = rect.height;

    // Track visible video layers that are still loading (readyState < 2)
    const loadingVideoLayers: Layer[] = [];

    for (const layer of layers) {
      if (!layer.visible) continue;
      const source = this.resolveLayerSource(layer, frame, frames, fps);
      if (source !== null) {
        resolved.push({layer, source});
      } else if (layer.source.type === 'video') {
        loadingVideoLayers.push(layer);
      }
    }

    if (resolved.length === 0 && loadingVideoLayers.length === 0) {
      return; // Keep previous frame
    }

    const ctx = this.ctx;

    // Clear canvas only when we have something to draw
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Apply DPI scaling — all drawing uses logical pixels (rect.width x rect.height)
    ctx.save();
    ctx.scale(dpr, dpr);

    for (const {layer, source} of resolved) {
      this.drawLayer(source, layer, logicalW, logicalH);
    }

    // Draw loading placeholders for video layers that aren't ready yet
    for (const layer of loadingVideoLayers) {
      ctx.save();
      ctx.globalCompositeOperation = blendModeToCompositeOp(layer.blendMode);
      ctx.globalAlpha = layer.opacity * 0.5;
      ctx.fillStyle = '#333333';
      const pw = logicalW * 0.4;
      const ph = logicalH * 0.2;
      ctx.fillRect((logicalW - pw) / 2, (logicalH - ph) / 2, pw, ph);
      ctx.globalAlpha = layer.opacity;
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`Loading ${layer.name}...`, logicalW / 2, logicalH / 2);
      ctx.restore();
    }

    ctx.restore();
  }

  /**
   * Resolve the drawable source for a layer at the given frame.
   * - static-image: always the same HTMLImageElement
   * - image-sequence (base layer): uses frameMap to find imageId for current frame
   * - image-sequence (overlay): per-layer frame indexing via imageIds array
   * - video: HTMLVideoElement with currentTime synced via fps
   */
  private resolveLayerSource(
    layer: Layer,
    frame: number,
    frames: FrameEntry[],
    fps: number,
  ): CanvasImageSource | null {
    switch (layer.source.type) {
      case 'static-image': {
        return this.getImageSource(layer.source.imageId);
      }

      case 'image-sequence': {
        // Base layer: use frameMap to get imageId for current frame
        if (layer.isBase || layer.source.imageIds.length === 0) {
          if (frames.length === 0 || frame < 0 || frame >= frames.length) {
            return null;
          }
          const entry = frames[frame];
          if (!entry) return null;
          return this.getImageSource(entry.imageId);
        }

        // Overlay image-sequence: cycle through imported images
        const imageIds = layer.source.imageIds;
        const imageIndex = frame % imageIds.length;
        const imageId = imageIds[imageIndex];
        return this.getImageSource(imageId);
      }

      case 'video': {
        return this.resolveVideoSource(layer, frame, fps);
      }

      default:
        return null;
    }
  }

  /** Check if an image is already cached (for debug logging) */
  isImageCached(imageId: string | undefined): boolean {
    if (!imageId) return false;
    return this.imageCache.has(imageId);
  }

  /**
   * Pre-load images into cache so they're available immediately during playback.
   * Call with all unique imageIds from the active sequence frames.
   */
  preloadImages(imageIds: string[]): void {
    for (const imageId of imageIds) {
      // Skip if already cached or loading
      if (this.imageCache.has(imageId) || this.loadingImages.has(imageId)) continue;
      this.getImageSource(imageId); // triggers async load
    }
  }

  /**
   * Get or load an image by imageId from imageStore.
   * Returns HTMLImageElement if cached, null if loading.
   *
   * Uses efxasset:// custom protocol with no-cache headers set in Rust.
   * Each imageId produces a unique URL via cache-busting key.
   */
  private getImageSource(imageId: string): HTMLImageElement | null {
    // Check cache first
    const cached = this.imageCache.get(imageId);
    if (cached) return cached;

    // Already loading — return null (will render on next call after load)
    if (this.loadingImages.has(imageId)) return null;

    // Start async load
    const image = imageStore.getById(imageId);
    if (!image) {
      return null;
    }

    this.loadingImages.add(imageId);

    const img = new Image();
    img.onload = () => {
      this.loadingImages.delete(imageId);
      this.imageCache.set(imageId, img);
      this.onImageLoaded?.();
    };
    img.onerror = () => {
      this.loadingImages.delete(imageId);
    };
    img.src = assetUrl(image.project_path, imageId);

    return null;
  }

  /**
   * Get or create a hidden video element for a video layer, seek to correct frame.
   */
  private resolveVideoSource(
    layer: Layer,
    frame: number,
    fps: number,
  ): HTMLVideoElement | null {
    if (layer.source.type !== 'video') return null;

    let video = this.videoElements.get(layer.id);
    if (!video) {
      video = document.createElement('video');
      video.preload = 'auto';
      video.muted = true; // avoid autoplay restrictions
      video.playsInline = true;
      video.src = assetUrl(layer.source.videoPath);
      this.videoElements.set(layer.id, video);

      // Trigger re-render when video has enough data to display
      const readyHandler = () => { this.onImageLoaded?.(); };
      video.addEventListener('loadeddata', readyHandler);
      // Trigger re-render after seeking to a new frame (for scrubbing while paused)
      video.addEventListener('seeked', readyHandler);
      this.videoReadyHandlers.set(layer.id, readyHandler);
    }

    // Sync time to current frame
    const targetTime = frame / fps;
    if (Math.abs(video.currentTime - targetTime) > 0.01) {
      video.currentTime = targetTime;
    }

    // Only draw if video has enough data
    if (video.readyState < 2) return null;

    return video;
  }

  /**
   * Draw a single layer with its blend mode, opacity, transform, and crop.
   */
  private drawLayer(
    source: CanvasImageSource,
    layer: Layer,
    canvasW: number,
    canvasH: number,
  ): void {
    const ctx = this.ctx;

    // WebKit/Safari hardware-accelerated video elements ignore
    // globalCompositeOperation when drawn directly via drawImage.
    // Rasterize to an offscreen canvas first so the frame participates
    // in normal Canvas 2D compositing.
    let drawSource: CanvasImageSource = source;
    if (source instanceof HTMLVideoElement && layer.blendMode !== 'normal') {
      const vw = source.videoWidth;
      const vh = source.videoHeight;
      if (vw > 0 && vh > 0) {
        if (!this.offscreenCanvas) {
          this.offscreenCanvas = document.createElement('canvas');
        }
        if (this.offscreenCanvas.width !== vw) this.offscreenCanvas.width = vw;
        if (this.offscreenCanvas.height !== vh) this.offscreenCanvas.height = vh;
        const offCtx = this.offscreenCanvas.getContext('2d');
        if (offCtx) {
          offCtx.clearRect(0, 0, vw, vh);
          offCtx.drawImage(source, 0, 0);
          drawSource = this.offscreenCanvas;
        }
      }
    }

    ctx.save();

    // Set blend mode BEFORE drawing
    ctx.globalCompositeOperation = blendModeToCompositeOp(layer.blendMode);
    ctx.globalAlpha = layer.opacity;

    // Apply transform: translate to center + offset, rotate, scale
    ctx.translate(
      layer.transform.x + canvasW / 2,
      layer.transform.y + canvasH / 2,
    );
    ctx.rotate((layer.transform.rotation * Math.PI) / 180);
    ctx.scale(layer.transform.scale, layer.transform.scale);

    // Get source dimensions (use original source for video to get videoWidth/Height)
    const srcW = this.getSourceWidth(source);
    const srcH = this.getSourceHeight(source);

    if (srcW === 0 || srcH === 0) {
      ctx.restore();
      return;
    }

    // Calculate draw dimensions to fit canvas while maintaining aspect ratio
    const aspect = srcW / srcH;
    const canvasAspect = canvasW / canvasH;
    let drawW: number;
    let drawH: number;
    if (aspect > canvasAspect) {
      // Source is wider — fit to canvas width
      drawW = canvasW;
      drawH = canvasW / aspect;
    } else {
      // Source is taller — fit to canvas height
      drawH = canvasH;
      drawW = canvasH * aspect;
    }

    const {cropTop, cropRight, cropBottom, cropLeft} = layer.transform;
    const hasCrop =
      cropTop !== 0 || cropRight !== 0 || cropBottom !== 0 || cropLeft !== 0;

    if (hasCrop) {
      // 9-arg drawImage with source crop
      const sx = cropLeft * srcW;
      const sy = cropTop * srcH;
      const sw = srcW * (1 - cropLeft - cropRight);
      const sh = srcH * (1 - cropTop - cropBottom);

      // Recalculate draw dimensions for cropped aspect ratio
      if (sw > 0 && sh > 0) {
        const croppedAspect = sw / sh;
        if (croppedAspect > canvasAspect) {
          drawW = canvasW;
          drawH = canvasW / croppedAspect;
        } else {
          drawH = canvasH;
          drawW = canvasH * croppedAspect;
        }
        ctx.drawImage(
          drawSource,
          sx,
          sy,
          sw,
          sh,
          -drawW / 2,
          -drawH / 2,
          drawW,
          drawH,
        );
      }
    } else {
      // No crop — use 5-arg drawImage for performance
      ctx.drawImage(drawSource, -drawW / 2, -drawH / 2, drawW, drawH);
    }

    ctx.restore();
  }

  /**
   * Get the natural width of a CanvasImageSource.
   */
  private getSourceWidth(source: CanvasImageSource): number {
    if (source instanceof HTMLImageElement) return source.naturalWidth;
    if (source instanceof HTMLVideoElement) return source.videoWidth;
    if (source instanceof HTMLCanvasElement) return source.width;
    if (source instanceof ImageBitmap) return source.width;
    return 0;
  }

  /**
   * Get the natural height of a CanvasImageSource.
   */
  private getSourceHeight(source: CanvasImageSource): number {
    if (source instanceof HTMLImageElement) return source.naturalHeight;
    if (source instanceof HTMLVideoElement) return source.videoHeight;
    if (source instanceof HTMLCanvasElement) return source.height;
    if (source instanceof ImageBitmap) return source.height;
    return 0;
  }

  /** Clean up video elements and caches */
  dispose(): void {
    // Remove event listeners and release video elements
    for (const [layerId, video] of this.videoElements.entries()) {
      const handler = this.videoReadyHandlers.get(layerId);
      if (handler) {
        video.removeEventListener('loadeddata', handler);
        video.removeEventListener('seeked', handler);
      }
      video.pause();
      video.removeAttribute('src');
      video.load(); // release resources
    }
    this.videoElements.clear();
    this.videoReadyHandlers.clear();
    this.imageCache.clear();
    this.loadingImages.clear();
    this.offscreenCanvas = null;
    this.onImageLoaded = null;
  }
}
