// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import {
  formatRulerSecondsLabel,
  getTimelineUnitMode,
  peekTimelineUnitMode,
  setTimelineUnitMode,
} from './physicsPaintTimelineUnit';

describe('timeline unit mode (261105-cgl UAT)', () => {
  afterEach(() => {
    setTimelineUnitMode('frame');
  });

  it('defaults to frame and flips both ways', () => {
    expect(getTimelineUnitMode()).toBe('frame');
    expect(setTimelineUnitMode('seconds')).toBe(true);
    expect(getTimelineUnitMode()).toBe('seconds');
    expect(peekTimelineUnitMode()).toBe('seconds');
    expect(setTimelineUnitMode('frame')).toBe(true);
    expect(getTimelineUnitMode()).toBe('frame');
  });

  it('is a compare-then-write no-op when the mode is unchanged', () => {
    expect(setTimelineUnitMode('frame')).toBe(false);
    setTimelineUnitMode('seconds');
    expect(setTimelineUnitMode('seconds')).toBe(false);
  });

  it('formats ruler labels compactly with no trailing zeros', () => {
    expect(formatRulerSecondsLabel(0)).toBe('0');
    expect(formatRulerSecondsLabel(0.25)).toBe('0.25');
    expect(formatRulerSecondsLabel(0.5)).toBe('0.5');
    expect(formatRulerSecondsLabel(1)).toBe('1');
    expect(formatRulerSecondsLabel(0.125)).toBe('0.125');
    expect(formatRulerSecondsLabel(2.5)).toBe('2.5');
    expect(formatRulerSecondsLabel(Number.NaN)).toBe('0');
    expect(formatRulerSecondsLabel(Number.POSITIVE_INFINITY)).toBe('0');
  });
});
