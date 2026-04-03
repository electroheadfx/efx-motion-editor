import type { ShaderDefinition } from '../../shaderLibrary';

const SOURCE = `// Author: mikolalysenko
// License: MIT
// https://gl-transitions.com/editor/Dreamy

vec2 offset(float progress, float x, float theta) {
  float phase = progress * progress + progress + theta;
  float shifty = 0.03 * progress * cos(10.0 * (progress + x));
  return vec2(0.0, shifty);
}

vec4 transition(vec2 uv) {
  return mix(
    getFromColor(uv + offset(progress, uv.x, 0.0)),
    getToColor(uv + offset(1.0 - progress, uv.x, 3.14)),
    progress
  );
}`;

export const dreamy: ShaderDefinition = {
  id: 'transition-dreamy',
  name: 'Dreamy',
  category: 'transition',
  description: 'Dreamy blur dissolve transition',
  author: 'mikolalysenko',
  license: 'MIT',
  url: 'https://gl-transitions.com/editor/Dreamy',
  fragmentSource: SOURCE,
  params: [],
};
