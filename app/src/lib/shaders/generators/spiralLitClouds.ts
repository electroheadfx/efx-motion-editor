import type { ShaderDefinition } from '../../shaderLibrary';

const SOURCE = `// Spiral Lit Clouds — code golf masterpiece
// Volumetric raymarched clouds through a twisting tunnel

void mainImage(out vec4 o, vec2 u) {
    float a, e, i, s, d, t = iTime * u_speed;
    vec3 p = iResolution;

    u = (u + u - p.xy) / p.y;
    u *= u_zoom;
    u += cos(t * vec2(0.4, 0.3)) * 0.3;

    vec3 D = normalize(vec3(u, 1));
    for (o *= i; i++ < 1e2 && d < 1.5e2;
        d += s = min(0.15 + 0.12 * abs(s), e = max(0.8 * e, 0.001)),
        o += u_brightness * vec4(u_colorR, u_colorG, u_colorB, 0) / e + 1.0 / s
    )
        for (
            p = D * d,
            p.z += t * 4.0,
            e = length(p.xy - sin(p.z / 12.0 + vec2(0, 1.57)) * 12.0) - 0.4,
            p.xy *= mat2(cos(p.z / 7e1 + vec4(0, 33, 11, 0))),
            s = 32.0 - abs(p.y),
            a = 0.01; a < 4.0; a *= 3.0
        )
            p *= 0.8,
            s -= abs(dot(sin(0.3 * p.z + 0.2 * t + p / a), vec3(a + a))) * u_density;

    o = tanh(o * o / length(u) / 4e5 + 0.1 * dot(u, u));
}`;

export const spiralLitClouds: ShaderDefinition = {
  id: 'spiral-lit-clouds',
  name: 'Spiral Lit Clouds',
  category: 'generator',
  description: 'Volumetric raymarched clouds through a twisting luminous tunnel',
  url: 'https://www.shadertoy.com/view/Nfl3zX',
  fragmentSource: SOURCE,
  defaultBlend: 'normal',
  params: [
    { key: 'speed', label: 'Speed', type: 'float', default: 1.0, min: 0, max: 3, step: 0.05 },
    { key: 'zoom', label: 'Zoom', type: 'float', default: 1.0, min: 0.3, max: 3, step: 0.05 },
    { key: 'brightness', label: 'Brightness', type: 'float', default: 10.0, min: 1, max: 30, step: 0.5 },
    { key: 'density', label: 'Density', type: 'float', default: 1.0, min: 0.2, max: 3, step: 0.05 },
    { key: 'colorR', label: 'Color R', type: 'float', default: 6.0, min: 0, max: 10, step: 0.1, colorGroup: 'color' },
    { key: 'colorG', label: 'Color', type: 'float', default: 2.0, min: 0, max: 10, step: 0.1, colorGroup: 'color', hidden: true },
    { key: 'colorB', label: 'Color', type: 'float', default: 1.0, min: 0, max: 10, step: 0.1, colorGroup: 'color', hidden: true },
  ],
};
