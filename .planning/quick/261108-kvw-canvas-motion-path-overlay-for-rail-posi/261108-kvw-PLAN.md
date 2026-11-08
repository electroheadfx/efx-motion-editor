---
phase: 261108-kvw-canvas-motion-path-overlay-for-rail-posi
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/physic-paint/roto/railMotionPath.ts
  - app/src/components/physic-paint/roto/railMotionPath.test.ts
  - app/src/components/physic-paint/view/RailMotionPathOverlay.tsx
  - app/src/components/physic-paint/view/RailMotionPathOverlay.test.ts
  - app/src/components/physic-paint/hooks/useRotoTimelineActions.ts
  - app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/view/PhysicsPaintReferenceTransformHandles.tsx
autonomous: true
requirements: [QUICK-261108-KVW]
user_setup: []

estimate:
  tokens: 90000
  raw_tokens: 90000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "In ANIMATE mode with an open motion block and a Position channel, the canvas shows a READ-ONLY dashed path of the rail's authored Position route: one polyline through origin points sampled from the ONE evaluator, small filled dots at the position motion-key frames, and one distinct marker at the cursor's authored point. Selecting the rail is not required; the open block plus a selected non-opacity lane is the context, exactly like the gizmo."
    - "The path is the AUTHORED route, never the wiggled display: sampling evaluates a frozen probe record whose channel wiggle and every key wiggle are 0, so with wiggle on the polyline stays fixed while the box shakes. The marker uses the same probe, so the whole overlay is wiggle-neutral."
    - "Sampling covers every integer rail-local frame in a stride budget, PLUS every position motion-key frame and every stop-motion snap frame, deduped and sorted, under a HARD cap of 2000 total samples that holds for EVERY input: interior stride grid points yield to authored frames, and when the authored set alone exceeds the budget (a position channel may carry up to 4096 keys) the sampler decimates the sorted required list deterministically (index Math.round(out * (required.length - 1) / 1999) for out in 0..1999) so exactly 2000 samples remain with frame 0 and frameCount - 1 always present (the tail is never truncated). The sample list is produced once per edit by a module-level one-entry identity cache keyed on record, railId, span start, frame count, snap-list reference, pivotX and pivotY (both required sampler inputs), so scrubbing reuses the same frozen bundle."
    - "Reactivity obeys efx-preact-reactivity: no useState, no render-body signal writes, narrow reads. The static path comes from a computed that never reads the playhead and never calls getCurrentAppFrame; only the separate cursor computed reads input.getCurrentAppFrame. The handles' SVG path `d`, dots and stroke geometry are memoized on the path bundle plus project size and zoom, so only the marker is recomputed while scrubbing."
    - "The overlay lives inside the SAME SVG layer as the rail-motion transform handles, rendered FIRST so it sits behind the polygon and handles, with pointer-events none on the group and every child (no handlers): it can never block painting, key dragging or handle dragging. The line uses the existing rail-motion accent literal #4A90D9 served from ONE exported constant shared with the handles (no new design token)."
    - "The overlay hides entirely when there is no gizmo context (no selected/open rail, opacity lane, closed block), when the record carries no Position channel, when the span is shorter than two frames, or when every sampled point is the same (identity transform). It renders identically whether or not the Motion sheet is open, and it is absent outside ANIMATE mode."
    - "Hard non-goals hold: no draggable path points, bezier handles or tangent model; no schema, package-format, Rust or golden-fixture change; no new store setter, command or persisted field; railMotionEvaluator, the four easing laws, wiggle math, the compositor transform, the lane curve, the snap-frame memo and the pivot/ink geometry are untouched. The hook still contains exactly ONE textual evaluateRailMotion( occurrence (the gizmo's) and the snap accessor pin moves from 6 to 7 deliberately."
  artifacts:
    - path: "app/src/components/physic-paint/roto/railMotionPath.ts"
      provides: "Pure authored-path sampling: zeroRailMotionWiggle, sampleRailMotionPath, sampleRailMotionPathCached, evaluateRailMotionPathCursor, buildRailMotionPathD, placeRailMotionPathPoint, RailMotionPath/RailMotionPathEvaluation types"
    - path: "app/src/components/physic-paint/view/RailMotionPathOverlay.tsx"
      provides: "Hooks-free overlay leaf plus resolveRailMotionPathRenderModel and RAIL_MOTION_PATH_ACCENT"
    - path: "app/src/components/physic-paint/hooks/useRotoTimelineActions.ts"
      provides: "readActiveRailMotionContext split, cursor-free railMotionPath computed, cursor-owned railMotionPathCursor computed, both exposed on the hook return"
    - path: "app/src/components/physic-paint/PhysicsPaintStudio.tsx"
      provides: "Reads both computeds, adds the path signature to the canvas-stack memo deps, passes motionPath/motionPathCursor on the rail-motion handles envelope"
    - path: "app/src/components/physic-paint/view/PhysicsPaintReferenceTransformHandles.tsx"
      provides: "Optional motionPath/motionPathCursor props, overlay rendered first inside the existing SVG, accent literals replaced by the shared constant"
  key_links:
    - from: "app/src/components/physic-paint/hooks/useRotoTimelineActions.ts"
      to: "app/src/components/physic-paint/roto/railMotionPath.ts"
      via: "railMotionPath computed calls sampleRailMotionPathCached once per edit; railMotionPathCursor calls evaluateRailMotionPathCursor with the probe"
    - from: "app/src/components/physic-paint/roto/railMotionPath.ts"
      to: "app/src/components/physic-paint/roto/railMotionEvaluator.ts"
      via: "every sampled point is evaluateRailMotion(probe, frame, snapFrames).translateX/translateY in project px — no interpolation math of its own"
    - from: "app/src/components/physic-paint/PhysicsPaintStudio.tsx"
      to: "app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx"
      via: "railMotionTransformHandles.motionPath / motionPathCursor ride the existing envelope into PhysicsPaintReferenceTransformHandles"
    - from: "app/src/components/physic-paint/view/PhysicsPaintReferenceTransformHandles.tsx"
      to: "app/src/components/physic-paint/view/RailMotionPathOverlay.tsx"
      via: "resolveRailMotionPathRenderModel(path, cursor, projectWidth, projectHeight, zoom) then the leaf renders inside the existing SVG"
---

<objective>
Add the read-only canvas motion-path overlay for the rail's Position channels: a dashed polyline through authored origin points across the rail span, with dots on the position motion-key frames and a distinct marker at the cursor's authored point, drawn inside the existing rail-motion transform-handle SVG only while editing in ANIMATE mode.

Purpose: the user can see WHERE the rail travels (the spatial route) while editing easing and keys, not just where the box currently sits. The path is derived from the ONE evaluator through a wiggle-zeroed probe, so it is stable under wiggle and requires no schema, command or store writer.
Output: one pure sampling module, one hooks-free overlay leaf, two new hook computeds wired through the Studio into the handles SVG, and source/behavior pins proving the static path never reads the cursor.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.claude/skills/efx-preact-reactivity/SKILL.md

Key anchors at HEAD (re-verified for this plan):
- app/src/components/physic-paint/hooks/useRotoTimelineActions.ts — `readActiveRailMotionState` at 2240 (reads `getTrackRotorRevision(...).value`, resolves records/views, then reads `input.getCurrentAppFrame` and computes `localCursorFrame`); `railMotionGizmo` computed at 2589 (pinned gate strings; reads the snap accessor, `evaluateRailMotion(state.record, state.localCursorFrame, snapFrames)`, `getRotoPhysicalContentRevision`, `getRotoRailMotionCanvasInk(state.layerId, state.trackId, state.cursorFrame)`); hook return at 5130.
- app/src/components/physic-paint/PhysicsPaintStudio.tsx — `railMotionGizmoForCanvas` read at 9917, `canvasStack = canvasStackPropsMemo.resolve([...])` with `currentFrame` and `railMotionGizmoForCanvas?.signature ?? null` already in the deps; `railMotionTransformHandles` envelope at 10106.
- app/src/components/physic-paint/view/PhysicsPaintReferenceTransformHandles.tsx — `PhysicsPaintRailMotionGizmoProps` and `PhysicsPaintReferenceTransformHandlesProps` near the top; rail target sets `imageSize.value = { w: width/zoom, h: height/zoom }`; `strokeWidth = 1.5/zoom`; SVG starts near line 618 with the polygon, rotation stem/knob, rotation zones and corner rects; five #4A90D9 literals.
- app/src/components/physic-paint/roto/railMotionEvaluator.ts — `evaluateRailMotion`, `evaluateRailMotionChannel`, `collectRailMotionCurveFrames` (budget + stride pattern), private `formatRailMotionCurveCoordinate` (1 decimal, no trailing .0).
- app/src/components/physic-paint/roto/railMotionIdentity.ts — `railMotionViewFrameCount(view) = max(0, floor(endFrameExclusive - startFrame))`.
- app/src/components/physic-paint/view/PhysicsPaintReferenceTransform.ts — `getRailMotionBounds` maps a project-space point p to `zoom * (p + translate)`; with p = pivot * projectSize this is exactly `zoom * (pivot * projectSize + translate)`, and the box center is the pivot after translate.
- app/src/stores/physicPaintStore.ts — `getRotoRailMotionSnapFrames(layerId, trackId, railId)` (memoized frozen list, SAME reference across motion-only edits), `getRotoRailMotionCanvasInk(layerId, trackId, frame)` (rail-level union pivot; pivot is frame-independent, `base` is not).
- app/src/components/physic-paint/view/TimelineMotionChannels.tsx — `resolveMotionChannelPresence(channels)` returns `{ position, scale, rotation, opacity }`.
- app/src/components/physic-paint/view/railMotionEditingMode.ts — `railMotionSelectedChannel`.
- app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts — snap-rail seed describe near 6109 (position channels, key rail A/B/D, currentAppFrame 5); source contract at 6271-6302 pins the single `evaluateRailMotion(` call and the accessor count 6.
- app/vitest.config.ts collects ONLY `src/**/*.test.ts` — never add a `.test.tsx`.
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: End-to-end dashed authored path, key dots and cursor marker</name>
  <files>
    app/src/components/physic-paint/roto/railMotionPath.ts
    app/src/components/physic-paint/roto/railMotionPath.test.ts
    app/src/components/physic-paint/view/RailMotionPathOverlay.tsx
    app/src/components/physic-paint/view/RailMotionPathOverlay.test.ts
    app/src/components/physic-paint/hooks/useRotoTimelineActions.ts
    app/src/components/physic-paint/PhysicsPaintStudio.tsx
    app/src/components/physic-paint/view/PhysicsPaintReferenceTransformHandles.tsx
  </files>
  <behavior>
    - Test 1: a position-x channel with linear keys at local frame 0 value 0 and frame 10 value 100 (and the paired position-y at value 0) samples frame 5 as x 50 / y 0, and the key frames land exactly on their authored values.
    - Test 2: zeroRailMotionWiggle returns a frozen probe whose channel wiggle and every key wiggle are 0, and returns the input record by reference when it is already wiggle-free.
    - Test 3: sampleRailMotionPath returns null when the span has fewer than two frames or every sampled origin is the same point (identity transform); a record without a position channel also yields null.
    - Test 4: placeRailMotionPathPoint matches getRailMotionBounds(...).center for the same pivot, project size and zoom (the handles' ONE canvas convention).
    - Test 5: the overlay leaf renders nothing for a null model, and for a model its root is a g with class physics-paint-rail-motion-path and style pointer-events none, one key dot per key frame, one cursor marker, and a path d built from the sample list.
    - Test 6: the returned bundle carries the caller's pivotX/pivotY verbatim (both are required sampler inputs, never defaulted), and sampleRailMotionPathCached returns a NEW frozen bundle when only the pivot changes.
  </behavior>
  <action>
    Create app/src/components/physic-paint/roto/railMotionPath.ts as the pure authored-path model (no Preact, no store, no signal). Export RAIL_MOTION_PATH_MAX_SAMPLES = 2000 and RAIL_MOTION_PATH_DISTINCT_EPSILON = 1e-6; the types RailMotionPathSample (frame, x, y in project px), RailMotionPath (railId, startFrame, frameCount, pivotX, pivotY, samples, keyFrames, signature) and RailMotionPathEvaluation (path, authoredRecord, snapFrames). Export zeroRailMotionWiggle(record): return the record unchanged when every channel wiggle and every key wiggle is already 0, otherwise return a frozen clone with channel wiggle 0 and every key wiggle 0 (keep wiggleGlobal as stored — it is irrelevant once every wiggle is 0). Above it write the comment stating the authored-path law: the overlay draws the AUTHORED route, wiggle is display-only jitter, so every sample evaluates this probe while the box keeps shaking. Export sampleRailMotionPath(record, { railId, startFrame, frameCount, snapFrames, pivotX, pivotY }) — pivotX and pivotY are REQUIRED inputs, carried into the returned bundle and the signature and never defaulted inside the sampler: validate frameCount is finite and at least 2; build the probe; collect frames (Task 1: 0 and frameCount - 1 plus every key frame of the position-x channel, or position-y when x is absent, clamped to 0..frameCount-1); sample each frame with evaluateRailMotion(probe, frame, snapFrames) and take translateX/translateY as project-px x/y; return null when fewer than two samples differ by more than RAIL_MOTION_PATH_DISTINCT_EPSILON in x or y; build keyFrames from the position key frames (deduped, sorted, clamped); build signature from railId, startFrame, frameCount, pivotX, pivotY, samples.length and an FNV-1a hash over the rounded sample coordinates. Export sampleRailMotionPathCached(input) with a module-level one-entry Object.is cache over record, railId, startFrame, frameCount, snapFrames, pivotX and pivotY — including a cached null — returning the SAME frozen evaluation on a hit. Export evaluateRailMotionPathCursor(evaluation, railLocalFrame): null when the frame is non-finite or outside 0..frameCount-1, else the probe evaluated at that frame as { frame, x: translateX, y: translateY }. Export placeRailMotionPathPoint(x, y, pivotX, pivotY, projectWidth, projectHeight, zoom) returning zoom times (pivot * projectSize + translate) per axis, with a comment naming getRailMotionBounds(...).center as the ONE convention it mirrors. Export buildRailMotionPathD(path, projectWidth, projectHeight, zoom) producing an M/L polyline with the same 1-decimal formatter behavior as railMotionEvaluator's private formatRailMotionCurveCoordinate (round to 1 decimal, drop a trailing .0). Import evaluateRailMotion from railMotionEvaluator in THIS file only, so the hook still contains exactly one textual evaluateRailMotion( occurrence.

    Create app/src/components/physic-paint/view/RailMotionPathOverlay.tsx as a hooks-free leaf. Export RAIL_MOTION_PATH_ACCENT = '#4A90D9' (the ONE accent source) and the render-model types. Export resolveRailMotionPathRenderModel({ path, cursor, projectWidth, projectHeight, zoom }) returning null for a null path, else d (from buildRailMotionPathD over the sample list), dots (one { key: frame, x, y } per key frame placed through placeRailMotionPathPoint), marker (the cursor placed the same way, or null), strokeWidth 1.5/zoom, dotRadius 3/zoom, markerRadius 5/zoom and dashArray of 6/zoom and 4/zoom. Cache the static part (d, dots, strokeWidth, dotRadius, dashArray) in a module-level one-entry memo keyed on the path bundle reference plus projectWidth, projectHeight and zoom, and compute the marker on every call — the polyline geometry must not change while only the cursor moves. The leaf component takes a model prop and returns null when it is null, otherwise a g with class physics-paint-rail-motion-path, aria-hidden true and style pointerEvents none containing, in order: a path with class rail-motion-path-line, fill none, stroke RAIL_MOTION_PATH_ACCENT, stroke-width model.strokeWidth, stroke-dasharray model.dashArray, vector-effect non-scaling-stroke and style pointerEvents none; one circle per dot with class rail-motion-path-key-dot, key dot.key, r model.dotRadius, fill the accent and style pointerEvents none; and when present one circle with class rail-motion-path-cursor, r model.markerRadius, fill the accent, stroke white, stroke-width model.strokeWidth, vector-effect non-scaling-stroke and style pointerEvents none. Add no handlers anywhere.

    In app/src/components/physic-paint/hooks/useRotoTimelineActions.ts split readActiveRailMotionState: extract the launch/track/resolution body up to and including record into readActiveRailMotionContext(input) returning { layerId, trackId, records, views, view, record } and KEEP the getTrackRotorRevision(layerId, trackId).value subscription inside it; re-express readActiveRailMotionState as the spread of readActiveRailMotionContext plus cursorFrame and localCursorFrame computed exactly as today (0 when view is null or the frame is not finite, else max(0, floor(cursorFrame - view.startFrame))). No behavior change is allowed — every existing hook test must pass untouched. Add a railMotionPath computed (cursor-free by construction) after railMotionGizmo: resolve readActiveRailMotionContext; return null when view or view.railId is null or record is null; apply the same open-block verdict as the gizmo using input.getMotionBlockRailIdentity(); return null when railMotionSelectedChannel.value is null or 'opacity'; return null when resolveMotionChannelPresence(record.channels).position is false; read the snap list with physicPaintStore.getRotoRailMotionSnapFrames(state.layerId, state.trackId, state.view.railId); read physicPaintStore.getRotoPhysicalContentRevision(state.layerId, state.trackId) so a raster edit re-resolves the pivot; resolve the pivot with physicPaintStore.getRotoRailMotionCanvasInk(state.layerId, state.trackId, state.view.startFrame), falling back to RAIL_MOTION_PIVOT_FALLBACK from roto/railMotionPivot when it is null (the pivot is rail-level and frame-independent; only the displayed base depends on the frame); then return sampleRailMotionPathCached({ record: state.record, railId: state.view.railId, startFrame: state.view.startFrame, frameCount: railMotionViewFrameCount(state.view), snapFrames, pivotX, pivotY }). This computed must NOT call input.getCurrentAppFrame and must NOT read cursorFrame or localCursorFrame. Add a railMotionPathCursor computed that reads railMotionPath.value, returns null when it is null, reads input.getCurrentAppFrame with the same non-finite-to-0 rule as the state reader, derives the local frame from the bundle's startFrame, and returns evaluateRailMotionPathCursor(evaluation, localFrame). Expose railMotionPath and railMotionPathCursor on the hook return next to railMotionGizmo with a short comment that they are the 261108-kvw canvas path (static route + cursor marker).

    In app/src/components/physic-paint/PhysicsPaintStudio.tsx read const railMotionPathForCanvas = rotoTimelineActions.railMotionPath.value and const railMotionPathCursorForCanvas = rotoTimelineActions.railMotionPathCursor.value beside railMotionGizmoForCanvas at 9917; add railMotionPathForCanvas?.path.signature ?? null to the existing canvasStackPropsMemo.resolve deps array (do not remove currentFrame or the gizmo signature); inside the memo, add motionPath: railMotionPathForCanvas?.path ?? null and motionPathCursor: railMotionPathCursorForCanvas to the railMotionTransformHandles envelope at 10106.

    In app/src/components/physic-paint/view/PhysicsPaintReferenceTransformHandles.tsx add optional readonly motionPath and motionPathCursor to PhysicsPaintReferenceTransformHandlesProps (leave PhysicsPaintRailMotionGizmoProps and its pinned shape untouched); import RailMotionPathOverlay, resolveRailMotionPathRenderModel and RAIL_MOTION_PATH_ACCENT. Replace all five #4A90D9 literals with the imported RAIL_MOTION_PATH_ACCENT (stroke attribute becomes an expression). After the rail-motion imageSize gate and before the return, resolve the model only when target is 'rail-motion': resolveRailMotionPathRenderModel({ path: props.motionPath ?? null, cursor: props.motionPathCursor ?? null, projectWidth: imageSize.value.w, projectHeight: imageSize.value.h, zoom }). Render RailMotionPathOverlay with that model as the FIRST child inside the existing svg, before the polygon, so the path sits behind the box and handles and never intercepts pointer events.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor run typecheck</automated>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/railMotionPath.test.ts src/components/physic-paint/view/RailMotionPathOverlay.test.ts</automated>
  </verify>
  <done>
    A two-key linear Position rail produces one frozen path bundle sampled through the wiggle-zeroed probe, carrying the caller's pivotX/pivotY; the Studio passes it to the handles; the existing SVG renders the dashed accent polyline, one dot per position key frame and the cursor marker behind the polygon with pointer-events none on the group and every child. The hook keeps exactly one textual evaluateRailMotion( occurrence (the gizmo's). Both targeted test files and typecheck pass.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Authored sample fidelity — key frames, snap frames, hard 2000-sample cap, wiggle neutrality</name>
  <files>
    app/src/components/physic-paint/roto/railMotionPath.ts
    app/src/components/physic-paint/roto/railMotionPath.test.ts
  </files>
  <behavior>
    - Test 1: every position motion-key frame is present in the sample list and its point equals the authored key value exactly.
    - Test 2: a stop-motion rail with snap frames repeats the same point between snaps and steps only at a snap frame; every snap frame inside the span appears in the sample frame set.
    - Test 3: a 5001-frame span yields at most 2000 samples, the first sample frame is 0, the last sample frame is 5000 (tail never truncated), and both key frames are present.
    - Test 4: a record with channel wiggle 12 and per-key wiggle values produces a point list byte-identical to the same record with wiggle 0 (frozen probe), while evaluateRailMotion on the raw record differs at the same frames.
    - Test 5: sampleRailMotionPathCached returns the same frozen evaluation reference for repeated calls with the same inputs and a new one when the record, span or snap-list reference changes.
    - Test 6 (over-cap authored set): a position-x channel at the RAIL_MOTION_MAX_KEYS_PER_CHANNEL key cap (4096 linear keys at consecutive frames inside a 5000-frame span, so the authored required set alone is 4097 frames) yields samples.length <= 2000, first sample frame 0, last sample frame 4999, every kept frame drawn from the authored required set, and an identical frame list on repeated calls (deterministic decimation).
  </behavior>
  <action>
    Extend collectRailMotionPathFrames inside app/src/components/physic-paint/roto/railMotionPath.ts to build the required frame set first: 0, frameCount - 1, every position key frame clamped to the span, and every snap frame clamped to the span; dedupe and sort. Then apply the hard-cap law in exactly two branches. (a) required.length <= RAIL_MOTION_PATH_MAX_SAMPLES: keep every required frame; when interiorBudget = RAIL_MOTION_PATH_MAX_SAMPLES - required.length is greater than 0, set stride = max(1, ceil((frameCount - 2) / interiorBudget)), add every interior frame from stride to lastFrame - 1 step stride, merge and sort. The grid count is floor((frameCount - 2) / stride) <= interiorBudget, so the total can never exceed RAIL_MOTION_PATH_MAX_SAMPLES; when interiorBudget is 0 add no grid points. (b) required.length > RAIL_MOTION_PATH_MAX_SAMPLES: the authored frames alone already fill the budget, so return exactly RAIL_MOTION_PATH_MAX_SAMPLES frames with NO grid points, chosen by deterministic even decimation over the sorted required list — required[Math.round(out * (required.length - 1) / (RAIL_MOTION_PATH_MAX_SAMPLES - 1))] for out = 0..RAIL_MOTION_PATH_MAX_SAMPLES - 1 — which is strictly increasing and always starts at 0 and ends at frameCount - 1, so authored frames outrank the grid and the tail is never truncated. Write the law, both branches and the decimation formula in a comment above the function, and guarantee the merged result never exceeds RAIL_MOTION_PATH_MAX_SAMPLES for any input. Never drop 0 or frameCount - 1. Sample every collected frame through the probe exactly once, in ascending order. Keep the distinct-point gate and the frozen bundle. Document in the sampleRailMotionPath doc comment that stop-motion steps are represented by repeated integer samples that jump at a snap frame (no epsilon left-limit points — a spatial path draws the connector, the lane curve keeps the epsilon behavior), that an over-cap authored set is evenly decimated rather than truncated, and that the last frame is always sampled.

    Add the tests to app/src/components/physic-paint/roto/railMotionPath.test.ts using the existing frozen-record fixture style from railMotionEvaluator.test.ts: reuse a proven stop-motion fixture shape (keys with easing 'stop-motion' plus snapFrames) rather than inventing one; assert exact point equality for key frames; assert the byte-identical wiggle-neutrality comparison by comparing the serialized samples of the probe path against a wiggle-free twin record and asserting evaluateRailMotion on the raw record differs; assert the 5001-frame cap and tail; assert the over-cap row by building the channel programmatically (Array.from to the RAIL_MOTION_MAX_KEYS_PER_CHANNEL key cap, frames consecutive, easing linear, wiggle 0) and asserting samples.length <= 2000, first frame 0, last frame 4999, every kept frame present in the authored required set, and the frame list identical across two calls; assert the cache identity contract with the same and changed inputs.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/railMotionPath.test.ts</automated>
  </verify>
  <done>
    Sampled frames include every integer grid point within the budget, every position key frame and every snap frame in the span whenever they fit; when the authored frames alone exceed the budget the sampler returns exactly 2000 evenly decimated authored frames. The total NEVER exceeds 2000 for any input, frame 0 and the span tail are always present (never truncated), and a wiggle-bearing record produces the exact same point list as its wiggle-free twin while the raw evaluator differs. The module test passes.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Hide rules, cursor/static separation pins, and full gates</name>
  <files>
    app/src/components/physic-paint/hooks/useRotoTimelineActions.ts
    app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts
  </files>
  <behavior>
    - Test 1: with a counting getCurrentAppFrame mock, reading railMotionPath.value never increments the count (static route), and reading railMotionPathCursor.value increments it exactly once and returns the authored point at the local frame.
    - Test 2: railMotionPath is null when no lane is selected, when the selected lane is opacity, when the motion block is closed, when the record has no Position channel, and when the sampled route is the identity.
    - Test 3: railMotionPathCursor is null outside the rail span and non-null inside it.
    - Test 4 (source pin): the railMotionPath computed body contains neither getCurrentAppFrame nor localCursorFrame, while the railMotionPathCursor computed body contains getCurrentAppFrame; the hook still contains exactly one evaluateRailMotion( occurrence matching the gizmo call; the snap accessor count is updated to 7 with its comment explaining the path sampler read.
    - Test 5: the two new computeds are exposed on the hook return beside railMotionGizmo.
  </behavior>
  <action>
    In app/src/components/physic-paint/hooks/useRotoTimelineActions.ts confirm and finalize the hide rules on railMotionPath: no context (view/railId/record null), closed block, null or opacity selected lane, absent Position presence, span under two frames, or an identity route (all covered by the module returning null) must all yield null; the cursor computed must return null outside 0..frameCount-1. Do not add any cursor-based availability read to the static computed — the handles' existing availability and isPlaying mount gates are the sole cursor-dependent visibility for the layer, and the overlay must keep rendering identically whether or not the Motion sheet is open (never read railMotionDialog there). Verify the split preserved readActiveRailMotionState's exact cursor semantics and that the gizmo body, its pinned strings and the evaluator are untouched.

    Update app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts. Extend the 261108-d5o source contract: change the accessor expectation from 6 to 7 and rewrite its comment to name the new path sampler read (gizmo + path sampler + setMotionKeyAtCursor + commitRailMotionInspectorValue + key-mode easing commit + reset); keep the evaluateRailMotion( count at 1 and its regex intact; add a pin slicing the railMotionPath computed body (match from its declaration to its closing brace) asserting it contains neither getCurrentAppFrame nor localCursorFrame, and a pin asserting the railMotionPathCursor body contains getCurrentAppFrame. Add a behavioral describe built on the existing snap-rail seed (replaceRotoPhysicalRecords + replaceRotoPhysicalRailMotions with position channels, selectedKeyRail, getMotionBlockRailIdentity) with a counting getCurrentAppFrame: read railMotionPath.value first and assert zero frame reads and a non-null bundle, then read railMotionPathCursor.value and assert one frame read and a point inside the span; assert null for each hide rule using the same harness (clear the lane selection with exitRailMotionEditing, select opacity, return a null block identity, and remove the position channels), and assert the marker is null just past the span end. Finally assert both computeds appear on the returned actions object.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/hooks/useRotoTimelineActions.test.ts</automated>
    <automated>pnpm --filter efx-motion-editor run typecheck</automated>
    <automated>pnpm --filter efx-motion-editor exec vitest run</automated>
  </verify>
  <done>
    The static path is provably cursor-free (behavioral counting mock plus source pin), the marker is the only cursor-dependent computation, every hide rule returns null, the accessor pin reads 7 with an accurate comment and the single evaluateRailMotion call pin is unchanged. Typecheck and the full vitest run pass with no failures.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| overlay SVG to paint/key/handle gestures | the overlay shares the canvas hit surface with painting, key dragging and the transform handles — any interactive node would steal gestures |
| motion model to rendered path | sampled points are derived presentation data; a bad sample set or unbounded span would cost render time without crossing a trust boundary |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-KVW-01 | Tampering | RailMotionPathOverlay group and children | high | mitigate | Root g and every child carry pointerEvents none and no event handlers; the group renders first inside the existing SVG so it can never sit above the polygon or handle hit targets. The leaf test asserts the none style on the root. |
| T-KVW-02 | Denial of service | railMotionPath sampling and render model | medium | mitigate | Hard 2000-sample cap that holds for every input: a stride grid yields to authored key/snap frames, and an authored set above the cap (up to 4096 keys per channel) is decimated deterministically to exactly 2000 with both endpoints kept; plus a module-level one-entry identity cache so scrubbing never re-samples, and a static render-model cache so only the marker recomputes per frame. |
| T-KVW-03 | Information disclosure | overlay geometry vs document state | low | accept | The overlay only projects authored motion values already visible in the Motion sheet and on the canvas; nothing persisted or transmitted changes. |
| T-KVW-SC | Tampering | package installs | high | mitigate | No package is installed by this quick and no runtime dependency is added; app/src/lib/railMotionDependencySurface.test.ts (REL-01) stays green. |
</threat_model>

<verification>
- pnpm --filter efx-motion-editor run typecheck
- pnpm --filter efx-motion-editor exec vitest run (full suite; vitest run only, never watch)
- Targeted: src/components/physic-paint/roto/railMotionPath.test.ts, src/components/physic-paint/view/RailMotionPathOverlay.test.ts, src/components/physic-paint/hooks/useRotoTimelineActions.test.ts
- No .test.tsx file is added (vitest collects only .test.ts); no dev server is started.
- Re-read the pinned contract tests after the hook edit: railMotionBoundaryTool.test.ts gizmo strings, timelineMotionSurface.contract.test.ts railMotionViewFrameCount import, PhysicsPaintStudio.test.ts canvasStackPropsMemo and rail-motion paint-blocker strings, railMotionCommands.test.ts mount gate — all must pass unchanged.
</verification>

<success_criteria>
- ANIMATE mode with an open motion block and a Position channel draws a dashed #4A90D9 polyline of the authored route, dots at position motion-key frames, and one distinct marker at the cursor — inside the existing rail-motion SVG, behind the handles, pointer-events none.
- Wiggle on leaves the path and marker fixed while the box shakes; the probe record is the only evaluation source and the evaluator is untouched.
- Sampling includes every integer frame within the stride budget, every position key frame and every snap frame; the total never exceeds 2000 for any input (authored frames outrank the grid, and an over-cap authored set is decimated deterministically to exactly 2000), with frame 0 and the span tail always present; the path is computed once per edit and reused while scrubbing.
- The overlay is absent without gizmo context, without a Position channel, outside the span marker-wise, for identity routes, and outside ANIMATE mode.
- No schema, store setter, command, persisted field, package format, Rust code or golden fixture changes; the hook keeps one evaluateRailMotion call and the accessor pin moves 6 to 7 deliberately.
- Typecheck and the full vitest run pass; every pre-existing pinned contract test passes unchanged.
</success_criteria>

<output>
Create .planning/quick/261108-kvw-canvas-motion-path-overlay-for-rail-posi/261108-kvw-SUMMARY.md when done.
</output>
