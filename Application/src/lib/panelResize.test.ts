import { describe, it, expect } from 'vitest';
import {
  calcResize,
  COLLAPSE_THRESHOLD,
  MIN_RESTORED,
  calcFlexResize,
  COLLAPSE_FLEX_THRESHOLD,
  MIN_RESTORED_FLEX,
} from './panelResize';

// --- Legacy pixel-based API tests ---

describe('panelResize (legacy pixel API)', () => {
  it('exports COLLAPSE_THRESHOLD as 32', () => {
    expect(COLLAPSE_THRESHOLD).toBe(32);
  });

  it('exports MIN_RESTORED as 80', () => {
    expect(MIN_RESTORED).toBe(80);
  });

  describe('calcResize seq-lay', () => {
    it('standard resize: drag down increases seq, decreases lay', () => {
      const result = calcResize(
        { seqHeight: 200, layHeight: 200, totalAvailable: 500 },
        50,
        'seq-lay',
      );
      expect(result).toEqual({ seqHeight: 250, layHeight: 150 });
    });

    it('standard resize: drag up decreases seq, increases lay', () => {
      const result = calcResize(
        { seqHeight: 200, layHeight: 200, totalAvailable: 500 },
        -50,
        'seq-lay',
      );
      expect(result).toEqual({ seqHeight: 150, layHeight: 250 });
    });

    it('collapse: panel below COLLAPSE_THRESHOLD collapses to 0', () => {
      const result = calcResize(
        { seqHeight: 200, layHeight: 200, totalAvailable: 500 },
        -180,
        'seq-lay',
      );
      // seqHeight would be 20 (< 32) -> collapses to 0
      expect(result.seqHeight).toBe(0);
    });

    it('restore from zero: restored panel gets at least MIN_RESTORED', () => {
      const result = calcResize(
        { seqHeight: 0, layHeight: 300, totalAvailable: 500 },
        10,
        'seq-lay',
      );
      // seqHeight would be 10 but restoring from 0 -> MIN_RESTORED (80)
      expect(result.seqHeight).toBe(MIN_RESTORED);
    });

    it('negative clamp: neither height goes below 0', () => {
      const result = calcResize(
        { seqHeight: 50, layHeight: 50, totalAvailable: 500 },
        -100,
        'seq-lay',
      );
      expect(result.seqHeight).toBeGreaterThanOrEqual(0);
      expect(result.layHeight).toBeGreaterThanOrEqual(0);
    });

    it('total overflow: clamp to totalAvailable', () => {
      const result = calcResize(
        { seqHeight: 400, layHeight: 100, totalAvailable: 500 },
        200,
        'seq-lay',
      );
      expect(result.seqHeight + result.layHeight).toBeLessThanOrEqual(500);
    });
  });

  describe('calcResize lay-prop', () => {
    it('only affects layHeight, seqHeight unchanged', () => {
      const result = calcResize(
        { seqHeight: 200, layHeight: 200, totalAvailable: 500 },
        50,
        'lay-prop',
      );
      expect(result.seqHeight).toBe(200);
      expect(result.layHeight).toBe(250);
    });

    it('collapse: layHeight below threshold collapses to 0', () => {
      const result = calcResize(
        { seqHeight: 200, layHeight: 40, totalAvailable: 500 },
        -25,
        'lay-prop',
      );
      // layHeight = 15 (< 32) -> collapses to 0
      expect(result.layHeight).toBe(0);
    });
  });
});

// --- New flex-based API tests ---

describe('panelResize (flex API)', () => {
  it('exports COLLAPSE_FLEX_THRESHOLD as 0.15', () => {
    expect(COLLAPSE_FLEX_THRESHOLD).toBe(0.15);
  });

  it('exports MIN_RESTORED_FLEX as 0.3', () => {
    expect(MIN_RESTORED_FLEX).toBe(0.3);
  });

  describe('calcFlexResize seq-lay', () => {
    it('drag down increases seqFlex, decreases layFlex', () => {
      // totalFlex=3, totalPixelHeight=600 => pxPerUnit=200
      // deltaY=100 => deltaFlex=0.5
      const result = calcFlexResize(
        { seqFlex: 1, layFlex: 1, propFlex: 1, totalPixelHeight: 600 },
        100,
        'seq-lay',
      );
      expect(result.seqFlex).toBeCloseTo(1.5);
      expect(result.layFlex).toBeCloseTo(0.5);
      expect(result.propFlex).toBeCloseTo(1);
    });

    it('drag up decreases seqFlex, increases layFlex', () => {
      const result = calcFlexResize(
        { seqFlex: 1, layFlex: 1, propFlex: 1, totalPixelHeight: 600 },
        -100,
        'seq-lay',
      );
      expect(result.seqFlex).toBeCloseTo(0.5);
      expect(result.layFlex).toBeCloseTo(1.5);
      expect(result.propFlex).toBeCloseTo(1);
    });

    it('collapse: flex below threshold snaps to 0', () => {
      // totalFlex=3, totalPixelHeight=600 => pxPerUnit=200
      // deltaY=-180 => deltaFlex=-0.9, seqFlex = 1-0.9 = 0.1 (< 0.15) -> 0
      const result = calcFlexResize(
        { seqFlex: 1, layFlex: 1, propFlex: 1, totalPixelHeight: 600 },
        -180,
        'seq-lay',
      );
      expect(result.seqFlex).toBe(0);
    });

    it('restore from zero: gets at least MIN_RESTORED_FLEX', () => {
      // seqFlex starts at 0; small drag gives < MIN_RESTORED_FLEX
      // totalFlex=2, totalPixelHeight=600 => pxPerUnit=300
      // deltaY=30 => deltaFlex=0.1 (< 0.3) -> snaps to 0.3
      const result = calcFlexResize(
        { seqFlex: 0, layFlex: 1, propFlex: 1, totalPixelHeight: 600 },
        30,
        'seq-lay',
      );
      expect(result.seqFlex).toBe(MIN_RESTORED_FLEX);
    });

    it('negative clamp: no flex goes below 0', () => {
      const result = calcFlexResize(
        { seqFlex: 0.5, layFlex: 0.5, propFlex: 1, totalPixelHeight: 600 },
        -400,
        'seq-lay',
      );
      expect(result.seqFlex).toBeGreaterThanOrEqual(0);
      expect(result.layFlex).toBeGreaterThanOrEqual(0);
      expect(result.propFlex).toBeGreaterThanOrEqual(0);
    });

    it('propFlex unchanged for seq-lay resizer', () => {
      const result = calcFlexResize(
        { seqFlex: 1, layFlex: 1, propFlex: 1, totalPixelHeight: 600 },
        50,
        'seq-lay',
      );
      expect(result.propFlex).toBe(1);
    });
  });

  describe('calcFlexResize lay-prop', () => {
    it('drag down increases layFlex, decreases propFlex', () => {
      const result = calcFlexResize(
        { seqFlex: 1, layFlex: 1, propFlex: 1, totalPixelHeight: 600 },
        100,
        'lay-prop',
      );
      expect(result.seqFlex).toBeCloseTo(1);
      expect(result.layFlex).toBeCloseTo(1.5);
      expect(result.propFlex).toBeCloseTo(0.5);
    });

    it('collapse: propFlex below threshold snaps to 0', () => {
      // deltaY=180 => deltaFlex=0.9, propFlex = 1-0.9 = 0.1 (< 0.15) -> 0
      const result = calcFlexResize(
        { seqFlex: 1, layFlex: 1, propFlex: 1, totalPixelHeight: 600 },
        180,
        'lay-prop',
      );
      expect(result.propFlex).toBe(0);
    });

    it('seqFlex unchanged for lay-prop resizer', () => {
      const result = calcFlexResize(
        { seqFlex: 1, layFlex: 1, propFlex: 1, totalPixelHeight: 600 },
        50,
        'lay-prop',
      );
      expect(result.seqFlex).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('returns current values when totalPixelHeight is 0', () => {
      const result = calcFlexResize(
        { seqFlex: 1, layFlex: 1, propFlex: 1, totalPixelHeight: 0 },
        100,
        'seq-lay',
      );
      expect(result).toEqual({ seqFlex: 1, layFlex: 1, propFlex: 1 });
    });

    it('returns current values when totalFlex is 0', () => {
      const result = calcFlexResize(
        { seqFlex: 0, layFlex: 0, propFlex: 0, totalPixelHeight: 600 },
        100,
        'seq-lay',
      );
      expect(result).toEqual({ seqFlex: 0, layFlex: 0, propFlex: 0 });
    });
  });
});
