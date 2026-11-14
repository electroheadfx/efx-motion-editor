---
phase: 261101-jmm-stroke-settings-sheet-list-first-with-an
plan: 01
subsystem: ui
tags: [preact, signals, watercolor, stroke-settings, multi-select, list-first]

# Dependency graph
requires:
  - phase: 261031-euf
    provides: the "stroke list in the stroke settings sheet" surface and its empty-selection-only law this quick inverts
provides:
  - list-first watercolor Stroke settings sheet (list default and persistent; parameter tabs behind a header icon)
  - settings-request invalidation edge (empty selection invalidates, next non-empty selection lands on the list)
  - list multi-select gestures (plain / Cmd-or-Ctrl / Shift displayed range) on the shared scriptSelectedStrokeIds
  - per-row trash and global trash on the same delete path as Backspace/Delete
  - StrokeSettingsDialogBundle.deleteStrokes (optional) wired to handleAquarelleDeleteStrokes
affects: [stroke settings sheet, aquarelle stroke list, future stroke-list gestures]

# Actuals (#2632) — same estimateTokens scale (chars/4 over the realized diff)
actuals:
  tokens: 14299
  tasks: 3
  commits: 4
  # MEASURED (#3968)
  plan_head_before: d6e4360cb898e037d02d0d3c7f39d64e0acffb70
  plan_head_after: 78cc31091885984f07d60396dee99166428da594

tech-stack:
  added: []
  patterns:
    - "Ref-held @preact/signals view state with a plain non-signal module invalidation marker (the sawEmptySinceDismiss precedent)"
    - "Pure view/range/invalidation laws in strokeSettingsModel.ts, consumed by the dialog"
    - "Sibling row-delete button in a flex wrapper instead of nesting a button inside the selectable row button"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/view/strokeSettingsModel.ts
    - app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx
    - app/src/components/physic-paint/physicsPaintStudio.css
    - app/src/components/physic-paint/view/strokeSettingsModel.test.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts

key-decisions:
  - "The settings entry is explicit and one-shot: the header icon is the only place the request is made, and an empty selection is the only place the staleness marker is set, so close/reopen, leave/re-enter Move/Select and delete-to-empty all land back on the list."
  - "The view is a ref-held signal written only in click handlers; the empty-selection fallback and the invalidation gate are pure render derivations, and the only render-body write is a plain (non-signal) module flag — never useState, never a render-body signal write."
  - "The Shift anchor is a plain useRef holding the DISPLAYED row index, updated by plain and Cmd/Ctrl clicks only, so the range always matches what the list shows."
  - "Row trash is a sibling button inside a flex wrapper, not a nested button; it stops propagation, calls deleteStrokes([id]) and runs no selection setter, so deleting one row never mutates the selection itself."
  - "Both trashes go through the bundle's deleteStrokes -> handleAquarelleDeleteStrokes, so the physical-lock, in-flight, real-cell and frame-scoping guards stay in one place and the dialog never touches the engine."
  - "The header toggle re-asserts an invalidated request through the opposite value before the target: a compare-then-write that skips the write notifies nobody, which made the first click after an invalidation look dead in the real app."

patterns-established:
  - "Two-write re-assert inside one handler to notify a signal whose stored value already equals the requested one; signals batch both writes into one render."
  - "Source-level pin for harness-invisible notification behavior: document why the manual-render harness cannot detect a missing notification."

requirements-completed: [QUICK-261101-JMM]

coverage:
  - id: D1
    description: "The watercolor Stroke settings sheet opens on the list, keeps the list while strokes are selected, and swaps to Geometry/Stack/Paint only via the header icon, which flips to a list icon; the toggle is natively disabled on an empty selection."
    requirement: QUICK-261101-JMM
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/strokeSettingsModel.test.ts#keeps the list while a stroke is selected and round-trips through the toggle"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/strokeSettingsModel.test.ts#natively disables the view toggle on an empty selection"
        status: pass
    human_judgment: false
  - id: D2
    description: "Settings entry is invalidated the moment the selection empties (close/reopen, leave and re-enter Move/Select, delete-to-empty), so the next non-empty selection renders the list until a fresh icon click."
    requirement: QUICK-261101-JMM
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/strokeSettingsModel.test.ts#never restores a settings request after the selection was observed empty"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/strokeSettingsModel.test.ts#re-asserts an invalidated request so the header toggle never dead-clicks"
        status: pass
    human_judgment: false
  - id: D3
    description: "Plain click replaces, Cmd/Ctrl toggles, Shift selects the inclusive displayed range from the last-clicked anchor, all through scriptSelectedStrokeIds."
    requirement: QUICK-261101-JMM
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/strokeSettingsModel.test.ts#plain replaces, Cmd and Ctrl toggle, Shift takes the displayed range"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/strokeSettingsModel.test.ts#resolves the inclusive DISPLAYED range and rejects invalid indices"
        status: pass
    human_judgment: false
  - id: D4
    description: "Per-row trash deletes only its stroke and never sets selection; the global trash deletes the whole selection and is natively disabled below two."
    requirement: QUICK-261101-JMM
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/strokeSettingsModel.test.ts#a row trash deletes only its own stroke and never touches the selection"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/strokeSettingsModel.test.ts#the global trash is disabled below two strokes and deletes the whole selection"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#wires the watercolor bundle callback and the memo dependency"
        status: pass
    human_judgment: false
  - id: D5
    description: "The type filter row, the tool/tip fine filters and the F<n> summary render in list view only; the brush sheet is unchanged."
    requirement: QUICK-261101-JMM
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/strokeSettingsModel.test.ts#renders the type filter, fine filters and summary in the LIST view only"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/strokeSettingsModel.test.ts#leaves the brush sheet unchanged: no toggle, no list, its tabs as today"
        status: pass
    human_judgment: false
  - id: D6
    description: "Live Studio behaviour: hover/selected row trash, canvas outline and group drag following the list selection, delete-to-empty fallback and the close/reopen cycle in the packaged app."
    requirement: QUICK-261101-JMM
    verification: []
    human_judgment: true
    rationale: "The tests render the sheet by hand in jsdom; hover reveal, native chrome, canvas group drag and the real close/reopen cycle only exist in the live Studio, which the user runs."

# Metrics
duration: 16min
completed: 2026-11-01
status: complete
---

# Quick 261101-jmm: List-first stroke settings sheet Summary

**Watercolor Stroke settings sheet is now list-first: the list persists while strokes are selected, a header icon toggles geometry/stack/paint, and per-row/global trash share the Backspace delete path.**

## Performance

- **Duration:** 16 min
- **Started:** 2026-11-01T13:26:00Z
- **Completed:** 2026-11-01T13:41:40Z
- **Tasks:** 3
- **Files modified:** 6
- **Diff:** 837 insertions, 67 deletions

## Accomplishments

- Inverted the 261031-euf law: the stroke list is the default and persistent surface; the Geometry/Stack/Paint row appears only after the header settings icon, which flips to a list icon to return.
- Added the exact settings-entry edge: any observation of an empty selection invalidates the pending request, so close/reopen, leave/re-enter Move/Select and delete-to-empty all land back on the list, and the tabs return only on a fresh icon click.
- Added list multi-select on the shared `scriptSelectedStrokeIds`: plain replaces, Cmd or Ctrl toggles, Shift takes the inclusive range in the displayed order from the plain/Cmd anchor.
- Added a per-row trash (sibling button, hover/focus/selected reveal) and a global trash (disabled below two) that both go through `StrokeSettingsDialogBundle.deleteStrokes` → `handleAquarelleDeleteStrokes`: one undoable edit, one re-bake, all frame and lock guards intact, no selection setter from the trash.
- Kept the type filter, tool/tip fine filters and the `F<n> · N strokes · P paint · E erasers` summary in the list view only, and left the brush sheet byte-for-byte unchanged in behaviour.

## Task Commits

Each task was committed atomically:

1. **Task 1: list-first sheet with an explicit settings mode** - `226c1fccd` (feat)
2. **Task 2: list multi-select and per-row/global trash** - `01d6dbe59` (feat)
3. **Task 3: wire the sheet delete member to the Studio handler** - `20acf97c2` (feat)
4. **Fix: invalidated request re-assert (no dead toggle click)** - `78cc31091` (fix)

_Measured: `git rev-list --count d6e4360c..78cc3109` = 4. The plan documents commit is left to the orchestrator per instructions._

## Files Created/Modified

- `app/src/components/physic-paint/view/strokeSettingsModel.ts` - `StrokeSettingsView`, `resolveStrokeSettingsView`, `shouldInvalidateStrokeSettingsView`, `resolveStrokeListRange`, optional `deleteStrokes` on the bundle.
- `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx` - ref-held view signal, plain invalidation marker, header trash + view toggle, view-gated filters, list/tabs branch, restructured row (selectable button + sibling trash), gesture handler.
- `app/src/components/physic-paint/physicsPaintStudio.css` - row flex wrapper and `is-selected` treatment, invisible-until-hover row trash, 22px header-button chrome.
- `app/src/components/physic-paint/view/strokeSettingsModel.test.ts` - pure law tests, `renderSettings` helper, rewrites of the two superseded 261031-euf list tests, 16 new behavioural cases (128 tests total).
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` - `deleteStrokes: (ids) => handleAquarelleDeleteStrokes(ids)` in the bundle body plus the memo dependency.
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` - scoped source pins for the bundle wiring and the memo dependency.

## Decisions Made

- **Explicit, one-shot settings entry.** Making the list persistent required a second piece of view state; the staleness marker is a plain non-signal module flag (the `sawEmptySinceDismiss` precedent) so the empty-selection observation cannot start a reactive loop, while the requested view itself is a ref-held signal.
- **Shift anchor by displayed index, not id.** The list is ordered and filterable; holding the anchor as a `useRef<number>` index means the inclusive range always matches what the user sees, and `resolveStrokeListRange` rejects out-of-range or non-integer indices instead of silently clamping.
- **Trash never touches selection.** The row trash deletes via the shared Studio handler and lets the existing `clearSelectionIfGone` reduce the selection; running a setter first would fight the delete edit and could resurrect a stale selection.
- **Dead-click remedy pinned at source level.** The test harness re-renders by hand and therefore cannot observe a missing signal notification; the pin documents that limitation and guards the two-write re-assert.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Header toggle dead-clicked after an invalidated request**
- **Found during:** Post-commit self-review of Task 2 (toggle introduced in Task 1)
- **Issue:** The plan prescribed `if (ref.value !== next) ref.value = next;`. When the request is invalidated the signal still holds `'settings'` while the resolved view is `'list'`, so the target `'list'` equals the stored value; no write happens, no subscriber is notified, and in the real app (no manual re-render) the first toggle click after a close/reopen or a delete-to-empty would appear dead.
- **Fix:** write through the opposite value then the target inside the same handler (signals batch both writes into one render); added the `if (view !== next)` guard so the healthy path is untouched.
- **Files modified:** `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx`, `app/src/components/physic-paint/view/strokeSettingsModel.test.ts`
- **Verification:** targeted dialog suite green (128 tests), typecheck clean, source-level pin added.
- **Committed in:** `78cc31091`

**2. [Rule 3 - Blocking] Removed the now-unused `selectionEmpty` const**
- **Found during:** Task 1
- **Issue:** Gating the filters and summary on `view === 'list'` left `selectionEmpty` unused, failing `tsc --noEmit`.
- **Fix:** removed the const and its stale comment; `selection.size === 0` is used directly where still needed.
- **Committed in:** `226c1fccd` (Task 1 commit)

**3. [Rule 1 - Bug] Row trash alignment in the flex wrapper**
- **Found during:** Task 2
- **Issue:** the sibling trash inherited the button row's stretched height, producing an oversized hover target.
- **Fix:** `align-items: stretch` on the item plus `align-self: center` on the trash keeps a 22x22 control centred against the row.
- **Committed in:** `01d6dbe59` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 blocking)
**Impact on plan:** The dead-click fix is a correctness fix for the plan's own prescribed snippet; the other two are local consequences of the planned changes. No scope creep.

## Issues Encountered

- Two superseded 261031-euf tests asserted the inverted law (selection swaps to tabs). They were rewritten as named in the plan's updated-pin check; the Stack-tab, geometry, resize, close, Escape and Paint seed cases stayed untouched and green.
- Filtering does not prune test fixture ids because `setAquarelleStrokeTypeFilter` only removes ids present in the engine's recorded entries; this keeps the eraser-mode Paint-tab tests in settings view, matching the plan's expectation.

## User Setup Required

None - no external service configuration, no dependency change, no schema or persistence change.

## Known Stubs

None.

## Threat Flags

None - no new security-relevant surface beyond the plan's threat model (row text and aria-labels use already-visible metadata; both trashes reach only the existing guarded delete path; the view signal is written only in click handlers).

## Next Phase Readiness

- All automated gates green: targeted dialog suite (128 tests), targeted Studio suite, typecheck, and the full app suite with no regressions.
- Live UAT remains with the user for the 12 planned rows (hover reveal, canvas group drag, real close/reopen cycle); not claimed done before those pass.

---
*Quick: 261101-jmm-stroke-settings-sheet-list-first-with-an*
*Completed: 2026-11-01*

## Self-Check: PASSED

- Files verified: all 6 modified files exist; SUMMARY.md exists at the expected path.
- Commits verified: `226c1fccd`, `01d6dbe59`, `20acf97c2`, `78cc31091` are ancestors of HEAD.
- Gates: targeted dialog suite (128 tests) pass, full app suite 361 files / 6895 tests pass (1 skipped, 96 todo), typecheck clean, desktop chunk 1,583.17 kB under the 2 MB ceiling.
