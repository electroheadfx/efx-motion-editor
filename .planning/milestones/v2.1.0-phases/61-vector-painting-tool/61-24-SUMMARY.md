---
phase: 61-vector-painting-tool
plan: 24
subsystem: ui
tags: [vector-path, roto-plus-key, script-copy, record-only, preact-signals]

# Dependency graph
requires:
  - phase: 61-vector-painting-tool
    provides: "61-03's conditional vector terms in `toStudioStroke` — the anchored engine payload this plan's projection reads and re-emits"
  - phase: 61-vector-painting-tool
    provides: "61-10's anchor-carrying script writes and `translateAquarelleStrokesInScript`'s replace-never-mutate posture"
  - phase: 61-vector-painting-tool
    provides: "261022-cfn's `resolvePreviousRealKeyBase` — the one clone seam this plan extends with provenance"
provides:
  - "`aquarelleStrokeFromScriptEvent` carries `anchors` / `renderMode` when (and only when) the event has them"
  - "`PreviousRealKeyBaseResolution.clone` names its `sourceAppFrame` on both carriers, never the destination"
  - "`useRotoKeyUtilities`'s optional `copyScriptToNewKey` port, `ROTO_ADD_KEY_SCRIPT_COPY_FAILED`, and a single-flight `addKey` that spans the copy"
  - "One `recordAquarelleScriptCopyForFrames` seam bound by BOTH Duplicate and +Key"
affects: [61-25, 61-28, 61-29, 61-30, 61-31]

# Actuals (#2632) — same estimateTokens scale (chars/4 over the realized diff)
actuals:
  tokens: 8304
  tasks: 2
  commits: 4

plan_head_before: 96361d5ab9556609d369b9563689adbc9f3b209a
plan_head_after: 25a71f04d45f5a6332cbec09f3295ef72aadf140

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Record-only carry-over: a clone's bytes already equal base∘script, so the script is RECORDED under fresh ids, never applied — applying it would double-paint"
    - "Provenance beside the payload: the clone names `sourceAppFrame` while the payload keeps labeling the destination"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoPreviousKeyBase.ts
    - app/src/components/physic-paint/hooks/useRotoKeyUtilities.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx

key-decisions:
  - "The vector terms ride conditional spreads, exactly like `toStudioStroke` — a hand-painted event keeps its pre-vector key set key-for-key, and an absent vector field stays absent (no `anchors: undefined`)"
  - "The anchor list is carried, never cloned or normalised: the event already holds the projected form and nothing on the copy path writes the source"
  - "`sourceAppFrame` lives on the resolution, not in the payload — `toDestinationPayload` keeps labeling the DESTINATION, so the copy's identity laws are untouched"
  - "The +Key copy runs inside the `addEmptyKey` SUCCESS continuation, so a rejected copy can never reach the shipped 'Could not add an empty Roto key.' surface"
  - "The copy failure is published as itself (`ROTO_ADD_KEY_SCRIPT_COPY_FAILED`) and never rolls the key back — the key exists, so reporting an add failure would be a lie"
  - "`addKey` now gates on `keyActionInFlightRef.current` as well as `blocked`: `setKeyActionInFlight(true)` does not land synchronously, so a second click in the same tick could otherwise promote a second key"
  - "One `recordAquarelleScriptCopyForFrames` body serves both ports — the Studio pin asserts the file contains exactly one `copyAquarelleScriptToFrame(` call site"

requirements-completed: [VEC-01, VEC-06]

coverage:
  - id: D1
    description: "A copied vector event survives the projection-and-record round trip with its anchors and render mode, under a fresh mutation id, without mutating the source event; a hand-painted event projects exactly as today, key for key."
    requirement: VEC-06
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.test.ts#61-24 G-15 — the script projection carries the vector path > projects a vector event with its anchors and render mode"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.test.ts#61-24 G-15 — the script projection carries the vector path > adds no vector key to a hand-painted event"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.test.ts#61-24 G-15 — the script projection carries the vector path > records the copy with its anchors intact under a fresh id without mutating the source"
        status: pass
    human_judgment: false
  - id: D2
    description: "Both clone resolutions name the previous real key's frame (never the destination), `blank`/`unavailable` stay frameless, and the shipped cached-before-durable preference is unchanged."
    requirement: VEC-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoPreviousKeyBase.test.ts#61-24 G-15 — the clone names its source frame > names the previous real key frame on both carriers, never the destination"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoPreviousKeyBase.test.ts#61-24 G-15 — the clone names its source frame > keeps blank and unavailable frameless, and the cached-before-durable preference unchanged"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoPreviousKeyBase.test.ts#resolvePreviousRealKeyBase (261022-cfn Task 1) > every shipped clone expectation, extended with sourceAppFrame and unchanged payloads"
        status: pass
    human_judgment: false
  - id: D3
    description: "+Key records the previous real key's script onto the key it created exactly once, only on the clone branch and only with the port; a blank resolution or a missing port keeps today's behaviour, a rejected add never copies, and a copy failure publishes only the copy failure while the latch holds until it settles."
    requirement: VEC-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoKeyUtilities.test.ts#61-24 G-15 — +Key records the previous key script onto the new key > copies exactly once with the previous and destination frames, after the key exists"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoKeyUtilities.test.ts#61-24 G-15 — +Key records the previous key script onto the new key > never copies on the blank branch, and a missing port keeps the shipped behaviour"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoKeyUtilities.test.ts#61-24 G-15 — +Key records the previous key script onto the new key > never copies when the key itself could not be added, and keeps the shipped failure surface"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoKeyUtilities.test.ts#61-24 G-15 — +Key records the previous key script onto the new key > a copy failure publishes only the copy failure and holds the latch until it settles"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#61-24 G-15 — +Key and Duplicate share one script-copy body > declares one recordAquarelleScriptCopyForFrames body carrying the shipped ledger allocation"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#61-24 G-15 — +Key and Duplicate share one script-copy body > binds Duplicate and +Key to that one body"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#261027-klx Wave 3 — the app-owned ledger owns stroke acceptance > allocates duplicate-script copies through the same ledger, never an engine"
        status: pass
    human_judgment: false
  - id: D4
    description: "Native UAT: +Key on a vector-bearing previous real key yields a key that shows the same painted result AND is re-editable (anchor markers on Edit vector); a hand-painted source behaves exactly as today; a forced copy failure still creates the key and says only that the script could not be copied."
    requirement: VEC-01
    verification: []
    human_judgment: true
    rationale: "The copy is unit-proven, but 'the new key shows the same painted result', 'Move/Select finds its vector path' and 'the sheet does not repaint on +Key' are live WKWebView visuals in the Studio window; vitest renders no DOM and the user runs the app."

duration: 8 min
completed: 2026-11-11
status: complete
---

# Phase 61 Plan 24: +Key carries the previous key's vector script Summary

**A +Key clone now records the previous real key's watercolor script — vector path included — onto the key it just created, under fresh ids and record-only, while Duplicate's script projection stops dropping `anchors`/`renderMode`**

## Performance

- **Duration:** 8 min
- **Started:** 2026-11-11T11:02:00Z
- **Completed:** 2026-11-11T11:10:20Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- `aquarelleStrokeFromScriptEvent` now re-emits the recorded event's `anchors` and `renderMode` through the same conditional spreads `toStudioStroke` uses — the Duplicate replay stops silently demoting a vector stroke to a hand-painted one (G-15).
- `PreviousRealKeyBaseResolution.clone` names its `sourceAppFrame` on both carriers (cached real-key bytes and durable record bytes), so the +Key copy reads the right frame without a second scan of the records; `toDestinationPayload` still labels only the destination.
- `useRotoKeyUtilities.addKey` gains an optional `copyScriptToNewKey` port: once `addEmptyKey` resolves true on a clone resolution it awaits the port exactly once with `{ sourceAppFrame, destinationAppFrame: currentFrame }`.
- The copy is **record-only** — nothing is applied or baked, so the cloned pixels and the freshly recorded timeline agree by construction and the sheet does not repaint on +Key.
- A copy failure publishes `ROTO_ADD_KEY_SCRIPT_COPY_FAILED` in the shipped message/status slots and never touches the "Could not add an empty Roto key." surface: the key exists, so only the copy failure is reported and nothing rolls back.
- `addKey` is single-flight for the whole add-and-copy sequence (`keyActionInFlightRef` + `setKeyActionInFlight`), with exactly one terminal `.finally`.
- `PhysicsPaintStudio`'s Duplicate record body was extracted verbatim into `recordAquarelleScriptCopyForFrames` and is now bound by **both** ports — the file still contains exactly one `copyAquarelleScriptToFrame(` call site.
- Duplicate's decision table, wait budget (2000 ms), apply-then-record order and five abort sentences are untouched; `runRotoDuplicateWithScript` was not edited.

## Task Commits

Each task was committed atomically (TDD RED then GREEN):

1. **Task 1 RED: failing tests for the vector carry-over on +Key** - `cb186c911` (test)
2. **Task 1 GREEN: carry the vector path through the script copy and name the clone source** - `5ce7f905b` (feat)
3. **Task 2 RED: failing tests for the record-only +Key script carry-over** - `3aaf69a4a` (test)
4. **Task 2 GREEN: record the previous key script onto the +Key clone** - `25a71f04d` (feat)

**Plan metadata:** see the final `docs(61-24): complete ...` commit on this branch.

_Note: TDD plans produce RED then GREEN commits per task; no REFACTOR commit was needed._

## TDD Gate Compliance

| Task | RED | GREEN | REFACTOR | Status |
|------|-----|-------|----------|--------|
| 1 | `cb186c911` | `5ce7f905b` | — | Pass |
| 2 | `3aaf69a4a` | `25a71f04d` | — | Pass |

RED evidence (JUnit report, console capture and record) is under
`.planning/phases/61-vector-painting-tool/.red-evidence/61-24-t1/` and `61-24-t2/`;
both records returned `RED_EVIDENCE_OK` from `gsd_run check tdd-red-evidence`.

- Task 1 RED: 51 tests collected, 11 failed — the two vector projection cases (the
  vector event losing `anchors`/`renderMode`, the round-trip copy) plus the nine
  previous-key-base cases that now expect `sourceAppFrame`. The hand-painted no-regression
  pin and the four shipped groups passed at HEAD by design.
- Task 2 RED: 422 tests collected, 4 failed — both new Studio pins (no
  `recordAquarelleScriptCopyForFrames` body exists at HEAD) and the two hook cases that
  require the port to be called. The blank-branch pin and the rejected-add pin passed at
  HEAD by design as no-regression guards.
- Task 1 also ran the tracer gate: auto mode was inactive, `human_verify_mode` is
  `end-of-phase`, and the tracer `<verify>` is automated-only, so the verify was re-run
  end-to-end (51/51) and the wave expanded with no checkpoint.

## Files Created/Modified
- `app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.ts` — two conditional spreads in `aquarelleStrokeFromScriptEvent` and the vector clause in the module comment; the anchor list is carried, never cloned.
- `app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.test.ts` — a `61-24 G-15` describe (3 tests) plus the event builder's optional `anchors`/`renderMode` fixture terms.
- `app/src/components/physic-paint/roto/physicsPaintRotoPreviousKeyBase.ts` — `sourceAppFrame` on the clone variant, populated from `previousFrame` in both clone returns.
- `app/src/components/physic-paint/roto/physicsPaintRotoPreviousKeyBase.test.ts` — every shipped clone expectation extended with `sourceAppFrame` (payloads unchanged) plus a `61-24 G-15` describe (2 tests).
- `app/src/components/physic-paint/hooks/useRotoKeyUtilities.ts` — the optional `copyScriptToNewKey` port, `ROTO_ADD_KEY_SCRIPT_COPY_FAILED`, and the restructured `addKey` (ref-gated, success-continuation copy, one `.finally`).
- `app/src/components/physic-paint/hooks/useRotoKeyUtilities.test.ts` — harness plumbing for the port and a `61-24 G-15` describe (4 tests).
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — the extracted `recordAquarelleScriptCopyForFrames` seam, bound by the Duplicate port and the new `copyScriptToNewKey` key-utilities port.
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` — a `61-24 G-15` describe (2 pins) and the repointed duplicate-ledger pin.

## Decisions Made
- **Conditional spreads, not defaults.** Writing `anchors: undefined` would change every hand-painted copy's key set and its byte cost; the absence IS the hand-painted signal (D-01/D-12), so both terms are written only when the source carried them.
- **Carry, don't re-project.** The plan's law: the event already holds the projected form and the record seam re-projects, so a `projectVectorPath` clone here would only add an aliasing-free copy nothing needs. The comment records that the source is never written.
- **Provenance on the resolution, not the payload.** `payload.appFrame` must keep naming the destination; `sourceAppFrame` is the copy's read pointer.
- **Copy inside the success continuation.** A `catch` at the promise's tail would let a copy rejection fall into the shipped add-failure message; the continuation keeps the two failures unmergeable.
- **Copy failure is data, the key stays.** The handler publishes status/message/lastError and returns — never a rollback, never the add message.
- **Ref gate added to `addKey`.** The plan's behaviour 4 requires a same-tick second click to be refused; only the ref is readable synchronously (the `useState` setter lands on the next render).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Repointed the pre-existing duplicate-ledger source pin at the extracted body**
- **Found during:** Task 2 GREEN
- **Issue:** The shipped pin `261027-klx Wave 3 — the app-owned ledger owns stroke acceptance > allocates duplicate-script copies through the same ledger, never an engine` sliced the Studio source between `'recordAquarelleScriptCopy: async (sourceFrame, destinationFrame) => {'` and `'return recorded > 0;'`. The plan's mandated extraction moves that body into `recordAquarelleScriptCopyForFrames`, so the start marker no longer exists and the pin failed for the wrong reason.
- **Fix:** Re-pointed the same pin at the same body's new location (`const recordAquarelleScriptCopyForFrames = ...` → `const rotoNavigation = useRotoNavigationCoordinator`), keeping both assertions identical — the ledger allocation marker and the `not.toContain('enqueueRecordedStroke')` negative. Nothing was deleted or relaxed; a short comment in the pin records why the markers moved (same precedent as the Phase 60 pins).
- **Files modified:** `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- **Commit:** `25a71f04d`

## Issues Encountered
- The first Task 1 RED record was rejected (`INVALID_RED / invalid_record / Unsupported report format`) because `gsd_run check tdd-red-evidence` classifies the record's `output` field, not the file at `reportPath` — and the JUnit adapter needs `output` to be the XML document alone. Both records now embed the JUnit XML in `output` and keep the human-readable run in `consolePath`; both validate `RED_EVIDENCE_OK`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Automated gates: the plan's four suites in one run → 473/473 pass
  (`physicsPaintRotoPreviousKeyBase` 15, `physicsPaintRotoDuplicateScript` 36,
  `PhysicsPaintStudio` 388, `useRotoKeyUtilities` 34 — each exactly at its floor);
  `pnpm --filter efx-motion-editor exec tsc --noEmit` → exit 0. No full-suite run was
  requested by the plan.
- **Native UAT rows (user-judged, pending):**
  - **A.** Draw a vector path on a real key, move to an empty frame, press +Key: the new
    key shows the same painted result AND Move/Select finds its vector path (anchor
    markers when editing).
  - **B.** Repeat on a key whose paint is hand-drawn: the new key behaves exactly as today.
  - **C.** Force a copy failure: the key is still created and the capsule says only that
    the script could not be copied (never "Could not add an empty Roto key.").
- Out of this plan's scope (unchanged, still deferred): the path-edit drag lifecycle
  (61-28), the paint re-bake (61-29), the curve-mode switch (61-30/61-31), the overlay
  conformance (61-25) and width discoverability (61-22).

---
*Phase: 61-vector-painting-tool*
*Completed: 2026-11-11*

## Self-Check: PASSED

- `app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.ts` — FOUND
- `app/src/components/physic-paint/roto/physicsPaintRotoPreviousKeyBase.ts` — FOUND
- `app/src/components/physic-paint/hooks/useRotoKeyUtilities.ts` — FOUND
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — FOUND
- Commit `cb186c911` — FOUND (ancestor of HEAD)
- Commit `5ce7f905b` — FOUND (ancestor of HEAD)
- Commit `3aaf69a4a` — FOUND (ancestor of HEAD)
- Commit `25a71f04d` — FOUND (ancestor of HEAD)
