import type { ShaderDefinition } from '../../shaderLibrary';

const SOURCE = `// Author: Gunnar Roth
// License: MIT
// https://gl-transitions.com/editor/GlitchMemories

vec4 transition(vec2 uv) {
  float strength = 0.4;
  vec4 color = vec4(0.0);

  // Create glitch effect
  float y = uv.y;
  float x = uv.x;

  float t = progress;
  float block = floor(y * 20.0);
  float offset = sin(block * 1234.5 + t * 5.0) * t * strength;

  vec2 uv1 = vec2(x + offset, y);
  vec2 uv2 = vec2(x - offset * 0.5, y);
  vec2 uv3 = vec2(x + offset * 0.3, y);

  vec4 from = getFromColor(uv);
  vec4 to = getToColor(uv);

  // Chromatic aberration-like split
  float r = mix(getFromColor(uv1).r, getToColor(uv1).r, t);
  float g = mix(getFromColor(uv2).g, getToColor(uv2).g, t);
  float b = mix(getFromColor(uv3).b, getToColor(uv3).b, t);

  return vec4(r, g, b, 1.0);
}`;

export const glitchMemories: ShaderDefinition = {
  id: 'transition-glitch-memories',
  name: 'Glitch Memories',
  category: 'transition',
  description: 'Glitch effect with chromatic aberration',
  author: 'Gunnar Roth',
  license: 'MIT',
  url: 'https://gl-transitions.com/editor/GlitchMemories',
  fragmentSource: SOURCE,
  params: [],
};
