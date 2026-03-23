import type { ShaderDefinition } from '../../shaderLibrary';

const SOURCE = `// Author: gre (Gaetan Renaudeau)
// License: MIT
// https://gl-transitions.com/editor/fadegrayscale

vec4 transition (vec2 uv) {
  vec4 fc = getFromColor(uv);
  vec4 tc = getToColor(uv);
  float gray = dot(fc.rgb, vec3(0.299, 0.587, 0.114));
  return mix(
    mix(vec4(vec3(gray) * (1.0 + u_intensity * 2.0), 1.0), tc, smoothstep(0.5, 1.0, progress)),
    mix(fc, vec4(vec3(gray) * (1.0 + u_intensity * 2.0), 1.0), smoothstep(0.0, 0.5, progress)),
    step(progress, 0.5)
  );
}`;

export const fadegrayscale: ShaderDefinition = {
  id: 'transition-fade-grayscale',
  name: 'Fade Grayscale',
  category: 'transition',
  description: 'Dissolve through grayscale intermediate',
  author: 'gre',
  license: 'MIT',
  url: 'https://gl-transitions.com/editor/fadegrayscale',
  fragmentSource: SOURCE,
  params: [
    { key: 'intensity', label: 'Intens', type: 'float', default: 0.3, min: 0, max: 1, step: 0.01 },
  ],
};
