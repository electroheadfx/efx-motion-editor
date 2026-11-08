---
phase: 261108-kvw-canvas-motion-path-overlay-for-rail-posi
verified: 2026-11-08T14:45:42Z
status: passed
score: 7/7 must-haves verified
covered_files: [".planning/quick/261108-kvw-canvas-motion-path-overlay-for-rail-posi/261108-kvw-PLAN.md", ".planning/quick/261108-kvw-canvas-motion-path-overlay-for-rail-posi/261108-kvw-SUMMARY.md", "app/src/components/physic-paint/PhysicsPaintStudio.tsx", "app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts", "app/src/components/physic-paint/hooks/useRotoTimelineActions.ts", "app/src/components/physic-paint/roto/railMotionPath.test.ts", "app/src/components/physic-paint/roto/railMotionPath.ts", "app/src/components/physic-paint/view/PhysicsPaintReferenceTransformHandles.tsx", "app/src/components/physic-paint/view/RailMotionPathOverlay.test.ts", "app/src/components/physic-paint/view/RailMotionPathOverlay.tsx"]
covered_digest: "v4:sha256:992a0f468371594f3733a7bc150a213d1e238c54e1dd3b7995807d872c919f13"
behavior_unverified: 0
overrides_applied: 0
---

# Quick 261108-kvw: Canvas Motion-Path Overlay for Rail Position — Verification Report

**Task Goal:** Add a READ-ONLY canvas motion-path overlay for the rail's Position channels: while a rail's Motion is being edited in ANIMATE mode, draw the spatial path the rail's Position channels trace over the rail span.
**Verified:** 2026-11-08T14:45:42Z
**Status:** passed
**Verification Mode:** initial (no prior `261108-kvw-VERIFICATION.md` existed)
**Baseline:** `0e19eb0f9` → HEAD `4893ee9ee` (3 commits: `e2e0f19a2`, `e8376d9eb`, `4893ee9ee`)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | In ANIMATE mode with an open motion block and a Position channel, the canvas shows a READ-ONLY dashed path of the authored Position route: one polyline sampled from the ONE evaluator, dots at position motion-key frames, and one distinct cursor marker; rail selection is not required (open block + selected non-opacity lane is the context, exactly like the gizmo) | ✓ VERIFIED | `useRotoTimelineActions.ts:2745-2786` — `railMotionPath` gates on an open block (`getMotionBlockRailIdentity`), a selected non-opacity lane (`railMotionSelectedChannel`), `record !== null` and `resolveMotionChannelPresence(...).position`, never on `readSelectedRailIdentity`. It samples through `sampleRailMotionPathCached`. Overlay render test pins one polyline, one dot per key frame and one marker (`RailMotionPathOverlay.test.ts:182-223`); hook hide/behavior rows pass (7/7 filtered). The gizmo mount is the sole canvas context (`PhysicsPaintStudio.tsx:10111-10125`). |
| 2 | The path is the AUTHORED route, never the wiggled display: sampling evaluates a frozen probe whose channel wiggle and every key wiggle are 0, so with wiggle on the polyline stays fixed while the box shakes; the marker uses the same probe | ✓ VERIFIED | `railMotionPath.ts:99-142` — `zeroRailMotionWiggle` returns the record by reference when wiggle-free, else a frozen clone with channel and key wiggle forced to 0 (`wiggleGlobal` kept, irrelevant at zero). `railMotionPath.ts:277` samples only that probe; `evaluateRailMotionPathCursor` (`:403-420`) evaluates `evaluation.authoredRecord`. Evaluator's wiggle branches (`railMotionEvaluator.ts:253-262`) add 0 when wiggle is 0. Behavioral test: `railMotionPath.test.ts:331-352` asserts byte-identical serialized samples vs a wiggle-free twin while `evaluateRailMotion` on the RAW record differs at the same frames. |
| 3 | Sampling covers every integer rail-local frame in a stride budget PLUS every position motion-key frame and every stop-motion snap frame (deduped, sorted), under a HARD cap of 2000 for EVERY input: authored frames outrank the grid, an over-cap authored set is deterministically decimated to exactly 2000 with frame 0 and frameCount-1 always present (tail never truncated); the sample list is a one-entry identity cache keyed on record, railId, span start, frame count, snap-list reference and pivotX/pivotY | ✓ VERIFIED | `railMotionPath.ts:178-216` — required set = `{0, lastFrame}` + position key frames + snap frames (clamped, `Set`-deduped, sorted); branch (a) `required.length <= 2000` fills `interiorBudget` with `stride = max(1, ceil((frameCount-2)/budget))` (grid count `floor((frameCount-2)/stride) <= budget`), branch (b) `required.length > 2000` returns `required[Math.round(out*(required.length-1)/1999)]` for `out` 0..1999 with no grid points. Cache `:354-396` compares `record, railId, startFrame, frameCount, snapFrames` (reference), `pivotX, pivotY` with `Object.is`. Tests: key frames exact and unioned across axes (`:267-286`), stop-motion repeated poses stepping only at snaps (`:288-309`), 5001-frame span capped with first 0 / last 5000 (`:311-329`), over-cap 4097 authored frames → exactly 2000, first 0 / last 4999, deterministic (`:396-427`), cache identity/rebuild (`:354-394`). |
| 4 | Reactivity obeys efx-preact-reactivity: no useState, no render-body signal writes, narrow reads. The static path comes from a computed that never reads the playhead and never calls `getCurrentAppFrame`; only the separate cursor computed reads it. The static geometry (`d`, dots, stroke/dot radii, dash) is memoized on the path bundle plus project size and zoom, so only the marker is recomputed while scrubbing | ✓ VERIFIED | New modules contain no hooks/signals: `grep` for `useState|useEffect|useSignal|useMemo|useCallback` and `.value =` in `railMotionPath.ts` / `RailMotionPathOverlay.tsx` → no matches; the overlay source pin also asserts no store/signal/hook surface (`RailMotionPathOverlay.test.ts:233-238`). `railMotionPath` (`useRotoTimelineActions.ts:2745-2786`) contains neither `getCurrentAppFrame` nor `localCursorFrame` (asserted by the source pin `useRotoTimelineActions.test.ts:6432-6445`) and a counting mock proves zero frame reads on `.value` vs exactly one for `railMotionPathCursor` (`:6287-6308`). Static model cache keyed on bundle reference + `projectWidth/Height/zoom` (`RailMotionPathOverlay.tsx:75-129`); test proves `d`/dots/radii identical across two cursors while only the marker changes (`RailMotionPathOverlay.test.ts:148-173`). |
| 5 | The overlay lives inside the SAME SVG layer as the rail-motion transform handles, rendered FIRST so it sits behind the polygon and handles, with `pointer-events: none` on the group and every child (no handlers); dashed 1.5px line using the EXISTING rail-motion accent `#4A90D9` from ONE exported constant shared with the handles | ✓ VERIFIED | `PhysicsPaintReferenceTransformHandles.tsx:668` renders `<RailMotionPathOverlay />` as the FIRST child of the existing rail-motion `<svg>` (before the polygon at `:669`); every one of the five former `#4A90D9` literals now imports `RAIL_MOTION_PATH_ACCENT` (`:672, 694, 704, 730, 744`; grep finds zero remaining literals in the file) and the constant is defined once at `RailMotionPathOverlay.tsx:30`. Root `<g>` carries `style={{ pointerEvents: 'none' }}` plus `pointerEvents` on every path/circle and no handlers (`:183-224`). Render test asserts root style, per-child style, and absence of any `on*` prop (`RailMotionPathOverlay.test.ts:182-223`); strokeWidth is `1.5/zoom`, the same screen-sized convention as the handles' `strokeWidth = 1.5 / zoom` (`PhysicsPaintReferenceTransformHandles.tsx:382`). |
| 6 | The overlay hides entirely when there is no gizmo context (no selected/open rail, opacity lane, closed block), the record has no Position channel, the span is shorter than two frames, or every sampled point is the same (identity); it renders identically whether or not the Motion sheet is open, and is absent outside ANIMATE mode | ✓ VERIFIED | Hook gates: no context/railId → null (`:2748`), closed block → null (`:2751-2754`), null/opacity lane → null (`:2755-2756`), no Position presence → null (`:2758`). Module: null record / no Position / `frameCount < 2` / all points within `1e-6` → null (`railMotionPath.ts:264-304`). Hook behavioral rows cover cleared lane, opacity lane, closed block, no Position channel, identity route and marker outside the span (`useRotoTimelineActions.test.ts:6310-6382`); module rows cover short span and identity (`railMotionPath.test.ts:146-167`). The computed reads no dialog/sheet signal and no selected-rail requirement, so the route is sheet-independent; ANIMATE mode is exactly a non-null, non-opacity `railMotionSelectedChannel` (`railMotionEditingMode.ts:1-47`), and nothing extends the overlay to passive/outside-animate states. |
| 7 | Hard non-goals hold: no draggable path points, bezier handles or tangent model; no schema, package-format, Rust or golden-fixture change; no new store setter, command or persisted field; `railMotionEvaluator`, easing laws, wiggle math, compositor transform, lane curve, snap-frame memo and pivot/ink geometry untouched; the hook keeps exactly ONE textual `evaluateRailMotion(` occurrence and the snap accessor pin moves 6 → 7 deliberately | ✓ VERIFIED | `git diff --name-only 0e19eb0f9..HEAD` is exactly the 8 planned files; evaluator/model/pivot/store/Rust/golden files untouched. Overlay registers no handlers (test-enforced) and exposes no pointer targets. Hook imports only existing store getters; no store, command, schema or persisted-field change exists in the diff. `grep -c "evaluateRailMotion(" useRotoTimelineActions.ts` = 1 (the gizmo's) and the source contract asserts 1 (`useRotoTimelineActions.test.ts:6414-6420`); the accessor count assertion is 7 with the deliberate comment (`:6422-6430`) and passes. |

**Score:** 7/7 truths verified (0 present, behavior-unverified)

All behavior-dependent truths (wiggle neutrality, sampling cap/tail, hide rules, cursor/static separation) are backed by passing behavioral tests, not merely symbol presence, so none is ⚠️ PRESENT_BEHAVIOR_UNVERIFIED.

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `app/src/components/physic-paint/roto/railMotionPath.ts` | Pure authored-path sampling: `zeroRailMotionWiggle`, `sampleRailMotionPath`, `sampleRailMotionPathCached`, `evaluateRailMotionPathCursor`, `buildRailMotionPathD`, `placeRailMotionPathPoint`, types | ✓ VERIFIED | NEW, 471 lines. Imports only the evaluator + model type (no Preact/signal/store/DOM). All listed exports present; consumed by the hook (cached sampler + cursor) and the overlay (D builder + placement). 14 tests pass. |
| `app/src/components/physic-paint/view/RailMotionPathOverlay.tsx` | Hooks-free overlay leaf plus `resolveRailMotionPathRenderModel` and `RAIL_MOTION_PATH_ACCENT` | ✓ VERIFIED | NEW, 225 lines. Exports the one accent constant, the render model, the resolver and the leaf; imported by the handles (overlay + accent + resolver). 8 tests pass. |
| `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts` | `readActiveRailMotionContext` split, cursor-free `railMotionPath`, cursor-owned `railMotionPathCursor`, both exposed on the return | ✓ VERIFIED | MODIFIED: context split preserves the prior cursor semantics (state = spread of context + identical `cursorFrame`/`localCursorFrame`), both computeds added at `:2745-2801` and returned at `:5230-5235`. 216 tests pass, including the cursor-free behavioral pin and hide rules. |
| `app/src/components/physic-paint/PhysicsPaintStudio.tsx` | Reads both computeds, adds the path signature to the canvas-stack memo deps, passes `motionPath`/`motionPathCursor` on the rail-motion envelope | ✓ VERIFIED | MODIFIED: `:9921-9923` reads both and adds `railMotionPathForCanvas?.path.signature ?? null` as a memo dep (existing deps retained); `:10123-10124` adds both fields to the `railMotionTransformHandles` envelope. `PhysicsPaintStudio.test.ts` 339 tests pass. |
| `app/src/components/physic-paint/view/PhysicsPaintReferenceTransformHandles.tsx` | Optional `motionPath`/`motionPathCursor` props, overlay rendered first inside the existing SVG, accent literals replaced by the shared constant | ✓ VERIFIED | MODIFIED: optional props at `:148-153` (legacy props untouched); model resolved only for `'rail-motion'` after the availability gate (`:336-349`); overlay first child of the SVG (`:668`); all five accent literals now expressions. Boundary-tool and timeline-surface contract tests pass unchanged. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `useRotoTimelineActions.ts` | `roto/railMotionPath.ts` | `railMotionPath` calls `sampleRailMotionPathCached` once per edit; `railMotionPathCursor` calls `evaluateRailMotionPathCursor` with the probe | WIRED | Imports at `:143-151`; calls at `:2777` and `:2800`; behavioral tests prove a non-null bundle with zero frame reads and a marker from exactly one read. |
| `roto/railMotionPath.ts` | `roto/railMotionEvaluator.ts` | Every sample is `evaluateRailMotion(probe, frame, snapFrames).translateX/translateY` — no interpolation math of its own | WIRED | Sole evaluator import in the module (`:34`); sample loop `:286-293`; cursor `:410-414`; the hook retains exactly one textual `evaluateRailMotion(` (the gizmo's). |
| `PhysicsPaintStudio.tsx` | `view/PhysicsPaintStudioView.tsx` | `railMotionTransformHandles.motionPath` / `motionPathCursor` ride the existing envelope into the handles | WIRED | Envelope fields set at `PhysicsPaintStudio.tsx:10123-10124`; view spreads the whole envelope at `PhysicsPaintStudioView.tsx:412` (`<PhysicsPaintReferenceTransformHandles {...props.railMotionTransformHandles} />`). |
| `view/PhysicsPaintReferenceTransformHandles.tsx` | `view/RailMotionPathOverlay.tsx` | `resolveRailMotionPathRenderModel(path, cursor, projectWidth, projectHeight, zoom)` then the leaf renders inside the existing SVG | WIRED | Resolver import `:39-42`, call `:341-349` with the same `imageSize` the bounds use (project size = `width/zoom`, so placement equals `getRailMotionBounds(...).center`), leaf at `:668`. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `useRotoTimelineActions.ts` | `railMotionPath` bundle (samples, keyFrames, pivot) | `getRotoPhysicalRailMotions` records + memoized `getRotoRailMotionSnapFrames` + `getRotoRailMotionCanvasInk` pivot, sampled through `evaluateRailMotion` | Yes — real rail records and compositor pivot; cache re-resolves on the track-revision subscription and the content revision | ✓ FLOWING |
| `RailMotionPathOverlay.tsx` | polyline `d`, dots | Path bundle sample list → `placeRailMotionPathPoint` → `buildRailMotionPathD` | Yes — evaluator-authored coordinates, not a static literal | ✓ FLOWING |
| `RailMotionPathOverlay.tsx` | cursor marker | `railMotionPathCursor` ← `input.getCurrentAppFrame` → `evaluateRailMotionPathCursor` on the same probe | Yes — real playhead, clamped to the span; null outside it | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Sampling + overlay render suites | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/railMotionPath.test.ts src/components/physic-paint/view/RailMotionPathOverlay.test.ts` | 2 files / 22 tests passed (14 + 8) | ✓ PASS |
| Hook suite (split + new computeds + source pins) | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/hooks/useRotoTimelineActions.test.ts` | 1 file / 216 tests passed | ✓ PASS |
| New hook describe (`261108-kvw canvas motion path`) | same file, `-t "261108-kvw canvas motion path"` | 7 passed / 209 skipped | ✓ PASS |
| Source contract pins (`261108-d5o hook source contract`) | same file, `-t "261108-d5o hook source contract"` | 4 passed / 212 skipped (one `evaluateRailMotion(`, accessor 7, cursor-free body pins) | ✓ PASS |
| Pinned contract regressions | `vitest run` on `PhysicsPaintStudio.test.ts`, `railMotionCommands.test.ts`, `timelineMotionSurface.contract.test.ts`, `railMotionBoundaryTool.test.ts` | 4 files / 468 tests passed (339 + 110 + 14 + 5) | ✓ PASS |
| Typecheck | `pnpm --filter efx-motion-editor run typecheck` (`tsc --noEmit`) | exit 0, no diagnostics | ✓ PASS |
| Full TypeScript suite | `pnpm --filter efx-motion-editor exec vitest run` | 403 files passed / 2 skipped (405); 8222 tests passed / 1 skipped / 96 todo / 0 failed | ✓ PASS |
| Debt-marker / placeholder scan | `grep -nE "TODO\|FIXME\|XXX\|TBD\|HACK\|PLACEHOLDER\|coming soon\|not yet implemented"` over the changed files | no matches | ✓ PASS |
| Disabled/skipped test scan | `grep -nE "\.skip\(\|\.only\(\|describe\.skip\|it\.skip\|test\.skip\|xit\(\|xdescribe\("` over changed test files | no matches | ✓ PASS |
| Scope confinement | `git diff --name-only 0e19eb0f9..HEAD` vs PLAN `files_modified` | 8 files, exact match; no Rust, golden fixture, schema, store or package-format file | ✓ PASS |

### Probe Execution

Not applicable — the task declares no `scripts/*/tests/probe-*.sh` and is not a migration/tooling phase; no probe claim appears in PLAN or SUMMARY.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| QUICK-261108-KVW | `261108-kvw-PLAN.md` | READ-ONLY canvas motion-path overlay for rail Position: authored-route polyline, key dots, cursor marker, ANIMATE-only, hard 2000-sample cap, cursor-free static path | ✓ SATISFIED | All 7 must-have truths verified and backed by passing behavioral tests; no milestone `REQUIREMENTS.md`/`ROADMAP.md` mapping exists for this quick-task ID (expected for a quick task), so this is fully satisfied by the plan's own contract. No orphaned requirement IDs map to this task. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | No debt markers, empty implementations, hardcoded-empty props, console-only handlers or disabled tests in the changed files | — | None |
| `app/src/components/physic-paint/view/RailMotionPathOverlay.tsx` | 90-100 | A position key frame decimated away by the over-cap authored branch draws no dot (documented in the comment and pinned by test) | ℹ️ Info | Intentional and required by the hard 2000-sample cap; the test asserts "no dot, never a mis-placed dot". Not a gap. |
| `app/src/components/physic-paint/roto/railMotionPath.ts` | 247-253 | Sampling and key dots cover the Position channels' key frames only; a rotation/scale/opacity-only key adds no sample and no dot | ℹ️ Info | Matches the plan's authored-route law (the route is defined by Position X/Y; a non-position key lies on the same interpolated segment and would add no route information). Sampling still evaluates the full record at every collected frame. Not a gap. |

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
|-----------|-----------|--------|---------|----------|-----------------|---------|
| `app/src/components/physic-paint/roto/railMotionPath.test.ts` | KVW-2 (sampling law) | 14 | 0 | No — expected values from hand-derived linear math; `getRailMotionBounds` used as an independent convention oracle | Value + Behavioral | PASS |
| `app/src/components/physic-paint/view/RailMotionPathOverlay.test.ts` | KVW-1 (render) | 8 | 0 | No — vnode walk plus source-text purity pins | Value + Behavioral | PASS |
| `app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts` (new describes) | KVW-3 (cursor separation, hide rules) | 7 + 4 | 0 | No — counting `getCurrentAppFrame` mock and source-body pins | Behavioral | PASS |

**Disabled tests on requirements:** 0.
**Circular patterns detected:** 0.
**Insufficient assertions:** 0.

### Decision Coverage

Not applicable — this is a quick task; no CONTEXT.md with `<decisions>` exists for it.

### Human Verification Required

None blocking. Per the task's explicit scoping, live visible UAT is the user's own completion gate and is NOT part of this verification. The six live UAT rows recorded in `261108-kvw-SUMMARY.md:77-83` (dashed path start-to-end, curved ease path, stop-motion stepping, wiggle stability, pointer pass-through while painting/dragging, disappearance on deselect/leave animate) remain outstanding on the user's side; automated completion is not live sign-off.

### Gaps Summary

No gaps. The authored Position route overlay is present, substantive and wired end-to-end: the pure sampler derives every point from the ONE evaluator through a wiggle-zeroed frozen probe, keeps a hard 2000-sample cap with both span ends always present, and is cached by input identity; the hook splits the motion read so the static route is provably cursor-free while only the marker follows the playhead; the handles SVG renders the dashed `#4A90D9` polyline (behind the polygon, pointer-events none on group and children) with one dot per surviving position key frame and a distinct cursor marker. The overlay is confined to ANIMATE mode with an open block and a Position channel; the diff is confined to the plan's 8 files with no schema, store, command, Rust or golden-fixture change; the hook keeps exactly one `evaluateRailMotion(` and the snap accessor pin moved 6 → 7 deliberately. Typecheck, the full vitest suite (403 files / 8222 tests) and every named contract suite pass.

---

_Verified: 2026-11-08T14:45:42Z_
_Verifier: Claude (gsd-verifier)_
