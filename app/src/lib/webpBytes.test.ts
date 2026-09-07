import { describe, expect, it } from 'vitest';
import { base64ToWebpBytes, bytesToBase64, fromTransportPayload, toTransportPayload } from './webpBytes';
import { testWebpBytes } from '../testUtils/testWebpBytes';

describe('webpBytes transport boundary', () => {
  it('round-trips frame bytes through base64 without loss', () => {
    const bytes = testWebpBytes('transport-round-trip');
    const encoded = bytesToBase64(bytes);
    const decoded = base64ToWebpBytes(encoded);

    expect(decoded).not.toBeNull();
    expect(decoded).toEqual(bytes);
  });

  it('rejects non-WebP base64 and malformed strings', () => {
    expect(base64ToWebpBytes('bm90LXdlYnA=')).toBeNull(); // "not-webp"
    expect(base64ToWebpBytes('!!!not-base64!!!')).toBeNull();
  });

  it('converts Uint8Array fields to base64 and back across a JSON hop', () => {
    const bytes = testWebpBytes('json-hop');
    const payload = {
      operationId: 'op-1',
      records: [{ keyId: 'A', payload: { frameIndex: 0, appFrame: 1, bytes } }],
    };

    // Simulate emitTo: JSON.stringify turns Uint8Array into an index object
    // unless the transport transform runs first.
    const transported = JSON.parse(JSON.stringify(toTransportPayload(payload)));
    expect(typeof transported.records[0].payload.bytes).toBe('string');

    const restored = fromTransportPayload(transported) as typeof payload;
    expect(restored.records[0].payload.bytes).toEqual(bytes);
    expect(restored.operationId).toBe('op-1');
  });

  it('leaves ordinary string fields untouched on the way back', () => {
    const restored = fromTransportPayload({ operationId: 'op-1', keyId: 'A' });
    expect(restored).toEqual({ operationId: 'op-1', keyId: 'A' });
  });
});
