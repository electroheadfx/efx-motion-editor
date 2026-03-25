/**
 * GLSL shader source strings for the brush FX rendering pipeline.
 *
 * Isolates all shader code in a dedicated module so that brushFxRenderer.ts
 * can focus on WebGL2 logic.  Embeds:
 *  - spectral.glsl (MIT, Ronald van Wijnen) for Kubelka-Munk pigment mixing
 *  - ashima/webgl-noise simplex 2D (MIT) for procedural paper texture
 *  - Vertex, stamp, composite, and post-effect fragment shaders
 */

// ---------------------------------------------------------------------------
// 1. Fullscreen-quad vertex shader (matches glBlur.ts / glslRuntime.ts)
// ---------------------------------------------------------------------------

export const BRUSH_FX_VERT_SRC = `#version 300 es
layout(location = 0) in vec2 a_position;
out vec2 v_texCoord;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = a_position * 0.5 + 0.5;
}
`;

// ---------------------------------------------------------------------------
// 2. Stamp quad vertex shader
// ---------------------------------------------------------------------------

export const STAMP_VERT_SRC = `#version 300 es
layout(location = 0) in vec2 a_position;
layout(location = 1) in vec2 a_texCoord;
uniform vec2 u_center;     // stamp center in pixel coords
uniform vec2 u_size;       // stamp width, height in pixels
uniform vec2 u_resolution; // canvas width, height
out vec2 v_texCoord;
void main() {
  vec2 pixel = u_center + a_position * u_size * 0.5;
  vec2 ndc = (pixel / u_resolution) * 2.0 - 1.0;
  ndc.y = -ndc.y; // flip Y for Canvas 2D compatibility
  gl_Position = vec4(ndc, 0.0, 1.0);
  v_texCoord = a_texCoord;
}
`;

// ---------------------------------------------------------------------------
// 3. Stamp fragment shader — p5.brush-style anti-aliased circle
// ---------------------------------------------------------------------------

export const STAMP_FRAG_SRC = `#version 300 es
precision highp float;
in vec2 v_texCoord;
uniform vec4 u_color;
uniform float u_hardness; // 0 = soft edge, 1 = hard edge (p5.brush style)
uniform float u_seed;     // per-stamp random seed
out vec4 out_fragColor;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec2 v = v_texCoord - 0.5;
  float f = length(v) * 2.0;

  // p5.brush approach: anti-aliased circle disc
  // Hard brushes: very narrow AA band (like fwidth). Soft: wider fade.
  float edgeWidth = mix(0.3, 0.02, u_hardness);
  f = 1.0 - smoothstep(1.0 - edgeWidth, 1.0, f);

  if (f < 0.01) discard;

  // Subtle per-pixel grain (soft brushes only)
  float grain = hash(v_texCoord * 200.0 + u_seed);
  float grainMod = 1.0 - mix(0.2, 0.0, u_hardness) * (grain - 0.5) * 2.0;

  out_fragColor = vec4(u_color.rgb, u_color.a * f * grainMod);
}
`;

// ---------------------------------------------------------------------------
// 4. spectral.glsl — 38-band Kubelka-Munk spectral pigment mixing
//    Source: https://github.com/rvanwijnen/spectral.js/blob/master/shader/spectral.glsl
//    MIT License — Copyright (c) 2025 Ronald van Wijnen
// ---------------------------------------------------------------------------

export const SPECTRAL_GLSL = `
//  MIT License
//
//  Copyright (c) 2025 Ronald van Wijnen
//
//  Permission is hereby granted, free of charge, to any person obtaining a
//  copy of this software and associated documentation files (the "Software"),
//  to deal in the Software without restriction, including without limitation
//  the rights to use, copy, modify, merge, publish, distribute, sublicense,
//  and/or sell copies of the Software, and to permit persons to whom the
//  Software is furnished to do so, subject to the following conditions:
//
//  The above copyright notice and this permission notice shall be included in
//  all copies or substantial portions of the Software.
//
//  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
//  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
//  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
//  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
//  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
//  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
//  DEALINGS IN THE SOFTWARE.

#ifndef SPECTRAL
#define SPECTRAL

const int SPECTRAL_SIZE = 38;
const float SPECTRAL_GAMMA = 2.4;
const float SPECTRAL_EPSILON = 0.0000000000000001;

float spectral_uncompand(float x) {
  return (x < 0.04045) ? x / 12.92 : pow((x + 0.055) / 1.055, SPECTRAL_GAMMA);
}

float spectral_compand(float x) {
  return (x < 0.0031308) ? x * 12.92 : 1.055 * pow(x, 1.0 / SPECTRAL_GAMMA) - 0.055;
}

vec3 spectral_srgb_to_linear(vec3 srgb) {
  return vec3(spectral_uncompand(srgb[0]), spectral_uncompand(srgb[1]), spectral_uncompand(srgb[2]));
}

vec3 spectral_linear_to_srgb(vec3 lrgb) {
  return clamp(vec3(spectral_compand(lrgb[0]), spectral_compand(lrgb[1]), spectral_compand(lrgb[2])), 0., 1.);
}

void spectral_linear_to_reflectance(vec3 lrgb, inout float R[SPECTRAL_SIZE]) {
  float w = min(lrgb.r, min(lrgb.g, lrgb.b));

  lrgb -= w;

  float c = min(lrgb.g, lrgb.b);
  float m = min(lrgb.r, lrgb.b);
  float y = min(lrgb.r, lrgb.g);

  float r = min(max(0.0, lrgb.r - lrgb.b), max(0.0, lrgb.r - lrgb.g));
  float g = min(max(0.0, lrgb.g - lrgb.b), max(0.0, lrgb.g - lrgb.r));
  float b = min(max(0.0, lrgb.b - lrgb.g), max(0.0, lrgb.b - lrgb.r));

  R[ 0] = max(SPECTRAL_EPSILON, w * 1.0011607271876400 + c * 0.9705850013229620 + m * 0.9906735573199880 + y * 0.0210523371789306 + r * 0.0315605737777207 + g * 0.0095560747554212 + b * 0.9794047525020140);
  R[ 1] = max(SPECTRAL_EPSILON, w * 1.0011606515972800 + c * 0.9705924981434250 + m * 0.9906715249619790 + y * 0.0210564627517414 + r * 0.0315520718330149 + g * 0.0095581580120851 + b * 0.9794007068431300);
  R[ 2] = max(SPECTRAL_EPSILON, w * 1.0011603192274700 + c * 0.9706253487298910 + m * 0.9906625823534210 + y * 0.0210746178695038 + r * 0.0315148215513658 + g * 0.0095673245444588 + b * 0.9793829034702610);
  R[ 3] = max(SPECTRAL_EPSILON, w * 1.0011586727078900 + c * 0.9707868061190170 + m * 0.9906181076447950 + y * 0.0211649058448753 + r * 0.0313318044982702 + g * 0.0096129126297349 + b * 0.9792943649455940);
  R[ 4] = max(SPECTRAL_EPSILON, w * 1.0011525984455200 + c * 0.9713686732282480 + m * 0.9904514808787100 + y * 0.0215027957272504 + r * 0.0306729857725527 + g * 0.0097837090401843 + b * 0.9789630146085700);
  R[ 5] = max(SPECTRAL_EPSILON, w * 1.0011325252899800 + c * 0.9731632306212520 + m * 0.9898710814002040 + y * 0.0226738799041561 + r * 0.0286480476989607 + g * 0.0103786227058710 + b * 0.9778144666940430);
  R[ 6] = max(SPECTRAL_EPSILON, w * 1.0010850066332700 + c * 0.9767402231587650 + m * 0.9882866087596400 + y * 0.0258235649693629 + r * 0.0246450407045709 + g * 0.0120026452378567 + b * 0.9747243211338360);
  R[ 7] = max(SPECTRAL_EPSILON, w * 1.0009968788945300 + c * 0.9815876054913770 + m * 0.9842906927975040 + y * 0.0334879385639851 + r * 0.0192960753663651 + g * 0.0160977721473922 + b * 0.9671984823439730);
  R[ 8] = max(SPECTRAL_EPSILON, w * 1.0008652515227400 + c * 0.9862802656529490 + m * 0.9739349056253060 + y * 0.0519069663740307 + r * 0.0142066612220556 + g * 0.0267061902231680 + b * 0.9490796575305750);
  R[ 9] = max(SPECTRAL_EPSILON, w * 1.0006962900094000 + c * 0.9899491476891340 + m * 0.9418178384601450 + y * 0.1007490148334730 + r * 0.0102942608878609 + g * 0.0595555440185881 + b * 0.9008501289409770);
  R[10] = max(SPECTRAL_EPSILON, w * 1.0005049611488800 + c * 0.9924927015384200 + m * 0.8173903261951560 + y * 0.2391298997068470 + r * 0.0076191460521811 + g * 0.1860398265328260 + b * 0.7631504454622400);
  R[11] = max(SPECTRAL_EPSILON, w * 1.0003080818799200 + c * 0.9941456804052560 + m * 0.4324728050657290 + y * 0.5348043122727480 + r * 0.0058980410835420 + g * 0.5705798201161590 + b * 0.4659221716493190);
  R[12] = max(SPECTRAL_EPSILON, w * 1.0001196660201300 + c * 0.9951839750332120 + m * 0.1384539782588700 + y * 0.7978075786430300 + r * 0.0048233247781713 + g * 0.8614677684002920 + b * 0.2012632804510050);
  R[13] = max(SPECTRAL_EPSILON, w * 0.9999527659684070 + c * 0.9957567501108180 + m * 0.0537347216940033 + y * 0.9114498940673840 + r * 0.0042298748350633 + g * 0.9458790897676580 + b * 0.0877524413419623);
  R[14] = max(SPECTRAL_EPSILON, w * 0.9998218368992970 + c * 0.9959128182867100 + m * 0.0292174996673231 + y * 0.9537979630045070 + r * 0.0040599171299341 + g * 0.9704654864743050 + b * 0.0457176793291679);
  R[15] = max(SPECTRAL_EPSILON, w * 0.9997386095575930 + c * 0.9956061578345280 + m * 0.0213136517508590 + y * 0.9712416154654290 + r * 0.0043533695594676 + g * 0.9784136302844500 + b * 0.0284706050521843);
  R[16] = max(SPECTRAL_EPSILON, w * 0.9997095516396120 + c * 0.9945976009618540 + m * 0.0201349530181136 + y * 0.9793031238075880 + r * 0.0053434425970201 + g * 0.9795890314112240 + b * 0.0205271767569850);
  R[17] = max(SPECTRAL_EPSILON, w * 0.9997319302106270 + c * 0.9922157154923700 + m * 0.0241323096280662 + y * 0.9833801195075750 + r * 0.0076917201010463 + g * 0.9755335369086320 + b * 0.0165302792310211);
  R[18] = max(SPECTRAL_EPSILON, w * 0.9997994363461950 + c * 0.9862364527832490 + m * 0.0372236145223627 + y * 0.9854612465677550 + r * 0.0135969795736536 + g * 0.9622887553978130 + b * 0.0145135107212858);
  R[19] = max(SPECTRAL_EPSILON, w * 0.9999003303166710 + c * 0.9679433372645410 + m * 0.0760506552706601 + y * 0.9864350469766050 + r * 0.0316975442661115 + g * 0.9231215745131200 + b * 0.0136003508637687);
  R[20] = max(SPECTRAL_EPSILON, w * 1.0000204065261100 + c * 0.8912850042449430 + m * 0.2053754719423990 + y * 0.9867382506701410 + r * 0.1078611963552490 + g * 0.7934340189431110 + b * 0.0133604258769571);
  R[21] = max(SPECTRAL_EPSILON, w * 1.0001447879365800 + c * 0.5362024778620530 + m * 0.5412689034604390 + y * 0.9866178824450320 + r * 0.4638126031687040 + g * 0.4592701359024290 + b * 0.0135488943145680);
  R[22] = max(SPECTRAL_EPSILON, w * 1.0002599790341200 + c * 0.1541081190018780 + m * 0.8158416850864860 + y * 0.9862777767586430 + r * 0.8470554052720110 + g * 0.1855741036663030 + b * 0.0139594356366992);
  R[23] = max(SPECTRAL_EPSILON, w * 1.0003557969708900 + c * 0.0574575093228929 + m * 0.9128177041239760 + y * 0.9858605924440560 + r * 0.9431854093939180 + g * 0.0881774959955372 + b * 0.0144434255753570);
  R[24] = max(SPECTRAL_EPSILON, w * 1.0004275378026900 + c * 0.0315349873107007 + m * 0.9463398301669620 + y * 0.9854749276762100 + r * 0.9688621506965580 + g * 0.0543630228766700 + b * 0.0148854440621406);
  R[25] = max(SPECTRAL_EPSILON, w * 1.0004762334488800 + c * 0.0222633920086335 + m * 0.9599276963319910 + y * 0.9851769347655580 + r * 0.9780306674736030 + g * 0.0406288447060719 + b * 0.0152254296999746);
  R[26] = max(SPECTRAL_EPSILON, w * 1.0005072096750800 + c * 0.0182022841492439 + m * 0.9662605952303120 + y * 0.9849715740141810 + r * 0.9820436438543060 + g * 0.0342215204316970 + b * 0.0154592848180209);
  R[27] = max(SPECTRAL_EPSILON, w * 1.0005251915637300 + c * 0.0162990559732640 + m * 0.9693259700584240 + y * 0.9848463034157120 + r * 0.9839236237187070 + g * 0.0311185790956966 + b * 0.0156018026485961);
  R[28] = max(SPECTRAL_EPSILON, w * 1.0005350960689600 + c * 0.0153656239334613 + m * 0.9708545367213990 + y * 0.9847753518111990 + r * 0.9848454841543820 + g * 0.0295708898336134 + b * 0.0156824871281936);
  R[29] = max(SPECTRAL_EPSILON, w * 1.0005402209748200 + c * 0.0149111568733976 + m * 0.9716050665281280 + y * 0.9847380666252650 + r * 0.9852942758145960 + g * 0.0288108739348928 + b * 0.0157248764360615);
  R[30] = max(SPECTRAL_EPSILON, w * 1.0005427281678400 + c * 0.0146954339898235 + m * 0.9719627697573920 + y * 0.9847196483117650 + r * 0.9855072952198250 + g * 0.0284486271324597 + b * 0.0157458108784121);
  R[31] = max(SPECTRAL_EPSILON, w * 1.0005438956908700 + c * 0.0145964146717719 + m * 0.9721272722745090 + y * 0.9847110233919390 + r * 0.9856050715398370 + g * 0.0282820301724731 + b * 0.0157556123350225);
  R[32] = max(SPECTRAL_EPSILON, w * 1.0005444821215100 + c * 0.0145470156699655 + m * 0.9722094177458120 + y * 0.9847066833006760 + r * 0.9856538499335780 + g * 0.0281988376490237 + b * 0.0157605443964911);
  R[33] = max(SPECTRAL_EPSILON, w * 1.0005447695999200 + c * 0.0145228771899495 + m * 0.9722495776784240 + y * 0.9847045543930910 + r * 0.9856776850338830 + g * 0.0281581655342037 + b * 0.0157629637515278);
  R[34] = max(SPECTRAL_EPSILON, w * 1.0005448988776200 + c * 0.0145120341118965 + m * 0.9722676219987420 + y * 0.9847035963093700 + r * 0.9856883918061220 + g * 0.0281398910216386 + b * 0.0157640525629106);
  R[35] = max(SPECTRAL_EPSILON, w * 1.0005449625468900 + c * 0.0145066940939832 + m * 0.9722765094621500 + y * 0.9847031240775520 + r * 0.9856936646900310 + g * 0.0281308901665811 + b * 0.0157645892329510);
  R[36] = max(SPECTRAL_EPSILON, w * 1.0005449892705800 + c * 0.0145044507314479 + m * 0.9722802433068740 + y * 0.9847029256150900 + r * 0.9856958798482050 + g * 0.0281271086805816 + b * 0.0157648147772649);
  R[37] = max(SPECTRAL_EPSILON, w * 1.0005449969930000 + c * 0.0145038009464639 + m * 0.9722813248265600 + y * 0.9847028681227950 + r * 0.9856965214637620 + g * 0.0281260133612096 + b * 0.0157648801149616);
}

vec3 spectral_xyz_to_srgb(vec3 xyz) {
  mat3 XYZ_RGB;

  XYZ_RGB[0] = vec3( 3.2409699419045200, -1.537383177570090, -0.4986107602930030);
  XYZ_RGB[1] = vec3(-0.9692436362808790,  1.875967501507720,  0.0415550574071756);
  XYZ_RGB[2] = vec3( 0.0556300796969936, -0.203976958888976,  1.0569715142428700);

  float r = dot(XYZ_RGB[0], xyz);
  float g = dot(XYZ_RGB[1], xyz);
  float b = dot(XYZ_RGB[2], xyz);

  return spectral_linear_to_srgb(vec3(r, g, b));
}

vec3 spectral_reflectance_to_xyz(float R[SPECTRAL_SIZE]) {
  vec3 xyz = vec3(0.);

  xyz += R[ 0] * vec3(0.0000646919989576, 0.0000018442894440, 0.0003050171476380);
  xyz += R[ 1] * vec3(0.0002194098998132, 0.0000062053235865, 0.0010368066663574);
  xyz += R[ 2] * vec3(0.0011205743509343, 0.0000310096046799, 0.0053131363323992);
  xyz += R[ 3] * vec3(0.0037666134117111, 0.0001047483849269, 0.0179543925899536);
  xyz += R[ 4] * vec3(0.0118805536037990, 0.0003536405299538, 0.0570775815345485);
  xyz += R[ 5] * vec3(0.0232864424191771, 0.0009514714056444, 0.1136516189362870);
  xyz += R[ 6] * vec3(0.0345594181969747, 0.0022822631748318, 0.1733587261835500);
  xyz += R[ 7] * vec3(0.0372237901162006, 0.0042073290434730, 0.1962065755586570);
  xyz += R[ 8] * vec3(0.0324183761091486, 0.0066887983719014, 0.1860823707062960);
  xyz += R[ 9] * vec3(0.0212332056093810, 0.0098883960193565, 0.1399504753832070);
  xyz += R[10] * vec3(0.0104909907685421, 0.0152494514496311, 0.0891745294268649);
  xyz += R[11] * vec3(0.0032958375797931, 0.0214183109449723, 0.0478962113517075);
  xyz += R[12] * vec3(0.0005070351633801, 0.0334229301575068, 0.0281456253957952);
  xyz += R[13] * vec3(0.0009486742057141, 0.0513100134918512, 0.0161376622950514);
  xyz += R[14] * vec3(0.0062737180998318, 0.0704020839399490, 0.0077591019215214);
  xyz += R[15] * vec3(0.0168646241897775, 0.0878387072603517, 0.0042961483736618);
  xyz += R[16] * vec3(0.0286896490259810, 0.0942490536184085, 0.0020055092122156);
  xyz += R[17] * vec3(0.0426748124691731, 0.0979566702718931, 0.0008614711098802);
  xyz += R[18] * vec3(0.0562547481311377, 0.0941521856862608, 0.0003690387177652);
  xyz += R[19] * vec3(0.0694703972677158, 0.0867810237486753, 0.0001914287288574);
  xyz += R[20] * vec3(0.0830531516998291, 0.0788565338632013, 0.0001495555858975);
  xyz += R[21] * vec3(0.0861260963002257, 0.0635267026203555, 0.0000923109285104);
  xyz += R[22] * vec3(0.0904661376847769, 0.0537414167568200, 0.0000681349182337);
  xyz += R[23] * vec3(0.0850038650591277, 0.0426460643574120, 0.0000288263655696);
  xyz += R[24] * vec3(0.0709066691074488, 0.0316173492792708, 0.0000157671820553);
  xyz += R[25] * vec3(0.0506288916373645, 0.0208852059213910, 0.0000039406041027);
  xyz += R[26] * vec3(0.0354739618852640, 0.0138601101360152, 0.0000015840125870);
  xyz += R[27] * vec3(0.0214682102597065, 0.0081026402038399, 0.0000000000000000);
  xyz += R[28] * vec3(0.0125164567619117, 0.0046301022588030, 0.0000000000000000);
  xyz += R[29] * vec3(0.0068045816390165, 0.0024913800051319, 0.0000000000000000);
  xyz += R[30] * vec3(0.0034645657946526, 0.0012593033677378, 0.0000000000000000);
  xyz += R[31] * vec3(0.0014976097506959, 0.0005416465221680, 0.0000000000000000);
  xyz += R[32] * vec3(0.0007697004809280, 0.0002779528920067, 0.0000000000000000);
  xyz += R[33] * vec3(0.0004073680581315, 0.0001471080673854, 0.0000000000000000);
  xyz += R[34] * vec3(0.0001690104031614, 0.0000610327472927, 0.0000000000000000);
  xyz += R[35] * vec3(0.0000952245150365, 0.0000343873229523, 0.0000000000000000);
  xyz += R[36] * vec3(0.0000490309872958, 0.0000177059860053, 0.0000000000000000);
  xyz += R[37] * vec3(0.0000199961492222, 0.0000072209749130, 0.0000000000000000);

  return xyz;
}

float KS(float R) {
  return pow(1.0 - R, 2.0) / (2.0 * R);
}

float KM(float KS) {
  return 1.0 + KS - sqrt(pow(KS, 2.0) + 2.0 * KS);
}

vec3 spectral_mix(vec3 color1, float tintingStrength1, float factor1, vec3 color2, float tintingStrength2, float factor2) {
  vec3 lrgb1 = spectral_srgb_to_linear(color1);
  vec3 lrgb2 = spectral_srgb_to_linear(color2);

  float R1[SPECTRAL_SIZE];
  float R2[SPECTRAL_SIZE];

  spectral_linear_to_reflectance(lrgb1, R1);
  spectral_linear_to_reflectance(lrgb2, R2);

  float luminance1 = spectral_reflectance_to_xyz(R1)[1];
  float luminance2 = spectral_reflectance_to_xyz(R2)[1];

  float R[SPECTRAL_SIZE];

  for (int i = 0; i < SPECTRAL_SIZE; i++) {
    float concentration1 = pow(factor1, 2.) * pow(tintingStrength1, 2.) * luminance1;
    float concentration2 = pow(factor2, 2.) * pow(tintingStrength2, 2.) * luminance2;

    float totalConcentration = concentration1 + concentration2;

    float ksMix = 0.;

    ksMix += KS(R1[i]) * concentration1;
    ksMix += KS(R2[i]) * concentration2;

    R[i] = KM(ksMix / totalConcentration);
  }

  return spectral_xyz_to_srgb(spectral_reflectance_to_xyz(R));
}

vec3 spectral_mix(vec3 color1, vec3 color2, float factor) {
  return spectral_mix(color1, 1., 1. - factor, color2, 1., factor);
}

vec3 spectral_mix(vec3 color1, float factor1, vec3 color2, float factor2) {
  return spectral_mix(color1, 1., factor1, color2, 1., factor2);
}

vec3 spectral_mix(vec3 color1, float tintingStrength1, float factor1, vec3 color2, float tintingStrength2, float factor2, vec3 color3, float tintingStrength3, float factor3) {
  vec3 lrgb1 = spectral_srgb_to_linear(color1);
  vec3 lrgb2 = spectral_srgb_to_linear(color2);
  vec3 lrgb3 = spectral_srgb_to_linear(color3);

  float R1[SPECTRAL_SIZE];
  float R2[SPECTRAL_SIZE];
  float R3[SPECTRAL_SIZE];

  spectral_linear_to_reflectance(lrgb1, R1);
  spectral_linear_to_reflectance(lrgb2, R2);
  spectral_linear_to_reflectance(lrgb3, R3);

  float luminance1 = spectral_reflectance_to_xyz(R1)[1];
  float luminance2 = spectral_reflectance_to_xyz(R2)[1];
  float luminance3 = spectral_reflectance_to_xyz(R3)[1];

  float R[SPECTRAL_SIZE];

  for (int i = 0; i < SPECTRAL_SIZE; i++) {
    float concentration1 = pow(factor1, 2.) * pow(tintingStrength1, 2.) * luminance1;
    float concentration2 = pow(factor2, 2.) * pow(tintingStrength2, 2.) * luminance2;
    float concentration3 = pow(factor3, 2.) * pow(tintingStrength3, 2.) * luminance3;

    float totalConcentration = concentration1 + concentration2 + concentration3;

    float ksMix = 0.;

    ksMix += KS(R1[i]) * concentration1;
    ksMix += KS(R2[i]) * concentration2;
    ksMix += KS(R3[i]) * concentration3;

    R[i] = KM(ksMix / totalConcentration);
  }

  return spectral_xyz_to_srgb(spectral_reflectance_to_xyz(R));
}

vec3 spectral_mix(vec3 color1, float factor1, vec3 color2, float factor2, vec3 color3, float factor3) {
  return spectral_mix(color1, 1., factor1, color2, 1., factor2, color3, 1., factor3);
}

vec3 spectral_mix(vec3 color1, float tintingStrength1, float factor1, vec3 color2, float tintingStrength2, float factor2, vec3 color3, float tintingStrength3, float factor3, vec3 color4, float tintingStrength4, float factor4) {
  vec3 lrgb1 = spectral_srgb_to_linear(color1);
  vec3 lrgb2 = spectral_srgb_to_linear(color2);
  vec3 lrgb3 = spectral_srgb_to_linear(color3);
  vec3 lrgb4 = spectral_srgb_to_linear(color4);

  float R1[SPECTRAL_SIZE];
  float R2[SPECTRAL_SIZE];
  float R3[SPECTRAL_SIZE];
  float R4[SPECTRAL_SIZE];

  spectral_linear_to_reflectance(lrgb1, R1);
  spectral_linear_to_reflectance(lrgb2, R2);
  spectral_linear_to_reflectance(lrgb3, R3);
  spectral_linear_to_reflectance(lrgb4, R4);

  float luminance1 = spectral_reflectance_to_xyz(R1)[1];
  float luminance2 = spectral_reflectance_to_xyz(R2)[1];
  float luminance3 = spectral_reflectance_to_xyz(R3)[1];
  float luminance4 = spectral_reflectance_to_xyz(R4)[1];

  float R[SPECTRAL_SIZE];

  for (int i = 0; i < SPECTRAL_SIZE; i++) {
    float concentration1 = pow(factor1, 2.) * pow(tintingStrength1, 2.) * luminance1;
    float concentration2 = pow(factor2, 2.) * pow(tintingStrength2, 2.) * luminance2;
    float concentration3 = pow(factor3, 2.) * pow(tintingStrength3, 2.) * luminance3;
    float concentration4 = pow(factor4, 2.) * pow(tintingStrength4, 2.) * luminance4;

    float totalConcentration = concentration1 + concentration2 + concentration3 + concentration4;

    float ksMix = 0.;

    ksMix += KS(R1[i]) * concentration1;
    ksMix += KS(R2[i]) * concentration2;
    ksMix += KS(R3[i]) * concentration3;
    ksMix += KS(R4[i]) * concentration4;

    R[i] = KM(ksMix / totalConcentration);
  }

  return spectral_xyz_to_srgb(spectral_reflectance_to_xyz(R));
}

vec3 spectral_mix(vec3 color1, float factor1, vec3 color2, float factor2, vec3 color3, float factor3, vec3 color4, float factor4) {
  return spectral_mix(color1, 1., factor1, color2, 1., factor2, color3, 1., factor3, color4, 1., factor4);
}

#endif
`;

// ---------------------------------------------------------------------------
// 5. Spectral composite fragment shader — body without version/precision
//    (version + precision + SPECTRAL_GLSL are prepended by buildSpectralCompositeSrc)
// ---------------------------------------------------------------------------

const SPECTRAL_COMPOSITE_FRAG_BODY = `
in vec2 v_texCoord;
uniform sampler2D u_existing;
uniform sampler2D u_newStroke;
out vec4 out_fragColor;

void main() {
  vec4 existing = texture(u_existing, v_texCoord);
  vec4 incoming = texture(u_newStroke, v_texCoord);
  if (incoming.a < 0.001) {
    out_fragColor = existing;
    return;
  }
  if (existing.a < 0.001) {
    out_fragColor = incoming;
    return;
  }
  float mixFactor = incoming.a / (existing.a + incoming.a + 0.001);
  vec3 mixed = spectral_mix(existing.rgb, incoming.rgb, mixFactor);
  float combinedAlpha = min(1.0, existing.a + incoming.a);
  out_fragColor = vec4(mixed, combinedAlpha);
}
`;

/**
 * Build the full spectral composite fragment shader source by concatenating
 * the version/precision header, the spectral.glsl library, and the composite
 * body. This avoids duplicating version/precision directives.
 */
export function buildSpectralCompositeSrc(): string {
  return '#version 300 es\nprecision highp float;\n'
    + SPECTRAL_GLSL + '\n'
    + SPECTRAL_COMPOSITE_FRAG_BODY;
}

// ---------------------------------------------------------------------------
// 6. Simplex 2D noise — ashima/webgl-noise (MIT license)
//    Source: https://github.com/ashima/webgl-noise
//    Self-contained snoise(vec2) returning float in [-1, 1]
// ---------------------------------------------------------------------------

export const SIMPLEX_NOISE_GLSL = `
//
// Description : Array and textureless GLSL 2D simplex noise function.
//      Author : Ian McEwan, Ashima Arts.
//  Maintainer : stegu
//     Lastmod : 20110822 (ijm)
//     License : Copyright (C) 2011 Ashima Arts. All rights reserved.
//               Distributed under the MIT License. See LICENSE file.
//               https://github.com/ashima/webgl-noise
//               https://github.com/stegu/webgl-noise
//

vec3 mod289(vec3 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec2 mod289(vec2 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec3 permute(vec3 x) {
  return mod289(((x * 34.0) + 10.0) * x);
}

float snoise(vec2 v) {
  const vec4 C = vec4( 0.211324865405187,  // (3.0-sqrt(3.0))/6.0
                       0.366025403784439,  // 0.5*(sqrt(3.0)-1.0)
                      -0.577350269189626,  // -1.0 + 2.0 * C.x
                       0.024390243902439); // 1.0 / 41.0
  // First corner
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v -   i + dot(i, C.xx);

  // Other corners
  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;

  // Permutations
  i = mod289(i); // Avoid truncation effects in permutation
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                          + i.x + vec3(0.0, i1.x, 1.0));

  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy),
                           dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;

  // Gradients: 41 points uniformly over a line, mapped onto a diamond.
  // The ring size 17*17 = 289 is close to a multiple of 41 (41*7 = 287)
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;

  // Normalise gradients implicitly by scaling m
  // Approximation of: m *= inversesqrt( a0*a0 + h*h );
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);

  // Compute final noise value at P
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}
`;

// ---------------------------------------------------------------------------
// 7. Grain post-effect fragment shader — paper texture (D-13, PAINT-10)
//    Simplex noise is prepended via buildGrainPostSrc()
// ---------------------------------------------------------------------------

const GRAIN_POST_FRAG_BODY = `
in vec2 v_texCoord;
uniform sampler2D u_input;
uniform float u_grain;       // 0-1 grain intensity
uniform vec2 u_resolution;
out vec4 out_fragColor;

void main() {
  vec4 color = texture(u_input, v_texCoord);
  if (color.a < 0.001) { out_fragColor = color; return; }
  vec2 noiseCoord = gl_FragCoord.xy;
  float noise = snoise(noiseCoord * 0.15) * 0.5
              + snoise(noiseCoord * 0.3) * 0.25
              + snoise(noiseCoord * 0.6) * 0.125;
  float grainMask = 1.0 - u_grain * noise * 0.3;
  out_fragColor = vec4(color.rgb * grainMask, color.a * grainMask);
}
`;

/**
 * Build the full grain post-effect fragment shader source by concatenating
 * the version/precision header, simplex noise library, and grain body.
 */
export function buildGrainPostSrc(): string {
  return '#version 300 es\nprecision highp float;\n'
    + SIMPLEX_NOISE_GLSL + '\n'
    + GRAIN_POST_FRAG_BODY;
}

// ---------------------------------------------------------------------------
// 8. Edge darkening post-effect fragment shader — ink pooling simulation
//    Self-contained (no noise dependency)
// ---------------------------------------------------------------------------

export const EDGE_DARKEN_POST_FRAG_SRC = `#version 300 es
precision highp float;
in vec2 v_texCoord;
uniform sampler2D u_input;
uniform float u_edgeDarken;  // 0-1 strength
out vec4 out_fragColor;
void main() {
  vec4 color = texture(u_input, v_texCoord);
  if (color.a < 0.001) { out_fragColor = color; return; }
  float darkenFactor = smoothstep(0.4, 0.9, color.a) * u_edgeDarken * 0.4;
  out_fragColor = vec4(color.rgb * (1.0 - darkenFactor), color.a);
}
`;

// ---------------------------------------------------------------------------
// 9. Bleed post-effect fragment shader — watercolor edge spread
//    Simplex noise is prepended via buildBleedPostSrc()
// ---------------------------------------------------------------------------

const BLEED_POST_FRAG_BODY = `
in vec2 v_texCoord;
uniform sampler2D u_input;
uniform float u_bleed;       // 0-1 bleed strength
uniform vec2 u_resolution;
out vec4 out_fragColor;

void main() {
  vec4 center = texture(u_input, v_texCoord);
  vec2 texel = 1.0 / u_resolution;
  float bleedRadius = u_bleed * 4.0;

  // Sample neighbors with noise-offset for organic edge
  float angle = snoise(gl_FragCoord.xy * 0.1) * 3.14159;
  vec2 offset = vec2(cos(angle), sin(angle)) * texel * bleedRadius;

  vec4 s1 = texture(u_input, v_texCoord + offset);
  vec4 s2 = texture(u_input, v_texCoord - offset);
  vec4 s3 = texture(u_input, v_texCoord + offset.yx * vec2(1.0, -1.0));
  vec4 s4 = texture(u_input, v_texCoord - offset.yx * vec2(1.0, -1.0));

  vec4 blurred = (center * 2.0 + s1 + s2 + s3 + s4) / 6.0;

  // Only bleed where there is paint (alpha > 0)
  float bleedMask = smoothstep(0.0, 0.1, max(center.a, max(max(s1.a, s2.a), max(s3.a, s4.a))));
  out_fragColor = mix(center, blurred, u_bleed * bleedMask * 0.6);
}
`;

/**
 * Build the full bleed post-effect fragment shader source by concatenating
 * the version/precision header, simplex noise library, and bleed body.
 */
export function buildBleedPostSrc(): string {
  return '#version 300 es\nprecision highp float;\n'
    + SIMPLEX_NOISE_GLSL + '\n'
    + BLEED_POST_FRAG_BODY;
}

// ---------------------------------------------------------------------------
// 10. Scatter offset fragment shader — charcoal scatter + grain
//     Simplex noise is prepended via buildScatterStampSrc()
// ---------------------------------------------------------------------------

const SCATTER_OFFSET_FRAG_BODY = `
in vec2 v_texCoord;
uniform vec4 u_color;
uniform float u_hardness;
uniform float u_scatter;     // 0-1 scatter amount
uniform float u_seed;        // per-stamp random seed
out vec4 out_fragColor;

void main() {
  vec2 uv = v_texCoord;
  // Scatter displacement via simplex noise
  float noiseX = snoise(gl_FragCoord.xy * 0.15 + u_seed) * u_scatter * 0.15;
  float noiseY = snoise(gl_FragCoord.xy * 0.15 + u_seed + 100.0) * u_scatter * 0.15;
  uv += vec2(noiseX, noiseY);

  float f = length(uv - 0.5) * 2.0;

  // Anti-aliased circle (matching stamp shader)
  float edgeWidth = mix(0.3, 0.02, u_hardness);
  f = 1.0 - smoothstep(1.0 - edgeWidth, 1.0, f);
  if (f < 0.01) discard;

  // Grain texture from simplex noise (charcoal-like)
  float grain = snoise(gl_FragCoord.xy * 0.3 + u_seed * 0.1) * 0.35 + 0.75;

  out_fragColor = vec4(u_color.rgb, u_color.a * f * grain);
}
`;

/**
 * Build the full scatter stamp fragment shader source by concatenating
 * the version/precision header, simplex noise library, and scatter body.
 */
export function buildScatterStampSrc(): string {
  return '#version 300 es\nprecision highp float;\n'
    + SIMPLEX_NOISE_GLSL + '\n'
    + SCATTER_OFFSET_FRAG_BODY;
}
