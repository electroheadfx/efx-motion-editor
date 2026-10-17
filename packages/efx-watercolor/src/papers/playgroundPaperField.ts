// ============================================================
//  playgroundPaperField — 1:1 TypeScript transliteration of the
//  watercolor-playground paper shader (MIT, vendored in-repo at
//  SPECS/v1.1.0-water-color/watercolor-playground/src/engine/
//  shaders.ts, paper section ~268-524).
//
//  THE single paper generator. Every salt, coefficient, and
//  primitive body below is carried across from the oracle
//  constant-for-constant — this is a language port (GLSL → TS),
//  not a redesign. If a number here differs from the shader the
//  look changes and live UAT fails. Line-audit against:
//
//    shaders.ts  paperFieldFS   (~274-488)  → paperField*
//                paperLightFS   (~493-507)  → paperLight
//                PAPER_COLOUR   (~510-518)  → paperColour
//                TO_SRGB        (~520-524)  → toSRGB
//    papers.ts   PAPERS         (~22-32)    → PAPER_PRESETS
//    Engine.ts   PAPER_UNITS    (133)       → PAPER_UNITS
//                paperScale     (353)       → uScale law
//                drawPaper      (817-835)   → field → light, no tiling
//
//  Coordinate law (shaders.ts:474):
//    vec2 p = (vUv * uRes + uOffset) * uScale
//    → for texel (x, y) of a target at `offset` on the sheet:
//      p = (x + offsetX, y + offsetY) * uScale
//    where uScale is paper units per texel.
//
//  Determinism: pure function of (x, y, scale, seed, kind). No
//  ambient randomness, no ambient state.
// ============================================================

/** Playground sheet-height law (Engine.ts:133) — features drawn for a sheet this many texels tall. */
export const PAPER_UNITS = 1100;

const PI = 3.14159265;

// ------------------------------------------------------------
// Studio ids (10 procedural papers) — PAPER_PRESETS maps these
// onto playground kinds 0..9 so a preset change cannot drift
// between the fond, the picker thumbs, and the bake tooth.
// ------------------------------------------------------------
export const PROCEDURAL_PAPER_IDS = [
  'paper/cold-press',
  'paper/hot-press',
  'paper/rough',
  'paper/khadi',
  'paper/washi',
  'paper/laid',
  'paper/canvas',
  'paper/toned-sand',
  'paper/kraft',
  'paper/student',
] as const;

export type ProceduralPaperId = (typeof PROCEDURAL_PAPER_IDS)[number];

export interface StudioPaperPreset {
  /** Studio id. */
  readonly id: string;
  /** Playground paperFieldFS kind (0 = coldPress … 9 = student). */
  readonly kind: number;
  /** Relief strength — paperLightFS uBump source (Engine.ts:833). */
  readonly bump: number;
  /** Cloudiness of the sheet (PAPER_COLOUR uMottle). */
  readonly mottle: number;
  /** Sheet colour (sRGB hex) — PAPER_COLOUR uPaperTint. */
  readonly tint: string;
  /** Dark specks / inclusions (sRGB hex) — PAPER_COLOUR uFleckTint. */
  readonly fleck: string;
}

/**
 * papers.ts:22-32 — kind + bump + mottle + tint + fleck, unchanged.
 * Studio id ↔ playground kind: cold-press→0, hot-press→1, rough→2,
 * khadi→3, washi→4, laid→5, canvas→6, toned-sand→7, kraft→8,
 * student→9 (playground id `cellulose` / name `Student`).
 */
export const PAPER_PRESETS: readonly StudioPaperPreset[] = Object.freeze([
  { id: 'paper/cold-press', kind: 0, bump: 1.0, mottle: 0.05, tint: '#f6f3ec', fleck: '#8a8070' },
  { id: 'paper/hot-press', kind: 1, bump: 0.6, mottle: 0.04, tint: '#f8f7f3', fleck: '#8a8478' },
  { id: 'paper/rough', kind: 2, bump: 0.8, mottle: 0.06, tint: '#f5f1e8', fleck: '#857a68' },
  { id: 'paper/khadi', kind: 3, bump: 1.0, mottle: 0.12, tint: '#efe7d6', fleck: '#6d5f4a' },
  { id: 'paper/washi', kind: 4, bump: 0.8, mottle: 0.14, tint: '#f1ece0', fleck: '#7a6a52' },
  { id: 'paper/laid', kind: 5, bump: 1.0, mottle: 0.05, tint: '#f2ebdb', fleck: '#8a7c64' },
  { id: 'paper/canvas', kind: 6, bump: 1.0, mottle: 0.04, tint: '#f3efe6', fleck: '#8a8070' },
  { id: 'paper/toned-sand', kind: 7, bump: 1.0, mottle: 0.06, tint: '#d9c8a6', fleck: '#6e5f45' },
  { id: 'paper/kraft', kind: 8, bump: 0.8, mottle: 0.12, tint: '#b99872', fleck: '#4e3b28' },
  { id: 'paper/student', kind: 9, bump: 1.0, mottle: 0.03, tint: '#f7f7f4', fleck: '#8a8a84' },
]);

export function presetForPaperId(paperId: string): StudioPaperPreset | null {
  for (const preset of PAPER_PRESETS) {
    if (preset.id === paperId) return preset;
  }
  return null;
}

// ------------------------------------------------------------
// papers.ts:38-42 linearRGB, shaders.ts:520-524 toSRGB — exact.
// ------------------------------------------------------------

/** sRGB hex -> linear RGB (papers.ts:38-42). */
export function linearRGB(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return [f((n >> 16) & 255), f((n >> 8) & 255), f(n & 255)];
}

/**
 * TO_SRGB (shaders.ts:520-524):
 *   c = clamp(c, 0.0, 1.0);
 *   return mix(c * 12.92, 1.055 * pow(c, 1/2.4) - 0.055, step(0.0031308, c));
 */
export function toSRGBChannel(c: number): number {
  const x = c < 0 ? 0 : c > 1 ? 1 : c;
  return x < 0.0031308 ? x * 12.92 : 1.055 * Math.pow(x, 1.0 / 2.4) - 0.055;
}

/** Componentwise toSRGB — the fond/thumb entry wants 0..255 sRGB bytes. */
export function toSRGB(c: readonly [number, number, number]): [number, number, number] {
  return [toSRGBChannel(c[0]), toSRGBChannel(c[1]), toSRGBChannel(c[2])];
}

// ------------------------------------------------------------
// GLSL scalar idioms.
// ------------------------------------------------------------
function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  let t = (x - edge0) / (edge1 - edge0);
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return t * t * (3.0 - 2.0 * t);
}

/** GLSL mod(x, y) = x - y * floor(x / y) — sign-correct for negative x, unlike JS %. */
function glslMod(x: number, y: number): number {
  return x - y * Math.floor(x / y);
}

/** GLSL uint(float): truncate toward zero, reinterpret as uint32. */
function glslUint(n: number): number {
  return Math.trunc(n) >>> 0;
}

// vec2/vec4/vec3 scratch — the field is evaluated millions of times per
// sheet; per-call tuples would GC-thrash the fond build (T-261017-KI6-03).
const s2a = new Float64Array(2);
const s2b = new Float64Array(2);
const s2c = new Float64Array(2);
const f3 = new Float64Array(3);

// ------------------------------------------------------------
// paperFieldFS primitives (shaders.ts:282-376) — bodies exact.
// ------------------------------------------------------------

/** uint pcg(uint v) — 282. */
function pcg(v: number): number {
  // uint s = v * 747796405u + 2891336453u;
  const s = (Math.imul(v, 747796405) + 2891336453) >>> 0;
  // uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
  const w = Math.imul((s >>> ((s >>> 28) + 4)) ^ s, 277803737) >>> 0;
  // return (w >> 22u) ^ w;
  return ((w >>> 22) ^ w) >>> 0;
}

/**
 * float hash(vec2 c, float salt) — 283-286.
 * ivec2 i = ivec2(floor(c));
 * return float(pcg(uint(i.x) + pcg(uint(i.y) + pcg(uint(salt) + uint(uSeed * 7919.0)))) * (1.0 / 4294967296.0);
 */
function hash(cx: number, cy: number, salt: number, seed: number): number {
  const ux = (Math.floor(cx) | 0) >>> 0;
  const uy = (Math.floor(cy) | 0) >>> 0;
  const usalt = glslUint(salt);
  const useed = glslUint(seed * 7919.0);
  const h = pcg((ux + pcg((uy + pcg((usalt + useed) >>> 0)) >>> 0)) >>> 0);
  return h * (1.0 / 4294967296.0);
}

/** vec2 hash2(vec2 c, float salt) = vec2(hash(c, salt), hash(c, salt + 1.0)) — 287. */
function hash2(cx: number, cy: number, salt: number, seed: number, out: Float64Array): void {
  out[0] = hash(cx, cy, salt, seed);
  out[1] = hash(cx, cy, salt + 1.0, seed);
}

/** float vnoise(vec2 p, float salt) — 288-292. */
function vnoise(px: number, py: number, salt: number, seed: number): number {
  const ix = Math.floor(px);
  const iy = Math.floor(py);
  let fx = px - ix;
  let fy = py - iy;
  fx = fx * fx * (3.0 - 2.0 * fx);
  fy = fy * fy * (3.0 - 2.0 * fy);
  const h00 = hash(ix, iy, salt, seed);
  const h10 = hash(ix + 1, iy, salt, seed);
  const h01 = hash(ix, iy + 1, salt, seed);
  const h11 = hash(ix + 1, iy + 1, salt, seed);
  // mix(mix(h00, h10, f.x), mix(h01, h11, f.x), f.y)
  const a = h00 + (h10 - h00) * fx;
  const b = h01 + (h11 - h01) * fx;
  return a + (b - a) * fy;
}

/**
 * float fbm(vec2 p, int oct, float salt) — 294-302.
 * normalised to 0..1; each octave rotated so the lattice never shows.
 * p = mat2(0.8, -0.6, 0.6, 0.8) * p * 2.03 + 17.1; a *= 0.5;
 * (GLSL mat2 is column-major: col0 = (0.8, -0.6), col1 = (0.6, 0.8).)
 */
function fbm(x: number, y: number, oct: number, salt: number, seed: number): number {
  let v = 0.0;
  let a = 0.5;
  let n = 0.0;
  let px = x;
  let py = y;
  for (let i = 0; i < 6; i++) {
    if (i >= oct) break;
    v += a * vnoise(px, py, salt + i * 13.0, seed);
    n += a;
    const nx = (0.8 * px + 0.6 * py) * 2.03 + 17.1;
    const ny = (-0.6 * px + 0.8 * py) * 2.03 + 17.1;
    px = nx;
    py = ny;
    a *= 0.5;
  }
  return v / n;
}

/** vec2 cells(vec2 p, float jitter, float salt) — 304-313. Nearest + second-nearest of a jittered lattice. */
function cells(px: number, py: number, jitter: number, salt: number, seed: number, out: Float64Array): void {
  const ix = Math.floor(px);
  const iy = Math.floor(py);
  const fx = px - ix;
  const fy = py - iy;
  let d1 = 9.0;
  let d2 = 9.0;
  for (let y = -1; y <= 1; y++) {
    for (let x = -1; x <= 1; x++) {
      hash2(ix + x, iy + y, salt, seed, s2b);
      const jx = x + 0.5 + (s2b[0] - 0.5) * jitter - fx;
      const jy = y + 0.5 + (s2b[1] - 0.5) * jitter - fy;
      const d = Math.sqrt(jx * jx + jy * jy);
      if (d < d1) {
        d2 = d1;
        d1 = d;
      } else if (d < d2) {
        d2 = d;
      }
    }
  }
  out[0] = d1;
  out[1] = d2;
}

/**
 * float blobs(vec2 p, float salt) — 316-327.
 * Rounded hills of random size and height; h += … * exp(…); return h * 0.75;
 */
function blobs(px: number, py: number, salt: number, seed: number): number {
  const ix = Math.floor(px);
  const iy = Math.floor(py);
  const fx = px - ix;
  const fy = py - iy;
  let h = 0.0;
  for (let y = -1; y <= 1; y++) {
    for (let x = -1; x <= 1; x++) {
      // vec4 r = vec4(hash2(i + c, salt), hash2(i + c, salt + 2.0));
      hash2(ix + x, iy + y, salt, seed, s2a);
      hash2(ix + x, iy + y, salt + 2.0, seed, s2b);
      const dx = x + s2a[0] - fx;
      const dy = y + s2a[1] - fy;
      const rad = 0.35 + 0.4 * s2b[0];
      h += (0.5 + 0.5 * s2b[1]) * Math.exp(-(dx * dx + dy * dy) / (rad * rad));
    }
  }
  return h * 0.75;
}

/** float segment(vec2 p, vec2 a, vec2 b) — 328-331. Distance p→segment ab. */
function segment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const pax = px - ax;
  const pay = py - ay;
  const bax = bx - ax;
  const bay = by - ay;
  let t = (pax * bax + pay * bay) / (bax * bax + bay * bay);
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const dx = pax - bax * t;
  const dy = pay - bay * t;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * float fibres(vec2 p, float cell, float len, float width, float density, float along, float salt) — 335-353.
 * Thin strands on a grid of `cell` units; 5×5×2 loops; coverage of the nearest.
 */
function fibres(
  px: number,
  py: number,
  cell: number,
  len: number,
  width: number,
  density: number,
  along: number,
  salt: number,
  seed: number,
): number {
  // p /= cell;  (params are copy-in — keep the caller's p intact)
  const qx = px / cell;
  const qy = py / cell;
  const ix = Math.floor(qx);
  const iy = Math.floor(qy);
  let cov = 0.0;
  for (let y = -2; y <= 2; y++) {
    for (let x = -2; x <= 2; x++) {
      const cx = ix + x;
      const cy = iy + y;
      for (let k = 0; k < 2; k++) {
        const s = salt + k * 31.0;
        // vec4 h = vec4(hash2(c, s), hash2(c, s + 2.0));
        hash2(cx, cy, s, seed, s2a);
        hash2(cx, cy, s + 2.0, seed, s2b);
        if (s2b[1] < density) {
          const a = (s2b[0] - 0.5) * PI * (1.0 - along);
          // vec2 d = vec2(cos(a), sin(a)) * len * (0.35 + 0.65 * hash(c, s + 4.0)) * 0.5;
          const half = len * (0.35 + 0.65 * hash(cx, cy, s + 4.0, seed)) * 0.5;
          const dx = Math.cos(a) * half;
          const dy = Math.sin(a) * half;
          // float dist = segment(p, c + h.xy - d, c + h.xy + d) * cell;
          const dist = segment(
            qx,
            qy,
            cx + s2a[0] - dx,
            cy + s2a[1] - dy,
            cx + s2a[0] + dx,
            cy + s2a[1] + dy,
          ) * cell;
          // cov = max(cov, (1.0 - smoothstep(width * 0.5, width * 0.5 + 0.9, dist)) * (0.55 + 0.45 * hash(c, s + 5.0)));
          const cover =
            (1.0 - smoothstep(width * 0.5, width * 0.5 + 0.9, dist)) *
            (0.55 + 0.45 * hash(cx, cy, s + 5.0, seed));
          if (cover > cov) cov = cover;
        }
      }
    }
  }
  return cov;
}

/**
 * float specks(vec2 p, float cell, float radius, float density, float salt) — 355-367.
 * Small round specks: coverage of the nearest.
 */
function specks(
  px: number,
  py: number,
  cell: number,
  radius: number,
  density: number,
  salt: number,
  seed: number,
): number {
  const qx = px / cell;
  const qy = py / cell;
  const ix = Math.floor(qx);
  const iy = Math.floor(qy);
  const fx = qx - ix;
  const fy = qy - iy;
  let cov = 0.0;
  for (let y = -1; y <= 1; y++) {
    for (let x = -1; x <= 1; x++) {
      if (hash(ix + x, iy + y, salt + 2.0, seed) < density) {
        const r = radius * (0.4 + 0.6 * hash(ix + x, iy + y, salt + 3.0, seed));
        hash2(ix + x, iy + y, salt, seed, s2a);
        const dx = x + s2a[0] - fx;
        const dy = y + s2a[1] - fy;
        const d = Math.sqrt(dx * dx + dy * dy) * cell;
        const cover = 1.0 - smoothstep(r * 0.6, r + 0.6, d);
        if (cover > cov) cov = cover;
      }
    }
  }
  return cov;
}

/**
 * float hexDist(vec2 p) — 369-373. Distance to nearest centre of a
 * hexagonal lattice with spacing 1. const vec2 s = vec2(1.0, 1.7320508);
 */
function hexDist(px: number, py: number): number {
  const sx = 1.0;
  const sy = 1.7320508;
  const ax = glslMod(px, sx) - sx * 0.5;
  const ay = glslMod(py, sy) - sy * 0.5;
  const bx = glslMod(px - sx * 0.5, sx) - sx * 0.5;
  const by = glslMod(py - sy * 0.5, sy) - sy * 0.5;
  return Math.min(Math.sqrt(ax * ax + ay * ay), Math.sqrt(bx * bx + by * by));
}

/**
 * vec2 warp(vec2 p, float freq, float amount, float salt) — 374-376.
 * return p + (vec2(fbm(p * freq, 3, salt), fbm(p * freq, 3, salt + 50.0)) - 0.5) * amount;
 */
function warp(
  px: number,
  py: number,
  freq: number,
  amount: number,
  salt: number,
  seed: number,
  out: Float64Array,
): void {
  const fx = fbm(px * freq, py * freq, 3, salt, seed);
  const fy = fbm(px * freq, py * freq, 3, salt + 50.0, seed);
  out[0] = px + (fx - 0.5) * amount;
  out[1] = py + (fy - 0.5) * amount;
}

// ------------------------------------------------------------
// The 10 kind functions (shaders.ts:379-471) — every body exact.
// Each writes f3 = (height, mottle, fleck) unclamped; the caller
// clamps, matching `o = vec4(clamp(f, 0.0, 1.0), 1.0)`.
// ------------------------------------------------------------

/** Cold press: rounded, irregular bumps of mixed size (~0.5-2 mm) over a fine felt. — 379-384 */
function coldPress(px: number, py: number, seed: number): void {
  warp(px, py, 0.02, 10.0, 100.0, seed, s2c);
  const qx = s2c[0];
  const qy = s2c[1];
  const hills = blobs(qx / 11.0, qy / 11.0, 110.0, seed) * 0.6 + blobs(qx / 5.5, qy / 5.5, 115.0, seed) * 0.4;
  const h = hills * 0.5 + fbm(qx * 0.09, qy * 0.09, 5, 120.0, seed) * 0.38 + vnoise(px * 0.5, py * 0.5, 130.0, seed) * 0.12;
  f3[0] = 0.5 + (h - 0.5) * 1.3;
  f3[1] = fbm(px * 0.012, py * 0.012, 4, 140.0, seed);
  f3[2] = 0.5;
}

/** Hot press: pressed nearly flat; only a faint felt and the fibres show. — 386-389 */
function hotPress(px: number, py: number, seed: number): void {
  const h =
    fbm(px * 0.06, py * 0.06, 4, 200.0, seed) * 0.6 +
    vnoise(px * 0.4, py * 0.4, 210.0, seed) * 0.25 +
    fibres(px, py, 16.0, 2.5, 0.8, 0.3, 0.0, 220.0, seed) * 0.05;
  f3[0] = 0.5 + (h - 0.4) * 0.45;
  f3[1] = fbm(px * 0.01, py * 0.01, 4, 230.0, seed);
  f3[2] = 0.5;
}

/** Rough: big knobbly hills (~2-4 mm) with deep valleys between them. — 391-398 */
function rough(px: number, py: number, seed: number): void {
  warp(px, py, 0.01, 40.0, 300.0, seed, s2c);
  const qx = s2c[0];
  const qy = s2c[1];
  // hill size varies across the sheet, as on a mould-made rough
  const big = smoothstep(0.3, 0.7, fbm(px * 0.006, py * 0.006, 3, 305.0, seed));
  const hills =
    blobs(qx / 26.0, qy / 26.0, 310.0, seed) * (0.35 + 0.4 * big) +
    blobs(qx / 12.0, qy / 12.0, 315.0, seed) * (0.45 - 0.25 * big);
  const h = hills * 0.65 + fbm(qx * 0.06, qy * 0.06, 5, 320.0, seed) * 0.25 + vnoise(px * 0.45, py * 0.45, 325.0, seed) * 0.1;
  f3[0] = 0.5 + (h - 0.52) * 1.5;
  f3[1] = fbm(px * 0.01, py * 0.01, 4, 330.0, seed);
  f3[2] = 0.5;
}

/** Khadi: handmade, lumpy at every scale, with raised fibres and dark inclusions. — 400-409 */
function khadi(px: number, py: number, seed: number): void {
  warp(px, py, 0.008, 60.0, 400.0, seed, s2c);
  const qx = s2c[0];
  const qy = s2c[1];
  const lumps = fbm(qx * 0.035, qy * 0.035, 5, 410.0, seed);
  cells(qx / 13.0, qy / 13.0, 1.0, 420.0, seed, s2a);
  const knobs = 1.0 - smoothstep(0.0, 0.9, s2a[0]);
  warp(px, py, 0.05, 8.0, 430.0, seed, s2b);
  const fib = fibres(s2b[0], s2b[1], 9.0, 3.0, 1.1, 0.6, 0.0, 440.0, seed);
  const h = lumps * 0.5 + knobs * 0.3 + fbm(px * 0.2, py * 0.2, 3, 450.0, seed) * 0.16 + fib * 0.03;
  warp(px, py, 0.06, 10.0, 465.0, seed, s2c);
  const dark = Math.max(
    specks(px, py, 60.0, 2.0, 0.3, 460.0, seed),
    fibres(s2c[0], s2c[1], 110.0, 0.4, 0.9, 0.3, 0.0, 470.0, seed) * 0.6,
  );
  f3[0] = 0.5 + (h - 0.5) * 1.6;
  f3[1] = fbm(px * 0.006, py * 0.006, 4, 480.0, seed) * 0.7 + fib * 0.25;
  f3[2] = 0.5 - dark * 0.35 + fib * 0.06;
}

/** Washi: smooth and cloudy, a web of long kozo fibres lying on top, the odd bark speck. — 411-419 */
function washi(px: number, py: number, seed: number): void {
  warp(px, py, 0.025, 28.0, 500.0, seed, s2c);
  const qx = s2c[0];
  const qy = s2c[1];
  const longF =
    fibres(qx, qy, 42.0, 3.4, 1.3, 0.4, 0.0, 510.0, seed) * (0.6 + 0.4 * vnoise(px * 0.05, py * 0.05, 512.0, seed));
  warp(px, py, 0.05, 10.0, 515.0, seed, s2a);
  const fineF = fibres(s2a[0], s2a[1], 14.0, 3.0, 0.6, 0.45, 0.0, 520.0, seed);
  const h = fbm(px * 0.05, py * 0.05, 4, 530.0, seed) * 0.8 + longF * 0.08 + fineF * 0.03;
  const cloud = fbm(px * 0.005, py * 0.005, 5, 540.0, seed);
  const bark = specks(px, py, 70.0, 1.6, 0.18, 550.0, seed);
  f3[0] = 0.5 + (h - 0.42) * 0.7;
  f3[1] = cloud * 0.85 + longF * 0.15;
  f3[2] = 0.5 + longF * 0.16 + fineF * 0.05 - bark * 0.4;
}

/** Laid: close laid lines (~1 mm) crossed by chain lines (~25 mm), over a soft felt. — 421-431 */
function laid(px: number, py: number, seed: number): void {
  const wob = (fbm(px * 0.004, py * 0.02, 3, 600.0, seed) - 0.5) * 6.0;
  const lines = Math.pow(0.5 + 0.5 * Math.cos(2.0 * PI * (py + wob) / 5.6), 2.0);
  const cx = px + (fbm(px * 0.02, py * 0.004, 3, 610.0, seed) - 0.5) * 8.0;
  // float dc = abs(fract(cx / 140.0) - 0.5) * 140.0;   // distance to the nearest chain line
  const dc = Math.abs(glslMod(cx, 140.0) / 140.0 - 0.5) * 140.0;
  const chain = 1.0 - smoothstep(1.0, 3.5, dc);
  const h = lines * 0.1 + chain * 0.05 + fbm(px * 0.08, py * 0.08, 4, 620.0, seed) * 0.6;
  // the sheet runs a touch thicker beside each chain line, and the laid lines read faintly in the tone
  const tone = 0.5 - 0.12 * Math.exp(-dc / 12.0) - 0.06 * lines + (fbm(px * 0.01, py * 0.01, 3, 630.0, seed) - 0.5) * 0.6;
  f3[0] = 0.5 + (h - 0.36) * 1.1;
  f3[1] = tone;
  f3[2] = 0.5;
}

/**
 * Canvas: a plain weave of slightly uneven threads under a coat of gesso. — 433-447.
 * const float T = 8.0; p += (vec2(vnoise(p * 0.02, 700.0), vnoise(p * 0.02, 701.0)) - 0.5) * T * 1.2;
 */
function canvas(px: number, py: number, seed: number): void {
  const T = 8.0;
  const wx = px + (vnoise(px * 0.02, py * 0.02, 700.0, seed) - 0.5) * T * 1.2;
  const wy = py + (vnoise(px * 0.02, py * 0.02, 701.0, seed) - 0.5) * T * 1.2;
  const cx = wx / T;
  const cy = wy / T;
  const ix = Math.floor(cx);
  const iy = Math.floor(cy);
  const fx = cx - ix;
  const fy = cy - iy;
  const tx = 0.8 + 0.2 * hash(ix, 0.0, 702.0, seed) + 0.3 * (vnoise(ix * 5.0, cy * 0.35, 703.0, seed) - 0.5);
  const ty = 0.8 + 0.2 * hash(0.0, iy, 704.0, seed) + 0.3 * (vnoise(cx * 0.35, iy * 5.0, 705.0, seed) - 0.5);
  // where a thread crosses over, it shows as a rice-grain bump along its length;
  // over and under alternate, so the grains make a checkerboard
  let dx = fx - 0.5;
  let dy = fy - 0.5;
  // bool warpUp = mod(i.x + i.y, 2.0) > 0.5;
  const warpUp = glslMod(ix + iy, 2.0) > 0.5;
  // d *= warpUp ? vec2(2.3, 1.15) : vec2(1.15, 2.3);
  if (warpUp) {
    dx *= 2.3;
    dy *= 1.15;
  } else {
    dx *= 1.15;
    dy *= 2.3;
  }
  const grain = Math.max(0.0, 1.0 - (dx * dx + dy * dy)) * (warpUp ? tx : ty);
  const h = Math.sqrt(grain) * 0.75 + fbm(wx * 0.15, wy * 0.15, 3, 706.0, seed) * 0.25;
  f3[0] = 0.5 + (h - 0.55) * 1.1;
  f3[1] = fbm(wx * 0.01, wy * 0.01, 3, 707.0, seed);
  f3[2] = 0.5;
}

/** Toned (Mi-Teintes honeycomb): a regular mesh of shallow pits ~1.5 mm across. — 449-455 */
function toned(px: number, py: number, seed: number): void {
  warp(px, py, 0.05, 7.0, 800.0, seed, s2c);
  const qx = s2c[0] / 9.0;
  const qy = s2c[1] / 9.0;
  const d = hexDist(qx, qy) * (0.8 + 0.4 * vnoise(qx * 2.0, qy * 2.0, 805.0, seed));
  const rims = smoothstep(0.1, 0.55, d);
  const h = rims * 0.28 + fbm(px * 0.09, py * 0.09, 4, 810.0, seed) * 0.6 + fibres(px, py, 12.0, 2.0, 0.9, 0.35, 0.0, 820.0, seed) * 0.04;
  f3[0] = 0.5 + (h - 0.42) * 1.2;
  f3[1] = fbm(px * 0.012, py * 0.012, 4, 830.0, seed);
  f3[2] = 0.5 - specks(px, py, 60.0, 1.2, 0.2, 840.0, seed) * 0.3;
}

/** Kraft: smooth, streaky along the machine direction, with dark bark and recycled flecks. — 457-463 */
function kraft(px: number, py: number, seed: number): void {
  const h =
    fbm(px * 0.07, py * 0.07, 4, 900.0, seed) * 0.6 +
    vnoise(px * 0.35, py * 0.35, 910.0, seed) * 0.32 +
    fibres(px, py, 10.0, 2.5, 0.9, 0.6, 0.7, 920.0, seed) * 0.04;
  const streak = fbm(px * 0.004, py * 0.03, 5, 930.0, seed);
  warp(px, py, 0.08, 10.0, 935.0, seed, s2a);
  warp(px, py, 0.08, 10.0, 955.0, seed, s2b);
  const dark = Math.max(
    fibres(s2a[0], s2a[1], 60.0, 0.35, 0.7, 0.2, 0.6, 940.0, seed) * 0.6,
    specks(px, py, 40.0, 1.3, 0.35, 950.0, seed),
  );
  const light = fibres(s2b[0], s2b[1], 70.0, 0.4, 1.0, 0.25, 0.5, 960.0, seed);
  f3[0] = 0.5 + (h - 0.45) * 0.7;
  f3[1] = streak * 0.8 + fbm(px * 0.01, py * 0.01, 3, 970.0, seed) * 0.2;
  f3[2] = 0.5 - dark * 0.28 + light * 0.12;
}

/** Student (cellulose): a felt-pressed texture of small bumps all of one size, evenly spread. — 465-471 */
function student(px: number, py: number, seed: number): void {
  warp(px, py, 0.03, 3.0, 995.0, seed, s2c);
  const qx = s2c[0] / 7.0;
  const qy = s2c[1] / 7.0;
  cells(qx, qy, 0.7, 1000.0, seed, s2a);
  const bumps = 1.0 - smoothstep(0.0, 0.7, s2a[0]);
  const h = bumps * 0.6 + fbm(px * 0.12, py * 0.12, 3, 1010.0, seed) * 0.4;
  f3[0] = 0.5 + (h - 0.48) * 1.1;
  f3[1] = fbm(px * 0.015, py * 0.015, 3, 1020.0, seed);
  f3[2] = 0.5;
}

/** shaders.ts:476-487 switch (uKind) — default = coldPress. */
function dispatchKind(px: number, py: number, seed: number, kind: number): void {
  switch (kind) {
    case 1:
      hotPress(px, py, seed);
      break;
    case 2:
      rough(px, py, seed);
      break;
    case 3:
      khadi(px, py, seed);
      break;
    case 4:
      washi(px, py, seed);
      break;
    case 5:
      laid(px, py, seed);
      break;
    case 6:
      canvas(px, py, seed);
      break;
    case 7:
      toned(px, py, seed);
      break;
    case 8:
      kraft(px, py, seed);
      break;
    case 9:
      student(px, py, seed);
      break;
    default:
      coldPress(px, py, seed);
  }
}

// ------------------------------------------------------------
// Public field API.
// ------------------------------------------------------------

export interface PaperFieldSample {
  readonly height: number;
  readonly mottle: number;
  readonly fleck: number;
}

export interface PaperFieldMap {
  readonly height: Float32Array;
  readonly mottle: Float32Array;
  readonly fleck: Float32Array;
}

/**
 * Per-texel field (paperFieldFS main). `scale` is paper units per texel;
 * offset defaults to [0, 0]. Output clamped to 0..1, matching
 * `o = vec4(clamp(f, 0.0, 1.0), 1.0)`.
 */
export function paperField(
  x: number,
  y: number,
  scale: number,
  seed: number,
  kind: number,
  offsetX = 0,
  offsetY = 0,
): PaperFieldSample {
  // vec2 p = (vUv * uRes + uOffset) * uScale → p = (x + offsetX, y + offsetY) * uScale
  const px = (x + offsetX) * scale;
  const py = (y + offsetY) * scale;
  dispatchKind(px, py, seed, kind);
  return { height: clamp01(f3[0]), mottle: clamp01(f3[1]), fleck: clamp01(f3[2]) };
}

/**
 * Field over a whole target — every texel evaluated from its own paper-unit
 * coordinate. No tiling (Engine.ts drawPaper runs the field over the FULL
 * target). Allocates only the three result arrays.
 */
export function paperFieldMap(
  width: number,
  height: number,
  scale: number,
  seed: number,
  kind: number,
  offsetX = 0,
  offsetY = 0,
): PaperFieldMap {
  const count = width * height;
  const outH = new Float32Array(count);
  const outM = new Float32Array(count);
  const outF = new Float32Array(count);
  for (let y = 0; y < height; y++) {
    const py = (y + offsetY) * scale;
    for (let x = 0; x < width; x++) {
      const px = (x + offsetX) * scale;
      dispatchKind(px, py, seed, kind);
      const i = y * width + x;
      outH[i] = clamp01(f3[0]);
      outM[i] = clamp01(f3[1]);
      outF[i] = clamp01(f3[2]);
    }
  }
  return { height: outH, mottle: outM, fleck: outF };
}

// ------------------------------------------------------------
// paperLightFS (shaders.ts:493-507) — lights the height from the
// upper left; packs r = lit, g = height, b = mottle, a = fleck.
// ------------------------------------------------------------

// L = normalize(vec3(-0.5, 0.6, 0.62)) — precomputed to keep the port
// bit-stable across the three uses of L.z / dot(n, L).
const L_LEN = Math.sqrt(0.5 * 0.5 + 0.6 * 0.6 + 0.62 * 0.62);
const LX = -0.5 / L_LEN;
const LY = 0.6 / L_LEN;
const LZ = 0.62 / L_LEN;

/**
 * The lit RGBA pass. Neighbour taps at ±1 texel (clamped at edges).
 * `bump` is ALREADY uBump = (preset.bump * 1.4) / scale — the caller
 * computes it (Engine.ts:833); do not fold the preset in here.
 * Output per texel: r = clamp(lit), g = height, b = mottle, a = fleck.
 */
export function paperLight(
  field: PaperFieldMap,
  width: number,
  height: number,
  bump: number,
  _scale = 1,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(width * height * 4);
  const H = field.height;
  for (let y = 0; y < height; y++) {
    const yUp = y > 0 ? y - 1 : 0;
    const yDn = y < height - 1 ? y + 1 : height - 1;
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const f = H[i];
      const l = H[y * width + (x > 0 ? x - 1 : 0)];
      const r = H[y * width + (x < width - 1 ? x + 1 : width - 1)];
      const b = H[yUp * width + x];
      const t = H[yDn * width + x];
      // n = normalize(vec3((l - r) * uBump, (b - t) * uBump, 1.0))
      let nx = (l - r) * bump;
      let ny = (b - t) * bump;
      let nz = 1.0;
      const inv = 1.0 / Math.sqrt(nx * nx + ny * ny + nz * nz);
      nx *= inv;
      ny *= inv;
      nz *= inv;
      // a little ambient occlusion: valleys sit in shadow whichever way the light falls
      // float lit = 0.5 + (dot(n, L) - L.z) * 1.3 + (f.x - 0.5) * 0.25;
      const lit = 0.5 + (nx * LX + ny * LY + nz * LZ - LZ) * 1.3 + (f - 0.5) * 0.25;
      const o = i * 4;
      out[o] = clamp01(lit) * 255;
      out[o + 1] = f * 255;
      out[o + 2] = field.mottle[i] * 255;
      out[o + 3] = field.fleck[i] * 255;
    }
  }
  return out;
}

// ------------------------------------------------------------
// PAPER_COLOUR (shaders.ts:510-518) — sheet colour from a paper texel.
// ------------------------------------------------------------

/** Packed paper texel: r = lit relief, g = height, b = mottle, a = fleck (0..1). */
export interface PaperTexel {
  r: number;
  g: number;
  b: number;
  a: number;
}

const scratchTexel: PaperTexel = { r: 0, g: 0, b: 0, a: 0 };

/**
 * The PAPER_COLOUR body in linear light. `tint` / `fleckTint` are already
 * linear RGB (see linearRGB). `mottle` is the preset's uMottle;
 * `textureStrength` is uTexture (0 = flat sheet of the tint, 1 = full relief).
 *
 *   c = base * (1.0 + uTexture * ((paper.r - 0.5) * 0.32 + (paper.b - 0.5) * uMottle * 2.0));
 *   fl = (paper.a - 0.5) * 2.0 * uTexture;
 *   fl < 0 ? mix(c, uFleckTint, -fl) : mix(c, min(base * 1.1 + 0.02, 1), fl)
 */
export function paperColour(
  texel: PaperTexel,
  tint: readonly [number, number, number],
  fleckTint: readonly [number, number, number],
  mottle: number,
  textureStrength: number,
): [number, number, number] {
  const m = textureStrength * ((texel.r - 0.5) * 0.32 + (texel.b - 0.5) * mottle * 2.0);
  const c0 = tint[0] * (1.0 + m);
  const c1 = tint[1] * (1.0 + m);
  const c2 = tint[2] * (1.0 + m);
  const fl = (texel.a - 0.5) * 2.0 * textureStrength;
  if (fl < 0) {
    const t = -fl;
    return [
      c0 + (fleckTint[0] - c0) * t,
      c1 + (fleckTint[1] - c1) * t,
      c2 + (fleckTint[2] - c2) * t,
    ];
  }
  const h0 = Math.min(tint[0] * 1.1 + 0.02, 1);
  const h1 = Math.min(tint[1] * 1.1 + 0.02, 1);
  const h2 = Math.min(tint[2] * 1.1 + 0.02, 1);
  return [
    c0 + (h0 - c0) * fl,
    c1 + (h1 - c1) * fl,
    c2 + (h2 - c2) * fl,
  ];
}

/** paperColour + toSRGB, returned as 0..255 for ImageData. */
export function paperColourSRGB(
  texel: PaperTexel,
  tint: readonly [number, number, number],
  fleckTint: readonly [number, number, number],
  mottle: number,
  textureStrength: number,
): [number, number, number] {
  const lin = paperColour(texel, tint, fleckTint, mottle, textureStrength);
  return [
    toSRGBChannel(lin[0]) * 255,
    toSRGBChannel(lin[1]) * 255,
    toSRGBChannel(lin[2]) * 255,
  ];
}

// ------------------------------------------------------------
// Sheet entry point — field → light → paperColour at uTexture = 1,
// writing opaque sRGB RGBA (Engine.ts drawPaper + displayFS paper arm).
// ------------------------------------------------------------

/**
 * The fond / thumb entry point. Generates the sheet's opaque sRGB RGBA
 * at the target's full W×H. No tiling, no createPattern — one continuous
 * field (Engine.ts:817-835).
 */
export function renderPaperSheet(
  width: number,
  height: number,
  scale: number,
  seed: number,
  preset: StudioPaperPreset,
): Uint8ClampedArray {
  const field = paperFieldMap(width, height, scale, seed, preset.kind, 0, 0);
  // Engine.ts:833 — uBump = (preset.bump * 1.4) / scale
  const uBump = (preset.bump * 1.4) / scale;
  const lit = paperLight(field, width, height, uBump, scale);
  const tint = linearRGB(preset.tint);
  const fleckTint = linearRGB(preset.fleck);
  const out = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    scratchTexel.r = lit[o] / 255;
    scratchTexel.g = lit[o + 1] / 255;
    scratchTexel.b = lit[o + 2] / 255;
    scratchTexel.a = lit[o + 3] / 255;
    const rgb = paperColourSRGB(scratchTexel, tint, fleckTint, preset.mottle, 1);
    out[o] = rgb[0];
    out[o + 1] = rgb[1];
    out[o + 2] = rgb[2];
    out[o + 3] = 255;
  }
  return out;
}

/**
 * Height-only helper for the bake tooth. Thin wrapper over
 * paperFieldMap(...).height — NOT a second generator. Total: null on
 * unknown id / non-positive or non-integer size / non-finite seed/scale.
 */
export function paperHeightMap(
  paperId: string,
  seed: number,
  width: number,
  height: number,
  scale: number,
): Float32Array | null {
  const preset = presetForPaperId(paperId);
  if (!preset) return null;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) return null;
  if (!Number.isFinite(seed) || !Number.isFinite(scale) || !(scale > 0)) return null;
  return paperFieldMap(width, height, scale, seed, preset.kind, 0, 0).height;
}
