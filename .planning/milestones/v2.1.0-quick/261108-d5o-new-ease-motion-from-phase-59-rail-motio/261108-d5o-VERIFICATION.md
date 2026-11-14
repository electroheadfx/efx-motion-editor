---
phase: 261108-d5o-new-ease-motion-from-phase-59-rail-motio
verified: 2026-11-08T10:04:05Z
status: passed
score: 9/9 must-haves verified
covered_files: [".planning/quick/261108-d5o-new-ease-motion-from-phase-59-rail-motio/261108-d5o-PLAN.md", ".planning/quick/261108-d5o-new-ease-motion-from-phase-59-rail-motio/261108-d5o-SUMMARY.md", "app/src-tauri/src/services/script_library.rs", "app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts", "app/src/components/physic-paint/hooks/useRotoTimelineActions.ts", "app/src/components/physic-paint/physicsPaintStudio.css", "app/src/components/physic-paint/roto/railMotionCommands.test.ts", "app/src/components/physic-paint/roto/railMotionCommands.ts", "app/src/components/physic-paint/roto/railMotionEvaluator.test.ts", "app/src/components/physic-paint/roto/railMotionEvaluator.ts", "app/src/components/physic-paint/roto/railMotionModel.test.ts", "app/src/components/physic-paint/roto/railMotionModel.ts", "app/src/components/physic-paint/roto/railMotionSnapFrames.test.ts", "app/src/components/physic-paint/roto/railMotionSnapFrames.ts", "app/src/components/physic-paint/view/PhysicsPaintRailMotionEasingControl.test.ts", "app/src/components/physic-paint/view/PhysicsPaintRailMotionEasingControl.tsx", "app/src/components/physic-paint/view/PhysicsPaintRailMotionModal.test.ts", "app/src/components/physic-paint/view/PhysicsPaintRailMotionModal.tsx", "app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx", "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts", "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx", "app/src/components/physic-paint/view/TimelineMotionChannels.test.ts", "app/src/components/physic-paint/view/TimelineMotionChannels.tsx", "app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.test.ts", "app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.ts", "app/src/lib/__fixtures__/railMotionCanonical.golden.json", "app/src/lib/railMotionCanonicalParity.test.ts", "app/src/lib/railMotionExportParity.test.ts", "app/src/lib/railMotionPackageRoundTrip.test.ts", "app/src/stores/efxPaintPersistenceRailMotionRoundTrip.test.ts", "app/src/stores/physicPaintStore.rotoRailMotions.test.ts", "app/src/stores/physicPaintStore.ts"]
covered_digest: "v4:sha256:786db4f0275ee363a962d366edca9d8a46d94933fb74c1055cbb6e431348b175"
behavior_unverified: 0
overrides_applied: 0
---

# Quick 261108-d5o: New Ease Motion from Phase 59 Rail Motion — Verification Report

**Task Goal:** Rail Motion (Phase 59): add a `stop-motion` easing and a `linear` easing, make stop-motion the default for new lanes and keys, expose per-key easing in the floating Motion sheet, and glyph the four easing buttons. Stop-motion samples a continuous LINEAR ramp only on REAL PAINT-KEY frames and holds that sample between them. The snap-frame list is resolved once per rail + raster revision and reaches the compositor, the canvas gizmo and the Motion lane curve. Both new tokens persist through the TS parser, the Rust package validator and the golden cross-language fixture.
**Verified:** 2026-11-08T10:04:05Z
**Status:** passed
**Verification Mode:** initial (no prior `261108-d5o-VERIFICATION.md` existed)
**Baseline:** `bbfbaff74` → HEAD `86cea6ebd` (4 commits: `268fc5dc7`, `2d24994dd`, `049111185`, `86cea6ebd`)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | A `stop-motion` key samples a continuous LINEAR ramp only at displayed real paint-key frames and holds the sample between them; keys {0→0, 6→6} over snap frames [0,2,4,6] evaluate to 0,0,2,2,4,4,6 (pinned literally) | ✓ VERIFIED | `railMotionEvaluator.ts:177-189` — `case 'stop-motion'`: `greatestRailMotionSnapAtOrBefore(snapFrames, current.frame, frame)` (binary search, :99-120), `sampleFrame = sampled ?? current.frame`, `position = (sampleFrame - current.frame) / span`, linear value. Oracle pinned at `railMotionEvaluator.test.ts:141-159` (`toEqual([0, 0, 2, 2, 4, 4, 6])`, fractions 1.5→0, 2.5→2, 6→6). Test passed in the fresh 249-test core-suite run. |
| 2 | Motion keys and paint keys are independent; no interior snap makes stop-motion EXACTLY Hold; a snap outside the outgoing key's span is ignored | ✓ VERIFIED | `railMotionEvaluator.test.ts:185-201` asserts byte-identical to Hold for snaps [0,6] and every tested frame; independence staircase `[0,0,20,20,40,50,50]` over snaps [0,2,4] (≡ [0,2,4,6] on 0..5), snap 9 ignored; the span branch only consults snaps while `frame < next.frame`, so out-of-span snaps are ineligible. |
| 3 | `linear` is a raw ramp; `hold`, `ease`, `linear` ignore the snap list; the easing dispatch is an exhaustive switch whose default is `never` | ✓ VERIFIED | `railMotionEvaluator.ts` — `linear` returns `current.value + delta * position` (raw t), `ease` uses `railMotionSmoothstep`, `default: { const exhaustive: never = current.easing; throw ... }`. `railMotionEvaluator.test.ts:203-214` proves hold/ease/linear byte-identical with/without snaps; :216-232 source-pins the four `case` arms, the `never` default and the absence of a `=== 'hold'` fallthrough; raw-ramp values 10/20/60 at frames 1/2/6 are pinned. |
| 4 | Stop-motion is the default on every creation path (new key, keyless sibling seed, animate seed, add-channel seed); a value rewrite preserves the authored easing; no stored project is migrated | ✓ VERIFIED | `railMotionModel.ts:156` `DEFAULT_RAIL_MOTION_EASING = 'stop-motion'`, consumed at :571 (new key in `upsertRailMotionKey`), :627 (`applyAnimateEdit` seed), :696 (`applySetKeyEdit` keyless sibling seed), :820 (add-channel seed). Rewrite law intact: :575 `easing ?? entry.easing`. No migration code exists (`grep -n "migrat"` finds only a seam comment at :494); the parser returns stored easing verbatim. Model tests pin the default (`railMotionModel.test.ts:85`) and rewrite preservation. |
| 5 | The snap-frame list is resolved ONCE per rail + raster revision through a bounded memo; repeated calls return the SAME frozen array; a motion-only edit keeps the reference; a paint edit invalidates it; no frame re-scans | ✓ VERIFIED | `railMotionSnapFrames.ts:58` cap 512, `:122` memo key `${railId}:${startFrame}:${endFrameExclusive}:${capacity}:${rasterRevision}`, frozen entries, shared empty sentinel. Store: exactly ONE lexical resolver call site (`physicPaintStore.ts:1351`, inside `function _resolveTrackSnapFramesForRecord`), exactly TWO helper call expressions (:1392 transform, :3919 accessor) — pinned by source-contract tests `physicPaintStore.rotoRailMotions.test.ts:1090-1105`. `rasterRevision` is built with `PHYSIC_PAINT_ROTO_RAIL_MOTIONS_EMPTY` (`physicsPaintRotoPhysicalModel.ts:1505-1520`), so motion-only edits do not move it; identity test `:1032` (`toBe(before)` after motion-only edit while `contentRevision` changes) and `:1039` (`not.toBe(before)` after a paint edit). |
| 6 | Every stepped-value consumer receives the list — compositor, Studio mirror, canvas gizmo, lane curve — and the lane draws a staircase with a left-limit point at every interior snap | ✓ VERIFIED | Store transform resolves at `:1392` and evaluates at `:1393`; compositor call `:3537`; Studio accessor `getRotoPhysicalTrackMotionTransform` `:3890-3897` delegates to the same transform (no second resolution). Gizmo reads the accessor at `useRotoTimelineActions.ts:2609` and passes it to the single `evaluateRailMotion(state.record, state.localCursorFrame, snapFrames)` at `:2614` (signature embeds `String(snapFrames.length)` :2682). Lane: `TimelineMotionChannelLaneProps.snapFrames` is REQUIRED (`TimelineMotionChannels.tsx:96`) and passed into `buildRailMotionCurvePath` at `:382-384`; hosts resolve once (`PhysicsPaintWorkflowStrip.tsx:2884`, `PhysicsPaintTrackRow.tsx:1070`) and forward (`:6386`, `:1369`). Curve adds `s − ε` / `s` pairs for interior stop-motion snaps (`railMotionEvaluator.ts:381-391`), pinned by the staircase test at `railMotionEvaluator.test.ts:500`. |
| 7 | Adding a Motion key never moves the pose: every derived-value creation path consumes the memoized list as DATA, so the insert frame is transform-identical before/after | ✓ VERIFIED | `railMotionCommands.ts` threads optional `snapFrames` through every key-creating input; seeds evaluate with it at `:431` (add-key default) and `:444` (grouped sibling fallback); `applyAxisMotionKeyEdits(..., snapFrames?)` computes `keylessSiblingSeed` at `:698` and passes it at `:708`; numeric-field seed evaluates at `:1220`, forwards at `:1230`. Compositor-level proof: `railMotionExportParity.test.ts:683-714` — with `applySetMotionKeyAtCursor({ snapFrames: Object.freeze([0,3,6]) })`, the frame-3 transform x stays 3 and y stays 30, stored keys stay x@3=3 / y@3=30, and `translateOps(after)` deep-equals `beforeTranslates`. Hook wiring pins six accessor reads (`useRotoTimelineActions.test.ts:6110-6138`). |
| 8 | Both new tokens persist end-to-end: TS type/parser/validator, Rust validator + canonical encoder, golden fixture, and the package/export parity guards all accept `linear` and `stop-motion`, encoding as `s6:linear` and `s11:stop-motion` | ✓ VERIFIED | TS: four-token union `railMotionModel.ts:31`, order :144, validator set :158, parser messages naming all four :266/:399; command validator/failure copy `'Easing must be Linear, Hold, Ease or Stop Motion.'` (`railMotionCommands.ts:426`, `:720`). Rust: four-token acceptance at `script_library.rs:1726` and test `canonical_rail_motions_accepts_linear_and_stop_motion_tokens` :3509-3524 asserting `s6:linear` / `s11:stop-motion` and rejecting `"bounce"`; eight-name pin message. Golden fixture: `railMotionCanonical.golden.json:730` (eighth entry) whose `expectedSource` (line 892) carries both tokens; provenance explains the append without regeneration. All three guards carry both tokens (`railMotionCanonicalParity.test.ts:133-144`, `railMotionPackageRoundTrip.test.ts:292/307`, `railMotionExportParity.test.ts:547/569`, persistence round-trip `:72/80`). Gates: guards 3 files / 38 tests passed; Rust `script_library::tests` 24 passed / 0 failed. |
| 9 | The floating Motion sheet exposes the selected key's easing through the same `applySetMotionKeyEasing` authority as the strip; both hosts render ONE shared four-glyph control (`<>`, `[]`, `()`, `=`) with word names, aria-pressed, disabled/aria-describedby, title per glyph; the row is ABSENT in property-only mode | ✓ VERIFIED | ONE write authority: `applySetMotionKeyEasing(` appears exactly once in the hook (`useRotoTimelineActions.ts:3262`, inside `commitSelectedMotionKeyEasing`), with exactly two delegations (`:3326` dialog `set`, `:3398` strip action) — pinned at `useRotoTimelineActions.test.ts:5891-5897`. Presentation exposes `keyEasing` only outside property mode and for this rail (`useRotoTimelineActions.ts:3317-3329` — `null` otherwise, `DEFAULT_RAIL_MOTION_EASING` only as defensive display fallback). Modal renders the group + shared control only when `keyEasing !== null` (`PhysicsPaintRailMotionModal.tsx:377-392`); property-only renders nothing (`PhysicsPaintRailMotionModal.test.ts:394-401`). Shared control: glyph map `EASING_GLYPH` (`PhysicsPaintRailMotionEasingControl.tsx:34-39`: linear `<>`, hold `[]`, ease `()`, stop-motion `=`), word labels/titles :41-48, `aria-label`, `aria-pressed`, conditional `aria-disabled`/`aria-describedby`, `title`, `aria-hidden` glyph span (:67-77). Strip host renders the same component (`PhysicsPaintWorkflowStrip.tsx:941-946`). Component suite (8 direct-render rows) and typecheck confirm the contract. |

**Score:** 9/9 truths verified (0 present, behavior-unverified)

All behavior-dependent truths (sampling law, memo identity/invalidation, insert invariance, lane staircase, persistence bytes) are backed by passing behavioral tests, not merely symbol presence, so none is ⚠️ PRESENT_BEHAVIOR_UNVERIFIED.

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `app/src/components/physic-paint/roto/railMotionModel.ts` | Four-name union, order, default, four-token parser messages, four creation seeds, `keylessSiblingSeed` | ✓ VERIFIED | Exists, substantive; all listed exports present and consumed by commands/evaluator/tests. |
| `app/src/components/physic-paint/roto/railMotionCommands.ts` | Optional `snapFrames` on every key-creating command; keyless sibling seed threaded; guards/copy/order unchanged | ✓ VERIFIED | Exists, substantive; imported by hook; six accessor-fed callbacks wire it. |
| `app/src/components/physic-paint/roto/railMotionEvaluator.ts` | Exhaustive switch, linear ramp, stop-motion sampling, optional snap list through all evaluators, staircase curve, purity header | ✓ VERIFIED | Pure module (no store/signal/Preact/raster/wall-clock reads — grep clean); consumed by store, hook, presentation, lane. |
| `app/src/components/physic-paint/roto/railMotionSnapFrames.ts` | Pure memoized resolver keyed per rail + span + capacity + raster revision, bounded FIFO, test reset | ✓ VERIFIED | NEW file; relative-import-only; reachable only through the store helper (source-contract pinned). |
| `app/src/stores/physicPaintStore.ts` | `getRotoRailMotionSnapFrames` accessor plus resolution inside `_trackMotionTransformAtFrame` | ✓ VERIFIED | One lexical resolver call site; two helper callers; compositor + Studio mirror + accessor all flow through it. |
| `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts` | Gizmo snap threading, dialog `keyEasing`, one shared easing commit authority | ✓ VERIFIED | Six accessor reads; single `evaluateRailMotion` with snaps; single `applySetMotionKeyEasing` call. |
| `app/src/components/physic-paint/view/PhysicsPaintRailMotionEasingControl.tsx` | ONE shared four-glyph control | ✓ VERIFIED | NEW file; pure/hook-free; rendered by both the strip controls and the Motion modal. |
| `app/src/lib/__fixtures__/railMotionCanonical.golden.json` | Eighth frozen document carrying both tokens with TS-derived revision/source/project values | ✓ VERIFIED | `rail-motion-easings` entry present; prior seven entries not regenerated. |
| `app/src-tauri/src/services/script_library.rs` | Four-token validator, canonical encoding, accepted-token coverage, genuinely-invalid-token test | ✓ VERIFIED | Acceptance test asserts both encoded tokens; `"bounce"` rejected in two negative tests; 24 lib tests green. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `physicPaintStore._resolveTrackSnapFramesForRecord` | `resolveRailMotionSnapFrames` | ONE lexical call site at `physicPaintStore.ts:1351` | WIRED | Source-contract test pins exactly one resolver call and exactly two helper call expressions (`:1392`, `:3919`); memo key carries rasterRevision; motion-only identity test. |
| `_trackMotionTransformAtFrame` | Compositor + Studio mirror | `evaluateRailMotion(record, resolveRailLocalFrame(...), snapFrames)` at `:1393`; Studio accessor delegates at `:3897` | WIRED | Store tests: Studio transform at 3.5 and 4.5 both read 3, at 6 reads 6; export parity compositor row asserts delivery steps 3,3 → 6. |
| `useRotoTimelineActions.railMotionGizmo` | Evaluator | Accessor read `:2609`, single `evaluateRailMotion(..., snapFrames)` `:2614` | WIRED | Hook test asserts gizmo snaps to x/y 20 and the rendered signature ends `|2`. |
| `TimelineMotionChannelLaneProps.snapFrames` | `buildRailMotionCurvePath` | Required lane prop `:96`, options at `:382-384`, hosts resolve once and forward | WIRED | Module-source pin proves the lane only reads the list from props; staircase test exercises interior snap pairs. |
| `applySetMotionKeyEasing` | Strip action + Motion sheet setter | Single command call `railMotionCommands.ts` behind hook `:3262`; delegations `:3326` / `:3398` | WIRED | One-write-authority source pin (1 call, 2 delegations) and modal behavioral test that `set` is invoked with the chosen token. |
| TS parser authority | Rust validator + golden fixture | Four tokens in `railMotionModel.ts`, `script_library.rs:1726`, fixture entry | WIRED | Rust parity test recomputes canonical source from the fixture; `s6:linear` / `s11:stop-motion` present in both languages. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `physicPaintStore.ts` | `snapFrames` for compositor / Studio / gizmo / dialog | `resolveRailMotionSnapFrames` scans displayed real keys through `classifyPhysicPaintRotoGroupFrameTarget` + `resolvePhysicPaintRotoLoopFrame` (never the rendering accessor) | Yes — real rail records, memoized per raster revision | ✓ FLOWING |
| `TimelineMotionChannels.tsx` | lane path `d` | Host `snapFrames` prop → `buildRailMotionCurvePath` → evaluator sampling | Yes — real lane channels from the active record | ✓ FLOWING |
| `PhysicsPaintRailMotionEasingControl.tsx` | `value` displayed easing | `keyEasing.easing` read from the selected key's stored token in `state.record` | Yes — stored record data per selected key | ✓ FLOWING |
| `railMotionCanonical.golden.json` | `expectedSource` bytes | TS canonical encoder (parity test recomputes and compares) | Yes — both languages read the frozen fixture | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Full TypeScript suite | `pnpm --filter efx-motion-editor exec vitest run` | 401 files passed / 2 skipped (403); 8143 tests passed / 1 skipped / 96 todo / 0 failed | ✓ PASS |
| Typecheck | `pnpm --filter efx-motion-editor run typecheck` (`tsc --noEmit`) | exit 0, no diagnostics | ✓ PASS |
| Three rail-motion persistence guards | `vitest run` on canonical parity, package round-trip, export parity | 3 files / 38 tests passed | ✓ PASS |
| Rust package validator | `cargo test --manifest-path app/src-tauri/Cargo.toml --lib script_library::tests` | 24 passed / 0 failed / 93 filtered out | ✓ PASS |
| Core easing suites | `vitest run` on evaluator + snap resolver + model + commands | 4 files / 249 tests passed (includes the literal oracle) | ✓ PASS |
| Debt-marker scan | `grep -nE "TODO|FIXME|XXX|TBD|HACK|PLACEHOLDER"` over all 30 changed files | no matches | ✓ PASS |
| Skipped/disabled test scan | `grep -nE "\.skip\(|\.only\(|describe\.skip|it\.skip|test\.skip|xit\("` over all changed test files | no matches | ✓ PASS |
| Scope confinement | `git diff --name-only bbfbaff74..HEAD` vs PLAN `files_modified` | 30 files, exact match; `railMotionDependencySurface.test.ts` and `railMotionPivot.ts` untouched | ✓ PASS |
| Purity tripwire | grep for store/signals/Preact/wall-clock/raster reads in evaluator, snap resolver, commands | no matches; snap resolver imports relative modules only | ✓ PASS |

### Probe Execution

Not applicable — the task declares no `scripts/*/tests/probe-*.sh` and is not a migration/tooling phase; no probe claim appears in PLAN or SUMMARY.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| QUICK-261108-D5O | `261108-d5o-PLAN.md` | New linear + stop-motion easings, stop-motion default, per-key easing in the Motion sheet, four glyphs, memoized snap list at every stepped consumer, TS/Rust/golden persistence | ✓ SATISFIED | All nine must-have truths verified; all four gates green; scope confined to the planned files. No orphaned requirement IDs map to this task. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | No debt markers, empty implementations, hardcoded-empty props, or console-only handlers in the changed files | — | None |
| `app/src/components/physic-paint/roto/railMotionCommands.ts` | 717 | Stale doc comment says "Sets Hold/Ease on every Motion axis" (four tokens now) | ℹ️ Info | Documentation only; no behavior, format, or contract impact |
| `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` | 925, 6507 | Stale doc comments say "Hold/Ease toggle" / "Hold/Ease and Wiggle" | ℹ️ Info | Documentation only |
| `app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts` | 6046 | Comment says "100/9" while fixture/assertion is 20 | ℹ️ Info | Test comment only; assertion correct |

### Human Verification Required

None blocking. Per the task's explicit scoping, live visible UAT is the user's own completion gate and is NOT part of this verification. The eight live UAT rows recorded in `261108-d5o-SUMMARY.md:295-304` (stop-motion stepping, insert invariance, four glyph selection from both surfaces, sheet presence/absence, lane staircase, loop occurrences, old-project preservation) remain outstanding on the user's side; automated completion is not live-sign-off.

### Gaps Summary

No gaps. Every must-have truth is observably true in the codebase and backed by passing behavioral tests; every required artifact exists, is substantive and is wired into its consumers; every key link is connected; both new tokens cross the TS/Rust boundary and are frozen in the golden fixture; the diff is confined to the plan's 30 files. The 8 live UAT rows are the user's completion gate, not verification gaps.

---

_Verified: 2026-11-08T10:04:05Z_
_Verifier: Claude (gsd-verifier)_
