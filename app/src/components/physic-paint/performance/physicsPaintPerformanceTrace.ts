import { FRAME_LRU_BYTE_CEILING, frameLru } from '../../../lib/frameLru';

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
  'decode.lruHit',
  'decode.lruMiss',
  'decode.inflightSkip',
  'decode.pngBlob',
  'decode.fail',
  'prefetch.call',
  'generated.cacheHit',
  'generated.cacheMiss',
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
  if (typeof window === 'undefined' || !import.meta.env.DEV) return false;
  try {
    return window.localStorage?.getItem(PROFILE_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
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
  decodeRing.length = 0;
  decodeRingDropped = 0;
  stallRing.length = 0;
  stallRingDropped = 0;
  frameCacheRing.length = 0;
  frameCacheRingDropped = 0;
  // Re-anchor a running capture window so offsets restart at the clear.
  if (diagnosticsRunning) diagnosticsStartedAtMs = nowMs();
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

// ---------------------------------------------------------------------------
// Stall diagnostics (debug session 2026-09-11, periodic global stalls).
//
// Dev-gated add-on riding the same profile flag. WKWebView has no
// PerformanceObserver 'longtask', so main-thread blockage is measured as
// heartbeat drift on a 100 ms timer. A 1 s sampler records frameLru byte
// pressure, and the decode path feeds compact per-decode tuples (IPC round
// trip vs Rust codec vs rgba->ImageData vs createImageBitmap). Rings are
// bounded; capture() returns one JSON-serializable report. Telemetry only —
// no cache-policy or rendering change.
// ---------------------------------------------------------------------------

const STALL_HEARTBEAT_INTERVAL_MS = 100;
const STALL_GAP_THRESHOLD_MS = 200;
const FRAME_CACHE_SAMPLE_INTERVAL_MS = 1000;
const MAX_DECODE_RING = 1500;
const MAX_STALL_RING = 300;
const MAX_FRAME_CACHE_RING = 240;

export interface PhysicsPaintDecodeSample {
  path: 'webp' | 'png';
  origin: 'draw' | 'prefetch';
  /** JS-observed invoke round trip: Rust arg JSON parse + codec + response JSON + JS parse. */
  ipcMs: number;
  /** Rust-side codec-only wall time; -1 when not measured (PNG path or old payload). */
  codecMs: number;
  /** `new Uint8ClampedArray(rgba)` + `new ImageData(...)` — the JSON number-array copy when the payload arrives as an Array. */
  convertMs: number;
  /** `createImageBitmap(...)` resolution time (includes premultiply upload/copy). */
  bitmapMs: number;
  width: number;
  height: number;
  /** Compressed bytes fed to the decode (webp) or read from the blob (png). */
  inputBytes: number;
  /** True when the IPC payload arrived as a plain JSON number array (macOS path). */
  rgbaIsJsonArray: boolean;
}

export interface PhysicsPaintValueStats {
  count: number;
  medianMs: number;
  p95Ms: number;
  maxMs: number;
  totalMs: number;
}

export interface PhysicsPaintStallCapture {
  capturedAt: string;
  windowMs: number | null;
  frameCache: {
    ceilingBytes: number;
    byteTotalBytes: number;
    entryCount: number;
    capacityEvictions: number;
    explicitEvictions: number;
    droppedSamples: number;
    samples: Array<{ tMs: number; byteTotalBytes: number; entryCount: number; capacityEvictions: number }>;
  };
  stalls: {
    count: number;
    droppedSamples: number;
    totalMs: number;
    maxMs: number;
    samples: Array<{ tMs: number; stallMs: number }>;
  };
  decodes: {
    count: number;
    droppedSamples: number;
    byPath: { webp: number; png: number };
    byOrigin: { draw: number; prefetch: number };
    rgbaShape: { jsonArray: number; typed: number };
    stats: { ipcMs: PhysicsPaintValueStats; codecMs: PhysicsPaintValueStats; convertMs: PhysicsPaintValueStats; bitmapMs: PhysicsPaintValueStats };
    legend: string[];
    samplesIncluded: boolean;
    samples: Array<ReadonlyArray<number>>;
  };
  summary: PhysicsPaintPerformanceSummary;
  counters: PhysicsPaintPerformanceCounterSnapshot;
  environment: { userAgent: string; devicePixelRatio: number };
}

interface PhysicsPaintDecodeRingEntry extends PhysicsPaintDecodeSample {
  readonly tMs: number;
}

interface StallRingEntry {
  readonly tMs: number;
  readonly stallMs: number;
}

interface FrameCacheRingEntry {
  readonly tMs: number;
  readonly byteTotalBytes: number;
  readonly entryCount: number;
  readonly capacityEvictions: number;
}

const decodeRing: PhysicsPaintDecodeRingEntry[] = [];
let decodeRingDropped = 0;
const stallRing: StallRingEntry[] = [];
let stallRingDropped = 0;
const frameCacheRing: FrameCacheRingEntry[] = [];
let frameCacheRingDropped = 0;
let diagnosticsStartedAtMs: number | null = null;
let diagnosticsRunning = false;
let heartbeatHandle: ReturnType<typeof setInterval> | null = null;
let frameCacheHandle: ReturnType<typeof setInterval> | null = null;

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function pushBounded<T>(ring: T[], entry: T, max: number): number {
  ring.push(entry);
  let dropped = 0;
  while (ring.length > max) {
    ring.shift();
    dropped += 1;
  }
  return dropped;
}

/** Record one decode-path completion (called by the store's decode path). */
export function recordPhysicsPaintDecodeSample(sample: PhysicsPaintDecodeSample): void {
  if (!profilingEnabled()) return;
  decodeRingDropped += pushBounded(decodeRing, { ...sample, tMs: nowMs() }, MAX_DECODE_RING);
}

/**
 * Arm the stall diagnostics (idempotent; requires the profile flag). Starts the
 * main-thread heartbeat and the frameLru sampler. Returns whether diagnostics
 * are running after the call — `false` means the profile flag is absent.
 */
export function startPhysicsPaintStallDiagnostics(): boolean {
  if (!profilingEnabled() || diagnosticsRunning) return diagnosticsRunning;
  diagnosticsRunning = true;
  diagnosticsStartedAtMs = nowMs();
  let lastHeartbeatMs = diagnosticsStartedAtMs;
  heartbeatHandle = setInterval(() => {
    const firedAt = nowMs();
    const gap = firedAt - lastHeartbeatMs;
    lastHeartbeatMs = firedAt;
    if (gap > STALL_GAP_THRESHOLD_MS) {
      stallRingDropped += pushBounded(stallRing, { tMs: firedAt, stallMs: gap - STALL_HEARTBEAT_INTERVAL_MS }, MAX_STALL_RING);
    }
  }, STALL_HEARTBEAT_INTERVAL_MS);
  const sampleFrameCache = (): void => {
    frameCacheRingDropped += pushBounded(frameCacheRing, {
      tMs: nowMs(),
      byteTotalBytes: frameLru.byteTotal,
      entryCount: frameLru.entryCount,
      capacityEvictions: frameLru.capacityEvictionCount,
    }, MAX_FRAME_CACHE_RING);
  };
  sampleFrameCache();
  frameCacheHandle = setInterval(sampleFrameCache, FRAME_CACHE_SAMPLE_INTERVAL_MS);
  return true;
}

/** Disarm the heartbeat and sampler (rings are retained for capture). */
export function stopPhysicsPaintStallDiagnostics(): void {
  if (heartbeatHandle !== null) {
    clearInterval(heartbeatHandle);
    heartbeatHandle = null;
  }
  if (frameCacheHandle !== null) {
    clearInterval(frameCacheHandle);
    frameCacheHandle = null;
  }
  diagnosticsRunning = false;
}

function summarizeValues(values: readonly number[]): PhysicsPaintValueStats {
  if (values.length === 0) return { count: 0, medianMs: 0, p95Ms: 0, maxMs: 0, totalMs: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  return {
    count: sorted.length,
    medianMs: rounded(percentile(sorted, 0.5)),
    p95Ms: rounded(percentile(sorted, 0.95)),
    maxMs: rounded(sorted[sorted.length - 1] ?? 0),
    totalMs: rounded(sorted.reduce((sum, value) => sum + value, 0)),
  };
}

export interface PhysicsPaintStallCaptureOptions {
  /**
   * Keep the per-decode tuples (default true). Set false for a compact report
   * (aggregate stats + series only) that is small enough to copy by hand.
   */
  includeDecodeSamples?: boolean;
}

/**
 * One JSON-serializable report of the diagnosis window: counters, trimmed
 * sample summary, frameLru byte-pressure series, main-thread stall series, and
 * the per-decode timing tuples (see `legend` for tuple field order).
 */
export function capturePhysicsPaintStallDiagnostics(options: PhysicsPaintStallCaptureOptions = {}): PhysicsPaintStallCapture {
  const includeDecodeSamples = options.includeDecodeSamples !== false;
  const { summary, counters } = snapshotPhysicsPaintPerformance();
  const anchor = diagnosticsStartedAtMs
    ?? decodeRing[0]?.tMs
    ?? frameCacheRing[0]?.tMs
    ?? stallRing[0]?.tMs
    ?? nowMs();
  const relative = (tMs: number): number => rounded(tMs - anchor);
  const webpSamples = decodeRing.filter((entry) => entry.path === 'webp');
  const stalls = stallRing.map((entry) => ({ tMs: relative(entry.tMs), stallMs: rounded(entry.stallMs) }));
  return {
    capturedAt: new Date().toISOString(),
    windowMs: diagnosticsStartedAtMs === null ? null : rounded(nowMs() - diagnosticsStartedAtMs),
    frameCache: {
      ceilingBytes: FRAME_LRU_BYTE_CEILING,
      byteTotalBytes: frameLru.byteTotal,
      entryCount: frameLru.entryCount,
      capacityEvictions: frameLru.capacityEvictionCount,
      explicitEvictions: frameLru.explicitEvictionCount,
      droppedSamples: frameCacheRingDropped,
      samples: frameCacheRing.map((entry) => ({
        tMs: relative(entry.tMs),
        byteTotalBytes: entry.byteTotalBytes,
        entryCount: entry.entryCount,
        capacityEvictions: entry.capacityEvictions,
      })),
    },
    stalls: {
      count: stallRing.length,
      droppedSamples: stallRingDropped,
      totalMs: rounded(stalls.reduce((sum, entry) => sum + entry.stallMs, 0)),
      maxMs: stalls.reduce((max, entry) => Math.max(max, entry.stallMs), 0),
      samples: stalls,
    },
    decodes: {
      count: decodeRing.length,
      droppedSamples: decodeRingDropped,
      byPath: { webp: webpSamples.length, png: decodeRing.length - webpSamples.length },
      byOrigin: {
        draw: decodeRing.filter((entry) => entry.origin === 'draw').length,
        prefetch: decodeRing.filter((entry) => entry.origin === 'prefetch').length,
      },
      rgbaShape: {
        jsonArray: webpSamples.filter((entry) => entry.rgbaIsJsonArray).length,
        typed: webpSamples.filter((entry) => !entry.rgbaIsJsonArray).length,
      },
      stats: {
        ipcMs: summarizeValues(webpSamples.map((entry) => entry.ipcMs)),
        codecMs: summarizeValues(webpSamples.map((entry) => entry.codecMs).filter((value) => value >= 0)),
        convertMs: summarizeValues(webpSamples.map((entry) => entry.convertMs)),
        bitmapMs: summarizeValues(decodeRing.map((entry) => entry.bitmapMs)),
      },
      legend: ['tMs', 'ipcMs', 'codecMs', 'convertMs', 'bitmapMs', 'width', 'height', 'path(0=webp,1=png)', 'origin(0=draw,1=prefetch)', 'inputBytes', 'rgbaIsJsonArray(1=yes)'],
      samplesIncluded: includeDecodeSamples,
      samples: includeDecodeSamples ? decodeRing.map((entry) => [
        relative(entry.tMs),
        rounded(entry.ipcMs),
        rounded(entry.codecMs),
        rounded(entry.convertMs),
        rounded(entry.bitmapMs),
        entry.width,
        entry.height,
        entry.path === 'webp' ? 0 : 1,
        entry.origin === 'draw' ? 0 : 1,
        entry.inputBytes,
        entry.rgbaIsJsonArray ? 1 : 0,
      ]) : [],
    },
    summary,
    counters,
    environment: {
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      devicePixelRatio: typeof window !== 'undefined' && typeof window.devicePixelRatio === 'number' ? window.devicePixelRatio : 0,
    },
  };
}

/**
 * Write the current stall capture to /tmp/efx-stall-capture.json via the Rust
 * `write_debug_capture` command (debug session 2026-09-11) so the diagnosis can
 * read the metrics straight from disk — no console copy needed. A `name`
 * suffixes the file (`efx-stall-capture-{name}.json`) so the Studio and main
 * windows can each dump without clobbering the other. Returns the written
 * path, or null when profiling is disabled or the write fails.
 */
export async function dumpPhysicsPaintStallDiagnostics(
  options: PhysicsPaintStallCaptureOptions = {},
  name?: string,
): Promise<string | null> {
  if (!profilingEnabled()) return null;
  const capture = capturePhysicsPaintStallDiagnostics(options);
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const path = await invoke<string>('write_debug_capture', { contents: JSON.stringify(capture), name });
    console.log(`[efx-perf] stall capture written to ${path}`);
    return path;
  } catch (error) {
    console.warn('[efx-perf] stall capture dump failed', error);
    return null;
  }
}

if (typeof window !== 'undefined' && import.meta.env.DEV) {
  Object.defineProperty(window, '__EFX_PHYSICS_PAINT_PROFILE__', {
    configurable: true,
    value: {
      clear: clearPhysicsPaintPerformance,
      summary: summarizePhysicsPaintPerformance,
      snapshot: snapshotPhysicsPaintPerformance,
      delta: diffPhysicsPaintPerformanceSnapshots,
      start: startPhysicsPaintStallDiagnostics,
      stop: stopPhysicsPaintStallDiagnostics,
      capture: capturePhysicsPaintStallDiagnostics,
      dump: dumpPhysicsPaintStallDiagnostics,
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
      start: () => boolean;
      stop: () => void;
      capture: (options?: PhysicsPaintStallCaptureOptions) => PhysicsPaintStallCapture;
      dump: (options?: PhysicsPaintStallCaptureOptions, name?: string) => Promise<string | null>;
    };
  }
}
