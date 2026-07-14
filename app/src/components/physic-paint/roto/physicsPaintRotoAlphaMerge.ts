import type { PhysicPaintRenderedFrame } from '../../../types/physicPaint';
import { encodeRotoFrameFromCanvas } from './rotoCanvasFrames';

export interface RotoAlphaMergeSize {
  width: number;
  height: number;
}

export async function mergeCachedRotoAlphaFrame(
  baseFrame: PhysicPaintRenderedFrame,
  liveAlphaCanvas: HTMLCanvasElement,
  appFrame: number,
  size: RotoAlphaMergeSize,
  mutationId?: number,
): Promise<PhysicPaintRenderedFrame> {
  const output = document.createElement('canvas');
  output.width = size.width;
  output.height = size.height;
  const context = output.getContext('2d');
  if (!context) {
    throw new Error('Could not merge cached Roto alpha frame: 2D context unavailable.');
  }

  const baseImage = await loadCachedRotoBaseImage(baseFrame.dataUrl);
  context.clearRect(0, 0, size.width, size.height);
  context.drawImage(baseImage, 0, 0, size.width, size.height);
  context.drawImage(liveAlphaCanvas, 0, 0, size.width, size.height);

  return encodeRotoFrameFromCanvas(output, appFrame, undefined, mutationId);
}

function loadCachedRotoBaseImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not merge cached Roto alpha frame: cached base image failed to load.'));
    image.src = dataUrl;
  });
}
