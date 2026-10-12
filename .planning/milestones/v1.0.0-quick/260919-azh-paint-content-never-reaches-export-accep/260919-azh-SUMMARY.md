---
phase: quick-260919-azh
plan: 260919-azh
subsystem: export
tags: [export, frameMap, physic-paint, enumeration, vitest, diagnosis, escalation]

requires:
  - phase: 52.2-project-package-format-references-only
    provides: reference-only document carriers (the audited seam — EXONERATED here) and the pre-53 queue entry that routed this quick
provides:
  - "Empirical verdict NEVER-WIRED for the 'paint content never reaches export' acceptance blocker, with file:line evidence"
  - "Discrimination matrix app/src/lib/exportEngine.paintEnumeration.test.ts: 2 green controls, 1 green characterization, 2 parked Phase 53 todo contracts"
  - "Four scoped design questions Phase 53 must answer before any paint-only export wiring"
affects: [53, export, phase-53-planning]

actuals:
  tokens: 3200
  tasks: 2
  commits: 2
  plan_head_before: d035aeb76185152701824aa70b4f1f0e1b2443e9

tech-stack:
  added: []
  patterns:
    - "Discriminating test matrix: sub-discriminant control (content-only) + wired-leg pin (content+paint) + RED contracts (paint-only) + characterization (selectedSequenceOnly) in one file"
    - "Real-subject harness: exportEngine.test.ts mocks verbatim EXCEPT './frameMap' and '../stores/sequenceStore' — the real computed over real stores is the subject under test"

key-files:
  created:
    - app/src/lib/exportEngine.paintEnumeration.test.ts
  modified: []

key-decisions:
  - "Verdict NEVER-WIRED: no existing read returned wrong data (all in-test probes green); frameMap materializes FrameEntry only from content keyPhotos and the tail pad can only replicate an existing content entry — the paint-only enumeration branch was never designed"
  - "Escalation clause applied as specified: Cases C/D parked as it.todo x2 with Phase 53 pointers, zero production-code changes, Task 3 skipped entirely"

requirements-completed: []

coverage:
  - id: D1
    description: "Paint-export enumeration discrimination matrix committed; controls and characterization green, paint-only contracts parked as Phase 53 todos"
    verification:
      - kind: integration
        ref: "app/src/lib/exportEngine.paintEnumeration.test.ts — pnpm vitest run: 3 passed | 2 todo (5)"
        status: pass
      - kind: other
        ref: "full suite: pnpm vitest run — 215 files passed, 3985 tests passed | 1 skipped | 103 todo, exit 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "NEVER-WIRED verdict and the scoped Phase 53 design questions (escalation report)"
    verification:
      - kind: other
        ref: "in-test probes green: getRotoRealKeyRecords=5, getRotoPhysicalEndFrame=5, activeTrackId='track-1' (2026-09-19 run)"
        status: pass
    human_judgment: true
    rationale: "The verdict is a scoping decision — Phase 53 planning must accept the design questions before paint-only export wiring is scheduled"

duration: 14min
completed: 2026-09-19
status: complete
---

# Quick 260919-azh: Paint Content Never Reaches Export — Diagnosis Summary

**Paint-only export fails at enumeration, not at read: the runtime carries the keys correctly (probes green) but frameMap has no paint-only enumeration branch — verdict NEVER-WIRED, both RED contracts parked as Phase 53 todos, zero production code touched.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-09-19T06:22:18Z
- **Completed:** 2026-09-19T06:36:12Z
- **Tasks:** 2 of 3 executed (Task 3 skipped per the binding escalation gate — verdict NEVER-WIRED)
- **Files modified:** 1 (test file only)

## Task 1 RED/GREEN split (recorded verbatim, 2026-09-19 run)

Command: `cd app && pnpm vitest run src/lib/exportEngine.paintEnumeration.test.ts` — exit 1.

| Case | Expected today | Actual | Result |
|------|----------------|--------|--------|
| Control A (content-only sub-discriminant) | PASS | status 'complete', renderGlobalFrame x3, frameMap 3 | **PASS** |
| Control B (content+paint wired-leg pin) | PASS | frameMap 9, status 'complete', renderGlobalFrame x9 | **PASS** |
| Case C (paint-only enumeration) | RED | `expected [] to have a length of 5 but got +0` at the frameMap assertion | **RED as planned** |
| Case D (paint-only export) | RED | `expected 'error' to be 'complete'` at the status assertion | **RED as planned** |
| Case E (selectedSequenceOnly + fx active) | PASS | error exactly 'No frames to export (timeline is empty)', zero renders | **PASS** |

In-test probes inside Case C (all **green**, run before the failing assertion): `getRotoRealKeyRecords(LAYER,'track-1')` = 5 records; `getRotoPhysicalEndFrame(LAYER,'track-1')` = 5; `getEfxPaintDocument(LAYER).activeTrackId` = 'track-1'.

**RED evidence note (machine classifier):** `gsd_run check tdd-red-evidence` parses node-`--test` TAP summaries only (`^# tests N` + line-anchored `not ok`); vitest's TAP reporter emits file-level failures with indented per-test lines and no `# tests/# fail` summary, so the record cannot be machine-verified — same limitation recorded for cargo output in 52.2-01-SUMMARY. Evidence is recorded verbatim above instead (precedent: 52.2-01). Vitest TAP details: Case C `AssertionError: expected [] to have a length of 5 but got +0` (actual "0", expected "5", exportEngine.paintEnumeration.test.ts:290); Case D `AssertionError: expected 'error' to be 'complete'` (exportEngine.paintEnumeration.test.ts:302).

## Task 2 verdict: NEVER-WIRED

**BROKEN-READ requires a named existing read returning wrong data at runtime. Every candidate read was exercised in-test and returned correct data**, so the verdict is NEVER-WIRED by the plan's own gate definition.

Evidence chain (all citations re-verified against the working tree 2026-09-19):

1. **Construction is content-only by design** — `frameMap.ts:16-47`: entries are pushed exclusively inside `for (const seq of sequences.filter(s => s.kind === 'content'))` over `seq.keyPhotos` (:21-39). No branch materializes an entry from an fx sequence or a physic-paint layer.
2. **The tail pad cannot bootstrap from zero** — `frameMap.ts:41-45`: `const tailEntry = entries[entries.length - 1]; while (tailEntry && entries.length < targetLength)`. With zero content keyPhotos `tailEntry` is `undefined` and the loop never fires; padding can only *replicate the last content entry*, never synthesize a paint-carrying one. Control B proves this machinery works when content exists (3 content + keys at 0/4/8 → 9 entries).
3. **The required-count leg is correct** — `frameMap.ts:244-259` (`getTimelineRequiredFrameCount`) iterates ALL sequences including fx, extends by `timelineRange.globalEndExclusive` (:251) and by `seqStart + rotoEnd` (:252-256) via `getPhysicPaintRotoDisplayEndFrame` (`frameMap.ts:227-242`), whose no-loop path reads `physicPaintStore.getRotoPhysicalEndFrame` (:231).
4. **The runtime reads are carrier-agnostic and correct** — `physicPaintStore.ts:3599-3603` (`getRotoRealKeyRecords`) and `:3843-3855` (`getRotoPhysicalEndFrame`) read the `_rotoRealKeyRecords` runtime maps, never the document's frame carrier. The Case C probes prove 5 records / end frame 5 with a registered reference-only document — the **52.2 reference-only hypothesis is EXONERATED in-test**.
5. **The export gate then hard-errors** — `exportEngine.ts:142-156`: `frameMap.peek()` = `[]` → `total === 0` → status 'error', 'No frames to export (timeline is empty)' (:152-156). The enumeration leg, not the render leg, is the break: the overlay RENDER leg never consults frameMap entries (`exportRenderer.ts:300-362` draws fx/physic-paint layers via the CMP-01 `getFlattenedFrame` seam for any global frame inside the sequence span).

Conclusion: the paint-only enumeration branch (paint-carrying FrameEntry ownership/transparency semantics, N derivation, and the no-content canvas-clear lifecycle) was **never designed** — repairing it is Phase 53 design work, not a read correction. The binding escalation clause applies.

## Probe C — canvas-clear lifecycle on no-content frames (evidence, not fixed)

`renderGlobalFrame` (`exportRenderer.ts:123-363`) has **no top-level canvas clear**. The only `clearCanvas=true` calls live inside the content branch: :281 (solid fade mode) and :295 (normal transparency mode), gated by `hasContentEntry` (:140, branch :148-298). The cross-dissolve sub-paths clear at :237 (outgoing) and :206 (GL, direct `ctx.clearRect`). Both overlay branches pass `clearCanvas=false` (content-overlay :333, fx :358). Today this state is unreachable during export — every enumerated entry, including tail-padded ones, carries a content sequenceId — but **the moment Phase 53 enumerates paint-only frames, consecutive frames would composite onto uncleared pixels**. The canvas-clear lifecycle for no-content frames must be designed alongside paint-only enumeration.

## Probe D — Case E reachability (user-reachable)

The 'Selected sequence only' checkbox (`FormatSelector.tsx:76-98`) is always rendered and ungated on sequence kind; its info line (:88-91) computes the frame count from `activeSeq.keyPhotos.reduce(...)` — 0 for an fx sequence — without disabling or warning. `sequenceStore.setActive` (:1091-1094) is kind-agnostic, and the delete fallback (`sequenceStore.remove`, :156-158) reassigns `activeSequenceId` to `sequences.value[0]` with no kind filter — deleting the active content sequence while an fx sequence heads the array leaves the fx sequence active. (Content-only paths: SequenceList filters `kind === 'content'` at :25; the timeline name-label hit test iterates `trackLayouts` and excludes the fx area, TimelineInteraction.ts:321-350.) Case E's shape is therefore user-reachable, and the export errors with the same locked copy.

## Phase 53 design questions (verbatim, per the escalation clause)

1. **Paint-only FrameEntry ownership/transparency** — what `sequenceId`/`keyPhotoId`/`imageId` does a paint-carrying FrameEntry own, and what does the content branch render (or skip) for it?
2. **N derivation from fx span vs key extent** — is the paint-only export length the fx sequence span (`inFrame..outFrame`), the roto key extent (`getPhysicPaintRotoDisplayEndFrame`), or their max, and who owns the clamp?
3. **Canvas clear lifecycle on no-content frames** — where does the export canvas get cleared when a frame has no content entry (Probe C: no top-level clear exists today)?
4. **selectedSequenceOnly semantics when the active sequence is an fx sequence** — filter by fx id against a map whose entries never carry it (today: always empty → hard error), or bypass/redesign the filter for fx actives (Probe D: user-reachable)?

## Task Commits

1. **Task 1: RED — paint-export enumeration discrimination matrix** — `b1eeca8f` (test)
2. **Task 2: park paint-only RED contracts as Phase 53 todos — verdict NEVER-WIRED** — `a5900f7c` (test)

Task 3 (BROKEN-READ-only read repair) did not run: its precondition (`Task 2 verdict is BROKEN-READ`) is unmet by design; the escalation gate ended the quick.

**Plan base:** `d035aeb7` (docs: create paint-export enumeration quick plan)

## Files Created/Modified

- `app/src/lib/exportEngine.paintEnumeration.test.ts` — the discriminating matrix: 2 green controls, 1 green characterization, 2 parked `it.todo` Phase 53 contracts (committed RED as 5 runnable cases in `b1eeca8f`, then C/D parked in `a5900f7c`).

## Decisions Made

- NEVER-WIRED verdict per the gate definition: no named existing read returned wrong data; the failure is a missing enumeration branch (design), not a divergent read (repair).
- Honored the escalation clause byte-for-byte: `git diff --stat d035aeb7..HEAD` shows exactly one test file changed (+320/-0 net across both commits); zero production-code changes.

## Deviations from Plan

None — plan executed exactly as written, including the escalation gate. (Process note: the machine RED-evidence classifier cannot parse vitest output; evidence recorded verbatim above per the 52.2-01 precedent. This is a tooling limitation, not a plan deviation.)

## TDD Gate Compliance

- RED commit `b1eeca8f` (`test(260919-azh): ...`) exists and touches only a test file; the RED was intentional — the two TARGET tests (Cases C and D) failed on the planned behavior assertions while all controls and probes passed (split table above).
- GREEN commit intentionally absent: the verdict is NEVER-WIRED, and the plan's binding escalation clause forbids any paint→export wiring in this quick. Task 3's TDD cycle is defined but not entered (precondition unmet). No gate violation — the sequence stops by design.
- RED evidence not machine-verified (`check tdd-red-evidence` parses node-`--test` TAP only); verbatim record above (52.2-01 precedent).

## Issues Encountered

- None in the code path. (Shell ergonomics only: background Bash calls reset cwd to the repo root, so the full-suite run was launched via `pnpm -C app exec vitest run`.)
- The two parked `it.todo` contracts could NOT be appended to `.planning/WINDOWS.md`: `gsd_run windows append` rejects with a pre-existing ledger integrity error (frontmatter counts open/waived/fixed/total=24/1/42/67 vs entries 29/1/42/72) that predates this quick. Left untouched (repair is out of scope); the contracts are tracked here and by the `it.todo` grep surface instead.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 53 acceptance is unblocked by evidence: the blocker is scoped to a missing paint-only enumeration branch (plus the canvas-clear and selectedSequenceOnly design questions above), NOT to the 52.2 package format — the reference-only document carrier is exonerated by in-test probes.
- The two parked `it.todo` contracts in `app/src/lib/exportEngine.paintEnumeration.test.ts` are the ready-made acceptance tests for the Phase 53 design (reinstate as `it` with the bodies preserved in comments).
- No production-code drift to reconcile: diffstat over the plan base is test-file-only.

## Self-Check: PASSED

- File exists: `app/src/lib/exportEngine.paintEnumeration.test.ts` (verified on disk)
- Commit `b1eeca8f` exists (`git log --oneline` — Task 1 RED matrix)
- Commit `a5900f7c` exists (`git log --oneline` — Task 2 escalation)
- Targeted verify: `pnpm vitest run src/lib/exportEngine.paintEnumeration.test.ts` → 3 passed | 2 todo (exit 0); `grep -c 'it\.todo'` = 2
- Full verify: `pnpm vitest run` → 215 files passed, 3985 tests passed | 1 skipped | 103 todo, exit 0
- Escalation proof: `git diff --stat d035aeb7..HEAD` → test file only, zero production-code changes

---
*Phase: quick-260919-azh*
*Completed: 2026-09-19*
