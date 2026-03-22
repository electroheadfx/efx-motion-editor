import type { ShaderDefinition } from '../../shaderLibrary';

const SOURCE = `// Indefinite — abstract fractal cloud tunnel

void mainImage(out vec4 o, vec2 u) {
    float i, a, d, s, t = iTime * u_speed * 0.3;
    vec3 p = iResolution;
    u = (u + u - p.xy) / p.y;
    u *= u_zoom;
    if (abs(u.y) > 0.8) { o *= i; return; }
    for (o *= i; i++ < 128.; ) {
        p = vec3(u * d, d + t / 0.1);
        s = 8.0 + p.y + p.x;
        for (a = 0.01; a < 1.0; a += a)
            p += cos(t - p.yzx) * 0.2,
            s -= abs(dot(sin(t + t - 0.2 * p.z + 0.3 * p / a), vec3(a + a))) * u_density;
        d += s = 0.1 + abs(s) * 0.1;
        o += u_brightness * vec4(u_colorR, u_colorG, u_colorB, 0) / s + 0.1 * vec4(u_colorR, u_colorG, u_colorB, 0) / abs(u.y + u.x);
    }
    o = tanh(o / 1e3 / length(u -= vec2(0.5, 0.3)) + 0.1 * dot(u, u));
}`;

export const indefinite: ShaderDefinition = {
  id: 'indefinite',
  name: 'Indefinite',
  category: 'generator',
  description: 'Abstract fractal cloud tunnel with warm volumetric glow',
  author: 'diatribes',
  url: 'https://www.shadertoy.com/view/wfGSWW',
  fragmentSource: SOURCE,
  defaultBlend: 'normal',
  params: [
    { key: 'speed', label: 'Speed', type: 'float', default: 1.0, min: 0, max: 3, step: 0.05 },
    { key: 'zoom', label: 'Zoom', type: 'float', default: 1.0, min: 0.3, max: 3, step: 0.05 },
    { key: 'brightness', label: 'Brightness', type: 'float', default: 1.0, min: 0.1, max: 5, step: 0.1 },
    { key: 'density', label: 'Density', type: 'float', default: 1.0, min: 0.2, max: 3, step: 0.05 },
    { key: 'colorR', label: 'Color', type: 'float', default: 4.0, min: 0, max: 10, step: 0.1, colorGroup: 'color' },
    { key: 'colorG', label: 'Color', type: 'float', default: 2.0, min: 0, max: 10, step: 0.1, colorGroup: 'color', hidden: true },
    { key: 'colorB', label: 'Color', type: 'float', default: 1.0, min: 0, max: 10, step: 0.1, colorGroup: 'color', hidden: true },
  ],
};
