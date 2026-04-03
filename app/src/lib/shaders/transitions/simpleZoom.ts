import type { ShaderDefinition } from '../../shaderLibrary';

const SOURCE = `// Author: 0gust1
// License: MIT
// https://gl-transitions.com/editor/SimpleZoom

vec2 zoom(vec2 uv, float amount) {
  return 0.5 + ((uv - 0.5) * (1.0 - amount));
}

vec4 transition (vec2 uv) {
  float nQuick = clamp(u_zoom_quickness, 0.2, 5.0);
  return mix(
    getFromColor(zoom(uv, smoothstep(0.0, nQuick, progress))),
    getToColor(uv),
    smoothstep(nQuick - 0.2, 1.0, progress)
  );
}`;

export const simpleZoom: ShaderDefinition = {
  id: 'transition-simple-zoom',
  name: 'Simple Zoom',
  category: 'transition',
  description: 'Simple zoom-in transition',
  author: '0gust1',
  license: 'MIT',
  url: 'https://gl-transitions.com/editor/SimpleZoom',
  fragmentSource: SOURCE,
  params: [
    { key: 'zoom_quickness', label: 'Quick', type: 'float', default: 0.8, min: 0.2, max: 5, step: 0.1 },
  ],
};
