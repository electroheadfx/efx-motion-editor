---
phase: 56-efx-watercolor-engine-2-paint-aquarelle-clean-room
plan: 10
subsystem: verification
tags: [aquA-08, uat-staging, suite-gate, determinism, transparency, live-visual, clean-break]

# Dependency graph
requires:
  - phase: 56-efx-watercolor-engine-2-paint-aquarelle-clean-room
    plan: 03
    provides: fluid core (wet-in-wet bloom + tide line look target for A3)
  - phase: 56-efx-watercolor-engine-2-paint-aquarelle-clean-room
    plan: 05
    provides: paper pass + PaperPicker (D-11 relief thumbs; D-19 cleanup here)
  - phase: 56-efx-watercolor-engine-2-paint-aquarelle-clean-room
    plan: 07
    provides: panel-split shell (BrushModuleSection owns Blending/pickup pin)
  - phase: 56-efx-watercolor-engine-2-paint-aquarelle-clean-room
    plan: 08
    provides: aquarelleBake createBakeHost (A1/A2/A5 bake pins)
  - phase: 56-efx-watercolor-engine-2-paint-aquarelle-clean-room
    plan: 09
    provides: .mce field contract + cross-engine refusal (MOD-05 / DATA-04)
provides:
  - Phase-close suite gate green (293 files / 5129 tests / typecheck 0) before UAT is staged
  - 56-VERIFICATION.md must_haves checklist (A1-A5 + gate G1) with supporting pin inventory
  - 56-UAT.md rows A1-A5 staged PENDING with named evidence types + human batch protocol
  - D-19 cleanup: PaperPicker relief thumbs no longer use toDataURL (ImageData + cell canvas)
affects: [AQUA-08 close, 57-efx-spectral]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
# estimateTokens was 25000; actual is chars/4 over the realized diff (this plan is
# verification/staging + four suite-gate fixes — no engine surface). Do not round.
actuals:
  tokens: 4947
  tasks: 2
  commits: 2
plan_head_before: 3d0cd8000129a3dc8f5d69cc038c76fc70985397
plan_head_after: da70b7081b677a15f8e05b395026af974f988f79

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Picker relief thumbs as ImageData cache + cell <canvas> paint — presentation pixels stay off the toDataURL/frame-transport surface (D-19)"
    - "Source-scan pins follow the control home after a panel-split (Blending/pickup retargeted to BrushModuleSection)"

key-files:
  created:
    - .planning/phases/56-efx-watercolor-engine-2-paint-aquarelle-clean-room/56-VERIFICATION.md
    - .planning/phases/56-efx-watercolor-engine-2-paint-aquarelle-clean-room/56-UAT.md
  modified:
    - app/src/components/physic-paint/view/PaperPicker.tsx
    - app/src/components/physic-paint/view/PhysicsPaintPalette.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts

key-decisions:
  - "A3 stays a live visual row. The look of wet-in-wet bloom and the tide line cannot be closed by unit probes (feedback_live_evidence_over_unit_probes / spec §8). The phase verdict is automated-ready until the user asserts A1-A5."
  - "PaperPicker relief thumbs render as a cell <canvas> painted from a cached ImageData — no toDataURL string. This keeps the D-19 frame-transport ban intact instead of allowlisting a new consumer."
  - "Suite-gate regressions from earlier 56 plans were fixed in this plan (Rule 1/3) rather than deferred: the plan's verify IS a green suite, so a red gate cannot be logged out of scope."
  - "A4 is a cache-path/inspect row (touching ranges only). No unit pin was invented for it; overlapping ranges stay out of scope per the plan's flagged assumptions."

patterns-established:
  - "Phase-close suite gate fixes ride in the verification plan's first commit (gates + staging) so the green run is the staged baseline"

# AQUA-08 is NOT in requirements-completed — it closes only when the user asserts A1-A5.
requirements-completed: []

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "Phase-close automated gates green — full vitest suite (293 files / 5129 tests / 0 failed) and typecheck (exit 0)"
    requirement: AQUA-08
    verification:
      - kind: unit
        ref: "pnpm --filter efx-motion-editor exec vitest run"
        status: pass
      - kind: other
        ref: "pnpm --filter efx-motion-editor run typecheck"
        status: pass
    human_judgment: false
  - id: D2
    description: "56-VERIFICATION.md must_haves checklist (A1-A5 truths + gate G1) with supporting pin inventory and flagged assumptions"
    requirement: AQUA-08
    verification:
      - kind: other
        ref: ".planning/phases/56-efx-watercolor-engine-2-paint-aquarelle-clean-room/56-VERIFICATION.md"
        status: pass
    human_judgment: false
  - id: D3
    description: "56-UAT.md rows A1-A5 staged PENDING with named evidence types; A3 is live visual (bloom + tide line, not killed at a frame boundary)"
    requirement: AQUA-08
    verification: []
    human_judgment: true
    rationale: "A1-A5 are the phase acceptance axis (R3.6). A3 is visual judgment over WebGL/Tauri (spec §8; feedback_live_evidence_over_unit_probes). A1/A2/A4/A5 need live/disk evidence (golden WebP, cache-path inspect, export alpha) from the native app. Automated pins support A1/A2/A5 but do not close the rows. Phase stays automated-ready until the user asserts."

# Metrics
duration: 8min
completed: 2026-10-16
status: complete
---

# Phase 56 Plan 10: AQUA-08 close (suite gate + UAT staging) Summary

**Phase-close suite gate green after four Phase 56 pin/mock regressions; AQUA-08 rows A1–A5 staged for live human judgment — phase is automated-ready, not claimed done.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-10-16T05:16:25Z
- **Completed:** 2026-10-16T05:24:23Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Full vitest suite + typecheck green (5129 passed / 0 failed; tsc exit 0) after fixing four Phase 56 suite-gate regressions that would have blocked AQUA-08 staging.
- `56-VERIFICATION.md` records the must_haves checklist (A1–A5 + gate G1), supporting pin inventory, flagged assumptions, and P4/project-law prohibitions.
- `56-UAT.md` stages rows A1–A5 as PENDING with named evidence types and an end-of-phase human batch protocol (A3 explicitly live-visual-only).
- D-19 cleanup: `PaperPicker` procedural relief thumbs now paint from a cached ImageData into a cell `<canvas>` — the frame-transport `toDataURL` ban stays intact (no allowlist expansion).

## Task Commits

Each task was committed atomically:

1. **Task 1: Full suite + typecheck green, then stage UAT rows A1–A5** - `f906bf84` (fix)
2. **Task 2: Live UAT A1-A5 close (user-asserted, end-of-phase)** - `da70b708` (docs)

## Files Created/Modified
- `.planning/phases/56-efx-watercolor-engine-2-paint-aquarelle-clean-room/56-VERIFICATION.md` - must_haves checklist + pin inventory + automated gate results
- `.planning/phases/56-efx-watercolor-engine-2-paint-aquarelle-clean-room/56-UAT.md` - A1–A5 rows PENDING with evidence types + human batch protocol
- `app/src/components/physic-paint/view/PaperPicker.tsx` - ImageData relief cache + cell canvas (D-19)
- `app/src/components/physic-paint/view/PhysicsPaintPalette.test.ts` - lucide-preact mock covers WatercolorModuleSection icon tree
- `app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts` - same mock fix + Blending/pickup pin retargeted to BrushModuleSection
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` - 49-04 pin expects `StudioBackgroundMode` (56-05 type widening)

## Decisions Made
- A3 remains live visual judgment; unit probes cannot close bloom/tide-line look (spec §8, project law).
- PaperPicker relief thumbs use ImageData + canvas paint instead of allowlisting `toDataURL` (honors D-19 without weakening the ban).
- Suite-gate regressions from earlier 56 plans are in-scope Rule 1/3 fixes here because this plan's verify IS a green suite.
- A4 stays a cache-path/inspect row (touching ranges only); no invented unit pin.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] lucide-preact mocks missing WatercolorModuleSection icons**
- **Found during:** Task 1 (suite gate)
- **Issue:** `PhysicsPaintPalette.test.ts` and `PhysicsPaintRightPanel.test.ts` mocked lucide-preact with only `GripHorizontal`/`X`(/`Trash2`/`AudioWaveform`). 56-02's `WatercolorModuleSection` pulls `AquarelleToolRow` (`Paintbrush`/`Droplet`/`Pen`/`Eraser`) and `BrushesDocker` (`Plus`/`FolderOpen`/`Star`/`ChevronDown`/`ChevronRight`/`Search`), so both suites failed at collect with `No "Paintbrush" export is defined on the "lucide-preact" mock`.
- **Fix:** Expanded both mock factories to cover the WatercolorModuleSection icon tree.
- **Files modified:** `app/src/components/physic-paint/view/PhysicsPaintPalette.test.ts`, `app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts`
- **Commit:** `f906bf84`

**2. [Rule 1 - Bug] PaperPicker toDataURL violated the D-19 frame-transport ban**
- **Found during:** Task 1 (suite gate)
- **Issue:** `efxPaintCleanBreakContract.test.ts` "forbids the frame-transport tokens outside the allowlist (D-19)" failed on `PaperPicker.tsx:78` (`canvas.toDataURL()` for 64×64 procedural relief thumbs). 56-05 introduced the picker; the ban is a grep contract.
- **Fix:** Relief cache now stores `ImageData`; the cell renders a `<canvas>` painted via `putImageData`. No base64 string. Contract stays un-allowlisted.
- **Files modified:** `app/src/components/physic-paint/view/PaperPicker.tsx`
- **Commit:** `f906bf84`

**3. [Rule 1 - Bug] 49-04 source-scan pin drifted after 56-05 type widening**
- **Found during:** Task 1 (suite gate)
- **Issue:** `PhysicsPaintStudio.test.ts` expected `const handleBackgroundChange = (mode: BgMode) => {`; 56-05 widened the parameter to `StudioBackgroundMode` (`BgMode | PaperTexture`). Behavior unchanged.
- **Fix:** Pin now expects `mode: StudioBackgroundMode`.
- **Files modified:** `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- **Commit:** `f906bf84`

**4. [Rule 1 - Bug] 260930-ni6 Blending/pickup pin scanned the wrong file after 56-02 panel-split**
- **Found during:** Task 1 (suite gate)
- **Issue:** The pin looked for `label="Blending"` / `id="physics-pickup"` in `PhysicsPaintRightPanel.tsx`. 56-02 moved the Brush-module sliders into `BrushModuleSection.tsx` (where both strings live). Rename intact; pin home stale.
- **Fix:** Retarget the scan to `BrushModuleSection.tsx` (D-05 shared/module split).
- **Files modified:** `app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts`
- **Commit:** `f906bf84`

## Known Stubs

None. UAT rows A1–A5 are PENDING human_judgment by design (phase gate), not stubs — the staging surface is complete and the phase verdict is `automated-ready`.

## Auth Gates

None.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: other | 56-UAT.md | UAT verdicts must stay live/disk evidence (T-56-31). A3 cannot be closed by unit tests; each row names its evidence type. |
| threat_flag: other | 56-VERIFICATION.md | Golden WebP hashes are encoder-version-bound (T-56-32). A2 compares two bakes of the same script under one encoder. |

## Deferred Issues

None.

## Phase verdict

**automated-ready.** Full suite + typecheck green; UAT rows A1–A5 staged. AQUA-08 closes only when the user asserts A1–A5 (A3 as live visual). Do not claim done before live UAT.
