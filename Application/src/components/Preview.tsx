import {useRef, useEffect} from 'preact/hooks';
import {effect} from '@preact/signals';
import {timelineStore} from '../stores/timelineStore';
import {sequenceStore} from '../stores/sequenceStore';
import {blurStore} from '../stores/blurStore';
import {frameMap, crossDissolveOverlaps} from '../lib/frameMap';
import {PreviewRenderer} from '../lib/previewRenderer';
import {interpolateAt} from '../lib/keyframeEngine';
import {computeFadeOpacity, computeSolidFadeAlpha, computeCrossDissolveOpacity} from '../lib/transitionEngine';
import {isFxLayer} from '../types/layer';
import type {LayerSourceData} from '../types/layer';
import type {FrameEntry} from '../types/timeline';
import type {Sequence} from '../types/sequence';

export function Preview() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hasContent = sequenceStore.sequences.value.some(s => s.kind === 'content' && s.keyPhotos.length > 0)
    || sequenceStore.sequences.value.some(s => s.kind !== 'content');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new PreviewRenderer(canvas);

    /**
     * Build a synthetic FrameEntry array for a given sequence (used by cross dissolve dual-render).
     * The renderer uses this for image lookup.
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
          });
          lf++;
        }
      }
      return frames;
    }

    /**
     * Apply keyframe interpolation to content layers for a given local frame.
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

    /**
     * Render for a given global frame using frameMap-derived data.
     * Independent of activeSequenceId — works correctly during playback
     * even when active sequence tracking is deferred.
     */
    function renderFromFrameMap(globalFrame: number) {
      const fm = frameMap.peek();
      if (globalFrame < 0 || globalFrame >= fm.length) return;

      const entry = fm[globalFrame];
      if (!entry) return;

      const allSeqs = sequenceStore.sequences.peek();
      const seq = allSeqs.find((s) => s.id === entry.sequenceId);
      if (!seq || seq.kind === 'fx') return;

      // Compute sequence start frame and local frame from frameMap
      let seqStart = globalFrame;
      while (seqStart > 0 && fm[seqStart - 1]?.sequenceId === entry.sequenceId) seqStart--;
      const seqFrames = fm.filter((e) => e.sequenceId === entry.sequenceId);
      const localFrame = globalFrame - seqStart;

      // === Cross dissolve check (BEFORE normal render) ===
      // If the current global frame falls within a cross dissolve overlap zone,
      // we render BOTH sequences with their respective opacities and skip the normal render.
      const overlaps = crossDissolveOverlaps.peek();
      let handledByCrossDissolve = false;

      for (const overlap of overlaps) {
        if (globalFrame >= overlap.overlapStart && globalFrame < overlap.overlapEnd) {
          handledByCrossDissolve = true;

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
            renderer.renderFrame(outLayers, outLocalFrame, outFrames, outSeq.fps, true, effectiveOutOpacity);
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
            renderer.renderFrame(inLayers, inLocalFrame, inFrames, inSeq.fps, false, effectiveInOpacity);
          }

          break; // Only one cross dissolve can be active at a time
        }
      }

      // === Normal content render (only if NOT in a cross dissolve zone) ===
      if (!handledByCrossDissolve) {
        // Apply keyframe interpolation to content layers before rendering
        const interpolatedLayers = interpolateLayers(seq, localFrame);

        // Compute fade opacity for this frame (per D-17, D-18)
        const totalSeqFrames = seqFrames.length;
        const fadeOpacity = computeFadeOpacity(localFrame, totalSeqFrames, seq.fadeIn, seq.fadeOut);

        // Determine which fade is active to check mode/color
        const activeFadeIn = seq.fadeIn && localFrame < seq.fadeIn.duration ? seq.fadeIn : undefined;
        const activeFadeOut = seq.fadeOut && localFrame >= totalSeqFrames - seq.fadeOut.duration ? seq.fadeOut : undefined;
        const activeFade = activeFadeIn || activeFadeOut;
        const isSolidMode = activeFade?.mode === 'solid';

        if (isSolidMode) {
          // Solid mode: render content at full opacity, then overlay solid color
          renderer.renderFrame(interpolatedLayers, localFrame, seqFrames, seq.fps);
          const solidAlpha = computeSolidFadeAlpha(localFrame, totalSeqFrames, seq.fadeIn, seq.fadeOut);
          if (solidAlpha > 0) {
            const color = activeFade?.color ?? '#000000';
            const cvs = canvasRef.current!;
            const solidCtx = cvs.getContext('2d')!;
            solidCtx.save();
            solidCtx.setTransform(1, 0, 0, 1, 0, 0);  // physical pixel coords (per Pitfall 5)
            solidCtx.globalAlpha = solidAlpha;
            solidCtx.fillStyle = color;
            solidCtx.fillRect(0, 0, cvs.width, cvs.height);
            solidCtx.restore();
          }
        } else {
          // Transparency mode: render content with reduced opacity via sequenceOpacity
          renderer.renderFrame(interpolatedLayers, localFrame, seqFrames, seq.fps, true, fadeOpacity);
        }
      }

      // Composite overlay sequences (FX + content overlays): reverse order so top-of-timeline renders last
      // Note: FX layers are NOT affected by content fade (per Pitfall 1)
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
            renderer.renderFrame(overlayLayers, overlayLocalFrame, seqFrames, seq.fps, false, overlayFadeOpacity);
          }
        } else {
          // FX sequence: apply keyframe interpolation to FX layers
          const fxLocalFrame = globalFrame - (overlaySeq.inFrame ?? 0);
          const fxTotalFrames = (overlaySeq.outFrame ?? 100) - (overlaySeq.inFrame ?? 0);
          const fxLayers = overlaySeq.layers.filter((l) => l.visible).map(layer => {
            if (!layer.keyframes || layer.keyframes.length === 0) return layer;
            const values = interpolateAt(layer.keyframes, fxLocalFrame);
            if (!values) return layer;
            const interpolatedLayer = values.sourceOverrides
              ? { ...layer, source: { ...layer.source, ...values.sourceOverrides } as LayerSourceData, opacity: values.opacity, blur: values.blur }
              : { ...layer, opacity: values.opacity, blur: values.blur };
            return interpolatedLayer;
          });
          if (fxLayers.length > 0) {
            // Apply fade opacity to FX sequence (transparency mode only)
            const fxFadeOpacity = computeFadeOpacity(fxLocalFrame, fxTotalFrames, overlaySeq.fadeIn, overlaySeq.fadeOut);
            renderer.renderFrame(fxLayers, localFrame, seqFrames, seq.fps, false, fxFadeOpacity);
          }
        }
      }
    }

    // When an image finishes loading, re-render with current values
    renderer.onImageLoaded = () => renderFromFrameMap(timelineStore.currentFrame.peek());

    // Pre-load effect: preload all content frames from frameMap since cursor can be in any sequence
    const disposePreload = effect(() => {
      const frames = frameMap.value;
      const imageIds = [...new Set(frames.map((f) => f.imageId))];
      renderer.preloadImages(imageIds);
    });

    // Render effect: redraw on scrub/seek/step and property changes.
    // Uses displayFrame (not currentFrame) so it does NOT fire during playback —
    // the rAF tick loop below handles playback rendering.
    // Reads reactive signals to establish subscriptions, then delegates to renderFromFrameMap.
    const disposeRender = effect(() => {
      const globalFrame = timelineStore.displayFrame.value;
      // Subscribe to all sequence data so we re-render on layer property changes
      void sequenceStore.sequences.value;
      // Subscribe to frameMap so we re-render when timeline shortens/expands
      void frameMap.value;
      // Subscribe to blur bypass signal so toggling bypass triggers a re-render.
      void blurStore.bypassBlur.value;

      renderFromFrameMap(globalFrame);
    });

    // rAF render loop: renders during playback using frameMap-derived data
    let rafId: number;
    let lastRenderedFrame = -1;

    function tick() {
      if (timelineStore.isPlaying.peek()) {
        const currentFrame = timelineStore.currentFrame.peek();
        if (currentFrame !== lastRenderedFrame) {
          lastRenderedFrame = currentFrame;
          renderFromFrameMap(currentFrame);
        }
      }
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      disposePreload();
      disposeRender();
      renderer.dispose();
    };
  }, []);

  return (
    <div class="absolute inset-0">
      <canvas
        ref={canvasRef}
        class="absolute inset-0 w-full h-full"
      />
      {!hasContent && (
        <div class="absolute inset-0 flex items-center justify-center">
          <span class="text-[var(--color-text-secondary)] text-sm">
            No frames to preview
          </span>
        </div>
      )}
    </div>
  );
}
