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
  const output = await mergeRotoAlphaCanvases(baseFrame, liveAlphaCanvas, size);
  return encodeRotoFrameFromCanvas(output, appFrame, undefined, mutationId);
}

export async function mergeRotoAlphaCanvases(
  baseFrame: Pick<PhysicPaintRenderedFrame, 'dataUrl'> | null,
  scriptAlphaCanvas: HTMLCanvasElement,
  size: RotoAlphaMergeSize,
): Promise<HTMLCanvasElement> {
  const output = document.createElement('canvas');
  output.width = size.width;
  output.height = size.height;
  const context = output.getContext('2d');
  if (!context) throw new Error('Could not merge Roto alpha frames: 2D context unavailable.');

  context.clearRect(0, 0, size.width, size.height);
  if (baseFrame) {
    const baseImage = await loadCachedRotoBaseImage(baseFrame.dataUrl);
    context.drawImage(baseImage, 0, 0, size.width, size.height);
  }
  context.drawImage(scriptAlphaCanvas, 0, 0, size.width, size.height);
  return output;
}

function loadCachedRotoBaseImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not merge cached Roto alpha frame: cached base image failed to load.'));
    image.src = dataUrl;
  });
}
