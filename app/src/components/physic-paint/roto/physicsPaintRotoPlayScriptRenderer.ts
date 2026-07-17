import { EfxPaintEngine, type PaintStroke } from '@efxlab/efx-physic-paint';
import { buildProgressiveStrokeSchedule, getProgressiveFrameStrokes, transformRecordedStrokeForHeldPose } from '@efxlab/efx-physic-paint/animation';
import type { PhysicPaintRenderedFrame } from '../../../types/physicPaint';
import type { RotoPaintScript } from './physicsPaintRotoScriptClipboard';
import { mergeRotoAlphaCanvases } from './physicsPaintRotoAlphaMerge';
import { encodeRotoFrameFromCanvas } from './rotoCanvasFrames';

const MAX_FRAME_COUNT = 10_000;
const MAX_AGGREGATE_RGBA_BYTES = 512 * 1024 * 1024;

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
  signal: AbortSignal;
  onProgress?: (completed: number, total: number) => void;
}

export interface StagedRotoPlayScriptFrame extends PhysicPaintRenderedFrame {
  sourceFrame: number;
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
    const schedule = buildProgressiveStrokeSchedule(strokes, input.frameCount);

    for (let frameIndex = 0; frameIndex < input.frameCount; frameIndex += 1) {
      throwIfAborted(input.signal);
      const destination = input.canonicalStart + frameIndex;
      const progressive = getProgressiveFrameStrokes(schedule, frameIndex, (stroke, _scheduleFrame, strokeIndex) => (
        stroke.points.length === 0
          ? stroke
          : transformRecordedStrokeForHeldPose(stroke, {
            destinationSourceFrame: destination,
            strokeIndex,
            deformation: input.motion.deformation,
            position: input.motion.position,
          })
      ));
      const scriptAlpha = engine.renderProgressiveAlphaFrame(progressive);
      throwIfAborted(input.signal);
      const merged = await mergeRotoAlphaCanvases(input.existingFrames.get(destination) ?? null, scriptAlpha, input.size);
      throwIfAborted(input.signal);
      const encoded = await encodeRotoFrameFromCanvas(merged, destination, input.size);
      throwIfAborted(input.signal);
      staged.push({ ...encoded, frameIndex, sourceFrame: destination });
      releaseCanvas(scriptAlpha);
      releaseCanvas(merged);
      input.onProgress?.(frameIndex + 1, input.frameCount);
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

function validateRenderInput(input: RotoPlayScriptRenderInput): void {
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
