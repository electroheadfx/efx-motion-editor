import { describe, expect, it } from 'vitest';
import { DEFAULT_CANONICAL_PARAMS, toEngineParams } from './params';

describe('toEngineParams', () => {
  it('keeps every legacy size (1..80 px) byte-identical, including the flat 33..80 band', () => {
    expect(toEngineParams({ size: 1 }).size).toBeCloseTo(1 / 32, 12);
    expect(toEngineParams({ size: 12 }).size).toBeCloseTo(12 / 32, 12);
    expect(toEngineParams({ size: 32 }).size).toBe(1);
    expect(toEngineParams({ size: 33 }).size).toBe(1);
    expect(toEngineParams({ size: 80 }).size).toBe(1);
  });

  it('extends the footprint scale monotonically through the 80..400 dialog band', () => {
    expect(toEngineParams({ size: 240 }).size).toBeCloseTo(1 + (160 / 320) * 0.7325, 12);
    expect(toEngineParams({ size: 400 }).size).toBeCloseTo(1.7325, 12);
    expect(toEngineParams({ size: 1000 }).size).toBeCloseTo(1.7325, 12);
  });

  it('never lets a non-finite size fall out of the mapping', () => {
    expect(toEngineParams({ size: Number.NaN }).size).toBeCloseTo(
      DEFAULT_CANONICAL_PARAMS.size / 32,
      12,
    );
    expect(toEngineParams({ size: -5 }).size).toBe(0);
  });

  it('maps the seven canonical globals onto 0..1', () => {
    expect(toEngineParams({ water: 50, load: 25, flow: 100, bleed: 0, dry: 75, edge: 60, granulation: 40 }))
      .toEqual({ size: 12 / 32, water: 0.5, load: 0.25, flow: 1, bleed: 0, dry: 0.75, edge: 0.6, granulation: 0.4 });
  });
});
