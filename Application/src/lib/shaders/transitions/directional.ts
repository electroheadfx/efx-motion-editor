import type { ShaderDefinition } from '../../shaderLibrary';

const SOURCE = `// Author: Gaetan Renaudeau
// License: MIT
// https://gl-transitions.com/editor/Directional

vec4 transition(vec2 uv) {
  vec2 p = uv + progress * sign(direction);
  vec2 f = fract(p);
  return mix(
    getToColor(f),
    getFromColor(f),
    step(0.0, p.y) * step(p.y, 1.0) * step(0.0, p.x) * step(p.x, 1.0)
  );
}`;

export const directional: ShaderDefinition = {
  id: 'transition-directional',
  name: 'Directional',
  category: 'transition',
  description: 'Slide the scene in a configurable direction',
  author: 'Gaetan Renaudeau',
  license: 'MIT',
  url: 'https://gl-transitions.com/editor/Directional',
  fragmentSource: SOURCE,
  params: [
    { key: 'directionX', label: 'Dir X', type: 'float', default: 0.0, min: -1, max: 1, step: 0.1 },
    { key: 'directionY', label: 'Dir Y', type: 'float', default: 1.0, min: -1, max: 1, step: 0.1 },
  ],
};
