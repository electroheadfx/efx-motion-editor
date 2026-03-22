import type { ShaderDefinition } from '../../shaderLibrary';

const SOURCE = `// 1920s film look
// Features: grain, flicker, vertical scratches, dust, gate weave, vignette, sepia

float hash11(float p) {
    p = fract(p * 0.1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
}

float hash21(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

float noise21(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

float filmGrain(vec2 uv, float t) {
    float g1 = noise21(uv * vec2(420.0, 320.0) + t * 19.0);
    float g2 = noise21(uv * vec2(820.0, 610.0) - t * 27.0);
    float g3 = hash21(floor(uv * iResolution.xy) + floor(t * 24.0));
    return (g1 * 0.5 + g2 * 0.35 + g3 * 0.15) - 0.5;
}

float scratches(vec2 uv, float t) {
    float s = 0.0;
    float ft = floor(t * 24.0);
    for (int i = 0; i < 7; i++) {
        float id = float(i);
        float x = hash11(id * 13.17 + floor(t * 0.7 + id * 3.1));
        float width = mix(0.0006, 0.0035, hash11(id * 9.73 + ft));
        float strength = mix(0.15, 0.85, hash11(id * 2.91 + ft * 0.13));
        x += sin(t * (0.7 + id * 0.21) + id * 4.1) * 0.01;
        float line = smoothstep(width * 2.5, width, abs(uv.x - x));
        float breakup = noise21(vec2(id * 7.1, uv.y * 22.0 + t * (4.0 + id)));
        breakup *= noise21(vec2(id * 11.7, uv.y * 70.0 - t * 2.0));
        s += line * breakup * strength;
    }
    return clamp(s, 0.0, 1.0);
}

float dust(vec2 uv, float t) {
    float d = 0.0;
    float frame = floor(t * 18.0);
    vec2 grid = floor(uv * vec2(18.0, 12.0));
    float r = hash21(grid + frame * 0.37);
    if (r > 0.985) {
        vec2 cell = fract(uv * vec2(18.0, 12.0)) - 0.5;
        float rad = mix(0.04, 0.2, hash21(grid + 7.7 + frame));
        d = 1.0 - smoothstep(rad, rad + 0.03, length(cell));
    }
    return d;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    float t = iTime;

    // Gate weave
    float frameRnd = hash11(floor(t * 24.0));
    vec2 weave;
    weave.x = sin(t * 1.7) * 0.0018 + (frameRnd - 0.5) * 0.003;
    weave.y = cos(t * 1.3) * 0.0012;
    float jitterBand = smoothstep(0.15, 0.85, noise21(vec2(0.0, uv.y * 5.0 + floor(t * 12.0))));
    float jitter = (hash11(floor(t * 12.0)) - 0.5) * 0.004 * jitterBand;
    vec2 sampleUV = uv + weave * u_weaveAmount + vec2(jitter * u_weaveAmount, 0.0);

    vec3 src = texture(iChannel0, sampleUV).rgb;

    // Monochrome with sepia tint
    float luma = dot(src, vec3(0.299, 0.587, 0.114));
    vec3 sepia = luma * vec3(1.06, 1.0, 0.86);
    vec3 col = mix(src, sepia, u_sepiaAmount);

    // Exposure flicker
    float flicker = 1.0 - u_flickerAmount + u_flickerAmount * 2.0 * hash11(floor(t * 18.0) + 5.3);
    col *= flicker;

    // Film grain
    float g = filmGrain(uv, t);
    col += g * u_grainAmount;

    // Vertical scratches
    float scr = scratches(uv, t);
    col += scr * vec3(u_scratchAmount);

    // Dust and dirt
    float dirt = dust(uv, t);
    col = mix(col, col * 0.35, dirt * 0.8 * u_dustAmount);

    // Blotchiness
    float blotch = noise21(uv * vec2(3.0, 2.0) + vec2(t * 0.08, -t * 0.05));
    col *= 0.92 + blotch * 0.16;

    // Scanlines
    float scan = sin((uv.y + t * 0.12) * iResolution.y * 1.1) * 0.02;
    col += scan;

    // Vignette
    vec2 p = uv * 2.0 - 1.0;
    float vig = 1.0 - dot(p, p) * u_vignetteAmount;
    col *= clamp(vig, 0.0, 1.0);

    // Crushed blacks / lifted whites
    col = smoothstep(0.03, 0.98, col);

    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

export const superFilmGrain: ShaderDefinition = {
  id: 'super-film-grain',
  name: 'Super Film Grain',
  category: 'fx-image',
  description: '1920s film look with grain, scratches, dust, flicker, and vignette',
  author: 'DanielArm',
  url: 'https://www.shadertoy.com/view/NcjGDw',
  fragmentSource: SOURCE,
  defaultBlend: 'normal',
  params: [
    { key: 'grainAmount', label: 'Grain', type: 'float', default: 0.18, min: 0, max: 0.5, step: 0.01 },
    { key: 'scratchAmount', label: 'Scratches', type: 'float', default: 0.55, min: 0, max: 1, step: 0.01 },
    { key: 'dustAmount', label: 'Dust', type: 'float', default: 1.0, min: 0, max: 1, step: 0.01 },
    { key: 'flickerAmount', label: 'Flicker', type: 'float', default: 0.09, min: 0, max: 0.3, step: 0.01 },
    { key: 'vignetteAmount', label: 'Vignette', type: 'float', default: 0.35, min: 0, max: 0.7, step: 0.01 },
    { key: 'sepiaAmount', label: 'Sepia', type: 'float', default: 1.0, min: 0, max: 1, step: 0.01 },
    { key: 'weaveAmount', label: 'Gate Weave', type: 'float', default: 1.0, min: 0, max: 2, step: 0.1 },
  ],
};
