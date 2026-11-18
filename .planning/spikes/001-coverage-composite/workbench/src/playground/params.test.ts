import { describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS } from './Engine';
import { DEFAULT_CANONICAL_PARAMS, toEngineParams } from './params';

describe('toEngineParams', () => {
  // quick 261116-inu / Task 7: every step of this table is the HEAD OUTPUT
  // written as a literal, never recomputed from the constants — it is the
  // proof that every recorded non-negative canonical replays byte-identically.
  it('keeps every non-negative legacy canonical byte-identical at HEAD', () => {
    expect(toEngineParams({ size: 1 }).size).toBe(1 / 32);
    expect(toEngineParams({ size: 12 }).size).toBe(3 / 8);
    expect(toEngineParams({ size: 32 }).size).toBe(1);
    expect(toEngineParams({ size: 33 }).size).toBe(1);
    expect(toEngineParams({ size: 80 }).size).toBe(1);
    // 1 + (1/720) * 1.04795 — the HEAD literal for 81.
    expect(toEngineParams({ size: 81 }).size).toBeCloseTo(1.00145549, 8);
    expect(toEngineParams({ size: 800 }).size).toBeCloseTo(2.04795, 12);
  });

  // quick 261116-inu / Task 7: the retired `Math.max(0, ...)` floor. Below
  // zero the branch is the plain linear map — no saturation, no clamp.
  it('maps the negative canonical region linearly (the old 0 floor is retired)', () => {
    expect(toEngineParams({ size: -1 }).size).toBe(-1 / 32);
    expect(toEngineParams({ size: -5 }).size).toBe(-5 / 32);
    expect(toEngineParams({ size: -32 }).size).toBe(-1);
    expect(toEngineParams({ size: -0.5 }).size).toBe(-0.5 / 32);
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
    expect(toEngineParams({ size: Number.POSITIVE_INFINITY }).size).toBeCloseTo(
      DEFAULT_CANONICAL_PARAMS.size / 32,
      12,
    );
    // A NEGATIVE finite value is not a guard case: it maps linearly (Task 7).
    expect(toEngineParams({ size: -5 }).size).toBe(-5 / 32);
  });

  it('maps the seven canonical globals onto 0..1', () => {
    expect(toEngineParams({ water: 50, load: 25, flow: 100, bleed: 0, dry: 75, edge: 60, granulation: 40 }))
      .toEqual({ size: 12 / 32, water: 0.5, load: 0.25, flow: 1, bleed: 0, dry: 0.75, edge: 0.6, granulation: 0.4, lift: 0.22, viscosity: 0, body: 0, emboss: 0 });
  });

  // Phase 64 (v2.2.0): Body and Emboss join the medium bag. 0 is neutral —
  // a pre-milestone stroke must replay byte-identically.
  it('maps the Body and Emboss globals 0..100 onto the 0..1 medium bag', () => {
    expect(toEngineParams({ body: 0 }).body).toBe(0);
    expect(toEngineParams({ body: 50 }).body).toBe(0.5);
    expect(toEngineParams({ body: 100 }).body).toBe(1);
    // T-64-01: out-of-track values are clamped in the ONE mapping.
    expect(toEngineParams({ body: 250 }).body).toBe(1);
    expect(toEngineParams({ body: -40 }).body).toBe(0);
    expect(toEngineParams({ emboss: 0 }).emboss).toBe(0);
    expect(toEngineParams({ emboss: 50 }).emboss).toBe(0.5);
    expect(toEngineParams({ emboss: 100 }).emboss).toBe(1);
    expect(toEngineParams({ emboss: 250 }).emboss).toBe(1);
    expect(toEngineParams({ emboss: -40 }).emboss).toBe(0);
  });

  it('replays a stroke without the Body or Emboss key at the neutral default', () => {
    expect(toEngineParams({ water: 50 }).body).toBe(0);
    expect(toEngineParams(undefined).body).toBe(0);
    expect(toEngineParams({ body: Number.NaN }).body).toBe(0);
    expect(toEngineParams({ body: Number.POSITIVE_INFINITY }).body).toBe(0);
    expect(toEngineParams({}).emboss).toBe(0);
    expect(toEngineParams({ emboss: Number.NaN }).emboss).toBe(0);
    expect(toEngineParams({ emboss: Number.NEGATIVE_INFINITY }).emboss).toBe(0);
  });

  it('declares Body and Emboss at 0 in the canonical and engine bags', () => {
    expect(DEFAULT_CANONICAL_PARAMS.body).toBe(0);
    expect(DEFAULT_CANONICAL_PARAMS.emboss).toBe(0);
    expect(DEFAULT_PARAMS.body).toBe(0);
    expect(DEFAULT_PARAMS.emboss).toBe(0);
  });

  // Phase 64 (v2.2.0): the medium bag's first key. 0 is neutral — an absent
  // key must replay a pre-milestone stroke byte-identically.
  it('maps the Viscosity global 0..100 onto the 0..1 medium bag', () => {
    expect(toEngineParams({ viscosity: 0 }).viscosity).toBe(0);
    expect(toEngineParams({ viscosity: 100 }).viscosity).toBe(1);
    expect(toEngineParams({ viscosity: 37 }).viscosity).toBe(0.37);
    // T-64-01: an out-of-track value is clamped in the ONE mapping.
    expect(toEngineParams({ viscosity: 250 }).viscosity).toBe(1);
    expect(toEngineParams({ viscosity: -40 }).viscosity).toBe(0);
  });

  // Phase 64 / MED-04: a recorded stroke that predates the key carries no
  // `viscosity`; it must replay at the neutral default, and a non-finite value
  // must normalize to 0 at the engine boundary instead of reaching a uniform
  // as NaN.
  it('replays a stroke without the viscosity key at the neutral default', () => {
    expect(toEngineParams({ water: 50 }).viscosity).toBe(0);
    expect(toEngineParams(undefined).viscosity).toBe(0);
    expect(toEngineParams({ viscosity: Number.NaN }).viscosity).toBe(0);
    expect(toEngineParams({ viscosity: Number.POSITIVE_INFINITY }).viscosity).toBe(0);
    expect(toEngineParams({ viscosity: Number.NEGATIVE_INFINITY }).viscosity).toBe(0);
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
