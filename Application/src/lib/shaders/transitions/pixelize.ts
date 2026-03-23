import type { ShaderDefinition } from '../../shaderLibrary';

const SOURCE = `// Author: gre (Gaetan Renaudeau)
// License: MIT
// https://gl-transitions.com/editor/pixelize

vec4 transition(vec2 uv) {
  ivec2 squaresMin = ivec2(int(u_squaresMinX), int(u_squaresMinY));
  float d = min(progress, 1.0 - progress);
  float dist = u_steps > 0.0 ? ceil(d * u_steps) / u_steps : d;
  vec2 squareSize = 2.0 * dist / vec2(squaresMin);
  vec2 p = dist > 0.0 ? (floor(uv / squareSize) + 0.5) * squareSize : uv;
  return mix(getFromColor(p), getToColor(p), progress);
}`;

export const pixelize: ShaderDefinition = {
  id: 'transition-pixelize',
  name: 'Pixelize',
  category: 'transition',
  description: 'Pixelation transition with configurable grid size',
  author: 'gre',
  license: 'MIT',
  url: 'https://gl-transitions.com/editor/pixelize',
  fragmentSource: SOURCE,
  params: [
    { key: 'squaresMinX', label: 'Grid X', type: 'float', default: 20.0, min: 1, max: 100, step: 1 },
    { key: 'squaresMinY', label: 'Grid Y', type: 'float', default: 20.0, min: 1, max: 100, step: 1 },
    { key: 'steps', label: 'Steps', type: 'float', default: 50.0, min: 1, max: 100, step: 1 },
  ],
};
