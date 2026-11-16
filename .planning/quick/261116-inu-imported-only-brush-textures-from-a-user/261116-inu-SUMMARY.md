# Quick 261116-inu Summary: Imported-only brush textures from a machine library

Imported-only brush textures: 512×512 masks in a machine-level library with a
`catalog.json`, no built-in textures and no texture bytes in projects or
scripts, a pixel-true paint size split from the lift size, and a per-stroke
texture rotation carried in integer degrees through AQTL v4 and the Roto
script.

**Status: complete — Tasks 1–10 implemented; Task 11 live UAT approved by the
user on 2026-11-16 (all ten rows). A follow-up fix series (261116-rp) closed
the script-replay defects that live UAT exposed; see below.**

---

## Frontmatter

```yaml
phase: quick/261116-inu
plan: 01
subsystem: physic-paint / brush texture library
tags: [brush-library, textures, aqtl, roto, rust, tauri, preact]
status: complete
requires:
  - webp 0.3.1, sha2 0.10, @tauri-apps/api (all pre-existing)
provides:
  - machine-level brush library (~/.config/efx-motion/brushes/ + catalog.json)
  - brush_library_scan / delete / set_rotation Tauri commands
  - 512×512 TIP_MASK_EDGE with TIP_SIZE 192 unchanged for procedural tips
  - paint size in document pixels (1..512) split from lift size (1..80)
  - per-stroke textureRotation in integer degrees (AQTL v4, Roto script)
affects:
  - packages/efx-watercolor (brushes, payload, playground, adapter)
  - app/src-tauri (brush_library, project, frame_codec, script_library, lib.rs)
  - app/src (brushLibrary, physicPaintBridge, ipc, stores, Textures UI)
tech-stack:
  added: []
  patterns:
    - renderer passes bytes and digests only; all library IO is Rust-owned
    - compare-then-write catalog replacements (one bump, one publish)
    - one unit law: integer degrees on every carrier, hundredths only inside AQTL
key-files:
  created:
    - app/src-tauri/src/commands/brush_library.rs
    - app/src/lib/brushLibrary.ts
    - app/src/lib/brushLibrary.test.ts
    - app/src/components/physic-paint/engine/aquarelleBrushSize.ts
    - app/src/lib/noRetiredTextureIds.test.ts
    - packages/efx-watercolor/src/playground/shaders.test.ts
  modified:
    - packages/efx-watercolor/src/brushes/{maskRegistry,pack,tips,importTip,deriveMask}.ts
    - packages/efx-watercolor/src/playground/{Engine,shaders,brushes,brushBridge}.ts
    - packages/efx-watercolor/src/payload/toStudioStroke.ts
    - packages/efx-watercolor/src/adapter/engineAdapter.ts
    - app/src-tauri/src/{lib.rs,commands/project.rs,services/frame_codec.rs,services/script_library.rs}
    - app/src/lib/{ipc,physicPaintBridge,efxPaintPersistence,efxPaintPackage}.ts
    - app/src/stores/{aquarelleBrushCatalog,projectStore}.ts
    - app/src/types/{physicPaint,project}.ts
    - app/src/components/physic-paint/view/{PhysicsPaintTextureModal,WatercolorTextureStrip}.tsx
    - app/src/components/physic-paint/view/{watercolorMaskChip,aquarelleRecordState}.ts
    - app/src/components/physic-paint/performance/{scriptTimelineCodec,studioScriptSnapshotCodec}.ts
    - app/src/components/physic-paint/roto/{physicsPaintRotoScriptSchema,physicsPaintRotoPlayScriptController,physicsPaintRotoDuplicateScript}.ts
  deleted:
    - packages/efx-watercolor/src/brushes/builtinTips.ts
    - packages/efx-watercolor/src/brushes/builtinTipMasks.generated.ts
    - app/src/lib/efxPaintBrushAssets.ts
    - app/src/lib/efxPaintBrushSet.ts
decisions:
  - Rotation lives in the stroke snapshot; the library row is never consulted at replay
  - Delete is confirm-gated, container-scoped, and never routes through shortcuts.ts
  - The Rotation stepper renders only from a machine-library row (no digest -> no row)
  - The chip canvas edge comes from the mask bytes, never a fixed icon constant
metrics:
  duration: "~1h 31m"
  completed: 2026-11-16
actuals:
  tokens: 211323
  tasks: 10
  commits: 11
plan_head_before: 860e170a7b7ac6ace4008c2ce71c17c0d2a15033
plan_head_after: 5d02eb62ce2d8c9ae2958308605b32fcfb3ed66a
```

`commits` is MEASURED: `git rev-list --count 860e170a7..5d02eb62c` = 11.
`actuals.tokens` is chars/4 over the realized diff (`git diff 860e170a7..HEAD`
= 845,292 chars), on the same scale as the plan's 150,000-token estimate.

---

## Tasks and commits

| Task | Name | Commit | Gate result at commit |
|------|------|--------|-----------------------|
| 1 | One imported 512×512 texture lands in the machine library and paints | `4f56cc16d` | package + app suites green |
| 2 | Scan the brush library at app start; machine-scoped catalog | `27aad8b34` | package + app suites green |
| 3 | Imported textures are the only source (built-ins deleted) | `762f2a9f5` | package + app suites green |
| 4 | Remove the `.mce` brush carrier and per-project asset bookkeeping | `87247fa9b` | package + app suites green |
| 5 | Script brush carrier is metadata-only | `9ad60a9e2` | package + app suites green |
| 6 | Delete a library texture behind one confirmation | `3a8007f3f` | `cargo test brush_library` green; app suites green |
| 7 | Map paint size in pixels; retire the engine size floor | `d1546a956` | package `params.test.ts` + bridge green |
| 8 | Show and store the paint size in px, split from lift size | `60c9f232e` | app suites green |
| 9 (RED) | Pin AQTL v4, SNAP retirement and the `textureRotation` carriers | `7e7af2c50` | RED evidence recorded; suite failing by design |
| 9 (GREEN) | Carry the rotation in degrees through AQTL v4 and the Roto script | `4f0af8c39` | app + package suites green |
| 10 | Mipmapped tip, rotation uniform, Textures rotation stepper, retired-prefix scan | `5d02eb62c` | 3/3 gates green (details below) |
| 11 | Live UAT — ten rows | — | **APPROVED (user, 2026-11-16)** |

### Task 10 gate results (at `5d02eb62c`)

- `cd packages/efx-watercolor && pnpm exec vitest run src/playground` —
  7 files, **57 passed**.
- `cd app/src-tauri && cargo test brush_library` —
  **24 passed, 0 failed** (139 filtered).
- `pnpm --filter efx-motion-editor exec vitest run src/lib/brushLibrary.test.ts
  src/lib/physicPaintBridge.test.ts src/lib/noRetiredTextureIds.test.ts
  src/components/physic-paint/view/watercolorMaskChip.test.ts
  src/components/physic-paint/view/PhysicsPaintTextureModal.test.ts` —
  5 files, **234 passed, 1 skipped**.
- `pnpm exec tsc --noEmit` (app) — clean.
- Regression sweep of the retargeted/strip suites (9 files,
  **228 passed**).

### Full verification at HEAD (pre-checkpoint, mandated by the plan)

- `pnpm --filter efx-motion-editor exec vitest run` —
  448 files passed / 2 skipped; **9480 passed, 1 skipped, 96 todo**.
- `cd packages/efx-watercolor && pnpm exec vitest run` —
  21 files, **416 passed, 8 skipped**.
- `cd app/src-tauri && cargo test` —
  163 lib + 20 + 39 + 4 + 21 = **247 passed, 0 failed**.

### Cross-cutting invariants

1. No `wc/builtin-` anywhere in `app/src`, `packages/efx-watercolor/src`,
   `app/src-tauri/src`; pinned by `app/src/lib/noRetiredTextureIds.test.ts`
   (needle built at runtime; no whitelist, per-root non-vacuity guards).
2. No `brushPack` in a saved `.mce`; no texture bytes in scripts; no
   `brushes/` tree written by a save.
3. `TIP_SIZE === 192`; `TIP_MASK_EDGE === 512`; `TIP_MASK_BYTES === 262144`;
   the two constants are independent and pinned.
4. `generateMipmap` / `LINEAR_MIPMAP` match exactly one production site
   (`Engine.tipTexture`), pinned by `engineTipIdentity.test.ts`.
5. `sizeToEngineScale` is byte-identical for every non-negative canonical
   except the removed `Math.max(0, sizePx / 32)` floor; the literal table in
   `params.test.ts` pins 1/12/32/33/80/81/800.
6. No renderer string literal for the library root path outside comments and
   tests.
7. `textureRotation` is integer degrees in every in-memory and JSON carrier;
   hundredths exist only inside the AQTL byte body, pinned by the 37-degree
   anti-mixup test (`3700` in a JSON carrier is refused).

---

## Deviations from Plan

### 1. [Rule 2 — missing critical coverage] Task 9 also changed two files outside its list

**Found during:** Task 9 (GREEN), commit `4f0af8c39`.
**Issue:** The plan's Task 9 file list named the codec, schema, play controller,
duplicate script and record state, but the recorded rotation cannot reach the
engine without the two carrier call sites.
**Fix:** `AquarelleCanvasLayer.tsx` now binds the current library-row rotation on
the live brush and records it on both stroke literals (same lift-gated
conditional spread as `textureId`); `engineAdapter.ts` replays the STROKE's
recorded rotation (never the library row, which the bake cannot read), with
`null` for textureless/lift strokes and `0` as the textured default.
**Files:** `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx`,
`packages/efx-watercolor/src/adapter/engineAdapter.ts`.

### 2. [Rule 1 — stale plan premise] Task 10's retired-id scope was 31 occurrences in 9 files, not one file

**Found during:** Task 10.
**Issue:** The plan said `watercolorMaskChip.test.ts` was "the last fixture
carrying a retired built-in id". The tree held **31 occurrences across 9
files**, including two production comments (`physicsPaintRotoScriptLibrary.ts`,
`aquarelleRecordState.ts`) and six further test files
(`aquarelleBrushCatalog.test.ts`, `aquarelleLiftErase.test.ts`,
`physicsPaintRotoPlayScriptController.bake.test.ts`,
`physicsPaintRotoDuplicateScript.test.ts`, `aquarelleRecordState.test.ts`,
`physicsPaintRotoScriptLibrary.test.ts`).
**Fix:** Every occurrence was retargeted to `wc/custom-*` (or a non-custom
`wc/legacy-chalk` where the test's point is a non-custom id); two tests were
renamed accordingly. The mandated scan has no whitelist and no skip list, so a
partial retarget was not an option. `grep -rn "wc/builtin-"` now returns zero.
**Files:** the nine files above + `noRetiredTextureIds.test.ts` (new).

### 3. [Rule 1 — stale plan premise] Task 9's SNAP controller loop pin was misidentified

**Found during:** Task 9.
**Issue:** The plan asked to update the `[1,2,3,4]` loop at
`studioScriptSnapshotController.test.ts:434` so inner AQTL 1–3 are retired and
4 accepted. That loop exercises the OUTER SNAP container version, not the inner
AQTL version — editing it would have pinned the wrong axis.
**Fix:** The outer loop was left untouched; inner retirement is covered by the
`studioScriptSnapshotCodec.test.ts` cases plus a new WR-12 controller test that
drives an inner version 1–3 payload to `aqtl-retired` and version 4 through the
normal decode.

### 4. [Rule 1 — consequence of the new shader] `dryMedia.test.ts` pin updated

**Found during:** Task 10, gate 1.
**Issue:** `dryMedia.test.ts:18` pinned the pre-rotation sampling line
`clamp(q * 0.5 + ...)`. Task 10 rotates the sampled tip-space coordinate, so the
pin failed by design.
**Fix:** The pin now names the rotated coordinate `tq` and a comment states the
division of labour (jitter on `tq`; discard and silhouette on unrotated `q`).
The dry-media law itself is unchanged.

### 5. [Rule 2 — missing critical coverage] Test coverage authored beyond the literal file list

**Found during:** Tasks 9–10.
**Fix:** `packages/efx-watercolor/src/playground/shaders.test.ts` (new) pins the
rotation formula, the unrotated-`q` discard and the lift envelope. The existing
`engineTipIdentity.test.ts` gained mipmap/filter/binding pins. `brushLibrary.test.ts`,
`physicPaintBridge.test.ts` and `PhysicsPaintTextureModal.test.ts` gained the
`set-rotation` surface: native args in degrees, replace-only row update,
idempotent no-op, refused/rejected answers leaving the catalog byte-identical,
one commit per release, no-request on an unchanged value, in-flight/lock
disabling, the `3700` refusal, and the source/CSS ordering pins.

### 6. Prior-session test corrections (documented for completeness)

- AQTL minimal-stroke length expectation corrected from 3 to the actual 2 added
  bytes; byte-length pin updated to 96/3752.
- A restore test needed `setAquarelleSelectedTextureId` plus a registered mask
  to exercise the recorded-texture path.
- Stale package `dist` required `pnpm run build` before app tests could see the
  Task 9/10 package changes.
- The rewrite of `watercolorMaskChip.test.ts` initially had an `imageOf` helper
  that inspected the last-painted canvas globally; it now follows the chip's
  one-hop source-canvas blit. Fixed before the gate was accepted.

---

## Code review fixes (post-execution)

`261116-inu-REVIEW.md` raised 1 blocker and 4 warnings against the implemented
change. All five were fixed before the live UAT pass, because CR-01 could
destroy a user's library and WR-03 could make a project unsaveable.

| Finding | Fix |
|---|---|
| **CR-01** — an unreadable or oversized `catalog.json` read as "empty", so the next import rewrote the catalog from that empty state and dropped every sibling row (orphaning its `<digest>.webp`). | `read_catalog` is now fallible: absent → `Ok(default)`; symlinked, non-regular, oversized or unparseable → `Err`. All three mutations propagate the error, and the write path loads the catalog **before** storing any file. `read_catalog_entries_lenient` is untouched, so the scan stays per-row tolerant by design. |
| **WR-01** — `catalog.json` was read without a symlink refusal, so a link to a device or FIFO could read unbounded or block the awaited boot scan. | `read_catalog` now calls `reject_symlink` and requires `is_file()` before reading. |
| **WR-02** — mask reads were whole-file with no cap and no regular-file check. | New `mask_file_is_bounded` gate (`is_file()` + `MAX_MASK_FILE_BYTES = 4 MiB`) runs before every mask read, in both the scan probe and the decode path. A FIFO or device is refused before any `open`. |
| **WR-03** — a crafted AQTL body with non-whole hundredths (e.g. `4550`) decoded to `45.5°`, after which the encoder refused every later save of that timeline. | The decoder now rejects `hundredths % 100 !== 0` as `invalid-value`, keeping DEGREES integral in memory as the unit law requires. |
| **WR-04** — chips are Tab stops, but Delete acted on the *selection*, so tabbing to chip B and pressing Delete deleted A. | The chip carries `data-texture-id`; the gesture's subject is the **focused chip**, falling back to the selection only when the sheet container itself has focus. The Default chip (empty id) is never a subject. |

Regression tests added: `an_unreadable_catalog_refuses_a_mutation_instead_of_rewriting_it_empty`,
`an_oversized_catalog_is_refused_rather_than_read_as_empty`,
`a_missing_catalog_is_not_an_error` (Rust); `rejects hundredths that are not a
whole degree instead of decoding a fraction` (codec); `acts on the FOCUSED chip,
never the selection — Tab elsewhere then Delete` (modal).

Two ordering bugs introduced *by the fix itself* were caught by the existing
suite and corrected before commit: `parse_webp_dimensions` requires the whole
enclosing chunk, so a 512-byte header sniff made every valid entry report
unavailable (the bound now lives on the file, not the slice); and moving
`read_catalog` earlier had put it ahead of the digest-collision check, which
would have returned the existing row for a poisoned file.

Gates after the fixes: app **9482 passed** / 1 skipped / 96 todo (448 files),
package **416 passed** / 8 skipped (21 files), Rust **250 passed** / 0 failed,
`tsc --noEmit` clean.

---

## Auth gates

None.

## Known Stubs

None. No placeholder values, no unwired data sources, and no skipped tests were
introduced by this plan.

## Threat Flags

None beyond the plan's `<threat_model>`. T-09's mitigation (child → main
mutation pair with a closed operation set, exact-digest and integer-degree
guards, correlation and fail-closed refusals) is implemented and pinned in
`physicPaintBridge.test.ts`; Rust re-validates the digest and the degree range
before any path is built.

---

## Task 11 — Live UAT (APPROVED 2026-11-16)

**User verdict: all ten rows approved live on 2026-11-16.** The Notes keep
what each row verifies and why it needs a live Studio.

| # | Row | Status | Note |
|---|-----|--------|------|
| 1 | Fresh state shows Default only in both Textures surfaces; a new `.mce` contains no `brushes/` and no `brushPack` | approved | automated pins exist; live `new project → inspect .mce` |
| 2 | Import PNG/JPG, paint, save, quit, relaunch: tip listed and paints; a 512×512 lossless WebP exists under `~/.config/efx-motion/brushes/` | approved | real filesystem |
| 3 | Import the same file twice: one row, one file | approved | automated dedupe pin + live disk check |
| 4 | Size reads 512 and Round paints a 512 ± 1 px footprint at full pressure on a 1080-tall project — never 612–620 px; at 1, a single-document-pixel dot, control still reads 1 | approved | **cannot be proven by vitest (no WebGL harness)** |
| 5 | At S = 430, 256, 64, 17 the same texture downsamples smoothly through mipmaps with no shimmer while the stroke moves | approved | **cannot be proven by vitest (no WebGL harness)** |
| 6 | Rotate to 37, paint, save/reopen and Play: orientation matches live sheet, bake and playback; clearing to 0 restores the original look | approved | live visual check |
| 7 | Save Script / Copy, then Apply into a project whose library has the same texture at 0: Play in motion, static, reveal-tail and reveal-run all stamp the recorded 37 | approved | live cross-project check |
| 8 | Delete asks once, removes one row and one file, resets selection to Default; a project using it reopens with the response tip and one warning | approved | real filesystem |
| 9 | Copy the `.mce` to a machine without the texture (or rename its library file): replay falls back to the response tip with exactly one warning; importing the same texture restores the recorded look | approved | real filesystem |
| 10 | Lift/eraser size still reads 1..80 and is unaffected by the paint size control | approved | live check |

### Follow-up fix series (261116-rp)

Live UAT exposed script-replay defects on textured strokes; all fixed and
pinned before closure.

| Commit | Fix |
|--------|-----|
| `ebce6319f` | Record the raw pointer path (real 60 Hz ticks) so scripts replay the live deposit instead of the index law |
| `427fafd12` | Accept raw tick spans in the Roto script guard — `ticks` is the last point's tick, ticks must be nondecreasing |
| `cf70eff12` | Never dwell-stamp on the tick that starts a stroke (the same-tick second impression doubled the text on Apply) |
| `3ef1ebae4` | Headless ink-parity probe: bundles the real bake and a real-pointer live replay, compares per-stamp deposit logs |

Known residual, accepted by the user: a short textured stroke can still differ
slightly from the live sheet because live batches coalesced samples into one
frame while replay feeds one sample per tick, and replay traces straight
segments. Closing that gap is replay-fidelity work, not a quick-task patch.

### Declared loss (verbatim)

A project or script opened on a machine without the texture replays with the
response tip and the existing warning; importing the same texture there
restores the look.

---

## Self-Check

- Created files: all 6 plan-created source/test files FOUND.
- Commits: all 11 plan commits FOUND as ancestors of HEAD (`5d02eb62c`).
- Working tree: only this quick task's `.planning/` directory is untracked
  (docs artifacts intentionally not committed by the executor).

## Self-Check: PASSED
