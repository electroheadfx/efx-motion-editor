---
phase: quick-261009-rko
verified: 2026-10-09T19:18:15Z
status: human_needed
score: 4/4 must-haves verified
covered_files:
  - .planning/quick/261009-rko-main-app-audio-joins-the-disk-reference-/261009-rko-PLAN.md
  - .planning/quick/261009-rko-main-app-audio-joins-the-disk-reference-/261009-rko-SUMMARY.md
  - app/src/components/sidebar/AudioProperties.tsx
  - app/src/components/views/ImportedView.tsx
  - app/src/lib/documentSoundGates.test.ts
  - app/src/lib/documentSoundGates.ts
  - app/src/lib/mainAppAudioSources.test.ts
  - app/src/lib/mainAppAudioSources.ts
  - app/src/lib/mceAudioSourcePath.test.ts
  - app/src/lib/mceAudioSourcePath.ts
  - app/src/lib/physicPaintBridge.test.ts
  - app/src/lib/playbackEngine.test.ts
  - app/src/stores/audioStore.test.ts
  - app/src/stores/imageStore.ts
  - app/src/stores/projectStore.test.ts
  - app/src/stores/projectStore.ts
  - app/src/types/audio.ts
  - app/src/types/project.ts
covered_digest: "v3:sha256:bdf13552043e3725eab02e7b7e80b6482e994574ae835d4d3c56f32e5ffbfd8a"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Gallery import a real audio file from outside the project (e.g. ~/Music). Inspect the saved .mce package tree and the source file's mtime/size."
    expected: "No audio/ directory and zero audio bytes inside the package; the source file is untouched at its origin; the gallery row shows the basename."
    why_human: "Native Tauri open() dialog and on-disk package inspection need the user's live session; unit tests only prove mkdir/copyFile are not invoked by the registration door."
  - test: "Sidebar Replace... on an existing audio track with a different file. Inspect the package and the new source file."
    expected: "Track filePath/originalFilename update to the new absolute path; no package copy; Replace... and every other label unchanged."
    why_human: "Real picker + package-tree inspection cannot run under vitest."
  - test: "Save, close, reopen the project. Play the audio and check the waveform peaks and gallery row."
    expected: "Playback and peaks work from the disk reference; the gallery row reappears with the absolute path; no projectRoot join in the resolved path."
    why_human: "Live efxasset decode through Tauri and audible playback need the user's session."
  - test: "Open a project with Studio document sounds and exercise their Relink surface."
    expected: "Studio document sounds and their Relink are unaffected (261009-ofk behavior)."
    why_human: "Cross-window Studio UX and Relink UI are native/live surfaces."
  - test: "Move/rename the referenced main-app audio file on disk, then play the track. Separately check a moved Studio document-sound source."
    expected: "Main-app track shows existing error behavior only (no Relink UI); Studio still shows red + Relink."
    why_human: "Missing-file error presentation and the Studio red-row contrast need live judgment."
---

# Quick 261009-rko: Main-App Audio Joins the Disk-Reference Law — Verification Report

**Phase Goal:** Main-app audio joins the disk-reference law — no copy in gallery import or sidebar Replace, source_path manifest clean break. Locked law: heavy media NEVER enter the .mce package; a main-app audio file is a REFERENCE to its on-disk location.
**Verified:** 2026-10-09T19:18:15Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth   | Status     | Evidence       |
| --- | ------- | ---------- | -------------- |
| 1   | Main-app audio is a DISK REFERENCE: gallery import and sidebar Replace record the picker's absolute path verbatim, write nothing into the package, leave the picked file untouched (no audio/ tree, zero audio bytes). | ✓ VERIFIED | `ImportedView.handleImport` audio branch is `open()` + `registerPickedAudioSource(filePath)` only (`app/src/components/views/ImportedView.tsx:388`); `AudioProperties.handleReplace` is `readAudioSourceBytes` + `buildAudioReplacePatch` (`app/src/components/sidebar/AudioProperties.tsx:41,50`). Both shared doors are pure registration/patch (`app/src/lib/mainAppAudioSources.ts`) with zero fs writes. Unit tests pin mkdir/copyFile never invoked (`mainAppAudioSources.test.ts`) and source-pin the two handlers free of mkdir/copyFile/destPath. Video `mkdir`/`copyFile` remains only on the video branch (SCOPE OUT). |
| 2   | `.mce` members `audio_tracks[].source_path` and `audio_assets[].source_path` carry the absolute on-disk path verbatim through save/reopen; a member still carrying `relative_path` THROWS at the load door — clean break, no shim, no migration. | ✓ VERIFIED | Types renamed (`app/src/types/audio.ts:37`, `app/src/types/project.ts:216`); writer emits `source_path: track.filePath` / `source_path: asset.path` (`projectStore.ts:444`, `imageStore.ts:225-230`); `readMceAudioSourcePath` throws on `relative_path` presence and on missing/empty/non-string `source_path` (`app/src/lib/mceAudioSourcePath.ts:32-40`). Both load doors call it (`imageStore.ts:211`, `projectStore.ts:674`). Named tests: round-trip + no `relative_path` key in JSON + retired-key throws (`projectStore.test.ts:353-401`, `mceAudioSourcePath.test.ts`). |
| 3   | Reopen resolves `filePath` and gallery `path` from `source_path` verbatim (no projectRoot join); playback and waveform peaks decode through the efxasset channel (`fetch(assetUrl(path))`). | ✓ VERIFIED | `hydrateFromMce` sets `filePath: sourcePath` verbatim (`projectStore.ts:674-679`); `loadFromMceAudioAssets` sets `path: sourcePath` with no join/strip (`imageStore.ts:209-214`). All three decode sites call `readAudioSourceBytes` → `fetch(assetUrl(...))` (`mainAppAudioSources.ts:29-34`; `projectStore.ts:781`, `ImportedView.tsx:329`, `AudioProperties.tsx:41`). Named tests: verbatim hydrate + reopen-loop fetch(assetUrl) and never plugin-fs readFile (`projectStore.test.ts:373-431`). |
| 4   | Studio shared picker (`requestImageImport` kind 'audio') keeps producing absolute-path `sourcePath` assets; gallery import and the Studio picker register identical absolute-path `imageStore.audioAssets` records. | ✓ VERIFIED | `requestImageImport` forwards `kind` to the main-realm handler (`physicPaintBridge.ts:2831-2856`); `applyPhysicPaintImageImportRequest` routes `kind === 'audio'` to `importAudio` (`:2591-2610`); `importAudio` registers `{id, name: basename, path: filePath}` and refs with `sourcePath: filePath` — never-copy (`:2640-2665`). `registerPickedAudioSource` registers the same shape. Non-regression test `returns sourcePath verbatim and calls neither mkdir nor copyFile` stays green (`physicPaintBridge.test.ts:7508`). |

**Score:** 4/4 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected    | Status | Details |
| -------- | ----------- | ------ | ------- |
| `app/src/lib/mceAudioSourcePath.ts` | Single fail-closed load-door parser | ✓ VERIFIED | Substantive (42 lines); called from both load doors |
| `app/src/lib/mainAppAudioSources.ts` | efxasset decode door + never-copy import/replace helpers | ✓ VERIFIED | Substantive (71 lines); `readAudioSourceBytes` / `registerPickedAudioSource` / `buildAudioReplacePatch` all wired from callers |
| `app/src/types/audio.ts` | `MceAudioTrack.source_path`; `AudioTrack.relativePath` retired | ✓ VERIFIED | `filePath` is the single runtime path field; no `relativePath` on `AudioTrack` |
| `app/src/types/project.ts` | `MceAudioAssetRef.source_path` | ✓ VERIFIED | Comment + field renamed; image `relative_path` intentionally untouched |
| `app/src/stores/imageStore.ts` | Verbatim `loadFromMceAudioAssets` / `toMceAudioAssets`; no audioAssets remap | ✓ VERIFIED | `updateProjectPaths` remaps images + videoAssets only (`:254-263`) |
| `app/src/stores/projectStore.ts` | `source_path` writer; verbatim hydrate; `readAudioSourceBytes` reopen loop | ✓ VERIFIED | `readFile` import dropped; reopen loop uses `readAudioSourceBytes(track.filePath)` |

Note: `gsd_run query verify.artifacts` returned `total: 0` because the PLAN lists artifacts as path strings rather than `{path, provides}` objects. Artifacts were verified manually at exists / substantive / wired levels.

### Key Link Verification

| From | To  | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `imageStore.loadFromMceAudioAssets` + `hydrateFromMce` audio loop | `readMceAudioSourcePath` | shared fail-closed parser | ✓ WIRED | Both load doors call it (`imageStore.ts:211`, `projectStore.ts:674`); neither accepts `relative_path` |
| projectStore reopen loop + ImportedView handleSelectAudio + AudioProperties handleReplace | `readAudioSourceBytes` → `fetch(assetUrl(path))` | efxasset channel | ✓ WIRED | All three decode sites use the helper; plugin-fs `readFile` is gone from projectStore and from handleSelectAudio/handleReplace |
| ImportedView handleImport audio branch + AudioProperties handleReplace | never-copy doors | `registerPickedAudioSource` / `buildAudioReplacePatch` | ✓ WIRED | Both copy sites deleted; mkdir/copyFile remain only on the video branch |
| `AudioTrack.relativePath` retirement | `toDocumentSoundAudioTrack` | type co-change | ✓ WIRED | Field gone from the type; `documentSoundGates.toDocumentSoundAudioTrack` no longer emits it; `buildExportMixEntries` tracks-branch still passes `AudioTrack[]` through unchanged |
| `imageStore.updateProjectPaths` | audio asset paths | drop remap | ✓ WIRED | Temp→real migration no longer rewrites `audioAssets` (disk references outside the project are verbatim) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `MceAudioTrack.source_path` | `track.filePath` | picker path / persisted `source_path` | Yes | ✓ FLOWING |
| `MceAudioAssetRef.source_path` | `asset.path` | picker path / persisted `source_path` | Yes | ✓ FLOWING |
| reopen decode / peaks | `arrayBuffer` | `fetch(assetUrl(track.filePath))` → efxasset → disk file | Yes | ✓ FLOWING |
| gallery Replace patch | `filePath` / `originalFilename` | picker path verbatim + basename | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Targeted unit gates (format law, never-copy, decode door, export mix, Studio picker) | `pnpm exec vitest run src/lib/mceAudioSourcePath.test.ts src/lib/mainAppAudioSources.test.ts src/stores/projectStore.test.ts src/lib/documentSoundGates.test.ts src/stores/audioStore.test.ts src/lib/playbackEngine.test.ts src/lib/physicPaintBridge.test.ts` | 7 files passed; 258 passed, 1 skipped (unrelated `closes the native physics paint window…`), 19 todo (pre-existing GL/undo/playback placeholders) | ✓ PASS |
| Typecheck | `pnpm run typecheck` | clean (tsc --noEmit, no output) | ✓ PASS |
| Commits exist | `gsd_run query verify.commits e9540597 4f0a2dff b3268723 aa446e4a` | `all_valid: true` (4/4) | ✓ PASS |

### Probe Execution

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| (none) | — | No `scripts/*/tests/probe-*.sh` declared or conventional for this quick | N/A |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| QUICK-261009-RKO | 261009-rko-PLAN.md | Main-app audio disk-reference law: never-copy import/Replace, `source_path` clean break, verbatim reopen + efxasset decode, Studio picker non-regression | ✓ SATISFIED | All 4 must-have truths VERIFIED; D1–D3 unit coverage in SUMMARY matches the named tests re-run here |

No orphaned requirements: this quick is not mapped in `.planning/REQUIREMENTS.md` (quick-local requirement ID).

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
|-----------|-----------|--------|---------|----------|-----------------|---------|
| `mceAudioSourcePath.test.ts` | QUICK-261009-RKO | 4 | 0 | No | Value + throw | PASS |
| `mainAppAudioSources.test.ts` | QUICK-261009-RKO | 10 | 0 | No | Value + behavioral (mocked fs/fetch) + source-pin | PASS |
| `projectStore.test.ts` (261009-rko block) | QUICK-261009-RKO | 5 | 0 | No | Value + behavioral (hydrate + reopen decode) | PASS |
| `physicPaintBridge.test.ts` (importAudio never-copy) | QUICK-261009-RKO | 2 | 0 | No | Value + behavioral (mocked fs) | PASS |
| `documentSoundGates.test.ts` (export mix) | QUICK-261009-RKO | 2 | 0 | No | Value (tracks-branch + relativePath undefined) | PASS |

**Disabled tests on requirements:** 0 on this quick's requirement block. Pre-existing `it.todo` (GL transition, undo, playback) and one unrelated `it.skip` are out of scope.
**Circular patterns detected:** 0
**Insufficient assertions:** 0 — never-copy is behaviorally proven on the shared doors and source-pinned on the handlers (the plan's designed unit-testable seam).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| (none) | — | — | — | No `TBD`/`FIXME`/`XXX`, no stub returns, no placeholder strings in modified files |

### Human Verification Required

### 1. Gallery import never-copy on disk

**Test:** Gallery import a real audio file from outside the project (e.g. `~/Music`). Inspect the saved `.mce` package tree and the source file's mtime/size.
**Expected:** No `audio/` directory and zero audio bytes inside the package; the source file is untouched at its origin; the gallery row shows the basename.
**Why human:** Native Tauri `open()` dialog and on-disk package inspection need the user's live session; unit tests only prove `mkdir`/`copyFile` are not invoked by the registration door.

### 2. Sidebar Replace never-copy on disk

**Test:** Sidebar `Replace...` on an existing audio track with a different file. Inspect the package and the new source file.
**Expected:** Track `filePath`/`originalFilename` update to the new absolute path; no package copy; `Replace...` and every other label unchanged.
**Why human:** Real picker + package-tree inspection cannot run under vitest.

### 3. Save/close/reopen keeps playback, peaks, gallery row

**Test:** Save, close, reopen the project. Play the audio and check the waveform peaks and gallery row.
**Expected:** Playback and peaks work from the disk reference; the gallery row reappears with the absolute path; no projectRoot join in the resolved path.
**Why human:** Live efxasset decode through Tauri and audible playback need the user's session.

### 4. Studio document sounds and Relink unaffected

**Test:** Open a project with Studio document sounds and exercise their Relink surface.
**Expected:** Studio document sounds and their Relink are unaffected (261009-ofk behavior).
**Why human:** Cross-window Studio UX and Relink UI are native/live surfaces.

### 5. Moved source file error contrast

**Test:** Move/rename the referenced main-app audio file on disk, then play the track. Separately check a moved Studio document-sound source.
**Expected:** Main-app track shows existing error behavior only (no Relink UI); Studio still shows red + Relink.
**Why human:** Missing-file error presentation and the Studio red-row contrast need live judgment.

### Gaps Summary

No gaps. All four must-have truths, all six artifacts, and all five key links are verified in the codebase. Status is `human_needed` solely for the five live UAT rows the plan and SUMMARY already flag (native pickers, on-disk package inspection, audible playback) — automated done-gates are met.

---

_Verified: 2026-10-09T19:18:15Z_
_Verifier: Claude (gsd-verifier)_
