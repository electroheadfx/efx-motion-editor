import { SCATTER_EPSILON, SCATTERING_MAX } from './scattering';
import { BASIS, DISPLAY_BANDS, DISPLAY_RGB_WEIGHTS, PRIMARIES, SPECTRAL_EPSILON } from './spectralData';

/** Number of absorbance coefficients stored per texel. */
export const COEFFS = 7;

/**
 * A pigment: 7 absorbance coefficients for its masstone at concentration 1.
 * Scattering is not a pigment property — the engine derives it from Body at
 * the deposit site (64-08) — so the record carries the absorbance basis only,
 * and no project file can hold a retired channel.
 */
export interface Pigment {
  coeffs: Float32Array;
}

const uncompand = (x: number) => (x < 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4));
const compand = (x: number) => (x < 0.0031308 ? x * 12.92 : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/**
 * The absorbance-basis coordinates of a FLAT band offset: `LEVEL_COEFFS[k]` is
 * the sum of basis vector `k` across the 38 bands, so adding `u·LEVEL_COEFFS`
 * to a pigment adds `u` to every reconstructed band's absorbance — the exact
 * absorbance-space image of multiplying the pigment's reflectance curve by
 * `e^-u`. §4.2's per-bristle value jitter is a REFLECTANCE multiplier (the
 * reference scales `brush.rgb` in linear light, app.js:355/849), so bristle
 * paint takes `u = -ln(jitter)` here, never a coefficient scale: a coefficient
 * scale changes the spectral SHAPE (hue) and, with the sign inverted, turns
 * the reference's dark-fibre runs into pale lanes.
 */
export const LEVEL_COEFFS: readonly number[] = BASIS.map(vector =>
  vector.reduce((sum, v) => sum + v, 0));

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function rgbToHex([r, g, b]: readonly number[]): string {
  const to = (v: number) => Math.round(clamp01(v) * 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

/** spectral.js upsampling: sRGB -> 38-band reflectance curve. */
function reflectance(srgb: readonly number[]): number[] {
  let [r, g, b] = srgb.map(uncompand);
  const w = Math.min(r, g, b);
  r -= w; g -= w; b -= w;
  const c = Math.min(g, b), m = Math.min(r, b), y = Math.min(r, g);
  const rr = Math.min(Math.max(0, r - b), Math.max(0, r - g));
  const gg = Math.min(Math.max(0, g - b), Math.max(0, g - r));
  const bb = Math.min(Math.max(0, b - g), Math.max(0, b - r));
  return PRIMARIES.map(k =>
    Math.max(SPECTRAL_EPSILON, w + c * k[0] + m * k[1] + y * k[2] + rr * k[3] + gg * k[4] + bb * k[5]));
}

/** A transparent pigment whose masstone (concentration 1 on white paper) is `hex`. */
export function pigmentFromHex(hex: string): Pigment {
  const absorbance = reflectance(hexToRgb(hex)).map(v => -Math.log(v));
  const coeffs = new Float32Array(COEFFS);
  for (let k = 0; k < COEFFS; k++) {
    let s = 0;
    for (let i = 0; i < absorbance.length; i++) s += BASIS[k][i] * absorbance[i];
    coeffs[k] = s;
  }
  return { coeffs };
}

/**
 * CPU mirror of the display shader's colour reconstruction (without paper texture):
 * linear sRGB of a layer holding `coeffs` absorbance over white paper.
 */
export function coeffsToLinear(coeffs: ArrayLike<number>): [number, number, number] {
  const out: [number, number, number] = [0, 0, 0];
  DISPLAY_BANDS.forEach((band, i) => {
    let a = 0;
    for (let k = 0; k < COEFFS; k++) a += coeffs[k] * BASIS[k][band];
    const t = Math.exp(-Math.max(a, 0));
    for (let j = 0; j < 3; j++) out[j] += t * DISPLAY_RGB_WEIGHTS[i][j];
  });
  return out;
}

export function coeffsToHex(coeffs: ArrayLike<number>): string {
  return rgbToHex(coeffsToLinear(coeffs).map(v => compand(clamp01(v))));
}

/**
 * The compositor layer's own opacity for `coeffs` over white — displayFS mode
 * 4's `alpha = 1 - min(r, g, b)` expressed in sRGB, exactly as the live sheet
 * stacks over the document fond.
 *
 * The Body cover attenuates the underlayer by THIS number: a dab may only
 * remove as much of the pre-stroke paint as its own paint actually hides. A
 * coefficient scale is not an opacity (the KM transmittance of one acrylic dab
 * at ~0.25 already reads as opaque), which is why the cover used to be
 * calibrated with an arbitrary gain.
 */
export function coeffsOpacity(coeffs: ArrayLike<number>): number {
  const lin = coeffsToLinear(coeffs);
  return 1 - compand(clamp01(Math.min(lin[0], lin[1], lin[2])));
}

/** Pigments mixed (or glazed) at the given concentrations, as a CSS colour. */
export function mixToHex(parts: { pigment: Pigment; amount: number }[]): string {
  const sum = new Float32Array(COEFFS);
  for (const { pigment, amount } of parts)
    for (let k = 0; k < COEFFS; k++) sum[k] += pigment.coeffs[k] * amount;
  return coeffsToHex(sum);
}

/** Basis value at the display bands, laid out for the shader: vec4 + vec3 per band. */
/**
 * Kubelka-Munk display band block (64-10, MED-34 / MED-35).
 *
 * Each display band reconstructs with the two-constant Kubelka-Munk form for a
 * layer over a white background. For a band with clamped absorption exponent A
 * and settled scattering S:
 *
 *   k    = 0.5 A                       the half-exponent calibration: at S = 0
 *                                      the squared transmittance is exactly
 *                                      exp(-A), the expression the shader has
 *                                      always evaluated
 *   arg  = sqrt(k (2S + k))
 *   R    = S sinh(arg) / den           the reflectance of the layer over black
 *   T    = arg / den                   its transmittance
 *   den  = (k + S) sinh(arg) + arg cosh(arg)
 *   band = R + T^2 / (1 - R)           its reflectance over a white background
 *
 * A band with no absorption (k = 0) returns 1: the continuous limit of that
 * form, and the physical reflectance of a non-absorbing scatterer over white.
 * No division can reach zero. For k > 0 the reflectance of the finite layer is
 * always strictly below one, so 1 - R has a positive lower bound, and the
 * emitted block evaluates that complement directly — (k sinh + arg cosh) / den
 * — so it never rounds to zero either.
 *
 * The raw sinh/cosh denominator is not emitted: it overflows float32 once the
 * argument passes about 88, which a few dozen overlapping Body-100 dabs reach,
 * and an overflowed denominator turns the band into NaN. The block therefore
 * emits the algebraically identical form normalized by exp(-arg), where
 * exp(-arg) sinh(arg) = (1 - e)/2 and exp(-arg) cosh(arg) = (1 + e)/2 with
 * e = exp(-2 arg) in (0, 1], and the transmittance carries exp(-arg) = sqrt(e).
 * Every term is then bounded for any finite absorption and scattering.
 *
 * The block branches on the scattering scalar S. At or below SCATTER_EPSILON it
 * emits the legacy exponential lines character for character, so a
 * scattering-free render stays byte-identical to the committed baseline (D-17).
 * The epsilon and the one-dab deposit maximum are interpolated from
 * ./scattering — never retyped below.
 */
/**
 * The stroke layer's compiled FIT band list (spike 006, Q3c): indices into
 * DISPLAY_BANDS, NOT wavelengths. The merge shader compiles its residual arrays
 * against this reduced list; the acceptance sweep still re-renders all sixteen
 * display bands, so the fit is judged where the artist sees it.
 */
export const STROKE_LAYER_BANDS: readonly number[] = Object.freeze([1, 3, 5, 7, 9, 10, 11, 13]);

const glslFloat = (v: number) => (Number.isInteger(v) ? v.toFixed(1) : v.toPrecision(7));

/**
 * The frozen stroke-layer encoder constants (spike 006 `bandConsts` +
 * `BAND_FN`, transcribed — never retyped): the compiled band table and the
 * display band function, evaluated for a state `(a, b, s)`.
 *
 * `bandOf` is the display law itself — the Kubelka-Munk reflectance over white
 * above the scatter epsilon, the legacy exponential below — so the FIT's target
 * and residual live in the same space the compositor renders.
 */
export function strokeLayerBandsGLSL(
  bandList: readonly number[] = STROKE_LAYER_BANDS,
): string {
  const f = glslFloat;
  const b4: string[] = [];
  const b3: string[] = [];
  for (const i of bandList) {
    const band = DISPLAY_BANDS[i]!;
    b4.push(`vec4(${BASIS.slice(0, 4).map((k) => f(k[band]!)).join(',')})`);
    b3.push(`vec3(${BASIS.slice(4, 7).map((k) => f(k[band]!)).join(',')})`);
  }
  return [
    `const int BANDS = ${bandList.length};`,
    `const float SCATTER_EPS = ${f(SCATTER_EPSILON)};`,
    `const vec4 B4[BANDS] = vec4[BANDS](${b4.join(',')});`,
    `const vec3 B3[BANDS] = vec3[BANDS](${b3.join(',')});`,
    ``,
    `// The display band value, transcribed from displayBasisGLSL(): Kubelka-Munk`,
    `// reflectance over white above the scatter epsilon, the legacy exponential below.`,
    `float bandOf(vec4 a, vec3 b, float s, int i){`,
    `  float A = dot(a, B4[i]) + dot(b, B3[i]);`,
    `  float k = 0.5 * max(A, 0.0);`,
    `  if (s > SCATTER_EPS){`,
    `    if (k <= 0.0) return 1.0;`,
    `    float arg = sqrt(k * (2.0 * s + k));`,
    `    float e = exp(-2.0 * arg);`,
    `    float sh = 0.5 * (1.0 - e);`,
    `    float ch = 0.5 * (1.0 + e);`,
    `    float den = (k + s) * sh + arg * ch;`,
    `    float R = s * sh / den;`,
    `    float T = arg * sqrt(e) / den;`,
    `    float om = (k * sh + arg * ch) / den;`,
    `    return R + T * T / om;`,
    `  }`,
    `  return exp(-max(A, 0.0));`,
    `}`,
  ].join('\n');
}

/**
 * The per-band statement pair both basis emitters are built from: for each
 * display band, the scattered lines (Kubelka-Munk over white, above the
 * epsilon) and the legacy exponential lines (at or below it). Shared so the
 * two emitters can never disagree on a numeric tuple; each appends to a local
 * `rgb` from locals named `a`, `b`, `scatter` and `tr`.
 */
function displayBandStatementsGLSL(f: (v: number) => string): { scattered: string[]; legacy: string[] } {
  const scattered: string[] = [];
  const legacy: string[] = [];
  DISPLAY_BANDS.forEach((band, i) => {
    const b = BASIS.map(v => v[band]);
    const w = DISPLAY_RGB_WEIGHTS[i];
    const basis = `dot(a, vec4(${b.slice(0, 4).map(f).join(',')})) + dot(b, vec3(${b.slice(4, 7).map(f).join(',')}))`;
    legacy.push(
      `  tr = exp(-max(${basis}, 0.0));\n` +
      `  rgb += tr * vec3(${w.map(f).join(',')});`);
    scattered.push(
      `    float kmK${i} = 0.5 * max(${basis}, 0.0);\n` +
      `    float kmBand${i};\n` +
      `    if (kmK${i} <= 0.0){\n` +
      `      kmBand${i} = 1.0;\n` +
      `    } else {\n` +
      `      float kmArg${i} = sqrt(kmK${i} * (2.0 * scatter + kmK${i}));\n` +
      `      float kmE${i} = exp(-2.0 * kmArg${i});\n` +
      `      float kmSh${i} = 0.5 * (1.0 - kmE${i});\n` +
      `      float kmCh${i} = 0.5 * (1.0 + kmE${i});\n` +
      `      float kmDen${i} = (kmK${i} + scatter) * kmSh${i} + kmArg${i} * kmCh${i};\n` +
      `      float kmR${i} = scatter * kmSh${i} / kmDen${i};\n` +
      `      float kmT${i} = kmArg${i} * sqrt(kmE${i}) / kmDen${i};\n` +
      `      float kmOm${i} = (kmK${i} * kmSh${i} + kmArg${i} * kmCh${i}) / kmDen${i};\n` +
      `      kmBand${i} = kmR${i} + kmT${i} * kmT${i} / kmOm${i};\n` +
      `    }\n` +
      `    rgb += kmBand${i} * vec3(${w.map(f).join(',')});`);
  });
  return { scattered, legacy };
}

export function displayBasisGLSL(): string {
  const f = (v: number) => (Number.isInteger(v) ? v.toFixed(1) : v.toPrecision(7));
  const { scattered, legacy } = displayBandStatementsGLSL(f);
  return [
    '  // Kubelka-Munk layer over white (64-10, MED-34 / MED-35): each band is the',
    "  // layer's reflectance over black plus its squared transmittance over one",
    '  // minus that reflectance. S = scatter; one unit-amount Body-100 dab peaks at',
    `  // SCATTERING_MAX = ${f(SCATTERING_MAX)}, and the settled channel accumulates past it.`,
    '  // Each term is normalized by exp(-arg), so the hyperbolic forms stay',
    '  // bounded for any finite absorption and scattering. At or below the epsilon',
    '  // the legacy lines run verbatim, so a scattering-free render is',
    '  // byte-identical to the committed baseline.',
    `  if (scatter > ${f(SCATTER_EPSILON)}){`,
    scattered.join('\n'),
    '  } else {',
    legacy.join('\n'),
    '  }',
  ].join('\n');
}

/**
 * The SAME per-band block as `displayBasisGLSL()`, wrapped as a function so the
 * live stroke-layer display can reconstruct the layer's own band array:
 *
 *   vec3 displayBasisBands(vec4 a, vec3 b, float scatter)
 *
 * Both emitters read DISPLAY_BANDS / BASIS / DISPLAY_RGB_WEIGHTS through the
 * one statement generator, so a band value can never drift between the shipped
 * compositor and the layer variant (shaders.test.ts pins the tuple identity).
 */
export function displayBasisFnGLSL(): string {
  const f = (v: number) => (Number.isInteger(v) ? v.toFixed(1) : v.toPrecision(7));
  const { scattered, legacy } = displayBandStatementsGLSL(f);
  return [
    '// The display band reconstruction as a function — the layer variant\'s',
    '// own band array (same tables, same lines as the shipped block).',
    'vec3 displayBasisBands(vec4 a, vec3 b, float scatter){',
    '  vec3 rgb = vec3(0.0);',
    '  float tr;',
    `  if (scatter > ${f(SCATTER_EPSILON)}){`,
    scattered.join('\n'),
    '  } else {',
    legacy.join('\n'),
    '  }',
    '  return rgb;',
    '}',
  ].join('\n');
}
