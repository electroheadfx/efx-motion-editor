---
phase: 261031-qps-task-quick-b-follow-up-to-quick-261031-i
plan: 01
subsystem: physic-paint-roto
tags: [preact-signals, roto, play-script, loop-clip, reveal, durable-base, aquarelle]

requires:
  - quick: 261031-i54
    provides: Run Script stacking onto an existing flag-on Paint rail (frame, collision, undo laws)
  - quick: 261029-vbp
    provides: Reveal colorize pair on the Loop Clip
  - quick: 261030-ey9
    provides: Reveal photoWiggle flag on the Loop Clip
  - quick: 261030-v1t
    provides: Reveal paintSeedVariation flag on the Loop Clip
  - quick: 261030-np9
    provides: Per-key rail script recorder (append/replace) and the reveal bake anchors

provides:
  - One pure durable-base authority (`resolveScriptBase`) consumed by prepare/publish and the raster-key edit path
  - Pixel-only Paint rail Keep script 2x2 (ON = authority-backed union append, OFF = flatten over current picture)
  - Frame overrides inside a written span are legal and resolve to the source key's base
  - Reveal rails as legal Run Script stack destinations with a render-only photo-reference tail bake
  - Reveal stack dialog composition (Colorize / Photo wiggle / Paint seed; read-only reference notice)
  - `renderRevealTailFrames` render-only store port (no records, no interpolation break)

affects: [physic-paint-roto, roto-play-script, roto-reveal, physics-paint-studio]

actuals:
  tokens: 49174
  tasks: 3
  commits: 11

tech-stack:
  added: []
  patterns:
    - "Pure base-resolution authority over injected lookups (reveal → persisted → session → pin-if-no-strokes → fail closed)"
    - "Render-only store ports that never write records or breaks; the caller owns the single atomic publication"
    - "Full-coverage assertion over destination frames before the single ports.commit"

key-files:
  created:
    - app/src/components/physic-paint/roto/aquarelleScriptBaseAuthority.ts
    - app/src/components/physic-paint/roto/aquarelleScriptBaseAuthority.test.ts
  modified:
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoRunScriptStacking.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts
    - app/src/components/physic-paint/hooks/useRotoPlayScriptController.ts
    - app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx
    - app/src/stores/physicPaintStore.ts

key-decisions:
  - "The reveal axis is evaluated FIRST in the authority: a reveal-owned key is never a pixel base, never known-empty and never a base refusal."
  - "`durableBaseKeyId` was deleted from RotoScriptPhysicalTarget; a runtime `durableBaseKind: 'pixels' | 'reveal'` drives the publish dispatch instead."
  - "Pixel-only Keep ON appends this run over the authority-pinned pre-run picture; Keep OFF composites over the current picture and records nothing; flag-on Keep OFF keeps Quick A's replace. `keyScriptEdits` is never written by a stack path."
  - "A reveal stack renders through the rail's own placed reference: fast whole-span path when no destination key owns recorded strokes, per-slice `frameCount: 1` union render otherwise."
  - "The reveal render-only port asserts the touched-frame set equals the destination frames exactly before the single `ports.commit`; any extra, duplicate or missing frame aborts with zero writes."
  - "Reveal stack knobs are adopted only when ON and stored knobs are omitted for a reveal target, so an all-off reveal run persists byte-identical to a pre-quick rail."
  - "`stackRailKind` derives from the PINNED run destination, so scrubbing cannot flip the dialog composition mid-run."
  - "The publish path now renders reveal-owned keys through the SAME reveal seam; `reveal-base-unsupported` survives only in `bakeStackedRailKey`, a different seam."

patterns-established:
  - "One durable-base authority: every script path (create Apply, raster-key edits, stacking, occurrences, overrides) resolves through resolveScriptBase in the locked order."
  - "Render-only bake ports: renderRevealTailFrames / bakeRevealStackTail return frames + anchors and write nothing."

requirements-completed: [QUICK-261031-QPS]

coverage:
  - id: D1
    description: "One durable-base authority resolves every script base in the locked order and fails closed; the raster-key edit path delegates to it."
    requirement: QUICK-261031-QPS
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/aquarelleScriptBaseAuthority.test.ts"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#ensureAquarelleDurableBaseRef authority pins"
        status: pass
    human_judgment: true
    rationale: "The resolution order is proven by unit tests, but the user-visible refusal/erase outcome needs the live UAT rows."
  - id: D2
    description: "Pixel-only Paint rail exposes an enabled Keep script switch seeded ON; ON preserves the pre-run picture; OFF flattens with no record; flag-on Keep OFF still replaces; keyScriptEdits is never written."
    requirement: QUICK-261031-QPS
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts#pixel-only Keep 2x2"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#authority-backed union re-bake port pins"
        status: pass
    human_judgment: true
    rationale: "Re-bake, save/reopen and repeat no-doubling are visual outcomes only the live app can prove."
  - id: D3
    description: "A frame override inside the written span applies and resolves its base to the source key, never the override composite."
    requirement: QUICK-261031-QPS
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoRunScriptStacking.test.ts"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts#applies a run whose span contains a frame override"
        status: pass
    human_judgment: true
    rationale: "The composite-vs-base law is pinned in tests; the live row confirms no visual erase on override keys."
  - id: D4
    description: "A Reveal rail is a legal stack destination: the run renders through the rail's own placed reference, full frame coverage is asserted before the single commit, and a missing reference refuses with zero writes."
    requirement: QUICK-261031-QPS
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts#renders through the photo reference, adopts the knobs and appends on Keep ON"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts#aborts a Reveal stack run with zero writes when the tail render misses a frame"
        status: pass
      - kind: unit
        ref: "app/src/stores/physicPaintStore.test.ts#261031-qps renderRevealTailFrames"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#pins the render-only reveal stack tail"
        status: pass
    human_judgment: true
    rationale: "Same photo, new wash and no plain-paper mixing are visual laws the user must verify live."
  - id: D5
    description: "The reveal stack dialog shows Colorize / Photo wiggle / Paint seed, hides Rail Type / Motion wiggle / Color / Key Script, and shows the reference as the rail's own and non-editable."
    requirement: QUICK-261031-QPS
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts#PhysicsPaintPlayScriptDialog reveal stacking (261031-qps)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoPlayScriptController.test.ts#261031-qps: forwards the render-only reveal tail port only when supplied"
        status: pass
    human_judgment: true
    rationale: "Card composition is source-pinned, but the visual layout of the dialog needs the live UAT pass."
  - id: D6
    description: "The extended Reveal rail survives a snapshot reload with the same rendered frames and repeat resolution, and one undo restores the pre-run rail."
    requirement: QUICK-261031-QPS
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts#reloads the extended Reveal rail with the same rendered frames and repeat resolution"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoLoopClips.test.ts#261029-vbp reveal colorize pair / photoWiggle round-trip"
        status: pass
    human_judgment: true
    rationale: "The reload bytes and repeat resolution are pinned, but save → reopen in the real app is the acceptance criterion."
  - id: D7
    description: "No persisted schema or format change: durable bases, rail metadata and every field Quick B needs already existed."
    requirement: QUICK-261031-QPS
    verification:
      - kind: other
        ref: "git diff --stat 04c28d1e1..055099a33 (no SNAP v5 serializer/validator, Loop Clip record type or persisted rail field module)"
        status: pass
    human_judgment: false

duration: 27m (first to last task commit)
completed: 2026-10-31
status: complete
plan_head_before: 04c28d1e1d91865499e5cc1760d91e807b3ac4f6
plan_head_after: 7293b26fec1242d6f6cdc912bb5659867500c747
commits: 4
---

# Quick 261031-qps: Run Script stacking, part B Summary

**Pixel-only rails Keep scripts through one durable-base authority, frame overrides inside a span became legal, and Reveal rails stack through their own placed photo reference with a render-only tail bake.**

## Performance

- **Duration:** 27m (first to last task commit; earlier sessions prepared the uncommitted work)
- **Completed:** 2026-10-31T19:41:46Z
- **Tasks:** 3
- **Files modified:** 16 (2 created, 14 modified)
- **Realized diff:** 2,201 insertions / 469 deletions (~49.2k estimate-scale tokens)

## Accomplishments

- One pure `resolveScriptBase` authority now answers every script base decision in the locked order (reveal → persisted SNAP v5 → session map → pin-the-current-payload when the key has no recorded strokes → `durable-base-unknown`), and both `prepareRotoScriptTarget` and the raster-key edit path consume it.
- Pixel-only Paint rails expose an enabled, ON-by-default Keep script switch: ON appends this run over the authority-pinned pre-run picture, OFF flattens over the current picture with no record and no pin, flag-on Keep OFF keeps Quick A's replace, and no stack path ever writes `keyScriptEdits`.
- Frame overrides inside the written span are legal again; their base resolves to the SOURCE key, so an override composite can never become a base.
- Reveal rails are first-class stack destinations: the dialog exposes Colorize / Photo wiggle / Paint seed as editable cards, hides Rail Type / Motion wiggle / Color / Key Script, and treats the placed reference as read-only.
- The reveal tail is baked render-only through the placed photo reference (`renderRevealTailFrames` → the exported `renderRotoRevealFrames`), with exact full-coverage asserted over the destination frames before the single `ports.commit`; a missing reference or a dropped frame aborts with zero writes, so plain-paper bytes can never land on a reveal frame.
- The Apply/paste publish dispatch now routes reveal-owned keys through the same reveal seam instead of the temporary `reveal-base-unsupported` refusal.
- No persisted schema or format changed.

## Task Commits

Each task was committed atomically:

1. **Task 1: Durable-base authority module + script-path rewiring + frame-override legality** - `296358f57` (feat)
2. **Task 2: Pixel-only Keep script 2x2 with an authority-backed stacking bake** - `852a22847` (feat)
3. **Task 3: Reveal rail stacking with a render-only photo-reference tail bake** - `ea512f8a0` (feat)
4. **Reload pin backfill: extended Reveal rail across a snapshot reload** - `219cada2d` (test)

_Note: the quick task's docs commit is intentionally left to the orchestrator._

### Code review remediation (`--full`)

| # | Commit | Finding |
|---|--------|---------|
| 5 | `18a1f93cc` | CR-01 — a zero-anchor stack run now fails closed before `ports.commit` |
| 6 | `375dd26b8` | WR-01 — durable-base pins land only after a successful commit |
| 7 | `fd8511de5` | WR-02 — the recording port is forwarded conditionally and required when recording |
| 8 | `f75c82f8c` | IN-01 — the reveal apply dispatch identity-checks its frame |
| 9 | `307010cbd` | IN-02 — the reveal-tail pin rejects interpolation-break writes |
| 10 | `055099a33` | Verifier follow-up — stale override-in-span comment corrected |
| 11 | `7293b26fe` | Verifier follow-up — two stale controller override comments corrected |

Re-review (`261031-qps-REVIEW-2.md`): all five findings fixed, no regression. One residual INFO (IN-03) remains: staged stack pins are not cleared on a controller-side abort after a successful union bake; not reachable today because the only append consumer always follows a bake that clears the stage.

## Files Created/Modified

- `app/src/components/physic-paint/roto/aquarelleScriptBaseAuthority.ts` - pure `resolveScriptBase` over injected lookups, fail closed
- `app/src/components/physic-paint/roto/aquarelleScriptBaseAuthority.test.ts` - full resolution matrix (order, Dry insensitivity, source-key mapping, reveal kind)
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` - authority-backed prepare/publish dispatch, raster-key edit delegation, `bakeStackedRailKey`, `bakeRevealStackTail`, reveal publish dispatch
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` - `stackRailKind`, reveal knob seeding/adoption, reveal confirm branch with full-coverage abort, Keep 2x2 record modes
- `app/src/components/physic-paint/roto/physicsPaintRotoRunScriptStacking.ts` - reveal rails as stack destinations, reveal knobs on the rail view, override-in-span legality
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts` - `durableBaseKeyId` removed, runtime `durableBaseKind` added
- `app/src/components/physic-paint/hooks/useRotoPlayScriptController.ts` - forwards `bakeRevealStackTail` only when the Studio supplies it
- `app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx` - reveal stack composition and read-only reference notice
- `app/src/stores/physicPaintStore.ts` - `renderRevealTailFrames` render-only port (reference walk, fail closed, abort rethrow)
- Tests: Studio, controller, stacking, clipboard, dialog, hook and store suites updated or extended with the pins listed in the coverage block

## Decisions Made

See `key-decisions` in the frontmatter. The load-bearing ones: the reveal axis is evaluated first in the authority; `durableBaseKind` is runtime-only; Keep ON appends while OFF flattens on pixel-only/reveal rails; the reveal tail is render-only and fully coverage-checked before the single commit; all-off reveal runs persist no knob.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Dialog reveal-stack cards broke the D-16 direct-children grid pins**
- **Found during:** Task 3 (dialog composition)
- **Issue:** The first composition wrapped `ColorCard` + `MotionWiggleCard` in a Fragment for the non-reveal branch, so the existing D-16 grid test could no longer locate them as direct children of the side stack and failed.
- **Fix:** Kept both cards as DIRECT children using two conditional expressions (Color absent on a reveal stack, Colorize in its place; Motion wiggle absent, Colorize card second), preserving the rendered child order the grid pins read.
- **Files modified:** `app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx`
- **Verification:** `PhysicsPaintPlayScriptDialog.test.ts` 79/79; full suite green.
- **Committed in:** `ea512f8a0` (part of Task 3 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 bug)
**Impact on plan:** No scope change; the fix preserves the locked D-16 grid law inside the new reveal composition.

## Issues Encountered

- The reveal reference walk clamps at the sequence end (`Math.min(frame, refs.length - 1)`), so the first store-test setup resolved every span frame onto a registered ref and never hit the fail-closed path. Rewrote the case to span from frame 0 with an unregistered middle ref, and documented the clamping in the test.
- The snapshot-reload pin was added as a small `test` commit after Task 3 to keep the Task 3 commit stable; it is the plan-mandated "extended rail survives save → reopen" evidence.

## Known Stubs

None.

## Threat Flags

None — every file in the plan's `<threat_model>` was implemented as designed (T-01 authority fail-closed, T-02 source-key resolution, T-03 full-coverage abort, T-04 pin-before-commit, T-05 no `keyScriptEdits` writes); no new trust boundary was introduced.

## Verification

- Task 1: authority + clipboard + stacking + controller suites — pass; Studio + dialog — pass; `durableBaseKeyId` occurrence gate — 0.
- Task 2: controller + Studio — pass; dialog + scripts panel + hook — pass; confirmStack-scoped flag gate — green.
- Task 3: stacking + controller — 285 pass (plus the reload backfill, controller 236); store + Studio — 432 pass; dialog + hook + renderer — 97 pass; `efxPaintStore.reveal.test.ts` — 39 pass.
- Full suite: 363 files (361 passed, 2 skipped), 6,783 passed, 1 skipped, 96 todo, 0 failed.
- Typecheck (`pnpm --filter efx-motion-editor run typecheck`): clean.
- Schema tripwire: no SNAP v5 serializer/validator, Loop Clip record type or persisted rail field module changed; no migration written.
- Code review: `261031-qps-REVIEW.md` (1 critical, 2 warnings, 2 info) and `261031-qps-REVIEW-2.md` (all five fixed, no regression).
- GSD verifier: `human_needed` — 6/7 must-haves verified; the live UAT rows below are the user's step.

## UAT Rows Handed to the User

- Pixel-only Paint rail: place the playhead inside it, Run Script, Keep ON (default) — the original picture stays under the new strokes after re-bake, save/reopen and a repeat; nothing doubles.
- Same rail, Keep OFF — the run lands over the current picture, no per-key script is recorded, and a later run does not replay the flattened strokes.
- Stack on an unscripted raster key, then edit the new strokes; the original raster remains after re-bake, save/reopen and repeat; an unprovable base shows a clear refusal and erases nothing.
- Frame override inside the written span: the run applies, override keys keep the source key's base, and the override composite never becomes the base.
- Reveal rail: Run Script with the playhead inside — Colorize / Photo wiggle / Paint seed are editable and adopted, Rail Type is hidden, the tail renders through the same placed photo, and repeating does not double; after save → reopen the picture and repeats are unchanged; one undo restores the pre-run rail.
- Reveal rail with no photo reference — a clear refusal, zero writes.
- Plain-paper keys never appear inside a Reveal rail.
- Regression: Quick A UAT rows 1-9 still pass, plus row 8 (Reveal) and the Reveal part of row 9.

## Next Phase Readiness

- Quick B ships automated-ready; live UAT rows above are open until the user runs them.
- No schema change means existing projects and snapshots reopen unchanged.
- No blockers.

---
*Quick task: 261031-qps*
*Completed: 2026-10-31*

## Self-Check: PASSED

- SUMMARY.md exists at `.planning/quick/261031-qps-task-quick-b-follow-up-to-quick-261031-i/261031-qps-SUMMARY.md`
- `aquarelleScriptBaseAuthority.ts` and its test exist
- All four commits are ancestors of HEAD: `296358f57`, `852a22847`, `ea512f8a0`, `219cada2d`
- Full suite 0 failed; typecheck clean
