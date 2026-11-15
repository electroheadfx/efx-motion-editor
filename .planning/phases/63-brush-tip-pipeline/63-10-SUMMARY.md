---
phase: 63-brush-tip-pipeline
plan: 10
subsystem: paint
tags: [preact-signals, brush-tips, catalog-snapshot, wire-guards, base64, tdd]

requires:
  - phase: 63-brush-tip-pipeline
    provides: "63-07's open-leg loader and apply ordering, 63-05/63-07's cross-realm catalog snapshot channel, and 63-04's package carrier law (isTipRecord/asTipRecord plus buildBrushPackSnapshot)"
provides:
  - "One project-tip admission law, `normalizeProjectBrushTip`, applied by BOTH catalog producers: built-in-id refusal plus wire projection with `category` pinned to `'custom'`"
  - "A total base64 decode at the brush wire guards' own boundary: a non-canonical member is refused (false), never thrown"
  - "Per-entry brush-pack preservation on save: one invalid entry or duplicate id costs exactly that tip, logged by id; the pack is omitted only when nothing survives"
  - "A named `builtin-id` failure class in the open loader, so a project entry naming a shipped tip is refused by reason and never listed"
affects: [63-brush-tip-pipeline, v2.2.0]

actuals:
  tokens: 5514
  tasks: 3
  commits: 5
  plan_head_before: d0b9259278cafda2327c6f142c5f734140f06e91
  plan_head_after: 0a35c538e47f1ebf60578885a5acc9144170bba8

tech-stack:
  added: []
  patterns:
    - "One admission law, two producers: the open loader and the Studio payload producer call the same normalizer, and the strict wire guard is never relaxed — the senders conform instead"
    - "Per-entry degradation with logged drops: a refused record costs exactly one tip and is logged by id with its class (invalid record / duplicate id)"
    - "Guard totality lives at the guard boundary, not in the low-level converter: the wire guards own the never-throws contract and the base64 converter keeps its throwing contract"

key-files:
  created: []
  modified:
    - app/src/lib/efxPaintBrushSet.ts
    - app/src/stores/aquarelleBrushCatalog.ts
    - app/src/types/physicPaint.ts
    - app/src/stores/aquarelleBrushCatalog.test.ts
    - app/src/lib/physicPaintBridge.test.ts

key-decisions:
  - "`normalizeProjectBrushTip` lives in `efxPaintBrushSet.ts` and is imported by `aquarelleBrushCatalog.ts` as a value; there is no import cycle because the loader imports only `./ipc`, `./efxPaintBrushAssets`, leaf types and `@efxlab/efx-watercolor`"
  - "The built-in refusal reads the RAW id BEFORE record validation: a malformed record still logs `invalid-entry`, while a well-formed entry naming a shipped tip logs the named reason `builtin-id`"
  - "`isCustomTipWire` and `AQUARELLE_TIP_MEMBER_KEYS` are byte-for-byte unchanged — normalization happens upstream in the producers, so the strict law stands and the duplicate refusal pins stay untouched"
  - "`buildProjectBrushPack` keeps the whole-list fast path: the per-entry walk runs only when `buildBrushPackSnapshot` refuses the list, and the first survivor supplies the snapshot kind"
  - "Task 2's totality pins are green by construction on the current tree: `decodeBase64OrNull` already resolves to `physicPaint.ts`'s own total `base64ToBytes` (try/catch → null), not to `webpBytes.ts`'s throwing converter; the review's 'unguarded atob' premise is refuted on this tree, and the guard-boundary try/catch was applied as the plan's literal hardening without fabricating a RED"
  - "`app/src/lib/efxPaintBrushSet.test.ts` is listed in the plan frontmatter but needed no edit: the normalizer is transparent for every valid entry, so the existing loader pins stayed green unchanged and the new regression pins live beside the producers they cover"

patterns-established:
  - "A cross-realm sender projects onto the wire member set before emitting, so a producer can never hand the receiving guard a shape it refuses whole"
  - "A save-time validation failure degrades one entry, logs the dropped id and its class, and never erases the rest of the pack"

requirements-completed: [TIP-11, TIP-12, TIP-15, TIP-16, TIP-17]

coverage:
  - id: D1
    description: "A project tip the open accepted — stray member or foreign category included — reaches the Studio catalog as a wire-valid `custom` entry instead of refusing the snapshot whole (CR-01)"
    requirement: TIP-15
    verification:
      - kind: unit
        ref: "app/src/stores/aquarelleBrushCatalog.test.ts#normalizes a stray-member tip with a foreign category into a wire-valid custom entry"
        status: pass
      - kind: unit
        ref: "app/src/stores/aquarelleBrushCatalog.test.ts#pins a foreign-category-only tip to custom so it still reaches the Studio"
        status: pass
    human_judgment: false
  - id: D2
    description: "A project entry naming any of the three built-in ids is refused at the open with reason `builtin-id`, absent from the listed entries and the payload, while a valid custom sibling still reaches the Studio and each built-in is listed exactly once"
    requirement: TIP-12
    verification:
      - kind: unit
        ref: "app/src/stores/aquarelleBrushCatalog.test.ts#refuses a built-in id at the open by name and never re-emits it"
        status: pass
    human_judgment: false
  - id: D3
    description: "The catalog and import wire guards refuse non-canonical base64 without throwing at every position they own (WR-01)"
    requirement: TIP-16
    verification:
      - kind: unit
        ref: "app/src/lib/physicPaintBridge.test.ts#refuses non-canonical base64 without throwing (WR-01)"
        status: pass
    human_judgment: false
  - id: D4
    description: "A save keeps every valid custom tip when one entry fails the carrier law or duplicates an id; the pack is omitted only when nothing valid remains (WR-07)"
    requirement: TIP-11
    verification:
      - kind: unit
        ref: "app/src/stores/aquarelleBrushCatalog.test.ts#keeps every valid tip when one entry fails the carrier law, logging the dropped id (WR-07)"
        status: pass
      - kind: unit
        ref: "app/src/stores/aquarelleBrushCatalog.test.ts#keeps the first entry of a duplicate id and logs the duplicate (WR-07)"
        status: pass
      - kind: unit
        ref: "app/src/stores/aquarelleBrushCatalog.test.ts#returns null instead of emitting a pack whose entry fails the carrier law"
        status: pass
    human_judgment: false
  - id: D5
    description: "The open still REPLACES the catalog and registry with one project's accepted entries plus the three built-ins, publishes one snapshot per applied open, and resets to exactly the built-ins on close (TIP-17 / TIP-12 ordering unchanged)"
    requirement: TIP-17
    verification:
      - kind: unit
        ref: "app/src/stores/aquarelleBrushCatalog.test.ts#replaces customs, registry and unavailable set from ONE open and marks its assets written"
        status: pass
      - kind: unit
        ref: "app/src/stores/aquarelleBrushCatalog.test.ts#opening B replaces open A: only B is listed, resolvable and remembered"
        status: pass
      - kind: unit
        ref: "app/src/stores/aquarelleBrushCatalog.test.ts#close resets to exactly the three built-ins and empties the asset cache"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-11-15
status: complete
---

# Phase 63 Plan 10: Gap Closure CR-01 / WR-01 / WR-07 Summary

**One project-tip normalization law across both catalog producers, total base64 wire guards, and per-entry brush-pack preservation on save (CR-01, WR-01, WR-07)**

## Performance

- **Duration:** 6 min
- **Started:** 2026-11-15T15:16:19Z
- **Completed:** 2026-11-15T15:22:20Z
- **Tasks:** 3
- **Files modified:** 5 (plan frontmatter listed 6; `efxPaintBrushSet.test.ts` needed no change)

## Accomplishments

- **CR-01 closed:** `normalizeProjectBrushTip` is exported from `efxPaintBrushSet.ts` and called by BOTH producers — every branch of `tipFromRaw` and every tip `buildBrushCatalogPayload` emits. It refuses any of the three built-in ids and projects the record onto exactly the wire member set with `category: 'custom'`, so a tip the package carrier accepted (stray member, foreign category) can no longer refuse the Studio snapshot whole. The strict `isCustomTipWire` is untouched: the senders became conforming, never the guard.
- **Built-in shadowing impossible:** `loadProjectBrushSet` reads the raw id before validating the record and refuses a shipped id with the new named reason `builtin-id`; the payload producer drops the same id again through the shared normalizer. The regression pin proves the built-in is absent from `set.entries` / `set.masks` / `payload.entries`, the read port is asked only for the custom sibling, and `listAquarelleBrushTips()` lists each built-in exactly once.
- **WR-01 closed at the guard boundary:** `decodeBase64OrNull` in `types/physicPaint.ts` now wraps its decode in try/catch returning `null`; `base64ToBytes` in `webpBytes.ts` keeps its throwing contract for direct callers. The totality pin feeds `!!!!` into the catalog mask, catalog WebP and import mask positions and asserts refusal inside `expect(() => ...).not.toThrow()` for each.
- **WR-07 closed:** `buildProjectBrushPack` keeps the whole-list fast path and, on refusal, walks the customs one at a time in insertion order — each dropped tip is logged by id and class (invalid record / duplicate id), the first entry of a duplicate id wins, and `null` is returned only when nothing survives (the key is then omitted as before).
- **Plan verification:** `pnpm --filter @efxlab/efx-watercolor build && pnpm --filter efx-motion-editor exec vitest run src/stores/aquarelleBrushCatalog.test.ts src/lib/efxPaintBrushSet.test.ts src/lib/physicPaintBridge.test.ts` → 3 files, 210 passed | 1 skipped. `pnpm run typecheck` in `app/` clean. `webpBytes.ts` is absent from the plan diff, so the low-level converter's contract is provably untouched.

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end — a project tip the open accepted reaches the Studio catalog** — `3418138cf` (feat)
2. **Task 2: WR-01 — the wire guards refuse malformed base64 without throwing** — `0681b0173` (test pins) → `8b564b4cc` (feat hardening)
3. **Task 3: WR-07 — one bad tip no longer erases the project brush pack** — `024583e17` (failing test pins) → `0a35c538e` (feat)

_Note: TDD tasks may have multiple commits (test → feat → refactor). See `## TDD Gate Compliance` for the observed order and the Task 2 green-by-construction record._

## Files Created/Modified

- `app/src/lib/efxPaintBrushSet.ts` — `normalizeProjectBrushTip` (built-in refusal + wire projection + `custom` pin), the raw-id refusal ahead of record validation, the widened `ProjectBrushSetFailureReason` with `builtin-id`, and the ONE NORMALIZATION LAW / failure-vocabulary header documentation
- `app/src/stores/aquarelleBrushCatalog.ts` — `buildBrushCatalogPayload` now maps every custom tip through the shared normalizer and drops a null result; `buildProjectBrushPack` gains the per-entry fallback with logged drops
- `app/src/types/physicPaint.ts` — a total `decodeBase64OrNull` at the guard boundary (11 insertions, 1 deletion; only that helper changed)
- `app/src/stores/aquarelleBrushCatalog.test.ts` — the `the one project-tip normalization law (CR-01 / TIP-15 / T-63-25)` describe with three regression pins (stray member, foreign category only, built-in refusal) plus the two WR-07 pack-preservation pins
- `app/src/lib/physicPaintBridge.test.ts` — the `refuses non-canonical base64 without throwing (WR-01)` totality pin in the existing catalog payload guard describe; every pre-existing malformed-shape pin untouched

## Decisions Made

- **Normalizer placement and direction:** the helper lives in `efxPaintBrushSet.ts` because that module already owns the open's admission law; `aquarelleBrushCatalog.ts` imports it as a value. No cycle exists — the loader imports only `./ipc`, `./efxPaintBrushAssets`, leaf types and `@efxlab/efx-watercolor`.
- **Built-in refusal before validation:** deriving the id with `readTipId` first means a malformed record still logs `invalid-entry` (its id is `<malformed>`), while a well-formed entry naming one of the three shipped tips logs the precise reason `builtin-id`. This keeps the failure vocabulary honest rather than reporting every refusal as `invalid-entry`.
- **Strict guard untouched:** `isCustomTipWire` and `AQUARELLE_TIP_MEMBER_KEYS` are byte-for-byte unchanged. The plan prohibition ("never relax the strict law") is satisfied by projecting at the producers; the existing refusal pins were not edited.
- **Pack fast path preserved:** the per-entry walk is a fallback, not a replacement. A healthy catalog takes exactly the old code path (TIP-16 byte-identical save for untouched projects), and only the formerly silent failure branch changes.
- **Task 2 has no fabricated RED:** the totality pins passed before any implementation on this tree because `decodeBase64OrNull` already resolved to `physicPaint.ts`'s own total `base64ToBytes`; the plan's literal hardening (try/catch at the guard boundary) was still applied. Details in `## TDD Gate Compliance` and `## Issues Encountered`.
- **`efxPaintBrushSet.test.ts` untouched:** listed in the plan frontmatter, but the normalizer is transparent for valid entries, so the existing loader pins needed no edit; the new pins live beside the two producers they cover, as the plan's task actions specify.

## Deviations from Plan

None - plan executed exactly as written.

## TDD Gate Compliance

Plan frontmatter is `type: execute`; Tasks 2 and 3 carry `tdd="true"`.

- **Task 3 (WR-07):** genuine RED→GREEN. The failing pins were committed as `024583e17` after `gsd_run check tdd-red-evidence` returned `RED_EVIDENCE_OK` against the record for `keeps every valid tip when one entry fails the carrier law, logging the dropped id (WR-07)` — exit 1, 25 pass / 2 fail on the target file. The implementation followed as `0a35c538e`.
- **Task 2 (WR-01):** the three totality pins came back GREEN in the RED phase — an `unexpected_green`. Per `tdd.md` fail-fast rule 1 the run was investigated before any code change: the guards' `decodeBase64OrNull` already delegates to `physicPaint.ts`'s own total `base64ToBytes` (try/catch → null), not to the throwing converter in `webpBytes.ts`. The review's premise (an unguarded `atob`) is refuted on the current tree. Following the 63-03 / Phase 62 CRV-03 precedent, the pins were committed as `test(63-10)` with that investigation recorded in the commit body, and the plan's literal hardening (try/catch at the guard boundary) followed as a separate `feat(63-10)` commit. No RED was fabricated.

## Issues Encountered

- **WR-01's stated root cause does not exist on the current tree.** The review attributed the throw to `webpBytes.ts`'s `base64ToBytes`, but `physicPaint.ts` imports only `isWebpBytes, isPngBytes, buildFrameBytesToken` from that module and defines its own total decoder. The failure mode is therefore unreachable today; the fix is still correct and defence-in-depth (the guard now owns totality locally instead of trusting a distant helper). The `-t`-filtered RED run exiting 0 was the symptom that exposed this, and the full-file run confirmed it.
- No other issues; the loader, store, typecheck and all three test files were green on the first full plan verification.

## User Setup Required

None - no external service configuration required.

## Threat Flags

None - the plan introduces no new surface. T-63-25 is mitigated and pinned (both producers normalize; stray-member/foreign-category pins), T-63-26 is mitigated and pinned (guard-boundary try/catch plus non-canonical-base64 pins), T-63-27 is mitigated and pinned (per-entry filter with logged drops), and T-63-SC holds: no dependency change.

## Next Phase Readiness

- The catalog channel now has one admission law: any future producer that emits project tips should route through `normalizeProjectBrushTip`, which is the same law the open loader applies.
- The strict wire guard remains the receiving authority and was not weakened; IN-03 (id/name caps) was deliberately not folded in, as the plan records — adding caps to `isCustomTipWire` without a matching open-boundary bound would re-create the CR-01 whole-snapshot refusal.
- Remaining phase-63 gap-closure plans (63-11 onward) can proceed on an unchanged open ordering, pack fast path and cross-realm channel.

---

*Phase: 63-brush-tip-pipeline*
*Completed: 2026-11-15*

## Self-Check: PASSED

- All five modified files and this SUMMARY exist on disk.
- Commits `3418138cf`, `0681b0173`, `8b564b4cc`, `024583e17` and `0a35c538e` are ancestors of HEAD.
