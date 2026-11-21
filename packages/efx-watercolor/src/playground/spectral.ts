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
 * The display-only side of the committed-sheet seam (2026-11-21,
 * pickup-collapse-live): the underlay stores the committed sheet as an opaque
 * sRGB TRANSMITTANCE raster (white = no pigment), and the carrier's taps must
 * read it in the sheet's coefficient space or Pickup collapses on the first
 * live stroke over a committed-only base.
 *
 * The block IS {@link pigmentFromHex} applied to the observed colour — the
 * reflectance upsample followed by the basis projection — with
 * {@link coeffsOpacity}'s alpha (rasterAlpha's `1 - min(t)`). It recovers a
 * pigment's OWN seven coefficients from its display over white at depth
 * 0.2..1.0 (direction cos >= 0.99, magnitude within 15 %, display error
 * <= 0.05), so the same-paint gate stays shut on a committed base of the
 * brush's own paint and opens for a different one. Pinned by
 * src/playground/underlayTap.test.ts; the carrier gates every read behind
 * uBaseTapOn, so a bake (no underlay ever bound) keeps its recorded
 * arithmetic.
 *
 * Tables are emitted from spectralData — never retyped here.
 */
export function pigmentFromDisplayGLSL(): string {
  const f = (v: number) => (Number.isInteger(v) ? v.toFixed(1) : v.toPrecision(7))
  const priA = PRIMARIES.map((r) => `vec4(${r.slice(0, 4).map(f).join(',')})`);
  const priB = PRIMARIES.map((r) => `vec2(${r.slice(4, 6).map(f).join(',')})`);
  const basis = BASIS.flatMap((row) => row.map(f));
  const sums = BASIS.map((_, k) =>
    `  for (int i = 0; i < 38; i++) k${k} += BASIS_K[${k * 38}+i] * a[i];`);
  return [
    '// COMMITTED-BASE TAP — sRGB transmittance -> the seven absorbance',
    '// coefficients of the paint that produced it (pigmentFromHex applied to the',
    '// observed colour, generated from spectralData).',
    `const vec4 PRI_A[38] = vec4[38](${priA.join(',')});`,
    `const vec2 PRI_B[38] = vec2[38](${priB.join(',')});`,
    `const float BASIS_K[266] = float[266](${basis.join(',')});`,
    'float underlayAlpha(vec3 t){',
    '  return clamp(1.0 - min(t.r, min(t.g, t.b)), 0.0, 1.0);',
    '}',
    'void underlayCoeffs(vec3 t, out vec4 cA, out vec3 cB){',
    '  vec3 lin = mix(t / 12.92, pow((t + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), t));',
    '  float w = min(lin.r, min(lin.g, lin.b));',
    '  vec3 q = lin - vec3(w);',
    '  float c = min(q.g, q.b);',
    '  float m = min(q.r, q.b);',
    '  float y = min(q.r, q.g);',
    '  float rr = min(max(0.0, q.r - q.b), max(0.0, q.r - q.g));',
    '  float gg = min(max(0.0, q.g - q.b), max(0.0, q.g - q.r));',
    '  float bb = min(max(0.0, q.b - q.g), max(0.0, q.b - q.r));',
    '  float a[38];',
    '  for (int i = 0; i < 38; i++){',
    '    float r = w + c * PRI_A[i].x + m * PRI_A[i].y + y * PRI_A[i].z',
    '                + rr * PRI_A[i].w + gg * PRI_B[i].x + bb * PRI_B[i].y;',
    `    a[i] = -log(max(r, ${f(SPECTRAL_EPSILON)}));`,
    '  }',
    '  float k0 = 0.0;',
    '  float k1 = 0.0;',
    '  float k2 = 0.0;',
    '  float k3 = 0.0;',
    '  float k4 = 0.0;',
    '  float k5 = 0.0;',
    '  float k6 = 0.0;',
    ...sums,
    '  cA = vec4(k0, k1, k2, k3);',
    '  cB = vec3(k4, k5, k6);',
    '}',
  ].join('\n');
}

export function displayBasisGLSL(): string {
  const f = (v: number) => (Number.isInteger(v) ? v.toFixed(1) : v.toPrecision(7));
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
