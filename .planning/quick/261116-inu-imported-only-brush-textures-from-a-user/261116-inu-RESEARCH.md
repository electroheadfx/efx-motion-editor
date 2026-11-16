# Quick 261116-inu: Imported-only brush textures from a user-level library, 512x512 — Research

**Researched:** 2026-11-16
**Domain:** WebGL2 tip texturing, AQTL binary codec, machine-scoped Rust IO, cross-realm Preact store
**Confidence:** HIGH on in-repo seams (every claim below was read directly this session); MEDIUM on mipmap runtime behaviour (doc-grounded, zero in-repo precedent)

## Summary

The change lands on four independent seams that already exist and are individually well-factored: (1) the GPU tip texture is created in exactly one place (`Engine.tipTexture`) with all sampler state inline, so mipmapping is a 3-line change there and nowhere else; (2) the AQTL engine block already carries one presence-prefixed optional field (`textureId`, v3) whose writer/reader/version-gate pattern is copyable byte-for-byte for `textureRotation`; (3) Rust already has `digest_bytes`, a lossless 192² brush-mask WebP codec and two atomic-write helpers — but the atomic writers are module-private, so a new `commands/brush_library.rs` needs one visibility promotion or a third copy; (4) the footprint law is already mirrored in pure math for the cursor (`aquarelleFootprint.ts`) with a test table, which is where the "512 ± 1 px" pin belongs — there is no WebGL2 vitest harness and the only real-pixel measurement is a headless-Chrome probe.

The two structural risks are not the mask edge but (a) the size law's inverse: `sizeToEngineScale` is module-private, non-injective across 32..80, and internally capped at engine scale 4 (`SIZE_SCALE_HARD_MAX`), so the spec's guardrail "if the canonical inverse cannot be expressed inside the engine ceiling, stop and report" is a real numeric gate to check first; and (b) the snapshot codec's `aqtl-retired` mapping, which today retires v1-v2 and labels v4 as corruption — it must be retargeted to retire v1-v3 and accept v4, and three test files pin the old behaviour.

**Primary recommendation:** order the work mask-edge/constants first (TS + Rust), then the px↔canonical helper as one pure function beside `aquarelleFootprint`, then the AQTL v4 field, then the Rust library commands, then the removal pass (built-ins, brushPack, maskDataUrl) — each step independently testable with the existing suites.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Brush size control
- Classic `SliderStepper`, linear 1..512, exactly like the app's other sliders. No logarithmic or any other position mapping.
- The displayed number IS the printed diameter in document pixels. 512 shown = 512 px on canvas. No conversion is ever visible.
- WYSIWYG at both ends of the range. The control always displays document pixels; the internal canonical value is never surfaced.
- Consequence accepted: the internal stored canonical value may leave its 1..800 track bounds at both ends (below 1 at S=1, above 800 at S=512 on small presets). The 1..800 range remains only the legacy stroke-settings slider range. The engine stays the source of truth; the UI never lies. No clamping of the stored value.
- Lift/eraser size is untouched: it keeps its existing 1..80 control and is never written by the paint size control.

#### Rotation UI
- The -180..180 rotation stepper lives in the floating Textures modal only, directly under the Brush size control, next to the chip strip.
- The top-bar popover stays a fast picker: chips plus "Open modal". No rotation control there.
- `catalog.json` is written on release / step commit, not per drag tick.

#### Retired built-in ids
- No retired-id table, no special case. `wc/builtin-bristle`, `-chalk`, `-sponge` resolve as generic missing textures and take the existing one-aggregate-warning fallback path.
- This follows the spec guardrail "remove every `wc/builtin-*` reference" and the clean-break rule.

### Claude's Discretion
- Everything else follows the spec's law verbatim: the px <-> canonical mapping formulas, the 512 mask edge with `TIP_SIZE` left at 192, mipmapped LINEAR sampling, the AQTL v3 -> v4 bump, the Rust-owned library commands, and the removal of the project/script carriers.
- The exact helper name and module for the px <-> canonical mapping.
- The exact delete-confirmation presentation, provided it is a single confirmation scoped to the Textures surface focus.

### Deferred Ideas (OUT OF SCOPE)
None stated in CONTEXT.md.
</user_constraints>

## Findings by Question

### Q1 — WebGL2 mipmaps on the tip texture

- **WebGL2 only, no fallback.** `Engine.ts:313-322` calls `canvas.getContext('webgl2', {...})` and throws `'WebGL2 is not available in this browser.'` when null; it then requires `EXT_color_buffer_float` / `EXT_color_buffer_half_float`. `[VERIFIED: packages/efx-watercolor/src/playground/Engine.ts:313-322]`
- **The tip texture has exactly one creation site.** `Engine.tipTexture(b)` at `Engine.ts:1319-1335`: `gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, b.tipSize, b.tipSize, 0, gl.RED, gl.UNSIGNED_BYTE, b.tipData)` then `TEXTURE_MIN_FILTER = gl.LINEAR`, `TEXTURE_MAG_FILTER = gl.LINEAR`, wrap `CLAMP_TO_EDGE`, `UNPACK_ALIGNMENT 1`. Cached in `private tipTextures = new Map<string, WebGLTexture>()` (`Engine.ts:238`) keyed by `brushTipCacheKey` = `` `${b.id}|${b.textureId ?? ''}` `` (`brushes.ts:83-85`). `[VERIFIED: Engine.ts:238,1304,1319-1335; brushes.ts:83-85]`
- **Cache invalidation already exists and needs no change:** `forgetBrush` deletes keys equal to or prefixed `` `${id}|` `` (`Engine.ts:1297-1304`), `clearTipTextures` clears all (`1314-1317`), `dispose` clears all (`1534-1535`). `[VERIFIED: Engine.ts:1297-1304,1314-1317,1534-1535]`
- **Sampler state lives ONLY in `tipTexture`.** The shared GL helper `bindTex` does nothing but `activeTexture`+`bindTexture` (`gl.ts:176`); `GL.texture()` sets MIN and MAG to the same filter and `GL.target()` allocates with `texStorage2D(..., 1, ...)` (single level, `gl.ts:84,162`). So `LINEAR_MIPMAP_LINEAR` must be set in `tipTexture` and the mipmap call placed there; do not route the tip through `GL.target`/`GL.texture`. `[VERIFIED: packages/efx-watercolor/src/playground/gl.ts:84,162,176]`
- **Zero precedent.** `grep generateMipmap|LINEAR_MIPMAP` over `app/src`, `packages/efx-watercolor/src`, `app/src-tauri/src` → no matches. `[VERIFIED: repo grep, 2026-11-16]`
- **Legality of `generateMipmap` on `R8`:** in WebGL2 (ES 3.0.4 §3.8.9, adopted by both Chromium and Mozilla validation) a sized internal format passed to `generateMipmap` must be both color-renderable and texture-filterable; `R8` is both, so `gl.generateMipmap` is legal in core WebGL2 with no extension. Mipmap sampling then requires a mipmap MIN filter and a complete chain (level 0 upload + `generateMipmap` supplies it); MAG stays `LINEAR`. `[CITED: registry.khronos.org/webgl/specs/latest/2.0 (via Chromium/Mozilla validation of ES 3.0.4 §3.8.9); webgl2fundamentals.org format table]`
- **Shaders need no change for reduction:** `stampFS` samples `texture(uTip, uv).r` (`shaders.ts:35-66`) and `liftFS` samples `texture(uTip, clamp(q*0.5+0.5, 0.0, 1.0)).r` (`shaders.ts:272-287`); mip selection is derived from the filter mode and derivatives. `[VERIFIED: packages/efx-watercolor/src/playground/shaders.ts:35-66,272-287]`
- **Cost:** 512² = 262,144 bytes level-0; the full chain adds 1/3 ≈ 349 KB VRAM per distinct `(id, textureId)`.

### Q2 — AQTL presence-prefixed scalar field

- **Version constant + gate:** `export const SCRIPT_TIMELINE_BINARY_VERSION = 3;` (`scriptTimelineCodec.ts:108`); decode refuses anything else at `1089-1092` (`fail('unsupported-version', ...)`). The header is `'AQTL'` + u16 version at offset 4; there is no other version site. `[VERIFIED: app/src/components/physic-paint/performance/scriptTimelineCodec.ts:108,1089-1092]`
- **Exact engine-block order (encode, `685-747`):** tool u8 → color presence+string → brushId string → params (u32 count + sorted key/value) → toolOverrides mask → mutationId presence+u32 → diffusionFrames presence+u32 → timestamp f64 → playFrame presence+i32 → `encodeVectorBlock(...)` (line 731) → **textureId presence+string (738-747)** → pts u32 + 16-byte point records. A new `textureRotation` slots immediately after `textureId`. `[VERIFIED: scriptTimelineCodec.ts:685-747]`
- **Reader primitives:** writer has `u8,u16,u32,i32,i16,f32,f64,string,patchU32,finish` (`283-343`) — **`i16` already exists**, which is exactly the spec's hundredths-of-a-degree carrier. Reader has `presence(what)` (u8 0/1, ~line 432) plus the same primitives; there is **no** presence-prefixed numeric helper, so the new field composes `presence('engine.textureRotation')` + `reader.i16(...)` (and writer `u8(1)` + `i16`). `[VERIFIED: scriptTimelineCodec.ts:283-343,432]`
- **Decode + rebuild:** engine decode `968-1020`, textureId at `1013-1020`, and the conditional spread `...(textureId !== undefined ? { textureId } : {})` at `1044` — the same absence law must hold for rotation (`absent` stays absent; `0` when the library says 0 must still be written because the spec says "presence-prefixed, absent = 0" — deciding whether to omit an explicit 0 is the planner's call, but the reader must treat absent as 0). `[VERIFIED: scriptTimelineCodec.ts:968-1020,1013-1020,1044]`
- **Byte-layout pin:** `expect(MINIMAL_BYTES.byteLength).toBe(95);` with the comment "v1 measured 93 bytes; v2 adds the one vector-flags byte ...; v3 adds the textureId presence byte (63-15)" (`scriptTimelineCodec.test.ts:902-907`). A rotation presence byte alone makes the minimal v4 layout **96**; the version field is u16 so bumping 3→4 costs nothing. `[VERIFIED: scriptTimelineCodec.test.ts:902-907]`
- **v1/v2 refusal test:** `scriptTimelineCodec.test.ts:918-926` writes version 1 then 2 and expects `unsupported-version`. `[VERIFIED: scriptTimelineCodec.test.ts:918-926]`
- **SNAP container mapping is the trap:** `studioScriptSnapshotCodec.ts:619-645` catches the inner `unsupported-version`, reads the inner u16, and maps **only inner version 1 or 2** to `fail('aqtl-retired', 'AQTL body predates the texture format')`; anything else falls through to `watercolor`. Its test pins v0/v4/v7 → `watercolor` (`studioScriptSnapshotCodec.test.ts:421-423`) and v1/v2 → `aqtl-retired` (`408-413`). After the bump, v3 must join the retired set and v4 must be accepted. `[VERIFIED: app/src/components/physic-paint/performance/studioScriptSnapshotCodec.ts:619-645; studioScriptSnapshotCodec.test.ts:388-433]`
- **Third version loop:** `studioScriptSnapshotController.test.ts:434` iterates `[1,2,3,4]`. `[VERIFIED: app/src/components/physic-paint/snapshot/studioScriptSnapshotController.test.ts:434]`

### Q3 — Roto script stroke payload

- **Schema version does not move for an optional engine field:** `export const ROTO_SCRIPT_SCHEMA_VERSION = 1 as const;` (`physicsPaintRotoScriptSchema.ts:25`); `textureId` was added without a bump. `[VERIFIED: app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts:25]`
- **Engine-payload guard:** `if (value.textureId !== undefined && (typeof value.textureId !== 'string' || value.textureId.length === 0)) return false;` (`physicsPaintRotoScriptSchema.ts:480`); the comment says the rule is duplicated from the payload codec on purpose because "a saved Roto script can reach this guard without ever calling the codec". A numeric `textureRotation` needs its own guard here (integer, −18000..18000). `[VERIFIED: physicsPaintRotoScriptSchema.ts:476-481]`
- **The mask carrier to delete:** `ROTO_SCRIPT_LIMITS.maskDataUrlBytes = 512 * 1024` (`schema:43`); `decodeScriptMaskDataUrl` (`536-553`) enforces the WebP prefix, an arithmetic byte cap before allocation, canonical base64, and `dimensions?.width !== TIP_SIZE || dimensions.height !== TIP_SIZE` (line 548). `[VERIFIED: physicsPaintRotoScriptSchema.ts:43,536-553]`
- **Script library carrier:** `ScriptBrushTipEntry = AquarelleTip & { readonly maskDataUrl: string }` (`physicsPaintRotoScriptLibrary.ts:325`), mask built at 368, `referencedCustomBrushIds` collects `event.engine.textureId` (396), `decodeScriptMaskDataUrl` used at 440, length gate `TIP_MASK_BYTES` at 457. `[VERIFIED: app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts:325,368,396,440,457]`
- **Save-refusal depends on the catalog-synced flag:** `physicsPaintRotoScriptLibrary.ts:744` uses `brushCatalogSynced.value` to choose between "mask cannot travel" and "this Studio never received the project's brush catalog". A machine-scoped catalog keeps this flag true after boot, which simplifies (but does not remove) the message. `[VERIFIED: physicsPaintRotoScriptLibrary.ts:738-747]`
- **Playback copy:** `physicsPaintRotoPlayScriptController.ts:4398` `...(stored?.textureId !== undefined ? { textureId: stored.textureId } : {})` — the rotation copy joins this line. Duplicate-script copy at `physicsPaintRotoDuplicateScript.ts:213`. `[VERIFIED: app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts:4398; physicsPaintRotoDuplicateScript.ts:213]`
- **Stroke type + record capture:** `AquarelleStroke` (`payload/toStudioStroke.ts:140-162`) with `textureId?: string` at `148`; capture at `aquarelleRecordState.ts:1847-1869` (`const textureId = engine.textureId;` then `...(textureId !== undefined ? { textureId } : {})` at 1869); cut/copy at `2115`; vector-path handles at `vectorPathHandles.ts:1019`. `[VERIFIED: packages/efx-watercolor/src/payload/toStudioStroke.ts:140-162; app/src/components/physic-paint/view/aquarelleRecordState.ts:1847-1869,2115; view/vectorPathHandles.ts:1019]`
- **Brush resolution seam:** `BrushStrokeOptions` (`brushBridge.ts:65-72`) has `textureId?`, `overrides?`, `seed?`; `resolveStrokeBrush` returns `{ ...buildBrush(...), textureId: mask ? textureId : null }` (`87-94`). `textureRotation` joins this options object and the returned `Brush`. `[VERIFIED: packages/efx-watercolor/src/playground/brushBridge.ts:65-72,87-94]`
- **Rust does NOT validate per-stroke engine fields:** `validate_brush_pack` (`script_library.rs:2658-2667`) checks only `kind` + `entries` array; `validate_envelope_stroke` (`2706`) covers points/ticks/cuisson/motion/brushId/toolOverrides/traceSeed/recordedOrder/playFrame/color. `textureRotation` needs no Rust change. `[VERIFIED: app/src-tauri/src/services/script_library.rs:2583,2658-2667,2706]`

### Q4 — `webp` crate lossless encode

- `webp = "0.3.1"` (`app/src-tauri/Cargo.toml:33`). `[VERIFIED: app/src-tauri/Cargo.toml:33]`
- The real call (`frame_codec.rs:40-67`) expands alpha to RGBA with RGB constant 255, then: `config.lossless = 1; config.exact = 1; config.alpha_compression = 0; config.quality = 100.0; config.method = 6;` and `webp::Encoder::from_rgba(&rgba, BRUSH_MASK_EDGE, BRUSH_MASK_EDGE).encode_advanced(&config)`. **There is no trailing `1` argument** — the `webp` lossless path is selected by the config, not an argument. (The task prompt's description differs from the code; the code is authoritative.) `[VERIFIED: app/src-tauri/src/services/frame_codec.rs:40-67]`
- Decode reads the alpha channel only (`pixel[3]`, `frame_codec.rs:153-172`) after a declared-dimension gate that runs before any pixel allocation. Byte-identical lossless round-trip is asserted in the module tests (`frame_codec.rs` tests, ~412-510). `[VERIFIED: frame_codec.rs:76-172,395-511]`

### Q5 — SHA-256 and atomic writes in Rust

- `sha2 = "0.10"` (`Cargo.toml:31`); `pub fn digest_bytes(bytes: &[u8]) -> String` (`services/efx_paint_media.rs:276-278`) and `pub fn digest_file` (`280-296`) are **public** and reachable. `[VERIFIED: app/src-tauri/Cargo.toml:31; app/src-tauri/src/services/efx_paint_media.rs:276-296]`
- **Both atomic writers are module-private.** `fn write_atomically(target: &Path, bytes: &[u8])` (`services/efx_paint_media.rs:874-899`: temp `MEDIA_WRITE_TEMP_PREFIX + uuid + .tmp` → write_all → sync_all → rename → parent fsync) and `fn atomic_write_bytes(path: &Path, bytes: &[u8], replace: bool)` (`services/script_library.rs:3002-3040`: refuses existing unless `replace`, `MAX_FILE_BYTES` cap, `reject_symlink`, create_new temp, write, sync_all, rename, `sync_directory`, temp cleanup on error). A new `commands/brush_library.rs` cannot call either as-is — it needs a `pub(crate)` promotion or its own copy (precedent: `script_library` already owns a copy rather than importing efx_paint_media's). `[VERIFIED: efx_paint_media.rs:874-899; script_library.rs:3002-3053]`
- **Home-root convention:** `fn config_path()` uses `PathBuf::from(std::env::var("HOME").unwrap_or_else(|_| "/tmp".into())).join(".config/efx-motion/builder-config.yaml")` (`commands/config.rs:28-31`) — deliberately HOME-based, not the `dirs` crate (macOS `dirs` maps to ~/Library/Application Support). The library root must follow this same convention per the spec. `[VERIFIED: app/src-tauri/src/commands/config.rs:28-31]`
- **Command registration point:** `lib.rs:972-974` registers `efx_paint_encode_brush_mask`, `efx_paint_write_brush_asset`, `efx_paint_decode_brush_mask` in the `generate_handler!` list; new `brush_library_*` commands join there. `[VERIFIED: app/src-tauri/src/lib.rs:972-974]`
- **Existing write path is package-scoped, not library-scoped:** `efx_paint_write_brush_asset` takes `packageDir`/`relativePath`/`stagingBasename` headers (`commands/efx_paint_media.rs:187-210`) — it cannot be reused for `~/.config/efx-motion/brushes/`. `[VERIFIED: app/src-tauri/src/commands/efx_paint_media.rs:183-210]`

### Q6 — main-realm vs Studio child-realm library load

- **The catalog is project-scoped today.** `closeProject` (`projectStore.ts:1213-1258`) calls `resetAquarelleBrushState()` at `1248`, whose comment says "closing a project leaves exactly the three built-in tips". `[VERIFIED: app/src/stores/projectStore.ts:1213-1258]`
- `resetAquarelleBrushState` (`aquarelleBrushCatalog.ts:234-239`) = `resetAquarelleBrushCatalog()` + `resetMaskRegistry()` + `resetBrushAssets()` + `brushCatalogPublisher()`. It is the ONLY production caller chain (grep: only `projectStore.ts:1248`). `[VERIFIED: app/src/stores/aquarelleBrushCatalog.ts:215-239; grep, 2026-11-16]`
- **Studio bootstrap is a pull-on-mount.** `usePhysicsPaintBrushCatalogBridge` (`usePhysicsPaintParentBridge.ts:218-233`) registers triple transport (Tauri `listen` + CustomEvent + origin-checked `postMessage`), applies each payload through `applyBrushCatalogPayload`, and ends the effect with `void requestPhysicPaintBrushCatalog()` (line 230) because the child webview is re-booted on every layer switch. Main side: `installPhysicPaintBrushCatalogRequestListener` (`physicPaintBridge.ts:3306-3344`) answers by republishing; the publisher hook is installed at `3313-3317`. `[VERIFIED: app/src/components/physic-paint/bridge/usePhysicsPaintParentBridge.ts:218-233; app/src/lib/physicPaintBridge.ts:3306-3344]`
- **Boot install order (the seam for a machine-scoped load):** `main.tsx:107-111` — `initTempProjectDir().then(async () => { await initTheme(); await paintStore.initFromPreferences(); render(<App />, root); startAutoSave(); ... })`; the brush import listener installs at `150`, the catalog request listener at `156`. `paintStore.initFromPreferences()` (called at `109`) is the existing boot-loaded, app-scoped (not project-scoped) store precedent — the library scan/decode belongs beside it, before `render` so it precedes any replay. `[VERIFIED: app/src/main.tsx:107-111,144-156]`
- **Payload staleness key is project-scoped:** `buildBrushCatalogPayload(projectStore.projectContextId.peek())` (`physicPaintBridge.ts:3256`) and `applyBrushCatalogPayload` compares against the realm's current context id (`aquarelleBrushCatalog.ts:399-437`). A machine-scoped catalog needs a different staleness key (or none) — flag for the plan. `[VERIFIED: app/src/lib/physicPaintBridge.ts:3256; app/src/stores/aquarelleBrushCatalog.ts:399-437]`
- **Import handler is project-bound today:** `applyBrushImportRequest` (`efxPaintBrushImport.ts:115-163`) validates `TIP_MASK_BYTES`, calls `ipcEfxPaintEncodeBrushMask`, mints `freshCustomId()` (monotonic counter + random, `104-107`), then batches `registerMask` / `addCustomBrushTip` / `rememberBrushAsset(digest, webp)` / `projectStore.markDirty()`, and the asset ref is `buildBrushAssetRelativePath(digest)` (package-relative). Every one of those four writes must retarget to the machine library, and the id must become content-derived `wc/custom-<digest prefix>` (spec supersedes D-16). `[VERIFIED: app/src/lib/efxPaintBrushImport.ts:104-107,115-163]`
- **What breaks if the catalog stops clearing on close:** nothing structural. `brushCatalogSynced` (`aquarelleBrushCatalog.ts:85,104,435`) only improves the save-refusal message (`physicsPaintRotoScriptLibrary.ts:744`). Dead texture ids are already guarded at stroke time: `aquarelleBrushForActiveTool` returns `textureId: ... resolveMask(textureId) !== null ? textureId : null` (`aquarelleRecordState.ts:405`). `aquarelleSelectedTextureId` (`aquarelleRecordState.ts:132`) is never reset on project close — with a machine library that becomes correct behaviour, but the delete flow must still reset it to Default per spec. `[VERIFIED: aquarelleBrushCatalog.ts:85,104,435; aquarelleRecordState.ts:132,405; physicsPaintRotoScriptLibrary.ts:744]`
- **Two-realm decode load is pre-existing:** both `BrushesDocker.tsx:232` and `WatercolorBrushLibrary.tsx:138` run `importTip` in the Studio realm; the main realm only encodes/registers. `[VERIFIED: app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx:138-144; view/BrushesDocker.tsx:232-233]`

### Q7 — mask-edge change blast radius

**TypeScript (package)**
- `export const TIP_SIZE = 192;` (`playground/brushes.ts:87`) — procedural tips; must NOT move. `[VERIFIED: packages/efx-watercolor/src/playground/brushes.ts:87]`
- `export const TIP_MASK_BYTES = TIP_SIZE * TIP_SIZE` (`brushes/deriveMask.ts:42`) and `deriveMask(..., pixelCount: number = TIP_SIZE * TIP_SIZE)` (`deriveMask.ts:53-56`) — the constant must split from `TIP_SIZE`; `deriveMask` already accepts an explicit pixel count, so only the default and callers move. `[VERIFIED: packages/efx-watercolor/src/brushes/deriveMask.ts:41-56]`
- `importTip.ts`: `const TIP_PIXELS = TIP_SIZE * TIP_SIZE` (`186`), 192 canvas (`193-201`), `rgba.length !== TIP_PIXELS * 4` gate (`278`); caps `IMPORT_TIP_MAX_BYTES = 64 * 1024 * 1024` (`36`) and `IMPORT_TIP_MAX_PIXELS = 64_000_000` (`39`), single-flight chain (`303-310`). `[VERIFIED: packages/efx-watercolor/src/brushes/importTip.ts:36-39,186-213,248-310]`
- `maskRegistry.ts`: `TIP_MASK_BYTES` gate at `67`, built-in seeding at `41,54,57,133`, reserved-id refusals at `85,114` — the reserved-id machinery is a removal target. `[VERIFIED: packages/efx-watercolor/src/brushes/maskRegistry.ts:26-133]`
- Removal set: `builtinTips.ts`, `builtinTipMasks.generated.ts`, `builtinTips.test.ts`, `builtinBake.test.ts`, `BUILTIN_TIPS`/`BUILTIN_TIP_MASKS` exports (`brushes/index.ts`/`playground/index.ts`), `pack.ts`'s pack kind if the brush pack dies. `[VERIFIED: dir listing packages/efx-watercolor/src/brushes; grep, 2026-11-16]`
- **`buildBrush` already derives the mask edge from the mask:** `tipSize = Math.round(Math.sqrt(source.length))` for a `Uint8Array` tip, else `TIP_SIZE` (`brushes.ts:365-380`) — a 512² mask flows through untouched. `[VERIFIED: brushes.ts:365-380]`

**TypeScript (app)**
- `types/physicPaint.ts:3000` `return width === TIP_SIZE && height === TIP_SIZE;` and the mask-length gates at `3008`/`3040`; comment at `2498` says "exactly TIP_MASK_BYTES after decode". `[VERIFIED: app/src/types/physicPaint.ts:2496-2500,2990-3040]`
- `aquarelleBrushCatalog.ts:408` `mask.length !== TIP_MASK_BYTES` gate; `264` seeds `BUILTIN_TIP_MASKS`. `[VERIFIED: app/src/stores/aquarelleBrushCatalog.ts:264,399-437]`
- `watercolorMaskChip.ts:52-56` sizes its canvas from `TIP_SIZE` and allocates `createImageData(TIP_SIZE, TIP_SIZE)` — spec requires the resolved mask's own edge instead. `[VERIFIED: app/src/components/physic-paint/view/watercolorMaskChip.ts:52-56]`
- `physicsPaintRotoScriptLibrary.ts:457`, `physicsPaintRotoScriptSchema.ts:548`, `lib/efxPaintBrushSet.ts:290`, `lib/efxPaintBrushImport.ts:12,120`. `[VERIFIED: grep, 2026-11-16]`

**Rust**
- `pub const BRUSH_MASK_EDGE: u32 = 192;` and `pub const BRUSH_MASK_BYTES: usize = (BRUSH_MASK_EDGE * BRUSH_MASK_EDGE) as usize;` (`frame_codec.rs:21,23`); error copy "brush mask must be exactly {BRUSH_MASK_BYTES} bytes (192x192); got {}" (`43`); decode gate `width == BRUSH_MASK_EDGE && height == BRUSH_MASK_EDGE` (`156`) and `163`. `[VERIFIED: app/src-tauri/src/services/frame_codec.rs:18-67,153-172]`
- `commands/efx_paint_media.rs:155` comment, `178-179`/`233-234` response width/height, tests `366-400`. `services/efx_paint_media.rs:34,80` comments + read-cap justification. `[VERIFIED: app/src-tauri/src/commands/efx_paint_media.rs:154-236,366-400]`
- `.mce` carrier: `#[serde(default, rename = "brushPack", skip_serializing_if = "Option::is_none")] pub brush_pack: Option<MceBrushPackSnapshot>` (`models/project.rs:69-70`), tests `529-588`, `commands/project.rs:81` default. TS mirror `types/project.ts:65-69`. `[VERIFIED: app/src-tauri/src/models/project.rs:64-70,529-588; app/src/types/project.ts:65-69]`
- Script `brushPack`: `script_library.rs:2583` (`validate_brush_pack(object.get("brushPack"))?`), `2658-2667`, test fixtures `3941`, `4015`. `[VERIFIED: app/src-tauri/src/services/script_library.rs:2583,2658-2667,3941,4015]`

**Tests hardcoding `wc/builtin-*`** (all need retargeting): `app/src/stores/aquarelleBrushCatalog.test.ts` (multiple, incl. reserved-id assertions `396-424`), `roto/aquarelleLiftErase.test.ts:749`, `roto/physicsPaintRotoScriptSchema.test.ts:383-410`, `roto/physicsPaintRotoPlayScriptController.bake.test.ts:617-664`, `roto/physicsPaintRotoPlayScriptController.test.ts:215,5639,6885`, `roto/physicsPaintRotoScriptLibrary.test.ts:1027-1090`, `roto/physicsPaintRotoDuplicateScript.test.ts:463-488`, `view/aquarelleLiftTipSelection.test.ts:214-298`. No test today asserts "no `wc/builtin-*` remains anywhere" — that invariant is new. `[VERIFIED: grep, 2026-11-16]`

### Q8 — import and decode path performance

- **Decode runs in the Studio realm, on a 2D canvas:** `decodeRgbaAtTipSize` (`importTip.ts:213+`) sets `canvas.width/height = TIP_SIZE`, `getContext('2d', { willReadFrequently: true })`, `drawImage(source, 0, 0, TIP_SIZE, TIP_SIZE)`, `getImageData(...).data` (`186-202`). Raising the edge to 512 is 4× canvas area and a 1 MB RGBA transient per import — one-off, acceptable; the browser does the resample. `[VERIFIED: packages/efx-watercolor/src/brushes/importTip.ts:186-213]`
- **Guards before decode:** file size > 64 MB and decoded pixel count > 64 MP are refused before any buffer is allocated (`importTip.ts:248-267`); imports are serialised single-flight through a promise chain (`303-310`). `[VERIFIED: importTip.ts:248-310]`
- **Native encode cost:** one lossless WebP encode at `method = 6`, `quality = 100` per import (`frame_codec.rs:53-66`) — the highest-effort profile is intentional because it happens once at import. At 512² the input is 262,144 bytes; expect low-hundreds of ms worst case, off the render thread (`#[tauri::command(async)]`). `[VERIFIED: frame_codec.rs:30-67; app/src-tauri/src/commands/efx_paint_media.rs:158]`
- **Startup cost:** spec requires scan + decode of every library entry before first replay. At 512², each mask is 262 KB in the main realm (JS heap) plus GPU upload on first use. 20 textures ≈ 5 MB JS + ~7 MB VRAM — fine; per-entry failure must degrade that tip alone (spec, guardrail "fail-closed per entry"). `[ASSUMED: sizing arithmetic; measured only for the 192² case]`
- **The script mask cap today:** `maskDataUrlBytes = 512 * 1024` (`schema:43`) — with masks removed from scripts this cap and its arithmetic disappear. `[VERIFIED: physicsPaintRotoScriptSchema.ts:43]`

### Q9 — test infrastructure constraints

- **App test include list:** `app/vitest.config.ts:5` — `include: ['src/**/*.test.ts', '../packages/efx-paint-host/src/**/*.test.ts']`. Only `.test.ts`; a `.test.tsx` target silently runs nothing. `packages/efx-watercolor` tests are NOT in this include — they run under the package's own `vitest run` (`packages/efx-watercolor/package.json:63`). `[VERIFIED: app/vitest.config.ts:1-11; packages/efx-watercolor/package.json:59-64]`
- **Configured phase test command:** `"test_command": "pnpm --filter efx-motion-editor exec vitest run"` (`.planning/config.json`); CLAUDE.md forbids watch mode. `[VERIFIED: .planning/config.json]`
- **Rust:** inline `#[cfg(test)] mod tests` (e.g. `frame_codec.rs` ~395-511, `script_library.rs` from ~3900) plus integration crates in `app/src-tauri/tests/` — `efx_paint_package.rs`, `physic_paint_cache_publication.rs`, `script_library_command_contract.rs`, `script_library_filesystem.rs`, `script_library_lifecycle.rs`, `script_library_schema.rs`, `script_library_transaction_contract.rs`. Run with `cargo test` in `app/src-tauri`. `[VERIFIED: dir listing; grep, 2026-11-16]`
- **Existing pins that will break on the v4 bump:** `SCRIPT_TIMELINE_BINARY_VERSION === 3` (`scriptTimelineCodec.test.ts:380`), `MINIMAL_BYTES === 95` (`:906`), v1/v2 refusal (`:918-926`), snapshot `v0/v4/v7 → watercolor` (`studioScriptSnapshotCodec.test.ts:421-423`), `[1,2,3,4]` loop (`studioScriptSnapshotController.test.ts:434`). `[VERIFIED: those files:lines]`
- **Brush/engine unit tests that need no WebGL:** `packages/efx-watercolor/src/playground/{params,brushBridge,engineTipIdentity,engineScriptWidth}.test.ts` — the established pattern is prototype-instance math tests (`engineScriptWidth.test.ts:1-17` states "No WebGL2 is required ... the real-pixel proof lives in probe/vector-spine"). `[VERIFIED: packages/efx-watercolor/src/playground/engineScriptWidth.test.ts:1-17]`

### Q10 — footprint measurement test precedent

- **There is a pure-math footprint law already shared with the cursor:** `app/src/components/physic-paint/engine/aquarelleFootprint.ts` — `aquarelleFootprintFor(input)` (`132-161`) returns `radiusDoc` in document heights using `engineSizeMult(size)` (`101-103`, `3^((toEngineParams({size}).size - 0.5)*2)`) and `brushRadius(brush, pressure, sizeMult)` (`106-109`, `(size[0] + (size[1]-size[0])*t) * sizeMult * 0.8`, i.e. `Engine.radius` at speed 0); `footprintCssSize(footprint, layerHeightCss)` (`184-192`) returns `width = max(4, 2 * radiusDoc * layerHeightCss)`. `[VERIFIED: aquarelleFootprint.ts:100-109,132-161,184-192]`
- **So the "Round, 1080-tall doc, S=512 → 512 ± 1 px" pin is expressible with no GPU:** it is `footprintCssSize(aquarelleFootprintFor({tool:'brush', tipId:'round', textureId:null, toolOverrides:null, size:<canonical>, pressure:1, moveAngle:0, tiltX:0, tiltY:0}), 1080).width`. Note `footprintCssSize`'s 4 px floor does not bite at 512. `[VERIFIED: aquarelleFootprint.ts:36-51,184-192]`
- **Its test file already has a radius table:** `aquarelleFootprint.test.ts:75` `describe('radius law (footprint table)')`, `:206` cache-generation tests, `:247` the texture axis, `:268` `describe('footprintCssSize')` — the new pin extends this file. `[VERIFIED: app/src/components/physic-paint/engine/aquarelleFootprint.test.ts:75,206,247,268]`
- **Real-pixel measurement exists only as a scratch probe:** `packages/efx-watercolor/probe/vector-spine/run.mjs` bundles `probe.ts` with esbuild and runs it in headless Chrome (real WebGL2), `--scenario width` writes `/tmp/vector-spine/width-result.json`; `measureWidthFromPixels` (`probe.ts:576-604`) scans the middle band's widest row counting pixels where `255 - min(r,g,b) > 8`, radius = width/2. Not part of vitest. `[VERIFIED: packages/efx-watercolor/probe/vector-spine/run.mjs:1-50; probe.ts:576-604]`
- **The cursor input's `size` is the canonical track value:** the doc comment says "Canonical AQUA-04 size (0..80, the top-bar slider)" (`aquarelleFootprint.ts:43-44`), while the Stroke Settings track is 1..800 — two different author-facing numbers over the same `sizeToEngineScale`. `[VERIFIED: aquarelleFootprint.ts:43-44; packages/efx-watercolor/src/playground/params.ts:46-65]`
- **The size law's inverse is the numeric risk.** `function sizeToEngineScale(sizePx)` (`params.ts:60-65`) returns `max(0, sizePx/32)` ≤ 32, `1` for 32..80, and a linear 1→`SIZE_SCALE_AT_MAX = 2.04795` band 80→`SIZE_MAX_PX = 800`, hard-capped at `SIZE_SCALE_HARD_MAX = 4`. It is module-private and **not injective on 32..80**; its inverse must therefore take the `scale * 32` branch for scale ≤ 1 (CONTEXT specifics) and cannot reach engine scales above 4 at all — the spec's "if the canonical inverse cannot be expressed inside the engine ceiling, stop and report" gate fires exactly there. `[VERIFIED: packages/efx-watercolor/src/playground/params.ts:46-65]`
- **The two size controls share ONE state today:** `PhysicsPaintTopBar.tsx:436` `const liveBrushSize = aquarelleParams.value.size;` feeds both the Eraser control (`:543` `min={1} max={80}`) and the Brush control (`:565-576` `min={1} max={80}`); the Textures modal also reads the same value (`PhysicsPaintTextureModal.tsx:124,141` max 80) as does the right panel (`PhysicsPaintRightPanel.tsx:458-461`). Splitting paint from lift is a genuine state split, and `aquarelleParams.size` defaults to `12` (`aquarelleRecordState.ts:90-100`). `[VERIFIED: app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx:436,537-576; view/PhysicsPaintTextureModal.tsx:124-141; view/PhysicsPaintRightPanel.tsx:458-461; view/aquarelleRecordState.ts:90-109]`
- Out of scope but adjacent: `paintStore.brushSize` with `BRUSH_SIZE_MIN = 1` / `BRUSH_SIZE_MAX = 200` (`types/paint.ts:142-143`) is the OTHER paint mode's basic-brush size, not this control. `[VERIFIED: app/src/types/paint.ts:128-143]`

## Project Constraints (from CLAUDE.md)

- Preact + `@preact/signals` only — no React patterns, no `useState`; consult `efx-preact-reactivity` for any store/effect work (the catalog and size stores are signal stores).
- `vitest run` only, never watch. Vitest collects `.test.ts` only (a `.test.tsx` target runs nothing).
- pnpm, never npm. Do not run the dev server — the user does that.
- Never push; remote ops belong to the user.
- Use `bd` for task tracking; `.planning` artifacts and tracking text in English.
- Clean break: no backward-compatibility or migration code for old project/script formats.
- All package AND cache path IO goes through Rust — the renderer must never touch `~/.config/efx-motion/brushes/` (static scans pin both scopes).

## Validation Architecture

**Test framework:** vitest (app: `app/vitest.config.ts`, include `src/**/*.test.ts`; package: `packages/efx-watercolor` own `vitest run`) + Rust `cargo test` (inline modules + `app/src-tauri/tests/*`). Quick run: `pnpm --filter efx-motion-editor exec vitest run <path>` and `cargo test <filter>` in `app/src-tauri`. Phase gate: both suites green.

| Behaviour to pin | Test type | Where |
|---|---|---|
| 512² mask round-trip byte-identical; wrong-size refusal; RIFF dimension gate | Rust unit | `services/frame_codec.rs` tests; `commands/efx_paint_media.rs` tests |
| library scan/write/decode/delete, atomicity, digest-collision refusal | Rust unit + `tests/script_library_*`-style integration | new `commands/brush_library.rs` tests |
| import writes outside the project; save produces no `brushPack`/`brushes/`; script has no mask bytes; same bytes → one row | TS integration | `efxPaintBrushImport.test.ts` (exists), `efxPaintBrushSet.test.ts`, `aquarelleBrushCatalog.test.ts` |
| AQTL v4 round-trip; v1-v3 refuse; snapshot maps v1-v3 → `aqtl-retired`, accepts v4 | TS unit | `scriptTimelineCodec.test.ts`, `studioScriptSnapshotCodec.test.ts`, `studioScriptSnapshotController.test.ts` |
| rotation: absent = 0 raster-identical; recorded 37° replays; library 0 does not override a recorded 37° | TS unit | play-script controller tests + codec tests |
| size: Round@1080 S=512 → 512 ± 1 px; px↔canonical round-trip stable; paint vs lift never overwrite | TS unit (pure math) | `aquarelleFootprint.test.ts` |
| no `wc/builtin-*` remains | TS static invariant | new test (grep-style over `app/src`, `packages/efx-watercolor/src`, `app/src-tauri/src`) |
| footprint at 512 on real pixels (optional, human-run) | probe | `node packages/efx-watercolor/probe/vector-spine/run.mjs --scenario …` |

Wave 0 gaps: no new framework needed. The only missing infrastructure is the static-invariant test module and any probe scenario for 512.

## Security Domain

`security_enforcement` is absent from `.planning/config.json` → treated as enabled.

| ASVS Category | Applies | Control |
|---|---|---|
| V2/V3 Authentication / Session | no | local desktop app, no sessions |
| V4 Access Control | yes (scoped) | fixed library root from `HOME`; renderer never passes a path; commands take bytes only |
| V5 Input Validation | yes | 512² exact-length gates TS+Rust; RIFF declared-dimension gate before allocation (`frame_codec.rs:153-172`); AQTL bounds-checked reader; catalog JSON validated on scan |
| V6 Cryptography | no new | SHA-256 for content addressing only (`sha2`), not secrecy |

Threat patterns to plan for: path traversal / symlink escape in the library root (mirror `reject_symlink`, `script_library.rs:3053`); oversized WebP decompression bomb (the existing dimension-first gate is the control — keep it for 512); partial-write corruption of `catalog.json` (atomic temp+rename + fsync, `script_library.rs:3002-3040`); digest collision / same-digest-different-bytes (refuse, per spec).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | 20-texture startup cost (~5 MB JS heap + ~7 MB VRAM) is acceptable | Q8 | Perf review needed if libraries are much larger; mitigations are lazy upload, not a design change |
| A2 | The px↔canonical inverse is expressible for every `(response, S)` in 1..512 | Q10 | Spec guardrail says stop and report if a preset's required engine scale exceeds `SIZE_SCALE_HARD_MAX = 4` — must be checked numerically first |
| A3 | `stage 0` mipmap generation on `R8` behaves uniformly across Chromium/WebKit WebViews | Q1 | WebKit (macOS WKWebView) is the shipped runtime; validate live — if it fails, the fallback is a manually generated chain (still `generateMipmap`-free) |
| A4 | Dropping `asset` from `AquarelleTip` (library rows carry `digest` instead) has no consumer outside the pack path | Q7 | A missed consumer = a save/open regression; enumerate `entry.asset` reads during planning |

## Open Questions (RESOLVED)

1. **Rotation of a chip preview's cache key** — spec says "cache key includes the rotation" (`watercolorMaskChip.ts:34-35` currently `${responseId}|${textureId}|g${generation}`). Does the chip render the rotated texture or the unrotated footprint? **RESOLVED: read the spec literally** — the chip key doubles as the preview identity, so the rotation joins the key and the sampled bytes are drawn rotated with a canvas 2D `translate`/`rotate` (no engine change). Owned by Task 10, including the `blitMaskChip` → `WatercolorTextureStrip` threading.
2. **Machine-scoped catalog staleness key** — `buildBrushCatalogPayload(projectContextId)` (`physicPaintBridge.ts:3256`) is project-scoped by design. **RESOLVED: replace with `libraryRevision`**, a monotonic library generation counter bumped once per real mutation; never reuse the context id. Owned by Task 2.
3. **Delete focus scope** — the Delete/Backspace handler must be scoped to the Textures surfaces; the existing global shortcut path is `shortcuts.ts` guarded by `isPaintEditMode()`. **RESOLVED: attach the handler to the modal's own container**, never the global dispatcher. Owned by Task 6.

## Sources

- In-repo, read directly this session (primary): `Engine.ts`, `gl.ts`, `shaders.ts`, `brushes.ts`, `params.ts`, `brushBridge.ts`, `deriveMask.ts`, `importTip.ts`, `maskRegistry.ts`, `tips.ts`, `toStudioStroke.ts`, `scriptTimelineCodec.ts`, `scriptTimelineCodec.test.ts`, `studioScriptSnapshotCodec.ts` + test, `studioScriptSnapshotController.test.ts`, `physicsPaintRotoScriptSchema.ts`, `physicsPaintRotoScriptLibrary.ts`, `physicsPaintRotoPlayScriptController.ts`, `physicsPaintRotoDuplicateScript.ts`, `physicsPaintRotoScriptSchema.test.ts`, `aquarelleRecordState.ts`, `aquarelleFootprint.ts` + test, `watercolorMaskChip.ts`, `WatercolorBrushLibrary.tsx`, `BrushesDocker.tsx`, `PhysicsPaintTopBar.tsx`, `PhysicsPaintTextureModal.tsx`, `PhysicsPaintRightPanel.tsx`, `aquarelleBrushCatalog.ts` + test, `projectStore.ts`, `efxPaintBrushImport.ts`, `physicPaintBridge.ts`, `usePhysicsPaintParentBridge.ts`, `main.tsx`, `app/vitest.config.ts`, `package.json` files, `types/physicPaint.ts`, `types/paint.ts`, `types/project.ts`, `probe/vector-spine/{probe.ts,run.mjs}`, `frame_codec.rs`, `commands/efx_paint_media.rs`, `services/efx_paint_media.rs`, `script_library.rs`, `commands/config.rs`, `models/project.rs`, `lib.rs`, `Cargo.toml`, `.planning/config.json`, `SPECS/v2.2.0-brush-tips/GSD-QUICK-PROMPT-04-user-texture-library.md`.
- External (cited): WebGL 2.0 spec / OpenGL ES 3.0.4 §3.8.9 generateMipmap format rule (via Chromium + Mozilla validation), `webgl2fundamentals.org` data-texture format table.

## Metadata

**Confidence breakdown**
- Standard stack / in-repo seams: HIGH — every file:line above was opened.
- Architecture (realm ownership, boot order): HIGH — main.tsx, bridge and store read in full.
- Mipmap runtime behaviour: MEDIUM — doc-grounded, no in-repo precedent; needs one live check.
- Size-law inverse feasibility: MEDIUM — arithmetic not yet evaluated per preset (A2).
- Pitfalls: HIGH — all derived from existing code paths.

**Research date:** 2026-11-16
**Valid until:** 2026-12-16 (fast-moving milestone; re-check version pins before planning if `packages/efx-watercolor` changed)
