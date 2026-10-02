/**
 * 261002 B1 split-measure — MEASURE-ONLY. Answers one question per span: is
 * there a main-thread block INSIDE it?
 *
 * A MessageChannel ping loop records `performance.now()` deltas: each delta is
 * how long the main thread was busy before the next macrotask could run. The
 * decisive read is `maxGapMs`:
 *   ~300 ms -> the block is inside the span; the sub-stage split names it
 *   ~10 ms  -> the block is outside; the input delay is temporal coincidence
 */

export interface MainThreadGap {
  readonly gapMs: number;
  /** `performance.now()` when the gap ended (the ping that noticed it). */
  readonly endedAtMs: number;
}

export interface MainThreadGapSummary {
  readonly pingCount: number;
  readonly p50GapMs: number;
  readonly maxGapMs: number;
  readonly maxGapEndedAtMs: number;
  readonly gapsOver50Ms: readonly MainThreadGap[];
}

/** Per-gap samples are noise below this; the summary covers the rest. */
export const MAIN_THREAD_GAP_REPORTING_FLOOR_MS = 50;

export function summarizeMainThreadGaps(gaps: readonly MainThreadGap[], fallbackNowMs: number): MainThreadGapSummary {
  if (gaps.length === 0) {
    return { pingCount: 0, p50GapMs: 0, maxGapMs: 0, maxGapEndedAtMs: fallbackNowMs, gapsOver50Ms: [] };
  }
  const sorted = [...gaps].sort((a, b) => a.gapMs - b.gapMs);
  const max = sorted[sorted.length - 1];
  const p50 = sorted[Math.floor(sorted.length / 2)];
  return {
    pingCount: gaps.length,
    p50GapMs: p50.gapMs,
    maxGapMs: max.gapMs,
    maxGapEndedAtMs: max.endedAtMs,
    gapsOver50Ms: gaps.filter((gap) => gap.gapMs >= MAIN_THREAD_GAP_REPORTING_FLOOR_MS),
  };
}

export function startMainThreadGapProbe(now: () => number = () => performance.now()): () => MainThreadGapSummary {
  const gaps: MainThreadGap[] = [];
  if (typeof MessageChannel === 'undefined') {
    return () => summarizeMainThreadGaps([], now());
  }
  const channel = new MessageChannel();
  let last = now();
  let running = true;
  channel.port1.onmessage = () => {
    const at = now();
    gaps.push({ gapMs: at - last, endedAtMs: at });
    last = at;
    if (running) channel.port2.postMessage(null);
  };
  channel.port2.postMessage(null);
  return () => {
    running = false;
    channel.port1.onmessage = null;
    channel.port1.close();
    channel.port2.close();
    return summarizeMainThreadGaps(gaps, now());
  };
}
