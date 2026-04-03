import type { ShaderDefinition } from '../../shaderLibrary';

const SOURCE = `// Zippy Zaps — electric fractal lightning

void mainImage(out vec4 o, vec2 u) {
    vec2 v = iResolution.xy;
    u = 0.2 * u_zoom * (u + u - v) / v.y;

    vec4 z = o = vec4(1, 2, 3, 0);

    for (float a = 0.5, t = iTime * u_speed, i;
         ++i < 19.;
         o += (1.0 + cos(z + t))
            / length((1.0 + i * dot(v, v))
                   * sin(1.5 * u / (0.5 - dot(u, u)) - 9.0 * u.yx + t))
         )
        v = cos(++t - 7.0 * u * pow(a += 0.03, i)) - 5.0 * u,
        u += tanh(40.0 * dot(u *= mat2(cos(i + 0.02 * t - z.wxzw * 11.0)), u)
                      * cos(1e2 * u.yx + t)) / 2e2
           + 0.2 * a * u
           + cos(4.0 / exp(dot(o, o) / 1e2) + t) / 3e2;

    o = u_brightness * 25.6 / (min(o, 13.0) + 164.0 / o)
      - dot(u, u) / 250.0;
}`;

export const zippyZaps: ShaderDefinition = {
  id: 'zippy-zaps',
  name: 'Zippy Zaps',
  category: 'generator',
  description: 'Electric fractal lightning with vibrant color cycling',
  author: 'SnoopethDuckDuck',
  url: 'https://www.shadertoy.com/view/XXyGzh',
  fragmentSource: SOURCE,
  defaultBlend: 'normal',
  params: [
    { key: 'speed', label: 'Speed', type: 'float', default: 1.0, min: 0, max: 3, step: 0.05 },
    { key: 'zoom', label: 'Zoom', type: 'float', default: 1.0, min: 0.3, max: 3, step: 0.05 },
    { key: 'brightness', label: 'Brightness', type: 'float', default: 1.0, min: 0.2, max: 3, step: 0.05 },
  ],
};
