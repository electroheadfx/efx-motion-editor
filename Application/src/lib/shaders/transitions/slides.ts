import type { ShaderDefinition } from '../../shaderLibrary';

const SOURCE = `// Author: Mark Craig
// License: MIT
// https://gl-transitions.com/editor/Slides

vec4 transition(vec2 uv) {
  float slidesType = u_slidesType;
  float slidesIn = u_slidesIn;
  float slides = 10.0;
  float p = progress;

  if (slidesIn > 0.5) {
    p = 1.0 - p;
  }

  float x = 0.0;
  if (slidesType < 0.5) {
    x = fract(uv.x * slides);
  } else {
    x = fract(uv.y * slides);
  }

  float m = step(x, p);

  if (slidesIn > 0.5) {
    return mix(getToColor(uv), getFromColor(uv), m);
  } else {
    return mix(getFromColor(uv), getToColor(uv), m);
  }
}`;

export const slides: ShaderDefinition = {
  id: 'transition-slides',
  name: 'Slides',
  category: 'transition',
  description: 'Multi-panel slide transition',
  author: 'Mark Craig',
  license: 'MIT',
  url: 'https://gl-transitions.com/editor/Slides',
  fragmentSource: SOURCE,
  params: [
    { key: 'slidesType', label: 'Type', type: 'float', default: 0.0, min: 0, max: 1, step: 1 },
    { key: 'slidesIn', label: 'In', type: 'float', default: 0.0, min: 0, max: 1, step: 1 },
  ],
};
