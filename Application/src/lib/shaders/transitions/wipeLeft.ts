import type { ShaderDefinition } from '../../shaderLibrary';

const SOURCE = `// Author: gre (Gaetan Renaudeau)
// License: MIT
// https://gl-transitions.com/editor/wipeLeft

vec4 transition(vec2 uv) {
  vec2 p = uv;
  return mix(
    getToColor(p),
    getFromColor(p),
    step(progress, p.x)
  );
}`;

export const wipeLeft: ShaderDefinition = {
  id: 'transition-wipe-left',
  name: 'Wipe Left',
  category: 'transition',
  description: 'Clean left-to-right wipe transition',
  author: 'gre',
  license: 'MIT',
  url: 'https://gl-transitions.com/editor/wipeLeft',
  fragmentSource: SOURCE,
  params: [],
};
