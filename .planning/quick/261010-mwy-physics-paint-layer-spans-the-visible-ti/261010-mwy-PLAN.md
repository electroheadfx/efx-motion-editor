---
phase: quick-261010-mwy
plan: 261010-mwy
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/lib/timelineVisibleSpan.ts
  - app/src/lib/timelineVisibleSpan.test.ts
  - app/src/components/timeline/AddFxMenu.tsx
  - app/src/components/timeline/AddFxMenu.physicPaintSpan.test.ts
autonomous: true
requirements: [QUICK-261010-MWY]

estimate:
  tokens: 30000
  raw_tokens: 30000
  tasks: 2
  confidence: low

must_haves:
  truths:
    - "Adding a Physic Paint layer fills exactly the timeline frames visible at the current zoom and scroll (left edge = first visible frame, right edge = last visible frame)."
    - "Zooming out before create makes a longer span; zooming in makes a shorter span; scrolling sideways moves the span window with the view."
    - "On an empty project the new Physic Paint layer still matches the visible view instead of a silent fixed-length box."
    - "With isolation active the new Physic Paint layer keeps the isolated sequence range; the view does not override it."
    - "Paint / FX / content layer creation keeps today's one-click span law."
  artifacts:
    - app/src/lib/timelineVisibleSpan.ts
    - app/src/lib/timelineVisibleSpan.test.ts
    - app/src/components/timeline/AddFxMenu.tsx
    - app/src/components/timeline/AddFxMenu.physicPaintSpan.test.ts
  key_links:
    - "timelineVisibleSpan.ts is the only home of the LOCKED view-span law (frameWidth = BASE_FRAME_WIDTH * zoom, trackArea = viewportWidth - TRACK_HEADER_WIDTH, visibleFrameCount = max(1, round(trackArea / frameWidth)), inFrame = floor(scrollX / frameWidth), outFrame = inFrame + visibleFrameCount)."
    - "handleAddPhysicPaintLayer is the only creation call site that passes the view span; isolation still short-circuits to isolatedInFrame/isolatedOutFrame."
    - "sequenceStore.createFxSequence keeps its opts?.outFrame ?? (totalFrames > 0 ? totalFrames : 100) fallback for the other layer types."
---

<objective>
Make Physic Paint layer creation span the visible timeline view at the current zoom and scroll, instead of the silent createFxSequence fallback (whole project, or 100 frames on an empty project).

Purpose: zoom is the length control — zoom to the range you want to work in, create the layer, it fills exactly what you see. No modal, no length field, no Settings row.
Output: a pure view-span helper (timelineVisibleSpan.ts) plus the physic-paint-only wiring in AddFxMenu. Isolation, Paint / FX / content entries, and createFxSequence itself stay as they are.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.claude/skills/efx-preact-reactivity/SKILL.md

Key files (landmarks verified live 2026-10-10):
- app/src/components/timeline/AddFxMenu.tsx — handleAddPhysicPaintLayer :139-164 (isolation branch :154-155, default branch :156-157); handleAddPaintLayer :105-137; handleAddFxLayer :58-83; handleAddContentLayer :85-93. Isolation range from trackLayouts :47-56.
- app/src/stores/sequenceStore.ts — createFxSequence :273-285; span fallback at :285 (do not edit this function).
- app/src/stores/timelineStore.ts — zoom/scrollX/viewportWidth signals :14-17; BASE_FRAME_WIDTH=60 :39; TRACK_HEADER_WIDTH=80 :40 (private copies; canonical exports live in TimelineRenderer).
- app/src/components/timeline/TimelineRenderer.ts — export const BASE_FRAME_WIDTH = 60 :21; export const TRACK_HEADER_WIDTH = 80 :23.
- app/src/components/sidebar/AudioProperties.tsx — prior art for the same viewport math (Fit to view :92-97).
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: View-span law helper (pure, TDD)</name>
  <files>app/src/lib/timelineVisibleSpan.ts, app/src/lib/timelineVisibleSpan.test.ts</files>
  <behavior>
    - computeVisibleTimelineFrameSpan({zoom:1, scrollX:0, viewportWidth:680}) -> {inFrame:0, outFrame:10} (trackArea 600 / frameWidth 60).
    - computeVisibleTimelineFrameSpan({zoom:2, scrollX:0, viewportWidth:680}) -> {inFrame:0, outFrame:5} (zoom in shrinks the span).
    - computeVisibleTimelineFrameSpan({zoom:1, scrollX:120, viewportWidth:680}) -> {inFrame:2, outFrame:12} (scroll moves the window).
    - computeVisibleTimelineFrameSpan({zoom:1, scrollX:0, viewportWidth:80}) -> {inFrame:0, outFrame:1} (max(1, ...) floor when trackArea is empty).
    - resolvePhysicPaintCreateSpan with a non-null isolated range returns that range unchanged, whatever the view inputs are.
    - resolvePhysicPaintCreateSpan with isolated=null returns the view span (the 100-frame createFxSequence fallback is never an input to this function).
  </behavior>
  <action>Create app/src/lib/timelineVisibleSpan.ts as a pure module (no store imports, no Preact). Export computeVisibleTimelineFrameSpan(view: {zoom, scrollX, viewportWidth}) implementing the LOCKED span law exactly: frameWidth = BASE_FRAME_WIDTH * zoom, trackArea = viewportWidth - TRACK_HEADER_WIDTH, visibleFrameCount = max(1, round(trackArea / frameWidth)), inFrame = floor(scrollX / frameWidth), outFrame = inFrame + visibleFrameCount. Import BASE_FRAME_WIDTH and TRACK_HEADER_WIDTH from app/src/components/timeline/TimelineRenderer (same pattern as AudioProperties). Also export resolvePhysicPaintCreateSpan({isolated: {inFrame, outFrame} | null, view}) which returns the isolated range when non-null and the view span otherwise — this is the physic-paint creation decision, kept pure so the isolation-vs-view law is testable without mounting the menu. Write app/src/lib/timelineVisibleSpan.test.ts first (RED), then implement (GREEN). vitest run only (never watch).</action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/lib/timelineVisibleSpan.test.ts</automated>
  </verify>
  <done>Both helpers match the LOCKED formulas for zoom/scroll/track-area cases, the 1-frame floor holds, and isolation short-circuits to the isolated range.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Wire physic-paint creation to the view span</name>
  <files>app/src/components/timeline/AddFxMenu.tsx, app/src/components/timeline/AddFxMenu.physicPaintSpan.test.ts</files>
  <behavior>
    - handleAddPhysicPaintLayer builds its createFxSequence span via resolvePhysicPaintCreateSpan.
    - When targetSequenceId is set, the span passed to createFxSequence is the isolated range (today's behavior).
    - When there is no isolation target, the span is the visible view (inFrame + visibleFrameCount from scrollX/zoom/viewportWidth).
    - handleAddPaintLayer, handleAddFxLayer, and handleAddContentLayer keep their current createFxSequence / setAddLayerIntent call shape.
    - sequenceStore.createFxSequence still owns the opts?.outFrame ?? (totalFrames > 0 ? totalFrames : 100) fallback.
  </behavior>
  <action>In app/src/components/timeline/AddFxMenu.tsx, change only handleAddPhysicPaintLayer. At click time, read timelineStore.zoom / scrollX / viewportWidth with .peek() (narrow reads — do not subscribe the menu to viewport signals). Build isolated = targetSequenceId ? {inFrame: isolatedInFrame, outFrame: isolatedOutFrame} : null, call resolvePhysicPaintCreateSpan({isolated, view}), and pass the returned inFrame/outFrame as createFxSequence opts alongside position: 'top'. The view span is physic-paint-only; isolation keeps the isolated sequence range. Leave handleAddPaintLayer, handleAddFxLayer, handleAddContentLayer, and sequenceStore.createFxSequence alone. Cover the call-site contract in app/src/components/timeline/AddFxMenu.physicPaintSpan.test.ts (source-scan style, as in AudioProperties.test.ts): the physic-paint handler routes through resolvePhysicPaintCreateSpan and always supplies both span opts; the other handlers keep their existing call shape; the createFxSequence fallback expression in sequenceStore.ts is intact.</action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/lib/timelineVisibleSpan.test.ts src/components/timeline/AddFxMenu.physicPaintSpan.test.ts</automated>
  </verify>
  <done>Physic Paint create passes a view-derived inFrame/outFrame (or the isolated range when isolation is active); Paint / FX / content creation paths and the createFxSequence fallback are unchanged.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| (none) | Local editor UI geometry; no untrusted input crosses a privilege boundary in this quick |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-mwy-01 | Denial of Service | timelineVisibleSpan / createFxSequence opts | low | accept | Span is two integers derived from zoom/scroll/viewportWidth (zoom already clamped 0.1..10 in timelineStore); worst case is a short or long local layer box, revertable by undo. ASVS L1: local document edit. |
| T-mwy-02 | Tampering | AddFxMenu physic-paint call site | low | accept | No new IO, no new persisted fields, no privilege change; span is computed at click time from already-trusted store signals. |
| T-mwy-SC | Tampering | npm/pip/cargo installs | high | mitigate | No package-manager installs in this quick; package-legitimacy gate N/A. |
</threat_model>

<verification>
Constraints honored: Preact + @preact/signals only (efx-preact-reactivity); no useState / no React patterns; physic-paint-only call-site change; sequenceStore.createFxSequence fallback untouched; pnpm; vitest run only (never watch); no dev server; no push; native visual UAT stays with the user. PATH FORM: repo-root-relative. Package is `efx-motion-editor` — verify commands use `pnpm --filter efx-motion-editor exec vitest run src/...` (vitest roots at app/). One atomic commit per task. Vitest collects only `.test.ts`.

1. `pnpm --filter efx-motion-editor exec vitest run src/lib/timelineVisibleSpan.test.ts src/components/timeline/AddFxMenu.physicPaintSpan.test.ts` passes.
2. Live UAT rows (main app, user-driven):
   - Timeline at a given zoom -> add Physic Paint -> in/out match the visible frame range exactly.
   - Zoom out -> new layer longer and still view-matched; zoom in -> shorter; scroll sideways -> layer starts where the view starts.
   - Empty project -> add Physic Paint -> layer matches the view (no silent fixed-length box).
   - Isolation active -> layer still spans the isolated sequence range.
   - Paint / FX / content creation unchanged.
</verification>

<success_criteria>
Physic Paint layer creation is view-spanned at the current zoom/scroll, isolation still wins when active, and no other layer entry or createFxSequence caller changes behavior. Automated suite green; live UAT rows above confirmed by the user before close.
</success_criteria>

<output>
Create `.planning/quick/261010-mwy-physics-paint-layer-spans-the-visible-ti/261010-mwy-SUMMARY.md` when done
</output>
