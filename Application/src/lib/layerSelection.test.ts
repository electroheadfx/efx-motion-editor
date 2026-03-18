import { describe, it, expect } from 'vitest';
import { getTopLayerId } from './layerSelection';

describe('getTopLayerId', () => {
  it('returns null for null sequence', () => {
    expect(getTopLayerId(null)).toBe(null);
  });

  it('returns null for undefined sequence', () => {
    expect(getTopLayerId(undefined)).toBe(null);
  });

  it('returns null for sequence with empty layers', () => {
    expect(getTopLayerId({ layers: [] })).toBe(null);
  });

  it('returns single layer id', () => {
    expect(getTopLayerId({ layers: [{ id: 'base' }] })).toBe('base');
  });

  it('returns last layer id (top-most in stack)', () => {
    const seq = { layers: [{ id: 'base' }, { id: 'mid' }, { id: 'top' }] };
    expect(getTopLayerId(seq)).toBe('top');
  });
});
