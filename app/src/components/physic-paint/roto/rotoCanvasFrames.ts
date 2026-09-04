import type { BgMode, EfxPaintEngine } from '@efxlab/efx-physic-paint';
import type { PhysicPaintRenderedFrame, PhysicPaintRotoCacheFrame } from '../../../types/physicPaint';
import { hasRotoAlphaCanvasFrame, registerRotoAlphaCanvasFrame } from '../../../stores/physicPaintStore';
import {
  parsePhysicPaintRotoPhysicalDocument,
  type PhysicPaintRotoPhysicalDocument,
  type PhysicPaintRotoRealKeyRecord,
} from './physicsPaintRotoPhysicalModel';
import { isPhysicsPaintProfilingEnabled, recordPhysicsPaintPerformance } from '../performance/physicsPaintPerformanceTrace';
import { readRotoActiveTrack } from './rotoSaveTransactions';

export type RenderedFramePayload = PhysicPaintRenderedFrame & Partial<Pick<PhysicPaintRotoCacheFrame, 'sourceFrame' | 'displayFrame' | 'fromSourceFrame' | 'toSourceFrame' | 'interpolationT' | 'backgroundOnly' | 'onionDataUrl'>>;

const ROTO_PNG_DATA_URL_HEADER = 'data:image/png;base64';
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;

// G-52-7: 40 base64 chars decode to 30 bytes — enough for the 8-byte PNG
// signature even with stray whitespace. Reveal-baked photo keys carry multi-MB
// bodies; atob over the full payload here was O(payload) per validation call.
const ROTO_PNG_SIGNATURE_PROBE_CHARS = 40;

export function isRotoPngDataUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const commaIndex = value.indexOf(',');
  if (commaIndex < 0 || value.slice(0, commaIndex).toLowerCase() !== ROTO_PNG_DATA_URL_HEADER) return false;
  try {
    const decoded = atob(value.slice(commaIndex + 1, commaIndex + 1 + ROTO_PNG_SIGNATURE_PROBE_CHARS).replace(/\s/g, ''));
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
  if (hasRotoAlphaCanvasFrame(dataUrl, expectedSize)) return;

  const decoded = await decodeRotoPngOffMainThread(dataUrl);
  try {
    const { width, height } = decoded;
    if (width <= 0 || height <= 0) throw new Error('Canonical Roto PNG decoded with invalid dimensions.');
    if (expectedSize && (width !== expectedSize.width || height !== expectedSize.height)) {
      throw new Error('Canonical Roto PNG dimensions do not match its physical payload.');
    }
    const canvas = document.createElement('canvas');
    canvas.width = expectedSize?.width ?? width;
    canvas.height = expectedSize?.height ?? height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canonical Roto PNG canvas is unavailable.');
    context.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);
    registerRotoAlphaCanvasFrame(dataUrl, canvas);
  } finally {
    decoded.release();
  }
}

interface DecodedRotoPng {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
}

// G-52-7: in WebKit an Image's onload for a data: URL fires BEFORE the PNG is
// decoded — the decode then happens synchronously on the main thread at the
// first drawImage, so the Promise.allSettled fan-out in
// prepareRotoPhysicalRealKeyPngs parallelized only the waits while 15+
// photo-weight decodes serialized (~10s at launch hydration). createImageBitmap
// decodes off the main thread, making the existing fan-out truly parallel. The
// Image fallback forces the same async decode via img.decode() before any draw.
async function decodeRotoPngOffMainThread(dataUrl: string): Promise<DecodedRotoPng> {
  const blob = await rotoPngDataUrlToBlob(dataUrl);
  if (blob && typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(blob);
      return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
    } catch {
      // Fall through to the forced-decode Image path.
    }
  }
  const image = new Image();
  const release = (): void => {
    image.onload = null;
    image.onerror = null;
    image.src = '';
  };
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Canonical Roto PNG could not be decoded.'));
      image.src = dataUrl;
    });
    await image.decode();
    return { source: image, width: image.naturalWidth, height: image.naturalHeight, release };
  } catch {
    release();
    throw new Error('Canonical Roto PNG could not be decoded.');
  }
}

// G-52-8 (FIX 1): native base64 decode — the platform's fetch/blob pipeline
// converts the data URL in native code instead of a per-byte JS loop (~3-4M
// iterations per photo-weight key × 15 keys, synchronously on the main thread,
// before createImageBitmap could even start).
//
// CSP note: fetch(data:) is governed by connect-src, and the packaged CSP
// (tauri.conf.json) grants no data: connect source — so in packaged builds the
// fetch rejects and we fall back to the manual byte copy, which still hands
// createImageBitmap its Blob (the G-52-7 behavior, no regression). Granting
// connect-src data: would unlock the native path in packaged builds too.
async function rotoPngDataUrlToBlob(dataUrl: string): Promise<Blob | null> {
  try {
    return await (await fetch(dataUrl)).blob();
  } catch {
    return rotoPngDataUrlToBlobManual(dataUrl);
  }
}

function rotoPngDataUrlToBlobManual(dataUrl: string): Blob | null {
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex < 0) return null;
  try {
    const binary = atob(dataUrl.slice(commaIndex + 1).replace(/\s/g, ''));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return new Blob([bytes], { type: 'image/png' });
  } catch {
    return null;
  }
}

export async function prepareRotoPhysicalRealKeyPngs(
  records: readonly Pick<PhysicPaintRotoRealKeyRecord, 'keyId' | 'payload'>[],
): Promise<void> {
  const uniquePayloads = new Map<string, { width: number; height: number } | undefined>();
  for (const record of records) {
    const { dataUrl, width, height } = record.payload;
    if (!isRotoPngDataUrl(dataUrl)) {
      throw new Error(`Canonical Roto key "${record.keyId}" does not contain a valid PNG payload.`);
    }
    const size = width !== undefined && height !== undefined ? { width, height } : undefined;
    const priorSize = uniquePayloads.get(dataUrl);
    if (priorSize && size && (priorSize.width !== size.width || priorSize.height !== size.height)) {
      throw new Error('Canonical Roto keys disagree about shared PNG payload dimensions.');
    }
    if (!uniquePayloads.has(dataUrl) || (!priorSize && size)) uniquePayloads.set(dataUrl, size);
  }
  const results = await Promise.allSettled(Array.from(
    uniquePayloads,
    ([dataUrl, size]) => registerRotoAlphaCanvasFrameFromDataUrl(dataUrl, size),
  ));
  const failure = results.find((result) => result.status === 'rejected');
  if (failure?.status === 'rejected') throw failure.reason;
}

export async function prepareRotoPhysicalDocumentPngs(
  value: unknown,
): Promise<PhysicPaintRotoPhysicalDocument> {
  const document = parsePhysicPaintRotoPhysicalDocument(value);
  await prepareRotoPhysicalRealKeyPngs(document.realKeyRecords);
  return document;
}

export function addOccupiedRotoFrame(frames: number[], frame: number): number[] {
  return [...new Set([...frames, frame])].sort((a, b) => a - b);
}

export function exportTransparentStrokeCanvas(engine: EfxPaintEngine): HTMLCanvasElement {
  const state = engine.save();
  const track = readRotoActiveTrack(state);
  const background = (track?.settings?.bgMode ?? 'transparent') as BgMode;
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
