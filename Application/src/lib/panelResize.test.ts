import { describe, it, expect } from 'vitest';
import { calcResize, COLLAPSE_THRESHOLD, MIN_RESTORED } from './panelResize';

describe('panelResize', () => {
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
