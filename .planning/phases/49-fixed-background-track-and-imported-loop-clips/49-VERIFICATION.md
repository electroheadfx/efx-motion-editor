---
phase: 49-fixed-background-track-and-imported-loop-clips
verified: 2026-09-01T16:50:00Z
status: passed
score: 5/5 roadmap success criteria; 44/44 plan must-have truths
behavior_unverified: 0
overrides_applied: 0
gaps: []
deferred: []
behavior_unverified_items: []
coincidental_reliance_items: []
human_verification: []
---

# Phase 49: Fixed Background Track and Imported Loop Clips — Verification Report

**Phase Goal:** Add one fixed Background row beneath all internal Paint tracks with imported still/sequence Loop Clips, finite/infinite repeat, gaps, and fallback.
**Verified:** 2026-09-01T16:50:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can import one still image or an ordered image sequence as a Background clip on the single fixed Background track beneath all Paint tracks | ✓ VERIFIED | `PhysicsPaintTrackRow.tsx:874` Import button (`aria-label="Import images"`, 24px hit target) → `BackgroundAssetPickerView` region swap → `PhysicsPaintStudio.tsx:3547` `addBackgroundClip` at playhead with natural-sorted refs, finite-1 repeat. Bg row rendered after all Paint rows (`PhysicsPaintWorkflowStrip.tsx:3947-3965`). Document has exactly one `readonly background: BackgroundTrack` (`efxPaintDocument.ts:104`). Native UAT part 1 approved. |
| 2 | A five-image cycle repeated three times resolves 15 frames while storing only five linked source images; a ten-image cycle repeated twice starting at 15 resolves frames 15-34 ending at exclusive frame 35 | ✓ VERIFIED | `efxPaintBackgroundResolution.test.ts` "spec Required example part 1: 5-image cycle × 3 from frame 0 resolves [0,15), gap at 15" and "part 2: 10-image cycle × 2 from frame 15 resolves [15,35), gap at 35" — both pass (14/14). `efxPaintStore.test.ts:760` "linked sources: a 5-ref clip at x3 keeps exactly 5 refs and maps instance k to refs[k mod 5]". |
| 3 | Finite and infinite loops stop cleanly at the next clip or parent end; a next clip can shorten a loop to a partial cycle without overlap or asset duplication, and moving/removing it recalculates the previous loop deterministically | ✓ VERIFIED | `efxPaintStore.test.ts` "deterministic recalculation: deleting the next clip re-derives the predecessor natural end untruncated (BKG-05)" passes. Resolver `deriveEfxPaintBackgroundResolution` is the single extent authority (WeakMap-memoized, no stored extents). Native UAT part 4 approved (interruption + recalculation). |
| 4 | Gaps reveal the document fallback (solid color or transparency) identically in Studio, flattened parent output, main preview, and export | ✓ VERIFIED | `_resolveDocumentFondInstruction` reads ONLY `document.background.fallback` (`physicPaintStore.ts:1053`); per-track metadata walk deleted. `efxPaintCompositeCache.ts:145` flattened key carries `fallback:${encodeCanonicalBackgroundFallback(...)}`. Checkerboard is monitor-only (no reference in compositor/previewRenderer/exportRenderer). Native UAT part 5 approved (fallback + gaps parity). |
| 5 | Imported clips, source order, IDs, repeats, gaps, fallback, and effective rendering survive save/reopen | ✓ VERIFIED | `efxPaintBackgroundFallback.test.ts` 10 round-trip/rejection tests pass. `hydrateBackgroundSourceImagesFromLibrary` wired into `hydrateRuntimeFromDocument` (`efxPaintStore.ts:1088`); REGISTERS ALL / MISSING IS EXPLICIT / SAVE DEDUP tests pass. Native UAT part 7 approved (save/reopen). |

**Score:** 5/5 roadmap success criteria verified; 44/44 plan must-have truths verified (0 present, behavior-unverified).

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `app/src/efx-paint/document/efxPaintDocument.ts` | Extended BackgroundFallback union (paper mode) | ✓ VERIFIED | `BackgroundFallback` = transparent \| solid \| paper (texture canvas1-3, paperGrain, grainStrength); `PaperTexture` exported |
| `app/src/efx-paint/document/efxPaintDocumentParsers.ts` | Fail-closed exact-member fallback parser | ✓ VERIFIED | Rejects unknown mode (incl. photo), extra/missing members, non-finite/negative grainStrength |
| `app/src/efx-paint/document/efxPaintDocumentRevision.ts` | Canonical fallback encoder | ✓ VERIFIED | `encodeCanonicalBackgroundFallback` exported; used by cache key and revision |
| `app/src/efx-paint/document/efxPaintBackgroundFallback.test.ts` | Round-trip + rejection contract suite | ✓ VERIFIED | 10 tests pass |
| `app/src/efx-paint/utils/naturalFilenameSort.ts` | D-02 natural original-filename sort | ✓ VERIFIED | `Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })`; no asset-id in comparator; input not mutated |
| `app/src/stores/efxPaintStore.ts` | Five Background clip ops + fallback setter | ✓ VERIFIED | `addBackgroundClip`/`moveBackgroundClip`/`setBackgroundClipRepeat`/`deleteBackgroundClip`/`setBackgroundFallback` (+ `setBackgroundClipSource` from UAT) all present, closed results, locked reason union |
| `app/src/stores/physicPaintStore.ts` | Fond authority + hydration + accessors | ✓ VERIFIED | `_resolveDocumentFondInstruction`, `getDocumentFondInstruction`, `getBackgroundFrameVerdict`, `hydrateBackgroundSourceImages(FromLibrary)`, `registerBackgroundSourceImage` |
| `app/src/efx-paint/compositor/efxPaintCompositeCache.ts` | Flattened cache fallback term | ✓ VERIFIED | `fallback:` term via canonical encoder |
| `app/src/components/physic-paint/engine/physicsPaintStudioSettings.ts` | Selector ↔ fallback mapping | ✓ VERIFIED | `backgroundModeToFallback`, `reflectFallbackToBackgroundMode`, `BackgroundSelectorMode = Exclude<BgMode, 'photo'>` |
| `app/src/lib/physicPaintBridge.ts` | Image-library bridge pair | ✓ VERIFIED | `requestImageLibrary` + `installPhysicPaintImageLibraryListener`; listener installed in `main.tsx:120` |
| `app/src-tauri/capabilities/physics-paint.json` | Least-privilege capability delta | ✓ VERIFIED | Exactly `dialog:allow-open`; no `fs:*` |
| `app/src/components/physic-paint/view/BackgroundAssetPickerView.tsx` | S2 scoped full-area picker | ✓ VERIFIED | `role="region"` + `aria-label="Import background images"`, signal-driven (no useState), Confirm/Cancel/Import |
| `app/src/components/physic-paint/hooks/usePhysicsPaintBackgroundClipDrag.ts` | Row-local rail drag hook | ✓ VERIFIED | 4px threshold, release-time commit, row-fixed, click-to-select, Escape cancel |
| `app/src/components/physic-paint/view/PhysicsPaintBackgroundClipSection.tsx` | S5 right-panel clip section | ✓ VERIFIED | Start frame, Repeat + ∞ toggle, source-cycle fact, dialog-free Delete |
| `app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts` | Unified-ledger background entry | ✓ VERIFIED | `recordBackgroundEdit` + `'background'` entry kind; CR-01 live-state authority guard on both undo (line 780) and redo (line 872) |
| `app/src/efx-paint/compositor/efxPaintCompositor.ts` | Missing-source fill | ✓ VERIFIED | `EFX_PAINT_BACKGROUND_MISSING_FILL = '#4b5563'` destination-over for missing BACKGROUND clips only |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| Bg row Import button | `addBackgroundClip` | picker swap → `onConfirm(sortedIds)` → playhead capture at confirm time | ✓ WIRED | `PhysicsPaintStudio.tsx:3536-3551`; `backgroundPlacementFrame.value ?? currentFrame` |
| Drag release | `moveBackgroundClip` | `usePhysicsPaintBackgroundClipDrag` commit port | ✓ WIRED | `PhysicsPaintWorkflowStrip.tsx:2169` locked drag copy on `'start-collision'` |
| Clip rail click | right-panel section | `onSelectBackgroundClip` → `selectedBackgroundClipId` signal | ✓ WIRED | `PhysicsPaintStudio.tsx:3390-3394` |
| Hydrate path | `registerBackgroundSourceImage` | `hydrateBackgroundSourceImagesFromLibrary` → efxasset:// decode | ✓ WIRED | `efxPaintStore.ts:1088` fire-and-forget at end of `hydrateRuntimeFromDocument` |
| Fallback selector | fond instruction + cache term | `setBackgroundFallback` → `_resolveDocumentFondInstruction` + `fallback:` cache term | ✓ WIRED | `PhysicsPaintStudio.tsx:1068`; `efxPaintCompositeCache.ts:145` |
| Bg delete | unified ledger | `recordBackgroundEdit` from shortcut + sidebar trash | ✓ WIRED | `useRotoPhysicalEditHistory.ts:688`; `PhysicsPaintStudio.tsx:2557,2921` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| Bg clip rail | clip facts | `deriveEfxPaintBackgroundResolution` (resolver) | Yes — resolver facts only, no strip math | ✓ FLOWING |
| Source-cycle tooltip | original filenames | `sourceFrameRefs` → `sortImagesByOriginalFilename` order | Yes — natural order, never UUIDs | ✓ FLOWING |
| Fond instruction | `document.background.fallback` | `_resolveDocumentFondInstruction` | Yes — single authority, metadata walk deleted | ✓ FLOWING |
| Missing-source fill | `EFX_PAINT_BACKGROUND_MISSING_FILL` | compositor destination-over | Yes — deterministic constant shared by all surfaces | ✓ FLOWING |
| Picker grid | `MceImageRef[]` | main-webview imageStore via bridge pair | Yes — `imageStore.toMceImages(projectDir ?? tempProjectDir)` | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Fallback round-trip + rejection (10 tests) | `vitest run src/efx-paint/document/efxPaintBackgroundFallback.test.ts` | 10 passed | ✓ PASS |
| Natural sort (4 tests) | `vitest run src/efx-paint/utils/naturalFilenameSort.test.ts` | 4 passed | ✓ PASS |
| Drag hook contract (14 tests) | `vitest run src/components/physic-paint/hooks/usePhysicsPaintBackgroundClipDrag.test.ts` | 14 passed | ✓ PASS |
| Clip section contract (13 tests) | `vitest run src/components/physic-paint/view/PhysicsPaintBackgroundClipSection.test.ts` | 13 passed | ✓ PASS |
| Picker contract (14 tests) | `vitest run src/components/physic-paint/view/BackgroundAssetPickerView.test.ts` | 14 passed | ✓ PASS |
| Store ops + collision + undo (42 tests) | `vitest run src/stores/efxPaintStore.test.ts` | 42 passed | ✓ PASS |
| Hydration + fond (74 tests) | `vitest run src/stores/physicPaintStore.test.ts` | 74 passed | ✓ PASS |
| Resolver spec examples (14 tests) | `vitest run src/efx-paint/compositor/efxPaintBackgroundResolution.test.ts` | 14 passed (incl. 5×3 and 10×2-from-15) | ✓ PASS |
| Studio wiring (103 tests) | `vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts` | 103 passed | ✓ PASS |
| Keyboard + history + header (174 tests) | `vitest run .../physicsPaintStudioKeyboard.test.ts .../useRotoPhysicalEditHistory.test.ts .../physicsPaintTrackHeaderColumn.test.ts` | 174 passed | ✓ PASS |
| Typecheck | `pnpm run typecheck` | exit 0, clean | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| BKG-01 | 49-04, 49-05 | Exactly one fixed Background track beneath all Paint tracks, contributing to flattened output | ✓ SATISFIED | Single `background` record; Bg row after all Paint rows; compositor draws background beneath composite |
| BKG-02 | 49-02, 49-04, 49-05 | Import one still or ordered sequence as a Background clip | ✓ SATISFIED | Picker + natural-sorted Confirm → `addBackgroundClip` at playhead |
| BKG-03 | 49-02, 49-05 | Sequential non-overlapping clips; move/insert reject collisions | ✓ SATISFIED | Collision truth table tests; locked rejection copy; symmetric import/drag verdict |
| BKG-04 | 49-02, 49-06 | Start frame + finite repeat (1..∞) or infinity per clip | ✓ SATISFIED | Repeat contract tests; S5 repeat control with validation |
| BKG-05 | 49-02, 49-05, 49-06 | Loop resolution cycleLength × repeatCount, bounded by next clip/parent end | ✓ SATISFIED | Resolver spec examples; deterministic recalculation tests; interruption truth surfaced |
| BKG-06 | 49-01, 49-03 | Gaps reveal the document fallback | ✓ SATISFIED | Fond authority tests; cache term; checkerboard; native UAT part 5 |
| BKG-07 | 49-02, 49-06 | Source-frame refs linked across all repetitions; no durable duplication | ✓ SATISFIED | `refs[k mod cycleLength]` test; source-cycle fact tooltip |
| BKG-08 | 49-02, 49-06 | Undo/redo clip ops by reference | ✓ SATISFIED | Store-level record→undo→redo for all seven op kinds; UI-level delete-only per explicit user scope (documented in 49-06-SUMMARY) |
| BKG-09 | 49-01, 49-02, 49-03 | Clips, source order, IDs, repeats, gaps, fallback survive save/reopen | ✓ SATISFIED | Round-trip tests; hydration tests; save dedup; native UAT part 7 |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `app/src/efx-paint/document/efxPaintDocumentParsers.ts` | 132 | WR-01: parser accepts finite repeat count 0 (`isNonNegativeInteger`) — inconsistent with store (≥1) and resolver (≥1); a crafted count-0 document parses then throws at resolution | ⚠️ Warning | User-accepted as non-blocking (review WR-01). Store boundary rejects count 0; resolver throws fail-closed. |
| `app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts` | 172 | WR-02: Bg-clip delete branch runs before roto delete when a Bg clip is selected; selection is not mutually exclusive | ⚠️ Warning | User-accepted as non-blocking (review WR-02). Edge case: roto key + Bg clip both selected → Delete targets Bg clip. |

No TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER markers in phase-modified files. No stub implementations. No `useState` in new Studio code (signal-driven per efx-preact-reactivity). CR-01 (Bg undo/redo clobbering unrecorded edits) is FIXED — live-state authority guard present on both undo (`useRotoPhysicalEditHistory.ts:780`) and redo (`:872`) paths, fail-closed on divergence.

### Human Verification Required

None outstanding. The phase-closing native UAT was approved by the user: parts 1, 2, 3, 4, 5, 7 approved; part 6 scoped to delete-only undo (explicit user decision); part 8 changed to a color background per user request; three interaction deltas (timeline delete shortcut, sidebar Bg-row selection, missing-source fill) implemented and natively confirmed. This also discharged the Background-row native UAT deferred from Phase 48.

### Gaps Summary

No gaps. All 5 roadmap success criteria and all 44 plan must-have truths are verified against the codebase with passing behavioral tests and approved native UAT. The two review warnings (WR-01 parser repeat-count-0, WR-02 Bg delete shortcut ambiguity) are documented, user-accepted as non-blocking, and do not prevent goal achievement.

---

_Verified: 2026-09-01T16:50:00Z_
_Verifier: Claude (gsd-verifier)_
