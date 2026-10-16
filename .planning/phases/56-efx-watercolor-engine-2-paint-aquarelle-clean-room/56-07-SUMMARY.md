---
phase: 56-efx-watercolor-engine-2-paint-aquarelle-clean-room
plan: 07
subsystem: ui
tags: [watercolor, aquarelle, brushes-docker, tool-row, dry-event, slider-stepper, preact, signals, tdd]

# Dependency graph
requires:
  - phase: 56-efx-watercolor-engine-2-paint-aquarelle-clean-room (56-02)
    provides: WatercolorModuleSection shell, panel-split, activeModule signal
  - phase: 56-efx-watercolor-engine-2-paint-aquarelle-clean-room (56-04)
    provides: TIPS pack, AquarelleTip/ToolOverrides model, importTip named failure
  - phase: 56-efx-watercolor-engine-2-paint-aquarelle-clean-room (56-06)
    provides: AquarelleDryEvent / createDryEvent / AquarelleStrokePayload record shape
provides:
  - AquarelleParamsPanel (7 module-only globals + Brush response collapsible multipliers)
  - AquarelleToolRow (brush|water|pen|lift, one active)
  - BrushesDocker (Krita-style category list + import)
  - aquarelleRecordState — the one record-path commit seam (params + toolOverrides snapshot, Dry sink)
  - WatercolorModuleSection full module block (tool row + params + docker + Dry)
  - lean @efxlab/efx-watercolor ./brushes and ./payload sub-exports (engine stays out of the UI chunk)
affects: [56-08, 56-09, 56-10]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
# commits: MEASURED via git rev-list --count plan_head_before..HEAD (#3968, includes this
# closing metadata commit; plan_head_after is the last content commit).
actuals:
  tokens: 14700
  tasks: 3
  commits: 7
plan_head_before: b304a042a2528e5a76c111ee8dc3e69731c3f1f2
plan_head_after: 091b83bdaed5417d3371d889acf4a2a9ffff2f5e

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "aquarelleRecordState is the ONE record-path commit seam — live param bag + selected tip multipliers snapshotted at record time (never a second params channel)"
    - "Selecting a tip loads its per-brush multipliers into Brush response; user edits then ride toolOverrides on the next stroke record"
    - "Effective-value readout = global × multiplier via a pure helper (D-08) shared by panel and pins"
    - "Lean package sub-exports (./brushes, ./payload) keep the fluid engine out of the app main chunk (56-05 papers pattern)"

key-files:
  created:
    - app/src/components/physic-paint/view/AquarelleParamsPanel.tsx
    - app/src/components/physic-paint/view/AquarelleParamsPanel.test.tsx
    - app/src/components/physic-paint/view/AquarelleParamsPanel.test.tsx.test.ts
    - app/src/components/physic-paint/view/AquarelleToolRow.tsx
    - app/src/components/physic-paint/view/AquarelleToolRow.test.tsx
    - app/src/components/physic-paint/view/AquarelleToolRow.test.tsx.test.ts
    - app/src/components/physic-paint/view/BrushesDocker.tsx
    - app/src/components/physic-paint/view/BrushesDocker.test.tsx
    - app/src/components/physic-paint/view/BrushesDocker.test.tsx.test.ts
    - app/src/components/physic-paint/view/aquarelleRecordState.ts
  modified:
    - app/src/components/physic-paint/view/WatercolorModuleSection.tsx
    - packages/efx-watercolor/package.json
    - packages/efx-watercolor/tsup.config.ts

key-decisions:
  - "Brush response rows are the 8 AquarelleToolOverrides fields (Tip/Aspect/Rotation/SizeCurve/Scatter/Capacity/Grain/Wet round) — the tip record IS the per-brush property surface (R1.7). Effective readout pairs each with a related global (tip→size, capacity→load, grain→granulation, wetRound→water; others base 1) via MULTIPLIER_BASE_KEYS."
  - "aquarelleRecordState is a signals module (not props drilling) so the record-path snapshot is the single source for params + toolOverrides; setters are compare-then-write (efx-preact-reactivity rule 3)."
  - "Dry button lives at the bottom of WatercolorModuleSection and emits via emitAquarelleDry → createDryEvent (56-06); it is never in the tool row (D-15). Tick source stays 0 until the Studio record clock joins in 56-08/09."
  - "Category display names Round/Flat/Texture/Experimental/Custom map 1:1 to AquarelleTipCategory; grouping is derived from the data-model category field (D-07)."

patterns-established:
  - "Record-path commit seam for module panels: a signals module owns the live bag + a snapshot() that fills payload fields at record time"
  - "Import failure as one named inline line under the docker toolbar (D-25 house style) — no second error channel"

requirements-completed: [AQUA-02, AQUA-03, AQUA-04]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "AquarelleParamsPanel renders 7 named module-only globals (size mapped to shared Size) plus a collapsed-by-default Brush response with 8 xmultipliers (0.5-2.0, default 1.0) and effective-value readout"
    requirement: AQUA-04
    verification:
      - kind: unit
        ref: "src/components/physic-paint/view/AquarelleParamsPanel.test.tsx.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Record-path commit snapshots the live param bag into AquarelleStrokePayload.params and the selected tip multipliers into toolOverrides"
    requirement: AQUA-04
    verification:
      - kind: unit
        ref: "src/components/physic-paint/view/AquarelleParamsPanel.test.tsx.test.ts#a recorded stroke carries the live param bag"
        status: pass
    human_judgment: false
  - id: D3
    description: "AquarelleToolRow renders exactly Brush/Water/Pen/Lift with one active tool; Dry action button (label Dry, exact tooltip) sits outside the row and emits the record-path Dry event"
    requirement: AQUA-02
    verification:
      - kind: unit
        ref: "src/components/physic-paint/view/AquarelleToolRow.test.tsx.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "BrushesDocker groups tips by data-model category with counts, empty/import-failure/missing-id states per UI-SPEC, footer selected-name — total-count, and Import tooltip"
    requirement: AQUA-03
    verification:
      - kind: unit
        ref: "src/components/physic-paint/view/BrushesDocker.test.tsx.test.ts"
        status: pass
    human_judgment: false

# Metrics
duration: 7min
completed: 2026-10-16
status: complete
---

# Phase 56 Plan 07: Aquarelle module panel surface Summary

**Aquarelle options surface is live: 8 globals + Brush response multipliers, the four-tool row, the Krita-style Brushes docker, and the recorded Dry action — all inside the Water color module block.**

## Performance

- **Duration:** 7 min
- **Tasks:** 3/3
- **Commits:** 7 (3 RED + 3 GREEN + 1 docs)

## Accomplishments

- Built `AquarelleParamsPanel` with the 7 module-only globals (Water, Load, Flow, Bleed, Dry rate, Edge, Granulation) — `size` maps to the shared Size slider (D-05, no duplicate control) — plus a collapsed-by-default `Brush response` collapsible holding 8 ×multipliers (0.5–2.0, default 1.0) with computed effective-value readouts (global × multiplier).
- Built `AquarelleToolRow` as exactly `Brush | Water | Pen | Lift` (32×32, one active) and the `Dry` action button at the bottom of the module block (label `Dry`, tooltip `Flash-dry the sheet. Recorded in the script.`) which emits the 56-06 Dry event through the record path — never a fifth tool.
- Built `BrushesDocker` as the Krita-style vertical category-grouped list (Round/Flat/Texture/Experimental/Custom with `{Category} — {n}` counts), toolbar Add/Import, category filter + search, UI-SPEC empty/import-failure/missing-id rows, and the `{selectedBrushName} — {totalCount} brushes` footer.
- Established `aquarelleRecordState` as the one record-path commit seam: live param bag + selected tip multipliers snapshotted into `AquarelleStrokePayload.params` / `toolOverrides` at record time.
- Added lean `@efxlab/efx-watercolor/brushes` and `/payload` sub-exports so the UI never pulls the fluid engine into the main chunk.

## Decisions Made

- Brush response rows follow the `AquarelleToolOverrides` field set (the tip record is the per-brush property surface, R1.7); effective readout pairs each multiplier with a related global via `MULTIPLIER_BASE_KEYS` (tip→size matches the deposit radius law).
- Record-path state is a signals module with compare-then-write setters (efx-preact-reactivity rule 3) rather than props drilling — one seam, one params channel.
- Dry tick is `0` until the Studio record clock joins in 56-08/09; the event shape and ordering key are already the 56-06 `createDryEvent` contract.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Created the aquarelle record-path commit seam**
- **Found during:** Task 1
- **Issue:** The plan says "use the existing aquarelle record-path commit seam" but no app-side seam existed (56-06 shipped the codec/types only).
- **Fix:** Added `app/src/components/physic-paint/view/aquarelleRecordState.ts` (signals store + `snapshotAquarelleRecord` / `buildAquarelleStrokePayload` / `emitAquarelleDry`) and wired the panel, tool row, and Dry button to it.
- **Files modified:** `aquarelleRecordState.ts`, `AquarelleParamsPanel.tsx`, `AquarelleToolRow.tsx`, `WatercolorModuleSection.tsx`
- **Commit:** d1dd6a7d

**2. [Rule 2 - Missing critical functionality] Lean `./brushes` and `./payload` package sub-exports**
- **Found during:** Task 1
- **Issue:** The UI needs tips/payload types; the main `@efxlab/efx-watercolor` entry pulls the fluid engine into the app chunk (chunk-budget risk, 56-05 pattern).
- **Fix:** Added `brushes` and `payload` tsup entries + package exports (524 B / 504 B + shared chunks).
- **Files modified:** `packages/efx-watercolor/package.json`, `packages/efx-watercolor/tsup.config.ts`
- **Commit:** 5a859847

**3. [Rule 1 - Test] Record-path pin order corrected**
- **Found during:** Task 1 GREEN
- **Issue:** The pin set multipliers before selecting the tip; `selectAquarelleTip` correctly loads the tip's multipliers and wiped the edits.
- **Fix:** Reordered the pin to select first, then edit (the real user flow). Assertion unchanged.
- **Files modified:** `AquarelleParamsPanel.test.tsx`
- **Commit:** d1dd6a7d

## TDD Gate Compliance

| Task | RED commit | GREEN commit | Evidence | Verdict |
|------|------------|--------------|----------|---------|
| 1 AquarelleParamsPanel | 5a859847 | d1dd6a7d | 56-07-red-evidence.json | RED_EVIDENCE_OK |
| 2 AquarelleToolRow + Dry | 6daf1ce3 | d5b3580e | 56-07-red-evidence-task2.json | RED_EVIDENCE_OK |
| 3 BrushesDocker | ec5f1d1f | 091b83bd | 56-07-red-evidence-task3.json | RED_EVIDENCE_OK |

## Auth Gates

None.

## Known Stubs

| Stub | File | Line | Reason |
|------|------|------|--------|
| Dry tick fixed at 0 | WatercolorModuleSection.tsx | onClick | Studio record clock joins in 56-08/09; event shape is already 56-06 `createDryEvent` |
| Add-brush button is a no-op | BrushesDocker.tsx | brushes-add | AQUA-03 locks tip **import**, not tip creation; Add is the D-07 toolbar affordance awaiting a create-tip surface |
| Favorite star is visual-only | BrushesDocker.tsx | TipRow | No favorite-persistence requirement in this plan's acceptance criteria |

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: input-validation | BrushesDocker.tsx | File-import path delegates to 56-04 `importTip` (magic-byte sniff + named failure); UI shows `IMPORT_TIP_FAILURE_COPY` and never throws (T-56-20 disposition: mitigate, satisfied) |
| threat_flag: input-validation | aquarelleRecordState.ts | Multiplier commits clamp to 0.5–2.0 before reaching the record snapshot (T-56-22 disposition: mitigate, satisfied) |

## Self-Check: PASSED

- FOUND: app/src/components/physic-paint/view/AquarelleParamsPanel.tsx
- FOUND: app/src/components/physic-paint/view/AquarelleToolRow.tsx
- FOUND: app/src/components/physic-paint/view/BrushesDocker.tsx
- FOUND: app/src/components/physic-paint/view/aquarelleRecordState.ts
- FOUND: app/src/components/physic-paint/view/WatercolorModuleSection.tsx
- FOUND: 5a859847, d1dd6a7d, 6daf1ce3, d5b3580e, ec5f1d1f, 091b83bd (all 6 content commits)
