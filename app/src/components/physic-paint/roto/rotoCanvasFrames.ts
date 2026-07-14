import type { BgMode, EfxPaintEngine } from '@efxlab/efx-physic-paint';
import type { PhysicPaintRenderedFrame, PhysicPaintRotoCacheFrame } from '../../../types/physicPaint';
import { registerRotoAlphaCanvasFrame } from '../../../stores/physicPaintStore';
import { isPhysicsPaintProfilingEnabled, recordPhysicsPaintPerformance } from '../performance/physicsPaintPerformanceTrace';

export type RenderedFramePayload = PhysicPaintRenderedFrame & Partial<Pick<PhysicPaintRotoCacheFrame, 'sourceFrame' | 'displayFrame' | 'fromSourceFrame' | 'toSourceFrame' | 'interpolationT' | 'backgroundOnly' | 'onionDataUrl'>>;

export function addOccupiedRotoFrame(frames: number[], frame: number): number[] {
  return [...new Set([...frames, frame])].sort((a, b) => a - b);
}

export function exportTransparentStrokeCanvas(engine: EfxPaintEngine): HTMLCanvasElement {
  const state = engine.save();
  const background = state.settings.bgMode as BgMode;
  try {
    engine.setBgMode('transparent');
    return engine.exportCompositeCanvas();
  } finally {
    engine.setBgMode(background);
    engine.load(state);
  }
}

export function buildRotoFrameFromCanvas(canvas: HTMLCanvasElement, appFrame: number, size?: { width: number; height: number }): RenderedFramePayload {
  const outputCanvas = size ? drawCanvasAtSize(canvas, size) : canvas;
  const dataUrl = outputCanvas.toDataURL('image/png');
  registerRotoAlphaCanvasFrame(dataUrl, outputCanvas);
  return buildRenderedFramePayload(outputCanvas, appFrame, dataUrl);
}

export async function encodeRotoFrameFromCanvas(canvas: HTMLCanvasElement, appFrame: number, size?: { width: number; height: number }, mutationId?: number): Promise<RenderedFramePayload> {
  const outputCanvas = size ? drawCanvasAtSize(canvas, size) : canvas;
  const dataUrl = await encodeCanvasAsPng(outputCanvas, appFrame, mutationId);
  registerRotoAlphaCanvasFrame(dataUrl, outputCanvas);
  return buildRenderedFramePayload(outputCanvas, appFrame, dataUrl);
}

function buildRenderedFramePayload(canvas: HTMLCanvasElement, appFrame: number, dataUrl: string): RenderedFramePayload {
  return {
    frameIndex: 0,
    appFrame,
    dataUrl,
    width: canvas.width,
    height: canvas.height,
  };
}

function encodeCanvasAsPng(canvas: HTMLCanvasElement, sourceFrame: number, mutationId?: number): Promise<string> {
  const profiling = isPhysicsPaintProfilingEnabled();
  const encodingStartedAt = profiling ? performance.now() : 0;
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      const blobReadyAt = profiling ? performance.now() : 0;
      if (profiling) recordPhysicsPaintPerformance({ stage: 'png-to-blob', category: 'async-elapsed', durationMs: blobReadyAt - encodingStartedAt, timestamp: blobReadyAt, mutationId, sourceFrame });
      if (!blob) {
        reject(new Error('Could not encode Roto alpha frame as PNG.'));
        return;
      }
      const readerStartedAt = profiling ? performance.now() : 0;
      const reader = new FileReader();
      reader.onload = () => {
        const completedAt = profiling ? performance.now() : 0;
        if (profiling) {
          recordPhysicsPaintPerformance({ stage: 'png-file-reader', category: 'async-elapsed', durationMs: completedAt - readerStartedAt, timestamp: completedAt, mutationId, sourceFrame });
          recordPhysicsPaintPerformance({ stage: 'png-encode-total', category: 'async-elapsed', durationMs: completedAt - encodingStartedAt, timestamp: completedAt, mutationId, sourceFrame });
        }
        if (typeof reader.result === 'string') resolve(reader.result);
        else reject(new Error('Could not read encoded Roto alpha frame.'));
      };
      reader.onerror = () => reject(new Error('Could not read encoded Roto alpha frame.'));
      reader.readAsDataURL(blob);
    }, 'image/png');
  });
}

export function drawCanvasAtSize(canvas: HTMLCanvasElement, size: { width: number; height: number }): HTMLCanvasElement {
  if (canvas.width === size.width && canvas.height === size.height) return canvas;
  const output = document.createElement('canvas');
  output.width = size.width;
  output.height = size.height;
  const context = output.getContext('2d');
  context?.drawImage(canvas, 0, 0, size.width, size.height);
  return output;
}

export function buildBlankRotoFrame(width: number, height: number, appFrame: number): RenderedFramePayload {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return buildRotoFrameFromCanvas(canvas, appFrame);
}

export function buildRotoOutputFrame(engine: EfxPaintEngine, appFrame: number, width: number, height: number): RenderedFramePayload {
  return buildRotoFrameFromCanvas(exportTransparentStrokeCanvas(engine), appFrame, { width, height });
}
