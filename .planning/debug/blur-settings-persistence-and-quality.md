---
status: diagnosed
trigger: "blur radius lost after close/reopen; blur quality bad at radius 1.0"
created: 2026-03-13T00:00:00Z
updated: 2026-03-13T00:01:00Z
---

## Current Focus

hypothesis: Two separate root causes - (1) adjustment-blur source data missing from serialization, (2) fast blur algorithm produces insufficient blur at radius 1.0
test: Trace serialization path for adjustment-blur and analyze blur math at radius 1.0
expecting: (1) Missing adjustment-blur in buildMceProject source mapping. (2) Math produces too few downscale passes or too little downscale at max.
next_action: Confirm both hypotheses with code evidence

## Symptoms

expected: (1) Blur radius persists after project close/reopen. (2) Fast blur at radius 1.0 produces a strong, high-quality blur.
actual: (1) Blur settings are lost on project reopen. (2) At radius 1.0, fast blur quality is "very bad".
errors: No crash errors reported, just visual/data issues.
reproduction: (1) Add blur FX, set radius, save, close, reopen -- radius is reset. (2) Set blur radius to 1.0, observe low quality blur.
started: Since blur FX was implemented.

## Eliminated

(none yet)

## Evidence

- timestamp: 2026-03-13T00:01:00Z
  checked: buildMceProject() in projectStore.ts - source serialization for adjustment-blur
  found: Lines 86-124 serialize source data for every layer type EXCEPT adjustment-blur. The adjustment-color-grade case is the last one (lines 119-124), and there is no corresponding block for adjustment-blur. The source object gets only {type: 'adjustment-blur'} -- the radius field is dropped.
  implication: ROOT CAUSE #1 CONFIRMED. The blur radius is never written to the .mce file. On reload, the deserialization in hydrateFromMce has no data to restore.

- timestamp: 2026-03-13T00:01:30Z
  checked: hydrateFromMce() in projectStore.ts - deserialization for adjustment-blur
  found: Lines 186-198 handle deserialization of source data for all layer types. There is NO case for 'adjustment-blur'. It falls through to the final fallback on line 198: `return ml.source as unknown as LayerSourceData`. This means even if radius were saved, the deserialization path would try to use the raw MceLayerSource object, which uses snake_case field names -- but for adjustment-blur that is moot since radius is never serialized.
  implication: Confirms root cause #1 from both directions. Neither serialization nor deserialization handles adjustment-blur.

- timestamp: 2026-03-13T00:02:00Z
  checked: MceLayerSource interface in types/project.ts
  found: The MceLayerSource interface (lines 62-95) has no `radius` field defined. There is no property for blur radius at all.
  implication: The persistence type also lacks the field. Three-level gap: type definition, serialization, deserialization.

- timestamp: 2026-03-13T00:03:00Z
  checked: applyFastBlur() in fxBlur.ts - algorithm at radius=1.0
  found: At radius=1.0, passes = Math.max(1, Math.min(4, Math.ceil(1.0 * 4))) = 4. Each pass halves dimensions. Starting from e.g. 1920x1080, after 4 passes: 120x68. Then upscaled back to 1920x1080. This is a 16x downsample-upsample which SHOULD produce significant blur. The issue is that bilinear interpolation on this kind of downsample-upsample produces blocky/pixelated results rather than a smooth Gaussian-like blur. This is inherent to the fast blur approach.
  implication: The "bad quality" at radius 1.0 is not about insufficient blur strength, but about the visual character of the blur -- downscale-upscale produces visible blockiness/banding rather than smooth gradients.

- timestamp: 2026-03-13T00:04:00Z
  checked: normalizedToPixelRadius() in fxBlur.ts
  found: At radius=1.0, canvasMaxDim=1920: pixelRadius = Math.round(1.0 * 1.0 * 1920 * 0.05) = Math.round(96) = 96. For HQ blur (StackBlur), 96px radius is substantial and would look good. But this function is NOT used by applyFastBlur -- it is only used by applyHQBlur. The fast blur uses its own internal scaling math (passes-based halving).
  implication: The fast blur does not benefit from normalizedToPixelRadius. Its quality issue is architectural -- the downsample-upsample technique inherently produces low quality at high blur amounts because the intermediate image becomes very small (120x68 for 4 passes on 1920x1080), and upscaling from such a tiny image produces obvious artifacts.

## Resolution

root_cause:
  Issue 1 (Persistence): The adjustment-blur layer's `radius` property is never serialized to the .mce project file. Three gaps exist:
    (a) MceLayerSource interface in types/project.ts has no `radius` field
    (b) buildMceProject() in projectStore.ts has no spread block for adjustment-blur source data (it handles every other layer type but stops at adjustment-color-grade)
    (c) hydrateFromMce() in projectStore.ts has no deserialization case for adjustment-blur (falls through to raw cast fallback)

  Issue 2 (Quality): At radius 1.0 the fast blur algorithm performs 4 downsample passes, reducing a 1920x1080 image to ~120x68, then upscales back. Bilinear interpolation on such extreme downsample/upsample produces blocky, banded artifacts rather than smooth Gaussian blur. This is an inherent limitation of the downsample-upsample technique at high blur radii -- the intermediate resolution is too low to preserve smooth gradients.

fix: (not applied -- diagnosis only)
verification: (not applied -- diagnosis only)
files_changed: []
