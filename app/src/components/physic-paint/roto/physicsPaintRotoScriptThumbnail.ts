import type { PhysicPaintRotoBackgroundMetadata } from '../../../types/physicPaint';
import { getProjectPaperCanvas, subscribeProjectPaperCanvas } from '../../../lib/projectPaperRaster';
import type { PersistedRotoScriptThumbnailV1 } from './physicsPaintRotoScriptSchema';
import { ROTO_SCRIPT_LIMITS } from './physicsPaintRotoScriptSchema';

const WEBP_QUALITY = 0.8;

export interface RotoScriptThumbnailNativeEncoder {
  encodeWebp(input: { width: number; height: number; quality: number; rgba: Uint8Array }): Promise<{ width: number; height: number; mimeType: 'image/webp'; bytes: Uint8Array }>;
}

/**
 * 261026-nvq: how the script canvas composites over the thumbnail's flat fill
 * and paper. Aquarelle sheets are MODE.transparent OPAQUE transmittance (white
 * = no pigment, alpha 255) and must MULTIPLY — the same law as the live seam
 * (.aquarelle-live-canvas / .aquarelle-cached-base) and the frame-cache merge
 * (`mergeBlend: 'multiply'`). Engine-1 `copyLiveAlphaCanvas` is a
 * transparent-backed alpha canvas and stays source-over.
 */
export type RotoScriptThumbnailComposite = 'source-over' | 'multiply';

export async function createRotoScriptThumbnail(input: {
  scriptAlphaCanvas: HTMLCanvasElement;
  sourceWidth: number;
  sourceHeight: number;
  background: PhysicPaintRotoBackgroundMetadata;
  nativeEncoder?: RotoScriptThumbnailNativeEncoder;
  scriptComposite?: RotoScriptThumbnailComposite;
}): Promise<PersistedRotoScriptThumbnailV1> {
  const { width, height } = fitThumbnail(input.sourceWidth, input.sourceHeight);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('WebP thumbnail canvas is unavailable');
  context.fillStyle = input.background.background === 'white' || input.background.background === 'transparent'
    ? '#ffffff'
    : input.background.color ?? '#ffffff';
  context.fillRect(0, 0, width, height);
  // 261017-lny: paper/* ids (procedural library + real scans) paint the sheet
  // under the script too — a flat wash left paint on white (density bug).
  // getProjectPaperCanvas already returns the opaque procedural sheet.
  const paperId = input.background.background;
  if (paperId.startsWith('canvas') || paperId.startsWith('paper/')) {
    const paper = await resolveProjectPaperCanvas(
      paperId,
      width,
      height,
      input.background.grainScale ?? 1,
    );
    if (!paper) throw new Error('Required paper texture is unavailable');
    context.drawImage(paper, 0, 0, width, height);
  }
  // 261026-nvq: the aquarelle sheet is OPAQUE transmittance — draw it with the
  // requested blend so white (no pigment) leaves the background intact. The
  // default keeps the engine-1 alpha canvas byte-identical (source-over).
  context.globalCompositeOperation = input.scriptComposite ?? 'source-over';
  context.drawImage(input.scriptAlphaCanvas, 0, 0, width, height);
  let bytes: Uint8Array;
  if (input.nativeEncoder) {
    const imageData = context.getImageData(0, 0, width, height);
    const rgba = new Uint8Array(imageData.data.buffer, imageData.data.byteOffset, imageData.data.byteLength);
    if (rgba.byteLength !== width * height * 4) throw new Error('Thumbnail RGBA payload has an invalid size');
    const encoded = await input.nativeEncoder.encodeWebp({ width, height, quality: WEBP_QUALITY, rgba });
    if (encoded.mimeType !== 'image/webp' || encoded.width !== width || encoded.height !== height) throw new Error('Native WebP encoder returned invalid metadata');
    bytes = encoded.bytes;
  } else {
    const blob = await canvasToBlob(canvas, 'image/webp', WEBP_QUALITY);
    if (!blob || blob.type !== 'image/webp') throw new Error('Actual WebP encoding is unavailable in this browser');
    bytes = new Uint8Array(await blob.arrayBuffer());
  }
  if (bytes.length > ROTO_SCRIPT_LIMITS.thumbnailBytes || !hasWebpSignature(bytes)) throw new Error('WebP thumbnail validation failed');
  return {
    mimeType: 'image/webp',
    width,
    height,
    quality: WEBP_QUALITY,
    dataUrl: `data:image/webp;base64,${bytesToBase64(bytes)}`,
  };
}

export async function measureRotoScriptWebpSupport(): Promise<{ supported: boolean; mimeType: string | null; size: number; signature: string | null }> {
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 2;
  canvas.getContext('2d', { willReadFrequently: true })?.fillRect(0, 0, 2, 2);
  const blob = await canvasToBlob(canvas, 'image/webp', WEBP_QUALITY);
  if (!blob) return { supported: false, mimeType: null, size: 0, signature: null };
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return { supported: blob.type === 'image/webp' && hasWebpSignature(bytes), mimeType: blob.type, size: bytes.length, signature: ascii(bytes.slice(0, 12)) };
}

function resolveProjectPaperCanvas(
  paperTexture: string,
  width: number,
  height: number,
  grainScale = 1,
): Promise<HTMLCanvasElement | null> {
  const ready = getProjectPaperCanvas(paperTexture, width, height, grainScale);
  if (ready) return Promise.resolve(ready);
  return new Promise((resolve) => {
    let settled = false;
    let unsubscribe = () => {};
    // globalThis (not window) so the fail-soft timeout works in any host.
    const timeout = globalThis.setTimeout(() => {
      if (settled) return;
      settled = true;
      unsubscribe();
      resolve(null);
    }, 5_000);
    unsubscribe = subscribeProjectPaperCanvas(paperTexture, width, height, (canvas) => {
      if (!canvas || settled) return;
      settled = true;
      globalThis.clearTimeout(timeout);
      unsubscribe();
      resolve(canvas);
    }, grainScale);
  });
}

function fitThumbnail(width: number, height: number): { width: number; height: number } {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw new Error('Invalid script canvas dimensions');
  const scale = Math.min(ROTO_SCRIPT_LIMITS.thumbnailWidth / width, ROTO_SCRIPT_LIMITS.thumbnailHeight / height);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}
function hasWebpSignature(bytes: Uint8Array): boolean { return bytes.length >= 12 && ascii(bytes.slice(0, 4)) === 'RIFF' && ascii(bytes.slice(8, 12)) === 'WEBP'; }
function ascii(bytes: Uint8Array): string { return String.fromCharCode(...bytes); }
function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
