/**
 * 52.1 (D-05): test fixture helper — a deterministic Uint8Array carrying the
 * WebP RIFF/VP8L magic bytes (valid per `isWebpBytes`) with the seed's bytes
 * appended so distinct seeds produce distinct content tokens.
 */
export function testWebpBytes(seed = ''): Uint8Array {
  const bytes = new Uint8Array(32 + seed.length);
  bytes.set([0x52, 0x49, 0x46, 0x46], 0); // RIFF
  bytes.set([0x57, 0x45, 0x42, 0x50], 8); // WEBP
  bytes.set([0x56, 0x50, 0x38, 0x4c], 12); // VP8L
  for (let index = 0; index < seed.length; index += 1) bytes[32 + index] = seed.charCodeAt(index) & 0xff;
  return bytes;
}

/**
 * 52.1 (D-05): test fixture helper — a deterministic Uint8Array carrying the
 * PNG magic signature (valid per `isPngBytes`) with the seed's bytes appended.
 * Used for the display-only blend path, which derives PNG via canvasToPngBytes.
 */
export function testPngBytes(seed = ''): Uint8Array {
  const bytes = new Uint8Array(8 + seed.length);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0); // PNG signature
  for (let index = 0; index < seed.length; index += 1) bytes[8 + index] = seed.charCodeAt(index) & 0xff;
  return bytes;
}
