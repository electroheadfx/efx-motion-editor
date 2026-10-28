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

  it('extends the footprint scale monotonically through the 80..800 track band', () => {
    expect(toEngineParams({ size: 400 }).size).toBeCloseTo(1 + (320 / 720) * 1.04795, 12);
    expect(toEngineParams({ size: 800 }).size).toBeCloseTo(2.04795, 12);
  });

  it('keeps growing for typed values above the 800 track, up to the safety ceiling', () => {
    expect(toEngineParams({ size: 1000 }).size).toBeCloseTo(1 + (920 / 720) * 1.04795, 12);
    expect(toEngineParams({ size: 100_000 }).size).toBe(4);
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
      .toEqual({ size: 12 / 32, water: 0.5, load: 0.25, flow: 1, bleed: 0, dry: 0.75, edge: 0.6, granulation: 0.4, lift: 0.22 });
  });

  it('maps Lift strength 0..100 onto the 0..0.9 erase amount', () => {
    // 22 is the pre-strength hardcoded amount: old recorded strokes (no key)
    // must keep their exact erase.
    expect(toEngineParams({ lift: 22 }).lift).toBeCloseTo(0.22, 12);
    expect(toEngineParams({ lift: 90 }).lift).toBeCloseTo(0.9, 12);
    expect(toEngineParams(undefined).lift).toBeCloseTo(0.22, 12);
    expect(toEngineParams({ lift: Number.NaN }).lift).toBeCloseTo(0.22, 12);
  });
});
