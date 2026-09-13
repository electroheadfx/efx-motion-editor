import { describe, expect, it } from 'vitest';
import { testWebpBytes } from '../../../testUtils/testWebpBytes';
import {
  buildPhysicPaintRotoPhysicalRevision,
  buildPhysicPaintRotoPhysicalTermDigests,
  countPhysicPaintRotoPayloadShapes,
  type PhysicPaintRotoRealKeyPayload,
} from './physicsPaintRotoPhysicalModel';

/**
 * quick-260913-52r (E): the staging gate compares a parent-computed revision
 * against a child-computed one. These builders back the failure diagnostic —
 * and pin the hazard they exist to expose: the fingerprint's raster term is
 * carrier-shaped (media digest vs byte content token), so equal content under
 * different carriers fingerprints differently across realms.
 */

interface TestRecord {
  readonly kind: 'real-key';
  readonly keyId: string;
  readonly appFrame: number;
  readonly payload: PhysicPaintRotoRealKeyPayload;
}

function bytesRecord(keyId: string, appFrame: number, seed: string): TestRecord {
  return {
    kind: 'real-key',
    keyId,
    appFrame,
    payload: {
      frameIndex: 0,
      appFrame,
      bytes: testWebpBytes(seed),
      width: 4,
      height: 4,
    },
  };
}

function mediaRecord(keyId: string, appFrame: number, digest: string): TestRecord {
  return {
    kind: 'real-key',
    keyId,
    appFrame,
    payload: {
      frameIndex: 0,
      appFrame,
      media: { relativePath: `frames/layer/${keyId}.webp`, digest },
      width: 4,
      height: 4,
    },
  };
}

const INTERPOLATION = { enabled: false, mode: 'duplicate' as const };

describe('quick-260913-52r: physical revision term digests (E diagnostic)', () => {
  it('produces one stable digest per term for identical inputs', () => {
    const records = [bytesRecord('key-a', 0, 'a'), bytesRecord('key-b', 1, 'b')];
    const first = buildPhysicPaintRotoPhysicalTermDigests(records, INTERPOLATION, []);
    const second = buildPhysicPaintRotoPhysicalTermDigests(
      [bytesRecord('key-b', 1, 'b'), bytesRecord('key-a', 0, 'a')],
      INTERPOLATION,
      [],
    );
    expect(second).toEqual(first);
    expect(Object.keys(first).sort()).toEqual(
      ['groupOverrides', 'incomingBreaks', 'interpolation', 'loopClips', 'records'],
    );
  });

  it('moves only the records digest when a record changes', () => {
    const base = [bytesRecord('key-a', 0, 'a')];
    const changed = [bytesRecord('key-a', 0, 'CHANGED')];
    const before = buildPhysicPaintRotoPhysicalTermDigests(base, INTERPOLATION, []);
    const after = buildPhysicPaintRotoPhysicalTermDigests(changed, INTERPOLATION, []);
    expect(after.records).not.toBe(before.records);
    expect(after.interpolation).toBe(before.interpolation);
    expect(after.loopClips).toBe(before.loopClips);
    expect(after.incomingBreaks).toBe(before.incomingBreaks);
    expect(after.groupOverrides).toBe(before.groupOverrides);
  });

  it('moves only the interpolation digest when the canonical state changes', () => {
    const records = [bytesRecord('key-a', 0, 'a')];
    const before = buildPhysicPaintRotoPhysicalTermDigests(records, INTERPOLATION, []);
    const after = buildPhysicPaintRotoPhysicalTermDigests(records, { enabled: true, mode: 'duplicate' }, []);
    expect(after.interpolation).not.toBe(before.interpolation);
    expect(after.records).toBe(before.records);
  });

  it('pins the carrier-shape hazard: equal content, different carrier, different revision', () => {
    const digest = 'd'.repeat(64);
    const bytesCarrier = [bytesRecord('key-a', 0, 'a')];
    const mediaCarrier = [mediaRecord('key-a', 0, digest)];
    // Same logical key/content identity, different raster carrier: the
    // fingerprint separates them, which is exactly why a cross-realm
    // revision equality also demands carrier equality.
    expect(buildPhysicPaintRotoPhysicalRevision(mediaCarrier, INTERPOLATION, []))
      .not.toBe(buildPhysicPaintRotoPhysicalRevision(bytesCarrier, INTERPOLATION, []));
    expect(buildPhysicPaintRotoPhysicalTermDigests(mediaCarrier, INTERPOLATION, []).records)
      .not.toBe(buildPhysicPaintRotoPhysicalTermDigests(bytesCarrier, INTERPOLATION, []).records);
  });

  it('counts payload carriers per collection', () => {
    const bothBase = bytesRecord('both', 2, 'z');
    const bothRecord: TestRecord = {
      ...bothBase,
      payload: {
        ...bothBase.payload,
        media: { relativePath: 'frames/layer/both.webp', digest: 'a'.repeat(64) },
      },
    };
    const counts = countPhysicPaintRotoPayloadShapes([
      bytesRecord('bytes-only', 0, 'x'),
      mediaRecord('media-only', 1, 'f'.repeat(64)),
      bothRecord,
    ]);
    expect(counts).toEqual({ bytesOnly: 1, mediaOnly: 1, both: 1 });
  });
});
