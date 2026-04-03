import type { ShaderDefinition } from '../../shaderLibrary';

const SOURCE = `// Color Temperature Adjustment
// ProPhoto RGB color space with Bradford CAT

vec3 srgb_to_linear(vec3 c) {
    bvec3 cutoff = lessThanEqual(c, vec3(0.04045));
    return mix(pow((c + 0.055) / 1.055, vec3(2.4)), c / 12.92, vec3(cutoff));
}

vec3 linear_to_srgb(vec3 c) {
    bvec3 cutoff = lessThanEqual(c, vec3(0.0031308));
    return mix(1.055 * pow(c, vec3(1.0/2.4)) - 0.055, c * 12.92, vec3(cutoff));
}

const mat3 LIN_SRGB_TO_PROPHOTO = mat3(
    0.52939592, 0.09837781, 0.01687183,
    0.33012826, 0.87345099, 0.11762794,
    0.14051764, 0.02816105, 0.86494341
);

const mat3 LIN_PROPHOTO_TO_SRGB = mat3(
     2.03391897, -0.22880734, -0.00855754,
    -0.72741620,  1.23175182, -0.15332300,
    -0.30674909, -0.00293239,  1.16255787
);

const vec3 PROPHOTO_LUMA_COEFFS = vec3(0.2880402, 0.7118741, 0.0000857);

float getLinearProPhotoLuminance(vec3 color) {
    return dot(color, PROPHOTO_LUMA_COEFFS);
}

vec3 srgb_to_linear_prophoto(vec3 srgb) {
    return LIN_SRGB_TO_PROPHOTO * srgb_to_linear(srgb);
}

vec3 linear_prophoto_to_srgb(vec3 pro) {
    vec3 lin_srgb = LIN_PROPHOTO_TO_SRGB * pro;
    return linear_to_srgb(clamp(lin_srgb, 0.0, 1.0));
}

vec3 set_saturation(vec3 rgb, float sat) {
    vec3 grey = vec3(max(max(rgb.r, rgb.g), rgb.b));
    return mix(grey, rgb, sat);
}

vec3 adjust_temperature(vec3 inColor, float temperature, float lumaFix) {
    vec3 exponents = vec3(1.0);
    float saturation_factor = 1.0;

    if (temperature < 0.0) {
        float t = pow(-temperature, 2.0);
        exponents.r = mix(1.0, 1.5, t);
        exponents.g = mix(1.0, 1.5, 1.0 - pow(1.0 - t, 2.0));
        exponents.b = mix(1.0, 15.0, t);
        saturation_factor = mix(1.0, 0.7, 1.0 - pow(1.0 - t, 2.0));
    } else {
        float t = pow(temperature, 2.0);
        exponents = mix(vec3(1.0), vec3(4.0, 3.0, 1.3), t);
    }

    vec3 in_pro = srgb_to_linear_prophoto(inColor);
    vec3 adjusted = set_saturation(in_pro, saturation_factor);
    adjusted = 1.0 - pow(1.0 - clamp(adjusted, 0.0, 1.0), exponents);

    float old_luma = getLinearProPhotoLuminance(in_pro);
    float new_luma = getLinearProPhotoLuminance(adjusted);
    vec3 adjusted_fixed = adjusted * (old_luma / max(new_luma, 0.001));
    adjusted = mix(adjusted, adjusted_fixed, lumaFix);

    return linear_prophoto_to_srgb(adjusted);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    vec3 color = texture(iChannel0, uv).rgb;
    vec3 adjusted = adjust_temperature(color, u_temperature, u_lumaPreserve);
    fragColor = vec4(adjusted, 1.0);
}`;

export const colorTemperature: ShaderDefinition = {
  id: 'color-temperature',
  name: 'Color Temperature',
  category: 'fx-image',
  description: 'Warm/cool white balance in perceptual ProPhoto RGB space',
  author: 'slyvek',
  url: 'https://www.shadertoy.com/view/ffSGDh',
  fragmentSource: SOURCE,
  defaultBlend: 'normal',
  params: [
    { key: 'temperature', label: 'Temperature', type: 'float', default: 0, min: -1, max: 1, step: 0.01 },
    { key: 'lumaPreserve', label: 'Luma Preserve', type: 'float', default: 0.5, min: 0, max: 1, step: 0.01 },
  ],
};
