import type { ShaderDefinition } from '../../shaderLibrary';

const SOURCE = `// Ocean Water — realistic waves with caustics, subsurface scattering, ground
// Simplified from multi-pass Shadertoy original

const float PI = 3.1415927;
const int STEPS = 150;
const int STEPS_GROUND = 40;
const int numWaves = 40;
const float waveBaseHeight = 0.5;
const float waveMaxAmplitude = 0.35;
const vec3 ld = normalize(vec3(-1, -1, -2));

float saturate2(float v) { return clamp(v, 0., 1.); }

uint murmurHash11(uint src) {
    const uint M = 0x5bd1e995u;
    uint h = 1190494759u;
    src *= M; src ^= src >> 24u; src *= M;
    h *= M; h ^= src;
    h ^= h >> 13u; h *= M; h ^= h >> 15u;
    return h;
}
float hash11(float src) {
    uint h = murmurHash11(floatBitsToUint(src));
    return uintBitsToFloat(h & 0x007fffffu | 0x3f800000u) - 1.0;
}

float SingleWaveHeight(vec2 uv, vec2 dir, float speed, float ampl, float time) {
    float d = dot(uv, dir);
    float ph = d * 10.0 + time * speed;
    float h = (sin(ph) * 0.5 + 0.5);
    h = pow(h, 2.0);
    h = h * 2.0 - 1.0;
    return h * ampl;
}

float WaveHeight(vec2 uv, float time, int num) {
    uv *= 1.6;
    float h = 0.0, w = 1.0, tw = 0.0, s = 1.0;
    for (int i = 0; i < num; i++) {
        float rand = hash11(float(i)) * 2.0 - 1.0;
        float ph = 0.2 + rand * 0.75 * PI;
        vec2 dir = vec2(sin(ph), cos(ph));
        h += SingleWaveHeight(uv, dir, 1.0 + s * 0.05, w, time);
        tw += w;
        const float sc = 1.0812;
        w /= sc; uv *= sc; s *= sc;
    }
    h /= tw;
    return waveBaseHeight + waveMaxAmplitude * h;
}

float WaterHeight(vec3 p, int wc, float time) {
    return WaveHeight(p.xz * 0.1, time, wc) + u_oceanHeight;
}

float GroundHeight(vec3 p) {
    float h = 0.0, tw = 0.0, w = 1.0;
    p *= 0.2; p.xz += vec2(-1.25, 0.35);
    for (int i = 0; i < 2; i++) {
        h += w * sin(p.x) * sin(p.z);
        tw += w; p *= 1.173; p.xz += vec2(2.373, 0.977); w /= 1.173;
    }
    return -0.2 + 1.65 * h / tw;
}

int material;
float map2(vec3 p, bool includeWater, float time) {
    float dGround = (p.y - GroundHeight(p)) * 0.9;
    float d = dGround; material = 1;
    if (includeWater) {
        float dOcean = (p.y - WaterHeight(p, numWaves, time)) * 0.75;
        if (dOcean < d) { material = 0; d = dOcean; }
    }
    return d;
}

float RM2(vec3 ro, vec3 rd, float time) {
    float t = 0.0, s = 1.0;
    for (int i = 0; i < STEPS; i++) {
        float d = map2(ro + t * rd, true, time);
        if (d < 0.001) return t;
        t += d * s; s *= 1.02;
    }
    return -t;
}

vec3 Normal2(vec3 p, float time) {
    const float h = 0.001;
    const vec2 k = vec2(1, -1);
    return normalize(
        k.xyy * map2(p + k.xyy * h, true, time) +
        k.yyx * map2(p + k.yyx * h, true, time) +
        k.yxy * map2(p + k.yxy * h, true, time) +
        k.xxx * map2(p + k.xxx * h, true, time));
}

vec3 Render2(float t, vec3 ro, vec3 rd, float time) {
    vec3 waterCol = vec3(u_waterR, u_waterG, u_waterB);
    if (t < 0.0) {
        vec3 col = vec3(0.35, 0.62, 0.9);
        col = mix(col, vec3(1.0), max(0.0, (1.0 - rd.y) * 0.3));
        float sunDot = pow(max(0.0, dot(rd, -ld)), 6.0);
        col += tanh(sunDot) * vec3(1, 0.8, 0.7);
        return col;
    }
    vec3 p = ro + t * rd;
    vec3 col = vec3(0.9, 0.85, 0.7);
    if (material == 0) {
        vec3 nor = Normal2(p, time);
        float nearShore = 1.0 - smoothstep(0.5, -0.2, GroundHeight(p) - u_oceanHeight);
        nor = normalize(mix(nor, vec3(0, 1, 0), nearShore * 0.9));
        vec3 refl = reflect(rd, nor);
        float fresnel = pow(1.0 - abs(dot(nor, rd)), 6.0);
        float spec = pow(max(0.0, dot(refl, -ld)), 256.0);
        float subsurf = pow(max(0.0, dot(rd, ld * vec3(1, -1, 1))), 2.0) * (1.0 - fresnel) * 0.5;
        vec3 skyRefl = vec3(0.35, 0.62, 0.9) * 0.4;
        col = waterCol * 0.3 + spec * vec3(1) + fresnel * skyRefl + subsurf * waterCol * vec3(1.3, 1.5, 1.1);
    } else {
        float wetness = 1.0 - smoothstep(0.05, 0.2, p.y - WaterHeight(p, numWaves, time) + 0.1);
        col = mix(col, col * 0.8, wetness);
        vec3 nor = Normal2(p, time);
        float fresnel = pow(1.0 - abs(dot(nor, rd)), 6.0);
        col += wetness * fresnel * vec3(0.35, 0.62, 0.9) * 0.3;
    }
    return col;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (2.0 * fragCoord - iResolution.xy) / iResolution.y;
    float time = iTime * u_speed;
    float rotPh = u_rotation + time * 0.05;
    float camY = u_camHeight;
    float rad = 1.6;
    vec3 ro = vec3(sin(rotPh), camY, cos(rotPh)) * rad;
    vec3 cf = normalize(-ro);
    vec3 cr = normalize(cross(cf, vec3(0, 1, 0)));
    vec3 cu = normalize(cross(cr, cf));
    vec3 rd = normalize(uv.x * cr + uv.y * cu + cf);
    float d = RM2(ro, rd, time);
    vec3 col = Render2(d, ro, rd, time);
    col = pow(col, vec3(1.0 / 2.2));
    fragColor = vec4(col, 1.0);
}`;

export const oceanWater: ShaderDefinition = {
  id: 'ocean-water',
  name: 'Ocean Water',
  category: 'generator',
  description: 'Realistic ocean with multi-wave simulation, ground, and subsurface scattering',
  author: 'foodi',
  url: 'https://www.shadertoy.com/view/w3KyW1',
  fragmentSource: SOURCE,
  defaultBlend: 'normal',
  params: [
    { key: 'speed', label: 'Speed', type: 'float', default: 1.0, min: 0, max: 3, step: 0.05 },
    { key: 'oceanHeight', label: 'Ocean Height', type: 'float', default: 0.2, min: -0.5, max: 1, step: 0.05 },
    { key: 'camHeight', label: 'Cam Height', type: 'float', default: 1.3, min: 0.5, max: 6, step: 0.1 },
    { key: 'rotation', label: 'Rotation', type: 'float', default: 2.5, min: 0, max: 6.28, step: 0.05 },
    { key: 'waterR', label: 'Water', type: 'float', default: 0.15, min: 0, max: 1, step: 0.01, colorGroup: 'water' },
    { key: 'waterG', label: 'Water', type: 'float', default: 0.5, min: 0, max: 1, step: 0.01, colorGroup: 'water', hidden: true },
    { key: 'waterB', label: 'Water', type: 'float', default: 0.75, min: 0, max: 1, step: 0.01, colorGroup: 'water', hidden: true },
  ],
};
