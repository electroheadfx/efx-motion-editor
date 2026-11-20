import { BRUSH_PRESETS, brushTipCacheKey, buildBrush, isBristleResponse, tipRowsForUpload, type Brush } from './brushes';
import {
  BRISTLE_CAP,
  BRISTLE_CAP_GAIN,
  BRISTLE_DRY_CAP_FLOOR,
  BRISTLE_DRY_CAP_FULL,
  BRISTLE_DRY_EDGE,
  BRISTLE_FEATHER_CAP,
  BRISTLE_FEATHER_EDGE,
  BRISTLE_FEATHER_MIN,
  BRISTLE_FEATHER_REACH,
  BRISTLE_FILM_BLUR,
  BRISTLE_GRAIN,
  BRISTLE_HAIRS,
  BRISTLE_LANDING,
  BRISTLE_RIM_CONTACT,
  BRISTLE_SMEAR_CAP,
  BRISTLE_SMEAR_PERIOD_PX,
  BRISTLE_STREAK,
  BRISTLE_STREAK_LENGTH,
  BRISTLE_STREAK_SHARE,
  bristleContactPressure,
  bristleCount,
  bristleSampleScale,
  gatherSoftness,
  LAST_TOUCH_DRY_SECONDS,
  makeBristles,
} from './bristles';
import { f32ToF16, fromHalf } from './half';
import { engineScaleToSize } from './params';
import { GL, type DoubleTarget, type Format, type Program, type Rect, type Target } from './gl';
import { History, type StepInfo, type StepKind } from './history';
import { DEFAULT_PAPER, linearRGB, PAPERS, type PaperPreset } from './papers';
import * as S from './shaders';
import { COEFFS, pigmentFromHex, type Pigment } from './spectral';
// 61-04: the published width-factor range lives in the pure spine module —
// one authority for the bound, shared by the profile law and this channel.
import { ANCHOR_WIDTH_MAX, ANCHOR_WIDTH_MIN } from '../vector/spine';
import { WET_THRESHOLD, isSheetWet } from './wetState';
// Phase 64 (D-14): the ONE perceptual Body curve, shared by the cover pass
// here and the scattering deposit — never a second inline curve.
import { bodyCurve, scatteringDeposit } from './scattering';

export type Tool = 'brush' | 'water' | 'pen' | 'lift';

/**
 * Phase 64 (v2.2.0) — the Viscosity law, recorded once here and applied at
 * exactly two sites inside `step()`:
 *
 *   VISCOSITY_DISSIPATION_GAIN = 12.0
 *     dissipation = exp(-dt * (3.0 - flow * 2.4 + viscosity * 12.0))
 *     The gain is ADDITIVE inside the exponent: viscosity can only raise the
 *     decay rate, never lower the pre-milestone floor, and never stands in
 *     for `flow` (which still drives deposition).
 *
 *   VISCOSITY_SPREAD_FLOOR = 0.012
 *     spread = 0.12 * (1 - viscosity * 0.9)   → 0.12 at 0, 0.012 at 1
 *     The diffusion floor is scaled, never crossed: a bounded 0..1 value can
 *     never make it negative.
 *
 * `viscosity` is 0..1, normalised by params.ts (the ONE canonical mapping);
 * 0 is neutral, so a project painted before the key existed renders
 * byte-identically. The value is consumed only while stepping fluid — never
 * in a settle or display pass — so a later change cannot re-process
 * already-settled pigment.
 */

/**
 * Phase 64 (v2.2.0) — paint thickness (`relief`):
 *
 * One document-resolution HALF_FLOAT_R target beside `wet` holds how thick the
 * paint lies on the sheet. Each brush dab deposits its own tip footprint scaled
 * by that dab's ink amount times the stroke's `emboss` (MED-14, the deposit law),
 * Lift erodes thickness with the same footprint and the same amount it erodes
 * pigment with, and the cover pass of spec 06 will draw at the same per-dab seam.
 * Thickness never flows: no advect, settle, dry, bleed or fill pass reads or
 * writes this target.
 *
 * Engine-internal state: thickness is rebuilt from the stroke script on replay
 * and is NEVER persisted — do not add a field for it to any project format, any
 * app persistence module or any Rust model.
 *
 * Undo carries it positionally in pool 0: allocateHistory()'s format list,
 * snapshotLayers() and travel()'s layer map list the thickness view as the same
 * entry. Edit all three together; if they disagree the atlas copy writes one
 * layer into another layer's target.
 *
 * 64-24 (D-24) adds the last-touch pair to the same lists as the fifth entry
 * (between the thickness and the coverage, so coverage stays last), and the
 * whole-document carry (captureWhole / uploadWhole / resizeDocument) carries it
 * as EXACT floats — `WholeDoc.layers` is a Uint16Array | Float32Array union.
 */

/** All sliders are normalised 0..1 — except `wetSeconds`, which is SECONDS. */
export interface Params {
  size: number;
  water: number;       // how much water the brush carries
  load: number;        // pigment concentration on the brush
  flow: number;        // strength of the water's motion
  bleed: number;       // diffusion of pigment through wet paper
  dry: number;         // drying speed
  edge: number;        // tide-line darkening at drying edges
  granulation: number; // pigment settling into the paper grain
  lift: number;        // Lift per-dab erase amount (0..0.9)
  viscosity: number;   // Phase 64: medium thickness — raises dissipation, lowers spread (0..1)
  body: number;        // Phase 64: cover strength — declared here, consumed by its own plan (0..1)
  emboss: number;      // Phase 64: relief lighting — declared here, consumed by its own plan (0..1)
  feather: number;     // 64-22: gather coverage-band width — widens §4.4 softness on a bristle response (0..1)
  pickup: number;      // 64-22: §3.1 carrier pickup rate — how much sheet paint a bristle lifts (0..1)
  refill: number;      // 64-22: §3.1 carrier refill rate — how fast a bristle refills from the load (0..1)
  wetSeconds: number;  // 64-22: last-touch wetness lifetime in SECONDS (>= 1) — declared here so the ONE mapping has one destination; consumed by 64-24
}

export const DEFAULT_PARAMS: Params = {
  size: 0.5, water: 0.6, load: 0.5, flow: 0.45, bleed: 0.5, dry: 0.4, edge: 0.5, granulation: 0.45,
  lift: 0.22,
  viscosity: 0,
  body: 0,
  emboss: 0,
  feather: 0,
  // 261119-pod (D-A): the reference's §6 `mixing.pickup` default — 100
  // canonical, 1.0 here. ONE knob feeds the §3.1 carrier pickup (clamped
  // 0.75) and the §3.3 deposit smear (capped 0.8).
  pickup: 1.0,
  refill: 0.6,
  wetSeconds: 7,
};

/**
 * Phase 64 (MED-15) — emboss light state. Angles are DEGREES; the engine
 * converts them once at the drawDisplay boundary. Render-only: the light never
 * enters a stroke payload, a params snapshot or the painted pixels (D-08).
 */
export interface LightSettings { azimuth: number; elevation: number; intensity: number }

/**
 * The shipped light reconstructs the unit vector `paperLightFS` lights the
 * paper with — normalize(vec3(-0.5, 0.6, 0.62)) — within a rounding tolerance,
 * at full intensity (D-09), so a heavy medium reads raised the moment it is
 * picked: elevation 38.45 lifts it, azimuth 129.8 puts it upper-left.
 */
export const DEFAULT_LIGHT: LightSettings = { azimuth: 129.8, elevation: 38.45, intensity: 1 };

export interface EngineCallbacks {
  /** The undo history changed: every step (oldest first) and how many of them are applied. */
  onHistoryChange?(steps: StepInfo[], index: number): void;
  /** Paper or reference state changed from inside the engine (undo, redo, a project opened). */
  onDocumentChange?(state: DocState): void;
  /** The active tool changed for the current stroke (pencil barrel / finger-as-water). */
  onStrokeTool?(tool: Tool | null): void;
  /** The view was zoomed or panned (`zoom` 1 = one document texel per CSS pixel). */
  onViewChange?(zoom: number, docSize: [number, number]): void;
  /** Studio record seam: one pointer sample entered the stroke (doc uv, y up). */
  onStrokeSample?(sample: { x: number; y: number; p: number; tx: number; ty: number; t: number }): void;
  /** Studio record seam: the pointer stroke ended. */
  onStrokeEnd?(tool: Tool): void;
  /**
   * 261028-k03b: one applied Lift dab (doc uv y up, radius in document
   * heights, amount = the effective per-dab erase). The Studio previews it on
   * the cached base so a lift on a cooked frame erases while the user draws.
   * 261028-k03c: `angle` is the tip angle in radians (y up — the same value
   * `brushAngle` resolved and the shader bound as uAxis), so the cached-base
   * preview can reproduce the erased shape.
   */
  onLiftDab?(x: number, y: number, r: number, amount: number, angle: number): void;
}

export type ExportFormat = 'png' | 'jpeg' | 'webp';
/**
 * `pigment` (SPIKE 001) is the coverage-aware COMPOSITOR view: straight-alpha
 * pigment whose alpha is max(1 - min(rgb), coverage), so a covering stroke
 * carries real opacity. The established `transparent` stays the OPAQUE
 * transmittance the cache stores and composites with multiply.
 */
export type ExportBackground = 'transparent' | 'paper' | 'white' | 'pigment';
/** `texture` false exports the paper (or white) as a flat sheet; true uses the on-screen texture strength. */
export interface ExportOptions { format: ExportFormat; background: ExportBackground; quality?: number; texture?: boolean }

/** Placement of the reference image in document uv (y up): origin and size. */
export interface RefRect { x: number; y: number; w: number; h: number }

export type LayerId = 'inkA' | 'inkB' | 'fixedA' | 'fixedB' | 'wet' | 'relief' | 'cover' | 'lastTouch';

/**
 * The paint layers as half floats (RGBA for ink and fixed, one channel for wet), cropped
 * to `rect`, the texel rect holding everything ever painted (null: a blank sheet).
 * 64-24: `lastTouch` is EXACT float32 — the cleared sentinel is one week old, which a
 * half-float round-trip would clamp at 65504 and every restored sheet would read as
 * touched — so the record's value type is the union.
 */
export interface WholeDoc { w: number; h: number; rect: Rect | null; layers: Record<LayerId, Uint16Array | Float32Array> }

/** Document-level state that undo tracks besides the paint. */
export interface DocState {
  paperId: string;
  paperStrength: number;
  reference: { image: HTMLCanvasElement | null; rect: RefRect; opacity: number; visible: boolean };
}

/** Everything needed to bring a painting back exactly as it is. */
export interface DocumentSnapshot {
  whole: WholeDoc;
  paper: { id: string; seed: number; origin: [number, number]; scale: number; strength: number };
  wet: { wetAgo: number; wetPeak: number; active: Rect | null; painted: Rect | null };
  reference: DocState['reference'];
  view: { zoom: number; pan: [number, number]; fitted: boolean };
}

/** How the display shader composites: on screen (with the reference) or for an export. */
// `transparent` is the OPAQUE transmittance export/capture (storage format);
// `pigment` is the compositor DISPLAY mode (straight-alpha pigment, round 2).
const MODE = { screen: 0, paper: 1, transparent: 2, white: 3, pigment: 4 } as const;
const MAX_REF_SIDE = 4096;
// Phase 64: the emboss gradient is one document texel wide with this fixed
// bump scale — a document-space constant, never a function of zoom (D-13).
const RELIEF_BUMP = 1.0;
// Phase 64 post-delivery tuning (UAT): Body must read as a true cover and the
// emboss as a relief the user can see, without touching the delivered colours.
// Three separate multipliers, never a change to the shared curve:
//   COVER_GAIN     lifts the ORDER pass only; the scattering deposit keeps the
//                  un-gained curve, so the delivered colour reconstruction is
//                  bit-for-bit unchanged.
//   RELIEF_GAIN    deepens the thickness a dab deposits.
//   RELIEF_ERODE   the share of that thickness the stronger cover erodes: at
//                  the full cover amount a stroke would erase its own previous
//                  dabs' relief, flattening the emboss it is meant to raise.
//
// Post-UAT (2026-11-17): the emboss follows the stylus. A light touch lays a
// thin film and a hard press the delivered depth; displayFS's gain is lowered
// from 3.0 to 2.3, so even a full press stays under the earlier, too-strong
// look, and existing relief bytes need no repaint.
const COVER_GAIN = 2;
// SPIKE 001: the coverage term's per-dab medium optical density. Coverage is a
// property of the PAINT FILM (Body x the dab's paint volume), never of the
// pigment's absorbance — rev-4 derived it from the pigment, so a near-white
// pigment (layer alpha ~0.06) could never cover. With this constant a
// full-pressure dab at Body 100 covers `1 - exp(-8 * amount)` of the underlayer
// per dab (amount ~0.08 -> ~0.48), and overlapping dabs compose to the union.
const COVER_MEDIUM_DENSITY = 8;
const RELIEF_GAIN = 1.5;
const RELIEF_ERODE = 0.5;
/** The emboss thickness a feather touch still lays, as a share of full press. */
const EMBOSS_PRESS_FLOOR = 0.15;
/**
 * Post-UAT (GAP-1, 2026-11-19): on the BRISTLE path Body is the paint's
 * OPACITY — the share of the pixel the deposited film takes over — not a
 * separate erode mask. It scales the coverage target the deposit lerps
 * toward, so Body 100 reaches a fully opaque film and Body 0 leaves a
 * half-opaque glaze. The floor is not zero because Body is absent (canonical
 * 0) on every recorded pre-64 stroke and in the committed Body-0 gates: a
 * bristle stroke must still deposit its paint there. The sixth-power
 * `bodyCurve` stays the non-bristle order curve (D-14), untouched.
 */
const BRISTLE_BODY_ALPHA_FLOOR = 0.5;

// 61-04: `w` is the per-sample width factor (VEC-03). It rides the queued
// sample — never a mutable engine field — so a sample can only ever be
// stamped at its own width, even when the queue drains late. 1 = today's
// footprint, so a stroke with no width profile is byte-identical.
// 261111-wd6: `pig` is the per-sample pigment (per-vertex colour). Absent
// means the stroke's base pigment stays authoritative — today's exact
// deposit — and it rides the same queued-sample law as `w`.
interface Sample { x: number; y: number; p: number; t: number; tx: number; ty: number; w: number; pig?: Pigment }

interface Stroke {
  pointerId: number;
  pointerType: string;
  tool: Tool;
  started: boolean;
  ending: boolean;
  x: number; y: number;       // where the drawn stroke currently ends (uv)
  cx: number; cy: number;     // latest smoothed sample: the curve's control point, drawn up to on the next sample
  pr: number;                 // pressure at (x, y), so pressure ramps along each curve
  t: number;                 // time of last sample (ms)
  speed: number;              // doc heights / second
  simPressure: number;        // pressure stand-in for mice and fingers
  carry: number;              // distance travelled since the last stamp (doc heights)
  travelled: number;
  moved: boolean;             // received movement this frame
  dx: number; dy: number;     // smoothed direction (aspect-corrected, unit-ish)
  angle: number;              // tip angle of the last dab (radians, doc frame)
  azimuth: number | null;     // pen tilt direction, when the pen is tilted enough to tell
  // 61-04: the width factor of the sample being deposited and the one before
  // it. Dabs interpolate between the pair, so a taper has no step at the
  // sample boundary; both are 1 for a stroke without a width profile.
  widthFrom: number;
  widthTo: number;
  // 261111-wd6: the per-sample pigment pair, mirroring the width pair. Dabs
  // interpolate between them so a per-vertex colour has no step at the
  // sample boundary. Both null = the stroke paints with `this.pigment`.
  pigFrom: Pigment | null;
  pigTo: Pigment | null;
}

/** 61-04 / T-61-11: bound a scripted width factor and default a bad one. */
function scriptWidthFactor(value: number): number {
  return Number.isFinite(value) ? clamp(value, ANCHOR_WIDTH_MIN, ANCHOR_WIDTH_MAX) : 1;
}

const DEG = Math.PI / 180;
const SCRIPT_POINTER = -1;

/**
 * Scripted samples keep the live "no pen pressure" sentinel so a replayed
 * mouse/trackpad stroke derives pressure from speed like the pointer path.
 * Clamping the sentinel to the floor made every replayed dab minimum-pressure
 * (pale, thin, under-wet) — the Play-vs-paint mismatch.
 */
function scriptPressure(p: number): number {
  return p < 0 ? -1 : clamp(p, 0.02, 1);
}

interface StepMeta {
  wetAgo: number; wetPeak: number; active: Rect | null; painted: Rect | null;
  doc: DocState;
  /** Boundary (resize) steps: the whole sheet as it was, and where its paper sat. */
  whole?: WholeDoc; paperOrigin?: [number, number];
}
const STROKE_LABEL: Record<Tool, string> = { brush: 'Brush stroke', water: 'Water', pen: 'Pen', lift: 'Lift' };
/**
 * 2026-11-20 (artist): the synthetic (pressureless pointer) speed → pressure
 * map. Speed is in document heights per second and every drawing stroke is
 * several units, so the ported 0.95 slope pinned the WHOLE body to the 0.12
 * floor: with the contact law (FAST 0.42 × pen) that is below every bristle's
 * touchReach (0.27..0.9), so moving dabs printed nothing and only the still
 * start/release reached the SLOW pressure — the artist's empty body with a
 * block at each end. A mouse keeps a print-capable ~0.9 while moving; the
 * speed response rides the contact law's SLOW/FAST ramp instead.
 */
const SIM_PRESSURE_SLOPE = 0.1;
const SIM_PRESSURE_FLOOR = 0.9;
/**
 * 2026-11-20 (artist's release block): the speed EMA's time constant, in
 * 1/seconds. The ported 10/s (100 ms) resolved a normal release deceleration
 * into the SLOW contact pressure within two or three samples, and the start's
 * acceleration likewise — every stroke began and ended with a full-footprint
 * patch the body did not have (the artist's "cap", present with pen and
 * mouse). 0.6/s (~1.7 s window) makes speed a LONG-window quantity: within a
 * normal stroke the contact pressure is steady, so the mark is one consistent
 * band; only a sustained fast or slow motion moves it. Measured on the live
 * pointer path: the caps are gone and the stroke reads uniform.
 */
const SPEED_SMOOTHING = 0.6;

// WebGL2 enum values inlined so this module imports without a WebGL2
// global (tests / SSR). Values are fixed by the WebGL2 spec.
const GL_RG16F = 0x822f, GL_R16F = 0x822d, GL_RGBA16F = 0x881a, GL_RG32F = 0x8230, GL_R32F = 0x822e;
const GL_RG = 0x8227, GL_RED = 0x1903, GL_RGBA = 0x1908, GL_RGBA8 = 0x8058;
const GL_HALF_FLOAT = 0x140b, GL_UNSIGNED_BYTE = 0x1401, GL_FLOAT = 0x1406;
const HALF_FLOAT_RG: Format = { internal: GL_RG16F, format: GL_RG, type: GL_HALF_FLOAT };
const HALF_FLOAT_R: Format = { internal: GL_R16F, format: GL_RED, type: GL_HALF_FLOAT };
const HALF_FLOAT_RGBA: Format = { internal: GL_RGBA16F, format: GL_RGBA, type: GL_HALF_FLOAT };
const RGBA8: Format = { internal: GL_RGBA8, format: GL_RGBA, type: GL_UNSIGNED_BYTE };
const FLOAT_RG: Format = { internal: GL_RG32F, format: GL_RG, type: GL_FLOAT };
// 64-24 (D-24): the last-touch field is EXACT float — its cleared value is a
// one-week sentinel (−604800 s), outside half-float's 65504 range, so an R16F
// target would silently clamp it and every texel would read as freshly touched.
const FLOAT_R: Format = { internal: GL_R32F, format: GL_RED, type: GL_FLOAT };
const FILL_WATER_LEAD = 10;    // px the water runs ahead of the pigment in a bucket fill
const FILL_WIDTH = 24;         // px over which a bucket fill's front ramps up
const FILL_JITTER = 3;         // px the paper grain roughens a bucket fill's front

const SIM_BASE = 256;          // short side of the velocity / pressure grid
const PRESSURE_ITERATIONS = 20;
const SCREEN_DOC_LONG = 2048;   // a "screen" sheet follows the window, within these limits
const SCREEN_DOC_SHORT = 1536;
const MAX_DOC_LONG = 3072;     // pigment / water grid limits (live state: ~56 bytes per texel)
const MAX_DOC_PIXELS = 4_200_000;   // (plus an undo atlas of ~52 bytes per texel)
export const MIN_DOC_SIDE = 256;
export const MIN_ZOOM = 0.02;
export const MAX_ZOOM = 32;
const FIT_PADDING = 24;        // CSS px around the sheet when zoomed to fit
const PAN_KEEP = 48;           // CSS px of the sheet that always stays on screen
const FIX_DURATION = 1.2;
// 64-24 (D-24): `LAST_TOUCH_DRY_SECONDS` — the last-touch field's one-week
// cleared sentinel — is declared in `bristles.ts` with the module's other
// laws and imported above; a second declaration fails the package scan.
const MASK_BLOCK = 16;         // texels per wet-mask cell
const MASK_EVERY = 10;         // frames between wet-mask readbacks that trim the active rect
const MASK_MARGIN = MASK_BLOCK + 8;
const PROTECT_MARGIN = 24;     // texels around a dab / fill band saved for undo, where its water and pigment spread to
const DESK = [1, 1, 1];      // the table the sheet lies on (sRGB)
const PAPER_UNITS = 1100;      // paper features are drawn for a sheet this many texels tall

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** A sheet size within the memory limits: the same shape, scaled down if too big. */
export function clampDocSize(w: number, h: number, maxSide = MAX_DOC_LONG): [number, number] {
  w = Math.max(MIN_DOC_SIDE, Math.round(w) || MIN_DOC_SIDE);
  h = Math.max(MIN_DOC_SIDE, Math.round(h) || MIN_DOC_SIDE);
  const s = Math.min(1, Math.min(MAX_DOC_LONG, maxSide) / Math.max(w, h), Math.sqrt(MAX_DOC_PIXELS / (w * h)));
  return [Math.max(MIN_DOC_SIDE, Math.round(w * s)), Math.max(MIN_DOC_SIDE, Math.round(h * s))];
}

const union = (a: Rect | null, b: Rect): Rect =>
  a ? { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) } : { ...b };

export class WatercolorEngine {
  params: Params = { ...DEFAULT_PARAMS };
  tool: Tool = 'brush';
  pigment: Pigment = pigmentFromHex('#2338a8');
  // 261027-gh9f: the Studio opens on the dry chalk stick (first Brush-tab
  // card); the everyday round remains the fallback.
  brush: Brush = buildBrush(BRUSH_PRESETS.find((p) => p.id === 'chalk') ?? BRUSH_PRESETS.find((p) => p.id === 'round') ?? BRUSH_PRESETS[0]!);
  /** quick-261115-oh9: the untextured silhouette a lift stroke erases with (see setLiftBrush). */
  private liftBrush: Brush | null = null;
  /** Once an Apple Pencil / stylus is seen, fingers paint with clear water. */
  fingerIsWater = true;
  /** When false, pointers on the paper are ignored (another tool, e.g. text, is driving it). */
  interactive = true;
  /** Footprint scale of the scripted stroke in progress (see scriptBegin). */
  private scriptScale = 1;
  // 261111-wd6: the pigment `configure()` installed for the active scripted
  // stroke. Per-sample colours are swapped in around each stamp and this is
  // restored afterwards, so a sampled colour can never leak into the next
  // stroke, a bucket fill, or the live path.
  private strokeBasePigment: Pigment | null = null;
  /** Reused interpolation target — a per-sample pigment allocates nothing. */
  private readonly scratchPigment: { coeffs: Float32Array } = {
    coeffs: new Float32Array(COEFFS),
  };
  private nav = false;
  /** Deterministic bake seam: seeded RNG (A2). Defaults to Math.random for live. */
  private rng: () => number = Math.random;
  /** Deterministic bake seam: virtual clock in ms. Defaults to performance.now(). */
  private clock: () => number = () => performance.now();
  /** When true, schedule() is a no-op — the host drives tick(dt) (bake). */
  private manual = false;
  /**
   * 2026-11-20: the last-touch field is float32, and the LIVE clock is
   * performance.now() in seconds (~1.7e6). At that magnitude f32 resolves
   * ~0.25 s, so strokes painted quickly apart stored IDENTICAL stamps and
   * the wetness age was wrong. Every last-touch timestamp is therefore
   * relative to this base: small values, microsecond precision.
   * The bake's virtual clock (0-based) is unchanged behaviourally.
   */
  private timeBaseMs: number | null = null;

  /** Seconds on the engine-relative clock — the ONE time base for last-touch. */
  private nowSec(): number {
    const now = this.clock();
    if (this.timeBaseMs === null) this.timeBaseMs = now;
    return (now - this.timeBaseMs) / 1000;
  }

  private tipTextures = new Map<string, WebGLTexture>();
  private paperPreset: PaperPreset = DEFAULT_PAPER;
  private paperSeed = 0;
  /** 64-21: an explicit sheet seed (null = roll one per sheet, the pre-64-21 law). */
  private paperSeedPin: number | null = null;
  private paperStrength = 1;
  private paperScale = 1;                           // paper units per texel, fixed when the sheet is made
  private paperOrigin: [number, number] = [0, 0];   // where the sheet sits in the paper's field (texels)
  // Phase 64: the emboss light, in degrees (converted at drawDisplay). Render-only.
  private light: LightSettings = { ...DEFAULT_LIGHT };
  // reference image: shown under the paint on screen only, never exported
  private ref: { tex: WebGLTexture; aspect: number; src: HTMLCanvasElement } | null = null;
  private refRect: RefRect = { x: 0, y: 0, w: 1, h: 1 };
  private refOpacity = 0.5;
  private refVisible = true;
  private lastDir: [number, number] = [1, 0];      // direction of the last stroke, for the first dab
  private lastAngle = 0;                            // tip angle shown by the hover cursor

  private g: GL;
  private gl: WebGL2RenderingContext;
  private programs: Record<string, Program>;
  private canvasSize: [number, number] = [1, 1];
  private dpr = 1;
  private view = { x: 0, y: 0, w: 1, h: 1 };   // document placement in canvas px
  private zoomLevel = 1;                        // 1 = one document texel per CSS px
  /** Compositor-layer mode: exact-fit view + transparent pigment display. */
  private compositorLayer = false;
  private fitPadding = FIT_PADDING;             // CSS px around the sheet when fitted
  private pan: [number, number] = [0, 0];       // sheet centre from canvas centre (canvas px, y up)
  private fitMode = true;                       // keep the sheet fitted as the window changes

  // document state
  private dw = 1; private dh = 1;
  private velocity!: DoubleTarget;
  private pressure!: DoubleTarget;
  private divergence!: Target;
  private curl!: Target;
  private ink!: DoubleTarget;
  private fixed!: Target;
  private wet!: DoubleTarget;
  private relief!: Target;                     // Phase 64: paint thickness, one channel, engine-only
  // SPIKE 001: the pigment layer's coverage, one channel. A ping-pong pair from
  // the start: 64-14 advects it with the ink and its undo needs both halves.
  private cover!: DoubleTarget;
  // 64-24 (D-24): the per-texel last-touch time — SECONDS on the virtual clock,
  // one EXACT-float channel, document-sized, ping-pong (the touch pass writes
  // the write half, then swaps). Engine-internal state: rebuilt from the stroke
  // script on replay, never persisted. The delivery law (D-29) admits this pair
  // as the medium engine's ONLY document-sized addition.
  private lastTouch!: DoubleTarget;
  /**
   * 64-24 (D-24): the carrier's wetness source — 1 is the shipped timestamp
   * law, 0 is 64-21's `wet * coverage` proxy kept ONLY as the recorded A/B
   * control 64-21 reserved `uWetMode` for. The probe's `--wet-mode` flag is
   * its one caller; the app never calls `setLastTouchMode`.
   */
  private lastTouchMode = 1;
  // 64-21 (SPIKE 002): the per-stroke bristle reservoirs — a FIXED
  // `1 × BRISTLE_CAP` set, three RGBA16F attachments (carried absorbance 0..3,
  // 4..6 + carried alpha, load/across/seed/valueJitter) — plus the static
  // `1 × BRISTLE_CAP` RGBA16F shape texture (radiusScale, touchReach,
  // loadRate, spare). Deliberately document-independent: the delivery law
  // allows no document-sized target for the medium engine. Engine-internal
  // state: rebuilt from the stroke record on replay, never persisted.
  private bristles!: DoubleTarget;
  private bristleShape!: Target;
  /**
   * 261119-pod (§3.3): the pre-dab snapshot — ONE document-sized pair of
   * RGBA16F attachments (16 B/px): attachment 0 = inkA + fixedA, attachment 1
   * = (inkB + fixedB).rgb with the COVER alpha in .a. Copied once per dab
   * BEFORE the deposit draws (WebGL2 cannot sample the attachment it writes),
   * only at Pickup > 0. Engine-internal: never persisted.
   */
  private smearCanvas!: Target;
  /** 64-21: the stroke object whose set is seeded — a NEW stroke always re-seeds. */
  private bristleStroke: Stroke | null = null;
  /**
   * 2026-11-20 (the artist's pen end block): dabs laid by the trailing
   * catch-up have no NEXT dab to cover their trailing half, so they are
   * tentative end impressions — the gather fades both halves. The following
   * movement dabs, laid with the leading-only cap, re-commit any trailing
   * band a mid-stroke catch-up thinned; at a real stop nothing follows and
   * the final impression dissolves into the same specks as the start.
   */
  private bristleEndCap = false;
  private bristleCount = 0;
  /**
   * FIX 2c — the display's edge-darkening law (`k = gran·(1+0.8·edge)`, up to
   * 1.8× density at ANY gradient) is a pen-work crispener that turns a
   * bristle stroke's soft rim into a dark 1-px outline and pins the fade
   * gauge's core to the boundary. It is OFF for bristle content and stays
   * exactly 0.8 for every non-bristle response, so the eight identity
   * baselines are untouched. Document-level: once a sheet carries bristle
   * paint, no region keeps the law (a mixed sheet pays the crispening cost) —
   * the per-pixel alternative needs a new target channel.
   */
  private bristleContent = false;
  private bristlePrev: { x: number; y: number; along: number } | null = null;
  private paper!: Target;
  private wetMask!: Target;                    // coarse "is there water here" map, read back to bound the sim
  private maskPixels = new Uint8Array(0);
  private maskCounter = 0;
  private history!: History;

  // simulation bookkeeping
  private active: Rect | null = null;          // document texels the sim must process
  private painted: Rect | null = null;         // where mobile pigment may exist (since the last fix)
  private everPainted: Rect | null = null;     // where any pigment, mobile or fixed, may exist
  private dirty: Rect | null = null;           // document texels to redraw
  private dirtyAll = true;
  private lastWet = -Infinity;                 // ms timestamp of the last water added
  private wetPeak = 0;
  private minAwakeUntil = 0;
  private fixTimer = 0;
  /** Studio settle-cap fix: the last step is a fix a new stroke may reopen (cancelAutoFix). */
  private autoFix = false;
  private flowSpeed = 0;                       // upper bound on water speed (sim texels / s)
  private growCarry = 0;                       // fractional texels the active rect still has to grow
  private brushNow = { x: 0, y: 0, r: 0 };
  private raf = 0;
  private lastFrame = 0;
  private seenEvictions = 0;           // history.evictions as of the last onHistoryChange

  // input
  private stroke: Stroke | null = null;
  private fill: { tex: WebGLTexture; bbox: Rect } | null = null;   // a paint-bucket wash in progress
  private queue: Sample[] = [];
  private pencilSeen = false;
  private hover = { x: 0, y: 0, inside: false, type: 'mouse' };
  private force = { value: 0, t: -Infinity };
  /** Host-injected tablet sample (261027-gh9e) — webviews that report no pen dynamics. */
  private nativePen: { pressure: number; tiltX: number; tiltY: number } | null = null;
  private nativePenAt = -Infinity;
  private disposers: (() => void)[] = [];

  /** `size` is the sheet in texels; omitted, the sheet follows the window ("screen"). */
  constructor(private canvas: HTMLCanvasElement, private cursor: HTMLElement | null, private callbacks: EngineCallbacks = {}, size?: [number, number] | null) {
    const gl = canvas.getContext('webgl2', {
      // alpha: true so the compositor-layer display can show the fond beneath.
      // premultipliedAlpha stays at the WebGL DEFAULT (true) — displayFS
      // writes premultiplied pixels (F1). A straight-alpha write reads as
      // neon + a light fringe on WKWebView even with premultipliedAlpha:false
      // (that flag is not reliably honoured there).
      alpha: true, premultipliedAlpha: true, depth: false, stencil: false, antialias: false, preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    if (!gl) throw new Error('WebGL2 is not available in this browser.');
    if (!gl.getExtension('EXT_color_buffer_float') && !gl.getExtension('EXT_color_buffer_half_float'))
      throw new Error('This GPU cannot render to floating-point textures.');
    this.gl = gl;
    this.g = new GL(gl);
    gl.disable(gl.BLEND);
    this.programs = {
      splat: this.g.program(S.splatFS),
      stamp: this.g.program(S.stampFS),
      relief: this.g.program(S.reliefFS),
      fill: this.g.program(S.fillFS),
      advectVelocity: this.g.program(S.advectVelocityFS),
      divergence: this.g.program(S.divergenceFS),
      pressure: this.g.program(S.pressureFS),
      gradient: this.g.program(S.gradientSubtractFS),
      curl: this.g.program(S.curlFS),
      vorticity: this.g.program(S.vorticityFS),
      scale: this.g.program(S.scaleFS),
      advectWet: this.g.program(S.advectWetFS),
      wetMask: this.g.program(S.wetMaskFS),
      advectInk: this.g.program(S.advectInkFS),
      settle: this.g.program(S.settleFS),
      lift: this.g.program(S.liftFS),
      paperField: this.g.program(S.paperFieldFS),
      paperLight: this.g.program(S.paperLightFS),
      paperSwatch: this.g.program(S.paperSwatchFS),
      paperSheet: this.g.program(S.paperSheetFS),
      display: this.g.program(S.displayFS),
      coverDeposit: this.g.program(S.coverDepositFS),
      coverMask: this.g.program(S.coverMaskFS),
    };
    // Phase 64: outside the literal on purpose — scattering.test.ts pins that
    // literal's program count, and `programs` is a Record.
    this.programs.bodyCover = this.g.program(S.bodyCoverFS);
    // 64-14: the coverage advect pass, same rule — outside the pinned literal.
    this.programs.advectCover = this.g.program(S.advectCoverFS);
    // 64-20 decision A: the capture-time clearance, same rule — outside the
    // pinned literal. The export boundary runs it for the pigment capture only.
    this.programs.coverClear = this.g.program(S.coverClearFS);
    // 64-21 (SPIKE 002): the per-bristle carrier, same rule — outside the
    // pinned literal (its count stays twenty-three).
    this.programs.bristleCarrier = this.g.program(S.bristleCarrierFS);
    // 64-22 (SPIKE 002, the gather): the ink deposit and the ONE coverage
    // write, same rule — outside the pinned literal (twenty-three stays).
    // Post-UAT 2026-11-19 (GAP-1): D-21's Body-mask program is gone — Body
    // is the film's opacity on the bristle path, not a second film's erode.
    this.programs.bristleDeposit = this.g.program(S.bristleDepositFS);
    this.programs.bristleCover = this.g.program(S.bristleCoverFS);
    // 64-24 (D-24): the touch refresh, same rule — outside the pinned literal
    // (twenty-three stays). The delivery law's third pass.
    this.programs.bristleTouch = this.g.program(S.bristleTouchFS);
    // 261119-pod (§3.3): the pre-dab snapshot copy, same rule — outside the
    // pinned literal (twenty-three stays). The delivery law's fourth pass,
    // drawing only when Pickup > 0.
    this.programs.bristleCanvas = this.g.program(S.bristleCanvasFS);
    this.fitCanvas();
    this.createDocument(size ?? this.screenSize);
    this.attachInput();
    this.schedule();
  }

  /* ------------------------------------------------------------------ setup */

  private fitCanvas() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = this.canvas.getBoundingClientRect();
    const w = Math.max(2, Math.round(r.width * this.dpr)), h = Math.max(2, Math.round(r.height * this.dpr));
    this.canvas.width = w; this.canvas.height = h;
    this.canvasSize = [w, h];
    if (this.fitMode) this.fitZoom(); else this.updateView();
  }

  /** The zoom that shows the whole sheet with a margin (0 margin in compositor mode). */
  private fitZoom() {
    const [cw, ch] = this.canvasSize;
    const pad = 2 * this.fitPadding * this.dpr;
    const z = Math.min((cw - pad) / this.dw, (ch - pad) / this.dh) / this.dpr;
    this.zoomLevel = clamp(z, MIN_ZOOM, MAX_ZOOM);
    this.pan = [0, 0];
    this.fitMode = true;
    this.updateView();
  }

  /** Place the sheet from zoom and pan; everything that maps pointers goes through `view`. */
  private updateView() {
    const [cw, ch] = this.canvasSize;
    const s = this.zoomLevel * this.dpr, w = this.dw * s, h = this.dh * s;
    // keep a strip of the sheet on screen so it can't be lost off the edge
    const keep = PAN_KEEP * this.dpr;
    const mx = Math.max(0, (cw + w) / 2 - keep), my = Math.max(0, (ch + h) / 2 - keep);
    this.pan = [clamp(this.pan[0], -mx, mx), clamp(this.pan[1], -my, my)];
    this.view = { x: (cw - w) / 2 + this.pan[0], y: (ch - h) / 2 + this.pan[1], w, h };
    this.dirtyAll = true;
    this.updateCursor();
    this.callbacks.onViewChange?.(this.zoomLevel, [this.dw, this.dh]);
  }

  /** A sheet the shape of the window, in device pixels, within the "screen" limits. */
  get screenSize(): [number, number] {
    const [cw, ch] = this.canvasSize;
    const s = Math.min(1, SCREEN_DOC_LONG / Math.max(cw, ch), SCREEN_DOC_SHORT / Math.min(cw, ch));
    return clampDocSize(cw * s, ch * s, this.maxSide);
  }

  /** The longest sheet side this GPU allows. */
  get maxSide() { return Math.min(MAX_DOC_LONG, this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE) as number); }

  /** Allocate every document-sized target for a `dw`×`dh` sheet (the old ones are the caller's to free). */
  private allocateTargets() {
    const { gl, g } = this;
    const ar = this.dw / this.dh;
    const sim = ar > 1 ? { w: Math.round(SIM_BASE * ar), h: SIM_BASE } : { w: SIM_BASE, h: Math.round(SIM_BASE / ar) };
    this.velocity = g.double(sim.w, sim.h, [HALF_FLOAT_RG], gl.LINEAR);
    this.pressure = g.double(sim.w, sim.h, [HALF_FLOAT_R], gl.NEAREST);
    this.divergence = g.target(sim.w, sim.h, [HALF_FLOAT_R], gl.NEAREST);
    this.curl = g.target(sim.w, sim.h, [HALF_FLOAT_R], gl.NEAREST);
    this.ink = g.double(this.dw, this.dh, [HALF_FLOAT_RGBA, HALF_FLOAT_RGBA], gl.LINEAR);
    this.fixed = g.target(this.dw, this.dh, [HALF_FLOAT_RGBA, HALF_FLOAT_RGBA], gl.LINEAR);
    this.wet = g.double(this.dw, this.dh, [HALF_FLOAT_R], gl.LINEAR);
    // Phase 64: the thickness field — one channel on the document grid, the same
    // shape `wet` uses. Not a ping-pong pair: nothing advects it.
    this.relief = g.target(this.dw, this.dh, [HALF_FLOAT_R], gl.LINEAR);
    // SPIKE 001: the coverage channel — one channel on the document grid. A
    // ping-pong pair because 64-14 advects it and its undo needs both halves.
    this.cover = g.double(this.dw, this.dh, [HALF_FLOAT_R], gl.LINEAR);
    // 64-24 (D-24, the delivery law's budget): the last-touch memory — one R32F
    // pair on the document grid, the medium engine's only document-sized
    // addition. Cleared to the one-week sentinel at the END of this method,
    // never to zero (a cleared R32F reads 0 = "touched at t = 0").
    this.lastTouch = g.double(this.dw, this.dh, [FLOAT_R], gl.NEAREST);
    // 64-21 (SPIKE 002): the bristle reservoirs are a FIXED 1 × 256 set,
    // independent of the sheet — no document-sized allocation (the delivery
    // law's budget). PATTERNS flags a fixed-size target as novel and suggests
    // keeping it OUT of allocateTargets()/docTargets(); this plan keeps both
    // in docTargets() on purpose so the sheet wipe, a resize and applyWhole's
    // disposal all reach them (no leak), and makes that safe by construction:
    // the shape is re-uploaded at every stroke start and the reservoirs are
    // only ever read inside a seeded stroke (see beginBristles).
    this.bristles = g.double(1, BRISTLE_CAP, [HALF_FLOAT_RGBA, HALF_FLOAT_RGBA, HALF_FLOAT_RGBA], gl.NEAREST);
    this.bristleShape = g.target(1, BRISTLE_CAP, [HALF_FLOAT_RGBA], gl.NEAREST);
    // 261119-pod (§3.3): the pre-dab snapshot — ONE document-sized RGBA16F
    // pair, cleared here at allocation (g.target clears every attachment) and
    // overwritten in full on every dab that reads it. No size coupling to any
    // other target: NEAREST because the gather reads its exact texel.
    this.smearCanvas = g.target(this.dw, this.dh, [HALF_FLOAT_RGBA, HALF_FLOAT_RGBA], gl.NEAREST);
    this.paper = g.target(this.dw, this.dh, [RGBA8], gl.LINEAR);
    this.wetMask = g.target(Math.ceil(this.dw / MASK_BLOCK), Math.ceil(this.dh / MASK_BLOCK), [RGBA8], gl.NEAREST);
    this.maskPixels = new Uint8Array(this.wetMask.w * this.wetMask.h * 4);
    this.clearLastTouch();
  }

  /**
   * 64-24 (D-24): write the one-week sentinel into BOTH halves of the last-touch
   * pair. `clearTarget` cannot be reused — it clears to 0, which this field
   * reads as "touched at t = 0". Called at the end of allocateTargets() and
   * immediately after every sheet wipe (clear / resetSheet).
   */
  private clearLastTouch() {
    this.timeBaseMs = null;
    const { gl } = this;
    for (const t of [this.lastTouch.read, this.lastTouch.write]) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
      gl.clearColor(LAST_TOUCH_DRY_SECONDS, LAST_TOUCH_DRY_SECONDS, LAST_TOUCH_DRY_SECONDS, LAST_TOUCH_DRY_SECONDS);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    gl.clearColor(0, 0, 0, 0);
  }

  private allocateHistory() {
    // Pool 0 is positionally paired with snapshotLayers() and travel()'s layer
    // map: mobile pigment (A, B), water, then Phase 64's paint thickness (R16F),
    // 64-24's last-touch memory (R32F) and 64-14's coverage (R16F) as the FIFTH,
    // SIXTH and last entries. Grow all three lists together or the atlas copies
    // the wrong layer.
    this.history = new History(this.g, this.dw, this.dh, [
      { formats: [HALF_FLOAT_RGBA, HALF_FLOAT_RGBA, HALF_FLOAT_R, HALF_FLOAT_R, FLOAT_R, HALF_FLOAT_R], documents: 2 }, // mobile pigment + water + thickness + last-touch + coverage
      { formats: [HALF_FLOAT_RGBA, HALF_FLOAT_RGBA], documents: 1 },                                           // fixed pigment
    ]);
  }

  /** The targets that hold the sheet (not the sim grids, not the history atlases). */
  private docTargets(): Target[] {
    // SPIKE 001: the coverage pair is LAST, after the thickness, so the sheet
    // wipe clears it with every other non-paper document target.
    // 64-24: the last-touch pair sits immediately BEFORE the coverage pair
    // (coverage stays last for its committed pin) so the same wipe and
    // disposal reach the wetness memory.
    // 64-21: the bristle reservoirs and the shape texture are the ONLY
    // document-independent entries here — membership buys disposal reach
    // (resize, applyWhole) and wipe reach, and costs nothing per edition.
    // 261119-pod: the smear snapshot joins document-sized disposal right
    // after the shape (it is rebuilt per dab, so a wipe of zeros is harmless).
    return [this.velocity.read, this.velocity.write, this.pressure.read, this.pressure.write, this.divergence, this.curl,
      this.ink.read, this.ink.write, this.fixed, this.wet.read, this.wet.write, this.paper, this.wetMask,
      this.bristles.read, this.bristles.write, this.bristleShape, this.smearCanvas, this.relief,
      this.lastTouch.read, this.lastTouch.write,
      this.cover.read, this.cover.write];
  }

  /** (Re)create a blank `w`×`h` sheet. Discards the painting. */
  private createDocument([w, h]: [number, number]) {
    const oldAspect = this.aspect;
    [this.dw, this.dh] = clampDocSize(w, h, this.maxSide);
    // a reference placed on paper of another shape would be stretched; fit it afresh
    if (this.ref && Math.abs(this.aspect - oldAspect) > 1e-3) this.fitReference();
    this.g.disposeTargets();
    this.allocateTargets();
    this.allocateHistory();

    // 64-21: a pinned seed makes the sheet a recorded constant across replays;
    // an unpinned engine keeps the pre-64-21 per-sheet roll, byte for byte.
    this.paperSeed = this.paperSeedPin ?? this.rng();
    this.paperScale = PAPER_UNITS / this.dh;
    this.paperOrigin = [0, 0];
    this.drawPaper(this.paper, this.paperOrigin, this.paperScale);

    this.resetPaintState();
    if (this.fitMode) this.fitZoom(); else this.updateView();
    this.notifyHistory();
  }

  private resetPaintState() {
    this.active = null;
    this.painted = null;
    this.everPainted = null;
    this.dirty = null;
    this.dirtyAll = true;
    this.lastWet = -Infinity;
    this.wetPeak = 0;
    this.fixTimer = 0;
    this.autoFix = false;
    this.flowSpeed = 0;
  }

  /**
   * Change the sheet to `w`×`h` texels, keeping the painting at its size and centred:
   * a bigger sheet adds blank paper around it, a smaller one crops it. The paper grain
   * stays registered under the paint. The change is one undo step; the steps before it
   * are forgotten (their undo tiles belong to the old sheet).
   */
  resizeDocument(w: number, h: number) {
    [w, h] = clampDocSize(w, h, this.maxSide);
    const ow = this.dw, oh = this.dh;
    if (w === ow && h === oh) return;
    this.stroke = null;
    this.restoreStrokePigment();
    this.dropFill();
    this.queue = [];
    this.autoFix = false;   // a newer step makes the settle-cap fix permanent
    const { g } = this;
    const ox = Math.round((w - ow) / 2), oy = Math.round((h - oh) / 2);
    const meta: StepMeta = { ...this.currentMeta(), whole: this.captureWhole(), paperOrigin: [...this.paperOrigin] };
    const old = { targets: this.docTargets(), ink: this.ink.read, fixed: this.fixed, wet: this.wet.read, relief: this.relief, cover: this.cover.read, lastTouch: this.lastTouch.read };
    this.dw = w; this.dh = h;
    this.allocateTargets();
    this.history.beginBoundary({ kind: 'resize', label: `Resize ${w} × ${h}` }, meta, w, h);

    // the overlap of the old sheet (shifted by ox, oy) and the new one
    const sx = Math.max(0, -ox), sy = Math.max(0, -oy), dx = Math.max(0, ox), dy = Math.max(0, oy);
    const cw = Math.min(ow - sx, w - dx), ch = Math.min(oh - sy, h - dy);
    const copy = (src: Target, dsts: Target[]) => {
      if (cw > 0 && ch > 0) src.views.forEach((v, i) => dsts.forEach(d => g.blit(v, sx, sy, d.views[i], dx, dy, cw, ch)));
    };
    copy(old.ink, [this.ink.read, this.ink.write]);
    copy(old.wet, [this.wet.read, this.wet.write]);
    copy(old.fixed, [this.fixed]);
    copy(old.relief, [this.relief]);   // Phase 64: a resized sheet keeps its relief
    copy(old.cover, [this.cover.read, this.cover.write]);   // SPIKE 001: and its coverage
    copy(old.lastTouch, [this.lastTouch.read, this.lastTouch.write]);   // 64-24: and its last-touch memory
    old.targets.forEach(t => g.disposeTarget(t));

    this.paperOrigin = [this.paperOrigin[0] - ox, this.paperOrigin[1] - oy];
    this.drawPaper(this.paper, this.paperOrigin, this.paperScale);

    const shift = (r: Rect | null): Rect | null => {
      if (!r) return null;
      const n = { x0: Math.max(0, r.x0 + ox), y0: Math.max(0, r.y0 + oy), x1: Math.min(w, r.x1 + ox), y1: Math.min(h, r.y1 + oy) };
      return n.x1 > n.x0 && n.y1 > n.y0 ? n : null;
    };
    this.active = shift(this.active);
    this.painted = shift(this.painted);
    this.everPainted = shift(this.everPainted);
    this.dirty = null;
    const rr = this.refRect;
    this.refRect = { x: (rr.x * ow + ox) / w, y: (rr.y * oh + oy) / h, w: (rr.w * ow) / w, h: (rr.h * oh) / h };

    if (this.fitMode) this.fitZoom(); else this.updateView();
    this.notifyHistory();
    this.callbacks.onDocumentChange?.(this.docState());
    this.schedule();
  }

  /* ------------------------------------------------- whole-document state */

  /** The paint layers, cropped to where anything was ever painted. */
  private captureWhole(): WholeDoc {
    const r = this.everPainted;
    const { g, dw, dh } = this;
    const read = (fb: WebGLFramebuffer, ch: 1 | 4) => (r ? g.readHalf(fb, dw, dh, ch, r) : new Uint16Array(0));
    // 64-24 (D-24): the last-touch layer is EXACT f32 — a half-float round-trip
    // would clamp the one-week sentinel and every restored sheet would read as
    // freshly touched.
    const readF = (fb: WebGLFramebuffer) => (r ? g.readFloat(fb, dw, dh, r) : new Float32Array(0));
    return {
      w: dw, h: dh, rect: r ? { ...r } : null,
      layers: {
        inkA: read(this.ink.read.views[0], 4), inkB: read(this.ink.read.views[1], 4),
        fixedA: read(this.fixed.views[0], 4), fixedB: read(this.fixed.views[1], 4),
        wet: read(this.wet.read.views[0], 1),
        relief: read(this.relief.views[0], 1),
        cover: read(this.cover.read.views[0], 1),
        lastTouch: readF(this.lastTouch.read.views[0]),
      },
    };
  }

  /** Put `whole`'s layers into the (blank) current targets; both halves of the ping-pong pairs. */
  private uploadWhole(whole: WholeDoc) {
    const r = whole.rect;
    if (!r) return;
    const { gl, g } = this;
    const w = r.x1 - r.x0, h = r.y1 - r.y0;
    // 64-24: `WholeDoc.layers` is a union record (the last-touch layer is exact
    // f32); every half-float layer still restores through the same helper, so
    // narrow here — an engine-produced record always carries Uint16Array for
    // these keys.
    const up = (tex: WebGLTexture, format: number, data: Uint16Array | Float32Array) => {
      if (!(data instanceof Uint16Array)) throw new Error('whole-document layer is not half float');
      g.uploadHalf(tex, r.x0, r.y0, w, h, format, data);
    };
    // 64-24: the last-touch memory is EXACT f32 (see captureWhole).
    const upF = (tex: WebGLTexture, data: Float32Array) => g.uploadFloat(tex, r.x0, r.y0, w, h, data);
    for (const t of [this.ink.read, this.ink.write]) { up(t.tex[0], gl.RGBA, whole.layers.inkA); up(t.tex[1], gl.RGBA, whole.layers.inkB); }
    up(this.fixed.tex[0], gl.RGBA, whole.layers.fixedA);
    up(this.fixed.tex[1], gl.RGBA, whole.layers.fixedB);
    for (const t of [this.wet.read, this.wet.write]) up(t.tex[0], gl.RED, whole.layers.wet);
    up(this.relief.tex[0], gl.RED, whole.layers.relief);
    // 64-14: coverage is a document layer — restore it into both halves of its
    // ping-pong pair, exactly like water.
    for (const t of [this.cover.read, this.cover.write]) up(t.tex[0], gl.RED, whole.layers.cover);
    // 64-24: the last-touch memory restores into both halves too — but only
    // when the record actually carries exact floats (the narrowing guard keeps
    // a hypothetical half-float-era record from uploading garbage).
    const lt = whole.layers.lastTouch;
    if (lt instanceof Float32Array) for (const t of [this.lastTouch.read, this.lastTouch.write]) upF(t.tex[0], lt);
    this.everPainted = { ...r };
  }

  /** Replace the sheet with `whole` (another size, usually), keeping the history atlases. */
  private applyWhole(whole: WholeDoc, paperOrigin: [number, number]) {
    const old = this.docTargets();
    this.dw = whole.w; this.dh = whole.h;
    this.allocateTargets();
    old.forEach(t => this.g.disposeTarget(t));
    this.history.resize(this.dw, this.dh);
    this.paperOrigin = [...paperOrigin];
    this.drawPaper(this.paper, this.paperOrigin, this.paperScale);
    this.everPainted = null;
    this.uploadWhole(whole);
    this.dirty = null;
    this.dirtyAll = true;
    if (this.fitMode) this.fitZoom(); else this.updateView();
  }

  private docState(): DocState {
    return {
      paperId: this.paperPreset.id,
      paperStrength: this.paperStrength,
      reference: { image: this.ref?.src ?? null, rect: { ...this.refRect }, opacity: this.refOpacity, visible: this.refVisible },
    };
  }

  /** Paper and reference state as undo tracks it. */
  get documentState(): DocState { return this.docState(); }

  /** Bring paper / reference state back (after undo, redo or a project opened). */
  private applyDocState(d: DocState) {
    const preset = PAPERS.find(p => p.id === d.paperId);
    if (preset && preset !== this.paperPreset) { this.paperPreset = preset; this.drawPaper(this.paper, this.paperOrigin, this.paperScale); }
    this.paperStrength = clamp(d.paperStrength, 0, 1);
    const r = d.reference;
    if (r.image !== (this.ref?.src ?? null)) this.uploadReference(r.image);
    this.refRect = { ...r.rect };
    this.refOpacity = r.opacity;
    this.refVisible = r.visible;
    this.dirtyAll = true;
  }

  /**
   * Record a document-level change that has already been applied (paper, reference) as
   * one undo step; `before` is the state to come back to.
   */
  recordChange(kind: StepKind, label: string, before: DocState) {
    this.dropFill();
    this.autoFix = false;   // a newer step makes the settle-cap fix permanent
    this.history.begin({ kind, label }, { ...this.currentMeta(), doc: before } satisfies StepMeta);
    this.notifyHistory();
  }

  /** The painting as it is now, ready to be saved. */
  snapshot(): DocumentSnapshot {
    const m = this.currentMeta();
    return {
      whole: this.captureWhole(),
      paper: { id: this.paperPreset.id, seed: this.paperSeed, origin: [...this.paperOrigin], scale: this.paperScale, strength: this.paperStrength },
      wet: { wetAgo: m.wetAgo, wetPeak: m.wetPeak, active: m.active, painted: m.painted },
      reference: m.doc.reference,
      view: { zoom: this.zoomLevel, pan: [...this.pan], fitted: this.fitMode },
    };
  }

  /** Replace the painting with a saved one. History starts afresh. */
  restore(s: DocumentSnapshot) {
    const [w, h] = clampDocSize(s.whole.w, s.whole.h, this.maxSide);
    if (w !== s.whole.w || h !== s.whole.h) throw new Error(`This sheet (${s.whole.w} × ${s.whole.h}) is too large for this GPU.`);
    this.stroke = null;
    this.restoreStrokePigment();
    this.dropFill();
    this.queue = [];
    if (this.ref) { this.gl.deleteTexture(this.ref.tex); this.ref = null; }
    this.g.disposeTargets();
    this.dw = w; this.dh = h;
    this.allocateTargets();
    this.allocateHistory();
    this.resetPaintState();

    this.paperPreset = PAPERS.find(p => p.id === s.paper.id) ?? DEFAULT_PAPER;
    this.paperSeed = s.paper.seed;
    this.paperScale = s.paper.scale || PAPER_UNITS / this.dh;
    this.paperOrigin = [...s.paper.origin];
    this.paperStrength = clamp(s.paper.strength, 0, 1);
    this.drawPaper(this.paper, this.paperOrigin, this.paperScale);

    this.uploadWhole(s.whole);
    const now = this.clock();
    this.lastWet = Number.isFinite(s.wet.wetAgo) ? now - s.wet.wetAgo : -Infinity;
    this.wetPeak = s.wet.wetPeak;
    this.active = s.wet.active ? { ...s.wet.active } : null;
    this.painted = s.wet.painted ? { ...s.wet.painted } : null;
    if (this.active) this.minAwakeUntil = now + 250;

    this.uploadReference(s.reference.image);
    this.refRect = { ...s.reference.rect };
    this.refOpacity = clamp(s.reference.opacity, 0, 1);
    this.refVisible = s.reference.visible;

    this.zoomLevel = clamp(s.view.zoom, MIN_ZOOM, MAX_ZOOM);
    this.pan = [...s.view.pan];
    this.fitMode = s.view.fitted;
    if (this.fitMode) this.fitZoom(); else this.updateView();
    this.notifyHistory();
    this.callbacks.onDocumentChange?.(this.docState());
    this.schedule();
  }

  /* ---------------------------------------------------------------- view */

  /** Current zoom: 1 shows one document texel per CSS pixel. */
  get zoom() { return this.zoomLevel; }

  /** True while the sheet is fitted to the window (it stays fitted as the window changes). */
  get fitted() { return this.fitMode; }

  /** While navigating (e.g. Space held) pointers on the paper pan instead of paint. */
  get navigating() { return this.nav; }
  set navigating(v: boolean) { this.nav = v; this.updateCursor(); }

  /** Zoom by `factor` keeping the document point under (clientX, clientY) in place. */
  zoomAt(clientX: number, clientY: number, factor: number) {
    const r = this.canvas.getBoundingClientRect();
    const [cw, ch] = this.canvasSize;
    const z = clamp(this.zoomLevel * factor, MIN_ZOOM, MAX_ZOOM);
    const k = z / this.zoomLevel;
    if (k === 1) return;
    const px = (clientX - r.left) * this.dpr, py = ch - (clientY - r.top) * this.dpr;
    // the sheet centre moves away from the fixed point by the zoom ratio
    const cx = cw / 2 + this.pan[0], cy = ch / 2 + this.pan[1];
    this.pan = [px - (px - cx) * k - cw / 2, py - (py - cy) * k - ch / 2];
    this.zoomLevel = z;
    this.fitMode = false;
    this.updateView();
    this.schedule();
  }

  /** Zoom to `z` about the middle of the window. */
  zoomTo(z: number) {
    const r = this.canvas.getBoundingClientRect();
    this.zoomAt(r.left + r.width / 2, r.top + r.height / 2, z / this.zoomLevel);
  }

  /** Show the whole sheet. */
  zoomToFit() { this.fitZoom(); this.schedule(); }

  /**
   * True while a stroke, fix, or wet diffusion still needs frames. Goes false
   * when the sheet settles — the point where the dry (concentrated) look is
   * what the user sees, and the right moment to capture it.
   */
  get isAwake(): boolean {
    const now = this.clock();
    return this.active !== null &&
      (this.stroke !== null || this.fixTimer > 0 || now < this.minAwakeUntil || now < this.wetUntil());
  }

  /**
   * True while the sheet holds standing water the Water tool can act on — the
   * live UI gate's source of truth. False during the Dry fix bake even though
   * `isAwake` is still true.
   */
  get hasStandingWater(): boolean {
    return isSheetWet({
      wetPeak: this.wetPeak,
      wetUntilMs: this.wetUntil(),
      nowMs: this.clock(),
      fixing: this.fixTimer > 0,
    });
  }

  /** True when the sheet holds paint (since the last clear) — never capture blank. */
  get hasPaint(): boolean {
    return this.everPainted !== null;
  }

  /**
   * Compositor-layer mode (Studio integration): the sheet maps 1:1 onto the
   * canvas box (no fit margin — pointer UV is the plain rect fraction) and the
   * display is pigment-on-transparent. The document fond is owned by the
   * compositor, never this surface (v1.0 compositor law).
   */
  setCompositorLayer(on: boolean): void {
    if (this.compositorLayer === on) return;
    this.compositorLayer = on;
    this.fitPadding = on ? 0 : FIT_PADDING;
    if (this.fitMode) this.fitZoom(); else this.updateView();
    this.redraw();
  }

  /** Move the sheet by (dx, dy) CSS pixels. */
  panBy(dx: number, dy: number) {
    if (!dx && !dy) return;
    this.pan = [this.pan[0] + dx * this.dpr, this.pan[1] - dy * this.dpr];
    this.fitMode = false;
    this.updateView();
    this.schedule();
  }

  /* ------------------------------------------------------------- public API */

  setParams(p: Partial<Params>) { Object.assign(this.params, p); }

  /** Document width / height. Document uv has y up; x spans `aspect` heights. */
  get aspect() { return this.dw / this.dh; }

  /** Client (CSS px) -> document uv. */
  clientToDoc(clientX: number, clientY: number): [number, number] { return this.toUv({ clientX, clientY }); }

  /** Document uv -> client (CSS px). */
  docToClient(x: number, y: number): [number, number] {
    const r = this.canvas.getBoundingClientRect();
    return [r.left + (this.view.x + x * this.view.w) / this.dpr, r.top + (this.canvasSize[1] - this.view.y - y * this.view.h) / this.dpr];
  }

  /** Document size in texels. */
  get docSize(): [number, number] { return [this.dw, this.dh]; }

  /* ------------------------------------------------- paint-bucket fills (fill) */

  /** Is a bucket fill in progress? */
  get filling() { return this.fill !== null; }

  /** How far (px) past the farthest field distance a fill must run so its roughened front covers everything. */
  get fillMargin() { return FILL_WIDTH + FILL_JITTER + 1; }

  /**
   * The document as a flat image: pigment on plain paper with no relief, grain, edge
   * darkening or wet tint, so areas of one colour read as one colour. RGBA8, row 0 is
   * document y = 0 (uv is y-up, so no flip is needed to index it by texel).
   */
  readFlat(): Uint8Array { return this.readback(true); }

  /**
   * Start a bucket fill: `field` is RG per document texel (distance from the tap in
   * px, -1 outside the area; distance to the area's edge), `bbox` the half-open texel
   * rect around it. Opens one undo step for the whole wash. False while a stroke is
   * still on the paper.
   */
  fillBegin(field: Float32Array, bbox: Rect, label = 'Fill'): boolean {
    if (this.stroke) return false;
    if (field.length !== this.dw * this.dh * 2) throw new Error('fill field does not match the document');
    this.beginStep('fill', label);   // also drops any previous fill
    const tex = this.g.texture(this.dw, this.dh, FLOAT_RG, field, this.gl.NEAREST);
    this.fill = { tex, bbox: { ...bbox } };
    return true;
  }

  /**
   * Deposit the band `from < distance <= to` of the current fill: pigment (if `paint`)
   * and water, feathered over `soft` px at the area's edge. False once the fill is
   * gone (undo, clear, another action), in which case the caller should stop.
   */
  fillStep(from: number, to: number, o: { strength: number; water: number; soft: number; paint: boolean }): boolean {
    const f = this.fill;
    if (!f) return false;
    const { gl, g } = this;
    const P = this.params;
    this.touch(f.bbox);
    const p = this.programs.fill;
    p.bind();
    gl.uniform1i(p.u.uField, g.bindTex(0, f.tex));
    gl.uniform1i(p.u.uPaper, g.bindTex(1, this.paper.tex[0]));
    gl.uniform1f(p.u.uSoft, Math.max(0, o.soft));
    gl.uniform1f(p.u.uGrainThr, 0.5);
    gl.uniform1f(p.u.uJitter, FILL_JITTER);
    gl.uniform1f(p.u.uWidth, FILL_WIDTH);
    gl.enable(gl.BLEND);
    if (o.paint) {
      // a steady stroke's density (brush case of stamp(), full reservoir, medium pressure)
      const conc = 0.15 * Math.exp(P.load * 2.8) * 0.84;
      const amount = conc * o.strength;
      const c = this.pigment.coeffs;
      gl.uniform1i(p.u.uCumulative, 0);
      gl.uniform1f(p.u.uFrom, from);
      gl.uniform1f(p.u.uTo, to);
      gl.uniform1f(p.u.uGrain, 0.12);
      gl.uniform4f(p.u.uColor0, c[0] * amount, c[1] * amount, c[2] * amount, c[3] * amount);
      gl.uniform4f(p.u.uColor1, c[4] * amount, c[5] * amount, c[6] * amount, scatteringDeposit(P.body, amount));
      gl.blendEquation(gl.FUNC_ADD);
      gl.blendFunc(gl.ONE, gl.ONE);
      g.draw(this.ink.read, f.bbox);
    }
    // the water runs a little ahead of the pigment, as a real wash does
    const wetAmt = (0.25 + 0.75 * o.water) * 0.9;
    gl.uniform1i(p.u.uCumulative, 1);
    gl.uniform1f(p.u.uTo, to + FILL_WATER_LEAD);
    gl.uniform1f(p.u.uGrain, 0);
    gl.uniform4f(p.u.uColor0, wetAmt, 0, 0, 0);
    gl.uniform4f(p.u.uColor1, 0, 0, 0, 0);
    gl.blendEquation(gl.MAX);
    g.draw(this.wet.read, f.bbox);
    gl.blendEquation(gl.FUNC_ADD);
    gl.disable(gl.BLEND);
    this.wetPeak = Math.max(this.wetPeak * this.wetDecay(), wetAmt);
    this.lastWet = this.clock();
    this.schedule();
    return true;
  }

  /** Finish (or stop) the current fill; what has been laid down stays. */
  fillEnd() { this.dropFill(); }

  private dropFill() {
    if (!this.fill) return;
    this.gl.deleteTexture(this.fill.tex);
    this.fill = null;
  }

  /* -------------------------------------------------- scripted strokes (text) */

  /** Is a code-driven stroke in progress? */
  get scripting() { return this.stroke?.pointerId === SCRIPT_POINTER; }

  /**
   * Start a stroke driven by code rather than a pointer; it runs through the same
   * pipeline (spacing, speed thinning, dwell, undo). Returns false while another
   * stroke is still on the paper. A string `step` opens an undo step with that label;
   * pass false to group several strokes (the letters of a word) into one. `maxRadius`
   * (document heights) shrinks a footprint that would be wider than that at full
   * pressure, so a big brush still writes small letters legibly.
   *
   * Studio integration: `pressure` keeps the live sentinel — a negative value
   * means "no pen pressure available" (mouse / trackpad), so the stroke derives
   * it from speed exactly like the pointer path. Clamping it to the floor made
   * replayed mouse strokes land at minimum pressure (pale, thin, under-wet).
   * `tiltX`/`tiltY` carry the recorded pen tilt so asymmetric tips keep their
   * azimuth on replay.
   *
   * `widthScale` (61-04) is the per-sample width factor of the vector profile
   * — a footprint multiplier carried on the sample, bounded to the published
   * 0.2..20 range. It is NOT `maxRadius` and is never routed through
   * `scriptScale`: that clamp stays the footprint cap it always was (C-03).
   *
   * `pigment` (261111-wd6) is the per-vertex colour of this sample. Absent
   * keeps the pigment `configure()` installed — today's exact deposit. When
   * present it rides the queued sample and is swapped in only around that
   * sample's stamps, then the base pigment is restored (no leak).
   */
  scriptBegin(tool: Tool, x: number, y: number, pressure: number, step: string | false = 'Stroke', maxRadius?: number, tiltX = 0, tiltY = 0, widthScale = 1, pigment?: Pigment): boolean {
    if (this.stroke) return false;
    if (step !== false) this.beginStep('script', step);
    this.scriptScale = maxRadius ? Math.min(1, maxRadius / this.radius(tool, 1, 0)) : 1;
    // The base pigment is whatever configure() installed. It is captured
    // BEFORE any per-sample swap so it can be restored on every exit path.
    this.strokeBasePigment = this.pigment;
    this.stroke = {
      pointerId: SCRIPT_POINTER, pointerType: 'pen', tool, started: false, ending: false,
      x: 0, y: 0, cx: 0, cy: 0, pr: 0, t: this.clock(), speed: 0, simPressure: 0.45, carry: 0, travelled: 0, moved: false,
      dx: this.lastDir[0], dy: this.lastDir[1], angle: this.lastAngle, azimuth: null,
      widthFrom: 1, widthTo: 1,
      pigFrom: null, pigTo: null,
    };
    this.queue.push({ x, y, p: scriptPressure(pressure), t: this.clock(), tx: tiltX, ty: tiltY, w: scriptWidthFactor(widthScale), pig: pigment });
    this.schedule();
    return true;
  }

  /** Feed the scripted stroke a sample; `t` is a performance.now() timestamp. False once the stroke is gone (undo, clear). */
  scriptMove(x: number, y: number, pressure: number, t: number, tiltX = 0, tiltY = 0, widthScale = 1, pigment?: Pigment): boolean {
    if (!this.scripting) return false;
    this.queue.push({ x, y, p: scriptPressure(pressure), t, tx: tiltX, ty: tiltY, w: scriptWidthFactor(widthScale), pig: pigment });
    this.schedule();
    return true;
  }

  scriptEnd() {
    if (!this.scripting) return;
    this.stroke!.ending = true;
    this.schedule();
  }

  setPigment(p: Pigment) { this.pigment = p; }

  /**
   * 261111-wd6: put the stroke's base pigment back when a scripted stroke
   * leaves the paper by any path (end, undo, clear, resize, restore, abort).
   * No-op once restored or for a live stroke.
   */
  private restoreStrokePigment(): void {
    if (this.strokeBasePigment !== null) {
      this.pigment = this.strokeBasePigment;
      this.strokeBasePigment = null;
    }
  }

  /** Deterministic bake: install a seeded RNG (A2). */
  setRandom(fn: () => number) { this.rng = fn; }

  /** Deterministic bake: install a virtual clock in ms (A2). */
  setClock(fn: () => number) { this.clock = fn; this.timeBaseMs = null; }

  /**
   * 64-24 (D-24): the recorded A/B seam — 1 is the shipped timestamp law for
   * the carrier's wetness, 0 is 64-21's proxy. Compare-then-write so a
   * replayed script can never toggle the mode mid-bake. Test/probe only; the
   * app never calls it.
   */
  setLastTouchMode(mode: 0 | 1) {
    if (mode !== this.lastTouchMode) this.lastTouchMode = mode === 0 ? 0 : 1;
  }

  /** Deterministic bake: stop the rAF loop; the host drives tick(dt). */
  setManual(on: boolean) {
    this.manual = on;
    if (on) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    } else {
      this.schedule();
    }
  }

  /**
   * One deterministic simulation step (seconds). Runs the same body as the
   * rAF frame with a caller-supplied dt — the bake tick law.
   */
  tick(dt: number) {
    this.brushNow.r = 0;
    this.processInput(dt);
    const now = this.clock();
    const awake = this.active !== null &&
      (this.stroke !== null || this.fixTimer > 0 || now < this.minAwakeUntil || now < this.wetUntil());
    if (awake) {
      this.flowSpeed *= Math.exp(-dt * (3.0 - this.params.flow * 2.4));
      this.growCarry += 0.4 + Math.min(3, 0.15 * this.flowSpeed * dt * (this.dw / this.velocity.w));
      const grow = Math.floor(this.growCarry);
      if (grow > 0) {
        this.growCarry -= grow;
        const a = this.active!;
        this.touch({ x0: Math.max(0, a.x0 - grow), y0: Math.max(0, a.y0 - grow), x1: Math.min(this.dw, a.x1 + grow), y1: Math.min(this.dh, a.y1 + grow) }, false, false);
      }
      this.step(dt);
      if (this.fixTimer <= 0 && ++this.maskCounter >= MASK_EVERY) { this.maskCounter = 0; this.trimActive(); }
    }
    this.render();
    if (!awake && this.active) this.sleep();
  }

  /** The composited document as an RGBA8 canvas (bottom row first flipped to top). */
  exportCanvas(background: ExportBackground = 'transparent', texture = true): HTMLCanvasElement {
    const { dw, dh } = this;
    const px = this.readback(false, MODE[background], texture);
    // displayFS writes PREMULTIPLIED alpha (F1). ImageData / WebP want
    // STRAIGHT alpha — un-premultiply here so the cache bytes match the
    // classic export. Opaque modes (a=255) are a no-op.
    // NOTE: MODE.transparent is OPAQUE transmittance (vec4(t, 1.0)) — the
    // cache stores that and is composited with MULTIPLY over the fond
    // (studio-reopen-paper-washout). Never flatten it to source-over alpha.
    for (let i = 0; i < px.length; i += 4) {
      const a = px[i + 3];
      if (a > 0 && a < 255) {
        px[i] = Math.min(255, Math.round((px[i] * 255) / a));
        px[i + 1] = Math.min(255, Math.round((px[i + 1] * 255) / a));
        px[i + 2] = Math.min(255, Math.round((px[i + 2] * 255) / a));
      }
    }
    const c = document.createElement('canvas');
    c.width = dw; c.height = dh;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(dw, dh);
    const row = dw * 4;
    for (let y = 0; y < dh; y++) img.data.set(px.subarray((dh - 1 - y) * row, (dh - y) * row), y * row);
    ctx.putImageData(img, 0, 0);
    return c;
  }

  /**
   * RULING 2026-11-19 — the COVERAGE channel as an RGBA8 canvas (value in
   * both rgb and alpha), for the acceptance's fade instrument. The mode-4
   * pigment export's alpha is `max(darkAlpha, cover)`, so a dark pigment's
   * darkness masks the true coverage; this reads `cover` directly through
   * `readHalf`. Probe/acoustic only: no draw, no shader, no document target —
   * the render, the exports and every identity digest are untouched.
   */
  exportCoverageCanvas(): HTMLCanvasElement {
    const { g, dw, dh } = this;
    const half = g.readHalf(this.cover.read.fbo, dw, dh, 1);
    const c = document.createElement('canvas');
    c.width = dw; c.height = dh;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(dw, dh);
    for (let y = 0; y < dh; y++) {
      const src = (dh - 1 - y) * dw;   // readHalf rows are bottom-up
      for (let x = 0; x < dw; x++) {
        const v = clamp(fromHalf(half[src + x]!), 0, 1);
        const i = (y * dw + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.round(v * 255);
        img.data[i + 3] = Math.round(v * 255);
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  /* ------------------------------------------------------------------ paper */

  get paperId() { return this.paperPreset.id; }

  /** How strongly the sheet's relief, fibres and flecks show (0: a flat tint, 1: full), on screen and in textured exports. */
  get paperTexture() { return this.paperStrength; }
  set paperTexture(v: number) {
    v = clamp(v, 0, 1);
    if (v === this.paperStrength) return;
    this.paperStrength = v;
    this.redraw();
  }

  /**
   * Set the emboss light (Phase 64, MED-15). Angles are degrees. Azimuth wraps
   * into 0..360, elevation clamps into 0..90 and intensity into 0..4; a
   * non-finite value falls back to the default, and a field the caller omits is
   * left alone. An unchanged value writes nothing and redraws nothing.
   * Render-only: params, the pigment and the thickness field are never
   * touched, and the sheet is never marked dirty for undo (T-64-10).
   */
  setLight(next: Partial<LightSettings>) {
    const azimuth = next.azimuth === undefined ? this.light.azimuth : Number.isFinite(next.azimuth) ? next.azimuth : DEFAULT_LIGHT.azimuth;
    const elevation = next.elevation === undefined ? this.light.elevation : Number.isFinite(next.elevation) ? next.elevation : DEFAULT_LIGHT.elevation;
    const intensity = next.intensity === undefined ? this.light.intensity : Number.isFinite(next.intensity) ? next.intensity : DEFAULT_LIGHT.intensity;
    const resolved: LightSettings = {
      azimuth: ((azimuth % 360) + 360) % 360,
      elevation: clamp(elevation, 0, 90),
      intensity: clamp(intensity, 0, 4),
    };
    if (resolved.azimuth === this.light.azimuth && resolved.elevation === this.light.elevation && resolved.intensity === this.light.intensity) return;
    this.light = resolved;
    this.redraw();
  }

  /** The current emboss light state (Phase 64). A copy: callers cannot mutate the engine. */
  getLight(): LightSettings { return { ...this.light }; }

  /**
   * 64-21: pin the sheet seed (null = roll one per sheet, the pre-64-21 law).
   * The paper grain is render state like the light, but unlike the light it is
   * not reproducible from the document alone — a replay must set it BEFORE the
   * first stroke, and `resetSheet` must never re-roll it, so the seeded grain
   * stays the constant across replays. A non-finite value is treated as absent
   * (clears the pin); an unchanged value writes nothing and redraws nothing; a
   * real change stores the pin, regenerates the sheet and redraws. Params, the
   * pigment and the thickness field are never touched and no target is
   * recreated.
   */
  setPaperSeed(seed: number | null) {
    const pinned = typeof seed === 'number' && Number.isFinite(seed) ? seed : null;
    if (pinned === this.paperSeedPin && (pinned === null || this.paperSeed === pinned)) return;
    this.paperSeedPin = pinned;
    if (pinned === null) return;   // cleared: the sheet in force keeps its seed
    this.paperSeed = pinned;
    this.drawPaper(this.paper, this.paperOrigin, this.paperScale);
    this.redraw();
  }

  /** 64-21: the sheet seed actually in force (the pin, the roll, or a restored snapshot). */
  getPaperSeed(): number { return this.paperSeed; }

  /**
   * Swap the sheet under the painting. Only the paper changes: the paint stays, and
   * granulation and dry brush follow the new tooth from here on.
   */
  setPaper(p: PaperPreset) {
    if (p === this.paperPreset) return;
    this.paperPreset = p;
    this.drawPaper(this.paper, this.paperOrigin, this.paperScale);
    this.redraw();
  }

  /**
   * A preview of a paper at the scale it appears on screen: `w`×`h` device pixels of
   * the sheet with a granulating wash across one corner, as an sRGB canvas.
   */
  paperSwatch(p: PaperPreset, w: number, h: number): HTMLCanvasElement {
    const { gl, g } = this;
    const paper = g.target(w, h, [RGBA8], gl.LINEAR);
    const out = g.target(w, h, [RGBA8], gl.NEAREST);
    // one canvas pixel shows dh / view.h document texels
    this.drawPaper(paper, [w * 0.7, h * 1.3], this.paperScale * (this.dh / this.view.h), p);
    const s = this.programs.paperSwatch;
    s.bind();
    gl.uniform1i(s.u.uPaper, g.bindTex(0, paper.tex[0]));
    this.paperUniforms(s, p, 1);
    g.draw(out);
    const px = new Uint8Array(w * h * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, out.fbo);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    g.disposeTarget(paper);
    g.disposeTarget(out);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) img.data.set(px.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
    ctx.putImageData(img, 0, 0);
    return c;
  }

  /**
   * The sheet alone at `width`×`height` — the fond / thumb source. Same
   * allocation + readPixels tail as `paperSwatch`, but `paperSheetFS`
   * (no ultramarine wash) and the sheet origin + sheet scale law.
   */
  paperSheet(preset: PaperPreset, width: number, height: number, scale = PAPER_UNITS / height): HTMLCanvasElement {
    if (!(width > 0) || !Number.isFinite(width) || !(height > 0) || !Number.isFinite(height)) {
      throw new RangeError(`paperSheet: width and height must be positive and finite (got ${width}×${height})`);
    }
    if (!(scale > 0) || !Number.isFinite(scale)) {
      throw new RangeError(`paperSheet: scale must be positive and finite (got ${scale})`);
    }
    const w = Math.round(width), h = Math.round(height);
    const { gl, g } = this;
    const paper = g.target(w, h, [RGBA8], gl.LINEAR);
    const out = g.target(w, h, [RGBA8], gl.NEAREST);
    this.drawPaper(paper, [0, 0], scale, preset);
    const s = this.programs.paperSheet;
    s.bind();
    gl.uniform1i(s.u.uPaper, g.bindTex(0, paper.tex[0]));
    this.paperUniforms(s, preset, 1);
    g.draw(out);
    const px = new Uint8Array(w * h * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, out.fbo);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    g.disposeTarget(paper);
    g.disposeTarget(out);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) img.data.set(px.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
    ctx.putImageData(img, 0, 0);
    return c;
  }

  /**
   * The height channel of the packed paper texel (paperLightFS: lit, height,
   * mottle, fleck) as `width * height` floats in 0..1 — the bake tooth's field.
   */
  paperHeight(preset: PaperPreset, width: number, height: number, scale = PAPER_UNITS / height): Float32Array {
    if (!(width > 0) || !Number.isFinite(width) || !(height > 0) || !Number.isFinite(height)) {
      throw new RangeError(`paperHeight: width and height must be positive and finite (got ${width}×${height})`);
    }
    if (!(scale > 0) || !Number.isFinite(scale)) {
      throw new RangeError(`paperHeight: scale must be positive and finite (got ${scale})`);
    }
    const w = Math.round(width), h = Math.round(height);
    const { gl, g } = this;
    const paper = g.target(w, h, [RGBA8], gl.LINEAR);
    this.drawPaper(paper, [0, 0], scale, preset);
    const px = new Uint8Array(w * h * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, paper.fbo);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    g.disposeTarget(paper);
    const out = new Float32Array(w * h);
    // y-flip like paperSheet so the height rows sit in canvas order
    for (let y = 0; y < h; y++) {
      const src = (h - 1 - y) * w * 4;
      for (let x = 0; x < w; x++) out[y * w + x] = px[src + x * 4 + 1] / 255;
    }
    return out;
  }

  /** Generate a paper into `t`: `offset` places it on the sheet (texels), `scale` is paper units per texel. */
  drawPaper(t: Target, offset: [number, number], scale: number, preset = this.paperPreset) {
    const { gl, g } = this;
    const field = g.target(t.w, t.h, [HALF_FLOAT_RGBA], gl.NEAREST);
    const f = this.programs.paperField;
    f.bind();
    gl.uniform2f(f.u.uRes, t.w, t.h);
    gl.uniform2f(f.u.uOffset, offset[0], offset[1]);
    gl.uniform1f(f.u.uScale, scale);
    gl.uniform1f(f.u.uSeed, this.paperSeed);
    gl.uniform1i(f.u.uKind, preset.kind);
    g.draw(field);
    const l = this.programs.paperLight;
    l.bind();
    gl.uniform1i(l.u.uField, g.bindTex(0, field.tex[0]));
    gl.uniform2f(l.u.uTexel, 1 / t.w, 1 / t.h);
    // the relief is drawn in paper units, so its slope per texel shrinks as texels get smaller
    gl.uniform1f(l.u.uBump, (preset.bump * 1.4) / scale);
    g.draw(t);
    g.disposeTarget(field);
  }

  private paperUniforms(p: Program, preset: PaperPreset, texture: number) {
    const { gl } = this;
    gl.uniform3fv(p.u.uPaperTint, linearRGB(preset.tint));
    gl.uniform3fv(p.u.uFleckTint, linearRGB(preset.fleck));
    gl.uniform1f(p.u.uMottle, preset.mottle);
    gl.uniform1f(p.u.uTexture, texture);
  }

  setTool(t: Tool) { this.tool = t; this.updateCursor(); }

  setBrush(b: Brush) {
    this.brush = b;
    this.lastAngle = b.rotation === 'fixed' ? b.angle * DEG : b.rotation === 'follow' ? Math.atan2(this.lastDir[1], this.lastDir[0]) + b.angle * DEG : 0;
    this.updateCursor();
  }

  /**
   * quick-261115-oh9: the silhouette a LIFT stroke erases with. The eraser has
   * no texture, but a pen's eraser end lifts while the Brush tool (and its
   * textured brush) is selected — without this the live erase would wear the
   * brush's texture while the committed punch erases the response's own tip.
   * The host sets the untextured counterpart of the selected response; null
   * falls back to the bound brush (an untextured selection needs no override).
   */
  setLiftBrush(b: Brush | null) {
    this.liftBrush = b;
  }

  /**
   * 261027-gh9e: inject native tablet input for hosts where the webview's
   * PointerEvent carries no pen dynamics (macOS tablets often arrive as
   * pointerType 'mouse' / pressure 0). Mirrors the engine-1 host bridge:
   * the sample is used for a 300 ms window while the pointer reports none.
   */
  updateNativePenInput(input: { pressure: number; tiltX?: number; tiltY?: number }): void {
    const pressure = Math.min(1, Math.max(0, Number(input.pressure)));
    if (!Number.isFinite(pressure)) return;
    this.nativePen = { pressure, tiltX: input.tiltX ?? 0, tiltY: input.tiltY ?? 0 };
    this.nativePenAt = this.clock();
  }

  /* ------------------------------------------------------- reference image */

  get hasReference() { return this.ref !== null; }

  /** Width / height of the reference image, or 0 without one. */
  get referenceAspect() { return this.ref?.aspect ?? 0; }

  /**
   * Show `img` under the paint (or remove it with null), fitted to the paper, as one
   * undo step. It survives clearing the paper and is never part of an export.
   */
  setReference(img: ImageBitmap | HTMLCanvasElement | null) {
    const before = this.docState();
    let src: HTMLCanvasElement | null = null;
    if (img) {
      const max = Math.min(MAX_REF_SIDE, this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE) as number);
      // kept on the CPU as well, so the Fill tool can find areas on it (see readReferenceFlat)
      const s = Math.min(1, max / Math.max(img.width, img.height));
      src = document.createElement('canvas');
      src.width = Math.max(1, Math.round(img.width * s)); src.height = Math.max(1, Math.round(img.height * s));
      src.getContext('2d')!.drawImage(img, 0, 0, src.width, src.height);
    }
    this.uploadReference(src);
    if (src) this.fitReference();
    this.recordChange('reference', src ? 'Reference added' : 'Reference removed', before);
    this.redraw();
  }

  /** The reference image as the engine keeps it (downscaled), or null. */
  referenceImage(): HTMLCanvasElement | null { return this.ref?.src ?? null; }

  /** Put `src` on the GPU as the reference (or drop it with null); placement is left alone. */
  private uploadReference(src: HTMLCanvasElement | null) {
    const { gl } = this;
    if (this.ref?.src === src) return;
    if (this.ref) { gl.deleteTexture(this.ref.tex); this.ref = null; }
    if (!src) return;
    const tex = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.ref = { tex, aspect: src.width / src.height, src };
  }

  /** The reference placed as large as fits, centred on the paper. */
  fitReference() {
    if (!this.ref) return;
    const k = this.ref.aspect / this.aspect;   // the image's width / height in uv units
    const w = k > 1 ? 1 : k, h = k > 1 ? 1 / k : 1;
    this.referenceRect = { x: (1 - w) / 2, y: (1 - h) / 2, w, h };
  }

  /**
   * The reference as placed on the paper, at document resolution, over plain white
   * (where it does not cover the paper, and through any transparency). Same layout as
   * readFlat: RGBA8, opaque, row 0 is document y = 0. Null without a reference.
   */
  readReferenceFlat(): Uint8Array | null {
    if (!this.ref) return null;
    const { dw, dh } = this, r = this.refRect;
    const c = document.createElement('canvas');
    c.width = dw; c.height = dh;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, dw, dh);
    // canvas rows run top-down, document uv runs bottom-up
    ctx.drawImage(this.ref.src, r.x * dw, (1 - r.y - r.h) * dh, r.w * dw, r.h * dh);
    const top = ctx.getImageData(0, 0, dw, dh).data;
    const out = new Uint8Array(dw * dh * 4), row = dw * 4;
    for (let y = 0; y < dh; y++) out.set(top.subarray((dh - 1 - y) * row, (dh - y) * row), y * row);
    for (let i = 3; i < out.length; i += 4) out[i] = 255;
    return out;
  }

  get referenceRect(): RefRect { return { ...this.refRect }; }
  set referenceRect(r: RefRect) {
    const c = this.refRect;
    if (r.x === c.x && r.y === c.y && r.w === c.w && r.h === c.h) return;
    this.refRect = { ...r };
    this.redraw();
  }

  get referenceOpacity() { return this.refOpacity; }
  set referenceOpacity(v: number) {
    v = clamp(v, 0, 1);
    if (v === this.refOpacity) return;
    this.refOpacity = v;
    this.redraw();
  }

  /** Does the Fill tool find its areas on the reference (traced) rather than on the paint? */
  referenceForFill = false;

  get referenceVisible() { return this.refVisible; }
  set referenceVisible(v: boolean) { if (v !== this.refVisible) { this.refVisible = v; this.redraw(); } }

  private redraw() { this.dirtyAll = true; this.schedule(); }

  /**
   * Drop every GPU copy of a response's tips — one per texture it can be
   * stamped through (quick-261115-oh9: the cache key is the response id AND the
   * texture, so a response may own several uploaded tips).
   */
  forgetBrush(id: string) {
    const prefix = `${id}|`;
    for (const [key, t] of this.tipTextures) {
      if (key !== id && !key.startsWith(prefix)) continue;
      this.gl.deleteTexture(t);
      this.tipTextures.delete(key);
    }
  }

  /**
   * Drop every uploaded tip (quick-261115-oh9 / WR-02). The mask registry can
   * replace the BYTES under an unchanged id (`registerMask` overwrites,
   * `replaceMaskRegistry` re-seeds on a project open), and this cache keys on
   * the ids alone — so a host that observes a registry change must sweep, or
   * the GPU would keep stamping the pre-change mask while every other cache
   * (chip, footprint) has already repainted.
   */
  clearTipTextures() {
    for (const t of this.tipTextures.values()) this.gl.deleteTexture(t);
    this.tipTextures.clear();
  }

  private tipTexture(b: Brush): WebGLTexture {
    const key = brushTipCacheKey(b);
    let t = this.tipTextures.get(key);
    if (t) return t;
    const { gl } = this;
    t = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    // quick 261116-inu: a mask-backed tip is stored top-down (image order, so
    // the library file opens the right way up in any viewer) but the stamp
    // samples t=1 as the TOP of the dab while texImage2D maps the first data
    // row to t=0. Flip the rows for those tips only — procedural tips are
    // generated in engine order and must keep their exact appearance for every
    // already-recorded stroke.
    const tipSource = b.textureId != null ? tipRowsForUpload(b.tipData, b.tipSize) : b.tipData;
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, b.tipSize, b.tipSize, 0, gl.RED, gl.UNSIGNED_BYTE, tipSource);
    // quick 261116-inu: a 512 mask is heavily minified at small brush sizes, so
    // the coarse mip levels are what keep the stamp from shimmering while the
    // stroke moves. R8 is color-renderable and filterable in core WebGL2 and
    // 512 is a power of two, so no extension is needed (the context is
    // WebGL2-only). Cost: ~349 KB VRAM per distinct (id, textureId) chain.
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.tipTextures.set(key, t);
    return t;
  }

  /**
   * Dry everything and bake the mobile pigment into the paper. `auto` marks the
   * Studio settle-cap fix: a later stroke may reopen it with cancelAutoFix() so
   * wet-on-wet painting still blends. An explicit Dry disarms that reopen even
   * when it cannot start (a fix is already running).
   */
  fix(auto = false): boolean {
    if (!auto) this.autoFix = false;
    if (!this.painted || this.fixTimer > 0) return false;
    this.beginStep('dry', 'Dry');
    // the fixed layer changes here AND at lift() (261028-k03 D1), so both snapshot it
    this.history.protect(1, this.painted, this.fixed.views);
    this.fixTimer = FIX_DURATION;
    this.autoFix = auto;
    // mobile pigment only exists where strokes have been, so only that needs settling
    this.touch(this.painted);
    this.schedule();
    return true;
  }

  /**
   * Reopen a settle-cap fix (Studio): the artist painted again, so the sheet
   * goes back to its wet, blendable state instead of painting over dry paper.
   * No-op unless the last step is an auto fix — an explicit Dry stays permanent.
   */
  cancelAutoFix(): boolean {
    if (!this.autoFix) return false;
    this.autoFix = false;
    if (!this.history.canUndo) return false;
    this.travel('undo');
    return true;
  }

  /** Wipe the paint as one undo step. The sheet (and its grain) stays. */
  clear() {
    this.stroke = null;
    this.restoreStrokePigment();
    this.queue = [];
    if (!this.everPainted && !this.fill) return;   // already blank
    this.beginStep('clear', 'Clear');
    if (this.everPainted) {
      this.history.protect(0, this.everPainted, this.snapshotLayers());
      this.history.protect(1, this.everPainted, this.fixed.views);
    }
    for (const t of this.docTargets()) if (t !== this.paper) this.g.clearTarget(t);
    // 64-24: a wiped sheet is DRY — clearTarget wrote 0, which the field reads
    // as "touched at t = 0"; restore the one-week sentinel.
    this.clearLastTouch();
    // FIX 2c: a wiped sheet no longer carries bristle content.
    this.bristleContent = false;
    this.resetPaintState();
    this.notifyHistory();
    this.schedule();
  }

  /**
   * 261030-v1t: wipe pigment and water while KEEPING the sheet — the replay
   * seam a per-output-frame re-pattern bake needs (the aquarelle sheet is
   * cumulative, so each salted replay must start from the same naked paper).
   *
   * Unlike clear() this is not an undo step: bakes never travel history. It
   * must never re-roll `paperSeed`, redraw the paper or recreate targets — the
   * sheet and its seeded grain are the constant across replays. The caller
   * re-arms the virtual clock and the RNG stream.
   */
  resetSheet() {
    this.stroke = null;
    this.restoreStrokePigment();
    this.queue = [];
    this.dropFill();
    for (const t of this.docTargets()) if (t !== this.paper) this.g.clearTarget(t);
    // 64-24: a wiped sheet is DRY — clearTarget wrote 0, which the field reads
    // as "touched at t = 0"; restore the one-week sentinel.
    this.clearLastTouch();
    // FIX 2c: a wiped sheet no longer carries bristle content.
    this.bristleContent = false;
    this.resetPaintState();
    this.notifyHistory();
  }

  /** Take back the stroke in progress as if it never happened (a touch that became a pinch). */
  abortStroke() {
    const s = this.stroke;
    if (!s) return;
    this.stroke = null;
    this.restoreStrokePigment();
    this.queue = [];
    if (s.pointerId !== SCRIPT_POINTER) this.callbacks.onStrokeTool?.(null);
    if (this.history.canUndo) { this.travel('undo'); this.history.discardRedo(); this.notifyHistory(); }
  }

  undo() { if (this.history.canUndo) this.travel('undo'); }

  redo() { if (this.history.canRedo) this.travel('redo'); }

  /** Undo or redo until `index` steps are applied. */
  jumpTo(index: number) {
    const { index: now, list } = this.history.entries();
    index = clamp(Math.round(index), 0, list.length);
    for (let i = now; i > index && this.history.canUndo; i--) this.travel('undo', false);
    for (let i = now; i < index && this.history.canRedo; i++) this.travel('redo', false);
    this.notifyHistory();
  }

  get canUndo() { return this.history.canUndo; }
  get canRedo() { return this.history.canRedo; }

  /** Step through history in either direction. */
  private travel(dir: 'undo' | 'redo', notify = true) {
    this.autoFix = false;   // the last step is no longer the settle-cap fix
    this.stroke = null;
    this.restoreStrokePigment();
    this.dropFill();
    this.queue = [];
    this.fixTimer = 0;
    const next = dir === 'undo' ? this.history.peekUndo() : this.history.peekRedo();
    const metaNow: StepMeta = this.currentMeta();
    if (next?.boundary) { metaNow.whole = this.captureWhole(); metaNow.paperOrigin = [...this.paperOrigin]; }
    this.sleep();
    const ink = this.ink, wet = this.wet;
    // Pool 0 must mirror allocateHistory()'s formats and snapshotLayers() entry
    // for entry: mobile pigment (A, B), water, then Phase 64's thickness — one
    // framebuffer — 64-24's last-touch pair (the second double-buffered
    // document layer in pool 0) and 64-14's coverage pair, since History.swap
    // reads fbs[0] and writes back to each.
    const layers = [
      [[ink.read.views[0], ink.write.views[0]], [ink.read.views[1], ink.write.views[1]], [wet.read.views[0], wet.write.views[0]], [this.relief.views[0]], [this.lastTouch.read.views[0], this.lastTouch.write.views[0]], [this.cover.read.views[0], this.cover.write.views[0]]],
      [[this.fixed.views[0]], [this.fixed.views[1]]],
    ];
    const res = dir === 'undo' ? this.history.undo(layers, metaNow) : this.history.redo(layers, metaNow);
    if (!res) return;
    const meta = res.meta as StepMeta;
    const now = this.clock();
    if (meta.whole) {
      this.applyWhole(meta.whole, meta.paperOrigin ?? [0, 0]);
      this.painted = meta.painted ? { ...meta.painted } : null;
    }
    if (res.info.kind !== 'paper' && res.info.kind !== 'reference') {
      // the restored water keeps drying from where it was when the step began
      this.lastWet = now - meta.wetAgo;
      this.wetPeak = meta.wetPeak;
      this.active = meta.active ? { ...meta.active } : null;
    }
    if (res.rect) {
      this.dirty = union(this.dirty, res.rect);
      this.painted = union(this.painted, res.rect);
      this.everPainted = union(this.everPainted, res.rect);
    }
    this.applyDocState(meta.doc);
    this.callbacks.onDocumentChange?.(this.docState());
    if (notify) this.notifyHistory();
    this.schedule();
  }

  private notifyHistory() {
    this.seenEvictions = this.history.evictions;
    const { list, index } = this.history.entries();
    this.callbacks.onHistoryChange?.(list, index);
  }

  private currentMeta(): StepMeta {
    return {
      wetAgo: this.clock() - this.lastWet, wetPeak: this.wetPeak,
      active: this.active ? { ...this.active } : null, painted: this.painted ? { ...this.painted } : null,
      doc: this.docState(),
    };
  }

  /**
   * Render the document at full resolution as an image file. The reference image is
   * never included. JPEG has no alpha, so a transparent JPEG is put on white.
   */
  async exportImage(o: ExportOptions): Promise<Blob> {
    const { dw, dh } = this;
    const bg = o.format === 'jpeg' && o.background === 'transparent' ? 'white' : o.background;
    const px = this.readback(false, MODE[bg], o.texture ?? true);
    const c = document.createElement('canvas');
    c.width = dw; c.height = dh;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(dw, dh);
    const row = dw * 4;
    for (let y = 0; y < dh; y++) img.data.set(px.subarray((dh - 1 - y) * row, (dh - y) * row), y * row);
    ctx.putImageData(img, 0, 0);
    const type = `image/${o.format}`;
    return new Promise((resolve, reject) => c.toBlob(b => {
      if (!b) reject(new Error('export failed'));
      else if (b.type !== type) reject(new Error(`This browser cannot save ${o.format.toUpperCase()}`));
      else resolve(b);
    }, type, o.quality));
  }

  /**
   * 64-20 decision A — the capture-time clearance. A dedicated pass at the
   * export boundary (never the interactive displayFS output): the display's own
   * pigment RGBA is the source, and the shared FILM_PRESENCE snippet zeroes the
   * coverage alpha exactly where the final film reads paper-white on the
   * scan's own 8-bit grid. RGB passes through verbatim; every texel the film
   * does not clear is byte-identical.
   */
  private clearPaperWhiteCoverage(target: Target, source: WebGLTexture) {
    const { gl, g } = this;
    const p = this.programs.coverClear;
    p.bind();
    gl.uniform1i(p.u.uSrc, g.bindTex(0, source));
    gl.uniform1i(p.u.uPaper, g.bindTex(1, this.paper.tex[0]));
    gl.uniform1i(p.u.uInkA, g.bindTex(2, this.ink.read.tex[0]));
    gl.uniform1i(p.u.uInkB, g.bindTex(3, this.ink.read.tex[1]));
    gl.uniform1i(p.u.uFixedA, g.bindTex(4, this.fixed.tex[0]));
    gl.uniform1i(p.u.uFixedB, g.bindTex(5, this.fixed.tex[1]));
    // The coverage scope: the live committed field displayFS samples for
    // mode 4's alpha — a Body-0 export carries cov == 0 and passes through.
    gl.uniform1i(p.u.uCover, g.bindTex(6, this.cover.read.tex[0]));
    gl.uniform1f(p.u.uGranulation, this.params.granulation * 0.55);
    gl.disable(gl.BLEND);
    g.draw(target);
  }

  /** The composited document at full resolution as RGBA8 bytes, bottom row first. */
  private readback(flat: boolean, mode: number = MODE.paper, texture = true): Uint8Array {
    const { gl, g, dw, dh } = this;
    const out = g.target(dw, dh, [RGBA8], gl.NEAREST);
    this.drawDisplay(out, { x: 0, y: 0, w: dw, h: dh }, null, flat, mode, texture);
    // 64-20 decision A: the pigment capture is cleared of stale coverage where
    // the final film reads paper-white — a dedicated pass after the display
    // draw, never part of displayFS itself. Every other export mode reads the
    // display's output exactly as before.
    let read = out;
    if (mode === MODE.pigment) {
      read = g.target(dw, dh, [RGBA8], gl.NEAREST);
      this.clearPaperWhiteCoverage(read, out.tex[0]);
    }
    const px = new Uint8Array(dw * dh * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, read.fbo);
    gl.readPixels(0, 0, dw, dh, gl.RGBA, gl.UNSIGNED_BYTE, px);
    g.disposeTarget(out);
    if (read !== out) g.disposeTarget(read);
    return px;
  }

  resize() {
    this.fitCanvas();
    this.schedule();
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.dropFill();
    this.disposers.forEach(d => d());
    this.tipTextures.forEach(t => this.gl.deleteTexture(t));
    this.tipTextures.clear();
    if (this.ref) this.gl.deleteTexture(this.ref.tex);
    this.ref = null;
    this.g.disposeTargets();
  }

  /* ------------------------------------------------------------------ input */

  private toUv(e: { clientX: number; clientY: number }): [number, number] {
    const r = this.canvas.getBoundingClientRect();
    const cx = (e.clientX - r.left) * this.dpr;
    const cy = this.canvasSize[1] - (e.clientY - r.top) * this.dpr;
    return [(cx - this.view.x) / this.view.w, (cy - this.view.y) / this.view.h];
  }

  private attachInput() {
    const c = this.canvas;
    const on = <K extends keyof HTMLElementEventMap>(el: HTMLElement | Window, type: K, fn: (e: HTMLElementEventMap[K]) => void, opts?: AddEventListenerOptions) => {
      el.addEventListener(type, fn as EventListener, opts);
      this.disposers.push(() => el.removeEventListener(type, fn as EventListener, opts));
    };

    on(c, 'pointerdown', e => {
      e.preventDefault();
      if (!this.interactive || this.nav || e.button === 1) return;
      if (this.stroke) return;                       // one stroke at a time (palm rejection)
      if (e.pointerType === 'pen') this.pencilSeen = true;
      try { c.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
      let tool = this.tool;
      if (e.pointerType === 'touch' && this.pencilSeen && this.fingerIsWater) tool = 'water';
      if (e.pointerType === 'pen' && e.buttons & 32) tool = 'lift';          // eraser end
      else if (e.pointerType === 'pen' && e.buttons & 2) tool = tool === 'water' ? 'brush' : 'water'; // barrel button
      this.stroke = {
        pointerId: e.pointerId, pointerType: e.pointerType, tool, started: false, ending: false,
        x: 0, y: 0, cx: 0, cy: 0, pr: 0, t: e.timeStamp, speed: 0, simPressure: 0.45, carry: 0, travelled: 0, moved: false,
        dx: this.lastDir[0], dy: this.lastDir[1], angle: this.lastAngle, azimuth: null,
        widthFrom: 1, widthTo: 1,
        pigFrom: null, pigTo: null,
      };
      if (tool !== this.tool) this.callbacks.onStrokeTool?.(tool);
      this.beginStep('stroke', STROKE_LABEL[tool]);
      this.pushSample(e);
      this.trackHover(e);
      this.schedule();
    });

    on(c, 'pointermove', e => {
      if (e.pointerType === 'pen') this.pencilSeen = true;
      this.trackHover(e);
      if (!this.stroke || e.pointerId !== this.stroke.pointerId) return;
      const events = e.getCoalescedEvents?.() ?? [];
      for (const s of events.length ? events : [e]) {
        // 2026-11-20 (the artist's pen cap): a tablet pen keeps reporting
        // moves after the nib LEAVES the glass — pressure 0, no buttons — and
        // they arrive BEFORE pointerup while the stroke is still open.
        // pushSample's 0 -> 0.5 fallback then painted them, so sweeping the
        // hand away after the intended end stamped an isolated second
        // impression wherever it travelled (the "cap"). No contact means the
        // stroke is over: end it here instead of painting the hover path.
        // The tip button, not pressure, is the contact truth here: WKWebView
        // reports the fixed 0.5 pressure sentinel (and a stale native
        // pressure can linger), but a pen touching the glass always has its
        // tip button held, and a pen in the air never does. This host's
        // tablet events can also arrive as pointerType 'mouse' with native
        // pressure injected (updateNativePenInput), so the guard must cover
        // any tablet input — a pen-only check let the hover path through.
        const tabletInput = s.pointerType === 'pen' || this.pencilSeen
          || (this.nativePenAt > -Infinity && this.clock() - this.nativePenAt < 300);
        if (tabletInput && s.buttons === 0) {
          this.stroke.ending = true;
          break;
        }
        this.pushSample(s);
      }
      this.schedule();
    });

    const end = (e: PointerEvent) => {
      if (!this.stroke || e.pointerId !== this.stroke.pointerId) return;
      this.stroke.ending = true;
      this.schedule();
    };
    on(c, 'pointerup', end);
    on(c, 'pointercancel', end);
    on(c, 'pointerleave', () => { this.hover.inside = false; this.updateCursor(); });
    on(c, 'contextmenu', e => e.preventDefault());
    on(window, 'blur', () => { if (this.stroke) this.stroke.ending = true; });

    // macOS Force Touch trackpads report pressure through a WebKit-only event
    on(c, 'webkitmouseforcechanged' as keyof HTMLElementEventMap, (e: Event) => {
      const f = (e as unknown as { webkitForce?: number }).webkitForce;
      if (typeof f === 'number') this.force = { value: clamp((f - 1) / 1.7, 0.04, 1), t: this.clock() };
    });
  }

  private pushSample(e: PointerEvent) {
    const [x, y] = this.toUv(e);
    let p = -1;
    let tx = e.tiltX || 0;
    let ty = e.tiltY || 0;
    const now = this.clock();
    // 261027-gh9e/gh9f: prefer the host's native tablet sample whenever the
    // PointerEvent reports no real pen pressure. macOS WKWebView sends the
    // fixed 0.5 sentinel (sometimes with a real pointerType 'pen' and tilt), so
    // tilt alone must not disqualify the native sample — the old law kept the
    // constant 0.5 and the pen had almost no dynamic range.
    const nativeActive = this.nativePenAt > -Infinity && now - this.nativePenAt < 300;
    const reportsPenDynamics = e.pointerType === 'pen'
      && e.pressure !== 0.5 && e.pressure !== 0;
    if (nativeActive && this.nativePen && !reportsPenDynamics
      && (e.pointerType !== 'mouse' || e.buttons > 0)) {
      // Raw native pressure: engine-1's law. The old pow(0.8) compressed the
      // low end, which is exactly where the pen's range lives.
      p = this.nativePen.pressure;
      tx = this.nativePen.tiltX;
      ty = this.nativePen.tiltY;
    } else if (e.pointerType === 'pen') {
      p = e.pressure > 0 ? Math.pow(e.pressure, 0.8) : 0.5;
    } else if (e.pointerType === 'mouse' && now - this.force.t < 3000) {
      p = this.force.value;
    }
    // 61-04: pointer strokes carry the neutral factor — the width profile is a
    // recorded-vector channel, and a live hand stroke never has one.
    const sample = { x, y, p, t: e.timeStamp, tx, ty, w: 1 };
    this.queue.push(sample);
    this.callbacks.onStrokeSample?.(sample);
  }

  private trackHover(e: PointerEvent) {
    this.hover.x = e.clientX; this.hover.y = e.clientY;
    this.hover.inside = true; this.hover.type = e.pointerType;
    this.updateCursor();
  }

  private updateCursor() {
    const el = this.cursor;
    if (!el) return;
    if (!this.hover.inside || this.hover.type === 'touch' || !this.interactive || this.nav) { el.style.opacity = '0'; return; }
    const tool = this.stroke?.tool ?? this.tool;
    const r = this.radius(tool, this.stroke ? this.pressureOf(this.stroke, -1) : 0.4, 0);
    const shaped = tool === 'brush' || tool === 'water';
    const b = this.brush;
    const d = Math.max(4, (2 * r * this.view.h) / this.dpr);
    const h = shaped ? Math.max(3, d * b.aspect) : d;
    // doc uv has y up, the screen has y down, so the angle flips
    const angle = shaped && b.rotation !== 'random' ? -(this.stroke?.angle ?? this.lastAngle) : 0;
    el.style.opacity = '1';
    el.style.width = `${d}px`;
    el.style.height = `${h}px`;
    el.style.transform = `translate(${this.hover.x - d / 2}px, ${this.hover.y - h / 2}px) rotate(${angle}rad)`;
    el.style.borderRadius = shaped && b.aspect < 0.6 ? `${h * 0.4}px / 50%` : '50%';
    el.dataset.tool = tool;
  }

  /* -------------------------------------------------------------- strokes */

  /**
   * Footprint multiplier. `widthFactor` (61-04) is the vector profile's
   * per-vertex factor, interpolated along the segment — it multiplies the
   * footprint on top of the scripted-stroke clamp, so it can exceed 1.0
   * where `scriptScale` alone could not (C-03). It is never assigned to
   * `scriptScale`. A factor of 1 (every existing call) is exact.
   */
  private sizeMult(widthFactor = 1) { return Math.pow(3, (this.params.size - 0.5) * 2) * (this.scripting ? this.scriptScale : 1) * widthFactor; }

  /**
   * 61-04: the width factor at `fraction` of the segment being deposited,
   * linearly interpolated from the consumed sample's pair (widthFrom →
   * widthTo) and held at the ends. Always finite; never extrapolated.
   */
  private widthFactorAt(s: Stroke, fraction: number): number {
    const u = clamp(fraction, 0, 1);
    return s.widthFrom + (s.widthTo - s.widthFrom) * u;
  }

  /**
   * 261111-wd6: the pigment at `fraction` of the segment being deposited,
   * linearly interpolated from the consumed sample's pair (pigFrom → pigTo)
   * and held at the ends. Null means no per-sample colour: the dab keeps
   * `this.pigment` (the stroke's base pigment). The interpolation targets ONE
   * scratch pigment — this runs per dab, so it never allocates.
   */
  private pigmentAt(s: Stroke, fraction: number): Pigment | null {
    const from = s.pigFrom;
    const to = s.pigTo;
    if (from === null || to === null) return null;
    if (from === to) return to;
    const u = clamp(fraction, 0, 1);
    const coeffs = this.scratchPigment.coeffs;
    for (let k = 0; k < COEFFS; k++) {
      coeffs[k] = from.coeffs[k]! + (to.coeffs[k]! - from.coeffs[k]!) * u;
    }
    return this.scratchPigment;
  }

  /**
   * 261111-wd6: stamp one dab with the segment's per-sample pigment, then put
   * the base pigment back. The swap is synchronous around the stamp, so a
   * sampled colour never outlives its dab — the next stroke, a bucket fill or
   * the live path always sees the pigment `configure()` installed.
   */
  private stampScripted(
    s: Stroke,
    x: number,
    y: number,
    pr: number,
    vx: number,
    vy: number,
    moving: number,
    dt: number,
    widthFactor: number,
    colorFraction: number,
  ): void {
    const pigment = this.pigmentAt(s, colorFraction);
    if (pigment === null) {
      this.stamp(s, x, y, pr, vx, vy, moving, dt, widthFactor);
      return;
    }
    const previous = this.pigment;
    this.pigment = pigment;
    try {
      this.stamp(s, x, y, pr, vx, vy, moving, dt, widthFactor);
    } finally {
      this.pigment = previous;
    }
  }

  /** Footprint radius in document heights. */
  private radius(tool: Tool, pr: number, speed: number, widthFactor = 1) {
    const m = this.sizeMult(widthFactor);
    switch (tool) {
      case 'pen': return (0.0016 + 0.0042 * pr) * clamp(1.12 - speed * 0.3, 0.55, 1.12) * m;
      case 'brush': return this.brushRadius(pr, speed, widthFactor);
      case 'water': return this.brushRadius(pr, speed, widthFactor) * 1.3 * (1 + Math.min(speed, 2.5) * 0.12);
      case 'lift': return (0.012 + 0.03 * pr) * m;
    }
  }

  /** Half the long axis of the current brush's footprint, in document heights. */
  private brushRadius(pr: number, speed: number, widthFactor = 1) {
    const b = this.brush;
    const t = Math.pow(clamp(pr, 0, 1), b.pressureSize);
    // preset sizes describe the full footprint; 0.8 keeps a hard-pressed stroke on a desktop screen sane
    return (b.size[0] + (b.size[1] - b.size[0]) * t) * clamp(1 - speed * b.speedThin, 0.4, 1) * this.sizeMult(widthFactor) * 0.8;
  }

  /** Tip angle for the next dab, in the document frame. */
  private brushAngle(s: Stroke) {
    const b = this.brush;
    let a: number;
    if (b.rotation === 'random') a = this.rng() * Math.PI * 2;
    else if (b.rotation === 'follow') a = Math.atan2(s.dy, s.dx) + b.angle * DEG;
    else a = s.azimuth ?? b.angle * DEG;
    if (b.angleJitter) a += (this.rng() - 0.5) * 2 * b.angleJitter * DEG;
    s.angle = a;
    if (b.rotation !== 'random') this.lastAngle = a;
    return a;
  }

  private pressureOf(s: Stroke, p: number) { return p >= 0 ? p : s.simPressure; }

  private processInput(dt: number) {
    const s = this.stroke;
    if (!s) return;
    s.moved = false;
    // The tick that starts a stroke already deposits its first dab; a dwell
    // stamp on that same tick is a SECOND impression of the stroke's origin.
    // Live hides it when the first frame drains the pointerdown together with
    // the first moves; the scripted feed (one sample per tick) always exposed
    // it — a texture tip stamped twice at two different radii (quick 261116-rp
    // apply: "the text is doubled"). Resting is a NEXT-tick law.
    const startedThisTick = !s.started;
    const aspect = this.dw / this.dh;
    for (const q of this.queue) {
      // a tilted pen tells us which way it leans; a vertical one tells us nothing
      if (Math.hypot(q.tx, q.ty) > 12) s.azimuth = Math.atan2(-q.ty, q.tx);
      if (!s.started) {
        s.started = true;
        s.x = s.cx = q.x; s.y = s.cy = q.y; s.t = q.t;
        s.pr = this.pressureOf(s, q.p);
        // 61-04: a stroke starts at its own sample's width — there is no
        // preceding segment to ramp from. 261111-wd6 mirrors the pair for
        // the pigment, so the first dab carries its own vertex colour.
        s.widthFrom = s.widthTo = q.w;
        s.pigFrom = s.pigTo = q.pig ?? null;
        this.stampScripted(s, q.x, q.y, s.pr, 0, 0, 1, 0, q.w, 1);
        continue;
      }
      // 61-04: the consumed sample names the width its segment ramps TO; the
      // previous sample's width is where it starts. The pair lives on the
      // stroke only while its segment deposits — the authoritative factor
      // always rode the queued sample. 261111-wd6 mirrors the pair for the
      // per-sample pigment.
      s.widthFrom = s.widthTo;
      s.widthTo = q.w;
      s.pigFrom = s.pigTo;
      s.pigTo = q.pig ?? null;
      const sdt = Math.max(q.t - s.t, 1) / 1000;
      s.t = q.t;
      // light smoothing; mice get a little more than styluses
      const k = s.pointerType === 'mouse' ? 0.5 : 0.65;
      const nx = s.cx + (q.x - s.cx) * k, ny = s.cy + (q.y - s.cy) * k;
      const len = Math.hypot((nx - s.cx) * aspect, ny - s.cy);
      s.speed += (len / sdt - s.speed) * (1 - Math.exp(-sdt * SPEED_SMOOTHING));
      // 2026-11-20 (artist: "impossible to draw at normal speed"): the ported
      // slope (1.18 - 0.95·speed, floor 0.12) was scaled for different speed
      // units — ANY drawing motion is ~3 document heights per second here, so
      // every moving dab landed at the 12 % floor (a nearly invisible body)
      // and only the still start and release reached full pressure: the faint
      // stroke with a block at each end. Gentle slope, real floor: a fast
      // flick keeps a visible wash, a pause still presses.
      const target = clamp(1.05 - s.speed * SIM_PRESSURE_SLOPE, SIM_PRESSURE_FLOOR, 1);
      s.simPressure += (target - s.simPressure) * (1 - Math.exp(-sdt * 6));
      const pr = this.pressureOf(s, q.p);
      const vx = (nx - s.cx) / sdt, vy = (ny - s.cy) / sdt;
      if (s.pointerId === SCRIPT_POINTER) {
        // scripted glyphs keep their corners
        this.trace(s, nx, ny, nx, ny, pr, vx, vy);
      } else {
        // a fast mouse reports sparse samples (~8ms apart, often 50px+); curving through
        // their midpoints keeps the stroke round instead of a visible polyline
        this.trace(s, s.cx, s.cy, (s.cx + nx) / 2, (s.cy + ny) / 2, pr, vx, vy);
      }
      s.cx = nx; s.cy = ny;
      if (len > 0) s.moved = true;
    }
    this.queue = [];
    // the curve trails half a sample behind; catch up once the pointer rests or lifts
    if (s.started && (!s.moved || s.ending) && (s.x !== s.cx || s.y !== s.cy)) {
      // 2026-11-20: a catch-up dab is not followed by a movement dab, so its
      // trailing half is exposed — stamp it as a tentative end impression.
      this.bristleEndCap = true;
      try {
        this.trace(s, s.cx, s.cy, s.cx, s.cy, s.pr, 0, 0);
      } finally {
        this.bristleEndCap = false;
      }
    }
    // resting in place: pigment keeps soaking in, water keeps pooling.
    // 2026-11-20 (artist's end cap): a BRISTLE stroke never dwells — the
    // touch pass lerps a full gather dab every tick, and the classic path's
    // `dwell = dt·8` amount never reaches the bristle coverage, so a pointer
    // resting for a few frames before the lift stamped a solid, unbroken
    // full-width patch at the release. Brush marks are movement-driven.
    const bristleStroke = s.tool === 'brush' && isBristleResponse(this.brush);
    if (!s.moved && s.started && !s.ending && !startedThisTick && !bristleStroke) {
      this.stampScripted(s, s.x, s.y, this.pressureOf(s, -1), 0, 0, 0, dt, this.widthFactorAt(s, 1), 1);
    }
    if (s.ending) {
      this.stroke = null;
      this.restoreStrokePigment();
      if (s.pointerId !== SCRIPT_POINTER) {
        this.callbacks.onStrokeTool?.(null);
        this.callbacks.onStrokeEnd?.(s.tool);
      }
    }
  }

  /**
   * Lay dabs along the quadratic from the stroke's end (s.x, s.y) through control (qx, qy)
   * to (ex, ey), every `spacing` of arc length so deposits don't depend on event rate.
   * Pressure ramps from s.pr to `pr`; direction follows the curve's tangent.
   */
  private trace(s: Stroke, qx: number, qy: number, ex: number, ey: number, pr: number, vx: number, vy: number) {
    const aspect = this.dw / this.dh;
    const x0 = s.x, y0 = s.y, pr0 = s.pr;
    const approx = Math.hypot((qx - x0) * aspect, qy - y0) + Math.hypot((ex - qx) * aspect, ey - qy);
    if (approx < 1e-7) return;
    // 61-04: the width factor ramps from the previous sample's factor to this
    // one's across the segment; spacing derives from the radius it scales, so
    // a wider stroke keeps the same wash density instead of streaking.
    const fine = this.radius(s.tool, Math.max(pr0, pr), s.speed, this.widthFactorAt(s, 1)) * this.spacingFrac(s.tool);
    const n = clamp(Math.ceil(approx / Math.max(fine, 1e-5)), 1, 48);
    let px = x0, py = y0;
    for (let i = 1; i <= n; i++) {
      const u = i / n, w = 1 - u;
      const cx = w * w * x0 + 2 * w * u * qx + u * u * ex;
      const cy = w * w * y0 + 2 * w * u * qy + u * u * ey;
      const dx = (cx - px) * aspect, dy = cy - py;
      const len = Math.hypot(dx, dy);
      const p = pr0 + (pr - pr0) * u;
      const widthAt = this.widthFactorAt(s, u);
      if (len > 1e-5) {
        // direction smoothing scaled by distance, so a jittery stylus doesn't spin a flat brush
        const kd = 1 - Math.exp(-len / (this.radius(s.tool, p, s.speed, widthAt) * 1.5 + 1e-4));
        s.dx += (dx / len - s.dx) * kd; s.dy += (dy / len - s.dy) * kd;
        const m = Math.hypot(s.dx, s.dy) || 1;
        s.dx /= m; s.dy /= m;
        this.lastDir = [s.dx, s.dy];
      }
      const spacing = this.radius(s.tool, p, s.speed, widthAt) * this.spacingFrac(s.tool);
      let pos = 0;
      while (len - pos >= spacing - s.carry) {
        pos += spacing - s.carry;
        s.carry = 0;
        const t = pos / len;
        const fraction = (i - 1 + t) / n;
        this.stampScripted(s, px + (cx - px) * t, py + (cy - py) * t, p, vx, vy, 1, 0, this.widthFactorAt(s, fraction), fraction);
      }
      s.carry += len - pos;
      s.travelled += len;
      px = cx; py = cy;
    }
    s.x = ex; s.y = ey; s.pr = pr;
  }

  /**
   * 2026-11-20 (the artist's large-brush steps; "samples should be
   * proportional to the size of the brush, to not slow down normal size
   * brush"): the brush's dab chain is supersampled with its canonical Size —
   * the 3D motion-supersampling law. The factor is exactly 1 below
   * BRISTLE_SAMPLE_START_PX, so every normal size keeps its validated
   * cadence and pays nothing; the per-dab ink divides by the same factor in
   * `stamp`, so the wash per distance is unchanged.
   */
  private samplingScale(): number {
    return bristleSampleScale(engineScaleToSize(this.params.size));
  }

  /** Dab spacing as a fraction of the footprint radius. */
  private spacingFrac(tool: Tool) {
    const b = this.brush;
    // flat tips need tighter spacing: the footprint is thin across one axis
    const frac = tool === 'brush' || tool === 'water' ? b.spacing * Math.sqrt(b.aspect) : 0.5;
    return tool === 'brush' ? frac / this.samplingScale() : frac;
  }

  /** One dab of the current tool. `moving` = 0 with `dt` set means a dwell. */
  private stamp(s: Stroke, x: number, y: number, pr: number, vx: number, vy: number, moving: number, dt = 0, widthFactor = 1) {
    const P = this.params;
    let r = this.radius(s.tool, pr, s.speed, widthFactor);
    const dwell = moving ? 1 : dt * 8;
    switch (s.tool) {
      case 'brush': {
        const b = this.brush;
        // 64-21 (D-27): compute the bristle predicate ONCE from the active
        // brush. A new stroke object always re-seeds the set; the same stroke
        // never re-seeds (dwells and later dabs reuse it). Non-bristle
        // responses take the shipping path with no extra draw, no extra
        // uniform bind and no extra RNG draw — the identity proof.
        const bristle = isBristleResponse(b);
        if (bristle && this.bristleStroke !== s) {
          this.bristleStroke = s;
          this.beginBristles(r);
        }
        // the brush empties as it travels; a dry brush skips the valleys of the paper
        const reservoir = 0.25 + 0.75 * Math.exp(-s.travelled / ((1.5 + 3 * P.water) * b.capacity));
        const dryness = clamp(b.grain + (1 - b.grain) * clamp((0.5 - reservoir) * 2.5, 0, 1) * 0.6, 0, 1);
        const grainThr = 0.74 - 0.45 * pr - 0.05 * P.water;   // pressing harder reaches into the valleys
        // 261027-gh9f: pressure reaches density much harder than before. At the
        // old 0.6..1.0 band the overlapping dabs saturated the deposit and a
        // light pen looked identical to a hard one.
        const conc = 0.15 * Math.exp(P.load * 2.8) * reservoir * (0.4 + 0.6 * pr) * b.load;
        // spacing / profile integral -> ~conc in the stroke, normalised for sparse tips
        const norm = clamp(Math.sqrt(0.5 / b.tipMean), 0.7, 2.2);
        // The supersampling factor divides the per-dab ink: more, smaller
        // dabs for a big tip, the same wash per distance.
        const amount = conc * Math.min(b.spacing, 1) / 1.8 * norm * dwell / this.samplingScale();
        // Phase 64 (MED-14, the deposit law): thickness is deposited in
        // proportion to the dab's OWN ink amount, scaled by the stroke's emboss.
        // 0 draws nothing at all — no program bind, no blend change, no draw —
        // so the render and the undo history stay untouched at the neutral
        // default (the bit-identity law).
        // Post-UAT: pressure drives the emboss. The floor keeps a light touch
        // readable; full pressure reaches the delivered thickness.
        const embossPress = EMBOSS_PRESS_FLOOR + (1 - EMBOSS_PRESS_FLOOR) * clamp(pr, 0, 1);
        const reliefAmount = P.emboss * amount * RELIEF_GAIN * embossPress;
        // Phase 64 (MED-19..MED-22, spec 06): Body is ORDER. Before a dab
        // deposits, it erodes the settled pigment and the thickness under its
        // own tip. The amount is D-14's one perceptual curve declared in
        // scattering.ts, lifted by COVER_GAIN for the order pass only — the
        // scattering deposit keeps the un-gained curve, so the delivered
        // colours do not move; 0 is inert by construction, so the neutral gate
        // stays byte-identical.
        const coverAmount = Math.min(1, bodyCurve(P.body) * COVER_GAIN);
        // SPIKE 001: the per-dab coverage density is the MEDIUM's, not the
        // pigment's: `1 - exp(-density * mask)` composes across overlapping
        // dabs to the union of the paint film, so a near-white pigment covers
        // as fully as a black one. Body 0 never computes it: the neutral path
        // stays byte-exact.
        const coverDensity = coverAmount > 0 ? COVER_MEDIUM_DENSITY * amount : 0;
        // The thickness keeps the DELIVERED erode law — the un-gained cover
        // amount times RELIEF_ERODE — never the paint opacity. The erode
        // exists to drop the UNDERLAYER's impasto; scaling it with the paint
        // saturates the stroke's own relief away under its overlapping dabs
        // (measured on probe at Body 85: the relief field doubled).
        const coverRelief = coverAmount * RELIEF_ERODE;
        // Post-UAT (GAP-1): on a bristle response Body is NOT an erode at all —
        // it is the paint's opacity, the share of the pixel the deposited film
        // takes over. The deposit lerps the canvas toward the carried colour at
        // the gather's coverage (see bristleInk); this target is what the layer
        // alpha converges to, so it can never run ahead of the paint. Linear on
        // purpose: acrylic (Body 85) must read opaque, and the sixth power stays
        // the non-bristle order curve. The floor keeps Body 0 (the canonical
        // default, and every committed Body-0 gate) depositing paint.
        const bristleBodyAlpha = bristle
          ? BRISTLE_BODY_ALPHA_FLOOR + (1 - BRISTLE_BODY_ALPHA_FLOOR) * clamp(P.body, 0, 1)
          : 0;
        // Spike 004: the bristle carrier and gather read the reference's
        // brush CONTACT pressure (speed- and attack-shaped), not the pointer's
        // — the authored pr still owns the footprint, radius and wet passes.
        const contactPr = bristle
          ? bristleContactPressure(clamp(pr, 0, 1), s.speed, s.travelled * this.dh, this.dh)
          : pr;
        const wet = (0.25 + 0.75 * P.water) * (0.7 + 0.3 * pr) * b.water * (0.4 + 0.6 * reservoir);
        const c = this.pigment.coeffs;
        const c0 = [c[0] * amount, c[1] * amount, c[2] * amount, c[3] * amount];
        const c1 = [c[4] * amount, c[5] * amount, c[6] * amount, scatteringDeposit(P.body, amount)];
        if (coverAmount > 0 || bristle) {
          // Ordering hazard (spec 06): the cover pass runs BEFORE brushInk, so
          // the deposit's own touch() comes too late to restore a relief this
          // pass already eroded. These two protections are the ONLY undo
          // coverage the eroded region gets: they are taken ONCE per stamp,
          // before the first cover draw, on a rect that covers every dab
          // eachDab can produce — the dab radius grown by the largest size
          // jitter and the largest scatter displacement, with the extent the
          // cover draw itself uses. A bristle response reaches `fixed` too
          // (the settled half of the canvas lerp in `bristleInk`), so it
          // takes the same protection.
          const coverRect = this.stampRect(x, y, r * (1 + b.sizeJitter + b.scatter), this.dw, this.dh, 2);
          this.touch(coverRect);
          // 261028-k03 D1 / MED-22: the settled pool is saved the same way
          // lift() saves it — the cover pass (and the bristle lerp) is the
          // second (and only other) path that reaches dry, settled pigment.
          const m = PROTECT_MARGIN;
          this.history.protect(1, { x0: Math.max(0, coverRect.x0 - m), y0: Math.max(0, coverRect.y0 - m), x1: Math.min(this.dw, coverRect.x1 + m), y1: Math.min(this.dh, coverRect.y1 + m) }, this.fixed.views);
        }
        this.eachDab(s, x, y, r, (dx, dy, dr, angle) => {
          // 64-21 (SPIKE 002): the carrier samples the canvas under this dab
          // and updates the reservoirs BEFORE the dab deposits, so it never
          // picks up its own output. It writes only the reservoir pair — no
          // document target — so the displayed render is unchanged.
          // 64-23: `bristleTravel` runs ONCE per dab and its cumulative
          // `alongPx` feeds the carrier's contact noise AND the gather's
          // streak/landing uniforms — calling it twice would double-count the
          // path distance.
          let alongPx = 0;
          if (bristle) {
            const t = this.bristleTravel(dx, dy, dr);
            alongPx = t.alongPx;
            this.carrierPass(dx, dy, dr, angle, t.travel, t.travelPx, t.alongPx, contactPr);
          }
          // spec 06: the cover pass draws here, before this dab's deposit.
          // Post-UAT (GAP-1): a bristle response has NO erode pass at all —
          // Body is the film's opacity inside the one deposit lerp (below), so
          // nothing may dim the underlayer outside the paint that replaces it.
          // Every other response keeps the shipped footprint mask, untouched.
          if (coverAmount > 0 && !bristle) {
            this.coverPass(dx, dy, dr, angle, coverAmount, coverDensity, coverRelief, dryness, grainThr);
          }
          // SPIKE 001: source-over inside the pigment layer, replacing "erase
          // the underlayer, then deposit". No snapshot, no full-document pass,
          // no cached-base punch callback. Body 0 keeps the additive brushInk
          // path unchanged, so the neutral gate stays byte-identical.
          // Post-UAT (GAP-1): a bristle response deposits the five nearest
          // bristles' CARRIED coefficients through the shared gather as the
          // reference's ONE lerp — `canvas <- mix(canvas, carried, coverage)`
          // in coefficient space — and its layer alpha is the same lerp's
          // weight times Body's opacity, so the film and its paint can never
          // disagree. Every other response keeps the shipped chain, untouched.
          if (bristle) this.bristleInk(dx, dy, dr, angle, bristleBodyAlpha, contactPr, c1[3]!, alongPx, this.bristleEndCap);
          else if (coverAmount > 0) this.coverageDeposit(dx, dy, dr, angle, coverAmount, coverDensity, c, c1[3]!, dryness, grainThr);
          else this.brushInk(dx, dy, dr, angle, c0, c1, dryness, grainThr);
          // 64-24 (D-24): the dab records its own touch AFTER depositing and
          // after its one coverage write — the next dab's carrier reads an
          // honest age of the paint it crosses.
          if (bristle) this.bristleTouch(dx, dy, dr, angle, amount);
          if (reliefAmount > 0) this.brushRelief(dx, dy, dr, angle, reliefAmount, dryness, grainThr);
          // soft brushes wet a little beyond the tip; textured ones keep their
          // edges. A waterless brush never wakes the fluid sim at all.
          if (wet > 0) this.brushWet(dx, dy, dr * (1 + 0.12 * b.wetRound), angle, wet, b.wetRound, dryness, grainThr);
        });
        // A waterless brush (dry media) imparts no flow: the velocity splat
        // was stirring the sheet under chalk, making separate strokes blend
        // like a wet medium.
        if (moving && b.water > 0) this.splatVelocity(x, y, r * 1.2, vx, vy, (15 + P.flow * 95) * 0.25 * b.flow);
        break;
      }
      case 'water': {
        const b = this.brush;
        const reservoir = 0.25 + 0.75 * Math.exp(-s.travelled / ((3 + 4 * P.water) * b.capacity));
        const amp = (0.35 + 0.65 * P.water) * (0.5 + 0.5 * pr) * clamp(b.water, 0.6, 1.5) * (0.7 + 0.3 * reservoir);
        const dryness = b.grain * 0.7;
        const grainThr = 0.55 - 0.3 * pr;
        this.eachDab(s, x, y, r, (dx, dy, dr, angle) => {
          this.brushWet(dx, dy, dr, angle, amp, Math.max(b.wetRound, 0.3), dryness, grainThr);
        });
        this.brushNow = { x, y, r };
        if (moving) this.splatVelocity(x, y, r * 1.15, vx, vy, (15 + P.flow * 95) * b.flow);
        else {
          const a = this.rng() * Math.PI * 2, m = (6 + 26 * P.flow) * pr;
          this.splatVelocityRaw(x, y, r * 0.9, Math.cos(a) * m, Math.sin(a) * m);
        }
        break;
      }
      case 'pen': {
        const dens = (0.9 + 1.6 * pr) * clamp(1.25 - s.speed * 0.45, 0.6, 1.25) * (0.5 + P.load);
        const amount = dens * 0.5 / 1.8 * dwell;
        const c = this.pigment.coeffs;
        this.splatInk(x, y, r, [c[0] * amount, c[1] * amount, c[2] * amount, c[3] * amount],
          [c[4] * amount, c[5] * amount, c[6] * amount, scatteringDeposit(P.body, amount)], 2);
        this.splatWet(x, y, r * 2.6, 0.13, 1);   // fresh ink is faintly wet, so it feathers a little
        break;
      }
      case 'lift': {
        // 261028-k03b: strength is a canonical param (lift/100) recorded per
        // stroke, so the live pass, the bake replay and the cached-raster
        // punch share one number. The 0.22 default keeps old strokes exact.
        // 261028-k03c: the tip angle is the same law the brush stamps use —
        // brushAngle already resolves fixed rotation as the sticky pen-tilt
        // azimuth s.azimuth (set in processInput from atan2(-ty, tx) when
        // hypot(tx, ty) > 12) falling back to b.angle * DEG, so the live erase
        // gains the tilt with no extra logic here. The punch and the cursor
        // mirror this exact law.
        const amount = Math.min(0.9, P.lift * dwell);
        this.lift(x, y, r, this.brushAngle(s), amount);
        break;
      }
    }
  }

  /* --------------------------------------------------------------- splats */

  /** Run `fn` for every dab of a stamp: one for most brushes, a scattered burst for spatter. */
  private eachDab(s: Stroke, x: number, y: number, r: number, fn: (x: number, y: number, r: number, angle: number) => void) {
    const b = this.brush;
    const aspect = this.dw / this.dh;
    for (let i = 0; i < b.dabs; i++) {
      let dx = x, dy = y, dr = r;
      if (b.scatter > 0) {
        const a = this.rng() * Math.PI * 2, m = Math.sqrt(this.rng()) * b.scatter * r;
        dx += (Math.cos(a) * m) / aspect; dy += Math.sin(a) * m;
      }
      if (b.sizeJitter > 0) dr *= clamp(1 + (this.rng() * 2 - 1) * b.sizeJitter, 0.15, 2);
      fn(dx, dy, dr, this.brushAngle(s));
    }
  }

  /**
   * Phase 64 (MED-14): every footprint uniform a stamp-family program reads,
   * bound from ONE place. drawStamp (pigment / water) and drawRelief (the
   * thickness deposit) share it, so a tip change can never diverge between the
   * two draws. `b` defaults to the active brush; Lift's erosion passes its own
   * brush and disables roughness / jitter so the mask is exactly the one
   * liftFS erodes pigment with.
   */
  private bindFootprint(p: Program, x: number, y: number, r: number, angle: number, round: number, grain: number, grainThr: number, b: Brush = this.brush, rough: number = b.roughness ?? 0, jitter: number = b.stampJitter ?? 0) {
    const { gl, g } = this;
    gl.uniform1i(p.u.uTip, g.bindTex(0, this.tipTexture(b)));
    gl.uniform1i(p.u.uPaper, g.bindTex(1, this.paper.tex[0]));
    gl.uniform1f(p.u.uAspect, this.dw / this.dh);
    gl.uniform2f(p.u.uPoint, x, y);
    gl.uniform1f(p.u.uRadius, r);
    gl.uniform1f(p.u.uTipAspect, b.aspect);
    // quick 261116-inu: the stroke's recorded rotation (integer degrees) is a
    // tip-space sampling uniform — degrees → radians at the ONE GPU boundary.
    gl.uniform1f(p.u.uTipRotation, (b.textureRotation ?? 0) * DEG);
    gl.uniform2f(p.u.uAxis, Math.cos(angle), Math.sin(angle));
    gl.uniform1f(p.u.uRound, round);
    gl.uniform1f(p.u.uGrain, grain);
    gl.uniform1f(p.u.uGrainThr, grainThr);
    gl.uniform1f(p.u.uRough, rough);
    gl.uniform1f(p.u.uJitter, jitter);
  }

  private drawStamp(t: Target, x: number, y: number, r: number, angle: number, c0: number[], c1: number[], round: number, grain: number, grainThr: number) {
    const { gl, g } = this;
    const b = this.brush;
    const p = this.programs.stamp;
    p.bind();
    this.bindFootprint(p, x, y, r, angle, round, grain, grainThr);
    gl.uniform4fv(p.u.uColor0, c0);
    gl.uniform4fv(p.u.uColor1, c1);
    g.draw(t, this.stampRect(x, y, r, t.w, t.h, Math.sqrt(1 + b.aspect * b.aspect) * 1.02));
  }

  /**
   * Phase 64 (MED-14): draw the thickness deposit (or Lift's erosion) into the
   * relief target with the same footprint the pigment stamp uses. `rect`
   * defaults to the ink dab's rect; Lift passes its own rect with 0/0 grain and
   * 0 roughness / jitter, so the eroded mask matches liftFS exactly.
   */
  private drawRelief(amount: number, x: number, y: number, r: number, angle: number, grain: number, grainThr: number, b: Brush = this.brush, rect = this.stampRect(x, y, r, this.dw, this.dh, 1.5), rough: number = b.roughness ?? 0, jitter: number = b.stampJitter ?? 0) {
    const { gl, g } = this;
    const p = this.programs.relief;
    p.bind();
    this.bindFootprint(p, x, y, r, angle, 0, grain, grainThr, b, rough, jitter);
    gl.uniform1f(p.u.uAmount, amount);
    g.draw(this.relief, rect);
  }

  /** Phase 64 (MED-14): additive per-dab thickness deposit. */
  private brushRelief(x: number, y: number, r: number, angle: number, amount: number, grain: number, grainThr: number) {
    const { gl } = this;
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.FUNC_ADD);
    gl.blendFunc(gl.ONE, gl.ONE);
    this.drawRelief(amount, x, y, r, angle, grain, grainThr);
    gl.disable(gl.BLEND);
  }

  private brushInk(x: number, y: number, r: number, angle: number, c0: number[], c1: number[], grain: number, grainThr: number) {
    const { gl } = this;
    this.touch(this.stampRect(x, y, r, this.dw, this.dh, 1.5));
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.FUNC_ADD);
    gl.blendFunc(gl.ONE, gl.ONE);
    this.drawStamp(this.ink.read, x, y, r, angle, c0, c1, 0, grain, grainThr);
    gl.disable(gl.BLEND);
  }

  /**
   * Phase 64 (MED-19..MED-22, spec 06): the cover pass — per dab, erode the
   * SETTLED pigment and the paint thickness under the dab's own tip, before
   * the dab deposits. One multiplicative draw, no tissue-water step: Body is
   * order, not water.
   *
   * The erase mask is the deposit's own tip-space footprint (rotation, jitter,
   * paper tooth) with the deposit's LOW cut but a WIDE inward ramp, softened
   * before the tip square's cull, and its strength is the SPIKE 001 coverage
   * term `a = coverAmount * (1 - exp(-density * mask))` — the SAME `a` the
   * coverage composite lets the paint film hide. `fixed` loses exactly what
   * the film gains, so the body replaces the settled underlayer while the
   * tip's alpha rim and the bristle gaps keep a partial underlayer (the
   * old/new mix the edge needs).
   * The Body row sits between Viscosity and Emboss (D-07); spec 08's
   * scattering composes on top through the same curve.
   *
   * ONE extra multiplicative draw per dab into two targets that already
   * exist: no new target, no allocation. Undo is NOT taken here: the caller
   * protects both pools once per stamp, before the first call, because the
   * deposit's own undo protection comes too late to save a relief this draw
   * has already eroded.
   */
  private coverPass(x: number, y: number, r: number, angle: number, amount: number, density: number, reliefAmount: number, grain: number, grainThr: number) {
    const { gl, g } = this;
    const p = this.programs.bodyCover;
    p.bind();
    this.bindFootprint(this.programs.bodyCover, x, y, r, angle, 0, grain, grainThr);
    gl.uniform1f(p.u.uAmount, amount);
    gl.uniform1f(p.u.uDensity, density);
    gl.uniform1f(p.u.uShape, 1);
    const rect = this.stampRect(x, y, r, this.dw, this.dh, 2);
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.FUNC_ADD);
    gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_COLOR);
    g.draw(this.fixed, rect);
    // The thickness erodes at the caller's `reliefAmount` — the DELIVERED law,
    // coverAmount x RELIEF_ERODE, LINEAR in the mask (uShape = 0). Scaling it
    // with the paint opacity would erase the stroke's own earlier dabs' relief
    // and flatten the emboss the same Body value is meant to raise.
    gl.uniform1f(p.u.uAmount, reliefAmount);
    gl.uniform1f(p.u.uShape, 0);
    g.draw(this.relief, rect);
    gl.disable(gl.BLEND);
  }

  /**
   * SPIKE 001: the coverage composite — source-over inside the pigment layer,
   * replacing "erase the underlayer, then deposit". Per dab, on one shared
   * footprint rect, three scissored draws:
   *
   *   ink   <- ink * (1 - a) + C * a      (attenuate, then add the masstone)
   *   fixed <- fixed * (1 - a)            (settled underlayer, same a; coverPass)
   *   cover <- cover * (1 - a) + a        (the compositor's layer alpha)
   *
   * `a = amount * (1 - exp(-density * footprintMask))` with `density` the
   * MEDIUM's per-dab density (see COVER_MEDIUM_DENSITY), so coverage is
   * pigment-independent. `C` is this dab's masstone absorbance, so overlapping
   * dabs are idempotent: the colour converges on the chosen pigment instead of
   * summing absorbances (the black drift), and a near-white pigment covers
   * because its coverage does not come from its darkness. No snapshot, no
   * ping-pong, no full-document pass.
   */
  private coverageDeposit(x: number, y: number, r: number, angle: number, amount: number, density: number, coeffs: Float32Array, scatter: number, grain: number, grainThr: number) {
    const { gl, g } = this;
    // Same active/undo/dirty bookkeeping as brushInk: this draw IS the deposit.
    this.touch(this.stampRect(x, y, r, this.dw, this.dh, 1.5));
    const rect = this.stampRect(x, y, r, this.dw, this.dh, 2);
    // 1) mobile ink *= (1 - a) — all seven coefficients and S.
    const c = this.programs.bodyCover;
    c.bind();
    this.bindFootprint(c, x, y, r, angle, 0, grain, grainThr);
    gl.uniform1f(c.u.uAmount, amount);
    gl.uniform1f(c.u.uDensity, density);
    gl.uniform1f(c.u.uShape, 1);
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.FUNC_ADD);
    gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_COLOR);
    g.draw(this.ink.read, rect);
    gl.disable(gl.BLEND);
    // 2) + C * a, with the dab's scattering added to the channel's S.
    const d = this.programs.coverDeposit;
    d.bind();
    this.bindFootprint(d, x, y, r, angle, 0, grain, grainThr);
    gl.uniform4f(d.u.uColor0, coeffs[0]!, coeffs[1]!, coeffs[2]!, coeffs[3]!);
    gl.uniform4f(d.u.uColor1, coeffs[4]!, coeffs[5]!, coeffs[6]!, scatter);
    gl.uniform1f(d.u.uAmount, amount);
    gl.uniform1f(d.u.uDensity, density);
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.FUNC_ADD);
    gl.blendFunc(gl.ONE, gl.ONE);
    g.draw(this.ink.read, rect);
    gl.disable(gl.BLEND);
    // 3) coverage <- a + cover * (1 - a): the union across the stroke's dabs.
    // 64-20: the deposit stays UNGATED. The film-coherence law is the transport
    // gate; gating here read the dab's own transient film (the ink it is still
    // laying down, with the fixed layer already eroded) and measured a partial
    // cover as paper-white mid-stroke — white-over-blue Body 60 lost its whole
    // coverage gain. The census is closed at the capture boundary instead, on
    // the final film (see readback / clearPaperWhiteCoverage).
    const m = this.programs.coverMask;
    m.bind();
    this.bindFootprint(m, x, y, r, angle, 0, grain, grainThr);
    gl.uniform1f(m.u.uAmount, amount);
    gl.uniform1f(m.u.uDensity, density);
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.FUNC_ADD);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    g.draw(this.cover.read, rect);
    gl.disable(gl.BLEND);
  }

  private brushWet(x: number, y: number, r: number, angle: number, amount: number, round: number, grain: number, grainThr: number) {
    const { gl } = this;
    this.touch(this.stampRect(x, y, r, this.dw, this.dh, 1.5));
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.MAX);
    this.drawStamp(this.wet.read, x, y, r, angle, [amount, 0, 0, 0], [0, 0, 0, 0], round, grain, grainThr);
    gl.blendEquation(gl.FUNC_ADD);
    gl.disable(gl.BLEND);
    this.wetPeak = Math.max(this.wetPeak * this.wetDecay(), amount);
    this.lastWet = this.clock();
  }

  /** Rect (in texels of a w×h grid) covered by a stamp of radius r (doc heights). */
  private stampRect(x: number, y: number, r: number, w: number, h: number, extent: number): Rect {
    const e = Math.ceil(r * extent * h) + 2;
    const cx = Math.round(x * w), cy = Math.round(y * h);
    return { x0: clamp(cx - e, 0, w), y0: clamp(cy - e, 0, h), x1: clamp(cx + e, 0, w), y1: clamp(cy + e, 0, h) };
  }

  /* ------------------------------------------------- SPIKE 002: bristles */

  /**
   * 64-21: stroke-start bristle seeding — the count (§4.1), the tufted set
   * (§4.2) and the initial reservoir upload. The only entropy is `this.rng`
   * (the stroke's `traceSeed`), so the set is a pure function of the stroke
   * record and every later dab of the same stroke reuses it.
   *
   * The initial reservoirs are uploaded into the WRITE half and swapped into
   * READ, so the first carrier pass reads them and writes an all-new set.
   * The shape texture is NOT ping-ponged: it carries per-stroke data
   * (radiusScale, touchReach, loadRate, valueJitter), so it is re-uploaded
   * here BEFORE the first carrierPass. That re-seed is exactly what makes the
   * shape target's presence in `docTargets()` safe: a wipe, `resetSheet`,
   * `applyWhole` or a resize may zero or replace it, and no bristle pass runs
   * between that and the next stroke start.
   */
  private beginBristles(radiusValue: number): void {
    const { gl, g } = this;
    // FIX 2c: the sheet now carries bristle content — the display's
    // edge-darkening crispener steps aside (see drawDisplay).
    this.bristleContent = true;
    // §4.1 half-width in document texels (the radius is in doc heights), floor 1.
    const halfWidthPx = Math.max(1, radiusValue * this.dh);
    const count = bristleCount(halfWidthPx);
    const set = makeBristles(count, this.rng);
    this.bristleCount = count;
    this.bristlePrev = null;
    const n = BRISTLE_CAP;
    const a = new Float32Array(n * 4);
    const b = new Float32Array(n * 4);
    const c = new Float32Array(n * 4);
    const sh = new Float32Array(n * 4);
    const pig = this.pigment.coeffs;
    for (let i = 0; i < n; i++) {
      // Rows past `count` mirror the last bristle so a stale texel can never
      // carry old per-stroke data into a new one; the draw stops at `count`.
      const base = Math.min(i, count - 1) * 8;
      const vj = set.data[base + 5]!;
      // §4.2: the palette absorbance at this bristle's value jitter.
      a.set([pig[0]! * vj, pig[1]! * vj, pig[2]! * vj, pig[3]! * vj], i * 4);
      b.set([pig[4]! * vj, pig[5]! * vj, pig[6]! * vj, 1], i * 4);
      // state = (load, across, seed, valueJitter); load starts at this
      // bristle's §4.2 initial charge. Attachment 1's alpha starts at 1 (a
      // fully charged bristle carries the pigment, not the canvas).
      c.set([set.data[base + 6]!, set.data[base]!, set.data[base + 4]!, vj], i * 4);
      // shape = (radiusScale, touchReach, loadRate, spare).
      sh.set([set.data[base + 1]!, set.data[base + 2]!, set.data[base + 3]!, 0], i * 4);
    }
    const a16 = new Uint16Array(n * 4), b16 = new Uint16Array(n * 4);
    const c16 = new Uint16Array(n * 4), sh16 = new Uint16Array(n * 4);
    f32ToF16(a, a16); f32ToF16(b, b16); f32ToF16(c, c16); f32ToF16(sh, sh16);
    g.uploadHalf(this.bristles.write.tex[0]!, 0, 0, 1, n, gl.RGBA, a16);
    g.uploadHalf(this.bristles.write.tex[1]!, 0, 0, 1, n, gl.RGBA, b16);
    g.uploadHalf(this.bristles.write.tex[2]!, 0, 0, 1, n, gl.RGBA, c16);
    g.uploadHalf(this.bristleShape.tex[0]!, 0, 0, 1, n, gl.RGBA, sh16);
    this.bristles.swap();
  }

  /**
   * §3.1 travel: distance since the previous dab, in brush widths AND doc
   * texels. The FIRST dab after a seed is the path's origin — measuring from
   * (0, 0) made its distance its distance from the page corner (hundreds of
   * px): `landed` was 1 on the very first dab and it over-depleted and
   * over-picked-up before it had moved.
   */
  private bristleTravel(x: number, y: number, r: number): { travel: number; travelPx: number; alongPx: number } {
    const prev = this.bristlePrev;
    if (prev === null) {
      this.bristlePrev = { x, y, along: 0 };
      return { travel: 0, travelPx: 0, alongPx: 0 };
    }
    const aspect = this.dw / this.dh;
    const distDoc = Math.hypot((x - prev.x) * aspect, y - prev.y);
    const alongDoc = prev.along + distDoc;
    this.bristlePrev = { x, y, along: alongDoc };
    const travelPx = distDoc * this.dh;
    return {
      travel: travelPx / Math.max(2 * r * this.dh, 1e-3),
      travelPx,
      alongPx: alongDoc * this.dh,
    };
  }

  /**
   * §3.1 carrier pass: one fragment per bristle over the `1 × count` set,
   * three canvas taps, the pickup/refill equilibrium and the load update.
   * Runs before the dab's deposit and writes ONLY the reservoir pair.
   *
   * Eleven textures: the last-touch field's read half arrives on unit 10
   * (64-24 / D-24) and the fragment's §3.4 wetness is the timestamp law on
   * the VIRTUAL clock (`this.clock()`), gated by coverage — the 64-21 proxy
   * survives only as the recorded A/B mode 0.
   */
  private carrierPass(x: number, y: number, r: number, angle: number, travel: number, travelPx: number, alongPx: number, pr: number): void {
    const { gl, g } = this;
    const p = this.programs.bristleCarrier!;
    p.bind();
    // The carrier REPLACES all three attachments outright: never blend.
    gl.disable(gl.BLEND);
    gl.uniform1i(p.u.uPaintA!, g.bindTex(0, this.bristles.read.tex[0]!));
    gl.uniform1i(p.u.uPaintB!, g.bindTex(1, this.bristles.read.tex[1]!));
    gl.uniform1i(p.u.uState!, g.bindTex(2, this.bristles.read.tex[2]!));
    gl.uniform1i(p.u.uShape!, g.bindTex(3, this.bristleShape.tex[0]!));
    gl.uniform1i(p.u.uInkA!, g.bindTex(4, this.ink.read.tex[0]!));
    gl.uniform1i(p.u.uInkB!, g.bindTex(5, this.ink.read.tex[1]!));
    gl.uniform1i(p.u.uFixedA!, g.bindTex(6, this.fixed.tex[0]!));
    gl.uniform1i(p.u.uFixedB!, g.bindTex(7, this.fixed.tex[1]!));
    gl.uniform1i(p.u.uWet!, g.bindTex(8, this.wet.read.tex[0]!));
    gl.uniform1i(p.u.uCover!, g.bindTex(9, this.cover.read.tex[0]!));
    gl.uniform2f(p.u.uPoint!, x, y);
    // The comb is laid ACROSS the stroke. `brushAngle` is the tangent (the
    // tip's major axis); the reference's `uAxis` is the NORMAL — app.js:513
    // computes `atan2(dy, dx) + PI/2`. Binding the tangent here laid every
    // bristle along the travel, so profile/presence/body/colour jitter had no
    // cross-width dimension and the mark was a constant-valued bar.
    gl.uniform2f(p.u.uAxis!, -Math.sin(angle), Math.cos(angle));
    gl.uniform1f(p.u.uRadius!, r);
    gl.uniform1f(p.u.uCount!, this.bristleCount);
    gl.uniform1f(p.u.uTravel!, travel);
    gl.uniform1f(p.u.uTravelPx!, travelPx);
    gl.uniform2f(p.u.uSheet!, this.dw, this.dh);
    gl.uniform1f(p.u.uPressure!, clamp(pr, 0, 1));
    // 64-22 (D-06/D-22): the §6 constant defaults now ride the recorded bag
    // — Pickup and Refill are canonical globals through the ONE mapping, and
    // the fragment keeps its own §3.1 clamps (0.75 pickup, 1 refill).
    // The Pickup knob keeps ONE response curve (pickupResponse) across both
    // laws, so the carrier and the smear are always the same user value.
    gl.uniform1f(p.u.uPickupRate!, this.pickupResponse(this.params.pickup));
    gl.uniform1f(p.u.uRefillRate!, this.params.refill);
    // The reference's whole visible structure (broken dashes, fibre body and
    // the paper threshold winning) only switches on as the per-bristle load
    // falls. At 0.25/doc a full brush needed ~4000 px of travel to empty, so a
    // normal stroke never dried and always deposited a solid bar. `Dry` now
    // owns the rate: 0 = stays wet for the whole stroke, 1 = empties in ~250 px.
    const dryRate = clamp(this.params.dry, 0, 1);
    // Dry maps to the EMPTY DISTANCE, not to the rate. Depletion is a rate
    // (load lost per texel), so a linear rate makes the visible fade position
    // hyperbolic in Dry — the artist read the control as "très logarithmique".
    // Dry 0 must not dry AT ALL ("le dry 0 devrait avoir aucune transition"):
    // 3.0 sheet heights is ~3x the probe stroke, so the mark stays uniform end
    // to end. The 0.55 exponent makes the low end bite: Dry 33 already fades
    // well before the stroke's end. 2026-11-20 (the artist's Dry 100 pass:
    // "I want shorter transition"): the top of the range empties in about
    // half the travel — Dry 100 is 0.30 sheet heights (was 0.62) — while
    // Dry 0 is untouched and the acrylic default (70) moves 1.04 -> 0.78.
    const dryDistance = 3.0 - 2.7 * Math.pow(dryRate, 0.55);
    // Load is the paint in the brush: it scales how far that paint lasts.
    // Load 50 is the calibration (factor 1). Below the midpoint the tank is
    // the visible lever (0.3x at Load 0). Above it, the artist wants Load 100
    // to be a FULL tank — no drying inside a normal stroke — while Load 66
    // still dries: a linear or gently curved factor put 66 and 100 almost on
    // top of each other (both outlasted the stroke). The power law widens
    // that gap without moving Load 50, and no density change is involved
    // (fading the pigment with the tank desaturated the low values).
    const loadParam = clamp(this.params.load, 0, 1);
    const loadFactor = loadParam <= 0.5
      ? 0.3 + 1.4 * loadParam
      : 1.0 + 6.0 * Math.pow((loadParam - 0.5) / 0.5, 3);
    gl.uniform1f(p.u.uDepletion!, (1 / (dryDistance * loadFactor)) / Math.min(this.dw, this.dh));
    const c = this.pigment.coeffs;
    gl.uniform4f(p.u.uPigmentA!, c[0]!, c[1]!, c[2]!, c[3]!);
    gl.uniform3f(p.u.uPigmentB!, c[4]!, c[5]!, c[6]!);
    gl.uniform1f(p.u.uAlongPx!, alongPx);
    // 64-23: the carrier's contact noise reads §5.3's two declared constants
    // — 64-21 hard-coded the spike's numbers here; they now come from
    // `bristles.ts`, so the contact wobble cannot drift from its tested twin.
    gl.uniform1f(p.u.uStreakLen!, BRISTLE_STREAK_LENGTH);
    gl.uniform1f(p.u.uRimContact!, BRISTLE_RIM_CONTACT);
    // 64-24 (D-24): the §3.4 gate — the last-touch field's read half on a
    // free unit, `uNow` on the virtual clock (SECONDS), the recorded tack
    // time, and the A/B mode (1 shipped). No wall clock exists here.
    gl.uniform1i(p.u.uTimes!, g.bindTex(10, this.lastTouch.read.tex[0]!));
    gl.uniform1f(p.u.uNow!, this.nowSec());
    gl.uniform1f(p.u.uWetSeconds!, this.params.wetSeconds);
    gl.uniform1i(p.u.uWetMode!, this.lastTouchMode);
    // 261119-pod FIX 1: the cover gate tops at this floor at Body 0, so the
    // carrier normalises its READ by it — the same ceiling the gather uses.
    gl.uniform1f(p.u.uBodyFloor!, BRISTLE_BODY_ALPHA_FLOOR);
    g.draw(this.bristles.write, { x0: 0, y0: 0, x1: 1, y1: this.bristleCount });
    this.bristles.swap();
  }

  /**
   * 64-22 (SPIKE 002), extended by 64-23: the gather's shared binder — the
   * four reservoir textures (the carrier's own pair, shape at unit 3) and the
   * dab-frame uniforms every gather consumer reads.
   *
   * 64-23: the §4.4 paper height is procedural (`grainHeight`), so the paper
   * sampler is gone and `uGrain` is §6's `BRISTLE_GRAIN` (1.2) — NOT the
   * stroke's Brush.grain, which stays bound to the footprint mask and the
   * dab's own `dryness`. Every other §6 constant rides its OWN declaration
   * from `bristles.ts`: no literal is re-typed here. `alongPx` is the dab's
   * cumulative path distance in document texels; it feeds both the noise
   * phase (`uAlongPx`) and the landing ramp (`uStrokeDistPx`).
   */
  /**
   * 2026-11-20 (artist): the Pickup knob's response curve. The knob drives
   * BOTH laws (the carrier's rate and the §3.3 smear) through this ONE map:
   * a linear knob made 100 % only the reference's drag, but the artist's
   * maximum should read as a wet-on-wet PULL. q -> q·(1 + q²): 0 stays 0,
   * 50 % -> 0.63, 100 % -> 2x the reference's weight. The pinned ceilings
   * (0.75 pickup, BRISTLE_SMEAR_CAP) still clamp the result.
   */
  private pickupResponse(p: number): number {
    const q = clamp(p, 0, 1);
    return q * (1 + q * q);
  }

  private bindGather(p: Program, x: number, y: number, r: number, angle: number, pr: number, alongPx: number, endCap = false): void {
    const { gl, g } = this;
    gl.uniform1i(p.u.uPaintA!, g.bindTex(0, this.bristles.read.tex[0]!));
    gl.uniform1i(p.u.uPaintB!, g.bindTex(1, this.bristles.read.tex[1]!));
    gl.uniform1i(p.u.uState!, g.bindTex(2, this.bristles.read.tex[2]!));
    gl.uniform1i(p.u.uShape!, g.bindTex(3, this.bristleShape.tex[0]!));
    gl.uniform2f(p.u.uPoint!, x, y);
    // Same law as the carrier: the gather's `across` is the stroke NORMAL
    // (the reference's `normalOf(angle)`), never the tangent.
    gl.uniform2f(p.u.uAxis!, -Math.sin(angle), Math.cos(angle));
    gl.uniform1f(p.u.uRadius!, r);
    gl.uniform1f(p.u.uCount!, this.bristleCount);
    gl.uniform1f(p.u.uSheetAspect!, this.dw / this.dh);
    gl.uniform2f(p.u.uSheet!, this.dw, this.dh);
    gl.uniform1f(p.u.uPressure!, clamp(pr, 0, 1));
    gl.uniform1f(p.u.uGrain!, BRISTLE_GRAIN);
    gl.uniform1f(p.u.uSoftness!, gatherSoftness(this.params.feather));
    // Feather is the radial fade, not the band: 0 leaves the coverage alone,
    // 1 dissolves the outer band (the artist's control direction).
    gl.uniform1f(p.u.uFeather!, clamp(this.params.feather, 0, 1));
    gl.uniform1f(p.u.uFeatherReach!, BRISTLE_FEATHER_REACH);
    gl.uniform1f(p.u.uFeatherEdge!, BRISTLE_FEATHER_EDGE);
    gl.uniform1f(p.u.uFeatherCap!, BRISTLE_FEATHER_CAP);
    gl.uniform1f(p.u.uFeatherMin!, BRISTLE_FEATHER_MIN);
    gl.uniform1f(p.u.uCapGain!, BRISTLE_CAP_GAIN);
    // Dry owns the end transition's width (the artist's 2026-11-20 re-range):
    // short at Dry 0, full from BRISTLE_DRY_CAP_FULL (the acrylic default).
    gl.uniform1f(p.u.uDrySpeed!, clamp(this.params.dry, 0, 1));
    gl.uniform1f(p.u.uDryCapFloor!, BRISTLE_DRY_CAP_FLOOR);
    gl.uniform1f(p.u.uDryCapFull!, BRISTLE_DRY_CAP_FULL);
    gl.uniform1f(p.u.uAlongPx!, alongPx);
    gl.uniform1f(p.u.uStrokeDistPx!, alongPx);
    gl.uniform1f(p.u.uHalfWidthPx!, r * this.dh);
    // A catch-up dab has no following dab to cover its trailing half, so its
    // cap fades BOTH halves (the artist's pen end block); 0 keeps a running
    // dab's leading-only cap and its exact core deposit.
    gl.uniform1f(p.u.uEndCap!, endCap ? 1 : 0);
    gl.uniform1f(p.u.uStreak!, BRISTLE_STREAK);
    gl.uniform1f(p.u.uStreakLen!, BRISTLE_STREAK_LENGTH);
    gl.uniform1f(p.u.uStreakShare!, BRISTLE_STREAK_SHARE);
    gl.uniform1f(p.u.uRimContact!, BRISTLE_RIM_CONTACT);
    gl.uniform1f(p.u.uHairs!, BRISTLE_HAIRS);
    gl.uniform1f(p.u.uDryEdge!, BRISTLE_DRY_EDGE);
    gl.uniform1f(p.u.uLanding!, BRISTLE_LANDING);
    // Post-UAT 2026-11-19 (GAP-4): the texture tip composes with the gather.
    // Unit 4 is free (0–3 are the reservoirs); `uTipMix` is 1 only when the
    // brush carries a mask-backed tip, so an untextured bristle stroke never
    // samples the procedural tip and keeps its exact shipped law.
    gl.uniform1i(p.u.uTip!, g.bindTex(4, this.tipTexture(this.brush)));
    gl.uniform1f(p.u.uTipAspect!, this.brush.aspect);
    gl.uniform1f(p.u.uTipRotation!, (this.brush.textureRotation ?? 0) * DEG);
    gl.uniform1f(p.u.uRough!, this.brush.roughness ?? 0);
    gl.uniform1f(p.u.uJitter!, this.brush.stampJitter ?? 0);
    gl.uniform1f(p.u.uTipMix!, this.brush.textureId != null ? 1 : 0);
    // 261119-pod (§3.3): the smear's three sources on the free units 5/6/7 —
    // the pre-dab snapshot's two attachments and the last-touch field. The
    // gather has ONE wetness law, so no A/B mode rides this program. `uSmear`
    // IS the Pickup global (D-A: one knob, two laws, two ceilings enforced in
    // the fragment); the carrier keeps its own bind above.
    gl.uniform1i(p.u.uSnapA!, g.bindTex(5, this.smearCanvas.tex[0]!));
    gl.uniform1i(p.u.uSnapB!, g.bindTex(6, this.smearCanvas.tex[1]!));
    gl.uniform1i(p.u.uTimes!, g.bindTex(7, this.lastTouch.read.tex[0]!));
    gl.uniform1f(p.u.uSmear!, this.pickupResponse(this.params.pickup));
    gl.uniform1f(p.u.uSmearPeriodPx!, BRISTLE_SMEAR_PERIOD_PX);
    gl.uniform1f(p.u.uSmearCap!, BRISTLE_SMEAR_CAP);
    // 2026-11-20: the same-paint gate's reference — the BRUSH's palette, so
    // the drag never weakens as the carried colour drifts toward the canvas.
    const pc = this.pigment.coeffs;
    gl.uniform4f(p.u.uPigmentA!, pc[0]!, pc[1]!, pc[2]!, pc[3]!);
    gl.uniform3f(p.u.uPigmentB!, pc[4]!, pc[5]!, pc[6]!);
    // 261119-pod (Lever 1): the smear's wet gate normalises the snapshot's
    // cover alpha by the Body-0 ceiling, restoring the reference's ~1.0
    // interior wetness. The ceiling travels as a uniform so the shader never
    // re-types the floor the Engine already owns.
    gl.uniform1f(p.u.uBodyFloor!, BRISTLE_BODY_ALPHA_FLOOR);
    gl.uniform1f(p.u.uNow!, this.nowSec());
    gl.uniform1f(p.u.uWetSeconds!, this.params.wetSeconds);
  }

  /**
   * Post-UAT 2026-11-19 (GAP-1/GAP-2) — the bristle deposit is the
   * REFERENCE's one compositing operation, in coefficient space:
   *
   *   ink   <- ink · (1 − a) + carried · a        (att, then add)
   *   S     <- S   · (1 − a) + uScatter · a       (the same weight)
   *   cover <- cover · (1 − a) + α · a            (α = Body's film opacity)
   *
   * `a = gatherBristle(vUv).coverage` — the gather's own deposit weight, the
   * reference's `deposit`. Overlapping dabs therefore CONVERGE on the carried
   * colour instead of summing absorbances: the film's transmittance approaches
   * the paint's, the scattering channel cannot run away to white, and the
   * layer alpha is the very weight the paint moved by (times Body's opacity),
   * so it can never outrun the deposited colour. The erode pass is gone from
   * this path (the caller no longer runs `coverPass` for a bristle response):
   * Body is opacity here, not a mask.
   *
   * Four draws on one shared rect: the attenuation (ZERO, ONE_MINUS_SRC_COLOR
   * — the `coverageDeposit` idiom), the SAME attenuation on the settled pool
   * (the engine's canvas is ink + fixed, so the lerp's canvas half needs both),
   * the carried add (ONE, ONE) and the ONE coverage write (ONE,
   * ONE_MINUS_SRC_ALPHA, with the fragment's own coverage as the weight in the
   * alpha channel). The carried values are the ENGINE's seven absorbance
   * coefficients — averaged in coefficient space by the gather, never RGB
   * (D-28). `uScatter` is the ONE curve's `scatteringDeposit`, evaluated by the
   * caller; no fragment re-derives it.
   */
  private bristleInk(x: number, y: number, r: number, angle: number, bodyAlpha: number, pr: number, scatter: number, alongPx: number, endCap = false): void {
    const { gl, g } = this;
    // Same active/undo/dirty bookkeeping as brushInk and coverageDeposit:
    // this draw IS the deposit, so the rect is touched before anything lands.
    const rect = this.stampRect(x, y, r, this.dw, this.dh, 1.6);
    this.touch(rect);
    // 261119-pod (§3.3): copy the PRE-DAB canvas once, AFTER the rect
    // bookkeeping and BEFORE the first deposit draw, only at Pickup > 0 —
    // Pickup 0 skips the draw entirely and the weight is zero besides.
    if (this.params.pickup > 0) this.bristleSnapshot(rect);
    const d = this.programs.bristleDeposit;
    d.bind();
    this.bindGather(d, x, y, r, angle, pr, alongPx, endCap);
    gl.uniform1f(d.u.uScatter!, scatter);
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.FUNC_ADD);
    // 1) ink *= (1 - a) and S *= (1 - a) — the lerp's first half.
    gl.uniform1i(d.u.uMode!, 1);
    gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_COLOR);
    g.draw(this.ink.read, rect);
    // 1b) The SETTLED half of the same lerp. The reference writes
    //     mix(canvas, carried, deposit) to ONE canvas; the engine's canvas
    //     is ink + fixed, so the settled film is displaced by the SAME
    //     weight — otherwise an opaque stroke could never cover dried paint
    //     (the display's transmittance is ink + fixed). Body does not appear
    //     in this draw: it is paint replacing paint, not order. Undo is the
    //     caller's, exactly as the non-bristle cover pass: `fixed` is
    //     protected once per stamp before the first dab.
    g.draw(this.fixed, rect);
    // 2) + carried * a — the lerp's carried half.
    gl.uniform1i(d.u.uMode!, 0);
    gl.blendFunc(gl.ONE, gl.ONE);
    g.draw(this.ink.read, rect);
    gl.disable(gl.BLEND);
    // 3) cover <- cover*(1 - a) + bodyAlpha*g.alpha*a — ONE write per dab,
    //    the SAME weight as the ink, so the layer alpha tracks its paint.
    //    The lerp's AVERAGING over dabs is the ragged fringe itself (the
    //    artist's 2026-11-20 ruling): a MAX was tried and reverted — it
    //    jumped the channel to the strongest dab, every edge went smooth and
    //    hard, and Feather 0 lost its bristle texture along with Feather 100.
    const c = this.programs.bristleCover;
    c.bind();
    this.bindGather(c, x, y, r, angle, pr, alongPx, endCap);
    gl.uniform1f(c.u.uCoverTarget!, bodyAlpha);
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.FUNC_ADD);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    g.draw(this.cover.read, rect);
    gl.disable(gl.BLEND);
  }

  /**
   * 261119-pod (§3.3) — the pre-dab snapshot. ONE gather-free copy draw over
   * the dab's rect, writing TWO attachments: 0 = inkA + fixedA (absorbance
   * 0..3), 1 = (inkB + fixedB).rgb with the COVER alpha in .a (the
   * reference's `canvas.a`). Five sources on units 0-4. The gather's smear
   * reads this pair; it is never read at Pickup 0 because the caller skips
   * this draw and the fragment's guard skips the samples.
   */
  private bristleSnapshot(rect: Rect): void {
    const { gl, g } = this;
    const p = this.programs.bristleCanvas!;
    p.bind();
    gl.disable(gl.BLEND);
    gl.uniform1i(p.u.uInkA!, g.bindTex(0, this.ink.read.tex[0]!));
    gl.uniform1i(p.u.uInkB!, g.bindTex(1, this.ink.read.tex[1]!));
    gl.uniform1i(p.u.uFixedA!, g.bindTex(2, this.fixed.tex[0]!));
    gl.uniform1i(p.u.uFixedB!, g.bindTex(3, this.fixed.tex[1]!));
    gl.uniform1i(p.u.uCover!, g.bindTex(4, this.cover.read.tex[0]!));
    g.draw(this.smearCanvas, rect);
  }

  /**
   * 64-24 (D-24, §3.4): the touch stamp. One gather-free draw over the dab's
   * rect — the coverage channel this dab just wrote is the weight — mixing
   * the last-touch field toward `uNow` (SECONDS on the virtual clock) in the
   * WRITE half, then swapping the pair. Runs AFTER the deposit and its one
   * coverage write, so the next dab's carrier reads an honest age of the
   * paint it crosses. Texels outside the dab rect keep their age untouched.
   */
  private bristleTouch(x: number, y: number, r: number, angle: number, amount: number): void {
    const { gl, g } = this;
    // `angle` is accepted for signature symmetry with bristleInk: the touch
    // rect is the dab's axis-aligned stamp at the SAME extent (1.6).
    void angle;
    const t = this.programs.bristleTouch!;
    const rect = this.stampRect(x, y, r, this.dw, this.dh, 1.6);
    t.bind();
    gl.disable(gl.BLEND);
    gl.uniform1i(t.u.uTimes!, g.bindTex(0, this.lastTouch.read.tex[0]!));
    gl.uniform1i(t.u.uCover!, g.bindTex(1, this.cover.read.tex[0]!));
    gl.uniform1f(t.u.uNow!, this.nowSec());
    gl.uniform1f(t.u.uAmount!, amount);
    g.draw(this.lastTouch.write, rect);
    this.lastTouch.swap();
  }

  /**
   * 64-21: the three reservoir attachments, concatenated as half floats
   * (1 × BRISTLE_CAP RGBA each) — the probe's and the tests' window into the
   * per-bristle state. Order matches the reservoir layout documented in
   * `bristleCarrierFS`: carried 0..3, carried 4..6 + alpha, load/across/seed/jitter.
   */
  readBristles(): Uint16Array {
    const a = this.g.readHalf(this.bristles.read.views[0]!, 1, BRISTLE_CAP, 4);
    const b = this.g.readHalf(this.bristles.read.views[1]!, 1, BRISTLE_CAP, 4);
    const c = this.g.readHalf(this.bristles.read.views[2]!, 1, BRISTLE_CAP, 4);
    const out = new Uint16Array(a.length + b.length + c.length);
    out.set(a, 0);
    out.set(b, a.length);
    out.set(c, a.length + b.length);
    return out;
  }

  /**
   * Grow the simulated region. With `save`, the tiles around `rect` are saved for undo
   * first: a step restores what its own dabs and fills touched (plus a margin for what
   * spread from them), while the rest of the sheet simply keeps drying. That keeps a
   * step's cost proportional to the stroke, not to everything that happens to be wet.
   */
  private touch(rect: Rect, wake = true, save = true) {
    if (rect.x1 <= rect.x0 || rect.y1 <= rect.y0) return;
    const next = union(this.active, rect);
    if (save) {
      const m = PROTECT_MARGIN;
      this.history.protect(0, { x0: Math.max(0, rect.x0 - m), y0: Math.max(0, rect.y0 - m), x1: Math.min(this.dw, rect.x1 + m), y1: Math.min(this.dh, rect.y1 + m) }, this.snapshotLayers());
    }
    this.active = next;
    this.painted = union(this.painted, rect);
    this.everPainted = union(this.everPainted, rect);
    this.dirty = union(this.dirty, rect);
    if (wake) this.minAwakeUntil = Math.max(this.minAwakeUntil, this.clock() + 250);
  }

  private snapshotLayers() {
    // Positionally paired with allocateHistory()'s pool-0 formats and travel()'s
    // layer map (64-24 adds the last-touch read half as the FIFTH entry and
    // 64-14's coverage stays the SIXTH and last). The three lists grow together
    // or the history atlas copies the wrong layer.
    return [this.ink.read.views[0], this.ink.read.views[1], this.wet.read.views[0], this.relief.views[0], this.lastTouch.read.views[0], this.cover.read.views[0]];
  }

  private drawSplat(t: Target, x: number, y: number, r: number, c0: number[], c1: number[], hardness: number, extent: number) {
    const { gl, g } = this;
    const p = this.programs.splat;
    p.bind();
    gl.uniform1f(p.u.uAspect, t.w / t.h);
    gl.uniform2f(p.u.uPoint, x, y);
    gl.uniform1f(p.u.uRadius, r);
    gl.uniform1f(p.u.uHardness, hardness);
    gl.uniform4fv(p.u.uColor0, c0);
    gl.uniform4fv(p.u.uColor1, c1);
    g.draw(t, this.stampRect(x, y, r, t.w, t.h, extent));
  }

  private splatInk(x: number, y: number, r: number, c0: number[], c1: number[], hardness: number) {
    const { gl } = this;
    const extent = hardness > 1.4 ? 2.2 : 3.2;
    this.touch(this.stampRect(x, y, r, this.dw, this.dh, extent));
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.FUNC_ADD);
    gl.blendFunc(gl.ONE, gl.ONE);
    this.drawSplat(this.ink.read, x, y, r, c0, c1, hardness, extent);
    gl.disable(gl.BLEND);
  }

  private splatWet(x: number, y: number, r: number, amount: number, hardness: number) {
    const { gl } = this;
    const extent = hardness > 1.4 ? 2.2 : 3.2;
    this.touch(this.stampRect(x, y, r, this.dw, this.dh, extent));
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.MAX);
    this.drawSplat(this.wet.read, x, y, r, [amount, 0, 0, 0], [0, 0, 0, 0], hardness, extent);
    gl.blendEquation(gl.FUNC_ADD);
    gl.disable(gl.BLEND);
    this.wetPeak = Math.max(this.wetPeak * this.wetDecay(), amount);
    this.lastWet = this.clock();
  }

  private splatVelocity(x: number, y: number, r: number, vx: number, vy: number, force: number) {
    let fx = vx * force, fy = vy * force;
    const m = Math.hypot(fx, fy), vmax = 240;
    if (m > vmax) { fx *= vmax / m; fy *= vmax / m; }
    this.flowSpeed = Math.max(this.flowSpeed, Math.min(m, vmax));
    this.splatVelocityRaw(x, y, r, fx, fy);
  }

  private splatVelocityRaw(x: number, y: number, r: number, fx: number, fy: number) {
    const { gl } = this;
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.FUNC_ADD);
    gl.blendFunc(gl.ONE, gl.ONE);
    this.drawSplat(this.velocity.read, x, y, r, [fx, fy, 0, 0], [0, 0, 0, 0], 1, 3);
    gl.disable(gl.BLEND);
  }

  private lift(x: number, y: number, r: number, angle: number, amount: number) {
    const { gl, g } = this;
    const b = this.liftBrush ?? this.brush;
    const rect = this.stampRect(x, y, r, this.dw, this.dh, 2);
    this.touch(rect);
    // 261028-k03 D1: Lift is the ONE tool that also reaches fixed pigment, so the
    // fixed pool is saved before the fixed draw (same per-dab margin as the mobile tiles).
    const m = PROTECT_MARGIN;
    this.history.protect(1, { x0: Math.max(0, rect.x0 - m), y0: Math.max(0, rect.y0 - m), x1: Math.min(this.dw, rect.x1 + m), y1: Math.min(this.dh, rect.y1 + m) }, this.fixed.views);
    const p = this.programs.lift;
    p.bind();
    // 261028-k03c: the tip footprint binds exactly like drawStamp — the same
    // tip texture, aspect and angle the brush stamps use. uRound = 0 shaves
    // the silhouette to the tip's contour (the punch's LIFT_TIP_ROUND mirrors
    // this constant).
    gl.uniform1i(p.u.uTip, g.bindTex(0, this.tipTexture(b)));
    gl.uniform1f(p.u.uAspect, this.dw / this.dh);
    gl.uniform2f(p.u.uPoint, x, y);
    gl.uniform1f(p.u.uRadius, r);
    gl.uniform1f(p.u.uTipAspect, b.aspect);
    // quick 261116-inu: the lift brush falls back to this.brush, so the same
    // expression covers the punch's own tip and a textured brush's eraser end.
    gl.uniform1f(p.u.uTipRotation, (b.textureRotation ?? 0) * DEG);
    gl.uniform2f(p.u.uAxis, Math.cos(angle), Math.sin(angle));
    gl.uniform1f(p.u.uRound, 0);
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.FUNC_ADD);
    gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_COLOR);
    gl.uniform1f(p.u.uAmount, amount);
    g.draw(this.ink.read, rect);
    gl.uniform1f(p.u.uAmount, amount * 0.8);   // the tissue soaks up water too
    g.draw(this.wet.read, rect);
    gl.uniform1f(p.u.uAmount, amount);
    g.draw(this.fixed, rect);
    // 64-14: coverage is destroyed by Lift like paint and the thickness. The
    // same rect, the same amount last written above and the same ZERO /
    // ONE_MINUS_SRC_COLOR pair are exactly what liftFS erodes with, and the
    // pool-0 protection taken at the top of lift() is what makes it undoable.
    g.draw(this.cover.read, rect);
    // fixed pigment is dry by definition — no tissue water factor, the full amount.
    // Declared consequence: an explicit Dry is permanent for every tool except Lift.
    // Phase 64 (MED-14): thickness is destroyed by Lift like paint — the same
    // rect and the same amount under the ZERO / ONE_MINUS_SRC_COLOR pair still
    // bound here. Grain, roughness and jitter are off, so the eroded mask is
    // exactly the one liftFS erodes pigment with. Spec 06's cover pass reuses
    // this same draw with its own footprint.
    this.drawRelief(amount, x, y, r, angle, 0, 0, b, rect, 0, 0);
    gl.disable(gl.BLEND);
    // After the draw, so the preview observes exactly the dab the engine applied.
    this.callbacks.onLiftDab?.(x, y, r, amount, angle);
  }

  /* ----------------------------------------------------------- simulation */

  private dryTau() { return this.fixTimer > 0 ? 0.25 : 2 + (1 - this.params.dry) * 16; }

  private wetDecay() { return Math.exp(-(this.clock() - this.lastWet) / 1000 / this.dryTau()); }

  /** Time (ms) until standing water everywhere has dried below the threshold. */
  private wetUntil() {
    if (this.wetPeak <= WET_THRESHOLD) return this.lastWet;
    return this.lastWet + this.dryTau() * Math.log(this.wetPeak / WET_THRESHOLD) * 1000;
  }

  private beginStep(kind: StepKind, label: string) {
    this.dropFill();   // a new action ends a running fill; its remaining bands never land in this step
    this.autoFix = false;   // any newer action makes the settle-cap fix permanent
    this.history.begin({ kind, label }, this.currentMeta());
    this.notifyHistory();
  }

  private step(dt: number) {
    const { gl, g, programs: P } = this;
    const fixing = this.fixTimer > 0;
    if (fixing) {
      this.fixTimer -= dt;
      if (this.fixTimer <= 0) {
        // everything has flash-dried: let the sim sleep so the next stroke starts
        // from a small active region (and a small undo snapshot)
        this.wetPeak = 0;
        this.minAwakeUntil = 0;
        this.painted = null;
      }
    }
    const vel = this.velocity;
    const simTexel = [1 / vel.w, 1 / vel.h];
    const texel = [1 / this.dw, 1 / this.dh];
    const flow = this.params.flow;
    const viscosity = this.params.viscosity;
    const rect = this.active!;

    P.advectVelocity.bind();
    gl.uniform1i(P.advectVelocity.u.uVelocity, g.bindTex(0, vel.read.tex[0]));
    gl.uniform1i(P.advectVelocity.u.uWet, g.bindTex(1, this.wet.read.tex[0]));
    gl.uniform2fv(P.advectVelocity.u.uTexel, simTexel);
    gl.uniform1f(P.advectVelocity.u.uDt, dt);
    gl.uniform1f(P.advectVelocity.u.uDissipation, Math.exp(-dt * (3.0 - flow * 2.4 + viscosity * 12.0)) * (fixing ? Math.exp(-dt * 7) : 1));
    g.draw(vel.write); vel.swap();

    P.curl.bind();
    gl.uniform1i(P.curl.u.uVelocity, g.bindTex(0, vel.read.tex[0]));
    gl.uniform2fv(P.curl.u.uTexel, simTexel);
    g.draw(this.curl);

    P.vorticity.bind();
    gl.uniform1i(P.vorticity.u.uVelocity, g.bindTex(0, vel.read.tex[0]));
    gl.uniform1i(P.vorticity.u.uCurl, g.bindTex(1, this.curl.tex[0]));
    gl.uniform2fv(P.vorticity.u.uTexel, simTexel);
    gl.uniform1f(P.vorticity.u.uCurlAmount, 4 + flow * 22);
    gl.uniform1f(P.vorticity.u.uDt, dt);
    g.draw(vel.write); vel.swap();

    P.divergence.bind();
    gl.uniform1i(P.divergence.u.uVelocity, g.bindTex(0, vel.read.tex[0]));
    gl.uniform2fv(P.divergence.u.uTexel, simTexel);
    g.draw(this.divergence);

    P.scale.bind();
    gl.uniform1i(P.scale.u.uTex, g.bindTex(0, this.pressure.read.tex[0]));
    gl.uniform1f(P.scale.u.uValue, 0.8);
    g.draw(this.pressure.write); this.pressure.swap();

    P.pressure.bind();
    gl.uniform1i(P.pressure.u.uDivergence, g.bindTex(1, this.divergence.tex[0]));
    gl.uniform2fv(P.pressure.u.uTexel, simTexel);
    for (let i = 0; i < PRESSURE_ITERATIONS; i++) {
      gl.uniform1i(P.pressure.u.uPressure, g.bindTex(0, this.pressure.read.tex[0]));
      g.draw(this.pressure.write); this.pressure.swap();
    }

    P.gradient.bind();
    gl.uniform1i(P.gradient.u.uPressure, g.bindTex(0, this.pressure.read.tex[0]));
    gl.uniform1i(P.gradient.u.uVelocity, g.bindTex(1, vel.read.tex[0]));
    gl.uniform2fv(P.gradient.u.uTexel, simTexel);
    g.draw(vel.write); vel.swap();

    // water: dries on a timescale set by the DRY slider (flash-dries while fixing)
    P.advectWet.bind();
    gl.uniform1i(P.advectWet.u.uVelocity, g.bindTex(0, vel.read.tex[0]));
    gl.uniform1i(P.advectWet.u.uWet, g.bindTex(1, this.wet.read.tex[0]));
    gl.uniform2fv(P.advectWet.u.uSimTexel, simTexel);
    gl.uniform2fv(P.advectWet.u.uTexel, texel);
    gl.uniform1f(P.advectWet.u.uDt, dt);
    gl.uniform1f(P.advectWet.u.uDecay, Math.exp(-dt / this.dryTau()));
    gl.uniform1f(P.advectWet.u.uSpread, 0.12 * (1 - viscosity * 0.9));
    g.draw(this.wet.write, rect); this.wet.swap();

    // fixing: mobile pigment (and its scattering) settles into the paper
    const settle = fixing ? 1 - Math.exp(-dt * 5) : 0;
    if (fixing) {
      gl.enable(gl.BLEND);
      gl.blendEquation(gl.FUNC_ADD);
      gl.blendFunc(gl.ONE, gl.ONE);
      P.settle.bind();
      gl.uniform1i(P.settle.u.uInkA, g.bindTex(0, this.ink.read.tex[0]));
      gl.uniform1i(P.settle.u.uInkB, g.bindTex(1, this.ink.read.tex[1]));
      gl.uniform1f(P.settle.u.uSettle, settle);
      g.draw(this.fixed, rect);
      gl.disable(gl.BLEND);
    }

    // pigment: flows, bleeds and gathers at drying edges, only where wet
    const p = P.advectInk;
    p.bind();
    gl.uniform1i(p.u.uVelocity, g.bindTex(0, vel.read.tex[0]));
    gl.uniform1i(p.u.uInkA, g.bindTex(1, this.ink.read.tex[0]));
    gl.uniform1i(p.u.uInkB, g.bindTex(2, this.ink.read.tex[1]));
    gl.uniform1i(p.u.uWet, g.bindTex(3, this.wet.read.tex[0]));
    gl.uniform2fv(p.u.uSimTexel, simTexel);
    gl.uniform2fv(p.u.uTexel, texel);
    gl.uniform1f(p.u.uDt, dt);
    gl.uniform1f(p.u.uBleed, this.params.bleed);
    gl.uniform1f(p.u.uEdge, this.params.edge * 1.4);
    gl.uniform1f(p.u.uAspect, this.dw / this.dh);
    gl.uniform1f(p.u.uKeep, 1 - settle);
    gl.uniform3f(p.u.uBrush, this.brushNow.x, this.brushNow.y, this.brushNow.r);
    g.draw(this.ink.write, rect); this.ink.swap();

    // 64-14: coverage advects with the pigment — the same mobility gate, back-
    // trace and four face fluxes, on its single channel, into the cover pair.
    // No keep factor: settlement must never reduce coverage (a dried white
    // film keeps its opacity). Units 0/1/2 are free here — the ink advect's
    // bindings belonged to its own program.
    //
    // 64-20: units 3-7 carry the combined film the gate reconstructs. The ink
    // leaves are read AFTER its swap, so this is the post-advect mobile layer
    // plus the single fixed target — the exact film displayFS reconstructs —
    // and the paper is read with the display's own granulation literal.
    P.advectCover.bind();
    gl.uniform1i(P.advectCover.u.uVelocity, g.bindTex(0, vel.read.tex[0]));
    gl.uniform1i(P.advectCover.u.uCover, g.bindTex(1, this.cover.read.tex[0]));
    gl.uniform1i(P.advectCover.u.uWet, g.bindTex(2, this.wet.read.tex[0]));
    gl.uniform1i(P.advectCover.u.uInkA, g.bindTex(3, this.ink.read.tex[0]));
    gl.uniform1i(P.advectCover.u.uInkB, g.bindTex(4, this.ink.read.tex[1]));
    gl.uniform1i(P.advectCover.u.uFixedA, g.bindTex(5, this.fixed.tex[0]));
    gl.uniform1i(P.advectCover.u.uFixedB, g.bindTex(6, this.fixed.tex[1]));
    gl.uniform1i(P.advectCover.u.uPaper, g.bindTex(7, this.paper.tex[0]));
    gl.uniform2fv(P.advectCover.u.uSimTexel, simTexel);
    gl.uniform2fv(P.advectCover.u.uTexel, texel);
    gl.uniform1f(P.advectCover.u.uDt, dt);
    gl.uniform1f(P.advectCover.u.uBleed, this.params.bleed);
    gl.uniform1f(P.advectCover.u.uEdge, this.params.edge * 1.4);
    gl.uniform1f(P.advectCover.u.uAspect, this.dw / this.dh);
    gl.uniform1f(P.advectCover.u.uGranulation, this.params.granulation * 0.55);
    gl.uniform3f(P.advectCover.u.uBrush, this.brushNow.x, this.brushNow.y, this.brushNow.r);
    g.draw(this.cover.write, rect); this.cover.swap();

    this.dirty = union(this.dirty, rect);
  }

  /**
   * The active rect grows blindly each frame so the wet front can creep; left alone it
   * would cover the sheet in a minute, and every undo step would have to save all of
   * it. Now and then, find where there is actually water and cut the rect down to that.
   */
  private trimActive() {
    const a = this.active;
    if (!a) return;
    const { gl, g } = this;
    const m = this.wetMask;
    const p = this.programs.wetMask;
    p.bind();
    gl.uniform1i(p.u.uWet, g.bindTex(0, this.wet.read.tex[0]));
    gl.uniform2f(p.u.uBlock, 1 / m.w, 1 / m.h);
    gl.uniform1f(p.u.uThreshold, WET_THRESHOLD);
    g.draw(m);
    gl.bindFramebuffer(gl.FRAMEBUFFER, m.fbo);
    gl.readPixels(0, 0, m.w, m.h, gl.RGBA, gl.UNSIGNED_BYTE, this.maskPixels);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    let x0 = m.w, y0 = m.h, x1 = -1, y1 = -1;
    const px = this.maskPixels;
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      if (!px[(y * m.w + x) * 4]) continue;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    let next: Rect | null = null;
    if (x1 >= 0) {
      const wet = {
        x0: Math.max(0, x0 * MASK_BLOCK - MASK_MARGIN), y0: Math.max(0, y0 * MASK_BLOCK - MASK_MARGIN),
        x1: Math.min(this.dw, (x1 + 1) * MASK_BLOCK + MASK_MARGIN), y1: Math.min(this.dh, (y1 + 1) * MASK_BLOCK + MASK_MARGIN),
      };
      const r = { x0: Math.max(a.x0, wet.x0), y0: Math.max(a.y0, wet.y0), x1: Math.min(a.x1, wet.x1), y1: Math.min(a.y1, wet.y1) };
      if (r.x1 > r.x0 && r.y1 > r.y0) next = r;
    }
    if (next && next.x0 === a.x0 && next.y0 === a.y0 && next.x1 === a.x1 && next.y1 === a.y1) return;
    // the part being dropped was updated into alternating halves: make them agree before it is left alone
    const w = a.x1 - a.x0, h = a.y1 - a.y0;
    for (const d of [this.ink, this.wet])
      d.read.views.forEach((v, i) => g.blit(v, a.x0, a.y0, d.write.views[i], a.x0, a.y0, w, h));
    if (next) this.active = next; else this.sleep();
  }

  /** Make both halves of the ping-pong buffers identical, then stop simulating. */
  private sleep() {
    const rect = this.active;
    if (rect) {
      const { g } = this;
      const w = rect.x1 - rect.x0, h = rect.y1 - rect.y0;
      for (const d of [this.ink, this.wet])
        d.read.views.forEach((v, i) => g.blit(v, rect.x0, rect.y0, d.write.views[i], rect.x0, rect.y0, w, h));
    }
    for (const d of [this.velocity, this.pressure]) { this.g.clearTarget(d.read); this.g.clearTarget(d.write); }
    this.active = null;
    this.wetPeak = 0;
    this.flowSpeed = 0;
  }

  /* -------------------------------------------------------------- display */

  private drawDisplay(target: Target | null, view: { x: number; y: number; w: number; h: number }, scissor: Rect | null, flat = false, mode: number = MODE.screen, texture = true) {
    const { gl, g } = this;
    const p = this.programs.display;
    p.bind();
    gl.uniform1i(p.u.uInkA, g.bindTex(0, this.ink.read.tex[0]));
    gl.uniform1i(p.u.uInkB, g.bindTex(1, this.ink.read.tex[1]));
    gl.uniform1i(p.u.uFixedA, g.bindTex(2, this.fixed.tex[0]));
    gl.uniform1i(p.u.uFixedB, g.bindTex(3, this.fixed.tex[1]));
    gl.uniform1i(p.u.uWet, g.bindTex(4, this.wet.read.tex[0]));
    gl.uniform1i(p.u.uPaper, g.bindTex(5, this.paper.tex[0]));
    gl.uniform4f(p.u.uView, view.x, view.y, view.w, view.h);
    gl.uniform2f(p.u.uTexel, 1 / this.dw, 1 / this.dh);
    gl.uniform1f(p.u.uGranulation, this.params.granulation * 0.55);
    // FIX 2c: 0.8 is the pen-work edge crispener. It is baked into the eight
    // identity baselines, all non-bristle, so those keep exactly 0.8; a sheet
    // with bristle content turns it OFF (0), letting a bristle edge read as
    // the real 50 % → 10 % fade the gather's softness band produces.
    gl.uniform1f(p.u.uEdgeDarken, this.bristleContent ? 0 : 0.8);
    // Display polish (261119-pod follow-up): a sheet carrying bristle content
    // softens the PAINT film by one texel of 5-tap average. The gather deposits
    // near-binary coverage, so the rim reads as a stair step; the tap average
    // restores the sub-pixel falloff without touching the paper. Non-bristle
    // sheets keep 0 and stay byte-identical.
    // The polish follows the Feather global: Feather 0 must read as NO feather
    // (a hard edge), so the film softener is off there and reaches its full
    // 0.55 only at Feather 1.
    gl.uniform1f(p.u.uFilmBlur, this.bristleContent ? BRISTLE_FILM_BLUR : 0);
    gl.uniform1f(p.u.uFlat, flat ? 1 : 0);
    gl.uniform3fv(p.u.uDesk, DESK);
    gl.uniform1i(p.u.uMode, mode);
    this.paperUniforms(p, this.paperPreset, texture ? this.paperStrength : 0);
    const ref = mode === MODE.screen && !flat && this.refVisible ? this.ref : null;
    gl.uniform1f(p.u.uRefOpacity, ref ? this.refOpacity : 0);
    // the sampler needs a texture bound either way; the paper stands in when there is none
    gl.uniform1i(p.u.uRef, g.bindTex(6, ref ? ref.tex : this.paper.tex[0]));
    // Phase 64: the paint thickness field takes texture unit 7 (0-6 are taken).
    gl.uniform1i(p.u.uRelief, g.bindTex(7, this.relief.tex[0]));
    // SPIKE 001: the pigment layer's composited coverage takes unit 8.
    gl.uniform1i(p.u.uCover, g.bindTex(8, this.cover.read.tex[0]));
    // Degrees become radians once, at this boundary — the shader reads radians.
    gl.uniform1f(p.u.uLightAzimuth, (this.light.azimuth * Math.PI) / 180);
    gl.uniform1f(p.u.uLightElevation, (this.light.elevation * Math.PI) / 180);
    gl.uniform1f(p.u.uLightIntensity, this.light.intensity);
    gl.uniform1f(p.u.uReliefBump, RELIEF_BUMP);
    const r = this.refRect;
    gl.uniform4f(p.u.uRefRect, r.x, r.y, r.w, r.h);
    // the shadow grows with the sheet on screen, within a range that always reads as paper on a desk
    const shadow = mode === MODE.screen && !target ? clamp(Math.min(view.w, view.h) / this.dpr * 0.05, 14, 48) * this.dpr : 0;
    gl.uniform1f(p.u.uShadow, shadow);
    gl.uniform1f(p.u.uDpr, this.dpr);
    g.draw(target, scissor, this.canvasSize);
  }

  private render() {
    if (!this.dirtyAll && !this.dirty) return;
    let rect: Rect | null = null;
    if (!this.dirtyAll && this.dirty) {
      const v = this.view, d = this.dirty;
      rect = {
        x0: Math.floor(v.x + (d.x0 / this.dw) * v.w) - 2, y0: Math.floor(v.y + (d.y0 / this.dh) * v.h) - 2,
        x1: Math.ceil(v.x + (d.x1 / this.dw) * v.w) + 2, y1: Math.ceil(v.y + (d.y1 / this.dh) * v.h) + 2,
      };
    }
    // The compositor surface shows the sheet as a real paint layer (pigment
    // alpha); the literal `transparent` mode stays the opaque capture format.
    this.drawDisplay(null, this.view, rect, false, this.compositorLayer ? MODE.pigment : MODE.screen);
    this.dirty = null;
    this.dirtyAll = false;
  }

  /* ------------------------------------------------------------ main loop */

  private schedule() {
    if (this.manual) return;
    if (!this.raf) {
      this.lastFrame = this.clock();
      this.raf = requestAnimationFrame(this.frame);
    }
  }

  private frame = (now: number) => {
    this.raf = 0;
    const dt = clamp((now - this.lastFrame) / 1000, 1 / 240, 1 / 30);
    this.lastFrame = now;
    this.brushNow.r = 0;

    this.processInput(dt);

    const awake = this.active !== null &&
      (this.stroke !== null || this.fixTimer > 0 || now < this.minAwakeUntil || now < this.wetUntil());
    if (awake) {
      // Grow the simulated region as fast as the wet front can move: slow diffusive
      // creep plus a share of the (decaying) flow speed
      this.flowSpeed *= Math.exp(-dt * (3.0 - this.params.flow * 2.4));
      // (velocity is masked to ~0 at the wet front, so the front itself only creeps)
      this.growCarry += 0.4 + Math.min(3, 0.15 * this.flowSpeed * dt * (this.dw / this.velocity.w));
      const grow = Math.floor(this.growCarry);
      if (grow > 0) {
        this.growCarry -= grow;
        const a = this.active!;
        this.touch({ x0: Math.max(0, a.x0 - grow), y0: Math.max(0, a.y0 - grow), x1: Math.min(this.dw, a.x1 + grow), y1: Math.min(this.dh, a.y1 + grow) }, false, false);
      }
      this.step(dt);
      if (this.fixTimer <= 0 && ++this.maskCounter >= MASK_EVERY) { this.maskCounter = 0; this.trimActive(); }
    }
    this.render();
    // a stroke that ran the undo memory dry dropped old steps: the list should say so
    if (this.history.evictions !== this.seenEvictions) this.notifyHistory();
    if (!awake && this.active) this.sleep();
    if (awake || this.stroke) this.schedule();
  };
}
