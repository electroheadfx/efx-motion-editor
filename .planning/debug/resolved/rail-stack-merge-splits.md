---
status: resolved
trigger: "Run Script rail-on-rail stacking is broken in v2.0.1 Studio. User law: 4 rail types (standard/hand, motion, static, reveal); motion/static/reveal are editable via a script for regenerate; if a motion/static/reveal rail is modified by another Run Script it MUST become ONE standard rail carrying all modifications; Keep-script re-apply appends the new scripts to the existing ones and only updates the cache with the stacked paint. Actual: after running a Static script over an existing rail, the timeline shows TWO rails side by side — a purple Static rail and a green Standard rail (screenshot: purple 5-cell rail, then green cells, green rail band over the right cluster, white-outlined selected cell, blue playhead at right). User: 'all the law for rewrite rail on rail are broken'. Image #2."
goal: find_and_fix
symptoms_prefilled: true
created: 2026-11-05T18:45:00.000Z
updated: 2026-11-05T21:20:00.000Z
---

## Current Focus

hypothesis: CONFIRMED. The pure stack-merge law is correct, but the live Studio path silently falls back to CREATE because the playhead rail has no Loop Clip to stack onto. Quick 261105-p9i widened the dissolve so that a paint/+Key strictly after a scripted (Motion/Static) or Reveal rail removes that rail's Loop Clip, leaving a clip-less hand Key Rail. `resolveRunScriptDestination` only considered Loop Clips, returned 'create', and the apply path published a NEW scripted clip next to the existing keys — two rails, no error.
test: regression tests now pin the rail-on-rail rewrite law at both layers (pure resolver + controller commit shape + dialog composition).
expecting: met.
next_action: none — resolved; fix applied and verified.

## Symptoms

expected: A Run Script on any Motion/Static/Reveal rail merges the run into that rail and publishes ONE Standard rail with all modifications; repeats/cycle rules apply; Keep script ON appends the scripts and updates the cached paint in the same commit; undo restores the pre-run rail in one step.
actual: The timeline ends up with two rails — a purple Static rail and a green Standard rail (or the old rail plus a newly created rail). The law "modified by another run → one Standard rail" is violated.
errors: None reported in the UI ("no error"); the fallback is silent.
reproduction: Create one script Motion rail in Studio, then Run Script a Static script with an updated script over it. Expected one Standard rail; observed two rails. Also reproduced after +Key/paint dissolved the scripted rail's Loop Clip.
started: Reported 2026-11-05 on v2.0.1 / dev build after quick 261105-p9i; user says the rail-on-rail rewrite law is broken generally.

## Evidence

- timestamp: 2026-11-05
  checked: git diff of quick 261105-p9i (commit range 7ead6f0cf..715c9c155) and full suite
  found: only 4 code/test files changed; production change is the dissolve predicate widening (`isCompleteStandardRailClip` → `isCompleteCanonicalLifecycleRailClip`, terminal `isStandardMergedLoopClip` removed). Stacking code, PlayScript controller, stacking module and coordinator are untouched. Full suite 7296 passed, typecheck clean.
  implication: the split is not caused by a change to the stacking merge itself; either it is a latent live-path bug or a consequence of the dissolve removing a rail's clip.

- timestamp: 2026-11-05
  checked: controller-level second-stack probe (`physicsPaintRotoPlayScriptController.test.ts` temporary test, reverted)
  found: first stack on a static clip publishes ONE Standard clip; a second stack on that merged Standard clip resolves destination 'stack' (F11–F13) and publishes ONE Standard clip again. `buildStandardStackedLoopClip` drops scriptId/motion/overrideColor/railKind and keeps the destination's mode/lifecycle.
  implication: the merge replacement by loopId is correct at the controller layer; the law must be broken in the live destination resolution or the commit/store/bridge path.

- timestamp: 2026-11-05
  checked: `derivePhysicPaintRotoLoopRanges` (resolver:6758-6890) and `toRunScriptRailViews` (stacking:192-245)
  found: a clip whose source key IDs are missing from the identity snapshot is marked unresolved with a placeholder duration; `toRunScriptRailViews` filters `range.unresolved === null`, so an unresolved clip produces NO rail view. A finite lifecycle clip's effective end is additionally clamped to `min(storedEnd, sourceExtent)` (58-09 G-01). The exclusive stored end is outside the placement fragment `[start, endExclusive)`.
  implication: a stale/mismatched collection or a source key missing from the snapshot makes the rail invisible to Run Script, so the playhead resolves 'create' and a second clip is created with no error; this is the leading live-only mechanism.

- timestamp: 2026-11-05
  checked: `stackContext` / `resolveRunScriptDestination` in the PlayScript controller
  found: `stackContext` catches every derivation error and returns null; `runDestination` then falls back to `CREATE_DESTINATION`. `resolveRunScriptDestination` returns 'create' when no rail contains the playhead, the rail's cycleLength ≤ 0, or the playhead is before phaseOrigin; 'refuse' only for ambiguous rails.
  implication: the fallback is silent by design. The investigation must determine why the containing rail is not seen in the live collection at the exact repro.

- timestamp: 2026-11-05
  checked: quick 261105-p9i dissolve behaviour (physicsPaintRotoPhysicalResolver.ts:4873-4883 + useRotoTimelineActions.ts:2535-2552)
  found: +Key/paint on an empty frame strictly after a canonical Motion/Static/Reveal rail now removes that rail's Loop Clip and joins the new key. The rail becomes a derived Key Rail with no clip. Run Script stacking requires a Loop Clip destination, so the next Run Script on that rail can only create a new clip.
  implication: ROOT CAUSE. The user's repro includes +Key/paint before the Run Script, so the split is a direct consequence of the dissolve: the scripted rail loses its clip, the destination resolves 'create', and the run publishes a second rail instead of rewriting the first.

- timestamp: 2026-11-05
  checked: `resolveRunScriptDestination` inputs in `stackContext` and the apply path's publication shape
  found: the destination set was {create, stack, refuse} — clips only. No destination described "merge into the in-hand Key Rail under the playhead". The apply path always published `loopClips` + a leading `incomingInterpolationBreakKeyIds` entry for a scripted run, which is exactly what creates a second rail.
  implication: the law cannot be satisfied by tuning the clip path; the controller needs an in-hand Standard merge destination that publishes keys only.

- timestamp: 2026-11-05
  checked: new regression suites and full gate
  found: 10 law tests in `physicsPaintRotoPlayScriptController.test.ts` (scripted Motion/Static → one Standard clip; in-hand merge keys-only with union/record assertions; whole-segment default; sparse gap frame; incoming-break split; create outside rails; clip wins; parent-end collision Cancel/Truncate only), 6 resolver tests in `physicsPaintRotoRunScriptStacking.test.ts`, 2 dialog tests. Targeted suites 354 + 115 passed; full suite `vitest run` exit 0 — 374 files passed / 2 skipped, 7314 tests passed / 1 skipped / 96 todo; typecheck clean; viteBuild passed (index 1620.39 kB, PhysicsPaintStudio 1056.83 kB — under the 2000 kB desktop ceiling).
  implication: the rewrite law is now pinned at resolver, controller and dialog layers; the previous behaviour (two rails) is a failing-test shape.

## Resolution

root_cause: Quick 261105-p9i's widened dissolve removes a scripted or Reveal rail's Loop Clip on a paint/+Key strictly after the rail, leaving a clip-less hand Key Rail. `resolveRunScriptDestination` only resolved Loop Clips and therefore fell back to 'create' (silently), so the next Run Script published a NEW scripted clip plus a leading interpolation break beside the existing keys — two rails instead of one Standard rail. The AND-gate contributing factors: (1) clips-only destination resolution, (2) no in-hand Key Rail merge destination, (3) an apply path that always published loop/break state for scripted runs.

fix: Added a `standard` merge destination. `resolveRunScriptStandardRailMerge` derives Key Rail segments with `deriveKeyRailSegments` (inclusive `[firstKeyFrame, lastKeyFrame]`, breaks start segments, group-owned key frames refuse) and resolves the segment containing the playhead. `stackContext` now tries clip destinations first and the standard merge when clips return 'create'. A new `confirmStandardMerge()` is the commit path: it bakes via `bakeAquarelleScript` (Keep ON = union with stage base pins; Keep OFF = composite over the current payload), records per-key scripts with `recordRailKeyScripts` append, and publishes KEYS ONLY — no `loopClips`, no `incomingInterpolationBreakKeyIds` — so the coordinator stages the current collections unchanged (`generatedPublicationInput?.loopClips → proposal?.nextLoopClips ?? currentLoopClips`). Collisions with the parent end offer Cancel/Truncate only (never Overwrite, so a merge cannot delete another rail). The dialog hides the Rail tabs for a standard merge, keeps Rail Type (Motion/Static) and Keep script editable, fixes Cycle at 1 with Infinity off, and reuses the collision card.

verification: `vitest run` full suite exit 0 (374 files passed / 2 skipped; 7314 passed / 1 skipped / 96 todo); typecheck clean; production vite build passed.

files_changed:
- app/src/components/physic-paint/roto/physicsPaintRotoRunScriptStacking.ts
- app/src/components/physic-paint/roto/physicsPaintRotoRunScriptStacking.test.ts
- app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
- app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts
- app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx
- app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts
- app/src/components/physic-paint/view/PhysicsPaintPlayScriptCards.tsx
- app/src/components/physic-paint/PhysicsPaintStudio.tsx

prevention: why not caught — the destination resolver had no test for a clip-less Key Rail under the playhead after a dissolve, and the create fallback is silent by design. guard: the new 10-test `rail-on-rail rewrite law (2026-11-05)` controller suite plus resolver and dialog tests now fail if a run on an in-hand Key Rail publishes a loop clip or a second rail.
