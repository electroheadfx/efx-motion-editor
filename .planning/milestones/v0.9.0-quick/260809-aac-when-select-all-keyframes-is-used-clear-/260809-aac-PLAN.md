---
phase: quick-260809-aac-when-select-all-keyframes-is-used-clear
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts
autonomous: true
requirements:
  - QUICK-260809-AAC
estimate:
  tokens: 9000
  raw_tokens: 9000
  tasks: 1
  confidence: low
must_haves:
  truths:
    - "Invoking Select All replaces the existing primary/current real-key selection instead of retaining it alongside the complete key selection."
    - "After Select All, every real key uses the complete-selection treatment; the previously current frame, including the reported frame 32 case, has no separate primary/current selection highlight."
    - "Ordinary single-key and modifier-based multi-selection behavior keeps its existing primary-current versus secondary-selected visual hierarchy."
    - "Both the Cmd/Ctrl+A route and the visible Select All button inherit the fix through the existing shared Studio callback."
  artifacts:
    - path: "app/src/components/physic-paint/PhysicsPaintStudio.tsx"
      provides: "Replacement-style Select All state transition and current-selection clearing"
      contains: "selectAllRotoKeys"
    - path: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx"
      provides: "Primary-selection-aware current and complete-selection class projection"
      contains: "rotoSelectedKeyIds"
    - path: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts"
      provides: "Regression contract for clearing the primary selection before selecting every key"
    - path: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts"
      provides: "Regression contract preventing overlapping current and complete-selection classes"
  key_links:
    - from: "app/src/components/physic-paint/PhysicsPaintStudio.tsx"
      to: "app/src/stores/physicPaintStore.ts"
      via: "Select All clears both the session signal and the persisted physical selectedKeyId while retaining the cursor frame"
      pattern: "setRotoPhysicalSelection"
    - from: "app/src/components/physic-paint/PhysicsPaintStudio.tsx"
      to: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx"
      via: "Studio passes the nullable primary selected key identity separately from the complete selected keyId set"
      pattern: "rotoSelectedKeyIds"
    - from: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx"
      to: "timeline cell classes"
      via: "The current class requires an active matching primary key; complete selection applies selected to every selected key when the primary is null"
      pattern: "isSecondarySelected"
---

<objective>
Fix Physics Paint Roto Select All so it replaces the prior single/current key selection and displays only the complete real-key selection.

Purpose: Prevent overlapping selection states such as frame 32 retaining its separate orange current selection after all keyframes are selected.
Output: A focused Signal/store state correction, primary-selection-aware strip projection, and regression tests for the shared Select All path.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@/Users/lmarques/Dev/efx-motion-editor/CLAUDE.md
@/Users/lmarques/Dev/efx-motion-editor/.planning/STATE.md
@/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/PhysicsPaintStudio.tsx
@/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/PhysicsPaintStudio.test.ts
@/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
@/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts
@/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/roto/physicsPaintRotoMultiSelection.ts
@/Users/lmarques/Dev/efx-motion-editor/app/src/stores/physicPaintStore.ts
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: Replace the primary frame selection with the complete Select All set</name>
  <files>app/src/components/physic-paint/PhysicsPaintStudio.tsx, app/src/components/physic-paint/PhysicsPaintStudio.test.ts, app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx, app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts</files>
  <read_first>app/src/components/physic-paint/PhysicsPaintStudio.tsx, app/src/components/physic-paint/PhysicsPaintStudio.test.ts, app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx, app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts, app/src/components/physic-paint/roto/physicsPaintRotoMultiSelection.ts, app/src/stores/physicPaintStore.ts</read_first>
  <behavior>
    - Test 1: With a real key currently selected, the shared `selectAllRotoKeys` callback clears `selectedKeyId` and the store's physical selected key before publishing the ordered complete `selectedKeyIds` set.
    - Test 2: Select All still clears spacing-proxy and Loop Clip selection scopes and still reports `All keys selected`.
    - Test 3: When the complete selected-key set contains the cursor-frame key but the nullable primary key identity is absent, that cell receives the ordinary complete-selection class and does not receive the primary current-selection class.
    - Test 4: When a nullable primary key identity is present and matches the cursor-frame key during ordinary multi-selection, the existing primary current-selection class remains on that key while the other selected keys retain the secondary selected class.
  </behavior>
  <action>
Start by extending the existing source-contract regression suites so the reported replacement semantics fail before production changes. Keep the tests focused on the established shared callback and cell-class projection; do not add a new test configuration or browser/server harness.

In `PhysicsPaintStudio.tsx`, update the single `selectAllRotoKeys` callback used by both Cmd/Ctrl+A and the visible button. After confirming at least one ordered real key exists, clear the primary physical selection as a real state transition: set the `selectedKeyId` Signal to `null` and, when a launch context exists, call `physicPaintStore.setRotoPhysicalSelection(launchContext.layerId, null, currentFrame)` so serialization/bridge reads cannot retain the old separately selected key. Derive the complete selection with a null current key so its anchor follows the reducer's established first-key fallback, then clear spacing and Loop Clip scopes and publish all ordered real-key identities exactly once. Preserve the cursor/current frame, canvas content, key records, interpolation state, and existing success message; Select All changes selection ownership, not navigation or document content. Include the actual callback dependencies required by the launch/current-frame reads rather than introducing an effect or mirrored state.

Pass the nullable primary selected key identity from Studio to `PhysicsPaintWorkflowStrip` through one explicit optional prop alongside `rotoSelectedKeyIds`. In the strip's cell loop, distinguish the cursor overlay computed by `getRotoCellViewModel` from an active primary key selection: apply the visible primary `current` class only when the cell's stable keyId matches that nullable primary identity. Compute complete-selection membership from the existing keyId set, and when the set contains at least two keys, apply `selected` to every member that is not the active primary. This makes all cells uniform after Select All because its primary identity is null, while preserving the existing stronger-primary hierarchy for ordinary click, toggle, range, drag, and accepted-edit flows where `selectedKeyId` remains non-null. Keep spacing-proxy precedence, linked-loop styling, drag eligibility, aria state, tooltips, cache derivation, and current-frame navigation/status behavior unchanged. Use direct Signal-derived props and render-time derivation; do not add `useEffect`, duplicate selection Signals, CSS overrides, or unrelated refactors.
  </action>
  <verify>
    <automated>pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app exec vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts &amp;&amp; pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app typecheck</automated>
  </verify>
  <done>Select All clears the primary selected key in both Studio session state and the physical store, retains only the complete ordered real-key selection, renders the former current frame with the same complete-selection treatment as every other selected key, preserves ordinary primary/secondary selection behavior, and the focused Vitest plus typecheck gate passes.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Select All UI/keyboard intent → Studio selection Signals | Two entry points share one state transition and must not leave stale mutually exclusive selection scopes. |
| Studio session selection → physical store selection | The nullable primary identity exists in both local reactive state and serialized physical selection state. |
| Studio selection props → workflow strip classes | Stable key identities determine whether a cell is primary-current or part of the complete selected set. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-260809-AAC-01 | Tampering | `selectAllRotoKeys` state transition | medium | mitigate | Clear local and store primary selection in the shared callback before publishing the complete keyId set; pin ordering and retained scope clears in a focused regression test. |
| T-260809-AAC-02 | Tampering | Workflow strip class projection | medium | mitigate | Require stable keyId equality with the nullable primary identity for the visible current class; independently derive complete-selection membership from the existing set. |
| T-260809-AAC-03 | Denial of Service | Reactive selection wiring | low | accept | The change uses existing Signals and render-time derivation with no effects, listeners, timers, package installs, or new subscriptions beyond the existing Studio render inputs. |
| T-260809-AAC-SC | Tampering | Package supply chain | low | accept | No dependency or package-manager installation is planned. |
</threat_model>

<verification>
1. Run the two focused Vitest files with `vitest run`; they must prove the callback state replacement and the strip class separation for both Select All and ordinary multi-selection.
2. Run the app TypeScript typecheck to prove the new nullable primary-selection prop is wired through Studio and the workflow strip without contract drift.
3. Inspect the Select All callback to confirm both keyboard and button routes still share it, cursor navigation is untouched, spacing/Loop Clip scopes still clear, and no effect-based synchronization was added.
</verification>

<source_audit>
| SOURCE | ID | Feature/Requirement | Task | Status | Notes |
|--------|----|---------------------|------|--------|-------|
| GOAL | QUICK-260809-AAC | Select All replaces the existing single/current frame selection with the complete keyframe selection | Task 1 | COVERED | Clears the primary identity in Signal/store state and projects one uniform complete-selection treatment. |
| REQ | QUICK-260809-AAC | Locate and correct the exact shared Select All action and active/current frame selection state | Task 1 | COVERED | Uses `selectAllRotoKeys`, `selectedKeyId`, `selectedKeyIds`, and the workflow strip cell-class seam. |
| REQ | QUICK-260809-AAC-TEST | Add focused regression coverage where the existing test architecture supports it | Task 1 | COVERED | Extends the two existing Vitest source-contract suites and runs them directly. |
| RESEARCH | None | No research phase for this bounded quick fix | None | EXCLUDED | The fix follows established Signals, store selection, shared callback, and source-contract test patterns already present in the codebase. |
| CONTEXT | Replacement semantics | Frame 32 or any other prior current frame must not remain separately selected after Select All | Task 1 | COVERED | Primary selectedKeyId becomes null while all real keyIds remain selected. |
| CONTEXT | Preact-native scope | Reuse Signals and direct derivation; avoid unrelated refactors | Task 1 | COVERED | No new state abstraction, effect synchronization, package, CSS patch, or server flow is planned. |
</source_audit>

<success_criteria>
- Select All clears the existing primary/current key selection before installing the complete ordered real-key selection.
- The physical store no longer serializes the formerly primary key after Select All, while the cursor remains on its current frame.
- The previously current frame receives only the same complete-selection styling and accessibility state as the other selected keys.
- Ordinary single-key and modifier multi-selection retain their current primary versus secondary visual behavior.
- Both Select All entry points remain wired to the one corrected callback.
- The focused `vitest run` command and TypeScript typecheck pass without starting the application server.
</success_criteria>

<output>
Create `/Users/lmarques/Dev/efx-motion-editor/.planning/quick/260809-aac-when-select-all-keyframes-is-used-clear-/260809-aac-SUMMARY.md` when execution is complete.
</output>
