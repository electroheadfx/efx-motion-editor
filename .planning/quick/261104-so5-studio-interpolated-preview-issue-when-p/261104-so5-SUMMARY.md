---
phase: quick-261104-so5
plan: 261104-so5
subsystem: ui
tags: [preact, signals, timeline, roto, track-row, cell-classification]

requires:
  - phase: 261104-bop
    provides: the v2.0.1 v7 timeline cell matrix (resolveTimelineCellPresentation, data-cell-kind) and the non-active row cells lane
  - phase: 261104-q82
    provides: the Editor-row rail alignment; unrelated to the Studio row fix but the same rails milestone

provides:
  - the non-active row classifies a lifecycle Group frame override on a projection-generated in-between as interp
  - regression pins for the key/interp/cycle/empty matrix plus the group-gap and stale-cached-frame guards

affects: [studio-timeline-rows, roto-cells, rail-parity]

actuals:
  tokens: 3282
  tasks: 2
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Row cell classification reads the render source AND the own-track structural projection once per row — the projection is the active lane's authority, not a replacement for the render source guard."

key-files:
  created:
    - .planning/quick/261104-so5-studio-interpolated-preview-issue-when-p/261104-so5-SUMMARY.md
  modified:
    - app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx
    - app/src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx

key-decisions:
  - "Classify only the exact mismatch — source kind 'real' + no app-frame real-key record + own-track projection cell 'generated' — rather than switching the row wholesale to projection classification, so group gaps and stale cached frames keep their empty treatment."
  - "Read the own-track projection once per row (O(1) memoized structural read), never per cell."

requirements-completed: [QUICK-261104-SO5]

coverage:
  - id: D1
    description: "A lifecycle Group frame override on a projection-generated in-between paints the interp dash on a non-active row instead of an empty cell."
    requirement: QUICK-261104-SO5
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx#paints the interp dash for a lifecycle override on a generated in-between (the reported regression)"
        status: pass
    human_judgment: true
    rationale: "Live native UAT is the user's: the visual parity between the Paint 1-selected row and the Track 1-selected rich lane must be confirmed in the running app."
  - id: D2
    description: "Group-gap frames and stale cached frames with no real-key record stay empty on non-active rows."
    requirement: QUICK-261104-SO5
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx#keeps a group-gap frame empty even though its projection reports generated (guard)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx#keeps a stale cached frame with no record empty (guard)"
        status: pass
    human_judgment: false

duration: 5min
completed: 2026-11-04
plan_head_before: c7c197183aa2f64ba664773de59f2022056227df
plan_head_after: e30dc5967
status: complete
---

# Quick 261104-so5: Studio non-active row loses an interpolated frame

**A non-active Paint row now paints the interp dash for a lifecycle Group frame override that lands on a projection-generated in-between, matching the active lane's classification exactly.**

## Symptom

With **Paint 1 selected**, the **Track 1** row below shows a rail with one missing interpolated frame inside the span. Selecting **Track 1** (which swaps that track into the rich active lane) makes the gap disappear — the same physical frame classifies differently depending on which track is selected.

## Root Cause

At a lifecycle Group frame override the store reports:

- `getRotoPhysicalRenderSource(...)?.kind === 'real'` — the override resolves through `getRotoRealKeyRecord`, which searches both `_rotoRealKeyRecords` and `_rotoGroupOverrideRecords`;
- `getRotoRealKeyRecordByAppFrame(...) === null` — the override is not an app-frame real key;
- the own-track structural projection cell is `'generated'` — the override identity is not part of the structural projection.

The read-only row derived `state = 'cached'` from the 'real' source, found no key record, and passed `isGenerated: false` / `isCachedOnly: false` into `resolveTimelineCellPresentation` — so the v7 cell matrix returned `empty`. The active lane (`buildRotoTimelineStructuralIndex`) classifies the same frame from the structural projection as generated and paints interp. Reproduced with a throwaway probe: group override at frame 7 of a lifecycle loop over source keys A@2 / B@9 yields projection `generated`, render source `real`, row cell `empty`, while frames 3-8 otherwise paint interp.

## Fix

In `app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx`:

- `resolveTrackRowCellState` became `resolveTrackRowCellSignals(layerId, trackId, frame)`, returning `{ state, sourceKind }` — the resolution itself is unchanged, the kind is now carried out (JSDoc records why the override reports 'real').
- The row reads its OWN track projection once per render: `physicPaintStore.getRotoPhysicalProjection(layerId, trackId)?.cells ?? null`.
- After `keyRecord` resolves, the cell loop computes `paintedPhaseOnGeneratedFrame = sourceKind === 'real' && keyRecord === null && projectionCells?.[frame]?.kind === 'generated'` and passes `isGenerated: state === 'generated' || paintedPhaseOnGeneratedFrame`.

The predicate is scoped to the exact mismatch: a group-gap frame has a null render source, a stale cached frame has a null source kind, real keys keep their app-frame record, and repeat cycles are unaffected. No store, resolver, lifecycle classifier, CSS, schema, or gesture code changed. The Background row and the active lane are untouched.

## Pinned Matrix

One fixture: capacity 24, records A@2 / B@9, interpolation `{ enabled: true, mode: 'duplicate' }`, lifecycle loop over phaseOrigin 2 / originalEndExclusive 18, group override `ov1@7`. Store-seam preconditions assert projection cell 7 = `generated`, render source kind = `real`, and no app-frame real-key record. The row's `data-cell-kind` matrix:

| Frames | Cell kind |
|--------|-----------|
| 0-1 | empty |
| 2 | key (A) |
| 3-6 | interp |
| 7 | interp (the reported regression — was empty) |
| 8 | interp |
| 9 | key (B) |
| 10-17 | cycle, `data-cycle` 2 |
| 18-23 | empty |

Guards: a visible-range gap at frame 7 keeps the projection `generated` while the render source is null and the row cell stays `empty`; a runtime cached frame at 5 with no record (interpolation disabled) keeps `data-cell-kind=empty` with the cached fill.

The regression pin was confirmed red before the fix (`frame 7 = empty`), then green after.

## Gates

- `pnpm --prefix app run typecheck` — clean.
- `pnpm --prefix app exec vitest run` — 368 files passed / 2 skipped; 7212 tests passed / 1 skipped / 96 todo.
- Row suite launcher `PhysicsPaintTrackRow.test.tsx.test.ts` — 23 tests passed.

## Commit

- `e30dc5967` — fix(261104-so5): paint a Group painted phase on a generated in-between as interp (row fix + regression pins, one atomic commit).

## UAT Rows — PENDING USER EVIDENCE (not passed)

These are live native rows; the automated gates are green but the fix is **not** claimed done until the user's UAT pass:

1. **PENDING** — With Paint 1 selected, Track 1's rail shows the interp dash at the previously empty override frame.
2. **PENDING** — Selecting Track 1 leaves that frame visually identical (no glyph change on selection swap).
3. **PENDING** — Group-gap / deleted-phase frames still read empty on non-active rows.
4. **PENDING** — Real keys and repeat cycle cells on non-active rows are unchanged.

## Deviations from Plan

None — plan executed exactly as written.

## Next

The user's live UAT pass on the four rows above. Nothing was pushed.

## Self-Check: PASSED

- SUMMARY exists at `.planning/quick/261104-so5-studio-interpolated-preview-issue-when-p/261104-so5-SUMMARY.md`.
- Code commit `e30dc5967` exists and is an ancestor of HEAD; no tracked files were deleted.
- `PhysicsPaintTrackRow.tsx` and `PhysicsPaintTrackRow.test.tsx` modified; no other source file touched.
