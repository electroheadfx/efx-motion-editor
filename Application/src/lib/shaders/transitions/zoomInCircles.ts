import type { ShaderDefinition } from '../../shaderLibrary';

const SOURCE = `// Author: Fernando Kuteken
// License: MIT
// https://gl-transitions.com/editor/ZoomInCircles

vec4 transition(vec2 uv) {
  float PI = 3.141592653589793;
  float dist = distance(uv, vec2(0.5));
  float radius = progress * 1.5;

  float angle = atan(uv.y - 0.5, uv.x - 0.5) - 0.5 * PI;
  float offset = 3.0 * progress;

  float circleRadius = 0.3;
  vec2 p = vec2(
    0.5 + circleRadius * cos(angle + offset),
    0.5 + circleRadius * sin(angle + offset)
  );

  float d = distance(uv, p);
  float t = 1.0 - smoothstep(0.0, radius, d);

  return mix(getFromColor(uv), getToColor(uv), t);
}`;

export const zoomInCircles: ShaderDefinition = {
  id: 'transition-zoom-in-circles',
  name: 'Zoom In Circles',
  category: 'transition',
  description: 'Zoom with circular reveal pattern',
  author: 'Fernando Kuteken',
  license: 'MIT',
  url: 'https://gl-transitions.com/editor/ZoomInCircles',
  fragmentSource: SOURCE,
  params: [],
};
