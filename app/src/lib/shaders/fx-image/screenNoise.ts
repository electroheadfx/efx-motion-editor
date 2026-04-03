import type { ShaderDefinition } from '../../shaderLibrary';

const SOURCE = `// CRT Screen Shader with Noise
// Pixelation, barrel distortion, chromatic aberration, noise, vignette

float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(hash12(i), hash12(i + vec2(1, 0)), f.x),
        mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), f.x), f.y);
}

vec2 distort(vec2 uv, float k, float amount) {
    uv -= vec2(0.5);
    float r = uv.x * uv.x + uv.y * uv.y;
    vec2 nuv = r * (1.0 + r * k) * uv;
    uv = mix(uv, nuv, amount);
    return uv + vec2(0.5);
}

float border(vec2 uv) {
    vec2 d = abs(uv - 0.5);
    float dist = max(d.x, d.y);
    return clamp((0.4124 - dist) * 80.0, 0.0, 1.0);
}

float vigniette(vec2 uv, float scale) {
    uv -= vec2(0.5);
    return 1.0 - scale * (uv.x * uv.x + uv.y * uv.y);
}

// Procedural CRT phosphor mask (replaces Buffer A texture)
vec3 crtMask(vec2 uv) {
    vec2 p = uv * iResolution.xy * 1.5;
    float cell = mod(floor(p.x), 3.0);
    // Subtle RGB phosphor stripes
    vec3 mask = vec3(0.4);
    if (cell < 0.5) mask.r = 0.7;
    else if (cell < 1.5) mask.g = 0.7;
    else mask.b = 0.7;
    // Add slight vertical variation
    mask *= 0.85 + 0.15 * noise(p * 0.5);
    return mask;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;

    // Pixelation
    vec2 res = vec2(640.0, 480.0) * u_pixelScale;
    vec2 scr = floor(uv * res) / res;

    float ca = u_chromatic;

    vec2 scrr = distort(scr, 0.5 - ca, u_distortion);
    vec2 scrg = distort(scr, 0.5,      u_distortion);
    vec2 scrb = distort(scr, 0.5 + ca, u_distortion);

    vec2 uvr = distort(uv, 0.5 - ca, u_distortion);
    vec2 uvg = distort(uv, 0.5,      u_distortion);
    vec2 uvb = distort(uv, 0.5 + ca, u_distortion);

    float time = sin(iTime * 22.5);

    vec3 col = vec3(
        texture(iChannel0, scrr).r + u_noiseAmount * noise((scrr + time) * vec2(160.0, 240.0)),
        texture(iChannel0, scrg).g + u_noiseAmount * noise((scrg + time) * vec2(162.0, 244.0)),
        texture(iChannel0, scrb).b + u_noiseAmount * noise((scrb + time) * vec2(164.0, 248.0))
    );

    // CRT phosphor mask
    vec3 mask = crtMask(uvg);
    col = col * mask * u_maskStrength + col * (1.0 - u_maskStrength * 0.3);

    col *= vigniette(uvg, u_vignette);
    col *= border(uvg);
    fragColor = vec4(col, 1.0);
}`;

export const screenNoise: ShaderDefinition = {
  id: 'screen-noise',
  name: 'CRT Screen',
  category: 'fx-image',
  description: 'Retro CRT look with pixelation, barrel distortion, chromatic aberration, and noise',
  author: 'Arrangemonk',
  url: 'https://www.shadertoy.com/view/ffSGWD',
  fragmentSource: SOURCE,
  defaultBlend: 'normal',
  params: [
    { key: 'noiseAmount', label: 'Noise', type: 'float', default: 0.3, min: 0, max: 1, step: 0.01 },
    { key: 'distortion', label: 'Distortion', type: 'float', default: 0.25, min: 0, max: 1, step: 0.01 },
    { key: 'chromatic', label: 'Chromatic', type: 'float', default: 0.4, min: 0, max: 1, step: 0.01 },
    { key: 'vignette', label: 'Vignette', type: 'float', default: 2.5, min: 0, max: 5, step: 0.1 },
    { key: 'pixelScale', label: 'Pixel Scale', type: 'float', default: 1.0, min: 0.2, max: 3, step: 0.1 },
    { key: 'maskStrength', label: 'CRT Mask', type: 'float', default: 0.5, min: 0, max: 1, step: 0.01 },
  ],
};
