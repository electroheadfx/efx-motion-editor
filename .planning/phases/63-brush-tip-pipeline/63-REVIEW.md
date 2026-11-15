---
phase: 63-brush-tip-pipeline
reviewed: 2026-11-15T13:35:50Z
depth: standard
files_reviewed: 38
files_reviewed_list:
  - app/src/lib/ipc.ts
  - app/src/lib/physicPaintBridge.ts
  - app/src/lib/webpBytes.ts
  - app/src/lib/efxPaintBrushAssets.ts
  - app/src/lib/efxPaintBrushSet.ts
  - app/src/lib/efxPaintBrushImport.ts
  - app/src/lib/efxPaintPackage.ts
  - app/src/lib/efxPaintPersistence.ts
  - app/src/types/physicPaint.ts
  - app/src/types/project.ts
  - app/src/stores/aquarelleBrushCatalog.ts
  - app/src/stores/projectStore.ts
  - app/src/main.tsx
  - app/src/components/physic-paint/bridge/usePhysicsPaintParentBridge.ts
  - app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts
  - app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx
  - app/src/components/physic-paint/view/BrushesDocker.tsx
  - app/src/components/physic-paint/view/aquarelleRecordState.ts
  - app/src/components/physic-paint/view/watercolorStrokeThumb.ts
  - app/src/components/physic-paint/engine/aquarelleFootprint.ts
  - app/src-tauri/src/commands/efx_paint_media.rs
  - app/src-tauri/src/commands/project.rs
  - app/src-tauri/src/lib.rs
  - app/src-tauri/src/models/project.rs
  - app/src-tauri/src/services/efx_paint_media.rs
  - app/src-tauri/src/services/frame_codec.rs
  - app/src-tauri/src/services/physic_paint_cache.rs
  - app/src-tauri/src/services/project_io.rs
  - app/src-tauri/src/services/script_library.rs
  - packages/efx-watercolor/src/brushes/pack.ts
  - packages/efx-watercolor/src/brushes/tips.ts
  - packages/efx-watercolor/src/brushes/maskRegistry.ts
  - packages/efx-watercolor/src/brushes/importTip.ts
  - packages/efx-watercolor/src/brushes/deriveMask.ts
  - packages/efx-watercolor/src/brushes/builtinTips.ts
  - packages/efx-watercolor/src/playground/brushBridge.ts
findings:
  critical: 1
  warning: 7
  info: 4
  total: 12
  necessity: 0
status: issues_found
---

# Phase 63: Code Review Report

**Reviewed:** 2026-11-15T13:35:50Z
**Depth:** standard
**Files Reviewed:** 38
**Status:** issues_found

## Summary

Phase 63 delivers the brush-tip pipeline: the Rust disk boundary (encode/decode/write/read content-addressed `brushes/<sha256>.webp`, the bound-path accept-set, the save-transaction leg), the TS project carrier (`brushPack` refs, `loadProjectBrushSet`, `applyProjectBrushSet`, pending-asset staging), the cross-realm catalog channel (main-realm import handler and publisher, Studio-realm applier and pull), and the script carrier (inline `maskDataUrl` with a 512 KB cap and an exact 192×192 pre-decode walk).

The core invariants hold under trace: the wire shapes match between TS and Rust (`BrushAssetsReadResponse { results }`, the five read reasons), the bound-path lock is not widened, the publication path creates a missing `brushes/` parent (`physic_paint_cache.rs:394-403`), the digest is the filename stem on both write and read, mask lengths are refused at every write seam, and the encoder's lossless VP8L output satisfies both `isWebpBytes` and the tip-size probe. `buildBrushForStroke` is total, so thumbnails and the cursor footprint cannot throw on an unknown or unavailable id.

The defects below cluster on boundaries between layers that enforce *different* laws: the package carrier accepts shapes the cross-realm guard refuses (CR-01), the "never throws" guards are not total (WR-01), and two "refusal, never omission" laws collapse in opposite directions — one refuses far too much (WR-02), the other silently omits (WR-03). Test files in the phase diff were not reviewed for findings (out of scope per the reviewer contract). No `<structural_findings>` block was supplied, so there is no fallow section; no necessity findings were provable from the repository (`necessity: 0`).

## Narrative Findings (AI reviewer)

### Critical Issues

### CR-01: Cross-layer guard disagreement silently blinds the Studio catalog and writes mask-less Roto scripts

**File:** `app/src/types/physicPaint.ts:2973-2977` (also `:3013-3022`), `app/src/stores/aquarelleBrushCatalog.ts:302-318`, `packages/efx-watercolor/src/brushes/pack.ts:37-43,73-93`
**Issue:** The two halves of the catalog channel enforce different laws. The wire guard `isCustomTipWire` requires (a) exactly the 12 members of `AQUARELLE_TIP_MEMBER_KEYS` and (b) `tip.category === 'custom'`. The package carrier that produced those tips accepts all five categories (`CATEGORIES`, `pack.ts:37-43`) and silently ignores unknown members (`isTipRecord`, `pack.ts:73-93`); `asTipRecord` copies every member (`pack.ts:144-149`). `loadProjectBrushSet`/`tipFromRaw` (`efxPaintBrushSet.ts:130-138`) therefore puts such a tip into `customBrushTips`, and `buildBrushCatalogPayload` re-emits it verbatim (`tip: { ...tip }`, `aquarelleBrushCatalog.ts:308`). The Studio then refuses the payload **whole** (`entries.every(isPhysicPaintBrushCatalogEntry)`, `physicPaint.ts:3017`), so one project tip with a stray member or a non-`custom` category empties the entire Studio catalog — no masks, no assets, no list. `buildScriptBrushEntries` then returns `{ok: true, entries: []}` (WR-03) and `saveActiveFrame` reports "Saved", persisting a script whose strokes reference `wc/custom-*` ids with no mask entries: precisely the "silently paints the neutral fallback on another machine" outcome the same function refuses by name in the non-empty case. The triggering data is accepted by the project open path and re-written on every save (`buildBrushPackSnapshot` emits `{ ...tip }`, `pack.ts:112`), so the state survives repair attempts by save/reopen.
**Fix:** Make the sender normalize to the wire law instead of spreading: build each entry from the named fields only, and pin the category at the project boundary (refuse or normalize a non-`custom` catalog tip). Alternatively relax `isCustomTipWire` to `CATEGORIES` and let `applyBrushCatalogPayload` degrade per entry instead of refusing the snapshot whole. Add a pin: a project tip carrying a stray member must still reach the Studio catalog.

### Warnings

### WR-01: The "never throws" wire guards call an unguarded `atob`

**File:** `app/src/types/physicPaint.ts:2962-2965` (call sites `:2997`, `:3001`, `:3029`)
**Issue:** `decodeBase64OrNull` returns `base64ToBytes(value)` directly; `base64ToBytes` calls `atob` with no catch (`webpBytes.ts:82-87`), which throws `InvalidCharacterError` on non-canonical input. The docstring at `:3007-3012` states the payload guard "never throws", and every consumer relies on totality: `usePhysicsPaintParentBridge.ts:221` calls the guard inside three listener bodies with no try/catch, and `requestPhysicPaintBrushCatalog` (`physicPaintBridge.ts:3258-3260`) calls it inside the Tauri listener, outside its own `try`. A throw drops the snapshot instead of refusing it, and in the import path (`physicPaintBridge.ts:3201-3214`) no result event is emitted at all, so the Studio reports `timed-out` for a request the main realm may already have decoded.
**Fix:** Wrap the decode in try/catch and return `null`, exactly as the sibling helper in `aquarelleBrushCatalog.ts:320-326` already does.

### WR-02: One degraded custom tip blocks every Roto script save, including scripts that never used it

**File:** `app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts:341-357` (called unconditionally at `:683-684`)
**Issue:** `buildScriptBrushEntries` walks **all** of `customBrushTips` before serializing. A tip the open listed as unavailable (`missing`, `unreadable`, `digest-mismatch`, `invalid-asset-ref`) has no remembered WebP in the Studio realm, so the function returns `ok: false` and `saveActiveFrame` refuses the save — even for a capture painted exclusively with built-ins. The state is permanent for the open (no writer restores a missing asset), so the whole Scripts feature is unusable until the package is repaired, which contradicts the phase's own D-18 law that one bad tip costs exactly one tip and the D-19 law that the rest of the set keeps working. The reason string ("the catalog push never arrived") is also wrong for this case, pointing the user at the bridge instead of the asset.
**Fix:** Split the two sources: when `unavailableTipIds` contains the tip id, log a warning and skip that entry (its strokes are already a declared degradation); return `ok: false` only for a tip the realm believes is healthy but whose bytes are missing.

### WR-03: An absent catalog is indistinguishable from a project with no imports, so scripts are saved without masks

**File:** `app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts:341-357`, `:683-685`
**Issue:** `customBrushTips.value` is empty both when the project genuinely imported nothing and when the Studio never received a catalog payload (CR-01; the 5 s mount pull whose errors are swallowed at `physicPaintBridge.ts:3264-3265`; a failed push). In the second case `buildScriptBrushEntries` returns `{ok: true, entries: []}`, `serializeAquarelleRotoScript` accepts the empty `brushPack` (`isBrushPack` is vacuously true on `[]`), and the save succeeds with no mask payload — the omission the function's own docstring says it exists to prevent. Nothing in the realm records whether a payload ever arrived.
**Fix:** Add a realm-local `brushCatalogSynced` signal set by `applyBrushCatalogPayload` and have `saveActiveFrame` refuse (named reason) when the captured script references any `wc/custom-` id while the flag is false. The main realm can answer a boolean on the pull if a payload-based flag is preferred.

### WR-04: A publish failure after the mutation destroys the import answer and reports a false timeout

**File:** `app/src/lib/physicPaintBridge.ts:3181-3185` (listener bodies `:3201-3214`), contrast `:3286-3290`
**Issue:** Catalog mutations publish through the wrapper installed by `_setBrushCatalogPublisher`, which catches and logs. `installPhysicPaintBrushImportListener` instead injects the raw `publishPhysicPaintBrushCatalog` as the import's publish port, and `applyBrushImportRequest` awaits it *after* the batch has mutated the registry, the catalog, the asset cache and the dirty flag (`efxPaintBrushImport.ts:139-150`). A rejection from that await propagates out of `applyRequest`; none of the three listener registrations has a catch (`listen` callback, `dispatchEvent` companion `.then`, `message` `.then`), so the result event is never emitted and the Studio's 15 s timeout turns an import that already changed project state into a reported `timed-out` failure.
**Fix:** Inject `() => publishPhysicPaintBrushCatalog().catch((error) => console.warn(...))` and wrap `applyBrushImportRequest` in try/catch that still emits a result carrying a defined failure reason.

### WR-05: Mask ids are not reserved — a script or package can shadow a built-in mask

**File:** `packages/efx-watercolor/src/brushes/maskRegistry.ts:52-57`, `app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts:419-422`, `app/src/stores/aquarelleBrushCatalog.ts:243-250`
**Issue:** `registerMask` overwrites whatever id it is given, and neither `registerScriptBrushMasks` (which registers masks from script data — a trust boundary) nor `applyProjectBrushSet`/`applyBrushCatalogPayload` excludes the three compile-time ids. A script whose `brushPack` entry is named `wc/builtin-chalk` with a foreign 36,864-byte mask replaces the shipped chalk texture in that realm for the rest of the session (`resetMaskRegistry` only runs on close), changing what every subsequent stroke with that built-in paints. `replaceMaskRegistry` has the same exposure through a foreign package entry: the applier pushes built-ins first and project masks after, so a duplicate id wins.
**Fix:** Refuse built-in ids at both write seams (compare against `BUILTIN_TIP_MASKS`), logging the skip; or make `registerMask` reject a built-in id and seed the built-ins only through `resetMaskRegistry`.

### WR-06: Unbounded asset read precedes the digest and dimension guards

**File:** `app/src-tauri/src/services/efx_paint_media.rs:683-688`
**Issue:** `read_brush_asset` validates the path shape, canonicalizes the leaf, refuses a symlink and a missing file, then `fs::read`s the **entire** file before computing the digest and before `decode_mask_webp`'s pre-decode dimension guard (T-63-03). A hostile or corrupted package can place a multi-GB regular file at `brushes/<64hex>.webp`; the digest check that would reject it runs only after the whole file is resident, so the single batch read an open performs can exhaust memory. The dimension guard the phase added is downstream of the allocation it was meant to protect.
**Fix:** Check `fs::metadata(&canonical)?.len()` against a cap before reading (a 192×192 lossless mask is far under 16 MB) and map over-cap to `BRUSH_READ_REFUSED`/`unreadable`.

### WR-07: The project save can silently erase the whole brush pack

**File:** `app/src/stores/aquarelleBrushCatalog.ts:274-280`
**Issue:** `buildProjectBrushPack` returns `null` when `buildBrushPackSnapshot` fails (one invalid entry or a duplicate id), and `buildMceProject` then omits `brushPack` entirely (`projectStore.ts:504`), so a save erases every imported tip from the manifest with no log and no surfaced failure. Both writers currently produce valid tips, so the branch is unreachable today — but the failure direction is total and silent, and the pack is the only record of the catalog (the assets become orphans on disk). This is the one place in the pipeline where a validation failure loses user data rather than degrading one tip.
**Fix:** Log the offending tip id before returning `null`, and prefer a per-entry filter that keeps the valid tips (matching D-18) over dropping the pack whole.

### Info

### IN-01: Redundant rejection arm

**File:** `app/src-tauri/src/commands/efx_paint_media.rs:225-229`
**Issue:** `BRUSH_MASK_UNREADABLE => EfxPaintMediaRejection::Undecodable` and the trailing `_ => EfxPaintMediaRejection::Undecodable` map the same value; the named arm adds nothing.
**Fix:** Drop the named arm, or give `unreadable` its own rejection so the two causes stay distinguishable on the wire.

### IN-02: Dead docker modified with a mask-dropping importer

**File:** `app/src/components/physic-paint/view/BrushesDocker.tsx:88-100`, `:232-235`
**Issue:** `BrushesDocker` has no mount site (only comments mention it), yet this phase rewrote its import leg. `registerDockerTip` ignores the derived `mask` (its `register` port uses only `name`) and mints a tip with no `asset`; if the docker were revived, its imports would paint the neutral round fallback and, once such a tip reached the project catalog, trigger WR-02 for every script save. Dead code that encodes a divergent, lossy version of the pipeline is a trap.
**Fix:** Delete the file with the retired surface (D-02), or wire it to `requestPhysicPaintBrushImport` like `WatercolorBrushLibrary`.

### IN-03: Entry guard omits the id/name length caps it defines

**File:** `app/src/types/physicPaint.ts:2973-2977` vs `:3019`
**Issue:** `PHYSIC_PAINT_BRUSH_ID_MAX_LENGTH` (256) is enforced on `unavailableTipIds` but never on `entry.tip.id` or `entry.tip.name`, so a foreign package can push unbounded strings that the Studio re-publishes into scripts and DOM test ids. The cap already exists; the entry path just does not apply it.
**Fix:** Bound `tip.id` and `tip.name` in `isCustomTipWire`.

### IN-04: The import request mask is decoded twice

**File:** `app/src/lib/physicPaintBridge.ts:3174-3179`
**Issue:** `isPhysicPaintBrushImportRequest` already decodes `maskBase64` and validates its length (`physicPaint.ts:3029-3030`), then `applyRequest` decodes the same string a second time only to pass the bytes on — two identical conversions of the same 49 KB payload at the same boundary.
**Fix:** Have the guard return the decoded mask, or validate with a length-only probe and decode once in the handler.
