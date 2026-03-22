import type { ShaderDefinition } from '../../shaderLibrary';

const SOURCE = `// Filmora Shake — camera shake with motion blur and RGB separation

vec2 rotateFunc(vec2 uv, vec2 center, float theta) {
    vec2 temp;
    temp.x = cos(theta) * (uv.x - center.x) - sin(theta) * (uv.y - center.y);
    temp.y = sin(theta) * (uv.x - center.x) + cos(theta) * (uv.y - center.y);
    return temp + center;
}

vec2 randShake(float frequency, float amplitude, float t, float offset) {
    vec2 temp;
    float tt = t - offset;
    temp.x = sin(tt * frequency) + sin(tt * frequency * 2.1) * 1.828 + sin(tt * frequency * 1.72) * 4.0;
    temp.x *= amplitude * 0.06;
    temp.y = frequency * cos(tt * frequency) + cos(tt * frequency * 2.1) * 1.828 * frequency * 2.1 + cos(tt * frequency * 1.72) * 4.0 * frequency * 1.72;
    temp.y *= amplitude * 0.06;
    temp.y *= 0.75;
    return temp;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord.xy / iResolution.xy;

    float radialBlur = 0.9;
    float rotateBlur = 0.1;

    vec2 motion = randShake(u_frequency * 0.7777, u_amplitude, iTime, 0.0);
    vec2 scaleRandX = randShake(u_frequency * 0.6666, u_amplitude, iTime, 1.7);
    vec2 scaleRandY = randShake(u_frequency * 0.9, u_amplitude, iTime, 0.9);

    vec2 posRandX = randShake(u_frequency * 0.833, u_amplitude, iTime, 0.666) * u_posAmount;
    vec2 posRandY = randShake(u_frequency * 0.777, u_amplitude, iTime, 0.333) * u_posAmount;

    vec2 curPos = vec2(posRandX.x, posRandY.x);
    float curRotate = motion.x * u_rotateAmount;

    uv -= curPos;
    uv = rotateFunc(uv, vec2(0.5), radians(curRotate));

    vec2 radialDir = radialBlur * (uv - vec2(0.5)) * vec2(scaleRandX.y, scaleRandY.y) * 0.01;
    float detaRotate = motion.y * u_rotateAmount;
    vec2 rotateDir = rotateBlur * normalize(uv - vec2(0.5)) * length(uv - vec2(0.5)) * radians(detaRotate);

    vec2 totalDir = radialDir + rotateDir + vec2(posRandX.y, posRandY.y) * u_motionBlur;
    vec2 rgbSep = u_rgbSeparate > 0.5 ? clamp(totalDir * 0.1, -0.02, 0.02) : vec2(0.0);

    vec4 color = vec4(0.0);
    int samples = u_motionBlur > 0.01 ? 16 : 2;
    float blurAmp = 0.05;

    for (int i = 0; i < 16; i++) {
        if (i >= samples) break;
        float t = float(i) / float(samples);
        vec2 offset = totalDir * blurAmp * t;
        color.r += texture(iChannel0, uv + offset).r;
        color.g += texture(iChannel0, uv + offset + rgbSep).g;
        color.b += texture(iChannel0, uv + offset + rgbSep).b;
        color.a += texture(iChannel0, uv + offset).a;
    }
    color /= float(samples);

    fragColor = color;
}`;

export const filmoraShake: ShaderDefinition = {
  id: 'filmora-shake',
  name: 'Filmora Shake',
  category: 'fx-image',
  description: 'Camera shake with motion blur, rotation, and RGB separation',
  author: 'MunaAlaneme',
  url: 'https://www.shadertoy.com/view/sfSGWw',
  fragmentSource: SOURCE,
  defaultBlend: 'normal',
  params: [
    { key: 'amplitude', label: 'Amplitude', type: 'float', default: 0.5, min: 0, max: 2, step: 0.01 },
    { key: 'frequency', label: 'Frequency', type: 'float', default: 10.0, min: 1, max: 30, step: 0.5 },
    { key: 'posAmount', label: 'Position', type: 'float', default: 1.0, min: 0, max: 2, step: 0.01 },
    { key: 'rotateAmount', label: 'Rotation', type: 'float', default: 45.0, min: 0, max: 90, step: 1 },
    { key: 'motionBlur', label: 'Motion Blur', type: 'float', default: 0.2, min: 0, max: 1, step: 0.01 },
    { key: 'rgbSeparate', label: 'RGB Split', type: 'float', default: 1.0, min: 0, max: 1, step: 1 },
  ],
};
