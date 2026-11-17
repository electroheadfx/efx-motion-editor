---
phase: 64-medium-engine
plan: 02
subsystem: engine
tags:
  - watercolor
  - medium
  - viscosity
  - body
  - emboss
  - preact-signals
  - popover
  - tdd

# Dependency graph
requires:
  - phase: 64-medium-engine (plan 01)
    provides: viscosity in the canonical 0..100 bag and the engine 0..1 Params bag, plus clamp01 in the ONE mapping
provides:
  - Five frozen plain medium records over exactly the ten medium keys, with the amendment-table numbers
  - MediumId / MediumParamKey / MediumRecord types and MEDIUMS / MEDIUM_IDS / DEFAULT_MEDIUM_ID / mediumById exports
  - body and emboss in AquarelleCanonicalParams, DEFAULT_CANONICAL_PARAMS, Params and DEFAULT_PARAMS (mapped with clamp01)
  - viscosity, body and emboss in AquarelleGlobalParams, AQUARELLE_GLOBAL_KEYS, DEFAULT_AQUARELLE_PARAMS, the record loop and the selection-edit allowlist
  - aquarelleSelectedMediumId plus the one-spread-write applyAquarelleMedium handler (advisory id, D-03 re-pick)
  - The Viscosity row in the Paint-tab globals panel (eighth row)
  - The five-item medium dropdown as the first Paint-tab row, with captured outside-pointerdown and Escape close
affects:
  - 64-03 (thickness / viscosity consumers)
  - 64-04 (appends the Emboss row after Viscosity)
  - 64-06 (inserts the Body row between Viscosity and Emboss; MED-19's row lands there)
  - 64-12 (response-group picks reuse applyAquarelleMedium)

# Actuals (#2632) — chars/4 over the realized diff, never a harness token count
actuals:
  tokens: 13977
  tasks: 3
  commits: 5
  plan_head_before: 99e38f86035d6af3895056cddbd627b89d24ba0b
  plan_head_after: cdcf04e8bb3bf1ca6093e89ce6546f9ab3207a8a

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Frozen plain-data table with a derive-from-defaults neutral record (no retyped neutral numbers)
    - One spread assignment plus a compare-then-write id write for a whole-record application
    - Store-hosted popover open/anchor state (mirrors aquarelleTextureMenuOpen) so the vnode harness can observe it
    - Write counting through signal.subscribe (attach fires once, then once per change) for one-write proofs

key-files:
  created:
    - packages/efx-watercolor/src/playground/mediums.ts
    - packages/efx-watercolor/src/playground/mediums.test.ts
    - app/src/components/physic-paint/view/mediumSelection.test.ts
  modified:
    - packages/efx-watercolor/src/playground/index.ts
    - packages/efx-watercolor/src/playground/params.ts
    - packages/efx-watercolor/src/playground/params.test.ts
    - packages/efx-watercolor/src/playground/Engine.ts
    - app/src/components/physic-paint/view/aquarelleRecordState.ts
    - app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx
    - app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts

key-decisions:
  - "The watercolor record is derived from DEFAULT_CANONICAL_PARAMS for all ten keys rather than retyped, so the neutral medium can never drift from the canonical defaults."
  - "pastel displays as 'Chalk' per D-18: the id is the serialized identity, the name is the user-facing label, and a test pins the mismatch deliberately."
  - "The medium popover open/anchor state lives in the existing store (aquarelleMediumMenuOpen / aquarelleMediumMenuAnchor), mirroring aquarelleBrushMenuOpen and aquarelleTextureMenuOpen. The app test harness runs components as plain function calls with mocked preact/hooks (useRef returns a fresh { current } and useEffect is a no-op), so component-local signals are unobservable across renders; the plan explicitly permits 'in the existing store'."
  - "A re-pick always calls applyAquarelleMedium and the store decides whether anything is written (D-03): the handler compares the ten keys and writes only on drift, keeping the identical-re-pick zero-write law."
  - "MED-19 is not marked complete here: this plan delivers its canonical-set membership (Body in all four bags, default 0), but the Body ROW lands in 64-06 per the plan's own row ledger and Task 3's explicit 'do not reserve a placeholder' instruction."

patterns-established:
  - "Whole-record application: resolve through the table, compare the record's keys against the live bag, one spread assignment, then a compare-then-write id — never a per-key setter cascade and never the selection-edit path."
  - "Copyable popover contract: local open+anchor signals in the store, captured window pointerdown/keydown while open, trigger data-attribute exemption, fixed positioning with a viewport clamp."

requirements-completed: [MED-01, MED-07, MED-08, MED-09, MED-10, MED-11, MED-12, MED-13]
requirements-deferred:
  - "MED-19 — canonical-set membership delivered here; its globals row is 64-06's"

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "Five frozen plain records over exactly the ten medium keys, matching the amendment-table numbers, with the neutral record derived from the canonical defaults and an unknown id resolving to null."
    requirement: MED-07
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/mediums.test.ts#ships the five ids in the recorded order"
        status: pass
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/mediums.test.ts#matches the amendment table numbers"
        status: pass
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/mediums.test.ts#carries exactly the ten medium keys and never size or lift"
        status: pass
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/mediums.test.ts#derives the watercolor record from the canonical defaults"
        status: pass
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/mediums.test.ts#keeps every record frozen plain serializable data"
        status: pass
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/mediums.test.ts#resolves a known id and returns null for anything else"
        status: pass
    human_judgment: false
  - id: D2
    description: "body and emboss join the canonical and engine bags at 0 and map through the ONE clamp-and-divide law; viscosity, body and emboss join the app bag, key list and defaults, so the record loop and the selection allowlist carry them."
    requirement: MED-19
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/params.test.ts#maps the Body and Emboss globals 0..100 onto the 0..1 medium bag"
        status: pass
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/params.test.ts#declares Body and Emboss at 0 in the canonical and engine bags"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/mediumSelection.test.ts#carries viscosity, body and emboss in the key list and the defaults"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/mediumSelection.test.ts#records all three keys in the per-stroke snapshot"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/mediumSelection.test.ts#accepts a medium-key patch in the selection-edit allowlist"
        status: pass
    human_judgment: false
  - id: D3
    description: "A medium application is exactly one spread assignment plus one id write: no per-key cascade, no selection path, size and lift preserved, two rapid picks settle on the last id."
    requirement: MED-10
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/mediumSelection.test.ts#applies a whole record in exactly one bag write"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/mediumSelection.test.ts#writes the selected id once per switch"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/mediumSelection.test.ts#settles two rapid picks on the last id with one bag write each"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/mediumSelection.test.ts#is one spread assignment and never a per-key or selection path"
        status: pass
    human_judgment: false
  - id: D4
    description: "An unknown id is a total no-op; a medium switch leaves every recorded stroke byte-identical (the medium id is advisory), and a pre-milestone recorded bag replays at the neutral defaults."
    requirement: MED-12
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/mediumSelection.test.ts#is a total no-op for an unknown id"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/mediumSelection.test.ts#leaves every recorded stroke byte-identical"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/mediumSelection.test.ts#maps a pre-milestone recorded bag to the neutral defaults"
        status: pass
    human_judgment: false
  - id: D5
    description: "Re-pick semantics: a drifted record is restored, an identical re-pick writes nothing, a manual tweak keeps the medium selected, and no 'edited' marker is drawn."
    requirement: MED-13
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/mediumSelection.test.ts#restores a drifted bag when the same medium is re-picked"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/mediumSelection.test.ts#writes nothing when the record already is the whole bag"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/mediumSelection.test.ts#keeps the medium selected after a manual global tweak"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts#draws no edited marker after a manual global tweak"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts#re-picking the selected medium restores a drifted neutral record"
        status: pass
    human_judgment: false
  - id: D6
    description: "The Viscosity row is in the existing globals list on the app 0..100 band, eighth and last, and Reset covers it without touching size or lift."
    requirement: MED-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts#renders the 8 named global slider labels in playground order"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts#renders eight slider rows below the dropdown, Viscosity last"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts#Reset writes the ×100 playground defaults through setAquarelleParam and never writes size or lift"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts#Reset commits ONE eight-key params patch after the eight live writes"
        status: pass
    human_judgment: false
  - id: D7
    description: "The medium dropdown is the first Paint-tab row, names the selected medium, lists the five D-18 names in fixed order, applies a pick in one bag write and closes, and closes on outside pointerdown or Escape."
    requirement: MED-13
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts#leads the panel with the dropdown row and names the selected medium"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts#lists the five D-18 names in the fixed order and marks the selection"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts#applies the picked record in one bag write and closes the menu"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts#opens from the trigger with the row anchor and closes on a second press"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts#source pins: captured close listeners, Escape, signals only"
        status: pass
    human_judgment: false
  - id: D8
    description: "The package still builds with no TypeScript error and the app still typechecks."
    verification:
      - kind: other
        ref: "pnpm --filter @efxlab/efx-watercolor build"
        status: pass
      - kind: other
        ref: "pnpm --filter efx-motion-editor exec tsc --noEmit"
        status: pass
    human_judgment: false

# Metrics
duration: 14min
completed: 2026-11-17
status: complete
---

# Phase 64 Plan 02: Five frozen medium records, one-write application and the Paint-tab dropdown Summary

**Five frozen medium records over a ten-key canonical set, a one-spread-write application handler with an advisory selected id, and the five-item dropdown leading the Paint tab above eight globals rows**

## Performance

- **Duration:** 14 min
- **Started:** 2026-11-17T14:56:32Z
- **Completed:** 2026-11-17T15:10:38Z
- **Tasks:** 3
- **Files modified:** 10 (3 created, 7 modified)
- **Commits:** 5 measured (`99e38f86..cdcf04e8`)

## Accomplishments

- `mediums.ts` ships the five built-ins as frozen plain data over exactly the ten medium keys (`water, load, flow, bleed, dry, edge, granulation, viscosity, body, emboss`), with the amendment-table numbers and the neutral record derived from `DEFAULT_CANONICAL_PARAMS`.
- `body` and `emboss` complete the canonical ↔ engine mapping (`clamp01` divide-by-100), and the app bag, key list and defaults carry `viscosity`, `body` and `emboss` at 0 — so the per-stroke snapshot and the selection-edit allowlist gained them with no other edit.
- `applyAquarelleMedium` applies a whole record in one spread assignment plus a compare-then-write id, never a per-key cascade, never the selection path, never `size` or `lift`; an unknown id is a total no-op and a re-pick restores a drifted record.
- The Paint tab now leads with the five-item Medium dropdown (D-18 names: Watercolor, Gouache, Chalk, Graphite, Acrylic), with the Viscosity row appended as the eighth slider; Reset covers every row including Viscosity and never writes `size` or `lift`.

## Task Commits

Each task was committed atomically (TDD tasks carry a RED test commit then a GREEN feat commit):

1. **Task 1: The five frozen medium records over the canonical params** — `ca8adb97e` (test, RED) → `5e0084f94` (feat, GREEN)
2. **Task 2: One-write medium application in the live params bag** — `df51d4579` (test, RED) → `35eab6ddf` (feat, GREEN)
3. **Task 3: Medium dropdown as the first Paint-tab row** — `cdcf04e8b` (feat)

**Plan metadata:** this SUMMARY commit (docs)

## Files Created/Modified

- `packages/efx-watercolor/src/playground/mediums.ts` — five frozen medium records, the id/key/record types, `MEDIUMS`, `MEDIUM_IDS`, `DEFAULT_MEDIUM_ID`, `mediumById`
- `packages/efx-watercolor/src/playground/mediums.test.ts` — amendment table, ten-key closure, derivation, frozen serializability, totality
- `packages/efx-watercolor/src/playground/index.ts` — barrel exports for the medium table and types
- `packages/efx-watercolor/src/playground/params.ts` — `body`/`emboss` in the canonical interface, defaults and clamped mapping
- `packages/efx-watercolor/src/playground/params.test.ts` — Body/Emboss mapping, neutral replay, declared defaults
- `packages/efx-watercolor/src/playground/Engine.ts` — `body`/`emboss` declared in `Params` and `DEFAULT_PARAMS` at 0
- `app/src/components/physic-paint/view/aquarelleRecordState.ts` — three medium keys in the bag/key list/defaults, `aquarelleSelectedMediumId`, `applyAquarelleMedium`, popover open/anchor state and setter
- `app/src/components/physic-paint/view/mediumSelection.test.ts` — one-write, no-cascade, re-pick, unknown-id, recorded-stroke identity and source pins
- `app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx` — Viscosity row, first-row medium dropdown with the copied popover contract
- `app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts` — eight-label order, dropdown-first, five-name order, pick/re-pick, Reset coverage, source pins

## Decisions Made

- The watercolor record derives from `DEFAULT_CANONICAL_PARAMS` for all ten keys instead of retyping 50/50/…; the neutral medium therefore cannot drift from the canonical defaults.
- `pastel` displays as **Chalk** per D-18 — the id is serialized identity, the name is the user-facing label; the test pins the mismatch on purpose.
- The popover open/anchor state lives in the existing store (`aquarelleMediumMenuOpen` / `aquarelleMediumMenuAnchor`, with a compare-then-write setter), exactly mirroring `aquarelleBrushMenuOpen` and `aquarelleTextureMenuOpen`. The plan allows component or store; the store is the only shape the app's vnode harness can observe (mocked `preact/hooks`: `useRef` returns a fresh `{ current }` per render and `useEffect` is a no-op), and listener behavior is pinned by source scans as in `PhysicsPaintTextureMenu.test.ts`.
- A re-pick always invokes `applyAquarelleMedium` and the store decides whether anything is written, keeping D-03's "get back to pure medium" path and the identical-re-pick zero-write law in one place.
- MED-19 is **not** marked complete here: its canonical-set membership (Body in all four bags, default 0) lands in this plan, but its globals ROW lands in 64-06 per the plan's row ledger and the explicit "do not reserve a placeholder for Body or Emboss" instruction.

## Deviations from Plan

None — the plan executed as written. The only structural note: the Task 3 popover state landed in `aquarelleRecordState.ts` (Task 2's file, not an eleventh file), which the plan's "component or in the existing store" clause permits; see the decision above for why the store shape was required.

## TDD Gate Compliance

Both `tdd="true"` tasks ran RED → GREEN with no REFACTOR commit needed (implementation was minimal):

| Task | RED commit | GREEN commit | RED evidence |
|------|-----------|--------------|--------------|
| 1 — medium records | `ca8adb97e` | `5e0084f94` | exit 1, 11 failing; target `src/playground/mediums.test.ts#mediums > matches the amendment table numbers`; validated `RED_EVIDENCE_OK` |
| 2 — one-write application | `df51d4579` | `35eab6ddf` | exit 1, 12 failing; target `src/components/physic-paint/view/mediumSelection.test.ts#applyAquarelleMedium > applies a whole record in exactly one bag write`; validated `RED_EVIDENCE_OK` |

The raw RED records were gate artifacts (persisted for validation, then removed so the plan's file ledger stays at exactly ten source files). Their verdicts are recorded above.

Method note: RED evidence was captured with Vitest's **JUnit** reporter (`--reporter=junit --outputFile=…`), not `tap-flat`. The TAP report's YAML diagnostics embed multi-line quoted object diffs for large assertions, which the strict TAP adapter reads as "Non-TAP data in report" / "Malformed TAP" and rejects as `INVALID_RED`; the JUnit adapter parses the same run cleanly and yields the `classname#name` identity used as `targetTest`. No vacuous RED: every mediums test starts with a length/existence assertion and every one-write test asserts a positive landed value before asserting zero-write counts. The three tests that were already green at Task 2 RED (pre-milestone mapping, opens-on-neutral, recorded-stroke identity) are declared honestly in the record's `semanticAssessment`.

## Issues Encountered

- The first RED capture used Vitest's TAP reporter and was rejected by the evidence classifier; switching to JUnit resolved it (see the method note above).
- `pnpm`'s failure banner polluted captured stdout; captures run under `pnpm --silent --filter … exec …` so the report is the only output.
- The eight-slider count initially filtered on the camelCase `ariaLabel` prop, which `materialize` consumes when it expands `SliderStepper`; the count now rides `data-testid="slider-stepper"` (8). No product-code impact.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- 64-03 can consume the `viscosity` key end-to-end (bag → snapshot → mapping) and the medium records as the single source of tuned values.
- 64-04 appends the Emboss row after Viscosity; 64-06 inserts Body between Viscosity and Emboss and closes MED-19.
- 64-12 can reuse `applyAquarelleMedium` for its response-group picks (same one-write handler, same advisory id).
- No blockers. The live UI surface (dropdown look/feel, popover placement) is ready for the phase's live UAT.

---

*Phase: 64-medium-engine*
*Completed: 2026-11-17*

## Self-Check: PASSED

- Verified summary and all created files exist on disk.
- Verified all 5 task commits are ancestors of HEAD.`
