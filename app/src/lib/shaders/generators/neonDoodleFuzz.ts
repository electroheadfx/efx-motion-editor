import type { ShaderDefinition } from '../../shaderLibrary';

const SOURCE = `// Neon Doodle Fuzz — neon tube raymarcher with fuzzy glow

void mainImage(out vec4 o, vec2 u) {
    vec3 q, p = iResolution;
    float i, s, e, a, b,
          d = 0.125,
          t = iTime * u_speed;

    u = (u + u - p.xy) / p.y;
    if (abs(u.y) > 0.8) { o = vec4(0); return; }

    vec3 D = normalize(vec3(u * u_zoom, 1));
    for (o *= i; i++ < 64.; ) {
        q = p = D * d;
        p.z += t * 4.0,
        e = min(a = 0.03 + abs(length(p.xy - sin(cos(p.z) / 3.0 + vec2(0, 1.57)) * 3.0) - 0.1),
                b = 0.03 + abs(length(p.xy + sin(cos(p.z) / 4.0 + vec2(0, 1.57)) * 4.0) - 0.1)),
        p.xy *= mat2(cos(0.1 * p.z + 0.1 * t + vec4(0, 33, 11, 0)));

        q.xz = cos(q.xz);
        p.z = cos(p.z);
        for (s = 1.; s++ < 4.;
            q += sin(0.6 * t + p.zxy),
            p += sin(t + t + p.yzx * s) * 0.4);

        d += s = min(0.5 * e,
            0.1 + abs(min(length(p + 3.0 * sin(p.z * 0.5)) - 3.0, length(q - 2.0 * sin(p.z * 0.4)) - 4.0)) * 0.2);

        o += u_glowA * vec4(u_colorAR, u_colorAG, u_colorAB, 0) / a
           + u_glowB * vec4(u_colorBR, u_colorBG, u_colorBB, 0) / b
           + 1.0 / s + 0.5 * vec4(3, 1, 3, 0) / length(u);
    }

    o = tanh(o * o / 1e7 * u_brightness + dot(u, u) * 0.1);
}`;

export const neonDoodleFuzz: ShaderDefinition = {
  id: 'neon-doodle-fuzz',
  name: 'Neon Doodle Fuzz',
  category: 'generator',
  description: 'Twin neon tubes weaving through space with fuzzy volumetric glow',
  author: 'diatribes',
  url: 'https://www.shadertoy.com/view/WfccRN',
  fragmentSource: SOURCE,
  defaultBlend: 'normal',
  params: [
    { key: 'speed', label: 'Speed', type: 'float', default: 1.0, min: 0, max: 3, step: 0.05 },
    { key: 'zoom', label: 'Zoom', type: 'float', default: 1.0, min: 0.3, max: 3, step: 0.05 },
    { key: 'brightness', label: 'Brightness', type: 'float', default: 1.0, min: 0.2, max: 5, step: 0.1 },
    { key: 'glowA', label: 'Glow A', type: 'float', default: 20.0, min: 0, max: 50, step: 1 },
    { key: 'glowB', label: 'Glow B', type: 'float', default: 20.0, min: 0, max: 50, step: 1 },
    { key: 'colorAR', label: 'Color A', type: 'float', default: 6.0, min: 0, max: 10, step: 0.1, colorGroup: 'colorA' },
    { key: 'colorAG', label: 'Color A', type: 'float', default: 2.0, min: 0, max: 10, step: 0.1, colorGroup: 'colorA', hidden: true },
    { key: 'colorAB', label: 'Color A', type: 'float', default: 1.0, min: 0, max: 10, step: 0.1, colorGroup: 'colorA', hidden: true },
    { key: 'colorBR', label: 'Color B', type: 'float', default: 1.0, min: 0, max: 10, step: 0.1, colorGroup: 'colorB' },
    { key: 'colorBG', label: 'Color B', type: 'float', default: 2.0, min: 0, max: 10, step: 0.1, colorGroup: 'colorB', hidden: true },
    { key: 'colorBB', label: 'Color B', type: 'float', default: 6.0, min: 0, max: 10, step: 0.1, colorGroup: 'colorB', hidden: true },
  ],
};
