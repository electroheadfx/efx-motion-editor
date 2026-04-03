import type { ShaderDefinition } from '../../shaderLibrary';

const SOURCE = `// Color Fusion 8
// RGB channel cycling — shows one color channel per frame for chromatic persistence

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    vec4 src = texture(iChannel0, uv);

    // Cycle through R, G, B channels
    int ch = int(floor(iTime * u_speed * 24.0)) % 3;

    fragColor = vec4(0.0, 0.0, 0.0, 1.0);
    if (ch == 0) fragColor.r = src.r * u_brightness;
    else if (ch == 1) fragColor.g = src.g * u_brightness;
    else fragColor.b = src.b * u_brightness;
}`;

export const colorFusion: ShaderDefinition = {
  id: 'color-fusion',
  name: 'Color Fusion',
  category: 'fx-image',
  description: 'RGB channel cycling — chromatic persistence effect',
  author: 'FabriceNeyret2',
  url: 'https://www.shadertoy.com/view/scS3Rz',
  fragmentSource: SOURCE,
  defaultBlend: 'normal',
  params: [
    { key: 'speed', label: 'Speed', type: 'float', default: 1.0, min: 0.1, max: 5, step: 0.1 },
    { key: 'brightness', label: 'Brightness', type: 'float', default: 1.73, min: 1, max: 3, step: 0.01 },
  ],
};
