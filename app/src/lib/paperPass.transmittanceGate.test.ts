import { describe, expect, it } from 'vitest';
import { shouldApplyPaperPass } from './paperPass';

// 2026-10-26 — Studio/editor watercolor compositing parity.
//
// The dynamic post-bake paper pass is the ENGINE-1 tooth: it modulates real
// alpha paint once, on the flattened mixed raster. A watercolor track is
// MODE.transparent OPAQUE transmittance (alpha = 1, white = no pigment) and
// already carries the engine's own paper response (granulation + edge
// darkening). Modulating it a second time produces the fine speckle across
// dense pigment that the editor showed while the Studio live sheet stayed
// clean — the surfaces disagreed on the same frame.
//
// The gate is one predicate so the law lives in one place: paper fond + grain
// on, but NEVER an opaque transmittance sheet.

const PAPER = { passKind: 'paper' as const, grainStrength: 0.65 };

describe('shouldApplyPaperPass — engine-1 tooth only', () => {
  it('applies to real-alpha paint over a paper fond with grain on', () => {
    expect(shouldApplyPaperPass({ ...PAPER, transmittanceSheet: false })).toBe(true);
  });

  it('SKIPS an aquarelle transmittance sheet even with a paper fond and grain on', () => {
    // The pre-fond composite is fully opaque: the sheet is watercolor, and the
    // tooth must not be applied a second time (the editor speckle).
    expect(shouldApplyPaperPass({ ...PAPER, transmittanceSheet: true })).toBe(false);
  });

  it('skips when the fond is not paper (solid colour / transparent)', () => {
    expect(shouldApplyPaperPass({ passKind: 'color', grainStrength: 0.65, transmittanceSheet: false })).toBe(false);
    expect(shouldApplyPaperPass({ passKind: null, grainStrength: 0.65, transmittanceSheet: false })).toBe(false);
  });

  it('skips when grain is off (strength None / 0) regardless of the sheet', () => {
    expect(shouldApplyPaperPass({ passKind: 'paper', grainStrength: 0, transmittanceSheet: false })).toBe(false);
    expect(shouldApplyPaperPass({ passKind: 'paper', grainStrength: -1, transmittanceSheet: false })).toBe(false);
  });
});
