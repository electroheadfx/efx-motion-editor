---
phase: 261031-euf-task-stroke-list-in-the-stroke-settings-
verified: 2026-10-31T10:07:43Z
status: human_needed
score: 7/7 must-haves verified
covered_files:
  - .planning/quick/261031-euf-task-stroke-list-in-the-stroke-settings-/261031-euf-PLAN.md
  - .planning/quick/261031-euf-task-stroke-list-in-the-stroke-settings-/261031-euf-SUMMARY.md
  - app/src/components/physic-paint/physicsPaintStudio.css
  - app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx
  - app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts
  - app/src/components/physic-paint/view/aquarelleStrokeSelection.ts
  - app/src/components/physic-paint/view/scriptStrokeEdition.ts
  - app/src/components/physic-paint/view/strokeSettingsModel.test.ts
  - app/src/components/physic-paint/view/strokeSettingsModel.ts
covered_digest: "v3:sha256:15d17358fe81c73a555008c9be6c45dca09153d7af467e38dc657a09e707d599"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Enter Move/Edit (watercolor Select) with NO selection"
    expected: "The sheet keeps the sentence-case Paint / Eraser / All toggles, shows the tool dropdown (and tip dropdown when >1 tip) beneath them, then the scrollable stroke list with the summary line; the Geometry/Stack/Paint tab row and the old 'Select a stroke to edit.' caption are gone."
    why_human: "DOM structure is asserted in the harness, but the rendered appearance (sentence case in the real WKWebView, dropdown/row layout) is only visible on screen."
  - test: "Click Paint, then Eraser, then All"
    expected: "The list and the canvas selection outline stay consistent: Paint hides lifts, Eraser shows only lifts, All shows every frame stroke; the summary counts stay unchanged."
    why_human: "The list/overlay consistency is wired through one signal and asserted per side, but the paired on-screen behavior needs a live pass."
  - test: "Use the tool dropdown and the tip dropdown"
    expected: "Tool options list only the tools present under the current type filter (All tools + Brush/Water/Pen/Eraser as applicable); the tip dropdown appears only with more than one tip; selecting a tool that orphans the current tip resets the tip to All tips; no offered combination yields an empty list."
    why_human: "Native select interaction (value binding, option switching) is not exercised by the prop-level harness."
  - test: "Click a row, then clear the selection"
    expected: "The clicked stroke is outlined on the canvas and the Geometry/Stack/Paint tabs return in place of the list; clearing the selection (canvas click / Escape path) brings the list back."
    why_human: "Canvas outline visibility is a screen observation; the harness proves the selection set and the tab/list swap only."
  - test: "Open a frame with zero strokes, then filter a paints-only frame to Eraser"
    expected: "'No strokes on this frame.' for the empty frame; 'No strokes match this filter.' when the filters yield none; the summary reads F<frame> · N strokes · P paint · E erasers."
    why_human: "Message text is asserted in props, but the visible placement/readability needs a live pass."
  - test: "Scroll a long stroke list inside the sheet; drag, resize and close the sheet"
    expected: "Rows scroll with the app SidebarScrollArea thumb (no OS scrollbar); dragging the header, resizing by the grip and Close behave exactly as before the change."
    why_human: "Live scroll and pointer interaction cannot be proven from the static harness."
  - test: "Open a rail-key-script frame in Move/Edit with no selection"
    expected: "Every recorded stroke of the frame is listed with its type (Brush/Water/Pen/Eraser), tip name (raw id fallback when unknown) and position; nothing deleted or from another frame appears."
    why_human: "Real recorded-script data and its visual listing are only observable in the running Studio."
  - test: "Inspect the toggle labels and row text"
    expected: "Labels render as 'Paint', 'Eraser', 'All' and row text in sentence case (not uppercase)."
    why_human: "Inline text-transform is pinned in tests, but the composed rendering with the global button rule is a screen check."
---

# Quick 261031-euf: Stroke list in the Stroke settings sheet — Verification Report

**Task Goal:** Add the stroke list to the watercolor Stroke settings sheet for the empty Move/Edit selection: keep the Paint/Eraser/All toggles (sentence case), add tool/tip dropdowns, then a topmost-first scrollable list of every recorded, non-deleted stroke of the current frame. Clicking a row selects exactly that stroke through the one shared replace setter so the canvas outlines it and the Geometry/Stack/Paint tabs return in place of the list.

**Verified:** 2026-10-31T10:07:43Z
**Status:** human_needed
**Re-verification:** No — initial verification (no prior VERIFICATION.md existed)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | With Move/Edit active and an EMPTY watercolor selection, the sheet shows the Paint/Eraser/All toggles in sentence case, the finer-filter dropdown(s), and the stroke list; the Geometry/Stack/Paint tab row and the old "Select a stroke to edit." caption are absent. | ✓ VERIFIED | Dialog renders the filter row unchanged (`PhysicsPaintStrokeSettingsDialog.tsx:724-749`) now with `FILTER_SEGMENT_STYLE`/`FILTER_SEGMENT_ACTIVE_STYLE` carrying `textTransform: 'none'` (251-266); fine filters render only when `engineModule === 'watercolor' && selectionEmpty` (751-791); tabs render only when `!selectionEmpty` (793-821); the list replaces the old caption branch (825-894, caption removed in the diff). Tests: `keeps the sheet open on an empty water color selection` (strokeSettingsModel.test.ts:1690-1711), `lists the frame strokes topmost-first with no tab row and no old caption` (2249+). |
| 2 | With a NON-EMPTY selection the sheet shows the tab row and the existing editing content and no list; clicking a row replaces the selection with exactly that mutationId through the one shared setter, so the canvas outline follows and the next render shows the tabs. | ✓ VERIFIED | Row `onClick={() => selectAquarelleStroke(stroke.mutationId)}` (852) → `selectScriptStroke` → `setScriptStrokeSelection` replace semantics (`scriptStrokeEdition.ts:144-154`); `ScriptStrokeOverlay.tsx:136` reads `scriptSelectedStrokeIds`. Test `clicking a row selects exactly that stroke and brings the tabs back` asserts `scriptSelectedStrokeIds.value === new Set([9])`, then tabs present, list and rows absent (strokeSettingsModel.test.ts:2309-2322); non-empty case at 2324-2334. |
| 3 | The list is every recorded, non-deleted stroke of the current frame, live-filtered by Paint/Eraser/All (the same signal the overlay and hit-test read) and by the tool/tip dropdowns; deleted strokes and strokes from other frames never appear. | ✓ VERIFIED | Producer keeps `isAquarelleStrokeDeleted` / `playFrame` guards (`aquarelleStrokeSelection.ts:475-479`); dialog reads `aquarelleStrokeTypeFilter.value` (388) and applies `matchesStrokeTypeFilter`, mirroring the shared predicate (`aquarelleStrokeSelection.ts:171-177`); overlay/hit-test port reads the same signal live (548-553, unchanged by this quick). Test `carries the recorded tool, brushId and custom-response flag on both branches` records a deleted stroke and another-frame stroke and asserts their absence (aquarelleStrokeSelection.test.ts:1359-1397); `the Paint/Eraser/All filter narrows the rows...` (2336+); port isolation test (1496-1513). |
| 4 | Each row shows type name (Brush/Water/Pen/Eraser, lift = Eraser), creation serial, stack position (1 = topmost), color dot, tip name via `findTip(brushId)?.name` with raw-id fallback, and a "Custom response" marker only for non-neutral overrides; rows are ordered stably topmost-first. | ✓ VERIFIED | Row markup at dialog 841-893 (dot/type/serial/position/tip/custom in that order); `strokeToolLabel` closed map and `resolveStrokeTipName` fail-closed (`strokeSettingsModel.ts:243-262`); `sortStrokesTopmostFirst` copies, sorts position then serial (`265-278`); `customResponse` computed by `hasCustomToolOverrides` vs `NEUTRAL_TOOL_OVERRIDES`/`TOOL_OVERRIDE_FIELDS` (`aquarelleStrokeSelection.ts:434-439`). Tests assert every row field plus the neutral row's missing marker (2268-2307), non-mutation sort and serial tie-break (1995-2014). |
| 5 | Fine filters default to All, reset on a fresh select-mode entry, reset on any actual Paint/Eraser/All change, and reset the tip to All when a tool change makes it unavailable; the dropdowns never offer a combination that yields zero rows. | ✓ VERIFIED | Compare-then-write setters and `resetAquarelleStrokeFineFilters` (`aquarelleStrokeSelection.ts:140-157`); reset inside `setAquarelleSelectMode` before the delegating call (335); reset inside `setAquarelleStrokeTypeFilter` only on a real change via `.peek()` (265, 286-291); tool onChange resolves the tip against the NEW tool's rows before the tool write (dialog 758-769). Tests: 1000 identical writes notify zero times, entry/re-entry/exit reset, idempotent type write keeps filters (aquarelleStrokeSelection.test.ts:1411-1494; strokeSettingsModel.test.ts:2012-2086); `no offered tool/tip combination yields zero rows` at model (2168-2195) and dialog (2520-2560). |
| 6 | The tip dropdown renders only when more than one tip is present; the summary reads `F<frame> · N strokes · P paint · E erasers`; the messages are "No strokes on this frame." and "No strokes match this filter." | ✓ VERIFIED | `tipOptions.length > 1` gate (dialog 776); `strokeListSummary` exact string over the FULL listing (`strokeSettingsModel.ts:370-384`); messages at dialog 833-840. Tests: hidden single-tip select (2432-2441), summary string (2486-2499), both empty messages and their mutual exclusivity (2503-2536). |
| 7 | The list scrolls inside the existing SidebarScrollArea, the sheet drag/resize/close and the brush-module sheet are unchanged, and no rendering, hit-test, selection-semantics, persistence or schema behavior changes. | ✓ VERIFIED | List container is the direct child of `SidebarScrollArea class="physics-paint-stroke-settings-scroll"` (dialog 823-829); drag/resize/close handlers untouched (diff hunk list: only imports, styles, derivations and the render blocks); `file diff` confined to 7 app files (no `packages/**`, no persistence/schema/Studio bundle); brush bundle renders no type/fine-filter/list chrome (dialog 724/751 gates + tests 2363-2373, 2578-2587); full app suite green including the `PhysicsPaintStudio.test.ts` bundle pin. |

**Score:** 7/7 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/src/components/physic-paint/view/scriptStrokeEdition.ts` | Additive `tool`/`brushId`/`customResponse` on `SelectableScriptStroke` | ✓ EXISTS + SUBSTANTIVE | 24 lines added, documented as display metadata only; typecheck clean. |
| `app/src/components/physic-paint/view/aquarelleStrokeSelection.ts` | Listing metadata on both branches, `hasCustomToolOverrides`, fine-filter signals/setters/reset | ✓ EXISTS + SUBSTANTIVE | Both the lift and paint push sites carry the metadata; existing frame/deleted/ribbon/stack law untouched. |
| `app/src/components/physic-paint/view/strokeSettingsModel.ts` | Pure list laws: labels, type match, tip resolution, sort, options, filtering, resolve helpers, summary | ✓ EXISTS + SUBSTANTIVE | Preact-free / DOM-free; `findTip` from the watercolor brushes subpath. |
| `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx` | List rows, fine-filter selects, summary, empty states, sentence-case chrome | ✓ EXISTS + SUBSTANTIVE | Render-body reads only; no local state, effects or signal writes added. |
| `app/src/components/physic-paint/physicsPaintStudio.css` | Sheet-scoped select/list/row/meta rules appended only | ✓ EXISTS + SUBSTANTIVE | Insertions only after the tabs rule; no existing rule changed. |
| `app/src/components/physic-paint/view/strokeSettingsModel.test.ts` | Model, dialog and CSS pins for the list and filters | ✓ EXISTS + SUBSTANTIVE | Old caption assertion replaced with absence + list assertions. |
| `app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts` | Listing metadata, fine-filter state, reset choke points, port isolation | ✓ EXISTS + SUBSTANTIVE | Records deleted and other-frame strokes to prove exclusion. |

**Artifacts:** 7/7 verified

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `listSelectableAquarelleStrokes` | `SelectableScriptStroke.tool/brushId/customResponse` → dialog row anatomy | Producer push on both branches | ✓ WIRED | `aquarelleStrokeSelection.ts:487-491, 502-516, 519-532` → dialog 841-893 |
| `aquarelleStrokeTypeFilter` | Dialog list rows AND overlay/hit-test port (one filter law) | Shared signal, kind-based predicate | ✓ WIRED | Dialog reads `.value` (388) and filters by kind (481); port reads the same signal live (548-553) |
| Row click | `selectAquarelleStroke(mutationId)` → `scriptSelectedStrokeIds` → canvas outline + tabs return | Shared replace setter | ✓ WIRED | Dialog 852; `scriptStrokeEdition.ts:152-155`; `ScriptStrokeOverlay.tsx:136` |
| `setAquarelleSelectMode` / `setAquarelleStrokeTypeFilter` | `resetAquarelleStrokeFineFilters` → tool/tip signals | Choke-point resets | ✓ WIRED | `aquarelleStrokeSelection.ts:287-291, 335` |
| `SidebarScrollArea` | Stroke list container → scrollable rows | Dialog composition | ✓ WIRED | Dialog 823-829 (list as the scroll area's child) |

**Wiring:** 5/5 connections verified

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| Dialog list rows (type/serial/position/color/tip/custom) | `strokes` → `typeRows` → `listRows` | `bundle.listStrokes(playFrame, canvasSize)` → `listSelectableAquarelleStrokes` over the recorded stroke registry (reads `aquarelleStrokesRevision`), real `findTip` names | Yes — measured registry, not a static/mock return | ✓ FLOWING |
| Fine-filter options | `toolOptions`, `tipOptions` | Derived from the same real rows | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Targeted suites (model, selection, seam, reorder) | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/strokeSettingsModel.test.ts src/components/physic-paint/view/aquarelleStrokeSelection.test.ts src/components/physic-paint/view/scriptStrokeEdition.test.ts src/components/physic-paint/view/aquarelleRecordState.reorder.test.ts` | 4 files passed, 208 tests passed | ✓ PASS |
| Typecheck | `pnpm --filter efx-motion-editor run typecheck` | `tsc --noEmit`, exit 0, no output | ✓ PASS |
| Full app suite + production build | `pnpm --filter efx-motion-editor exec vitest run` | 359 files passed / 2 skipped; 6616 tests passed / 1 skipped / 96 todo; chunk 1,581.98 kB (< 2000 kB ceiling) | ✓ PASS |
| Commit scope | `git diff --stat 915a96d01..fae0f92eb` | 7 app files, 1457 insertions / 37 deletions; nothing outside `app/src/components/physic-paint` | ✓ PASS |

### Probe Execution

| Probe | Command | Result | Status |
|-------|---------|--------|--------|
| — | — | No probes declared in the plan and no conventional `scripts/*/tests/probe-*.sh` applies to this quick | N/A |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| QUICK-261031-EUF | `261031-euf-PLAN.md` | Empty-selection stroke list in the watercolor Stroke settings sheet | ✓ SATISFIED (automated) | Live visible UAT remains the human item list above |

No orphaned requirements: the quick declares a single plan-local requirement ID that is not tracked in `.planning/REQUIREMENTS.md` (quick tasks are not phase requirements).

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
|-----------|-----------|--------|---------|----------|-----------------|---------|
| `strokeSettingsModel.test.ts` | QUICK-261031-EUF | 112 | 0 | No | Value + Behavioral (click → selection → tabs) | ✓ PASS |
| `aquarelleStrokeSelection.test.ts` | QUICK-261031-EUF | 63 | 0 | No | Value + Behavioral (state transitions, port law) | ✓ PASS |

**Disabled tests on requirements:** 0 → no blocker
**Circular patterns detected:** 0 → no blocker
**Insufficient assertions:** 0 → no warning

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`, no `console.*`, no `innerHTML`, no empty handlers or static returns in the changed files | — | None |

**Anti-patterns:** 0 found (0 blockers, 0 warnings)

### Human Verification Required

1. **Empty Move/Edit surface** — Enter Move/Edit with no selection. The toggles (sentence case) stay, the tool dropdown (and tip dropdown when >1 tip) sits beneath them, the summary and scrollable list follow; no tab row, no old caption.
   Expected: exactly that; the sheet remains open.
   Why human: rendered appearance is only visible on screen.

2. **Paint / Eraser / All filtering** — Toggle each and watch the list and the canvas outline together.
   Expected: the list and the overlay selection law stay consistent; the summary counts stay constant.

3. **Tool and tip dropdowns** — Only present tools are offered; the tip dropdown appears only with more than one tip; an orphaned tip resets to All tips on a tool change; every offered combination has rows.
   Expected: no empty option combination; native select interaction behaves.

4. **Row click → canvas + tabs, clear → list** — Click a row, edit a tab, clear the selection.
   Expected: the clicked stroke is outlined; tabs replace the list; clearing brings the list back.

5. **Empty states and summary** — An empty frame and a no-match filter.
   Expected: "No strokes on this frame." / "No strokes match this filter."; `F<frame> · N strokes · P paint · E erasers`.

6. **Long list scroll and sheet chrome** — Scroll a many-stroke list; drag, resize, close the sheet.
   Expected: SidebarScrollArea thumb scrolls; drag/resize/close unchanged.

7. **Rail-key-script frame** — Open a recorded-script frame in Move/Edit with no selection.
   Expected: every recorded stroke is listed with type, tip (raw-id fallback), position; deleted / other-frame strokes absent.

8. **Sentence case on screen** — Inspect the toggle labels and row text.
   Expected: "Paint", "Eraser", "All" and row text render in sentence case.

### Gaps Summary

No functional gaps found. Every must-have is present, substantive, wired and exercised by passing tests, and the diff is confined to display metadata, pure list laws, module fine-filter state, the dialog list surface and additive CSS. The remaining items are screen-only confirmations (rendered appearance, native select interaction, live scroll/drag/resize/close and the canvas outline) — recorded above as human verification, consistent with the task note that live native UAT is the user's job.

---

_Verified: 2026-10-31T10:07:43Z_
_Verifier: Claude (gsd-verifier)_
