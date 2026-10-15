---
phase: 55-efx-paint-host-engine-1-host-split
plan: 05
subsystem: packages
tags: [StudioScriptEnvelope, engineId, clean-break, refusal, DATA-01, D-13, D-14, D-15, D-16, field-mapping]

# Dependency graph
requires:
  - phase: 55-efx-paint-host-engine-1-host-split (55-03)
    provides: StudioScriptEnvelope<P> / parseStudioScriptEnvelope / EngineId contracts
  - phase: 55-efx-paint-host-engine-1-host-split (55-04)
    provides: HOST_TICK_HZ integer tick grid + uncapped cuisson mechanism
provides:
  - "Typed host refusal codes + classifyEnvelopeParseFailure in packages/efx-paint-host/src/script/refusal.ts"
  - "Engine-1 payload codec on StudioScriptEnvelope (serialize/parse) with pinned field mapping in physicsPaintRotoScriptSchema.ts"
  - "D-16 refused-row surface on physicsPaintRotoScriptLibrary.ts (rows/selected, load blocked, delete stays)"
  - "Durable Rust path accepts the envelope and emits legacy refused rows"
affects: [55-06, 55-07, 55-08, 56-efx-watercolor]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 19912
  tasks: 2
  commits: 3
  plan_head_before: 9b2c73bdc4f6b1caa66217665ea3493662838ea2
  plan_head_after: ce8d63acaca318bc526b482905cfb4f3303e262a

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ONE saved script shape: StudioScriptEnvelope + engineId 'efx-physic-paint'; PersistedRotoScriptV1 is that envelope (engine-1 source keeps background display-hint)"
    - "Clean-break refusal: legacy kind recognized ONLY by the host classifier; parse never returns a script for it (no dual-format reader)"
    - "Host codes / Studio names split preserved: refusal.ts carries codes + optional detail, never a user-facing sentence (D-09)"

key-files:
  created:
    - packages/efx-paint-host/src/script/refusal.ts
    - packages/efx-paint-host/src/script/refusal.test.ts
  modified:
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.test.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.test.ts
    - packages/efx-paint-host/src/script/parse.ts
    - packages/efx-paint-host/src/script/index.ts
    - packages/efx-paint-host/src/index.ts
    - packages/efx-paint-host/src/util/traceSeed.ts
    - app/src-tauri/src/services/script_library.rs

key-decisions:
  - "PersistedRotoScriptV1 IS StudioScriptEnvelope<PhysicStrokePayload> (Omit source) — one saved shape, not a second document type"
  - "brushPack pinned as { kind: 'efx-physic-paint', entries: [] } — uses the landed 55-03 BrushPackSnapshot field name `entries` (plan prose said `brushes`)"
  - "hashMutationId accepts number | string | undefined so serialize can seed hashMutationId(mutationId ?? String(strokeIndex)) via the host util (D-25)"
  - "Rust durable path updated in the same plan (Rule 2) — without it the envelope cutover would break save/load against SCRIPT_KIND"

patterns-established:
  - "Envelope codec law: serialize flattens brushes[{primary,continuations}] → strokes[]; parse reconstructs groups by cuisson > 0 = continuation"

requirements-completed: [HOST-01, DATA-01]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "Typed host refusal codes (unknown-engine-id / malformed-engine-payload / engine-mismatch / unreadable-legacy-script) + classifyEnvelopeParseFailure, UI-free"
    requirement: "DATA-01"
    verification:
      - kind: unit
        ref: "packages/efx-paint-host/src/script/refusal.test.ts#./refusal must export classifyEnvelopeParseFailure"
        status: pass
      - kind: unit
        ref: "packages/efx-paint-host/src/script/refusal.test.ts#classifyEnvelopeParseFailure maps a legacy-kind object to unreadable-legacy-script"
        status: pass
      - kind: unit
        ref: "packages/efx-paint-host/src/script/refusal.test.ts#classifyEnvelopeParseFailure maps an unknown engineId to unknown-engine-id"
        status: pass
      - kind: unit
        ref: "packages/efx-paint-host/src/script/refusal.test.ts#HostScriptRefusal carries code + optional detail and no user-facing English sentence field"
        status: pass
    human_judgment: false
  - id: D2
    description: "Engine-1 codec on StudioScriptEnvelope + engineId with the full shared-field mapping pinned on disk (HOST-02 / DATA-03)"
    requirement: "HOST-01"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.test.ts#serialize emits kind efx-studio-paint-script with engineId efx-physic-paint and an opaque engine slot"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.test.ts#FIELD-MAPPING: integer tick projection — 3-point stroke has pts tick 0/1/2, ticks 2, and no raw-ms shared timing field"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.test.ts#FIELD-MAPPING: cuisson vs engine diffusionFrames — 30 → 30, over-cap → engine ceiling, absent → 0"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.test.ts#FIELD-MAPPING: strokes[] reconstruction — group(primary,[cont]) flattens and parse rebuilds the same group"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.test.ts#FIELD-MAPPING: brushPack is the pinned empty snapshot and parse round-trips it"
        status: pass
    human_judgment: false
  - id: D3
    description: "Clean-break refusal: legacy kind parses to 'unreadable-legacy-script' and never a script; no alternate reader"
    requirement: "DATA-01"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.test.ts#parse of a legacy-kind fixture returns the clean-break refusal and never a script"
        status: pass
      - kind: other
        ref: "rg \"efx-physics-paint-roto-script\" app/src packages/efx-paint-host/src → only refusal classifier + tests (no reader branch)"
        status: pass
    human_judgment: false
  - id: D4
    description: "D-16 refused library rows stay listed with the clean-break code; load blocked, delete remains the user's action"
    requirement: "DATA-01"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.test.ts#keeps a clean-break script listed as a refused row (unreadable-legacy-script) that cannot load but can delete"
        status: pass
      - kind: unit
        ref: "app/src-tauri/tests/script_library_schema.rs#legacy_scripts_stay_visible_as_refused_rows"
        status: pass
    human_judgment: false

# Metrics
duration: 19min
completed: 2026-10-15
status: complete
---

# Phase 55 Plan 05: Engine-1 Codec on StudioScriptEnvelope + Clean-Break Refusal Summary

**StudioScriptEnvelope + engineId is the one saved script shape, every shared field populated on disk, legacy scripts refuse with 'unreadable-legacy-script' and stay visible as refused rows (DATA-01 / D-13..D-16)**

## Performance

- **Duration:** 19 min
- **Started:** 2026-10-15T06:56:27Z
- **Completed:** 2026-10-15T07:16:01Z
- **Tasks:** 2
- **Files modified:** 17

## Accomplishments
- Host `refusal.ts` yields typed `HostScriptRefusalCode` + `classifyEnvelopeParseFailure` with NO user-facing wording (D-09 split preserved; naming lands in 55-06)
- On-disk shape cut over to `StudioScriptEnvelope` + `engineId: 'efx-physic-paint'`; `PersistedRotoScriptV1` IS that envelope (engine-1 payload rides the opaque `engine` slot)
- Full field-mapping contract pinned on disk: integer `pts[].tick` 0/1/2 + `ticks`, `cuisson` vs engine `diffusionFrames` (engine cap 600 = policy), strokes[] flatten/reconstruct, pinned empty brushPack
- Clean-break refusal: legacy kind `efx-physics-paint-roto-script` parses to `unreadable-legacy-script` and never a script — no migration, no dual-format reader
- D-16 refused rows stay listed on the existing `rows`/`selected` surface; load blocked, delete remains the user's explicit action
- Durable Rust path accepts the envelope and emits legacy refused rows (Rule 2 — required for save/scan after the cutover)
- 55-01 golden pin (6 tests), 55-09 residue pin (5 tests), and host suite (59 tests) remain green

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED | `447b1244` test(55-05): add failing test for clean-break refusal + engine-1 codec contract | RED_EVIDENCE_OK |
| GREEN | `6a694026` feat(55-05): implement envelope cutover + clean-break refusal + refused library rows | 20/20 pass |
| REFACTOR | — | Not needed |

**RED evidence:** 20 tests failed on `./refusal must export classifyEnvelopeParseFailure: expected undefined to be type of 'function'` and `schema must export serializeRotoScript: expected undefined to be type of 'function'` (named missing-export assertions). 0 TypeError, 0 syntax/load errors. Classifier verdict: `RED_EVIDENCE_OK` (`target_test_failed`). Record at `.planning/phases/55-efx-paint-host-engine-1-host-split/55-05-red-evidence.json`.

**Semantic assessment:** Target tests executed and failed on the planned assertions — `classifyEnvelopeParseFailure` / `serializeRotoScript` / `parseRotoScript` are undefined because `./refusal` and the codec exports do not exist yet. All 20 failing tests name the missing export. Not a syntax error, not a collection error, not a fixture crash.

## Task Commits

Each task was committed atomically:

1. **Task 1: RED: clean-break refusal + engine-1 codec contract** - `447b1244` (test)
2. **Task 2: GREEN: envelope cutover + clean-break + refused library rows** - `6a694026` (feat)
3. **Rule 2 follow-up: durable Rust path + legacy refused rows** - `ce8d63ac` (fix)

**Plan metadata:** pending (docs: complete plan)

_Note: TDD tasks follow the RED → GREEN commit-scope contract._

## Files Created/Modified
- `packages/efx-paint-host/src/script/refusal.ts` - Typed HostScriptRefusalCode / HostScriptRefusal / classifyEnvelopeParseFailure (UI-free)
- `packages/efx-paint-host/src/script/refusal.test.ts` - RED/GREEN coverage for the four refusal codes + UI-free shape
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts` - Engine-1 serialize/parse on StudioScriptEnvelope with the pinned field mapping
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.test.ts` - Field-mapping cases + clean-break refusal pin
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts` - D-16 refused-row surface on rows/selected
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.test.ts` - Refused-row stays listed / load blocked / delete allowed
- `packages/efx-paint-host/src/script/parse.ts` - DTS-safe casts through unknown
- `packages/efx-paint-host/src/util/traceSeed.ts` - hashMutationId accepts string keys
- `app/src-tauri/src/services/script_library.rs` - Envelope validation + legacy refused rows on scan

## Decisions Made
- `PersistedRotoScriptV1` is `StudioScriptEnvelope<PhysicStrokePayload>` (source keeps background) — one saved shape, not a second document type
- brushPack pinned as `{ kind: 'efx-physic-paint', entries: [] }` — the landed 55-03 `BrushPackSnapshot` field name is `entries` (plan prose said `brushes`)
- `hashMutationId` extended to `number | string | undefined` so serialize can call `hashMutationId(mutationId ?? String(strokeIndex))` via the host util (D-25)
- Engine-1 `Math.min(600, …)` ceiling stays in the engine codec (D-20); host `time/` remains uncapped

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Durable Rust path accepts the envelope and emits D-16 refused rows**
- **Found during:** Task 2 (GREEN)
- **Issue:** The plan scoped files to the TS codec, but `script_library.rs` hard-requires the legacy kind and `brushes[]`. After the TS cutover every save/scan would reject the new format.
- **Fix:** `validate_document` now requires kind `efx-studio-paint-script` + `engineId` + `brushPack` + flattened `strokes[]`; `scan_root` emits a refused row (`unreadable-legacy-script`) for legacy-kind files instead of skipping them; fixtures updated; `legacy_scripts_stay_visible_as_refused_rows` pin added.
- **Files modified:** `app/src-tauri/src/services/script_library.rs`, `app/src-tauri/tests/script_library_{schema,filesystem,lifecycle,transaction_contract}.rs`
- **Verification:** `cargo test --features script-library-test-support` — schema 5/5, lifecycle 2/2, transaction 21/21, command 4/4
- **Committed in:** `ce8d63ac`

**2. [Rule 3 - Blocking] parse.ts DTS cast errors blocked the host rebuild**
- **Found during:** Task 2 (GREEN)
- **Issue:** TS 5.9 rejects `Record<string, unknown> as StudioScriptSource` after `isRecord` narrowing; `pnpm --filter efx-paint-host run build` failed on DTS emit.
- **Fix:** Cast through `unknown` (`as unknown as T`).
- **Files modified:** `packages/efx-paint-host/src/script/parse.ts`
- **Verification:** host build + `tsc --noEmit` exit 0
- **Committed in:** `6a694026`

**3. [Rule 1 - Bug] brushPack field name and hashMutationId signature vs plan prose**
- **Found during:** Task 2 (GREEN)
- **Issue:** Plan prose said `{ kind: 'efx-physic-paint', brushes: [] }` and `hashMutationId(mutationId ?? String(strokeIndex))`; landed 55-03 `BrushPackSnapshot` uses `entries`, and `hashMutationId` accepted only `number | undefined`.
- **Fix:** Pinned `{ kind, entries: [] }` to the landed type; widened `hashMutationId` to `number | string | undefined`.
- **Files modified:** `packages/efx-paint-host/src/util/traceSeed.ts`, `app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts`
- **Verification:** field-mapping brushPack case + host suite green
- **Committed in:** `6a694026`

---

**Total deviations:** 3 auto-fixed (1 missing critical, 1 blocking, 1 bug)
**Impact on plan:** All required for the cutover to be correct end-to-end. No scope creep beyond the durable path the cutover itself broke.

## Issues Encountered
- Plan verify filter `refusal.test.ts` also collects `physicsPaintRotoScriptApplyRefusal.test.ts` (substring match) — harmless, those 9 tests pass. Target files are `packages/efx-paint-host/src/script/refusal.test.ts` and `physicsPaintRotoScriptSchema.test.ts`.
- Pre-existing Rust failure `capability_split_denies_standalone_filesystem_authority` (`dialog:allow-open` in `capabilities/physics-paint.json` from 49-04) — out of scope; recorded in `deferred-items.md`.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Host refusal codes are live for 55-06 to name on the owned-refusal surface (D-09/D-11)
- One saved shape on disk; Phase 56 engines add an `engineId` + payload codec, not a second format
- Ready for 55-06

---
*Phase: 55-efx-paint-host-engine-1-host-split*
*Completed: 2026-10-15*

## Self-Check: PASSED

- Created files exist: `packages/efx-paint-host/src/script/refusal.ts`, `refusal.test.ts`, `55-05-SUMMARY.md`
- Commits exist on HEAD: `447b1244` (RED), `6a694026` (GREEN), `ce8d63ac` (Rule 2 Rust)
- TDD gates present: `test(55-05):` and `feat(55-05):` in git log
- refusal 6/6 + schema 14/14 green; typecheck exit 0; host 59/59; golden 6/6; residue 5/5
- `rg "efx-physics-paint-roto-script" app/src packages/efx-paint-host/src` → refusal classifier + tests only (no reader branch)
