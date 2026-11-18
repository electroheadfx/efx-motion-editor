---
phase: 64-medium-engine
plan: 19
subsystem: ui
tags: [watercolor, emboss-light, frame-cache, cache-fingerprint, relight, single-flight, apply-seam, preact-signals, tdd]

# Dependency graph
requires:
  - phase: 64-05
    provides: the durable per-document `light` member and the ONE `setDocumentLight` mutation
  - phase: 64-07
    provides: `lightSignature` (the canonical absent/DEFAULT_LIGHT normalizer) and the light threaded into every bake path
  - phase: 64-18
    provides: the one-light-gesture ledger (the commit seam and the coalescer)
provides:
  - the canonical `lightCacheTerm` beside `paperCacheTerm`, and a REQUIRED light parameter on all three real-frame projections — a forgotten revision site is a compile error
  - `getDocumentLight` on the persistence coordinator input, read at call time at the publish projection and the accepted-live-frame revision
  - the pure `lightChangeNeedsRelight` and the bounded `createSingleFlightRelight` scheduler (one in flight, one queued follow-up, swallowed rejection, one busy-false follow-up, gated settle)
  - the Studio's ref-held relight run over `applyAquarelleTimeline` and the two request sites (gesture commit, undo/redo sync diff)
affects: [64-20, 64-UAT]

# Actuals (#2632) — chars/4 over the realized CODE diff (`.planning/` excluded:
# the RED evidence records are captured test output, not authored work).
actuals:
  tokens: 11143
  tasks: 2
  commits: 4
plan_head_before: 695896ba10a0cdae4fda4e2beaebf6f963cb524d
plan_head_after: e6a8d17e9e638f61e92317f96a251cd165301a95

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cache fingerprint composition: the light term joins the paper term at every real-frame revision site, built from the ONE canonical `lightSignature` — never a retyped normalization"
    - "Required-parameter law: the projections take the light as a REQUIRED second argument, so an omission is a compile error, not a silently stale key"
    - "Ref-held single-flight scheduler: a once-created controller over a ref-held run (menuUndoRef / aquarelleRebakeRef precedent); every guard reads live state at call time"
    - "Signature memo, not light state: the last-seen light is a canonical signature STRING ref — no second light signal, no light mirror (the 64-09 pin stays literal)"
    - "Burst budget: any number of requests coalesce into one queued follow-up; a busy `false` grants exactly one automatic follow-up; a rejection grants none"

key-files:
  created:
    - app/src/components/physic-paint/engine/committedFrameRelight.ts
    - app/src/components/physic-paint/engine/committedFrameRelight.test.ts
  modified:
    - app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts
    - app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.test.ts
    - app/src/components/physic-paint/hooks/rotoReferenceOnlyTolerance.test.ts
    - app/src/lib/physicPaintBridge.launchPackBytes.test.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts

key-decisions:
  - "Draw-time re-lighting is REJECTED (recorded, not implemented): the emboss is baked into the cached pixels from a thickness field that is not persisted, so `AquarelleCachedBaseLayer` keeps its url-only contract and a light change re-bakes through the Apply lane"
  - "`lightCacheTerm` delegates to `lightSignature` — absent and explicit DEFAULT_LIGHT are ONE term; only the `:light:` prefix is added"
  - "The three projections REQUIRE the light parameter (a compile error beats a stale key); every call site, including five fixture sites, passes it explicitly"
  - "The last-seen light is a signature STRING ref, never a light mirror — the 64-09 'no second light state' pin (no `useRef<...PaintDocumentLight`) stays literally true"
  - "The controller carries NO light state: `run` reads the live document at call time, so the queued-latest follow-up is always current"
  - "The relight run is created once over `rotoScriptRef` — a stale first-render Apply controller would bake with an old publication identity"
  - "The run advances the last-seen signature only on a `true` bake, and stores the signature captured at run START (the light the bake actually used), so a mid-run change is detected by the next sync"
  - "`documentLight` was hoisted above the roto projections: the projection ref initializers run DURING render, before the getter's old site — calling it from them would have thrown"
  - "RED evidence is captured with vitest's JUnit reporter: the TAP reporter embeds raw multi-line diagnostic strings that the gate's strict TAP parser rejects as malformed (INVALID_RED on shape, not behavior)"

requirements-completed: [MED-17]

# Coverage metadata (#1602) — one entry per shipped deliverable.
coverage:
  - id: D1
    description: "The light term: `lightCacheTerm` is `:light:default` for an absent AND an explicit DEFAULT_LIGHT, real lights differ; every real-frame revision site carries it (exactly three calls); the projection parameter is required"
    requirement: MED-17
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.test.ts#64-19 light term in the real-frame cache fingerprint (CR-01, MED-17)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The coordinator input reads `getDocumentLight` at call time — the publish projection and the accepted-live-frame revision key on the live light"
    requirement: MED-17
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.test.ts#the accepted-live-frame revision reads the light from the hook input at call time"
        status: pass
    human_judgment: false
  - id: D3
    description: "The bounded scheduler: one run in flight with exactly one queued follow-up for any number of requests; exactly one busy-false follow-up then stop; a rejection swallowed and never retried nor wedging; settle gated on the follow-up"
    requirement: MED-17
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/engine/committedFrameRelight.test.ts#64-19 committed-frame relight (CR-01, MED-17)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The Studio wiring: one ref-held controller; the run's playing/Draft/wireframe guards and its single Apply-lane call at the launch start frame; the commit requests only a non-null coalesced span after the ONE ledger record; the sync diff sits above the fallback early return with a first-call baseline and no bake"
    requirement: MED-17
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#64-19 committed-frame relight wiring (CR-01)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/engine/aquarelleLightRenderPaths.test.ts#the 64-07 light render-path pins (unchanged, still green)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Live UAT: a light gesture re-lights the visible settled wash once (64-UAT row 4's re-light clause), the sheet matches a fresh bake under the same light (row 5 bake parity), and an undo/redo of the light steps the sheet back and forth"
    verification: []
    human_judgment: true
    rationale: "Whether the settled wash visibly re-lights and matches a fresh bake are visual judgements over the WebGL2 canvas. The node vitest env never mounts PhysicsPaintStudio.tsx or the aquarelle engine, so no automated row can prove the visible re-light; the live sheet is run by the user."

# Metrics
duration: 12min
completed: 2026-11-18
status: complete
---

# Phase 64 Plan 19: The Light Reaches Committed Frames Summary

**A light change now misses the committed-frame cache (the canonical light term keys every real-frame revision) and re-bakes the visible settled frame exactly once per gesture and per light-changing undo/redo — through the shipped Apply seam, never at draw time**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-11-18T21:35:03Z
- **Completed:** 2026-11-18T21:47Z
- **Tasks:** 2 (both TDD: RED + GREEN each)
- **Files modified:** 10 (2 created, 6 source/test modified, 2 RED evidence records)

## Accomplishments
- CR-01's fingerprint half: `lightCacheTerm` beside `paperCacheTerm`, built from the canonical `lightSignature` (absent and explicit `DEFAULT_LIGHT` are ONE term), and a REQUIRED light parameter on all three runtime projections — the module has exactly three `buildRotoRealCacheRevision` calls and each suffix carries the term, so a forgotten site cannot compile.
- The coordinator input gained `getDocumentLight`, read at call time at the publish projection and the accepted-live-frame revision — a light written between two captures produces a new cache key instead of re-serving pixels baked under the superseded light.
- CR-01's re-bake half: a pure `lightChangeNeedsRelight` plus the bounded `createSingleFlightRelight` (one in flight, one queued follow-up for any number of requests, a swallowed rejection with no auto-retry, exactly one busy-false follow-up per burst, `settle()` gated on the follow-up).
- The Studio's relight run is created ONCE over refs, refuses while playing / Draft / wireframe, calls `applyAquarelleTimeline(getAquarelleEventsForFrame(launch.startFrame))` — the lane that resolves the document light at bake time and mints no ledger entry — and advances the last-seen signature only on a real bake.
- Both directions pinned: two different lights rotate the real-frame revision while the same light twice (and absent-vs-DEFAULT_LIGHT) is identical; a real gesture requests exactly one relight after 64-18's ONE ledger record, and the undo/redo sync requests only on a signature diff, its first call recording the baseline without baking.
- The draw-time alternative is recorded REJECTED: the emboss is baked into the cached pixels from a thickness field that is not persisted, so the cached raster cannot be re-lit after the fact; `AquarelleCachedBaseLayer` keeps its url-only contract.

## Task Commits

Each task was committed atomically as the required RED/GREEN pair:

1. **Task 1a (RED): failing light term in the real-frame cache fingerprint** - `43f6aff1e` (test)
2. **Task 1b (GREEN): light term in the real-frame cache fingerprint** - `8e24643f8` (feat)
3. **Task 2a (RED): failing relight controller and Studio wiring pins** - `4f31c3c4b` (test)
4. **Task 2b (GREEN): one bounded re-bake per light change, through the Apply seam** - `e6a8d17e9` (feat)

**Plan metadata:** this SUMMARY commit (docs)

## Files Created/Modified
- `app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts` - `lightCacheTerm` (via `lightSignature`); required `light` param on the three projections with the term inlined at every revision suffix; required `getDocumentLight` input read at the publish and accepted-frame sites
- `app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.test.ts` - four 64-19 rows (term law, two-lights-vs-same-light revisions, three-call source scan, input read) plus the repointed publish-projection literal pin
- `app/src/components/physic-paint/hooks/rotoReferenceOnlyTolerance.test.ts` - three fixture calls pass explicit `undefined` (light-agnostic documents)
- `app/src/lib/physicPaintBridge.launchPackBytes.test.ts` - four fixture calls pass explicit `undefined` (light-agnostic documents)
- `app/src/components/physic-paint/engine/committedFrameRelight.ts` - `lightChangeNeedsRelight` + `createSingleFlightRelight` and the `SingleFlightRelight` port
- `app/src/components/physic-paint/engine/committedFrameRelight.test.ts` - six rows: change test (canonical default), single-flight coalescing, bounded busy-false follow-up, rejection safety, gated settle
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` - hoisted `documentLight` above the projections; `rotoScriptRef`; the once-created relight controller and run; the commit request; the sync light diff above the fallback early return; `getDocumentLight` in the coordinator input; the three projection calls pass `documentLight()`
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` - five 64-19 source pins
- `.planning/phases/64-medium-engine/64-19-red-evidence-task1.json` - Task 1 RED evidence (classifier: RED_EVIDENCE_OK)
- `.planning/phases/64-medium-engine/64-19-red-evidence-task2.json` - Task 2 RED evidence (classifier: RED_EVIDENCE_OK)

## Decisions Made
- The draw-time alternative is REJECTED for cause, not for convenience: the emboss cannot be reproduced from the cached raster (its thickness field is not persisted), so the fix is cache-term + deterministic re-bake.
- The last-seen light is a signature STRING (`useRef<string | null>`), never a light mirror — keeps the 64-09 no-second-light-state pin literally intact.
- The relight run is created once over `rotoScriptRef` and every guard reads live state (playing via a ref mirror, Draft/wireframe via `.peek()`) — no effect dependency churn.
- The run stores the signature captured at run START, so a light change mid-bake is not falsely marked as synced; the next sync detects it.
- The RED gate is fed JUnit, not TAP: vitest's TAP embeds raw multi-line diagnostic values that the gate's strict TAP parser rejects ("Malformed TAP"), while JUnit parses clean with identical verdict semantics.

## TDD Gate Compliance

- Both tasks are behaviour-adding (`tdd="true"` + `<behavior>` + source files), so the RED gate applied to each.
- Task 1 RED (`43f6aff1e`) preceded its GREEN (`8e24643f8`): a type-correct `lightCacheTerm` stub returning `''` kept the file collecting (40 tests discovered; 47 pre-existing rows passed) while the four new rows failed on real assertions — evidence at `64-19-red-evidence-task1.json`, `gsd_run check tdd-red-evidence` returned `RED_EVIDENCE_OK`.
- Task 2 RED (`4f31c3c4b`) preceded its GREEN (`e6a8d17e9`): a type-correct naive controller stub kept both files collecting (451 tests discovered) while nine rows failed — five Studio pins on absent wiring and four controller rows on real behavior; evidence at `64-19-red-evidence-task2.json`, `RED_EVIDENCE_OK`.
- GREEN verification: the plan's full six-file suite ran **509 passed**; `tsc --noEmit` exit 0 after each GREEN.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Three additional fixture call sites required the new light argument**
- **Found during:** Task 1 GREEN (`tsc --noEmit`)
- **Issue:** The plan named `rotoReferenceOnlyTolerance.test.ts:62` and `physicPaintBridge.launchPackBytes.test.ts:406,448`; the required parameter also broke `rotoReferenceOnlyTolerance.test.ts:68,77` and `launchPackBytes.test.ts:517,521`.
- **Fix:** Every fixture call passes explicit `undefined`, with a comment that the fixture document is light-agnostic.
- **Files modified:** the two test files above
- **Commit:** `8e24643f8`

**2. [Rule 1 - Bug] Test-only type-safe read of `cacheRevision`**
- **Found during:** Task 1 GREEN (`tsc --noEmit`)
- **Issue:** `cacheRevision` rides the runtime frame but is not declared on the `PhysicPaintRotoCacheFrame` transport type, so the new rows' direct property reads failed the typecheck. Widening the shared transport type was avoided (out of the plan's file list).
- **Fix:** A narrow cast accessor in the test row (the same idiom the launch-pack fixture already uses); assertions unchanged except one tautological self-contains check replaced by a substantive `toContain(':light:')`.
- **Files modified:** `useRotoFramePersistenceCoordinator.test.ts`
- **Commit:** `8e24643f8`

**3. [Rule 1 - Bug] RED evidence captured with the JUnit reporter**
- **Found during:** Task 1 RED
- **Issue:** The first TAP capture classified as `INVALID_RED` (`invalid_record`): vitest's TAP diagnostic blocks embed raw multi-line `actual` dumps that the gate's strict TAP parser rejects as malformed.
- **Fix:** Re-ran the same failing command with `--reporter=junit`; the gate parsed it clean (`RED_EVIDENCE_OK`) with identical test names and failure semantics. Used for both tasks.
- **Files modified:** the two RED evidence records
- **Commit:** `43f6aff1e`, `4f31c3c4b`

## Issues Encountered
- The hoist of `documentLight` was not cosmetic: the projection `useRef` initializers run during the render pass BEFORE the getter's old declaration site, so passing `documentLight()` there would have thrown a TDZ `ReferenceError` at first render.
- 64-18's literal pin `if (coalesced) rotoMoveHistory.recordBackgroundEdit(coalesced);` was preserved byte-for-byte; the relight request is a separate sibling statement, so the existing "one record per gesture" assertion stays exact.
- Pre-existing working-tree edits (`.planning/phases/64-medium-engine/64-BEADS.md` — orchestrator dispatch metadata) were deliberately left out of every task commit.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- CR-01 is closed at both halves: the fingerprint (all three revision sites + the input read) and the deterministic bounded re-bake (controller + two request sites).
- The live UAT rows this plan makes runnable are 64-UAT row 4's re-light clause and row 5's bake parity; the live sheet is run by the user.
- The draw-time alternative remains recorded as REJECTED; `AquarelleCachedBaseLayer.tsx` was not touched (url-only contract).
- 64-20 was not touched by this plan.

---
*Phase: 64-medium-engine*
*Completed: 2026-11-18*

## Self-Check: PASSED

- Files present: this SUMMARY, `committedFrameRelight.ts` + its test, and both RED evidence records
- Commits present and ancestors of HEAD: `43f6aff1e`, `8e24643f8`, `4f31c3c4b`, `e6a8d17e9`
- Measured plan span: `695896ba10a0cdae4fda4e2beaebf6f963cb524d..e6a8d17e9e638f61e92317f96a251cd165301a95` = 4 commits (frontmatter `commits: 4`)
- Suites: the six plan test files ran 509 passed; `tsc --noEmit` exit 0
