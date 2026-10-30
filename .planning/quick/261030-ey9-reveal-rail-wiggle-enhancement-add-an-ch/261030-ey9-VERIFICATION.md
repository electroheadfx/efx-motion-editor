---
phase: 261030-ey9-reveal-rail-wiggle-enhancement
verified: 2026-10-30T12:00:51Z
status: human_needed
score: 7/7 must-haves verified
covered_files: [".planning/quick/261030-ey9-reveal-rail-wiggle-enhancement-add-an-ch/261030-ey9-PLAN.md", ".planning/quick/261030-ey9-reveal-rail-wiggle-enhancement-add-an-ch/261030-ey9-SUMMARY.md", "app/src-tauri/src/services/script_library.rs", "app/src/components/physic-paint/PhysicsPaintStudio.test.ts", "app/src/components/physic-paint/PhysicsPaintStudio.tsx", "app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts", "app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts", "app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts", "app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts", "app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts", "app/src/components/physic-paint/hooks/useRotoTimelineActions.ts", "app/src/components/physic-paint/roto/aquarelleFramePose.ts", "app/src/components/physic-paint/roto/physicsPaintRotoHoldDeterminism.test.ts", "app/src/components/physic-paint/roto/physicsPaintRotoKeyController.test.ts", "app/src/components/physic-paint/roto/physicsPaintRotoKeyController.ts", "app/src/components/physic-paint/roto/physicsPaintRotoLoopClips.test.ts", "app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts", "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts", "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts", "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.test.ts", "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts", "app/src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.test.ts", "app/src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.ts", "app/src/components/physic-paint/roto/physicsPaintRotoRevealBake.test.ts", "app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts", "app/src/components/physic-paint/roto/physicsPaintRotoWorkflow.ts", "app/src/components/physic-paint/roto/rotoTimelineSelectors.test.ts", "app/src/components/physic-paint/roto/rotoTimelineSelectors.ts", "app/src/components/physic-paint/view/PhysicsPaintPalette.test.ts", "app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts", "app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx", "app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts", "app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx", "app/src/components/physic-paint/view/RightPanelOnionMotionTabs.tsx", "app/src/lib/physicPaintBridge.test.ts", "app/src/stores/efxPaintStore.reveal.test.ts", "app/src/stores/efxPaintStore.ts", "app/src/stores/physicPaintStore.test.ts", "app/src/stores/physicPaintStore.ts", "app/src/types/physicPaint.test.ts", "app/src/types/physicPaint.ts", "packages/efx-paint-host/src/animation/recordedStrokeMotion.test.ts", "packages/efx-paint-host/src/animation/recordedStrokeMotion.ts"]
covered_digest: "v3:sha256:aa68ad0fef6b3f1df06c3f18ea78c841392edef81be00cfd637bf566cf256eca"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 7/7
  gaps_closed: []
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "In Studio, create a Reveal rail in both Motion and Static with Photo wiggle checked and nonzero Move/Deform/Rotation/Scale, then play it."
    expected: "Photo and wash silhouette move as one rigid unit per held frame (2-frame hold, stop-motion boil), with no split between the photo and the pigment."
    why_human: "Motion feel and photo/wash cohesion are visual judgments; canvas-count and call-argument tests cannot judge appearance."
  - test: "Set Rotation to 100 with Move/Deform/Scale at 0 in each mode (Paint Motion, Paint Static, Reveal Motion, Reveal Static)."
    expected: "Each element rotates up to ±10 degrees around its own centre; the aquarelle sheet and the revealed composite pivot on their own centre with no positional jump."
    why_human: "Pivot correctness and perceived rotation amount require watching the live animation."
  - test: "Set Scale to 100 with the other channels at 0 in all four modes."
    expected: "Each element breathes ±10 percent uniformly around its own centre, without drift."
    why_human: "Uniformity and drift are visual judgments."
  - test: "Edit Rotation/Scale in the Create Rail dialog Motion wiggle card and in the right-panel Motion tab."
    expected: "Both surfaces read and write the same values, clamp to integers 0-100, and unrelated interpolation edits do not zero them; the Photo wiggle card is offered in reveal arms only."
    why_human: "Cross-surface live sync and panel behavior are exercised in the running app."
  - test: "Create the reveal rail with Photo wiggle plus nonzero Rotation/Scale, close and reopen the project, then select the loop clip and open its edit dialog."
    expected: "Photo wiggle remains checked and the Rotation/Scale values are restored from disk."
    why_human: "End-to-end persistence through the real launch/load path is a live-app check; parser round-trips are covered by automated tests."
---

# Phase 261030-ey9: Reveal rail wiggle enhancement Verification Report

**Phase Goal:** Add a checkbox in Reveal that wiggles the photo position during frames, and add rotation and scale wiggle for all modes (reveal/static/motion).
**Verified:** 2026-10-30T12:00:51Z
**Status:** human_needed
**Re-verification:** Yes — fingerprint refresh at HEAD. The prior pass ran at `d0d9b9ee`; commit `724eb105` afterwards changed only planning documents (PLAN/SUMMARY/REVIEW/VERIFICATION/STATE), so the covered digest moved while no implementation source changed. All seven must-haves were re-checked against HEAD and every behavioral suite was re-run.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Reveal bake with Photo wiggle off or absent is byte-identical to today: same canvas count per frame, same poseRevealCoverage path, same encoded frames (golden pins `project-598-5cf0b794` and `project-305-ed764eca` unchanged). | ✓ VERIFIED | `physicsPaintRotoRevealBake.test.ts:513` "off parity: the coverage pose path is byte-identical to today" (8 canvases, 2 masks, 0 posed composites); renderer off path `physicsPaintRotoPlayScriptRenderer.ts:221` still calls `poseRevealCoverage`; golden pins at `app/src/types/physicPaint.test.ts:1022,1048`; `efxPaintStore.reveal.test.ts` off/on split. Reveal-bake suite re-run at HEAD: 35/35 green. |
| 2 | Reveal bake with Photo wiggle on masks the UNPOSED coverage first, then applies exactly ONE rigid held pose to the finished composite around the placed photo centre, per output frame, in both Reveal Motion and Reveal Static. | ✓ VERIFIED | `physicsPaintRotoPlayScriptRenderer.ts:219-226` — `posedCoverage = coverage` when `photoWiggle`, then `poseRevealedResult(masked, ...)`; pivot `:378-381` = `size/2 + transform*zoom`; draw origin at `-pivot` `aquarelleFramePose.ts:107-111`. Tests `physicsPaintRotoRevealBake.test.ts:523` (unposed coverage, one composite pose, photo-centre pivot args) and `:592` (static: every span frame carries its own pose); zero-motion `:580` returns the unposed composite (6 canvases). |
| 3 | Photo wiggle is written on the reveal Loop Clip only when true, is copied verbatim by the parser and both clip-rebuild sites, is forwarded by replayRevealRail, and never enters the canonical fingerprint. | ✓ VERIFIED | `physicsPaintRotoPhysicalModel.ts:335` type, `:484` key allowlist, `:870-874` boolean-only validation, `:1025` parse freeze, `:1479-1482` explicit canonical exclusion; `efxPaintStore.ts:1539,1570,1581,1624` conditional write and `:1724` replay forwarding; presence-preserving spreads in `useRotoPhysicalEditCoordinator.ts` and `physicsPaintRotoRailSetCopy.ts`; `physicsPaintRotoPlayScriptController.ts:2463-2465` whole-clip compare includes the flag. Loop-clip suite 98/98 and reveal store suite 33/33 green at HEAD. |
| 4 | Rotation and Scale are two extra channels of the existing held-pose law: integer percent 0-100, ±10 degrees and ±10 percent uniform at 100, 2-frame hold, seeded noise, pivot = each stroke's own point centroid; all-zero returns the input stroke by identity. | ✓ VERIFIED | `recordedStrokeMotion.ts:6-7` amplitudes, `:11-12` channels 9/10, `:44-50` seeded noise, `:86-92` rotate/scale about centroid, `:103` identity arm. Host suite 7/7 green at HEAD (identity, centroid ±10°, determinism/hold, scale 0.9-1.1, deformation last); four-channel determinism pinned in `physicsPaintRotoHoldDeterminism.test.ts:145`. |
| 5 | Every pose consumer classifies a rotation-only or scale-only setting as motion: sheet pose null guard, band poser guard, static moving guard, identical-source-cycle matcher, and the write-back settings rebuilds. | ✓ VERIFIED | `aquarelleFramePose.ts:23-28` (`isSheetMotionZero` includes rotation/scale), `:44` pose null guard, `:198-200` rigid-wiggle identity arm, `:226-233` deform poser; controller `motionZero` `:588-589`, matcher comparisons `:596-597`, static `moving` `:1367-1369` with `bandPass` `:1371`. The three settings rebuild helpers preserve both fields: `rotoTimelineSelectors.ts:219-220`, `physicsPaintRotoKeyController.ts:617-618`, `useRotoTimelineActions.ts:3988-3989`; the shared `RotoInterpolationSettings` type carries them at `physicsPaintRotoWorkflow.ts:22-23`. Controller suite 162/162 green, including the rotation-only static rigid-pass case. |
| 6 | Rotate and Scale controls exist in the Create Rail dialog Motion wiggle card and in the right-panel Motion tab, both read and write the one runtime settings model, and neither is silently zeroed by an unrelated interpolation edit. | ✓ VERIFIED | Dialog Rotation/Scale rows `PhysicsPaintPlayScriptDialog.tsx:275,290`; Photo wiggle card `:348-365` rendered only in the reveal arm `:620`; right-panel Rotate/Scale rows `RightPanelOnionMotionTabs.tsx:96-115` with `clampWiggleValue` `:56`; single-model write `PhysicsPaintStudio.tsx:5914-5918` and read `:6198-6199` (0/0 fallback) through `setRotoInterpolationSettings`; normalizer `physicPaintStore.ts:2205-2206`; defaults `:337-338`. Dialog 63/63 and right-panel 39/39 green at HEAD. |
| 7 | Persisted motion records carry rotation and scale only when nonzero, and the TypeScript and Rust canonical encoders emit them at the same ordinal position so cross-language revisions stay byte-identical. | ✓ VERIFIED | TS script motion `physicsPaintRotoPhysicalModel.ts:1427` and loop motion `:1474-1475`, nonzero-gated and immediately after `position`; Rust `script_library.rs:1455-1459` (loop, after `position`, before `overrideColor`) and `:1639-1643` (script motion, after `position`, before `background`); hash pins `physicPaint.test.ts:1051-1079` (zero identical vs nonzero changes). Rust `script_library` lib tests 15/15 green, including `canonical_physical_hash_ignores_zero_motion_rotation_and_scale` and `canonical_physical_hash_changes_on_nonzero_motion_rotation_or_scale`. |

**Score:** 7/7 truths verified (0 present, behavior-unverified)

### Deferred Items

None — no item in this quick task is deferred to a later milestone phase (quick tasks sit outside the milestone roadmap).

### Advisory (New Scope, Unevidenced)

None. The re-verification scan produced no new-scope blocker, and no new-scope finding needed deterministic evidence.

### Required Artifacts

All declarations from PLAN frontmatter were checked at exists / substantive / wired / data-flow levels.

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/efx-paint-host/src/animation/recordedStrokeMotion.ts` | Rotation/scale channels in the held-pose law | ✓ VERIFIED | 141 lines, exists and substantive; consumed by `aquarelleFramePose.ts:1` through the workspace alias; built `dist/animation.mjs` contains the rotation/scale law; 7/7 tests. |
| `app/src/components/physic-paint/roto/aquarelleFramePose.ts` | Sheet pose guards, rigid pass, pivot override | ✓ VERIFIED | 272 lines; null guard `:23-28,44`, pivot override `:107-118`, rigid pass `:192-211`, deform poser `:216-234`. |
| `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts` | Unposed coverage mask + one composite pose | ✓ VERIFIED | 450 lines; off/on split `:219-226`; `poseRevealedResult` `:365-382` pivots on the placed-photo centre. |
| `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts` | Persisted `photoWiggle`, optional rotation/scale, conditional canonical | ✓ VERIFIED | 1657 lines; keys `:335,465,484`; validation `:776-777,874`; freezes `:1014-1015,1025,1194-1195`; canonical `:1427,1474-1475`; exclusion comment `:1479-1482`. |
| `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` | Signal, reset, confirm forwarding, motion classification, ack guard | ✓ VERIFIED | 2468 lines; signal `:412`, setter `:661`, reset `:734`, confirm forwarding `:1470`; four-channel matcher `:588-600`; summary `:2239-2248`; ack compare `:2463-2465`. |
| `app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx` | Photo wiggle card + Rotation/Scale rows | ✓ VERIFIED | 801 lines; Rotation `:275`, Scale `:290`; Photo wiggle card `:348-365`; reveal-only render `:620`. |
| `app/src/components/physic-paint/view/RightPanelOnionMotionTabs.tsx` | Rotate and Scale rows | ✓ VERIFIED | 120 lines; rows `:96-115`; required members declared `:63-64`; `clampWiggleValue` `:56`. |
| `app/src/stores/efxPaintStore.ts` | Create/replay forward the flag | ✓ VERIFIED | 2078 lines; `:1539,1570,1581,1624,1724`. |
| `app/src/stores/physicPaintStore.ts` | Bake input flag + settings defaults/normalizer | ✓ VERIFIED | 5487 lines; bake input `:1990`, defaults `:337-338`, normalizer `:2205-2206`. |
| `app/src-tauri/src/services/script_library.rs` | Conditional rotation/scale canonical terms | ✓ VERIFIED | 3208 lines; loop `:1455-1459`; script motion `:1639-1643`; 15/15 Rust lib tests. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| Dialog checkbox | reveal bake | `setPhotoWiggle` → `photoWiggle.peek()` → `createRevealRail` → `commitRevealBake` → `renderRotoRevealFrames` | ✓ WIRED | `PhysicsPaintPlayScriptDialog.tsx:355` → controller `:661,1470` → `efxPaintStore.ts:1570,1581` → `physicPaintStore.ts:1990` → renderer `:219`. |
| Loop Clip `photoWiggle` | replay bake | parse copy → `replayRevealRail` → `commitRevealBake` | ✓ WIRED | `physicsPaintRotoPhysicalModel.ts:1025`; `efxPaintStore.ts:1724`; test in `efxPaintStore.reveal.test.ts`. |
| Loop Clip `photoWiggle` | physical-edit bridge / duplicate | clone + `buildDuplicatedLoopClip` → whole-clip compare | ✓ WIRED | `physicsPaintRotoRailSetCopy.ts`, `useRotoPhysicalEditCoordinator.ts`, controller ack `:2463-2465`; coordinator and rail-set-copy tests green. |
| Interpolation rotation/scale | Apply path and reveal dialog motion | `getMotion` ports → `transformRecordedStrokeForHeldPose` / `dialogMotion` → bake motion | ✓ WIRED | Ports in `PhysicsPaintStudio.tsx:3010`; controller `toDialogMotion` `:2230-2235`; bake receives `{ ...dialogMotion.peek() }` `:1485`. |
| Persisted motion rotation/scale | TS + Rust canonical | `encodeCanonicalNumber` / `canonical_number`, nonzero-gated, same ordinal | ✓ WIRED | TS `:1427,1474-1475`; Rust `:1455-1459` and `:1639-1643`; both after `position`, both skip zero; hash pins and Rust 15/15. |
| Placement pivot | Revealed composite vs wash/sheet | composite pivots on `size/2 + transform*zoom`; sheet/wash on own centre | ✓ WIRED | Renderer `poseRevealedResult` pivot `:378-381`; `aquarelleFramePose.ts:107-118`; bake test asserts the pivot-relative draw args. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| Reveal bake renderer | `input.photoWiggle` | Controller signal seeded from the dialog checkbox and from the persisted clip on edit/replay | Yes — canvas call arguments and frame counts asserted | ✓ FLOWING |
| Reveal composite | `input.motion` (deformation/position/rotation/scale) | Runtime `PhysicPaintRotoInterpolationSettings` via `toDialogMotion`, with 0 defaults | Yes — posed canvases produced | ✓ FLOWING |
| Right panel | `playWiggle.strokeRotation/strokeScale` | `rotoLegacyInterpolationSettings` memo → store settings | Yes — steppers render stored values; write-back preserves siblings | ✓ FLOWING |
| Loop clip model | `photoWiggle`, `motion.rotation/scale` | Persisted JSON parsed with fail-closed allowlists | Yes — round-trip tests; presence-preserving spreads | ✓ FLOWING |
| Canonical encoders | rotation/scale terms | Persisted motion record | Yes — nonzero changes hash, zero does not; TS/Rust same ordinal | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Held-pose law (rotation/scale/identity/determinism) | `npx vitest run src/animation/recordedStrokeMotion.test.ts` (packages/efx-paint-host) | 7/7 passed | ✓ PASS |
| Reveal bake off parity, on-composite posing, static posing, zero-motion parity | `npx vitest run src/components/physic-paint/roto/physicsPaintRotoRevealBake.test.ts` (app) | 35/35 passed | ✓ PASS |
| Controller routing/reset/matcher/ack/summary/static rigid pass | `npx vitest run src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts` | 162/162 passed | ✓ PASS |
| Persistence / dialog rows / right-panel rows / golden hash pins | `npx vitest run` on loop clips (98), dialog (63), right panel (39), reveal store (33), types (61) | all passed; 456 tests in the six-file app batch (491 with the reveal-bake suite) | ✓ PASS |
| TypeScript typecheck | `npx tsc --noEmit` (app) | exit 0, no errors | ✓ PASS |
| Rust canonical tests | `cargo test --manifest-path app/src-tauri/Cargo.toml --lib script_library` | 15/15 lib tests passed; both named canonical tests ok | ✓ PASS |
| Source changed since prior verification | `git diff --stat d0d9b9ee..HEAD -- . ':(exclude).planning'` | empty — docs-only commit; no implementation file moved | ✓ PASS |
| Dependency / bundle budget guard | `git diff --stat c575c919..d0d9b9ee -- pnpm-lock.yaml app/package.json package.json` | empty — no new dependencies | ✓ PASS |

The full workspace suite was run by the prior pass at `d0d9b9ee` (357 files, 6489 tests, exit 0). Because every covered implementation file is byte-identical between `d0d9b9ee` and HEAD, that result carries forward; this refresh re-ran the bounded requirement-linked suites instead of the whole workspace.

### Probe Execution

N/A — no `scripts/*/tests/probe-*.sh` probes are declared or implied for this quick task.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| QUICK-261030-EY9 | `261030-ey9-PLAN.md` (`requirements:`) | Reveal Photo wiggle toggle plus Rotation/Scale wiggle in all modes | ✓ SATISFIED | Truths 1-7 above; 7/7 verified with behavioral tests. |

No orphaned requirements: `.planning/REQUIREMENTS.md` and `.planning/ROADMAP.md` hold no `261030-ey9` / `QUICK-261030` mapping (quick tasks are ad-hoc and not listed in the milestone contract).

### Decision Coverage

Skipped — the gate reported `{"skipped": true, "reason": "no trackable decisions"}` for `261030-ey9-CONTEXT.md` (quick CONTEXT decisions are prose bullets, not a decision-tagged block). Non-blocking.

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
|-----------|-----------|--------|---------|----------|-----------------|---------|
| `recordedStrokeMotion.test.ts` | QUICK-261030-EY9 | 7 | 0 | No | Value / Behavioral | PASS |
| `physicsPaintRotoRevealBake.test.ts` | QUICK-261030-EY9 | 35 | 0 | No | Behavioral (call args, canvas counts) | PASS |
| `physicsPaintRotoPlayScriptController.test.ts` | QUICK-261030-EY9 | 162 | 0 | No | Behavioral | PASS |
| `PhysicsPaintPlayScriptDialog.test.ts` | QUICK-261030-EY9 | 63 | 0 | No | Value / Behavioral | PASS |
| `physicsPaintRotoLoopClips.test.ts` | QUICK-261030-EY9 | 98 | 0 | No | Behavioral (round-trip) | PASS |
| `PhysicsPaintRightPanel.test.ts` | QUICK-261030-EY9 | 39 | 0 | No | Value / Behavioral | PASS |
| `efxPaintStore.reveal.test.ts` | QUICK-261030-EY9 | 33 | 0 | No | Behavioral | PASS |
| `physicPaint.test.ts` | QUICK-261030-EY9 | 61 | 0 | No | Value (golden hash pins) | PASS |
| Other changed test files (12) | QUICK-261030-EY9 | full-suite green at `d0d9b9ee` | 0 | No | Behavioral | PASS |

**Disabled tests on requirements:** 0 — the `.pending` grep hits are identifiers (`pendingOperationId`, `pendingEffects`), not disabled tests.
**Circular patterns detected:** 0 — the `writeFile` hits are `vi.fn` mocks, not fixture generators.
**Insufficient assertions:** 0.
**Provenance note (non-blocking):** cross-language parity is proven by parallel TS and Rust self-consistency tests plus ordinal code inspection, not by a shared golden fixture. That is PARTIAL provenance — a shared fixture would harden truth 7 against future ordinal drift. It does not change the verdict: the emission order and nonzero gating are identical in both encoders at HEAD (`physicsPaintRotoPhysicalModel.ts:1427,1474-1475` vs `script_library.rs:1455-1459,1639-1643`).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No `TBD` / `FIXME` / `XXX` markers in any changed file | — | None |
| — | — | No stub returns, hardcoded empty renders, or no-op handlers in the new paths | — | None |
| — | — | No Preact reactivity violations in the changed surfaces (no `useState`, no render-body signal writes; `updatePanelMotion` is an event-handler write with stable `[]` deps reading `launchContextRef`) | — | None |

No blockers, no warnings.

### Observations (non-blocking)

1. The reveal-creation applied summary at `physicsPaintRotoPlayScriptController.ts:1485` still prints only `Motion d/p` and omits `Rotation`/`Scale`, while the Apply path's `composeSummaryLine1` (`:2239-2248`) appends them when nonzero. Cosmetic string only; not part of any must-have. Candidate for a follow-up tidy-up.
2. `packages/efx-paint-host/dist/` is gitignored and was rebuilt locally (SUMMARY deviation). Vitest resolves the host via source aliases (`app/vite.config.ts`); `tsc --noEmit` resolves through `dist`, which currently contains the rotation/scale law (verified present). Existing monorepo setup, not a phase defect.
3. Prior pass wording corrected: the rotation/scale settings carry-through is **three** rebuild helpers (`normalizeTimelineSettings`, `toPhysicPaintRotoInterpolationSettingsLegacy`, `toPhysicPaintRotoInterpolationSettings`) plus the shared `RotoInterpolationSettings` type in `physicsPaintRotoWorkflow.ts:22-23`. The type carries the fields; it is not a fourth rebuild. Truth 5 is unaffected — all three rebuild sites preserve both fields.

### Deferred Items (documented out-of-scope — `261030-ey9-deferred-items.md`)

These were found during review, are pre-existing or unreachable through enabled UI paths, and are not gaps against this quick task's must-haves. Each needs a separate decision.

1. **TS/Rust canonical parity for `railKind` (WR-02, pre-existing since 52-01).** The TS encoder emits `railKind` while the Rust encoder does not, so a reveal physical document can hash differently and be rejected with "Target physical hash does not match the canonical physical document". This phase's rotation/scale terms are at matching ordinals; `railKind` remains the known divergence.
2. **`replayRevealRail` has no production caller (IN-01).** It is exported and tested, but the "reopen + replay reproduces the creation bake" guarantee is test-only today.
3. **`AnimationPlayer` forwards only deformation/position (IN-03).** The shared host player carries two channels; its only instantiator today is a test fixture.

### Human Verification Required

Live Studio visual UAT is human-owned; these are judgment checks, not gaps.

#### 1. Photo wiggle cohesion (Reveal Motion and Reveal Static)

**Test:** Create a Reveal rail in both modes with Photo wiggle checked and nonzero Move/Deform/Rotation/Scale, then play it.
**Expected:** Photo and wash move as one rigid unit per held frame, holding each pose for 2 frames, with no separation between photo and pigment.
**Why human:** Motion feel and composite cohesion are visual judgments.

#### 2. Rotation pivot and amount (all four modes)

**Test:** Set Rotation to 100 with the other channels at 0 in Paint Motion, Paint Static, Reveal Motion, and Reveal Static.
**Expected:** Each element rotates up to ±10 degrees around its own centre; the sheet and revealed composite pivot on their own centre and do not jump position.
**Why human:** Pivot correctness and perceived amount require watching the live animation.

#### 3. Scale amount and drift (all four modes)

**Test:** Set Scale to 100 with the other channels at 0 in all four modes.
**Expected:** Each element breathes ±10 percent uniformly around its own centre, without drift.
**Why human:** Uniformity and drift are visual judgments.

#### 4. Control surfaces share one model

**Test:** Edit Rotation/Scale in the Create Rail dialog Motion wiggle card and in the right-panel Motion tab; perform an unrelated interpolation edit.
**Expected:** Both surfaces show the same values, clamp to integers 0-100, and neither is zeroed by the unrelated edit; the Photo wiggle card appears in reveal arms only.
**Why human:** Cross-surface live sync and panel layout are running-app behaviors.

#### 5. Persistence across reopen

**Test:** Create the reveal rail with Photo wiggle plus nonzero Rotation/Scale, close and reopen the project, then inspect the loop clip and its edit dialog.
**Expected:** Photo wiggle remains checked and the Rotation/Scale values are restored from disk.
**Why human:** End-to-end persistence through the real launch/load path is a live-app check.

### Gaps Summary

No gaps. All seven must-have truths are implemented in the codebase and backed by passing behavioral tests re-run at HEAD; the off path is byte-identical by test and golden hash pins; the rotation/scale law, its four-channel classification, the two control surfaces on one settings model, and the conditional TS/Rust canonical terms are all present and wired. The covered digest was refreshed after the docs-only commit `724eb105`; implementation source is unchanged from the previously verified `d0d9b9ee`. The only remainder is live Studio visual UAT, which is human-owned — therefore this report is `human_needed`, not `gaps_found` and not `passed`.

---

_Verified: 2026-10-30T12:00:51Z_
_Verifier: Claude (gsd-verifier)_
