import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { FrameMediaReference } from '../../../lib/efxPaintPackage';
import { buildFrameMediaRelativePath } from '../../../lib/efxPaintPackage';
import type { PhysicPaintRotoRealKeyRecord } from './physicsPaintRotoPhysicalModel';
import {
  isPhysicPaintRotoPersistedRealKeyPayload,
  isPhysicPaintRotoRealKeyPayload,
} from './physicsPaintRotoPhysicalModel';
import { toPersistedRotoRecords, toRuntimeRotoRecords } from './physicsPaintRotoMediaProjection';
import { testWebpBytes } from '../../../testUtils/testWebpBytes';

// 52.2-06: the projection is collection-agnostic — `realKeyRecords` and
// `groupOverrideRecords` share `PhysicPaintRotoRealKeyRecord`, so every case
// below applies to whichever collection the call site supplies.
const TEST_LAYER_ID = 'layer-1';

function runtimeRecord(
  keyId: string,
  appFrame: number,
  options: { frameIndex?: number; width?: number; height?: number } = {},
): PhysicPaintRotoRealKeyRecord {
  const frameIndex = options.frameIndex ?? 0;
  const width = options.width ?? 8;
  const height = options.height ?? 8;
  return Object.freeze({
    kind: 'real-key',
    keyId,
    appFrame,
    payload: Object.freeze({
      frameIndex,
      appFrame,
      bytes: testWebpBytes(keyId),
      width,
      height,
    }),
  });
}

function mediaReference(keyId: string, digestCharacter = 'a'): FrameMediaReference {
  return Object.freeze({
    relativePath: buildFrameMediaRelativePath(TEST_LAYER_ID, keyId),
    digest: digestCharacter.repeat(64),
    width: 8,
    height: 8,
  });
}

function resolverFrom(
  references: Readonly<Record<string, FrameMediaReference>>,
): (keyId: string) => FrameMediaReference | undefined {
  return (keyId) => references[keyId];
}

function payloadKeys(payload: object): string[] {
  return Object.keys(payload).sort();
}

describe('physicsPaintRotoMediaProjection', () => {
  describe('toPersistedRotoRecords', () => {
    it('emits a media reference and no raster field at all', () => {
      const records = [runtimeRecord('key-a', 4)];
      const result = toPersistedRotoRecords(records, resolverFrom({ 'key-a': mediaReference('key-a') }));

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('expected a projected collection');
      expect(result.records).toHaveLength(1);
      const persisted = result.records[0]!;
      expect(payloadKeys(persisted.payload)).toEqual(['appFrame', 'frameIndex', 'height', 'media', 'width']);
      expect('bytes' in persisted.payload).toBe(false);
      expect(persisted.payload.media?.digest).toBe('a'.repeat(64));
      expect(persisted.payload.media?.relativePath).toBe('frames/layer-1/key-a.webp');
      // T-52.2-19: the projection's output satisfies BOTH fail-closed guards —
      // the persisted shape admits it and the runtime shape does too.
      expect(isPhysicPaintRotoPersistedRealKeyPayload(persisted.payload)).toBe(true);
      expect(isPhysicPaintRotoRealKeyPayload(persisted.payload)).toBe(true);
    });

    it('omits width and height when the runtime payload carried none', () => {
      const record: PhysicPaintRotoRealKeyRecord = Object.freeze({
        kind: 'real-key',
        keyId: 'key-nodims',
        appFrame: 2,
        payload: Object.freeze({ frameIndex: 1, appFrame: 2, bytes: testWebpBytes('key-nodims') }),
      });
      const result = toPersistedRotoRecords([record], resolverFrom({ 'key-nodims': mediaReference('key-nodims') }));

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('expected a projected collection');
      expect(payloadKeys(result.records[0]!.payload)).toEqual(['appFrame', 'frameIndex', 'media']);
    });

    it('fails with a typed failure naming the keyId when a runtime key has no resolved reference', () => {
      const records = [runtimeRecord('key-a', 4), runtimeRecord('key-b', 9)];
      const result = toPersistedRotoRecords(records, resolverFrom({ 'key-a': mediaReference('key-a') }));

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('expected a typed failure');
      expect(result.failure.kind).toBe('unresolved-media-reference');
      expect(result.failure.keyId).toBe('key-b');
      // Fail closed: never a partial collection, never a record without media.
      expect('records' in result).toBe(false);
    });

    it('keeps two records with the same keyId but different digests distinguishable', () => {
      let call = 0;
      const resolve = (): FrameMediaReference => {
        call += 1;
        return mediaReference('key-dup', call === 1 ? 'a' : 'b');
      };
      const result = toPersistedRotoRecords([runtimeRecord('key-dup', 1), runtimeRecord('key-dup', 5)], resolve);

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('expected a projected collection');
      expect(result.records).toHaveLength(2);
      expect(result.records[0]!.payload.media?.digest).toBe('a'.repeat(64));
      expect(result.records[1]!.payload.media?.digest).toBe('b'.repeat(64));
    });
  });

  describe('toRuntimeRotoRecords', () => {
    it('returns media-carrying records and allocates no byte buffer', () => {
      const result = toPersistedRotoRecords(
        [runtimeRecord('key-a', 4)],
        resolverFrom({ 'key-a': mediaReference('key-a') }),
      );
      if (!result.ok) throw new Error('expected a projected collection');

      const runtime = toRuntimeRotoRecords(result.records);

      expect(runtime).toHaveLength(1);
      const payload = runtime[0]!.payload;
      expect(payloadKeys(payload)).toEqual(['appFrame', 'frameIndex', 'height', 'media', 'width']);
      expect('bytes' in payload).toBe(false);
      expect(payload.media?.relativePath).toBe('frames/layer-1/key-a.webp');
    });

    it('passes a live bytes-carrying runtime record through untouched (in-memory resync path)', () => {
      const live = runtimeRecord('key-live', 7);
      const runtime = toRuntimeRotoRecords([live]);

      expect(runtime[0]).toBe(live);
      expect(payloadKeys(runtime[0]!.payload)).toEqual(['appFrame', 'bytes', 'frameIndex', 'height', 'width']);
    });

    it('preserves keyId, appFrame and frameIndex across both directions', () => {
      const records = [runtimeRecord('key-a', 4, { frameIndex: 2 }), runtimeRecord('key-b', 11, { frameIndex: 3 })];
      const persisted = toPersistedRotoRecords(
        records,
        resolverFrom({ 'key-a': mediaReference('key-a'), 'key-b': mediaReference('key-b') }),
      );
      if (!persisted.ok) throw new Error('expected a projected collection');

      const roundTripped = toRuntimeRotoRecords(persisted.records);

      expect(roundTripped.map((record) => [record.keyId, record.appFrame, record.payload.frameIndex])).toEqual([
        ['key-a', 4, 2],
        ['key-b', 11, 3],
      ]);
    });
  });

  describe('group-override collections (D-06)', () => {
    it('strips the payload and emits media references exactly as for real keys', () => {
      const groupOverrides = [
        runtimeRecord('override-a', 3, { frameIndex: 1 }),
        runtimeRecord('override-b', 8, { frameIndex: 2 }),
      ];
      const result = toPersistedRotoRecords(
        groupOverrides,
        resolverFrom({ 'override-a': mediaReference('override-a'), 'override-b': mediaReference('override-b') }),
      );

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('expected a projected collection');
      expect(result.records.map((record) => record.keyId)).toEqual(['override-a', 'override-b']);
      // Exact key set by name: no per-collection branch adds or keeps a member.
      expect(payloadKeys(result.records[0]!.payload)).toEqual(['appFrame', 'frameIndex', 'height', 'media', 'width']);
      expect(result.records.every((record) => !('bytes' in record.payload))).toBe(true);
      expect(result.records[0]!.payload.media?.relativePath).toBe('frames/layer-1/override-a.webp');
    });

    it('fails with a typed failure naming THAT group override keyId', () => {
      const groupOverrides = [runtimeRecord('override-a', 3)];
      const result = toPersistedRotoRecords(groupOverrides, resolverFrom({}));

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('expected a typed failure');
      expect(result.failure.kind).toBe('unresolved-media-reference');
      expect(result.failure.keyId).toBe('override-a');
    });

    it('projects a group-override collection to runtime records carrying media and no bytes', () => {
      const groupOverrides = [runtimeRecord('override-a', 3, { frameIndex: 1 })];
      const persisted = toPersistedRotoRecords(
        groupOverrides,
        resolverFrom({ 'override-a': mediaReference('override-a') }),
      );
      if (!persisted.ok) throw new Error('expected a projected collection');

      const runtime = toRuntimeRotoRecords(persisted.records);

      expect(payloadKeys(runtime[0]!.payload)).toEqual(['appFrame', 'frameIndex', 'height', 'media', 'width']);
      expect('bytes' in runtime[0]!.payload).toBe(false);
      expect(runtime[0]!.keyId).toBe('override-a');
    });
  });

  it('is pure: no store, IPC or component import', () => {
    const source = readFileSync(
      fileURLToPath(new URL('./physicsPaintRotoMediaProjection.ts', import.meta.url)),
      'utf8',
    );
    const specifiers = [...source.matchAll(/from\s+'([^']+)'/g)].map((match) => match[1]);

    expect(specifiers.length).toBeGreaterThan(0);
    expect([...new Set(specifiers)].sort()).toEqual([
      '../../../lib/efxPaintPackage',
      './physicsPaintRotoPhysicalModel',
    ]);
  });
});
