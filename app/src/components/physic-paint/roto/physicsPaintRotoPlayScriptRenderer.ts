import { computeAquarelleSheetPose, drawAquarelleSheetPose } from './aquarelleFramePose';
import type { PhysicPaintRenderedFrame } from '../../../types/physicPaint';
import type { RotoPaintScript } from './physicsPaintRotoScriptClipboard';
import { encodeRotoFrameFromCanvas } from './rotoCanvasFrames';
import { transmittanceToAlpha } from '../../../lib/rasterAlpha';

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
  motion: Readonly<{ deformation: number; position: number }>;
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
}

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
    frameCount: isStatic ? 1 : input.frameCount,
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
    if (!isStatic && frames.length !== input.frameCount) throw new Error('Aquarelle reveal bake frame count mismatch.');
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
      const washFrame = isStatic ? frames[0]! : frames[frameIndex]!;
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
      const posedCoverage = poseRevealCoverage(coverage, destination, input.motion);
      const masked = compositeRevealMask(referenceImage, posedCoverage, input.size, input.reference.transform, input.reference.zoom);
      const encoded = await encodeRotoFrameFromCanvas(masked, destination, input.size);
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
 */
function compositeRevealMask(
  referenceImage: HTMLImageElement,
  coverageAlpha: CanvasImageSource,
  size: Readonly<{ width: number; height: number }>,
  transform: Readonly<{ x: number; y: number; scaleX: number; scaleY: number; rotation: number }>,
  zoom: number,
): HTMLCanvasElement {
  const output = document.createElement('canvas');
  output.width = size.width;
  output.height = size.height;
  const context = output.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Could not composite reveal mask: 2D context unavailable.');

  context.clearRect(0, 0, size.width, size.height);
  const w = referenceImage.width * zoom;
  const h = referenceImage.height * zoom;
  context.save();
  context.globalAlpha = 1;
  context.translate(size.width / 2 + transform.x * zoom, size.height / 2 + transform.y * zoom);
  context.rotate((transform.rotation * Math.PI) / 180);
  context.scale(transform.scaleX, transform.scaleY);
  context.drawImage(referenceImage, -w / 2, -h / 2, w, h);
  context.restore();

  context.globalCompositeOperation = 'destination-in';
  context.drawImage(coverageAlpha, 0, 0, size.width, size.height);
  return output;
}

/** Per-output-frame pose for the flattened aquarelle coverage (see aquarelleFramePose). */
function poseRevealCoverage(
  coverage: HTMLCanvasElement,
  destinationFrame: number,
  motion: Readonly<{ deformation: number; position: number }>,
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
