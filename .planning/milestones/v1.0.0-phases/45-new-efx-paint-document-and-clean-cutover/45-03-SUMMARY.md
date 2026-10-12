---
phase: 45-new-efx-paint-document-and-clean-cutover
plan: 03
subsystem: core
tags: [efx-paint, clean-break, rejection-gate, physic-paint, fixture-truth-table, typescript, vitest]

# Dependency graph
requires:
  - phase: 45-01
    provides: EfxPaintDocument v1.0 schema and factory (EFX_PAINT_DOCUMENT_VERSION = 1) the fresh-v1 fixture mirrors
  - phase: 45-02
    provides: efx_paint_documents top-level key in both Rust and TS project models (F1 co-change)
provides:
  - "Pure parse-time rejection gate predicate findLegacyPhysicPaintRejection over raw parsed .mce JSON (D-05/D-06)"
  - "Typed reason union LegacyPhysicPaintRejection: legacy-physic-paint-outputs | legacy-physic-paint-cache-reference (with path) | physic-paint-layer-without-document (with layerId)"
  - "Committed 5-fixture truth table covering every D-06 trigger and both must-pass cases (clean pre-v1 project, fresh v1.0 project — Pitfall F2 closed)"
affects: [45-05, 45-07, 45-08]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
# Same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 5411
  tasks: 2
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns: [pure fail-closed scan, structure-discriminated gate, committed fixture truth table, fixed precedence order]

key-files:
  created:
    - app/src/efx-paint/document/efxPaintCleanBreak.ts
    - app/src/efx-paint/document/efxPaintCleanBreak.test.ts
    - app/src/efx-paint/document/__fixtures__/legacy-physic-paint-outputs.mce.json
    - app/src/efx-paint/document/__fixtures__/legacy-cache-reference.mce.json
    - app/src/efx-paint/document/__fixtures__/documentless-physic-paint-layer.mce.json
    - app/src/efx-paint/document/__fixtures__/clean-pre-v1-project.mce.json
    - app/src/efx-paint/document/__fixtures__/fresh-v1-project.mce.json
  modified: []

key-decisions:
  - "The gate is a pure scan over raw parsed .mce JSON: no filesystem, no IPC, no mutation, no throwing on unexpected shapes — non-record input returns null and true corruption stays the open/serde concern (D-05/D-06)"
  - "Fixed precedence order outputs → cache-reference → documentless-layer; the FIRST matching reason is returned and reasons are terminal (D-07)"
  - "Pitfall F2 closed by structure discrimination: a 'physic-paint' layer is a trigger only when the top-level efx_paint_documents map has no entry for its layer id (source.layer_id, falling back to layer.id)"
  - "The cache-reference trigger scans every string value in the project JSON recursively for the 'cache/physic-paint' prefix and reports the first offending path"
  - "Tracer gate auto-approved: config mode is yolo (auto-approve), so the tracer verify was re-run green and execution continued without stopping (same handling as 45-01)"

patterns-established:
  - "Pure fail-closed scan: isPlainRecord guard + defensive traversal; the gate scans, it does not throw"
  - "Structure-discriminated gate: trigger 3 requires a missing efx_paint_documents entry, never a bare 'physic-paint' layer"
  - "Committed synthetic fixture truth table: hand-authored minimal .mce JSON per trigger and per must-pass case, distinct from the D-12 real-project UAT copy"
  - "Fixed precedence: outputs → cache-reference → documentless-layer, first match only"

requirements-completed: [DOC-03]

# Coverage metadata (#1602) — one entry per shipped deliverable. Drives DETERMINISTIC UAT routing in verify-work.
coverage:
  - id: D1
    description: "Pure parse-time rejection gate predicate findLegacyPhysicPaintRejection(project: unknown): LegacyPhysicPaintRejection | null with the exact 3-kind union (legacy-physic-paint-outputs, legacy-physic-paint-cache-reference with path, physic-paint-layer-without-document with layerId); pure (repeated calls equal, input deep-unchanged), non-throwing on non-record input, no filesystem/IPC imports"
    requirement: DOC-03
    verification:
      - kind: unit
        ref: "app/src/efx-paint/document/efxPaintCleanBreak.test.ts#findLegacyPhysicPaintRejection — legacy-physic-paint-outputs trigger"
        status: pass
    human_judgment: false
  - id: D2
    description: "Full D-06 truth table: non-empty physic_paint_outputs rejects; legacy cache/physic-paint path reference rejects with the offending path; 'physic-paint' layer without an efx_paint_documents entry rejects with its layerId; clean pre-v1 project (incl. inline 'paint' layer) passes; fresh v1.0 project with matching document entry passes (Pitfall F2); fixed precedence outputs → cache-reference → documentless-layer; malformed-but-present document entry is not this gate's concern"
    requirement: DOC-03
    verification:
      - kind: unit
        ref: "app/src/efx-paint/document/efxPaintCleanBreak.test.ts#findLegacyPhysicPaintRejection — full D-06 truth table"
        status: pass
    human_judgment: false
  - id: D3
    description: "5 committed synthetic .mce fixtures under app/src/efx-paint/document/__fixtures__/ (legacy-physic-paint-outputs, legacy-cache-reference, documentless-physic-paint-layer, clean-pre-v1-project, fresh-v1-project) — hand-authored minimal JSON, committed test data, distinct from the D-12 real-project UAT copy"
    requirement: DOC-03
    verification:
      - kind: unit
        ref: "pnpm --filter efx-motion-editor exec vitest run src/efx-paint/document (26 passed)"
        status: pass
    human_judgment: false

# Metrics
duration: 5min
completed: 2026-08-23
status: complete
---

# Phase 45: New EFX Paint Document and Clean Cutover — Plan 03 Summary

**Single pure parse-time rejection gate predicate with a committed 5-fixture truth table: all three D-06 legacy triggers reject with typed reasons, both must-pass cases (clean pre-v1 project, fresh v1.0 project) pass, and precedence is fixed — Pitfall F2 closed by contract test**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-23T16:15:38Z
- **Completed:** 2026-08-23T16:18:00Z
- **Tasks:** 2
- **Files modified:** 7 (2 source/test created, 5 fixtures created)

## Accomplishments
- `findLegacyPhysicPaintRejection` — pure, contract-testable gate predicate over raw parsed `.mce` JSON: non-empty `physic_paint_outputs` → `legacy-physic-paint-outputs`; recursive scan for the `cache/physic-paint` prefix → `legacy-physic-paint-cache-reference` with the offending path; `'physic-paint'` layer without a top-level `efx_paint_documents` entry → `physic-paint-layer-without-document` with its layerId (DOC-03, D-05/D-06)
- Pitfall F2 closed: the fresh-v1 fixture proves the app's own v1.0 projects (version 16, physic-paint layer + matching document entry) pass the gate — the literal "any physic-paint layer" trigger is NOT applied
- Fixed precedence order (outputs → cache-reference → documentless-layer) contract-tested with a 3-stage inline project
- 5 committed synthetic fixtures under `app/src/efx-paint/document/__fixtures__/` — hand-authored minimal JSON, distinct from the D-12 real-project UAT copy
- 9 unit tests (3 Task-1 + 6 truth-table) green; full suite 2701 passed (up from 2692), typecheck clean

## Task Commits

Each task was committed atomically (TDD: test → feat per task):

1. **Task 1: Gate predicate + reason union + first-trigger fixture** - `ce19c70b` (test) + `700a6346` (feat)
2. **Task 2: Full D-06 truth table — cache-ref + document-less-layer triggers, must-pass cases, precedence order** - `e327b192` (test) + `109093c8` (feat)

**Plan metadata:** (committed with this SUMMARY)

## Files Created/Modified
- `app/src/efx-paint/document/efxPaintCleanBreak.ts` - Pure gate predicate + `LegacyPhysicPaintRejection` union; triggers 1-3 with fixed precedence; no imports (no fs/IPC)
- `app/src/efx-paint/document/efxPaintCleanBreak.test.ts` - 9 tests: outputs trigger, purity, non-record input, cache-reference, documentless-layer, clean-pre-v1 pass, fresh-v1 pass, precedence, malformed-document pass
- `app/src/efx-paint/document/__fixtures__/legacy-physic-paint-outputs.mce.json` - Version 15, physic-paint layer, non-empty `physic_paint_outputs` with one blob
- `app/src/efx-paint/document/__fixtures__/legacy-cache-reference.mce.json` - Version 15, empty outputs, `cache/physic-paint/legacy-frame.png` reference on a paint layer
- `app/src/efx-paint/document/__fixtures__/documentless-physic-paint-layer.mce.json` - Version 15, physic-paint layer, no `efx_paint_documents` entry
- `app/src/efx-paint/document/__fixtures__/clean-pre-v1-project.mce.json` - Version 15, static-image + inline paint layers, no Physic Paint anything
- `app/src/efx-paint/document/__fixtures__/fresh-v1-project.mce.json` - Version 16, physic-paint layer + matching `efx_paint_documents` entry (45-01 factory shape)

## Decisions Made
- **Pure scan, never throws**: non-record input returns null; true parse corruption remains the existing open/serde concern (D-05/D-06)
- **Fixed precedence**: outputs → cache-reference → documentless-layer, first match only; reasons are terminal with no recourse (D-07)
- **F2 discrimination**: trigger 3 keys on the absence of an `efx_paint_documents` entry for the layer's `source.layer_id` (falling back to `layer.id`), never on the bare layer type
- **Cache-reference scan scope**: every string value in the project JSON, depth-first in insertion order, prefix `cache/physic-paint` (physicPaintPersistence.ts:17)
- **Tracer gate handling**: config mode is `yolo` (auto-approve) with `_auto_chain_active: false` — treated as auto mode, re-ran the tracer verify (green), and continued to Task 2 without stopping (same handling as 45-01)

## Deviations from Plan

### Auto-fixed Issues

**1. [Typecheck - Blocking] Test fixture typing for the precedence test**
- **Found during:** Task 2 verification (typecheck after GREEN)
- **Issue:** `delete withoutCacheRef.cache_path` failed TS2790 (operand of delete must be optional) because the inline base object inferred `cache_path` as required; the spread override then narrowed the type to `{ physic_paint_outputs: never[] }` (TS2339)
- **Fix:** Typed the base and derived objects as `Record<string, unknown>` so the delete is legal and the spread keeps the full shape
- **Files modified:** app/src/efx-paint/document/efxPaintCleanBreak.test.ts
- **Verification:** `pnpm --dir app run typecheck` clean; gate suite 9/9
- **Committed in:** 109093c8 (Task 2 GREEN)

---

**Total deviations:** 1 auto-fixed (1 blocking typecheck)
**Impact on plan:** Test-only typing fix; no behavior change, no scope creep.

## Issues Encountered
- Typecheck surfaced a `delete`-on-required-property error in the precedence test's inline fixture — resolved by typing the fixture as `Record<string, unknown>`; pure type-level issue, no behavior change

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `findLegacyPhysicPaintRejection` is the predicate 45-05 wires into `projectStore.openProject` immediately after the `result.ok` check and before `loadPhysicPaintData` (Pitfall F4 placement), with the blocking dialog consuming the typed `LegacyPhysicPaintRejection` reason
- The gate trigger strings (`physic_paint_outputs`, `cache/physic-paint`, layer type `physic-paint`, document key `efx_paint_documents`) are the exact tokens plan 45-07's DOC-04 grep contract must allowlist for this module
- 45-04 (store + persistence) proceeds independently; no blockers

---
*Phase: 45-new-efx-paint-document-and-clean-cutover*
*Completed: 2026-08-23*
