/**
 * Quick 260928-dh1 — DEV deposit speckle capture harness (RED/GREEN matrix
 * + the four-seam birthplace chain).
 *
 * LAWS THIS FILE OPERATES UNDER
 *
 * - 260925-dso (clean edges) EXEMPTION — MEASUREMENT ONLY: this module READS
 *   pixels (getImageData) and never renders. The production stroke raster must
 *   run ZERO per-pixel passes (paint.grainRemoval.test.ts pins that), and this
 *   harness is not part of it: nothing in the production paint path imports
 *   this module, and the only entry point is installed behind
 *   `import.meta.env.DEV` at the Studio engine-ready seam
 *   (PhysicsPaintStudio.tsx). The bristle pass stays ctx.stroke() geometry.
 *
 * - ONE noise generator: this harness only OBSERVES. For the run duration it
 *   installs an LCG over Math.random (seed 123456789 — the paint.grainRemoval
 *   test constant) so the RED and GREEN runs consume the same unseeded
 *   production randoms and are pixel-comparable; the original Math.random is
 *   restored in `finally`, so production code outside the capture is untouched.
 *
 * - NO DEPOSIT CODE. The four-seam probes monkey-patch document.createElement,
 *   the offscreen 2d getImageData/translate, dryCtx.getImageData/putImageData,
 *   and setPerformanceListener for the run duration only (restored in
 *   finally). wet-layer.ts / drying.ts / paint.ts / compositor.ts are untouched
 *   and DEPOSIT_KEEP_TIER is not read as a tunable here.
 *
 * - Acceptance metrics are tornEdge + bodyHardJumps + bodyHfEnergy
 *   (computeDefectMetrics). isolatedPx / edgeCliffs are CROSS-CHECK ONLY —
 *   isolatedPx scores a torn contour as 0 (every fringe pixel has the body as
 *   a peer), which is why the RED 889 / GREEN 912 live counts never agreed
 *   with the gate-field diagnosis.
 *
 * FOUR SEAMS (the birthplace chain — first seam whose defect metrics light up
 * is where the speckle is born):
 *   post-raster  the offData bytes transferToWetLayerClipped gates on
 *   post-gate    wet.alpha after the transfer pixel loop
 *   post-dry     the dry-canvas ImageData of the next dry writeback
 *   post-display copyLiveAlphaCanvas (dry-minus-background + wet display)
 * All four are cropped to the post-raster rect. NOTE: on the local-physics
 * path the (post-gate, post-dry) interval also contains the fluid advection
 * ticks + natural dryStep — if speckle first appears at post-dry, the
 * birthplace is "downstream of the gate", narrowed to fluid|dry, not the gate.
 *
 * RUN (user-side — Claude never launches the dev server, CLAUDE.md):
 *   window.__EFX_DH1_CAPTURE__('seams')  // birthplace chain (does not touch red/green artifacts)
 *   window.__EFX_DH1_CAPTURE__('red')    // before the fix (RED baseline)
 *   window.__EFX_DH1_CAPTURE__('green')  // after the fix (GREEN acceptance)
 *
 * Each label is one-shot per engine session (a second call returns the cached
 * promise). The capture CLEARS the current frame's paint first (engine.clear()
 * discards undo history) — run it on scratch work.
 *
 * OUTPUT: /tmp/efx-stall-capture-dh1-{label}.json (manifest via the Tauri
 * write_debug_capture command — now also carries `seams[]`) +
 * /tmp/efx-dh1/{label}/*.png (ZOOM-4 row snapshots) +
 * /tmp/efx-dh1/{label}/seam-{tag}--{seam}.png (four-seam chain crops).
 *
 * SNAPSHOT SURFACE: the engine's live-paint composite
 * (copyLiveAlphaCanvas = dry-minus-background + the wet display overlay). The
 * plan's "display canvas" metrics are ALPHA metrics (isolatedPx / edgeCliffs /
 * alphaMass all read the alpha channel), so the surface must be paint-only —
 * a background-baked canvas saturates alpha at 255 and would blind every
 * metric.
 */
import type { EfxPaintEngine } from '@efxlab/efx-physic-paint';
import { mkdir } from '@tauri-apps/plugin-fs';
import { exportWritePng } from '../../../lib/ipc';
import { canvasToPngBytes } from '../../../lib/rotoAlphaCanvasRegistry';

export type Dh1RunLabel = 'red' | 'green' | 'seams';

export const DH1_CAPTURE_LCG_SEED = 123456789;
export const DH1_CAPTURE_ZOOM = 4;
export const DH1_CAPTURE_BASE_DIR = '/tmp/efx-dh1';

/** Fixed synthetic timeStamp base — identical across runs for manifest parity. */
const TIME_BASE = 1000;
/** Sample spacing along the polyline (canvas px) — keeps the engine's 1.5px
 *  per-sample distance filter satisfied with a wide margin. */
const SAMPLE_STEP_PX = 12;
/** Leisurely drawing speed for the *-slow variants (px/ms). */
const SLOW_PX_PER_MS = 0.2;
/** Flick speed for the heavy-fast variant (px/ms) — drives speedDeplete and
 *  skipChance far enough for the round()-based layer count to actually move. */
const FAST_PX_PER_MS = 40;

const SETTLE_AFTER_STROKES_MS = 1500;
const PHYSICS_HOLD_MS = 600;
const SETTLE_AFTER_CLICK_MS = 500;
const INTER_STROKE_PAUSE_MS = 50;

/** One fixed polyline, normalized to the canvas box — recorded verbatim in the
 *  manifest; every variant is derived from it and differs ONLY in pressure and
 *  timeStamp (locked plan content spec). */
const BASE_POLYLINE: ReadonlyArray<readonly [number, number]> = [
  [0.08, 0.5],
  [0.24, 0.28],
  [0.4, 0.66],
  [0.56, 0.34],
  [0.72, 0.62],
  [0.92, 0.42],
];
/** Lane centers (fraction of canvas height): one per stroke variant so the
 *  per-lane alphaMass comparison measures ONE body each. */
const LANE_Y = [0.18, 0.5, 0.82] as const;
/** Lane region half-height (fraction of height) — regions never overlap. */
const LANE_HALF = 0.14;
/** Vertical wave spread of the polyline around its lane center. */
const Y_SPREAD = 0.24;

const DH1_COLOR = '#103c65';

/** Forced engine parameters — RED/GREEN parity is structural, never a function
 *  of whatever sliders the session happened to have. Recorded in the manifest. */
function forceDeterministicEngineState(eng: EngineInternals): Record<string, number> {
  eng.setTool('paint');
  eng.setColorHex(DH1_COLOR);
  eng.setBrushSize(16);
  eng.setBrushOpacity(100);
  eng.setBrushPressure(100);
  eng.setWaterAmount(50);
  eng.setEdgeDetail(4);
  eng.setAntiAlias(0);
  eng.setPickup(0);
  eng.setDrySpeed(100);
  eng.setPhysicsStrength(0.2);
  return { ...eng.state.brushOpts };
}

// ---------------------------------------------------------------------------
// Pure metrics (unit-tested headless — depositSpeckleCapture.metrics.test.ts)
// ---------------------------------------------------------------------------

export interface Dh1SpeckleMetrics {
  /** Salt-and-pepper detector: pixels with alpha >= 4 whose 8-neighborhood
   *  contains no pixel with alpha >= half its own. */
  isolatedPx: number;
  /** Adjacent (4-neighbour) pairs where alpha falls from >= 32 directly to
   *  <= 4 — a cliff where continuous falloff should step gently. */
  edgeCliffs: number;
  /** Sum of alpha over the measured region. */
  alphaMass: number;
}

/** RGBA byte buffer -> flat alpha plane. */
export function alphaFromRgba(data: ArrayLike<number>): Uint8Array {
  const pixels = Math.floor(data.length / 4);
  const alpha = new Uint8Array(pixels);
  for (let i = 0; i < pixels; i++) alpha[i] = data[i * 4 + 3];
  return alpha;
}

export function computeSpeckleMetrics(
  alpha: ArrayLike<number>,
  width: number,
  height: number,
): Dh1SpeckleMetrics {
  let isolatedPx = 0;
  let edgeCliffs = 0;
  let alphaMass = 0;

  const at = (x: number, y: number): number => alpha[y * width + x];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = at(x, y);
      if (a === 0) continue;
      alphaMass += a;
      if (a >= 4) {
        const half = a / 2;
        let hasPeer = false;
        for (let dy = -1; dy <= 1 && !hasPeer; dy++) {
          const ny = y + dy;
          if (ny < 0 || ny >= height) continue;
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx;
            if (nx < 0 || nx >= width) continue;
            if (at(nx, ny) >= half) {
              hasPeer = true;
              break;
            }
          }
        }
        if (!hasPeer) isolatedPx++;
      }
      // Right and down neighbours only — each adjacent pair visited once.
      if (x + 1 < width) {
        const b = at(x + 1, y);
        if ((a >= 32 && b <= 4) || (b >= 32 && a <= 4)) edgeCliffs++;
      }
      if (y + 1 < height) {
        const b = at(x, y + 1);
        if ((a >= 32 && b <= 4) || (b >= 32 && a <= 4)) edgeCliffs++;
      }
    }
  }

  return { isolatedPx, edgeCliffs, alphaMass };
}

/** alphaMass inside a lane rectangle (inclusive-exclusive bounds, canvas px). */
export function computeRegionAlphaMass(
  alpha: ArrayLike<number>,
  width: number,
  height: number,
  region: { x0: number; y0: number; x1: number; y1: number },
): number {
  const x0 = Math.max(0, Math.floor(region.x0));
  const y0 = Math.max(0, Math.floor(region.y0));
  const x1 = Math.min(width, Math.ceil(region.x1));
  const y1 = Math.min(height, Math.ceil(region.y1));
  let mass = 0;
  for (let y = y0; y < y1; y++) {
    const row = y * width;
    for (let x = x0; x < x1; x++) mass += alpha[row + x];
  }
  return mass;
}

// ---------------------------------------------------------------------------
// Defect metrics (the look acceptance) — torn contour + body speckle.
//
// isolatedPx UNDER-COUNTS the real defect (260928-dh1 metric gap): every
// fringe pixel next to a solid body has the body as a "peer", so a torn
// contour scores 0. These two score what the crops actually show. isolatedPx
// stays in the result as a CROSS-CHECK only, never as acceptance.
// ---------------------------------------------------------------------------

export interface Dh1DefectMetrics {
  /** Torn-contour detector: 1-3px scanline gaps between nearby ink runs
   *  + 1-2px boundary fragments. A smooth contour scores 0. */
  tornEdge: number;
  /** Hard alpha jumps (|Δ| >= 32) between two body-interior ink pixels,
   *  plus fully-enclosed empty pixels (holes: 8/8 ink neighbours). */
  bodyHardJumps: number;
  /** High-frequency energy: sum of |4a − Σ 4-neighbours| over body-interior
   *  ink. Constant body = 0; salt-and-pepper = large. */
  bodyHfEnergy: number;
  /** CROSS-CHECK ONLY — under-counts torn edges (see metric gap). */
  isolatedPx: number;
  /** CROSS-CHECK ONLY. */
  edgeCliffs: number;
  /** CROSS-CHECK ONLY. */
  alphaMass: number;
}

export const DH1_INK_FLOOR = 4;
export const DH1_HARD_JUMP = 32;
export const DH1_TEAR_GAP_MAX = 3;
export const DH1_FRAG_MAX = 2;

/** Crop an alpha plane that was captured at canvas origin (srcX, srcY). */
export function cropAlphaPlane(
  src: ArrayLike<number>,
  srcWidth: number,
  srcHeight: number,
  srcX: number,
  srcY: number,
  crop: { x: number; y: number; width: number; height: number },
): { alpha: Uint8Array; width: number; height: number } {
  const width = Math.max(1, crop.width | 0);
  const height = Math.max(1, crop.height | 0);
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const gy = srcY + crop.y + y;
    if (gy < 0 || gy >= srcHeight) continue;
    for (let x = 0; x < width; x++) {
      const gx = srcX + crop.x + x;
      if (gx < 0 || gx >= srcWidth) continue;
      out[y * width + x] = src[gy * srcWidth + gx];
    }
  }
  return { alpha: out, width, height };
}

/** wet.alpha (0-200000 deposit density) -> 0-255 plane, shape-preserving
 *  (one raster-245 layer deposits 2450 -> 208; no saturation). */
export function wetAlphaToPlane(wetAlpha: ArrayLike<number>): Uint8Array {
  const out = new Uint8Array(wetAlpha.length);
  for (let i = 0; i < wetAlpha.length; i++) {
    const v = Math.round((wetAlpha[i] / 3000) * 255);
    out[i] = v < 0 ? 0 : v > 255 ? 255 : v;
  }
  return out;
}

export function computeDefectMetrics(
  alpha: ArrayLike<number>,
  width: number,
  height: number,
): Dh1DefectMetrics {
  const at = (x: number, y: number): number => alpha[y * width + x];
  const ink = (x: number, y: number): boolean => at(x, y) >= DH1_INK_FLOOR;

  let tornEdge = 0;
  let bodyHardJumps = 0;
  let bodyHfEnergy = 0;
  let isolatedPx = 0;
  let edgeCliffs = 0;
  let alphaMass = 0;

  // --- scanline tear detector: gaps of 1-3px between nearby ink runs + crumbs
  const scanAxis = (horizontal: boolean): void => {
    const outer = horizontal ? height : width;
    const inner = horizontal ? width : height;
    for (let o = 0; o < outer; o++) {
      const runs: Array<{ start: number; end: number }> = [];
      let i = 0;
      while (i < inner) {
        const is = horizontal ? ink(i, o) : ink(o, i);
        if (!is) {
          i++;
          continue;
        }
        let end = i;
        while (end + 1 < inner) {
          const next = horizontal ? ink(end + 1, o) : ink(o, end + 1);
          if (!next) break;
          end++;
        }
        runs.push({ start: i, end });
        i = end + 1;
      }
      for (let r = 0; r < runs.length; r++) {
        const run = runs[r];
        const runLen = run.end - run.start + 1;
        if (runLen <= DH1_FRAG_MAX) {
          // Boundary crumb only — an interior 2px run in a solid body cannot
          // exist (the run would merge), so any short run is contour debris.
          tornEdge++;
        }
        if (r + 1 < runs.length) {
          const gap = runs[r + 1].start - run.end - 1;
          if (gap >= 1 && gap <= DH1_TEAR_GAP_MAX) tornEdge++;
        }
      }
    }
  };
  scanAxis(true);
  scanAxis(false);

  // --- per-pixel pass: mass, isolated, cliffs, body interior
  const isInterior = (x: number, y: number): boolean => {
    if (x < 1 || y < 1 || x >= width - 1 || y >= height - 1) return false;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!ink(x + dx, y + dy)) return false;
      }
    }
    return true;
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = at(x, y);
      if (a === 0) {
        // Fully-enclosed hole = body defect the torn-edge scan cannot see.
        // (A 1px notch in a contour has < 8 ink neighbours and belongs to
        // tornEdge, not here.)
        if (x < 1 || y < 1 || x >= width - 1 || y >= height - 1) continue;
        let inkN = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            if (ink(x + dx, y + dy)) inkN++;
          }
        }
        if (inkN === 8) bodyHardJumps++;
        continue;
      }
      alphaMass += a;
      if (a >= DH1_INK_FLOOR) {
        const half = a / 2;
        let hasPeer = false;
        for (let dy = -1; dy <= 1 && !hasPeer; dy++) {
          const ny = y + dy;
          if (ny < 0 || ny >= height) continue;
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx;
            if (nx < 0 || nx >= width) continue;
            if (at(nx, ny) >= half) {
              hasPeer = true;
              break;
            }
          }
        }
        if (!hasPeer) isolatedPx++;
      }
      if (x + 1 < width) {
        const b = at(x + 1, y);
        if ((a >= 32 && b <= 4) || (b >= 32 && a <= 4)) edgeCliffs++;
      }
      if (y + 1 < height) {
        const b = at(x, y + 1);
        if ((a >= 32 && b <= 4) || (b >= 32 && a <= 4)) edgeCliffs++;
      }

      if (isInterior(x, y)) {
        const up = at(x, y - 1);
        const down = at(x, y + 1);
        const left = at(x - 1, y);
        const right = at(x + 1, y);
        bodyHfEnergy += Math.abs(4 * a - (up + down + left + right));
        if (Math.abs(a - right) >= DH1_HARD_JUMP) bodyHardJumps++;
        if (Math.abs(a - down) >= DH1_HARD_JUMP) bodyHardJumps++;
      }
    }
  }

  return {
    tornEdge,
    bodyHardJumps,
    bodyHfEnergy,
    isolatedPx,
    edgeCliffs,
    alphaMass,
  };
}

// ---------------------------------------------------------------------------
// Manifest shape (parity between the RED and GREEN runs is judged on these)
// ---------------------------------------------------------------------------

export interface Dh1PointerSample {
  x: number;
  y: number;
  timeStamp: number;
  pressure: number;
}

export type Dh1VariantName = 'light-slow' | 'heavy-slow' | 'heavy-fast';

export interface Dh1VariantSpec {
  name: Dh1VariantName;
  pressure: number;
  dtMs: number;
  lane: number;
  /** Verbatim content spec — identical between the RED and GREEN runs. */
  points: Dh1PointerSample[];
}

export interface Dh1ContentSpec {
  basePolyline: ReadonlyArray<readonly [number, number]>;
  sampleStepPx: number;
  laneY: readonly number[];
  ySpread: number;
  variants: Dh1VariantSpec[];
}

export interface Dh1LaneMasses {
  lightSlow: number;
  heavySlow: number;
  heavyFast: number;
}

export interface Dh1ManifestRow {
  name: string;
  isolatedPx: number;
  edgeCliffs: number;
  alphaMass: number;
  tornEdge: number;
  bodyHardJumps: number;
  bodyHfEnergy: number;
  lanes: Dh1LaneMasses;
  pngPath: string | null;
}

export type Dh1SeamName = 'post-raster' | 'post-gate' | 'post-dry' | 'post-display';

export const DH1_SEAM_ORDER: readonly Dh1SeamName[] = [
  'post-raster',
  'post-gate',
  'post-dry',
  'post-display',
];

export interface Dh1SeamDump {
  tag: string;
  seam: Dh1SeamName;
  x: number;
  y: number;
  width: number;
  height: number;
  metrics: Dh1DefectMetrics;
  pngPath: string | null;
}

export interface Dh1Manifest {
  runLabel: Dh1RunLabel;
  capturedAt: string;
  lcgSeed: number;
  zoom: number;
  canvas: { width: number; height: number };
  clearedAtStart: boolean;
  brushSpec: Record<string, number>;
  paper: { offKey: string; onKey: string | null; paperHeightActive: boolean };
  contentSpec: Dh1ContentSpec;
  rows: Dh1ManifestRow[];
  seams: Dh1SeamDump[];
}

export const DH1_MANIFEST_ROW_KEYS = [
  'name',
  'isolatedPx',
  'edgeCliffs',
  'alphaMass',
  'tornEdge',
  'bodyHardJumps',
  'bodyHfEnergy',
  'lanes',
  'pngPath',
] as const;

export const DH1_SEAM_KEYS = [
  'tag',
  'seam',
  'x',
  'y',
  'width',
  'height',
  'metrics',
  'pngPath',
] as const;

export const DH1_DEFECT_METRIC_KEYS = [
  'tornEdge',
  'bodyHardJumps',
  'bodyHfEnergy',
  'isolatedPx',
  'edgeCliffs',
  'alphaMass',
] as const;

export const DH1_MANIFEST_KEYS = [
  'runLabel',
  'capturedAt',
  'lcgSeed',
  'zoom',
  'canvas',
  'clearedAtStart',
  'brushSpec',
  'paper',
  'contentSpec',
  'rows',
  'seams',
] as const;

export function buildDh1Manifest(fields: {
  runLabel: Dh1RunLabel;
  capturedAt: string;
  lcgSeed: number;
  zoom: number;
  canvas: { width: number; height: number };
  clearedAtStart: boolean;
  brushSpec: Record<string, number>;
  paper: { offKey: string; onKey: string | null; paperHeightActive: boolean };
  contentSpec: Dh1ContentSpec;
  rows: Dh1ManifestRow[];
  seams: Dh1SeamDump[];
}): Dh1Manifest {
  return { ...fields };
}

// ---------------------------------------------------------------------------
// Engine internals (private seams the DEV harness drives directly)
// ---------------------------------------------------------------------------

interface EngineInternals {
  width: number;
  height: number;
  state: {
    brushOpts: {
      size: number;
      opacity: number;
      pressure: number;
      waterAmount: number;
      dryAmount: number;
      edgeDetail: number;
      pickup: number;
      eraseStrength: number;
      antiAlias: number;
    };
    physicsRunning?: boolean;
  };
  currentPaperKey: string;
  paperHeight: Float32Array | null;
  wet: { alpha: Float32Array };
  dualCanvas: {
    dryCtx: CanvasRenderingContext2D;
    dryCanvas: HTMLCanvasElement;
  };
  performanceListener?: ((sample: { stage: string }) => void) | null;
  setPerformanceListener(listener: ((sample: { stage: string }) => void) | null): void;
  getCanvas(): HTMLCanvasElement;
  copyLiveAlphaCanvas(): HTMLCanvasElement;
  flushPendingStrokeFinalizations(): void;
  clear(preserveDry?: boolean): void;
  setTool(tool: 'paint' | 'erase' | 'select'): void;
  setColorHex(hex: string): void;
  setBrushSize(size: number): void;
  setBrushOpacity(opacity: number): void;
  setBrushPressure(pressure: number): void;
  setWaterAmount(amount: number): void;
  setEdgeDetail(detail: number): void;
  setAntiAlias(value: number): void;
  setPickup(pickup: number): void;
  setDrySpeed(speed: number): void;
  setPhysicsStrength(strength: number): void;
  setPaperGrain(key: string): void;
  startPhysics(mode: 'local' | 'last' | 'all'): void;
  stopPhysics(): void;
  onPointerDown(e: PointerEvent): void;
  onPointerMove(e: PointerEvent): void;
  onPointerUp(e: PointerEvent): void;
}

function asInternals(engine: EfxPaintEngine): EngineInternals {
  return engine as unknown as EngineInternals;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// ---------------------------------------------------------------------------
// Scripted stroke matrix
// ---------------------------------------------------------------------------

function buildLaneSamples(
  width: number,
  height: number,
  lane: number,
  pressure: number,
  dtMs: number,
): Dh1PointerSample[] {
  const centerY = LANE_Y[lane] * height;
  const abs = BASE_POLYLINE.map(([nx, ny]) => ({
    x: nx * width,
    y: centerY + (ny - 0.5) * Y_SPREAD * height,
  }));

  // Constant-step walk along the polyline by arc length (arc length, not
  // point index — the locked determinism coordinate for the Task 2 seeds).
  const samples: Dh1PointerSample[] = [];
  let timeStamp = TIME_BASE;
  let carry = 0;
  let previous = abs[0];
  samples.push({ x: previous.x, y: previous.y, timeStamp, pressure });

  for (let i = 1; i < abs.length; i++) {
    const next = abs[i];
    const segX = next.x - previous.x;
    const segY = next.y - previous.y;
    const segLen = Math.hypot(segX, segY);
    if (segLen === 0) {
      previous = next;
      continue;
    }
    let travelled = SAMPLE_STEP_PX - carry;
    while (travelled <= segLen) {
      const ratio = travelled / segLen;
      timeStamp += dtMs;
      samples.push({
        x: previous.x + segX * ratio,
        y: previous.y + segY * ratio,
        timeStamp,
        pressure,
      });
      travelled += SAMPLE_STEP_PX;
    }
    carry = segLen - (travelled - SAMPLE_STEP_PX);
    previous = next;
  }

  // Final point at the polyline end (round-trips through the engine's 1.5px
  // distance filter because the previous sample is a full step behind it —
  // except for degenerate tiny canvases, where the engine just drops it).
  const last = abs[abs.length - 1];
  const lastSample = samples[samples.length - 1];
  if (Math.hypot(last.x - lastSample.x, last.y - lastSample.y) >= 1.5) {
    timeStamp += dtMs;
    samples.push({ x: last.x, y: last.y, timeStamp, pressure });
  }

  return samples;
}

function buildContentSpec(width: number, height: number): Dh1ContentSpec {
  const slowDt = SAMPLE_STEP_PX / SLOW_PX_PER_MS;
  const fastDt = SAMPLE_STEP_PX / FAST_PX_PER_MS;
  return {
    basePolyline: BASE_POLYLINE,
    sampleStepPx: SAMPLE_STEP_PX,
    laneY: LANE_Y,
    ySpread: Y_SPREAD,
    variants: [
      { name: 'light-slow', pressure: 0.2, dtMs: slowDt, lane: 0, points: buildLaneSamples(width, height, 0, 0.2, slowDt) },
      { name: 'heavy-slow', pressure: 0.9, dtMs: slowDt, lane: 1, points: buildLaneSamples(width, height, 1, 0.9, slowDt) },
      { name: 'heavy-fast', pressure: 0.9, dtMs: fastDt, lane: 2, points: buildLaneSamples(width, height, 2, 0.9, fastDt) },
    ],
  };
}

function makePointerEvent(sample: Dh1PointerSample, canvas: HTMLCanvasElement, buttons: number): PointerEvent {
  const rect = canvas.getBoundingClientRect();
  const clientX = rect.left + (sample.x / canvas.width) * rect.width;
  const clientY = rect.top + (sample.y / canvas.height) * rect.height;
  return {
    clientX,
    clientY,
    timeStamp: sample.timeStamp,
    pressure: sample.pressure,
    tiltX: 0,
    tiltY: 0,
    twist: 0,
    buttons,
    pointerType: 'pen',
    pointerId: 1,
    preventDefault: () => {},
    getCoalescedEvents: () => [],
  } as unknown as PointerEvent;
}

function drawScriptedStroke(eng: EngineInternals, canvas: HTMLCanvasElement, samples: Dh1PointerSample[]): void {
  eng.onPointerDown(makePointerEvent(samples[0], canvas, 1));
  for (let i = 1; i < samples.length; i++) {
    eng.onPointerMove(makePointerEvent(samples[i], canvas, 1));
  }
  eng.onPointerUp(makePointerEvent(samples[samples.length - 1], canvas, 0));
}

/** One Apply-physics click = one button press (usePhysicsPaintEngineActions
 *  semantics: press -> startPhysics, release -> stopPhysics which force-dries).
 *  The hold gives the 60fps physics interval real ticks before the release. */
async function applyPhysicsClick(eng: EngineInternals): Promise<void> {
  eng.startPhysics('all');
  await sleep(PHYSICS_HOLD_MS);
  eng.stopPhysics();
  eng.flushPendingStrokeFinalizations();
  await sleep(SETTLE_AFTER_CLICK_MS);
}

function laneRegions(width: number, height: number): Array<{ x0: number; y0: number; x1: number; y1: number }> {
  return LANE_Y.map((cy) => {
    const center = cy * height;
    return {
      x0: 0,
      y0: center - LANE_HALF * height,
      x1: width,
      y1: center + LANE_HALF * height,
    };
  });
}

async function snapshotRow(
  eng: EngineInternals,
  pngDir: string,
  name: string,
  regions: Array<{ x0: number; y0: number; x1: number; y1: number }>,
): Promise<Dh1ManifestRow> {
  eng.flushPendingStrokeFinalizations();
  const source = eng.copyLiveAlphaCanvas();
  const width = source.width;
  const height = source.height;
  const ctx = source.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('dh1 capture: snapshot canvas has no 2d context');
  const image = ctx.getImageData(0, 0, width, height);
  const alpha = alphaFromRgba(image.data);
  const metrics = computeDefectMetrics(alpha, width, height);
  const lanes = {
    lightSlow: computeRegionAlphaMass(alpha, width, height, regions[0]),
    heavySlow: computeRegionAlphaMass(alpha, width, height, regions[1]),
    heavyFast: computeRegionAlphaMass(alpha, width, height, regions[2]),
  };
  const pngPath = await writeZoomPng(source, pngDir, name);
  return {
    name,
    isolatedPx: metrics.isolatedPx,
    edgeCliffs: metrics.edgeCliffs,
    alphaMass: metrics.alphaMass,
    tornEdge: metrics.tornEdge,
    bodyHardJumps: metrics.bodyHardJumps,
    bodyHfEnergy: metrics.bodyHfEnergy,
    lanes,
    pngPath,
  };
}

/** ZOOM-4 nearest-neighbour snapshot over white (paint is alpha-only, so a
 *  white base is what makes the isolated blocks judgeable in an image viewer).
 *  Visual artifact only — every metric comes from the source alpha plane. */
async function writeZoomPng(source: HTMLCanvasElement, pngDir: string, name: string): Promise<string | null> {
  try {
    const out = document.createElement('canvas');
    out.width = source.width * DH1_CAPTURE_ZOOM;
    out.height = source.height * DH1_CAPTURE_ZOOM;
    const ctx = out.getContext('2d');
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(source, 0, 0, out.width, out.height);
    const bytes = canvasToPngBytes(out);
    if (!bytes) return null;
    const result = await exportWritePng(pngDir, `${name}.png`, Array.from(bytes));
    if (!result.ok) {
      console.warn('[dh1] PNG write failed', name, result.error);
      return null;
    }
    return `${pngDir}/${name}.png`;
  } catch (error) {
    console.warn('[dh1] PNG write failed', name, error);
    return null;
  }
}

async function writeManifest(manifest: Dh1Manifest, runLabel: Dh1RunLabel): Promise<string | null> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const path = await invoke<string>('write_debug_capture', {
      contents: JSON.stringify(manifest),
      name: `dh1-${runLabel}`,
    });
    console.log(`[dh1] manifest written to ${path}`);
    return path;
  } catch (error) {
    console.warn('[dh1] manifest write failed', error);
    return null;
  }
}

/** Paper-height keys the engine may have loaded — first that resolves to a
 *  real height map wins; recorded in the manifest either way. */
const PAPER_KEY_CANDIDATES = ['canvas1', 'canvas2', 'canvas3'] as const;

function enablePaperHeight(eng: EngineInternals): { key: string | null; active: boolean } {
  for (const key of PAPER_KEY_CANDIDATES) {
    eng.setPaperGrain(key);
    if (eng.paperHeight) return { key, active: true };
  }
  eng.setPaperGrain('');
  return { key: null, active: false };
}

// ---------------------------------------------------------------------------
// Four-seam probes (measurement-only, harness-local monkey patches, restored
// in `finally` — no deposit code is touched).
//
//   post-raster  the offData bytes transferToWetLayerClipped gates on
//                (offscreen getImageData(0,0,w,h); origin from oc.translate)
//   post-gate    wet.alpha after the transfer pixel loop
//                (fires on the `paint-transfer-pixel-loop` observer, which
//                measurePrimitive invokes AFTER the loop)
//   post-dry     the dry-canvas ImageData of the next dry writeback
//                (forceDryAll / dryStep / prepareWetLayerForStroke)
//   post-display copyLiveAlphaCanvas (dry-minus-background + wet display)
//
// All four are cropped to the post-raster rect so the chain is comparable.
// The first seam whose tornEdge / bodyHardJumps / bodyHfEnergy lights up is
// the birthplace of the defect.
// ---------------------------------------------------------------------------

interface SeamField {
  tag: string;
  seam: Dh1SeamName;
  x: number;
  y: number;
  width: number;
  height: number;
  alpha: Uint8Array;
}

interface SeamProbeState {
  tag: string | null;
  /** True only while a stroke finalize is in flight — keeps harness-owned
   *  getImageData (copyLiveAlphaCanvas / PNG encode) from reading as post-raster. */
  expectRaster: boolean;
  fields: SeamField[];
  /** post-raster rect in canvas coords — the comparison window. */
  rectByTag: Map<string, { x: number; y: number; width: number; height: number }>;
  capturedRasterForTag: Set<string>;
  pendingPostGate: boolean;
  pendingPostDry: boolean;
}

function recordSeamField(
  state: SeamProbeState,
  seam: Dh1SeamName,
  plane: { alpha: Uint8Array; width: number; height: number },
  origin: { x: number; y: number },
): void {
  const tag = state.tag;
  if (!tag) return;
  if (seam === 'post-raster') {
    if (state.capturedRasterForTag.has(tag)) return;
    state.capturedRasterForTag.add(tag);
    state.rectByTag.set(tag, {
      x: origin.x,
      y: origin.y,
      width: plane.width,
      height: plane.height,
    });
    state.fields.push({ tag, seam, x: origin.x, y: origin.y, width: plane.width, height: plane.height, alpha: plane.alpha });
    state.pendingPostGate = true;
    state.pendingPostDry = true;
    return;
  }
  const rect = state.rectByTag.get(tag) ?? { x: origin.x, y: origin.y, width: plane.width, height: plane.height };
  const cropped = cropAlphaPlane(
    plane.alpha,
    plane.width,
    plane.height,
    origin.x,
    origin.y,
    {
      x: rect.x - origin.x,
      y: rect.y - origin.y,
      width: rect.width,
      height: rect.height,
    },
  );
  state.fields.push({
    tag,
    seam,
    x: rect.x,
    y: rect.y,
    width: cropped.width,
    height: cropped.height,
    alpha: cropped.alpha,
  });
}

function alphaFromImageData(image: ImageData): Uint8Array {
  return alphaFromRgba(image.data);
}

function installSeamProbes(eng: EngineInternals, state: SeamProbeState): () => void {
  const offscreens = new WeakSet<HTMLCanvasElement>();
  const origins = new WeakMap<HTMLCanvasElement, { x: number; y: number }>();

  const originalCreate = document.createElement.bind(document);
  const originalDryGet = eng.dualCanvas.dryCtx.getImageData.bind(eng.dualCanvas.dryCtx);
  const originalDryPut = eng.dualCanvas.dryCtx.putImageData.bind(eng.dualCanvas.dryCtx);
  const previousListener = eng.performanceListener ?? null;

  const wrappedCreate = ((tag: string, ...rest: unknown[]) => {
    const el = originalCreate(tag as keyof HTMLElementTagNameMap, ...(rest as []));
    if (tag !== 'canvas') return el;
    const canvas = el as unknown as HTMLCanvasElement;
    offscreens.add(canvas);
    origins.set(canvas, { x: 0, y: 0 });
    const originalGetContext = canvas.getContext.bind(canvas);
    canvas.getContext = ((type: string, ...args: unknown[]) => {
      const ctx = originalGetContext(type as '2d', ...(args as []));
      if (!ctx || type !== '2d') return ctx;
      const c2d = ctx as CanvasRenderingContext2D;
      const originalTranslate = c2d.translate.bind(c2d);
      const originalGet = c2d.getImageData.bind(c2d);
      c2d.translate = (tx: number, ty: number) => {
        // paint.ts: oc.translate(-bounds.x0, -bounds.y0) → canvas origin.
        origins.set(canvas, { x: -tx, y: -ty });
        return originalTranslate(tx, ty);
      };
      c2d.getImageData = (sx: number, sy: number, sw: number, sh: number) => {
        const image = originalGet(sx, sy, sw, sh);
        if (
          state.tag
          && state.expectRaster
          && offscreens.has(canvas)
          && sx === 0
          && sy === 0
          && sw === canvas.width
          && sh === canvas.height
        ) {
          const origin = origins.get(canvas) ?? { x: 0, y: 0 };
          recordSeamField(state, 'post-raster', {
            alpha: alphaFromImageData(image),
            width: sw,
            height: sh,
          }, origin);
        }
        return image;
      };
      return ctx;
    }) as typeof canvas.getContext;
    return canvas;
  }) as typeof document.createElement;
  document.createElement = wrappedCreate;

  eng.dualCanvas.dryCtx.getImageData = ((sx: number, sy: number, sw: number, sh: number) => {
    // Fallback post-gate: the first dry readback runs BEFORE forceDryAll /
    // dryStep zero wet. The primary hook is the pixel-loop observer.
    if (state.tag && state.pendingPostGate) {
      recordSeamField(state, 'post-gate', {
        alpha: wetAlphaToPlane(eng.wet.alpha),
        width: eng.width,
        height: eng.height,
      }, { x: 0, y: 0 });
      state.pendingPostGate = false;
    }
    return originalDryGet(sx, sy, sw, sh);
  }) as typeof eng.dualCanvas.dryCtx.getImageData;

  eng.dualCanvas.dryCtx.putImageData = ((image: ImageData, dx: number, dy: number, ...rest: unknown[]) => {
    if (state.tag && state.pendingPostDry) {
      recordSeamField(state, 'post-dry', {
        alpha: alphaFromImageData(image),
        width: image.width,
        height: image.height,
      }, { x: dx, y: dy });
      state.pendingPostDry = false;
    }
    return originalDryPut(image, dx, dy, ...(rest as []));
  }) as typeof eng.dualCanvas.dryCtx.putImageData;

  eng.setPerformanceListener((sample) => {
    previousListener?.(sample as Parameters<typeof previousListener>[0]);
    if (sample.stage === 'paint-transfer-pixel-loop' && state.tag && state.pendingPostGate) {
      recordSeamField(state, 'post-gate', {
        alpha: wetAlphaToPlane(eng.wet.alpha),
        width: eng.width,
        height: eng.height,
      }, { x: 0, y: 0 });
      state.pendingPostGate = false;
    }
  });

  return () => {
    document.createElement = originalCreate;
    eng.dualCanvas.dryCtx.getImageData = originalDryGet;
    eng.dualCanvas.dryCtx.putImageData = originalDryPut;
    eng.setPerformanceListener(previousListener);
  };
}

async function writeAlphaPlanePng(
  plane: { alpha: Uint8Array; width: number; height: number },
  pngDir: string,
  name: string,
): Promise<string | null> {
  try {
    const source = document.createElement('canvas');
    source.width = plane.width;
    source.height = plane.height;
    const ctx = source.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    const image = ctx.createImageData(plane.width, plane.height);
    for (let i = 0; i < plane.alpha.length; i++) {
      const o = i * 4;
      image.data[o] = 0;
      image.data[o + 1] = 0;
      image.data[o + 2] = 0;
      image.data[o + 3] = plane.alpha[i];
    }
    ctx.putImageData(image, 0, 0);
    return await writeZoomPng(source, pngDir, name);
  } catch (error) {
    console.warn('[dh1] seam PNG write failed', name, error);
    return null;
  }
}

async function flushSeamDumps(
  state: SeamProbeState,
  pngDir: string,
): Promise<Dh1SeamDump[]> {
  const dumps: Dh1SeamDump[] = [];
  for (const field of state.fields) {
    const metrics = computeDefectMetrics(field.alpha, field.width, field.height);
    const pngPath = await writeAlphaPlanePng(
      { alpha: field.alpha, width: field.width, height: field.height },
      pngDir,
      `seam-${field.tag}--${field.seam}`,
    );
    dumps.push({
      tag: field.tag,
      seam: field.seam,
      x: field.x,
      y: field.y,
      width: field.width,
      height: field.height,
      metrics,
      pngPath,
    });
  }
  return dumps;
}

function capturePostDisplay(eng: EngineInternals, state: SeamProbeState): void {
  if (!state.tag) return;
  const rect = state.rectByTag.get(state.tag);
  if (!rect) return;
  const source = eng.copyLiveAlphaCanvas();
  const ctx = source.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;
  const image = ctx.getImageData(0, 0, source.width, source.height);
  recordSeamField(state, 'post-display', {
    alpha: alphaFromImageData(image),
    width: source.width,
    height: source.height,
  }, { x: 0, y: 0 });
}

// ---------------------------------------------------------------------------
// Capture runner
// ---------------------------------------------------------------------------

export interface Dh1CaptureOptions {
  runLabel: Dh1RunLabel;
}

export async function runDepositSpeckleCapture(
  engine: EfxPaintEngine,
  options: Dh1CaptureOptions,
): Promise<Dh1Manifest> {
  const { runLabel } = options;
  const eng = asInternals(engine);
  const pngDir = `${DH1_CAPTURE_BASE_DIR}/${runLabel}`;
  try {
    await mkdir(pngDir, { recursive: true });
  } catch (error) {
    // Directory may already exist (plugin-fs scope) — exportWritePng reports
    // per-file failures into the manifest rows instead.
    console.warn('[dh1] png dir ensure failed (continuing)', error);
  }

  const canvas = eng.getCanvas();
  const width = canvas.width;
  const height = canvas.height;
  const regions = laneRegions(width, height);
  const contentSpec = buildContentSpec(width, height);
  const rows: Dh1ManifestRow[] = [];
  const seamState: SeamProbeState = {
    tag: null,
    expectRaster: false,
    fields: [],
    rectByTag: new Map(),
    capturedRasterForTag: new Set(),
    pendingPostGate: false,
    pendingPostDry: false,
  };

  const originalRandom = Math.random;
  let seed = DH1_CAPTURE_LCG_SEED;
  const previousPaperKey = eng.currentPaperKey;
  const originalPointerCapture = canvas.setPointerCapture;
  const originalReleaseCapture = canvas.releasePointerCapture;
  let brushSpec: Record<string, number> = { ...eng.state.brushOpts };
  let paperOn: { key: string | null; active: boolean } = { key: null, active: false };
  let uninstallSeamProbes: (() => void) | null = null;

  try {
    // LCG over Math.random for the run duration (grainRemoval test precedent).
    Math.random = () => {
      seed = (1664525 * seed + 1013904223) >>> 0;
      return seed / 0x100000000;
    };
    // Synthetic pointer events carry a fabricated pointerId — the real
    // setPointerCapture would throw NotFoundError for it.
    canvas.setPointerCapture = () => {};
    canvas.releasePointerCapture = () => {};
    uninstallSeamProbes = installSeamProbes(eng, seamState);

    // Normalize: stop any running physics session, force deterministic brush
    // state, paper OFF for the isolation family, and start from an empty frame
    // (clear() discards undo history — the hook contract says scratch work).
    if (eng.state.physicsRunning) eng.stopPhysics();
    eng.flushPendingStrokeFinalizations();
    brushSpec = forceDeterministicEngineState(eng);
    eng.setPaperGrain('');
    eng.clear();
    eng.flushPendingStrokeFinalizations();

    // --- Family A: paper OFF, 0/1/2/3 apply-physics clicks -----------------
    // One stroke per flush so each variant's four-seam chain is tagged.
    for (const variant of contentSpec.variants) {
      seamState.tag = variant.name;
      seamState.expectRaster = true;
      drawScriptedStroke(eng, canvas, variant.points);
      eng.flushPendingStrokeFinalizations();
      seamState.expectRaster = false;
      capturePostDisplay(eng, seamState);
      seamState.tag = null;
      await sleep(INTER_STROKE_PAUSE_MS);
    }
    eng.flushPendingStrokeFinalizations();
    await sleep(SETTLE_AFTER_STROKES_MS);
    rows.push(await snapshotRow(eng, pngDir, 'paper-off-clicks-0', regions));

    for (let click = 1; click <= 3; click++) {
      seamState.tag = `click-${click}`;
      seamState.expectRaster = false;
      await applyPhysicsClick(eng);
      capturePostDisplay(eng, seamState);
      seamState.tag = null;
      rows.push(await snapshotRow(eng, pngDir, `paper-off-clicks-${click}`, regions));
    }

    // --- Family B: paper ON, 0 clicks (paper contribution without physics) --
    paperOn = enablePaperHeight(eng);
    eng.clear();
    eng.flushPendingStrokeFinalizations();
    for (const variant of contentSpec.variants) {
      seamState.tag = `paper-on-${variant.name}`;
      seamState.expectRaster = true;
      drawScriptedStroke(eng, canvas, variant.points);
      eng.flushPendingStrokeFinalizations();
      seamState.expectRaster = false;
      capturePostDisplay(eng, seamState);
      seamState.tag = null;
      await sleep(INTER_STROKE_PAUSE_MS);
    }
    eng.flushPendingStrokeFinalizations();
    await sleep(SETTLE_AFTER_STROKES_MS);
    rows.push(await snapshotRow(eng, pngDir, 'paper-on-clicks-0', regions));
  } finally {
    uninstallSeamProbes?.();
    Math.random = originalRandom;
    canvas.setPointerCapture = originalPointerCapture;
    canvas.releasePointerCapture = originalReleaseCapture;
    eng.setPaperGrain(previousPaperKey);
  }

  const seams = await flushSeamDumps(seamState, pngDir);
  const manifest = buildDh1Manifest({
    runLabel,
    capturedAt: new Date().toISOString(),
    lcgSeed: DH1_CAPTURE_LCG_SEED,
    zoom: DH1_CAPTURE_ZOOM,
    canvas: { width, height },
    clearedAtStart: true,
    brushSpec,
    paper: { offKey: '', onKey: paperOn.key, paperHeightActive: paperOn.active },
    contentSpec,
    rows,
    seams,
  });
  await writeManifest(manifest, runLabel);
  return manifest;
}

// ---------------------------------------------------------------------------
// DEV hook installation (mirrors the __EFX_PHYSICS_PAINT_PROFILE__ precedent)
// ---------------------------------------------------------------------------

const dh1Runs = new Map<string, Promise<Dh1Manifest | null>>();

export function installDh1CaptureHook(engine: EfxPaintEngine): void {
  if (!import.meta.env.DEV || typeof window === 'undefined') return;
  // New engine session -> labels are one-shot per session again.
  dh1Runs.clear();
  Object.defineProperty(window, '__EFX_DH1_CAPTURE__', {
    configurable: true,
    value: (label: Dh1RunLabel) => {
      if (label !== 'red' && label !== 'green' && label !== 'seams') {
        return Promise.reject(new Error(`dh1 capture: unknown label ${String(label)}`));
      }
      const existing = dh1Runs.get(label);
      if (existing) return existing;
      const run = runDepositSpeckleCapture(engine, { runLabel: label }).catch((error) => {
        console.error('[dh1] capture failed', error);
        return null;
      });
      dh1Runs.set(label, run);
      return run;
    },
  });
}

declare global {
  interface Window {
    __EFX_DH1_CAPTURE__?: (label: Dh1RunLabel) => Promise<Dh1Manifest | null>;
  }
}
