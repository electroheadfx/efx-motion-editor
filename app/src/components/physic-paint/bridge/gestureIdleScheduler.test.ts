import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  beginInteraction,
  endInteraction,
  GESTURE_IDLE_WINDOW_MS,
  interactionIdle,
  markInteractionActive,
  onInteractionIdle,
  readInteractionIdle,
} from './gestureIdleScheduler';

describe('gesture-idle scheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Reset the module-level state: the signal starts idle, but a prior test
    // may have left an active pointer or a pending timer.
    interactionIdle.value = true;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts idle', () => {
    expect(readInteractionIdle()).toBe(true);
  });

  it('closes the gate on pointerdown and reopens after pointerup + the idle window', async () => {
    beginInteraction(1);
    expect(readInteractionIdle()).toBe(false);

    endInteraction(1);
    expect(readInteractionIdle()).toBe(false);

    await vi.advanceTimersByTimeAsync(GESTURE_IDLE_WINDOW_MS - 1);
    expect(readInteractionIdle()).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    expect(readInteractionIdle()).toBe(true);
  });

  it('never flips idle mid-drag: a 2s drag with throttled moves stays closed', async () => {
    beginInteraction(1);
    // Simulate a 2s drag: throttled pointermove re-arms the timer, and the
    // non-empty active-pointer set blocks the idle transition even if the
    // timer fires during a hold-still.
    for (let elapsed = 0; elapsed < 2000; elapsed += 100) {
      markInteractionActive();
      await vi.advanceTimersByTimeAsync(100);
    }
    expect(readInteractionIdle()).toBe(false);

    endInteraction(1);
    await vi.advanceTimersByTimeAsync(GESTURE_IDLE_WINDOW_MS);
    expect(readInteractionIdle()).toBe(true);
  });

  it('stays closed while any pointer is active, reopening only after all end', async () => {
    beginInteraction(1);
    beginInteraction(2);
    endInteraction(1);
    await vi.advanceTimersByTimeAsync(GESTURE_IDLE_WINDOW_MS);
    expect(readInteractionIdle()).toBe(false);

    endInteraction(2);
    await vi.advanceTimersByTimeAsync(GESTURE_IDLE_WINDOW_MS);
    expect(readInteractionIdle()).toBe(true);
  });

  it('notifies idle listeners exactly once per idle transition', async () => {
    const listener = vi.fn();
    const unsubscribe = onInteractionIdle(listener);

    beginInteraction(1);
    endInteraction(1);
    await vi.advanceTimersByTimeAsync(GESTURE_IDLE_WINDOW_MS);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    beginInteraction(1);
    endInteraction(1);
    await vi.advanceTimersByTimeAsync(GESTURE_IDLE_WINDOW_MS);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
