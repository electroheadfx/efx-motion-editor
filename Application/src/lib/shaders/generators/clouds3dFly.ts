import type { ShaderDefinition } from '../../shaderLibrary';

const SOURCE = `// Clouds 3D Fly — volumetric cloud flythrough
// Based on shadertoy.com/view/4sXGRM

mat3 m = mat3(0.00, 1.60, 1.20, -1.60, 0.72, -0.96, -1.20, -0.96, 1.28);

float hash(float n) { return fract(cos(n) * 114514.1919); }

float noise(in vec3 x) {
    vec3 p = floor(x);
    vec3 f = smoothstep(0.0, 1.0, fract(x));
    float n = p.x + p.y * 10.0 + p.z * 100.0;
    return mix(
        mix(mix(hash(n+0.0), hash(n+1.0), f.x), mix(hash(n+10.0), hash(n+11.0), f.x), f.y),
        mix(mix(hash(n+100.0), hash(n+101.0), f.x), mix(hash(n+110.0), hash(n+111.0), f.x), f.y), f.z);
}

float fbm(vec3 p) {
    float f = 0.5000 * noise(p); p = m * p;
    f += 0.2500 * noise(p); p = m * p;
    f += 0.1666 * noise(p); p = m * p;
    f += 0.0834 * noise(p);
    return f;
}

vec3 camera(float time) {
    return vec3(5000.0 * sin(1.0 * time), 5000.0 + 1500.0 * sin(0.5 * time), 6000.0 * time);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = 2.0 * fragCoord.xy / iResolution.xy - 1.0;
    uv.x *= iResolution.x / iResolution.y;

    float time = (iTime * u_speed + 13.5 + 44.0) * 1.0;
    vec3 campos = camera(time);
    vec3 camtar = camera(time + 0.4);

    vec3 front = normalize(camtar - campos);
    vec3 right = normalize(cross(front, vec3(0.0, 1.0, 0.0)));
    vec3 up = normalize(cross(right, front));
    vec3 fragAt = normalize(uv.x * right + uv.y * up + front);

    vec3 skyCol = vec3(u_skyR, u_skyG, u_skyB);
    vec3 light = normalize(vec3(0.1, 0.25, 0.9));

    vec4 sum = vec4(0, 0, 0, 0);
    for (float depth = 0.0; depth < 100000.0; depth += 200.0) {
        vec3 ray = campos + fragAt * depth;
        if (0.0 < ray.y && ray.y < 10000.0) {
            float alpha = smoothstep(0.5, 1.0, fbm(ray * 0.00025 * u_density));
            vec3 localcolor = mix(vec3(1.1, 1.05, 1.0), vec3(0.3, 0.3, 0.2), alpha);
            alpha = (1.0 - sum.a) * alpha;
            sum += vec4(localcolor * alpha, alpha);
        }
    }

    float alpha = smoothstep(0.7, 1.0, sum.a);
    sum.rgb /= sum.a + 0.0001;

    float sundot = clamp(dot(fragAt, light), 0.0, 1.0);
    vec3 col = 0.8 * skyCol;
    col += 0.47 * vec3(1.6, 1.4, 1.0) * pow(sundot, 350.0) * u_sunIntensity;
    col += 0.4 * vec3(0.8, 0.9, 1.0) * pow(sundot, 2.0);
    sum.rgb -= 0.6 * vec3(0.8, 0.75, 0.7) * pow(sundot, 13.0) * alpha;
    sum.rgb += 0.2 * vec3(1.3, 1.2, 1.0) * pow(sundot, 5.0) * (1.0 - alpha);
    col = mix(col, sum.rgb, sum.a);

    fragColor = vec4(col, 1.0);
}`;

export const clouds3dFly: ShaderDefinition = {
  id: 'clouds-3d-fly',
  name: 'Clouds 3D Fly',
  category: 'generator',
  description: 'Volumetric cloud flythrough with sun lighting and FBM noise',
  author: 'murieron',
  url: 'https://www.shadertoy.com/view/wdsfDH',
  fragmentSource: SOURCE,
  defaultBlend: 'normal',
  params: [
    { key: 'speed', label: 'Speed', type: 'float', default: 1.0, min: 0, max: 3, step: 0.05 },
    { key: 'density', label: 'Density', type: 'float', default: 1.0, min: 0.3, max: 3, step: 0.05 },
    { key: 'sunIntensity', label: 'Sun', type: 'float', default: 1.0, min: 0, max: 3, step: 0.05 },
    { key: 'skyR', label: 'Sky', type: 'float', default: 0.05, min: 0, max: 1, step: 0.01, colorGroup: 'sky' },
    { key: 'skyG', label: 'Sky', type: 'float', default: 0.2, min: 0, max: 1, step: 0.01, colorGroup: 'sky', hidden: true },
    { key: 'skyB', label: 'Sky', type: 'float', default: 0.5, min: 0, max: 1, step: 0.01, colorGroup: 'sky', hidden: true },
  ],
};
