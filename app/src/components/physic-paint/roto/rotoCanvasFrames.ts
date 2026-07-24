import type { BgMode, EfxPaintEngine } from '@efxlab/efx-physic-paint';
import type { PhysicPaintRenderedFrame, PhysicPaintRotoCacheFrame } from '../../../types/physicPaint';
import { registerRotoAlphaCanvasFrame } from '../../../stores/physicPaintStore';
import { isPhysicsPaintProfilingEnabled, recordPhysicsPaintPerformance } from '../performance/physicsPaintPerformanceTrace';

export type RenderedFramePayload = PhysicPaintRenderedFrame & Partial<Pick<PhysicPaintRotoCacheFrame, 'sourceFrame' | 'displayFrame' | 'fromSourceFrame' | 'toSourceFrame' | 'interpolationT' | 'backgroundOnly' | 'onionDataUrl'>>;

const ROTO_PNG_DATA_URL_HEADER = 'data:image/png;base64';
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;

export function isRotoPngDataUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const commaIndex = value.indexOf(',');
  if (commaIndex < 0 || value.slice(0, commaIndex).toLowerCase() !== ROTO_PNG_DATA_URL_HEADER) return false;
  try {
    const decoded = atob(value.slice(commaIndex + 1).replace(/\s/g, ''));
    return decoded.length >= PNG_SIGNATURE.length
      && PNG_SIGNATURE.every((byte, index) => decoded.charCodeAt(index) === byte);
  } catch {
    return false;
  }
}

export async function registerRotoAlphaCanvasFrameFromDataUrl(
  dataUrl: string,
  expectedSize?: { width: number; height: number },
): Promise<void> {
  if (!isRotoPngDataUrl(dataUrl)) throw new Error('Canonical Roto payload is not a valid PNG data URL.');
  if (expectedSize && (!Number.isInteger(expectedSize.width) || expectedSize.width <= 0 || !Number.isInteger(expectedSize.height) || expectedSize.height <= 0)) {
    throw new Error('Canonical Roto payload dimensions must be positive integers.');
  }

  const image = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Canonical Roto PNG could not be decoded.'));
      image.src = dataUrl;
    });
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    if (width <= 0 || height <= 0) throw new Error('Canonical Roto PNG decoded with invalid dimensions.');
    if (expectedSize && (width !== expectedSize.width || height !== expectedSize.height)) {
      throw new Error('Canonical Roto PNG dimensions do not match its physical payload.');
    }
    const canvas = document.createElement('canvas');
    canvas.width = expectedSize?.width ?? width;
    canvas.height = expectedSize?.height ?? height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canonical Roto PNG canvas is unavailable.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    registerRotoAlphaCanvasFrame(dataUrl, canvas);
  } finally {
    image.onload = null;
    image.onerror = null;
    image.src = '';
  }
}

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
