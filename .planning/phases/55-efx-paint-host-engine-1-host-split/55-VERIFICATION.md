---
phase: 55-efx-paint-host-engine-1-host-split
verified: 2026-10-15T13:30:00Z
status: passed
score: 5/5 must-haves verified
covered_files: [".planning/phases/55-efx-paint-host-engine-1-host-split/55-01-PLAN.md", ".planning/phases/55-efx-paint-host-engine-1-host-split/55-01-SUMMARY.md", ".planning/phases/55-efx-paint-host-engine-1-host-split/55-02-PLAN.md", ".planning/phases/55-efx-paint-host-engine-1-host-split/55-02-SUMMARY.md", ".planning/phases/55-efx-paint-host-engine-1-host-split/55-03-PLAN.md", ".planning/phases/55-efx-paint-host-engine-1-host-split/55-03-SUMMARY.md", ".planning/phases/55-efx-paint-host-engine-1-host-split/55-04-PLAN.md", ".planning/phases/55-efx-paint-host-engine-1-host-split/55-04-SUMMARY.md", ".planning/phases/55-efx-paint-host-engine-1-host-split/55-05-PLAN.md", ".planning/phases/55-efx-paint-host-engine-1-host-split/55-05-SUMMARY.md", ".planning/phases/55-efx-paint-host-engine-1-host-split/55-06-PLAN.md", ".planning/phases/55-efx-paint-host-engine-1-host-split/55-06-SUMMARY.md", ".planning/phases/55-efx-paint-host-engine-1-host-split/55-07-PLAN.md", ".planning/phases/55-efx-paint-host-engine-1-host-split/55-07-SUMMARY.md", ".planning/phases/55-efx-paint-host-engine-1-host-split/55-08-PLAN.md", ".planning/phases/55-efx-paint-host-engine-1-host-split/55-08-SUMMARY.md", ".planning/phases/55-efx-paint-host-engine-1-host-split/55-09-PLAN.md", ".planning/phases/55-efx-paint-host-engine-1-host-split/55-09-SUMMARY.md", ".planning/phases/55-efx-paint-host-engine-1-host-split/55-10-PLAN.md", ".planning/phases/55-efx-paint-host-engine-1-host-split/55-10-SUMMARY.md", "app/src/components/physic-paint/roto/physicsPaintRotoScriptApplyRefusal.ts", "app/src/efx-paint/host-split/fakeEngine2Fixture.ts", "app/src/efx-paint/host-split/hostAnimationResidueContract.test.ts", "app/src/efx-paint/host-split/hostGenericityRoundTrip.test.ts", "app/src/efx-paint/host-split/hostImportGraphContract.test.ts", "app/src/efx-paint/host-split/hostSplitFailClosedApply.test.ts", "app/src/efx-paint/host-split/hostSplitSuiteGate.test.ts", "app/src/efx-paint/host-split/preSplitGoldenFixture.ts", "app/src/efx-paint/host-split/preSplitGoldenParity.test.ts", "app/src/lib/playbackEngine.test.ts", "app/src/lib/playbackEngine.ts", "packages/efx-paint-host/package.json", "packages/efx-paint-host/src/animation/AnimationPlayer.ts", "packages/efx-paint-host/src/animation/types.ts", "packages/efx-paint-host/src/bake/bakeHost.ts", "packages/efx-paint-host/src/script/parse.ts", "packages/efx-paint-host/src/script/payload.ts", "packages/efx-paint-host/src/script/refusal.ts", "packages/efx-paint-host/src/time/diffusion.ts", "packages/efx-paint-host/src/time/ticks.ts", "packages/efx-paint-host/src/util/noise.ts", "packages/efx-paint-host/src/util/traceSeed.ts", "packages/efx-physic-paint/src/payload/toStudioStroke.ts"]
covered_digest: "v3:sha256:d694a235929f4df4292221ba9d3543e7b4ba44ee9c629e5801191444e8251330"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "On the running app, open a project whose physic-paint layer carries a document sound clip. Drag the MAIN EDITOR timeline playhead across the clip window; release; then Play-from-cursor over the same window."
    expected: "Paint audio snippet is audible while dragging (throttled short bursts ~120ms), goes silent on release, and Play-from-cursor still plays the clip from the cursor. Surface judged is the main-editor timeline, not the paint Studio."
    why_human: "Audio audibility and scrub feel are human-judgment rows (D-05 / feedback_no_done_before_uat). A passing vitest proves the dispatch wiring, not that a human hears the snippet. GAP-55-01 closes only when A2 records PASS."
---

# Phase 55: efx-paint-host (engine-1 host split) Verification Report

**Phase Goal:** The shared Studio script law (animation schedules, traceSeed, script envelope, ticks + diffusionFrames) lives in a generic engine-agnostic host; engine-1 observable behavior is unchanged
**Verified:** 2026-10-15T13:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification (post gap-closure plan 55-10)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User records, applies, bakes, and replays a Physic Paint script with the same look and baked pixels as the pre-split golden (SC1 / HOST-03) | VERIFIED | `preSplitGoldenParity.test.ts` 6/6 green — re-bakes fixture at delta zero, names drifted frame on mutation, non-empty-golden guard |
| 2 | A fake engine-2 stroke payload compiles and round-trips through record → play → bake on the host with zero engine-1 types in the host API (SC2 / HOST-04) | VERIFIED | `hostGenericityRoundTrip.test.ts` 4/4 green; `hostImportGraphContract.test.ts` 5/5 green — zero engine imports in host, no engine dep in package.json |
| 3 | Cross-engine or malformed Apply refuses with a named visible error and never half-applies (SC3 / HOST-05 / DATA-02) | VERIFIED | `hostSplitFailClosedApply.test.ts` 5/5 green — four named refusals, no-partial pin, idempotency, pairwise-distinct lines |
| 4 | Scripts run on a fixed integer tick grid (~1/60 s, never raw ms); unreadable scripts refuse with named visible errors; no migration code, dual-format readers, or backward-compat shims exist (SC4 / DATA-01 / DATA-03) | VERIFIED | `HOST_TICK_HZ = 60` in `ticks.ts`; `clampCuissonTicks` requires caller bounds (uncapped host); `refusal.ts` clean-break code for legacy kind; zero migration/compat branches in source |
| 5 | Scrubbing the app timeline (main editor) dispatches the paint audio snippet for enabled document sound clips, gated and capped identically to play (GAP-55-01 wiring) | VERIFIED | `playbackEngine.test.ts` GAP-55-01 family (p1–p9) + source-contract (s4) all green; `collectEnabledDocumentClipsAt` shared enumerator wired into both `startAudioSnippet` and `startAudioPlayback` |

**Score:** 5/5 truths verified

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|------------|------------|-------------|--------|----------|
| HOST-01 | 55-02, 55-03, 55-05, 55-09 | `packages/efx-paint-host` owns animation schedules, traceSeed, script envelope, ticks + diffusionFrames | SATISFIED | Package exists with animation/, script/, time/, util/, bake/; old `packages/efx-physic-paint/src/animation/` deleted; residue pin green |
| HOST-02 | 55-03 | Host APIs generic over per-engine stroke payload — never engine-specific params | SATISFIED | `StudioStroke<P>` / `EngineAdapter<P>` in payload.ts; `toStudioStroke` is the single projection; no engine-1 vocab tokens in host src |
| HOST-03 | 55-01, 55-08 | Format-identical split proven against pre-split golden bake | SATISFIED | `preSplitGoldenParity.test.ts` delta-zero pin green (6 tests) |
| HOST-04 | 55-07 | Generic `StudioStroke<P>` + `EngineAdapter<P>` seam proven by fake engine-2 with zero engine-1 types | SATISFIED | `hostGenericityRoundTrip.test.ts` + `hostImportGraphContract.test.ts` green (9 tests) |
| HOST-05 | 55-06, 55-08 | Fail-closed Apply contract — named visible refusal, never half-apply | SATISFIED | `hostSplitFailClosedApply.test.ts` green (5 tests); refusal mapper wired |
| DATA-01 | 55-05 | Clean break — no migration code, no dual-format readers, no backward-compat shims | SATISFIED | Legacy kind refuses via `classifyEnvelopeParseFailure`; no reader/migration path in source |
| DATA-02 | 55-06, 55-08 | Any unreadable script/asset refuses with a named visible error — never drop data silently | SATISFIED | Four named refusals map to distinct visible lines; library refused-rows keep data visible |
| DATA-03 | 55-04 | Time = fixed tick grid (~1/60 s), integer ticks, never raw ms | SATISFIED | `HOST_TICK_HZ = 60`; `ticksFromSeconds`/`snapSampleToTick` integer law; fractional ticks throw |

All 8 requirement IDs accounted for. No orphaned requirements.

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `startAudioSnippet` | `collectEnabledDocumentClipsAt` | shared enumerator call | WIRED | playbackEngine.ts:254 — paint-clip leg dispatches via `audioEngine.play` |
| `startAudioPlayback` immediate arm | `collectEnabledDocumentClipsAt` | shared enumerator call | WIRED | playbackEngine.ts:399 — play and scrub cannot drift |
| Engine-1 call sites | Host schedules | `toStudioStroke` projection | WIRED | physicsPaintRotoPlayScriptRenderer.ts, physicsPaintRotoScriptClipboard.ts |
| Host refusal codes | Studio named errors | `buildRotoScriptApplyRefusalMessage` | WIRED | physicsPaintRotoScriptApplyRefusal.ts maps HostScriptRefusal to visible lines |
| Host package | Engine-1 package | workspace dep (`@efxlab/efx-paint-host`) | WIRED | packages/efx-physic-paint/package.json declares workspace dep |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `preSplitGoldenFixture.ts` | baked frame pixels | Pre-split deterministic bake path | Yes — stored RGBA digests | FLOWING |
| `fakeEngine2Fixture.ts` | engine-2 stroke payload | Synthetic fixture (by design) | Yes — round-trips through EngineAdapter | FLOWING |
| `playbackEngine.ts` clip dispatch | `sound.id`, `sourceOffsetSec` | `collectDocumentSoundClips` + `mainPlaybackClipEnabled` | Yes — real document state | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Golden parity pin | `vitest run src/efx-paint/host-split/preSplitGoldenParity.test.ts` | 6 passed | PASS |
| Host-split pins (all) | `vitest run src/efx-paint/host-split/` | 31 passed (6 files) | PASS |
| Gap-closure wiring | `vitest run src/lib/playbackEngine.test.ts` | 45 passed (7 todo pre-existing) | PASS |
| Host has zero engine-1 imports | `grep efx-physic-paint packages/efx-paint-host/src` (non-test) | Only EngineId string literals | PASS |
| No migration/compat code | `grep migration\|backward-compat\|dual-format` in schema + host | Only refusal classification of legacy kind | PASS |
| No engine-2/3 implementation ships | `grep efx-watercolor\|efx-krita` in packages + app/src | Only display-name map + EngineId literals | PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` probes declared or conventional for this phase. Step 7c: N/A.

### Decision Coverage

All 25 trackable CONTEXT.md decisions honored by shipped artifacts. No drift.

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
|-----------|-----------|--------|---------|----------|-----------------|---------|
| preSplitGoldenParity.test.ts | HOST-03 | 6 | 0 | No | Value (delta-zero pixels) | OK |
| hostGenericityRoundTrip.test.ts | HOST-04 | 4 | 0 | No | Behavioral (round-trip) | OK |
| hostImportGraphContract.test.ts | HOST-04 | 5 | 0 | No | Behavioral (import graph) | OK |
| hostSplitFailClosedApply.test.ts | HOST-05, DATA-02 | 5 | 0 | No | Behavioral (no-partial) | OK |
| hostAnimationResidueContract.test.ts | HOST-01 | 5 | 0 | No | Behavioral (residue lock) | OK |
| payload.test.ts | HOST-02 | (host pkg) | 0 | No | Value + Type | OK |
| ticks.test.ts | DATA-03 | (host pkg) | 0 | No | Value (integer law) | OK |
| playbackEngine.test.ts (GAP family) | A2 wiring | 10 | 0 | No | Behavioral (dispatch) | OK |

**Disabled tests on requirements:** 0 (7 `it.todo` in playbackEngine.test.ts are pre-existing main-track placeholders, not requirement-linked)
**Circular patterns detected:** 0
**Insufficient assertions:** 0

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | — | — | — | No TBD/FIXME/XXX without issue ref; no stubs; no placeholder returns |

### Human Verification Required

#### 1. Live UAT row A2 — paint audio snippet audible on app-timeline scrub

**Test:** On the running app, open a project whose physic-paint layer carries a document sound clip. Drag the MAIN EDITOR timeline playhead across the clip window; release; then Play-from-cursor over the same window.

**Expected:** Paint audio snippet is audible while dragging (throttled short bursts ~120ms), goes silent on release, and Play-from-cursor still plays the clip from the cursor. Surface judged is the main-editor timeline, not the paint Studio.

**Why human:** Audio audibility and scrub feel are human-judgment rows (D-05 / feedback_no_done_before_uat). A passing vitest proves the dispatch wiring, not that a human hears the snippet. GAP-55-01 closes only when A2 records PASS.

**Context:** Plan 55-10 landed the paint-clip dispatch wiring (automated green: 5053 tests, typecheck 0). The original UAT recorded A2 FAIL (silent scrub). The fix is in `playbackEngine.ts` (`collectEnabledDocumentClipsAt` shared enumerator). Live re-judgment is the remaining closure condition per 55-10's success criteria: "GAP-55-01 is closed when and only when live UAT row A2 records PASS on the running app."

### Gaps Summary

No code gaps. All 5 must-have truths verified, all 8 requirements satisfied, all key links wired, no anti-pattern blockers.

The single open item is human judgment: live UAT row A2 (paint audio snippet audibility on the main-editor timeline scrub) must be re-judged by the user on the running app. The automated wiring is green; audibility is a human-sense row that no test can close. Phase 55 stays `human_needed` until A2 records PASS.

---

_Verified: 2026-10-15T13:30:00Z_
_Verifier: Claude (gsd-verifier)_
