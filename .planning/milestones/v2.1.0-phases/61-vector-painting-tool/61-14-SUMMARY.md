---
phase: 61-vector-painting-tool
plan: 14
subsystem: testing
tags:
  - parity
  - aqtl-v2
  - snap-v5
  - sparse-widths
  - render-mode
  - undo-redo
  - cache-key
  - view-flags
  - test-only

# Dependency graph
requires:
  - phase: 61-05
    provides: "AQTL v2 encode/decode — the render-mode byte and the sparse anchor width round-trip"
  - phase: 61-07
    provides: "The simple-ribbon preset stamp and recordedRenderModeField — a hand-painted stroke carrying a mode"
  - phase: 61-10
    provides: "beginAquarellePathEdit / restoreAquarelleEditSnapshot — the one-edit path write and revision-authoritative history pair"
  - phase: 61-12
    provides: "updateAquarelleRenderModeInScript — the per-stroke render mode as a stroke property"
  - phase: 61-13
    provides: "wireframeMode / setWireframeMode and the draft latch it arms — the session-only view flags"
provides:
  - "vectorStrokeExportParity.test.ts — the draw/save/reopen parity chain, both render modes on both stroke families, the sparse [1.8, absent, 0.4] widths, undo/redo byte identity, codec determinism, view-flag serialisation independence, and the nine-module session-state source scan"
  - "efxPaintCompositeCache.test.ts — the two close-out key cases: a path edit rotates the flattened key, a wireframe toggle never does"
affects:
  - "End-of-phase UAT evidence for VEC-06 / VEC-07 — the phase now carries executable close-out proofs rather than a manual claim"

# Actuals (#2632) — measured on the plan's own scale (chars/4 over the realized diff)
actuals:
  tokens: 6054
  tasks: 3
  commits: 3
plan_head_before: be73879ddf729d0199d10445b9c6075dad529f86
plan_head_after: 8e0cf1334c17bb8a950c6d22ee8c37638df947fc

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A parity proof reads the SAVED event list out of the record store and reopens it through the shipped codec + restoreAquarelleRecordTimeline pair — never a hand-built re-projection of the decoded entries"
    - "Quantisation-exact fixtures (uv endpoints 0/1, the -1 pressure sentinel, tilt multiples of 1/50, binary32 anchor coordinates, Math.fround width factors) make toStrictEqual the exact whole-entry parity assertion"
    - "A view-state independence proof serialises ONE document instance twice, so the flag toggle is the only variable between the two outputs"
    - "A source scan asserts its own scanned file count and non-empty sources before asserting absence, so an empty scan can never pass vacuously"

key-files:
  created:
    - app/src/efx-paint/compositor/vectorStrokeExportParity.test.ts
  modified:
    - app/src/efx-paint/compositor/efxPaintCompositeCache.test.ts

key-decisions:
  - "Test-only plan: the behavioural TDD gate does not apply (task.is-behavior-adding=false — <files> carries only *.test.ts), so no RED/GREEN cycle and no fabricated feat commit; documented in TDD Gate Compliance."
  - "The reopen leg goes through restoreAquarelleRecordTimeline, not a direct re-projection of decoded strokes, so the parity claim covers the real reopen seam including the conditional anchors/renderMode seeding."
  - "The undo/redo leg drives beginAquarellePathEdit + restoreAquarelleEditSnapshot and compares serialised strings, so the pin is byte identity across the history round trip rather than object identity."
  - "The cache content term is the live aquarelleStrokesRevision value across a real path edit, and both derivations reuse ONE document because createEfxPaintDocument mints fresh ids per call."
  - "The serialisation case covers both the layer sub-file JSON and the SNAP v5 container, and the scan covers nine persistence-path modules with a reported count."

requirements-completed:
  - VEC-06
  - VEC-07

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "A vector stroke recorded, saved (AQTL v2), reopened and re-projected yields a bake entry deep-equal to the original — same pts, same anchor list, same render mode."
    requirement: VEC-06
    verification:
      - kind: unit
        ref: "app/src/efx-paint/compositor/vectorStrokeExportParity.test.ts#61-14 vector stroke export parity > reopen parity: a vector stroke keeps its pts, anchor list and render mode"
        status: pass
      - kind: unit
        ref: "app/src/efx-paint/compositor/vectorStrokeExportParity.test.ts#61-14 vector stroke export parity > reopen parity: the engine event count and order match the source"
        status: pass
    human_judgment: false
  - id: D2
    description: "Both render modes are carried literally on both stroke families; a hand-painted stroke keeps its mode and never gains an anchors key, and a default hand-painted stroke keeps its exact pre-phase shape."
    requirement: VEC-06
    verification:
      - kind: unit
        ref: "app/src/efx-paint/compositor/vectorStrokeExportParity.test.ts#61-14 vector stroke export parity > both render modes are carried literally on both stroke families"
        status: pass
      - kind: unit
        ref: "app/src/efx-paint/compositor/vectorStrokeExportParity.test.ts#61-14 vector stroke export parity > reopen parity: a default hand-painted stroke keeps its exact pre-phase shape"
        status: pass
      - kind: unit
        ref: "app/src/efx-paint/compositor/vectorStrokeExportParity.test.ts#61-14 vector stroke export parity > reopen parity: a hand-painted stroke keeps its render mode and never gains a path"
        status: pass
    human_judgment: false
  - id: D3
    description: "Sparse widths [1.8, absent, 0.4] reopen exactly, an explicit 1.0 stores no key, undo then redo is byte-identical, and the codec is deterministic across two encodes and two decodes."
    requirement: VEC-07
    verification:
      - kind: unit
        ref: "app/src/efx-paint/compositor/vectorStrokeExportParity.test.ts#61-14 vector stroke export parity > sparse width factors [1.8, absent, 0.4] reopen exactly and a uniform factor stores no key"
        status: pass
      - kind: unit
        ref: "app/src/efx-paint/compositor/vectorStrokeExportParity.test.ts#61-14 vector stroke export parity > a path edit, undone then redone, yields byte-identical bake inputs"
        status: pass
      - kind: unit
        ref: "app/src/efx-paint/compositor/vectorStrokeExportParity.test.ts#61-14 vector stroke export parity > the codec is deterministic: two encodes match byte for byte and two decodes match entry for entry"
        status: pass
    human_judgment: false
  - id: D4
    description: "A path edit bumps the stroke revision and rotates the flattened cache key; toggling wireframe (and the draft latch) leaves the key byte-identical; no persistence-path module references a session-only identifier; the persisted bytes are flag-independent."
    requirement: VEC-06
    verification:
      - kind: unit
        ref: "app/src/efx-paint/compositor/efxPaintCompositeCache.test.ts#61-14 close-out > a path edit bumps the stroke revision and rotates the flattened key"
        status: pass
      - kind: unit
        ref: "app/src/efx-paint/compositor/efxPaintCompositeCache.test.ts#61-14 close-out > toggling wireframe — and the draft latch it arms — leaves the flattened key byte-identical"
        status: pass
      - kind: unit
        ref: "app/src/efx-paint/compositor/vectorStrokeExportParity.test.ts#61-14 vector stroke export parity > view flags never reach the persisted bytes: wireframe on and off serialise identically"
        status: pass
      - kind: unit
        ref: "app/src/efx-paint/compositor/vectorStrokeExportParity.test.ts#61-14 vector stroke export parity > no persistence-path module references a session-only identifier"
        status: pass
    human_judgment: false
  - id: D5
    description: "Live UAT recorded for end-of-phase: draw a path, edit an anchor, save, reopen and export a frame — the bake matches the canvas; a freehand Simple ribbon stroke keeps its crisp sweep without ever showing anchors; a wireframe toggle does not re-bake."
    requirement: VEC-07
    verification: []
    human_judgment: true
    rationale: "Deposited pixels, the visible sweep and the absence of a re-bake need a live Studio session; no unit probe renders the engine deposit."

# Metrics
duration: 7min
completed: 2026-11-10
status: complete
---

# Phase 61 Plan 14: Vector stroke export parity and the view-state close-out Summary

**The saved event list reopened through the shipped AQTL v2 + restore chain comes back deep-equal — both render modes on both stroke families, the sparse width shape and the undo/redo round trip exact — while a path edit rotates the composite key and the wireframe view flag provably touches neither the key nor the persisted bytes**

## Performance

- **Duration:** 7 min
- **Started:** 2026-11-10T16:12:37Z
- **Completed:** 2026-11-10T16:19:37Z
- **Tasks:** 3
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- The draw/save/reopen chain is pinned end to end: the saved event list is read out of the record store, encoded with AQTL v2, decoded and restored through `restoreAquarelleRecordTimeline`, and the reopened entry is asserted deep-equal to the saved one — plus separate `pts` (length/x/y/tick), `engine.anchors` and `engine.renderMode` assertions so a failure names the dropped field.
- Both render modes survive literally on both stroke families: four explicit literals (`simple-ribbon` and `watercolor` on vector and hand-painted strokes), no mode ever defaulted to the other, and a hand-painted stroke keeps its mode with the `anchors` key still absent (D-14), while a default hand-painted stroke keeps its exact pre-phase key set.
- Sparse widths are exact: `[1.8, absent, 0.4]` reopens as that exact three-element shape, an explicit `1.0` stores no key, and a path edit undone then redone serialises byte-identically (string comparison), with two encodes byte-identical and two decodes entry-identical.
- A real anchor edit bumps `aquarelleStrokesRevision` and rotates the flattened cache key, while `setWireframeMode(true)` (which arms Draft) and the OFF transition leave the key byte-identical; the layer sub-file JSON and the SNAP v5 container serialise identically with the flags off, on and back off; the nine-module persistence scan reports its file count and finds none of `wireframeMode`, `pathEditMutationId` or `vectorPenActive`.
- Full gates: focused two-file run 35/35 green; the full app suite 421 files / 8712 tests green (exit 0, vite build under the chunk ceiling); the engine suite 16 files / 299 tests green; `tsc --noEmit` exit 0.

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end draw, edit, save, reopen — the bake inputs come back deep-equal** (tracer) - `709d992d2` (test)
2. **Task 2: Both render modes and the sparse widths survive; undo then redo is byte-identical** - `0656f0f59` (test)
3. **Task 3: Close-out — a path edit rotates the composite key, wireframe does not, and no view state is persisted** - `8e0cf1334` (test)

**Plan metadata:** `docs(61-14)` commit (this SUMMARY + STATE/ROADMAP/REQUIREMENTS)

## Files Created/Modified

- `app/src/efx-paint/compositor/vectorStrokeExportParity.test.ts` (created) — 11 cases: the reopen parity chain (vector, uniform width, default hand-painted, mode-only hand-painted, event order), both modes literally on both families, the sparse `[1.8, absent, 0.4]` widths, undo/redo byte identity, codec determinism, view-flag serialisation independence, and the persistence-path source scan.
- `app/src/efx-paint/compositor/efxPaintCompositeCache.test.ts` (modified) — the `61-14 close-out` describe with two cases: a path edit rotates the flattened key; the wireframe+draft toggle leaves it byte-identical.

## Decisions Made

- **The reopen leg uses the shipped restore, not a local re-projection.** `restoreAquarelleRecordTimeline` is where anchors and render mode are conditionally seeded, so proving parity through it covers the real reopen seam rather than a test-only shortcut.
- **Fixtures are quantisation-exact on purpose.** uv endpoints `0/1` (u16 round trip), the `-1` pressure sentinel, tilt values that are multiples of `1/50`, binary32 anchor coordinates and `Math.fround` width factors mean `toStrictEqual` is exact and a parity failure is a genuinely dropped field, never a rounding artefact.
- **The cache content term is the live record revision.** The path-edit case reads `aquarelleStrokesRevision` across `beginAquarellePathEdit`, so the rotation pin covers the real store-side term the cache consumes.
- **One document instance per serialisation pair.** `createEfxPaintDocument` mints fresh ids per call; rebuilding per derivation rotated the key for the wrong reason (the one auto-fixed bug below).
- **The scan proves its own coverage.** Nine persistence-path modules are read and their count and non-empty sources are asserted before the absence assertion, so an empty or mis-rooted scan cannot pass.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The cache derivation rebuilt the document on every call, rotating the key for the wrong reason**
- **Found during:** Task 3 (first two-file verify)
- **Issue:** The `flatten()` helper called `makeDocument(...)` per invocation; `makeDocument` calls `createEfxPaintDocument`, which mints fresh ids per call, so the config term changed between derivations and the wireframe case failed (`flattened-269-2032dabb` vs `flattened-268-67336ee3`) with the flags untoggled. The path-edit case passed only because it asserts inequality and the spurious rotation masked the bug.
- **Fix:** Hoisted ONE `document` instance into the describe and had `flatten()` close over it, so the revision (or the view flag) is the only variable between derivations.
- **Files modified:** `app/src/efx-paint/compositor/efxPaintCompositeCache.test.ts`
- **Verification:** the two-file verify went 35/35 green; the path-edit inequality now holds on the content term alone.
- **Committed in:** `8e0cf1334`

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** No scope creep and no production file touched. The fix strengthened the cache proof — before it, the inequality assertion was satisfiable for the wrong reason.

## TDD Gate Compliance

- **Plan type:** `execute` (test-only close-out; no production file is modified).
- **Gate predicate:** Tasks 1 and 2 carry `tdd="true"`, so `gsd_run query task.is-behavior-adding` was evaluated before execution. It returned `is_behavior_adding: false` with `checks.tdd_true: true`, `checks.has_behavior_block: true`, `checks.has_source_files: false` and reason "Not behavior-adding: <files> has no non-test source file".
- **Consequence:** The behavioural RED/GREEN gate does not apply (same precedent as 61-06's test-only plan). No `feat(...)` commit was fabricated and no empty commit was created; each task committed exactly its test file(s).
- **RED evidence:** Not applicable — there is no production behaviour to fail first. Tasks 1-2 passed against the shipped seams on first run; Task 3's first run caught the fixture bug documented above, which was in the new test itself, not a production defect.

## Issues Encountered

- **Cache fixture trap:** covered as the auto-fixed deviation above — the existing test file already warns about the fresh-UUID-per-call trap of `createEfxPaintDocument`; the new derivation had to reuse one instance.
- No git hooks ran (none installed); `tsc --noEmit` exit 0 after every task.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None. No hardcoded empty values flow to the UI, no placeholder copy, and no component receives mock data: this plan adds executable proofs only.

## Threat Flags

None beyond the plan's threat model. T-61-48 (field dropping on reopen) is pinned by the named `pts`/`anchors`/`renderMode` assertions plus whole-entry equality; T-61-49 (stale raster after a path edit) by the rotating-key case; T-61-50 (view state leaking into the document) by the byte-identical serialisations and the nine-module scan with a reported count; T-61-SC holds — no dependency was added.

## Next Phase Readiness

- VEC-06 and VEC-07 carry executable close-out evidence: save/reopen preserves bake inputs exactly in both render modes with sparse widths intact, undo/redo is byte-identical, the document carries no view state, and a path edit invalidates the raster.
- Live UAT remains recorded for end-of-phase (D5): draw/edit/save/reopen/export pixel match, the ribbon sweep surviving without anchors, and no re-bake on a wireframe toggle.
- Wave 10 closes with the full app suite green (421 files, 8712 tests) and the bundle under the 2 MB chunk ceiling (largest chunk 1,701.45 kB, built in the suite).

## Self-Check: PASSED

---
*Phase: 61-vector-painting-tool*
*Completed: 2026-11-10*
