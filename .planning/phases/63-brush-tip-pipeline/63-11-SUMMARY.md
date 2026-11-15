---
phase: 63-brush-tip-pipeline
plan: 11
subsystem: paint
tags: [preact-signals, catalog-sync, script-carrier, save-law, named-refusals, tdd]

requires:
  - phase: 63-brush-tip-pipeline
    provides: "63-08's inline maskDataUrl carrier, 63-10's normalizeProjectBrushTip law, and 63-07's replace-only apply ordering"
provides:
  - "A realm-local `brushCatalogSynced` fact: an empty Studio catalog is known-empty only after a payload arrived, never before"
  - "A per-entry save law: an unavailable tip costs one entry and one log, while a healthy tip with missing bytes still refuses"
  - "`referencedCustomBrushIds` — the painted custom tip ids read from `engine.brushId`, unique and first-seen ordered"
  - "Two named save refusals: unsynced catalog vs synced-but-uncarried tip, both before serialization so neither writes a save request"
affects: [63-brush-tip-pipeline, v2.2.0]

actuals:
  tokens: 4358
  tasks: 2
  commits: 4
  plan_head_before: 2a3e270b5ee286b815283959578dd95f135d1c21
  plan_head_after: b9031029c

tech-stack:
  added: []
  patterns:
    - "A realm-local delivery flag distinguishes known-empty from unknown state; the writer is the single apply path and no reset clears it"
    - "Degradation vs refusal split by observed availability: only an id the open itself marked unavailable may skip per entry, so one degraded tip never disables the feature"
    - "A persisted capture is checked against its carrier before serialization: every painted custom id must have an entry, and both gap causes are reported by name"

key-files:
  created: []
  modified:
    - app/src/stores/aquarelleBrushCatalog.ts
    - app/src/stores/aquarelleBrushCatalog.test.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.test.ts

key-decisions:
  - "`brushCatalogSynced` flips true inside `applyBrushCatalogPayload`'s existing batch with a compare guard, and `resetAquarelleBrushCatalog` deliberately leaves it true: after a close the catalog is empty-but-known, not un-delivered"
  - "`unavailableTipIds` (the per-open replace-only set) is the sole discriminator for the per-entry skip: only an id the open already reported may degrade silently; an unmarked missing body still refuses with the established `no stored mask bytes` reason because that is the push-never-arrived case"
  - "`referencedCustomBrushIds` reads `engine.brushId` (the tip id), never the top-level `brushId`, which `serializeAquarelleRotoScript` stamps with `ROTO_SCRIPT_ENGINE_ID_AQUARELLE`; dry events carry no brush id"
  - "The refusal wording splits on `brushCatalogSynced`: an unsynced realm names the missing project catalog, a synced realm names the first uncarried id and both possible causes (unavailable or loaded from another script)"
  - "Both refusals run before `serializeAquarelleRotoScript`/`execute`, so a refused save writes no save request — pinned in every refusal test rather than assumed"

patterns-established:
  - "Per-entry degradation is keyed to a fact the open already established, so a save never attributes a missing mask to the wrong cause"
  - "A capture's referenced ids are validated against the carrier it is about to be written with, closing the silent-omission class rather than one known instance"

requirements-completed: [TIP-07, TIP-14]

coverage:
  - id: D1
    description: "A tip the open reported unavailable is skipped per entry with one log naming it, while every healthy custom entry still travels and the save succeeds (WR-02)"
    requirement: TIP-14
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.test.ts#save leg: an unavailable tip is skipped with a log instead of refusing the whole save (WR-02)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A healthy tip with no stored bytes in this realm still refuses with the established `no stored mask bytes` reason, so the degenerate feature outage is narrowed, not removed"
    requirement: TIP-14
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.test.ts#save leg: refuses when a custom tip has no stored bytes in this realm"
        status: pass
    human_judgment: false
  - id: D3
    description: "On a fresh Studio realm (no catalog ever applied), a capture painting `wc/custom-*` refuses before serialization: the status names the missing brush catalog and the id, and no save request is written (WR-03)"
    requirement: TIP-07
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.test.ts#save leg: refuses a custom-brush capture when this realm never received a catalog (WR-03)"
        status: pass
    human_judgment: false
  - id: D4
    description: "A synced catalog that does not carry a painted custom id refuses by name, with no save request written — the second cause of a silent mask gap is closed too (WR-03)"
    requirement: TIP-07
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.test.ts#save leg: refuses by name when a painted custom tip is not in the synced catalog (WR-03)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.test.ts#save leg: each custom tip mask travels as an inline data URL read from the Studio realm cache"
        status: pass
    human_judgment: false
  - id: D5
    description: "The sync flag reads false on a fresh module instance and true after ANY payload including an empty one; a repeated payload moves neither the flag nor the generation, and a catalog reset never clears it"
    requirement: TIP-07
    verification:
      - kind: unit
        ref: "app/src/stores/aquarelleBrushCatalog.test.ts#records that a catalog payload arrived: false on a fresh instance, true after any payload (WR-03)"
        status: pass
      - kind: unit
        ref: "app/src/stores/aquarelleBrushCatalog.test.ts#a repeated payload leaves the flag true and bumps no catalog generation for it (WR-03)"
        status: pass
      - kind: unit
        ref: "app/src/stores/aquarelleBrushCatalog.test.ts#a catalog reset never clears the flag behind a delivered empty snapshot (WR-03)"
        status: pass
    human_judgment: false

duration: 29min
completed: 2026-11-15
status: complete
---

# Phase 63 Plan 11: Gap Closure WR-02 / WR-03 Summary

**One degraded tip no longer disables script saves, and a script can no longer be saved while a painted custom mask is silently absent (WR-02, WR-03)**

## Performance

- **Duration:** 29 min
- **Started:** 2026-11-15T15:14:20Z
- **Completed:** 2026-11-15T15:44:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- **WR-02 closed:** `buildScriptBrushEntries` now consults the per-open `unavailableTipIds` set. A tip the open itself reported unavailable is skipped into `unavailableSkipped` and logged once by id from `saveActiveFrame`; every healthy custom entry still travels. The previous behavior — one unavailable tip refusing the whole save — is gone. A healthy tip whose body is missing for any other reason still refuses with the established `no stored mask bytes` reason, so the refusal now means what it says.
- **WR-03 closed:** `brushCatalogSynced` records that THIS realm instance applied a catalog payload. `saveActiveFrame` computes `referencedCustomBrushIds(scriptSnapshot.aquarelleEvents)` — the unique, first-seen `engine.brushId` values starting with `wc/custom-` — and refuses before serialization when any referenced id has no carried entry. On an unsynced realm the message names the missing project brush catalog and the first id; on a synced but uncarried id it names the tip and both causes (unavailable or loaded from another script). No refusal writes a save request.
- **Ambiguity removed:** an empty `customBrushTips` now has a second observable (the flag), so the Studio can distinguish "the project imported nothing" from "the push never arrived". The flag is set inside the existing `applyBrushCatalogPayload` batch with a compare guard (a repeated payload moves nothing) and is deliberately not cleared by `resetAquarelleBrushCatalog`.
- **Plan verification:** `pnpm --filter @efxlab/efx-watercolor build && pnpm --filter efx-motion-editor exec vitest run src/stores/aquarelleBrushCatalog.test.ts src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.test.ts` → 2 files, 78 passed. `pnpm --filter efx-motion-editor run typecheck` clean.
- **Threat mitigations applied and pinned:** T-63-28 (a capture's referenced custom ids are checked against the carried entries; an unsynced realm is named as such, never reported as a successful empty carrier) and T-63-29 (unavailable ids skip per entry and log; only a believed-healthy tip may refuse). T-63-SC holds: no dependency change.

## Task Commits

Each task was committed atomically, TDD test-then-feat:

1. **Task 1: Catalog sync flag — the Studio realm records a payload it applied** — `662e6dc7c` (test) → `e0b83168f` (feat)
2. **Task 2: Save law — refuse exactly the masks that cannot travel** — `3aa4d8849` (test) → `b9031029c` (feat)

_Note: TDD tasks may have multiple commits (test → feat → refactor). Both tasks followed the observed RED→GREEN order recorded above._

## Files Created/Modified

- `app/src/stores/aquarelleBrushCatalog.ts` — `brushCatalogSyncedSignal` (initialised false), the `brushCatalogSynced` readonly export, and the compare-guarded flip inside `applyBrushCatalogPayload`'s existing batch with the known-empty/unknown doctrine in comments
- `app/src/stores/aquarelleBrushCatalog.test.ts` — the three WR-03 flag pins (fresh instance false → any payload true, repeated payload no-op, reset never clears)
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts` — import of `brushCatalogSynced`/`unavailableTipIds` and `isAquarelleDryEvent`/`AquarellePayloadEvent`; `unavailableSkipped` on the success variant of `ScriptBrushEntryBuild`; the per-entry unavailable skip in `buildScriptBrushEntries`; the exported `referencedCustomBrushIds`; the log-then-refuse block in `saveActiveFrame`
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.test.ts` — `captureWithEngineBrushId` local helper (replaces only the non-dry events' `engine.brushId`), the three new save-law pins, and the value import of `isAquarelleDryEvent`

## Decisions Made

- **Flag placement and lifetime:** `brushCatalogSynced` flips inside `applyBrushCatalogPayload`'s existing `batch` behind a compare, so a repeated payload writes no state and bumps no generation. `resetAquarelleBrushCatalog` leaves it true — after a close the catalog is empty-but-known, which is exactly what a post-close save needs.
- **Only observed unavailability degrades:** the skip keys on `unavailableTipIds`, the per-open replace-only set the open itself populated. That keeps the `no stored mask bytes` refusal honest for the case it was written for (the push never arrived) while removing the feature-wide outage.
- **`engine.brushId` is the tip id:** the top-level `brushId` is stamped with the engine id by the serializer, so the referenced-id walk reads the engine payload; dry events are skipped through the package's own `isAquarelleDryEvent` guard.
- **Both refusal causes named:** the `brushCatalogSynced` split ensures a user is never told "unavailable" when the real cause is a catalog that never arrived, and vice versa.
- **Painted-but-uncarried entries carry:** a catalog tip that is present and healthy but not painted is still carried, preserving the existing carrier behavior; the new law only constrains what the capture references.

## Deviations from Plan

None - plan executed exactly as written.

## TDD Gate Compliance

Plan frontmatter is `type: execute`; both tasks carry `tdd="true"`.

- **Task 1:** genuine RED→GREEN. The three flag pins were committed as `662e6dc7c` after `gsd_run check tdd-red-evidence` returned `RED_EVIDENCE_OK` against `63-11-red-evidence-task1.json` (exit 1, 27 pass / 3 fail, target assertion at `:535` expected `undefined` to be `false`). Implementation followed as `e0b83168f`; the same file then reported 30/30.
- **Task 2:** genuine RED→GREEN. The three save-law pins were committed as `3aa4d8849` after `RED_EVIDENCE_OK` against `63-11-red-evidence-task2.json` (exit 1, 3 fails — the unavailable-skip save resolved false where true was expected, and both WR-03 captures saved where they had to refuse — while every pre-existing carrier pin stayed green). Implementation followed as `b9031029c`; both target files then reported 78/78.

The RED runs used `pnpm --silent` so pnpm's recursive-exec failure banner never contaminates the TAP report; the silent form's stdout was captured verbatim into the evidence record.

## Issues Encountered

- The first Task 1 RED evidence capture was rejected as `INVALID_RED`/`invalid_record` (`Non-TAP data in report`, `Malformed TAP`) because pnpm appends its `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL` banner to stdout on exit 1. Re-running the same planned command with `pnpm --silent` produced clean TAP; the record was regenerated from that output rather than edited, and validation returned `RED_EVIDENCE_OK`.
- No other issues; the plan verification and typecheck were green on the first full run.

## User Setup Required

None - no external service configuration required.

## Threat Flags

None - no new surface. T-63-28 mitigated and pinned (referenced-id check plus named unsynced/uncarried refusals), T-63-29 mitigated and pinned (per-entry unavailable skip with one log), T-63-SC holds (no dependency change).

## Next Phase Readiness

- A future save-leg producer should keep the two invariants this plan installed: every painted `wc/custom-*` id must have a carried entry, and a skipped unavailable id is logged exactly once rather than folded into a refusal.
- The catalog now exposes the delivery fact any Studio-side reader can consult; no reset path clears it.
- Remaining phase-63 gap-closure plans can proceed on the unchanged carrier schema (`brushPack.entries` with inline `maskDataUrl`, no `asset`).

---

*Phase: 63-brush-tip-pipeline*
*Completed: 2026-11-15*

## Self-Check: PASSED

- All four modified files and this SUMMARY exist on disk.
- Commits `662e6dc7c`, `e0b83168f`, `3aa4d8849` and `b9031029c` are ancestors of HEAD.
