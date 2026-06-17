import type { PhysicPaintRotoBackgroundMetadata } from '../types/physicPaint';

export type MissingRotoFrameBackgroundState =
  | { mode: 'transparent' }
  | { mode: 'color'; color: string }
  | { mode: 'paper'; metadata: PhysicPaintRotoBackgroundMetadata };

export type MissingRotoFrameDrawInstruction =
  | { kind: 'transparent' }
  | { kind: 'background-only'; color: string; paperGrain?: string; grainStrength?: number };

export function resolveMissingRotoFrameDraw(
  _layerId: string,
  _frame: number,
  backgroundState: MissingRotoFrameBackgroundState,
): MissingRotoFrameDrawInstruction {
  if (backgroundState.mode === 'transparent') return { kind: 'transparent' };
  if (backgroundState.mode === 'color') return { kind: 'background-only', color: backgroundState.color };
  const metadata = backgroundState.metadata;
  if (metadata.background === 'transparent') return { kind: 'transparent' };
  return {
    kind: 'background-only',
    color: metadata.color ?? backgroundColorForRotoMode(metadata.background),
    paperGrain: metadata.paperGrain,
    grainStrength: metadata.grainStrength,
  };
}

export function drawMissingRotoBackground(
  ctx: CanvasRenderingContext2D,
  instruction: Extract<MissingRotoFrameDrawInstruction, { kind: 'background-only' }>,
  width: number,
  height: number,
): void {
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
