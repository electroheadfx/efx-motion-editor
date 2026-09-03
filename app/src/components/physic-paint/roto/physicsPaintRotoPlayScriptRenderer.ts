import { EfxPaintEngine, type PaintStroke } from '@efxlab/efx-physic-paint';
import { buildProgressiveStrokeSchedule, buildStaticStrokeSchedule, getProgressiveFrameStrokes, getStaticFrameStrokes, transformRecordedStrokeForHeldPose } from '@efxlab/efx-physic-paint/animation';
import type { PhysicPaintRenderedFrame } from '../../../types/physicPaint';
import type { RotoPaintScript } from './physicsPaintRotoScriptClipboard';
import { mergeRotoAlphaCanvases } from './physicsPaintRotoAlphaMerge';
import { encodeRotoFrameFromCanvas } from './rotoCanvasFrames';

const MAX_FRAME_COUNT = 10_000;
const MAX_AGGREGATE_RGBA_BYTES = 512 * 1024 * 1024;

export type RotoPlayScriptRenderMode = 'progressive' | 'static';

export interface RotoPlayScriptRenderInput {
  script: Readonly<RotoPaintScript>;
  frameCount: number;
  canonicalStart: number;
  motion: Readonly<{ deformation: number; position: number }>;
  existingFrames: ReadonlyMap<number, PhysicPaintRenderedFrame>;
  size: Readonly<{ width: number; height: number }>;
  papers?: readonly Readonly<{ name: string; url: string }>[];
  defaultPaper?: string;
  paperTextureScale?: number;
  mode?: RotoPlayScriptRenderMode;
  overrideColor?: string | null;
  signal: AbortSignal;
  onProgress?: (completed: number, total: number) => void;
}

export interface StagedRotoPlayScriptFrame extends PhysicPaintRenderedFrame {
  source: 'real-key';
}

/**
 * 52-01 (D-01/D-14/D-18): the reveal bake render input. Reuses the PlayScript
 * coverage path (progressive/static schedules + `renderProgressiveAlphaFrame`)
 * but replaces the additive `mergeRotoAlphaCanvases` step with a reference-mask
 * composite: the reference image AS PLACED (Phase 50 transform) at FULL source
 * opacity, masked by the coverage alpha via `destination-in`.
 */
export interface RotoRevealRenderInput {
  script: Readonly<RotoPaintScript>;
  frameCount: number;
  canonicalStart: number;
  motion: Readonly<{ deformation: number; position: number }>;
  mode?: RotoPlayScriptRenderMode;
  size: Readonly<{ width: number; height: number }>;
  papers?: readonly Readonly<{ name: string; url: string }>[];
  defaultPaper?: string;
  paperTextureScale?: number;
  /** The frame-aligned reference verdict (dataUrl) plus the display transform (D-14). */
  reference: Readonly<{
    dataUrl: string;
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

  const host = document.createElement('div');
  const engine = new EfxPaintEngine(host, {
    width: input.size.width,
    height: input.size.height,
    papers: [...(input.papers ?? [])],
    defaultPaper: input.defaultPaper,
    paperTextureScale: input.paperTextureScale,
  });
  const staged: StagedRotoPlayScriptFrame[] = [];

  try {
    await engine.init();
    throwIfAborted(input.signal);
    engine.setAnimationMode(true);
    engine.setInputLocked(true);
    engine.setBgMode('transparent');

    const referenceImage = await loadRevealReferenceImage(input.reference.dataUrl);
    throwIfAborted(input.signal);

    const strokes = flattenScriptStrokes(input.script);
    const mode = input.mode ?? 'progressive';
    const schedule = mode === 'static'
      ? buildStaticStrokeSchedule(strokes, input.frameCount)
      : buildProgressiveStrokeSchedule(strokes, input.frameCount);

    for (let frameIndex = 0; frameIndex < input.frameCount; frameIndex += 1) {
      throwIfAborted(input.signal);
      const destination = input.canonicalStart + frameIndex;
      const transformFrameStroke = (stroke: PaintStroke, _scheduleFrame: number, strokeIndex: number): PaintStroke => {
        const transformed = stroke.points.length === 0
          ? stroke
          : transformRecordedStrokeForHeldPose(stroke, {
            destinationSourceFrame: destination,
            strokeIndex,
            deformation: input.motion.deformation,
            position: input.motion.position,
          });
        return transformed;
      };
      const frameStrokes = mode === 'static'
        ? getStaticFrameStrokes(schedule, frameIndex, transformFrameStroke)
        : getProgressiveFrameStrokes(schedule, frameIndex, transformFrameStroke);
      let scriptAlpha: HTMLCanvasElement | null = null;
      let masked: HTMLCanvasElement | null = null;
      try {
        scriptAlpha = engine.renderProgressiveAlphaFrame(frameStrokes);
        throwIfAborted(input.signal);
        masked = compositeRevealMask(referenceImage, scriptAlpha, input.size, input.reference.transform, input.reference.zoom);
        throwIfAborted(input.signal);
        const encoded = await encodeRotoFrameFromCanvas(masked, destination, input.size);
        throwIfAborted(input.signal);
        staged.push({ ...encoded, frameIndex, appFrame: destination, source: 'real-key' });
        input.onProgress?.(frameIndex + 1, input.frameCount);
      } finally {
        if (scriptAlpha) releaseCanvas(scriptAlpha);
        if (masked) releaseCanvas(masked);
      }
      await yieldToBrowser(input.signal);
    }

    return staged;
  } catch (error) {
    staged.length = 0;
    throw error;
  } finally {
    engine.setInputLocked(false);
    engine.setAnimationMode(false);
    engine.destroy();
    host.replaceChildren();
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
  scriptAlphaCanvas: HTMLCanvasElement,
  size: Readonly<{ width: number; height: number }>,
  transform: Readonly<{ x: number; y: number; scaleX: number; scaleY: number; rotation: number }>,
  zoom: number,
): HTMLCanvasElement {
  const output = document.createElement('canvas');
  output.width = size.width;
  output.height = size.height;
  const context = output.getContext('2d');
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
  context.drawImage(scriptAlphaCanvas, 0, 0, size.width, size.height);
  return output;
}

function loadRevealReferenceImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not load reveal reference image.'));
    image.src = dataUrl;
  });
}

export async function renderRotoPlayScriptFrames(input: RotoPlayScriptRenderInput): Promise<StagedRotoPlayScriptFrame[]> {
  validateRenderInput(input);
  throwIfAborted(input.signal);

  const host = document.createElement('div');
  const engine = new EfxPaintEngine(host, {
    width: input.size.width,
    height: input.size.height,
    papers: [...(input.papers ?? [])],
    defaultPaper: input.defaultPaper,
    paperTextureScale: input.paperTextureScale,
  });
  const staged: StagedRotoPlayScriptFrame[] = [];

  try {
    await engine.init();
    throwIfAborted(input.signal);
    engine.setAnimationMode(true);
    engine.setInputLocked(true);
    engine.setBgMode('transparent');

    const strokes = flattenScriptStrokes(input.script);
    const mode = input.mode ?? 'progressive';
    const schedule = mode === 'static'
      ? buildStaticStrokeSchedule(strokes, input.frameCount)
      : buildProgressiveStrokeSchedule(strokes, input.frameCount);

    for (let frameIndex = 0; frameIndex < input.frameCount; frameIndex += 1) {
      throwIfAborted(input.signal);
      const destination = input.canonicalStart + frameIndex;
      const transformFrameStroke = (stroke: PaintStroke, _scheduleFrame: number, strokeIndex: number): PaintStroke => {
        const transformed = stroke.points.length === 0
          ? stroke
          : transformRecordedStrokeForHeldPose(stroke, {
            destinationSourceFrame: destination,
            strokeIndex,
            deformation: input.motion.deformation,
            position: input.motion.position,
          });
        // Color override applies AFTER the Motion transform (the determinism seed hashes the original color),
        // recolors paint strokes only, and never touches erase strokes (D-11).
        return input.overrideColor != null && transformed.tool !== 'erase'
          ? { ...transformed, color: input.overrideColor }
          : transformed;
      };
      const frameStrokes = mode === 'static'
        ? getStaticFrameStrokes(schedule, frameIndex, transformFrameStroke)
        : getProgressiveFrameStrokes(schedule, frameIndex, transformFrameStroke);
      let scriptAlpha: HTMLCanvasElement | null = null;
      let merged: HTMLCanvasElement | null = null;
      try {
        scriptAlpha = engine.renderProgressiveAlphaFrame(frameStrokes);
        throwIfAborted(input.signal);
        merged = await mergeRotoAlphaCanvases(input.existingFrames.get(destination) ?? null, scriptAlpha, input.size);
        throwIfAborted(input.signal);
        const encoded = await encodeRotoFrameFromCanvas(merged, destination, input.size);
        throwIfAborted(input.signal);
        staged.push({ ...encoded, frameIndex, appFrame: destination, source: 'real-key' });
        input.onProgress?.(frameIndex + 1, input.frameCount);
      } finally {
        if (scriptAlpha) releaseCanvas(scriptAlpha);
        if (merged) releaseCanvas(merged);
      }
      await yieldToBrowser(input.signal);
    }

    return staged;
  } catch (error) {
    staged.length = 0;
    throw error;
  } finally {
    engine.setInputLocked(false);
    engine.setAnimationMode(false);
    engine.destroy();
    host.replaceChildren();
  }
}

function flattenScriptStrokes(script: Readonly<RotoPaintScript>): PaintStroke[] {
  const strokes: PaintStroke[] = [];
  for (const brush of script.brushes) {
    strokes.push(cloneStroke(brush.primary));
    for (const continuation of brush.continuations ?? []) strokes.push(cloneStroke(continuation));
  }
  return strokes;
}

function cloneStroke(stroke: Readonly<PaintStroke>): PaintStroke {
  return { ...stroke, points: stroke.points.map((point) => ({ ...point })), params: { ...stroke.params } };
}

function validateRenderInput(input: Pick<RotoPlayScriptRenderInput, 'frameCount' | 'canonicalStart' | 'size'>): void {
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

function releaseCanvas(canvas: HTMLCanvasElement): void {
  canvas.width = 0;
  canvas.height = 0;
}
