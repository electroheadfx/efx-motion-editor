import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearPhysicsPaintPerformance,
  recordPhysicsPaintPerformance,
  summarizePhysicsPaintPerformance,
} from './physicsPaintPerformanceTrace';

const storage = new Map<string, string>();

beforeEach(() => {
  storage.clear();
  storage.set('efx.physicsPaint.profile', '1');
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
    },
  });
  clearPhysicsPaintPerformance();
});

afterEach(() => {
  clearPhysicsPaintPerformance();
  vi.unstubAllGlobals();
});

describe('Physics Paint performance trace', () => {
  it('keeps timing categories, branches, outcomes, and mutation correlations separate', () => {
    recordPhysicsPaintPerformance({ stage: 'snapshot', category: 'sync-cpu', durationMs: 4, timestamp: 1, mutationId: 7, branch: 'separated' });
    recordPhysicsPaintPerformance({ stage: 'snapshot', category: 'sync-cpu', durationMs: 8, timestamp: 2, mutationId: 7, branch: 'separated' });
    recordPhysicsPaintPerformance({ stage: 'snapshot', category: 'sync-cpu', durationMs: 20, timestamp: 3, mutationId: 8, branch: 'background-subtraction' });
    recordPhysicsPaintPerformance({ stage: 'cache-revision-check', category: 'sync-cpu', durationMs: 0, timestamp: 4, mutationId: 7, outcome: 'stale-before-commit' });
    recordPhysicsPaintPerformance({ stage: 'next-pointerdown-dispatch', category: 'input-delay', durationMs: 12, timestamp: 5, mutationId: 7 });

    expect(summarizePhysicsPaintPerformance()).toEqual({
      sampleCount: 5,
      stages: [
        expect.objectContaining({ stage: 'snapshot', branch: 'background-subtraction', count: 1, medianMs: 20, p95Ms: 20, maxMs: 20, correlatedInputDelayCount: 0 }),
        expect.objectContaining({ stage: 'next-pointerdown-dispatch', category: 'input-delay', count: 1, medianMs: 12 }),
        expect.objectContaining({ stage: 'snapshot', branch: 'separated', count: 2, medianMs: 4, p95Ms: 4, maxMs: 8, correlatedInputDelayCount: 1 }),
        expect.objectContaining({ stage: 'cache-revision-check', outcome: 'stale-before-commit', count: 1, medianMs: 0, correlatedInputDelayCount: 1 }),
      ],
      recentInputDelays: [{ durationMs: 12, mutationId: 7, timestamp: 5 }],
      recentCriticalSamples: [
        { stage: 'next-pointerdown-dispatch', category: 'input-delay', durationMs: 12, mutationId: 7, timestamp: 5 },
      ],
    });
  });

  it('keeps only a bounded recent sample set while retaining critical interaction timings', () => {
    recordPhysicsPaintPerformance({ stage: 'stroke-finalization-queue-wait', category: 'scheduled-wait', durationMs: 520, timestamp: 1, mutationId: 7 });
    for (let index = 0; index < 610; index++) {
      recordPhysicsPaintPerformance({ stage: 'bounded', category: 'async-elapsed', durationMs: index, timestamp: index + 2 });
    }

    const summary = summarizePhysicsPaintPerformance();
    expect(summary.sampleCount).toBe(600);
    expect(summary.stages).toEqual(expect.arrayContaining([
      expect.objectContaining({ stage: 'stroke-finalization-queue-wait', count: 1, maxMs: 520 }),
      expect.objectContaining({ stage: 'bounded', count: 599, maxMs: 609 }),
    ]));
    expect(summary.recentCriticalSamples).toEqual([
      { stage: 'stroke-finalization-queue-wait', category: 'scheduled-wait', durationMs: 520, timestamp: 1, mutationId: 7 },
    ]);
  });

  it('records nothing while profiling is disabled', () => {
    storage.delete('efx.physicsPaint.profile');
    recordPhysicsPaintPerformance({ stage: 'disabled', category: 'sync-cpu', durationMs: 10, timestamp: 1 });
    expect(summarizePhysicsPaintPerformance().sampleCount).toBe(0);
  });
});
