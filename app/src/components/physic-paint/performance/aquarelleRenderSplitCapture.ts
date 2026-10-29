// ============================================================
//  debug-watercolor-loop-render-split (quick-261026-odd) — DEV ONLY.
//
//  Answers "where does the aquarelle stroke split from the render?"
//  without a console copy: the app writes one JSON report to
//  /tmp/efx-aquarelle-render-split.json (the established
//  app-writes-/tmp convention) and a build beacon to
//  /tmp/efx-aquarelle-render-split-build.json so a stale window is
//  distinguishable from a bug.
//
//  Every event is read-only. The report carries no bytes — only
//  digests, lengths and downscaled ink measurements — so comparing
//  one payload across the capture -> route -> ack -> display chain
//  is a string equality on the digest. Nothing here throws into the
//  paint pipeline; every entry point is wrapped.
// ============================================================

import type { PhysicPaintRotoGroupFrameTarget } from '../roto/physicsPaintRotoGroupLifecycle';

export const AQUARELLE_RENDER_SPLIT_PATH = '/tmp/efx-aquarelle-render-split.json';
export const AQUARELLE_RENDER_SPLIT_BUILD = 'debug-watercolor-loop-render-split-7';

const MAX_EVENTS = 240;
const INK_CACHE_LIMIT = 96;
const ALPHA_SAMPLE_SIZE = 256;
const PNG_SAMPLE_SIZE = 512;

export interface AquarelleRenderSplitEvent {
  build: string;
  at: string;
  t: number;
  event: string;
  data: Record<string, unknown>;
}

/** Structural view of a rendered frame; avoids importing the full payload type. */
export interface ProbeFrameLike {
  appFrame?: number;
  frameIndex?: number;
  width?: number;
  height?: number;
  bytes?: unknown;
  keyId?: string;
  contentRevision?: string;
  cacheRevision?: string;
  source?: unknown;
  leftKeyId?: string;
  rightKeyId?: string;
  cycleOffset?: number;
}

const events: AquarelleRenderSplitEvent[] = [];
const inkByDigest = new Map<string, number | null>();
const inkInFlight = new Map<string, Promise<number | null>>();
let writeInFlight = false;
let writePending = false;
let installed = false;

function canWrite(): boolean {
  // No browser, no probe file: a unit test runs with DEV true but cannot write.
  if (typeof window === 'undefined') return false;
  try {
    return import.meta.env.DEV === true;
  } catch {
    return false;
  }
}

function asBytes(value: unknown): Uint8Array | null {
  return value instanceof Uint8Array && value.length > 0 ? value : null;
}

/**
 * Synchronous FNV-1a over the exact bytes plus the length. Identity is the
 * whole point: two events share a render only when this string matches.
 */
export function digestRenderedFrameBytes(bytes: Uint8Array | null | undefined): string | null {
  if (!(bytes instanceof Uint8Array) || bytes.length === 0) return null;
  let hash = 0x811c9dc5;
  for (let index = 0; index < bytes.length; index += 1) {
    hash ^= bytes[index]!;
    hash = Math.imul(hash, 0x01000193);
  }
  return `${bytes.length.toString(16)}:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function summarizeRenderedFrame(frame: ProbeFrameLike | null | undefined): Record<string, unknown> | null {
  if (!frame) return null;
  const bytes = asBytes(frame.bytes);
  return {
    appFrame: frame.appFrame ?? null,
    frameIndex: frame.frameIndex ?? null,
    width: frame.width ?? null,
    height: frame.height ?? null,
    bytesLength: bytes?.length ?? null,
    digest: digestRenderedFrameBytes(bytes),
    keyId: frame.keyId ?? null,
    contentRevision: frame.contentRevision ?? null,
    cacheRevision: frame.cacheRevision ?? null,
    source: frame.source ?? null,
  };
}

export function summarizePhysicPaintRotoGroupFrameTarget(
  target: PhysicPaintRotoGroupFrameTarget | null | undefined,
): Record<string, unknown> | null {
  if (!target) return null;
  switch (target.kind) {
    case 'ordinary-key':
      return { kind: target.kind, appFrame: target.appFrame, keyId: target.keyId };
    case 'source-occurrence':
      return {
        kind: target.kind,
        groupId: target.groupId,
        appFrame: target.appFrame,
        sourceKeyId: target.sourceKeyId,
        sourceIndex: target.sourceIndex,
        cycleOffset: target.cycleOffset,
        repeatInstance: target.repeatInstance,
      };
    case 'generated-occurrence':
      return {
        kind: target.kind,
        groupId: target.groupId,
        appFrame: target.appFrame,
        leftSourceKeyId: target.leftSourceKeyId,
        rightSourceKeyId: target.rightSourceKeyId,
        cycleOffset: target.cycleOffset,
        repeatInstance: target.repeatInstance,
        progress: target.progress,
      };
    case 'override':
      return {
        kind: target.kind,
        groupId: target.groupId,
        appFrame: target.appFrame,
        keyId: target.keyId,
        phaseAppFrame: target.phaseAppFrame,
        cycleOffset: target.cycleOffset,
        repeatInstance: target.repeatInstance,
      };
    case 'group-gap':
      return {
        kind: target.kind,
        groupId: target.groupId,
        appFrame: target.appFrame,
        phaseAppFrame: target.phaseAppFrame,
        cycleOffset: target.cycleOffset,
        repeatInstance: target.repeatInstance,
      };
    case 'unresolved-group':
      return {
        kind: target.kind,
        groupId: target.groupId,
        appFrame: target.appFrame,
        missingSourceKeyIds: [...target.missingSourceKeyIds],
        invalidSourceTiming: target.invalidSourceTiming === true,
      };
    case 'ambiguous-group':
      return { kind: target.kind, appFrame: target.appFrame, groupIds: [...target.groupIds] };
    case 'empty':
      return { kind: target.kind, appFrame: target.appFrame };
    default:
      return null;
  }
}

function probeMime(bytes: Uint8Array): string {
  return bytes[0] === 0x89 && bytes[1] === 0x50
    ? 'image/png'
    : bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[8] === 0x57
      ? 'image/webp'
      : 'application/octet-stream';
}

async function decodeInk(bytes: Uint8Array): Promise<number | null> {
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return null;
  // Same scale as measureAquarelleCanvasInk in the Studio (48x48, white 248).
  const bitmap = await createImageBitmap(new Blob([bytes.slice()], { type: probeMime(bytes) }));
  try {
    const sample = document.createElement('canvas');
    sample.width = 48;
    sample.height = 48;
    const context = sample.getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(bitmap, 0, 0, 48, 48);
    const data = context.getImageData(0, 0, 48, 48).data;
    let ink = 0;
    for (let index = 0; index < data.length; index += 4) {
      const luminance = 0.2126 * data[index]! + 0.7152 * data[index + 1]! + 0.0722 * data[index + 2]!;
      ink += Math.max(0, 248 - luminance);
    }
    return Math.round((ink / (255 * (data.length / 4))) * 1000 * 100) / 100;
  } finally {
    bitmap.close();
  }
}

/**
 * 261026 (third pass): ALPHA-AWARE stats. The ink metric above is alpha-blind —
 * transparent black pixels read as maximum ink, so it cannot tell a transparent
 * paint layer from an opaque white sheet. These fields can:
 * - transparentFraction ~92-95% + low avgAlpha = transparent paint layer;
 * - opaqueFraction ~100% + avgAlpha 255 = opaque (white-matted) transmittance.
 */
export interface ProbeAlphaStats {
  sampleSize: number;
  /** Mean alpha over every sampled pixel, 0-255. */
  avgAlpha: number;
  /** Percent of sampled pixels with alpha === 255. */
  opaqueFraction: number;
  /** Percent of sampled pixels with alpha < 8. */
  transparentFraction: number;
  /** Percent of sampled pixels with alpha >= 8 (visible paint). */
  visibleFraction: number;
  /** Mean luminance over VISIBLE pixels only (null when none are visible). */
  visibleLum: number | null;
}

const alphaStatsByDigest = new Map<string, ProbeAlphaStats | null>();
const alphaStatsInFlight = new Map<string, Promise<ProbeAlphaStats | null>>();
const pngDumpedTags = new Set<string>();

function alphaStatsFromImageData(data: Uint8ClampedArray, sampleSize: number): ProbeAlphaStats {
  const pixels = data.length / 4;
  let alphaSum = 0;
  let opaque = 0;
  let transparent = 0;
  let visible = 0;
  let lumSum = 0;
  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3]!;
    alphaSum += alpha;
    if (alpha === 255) opaque += 1;
    if (alpha < 8) {
      transparent += 1;
      continue;
    }
    visible += 1;
    lumSum += 0.2126 * data[index]! + 0.7152 * data[index + 1]! + 0.0722 * data[index + 2]!;
  }
  return {
    sampleSize,
    avgAlpha: Math.round((alphaSum / pixels) * 100) / 100,
    opaqueFraction: Math.round((opaque / pixels) * 10000) / 100,
    transparentFraction: Math.round((transparent / pixels) * 10000) / 100,
    visibleFraction: Math.round((visible / pixels) * 10000) / 100,
    visibleLum: visible > 0 ? Math.round((lumSum / visible) * 10) / 10 : null,
  };
}

function drawSourceToSample(
  source: CanvasImageSource,
  width: number,
  height: number,
): ImageData | null {
  if (typeof document === 'undefined') return null;
  const sample = document.createElement('canvas');
  sample.width = ALPHA_SAMPLE_SIZE;
  sample.height = ALPHA_SAMPLE_SIZE;
  const context = sample.getContext('2d', { willReadFrequently: true });
  if (!context || typeof context.getImageData !== 'function') return null;
  context.clearRect(0, 0, ALPHA_SAMPLE_SIZE, ALPHA_SAMPLE_SIZE);
  context.drawImage(source, 0, 0, width, height, 0, 0, ALPHA_SAMPLE_SIZE, ALPHA_SAMPLE_SIZE);
  return context.getImageData(0, 0, ALPHA_SAMPLE_SIZE, ALPHA_SAMPLE_SIZE);
}

/** Synchronous stats for a live canvas (the aquarelle sheet at produce time). */
export function sampleCanvasAlphaStats(canvas: HTMLCanvasElement | null | undefined): ProbeAlphaStats | null {
  if (!canvas || typeof document === 'undefined') return null;
  try {
    const width = canvas.width || ALPHA_SAMPLE_SIZE;
    const height = canvas.height || ALPHA_SAMPLE_SIZE;
    const data = drawSourceToSample(canvas, width, height);
    return data ? alphaStatsFromImageData(data.data, ALPHA_SAMPLE_SIZE) : null;
  } catch {
    return null;
  }
}

export function sampleBytesAlphaStats(bytes: Uint8Array | null | undefined): Promise<ProbeAlphaStats | null> {
  if (!(bytes instanceof Uint8Array) || bytes.length === 0) return Promise.resolve(null);
  const digest = digestRenderedFrameBytes(bytes);
  if (!digest) return Promise.resolve(null);
  const cached = alphaStatsByDigest.get(digest);
  if (cached !== undefined) return Promise.resolve(cached);
  const inFlight = alphaStatsInFlight.get(digest);
  if (inFlight) return inFlight;
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return Promise.resolve(null);
  const work = (async () => {
    let bitmap: ImageBitmap | null = null;
    try {
      bitmap = await createImageBitmap(new Blob([bytes.slice()], { type: probeMime(bytes) }));
      const data = drawSourceToSample(bitmap, bitmap.width, bitmap.height);
      const stats = data ? alphaStatsFromImageData(data.data, ALPHA_SAMPLE_SIZE) : null;
      alphaStatsByDigest.set(digest, stats);
      if (alphaStatsByDigest.size > INK_CACHE_LIMIT) {
        const oldest = alphaStatsByDigest.keys().next().value;
        if (oldest !== undefined) alphaStatsByDigest.delete(oldest);
      }
      return stats;
    } catch {
      alphaStatsByDigest.set(digest, null);
      return null;
    } finally {
      bitmap?.close();
    }
  })().finally(() => {
    alphaStatsInFlight.delete(digest);
  });
  alphaStatsInFlight.set(digest, work);
  return work;
}

/**
 * Base-preservation proof: on every pixel where the BASE is visible (alpha >=
 * 8), does the produced/composed payload keep it visible, and with which
 * luminance shift? The pigment-alpha composite (2026-10-26 round 2) keeps
 * baseVisible -> visible everywhere: the live sheet's alpha is 0 where no
 * pigment was deposited, so the base passes through untouched.
 */
export interface ProbeAlphaRetention {
  samples: number;
  baseVisibleFraction: number;
  /** Percent of base-visible pixels that stay visible in `other`. */
  retainedFraction: number;
  meanBaseLum: number | null;
  meanOtherLum: number | null;
  meanLumDelta: number | null;
}

async function decodePixels(bytes: Uint8Array): Promise<ImageData | null> {
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return null;
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(new Blob([bytes.slice()], { type: probeMime(bytes) }));
    return drawSourceToSample(bitmap, bitmap.width, bitmap.height);
  } catch {
    return null;
  } finally {
    bitmap?.close();
  }
}

export async function compareAlphaRetention(
  baseBytes: Uint8Array | null | undefined,
  otherBytes: Uint8Array | null | undefined,
): Promise<ProbeAlphaRetention | null> {
  if (!(baseBytes instanceof Uint8Array) || baseBytes.length === 0) return null;
  if (!(otherBytes instanceof Uint8Array) || otherBytes.length === 0) return null;
  try {
    const [base, other] = await Promise.all([decodePixels(baseBytes), decodePixels(otherBytes)]);
    if (!base || !other) return null;
    const pixels = base.data.length / 4;
    let baseVisible = 0;
    let retained = 0;
    let baseLumSum = 0;
    let otherLumSum = 0;
    for (let index = 0; index < base.data.length; index += 4) {
      const baseAlpha = base.data[index + 3]!;
      if (baseAlpha < 8) continue;
      baseVisible += 1;
      const otherAlpha = other.data[index + 3]!;
      if (otherAlpha < 8) continue;
      retained += 1;
      const baseLum = 0.2126 * base.data[index]! + 0.7152 * base.data[index + 1]! + 0.0722 * base.data[index + 2]!;
      const otherLum = 0.2126 * other.data[index]! + 0.7152 * other.data[index + 1]! + 0.0722 * other.data[index + 2]!;
      baseLumSum += baseLum;
      otherLumSum += otherLum;
    }
    return {
      samples: pixels,
      baseVisibleFraction: Math.round((baseVisible / pixels) * 10000) / 100,
      retainedFraction: baseVisible > 0 ? Math.round((retained / baseVisible) * 10000) / 100 : 0,
      meanBaseLum: retained > 0 ? Math.round((baseLumSum / retained) * 10) / 10 : null,
      meanOtherLum: retained > 0 ? Math.round((otherLumSum / retained) * 10) / 10 : null,
      meanLumDelta: retained > 0 ? Math.round(((otherLumSum - baseLumSum) / retained) * 10) / 10 : null,
    };
  } catch {
    return null;
  }
}

async function dumpProbePng(
  tag: string,
  sourceBytes: Uint8Array | null | undefined,
): Promise<void> {
  if (!canWrite() || pngDumpedTags.has(tag)) return;
  if (!(sourceBytes instanceof Uint8Array) || sourceBytes.length === 0) return;
  const digest = digestRenderedFrameBytes(sourceBytes);
  if (!digest) return;
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return;
  pngDumpedTags.add(tag);
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(new Blob([sourceBytes.slice()], { type: probeMime(sourceBytes) }));
    const canvas = document.createElement('canvas');
    canvas.width = PNG_SAMPLE_SIZE;
    canvas.height = PNG_SAMPLE_SIZE;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.clearRect(0, 0, PNG_SAMPLE_SIZE, PNG_SAMPLE_SIZE);
    context.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height, 0, 0, PNG_SAMPLE_SIZE, PNG_SAMPLE_SIZE);
    const blob = await new Promise<Blob | null>((resolve) => {
      try {
        canvas.toBlob((value) => resolve(value), 'image/png');
      } catch {
        resolve(null);
      }
    });
    if (!blob || typeof blob.arrayBuffer !== 'function') return;
    const buffer = await blob.arrayBuffer();
    const { exportWritePng } = await import('../../../lib/ipc');
    await exportWritePng('/tmp', `efx-aquarelle-probe-${tag.replace(/[^a-zA-Z0-9_-]/g, '-')}.png`, Array.from(new Uint8Array(buffer)));
  } catch {
    // Probe-only; never propagate.
  } finally {
    bitmap?.close();
  }
}

function sampleBytesInk(bytes: Uint8Array, digest: string): Promise<number | null> {
  const cached = inkByDigest.get(digest);
  if (cached !== undefined) return Promise.resolve(cached);
  const inFlight = inkInFlight.get(digest);
  if (inFlight) return inFlight;
  const work = decodeInk(bytes)
    .then((ink) => {
      inkByDigest.set(digest, ink);
      if (inkByDigest.size > INK_CACHE_LIMIT) {
        const oldest = inkByDigest.keys().next().value;
        if (oldest !== undefined) inkByDigest.delete(oldest);
      }
      return ink;
    })
    .catch(() => null)
    .finally(() => {
      inkInFlight.delete(digest);
    });
  inkInFlight.set(digest, work);
  return work;
}

function scheduleWrite(): void {
  if (!canWrite()) return;
  if (writeInFlight) {
    writePending = true;
    return;
  }
  writeInFlight = true;
  void writeReport().finally(() => {
    writeInFlight = false;
    if (writePending) {
      writePending = false;
      scheduleWrite();
    }
  });
}

async function writeReport(): Promise<void> {
  try {
    const payload = {
      build: AQUARELLE_RENDER_SPLIT_BUILD,
      updatedAt: new Date().toISOString(),
      eventCount: events.length,
      events,
    };
    const bytes = new TextEncoder().encode(JSON.stringify(payload, null, 2));
    const { exportWritePng } = await import('../../../lib/ipc');
    const result = await exportWritePng('/tmp', 'efx-aquarelle-render-split.json', Array.from(bytes));
    if (!result.ok) console.warn('[aquarelle-render-split] write failed', result.error);
  } catch (error) {
    console.warn('[aquarelle-render-split] write failed', error);
  }
}

async function writeBuildBeacon(): Promise<void> {
  if (!canWrite()) return;
  try {
    const beacon = {
      build: AQUARELLE_RENDER_SPLIT_BUILD,
      installedAt: new Date().toISOString(),
    };
    const bytes = new TextEncoder().encode(JSON.stringify(beacon, null, 2));
    const { exportWritePng } = await import('../../../lib/ipc');
    const result = await exportWritePng('/tmp', 'efx-aquarelle-render-split-build.json', Array.from(bytes));
    if (!result.ok) console.warn('[aquarelle-render-split] beacon failed', result.error);
  } catch (error) {
    console.warn('[aquarelle-render-split] beacon failed', error);
  }
}

function appendEvent(event: string, data: Record<string, unknown>): AquarelleRenderSplitEvent | null {
  if (!canWrite()) return null;
  try {
    const entry: AquarelleRenderSplitEvent = {
      build: AQUARELLE_RENDER_SPLIT_BUILD,
      at: new Date().toISOString(),
      t: Math.round(performance.now() * 10) / 10,
      event,
      data,
    };
    events.push(entry);
    if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
    return entry;
  } catch {
    return null;
  }
}

/**
 * Append one report event. `inkSources` names byte carriers whose downscaled
 * ink is measured asynchronously and patched onto the SAME event (key -> ink)
 * before the next write, so the reader gets digest and ink together.
 */
export function recordAquarelleRenderSplitEvent(
  event: string,
  data: Record<string, unknown> = {},
  inkSources?: Record<string, Uint8Array | null | undefined>,
): void {
  const entry = appendEvent(event, data);
  if (!entry) return;
  try {
    if (inkSources) {
      for (const [key, source] of Object.entries(inkSources)) {
        const bytes = asBytes(source);
        if (!bytes) continue;
        const digest = digestRenderedFrameBytes(bytes);
        if (!digest) continue;
        void sampleBytesInk(bytes, digest).then((ink) => {
          if (ink === null) return;
          try {
            entry.data[key] = ink;
            scheduleWrite();
          } catch {
            // Never propagate probe failures into the pipeline.
          }
        });
      }
    }
    scheduleWrite();
  } catch {
    // Never propagate probe failures into the pipeline.
  }
}

/**
 * 261026 (third pass): one ALPHA-AWARE proof event. Sources may be byte
 * carriers or the live sheet canvas; pairs compare base-visible pixels across
 * two carriers. Results are patched onto the event asynchronously as
 * `alpha.<label>` and `retention.<label>`, then the report is written.
 *
 * `dumpPng` writes one downscaled (512px) PNG per label to
 * /tmp/efx-aquarelle-probe-<label>.png, once per app session.
 */
export function recordAquarelleAlphaProof(
  event: string,
  data: Record<string, unknown>,
  sources: Record<string, Uint8Array | HTMLCanvasElement | null | undefined>,
  pairs?: ReadonlyArray<{ label: string; base: Uint8Array | null | undefined; other: Uint8Array | null | undefined }>,
  options?: { dumpPng?: boolean },
): void {
  const entry = appendEvent(event, data);
  if (!entry) return;
  try {
    const alpha: Record<string, unknown> = {};
    entry.data.alpha = alpha;
    for (const [label, source] of Object.entries(sources)) {
      if (source instanceof Uint8Array) {
        const bytes = asBytes(source);
        if (!bytes) continue;
        void sampleBytesAlphaStats(bytes).then((stats) => {
          if (!stats) return;
          try {
            alpha[label] = stats;
            scheduleWrite();
          } catch {
            // Probe-only.
          }
        });
        if (options?.dumpPng) void dumpProbePng(`${event}-${label}`, bytes);
      } else if (source && typeof source === 'object' && 'getContext' in source) {
        const stats = sampleCanvasAlphaStats(source as HTMLCanvasElement);
        if (stats) alpha[label] = stats;
      }
    }
    if (pairs && pairs.length > 0) {
      const retention: Record<string, unknown> = {};
      entry.data.retention = retention;
      for (const pair of pairs) {
        void compareAlphaRetention(pair.base, pair.other).then((result) => {
          if (!result) return;
          try {
            retention[pair.label] = result;
            scheduleWrite();
          } catch {
            // Probe-only.
          }
        });
      }
    }
    scheduleWrite();
  } catch {
    // Never propagate probe failures into the pipeline.
  }
}

/** One-time install: starts a fresh report for this build and writes the beacon. */
export function installAquarelleRenderSplitProbe(): void {
  if (!canWrite() || installed) return;
  installed = true;
  recordAquarelleRenderSplitEvent('probe-installed', { path: AQUARELLE_RENDER_SPLIT_PATH });
  void writeBuildBeacon();
}
