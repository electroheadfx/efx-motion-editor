import { describe, expect, it } from 'vitest';
import {
  encodeCanonicalNumber,
  encodeCanonicalOptionalNumber,
  encodeCanonicalString,
} from './efxPaintCanonicalEncoder';

/**
 * The canonical number format is the IEEE-754 binary64 bit pattern, not a
 * decimal rendering. Rust's `f64` Display and ECMAScript's `String(number)`
 * disagree on exponent notation, negative zero, and shortest-roundtrip tie
 * breaking; each of those forked the document revision across languages and
 * made the Rust hash gate reject every prepare. The bit pattern cannot.
 */
describe('encodeCanonicalNumber — IEEE-754 bit pattern', () => {
  it.each([
    [0, '0000000000000000'],
    [-0, '8000000000000000'],
    [1, '3ff0000000000000'],
    [-8, 'c020000000000000'],
    [12.5, '4029000000000000'],
    [0.25, '3fd0000000000000'],
    [1e-6, '3eb0c6f7a0b5ed8d'],
    [1e20, '4415af1d78b58c40'],
  ])('encodes %s', (value, expected) => {
    expect(encodeCanonicalNumber(value)).toBe(`n${expected};`);
  });

  // The three shapes that used to fork TypeScript from Rust.
  it('encodes exponent-magnitude values exactly', () => {
    expect(String(1e21)).toBe('1e+21');
    expect(encodeCanonicalNumber(1e21)).toBe('n444b1ae4d6e2ef50;');
    expect(encodeCanonicalNumber(1e-7)).toBe('n3e7ad7f29abcaf48;');
    expect(encodeCanonicalNumber(1.5e-7)).toBe('n3e8421f5f40d8376;');
    expect(encodeCanonicalNumber(1.2345678901234568e21)).toBe('n4450bb448ec2f608;');
    expect(encodeCanonicalNumber(5e-324)).toBe('n0000000000000001;');
  });

  it('distinguishes negative zero from zero', () => {
    expect(encodeCanonicalNumber(-0)).not.toBe(encodeCanonicalNumber(0));
  });

  // Rust rounds this tie away from zero and ECMAScript to even, so any decimal
  // format disagreed here ('.3' vs '.2'). The bit pattern is the same double.
  it('is insensitive to shortest-roundtrip tie breaking', () => {
    const tie = -890236549097760.25;
    expect(String(tie)).toBe('-890236549097760.2');
    expect(encodeCanonicalNumber(tie)).toBe('nc3094d52ca334902;');
  });

  it('is distinct for distinct doubles', () => {
    for (const [left, right] of [
      [0.1 + 0.2, 0.3],
      [2.675, 2.6749999999999994],
      [1, 1 + Number.EPSILON],
    ] as const) {
      expect(encodeCanonicalNumber(left)).not.toBe(encodeCanonicalNumber(right));
    }
  });

  it('keeps the optional wrapper on the same encoding', () => {
    expect(encodeCanonicalOptionalNumber(undefined)).toBe('u;');
    expect(encodeCanonicalOptionalNumber(1)).toBe('n3ff0000000000000;');
  });

  it('leaves string encoding untouched', () => {
    expect(encodeCanonicalString('1e21')).toBe('s4:1e21;');
  });
});
