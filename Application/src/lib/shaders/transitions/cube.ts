import type { ShaderDefinition } from '../../shaderLibrary';

const SOURCE = `// Author: gre (Gaetan Renaudeau)
// License: MIT
// https://gl-transitions.com/editor/cube

vec2 project(vec2 p) {
  return p * vec2(1.0, -1.2) + vec2(0.0, -u_floating / 100.0);
}

bool inBounds(vec2 p) {
  return all(lessThan(vec2(0.0), p)) && all(lessThan(p, vec2(1.0)));
}

vec4 bgColor(vec2 p, vec2 pfr, vec2 pto) {
  vec4 c = vec4(0.0, 0.0, 0.0, 1.0);
  pfr = project(pfr);
  if (inBounds(pfr)) {
    c += mix(vec4(0.0), getFromColor(pfr), u_reflection * mix(1.0, 0.0, pfr.y));
  }
  pto = project(pto);
  if (inBounds(pto)) {
    c += mix(vec4(0.0), getToColor(pto), u_reflection * mix(1.0, 0.0, pto.y));
  }
  return c;
}

vec2 xskew(vec2 p, float persp, float center) {
  float x = mix(p.x, 1.0 - p.x, center);
  return (
    (vec2(x, (p.y - 0.5 * (1.0 - persp) * x) / (1.0 + (persp - 1.0) * x)) - vec2(0.5, 0.5))
    * vec2(0.95, 0.95) + vec2(0.5, 0.5)
  );
}

vec4 transition(vec2 op) {
  float uz = u_unzoom * 2.0 * (0.5 - distance(0.5, progress));
  vec2 p = -uz * 0.5 + (1.0 + uz) * op;
  vec2 fromP = xskew(
    (p - vec2(progress, 0.0)) / vec2(1.0 - progress, 1.0),
    1.0 - mix(progress, 0.0, u_persp),
    0.0
  );
  vec2 toP = xskew(
    p / vec2(progress, 1.0),
    mix(pow(progress, 2.0), 1.0, u_persp),
    1.0
  );
  if (inBounds(fromP)) {
    return getFromColor(fromP);
  } else if (inBounds(toP)) {
    return getToColor(toP);
  }
  return bgColor(op, fromP, toP);
}`;

export const cube: ShaderDefinition = {
  id: 'transition-cube',
  name: 'Cube',
  category: 'transition',
  description: '3D cube rotation transition with reflection',
  author: 'gre',
  license: 'MIT',
  url: 'https://gl-transitions.com/editor/cube',
  fragmentSource: SOURCE,
  params: [
    { key: 'persp', label: 'Persp', type: 'float', default: 0.7, min: 0, max: 1, step: 0.01 },
    { key: 'unzoom', label: 'Unzoom', type: 'float', default: 0.3, min: 0, max: 1, step: 0.01 },
    { key: 'reflection', label: 'Reflect', type: 'float', default: 0.4, min: 0, max: 1, step: 0.01 },
    { key: 'floating', label: 'Float', type: 'float', default: 3.0, min: 0, max: 10, step: 0.1 },
  ],
};
