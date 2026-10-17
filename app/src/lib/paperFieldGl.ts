/**
 * Offscreen WebGL2 host for the watercolor-playground paper shaders.
 *
 * 261017-lny Bug 1: the CPU port in playgroundPaperField.ts is correct but
 * evaluates a multi-octave noise stack per fond pixel (2M+ at 1080p). The
 * playground is instant because the same math runs as GLSL fragment shaders
 * in one GPU pass each. This module runs those sources essentially verbatim —
 * not a redesign, not a re-derivation (the user has rejected re-derivation
 * twice). Line-audit against:
 *
 *   SPECS/v1.1.0-water-color/watercolor-playground/src/engine/
 *     gl.ts       QUAD_VS          (5-9)    → QUAD_VS
 *     shaders.ts  HEADER           (11-14)  → HEADER
 *                 paperFieldFS     (274-489)→ PAPER_FIELD_FS
 *                 paperLightFS     (493-507)→ PAPER_LIGHT_FS
 *                 PAPER_COLOUR     (510-518)→ PAPER_COLOUR
 *                 TO_SRGB          (520-524)→ TO_SRGB
 *     Engine.ts   drawPaper        (817-835)→ three-pass pipeline
 *                 paperUniforms    (838-844)→ colour uniforms
 *
 * 261017-mdr: the sheet is presented by handing out the shared GL canvas
 * (pass 3 draws to the default framebuffer). No pixel readback, no per-row JS
 * copy — the playground displays its GL target directly (Engine.ts drawPaper);
 * only the thumbnail helper (paperSwatch) ever read pixels back, and that tail
 * is not the sheet path.
 *
 * GL pattern: lazy shared offscreen WebGL2 in the shape of glMotionBlur.ts
 * (getGL / compileShader / createProgram / framebuffer), with a
 * null-on-failure contract like fxBlur.ts's GPU-first / CPU-fallback split.
 * Never throws into the Studio — renderPaperSheetGl returns null and the CPU
 * port fills in (AquarelleCanvasLayer precedent: no WebGL2 leaves the surface
 * blank rather than crashing the Studio).
 */

import {
  linearRGB,
  type StudioPaperPreset,
} from '@efxlab/efx-watercolor/papers';

// ---- Oracle GLSL (copied, not re-derived) ----

/** gl.ts:5-9 — full-screen triangle supplying vUv. */
export const QUAD_VS = `#version 300 es
precision highp float;
layout(location=0) in vec2 aPos;
out vec2 vUv;
void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

/** shaders.ts:11-14. */
const HEADER = `#version 300 es
precision highp float;
in vec2 vUv;
`;

/**
 * shaders.ts:274-489 — primitives + 10 kinds + main() coordinate law
 * `p = (vUv * uRes + uOffset) * uScale`. Constants (mat2 rotation, salts,
 * coefficients) are the look: do not tidy.
 */
export const PAPER_FIELD_FS = `${HEADER}
out vec4 o;
uniform vec2 uRes, uOffset;   // target size and where it sits on the sheet (texels)
uniform float uScale;         // units per texel
uniform float uSeed;
uniform int uKind;
const float PI = 3.14159265;

uint pcg(uint v){ uint s = v * 747796405u + 2891336453u; uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u; return (w >> 22u) ^ w; }
float hash(vec2 c, float salt){
  ivec2 i = ivec2(floor(c));
  return float(pcg(uint(i.x) + pcg(uint(i.y) + pcg(uint(salt) + uint(uSeed * 7919.0))))) * (1.0 / 4294967296.0);
}
vec2 hash2(vec2 c, float salt){ return vec2(hash(c, salt), hash(c, salt + 1.0)); }
float vnoise(vec2 p, float salt){
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i, salt), hash(i + vec2(1.0, 0.0), salt), f.x),
             mix(hash(i + vec2(0.0, 1.0), salt), hash(i + vec2(1.0, 1.0), salt), f.x), f.y);
}
// normalised to 0..1; each octave rotated so the lattice never shows
float fbm(vec2 p, int oct, float salt){
  float v = 0.0, a = 0.5, n = 0.0;
  for (int i = 0; i < 6; i++){
    if (i >= oct) break;
    v += a * vnoise(p, salt + float(i) * 13.0); n += a;
    p = mat2(0.8, -0.6, 0.6, 0.8) * p * 2.03 + 17.1; a *= 0.5;
  }
  return v / n;
}
// distances to the nearest and second-nearest of a jittered lattice of points
vec2 cells(vec2 p, float jitter, float salt){
  vec2 i = floor(p), f = fract(p);
  float d1 = 9.0, d2 = 9.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++){
    vec2 c = vec2(x, y);
    float d = length(c + 0.5 + (hash2(i + c, salt) - 0.5) * jitter - f);
    if (d < d1){ d2 = d1; d1 = d; } else if (d < d2) d2 = d;
  }
  return vec2(d1, d2);
}
// Rounded hills of random size and height scattered on a jittered grid; never polygonal
// like cells, because neighbouring hills simply add up. Roughly 0..1.
float blobs(vec2 p, float salt){
  vec2 i = floor(p), f = fract(p);
  float h = 0.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++){
    vec2 c = vec2(x, y);
    vec4 r = vec4(hash2(i + c, salt), hash2(i + c, salt + 2.0));
    vec2 d = c + r.xy - f;
    float rad = 0.35 + 0.4 * r.z;
    h += (0.5 + 0.5 * r.w) * exp(-dot(d, d) / (rad * rad));
  }
  return h * 0.75;
}
float segment(vec2 p, vec2 a, vec2 b){
  vec2 pa = p - a, ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
}
// Thin strands scattered over a grid of 'cell' units, up to 'len' cells long and 'width'
// units wide; returns the coverage of the nearest. 'along' lines them up with x, the
// way a paper machine lays its fibres; 'density' is the share of grid slots that hold one.
float fibres(vec2 p, float cell, float len, float width, float density, float along, float salt){
  p /= cell;
  vec2 i = floor(p);
  float cov = 0.0;
  for (int y = -2; y <= 2; y++) for (int x = -2; x <= 2; x++){
    vec2 c = i + vec2(x, y);
    for (int k = 0; k < 2; k++){
      float s = salt + float(k) * 31.0;
      vec4 h = vec4(hash2(c, s), hash2(c, s + 2.0));
      if (h.w < density){
        float a = (h.z - 0.5) * PI * (1.0 - along);
        vec2 d = vec2(cos(a), sin(a)) * len * (0.35 + 0.65 * hash(c, s + 4.0)) * 0.5;
        float dist = segment(p, c + h.xy - d, c + h.xy + d) * cell;
        cov = max(cov, (1.0 - smoothstep(width * 0.5, width * 0.5 + 0.9, dist)) * (0.55 + 0.45 * hash(c, s + 5.0)));
      }
    }
  }
  return cov;
}
// small round specks: coverage of the nearest, 'density' of grid slots hold one
float specks(vec2 p, float cell, float radius, float density, float salt){
  vec2 i = floor(p / cell), f = p / cell - i;
  float cov = 0.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++){
    vec2 c = vec2(x, y);
    if (hash(i + c, salt + 2.0) < density){
      float r = radius * (0.4 + 0.6 * hash(i + c, salt + 3.0));
      float d = length(c + hash2(i + c, salt) - f) * cell;
      cov = max(cov, 1.0 - smoothstep(r * 0.6, r + 0.6, d));
    }
  }
  return cov;
}
// distance to the nearest centre of a hexagonal lattice with spacing 1
float hexDist(vec2 p){
  const vec2 s = vec2(1.0, 1.7320508);
  vec2 a = mod(p, s) - s * 0.5, b = mod(p - s * 0.5, s) - s * 0.5;
  return min(length(a), length(b));
}
vec2 warp(vec2 p, float freq, float amount, float salt){
  return p + (vec2(fbm(p * freq, 3, salt), fbm(p * freq, 3, salt + 50.0)) - 0.5) * amount;
}

// Cold press: rounded, irregular bumps of mixed size (~0.5-2 mm) over a fine felt.
vec3 coldPress(vec2 p){
  vec2 q = warp(p, 0.02, 10.0, 100.0);
  float hills = blobs(q / 11.0, 110.0) * 0.6 + blobs(q / 5.5, 115.0) * 0.4;
  float h = hills * 0.5 + fbm(q * 0.09, 5, 120.0) * 0.38 + vnoise(p * 0.5, 130.0) * 0.12;
  return vec3(0.5 + (h - 0.5) * 1.3, fbm(p * 0.012, 4, 140.0), 0.5);
}
// Hot press: pressed nearly flat; only a faint felt and the fibres show.
vec3 hotPress(vec2 p){
  float h = fbm(p * 0.06, 4, 200.0) * 0.6 + vnoise(p * 0.4, 210.0) * 0.25 + fibres(p, 16.0, 2.5, 0.8, 0.3, 0.0, 220.0) * 0.05;
  return vec3(0.5 + (h - 0.4) * 0.45, fbm(p * 0.01, 4, 230.0), 0.5);
}
// Rough: big knobbly hills (~2-4 mm) with deep valleys between them.
vec3 rough(vec2 p){
  vec2 q = warp(p, 0.01, 40.0, 300.0);
  // hill size varies across the sheet, as on a mould-made rough
  float big = smoothstep(0.3, 0.7, fbm(p * 0.006, 3, 305.0));
  float hills = blobs(q / 26.0, 310.0) * (0.35 + 0.4 * big) + blobs(q / 12.0, 315.0) * (0.45 - 0.25 * big);
  float h = hills * 0.65 + fbm(q * 0.06, 5, 320.0) * 0.25 + vnoise(p * 0.45, 325.0) * 0.1;
  return vec3(0.5 + (h - 0.52) * 1.5, fbm(p * 0.01, 4, 330.0), 0.5);
}
// Khadi: handmade, lumpy at every scale, with raised fibres and dark inclusions.
vec3 khadi(vec2 p){
  vec2 q = warp(p, 0.008, 60.0, 400.0);
  float lumps = fbm(q * 0.035, 5, 410.0);
  vec2 c = cells(q / 13.0, 1.0, 420.0);
  float knobs = 1.0 - smoothstep(0.0, 0.9, c.x);
  float fib = fibres(warp(p, 0.05, 8.0, 430.0), 9.0, 3.0, 1.1, 0.6, 0.0, 440.0);
  float h = lumps * 0.5 + knobs * 0.3 + fbm(p * 0.2, 3, 450.0) * 0.16 + fib * 0.03;
  float dark = max(specks(p, 60.0, 2.0, 0.3, 460.0), fibres(warp(p, 0.06, 10.0, 465.0), 110.0, 0.4, 0.9, 0.3, 0.0, 470.0) * 0.6);
  return vec3(0.5 + (h - 0.5) * 1.6, fbm(p * 0.006, 4, 480.0) * 0.7 + fib * 0.25, 0.5 - dark * 0.35 + fib * 0.06);
}
// Washi: smooth and cloudy, a web of long kozo fibres lying on top, the odd bark speck.
vec3 washi(vec2 p){
  vec2 q = warp(p, 0.025, 28.0, 500.0);
  float longF = fibres(q, 42.0, 3.4, 1.3, 0.4, 0.0, 510.0) * (0.6 + 0.4 * vnoise(p * 0.05, 512.0));
  float fineF = fibres(warp(p, 0.05, 10.0, 515.0), 14.0, 3.0, 0.6, 0.45, 0.0, 520.0);
  float h = fbm(p * 0.05, 4, 530.0) * 0.8 + longF * 0.08 + fineF * 0.03;
  float cloud = fbm(p * 0.005, 5, 540.0);
  float bark = specks(p, 70.0, 1.6, 0.18, 550.0);
  return vec3(0.5 + (h - 0.42) * 0.7, cloud * 0.85 + longF * 0.15, 0.5 + longF * 0.16 + fineF * 0.05 - bark * 0.4);
}
// Laid: close laid lines (~1 mm) crossed by chain lines (~25 mm), over a soft felt.
vec3 laid(vec2 p){
  float wob = (fbm(p * vec2(0.004, 0.02), 3, 600.0) - 0.5) * 6.0;
  float lines = pow(0.5 + 0.5 * cos(2.0 * PI * (p.y + wob) / 5.6), 2.0);
  float cx = p.x + (fbm(p * vec2(0.02, 0.004), 3, 610.0) - 0.5) * 8.0;
  float dc = abs(fract(cx / 140.0) - 0.5) * 140.0;   // distance to the nearest chain line
  float chain = 1.0 - smoothstep(1.0, 3.5, dc);
  float h = lines * 0.1 + chain * 0.05 + fbm(p * 0.08, 4, 620.0) * 0.6;
  // the sheet runs a touch thicker beside each chain line, and the laid lines read faintly in the tone
  float tone = 0.5 - 0.12 * exp(-dc / 12.0) - 0.06 * lines + (fbm(p * 0.01, 3, 630.0) - 0.5) * 0.6;
  return vec3(0.5 + (h - 0.36) * 1.1, tone, 0.5);
}
// Canvas: a plain weave of slightly uneven threads under a coat of gesso.
vec3 canvas(vec2 p){
  const float T = 8.0;
  p += (vec2(vnoise(p * 0.02, 700.0), vnoise(p * 0.02, 701.0)) - 0.5) * T * 1.2;
  vec2 c = p / T, i = floor(c), f = fract(c);
  float tx = 0.8 + 0.2 * hash(vec2(i.x, 0.0), 702.0) + 0.3 * (vnoise(vec2(i.x * 5.0, c.y * 0.35), 703.0) - 0.5);
  float ty = 0.8 + 0.2 * hash(vec2(0.0, i.y), 704.0) + 0.3 * (vnoise(vec2(c.x * 0.35, i.y * 5.0), 705.0) - 0.5);
  // where a thread crosses over, it shows as a rice-grain bump along its length;
  // over and under alternate, so the grains make a checkerboard
  vec2 d = f - 0.5;
  bool warpUp = mod(i.x + i.y, 2.0) > 0.5;
  d *= warpUp ? vec2(2.3, 1.15) : vec2(1.15, 2.3);
  float grain = max(0.0, 1.0 - dot(d, d)) * (warpUp ? tx : ty);
  float h = sqrt(grain) * 0.75 + fbm(p * 0.15, 3, 706.0) * 0.25;
  return vec3(0.5 + (h - 0.55) * 1.1, fbm(p * 0.01, 3, 707.0), 0.5);
}
// Toned (Mi-Teintes honeycomb): a regular mesh of shallow pits ~1.5 mm across.
vec3 toned(vec2 p){
  vec2 q = warp(p, 0.05, 7.0, 800.0) / 9.0;
  float d = hexDist(q) * (0.8 + 0.4 * vnoise(q * 2.0, 805.0));
  float rims = smoothstep(0.1, 0.55, d);
  float h = rims * 0.28 + fbm(p * 0.09, 4, 810.0) * 0.6 + fibres(p, 12.0, 2.0, 0.9, 0.35, 0.0, 820.0) * 0.04;
  return vec3(0.5 + (h - 0.42) * 1.2, fbm(p * 0.012, 4, 830.0), 0.5 - specks(p, 60.0, 1.2, 0.2, 840.0) * 0.3);
}
// Kraft: smooth, streaky along the machine direction, with dark bark and recycled flecks.
vec3 kraft(vec2 p){
  float h = fbm(p * 0.07, 4, 900.0) * 0.6 + vnoise(p * 0.35, 910.0) * 0.32 + fibres(p, 10.0, 2.5, 0.9, 0.6, 0.7, 920.0) * 0.04;
  float streak = fbm(p * vec2(0.004, 0.03), 5, 930.0);
  float dark = max(fibres(warp(p, 0.08, 10.0, 935.0), 60.0, 0.35, 0.7, 0.2, 0.6, 940.0) * 0.6, specks(p, 40.0, 1.3, 0.35, 950.0));
  float light = fibres(warp(p, 0.08, 10.0, 955.0), 70.0, 0.4, 1.0, 0.25, 0.5, 960.0);
  return vec3(0.5 + (h - 0.45) * 0.7, streak * 0.8 + fbm(p * 0.01, 3, 970.0) * 0.2, 0.5 - dark * 0.28 + light * 0.12);
}
// Student (cellulose): a felt-pressed texture of small bumps all of one size, evenly spread.
vec3 student(vec2 p){
  vec2 q = warp(p, 0.03, 3.0, 995.0);
  vec2 c = cells(q / 7.0, 0.7, 1000.0);
  float bumps = 1.0 - smoothstep(0.0, 0.7, c.x);
  float h = bumps * 0.6 + fbm(p * 0.12, 3, 1010.0) * 0.4;
  return vec3(0.5 + (h - 0.48) * 1.1, fbm(p * 0.015, 3, 1020.0), 0.5);
}

void main(){
  vec2 p = (vUv * uRes + uOffset) * uScale;
  vec3 f;
  switch (uKind){
    case 1: f = hotPress(p); break;
    case 2: f = rough(p); break;
    case 3: f = khadi(p); break;
    case 4: f = washi(p); break;
    case 5: f = laid(p); break;
    case 6: f = canvas(p); break;
    case 7: f = toned(p); break;
    case 8: f = kraft(p); break;
    case 9: f = student(p); break;
    default: f = coldPress(p);
  }
  o = vec4(clamp(f, 0.0, 1.0), 1.0);
}`;

/**
 * shaders.ts:493-507 — neighbour normal, uBump, L = normalize(vec3(-0.5, 0.6, 0.62)),
 * lit = 0.5 + (dot(n, L) - L.z) * 1.3 + (f.x - 0.5) * 0.25.
 */
export const PAPER_LIGHT_FS = `${HEADER}
out vec4 o;
uniform sampler2D uField;
uniform vec2 uTexel;
uniform float uBump;          // relief strength, already divided by units per texel
void main(){
  vec4 f = texture(uField, vUv);
  float l = texture(uField, vUv - vec2(uTexel.x, 0.0)).x, r = texture(uField, vUv + vec2(uTexel.x, 0.0)).x;
  float b = texture(uField, vUv - vec2(0.0, uTexel.y)).x, t = texture(uField, vUv + vec2(0.0, uTexel.y)).x;
  vec3 n = normalize(vec3((l - r) * uBump, (b - t) * uBump, 1.0));
  vec3 L = normalize(vec3(-0.5, 0.6, 0.62));
  // a little ambient occlusion: valleys sit in shadow whichever way the light falls
  float lit = 0.5 + (dot(n, L) - L.z) * 1.3 + (f.x - 0.5) * 0.25;
  o = vec4(clamp(lit, 0.0, 1.0), f.x, f.y, f.z);
}`;

/** shaders.ts:510-518. */
const PAPER_COLOUR = `
uniform vec3 uPaperTint, uFleckTint;
uniform float uMottle;
uniform float uTexture;       // texture strength: 0 a flat sheet of the tint, 1 full relief
vec3 paperColour(vec4 paper, vec3 base){
  vec3 c = base * (1.0 + uTexture * ((paper.r - 0.5) * 0.32 + (paper.b - 0.5) * uMottle * 2.0));
  float fl = (paper.a - 0.5) * 2.0 * uTexture;
  return fl < 0.0 ? mix(c, uFleckTint, -fl) : mix(c, min(base * 1.1 + 0.02, vec3(1.0)), fl);
}`;

/** shaders.ts:520-524. */
const TO_SRGB = `
vec3 toSRGB(vec3 c){
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}`;

/**
 * The sheet's opaque sRGB colour — paperSwatchFS (shaders.ts:527-541) minus
 * the ultramarine wash; the CPU renderPaperSheet already ends at
 * paperColourSRGB(..., textureStrength = 1).
 */
export const PAPER_SHEET_FS = `${HEADER}
out vec4 o;
uniform sampler2D uPaper;
${PAPER_COLOUR}
${TO_SRGB}
void main(){
  vec4 paper = texture(uPaper, vUv);
  vec3 c = paperColour(paper, uPaperTint);
  o = vec4(toSRGB(c), 1.0);
}`;

// ---- Cached GL state (glMotionBlur shape) ----

interface PaperGlResources {
  vao: WebGLVertexArrayObject;
  fieldProgram: WebGLProgram;
  lightProgram: WebGLProgram;
  sheetProgram: WebGLProgram;
}

let _gl: WebGL2RenderingContext | null = null;
let _glCanvas: HTMLCanvasElement | null = null;
let _resources: PaperGlResources | null = null;
let _initFailed = false;

function getGL(): WebGL2RenderingContext | null {
  if (_initFailed) return null;
  if (_gl) return _gl;
  if (typeof document === 'undefined') {
    _initFailed = true;
    return null;
  }

  _glCanvas = document.createElement('canvas');
  const gl = _glCanvas.getContext('webgl2', {
    premultipliedAlpha: false,
    preserveDrawingBuffer: true,
    antialias: false,
    depth: false,
    stencil: false,
  });

  if (!gl) {
    console.warn('paperFieldGl: WebGL2 not available');
    _initFailed = true;
    return null;
  }

  _glCanvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    _gl = null;
    _resources = null;
  });

  _gl = gl;
  return _gl;
}

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn('paperFieldGl shader compile:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(
  gl: WebGL2RenderingContext,
  vertSrc: string,
  fragSrc: string,
): WebGLProgram | null {
  const vert = compileShader(gl, gl.VERTEX_SHADER, vertSrc);
  const frag = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc);
  if (!vert || !frag) {
    if (vert) gl.deleteShader(vert);
    if (frag) gl.deleteShader(frag);
    return null;
  }
  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vert);
    gl.deleteShader(frag);
    return null;
  }
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  gl.deleteShader(vert);
  gl.deleteShader(frag);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn('paperFieldGl program link:', gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

function ensureResources(gl: WebGL2RenderingContext): PaperGlResources | null {
  if (_resources) return _resources;

  const fieldProgram = createProgram(gl, QUAD_VS, PAPER_FIELD_FS);
  const lightProgram = createProgram(gl, QUAD_VS, PAPER_LIGHT_FS);
  const sheetProgram = createProgram(gl, QUAD_VS, PAPER_SHEET_FS);
  if (!fieldProgram || !lightProgram || !sheetProgram) {
    if (fieldProgram) gl.deleteProgram(fieldProgram);
    if (lightProgram) gl.deleteProgram(lightProgram);
    if (sheetProgram) gl.deleteProgram(sheetProgram);
    _initFailed = true;
    return null;
  }

  // Full-screen triangle (gl.ts:51) — same geometry as the playground.
  const vao = gl.createVertexArray();
  if (!vao) {
    gl.deleteProgram(fieldProgram);
    gl.deleteProgram(lightProgram);
    gl.deleteProgram(sheetProgram);
    _initFailed = true;
    return null;
  }
  gl.bindVertexArray(vao);
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  _resources = { vao, fieldProgram, lightProgram, sheetProgram };
  return _resources;
}

interface RenderTarget {
  fbo: WebGLFramebuffer;
  tex: WebGLTexture;
  dispose(): void;
}

/**
 * One colour attachment. Prefers RGBA16F (the playground's HALF_FLOAT_RGBA
 * field target, Engine.ts:819) when float render targets are available;
 * falls back to RGBA8 — the final output is 8-bit sRGB anyway.
 */
function createTarget(
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
  preferFloat: boolean,
): RenderTarget | null {
  const floatOk = preferFloat && (
    !!gl.getExtension('EXT_color_buffer_float')
    || !!gl.getExtension('EXT_color_buffer_half_float')
  );
  const attempts: Array<{ internal: number; filter: number }> = floatOk
    ? [{ internal: gl.RGBA16F, filter: gl.NEAREST }, { internal: gl.RGBA8, filter: gl.LINEAR }]
    : [{ internal: gl.RGBA8, filter: gl.LINEAR }];

  for (const attempt of attempts) {
    const tex = gl.createTexture();
    const fbo = gl.createFramebuffer();
    if (!tex || !fbo) {
      if (tex) gl.deleteTexture(tex);
      if (fbo) gl.deleteFramebuffer(fbo);
      continue;
    }
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, attempt.filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, attempt.filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texStorage2D(gl.TEXTURE_2D, 1, attempt.internal, width, height);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return {
        fbo,
        tex,
        dispose() {
          gl.deleteFramebuffer(fbo);
          gl.deleteTexture(tex);
        },
      };
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(fbo);
    gl.deleteTexture(tex);
  }
  return null;
}

function uniform(gl: WebGL2RenderingContext, program: WebGLProgram, name: string): WebGLUniformLocation | null {
  return gl.getUniformLocation(program, name);
}

/**
 * Three-pass sheet render matching renderPaperSheet's semantics:
 *   1. paperFieldFS → field (RGBA16F when available, else RGBA8)
 *   2. paperLightFS → packed paper texel (uBump = (preset.bump * 1.4) / scale)
 *   3. PAPER_COLOUR + toSRGB at uTexture = 1 → opaque sRGB on the default
 *      framebuffer (the shared GL canvas sized to the sheet).
 *
 * 261017-mdr: the sheet is the GL canvas itself — callers GPU-blit it with
 * drawImage into their own cache. No pixel readback and no per-row JS copy.
 *
 * @returns the shared offscreen GL canvas (DOM orientation — the same look the
 *          playground displays), or null when WebGL2 / compile / render-target
 *          setup fails — never throws into the Studio.
 */
export function renderPaperSheetGl(
  width: number,
  height: number,
  scale: number,
  seed: number,
  preset: StudioPaperPreset,
): HTMLCanvasElement | null {
  try {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) return null;
    if (!Number.isFinite(scale) || !(scale > 0) || !Number.isFinite(seed)) return null;

    const gl = getGL();
    if (!gl || !_glCanvas) return null;
    const res = ensureResources(gl);
    if (!res) return null;

    // The sheet lands on the default framebuffer at sheet resolution. Assigning
    // width/height resets the drawing buffer — safe because every call redraws.
    if (_glCanvas.width !== width) _glCanvas.width = width;
    if (_glCanvas.height !== height) _glCanvas.height = height;

    const field = createTarget(gl, width, height, true);
    const paper = createTarget(gl, width, height, false);
    if (!field || !paper) {
      field?.dispose();
      paper?.dispose();
      return null;
    }

    try {
      gl.bindVertexArray(res.vao);
      gl.viewport(0, 0, width, height);

      // Pass 1 — field (Engine.ts:817-827)
      gl.bindFramebuffer(gl.FRAMEBUFFER, field.fbo);
      gl.useProgram(res.fieldProgram);
      gl.uniform2f(uniform(gl, res.fieldProgram, 'uRes'), width, height);
      gl.uniform2f(uniform(gl, res.fieldProgram, 'uOffset'), 0, 0);
      gl.uniform1f(uniform(gl, res.fieldProgram, 'uScale'), scale);
      gl.uniform1f(uniform(gl, res.fieldProgram, 'uSeed'), seed);
      gl.uniform1i(uniform(gl, res.fieldProgram, 'uKind'), preset.kind);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      // Pass 2 — light (Engine.ts:828-834)
      gl.bindFramebuffer(gl.FRAMEBUFFER, paper.fbo);
      gl.useProgram(res.lightProgram);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, field.tex);
      gl.uniform1i(uniform(gl, res.lightProgram, 'uField'), 0);
      gl.uniform2f(uniform(gl, res.lightProgram, 'uTexel'), 1 / width, 1 / height);
      // Engine.ts:833 — uBump = (preset.bump * 1.4) / scale
      gl.uniform1f(uniform(gl, res.lightProgram, 'uBump'), (preset.bump * 1.4) / scale);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      // Pass 3 — colour + toSRGB (Engine.ts:838-844 paperUniforms at uTexture = 1)
      // → the default framebuffer so the sheet lands on the shared GL canvas.
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.useProgram(res.sheetProgram);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, paper.tex);
      gl.uniform1i(uniform(gl, res.sheetProgram, 'uPaper'), 0);
      gl.uniform3fv(uniform(gl, res.sheetProgram, 'uPaperTint'), linearRGB(preset.tint));
      gl.uniform3fv(uniform(gl, res.sheetProgram, 'uFleckTint'), linearRGB(preset.fleck));
      gl.uniform1f(uniform(gl, res.sheetProgram, 'uMottle'), preset.mottle);
      gl.uniform1f(uniform(gl, res.sheetProgram, 'uTexture'), 1);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      gl.bindVertexArray(null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return _glCanvas;
    } finally {
      field.dispose();
      paper.dispose();
    }
  } catch (error) {
    console.warn('paperFieldGl: falling back to CPU sheet', error);
    return null;
  }
}

/** Test-only deep reset — production keeps the lazy context for the session. */
export function resetPaperFieldGlForTests(): void {
  _gl = null;
  _glCanvas = null;
  _resources = null;
  _initFailed = false;
}
