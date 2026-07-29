import type { PhysicPaintRotoBackgroundMetadata } from '../../../types/physicPaint';
import { subscribeProjectPaperCanvas } from '../../../lib/projectPaperRaster';
import { drawRotoFrameComposite, resolveMissingRotoFrameDraw } from '../../../lib/rotoFrameDraw';

type PaperCanvasSubscriber = typeof subscribeProjectPaperCanvas;

export interface RotoPlaybackBackgroundSubscription {
  context: CanvasRenderingContext2D;
  width: number;
  height: number;
  background: PhysicPaintRotoBackgroundMetadata;
  subscribePaperCanvas?: PaperCanvasSubscriber;
}

export function subscribeRotoPlaybackBackground({
  context,
  width,
  height,
  background,
  subscribePaperCanvas = subscribeProjectPaperCanvas,
}: RotoPlaybackBackgroundSubscription): () => void {
  const instruction = resolveMissingRotoFrameDraw('', 0, {
    mode: 'paper',
    metadata: background,
  });

  context.clearRect(0, 0, width, height);
  if (instruction.kind === 'transparent') return () => {};

  const unsubscribe = subscribePaperCanvas(instruction.paperTexture, width, height, (paperCanvas) => {
    context.clearRect(0, 0, width, height);
    drawRotoFrameComposite(context, instruction, width, height, null, paperCanvas, null);
  });
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    unsubscribe();
  };
}
