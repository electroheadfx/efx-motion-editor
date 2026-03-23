import type { ShaderDefinition } from '../../shaderLibrary';

const SOURCE = `// Author: gre (Gaetan Renaudeau)
// License: MIT
// https://gl-transitions.com/editor/wipeDown

vec4 transition(vec2 uv) {
  vec2 p = uv;
  return mix(
    getToColor(p),
    getFromColor(p),
    step(1.0 - progress, p.y)
  );
}`;

export const wipeDown: ShaderDefinition = {
  id: 'transition-wipe-down',
  name: 'Wipe Down',
  category: 'transition',
  description: 'Clean top-to-bottom wipe transition',
  author: 'gre',
  license: 'MIT',
  url: 'https://gl-transitions.com/editor/wipeDown',
  fragmentSource: SOURCE,
  params: [],
};
