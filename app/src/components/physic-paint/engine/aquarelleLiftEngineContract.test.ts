// ============================================================
//  aquarelleLiftEngineContract — Lift (the eraser) is the ONE
//  tool that also reaches pigment baked into `fixed` by an
//  explicit Dry (261028-k03 D1).
//
//  1. FIXED PASS  — lift() draws `this.fixed` after ink and wet.
//  2. FIXED UNDO  — the fixed pool is snapshotted (pool 1) over
//     the same per-dab margin as the mobile tiles BEFORE the
//     fixed draw, so one Step restores both pools.
//  3. FULL AMOUNT — the fixed draw uses the full `amount`; the
//     0.8 tissue factor belongs to the wet pass alone.
//  4. ORACLE      — the law oracle's liftAt subtracts fixed
//     pigment too, so the oracle cannot disagree with the
//     renderer.
// ============================================================

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const engine = readFileSync(
  resolve(__dirname, '../../../../../packages/efx-watercolor/src/playground/Engine.ts'),
  'utf8',
);
const deposit = readFileSync(
  resolve(__dirname, '../../../../../packages/efx-watercolor/src/engine/deposit.ts'),
  'utf8',
);

function liftSlice(): string {
  const start = engine.indexOf('private lift(');
  const end = engine.indexOf(
    '/* ----------------------------------------------------------- simulation */',
    start,
  );
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return engine.slice(start, end);
}

describe('Engine.lift() erases fixed pigment (261028-k03 D1)', () => {
  it('FIXED PASS: the fixed draw comes after both the ink and wet draws', () => {
    const lift = liftSlice();
    const ink = lift.indexOf('g.draw(this.ink.read, rect)');
    const wet = lift.indexOf('g.draw(this.wet.read, rect)');
    const fixed = lift.indexOf('g.draw(this.fixed, rect)');
    expect(ink).toBeGreaterThanOrEqual(0);
    expect(wet).toBeGreaterThan(ink);
    expect(fixed).toBeGreaterThan(wet);
  });

  it('FIXED UNDO: the fixed pool is protected before the fixed draw', () => {
    const lift = liftSlice();
    const protect1 = lift.indexOf('this.history.protect(1,');
    const fixedViews = lift.indexOf('this.fixed.views');
    const fixedDraw = lift.indexOf('g.draw(this.fixed, rect)');
    expect(protect1).toBeGreaterThanOrEqual(0);
    expect(fixedViews).toBeGreaterThan(protect1);
    expect(fixedDraw).toBeGreaterThan(protect1);
  });

  it('FULL AMOUNT: the fixed draw is preceded by the un-scaled amount uniform', () => {
    const lift = liftSlice();
    const wetDraw = lift.indexOf('g.draw(this.wet.read, rect)');
    const fixedDraw = lift.indexOf('g.draw(this.fixed, rect)');
    // Statement boundaries — never a byte window. The 0.8 wet uniform sits a
    // few statements back, so a fixed-width window would always trip.
    const beforeFixed = lift.slice(0, fixedDraw);
    const statements = beforeFixed
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    expect(statements[statements.length - 1]).toBe('gl.uniform1f(p.u.uAmount, amount)');
    // The tissue factor exists exactly once, on the wet pass.
    const scaled = lift.indexOf('amount * 0.8');
    expect(lift.split('amount * 0.8').length - 1).toBe(1);
    expect(scaled).toBeGreaterThanOrEqual(0);
    expect(scaled).toBeLessThan(wetDraw);
    expect(fixedDraw).toBeGreaterThan(wetDraw);
  });

  it('ORACLE: liftAt subtracts fixed pigment and no longer returns on mobile-only emptiness', () => {
    const start = deposit.indexOf('function liftAt(');
    const end = deposit.indexOf('/** Wet-only stamp', start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const liftAt = deposit.slice(start, end);
    expect(liftAt).toContain('sheet.fixed[i]');
    expect(liftAt).toContain('m + f <= 0');
    expect(liftAt).not.toContain('if (m <= 0');
  });
});
