import type { ShaderDefinition } from '../../shaderLibrary';

const SOURCE = `// Author: gre (Gaetan Renaudeau)
// License: MIT
// https://gl-transitions.com/editor/dissolve

// Based on noise dissolve, using fract/sin hash

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

vec4 transition(vec2 uv) {
  float n = hash(uv * 1000.0);
  return mix(getFromColor(uv), getToColor(uv), step(n, progress));
}`;

export const dissolve: ShaderDefinition = {
  id: 'transition-dissolve',
  name: 'Dissolve',
  category: 'transition',
  description: 'Random noise dissolve transition',
  author: 'gre',
  license: 'MIT',
  url: 'https://gl-transitions.com/editor/dissolve',
  fragmentSource: SOURCE,
  params: [],
};
