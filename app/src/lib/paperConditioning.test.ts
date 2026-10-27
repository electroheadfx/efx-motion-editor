// ============================================================
//  quick 261027-klx — paper conditioner byte parity.
//
//  The fixture was generated from the engine-1 implementation
//  (packages/efx-physic-paint/src/core/paper.ts) BEFORE the package
//  was touched. JSON cannot represent NaN / -0, so non-finite values
//  are encoded as the strings "NaN" / "-0" and decoded explicitly
//  (`Number('-0')` is -0 only because we map it ourselves).
//
//  Comparison is BYTE-WISE, never toBeCloseTo: NaN and -0 must match
//  exactly.
// ============================================================

import { describe, expect, it } from 'vitest';
import { conditionHeightMap } from './paperConditioning';
import fixture from './__fixtures__/paperConditioning.golden.json';

type EncodedNumber = number | 'NaN' | '-0';

interface GoldenCase {
  readonly name: string;
  readonly seed?: number;
  readonly input: readonly EncodedNumber[];
  readonly expected: readonly EncodedNumber[];
}

const CASES = fixture as readonly GoldenCase[];

function decodeNumber(value: EncodedNumber): number {
  if (value === 'NaN') return Number.NaN;
  if (value === '-0') return -0;
  return value;
}

function encodeNumber(value: number): EncodedNumber {
  if (Number.isNaN(value)) return 'NaN';
  if (Object.is(value, -0)) return '-0';
  return value;
}

function decodeAll(values: readonly EncodedNumber[]): Float32Array {
  return new Float32Array(values.map(decodeNumber));
}

function bytesOf(values: Float32Array): Uint8Array {
  return new Uint8Array(values.buffer, values.byteOffset, values.byteLength);
}

describe('quick 261027-klx paper conditioning byte parity', () => {
  it('the fixture carries the engine-1 cases (including the seeded field)', () => {
    expect(CASES.length).toBeGreaterThanOrEqual(7);
    const seeded = CASES.find((entry) => entry.name.includes('seeded pseudo-random'));
    expect(seeded?.seed).toBe(0x261027);
    expect(seeded?.input).toHaveLength(256);
  });

  it('the "NaN" / "-0" codec is lossless over the fixture', () => {
    for (const entry of CASES) {
      for (const value of [...entry.input, ...entry.expected]) {
        expect(encodeNumber(decodeNumber(value)), `${entry.name} value ${String(value)}`).toBe(value);
      }
    }
    expect(Number.isNaN(decodeNumber('NaN'))).toBe(true);
    expect(Object.is(decodeNumber('-0'), -0)).toBe(true);
    expect(encodeNumber(-0)).toBe('-0');
    expect(encodeNumber(Number.NaN)).toBe('NaN');
  });

  for (const entry of CASES) {
    it(`matches the engine-1 bytes: ${entry.name}`, () => {
      const actual = conditionHeightMap(decodeAll(entry.input));
      const expected = decodeAll(entry.expected);
      expect(actual.length, `${entry.name} length`).toBe(expected.length);
      expect(bytesOf(actual), `${entry.name} bytes`).toEqual(bytesOf(expected));
    });
  }

  it('empty input yields an empty output (mean defaults to 0.5, no allocation of work)', () => {
    expect(conditionHeightMap(new Float32Array(0)).length).toBe(0);
  });
});
