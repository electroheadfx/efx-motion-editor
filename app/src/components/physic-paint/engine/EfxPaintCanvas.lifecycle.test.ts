import { describe, expect, it, vi } from 'vitest';
import type { EfxPaintEngine } from '@efxlab/efx-physic-paint';
import { initializeEfxPaintCanvasEngine } from '@efxlab/efx-physic-paint/preact';

function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('EfxPaintCanvas readiness lifecycle', () => {
  it('never publishes an obsolete engine after cleanup and preserves cooperative destroy ordering', async () => {
    const initA = deferred();
    const initB = deferred();
    const drainA = deferred();
    const events: string[] = [];
    const engineA = { init: vi.fn(() => initA.promise) } as unknown as EfxPaintEngine;
    const engineB = { init: vi.fn(() => initB.promise) } as unknown as EfxPaintEngine;
    const onReady = vi.fn((engine: EfxPaintEngine) => {
      events.push(engine === engineA ? 'ready-a' : 'ready-b');
    });

    const cleanupA = initializeEfxPaintCanvasEngine({
      engine: engineA,
      onEngineReady: onReady,
      beforeEngineDestroy: () => {
        events.push('drain-a');
        return drainA.promise;
      },
      destroy: () => events.push('destroy-a'),
    });
    cleanupA();

    initializeEfxPaintCanvasEngine({
      engine: engineB,
      onEngineReady: onReady,
      destroy: () => events.push('destroy-b'),
    });
    initB.resolve();
    await initB.promise;
    await Promise.resolve();
    initA.resolve();
    await initA.promise;
    await Promise.resolve();

    expect(onReady).toHaveBeenCalledTimes(1);
    expect(onReady).toHaveBeenCalledWith(engineB);
    expect(events).toEqual(['drain-a', 'ready-b']);

    drainA.resolve();
    await drainA.promise;
    await Promise.resolve();
    expect(events).toEqual(['drain-a', 'ready-b', 'destroy-a']);
  });

  it('does not publish a late init failure from an obsolete engine', async () => {
    const init = deferred();
    const onReady = vi.fn();
    const engine = { init: vi.fn(() => init.promise) } as unknown as EfxPaintEngine;
    const cleanup = initializeEfxPaintCanvasEngine({ engine, onEngineReady: onReady, destroy: vi.fn() });

    cleanup();
    init.reject(new Error('late init failure'));
    await expect(init.promise).rejects.toThrow('late init failure');
    await Promise.resolve();

    expect(onReady).not.toHaveBeenCalled();
  });
});
