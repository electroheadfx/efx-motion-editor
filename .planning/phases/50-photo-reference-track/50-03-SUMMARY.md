---
phase: 50-photo-reference-track
plan: 03
subsystem: ui
tags: [typescript, preact, vitest, ui, photo-reference, asset-picker, natural-sort, region-swap]

# Dependency graph
requires:
  - phase: 50-photo-reference-track
    plan: 02
    provides: setPhotoReferenceSource + setPhotoReferenceVisible + hydrateReferenceSourceImagesFromLibrary + PhotoReferenceTrack type
  - phase: 49-fixed-background-track-and-imported-loop-clips
    provides: BackgroundAssetPickerView region swap + useBackgroundAssetPickerController + sortImagesByOriginalFilename
provides:
  - Fixed Photo row (header + passive band + empty lane) mounted directly above the Bg row in the pinned fixed-row block
  - Reference picker swap reusing BackgroundAssetPickerView with title "Import reference images" and replace-on-confirm semantics
  - Confirm flow: natural filename sort → setPhotoReferenceSource → source-byte hydration → "Reference source replaced." capsule note
affects: [50-04, 50-05]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
# Same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 13654
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Photo row is a fixed non-selectable row (kind 'photo-reference') — a plain header cell (no role=button/tabIndex) plus a passive muted band lane, never a content track (D-06)"
    - "Reference picker is a SECOND useBackgroundAssetPickerController instance sharing the same ports object (requestLibrary/importFiles/openDialog/sortImages) with a reference-specific refreshLibrary closure and a replace-on-confirm handler"
    - "BackgroundAssetPickerView gained a configurable title prop (default 'Import background images') so the same region swap serves both the Bg and reference pickers (D-01)"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
    - app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/view/BackgroundAssetPickerView.tsx
    - app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx
    - app/src/components/physic-paint/physicsPaintStudio.css

key-decisions:
  - "The reference picker is a second useBackgroundAssetPickerController instance (not a new controller) — the state machine is identical; only the Confirm handler (replace vs add-clip) and the title differ. The shared ports object (requestLibrary/importFiles/openDialog/sortImages) is extracted so both instances reuse the same image-library bridge and natural-sort authority."
  - "Confirm REPLACES the source via setPhotoReferenceSource(layerId, sortedIds) — the picker's buildConfirmedImageIds already natural-sorts by original filename (D-02), so the handler receives already-ordered ids and never re-sorts. The store call bumps the source revision (REF-04) and records one undo entry."
  - "The replacement capsule note uses publishOperationResult('Reference source replaced.') (the operationResult signal), not setApplyMessage — the statusMessage line is reserved for applyStatus !== 'success' errors, while operationResult is the persisted operation-result capsule line."
  - "The confirmed reference source bytes hydrate through hydrateReferenceSourceImagesFromLibrary (mirroring the Bg picker's hydration) so the ghost draw (Plan 50-04) resolves them — the reopened path is the sole production writer of the reference registry."
  - "BackgroundAssetPickerView gained a title?: string prop (default 'Import background images') so the same region swap serves both pickers without a second view component (D-01)."

patterns-established:
  - "Photo row mount order: Paint rows (scroll) → Photo row → Bg row (pinned fixed-row block). The Photo row is always present (even with a null source) and renders with data-track-id 'photo-reference-row' when no source exists."
  - "Reference picker swap: onImportReference → referencePicker.openPicker(); onToggleReferenceVisible → setPhotoReferenceVisible(layerId, visible)."

requirements-completed: [REF-01, REF-04]

# Coverage metadata (#1602) — one entry per shipped deliverable.
coverage:
  - id: D1
    description: "Fixed Photo row (S1): camera glyph, Photo label, lock indicator, eye toggle driving visibleInStudio (D-11), and Import/Replace control (D-03) — a non-selectable header plus a passive muted band lane when a source exists and an empty lane when none (REF-01)"
    requirement: "REF-01"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx#renders the Photo header with camera glyph, Photo label, lock, eye toggle, and Import/Replace control (S1)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx#is not selectable as a track — no role=button, no tabIndex (D-06)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx#renders the passive band when a source exists and an empty lane when none (D-15)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx#the eye toggle drives visibleInStudio — aria-pressed reflects it (D-11)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx#the CTA reads Import images when no source and Replace source when a source exists (D-03)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.test.ts#renders every Paint track as a row plus the fixed Photo row and exactly one locked Bg row at the bottom (TML-01/07)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Reference picker swap (S2): the Import/Replace control opens the reused BackgroundAssetPickerView region swap with title 'Import reference images'; Confirm replaces the source ordered by natural filename sort (D-02) via setPhotoReferenceSource (D-03), hydrates the source bytes (REF-04), and announces 'Reference source replaced.'; Cancel returns untouched (REF-01, REF-04)"
    requirement: "REF-04"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#reuses the BackgroundAssetPickerView region swap for the reference picker (D-01)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#threads the Photo row intents from the workflow block to the store and the reference picker"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#Confirm calls setPhotoReferenceSource exactly once and announces the replacement capsule note (D-03)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#hydrates the confirmed reference source bytes through the library path (REF-04)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#Cancel returns to the Studio untouched — zero store interaction"
        status: pass
    human_judgment: false

# Metrics
duration: 12min
completed: 2026-09-01
status: complete
---

# Phase 50 Plan 03: Photo Row + Reference Picker Swap Summary

**Fixed Photo row (camera glyph, eye toggle, Import/Replace) mounted above the Bg row, plus a reference picker reusing the Phase 49 asset-picker region swap with natural-filename-sort replace semantics**

## Performance

- **Duration:** 12 min
- **Started:** 2026-09-01T19:04:36Z
- **Completed:** 2026-09-01T19:16:57Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- Added the fixed Photo row to the Studio timeline: a non-selectable header (camera glyph, `Photo` label, lock indicator with `Reference layer — fixed position` tooltip, eye toggle driving `visibleInStudio`, and an Import/Replace control) plus a passive muted reference band lane when a source exists and an empty lane when none.
- Mounted the Photo row directly above the Bg row in the pinned fixed-row block (Paint rows scroll above; Photo then Bg pinned below), with the header column and rows region both carrying the row.
- Wired the reference picker as a second `useBackgroundAssetPickerController` instance reusing the `BackgroundAssetPickerView` region swap (D-01) with title `Import reference images`; Confirm replaces the source via `setPhotoReferenceSource` (natural-sorted by original filename, D-02/D-03), hydrates the source bytes (REF-04), and announces `Reference source replaced.`; Cancel returns untouched.
- Added a configurable `title` prop to `BackgroundAssetPickerView` so the same region swap serves both the Bg and reference pickers.
- Full suite green: 3247 passed, 1 skipped, 101 todo across 174 test files; `pnpm --dir app run typecheck` clean.

## Task Commits

Each task was committed atomically:

1. **Task 1: Photo row (S1) — header, passive band, eye toggle, and Import/Replace control** - `3f68f054` (feat)
2. **Task 2: reference picker swap (S2) — reuse BackgroundAssetPickerView, natural sort, replace source** - `6c697610` (feat)

**Plan metadata:** pending (docs: complete plan)

## Files Created/Modified
- `app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx` - Extended `PhysicsPaintTrackRowKind` with `'photo-reference'`; added the Photo header branch (camera glyph, lock, eye toggle, Import/Replace) and the passive band lane
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` - Mounted the Photo row above the Bg row in the pinned fixed-row block; threaded `photoReference`/`onToggleReferenceVisible`/`onImportReference` props
- `app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.tsx` - Added the Photo row header to the pinned header column (above the Bg row)
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` - Extracted `sharedPickerPorts`, added the `referencePicker` controller + Confirm/Cancel handlers, wired the workflow block and the `referencePicker` view-model block
- `app/src/components/physic-paint/view/BackgroundAssetPickerView.tsx` - Added a configurable `title` prop (default `Import background images`)
- `app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx` - Added the `referencePicker` prop and rendered it as a second region-swap overlay
- `app/src/components/physic-paint/physicsPaintStudio.css` - Added Photo row header/row/glyph/band styles (muted desaturated tone, cursor default)
- `app/src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx` - 7-test Photo row contract suite
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` - 7-test reference picker contract suite
- `app/src/components/physic-paint/view/BackgroundAssetPickerView.test.ts` - Updated the title-prop assertion
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.viewport.test.ts` - Updated row/header count + height assertions for the Photo row
- `app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.test.ts` - Updated header-cell count + order assertions for the Photo row

## Decisions Made
- **Second controller instance, not a new controller:** the reference picker reuses `useBackgroundAssetPickerController` with a shared ports object; only the Confirm handler (replace vs add-clip) and the title differ.
- **Natural sort happens in the picker, not the handler:** `buildConfirmedImageIds` already sorts by original filename (D-02), so `handleConfirmReferencePicker` receives already-ordered ids and never re-sorts.
- **Capsule note via `publishOperationResult`:** the replacement note uses the `operationResult` signal (the persisted operation-result capsule line), not `setApplyMessage` (reserved for `applyStatus !== 'success'` errors).
- **Source-byte hydration mirrors the Bg picker:** `hydrateReferenceSourceImagesFromLibrary` warms the reference registry so the ghost draw (Plan 50-04) resolves the freshly imported refs.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added a `title` prop to `BackgroundAssetPickerView` (file not in the plan's `files_modified` list)**
- **Found during:** Task 2 (reference picker swap)
- **Issue:** The plan requires the reference picker to read `Import reference images`, but `BackgroundAssetPickerView` hardcoded `Import background images` in both its `aria-label` and title span. Reusing the region swap for a second picker required a configurable title.
- **Fix:** Added `title?: string` (default `Import background images`) and used it for both the `aria-label` and the title span; the reference picker passes `title: 'Import reference images'`.
- **Files modified:** `app/src/components/physic-paint/view/BackgroundAssetPickerView.tsx`, `app/src/components/physic-paint/view/BackgroundAssetPickerView.test.ts`, `app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx`
- **Verification:** `BackgroundAssetPickerView.test.ts` (14 tests) and `PhysicsPaintStudio.test.ts` (110 tests) green.
- **Committed in:** `6c697610` (Task 2 commit)

**2. [Rule 1 - Bug] Updated pre-existing row/header count assertions broken by the Photo row addition**
- **Found during:** Task 2 (full-suite verification)
- **Issue:** The Photo row (Task 1) added a fourth row to the header column and rows region, but the pre-existing `physicsPaintTrackHeaderColumn.test.ts` and `PhysicsPaintWorkflowStrip.viewport.test.ts` suites still asserted the old 3-row/2-row counts and the 214px strip height. These were not caught after Task 1 because only the targeted test file was run.
- **Fix:** Updated the header-cell count (3→4), row count (3→4), rows-region count (2→3), strip height (214px→244px), and document-order assertions to include the `photo-reference-row`; added Photo header assertions (non-selectable, `Photo` label, camera glyph).
- **Files modified:** `app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.test.ts`, `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.viewport.test.ts`
- **Verification:** Full suite green (3247 passed).
- **Committed in:** `6c697610` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both auto-fixes necessary for correctness — the title prop is required to reuse the region swap for a second picker, and the count assertions had to reflect the new Photo row. No scope creep.

## Issues Encountered
- None beyond the deviations above. The `sharedPickerPorts` extraction required explicit type annotations (`paths: string[]`, `projectDir: string`, `images: readonly MceImageRef[]`) because the spread into `useBackgroundAssetPickerController` does not flow contextual typing through the shared object literal; two pre-existing contract-test assertions were updated to match the annotated signatures.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plan 50-04 (ghost draw) can consume `getReferenceSourceFrameVerdict(layerId, frame)` and the hydrated reference registry — the Confirm handler already warms the registry via `hydrateReferenceSourceImagesFromLibrary`.
- Plan 50-05 (right panel) can consume the four display-preference setters (`setPhotoReferenceVisible`/`Opacity`/`Transform`/`TransformLocked`) — the eye toggle already routes through `setPhotoReferenceVisible`.

## Self-Check: PASSED

- All 12 modified files exist on disk.
- Both task commits (`3f68f054`, `6c697610`) present in git history.

---
*Phase: 50-photo-reference-track*
*Completed: 2026-09-01*
