/**
 * 52.1 (D-05/D-18): self-contained WebP byte helpers. Kept in a leaf module so
 * both `types/physicPaint.ts` and `physicsPaintRotoPhysicalModel.ts` can import
 * them without a module-body cycle (the two import each other's validators).
 */

const WEBP_RIFF = [0x52, 0x49, 0x46, 0x46] as const; // "RIFF"
const WEBP_TAG = [0x57, 0x45, 0x42, 0x50] as const; // "WEBP" (offset 8)
const WEBP_VP8L = [0x56, 0x50, 0x38, 0x4c] as const; // "VP8L" (offset 12, lossless)
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;

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
 * PNG signature probe: accepts a `Uint8Array` whose first 8 bytes are the PNG
 * magic signature. Display-only derived frames (interpolation blends) are PNG
 * (the two-format law — real keys are VP8L-only); this probe lets the
 * reference controller accept them without feeding them to the Rust WebP
 * decoder.
 */
export function isPngBytes(value: unknown): value is Uint8Array {
  if (!(value instanceof Uint8Array)) return false;
  if (value.length < 8) return false;
  return PNG_SIGNATURE.every((byte, index) => value[index] === byte);
}

/**
 * Encode raw bytes as a base64 string. Lookup-table 3→4 encode with a chunked
 * output array — the prior `String.fromCharCode(...spread)` + `btoa` path was
 * ~180–400ms for a 10MB frame payload (the per-action transport bottleneck).
 */
const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function bytesToBase64(bytes: Uint8Array): string {
  const length = bytes.length;
  const output: string[] = [];
  for (let index = 0; index < length; index += 3) {
    const b0 = bytes[index];
    const b1 = index + 1 < length ? bytes[index + 1] : 0;
    const b2 = index + 2 < length ? bytes[index + 2] : 0;
    output.push(
      BASE64_ALPHABET[b0 >> 2]
      + BASE64_ALPHABET[((b0 & 3) << 4) | (b1 >> 4)]
      + (index + 1 < length ? BASE64_ALPHABET[((b1 & 15) << 2) | (b2 >> 6)] : '=')
      + (index + 2 < length ? BASE64_ALPHABET[b2 & 63] : '='),
    );
  }
  return output.join('');
}

/**
 * Decode a base64 string back to raw bytes ONLY when the decoded payload is a
 * valid WebP RIFF/VP8L frame. Returns null for non-base64, non-WebP, or
 * malformed input — the transport boundary uses this to distinguish the
 * `bytes`/`onionBytes` fields (which cross JSON as base64) from ordinary
 * string fields (operation IDs, key IDs) that must never be decoded.
 */
export function base64ToWebpBytes(value: string): Uint8Array | null {
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return isWebpBytes(bytes) ? bytes : null;
  } catch {
    return null;
  }
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

/**
 * 52.1 (D-05) transport boundary: Tauri `emitTo` serializes event payloads as
 * JSON, and `JSON.stringify` turns a `Uint8Array` into an index object
 * (`{"0":82,"1":73,...}`) — the parent-side validators then reject the frame
 * bytes and the physical edit / cache apply silently fails. These two deep
 * transforms convert every `Uint8Array` (the `bytes`/`onionBytes` fields) to
 * base64 on the way out and back to `Uint8Array` on the way in, so the raw
 * bytes survive the JSON hop without changing the in-memory payload shape.
 */
export function toTransportPayload(value: unknown): unknown {
  return toTransportPayloadInner(value);
}

function toTransportPayloadInner(value: unknown): unknown {
  if (value instanceof Uint8Array) return bytesToBase64(value);
  if (Array.isArray(value)) return value.map(toTransportPayloadInner);
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) result[key] = toTransportPayloadInner(entry);
    return result;
  }
  return value;
}

export function fromTransportPayload(value: unknown): unknown {
  return fromTransportPayloadInner(value);
}

function fromTransportPayloadInner(value: unknown): unknown {
  if (value instanceof Uint8Array) return value;
  if (typeof value === 'string') {
    const bytes = base64ToWebpBytes(value);
    if (bytes) return bytes;
  }
  if (Array.isArray(value)) return value.map(fromTransportPayloadInner);
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) result[key] = fromTransportPayloadInner(entry);
    return result;
  }
  return value;
}
