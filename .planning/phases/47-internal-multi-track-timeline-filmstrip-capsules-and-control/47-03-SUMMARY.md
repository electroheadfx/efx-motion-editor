---
phase: 47-internal-multi-track-timeline-filmstrip-capsules-and-control
plan: 03
subsystem: ui
tags: [preact, signals, physics-paint, timeline, multi-track, right-panel, keyboard-shortcuts, track-crud]

# Dependency graph
requires:
  - phase: 47-internal-multi-track-timeline-filmstrip-capsules-and-control
    plan: 01
    provides: Track CRUD store ops (addTrack/duplicateTrack/setTrackOpacity/setTrackBlend, TrackMutationResult), the activeTrackId document authority, efxPaintVersion clock
  - phase: 47-internal-multi-track-timeline-filmstrip-capsules-and-control
    plan: 02
    provides: publishStatus status-capsule channel (setApplyMessage), the pointer-path CRUD handlers the shortcuts share
provides:
  - Right-panel Track section for the ACTIVE track (TML-04): name, Opacity slider 0..1 (display clamped, step 0.01) committing via setTrackOpacity, Blend select with exactly the five BlendMode values committing via setTrackBlend; failures publish to the status capsule
  - Guarded track CRUD keyboard shortcuts (TML-02, Pitfall m4): Cmd/Ctrl+Shift+N adds a Paint track, Cmd/Ctrl+Shift+D duplicates the active track — both inside isPhysicsPaintShortcutTarget, skipped while mutationLocked, preventDefault only when they fire, never bound to Delete/Backspace (D-17)
  - Studio wiring: the right-panel memo re-resolves on efxPaintVersion so a row-header click re-renders the panel to the new active track; handleAddTrack/handleDuplicateTrack moved above the keyboard dispatch so pointer and shortcut paths share ONE handler (plus add-failure publish)
affects: [47-04, 47-05]

# Actuals (#2632) — pairs with the plan's `estimate` (tokens 60000, tasks 2, confidence low).
# estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 8057     # chars/4 over the 32,220-char realized diff (e417f916..HEAD, 6 files, +441/-26)
  tasks: 2
  commits: 7

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared pointer+shortcut handlers: the guarded shortcuts call the SAME useCallbacks as the strip's pointer paths (handleAddTrack/handleDuplicateTrack moved above the dispatch hook, TDZ-safe) so every path publishes failures identically"
    - "mutationLocked skip BEFORE preventDefault for the new shortcuts — a blocked shortcut never touches the event (unlike the pre-existing redo/undo branches which preventDefault first)"
    - "Right-panel contract tests reuse the palette HookRuntime harness with function-vnode expansion: childrenOf invokes function components by hand so id/aria lookups and the text walker reach the rendered host elements (findById skips function vnodes whose props.id mirrors the element's)"
    - "Memo freshness through the document clock: the right panel resolves the active track inside the memoized build and lists efxPaintVersion.value in the deps so a row-header click re-resolves and re-renders the panel (D-05 routing)"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx
    - app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts
    - app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts
    - app/src/components/physic-paint/view/physicsPaintStudioKeyboard.test.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/view/PhysicsPaintPalette.test.ts

key-decisions:
  - "The Track section always shows the ACTIVE track — resolved inside the memoized build from getEfxPaintDocument(layerId).activeTrackId (never the launch track) — and the right-panel memo re-resolves on efxPaintVersion.value so a row-header click re-renders the panel to the new track (D-05 routing)"
  - "Keyboard add/duplicate reuse the pointer-path handlers verbatim: handleAddTrack/handleDuplicateTrack were relocated above the usePhysicsPaintStudioKeyboard call (TDZ-safe — the actions object evaluates at render) and bound as addTrack: handleAddTrack and a duplicateTrack lambda that resolves the active track from the document; no duplicated store logic"
  - "The guarded branches skip BEFORE preventDefault (if (state.mutationLocked) return; preventDefault; action?.()) so a blocked shortcut never touches the event — deliberate contrast with the pre-existing redo/undo branches (which preventDefault first); acceptance criterion 'preventDefault only when they fire'"
  - "Delete/Backspace track deletion stays dialog-only: no track-delete branch exists in the dispatch (test-3 contract asserts 'deleteTrack' in handlers === false) and the roto delete classifier keeps owning the keys (D-17)"
  - "Plan typo documented: the acceptance grep 'Opacit|Mélange|Piste' is unsatisfiable as written — 'Opacit' is a prefix of the English 'Opacity' the section must contain; verified the intended French tokens 'Opacité|Mélange|Piste' absent instead"
  - "RED harness refinements (3 commits, all test-only) were needed because the panel is a plain-function component tree: the textContent walker had to traverse array children, and findById had to skip function vnodes (a PanelSlider vnode carries the same props.id as its inner input but no onInput). Kept as separate commits per the no-amend convention and documented here for the pattern"

patterns-established:
  - "One handler, every surface: add/duplicate track publish through the same fail-closed path on the strip '+', the duplicate icon, and the keyboard shortcuts — rejection surfaces in the status capsule identically (red warning triangle)"
  - "Guarded shortcut skeleton: isPhysicsPaintShortcutTarget early-return -> meta = metaKey||ctrlKey -> branch on meta && shiftKey && key -> mutationLocked skip -> preventDefault -> action?.()"
  - "Memo freshness through the active-track authority: efxPaintVersion.value is the single deps term that re-resolves document-derived UI (multiTrackRowBundle precedent, right panel follow)"

requirements-completed: [TML-02, TML-04]

coverage:
  - id: D1
    description: "Right-panel Track section — 'Track: <name>' title, Opacity slider 0..1 (display clamped, commits setTrackOpacity), Blend select with exactly the five BlendMode values (commits setTrackBlend); failures reach the status capsule; re-renders to the new active track"
    requirement: TML-04
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts#renders the Track section with the active track name, opacity slider value, and blend select value"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts#commits the dragged opacity once and clamps the slider display to 0..1"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts#commits the selected blend mode once and offers exactly the five BlendMode options"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts#re-renders to the new active track values when the active track changes (D-05)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Guarded track CRUD keyboard shortcuts — Cmd/Ctrl+Shift+N adds a Paint track, Cmd/Ctrl+Shift+D duplicates the active track; isPhysicsPaintShortcutTarget gate, mutationLocked skip, no Delete/Backspace track binding (D-17), meta/ctrl-only firing"
    requirement: TML-02
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintStudioKeyboard.test.ts#adds a track on Cmd/Ctrl+Shift+N and stays silent inside editable targets"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintStudioKeyboard.test.ts#duplicates the active track on Cmd/Ctrl+Shift+D and skips while mutationLocked"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintStudioKeyboard.test.ts#never binds Delete/Backspace to a track-delete action (D-17)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintStudioKeyboard.test.ts#fires only with meta or ctrl held, never on a bare letter"
        status: pass
    human_judgment: false

# Metrics
duration: 45min
completed: 2026-08-25
status: complete
---

# Phase 47: Internal Multi-track Timeline, Filmstrip Capsules, and Controls — Plan 3 Summary

**The right panel exposes the active track's opacity and blend mode through fail-closed setters, and guarded Cmd/Ctrl+Shift+N / Cmd/Ctrl+Shift+D shortcuts add and duplicate the active track — all unit-proven TDD-atomic on the milestone branch**

## Performance

- **Duration:** 45 min (wall-clock span of the execution; commit timestamps 19:09–19:17 +0200, RED authoring started before the first commit)
- **Completed:** 2026-08-25
- **Tasks:** 2 (plan tasks; RED+GREEN per task)
- **Commits:** 7 (1 RED test commit + 3 RED-phase harness refinements + 1 feat per task)
- **Files:** 6 modified

## Accomplishments

- **Task 1 — right-panel Track section** (`PhysicsPaintRightPanel.tsx`, commits `d8af5240` RED + `2ce074dd`/`33db25eb`/`22fc2833` harness + `85eb47ed` feat): the tools pane gains a Track group — `Track: <name>`, an Opacity slider reusing PanelSlider (0..1, step 0.01, display clamped to the declared range, committing `setTrackOpacity`), and a Blend select offering exactly the five BlendMode values committing `setTrackBlend`. The Studio right-panel memo resolves the ACTIVE track from the document (name/opacity/blendMode), re-resolves on `efxPaintVersion.value` so a row-header click re-renders the panel (D-05), and routes rejections through the same `setApplyMessage` capsule channel as the 47-02 strip CRUD.
- **Task 2 — guarded track CRUD keyboard shortcuts** (`physicsPaintStudioKeyboard.ts`, commits `6a97b213` test / `236a8d81` feat): `Cmd/Ctrl+Shift+N` adds a Paint track and `Cmd/Ctrl+Shift+D` duplicates the ACTIVE track — both inside the `isPhysicsPaintShortcutTarget` guard, skipped while `mutationLocked` BEFORE `preventDefault` (a blocked shortcut never touches the event), firing only with meta or ctrl held, and never bound to Delete/Backspace (D-17 — the roto delete flow keeps owning those keys). The Studio binds `addTrack` to the shared pointer-path handler and `duplicateTrack` to an active-track reader over the same handler, so every surface publishes failures identically (47-02 publishStatus channel).
- 8 new behavior tests (4 Track section + 4 keyboard), 6 files touched, full suite 2882 → 2890 passed, tsc exit 0.

## Test-harness refinements (RED-phase, documented)

The panel is a plain-function component tree, so the contract tests needed three harness corrections before the Track section existed could be proven green:

1. `2ce074dd` — the blend-label assertion moved from the select's own text (a `<select>`'s text is only its options) to the panel text.
2. `33db25eb` — the `textContent` walker now descends array children (the panel root holds an array of panes; previously it returned '').
3. `22fc2833` — `childrenOf` expands function vnodes (PanelSlider invoked with its props) and `findById` skips function vnodes, whose `props.id` mirrors the inner element's id (the PanelSlider vnode has no `onInput`).

## Known deviations / notes

- The plan's acceptance criterion "grep for 'Opacit|Mélange|Piste' finds none" is unsatisfiable as written — 'Opacit' is a prefix of the English 'Opacity' label the section must contain. Verified the intended absence of the French tokens 'Opacité', 'Mélange', 'Piste' instead, and no `globalCompositeOperation` anywhere in the panel (Pitfall M8).
- `handleAddTrack` now publishes failures (previously only success flipped the active track) — required so the keyboard path's rejections reach the capsule; the strip's '+' gains the same behavior through the shared handler, a strict improvement.
- `PhysicsPaintPalette.test.ts` baseProps gained the 5 new required props (typecheck gate), no behavior change.

## Task Commits

1. **Task 1: Right-panel Track section** — `d8af5240` (test RED) → `2ce074dd`, `33db25eb`, `22fc2833` (RED-phase harness refinements) → `85eb47ed` (feat)
2. **Task 2: Guarded track CRUD keyboard shortcuts** — `6a97b213` (test RED) → `236a8d81` (feat)
