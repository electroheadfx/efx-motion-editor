// ============================================================
//  SPIKE 002 — per-bristle carrier + deposit shaders (WebGL2 / GLSL ES 3.0).
//
//  Port of the reference WebGPU/WGSL passes, with the sections of
//  /Users/lmarques/Dev/craft-brushes/notes/brush-blending.md that each
//  term comes from:
//
//    carrierBristleFS  shader F (§3.1): pickup/refill equilibrium, load
//                      depletion, thirst, travel, wet gate.
//    depositBristleFS  shader R (§3.2–§4.5, §5): 5-nearest ink-weighted
//                      gather, profile (§5.1), rim contact noise (§5.3),
//                      broken streaks (§4.3), staggered landing (§5.4),
//                      wide/local body (§4.5), grainHeight threshold (§4.4),
//                      dryEdge (§5.5). Writes absorbance coefficients.
//    coverBristleFS    the same gather, writing the dab's coverage (§4.5).
//    touchBristleFS    the last-touch stamp (§3.4): times = mix(times, now, deposit).
//
//  NOT PORTED, by construction (see README): the dual f16 storage-buffer
//  layout (§2), the GPU compute passes (a WebGL2 engine has no compute),
//  smudge mode, and the deposit-time RGB smear (§3.3), which mixes a
//  colour the spectral engine does not store — it needs its own law.
// ============================================================

const NOISE = `
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
`;

const HEADER = `#version 300 es
precision highp float;
in vec2 vUv;
${NOISE}
`;

/** Bristle textures are 1 × 256: row = bristle index. */
const BRISTLE_TEXTURES = `
uniform sampler2D uPaintA;   // carried absorbance coefficients 0..3
uniform sampler2D uPaintB;   // carried absorbance coefficients 4..6 + carried alpha
uniform sampler2D uState;    // (load, across, seed, valueJitter)
uniform sampler2D uShape;    // (radiusScale, touchReach, loadRate, spare)
uniform float uCount;
vec4 bristleTex(sampler2D t, int idx){ return texelFetch(t, ivec2(0, clamp(idx, 0, 255)), 0); }
`;

/**
 * The carrier — one invocation per bristle (gl_FragCoord.y = bristle index).
 *
 * §3.1:
 *   thirst = 0.15 + 2.4 * smoothstep(0.35, 0.9, fract(seed * 7.31))
 *   pickup = clamp(pickupRate * thirst * travel * wet * touch, 0, 0.75)
 *   refill = clamp(refillRate * travel * load, 0, 1)
 *   carried = mix(carried, canvas, pickup); carried = mix(carried, pigment, refill)
 *   load -= depletion * loadRate * travelledPx * touch * (0.35 + 0.65 * pressure)
 *   load += pickup * 0.25
 * §3.4 wetness = exp(-age / wetSeconds) * coverage  (timestamp mode),
 * or the existing-channel proxy wet * coverage (proxy mode).
 */
export const carrierBristleFS = `${HEADER}
layout(location=0) out vec4 oA;
layout(location=1) out vec4 oB;
layout(location=2) out vec4 oC;
${BRISTLE_TEXTURES}
uniform sampler2D uInkA, uInkB, uFixedA, uFixedB, uWet, uCover, uTimes;
uniform vec2 uPoint;
uniform vec2 uAxis;          // across axis (unit, doc frame)
uniform float uRadius;       // half-width in doc heights
uniform float uSheetAspect;
uniform float uTravel;       // distance moved since the last dab, in brush widths
uniform float uTravelPx;     // the same distance in document texels
uniform float uPressure;
uniform float uPickupRate;
uniform float uRefillRate;
uniform float uDepletion;    // load lost per document texel travelled
uniform vec4 uPigmentA;      // palette absorbance 0..3
uniform vec3 uPigmentB;      // palette absorbance 4..6
uniform float uWetSeconds;
uniform float uNow;
uniform float uAlongPx;
uniform float uStreakLen;
uniform float uRimContact;
uniform int uWetMode;        // 0 = wet*cover proxy, 1 = last-touch timestamp

vec4 canvasAt(vec2 uv){
  vec4 a = texture(uInkA, uv) + texture(uFixedA, uv);
  vec3 b = (texture(uInkB, uv) + texture(uFixedB, uv)).rgb;
  return vec4(a.rgb, b.r);
}
vec3 canvasAtB(vec2 uv){
  vec4 ib = texture(uInkB, uv) + texture(uFixedB, uv);
  return ib.rgb;
}
float wetAt(vec2 uv){
  float cov = texture(uCover, uv).x;
  if (uWetMode == 1){
    float age = max(uNow - texture(uTimes, uv).r, 0.0);
    return exp(-age / uWetSeconds) * cov;
  }
  return texture(uWet, uv).x * cov;
}

void main(){
  int idx = int(gl_FragCoord.y);
  vec4 state = bristleTex(uState, idx);
  vec4 paintA = bristleTex(uPaintA, idx);
  vec4 paintB = bristleTex(uPaintB, idx);
  vec4 shape = bristleTex(uShape, idx);
  float across = state.y;

  // The bristle's own position and 3 taps along the stroke direction (§3.1).
  vec2 pos = uPoint + uAxis * (across * uRadius);
  vec2 dir = vec2(-uAxis.y, uAxis.x);
  float tap = uRadius * 0.35;
  float wet = max(wetAt(pos), max(wetAt(pos - dir * tap), wetAt(pos + dir * tap)));
  vec4 canvasA = canvasAt(pos);
  vec3 canvasB = canvasAtB(pos);
  float canvasAlpha = texture(uCover, pos).x;

  // §3.1 contact threshold with rim noise (§5.3 shares the same contact law).
  float rim = 0.25 + 0.75 * smoothstep(0.45, 1.0, abs(across));
  float contact = noise1(uAlongPx / max(uStreakLen * 0.7, 1.0) + state.z * 2048.0 + 0.5) - 0.5;
  float touch = touchOf(shape.y + contact * rim * uRimContact, uPressure);

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
}
`;

/**
 * The shared deposit gather (§3.2, §4.3–§4.5, §5). One law, included by both
 * the ink deposit and the coverage deposit so they can never diverge.
 *
 * `result.cA/.cB/.alpha` are the ink-weighted carried values; `coverage` is
 * the paper-thresholded body of §4.5; `nearest` is the gathered centre.
 */
const BRISTLE_GATHER = `${BRISTLE_TEXTURES}
uniform sampler2D uPaper, uWet, uCover, uTimes;
uniform vec2 uPoint;
uniform vec2 uAxis;
uniform float uRadius;
uniform float uSheetAspect;
uniform vec2 uSheet;          // document size in texels
uniform float uPressure;
uniform float uGrain;
uniform float uSoftness;
uniform float uStreak;
uniform float uStreakLen;
uniform float uStreakShare;
uniform float uRimContact;
uniform float uHairs;
uniform float uDryEdge;
uniform float uLanding;
uniform float uAlongPx;
uniform float uStrokeDistPx;
uniform float uHalfWidthPx;
uniform int uWetMode;
uniform float uWetSeconds;
uniform float uNow;

struct Gathered {
  vec4 cA;
  vec3 cB;
  float alpha;
  float coverage;
  int nearest;
};

// §4.4 paper tooth: streaks (brush-local, along the stroke), tooth
// (screen-space, isotropic), cloud (low-frequency absorbency).
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
  float along = q.y;
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
    profile *= profile;                                              // §5.1
    float rim = 0.25 + 0.75 * smoothstep(0.45, 1.0, abs(state.y));   // §5.3
    float contact = noise1(uAlongPx / max(uStreakLen * 0.7, 1.0) + state.z * 2048.0 + 0.5) - 0.5;
    float touch = touchOf(shape.y + contact * rim * uRimContact, uPressure);
    float load = state.x;
    float dryness = clamp((1.0 - load) * uStreak * 1.6, 0.0, 1.0);   // §4.3
    float streak = noise1(uAlongPx / max(uStreakLen, 1.0) + state.z * 4096.0);
    float broken = mix(1.0, smoothstep(0.3, 0.7, streak), dryness * uHairs);
    float landing = (0.04 + 0.7 * fract(state.z * 13.7) * fract(state.z * 13.7)) * uLanding; // §5.4
    float landed = smoothstep(landing, landing + 0.12, uStrokeDistPx / max(uHalfWidthPx, 1.0));
    float ink = profile * min(load * 1.5, 1.0) * touch * broken * landed;   // §3.2
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

  // §4.5 wide vs local body: the wide samples the bundle 7 bristles apart.
  float wide = 0.0;
  for (int o = -2; o <= 2; o++){
    int idx = clamp(nearest + o * 7, 0, count - 1);
    vec4 state = bristleTex(uState, idx);
    vec4 shape = bristleTex(uShape, idx);
    wide += min(state.x * 1.25, 1.0) * touchOf(shape.y, uPressure);
  }
  float presence = min(profileSum / 0.5, 1.0);
  float local = inkSum / max(profileSum, 0.5);
  float body = mix(wide / 5.0 * presence, local, uHairs);

  // §4.4 / §5.5: the paper threshold, biased at the rim.
  vec2 css = uv * uSheet;
  float height = grainHeight(css, uAxis);
  float threshold = uGrain * (1.0 - height) - 0.25;
  float dryEdge = mix(1.0, uDryEdge, smoothstep(0.3, 1.05, abs(across)));
  float coverage = body * (0.3 + 0.7 * uPressure) * dryEdge;
  g.coverage = smoothstep(threshold - uSoftness, threshold + uSoftness, coverage);
  return g;
}
`;

export const depositBristleFS = `${HEADER}${BRISTLE_GATHER}
layout(location=0) out vec4 oA;   // absorbance 0..3, premultiplied by the deposit
layout(location=1) out vec4 oB;   // absorbance 4..6, scattering S
uniform float uAmount;            // the dab's own pigment amount
uniform float uBody;              // canonical Body 0..1 (scatter source)

void main(){
  // The same square cull the stamp uses (an early-out only: coverage can be
  // zero inside it, and is then written as a zero deposit).
  vec2 p = vUv - uPoint;
  p.x *= uSheetAspect;
  vec2 q = vec2(dot(p, uAxis), dot(p, vec2(-uAxis.y, uAxis.x))) / uRadius;
  if (abs(q.x) > 1.15 || abs(q.y) > 1.15) discard;
  Gathered g = gatherBristle(vUv);
  float deposit = g.coverage;
  if (deposit <= 1e-3) discard;
  float amount = uAmount * deposit;
  // §3.2's carried colour is premultiplied in the reference; here the engine's
  // deposit is additive absorbance, so the coefficients ride the amount.
  float scatter = pow(clamp(uBody, 0.0, 1.0), 6.0) * amount;
  oA = g.cA * amount;
  oB = vec4(g.cB * amount, scatter);
}
`;

export const coverBristleFS = `${HEADER}${BRISTLE_GATHER}
layout(location=0) out vec4 o0;

void main(){
  vec2 p = vUv - uPoint;
  p.x *= uSheetAspect;
  vec2 q = vec2(dot(p, uAxis), dot(p, vec2(-uAxis.y, uAxis.x))) / uRadius;
  if (abs(q.x) > 1.15 || abs(q.y) > 1.15) discard;
  Gathered g = gatherBristle(vUv);
  if (g.coverage <= 1e-3) discard;
  o0 = vec4(clamp(g.coverage, 0.0, 1.0));
}
`;

/**
 * §3.4 last-touch stamp: times = mix(times, now, deposit).
 * The weight is the dab's own deposit mask, carried per pixel in the cover
 * draw's output (the caller passes the same rectangle in the same order), so
 * a partially covered texel only partially refreshes.
 */
export const touchBristleFS = `${HEADER}
layout(location=0) out vec4 o0;
uniform sampler2D uTimes, uCover;
uniform float uNow;
uniform float uAmount;
void main(){
  float prev = texture(uTimes, vUv).r;
  // The cover target was just stamped by this dab; its value is the union of
  // coverage, which is the closest per-pixel weight available without a
  // third fragment pass. The weight is bounded by the dab amount.
  float weight = clamp(texture(uCover, vUv).x * uAmount, 0.0, 1.0);
  o0 = vec4(mix(prev, uNow, weight));
}
`;
