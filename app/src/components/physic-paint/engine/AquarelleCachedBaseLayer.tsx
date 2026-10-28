import { useEffect, useRef } from 'preact/hooks';
import {
  transmittanceRectToPigmentAlpha,
  transmittanceSourceToPigmentAlpha,
} from '../../../lib/rasterAlpha';
import {
  buildLiftCoverage,
  liftShapeForStroke,
  punchTransmittanceRgba,
  type LiftFootprintShape,
} from '../roto/aquarelleLiftErase';
import {
  registerAquarelleLiftPreviewSink,
  type AquarelleLiftPreviewDab,
} from '../roto/aquarelleLiftPreview';
import { aquarelleBrushForActiveTool } from '../view/aquarelleRecordState';

/**
 * 2026-10-26 (round 2, option B): the committed aquarelle sheet, rendered as a
 * REAL pigment layer.
 *
 * Storage keeps the opaque MODE.transparent transmittance (white = no pigment;
 * the format never changes, old projects render, thumbnails/pose margins keep
 * their multiply law). At display time the sheet must join the layer stack with
 * straight-alpha pigment (alpha = 1 − min(r,g,b)) — otherwise its opaque border
 * hard-masks the paint beneath and the wash reads fully opaque, exactly the
 * semi-transparency the user lost.
 *
 * 261028-k03b — LIVE ERASE PREVIEW. The engine erases the live sheet, but on a
 * cooked frame the visible paint is this cached base, so the stroke used to
 * show nothing until the punch/re-bake committed (~1.5 s) and then flashed a
 * full reload. The decoded transmittance ImageData is kept next to the display
 * so the exact engine dabs can be punched into it per animation frame. The
 * authoritative commit still lands through the URL; the preview only holds the
 * visual until it arrives. URL swaps are double-buffered (decode first, then
 * clear+draw in one task) so a refresh never blanks the canvas.
 */
export function AquarelleCachedBaseLayer(props: { url: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  /** Decoded transmittance + its punchable pixel buffer. Null on legacy
   *  real-alpha frames (never punched) and until the first decode lands. */
  const decodedRef = useRef<{ width: number; height: number; image: ImageData } | null>(null);
  /** Pre-gesture copy, so a failed commit can restore what the user saw. */
  const snapshotRef = useRef<ImageData | null>(null);
  /**
   * 261028-k03c: THE preview-shape resolution seam. The gesture's tip shape is
   * resolved ONCE in `begin` from the active-tool selection law
   * (`aquarelleBrushForActiveTool` → `liftShapeForStroke`, the same law the
   * record and the bake resolve), so every previewed dab of the gesture
   * mirrors exactly what the engine bound. The Studio and the mount forward
   * only the 5-argument dab.
   */
  const shapeRef = useRef<LiftFootprintShape | null>(null);
  const pendingRef = useRef<AquarelleLiftPreviewDab[]>([]);
  const previewFrameRef = useRef<number | null>(null);
  const rafRef = useRef(0);
  const generationRef = useRef(0);

  const flushPreview = () => {
    rafRef.current = 0;
    const decoded = decodedRef.current;
    const canvas = canvasRef.current;
    const dabs = pendingRef.current.splice(0);
    if (!decoded || !canvas || dabs.length === 0) return;
    const { coverage, coverageRect } = buildLiftCoverage(
      dabs,
      decoded.width,
      decoded.height,
      shapeRef.current ?? undefined,
    );
    if (coverageRect.width <= 0 || coverageRect.height <= 0) return;
    punchTransmittanceRgba(decoded.image.data, coverage, decoded.width, decoded.height, coverageRect);
    const context = canvas.getContext('2d');
    if (!context) return;
    const rectImage = transmittanceRectToPigmentAlpha(
      decoded.image.data,
      decoded.width,
      decoded.height,
      coverageRect,
    );
    if (!rectImage) return;
    context.putImageData(rectImage, coverageRect.x, coverageRect.y);
  };

  const schedulePreview = () => {
    if (rafRef.current !== 0) return;
    rafRef.current = requestAnimationFrame(() => flushPreview());
  };

  useEffect(() => registerAquarelleLiftPreviewSink({
    begin(frame) {
      previewFrameRef.current = frame;
      pendingRef.current = [];
      // THE shape seam: one resolution per gesture (Task 2 item 13).
      shapeRef.current = liftShapeForStroke(aquarelleBrushForActiveTool());
      const decoded = decodedRef.current;
      snapshotRef.current = decoded
        ? new ImageData(new Uint8ClampedArray(decoded.image.data), decoded.width, decoded.height)
        : null;
    },
    dab(dab) {
      if (previewFrameRef.current === null) return;
      if (!decodedRef.current) return;
      pendingRef.current.push(dab);
      schedulePreview();
    },
    end() {
      // The painted preview stays until the authoritative bytes replace it.
    },
    revert() {
      previewFrameRef.current = null;
      pendingRef.current = [];
      const decoded = decodedRef.current;
      const snapshot = snapshotRef.current;
      snapshotRef.current = null;
      const canvas = canvasRef.current;
      if (!decoded || !snapshot || !canvas) return;
      decoded.image.data.set(snapshot.data);
      const context = canvas.getContext('2d');
      if (!context) return;
      const restored = transmittanceRectToPigmentAlpha(
        decoded.image.data,
        decoded.width,
        decoded.height,
        { x: 0, y: 0, width: decoded.width, height: decoded.height },
      );
      if (restored) context.putImageData(restored, 0, 0);
    },
  }), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    const generation = ++generationRef.current;
    // The OLD visible pixels stay until the new decode is ready; only the
    // punch source is dropped (it describes the old bytes).
    decodedRef.current = null;
    snapshotRef.current = null;
    previewFrameRef.current = null;
    pendingRef.current = [];
    const image = new Image();
    image.onload = () => {
      if (cancelled || generation !== generationRef.current) return;
      const width = image.naturalWidth || image.width;
      const height = image.naturalHeight || image.height;
      if (!width || !height) return;
      const scratch = document.createElement('canvas');
      scratch.width = width;
      scratch.height = height;
      const scratchContext = scratch.getContext('2d', { willReadFrequently: true });
      if (!scratchContext) return;
      scratchContext.drawImage(image, 0, 0);
      let transmittance: ImageData | null = null;
      try {
        transmittance = scratchContext.getImageData(0, 0, width, height);
      } catch {
        transmittance = null;
      }
      // One decode + one conversion per URL (never a per-frame hot path). A
      // sheet that is not a stored transmittance raster (engine-1 real alpha)
      // is drawn untouched and never previewed.
      const pigment = transmittanceSourceToPigmentAlpha(scratch);
      const next = document.createElement('canvas');
      next.width = width;
      next.height = height;
      const nextContext = next.getContext('2d');
      if (!nextContext) return;
      nextContext.drawImage(pigment ?? image, 0, 0, width, height);
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) return;
      // Clear+draw in ONE synchronous task: the browser never paints a blank
      // frame between the old and the new bytes (the old flash).
      context.clearRect(0, 0, width, height);
      context.drawImage(next, 0, 0);
      decodedRef.current = pigment && transmittance
        ? { width, height, image: transmittance }
        : null;
    };
    image.src = props.url;
    return () => {
      cancelled = true;
    };
  }, [props.url]);

  useEffect(() => () => {
    if (rafRef.current !== 0) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
  }, []);

  return <canvas ref={canvasRef} class="aquarelle-cached-base" aria-hidden="true" />;
}
