import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createFinalizationLifecycle,
  finalizationLifecycle,
  FINALIZATION_STATES,
  isFinalizationDrainable,
  isFinalizationSettledState,
  type FinalizationLifecycle,
  type FinalizationState,
} from './finalizationMachine';
import {
  beginInteraction,
  endInteraction,
  GESTURE_IDLE_WINDOW_MS,
  interactionIdle,
  markInteractionActive,
  readInteractionIdle,
} from '../bridge/gestureIdleScheduler';

/**
 * D-16 pilot: the stroke-finalization lifecycle is one declared machine whose
 * snapshot is the only lifecycle read. These cases pin the state vocabulary,
 * the pointer rules (a new gesture is never swallowed) and the fact that the
 * idle outcome needs BOTH zero pointers and the silence window.
 */
describe('stroke-finalization machine', () => {
  const extraLifecycles: FinalizationLifecycle[] = [];
  const lifecycle = (): FinalizationLifecycle => {
    const created = createFinalizationLifecycle();
    extraLifecycles.push(created);
    return created;
  };

  afterEach(() => {
    for (const created of extraLifecycles.splice(0)) created.stop();
    vi.useRealTimers();
    // The module singleton is driven through the scheduler's public commands;
    // each singleton case below leaves it idle, and the signal stays writable
    // for the scheduler's own contract suite.
    interactionIdle.value = true;
  });

  it('exposes one lifecycle signal drawn from the declared vocabulary', () => {
    const machine = lifecycle();
    const seen: FinalizationState[] = [];
    machine.state.subscribe((state) => {
      if (seen[seen.length - 1] !== state) seen.push(state);
    });

    expect(FINALIZATION_STATES).toEqual(['idle', 'active', 'queued', 'draining', 'flushing']);
    expect(machine.state.value).toBe('idle');

    machine.pointerDown(1);
    expect(machine.state.value).toBe('active');
    machine.pointerUp(0);
    expect(machine.state.value).toBe('queued');
    machine.workQueued();
    expect(machine.state.value).toBe('queued');
    machine.idleWindowElapsed();
    expect(machine.state.value).toBe('draining');
    machine.workSettled();
    expect(machine.state.value).toBe('idle');

    // One signal write per transition: no duplicate values reach a subscriber.
    expect(seen).toEqual(['idle', 'active', 'queued', 'draining', 'idle']);
  });

  it('returns to active when a new gesture starts while queued or draining', () => {
    const machine = lifecycle();
    machine.pointerDown(1);
    machine.pointerUp(0);
    expect(machine.state.value).toBe('queued');

    // A new gesture is never swallowed by the pending idle window.
    machine.pointerDown(1);
    expect(machine.state.value).toBe('active');

    machine.pointerUp(0);
    machine.workQueued();
    machine.idleWindowElapsed();
    expect(machine.state.value).toBe('draining');

    // Nor is it swallowed by a running drain.
    machine.pointerDown(1);
    expect(machine.state.value).toBe('active');
    machine.pointerUp(0);
    expect(machine.state.value).toBe('queued');
    machine.idleWindowElapsed();
    expect(machine.state.value).toBe('draining');
    machine.workSettled();
    expect(machine.state.value).toBe('idle');
  });

  it('reaches idle only after zero pointers and the full silence window', async () => {
    vi.useFakeTimers();
    beginInteraction(1);
    expect(finalizationLifecycle.state.value).toBe('active');

    // A held pointer can never age into idle, no matter how long it holds.
    await vi.advanceTimersByTimeAsync(GESTURE_IDLE_WINDOW_MS * 4);
    expect(finalizationLifecycle.state.value).toBe('active');
    expect(readInteractionIdle()).toBe(false);

    endInteraction(1);
    expect(finalizationLifecycle.state.value).toBe('queued');
    await vi.advanceTimersByTimeAsync(GESTURE_IDLE_WINDOW_MS - 1);
    expect(finalizationLifecycle.state.value).toBe('queued');
    await vi.advanceTimersByTimeAsync(1);
    expect(finalizationLifecycle.state.value).toBe('idle');
    expect(readInteractionIdle()).toBe(true);
  });

  it('holds queued work out of the drain until the silence window elapses', async () => {
    vi.useFakeTimers();
    beginInteraction(1);
    finalizationLifecycle.workQueued();
    endInteraction(1);
    expect(finalizationLifecycle.state.value).toBe('queued');
    expect(isFinalizationDrainable(finalizationLifecycle.state.value)).toBe(false);

    await vi.advanceTimersByTimeAsync(GESTURE_IDLE_WINDOW_MS);
    expect(finalizationLifecycle.state.value).toBe('draining');
    expect(isFinalizationDrainable(finalizationLifecycle.state.value)).toBe(true);
    expect(readInteractionIdle()).toBe(true);

    finalizationLifecycle.workSettled();
    expect(finalizationLifecycle.state.value).toBe('idle');
  });

  it('stays active while any pointer remains and queues on the last pointer up', () => {
    const machine = lifecycle();
    machine.pointerDown(1);
    machine.pointerDown(2);
    machine.pointerUp(1);
    expect(machine.state.value).toBe('active');
    machine.pointerUp(0);
    expect(machine.state.value).toBe('queued');
  });

  it('projects a forced flush and re-derives the settled state on settle', () => {
    const machine = lifecycle();
    machine.beginFlushing();
    expect(machine.state.value).toBe('flushing');
    machine.settleFlushing();
    expect(machine.state.value).toBe('idle');

    machine.workQueued();
    expect(machine.state.value).toBe('draining');
    machine.beginFlushing();
    expect(machine.state.value).toBe('flushing');
    machine.settleFlushing();
    expect(machine.state.value).toBe('draining');
    machine.workSettled();
    expect(machine.state.value).toBe('idle');
  });

  it('does not open the flush state under an active pointer', () => {
    const machine = lifecycle();
    machine.pointerDown(1);
    machine.beginFlushing();
    expect(machine.state.value).toBe('active');
    expect(isFinalizationSettledState(machine.state.value)).toBe(false);

    machine.pointerUp(0);
    expect(machine.state.value).toBe('queued');
    expect(isFinalizationSettledState(machine.state.value)).toBe(false);
  });

  it('resolves a drain waiter on the drainable transition and yields a macrotask when already drainable', async () => {
    vi.useFakeTimers();
    const machine = lifecycle();

    let becameDrainable = false;
    void machine.waitUntilDrainable().then(() => {
      becameDrainable = true;
    });
    await Promise.resolve();
    expect(becameDrainable).toBe(false);

    machine.workQueued();
    await Promise.resolve();
    expect(becameDrainable).toBe(true);

    // Already drainable: the yield is a macrotask so a deferred produce never
    // runs ahead of pending input.
    let yielded = false;
    const waiting = machine.waitUntilDrainable().then(() => {
      yielded = true;
    });
    await Promise.resolve();
    expect(yielded).toBe(false);
    await vi.advanceTimersByTimeAsync(0);
    await waiting;
    expect(yielded).toBe(true);

    machine.workSettled();
    expect(machine.state.value).toBe('idle');
  });

  it('keeps markInteractionActive on the quiet-window clock only', async () => {
    vi.useFakeTimers();
    beginInteraction(1);
    markInteractionActive();
    expect(finalizationLifecycle.state.value).toBe('active');
    expect(readInteractionIdle()).toBe(false);

    endInteraction(1);
    await vi.advanceTimersByTimeAsync(GESTURE_IDLE_WINDOW_MS);
    expect(finalizationLifecycle.state.value).toBe('idle');
  });
});
