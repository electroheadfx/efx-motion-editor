---
phase: quick/261116-inu
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/efx-watercolor/src/brushes/builtinBake.test.ts
  - packages/efx-watercolor/src/brushes/builtinTipMasks.generated.ts
  - packages/efx-watercolor/src/brushes/builtinTips.test.ts
  - packages/efx-watercolor/src/brushes/builtinTips.ts
  - packages/efx-watercolor/src/brushes/deriveMask.test.ts
  - packages/efx-watercolor/src/brushes/deriveMask.ts
  - packages/efx-watercolor/src/brushes/importTip.test.ts
  - packages/efx-watercolor/src/brushes/importTip.ts
  - packages/efx-watercolor/src/brushes/index.ts
  - packages/efx-watercolor/src/brushes/maskRegistry.test.ts
  - packages/efx-watercolor/src/brushes/maskRegistry.ts
  - packages/efx-watercolor/src/brushes/pack.test.ts
  - packages/efx-watercolor/src/brushes/pack.ts
  - packages/efx-watercolor/src/brushes/tips.ts
  - packages/efx-watercolor/src/payload/codec.test.ts
  - packages/efx-watercolor/src/payload/toStudioStroke.ts
  - packages/efx-watercolor/src/playground/Engine.ts
  - packages/efx-watercolor/src/playground/brushBridge.test.ts
  - packages/efx-watercolor/src/playground/brushBridge.ts
  - packages/efx-watercolor/src/playground/brushes.ts
  - packages/efx-watercolor/src/playground/index.ts
  - packages/efx-watercolor/src/playground/params.test.ts
  - packages/efx-watercolor/src/playground/params.ts
  - packages/efx-watercolor/src/playground/shaders.test.ts
  - packages/efx-watercolor/src/playground/shaders.ts
  - app/src-tauri/src/commands/brush_library.rs
  - app/src-tauri/src/commands/efx_paint_media.rs
  - app/src-tauri/src/commands/mod.rs
  - app/src-tauri/src/commands/project.rs
  - app/src-tauri/src/lib.rs
  - app/src-tauri/src/models/project.rs
  - app/src-tauri/src/services/frame_codec.rs
  - app/src-tauri/src/services/script_library.rs
  - app/src/lib/brushLibrary.test.ts
  - app/src/lib/brushLibrary.ts
  - app/src/lib/efxPaintBrushAssets.test.ts
  - app/src/lib/efxPaintBrushAssets.ts
  - app/src/lib/efxPaintBrushImport.test.ts
  - app/src/lib/efxPaintBrushImport.ts
  - app/src/lib/efxPaintBrushSet.test.ts
  - app/src/lib/efxPaintBrushSet.ts
  - app/src/lib/efxPaintPackage.ts
  - app/src/lib/efxPaintPersistence.ts
  - app/src/lib/ipc.ts
  - app/src/lib/noRetiredTextureIds.test.ts
  - app/src/lib/physicPaintBridge.test.ts
  - app/src/lib/physicPaintBridge.ts
  - app/src/stores/aquarelleBrushCatalog.test.ts
  - app/src/stores/aquarelleBrushCatalog.ts
  - app/src/stores/projectStore.efxPaintCutover.test.ts
  - app/src/stores/projectStore.ts
  - app/src/types/physicPaint.ts
  - app/src/types/project.ts
  - app/src/main.tsx
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/physicsPaintStudio.css
  - app/src/components/physic-paint/bridge/usePhysicsPaintParentBridge.ts
  - app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx
  - app/src/components/physic-paint/engine/aquarelleBrushSize.test.ts
  - app/src/components/physic-paint/engine/aquarelleBrushSize.ts
  - app/src/components/physic-paint/engine/aquarelleFootprint.test.ts
  - app/src/components/physic-paint/engine/aquarelleFootprint.ts
  - app/src/components/physic-paint/engine/aquarelleTextureParity.test.ts
  - app/src/components/physic-paint/performance/scriptTimelineCodec.test.ts
  - app/src/components/physic-paint/performance/scriptTimelineCodec.ts
  - app/src/components/physic-paint/performance/studioScriptSnapshotCodec.test.ts
  - app/src/components/physic-paint/performance/studioScriptSnapshotCodec.ts
  - app/src/components/physic-paint/roto/aquarelleLiftErase.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptApplyBake.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.bake.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts
  - app/src/components/physic-paint/snapshot/studioScriptSnapshotController.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx
  - app/src/components/physic-paint/view/PhysicsPaintTextureMenu.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintTextureMenu.tsx
  - app/src/components/physic-paint/view/PhysicsPaintTextureModal.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintTextureModal.tsx
  - app/src/components/physic-paint/view/PhysicsPaintTopBar.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx
  - app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts
  - app/src/components/physic-paint/view/WatercolorTextureStrip.tsx
  - app/src/components/physic-paint/view/aquarelleLiftTipSelection.test.ts
  - app/src/components/physic-paint/view/aquarelleRecordState.reopenTexture.test.ts
  - app/src/components/physic-paint/view/aquarelleRecordState.restore.test.ts
  - app/src/components/physic-paint/view/aquarelleRecordState.test.ts
  - app/src/components/physic-paint/view/aquarelleRecordState.ts
  - app/src/components/physic-paint/view/aquarelleStrokeBand.test.ts
  - app/src/components/physic-paint/view/watercolorMaskChip.test.ts
  - app/src/components/physic-paint/view/watercolorMaskChip.ts
autonomous: false
requirements: []
user_setup: []

estimate:
  tokens: 150000
  raw_tokens: 150000
  tasks: 11
  confidence: low

must_haves:
  truths:
    - "A fresh install lists only Default in the Textures surfaces, and no retired built-in texture id exists anywhere in the tree."
    - "Importing a PNG or JPG writes exactly one 512x512 lossless WebP under ~/.config/efx-motion/brushes/ and the same bytes imported twice yield one catalog row and one file."
    - "Re-importing previously imported bytes selects the existing entry instead of creating a second row."
    - "Saving a project produces no brushPack key and no brushes/ tree; a saved Roto script carries texture id, name and multipliers but no mask bytes."
    - "The library is scanned and decoded once at app start before the first render; opening, closing or creating a project never clears it."
    - "Round at a 1080-tall working canvas with S=512 paints a 512 +/- 1 document-pixel footprint at full pressure, and a 512x512 texture at S=512 projects one texel per document pixel (never 612-620 px)."
    - "The engine size floor is gone: Round at 1080 with S=1 reads 1 and paints a 1 +/- 0.01 px footprint (canonical about -48.9), with no dynamic minimum, no snap-back and no saturation at the old 28.8 px; every legacy canonical (1, 12, 32, 33, 80, 81, 800) still maps to exactly its pre-change engine scale."
    - "The paint size control and the lift/eraser size control are independent: lift keeps 1..80 and is never written by the paint control, and the live eraser's engine params, its cursor ring, the recorded lift stroke and that stroke's replay all read the same lift canonical through one shared selector."
    - "Every stroke snapshots textureRotation in integer degrees; an absent value is 0 and replays raster-identically; live, bake, replay and all four Play modes reproduce a recorded angle; changing the library rotation later never alters a recorded stroke; hundredths exist only inside the AQTL byte body, so 37 degrees round-trips as 37."
    - "AQTL v4 round-trips textureRotation; v1-v3 refuse with no migration; the SNAP container reports v1-v3 as aqtl-retired and accepts v4."
    - "Deleting a texture asks exactly once, removes one catalog row and one file, resets the selection to Default when it was selected, and never touches a project or script file."
    - "A delete or rotation committed in the Studio child realm performs the mutation in the main realm, which publishes the updated catalog before answering; the child's catalog reflects the committed payload before its surface resolves, and a malformed request mutates nothing."
    - "A texture missing on this machine degrades to the response's own procedural tip with exactly one aggregate warning, never blank and never a throw."
  artifacts:
    - "app/src-tauri/src/commands/brush_library.rs"
    - "app/src/lib/brushLibrary.ts"
    - "app/src-tauri/src/services/frame_codec.rs"
    - "packages/efx-watercolor/src/brushes/deriveMask.ts"
    - "packages/efx-watercolor/src/playground/params.ts"
    - "app/src/components/physic-paint/engine/aquarelleBrushSize.ts"
    - "app/src/components/physic-paint/performance/scriptTimelineCodec.ts"
    - "packages/efx-watercolor/src/playground/shaders.ts"
    - "app/src/components/physic-paint/view/PhysicsPaintTextureModal.tsx"
    - "~/.config/efx-motion/brushes/catalog.json (runtime, created on first import)"
    - "~/.config/efx-motion/brushes/<sha256>.webp (runtime, one per imported texture)"
  key_links:
    - from: "app/src/lib/efxPaintBrushImport.ts"
      to: "app/src-tauri/src/commands/brush_library.rs"
      via: "brush_library_write / brush_library_decode / brush_library_scan / brush_library_delete"
    - from: "app/src/lib/brushLibrary.ts"
      to: "app/src/stores/aquarelleBrushCatalog.ts"
      via: "replaceLibraryEntries + libraryRevision + publisher"
    - from: "app/src/stores/aquarelleBrushCatalog.ts"
      to: "packages/efx-watercolor/src/brushes/maskRegistry.ts"
      via: "registerMask / replaceMaskRegistry"
    - from: "app/src/components/physic-paint/view/aquarelleRecordState.ts"
      to: "packages/efx-watercolor/src/playground/brushBridge.ts"
      via: "snapshotAquarelleRecord -> size + textureRotation -> buildBrushForStroke"
    - from: "packages/efx-watercolor/src/playground/Engine.ts"
      to: "packages/efx-watercolor/src/playground/shaders.ts"
      via: "drawStamp / lift bind uTipRotation into stampFS / liftFS"
    - from: "app/src/components/physic-paint/performance/scriptTimelineCodec.ts"
      to: "app/src/components/physic-paint/performance/studioScriptSnapshotCodec.ts"
      via: "AQTL v4 version gate and aqtl-retired mapping"
---

# Quick 261116-inu — Imported-only brush textures from a user-level library, 512x512

<objective>
Make brush textures a machine-level user library: no texture ships with the app, imported masks live in `~/.config/efx-motion/brushes/`, the imported mask is 512x512, the paint size control becomes a true document-pixel diameter (1..512), and a projected-texture rotation rides each stroke.

Purpose: supersede Phase 63's built-in tips and project-embedded masks (D-06/D-09/D-10/D-11/D-12/D-13/D-16) before Phase 64 adds brush responses on top of the old storage. Bind the size control to the engine's real footprint so "512" paints 512 px instead of 612-620 px, and "1" paints 1 px — the engine's `Math.max(0, ...)` size floor is removed (locked decision) so the low end is real rather than saturated at 28.8 px.

Output: a Rust-owned machine library (scan/write/decode/delete/set-rotation), a machine-scoped catalog loaded at boot, a 512 mask edge with procedural tips untouched at 192, a pixel-true paint size split from the lift size, `textureRotation` through the engine and AQTL v4, and the removal of every project and script mask carrier.

Bounded by `SPECS/v2.2.0-brush-tips/GSD-QUICK-PROMPT-04-user-texture-library.md` — its "law to enforce" block, Work list, Guardrails and Acceptance list are authoritative. Where this plan and the spec disagree, the spec wins — with ONE stated precedence: the locked CONTEXT decision "The engine's size floor is removed" (the sixth bullet under `### Brush size control` in `261116-inu-CONTEXT.md`) supersedes the spec guardrail "Do not change the engine size law", which predates that decision. The guardrail's remaining intent is still enforced in full: the mapping for every non-negative canonical is byte-identical to HEAD and every recorded stroke replays identically; the ONLY change to `sizeToEngineScale` is the removal of its `Math.max(0, ...)` floor, which no pre-existing stroke can reach. Task 7's action restates that boundary. Everywhere else the spec wins.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/261116-inu-imported-only-brush-textures-from-a-user/261116-inu-CONTEXT.md
@.planning/quick/261116-inu-imported-only-brush-textures-from-a-user/261116-inu-RESEARCH.md
@SPECS/v2.2.0-brush-tips/GSD-QUICK-PROMPT-04-user-texture-library.md
@.planning/quick/261116-gcn-in-studio-head-top-bar-add-a-2nd-dropdow/261116-gcn-SUMMARY.md
@.planning/quick/261115-oh9-fix-texture-becomes-a-setting-of-the-bru/261115-oh9-SUMMARY.md

Project skills that bind this work: `efx-preact-reactivity` (signals only, idempotent setters, narrow reads, no render-body writes, no per-draw image decode), `developing-preact`, and `efx-async-orchestration` for the single-flight library queue.

## Why 11 tasks

The spec's Work list has six workstreams; five of them are cross-stack (Rust + package + app + UI) and one (tests) is distributed. Forcing that into 3 tasks would put a 512 constant change, a Rust command surface, a binary format bump and a shader change in one unverifiable blob. The count is 10 implementation tasks plus one human-verify checkpoint because each of these is independently verifiable and independently revertible:

1. tracer (mask edge + library write/decode + import)
2. library scan + boot load + machine scope
3. delete the built-ins
4. remove the .mce carrier
5. remove the script mask carrier
6. delete command + confirmation UI
7. px <-> canonical helper (TDD)
8. size split + px controls + cursor + record
9. rotation through brush, AQTL v4 and the Roto script (TDD)
10. GPU tip sampling (mipmaps + rotation uniform) + Textures modal rotation stepper
11. checkpoint:human-verify

## Verified size law (do not re-derive)

Read from the engine at planning time:

- `Engine.radius` — `packages/efx-watercolor/src/playground/Engine.ts:1757` — is
  `(b.size[0] + (b.size[1]-b.size[0])*t) * clamp(1 - speed*b.speedThin, 0.4, 1) * this.sizeMult(widthFactor) * 0.8`.
  At full pressure (`t=1`) and zero speed this is `b.size[1] * sizeMult * 0.8`.
- `Engine.sizeMult` — `Engine.ts:1676` — is `Math.pow(3, (params.size - 0.5) * 2) * scriptScale * widthFactor`.
- `stampFS` — `shaders.ts:35` — computes `p = vUv - uPoint; p.x *= uAspect; q = vec2(dot(p,uAxis), dot(p,vec2(-uAxis.y,uAxis.x))) / uRadius`,
  so `uRadius` is in aspect-corrected UV-height units. A footprint radius `r` is therefore `r * dh` document pixels and the diameter is `S = 2 * r * dh`.
- `workingHeight` is `Engine.dh`, the render grid's height (`Engine.ts:266`), which equals `getPhysicsPaintWorkingSize(...).height` in the Studio (`PhysicsPaintStudio.tsx:1781`). Zoom lives separately in `zoomLevel`, so `dh` is zoom-independent.
- `base = response.size[1] * 0.8`; `mult = (S / 2 / workingHeight) / base`; `params.size = 0.5 + ln(mult)/ln(3)/2`; `canonical = inverse of sizeToEngineScale(params.size)`.
- `sizeToEngineScale` — `packages/efx-watercolor/src/playground/params.ts:60-65` — is module PRIVATE today (Task 7 exports it; its body changes by exactly one line, the clamp removal below) and not injective on 32..80 (both return 1.0). Its inverse takes `canonical = scale * 32` for `scale <= 1` and `canonical = 80 + (scale-1)/(SIZE_SCALE_AT_MAX-1) * (800-80)` for `scale > 1`.

### Ceiling gate — checked numerically, provably closed

`SIZE_SCALE_HARD_MAX = 4` (`params.ts:56`) means `sizeMult` tops out at `3^((4-0.5)*2) = 3^7 = 2187`. The worst shipped preset is the smallest `size[1]`: Rigger `0.0065` (`packages/efx-watercolor/src/playground/brushes.ts:242`), i.e. `base = 0.0052`.

At `S = 512`, `workingHeight = 1080`:
`mult = (512/2/1080) / 0.0052 = 0.237037 / 0.0052 = 45.58`.
`scale = 0.5 + ln(45.58)/ln(3)/2 = 0.5 + 3.8193/2.1972 = 2.238` — well under 4.
`canonical = 80 + (2.238-1)/(2.04795-1) * 720 = 80 + 850.6 = 930.6` — above the 800 track max, not clamped (locked decision 2).

Round (`BASE.size = [0.011, 0.05]`, `brushes.ts:179-180`, `base = 0.04`) at the same settings:
`mult = 0.237037/0.04 = 5.926`; `scale = 0.5 + 1.7796/2.1972 = 1.310`; `canonical = 80 + (0.310/1.04795)*720 = 293.1`.

The spec's "if the canonical inverse cannot be expressed inside the engine ceiling, stop and report" gate therefore does NOT fire. Do not stop.

### Floor — REMOVED by locked decision, not saturated

`sizeToEngineScale` used to floor at 0 (`Math.max(0, sizePx / 32)` for `sizePx <= 32` at `packages/efx-watercolor/src/playground/params.ts:61`), which floored `sizeMult` at `3^-1 = 1/3` and stopped the footprint shrinking at `canonical <= 0`. That is the OLD behaviour: Round at `workingHeight = 1080` bottomed out at `2 * 0.05 * 0.8 * (1/3) * 1080 = 28.8 px`, Rigger at `2 * 0.0065 * 0.8 * (1/3) * 1080 = 3.74 px`. Under it, `S = 1` was expressible as a stored canonical (a negative value) but never as a footprint.

The locked decision in `261116-inu-CONTEXT.md` ("Brush size control — the engine's size floor is removed") deletes the clamp:

- `params.ts:61`: `if (sizePx <= 32) return Math.max(0, sizePx / 32)` becomes `if (sizePx <= 32) return sizePx / 32`. One line; nothing else in the function or the module changes.

That clamp removal is what makes 1 px reachable. Round at 1080 needs `mult = 1 / (2 * 0.04 * 1080) = 0.011574` -> `params.size = 0.5 + ln(0.011574)/(ln 3 * 2) = -1.529` -> `canonical = -1.529 * 32 = -48.9`. Feeding `-48.9` back through the modified law reproduces `1.00 px`, so display and paint agree all the way down.

Replay safety — why this is byte-identical for every existing document:

- Every pre-existing recorded stroke carries `canonical >= 1`: the old control's floor was 1 and `strokeSettingsModel.ts` offered only 1..800.
- For every `sizePx >= 0`, `Math.max(0, sizePx / 32)` and `sizePx / 32` are the same number. The two expressions differ ONLY for `sizePx < 0`, a region no recorded stroke can occupy.
- `Math.max(0, ...)` was the only source of a sub-`1/3` `sizeMult`: sub-`1/3` requires `params.size < 0`, and the clamp made that unreachable. No recorded stroke can carry a value that this change perturbs.

The law this plan implements: `canonicalFromDiameter` returns the law value **unclamped** (negative and >800 are legal); `diameterFromCanonical` mirrors the engine through the real, MODIFIED `sizeToEngineScale`, so the displayed number is always the footprint the engine will actually paint — including below the old 28.8 px saturation point — and the stored canonical is never clamped. `sizeToEngineScale` must stay otherwise byte-for-byte identical: the `32..80` flat band returning 1 and the `80..800` band with its `SIZE_SCALE_HARD_MAX` clamp are untouched, as are the constants and the non-finite guard. Task 7 owns the single-line clamp removal and its guard test; no other task edits the function.
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: One imported 512x512 texture lands in the machine library and paints — end to end</name>
  <files>
    packages/efx-watercolor/src/brushes/deriveMask.ts
    packages/efx-watercolor/src/brushes/deriveMask.test.ts
    packages/efx-watercolor/src/brushes/importTip.ts
    packages/efx-watercolor/src/brushes/importTip.test.ts
    packages/efx-watercolor/src/brushes/index.ts
    app/src-tauri/src/services/frame_codec.rs
    app/src-tauri/src/services/script_library.rs
    app/src-tauri/src/commands/brush_library.rs
    app/src-tauri/src/commands/mod.rs
    app/src-tauri/src/commands/efx_paint_media.rs
    app/src-tauri/src/lib.rs
    app/src/lib/ipc.ts
    app/src/lib/efxPaintBrushImport.ts
    app/src/lib/efxPaintBrushImport.test.ts
    app/src/stores/aquarelleBrushCatalog.ts
    app/src/types/physicPaint.ts
    app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts
  </files>
  <behavior>
    - Rust: `brush_library_write` with exactly 262,144 mask bytes returns a `wc/custom-<12 hex>` id and a 64-hex digest; the file `<root>/<digest>.webp` is a 512x512 lossless WebP whose alpha equals the input mask byte for byte.
    - Rust: a body that is not exactly 262,144 bytes is refused before any encode; a 191x191 or 193x193 WebP is refused `wrong-size` on decode.
    - Rust: writing the same bytes twice returns the same entry, leaves one file, and rewrites no catalog row; a digest that already holds different bytes is refused.
    - Rust: `frame_codec` round-trips a 512x512 mask byte-identically and its error copy names 512x512.
    - TS: the import handler writes through the library seam only — no `rememberBrushAsset`, no `projectStore.markDirty()`, no package-relative asset path.
    - TS: importing the same mask twice leaves exactly one catalog row with one id.
  </behavior>
  <action>
    This is the architectural spine: one imported texture travels the whole stack and paints. Everything later expands from it.

    Package mask edge (D-1 of the spec):
    - In `packages/efx-watercolor/src/brushes/deriveMask.ts` add `export const TIP_MASK_EDGE = 512` and redefine `TIP_MASK_BYTES = TIP_MASK_EDGE * TIP_MASK_EDGE`; make `deriveMask`'s default `pixelCount` `TIP_MASK_EDGE * TIP_MASK_EDGE`. Drop the now-unused `TIP_SIZE` import. Refresh the module header comment (line 2 still says "192×192 brush-tip mask") and the two constant docs that still say `TIP_SIZE` squared. `TIP_SIZE` in `packages/efx-watercolor/src/playground/brushes.ts:87` stays 192 — procedural tips are untouched; do not raise it.
    - In `packages/efx-watercolor/src/brushes/importTip.ts` set `TIP_PIXELS = TIP_MASK_EDGE * TIP_MASK_EDGE`, size the offscreen canvas from `TIP_MASK_EDGE`, and gate `rgba.length !== TIP_PIXELS * 4`. Keep the existing guards (`IMPORT_TIP_MAX_BYTES`, `IMPORT_TIP_MAX_PIXELS`, magic sniff, dimension read before decode) and the single-flight chain. Decode-once discipline is a project rule: the decoded source is drawn once and released.
    - `packages/efx-watercolor/src/brushes/index.ts` already re-exports `deriveMask`; verify `TIP_MASK_EDGE` reaches `@efxlab/efx-watercolor`.
    - Pin the split in `deriveMask.test.ts`: `TIP_MASK_BYTES === TIP_MASK_EDGE ** 2 === 262144` and `TIP_SIZE === 192`, so nothing can quietly assume the two edges are the same number again.

    Rust mask edge:
    - `app/src-tauri/src/services/frame_codec.rs`: `BRUSH_MASK_EDGE: u32 = 512`, `BRUSH_MASK_BYTES = 262_144`, error copy `brush mask must be exactly 262144 bytes (512x512); got {}`, and both decode dimension gates compare against `BRUSH_MASK_EDGE`. Keep the declared-dimension read BEFORE any pixel allocation — that gate is the decompression-bomb control.
    - `app/src-tauri/src/commands/efx_paint_media.rs`: the response width/height and the comments that say 192 move to the constant; no wire-shape change.

    Rust library commands — new `app/src-tauri/src/commands/brush_library.rs`:
    - Root: `PathBuf::from(std::env::var("HOME").unwrap_or_else(|_| "/tmp".into())).join(".config/efx-motion/brushes")`, mirroring `app/src-tauri/src/commands/config.rs:28-31`. Derive it in Rust only; no command ever takes a path from the renderer.
    - Digest validation: a private `fn valid_digest(s: &str) -> bool` accepting exactly 64 lower-case hex chars. Every digest crossing the boundary is validated before it becomes a filename or a map key. Filenames are always `format!("{digest}.webp")` inside the root.
    - `catalog.json` shape: `{ "version": 1, "entries": [BrushLibraryEntry] }` with `BrushLibraryEntry { id, name, digest, textureRotation, createdAt, tip, aspect, rotation, sizeCurve, scatter, capacity, grain, wetRound }`. `textureRotation` is degrees; `rotation` is the D-08 tip-multiplier — these are different fields and the names must not be conflated anywhere.
    - `brush_library_write`: JSON body `{ name, maskBase64 }`. Decode base64 via the existing `pub(crate) decode_base64` (`app/src-tauri/src/services/script_library.rs:3137`), gate the length at `BRUSH_MASK_BYTES`, encode through `encode_mask_webp`, digest with `digest_bytes` (`app/src-tauri/src/services/efx_paint_media.rs:276`), then: `reject_symlink` the target; if it exists, read it and require `digest_bytes(existing) == digest` (else refuse with a `digest-collision` message); otherwise write atomically. Upsert the catalog row by digest (id = `wc/custom-` + first 12 hex chars of the digest) and rewrite `catalog.json` atomically. Return the entry.
    - `brush_library_decode`: JSON arg `{ digest }`; validate the digest, read `<root>/<digest>.webp` through the declared-dimension gate, return `{ maskBase64, width, height }`.
    - Serialize write/decode/rotation/delete behind one `static OnceLock<Mutex<()>>` so two imports cannot interleave a catalog rewrite. Commands stay `#[tauri::command(async)]`.
    - Atomic writer: do NOT add a third copy. Promote the existing helper in `app/src-tauri/src/services/script_library.rs` to `pub(crate) fn atomic_write_bytes` and `pub(crate) fn reject_symlink` (a two-word visibility diff — the smallest blast radius on a heavily tested shipped module; a move to a new `fs_atomic` module would churn thousands of lines of unrelated test imports for no behavioural gain). Record that choice in the summary.
    - Register both commands in `app/src-tauri/src/commands/mod.rs` and in the `generate_handler!` list near `app/src-tauri/src/lib.rs:972`. App commands need no capability entry (confirmed: `app/src-tauri/capabilities/` lists none of the sibling brush commands).

    Renderer seam:
    - `app/src/lib/ipc.ts`: add `ipcBrushLibraryWrite`, `ipcBrushLibraryDecode` following the existing raw-body/JSON conventions (see `ipcEfxPaintEncodeBrushMask` / `ipcEfxPaintDecodeBrushMask` at lines 697 and 778).
    - ROW → TIP MAPPING (one function, added here and reused by Task 2): `app/src/stores/aquarelleBrushCatalog.ts` exports `libraryRowToTip(row: BrushLibraryEntry): AquarelleTip`. `BrushLibraryEntry` carries no `category` and carries three library-only fields (`digest`, `textureRotation`, `createdAt`), while `AquarelleTip` REQUIRES `category` and `isCustomTipWire` validates an exact member set (`AQUARELLE_TIP_MEMBER_KEYS`, `app/src/types/physicPaint.ts:2949`). The mapper therefore sets `category: 'custom'` and copies exactly the twelve tip members (`id`, `category`, `name`, the eight multipliers) — it never copies `digest`, `textureRotation` or `createdAt` into a tip, and there is no second place in the tree that builds a tip from a row.
    - `app/src/lib/efxPaintBrushImport.ts`: retarget the whole handler. Replace the encode + `buildBrushAssetRelativePath` + `rememberBrushAsset` + `freshCustomId` legs with one `ipcBrushLibraryWrite({ name: fileName, maskBase64 })` call, then `batch(() => { registerMask(row.id, mask); upsertLibraryRow(row); })` where the row carries `{ tip: libraryRowToTip(row), digest: row.digest, textureRotation: row.textureRotation }`, then publish the catalog and answer with the entry. Remove `projectStore.markDirty()` — an import is no longer a project mutation. Delete `freshCustomId` and the file-header comment block that describes per-import id minting; replace it with the content-addressed identity law.
    - `app/src/stores/aquarelleBrushCatalog.ts`: add an upsert setter keyed by id (replace the row when the id already exists, compare-then-write, bump `brushCatalogGeneration` once) that stores the tip AND its `digest` + `textureRotation`. Re-importing the same bytes must select the existing row, not append a second one.
    - `app/src/lib/efxPaintBrushImport.test.ts` (this task's own verify target): retarget the assertions that today read the project asset cache (`brushAssetBytes`, `pendingBrushAssets`, `resetBrushAssets` at lines 31/52/61/120-132) onto the library seam — the mock returns a `BrushLibraryEntry`, the test asserts one row and one registered mask, and no `projectStore.markDirty()` call happens.

    Keep the two remaining 192-shaped guards consistent while this task lands, so no intermediate state breaks Save Script: `app/src/types/physicPaint.ts:3000` (`isTipSizedBrushWebp`) and `physicsPaintRotoScriptSchema.ts:548` (`decodeScriptMaskDataUrl`) must compare against `TIP_MASK_EDGE`, not `TIP_SIZE`. Both surfaces are deleted outright in Tasks 4 and 5 — this is a one-line retarget each, not new machinery.

    Do not touch: `TIP_SIZE`, any procedural preset, the engine size law (Task 7 owns its single-line clamp removal — this task edits no part of `params.ts`), or any existing recorded stroke.
  </action>
  <verify>
    <automated>cd app/src-tauri &amp;&amp; cargo test brush_library -- --nocapture</automated>
    <automated>cd app/src-tauri &amp;&amp; cargo test frame_codec -- --nocapture</automated>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/lib/efxPaintBrushImport.test.ts</automated>
    <automated>cd packages/efx-watercolor &amp;&amp; pnpm exec vitest run src/brushes/deriveMask.test.ts src/brushes/importTip.test.ts</automated>
  </verify>
  <done>One 262,144-byte mask imported through the renderer produces a 512x512 lossless `<digest>.webp` under `~/.config/efx-motion/brushes/`, one catalog row, and a registered mask; the same bytes twice produce one row and one file; every wrong-size and digest-collision case is refused with a named error; `TIP_SIZE` is still 192.</done>
</task>

<task type="auto">
  <name>Task 2: Scan the library at app start and make the catalog machine-scoped</name>
  <files>
    app/src-tauri/src/commands/brush_library.rs
    app/src-tauri/src/lib.rs
    app/src/lib/ipc.ts
    app/src/lib/brushLibrary.ts
    app/src/lib/brushLibrary.test.ts
    app/src/lib/efxPaintBrushImport.ts
    app/src/stores/aquarelleBrushCatalog.ts
    app/src/stores/aquarelleBrushCatalog.test.ts
    app/src/stores/projectStore.ts
    app/src/lib/physicPaintBridge.ts
    app/src/lib/physicPaintBridge.test.ts
    app/src/types/physicPaint.ts
    app/src/main.tsx
    app/src/components/physic-paint/bridge/usePhysicsPaintParentBridge.ts
  </files>
  <action>
    The catalog stops belonging to a project and becomes a machine resource loaded once before anything can replay.

    Rust: add `brush_library_scan` to `app/src-tauri/src/commands/brush_library.rs` returning `{ entries, unavailable }`. It tolerates a missing `catalog.json` (empty list), drops malformed rows individually, and reports an entry whose file is missing, symlinked or not a 512x512 WebP in `unavailable` instead of failing the scan. Bounded parse: no unbounded allocation from a hostile catalog, and no panic on any input.

    **Register it.** Add `commands::brush_library::brush_library_scan` to the `generate_handler![...]` list in `app/src-tauri/src/lib.rs` (the `commands::brush_library` module was already declared in `commands/mod.rs` by Task 1). This command is the ONLY boot path for the whole library: if the handler is not registered, `invoke` rejects, `loadBrushLibrary()` resolves with an empty catalog, and the phase's central truth ("scanned and decoded once at app start") fails silently — `cargo test` still compiles the function, so no automated gate catches it. Register every later library command the same way in the task that introduces it.

    Renderer orchestration — new `app/src/lib/brushLibrary.ts` (this is the one place the renderer talks to the library seam):
    - `loadBrushLibrary()`: `brush_library_scan`, then per available entry `brush_library_decode`; register every decoded mask, `replaceLibraryEntries` with `{ tip: libraryRowToTip(row), digest: row.digest, textureRotation: row.textureRotation }`, replace the unavailable set, bump `libraryRevision` once, publish. A per-entry decode failure adds that id to `unavailable` and continues — fail-closed per entry, never a throw. Return a small result `{ loaded, unavailable }`.
    - `writeBrushTexture`, `deleteBrushTexture`, `setBrushTextureRotation` live here too (Tasks 1/6/10 wire them); each is single-flight through one promise chain, mirroring `importTip`'s queue idiom, and each bumps `libraryRevision` and publishes exactly once.

    Store — `app/src/stores/aquarelleBrushCatalog.ts`:
    - Add `libraryRevision` (a monotonically increasing signal, bumped once per real library mutation) and `replaceLibraryEntries(rows, unavailable)` (replace-only, compare-then-write). A row is `{ tip, digest, textureRotation }`, built through Task 1's `libraryRowToTip` mapper for the tip half — this store is the ONLY place a `AquarelleTip` is derived from a library row.
    - Expose the two library-only fields for Tasks 6/9/10: `libraryRowFor(id): { digest: string; textureRotation: number } | null` (a pure read over the current rows) and keep the tip list that the surfaces render (`listAquarelleBrushTips()` returns Default-less tips only — the Default chip is the strip's own `null` entry, never a catalog row).
    - `applyBrushCatalogPayload` validates masks against `TIP_MASK_BYTES` and applies `replaceLibraryEntries`. It MUST keep its `...BUILTIN_TIP_MASKS` registry seed line until Task 3 lands: dropping it here would strip the built-in masks out of the registry while their chips are still listed, and the built-in chips would paint blank for one task. Task 3 removes both the export and that line together.
    - Remove the project-close reset path from the brush state: `closeProject` (`app/src/stores/projectStore.ts:1248`) must no longer call `resetAquarelleBrushState()`. Delete that function; nothing project-scoped survives. Update the two test files that assert the old law (`app/src/stores/aquarelleBrushCatalog.test.ts:648,683,688,722` and `app/src/lib/physicPaintBridge.test.ts:8676`) to assert instead that the entries, masks and `libraryRevision` survive a project close.

    Payload — `app/src/lib/physicPaintBridge.ts:3256` and `app/src/types/physicPaint.ts`:
    - Replace the project-scoped `contextId` with `libraryRevision` (a non-negative integer) in `PhysicPaintBrushCatalogPayload` and its validator. The Studio's pull-on-mount (`usePhysicsPaintParentBridge.ts:218-233`) needs no change: the guard's name and the apply path stay the same, so a Studio re-booted by a layer switch always accepts the current snapshot.
    - Extend `PhysicPaintBrushCatalogEntry` to `{ tip, digest, textureRotation, maskBase64?, webpBase64? }`. `digest` is the library row's content address (64 lower-case hex) and `textureRotation` is integer DEGREES in -180..180. Both are REQUIRED on the wire: `isPhysicPaintBrushCatalogEntry` adds them to `hasOnlyKeys` and validates each, so a row without them refuses the payload whole. This is the only path by which the Studio child realm ever learns a row's digest and rotation — without it Tasks 6 and 10 have nothing to name.
    - `buildBrushCatalogPayload(libraryRevision)` in `aquarelleBrushCatalog.ts` emits `digest` and `textureRotation` per row alongside the existing mask/WebP legs.
    - Keep the `brushCatalogSynced` flag semantics; a machine catalog is synced after boot.
    - Retarget the payload fixtures and guards in `app/src/lib/physicPaintBridge.test.ts` (the `contextId` fixtures at ~8211-8344 and the pushed-payload read at ~8427-8433) to `libraryRevision` + `digest` + `textureRotation`; the `webpBase64` assertions stay until Task 4 removes that leg.

    Boot order — `app/src/main.tsx:107-111`: inside the existing `initTempProjectDir().then(async () => { ... })`, call `await loadBrushLibrary()` immediately after `await paintStore.initFromPreferences()` and BEFORE `render(<App />, root)`. The library must be registered before any project open can replay a stroke. Do not block rendering on a failure: `loadBrushLibrary` resolves with its result and never rejects.

    Do not: load the library from a child realm, clear it on project close/New Project/project switch, or reuse `projectContextId` as the staleness key.
  </action>
  <verify>
    <automated>cd app/src-tauri &amp;&amp; cargo test brush_library -- --nocapture</automated>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/lib/brushLibrary.test.ts src/stores/aquarelleBrushCatalog.test.ts</automated>
  </verify>
  <done>`loadBrushLibrary()` populates the catalog, the registry and `libraryRevision` from a mocked scan; every catalog entry carries its row's `digest` and `textureRotation` and a payload missing either is refused whole; `closeProject` leaves every library entry, mask and revision intact; the payload validator accepts a `libraryRevision` payload and rejects a legacy `contextId` one; `main.tsx` awaits the load before `render`.</done>
</task>

<task type="auto">
  <name>Task 3: Delete the three built-in textures</name>
  <files>
    packages/efx-watercolor/src/brushes/builtinTips.ts
    packages/efx-watercolor/src/brushes/builtinTipMasks.generated.ts
    packages/efx-watercolor/src/brushes/builtinTips.test.ts
    packages/efx-watercolor/src/brushes/builtinBake.test.ts
    packages/efx-watercolor/src/brushes/index.ts
    packages/efx-watercolor/src/brushes/maskRegistry.ts
    packages/efx-watercolor/src/brushes/maskRegistry.test.ts
    packages/efx-watercolor/src/playground/brushBridge.test.ts
    packages/efx-watercolor/src/payload/codec.test.ts
    app/src/components/physic-paint/view/WatercolorTextureStrip.tsx
    app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts
    app/src/components/physic-paint/view/PhysicsPaintTextureMenu.tsx
    app/src/components/physic-paint/view/PhysicsPaintTextureMenu.test.ts
    app/src/components/physic-paint/view/PhysicsPaintTextureModal.tsx
    app/src/components/physic-paint/view/aquarelleStrokeBand.test.ts
    app/src/components/physic-paint/view/aquarelleRecordState.test.ts
    app/src/components/physic-paint/view/aquarelleRecordState.reopenTexture.test.ts
    app/src/components/physic-paint/engine/aquarelleTextureParity.test.ts
    app/src/stores/aquarelleBrushCatalog.ts
    app/src/stores/aquarelleBrushCatalog.test.ts
    app/src/lib/efxPaintBrushSet.ts
    app/src/components/physic-paint/roto/aquarelleLiftErase.test.ts
    app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.test.ts
    app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.test.ts
    app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.test.ts
    app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts
    app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.bake.test.ts
    app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptApplyBake.test.ts
    app/src/components/physic-paint/view/aquarelleLiftTipSelection.test.ts
  </files>
  <action>
    Import becomes the only way to obtain a texture; the Textures surfaces list Default plus library entries and nothing else.

    Delete the files: `builtinTips.ts`, `builtinTipMasks.generated.ts`, `builtinTips.test.ts`, `builtinBake.test.ts`. Remove their exports from `packages/efx-watercolor/src/brushes/index.ts`.

    Every importer of the deleted exports is owned by THIS task, with one planned exception. The owned set, all verified by grep at planning time: `app/src/components/physic-paint/view/WatercolorTextureStrip.tsx` (the component both Textures surfaces render), `app/src/stores/aquarelleBrushCatalog.ts`, `packages/efx-watercolor/src/brushes/maskRegistry.ts`, plus the tests `WatercolorBrushLibrary.test.ts`, `PhysicsPaintTextureMenu.test.ts`, `aquarelleStrokeBand.test.ts`, `aquarelleRecordState.test.ts`, `aquarelleRecordState.reopenTexture.test.ts`, `aquarelleTextureParity.test.ts`, `aquarelleLiftTipSelection.test.ts`, `aquarelleBrushCatalog.test.ts`, the five `roto/*` tests, `physicsPaintRotoPlayScriptApplyBake.test.ts` (drop its `BUILTIN_TIPS: []` package mock key), `packages/efx-watercolor/src/playground/brushBridge.test.ts`, `packages/efx-watercolor/src/payload/codec.test.ts` (retarget its sample `wc/builtin-chalk` id) and `maskRegistry.test.ts`.

    Cross-task ordering — `app/src/lib/efxPaintBrushSet.ts`: this module also imports `BUILTIN_TIPS` (line 43) to build `BUILTIN_TIP_IDS`, a refusal set that exists only to stop a project entry shadowing a built-in id. With no built-ins left that refusal is meaningless, so make the minimal decoupling HERE: delete the `BUILTIN_TIPS` import, the `BUILTIN_TIP_IDS` set and the built-in-id refusal branches. The module itself (and its test) is deleted whole in Task 4 — do not delete it now, and do not carry the retired ids forward as literals. Without this edit `aquarelleBrushCatalog.test.ts` cannot even import `efxPaintBrushSet.ts` at this task's boundary.

    `packages/efx-watercolor/src/brushes/maskRegistry.ts`: remove `builtinMasksById`, the module-load seeding loop, and all reserved-id machinery. `registerMask` keeps its non-empty-id + exact `TIP_MASK_BYTES` checks. `resetMaskRegistry()` becomes an empty replacement (`replaceMaskRegistry([])`) — do not leave a comment claiming three built-ins always resolve. Update the header comment to the machine-library law.

    `app/src/stores/aquarelleBrushCatalog.ts`: stop seeding `BUILTIN_TIP_MASKS` in `applyBrushCatalogPayload`, drop the import, and delete `resetAquarelleBrushState`'s remaining built-in assumptions. The mask list starts empty and is filled from the payload / library.

    Surfaces — `WatercolorTextureStrip.tsx` is the ONE component both surfaces render, so the chip law lives there and nowhere else:
    - `textureEntries(imports, unavailableIds)` becomes `[...{ id: null, name: 'Default', unavailable: false }, ...imports.map(...)]` — Default plus `customBrushTips` only. Delete the `BUILTIN_TIPS` import and the built-in leg.
    - Refresh the module header comment: no compile-time built-ins, the order is Default then the machine library's rows, and a picked texture is a library row rather than an "import".
    - `PhysicsPaintTextureMenu.tsx` and `PhysicsPaintTextureModal.tsx` inherit that list; remove any built-in copy, grouping or leftover figure. No retired-id table, no special case — a stroke that references a retired id resolves as a generic missing texture.

    Tests: retarget every hardcoded retired id in the files listed above to a `wc/custom-<hex>` id (or to `null`) without changing what each test proves. Where a test asserted built-in seeding or built-in ordering, assert the Default-plus-library behaviour instead.

    Do NOT add the tree-wide "no retired prefix" scan in this task: at this boundary the prefix legitimately survives in production comments and test fixtures that later tasks own (`physicsPaintRotoScriptLibrary.ts` in Task 5; `aquarelleRecordState.ts` and `aquarelleFootprint.test.ts` in Task 8; `scriptTimelineCodec.test.ts` and `aquarelleRecordState.restore.test.ts` in Task 9; `watercolorMaskChip.test.ts` in Task 10). Task 10 adds that scan as the last retargeting task and pins it there, green at its own boundary.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/stores/aquarelleBrushCatalog.test.ts src/components/physic-paint/view/PhysicsPaintTextureModal.test.ts src/components/physic-paint/view/PhysicsPaintTextureMenu.test.ts src/components/physic-paint/view/WatercolorBrushLibrary.test.ts src/components/physic-paint/view/aquarelleLiftTipSelection.test.ts</automated>
    <automated>cd packages/efx-watercolor &amp;&amp; pnpm exec vitest run src/brushes src/playground/brushBridge.test.ts src/payload/codec.test.ts</automated>
  </verify>
  <done>Fresh state lists Default only in the shared strip and in both Textures surfaces; the mask registry starts empty and `resetMaskRegistry()` leaves it empty; no module imports the deleted exports (`efxPaintBrushSet.ts` is decoupled here and deleted in Task 4); the tree-wide retired-prefix scan is deferred to Task 10, where it is green at its own boundary.</done>
</task>

<task type="auto">
  <name>Task 4: Remove the .mce brush carrier and the per-project asset bookkeeping</name>
  <files>
    app/src/types/project.ts
    app/src/types/physicPaint.ts
    app/src/lib/efxPaintBrushSet.ts
    app/src/lib/efxPaintBrushSet.test.ts
    app/src/lib/efxPaintBrushAssets.ts
    app/src/lib/efxPaintBrushAssets.test.ts
    app/src/lib/efxPaintPersistence.ts
    app/src/lib/physicPaintBridge.test.ts
    app/src/stores/aquarelleBrushCatalog.ts
    app/src/stores/aquarelleBrushCatalog.test.ts
    app/src/stores/projectStore.ts
    app/src/stores/projectStore.efxPaintCutover.test.ts
    app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts
    app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts
    app/src-tauri/src/models/project.rs
    app/src-tauri/src/commands/project.rs
    app/src-tauri/src/services/script_library.rs
    packages/efx-watercolor/src/brushes/tips.ts
    packages/efx-watercolor/src/brushes/pack.ts
    packages/efx-watercolor/src/brushes/pack.test.ts
    app/src/lib/efxPaintPackage.ts
  </files>
  <action>
    A project stops carrying textures. Clean break: no migration, no dual reader, no compatibility shim. serde does not deny unknown fields, so an old `.mce`'s `brushPack` key is simply ignored, and old `brushes/` files on disk are never deleted.

    TypeScript — delete the modules AND every importer of them. This task owns each one, verified by grep at planning time:
    - `app/src/types/project.ts:65-69`: delete `brushPack` and its type.
    - `app/src/lib/efxPaintBrushSet.ts`, `app/src/lib/efxPaintBrushSet.test.ts`, `app/src/lib/efxPaintBrushAssets.ts` and `app/src/lib/efxPaintBrushAssets.test.ts` are deleted outright. Every remaining importer is cleaned here:
      · `app/src/stores/aquarelleBrushCatalog.ts` (Task 3 already removed the `BUILTIN_TIPS` leg), `app/src/lib/efxPaintBrushImport.ts` (Task 1), `app/src/lib/efxPaintPackage.ts`;
      · `app/src/lib/efxPaintPersistence.ts` — the save transaction's `brushAssets` leg: delete `markBrushAssetsWritten` / `EfxPaintBrushAssetWrite` imports, the `brushAssets` input field (~1041), the prepare loop (~1181-1198), the write loop (~1310) and the `markBrushAssetsWritten` call (~1364). This is the "pendingBrushAssets leg" the spec names;
      · `app/src/stores/projectStore.ts` — drop the `pendingBrushAssets` import (~54) and the `brushAssets: pendingBrushAssets(packageDir)` field (~261);
      · `app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts` — drop the `brushAssetBytes` / `brushAssetDigestFromPath` import (~29) and the `webp` lookup built from `tip.asset` (~354-355). The rest of that file is Task 5's;
      · `app/src/lib/physicPaintBridge.test.ts` — drop the `efxPaintBrushAssets` dynamic imports and `brushAssetBytes` assertions (~8403, 8436, 8469, 8480);
      · `app/src/stores/projectStore.efxPaintCutover.test.ts` — drop the `resetBrushAssets` / `brushAssetBytes` / `pendingBrushAssets` imports and the assertions built on them (~39, 1420, 1452, 1503-1505);
      · `app/src/stores/aquarelleBrushCatalog.test.ts` — the `efxPaintBrushAssets` and `efxPaintBrushSet` legs go with the modules.
    - `app/src/stores/aquarelleBrushCatalog.ts`: also remove `buildProjectBrushPack`, `applyProjectBrushSet`, `loadProjectBrushSet`, and the WebP-bytes leg of the catalog payload. Keep: rows (tip + digest + textureRotation), masks, `libraryRevision`, the publisher, `brushCatalogSynced`, and the `unavailableTipIds` set.
      · **`unavailableTipIds` SURVIVES — scope the removal to the package-read leg only.** The spec's Work 3 requires "a corrupt entry is listed but unavailable", and the set is now library-driven: Task 2's `replaceLibraryEntries(rows, unavailable)` fills it from `brush_library_scan`'s per-entry failures, Task 6 adds a just-deleted id to it, and `app/src/components/physic-paint/view/WatercolorTextureStrip.tsx:127` reads it to render `data-unavailable`. What dies here is only the bookkeeping that existed to describe a *package* read (the `ProjectBrushSet` failure leg and anything feeding the set from a `.mce`). Do NOT delete the signal, the payload field or the strip's reader.
    - `app/src/stores/projectStore.ts`: remove the three remaining call sites — `buildProjectBrushPack()` in the save composition (~454), `loadProjectBrushSet(...)` (~1164) and `applyProjectBrushSet(...)` (~1189) — and the two imports. An open no longer decodes anything brush-related; a save no longer writes a pack.
    - `packages/efx-watercolor/src/brushes/tips.ts`: remove the `asset?: string` field from `AquarelleTip` and every reader/writer (`grep` for `.asset` across `app/src` and the package first; that enumeration is part of this task).
    - `packages/efx-watercolor/src/brushes/pack.ts` — CORRECTION to the earlier wording: the pack module is NOT removed wholesale. `buildBrushPackSnapshot` / `parseBrushPackSnapshot` stay, because the Roto SCRIPT carrier still uses them (`physicsPaintRotoScriptSchema.ts:196,416`; Task 5 trims that carrier's mask bytes next). This task removes only the PROJECT carrier: delete `TipCarrierMode` and the mode parameter (one carrier remains, so a mode argument is dead API), delete the `'package'` branch, `isBrushAssetRef` and the asset-ref acceptance in `asTipRecord`. Retarget EVERY `asTipRecord` call site to the single-argument form — not just the schema's: `physicsPaintRotoScriptSchema.ts:196,416`, `app/src/types/physicPaint.ts:2985` (`asTipRecord(value, 'package')`), `app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts:435` (`asTipRecord(raw, 'script')`) and `packages/efx-watercolor/src/brushes/pack.test.ts:496-499`. `pack.test.ts` loses the package-mode and asset-ref cases; its script-mode and round-trip cases stay.

    Wire guards — `app/src/types/physicPaint.ts`: drop `'asset'` from `AQUARELLE_TIP_MEMBER_KEYS`, drop `webpBase64` from `PhysicPaintBrushCatalogEntry` and `isPhysicPaintBrushCatalogEntry`, and delete `isTipSizedBrushWebp` with its call site. The entry keeps `{ tip, digest, textureRotation, maskBase64? }`. There is no WebP bytes leg left to validate — the library owns the files.

    Rust:
    - `app/src-tauri/src/models/project.rs:69-70`: delete `brush_pack` and `MceBrushPackSnapshot`, plus the tests at ~529-588. `app/src-tauri/src/commands/project.rs:81`: delete the default.
    - `app/src-tauri/src/services/script_library.rs:2583` and its `validate_brush_pack`: the SCRIPT pack stays (Task 5 trims it) — do not remove the script-side validation here. If the same validator also validated the `.mce` pack, split it so only the `.mce` leg dies.

    Do not delete anything under `~/.config/efx-motion/brushes/`, and do not delete an old package's `brushes/` tree — that is user data.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/lib/efxPaintPersistence.test.ts src/stores/aquarelleBrushCatalog.test.ts src/lib/physicPaintBridge.test.ts</automated>
    <automated>cd packages/efx-watercolor &amp;&amp; pnpm exec vitest run src/brushes/pack.test.ts</automated>
    <automated>cd app/src-tauri &amp;&amp; cargo test project -- --nocapture</automated>
  </verify>
  <done>A saved project contains no `brushPack` key and no `brushes/` tree; an old project with those keys opens and its key is ignored; no code references `asset`, `pendingBrushAssets`, `efxPaintBrushSet` or `efxPaintBrushAssets`; the script pack still builds and parses through the single-carrier `pack.ts`.</done>
</task>

<task type="auto">
  <name>Task 5: Remove the script mask carrier — metadata only</name>
  <files>
    app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts
    app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.test.ts
    app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts
    app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.test.ts
    app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
    app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts
    app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.bake.test.ts
    app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.ts
    app/src/types/physicPaint.ts
  </files>
  <action>
    Scripts keep the per-tip metadata needed to render (id, name, multipliers); the mask bytes and their 512 KB cap disappear. Resolution goes through the local library.

    `physicsPaintRotoScriptSchema.ts`:
    - Delete `ROTO_SCRIPT_LIMITS.maskDataUrlBytes`, `decodeScriptMaskDataUrl`, and the `TIP_SIZE` import. `ScriptBrushTipEntry` stops being `AquarelleTip & { maskDataUrl }` — it becomes `AquarelleTip`.
    - Keep `RotoScript`'s `brushPack` shape and its `validate_brush_pack`-equivalent guard; the entries simply carry no mask. Keep `RotoScriptSchemaVersion` at 1 — an optional engine field does not move the schema (the `textureId` precedent).

    `physicsPaintRotoScriptLibrary.ts`:
    - Delete the mask carrier construction (the `maskDataUrl` build at ~368, `decodeScriptMaskDataUrl` at ~440, the `TIP_MASK_BYTES` length gate at ~457) and the load-leg registration loop (`registerScriptBrushMasks` and its ports) — a script load must never write the mask registry any more.
    - Rebuild `ScriptBrushTipEntry` rows from the machine catalog rows referenced by the script's strokes (`referencedCustomBrushIds` already collects `engine.brushId` + `engine.textureId`; keep it). When a referenced id is not in the local library, still write the metadata row if the catalog has it; when it has neither, omit the row and let the existing fallback law handle the stroke.
    - The save-refusal leg that blamed `maskDataUrl`/`brushCatalogSynced` goes away. With a machine catalog the save never refuses for a missing mask; keep a log line for a referenced id the local library does not know.

    `physicsPaintRotoPlayScriptController.ts` and `physicsPaintRotoDuplicateScript.ts`: remove the mask-decode/register legs; keep every stroke-copy path (the `textureId` copy stays; Task 9 adds `textureRotation` beside it).

    `app/src/types/physicPaint.ts`: drop the script mask-cap constants and the entry validator branch that required a mask.

    Tests this task now owns — `physicsPaintRotoScriptLibrary.test.ts` moves here from Task 4 (it was invoked by Task 4's verify while owned by this task, which left a boundary red). Retarget its fixtures: the catalog payload it builds with `{ contextId, entries: [...] }` becomes `{ libraryRevision, entries: [...] }` (Task 2), its `webpBase64` and `asset` fixture legs are gone (Task 4), and its `entries[0].maskDataUrl` assertions become assertions that NO mask bytes are written. `physicsPaintRotoScriptSchema.test.ts` likewise drops its `maskDataUrl` cases and gains the "a referenced texture absent locally still loads" case.

    Do not: add a migration reader, keep a shadow "legacy mask" code path, or delete an existing `.efx-roto-script.json` on disk.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/physicsPaintRotoScriptSchema.test.ts src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.test.ts</automated>
  </verify>
  <done>A saved script's JSON contains no `maskDataUrl` and no base64 blobs beyond the thumbnail; loading a script never calls the mask registry; a script whose texture is absent on this machine still loads and plays with the response tip.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 6: Delete a texture — one confirmation, scoped to the Textures surface</name>
  <files>
    app/src-tauri/src/commands/brush_library.rs
    app/src-tauri/src/lib.rs
    app/src/lib/ipc.ts
    app/src/lib/brushLibrary.ts
    app/src/lib/brushLibrary.test.ts
    app/src/lib/physicPaintBridge.ts
    app/src/lib/physicPaintBridge.test.ts
    app/src/types/physicPaint.ts
    app/src/main.tsx
    app/src/stores/aquarelleBrushCatalog.ts
    app/src/components/physic-paint/view/aquarelleRecordState.ts
    app/src/components/physic-paint/view/PhysicsPaintTextureModal.tsx
    app/src/components/physic-paint/view/PhysicsPaintTextureModal.test.ts
    app/src/components/physic-paint/physicsPaintStudio.css
  </files>
  <behavior>
    - Rust: `brush_library_delete({ digest })` removes exactly one catalog row and one file; a missing file still removes the row (idempotent); a digest that is not 64 hex chars is refused before any path is built.
    - Rust: if the catalog rewrite fails, the previous `catalog.json` is intact and the command reports the failure.
    - Rust: delete never touches a path outside the library root and refuses a symlinked target.
    - Realm: a delete requested from the Studio child realm reaches the main realm, mutates the library there, and the Studio's catalog has dropped the row before the surface resolves; a request with a non-64-hex digest mutates nothing and answers a refusal; a torn/unknown operationId answer is ignored.
    - TS: confirming removes one entry and resets the selection to Default when the deleted id was selected; canceling changes nothing.
    - TS: Delete/Backspace does nothing when the Textures surface is not focused, and never routes through the global paint shortcut dispatcher.
  </behavior>
  <action>
    Rust — `app/src-tauri/src/commands/brush_library.rs`:
    - `brush_library_delete({ digest })`: validate the digest, `reject_symlink` the file, remove `<root>/<digest>.webp` (ignore not-found), remove the row by digest, rewrite `catalog.json` atomically. On any failure the previous catalog stays intact. Hold the same single-flight mutex. Never accept or construct a path from the renderer.
    - Register `commands::brush_library::brush_library_delete` in `generate_handler![...]` in `app/src-tauri/src/lib.rs`, beside the write/decode/scan entries. (`commands/mod.rs` already declares the module from Task 1 and needs no further change.) An unregistered command compiles under `cargo test` but every `invoke` rejects at runtime — delete would silently do nothing, so the registration is part of this task, not an afterthought.

    Renderer (MAIN realm, the library owner) — `app/src/lib/brushLibrary.ts`: `deleteBrushTexture(digest)` runs through the single-flight chain, calls `brush_library_delete`, updates the store (remove the row, drop the registered mask for its id, add it to `unavailable` only if something still references it), bumps `libraryRevision` once, publishes once. Idempotent: deleting an already-absent digest leaves the store and the revision untouched.

    Cross-realm channel — the Textures surfaces mount ONLY in the Studio child realm (`PhysicsPaintStudioView.tsx:564,614`; `app/src/main.tsx:38,102-104` boots a separate webview), while the library, its store and its publisher live in the main realm. The child therefore cannot mutate directly: it must ask the owner. Add ONE child→main request/result pair, mirroring the brush-import pair exactly (Tauri `listen` + CustomEvent + origin-checked `postMessage`, bounded wait, operationId correlation, fail-closed wire guard):
    - `app/src/types/physicPaint.ts`: `PhysicPaintBrushTextureMutation` = `{ operation: 'delete'; digest: string } | { operation: 'set-rotation'; digest: string; textureRotation: number }`, plus `PhysicPaintBrushTextureMutationRequest { operationId, mutation }` and `PhysicPaintBrushTextureMutationResult { operationId, ok, digest, reason? }` with the totality guard trio (`isPhysicPaintBrushTextureMutationRequest` refuses a digest that is not 64 lower-case hex and a rotation that is not an integer in -180..180; the result guard refuses unknown keys).
    - `app/src/lib/physicPaintBridge.ts`: event constants `PHYSIC_PAINT_BRUSH_TEXTURE_MUTATION_REQUEST_EVENT = 'physic-paint:brush-texture-mutation-request'` and `PHYSIC_PAINT_BRUSH_TEXTURE_MUTATION_RESULT_EVENT = 'physic-paint:brush-texture-mutation-result'` (beside the four `PHYSIC_PAINT_BRUSH_*` constants at lines 158-168); `requestPhysicPaintBrushTextureMutation(mutation)` (child side) and `installPhysicPaintBrushTextureMutationListener()` (main side).
    - The MAIN handler switches on `mutation.operation`: `'delete'` → `deleteBrushTexture(digest)` (this task); `'set-rotation'` is added by Task 10 into the SAME pair — write the switch so the second arm is a one-line addition. After the mutation it AWAITS `publishPhysicPaintBrushCatalog()` and only then answers `{ ok: true, digest }`, so the republished snapshot is on the wire before the result — the same publish-then-answer law the import path already follows.
    - The CHILD request function, on `ok`, awaits `requestPhysicPaintBrushCatalog()` (the existing bounded one-shot pull) before resolving: the caller's next read of `libraryRowFor`/`customBrushTips` must already reflect the mutation.
    - `app/src/main.tsx`: install the listener beside `installPhysicPaintBrushImportListener()` / `installPhysicPaintBrushCatalogRequestListener()` (~150-156), app-lifetime like its siblings.
    - `app/src/lib/physicPaintBridge.test.ts`: pin the realm round-trip — a valid delete request reaches the handler, mutates a stubbed library, publishes, and answers with the same `operationId`; a malformed digest answers `ok: false` and publishes nothing.

    Child-side state — `app/src/components/physic-paint/view/aquarelleRecordState.ts`: after an `ok` delete result, `setAquarelleSelectedTextureId(null)` when the deleted digest's id was the selected one (compare the id the child knew for that digest before the pull). This is the child's own selection; the main realm never writes it.

    `physicsPaintStudio.css` carries the chip/empty-state styles for a library that just lost a row. `app/src/stores/aquarelleBrushCatalog.ts` needs no new setter beyond Task 2's `replaceLibraryEntries` — the pull drives it.

    UI — `PhysicsPaintTextureModal.tsx`:
    - Attach the Delete/Backspace handler to the sheet's own container element (the existing `surfaceRef` node), which becomes focusable. It must act only when the event target is the sheet or a chip button — never an `input`/`textarea` — and it must not be installed on `window` and must not go anywhere near `shortcuts.ts`.
    - One confirmation dialog naming the consequence (the texture is removed from this machine; projects and scripts that use it fall back to the response tip). Confirm → delete; cancel → nothing. Sentence-case UI copy per the project skill; no emoji.
    - The top-bar popover gets no delete affordance (it is a picker).
    - CSS for the confirmation and the focus ring lands in `physicsPaintStudio.css`.

    Do not add an undo, do not delete project or script files, and do not make the confirmation optional.
  </action>
  <verify>
    <automated>cd app/src-tauri &amp;&amp; cargo test brush_library -- --nocapture</automated>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/lib/brushLibrary.test.ts src/lib/physicPaintBridge.test.ts src/components/physic-paint/view/PhysicsPaintTextureModal.test.ts</automated>
  </verify>
  <done>Confirming removes one row and one file and resets a selected texture to Default; canceling is a no-op; the handler is inert outside the Textures surface; a failed catalog rewrite leaves the catalog untouched; a request from the Studio child realm performs the mutation in the main realm and the child's catalog reflects it before the surface resolves.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 7: Pixel-true paint size — the px &lt;-&gt; canonical helper</name>
  <files>
    packages/efx-watercolor/src/playground/params.ts
    packages/efx-watercolor/src/playground/params.test.ts
    packages/efx-watercolor/src/playground/index.ts
    app/src/components/physic-paint/engine/aquarelleBrushSize.ts
    app/src/components/physic-paint/engine/aquarelleBrushSize.test.ts
  </files>
  <behavior>
    - Round, workingHeight 1080: `canonicalFromDiameter(512)` is ~293 and `diameterFromCanonical(293.1)` is 512 +/- 0.5.
    - Rigger, workingHeight 1080: `canonicalFromDiameter(512)` is ~930.6 — above the 800 track max and NOT clamped.
    - `diameterFromCanonical(canonicalFromDiameter(S))` returns S +/- 0.5 for S in 64, 128, 256, 430, 512 and 1 +/- 0.01 for S = 1, on Round and Rigger at 1080.
    - `canonicalFromDiameter` is strictly monotonic in S on 1..512 for every shipped response, and continuous through the retired floor: Round at 1080 gives `canonicalFromDiameter(1)` ≈ -48.9 with no clamp and no snap.
    - Nothing saturates. Round at 1080 round-trips S=1 within 0.01 px (`diameterFromCanonical(canonicalFromDiameter(1))` ≈ 1.00) and reports 8 ± 0.5 at S=8 — both below the old 28.8 px floor, which is only reachable if `Math.max(0, ...)` is gone.
    - `diameterFromCanonical` is strictly increasing in canonical across the negative region too, so no canonical value pins the displayed number.
    - The size law is unchanged for non-negative input: `toEngineParams({ size: n }).size` still equals the HEAD literals `1/32, 3/8, 1, 1, 1, 1 + (1/720) * 1.04795, 2.04795` for n = 1, 12, 32, 33, 80, 81, 800, while `toEngineParams({ size: -5 }).size` is now `-5/32` (was `0`).
  </behavior>
  <action>
    One pure module, no WebGL, no signals — the established prototype-math pattern (`engineScriptWidth.test.ts` states the same contract).

    `packages/efx-watercolor/src/playground/params.ts` — this task OWNS the size-law change; no other task edits it:
    - Remove the clamp exactly: line 61's `if (sizePx <= 32) return Math.max(0, sizePx / 32)` becomes `if (sizePx <= 32) return sizePx / 32`. Per the locked decision in `261116-inu-CONTEXT.md` ("The engine's size floor is removed"), that single expression is the whole change. Do not touch anything else: the `32..80` flat band returning 1, the `80..800` formula, `SIZE_SCALE_HARD_MAX`, `LEGACY_SIZE_MAX_PX`, `SIZE_MAX_PX`, `SIZE_SCALE_AT_MAX` and `toEngineParams`' non-finite guard all stay byte-for-byte. The mapping for every non-negative canonical value must remain identical to HEAD.
    - Export `sizeToEngineScale` (signature unchanged) plus `SIZE_SCALE_AT_MAX`, `SIZE_MAX_PX` and `LEGACY_SIZE_MAX_PX` if the helper needs the band constants, and add the new export to `packages/efx-watercolor/src/playground/index.ts:22` so it reaches the root barrel (`src/index.ts` does `export * from './playground'`, and `app/vite.config.ts:166` aliases `@efxlab/efx-watercolor` to `src/index.ts`, so the app test sees the source change with no package rebuild).
    - Guard test in `packages/efx-watercolor/src/playground/params.test.ts` — this is the proof that "every recorded stroke replays byte-identically" survives. Extend the existing legacy test into a table asserted against `toEngineParams({ size: n }).size`, using the HEAD output values as literals (not recomputed from the same constants): n = 1 -> 1/32, 12 -> 3/8, 32 -> 1, 33 -> 1, 80 -> 1, 81 -> 1.00145549 (i.e. `1 + (1/720) * 1.04795`), 800 -> 2.04795. Only the `sizePx < 0` region is new.
    - Pin the new region explicitly: `toEngineParams({ size: -5 }).size === -5/32`, `toEngineParams({ size: -32 }).size === -1`, and the branch is the plain linear map below 0 (no `Math.max`, no saturation). The existing `expect(toEngineParams({ size: -5 }).size).toBe(0)` at `params.test.ts:28` is the one assertion that encoded the old floor — update it to `-5/32`.

    New `app/src/components/physic-paint/engine/aquarelleBrushSize.ts`:
    - `PAINT_SIZE_MIN_PX = 1`, `PAINT_SIZE_MAX_PX = 512`.
    - `responseFullPressureSize(brushId, textureId, overrides): number` — `buildBrushForStroke(...).size[1]`, reusing the existing resolution so the number is the engine's own.
    - `canonicalFromDiameter(diameterPx, fullPressureSize, workingHeight): number` — the law verbatim: `base = fullPressureSize * 0.8`; `mult = (S/2/workingHeight)/base`; `scale = 0.5 + Math.log(mult)/Math.log(3)/2`; then the inverse branch: `scale <= 1 ? scale * 32 : 80 + (scale-1)/(SIZE_SCALE_AT_MAX-1) * 720`. No clamping, guards for `workingHeight <= 0`, non-finite `mult` or `S <= 0` returning the neutral default instead of NaN.
    - `diameterFromCanonical(canonical, fullPressureSize, workingHeight): number` — `2 * fullPressureSize * 0.8 * Math.pow(3, (sizeToEngineScale(canonical) - 0.5) * 2) * workingHeight`. It mirrors the engine through the real exported function AFTER this task's clamp removal, so the displayed number is the footprint the engine will paint at every canonical including the negative region: 1 px is reachable on Round at 1080, not saturated at 28.8 px.
    - Document the removed floor in the module header: the old 28.8 px / 3.74 px saturation is gone, S=1 is real, and Round at 1080 reaches it at canonical ≈ -48.9.

    Write the tests first (RED), then the module. Land the clamp removal and the `params.test.ts` guard table first, before the helper — they are this task's baseline. Do not place the helper in the package: it needs `buildBrushForStroke` and the app's working height, and the package core stays Preact/app-free.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/engine/aquarelleBrushSize.test.ts</automated>
    <automated>cd packages/efx-watercolor &amp;&amp; pnpm exec vitest run src/playground/params.test.ts</automated>
  </verify>
  <done>The helper round-trips S across 1/64/128/256/430/512 on Round and Rigger at 1080, with S=1 reading 1 ± 0.01 px and nothing saturating; `sizeToEngineScale`'s `Math.max(0, ...)` floor is removed and the legacy literal table (1, 12, 32, 33, 80, 81, 800) proves every non-negative canonical maps exactly as it did at HEAD; no clamping of the stored canonical exists anywhere.</done>
</task>

<task type="auto">
  <name>Task 8: Wire the pixel-true size and split it from the lift size</name>
  <files>
    app/src/components/physic-paint/view/aquarelleRecordState.ts
    app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx
    app/src/components/physic-paint/view/PhysicsPaintTopBar.test.ts
    app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx
    app/src/components/physic-paint/view/PhysicsPaintTextureModal.tsx
    app/src/components/physic-paint/view/PhysicsPaintTextureModal.test.ts
    app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx
    app/src/components/physic-paint/engine/aquarelleFootprint.ts
    app/src/components/physic-paint/engine/aquarelleFootprint.test.ts
    app/src/components/physic-paint/PhysicsPaintStudio.tsx
    app/src/components/physic-paint/physicsPaintStudio.css
  </files>
  <action>
    Two sizes, one law, no shared state. Today `aquarelleParams.size` feeds the brush control, the lift control, the right panel and the Textures modal (`PhysicsPaintTopBar.tsx:436,543,565-576`; `PhysicsPaintRightPanel.tsx:458-461`; `PhysicsPaintTextureModal.tsx:124-141`). That is the split to break.

    State — `aquarelleRecordState.ts`:
    - Add `aquarelleLiftSize` (signal, canonical 1..80 — the SAME unit the lift control writes today, fed through `toEngineParams`; default 12) and `setAquarelleLiftSize` (compare-then-write). `aquarelleParams.size` remains the PAINT canonical.
    - Add `aquarelleWorkingHeight` (signal, default 1080) with a compare-then-write setter; `PhysicsPaintStudio.tsx` writes it from `getPhysicsPaintWorkingSize(projectCanvasWidth, projectCanvasHeight).height` (line ~1781) in an effect that only writes on change. This is the engine's render height — the same number `Engine.dh` uses, so the px law and the painted footprint cannot disagree.
    - Add THE shared selector, `aquarelleActiveCanonicalSize(): number` — `aquarelleActiveTool.value === 'lift' ? aquarelleLiftSize.value : aquarelleParams.value.size`. Every consumer reads this one function; no caller re-derives the ternary.

    Live-path rewire — this is where the split becomes real. Today the lift footprint is NOT derived from the lift brush: `Engine.radius('lift')` (`Engine.ts:~1748`) is `(0.012 + 0.03·pressure) · sizeMult()`, and `sizeMult()` reads `this.params.size` (`Engine.ts:1676`). `aquarelleFootprintFor`'s lift branch (`aquarelleFootprint.ts:145-152`) reads the same input. So `toEngineParams(...).size` IS the lift footprint carrier, and the three consumers below must all read `aquarelleActiveCanonicalSize()`:
    - `AquarelleCanvasLayer.applyLiveConfig()` (line 322) — `engine.setParams(toEngineParams({ ...aquarelleParams.value, size: aquarelleActiveCanonicalSize() }))`. Do NOT try to carry it on `setLiftBrush`'s brush: `Engine.radius('lift')` never reads the lift brush's `size`, so a value set there would be silently ignored and the live eraser would keep following the paint canonical.
    - `AquarelleCursor` (`AquarelleCanvasLayer.tsx:145-161`) — `aquarelleFootprintFor({ ..., size: aquarelleActiveCanonicalSize() })`. Today it passes `params.size` for every tool, so with the split the ring would show the paint footprint while the eraser erased at the lift one.
    - `snapshotAquarelleRecord()` — copy the globals as today, then override `params.size` with `aquarelleActiveCanonicalSize()`. One law: live, bake and replay all read the value the stroke recorded, and the recorded lift stroke carries the lift canonical rather than the paint canonical.
    Refresh the `AquarelleFootprintInput.size` doc comment in `aquarelleFootprint.ts` (line 43 still says "Canonical AQUA-04 size (0..80, the top-bar slider)"): it is the ACTIVE tool's canonical — the paint canonical, or the lift canonical while Lift is active.

    Controls:
    - `PhysicsPaintTopBar.tsx`: the Brush size control becomes a px control (`PAINT_SIZE_MIN_PX`..`PAINT_SIZE_MAX_PX`, step 1) — a plain static 1..512 range with no dynamic minimum, no response-dependent floor and no snap-back, so a selected S of 1 stays 1 and is what the next stroke paints. Its value is `diameterFromCanonical(aquarelleParams.value.size, responseFullPressureSize(...), aquarelleWorkingHeight.value)`. `onChange(px)` → `setAquarelleParam('size', canonicalFromDiameter(px, ...))`; `onCommit(px)` → one `commitAquarelleSelectionParam('size', canonical)` per release. The lift cluster (`physics-lift-size`) reads and writes `aquarelleLiftSize` and keeps `min=1 max=80`; it must never touch `aquarelleParams.size`.
    - `PhysicsPaintRightPanel.tsx:458`: the Paint tab size control uses the SAME handler and the px mapping — no second size state and no duplicate conversion.
    - `PhysicsPaintTextureModal.tsx` `TextureSizeControl`: same handler, px value, same mapping. It is a surface, not a state owner.
    - All three read the response's full-pressure size for the ACTIVE response (`buildBrushForStroke` via `responseFullPressureSize`), so switching response at a fixed S recomputes the canonical for the next stroke.
    - Displayed value is always derived; never write a signal in a render body (project reactivity rule).

    Footprint pins — `aquarelleFootprint.test.ts`: Round at `workingHeight` 1080 with the canonical produced for S=512 yields `2 * radiusDoc * 1080 = 512 +/- 1`, and the canonical produced for S=1 yields `1 +/- 0.01` (the shipped footprint law has no floor of its own). Add the live-lift pin this split exists for: with `aquarelleActiveTool` set to lift, `aquarelleActiveCanonicalSize()` returns `aquarelleLiftSize`, `aquarelleFootprintFor` fed that value yields the lift ring, and sweeping `aquarelleParams.size` across its whole range never moves it — one selector, one ring, no drift between the eraser and its cursor.

    Do not: re-open `sizeToEngineScale` (Task 7 owns its one-line clamp removal; this task only consumes the exported function through the helper), clamp or snap the stored canonical at either end, give any px control a floor above 1 or a minimum derived from the active response, let the paint control write the lift size (or vice versa), or convert `strokeSettingsModel.ts`'s legacy 1..800 track — that model (`app/src/components/physic-paint/view/strokeSettingsModel.ts:69`) is the only surface that shows the raw canonical and stays as-is.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/engine/aquarelleFootprint.test.ts src/components/physic-paint/view/PhysicsPaintTopBar.test.ts src/components/physic-paint/view/PhysicsPaintTextureModal.test.ts</automated>
  </verify>
  <done>Round at 1080 reads 512 and paints 512 +/- 1 px at full pressure; S in 1/64/128/256/512 all map through one helper; S=1 stays 1 with no dynamic minimum and no snap-back, and no selected value is ever saturated to a larger footprint; the paint control never writes `aquarelleLiftSize` and the lift control never writes `aquarelleParams.size`; the live eraser's `setParams`, its cursor ring, the value `snapshotAquarelleRecord` records and the replay of that stroke all read the one `aquarelleActiveCanonicalSize()`, so an erased stroke has the same diameter live, in the bake and on playback.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 9: textureRotation through the brush, AQTL v4 and the Roto script</name>
  <files>
    packages/efx-watercolor/src/payload/toStudioStroke.ts
    packages/efx-watercolor/src/playground/brushBridge.ts
    packages/efx-watercolor/src/playground/brushes.ts
    app/src/components/physic-paint/view/aquarelleRecordState.ts
    app/src/components/physic-paint/performance/scriptTimelineCodec.ts
    app/src/components/physic-paint/performance/scriptTimelineCodec.test.ts
    app/src/components/physic-paint/performance/studioScriptSnapshotCodec.ts
    app/src/components/physic-paint/performance/studioScriptSnapshotCodec.test.ts
    app/src/components/physic-paint/snapshot/studioScriptSnapshotController.test.ts
    app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts
    app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.test.ts
    app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
    app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts
    app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.ts
    app/src/components/physic-paint/view/aquarelleRecordState.restore.test.ts
  </files>
  <behavior>
    - Absent `textureRotation` encodes exactly as today: the minimal v4 buffer is 96 bytes (v3's 95 plus the one presence byte) and a stroke with no rotation decodes without the key.
    - ONE unit crosses every carrier: integer DEGREES everywhere in memory and in every JSON carrier (`AquarelleStroke`, `Brush`, the store row, `PhysicPaintBrushCatalogEntry`, the Roto script stroke, `catalog.json`). `3700` exists ONLY inside the AQTL byte body, written as `Math.round(degrees * 100)` and read back as `value / 100`.
    - A rotation of 37 round-trips as `37` through every carrier — never `3700`, never `0.37`: the anti-mixup test asserts the AQTL round-trip returns exactly 37 while the encoded i16 is exactly 3700, and that the Roto schema rejects `3700` as out of range.
    - `SCRIPT_TIMELINE_BINARY_VERSION` is 4; a v1, v2 or v3 body is refused `unsupported-version`; the reader rejects a non-integer or out-of-range hundredths value.
    - The SNAP container maps inner versions 1, 2 and 3 to `aqtl-retired` with the existing message, and accepts 4.
    - A recorded 37 survives Save Script -> Apply into a realm whose library row says 0; the play controller copies the stored value, not the library value.
    - The Roto schema guard accepts integer DEGREES in -180..180 and refuses anything else, including `3700`; the Roto JSON never carries hundredths.
  </behavior>
  <action>
    The stroke owns the rotation. The library value is only the default for the NEXT stroke.

    UNIT LAW — one unit crosses every carrier, and it is integer DEGREES: `AquarelleStroke.textureRotation`, `Brush.textureRotation`, the store row, `PhysicPaintBrushCatalogEntry.textureRotation`, the Roto script stroke and `catalog.json` all hold -180..180 degrees. There is exactly ONE hundredths boundary in the whole feature and it is the AQTL byte body (below), which writes `Math.round(degrees * 100)` and reads back `value / 100`. Nowhere else may multiply or divide by 100. A value of 3700 reaching any JSON carrier is a bug, not a valid rotation.

    Payload and brush — `packages/efx-watercolor/src/payload/toStudioStroke.ts` add `textureRotation?: number` to `AquarelleStroke` (degrees) beside `textureId` and carry it through the projection unchanged. `packages/efx-watercolor/src/playground/brushBridge.ts`: add `textureRotation?: number` to `BrushStrokeOptions`; `resolveStrokeBrush` passes it to `buildBrush`'s result so `Brush` carries `textureRotation` (degrees; 0 when absent). Both the live and the bake path already share `buildBrushForStroke` — keep that single resolution.

    **Declare the field on `Brush` itself.** `packages/efx-watercolor/src/playground/brushes.ts` (~lines 63-75, beside the existing optional `textureId`) gains `textureRotation?: number | null` with a doc comment stating the unit law: DEGREES, present only when a texture supplied the tip, and the stroke snapshot — never the library — is the authority at replay. Task 10 binds the uniform from it, so the type must exist before that task compiles.

    Record — `aquarelleRecordState.ts`: `snapshotAquarelleRecord()` adds `textureRotation` only when a texture supplied the tip (`selection.textureId !== null`), read as DEGREES from the selected library row via `libraryRowFor(selection.textureId)?.textureRotation ?? 0` (Task 2's accessor; never from the payload's decoded mask); a procedural tip records nothing (absent means 0). `restoreAquarelleRecordTimeline` re-adds it with the same conditional spread as `textureId` (line ~1869).

    AQTL — `scriptTimelineCodec.ts`, the ONE conversion boundary:
    - `SCRIPT_TIMELINE_BINARY_VERSION = 4`; the encoder writes `presence + i16(Math.round(degrees * 100))` immediately AFTER the `textureId` block and BEFORE `pointCount`, exactly mirroring the 63-15 pattern at lines 738-747. The DECODER divides by 100 exactly once before re-adding the field with a conditional spread — `readI16() / 100` — so the value in memory is degrees again.
    - Validate the ENCODED integer against `-18000..18000` and the DECODED value against -180..180 degrees; a non-finite / out-of-range value is `invalid-value`, not a silent clamp. A `textureRotation` outside -180..180 arriving at the encoder is refused before any `* 100`.
    - Update the byte-length pin to 96 with the comment explaining the one added presence byte, and extend the version-refusal test to 1, 2 and 3.
    - Add the anti-mixup test: encode a stroke recorded at 37 degrees, assert the raw i16 slot reads exactly 3700, decode it and assert the field is exactly 37 (not 3700, not 0.37), then assert the Roto schema guard refuses 3700. This is the regression that catches a future degree/hundredths mix-up on either side.

    SNAP container — `studioScriptSnapshotCodec.ts:619-645`: the retired set becomes inner versions 1, 2 and 3; version 4 falls through to the normal decode. Keep the same `aqtl-retired` code and message, and keep "future/unknown versions stay generic corruption". Update `studioScriptSnapshotCodec.test.ts:388-433` and the `[1,2,3,4]` loop in `studioScriptSnapshotController.test.ts:434` so 1-3 are retired and 4 is accepted.

    Roto script — `physicsPaintRotoScriptSchema.ts` engine guard: `textureRotation` absent is valid; present must be an integer in `-180..180` DEGREES (the JSON carrier never holds hundredths, so a `3700` in a script is out of range and refused). `physicsPaintRotoPlayScriptController.ts:4398` copies it beside `textureId` (same conditional spread); `physicsPaintRotoDuplicateScript.ts:213` likewise. A recorded stroke's degrees are copied verbatim; the library row is never consulted.

    Do not: bump `ROTO_SCRIPT_SCHEMA_VERSION`, migrate old bodies, read the library at replay, or rotate the footprint (that is Task 10's shader).
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/performance/scriptTimelineCodec.test.ts src/components/physic-paint/performance/studioScriptSnapshotCodec.test.ts src/components/physic-paint/roto/physicsPaintRotoScriptSchema.test.ts src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts</automated>
    <automated>cd packages/efx-watercolor &amp;&amp; pnpm exec vitest run src/playground/brushBridge.test.ts</automated>
  </verify>
  <done>v4 round-trips the rotation; v1-v3 refuse and map to `aqtl-retired` in SNAP; a stroke recorded at 37 replays at 37 even when the library row says 0; 37 stays 37 degrees in memory and in every JSON carrier while 3700 exists only inside the AQTL body (the anti-mixup test pins both halves); an absent rotation leaves the pre-change byte layout identical apart from the new presence byte.</done>
</task>

<task type="auto">
  <name>Task 10: Mipmapped tip sampling, the rotation uniform, and the Textures rotation stepper</name>
  <files>
    packages/efx-watercolor/src/playground/Engine.ts
    packages/efx-watercolor/src/playground/shaders.ts
    packages/efx-watercolor/src/playground/shaders.test.ts
    app/src-tauri/src/commands/brush_library.rs
    app/src-tauri/src/lib.rs
    app/src/lib/ipc.ts
    app/src/lib/brushLibrary.ts
    app/src/lib/brushLibrary.test.ts
    app/src/lib/physicPaintBridge.ts
    app/src/lib/physicPaintBridge.test.ts
    app/src/types/physicPaint.ts
    app/src/lib/noRetiredTextureIds.test.ts
    app/src/components/physic-paint/view/PhysicsPaintTextureModal.tsx
    app/src/components/physic-paint/view/PhysicsPaintTextureModal.test.ts
    app/src/components/physic-paint/view/WatercolorTextureStrip.tsx
    app/src/components/physic-paint/view/watercolorMaskChip.ts
    app/src/components/physic-paint/view/watercolorMaskChip.test.ts
    app/src/components/physic-paint/physicsPaintStudio.css
  </files>
  <action>
    GPU tip quality and the rotation's visual half.

    Mipmaps — `Engine.ts:1319-1335` is the ONLY tip-texture creation site; `bindTex` (`gl.ts:176`) only binds and `GL.target` allocates single-level, so this change belongs here and nowhere else:
    - After `texImage2D(gl.R8, ...)` call `gl.generateMipmap(gl.TEXTURE_2D)`.
    - `TEXTURE_MIN_FILTER = gl.LINEAR_MIPMAP_LINEAR`; `TEXTURE_MAG_FILTER` stays `gl.LINEAR`; wrap stays `CLAMP_TO_EDGE`; `UNPACK_ALIGNMENT` stays 1. Never NEAREST.
    - R8 is color-renderable and filterable in core WebGL2 and 512 is a power of two, so this needs no extension. The context is already WebGL2-only (`Engine.ts:313-322`). Add a short comment stating both facts.
    - A 512 mask is now uploaded from `b.tipData` whose length is 262,144 — `buildBrush` already derives `tipSize` from `Math.round(Math.sqrt(source.length))`, so no other change is needed. Cost: ~349 KB VRAM per distinct `(id, textureId)` for the full chain.
    - The live proof (no shimmer at S=64) is a checkpoint row, not a unit test; there is no WebGL harness in vitest.

    Rotation uniform — `shaders.ts`:
    - Add `uniform float uTipRotation;` to BOTH `stampFS` (line ~38) and `liftFS` (line ~275).
    - Rotate the TIP-SPACE sampling coordinates only, after `q` is computed and `q.y /= uTipAspect`, before the `q * 0.5 + 0.5` UV mapping: `vec2 tq = vec2(q.x * cos(a) - q.y * sin(a), q.x * sin(a) + q.y * cos(a))`. The `abs(q.x) > 1.0 || abs(q.y) > 1.0` discard test and every footprint value keep using the UNROTATED `q`. In `liftFS` the same substitution applies to the sampled UV.
    - `Engine.drawStamp` (~line 1991) and `Engine.lift` (~line 2125) bind `uTipRotation` from `this.brush.textureRotation` (degrees → `* DEG`, 0 when absent). The lift brush falls back to `this.brush` today — keep that resolution.

    Rust — `brush_library_set_rotation({ digest, textureRotation })`: validate the digest, require an integer in -180..180 DEGREES, and store exactly that number in `catalog.json`'s `textureRotation`. The catalog is degrees end to end; hundredths exist only inside the AQTL byte body Task 9 owns, so this command neither writes nor accepts them. Update the row, rewrite the catalog atomically, return the entry. Same single-flight mutex. **Register `commands::brush_library::brush_library_set_rotation` in `generate_handler![...]` in `app/src-tauri/src/lib.rs`** beside the write/decode/scan/delete entries (`commands/mod.rs` already declares the module from Task 1). Unregistered means every invoke rejects and the rotation never persists — `cargo test` compiles the function, so nothing else catches it.

    Rotation commit crosses the realm boundary — the modal lives in the Studio child realm, so it must not call `setBrushTextureRotation` directly. Add the `'set-rotation'` arm to the ONE mutation pair Task 6 introduced (`app/src/lib/physicPaintBridge.ts`, `app/src/types/physicPaint.ts`): the main handler's `case 'set-rotation'` calls `setBrushTextureRotation(digest, textureRotation)`, awaits `publishPhysicPaintBrushCatalog()`, then answers `{ ok: true, digest }`; the child's request function awaits its post-answer `requestPhysicPaintBrushCatalog()` pull before resolving, so the modal's next `libraryRowFor` read already shows the committed degrees. Extend `isPhysicPaintBrushTextureMutationRequest` to validate the rotation as an integer in -180..180 (Task 6 declared the field and its guard; this task turns the arm on). Reveal the stepper only from a row the child actually received a digest for. Do not add a second event pair and do not reuse the import pair.

    UI — `PhysicsPaintTextureModal.tsx` (child realm): a `SliderStepper` labelled "Rotation" (-180..180, step 1, default 0, integer degrees) directly UNDER the Brush size control, inside the floating modal only. The top-bar popover stays chips + "Open modal". The shown value is `libraryRowFor(selectedId)?.textureRotation ?? 0`; `onChange` previews the in-memory row only; `onCommit` (release / step commit) calls `requestPhysicPaintBrushTextureMutation({ operation: 'set-rotation', digest, textureRotation: degrees })` ONCE — never per drag tick. The control is disabled when the selected texture is Default. The child never calls `setBrushTextureRotation` and never writes the catalog row itself.

    Chip preview — `watercolorMaskChip.ts:34-56`: `getMaskChipCanvas(responseId, textureId, textureRotation)`; the cache key gains the rotation; the canvas edge comes from `Math.round(Math.sqrt(data.length))` (never `TIP_SIZE`) and the bytes are drawn rotated with a 2D `translate`/`rotate` and `imageSmoothingEnabled = true`. A rotation change repaints the chip; the cache generation still keys on `maskGeneration()`. Retarget any retired built-in id left in `watercolorMaskChip.test.ts` to a `wc/custom-<hex>` id — that file is the LAST fixture still carrying one.

    **Thread the rotation through to the only production caller.** `blitMaskChip` (`watercolorMaskChip.ts:71-85`) is what the strip actually calls, and it currently forwards only two arguments (`getMaskChipCanvas(responseId, textureId)` at line ~76). Give it a third parameter and pass it down, then update its sole caller `app/src/components/physic-paint/view/WatercolorTextureStrip.tsx:110` (`blitMaskChip(el, props.responseId, textureId)`) to forward the chip's row rotation, read from the same `libraryRowFor(textureId)?.textureRotation ?? 0` the modal uses. Without this hop the cache key and the canvas rotation exist but nothing ever supplies a non-zero value, and the spec's "the chip preview shows the rotated texture" acceptance row silently passes on always-zero. `WatercolorTextureStrip.tsx` is listed in this task's file set for exactly this edit — Task 3 already owns its `BUILTIN_TIPS` removal, so keep this change to the chip call only.

    Tree-wide retired-prefix invariant — `app/src/lib/noRetiredTextureIds.test.ts`. Task 3 deferred this scan here because this is the last task that retargets a retired id, so the tree is clean at this boundary. Walk `src`, `../packages/efx-watercolor/src` and `src-tauri/src` — relative to the app suite's cwd (`app/`), `app/src` would resolve to `app/app/src` and the test would throw or pass vacuously — read every `.ts`/`.tsx`/`.rs` file, and assert none contains the retired prefix, built at runtime as `['wc/', 'builtin-'].join('')` so the test file itself never matches. No whitelist and no skip list: the occurrences that legitimately survived earlier boundaries must already be gone — production comments in `physicsPaintRotoScriptLibrary.ts` (Task 5) and `aquarelleRecordState.ts` (Task 8), and fixtures in `aquarelleFootprint.test.ts` (Task 8), `scriptTimelineCodec.test.ts` and `aquarelleRecordState.restore.test.ts` (Task 9) and `watercolorMaskChip.test.ts` (above). A failure names the offending file and line so a miss is a lookup, not a hunt.

    CSS for the rotation row lands in `physicsPaintStudio.css`.
  </action>
  <verify>
    <automated>cd packages/efx-watercolor &amp;&amp; pnpm exec vitest run src/playground</automated>
    <automated>cd app/src-tauri &amp;&amp; cargo test brush_library -- --nocapture</automated>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/lib/physicPaintBridge.test.ts src/lib/noRetiredTextureIds.test.ts src/components/physic-paint/view/watercolorMaskChip.test.ts src/components/physic-paint/view/PhysicsPaintTextureModal.test.ts</automated>
  </verify>
  <done>The tip texture is mipmapped with a LINEAR_MIPMAP_LINEAR min filter and a LINEAR mag filter at the one creation site; both shaders declare `uTipRotation` and use the unrotated `q` for the discard; the modal has a rotation stepper under Brush size that commits once per release through the child-to-main mutation pair (main performs it, publishes, then answers) and persists through `catalog.json` as integer degrees; the chip key includes the rotation and its canvas uses the mask's own edge; the tree-wide retired-prefix scan is green.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 11: Live UAT — library lifecycle, 512 footprint, shimmer, rotation playback, deletion</name>
  <files>
    .planning/quick/261116-inu-imported-only-brush-textures-from-a-user/261116-inu-SUMMARY.md
  </files>
  <what-built>
    Imported-only brush textures from a machine-level library: 512x512 masks under `~/.config/efx-motion/brushes/` with a `catalog.json`, no built-in textures, no texture bytes in projects or scripts, a pixel-true paint size split from the lift size, and a per-stroke projected-texture rotation through AQTL v4 and the Roto script.
  </what-built>
  <how-to-verify>
    Run these on a live Studio. The agent does not start the dev server.

    1. Fresh state shows Default only in both Textures surfaces; a new `.mce` contains no `brushes/` and no `brushPack`.
    2. Import a PNG/JPG, paint, save, quit, relaunch: the tip is listed and paints; a 512x512 lossless WebP exists under `~/.config/efx-motion/brushes/`.
    3. Import the same file twice: one row, one file.
    4. The size control reads 512 and Round paints a 512 +/- 1 px footprint at full pressure on a 1080-tall project — never 612-620 px. Set it to 1: Round paints a single-document-pixel dot (the old build stops at 28.8 px), the control keeps reading 1, and nothing snaps back upwards.
    5. At S = 430, 256, 64 and 17 the same texture downsamples smoothly through mipmaps with no shimmer while the stroke moves.
    6. Rotate a texture to 37, paint, save/reopen and Play: the orientation matches in the live sheet, the bake and the playback; clearing to 0 restores the original look.
    7. Save Script (or Copy), then Apply into a project whose library has the same texture at 0: Play in motion, static, reveal-tail and reveal-run all stamp the recorded 37.
    8. Delete asks once, removes one row and one file, resets the selection to Default; a project using it reopens with the response tip and one warning.
    9. Copy the `.mce` to a machine without the texture (or rename its library file): replay falls back to the response tip with exactly one warning; importing the same texture restores the recorded look.
    10. Lift/eraser size still reads 1..80 and is unaffected by the paint size control.

    Rows 4 and 5 cannot be proven by vitest (no WebGL harness); rows 2, 8 and 9 need the real filesystem.
  </how-to-verify>
  <resume-signal>Reply "rows pass" with any failures named, or "rows 4/5 blocked" if the live measurement is not reachable.</resume-signal>
  <action>
    Record each of the ten rows in `.planning/quick/261116-inu-imported-only-brush-textures-from-a-user/261116-inu-SUMMARY.md` with a pass/fail verdict and a short note or screenshot reference. State the declared loss verbatim: a project or script opened on a machine without the texture replays with the response tip and the existing warning; importing the same texture there restores the look. Do not edit source files during this checkpoint; a failing row reopens its owning task.
  </action>
  <verify>
    <human-check>All ten rows pass live.</human-check>
  </verify>
  <done>The ten rows are recorded in the SUMMARY with a pass/fail verdict each, and the declared loss is written down.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| renderer -> Rust `brush_library_*` | mask bytes, digests and names cross here; the renderer must never name a filesystem path |
| disk -> renderer (`catalog.json`, `<digest>.webp`) | untrusted file content is parsed and decoded before any of it reaches the engine |
| Textures surface (Studio child realm) -> main realm mutation IPC | a destructive delete and a persisted rotation are initiated by a child webview; the main realm owns the library and must authorise and validate both |
| Textures surface -> delete command | a destructive operation driven by UI focus state |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-01 | Tampering | `brush_library.rs` path construction | high | mitigate | Digest validated as exactly 64 lower-case hex before it becomes a filename; filename always `{digest}.webp` under the fixed HOME-derived root; `reject_symlink` before every read/write/delete; no command accepts a path (Task 1, Task 6). |
| T-02 | Elevation / DoS | WebP decode of a hostile stored file | high | mitigate | Declared-dimension gate runs BEFORE any pixel allocation (`frame_codec.rs:153-172`), now at 512; decode refuses anything that is not exactly 512x512; the read is byte-capped (Task 1, Task 2). |
| T-03 | Tampering | `catalog.json` atomicity | high | mitigate | Every rewrite goes through the promoted `atomic_write_bytes` (create_new temp, write, sync, rename, parent fsync, temp cleanup); a failed write leaves the previous catalog intact, pinned by test (Task 1, Task 6, Task 10). |
| T-04 | Spoofing | digest / filename mismatch | medium | mitigate | `digest_bytes(bytes)` computed from the bytes actually written; an existing file whose digest differs under the same name is refused, never overwritten (Task 1). |
| T-05 | Tampering | destructive delete | high | mitigate | Delete targets are derived only from a validated digest inside the library root; one confirmation; never touches project or script paths; not reachable from the global shortcut dispatcher (Task 6). |
| T-06 | Tampering | untrusted `catalog.json` rows | medium | mitigate | Bounded parse, unknown keys ignored, malformed or mis-sized rows isolated per entry into `unavailable`; the scan never aborts and never throws (Task 2). |
| T-07 | Information disclosure / Access control | renderer filesystem scope | high | mitigate | All library IO is Rust-owned; the renderer passes bytes and digests only. The package/cache scope law holds: no renderer path construction for the library (Tasks 1, 2, 6). |
| T-08 | Tampering | AQTL / Roto `textureRotation` | medium | mitigate | ONE unit law: integer degrees in -180..180 on every in-memory and JSON carrier (stroke, catalog payload, Roto script, `catalog.json`); the AQTL byte body's i16 hundredths (-18000..18000) is the single conversion boundary, validated on both sides so a degree/hundredths mix-up cannot round-trip; the SNAP container keeps future/unknown versions as generic corruption (Task 9, Task 10). |
| T-09 | Spoofing / Tampering | child -> main brush-texture mutation IPC (`physic-paint:brush-texture-mutation-request`) | high | mitigate | The Studio child never mutates the library directly: the request is origin-checked, shape-guarded (`operation` closed to `delete` / `set-rotation`, digest exactly 64 lower-case hex, rotation an integer in -180..180), correlated by `operationId` with a bounded wait, and the main realm re-validates in Rust before any path is built; an unknown operation or malformed digest mutates nothing and answers `ok: false`; the result guard refuses unknown keys (Task 6, Task 10). |
| T-63-SC | Tampering | npm/pip/cargo installs | high | mitigate | No new dependency: `webp` 0.3.1, `sha2` 0.10 and `@tauri-apps/api` already ship. If any task finds itself adding a package, stop and add a blocking human-verify legitimacy checkpoint before the install. |
</threat_model>

<verification>
Run both suites from the repo root after every task and before the checkpoint:

- `pnpm --filter efx-motion-editor exec vitest run` (app suite; `.test.ts` only — a `.test.tsx` target would exit 0 while running nothing)
- `cd app/src-tauri && cargo test`
- `cd packages/efx-watercolor && pnpm exec vitest run` (the package has its own config; app's include list does not cover it)

Cross-cutting invariants that must hold at the end:

1. No occurrence of the retired built-in prefix in `app/src`, `packages/efx-watercolor/src` or `app/src-tauri/src` (needle built at runtime so the test does not match itself). Pinned by `app/src/lib/noRetiredTextureIds.test.ts`, which Task 10 introduces as the last retargeting task; it does not exist before then, and it is green from its introduction.
2. No `brushPack` in a saved `.mce`; no `maskDataUrl` in a saved script; no `brushes/` tree written by a save.
3. `TIP_SIZE === 192` and `TIP_MASK_BYTES === TIP_MASK_EDGE ** 2 === 262144`, with a test asserting the two constants are independent.
4. `grep generateMipmap|LINEAR_MIPMAP` matches exactly one production site (`Engine.tipTexture`).
5. `sizeToEngineScale` is byte-identical for every non-negative canonical (the literal table for 1/12/32/33/80/81/800 in `params.test.ts` is the pin); only its `Math.max(0, ...)` floor — the sole source of a sub-`1/3` `sizeMult` — is removed, so no recorded stroke gains or loses precision.
6. The renderer contains no string literal for the library root path outside `app/src/lib/brushLibrary.ts` comments and tests.
7. `textureRotation` is integer degrees in every in-memory and JSON carrier (`AquarelleStroke`, `Brush`, the store row, `PhysicPaintBrushCatalogEntry`, the Roto script stroke, `catalog.json`); hundredths exist only inside the AQTL byte body (`Math.round(degrees * 100)` on write, `/ 100` on read), pinned by the 37-degree anti-mixup test.
</verification>

<success_criteria>
- Every one of the spec's Acceptance rows is covered either by a named test or by a checkpoint row, with the two WebGL-dependent rows (512 footprint on real pixels, no shimmer at S=64) assigned to the checkpoint.
- A fresh install has Default only; import is the only path to a texture; the library survives project switches and app restarts.
- The paint size control is a true document-pixel diameter from 1 to 512: the `Math.max(0, ...)` engine floor is removed so 1 px is a real footprint (not the old saturated 28.8 px at 1080), the stored canonical is never clamped, and lift keeps its own 1..80 value.
- Rotation is snapshotted per stroke, persists through AQTL v4 and the Roto script, and is independent of the library's current value at replay.
- No texture bytes live in a project or a script; no retired built-in id survives in code, tests or docs.
- The declared loss is written in the SUMMARY.
</success_criteria>

<output>
Create `.planning/quick/261116-inu-imported-only-brush-textures-from-a-user/261116-inu-SUMMARY.md` when done, including the ten UAT rows and the declared loss.
</output>
