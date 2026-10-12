---
phase: quick-261009-rko
plan: 261009-rko
subsystem: main-app-audio
tags: [audio, disk-reference, source_path, clean-break, never-copy, efxasset, mce-manifest]

# Dependency graph
requires:
  - phase: quick-261009-ofk
    provides: DocumentSoundClip.sourcePath disk-reference law, efxasset read boundary, never-copy import pattern
provides:
  - MceAudioTrack.source_path / MceAudioAssetRef.source_path (absolute on-disk path, clean break)
  - readMceAudioSourcePath fail-closed load door (retired relative_path throws)
  - readAudioSourceBytes efxasset decode door for main-app audio
  - registerPickedAudioSource / buildAudioReplacePatch never-copy import/replace helpers
  - Gallery import + sidebar Replace record picker path verbatim (no package audio bytes)
affects: [project-save, project-reopen, gallery-import, audio-properties, waveform-peaks, playback]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
# Same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 10200
  tasks: 2
  commits: 4
  plan_head_before: fc811a3f8a5e34009635597fedb745df8e6e021d
  plan_head_after: aa446e4adf88b7cfde667685db236941085f3c89

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Clean-break manifest key: relative_path retired, source_path is the absolute disk reference"
    - "Single load-door parser (readMceAudioSourcePath) shared by both audio load doors"
    - "Single byte-read door (readAudioSourceBytes / fetch assetUrl) for every main-app audio decode"
    - "Never-copy import: pure registration of the picker path, zero mkdir/copyFile"

key-files:
  created:
    - app/src/lib/mceAudioSourcePath.ts
    - app/src/lib/mceAudioSourcePath.test.ts
    - app/src/lib/mainAppAudioSources.ts
    - app/src/lib/mainAppAudioSources.test.ts
  modified:
    - app/src/types/audio.ts
    - app/src/types/project.ts
    - app/src/stores/imageStore.ts
    - app/src/stores/projectStore.ts
    - app/src/stores/projectStore.test.ts
    - app/src/lib/documentSoundGates.ts
    - app/src/lib/documentSoundGates.test.ts
    - app/src/stores/audioStore.test.ts
    - app/src/lib/playbackEngine.test.ts
    - app/src/lib/physicPaintBridge.test.ts
    - app/src/components/views/ImportedView.tsx
    - app/src/components/sidebar/AudioProperties.tsx

key-decisions:
  - "source_path is the absolute on-disk path carried verbatim — no projectRoot join, no root strip"
  - "AudioTrack.relativePath retired; runtime keeps a single filePath disk reference"
  - "readMceAudioSourcePath is the only retired-key throw site; both load doors call it"
  - "readAudioSourceBytes is the only main-app audio byte-read (efxasset fetch); plugin-fs readFile is out"
  - "updateProjectPaths no longer remaps audioAssets — a root-prefix rewrite would corrupt a disk reference"
  - "registerPickedAudioSource dedupes by path; buildAudioReplacePatch rebuilds outFrame from duration * fps"

patterns-established:
  - "Main-app audio joins the 261009-ofk disk-reference law: heavy media never enter the .mce"

requirements-completed: [QUICK-261009-RKO]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "Manifest round-trip emits source_path verbatim for audio_tracks and audio_assets; retired relative_path throws at the load door"
    requirement: QUICK-261009-RKO
    verification:
      - kind: unit
        ref: "app/src/stores/projectStore.test.ts#buildMceProject emits source_path equal to track.filePath and asset.path verbatim"
        status: pass
      - kind: unit
        ref: "app/src/lib/mceAudioSourcePath.test.ts#throws for a member record carrying relative_path"
        status: pass
    human_judgment: false
  - id: D2
    description: "Reopen resolves filePath/asset.path verbatim from source_path and decodes through the efxasset channel"
    requirement: QUICK-261009-RKO
    verification:
      - kind: unit
        ref: "app/src/stores/projectStore.test.ts#hydrateFromMce resolves track.filePath verbatim from source_path with no projectRoot join"
        status: pass
      - kind: unit
        ref: "app/src/stores/projectStore.test.ts#reopen-loop decode reads through fetch(assetUrl(track.filePath)) and never plugin-fs readFile"
        status: pass
    human_judgment: false
  - id: D3
    description: "Gallery import and sidebar Replace register the picker path verbatim and write nothing into the package"
    requirement: QUICK-261009-RKO
    verification:
      - kind: unit
        ref: "app/src/lib/mainAppAudioSources.test.ts#gallery import registers the picker path and never copies into the package"
        status: pass
      - kind: unit
        ref: "app/src/lib/mainAppAudioSources.test.ts#sidebar Replace rebuilds from the picker path and never copies into the package"
        status: pass
    human_judgment: false
  - id: D4
    description: "Live UAT: import/Replace leave no audio/ folder and the source file untouched; save/close/reopen keeps playback and peaks"
    requirement: QUICK-261009-RKO
    verification: []
    human_judgment: true
    rationale: "Native Tauri file dialogs and on-disk package inspection need the user's live session; automated gates cannot open a real picker or inspect a saved .mce folder tree."

# Metrics
duration: 15min
completed: 2026-10-09
status: complete
---

# Quick 261009-rko: Main-App Audio Joins the Disk-Reference Law Summary

**Main-app audio is a disk reference: the .mce carries `source_path` (absolute on-disk path, clean break), gallery import and sidebar Replace never copy bytes into the package, and reopen decodes through the efxasset channel.**

## Performance

- **Duration:** 15 min
- **Tasks:** 2/2
- **Commits:** 4 (TDD RED→GREEN per task)

## TDD Gate Compliance

TDD_MODE is active and both tasks are behavior-adding, so each task landed as a RED→GREEN pair rather than a single feat commit (the plan's "one atomic commit" wording refers to the implementation being one atomic GREEN commit).

| Task | RED | GREEN | RED evidence |
|------|-----|-------|--------------|
| 1. source_path format law | e9540597 | 4f0a2dff | RED_EVIDENCE_OK — target `hydrateFromMce resolves track.filePath verbatim…` failed on the projectRoot-join assertion |
| 2. never-copy import/Replace | b3268723 | aa446e4a | RED_EVIDENCE_OK — target `sidebar Replace rebuilds…` failed while mkdir/copyFile were still present |

## Accomplishments

- **source_path format law:** `MceAudioTrack.relative_path` and `MceAudioAssetRef.relative_path` renamed to `source_path` (absolute on-disk path). A member still carrying `relative_path` throws at `readMceAudioSourcePath` — clean break, no shim.
- **Verbatim reopen:** `hydrateFromMce` and `loadFromMceAudioAssets` resolve `filePath` / `asset.path` from `source_path` with no projectRoot join and no root-prefix strip.
- **Efxasset decode door:** `readAudioSourceBytes(sourcePath)` is the single main-app audio byte-read (`fetch(assetUrl(path))`); the reopen re-decode loop uses it and never calls plugin-fs `readFile`.
- **Never-copy import doors:** gallery `handleImport` audio branch calls `registerPickedAudioSource(filePath)` (no `audioDir`/`mkdir`/`copyFile`); sidebar `handleReplace` reads via `readAudioSourceBytes` and updates via `buildAudioReplacePatch` (no package write).
- **Type co-change:** `AudioTrack.relativePath` retired (runtime keeps `filePath`); `documentSoundGates.toDocumentSoundAudioTrack` dropped its `relativePath` line; every AudioTrack fixture co-changed.
- **Migration remap dropped:** `imageStore.updateProjectPaths` no longer rewrites audio asset paths on temp→real migration (a disk reference outside the project is verbatim).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Block-comment `*/` terminated early in mainAppAudioSources.ts**
- **Found during:** Task 1 GREEN verify
- **Issue:** The phrase `**/audio/**` inside a `/** */` comment closed the block comment and produced `ReferenceError: audio is not defined`.
- **Fix:** Reworded the comment to avoid `*/`.
- **Files modified:** app/src/lib/mainAppAudioSources.ts
- **Commit:** 4f0a2dff

**2. [Rule 3 - Blocking] Component `relativePath` assignments broke typecheck before Task 2 rewiring**
- **Found during:** Task 1 typecheck
- **Issue:** `ImportedView.handleSelectAudio` and `AudioProperties.handleReplace` still set `relativePath` on `AudioTrack` after the field retired.
- **Fix:** Dropped the two `relativePath:` lines as a type co-change in Task 1; the full never-copy handler rewrite stayed in Task 2.
- **Files modified:** app/src/components/views/ImportedView.tsx, app/src/components/sidebar/AudioProperties.tsx
- **Commit:** 4f0a2dff

**3. [Rule 1 - Bug] Reopen-loop test raced past `decode`**
- **Found during:** Task 1 GREEN verify
- **Issue:** `vi.waitFor(fetchSpy)` resolved before `audioEngine.decode` ran, so the decode assertion flaked.
- **Fix:** Wait on `decodeSpy` instead.
- **Files modified:** app/src/stores/projectStore.test.ts
- **Commit:** 4f0a2dff

**4. [Rule 1 - Bug] TAP RED evidence was INVALID_RED from huge assertion diffs**
- **Found during:** Task 2 RED evidence classification
- **Issue:** `expect(source).toContain(...)` dumped whole component sources into TAP YAML (`Malformed TAP` / `Unclosed buffered TAP subtest`).
- **Fix:** Switched component source pins to boolean `includes(...)` assertions so TAP stays parseable.
- **Files modified:** app/src/lib/mainAppAudioSources.test.ts
- **Commit:** b3268723

### Deviations from plan wording

- Plan said "one atomic commit" per task; TDD_MODE + the MVP+TDD gate required a `test(...)` commit before each `feat(...)` commit (4 commits total). Implementation remains one atomic GREEN commit per task.
- `registerPickedAudioSource` / `buildAudioReplacePatch` landed in Task 1's shared module (Task 1 action step 5 created `mainAppAudioSources.ts`); Task 2 wired the component call sites and added their unit gates. No behavior change versus the plan's end state.

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, or trust-boundary schema changes beyond the planned `source_path` field (mitigations T-261009-RKO-01..05 hold: efxasset boundary, never-copy tests, single retired-key throw, decode-door pin, no audioAssets remap).

## Verification

- Task 1: `vitest run src/lib/mceAudioSourcePath.test.ts src/lib/mainAppAudioSources.test.ts src/stores/projectStore.test.ts src/lib/documentSoundGates.test.ts src/stores/audioStore.test.ts src/lib/playbackEngine.test.ts` + `typecheck` — green
- Task 2: `vitest run src/lib/mainAppAudioSources.test.ts src/lib/physicPaintBridge.test.ts` + `typecheck` — green (Studio `requestImageImport('audio')` sourcePath non-regression stayed green)
- Full suite: 4661 passed, 1 failed (pre-existing `PhysicsPaintStudioView.test.ts` paintStore↔projectStore circular dep — not a gate, no NEW failures)

## UAT (pending live judgment)

Status stays **automated-ready** until the user judges:

1. Gallery import leaves no `audio/` folder and the source file untouched at its origin.
2. Sidebar Replace behaves the same with the new file (path verbatim, no package copy).
3. Save/close/reopen keeps playback, waveform peaks, and the gallery row.
4. Studio document sounds and their Relink are unaffected.
5. A moved source file shows existing error behavior on the main-app track while Studio still shows red + Relink.

## Self-Check: PASSED

- FOUND: app/src/lib/mceAudioSourcePath.ts
- FOUND: app/src/lib/mainAppAudioSources.ts
- FOUND: e9540597 (Task 1 RED)
- FOUND: 4f0a2dff (Task 1 GREEN)
- FOUND: b3268723 (Task 2 RED)
- FOUND: aa446e4a (Task 2 GREEN)
