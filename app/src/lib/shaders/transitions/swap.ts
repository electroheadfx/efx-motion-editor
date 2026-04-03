import type { ShaderDefinition } from '../../shaderLibrary';

const SOURCE = `// Author: gre (Gaetan Renaudeau)
// License: MIT
// https://gl-transitions.com/editor/swap

bool inBounds(vec2 p) {
  return all(lessThan(vec2(0.0), p)) && all(lessThan(p, vec2(1.0)));
}

vec4 transition(vec2 p) {
  float size = mix(1.0, u_depth, progress);
  float sigmoidProg = mix(-65.0, 65.0, progress);
  float sig = 1.0 / (1.0 + exp(-sigmoidProg));

  vec2 fromP = (p - vec2(mix(0.0, -0.5 + 0.5 * size, sig), 0.5)) / vec2(size, size) + vec2(0.5, 0.5);
  vec2 toP = (p - vec2(mix(0.5 + 0.5 * size, 1.0, sig), 0.5)) / vec2(size, size) + vec2(0.5, 0.5);

  if (inBounds(fromP)) {
    return getFromColor(fromP);
  } else if (inBounds(toP)) {
    return getToColor(toP);
  } else {
    if (fromP.y < 0.0 && inBounds(vec2(fromP.x, -fromP.y))) {
      return mix(vec4(0.0), getFromColor(vec2(fromP.x, -fromP.y)), u_reflection * (1.0 - fromP.y));
    } else if (toP.y < 0.0 && inBounds(vec2(toP.x, -toP.y))) {
      return mix(vec4(0.0), getToColor(vec2(toP.x, -toP.y)), u_reflection * (1.0 - toP.y));
    }
    return vec4(0.0);
  }
}`;

export const swap: ShaderDefinition = {
  id: 'transition-swap',
  name: 'Swap',
  category: 'transition',
  description: 'Two images swap positions with perspective and reflection',
  author: 'gre',
  license: 'MIT',
  url: 'https://gl-transitions.com/editor/swap',
  fragmentSource: SOURCE,
  params: [
    { key: 'reflection', label: 'Reflect', type: 'float', default: 0.4, min: 0, max: 1, step: 0.01 },
    { key: 'perspective', label: 'Persp', type: 'float', default: 0.2, min: 0, max: 1, step: 0.01 },
    { key: 'depth', label: 'Depth', type: 'float', default: 3.0, min: 0, max: 10, step: 0.1 },
  ],
};
