import { describe, expect, it, vi } from 'vitest';

/**
 * quick 260913-52r (H) probe: does the launch-carried document, after the real
 * base64 transport round trip, recompute to the SAME physical revision the
 * parent runtime holds? If not, this test names the divergent side.
 */

const LAYER = 'layer-h';
const TRACK = 'track-h';

function webpBytes(seed: number, size = 4096): Uint8Array {
  const bytes = new Uint8Array(size);
  bytes.set([0x52, 0x49, 0x46, 0x46], 0);
  bytes.set([0x57, 0x45, 0x42, 0x50], 8);
  bytes.set([0x56, 0x50, 0x38, 0x4c], 12);
  for (let index = 16; index < size; index += 1) bytes[index] = (index * 31 + seed) & 0xff;
  return bytes;
}

describe('quick 260913-52r (H): launch-carried revision parity across the transport', () => {
  it('the transported records recompute to the parent runtime revision', async () => {
    vi.resetModules();
    // --- PARENT REALM: runtime holds materialized BYTES records (post-open). ---
    const parent = await import('../../../stores/physicPaintStore');
    const parentModel = await import('./physicsPaintRotoPhysicalModel');
    const webp = await import('../../../lib/webpBytes');
    const parentStore = parent.physicPaintStore;
    parentStore.reset();
    const bytesA = webpBytes(1);
    const bytesB = webpBytes(2);
    const records = [
      { kind: 'real-key', keyId: 'key-0', appFrame: 0, payload: { frameIndex: 0, appFrame: 0, bytes: bytesA, width: 1920, height: 1080 } },
      { kind: 'real-key', keyId: 'key-3', appFrame: 3, payload: { frameIndex: 0, appFrame: 3, bytes: bytesB, width: 1920, height: 1080 } },
    ];
    const interpolation = { enabled: false, mode: 'duplicate' };
    const breaks = ['key-0'];
    const seeded = parentStore.replaceRotoPhysicalDocument(LAYER, TRACK, {
      capacity: 24,
      realKeyRecords: records,
      groupOverrideRecords: [],
      interpolation,
      scriptMotion: { deformation: 0, position: 0 },
      background: null,
      selectedKeyId: 'key-3',
      cursorAppFrame: 3,
      revision: parentModel.buildPhysicPaintRotoPhysicalRevision(records as never, interpolation, [], breaks, []),
      loopClips: [],
      incomingInterpolationBreakKeyIds: breaks,
    });
    expect(seeded.ok, seeded.ok ? undefined : seeded.error).toBe(true);
    const parentDoc = parentStore.getRotoPhysicalDocument(LAYER, TRACK)!;
    const parentRevision = parentModel.buildPhysicPaintRotoPhysicalRevision(
      parentStore.getRotoRealKeyRecords(LAYER, TRACK) as never,
      parentStore.getRotoPhysicalInterpolationState(LAYER, TRACK),
      parentStore.getRotoPhysicalLoopClips(LAYER, TRACK),
      parentStore.getRotoPhysicalIncomingInterpolationBreakKeyIds(LAYER, TRACK),
      parentStore.getRotoGroupOverrideRecords(LAYER, TRACK) as never,
    );

    // The launch carrier (active track = runtime doc with capacity/cursor overrides).
    const carried = { ...parentDoc, capacity: 24, cursorAppFrame: 3 };
    // The real transport: base64 → JSON → decode.
    const wire = JSON.parse(JSON.stringify(webp.toTransportPayload(carried)));
    const received = webp.fromTransportPayload(wire) as typeof carried;

    // --- CHILD REALM: fresh module graph, install the received document. ---
    vi.resetModules();
    const child = await import('../../../stores/physicPaintStore');
    const childModel = await import('./physicsPaintRotoPhysicalModel');
    const childStore = child.physicPaintStore;
    childStore.reset();
    const installed = childStore.replaceRotoPhysicalDocument(LAYER, TRACK, received);
    expect(installed.ok, installed.ok ? undefined : installed.error).toBe(true);
    const childRevision = childModel.buildPhysicPaintRotoPhysicalRevision(
      childStore.getRotoRealKeyRecords(LAYER, TRACK) as never,
      childStore.getRotoPhysicalInterpolationState(LAYER, TRACK),
      childStore.getRotoPhysicalLoopClips(LAYER, TRACK),
      childStore.getRotoPhysicalIncomingInterpolationBreakKeyIds(LAYER, TRACK),
      childStore.getRotoGroupOverrideRecords(LAYER, TRACK) as never,
    );

    // If this fails the probe names both strings — the divergent term lives
    // in the carrier (bytes token vs media reference) or a collection.
    expect(childRevision).toBe(parentRevision);
  });
});
