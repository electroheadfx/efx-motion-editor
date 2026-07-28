export type PhysicsPaintPerformanceCategory = 'sync-cpu' | 'scheduled-wait' | 'async-elapsed' | 'input-delay';

export interface PhysicsPaintPerformanceSample {
  stage: string;
  category: PhysicsPaintPerformanceCategory;
  durationMs: number;
  timestamp: number;
  mutationId?: number;
  sourceFrame?: number;
  branch?: string;
  outcome?: string;
}

export interface PhysicsPaintPerformanceStageSummary {
  stage: string;
  category: PhysicsPaintPerformanceCategory;
  branch?: string;
  outcome?: string;
  count: number;
  medianMs: number;
  p95Ms: number;
  maxMs: number;
  correlatedInputDelayCount: number;
}

export interface PhysicsPaintPerformanceSummary {
  sampleCount: number;
  stages: PhysicsPaintPerformanceStageSummary[];
  recentInputDelays: Array<Pick<PhysicsPaintPerformanceSample, 'durationMs' | 'mutationId' | 'timestamp'>>;
  recentCriticalSamples: PhysicsPaintPerformanceSample[];
}

export const PHYSICS_PAINT_PERFORMANCE_COUNTER_NAMES = [
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

export type PhysicsPaintPerformanceCounterName = typeof PHYSICS_PAINT_PERFORMANCE_COUNTER_NAMES[number];
export type PhysicsPaintPerformanceCounterSnapshot = Readonly<Record<PhysicsPaintPerformanceCounterName, number>>;

export interface PhysicsPaintPerformanceSnapshot {
  readonly summary: PhysicsPaintPerformanceSummary;
  readonly counters: PhysicsPaintPerformanceCounterSnapshot;
}

const PROFILE_STORAGE_KEY = 'efx.physicsPaint.profile';
const MAX_SAMPLES = 600;
const CRITICAL_STAGES = new Set([
  'pointer-up',
  'stroke-finalization-queue-wait',
  'stroke-first-raster-publication',
  'stroke-finalization',
  'next-pointerdown-dispatch',
]);
const samples: PhysicsPaintPerformanceSample[] = [];
const counters = new Map<PhysicsPaintPerformanceCounterName, number>();

function profilingEnabled(): boolean {
  return typeof window !== 'undefined'
    && import.meta.env.DEV
    && window.localStorage?.getItem(PROFILE_STORAGE_KEY) === '1';
}

function rounded(value: number): number {
  return Math.round(value * 100) / 100;
}

function percentile(sorted: number[], proportion: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * proportion))];
}

export function recordPhysicsPaintPerformance(sample: PhysicsPaintPerformanceSample): void {
  if (!profilingEnabled() || !Number.isFinite(sample.durationMs) || sample.durationMs < 0) return;
  samples.push({ ...sample, durationMs: rounded(sample.durationMs) });
  while (samples.length > MAX_SAMPLES) {
    const removable = samples.findIndex((candidate) => !CRITICAL_STAGES.has(candidate.stage));
    samples.splice(removable >= 0 ? removable : 0, 1);
  }
}

export function recordPhysicsPaintPerformanceCounter(
  name: PhysicsPaintPerformanceCounterName,
  amount = 1,
): void {
  if (!profilingEnabled() || !Number.isInteger(amount) || amount <= 0) return;
  counters.set(name, (counters.get(name) ?? 0) + amount);
}

export function clearPhysicsPaintPerformance(): void {
  samples.length = 0;
  counters.clear();
}

export function summarizePhysicsPaintPerformance(): PhysicsPaintPerformanceSummary {
  const inputDelays = samples.filter((sample) => sample.category === 'input-delay');
  const grouped = new Map<string, PhysicsPaintPerformanceSample[]>();
  for (const sample of samples) {
    const key = `${sample.category}:${sample.stage}:${sample.branch ?? ''}:${sample.outcome ?? ''}`;
    const current = grouped.get(key);
    if (current) current.push(sample);
    else grouped.set(key, [sample]);
  }

  const stages = Array.from(grouped.values()).map((stageSamples) => {
    const [first] = stageSamples;
    const durations = stageSamples.map((sample) => sample.durationMs).sort((a, b) => a - b);
    const mutationIds = new Set(stageSamples.flatMap((sample) => sample.mutationId === undefined ? [] : [sample.mutationId]));
    return {
      stage: first.stage,
      category: first.category,
      ...(first.branch ? { branch: first.branch } : {}),
      ...(first.outcome ? { outcome: first.outcome } : {}),
      count: stageSamples.length,
      medianMs: rounded(percentile(durations, 0.5)),
      p95Ms: rounded(percentile(durations, 0.95)),
      maxMs: rounded(durations[durations.length - 1] ?? 0),
      correlatedInputDelayCount: inputDelays.filter((sample) => sample.mutationId !== undefined && mutationIds.has(sample.mutationId)).length,
    };
  }).sort((a, b) => b.p95Ms - a.p95Ms || a.stage.localeCompare(b.stage));

  return {
    sampleCount: samples.length,
    stages,
    recentInputDelays: inputDelays.slice(-20).map(({ durationMs, mutationId, timestamp }) => ({ durationMs, mutationId, timestamp })),
    recentCriticalSamples: samples.filter((sample) => CRITICAL_STAGES.has(sample.stage)).slice(-40),
  };
}

function snapshotCounters(): PhysicsPaintPerformanceCounterSnapshot {
  return Object.freeze(Object.fromEntries(
    PHYSICS_PAINT_PERFORMANCE_COUNTER_NAMES.map((name) => [name, counters.get(name) ?? 0]),
  ) as Record<PhysicsPaintPerformanceCounterName, number>);
}

function detachedSummary(): PhysicsPaintPerformanceSummary {
  const summary = summarizePhysicsPaintPerformance();
  return Object.freeze({
    sampleCount: summary.sampleCount,
    stages: Object.freeze(summary.stages.map((stage) => Object.freeze({ ...stage }))),
    recentInputDelays: Object.freeze(summary.recentInputDelays.map((sample) => Object.freeze({ ...sample }))),
    recentCriticalSamples: Object.freeze(summary.recentCriticalSamples.map((sample) => Object.freeze({ ...sample }))),
  }) as PhysicsPaintPerformanceSummary;
}

export function snapshotPhysicsPaintPerformance(): PhysicsPaintPerformanceSnapshot {
  return Object.freeze({
    summary: detachedSummary(),
    counters: snapshotCounters(),
  });
}

function snapshotCounterValue(
  snapshot: PhysicsPaintPerformanceSnapshot,
  name: PhysicsPaintPerformanceCounterName,
): number {
  const value = (snapshot.counters as Readonly<Record<string, unknown>>)[name];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export function diffPhysicsPaintPerformanceSnapshots(
  before: PhysicsPaintPerformanceSnapshot,
  after: PhysicsPaintPerformanceSnapshot,
): PhysicsPaintPerformanceCounterSnapshot {
  return Object.freeze(Object.fromEntries(
    PHYSICS_PAINT_PERFORMANCE_COUNTER_NAMES.map((name) => [
      name,
      snapshotCounterValue(after, name) - snapshotCounterValue(before, name),
    ]),
  ) as Record<PhysicsPaintPerformanceCounterName, number>);
}

export function isPhysicsPaintProfilingEnabled(): boolean {
  return profilingEnabled();
}

if (typeof window !== 'undefined' && import.meta.env.DEV) {
  Object.defineProperty(window, '__EFX_PHYSICS_PAINT_PROFILE__', {
    configurable: true,
    value: {
      clear: clearPhysicsPaintPerformance,
      summary: summarizePhysicsPaintPerformance,
      snapshot: snapshotPhysicsPaintPerformance,
      delta: diffPhysicsPaintPerformanceSnapshots,
    },
  });
}

declare global {
  interface Window {
    __EFX_PHYSICS_PAINT_PROFILE__?: {
      clear: () => void;
      summary: () => PhysicsPaintPerformanceSummary;
      snapshot: () => PhysicsPaintPerformanceSnapshot;
      delta: (
        before: PhysicsPaintPerformanceSnapshot,
        after: PhysicsPaintPerformanceSnapshot,
      ) => PhysicsPaintPerformanceCounterSnapshot;
    };
  }
}
