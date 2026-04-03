# GLSL Shader Spec — How to Add New Shaders

This document describes how to add new GLSL shaders to the EFX-Motion Editor shader library.

## Overview

Shaders are Shadertoy-compatible GLSL fragment shaders that run via WebGL2. There are two categories:

- **Generator** — Procedural content (stars, clouds, ocean). Acts as a layer on the timeline with opacity and blend mode. No input texture needed.
- **FX Image** — Image filter (B&W, blur, shake). Processes the composited content below it via `iChannel0`. Acts as an adjustment layer.

A third category, **Transition**, is planned for Phase 15.4.

## File Structure

Each shader lives in its own TypeScript file:

```
src/lib/shaders/
  generators/     <- generator shaders
    myShader.ts
  fx-image/       <- FX image shaders
    myFilter.ts
```

## Shader File Template

```typescript
import type { ShaderDefinition } from '../../shaderLibrary';

const SOURCE = `// Shader Name — short description
// Any comments about the shader

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;

    // For FX Image: read input texture
    // vec4 src = texture(iChannel0, uv);

    // Use custom params via u_ prefix
    // float speed = u_speed;

    // Your GLSL code here...

    fragColor = vec4(1.0);
}`;

export const myShader: ShaderDefinition = {
  id: 'my-shader',              // unique kebab-case ID
  name: 'My Shader',            // display name
  category: 'generator',        // 'generator' | 'fx-image'
  description: 'Short description shown in browser and sidebar',
  author: 'AuthorName',         // optional — Shadertoy username
  license: 'MIT',               // optional
  url: 'https://www.shadertoy.com/view/XXXXXX',  // optional — clickable link
  fragmentSource: SOURCE,
  defaultBlend: 'normal',       // default blend mode: 'normal' | 'screen' | 'multiply' | 'overlay' | 'add'
  params: [
    // See "Parameter Definitions" below
  ],
};
```

## Available Uniforms

The runtime automatically wraps your GLSL code with these Shadertoy-compatible uniforms:

| Uniform | Type | Description |
|---------|------|-------------|
| `iResolution` | `vec3` | Viewport resolution in pixels (z = 1.0) |
| `iTime` | `float` | Time in seconds (`performance.now() / 1000` for preview) |
| `iFrame` | `int` | Frame number |
| `iMouse` | `vec4` | Mouse position (currently always 0) |
| `iChannel0` | `sampler2D` | Input texture (FX Image only — contains canvas content below) |
| `iChannel1` | `sampler2D` | Secondary input (FX Image only) |

Custom parameters are declared as `uniform float u_<key>;` — the runtime generates these from your `params` array.

## Parameter Definitions

Each parameter in the `params` array defines a slider or color picker in the UI:

```typescript
interface ShaderParamDef {
  key: string;        // uniform name suffix (e.g., 'speed' -> uniform u_speed)
  label: string;      // display label (keep short: max 6 chars for sidebar 2-col layout)
  type: 'float';      // currently only float is supported
  default: number;    // default value
  min?: number;       // slider minimum
  max?: number;       // slider maximum
  step?: number;      // slider step size
  colorGroup?: string;  // groups R/G/B params into a color picker (see below)
  hidden?: boolean;     // hide from UI (used for G/B sub-params of a color group)
}
```

### Float Params (Sliders)

```typescript
{ key: 'speed', label: 'Speed', type: 'float', default: 1.0, min: 0, max: 3, step: 0.05 }
```

- Renders as a numeric input with drag-to-scrub in the sidebar
- Renders as a range slider in the browser preview
- All float params are keyframe-animatable via `sourceOverrides`

### Color Params (Color Picker)

Colors are represented as 3 float params (R, G, B) grouped together:

```typescript
{ key: 'colorR', label: 'Color', type: 'float', default: 1.0, min: 0, max: 1, step: 0.01, colorGroup: 'color' },
{ key: 'colorG', label: 'Color', type: 'float', default: 0.5, min: 0, max: 1, step: 0.01, colorGroup: 'color', hidden: true },
{ key: 'colorB', label: 'Color', type: 'float', default: 0.2, min: 0, max: 1, step: 0.01, colorGroup: 'color', hidden: true },
```

- The first param in the group is visible (shows the color swatch + label)
- The other two are `hidden: true` (only the color picker controls them)
- In the GLSL code, use `vec3(u_colorR, u_colorG, u_colorB)`
- For HDR colors (e.g., glow intensity), use `max` > 1.0
- The UI uses the `ColorPickerModal` component

### Mode Params (Discrete Selector)

For mode switching (e.g., Grayscale/Monotone/Duotone):

```typescript
{ key: 'mode', label: 'Mode', type: 'float', default: 0, min: 0, max: 2, step: 1 }
```

- Uses integer steps to switch between modes
- In the GLSL code: `if (u_mode < 0.5) { ... } else if (u_mode < 1.5) { ... } else { ... }`

### Conditional Visibility

For the B&W Pixel Filter, color params show/hide based on mode:

```typescript
// Only shown when mode = 1 (Monotone)
if (p.colorGroup === 'tint' && currentMode < 0.5) return null;
```

This logic is in the `GlslSection` component — extend it if your shader needs conditional params.

## Registration

After creating the shader file, register it in `src/lib/shaderLibrary.ts`:

1. Add an import:
```typescript
import { myShader } from './shaders/generators/myShader';
```

2. Add to the `SHADER_REGISTRY` array:
```typescript
const SHADER_REGISTRY: ShaderDefinition[] = [
  // ... existing shaders
  myShader,
];
```

## Porting from Shadertoy

When porting a Shadertoy shader:

1. **Entry point**: Keep `mainImage(out vec4 fragColor, in vec2 fragCoord)` — the runtime wraps it in `main()`
2. **Alpha**: The runtime forces `out_fragColor.a = 1.0` — you don't need to handle alpha
3. **Input texture**: For FX Image, the canvas content below is bound to `iChannel0`. The runtime handles Y-axis flipping via `UNPACK_FLIP_Y_WEBGL`
4. **Replace `#define` with uniforms**: Convert tunable `#define` constants to `uniform float u_<name>` params
5. **Replace `iMouse`**: Convert mouse-dependent behavior to explicit uniform params (e.g., rotation sliders)
6. **No multi-pass**: The runtime is single-pass. If the original uses Buffer A/B/C/D, inline the logic or approximate procedurally
7. **No `texelFetch` on buffers**: Replace buffer reads with procedural equivalents
8. **GLSL ES 300**: The runtime uses `#version 300 es` — avoid features not in ES 3.0
9. **Variable initialization**: Always initialize variables explicitly (`float x = 0.0;`). GLSL ES doesn't guarantee zero-init
10. **`out` params**: Don't read from `out` parameters before writing to them

## Rendering Pipeline

- **Generators**: Rendered to a WebGL2 offscreen canvas, then composited onto the main Canvas 2D via `drawImage`. Supports blur offscreen path.
- **FX Image**: The main canvas content is uploaded as a texture (`iChannel0`), shader processes it, result replaces canvas content. Opacity mixes between original and processed.
- **Export**: Same rendering path as preview — the `PreviewRenderer` handles both.

## Project Persistence

GLSL layers are saved in `.mce` project files as:
```json
{
  "type": "generator-glsl",
  "shader_id": "star-nest",
  "params": { "speed": 0.01, "zoom": 0.8, ... }
}
```

The Rust `MceLayerSource` struct includes `shader_id: Option<String>` and `params: Option<HashMap<String, f64>>`.

## Checklist for Adding a New Shader

- [ ] Create shader file in `src/lib/shaders/generators/` or `src/lib/shaders/fx-image/`
- [ ] Define GLSL source with `mainImage` entry point
- [ ] Convert tunable constants to `u_` uniform params
- [ ] Define `ShaderParamDef[]` with sensible defaults and ranges
- [ ] Export the `ShaderDefinition` with id, name, category, description
- [ ] Add author/url metadata if from Shadertoy
- [ ] Import and register in `shaderLibrary.ts`
- [ ] Test in shader browser (preview renders correctly)
- [ ] Test applied on timeline (renders in preview and export)
- [ ] Test project save/reopen (shader and params persist)
- [ ] TypeScript compiles clean (`npx tsc --noEmit`)
