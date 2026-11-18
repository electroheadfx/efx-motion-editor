import { describe, expect, it } from 'vitest';
import { hasUsableFrameBytes } from './aquarelleFrameBytes';

describe('hasUsableFrameBytes', () => {
  it('refuses a REFERENCE-ONLY record (bytes undefined) without throwing', () => {
    // The exact runtime state that crashed the capture: a frame object exists,
    // its package media never materialized, so bytes is undefined.
    expect(hasUsableFrameBytes({}, 256)).toBe(false);
    expect(hasUsableFrameBytes({ bytes: undefined }, 256)).toBe(false);
    expect(hasUsableFrameBytes({ bytes: null }, 256)).toBe(false);
  });

  it('refuses absent payloads', () => {
    expect(hasUsableFrameBytes(null, 256)).toBe(false);
    expect(hasUsableFrameBytes(undefined, 256)).toBe(false);
  });

  it('refuses placeholders at or below the threshold and accepts real bytes', () => {
    expect(hasUsableFrameBytes({ bytes: new Uint8Array(0) }, 256)).toBe(false);
    expect(hasUsableFrameBytes({ bytes: new Uint8Array(256) }, 256)).toBe(false);
    expect(hasUsableFrameBytes({ bytes: new Uint8Array(257) }, 256)).toBe(true);
  });

  it('is a guard, not a coercion: an empty byte array is not pixels', () => {
    expect(hasUsableFrameBytes({ bytes: new Uint8Array(0) })).toBe(false);
    expect(hasUsableFrameBytes({ bytes: new Uint8Array(1) })).toBe(true);
  });
});
