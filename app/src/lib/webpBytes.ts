/**
 * 52.1 (D-05/D-18): self-contained WebP byte helpers. Kept in a leaf module so
 * both `types/physicPaint.ts` and `physicsPaintRotoPhysicalModel.ts` can import
 * them without a module-body cycle (the two import each other's validators).
 */

const WEBP_RIFF = [0x52, 0x49, 0x46, 0x46] as const; // "RIFF"
const WEBP_TAG = [0x57, 0x45, 0x42, 0x50] as const; // "WEBP" (offset 8)
const WEBP_VP8L = [0x56, 0x50, 0x38, 0x4c] as const; // "VP8L" (offset 12, lossless)

/**
 * WebP RIFF/VP8L byte probe: accepts a `Uint8Array` whose bytes 0-3 are RIFF,
 * bytes 8-11 are WEBP, and bytes 12-15 are VP8L for lossless. Rejects PNG,
 * lossy WebP (VP8), and non-array values.
 */
export function isWebpBytes(value: unknown): value is Uint8Array {
  if (!(value instanceof Uint8Array)) return false;
  if (value.length < 16) return false;
  return WEBP_RIFF.every((byte, index) => value[index] === byte)
    && WEBP_TAG.every((byte, index) => value[8 + index] === byte)
    && WEBP_VP8L.every((byte, index) => value[12 + index] === byte);
}

/**
 * O(1) content token over frame bytes (G-52-6 pattern): length + head-64 +
 * tail-64 hex. Change-safe for same-encoder WebP output (deflate streams have
 * no resync points) and never a full-payload scan.
 */
export function buildFrameBytesToken(bytes: Uint8Array): string {
  const head = bytes.subarray(0, 64);
  const tail = bytes.subarray(Math.max(0, bytes.length - 64));
  let headHex = '';
  for (let index = 0; index < head.length; index += 1) headHex += head[index].toString(16).padStart(2, '0');
  let tailHex = '';
  for (let index = 0; index < tail.length; index += 1) tailHex += tail[index].toString(16).padStart(2, '0');
  return `${bytes.length}:${headHex}:${tailHex}`;
}
