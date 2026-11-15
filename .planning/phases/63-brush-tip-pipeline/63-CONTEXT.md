# Phase 63: Brush Tip Pipeline - Context

**Gathered:** 2026-11-15
**Status:** Ready for planning

<domain>
## Phase Boundary

An imported PNG or JPG becomes the actual brush tip: a real 192×192 mask, stored **inside the project package**, rebuilt on open, painting the same footprint live, baked and replayed, with three textured tips available on every install.

Delivers:

- One derivation law for turning a decoded image into a 192×192 mask (alpha, else luminance with polarity detection), used by both import and the built-in bake.
- `buildBrushForStroke` wired so a mask-backed tip builds from `CUSTOM_BASE` with its mask, keeping live/bake/replay on one call.
- A module-level engine mask registry fed by the brush library's import surface.
- Package-internal mask assets (`brushes/<sha256>.webp`) plus the `.mce` root `brushPack` carrier, declared in both TypeScript and Rust under the field-diff pin.
- Project-open registration that completes before the first stroke replay, replaces (never appends) the catalog and registry, and degrades per tip without aborting.
- Roto-script mask carriage so a script paints its texture in a project that never imported it.
- Three compile-time built-in tips (`wc/builtin-bristle`, `wc/builtin-chalk`, `wc/builtin-sponge`) that are never written into a project.

Does **not** add:

- Tip delete, garbage collection, or stale-asset pruning — imported tips live with the project (TIP-F01).
- Package/type/signal/`BRUSH_PACK_KIND` vocabulary rename (TIP-F02).
- A second decode path, a second brush-mapping path, or a second persistence carrier.
- Any tip that depends on a file outside the app bundle or the package.
- Copying the source image into the project, or re-deriving a mask on open.
- TIF/EXR; the PNG/JPG magic sniff stays.
- Any new runtime dependency.

</domain>

<decisions>
## Implementation Decisions

### Import surface

- **D-01:** **Import is a toolbar row inside `WatercolorBrushLibrary`, above the grid.** That component is the live catalog shared by the floating brush modal (`PhysicsPaintBrushModal`) and the right-panel Brush tab (`RightPanelBrushTab`), so one change covers both surfaces and the imported tip lands directly below the control.
- **D-02:** **`BrushesDocker.tsx` stays unmounted and is not revived.** Its catalog is the `wc/` `TIPS` list, while strokes record `BRUSH_PRESETS` ids as `brushId`; re-mounting it would swap the live catalog and change `brushId` semantics. **Recorded finding: TIP-06 / TIP-13 / TIP-16 / TIP-17's "docker" means the import/list surface — the brush library — not `BrushesDocker.tsx`.** `resetBrushesDockerUi()` stays unused, and project-open scoping targets the library catalog and the mask registry.
- **D-03:** **The grid is sectioned: shipped `BRUSH_PRESETS` first, then "Texture" (the three `wc/builtin-*` tips), then "Custom" (project imports).** `brushId` keeps recording whatever was picked with no id translation, so existing projects replay untouched. Mirrors the `category` field the tips already carry.
- **D-04:** **The lift (eraser) popover stays preset-only.** A project-scoped mask never enters an erase stroke, so opening a project never has to resolve a missing mask just to draw an erase footprint, and the ghost-mask fallback stays simple.
- **D-05:** **Every mask-backed card shows the painted-stroke thumbnail**, generated once per tip from the mask and cached under a per-tip key (tip id + mask), not a preset id. Consistent grid and a truthful preview; the raw mask shape is deliberately not shown.

### Shipped textures

- **D-06:** **The three built-ins come from user-supplied source images at `SPECS/v2.2.0-brush-tips/assets/`**, baked into compile-time constants. No runtime generator: a texture generated as code could drift, and TIP-13's compile-time-constants law stays literal. The three sources are a prerequisite for execution and are **never runtime inputs**.
- **D-07:** **Mapping (asset → tip id → label):** `Paint_Brush_sb4tebyp_1K_Brush.jpg` → `wc/builtin-bristle` "Bristle fan"; `Paint_Brush_sb5qdgop_1K_Brush.jpg` → `wc/builtin-chalk` "Chalk grain"; `Paint_Brush_scmeagrp_1K_Brush.jpg` → `wc/builtin-sponge` "Sponge". A swap is one manifest line.
- **D-08:** **The bake normalizes contrast** — after the high-quality 1024→192 downscale, stretch each mask to the full 0–255 range. No denoise, no blur: the grain is the point. **Normalization is bake-only; imported tips are never normalized**, so a faint user stamp stays faint and the engine's `tipMean` is the only compensation.
- **D-09:** **Mask derivation is a two-branch law, and the bake calls the same function** — no private one-off conversion. Amends TIP-03 (see Requirement amendments).

### Storage

- **D-10:** **No inline base64 in the `.mce`.** Each mask is a **lossless WebP asset at `brushes/<sha256>.webp`**, content-addressed with a fixed 64-hex name; imported ids like `wc/custom-xxxxxxxx` never appear in a path. The root `brushPack` entry carries a **package-relative asset ref**, not the mask bytes. — **Reversibility:** costly — switching back to inline bytes changes the package layout and the requirement text, and projects saved with asset refs would need a migration or a dual read path.
- **D-11:** **The codec is the existing `WebPLosslessCodec`** (`app/src-tauri/src/services/frame_codec.rs`, lossless with `config_exact` alpha), invoked with a **one-off higher-effort profile** (higher method/quality than the frame hot path) because a mask is encoded exactly once at import. **Save copies the stored bytes and never re-encodes**, so save → reopen stays byte-identical.
- **D-12:** **The `frames/` MEDIA lock is never widened.** Add a sibling `brushes/<64-hex>.webp` branch to the write path, the read path, the bound-path guard and the static scans; add the asset bytes to the transaction file set and to the copy-to-fresh-profile round-trip. **All package IO stays in Rust** — the renderer never reads a tip path.
- **D-13:** **No stale-file pruning this milestone** (tip delete is TIP-F01). An orphaned `brushes/*.webp` is acceptable; a missing one is not (D-19).
- **D-14:** **Roto scripts carry the mask as a base64 WebP data URL** in the script's `brushPack` entries — a script cannot reference the source project's package asset, and the script format already stores its WebP thumbnail the same way. Validate it with the same payload-dimension check used for thumbnails.
- **D-15:** **Importing is not an undoable edit.** It mutates the project catalog and marks the project dirty (`markDirty()`), but writes no history entry — the undo ledger stays a paint/document ledger. Making it undoable would create the tip-delete path TIP-F01 deferred and would orphan strokes that fall back to round. Tradeoff accepted: a mis-import stays in the project until TIP-F01 ships delete.
- **D-16:** **Re-importing identical bytes still yields a distinct catalog entry** (the existing `importTip` no-silent-dedupe law) while the content-addressed `brushes/<sha256>.webp` dedupes to one asset. Two catalog rows may therefore share one file.

### Open + failure behavior

- **D-17:** **Mask decode and registration run inside the project-open await, before hydrate/replay.** The paint surface never exists in a half-registered state, so **TIP-12's painting-before-registration case is defined as impossible**. Prefer **one Rust call that reads and decodes the whole brush set** over N IPC round-trips.
- **D-18:** **Per-tip failure never aborts the open.** A missing, corrupt, or wrong-size asset degrades to an unavailable tip and feeds the warning; the rest of the project opens normally.
- **D-19:** **The TIP-10 warning is one persistent named line rendered inline in the brush library**, next to the greyed card(s) — not the one-shot apply-message capsule, not the engine-status pill (that signal means "engine alive"). When several tips fail, it is **one aggregate line** ("N brush tips unavailable in this project") with each affected card marked individually, so "exactly one warning" stays literal. The warning is **one state per open**; every mounted library surface renders it, and tests assert one warning state, not a DOM-node count.
- **D-20:** **Opening a project replaces — never appends to — the catalog and the mask registry** with that project's entries plus the three built-ins. **Closing the project or starting a New Project resets the catalog and registry to the three built-ins**, so no stale custom id resolves.

### Mask × response composition

- **D-21:** **A mask-backed tip is the STAMP, not a response mode.** Masked tips build from `CUSTOM_BASE` (TIP-05) with their mask, and the eight `toolOverrides` multipliers still apply on top of that base, identically live/bake/replay. `buildBrushForStroke` stays the only mapping.
- **D-22:** **Do not gate the mask by the selected preset or by any response mode, and do not bypass the multipliers for masked tips.** Either would create a second mapping path and leave the Settings response sliders inert for the new brushes.
- **D-23:** **"No texture, as before" is not a toggle** — it is the existing `BRUSH_PRESETS` catalog, which stays maskless. The eraser/lift popover stays preset-only (D-04).

### Requirement amendments (locked docs must be updated to match)

- **TIP-03** → two-branch law: **alpha branch unchanged** (any alpha < 250 → alpha mask); otherwise **mean luminance over opaque pixels**: mean < 128 → `mask = luminance` (light-on-dark stamp), else `mask = 255 − luminance`. Documented in the module header, **both branches covered by tests**, and the built-in bake uses the same derivation (D-09).
- **TIP-06** → "fed by the docker" / "clearing the docker" becomes the **brush library import surface** (D-02).
- **TIP-08** → **WebP package asset at `brushes/<sha256>.webp`**, not PNG base64 embedded in the project; "only the derived mask is ever stored" still holds.
- **TIP-10** → stored-mask caps become **WebP asset** caps: a missing/corrupt/wrong-size (`TIP_SIZE²`) asset → unavailable tip, neutral round fallback, **one aggregate named warning** (D-19).
- **TIP-11** → entries carry a **package-relative asset ref**, not the encoded mask.
- **TIP-13** → "listed in the docker" becomes **listed in the brush library**.
- **TIP-15** → `buildBrushPackSnapshot` carries the **asset ref** through, staying total and fail-closed.
- **TIP-16** → **asset bytes byte-identical**, `brushes/` included in the fresh-profile copy, **identical brush library listing**.
- **TIP-17** → **drop the `resetBrushesDockerUi()` reference**; extend it: **closing the project or starting a New Project resets the catalog and mask registry to the three built-ins** (D-20).
- **TIP-12** → the painting-before-ready case is recorded as **impossible** by construction (D-17).
- **Phase 63 success criteria 2 and 4** → "docker listing" wording becomes **brush library listing**.
- **Phase 63 delivery law** → the refs-only package law holds with **package-internal `brushes/` assets only**; **the D-23 "inline data, never a file reference" exception is RETIRED**. No external path reference of any kind may exist for a tip.
- **Model comments** → update `app/src/types/project.ts` (`MceBrushPackSnapshot`) and `app/src-tauri/src/models/project.rs` to drop the inline-exception claim; update spec 02.

### Claude's Discretion

- The exact Rust command shape for the one-call brush-set decode, the 64-hex digest function wiring, the higher-effort WebP profile values, base64 payload-dimension validation helper reuse, and the literal warning copy.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase specs (amended by §Requirement amendments — the amendments win)
- `SPECS/v2.2.0-brush-tips/GSD-QUICK-PROMPT-01-mask-wiring.md` — mask derivation, `buildBrushForStroke` wiring, import caps, docker-fed registry
- `SPECS/v2.2.0-brush-tips/GSD-QUICK-PROMPT-02-embedded-tips.md` — persistence, built-ins, roto carrier, pack builder, design risks

### Built-in source art (prerequisite for execution; not runtime inputs)
- `SPECS/v2.2.0-brush-tips/assets/Paint_Brush_sb4tebyp_1K_Brush.jpg` → `wc/builtin-bristle`
- `SPECS/v2.2.0-brush-tips/assets/Paint_Brush_sb5qdgop_1K_Brush.jpg` → `wc/builtin-chalk`
- `SPECS/v2.2.0-brush-tips/assets/Paint_Brush_scmeagrp_1K_Brush.jpg` → `wc/builtin-sponge`

### Requirements and roadmap
- `.planning/REQUIREMENTS.md` — TIP-01..TIP-17, TIP-F01, TIP-F02
- `.planning/ROADMAP.md` §"Phase 63: Brush Tip Pipeline" — goal, success criteria, delivery law, spec provenance

### Package and persistence laws
- `app/src/lib/mceFieldContract.test.ts` — the field-diff pin; the definition of done for any new `.mce` field
- `app/src-tauri/src/services/efx_paint_media.rs` — the MEDIA lock (`frames/<layerId>/<keyId>.webp`, never widened) the `brushes/` branch must mirror without loosening
- `app/src-tauri/src/services/frame_codec.rs` — `WebPLosslessCodec`, lossless + `config_exact` alpha
- `app/src-tauri/src/services/project_io.rs` — package transaction (temp + rename), `layers/` and `frames/` staging

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`WatercolorBrushLibrary`** (`app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx`) — the live catalog grid, mounted twice (floating modal + right-panel Brush tab). Hosts the new Import row, the two new sections, and the per-card thumb path.
- **`PhysicsPaintBrushModal`** / **`PhysicsPaintBrushMenu`** — the two live pick surfaces; the menu also carries the lift branch that stays preset-only.
- **`watercolorStrokeThumb`** (`getStrokeThumb`, `tipImage`, `blitStrokeThumb`, `STROKE_THUMB_HEX`) — the painted-thumb machinery; cached per preset id today, needs a per-tip cache key for mask-backed cards.
- **`buildBrushForStroke`** (`packages/efx-watercolor/src/playground/brushBridge.ts:56`) — the ONE live/bake mapping, called from four sites (`AquarelleCanvasLayer`, `aquarelleFootprint`, `aquarelleStrokeBand`, `aquarelleLiftErase`). Mask resolution belongs here.
- **`CUSTOM_BASE` + `buildBrush`** (`packages/efx-watercolor/src/playground/brushes.ts:342, 348`) — `buildBrush` already accepts a `Uint8Array` tip and derives `tipSize` from its length; `tipMean` is `max(0.01, mean tip)`.
- **`TIP_SIZE = 192`** (`brushes.ts:70`).
- **`importTip`** (`packages/efx-watercolor/src/brushes/importTip.ts`) — magic sniff, single-flight queue, `Image`/`createImageBitmap` decode fallback, named failure copy. Gains the mask derivation and the two-branch law.
- **`buildBrushPackSnapshot` / `parseBrushPackSnapshot` / `isTipRecord`** (`packages/efx-watercolor/src/brushes/pack.ts`) — the one entry-shape authority, total and fail-closed; must carry the asset ref through.
- **`WebPLosslessCodec`** and the `frames/` staging transaction — the write/read/bound-path/static-scan seams the `brushes/` branch mirrors.
- **`projectStore.markDirty()` + autosave** — the dirty path an import must join.
- **`physicsPaintRotoScriptSchema.ts`** — `brushPack` already declared with `entries`; the roto carrier for TIP-14.

### Established Patterns

- Preact signals only, no `useState`; follow `efx-preact-reactivity` (idempotent setters, identity-stable effect deps, narrow signal reads).
- All disk IO through Rust; the renderer never reads a tip path (`project_package_fs_scope`).
- New persisted fields are declared in BOTH languages in the same pass — serde silently drops undeclared keys, and `mceFieldContract.test.ts` is the tripwire.
- Fail-closed, total parsers: `null`/named failure over a throw; never a silent overwrite.
- One decode path, one mapping path, one persistence carrier — the phase's whole design premise.
- No new runtime dependencies (REL-01).
- `vitest run`, never watch; build from `packages/efx-watercolor/src/`, never `dist/`.

### Integration Points

- **`BrushesDocker.tsx` is mounted nowhere in production.** `TIPS` is referenced only there; `customTips` is a module signal with no production writer. The specs' "docker" is a naming drift (D-02).
- **Project open**: `projectStore.openProject` → `hydrateRuntimeFromDocument` is the await the brush-set decode must join (D-17).
- **`.mce` root**: `MceProject` has **no `brushPack` member today** — `MceBrushPackSnapshot` is declared on both sides but unused, and `efxPaintPackage.ts`'s `buildPackageManifest` is where root keys are assembled.
- **`project.ts` `MceProject` / `project.rs` `MceProject`** are the two co-change sites for the new root key.

</code_context>

<specifics>
## Specific Ideas

- The three supplied sources are **1024×1024 JPEGs, white-on-black** (light-on-dark stamps) — the reason TIP-03 gained a polarity branch. They were described as PNGs; the delivered files are JPEG.
- Built-in masks are compile-time constants and must stay **well inside the 2 MB chunk ceiling**.
- The user's core expectation: "the imported image becomes the actual brush tip" — the stroke footprint must change visibly, not just the label.
- The package law: a project reproduces on any machine that has the app, **from the `.mce` alone**. No path, no user-global config, no re-derivation on open.

</specifics>

<deferred>
## Deferred Ideas

- **TIP-F01** — Tip delete and garbage collection UI; imported tips currently live with the project. Includes pruning orphaned `brushes/*.webp` assets (deliberately not done this milestone, D-13).
- **TIP-F02** — Package/type/signal/`BRUSH_PACK_KIND` rename to a medium-neutral vocabulary; a dedicated format-break pass.

### Reviewed Todos (not folded)

- `261024-frame-fade-compositing.md` — "Frame fade — compositing/export cumulative-frame crossfade". Matched only on the keywords `frame`/`source` (score 0.6); unrelated to brush tips. Not folded.

</deferred>

---

*Phase: 63-Brush Tip Pipeline*
*Context gathered: 2026-11-15*
