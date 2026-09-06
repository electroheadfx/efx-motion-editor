/**
 * 52.1 (D-06): the Roto alpha-canvas registry, keyed by the frame's stable
 * bytes content token (never the dying dataUrl string). Kept in a leaf module
 * so `rotoCanvasFrames.ts` can register/query canvases without importing
 * `physicPaintStore.ts` (which imports the reveal renderer, which imports
 * `rotoCanvasFrames.ts` — a module-body cycle).
 */
import { buildFrameBytesToken } from './webpBytes';

export const rotoAlphaCanvasRegistry = new Map<string, HTMLCanvasElement>();

// G-52-10 ownership law: registration ADOPTS the canvas for the session — the
// compositor's FIX 3 branch draws from it directly, so once registered a caller
// must never release, resize, or mutate it (same lifetime as hydration entries).
export function registerRotoAlphaCanvasFrame(bytes: Uint8Array, canvas: HTMLCanvasElement): void {
  if (!(bytes instanceof Uint8Array) || canvas.width <= 0 || canvas.height <= 0) return;
  rotoAlphaCanvasRegistry.set(buildFrameBytesToken(bytes), canvas);
}

export function hasRotoAlphaCanvasFrame(
  bytes: Uint8Array,
  expectedSize?: { width: number; height: number },
): boolean {
  const canvas = rotoAlphaCanvasRegistry.get(buildFrameBytesToken(bytes));
  // G-52-10: a zero-size entry (a registered canvas a caller later released or
  // resized) is treated as absent so a fresh registration can overwrite it.
  if (!canvas || canvas.width <= 0 || canvas.height <= 0) return false;
  return !expectedSize
    || (canvas.width === expectedSize.width && canvas.height === expectedSize.height);
}

/**
 * Synchronous canvas → WebP-lossless bytes via the browser's own encoder
 * (toDataURL + atob). The store's regeneration API is synchronous; the async
 * Rust encoder would ripple through the whole store mutation API. The base64
 * payload is a browser-API boundary conversion, never transported.
 */
export function canvasToWebpBytes(canvas: HTMLCanvasElement): Uint8Array | null {
  try {
    const dataUrl = canvas.toDataURL('image/webp');
    const comma = dataUrl.indexOf(',');
    if (comma < 0) return null;
    const binary = atob(dataUrl.slice(comma + 1));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  } catch {
    return null;
  }
}
