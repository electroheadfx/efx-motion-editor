/**
 * Pre-split golden replay fixture (HOST-03 / R5.2 / D-01..D-04).
 *
 * Captured entirely on PRE-SPLIT code, before any module moves (D-04). The
 * stored script is the renderer runtime input (`RotoPaintScript`) — NOT the
 * on-disk `PersistedRotoScriptV1` — so 55-05's persisted-format envelope
 * cutover does not rewrite these golden files.
 *
 * The bake entry below is the single deterministic path both the capture and
 * the standing parity pin re-run. It is driven by the production animation
 * schedule family (`buildProgressiveStrokeSchedule` / `buildStaticStrokeSchedule`
 * / `getProgressiveFrameStrokes` / `getStaticFrameStrokes` /
 * `transformRecordedStrokeForHeldPose`) — the code the host split moves — and
 * rasterizes each frame through a seeded deterministic deposit keyed by
 * `hashMutationId` / `seededRng` (the traceSeed determinism law).
 *
 * D-01: this module never imports or calls the engine-1 tier-parity metrics
 * helper family (the forbidden oracle). The oracle is independent.
 *
 * Pure data + pure functions. No engine side effects at import time.
 */

import { createHash } from 'node:crypto';
import type { PaintStroke, PenPoint } from '@efxlab/efx-physic-paint';
import {
  buildProgressiveStrokeSchedule,
  buildStaticStrokeSchedule,
  getProgressiveFrameStrokes,
  getStaticFrameStrokes,
  transformRecordedStrokeForHeldPose,
  type StudioStroke,
  type StudioPoint,
} from '@efxlab/efx-paint-host/animation';
import type { RotoPaintScript } from '../../components/physic-paint/roto/physicsPaintRotoScriptClipboard';

// ---------------------------------------------------------------------------
// Trace-seed mirrors (byte-identical to packages/efx-paint-host/src/util/traceSeed.ts)
//
// The package does not publicly export `hashMutationId` / `seededRng`
// (`exports` maps only `.` / `./preact` / `./animation`). These three
// functions are the exact algorithm of the determinism law (FNV-1a offset
// 2166136261 / prime 16777619 + mulberry32). The parity pin's source-scan
// assertion keeps them from drifting from the package source.
// ---------------------------------------------------------------------------

/** FNV-1a over a string — offset 2166136261, prime 16777619. */
export function fnv1a(source: string): number {
  let hash = 2166136261;
  for (let i = 0; i < source.length; i++) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Avalanche mixer — decorrelates nearby FNV outputs. */
function avalanche(hash: number): number {
  let h = hash >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519);
  h ^= h >>> 13;
  h = Math.imul(h, 3266489917);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Stroke seed from the mutation id (traceSeed determinism law). */
export function hashMutationId(mutationId: number | undefined): number {
  return avalanche(fnv1a(`mutation:${mutationId ?? 0}`));
}

/** Deterministic sequential rng (mulberry32) keyed by (strokeSeed, streamKey). */
export function seededRng(strokeSeed: number, streamKey: string): () => number {
  let a = avalanche(fnv1a(`${strokeSeed}|${streamKey}`));
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Fixture shapes
// ---------------------------------------------------------------------------

export type PreSplitGoldenMode = 'progressive' | 'static';

export interface PreSplitGoldenBakeConfig {
  mode: PreSplitGoldenMode;
  frameCount: number;
  canonicalStart: number;
  motion: { deformation: number; position: number };
  size: { width: number; height: number };
}

export interface PreSplitGoldenBakedFrame {
  frameIndex: number;
  appFrame: number;
  /** Base64 of the raw RGBA bytes (width * height * 4). */
  rgbaBase64: string;
  /** Lowercase hex SHA-256 of the raw RGBA bytes — quick mismatch triage. */
  digest: string;
}

export interface PreSplitGoldenBake extends PreSplitGoldenBakeConfig {
  frames: readonly PreSplitGoldenBakedFrame[];
}

export interface PreSplitGoldenFixture {
  /** Renderer runtime input (`RotoPaintScript`) — stable across 55-05. */
  script: RotoPaintScript;
  bakes: readonly PreSplitGoldenBake[];
}

export interface BakedGoldenFrame {
  frameIndex: number;
  appFrame: number;
  rgba: Uint8ClampedArray;
}

// ---------------------------------------------------------------------------
// Recorded engine-1 script (broad seam coverage per D-02)
//
// Brush list coverage:
//   1. progressive-schedule paint primary + point-carrying continuation
//   2. playFrame-anchored paint primary (schedule anchor path)
//   3. paint primary + positive-diffusionFrames tail continuation
//   4. erase primary
//   5. paint primary exercised by the held-pose / motion-wiggle transform
// Every stroke carries a `mutationId` so the capture is seeded through the
// existing `hashMutationId` / `seededRng` path (determinism law).
// ---------------------------------------------------------------------------

function point(x: number, y: number): PenPoint {
  return { x, y, p: 0.65, tx: 0, ty: 0, tw: 0, spd: 1 };
}

function stroke(input: {
  tool: 'paint' | 'erase';
  color: string | null;
  points: PenPoint[];
  timestamp: number;
  mutationId: number;
  diffusionFrames?: number;
  playFrame?: number;
}): PaintStroke {
  return {
    tool: input.tool,
    color: input.color,
    timestamp: input.timestamp,
    mutationId: input.mutationId,
    points: input.points,
    params: {
      size: 10,
      opacity: 80,
      pressure: 70,
      waterAmount: 35,
      dryAmount: 40,
      edgeDetail: 25,
      pickup: 5,
      eraseStrength: 60,
      antiAlias: 1,
    },
    ...(input.diffusionFrames !== undefined ? { diffusionFrames: input.diffusionFrames } : {}),
    ...(input.playFrame !== undefined ? { playFrame: input.playFrame } : {}),
  };
}

export const PRE_SPLIT_GOLDEN_SCRIPT: RotoPaintScript = {
  provenance: { sessionId: 'pre-split-golden', layerId: 'layer-pre-split', sourceFrame: 0 },
  sourceFrame: 0,
  sourceDisplayFrame: 0,
  sourceRevision: 1,
  brushes: [
    // Brush 1 — progressive paint primary + point-carrying continuation.
    {
      primary: stroke({
        tool: 'paint',
        color: '#c0392b',
        timestamp: 1_000,
        mutationId: 101,
        points: Array.from({ length: 10 }, (_, i) => point(6 + i * 4, 14 + (i % 3) * 2)),
      }),
      continuations: [
        stroke({
          tool: 'paint',
          color: '#c0392b',
          timestamp: 1_001,
          mutationId: 102,
          points: Array.from({ length: 4 }, (_, i) => point(10 + i * 5, 22 + i)),
        }),
      ],
    },
    // Brush 2 — playFrame-anchored paint primary (schedule anchor path).
    {
      primary: stroke({
        tool: 'paint',
        color: '#2980b9',
        timestamp: 2_000,
        mutationId: 103,
        playFrame: 1,
        points: Array.from({ length: 6 }, (_, i) => point(30 + i * 3, 10 + i * 4)),
      }),
    },
    // Brush 3 — paint primary + positive diffusionFrames tail continuation.
    {
      primary: stroke({
        tool: 'paint',
        color: '#27ae60',
        timestamp: 3_000,
        mutationId: 104,
        points: Array.from({ length: 5 }, (_, i) => point(12 + i * 6, 34 + (i % 2) * 3)),
      }),
      continuations: [
        stroke({
          tool: 'paint',
          color: null,
          timestamp: 3_001,
          mutationId: 105,
          diffusionFrames: 8,
          points: [],
        }),
      ],
    },
    // Brush 4 — erase primary.
    {
      primary: stroke({
        tool: 'erase',
        color: null,
        timestamp: 4_000,
        mutationId: 106,
        points: Array.from({ length: 7 }, (_, i) => point(18 + i * 4, 20 + (i % 3) * 3)),
      }),
    },
    // Brush 5 — held-pose / motion-wiggle emphasis (transform source).
    {
      primary: stroke({
        tool: 'paint',
        color: '#8e44ad',
        timestamp: 5_000,
        mutationId: 107,
        points: Array.from({ length: 8 }, (_, i) => point(22 + i * 3, 40 + (i % 4) * 2)),
      }),
    },
  ],
};

// ---------------------------------------------------------------------------
// Bake configuration (small fixed working size so stored pixels stay reviewable)
// ---------------------------------------------------------------------------

export const PRE_SPLIT_GOLDEN_BAKE_CONFIGS: readonly PreSplitGoldenBakeConfig[] = [
  {
    mode: 'progressive',
    frameCount: 5,
    canonicalStart: 0,
    motion: { deformation: 45, position: 35 },
    size: { width: 48, height: 48 },
  },
  {
    mode: 'static',
    frameCount: 3,
    canonicalStart: 0,
    motion: { deformation: 45, position: 35 },
    size: { width: 48, height: 48 },
  },
];

// ---------------------------------------------------------------------------
// Shared deterministic bake entry
// ---------------------------------------------------------------------------

/** Engine-1 payload carried in the opaque `engine` slot of StudioStroke<P>. */
interface GoldenEnginePayload {
  tool: string;
  color: string | null;
  params: Record<string, number>;
  mutationId?: number;
  hasPenInput?: boolean;
  physicsMode?: string | null;
  diffusionFrames?: number;
}

/**
 * Project an engine-1 `PaintStroke` onto the host `StudioStroke<P>` contract.
 * Minimal field mapping for the golden bake — 55-02 Task 3 formalizes this as
 * `toStudioStroke` in the engine-1 package surface.
 */
function toStudioStroke(s: Readonly<PaintStroke>): StudioStroke<GoldenEnginePayload> {
  const pts: StudioPoint[] = s.points.map((p, i) => ({
    x: p.x, y: p.y, p: p.p, tx: p.tx, ty: p.ty, tw: p.tw, tick: i,
  }));
  return {
    pts,
    ticks: Math.max(1, s.points.length - 1),
    cuisson: s.diffusionFrames !== undefined && s.diffusionFrames > 0 ? s.diffusionFrames : 0,
    motion: null,
    brushId: 'efx-physic-paint',
    toolOverrides: {},
    traceSeed: hashMutationId(s.mutationId),
    recordedOrder: s.timestamp,
    playFrame: s.playFrame ?? null,
    color: s.color,
    engine: {
      tool: s.tool,
      color: s.color,
      params: { ...s.params },
      mutationId: s.mutationId,
      hasPenInput: s.hasPenInput,
      physicsMode: s.physicsMode ?? null,
      diffusionFrames: s.diffusionFrames,
    },
  };
}

/** Flatten a `RotoPaintScript` into the ordered stroke list the schedules consume. */
export function flattenPreSplitGoldenStrokes(script: Readonly<RotoPaintScript>): StudioStroke<GoldenEnginePayload>[] {
  const strokes: StudioStroke<GoldenEnginePayload>[] = [];
  for (const brush of script.brushes) {
    strokes.push(toStudioStroke(cloneStroke(brush.primary)));
    for (const continuation of brush.continuations ?? []) strokes.push(toStudioStroke(cloneStroke(continuation)));
  }
  return strokes;
}

function cloneStroke(strokeIn: Readonly<PaintStroke>): PaintStroke {
  return {
    ...strokeIn,
    points: strokeIn.points.map((p) => ({ ...p })),
    params: { ...strokeIn.params },
  };
}

function parseHexColor(color: string | null): [number, number, number] {
  if (!color || color.length !== 7 || color[0] !== '#') return [0, 0, 0];
  const r = Number.parseInt(color.slice(1, 3), 16);
  const g = Number.parseInt(color.slice(3, 5), 16);
  const b = Number.parseInt(color.slice(5, 7), 16);
  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return [0, 0, 0];
  return [r, g, b];
}

/**
 * Deterministic seeded deposit of one frame's stroke list into an RGBA buffer.
 * Mirrors the erasePointerDelete mock-canvas ImageData idiom: a flat
 * `Uint8ClampedArray` of width*height*4, destination-out for erase.
 *
 * Every stroke's deposit is keyed by `traceSeed` (pre-computed from
 * `hashMutationId(stroke.mutationId)` in the projection) +
 * `seededRng(strokeSeed, streamKey)` — the traceSeed determinism law. A
 * positive `cuisson` tail deposits a seeded diffusion halo so the
 * field is pixel-load-bearing.
 */
function rasterizeFrameStrokes(
  frameStrokes: readonly { stroke: StudioStroke<GoldenEnginePayload>; pointCount: number }[],
  width: number,
  height: number,
): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(width * height * 4);

  for (const { stroke: s, pointCount } of frameStrokes) {
    const strokeSeed = s.traceSeed;
    const streamKey = s.engine.tool === 'erase' ? 'erase-shape' : 'shape-detail';
    const rng = seededRng(strokeSeed, streamKey);
    const radius = 2 + Math.floor(rng() * 3);
    const [cr, cg, cb] = parseHexColor(s.color);
    const visible = Math.max(0, Math.min(s.pts.length, pointCount));

    for (let i = 0; i < visible; i++) {
      const p = s.pts[i];
      const jx = (rng() - 0.5) * 1.6;
      const jy = (rng() - 0.5) * 1.6;
      const cx = p.x + jx;
      const cy = p.y + jy;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (dx * dx + dy * dy > radius * radius) continue;
          const x = Math.round(cx) + dx;
          const y = Math.round(cy) + dy;
          if (x < 0 || y < 0 || x >= width || y >= height) continue;
          const o = (y * width + x) * 4;
          if (s.engine.tool === 'erase') {
            rgba[o] = 0;
            rgba[o + 1] = 0;
            rgba[o + 2] = 0;
            rgba[o + 3] = 0;
          } else {
            rgba[o] = cr;
            rgba[o + 1] = cg;
            rgba[o + 2] = cb;
            rgba[o + 3] = 255;
          }
        }
      }
    }

    // cuisson tail: seeded halo so the field is load-bearing on pixels.
    const diffusion = s.cuisson > 0 ? Math.trunc(s.cuisson) : 0;
    if (diffusion > 0) {
      const haloCount = Math.min(12, Math.max(1, diffusion));
      for (let h = 0; h < haloCount; h++) {
        const hx = Math.floor(rng() * width);
        const hy = Math.floor(rng() * height);
        const hr = 1 + Math.floor(rng() * 2);
        for (let dy = -hr; dy <= hr; dy++) {
          for (let dx = -hr; dx <= hr; dx++) {
            if (dx * dx + dy * dy > hr * hr) continue;
            const x = hx + dx;
            const y = hy + dy;
            if (x < 0 || y < 0 || x >= width || y >= height) continue;
            const o = (y * width + x) * 4;
            if (s.engine.tool === 'erase') {
              rgba[o] = 0;
              rgba[o + 1] = 0;
              rgba[o + 2] = 0;
              rgba[o + 3] = 0;
            } else {
              rgba[o] = cr;
              rgba[o + 1] = cg;
              rgba[o + 2] = cb;
              rgba[o + 3] = 255;
            }
          }
        }
      }
    }
  }

  return rgba;
}

/**
 * THE shared deterministic bake entry. The capture and the parity pin both
 * call this exact function — capture and compare share one bake entry (D-04).
 *
 * Driven by the production animation schedule family (the host-split move
 * surface) plus `transformRecordedStrokeForHeldPose` (held-pose / motion
 * wiggle). Produces per-frame RGBA bytes at the configured working size.
 */
export function bakePreSplitGoldenFrames(
  script: Readonly<RotoPaintScript>,
  config: PreSplitGoldenBakeConfig,
): BakedGoldenFrame[] {
  const { width, height } = config.size;
  const strokes = flattenPreSplitGoldenStrokes(script);
  const schedule =
    config.mode === 'static'
      ? buildStaticStrokeSchedule(strokes, config.frameCount)
      : buildProgressiveStrokeSchedule(strokes, config.frameCount);

  const frames: BakedGoldenFrame[] = [];
  for (let frameIndex = 0; frameIndex < config.frameCount; frameIndex += 1) {
    const destination = config.canonicalStart + frameIndex;
    const transformFrameStroke = (
      s: StudioStroke<GoldenEnginePayload>,
      _scheduleFrame: number,
      strokeIndex: number,
    ): StudioStroke<GoldenEnginePayload> =>
      s.pts.length === 0
        ? s
        : transformRecordedStrokeForHeldPose(s, {
            destinationSourceFrame: destination,
            strokeIndex,
            deformation: config.motion.deformation,
            position: config.motion.position,
          });
    const frameStrokes =
      config.mode === 'static'
        ? getStaticFrameStrokes(schedule, frameIndex, transformFrameStroke)
        : getProgressiveFrameStrokes(schedule, frameIndex, transformFrameStroke);
    frames.push({
      frameIndex,
      appFrame: destination,
      rgba: rasterizeFrameStrokes(frameStrokes, width, height),
    });
  }
  return frames;
}

// ---------------------------------------------------------------------------
// Comparison helper (names the drifted frame + pixel-delta count)
// ---------------------------------------------------------------------------

export interface PreSplitGoldenMismatch {
  bakeIndex: number;
  mode: PreSplitGoldenMode;
  frameIndex: number;
  appFrame: number;
  pixelDeltaCount: number;
  byteDeltaCount: number;
  expectedDigest: string;
  actualDigest: string;
}

export function describePreSplitGoldenMismatch(mismatch: PreSplitGoldenMismatch): string {
  return (
    `Pre-split golden parity drift — bake[${mismatch.bakeIndex}] mode=${mismatch.mode} ` +
    `frame ${mismatch.frameIndex} (appFrame ${mismatch.appFrame}): ` +
    `${mismatch.pixelDeltaCount} pixel(s) differ (${mismatch.byteDeltaCount} byte(s)); ` +
    `expected digest ${mismatch.expectedDigest.slice(0, 12)}… ` +
    `actual digest ${mismatch.actualDigest.slice(0, 12)}…`
  );
}

function sha256Hex(bytes: Uint8ClampedArray | Uint8Array): string {
  return createHash('sha256').update(new Uint8Array(bytes)).digest('hex');
}

function toBytes(base64: string): Uint8Array {
  return Uint8Array.from(Buffer.from(base64, 'base64'));
}

function countDeltas(
  expected: Uint8Array | Uint8ClampedArray,
  actual: Uint8Array | Uint8ClampedArray,
): { pixelDeltaCount: number; byteDeltaCount: number } {
  const length = Math.min(expected.length, actual.length);
  let byteDeltaCount = Math.abs(expected.length - actual.length);
  for (let i = 0; i < length; i++) {
    if (expected[i] !== actual[i]) byteDeltaCount += 1;
  }
  const pixelDeltaCount = Math.ceil(byteDeltaCount / 4);
  return { pixelDeltaCount, byteDeltaCount };
}

/**
 * Compare a re-baked result against the stored golden. Returns null at delta
 * zero, or the first mismatch (naming the drifted frame index + pixel-delta
 * count) so a future split regression is diagnosable (D-02).
 */
export function comparePreSplitGoldenBake(
  bakeIndex: number,
  bake: PreSplitGoldenBake,
  rebaked: readonly BakedGoldenFrame[],
): PreSplitGoldenMismatch | null {
  for (const expected of bake.frames) {
    const actual = rebaked[expected.frameIndex];
    if (!actual) {
      return {
        bakeIndex,
        mode: bake.mode,
        frameIndex: expected.frameIndex,
        appFrame: expected.appFrame,
        pixelDeltaCount: -1,
        byteDeltaCount: -1,
        expectedDigest: expected.digest,
        actualDigest: 'missing',
      };
    }
    const expectedBytes = toBytes(expected.rgbaBase64);
    const { pixelDeltaCount, byteDeltaCount } = countDeltas(expectedBytes, actual.rgba);
    if (byteDeltaCount === 0) continue;
    return {
      bakeIndex,
      mode: bake.mode,
      frameIndex: expected.frameIndex,
      appFrame: expected.appFrame,
      pixelDeltaCount,
      byteDeltaCount,
      expectedDigest: expected.digest,
      actualDigest: sha256Hex(actual.rgba),
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Loader (pure — the pin consumes this)
// ---------------------------------------------------------------------------

/**
 * Pure loader. Yields the recorded script as `RotoPaintScript` (renderer
 * runtime input, stable across 55-05's persisted-format cutover), the bake
 * configurations, and the expected baked frame pixels/digests.
 */
export function loadPreSplitGoldenFixture(): PreSplitGoldenFixture {
  return {
    script: PRE_SPLIT_GOLDEN_SCRIPT,
    bakes: PRE_SPLIT_GOLDEN_BAKES,
  };
}

// ---------------------------------------------------------------------------
// Captured golden frames (produced by bakePreSplitGoldenFrames on pre-split code)
// ---------------------------------------------------------------------------

export const PRE_SPLIT_GOLDEN_BAKES: readonly PreSplitGoldenBake[] = [
  {
    mode: 'progressive',
    frameCount: 5,
    canonicalStart: 0,
    motion: { deformation: 45, position: 35 },
    size: { width: 48, height: 48 },
    frames: [
      {
        frameIndex: 0,
        appFrame: 0,
        rgbaBase64: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwDkr/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMA5K/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMA5K//AOSv/wDkr/8A5K//AOSv/AAAAAAAAAAAAAAAAwDkr/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAOSv/wDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMA5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAAAAAAAAAAADAOSv/AAAAAAAAAAAAAAAAAAAAAMA5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAwDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAwDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMA5K/8AAAAAAAAAAMA5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/AAAAAMA5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/wAAAADAOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/AAAAAMA5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMA5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/wAAAADAOSv/wDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMA5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAwDkr/8A5K//AOSv/wDkr/8A5K//AOSv/AAAAAAAAAADAOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/AAAAAAAAAAAAAAAAAAAAAMA5K/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/AAAAAMA5K//AOSv/wDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAAAAAAAAAAADAOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMA5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAwDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAAAAAAAAAAAAAAAAAwDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMA5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/AAAAAAAAAAAAAAAAwDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/AAAAAAAAAAAAAAAAAAAAAMA5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAAAAAAAAAAADAOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAAAAAAMA5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMA5K/8AAAAAAAAAAMA5K/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAwDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAAAAAAMA5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMA5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAAAAAAMA5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAAAAAAAAAAADAOSv/wDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMA5K//AOSv/wDkr/8A5K//AOSv/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMA5K/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwDkr/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        digest: "ce7f39b47bc8c232450e859c09812f93f4296fe8401b0239d00fac68398b193f",
      },
      {
        frameIndex: 1,
        appFrame: 1,
        rgbaBase64: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwDkr/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMA5K/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMA5K//AOSv/wDkr/8A5K//AOSv/AAAAAAAAAAAAAAAAwDkr/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAOSv/wDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMA5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAAAAAAAAAAADAOSv/AAAAAAAAAAAAAAAAAAAAAMA5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAwDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAwDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMA5K/8AAAAAAAAAAMA5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/AAAAAMA5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/wAAAADAOSv/wDkr/8A5K//AOSv/KYC5/8A5K//AOSv/AAAAAMA5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMA5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K/8pgLn/KYC5/ymAuf/AOSv/wDkr/wAAAADAOSv/wDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMA5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAwDkr/8A5K//AOSv/wDkr/8A5K//AOSv/AAAAAAAAAADAOSv/wDkr/ymAuf8pgLn/KYC5/ymAuf8pgLn/AAAAAAAAAAAAAAAAAAAAAMA5K/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAAAAAAAAAAADAOSv/wDkr/8A5K/8pgLn/KYC5/ymAuf/AOSv/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMA5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAAAAAAAAAAAAAAAAAwDkr/8A5K//AOSv/KYC5/8A5K//AOSv/wDkr/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMA5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/AAAAAAAAAAAAAAAAAAAAAMA5K/8pgLn/KYC5/ymAuf/AOSv/wDkr/8A5K/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/wAAAADAOSv/AAAAAMA5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAAAAAACmAuf8pgLn/KYC5/ymAuf8pgLn/wDkr/8A5K/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMA5K/8AAAAAAAAAAMA5K/8AAAAAwDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAwDkr/8A5K/8pgLn/KYC5/ymAuf/AOSv/wDkr/8A5K//AOSv/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAwDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAAAAAAMA5K//AOSv/KYC5/8A5K//AOSv/wDkr/8A5K/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/AAAAAMA5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAAAAAAMA5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAAAAAAMA5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/wAAAADAOSv/wDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAAAAAAAAAAAAAAAAAwDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAAAAAAMA5K/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAOSv/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAOSv/wDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAOSv/wDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMA5K/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        digest: "dc2b32d4ae68f8141e7fe31c8d43a242b6415bcf17733622936a885c3209875b",
      },
      {
        frameIndex: 2,
        appFrame: 2,
        rgbaBase64: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACmAuf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKYC5/ymAuf8pgLn/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAApgLn/KYC5/ymAuf8pgLn/KYC5/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKYC5/ymAuf8pgLn/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACmAuf8pgLn/KYC5/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKYC5/ymAuf8pgLn/KYC5/ymAuf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAApgLn/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACmAuf8pgLn/KYC5/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACmAuf8pgLn/KYC5/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAOSv/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMA5K/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAApgLn/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKYC5/ymAuf8pgLn/KYC5/ymAuf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAOSv/wDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACmAuf8pgLn/KYC5/wAAAAAAAAAAwDkr/wAAAAAAAAAAAAAAAAAAAADAOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMA5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAApgLn/AAAAAMA5K//AOSv/wDkr/8A5K//AOSv/AAAAAAAAAADAOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/AAAAAAAAAAAAAAAAwDkr/wAAAAAAAAAAAAAAAMA5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAwDkr/wAAAAAAAAAAAAAAAMA5K/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwDkr/8A5K//AOSv/wDkr/8A5K//AOSv/AAAAAMA5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwDkr/8A5K//AOSv/wDkr/8A5K//AOSv/AAAAAAAAAADAOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/AAAAAAAAAADAOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwDkr/8A5K//AOSv/wDkr/8A5K//AOSv/AAAAAAAAAAAAAAAAwDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/AAAAAMA5K//AOSv/wDkr/8A5K//AOSv/AAAAAMA5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAwDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAAAAAAAAAAAAAAAAAwDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/AAAAAMA5K//AOSv/wDkr/8A5K//AOSv/AAAAAMA5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAwDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAAAAAAAAAAADAOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAwDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/wAAAADAOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAAAAAAAAAAADAOSv/KYC5/8A5K//AOSv/wDkr/8A5K//AOSv/AAAAAAAAAAAAAAAAAAAAAMA5K//AOSv/wDkr/8A5K//AOSv/AAAAAMA5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAAAAAAAAAAAAAAAAAwDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAAAAAAMA5K/8pgLn/KYC5/ymAuf/AOSv/wDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAAAAAAMA5K//AOSv/wDkr/8A5K//AOSv/AAAAACeuYP/AOSv/wDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAAAAAAAAAAAAAAAAAwDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAAAAAAAAAAAAAAAAAwDkr/8A5K//AOSv/wDkr/8A5K//AOSv/AAAAAAAAAAAAAAAAAAAAACmAuf8pgLn/KYC5/ymAuf8pgLn/wDkr/8A5K//AOSv/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwDkr/wAAAAAnrmD/J65g/yeuYP8nrmD/J65g/8A5K//AOSv/wDkr/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAOSv/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwDkr/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAApgLn/KYC5/ymAuf/AOSv/wDkr/8A5K//AOSv/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKYC5/8A5K//AOSv/wDkr/8A5K/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAOSv/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJ65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/AAAAACeuYP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAnrmD/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJ65g/yeuYP8nrmD/J65g/yeuYP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAnrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAnrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8AAAAAAAAAAAAAAAAAAAAAJ65g/wAAAAAAAAAAJ65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACeuYP8AAAAAJ65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/AAAAACeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8AAAAAJ65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8AAAAAJ65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAnrmD/J65g/yeuYP8nrmD/J65g/wAAAAAnrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACeuYP8AAAAAAAAAAAAAAAAAAAAAJ65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJ65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACeuYP8nrmD/J65g/yeuYP8nrmD/AAAAAAAAAAAnrmD/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJ65g/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        digest: "abb038c9736dc3e6111bee4ec079dd0ba789de63badc5265229b9df64ce3a136",
      },
      {
        frameIndex: 3,
        appFrame: 3,
        rgbaBase64: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACmAuf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKYC5/ymAuf8pgLn/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAApgLn/KYC5/ymAuf8pgLn/KYC5/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKYC5/ymAuf8pgLn/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACmAuf8pgLn/KYC5/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKYC5/ymAuf8pgLn/KYC5/ymAuf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAApgLn/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACmAuf8pgLn/KYC5/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACmAuf8pgLn/KYC5/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAOSv/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/AAAAAMA5K/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAApgLn/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKYC5/ymAuf8pgLn/KYC5/ymAuf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP8AAAD/AAAA/8A5K//AOSv/wDkr/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACmAuf8pgLn/KYC5/wAAAAAAAAAAwDkr/wAAAAAAAAAAAAAAAAAAAADAOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMA5K/8AAAD/wDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/wAAAP8AAAD/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAApgLn/AAAAAMA5K//AOSv/wDkr/8A5K//AOSv/AAAAAAAAAADAOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/AAAAAAAAAAAAAAAAwDkr/wAAAAAAAAAAAAAAAMA5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAwDkr/wAAAAAAAAAAAAAAAMA5K/8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwDkr/8A5K//AOSv/wDkr/8A5K//AOSv/AAAAAMA5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/AAAA/wAAAP8AAAD/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwDkr/8A5K//AOSv/wDkr/8A5K//AOSv/AAAAAAAAAADAOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/wAAAP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/AAAAAAAAAADAOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwDkr/8A5K//AOSv/wDkr/8A5K//AOSv/AAAAAAAAAAAAAAAAwDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/AAAAAMA5K//AOSv/wDkr/8A5K//AOSv/AAAAAMA5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAwDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAAAAAAAAAAAAAAAAAwDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/AAAAAMA5K//AOSv/wDkr/8A5K//AOSv/AAAAAMA5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAwDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAAAAAAAAAAADAOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAwDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K/8AAAD/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/wAAAADAOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAAAAAAAAAAADAOSv/KYC5/8A5K//AOSv/wDkr/8A5K//AOSv/AAAAAAAAAAAAAAAAAAAAAMA5K//AOSv/wDkr/8A5K//AOSv/AAAAAAAAAP8AAAD/AAAA/8A5K//AOSv/wDkr/8A5K/8AAAAAAAAAAAAAAAAAAAAAwDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAAAAAAMA5K/8pgLn/KYC5/ymAuf/AOSv/wDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAAAAAAMA5K//AOSv/wDkr/8A5K//AOSv/AAAAACeuYP8AAAD/wDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAAAAAAAAAAAAAAAAAwDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAAAAAAAAAAAAAAAD/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/AAAAAAAAAAAAAAAAAAAAACmAuf8pgLn/KYC5/ymAuf8pgLn/wDkr/8A5K//AOSv/AAAAAAAAAAApgLn/AAAAAAAAAAAAAAAAwDkr/wAAAAAnrmD/J65g/yeuYP8nrmD/J65g/8A5K//AOSv/wDkr/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAOSv/AAAAAAAAAAAAAAAAAAAAAAAAAP8AAAD/AAAA/wAAAAAAAAAAwDkr/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP8pgLn/KYC5/ymAuf/AOSv/wDkr/8A5K//AOSv/AAAAACmAuf8pgLn/AAAAAAAAAAAAAAAAAAAAACeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/wAAAP8AAAD/KYC5/8A5K//AOSv/wDkr/8A5K/8AAAAAKYC5/ymAuf8pgLn/AAAAAAAAAAAAAAAAAAAAACeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/AAAA/wAAAP8AAAD/AAAA/wAAAADAOSv/AAAAAAAAAAAAAAAAAAAAACmAuf8pgLn/AAAAAAAAAAAAAAAAJ65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/AAAAACeuYP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAnrmD/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/wAAAP8AAAD/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAApgLn/AAAAAAAAAAAAAAAAAAAAACeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJ65g/yeuYP8nrmD/J65g/yeuYP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAnrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAnrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8AAAAAAAAAAAAAAAAAAAAAJ65g/wAAAAAAAAAAJ65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACeuYP8AAAAAJ65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/AAAAACeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8AAAAAJ65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8AAAAAJ65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAnrmD/J65g/yeuYP8nrmD/J65g/wAAAAAnrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACeuYP8AAAAAAAAAAAAAAAAAAAAAJ65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJ65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACeuYP8nrmD/J65g/yeuYP8nrmD/AAAAAAAAAAAnrmD/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJ65g/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/AAAA/wAAAP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP8AAAAAAAAAAAAAAAAAAAAAAAAA/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/wAAAP8AAAD/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/AAAA/wAAAP8AAAD/AAAA/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/wAAAP8AAAD/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/AAAA/wAAAP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        digest: "3999a21d6ab91a5cfd0132d236ac8ba4c1c942af2d89ff948ecd952cf66582a9",
      },
      {
        frameIndex: 4,
        appFrame: 4,
        rgbaBase64: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKYC5/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAApgLn/KYC5/ymAuf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACmAuf8pgLn/KYC5/ymAuf8pgLn/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAApgLn/KYC5/ymAuf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKYC5/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAApgLn/wDkr/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP8AAAD/AAAA/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP8AAAAAAAAAACmAuf8pgLn/KYC5/8A5K//AOSv/wDkr/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMA5K/8AAAD/AAAAAMA5K/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwDkr/8A5K/8AAAAAAAAA/wAAAP8AAAD/KYC5/ymAuf8pgLn/KYC5/ymAuf/AOSv/wDkr/8A5K//AOSv/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMA5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAAAAAAMA5K//AOSv/wDkr/8A5K/8AAAD/AAAA/wAAAP8AAAD/AAAA/ymAuf8pgLn/KYC5/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAAAAAAAAAAADAOSv/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAwDkr/8A5K//AOSv/wDkr/8A5K//AOSv/AAAA/wAAAP8AAAD/wDkr/8A5K/8pgLn/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAAAAAAMA5K//AOSv/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAwDkr/8A5K//AOSv/wDkr/8A5K//AOSv/KYC5/wAAAP8pgLn/KYC5/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAAAAAAMA5K//AOSv/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMA5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K/8pgLn/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAwDkr/8A5K//AOSv/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMA5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAwDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K/8pgLn/AAAAAMA5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAwDkr/8A5K//AOSv/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAwDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/KYC5/wAAAAAAAAAAwDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAAAAAAMA5K//AOSv/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMA5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/wAAAADAOSv/wDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAAAAAAMA5K//AOSv/wDkr/8A5K//AOSv/AAAAAMA5K/8pgLn/KYC5/ymAuf8AAAAAAAAAAAAAAAAAAAAAwDkr/8A5K//AOSv/AAAAAAAAAAAAAAAAAAAAAAAAAADAOSv/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMA5K/8AAAD/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/AAAAAAAAAAAAAAAAwDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAAAAAAAAAAAAAAAAAwDkr/8A5K/8AAAAAAAAAAAAAAAApgLn/KYC5/wAAAAApgLn/AAAAAAAAAAAAAAAAwDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAAAAAAMA5K//AOSv/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP8AAAD/AAAA/8A5K//AOSv/wDkr/8A5K/8AAAAAAAAAAAAAAAAAAAAAAAAAAMA5K//AOSv/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACmAuf8pgLn/KYC5/wAAAAAAAAAAAAAAAMA5K//AOSv/wDkr/8A5K/8AAAAAwDkr/8A5K/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/wDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAAAAAAAAAAAAAAAAAwDkr/8A5K/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKYC5/ymAuf8pgLn/KYC5/ymAuf8AAAAAAAAAAMA5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAAAAAAAAAAADAOSv/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJ65g/wAAAP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACmAuf8pgLn/KYC5/wAAAP8AAAAAAAAAAAAAAADAOSv/wDkr/8A5K/8pgLn/wDkr/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAOSv/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAnrmD/J65g/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAApgLn/AAAAAAAAAAAAAAD/AAAAAAAAAAAAAAAAAAAAACmAuf8pgLn/KYC5/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACeuYP8AAAAAAAAAAAAAAAAAAAAAJ65g/yeuYP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAnrmD/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/wAAAAAAAAAAKYC5/ymAuf8pgLn/KYC5/ymAuf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAnrmD/J65g/yeuYP8AAAAAAAAAAAAAAAAAAAAAAAAAACeuYP8nrmD/AAAAAAAAAAAAAAAAJ65g/yeuYP8nrmD/J65g/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACmAuf8pgLn/KYC5/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACeuYP8nrmD/J65g/yeuYP8nrmD/AAAAAAAAAAAAAAAAJ65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAApgLn/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACeuYP8AAAAAAAAAAAAAAAAAAAAAAAAAACeuYP8nrmD/J65g/yeuYP8nrmD/J65g/wAAAAAnrmD/J65g/yeuYP8nrmD/J65g/wAAAAAnrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAnrmD/J65g/yeuYP8nrmD/J65g/wAAAAAAAAAAJ65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8AAAAAAAAAACeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/AAAAAAAAAAAnrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8AAAAAAAAAACeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8AAAAAJ65g/wAAAAAAAAAAAAAAAAAAAAAnrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/AAAAAI5Erf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJ65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/AAAAAAAAAAAnrmD/J65g/yeuYP8nrmD/J65g/wAAAAAAAAAAAAAAAAAAAACORK3/AAAAAAAAAAAAAAAAJ65g/yeuYP8nrmD/J65g/yeuYP+ORK3/jkSt/45Erf+ORK3/jkSt/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8AAAAAAAAAAAAAAAAAAAAAAAAAACeuYP8AAAAAAAAAAAAAAAAAAAAAjkSt/45Erf+ORK3/jkSt/45Erf8AAAAAJ65g/yeuYP8nrmD/J65g/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/J65g/yeuYP8nrmD/J65g/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAnrmD/J65g/yeuYP8nrmD/J65g/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/J65g/yeuYP8nrmD/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACeuYP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAI5Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf8nrmD/J65g/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/J65g/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/J65g/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf8AAAAAAAAAAAAAAAAAAAAAAAAAAI5Erf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAjkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/AAAAAAAAAACORK3/jkSt/45Erf+ORK3/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAI5Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/AAAAAI5Erf+ORK3/jkSt/45Erf+ORK3/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/AAAA/wAAAP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAI5Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP8AAAAAAAAAAAAAAAAAAAAAAAAA/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAjkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/wAAAP8AAAD/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAI5Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/AAAA/wAAAP8AAAD/AAAA/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAI5Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf8AAAAAjkSt/45Erf+ORK3/jkSt/45Erf+ORK3/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/wAAAP8AAAD/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/wAAAACORK3/jkSt/45Erf+ORK3/jkSt/wAAAACORK3/jkSt/45Erf+ORK3/jkSt/wAAAACORK3/AAAAAAAAAAAAAAAAjkSt/45Erf+ORK3/jkSt/45Erf+ORK3/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/AAAA/wAAAP8AAAAAAAAAAI5Erf8AAAAAAAAAAAAAAAAAAAAAAAAAAI5Erf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAI5Erf+ORK3/jkSt/45Erf+ORK3/",
        digest: "a0d0ec7643696562399c1807add0571605e1a30ca5a235b0b47bb6bfc1b863cd",
      },
    ],
  },
  {
    mode: 'static',
    frameCount: 3,
    canonicalStart: 0,
    motion: { deformation: 45, position: 35 },
    size: { width: 48, height: 48 },
    frames: [
      {
        frameIndex: 0,
        appFrame: 0,
        rgbaBase64: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwDkr/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACmAuf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMA5K/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMA5K//AOSv/wDkr/8A5K//AOSv/AAAAAAAAAAAAAAAAwDkr/wAAAAAAAAAAAAAAAAAAAAAAAAAAKYC5/ymAuf8pgLn/AAAAAAAAAAAAAAAAAAAAAAAAAADAOSv/wDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/AAAAAAAAAAApgLn/KYC5/ymAuf8pgLn/KYC5/wAAAAAAAAAAAAAAAMA5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAOSv/wDkr/8A5K/8AAAD/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAKYC5/ymAuf8pgLn/AAAAACmAuf8AAAAAAAAAAMA5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwDkr/8A5K//AOSv/wDkr/wAAAP8AAAD/AAAA/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAwDkr/wAAAP/AOSv/KYC5/ymAuf8pgLn/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMA5K/8AAAAAAAAAAMA5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K/8AAAD/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/AAAA/wAAAP8AAAD/KYC5/ymAuf8pgLn/KYC5/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/wAAAAAAAAD/AAAA/wAAAP8AAAD/AAAA/ymAuf8pgLn/AAAAAMA5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMA5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/AAAA/wAAAP8AAAD/wDkr/ymAuf/AOSv/wDkr/wAAAADAOSv/KYC5/8A5K//AOSv/wDkr/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMA5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAwDkr/8A5K//AOSv/wDkr/8A5K//AOSv/AAAAAAAAAADAOSv/wDkr/wAAAP/AOSv/wDkr/8A5K//AOSv/AAAAAAAAAAApgLn/KYC5/ymAuf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/wAAAADAOSv/AAAAAAAAAADAOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/AAAAACmAuf8pgLn/KYC5/ymAuf8pgLn/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMA5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAwDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAwDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/wAAAAApgLn/KYC5/ymAuf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMA5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAAAAAAMA5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAAAAAAMA5K//AOSv/AAAAAMA5K//AOSv/wDkr/8A5K/8AAAAAKYC5/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/AAAAAMA5K//AOSv/AAAAAMA5K/8AAAAAAAAAAAAAAADAOSv/wDkr/8A5K/8pgLn/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMA5K/8AAAD/AAAAAMA5K/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMA5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAAAAAAAAAAAAAAAAAwDkr/wAAAAAAAAAAAAAAAAAAAAAAAAAAwDkr/ymAuf8pgLn/KYC5/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP8AAAD/AAAA/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMA5K/8AAAAAAAAAAAAAAADAOSv/KYC5/ymAuf8pgLn/KYC5/ymAuf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAAAAAAAAAAAAAAAAAAAAAAMA5K//AOSv/AAAAAMA5K//AOSv/wDkr/ymAuf8pgLn/KYC5/ymAuf8pgLn/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/wAAAP8AAAD/AAAAAAAAAAAAAAAAAAAAAAAAAADAOSv/wDkr/8A5K//AOSv/wDkr/wAAAAApgLn/KYC5/ymAuf8pgLn/KYC5/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwDkr/8A5K//AOSv/wDkr/wAAAADAOSv/wDkr/8A5K/8AAAD/wDkr/8A5K/8AAAAAAAAAAAAAAAAAAAAAAAAAAMA5K/8AAAAAAAAAAAAAAAAAAAAAKYC5/ymAuf8pgLn/AAAAACmAuf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwDkr/8A5K//AOSv/AAAAAAAAAAAAAAAAwDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACmAuf8AAAAAKYC5/ymAuf8pgLn/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMA5K//AOSv/wDkr/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAApgLn/KYC5/ymAuf8pgLn/KYC5/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMA5K/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKYC5/ymAuf8pgLn/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACmAuf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAnrmD/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAI5Erf8AAAAAAAAAAAAAAAAAAAAAJ65g/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJ65g/yeuYP8nrmD/jkSt/yeuYP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACORK3/jkSt/45Erf+ORK3/jkSt/yeuYP8nrmD/J65g/yeuYP8nrmD/AAAAAAAAAAAAAAAAAAAAAAAAAAAnrmD/J65g/45Erf+ORK3/jkSt/45Erf+ORK3/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJ65g/wAAAAAAAAAAJ65g/wAAAAAAAAAAAAAAAI5Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf8nrmD/J65g/yeuYP8nrmD/J65g/wAAAAAAAAAAAAAAAAAAAAAnrmD/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/AAAAAI5Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf8nrmD/J65g/45Erf+ORK3/J65g/wAAAAAAAAAAAAAAACeuYP8nrmD/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/wAAAAAAAAAAAAAAAAAAAAAAAAAAjkSt/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJ65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf8AAAAAAAAAAAAAAACORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf8AAAAAAAAAAI5Erf+ORK3/jkSt/45Erf+ORK3/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJ65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/AAAAAAAAAAAnrmD/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/AAAAAAAAAAAAAAAAAAAAAAAAAAAnrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/wAAAAAAAAAAjkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJ65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/wAAAACORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJ65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/AAAA/wAAAAAAAAAAAAAAAI5Erf8AAAAAAAAAAI5Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8AAAD/AAAA/wAAAP8AAAAAAAAAAAAAAAAAAAAAAAAAAI5Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJ65g/wAAAP8AAAAAJ65g/wAAAAAAAAAAAAAA/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/wAAAP8AAAD/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAnrmD/J65g/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/AAAAAAAAAAAAAAAAjkSt/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/AAAA/wAAAP8AAAD/AAAA/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJ65g/yeuYP8nrmD/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/wAAAAAAAAAAjkSt/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/wAAAP8AAAD/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/yeuYP8nrmD/J65g/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/AAAA/wAAAP8nrmD/J65g/yeuYP8nrmD/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        digest: "80f8322ad8dcd17c7308451bd946e581fb562c649d321915ec7bca1a00894a0b",
      },
      {
        frameIndex: 1,
        appFrame: 1,
        rgbaBase64: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwDkr/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACmAuf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMA5K/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMA5K//AOSv/wDkr/8A5K//AOSv/AAAAAAAAAAAAAAAAwDkr/wAAAAAAAAAAAAAAAAAAAAAAAAAAKYC5/ymAuf8pgLn/AAAAAAAAAAAAAAAAAAAAAAAAAADAOSv/wDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/AAAAAAAAAAApgLn/KYC5/ymAuf8pgLn/KYC5/wAAAAAAAAAAAAAAAMA5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAOSv/wDkr/8A5K/8AAAD/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAKYC5/ymAuf8pgLn/AAAAACmAuf8AAAAAAAAAAMA5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwDkr/8A5K//AOSv/wDkr/wAAAP8AAAD/AAAA/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAwDkr/wAAAP/AOSv/KYC5/ymAuf8pgLn/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMA5K/8AAAAAAAAAAMA5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K/8AAAD/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/AAAA/wAAAP8AAAD/KYC5/ymAuf8pgLn/KYC5/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/wAAAAAAAAD/AAAA/wAAAP8AAAD/AAAA/ymAuf8pgLn/AAAAAMA5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMA5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/AAAA/wAAAP8AAAD/wDkr/ymAuf/AOSv/wDkr/wAAAADAOSv/KYC5/8A5K//AOSv/wDkr/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMA5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAwDkr/8A5K//AOSv/wDkr/8A5K//AOSv/AAAAAAAAAADAOSv/wDkr/wAAAP/AOSv/wDkr/8A5K//AOSv/AAAAAAAAAAApgLn/KYC5/ymAuf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/wAAAADAOSv/AAAAAAAAAADAOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/AAAAACmAuf8pgLn/KYC5/ymAuf8pgLn/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMA5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAwDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAwDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/wAAAAApgLn/KYC5/ymAuf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMA5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAAAAAAMA5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAAAAAAMA5K//AOSv/AAAAAMA5K//AOSv/wDkr/8A5K/8AAAAAKYC5/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/AAAAAMA5K//AOSv/AAAAAMA5K/8AAAAAAAAAAAAAAADAOSv/wDkr/8A5K/8pgLn/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMA5K/8AAAD/AAAAAMA5K/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMA5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAAAAAAAAAAAAAAAAAwDkr/wAAAAAAAAAAAAAAAAAAAAAAAAAAwDkr/ymAuf8pgLn/KYC5/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP8AAAD/AAAA/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMA5K/8AAAAAAAAAAAAAAADAOSv/KYC5/ymAuf8pgLn/KYC5/ymAuf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAAAAAAAAAAAAAAAAAAAAAAMA5K//AOSv/AAAAAMA5K//AOSv/wDkr/ymAuf8pgLn/KYC5/ymAuf8pgLn/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/wAAAP8AAAD/AAAAAAAAAAAAAAAAAAAAAAAAAADAOSv/wDkr/8A5K//AOSv/wDkr/wAAAAApgLn/KYC5/ymAuf8pgLn/KYC5/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwDkr/8A5K//AOSv/wDkr/wAAAADAOSv/wDkr/8A5K/8AAAD/wDkr/8A5K/8AAAAAAAAAAAAAAAAAAAAAAAAAAMA5K/8AAAAAAAAAAAAAAAAAAAAAKYC5/ymAuf8pgLn/AAAAACmAuf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwDkr/8A5K//AOSv/AAAAAAAAAAAAAAAAwDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACmAuf8AAAAAKYC5/ymAuf8pgLn/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMA5K//AOSv/wDkr/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAApgLn/KYC5/ymAuf8pgLn/KYC5/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMA5K/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKYC5/ymAuf8pgLn/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACmAuf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAnrmD/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAI5Erf8AAAAAAAAAAAAAAAAAAAAAJ65g/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJ65g/yeuYP8nrmD/jkSt/yeuYP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACORK3/jkSt/45Erf+ORK3/jkSt/yeuYP8nrmD/J65g/yeuYP8nrmD/AAAAAAAAAAAAAAAAAAAAAAAAAAAnrmD/J65g/45Erf+ORK3/jkSt/45Erf+ORK3/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJ65g/wAAAAAAAAAAJ65g/wAAAAAAAAAAAAAAAI5Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf8nrmD/J65g/yeuYP8nrmD/J65g/wAAAAAAAAAAAAAAAAAAAAAnrmD/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/AAAAAI5Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf8nrmD/J65g/45Erf+ORK3/J65g/wAAAAAAAAAAAAAAACeuYP8nrmD/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/wAAAAAAAAAAAAAAAAAAAAAAAAAAjkSt/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJ65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf8AAAAAAAAAAAAAAACORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf8AAAAAAAAAAI5Erf+ORK3/jkSt/45Erf+ORK3/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJ65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/AAAAAAAAAAAnrmD/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/AAAAAAAAAAAAAAAAAAAAAAAAAAAnrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/wAAAAAAAAAAjkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJ65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/wAAAACORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJ65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/AAAA/wAAAAAAAAAAAAAAAI5Erf8AAAAAAAAAAI5Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8AAAD/AAAA/wAAAP8AAAAAAAAAAAAAAAAAAAAAAAAAAI5Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJ65g/wAAAP8AAAAAJ65g/wAAAAAAAAAAAAAA/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/wAAAP8AAAD/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAnrmD/J65g/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/AAAAAAAAAAAAAAAAjkSt/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/AAAA/wAAAP8AAAD/AAAA/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJ65g/yeuYP8nrmD/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/wAAAAAAAAAAjkSt/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/wAAAP8AAAD/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/yeuYP8nrmD/J65g/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/AAAA/wAAAP8nrmD/J65g/yeuYP8nrmD/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        digest: "80f8322ad8dcd17c7308451bd946e581fb562c649d321915ec7bca1a00894a0b",
      },
      {
        frameIndex: 2,
        appFrame: 2,
        rgbaBase64: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAApgLn/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAOSv/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/AAAAAMA5K/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACmAuf8pgLn/KYC5/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP8AAAD/AAAA/8A5K//AOSv/wDkr/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP8AAAAAKYC5/ymAuf8pgLn/KYC5/ymAuf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwDkr/wAAAAAAAAAAAAAAAAAAAADAOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMA5K/8AAAD/wDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/wAAAP8AAAD/AAAAACmAuf8pgLn/KYC5/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMA5K//AOSv/wDkr/8A5K//AOSv/AAAAAAAAAADAOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/AAAAAAAAAAAAAAAAwDkr/wAAAAAAAAAAAAAAAMA5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAwDkr/wAAAAAAAAAAAAAAAMA5K/8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAAApgLn/AAAAAAAAAAApgLn/AAAAAAAAAAAAAAAAwDkr/8A5K//AOSv/wDkr/8A5K//AOSv/AAAAAMA5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/AAAA/wAAAP8AAAD/AAAAAAAAAAAAAAAAAAAAACmAuf8pgLn/KYC5/wAAAAAAAAAAwDkr/8A5K//AOSv/wDkr/8A5K//AOSv/AAAAAAAAAADAOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/wAAAP8AAAAAAAAAAAAAAAAAAAAAKYC5/ymAuf8pgLn/KYC5/ymAuf/AOSv/wDkr/8A5K/8AAAAAwDkr/8A5K//AOSv/AAAAAAAAAADAOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/AAAAAAAAAAAAAAAAAAAAACmAuf8pgLn/KYC5/wAAAAAAAAAAwDkr/wAAAAAAAAAAAAAAAMA5K//AOSv/AAAAAAAAAAAAAAAAwDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAwDkr/wAAAAAAAAAAAAAAAAAAAAApgLn/AAAAAAAAAADAOSv/AAAAAAAAAAAAAAAAAAAAAAAAAADAOSv/AAAAAAAAAAAAAAAAAAAAAAAAAADAOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAwDkr/8A5K/8AAAAAwDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAAAAAAMA5K//AOSv/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAAAAAAMA5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAOSv/wDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAwDkr/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAOSv/wDkr/8A5K/8AAAD/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/AAAAAMA5K//AOSv/AAAAAAAAAAAAAAAAAAAAAAAAAADAOSv/wDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwDkr/wAAAP8AAAD/AAAA/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAAAAAAAAAAAAAAAAAwDkr/8A5K//AOSv/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwDkr/wAAAAAAAAAAAAAAAMA5K//AOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/wDkr/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwDkr/yeuYP8AAAD/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/AAAAAMA5K//AOSv/wDkr/8A5K/8AAAAAAAAAAAAAAAAAAAAAAAAAAMA5K/8AAAD/wDkr/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAOSv/wDkr/8A5K//AOSv/wDkr/8A5K//AOSv/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAnrmD/J65g/yeuYP8nrmD/J65g/8A5K//AOSv/wDkr/8A5K//AOSv/AAAAAMA5K//AOSv/wDkr/8A5K//AOSv/AAAAAAAAAAAAAAAAwDkr/wAAAP8AAAD/AAAA/8A5K/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwDkr/8A5K//AOSv/wDkr/8A5K//AOSv/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8AAAAAwDkr/wAAAAAAAAAAAAAAAAAAAAAAAAAAwDkr/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMA5K/8AAAD/wDkr/8A5K//AOSv/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/wDkr/8A5K//AOSv/wDkr/8A5K/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMA5K//AOSv/wDkr/8A5K//AOSv/AAAAAAAAAAAAAAAAAAAAACmAuf8AAAD/AAAAAAAAAP8AAAD/AAAA/wAAAADAOSv/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJ65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/AAAAACeuYP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwDkr/wAAAAAnrmD/AAAAAAAAAAAAAAAAAAAAAAAAAAApgLn/AAAA/wAAAP8AAAD/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJ65g/yeuYP8nrmD/J65g/yeuYP8AAAAAAAAAAAAAAAAAAAAAKYC5/wAAAP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAnrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKYC5/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAnrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8AAAAAAAAAAAAAAAAAAAAAJ65g/wAAAAAAAAAAJ65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/AAAAAAAAAAAAAAAAAAAAAAAAAAApgLn/KYC5/wAAAAAAAAAAAAAAAAAAAAApgLn/KYC5/ymAuf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACeuYP8AAAAAJ65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/AAAAACeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/wAAAAAAAAAAAAAAAAAAAAAAAAAAKYC5/ymAuf8AAAAAAAAAACmAuf8pgLn/KYC5/ymAuf8pgLn/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8AAAAAJ65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACmAuf8AAAAAAAAAAAAAAAApgLn/KYC5/ymAuf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8AAAAAJ65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKYC5/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAnrmD/J65g/yeuYP8nrmD/J65g/wAAAAAnrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACeuYP8AAAAAAAAAAAAAAAAAAAAAJ65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJ65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8nrmD/J65g/yeuYP8AAAAAAAAAAAAAAAAAAAAAAAAAAI5Erf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACeuYP8nrmD/J65g/yeuYP8nrmD/AAAAAAAAAAAnrmD/AAAAAAAAAAAAAAAAAAAAAAAAAACORK3/jkSt/45Erf+ORK3/jkSt/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJ65g/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAI5Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAI5Erf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAI5Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACORK3/jkSt/45Erf+ORK3/jkSt/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAjkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAI5Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/AAAA/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAI5Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP8AAAAAAAAAAAAAAAAAAAAAjkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAI5Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/wAAAP8AAAD/AAAAAAAAAAAAAAAAjkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf8AAAAAAAAAAAAAAAAAAAAAAAAAAI5Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/AAAA/wAAAP8AAAD/AAAA/wAAAAAAAAAAAAAAAI5Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/wAAAAAAAAAAjkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/wAAAP8AAAD/AAAAAAAAAAAAAAAAAAAAAI5Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/AAAAAI5Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf+ORK3/jkSt/45Erf8AAAAAAAAAAAAAAAAAAAAA",
        digest: "af0505b88bd44baedeb4cbab79b4abf2d064fcd0fadbd3052e472972a85bc9a0",
      },
    ],
  },
];
