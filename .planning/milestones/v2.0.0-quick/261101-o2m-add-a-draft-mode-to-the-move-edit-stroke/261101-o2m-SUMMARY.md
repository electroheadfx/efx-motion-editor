---
phase: 261101-o2m-add-a-draft-mode-to-the-move-edit-stroke
plan: 01
subsystem: physic-paint / watercolor stroke edition
tags: [preact, signals, watercolor, draft-mode, persistence-gate, tauri-events, tdd]

# Dependency graph
requires:
  - phase: 261028-k03c
    provides: the durable-base recovery contract (`ensureAquarelleDurableBaseRef`) the settle depends on
  - phase: 261028-k03b
    provides: the live lift-preview sink and the cached-base leaf the display-only cache eye hides
  - phase: 261029-lsr
    provides: the ONE script-replay orchestration whose port closures gain the Draft gates
  - phase: 261023-l35
    provides: the never-rejecting script-snapshot controller whose two chokepoints now defer
  - phase: 52.1
    provides: the main→Studio flush request/result channel and the flush pipeline the save/export exit throws through
provides:
  - a session-only Draft mode that suspends the watercolor re-render while every edit still commits and stays undoable
  - ONE single-flight `settleDraftScript` recompute joined by all five exits (dialog close, frame change, play, save, export)
  - a display-only cache eye (`frozenCacheVisible`) over the still-mounted cached-base canvas
  - a Studio window-close REFUSAL while the pixels are dirty (never a sixth recompute)
  - script-snapshot deferral via an optional `shouldDeferSave` port at `markDirty`/`prepareSave`
  - a main-realm Draft gate (`physicPaintDraftMode.ts`) with a 5s heartbeat, a 20s staleness belt and window-closed clearing; autosave gated and resumed on release
affects: [stroke settings dialog, script stroke edition, autosave, save/save-as/export, Studio close, main bootstrap]

# Actuals (#2632) — same estimateTokens scale (chars/4 over the realized diff)
actuals:
  tokens: 34130
  tasks: 3
  commits: 3
  # MEASURED (#3968)
  plan_head_before: a85b9aade0e22fe9b8342df9d1554bdc9cc0a447
  plan_head_after: 3f1ba67f1b85b7d4f98fcbd11deb2a92dccebf0e

tech-stack:
  added: []
  patterns:
    - "Session-only UI preference signals with compare-then-write setters, read by leaves only (dialog strip, cached-base leaf, one lifecycle effect) — never the Studio render body"
    - "ONE single-flight promise seam (`settleDraftScript`) joined by every exit instead of per-exit recomputes; a refused settle is acted on, never ignored"
    - "Fail-closed persistence: a throwing flush step stops the drain, the request reports `unavailable`, and a `!flushed && gate-active` conjunction cancels save/export"
    - "Cross-realm gate with fault containment: event-driven, heartbeated, and cleared by a staleness belt so a dead Studio cannot wedge autosave"
    - "Deferral at the controller chokepoints (`markDirty`/`prepareSave`) so one optional port covers every script-snapshot writer"

key-files:
  created:
    - app/src/lib/physicPaintDraftMode.ts
    - app/src/lib/physicPaintDraftMode.test.ts
  modified:
    - app/src/components/physic-paint/view/scriptStrokeEdition.ts
    - app/src/components/physic-paint/view/scriptStrokeEdition.test.ts
    - app/src/components/physic-paint/view/aquarelleStrokeSelection.ts
    - app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts
    - app/src/components/physic-paint/view/strokeSettingsModel.ts
    - app/src/components/physic-paint/view/strokeSettingsModel.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
    - app/src/components/physic-paint/engine/AquarelleCachedBaseLayer.tsx
    - app/src/components/physic-paint/physicsPaintStudio.css
    - app/src/components/physic-paint/snapshot/studioScriptSnapshotController.ts
    - app/src/components/physic-paint/snapshot/studioScriptSnapshotController.test.ts
    - app/src/lib/autoSave.ts
    - app/src/lib/exportEngine.ts
    - app/src/stores/projectStore.ts
    - app/src/main.tsx

key-decisions:
  - "Draft is a session-only pair of signals (`draftMode` + `draftPixelsDirty`) with a leave guard: `setDraftMode(false)` refuses while dirty, so the settle is the only route to OFF and stale pixels can never present a Live UI."
  - "The settle recompute is single-flight and never mints an undo entry (unlike `handleRebakeScript`, which re-rolls the paint seed); a failed apply leaves BOTH Draft ON and the dirty flag set so the next exit retries."
  - "Every Draft edit records through the existing ledger path and clears the owned refusal, then returns before the Live reset/apply tail — undo/redo gate only their pixel ports."
  - "The cache eye is a CSS `visibility` class on the still-mounted cached-base canvas (never an unmount, never a nulled url): the decode cache stays warm and no capture/save/export path reads it."
  - "The frame-change exit waits for the settle BEFORE the frame-leave capture (the capture persists the OUTGOING frame) and aborts on refusal or on a superseded navigation generation; the two-flag peek keeps the Live path free of any await."
  - "ONE `handleToggleRotoPlayback` wrapper serves both play entry points (bare Space and the view-model control), depending on the stable `toggle` member."
  - "The Studio window close is a REFUSAL (a throwing first flush step), never a sixth recompute — D-04's exactly-five exits stand."
  - "Script-snapshot writes are deferred at the controller's two chokepoints, not dropped: `isDirty()` stays true, so `persistAfterPurge` fails closed, and the settle's `markDirty()` re-arms the write."
  - "The main realm aborts only on `!flushed && isStudioDraftModeActive()` — race-free (a successful settle always reports flushed) and browser-safe (no flush channel means no gate)."
  - "The published gate follows the PIXELS (`draftMode || draftPixelsDirty`), never the switch alone, and heartbeats every 5s; the 20s staleness belt is the only alternative to blocking persistence forever after a dead webview."

# Metrics
duration: 31 min
started: "2026-11-01T17:39:29Z"
completed: "2026-11-01T18:10:27Z"
tasks_completed: 3
files_changed: 19
status: complete
---

# Quick 261101-o2m: Draft mode for the Move/Edit Stroke dialog Summary

**A session-only Draft mode makes watercolor stroke editing fast: every move, transform, appearance, delete and stack edit still commits to the recorded script and undo ledger while the watercolor engine is never reset or re-applied — the committed sheet holds its last pixels — and all five exits (dialog close, frame change, play, save, export) run ONE joined recompute and act on its result, with the Studio window close refused and every persistence channel gated until the pixels are clean again.**

## Performance

- **Duration:** 31 min (resumed after the approved tracer gate)
- **Started:** 2026-11-01T17:39:29Z
- **Completed:** 2026-11-01T18:10:27Z
- **Tasks:** 3
- **Files modified:** 19 (2 created, 17 modified)
- **Commits:** 3 (measured: `git rev-list --count a85b9aade0..HEAD`)

## Accomplishments

- `scriptStrokeEdition` gained the session-only `draftMode` / `draftPixelsDirty` pair with compare-then-write setters and the leave guard, plus the display-only `frozenCacheVisible` eye preference; neither is persisted, undoable or payload-bound.
- The Stroke settings dialog carries the `Draft [switch]      cache [eye]` strip below the header and above the view gate, reachable in both views; the eye is always available and defaults visible.
- Every Draft edit path (drag/move, transform handles, geometry/paint settings, delete, stack step/place) records the edit and marks the pixels dirty, then skips only the reset/apply tail; `runScriptReplay` gates the `resetSheet` and `rebake` ports and the post-replay capture, leaving `restore`/`rollback`/`notify`/`publishOwner` untouched.
- `settleDraftScript` is the ONE single-flight recompute: it invalidates live pixels, belts the durable base, resets the sheet, re-applies the timeline, then clears dirty and flips Draft off IN THAT ORDER, re-arming the deferred script snapshot.
- Frame change settles before the frame-leave capture and aborts on refusal or a superseded navigation; play (bare Space and the control) goes through one settle-then-toggle wrapper; save/export throw from the first flush step so the main realm cancels; the Studio window close refuses while dirty so no capture, push or script write runs.
- `physicPaintDraftMode.ts` mirrors the gate into the main realm: validated payloads only, release only on a true→false transition, a 5s Studio heartbeat, a 20s staleness belt and a window-closed clear. Autosave skips both save sites while active and resumes on release; `saveProject`/`saveProjectAs`/`startExport` abort on `!flushed && gate-active`; the script-snapshot controller defers both chokepoints.
- Task 3 verify: 7 suites / 646 tests pass and `tsc --noEmit` is clean.

## Task Commits

Each task was committed atomically:

1. **Task 1: Draft session signals, the strip switch and the ONE settle seam** — `290bc30cf` (feat) — live tracer UAT approved by the user
2. **Task 2: Every remaining edit commits under Draft; the display-only cache eye** — `608e51aec` (feat)
3. **Task 3: The five exits act on the recompute; close refusal, snapshot deferral and the main-realm gate** — `3f1ba67f1` (feat)

**Plan metadata:** left uncommitted for the orchestrator's docs commit (SUMMARY.md / STATE.md / PLAN.md), per the execution constraints.

## Files Created/Modified

- `app/src/lib/physicPaintDraftMode.ts` — the cross-realm gate: event + heartbeat/staleness constants, payload validation, transition law, window-closed belt, Studio publisher and main-realm installer.
- `app/src/lib/physicPaintDraftMode.test.ts` — 15 transport cases: payload validation, transition law, clear, staleness/re-arm, publish, install/cleanup and the browser no-op.
- `app/src/components/physic-paint/view/scriptStrokeEdition.ts` — `draftMode`/`draftPixelsDirty` with the leave guard, `frozenCacheVisible`, and their compare-then-write setters.
- `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx` — the Draft switch strip and the cache eye button (aria-pressed, drag-safe press).
- `app/src/components/physic-paint/engine/AquarelleCachedBaseLayer.tsx` — subscribes to the eye and swaps a display-only class; the canvas stays mounted.
- `app/src/components/physic-paint/physicsPaintStudio.css` — the `visibility: hidden` hide rule for the cached base.
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — the arm/settle seams, Draft branches in every edit handler, replay-port gates, frame/play/flush exits, close refusal, snapshot deferral wiring and the publisher/heartbeat effect.
- `app/src/components/physic-paint/snapshot/studioScriptSnapshotController.ts` — the optional `shouldDeferSave` port consulted by `markDirty()` and `prepareSave()`.
- `app/src/lib/autoSave.ts` — gate checks in `scheduleSave` and both save bodies; release-handler registration/clearing in `startAutoSave`/`stopAutoSave`.
- `app/src/stores/projectStore.ts` — the refused-recompute abort in `saveProject` and `saveProjectAs`.
- `app/src/lib/exportEngine.ts` — the refused-recompute abort through the existing export error channel.
- `app/src/main.tsx` — the main-realm Draft listener install beside the sibling bridge installs.
- Test files: `scriptStrokeEdition.test.ts`, `aquarelleStrokeSelection.test.ts`, `strokeSettingsModel.test.ts`, `PhysicsPaintStudio.test.ts` (Task 1/2/3 source pins and session laws), `studioScriptSnapshotController.test.ts` (behavioural deferral cases).

## Decisions Made

- Kept the leave guard as the single route out of a dirty Draft: the settle clears dirty then Draft, so no caller can observe Draft OFF over stale pixels.
- Gated only the pixel-side replay ports; the ledger/owner/restore ports stay ungated so Draft never weakens undo/redo bookkeeping.
- The frame-change exit peeks both flags so the Live path adds no await and no microtask, preserving the 2-click key-selection tick.
- The Studio window close was made a refusal rather than an exit so D-04 keeps exactly five recomputes.
- Reused the flush pipeline's throwing-step semantics as the abort mechanism instead of adding a new status channel.
- The gate conjunction (`!flushed && active`) was chosen over checking either alone so browser fallback and racing settles stay correct.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Re-anchored four pre-existing ordering pins after the Draft branches landed above the Live tails**
- **Found during:** Task 2
- **Issue:** The new Draft branch calls `rotoMoveHistory.recordAquarelleScriptEdit(editId)` ABOVE the Live reset/apply block in delete, step, transform and place, so bare `indexOf` found the Draft record and the existing ordering pins (`261022-pim`, `261022-ujp`, `261024-mz5`, `261024-vga`) failed.
- **Fix:** Anchored each Live record lookup from its gate/success site (the same precedent as the 261022-tv1 move-order pin), leaving the assertions' intent (Live record before Live apply) intact.
- **Files modified:** `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- **Committed in:** `608e51aec`

**2. [Rule 3 - Blocking issue] Dropped an unused window-label constant from the new transport**
- **Found during:** Task 3 typecheck
- **Issue:** The plan listed a `'efx-physic-paint'` label constant, but the Studio publishes TO `main` (mirroring `physicPaintFlush.ts`), so the constant was dead code and `tsc --noEmit` failed with TS6133.
- **Fix:** Removed the constant and left a comment documenting that the Studio label is not needed on this direction. Behaviour is unchanged.
- **Files modified:** `app/src/lib/physicPaintDraftMode.ts`
- **Committed in:** `3f1ba67f1`

**3. [Rule 1 - Bug] Anchored the close-block pin on the hook CALL, not the import token**
- **Found during:** Task 3 test writing
- **Issue:** `studio.indexOf('usePhysicsPaintCloseFlush(')` matches the import line first, which would have made the close-block assertions scan the whole file (trivially passing and wrongly failing the “no settle” pin).
- **Fix:** Slice from the indented invocation (`'\n  usePhysicsPaintCloseFlush('`), matching the intent of the existing 52.2-15 suite.
- **Files modified:** `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- **Committed in:** `3f1ba67f1`

## Authentication Gates

None — no auth step was required.

## Known Stubs

None — no placeholder values, unwired data sources or TODO markers were introduced.

## Threat Flags

None beyond the plan's threat model — the new surface (cross-realm Draft gate, close refusal, snapshot deferral, save/export aborts) is covered by T-261101-o2m-01, -06, -09 and -10 and is pinned by the transport and source tests.

## Self-Check: PASSED

- `app/src/lib/physicPaintDraftMode.ts` — FOUND
- `app/src/lib/physicPaintDraftMode.test.ts` — FOUND
- `290bc30cf`, `608e51aec`, `3f1ba67f1` — all ancestors of HEAD
- Task 3 verify: 7 suites / 646 tests pass; `tsc --noEmit` clean
