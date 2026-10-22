---
phase: quick-261022-iff
plan: 261022-iff
subsystem: physic-paint / session solo
tags: [solo, compositor, playback, preact-signals, uat-approved]
status: complete
requires:
  - efxPaintHideSolo participatingPaintTracks truth table
  - physicsPaintSoloArm session-only arm signal
provides:
  - session solo target threaded through the flattened cache key, compositor ports, store and program monitor
  - one global Solo on the playback pill, targeting the active track (selection-followed)
  - hide-only resolvePhysicPaintTrackVisibility predicate
  - retired rail-solo playback window and content-start ports
affects:
  - Studio composite preview (program monitor only)
  - flattened frame cache keys
  - track header controls
tech-stack:
  added: []
  patterns:
    - single participation authority (participatingPaintTracks)
    - session-only signal state, never persisted
key-files:
  created: []
  modified:
    - app/src/efx-paint/compositor/efxPaintHideSolo.ts
    - app/src/efx-paint/compositor/efxPaintCompositeCache.ts
    - app/src/efx-paint/compositor/efxPaintCompositor.ts
    - app/src/stores/physicPaintStore.ts
    - app/src/components/physic-paint/view/PhysicsPaintProgramMonitor.tsx
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
    - app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx
    - app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.tsx
    - app/src/components/physic-paint/view/physicsPaintSoloArm.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/hooks/useRotoNavigationCoordinator.ts
    - app/src/components/physic-paint/hooks/useRotoCachedPlayback.ts
    - app/src/components/physic-paint/hooks/useRotoTimelineActions.ts
    - app/src/lib/previewRenderer.ts
    - app/src/stores/efxPaintStore.ts
    - app/src/efx-paint/document/efxPaintDocument.ts
  deleted:
    - app/src/components/physic-paint/roto/physicsPaintRotoSoloWindow.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoSoloWindow.test.ts
decisions:
  - ONE Solo concept: a session-only active-track focus, never a document mutation
  - The persisted document `solo` field stays parseable but is inert (wire compatibility)
  - Playback enumeration and start index are solo-independent (play-from-cursor law only)
metrics:
  duration: 10m41s (ledger base to final task commit)
  completed: 2026-10-22
  tasks: 3
  commits: 3
actuals:
  tokens: 43422
  tasks: 3
  commits: 3
plan_head_before: 74553827ac98c30a6d0c2ac3211b77061ccc2505
plan_head_after: c2ca4a017fabaa2f04c5ea6fee2fc6604f8f51a3
---

# Quick 261022-iff: One Global Solo — Summary

One session-only Solo replaces the two conflicting solo concepts: the playback-pill Focus button now solos the selected (active) Paint track in the Studio composite, and the rail-solo playback window plus the per-track S chip were deleted end-to-end.

## What Was Built

### Task 1 — Session solo target end-to-end (`2fdd2713`)

- `participatingPaintTracks(document, soloTrackId = null)` is the single participation authority: no target → every `visible !== false` track; target → only that track (hide always wins; unknown/hidden target → none). The persisted `track.solo` flag is never read.
- `EfxPaintFlattenedCacheKeyInput.soloTrackId` adds a `solo:<canonical>` term to the flattened cache key only when a target is set; non-target content edits no longer rotate the targeted composite.
- `EfxPaintCompositorPorts.soloTrackId` narrows drawing participation in `compositeFrame`.
- `physicPaintStore.getFlattenedFrame(layerId, frame, includeFond, soloTrackId)` and `getFlattenedFrameExcluding(..., soloTrackId)` thread the target through the participating computation, key input and ports.
- `PhysicsPaintProgramMonitor.tsx` derives `soloTrackId = isSoloArmed() ? activeTrackId : null` and passes it to every flattened call (draw and missing-source effects), so the focus follows the selection live.

### Task 2 — Global Solo labeling + row S chip removal (`a76ded93`)

- Pill button: `aria-label="Solo selected track"`, disabled law `keyUtilitiesDisabledByBusyState || !props.activeTrackId`, sole guard reason `Select a Track to solo.`, armed tooltip `Exit solo.`, disarmed tooltip carries the full instruction. Same slot, Focus icon, nav-button classes, `.active` armed treatment and `disarmPushTool()`.
- Capsule line derives only from the arm + `props.tracks` + `props.activeTrackId`: `Solo - {track.name}.`
- Removed the per-track S chip, every `onToggleSolo` route (strip → header column → row → Studio row bundle) and `setTrackSolo`. The document `solo` field stays declared and parseable with an explicit inert-field comment.
- `resolvePhysicPaintTrackVisibility` is hide-only; stale `solo: true` values neither hide nor show anything.
- Removed the solo-chip CSS and refreshed stale "non-soloed under solo" comments.

### Task 3 — Rail-solo playback window deletion (`c2ca4a01`)

- Deleted `physicsPaintRotoSoloWindow.ts` and its test (1354 deletions), the Studio's `resolveSessionSoloWindow`, `getSoloWindow` and `getSoloContentStart` ports, and the navigation-coordinator solo branch.
- Cached playback keeps the play-from-cursor law verbatim for both the start and loop-wrap anchors.
- Deleted `buildRailSetSoloCopy` and its four cases.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Legacy compositor tests relied on the now-inert document solo flag**
- Found during: Task 1
- Issue: two existing tests armed solo by writing `solo: true` on a track; after the truth-table change that flag is inert, so both failed.
- Fix: rewrote them to pass `soloTrackId: 'track-b'` through the compositor ports (`{ ...ports, soloTrackId }`), leaving the document untouched.
- Files: `app/src/efx-paint/compositor/efxPaintCompositor.test.ts`
- Commit: `2fdd2713`

**2. [Rule 3 - Blocking] Stale `setTrackSolo` mention blocked the Task 2 production gate**
- Found during: Task 2 verify
- Issue: the Task 2 gate requires zero production `setTrackSolo`, but a comment in the Task 3 module still named it.
- Fix: reworded the comment to "persisted row-S document track solo flags (retired 261022-iff)" — comment only, module deleted in Task 3.
- Files: `app/src/components/physic-paint/roto/physicsPaintRotoSoloWindow.ts`
- Commit: `a76ded93`

**3. [Rule 3 - Blocking] Unused `isSoloArmed` import after the window deletion**
- Found during: Task 3 typecheck
- Issue: `PhysicsPaintStudio.tsx` no longer consumes `isSoloArmed` once the solo window derivation is deleted; `noUnusedLocals` raised a new error (17 vs baseline 16).
- Fix: reduced the import to `disarmSolo` (still used by the Escape and selection layers).
- Files: `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- Commit: `c2ca4a01`

**4. [Rule 1 - Bug] Auto-key test used the deleted window comment as an end marker**
- Found during: Task 3 test run
- Issue: the auto-key self-promotion test sliced the `prepareRotoScriptTarget` block up to `// 43.6-06 (D-19)`, a comment deleted with the solo window.
- Fix: retargeted the marker to the surviving `// RARE BLANK-AFTER-PLAY guard` comment.
- Files: `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- Commit: `c2ca4a01`

### Scope Notes

- `app/src/efx-paint/document/efxPaintDocument.ts` was not in the plan's `files_modified` list, but plan step 7 explicitly instructs adding the inert-field comment "where the field is declared"; only a comment was added.
- `app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx` received the stale-comment fix that plan step 10 explicitly names (also outside `files_modified`).
- `app/src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx.test.ts` required no edit: it carried no solo references.

## Verification

- Task 1: 5 suites / 168 tests + program monitor (14) green; typecheck 16 = baseline 16.
- Task 2: 7 suites / 578 tests green; production `onToggleSolo` 0, row solo class 0, production `setTrackSolo` 0; pill strings present; typecheck 16 = baseline.
- Task 3: 5 suites / 519 tests + solo arm (7) green; deleted files absent; remaining production references 0; typecheck 16 = baseline.
- Post-merge sweep: all Task 1 suites re-run green after Tasks 2–3 (168 + 14 tests).

## Known Stubs

None.

## Threat Flags

None. The persistence boundary is unchanged: the parser's exact key set still accepts `solo`, and the session target never reaches export or the main preview (documented in the plan threat register, T-iff-01/T-iff-03).

## Live UAT Rows — PASSED (user-approved 2026-10-22)

The user ran all three live gate rows and approved them on 2026-10-22.

| # | Action | Expected | Observed | Status |
|---|--------|----------|----------|--------|
| 1 | Two tracks, no solo armed | Both tracks' paint visible | User-approved | PASSED |
| 2 | Solo on A, then select B, then disarm | Only A; only B while still armed; both return on disarm | User-approved | PASSED |
| 3 | Hide the soloed track / a non-selected track | Hidden track never appears | User-approved | PASSED |

## Self-Check

- Created/changed artifacts exist on disk; deleted artifacts are absent.
- Commits `2fdd2713`, `a76ded93`, `c2ca4a01` are ancestors of HEAD.
- Live UAT: all three gate rows user-approved on 2026-10-22.
- Working tree clean at SUMMARY time.

## Self-Check: PASSED
