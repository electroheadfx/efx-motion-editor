import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PHYSICS_PAINT_PERFORMANCE_COUNTER_NAMES,
  clearPhysicsPaintPerformance,
  diffPhysicsPaintPerformanceSnapshots,
  recordPhysicsPaintPerformance,
  recordPhysicsPaintPerformanceCounter,
  snapshotPhysicsPaintPerformance,
  summarizePhysicsPaintPerformance,
} from './physicsPaintPerformanceTrace';

const EXPECTED_COUNTER_NAMES = [
  'render.studio',
  'render.studioView',
  'render.topBar',
  'render.toolRailImpl',
  'render.rightPanelRegion',
  'render.rightPanelImpl',
  'render.playScriptDialog',
  'render.canvasStack',
  'render.canvasMount',
  'render.efxChildRequest',
  'render.workflowStrip',
  'render.workflowStaticChrome',
  'render.rotoTimelineCellButton',
  'observer.canvasStack.resize.install',
  'observer.canvasStack.resize.cleanup',
  'observer.canvasStack.mutation.install',
  'observer.canvasStack.mutation.cleanup',
  'observer.canvasMount.resize.install',
  'observer.canvasMount.resize.cleanup',
  'observer.timeline.resize.install',
  'observer.timeline.resize.cleanup',
  'lifecycle.canvasMount.engineReady',
  'lifecycle.canvasMount.beforeDestroy',
  'lifecycle.engine.tabletListener.install',
  'lifecycle.engine.tabletListener.cleanup',
  'lifecycle.engine.externalState.cleanup',
] as const;

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
    recordPhysicsPaintPerformanceCounter('render.studio');
    expect(summarizePhysicsPaintPerformance().sampleCount).toBe(0);
    expect(snapshotPhysicsPaintPerformance().counters['render.studio']).toBe(0);
  });

  it('fails closed when the localStorage property getter throws', () => {
    const restrictedWindow = {} as Window;
    Object.defineProperty(restrictedWindow, 'localStorage', {
      configurable: true,
      get: () => {
        throw new DOMException('Storage access denied', 'SecurityError');
      },
    });
    vi.stubGlobal('window', restrictedWindow);

    expect(() => {
      recordPhysicsPaintPerformance({ stage: 'restricted', category: 'sync-cpu', durationMs: 10, timestamp: 1 });
      recordPhysicsPaintPerformanceCounter('render.studio');
    }).not.toThrow();

    const snapshot = snapshotPhysicsPaintPerformance();
    expect(snapshot.summary.sampleCount).toBe(0);
    expect(snapshot.counters).toEqual(Object.fromEntries(EXPECTED_COUNTER_NAMES.map((name) => [name, 0])));
  });

  it('fails closed when localStorage.getItem throws', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => {
          throw new DOMException('Storage read denied', 'SecurityError');
        },
      },
    });

    expect(() => {
      recordPhysicsPaintPerformance({ stage: 'restricted', category: 'sync-cpu', durationMs: 10, timestamp: 1 });
      recordPhysicsPaintPerformanceCounter('render.studio');
    }).not.toThrow();

    const snapshot = snapshotPhysicsPaintPerformance();
    expect(snapshot.summary.sampleCount).toBe(0);
    expect(snapshot.counters).toEqual(Object.fromEntries(EXPECTED_COUNTER_NAMES.map((name) => [name, 0])));
  });

  it('exports one unique canonical registry covering every localized-render counter', () => {
    expect(PHYSICS_PAINT_PERFORMANCE_COUNTER_NAMES).toEqual(EXPECTED_COUNTER_NAMES);
    expect(new Set(PHYSICS_PAINT_PERFORMANCE_COUNTER_NAMES).size).toBe(EXPECTED_COUNTER_NAMES.length);
  });

  it('records named counter increments and positive integer amounts', () => {
    recordPhysicsPaintPerformanceCounter('render.studio');
    recordPhysicsPaintPerformanceCounter('render.studio', 3);
    recordPhysicsPaintPerformanceCounter('render.canvasMount', 2);

    expect(snapshotPhysicsPaintPerformance().counters).toMatchObject({
      'render.studio': 4,
      'render.canvasMount': 2,
    });
  });

  it('clears timing samples and counters while retaining explicit zero registry rows', () => {
    recordPhysicsPaintPerformance({ stage: 'snapshot', category: 'sync-cpu', durationMs: 4, timestamp: 1 });
    recordPhysicsPaintPerformanceCounter('render.studio');
    clearPhysicsPaintPerformance();

    const snapshot = snapshotPhysicsPaintPerformance();
    expect(snapshot.summary).toEqual({
      sampleCount: 0,
      stages: [],
      recentInputDelays: [],
      recentCriticalSamples: [],
    });
    expect(snapshot.counters).toEqual(Object.fromEntries(EXPECTED_COUNTER_NAMES.map((name) => [name, 0])));
    expect(diffPhysicsPaintPerformanceSnapshots(snapshot, snapshot)).toEqual(
      Object.fromEntries(EXPECTED_COUNTER_NAMES.map((name) => [name, 0])),
    );
  });

  it('returns detached snapshots that cannot change after later recorder writes', () => {
    recordPhysicsPaintPerformanceCounter('render.studio');
    const before = snapshotPhysicsPaintPerformance();
    recordPhysicsPaintPerformanceCounter('render.studio', 2);
    const after = snapshotPhysicsPaintPerformance();

    expect(before).not.toBe(after);
    expect(before.counters).not.toBe(after.counters);
    expect(before.counters['render.studio']).toBe(1);
    expect(after.counters['render.studio']).toBe(3);
  });

  it('diffs supplied snapshots across the complete registry with missing values treated as zero', () => {
    const empty = snapshotPhysicsPaintPerformance();
    const malformedBefore = {
      ...empty,
      counters: { 'render.studio': 2 },
    } as typeof empty;
    const malformedAfter = {
      ...empty,
      counters: { 'render.canvasMount': 5 },
    } as typeof empty;

    expect(diffPhysicsPaintPerformanceSnapshots(malformedBefore, malformedAfter)).toEqual({
      ...Object.fromEntries(EXPECTED_COUNTER_NAMES.map((name) => [name, 0])),
      'render.studio': -2,
      'render.canvasMount': 5,
    });
  });

  it('retains the existing native profiler object and adds snapshot plus delta methods', async () => {
    vi.resetModules();
    const nativeWindow = {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
      },
    } as Window;
    vi.stubGlobal('window', nativeWindow);

    await import('./physicsPaintPerformanceTrace');

    expect(nativeWindow.__EFX_PHYSICS_PAINT_PROFILE__).toEqual({
      clear: expect.any(Function),
      summary: expect.any(Function),
      snapshot: expect.any(Function),
      delta: expect.any(Function),
    });
    nativeWindow.__EFX_PHYSICS_PAINT_PROFILE__?.clear();
    const before = nativeWindow.__EFX_PHYSICS_PAINT_PROFILE__?.snapshot();
    const after = nativeWindow.__EFX_PHYSICS_PAINT_PROFILE__?.snapshot();
    expect(before?.counters).toEqual(Object.fromEntries(EXPECTED_COUNTER_NAMES.map((name) => [name, 0])));
    expect(nativeWindow.__EFX_PHYSICS_PAINT_PROFILE__?.delta(before!, after!)).toEqual(
      Object.fromEntries(EXPECTED_COUNTER_NAMES.map((name) => [name, 0])),
    );
  });
});
