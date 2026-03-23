import type { ShaderDefinition } from '../../shaderLibrary';

const SOURCE = `// Author: gre (Gaetan Renaudeau)
// License: MIT
// https://gl-transitions.com/editor/WindowSlice

vec4 transition (vec2 uv) {
  float t = progress;
  float count = u_count;
  float smoothn = u_smoothness;

  float pr = smoothstep(-smoothn, 0.0, uv.x - t * (1.0 + smoothn));
  float s = step(pr, fract(count * uv.x));

  return mix(getFromColor(uv), getToColor(uv), s);
}`;

export const windowSlice: ShaderDefinition = {
  id: 'transition-window-slice',
  name: 'Window Slice',
  category: 'transition',
  description: 'Venetian blinds slice transition',
  author: 'gre',
  license: 'MIT',
  url: 'https://gl-transitions.com/editor/WindowSlice',
  fragmentSource: SOURCE,
  params: [
    { key: 'count', label: 'Count', type: 'float', default: 10.0, min: 1, max: 50, step: 1 },
    { key: 'smoothness', label: 'Smooth', type: 'float', default: 0.5, min: 0, max: 1, step: 0.01 },
  ],
};
