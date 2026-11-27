// Brushes: a tip texture (the footprint of one dab) plus the behaviour that turns
// dabs into a stroke. Tips are procedural, generated once at startup in tip space:
// a square from -1..1 where x is the brush's long axis and y its short axis; the
// engine maps that square onto a rotated ellipse of the brush's aspect ratio.

import type { MediumId } from './mediums';
import { DEFAULT_MEDIUM_ID } from './mediums';

export type Rotation =
  | 'follow'   // long axis follows the stroke direction (+ angle)
  | 'fixed'    // held at a fixed angle, or at the pen's tilt azimuth when available
  | 'random';  // every dab lands at a random angle

/**
 * quick 261124-tje: the per-response LANDING BAG — the live paint-control
 * values a pick writes. COMPILE-TIME ONLY like `group` / `pressureLink` /
 * `speedLink`: these are UI landing values applied by the app store on a
 * pick; there is no serializer, no `.mce` field and no Rust mirror, and a
 * stroke persists the response id alone.
 */
export interface BrushDefaults {
  /** Visible Brush size diameter in px (1..512), converted at application time. */
  sizePx?: number;
  /** Medium-scale 0..100 landing values (the params bag's own scale). */
  grain?: number;
  load?: number;
  pickup?: number;
  /** The Opacity row's displayed 0..100 (100 = opaque); the app store inverts it. */
  opacity?: number;
  dry?: number;
  feather?: number;
  featherNoise?: number;
  featherFalloff?: number;
  emboss?: number;
  /** `'#rrggbb'` pigment, landed through the Studio's one colour setter. */
  color?: string;
}

export interface BrushPreset {
  id: string;
  name: string;
  hint: string;
  /** Generator in tip space, or raw 8-bit tip data (custom imported brushes). */
  tip: ((n: number, noise: Noise) => Float32Array) | Uint8Array;
  /** short axis / long axis of the footprint (1 = round). */
  aspect: number;
  rotation: Rotation;
  /** Degrees. For 'follow' this is an offset from the stroke direction. */
  angle: number;
  angleJitter: number;
  /** Footprint radius (half the long axis, in document heights) at pressure 0 and 1. */
  size: [number, number];
  /** Exponent on pressure for size: < 1 responds early, > 1 only when pressing hard. */
  pressureSize: number;
  /** How much a fast stroke thins the line. */
  speedThin: number;
  /** Distance between dabs as a fraction of the radius. */
  spacing: number;
  /** Random offset per dab as a fraction of the radius. */
  scatter: number;
  /** Dabs per stamp (spatter). */
  dabs: number;
  /** Random radius variation per dab, 0..1. */
  sizeJitter: number;
  /** Multipliers on the global sliders. */
  water: number;
  load: number;
  flow: number;
  /** How far the brush paints before it runs dry, relative to the round. */
  capacity: number;
  /** 0..1: how much the paper's tooth gates the deposit (dry brush skips the valleys). */
  grain: number;
  /** 0..1: how much the water footprint is a soft ellipse rather than the textured tip. */
  wetRound: number;
  /**
   * 0..1: dry-media deposit. 0 keeps the tip's smooth alpha (every wet brush);
   * above 0 the tip is re-thresholded per dab into a hard, crumbly mask so a
   * dry medium gets a net, ragged edge instead of a feathered one (the dry
   * bristle response).
   */
  roughness: number;
  /**
   * Tip-space offset amplitude applied per dab (0..~0.2). Each dab reads a
   * different slice of the tip, so a stroke's silhouette breaks up randomly
   * instead of repeating one contour.
   */
  stampJitter: number;
  /**
   * Phase 64 (MED-26): the medium this response belongs to. COMPILE-TIME
   * ONLY — no serializer, no `.mce` field, no Rust mirror: a stroke persists
   * the response id, and the group is derived from this table at read time.
   * An absent tag reads as the default medium (`watercolor`), so every preset
   * recorded before the taxonomy keeps its exact behaviour.
   */
  group?: MediumId;
  /**
   * Quick 261121-umu: 0..1 — how much the authored pen pressure enters the
   * bristle CONTACT pressure (the carrier and the gather, i.e. whether a hair
   * deposits at all). 1 = the shipped law; 0 = the contact gate is independent
   * of authored pressure while the speed and attack ramps still apply. The
   * authored pressure still owns the footprint/radius. Absent reads as 1.
   * COMPILE-TIME ONLY like `group`: no serializer, no `.mce` field — a stroke
   * persists the response id and this table is the authority at read time.
   */
  pressureLink?: number;
  /**
   * 2026-11-21 (the artist's fast-hand report): 0..1 — how much the HAND
   * SPEED enters the bristle CONTACT pressure. 1 = the shipped law (a fast
   * hand drops the contact gate to 0.42, below most bristles' touchReach, so
   * the mark breaks into specks); 0 = the gate ignores hand speed, and Dry
   * alone decides whether the paint runs out. The attack ramp and the
   * footprint stay as they are. Absent reads as 1. COMPILE-TIME ONLY like
   * `pressureLink`: no serializer, no `.mce` field.
   */
  speedLink?: number;
  /**
   * quick 261124-tje: the per-response landing bag (see `BrushDefaults`).
   * COMPILE-TIME ONLY — the app store applies it on a pick; nothing
   * serializes it and no document field mirrors it.
   */
  defaults?: BrushDefaults;
  custom?: boolean;
}

/** A preset with its tip baked to 8-bit data. */
export interface Brush extends Omit<BrushPreset, 'tip'> {
  tipSize: number;
  tipData: Uint8Array;
  /** Mean tip value over the tip square; used to normalise deposit between brushes. */
  tipMean: number;
  /**
   * quick-261115-oh9: the TEXTURE id whose mask supplied `tipData`, or
   * null/absent when the response's own procedural tip did. It is part of the
   * tip's GPU identity — `id` alone no longer identifies the bytes, because one
   * response can be stamped through several textures.
   */
  textureId?: string | null;
  /**
   * quick 261116-inu: the projected-texture orientation in integer DEGREES
   * (-180..180), present only when a texture supplied the tip (null/absent
   * otherwise). UNIT LAW: degrees end to end — the AQTL byte body is the ONE
   * hundredths boundary. The STROKE snapshot is the authority at replay; the
   * library row only supplies the default for the NEXT stroke. It is a shader
   * uniform, so it is NOT part of `brushTipCacheKey` (one upload serves every
   * rotation of the same (id, textureId)).
   */
  textureRotation?: number | null;
}

/**
 * The GPU tip-texture identity: the response id AND the texture that supplied
 * the bytes. Engine.tipTexture caches by this, so switching texture on the same
 * response uploads a new tip instead of reusing the first one (the bug this
 * quick fixes); an unknown texture resolves to null and keeps the base key.
 */
export function brushTipCacheKey(b: Pick<Brush, 'id' | 'textureId'>): string {
  return `${b.id}|${b.textureId ?? ''}`;
}

/**
 * Reorder a MASK-BACKED tip's rows for upload.
 *
 * A stored mask keeps image order: row 0 is the picture's TOP row, which is why
 * the library's `.webp` opens the right way up in any viewer and the chip
 * preview (a 2-D canvas) reads correctly. The stamp, however, samples `t = 1`
 * as the TOP of the dab (`vUv.y = 1` is up), while `texImage2D` maps the first
 * data row to `t = 0`. Uploading the mask as-is therefore paints every texture
 * vertically inverted — invisible on abstract grain, obvious on lettering.
 *
 * Flipping the rows here, once per cached tip upload, fixes the orientation
 * without touching the stored bytes. Procedural tips are generated directly in
 * engine order and never pass through this, so every stroke recorded before
 * textures existed keeps its exact appearance.
 */
export function tipRowsForUpload(data: Uint8Array, size: number): Uint8Array {
  if (size <= 1 || data.length !== size * size) return data;
  const out = new Uint8Array(data.length);
  for (let row = 0; row < size; row++) {
    const source = (size - 1 - row) * size;
    out.set(data.subarray(source, source + size), row * size);
  }
  return out;
}

export const TIP_SIZE = 192;
const DEG = Math.PI / 180;

/* ----------------------------------------------------------------- noise */

export class Noise {
  private state: number;
  constructor(private seed: number) { this.state = seed | 0 || 1; }

  /** mulberry32 */
  rnd(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  hash(ix: number, iy: number): number {
    let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(this.seed, 982451653)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  value(x: number, y: number): number {
    const ix = Math.floor(x), iy = Math.floor(y);
    let fx = x - ix, fy = y - iy;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    const a = this.hash(ix, iy), b = this.hash(ix + 1, iy), c = this.hash(ix, iy + 1), d = this.hash(ix + 1, iy + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }

  fbm(x: number, y: number, octaves = 4): number {
    let v = 0, amp = 0.5, sum = 0;
    for (let i = 0; i < octaves; i++) {
      v += amp * this.value(x, y); sum += amp;
      x = x * 2.03 + 17.1; y = y * 2.01 + 9.7; amp *= 0.5;
    }
    return v / sum;
  }

  /** Distances to the nearest and second-nearest jittered cell point. */
  worley(x: number, y: number): [number, number] {
    const ix = Math.floor(x), iy = Math.floor(y);
    let f1 = 9, f2 = 9;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const cx = ix + i, cy = iy + j;
      const px = cx + this.hash(cx, cy), py = cy + this.hash(cx + 71, cy + 13);
      const d = Math.hypot(px - x, py - y);
      if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
    }
    return [f1, f2];
  }
}

/* ---------------------------------------------------------- tip helpers */

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smoothstep = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
/** 1 inside, fading to 0 between radius `hard` and 1. */
const soft = (r: number, hard: number) => 1 - smoothstep(hard, 1, r);

type TipFn = (u: number, v: number, r: number, ang: number) => number;

function tip(fn: TipFn): (n: number) => Float32Array {
  return n => {
    const out = new Float32Array(n * n);
    for (let j = 0; j < n; j++) {
      const v = ((j + 0.5) / n) * 2 - 1;
      for (let i = 0; i < n; i++) {
        const u = ((i + 0.5) / n) * 2 - 1;
        out[j * n + i] = clamp01(fn(u, v, Math.hypot(u, v), Math.atan2(v, u)));
      }
    }
    return out;
  };
}

/** Sum of thin hairs (line segments) with a gaussian cross-section. */
function hairs(segments: [number, number, number, number][], width: number, u: number, v: number) {
  let sum = 0;
  for (const [ax, ay, bx, by] of segments) {
    const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
    const t = clamp01(((u - ax) * dx + (v - ay) * dy) / len2);
    const d = Math.hypot(u - ax - dx * t, v - ay - dy * t);
    sum += Math.exp(-(d * d) / (width * width));
  }
  return sum;
}

/**
 * Shared acrylic bristle tip (Phase 64, MED-29): a fan of parallel hairs
 * across the tip square, deterministic from the build's noise source. It is
 * the procedural choice the spec settles — the striation travels with the
 * build instead of depending on a machine-scoped texture. Cost class:
 * fourteen segments through `hairs`, no cellular pass.
 */
function bristleTip(n: number, N: Noise): Float32Array {
  const segs: [number, number, number, number][] = [];
  const count = 14;
  for (let i = 0; i < count; i++) {
    const x = -0.92 + (1.84 * i) / (count - 1) + (N.rnd() - 0.5) * 0.06;
    segs.push([x * 0.35, -0.95, x, 0.95]);
  }
  return tip((u, v) => {
    const edge = 1 - smoothstep(0.86, 1, Math.abs(v));
    const taper = 1 - 0.25 * smoothstep(0.7, 1, Math.abs(v));
    return Math.min(1, hairs(segs, 0.052, u, v)) * edge * taper;
  })(n);
}

/**
 * 64-21 (D-27), revised post-UAT 2026-11-19 (GAP-4): the bristle response
 * predicate — the ONE place a bristle id is read as "this stroke runs the
 * per-bristle engine".
 *
 * A bristle response is `bristle-round` or `pen`, whatever tip it carries
 * (quick 261124-iq9 retires the flat sibling; its answer is now false and
 * the retired id replays through the shipped round fallback). D-27
 * originally made a picked texture the escape hatch OUT of the engine; the
 * UAT found the textured stroke was the one that looked best and was
 * bypassing the engine entirely. The texture tip now COMPOSES with the
 * gather (`tipMask` in BRISTLE_GATHER, gated by `uTipMix`), so a textured
 * bristle stroke runs the same carrier and the same one lerp as an
 * untextured one — the tip only bounds where the dab lands.
 *
 * quick 261124-tje: Pen runs the per-bristle engine because Pickup and
 * Feather are bristle-only bindings; its procedural crisp tip composes with
 * the gather through `tipMask`, exactly like an untextured Gouache stroke.
 * The Engine already asks this predicate, so accepting `pen` needs no
 * Engine edit. (Declared after `bristleTip` on purpose: the tip-source pin
 * in brushes.test.ts matches the FIRST `*bristle*` function.)
 */
export function isBristleResponse(b: { id: string; textureId?: string | null }): boolean {
  return b.id === 'bristle-round' || b.id === 'pen';
}

/* --------------------------------------------------------------- presets */

const BASE: Omit<BrushPreset, 'id' | 'name' | 'hint' | 'tip'> = {
  aspect: 1, rotation: 'fixed', angle: 0, angleJitter: 0,
  size: [0.011, 0.05], pressureSize: 1, speedThin: 0,
  spacing: 0.3, scatter: 0, dabs: 1, sizeJitter: 0,
  water: 1, load: 1, flow: 1, capacity: 1, grain: 0, wetRound: 0.6,
  roughness: 0, stampJitter: 0,
};

const define = (p: Partial<BrushPreset> & Pick<BrushPreset, 'id' | 'name' | 'hint' | 'tip'>): BrushPreset => ({ ...BASE, ...p });

/* ---------------------------------------------------------- grouping (64) */

/** One rendered brush section: a group and its members in table order. */
export interface BrushGroupSection {
  group: MediumId;
  presets: BrushPreset[];
}

/**
 * Fixed display order of the two sections (Phase 64, MED-27; narrowed by quick
 * 261124-iq9). A group with no member is skipped by `brushSections`, never
 * rendered empty.
 */
export const brushGroupOrder: readonly MediumId[] = Object.freeze([
  'watercolor',
  'acrylic',
] as const);

/**
 * Short section header names, D-18: each label is the same word as its medium
 * name in the dropdown.
 */
export const brushGroupLabels: Readonly<Record<MediumId, string>> = Object.freeze({
  watercolor: 'Watercolor',
  // 2026-11-27 (artist's live ruling): the acrylic group reads "Medium" in
  // the Studio — the same word as its dropdown name (D-18 stays true).
  acrylic: 'Medium',
});

/** The preset's medium tag; an absent tag reads as the default medium. */
export function brushGroupOf(preset: BrushPreset): MediumId {
  return preset.group ?? DEFAULT_MEDIUM_ID;
}

/**
 * Group presets for the library: one entry per NON-EMPTY group, in the fixed
 * order, members kept in table order. Pure — the component maps this instead
 * of branching inline, so the empty-group rule is testable on its own.
 */
export function brushSections(presets: readonly BrushPreset[]): BrushGroupSection[] {
  const sections: BrushGroupSection[] = [];
  for (const group of brushGroupOrder) {
    const members = presets.filter((preset) => brushGroupOf(preset) === group);
    if (members.length > 0) sections.push({ group, presets: members });
  }
  return sections;
}

/**
 * The ONE physics record the Medium (acrylic) responses share. Pen 1B is a
 * DERIVATIVE of Gouache Round (artist's ruling 2026-11-27): a Medium brush
 * response carries the engine's whole bristle structure, so a law such as
 * Feather noise reads the same fields on every Medium response. Only a
 * response's id, name, hint and landing bag may differ.
 */
const ACRYLIC_RESPONSE_PHYSICS = {
  group: 'acrylic',
  pressureLink: 0,
  speedLink: 0,
  aspect: 0.7,
  rotation: 'follow',
  water: 0.06,
  load: 1.4,
  capacity: 1.6,
  grain: 0.15,
  roughness: 0.4,
  spacing: 0.14,
} as const satisfies Partial<BrushPreset>;

export const BRUSH_PRESETS: BrushPreset[] = [
  define({
    id: 'round', name: 'Round', hint: 'A pointed round #8: the everyday brush',
    group: 'watercolor',
    tip: (n, N) => tip((u, v, r, ang) => {
      const rr = r * (1 + 0.08 * (N.fbm(ang * 0.8 + 3, r * 2.5) * 2 - 1));
      return soft(rr, 0.3) * (1 - 0.12 * N.fbm(u * 5, v * 5));
    })(n),
  }),
  define({
    id: 'detail', name: 'Detail', hint: 'A small round #2 for fine work',
    group: 'watercolor',
    size: [0.0025, 0.014], pressureSize: 0.9, water: 0.7, load: 1.15, capacity: 0.6, spacing: 0.28, wetRound: 0.8,
    tip: n => tip((_u, _v, r) => soft(r, 0.55))(n),
  }),
  define({
    id: 'rigger', name: 'Rigger', hint: 'Long thin liner: holds a lot of paint for continuous lines',
    group: 'watercolor',
    size: [0.0015, 0.0065], pressureSize: 0.7, speedThin: 0.08, water: 0.55, load: 1.3, capacity: 1.8, spacing: 0.25, wetRound: 0.9,
    tip: n => tip((_u, _v, r) => soft(r, 0.65))(n),
  }),
  define({
    id: 'flat', name: 'Flat', hint: 'A ½" flat: thick or thin depending on direction; tilt the pen to turn it',
    group: 'watercolor',
    aspect: 0.26, rotation: 'fixed', angle: 40, angleJitter: 1.5,
    size: [0.02, 0.038], pressureSize: 1.4, spacing: 0.14, water: 0.8, wetRound: 0.25,
    tip: (n, N) => tip((u, v) => {
      const chisel = 0.06 * (N.fbm(v * 3 + 9, 2, 3) * 2 - 1);
      const ex = 1 - smoothstep(0.8, 0.98, Math.abs(u) + chisel);
      const ey = 1 - smoothstep(0.8, 1, Math.abs(v));
      const bristles = 1 - 0.4 * smoothstep(0.4, 0.75, N.fbm(u * 10, v * 0.7, 3));
      return ex * ey * bristles;
    })(n),
  }),
  define({
    id: 'hake', name: 'Hake', hint: 'Wide soft goat-hair wash brush; streaky, carries lots of water',
    group: 'watercolor',
    aspect: 0.2, rotation: 'follow', angle: 90, angleJitter: 2,
    size: [0.05, 0.08], pressureSize: 1.6, spacing: 0.1, water: 1.6, load: 0.75, flow: 1.2, capacity: 2.2, wetRound: 0.5,
    tip: (n, N) => tip((u, v) => {
      const ex = 1 - smoothstep(0.72, 1, Math.abs(u) + 0.1 * (N.fbm(v * 2 + 4, 1, 3) * 2 - 1));
      const ey = 1 - smoothstep(0.55, 1, Math.abs(v));
      const bristles = 1 - 0.65 * smoothstep(0.35, 0.7, N.fbm(u * 16, v * 0.9, 3));
      const gaps = smoothstep(0.25, 0.45, N.fbm(u * 7 + 20, v * 0.4, 2));
      return ex * ey * bristles * (0.4 + 0.6 * gaps);
    })(n),
  }),
  define({
    id: 'filbert', name: 'Filbert', hint: 'Oval tip: soft rounded marks that change with direction',
    group: 'watercolor',
    aspect: 0.55, rotation: 'fixed', angle: 25, angleJitter: 2,
    size: [0.012, 0.036], spacing: 0.18, wetRound: 0.5,
    tip: (n, N) => tip((u, _v, r) => soft(r, 0.45) * (1 - 0.25 * N.fbm(u * 8, 0.7, 3)))(n),
  }),
  define({
    id: 'mop', name: 'Mop', hint: 'Big squirrel mop: floods the paper for washes',
    group: 'watercolor',
    size: [0.03, 0.075], pressureSize: 0.8, spacing: 0.25, water: 1.8, load: 0.8, flow: 1.3, capacity: 2.6, wetRound: 0.7,
    tip: (n, N) => tip((u, v, r, ang) => {
      const rr = r * (1 + 0.22 * (N.fbm(ang * 1.2, 1.7, 3) * 2 - 1));
      return Math.pow(soft(rr, 0.1), 1.3) * (1 - 0.25 * N.fbm(u * 3, v * 3));
    })(n),
  }),
  define({
    id: 'sponge', name: 'Sponge', hint: 'Natural sponge: dabbed cellular texture for foliage and stone',
    group: 'watercolor',
    rotation: 'random', size: [0.025, 0.05], pressureSize: 0.7, spacing: 0.55, scatter: 0.3, sizeJitter: 0.3,
    water: 0.5, load: 0.9, capacity: 1.2, grain: 0.45, wetRound: 0.1,
    tip: (n, N) => tip((u, v, r) => {
      const [f1, f2] = N.worley(u * 4.5, v * 4.5);
      return soft(r, 0.55) * smoothstep(0.03, 0.14, f2 - f1) * (0.55 + 0.45 * N.fbm(u * 7, v * 7, 3));
    })(n),
  }),
  define({
    id: 'spatter', name: 'Spatter', hint: 'Flicked droplets: sparse at a light touch, dense when pressing',
    group: 'watercolor',
    rotation: 'random', size: [0.003, 0.008], pressureSize: 0.8, spacing: 4.5, scatter: 10, dabs: 5, sizeJitter: 0.75,
    water: 1.3, load: 1.1, capacity: 1.5, wetRound: 0,
    tip: n => tip((_u, _v, r) => soft(r, 0.72))(n),
  }),
  define({
    id: 'sumi', name: 'Sumi', hint: 'Oriental brush: hairline to broad with pressure, fibrous edges',
    group: 'watercolor',
    size: [0.002, 0.052], pressureSize: 1.3, speedThin: 0.12, spacing: 0.22, water: 0.8, load: 1.3, capacity: 1.2, wetRound: 0.75,
    tip: (n, N) => tip((_u, _v, r, ang) => {
      const rr = r * (1 + 0.35 * (N.fbm(ang * 2.5 + r * 2, 1, 3) * 2 - 1));
      return Math.pow(soft(rr, 0.25), 1.5) * (1 - 0.3 * N.fbm(r * 8, ang * 3, 3));
    })(n),
  }),
  define({
    id: 'dagger', name: 'Dagger', hint: 'Sword liner: calligraphic strokes from a tapered blade',
    group: 'watercolor',
    aspect: 0.38, rotation: 'fixed', angle: 55, angleJitter: 1,
    size: [0.006, 0.03], pressureSize: 1.1, speedThin: 0.06, spacing: 0.15, load: 1.1, capacity: 1.4, wetRound: 0.3,
    tip: n => tip((u, v) => {
      const t = (u + 1) / 2;
      const w = Math.sqrt(Math.max(0, 4 * t * (1 - t))) * (1 - 0.5 * t);
      return 1 - smoothstep(w * 0.8, w, Math.abs(v));
    })(n),
  }),
  /* ---------------------------------------------------------------------
   * Phase 64 (MED-29), narrowed by quick 261124-iq9: the acrylic responses
   * the medium taxonomy keeps — displayed as "Gouache Round" and "Pen 1B".
   * They APPEND after the watercolor table — never rename or reorder an
   * existing id, because a stroke persists the response id and an unknown id
   * replays as the round.
   *
   * 2026-11-27 (artist's ruling after the Pen/Feather-noise report): Pen 1B
   * is DERIVED from Gouache Round — one shared physics record and tip, so
   * every bristle-gather (Medium) law reads the same structure on both
   * responses. Only the id, name, hint and landing bag differ.
   * ------------------------------------------------------------------- */
  define({
    // 2026-11-27 (artist's live ruling): the acrylic family's response card
    // reads "Gouache Round" — distinct from the Medium group header.
    id: 'bristle-round', name: 'Gouache Round', hint: 'Round acrylic brush with body: springy, loaded hairs',
    ...ACRYLIC_RESPONSE_PHYSICS,
    defaults: { sizePx: 40, load: 100, pickup: 100, dry: 0, feather: 100 },
    tip: bristleTip,
  }),
  define({
    // quick 261124-tje, re-derived 2026-11-27: the Pen response keeps Gouache
    // Round's whole physics record; its landing bag is the fine pen setup.
    // It APPENDS after Gouache Round on purpose — the acrylic group's FIRST
    // preset must stay `bristle-round`, so the Brush family's landing brush
    // never moves.
    id: 'pen', name: 'Pen 1B', hint: 'Gouache body with the pen bag: fine, crisp edge, no pickup',
    ...ACRYLIC_RESPONSE_PHYSICS,
    defaults: {
      sizePx: 10,
      grain: 25,
      load: 100,
      pickup: 0,
      opacity: 100,
      dry: 0,
      feather: 100,
      featherNoise: 60,
      featherFalloff: 0,
      emboss: 0,
      color: '#333537',
    },
    tip: bristleTip,
  }),
];

/** Behaviour for an imported texture: a textured round that follows the stroke. */
export const CUSTOM_BASE: Omit<BrushPreset, 'id' | 'name' | 'hint' | 'tip'> = {
  ...BASE, rotation: 'follow', angleJitter: 4, spacing: 0.2, wetRound: 0.4,
};

/* ------------------------------------------------------------- building */

export function buildBrush(preset: BrushPreset, seed = 7): Brush {
  const { tip: source, ...rest } = preset;
  let tipData: Uint8Array, tipSize: number;
  if (source instanceof Uint8Array) {
    tipData = source;
    tipSize = Math.round(Math.sqrt(source.length));
  } else {
    tipSize = TIP_SIZE;
    const f = source(tipSize, new Noise(seed + hashString(preset.id)));
    tipData = new Uint8Array(f.length);
    for (let i = 0; i < f.length; i++) tipData[i] = Math.round(clamp01(f[i]) * 255);
  }
  let sum = 0;
  for (let i = 0; i < tipData.length; i++) sum += tipData[i];
  return { ...rest, tipSize, tipData, tipMean: Math.max(0.01, sum / (255 * tipData.length)) };
}

function hashString(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export { DEG as DEGREES };
