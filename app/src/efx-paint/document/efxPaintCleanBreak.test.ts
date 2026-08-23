import { describe, expect, it } from 'vitest';
import { findLegacyPhysicPaintRejection } from './efxPaintCleanBreak';
import legacyPhysicPaintOutputs from './__fixtures__/legacy-physic-paint-outputs.mce.json';

describe('findLegacyPhysicPaintRejection — legacy-physic-paint-outputs trigger', () => {
  it('rejects a legacy project with a non-empty physic_paint_outputs array', () => {
    expect(findLegacyPhysicPaintRejection(legacyPhysicPaintOutputs)).toEqual({
      kind: 'legacy-physic-paint-outputs',
    });
  });

  it('is pure — repeated calls return equal results and the input is deep-unchanged', () => {
    const input = JSON.parse(JSON.stringify(legacyPhysicPaintOutputs));
    const before = JSON.stringify(input);
    const first = findLegacyPhysicPaintRejection(input);
    const second = findLegacyPhysicPaintRejection(input);
    expect(second).toEqual(first);
    expect(JSON.stringify(input)).toBe(before);
  });

  it('returns null for non-record input — the gate scans, it does not throw', () => {
    expect(findLegacyPhysicPaintRejection(null)).toBeNull();
    expect(findLegacyPhysicPaintRejection([])).toBeNull();
    expect(findLegacyPhysicPaintRejection('legacy')).toBeNull();
    expect(findLegacyPhysicPaintRejection(42)).toBeNull();
  });
});
