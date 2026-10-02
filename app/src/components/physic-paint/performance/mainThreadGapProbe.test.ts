// 261002 B1 split-measure — pins the gap aggregation. The decisive read is
// maxGapMs, so a wrong median or a mis-filtered floor would misname the block.

import { describe, expect, it } from 'vitest';
import { summarizeMainThreadGaps, MAIN_THREAD_GAP_REPORTING_FLOOR_MS, type MainThreadGap } from './mainThreadGapProbe';

const gap = (gapMs: number, endedAtMs: number): MainThreadGap => ({ gapMs, endedAtMs });

describe('summarizeMainThreadGaps', () => {
  it('reports a zeroed summary when the span never yielded to a ping', () => {
    expect(summarizeMainThreadGaps([], 4000)).toEqual({
      pingCount: 0,
      p50GapMs: 0,
      maxGapMs: 0,
      maxGapEndedAtMs: 4000,
      gapsOver50Ms: [],
    });
  });

  it('makes a single gap the max, the p50, and its own end timestamp', () => {
    const summary = summarizeMainThreadGaps([gap(312, 900)], 0);
    expect(summary.pingCount).toBe(1);
    expect(summary.maxGapMs).toBe(312);
    expect(summary.maxGapEndedAtMs).toBe(900);
    expect(summary.p50GapMs).toBe(312);
  });

  it('picks the true max gap and its end timestamp, not the last one', () => {
    const summary = summarizeMainThreadGaps([gap(1, 10), gap(329, 350), gap(2, 400)], 0);
    expect(summary.maxGapMs).toBe(329);
    expect(summary.maxGapEndedAtMs).toBe(350);
    expect(summary.p50GapMs).toBe(2);
  });

  it(`reports per-gap samples only at ${MAIN_THREAD_GAP_REPORTING_FLOOR_MS} ms and above`, () => {
    const summary = summarizeMainThreadGaps([
      gap(MAIN_THREAD_GAP_REPORTING_FLOOR_MS - 1, 10),
      gap(MAIN_THREAD_GAP_REPORTING_FLOOR_MS, 20),
      gap(300, 30),
    ], 0);
    expect(summary.gapsOver50Ms).toEqual([gap(50, 20), gap(300, 30)]);
    expect(summary.pingCount).toBe(3);
  });
});
