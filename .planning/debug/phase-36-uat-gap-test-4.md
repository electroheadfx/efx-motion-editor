---
status: investigating
trigger: "Investigate Phase 36 UAT gap test 4 in /Users/lmarques/Dev/efx-motion-editor. Context: User reported the bottom Physics Paint workflow strip has separate `Convert Play to Roto` and `Convert Roto to Play` buttons, but the agreed UX/spec was to convert when switching tabs between `Roto canvas` and `Play canvas` with a confirmation dialog. The user wants those conversion buttons removed. Read the UAT file `.planning/phases/36-physics-paint-ui-rebuild-session-persistence-and-output-proo/36-UAT.md`, relevant phase summaries/specs, and source files around PhysicsPaintWorkflowStrip and PhysicsPaintStudio. Do not edit files. Return a concise root-cause diagnosis with: root_cause, artifacts (paths + issue), and missing fix actions."
created: 2026-06-13T00:00:00Z
updated: 2026-06-13T00:00:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: CONFIRMED — Plan 06 encoded conversion as explicit state-action buttons and tests locked that behavior, while the canonical context/discussion says tab switching is the explicit conversion affordance.
test: Compared UAT gap, phase context/discussion, Plan 06 summary/plan/test, and PhysicsPaintWorkflowStrip/PhysicsPaintStudio implementation.
expecting: Source shows conversion buttons in state-actions and Studio passes setWorkflowMode directly as onModeChange.
next_action: Return concise root-cause diagnosis without editing source.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: Switching between Roto canvas and Play canvas tabs should trigger conversion with a confirmation dialog when needed; separate conversion buttons should not be present in the bottom workflow strip.
actual: Bottom Physics Paint workflow strip has separate `Convert Play to Roto` and `Convert Roto to Play` buttons.
errors: none reported
reproduction: Open Physics Paint workflow bottom strip and observe conversion controls/tabs.
started: Phase 36 UAT gap test 4

## Eliminated
<!-- APPEND only - prevents re-investigating -->


## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-06-13T00:00:00Z
  checked: 36-UAT.md test 4 and gaps
  found: UAT reports separate conversion buttons are present, but expected UX is conversion via Roto/Play tab switch plus confirmation; user explicitly wants buttons removed.
  implication: The issue is a spec/implementation mismatch in the bottom workflow strip controls.
- timestamp: 2026-06-13T00:00:00Z
  checked: 36-CONTEXT.md D-24/D-25/D-37/D-38 and 36-DISCUSSION-LOG.md timeline controls
  found: Canonical decisions state Play range clicks are inspection-only, conversion is explicit through workflow tabs, and destructive conversion requires confirmation. Discussion log line 73 specifically says conversion to Roto happens by clicking the Roto tab and confirming.
  implication: The intended conversion affordance is tab switching, not separate Convert buttons.
- timestamp: 2026-06-13T00:00:00Z
  checked: 36-06-PLAN.md and 36-06-SUMMARY.md
  found: Plan 06 Task 2 instructed explicit Convert Play/Roto buttons and summary records key decision: "conversion and clearing are explicit button/dialog flows"; verification even grepped for `Convert Play to Roto`.
  implication: The bug was introduced/locked during Plan 06 by misinterpreting "explicit through tabs" as standalone conversion buttons.
- timestamp: 2026-06-13T00:00:00Z
  checked: PhysicsPaintWorkflowStrip.tsx
  found: The component renders `Convert Play to Roto` and `Convert Roto to Play` buttons in `.physics-paint-state-actions`; tabs only call `props.onModeChange('roto'|'play')`; confirmation state is opened only by those button handlers.
  implication: UI behavior directly matches reported bug; tab switch currently cannot show conversion confirmation.
- timestamp: 2026-06-13T00:00:00Z
  checked: PhysicsPaintStudio.tsx
  found: Studio passes `onModeChange={setWorkflowMode}` and separately passes conversion callbacks to explicit button props.
  implication: Conversion logic exists, but orchestration is wired to buttons instead of mode-change transition handling.
- timestamp: 2026-06-13T00:00:00Z
  checked: PhysicsPaintWorkflowStrip.test.ts
  found: Source-contract test asserts conversion buttons exist and are wired to confirmation/callbacks.
  implication: Tests currently protect the wrong UX and must be updated with the fix.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: Plan 06 misinterpreted the agreed UX. It implemented and tested explicit conversion buttons in the bottom state-actions area, while `onModeChange` remained a direct `setWorkflowMode` tab switch with no conversion-confirmation transition logic.
fix: not applied; read-only diagnosis requested
verification: diagnosis verified by source/spec comparison only; no source edits
files_changed: []
