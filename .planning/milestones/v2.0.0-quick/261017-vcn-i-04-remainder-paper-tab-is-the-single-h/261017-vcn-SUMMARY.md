---
phase: quick-261017-vcn
plan: 261017-vcn
subsystem: ui
tags: [preact, physic-paint, paper-tab, grain, background, paperpicker]

# Dependency graph
requires:
  - phase: quick-261017-fz3
    provides: Paint-tab PaperPicker mount removed (bf547f76) — the I-04 remainder starts from one Paper tab mount
provides:
  - Paper tab is the single home for paper + background (grain pair at top, Transparent/White arms, locked 13-cell grid)
  - One grain control pair with the combined write-through (settings + paper-display + track metadata + document fallback)
  - Slim top bar (status pill + ModuleSwitcher + Brush size + Opacity)
affects: [physic-paint-studio, paper-display, grain-controls, top-bar]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 17195
  tasks: 2
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One grain pair writes both write-throughs in the same turn (settings + setPaper* + setRotoBackgroundMetadata + setBackgroundFallback)"
    - "Paper tab structural section markers (data-paper-picker-grain / -backgrounds / -popover) as the order-pin anchors"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/view/PaperPicker.tsx
    - app/src/components/physic-paint/view/PaperPicker.test.tsx
    - app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx
    - app/src/components/physic-paint/view/PhysicsPaintTopBar.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx
    - app/src/components/physic-paint/view/physicsPaintRightPanelPaperSingleHome.test.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
    - app/src/components/shared/NumericStepper.test.tsx
    - app/src/components/physic-paint/view/RightPanelPaperTab.tsx

key-decisions:
  - "Q6 grain widgets (segmented None/Soft/Med/Hard + grainScaleStep freeEntry SliderStepper) move to the TOP of the Paper tab; the D-10 bottom Strength/Scale pair is deleted so one pair survives"
  - "Transparent + White sit between grain and grid as background arms (locked Paper-background decision), reusing the top-bar swatch look, wired to handleBackgroundChange; paper cells keep the paper-id path"
  - "handleGrainStrengthChange / handleGrainScaleChange absorb physicPaintStore.setPaperStrength / setPaperScale so one grain change hits settings + paper-display record + track metadata + document fallback in the same turn"
  - "grainScaleStep moves with the grain widget to PaperPicker.tsx (still exported; step law unchanged)"

patterns-established:
  - "Paper-tab order pins anchor on structural section markers, not label substrings (warmProceduralReliefThumbs also contains 'Procedural')"

requirements-completed: [I-04]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "Paper tab is the single home for paper + background — grain pair at top, Transparent/White arms, locked 13-cell grid"
    requirement: I-04
    verification:
      - kind: unit
        ref: "src/components/physic-paint/view/physicsPaintRightPanelPaperSingleHome.test.ts#Paper tab order is grain pair → Transparent/White → grid; the D-10 bottom pair is gone"
        status: pass
      - kind: unit
        ref: "src/components/physic-paint/view/PaperPicker.test.tsx#Paper-tab order is grain → Transparent/White → grid; the D-10 bottom pair is gone"
        status: pass
    human_judgment: false
  - id: D2
    description: "One grain pair writes settings + paper-display + track metadata + document fallback in the same turn"
    requirement: I-04
    verification:
      - kind: unit
        ref: "src/components/physic-paint/view/physicsPaintRightPanelPaperSingleHome.test.ts#surviving grain handlers write settings + paper-display + metadata + fallback; one pair only"
        status: pass
      - kind: unit
        ref: "src/components/physic-paint/view/PhysicsPaintTopBar.test.ts#handleGrainScaleChange writes settings, paper-display, mirror, and fallback without an engine call"
        status: pass
    human_judgment: false
  - id: D3
    description: "Top bar slim — status pill + ModuleSwitcher + Brush size + Opacity only"
    requirement: I-04
    verification:
      - kind: unit
        ref: "src/components/physic-paint/view/physicsPaintRightPanelPaperSingleHome.test.ts#top bar keeps status + ModuleSwitcher + Brush size + Opacity only"
        status: pass
      - kind: unit
        ref: "src/components/physic-paint/view/PhysicsPaintTopBar.test.ts#renders Brush size + Opacity and no Background / Grain rows"
        status: pass
    human_judgment: false
  - id: D4
    description: "Live UAT — Paper-tab layout, Transparent/White/paper fond, grain persistence, Paint tab unchanged"
    requirement: I-04
    verification: []
    human_judgment: true
    rationale: "Visual layout and fond appearance across Transparent/White/paper + save/reopen grain agreement need the live Studio; the executor does not start the server."

# Metrics
duration: 17min
completed: 2026-10-17
status: complete
---

# Quick 261017-vcn: I-04 remainder — Paper tab single home Summary

**Paper tab owns paper + background (grain pair on top, Transparent/White arms, locked grid); top bar slim; one grain pair with the combined write-through.**

## Performance

- **Duration:** 17 min
- **Started:** 2026-10-17T20:47:44Z
- **Completed:** 2026-10-17T21:04:46Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Paper tab is now the single home for paper + background: Q6 grain pair (segmented None/Soft/Med/Hard + grainScaleStep freeEntry stepper) at the top, Transparent + White background arms, then the untouched 13-cell Procedural/Real grid.
- The D-10 bottom Strength/Scale pair is gone — one grain control pair survives, and each grain change writes settings + paper-display record (`setPaper*`) + track metadata + document fallback in the same turn.
- Top bar keeps status pill + ModuleSwitcher + Brush size + Opacity; Background / Grain rows and those `PhysicsPaintTopBarProps` fields are gone.

## Task Commits

Each task was committed atomically:

1. **Task 1: RED — pin the Paper-tab single-home contract** - `1e7626dd` (test)
2. **Task 2: GREEN — grain + Transparent/White into the Paper tab, slim the top bar, one write-through pair** - `88d4c9a4` (feat)
3. **Follow-up: retarget RightPanelPaperTab + drop unused test helpers** - `3a5a66c7` (fix)

**Plan metadata:** (docs commit handled by the orchestrator)

_Note: TDD cycle is RED (`1e7626dd`) → GREEN (`88d4c9a4`); `3a5a66c7` is the Rule 3 type-ripple cleanup._

## TDD Gate Compliance

| Plan | RED | GREEN | REFACTOR | Status |
|------|-----|-------|----------|--------|
| 261017-vcn | `1e7626dd` | `88d4c9a4` | — | compliant (REFACTOR optional) |

RED evidence: `RED_EVIDENCE_OK` (target test `Paper tab order is grain pair → Transparent/White → grid; the D-10 bottom pair is gone`, exit 1, matched on the planned order assertion). Record at `.planning/quick/261017-vcn-i-04-remainder-paper-tab-is-the-single-h/red-evidence.json`.

## Files Created/Modified

- `app/src/components/physic-paint/view/PaperPicker.tsx` - Paper-tab content: grain pair + Transparent/White arms + locked grid; `grainScaleStep` lives here now
- `app/src/components/physic-paint/view/PaperPicker.test.tsx` - order / grain / arms pins + moved step-law tests
- `app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx` - slim: status + ModuleSwitcher + Brush size + Opacity
- `app/src/components/physic-paint/view/PhysicsPaintTopBar.test.ts` - slim-top-bar pin; Studio wiring pins retargeted to the rightPanel memo
- `app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx` - PaperPicker mount passes background + grain ports
- `app/src/components/physic-paint/view/physicsPaintRightPanelPaperSingleHome.test.ts` - three new I-04 remainder pins (order, top-bar slim, combined write-through)
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` - grain handlers absorb `setPaper*`; paper-only pair dropped; memos rewired
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` - topBar deps pin follows the slim memo
- `app/src/components/shared/NumericStepper.test.tsx` - `grainScaleStep` import + `GRAIN_CALL_SITE_REL` retargeted to PaperPicker
- `app/src/components/physic-paint/view/RightPanelPaperTab.tsx` - unused wrapper retyped to the new PaperPicker ports

## Decisions Made

- Q6 grain widgets are the surviving pair (former top-bar look, at the TOP of the Paper tab); the picker's D-10 bottom pair is deleted so one pair survives (T-261017-VCN-02).
- Transparent + White are background, not papers — they sit between grain and grid and route through `handleBackgroundChange`; paper cells keep `handlePaperIdChange` (locked Paper-background decision, T-261017-VCN-03).
- The surviving grain pair folds `physicPaintStore.setPaperStrength` / `setPaperScale` into the existing grain handlers so the paper-display record and the document fallback / track metadata cannot disagree (T-261017-VCN-01).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] NumericStepper.test.tsx grainScaleStep import + GRAIN_CALL_SITE_REL**
- **Found during:** Task 1 (RED)
- **Issue:** `grainScaleStep` moved out of `PhysicsPaintTopBar.tsx` per the locked Q6 move, breaking `NumericStepper.test.tsx`'s import and the 260924-d6l Pin 3 exception-option call-site pin.
- **Fix:** Import `grainScaleStep` from `./PaperPicker`; retarget `GRAIN_CALL_SITE_REL` to `PaperPicker.tsx` (the grain widget's new home keeps `resolveStep`/`freeEntry` as the sole exception call site).
- **Files modified:** `app/src/components/shared/NumericStepper.test.tsx`
- **Commit:** `1e7626dd`

**2. [Rule 1 - Bug] Order-pin assertions tripped on comment/function-name substrings and on host-only vs expanded trees**
- **Found during:** Task 2 (GREEN)
- **Issue:** Source pins matched `Procedural` inside `warmProceduralReliefThumbs`; render pins looked for labels in `textContent` (they live on `aria-label`/`title`/`label`) and for `SliderStepper` after full materialize (the materializer expands it).
- **Fix:** Anchor order pins on structural section markers (`data-paper-picker-grain` / `-backgrounds` / `-popover`); walk the host-only vnode tree for SliderStepper props (TopBar idiom).
- **Files modified:** `physicsPaintRightPanelPaperSingleHome.test.ts`, `PaperPicker.test.tsx`, `PhysicsPaintTopBar.test.ts`
- **Commit:** `88d4c9a4`

**3. [Rule 3 - Blocking] RightPanelPaperTab.tsx still typed against the old PaperPicker ports**
- **Found during:** Task 2 (GREEN, post-commit typecheck)
- **Issue:** The unused `RightPanelPaperTab` wrapper still passed `strength`/`scale`/`onStrengthChange`/`onScaleChange`, which no longer exist on `PaperPickerProps`.
- **Fix:** Retarget the wrapper to the new ports (paperId/background/grainStrength/grainScale + the matching handlers). Left in place (not imported) rather than deleted — out of scope to remove.
- **Files modified:** `app/src/components/physic-paint/view/RightPanelPaperTab.tsx`
- **Commit:** `3a5a66c7`

### Plan-structure note

The plan specified two atomic commits (RED, then GREEN). The Rule 3 type-ripple cleanup landed as a third small `fix` commit (`3a5a66c7`) because the GREEN commit was already made and the project forbids amending a non-hook-modified commit.

## Auth Gates

None.

## Known Stubs

None.

## Threat Flags

None — the three register threats (T-261017-VCN-01/02/03) are mitigated by the pins and implementation; T-261017-VCN-SC (package installs) did not apply (zero installs).

## Verification

- Single-home + order + write-through: `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/physicsPaintRightPanelPaperSingleHome.test.ts` — 6/6 pass
- Paper-tab UI contract: `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PaperPicker.test.tsx.test.ts` — 15/15 pass
- Top bar + studio wiring: `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PhysicsPaintTopBar.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts` — 11/11 + 164/164 pass
- NumericStepper ripple: `pnpm --filter efx-motion-editor exec vitest run src/components/shared/NumericStepper.test.tsx.test.ts` — 35/35 pass
- Guardrail audit: `git diff SPECS/` empty; `git diff packages/efx-watercolor/src/playground/` empty; `git diff app/package.json app/vitest.config.ts` empty

## Live UAT (user-run — status stays automated-ready until these pass)

1. Open Water color → Paper tab: grain controls at the top, Transparent + White below them, paper grid below that. No Strength/Scale pair under the grid.
2. Top bar shows only status + module switcher + Brush size + Opacity.
3. Click Transparent → canvas fond goes checkerboard/transparent; click White → white fond; click a paper cell → that paper's fond. Each choice survives a reopen.
4. Grain strength None/Soft/Med/Hard and Grain scale (+/− and free entry) change the visible paper tooth; save → reopen keeps both values (paper-display record and fallback agree).
5. Paint tab still shows Opacity and no paper grid (261017-fz3 behaviour stays). Console clean.

## Self-Check: PASSED

- All 10 modified/created source files + SUMMARY.md found on disk
- Commits `1e7626dd`, `88d4c9a4`, `3a5a66c7` are ancestors of HEAD
