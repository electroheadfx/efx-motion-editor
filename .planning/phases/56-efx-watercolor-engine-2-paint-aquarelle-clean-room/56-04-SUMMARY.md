---
phase: 56-efx-watercolor-engine-2-paint-aquarelle-clean-room
plan: 04
subsystem: engine
tags: [watercolor, aquarelle, brush-pack, tips, import, snapshot, tdd, fail-closed]

# Dependency graph
requires:
  - phase: 56-efx-watercolor-engine-2-paint-aquarelle-clean-room
    plan: 01
    provides: AquarelleTip tracer shape, @efxlab/efx-paint-host BrushPackSnapshot type
provides:
  - 14 categorized base tips (round / flat / texture / experimental) with the flat 8-field per-brush property surface (R1.7 / AQUA-03)
  - importTip(bytes, fileName) — PNG/JPG custom tip import with magic sniff, browser-decoder-only decode, and the named 'unreadable-image' failure
  - buildBrushPackSnapshot / parseBrushPackSnapshot — the serializable kind 'efx-watercolor' carrier for .mce (D-23), total and fail-closed
  - pack.test.ts standing pins (24 cases)
affects: [56-06, 56-07, 56-09]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
# commits: MEASURED via git rev-list --count plan_head_before..HEAD (#3968).
actuals:
  tokens: 10948
  tasks: 2
  commits: 2
plan_head_before: a22859203633678ebf32a6a25f5a6dc5bedb74fa
plan_head_after: d1e411895ebe90d6c7c38d6691720f8d9c9f4ed6

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "AquarelleTip extends AquarelleToolOverrides — the tip record IS the per-brush property surface (8 flat numeric fields), so the brush-pack snapshot entries are plain serializable numbers"
    - "importTip is total: magic-byte sniff (PNG 89 50 4E 47 / JPG FF D8 FF) before any decode, browser decoder only, named 'unreadable-image' failure, never a throw (T-56-10)"
    - "importTip is single-flight via a promise chain — concurrent calls queue, never interleave mid-write (flagged assumption pinned)"
    - "parseBrushPackSnapshot is total and fail-closed: null on malformed shape, wrong kind, or duplicate entry ids — never a silent overwrite (T-56-12)"
    - "Category is a data-model field on every tip (D-07) — never derived from array position; entries round-trip in insertion order"

key-files:
  created:
    - packages/efx-watercolor/src/brushes/pack.ts
    - packages/efx-watercolor/src/brushes/importTip.ts
    - packages/efx-watercolor/src/brushes/pack.test.ts
    - .planning/phases/56-efx-watercolor-engine-2-paint-aquarelle-clean-room/56-04-red-evidence.json
  modified:
    - packages/efx-watercolor/src/brushes/tips.ts
    - packages/efx-watercolor/src/brushes/index.ts
    - packages/efx-watercolor/src/engine/deposit.ts

key-decisions:
  - "AquarelleTip extends AquarelleToolOverrides so the 8 multipliers are FLAT fields on the tip (not nested under a defaults bag) — matches the plan's 'extend AquarelleTip with tip/aspect/rotation/...' wording and keeps snapshot entries as plain serializable numbers; a toolOverridesFromTip(tip) seam projects to the stroke-level shape"
  - "Category union is round | flat | texture | experimental | custom — the 56-01 tracer's 'user' is renamed to 'custom' to match the UI-SPEC Brushes-docker name 'Custom' (D-07); imports land in custom"
  - "Idempotency pinned to NO silent dedupe: importing the same PNG bytes twice yields two tips with distinct wc/custom-<hash8> ids (the hash mixes a monotonic import counter with a content digest) — the plan offered dedupe-by-content-hash as an alternative and left the choice to the executor"
  - "importTip returns Promise<ImportTipResult> (the plan's signature omitted the Promise) — createImageBitmap / Image.decode are inherently async, so the async form is the only correct reading; the discriminated result shape is exactly as planned"
  - "Single-flight is a promise chain, not a mutex: the second call during decode is queued and runs after the first settles (the plan allowed 'queued or rejected', queue chosen so no import is silently dropped)"

patterns-established:
  - "Scalar-predicate assertion style in TAP-parsed test files (boolean/primitive toBe, joined strings instead of toEqual on objects) — vitest's multiline object dumps break the strict-TAP RED evidence classifier"
  - "Tip records are plain frozen objects with a small factory (tip(id, category, name, props)) that spreads NEUTRAL_TOOL_OVERRIDES then overrides — keeps the 14-pack authoring table readable"
  - "Brush-pack entry validation is one isTipRecord type guard shared by build and parse, so the fail-closed surface cannot drift between the two doors"

requirements-completed: [AQUA-03]

# Coverage metadata (#1602) — one entry per shipped deliverable.
coverage:
  - id: D1
    description: "14 categorized base tips (round / flat / texture / experimental) with the flat 8-field per-brush property surface"
    requirement: "AQUA-03"
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/brushes/pack.test.ts#TIPS contains exactly 14 base tips"
        status: pass
      - kind: unit
        ref: "packages/efx-watercolor/src/brushes/pack.test.ts#every base tip carries all 8 property fields as numbers"
        status: pass
      - kind: unit
        ref: "packages/efx-watercolor/src/brushes/pack.test.ts#exposes categories round / flat / texture / experimental in the data model"
        status: pass
    human_judgment: false
  - id: D2
    description: "importTip PNG/JPG custom tip import with magic sniff and the named 'unreadable-image' failure (never a throw)"
    requirement: "AQUA-03"
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/brushes/pack.test.ts#accepts PNG bytes and returns a Custom tip with a fresh wc/custom- id"
        status: pass
      - kind: unit
        ref: "packages/efx-watercolor/src/brushes/pack.test.ts#rejects garbage bytes with the named failure and does not throw"
        status: pass
      - kind: unit
        ref: "packages/efx-watercolor/src/brushes/pack.test.ts#rejects SVG text with the named failure (magic sniff, never a decode)"
        status: pass
      - kind: unit
        ref: "packages/efx-watercolor/src/brushes/pack.test.ts#maps a decoder failure to the named failure (never throws)"
        status: pass
    human_judgment: false
  - id: D3
    description: "importTip idempotency (no silent dedupe) and single-flight concurrency"
    requirement: "AQUA-03"
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/brushes/pack.test.ts#importing the same bytes twice yields two tips with distinct ids (no silent dedupe)"
        status: pass
      - kind: unit
        ref: "packages/efx-watercolor/src/brushes/pack.test.ts#is single-flight: concurrent imports queue and never interleave mid-decode"
        status: pass
    human_judgment: false
  - id: D4
    description: "buildBrushPackSnapshot / parseBrushPackSnapshot — serializable kind 'efx-watercolor' carrier for .mce (D-23), total and fail-closed on duplicate ids"
    requirement: "AQUA-03"
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/brushes/pack.test.ts#buildBrushPackSnapshot returns kind efx-watercolor with entries deep-equal to the tips"
        status: pass
      - kind: unit
        ref: "packages/efx-watercolor/src/brushes/pack.test.ts#parseBrushPackSnapshot round-trips a built snapshot deep-equal"
        status: pass
      - kind: unit
        ref: "packages/efx-watercolor/src/brushes/pack.test.ts#buildBrushPackSnapshot fails closed on duplicate ids (never a silent overwrite)"
        status: pass
      - kind: unit
        ref: "packages/efx-watercolor/src/brushes/pack.test.ts#parseBrushPackSnapshot is total over malformed shapes (null, never a throw)"
        status: pass
    human_judgment: false

# Metrics
duration: 13min
completed: 2026-10-15
status: complete
---

# Phase 56 Plan 04: Aquarelle Brush Pack, Custom Import, and Snapshot Summary

**14 categorized aquarelle tips with a flat 8-field property surface, fail-closed PNG/JPG tip import, and the serializable BrushPackSnapshot carrier for `.mce`**

## Performance

- **Duration:** 13 min
- **Started:** 2026-10-15T22:59:02Z
- **Completed:** 2026-10-15T23:11:58Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- `TIPS` ships exactly 14 base tips across round (4) / flat (3) / texture (4) / experimental (3), each with stable `wc/<category>-<name>` ids and the full 8-field per-brush property surface (R1.7 / AQUA-03)
- `importTip` sniffs PNG/JPG magic before any decode, decodes via the browser decoder only, and returns the named `unreadable-image` failure for garbage, SVG, empty buffers, and corrupt bodies — never a throw (T-56-10)
- `buildBrushPackSnapshot` / `parseBrushPackSnapshot` produce and validate the `kind: 'efx-watercolor'` carrier for the `.mce` brush-pack field (D-23) — total and fail-closed on duplicate entry ids and malformed shapes (T-56-12)
- 24 standing pins in `pack.test.ts` cover the pack, the import contract (including the pinned no-silent-dedupe and single-flight assumptions), and the snapshot round-trip

## Task Commits

Each task was committed atomically:

1. **Task 1: RED: tip pack, import, and snapshot cases** - `d543d77d` (test)
2. **Task 2: GREEN: implement tips.ts + pack.ts + importTip.ts** - `d1e41189` (feat)

**Plan metadata:** (this commit) (docs: complete plan)

_Note: TDD tasks may have multiple commits (test → feat → refactor)_

## TDD Gate Compliance

| Plan | RED | GREEN | REFACTOR | Status |
|------|-----|-------|----------|--------|
| 56-04 | ✓ `d543d77d` | ✓ `d1e41189` | — (not required) | Pass |

RED evidence: `56-04-red-evidence.json` — classifier verdict `RED_EVIDENCE_OK` on target test "TIPS contains exactly 14 base tips" (reason `target_test_failed`). Semantic assessment recorded in the evidence file: 24 tests collected, 19 failed on assertions, 5 passed on the tracer-tip invariants that were already true.

## Files Created/Modified
- `packages/efx-watercolor/src/brushes/tips.ts` - `AquarelleTip extends AquarelleToolOverrides` (8 flat numeric fields), 14 categorized base tips, `TOOL_OVERRIDE_FIELDS`, `toolOverridesFromTip`, `findTip`
- `packages/efx-watercolor/src/brushes/pack.ts` - `buildBrushPackSnapshot` / `parseBrushPackSnapshot` / `asTipRecord` — the total, fail-closed `kind: 'efx-watercolor'` carrier
- `packages/efx-watercolor/src/brushes/importTip.ts` - `importTip` + `ImportTipResult` + `IMPORT_TIP_FAILURE_COPY` — magic sniff, browser-decoder-only decode, single-flight queue
- `packages/efx-watercolor/src/brushes/pack.test.ts` - 24 standing pins (pack / import / snapshot)
- `packages/efx-watercolor/src/brushes/index.ts` - re-exports pack + importTip
- `packages/efx-watercolor/src/engine/deposit.ts` - two tip-overrides reads retargeted to `toolOverridesFromTip` (Rule 3)

## Decisions Made
- **AquarelleTip extends AquarelleToolOverrides (flat fields, not a nested `defaults` bag).** The plan's implementation note says "extend `AquarelleTip` with `tip, aspect, rotation, sizeCurve, scatter, capacity, grain, wetRound`", and the acceptance criterion is "every base tip has all 8 property fields as numbers" — flat fields satisfy both readings and keep snapshot entries as plain serializable numbers. A `toolOverridesFromTip(tip)` seam is the one named projection to the stroke-level `AquarelleToolOverrides` shape.
- **Category union `round | flat | texture | experimental | custom`.** The 56-01 tracer's `'user'` is renamed to `'custom'` to match the UI-SPEC Brushes-docker name `Custom` (D-07). Custom imports land in `custom`.
- **Idempotency: NO silent dedupe.** The plan's flagged assumption offered two options (distinct ids, or dedupe-by-content-hash returning the existing id) and asked the executor to pin one. Pinned: importing the same PNG bytes twice yields two tips with distinct `wc/custom-<hash8>` ids — the hash mixes a monotonic import counter with a content digest so it is fresh per import and stable once assigned.
- **`importTip` is async.** The plan's signature omitted `Promise`, but `createImageBitmap` / `Image.decode` are inherently async — `Promise<ImportTipResult>` is the only correct reading. The discriminated result shape is exactly as planned.
- **Single-flight is a promise chain (queue).** The plan allowed "queued or rejected"; queue chosen so no import is silently dropped. Pinned by the `maxActive === 1` case.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `deposit.ts` broke when `AquarelleTip` was reshaped**
- **Found during:** Task 2 (GREEN: implement tips.ts + pack.ts + importTip.ts)
- **Issue:** The plan's `files_modified` listed only `tips.ts`, `pack.ts`, `importTip.ts`, `pack.test.ts`. Flattening the 8 multipliers onto `AquarelleTip` (per the plan's own implementation note) removed the `defaults` bag that `engine/deposit.ts` read at two call sites (`tip?.defaults`, `tip.defaults`), which would have broken the tracer deposit path and the package build.
- **Fix:** Retargeted both reads through a new `toolOverridesFromTip(tip)` seam in `tips.ts` — the one named projection from tip record to stroke-level `AquarelleToolOverrides`.
- **Files modified:** `packages/efx-watercolor/src/engine/deposit.ts`, `packages/efx-watercolor/src/brushes/tips.ts`
- **Verification:** `vitest run` 51/51 green (includes `engineAdapter.test.ts` and `determinismContract.test.ts`, which exercise the deposit path); `pnpm --filter @efxlab/efx-watercolor build` green; `pnpm --filter efx-motion-editor run typecheck` green.
- **Committed in:** `d1e41189` (Task 2 commit)

**2. [Rule 3 - Blocking] DTS build rejected `Uint8Array` as a `BlobPart`**
- **Found during:** Task 2 (GREEN verification — `pnpm --filter @efxlab/efx-watercolor build`)
- **Issue:** `new Blob([bytes])` in `importTip.ts` failed the tsup DTS build: `Uint8Array<ArrayBufferLike>` is not assignable to `BlobPart` because `SharedArrayBuffer` is not assignable to `ArrayBuffer` under the TS 5.9 lib DOM typings.
- **Fix:** Added a `toBlobPart(bytes)` helper that copies into a fresh `ArrayBuffer`-backed `Uint8Array` before handing it to `Blob`.
- **Files modified:** `packages/efx-watercolor/src/brushes/importTip.ts`
- **Verification:** `pnpm --filter @efxlab/efx-watercolor build` green (ESM + DTS).
- **Committed in:** `d1e41189` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both were consequences of implementing the plan's own stated shape (flat property surface, browser-decoder-only import) against the live TS surface — no scope creep, no new feature surface beyond the plan's artifact list.

## Issues Encountered
- **RED evidence classifier rejected the first two TAP captures.** Vitest's default `tap`/`tap-flat` output carries multiline YAML object dumps (`Object { ... }`) and trailing pnpm banner noise, which the strict-TAP parser flags as `Non-TAP data in report` / `Malformed TAP` / `invalid_record`. Resolved by (a) rewriting the test assertions as scalar predicates — boolean/primitive `toBe`, joined strings instead of `toEqual` on objects — so diagnostics stay one-line, and (b) trimming the capture to the TAP body. The nested `--reporter=tap` form then matched the 56-03 oracle and produced `RED_EVIDENCE_OK`. The scalar-predicate style is recorded as an established pattern.
- **A concurrency test bug was caught before GREEN.** The first draft of the single-flight case incremented an `active` counter inside the decoder stub but never decremented it, so `maxActive` would have been 3 even with correct serialization. Fixed in the GREEN commit by bracketing the stub with `onEnter`/`onExit` and yielding a macrotask mid-decode so unserialized imports would genuinely overlap.

## Known Stubs

None — no hardcoded empty values, placeholder text, or unwired data sources in the shipped surface.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- The `AquarelleTip` record shape (flat 8-field property surface + `category`) and the `BrushPackSnapshot` carrier are stable for 56-06 (script payload), 56-07 (Brushes docker), and 56-09 (`.mce` field contract) to build against.
- 56-07's Brushes docker can group by the `category` field directly — the data model already carries it (D-07), no display-only grouping needed.
- 56-09 must declare `AquarelleTip` / `BrushPackSnapshot` in both TS and Rust (D-27 / `mceFieldContract` law) — this plan deliberately did not touch the `.mce` field contract.
- No blockers.

## Self-Check: PASSED

All 8 tracked files found on disk. Both task commits verified as ancestors of HEAD (`d543d77d`, `d1e41189`).

---
*Phase: 56-efx-watercolor-engine-2-paint-aquarelle-clean-room*
*Completed: 2026-10-15*
