---
phase: quick-260815-bmg-remove-numeric-undo-redo-counts-from-pai
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx
  - app/src/components/physic-paint/physicsPaintStudio.css
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
autonomous: true
requirements:
  - QUICK-260815-BMG
estimate:
  tokens: 9000
  raw_tokens: 9000
  tasks: 1
  confidence: low
must_haves:
  truths:
    - "Paint and Physics Paint Studio Undo/Redo controls show their existing icons without any rendered history number or badge (D-01)."
    - "Undo and Redo retain count-free accessible names and existing tooltips, without announcing the available history depth (D-02)."
    - "The existing history availability still controls enabled/disabled presentation, while handlers, shortcuts, routing, history depth, and behavior remain unchanged (D-03)."
    - "Paint history remains separate from timeline history, and Motion Editor Undo/Redo remains untouched (D-04)."
  artifacts:
    - path: "app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx"
      provides: "Icon-only, count-free Paint/Physics Paint Studio Undo and Redo presentation while retaining history-driven availability"
    - path: "app/src/components/physic-paint/physicsPaintStudio.css"
      provides: "Studio icon-button styling with obsolete numeric badge rules removed"
    - path: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts"
      provides: "Focused regression contract for count-free presentation and preserved narrow history subscription/disabled logic"
  key_links:
    - from: "app/src/components/physic-paint/PhysicsPaintStudio.tsx"
      to: "app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx"
      via: "The existing historyAvailability Signal and onUndo/onRedo callbacks remain passed through unchanged"
      pattern: "historyAvailability|onUndo|onRedo"
    - from: "app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx"
      to: "@efxlab/efx-physic-paint PaintHistoryAvailability"
      via: "Undo/Redo counts continue to determine disabled state only, not rendered or announced content"
      pattern: "disabled={disabled || count === 0}"
---

<objective>
Remove numeric Undo/Redo history counts from the Paint and Physics Paint Studio controls, including both visible badges and count-announcing accessibility text (D-01, D-02).

Purpose: Present the existing Undo and Redo icons without history-depth numbers while preserving every operational boundary: enabled/disabled state, callbacks, shortcuts, routing, history capacity, Paint-versus-timeline separation, and Motion Editor behavior (D-03, D-04).

Output: A narrowly edited tool-rail presentation, removal of obsolete badge CSS, focused UI contract coverage, and standard quick verification evidence.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@/Users/lmarques/Dev/efx-motion-editor/CLAUDE.md
@app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx
@app/src/components/physic-paint/physicsPaintStudio.css
@app/src/components/physic-paint/PhysicsPaintStudio.test.ts
@app/src/components/physic-paint/PhysicsPaintStudio.tsx
@app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts
@app/src/lib/shortcuts.ts
@app/src/lib/history.ts
</context>

<tasks>

<task type="tracer">
  <name>Task 1: Remove Studio Undo/Redo count presentation without changing history behavior</name>
  <files>app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx, app/src/components/physic-paint/physicsPaintStudio.css, app/src/components/physic-paint/PhysicsPaintStudio.test.ts</files>
  <behavior>
    - D-01: Undo and Redo render only their existing icons; no numeric child, badge, or other count surface remains in Paint or Physics Paint mode.
    - D-02: Each button keeps the plain existing accessible/tool-tip name `Undo` or `Redo`, with no history depth in `aria-label`, `title`, hidden text, or generated copy.
    - D-03: The internal availability count still disables the matching button at zero and enables it above zero; existing callbacks and the narrow Signal subscriber remain intact.
    - D-04: No timeline history, Motion Editor Undo/Redo, shortcut, routing, engine, controller, store, or history-capacity code changes.
  </behavior>
  <action>Update `PhysicsPaintHistoryActionButton` only at the presentation boundary. Keep reading `historyAvailability?.value` and deriving the existing Undo/Redo count because that value remains the sole enabled/disabled input per D-03. Replace the count-derived `title` and `aria-label` with the existing `item.label`, and remove the rendered `.physics-paint-history-badge` child per D-01/D-02. Do not rename the component, alter its props, move the Signal subscription, change the zero-count disabled expression, add state/hooks/effects, add replacement labels or tooltip systems, or touch `PhysicsPaintStudio.tsx`, keyboard routing, global shortcuts, engine/controller/store/history modules, timeline history, or Motion Editor controls per D-03/D-04.

Delete only the now-unreachable `.physics-paint-history-badge` and disabled-badge CSS rule blocks; leave the icon button dimensions, icon treatment, disabled opacity/cursor, focus styling, and all unrelated Studio styles byte-for-byte unchanged.

Extend the existing focused `PhysicsPaintStudio.test.ts` tool-rail contract rather than adding broad history tests. Assert that the narrow child still reads `historyAvailability?.value`, still derives the Undo/Redo availability count, and still uses it in `disabled={disabled || count === 0}`. Also assert the child uses `title={item.label}` and `aria-label={item.label}`, contains no rendered history badge, and contains no count-composed accessible label. Add a CSS assertion that the obsolete badge selector is absent. Do not modify history-depth, shortcut, routing, or Motion Editor tests because their behavior is outside the changed presentation surface.</action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor/app &amp;&amp; pnpm vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts -x &amp;&amp; pnpm typecheck &amp;&amp; pnpm vitest run &amp;&amp; pnpm build &amp;&amp; git -C /Users/lmarques/Dev/efx-motion-editor diff --check</automated>
  </verify>
  <done>The focused contract and standard quick gates pass; Undo/Redo icons remain present and availability-driven, no visible or announced numeric history count remains in the Paint/Physics Paint Studio controls, and the diff is confined to the three declared presentation/test files.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| History availability Signal → Studio button presentation | Internal Undo/Redo depth crosses into UI rendering and disabled-state calculation; this quick changes only what is exposed visually and accessibly. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-QUICK-260815-BMG-01 | Tampering | `PhysicsPaintHistoryActionButton` enabled/disabled state | low | mitigate | Preserve the existing count derivation and exact zero-count disabled expression; pin both in the focused UI contract test. |
| T-QUICK-260815-BMG-02 | Information Disclosure | Undo/Redo accessible name and visible badge | low | mitigate | Remove history-depth output from rendered children, `title`, and `aria-label`; retain only plain action names and assert obsolete badge CSS is absent. |
| T-QUICK-260815-BMG-03 | Denial of Service | Undo/Redo event routing | low | accept | No handler, shortcut, routing, engine, or history implementation changes are permitted; focused tests plus full Vitest/typecheck/build gates guard accidental drift. |
</threat_model>

<verification>
- `cd /Users/lmarques/Dev/efx-motion-editor/app && pnpm vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts -x` passes the focused Studio UI contract.
- `cd /Users/lmarques/Dev/efx-motion-editor/app && pnpm typecheck` passes.
- `cd /Users/lmarques/Dev/efx-motion-editor/app && pnpm vitest run` passes the complete app suite.
- `cd /Users/lmarques/Dev/efx-motion-editor/app && pnpm build` passes without starting a server.
- `git -C /Users/lmarques/Dev/efx-motion-editor diff --check` passes, and the implementation diff is limited to the three declared files.
</verification>

<success_criteria>
- Paint and Physics Paint Studio Undo/Redo controls retain their current icons and enabled/disabled presentation but render no history-depth number or badge (D-01, D-03).
- Their accessible names and existing titles are plain `Undo` and `Redo`, with no count announcement and no new label or tooltip mechanism (D-02).
- Handlers, shortcuts, routing, history depth, Paint/timeline history separation, and Motion Editor Undo/Redo are unchanged (D-03, D-04).
- Only the focused Studio presentation/CSS/test files change, and focused plus standard quick verification gates pass.
</success_criteria>

## Source Coverage Audit

| SOURCE | ID | Feature/Requirement | Plan | Status | Notes |
|--------|----|---------------------|------|--------|-------|
| GOAL | — | Remove numeric Undo/Redo counts from Paint and Physics Paint Studio controls only | 01 | COVERED | The single tracer removes visible and announced counts at the existing Studio tool-rail presentation boundary. |
| REQ | QUICK-260815-BMG | Atomic quick-task delivery with focused tests and standard gates | 01 | COVERED | One self-contained task edits three focused files and runs targeted plus full verification. |
| RESEARCH | — | No research artifact | 01 | COVERED | Quick mode forbids a research phase; existing code and test conventions provide sufficient evidence. |
| CONTEXT | D-01 | Remove rendered numbers/badges from Paint and Physics Paint Studio Undo/Redo controls | 01 | COVERED | Tool-rail numeric child and badge CSS are removed. |
| CONTEXT | D-02 | Remove count-announcing accessibility text without adding labels or tooltip systems | 01 | COVERED | Existing action names remain as plain `title`/`aria-label`; count composition is removed. |
| CONTEXT | D-03 | Preserve icons, availability presentation, handlers, shortcuts, routing, depth, and behavior | 01 | COVERED | Count remains internal to disabled state; all operational modules are explicit no-touch boundaries. |
| CONTEXT | D-04 | Keep Paint and timeline histories separate; do not modify Motion Editor Undo/Redo | 01 | COVERED | Plan confines edits to the Physics Paint Studio presentation/CSS/focused contract test. |

<output>
Create `.planning/quick/260815-bmg-remove-numeric-undo-redo-counts-from-pai/260815-bmg-SUMMARY.md` when done.
</output>
