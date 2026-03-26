import type {Layer, BlendMode} from '../types/layer';
import {isGeneratorLayer, isAdjustmentLayer, isFxLayer} from '../types/layer';
import type {FrameEntry} from '../types/timeline';
import type {GradientData} from '../types/sequence';
import {imageStore} from '../stores/imageStore';
import {assetUrl} from './ipc';
import {drawGrain, drawParticles, drawLines, drawDots, drawVignette} from './fxGenerators';
import {applyColorGrade} from './fxColorGrade';
import type {ColorGradeParams} from './fxColorGrade';
import {applyBlur} from './fxBlur';
import {blurStore} from '../stores/blurStore';
import {renderGlslGenerator, renderGlslFxImage} from './glslRuntime';
import {getShaderById} from './shaderLibrary';
import {renderPaintFrameWithBg} from './paintRenderer';
import {paintStore} from '../stores/paintStore';
import {projectStore} from '../stores/projectStore';
import {applyMotionBlur} from './glMotionBlur';
import {motionBlurStore} from '../stores/motionBlurStore';
import {VelocityCache, isStationary} from './motionBlurEngine';
import {interpolateAt} from './keyframeEngine';

/**
 * Create a Canvas 2D gradient from GradientData.
 * Supports linear, radial, and conic gradient types with runtime fallback
 * for conic gradients on older WebKit builds.
 */
export function createCanvasGradient(
  ctx: CanvasRenderingContext2D,
  gradient: GradientData,
  width: number,
  height: number,
): CanvasGradient {
  let canvasGrad: CanvasGradient;
  if (gradient.type === 'linear') {
    const angle = (gradient.angle ?? 0) * Math.PI / 180;
    const cx = width / 2, cy = height / 2;
    const len = Math.sqrt(width * width + height * height) / 2;
    canvasGrad = ctx.createLinearGradient(
      cx - Math.sin(angle) * len, cy - Math.cos(angle) * len,
      cx + Math.sin(angle) * len, cy + Math.cos(angle) * len,
    );
  } else if (gradient.type === 'radial') {
    const gcx = (gradient.centerX ?? 0.5) * width;
    const gcy = (gradient.centerY ?? 0.5) * height;
    const radius = Math.max(width, height) / 2;
    canvasGrad = ctx.createRadialGradient(gcx, gcy, 0, gcx, gcy, radius);
  } else {
    // Conic gradient -- check for createConicGradient support (Pitfall 3)
    const gcx = (gradient.centerX ?? 0.5) * width;
    const gcy = (gradient.centerY ?? 0.5) * height;
    const startAngle = ((gradient.angle ?? 0) - 90) * Math.PI / 180;
    if (typeof ctx.createConicGradient === 'function') {
      canvasGrad = ctx.createConicGradient(startAngle, gcx, gcy);
    } else {
      // Fallback: render as linear gradient if conic not supported
      console.warn('createConicGradient not supported -- falling back to linear');
      canvasGrad = ctx.createLinearGradient(0, 0, width, height);
    }
  }
  for (const stop of gradient.stops) {
    canvasGrad.addColorStop(stop.position, stop.color);
  }
  return canvasGrad;
}

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
  private failedImages: Set<string>; // imageIds that failed to load
  private videoElements: Map<string, HTMLVideoElement>; // layerId -> video element
  private videoReadyHandlers: Map<string, () => void>; // layerId -> shared loadeddata/seeked handler
  private offscreenCanvas: HTMLCanvasElement | null = null; // reusable offscreen canvas for video rasterization
  private blurOffscreen: HTMLCanvasElement | null = null; // reusable offscreen canvas for per-layer/generator blur
  private velocityCache = new VelocityCache();

  /** Callback invoked after an image finishes loading (triggers re-render) */
  onImageLoaded: (() => void) | null = null;

  constructor(canvas: HTMLCanvasElement, sharedImageCache?: Map<string, HTMLImageElement>) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('PreviewRenderer: failed to get 2d context');
    }
    this.ctx = ctx;
    this.imageCache = sharedImageCache ?? new Map();
    this.loadingImages = new Set();
    this.failedImages = new Set();
    this.videoElements = new Map();
    this.videoReadyHandlers = new Map();
  }

  /**
   * Create a lightweight renderer targeting a different canvas but sharing
   * this renderer's image cache. Used for GL transition dual-capture rendering.
   */
  cloneForCanvas(canvas: HTMLCanvasElement): PreviewRenderer {
    return new PreviewRenderer(canvas, this.imageCache);
  }

  /**
   * Render all visible layers for the given frame number.
   * Called on every frame change and on layer property changes.
   * @param layers - layers array in bottom-to-top order (index 0 = bottom)
   * @param frame - current frame number (0-based, local to the sequence)
   * @param frames - flattened frame map for image-sequence base layer lookup
   * @param fps - frames per second from the active sequence, needed for video layer time sync
   * @param globalFrame - absolute timeline frame for paint layer lookup (paint
   *   data is stored by global frame). When omitted, falls back to `frame`.
   */
  renderFrame(
    layers: Layer[],
    frame: number,
    frames: FrameEntry[],
    fps: number,
    clearCanvas = true,
    sequenceOpacity = 1.0,
    globalFrame?: number,
  ): void {
    // Paint layers are keyed by global (absolute) timeline frame, not the
    // sequence-local frame used for content/generator layers.
    const paintLookupFrame = globalFrame ?? frame;
    // Integer frame index for frames[] array lookups — fractional frames from
    // export sub-frame accumulation must not be used as array indices.
    const frameIdx = Math.floor(frame);
    // Sync canvas internal resolution to layout size (excludes CSS transforms like zoom).
    // For offscreen canvases (clientWidth=0), use canvas.width/height directly with dpr=1.
    const layoutW = this.canvas.clientWidth || this.canvas.offsetWidth;
    const layoutH = this.canvas.clientHeight || this.canvas.offsetHeight;
    const dpr = layoutW > 0 ? (window.devicePixelRatio || 1) : 1;
    const logicalW = layoutW > 0 ? layoutW : this.canvas.width;
    const logicalH = layoutH > 0 ? layoutH : this.canvas.height;
    if (layoutW > 0 && layoutH > 0) {
      const displayW = Math.round(layoutW * dpr);
      const displayH = Math.round(layoutH * dpr);
      if (this.canvas.width !== displayW || this.canvas.height !== displayH) {
        this.canvas.width = displayW;
        this.canvas.height = displayH;
      }
    }

    let hasDrawable = false;
    if (!clearCanvas) {
      // In overlay mode, the canvas already has content from a prior pass.
      // Adjustment layers modify existing pixels — any visible layer is drawable.
      hasDrawable = layers.some(l => l.visible);
    } else {
      for (const layer of layers) {
        if (!layer.visible) continue;

        if (isGeneratorLayer(layer)) {
          hasDrawable = true;
          break;
        } else if (layer.type === 'paint') {
          hasDrawable = true;  // Paint layer always has solid bg
          break;
          continue;
        } else if (isAdjustmentLayer(layer)) {
          // Adjustments only matter if there's content below; continue checking
          continue;
        } else {
          // Content layer: check if current frame is a gradient/solid/transparent entry
          if (frames.length > 0 && frameIdx >= 0 && frameIdx < frames.length) {
            const entry = frames[frameIdx];
            if (entry && (entry.gradient || entry.solidColor || entry.isTransparent)) {
              hasDrawable = true;
              break;
            }
          }
          const source = this.resolveLayerSource(layer, frame, frames, fps);
          if (source !== null || layer.source.type === 'video') {
            hasDrawable = true;
            break;
          }
        }
      }
    }

    if (!hasDrawable) {
      return; // Keep previous frame
    }

    const ctx = this.ctx;

    // Clear canvas only when we have something to draw (skip for FX overlay passes)
    if (clearCanvas) {
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // Apply DPI scaling — all drawing uses logical pixels (rect.width x rect.height)
    ctx.save();
    ctx.scale(dpr, dpr);

    // Single-pass draw loop: handle content, generator, and adjustment layers in order
    for (const layer of layers) {
      if (!layer.visible) continue;

      // Effective opacity: layer opacity * sequence-level fade opacity
      const effectiveOpacity = layer.opacity * sequenceOpacity;

      if (isGeneratorLayer(layer)) {
        const blurRadius = layer.blur ?? 0;
        if (blurRadius > 0 && !blurStore.isBypassed()) {
          // Generator with blur: render to offscreen, blur RGB-only, composite
          const off = this.getBlurOffscreen(Math.round(logicalW), Math.round(logicalH));
          if (off) {
            off.ctx.clearRect(0, 0, off.canvas.width, off.canvas.height);
            off.ctx.save();
            // Draw generator onto offscreen at logical dimensions
            switch (layer.source.type) {
              case 'generator-grain':
                drawGrain(off.ctx, logicalW, logicalH, layer.source, frame);
                break;
              case 'generator-particles':
                drawParticles(off.ctx, logicalW, logicalH, layer.source, frame);
                break;
              case 'generator-lines':
                drawLines(off.ctx, logicalW, logicalH, layer.source, frame);
                break;
              case 'generator-dots':
                drawDots(off.ctx, logicalW, logicalH, layer.source, frame);
                break;
              case 'generator-vignette':
                drawVignette(off.ctx, logicalW, logicalH, layer.source);
                break;
              case 'generator-glsl': {
                const gs = layer.source as { shaderId: string; params: Record<string, number> };
                const sd = getShaderById(gs.shaderId);
                if (sd) {
                  const t = performance.now() / 1000;
                  const glc = renderGlslGenerator(sd, Math.round(logicalW), Math.round(logicalH), gs.params, t, frame);
                  if (glc) off.ctx.drawImage(glc, 0, 0, logicalW, logicalH);
                }
                break;
              }
            }
            off.ctx.restore();
            // Apply RGB-only blur (preserveAlpha=true to avoid alpha halos)
            this.applyBlurToCanvas(off.canvas, off.ctx, blurRadius, off.canvas.width, off.canvas.height, true);
            // Composite blurred offscreen onto main canvas
            ctx.save();
            ctx.globalCompositeOperation = blendModeToCompositeOp(layer.blendMode);
            ctx.globalAlpha = effectiveOpacity;
            ctx.drawImage(off.canvas, 0, 0, logicalW, logicalH);
            ctx.restore();
          }
        } else {
          this.drawGeneratorLayer(layer, logicalW, logicalH, frame, sequenceOpacity);
        }
      } else if (isAdjustmentLayer(layer)) {
        this.drawAdjustmentLayer(layer, logicalW, logicalH, sequenceOpacity);
      } else if (layer.type === 'paint') {
        // Always render paint layer (solid bg even when no strokes)
        const paintFrame = paintStore.getFrame(layer.id, paintLookupFrame);
        const projW = projectStore.width.peek();
        const projH = projectStore.height.peek();
        const off = document.createElement('canvas');
        off.width = projW;
        off.height = projH;
        const offCtx = off.getContext('2d')!;
        if (paintFrame) {
          renderPaintFrameWithBg(offCtx, paintFrame, projW, projH, layer.id, paintLookupFrame);
        } else {
          // No paint data — just solid background
          const bgColor = paintStore.paintBgColor.peek();
          offCtx.fillStyle = bgColor;
          offCtx.fillRect(0, 0, projW, projH);
        }
        ctx.save();
        ctx.globalCompositeOperation = blendModeToCompositeOp(
          paintStore.paintMode.peek() ? 'normal' : layer.blendMode  // Task 12: normal blend in edit mode
        );
        ctx.globalAlpha = effectiveOpacity;
        ctx.drawImage(off, 0, 0, logicalW, logicalH);
        ctx.restore();

        // Sequence overlay: render sequence frame ON TOP of paint at reduced opacity
        if (paintStore.showSequenceOverlay.peek() && frames.length > 0 && frameIdx >= 0 && frameIdx < frames.length) {
          const overlayAlpha = paintStore.sequenceOverlayOpacity.peek();
          const entry = frames[frameIdx];
          if (entry?.imageId) {
            const img = this.imageCache.get(entry.imageId);
            if (img) {
              ctx.save();
              ctx.globalAlpha = overlayAlpha;
              ctx.drawImage(img, 0, 0, logicalW, logicalH);
              ctx.restore();
            }
          }
        }
      } else {
        // Content layer: check for gradient/solid/transparent frame first (per D-12, D-18, D-19)
        let handledAsSolid = false;
        if (layer.isBase && frames.length > 0 && frameIdx >= 0 && frameIdx < frames.length) {
          const entry = frames[frameIdx];
          if (entry?.gradient && !entry?.isTransparent) {
            // D-12: Gradient fill (check before solidColor)
            ctx.save();
            ctx.globalCompositeOperation = blendModeToCompositeOp(layer.blendMode);
            ctx.globalAlpha = effectiveOpacity;
            ctx.fillStyle = createCanvasGradient(ctx, entry.gradient, logicalW, logicalH);
            ctx.fillRect(0, 0, logicalW, logicalH);
            ctx.restore();
            handledAsSolid = true;
          } else if (entry?.solidColor && !entry?.isTransparent) {
            // Key solid: fill canvas with solid color
            ctx.save();
            ctx.globalCompositeOperation = blendModeToCompositeOp(layer.blendMode);
            ctx.globalAlpha = effectiveOpacity;
            ctx.fillStyle = entry.solidColor;
            ctx.fillRect(0, 0, logicalW, logicalH);
            ctx.restore();
            handledAsSolid = true;
          } else if (entry?.isTransparent) {
            // Key transparent: do nothing — clearRect already cleared canvas,
            // app background (black) shows through per D-19
            handledAsSolid = true;
          }
        }

        if (!handledAsSolid) {
        // Original content layer rendering (resolve image source)
        const source = this.resolveLayerSource(layer, frame, frames, fps);
        if (source !== null) {
          const blurRadius = layer.blur ?? 0;

          // --- Motion blur velocity computation (per D-12, D-13) ---
          // Only content layers with keyframe animation can have motion blur.
          // Skip FX, generator, adjustment, and paint layers.
          // Content layers in this else-branch are already not generator/adjustment/paint
          // (those are handled by earlier if/else-if blocks), so we only check for FX layers.
          const wantMotionBlur = motionBlurStore.isEnabled()
            && motionBlurStore.getSamples() > 0
            && layer.keyframes && layer.keyframes.length > 0
            && !isFxLayer(layer);

          let motionVelocity: {dx: number; dy: number} | null = null;
          if (wantMotionBlur) {
            const kfValues = interpolateAt(layer.keyframes!, frame);
            if (kfValues) {
              const vel = this.velocityCache.computeForLayer(layer.id, kfValues, globalFrame ?? frame);
              if (vel && !isStationary(vel)) {
                motionVelocity = { dx: vel.dx, dy: vel.dy };
              }
            }
          }

          if (blurRadius > 0 && !blurStore.isBypassed()) {
            // Content layer with gaussian blur (+ optional motion blur)
            const off = this.getBlurOffscreen(Math.round(logicalW), Math.round(logicalH));
            if (off) {
              off.ctx.clearRect(0, 0, off.canvas.width, off.canvas.height);
              off.ctx.save();
              // Draw content onto offscreen using same aspect-ratio fitting as drawLayer
              this.drawLayerToOffscreen(source, layer, off.ctx, logicalW, logicalH);
              off.ctx.restore();
              // Apply gaussian blur (full RGBA -- content layers have opaque pixels)
              this.applyBlurToCanvas(off.canvas, off.ctx, blurRadius, off.canvas.width, off.canvas.height, false);
              // Apply motion blur on top of gaussian if layer is moving
              if (motionVelocity) {
                applyMotionBlur(off.canvas, off.ctx, motionVelocity,
                  motionBlurStore.getStrength(), motionBlurStore.getSamples(),
                  off.canvas.width, off.canvas.height);
              }
              // Composite blurred offscreen onto main canvas
              ctx.save();
              ctx.globalCompositeOperation = blendModeToCompositeOp(layer.blendMode);
              ctx.globalAlpha = effectiveOpacity;
              ctx.drawImage(off.canvas, 0, 0, logicalW, logicalH);
              ctx.restore();
            }
          } else if (motionVelocity) {
            // Motion blur only (no gaussian blur)
            const off = this.getBlurOffscreen(Math.round(logicalW), Math.round(logicalH));
            if (off) {
              off.ctx.clearRect(0, 0, off.canvas.width, off.canvas.height);
              off.ctx.save();
              this.drawLayerToOffscreen(source, layer, off.ctx, logicalW, logicalH);
              off.ctx.restore();
              applyMotionBlur(off.canvas, off.ctx, motionVelocity,
                motionBlurStore.getStrength(), motionBlurStore.getSamples(),
                off.canvas.width, off.canvas.height);
              ctx.save();
              ctx.globalCompositeOperation = blendModeToCompositeOp(layer.blendMode);
              ctx.globalAlpha = effectiveOpacity;
              ctx.drawImage(off.canvas, 0, 0, logicalW, logicalH);
              ctx.restore();
            }
          } else {
            // Normal rendering (no blur effects)
            this.drawLayer(source, layer, logicalW, logicalH, sequenceOpacity);
          }
        } else if (layer.source.type === 'video') {
          // Draw loading placeholder for video layers not ready yet
          ctx.save();
          ctx.globalCompositeOperation = blendModeToCompositeOp(layer.blendMode);
          ctx.globalAlpha = effectiveOpacity * 0.5;
          ctx.fillStyle = '#333333';
          const pw = logicalW * 0.4;
          const ph = logicalH * 0.2;
          ctx.fillRect((logicalW - pw) / 2, (logicalH - ph) / 2, pw, ph);
          ctx.globalAlpha = effectiveOpacity;
          ctx.fillStyle = '#FFFFFF';
          ctx.font = '12px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`Loading ${layer.name}...`, logicalW / 2, logicalH / 2);
          ctx.restore();
        }
        } // end if (!handledAsSolid)
      }
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
        const fi = Math.floor(frame);
        if (layer.isBase || layer.source.imageIds.length === 0) {
          if (frames.length === 0 || fi < 0 || fi >= frames.length) {
            return null;
          }
          const entry = frames[fi];
          if (!entry) return null;
          return this.getImageSource(entry.imageId);
        }

        // Overlay image-sequence: cycle through imported images
        const imageIds = layer.source.imageIds;
        const imageIndex = fi % imageIds.length;
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

  /** Check if an image failed to load */
  isImageFailed(imageId: string): boolean {
    return this.failedImages.has(imageId);
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
  getImageSource(imageId: string): HTMLImageElement | null {
    if (!imageId) return null;
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
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      this.loadingImages.delete(imageId);
      this.imageCache.set(imageId, img);
      this.onImageLoaded?.();
    };
    img.onerror = () => {
      this.loadingImages.delete(imageId);
      this.failedImages.add(imageId);
      console.warn(`[PreviewRenderer] Failed to load image: ${imageId}`);
      this.onImageLoaded?.();
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
    const source = layer.source; // Narrow to video source type

    let video = this.videoElements.get(layer.id);
    if (!video) {
      video = document.createElement('video');
      video.preload = 'auto';
      video.muted = true; // avoid autoplay restrictions
      video.playsInline = true;
      const videoAsset = imageStore.videoAssets.peek().find(v => v.id === source.videoAssetId);
      if (!videoAsset) return null;
      video.src = assetUrl(videoAsset.path);
      this.videoElements.set(layer.id, video);

      // Trigger re-render when video has enough data to display
      const readyHandler = () => { this.onImageLoaded?.(); };
      video.addEventListener('loadeddata', readyHandler);
      // Trigger re-render after seeking to a new frame (for scrubbing while paused)
      video.addEventListener('seeked', readyHandler);
      this.videoReadyHandlers.set(layer.id, readyHandler);
    }

    // Sync time to current frame (mod by duration for seamless looping)
    const rawTargetTime = frame / fps;
    const targetTime = video.duration > 0 ? rawTargetTime % video.duration : rawTargetTime;
    if (Math.abs(video.currentTime - targetTime) > 0.01) {
      video.currentTime = targetTime;
    }

    // Only draw if video has enough data
    if (video.readyState < 2) return null;

    return video;
  }

  /**
   * Draw a generator FX layer (grain, particles, lines, dots, vignette).
   * Generator layers produce pixels procedurally — no source image needed.
   */
  private drawGeneratorLayer(
    layer: Layer,
    logicalW: number,
    logicalH: number,
    frame: number,
    sequenceOpacity = 1.0,
  ): void {
    const ctx = this.ctx;
    const effectiveOpacity = layer.opacity * sequenceOpacity;

    // Generator functions set their own globalAlpha internally (e.g., drawLines sets 0.4).
    // When sequenceOpacity < 1, render to offscreen canvas then composite with correct opacity.
    if (sequenceOpacity < 1) {
      const off = this.getBlurOffscreen(Math.round(logicalW), Math.round(logicalH));
      if (off) {
        off.ctx.clearRect(0, 0, off.canvas.width, off.canvas.height);
        off.ctx.save();
        this.drawGeneratorToCtx(off.ctx, layer, logicalW, logicalH, frame);
        off.ctx.restore();
        ctx.save();
        ctx.globalCompositeOperation = blendModeToCompositeOp(layer.blendMode);
        ctx.globalAlpha = effectiveOpacity;
        ctx.drawImage(off.canvas, 0, 0, logicalW, logicalH);
        ctx.restore();
      }
      return;
    }

    ctx.save();
    ctx.globalCompositeOperation = blendModeToCompositeOp(layer.blendMode);
    ctx.globalAlpha = effectiveOpacity;
    this.drawGeneratorToCtx(ctx, layer, logicalW, logicalH, frame);
    ctx.restore();
  }

  /** Draw generator content to a given context (shared by direct and offscreen paths) */
  private drawGeneratorToCtx(
    ctx: CanvasRenderingContext2D,
    layer: Layer,
    logicalW: number,
    logicalH: number,
    frame: number,
  ): void {
    switch (layer.source.type) {
      case 'generator-grain':
        drawGrain(ctx, logicalW, logicalH, layer.source, frame);
        break;
      case 'generator-particles':
        drawParticles(ctx, logicalW, logicalH, layer.source, frame);
        break;
      case 'generator-lines':
        drawLines(ctx, logicalW, logicalH, layer.source, frame);
        break;
      case 'generator-dots':
        drawDots(ctx, logicalW, logicalH, layer.source, frame);
        break;
      case 'generator-vignette':
        drawVignette(ctx, logicalW, logicalH, layer.source);
        break;
      case 'generator-glsl': {
        const glslSource = layer.source as { shaderId: string; params: Record<string, number> };
        const shaderDef = getShaderById(glslSource.shaderId);
        if (shaderDef) {
          const time = performance.now() / 1000;
          const glCanvas = renderGlslGenerator(shaderDef, Math.round(logicalW), Math.round(logicalH), glslSource.params, time, frame);
          if (glCanvas) {
            ctx.drawImage(glCanvas, 0, 0, logicalW, logicalH);
          }
        }
        break;
      }
    }
  }

  /**
   * Draw an adjustment FX layer that modifies existing canvas pixels.
   * Adjustment layers read the composited image below and transform it.
   */
  private drawAdjustmentLayer(
    layer: Layer,
    _logicalW: number,
    _logicalH: number,
    sequenceOpacity = 1.0,
  ): void {
    const ctx = this.ctx;

    switch (layer.source.type) {
      case 'adjustment-color-grade': {
        ctx.save();
        // Reset transform to identity so we can work in physical pixel coords for ImageData
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        // Scale color grade parameters by layer opacity for partial application
        const source = layer.source;
        const opacity = layer.opacity;
        const scaledParams: ColorGradeParams = {
          brightness: source.brightness * opacity,
          contrast: source.contrast * opacity,
          saturation: source.saturation * opacity,
          hue: source.hue * opacity,
          fade: source.fade * opacity,
          tintColor: source.tintColor,
          fadeBlend: source.fadeBlend,
        };

        applyColorGrade(ctx, this.canvas.width, this.canvas.height, scaledParams);
        ctx.restore();
        break;
      }

      case 'adjustment-blur': {
        if (blurStore.isBypassed()) break;
        const blurSource = layer.source as {type: 'adjustment-blur'; radius: number};
        if (blurSource.radius <= 0) break;

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        if (layer.blendMode === 'normal') {
          const effectiveRadius = blurSource.radius * layer.opacity;
          applyBlur(this.canvas, ctx, effectiveRadius, this.canvas.width, this.canvas.height, false);
        } else {
          // Blend mode path: blur to offscreen, composite with blend mode
          const w = this.canvas.width;
          const h = this.canvas.height;
          const off = this.getBlurOffscreen(w, h);
          if (off) {
            off.ctx.clearRect(0, 0, w, h);
            off.ctx.drawImage(this.canvas, 0, 0);
            this.applyBlurToCanvas(off.canvas, off.ctx, blurSource.radius, w, h, false);
            ctx.globalCompositeOperation = blendModeToCompositeOp(layer.blendMode);
            ctx.globalAlpha = layer.opacity;
            ctx.drawImage(off.canvas, 0, 0);
          }
        }
        ctx.restore();
        break;
      }

      case 'adjustment-glsl': {
        const glslSource = layer.source as { shaderId: string; params: Record<string, number> };
        const shaderDef = getShaderById(glslSource.shaderId);
        if (shaderDef) {
          ctx.save();
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          const pw = this.canvas.width;
          const ph = this.canvas.height;
          const time = performance.now() / 1000;
          const effectiveOpacity = layer.opacity * sequenceOpacity;
          const glCanvas = renderGlslFxImage(shaderDef, this.canvas, pw, ph, glslSource.params, time, 0);
          if (glCanvas) {
            if (effectiveOpacity >= 1) {
              // Full strength: replace canvas with shader output
              ctx.clearRect(0, 0, pw, ph);
              ctx.drawImage(glCanvas, 0, 0, pw, ph);
            } else {
              // Partial opacity/fade: mix original with shader output
              ctx.globalAlpha = effectiveOpacity;
              ctx.drawImage(glCanvas, 0, 0, pw, ph);
            }
          }
          ctx.restore();
        }
        break;
      }

      default:
        break;
    }
  }

  /**
   * Get or create the blur offscreen canvas at the given dimensions.
   */
  private getBlurOffscreen(w: number, h: number): {canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D} | null {
    if (!this.blurOffscreen) {
      this.blurOffscreen = document.createElement('canvas');
    }
    if (this.blurOffscreen.width !== w || this.blurOffscreen.height !== h) {
      this.blurOffscreen.width = w;
      this.blurOffscreen.height = h;
    }
    const ctx = this.blurOffscreen.getContext('2d');
    if (!ctx) return null;
    return {canvas: this.blurOffscreen, ctx};
  }

  /**
   * Apply blur to a canvas via unified GPU-first API.
   * Respects blurStore bypass toggle.
   */
  private applyBlurToCanvas(
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    radius: number,
    w: number,
    h: number,
    preserveAlpha: boolean,
  ): void {
    if (blurStore.isBypassed() || radius <= 0) return;
    applyBlur(canvas, ctx, radius, w, h, preserveAlpha);
  }

  /**
   * Draw a content layer onto an offscreen canvas context for blur processing.
   * Same aspect-ratio fitting and transform logic as drawLayer, but without
   * blend mode or opacity (those are applied when compositing the blurred result).
   */
  private drawLayerToOffscreen(
    source: CanvasImageSource,
    layer: Layer,
    offCtx: CanvasRenderingContext2D,
    canvasW: number,
    canvasH: number,
  ): void {
    // Rasterize video if needed (same as drawLayer)
    let drawSource: CanvasImageSource = source;
    if (source instanceof HTMLVideoElement) {
      const vw = source.videoWidth;
      const vh = source.videoHeight;
      if (vw > 0 && vh > 0) {
        if (!this.offscreenCanvas) {
          this.offscreenCanvas = document.createElement('canvas');
        }
        if (this.offscreenCanvas.width !== vw) this.offscreenCanvas.width = vw;
        if (this.offscreenCanvas.height !== vh) this.offscreenCanvas.height = vh;
        const vidCtx = this.offscreenCanvas.getContext('2d');
        if (vidCtx) {
          vidCtx.clearRect(0, 0, vw, vh);
          vidCtx.drawImage(source, 0, 0);
          drawSource = this.offscreenCanvas;
        }
      }
    }

    const srcW = this.getSourceWidth(source);
    const srcH = this.getSourceHeight(source);
    if (srcW === 0 || srcH === 0) return;

    // Apply transform: translate to center + offset, rotate, scale
    offCtx.translate(
      layer.transform.x + canvasW / 2,
      layer.transform.y + canvasH / 2,
    );
    offCtx.rotate((layer.transform.rotation * Math.PI) / 180);
    offCtx.scale(layer.transform.scaleX, layer.transform.scaleY);

    // Calculate draw dimensions to fit canvas while maintaining aspect ratio
    const aspect = srcW / srcH;
    const canvasAspect = canvasW / canvasH;
    let drawW: number;
    let drawH: number;
    if (aspect > canvasAspect) {
      drawW = canvasW;
      drawH = canvasW / aspect;
    } else {
      drawH = canvasH;
      drawW = canvasH * aspect;
    }

    const {cropTop, cropRight, cropBottom, cropLeft} = layer.transform;
    const hasCrop =
      cropTop !== 0 || cropRight !== 0 || cropBottom !== 0 || cropLeft !== 0;

    if (hasCrop) {
      const sx = cropLeft * srcW;
      const sy = cropTop * srcH;
      const sw = srcW * (1 - cropLeft - cropRight);
      const sh = srcH * (1 - cropTop - cropBottom);
      if (sw > 0 && sh > 0) {
        const croppedAspect = sw / sh;
        if (croppedAspect > canvasAspect) {
          drawW = canvasW;
          drawH = canvasW / croppedAspect;
        } else {
          drawH = canvasH;
          drawW = canvasH * croppedAspect;
        }
        offCtx.drawImage(drawSource, sx, sy, sw, sh, -drawW / 2, -drawH / 2, drawW, drawH);
      }
    } else {
      offCtx.drawImage(drawSource, -drawW / 2, -drawH / 2, drawW, drawH);
    }
  }

  /**
   * Draw a single layer with its blend mode, opacity, transform, and crop.
   */
  private drawLayer(
    source: CanvasImageSource,
    layer: Layer,
    canvasW: number,
    canvasH: number,
    sequenceOpacity = 1.0,
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
    ctx.globalAlpha = layer.opacity * sequenceOpacity;

    // Apply transform: translate to center + offset, rotate, scale
    ctx.translate(
      layer.transform.x + canvasW / 2,
      layer.transform.y + canvasH / 2,
    );
    ctx.rotate((layer.transform.rotation * Math.PI) / 180);
    ctx.scale(layer.transform.scaleX, layer.transform.scaleY);

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
    this.failedImages.clear();
    this.offscreenCanvas = null;
    this.blurOffscreen = null;
    this.onImageLoaded = null;
  }
}
