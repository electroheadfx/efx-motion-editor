---
phase: quick-260911-s1j
plan: 260911-s1j
status: complete
type: execute
wave: 1
date: 2026-09-11
---

# Quick 260911-s1j — Track-row header redesign (inline controls)

**Status:** Automated-ready — **NATIVE UAT PENDING (user-run, one combined pass)**. The executor does not claim native UAT passed.

## Provenance

User work order 2026-09-11 with an attached mockup screenshot (the layout authority, measured at 2.03× scale against the real 185×30px row: 20×18 buttons, 18×18 S chip, 5px gaps — all matching the existing button family). Amends quick 260911-sli: the standing badge folds into the inline orange S; the sli UAT rows are folded into this quick's combined native pass.

Four intents: (1) remove the ⋯ expander — controls always visible inline, mockup order with the trash pinned far right; (2) remove the duplicate button (UI only — path retained); (3) remove the Blend on/off toggle from the Tools popover (the row button owns on/off per track) while the mode dropdown STAYS and is document-level; (4) armed solo = orange, frame blending on = orange, the inline S IS the row-level solo indicator.

## Verification carried (user-requested): the mode dropdown is document-level

Pre-plan verification found the mode write was **active-track-scoped**: the read came from `getRotoPhysicalInterpolationState(layerId, studioActiveTrackId())` (PhysicsPaintStudio.tsx:674) and the write went through `useRotoInterpolationController` → the physical-edit coordinator, which commits `trackId: getActiveTrackId(...)` (useRotoPhysicalEditCoordinator.ts:2174); the store map and the bridge payload are keyed `(layerId, trackId)`. Per the user's clarification ("the mode dropdown IS the global interpolation mode choice — verify it writes the document-level mode consumed by every track whose row blending is ON"), the quick fixes it:

- `handleRotoInterpolationModeChange` now loops `getEfxPaintDocument(layerId).tracks` and applies `setRotoPhysicalInterpolationState(layerId, track.id, { enabled: current.enabled, mode })` — the same direct store write the per-row blend button uses (render metadata, no coordinator lease, revision bump rides the push path), preserving each track's own `enabled` flag.
- The old coordinator path (controller hook, `updateRotoInterpolationSettingsRef`) and the popover's enable toggle wiring are removed from the Studio; the hook file `useRotoInterpolationController.ts` stays on disk, now unwired.
- Pinned by the new Studio test: loop over `document.tracks`, per-track enabled preserved, pending-operation guard, and the absence of `useRotoInterpolationController` / `updateRotoInterpolationSettings` / `onRotoInterpolationEnabledChange` in the Studio source.

## Commits

| Commit | Content |
|--------|---------|
| `19de96e5` | quick plan |
| `c49516f7` | `test(260911-s1j)`: RED — inline row controls / retired tools panel |
| `704ecefd` | `fix(260911-s1j)`: inline row controls; ⋯ panel + duplicate button retired |
| `e696fa73` | `style(260911-s1j)`: orange armed states; panel/badge/toggle styles retired |
| `a176bc63` | `fix(260911-s1j)`: Blend toggle leaves Tools; document-level mode write |
| `6a78f90a` | `style(260911-s1j)`: auto-margin (not flex-grow) pushes the name right |

## RED proofs

Task 1 (rewritten column + viewport contracts vs the old surface):
```
Test Files  2 failed (2)
     Tests  3 failed | 49 passed (52)
```
Failing: mockup-order sequence (`grip, eye, solo, blend, name, trash` vs the badge/panel surface), duplicate affordance still rendered, header still closed tools on pointer-leave. (After tightening one vacuous assertion → column file: `3 failed | 17 passed (20)`.)

Task 2 was implemented before its test rewrite (deviation, recorded): the OLD test files were run against the NEW surface as the inverted RED —
```
Test Files  2 failed (2)
     Tests  7 failed | 271 passed (278)
```
Failing exactly the retired-surface pins: interpolation toggle existence/guard/CSS, toolbox-badge, the popover's interpolation-gated render condition, and the Studio enable-handler wiring.

## GREEN results

- Task 1 targeted (column + viewport): **52 passed (2 files)**.
- Task 2 targeted (strip + Studio): **279 passed (2 files)**.
- Full suite: **exit 0** — 194 files passed (+2 skipped), **3548 passed**, 1 skipped, 101 todo, **0 failed** (`/tmp/efx-suite-s1j.log`).
- Types: `tsc --noEmit` → **exit 0**.

## Layout mapping (mockup → implementation)

| Mockup (measured) | Implementation |
|---|---|
| Grip dots (no box) | `.physics-paint-track-row-grip` (unchanged) |
| Eye box 20px | `.physics-paint-track-row-tool-button` (unchanged) |
| S chip (slightly smaller box) | `.physics-paint-track-row-solo` 18×18 (unchanged size; ARMED = orange now) |
| Blend box 20px | `…-blend` (unchanged; ARMED = orange now) |
| Name right-pushed, ~13px to trash | `.…-label-ellipsis`: `flex: 0 1 auto; margin-left: auto; padding-right: 8px` + the row's 5px gap |
| Trash box at far right | inline `Delete` tool button (same 20×18 family), pinned by the label's auto margin |
| No ⋯ / no duplicate / no badge | `.physics-paint-track-row-tools`, `-tools-toggle`, `-solo-badge`, `[data-tools-open]` rules and markup all removed |

Orange armed family (both states): `border-color: #f59e0b; background: rgba(245, 158, 11, 0.2); color: #fbbf24;` (hover `#fbbf24` / 0.28 alpha).

## What changed

- `PhysicsPaintTrackRow.tsx` — header renders exactly [grip][eye][S][blend] + right-pushed name + pinned trash; no tools panel, no ⋯, no duplicate, no badge, no `data-tools-open`, no pointer-leave close; `onDuplicateTrack` kept in the props (retained path, not rendered); header aria-label is plain `Select track <name>`.
- `physicsPaintTrackHeaderColumn.tsx` — drops `toolsOpenTrackId`/`onToggleTools`/`onCloseTools`; keeps passing `solo`/`layerId`/`onToggleBlend`/`onDuplicateTrack` (retained)/`onRequestDeleteTrack`.
- `PhysicsPaintWorkflowStrip.tsx` — `toolsOpenTrackId` state + handlers removed (incl. the delete-handler's panel close); Tools popover loses the Blend toggle, the badge, and the state-carrying aria-label (now plain "Timeline tools"); popover renders from the Actions section alone; `onRotoInterpolationEnabledChange` prop chain removed; tooltip copy now "Open timeline tools — Interpolation mode and Key Spacing."
- `PhysicsPaintStudio.tsx` — the document-level `handleRotoInterpolationModeChange` loop; `handleRotoInterpolationEnabledChange`, the controller hook usage, and the enable wiring removed. (Only this quick's hunks were staged; the file still carries the uncommitted stall instrumentation.)
- `physicsPaintStudio.css` — orange armed states, right-pushed label (flex-grow cleared so the auto margin consumes the free space), all panel/badge/toggle rules removed.
- Tests rewritten: `physicsPaintTrackHeaderColumn.test.ts`, `PhysicsPaintWorkflowStrip.viewport.test.ts`, `PhysicsPaintWorkflowStrip.test.ts`, `PhysicsPaintStudio.test.ts`.

## Deviations from Plan

- Task 2's RED was captured in inverted form (old tests vs new code) because the implementation preceded the test rewrite — recorded above rather than claimed as a clean RED-first cycle.
- The label needed an extra `flex: 0 1 auto` fix after the style commit: with `flex-grow: 1` the label box (not the auto margin) consumed the free space, so the name would have stayed left-aligned — caught in CSS reasoning, committed separately (`6a78f90a`).
- The Studio test's duplicate-affordance predicate originally matched the action row's unrelated "Duplicate Frame" control; scoped to expanded header cells.
- `useRotoInterpolationController.ts` is left on disk (now unwired from the Studio) — removing the module was out of this quick's scope.

## Native UAT — PENDING (user-run, combined pass; supersedes the 260911-sli rows)

1. Two paint tracks, both holding paint: the composite shows both.
2. Arm solo on the top track via its inline S (always visible — no panel). Expected: S turns ORANGE immediately; the lower track leaves the preview AND playback; un-solo restores everywhere.
3. Reopen the project with solo armed (persisted): the orange S is still on the row — report whether solo should keep persisting across reopen (separate decision).
4. Folded 260911-g1g 3-track scenario: A visible, B hidden, C hidden+soloed → A renders in Studio/canvas/export; C never appears; then solo A → only A; unhide B → still only A; C never appears; WYSIWYG at every step.
5. Layout matches the mockup: [grip][eye][S][blend] tight-packed, name right-pushed, trash far right; the active row keeps its blue left border.
6. No ⋯ button; no duplicate (copy) button; row controls never hide.
7. Tools popover: the Interpolation section holds ONLY the Frame duplicate / Frame blending dropdown — no Blend on/off toggle; the Tools button carries no interpolation badge.
8. Orange states read at a glance: armed solo = orange S; frame blending on = orange blend button; both off = neutral gray.
9. Document-level mode: with two tracks, change the mode in Tools — BOTH tracks follow (toggle one track's blending off/on around the change to confirm the mode sticks per document, not per active track).
10. Trash click still opens the acknowledge-and-delete flow; the last remaining track's trash stays disabled.

## Self-Check: PASSED

- Mockup order pinned by the rewritten TML-04 contract (grip < eye < solo < blend < name < trash); ⋯/panel/duplicate/badge absence pinned in both the column and the viewport contracts.
- Document-level mode loop pinned by the new Studio test; the retired wiring absent from the Studio source.
- Full suite + `tsc` green on the final tree; `git status --short` shows only the known uncommitted instrumentation beyond this quick's files (PhysicsPaintStudio.tsx staged hunks = this quick's only).

---

*Quick: 260911-s1j-track-row-header-redesign-inline-row-con*
*Completed: 2026-09-11 (native UAT pending)*
