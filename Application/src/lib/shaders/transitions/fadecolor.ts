import type { ShaderDefinition } from '../../shaderLibrary';

const SOURCE = `// Author: gre (Gaetan Renaudeau)
// License: MIT
// https://gl-transitions.com/editor/fadecolor

vec4 transition (vec2 uv) {
  vec3 color = vec3(u_colorR, u_colorG, u_colorB);
  return mix(
    mix(vec4(color, 1.0), getToColor(uv), smoothstep(1.0 - u_colorPhase, 1.0, progress)),
    mix(getFromColor(uv), vec4(color, 1.0), smoothstep(0.0, u_colorPhase, progress)),
    step(progress, 0.5)
  );
}`;

export const fadecolor: ShaderDefinition = {
  id: 'transition-fade-color',
  name: 'Fade Color',
  category: 'transition',
  description: 'Dissolve through a solid color',
  author: 'gre',
  license: 'MIT',
  url: 'https://gl-transitions.com/editor/fadecolor',
  fragmentSource: SOURCE,
  params: [
    { key: 'colorR', label: 'Color', type: 'float', default: 0.0, min: 0, max: 1, step: 0.01, colorGroup: 'color' },
    { key: 'colorG', label: 'Color', type: 'float', default: 0.0, min: 0, max: 1, step: 0.01, colorGroup: 'color', hidden: true },
    { key: 'colorB', label: 'Color', type: 'float', default: 0.0, min: 0, max: 1, step: 0.01, colorGroup: 'color', hidden: true },
    { key: 'colorPhase', label: 'Phase', type: 'float', default: 0.4, min: 0, max: 1, step: 0.01 },
  ],
};
