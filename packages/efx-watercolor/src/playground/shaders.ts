import { displayBasisGLSL } from './spectral';

// Texture layout
//   velocity  RG16F  (sim grid)       water flow, in sim texels / second
//   wet       R16F   (document grid)  standing water on the paper
//   ink       2 × RGBA16F (document)   mobile pigment: A = absorbance coeffs 0..3,
//                                      B.rgb = coeffs 4..6, B.a = scattering (S)
//   fixed     2 × RGBA16F (document)   pigment settled into the paper (B.a = settled S)
//   paper     RGBA8  (document)        r = lit relief, g = height, b = mottle, a = fleck
//   relief    R16F   (document)        paint thickness, lit by displayFS's emboss term

const HEADER = `#version 300 es
precision highp float;
in vec2 vUv;
`;

/** Circular stamp; MRT so one draw writes both pigment textures. */
export const splatFS = `${HEADER}
layout(location=0) out vec4 o0;
layout(location=1) out vec4 o1;
uniform float uAspect, uRadius, uHardness;
uniform vec2 uPoint;
uniform vec4 uColor0, uColor1;
void main(){
  vec2 p = vUv - uPoint; p.x *= uAspect;
  float d = dot(p, p) / (uRadius * uRadius);
  float f = exp(-pow(d, uHardness));
  o0 = uColor0 * f;
  o1 = uColor1 * f;
}`;

// Textured brush dab. The tip texture's square (-1..1) is mapped onto an ellipse of
// the brush's aspect, rotated by uAxis. uRound mixes toward a plain soft ellipse
// (used for the water footprint); uGrain gates the deposit by the paper's height so
// a dry brush only touches the peaks of the tooth.
export const stampFS = `${HEADER}
layout(location=0) out vec4 o0;
layout(location=1) out vec4 o1;
uniform sampler2D uTip, uPaper;
uniform float uAspect, uRadius, uTipAspect, uRound, uGrain, uGrainThr;
uniform float uRough, uJitter;
// quick 261116-inu: the recorded texture rotation, in RADIANS (the engine
// converts the stroke's integer degrees at bind time).
uniform float uTipRotation;
uniform vec2 uPoint, uAxis;
uniform vec4 uColor0, uColor1;
void main(){
  vec2 p = vUv - uPoint; p.x *= uAspect;
  vec2 q = vec2(dot(p, uAxis), dot(p, vec2(-uAxis.y, uAxis.x))) / uRadius;
  q.y /= uTipAspect;
  // Rotate the TIP-SPACE sampling coordinates only. The discard test and every
  // footprint value below keep using the UNROTATED q, so the stamp's silhouette
  // is unchanged and only the texture inside it turns.
  float a = uTipRotation;
  vec2 tq = vec2(q.x * cos(a) - q.y * sin(a), q.x * sin(a) + q.y * cos(a));
  if (abs(q.x) > 1.0 || abs(q.y) > 1.0) discard;
  // Dry media (uRough > 0): every dab reads a different slice of the tip, so
  // the silhouette breaks up randomly instead of repeating one contour.
  float e0 = fract(sin(dot(uPoint, vec2(12.9898, 78.233))) * 43758.5453);
  float e1 = fract(e0 * 63.7264 + 0.37);
  vec2 uv = clamp(tq * 0.5 + 0.5 + (vec2(e0, e1) - 0.5) * uJitter, 0.0, 1.0);
  float t = texture(uTip, uv).r;
  // Re-threshold the tip into a hard, crumbly mask. uRough = 0 keeps the
  // smooth alpha every wet brush expects.
  float th = uRough * 0.45;
  float dry = smoothstep(th, th + 0.02, t);
  float sharp = mix(t, dry, step(0.0001, uRough));
  float d = dot(q, q);
  float round = 1.0 - smoothstep(0.15, 1.0, d);
  float f = mix(sharp, round, uRound);
  float h = texture(uPaper, vUv).g;
  f *= mix(1.0, smoothstep(uGrainThr - 0.08, uGrainThr + 0.08, h), uGrain);
  o0 = uColor0 * f;
  o1 = uColor1 * f;
}`;

// Phase 64 (MED-14): the paint-thickness deposit. Mirrors the footprint HALF of
// stampFS exactly — the same uniforms, tip-space mapping, rotation, dry
// re-threshold and paper-tooth gate — and writes ONE output: the footprint mask
// scaled by the deposit amount. The engine's test compares the two uniform
// sets, so a tip change can never diverge between the pigment stamp and the
// thickness deposit. Nothing but the per-dab deposit and Lift's erosion draw it.
export const reliefFS = `${HEADER}
layout(location=0) out vec4 o0;
uniform sampler2D uTip, uPaper;
uniform float uAspect, uRadius, uTipAspect, uRound, uGrain, uGrainThr;
uniform float uRough, uJitter;
uniform float uTipRotation;
uniform vec2 uPoint, uAxis;
uniform float uAmount;
void main(){
  vec2 p = vUv - uPoint; p.x *= uAspect;
  vec2 q = vec2(dot(p, uAxis), dot(p, vec2(-uAxis.y, uAxis.x))) / uRadius;
  q.y /= uTipAspect;
  // Rotate the TIP-SPACE sampling coordinates only: the discard and the
  // footprint value keep the unrotated q, exactly as stampFS does.
  float a = uTipRotation;
  vec2 tq = vec2(q.x * cos(a) - q.y * sin(a), q.x * sin(a) + q.y * cos(a));
  if (abs(q.x) > 1.0 || abs(q.y) > 1.0) discard;
  // Dry media reads a different slice of the tip per dab (same law as stampFS).
  float e0 = fract(sin(dot(uPoint, vec2(12.9898, 78.233))) * 43758.5453);
  float e1 = fract(e0 * 63.7264 + 0.37);
  vec2 uv = clamp(tq * 0.5 + 0.5 + (vec2(e0, e1) - 0.5) * uJitter, 0.0, 1.0);
  float t = texture(uTip, uv).r;
  // Re-threshold the tip into the same hard, crumbly mask stampFS builds.
  float th = uRough * 0.45;
  float dry = smoothstep(th, th + 0.02, t);
  float sharp = mix(t, dry, step(0.0001, uRough));
  float d = dot(q, q);
  float round = 1.0 - smoothstep(0.15, 1.0, d);
  float f = mix(sharp, round, uRound);
  float h = texture(uPaper, vUv).g;
  f *= mix(1.0, smoothstep(uGrainThr - 0.08, uGrainThr + 0.08, h), uGrain);
  o0 = vec4(uAmount * f);
}`;

// Water flow: self-advect, damp, and confine to wet paper.
export const advectVelocityFS = `${HEADER}
out vec4 o;
uniform sampler2D uVelocity, uWet;
uniform vec2 uTexel;
uniform float uDt, uDissipation;
void main(){
  vec2 coord = vUv - uDt * texture(uVelocity, vUv).xy * uTexel;
  vec2 vel = texture(uVelocity, coord).xy * uDissipation;
  float w = texture(uWet, vUv).x;
  o = vec4(vel * smoothstep(0.005, 0.2, w), 0.0, 1.0);
}`;

export const divergenceFS = `${HEADER}
out vec4 o;
uniform sampler2D uVelocity; uniform vec2 uTexel;
void main(){
  float L = texture(uVelocity, vUv - vec2(uTexel.x, 0.0)).x;
  float R = texture(uVelocity, vUv + vec2(uTexel.x, 0.0)).x;
  float B = texture(uVelocity, vUv - vec2(0.0, uTexel.y)).y;
  float T = texture(uVelocity, vUv + vec2(0.0, uTexel.y)).y;
  o = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}`;

export const pressureFS = `${HEADER}
out vec4 o;
uniform sampler2D uPressure, uDivergence; uniform vec2 uTexel;
void main(){
  float L = texture(uPressure, vUv - vec2(uTexel.x, 0.0)).x;
  float R = texture(uPressure, vUv + vec2(uTexel.x, 0.0)).x;
  float B = texture(uPressure, vUv - vec2(0.0, uTexel.y)).x;
  float T = texture(uPressure, vUv + vec2(0.0, uTexel.y)).x;
  o = vec4((L + R + B + T - texture(uDivergence, vUv).x) * 0.25, 0.0, 0.0, 1.0);
}`;

export const gradientSubtractFS = `${HEADER}
out vec4 o;
uniform sampler2D uPressure, uVelocity; uniform vec2 uTexel;
void main(){
  float L = texture(uPressure, vUv - vec2(uTexel.x, 0.0)).x;
  float R = texture(uPressure, vUv + vec2(uTexel.x, 0.0)).x;
  float B = texture(uPressure, vUv - vec2(0.0, uTexel.y)).x;
  float T = texture(uPressure, vUv + vec2(0.0, uTexel.y)).x;
  o = vec4(texture(uVelocity, vUv).xy - 0.5 * vec2(R - L, T - B), 0.0, 1.0);
}`;

export const curlFS = `${HEADER}
out vec4 o;
uniform sampler2D uVelocity; uniform vec2 uTexel;
void main(){
  float L = texture(uVelocity, vUv - vec2(uTexel.x, 0.0)).y;
  float R = texture(uVelocity, vUv + vec2(uTexel.x, 0.0)).y;
  float B = texture(uVelocity, vUv - vec2(0.0, uTexel.y)).x;
  float T = texture(uVelocity, vUv + vec2(0.0, uTexel.y)).x;
  o = vec4(0.5 * ((R - L) - (T - B)), 0.0, 0.0, 1.0);
}`;

export const vorticityFS = `${HEADER}
out vec4 o;
uniform sampler2D uVelocity, uCurl;
uniform vec2 uTexel; uniform float uCurlAmount, uDt;
void main(){
  float L = texture(uCurl, vUv - vec2(uTexel.x, 0.0)).x;
  float R = texture(uCurl, vUv + vec2(uTexel.x, 0.0)).x;
  float B = texture(uCurl, vUv - vec2(0.0, uTexel.y)).x;
  float T = texture(uCurl, vUv + vec2(0.0, uTexel.y)).x;
  float C = texture(uCurl, vUv).x;
  vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
  force /= length(force) + 1e-4;
  force *= uCurlAmount * C * vec2(1.0, -1.0);
  o = vec4(clamp(texture(uVelocity, vUv).xy + force * uDt, -1000.0, 1000.0), 0.0, 1.0);
}`;

export const scaleFS = `${HEADER}
out vec4 o;
uniform sampler2D uTex; uniform float uValue;
void main(){ o = texture(uTex, vUv) * uValue; }`;

// Where is there water at all? One output texel per block of the sheet: 1 where any of
// 8×8 taps across the block is wetter than uThreshold. Read back to bound the simulated region.
export const wetMaskFS = `${HEADER}
out vec4 o;
uniform sampler2D uWet;
uniform vec2 uBlock;        // one output texel, in wet-texture uv
uniform float uThreshold;
void main(){
  vec2 base = vUv - uBlock * 0.5;
  float m = 0.0;
  for (int y = 0; y < 8; y++) for (int x = 0; x < 8; x++) {
    vec2 p = base + uBlock * (vec2(float(x), float(y)) + 0.5) / 8.0;
    m = max(m, texture(uWet, p).r);
  }
  o = vec4(m > uThreshold ? 1.0 : 0.0, 0.0, 0.0, 1.0);
}`;

// Water: carried a little by the flow, creeps outward, evaporates.
export const advectWetFS = `${HEADER}
out vec4 o;
uniform sampler2D uVelocity, uWet;
uniform vec2 uSimTexel, uTexel;
uniform float uDt, uDecay, uSpread;
void main(){
  vec2 coord = vUv - uDt * texture(uVelocity, vUv).xy * uSimTexel * 0.6;
  float w = texture(uWet, coord).x;
  vec2 b = uTexel * 1.6;
  float n = (texture(uWet, coord + vec2(b.x, 0.0)).x + texture(uWet, coord - vec2(b.x, 0.0)).x
           + texture(uWet, coord + vec2(0.0, b.y)).x + texture(uWet, coord - vec2(0.0, b.y)).x) * 0.25;
  o = vec4(mix(w, n, uSpread) * uDecay, 0.0, 0.0, 1.0);
}`;

// Pigment transport. Three effects, all confined to wet paper:
//  1. advection by the water's flow (semi-Lagrangian),
//  2. diffusion between neighbouring wet texels (bleeding),
//  3. capillary flow down the wetness gradient toward the drying edge, where it is
//     stranded -> the dark "tide line" of a dried wash.
// 2 and 3 are written as fluxes across texel faces, gated by the mobility of both
// sides, so pigment is conserved and never seeps onto dry paper: wet-on-dry strokes
// keep hard edges, wet-in-wet strokes bloom as far as the water reaches.
export const advectInkFS = `${HEADER}
layout(location=0) out vec4 oA;
layout(location=1) out vec4 oB;
uniform sampler2D uVelocity, uInkA, uInkB, uWet;
uniform vec2 uSimTexel, uTexel;
uniform float uDt, uBleed, uEdge, uAspect, uKeep;
uniform vec3 uBrush;  // x, y, radius (radius <= 0: no brush down)

float mobility(float w){ return smoothstep(0.02, 0.45, w); }

void face(vec2 off, float w, float m, vec4 A, vec4 B, float diffusion, float edge,
          inout vec4 dA, inout vec4 dB){
  vec2 uv = vUv + off;
  float wn = texture(uWet, uv).x;
  float g = m * mobility(wn);
  if (g <= 0.0) return;
  vec4 An = texture(uInkA, uv), Bn = texture(uInkB, uv);
  float d = diffusion * g;
  // positive: water (and pigment) drifts from this texel toward the drier neighbour
  float e = clamp(edge * (w - wn), -0.08, 0.08) * g;
  dA += d * (An - A) - (e > 0.0 ? e * A : e * An);
  dB += d * (Bn - B) - (e > 0.0 ? e * B : e * Bn);
}

void main(){
  float w = texture(uWet, vUv).x;
  float m = mobility(w);
  vec4 A = texture(uInkA, vUv), B = texture(uInkB, vUv);
  if (m < 0.002){ oA = A * uKeep; oB = B * uKeep; return; }

  vec2 vel = texture(uVelocity, vUv).xy;
  vec2 coord = vUv - uDt * vel * uSimTexel * m;
  vec4 a = mix(A, texture(uInkA, coord), m);
  vec4 b = mix(B, texture(uInkB, coord), m);

  float brush = 0.0;
  if (uBrush.z > 0.0){
    vec2 d = vUv - uBrush.xy; d.x *= uAspect;
    brush = exp(-dot(d, d) / (uBrush.z * uBrush.z));
  }
  float diffusion = clamp(uBleed * (0.25 + 1.3 * brush) * 0.3, 0.0, 0.15);
  vec4 dA = vec4(0.0), dB = vec4(0.0);
  face(vec2( uTexel.x, 0.0), w, m, A, B, diffusion, uEdge, dA, dB);
  face(vec2(-uTexel.x, 0.0), w, m, A, B, diffusion, uEdge, dA, dB);
  face(vec2(0.0,  uTexel.y), w, m, A, B, diffusion, uEdge, dA, dB);
  face(vec2(0.0, -uTexel.y), w, m, A, B, diffusion, uEdge, dA, dB);

  // no clamping: basis coefficients are signed (only the spectrum they encode is positive)
  oA = (a + dA) * uKeep;
  oB = vec4((b + dB).rgb, max(b.a + dB.a, 0.0)) * uKeep;
}`;

const TO_SRGB = `
vec3 toSRGB(vec3 c){
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
vec3 fromSRGB(vec3 c){
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}`;

// 64-20 — the ONE film-presence reconstruction, shared by the coverage
// transport (`advectCoverFS`) and the capture-time clearance
// (`coverClearFS`); a second, divergent criterion is exactly what this
// constant exists to prevent.
// It rebuilds the display's own reading of the combined paint film: the mobile
// (ink) and fixed layers summed the way displayFS sums them, granulated by the
// display's own literal, run through the display's own basis block
// (`displayBasisGLSL`) — with the display's edge-darkening factor deliberately
// omitted. The display's `k` is `gran * (1 + uEdgeDarken * edge)` with
// `edge >= 0`, hence at least `gran`, so the display is never BRIGHTER than
// this reconstruction (every committed gate is emboss-free, `shade` 1): a
// texel the gate lets transport reads below the scan's line in the render too.
// The luma is then measured on the paper-white scan's OWN grid: the display
// writes RGBA8 before `coveredPaperWhiteBox` compares the mean of the three
// bytes against 250, so the gate quantizes the same way and its line is the
// scan's line, not a continuous approximation that leaves a trickle in the
// [249.5, 250) band the scan already calls paper-white. Where the scan would
// count a texel covered paper-white the presence is exactly 0; where the film
// reads at or below the scan's 5-level ramp it is exactly 1.
//
// The snippet declares the film channels and the granulation it reads and
// nothing else: each including program declares its own uPaper (advectCoverFS
// directly, coverClearFS through its own sampler line), so neither redeclares
// a sampler the other already bound.
const FILM_PRESENCE = `
uniform sampler2D uInkA, uInkB, uFixedA, uFixedB;
uniform float uGranulation;

// The paper-white scan's own line and its margin, derived once: luma 250 of
// 255 is the covered-paper-white scan's threshold, and the 5-level ramp is
// the margin the scan leaves above it (a texel at or above the line can never
// be counted covered paper-white after 8-bit quantization).
const float PAPER_WHITE = 250.0 / 255.0;
const float PAPER_WHITE_RAMP = 5.0 / 255.0;

${TO_SRGB}

// How much of the sheet this texel's combined paint film still hides: 1 where
// the film reads at or below the scan's ramp, 0 where it reads paper-white on
// the scan's own 8-bit grid. Exactly the display's film (the mobile and fixed
// layers summed as displayFS sums them), exactly its granulation, exactly its
// basis.
float filmPresence(vec2 uv){
  vec4 paper = texture(uPaper, uv);
  vec4 iB = texture(uInkB, uv);
  vec4 fB = texture(uFixedB, uv);
  vec4 a = texture(uInkA, uv) + texture(uFixedA, uv);
  vec3 b = iB.rgb + fB.rgb;
  float scatter = iB.a + fB.a;
  float gran = 1.0 + uGranulation * (0.5 - paper.g) * 2.2;
  a *= gran; b *= gran; scatter *= gran;
  vec3 rgb = vec3(0.0);
  float tr;
${displayBasisGLSL()}
  // The scan reads the transparent export's bytes: quantize to RGBA8 the same
  // way (round to nearest) before the mean, so both comparisons agree.
  vec3 s = toSRGB(rgb);
  vec3 q = floor(s * 255.0 + 0.5) / 255.0;
  float luma = (q.r + q.g + q.b) / 3.0;
  return 1.0 - smoothstep(PAPER_WHITE - PAPER_WHITE_RAMP, PAPER_WHITE, luma);
}`;

// Coverage transport (64-14). The coverage channel rides the SAME wet
// simulation the pigment does — the same mobility gate, back-trace and four
// face fluxes, computed on its single channel — so a covering stroke painted
// into wet paper stays registered to its pigment instead of decal-ing a
// static shape. There is deliberately NO keep factor here: the settlement
// that reduces mobile pigment (advectInkFS's uKeep = 1 - settle) must not
// reduce coverage, or a dried near-white film would lose its opacity and the
// cached base would reappear under it. Coverage leaves a texel only through
// the wet flow itself.
//
// 64-20 — the transport is GATED by the display's own reconstruction of the
// combined mobile + fixed film, the shared FILM_PRESENCE snippet. A texel
// whose film still reconstructs paper-white — on the paper-white scan's own
// 8-bit grid — transports no coverage, so the channel can no longer claim a
// texel its own film leaves bare. This is NOT a keep factor: a frozen texel
// keeps its coverage exactly; nothing decays, the wet flow simply cannot
// carry coverage through bare paper.
export const advectCoverFS = `${HEADER}
layout(location=0) out vec4 o0;
uniform sampler2D uVelocity, uCover, uWet, uPaper;
uniform vec2 uSimTexel, uTexel;
uniform float uDt, uBleed, uEdge, uAspect;
uniform vec3 uBrush;  // x, y, radius (radius <= 0: no brush down)

${FILM_PRESENCE}

float mobility(float w){ return smoothstep(0.02, 0.45, w); }

void face(vec2 off, float w, float m, float C, float diffusion, float edge,
          inout float dC){
  vec2 uv = vUv + off;
  float wn = texture(uWet, uv).x;
  float g = m * mobility(wn);
  if (g <= 0.0) return;
  float Cn = texture(uCover, uv).x;
  float d = diffusion * g;
  // positive: water (and coverage) drifts from this texel toward the drier neighbour
  float e = clamp(edge * (w - wn), -0.08, 0.08) * g;
  dC += d * (Cn - C) - (e > 0.0 ? e * C : e * Cn);
}

void main(){
  float w = texture(uWet, vUv).x;
  float m = mobility(w);
  float C = texture(uCover, vUv).x;
  if (m < 0.002){ o0 = vec4(C); return; }

  float p = filmPresence(vUv);
  vec2 vel = texture(uVelocity, vUv).xy;
  vec2 coord = vUv - uDt * vel * uSimTexel * m;
  float c = mix(C, texture(uCover, coord).x, m * p);

  float brush = 0.0;
  if (uBrush.z > 0.0){
    vec2 d = vUv - uBrush.xy; d.x *= uAspect;
    brush = exp(-dot(d, d) / (uBrush.z * uBrush.z));
  }
  float diffusion = clamp(uBleed * (0.25 + 1.3 * brush) * 0.3, 0.0, 0.15);
  float dC = 0.0;
  face(vec2( uTexel.x, 0.0), w, m, C, diffusion, uEdge, dC);
  face(vec2(-uTexel.x, 0.0), w, m, C, diffusion, uEdge, dC);
  face(vec2(0.0,  uTexel.y), w, m, C, diffusion, uEdge, dC);
  face(vec2(0.0, -uTexel.y), w, m, C, diffusion, uEdge, dC);

  // Coverage is a committed alpha in [0, 1]: clamp the transported sum, scaled
  // per texel by the film's presence — a paper-white texel keeps its value.
  o0 = vec4(clamp(c + dC * p, 0.0, 1.0));
}`;

// "Fix": mobile pigment, and the scattering it carries, settles into the paper.
// Drawn with additive blending into the fixed layer.
export const settleFS = `${HEADER}
layout(location=0) out vec4 oA;
layout(location=1) out vec4 oB;
uniform sampler2D uInkA, uInkB;
uniform float uSettle;
void main(){
  vec4 A = texture(uInkA, vUv), B = texture(uInkB, vUv);
  oA = A * uSettle;
  oB = vec4(B.rgb * uSettle, B.a * uSettle);
}`;

// Multiplicative stamp (blend ZERO, ONE_MINUS_SRC_COLOR): blotting with a tissue.
// 261028-k03c: the pre-k03c radial envelope exp(-(q·q)²) stays the erase law;
// the brush tip then shaves the silhouette to its contour (the same square
// (-1..1) tip-space mapping stampFS uses). The square crop is UNCONDITIONAL:
// uRound only blends the tip MASK towards the full envelope (1 = no tip
// texture, still clipped to the tip square) — it does not restore a
// radial-only footprint. The engine always binds uRound = 0.
export const liftFS = `${HEADER}
layout(location=0) out vec4 o0;
layout(location=1) out vec4 o1;
uniform sampler2D uTip;
uniform float uAspect, uRadius, uAmount, uTipAspect, uRound;
uniform float uTipRotation;
uniform vec2 uPoint, uAxis;
void main(){
  vec2 p = vUv - uPoint; p.x *= uAspect;
  vec2 q = vec2(dot(p, uAxis), dot(p, vec2(-uAxis.y, uAxis.x))) / uRadius;
  q.y /= uTipAspect;
  // quick 261116-inu: rotate the sampled UV only; the discard and the radial
  // envelope keep the unrotated q.
  float a = uTipRotation;
  vec2 tq = vec2(q.x * cos(a) - q.y * sin(a), q.x * sin(a) + q.y * cos(a));
  if (abs(q.x) > 1.0 || abs(q.y) > 1.0) discard;
  float t = texture(uTip, clamp(tq * 0.5 + 0.5, 0.0, 1.0)).r;
  float f = uAmount * exp(-pow(dot(q, q), 2.0)) * mix(t, 1.0, uRound);
  o0 = vec4(f);
  o1 = vec4(f);
}`;

// quick 261117-tq7 (spec 09 law 3): the deposit's own footprint mask, shared by
// the two Body-cover shaders. It is stampFS's mask law VERBATIM — the tip
// texture sampled in rotated tip space, the dry re-threshold, the per-dab
// jitter slice and the paper-tooth gate — so the erase can never cover more or
// less than the paint the same dab lands. Outside the tip square it returns 0
// (no discard: the ink cover's full-document ping-pong relies on the identity
// value there).
const FOOTPRINT_MASK = `
uniform sampler2D uTip, uPaper;
uniform float uAspect, uRadius, uTipAspect, uRound, uGrain, uGrainThr;
uniform float uRough, uJitter, uTipRotation;
uniform vec2 uPoint, uAxis;
float footprintMask(){
  vec2 p = vUv - uPoint; p.x *= uAspect;
  vec2 q = vec2(dot(p, uAxis), dot(p, vec2(-uAxis.y, uAxis.x))) / uRadius;
  q.y /= uTipAspect;
  float a = uTipRotation;
  vec2 tq = vec2(q.x * cos(a) - q.y * sin(a), q.x * sin(a) + q.y * cos(a));
  if (abs(q.x) > 1.0 || abs(q.y) > 1.0) return 0.0;
  float e0 = fract(sin(dot(uPoint, vec2(12.9898, 78.233))) * 43758.5453);
  float e1 = fract(e0 * 63.7264 + 0.37);
  vec2 uv = clamp(tq * 0.5 + 0.5 + (vec2(e0, e1) - 0.5) * uJitter, 0.0, 1.0);
  float t = texture(uTip, uv).r;
  // The deposit's LOW cut without its hard edge: a dry brush thresholds the tip
  // at roughness * 0.45 with a 0.02 ramp, and a cover must start erasing at
  // the same alpha (never below it: that is where the paint is absent, and an
  // erase there compounds to paper-white over a stroke's overlapping dabs).
  // The ramp is WIDE on purpose: the underlayer survives partway up the tip's
  // alpha, which is the transition the rim needs, instead of a hard cut at the
  // dab's contour. A 1-in-1-out threshold here is what carved the scalloped
  // dab edges and the white specks through textured tips.
  float th = uRough * 0.45;
  float ramp = smoothstep(th, th + 0.5, t);
  float round = 1.0 - smoothstep(0.15, 1.0, dot(q, q));
  float f = mix(ramp, round, uRound);
  // Soften the tip square's cull: the deposit may stop at |q| = 1, but an erase
  // that stops on the same hard line draws the dab's contour. Fading the cover
  // out before the cull leaves the underlayer mixing at the outermost rim.
  f *= 1.0 - smoothstep(0.82, 1.0, max(abs(q.x), abs(q.y)));
  float h = texture(uPaper, vUv).g;
  return f * mix(1.0, smoothstep(uGrainThr - 0.08, uGrainThr + 0.08, h), uGrain);
}`;

// The Body cover's multiplicative factor. Drawn with ZERO / ONE_MINUS_SRC_COLOR
// into `fixed`, into `relief` (uShape = 0, the delivered coverAmount x
// RELIEF_ERODE law) and into the pre-stroke snapshot (uShape = 1), so settled,
// mobile and cached paint all lose exactly the fraction the dab's paint hides.
//
// quick 261117-tq7 (rev 4): with uShape = 1 the erase is ALPHA-shaped —
// `1 - exp(-uDensity * m)`, where uDensity is the optical density of this
// dab's own deposit at full mask (`-ln(1 - layer opacity)`, pigment-scaled).
// Across overlapping dabs the product of (1 - f) is exp(-uDensity * SUM m),
// i.e. the underlayer is attenuated by exactly the accumulated absorbance the
// deposit adds — additive in density, never a union of masks. A textured tip
// reads a different tip slice per dab (the same jitter stampFS uses), so the
// old linear law's union erased every pixel SOME dab covered while the
// deposit's sum left the other dabs' texture gaps bare: paper-white streaks
// through dry-brush paint. The alpha law cannot outrun the sum of the paint,
// and on the tip's semi-transparent rim the underlayer survives in proportion
// — the old/new mix the edge needs.
export const bodyCoverFS = `${HEADER}${FOOTPRINT_MASK}
layout(location=0) out vec4 o0;
layout(location=1) out vec4 o1;
uniform float uAmount, uDensity, uShape;
void main(){
  float m = footprintMask();
  float f = uAmount * mix(m, 1.0 - exp(-uDensity * m), uShape);
  o0 = vec4(f);
  o1 = vec4(f);
}`;

// SPIKE 001 — the coverage composite's SOURCE term. The rev-4 order was
// "erase the underlayer by f, then add the per-dab deposit d"; this model
// composites the paint film over the underlayer instead:
//
//   ink <- ink * (1 - a) + C * a        (the caller attenuates first)
//   a   = coverAmount * (1 - exp(-uDensity * footprintMask))
//
// C is the pigment's MASSTONE coefficient vector (concentration 1), so the
// colour saturates at the chosen pigment instead of accumulating: overlapping
// dabs are idempotent, red over blue converges to red, and nothing drifts
// toward the sum of both absorptions (black). Coverage uDensity is PIGMENT-
// INDEPENDENT (the medium's paint volume), so a near-white pigment covers as
// fully as a black one.
//
// Blended with ONE / ONE: after the caller's attenuation draw the destination
// is ink*(1-a), and this adds C*a. o1's alpha is the dab's scattering S, which
// is deposited additively (never multiplied by the coverage a) to keep the
// delivered veil — but it MUST ride the footprint mask like stampFS's own
// o1 = uColor1 * f. The additive blend writes every pixel of the scissor rect,
// so an unmasked S deposits the dab's whole veil as a square over the paint
// around the dab (the display reads B.a as Kubelka-Munk scatter, so the square
// reads as brightness on neighbouring strokes).
export const coverDepositFS = `${HEADER}${FOOTPRINT_MASK}
layout(location=0) out vec4 o0;
layout(location=1) out vec4 o1;
uniform vec4 uColor0, uColor1;
uniform float uAmount, uDensity;
void main(){
  float m = footprintMask();
  float a = uAmount * (1.0 - exp(-uDensity * m));
  o0 = uColor0 * a;
  o1 = vec4(uColor1.rgb * a, uColor1.a * m);
}`;

// SPIKE 001 — the coverage channel. Composited with ONE / ONE_MINUS_SRC_ALPHA:
//   cover <- a + cover * (1 - a)
// the union of every dab's coverage. The compositor reads it as the pigment
// layer's alpha (displayFS mode 4), so a body-heavy stroke hides the cached
// base underneath instead of punching a hole in it.
//
// 64-20 — the deposit is deliberately UNGATED. The plan's film-coherence law
// is the TRANSPORT gate in `advectCoverFS` ("the deposit is already clean"),
// and the census is closed at the capture boundary by `coverClearFS`, where
// the FINAL film is known. A deposit gate would have read the dab's own
// TRANSIENT film — the ink it is still laying down, with the fixed layer
// already eroded — and measured a partially-covered sheet as paper-white
// mid-stroke: on white-over-blue the Body-60 partial cover (a legitimate
// 0.08 gain over the pigment's own darkness) collapsed to zero. So the union
// keeps its committed write, and the clearance is the one place the exported
// coverage is cleared where the finished film reads paper-white.
export const coverMaskFS = `${HEADER}${FOOTPRINT_MASK}
layout(location=0) out vec4 o0;
uniform float uAmount, uDensity;
void main(){
  float m = footprintMask();
  o0 = vec4(uAmount * (1.0 - exp(-uDensity * m)));
}`;

// 64-20 decision A — the capture-time clearance. The two gates above stop
// coverage from being CLAIMED or TRANSPORTED onto paper-white film; this third
// inclusion of the SAME FILM_PRESENCE snippet closes the census by
// construction. At the capture/export boundary only — Engine.readback's
// pigment path, never displayFS's interactive output — a texel whose FINAL
// film still reads paper-white on the scan's own 8-bit grid exports ZERO
// coverage alpha. The clear is BINARY: where the presence is exactly 0 the
// alpha is zeroed, and everywhere else the display's own bytes pass through
// unchanged — not a scale, so no surviving texel's alpha or pigment moves,
// and the export's un-premultiply can never re-derive a colour. RGB is never
// rebuilt: `src.rgb` is carried verbatim (at alpha 0 the F1 premultiplied
// contract already makes it invisible).
//
// The clear is scoped to texels that actually carry COVERAGE (`cov > 0`), the
// part of displayFS's `max(darkAlpha, cov)` this decision is about. With
// cov == 0 the exported alpha is the pigment's own faint darkness, not a
// coverage claim: a paper-white film bounds `1 - min(rgb)` at 15/255 — far
// below the census's 0.5 alpha line — so such a texel can never be a census
// texel, and clearing it would only move Body-0 pigment bytes the MED-20
// identity law keeps exact. Every counted texel is coverage-bearing, so the
// census still closes by construction.
export const coverClearFS = `${HEADER}
layout(location=0) out vec4 o0;
uniform sampler2D uSrc, uPaper, uCover;
${FILM_PRESENCE}
void main(){
  vec4 src = texture(uSrc, vUv);
  float p = filmPresence(vUv);
  float cov = texture(uCover, vUv).x;
  float cleared = (p < 0.0001 && cov > 0.0) ? 1.0 : 0.0;
  o0 = vec4(src.rgb, src.a * (1.0 - cleared));
}`;

// ============================================================
//  64-21 (SPIKE 002) — the per-bristle carrier, shader F (§3.1):
//  pickup/refill equilibrium, load depletion, thirst, travel, wet gate.
//
//  Reservoir layout (all three attachments are 1 × 256 RGBA16F, row =
//  bristle index; the engine keeps them in a NEAREST ping-pong pair so the
//  read-modify-write pass can sample the old value):
//    attachment 0  carried absorbance coefficients 0..3
//    attachment 1  carried absorbance coefficients 4..6 + carried alpha (.a)
//    attachment 2  (load, across, seed, valueJitter)
//  The shape texture is a static 1 × 256 RGBA16F uploaded at every stroke
//  start:
//    (radiusScale, touchReach, loadRate, spare)
//
//  NOT in this fragment, by scope: `uWetMode` and the last-touch sampler
//  (`uTimes`/`uNow`/`uWetSeconds`) belong to 64-24 — the proxy mode
//  `wetness = wet * coverage` is the only mode this plan ships. The gather
//  deposit (§3.2–§4.5) is 64-22's, below.
//
//  NOTE: the spike declared `uSheetAspect` but never read it; it is not
//  declared here (an unread uniform is optimized out and could not be bound).
//  The GATHER does read it — its across coordinate is aspect-corrected.
// ============================================================
const BRISTLE_NOISE = `
uint pcg(uint v){
  uint s = v * 747796405u + 2891336453u;
  uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
  return (w >> 22u) ^ w;
}
float hash21(vec2 c){
  uint x = uint(int(c.x));
  uint y = uint(int(c.y));
  return float(pcg(x + pcg(y))) / 4294967295.0;
}
float hash11(float c){ return float(pcg(uint(int(c)) + 1013904223u)) / 4294967295.0; }
// 64-23: the 2D member of the same family — §4.4's grainHeight samples it in
// two coordinate systems (brush-local streaks and screen-space tooth/cloud).
float valueNoise(vec2 p){
  vec2 cell = floor(p);
  vec2 f = p - cell;
  vec2 blend = f * f * (3.0 - 2.0 * f);
  float bottom = mix(hash21(cell), hash21(cell + vec2(1.0, 0.0)), blend.x);
  float top = mix(hash21(cell + vec2(0.0, 1.0)), hash21(cell + vec2(1.0, 1.0)), blend.x);
  return mix(bottom, top, blend.y);
}
float noise1(float v){
  float cell = floor(v);
  float f = v - cell;
  float blend = f * f * (3.0 - 2.0 * f);
  return mix(hash11(cell), hash11(cell + 1.0), blend);
}
// touchOf (app.js): pressure vs a bristle's contact threshold.
float touchOf(float reach, float pressure){ return smoothstep(reach, reach + 0.08, pressure); }
// §5.3 — the contact law is SHARED by the carrier (§3.1) and the gather: the
// rim share of the wobble (a quarter at the centre, the full amount at the
// edge) and the per-bristle wobble itself, along the stroke. One declaration,
// so the two fragments cannot drift.
float bristleRimShare(float across){ return 0.25 + 0.75 * smoothstep(0.45, 1.0, abs(across)); }
float bristleContact(float alongPx, float seed, float streakLen){
  return noise1(alongPx / max(streakLen * 0.7, 1.0) + seed * 2048.0 + 0.5) - 0.5;
}
`;
// 64-22: the shared texture helper — exported because the carrier and the
// gather both sample the same four 1 × 256 textures; one `bristleTex`, with
// the same `1 × 256` clamp, in both.
export const BRISTLE_TEXTURES = `
uniform sampler2D uPaintA;   // carried absorbance coefficients 0..3
uniform sampler2D uPaintB;   // carried absorbance coefficients 4..6 + carried alpha
uniform sampler2D uState;    // (load, across, seed, valueJitter)
uniform sampler2D uShape;    // (radiusScale, touchReach, loadRate, spare)
uniform float uCount;
vec4 bristleTex(sampler2D t, int idx){ return texelFetch(t, ivec2(0, clamp(idx, 0, 255)), 0); }
`;

// ============================================================
//  261119-pod (D-28 revised) — THE PRE-DAB SNAPSHOT (§3.3).
//
//  The reference's §3.3 smear reads the canvas it is about to write
//  (`carried = mix(carried, canvas, clamp(smear, 0, 0.8))`) — a compute
//  read-modify-write. WebGL2 cannot sample the attachment it draws into, so
//  the engine copies the canvas ONCE per dab into this scratch pair and the
//  gather consumers read the snapshot instead of the live targets. The copy
//  runs after `touch(rect)` and before the first deposit draw, gated on
//  Pickup > 0.
//
//  TWO attachments, exactly the coefficient layout the consumers need:
//    attachment 0 = inkA + fixedA            (absorbance coefficients 0..3)
//    attachment 1 = (inkB + fixedB).rgb      (coefficients 4..6)
//                  with texture(uCover, uv).x in .a — the COVER alpha, the
//                  reference's `canvas.a`; the scatter channel is never a
//                  wetness gate (§3.4's correction).
//  Five sources on units 0-4, no gather, no clock: one cheap copy.
// ============================================================
export const bristleCanvasFS = `${HEADER}
layout(location=0) out vec4 oA;
layout(location=1) out vec4 oB;
uniform sampler2D uInkA, uInkB, uFixedA, uFixedB, uCover;
void main(){
  oA = texture(uInkA, vUv) + texture(uFixedA, vUv);
  vec3 b = (texture(uInkB, vUv) + texture(uFixedB, vUv)).rgb;
  oB = vec4(b, texture(uCover, vUv).x);
}`;

// One invocation per bristle (gl_FragCoord.y = bristle index). Runs before the
// dab's deposit and writes only the reservoir pair — no document target.
//   §3.1 thirst = 0.15 + 2.4 * smoothstep(0.35, 0.9, fract(seed * 7.31))
//   §3.1 pickup = clamp(pickupRate * thirst * travel * wet * touch, 0, 0.75)
//   §3.1 refill = clamp(refillRate * travel * load, 0, 1)
//   §3.1 carried = mix(carried, canvas, pickup); carried = mix(carried, pigment, refill)
//   §3.1 load -= depletion * loadRate * travelledPx * touch * (0.35 + 0.65 * pressure)
//   §3.1 load += pickup * 0.25
// §3.4 wetness: mode 1 (the shipped law, 64-24 / D-24) reads the last-touch
// field's age on the VIRTUAL clock; mode 0 keeps 64-21's existing-channel
// PROXY (`wet * coverage`) as the recorded A/B control only. `uTimes` is the
// exact-float last-touch pair's read half — the reservation 64-21 made.
export const bristleCarrierFS = `${HEADER}${BRISTLE_NOISE}${BRISTLE_TEXTURES}
layout(location=0) out vec4 oA;
layout(location=1) out vec4 oB;
layout(location=2) out vec4 oC;
uniform sampler2D uInkA, uInkB, uFixedA, uFixedB, uWet, uCover;
uniform vec2 uPoint;
uniform vec2 uAxis;          // across axis (unit, doc frame)
uniform float uRadius;       // half-width in doc heights
uniform float uTravel;       // distance moved since the last dab, in brush widths
uniform float uTravelPx;     // the same distance in document texels
uniform vec2 uSheet;         // document size in px — sizes the §3.1 tap step
uniform float uPressure;
uniform float uPickupRate;
uniform float uRefillRate;
uniform float uDepletion;    // load lost per document texel travelled
uniform vec4 uPigmentA;      // palette absorbance 0..3
uniform vec3 uPigmentB;      // palette absorbance 4..6
uniform float uAlongPx;
uniform float uStreakLen;
uniform float uRimContact;
uniform sampler2D uTimes;    // the last-touch field's read half (R32F, D-24)
uniform float uNow;          // SECONDS on the virtual clock — never a wall clock
uniform float uWetSeconds;   // the paint's tack time (params.wetSeconds, >= 1)
uniform int uWetMode;        // 1 = the shipped timestamp law; 0 = the A/B proxy

vec4 canvasAt(vec2 uv){
  vec4 a = texture(uInkA, uv) + texture(uFixedA, uv);
  vec3 b = (texture(uInkB, uv) + texture(uFixedB, uv)).rgb;
  return vec4(a.rgb, b.r);
}
vec3 canvasAtB(vec2 uv){
  vec4 ib = texture(uInkB, uv) + texture(uFixedB, uv);
  return ib.rgb;
}
// §3.4: mode 1 is the shipped law (D-24) — the texel's age from the
// last-touch field, on the virtual clock, gated by the PAINT's own coverage,
// exactly the reference's exp(-age/wetSeconds) * canvas.a. uCover IS that
// paint alpha: bristleCoverFS writes it on every bristle dab, and
// BRISTLE_BODY_ALPHA_FLOOR (0.5) keeps it live at Body 0 — measured on the
// 1080 sheet at Body 0 as cover max 0.500 / mean 0.184. The scatter channel
// (inkB.a + fixedB.a) is not paint alpha: measured max 0.000 at Body 0 and
// max 0.042 at Body 100. 4e6b974e1 gated on that dead channel, so wet was
// always 0 at the canonical Body 0 and Pickup had no effect at any value;
// this restores the cover channel (261119-pod).
// Mode 0 is 64-21's proxy retained ONLY as the recorded A/B control.
float wetAt(vec2 uv){
  if (uWetMode == 1) {
    float age = max(uNow - texture(uTimes, uv).r, 0.0);
    return exp(-age / max(uWetSeconds, 1.0)) * texture(uCover, uv).x;
  }
  return texture(uWet, uv).x * texture(uCover, uv).x;
}

void main(){
  int idx = int(gl_FragCoord.y);
  vec4 state = bristleTex(uState, idx);
  vec4 paintA = bristleTex(uPaintA, idx);
  vec4 paintB = bristleTex(uPaintB, idx);
  vec4 shape = bristleTex(uShape, idx);
  float across = state.y;

  // The bristle's own position and the §3.1 three-tap sample.
  // The reference samples ±1.5 device px along the stroke and AVERAGES colour
  // and wetness across the taps (sampleCanvas). Taking the colour from the
  // centre tap alone meant a bristle only ever saw the paint it had just laid
  // down, so Pickup could never drag the colour beside or ahead of the stroke.
  vec2 pos = uPoint + uAxis * (across * uRadius);
  vec2 dir = vec2(-uAxis.y, uAxis.x);
  vec2 tapUv = dir * (1.5 / max(uSheet, vec2(1.0)));
  vec4 canvasA = (canvasAt(pos - tapUv) + canvasAt(pos) + canvasAt(pos + tapUv)) * (1.0 / 3.0);
  vec3 canvasB = (canvasAtB(pos - tapUv) + canvasAtB(pos) + canvasAtB(pos + tapUv)) * (1.0 / 3.0);
  // The paint alpha the pickup equilibrium mixes, three-tapped like the colour
  // above: uCover is the painting's own coverage (§3.4's canvas.a analogue).
  float canvasAlpha = (texture(uCover, pos - tapUv).x + texture(uCover, pos).x + texture(uCover, pos + tapUv).x) * (1.0 / 3.0);
  float wet = (wetAt(pos - tapUv) + wetAt(pos) + wetAt(pos + tapUv)) * (1.0 / 3.0);

  // §3.1 contact threshold with rim noise — §5.3's shared contact law
  // (bristleRimShare + bristleContact from BRISTLE_NOISE); the gather's
  // per-bristle touch reads the SAME pair, so the carrier and the deposit
  // can never disagree about which bristles are in contact.
  float touch = touchOf(
    shape.y + bristleContact(uAlongPx, state.z, uStreakLen) * bristleRimShare(across) * uRimContact,
    uPressure);

  float thirst = 0.15 + 2.4 * smoothstep(0.35, 0.9, fract(state.z * 7.31));
  float pickup = clamp(uPickupRate * thirst * uTravel * wet * touch, 0.0, 0.75);
  float refill = clamp(uRefillRate * uTravel * state.x, 0.0, 1.0);

  vec4 carriedA = mix(paintA, canvasA, pickup);
  vec3 carriedB = mix(paintB.rgb, canvasB, pickup);
  float carriedAlpha = mix(paintB.a, canvasAlpha, pickup);
  // The refill target is the palette pigment at this bristle's value jitter
  // (state.w) — §3.1's brush.rgb * bristle.state.w.
  carriedA = mix(carriedA, uPigmentA * state.w, refill);
  carriedB = mix(carriedB, uPigmentB * state.w, refill);
  carriedAlpha = mix(carriedAlpha, 1.0, refill);

  float load = state.x - uDepletion * shape.z * uTravelPx * touch * (0.35 + 0.65 * uPressure);
  load = clamp(load + pickup * 0.25, 0.0, 1.0);

  oA = carriedA;
  oB = vec4(carriedB, carriedAlpha);
  oC = vec4(load, across, state.z, state.w);
}`;

// ============================================================
//  64-22 (SPIKE 002) — THE GATHER (§3.2, §4.1, §4.4, §4.5, §5.1).
//
//  One law, included by every consumer, so they can never diverge:
//  `bristleDepositFS` (the ink deposit) and `bristleCoverFS` (the one
//  coverage write). A consumer is a `${HEADER}${BRISTLE_GATHER}`
//  composition; a third consumer is a delivery-law amendment, not an
//  implementation choice (D-29).
//
//  `gatherBristle(uv)` returns the five NEAREST bristles' ink-weighted
//  values, averaged IN COEFFICIENT SPACE — the engine's seven absorbance
//  coefficients plus alpha, never RGB. The reference's §3.3 RGB smear IS
//  ported (261119-pod, D-28 revised) as the same operation in the engine's
//  units: each consumer carries its gathered coefficients toward the pre-dab
//  snapshot (`bristleCanvasFS`) by `clamp(pickup·wet·hash, 0, 0.8)` — ONE
//  `smearWeight` helper, inside `if (uSmear > 0.0)` so Pickup 0 never
//  samples the snapshot. The gather's own `wetAt` reads the snapshot's COVER
//  alpha with the carrier's exact arithmetic shape (`uTimes` age on the
//  virtual clock), so the two gates cannot drift:
//    §4.1 radius   = max(radiusScale · spacing · uRadius · uSheet.y, 0.8 px)
//    §5.1 profile  = (1 − offset²)²
//    §5.3 touch    = touchOf(touchReach + contact · rim · uRimContact, pressure)
//    §4.3 broken   = mix(1, smoothstep(0.3, 0.7, streak), dryness · uHairs)
//    §5.4 landed   = smoothstep(landing, landing + 0.12, strokeDist/halfWidth)
//    §3.2 ink      = profile · min(load·1.5, 1) · touch · broken · landed
//    carried       = Σ ink·value / Σ ink, none when Σ ink ≤ 1e-4
//    §4.5 body     = mix(wide/5 · presence, local, uHairs)
//    §4.5 presence = min(profileSum/0.5, 1), local = inkSum/max(profileSum, 0.5)
//    §4.4 height   = grainHeight(uv·uSheet, uAxis) — streaks + tooth + cloud
//    §4.4 threshold = uGrain · (1 − height) − 0.25
//    §5.5 coverage = body · (0.3 + 0.7·pressure) · dryEdge
//    §6   softness = uSoftness (0.09 + 0.25·Feather, from bristles.ts)
//
//  64-23 extends this ONE snippet — never a second copy — with §4.3's
//  dryness streak, §5.3's rim contact noise, §5.4's landing ramp, §5.5's
//  dry edge and §6's 1.2 paper-tooth grain-height trio. `uGrain` here is
//  §6's `BRISTLE_GRAIN` (1.2), NOT the stroke's Brush.grain: the brush's
//  grain stays in the footprint mask and the dab's own dryness. Every
//  number with a §6 name arrives as a uniform from `bristles.ts`.
// ============================================================
export const BRISTLE_GATHER = `${BRISTLE_NOISE}${BRISTLE_TEXTURES}
uniform vec2 uPoint;
uniform vec2 uAxis;          // across axis (unit, doc frame)
uniform float uRadius;       // half-width in doc heights
uniform float uSheetAspect;  // document width / height
uniform vec2 uSheet;         // document size in texels
uniform float uPressure;
uniform float uGrain;        // §4.4 §6 paint.grain (BRISTLE_GRAIN 1.2), not Brush.grain
uniform float uSoftness;
uniform float uAlongPx;      // cumulative distance along the stroke, doc texels
uniform float uStrokeDistPx; // the same cumulative distance for the landing ramp
uniform float uHalfWidthPx;  // the dab's half-width in doc texels
uniform float uStreak;       // §6 paint.streak (BRISTLE_STREAK 0.9)
uniform float uStreakLen;    // §6 paint.streakLength (BRISTLE_STREAK_LENGTH 18)
uniform float uStreakShare;  // §6 streakShare (BRISTLE_STREAK_SHARE 0.15)
uniform float uRimContact;   // §6 rimContact (BRISTLE_RIM_CONTACT 0.45)
uniform float uHairs;        // §6 hairs (BRISTLE_HAIRS 0.45)
uniform float uDryEdge;      // §6 dryEdge (BRISTLE_DRY_EDGE 0.35)
uniform float uLanding;      // §6 paint.landing (BRISTLE_LANDING 1)
// 261119-pod — the §3.3 smear and the four-side Feather. The snapshot pair
// (attachment 0 = coefficients, attachment 1 = coefficients + COVER alpha)
// and the last-touch field are the smear's inputs; uSmear IS the Pickup
// global (1:1), and the two ceilings travel as uniforms from bristles.ts.
uniform sampler2D uSnapA;
uniform sampler2D uSnapB;
uniform sampler2D uTimes;    // the last-touch field's read half (R32F, D-24)
uniform float uNow;          // SECONDS on the virtual clock — never a wall clock
uniform float uWetSeconds;   // the paint's tack time (params.wetSeconds, >= 1)
uniform float uSmear;        // the Pickup global, 0..1 (D-A: one knob, two laws)
uniform float uSmearPeriodPx;// §3.3 hash cell (BRISTLE_SMEAR_PERIOD_PX 6)
uniform float uSmearCap;     // §3.3 clamp (BRISTLE_SMEAR_CAP 0.8)
uniform float uFeather;      // the Feather global, 0..1
uniform float uFeatherReach; // Studio-only four-side reach (BRISTLE_FEATHER_REACH 0.45)
// Post-UAT 2026-11-19 (GAP-4) — the texture tip composes with the gather
// instead of disabling the engine. uTipMix is 0 for a bristle brush with no
// textureId, so every recorded untextured bristle stroke keeps its exact
// law; with a texture tip bound it is 1 and tipMask multiplies the gather's
// coverage.
uniform sampler2D uTip;
uniform float uTipAspect;
uniform float uTipRotation;
uniform float uRough;
uniform float uJitter;
uniform float uTipMix;

// The tip mask, sampled in the SAME rotated tip space footprintMask
// (FOOTPRINT_MASK) uses: the aspect squash, the recorded rotation, the
// per-dab jitter slice keyed on uPoint, and the long roughness ramp (a dry
// brush re-thresholds the tip). It is a MULTIPLIER on the gather's coverage
// — the tip says WHERE the dab lands, the gather says HOW MUCH — so the
// engine and a texture tip compose instead of one replacing the other.
float tipMask(vec2 uv){
  vec2 p = uv - uPoint;
  p.x *= uSheetAspect;
  vec2 q = vec2(dot(p, uAxis), dot(p, vec2(-uAxis.y, uAxis.x))) / uRadius;
  q.y /= max(uTipAspect, 1e-3);
  float a = uTipRotation;
  vec2 tq = vec2(q.x * cos(a) - q.y * sin(a), q.x * sin(a) + q.y * cos(a));
  float e0 = fract(sin(dot(uPoint, vec2(12.9898, 78.233))) * 43758.5453);
  float e1 = fract(e0 * 63.7264 + 0.37);
  vec2 suv = clamp(tq * 0.5 + 0.5 + (vec2(e0, e1) - 0.5) * uJitter, 0.0, 1.0);
  float t = texture(uTip, suv).r;
  float th = uRough * 0.45;
  return smoothstep(th, th + 0.5, t);
}

// §3.4 / §3.3 — the gather's OWN wetness law: the carrier's pinned arithmetic
// shape, read off the pre-dab snapshot's COVER alpha (attachment 1's .a,
// the reference's canvas.a). Unconditional: the gather has ONE law, so no
// A/B mode rides it.
float wetAt(vec2 uv){
  float age = max(uNow - texture(uTimes, uv).r, 0.0);
  return exp(-age / max(uWetSeconds, 1.0)) * texture(uSnapB, uv).a;
}

// §3.3 — the reference's per-pixel drag weight (pickup · wet · hash21 of the
// nearest bristle and the along-stroke 6 px cell), clamped to the shipped
// cap. alongPx is the PIXEL's along coordinate (uAlongPx + q.y · the dab
// half-width), exactly like the reference's distanceAlong, so there is no
// dab-constant divergence. ONE declaration: the deposit and the coverage
// write both call it, and only ever inside the uSmear > 0 guard.
float smearWeight(int nearest, float alongPx, float wet){
  return clamp(uSmear * wet * hash21(vec2(float(nearest), floor(alongPx / uSmearPeriodPx))), 0.0, uSmearCap);
}

// The four-side Feather ramp (Studio-only; the reference fades across the
// stroke only). Each axis falls from 1 to 0 across the outer reach of the
// dab's local frame; the product is mixed in by Feather. The caller encloses
// the multiply in the uFeather > 0 guard, so Feather 0 is EXACTLY the
// shipped arithmetic.
float featherFall(float across, float along){
  float side = 1.0 - smoothstep(1.0 - uFeatherReach, 1.0, abs(across));
  float end = 1.0 - smoothstep(1.0 - uFeatherReach, 1.0, abs(along));
  return mix(1.0, side * end, uFeather);
}

// §4.4 — the paper tooth as a threshold, in TWO coordinate systems:
//  - streaks: brush-local, rotated to the stroke normal — grooves that follow
//    the stroke (11 px / 3 px across, 0.75 / 1.9 along);
//  - tooth: screen/CSS space, isotropic — the physical tooth of the paper;
//  - cloud: screen/CSS space, low frequency — absorbency variation.
// The mix weights are streakShare vs (0.65 − streakShare), with the tooth
// fixed at 0.35, so the three bands sum to exactly one weight.
float grainHeight(vec2 css, vec2 normal){
  vec2 tangent = vec2(-normal.y, normal.x);
  vec2 local = vec2(dot(css, tangent), dot(css, normal));
  float streaks = valueNoise(vec2(local.x / 11.0, local.y * 0.75)) * 0.65
                + valueNoise(vec2(local.x / 3.0, local.y * 1.9)) * 0.35;
  float tooth = valueNoise(css * 1.3) * 0.55 + valueNoise(css * 0.45 + 17.0) * 0.45;
  float cloud = valueNoise(css * 0.12 + 41.0) * 0.45
              + valueNoise(css * 0.05 + 83.0) * 0.33
              + valueNoise(css * 0.02 + 7.0) * 0.22;
  return streaks * uStreakShare + tooth * 0.35 + cloud * (0.65 - uStreakShare);
}

struct Gathered {
  vec4 cA;                   // carried absorbance 0..3
  vec3 cB;                   // carried absorbance 4..6
  float alpha;               // carried layer alpha
  float coverage;            // §4.4-thresholded body, 0..1
  int nearest;               // the gathered centre bristle
};

Gathered gatherBristle(vec2 uv){
  Gathered g;
  g.cA = vec4(0.0);
  g.cB = vec3(0.0);
  g.alpha = 0.0;
  g.coverage = 0.0;
  g.nearest = 0;
  vec2 p = uv - uPoint;
  p.x *= uSheetAspect;
  vec2 q = vec2(dot(p, uAxis), dot(p, vec2(-uAxis.y, uAxis.x))) / uRadius;
  float across = q.x;
  int count = int(uCount + 0.5);
  float spacing = 2.0 / float(count);
  int nearest = int(floor((across + 1.0) / spacing));
  if (nearest < 0 || nearest >= count) return g;
  g.nearest = nearest;

  float inkSum = 0.0;
  float profileSum = 0.0;
  for (int o = -2; o <= 2; o++){
    int idx = nearest + o;
    if (idx < 0 || idx >= count) continue;
    vec4 state = bristleTex(uState, idx);
    vec4 shape = bristleTex(uShape, idx);
    // §4.1: radius = max(radiusScale * spacing * halfWidth, 0.8 px).
    float spacingPx = spacing * uRadius * uSheet.y;
    float radius = max(shape.x * spacingPx, 0.8);
    float offset = (across - state.y) * uRadius * uSheet.y / radius;
    if (abs(offset) >= 1.0) continue;
    float profile = 1.0 - offset * offset;
    profile *= profile;                                    // §5.1
    // §5.3: the SHARED contact law (BRISTLE_NOISE) — rim-scaled noise along
    // the stroke, so edge bristles keep dropping out and back in.
    float touch = touchOf(
      shape.y + bristleContact(uAlongPx, state.z, uStreakLen) * bristleRimShare(state.y) * uRimContact,
      uPressure);
    float load = state.x;
    // §4.3: the stroke eating itself — a loaded bristle prints solid, a
    // drying one prints per-bristle dashes whose wavelength is uStreakLen.
    float dryness = clamp((1.0 - load) * uStreak * 1.6, 0.0, 1.0);
    float streak = noise1(uAlongPx / max(uStreakLen, 1.0) + state.z * 4096.0);
    float broken = mix(1.0, smoothstep(0.3, 0.7, streak), dryness * uHairs);
    // §5.4: a staggered per-bristle landing ramp over the first brush widths.
    float landing = (0.04 + 0.7 * fract(state.z * 13.7) * fract(state.z * 13.7)) * uLanding;
    float landed = smoothstep(landing, landing + 0.12, uStrokeDistPx / max(uHalfWidthPx, 1.0));
    float ink = profile * min(load * 1.5, 1.0) * touch * broken * landed;  // §3.2
    inkSum += ink;
    profileSum += profile;
    vec4 pa = bristleTex(uPaintA, idx);
    vec4 pb = bristleTex(uPaintB, idx);
    g.cA += ink * pa;
    g.cB += ink * pb.rgb;
    g.alpha += ink * pb.a;
  }
  if (inkSum <= 1e-4) return g;
  g.cA /= inkSum;
  g.cB /= inkSum;
  g.alpha /= inkSum;

  // §4.5 wide vs local body: the wide samples the bundle 7 bristles apart, so
  // it reads the brush's body; local is the fine per-bristle ink of this
  // pixel. The same uHairs that cuts a drying stroke mixes the two.
  float wide = 0.0;
  for (int o = -2; o <= 2; o++){
    int idx = clamp(nearest + o * 7, 0, count - 1);
    vec4 wState = bristleTex(uState, idx);
    vec4 wShape = bristleTex(uShape, idx);
    wide += min(wState.x * 1.25, 1.0) * touchOf(wShape.y, uPressure);
  }
  float presence = min(profileSum / 0.5, 1.0);
  float local = inkSum / max(profileSum, 0.5);
  float body = mix(wide / 5.0 * presence, local, uHairs);

  // §4.4 / §5.5: the paper threshold, biased at the rim. uGrain is §6's
  // BRISTLE_GRAIN (1.2) — the paper-tooth scale, never Brush.grain.
  vec2 css = uv * uSheet;
  float height = grainHeight(css, uAxis);
  float threshold = uGrain * (1.0 - height) - 0.25;
  float dryEdge = mix(1.0, uDryEdge, smoothstep(0.3, 1.05, abs(across)));
  float coverage = body * (0.3 + 0.7 * uPressure) * dryEdge;
  // 261119-pod: the four-side Feather ramp multiplies coverage BEFORE the
  // threshold — Feather 0 never executes the multiply (the shipped law).
  if (uFeather > 0.0) coverage *= featherFall(across, q.y);
  g.coverage = smoothstep(threshold - uSoftness, threshold + uSoftness, coverage);
  // GAP-4: a texture tip bounds WHERE the dab lands (uTipMix = 0 keeps the
  // untextured law byte-identical: the multiply is never executed).
  if (uTipMix > 0.0) g.coverage *= tipMask(uv);
  return g;
}
`;

// 64-22 — the ink deposit. The gathered coefficients are the carried
// values ALREADY in the engine's coefficient space, and the gather's
// coverage is the reference's `deposit` — the ONE weight of the ONE
// compositing operation (§1/§3.5: `mix(canvas, carried, deposit)`).
//
// Post-UAT 2026-11-19 (GAP-1) — the deposit is a LERP, never a sum. The
// shipped law ADDED `carried · uAmount · deposit` into the mobile layer on
// every dab (blend ONE, ONE) while the coverage channel took a UNION of the
// same dabs. Over the ~100–230 overlapping dabs of a stroke the absorbance
// coefficients drifted away from the carried colour and the additive
// scattering S ran away, saturating the Kubelka-Munk reflectance to white
// — the flat white bars — and the union alpha outran the ink it belonged
// to — the pale halo. This fragment is one half of the lerp; `uMode` picks
// which half, and the caller blends each half with the pair named here:
//
//   ink <- ink · (1 − a) + carried · a     (mode 1: ZERO, ONE_MINUS_SRC_COLOR)
//   S   <- S   · (1 − a) + uScatter · a    (mode 0: ONE, ONE)
//
// `a = gatherBristle(vUv).coverage` is the same weight in both halves, so
// the film converges on the paint the bristles actually carry and S is
// BOUNDED by the ONE curve's `scatteringDeposit` (`uScatter`, computed by
// the engine — no fragment re-derives the exponent).
export const bristleDepositFS = `${HEADER}${BRISTLE_GATHER}
layout(location=0) out vec4 oA;   // absorbance 0..3
layout(location=1) out vec4 oB;   // absorbance 4..6, scattering S
uniform int uMode;                // 1 = the attenuation half, 0 = the carried half
uniform float uScatter;           // scatteringDeposit(body, amount), the ONE curve
void main(){
  // The same square cull the stamp uses (an early-out only: coverage can
  // be zero inside it, and is then written as a zero deposit).
  vec2 p = vUv - uPoint;
  p.x *= uSheetAspect;
  vec2 q = vec2(dot(p, uAxis), dot(p, vec2(-uAxis.y, uAxis.x))) / uRadius;
  if (abs(q.x) > 1.15 || abs(q.y) > 1.15) discard;
  Gathered g = gatherBristle(vUv);
  float a = clamp(g.coverage, 0.0, 1.0);
  if (a <= 1e-3) discard;
  // §3.3 (261119-pod): carry the deposit toward the PRE-DAB canvas in
  // COEFFICIENT space — absorbance toward the snapshot, the reference's
  // RGB-toward-paper mix re-expressed in the engine's units. ONE helper, and
  // the block is unreachable at Pickup 0 (uSmear = 0 skips the sample too).
  vec4 cA = g.cA;
  vec3 cB = g.cB;
  if (uSmear > 0.0) {
    float smear = smearWeight(g.nearest, uAlongPx + q.y * uHalfWidthPx, wetAt(vUv));
    cA = mix(cA, texture(uSnapA, vUv), smear);
    cB = mix(cB, texture(uSnapB, vUv).rgb, smear);
  }
  if (uMode == 1) {
    // The attenuation half: the destination becomes dst · (1 − a) through
    // ZERO, ONE_MINUS_SRC_COLOR. The fragment's own value IS the (1 − a)
    // factor, so every channel writes a and the blend subtracts it.
    oA = vec4(a);
    oB = vec4(a);
  } else {
    // The carried half: + carried · a. oB's alpha is the scattering S — the
    // SAME weight, so the veil lands exactly where the paint does and can
    // never accumulate past uScatter.
    oA = cA * a;
    oB = vec4(cB * a, uScatter * a);
  }
}`;

// 64-22 — the coverage write: the SAME gather's coverage, once per dab.
// The caller blends it ONE, ONE_MINUS_SRC_ALPHA into the coverage channel
// with the gather's own coverage as the weight (`src.a`), so the channel
// follows `cover <- cover · (1 − a) + T · a` — the SAME lerp the ink and S
// make, never a union that can outrun the paint beside it.
//
// Post-UAT 2026-11-19 (GAP-1) — `T` is the film's target opacity,
// `uCoverTarget · g.alpha`: Body's opacity (Engine's `bristleBodyAlpha`)
// times the carried layer alpha. The shipped law wrote the bare coverage,
// a union that saturated to 1 while the ink stayed faint, and mode 4's
// `max(darkAlpha, cov)` promoted the alpha past the paint and re-solved a
// near-white pigment — the pale halo and Body-as-transparency. The erode
// pass (D-21's Body-mask program) is gone: Body no longer masks paint
// that already landed, it sets how opaque THIS film is.
export const bristleCoverFS = `${HEADER}${BRISTLE_GATHER}
layout(location=0) out vec4 o0;
uniform float uCoverTarget;       // bristleBodyAlpha · carried alpha
void main(){
  vec2 p = vUv - uPoint;
  p.x *= uSheetAspect;
  vec2 q = vec2(dot(p, uAxis), dot(p, vec2(-uAxis.y, uAxis.x))) / uRadius;
  if (abs(q.x) > 1.15 || abs(q.y) > 1.15) discard;
  Gathered g = gatherBristle(vUv);
  float a = clamp(g.coverage, 0.0, 1.0);
  if (a <= 1e-3) discard;
  // §3.3 (261119-pod): the coverage target carries toward the snapshot's
  // COVER alpha through the SAME helper and the same guard, so the ink, the
  // scattering and the coverage all move by one weight.
  float target = a * uCoverTarget * g.alpha;
  if (uSmear > 0.0) {
    float smear = smearWeight(g.nearest, uAlongPx + q.y * uHalfWidthPx, wetAt(vUv));
    target = mix(target, a * uCoverTarget * texture(uSnapB, vUv).a, smear);
  }
  o0 = vec4(target, 0.0, 0.0, a);
}`;

// ============================================================
//  64-24 (D-24) — THE TOUCH STAMP.
//
//  One cheap document-sized draw over the dab's rect, after the deposit and
//  its one coverage write: `weight = clamp(cover, 0, 1)` — the coverage
//  channel IS the weight, and the last-touch field mixes toward `uNow`; a
//  texel this dab painted is now `uNow` old, a texel it missed keeps its age.
//  No gather, so the touch refresh stays one draw (D-29's third pass).
//  `uTimes` is the exact-float field's read half — exact f32 because the
//  cleared sentinel (−604800 s) is outside half-float's range.
//
//  261119-pod (Rule 1, measured): the weight used to be multiplied by the
//  dab's ink `uAmount` (~0.01..0.03 per dab). Against the one-week sentinel
//  that needs ~250 overlapping dabs at one texel to freshen, so the field
//  stayed ~-48000 s after a full stroke and §3.4's `exp(-age/7)` was always 0
//  — pickup inert at EVERY Body (both acceptance scenes byte-identical). The
//  reference writes `times[i] = mix(times[i], now, deposit)` with the dab's
//  DEPOSIT weight, order 1 at the stroke core. The coverage write this pass
//  samples is that weight's accumulated analogue (0.5 floor at Body 0), so
//  the bare channel converges in a few dabs, exactly as the shipped law's own
//  prose ("the coverage channel IS the weight") always claimed.
// ============================================================
export const bristleTouchFS = `${HEADER}
layout(location=0) out vec4 o0;
uniform sampler2D uTimes, uCover;
uniform float uNow;
uniform float uAmount;
void main(){
  float weight = clamp(texture(uCover, vUv).x, 0.0, 1.0);
  o0 = vec4(mix(texture(uTimes, vUv).r, uNow, weight));
}`;

// Paper, generated per document and whenever the paper is changed, in two passes.
// paperFieldFS builds the sheet's procedural field into a half-float target:
//   x = height 0..1 (mean ~0.5), y = mottle 0..1 (fibre clumping, 0.5 neutral),
//   z = fleck 0..1 (0.5 none, below: dark speck, above: light fibre).
// paperLightFS then lights the height from the upper left and packs the paper texture.
// Positions are in "units": a texel of a 1100-texel-tall sheet, about 0.18 mm, so the
// grain looks the same at any document size.
export const paperFieldFS = `${HEADER}
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

// Light the field's height from the upper left. Packs the paper texture:
//   r = lit relief (0.5 flat), g = height, b = mottle, a = fleck.
export const paperLightFS = `${HEADER}
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

/** The sheet's colour (linear) from a paper texel; shared by the display and the swatches. */
const PAPER_COLOUR = `
uniform vec3 uPaperTint, uFleckTint;
uniform float uMottle;
uniform float uTexture;       // texture strength: 0 a flat sheet of the tint, 1 full relief
vec3 paperColour(vec4 paper, vec3 base){
  vec3 c = base * (1.0 + uTexture * ((paper.r - 0.5) * 0.32 + (paper.b - 0.5) * uMottle * 2.0));
  float fl = (paper.a - 0.5) * 2.0 * uTexture;
  return fl < 0.0 ? mix(c, uFleckTint, -fl) : mix(c, min(base * 1.1 + 0.02, vec3(1.0)), fl);
}`;

/** A paper preview: the sheet with a granulating ultramarine wash across one corner. */
export const paperSwatchFS = `${HEADER}
out vec4 o;
uniform sampler2D uPaper;
${PAPER_COLOUR}
${TO_SRGB}
void main(){
  vec4 paper = texture(uPaper, vUv);
  vec3 c = paperColour(paper, uPaperTint);
  float x = vUv.x * 0.62 + (1.0 - vUv.y) * 0.38 + (paper.g - 0.5) * 0.03;
  float wash = smoothstep(0.6, 0.605, x);
  float gran = 1.0 + (0.5 - paper.g) * 2.4;
  float tide = 1.0 + 0.5 * exp(-(x - 0.6) * 90.0) * wash;
  c *= mix(vec3(1.0), pow(vec3(0.3, 0.38, 0.72), vec3(gran * tide)), wash);
  o = vec4(toSRGB(c), 1.0);
}`;

/** The sheet alone (fond / thumbs): PAPER_COLOUR + TO_SRGB, no swatch wash. */
export const paperSheetFS = `${HEADER}
out vec4 o;
uniform sampler2D uPaper;
${PAPER_COLOUR}
${TO_SRGB}
void main(){
  vec4 paper = texture(uPaper, vUv);
  vec3 c = paperColour(paper, uPaperTint);
  o = vec4(toSRGB(c), 1.0);
}`;

// Paint-bucket wash. uField holds, per document texel, the distance travelled from the
// tap through the chosen area (r, px; -1 outside it) and the distance to the area's edge
// (g, px). The front is a ramp uWidth px wide: a texel at distance r has received the
// fraction ramp(t - r) of its deposit once the front has reached t, so the frame that
// moves the front from uFrom to uTo lays down the difference. Summed over all frames
// that is exactly one deposit per texel, with no frame boundary to leave a tide line.
// Water is drawn with MAX blending, so it gets the cumulative ramp instead. MRT like splatFS.
export const fillFS = `${HEADER}
layout(location=0) out vec4 o0;
layout(location=1) out vec4 o1;
uniform highp sampler2D uField;
uniform sampler2D uPaper;
uniform float uFrom, uTo, uWidth, uSoft, uGrain, uGrainThr, uJitter;
uniform int uCumulative;
uniform vec4 uColor0, uColor1;
float ramp(float x){ return smoothstep(0.0, 1.0, clamp(x / uWidth, 0.0, 1.0)); }
void main(){
  vec2 f = texture(uField, vUv).rg;
  if (f.r < 0.0) discard;
  float h = texture(uPaper, vUv).g;
  float r = max(0.0, f.r + (h - 0.5) * uJitter);
  float w = ramp(uTo - r) - (uCumulative == 1 ? 0.0 : ramp(uFrom - r));
  if (w <= 0.0) discard;
  float edge = uSoft > 0.0 ? smoothstep(0.0, uSoft, f.g + 0.5) : 1.0;
  w *= edge * mix(1.0, smoothstep(uGrainThr - 0.08, uGrainThr + 0.08, h), uGrain);
  o0 = uColor0 * w;
  o1 = uColor1 * w;
}`;

/**
 * Final composite: spectral reconstruction of pigment on paper.
 *
 * Phase 64 (MED-34 / MED-35) — each display band reconstructs through the
 * two-constant Kubelka-Munk layer-over-white form from the settled scattering
 * scalar (the mobile plus the fixed alpha), calibrated by half the absorption
 * exponent so a scattering-free fragment evaluates the legacy exponential
 * verbatim. The scalar is scaled by the granulation factor beside the
 * coefficients (D-16), and the paper term stays the final multiply (D-15).
 *
 * Phase 64 (MED-15) — the paint thickness field shades as a lit relief:
 *   normal     one document texel of central difference, the same law
 *              paperLightFS uses (uReliefBump = 1.0, fixed, never zoom-scaled)
 *   lit delta  uLightIntensity * (dot(n, L) - L.z) * uReliefBump * EMBOSS_GAIN
 *              EMBOSS_GAIN = 2.3, EMBOSS_SHADE_MAX = 1.5
 *              (post-UAT 2026-11-17: 3.0 read too strong once the colours
 *              stopped being veiled; the pen pressure now drives the
 *              thickness deposit instead — see EMBOSS_PRESS_FLOOR)
 *   shade      clamp(1.0 + litDelta * (1.0 - uFlat), 0.0, EMBOSS_SHADE_MAX)
 *   applied    in PIGMENT space on every mode: the transmittance becomes
 *              mn + (t - mn) * shade (mn = min(t)), which is exactly the live
 *              compositor layer's composite. The alpha never carries the light,
 *              so the stored sheet's cached-base round-trip is exact and the
 *              darkest bands never darken into an outline. shade == 1 emits the
 *              legacy lines byte-for-byte.
 * At a zero gradient dot(n, L) == L.z and the lit delta is exactly 0, so the
 * shade is 1.0 at any intensity (D-09: never a flat multiply). uFlat gates the
 * lit delta only, so a region pick reads the unshaded sheet. The light angles
 * arrive in radians; only Engine.drawDisplay converts degrees.
 */
export const displayFS = `${HEADER}
out vec4 o;
uniform sampler2D uInkA, uInkB, uFixedA, uFixedB, uWet, uPaper;
uniform sampler2D uRelief; // Phase 64: paint thickness field (one channel)
uniform sampler2D uCover;  // SPIKE 001: pigment-layer coverage (one channel)
uniform vec4 uView;       // canvas px -> document uv: uv = (fragCoord - xy) / zw
uniform vec2 uTexel;      // document texel size
uniform float uGranulation, uEdgeDarken;
uniform float uFlat;      // 1: ignore the paper's relief, grain and wetness (for region picking)
uniform vec3 uDesk;
uniform int uMode;        // 0 screen, 1 export on paper, 2 export transparent, 3 export on white, 4 display pigment alpha
uniform sampler2D uRef;   // reference image (screen only), sRGB, y up
uniform vec4 uRefRect;    // its placement in document uv: xy origin, zw size
uniform float uRefOpacity;
uniform float uShadow;    // screen only: size of the sheet's shadow on the desk (canvas px), 0 for exports
uniform float uDpr;
uniform float uLightAzimuth, uLightElevation, uLightIntensity, uReliefBump; // Phase 64: radians, radians, 0..4, fixed bump
const float EMBOSS_GAIN = 2.3;
const float EMBOSS_SHADE_MAX = 1.5;
${PAPER_COLOUR}
${TO_SRGB}
float density(vec2 uv){ return texture(uInkA, uv).x + texture(uFixedA, uv).x; }

// Signed distance (canvas px) from p to the sheet, moved down by \`drop\`.
float sheetDist(vec2 p, float drop){
  vec2 q = abs(p - uView.xy - uView.zw * 0.5 + vec2(0.0, drop)) - uView.zw * 0.5;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
}

// The sheet lying on the desk: a tight contact shadow at its edge and a soft one
// cast a little downward, as from a light above and in front.
vec3 desk(vec2 p){
  float R = uShadow;
  float contact = 1.0 - smoothstep(0.0, 0.12 * R, sheetDist(p, 0.03 * R));
  float d = max(sheetDist(p, 0.3 * R), 0.0) / R;
  float ambient = exp(-3.0 * d * d) * 0.75 + exp(-0.9 * d) * 0.25;   // a soft core with a long, faint tail
  vec3 lin = pow(uDesk, vec3(2.2)) * (1.0 - 0.45 * contact) * (1.0 - 0.32 * ambient);
  return toSRGB(lin);
}

void main(){
  vec2 uv = (gl_FragCoord.xy - uView.xy) / uView.zw;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0){
    // Compositor layer: nothing outside the sheet — the fond is the compositor's.
    o = (uMode == 2 || uMode == 4) ? vec4(0.0) : vec4(uShadow > 0.0 ? desk(gl_FragCoord.xy) : uDesk, 1.0);
    return;
  }

  vec4 paper = mix(texture(uPaper, uv), vec4(0.5), uFlat);
  vec4 iB = texture(uInkB, uv);
  vec4 fB = texture(uFixedB, uv);
  vec4 a = texture(uInkA, uv) + texture(uFixedA, uv);
  vec3 b = iB.rgb + fB.rgb;
  // Phase 64 (MED-34): the settled scattering scalar, one broadband value for
  // every band. It is scaled with the coefficients below, so the grainiest
  // paint is also the most variable in opacity (D-16).
  float scatter = iB.a + fB.a;

  // Granulation: pigment settles into the valleys of the paper.
  float d0 = a.x;
  float gran = 1.0 + uGranulation * (0.5 - paper.g) * 2.2;
  // Edge darkening from the density gradient keeps fine pen work crisp.
  float l = density(uv - vec2(uTexel.x, 0.0)), r = density(uv + vec2(uTexel.x, 0.0));
  float bt = density(uv - vec2(0.0, uTexel.y)), t = density(uv + vec2(0.0, uTexel.y));
  float edge = min(length(vec2(r - l, t - bt)) / (d0 + 1.0), 1.0);
  float k = mix(gran * (1.0 + uEdgeDarken * edge), 1.0, uFlat);
  a *= k; b *= k; scatter *= k;

  vec3 rgb = vec3(0.0);
  float tr;
${displayBasisGLSL()}

  // Phase 64 (MED-15): light the paint thickness field. One document texel of
  // central difference — the same law paperLightFS uses — so the gradient is
  // fixed in document space and cannot crawl under zoom or pan. A texel with
  // no thickness casts no shade. A flat field tilts the normal to (0, 0, 1),
  // where dot(n, L) - L.z is exactly 0 at any intensity: the emboss is a
  // gradient term, never a flat multiply.
  float shade = 1.0;
  {
    float c = texture(uRelief, uv).x;
    if (c > 0.0){
      float l = texture(uRelief, uv - vec2(uTexel.x, 0.0)).x, r = texture(uRelief, uv + vec2(uTexel.x, 0.0)).x;
      float b = texture(uRelief, uv - vec2(0.0, uTexel.y)).x, t = texture(uRelief, uv + vec2(0.0, uTexel.y)).x;
      vec3 n = normalize(vec3((l - r) * uReliefBump, (b - t) * uReliefBump, 1.0));
      vec3 L = normalize(vec3(
        cos(uLightElevation) * cos(uLightAzimuth),
        cos(uLightElevation) * sin(uLightAzimuth),
        sin(uLightElevation)));
      float litDelta = uLightIntensity * (dot(n, L) - L.z) * uReliefBump * EMBOSS_GAIN;
      shade = clamp(1.0 + litDelta * (1.0 - uFlat), 0.0, EMBOSS_SHADE_MAX);
    }
  }

  // Phase 64: ONE shading law for every mode. The live compositor layer
  // (mode 4) shades in PIGMENT space — the pigment colour scales, the alpha
  // does not. Scaling the linear transmittance instead (the first cut) darkened
  // the darkest bands, so the emboss gradient read as a dark outline, and it
  // made the mode-2 sheet's cached-base alpha differ from the live layer.
  // Emitting the shaded transmittance as mn + (t - mn) * shade makes mode 2,
  // mode 4 and the cached-base round-trip the SAME law by construction. At
  // shade == 1 every legacy line below is byte-identical.
  vec3 tSrgb = toSRGB(rgb);
  float tMin = min(min(tSrgb.r, tSrgb.g), tSrgb.b);
  vec3 lit = vec3(tMin) + (tSrgb - vec3(tMin)) * shade;

  if (uMode == 4){
    // PIGMENT ALPHA (compositor display, 2026-10-26 round 2). The same
    // transmittance as mode 2, re-expressed as straight-alpha pigment so the
    // live sheet stacks with REAL layer alpha. Light washes stay translucent,
    // dense pigment masks. displayFS writes PREMULTIPLIED pixels (F1 contract),
    // so scale the colour by alpha. Storage/export keeps mode 2's opaque sheet.
    // Phase 64: the emboss scales only the premultiplied colour; the alpha is
    // derived from the UNSHADED reconstruction and stays byte-for-byte
    // untouched, so a lit stroke never changes its opacity.
    //
    // SPIKE 001: alpha is the max of the darkness alpha and the composited
    // COVERAGE. A near-white pigment's darkness alpha is ~0.06, which is why
    // the punch machinery existed; coverage is pigment-independent, so white
    // acrylic now hides what is beneath it. The colour keeps the same
    // over-white identity — over a white fond source-over gives
    // colour*alpha + (1-alpha) = t — and reduces exactly to the old formula
    // (alpha = 1 - tMin, colour = (t - tMin) / alpha) wherever cover is 0.
    float darkAlpha = 1.0 - tMin;
    float cov = texture(uCover, uv).x;
    float alpha = clamp(max(darkAlpha, cov), 0.0, 1.0);
    vec3 pigment = alpha > 0.0 ? (tSrgb - vec3(1.0 - alpha)) / alpha : vec3(0.0);
    pigment = clamp(pigment, 0.0, 1.0);
    o = vec4(pigment * alpha * shade, alpha);
    return;
  }

  if (uMode == 2){
    // TRANSMITTANCE, opaque (R2.2 paper-agnostic multiply seam). lit is how
    // much paper light gets through the pigment. Composited with
    // mix-blend-mode: multiply over ANY fond: result = fond x lit, exactly the
    // live mode-4 layer's composite. No alpha to misread (F1 neon / fringe)
    // and no un-mix round-trip to lose thin strokes (F2 fade).
    o = vec4(lit, 1.0);
    return;
  }

  // Paper: the sheet's tint, lit relief, fibre mottling and flecks (linear light).
  vec3 paperCol = paperColour(paper, uMode == 3 ? vec3(1.0) : uPaperTint);
  // On screen, a reference image shows through the paper, under the paint.
  if (uMode == 0 && uRefOpacity > 0.0){
    vec2 ruv = (uv - uRefRect.xy) / uRefRect.zw;
    if (ruv.x >= 0.0 && ruv.y >= 0.0 && ruv.x <= 1.0 && ruv.y <= 1.0){
      vec4 r = texture(uRef, ruv);
      vec3 lin = pow(r.rgb, vec3(2.2));
      paperCol = mix(paperCol, lin, r.a * uRefOpacity);
    }
  }
  // Back to linear for the paper multiply. shade == 1 keeps the legacy linear
  // transmittance exactly, so a relief-free sheet stays byte-identical.
  vec3 litLinear = shade == 1.0 ? rgb : fromSRGB(lit);
  vec3 col = litLinear * paperCol;

  // Wet paper reads darker and slightly cool.
  float ws = uMode == 3 ? 0.0 : smoothstep(0.02, 0.7, texture(uWet, uv).x) * (1.0 - uFlat);
  col *= vec3(1.0) - ws * vec3(0.12, 0.11, 0.08);

  // On screen, the cut edge of the sheet catches a faint shade, so it reads as a thin card.
  if (uShadow > 0.0){
    float inside = -sheetDist(gl_FragCoord.xy, 0.0);
    col *= mix(0.9, 1.0, smoothstep(0.0, 1.5 * uDpr, inside));
  }

  o = vec4(toSRGB(col), 1.0);
}`;
