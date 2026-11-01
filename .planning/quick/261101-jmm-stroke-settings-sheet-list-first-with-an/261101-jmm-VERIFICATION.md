---
phase: 261101-jmm-stroke-settings-sheet-list-first-with-an
verified: 2026-11-01T13:46:30Z
status: human_needed
score: 8/8 must-haves verified
covered_files: [".planning/quick/261101-jmm-stroke-settings-sheet-list-first-with-an/261101-jmm-PLAN.md", ".planning/quick/261101-jmm-stroke-settings-sheet-list-first-with-an/261101-jmm-SUMMARY.md", "app/src/components/physic-paint/PhysicsPaintStudio.test.ts", "app/src/components/physic-paint/PhysicsPaintStudio.tsx", "app/src/components/physic-paint/physicsPaintStudio.css", "app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx", "app/src/components/physic-paint/view/strokeSettingsModel.test.ts", "app/src/components/physic-paint/view/strokeSettingsModel.ts"]
covered_digest: "v3:sha256:e3fc09cd06c03f1170293d31c29f63290e4fd2a329149fe3c20b14a9c4a52333"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "In the live Studio (Move/Select on, one or more strokes selected), hover a list row, focus it with Tab, and select it; then click the row trash on a DIFFERENT row."
    expected: "The trash is invisible at rest, appears on hover/focus-within/selected, is a 22x22 control centred in the row, deletes only that stroke, and the other selected rows stay selected (minus the deleted id)."
    why_human: "The reveal is a CSS opacity/pointer-events law measured against the real WKWebView chrome; the jsdom-free harness only asserts structure, testids and the delete call."
  - test: "With two or more rows listed, Cmd-drag on the canvas, use the transform handles, and edit Geometry X/Y."
    expected: "Every selected stroke moves together (the whole list selection), and the list rows still reflect the selection afterwards."
    why_human: "Requires the real engine overlay and pointer gesture path; the harness only proves the row gestures write the one shared signal that those paths already read."
  - test: "Enter settings via the header icon, close the sheet (which leaves Move/Select), re-enter Move/Select and select a stroke; then repeat via the rail Select toggle instead of the sheet Close."
    expected: "The sheet opens on the LIST both times; the Geometry/Stack/Paint tabs appear only after a fresh click of the header settings icon."
    why_human: "The invalidation fires from the closed-sheet render that follows the selection clear; the behavioural test reproduces the empty-observation edge but the real close/reopen cycle depends on live signal-driven re-rendering."
  - test: "While in settings mode with two strokes selected, click the header global trash so the selection empties."
    expected: "The sheet shows the list (never an empty settings panel); selecting another stroke afterwards keeps the list until the header icon is clicked."
    why_human: "Deleting the last stroke also clears select mode and closes the sheet, so the exact live sequence is only observable in the running Studio."
  - test: "With a filtered list, Cmd-click a row, then change the tool/tip filter (or delete a row above it), then Shift-click another row."
    expected: "Observe whether the Shift range follows the displayed rows. The implementation holds a DISPLAYED-index anchor and rejects out-of-range indices, so a shrunk list can clear the selection instead of ranging — confirm the live behaviour is acceptable."
    why_human: "This is a design edge on an ordered/filtered list; whether clearing or re-anchoring is the preferred live outcome is a product judgement, and the harness always renders a stable list."
  - test: "With the sheet open, drag it by the header starting on top of the new settings-icon button and on the global trash (enabled and disabled states)."
    expected: "A normal click toggles/deletes; a press-and-drag on the header elsewhere still moves the sheet. A natively disabled button should not swallow or start a drag."
    why_human: "Native disabled-button pointer delivery and drag capture only exist in the real browser chrome."
---

# Quick 261101-jmm: Stroke settings sheet — list-first with an explicit settings mode

**Goal:** Turn the watercolor Stroke settings sheet into a list-first surface with an explicit settings mode (list default and persistent, tabs only via the header icon, request invalidated whenever the selection is observed empty), plus list multi-select and per-row/global trash on the shared delete path.
**Verified:** 2026-11-01T13:46:30Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Sheet opens on the stroke list, stays on the list while strokes are selected; the tab row appears only after the header settings icon, which flips to a list icon to return | ✓ VERIFIED | `PhysicsPaintStrokeSettingsDialog.tsx:412-476` (ref-held `settingsViewRef` default `'list'`, pure `view` derivation), `:797-839` (header toggle: `data-testid="stroke-settings-view-toggle"`, `aria-pressed`, `List`/`Settings2` glyph swap), `:924-952` (`view === 'settings'` gates the tab row), `:956` (list vs tabs branch). Behavioural tests `keeps the list while a stroke is selected and round-trips through the toggle`, `clicking a row selects exactly that stroke and KEEPS the list`, `a non-empty selection renders the list rows and the toggle reveals the tabs` pass |
| 2 | Settings entry is explicit and one-shot: any observed empty selection invalidates the pending request, so close/reopen, leave-and-re-enter Move/Select, or delete-to-empty lands the next non-empty selection on the LIST until a fresh icon click | ✓ VERIFIED | Plain non-signal module marker `strokeSettingsViewInvalidated` (`:201`) written idempotently in the render body BEFORE the early return (`:451-469`), gated by the pure `shouldInvalidateStrokeSettingsView`; cleared only in the toggle's click handler (`:815-817`) and `resetStrokeSettingsDialogLayout` (`:147`). `resolveStrokeSettingsView('settings', 0) === 'list'` (model `:436-441`). Behavioural test `never restores a settings request after the selection was observed empty` covers two full empty→non-empty cycles; `a delete that empties the selection renders the list, and the request stays invalidated` covers the delete path |
| 3 | Header settings icon natively disabled on an empty selection; global trash natively disabled below two selected strokes | ✓ VERIFIED | `:809` `disabled={selection.size === 0}`; `:790` `disabled={selection.size < 2}`, both real `<button type="button">` elements. Tests `natively disables the view toggle on an empty selection`, `the global trash is disabled below two strokes and deletes the whole selection` |
| 4 | Plain click replaces, Cmd/Ctrl toggles, Shift selects the inclusive displayed range from the last-clicked anchor — all through the one shared `scriptSelectedStrokeIds`; no new move mechanism | ✓ VERIFIED | Row handler `:988-1009` calls only `selectAquarelleStroke` / `toggleAquarelleStrokeSelection` / `setAquarelleStrokeSelection`, which delegate to `scriptSelectedStrokeIds` (`aquarelleStrokeSelection.ts:106,179-190`; `scriptStrokeEdition.ts:110-167`). Shift range implemented by the pure `resolveStrokeListRange` (model `:464-482`), anchor held as a displayed index in `rowAnchorRef` (`:418`), matching the `StrokeList.tsx` precedent. Diff contains no move/drag/transform additions; Geometry still commits the whole selection (`:584` `ids = [...selection]`). Tests `plain replaces, Cmd and Ctrl toggle, Shift takes the displayed range`, `Shift before any plain or Cmd click behaves as a plain click`, `resolves the inclusive DISPLAYED range and rejects invalid indices` |
| 5 | A row trash deletes ONLY that stroke through the bundle's `deleteStrokes` and never runs a selection setter; the global trash deletes the whole selection | ✓ VERIFIED | Row trash `:1051-1069` (`stopPropagation` on pointerdown and click, `deleteStrokes([stroke.mutationId])`, no setter — sibling `<button>`, not nested). Global trash `:786-799` (`deleteStrokes([...selection])`). Bundle wired in the Studio body `PhysicsPaintStudio.tsx:10366` to the same `handleAquarelleDeleteStrokes` used by the edition port `:8516`; that handler keeps the guards, `beginAquarelleDeleteEdit`, and `clearSelectionIfGone` (`aquarelleStrokeSelection.ts:703-721`). Tests `a row trash deletes only its own stroke and never touches the selection`, `the global trash is disabled below two strokes and deletes the whole selection`, Studio pin `wires the watercolor bundle callback and the memo dependency` |
| 6 | A delete that empties the selection while in settings mode renders the list, never an empty settings panel | ✓ VERIFIED | `resolveStrokeSettingsView(effectiveRequest, 0) === 'list'` (model `:436-441`), plus the invalidation marker for the subsequent selection. Test `a delete that empties the selection renders the list, and the request stays invalidated` |
| 7 | Paint/Eraser/All filter row, tool/tip fine filters and the `F<n> · N strokes · P paint · E erasers` summary render in LIST view only; settings shows only the tabs and their content | ✓ VERIFIED | Type filter `:855`, fine filters `:882` both gated on `engineModule === 'watercolor' && view === 'list'`; summary `:961` inside the `view === 'list'` list block. Test `renders the type filter, fine filters and summary in the LIST view only`; chrome test assertion inverted as planned |
| 8 | Brush sheet unchanged: no list, no toggle, no filter chrome, no trash; its tab row renders as today | ✓ VERIFIED | `view` is forced to `'settings'` for non-watercolor (`:474-476`), so the brush path renders the same tab row and no list; header trash/toggle and filters are watercolor-gated (`:786`, `:801`, `:855`, `:882`). Tests `leaves the brush sheet unchanged: no toggle, no list, its tabs as today`, `the brush sheet renders no list, no rows and no type chrome`, `the brush sheet renders none of the finer-filter chrome` |

**Score:** 8/8 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `app/src/components/physic-paint/view/strokeSettingsModel.ts` | Pure view/range/invalidation laws + optional `deleteStrokes` | ✓ VERIFIED | 685 lines; `StrokeSettingsView`, `resolveStrokeSettingsView`, `shouldInvalidateStrokeSettingsView`, `resolveStrokeListRange` (`:424-482`), `deleteStrokes?` on `StrokeSettingsDialogBundle` (`:530-536`). Still Preact/signal/DOM-free (imports only `@efxlab/efx-watercolor` + local types) |
| `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx` | View state, header controls, restructured rows, gestures | ✓ VERIFIED | 1401 lines; ref-held view signal, plain invalidation marker, header trash + toggle, view-gated filters/tabs, sibling row trash, multi-select handler. No `useState`; no new effect (only the two pre-existing effects) |
| `app/src/components/physic-paint/physicsPaintStudio.css` | Item wrapper, row-delete reveal, header-button chrome | ✓ VERIFIED | `:1508-1511` flex addition to the row; `:1578-1632` item wrapper / `is-selected` / invisible-until-hover trash; `:5769-5801` 22px header-button chrome with hover/focus-visible/disabled. No duplicate class definitions; no pre-existing rule changed beyond the row flex addition |
| `app/src/components/physic-paint/view/strokeSettingsModel.test.ts` | Pure-law + behavioural coverage | ✓ VERIFIED | 3025 lines; 128 tests pass; `renderSettings` idempotent helper; 16 new behavioural cases including two-cycle re-entry and delete-to-empty |
| `app/src/components/physic-paint/PhysicsPaintStudio.tsx` | Bundle `deleteStrokes` + memo dep | ✓ VERIFIED | `:10343` dep array includes `handleAquarelleDeleteStrokes`; `:10366` `deleteStrokes: (ids) => handleAquarelleDeleteStrokes(ids)` in the memo body |
| `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` | Scoped source pins | ✓ VERIFIED | `:4176-4186`; pins the dep slice and the bundle-body slice (not a whole-file `toContain`), so the edition-port duplicate string cannot satisfy them; 307 tests pass |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `settingsViewRef` + `shouldInvalidateStrokeSettingsView` + `resolveStrokeSettingsView` | header toggle icon/disabled + list-vs-tabs branch | render-body derivation | ✓ WIRED | `:457-476`, `:797-839`, `:924`, `:956`; no signal write outside the click handler |
| row click | `scriptSelectedStrokeIds` | `selectAquarelleStroke` / `setAquarelleStrokeSelection` / `toggleAquarelleStrokeSelection` | ✓ WIRED | `:988-1009` → `aquarelleStrokeSelection.ts:179-190` → `scriptStrokeEdition.ts:110-167`; rows read `selection.has(...)` for `is-selected` (`:975-980`); no second selection source in the dialog |
| `resolveStrokeListRange(displayedIds, anchorIndex, clickedIndex)` | Shift range | `rowAnchorRef` (displayed index) | ✓ WIRED | `:569`, `:996-1001`; `displayedIds` built from the rendered `listRows` |
| row trash + global trash | `handleAquarelleDeleteStrokes` | `StrokeSettingsDialogBundle.deleteStrokes` | ✓ WIRED | dialog `:1059-1065` / `:794` → `PhysicsPaintStudio.tsx:10366` → same handler as the edition port `:8516` → `beginAquarelleDeleteEdit` → `clearSelectionIfGone` |
| `.physics-paint-stroke-settings-list-item` hover/focus-within/`is-selected` | row trash reveal | CSS | ✓ WIRED | `physicsPaintStudio.css:1614-1618`; wrapper class applied at `:980` |

Note: `gsd-tools query verify.artifacts` and `verify.key-links` returned zero entries because the quick PLAN declares artifacts as bare paths and key_links as prose strings rather than `{path, provides}` / `{from, to, via}` objects. Both categories were verified manually above; no entry was skipped.

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| Stroke list rows | `listRows` (→ `displayedIds`) | `bundle.listStrokes` → `listSelectableAquarelleStrokes` (`aquarelleStrokeSelection.ts:447`), which reads the recorded stroke registry + the frame's engine timeline events | Yes — real recorded strokes; filters/sort are pure derivations | ✓ FLOWING |
| Row `is-selected` | `selection` | `scriptSelectedStrokeIds.value` (`:420`) | Yes — the live shared selection | ✓ FLOWING |
| Row/global trash | `deleteStrokes` | Studio `handleAquarelleDeleteStrokes` (real delete edit + re-bake) | Yes — real edit path, not a stub | ✓ FLOWING |
| View mode | `view` | `settingsViewRef` signal + `resolveStrokeSettingsView` | Yes — real persisted view state, not a literal | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Dialog + Studio source pins | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/strokeSettingsModel.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts` | 2 files, 435 tests passed | ✓ PASS |
| Sheet-order / Escape neighbours | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/floatingSheetStack.test.ts` | 11 tests passed | ✓ PASS |
| Typecheck | `pnpm --filter efx-motion-editor run typecheck` | `tsc --noEmit` exit 0 | ✓ PASS |
| Commits claimed by SUMMARY | `git log -1` + `git merge-base --is-ancestor <hash> HEAD` | 226c1fccd, 01d6dbe59, 20acf97c2, 78cc31091 all exist and are ancestors of HEAD (78cc3109); diff d6e4360c..HEAD touches only the 6 declared files | ✓ PASS |

### Probe Execution

No probe files declared in the PLAN/SUMMARY and none under `scripts/*/tests/probe-*.sh`. Step 7c: NOT APPLICABLE.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| QUICK-261101-JMM | 261101-jmm-PLAN.md | List-first sheet with explicit settings mode + multi-select + trashes | ✓ SATISFIED | Truths 1-8 above; no REQUIREMENTS.md entry exists for quick tasks, and no orphaned requirement maps to this quick |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | None | — | No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK` markers in any modified file; no `console.*` in the dialog/model; no empty handlers or hardcoded-empty props flowing to render; the only `PLACEHOLDER` grep hits in `PhysicsPaintStudio.tsx` are pre-existing `AQUARELLE_PLACEHOLDER_MAX_BYTES` identifiers outside this diff |

Preact reactivity audit: no `useState` in the dialog/model; no render-body SIGNAL writes. The only render-body write is the plain, non-signal `strokeSettingsViewInvalidated` flag, gated by a pure law and mirroring the existing `sawEmptySinceDismiss` precedent. Every signal write in the dialog is inside an event handler or the exported test-reset helper (`:144-145`, `:501`, `:667`, `:715`, `:742`, `:820-830`, `:944`). No new effect was added (the file keeps its two pre-existing effects at `:508` and `:518`). The toolbar's write path is compare-then-write plus the documented two-write re-assert for the invalidated-request case.

### Human Verification Required

1. **Row trash reveal and hit area**

   **Test:** Hover a row, Tab-focus it, and select it; then click the trash on another row.
   **Expected:** Invisible at rest; appears on hover/focus-within/selected; 22x22 centred control; deletes only its stroke and leaves the other selected rows selected (minus the deleted id).
   **Why human:** CSS opacity/pointer-events reveal measured against the real WKWebView chrome.

2. **Canvas group drag / transform handles / Geometry X/Y follow the list selection**

   **Test:** Select two or more rows, then Cmd-drag on the canvas, use the transform handles, and edit Geometry X/Y.
   **Expected:** Every selected stroke moves together; the list still reflects the selection.
   **Why human:** Requires the live engine overlay and gesture path.

3. **Close/reopen and rail leave/re-enter invalidation**

   **Test:** Enter settings via the icon; close the sheet (leaves Move/Select); re-enter and select a stroke. Repeat using the rail Select toggle instead of Close.
   **Expected:** Both times the sheet opens on the LIST; tabs only via a fresh icon click.
   **Why human:** The empty-observation edge is pinned behaviourally, but the real cycle depends on live signal-driven re-rendering of the mounted closed sheet.

4. **Delete-to-empty in the live Studio**

   **Test:** In settings with two strokes selected, click the header global trash so the selection empties.
   **Expected:** The sheet shows the list, never an empty settings panel; a later selection keeps the list until the icon is clicked.
   **Why human:** Deleting the last stroke also leaves select mode (closing the sheet), so the exact live sequence is only observable in the running Studio.

5. **Shift range after the displayed list changes (anchor edge)**

   **Test:** With a filtered list, Cmd-click a row, then change a filter or delete a row above it, then Shift-click another row.
   **Expected:** Confirm the live behaviour is acceptable. The anchor is a displayed INDEX and `resolveStrokeListRange` rejects out-of-range indices, so a list that shrank below the anchor can clear the selection rather than range. (Mirrors the `StrokeList.tsx` index-anchor precedent and matches the plan's prescribed law; flagged as a design edge, not a failed must-have.)
   **Why human:** Product judgement on the ordered/filtered-list edge; the harness always renders a stable list.

6. **Header drag vs. the new header buttons**

   **Test:** Start a drag on the header over the settings icon and over the global trash (enabled and disabled).
   **Expected:** A click toggles/deletes; dragging the header elsewhere still moves the sheet; a natively disabled button must not start or swallow a drag.
   **Why human:** Native disabled-button pointer delivery and drag capture only exist in the real browser chrome.

### Gaps Summary

No gaps. All eight must-have truths are implemented in the live files, wired end to end, and covered by passing behavioural tests; typecheck is clean and the targeted suites are green (435 + 11 tests). The deviation fix reported as `78cc31091` is present and sound: the toggle writes through the opposite value then the target when an invalidated request already equals the target, so the first click after a close/reopen or delete-to-empty notifies subscribers; when the stored value differs, the healthy path is a single compare-then-write. The implementation matches the plan's declared fallout list exactly — the only pre-existing assertions modified are the `renderDialogTab`/`renderSettings` helpers, the two Paint-tab tests, the two superseded 261031-euf list tests and the chrome test's final fine-filter assertions; no other test assertion was removed.

Two non-blocking observations: (1) the Shift anchor is a displayed index that survives list mutation and close/reopen, so an anchor past the shortened list makes a Shift click resolve to an empty range and clear the selection — the plan prescribed rejecting out-of-range indices, and the `StrokeList.tsx` reference uses the same index anchor, so this is a design edge rather than a missed must-have (human check 5); (2) for a hypothetical brush bundle that both kept the sheet open on an empty selection and had strokes, the forced `'settings'` view renders the tabs where the old empty-selection branch would have rendered the list — unreachable in production (the Studio only builds the watercolor bundle) and outside the pinned brush expectations.

---

_Verified: 2026-11-01T13:46:30Z_
_Verifier: Claude (gsd-verifier)_
