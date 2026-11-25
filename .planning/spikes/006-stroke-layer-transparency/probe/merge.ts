// ============================================================
//  SPIKE 006 / Q3 — the composite merge as a REAL GLSL pass.
//
//  A CPU extrapolation is not an answer, so the bounded Levenberg–Marquardt fit
//  Q1 validated is implemented here as a fragment shader and run on the GPU,
//  over a real touched rect and over a whole sheet.
//
//  PER TEXEL:
//    1. read the base state, the layer state, the layer's cover and the
//       per-texel lateral coordinate u
//    2. A = 1 - amount·t^e,  t = (u - START)/(1 - START),  e = 2^(2b-1)
//       A_eff = A · cover                        (Q1's mandatory alpha gate)
//    3. build the 16-band target  band_out = A_eff·band_L + (1-A_eff)·band_S
//       with the SAME Kubelka-Munk / legacy switch displayBasisGLSL uses
//    4. fit (c0..c6, S) with up to `uMaxIter` LM steps, seeded from the layer
//       (A_eff >= 0.5), the base, or a coarse-pass seed
//    5. write the fitted state plus the iteration count actually used
//
//  Inputs are sampled with `texture()` on a normalised coordinate so the same
//  shader can run into a DOWNSCALED target (the coarse seeding pass); at full
//  resolution a NEAREST sample lands exactly on texelFetch.
//
//  The BASIS constants come from the shipped spectralData — the same source
//  displayBasisGLSL() is generated from, so the fit minimises the display law.
// ============================================================

import { BASIS, DISPLAY_BANDS } from '../../../../packages/efx-watercolor/src/playground/spectralData'
import { SCATTER_EPSILON } from '../../../../packages/efx-watercolor/src/playground/scattering'
import { toHalf } from '../../../../packages/efx-watercolor/src/playground/half'
import type { GL, Format, Rect, Target } from '../../../../packages/efx-watercolor/src/playground/gl'

export const BANDS = DISPLAY_BANDS.length
const EPS = SCATTER_EPSILON

const f = (v: number) => (Number.isInteger(v) ? v.toFixed(1) : v.toPrecision(7))

function bandConsts(): string {
  const b4: string[] = []
  const b3: string[] = []
  for (const band of DISPLAY_BANDS) {
    b4.push(`vec4(${BASIS.slice(0, 4).map((k) => f(k[band]!)).join(',')})`)
    b3.push(`vec3(${BASIS.slice(4, 7).map((k) => f(k[band]!)).join(',')})`)
  }
  return [
    `const int BANDS = ${BANDS};`,
    `const float SCATTER_EPS = ${f(EPS)};`,
    `const vec4 B4[BANDS] = vec4[BANDS](${b4.join(',')});`,
    `const vec3 B3[BANDS] = vec3[BANDS](${b3.join(',')});`,
  ].join('\n')
}

const BAND_FN = `
// The display band value, transcribed from displayBasisGLSL(): Kubelka-Munk
// reflectance over white above the scatter epsilon, the legacy exponential below.
float bandOf(vec4 a, vec3 b, float s, int i){
  float A = dot(a, B4[i]) + dot(b, B3[i]);
  float k = 0.5 * max(A, 0.0);
  if (s > SCATTER_EPS){
    if (k <= 0.0) return 1.0;
    float arg = sqrt(k * (2.0 * s + k));
    float e = exp(-2.0 * arg);
    float sh = 0.5 * (1.0 - e);
    float ch = 0.5 * (1.0 + e);
    float den = (k + s) * sh + arg * ch;
    float R = s * sh / den;
    float T = arg * sqrt(e) / den;
    float om = (k * sh + arg * ch) / den;
    return R + T * T / om;
  }
  return exp(-max(A, 0.0));
}
`

export interface MergeOptions {
  /** LM steps allowed (hard bound). */
  iterations: number
  /** Copy the layer where A_eff = 1 and the base where A_eff = 0, skipping the fit. */
  coreSkip: boolean
  /** Seed from uSeedA/uSeedB (a coarse pass) instead of the inputs. */
  seeded: boolean
}

export function mergeFragmentShader(opts: MergeOptions): string {
  return `#version 300 es
precision highp float;
precision highp int;

uniform sampler2D uBaseA, uBaseB, uLayerA, uLayerB, uCover, uLateral, uSeedA, uSeedB;
uniform vec2 uOutSize;
uniform float uAmount, uStart, uFalloff;
uniform int uMaxIter, uSeedOn, uCoreSkip, uDebug;

layout(location=0) out vec4 oA;
layout(location=1) out vec4 oB;
layout(location=2) out vec4 oIter;

${bandConsts()}
${BAND_FN}

// GLSL ES 3.00 has no arrays of arrays: the 8x9 augmented system is FLAT,
// row-major, index p*9 + c.
bool solve8(in float A[72], out float x[8]){
  float M[72];
  for (int i = 0; i < 72; i++) M[i] = A[i];
  for (int col = 0; col < 8; col++){
    int piv = col;
    for (int r = col + 1; r < 8; r++){
      if (abs(M[r * 9 + col]) > abs(M[piv * 9 + col])) piv = r;
    }
    if (abs(M[piv * 9 + col]) < 1e-12) return false;
    if (piv != col){
      for (int c = 0; c < 9; c++){ float t = M[col * 9 + c]; M[col * 9 + c] = M[piv * 9 + c]; M[piv * 9 + c] = t; }
    }
    float p = M[col * 9 + col];
    for (int c = col; c < 9; c++) M[col * 9 + c] /= p;
    for (int r = 0; r < 8; r++){
      if (r == col) continue;
      float fac = M[r * 9 + col];
      if (fac == 0.0) continue;
      for (int c = col; c < 9; c++) M[r * 9 + c] -= fac * M[col * 9 + c];
    }
  }
  for (int i = 0; i < 8; i++) x[i] = M[i * 9 + 8];
  return true;
}

float costAt(vec4 a, vec3 b, float s, float tgt[BANDS]){
  float c = 0.0;
  for (int i = 0; i < BANDS; i++){
    float d = bandOf(a, b, s, i) - tgt[i];
    c += d * d;
  }
  return c;
}

float maxResid(vec4 a, vec3 b, float s, float tgt[BANDS]){
  float m = 0.0;
  for (int i = 0; i < BANDS; i++) m = max(m, abs(bandOf(a, b, s, i) - tgt[i]));
  return m;
}

void main(){
  vec2 uv = gl_FragCoord.xy / uOutSize;
  vec4 baseA = texture(uBaseA, uv);
  vec4 baseB = texture(uBaseB, uv);
  vec4 layerA = texture(uLayerA, uv);
  vec4 layerB = texture(uLayerB, uv);
  float cover = clamp(texture(uCover, uv).r, 0.0, 1.0);
  float u = clamp(texture(uLateral, uv).r, 0.0, 1.0);

  float t = clamp((u - uStart) / max(1.0 - uStart, 1e-4), 0.0, 1.0);
  float e = exp2(2.0 * uFalloff - 1.0);
  float A = 1.0 - uAmount * pow(t, e);
  float aEff = clamp(A * cover, 0.0, 1.0);

  if (uDebug == 1){
    // bypass the fit: report the sampled inputs and the derived alpha
    oA = vec4(gl_FragCoord.x, gl_FragCoord.y, uOutSize.x, uOutSize.y);
    oB = vec4(uv.x * 10000.0, uv.y * 10000.0, layerA.x, baseA.x);
    oIter = vec4(1.0);
    return;
  }

  // The two exact endpoints need no solve at all.
  if (uCoreSkip == 1 && aEff >= 1.0 - 1e-4){ oA = layerA; oB = layerB; oIter = vec4(0.0); return; }
  if (uCoreSkip == 1 && aEff <= 1e-4){ oA = baseA; oB = baseB; oIter = vec4(0.0); return; }

  vec4 seedA = layerA;
  vec3 seedB = layerB.rgb;
  float seedS = layerB.a;
  if (uSeedOn == 1){
    vec4 sA = texture(uSeedA, uv);
    vec4 sB = texture(uSeedB, uv);
    seedA = sA; seedB = sB.rgb; seedS = sB.a;
  } else if (aEff < 0.5){
    seedA = baseA; seedB = baseB.rgb; seedS = baseB.a;
  }

  float tgt[BANDS];
  for (int i = 0; i < BANDS; i++){
    float bL = bandOf(layerA, layerB.rgb, layerB.a, i);
    float bS = bandOf(baseA, baseB.rgb, baseB.a, i);
    tgt[i] = aEff * bL + (1.0 - aEff) * bS;
  }

  float x[8];
  x[0] = seedA.x; x[1] = seedA.y; x[2] = seedA.z; x[3] = seedA.w;
  x[4] = seedB.x; x[5] = seedB.y; x[6] = seedB.z; x[7] = max(seedS, 0.0);

  float lambda = 1e-3;
  int used = 0;
  for (int it = 0; it < 32; it++){
    if (it >= uMaxIter) break;
    vec4 ca = vec4(x[0], x[1], x[2], x[3]);
    vec3 cb = vec3(x[4], x[5], x[6]);
    float cs = x[7];
    if (maxResid(ca, cb, cs, tgt) < 1e-5) break;

    float r0[BANDS];
    for (int i = 0; i < BANDS; i++) r0[i] = bandOf(ca, cb, cs, i) - tgt[i];

    float J[BANDS * 8];
    for (int p = 0; p < 8; p++){
      float xp[8];
      for (int k = 0; k < 8; k++) xp[k] = x[k];
      float h = max(1e-5, abs(x[p]) * 1e-4);
      xp[p] += h;
      if (p == 7) xp[7] = max(xp[7], 0.0);
      float den = xp[p] - x[p];
      if (abs(den) < 1e-12) den = 1.0;
      vec4 pa = vec4(xp[0], xp[1], xp[2], xp[3]);
      vec3 pb = vec3(xp[4], xp[5], xp[6]);
      float ps = xp[7];
      for (int i = 0; i < BANDS; i++) J[i * 8 + p] = (bandOf(pa, pb, ps, i) - tgt[i] - r0[i]) / den;
    }

    float H[64];
    float g[8];
    for (int i = 0; i < 8; i++){ g[i] = 0.0; for (int j = 0; j < 8; j++) H[i * 8 + j] = 0.0; }
    for (int i = 0; i < BANDS; i++){
      for (int p = 0; p < 8; p++){
        g[p] += J[i * 8 + p] * r0[i];
        for (int q = 0; q < 8; q++) H[p * 8 + q] += J[i * 8 + p] * J[i * 8 + q];
      }
    }

    float c0 = 0.0;
    for (int i = 0; i < BANDS; i++) c0 += r0[i] * r0[i];

    // Levenberg-Marquardt with step REJECTION. A single damped step per
    // iteration (the naive shape) diverges on a few texels and never returns:
    // measured as 165/255 outliers while the mean stayed at 0.2.
    bool accepted = false;
    for (int attempt = 0; attempt < 4; attempt++){
      float M[72];
      for (int p = 0; p < 8; p++){
        for (int q = 0; q < 8; q++) M[p * 9 + q] = H[p * 8 + q] + (p == q ? lambda * (1.0 + abs(H[p * 8 + q])) : 0.0);
        M[p * 9 + 8] = -g[p];
      }
      float d[8];
      if (!solve8(M, d)){ lambda *= 6.0; continue; }
      float xn[8];
      for (int k = 0; k < 8; k++) xn[k] = x[k] + d[k];
      xn[7] = max(xn[7], 0.0);
      vec4 na = vec4(xn[0], xn[1], xn[2], xn[3]);
      vec3 nb = vec3(xn[4], xn[5], xn[6]);
      float c2 = costAt(na, nb, xn[7], tgt);
      if (c2 < c0){
        for (int k = 0; k < 8; k++) x[k] = xn[k];
        lambda = max(lambda / 3.0, 1e-7);
        accepted = true;
        break;
      }
      lambda *= 6.0;
    }
    if (!accepted) break;
    used = it + 1;
  }

  oA = vec4(x[0], x[1], x[2], x[3]);
  oB = vec4(x[4], x[5], x[6], max(x[7], 0.0));
  oIter = vec4(float(used), lambda, 0.0, 0.0);
}`;
}

const RGBA16F: Format = { internal: 0x881a, format: 0x1908, type: 0x140b } // RGBA16F / RGBA / HALF_FLOAT
const R16F: Format = { internal: 0x822d, format: 0x1903, type: 0x140b }    // R16F / RED / HALF_FLOAT

export interface MergeInputs {
  baseA: Uint16Array
  baseB: Uint16Array
  layerA: Uint16Array
  layerB: Uint16Array
  cover: Uint16Array
  lateral: Uint16Array
}

export interface MergeSeed {
  w: number
  h: number
  a: Uint16Array
  b: Uint16Array
}

/**
 * One merge pass. `outScale > 1` renders into a downscaled target — that is the
 * coarse seeding pass; the fine pass samples its output with LINEAR filtering.
 */
export class MergePass {
  readonly outW: number
  readonly outH: number
  private readonly gl: GL
  private readonly w: number
  private readonly h: number
  private readonly opts: MergeOptions
  private readonly program: ReturnType<GL['program']>
  private readonly out: Target
  private readonly seedTargets: { a: Target; b: Target } | null
  private inputs: Record<string, WebGLTexture> = {}

  amount = 1
  start = 0.3
  falloff = 0.5

  constructor(gl: GL, w: number, h: number, opts: MergeOptions, outScale = 1) {
    this.gl = gl
    this.w = w
    this.h = h
    this.opts = opts
    this.outW = Math.max(1, Math.round(w / outScale))
    this.outH = Math.max(1, Math.round(h / outScale))
    this.program = gl.program(mergeFragmentShader(opts))
    this.out = gl.target(this.outW, this.outH, [RGBA16F, RGBA16F, R16F], gl.gl.NEAREST)
    this.seedTargets = opts.seeded
      ? { a: gl.target(w, h, [RGBA16F], gl.gl.LINEAR), b: gl.target(w, h, [RGBA16F], gl.gl.LINEAR) }
      : null
  }

  upload(inputs: MergeInputs): void {
    const { gl } = this
    const g = gl.gl
    while (g.getError() !== g.NO_ERROR) { /* clear stale state */ }
    this.inputs = {
      baseA: gl.texture(this.w, this.h, RGBA16F, inputs.baseA, g.NEAREST),
      baseB: gl.texture(this.w, this.h, RGBA16F, inputs.baseB, g.NEAREST),
      layerA: gl.texture(this.w, this.h, RGBA16F, inputs.layerA, g.NEAREST),
      layerB: gl.texture(this.w, this.h, RGBA16F, inputs.layerB, g.NEAREST),
      cover: gl.texture(this.w, this.h, R16F, inputs.cover, g.NEAREST),
      lateral: gl.texture(this.w, this.h, R16F, inputs.lateral, g.NEAREST),
    }
  }

  uploadSeed(seed: MergeSeed): void {
    if (!this.seedTargets) return
    const g = this.gl.gl
    this.gl.uploadHalf(this.seedTargets.a.tex[0]!, 0, 0, seed.w, seed.h, g.RGBA, seed.a)
    this.gl.uploadHalf(this.seedTargets.b.tex[0]!, 0, 0, seed.w, seed.h, g.RGBA, seed.b)
  }

  /** Draw over `rect` (in the pass's own output resolution) and return the median wall clock. */
  run(rect: Rect, repeats = 20): number {
    const g = this.gl
    const raw = g.gl
    const p = this.program
    p.bind()
    raw.disable(raw.BLEND)
    raw.uniform2f(p.u.uOutSize!, this.outW, this.outH)
    raw.uniform1i(p.u.uMaxIter!, this.opts.iterations)
    raw.uniform1i(p.u.uCoreSkip!, this.opts.coreSkip ? 1 : 0)
    raw.uniform1i(p.u.uSeedOn!, this.opts.seeded ? 1 : 0)
    raw.uniform1i(p.u.uDebug!, 0)
    raw.uniform1i(p.u.uBaseA!, g.bindTex(0, this.inputs.baseA!))
    raw.uniform1i(p.u.uBaseB!, g.bindTex(1, this.inputs.baseB!))
    raw.uniform1i(p.u.uLayerA!, g.bindTex(2, this.inputs.layerA!))
    raw.uniform1i(p.u.uLayerB!, g.bindTex(3, this.inputs.layerB!))
    raw.uniform1i(p.u.uCover!, g.bindTex(4, this.inputs.cover!))
    raw.uniform1i(p.u.uLateral!, g.bindTex(5, this.inputs.lateral!))
    const seedA = this.seedTargets?.a.tex[0] ?? this.inputs.layerA!
    const seedB = this.seedTargets?.b.tex[0] ?? this.inputs.layerB!
    raw.uniform1i(p.u.uSeedA!, g.bindTex(6, seedA))
    raw.uniform1i(p.u.uSeedB!, g.bindTex(7, seedB))
    raw.uniform1f(p.u.uAmount!, this.amount)
    raw.uniform1f(p.u.uStart!, this.start)
    raw.uniform1f(p.u.uFalloff!, this.falloff)

    // `gl.finish()` is NOT a reliable fence in WebGL — it returned before the
    // work landed and every timing read 0.000. A 1x1 readPixels from the merge
    // target is the fence: it cannot complete until the draw has.
    const fence = new Float32Array(4)
    const fenceRead = () => {
      raw.bindFramebuffer(raw.FRAMEBUFFER, this.out.fbo)
      raw.readPixels(0, 0, 1, 1, raw.RGBA, raw.FLOAT, fence)
    }
    g.draw(this.out, rect)
    fenceRead()
    this.lastError = raw.getError()
    const t0 = performance.now()
    for (let i = 0; i < repeats; i++) g.draw(this.out, rect)
    fenceRead()
    const total = performance.now() - t0
    return total / repeats
  }

  lastError = 0

  /** Which of the expected uniforms the linker actually kept (null = optimised out). */
  /** Draw with the fit bypassed, so the sampled inputs and alpha can be read back. */
  runDebug(rect: Rect): void {
    const g = this.gl
    const raw = g.gl
    const p = this.program
    p.bind()
    raw.disable(raw.BLEND)
    raw.uniform2f(p.u.uOutSize!, this.outW, this.outH)
    raw.uniform1i(p.u.uMaxIter!, this.opts.iterations)
    raw.uniform1i(p.u.uCoreSkip!, 0)
    raw.uniform1i(p.u.uSeedOn!, 0)
    raw.uniform1i(p.u.uDebug!, 1)
    raw.uniform1i(p.u.uBaseA!, g.bindTex(0, this.inputs.baseA!))
    raw.uniform1i(p.u.uBaseB!, g.bindTex(1, this.inputs.baseB!))
    raw.uniform1i(p.u.uLayerA!, g.bindTex(2, this.inputs.layerA!))
    raw.uniform1i(p.u.uLayerB!, g.bindTex(3, this.inputs.layerB!))
    raw.uniform1i(p.u.uCover!, g.bindTex(4, this.inputs.cover!))
    raw.uniform1i(p.u.uLateral!, g.bindTex(5, this.inputs.lateral!))
    raw.uniform1i(p.u.uSeedA!, g.bindTex(6, this.inputs.layerA!))
    raw.uniform1i(p.u.uSeedB!, g.bindTex(7, this.inputs.layerB!))
    raw.uniform1f(p.u.uAmount!, this.amount)
    raw.uniform1f(p.u.uStart!, this.start)
    raw.uniform1f(p.u.uFalloff!, this.falloff)
    g.draw(this.out, rect)
    raw.finish()
  }

  /** Attach one input texture to a scratch FBO and read a texel — separates
   *  "the texture never got the data" from "the sampling is wrong". */
  readTextureTexel(which: 'baseA' | 'baseB' | 'layerA' | 'layerB' | 'cover' | 'lateral', x: number, y: number): number[] {
    const g = this.gl
    const raw = g.gl
    const tex = this.inputs[which]
    if (!tex) return [-999]
    const fbo = raw.createFramebuffer()!
    raw.bindFramebuffer(raw.FRAMEBUFFER, fbo)
    raw.framebufferTexture2D(raw.FRAMEBUFFER, raw.COLOR_ATTACHMENT0, raw.TEXTURE_2D, tex, 0)
    const status = raw.checkFramebufferStatus(raw.FRAMEBUFFER)
    const out = new Float32Array(4)
    let err = 0
    if (status === raw.FRAMEBUFFER_COMPLETE) {
      raw.readPixels(x, y, 1, 1, raw.RGBA, raw.FLOAT, out)
      err = raw.getError()
    }
    raw.bindFramebuffer(raw.FRAMEBUFFER, null)
    raw.deleteFramebuffer(fbo)
    return [out[0]!, out[1]!, out[2]!, out[3]!, status, err]
  }

  uniformStatus(): Record<string, boolean> {
    const out: Record<string, boolean> = {}
    for (const [k, v] of Object.entries(this.program.u)) out[k] = v !== null
    return out
  }

  /** A trivial pass: proves the draw + MRT + readback plumbing writes at all. */
  static writeTest(gl: GL, w: number, h: number): { ok: boolean; read: number[] } {
    const src = `#version 300 es
precision highp float;
layout(location=0) out vec4 oA;
layout(location=1) out vec4 oB;
void main(){ oA = vec4(0.25, 0.5, 0.75, 1.0); oB = vec4(2.0, 3.0, 4.0, 5.0); }`
    const prog = gl.program(src)
    const t = gl.target(w, h, [RGBA16F, RGBA16F], gl.gl.NEAREST)
    prog.bind()
    gl.gl.disable(gl.gl.BLEND)
    gl.draw(t, { x0: 0, y0: 0, x1: w, y1: h })
    gl.gl.finish()
    const a = gl.readHalf(t.views[0]!, w, h, 4, { x0: 0, y0: 0, x1: 1, y1: 1 })
    const b = gl.readHalf(t.views[1]!, w, h, 4, { x0: 0, y0: 0, x1: 1, y1: 1 })
    gl.disposeTarget(t)
    return { ok: a[0] !== 0, read: [a[0]!, a[1]!, b[0]!, b[3]!] }
  }

  readA(rect: Rect): Uint16Array { return this.gl.readHalf(this.out.views[0]!, this.outW, this.outH, 4, rect) }
  readB(rect: Rect): Uint16Array { return this.gl.readHalf(this.out.views[1]!, this.outW, this.outH, 4, rect) }
  readIterations(rect: Rect): Uint16Array { return this.gl.readHalf(this.out.views[2]!, this.outW, this.outH, 1, rect) }

  dispose(): void {
    const g = this.gl
    g.disposeTarget(this.out)
    if (this.seedTargets) { g.disposeTarget(this.seedTargets.a); g.disposeTarget(this.seedTargets.b) }
    for (const tex of Object.values(this.inputs)) g.gl.deleteTexture(tex)
  }
}

/**
 * Pack a float sheet into a SINGLE-lane half-float array, for an R16F texture.
 * Feeding a 4-lane array to an R16F texture reads a quarter of the image,
 * misaligned — the bug that first made the cover read 0 everywhere.
 */
export function halfR(src: Float32Array): Uint16Array {
  const out = new Uint16Array(src.length)
  for (let i = 0; i < src.length; i++) out[i] = toHalf(src[i]!)
  return out
}

/** Pack a 4-lane float sheet (the `a` coefficients) into an RGBA16F texture's lanes. */
export function halfA(src: Float32Array): Uint16Array {
  const out = new Uint16Array(src.length)
  for (let i = 0; i < src.length; i++) out[i] = toHalf(src[i]!)
  return out
}

/** Pack the 3 `b` coefficients + the scatter into four lanes. */
export function halfB(b: Float32Array, s: Float32Array): Uint16Array {
  const n = s.length
  const out = new Uint16Array(n * 4)
  for (let i = 0; i < n; i++) {
    out[i * 4] = toHalf(b[i * 3]!)
    out[i * 4 + 1] = toHalf(b[i * 3 + 1]!)
    out[i * 4 + 2] = toHalf(b[i * 3 + 2]!)
    out[i * 4 + 3] = toHalf(s[i]!)
  }
  return out
}
