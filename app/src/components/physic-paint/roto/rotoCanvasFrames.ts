import type { BgMode, EfxPaintEngine } from '@efxlab/efx-physic-paint';
import { buildFrameBytesToken, isWebpBytes, type PhysicPaintRenderedFrame, type PhysicPaintRotoCacheFrame } from '../../../types/physicPaint';
import { hasRotoAlphaCanvasFrame, registerRotoAlphaCanvasFrame } from '../../../lib/rotoAlphaCanvasRegistry';
import { encodeWebpFrame } from '../../../lib/webpFrameCodec';
import {
  parsePhysicPaintRotoPhysicalDocument,
  type PhysicPaintRotoPhysicalDocument,
  type PhysicPaintRotoRealKeyRecord,
} from './physicsPaintRotoPhysicalModel';
import { isPhysicsPaintProfilingEnabled, recordPhysicsPaintPerformance } from '../performance/physicsPaintPerformanceTrace';
import { readRotoActiveTrack } from './rotoSaveTransactions';

export type RenderedFramePayload = PhysicPaintRenderedFrame & Partial<Pick<PhysicPaintRotoCacheFrame, 'sourceFrame' | 'displayFrame' | 'fromSourceFrame' | 'toSourceFrame' | 'interpolationT' | 'backgroundOnly' | 'onionBytes'>>;

export async function registerRotoAlphaCanvasFrameFromBytes(
  bytes: Uint8Array,
  expectedSize?: { width: number; height: number },
): Promise<void> {
  if (!isWebpBytes(bytes)) throw new Error('Canonical Roto payload is not valid WebP bytes.');
  if (expectedSize && (!Number.isInteger(expectedSize.width) || expectedSize.width <= 0 || !Number.isInteger(expectedSize.height) || expectedSize.height <= 0)) {
    throw new Error('Canonical Roto payload dimensions must be positive integers.');
  }
  if (hasRotoAlphaCanvasFrame(bytes, expectedSize)) return;

  const decoded = await decodeRotoWebpOffMainThread(bytes);
  try {
    const { width, height } = decoded;
    if (width <= 0 || height <= 0) throw new Error('Canonical Roto WebP decoded with invalid dimensions.');
    if (expectedSize && (width !== expectedSize.width || height !== expectedSize.height)) {
      throw new Error('Canonical Roto WebP dimensions do not match its physical payload.');
    }
    const canvas = document.createElement('canvas');
    canvas.width = expectedSize?.width ?? width;
    canvas.height = expectedSize?.height ?? height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canonical Roto WebP canvas is unavailable.');
    context.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);
    registerRotoAlphaCanvasFrame(bytes, canvas);
  } finally {
    decoded.release();
  }
}

interface DecodedRotoWebp {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
}

// G-52-7: in WebKit an Image's onload for a data: URL fires BEFORE the image is
// decoded — the decode then happens synchronously on the main thread at the
// first drawImage, so the Promise.allSettled fan-out in
// prepareRotoPhysicalRealKeyFrames parallelized only the waits while 15+
// photo-weight decodes serialized (~10s at launch hydration). createImageBitmap
// decodes off the main thread, making the existing fan-out truly parallel. The
// Image fallback forces the same async decode via img.decode() before any draw.
async function decodeRotoWebpOffMainThread(bytes: Uint8Array): Promise<DecodedRotoWebp> {
  const blob = new Blob([bytes.slice()], { type: 'image/webp' });
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(blob);
      return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
    } catch {
      // Fall through to the forced-decode Image path.
    }
  }
  const image = new Image();
  const blobUrl = URL.createObjectURL(blob);
  const release = (): void => {
    image.onload = null;
    image.onerror = null;
    image.src = '';
    URL.revokeObjectURL(blobUrl);
  };
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Canonical Roto WebP could not be decoded.'));
      image.src = blobUrl;
    });
    await image.decode();
    return { source: image, width: image.naturalWidth, height: image.naturalHeight, release };
  } catch {
    release();
    throw new Error('Canonical Roto WebP could not be decoded.');
  }
}

export async function prepareRotoPhysicalRealKeyFrames(
  records: readonly Pick<PhysicPaintRotoRealKeyRecord, 'keyId' | 'payload'>[],
): Promise<void> {
  const uniquePayloads = new Map<string, { bytes: Uint8Array; size: { width: number; height: number } | undefined }>();
  for (const record of records) {
    const { bytes, width, height } = record.payload;
    if (!isWebpBytes(bytes)) {
      throw new Error(`Canonical Roto key "${record.keyId}" does not contain a valid WebP payload.`);
    }
    const token = buildFrameBytesToken(bytes);
    const size = width !== undefined && height !== undefined ? { width, height } : undefined;
    const prior = uniquePayloads.get(token);
    if (prior?.size && size && (prior.size.width !== size.width || prior.size.height !== size.height)) {
      throw new Error('Canonical Roto keys disagree about shared WebP payload dimensions.');
    }
    if (!prior || (!prior.size && size)) uniquePayloads.set(token, { bytes, size });
  }
  const results = await Promise.allSettled(Array.from(
    uniquePayloads.values(),
    ({ bytes, size }) => registerRotoAlphaCanvasFrameFromBytes(bytes, size),
  ));
  const failure = results.find((result) => result.status === 'rejected');
  if (failure?.status === 'rejected') throw failure.reason;
}

export async function prepareRotoPhysicalDocumentFrames(
  value: unknown,
): Promise<PhysicPaintRotoPhysicalDocument> {
  const document = parsePhysicPaintRotoPhysicalDocument(value);
  await prepareRotoPhysicalRealKeyFrames(document.realKeyRecords);
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

export async function buildRotoFrameFromCanvas(canvas: HTMLCanvasElement, appFrame: number, size?: { width: number; height: number }): Promise<RenderedFramePayload> {
  const outputCanvas = size ? drawCanvasAtSize(canvas, size) : canvas;
  const bytes = await encodeCanvasAsWebp(outputCanvas, appFrame);
  registerRotoAlphaCanvasFrame(bytes, outputCanvas);
  return buildRenderedFramePayload(outputCanvas, appFrame, bytes);
}

export async function encodeRotoFrameFromCanvas(canvas: HTMLCanvasElement, appFrame: number, size?: { width: number; height: number }, mutationId?: number): Promise<RenderedFramePayload> {
  const outputCanvas = size ? drawCanvasAtSize(canvas, size) : canvas;
  const bytes = await encodeCanvasAsWebp(outputCanvas, appFrame, mutationId);
  registerRotoAlphaCanvasFrame(bytes, outputCanvas);
  return buildRenderedFramePayload(outputCanvas, appFrame, bytes);
}

function buildRenderedFramePayload(canvas: HTMLCanvasElement, appFrame: number, bytes: Uint8Array): RenderedFramePayload {
  return {
    frameIndex: 0,
    appFrame,
    bytes,
    width: canvas.width,
    height: canvas.height,
  };
}

/**
 * 52.1 (D-03/D-07): capture reads getImageData (the one remaining synchronous
 * readback) and invokes the Rust `encode_webp_frame` command — no synchronous
 * canvas string export, no base64.
 */
async function encodeCanvasAsWebp(canvas: HTMLCanvasElement, sourceFrame: number, mutationId?: number): Promise<Uint8Array> {
  const profiling = isPhysicsPaintProfilingEnabled();
  const encodingStartedAt = profiling ? performance.now() : 0;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not read Roto alpha frame pixels.');
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const readbackAt = profiling ? performance.now() : 0;
  if (profiling) recordPhysicsPaintPerformance({ stage: 'webp-get-image-data', category: 'async-elapsed', durationMs: readbackAt - encodingStartedAt, timestamp: readbackAt, mutationId, sourceFrame });
  try {
    const bytes = await encodeWebpFrame({ rgba: new Uint8Array(imageData.data.buffer, imageData.data.byteOffset, imageData.data.byteLength), width: canvas.width, height: canvas.height });
    const completedAt = profiling ? performance.now() : 0;
    if (profiling) recordPhysicsPaintPerformance({ stage: 'webp-encode-total', category: 'async-elapsed', durationMs: completedAt - encodingStartedAt, timestamp: completedAt, mutationId, sourceFrame });
    return bytes;
  } catch (error) {
    throw new Error(`Could not encode Roto alpha frame as WebP: ${error instanceof Error ? error.message : String(error)}`);
  }
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

export async function buildBlankRotoFrame(width: number, height: number, appFrame: number): Promise<RenderedFramePayload> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const bytes = await encodeCanvasAsWebp(canvas, appFrame);
  registerRotoAlphaCanvasFrame(bytes, canvas);
  return buildRenderedFramePayload(canvas, appFrame, bytes);
}

export async function buildRotoOutputFrame(engine: EfxPaintEngine, appFrame: number, width: number, height: number): Promise<RenderedFramePayload> {
  return buildRotoFrameFromCanvas(exportTransparentStrokeCanvas(engine), appFrame, { width, height });
}
