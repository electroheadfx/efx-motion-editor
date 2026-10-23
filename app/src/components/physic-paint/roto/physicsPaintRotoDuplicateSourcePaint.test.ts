import { describe, expect, it } from 'vitest';
import { testWebpBytes } from '../../../testUtils/testWebpBytes';
import type { PhysicPaintRotoRealKeyPayload, PhysicPaintRotoRealKeyRecord } from './physicsPaintRotoPhysicalModel';
import {
  ROTO_DUPLICATE_SOURCE_PAINT_UNAVAILABLE_ERROR,
  resolveRotoDuplicateSourcePaint,
  type RotoDisplayedKeyPaint,
} from './physicsPaintRotoDuplicateSourcePaint';

function sourceRecord(payload: Partial<PhysicPaintRotoRealKeyPayload> = {}): PhysicPaintRotoRealKeyRecord {
  return Object.freeze({
    kind: 'real-key',
    keyId: 'key-source',
    appFrame: 4,
    payload: Object.freeze({
      frameIndex: 0,
      appFrame: 4,
      width: 100,
      height: 80,
      ...payload,
    }) as PhysicPaintRotoRealKeyPayload,
  }) as PhysicPaintRotoRealKeyRecord;
}

function displayedPaint(overrides: Partial<RotoDisplayedKeyPaint> = {}): RotoDisplayedKeyPaint {
  return {
    bytes: testWebpBytes('displayed-paint'),
    width: 100,
    height: 80,
    ...overrides,
  } as RotoDisplayedKeyPaint;
}

describe('resolveRotoDuplicateSourcePaint (261023-bxm Task 1)', () => {
  it('is ready and ignores the displayed paint when the record carries usable inline bytes', () => {
    const displayed = displayedPaint();
    const resolution = resolveRotoDuplicateSourcePaint({
      record: sourceRecord({ bytes: testWebpBytes('inline-paint') }),
      displayed,
    });

    expect(resolution).toEqual({ kind: 'ready' });
    expect(resolution).not.toBe(displayed);
  });

  it.each([
    ['missing', undefined],
    ['zero-length', new Uint8Array(0)],
  ])('cooks the displayed paint when the record bytes are %s', (_label, inlineBytes) => {
    const displayed = displayedPaint({ keyId: 'key-source' });
    const record = inlineBytes === undefined
      ? sourceRecord()
      : sourceRecord({ bytes: inlineBytes });

    const resolution = resolveRotoDuplicateSourcePaint({ record, displayed });

    expect(resolution.kind).toBe('cook');
    if (resolution.kind !== 'cook') throw new Error('expected cook');
    expect(resolution.paint).toBe(displayed);
  });

  it('cooks when the displayed paint names no key (absent keyId)', () => {
    const displayed = displayedPaint();
    const resolution = resolveRotoDuplicateSourcePaint({ record: sourceRecord(), displayed });

    expect(resolution.kind).toBe('cook');
    if (resolution.kind !== 'cook') throw new Error('expected cook');
    expect(resolution.paint.bytes).toBe(displayed.bytes);
  });

  it('cooks when the displayed paint names the source key', () => {
    const displayed = displayedPaint({ keyId: 'key-source' });
    const resolution = resolveRotoDuplicateSourcePaint({ record: sourceRecord(), displayed });

    expect(resolution.kind).toBe('cook');
    if (resolution.kind !== 'cook') throw new Error('expected cook');
    expect(resolution.paint).toBe(displayed);
  });

  it('is unavailable when no displayed paint resolves and the record carries no bytes', () => {
    expect(resolveRotoDuplicateSourcePaint({ record: sourceRecord(), displayed: null }))
      .toEqual({ kind: 'unavailable' });
  });

  it('is unavailable when the displayed paint belongs to another key', () => {
    const resolution = resolveRotoDuplicateSourcePaint({
      record: sourceRecord(),
      displayed: displayedPaint({ keyId: 'key-other' }),
    });

    expect(resolution).toEqual({ kind: 'unavailable' });
  });

  it('is unavailable when the displayed paint carries zero-length bytes', () => {
    const resolution = resolveRotoDuplicateSourcePaint({
      record: sourceRecord(),
      displayed: displayedPaint({ bytes: new Uint8Array(0) }),
    });

    expect(resolution).toEqual({ kind: 'unavailable' });
  });

  it('exports the shared unavailable message', () => {
    expect(ROTO_DUPLICATE_SOURCE_PAINT_UNAVAILABLE_ERROR).toBe('source key paint unavailable');
  });
});
