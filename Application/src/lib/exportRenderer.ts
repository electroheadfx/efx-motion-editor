import {PreviewRenderer} from './previewRenderer';
import {interpolateAt} from './keyframeEngine';
import {computeFadeOpacity, computeSolidFadeAlpha, computeCrossDissolveOpacity, computeTransitionProgress} from './transitionEngine';
import {renderGlslTransition} from './glslRuntime';
import {getShaderById} from './shaderLibrary';
import {motionBlurStore} from '../stores/motionBlurStore';
import {isFxLayer} from '../types/layer';
import type {LayerSourceData} from '../types/layer';
import type {FrameEntry} from '../types/timeline';
import type {Sequence} from '../types/sequence';
import type {CrossDissolveOverlap} from './frameMap';

/**
 * Build a synthetic FrameEntry array for a given sequence.
 * Used by cross dissolve dual-render for image lookup.
 */
function buildSequenceFrames(seq: Sequence): FrameEntry[] {
  const frames: FrameEntry[] = [];
  let lf = 0;
  for (const kp of seq.keyPhotos) {
    for (let f = 0; f < kp.holdFrames; f++) {
      frames.push({
        globalFrame: lf,
        sequenceId: seq.id,
        keyPhotoId: kp.id,
        imageId: kp.imageId,
        localFrame: f,
        ...(kp.solidColor ? { solidColor: kp.solidColor } : {}),
        ...(kp.isTransparent ? { isTransparent: true } : {}),
        ...(kp.gradient ? { gradient: kp.gradient } : {}),
      });
      lf++;
    }
  }
  return frames;
}

/**
 * Apply keyframe interpolation to content layers for a given local frame.
 * Returns new layer array with interpolated property values.
 */
function interpolateLayers(seq: Sequence, localFrame: number) {
  return seq.layers.map(layer => {
    if (!layer.keyframes || layer.keyframes.length === 0) return layer;
    if (isFxLayer(layer) || layer.isBase) return layer;
    const values = interpolateAt(layer.keyframes, localFrame);
    if (!values) return layer;
    return {
      ...layer,
      opacity: values.opacity,
      transform: {
        ...layer.transform,
        x: values.x,
        y: values.y,
        scaleX: values.scaleX,
        scaleY: values.scaleY,
        rotation: values.rotation,
      },
      blur: values.blur,
    };
  });
}

// ---- GL Transition offscreen canvases ----

let _transitionOffA: HTMLCanvasElement | null = null;
let _transitionOffB: HTMLCanvasElement | null = null;

function _getOrCreateTransitionOffscreen(w: number, h: number, label: 'A' | 'B'): HTMLCanvasElement {
  const ref = label === 'A' ? _transitionOffA : _transitionOffB;
  if (ref && ref.width === w && ref.height === h) return ref;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  if (label === 'A') _transitionOffA = c;
  else _transitionOffB = c;
  return c;
}

/**
 * Render a single global frame with full compositing.
 * Pure function: caller passes all data, no signal reads.
 * Used by both Preview.tsx (live preview) and exportEngine.ts (file export).
 *
 * Paint layers: type 'paint' passes through to PreviewRenderer.renderFrame()
 * which handles paint rendering via paintStore.getFrame() + renderPaintFrame().
 * Verified: interpolateLayers does not filter paint layers (they are not
 * isContentLayer, isGeneratorLayer, or isAdjustmentLayer — they pass through as-is).
 * Paint data must be loaded into paintStore before export starts.
 */
export function renderGlobalFrame(
  renderer: PreviewRenderer,
  canvas: HTMLCanvasElement,
  globalFrame: number,
  fm: FrameEntry[],
  allSeqs: Sequence[],
  overlaps: CrossDissolveOverlap[],
  soloActive: boolean = false,
): void {
  // Support fractional globalFrame for sub-frame motion blur accumulation
  const frameIndex = Math.floor(globalFrame);
  const fractionalOffset = globalFrame - frameIndex;

  if (frameIndex < 0 || frameIndex >= fm.length) return;

  const entry = fm[frameIndex];
  if (!entry) return;

  const seq = allSeqs.find((s) => s.id === entry.sequenceId);
  if (!seq || seq.kind === 'fx') return;

  // Compute sequence start frame and local frame from frameMap
  let seqStart = frameIndex;
  while (seqStart > 0 && fm[seqStart - 1]?.sequenceId === entry.sequenceId) seqStart--;
  const seqFrames = fm.filter((e) => e.sequenceId === entry.sequenceId);
  const localFrame = frameIndex - seqStart + fractionalOffset;

  // === Cross dissolve check (BEFORE normal render) ===
  let handledByCrossDissolve = false;

  for (const overlap of overlaps) {
    if (globalFrame >= overlap.overlapStart && globalFrame < overlap.overlapEnd) {
      handledByCrossDissolve = true;

      // === GL Transition path (per D-05, D-08) ===
      if (overlap.glTransition) {
        const shaderDef = getShaderById(overlap.glTransition.shaderId);
        if (shaderDef) {
          const outSeq = allSeqs.find(s => s.id === overlap.outgoingSequenceId);
          const inSeq = allSeqs.find(s => s.id === overlap.incomingSequenceId);

          if (outSeq && inSeq && outSeq.kind === 'content' && inSeq.kind === 'content') {
            const framesIntoOverlap = globalFrame - overlap.overlapStart;
            const w = canvas.width;
            const h = canvas.height;

            // Create/reuse two offscreen canvases for dual-capture
            const offA = _getOrCreateTransitionOffscreen(w, h, 'A');
            const offB = _getOrCreateTransitionOffscreen(w, h, 'B');

            // Render outgoing sequence to offscreen A (share image cache with main renderer)
            const outLocalFrame = overlap.outgoingLocalFrameStart + framesIntoOverlap;
            const outFrames = buildSequenceFrames(outSeq);
            const outLayers = interpolateLayers(outSeq, outLocalFrame);
            const rendererA = renderer.cloneForCanvas(offA);
            rendererA.renderFrame(outLayers, outLocalFrame, outFrames, outSeq.fps, true, 1.0, globalFrame);

            // Render incoming sequence to offscreen B (share image cache with main renderer)
            const inLocalFrame = overlap.incomingLocalFrameStart + framesIntoOverlap;
            const inFrames = buildSequenceFrames(inSeq);
            const inLayers = interpolateLayers(inSeq, inLocalFrame);
            const rendererB = renderer.cloneForCanvas(offB);
            rendererB.renderFrame(inLayers, inLocalFrame, inFrames, inSeq.fps, true, 1.0, globalFrame);

            // Compute eased progress (per D-07)
            const progress = computeTransitionProgress(
              globalFrame, overlap.overlapStart, overlap.duration, overlap.glTransition.curve
            );

            // Run GL transition shader
            const glResult = renderGlslTransition(
              shaderDef, offA, offB,
              progress, w / h,
              overlap.glTransition.params, w, h
            );

            // Composite onto main canvas
            if (glResult) {
              const ctx = canvas.getContext('2d')!;
              ctx.save();
              ctx.setTransform(1, 0, 0, 1, 0, 0);
              ctx.clearRect(0, 0, w, h);
              ctx.drawImage(glResult, 0, 0, w, h);
              ctx.restore();
            }
          }

          break;
        }
      }

      // === Existing cross-dissolve opacity path (unchanged) ===
      const [outOpacity, inOpacity] = computeCrossDissolveOpacity(
        globalFrame, overlap.overlapStart, overlap.duration, overlap.curve
      );

      // --- Render outgoing sequence ---
      const outSeq = allSeqs.find(s => s.id === overlap.outgoingSequenceId);
      if (outSeq && outSeq.kind === 'content') {
        const framesIntoOverlap = globalFrame - overlap.overlapStart;
        const outLocalFrame = overlap.outgoingLocalFrameStart + framesIntoOverlap;
        const outFrames = buildSequenceFrames(outSeq);

        const outLayers = interpolateLayers(outSeq, outLocalFrame);

        // Also apply fade-out opacity if the outgoing sequence has a fadeOut transition
        let effectiveOutOpacity = outOpacity;
        if (outSeq.fadeOut) {
          const outSeqTotalFrames = outSeq.keyPhotos.reduce((sum, kp) => sum + kp.holdFrames, 0);
          const fadeOpacity = computeFadeOpacity(outLocalFrame, outSeqTotalFrames, undefined, outSeq.fadeOut);
          effectiveOutOpacity *= fadeOpacity;
        }
        renderer.renderFrame(outLayers, outLocalFrame, outFrames, outSeq.fps, true, effectiveOutOpacity, globalFrame);
      }

      // --- Render incoming sequence ON TOP ---
      const inSeq = allSeqs.find(s => s.id === overlap.incomingSequenceId);
      if (inSeq && inSeq.kind === 'content') {
        const framesIntoOverlap = globalFrame - overlap.overlapStart;
        const inLocalFrame = overlap.incomingLocalFrameStart + framesIntoOverlap;
        const inFrames = buildSequenceFrames(inSeq);

        const inLayers = interpolateLayers(inSeq, inLocalFrame);

        // Also apply fade-in opacity if the incoming sequence has a fadeIn transition
        let effectiveInOpacity = inOpacity;
        if (inSeq.fadeIn) {
          const inSeqTotalFrames = inSeq.keyPhotos.reduce((sum, kp) => sum + kp.holdFrames, 0);
          const fadeOpacity = computeFadeOpacity(inLocalFrame, inSeqTotalFrames, inSeq.fadeIn, undefined);
          effectiveInOpacity *= fadeOpacity;
        }
        // clearCanvas=false so incoming composites ON TOP of outgoing
        renderer.renderFrame(inLayers, inLocalFrame, inFrames, inSeq.fps, false, effectiveInOpacity, globalFrame);
      }

      break; // Only one cross dissolve can be active at a time
    }
  }

  // === Normal content render (only if NOT in a cross dissolve zone) ===
  if (!handledByCrossDissolve) {
    // Apply keyframe interpolation to content layers before rendering
    const interpolatedLayers = interpolateLayers(seq, localFrame);

    // Compute fade opacity for this frame
    const totalSeqFrames = seqFrames.length;
    const fadeOpacity = computeFadeOpacity(localFrame, totalSeqFrames, seq.fadeIn, seq.fadeOut);

    // Determine which fade is active to check mode/color
    const activeFadeIn = seq.fadeIn && localFrame < seq.fadeIn.duration ? seq.fadeIn : undefined;
    const activeFadeOut = seq.fadeOut && localFrame >= totalSeqFrames - seq.fadeOut.duration ? seq.fadeOut : undefined;
    const activeFade = activeFadeIn || activeFadeOut;
    const isSolidMode = activeFade?.mode === 'solid';

    if (isSolidMode) {
      // Solid mode: render content at full opacity, then overlay solid color
      renderer.renderFrame(interpolatedLayers, localFrame, seqFrames, seq.fps, true, 1.0, globalFrame);
      const solidAlpha = computeSolidFadeAlpha(localFrame, totalSeqFrames, seq.fadeIn, seq.fadeOut);
      if (solidAlpha > 0) {
        const color = activeFade?.color ?? '#000000';
        const solidCtx = canvas.getContext('2d')!;
        solidCtx.save();
        solidCtx.setTransform(1, 0, 0, 1, 0, 0);  // physical pixel coords (per Pitfall 5)
        solidCtx.globalAlpha = solidAlpha;
        solidCtx.fillStyle = color;
        solidCtx.fillRect(0, 0, canvas.width, canvas.height);
        solidCtx.restore();
      }
    } else {
      // Transparency mode: render content with reduced opacity via sequenceOpacity
      renderer.renderFrame(interpolatedLayers, localFrame, seqFrames, seq.fps, true, fadeOpacity, globalFrame);
    }
  }

  // Composite overlay sequences (FX + content overlays): skip entirely in solo mode (D-08)
  if (!soloActive) {
  const overlaySeqs = allSeqs.filter(s => s.kind !== 'content' && s.visible !== false);
  for (let i = overlaySeqs.length - 1; i >= 0; i--) {
    const overlaySeq = overlaySeqs[i];
    if (overlaySeq.inFrame != null && globalFrame < overlaySeq.inFrame) continue;
    if (overlaySeq.outFrame != null && globalFrame >= overlaySeq.outFrame) continue;

    if (overlaySeq.kind === 'content-overlay') {
      // Content overlay: compute local frame relative to inFrame, apply keyframe interpolation
      const overlayLocalFrame = globalFrame - (overlaySeq.inFrame ?? 0);
      const overlayLayers = overlaySeq.layers.filter(l => l.visible).map(layer => {
        if (!layer.keyframes || layer.keyframes.length === 0) return layer;
        const values = interpolateAt(layer.keyframes, overlayLocalFrame);
        if (!values) return layer;
        return {
          ...layer,
          opacity: values.opacity,
          transform: {
            ...layer.transform,
            x: values.x,
            y: values.y,
            scaleX: values.scaleX,
            scaleY: values.scaleY,
            rotation: values.rotation,
          },
          blur: values.blur,
        };
      });
      if (overlayLayers.length > 0) {
        // Apply fade opacity to content-overlay sequence (transparency mode only)
        const overlayTotalFrames = (overlaySeq.outFrame ?? 100) - (overlaySeq.inFrame ?? 0);
        const overlayFadeOpacity = computeFadeOpacity(overlayLocalFrame, overlayTotalFrames, overlaySeq.fadeIn, overlaySeq.fadeOut);
        renderer.renderFrame(overlayLayers, overlayLocalFrame, seqFrames, seq.fps, false, overlayFadeOpacity, globalFrame);
      }
    } else {
      // FX sequence: apply keyframe interpolation to FX layers
      const fxLocalFrame = globalFrame - (overlaySeq.inFrame ?? 0);
      const fxTotalFrames = (overlaySeq.outFrame ?? 100) - (overlaySeq.inFrame ?? 0);
      const fxLayers = overlaySeq.layers.filter((l) => l.visible).map(layer => {
        if (!layer.keyframes || layer.keyframes.length === 0) return layer;
        const values = interpolateAt(layer.keyframes, fxLocalFrame);
        if (!values) return layer;
        let newSource = layer.source;
        if (values.sourceOverrides) {
          if ('params' in layer.source) {
            // GLSL layers: merge overrides into params sub-object
            newSource = { ...layer.source, params: { ...(layer.source as { params: Record<string, number> }).params, ...values.sourceOverrides } } as LayerSourceData;
          } else {
            newSource = { ...layer.source, ...values.sourceOverrides } as LayerSourceData;
          }
        }
        const interpolatedLayer = { ...layer, source: newSource, opacity: values.opacity, blur: values.blur };
        return interpolatedLayer;
      });
      if (fxLayers.length > 0) {
        // Apply fade opacity to FX sequence (transparency mode only)
        const fxFadeOpacity = computeFadeOpacity(fxLocalFrame, fxTotalFrames, overlaySeq.fadeIn, overlaySeq.fadeOut);
        renderer.renderFrame(fxLayers, localFrame, seqFrames, seq.fps, false, fxFadeOpacity, globalFrame);
      }
    }
  }
  } // end if (!soloActive)
}

/**
 * Render a single frame with motion blur using combined GLSL velocity blur + sub-frame accumulation.
 * Per D-10/D-14: renders N sub-frames at fractional positions, applies GLSL velocity blur per sub-frame,
 * then blends via additive compositing with globalAlpha = 1/N.
 *
 * The shutterAngle param temporarily overrides motionBlurStore.shutterAngle during the sub-frame
 * loop so that motionBlurStore.getStrength() (which PreviewRenderer reads inside renderGlobalFrame)
 * returns the export-specific value rather than the preview value. Per D-11.
 */
export function renderFrameWithMotionBlur(
  renderer: PreviewRenderer,
  canvas: HTMLCanvasElement,
  globalFrame: number,
  fm: FrameEntry[],
  allSeqs: Sequence[],
  overlaps: CrossDissolveOverlap[],
  subFrames: number,
  shutterAngle: number,
  soloActive: boolean = false,
): void {
  const w = canvas.width;
  const h = canvas.height;

  // --- Route export shutter angle override through motionBlurStore (per D-11) ---
  // PreviewRenderer's motion blur pass reads motionBlurStore.getStrength() which
  // derives from motionBlurStore.shutterAngle.peek(). We temporarily set the
  // store's shutterAngle to the export override so the GLSL uStrength uniform
  // receives the correct value during sub-frame rendering.
  const savedShutterAngle = motionBlurStore.shutterAngle.peek();
  motionBlurStore.shutterAngle.value = shutterAngle;

  try {
    // Create accumulator canvas (per Pitfall 3: clear before loop)
    const accumulator = document.createElement('canvas');
    accumulator.width = w;
    accumulator.height = h;
    const accumCtx = accumulator.getContext('2d')!;
    accumCtx.clearRect(0, 0, w, h);

    // Set globalAlpha for equal-weight blending
    accumCtx.globalAlpha = 1.0 / subFrames;

    for (let i = 0; i < subFrames; i++) {
      const t = i / subFrames;
      const subFrame = globalFrame + t;

      // renderGlobalFrame uses interpolateAt() which supports fractional frames (per D-15)
      // Motion blur is applied per-layer inside PreviewRenderer (the renderer has velocityCache)
      renderGlobalFrame(renderer, canvas, subFrame, fm, allSeqs, overlaps, soloActive);

      // Accumulate sub-frame
      accumCtx.drawImage(canvas, 0, 0);
    }

    // Copy accumulator result back to output canvas
    const outCtx = canvas.getContext('2d')!;
    outCtx.clearRect(0, 0, w, h);
    outCtx.globalAlpha = 1.0;
    outCtx.drawImage(accumulator, 0, 0);
  } finally {
    // Restore preview shutter angle regardless of success/failure
    motionBlurStore.shutterAngle.value = savedShutterAngle;
  }
}

/**
 * Preload all unique images referenced in the frame map.
 * Returns a promise that resolves when all images are cached or failed in the renderer.
 * Supports cancellation via AbortSignal and a 30-second timeout safety net.
 * Failed images are logged but do not block the export — frames referencing
 * them will render without that image (blank/missing layer).
 */
export function preloadExportImages(
  renderer: PreviewRenderer,
  fm: FrameEntry[],
  signal?: AbortSignal,
): Promise<void> {
  const imageIds = [...new Set(fm.map(f => f.imageId).filter(id => id !== ''))];
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      renderer.onImageLoaded = null;
      resolve();
    };
    const fail = (reason: string) => {
      if (settled) return;
      settled = true;
      renderer.onImageLoaded = null;
      reject(new Error(reason));
    };

    // Abort signal support (for cancel during preload)
    if (signal?.aborted) { fail('Export cancelled'); return; }
    signal?.addEventListener('abort', () => fail('Export cancelled'), { once: true });

    // 30-second timeout safety net — prevents infinite hang if images never resolve
    const timeout = setTimeout(() => {
      const loaded = imageIds.filter(id => renderer.getImageSource(id) !== null).length;
      const failed = imageIds.filter(id => renderer.isImageFailed(id)).length;
      console.warn(
        `[preloadExportImages] Timeout after 30s: ${loaded} loaded, ${failed} failed, ` +
        `${imageIds.length - loaded - failed} still pending out of ${imageIds.length} total`
      );
      finish(); // Proceed with whatever images loaded — missing ones render as blank
    }, 30_000);

    renderer.preloadImages(imageIds);

    // Check if an image is resolved (loaded or failed)
    const isResolved = (id: string) =>
      renderer.getImageSource(id) !== null || renderer.isImageFailed(id);

    // Check if all already resolved
    if (imageIds.every(isResolved)) {
      clearTimeout(timeout);
      finish();
      return;
    }

    // Wait for all to load/fail via onImageLoaded callback
    const check = () => {
      if (imageIds.every(isResolved)) {
        clearTimeout(timeout);
        const failed = imageIds.filter(id => renderer.isImageFailed(id));
        if (failed.length > 0) {
          console.warn(`[preloadExportImages] ${failed.length} image(s) failed to load — export will proceed without them`);
        }
        finish();
      }
    };
    renderer.onImageLoaded = check;
  });
}
