import type { ShaderDefinition } from '../../shaderLibrary';

const SOURCE = `// Author: Gaetan Renaudeau
// License: MIT
// https://gl-transitions.com/editor/directionalwipe

const vec2 center = vec2(0.5, 0.5);

vec4 transition (vec2 uv) {
  vec2 v = normalize(direction);
  v /= abs(v.x) + abs(v.y);
  float d = v.x * center.x + v.y * center.y;
  float m = 1.0 - smoothstep(-u_smoothness, 0.0, v.x * uv.x + v.y * uv.y - (d - 0.5 + progress * (1.0 + u_smoothness)));
  return mix(getFromColor(uv), getToColor(uv), m);
}`;

export const directionalwipe: ShaderDefinition = {
  id: 'transition-directionalwipe',
  name: 'Directional Wipe',
  category: 'transition',
  description: 'Hard-edge directional wipe with configurable direction and smoothness',
  author: 'Gaetan Renaudeau',
  license: 'MIT',
  url: 'https://gl-transitions.com/editor/directionalwipe',
  fragmentSource: SOURCE,
  params: [
    { key: 'directionX', label: 'Dir X', type: 'float', default: 1.0, min: -1, max: 1, step: 0.1 },
    { key: 'directionY', label: 'Dir Y', type: 'float', default: -1.0, min: -1, max: 1, step: 0.1 },
    { key: 'smoothness', label: 'Smooth', type: 'float', default: 0.5, min: 0, max: 1, step: 0.01 },
  ],
};
