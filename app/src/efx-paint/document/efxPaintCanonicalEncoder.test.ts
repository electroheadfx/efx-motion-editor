import { describe, expect, it } from 'vitest';
import {
  encodeCanonicalNumber,
  encodeCanonicalOptionalNumber,
  encodeCanonicalString,
} from './efxPaintCanonicalEncoder';

describe('encodeCanonicalNumber — cross-language f64 Display parity', () => {
  // Rust's `f64` Display never uses exponent notation; `String(value)` does at
  // |v| >= 1e21 or < 1e-6. A divergence here forks the document revision
  // between TypeScript and Rust and makes every prepare fail the hash gate.
  it.each([
    [1e21, 'n1000000000000000000000;'],
    [1e-7, 'n0.0000001;'],
    [1.5e-7, 'n0.00000015;'],
    [1.2345678901234568e21, 'n1234567890123456800000;'],
    [-1e21, 'n-1000000000000000000000;'],
    [-1e-7, 'n-0.0000001;'],
    [5e-324, `n0.${'0'.repeat(323)}5;`],
  ])('expands %s to positional decimal', (value, expected) => {
    expect(String(value)).toMatch(/e[+-]/i);
    expect(encodeCanonicalNumber(value)).toBe(expected);
  });

  it.each([
    [0, 'n0;'],
    [1, 'n1;'],
    [-8, 'n-8;'],
    [12.5, 'n12.5;'],
    [0.25, 'n0.25;'],
    [1e-6, 'n0.000001;'],
    [1e20, 'n100000000000000000000;'],
  ])('leaves non-exponent %s unchanged', (value, expected) => {
    expect(String(value)).not.toMatch(/e[+-]/i);
    expect(encodeCanonicalNumber(value)).toBe(expected);
  });

  // Rust prints `-0`; `String(-0)` is `'0'`.
  it('distinguishes negative zero from zero', () => {
    expect(encodeCanonicalNumber(-0)).toBe('n-0;');
    expect(encodeCanonicalNumber(0)).toBe('n0;');
  });

  it('keeps the optional wrapper on the same encoding', () => {
    expect(encodeCanonicalOptionalNumber(undefined)).toBe('u;');
    expect(encodeCanonicalOptionalNumber(1e21)).toBe('n1000000000000000000000;');
  });

  it('leaves string encoding untouched', () => {
    expect(encodeCanonicalString('1e21')).toBe('s4:1e21;');
  });
});
