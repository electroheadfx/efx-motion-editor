---
phase: quick-261018-lqv
plan: 261018-lqv
subsystem: ui
tags: [roto, script-schema, validator-parity, paper-background, grainScale, physic-paint]

# Dependency graph
requires:
  - phase: 56-05
    provides: paper/* background ids + optional grainScale on isPhysicPaintRotoBackgroundMetadata
  - phase: 261017-dc2
    provides: document-parser lockstep twin + parity pin suite
provides:
  - isRotoBackground accepts paper/* ids and optional grainScale (save path unblocked)
  - parity pin third contract leg: script-schema ↔ apply-payload accept/reject agreement
affects: [roto-script-capture, roto-script-library, physic-paint-studio]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
# Same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 1816
  tasks: 1
  commits: 1

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "lockstep validator duplication (no shared predicate — runtime cycle guard) pinned by parity suite"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoBackgroundValidatorParity.test.ts

key-decisions:
  - "Export isRotoBackground (named) so the parity pin can call it side-by-side with isPhysicPaintRotoBackgroundMetadata — no cheap public path exists (serializeRotoScript needs a full webp thumbnail fixture)."
  - "Duplicate the paper/ + grainScale arms rather than extract a shared predicate — a value import back into types/physicPaint would create a runtime cycle (types value-imports this schema)."

patterns-established:
  - "Validator lockstep: background guards in script-schema / document-parser / apply-payload stay byte-similar and are pinned by physicsPaintRotoBackgroundValidatorParity.test.ts."

requirements-completed: []

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "isRotoBackground accepts paper/* backgrounds and optional in-range grainScale, matching isPhysicPaintRotoBackgroundMetadata"
    verification:
      - kind: unit
        ref: "src/components/physic-paint/roto/physicsPaintRotoBackgroundValidatorParity.test.ts#SCRIPT-SCHEMA PARITY ACCEPT"
        status: pass
      - kind: unit
        ref: "src/components/physic-paint/roto/physicsPaintRotoBackgroundValidatorParity.test.ts#SCRIPT-SCHEMA PARITY REJECT"
        status: pass
      - kind: unit
        ref: "src/components/physic-paint/roto/physicsPaintRotoBackgroundValidatorParity.test.ts#SCRIPT-SCHEMA GRAINSCALE FAIL-CLOSED"
        status: pass
    human_judgment: false
  - id: D2
    description: "Live UAT — capture a Roto script on a paper-backed frame and confirm it saves and reloads"
    verification: []
    human_judgment: true
    rationale: "Native Studio capture path crosses webview/Rust boundaries; vitest cannot observe the live throw. User must run the 5-row capture matrix."

# Metrics
duration: 12min
completed: 2026-10-18
status: complete
---

# Quick 261018-lqv: Fix captured Roto script is not persistable Summary

**Script-schema background validator now accepts paper/* ids and optional grainScale, unblocking Roto script capture on paper-backed frames**

## Performance

- **Duration:** 12 min
- **Started:** 2026-10-18T15:42:00Z
- **Completed:** 2026-10-18T15:54:00Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- `isRotoBackground` (physicsPaintRotoScriptSchema.ts) mirrors `isPhysicPaintRotoBackgroundMetadata`: five closed literals OR `startsWith('paper/')`, plus optional `grainScale` via `isGrainScaleValue` (finite, [0.1, 10]).
- Parity pin extended with a third contract leg asserting script-schema ↔ apply-payload agreement on the identical accept set (7 legal backgrounds) and reject set (photo, empty string, out-of-range grainStrength, missing grainStrength), plus grainScale fail-closed in both.
- `serializeRotoScript` no longer throws `Captured Roto script is not persistable` at the `isRotoBackground` guard for a `paper/*` source background.

## Task Commits

Each task was committed atomically:

1. **Task 1: accept paper/* and grainScale in the script-schema background validator** - `77e64dcb` (fix)

**Plan metadata:** _docs commit handled by orchestrator_

## Files Created/Modified
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts` - `isRotoBackground` exported; `paper/*` arm + optional `grainScale` arm added; lockstep comment pointing at `isPhysicPaintRotoBackgroundMetadata`
- `app/src/components/physic-paint/roto/physicsPaintRotoBackgroundValidatorParity.test.ts` - third describe block: SCRIPT-SCHEMA PARITY ACCEPT / REJECT / GRAINSCALE FAIL-CLOSED

## Decisions Made
- Export `isRotoBackground` (named export) rather than drive assertions through `serializeRotoScript` — the full serialize path needs a webp thumbnail fixture, out of proportion for a pin.
- Duplicate the `paper/` + `grainScale` arms instead of extracting a shared predicate — a value import back into `types/physicPaint` would create a runtime cycle (types value-imports this schema). Same constraint as 261017-dc2.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## TDD Evidence

**RED (before production fix):**
- `SCRIPT-SCHEMA PARITY ACCEPT` — `isRotoBackground({background:'paper/cold-press', grainStrength:0.45})` expected true, received false
- `SCRIPT-SCHEMA GRAINSCALE FAIL-CLOSED` — `isRotoBackground({background:'paper/cold-press', grainStrength:0.45, grainScale:0.5})` expected true, received false

**GREEN (after production fix, zero assertion edits):** 25/25 tests pass across the three plan suites.

## Verification

```
pnpm --filter efx-motion-editor exec vitest run \
  src/components/physic-paint/roto/physicsPaintRotoBackgroundValidatorParity.test.ts \
  src/components/physic-paint/roto/physicsPaintRotoScriptSchema.test.ts \
  src/components/physic-paint/roto/physicsPaintRotoBackgroundGrainOff.test.ts
```

Result: 3 files, 25 tests, all passed.

Guardrail audit:
- `git diff app/src/types/physicPaint.ts` — empty
- `git diff app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts` — empty
- `git diff app/package.json app/vitest.config.ts` — empty
- `git diff --stat` — only the two plan files

## Live UAT (user-run — pending)

Automated-ready. Status stays automated-ready until the user judges these rows:

| # | Step | Expected | Verdict |
|---|------|----------|---------|
| 1 | Select a procedural paper (e.g. Cold Press) in the Paper picker | paper selected | _pending_ |
| 2 | Capture a Roto script | save succeeds, no `Captured Roto script is not persistable` throw | _pending_ |
| 3 | Open the saved script / library | script re-loads / appears in the library | _pending_ |
| 4 | Capture again with `transparent` / `white` / `canvas1` background | still saves | _pending_ |
| 5 | Change only Grain scale on a paper, capture | still saves | _pending_ |

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries. The change widens a validator's acceptance set at an existing boundary (script-schema background guard) to match the already-approved apply-payload oracle; fail-closed `grainStrength` / `grainScale` / `color` checks are unchanged.

## Next Phase Readiness
- Save path for paper-backed Roto captures is unblocked.
- Future background-validator changes must update all three sites (script-schema, document-parser, apply-payload) and the parity pin.

## Self-Check: PASSED

- FOUND: app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts
- FOUND: app/src/components/physic-paint/roto/physicsPaintRotoBackgroundValidatorParity.test.ts
- FOUND: .planning/quick/261018-lqv-fix-captured-roto-script-is-not-persista/261018-lqv-SUMMARY.md
- FOUND: 77e64dcb (ancestor of HEAD)

---
*Quick: 261018-lqv*
*Completed: 2026-10-18*
