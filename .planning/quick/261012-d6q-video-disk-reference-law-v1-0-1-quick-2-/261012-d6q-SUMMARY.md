---
phase: quick-261012-d6q
plan: 261012-d6q
subsystem: project-io
tags: [tauri, rust, serde, preact-signals, disk-reference, video, mce-manifest, tdd]

requires:
  - phase: quick-261009-rko
    provides: audio disk-reference law (source_path verbatim, never-copy registration door, fail-closed load door) that video now mirrors
provides:
  - `video_assets` manifest member declared on MceProject in BOTH TS (types/project.ts + buildMceProject emission) and Rust (models/project.rs serde) so gallery video rows survive save/reopen
  - never-copy video import door (`registerPickedVideoSource`) — pure in-memory registration, zero fs calls, ImportedView video branch no longer copies into `videos/`
  - fail-closed video load doors: `readMceVideoAssetSourcePath` (video_assets[]) and `readMceVideoLayerPath` (layer source) — retired `relative_path` and relative `video_path` throw, absolute paths returned byte-verbatim, no projectRoot join
  - `videos/` provisioning retired from `create_project_dir` — a fresh package never gets a videos/ tree
  - dedupe-by-id between wholesale `video_assets` hydration and the surviving layer re-discovery fallback (exactly one gallery row)
affects: [quick-261012-rd6, release-v1.0.1, video-import, project-io]

actuals:
  tokens: 11349
  tasks: 3
  commits: 3
  plan_head_before: c83c793379641d2c1d16600cc6abccb7aa933522
  plan_head_after: a2afe490eefa3eb979172312e27531d6e2dcb2a2

tech-stack:
  added: []
  patterns:
    - "disk-reference law generalized to video: heavy media never enter the .mce package; source_path carried verbatim (no join, no strip, no re-root)"
    - "serde drop-hole pattern: undeclared JSON keys are silently dropped on Rust round-trip — manifest members must be declared in BOTH languages"
    - "shared fail-closed source-path reader core (mceAudioSourcePath.ts) serving audio + video load doors"

key-files:
  created:
    - app/src/lib/mainAppVideoSources.ts
    - app/src/lib/mainAppVideoSources.test.ts
  modified:
    - app/src/types/project.ts
    - app/src/lib/mceAudioSourcePath.ts
    - app/src/lib/mceAudioSourcePath.test.ts
    - app/src/stores/imageStore.ts
    - app/src/stores/projectStore.ts
    - app/src/stores/projectStore.test.ts
    - app/src/components/views/ImportedView.tsx
    - app/src-tauri/src/models/project.rs
    - app/src-tauri/src/services/project_io.rs
    - app/src-tauri/src/commands/project.rs
    - app/src-tauri/tests/physic_paint_cache_publication.rs

key-decisions:
  - "video_assets declared with #[serde(default, skip_serializing_if = \"Vec::is_empty\")] mirroring audio_assets — empty galleries stay out of the file, non-empty rows round-trip byte-equal"
  - "readMceVideoLayerPath returns '' for absent/empty video_path (a layer with no source keeps its empty-path behavior) but throws on any non-absolute non-empty path — clean break, no shim, no migration"
  - "layer re-discovery fallback kept alive; addVideoAsset made idempotent-by-id so hydration (wholesale set, runs first) + re-discovery never yields duplicate gallery rows"
  - "images remain copied into the package by design — the disk-reference law applies to heavy media (audio, video) only"

patterns-established:
  - "Mirror-the-audio pattern: any new heavy-media class gets a register*Source never-copy door + declared manifest member in TS and Rust + fail-closed readers at every load door"

requirements-completed: [VID-01, VID-02, VID-03]

coverage:
  - id: D1
    description: "Never-copy video import door — a picked video is registered by its absolute picker path verbatim; no mkdir/copy runs at any door, nothing lands under videos/, the source file stays untouched"
    requirement: VID-01
    verification:
      - kind: unit
        ref: "app/src/lib/mainAppVideoSources.test.ts — registration legs, video disk-reference chain, source-scan pins (no plugin-fs in ImportedView, registerPickedVideoSource in the video branch)"
        status: pass
      - kind: unit
        ref: "app/src/stores/projectStore.test.ts — never-called pin (mockMkdir/mockCopyFile zero calls across build+hydrate)"
        status: pass
    human_judgment: true
    rationale: "Native picker behavior (file untouched at origin, gallery row visible) must be judged live by the user — UAT row 1; vitest cannot observe the Tauri dialog"
  - id: D2
    description: "video_assets manifest member round-trips byte-for-byte through the TS build and the Rust serde save/open, and reopen restores the gallery row plus the layer playback path from that verbatim path"
    requirement: VID-02
    verification:
      - kind: unit
        ref: "app/src/stores/projectStore.test.ts — emit-verbatim, hydrate-verbatim, no-remap legs"
        status: pass
      - kind: unit
        ref: "app/src-tauri/src/services/project_io.rs#test_save_and_open_roundtrip — non-empty video_assets survives serde save/open byte-equal"
        status: pass
    human_judgment: true
    rationale: "Save → close → reopen and video playback from the original on-disk source are live judgments — UAT rows 2-3"
  - id: D3
    description: "A freshly created package provisions no videos/ directory and no code path mkdirs or copies into a videos/ tree"
    requirement: VID-03
    verification:
      - kind: unit
        ref: "app/src-tauri/src/services/project_io.rs#test_create_project_dir_creates_subdirectories — assert!(!test_dir.join(\"videos\").exists())"
        status: pass
      - kind: integration
        ref: "app/src-tauri/tests/physic_paint_cache_publication.rs#package_creation_produces_layers_and_frames_without_a_package_cache — no videos/ inside a fresh package"
        status: pass
    human_judgment: false
  - id: D4
    description: "Load doors fail closed on legacy forms — video_assets[] member with retired relative_path or missing/empty source_path, and video layer source with a relative video_path (videos/clip.mp4), each throw at hydration"
    requirement: VID-01
    verification:
      - kind: unit
        ref: "app/src/lib/mceAudioSourcePath.test.ts — readMceVideoAssetSourcePath / readMceVideoLayerPath reader units"
        status: pass
      - kind: unit
        ref: "app/src/stores/projectStore.test.ts — refusal A (video_assets[]) and refusal B (relative layer video_path) legs"
        status: pass
    human_judgment: true
    rationale: "Optional live row (UAT row 4): opening an actual legacy .mce only applies if such a file is at hand; the throw behavior itself is proven by unit legs"

duration: 14min
completed: 2026-10-12
status: complete
---

# Phase quick-261012-d6q: Video Disk-Reference Law Summary

**Video joined the audio disk-reference law: never-copy import door, `video_assets` declared on MceProject in TS and Rust with byte-verbatim round-trip, fail-closed load doors, and `videos/` package provisioning retired (VID-01/02/03).**

## Performance

- **Duration:** 14 min
- **Started:** 2026-10-12T07:54:20Z
- **Completed:** 2026-10-12T08:08Z
- **Tasks:** 3
- **Files modified:** 13

## Accomplishments

- `video_assets` is a declared manifest member on both sides of the serde boundary — TS emits `imageStore.toMceVideoAssets()` in `buildMceProject`, Rust declares `video_assets: Vec<MceVideoAssetRef>` — so gallery video rows (used or not) survive save/reopen instead of being silently dropped.
- The ImportedView video branch no longer copies anything: `registerPickedVideoSource` is a pure registration (dedupe by path, zero fs calls), the file's `plugin-fs` import is gone, and a fresh package provisions no `videos/` tree.
- Both video load doors fail closed through the shared reader core in `mceAudioSourcePath.ts`: retired `relative_path` keys and relative `video_path` values (`videos/clip.mp4`) throw at hydration; absolute paths come back byte-verbatim with no projectRoot join.
- Full TDD cycle held: Task 1 RED (11 TS legs + the Rust provisioning assertion failed), Tasks 2-3 turned everything green without editing a single Task 1 assertion (only the implementation files the assertions target changed).

## Task Commits

Each task was committed atomically:

1. **Task 1: RED — video disk-reference law tests** - `789528d9` (test)
2. **Task 2: GREEN TS — verbatim registration, fail-closed load doors, no copy** - `b1f0e53f` (feat)
3. **Task 3: GREEN Rust — declare video_assets, retire videos/ provisioning** - `a2afe490` (feat)

**Plan head before:** `c83c7933` · **Plan head after:** `a2afe490` · **Commits measured:** 3 (`git rev-list --count`)

## Files Created/Modified

- `app/src/lib/mainAppVideoSources.ts` (new) — `registerPickedVideoSource`: pure registration, path-deduped, never-copy
- `app/src/lib/mainAppVideoSources.test.ts` (new) — registration legs, end-to-end build→hydrate chain, source-scan never-copy pins
- `app/src/types/project.ts` — `video_assets?: MceVideoAssetRef[]` + `MceVideoAssetRef {id, name, source_path}` + video_path comment rewrite
- `app/src/lib/mceAudioSourcePath.ts` — shared `readDeclaredSourcePath` core; new `readMceVideoAssetSourcePath` and `readMceVideoLayerPath`; audio messages byte-unchanged
- `app/src/lib/mceAudioSourcePath.test.ts` — reader-unit legs for both video doors
- `app/src/stores/imageStore.ts` — `loadFromMceVideoAssets`/`toMceVideoAssets` beside the audio pair, `addVideoAsset` idempotent-by-id, `relativePath?` member deleted, video path remap removed from `updateProjectPaths`
- `app/src/stores/projectStore.ts` — `video_assets` emission in `buildMceProject`, hydration step before the sequence loop, video layer branch reads via the fail-closed reader (projectRoot join deleted)
- `app/src/stores/projectStore.test.ts` — 261012-d6q describe: emit/hydrate/refusal/no-remap/dedupe/never-called legs
- `app/src/components/views/ImportedView.tsx` — video branch collapsed to `registerPickedVideoSource`; `plugin-fs` import deleted
- `app/src-tauri/src/models/project.rs` — `video_assets` member on `MceProject` + `MceVideoAssetRef` struct
- `app/src-tauri/src/services/project_io.rs` — `videos/` provisioning deleted, doc rewritten, 5 literals extended, round-trip test extended with a non-empty video entry
- `app/src-tauri/src/commands/project.rs` — `video_assets: vec![]` in `project_create`
- `app/src-tauri/tests/physic_paint_cache_publication.rs` — `manifest_project` extended + package-layout `videos` negative

## Decisions Made

- Serde attrs mirror audio exactly (`default` + `skip_serializing_if = "Vec::is_empty"`) so empty galleries keep the file byte-stable while non-empty rows round-trip.
- `readMceVideoLayerPath` treats absent/empty `video_path` as `''` (preserves the no-source layer behavior) but throws on any relative non-empty form — the clean break the plan mandates.
- The layer re-discovery fallback was NOT removed; the wholesale `video_assets` hydration runs before it and `addVideoAsset` dedupes by id, so a project whose gallery row and layer share one id hydrates to exactly one row.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Typecheck-safe casts for not-yet-existing surfaces in Task 1 RED tests**
- **Found during:** Task 1 (RED tests)
- **Issue:** The plan's refusal-A snippet called `imageStore.loadFromMceVideoAssets(...)` directly, which fails `tsc` at RED time (member does not exist yet), contradicting the plan's own done criterion "typecheck clean (all not-yet-existing surfaces reached through casts/duck-types)".
- **Fix:** Duck-typed optional-member cast (`imageStore as unknown as {loadFromMceVideoAssets?: ...}` then `!` call) and `Record<string, unknown>` overrides + `as unknown as RuntimeMceProject` for the fixture carrying `video_assets` before the TS type declares it. Assertion semantics unchanged — both legs still fail under their own test names at RED, and pass only when the real member exists with the right throw messages.
- **Files modified:** app/src/stores/projectStore.test.ts
- **Verification:** RED run showed exactly these legs failing; green run after Task 2 with zero Task 1 assertion edits (`git diff 789528d9..HEAD` on both Task 1 test files is empty)
- **Committed in:** `789528d9` (part of Task 1 commit)

---

**Total deviations:** 1 auto-fix (1 blocking)
**Impact on plan:** Typecheck adaptation only — no assertion weakened, no scope change.

## Issues Encountered

- `gsd_run` is not on PATH; used the project-local `.claude/gsd-core/bin/gsd_run` per CLAUDE.md. No other issues.

## Verification Results

- `vitest run` (full suite): **262 files passed | 2 skipped, 4848 tests passed | 1 skipped | 96 todo — 0 failed** (no new failures vs baseline)
- `tsc --noEmit`: rc=0 (after Task 2; Task 3 touched no TS)
- `cd app/src-tauri && cargo test`: **all suites ok, 0 failed** — Task 1's RED `videos` assertion green, new round-trip proof green
- Guardrail audit (`git diff c83c7933..HEAD`): 13 files, all in plan scope — `mainAppAudioSources.*`, `AudioProperties.*`, image import paths, `capabilities/default.json`, `lib.rs`, `Cargo.toml` all untouched

## Known Stubs

None — no hardcoded empties, placeholder text, or unwired data sources introduced.

## Status: automated-ready pending user native UAT

| # | Case | Pass condition |
|---|------|----------------|
| 1 | Never-copy import | Import a video from OUTSIDE the project dir → package has NO videos/ and no copy; source file untouched; gallery row shows |
| 2 | Save → close → reopen | Gallery row holds with the same file; the layer's video still plays from the original on-disk source |
| 3 | Manifest inspection | Saved .mce contains `video_assets[].source_path` equal to the picked path, no `relative_path` on that member |
| 4 | Legacy refusal (optional) | An old .mce with a videos/-relative path shows the clean refusal — no silent join, no shim |

Nothing is claimed done before the user's native UAT passes (no Chrome DevTools MCP; live visual judgment stays with the user).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Quick 2 (261012-d6q) automated gates all green; ready for the user's native UAT, then Quick 3 (SND-07).
- No blockers. Stop after this quick per plan scope.

## Self-Check: PASSED

- FOUND: app/src/lib/mainAppVideoSources.ts
- FOUND: app/src/lib/mainAppVideoSources.test.ts
- FOUND: app/src/types/project.ts (video_assets)
- FOUND: app/src-tauri/src/models/project.rs (MceVideoAssetRef)
- FOUND: commit 789528d9 (ancestor of HEAD)
- FOUND: commit b1f0e53f (ancestor of HEAD)
- FOUND: commit a2afe490 (ancestor of HEAD)

---
*Phase: quick-261012-d6q*
*Completed: 2026-10-12*
