import { DEFAULT_LIGHT } from '@efxlab/efx-watercolor';
import { describe, expect, it, vi } from 'vitest';
import { lightSignature } from './physicsPaintStudioSettings';
import {
  createSingleFlightRelight,
  lightChangeNeedsRelight,
  type SingleFlightRelight,
} from './committedFrameRelight';

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

// ============================================================
// 64-27 (WR-04) — a refused relight is PARKED, not dropped.
//
// The runner answers `false` while playing, in Draft or in wireframe, and the
// busy-false budget is spent by the second refusal — so a light committed
// during one of those states never re-baked. The scheduler is now TOLD about
// the refusal: while blocked it starts nothing and holds ONE pending request;
// the blocked-to-idle edge drains it through the same single-run-in-flight
// path a request takes. No timer, no polling, no second run beside a run.
// ============================================================
describe('64-27 parked committed-frame relight (WR-04)', () => {
  type BlockAwareRelight = SingleFlightRelight & { setBlocked?: (blocked: boolean) => void };

  /**
   * The gate setter the scheduler must expose. Resolving it through an
   * assertion keeps every test failing on its planned behaviour instead of a
   * missing-method TypeError.
   */
  const blocker = (relight: SingleFlightRelight) => {
    const setBlocked = (relight as BlockAwareRelight).setBlocked;
    expect(typeof setBlocked, 'the scheduler knows about an external refusal').toBe('function');
    return (blocked: boolean): void => {
      (relight as BlockAwareRelight).setBlocked?.(blocked);
    };
  };

  it('a blocked request starts nothing: any number of requests park ONE run that the idle edge starts exactly once', async () => {
    const run = vi.fn(async () => true);
    const relight = createSingleFlightRelight(run);
    const setBlocked = blocker(relight);

    setBlocked(true);
    relight.request();
    relight.request();
    relight.request();
    await flush();
    expect(run, 'nothing starts while blocked').toHaveBeenCalledTimes(0);

    setBlocked(false);
    await relight.settle();
    expect(run, 'the idle edge starts exactly ONE parked run').toHaveBeenCalledTimes(1);

    setBlocked(false);
    await flush();
    expect(run, 'a second idle edge with nothing parked starts none').toHaveBeenCalledTimes(1);
  });

  it('a false result while blocked parks instead of spending the automatic follow-up', async () => {
    const gates: Array<() => void> = [];
    let result = false;
    const run = vi.fn(async () => {
      await new Promise<void>((resolve) => { gates.push(resolve); });
      return result;
    });
    const relight = createSingleFlightRelight(run);
    const setBlocked = blocker(relight);

    relight.request();
    expect(run, 'the first run is in flight').toHaveBeenCalledTimes(1);
    setBlocked(true);
    gates.shift()!();
    await flush();
    expect(run, 'a refused-by-state result spends no follow-up').toHaveBeenCalledTimes(1);

    result = true;
    setBlocked(false);
    await flush();
    expect(run, 'the parked run starts once the state clears').toHaveBeenCalledTimes(2);
    gates.shift()!();
    await relight.settle();
    expect(run, 'no further runs after the parked one').toHaveBeenCalledTimes(2);
  });

  it('an unblock while a run is still in flight queues the parked request — never a second run beside it', async () => {
    const gates: Array<() => void> = [];
    let active = 0;
    let maxActive = 0;
    const run = vi.fn(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise<void>((resolve) => { gates.push(resolve); });
      active -= 1;
      return true;
    });
    const relight = createSingleFlightRelight(run);
    const setBlocked = blocker(relight);

    relight.request();
    setBlocked(true);
    relight.request();
    relight.request();
    setBlocked(false);
    await flush();
    expect(run, 'the parked request waits for the in-flight run').toHaveBeenCalledTimes(1);

    gates.shift()!();
    await flush();
    expect(run, 'the parked request starts on that run’s completion').toHaveBeenCalledTimes(2);

    const settled = relight.settle();
    gates.shift()!();
    await settled;
    expect(maxActive, 'never two overlapping runs').toBe(1);
    expect(run, 'the parked run was not lost').toHaveBeenCalledTimes(2);
  });

  it('settle() waits through a parked request and resolves after the unblocked run', async () => {
    const run = vi.fn(async () => true);
    const relight = createSingleFlightRelight(run);
    const setBlocked = blocker(relight);

    setBlocked(true);
    relight.request();
    let settled = false;
    const settledPromise = relight.settle().then(() => { settled = true; });
    await flush();
    expect(settled, 'a parked request is not idle').toBe(false);
    expect(run, 'nothing ran while parked').toHaveBeenCalledTimes(0);

    setBlocked(false);
    await settledPromise;
    expect(settled, 'settle resolves after the unblocked run').toBe(true);
    expect(run, 'exactly one run on the idle edge').toHaveBeenCalledTimes(1);
  });
});
