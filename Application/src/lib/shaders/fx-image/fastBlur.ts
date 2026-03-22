import type { ShaderDefinition } from '../../shaderLibrary';

const SOURCE = `// Fast Blur (1-4 steps)
// By Mirza Beig — do whatever you want license

#define PI 3.14159
#define TAU PI * 2.0

vec2 PointOnUnitCircle(float angle) {
    return vec2(cos(angle), sin(angle));
}

float InterleavedGradientNoise(vec2 pixCoord, int frameCount) {
    const vec3 magic = vec3(0.06711056, 0.00583715, 52.9829189);
    vec2 frameMagicScale = vec2(2.083, 4.867);
    pixCoord += float(frameCount) * frameMagicScale;
    return fract(magic.z * fract(dot(pixCoord, magic.xy)));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;

    // Aspect ratio correction
    float ar = min(iResolution.x, iResolution.y) / max(iResolution.x, iResolution.y);
    vec2 ar2 = iResolution.x > iResolution.y ? vec2(1.0, ar) : vec2(ar, 1.0);

    vec4 rgba = vec4(0.0);
    vec2 blurRadius = (u_radius * 0.05) * ar2;

    // Noise for sample distribution
    int frame = iFrame % 60;
    float noise = InterleavedGradientNoise(fragCoord, frame);

    int quality = int(u_steps);
    float quality_f = float(quality);

    vec2 dir = PointOnUnitCircle(noise * TAU);

    for (int i = 0; i < 4; i++) {
        if (i >= quality) break;
        vec2 uvOffset = dir * blurRadius;
        rgba += texture(iChannel0, uv + uvOffset);
        dir = vec2(-dir.y, dir.x); // rotate 90 degrees
    }

    rgba /= quality_f;
    fragColor = rgba;
}`;

export const fastBlur: ShaderDefinition = {
  id: 'fast-blur',
  name: 'Fast Blur',
  category: 'fx-image',
  description: 'GPU disc blur with noise-rotated sampling (1-4 steps)',
  author: 'Mirza',
  url: 'https://www.shadertoy.com/view/Nff3D4',
  fragmentSource: SOURCE,
  defaultBlend: 'normal',
  params: [
    { key: 'radius', label: 'Radius', type: 'float', default: 0.5, min: 0, max: 1, step: 0.01 },
    { key: 'steps', label: 'Steps', type: 'float', default: 4, min: 1, max: 4, step: 1 },
  ],
};
