import type { ShaderDefinition } from '../../shaderLibrary';

const SOURCE = `// Camera Pixel Filters
// B&W with grayscale, monotone, and duotone modes

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = fragCoord/iResolution.xy;
    vec4 frag = texture(iChannel0, uv);

    // Luminance (Rec. 709)
    float luma = dot(frag.rgb, vec3(0.2126, 0.7152, 0.0722));

    // Contrast: 0 = flat gray, 0.5 = normal, 1 = high contrast
    float mid = 0.5;
    float cf = u_contrast * 4.0;
    float v = clamp(mid + (luma - mid) * cf, 0.0, 1.0);

    if (u_mode < 0.5) {
        // Grayscale
        fragColor = vec4(vec3(v), frag.a);
    } else if (u_mode < 1.5) {
        // Monotone: tint color in shadows -> white in highlights
        vec3 tint = vec3(u_tintR, u_tintG, u_tintB);
        fragColor = vec4(mix(tint, vec3(1.0), v), frag.a);
    } else {
        // Duotone: shadow color -> highlight color
        vec3 shadow = vec3(u_shadowR, u_shadowG, u_shadowB);
        vec3 highlight = vec3(u_highlightR, u_highlightG, u_highlightB);
        fragColor = vec4(mix(shadow, highlight, v), frag.a);
    }
}`;

export const cameraPixelFilters: ShaderDefinition = {
  id: 'camera-pixel-filters',
  name: 'B&W Pixel Filter',
  category: 'fx-image',
  description: 'Black & white image filter with duotone and grayscale modes',
  author: 'OnyxWingman',
  url: 'https://www.shadertoy.com/view/MfBXRt',
  fragmentSource: SOURCE,
  defaultBlend: 'normal',
  params: [
    { key: 'mode', label: 'Mode', type: 'float', default: 0, min: 0, max: 2, step: 1 },
    { key: 'contrast', label: 'Contrast', type: 'float', default: 0.5, min: 0, max: 1, step: 0.01 },
    // Monotone tint color (shown when mode=1)
    { key: 'tintR', label: 'Tint', type: 'float', default: 0, min: 0, max: 1, step: 0.01, colorGroup: 'tint' },
    { key: 'tintG', label: 'Tint', type: 'float', default: 0, min: 0, max: 1, step: 0.01, colorGroup: 'tint', hidden: true },
    { key: 'tintB', label: 'Tint', type: 'float', default: 0, min: 0, max: 1, step: 0.01, colorGroup: 'tint', hidden: true },
    // Duotone shadow color (shown when mode=2)
    { key: 'shadowR', label: 'Shadow', type: 'float', default: 0, min: 0, max: 1, step: 0.01, colorGroup: 'shadow' },
    { key: 'shadowG', label: 'Shadow', type: 'float', default: 0, min: 0, max: 1, step: 0.01, colorGroup: 'shadow', hidden: true },
    { key: 'shadowB', label: 'Shadow', type: 'float', default: 0.15, min: 0, max: 1, step: 0.01, colorGroup: 'shadow', hidden: true },
    // Duotone highlight color (shown when mode=2)
    { key: 'highlightR', label: 'Highlight', type: 'float', default: 1, min: 0, max: 1, step: 0.01, colorGroup: 'highlight' },
    { key: 'highlightG', label: 'Highlight', type: 'float', default: 0.95, min: 0, max: 1, step: 0.01, colorGroup: 'highlight', hidden: true },
    { key: 'highlightB', label: 'Highlight', type: 'float', default: 0.85, min: 0, max: 1, step: 0.01, colorGroup: 'highlight', hidden: true },
  ],
};
