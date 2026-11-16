---
phase: 261116-inu
reviewed: 2026-11-16T15:22:23Z
depth: quick
files_reviewed: 36
files_reviewed_list:
  - app/src-tauri/src/commands/brush_library.rs
  - app/src-tauri/src/services/frame_codec.rs
  - app/src-tauri/src/services/script_library.rs
  - app/src-tauri/src/models/project.rs
  - app/src-tauri/src/lib.rs
  - app/src/lib/brushLibrary.ts
  - app/src/lib/efxPaintBrushImport.ts
  - app/src/lib/ipc.ts
  - app/src/lib/physicPaintBridge.ts
  - app/src/types/physicPaint.ts
  - app/src/stores/aquarelleBrushCatalog.ts
  - app/src/stores/projectStore.ts
  - app/src/main.tsx
  - app/src/components/physic-paint/engine/aquarelleBrushSize.ts
  - app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx
  - app/src/components/physic-paint/view/aquarelleRecordState.ts
  - app/src/components/physic-paint/view/PhysicsPaintTextureModal.tsx
  - app/src/components/physic-paint/view/WatercolorTextureStrip.tsx
  - app/src/components/physic-paint/view/watercolorMaskChip.ts
  - app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx
  - app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx
  - app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/performance/scriptTimelineCodec.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts
  - app/src/components/physic-paint/bridge/usePhysicsPaintParentBridge.ts
  - packages/efx-watercolor/src/playground/params.ts
  - packages/efx-watercolor/src/playground/Engine.ts
  - packages/efx-watercolor/src/playground/shaders.ts
  - packages/efx-watercolor/src/playground/brushBridge.ts
  - packages/efx-watercolor/src/playground/brushes.ts
  - packages/efx-watercolor/src/brushes/deriveMask.ts
  - packages/efx-watercolor/src/brushes/importTip.ts
  - packages/efx-watercolor/src/payload/toStudioStroke.ts
  - packages/efx-watercolor/src/adapter/engineAdapter.ts
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
status: issues_found
---

# Quick 261116-inu: Code Review Report

**Reviewed:** 2026-11-16T15:22:23Z
**Depth:** quick (requested), with verification against the task's eight named risk areas
**Files Reviewed:** 36
**Status:** issues_found

## Summary

No `<structural_findings>` block was supplied, so this report contains narrative findings only. The review traced the machine brush library (Rust + renderer orchestration), the cross-realm mutation pair, the px size law, the AQTL v4 rotation field, the shader/mipmap path and the Textures surfaces.

Verified and found sound: the `sizeToEngineScale` clamp removal differs from HEAD only for negative canonicals (no recorded non-negative value changes); the AQTL rotation field is presence-prefixed and placed after the vector block + textureId and before `pointCount`, with `x100`/`/100` as the single unit boundary; rotation is integer degrees in every JSON carrier and request guard; the mutation request/result guards are exact-member-set, digest- and range-validated, correlated on an operationId, bounded to 15 s, fail-closed on malformed requests and publish-before-answer; the library loads once before the first main-window render, survives project close/New Project, and import no longer dirties the project; rotation is intentionally excluded from `brushTipCacheKey` (uniform-only) with `forgetBrush`/`clearTipTextures` intact and the mipmap path legal for both 512 and 192 edges; the delete gesture never reaches the global shortcut dispatcher and only ever removes `<digest>.webp` plus the catalog row.

The blocking concern is a catalog-read divergence in `brush_library.rs`: the scan path is deliberately tolerant per row, while every mutation path treats an unreadable/oversized/malformed catalog as empty and then rewrites it from that empty state — silent loss of the whole library's metadata on the next import. The remaining warnings are hostile/non-regular file reads that can hang the boot scan, a binary-decode hole in the integer-degrees law, and a delete gesture whose keyboard subject can differ from the focused chip.

## Narrative Findings (AI reviewer)

### Critical Issues

### CR-01: One unreadable, oversized or malformed `catalog.json` makes every mutation treat the library as empty, and the next import rewrites the catalog from that empty state

**File:** `app/src-tauri/src/commands/brush_library.rs:163-179`
**Issue:** `read_catalog` returns `BrushLibraryCatalog::default()` whenever the file cannot be read, exceeds the 4 MiB cap, or fails a whole-document `serde_json` parse (`unwrap_or_else(|_| Default::default())`, line 174). The scan path deliberately does the opposite: `read_catalog_entries_lenient` (192-224) drops malformed/forged rows *individually* and keeps valid siblings, and its test at 636-665 pins exactly that behaviour ("scan_drops_malformed_and_forged_rows_individually_keeping_valid_siblings"). But all three mutation paths use the strict reader:
- `write_library_entry_at` (line 321) — reads the empty catalog, finds no matching digest, pushes the new row and calls `write_catalog` (326-327), atomically replacing `catalog.json` with a file that contains ONLY the new row.
- `delete_library_entry_at` (line 374) — reads empty, `retain` changes nothing (376), skips the rewrite, and returns `Ok`.
- `set_rotation_at` (line 437) — reads empty, finds no row, returns `Err("missing")` (438-440).

Concrete failure: a catalog containing one malformed row (the exact shape the scan test builds — e.g. a row missing the numeric fields), or any `catalog.json` larger than 4 MiB (the module explicitly treats "hostile catalog" as in scope, T-06), is read as empty. The user's next texture import rewrites `catalog.json` with a single entry: every sibling row's `name`, `textureRotation` and `createdAt` are lost, and their `<digest>.webp` files are orphaned — the scan lists rows only from the catalog and never enumerates the directory, so the whole library disappears from the UI. In the same state, deleting a texture removes its file but never its row, so after the next boot the row returns as an unavailable chip (a deleted texture appears to come back), and the rotation control silently fails with "missing". A single malformed row therefore becomes whole-library metadata loss on the next import.

**Fix:** give the mutations one tolerant loader. Parse the document, then reuse the per-row validation/dedup of `read_catalog_entries_lenient`; distinguish "no catalog file" from "catalog exists but cannot be read/parsed/oversized". In the latter case return an error instead of an empty catalog and never call `write_catalog` — corruption must be reported, not overwritten. Treat the 4 MiB cap as a refusal, not as "empty". Example shape:

```rust
fn read_catalog_for_mutation(root: &Path) -> Result<BrushLibraryCatalog, String> {
    let path = catalog_path(root);
    if !path.exists() { return Ok(BrushLibraryCatalog::default()); }
    let metadata = fs::metadata(&path).map_err(|e| format!("catalog unreadable: {e}"))?;
    if !metadata.is_file() { return Err("catalog-not-a-file".into()); }
    if metadata.len() > MAX_CATALOG_BYTES { return Err("catalog-too-large".into()); }
    let bytes = fs::read(&path).map_err(|e| format!("catalog unreadable: {e}"))?;
    // Reuse the lenient per-row validation instead of a whole-document parse.
    let entries = parse_entries_lenient(&bytes)?; // Err only when the document itself is unparseable
    Ok(BrushLibraryCatalog { version: BRUSH_LIBRARY_CATALOG_VERSION, entries })
}
```

### Warnings

### WR-01: `catalog.json` is read without the module's symlink/regular-file guard, so a special file can hang or OOM the boot scan

**File:** `app/src-tauri/src/commands/brush_library.rs:163-172` (and the same pattern at 192-202)
**Issue:** The module header (line 16) states that every read/write/delete rejects a symlinked target, but neither `read_catalog` nor `read_catalog_entries_lenient` calls `reject_symlink`, and `fs::metadata` follows symlinks. A `catalog.json` symlink to `/dev/zero` reports length 0, bypasses the 4 MiB gate at 167, and then `fs::read` never reaches EOF — unbounded allocation until the process dies. A FIFO at that path blocks in `fs::read` until a writer appears (never). Both files are read inside `lock_library()` from `brush_library_scan` (466-469), which `main.tsx:114` awaits before the first render, so the main window never renders and the mutex is held for the life of the hang.
**Fix:** `reject_symlink(&path, "brush library catalog")`, open the file, require `metadata.is_file()` via the opened descriptor, and read through `.take(MAX_CATALOG_BYTES + 1)` rather than `fs::read`, so non-regular files and endless streams fail the size gate instead of blocking or exhausting memory.

### WR-02: Mask-file reads are unbounded whole-file reads, defeating the stated "no pixel allocation" guard

**File:** `app/src-tauri/src/commands/brush_library.rs:228-237` (and `:340`)
**Issue:** `library_file_is_usable` rejects symlinks but then `fs::read`s the entire `<digest>.webp`. A FIFO (not a symlink) placed at that name blocks the awaited boot scan forever; a multi-GB regular file (renamed video, corrupted copy) is fully allocated before `parse_webp_dimensions` runs. The doc comment at 226-227 claims "The RIFF header read allocates no pixel buffer (T-02)", but the whole-file read is the allocation. `decode_library_entry_at` (340) has the same unbounded read.
**Fix:** open each mask file, require `is_file()`, cap the size at a few MiB (a lossless 512x512 mask is a handful of MB; `services::script_library` already has a 16 MiB `MAX_FILE_BYTES`), and for the scan read only the first `512` bytes — `parse_webp_dimensions` never scans past that — instead of the whole file.

### WR-03: The AQTL v4 decoder lets non-integer degrees into memory, and such a file can never be saved again

**File:** `app/src/components/physic-paint/performance/scriptTimelineCodec.ts:1060-1075`
**Issue:** The encoder refuses a non-integer `textureRotation` (764-771) and writes `degrees * 100`. The decoder only range-checks the hundredths (`-18000..=18000`) and returns `hundredths / 100`. A crafted or corrupted v4 body carrying e.g. `4550` yields `45.5` in memory, breaking the stated law "integer DEGREES in memory and every JSON carrier; hundredths only inside the AQTL byte body". On the next save, the same stroke's `!Number.isInteger(textureRotation)` check (765-769) throws `invalid-value` for the whole timeline, so every script edit made after loading such a file is refused. The JSON path is protected by the integer guard in `physicsPaintRotoScriptSchema.ts:476-482`; the binary path is the hole.
**Fix:** reject non-multiples of 100 at decode (`if hundredths % 100 !== 0 { fail('invalid-value', ...) }`) — or round to the nearest degree at the boundary — so the in-memory value is always an integer and re-encoding can never fail on it.

### WR-04: Delete/Backspace on a keyboard-focused chip deletes the SELECTED texture, not the focused one

**File:** `app/src/components/physic-paint/view/PhysicsPaintTextureModal.tsx:425-446`
**Issue:** Each chip is a `<button>`, so it is a Tab stop, but focusing a chip does not select it. `onSurfaceKeyDown` accepts any Delete/Backspace whose target is inside `.watercolor-texture-chip` (435-436), then resolves the DELETE SUBJECT from `aquarelleSelectedTextureId.value` (438-445). With texture A selected, Tab to chip B and press Delete: the confirmation names and deletes A while focus (and the user's intent) is on B. With several textures this deletes the wrong library entry; the confirmation naming the victim softens but does not fix the mismatch. The same handler also treats "focus on any chip" as permission to delete a possibly different selection.
**Fix:** make the focused chip the subject — resolve the chip's own row (e.g. attach the tip id/digest to the chip element and call `setAquarelleSelectedTextureId(chipId)` before opening the confirmation) — or ignore the gesture unless the focused chip is the selected one:

```tsx
const chip = (target?.closest?.('.watercolor-texture-chip') ?? null) as HTMLElement | null;
if (chip) {
  const chipId = chip.dataset.tipId;
  if (chipId && chipId !== aquarelleSelectedTextureId.value) setAquarelleSelectedTextureId(chipId);
}
```

### Info

### IN-01: Dead/stale catalog API contradicts the machine-library design

**File:** `app/src/stores/aquarelleBrushCatalog.ts:121-132` (also 146-158, 336-371)
**Issue:** `registerScriptMask` still documents "Register ONE mask a loaded Roto script carries ... a library replacement swaps the registry wholesale, so nothing a script registered survives one" — but the script mask carrier was deleted in this quick (scripts are metadata-only) and the function has no production caller. `addCustomBrushTip` (deprecated), `replaceCustomBrushTips` and `replaceUnavailableTipIds` are likewise production-unused and would re-introduce the retired project-scoped flow if a future caller picked them up.
**Fix:** delete them (or mark them internal/test-only) so the module exposes exactly the machine-library seams (`replaceLibraryEntries`, `upsertLibraryRow`, `applyBrushCatalogPayload`).

### IN-02: Stale comments describe the retired project-scoped import

**File:** `app/src/main.tsx:149-155` (also `app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx:108-109`)
**Issue:** The main-window bootstrap comment says the brush import "marks the project dirty" and that the main realm owns "the stored asset bytes"; this quick made imports machine-level and moved bytes into the Rust library. `WatercolorBrushLibrary` still says "importTip derives the 192x192 mask", while the mask edge is now `TIP_MASK_EDGE` = 512.
**Fix:** update both comments to the machine-library contract; a future reader otherwise restores the removed dirty-mark/asset-cache legs.

### IN-03: HOME fallback silently relocates user texture data to /tmp

**File:** `app/src-tauri/src/commands/brush_library.rs:122-128`
**Issue:** `std::env::var("HOME").unwrap_or_else(|_| "/tmp".into())` mirrors `commands/config.rs`'s convention, but this root stores user-imported, non-regenerable masks. If HOME is ever unset, the library is written under world-writable `/tmp` and disappears on reboot (and intermediate path components are not symlink-checked).
**Fix:** for the library root, fail the command (or resolve the home directory explicitly) instead of falling back to `/tmp`.

---

_Reviewed: 2026-11-16T15:22:23Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
