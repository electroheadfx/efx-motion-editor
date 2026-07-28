import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createRotoNavigationGeneration, createRotoUiFlushScheduler } from './rotoUiFlushScheduler';

describe('createRotoUiFlushScheduler (38.1 D-04)', () => {
  let pendingCallbacks: (FrameRequestCallback | null)[];
  let rafStub: ReturnType<typeof vi.fn>;
  let cancelStub: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    pendingCallbacks = [];
    rafStub = vi.fn((callback: FrameRequestCallback) => {
      pendingCallbacks.push(callback);
      return pendingCallbacks.length;
    });
    cancelStub = vi.fn((id: number) => {
      pendingCallbacks[id - 1] = null;
    });
    vi.stubGlobal('requestAnimationFrame', rafStub);
    vi.stubGlobal('cancelAnimationFrame', cancelStub);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function fireAllPending(): void {
    const fired = pendingCallbacks;
    pendingCallbacks = [];
    for (const callback of fired) {
      callback?.(0);
    }
  }

  it('coalesces a synchronous burst of schedule() calls into exactly one flush per animation frame', () => {
    const scheduler = createRotoUiFlushScheduler();
    let flushCount = 0;
    for (let i = 0; i < 5; i += 1) {
      scheduler.schedule(() => {
        flushCount += 1;
      });
    }
    expect(rafStub).toHaveBeenCalledTimes(1);
    fireAllPending();
    expect(flushCount).toBe(1);
  });

  it('re-arms after the pending callback fires so a later schedule() flushes again', () => {
    const scheduler = createRotoUiFlushScheduler();
    let flushCount = 0;
    const flush = () => {
      flushCount += 1;
    };
    scheduler.schedule(flush);
    fireAllPending();
    expect(flushCount).toBe(1);

    scheduler.schedule(flush);
    expect(rafStub).toHaveBeenCalledTimes(2);
    fireAllPending();
    expect(flushCount).toBe(2);
  });

  it('reads the latest state at fire time when several payloads are scheduled in one frame', () => {
    const scheduler = createRotoUiFlushScheduler();
    let payload = 'first';
    const observed: string[] = [];
    const flush = () => {
      observed.push(payload);
    };
    scheduler.schedule(flush);
    payload = 'second';
    scheduler.schedule(flush);
    fireAllPending();
    expect(observed).toEqual(['second']);
  });

  it('runs the LATEST scheduled flush when several distinct flushes are scheduled in one frame (38.1 D-05 latest-wins)', () => {
    const scheduler = createRotoUiFlushScheduler();
    const observed: string[] = [];
    // Each navigation captures its frame in a per-call closure (the Studio
    // call site); only the latest navigation's flush may run at fire time.
    scheduler.schedule(() => {
      observed.push('frame-5');
    });
    scheduler.schedule(() => {
      observed.push('frame-7');
    });
    fireAllPending();
    expect(observed).toEqual(['frame-7']);
  });

  it('dispose() before the frame fires prevents the pending flush and resets the guard', () => {
    const scheduler = createRotoUiFlushScheduler();
    let flushCount = 0;
    const flush = () => {
      flushCount += 1;
    };
    scheduler.schedule(flush);
    expect(scheduler.isPending()).toBe(true);

    scheduler.dispose();
    expect(scheduler.isPending()).toBe(false);
    expect(cancelStub).toHaveBeenCalledTimes(1);
    fireAllPending();
    expect(flushCount).toBe(0);

    scheduler.schedule(flush);
    expect(scheduler.isPending()).toBe(true);
    fireAllPending();
    expect(flushCount).toBe(1);
  });

  it('never revokes the posted frame to re-post it later during a coalescing burst', () => {
    const scheduler = createRotoUiFlushScheduler();
    const noop = () => {};
    scheduler.schedule(noop);
    const posted = pendingCallbacks[0];
    scheduler.schedule(noop);
    scheduler.schedule(noop);
    expect(rafStub).toHaveBeenCalledTimes(1);
    expect(cancelStub).not.toHaveBeenCalled();
    expect(pendingCallbacks.length).toBe(1);
    expect(pendingCallbacks[0]).toBe(posted);
  });
});

describe('createRotoNavigationGeneration (38.1 D-05)', () => {
  it('begin() returns strictly increasing generation tokens', () => {
    const generation = createRotoNavigationGeneration();
    const first = generation.begin();
    const second = generation.begin();
    const third = generation.begin();
    expect(first).toBe(1);
    expect(second).toBe(2);
    expect(third).toBe(3);
    expect(second).toBeGreaterThan(first);
    expect(third).toBeGreaterThan(second);
  });

  it('isLatest() is true only for the most recent begin() token', () => {
    const generation = createRotoNavigationGeneration();
    const first = generation.begin();
    const second = generation.begin();
    expect(generation.isLatest(second)).toBe(true);
    expect(generation.isLatest(first)).toBe(false);

    const third = generation.begin();
    expect(generation.isLatest(third)).toBe(true);
    expect(generation.isLatest(second)).toBe(false);
    expect(generation.isLatest(first)).toBe(false);
  });

  it('a token that was never superseded remains latest indefinitely (discrete-click rule)', () => {
    const generation = createRotoNavigationGeneration();
    const click = generation.begin();
    // Skipping applies only when a NEWER navigation exists; a discrete click
    // whose generation was never superseded always paints.
    expect(generation.isLatest(click)).toBe(true);
    expect(generation.isLatest(click)).toBe(true);
    expect(generation.isLatest(click)).toBe(true);
  });
});
