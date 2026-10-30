import { computeAquarelleSheetPose, drawAquarelleSheetPose } from './aquarelleFramePose';
import type { PhysicPaintRenderedFrame } from '../../../types/physicPaint';
import type { RotoPaintScript } from './physicsPaintRotoScriptClipboard';
import { encodeRotoFrameFromCanvas } from './rotoCanvasFrames';
import { transmittanceToAlpha } from '../../../lib/rasterAlpha';
import type { AquarelleStrokeFrameAnchor } from '@efxlab/efx-watercolor/bake';

const MAX_FRAME_COUNT = 10_000;
const MAX_AGGREGATE_RGBA_BYTES = 512 * 1024 * 1024;

export type RotoPlayScriptRenderMode = 'progressive' | 'static';

export interface StagedRotoPlayScriptFrame extends PhysicPaintRenderedFrame {
  source: 'real-key';
}

/**
 * 52-01 (D-01/D-14/D-18): the reveal bake render input. The wash IS the
 * coverage — a reference-mask composite where the reference image AS PLACED
 * (Phase 50 transform) at FULL source opacity is masked by the wash alpha via
 * `destination-in`.
 */
export interface RotoRevealRenderInput {
  script: Readonly<RotoPaintScript>;
  frameCount: number;
  canonicalStart: number;
  motion: Readonly<{ deformation: number; position: number; rotation?: number; scale?: number }>;
  /**
   * 261029-vbp: tint the revealed photo with the wash pigment. Absent/false
   * means today's output (the photo's own colours, masked by the wash alpha);
   * `colorizeMix` 100 replaces the photo's hue+saturation with the wash
   * pigment's while the photo keeps its luminosity (canvas `'color'`
   * composite). The wash alpha still defines the silhouette at every mix.
   */
  colorize?: boolean;
  colorizeMix?: number;
  /**
   * 261030-ey9: Reveal "Photo wiggle". Off (absent/false) is today's bake — the
   * wash coverage takes the held pose and the photo stays as placed. On masks
   * the UNPOSED coverage and applies exactly ONE rigid held pose to the
   * finished composite pivoting on the placed photo's own centre, so photo and
   * wash breathe as one unit. Reuses the Motion wiggle values (no second
   * slider); all values at 0 means no visible motion even when checked.
   */
  photoWiggle?: boolean;
  /**
   * 261030-v1t: per-output-frame paint-seed variation. Off (absent/false) is
   * today's bake. On makes the bake replay the script FROM SCRATCH once per
   * output frame with the stroke RNG salted by that frame — progressive replays
   * each growing window, static replays the whole settled drawing — so every
   * baked key has its own brush texture. The variant is derived from `mode`;
   * the reveal still masks with the wash alpha and poses per output frame.
   */
  paintSeedVariation?: boolean;
  mode?: RotoPlayScriptRenderMode;
  size: Readonly<{ width: number; height: number }>;
  /**
   * The Studio paper the wash deposits on. Without it the aquarelle bake uses
   * its default paper. The mask reads the wash alpha, so the paper only shapes
   * the edges.
   */
  aquarellePaper?: Readonly<{ paperId: string; grainStrength: number; grainScale: number }>;
  /**
   * The frame-aligned reference plus the display transform (D-14).
   *
   * `bytesByAppFrame` maps an APPLICATION frame to the reference image that
   * resolves there — the D-15 law (frame N → source frame N) carried to the
   * renderer so each baked key gets the image belonging to ITS frame. Clamped
   * repeats share one payload instance, which is also the decode-once key.
   * The store walks and pre-validates the whole span fail-closed before
   * calling; a missing entry here is a caller bug and throws rather than
   * silently reusing a neighbouring frame's image (WR-02).
   */
  reference: Readonly<{
    bytesByAppFrame: ReadonlyMap<number, Uint8Array>;
    transform: Readonly<{ x: number; y: number; scaleX: number; scaleY: number; rotation: number }>;
    /** Project→working scale (working size / project size) — the ghost draw's `zoom`. */
    zoom: number;
  }>;
  signal: AbortSignal;
  onProgress?: (completed: number, total: number) => void;
  /**
   * 261030-np9: the per-stroke start-frame mapping the bake used, reported
   * once. The reveal rail slices it onto each baked key; never throw from it —
   * the bake swallows consumer errors.
   */
  onStrokeFrameAnchors?: (anchors: readonly AquarelleStrokeFrameAnchor[]) => void;
}

/** 261030-np9: the reveal bake's per-stroke anchors, re-exported for the store. */
export type RotoRevealStrokeFrameAnchors = readonly AquarelleStrokeFrameAnchor[];

/**
 * 52-01 (D-11): the reveal bake — one pass over the rail span producing
 * straight-alpha keys that carry reference pixels where the script coverage is
 * and transparency elsewhere (D-17, RVL-02 generation-time). The reference is
 * drawn AS PLACED at FULL source opacity (D-18) — the Phase 50 guide opacity
 * is a pure painting aid and never affects the baked result. The bake is
 * deterministic: the same script + reference + motion produce identical keys.
 */
export async function renderRotoRevealFrames(input: RotoRevealRenderInput): Promise<StagedRotoPlayScriptFrame[]> {
  validateRenderInput(input);
  throwIfAborted(input.signal);

  // 261027-klx: the wash alpha IS the coverage, and watercolor is the only
  // engine. A script without a recorded wash timeline is an old Brush envelope
  // with nothing to bake — refuse it instead of staging an empty reveal.
  const aquarelleEvents = input.script.aquarelleEvents;
  if (aquarelleEvents === undefined || aquarelleEvents.length === 0) {
    throw new Error('Reveal needs a Water color script — this script has no recorded wash timeline.');
  }
  return renderRotoRevealFramesAquarelle(input, aquarelleEvents);
}

/**
 * The Reveal bake: the wash alpha IS the coverage. Reuses the exact bake the
 * Play/Apply aquarelle path uses (progressive growth across the span, paper,
 * Dry events in recorded order), then feeds each baked wash frame's alpha to
 * the reference-mask composite. Static mode bakes one settled wash and holds
 * it across the span.
 *
 * The fluid sheet is cumulative — deposited pigment cannot be re-warped every
 * frame — and the bake's per-deposit wiggle pose would freeze a single-stroke
 * script into one pose (no motion at all). Reveal only consumes the wash as a
 * mask, so the bake runs unposed and the flattened coverage takes the held
 * pose of the OUTPUT frame (`poseRevealCoverage`): the whole revealed
 * silhouette wiggles with the held-pose amplitude and hold law.
 */
async function renderRotoRevealFramesAquarelle(
  input: RotoRevealRenderInput,
  events: NonNullable<RotoPaintScript['aquarelleEvents']>,
): Promise<StagedRotoPlayScriptFrame[]> {
  if (events.length === 0) throw new Error('Aquarelle reveal requires recorded script events.');
  throwIfAborted(input.signal);

  const [{ createAquarelleEngineAdapter }, { createAquarelleBake }, { paperPresetForStudioId }, { encodeWebpFrame }] = await Promise.all([
    import('@efxlab/efx-watercolor'),
    import('@efxlab/efx-watercolor/bake'),
    import('../engine/AquarelleCanvasLayer'),
    import('../../../lib/webpFrameCodec'),
  ]);
  throwIfAborted(input.signal);

  const paper = input.aquarellePaper;
  const adapter = createAquarelleEngineAdapter({
    width: input.size.width,
    height: input.size.height,
    paperPreset: paper ? paperPresetForStudioId(paper.paperId) : undefined,
    paperStrength: paper?.grainStrength,
  });
  const isStatic = (input.mode ?? 'progressive') === 'static';
  // 261030-v1t: ON re-bakes every output frame (static included) with its own
  // salted from-scratch replay; OFF keeps the one-wash static law.
  const paintSeedVariation = input.paintSeedVariation === true;
  // 261029-vbp: one resolution for the whole span — 0 is today's op ledger.
  const colorizeMix = resolveRevealColorizeMix(input);
  // The fluid bake reports committed frames as it goes; the composite turn
  // reports the rest. Monotonic, so the dialog bar never walks backwards.
  let reportedProgress = 0;
  const reportProgress = (completed: number): void => {
    const next = Math.max(reportedProgress, Math.min(input.frameCount, Math.trunc(completed)));
    if (next === reportedProgress) return;
    reportedProgress = next;
    input.onProgress?.(next, input.frameCount);
  };
  const bake = createAquarelleBake(adapter, {
    width: input.size.width,
    height: input.size.height,
    ...(paper ? { paper: { paperId: paper.paperId, grainStrength: paper.grainStrength, grainScale: paper.grainScale } } : {}),
    encodeWebp: async (frame, width, height) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('Could not create aquarelle reveal encode canvas.');
      context.drawImage(frame, 0, 0, width, height);
      const imageData = context.getImageData(0, 0, width, height);
      return encodeWebpFrame({
        rgba: new Uint8Array(imageData.data.buffer, imageData.data.byteOffset, imageData.data.byteLength),
        width,
        height,
      });
    },
    frameCount: isStatic && !paintSeedVariation ? 1 : input.frameCount,
    ...(paintSeedVariation ? { paintSeedVariation: isStatic ? 'static' : 'progressive' } as const : {}),
    ...(input.onStrokeFrameAnchors ? { onStrokeFrameAnchors: input.onStrokeFrameAnchors } : {}),
    // No bake motion: its per-deposit pose is frozen into the cumulative wash.
    // Reveal poses the flattened coverage once per output frame instead.
    onCommit: () => reportProgress(reportedProgress + 1),
  });
  const interruptOnAbort = () => bake.interrupt();
  input.signal.addEventListener('abort', interruptOnAbort, { once: true });
  const staged: StagedRotoPlayScriptFrame[] = [];
  try {
    const result = await bake.bake(events);
    throwIfAborted(input.signal);
    if (!result.ok) {
      throw new Error(result.reason === 'cancelled' ? 'Aquarelle reveal bake cancelled.' : 'Aquarelle reveal bake failed.');
    }
    const frames = result.frames;
    if (frames.length === 0) throw new Error('Aquarelle reveal bake produced no frames.');
    // ON bakes `input.frameCount` frames in BOTH modes (each held static frame
    // is a complete replay), so the mismatch guard covers static there too.
    if ((!isStatic || paintSeedVariation) && frames.length !== input.frameCount) {
      throw new Error('Aquarelle reveal bake frame count mismatch.');
    }
    // Decode-once per distinct payload: static mode reuses the single wash for
    // every span frame, and a repeated reference payload shares one decode.
    const washImages = new Map<Uint8Array, HTMLImageElement>();
    // The aquarelle capture is MODE.transparent TRANSMITTANCE (opaque, white =
    // no pigment), not alpha. `transmittanceToAlpha` is the app's one conversion
    // to pigment coverage (alpha = 1 - min(r,g,b)); without it the mask would
    // be opaque everywhere and reveal the whole photo.
    const coverageByBytes = new Map<Uint8Array, HTMLCanvasElement>();
    const referenceImages = new Map<Uint8Array, HTMLImageElement>();
    for (let frameIndex = 0; frameIndex < input.frameCount; frameIndex += 1) {
      throwIfAborted(input.signal);
      const destination = input.canonicalStart + frameIndex;
      const washFrame = isStatic && !paintSeedVariation ? frames[0]! : frames[frameIndex]!;
      let coverage = coverageByBytes.get(washFrame.bytes);
      if (coverage === undefined) {
        const washImage = washImages.get(washFrame.bytes) ?? await loadRevealWebpImage(washFrame.bytes);
        washImages.set(washFrame.bytes, washImage);
        const washCanvas = document.createElement('canvas');
        washCanvas.width = input.size.width;
        washCanvas.height = input.size.height;
        const washContext = washCanvas.getContext('2d', { willReadFrequently: true });
        if (!washContext) throw new Error('Could not create aquarelle reveal mask canvas.');
        washContext.drawImage(washImage, 0, 0, input.size.width, input.size.height);
        const converted = transmittanceToAlpha(washCanvas);
        if (!converted) throw new Error('Could not convert the aquarelle wash to pigment alpha.');
        coverage = converted;
        coverageByBytes.set(washFrame.bytes, coverage);
      }
      const referenceBytes = input.reference.bytesByAppFrame.get(destination);
      if (referenceBytes === undefined) throw new Error(`No reveal reference image for frame ${destination}.`);
      let referenceImage = referenceImages.get(referenceBytes);
      if (referenceImage === undefined) {
        referenceImage = await loadRevealWebpImage(referenceBytes);
        referenceImages.set(referenceBytes, referenceImage);
      }
      throwIfAborted(input.signal);
      // 261030-ey9: OFF keeps today's exact path (pose the flattened coverage).
      // ON masks the UNPOSED coverage, then poses the finished composite — the
      // coverage is never posed in the same frame (that would double the motion
      // and break the locked "whole revealed result moves as one unit" rule).
      const posedCoverage = input.photoWiggle === true
        ? coverage
        : poseRevealCoverage(coverage, destination, input.motion);
      const masked = compositeRevealMask(referenceImage, posedCoverage, input.size, input.reference.transform, input.reference.zoom, colorizeMix);
      const finalFrame = input.photoWiggle === true
        ? poseRevealedResult(masked, destination, input.motion, input.reference.transform, input.reference.zoom)
        : masked;
      const encoded = await encodeRotoFrameFromCanvas(finalFrame, destination, input.size);
      throwIfAborted(input.signal);
      staged.push({ ...encoded, frameIndex, appFrame: destination, source: 'real-key' });
      reportProgress(frameIndex + 1);
      await yieldToBrowser(input.signal);
    }
    return staged;
  } catch (error) {
    staged.length = 0;
    throw error;
  } finally {
    input.signal.removeEventListener('abort', interruptOnAbort);
    bake.dispose();
    adapter.dispose();
  }
}

/**
 * 52-01 (D-17/D-18): the reference-mask composite that REPLACES the PlayScript
 * `mergeRotoAlphaCanvases` step. Draws the reference image AS PLACED (the
 * Phase 50 position/scale/rotation transform, D-14) at FULL source opacity
 * (D-18), then applies the coverage alpha as a `destination-in` mask — the
 * inverse of the engine's `destination-out` erase. The result carries reference
 * pixels where coverage is non-zero and transparency elsewhere, straight-alpha
 * encoded (Pitfall 1: `destination-in` keeps the destination RGB unmodified, so
 * semi-transparent edge pixels are NOT premultiplied).
 *
 * The draw reproduces the reference ghost math (PhysicsPaintReferenceGhost)
 * exactly, so baked keys overlay the ghost pixel-perfectly: image and
 * transform translation are scaled by `zoom` (the project→working scale,
 * G-52-2a) while the bake canvas and coverage alpha live at working size.
 *
 * 261029-vbp colorize: a `'color'` composite tints the placed photo with the
 * wash pigment — hue+saturation come from the wash, luminosity stays the
 * photo's. The tint is built on a SCRATCH canvas pre-loaded with the SAME
 * `drawPlacedReference` footprint and reaches the output through ONE
 * `'source-atop'` transfer: that is Porter-Duff alpha-preserving
 * (alpha_o = alpha_b), so the reveal silhouette never grows and no tint pixel
 * can land outside the photo. The `destination-in` mask still runs LAST at
 * globalAlpha 1, leaving final alpha = referenceAlpha × coverage exactly as
 * the uncolorized bake. Never tint the output directly (outside the photo the
 * backdrop alpha is 0, so a `'color'` draw there would deposit coverage that
 * the final mask then squares instead of leaving 0) and never move the mask
 * before the tint transfer.
 */
function compositeRevealMask(
  referenceImage: HTMLImageElement,
  coverageAlpha: CanvasImageSource,
  size: Readonly<{ width: number; height: number }>,
  transform: Readonly<{ x: number; y: number; scaleX: number; scaleY: number; rotation: number }>,
  zoom: number,
  colorizeMix: number,
): HTMLCanvasElement {
  const output = document.createElement('canvas');
  output.width = size.width;
  output.height = size.height;
  const context = output.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Could not composite reveal mask: 2D context unavailable.');

  context.clearRect(0, 0, size.width, size.height);
  drawPlacedReference(context, referenceImage, size, transform, zoom);

  if (colorizeMix > 0) {
    const tint = buildRevealTint(referenceImage, coverageAlpha, size, transform, zoom, colorizeMix);
    // 'source-atop' keeps the output's own alpha (alpha_o = alpha_b) while
    // taking the tint's colour, so coverage is still exactly the reference's.
    context.globalCompositeOperation = 'source-atop';
    context.globalAlpha = 1;
    context.drawImage(tint, 0, 0, size.width, size.height);
  }

  context.globalCompositeOperation = 'destination-in';
  context.globalAlpha = 1;
  context.drawImage(coverageAlpha, 0, 0, size.width, size.height);
  return output;
}

/**
 * Draw the reference image AS PLACED — the ONE footprint used by the mask
 * canvas and by the colorize scratch, so the tint can never cover a pixel the
 * photo does not. Reproduces the Phase 50 ghost math exactly (`zoom` scales
 * both the image and the transform translation).
 */
function drawPlacedReference(
  context: CanvasRenderingContext2D,
  referenceImage: HTMLImageElement,
  size: Readonly<{ width: number; height: number }>,
  transform: Readonly<{ x: number; y: number; scaleX: number; scaleY: number; rotation: number }>,
  zoom: number,
): void {
  const w = referenceImage.width * zoom;
  const h = referenceImage.height * zoom;
  context.save();
  context.globalAlpha = 1;
  context.translate(size.width / 2 + transform.x * zoom, size.height / 2 + transform.y * zoom);
  context.rotate((transform.rotation * Math.PI) / 180);
  context.scale(transform.scaleX, transform.scaleY);
  context.drawImage(referenceImage, -w / 2, -h / 2, w, h);
  context.restore();
}

/**
 * 261029-vbp: the tinted copy of the placed reference. `'color'` takes hue and
 * saturation from the wash pigment raster and luminosity from the photo, so
 * wave/texture detail survives; `globalAlpha = mix / 100` interpolates the
 * tint strength linearly over the opaque photo backdrop.
 */
function buildRevealTint(
  referenceImage: HTMLImageElement,
  coverageAlpha: CanvasImageSource,
  size: Readonly<{ width: number; height: number }>,
  transform: Readonly<{ x: number; y: number; scaleX: number; scaleY: number; rotation: number }>,
  zoom: number,
  colorizeMix: number,
): HTMLCanvasElement {
  const tint = document.createElement('canvas');
  tint.width = size.width;
  tint.height = size.height;
  const context = tint.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Could not composite reveal tint: 2D context unavailable.');
  context.clearRect(0, 0, size.width, size.height);
  drawPlacedReference(context, referenceImage, size, transform, zoom);
  context.save();
  context.globalCompositeOperation = 'color';
  context.globalAlpha = colorizeMix / 100;
  context.drawImage(coverageAlpha, 0, 0, size.width, size.height);
  context.restore();
  return tint;
}

/**
 * 261030-ey9: the Reveal Photo wiggle — exactly ONE rigid held pose of the
 * FINISHED composite, pivoting on the placed photo's own centre (the same
 * centre `drawPlacedReference` uses), so photo and wash move together.
 *
 * `computeAquarelleSheetPose` returns null when all motion values are zero —
 * return the composite UNCHANGED (the locked "all values at 0 means no visible
 * motion even when checked" rule). Never draw an identity pose to fake it.
 */
function poseRevealedResult(
  masked: HTMLCanvasElement,
  destinationFrame: number,
  motion: Readonly<{ deformation: number; position: number; rotation?: number; scale?: number }>,
  transform: Readonly<{ x: number; y: number; scaleX: number; scaleY: number; rotation: number }>,
  zoom: number,
): HTMLCanvasElement {
  const pose = computeAquarelleSheetPose(masked.width, masked.height, destinationFrame, motion);
  if (!pose) return masked;
  const pivot = {
    x: masked.width / 2 + transform.x * zoom,
    y: masked.height / 2 + transform.y * zoom,
  };
  return drawAquarelleSheetPose(masked, masked.width, masked.height, pose, 'transparent', pivot);
}

/** Per-output-frame pose for the flattened aquarelle coverage (see aquarelleFramePose). */
function poseRevealCoverage(
  coverage: HTMLCanvasElement,
  destinationFrame: number,
  motion: Readonly<{ deformation: number; position: number; rotation?: number; scale?: number }>,
): HTMLCanvasElement {
  const pose = computeAquarelleSheetPose(coverage.width, coverage.height, destinationFrame, motion);
  return pose
    ? drawAquarelleSheetPose(coverage, coverage.width, coverage.height, pose)
    : coverage;
}

function loadRevealWebpImage(bytes: Uint8Array): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const blobUrl = URL.createObjectURL(new Blob([bytes.slice()], { type: 'image/webp' }));
    image.onload = () => {
      URL.revokeObjectURL(blobUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(blobUrl);
      reject(new Error('Could not load reveal WebP image.'));
    };
    image.src = blobUrl;
  });
}

/**
 * 261029-vbp: the renderer's own re-clamp of the tint strength. Off
 * (absent/false) resolves to 0 — today's op ledger — and a non-finite mix on an
 * enabled colorize defaults to the full 100 the controller writes on enable.
 */
function resolveRevealColorizeMix(input: Pick<RotoRevealRenderInput, 'colorize' | 'colorizeMix'>): number {
  if (input.colorize !== true) return 0;
  if (input.colorizeMix === undefined || !Number.isFinite(input.colorizeMix)) return 100;
  return Math.min(100, Math.max(0, Math.round(input.colorizeMix)));
}

function validateRenderInput(input: Pick<RotoRevealRenderInput, 'frameCount' | 'canonicalStart' | 'size'>): void {
  if (!Number.isInteger(input.frameCount) || input.frameCount <= 0 || input.frameCount > MAX_FRAME_COUNT) {
    throw new RangeError(`Play Script frame count must be between 1 and ${MAX_FRAME_COUNT}.`);
  }
  if (!Number.isInteger(input.canonicalStart) || input.canonicalStart < 0) throw new RangeError('Play Script canonical start is invalid.');
  if (!Number.isInteger(input.size.width) || !Number.isInteger(input.size.height) || input.size.width <= 0 || input.size.height <= 0) {
    throw new RangeError('Play Script canvas size is invalid.');
  }
  const aggregateBytes = input.size.width * input.size.height * 4 * input.frameCount;
  if (!Number.isSafeInteger(aggregateBytes) || aggregateBytes > MAX_AGGREGATE_RGBA_BYTES) {
    throw new RangeError('Play Script exceeds the safe staged-render memory limit.');
  }
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new DOMException('Play Script generation cancelled.', 'AbortError');
}

function yieldToBrowser(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const id = requestAnimationFrame(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    });
    const abort = () => {
      cancelAnimationFrame(id);
      reject(new DOMException('Play Script generation cancelled.', 'AbortError'));
    };
    signal.addEventListener('abort', abort, { once: true });
  });
}
