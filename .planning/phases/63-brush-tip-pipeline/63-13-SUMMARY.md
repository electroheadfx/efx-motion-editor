---
phase: 63-brush-tip-pipeline
plan: 13
subsystem: brush-engine
tags: [mask-registry, builtin-tips, trust-boundary, watercolor, wr-05]

# Dependency graph
requires:
  - phase: 63-brush-tip-pipeline
    plan: 01
    provides: derived tip mask law and the maskRegistry lifecycle (reject / replace / reset / identity)
  - phase: 63-brush-tip-pipeline
    plan: 03
    provides: BUILTIN_TIP_MASKS — the three compile-time allocations decoded once at module load
provides:
  - unshadowable built-in tip ids at both mask-registry write seams (registerMask, replaceMaskRegistry)
  - a template constant, builtinMasksById, that is the single authority for the reservation law
affects: [63-11, 63-12, phase verification, any future caller of registerMask / replaceMaskRegistry]

# Actuals (#2632) — same estimateTokens scale (chars/4 over the realized diff).
actuals:
  tokens: 5898
  tasks: 2
  commits: 5

# Plan commit ledger (#3968) — measured, not narrated.
plan_head_before: 8904815a4afcbcd6b43e3ad685e57a48c2d92356
plan_head_after: b55095148cd6c92caa81305c4474f5674e8971f4

tech-stack:
  added: []
  patterns:
    - "Reserved-id seam: a module-load Map of the compile-time allocations is the one authority both write paths consult"
    - "Identity admission: bytes equality is explicitly NOT identity — only the exact BUILTIN_TIP_MASKS array installs a built-in id"

key-files:
  created: []
  modified:
    - packages/efx-watercolor/src/brushes/maskRegistry.ts
    - packages/efx-watercolor/src/brushes/maskRegistry.test.ts
    - packages/efx-watercolor/src/brushes/builtinBake.test.ts

key-decisions:
  - "builtinMasksById (id -> the exact BUILTIN_TIP_MASKS allocation) is built once at module load and is the single authority for both write laws; the reserved set is derived from BUILTIN_TIP_MASKS alone and never widened"
  - "replaceMaskRegistry admits a built-in id on IDENTITY, not bytes: an equal-byte copy under wc/builtin-* is logged and skipped, because a copy is not the shipped allocation"
  - "registerMask refuses a reserved id BEFORE the writable check and before any mutation, so a refused registration bumps no generation and logs the id by name"
  - "A refused built-in entry installs nothing; the shipped allocations are preserved by the appliers' built-ins-first prefix (applyProjectBrushSet / applyBrushCatalogPayload), not by rewriting the refused entry in place"

patterns-established:
  - "Reserved-id pair: registration refuses outright; whole-set replacement admits only the originating allocation"
  - "Refusal logging: every skipped entry names the id and the reason in one console.warn / console.error line"

requirements-completed: [TIP-06, TIP-13]

coverage:
  - id: D1
    description: "registerMask refuses all three built-in tip ids with a logged warning, no map write and no generation bump, while custom ids register and resolve by identity as before"
    requirement: TIP-13
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/brushes/maskRegistry.test.ts#registerMask — built-in ids are reserved (WR-05) > refuses all three built-in ids, logs each, and never mutates or bumps"
        status: pass
    human_judgment: false
  - id: D2
    description: "replaceMaskRegistry admits a built-in id only with the exact compile-time allocation; a foreign array under a built-in id (equal bytes included) is logged and skipped while valid custom siblings still install, and every built-ins-first replace keeps all three built-ins resolvable by identity"
    requirement: TIP-13
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/brushes/maskRegistry.test.ts#replaceMaskRegistry — built-in ids admit only the compile-time allocation (WR-05) > refuses a later equal-bytes shadow and still installs a custom sibling"
        status: pass
      - kind: unit
        ref: "packages/efx-watercolor/src/brushes/maskRegistry.test.ts#replaceMaskRegistry — built-in ids admit only the compile-time allocation (WR-05) > a built-ins-first list keeps all three built-ins resolvable by identity"
        status: pass
      - kind: unit
        ref: "packages/efx-watercolor/src/brushes/maskRegistry.test.ts#resetMaskRegistry — no ghost mask > restores exactly the three built-ins and the previously registered id resolves to null"
        status: pass
    human_judgment: false

duration: 3 min
completed: 2026-11-15
status: complete
---

# Phase 63 Plan 13: Built-in tip ids become unshadowable at the mask registry Summary

**WR-05 closed: the three compile-time built-in tip textures can no longer be shadowed for the session — `registerMask` refuses their ids outright, and `replaceMaskRegistry` admits a built-in id only with the exact `BUILTIN_TIP_MASKS` allocation.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-11-15T15:24:31Z
- **Completed:** 2026-11-15T15:28:35Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- `registerMask` now refuses every built-in id before the writable check: returns false, logs the id, mutates nothing, bumps no generation. A Roto script's `brushPack` naming `wc/builtin-chalk` can no longer replace the shipped chalk texture for the session.
- `replaceMaskRegistry` admits a built-in id only with the identical compile-time allocation. A foreign array under that id — even with equal bytes — is logged and skipped, while the call's valid custom entries still install (D-18 per-entry degradation preserved).
- The one legitimate seeding path is untouched: `resetMaskRegistry()` (which passes `BUILTIN_TIP_MASKS` itself) still installs exactly the three built-ins in declared order, and `replaceMaskRegistry([])` remains a clean wipe.
- The env-gated bake's end-to-end pin was repointed to prove the same contract: the mask the engine paints under a built-in id IS the shipped allocation, and its bytes equal the freshly baked constant.

## Task Commits

Each task was committed atomically (TDD: RED then GREEN allowed to land as separate commits):

1. **Task 1: reserve the built-in tip ids in `registerMask`** — `489f47d66` (test, RED) → `3ebce054b` (feat, GREEN)
2. **Task 2: identity-only admission for built-in ids in `replaceMaskRegistry`** — `8f5163921` (test, RED) → `aeab6cb4a` (feat, GREEN)
3. **Deviation Rule 1: repoint the bake end-to-end pin to the identity law** — `b55095148` (test)

**Plan metadata:** see final `docs(63-13): complete …` commit.

## Files Created/Modified

- `packages/efx-watercolor/src/brushes/maskRegistry.ts` — added `builtinMasksById` (module-load id → exact allocation map, the one authority for both write laws); `registerMask` refuses reserved ids before the writable check with a warning; `replaceMaskRegistry` admits a built-in id only on identity (`entry.mask !== builtin` logged and skipped); header and both docstrings document the reservation law (WR-05 / T-63-31). Custom-id behaviour and the generation contract are unchanged.
- `packages/efx-watercolor/src/brushes/maskRegistry.test.ts` — 22 → 28 tests. New describe blocks pin the reservation law: three built-in ids refused with exactly three warnings, identity preserved, generation unchanged; built-ins-first replace keeps all three resolvable; equal-bytes shadow refused while a custom sibling installs; wrong-length built-in entry refused with the shipped allocation kept; foreign-only built-in id never resolves to the foreign array; custom ids still register by identity.
- `packages/efx-watercolor/src/brushes/builtinBake.test.ts` — the `BAKE_BUILTIN_TIPS=1` end-to-end block now resets the registry and asserts the painted built-in mask IS the shipped allocation plus byte-equality against the freshly baked constant, instead of installing the fresh decode under the built-in id (which the identity law now refuses by design).

## Decisions Made

- **`builtinMasksById` is the single authority.** Built once at module load from `BUILTIN_TIP_MASKS`, it backs both laws — no duplicated id lists, and the reserved set cannot drift from the constants. The map is never widened.
- **Identity, not bytes.** `replaceMaskRegistry` admits a built-in id only when `entry.mask === builtin.mask`. An equal-byte copy is a different array and is refused: bytes equality is not the shipped allocation, and admitting it would reopen exactly the shadowing path WR-05 closes.
- **Refusal before the writable check** in `registerMask`, so a reserved id is refused even when the mask is the wrong length — the log always names the actual reason (reserved id), never a misleading length failure.
- **A refused built-in entry installs nothing.** The shipped allocations survive because both production appliers (`applyProjectBrushSet`, `applyBrushCatalogPayload`) build their list built-ins-first from `BUILTIN_TIP_MASKS`; no in-place rewriting of a refused entry was added, matching the plan's literal action.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Repointed the bake end-to-end pin to the identity law**
- **Found during:** Task 2 (identity-only admission in `replaceMaskRegistry`)
- **Issue:** `builtinBake.test.ts`'s env-gated end-to-end block installed freshly decoded copies under built-in ids via `replaceMaskRegistry(decoded)` and then asserted the engine painted one of those copies. The new identity law correctly refuses such copies, so the pin would fail — or worse, silently assert nothing meaningful — whenever `BAKE_BUILTIN_TIPS=1` is run.
- **Fix:** repointed the pin: `resetMaskRegistry()`, then assert `buildBrushForStroke('wc/builtin-bristle').tipData === BUILTIN_TIP_MASKS[..].mask` (identity) AND byte-equality with the freshly baked constant (the bake still proves its output). The test's purpose — "the artifact just written is the tip the engine paints" — is preserved under the new contract.
- **Files modified:** `packages/efx-watercolor/src/brushes/builtinBake.test.ts`
- **Verification:** full package suite 407 passed / 9 skipped; typecheck clean; build exit 0. The env-gated block itself was not executed (requires `sips` and `BAKE_BUILTIN_TIPS=1`; it is a one-off authoring step).
- **Committed in:** `b55095148`

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** The fix was required for correctness — the plan's own law invalidated a latent assertion in a file outside the plan's `<files>` list. No scope creep; no production behaviour outside the registry changed.

## Issues Encountered

None. The plan's flagged TIP-06 assumption (registry lifecycle law verified in 63-01/63-03, not re-verified here) held: the existing register/replace/reset/identity pins and the `buildBrushForStroke` fallback pins all pass unchanged.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- WR-05 is closed; both mask write seams are covered inside the module every write already passes through, so callers need no exclusion lists.
- Plan 63-11 (WR-06) and 63-12 (WR-07) remain open in phase 63; nothing in this plan blocks them.
- Regression sweep: package suite 407 passed / 9 skipped; app suites `aquarelleBrushCatalog` + `efxPaintBrushImport` (38), `watercolorStrokeThumb` + `aquarelleFootprint` (27), `projectStore.efxPaintCutover` (30) all green; `tsc --noEmit` clean; tsup build exit 0.

## TDD Gate Compliance

- Task 1: RED `489f47d66` (24 tests, 23 pass, 1 fail — built-in registration accepted) → GREEN `3ebce054b` (all pass). Evidence: `63-13-red-evidence-task1.json`, verdict `RED_EVIDENCE_OK`.
- Task 2: RED `8f5163921` (28 tests, 25 pass, 3 fail — equal-bytes shadow admitted, no refusal log, foreign-only id resolved) → GREEN `aeab6cb4a` (all pass). Evidence: `63-13-red-evidence-task2.json`, verdict `RED_EVIDENCE_OK`.

## Self-Check: PASSED

- `packages/efx-watercolor/src/brushes/maskRegistry.ts` — FOUND
- `packages/efx-watercolor/src/brushes/maskRegistry.test.ts` — FOUND
- `packages/efx-watercolor/src/brushes/builtinBake.test.ts` — FOUND
- `.planning/phases/63-brush-tip-pipeline/63-13-red-evidence-task1.json` — FOUND
- `.planning/phases/63-brush-tip-pipeline/63-13-red-evidence-task2.json` — FOUND
- Commits `489f47d66`, `3ebce054b`, `8f5163921`, `aeab6cb4a`, `b55095148` — all ancestor of HEAD (FOUND)
- Evaluation scope `gsd_run check evaluation-scope --plan 63-13 --commits-only` — resolved, exactly the five plan commits

---

*Phase: 63-brush-tip-pipeline*
*Completed: 2026-11-15*
