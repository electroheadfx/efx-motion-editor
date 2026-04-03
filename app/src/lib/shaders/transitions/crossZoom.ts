import type { ShaderDefinition } from '../../shaderLibrary';

const SOURCE = `// Author: rectalogic
// License: MIT
// https://gl-transitions.com/editor/CrossZoom

// Attempt to implement a transition similar to cross-zoom effect
// using motion blur

#define PI 3.141592653589793

float Linear_ease(in float begin, in float change, in float duration, in float time) {
  return change * time / duration + begin;
}

float Exponential_easeInOut(in float begin, in float change, in float duration, in float time) {
  if (time == 0.0)
    return begin;
  else if (time == duration)
    return begin + change;
  time = time / (duration / 2.0);
  if (time < 1.0)
    return change / 2.0 * pow(2.0, 10.0 * (time - 1.0)) + begin;
  return change / 2.0 * (-pow(2.0, -10.0 * (time - 1.0)) + 2.0) + begin;
}

float Sinusoidal_easeInOut(in float begin, in float change, in float duration, in float time) {
  return -change / 2.0 * (cos(PI * time / duration) - 1.0) + begin;
}

float rand(vec2 co) {
  return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

vec3 crossFade(in vec2 uv, in float dissolve) {
  return mix(getFromColor(uv).rgb, getToColor(uv).rgb, dissolve);
}

vec4 transition(vec2 uv) {
  float strength = u_strength;

  vec2 center = vec2(Linear_ease(0.25, 0.5, 1.0, progress), 0.5);
  float dissolve = Exponential_easeInOut(0.0, 1.0, 1.0, progress);

  float str = Sinusoidal_easeInOut(0.0, strength, 0.5, progress);
  vec2 dir = uv - center;
  float dist = length(dir);

  if (dist > str) {
    return vec4(crossFade(uv, dissolve), 1.0);
  } else {
    vec2 v = dir / dist;
    float offset = str - dist;
    vec3 color = vec3(0.0);
    const int NUM_SAMPLES = 8;
    for (int i = 0; i < NUM_SAMPLES; i++) {
      float percent = (float(i) + rand(uv + float(i))) / float(NUM_SAMPLES);
      color += crossFade(uv + v * percent * offset, dissolve);
    }
    return vec4(color / float(NUM_SAMPLES), 1.0);
  }
}`;

export const crossZoom: ShaderDefinition = {
  id: 'transition-cross-zoom',
  name: 'Cross Zoom',
  category: 'transition',
  description: 'Zoom blur cross-dissolve transition',
  author: 'rectalogic',
  license: 'MIT',
  url: 'https://gl-transitions.com/editor/CrossZoom',
  fragmentSource: SOURCE,
  params: [
    { key: 'strength', label: 'Strength', type: 'float', default: 0.4, min: 0, max: 1, step: 0.01 },
  ],
};
