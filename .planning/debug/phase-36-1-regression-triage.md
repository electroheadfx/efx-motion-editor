---
status: checkpoint
trigger: "Phase 36.1 regression triage after Codex edits. Goal: document current uncommitted working tree, identify intended vs suspicious changes, preserve state, and produce a GSD debug note/checkpoint before any fix. Do not run the app server. Do not reset, discard, or commit changes. Focus on Play canvas / strokes / timeline / store / bridge regressions and current modified files."
created: "2026-06-14"
updated: "2026-06-14"
---

# Debug Session: Phase 36.1 Regression Triage

## Symptoms

### Expected behavior
- Phase 36.1 Play paint script animation behavior should remain aligned with the phase goal: saved Play markers/timeline segments drive the active segment, Play preview interpolates/sequences physics strokes predictably, and rendered Play paint scripts behave like one sequenced pencil stroke path rather than parallel hands.
- Existing Phase 36.1 work should preserve intended UI/store/bridge/engine behavior without unrelated regressions.
- Current uncommitted Codex edits should be documented before any fix, reset, discard, or commit.

### Actual behavior
- User reports Codex made many modifications and introduced multiple regressions on GSD Phase 36.1.
- Codex appears not to have committed the changed files.
- Working tree contains many modified Phase 36.1-related source and test files plus untracked debug notes.

### Error messages
- No specific runtime error pasted yet.
- Investigation should use git diff, tests, and source inspection; do not run the app server.

### Timeline
- Started after recent Codex edits on 2026-06-14, following Phase 36.1 execution/checkpoint work from 2026-06-13.
- Recent commits include Phase 36.1 Play canvas preview checkpoint fixes and saved play marker tests.

### Reproduction
- Not yet narrowed to a single repro.
- Focus areas: Play canvas, stroke sequencing, timeline markers, physics paint store, bridge, animation player/engine.

## Current Focus

- hypothesis: Current uncommitted edits combine documented follow-up fixes for Play sequencing/duration/cache regressions with a larger Play-motion UI feature; automated checks are green after using the correct test roots, but human UAT is still required before fixing/committing.
- test: Non-destructive diff audit of current git status/diff, Phase 36.1 validation/debug artifacts, focused Phase 36.1 tests, package animation test, app typecheck, and diff whitespace check.
- expecting: Preserve working tree; classify intended vs suspicious/needs-decision changes; do not run server, reset, discard, commit, or modify source.
- next_action: user-run visual verification of current working tree, then decide whether to keep/commit the Play-motion additions or split/remove them before any fix pass
- reasoning_checkpoint: Debug note records current uncommitted state and evidence; no source code was changed by this triage.
- tdd_checkpoint: n/a

## Evidence

- timestamp: "2026-06-14"
  observation: "Working tree is uncommitted and broad: 18 modified source/test files plus four untracked debug notes. Modified areas are Physics Paint studio/right panel/workflow strip/CSS, physicPaint bridge/store/types and tests, efx-physic-paint AnimationPlayer/types/index/tests, engine, and package types."
- timestamp: "2026-06-14"
  observation: "Diff size is 960 insertions and 186 deletions across the 18 modified files, so this is not a small targeted hotfix."
- timestamp: "2026-06-14"
  observation: "Existing debug notes `play-canvas-parallel-strokes.md` and `sequenced-stroke-duration-lag.md` are resolved and directly explain several uncommitted changes: monotone sequential playFrame allocation, tight-duration overflow distribution, avoiding hot-path `engine.save().strokes.length`, clearing stale cached previews, removing leaked Roto gap duration limits from Play mode, and making stale Play Space/Enter save/apply instead of previewing stale cache."
- timestamp: "2026-06-14"
  observation: "AnimationPlayer diff matches the resolved regression direction: playFrame is now a minimum start anchor inside recorded-order allocation, allocation recomputes remaining frame/weight budgets, and the strokeCount > frameCount branch spreads shared frames across the full range. Tests add parallel-stroke, anchored duration, 20-strokes/16-frames overflow, and wiggle coverage."
- timestamp: "2026-06-14"
  observation: "Engine diff adds `getStrokeCount()` and switches brush render radius calculations to `(size || 24) / 2` through `brushRenderRadius()`. The stroke-count API is explained by the lag regression note; the brush radius normalization may be intentional render parity but is broader than the Play regression and needs visual confirmation."
- timestamp: "2026-06-14"
  observation: "Bridge/store/types diffs add Play cache status, cached Play frames, selected playScriptId replacement, stale convert-roto-to-play ranges, and persisted `playMotion`. Cache/range pieces align with Phase 36.1 Play relaunch/cache goals; `playMotion` is a new feature surface requiring user decision if it was not requested for this triage."
- timestamp: "2026-06-14"
  observation: "Studio/workflow strip diffs add cached-frame hydration, stale-cache handling, `withoutRotoGapLimit()`, Play-frame edit capture with `getStrokeCount()`, stale Play primary action behavior, and Play wiggle plumbing. These mostly map to resolved regression notes, but the right-panel Play Motion controls plus Save/Load State buttons broaden the UI and should be accepted or split intentionally."
- timestamp: "2026-06-14"
  observation: "Initial focused test command using `app/src/...` paths from `--dir app` failed with no test files found. Re-running with app-relative `src/...` paths passed 84 app tests; package AnimationPlayer test passed separately using repo root and package vitest config."
- timestamp: "2026-06-14"
  observation: "Verification run: app focused tests passed (5 files, 84 tests); package AnimationPlayer tests passed (1 file, 11 tests); `pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app typecheck` passed; `git diff --check` passed. The app server was not run."
- timestamp: "2026-06-14"
  observation: "Phase 36.1 validation remains ready for human verification and explicitly requires user-run app checks for nested timeline markers, scrubber-contained open behavior, local Play preview/cache replacement, and sequential one-hand Play animation."

## Classification

### Intended / likely keep
- `packages/efx-physic-paint/src/animation/AnimationPlayer.ts` and `.test.ts`: sequential playFrame anchoring, remaining-budget duration fitting, 20-strokes/16-frames overflow distribution.
- `packages/efx-physic-paint/src/engine/EfxPaintEngine.ts`: `getStrokeCount()` for avoiding full serialization during Play edit bookkeeping.
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` pieces for cached Play frame hydration, stale cache dirtying, `withoutRotoGapLimit()`, stale Play Space/Enter save/apply, and Play edit capture.
- `app/src/lib/physicPaintBridge.ts`, `app/src/stores/physicPaintStore.ts`, `app/src/types/physicPaint.ts` pieces that preserve selected saved Play script launch context, cache status, cached frames, and range replacement/overlap semantics.

### Suspicious / needs user decision before commit
- Play Motion / wiggle feature (`AnimationWiggleConfig`, `playMotion`, right-panel Deform/Move sliders, persisted `playMotion`, tests). This is larger than the documented regression fixes; keep only if it is intended Phase 36.1 scope.
- Right-panel `Save state` / `Load state` buttons were added alongside Play Motion. They may be useful debugging controls but are unrelated to the reported Play regressions and may violate UI spec fidelity if not requested.
- `brushRenderRadius()` changes halve brush size for preview/cursor/render/physics bounds. This could fix a scale bug, but it affects all physics painting and must be visually checked for Roto/Play parity before treating as safe.
- Workflow strip visual/layout changes replace the previous Save play text button with a primary icon action and per-frame cell strip. This may be intentional polish but should be checked against Phase 36.1/Pencil UI specs.

## Eliminated

- hypothesis: "The working tree is wholly broken or unverifiable."
  reason: "Focused app tests, package animation tests, app typecheck, and diff whitespace check pass after using correct test roots. Remaining risk is UX/regression scope, not an immediate compile/test failure."
- hypothesis: "The Play parallel-stroke regression remains undocumented."
  reason: "`play-canvas-parallel-strokes.md` records root cause/fix, and current AnimationPlayer diff contains matching monotone allocation changes and regression tests."
- hypothesis: "The duration clipping/lag regression remains undocumented."
  reason: "`sequenced-stroke-duration-lag.md` records root cause/fix, and current diffs contain matching remaining-budget allocation, overflow distribution, `getStrokeCount()`, stale-cache action, and gap-limit changes."

## Checkpoint

- type: "classification_review"
- status: "awaiting_user_visual_verification_and_scope_decision"
- details: "Triage preserved the uncommitted working tree and classified current changes. Automated verification is green, but Play Motion/right-panel additions, brush radius normalization, and workflow strip visual changes need explicit user approval or should be split out before a commit/fix pass."
- recommended_next_action: "User runs the app locally and performs Phase 36.1 UAT from `36.1-VALIDATION.md`; then either approve keeping the broad Play Motion/UI changes or request a narrow fix-only cleanup pass."

## Resolution

- root_cause: Current state is a mixed uncommitted working tree: several changes match resolved Phase 36.1 Play sequencing/duration/cache regressions, while Play Motion/UI/radius changes broaden scope and need user approval.
- fix: not applied; diagnostic triage only
- verification: "Passed: app focused Phase 36.1 tests (84 tests), package AnimationPlayer tests (11 tests), app typecheck, git diff --check. Failed first attempt only because test paths were wrong for `--dir app` (`app/src/...` produced no test files found). App server not run."
- files_changed: "/Users/lmarques/Dev/efx-motion-editor/.planning/debug/phase-36-1-regression-triage.md only"
