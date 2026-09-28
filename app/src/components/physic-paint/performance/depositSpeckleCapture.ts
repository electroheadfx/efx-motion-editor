/**
 * Quick 260928-dh1 — DEV deposit speckle capture harness (RED/GREEN matrix).
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
 * - Measure-first (plan law): the RED manifest MUST exist at
 *   /tmp/efx-stall-capture-dh1-red.json BEFORE the first deposit-path edit.
 *
 * RUN (user-side — Claude never launches the dev server, CLAUDE.md):
 *   window.__EFX_DH1_CAPTURE__('red')    // before the fix (RED baseline)
 *   window.__EFX_DH1_CAPTURE__('green')  // after the fix (GREEN acceptance)
 *
 * Each label is one-shot per engine session (a second call returns the cached
 * promise). The capture CLEARS the current frame's paint first (engine.clear()
 * discards undo history) — run it on scratch work.
 *
 * OUTPUT: /tmp/efx-stall-capture-dh1-{label}.json (manifest via the Tauri
 * write_debug_capture command) + /tmp/efx-dh1/{label}/*.png (ZOOM-4 snapshots
 * written via exportWritePng, nearest-neighbour so isolated pixels judge as
 * 4x4 blocks).
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

export type Dh1RunLabel = 'red' | 'green';

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
  lanes: Dh1LaneMasses;
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
}

export const DH1_MANIFEST_ROW_KEYS = [
  'name',
  'isolatedPx',
  'edgeCliffs',
  'alphaMass',
  'lanes',
  'pngPath',
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
  const metrics = computeSpeckleMetrics(alpha, width, height);
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
    await exportWritePng(pngDir, `${name}.png`, Array.from(bytes));
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

  const originalRandom = Math.random;
  let seed = DH1_CAPTURE_LCG_SEED;
  const previousPaperKey = eng.currentPaperKey;
  const originalPointerCapture = canvas.setPointerCapture;
  const originalReleaseCapture = canvas.releasePointerCapture;
  let brushSpec: Record<string, number> = { ...eng.state.brushOpts };
  let paperOn: { key: string | null; active: boolean } = { key: null, active: false };

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
    for (const variant of contentSpec.variants) {
      drawScriptedStroke(eng, canvas, variant.points);
      await sleep(INTER_STROKE_PAUSE_MS);
    }
    eng.flushPendingStrokeFinalizations();
    await sleep(SETTLE_AFTER_STROKES_MS);
    rows.push(await snapshotRow(eng, pngDir, 'paper-off-clicks-0', regions));

    for (let click = 1; click <= 3; click++) {
      await applyPhysicsClick(eng);
      rows.push(await snapshotRow(eng, pngDir, `paper-off-clicks-${click}`, regions));
    }

    // --- Family B: paper ON, 0 clicks (paper contribution without physics) --
    paperOn = enablePaperHeight(eng);
    eng.clear();
    eng.flushPendingStrokeFinalizations();
    for (const variant of contentSpec.variants) {
      drawScriptedStroke(eng, canvas, variant.points);
      await sleep(INTER_STROKE_PAUSE_MS);
    }
    eng.flushPendingStrokeFinalizations();
    await sleep(SETTLE_AFTER_STROKES_MS);
    rows.push(await snapshotRow(eng, pngDir, 'paper-on-clicks-0', regions));
  } finally {
    Math.random = originalRandom;
    canvas.setPointerCapture = originalPointerCapture;
    canvas.releasePointerCapture = originalReleaseCapture;
    eng.setPaperGrain(previousPaperKey);
  }

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
      if (label !== 'red' && label !== 'green') {
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
