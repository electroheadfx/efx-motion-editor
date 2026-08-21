---
phase: quick-260615-dpz-phase-36-1-consolidation-image-9-there-i
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/physic-paint/physicsPaintWorkflowState.ts
  - app/src/components/physic-paint/physicsPaintWorkflowState.test.ts
  - app/src/components/physic-paint/PhysicsPaintWorkflowStrip.tsx
  - app/src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts
autonomous: true
requirements:
  - quick-260615-dpz
must_haves:
  truths:
    - "The workflow strip does not repeat the layer type name as the active source label when the physics paint layer is already named Physics/Physic paint."
    - "The active Roto source is labeled like a numbered clip/source, e.g. Roto #1."
    - "The active Play source is labeled like a numbered clip/source, e.g. Play #2."
  artifacts:
    - path: "app/src/components/physic-paint/physicsPaintWorkflowState.ts"
      provides: "Reusable active source label helper for Roto/Play numbering"
      exports: ["getPhysicsPaintSourceLabel"]
    - path: "app/src/components/physic-paint/PhysicsPaintWorkflowStrip.tsx"
      provides: "Workflow strip header using source labels instead of duplicate Physics Paint naming"
    - path: "app/src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts"
      provides: "Source contract guarding Roto #1 / Play #2 labels and absence of repeated Roto paint / Play paint header copy"
  key_links:
    - from: "app/src/components/physic-paint/PhysicsPaintWorkflowStrip.tsx"
      to: "app/src/components/physic-paint/physicsPaintWorkflowState.ts"
      via: "imports getPhysicsPaintSourceLabel"
      pattern: "getPhysicsPaintSourceLabel"
---

<objective>
Remove the redundant “Roto paint” / “Play paint” source-name copy inside the physics paint workflow strip and replace it with numbered source labels such as “Roto #1” and “Play #2”.

Purpose: The layer already communicates that this is Physics/Physic paint, so the strip should identify the current editable source rather than restating the paint system name.
Output: A tested label helper and workflow strip header that uses Roto/Play numbered labels.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@/Users/lmarques/Dev/efx-motion-editor/CLAUDE.md
@/Users/lmarques/Dev/efx-motion-editor/.planning/STATE.md
@/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/physicsPaintWorkflowState.ts
@/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/physicsPaintWorkflowState.test.ts
@/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/PhysicsPaintWorkflowStrip.tsx
@/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts

Project constraints:
- Use pnpm, not npm.
- Do not run the dev server; the user runs it on their side.
- Keep the physics paint UI close to the current spec and avoid noisy extra UI.
- This is a small direct UI/validation fix; do not broaden into unrelated Pencil or physics paint cleanup.
</context>

<source_audit>
| Source | Item | Coverage |
|--------|------|----------|
| GOAL | Phase 36.1 consolidation screenshot issue: strip contains “Physic paint”/paint-type text even though the layer is already named Physics/Physic paint | Covered by Task 1 and Task 2 |
| REQ | Quick request: use labels like “Roto #1”, “Play #2” | Covered by Task 1 helper tests and Task 2 strip rendering |
| RESEARCH | No research phase requested; existing Phase 36.1 patterns use source-contract tests for the workflow strip | Covered by updating existing source-contract tests |
| CONTEXT | User wants less redundant naming, not a broader UI redesign | Covered by keeping changes isolated to the mode/source label |
</source_audit>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add numbered Roto/Play source label helper</name>
  <files>app/src/components/physic-paint/physicsPaintWorkflowState.ts, app/src/components/physic-paint/physicsPaintWorkflowState.test.ts</files>
  <behavior>
    - getPhysicsPaintSourceLabel('roto') returns "Roto #1".
    - getPhysicsPaintSourceLabel('play') returns "Play #2".
    - Existing workflow state helpers and labels continue to pass unchanged.
  </behavior>
  <action>In physicsPaintWorkflowState.ts, export a small getPhysicsPaintSourceLabel(mode: PhysicsPaintWorkflowMode): 'Roto #1' | 'Play #2' helper. Keep getActivePrimaryActionLabel unchanged because it controls button copy, not the strip source name. In physicsPaintWorkflowState.test.ts, import the new helper and add expectations for Roto #1 and Play #2. Do not introduce dynamic numbering or persistence; this quick fix only changes the visible source label requested in the screenshot issue.</action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor/app && pnpm test -- physicsPaintWorkflowState.test.ts --run</automated>
  </verify>
  <done>The helper exists, is exported, returns Roto #1 for roto and Play #2 for play, and the workflow state test passes.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Replace workflow strip header copy with source labels</name>
  <files>app/src/components/physic-paint/PhysicsPaintWorkflowStrip.tsx, app/src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts</files>
  <behavior>
    - The selected mode/source label renders getPhysicsPaintSourceLabel(props.mode), not “Roto paint” / “Play paint”.
    - The source-contract test requires the helper import and Roto #1 / Play #2 contract.
    - The strip still has no Roto/Play tablist and still keeps the existing Save roto frame, Render play, Stop, Save state, and Load state copy.
  </behavior>
  <action>Import getPhysicsPaintSourceLabel from physicsPaintWorkflowState.ts and use it in the .physics-paint-mode-label content. Update the existing “renders a locked standalone mode label instead of Roto and Play workflow tabs” source-contract test so it expects getPhysicsPaintSourceLabel(props.mode), Roto #1, and Play #2, and no longer expects the old ternary string. Preserve the no-tablist/no-tab assertions and existing action-label assertions. Do not rename buttons, lane aria labels, confirmation copy, or save/render actions; the change is only the redundant mode/source label in the strip header.</action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor/app && pnpm test -- PhysicsPaintWorkflowStrip.test.ts physicsPaintWorkflowState.test.ts --run</automated>
  </verify>
  <done>The strip header labels the active source as Roto #1 or Play #2, tests guard against the old duplicated paint-name header, and all targeted tests pass.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| UI render props | Workflow mode prop controls displayed label; it is local typed UI state, not external input. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-260615-dpz-01 | Spoofing | PhysicsPaintWorkflowStrip mode/source label | mitigate | Use a typed helper from PhysicsPaintWorkflowMode so labels cannot drift into duplicate or misleading free-form strings. |
| T-260615-dpz-02 | Tampering | Workflow actions | accept | This plan does not alter action callbacks, destructive confirmations, or timeline click behavior. |
| T-260615-dpz-SC | Tampering | Package installs | accept | No package installs are planned. |
</threat_model>

<verification>
Run targeted tests only; do not run the dev server.

<automated>cd /Users/lmarques/Dev/efx-motion-editor/app && pnpm test -- PhysicsPaintWorkflowStrip.test.ts physicsPaintWorkflowState.test.ts --run</automated>
</verification>

<success_criteria>
- The visible physics paint workflow strip header no longer says “Roto paint” or “Play paint” as the active source label.
- Roto mode displays “Roto #1”.
- Play mode displays “Play #2”.
- Existing action copy remains intact: “Save roto frame”, “Render play”, “Update”, and “Stop”.
- Targeted Vitest tests pass with pnpm.
</success_criteria>

<output>
Create `/Users/lmarques/Dev/efx-motion-editor/.planning/quick/260615-dpz-phase-36-1-consolidation-image-9-there-i/260615-dpz-SUMMARY.md` when done.
</output>
