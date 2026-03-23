import type { ShaderDefinition } from '../../shaderLibrary';

const SOURCE = `// Author: Eke Marien
// License: MIT
// https://gl-transitions.com/editor/crosswarp

vec4 transition(vec2 uv) {
  float x = smoothstep(0.0, 1.0, progress * 2.0 + uv.x - 1.0);
  return mix(
    getFromColor((uv - 0.5) * (1.0 - x) + 0.5),
    getToColor((uv - 0.5) * x + 0.5),
    x
  );
}`;

export const crosswarp: ShaderDefinition = {
  id: 'transition-crosswarp',
  name: 'Cross Warp',
  category: 'transition',
  description: 'Warped cross-dissolve transition',
  author: 'Eke Marien',
  license: 'MIT',
  url: 'https://gl-transitions.com/editor/crosswarp',
  fragmentSource: SOURCE,
  params: [],
};
