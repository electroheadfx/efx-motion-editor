---
phase: 261031-dm1-lean-roto-authority-open-make-the-create
plan: 01
subsystem: physic-paint-roto
tags: [roto, play-script, authority, bridge, identities-only, fail-closed, tdd]

# Dependency graph
requires:
  - phase: 46-04
    provides: three-dimensional Roto authority (trackId + track/document revisions) and the strict request validator
  - phase: 52.2-02
    provides: the wire `frames` projection and the single-raster-carrier payload contract
provides:
  - identities-only authority request mode (validator + parent lean branch + result echo)
  - a port option threaded through the child hook used ONLY by the Create Rail open
  - fail-closed publication guards for both byte-carrying builders
affects: [create-rail-dialog, physic-paint-bridge, roto-play-script]

actuals:
  tokens: 7570
  tasks: 2
  commits: 4
  plan_head_before: 14db56ba845dadaaff27d2c7e9cfed286e4f2442
  plan_head_after: 208e513d5b7737261c9b918a46c813a7cd9bf287

tech-stack:
  added: []
  patterns:
    - "Optional lean mode on an existing authority round-trip: the flag rides the same request/result, every scalar still derives from the full records"
    - "Fail-closed guard at the publication boundary rather than at the payload clone (clonePhysicalPayload stays a shallow spread)"

key-files:
  created:
    - .planning/quick/261031-dm1-lean-roto-authority-open-make-the-create/red-evidence-task1.json
    - .planning/quick/261031-dm1-lean-roto-authority-open-make-the-create/red-evidence-task2.json
  modified:
    - app/src/types/physicPaint.ts
    - app/src/lib/physicPaintBridge.ts
    - app/src/components/physic-paint/hooks/useRotoPlayScriptController.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
    - app/src/lib/physicPaintBridgeAuthority.test.ts
    - app/src/components/physic-paint/hooks/useRotoPlayScriptController.test.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts

key-decisions:
  - "The lean flag is exactly-literal: absent or `true` only — `hasOnlyKeys` allowlists the key, and an explicit predicate rejects false/'true'/1/null before any store read."
  - "Lean mode computes capacity, layerEndExclusive, physicalCapacity, physicalRevision, rotoRevision and both interpolation fields from the FULL records, so the dialog's numbers are identical to full mode."
  - "Lean failures stay marked `identitiesOnly: true` (the failure helper spreads the marker), so a closed authority can never be mistaken for a byte-carrying one."
  - "Only `openConfirmation` passes the third port argument; confirm, commit-check, loop ops, source edit and repair keep the two-argument full request."
  - "Both publication builders assert the full authority before any payload clone — the guard, not `clonePhysicalPayload`, is the contract."

patterns-established:
  - "Identity-only transport mode: request flag + result echo + builder guard on every consumer that needs bytes"

requirements-completed: [QUICK-261031-DM1]

coverage:
  - id: D1
    description: "Create Rail open issues exactly one identities-only authority request carrying identities plus every scalar, with frames [] and payloads of exactly { frameIndex, appFrame }"
    requirement: QUICK-261031-DM1
    verification:
      - kind: unit
        ref: "app/src/lib/physicPaintBridgeAuthority.test.ts#identity-only Roto authority (261031-dm1) > returns identities plus every scalar and no raster bytes in lean mode"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoPlayScriptController.test.ts#261031-dm1: forwards identitiesOnly only for the lean authority request"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts#createRotoPlayScriptController identity-only authority (261031-dm1) > asks for identities only when the Create Rail dialog opens"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every full-mode request and result is unchanged: no identitiesOnly key, frames non-empty, record payloads still carry bytes/width/height"
    requirement: QUICK-261031-DM1
    verification:
      - kind: unit
        ref: "app/src/lib/physicPaintBridgeAuthority.test.ts#identity-only Roto authority (261031-dm1) > returns identities plus every scalar and no raster bytes in lean mode (full-mode assertions)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts#createRotoPlayScriptController identity-only publication guards (261031-dm1) > keeps confirm and commit-check on the full two-argument request"
        status: pass
      - kind: unit
        ref: "pnpm --dir app exec vitest run (full app suite, 6579 passed)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A lean authority can never become a publication: both builders fail closed with confirm() false, zero commits and an 'identity-only' error"
    requirement: QUICK-261031-DM1
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts#createRotoPlayScriptController identity-only publication guards (261031-dm1) > fails the standard apply path closed before any commit"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts#261031-dm1: a lean authority fails the link-to-existing-cycle path closed"
        status: pass
    human_judgment: false
  - id: D4
    description: "Live Studio: opening Create Rail on a large rail is prompt and Generate still commits normally"
    requirement: QUICK-261031-DM1
    verification: []
    human_judgment: true
    rationale: "Native Tauri Studio behavior on a large rail needs the user's live app; project law forbids starting the dev server or any packaged build from this executor."

duration: 5min
completed: 2026-10-31
status: complete
---

# Quick 261031-dm1: Lean Roto Authority for the Create Rail Open — Summary

**The Create Rail dialog opens on one identities-only authority request — no WebP bytes or duplicated `frames` payload cross the bridge — while every other authority consumer keeps the byte-carrying full mode and both publication builders fail closed on a lean result.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-10-31T08:53:01Z
- **Completed:** 2026-10-31T08:57:58Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 7

## Accomplishments

- `openConfirmation` now asks the parent for `{ identitiesOnly: true }`: the result carries key identities only, and every scalar it reads (`canonicalStart`, `capacity`, `layerEndExclusive`, `physicalCapacity`, `interpolationEnabled`) is still computed from the FULL records, so the dialog's numbers are unchanged.
- Lean payloads are exactly `{ frameIndex, appFrame }` and `frames` is `[]`; the full-mode result is byte-for-byte today's authority (non-empty `frames`, `payload.bytes/width/height` intact).
- The request validator accepts an absent flag or the literal `true` and rejects `false`, `'true'`, `1`, `null` and unknown keys before any store read.
- Lean failures stay marked lean (`identitiesOnly: true` rides the failure helper), so a closed authority is never mistaken for a byte-carrying one.
- `assertAuthorityPayloads` guards both `buildLoopOnlyPublication` and `buildPhysicalPublication` as their first statement: a lean result throws `... requires the full Roto authority; the result was identity-only.` before any payload clone or `ports.commit`, and the phase fails with zero commits.
- Only the open call site passes a third port argument; confirm and commit-check are pinned as exactly two-argument full requests.

## Task Commits

Each task followed RED → GREEN:

1. **Task 1: Identity-only authority end-to-end** — `57fa50430` (test, RED) → `f40bcfa51` (feat, GREEN)
2. **Task 2: Fail-closed publication guards + full-mode call-site pins** — `11c4ea4ac` (test, RED) → `208e513d5` (feat, GREEN)

**Plan commits:** 4 (measured `git rev-list --count 14db56ba8..HEAD`).

## TDD Gate Compliance

| Task | RED | GREEN | Evidence |
|------|-----|-------|----------|
| 1 | `57fa50430` test(261031-dm1-01) | `f40bcfa51` feat(261031-dm1-01) | `red-evidence-task1.json` — `RED_EVIDENCE_OK` (5 planned failures / 194 tests) |
| 2 | `11c4ea4ac` test(261031-dm1-02) | `208e513d5` feat(261031-dm1-02) | `red-evidence-task2.json` — `RED_EVIDENCE_OK` (2 planned failures / 358 tests) |

REFACTOR: not needed.

## Files Created/Modified

- `app/src/types/physicPaint.ts` — `identitiesOnly?: true` on the authority request and result; validator allowlist entry plus the exact-literal predicate.
- `app/src/lib/physicPaintBridge.ts` — `getPhysicPaintRotoAuthority` lean branch: identity-only `physicalRecords`, `frames` skipped, marker spread into success and every failure; all scalars and revisions still derived from the full records.
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` — `RotoPlayScriptAuthorityRequestOptions`, widened port, lean third argument on the open call only, `assertAuthorityPayloads` guard in both builders.
- `app/src/components/physic-paint/hooks/useRotoPlayScriptController.ts` — forwards the flag into the transport payload only when asked; `authorityFailure` echoes it on timeout/failure.
- `app/src/lib/physicPaintBridgeAuthority.test.ts` — validator cases and a new lean-vs-full describe; `mountTrackRuntime` moved to module scope for reuse.
- `app/src/components/physic-paint/hooks/useRotoPlayScriptController.test.ts` — lean/full transport payloads and the 15 s fallbacks under fake timers.
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts` — open call-site pin, both fail-closed paths, the two-argument confirm/commit-check pin, and an optional authority-override parameter on `applyHarness`.

## Decisions Made

- Lean mode is a marker on the existing authority round-trip rather than a second request type: one protocol, one validator, one failure shape.
- The guard lives at the publication boundary because `clonePhysicalPayload` is deliberately a shallow carrier-preserving spread — the payload shape alone cannot signal an error.
- The lean flag is written into the transport payload only when true, so the full request stays key-free and byte-identical.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The task-2 call-site pin passes as soon as task 1 lands, because it pins the two-argument confirm/commit-check law rather than the new guard. RED evidence therefore names the standard-apply fail-closed test as the target; the pin's early-green status is documented in `red-evidence-task2.json`'s `semanticAssessment`.

## Known Stubs

None.

## Verification

- Task 1 targeted: 3 files, 194 passed.
- Task 2 targeted: 4 files, 357 passed + 1 skipped.
- Full app suite: 359 files passed / 2 skipped; 6,579 passed / 1 skipped / 96 todo. Production vite build ran inside the suite — main chunk 1,581.58 kB, under the 2,000 kB ceiling.
- `pnpm --dir app run typecheck`: clean.
- No server started, no watch mode, no dependency or test-config change, no remote push.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Automated verification is complete; live UAT row D4 (open Create Rail on a large rail, confirm it opens promptly, then Generate to prove the full path still commits) remains user-run.
- The byte-carrying full path is untouched, so any other authority consumer needs no adaptation.

## Self-Check: PASSED

All seven source/test files, both RED evidence records and this SUMMARY exist; all four task commits (`57fa50430`, `f40bcfa51`, `11c4ea4ac`, `208e513d5`) are ancestors of HEAD.
