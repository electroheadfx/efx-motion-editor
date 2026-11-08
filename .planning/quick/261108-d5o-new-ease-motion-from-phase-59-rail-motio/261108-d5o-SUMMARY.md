---
phase: 261108-d5o-new-ease-motion-from-phase-59-rail-motio
plan: 01
subsystem: rail-motion
tags: [rail-motion, easing, stop-motion, linear, snap-frames, memoization, motion-sheet, quick-task]
requires:
  - phase: 59-rail-motion-channels-v7-interface
    provides: Rail-motion model/evaluator/commands/store/hook/view stack, canonical TS↔Rust encoder and golden fixture, Motion sheet and tool-strip easing surface
  - phase: 261107-ux2-rail-motion-first-span-never-interpolate
    provides: Add-channel opening seed law (superseded here for the easing token only)
provides:
  - Four easing tokens (linear, hold, ease, stop-motion) accepted, persisted and canonically encoded in TS and Rust
  - Stop-motion creation default that samples the linear ramp only at displayed real paint-key frames
  - One bounded snap-frame memo per rail + span + capacity + raster revision, threaded to the compositor, Studio transform, gizmo, lane curve and every derived key seed
  - keylessSiblingSeed reducer field so easing/wiggle edits seed the paired axis with the displayed sample
  - One shared four-glyph easing control rendered by both the tool strip and the key-mode Motion sheet row
  - One applySetMotionKeyEasing write authority shared by both easing surfaces
affects: [59-rail-motion-channels-v7-interface, rail-motion UAT, Motion sheet, tool strip]
actuals:
  tokens: 46325
  tasks: 4
  commits: 4
  plan_head_before: bbfbaff7474d340eb93dd90b9d92dbc6def3a092
  plan_head_after: 86cea6ebd1bb7e320fadbb1dc6d48ca0dea19c6a
tech-stack:
  added: []
  patterns:
    - "ONE interpolation authority: the evaluator receives the displayed-real frame set as DATA; the store memoizes the resolver per rail + raster revision"
    - "Derived-value creation paths consume the memoized displayed sample, so inserting a Motion key never moves the pose"
    - "One shared pure control + one extracted write helper serve both easing surfaces"
key-files:
  created:
    - app/src/components/physic-paint/roto/railMotionSnapFrames.ts
    - app/src/components/physic-paint/roto/railMotionSnapFrames.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintRailMotionEasingControl.tsx
    - app/src/components/physic-paint/view/PhysicsPaintRailMotionEasingControl.test.ts
  modified:
    - app/src/components/physic-paint/roto/railMotionModel.ts
    - app/src/components/physic-paint/roto/railMotionEvaluator.ts
    - app/src/components/physic-paint/roto/railMotionCommands.ts
    - app/src/stores/physicPaintStore.ts
    - app/src/components/physic-paint/hooks/useRotoTimelineActions.ts
    - app/src/components/physic-paint/view/TimelineMotionChannels.tsx
    - app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
    - app/src/components/physic-paint/view/PhysicsPaintRailMotionModal.tsx
    - app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.ts
    - app/src/components/physic-paint/physicsPaintStudio.css
    - app/src-tauri/src/services/script_library.rs
    - app/src/lib/__fixtures__/railMotionCanonical.golden.json
key-decisions:
  - "stop-motion is the creation default (DEFAULT_RAIL_MOTION_EASING); stored keys are never rewritten or migrated"
  - "Stop-motion samples the raw LINEAR ramp at the greatest displayed real paint-key frame at or before the current frame, and holds between samples; with no snap list it falls back to the outgoing key (byte-identical to hold)"
  - "The snap list is keyed by railId:startFrame:endFrameExclusive:capacity:rasterRevision (PIXEL identity), so motion-only edits keep the same frozen array and paint edits invalidate it"
  - "The reducer never re-implements the ramp: applyAxisMotionKeyEdits computes keylessSiblingSeed through the evaluator and passes it as data"
  - "The Motion sheet's easing row exists only in key mode; property-only mode renders no row (not even disabled)"
requirements-completed: [QUICK-261108-D5O]
coverage:
  - id: D1
    description: "linear and stop-motion are accepted, persisted and canonically encoded by the TS parser/validator, the Rust validator and both canonical encoders; the shared golden fixture carries both tokens."
    requirement: QUICK-261108-D5O
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/railMotionModel.test.ts#exposes the four easing tokens in order and stop-motion as the creation default"
        status: pass
      - kind: unit
        ref: "app/src/lib/railMotionCanonicalParity.test.ts#freezes both new easing tokens in the eighth document"
        status: pass
      - kind: unit
        ref: "app/src/lib/railMotionPackageRoundTrip.test.ts (5), app/src/lib/railMotionExportParity.test.ts (17)"
        status: pass
      - kind: unit
        ref: "cargo test --manifest-path app/src-tauri/Cargo.toml script_library::tests#canonical_rail_motions_accepts_linear_and_stop_motion_tokens (24 passed)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Stop-motion samples the linear ramp only at displayed real paint keys and holds between them; the exact oracle 0,0,2,2,4,4,6 is pinned; linear is a raw ramp; hold/ease/linear ignore the snap list; the dispatch is an exhaustive never switch."
    requirement: QUICK-261108-D5O
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/railMotionEvaluator.test.ts (stop-motion oracle, linear raw-ramp, snap-outside-span, wiggle-constant rows)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/railMotionModel.test.ts (evaluator-level stop-motion rows)"
        status: pass
      - kind: unit
        ref: "app/src/lib/railMotionExportParity.test.ts#reads a Linear outgoing key as a raw ramp, never as smoothstep (50 at frame 5, not 54.6875)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The snap list is resolved once per rail + raster revision (same reference across a motion-only edit, invalidated by a paint edit) and reaches the compositor/Studio transform, the canvas gizmo and the lane curve; source pins prove one resolver call site and one accessor source."
    requirement: QUICK-261108-D5O
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/railMotionSnapFrames.test.ts (memo identity, eviction, reset, predicate kinds, fail-closed)"
        status: pass
      - kind: unit
        ref: "app/src/stores/physicPaintStore.rotoRailMotions.test.ts (render-source parity, motion-edit identity, paint-edit invalidation, snapping transform, ONE resolver call + TWO callers)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts#snaps the canvas gizmo to the displayed real keys and folds the count into the signature"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/TimelineMotionChannels.test.ts#forwards the host-resolved snap list into the curve sampler (261108-d5o)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts#261108-d5o snap-frame host plumbing"
        status: pass
      - kind: unit
        ref: "app/src/lib/railMotionExportParity.test.ts#stop-motion and linear compositing (261108-d5o)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every derived-seed creation path consumes the displayed sample, so inserting a Motion key at frame 3 leaves the frame-3 transform identical on both Position axes before and after the insert."
    requirement: QUICK-261108-D5O
    verification:
      - kind: unit
        ref: "app/src/lib/railMotionExportParity.test.ts#leaves the displayed pose identical when a Motion key is inserted at the displayed frame (x 3 / y 30 before and after; translate op args identical)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/railMotionCommands.test.ts (setMotionKeyAtCursor seed, keyless paired axis displayed seed, easing/wiggle sibling seed rows)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/railMotionModel.test.ts#set-key reducer honors keylessSiblingSeed; pairedValue still wins; step fallback unchanged"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts#261108-d5o snap-frame threading through the hook (gizmo + 5 write callbacks)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Both the tool strip and the key-mode Motion sheet render ONE shared four-glyph control (linear <>, hold [], ease (), stop-motion =) with word accessible names, aria-pressed, disabled/describedby wiring and titles; the sheet row is absent in property-only mode; both surfaces commit through one applySetMotionKeyEasing call site."
    requirement: QUICK-261108-D5O
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintRailMotionEasingControl.test.ts (8 direct-render rows including purity)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintRailMotionModal.test.ts#renders the shared easing control ONLY in key mode and selects through the bundle (261108-d5o)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts#a motion-key scope renders the shared four-glyph easing control and the Wiggle field"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts#routes both easing surfaces through ONE write authority (261108-d5o)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Live visible UAT in the native app: stop-motion stepping at drawn frames, insert invariance at the insert frame, all four glyphs from both surfaces, sheet row presence/absence, lane staircase, loop occurrences, and old-project easing preservation."
    requirement: QUICK-261108-D5O
    verification: []
    human_judgment: true
    rationale: "The sampled step cadence, the painted pose at the insert frame and the drawn staircase can only be judged in the running Studio; automated green is not done."
metrics:
  duration: ~1h 30m (approx, across two executor segments)
  completed: 2026-11-08
status: complete
---

# Quick 261108-d5o: New Ease Motion from Phase 59 Rail Motion — Summary

**The rail-motion easing set is now four tokens with `stop-motion` as the creation default: a stop-motion key samples the raw linear ramp only at displayed real paint-key frames and holds between them, the displayed frame set is memoized once per rail + raster revision and threaded to every stepped consumer, every derived key seed takes the displayed value so inserting a key never moves the pose, and both easing surfaces share one four-glyph control and one write authority.**

## Performance

- **Duration:** ~1h 30m (approximate; execution spanned two executor segments)
- **Completed:** 2026-11-08T10:54:09+01:00 (final task commit)
- **Tasks:** 4
- **Files changed:** 30 (4 created, 26 modified)
- **Commits:** 4 (one per task; each combined its RED assertions and production change — see TDD Evidence)

## Accomplishments

### Task 1 — Four-token model and persistence (`268fc5dc7`)

- `railMotionModel.ts:31` widens `PhysicPaintRotoRailMotionEasing` to `'linear' | 'hold' | 'ease' | 'stop-motion'`; `RAIL_MOTION_EASING_ORDER` (:144) lists them linear, hold, ease, stop-motion; `DEFAULT_RAIL_MOTION_EASING = 'stop-motion'` (:156); `isRailMotionEasing` (:189) is the parser/validator gate.
- Rust validation widened at `app/src-tauri/src/services/script_library.rs:1726` to accept exactly the four tokens; the canonical encoder stays generic (`s6:linear` / `s11:stop-motion` byte shapes are asserted, not special-cased).
- The golden fixture gained its EIGHTH frozen document `rail-motion-easings`: revision `physical-1464-ee0023fc`, expected project equality `project-1590-f060145d`, TS-derived source containing `s6:linear` and `s11:stop-motion`. The seven prior entries were not regenerated and their expected values did not move; both language name pins now list eight names (`railMotionCanonicalParity.test.ts:128-134`, `script_library.rs:3322-3336`).
- The four creation-path default seeds now write `stop-motion`: `upsertRailMotionKey` new key (`railMotionModel.ts:571`), animate seed (:627), keyless sibling seed (:696) and add-channel seed (:820). No load-time rewrite and no stored-key coercion exist: `parsePhysicPaintRotoRailMotions` accepts the token set but keeps every stored easing verbatim.
- Pin flips (creation-path defaults/surfaces only): `railMotionModel.test.ts` helper default and the invalid-token row; the add-channel seed assertions; the two 261107-ux2 first-span regressions; `railMotionEvaluator.test.ts` key helper type; `railMotionCommands.test.ts` invalid token and `identitySeed`; `useRotoTimelineActions.test.ts` creation seed pins. Pre-existing-record fixtures were left authored as stored.

### Task 2 — Evaluator stop-motion law and lane staircase (`2d24994dd`)

- `resolveRailMotionSegment` is an explicit exhaustive `switch` whose default is `const exhaustive: never = target`, so no token can fall through into smoothstep. `linear` returns the raw ramp `value + (next.value - value) * t`; `hold` steps; `ease` is smoothstep; `stop-motion` picks `sampleFrame = greatestRailMotionSnapAtOrBefore(snapFrames, current.frame, frame) ?? current.frame` and uses the linear ramp at that frame.
- Exact oracle pinned literally at rail frames 0..6 for stop-motion keys 0→0 and 6→6 over paint-key frames 0/2/4/6: **0,0,2,2,4,4,6**. Motion keys and paint keys are independent; a snap outside the outgoing span is ignored; a snap frame interior to no span leaves hold semantics; hold/ease/linear ignore the list; wiggle is constant across a snapped step.
- The lane curve (`buildRailMotionCurvePath`) accepts `{ railId, snapFrames }` and emits a left-limit point at every snap inside a stop-motion span, drawing a staircase that steps where the canvas steps. Empty/undefined lists are byte-identical.

### Task 3 — One memoized snap list, threaded to every stepped consumer (`049111185`)

- New pure `railMotionSnapFrames.ts` (relative imports only): request `{ railId, startFrame, endFrameExclusive, capacity, rasterRevision, loopClips, realKeyRecords, loopResolution }`, shared frozen `RAIL_MOTION_SNAP_FRAMES_EMPTY`, bounded FIFO memo (cap 512) keyed `railId:startFrame:endFrameExclusive:capacity:rasterRevision`, frozen entries, test reset hook. The classifier document is built once per MISS only; the predicate uses `classifyPhysicPaintRotoGroupFrameTarget` (override/source-occurrence/ordinary-key real; generated-occurrence/group-gap/ambiguous-group/unresolved-group not) with the loop-resolution fallback for `empty`, and never calls the render-source accessor.
- Store: `_resolveTrackSnapFramesForRecord` (`physicPaintStore.ts:1345`, resolver call :1351) is the ONLY lexical `resolveRailMotionSnapFrames(` call site and has exactly TWO call expressions: `_trackMotionTransformAtFrame` (:1392, evaluating at :1393) and `getRotoRailMotionSnapFrames` (:3907/:3919). Records without a stop-motion key return the empty list without scanning (not memoized, so a later easing edit is observed).
- Consumers threaded and tested: compositor/Studio transform (export parity + store rows), the canvas gizmo (`useRotoTimelineActions.ts:2609` accessor, :2614 evaluation, :2682 signature gains `String(snapFrames.length)`), and the lane curve (lane prop `snapFrames`, hosts resolve once per row/strip and pass down). The six hook accessor reads are :2609 gizmo, :3020 setMotionKeyAtCursor, :3137 commitRailMotionInspectorValue, :3208 reset (one read reused for every field), :3268 easing helper, :3419 wiggle.
- Seeding audit (every derived-seed path receives the memoized list as DATA; the command layer never imports the store):

| Path | Site | Threaded? |
|---|---|---|
| Add-key default seed | `railMotionCommands.ts:431` (evaluator third arg) | Yes |
| Grouped-Position sibling fallback | `railMotionCommands.ts:444` | Yes |
| Numeric-field sibling fallback + forwarded seed | `railMotionCommands.ts:1220`, :1230 | Yes |
| Easing/wiggle keyless sibling seed | `railMotionCommands.ts:668` param, :698 evaluation, :708 edit field | Yes |
| Reducer keyless fallback | `railMotionModel.ts:696` (`pairedValue ?? keylessSiblingSeed ?? step`) | New field |
| Exact-key reads (stepped and continuous agree) | `resolveMotionKeyAtFrame` (:363), `axisKey.value`, `railMotionStepValueAt` fallback (:508), animate seed (:627), add-channel seed (:820), `upsertRailMotionKey`, `applyMoveKeyEdit` | Legitimately need nothing |

- Insert invariance measured on the export-parity fixture (paint keys 0/3/6, stop-motion Position X 0→0/6→6, Y 0→0/6→60, snap list [0,3,6]): applied frame-3 transform is `translateX = 3`, `translateY = 30` BEFORE the insert; `setMotionKeyAtCursor` with no explicit value/pairedValue writes stored keys x@3 = 3, y@3 = 30; the AFTER transform is identical on both axes and the compositor `translate` op args are exactly equal. Without threading the seeds would be 0/0 and the row fails by construction.
- Source pins on the property, not the prose: exactly ONE resolver call site in the store, exactly TWO helper callers; the hook contains `physicPaintStore.getRotoRailMotionSnapFrames(` as its only frame-list source, no `railMotionSnapFrames` import, no `resolveRailMotionSnapFrames`, and its single `evaluateRailMotion(` call passes `snapFrames` third; the lane obtains the list only from props.
- Pin-drift fix: the keyless-paired-axis row in `railMotionCommands.test.ts` moved from the Hold-step seed `0` to the DISPLAYED sample `25` (and the seeded key's easing from `ease` to the creation-default `stop-motion`), because the old pin asserted the exact defect the user decision removes.

### Task 4 — Per-key easing in the Motion sheet and one shared glyph control (`86cea6ebd`)

- New pure, hook-free `PhysicsPaintRailMotionEasingControl.tsx`: four buttons in `RAIL_MOTION_EASING_ORDER`, ASCII glyphs `<>` `[]` `()` `=`, each glyph `aria-hidden`; word names "Linear/Hold/Ease/Stop motion key"; `aria-pressed` on the current token only; `aria-disabled`/`aria-describedby` only while disabled (description only when a reason id is supplied); a title naming each easing; `data-rail-motion-easing={token}`; disabled controls never call `onSelect`. Its 8-row direct-render suite invokes it directly and pins purity (no store, signal, hook or state).
- The tool strip's two inline Hold/Ease buttons were replaced by the shared control inside the unchanged "Selected Motion key" group; the Wiggle stepper and both sr-only reason spans are unchanged. The strip walks the control vnode by identity and asserts `value`/`disabled`/`describedById`.
- `RailMotionDialogBundle` gained the required nullable `keyEasing: { frame, easing, set } | null`. `railMotionDialog` fills it only in key mode (no property selection, selection belongs to the record) from the selected channel/key at `selection.frame`; property-only mode leaves it null. The modal renders one `.physics-paint-motion-easing` row (`role="group"`, `aria-label="Motion key easing"`) only when non-null, and a rejection from `set` flows through the existing single `role="alert"` paragraph.
- One write authority: `commitSelectedMotionKeyEasing` performs the same guards, command call, commit and sentences and returns the rejection string or null; `setSelectedMotionKeyEasing` returns `helper(...) === null`; the bundle's `set` delegates to the same helper. `applySetMotionKeyEasing(` appears exactly once in the hook source, and the two delegations are pinned.
- CSS: `.physics-paint-motion-easing` (one compact 15px-gap row, matching the modal body rhythm) and a pressed tint scoped to `.physics-paint-roto-key-icon-button[data-rail-motion-easing][aria-pressed="true"]` built from the existing `#3a424c` button palette; no new tokens and no global `aria-pressed` rule.

## Task Commits

Measured via the plan ledger: base `bbfbaff7474d340eb93dd90b9d92dbc6def3a092`, HEAD `86cea6ebd1bb7e320fadbb1dc6d48ca0dea19c6a`, `git rev-list --count` = **4**.

1. `268fc5dc7` — **Task 1:** add linear and stop-motion easings with stop-motion as the creation default.
2. `2d24994dd` — **Task 2:** sample stop-motion at the displayed paint keys.
3. `049111185` — **Task 3:** resolve the snap-frame list once and thread it to every stepped consumer.
4. `86cea6ebd` — **Task 4:** expose key easing in the Motion sheet through one shared four-glyph control.

Each task used ONE combined commit (tests + production). RED-first was verified in-run for every task before the production change; the plan allowed this shape and required recording which was used.

No docs commit was created by the executor (SUMMARY/STATE/PLAN artifacts are left to the orchestrator), and ROADMAP.md was not touched.

## TDD Evidence

### Task 4 (final RED/GREEN cycle, representative)

- **RED command:** `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PhysicsPaintRailMotionEasingControl.test.ts src/components/physic-paint/view/PhysicsPaintRailMotionModal.test.ts src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts src/components/physic-paint/hooks/useRotoTimelineActions.test.ts`
- **RED result:** 4 suites failed — 3 module-load failures for the not-yet-created control and 3 targeted assertion failures in the hook suite (`expected undefined to be null`, `Cannot read properties of undefined (reading 'set')`, missing `commitSelectedMotionKeyEasing`).
- **GREEN result:** 4 files, 424 tests passed (control 8, modal 19, hook 204, strip 193); the CSS pin row was added afterwards and the strip suite re-ran at 194 passed.
- **Typecheck:** clean before and after the task.

Tasks 1–3 followed the same shape: RED assertion runs first (model/evaluator/commands/store/parity suites), then the production change, then the same suites green, then one commit per task.

## Files Created/Modified

Created:
- `app/src/components/physic-paint/roto/railMotionSnapFrames.ts` — pure bounded memo + displayed-real predicate + shared empty list.
- `app/src/components/physic-paint/roto/railMotionSnapFrames.test.ts`
- `app/src/components/physic-paint/view/PhysicsPaintRailMotionEasingControl.tsx` — shared four-glyph control.
- `app/src/components/physic-paint/view/PhysicsPaintRailMotionEasingControl.test.ts`

Modified (production): `railMotionModel.ts` (tokens, default, keylessSiblingSeed), `railMotionEvaluator.ts` (stop-motion/linear branches + curve options), `railMotionCommands.ts` (snapFrames threading, keylessSiblingSeed), `physicPaintStore.ts` (helper + accessor + transform), `useRotoTimelineActions.ts` (accessor reads, keyEasing, shared easing helper), `TimelineMotionChannels.tsx` (required lane prop), `PhysicsPaintTrackRow.tsx` and `PhysicsPaintWorkflowStrip.tsx` (one resolve per host, shared control), `PhysicsPaintRailMotionModal.tsx` (key-mode row), `physicsPaintKeyRailPresentation.ts` (keyEasing contract), `physicsPaintStudio.css` (row + pressed tint), `app/src-tauri/src/services/script_library.rs` (four-token validator + test), `railMotionCanonical.golden.json` (eighth entry).

Modified (tests/fixtures): `railMotionModel.test.ts`, `railMotionEvaluator.test.ts`, `railMotionCommands.test.ts`, `physicPaintStore.rotoRailMotions.test.ts`, `efxPaintPersistenceRailMotionRoundTrip.test.ts`, `railMotionCanonicalParity.test.ts`, `railMotionPackageRoundTrip.test.ts`, `railMotionExportParity.test.ts`, `useRotoTimelineActions.test.ts`, `TimelineMotionChannels.test.ts`, `PhysicsPaintWorkflowStrip.test.ts`, `PhysicsPaintRailMotionModal.test.ts`, `physicsPaintKeyRailPresentation.test.ts`.

## Decisions Made

- **Stop-motion, not hold-everywhere, is the creation default.** The never-built "hold everywhere" default remains unbuilt. Stop-motion reproduces hold when no interior snap frame exists (byte-identical fallback to the outgoing key) but steps at drawn frames when they do.
- **The frame set is DATA, never discovered by the evaluator.** The evaluator stays pure; the store memoizes the resolver per rail + span + capacity + raster revision so motion-only edits keep the same frozen array and the compositor never re-scans.
- **Insert invariance requires seeding from the displayed value.** Every audited derived-seed path receives the memoized list; the reducer's new `keylessSiblingSeed` keeps the evaluator the ONE ramp authority while `pairedValue` still wins.
- **The sheet row is key-mode only.** A property selection has no single key to ease, so property-only mode renders no row at all rather than a disabled one.
- **One write authority.** Both surfaces route through `commitSelectedMotionKeyEasing` → `applySetMotionKeyEasing`, so guards and rejection sentences cannot diverge.
- **Pin discipline.** Only pins asserting a creation-path default or a changed surface were flipped; the narrowing of one over-broad hook source pin (dropping `not.toMatch(/classifyPhysicPaintRotoGroupFrameTarget/)`) is documented below because the hook legitimately uses that classifier for unrelated pre-existing frame-target logic at :47/:806/:1007.

## Deviations from Plan

1. **[Rule 3 – blocking issue] Narrowed one over-broad source pin.**
   - **Found during:** Task 3 (hook source contract).
   - **Issue:** The planned property was "the hook contains no `resolveRailMotionSnapFrames` import and no inline span scan". My first pin also asserted the hook does not mention `classifyPhysicPaintRotoGroupFrameTarget`, but the hook legitimately imports/uses that classifier for unrelated pre-existing features (`useRotoTimelineActions.ts:47`, :806, :1007).
   - **Fix:** Removed only that one assertion; kept the `railMotionSnapFrames` import ban, the resolver ban and the single-accessor/single-evaluation pins.
   - **Files modified:** `useRotoTimelineActions.test.ts`.
   - **Commit:** `049111185`.
2. **[Rule 1 – bug] Typecheck narrowing in the new hook test.** `gizmo.evaluated.position` is optional (`RailMotionTransformValues.position?`); the test now narrows the value before reading `.x`/`.y`. Commit `049111185`.

No other deviations. No architectural change (Rule 4) was required. No auth gates occurred.

## SUPERSESSION

- **Quick 261107-ux2 is superseded.** Its add-channel opening seed literal `'ease'` is replaced by `'stop-motion'`; as a single key the seed stays inert, and once the next key is written the opening span now follows the stop-motion law rather than a smooth ease. Its two first-span regression tests were rewritten to express the stop-motion default (`railMotionModel.test.ts:963` "HOLDS its first span at the outgoing key…", `:999` "HOLDS BOTH axes on the first span…"), and the snapped interpolation it was after is pinned in Task 2 (oracle 0,0,2,2,4,4,6 plus the export-parity step rows).
- **The never-built "hold everywhere" default remains unbuilt.** Stop-motion is the new default for newly created keys; an authored hold still steps and is never rewritten.

## Verification Results

| Gate | Command | Result |
|------|---------|--------|
| Task 4 targeted suites | `vitest run PhysicsPaintRailMotionEasingControl / PhysicsPaintRailMotionModal / PhysicsPaintWorkflowStrip / useRotoTimelineActions` | 424 passed (4 files); strip re-run 194 after the CSS pin |
| Persistence guards | `vitest run railMotionCanonicalParity railMotionPackageRoundTrip railMotionExportParity` | 38 passed (16 + 5 + 17), 0 failed |
| Rust | `cargo test --manifest-path app/src-tauri/Cargo.toml script_library::tests` | 24 passed, 0 failed (four-token validator, accepted-token canonical bytes, invalid token rejected, eight-name pin) |
| Full suite | `pnpm --filter efx-motion-editor exec vitest run` | **401 files passed, 2 skipped; 8143 passed, 1 skipped, 96 todo (8240); 0 failed** |
| Typecheck | `pnpm --filter efx-motion-editor run typecheck` | clean (no errors) |
| Purity tripwire | `grep -n "physicPaintStore\|@preact/signals\|preact" railMotionEvaluator.ts railMotionSnapFrames.ts railMotionCommands.ts` | no output (exit 1); `railMotionSnapFrames.ts` imports only relative specifiers; evaluator header documents the snap list as data |
| Scope tripwire | `git diff --name-only bbfbaff7..HEAD` | exactly the plan's 30 `files_modified`; `railMotionDependencySurface.test.ts` and `railMotionPivot.ts` absent |
| No migration | model diff inspection | no load-time rewrite, no stored-key coercion; `DEFAULT_RAIL_MOTION_EASING` appears only at creation sites |

## Literal Sweep (both audits)

1. **Rail-motion domain (290 hits).** Every `'hold'`/`'ease'`/`'linear'`/`'stop-motion'` occurrence in the rail-motion globs is one of: the token union/order/default/validator in `railMotionModel.ts`; an evaluator branch or curve option; a command input/type/guard; a seed/default at a creation path; an authored test fixture; a pinned assertion; or the golden fixture bytes. No hit is an unrelated path.
2. **Remainder (`grep -rln` across `app/src` and `app/src-tauri/src`, ~105 files).** Every file outside the rail-motion domain belongs to another domain and was NOT edited by this plan (the scope tripwire is the proof): interpolation MODE tokens such as `'hold'` in `types/project.ts`, `sequenceStore`, `frameMap`, `keyframeEngine`, `previewRenderer`, `TimelineRenderer`, `InlineInterpolation`, `SidebarProperties`, `efxPaintDocument*`, `projectStore*`, and `project_io.rs`/`models/project.rs`; audio fade curves in `fadeCurves.ts`, `audioEngine*`, `transitionEngine*`, `exportEngine*`, `playbackEngine*`, `physicsPaintAudio*`; and unrelated 'linear'/'ease' strings in color/gradient/shared UI fixtures. The remaining hits inside the list are the rail-motion authority files already justified by audit 1.

## UAT Rows Handed to the User (live visible UAT)

1. Rail with paint keys at 0/2/4/6, add a Motion channel (seeded key at 0) and type a value at frame 6 — keys 0 and 6, both stop-motion: scrub 1–5 — the pose holds the frame-0 sample at 1, jumps at 2, holds, jumps at 4, and reads the frame-6 key at 6 (stop-motion is the default).
2. Insert invariance: with the same rail and a stop-motion Motion span, park the playhead on frame 3 and add a Motion key — the pose does not move on either Position axis AT THE INSERT FRAME. Later frames legitimately re-anchor to the new key, so only the insert frame is expected to stay pixel-identical.
3. Select the Motion key at 0 and press the Linear glyph: the pose glides continuously across the same range; press Ease: smooth ease; press Hold: still steps; press Stop Motion: steps at drawn frames.
4. Motion sheet: with a Motion key selected, one easing row shows four glyph buttons with the current easing pressed; with only a property selected in the pinned header, the row is absent.
5. Tool strip: the selected Motion key's controls show four glyph buttons; hovering each shows its easing name; accessible names read as words; a disabled control still announces the command-layer reason.
6. Lane: a stop-motion channel draws a staircase at every paint-key frame inside the span, and the canvas box steps at the same frames.
7. Loop rail: a looping clip steps on occurrences that draw a real source key and holds through generated in-betweens.
8. Old project: open a document authored before this change — every stored ease/hold key still behaves exactly as stored; only newly created keys default to stop-motion.

## Next Phase Readiness

- Four easing tokens now cross the TS/Rust boundary through the frozen golden fixture; future token work must name which language moved and why.
- The snap-list memo and `keylessSiblingSeed` contract are the templates for any future stepped-value consumer; keep the evaluator pure and pass the list as data.
- Automated-green is not done: the eight live UAT rows above remain the completion gate.

## Self-Check: PASSED

- All 4 task commits are ancestors of HEAD: `268fc5dc7`, `2d24994dd`, `049111185`, `86cea6ebd`.
- Created files exist on disk: `railMotionSnapFrames.ts`/`.test.ts`, `PhysicsPaintRailMotionEasingControl.tsx`/`.test.ts`.
- Measured commits: 4; plan ledger base `bbfbaff7474d340eb93dd90b9d92dbc6def3a092`, HEAD `86cea6ebd1bb7e320fadbb1dc6d48ca0dea19c6a`.
- Full suite, typecheck, three persistence guards and the Rust suite are green; the diff is confined to the planned files.
