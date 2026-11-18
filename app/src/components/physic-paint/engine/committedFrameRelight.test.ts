import { DEFAULT_LIGHT } from '@efxlab/efx-watercolor';
import { describe, expect, it, vi } from 'vitest';
import { lightSignature } from './physicsPaintStudioSettings';
import { createSingleFlightRelight, lightChangeNeedsRelight } from './committedFrameRelight';

/** Let the controller's queued async continuations drain. */
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

// ============================================================
// 64-19 (CR-01 / MED-17) — one bounded re-bake per light change.
//
// CR-01: the committed frame cache now carries the light term, so a light
// change is a cache miss — but nothing re-baked the VISIBLE committed frame,
// so the sheet stayed on the previous shading until some unrelated render.
// The relight controller is the bounded scheduler: one bake in flight, at
// most one queued follow-up, a swallowed rejection, and exactly one automatic
// follow-up when the Apply lane answered "busy" (resolved false).
// ============================================================
describe('64-19 committed-frame relight (CR-01, MED-17)', () => {
  it('an absent light and the explicit DEFAULT_LIGHT are the same light (no relight)', () => {
    // The canonical `lightSignature` normalizes both to `default` — two terms
    // for one picture would re-bake the sheet for nothing.
    expect(lightChangeNeedsRelight('default', undefined)).toBe(false);
    expect(lightChangeNeedsRelight('default', { ...DEFAULT_LIGHT })).toBe(false);
    expect(lightChangeNeedsRelight(
      lightSignature({ ...DEFAULT_LIGHT, azimuth: 210 }),
      { ...DEFAULT_LIGHT, azimuth: 210 },
    )).toBe(false);
  });

  it('a real light change needs a relight', () => {
    expect(lightChangeNeedsRelight('default', { ...DEFAULT_LIGHT, azimuth: 210 })).toBe(true);
    expect(lightChangeNeedsRelight(
      lightSignature({ ...DEFAULT_LIGHT, azimuth: 210 }),
      { ...DEFAULT_LIGHT, azimuth: 40 },
    )).toBe(true);
  });

  it('runs one bake at a time: three requests during one run coalesce into exactly ONE follow-up', async () => {
    let active = 0;
    let maxActive = 0;
    const gates: Array<() => void> = [];
    const run = vi.fn(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise<void>((resolve) => { gates.push(resolve); });
      active -= 1;
      return true;
    });
    const relight = createSingleFlightRelight(run);

    relight.request();
    relight.request();
    relight.request();
    relight.request();
    expect(run, 'one run in flight').toHaveBeenCalledTimes(1);

    gates.shift()!();
    await flush();
    expect(run, 'exactly one follow-up for any number of requests').toHaveBeenCalledTimes(2);

    const settled = relight.settle();
    gates.shift()!();
    await settled;
    expect(run, 'no further runs after the follow-up').toHaveBeenCalledTimes(2);
    expect(maxActive, 'never two overlapping runs').toBe(1);
  });

  it('a busy false result earns exactly ONE follow-up, then stops (bounded)', async () => {
    const results = [false, false, true, true];
    const run = vi.fn(async () => results.shift() ?? true);
    const relight = createSingleFlightRelight(run);

    relight.request();
    await relight.settle();
    expect(run, 'initial run + exactly one busy retry, never more').toHaveBeenCalledTimes(2);

    relight.request();
    await relight.settle();
    expect(run, 'a fresh request opens a new burst').toHaveBeenCalledTimes(3);
  });

  it('a rejected run is swallowed and never wedges the controller', async () => {
    let calls = 0;
    const run = vi.fn(async () => {
      calls += 1;
      if (calls === 1) throw new Error('the Apply lane exploded');
      return true;
    });
    const relight = createSingleFlightRelight(run);

    relight.request();
    await expect(relight.settle()).resolves.toBeUndefined();
    expect(run, 'a rejection earns no automatic retry').toHaveBeenCalledTimes(1);

    relight.request();
    await expect(relight.settle()).resolves.toBeUndefined();
    expect(run, 'the next request starts a fresh run').toHaveBeenCalledTimes(2);
  });

  it('settle resolves only after the in-flight run and the queued follow-up complete', async () => {
    let call = 0;
    let releaseSecond: (() => void) | null = null;
    const run = async () => {
      call += 1;
      if (call === 2) {
        await new Promise<void>((resolve) => { releaseSecond = resolve; });
      }
      return true;
    };
    const relight = createSingleFlightRelight(run);

    relight.request();
    relight.request();
    await flush();
    expect(call, 'the queued follow-up is in flight').toBe(2);

    let settled = false;
    const settledPromise = relight.settle().then(() => { settled = true; });
    await flush();
    expect(settled, 'settle waits for the gated follow-up').toBe(false);

    releaseSecond!();
    await settledPromise;
    expect(settled).toBe(true);
  });
});
