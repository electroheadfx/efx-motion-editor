import { describe, expect, it } from 'vitest';
import { testWebpBytes } from '../../../testUtils/testWebpBytes';
import type { PhysicPaintRotoCacheFrame } from '../../../types/physicPaint';
import type { PhysicPaintRotoRealKeyPayload, PhysicPaintRotoRealKeyRecord } from './physicsPaintRotoPhysicalModel';
import {
  PREVIOUS_KEY_BYTES_UNAVAILABLE_ERROR,
  resolvePreviousRealKeyBase,
  toEmptyKeyPayload,
} from './physicsPaintRotoPreviousKeyBase';

function realKeyFrame(appFrame: number, overrides: Partial<PhysicPaintRotoCacheFrame> = {}): PhysicPaintRotoCacheFrame {
  return {
    frameIndex: 0,
    appFrame,
    bytes: testWebpBytes(`cached-${appFrame}`),
    width: 100,
    height: 80,
    source: 'real-key',
    ...overrides,
  } as PhysicPaintRotoCacheFrame;
}

function realKeyRecord(
  keyId: string,
  appFrame: number,
  payload: Partial<PhysicPaintRotoRealKeyPayload> = {},
): PhysicPaintRotoRealKeyRecord {
  return Object.freeze({
    kind: 'real-key',
    keyId,
    appFrame,
    payload: Object.freeze({
      frameIndex: 0,
      appFrame,
      bytes: testWebpBytes(`durable-${appFrame}`),
      width: 100,
      height: 80,
      ...payload,
    }) as PhysicPaintRotoRealKeyPayload,
  }) as PhysicPaintRotoRealKeyRecord;
}

describe('resolvePreviousRealKeyBase (261022-cfn Task 1)', () => {
  it('returns blank when no record is strictly earlier than the destination', () => {
    const resolution = resolvePreviousRealKeyBase({
      records: [realKeyRecord('key-3', 3)],
      cachedRotoFrames: [realKeyFrame(3)],
    }, 0);

    expect(resolution).toEqual({ kind: 'blank' });
  });

  it('returns blank when records exist only at or after the destination', () => {
    const resolution = resolvePreviousRealKeyBase({
      records: [realKeyRecord('key-3', 3), realKeyRecord('key-5', 5)],
      cachedRotoFrames: [realKeyFrame(3), realKeyFrame(5)],
    }, 0);

    expect(resolution).toEqual({ kind: 'blank' });
  });

  it('selects the nearest strictly-earlier record and ignores later records', () => {
    const resolution = resolvePreviousRealKeyBase({
      records: [
        realKeyRecord('key-2', 2, { bytes: testWebpBytes('earlier') }),
        realKeyRecord('key-5', 5, { bytes: testWebpBytes('nearest') }),
        realKeyRecord('key-9', 9, { bytes: testWebpBytes('later') }),
      ],
    }, 8);

    expect(resolution.kind).toBe('clone');
    if (resolution.kind !== 'clone') throw new Error('expected clone');
    expect(resolution.payload.bytes).toEqual(testWebpBytes('nearest'));
  });

  it('prefers cached real-key bytes at the previous frame and relabels only appFrame', () => {
    const cachedBytes = testWebpBytes('cached-preferred');
    const resolution = resolvePreviousRealKeyBase({
      records: [realKeyRecord('key-5', 5, { bytes: testWebpBytes('durable-5') })],
      cachedRotoFrames: [
        realKeyFrame(5, { frameIndex: 7, bytes: cachedBytes, width: 120, height: 90 }),
        realKeyFrame(2, { bytes: testWebpBytes('other-frame') }),
      ],
    }, 8);

    expect(resolution.kind).toBe('clone');
    if (resolution.kind !== 'clone') throw new Error('expected clone');
    expect(resolution.payload).toEqual({
      frameIndex: 7,
      appFrame: 8,
      bytes: cachedBytes,
      width: 120,
      height: 90,
    });
  });

  it('falls back to durable record bytes when no usable cached frame exists', () => {
    const durableBytes = testWebpBytes('durable-fallback');
    const resolution = resolvePreviousRealKeyBase({
      records: [realKeyRecord('key-5', 5, { frameIndex: 2, bytes: durableBytes, width: 64, height: 48 })],
      cachedRotoFrames: [],
    }, 8);

    expect(resolution.kind).toBe('clone');
    if (resolution.kind !== 'clone') throw new Error('expected clone');
    expect(resolution.payload).toEqual({
      frameIndex: 2,
      appFrame: 8,
      bytes: durableBytes,
      width: 64,
      height: 48,
    });
  });

  it.each([
    ['a generated frame', realKeyFrame(5, { source: 'generated-interpolation' })],
    ['a cached frame at another appFrame', realKeyFrame(4)],
    ['a zero-length cached frame', realKeyFrame(5, { bytes: new Uint8Array(0) })],
  ])('never clones from %s', (_label, cachedFrame) => {
    const durableBytes = testWebpBytes('durable-after-invalid-cache');
    const resolution = resolvePreviousRealKeyBase({
      records: [realKeyRecord('key-5', 5, { bytes: durableBytes })],
      cachedRotoFrames: [cachedFrame],
    }, 8);

    expect(resolution.kind).toBe('clone');
    if (resolution.kind !== 'clone') throw new Error('expected clone');
    expect(resolution.payload.bytes).toEqual(durableBytes);
  });

  it.each([
    ['missing', undefined],
    ['empty', new Uint8Array(0)],
  ])('returns unavailable when the previous record bytes are %s on both carriers', (_label, bytes) => {
    const record = realKeyRecord('key-5', 5, bytes === undefined ? { bytes: undefined } : { bytes });
    const resolution = resolvePreviousRealKeyBase({
      records: [record],
      cachedRotoFrames: [realKeyFrame(5, { bytes: bytes ?? new Uint8Array(0) })],
    }, 8);

    expect(resolution).toEqual({ kind: 'unavailable' });
  });

  it('freezes cloned payloads', () => {
    const resolution = resolvePreviousRealKeyBase({
      records: [realKeyRecord('key-5', 5)],
    }, 8);

    expect(resolution.kind).toBe('clone');
    if (resolution.kind !== 'clone') throw new Error('expected clone');
    expect(Object.isFrozen(resolution.payload)).toBe(true);
  });

  it('toEmptyKeyPayload freezes the payload and relabels only appFrame', () => {
    const payload = toEmptyKeyPayload(realKeyFrame(1, { frameIndex: 4, width: 32, height: 24 }), 9);

    expect(Object.isFrozen(payload)).toBe(true);
    expect(payload).toEqual({
      frameIndex: 4,
      appFrame: 9,
      bytes: testWebpBytes('cached-1'),
      width: 32,
      height: 24,
    });
  });

  it('exports the shared unavailable message', () => {
    expect(PREVIOUS_KEY_BYTES_UNAVAILABLE_ERROR).toBe('previous key bytes unavailable');
  });
});
