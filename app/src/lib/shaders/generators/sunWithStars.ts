import type { ShaderDefinition } from '../../shaderLibrary';

const SOURCE = `// Sun with Stars — volumetric sun, clouds, fractal nebula, and layered star field

#define NUM_LAYERS 12.
#define TAU 6.28318

float Star(vec2 uv, float flare) {
    float d = length(uv);
    float m = sin(0.025 * 1.2) / d;
    float rays = max(0., .5 - abs(uv.x * uv.y * 1000.));
    m += (rays * flare) * 2.;
    m *= smoothstep(1., .1, d);
    return m;
}

float Hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

vec3 StarLayer(vec2 uv, float time) {
    vec3 col = vec3(0);
    vec2 gv = fract(uv);
    vec2 id = floor(uv);
    for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
            vec2 offs = vec2(x, y);
            float n = Hash21(id + offs);
            float size = fract(n);
            float star = Star(gv - offs - vec2(n, fract(n * 34.)) + .5, smoothstep(.1, .9, size) * .46);
            vec3 color = sin(vec3(.2, .3, .9) * fract(n * 2345.2) * TAU) * .25 + .75;
            color = color * vec3(.9, .59, .9 + size);
            star *= sin(time * .6 + n * TAU) * .5 + .5;
            col += star * size * color;
        }
    }
    return col;
}

void mainImage(out vec4 o, vec2 u) {
    float t = iTime * u_speed;
    vec3 r = iResolution;
    vec2 F = u;

    vec2 uv = (u - .5 * r.xy) / r.y;

    // Star layers
    vec3 starCol = vec3(0);
    for (float si = 0.; si < 1.; si += 1. / NUM_LAYERS) {
        float depth = fract(si);
        float scale = mix(20., .5, depth);
        float fade = depth * smoothstep(1., .9, depth);
        starCol += StarLayer(uv * scale + si * 453.2 - t * .05, t) * fade;
    }

    // Sun / clouds
    u = (u + u - r.xy) / r.y;
    vec3 p = vec3(0.);
    float s = 0.;
    o = vec4(0.);
    for (float ci = 0.; ci < 100.; ci += 1.) {
        p += vec3(u * s, s);
        s = 6. + p.y;
        s -= abs(dot(sin(t + .1 * p.z + .3 * p / .08), vec3(.16)));
        s -= abs(dot(sin(t + .1 * p.z + .3 * p / .2), vec3(.4)));
        s -= abs(dot(sin(t + .1 * p.z + .3 * p / .6), vec3(1.2)));
        s = .1 + abs(s) * .2;
        o += vec4(u_sunR, u_sunG, u_sunB, 0) / s;
    }
    o *= smoothstep(0.8, 0.75, abs(u.y));

    // Fractal nebula
    vec4 o2 = vec4(0.);
    float nebT = -t * .005;
    for (float fi = 0.; fi > -1.; fi -= .06) {
        float d = fract(fi - 3. * nebT);
        vec4 c = vec4((F - r.xy * .5) / r.y * d, fi, 0) * 28.;
        for (int j = 0; j < 27; j++)
            c.xzyw = abs(c / dot(c, c) - vec4(7. - .2 * sin(nebT), 6.3, .7, 1. - cos(nebT / .8)) / 7.);
        float d2 = d - 1.;
        o2 -= c * c.yzww * d2 * d2 / vec4(3, 5, 1, 1);
    }
    o += o2;

    o = tanh(o / 2e3 / length(u) * u_brightness);

    float starMask = smoothstep(-0.4, 0.1, u.y);
    o.rgb += starCol * starMask * max(o2.xyz, vec3(0.)) * 12. * u_starIntensity;
}`;

export const sunWithStars: ShaderDefinition = {
  id: 'sun-with-stars',
  name: 'Sun with Stars',
  category: 'generator',
  description: 'Volumetric sun with cloud layers, fractal nebula, and twinkling star field',
  author: 'nayk',
  url: 'https://www.shadertoy.com/view/tXKfz1',
  fragmentSource: SOURCE,
  defaultBlend: 'normal',
  params: [
    { key: 'speed', label: 'Speed', type: 'float', default: 1.0, min: 0, max: 3, step: 0.05 },
    { key: 'brightness', label: 'Brightness', type: 'float', default: 1.0, min: 0.2, max: 3, step: 0.05 },
    { key: 'starIntensity', label: 'Stars', type: 'float', default: 1.0, min: 0, max: 3, step: 0.05 },
    { key: 'sunR', label: 'Sun Color', type: 'float', default: 4.0, min: 0, max: 8, step: 0.1, colorGroup: 'sun' },
    { key: 'sunG', label: 'Sun Color', type: 'float', default: 2.0, min: 0, max: 8, step: 0.1, colorGroup: 'sun', hidden: true },
    { key: 'sunB', label: 'Sun Color', type: 'float', default: 1.0, min: 0, max: 8, step: 0.1, colorGroup: 'sun', hidden: true },
  ],
};
