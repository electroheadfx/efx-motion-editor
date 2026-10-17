import type { PhysicPaintRotoBackgroundMetadata } from '../../../types/physicPaint';
import { subscribeProjectPaperCanvas } from '../../../lib/projectPaperRaster';
import { drawRotoFrameComposite, resolveMissingRotoFrameDraw } from '../../../lib/rotoFrameDraw';
import { capturePaperFond } from '../../../lib/paperFondCapture';

type PaperCanvasSubscriber = typeof subscribeProjectPaperCanvas;

export interface RotoPlaybackBackgroundSubscription {
  context: CanvasRenderingContext2D;
  width: number;
  height: number;
  background: PhysicPaintRotoBackgroundMetadata;
  subscribePaperCanvas?: PaperCanvasSubscriber;
}

function sampleContextPixel(context: CanvasRenderingContext2D, x: number, y: number): string {
  try {
    const data = context.getImageData(x, y, 1, 1).data;
    return `${data[0]},${data[1]},${data[2]},${data[3]}`;
  } catch (error) {
    return `error:${error instanceof Error ? error.message : String(error)}`;
  }
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
    capturePaperFond('fond-draw', {
      paperTexture: instruction.paperTexture ?? null,
      paperCanvas: paperCanvas ? `${paperCanvas.width}x${paperCanvas.height}` : null,
      arm: paperCanvas ? 'sheet' : 'color',
      color: instruction.color,
      width,
      height,
      grainScale: background.grainScale ?? 1,
      centerPixel: sampleContextPixel(context, Math.floor(width / 2), Math.floor(height / 2)),
      cornerPixel: sampleContextPixel(context, 1, 1),
    });
  }, background.grainScale ?? 1);
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    unsubscribe();
  };
}
