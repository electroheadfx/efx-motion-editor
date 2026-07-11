import type { PhysicPaintRotoBackgroundMetadata } from '../types/physicPaint';

export type MissingRotoFrameBackgroundState =
  | { mode: 'transparent' }
  | { mode: 'color'; color: string }
  | { mode: 'paper'; metadata: PhysicPaintRotoBackgroundMetadata };

export type MissingRotoFrameSpanKind = 'leading' | 'interior' | 'trailing' | 'no-real-keys';

export type MissingRotoFrameSpan =
  | { kind: 'leading'; nextRealKeyFrame: number }
  | { kind: 'interior'; previousRealKeyFrame: number; nextRealKeyFrame: number }
  | { kind: 'trailing'; previousRealKeyFrame: number }
  | { kind: 'no-real-keys' };

export interface MissingRotoFrameResolveInput {
  backgroundState: MissingRotoFrameBackgroundState;
  realKeyFrames?: readonly number[];
}

export type MissingRotoFrameDrawInstruction =
  | { kind: 'transparent'; span: MissingRotoFrameSpan; materialize: false }
  | { kind: 'background-only'; color: string; paperTexture?: string; paperGrain?: string; grainStrength?: number; span: MissingRotoFrameSpan; materialize: boolean };

export function getMissingRotoFrameSpan(frame: number, realKeyFrames: readonly number[] = []): MissingRotoFrameSpan {
  const requestedFrame = Math.floor(frame);
  const sortedKeys = Array.from(new Set(realKeyFrames.filter((key) => Number.isInteger(key) && key >= 0))).sort((a, b) => a - b);
  if (sortedKeys.length === 0) return { kind: 'no-real-keys' };

  let previousRealKeyFrame: number | undefined;
  let nextRealKeyFrame: number | undefined;
  for (const key of sortedKeys) {
    if (key < requestedFrame) previousRealKeyFrame = key;
    if (key > requestedFrame) {
      nextRealKeyFrame = key;
      break;
    }
  }

  if (previousRealKeyFrame !== undefined && nextRealKeyFrame !== undefined) {
    return { kind: 'interior', previousRealKeyFrame, nextRealKeyFrame };
  }
  if (nextRealKeyFrame !== undefined) return { kind: 'leading', nextRealKeyFrame };
  if (previousRealKeyFrame !== undefined) return { kind: 'trailing', previousRealKeyFrame };
  return { kind: 'no-real-keys' };
}

export function resolveMissingRotoFrameDraw(
  _layerId: string,
  frame: number,
  input: MissingRotoFrameBackgroundState | MissingRotoFrameResolveInput,
): MissingRotoFrameDrawInstruction {
  const backgroundState = 'backgroundState' in input ? input.backgroundState : input;
  const span = getMissingRotoFrameSpan(frame, 'backgroundState' in input ? input.realKeyFrames : []);
  const materialize = span.kind === 'interior';
  if (backgroundState.mode === 'transparent') return { kind: 'transparent', span, materialize: false };
  if (backgroundState.mode === 'color') return { kind: 'background-only', color: backgroundState.color, span, materialize };
  const metadata = backgroundState.metadata;
  if (metadata.background === 'transparent') return { kind: 'transparent', span, materialize: false };
  return {
    kind: 'background-only',
    color: metadata.color ?? backgroundColorForRotoMode(metadata.background),
    paperTexture: metadata.background,
    paperGrain: metadata.paperGrain,
    grainStrength: metadata.grainStrength,
    span,
    materialize,
  };
}

export function drawRotoFrameComposite(
  ctx: CanvasRenderingContext2D,
  instruction: Extract<MissingRotoFrameDrawInstruction, { kind: 'background-only' }>,
  width: number,
  height: number,
  paperTexture: CanvasImageSource | null,
  paperCanvas: HTMLCanvasElement | null,
  paintSource: CanvasImageSource | null,
): void {
  ctx.save();
  drawMissingRotoBackground(ctx, instruction, width, height, paperTexture, paperCanvas);
  ctx.restore();
  if (paintSource) ctx.drawImage(paintSource, 0, 0, width, height);
}

export function drawMissingRotoBackground(
  ctx: CanvasRenderingContext2D,
  instruction: Extract<MissingRotoFrameDrawInstruction, { kind: 'background-only' }>,
  width: number,
  height: number,
  paperTexture?: CanvasImageSource | null,
  paperCanvas?: HTMLCanvasElement | null,
): void {
  if (paperCanvas) {
    ctx.drawImage(paperCanvas, 0, 0, width, height);
    return;
  }
  if (paperTexture) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    const previousAlpha = ctx.globalAlpha;
    ctx.globalAlpha = previousAlpha * 0.18;
    const pattern = typeof ctx.createPattern === 'function' ? ctx.createPattern(paperTexture, 'repeat') : null;
    if (pattern) {
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, width, height);
    } else {
      ctx.drawImage(paperTexture, 0, 0, width, height);
    }
    ctx.globalAlpha = previousAlpha;
    return;
  }
  ctx.fillStyle = instruction.color;
  ctx.fillRect(0, 0, width, height);
  const grainStrength = instruction.grainStrength ?? 0;
  if (!instruction.paperGrain || grainStrength <= 0) return;
  drawDeterministicPaperGrain(ctx, instruction.paperGrain, grainStrength, width, height);
}

function backgroundColorForRotoMode(mode: PhysicPaintRotoBackgroundMetadata['background']): string {
  switch (mode) {
    case 'white': return '#ffffff';
    case 'canvas1': return '#f4efe3';
    case 'canvas2': return '#ebe3d2';
    case 'canvas3': return '#ded2bc';
    case 'transparent': return 'transparent';
  }
}

function drawDeterministicPaperGrain(ctx: CanvasRenderingContext2D, paperGrain: string, grainStrength: number, width: number, height: number): void {
  const step = paperGrain === 'canvas3' ? 5 : paperGrain === 'canvas2' ? 7 : 9;
  const alpha = Math.max(0, Math.min(0.12, grainStrength * 0.12));
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#000000';
  for (let y = 0; y < height; y += step) {
    for (let x = (y / step) % 2 === 0 ? 0 : Math.floor(step / 2); x < width; x += step) {
      ctx.fillRect(x, y, 1, 1);
    }
  }
  ctx.restore();
}
