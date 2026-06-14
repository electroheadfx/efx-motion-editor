---
phase: quick-260614-ujc-phase-36-1-script-play-canvas-update-options
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/types/physicPaint.ts
  - app/src/types/physicPaint.test.ts
  - app/src/stores/physicPaintStore.ts
  - app/src/stores/physicPaintStore.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  - app/src/components/physic-paint/PhysicsPaintWorkflowStrip.tsx
  - app/src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts
  - app/src/components/physic-paint/PhysicsPaintTopBar.tsx
  - app/src/components/physic-paint/physicsPaintStudio.css
autonomous: true
requirements:
  - QUICK-260614-UJC
must_haves:
  truths:
    - "In Play paint, changing paint tool Normal/Physics, color, brush size, background paper, or motion options can update the selected saved Play script without rendering immediately."
    - "The Update action compares current options against the saved per-play render-options snapshot, clears cached frames only when relevant options changed, and persists the new snapshot for the selected/current play."
    - "The Play render action is labeled Render play, not Preview / Save Play."
    - "Brush size is easier to control at small values because the slider is wider and has a numeric input for exact entry."
    - "Changing background paper affects the physics paint canvas and is included in Play script update detection and persistence."
  artifacts:
    - path: "app/src/types/physicPaint.ts"
      provides: "Per-play render-options snapshot type and update payload validation"
    - path: "app/src/stores/physicPaintStore.ts"
      provides: "Persisted render-options snapshot updates and cache invalidation for selected Play scripts"
    - path: "app/src/components/physic-paint/PhysicsPaintStudio.tsx"
      provides: "Standalone Update action, option snapshot comparison, background application, and bridge payload"
    - path: "app/src/components/physic-paint/PhysicsPaintWorkflowStrip.tsx"
      provides: "Render play label and Update button in Play mode"
    - path: "app/src/components/physic-paint/PhysicsPaintTopBar.tsx"
      provides: "Wide brush-size slider with exact numeric input"
  key_links:
    - from: "PhysicsPaintWorkflowStrip Update button"
      to: "PhysicsPaintStudio.updateSelectedPlayOptions"
      via: "onUpdatePlayOptions prop"
      pattern: "onUpdatePlayOptions|Update"
    - from: "PhysicsPaintStudio current settings"
      to: "PhysicPaintPlayScriptRange.renderOptions"
      via: "snapshot comparison and update-play-render-options payload"
      pattern: "renderOptions|update-play-render-options"
    - from: "PhysicsPaintTopBar background controls"
      to: "EfxPaintEngine background state"
      via: "setBackground calls engine.setBgMode and persists snapshot background"
      pattern: "setBgMode|background"
---

<objective>
Implement the quick Phase 36.1 Play canvas update workflow requested in `260614-ujc-CONTEXT.md`: selected Play scripts remember render options, expose an Update button that persists changed options and clears cache without rendering, rename the render action to Render play, improve brush-size control, and fix background paper changes.

Purpose: The user needs script Play canvas output to respond to paint tool, color, stroke size, background paper, and motion-option changes without forcing an immediate render. Update is the explicit cache invalidation/save-options boundary; Render play remains the explicit render boundary.
Output: Typed render-options snapshots, store/cache update behavior, standalone UI controls, source-contract/unit tests, and focused verification commands.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@/Users/lmarques/Dev/efx-motion-editor/CLAUDE.md
@/Users/lmarques/Dev/efx-motion-editor/.planning/STATE.md
@/Users/lmarques/Dev/efx-motion-editor/.planning/quick/260614-ujc-phase-36-1-i-would-like-to-be-able-with-/260614-ujc-CONTEXT.md
@/Users/lmarques/Dev/efx-motion-editor/.planning/phases/36.1-when-a-physic-paint-was-created-with-a-play-paint-script-ani/36.1-08-SUMMARY.md
@/Users/lmarques/Dev/efx-motion-editor/.planning/phases/36.1-when-a-physic-paint-was-created-with-a-play-paint-script-ani/36.1-09-PLAN.md
@/Users/lmarques/Dev/efx-motion-editor/app/src/types/physicPaint.ts
@/Users/lmarques/Dev/efx-motion-editor/app/src/stores/physicPaintStore.ts
@/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/PhysicsPaintStudio.tsx
@/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/PhysicsPaintWorkflowStrip.tsx
@/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/PhysicsPaintTopBar.tsx
@/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/PhysicsPaintRightPanel.tsx
</context>

## Source Coverage Audit

| Source | Item | Coverage |
|--------|------|----------|
| CONTEXT decisions | Update compares current paint/render/motion options to saved options, saves new options, clears cached render, does not render immediately | Task 2 |
| CONTEXT decisions | Save paint tool, color, brush size, background paper, and motion options as per-play render-options snapshot; selected/current play only | Task 1, Task 2 |
| CONTEXT decisions | Rename Preview / Save Play to Render play | Task 3 |
| CONTEXT decisions | Add Update button | Task 2, Task 3 |
| CONTEXT decisions | Brush size slider wider with clickable numeric input for exact small values | Task 3 |
| CONTEXT specifics | Clear cache only when relevant saved options change | Task 1, Task 2 |
| CONTEXT specifics | Background paper changes included in update detection and persistence; fix if currently not working | Task 2, Task 3 |
| PROJECT memory | Use pnpm, do not run server, bump and subscribe to paint versions on mutations | All tasks |

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add typed per-play render-options snapshots and cache-clearing store update</name>
  <files>app/src/types/physicPaint.ts, app/src/types/physicPaint.test.ts, app/src/stores/physicPaintStore.ts, app/src/stores/physicPaintStore.test.ts</files>
  <read_first>
    - app/src/types/physicPaint.ts
    - app/src/types/physicPaint.test.ts
    - app/src/stores/physicPaintStore.ts
    - app/src/stores/physicPaintStore.test.ts
  </read_first>
  <behavior>
    - Test `PhysicPaintPlayScriptRange` accepts and normalizes a `renderOptions` snapshot containing paint tool Normal/Physics, color, brush size, background paper, and motion settings.
    - Test invalid render-options snapshots are rejected by `normalizePhysicPaintPlayScriptRanges` and update payload validation.
    - Test updating a selected script with changed render options removes cached frames for that script range only, marks `cacheStatus: 'stale'`, bumps `physicPaintVersion`, invalidates serialization, and keeps other Play ranges untouched.
    - Test updating with identical render options does not clear cached frames and does not bump `physicPaintVersion`.
  </behavior>
  <action>Per `260614-ujc-CONTEXT.md` decisions, extend Physics Paint types with a `PhysicPaintPlayRenderOptionsSnapshot` persisted on each `PhysicPaintPlayScriptRange`. The snapshot must include the selected paint mode/tool distinction for Normal versus Physics, brush color, brush opacity if already part of current settings, brush size, background paper/background mode, and Play motion settings. Add an `update-play-render-options` apply payload/result path or equivalent existing bridge-compatible payload shape so the standalone window can ask the editor store to update the selected/current Play script without sending rendered frames. Implement a store helper such as `updatePlayScriptRenderOptions(layerId, scriptId, renderOptions)` that compares against the saved snapshot: if different, remove only that script range's cached frames, set the range cache status to `stale`, persist the new snapshot, invalidate serialization, bump `physicPaintVersion`, and mark project dirty; if identical, leave frames/version unchanged. Keep the update scoped to the selected/current play only and do not add legacy migration code.</action>
  <verify>
    <automated>pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app test --run src/types/physicPaint.test.ts src/stores/physicPaintStore.test.ts</automated>
  </verify>
  <done>Saved Play script ranges can persist render-options snapshots and the store can update one selected script's options while clearing only its cache when options changed.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Wire standalone Update behavior and background paper snapshot detection</name>
  <files>app/src/components/physic-paint/PhysicsPaintStudio.tsx, app/src/components/physic-paint/PhysicsPaintStudio.test.ts, app/src/components/physic-paint/PhysicsPaintWorkflowStrip.tsx, app/src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts, app/src/stores/physicPaintStore.ts</files>
  <read_first>
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
    - app/src/components/physic-paint/PhysicsPaintWorkflowStrip.tsx
    - app/src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts
    - app/src/components/physic-paint/PhysicsPaintRightPanel.tsx
    - app/src/components/physic-paint/PhysicsPaintTopBar.tsx
    - app/src/stores/physicPaintStore.ts
  </read_first>
  <behavior>
    - Test/source-contract `PhysicsPaintStudio` builds the current render-options snapshot from current tool Normal/Physics state, color, opacity, brush size, background paper/background mode, and motion options.
    - Test/source-contract `Update` sends the update payload/helper and does not call `savePlay`, `AnimationPlayer.play`, or any render path.
    - Test/source-contract changed options set dirty/stale cache state and clear cached preview; unchanged options reports no update without clearing cache.
    - Test/source-contract background paper changes call the engine background API and are included in the snapshot comparison/payload.
  </behavior>
  <action>Following the current Phase 36.1 render-vs-publish split, add a Play-mode `updateSelectedPlayOptions` callback in `PhysicsPaintStudio.tsx`. It must compare the current settings snapshot with the selected/current Play script's saved render-options snapshot, call the Task 1 update payload/helper only when relevant options changed, clear local cached preview state for that selected script, and show concise status copy indicating options updated and cached frames need Render play. It must not render immediately. Make background paper changes reliable by ensuring the top-bar Background selection updates the engine visible canvas through the correct `EfxPaintEngine` background API and updates the snapshot field used by Update. If the existing engine API proves insufficient during implementation, create a focused debug note only after automated source tests show the missing API path; otherwise fix directly in this task. Do not run the dev server.</action>
  <verify>
    <automated>pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app test --run src/components/physic-paint/PhysicsPaintStudio.test.ts src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts src/stores/physicPaintStore.test.ts</automated>
  </verify>
  <done>In Play paint, Update persists changed render options for the selected/current play, clears that play cache, leaves rendering to Render play, and includes working background paper changes in detection/persistence.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Apply requested UI copy and brush-size input improvements</name>
  <files>app/src/components/physic-paint/PhysicsPaintWorkflowStrip.tsx, app/src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts, app/src/components/physic-paint/PhysicsPaintTopBar.tsx, app/src/components/physic-paint/PhysicsPaintStudio.test.ts, app/src/components/physic-paint/physicsPaintStudio.css</files>
  <read_first>
    - app/src/components/physic-paint/PhysicsPaintWorkflowStrip.tsx
    - app/src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts
    - app/src/components/physic-paint/PhysicsPaintTopBar.tsx
    - app/src/components/physic-paint/physicsPaintStudio.css
  </read_first>
  <behavior>
    - Test/source-contract the Play render button text is exactly `Render play` and no visible/source label remains as `Preview / Save Play`.
    - Test/source-contract Play mode exposes an `Update` button wired to `onUpdatePlayOptions` and this button is separate from `Render play`.
    - Test/source-contract brush size has both a wider range slider and a numeric input with min/max clamping for exact small values.
    - Test/source-contract the numeric brush-size input calls the same `onBrushSizeChange` path as the slider and is not read-only output text.
  </behavior>
  <action>Rename the Play render control from `Preview / Save Play` to exactly `Render play`, updating aria-label/title copy so the button's purpose is clear while preserving current cached-preview-versus-render behavior behind that button. Add a separate text-labeled `Update` button in Play mode near Render play, wired through `PhysicsPaintWorkflowStripProps` to the Task 2 update callback. Improve `PhysicsPaintTopBar` brush size control by making its slider visibly wider through CSS and replacing/augmenting the output-only value with a clickable numeric input for exact values, clamped to the existing brush size min/max and using the same `onBrushSizeChange` handler. Keep UI changes minimal and aligned with the existing Phase 36.1 standalone Physics Paint UI; do not add extra panels or noisy controls.</action>
  <verify>
    <automated>pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app test --run src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts</automated>
  </verify>
  <done>The UI shows Render play, a separate Update action, and a wider brush-size slider with exact numeric entry for small values.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Standalone Update button -> editor store | User-controlled option values update persisted Play script metadata and cache status. |
| Store render-options update -> cached frame deletion | A metadata change can delete cached rendered frames for one script range. |
| Background selection -> engine render state | UI option must affect visible canvas state and persisted render snapshot consistently. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-QUICK-260614-UJC-01 | Tampering | `updatePlayScriptRenderOptions` | mitigate | Validate snapshot fields, scope update by layer id and script id, remove cached frames only inside the selected script range, and test other ranges remain intact. |
| T-QUICK-260614-UJC-02 | Denial of Service | cache invalidation | mitigate | Compare snapshots before clearing cache so unchanged Update clicks do not discard usable frames or bump version. |
| T-QUICK-260614-UJC-03 | Repudiation | standalone Update action | mitigate | Show status copy after Update indicating whether options changed and whether cached frames need Render play. |
| T-QUICK-260614-UJC-SC | Tampering | package installs | accept | No package installs are planned or required. |
</threat_model>

<verification>
Run focused Vitest commands only. Do not run the dev server; the user runs it locally.
</verification>

<success_criteria>
- Per-play Play script render-options snapshots persist paint tool Normal/Physics, color, brush size, background paper, and motion options.
- Update compares current options to saved options, clears cached frames only when changed, saves the new snapshot, and does not render immediately.
- Render control copy is exactly `Render play` and Update is a separate action.
- Brush size can be adjusted precisely through a numeric input and with a wider slider.
- Background paper changes affect the canvas and are included in update detection/persistence.
</success_criteria>

<output>
Create `/Users/lmarques/Dev/efx-motion-editor/.planning/quick/260614-ujc-phase-36-1-i-would-like-to-be-able-with-/260614-ujc-SUMMARY.md` when done.
</output>
