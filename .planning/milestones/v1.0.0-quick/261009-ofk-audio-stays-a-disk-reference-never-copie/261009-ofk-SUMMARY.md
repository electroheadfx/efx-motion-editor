---
phase: quick-261009-ofk
plan: 261009-ofk
subsystem: efx-paint-document
tags: [audio, disk-reference, sourcePath, clean-break, never-copy, relink, missing-detection]

# Dependency graph
requires:
  - phase: 52.5
    provides: DocumentSoundClip multi-clip model, audio import/replace doors, gallery picker
provides:
  - DocumentSoundClip.sourcePath (absolute on-disk path) — clean-break format
  - Never-copy importAudio (no mkdir/copyFile into package)
  - Disk-based isSoundMissing (sourcePath resolution, not package membership)
  - Red Relink row through the existing replace door
  - documentSoundMissing.ts pure helpers
affects: [efx-paint-persistence, physic-paint-studio, document-sound, export-engine, playback-engine]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 21130
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Clean-break document format: rename field + update all three key-set enforcement points in one commit"
    - "Disk-reference law: heavy media never enter the package; sourcePath is absolute, efxasset is the read boundary"
    - "Relink rides the existing replace door (select-then-raise onImportRequest('replace'))"

key-files:
  created:
    - app/src/lib/documentSoundMissing.ts
    - app/src/lib/documentSoundMissing.test.ts
  modified:
    - app/src/efx-paint/document/efxPaintDocument.ts
    - app/src/efx-paint/document/efxPaintDocumentParsers.ts
    - app/src/efx-paint/document/efxPaintDocumentRevision.ts
    - app/src/stores/efxPaintStore.ts
    - app/src/stores/projectStore.ts
    - app/src/types/physicPaint.ts
    - app/src/lib/efxPaintPersistence.ts
    - app/src/lib/documentSoundPeaks.ts
    - app/src/lib/documentSoundGates.ts
    - app/src/lib/exportEngine.ts
    - app/src/lib/playbackEngine.ts
    - app/src/lib/physicPaintBridge.ts
    - app/src/components/physic-paint/view/physicsPaintAudioController.ts
    - app/src/components/physic-paint/view/PhysicsPaintAudioListSection.tsx
    - app/src/components/physic-paint/view/PhysicsPaintAudioModalView.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/physicsPaintStudio.css

key-decisions:
  - "sourcePath is the absolute on-disk path carried verbatim — no package-relative gate applies to this field"
  - "isSafeAudioRelativePath retired entirely; isSafePackageRelativePath stays for frames/cache"
  - "importAudio never copies — registers the picker's absolute path, dedupes by path"
  - "Missing = file at sourcePath does not resolve on disk (efxasset fetch probe)"
  - "Relink selects the row then raises onImportRequest('replace') — same door as Replace, different label"

patterns-established:
  - "Disk-reference law: heavy media stay outside the package; portability = moving files alongside the project"

requirements-completed: [QUICK-261009-OFK]

# Metrics
duration: 21min
completed: 2026-10-09
status: complete
---

# Quick 261009-ofk: Audio Stays a Disk Reference Summary

**Document sounds are true disk references: sourcePath (absolute on-disk path) replaces the package-relative relativePath, audio bytes never enter the .mce, and missing rows render red with a Relink button through the existing replace door.**

## Performance

- **Duration:** 21 min
- **Tasks:** 2/2 completed
- **Commits:** 2

## Accomplishments

### Task 1: sourcePath persistence law — clean-break format, never-copy import, disk-path resolution (80f19a1f)

- Renamed `DocumentSoundClip.relativePath` to `sourcePath` (absolute on-disk path) across the type, parser (SOUND_KEYS + parseDocumentSound), canonical encoder, and store validators (`_sameSound`, `_isValidSoundClip`) — all three key-set enforcement points move together.
- Clean break: a clip record carrying the retired `relativePath` key throws `DocumentSoundClip: unknown members` (fail-closed, no shim, no migration).
- Deleted the mkdir+copyFile block in `importAudio` — the chosen file stays where it lives. `getAudioAssets` lists every registered audio asset as a disk reference (no projectDir/audio/ prefix filter).
- Retired `isSafeAudioRelativePath` and both per-clip package-relative gate loops in `efxPaintPersistence.ts`. `isSafePackageRelativePath` stays for frames/cache.
- Every consumer resolves through bare `sourcePath`: `buildPhysicPaintDocumentAudioSection` (assetUrl), `documentSoundPeaks` (fetch via assetUrl, projectRoot param dropped), `exportEngine` (filePath), `playbackEngine` (filePath), `projectStore` reopen registration (authoritative path swap).
- New tests: parser round-trip (sourcePath byte-identical), retired-member-throws, encoder-rotation, never-copy import (no mkdir/copyFile), package-content scan (no audio/ directory, no audio bytes).

### Task 2: disk-based missing detection + red Relink row through the replace door (1a7e790b)

- New `documentSoundMissing.ts`: `isSoundSourceMissing` (null = not probed = present) and `collectMissingSoundSourcePaths` (deduped probe, failures count as missing).
- Studio resolver: `missingAudioSourcePaths` signal replaces `knownAudioPaths`; disk probe via `fetch(assetUrl(sourcePath))` with body cancel; refreshed on mount, after import, after replace.
- List row: `physics-paint-audio-clip-row-missing` class + `physics-paint-audio-filename-missing` red + `Relink` button (label, aria-label, title all set to `AUDIO_RELINK_CTA = 'Relink'`).
- Relink onClick: `controller.disarmRemove(); controller.selectedSoundId.value = clip.id; ports.onImportRequest('replace')` — selection BEFORE the door raise.
- Modal keeps `Replace…` (AUDIO_REPLACE_CTA) and `AUDIO_ERROR_MISSING` byte-identical — same door, different label.
- CSS: subtle red border/tint on missing rows, `#ff8585` filename red (existing inline-error precedent), compact relink button matching trash hit target.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Worktree fork-base hatch fill (gsd-core#5209)**
- **Found during:** Startup assertion
- **Issue:** `EXPECTED_BASE_ALTERNATE` was empty (hatch mis-fill); HEAD was the plan commit's parent, not the plan commit itself
- **Fix:** Filled `EXPECTED_BASE_ALTERNATE=plan parent` per standing guidance — HEAD matched exactly; plan materialized from shared object store
- **Files modified:** None (check-parameter only, no git state change)

**2. [Rule 3 - Blocking] Worktree missing node_modules + unbuilt workspace package**
- **Found during:** Task 1 typecheck
- **Issue:** `pnpm install` did not populate `app/node_modules`; `@efxlab/efx-physic-paint` dist was absent (gitignored)
- **Fix:** `pnpm install --force` + `pnpm --filter @efxlab/efx-physic-paint run build`
- **Files modified:** None (environment setup)

**3. [Rule 1 - Bug] AudioTrack fixtures over-renamed during mechanical fixture pass**
- **Found during:** Task 1 typecheck
- **Issue:** Main-app `AudioTrack` fixtures (`makeMainAudioTrack`, `makeAudioTrack`) were renamed to `sourcePath` — `AudioTrack.relativePath` keeps its name and meaning
- **Fix:** Reverted those two fixtures to `relativePath`; left `DocumentSoundClip` fixtures on `sourcePath`
- **Files modified:** `playbackEngine.test.ts`, `physicPaintBridge.test.ts`
- **Commit:** 80f19a1f

### Deferred Issues

**1. Pre-existing test failure: `PhysicsPaintStudioView.test.ts`**
- `_setPaintMarkDirtyCallback is not a function` — circular dependency between `paintStore.ts` and `projectStore.ts`
- Unrelated to audio/sourcePath changes; out of scope per plan rules

## Known Stubs

None — both tasks are fully wired. The `isSoundMissing` port default is `() => false` (present) which is intentional: the Studio wires the real disk resolver; the default is the correct no-false-missing behavior.

## Threat Flags

None — all mitigations in the plan's threat model were applied:
- T-261009-OFK-01: efxasset read boundary (allowed_roots + media-extension allowlist) gates all sourcePath reads
- T-261009-OFK-02: copy site deleted; package-content scan asserts zero audio/ bytes
- T-261009-OFK-03: parser/encoder/store validators move in one commit; round-trip + retired-member + encoder-rotation tests pin the key set
- T-261009-OFK-04: Relink writes selectedSoundId before raising onImportRequest('replace')
- T-261009-OFK-05: probe cancels response body; probes deduped and run only on mount/import/replace

## Self-Check: PASSED

- FOUND: app/src/lib/documentSoundMissing.ts
- FOUND: app/src/lib/documentSoundMissing.test.ts
- FOUND: 80f19a1f (Task 1 commit)
- FOUND: 1a7e790b (Task 2 commit)
