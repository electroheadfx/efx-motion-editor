---
phase: quick-260615-iui
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
autonomous: true
requirements:
  - QUICK-260615-IUI
must_haves:
  truths:
    - "When editing a Play canvas frame, the immediate new brush stroke is shown over that same frame's cached image, not over the last cached frame."
    - "The normal brush-stroke insertion path is fixed without changing physics paint, move/deform, or broader play edit behavior unless that exact brush path is shared."
    - "The fix remains compatible with cached Play frame preview and dirty-cache behavior."
  artifacts:
    - path: "app/src/components/physic-paint/PhysicsPaintStudio.tsx"
      provides: "Play canvas frame preview/edit cache source selection"
      contains: "findCachedPlayPreviewFrame"
    - path: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts"
      provides: "Regression coverage for current-frame cached background selection"
      contains: "loadCachedPlayPreviewFrame"
  key_links:
    - from: "previewLocalPlayFrame(frame)"
      to: "loadCachedPlayPreviewFrame(previewFrame)"
      via: "local Play frame selection before brush input"
      pattern: "loadCachedPlayPreviewFrame\(previewFrame\)"
    - from: "beginPlayFrameEdit"
      to: "cachedPlayPreviewUrl"
      via: "normal Play brush input overlay"
      pattern: "setCachedPlayPreviewUrl"
---

<objective>
Fix the Phase 36.1 Play canvas immediate brush composite so painting on a selected Play frame uses that selected frame's cached image as the visible background.

Purpose: The user's current workflow eventually corrects after a re-render, but the immediate paint result is wrong because the brush appears over the last frame cache. The quick fix must make the first visual result perfect for the current Play frame.
Output: A focused code fix and regression test around Play cached preview selection during normal brush-stroke insertion.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@/Users/lmarques/Dev/efx-motion-editor/.planning/STATE.md
@/Users/lmarques/Dev/efx-motion-editor/.planning/quick/260615-iui-phase-36-1-consolidation-when-i-add-brus/260615-iui-CONTEXT.md
@/Users/lmarques/Dev/efx-motion-editor/CLAUDE.md
@/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/PhysicsPaintStudio.tsx
@/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/PhysicsPaintStudio.test.ts
@/Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint/src/engine/EfxPaintEngine.ts
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add regression coverage for Play edit current-frame cache selection</name>
  <files>app/src/components/physic-paint/PhysicsPaintStudio.test.ts</files>
  <behavior>
    - Test 1: The Play preview/edit path keeps the selected local Play frame as the source for cached preview lookup before normal brush input begins.
    - Test 2: The source code must not fall back to the last cached Play frame when a cached image exists for the selected preview frame.
  </behavior>
  <action>Add a targeted source-level regression test near the existing Play canvas tests. Cover the specific bug from QUICK-260615-IUI: selecting/previewing a Play frame and then beginning a normal brush edit must use that frame's cache/image as the immediate background. Assert the relevant block includes the selected preview frame flow through findCachedPlayPreviewFrame/loadCachedPlayPreviewFrame/previewLocalPlayFrame and does not introduce last-frame fallback logic. Keep this test aligned with the current test style in PhysicsPaintStudio.test.ts; do not add a new test config.</action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor/app && pnpm test -- --run src/components/physic-paint/PhysicsPaintStudio.test.ts</automated>
  </verify>
  <done>The test fails before the implementation if the current-frame cache source is not wired, and passes after the fix.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Use the selected Play frame cache for immediate normal brush edits</name>
  <files>app/src/components/physic-paint/PhysicsPaintStudio.tsx</files>
  <behavior>
    - Test 1: When workflowMode is play and a user previews local Play frame N, cachedPlayPreviewUrl is loaded from appFrame playStartFrame + N.
    - Test 2: When normal brush input begins on that frame, the visible cached background remains the selected frame's image long enough for the immediate stroke composite, rather than switching to a stale/last-frame cache.
    - Test 3: Dirty-cache marking still happens so subsequent render/apply behavior knows the Play script changed.
  </behavior>
  <action>Fix the normal Play brush insertion path per QUICK-260615-IUI. Inspect findCachedPlayPreviewFrame, loadCachedPlayPreviewFrame, previewLocalPlayFrame, and beginPlayFrameEdit. Preserve the selected frame's cached image for the immediate edit background: the cache source must be resolved by localPlayPreviewFrame/previewFrame and appFrame, not by the last cached frame or a stale captured URL. If beginPlayFrameEdit currently clears cachedPlayPreviewUrl before the first brush composite, change that behavior so the current frame cache stays visible for the immediate stroke while still marking savedPlayCacheDirty and selected Play cache dirty. Do not change physics paint, move/deform, Play render generation, or broader Play edit behavior unless the exact normal brush path shares the same functions. Keep paintVersion/dirty semantics intact where applicable.</action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor/app && pnpm test -- --run src/components/physic-paint/PhysicsPaintStudio.test.ts</automated>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor/app && pnpm typecheck</automated>
  </verify>
  <done>Painting a normal brush stroke on a selected Play canvas frame immediately composites over that frame's cached image; it no longer briefly appears over the last frame cache before re-render correction.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| User pointer input -> Play canvas state | Brush input mutates in-memory editable Play state and preview cache state. |
| Cached rendered frame data -> DOM img preview | Data URLs from saved Play cache are rendered as the immediate preview background. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-260615-IUI-01 | Tampering | beginPlayFrameEdit / cachedPlayPreviewUrl | mitigate | Keep dirty-cache marking while preserving only the current selected frame's already-saved cached image as the immediate visual background. |
| T-260615-IUI-02 | Information Disclosure | cached Play frame data URL preview | accept | Existing local in-app rendered frame data remains in the same component and is not sent to a new boundary. |
| T-260615-IUI-SC | Tampering | package installs | mitigate | No package-manager install tasks are included. |
</threat_model>

<verification>
Run the automated checks listed in each task. Do not run the dev server; the user runs it locally. After automation passes, ask the user to visually verify in the running app: open a saved Play canvas range, scrub/select a non-last frame with a visibly different cached image, draw one normal brush stroke, and confirm the immediate stroke appears over that selected frame's image before any re-render correction.
</verification>

<success_criteria>
- The quick fix is limited to the normal Play canvas brush-stroke insertion path.
- Immediate brush feedback uses the actual cache/image for the current frame being painted.
- Cached Play preview and dirty-cache behavior remain functional.
- Physics paint, move/deform, and broader Play edit/render paths are not unintentionally changed.
</success_criteria>

<output>
Create `/Users/lmarques/Dev/efx-motion-editor/.planning/quick/260615-iui-phase-36-1-consolidation-when-i-add-brus/260615-iui-SUMMARY.md` when done.
</output>
