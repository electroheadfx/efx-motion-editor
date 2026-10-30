---
phase: 261030-ey9-reveal-rail-wiggle-enhancement
plan: 01
subsystem: physic-paint-roto
tags: [roto, reveal, stop-motion, wiggle, rotation, scale, persistence, canonical-revision, preact-signals]

# Dependency graph
requires:
  - phase: 261029-vbp
    provides: Reveal tab colorize card and reveal Loop Clip persistence seams
  - phase: 52.1
    provides: deterministic held-pose law (poseNoise, 2-frame hold, hashStroke) and aquarelle sheet pose/deform passes
provides:
  - Reveal Photo wiggle toggle that rigidly moves the whole revealed composite (photo + wash) per held frame
  - Rotation (channel 9, ±10 deg) and Scale (channel 10, ±10 pct) channels of the shared deterministic wiggle law
  - Create Rail dialog Rotation/Scale rows and right-panel Rotate/Scale rows on one settings model
  - Conditional canonical persistence of rotation/scale (TS + Rust at identical ordinals, nonzero-gated)
affects:
  - Reveal rail bake and static held-pose paths
  - Future motion channels and any consumer of PhysicPaintRotoScriptMotionSettings
  - Project canonical revision (legacy projects remain byte-identical)

actuals:
  tokens: 39845    # chars/4 over the realized diff (git diff c575c919..af2c82b8 | wc -c = 159381)
  tasks: 3
  commits: 3
  plan_head_before: c575c9198806f3dda752eedfe85df48e8b74dc5c
  plan_head_after: af2c82b88d2ad43d397c0fdb86908f26c478378a

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-pass sheet pose: band deformation runs first, then ONE outer rigid pose applied to the whole staged composite"
    - "Presence-preserving settings carry: optional rotation/scale survive every rebuild via typeof-guarded spreads, never required fields"
    - "Conditional canonical terms: encode rotation/scale only when nonzero, at identical ordinals in TypeScript and Rust"

key-files:
  created:
    - app/src/components/physic-paint/roto/physicsPaintRotoKeyController.test.ts
  modified:
    - packages/efx-paint-host/src/animation/recordedStrokeMotion.ts
    - app/src/components/physic-paint/roto/aquarelleFramePose.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
    - app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx
    - app/src/components/physic-paint/view/RightPanelOnionMotionTabs.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/stores/physicPaintStore.ts
    - app/src-tauri/src/services/script_library.rs

key-decisions:
  - "Photo wiggle moves the finished reveal composite as one rigid unit; off keeps today's behavior byte-identical"
  - "Rotation/scale are channels of the existing held-pose law (centroid pivot, 2-frame hold), not a separate jitter source"
  - "Rotation/scale stay optional on the runtime settings type; only DEFAULT_ROTO_INTERPOLATION_SETTINGS and the store normalizer materialize zeros"
  - "Canonical rotation/scale terms are emitted only when nonzero in both encoders, preserving both golden project pins"

requirements-completed: [QUICK-261030-EY9]

coverage:
  - id: D1
    description: "Reveal Photo wiggle toggle moves photo plus wash as one rigid held pose in Reveal Motion and Reveal Static, and is persisted on the reveal Loop Clip only when true"
    requirement: QUICK-261030-EY9
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoLoopClips.test.ts#photoWiggle round-trip"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts#photoWiggle routing"
        status: pass
    human_judgment: true
    rationale: "The visible boil must be judged live: the composite rigid-poses per held frame without shearing wash from photo."
  - id: D2
    description: "Rotation and Scale channels of the deterministic law: ±10 degrees / ±10 percent at 100, 2-frame hold, seeded, per-stroke centroid pivot, in all four modes"
    requirement: QUICK-261030-EY9
    verification:
      - kind: unit
        ref: "packages/efx-paint-host/src/animation/recordedStrokeMotion.test.ts#rotation/scale laws"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoHoldDeterminism.test.ts#four-channel determinism"
        status: pass
    human_judgment: true
    rationale: "Visual sign-off (live Studio) that the motion reads as a stop-motion hold with per-element pivots."
  - id: D3
    description: "Rotation and Scale controls in the Create Rail Motion wiggle card and the right-panel Motion tab, reading and writing one settings model with 0-100 clamps"
    requirement: QUICK-261030-EY9
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts#Rotation and Scale rows"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts#Rotate and Scale steppers"
        status: pass
      - kind: unit
        ref: "app/src/stores/physicPaintStore.test.ts#rotation/scale survival and clamp"
        status: pass
    human_judgment: true
    rationale: "Round-trip UX between the two surfaces needs live confirmation, plus the 100-value feel."
  - id: D4
    description: "Conditional canonical persistence of rotation/scale (TS + Rust at identical ordinals), clip rebuilds round-trip photoWiggle, legacy projects reopen unchanged and both golden pins stay put"
    requirement: QUICK-261030-EY9
    verification:
      - kind: unit
        ref: "app/src-tauri/src/services/script_library.rs#canonical_physical_hash_ignores_zero_motion_rotation_and_scale"
        status: pass
      - kind: unit
        ref: "app/src/types/physicPaint.test.ts#golden pins project-598-5cf0b794 / project-305-ed764eca"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts#photoWiggle payload clone"
        status: pass
    human_judgment: false

# Metrics
duration: 70min
completed: 2026-10-30
status: complete
---

# Quick 261030-ey9: Reveal Photo Wiggle + Rotation/Scale Channels Summary

**Reveal Photo wiggle rigidly boils the whole revealed composite per held frame, and Rotation (channel 9) plus Scale (channel 10) extend the deterministic stop-motion law to all four modes, controlled from both surfaces on one settings model with conditional canonical persistence.**

## Performance

- **Duration:** ~70 min (plan start 10:54 local, final commit 11:55 local)
- **Started:** 2026-10-30T09:54:59Z (approx; plan finalized 11:34 local)
- **Completed:** 2026-10-30T10:55:08Z
- **Tasks:** 3
- **Files modified:** 42 (41 in the measured range plus the new key-controller test file)
- **Measured commits:** 3 (`c575c919..af2c82b8`)

## Accomplishments

- Reveal "Photo wiggle" toggle: the Reveal bake masks the unposed coverage, then applies exactly ONE rigid held pose to the finished composite around the placed photo centre, per held frame, in both Reveal Motion and Reveal Static; off is byte-identical to today.
- Rotation and Scale are now channels of the existing deterministic law: integer percent 0-100, ±10 degrees / ±10 percent uniform at 100, 2-frame hold, seeded FNV-1a noise, pivot at each element's own centroid (photo pivot = the placed reference centre), rigid-then-offset-then-deform ordering.
- Two surfaces, one settings model: Create Rail dialog rows (Rotation/Scale after Deformation/Position, routed through `toDialogMotion` so every write carries four numeric channels) and right-panel SliderStepper rows (Rotate/Scale after Deform/Move); Studio reads/writes both through the SAME memoized interpolation record with one `setRotoInterpolationSettings` call.
- Four settings-rebuild sites no longer silently zero the new channels (`_normalizeRotoInterpolationSettings`, `normalizeTimelineSettings`, `toPhysicPaintRotoInterpolationSettingsLegacy`, `toPhysicPaintRotoInterpolationSettings`), each covered by a survival test; two mappers exported solely for that decidability.
- Persistence is conditional and cross-language identical: rotation/scale canonical terms are emitted only when nonzero at identical ordinals in TypeScript and Rust, clip-rebuild sites round-trip `photoWiggle`, and both golden project pins (`project-598-5cf0b794`, `project-305-ed764eca`) remain byte-identical.

## Task Commits

Each task was committed atomically:

1. **Task 1: Reveal Photo wiggle toggle and rigid composite bake** — `d87efcfd` (feat)
2. **Task 2: Rotation and scale channels for the deterministic wiggle law** — `7d5248c3` (feat)
3. **Task 3: Rotation and Scale controls on one settings model** — `af2c82b8` (feat)

## Files Created/Modified

- `packages/efx-paint-host/src/animation/recordedStrokeMotion.ts` — rotation (9) / scale (10) channels, centroid pivot, rigid-then-offset-then-deform
- `app/src/components/physic-paint/roto/aquarelleFramePose.ts` — optional pivot, `isSheetMotionZero`, `applyAquarelleSheetRigidWiggle`, two-pass poser
- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts` — photoWiggle, optional motion rotation/scale, `compactPhysicPaintRotoMotion`, canonical emission
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` — reveal bake/static routing, four-key `dialogMotion` + `toDialogMotion`, compaction at every loop write, identical-cycle rotation/scale matching
- `app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx` — Photo wiggle card and Rotation/Scale rows
- `app/src/components/physic-paint/view/RightPanelOnionMotionTabs.tsx` — Rotate/Scale SliderStepper rows
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — one-record `playWiggle` read, single-write `updatePanelMotion`, two `getMotion` ports
- `app/src/stores/physicPaintStore.ts` — `DEFAULT_ROTO_INTERPOLATION_SETTINGS` rotation/scale, normalizer clamps
- `app/src/types/physicPaint.ts` — optional rotation/scale on `PhysicPaintRotoInterpolationSettings` with percent-integer validation
- `app/src-tauri/src/services/script_library.rs` — conditional rotation/scale canonical terms in both motion blocks
- `app/src/components/physic-paint/roto/physicsPaintRotoKeyController.test.ts` — NEW: legacy mapper survival and fallback

## Decisions Made

- Photo wiggle applies ONE rigid held pose to the finished composite (mask unposed coverage first); no per-element split, no separate strength slider.
- Rotation/scale use the existing held-pose law and channels 9/10, which were provably free.
- The persisted motion record stays compact (rotation/scale only when nonzero); the dialog signal materializes four values so the UI never renders `undefined`.
- Legacy mapper falls back to the fallback record's channels when the source omits them.
- `composeSummaryLine1` deliberately keeps the `Motion d/p` copy; its parameter is structurally compatible, so no copy change.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Widened the legacy `RotoInterpolationSettings` interface to carry rotation/scale**
- **Found during:** Task 3 (controls)
- **Issue:** Both settings mappers read `RotoSourceDisplayModel['settings']` (`RotoInterpolationSettings` in `physicsPaintRotoWorkflow.ts`), which lacked rotation/scale, so the plan's presence-preserving carry was not expressible without a cast.
- **Fix:** Added optional `rotation?`/`scale?` to `RotoInterpolationSettings`; existing spread-based constructions are unaffected.
- **Files modified:** `app/src/components/physic-paint/roto/physicsPaintRotoWorkflow.ts`
- **Verification:** Typecheck clean; mapper survival tests pass.
- **Committed in:** `af2c82b8` (Task 3 commit)

**2. [Rule 3 - Blocking] Rebuilt the `@efxlab/efx-paint-host` dist type declarations**
- **Found during:** Task 2 verification
- **Issue:** `pnpm run typecheck` failed (TS2353) at two consumers because tsc resolves the package from its stale `dist/*.d.ts` while vite maps to src.
- **Fix:** Ran `pnpm --filter @efxlab/efx-paint-host build` (tsup) to regenerate the DTS declarations.
- **Files modified:** untracked/ignored `packages/efx-paint-host/dist` build output
- **Verification:** Typecheck clean immediately after.
- **Committed in:** not committed (generated build artifact)

---

**Total deviations:** 2 auto-fixed (both Rule 3 blocking)
**Impact on plan:** Both were necessary for type safety and the declared presence-preserving carry; no scope creep, no dependency added.

## Issues Encountered

- The plan's line-number enumerations for test pins had shifted after Task 2; all nine `dialogMotion` assignments and every exact-shape pin were located by grep/typecheck instead. Two additional bake-input pins (`bakePose.poser` at two sites) had to become four-key once `dialogMotion` materialized zeros.
- Store partial updates MERGE with current settings; the clamp test's "absent members default to 0" assertion used a fresh track id to avoid a false failure.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Next Phase Readiness

- Automated evidence is complete: full app suite 357 files / 6487 tests passed (1 skipped, 96 todo), Rust `script_library` 15 passed, typecheck clean, golden pins untouched.
- Live Studio UAT remains (human): toggle Photo wiggle in both Reveal variants, drive Rotation/Scale to 100 and confirm a stop-motion hold with per-element pivots and a photo pivot that follows the placed reference.
- No new dependency; bundle ceiling untouched.

---
*Quick: 261030-ey9-reveal-rail-wiggle-enhancement*
*Completed: 2026-10-30*

## Self-Check: PASSED

## Review Follow-up (post-execution, commit d0d9b9ee)

Code review found and fixed one critical defect and three warnings:

- CR-01: `drawAquarelleSheetPose` moved only the translate for the pivot, not the draw origin, so an offset placed photo shifted the whole baked reveal. The draw origin now follows the pivot; the reveal-bake test pins the posed `drawImage` args to `[-pivot.x, -pivot.y, w, h]`.
- WR-01: the commit-acknowledgement guard now compares rotation/scale and `photoWiggle`; two ack-drop cases are tested.
- WR-03: the applied summary reports nonzero Rotation/Scale instead of a bare "Motion 0/0".
- IN-02: timeline settings normalize rotation/scale as percent integers.

Deferred items (pre-existing or unreachable): see `261030-ey9-deferred-items.md`.

