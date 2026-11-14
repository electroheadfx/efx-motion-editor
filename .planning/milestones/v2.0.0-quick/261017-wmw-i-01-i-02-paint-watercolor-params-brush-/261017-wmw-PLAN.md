---
phase: quick-261017-wmw
plan: 261017-wmw
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/physic-paint/view/AquarelleParamsPanel.tsx
  - app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx
  - app/src/components/physic-paint/view/BrushResponsePanel.tsx
  - app/src/components/physic-paint/view/WatercolorModuleSection.tsx
  - app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx
  - app/src/components/physic-paint/view/RightPanelBrushTab.tsx
  - app/src/components/physic-paint/view/AquarelleParamsPanel.test.tsx
  - app/src/components/physic-paint/view/panelSplitShell.test.tsx
  - app/src/components/physic-paint/view/AquarelleToolRow.test.tsx
  - app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts
  - app/src/components/physic-paint/view/BrushResponsePanel.test.ts
files_deleted:
  - app/src/components/physic-paint/view/AquarelleParamsPanel.tsx
autonomous: true
requirements:
  - I-01
  - I-02

estimate:
  tokens: 48000
  raw_tokens: 32000
  tasks: 2
  confidence: med

must_haves:
  truths:
    - "Paint tab (watercolor) shows SectionLabel Water color + exactly 7 sliders (Water, Pigment, Flow, Bleed, Edges, Grain, Dry speed) + a Reset control — no Size row, no Hand row, no brush list, no Brush response block, no tool row."
    - "The four renamed rows keep their existing param keys (load / edge / granulation / dry); only the visible labels change to the playground copy."
    - "Reset restores the playground DEFAULT_PARAMS values for the 7 globals on the app 0-100 slider scale through setAquarelleParam, and never writes size (the top bar owns it)."
    - "Brush response (8 multipliers + effective-value readout + Select-a-brush placeholder) is mounted only in the Brush tab as BrushResponsePanel, next to the brush picker (BrushesDocker)."
    - "AquarelleParamsPanel.tsx is gone once the two halves exist; no third wrapper component remains."
    - "Multiplier band, multiplier fields, and the setAquarelleParam / setAquarelleMultiplier seams are unchanged; record-path snapshot still carries params + toolOverrides."
  artifacts:
    - app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx
    - app/src/components/physic-paint/view/BrushResponsePanel.tsx
    - app/src/components/physic-paint/view/WatercolorModuleSection.tsx
    - app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx
    - app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts
    - app/src/components/physic-paint/view/BrushResponsePanel.test.ts
    - app/src/components/physic-paint/view/AquarelleParamsPanel.test.tsx
    - app/src/components/physic-paint/view/panelSplitShell.test.tsx
  key_links:
    - "GLOBAL_ROWS labels and row order must match the playground SettingsPanel list minus Size and Hand (Water, Pigment, Flow, Bleed, Edges, Grain, Dry speed) — the keys stay water/load/flow/bleed/edge/granulation/dry."
    - "Reset values are playground DEFAULT_PARAMS (0..1) mapped onto the app slider scale (×100): water 60, load 50, flow 45, bleed 50, edge 50, granulation 45, dry 40 — written only through setAquarelleParam."
    - "PhysicsPaintRightPanel Brush-tab watercolor arm stops mounting WatercolorModuleSection and mounts BrushesDocker + BrushResponsePanel; the Paint-tab watercolor arm keeps WatercolorModuleSection (label + globals only)."
    - "RightPanelBrushTab.tsx (I-10 orphan, still typechecked) imports AquarelleParamsPanel today — its watercolor branch must be repointed at BrushesDocker + BrushResponsePanel when AquarelleParamsPanel.tsx is deleted or tsc breaks."
    - "panelSplitShell.test.tsx currently pins <AquarelleParamsPanel and <BrushesDocker inside WatercolorModuleSection; those pins die with this split and must be rewritten to the post-I-01/I-02 shape."
---

<objective>
Close locked issues I-01 and I-02 from `SPECS/v1.1.0-water-color/phase-55-issues/index.md`. Paint = watercolor globals only; Brush = picker + response.

**I-01 (param sliders single-home in Paint, playground labels, Reset):** the Paint tab owns the 7 watercolor globals. Rename the four mismatched labels to the playground copy (Load→Pigment, Edge→Edges, Granulation→Grain, Dry rate→Dry speed) and put the rows in playground order (Water, Pigment, Flow, Bleed, Edges, Grain, Dry speed). Keys stay `load` / `edge` / `granulation` / `dry` — label fix only. Add a Reset control after the 7 sliders (playground button-row affordance) that restores playground `DEFAULT_PARAMS` for those 7 keys via `setAquarelleParam`. Size stays top-bar only (Q1a). No Hand row (never build it). Paint tab content is the SectionLabel "Water color" + 7 sliders + Reset only — no brush list, no Brush response, no tools.

**I-02 (Brush response single-home in Brush tab):** split `AquarelleParamsPanel` in two (one file per visual unit). `AquarelleGlobalsPanel.tsx` = the 7 renamed sliders + Reset (Paint). `BrushResponsePanel.tsx` = the collapsible Brush response block (8 multipliers tip/aspect/rotation/sizeCurve/scatter/capacity/grain/wetRound + effective-value readout + the "Select a brush to edit response" placeholder). Brush tab renders the brush picker (BrushesDocker) plus BrushResponsePanel. Paint never renders BrushResponse. Delete `AquarelleParamsPanel.tsx` once both halves exist — no third wrapper.

Purpose: locked de-duplication pass — each control has one home (globals → Paint, response+picker → Brush).

Output: two atomic commits (I-01, then I-02), each UAT-able alone. Pin suites rewritten to the post-split contract.

Scope fence (locked):
- Do NOT touch I-03 (14-preset brush library + thumbs), I-04 Paper tab, I-08, I-10 adoption (only the RightPanelBrushTab compile fix required by the deletion).
- Do NOT touch the left rail, the top bar, SPECS/. Do NOT tick rows in the phase-55 index.
- Do NOT change the multiplier set, the multiplier band, or the param keys — labels and layout only.
- No new dependencies (viteBuild 2 MO ceiling). Preact + @preact/signals; no useState for selection state. `pnpm vitest run`, never watch. New tests are `*.test.ts` only. Local commits only, never push.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@CLAUDE.md

FIX CONTRACT (locked — already researched, do not re-derive):

## I-01 target row list (playground SettingsPanel oracle)

Playground `SLIDERS` (`SPECS/v1.1.0-water-color/watercolor-playground/src/components/SettingsPanel.tsx:7-16`) minus Size and Hand. Studio order and labels:

1. Water — key `water` (already correct)
2. Pigment — key `load` (label change)
3. Flow — key `flow` (already correct)
4. Bleed — key `bleed` (already correct)
5. Edges — key `edge` (label change)
6. Grain — key `granulation` (label change)
7. Dry speed — key `dry` (label change + row moves to last)

Today `GLOBAL_ROWS` in `AquarelleParamsPanel.tsx:33-41` is Water, Load, Flow, Bleed, Dry rate, Edge, Granulation — wrong labels AND wrong order (dry sits 5th). Rewrite the frozen row list to the 7 rows above. Do not add Size. Do not add Hand.

## Reset values (playground DEFAULT_PARAMS → app 0-100 slider scale)

Playground `DEFAULT_PARAMS` (`packages/efx-watercolor/src/playground/Engine.ts:22-23`, exported from `@efxlab/efx-watercolor`): size 0.5, water 0.6, load 0.5, flow 0.45, bleed 0.5, edge 0.5, granulation 0.45, dry 0.4.

App sliders run 0..100 (`GLOBAL_MIN`/`GLOBAL_MAX`) and `toEngineParams` divides by 100 — so Reset writes the ×100 image of those defaults for the 7 non-size keys via `setAquarelleParam`:

water 60, load 50, flow 45, bleed 50, edge 50, granulation 45, dry 40.

Reset must NOT write `size` (top-bar Brush size owns it, Q1a) and must NOT touch multipliers. One button after the 7 sliders, playground affordance (a single button row), `data-testid="aquarelle-params-reset"`, label text `Reset`. Prefer deriving the numbers from `DEFAULT_PARAMS` (import from `@efxlab/efx-watercolor`, scale ×100) over a second hardcoded table, so the playground remains the oracle.

Note: `DEFAULT_AQUARELLE_PARAMS` in `aquarelleRecordState.ts` is a flat 50 bag used for the live signal's initial value — it is NOT the Reset target. Do not "fix" that bag in this quick.

## I-02 file split (one file per visual unit)

- `AquarelleGlobalsPanel.tsx` (new): the 7 sliders + Reset. Owns `GLOBAL_ROWS` (renamed/reordered). Renders into `data-testid="aquarelle-globals-panel"`. Uses `aquarelleParams` + `setAquarelleParam` only.
- `BrushResponsePanel.tsx` (new): the collapsible "Brush response" block currently at `AquarelleParamsPanel.tsx:142-186` — toggle + 8 `MULTIPLIER_FIELDS` sliders + effective readout (`effectiveMultiplierValue`) + the `Select a brush to edit response` placeholder when `aquarelleSelectedTipId` is null. Keep the collapsed-by-default `brushResponseOpen` signal local to this file. Keep `data-testid="brush-response-toggle"` / `brush-response-placeholder` / `effective-*`. Uses `aquarelleToolOverrides` + `setAquarelleMultiplier` + `MULTIPLIER_*` exports from `aquarelleRecordState`.
- `AquarelleParamsPanel.tsx`: deleted at the end of Task 2. No re-export shim.

## Mount rewiring (PhysicsPaintRightPanel.tsx)

- Paint-tab watercolor arm (`effectiveToolTab === 'paint'`, ~:740): keeps `WatercolorModuleSection`, which becomes SectionLabel "Water color" + `AquarelleGlobalsPanel` only (BrushesDocker leaves).
- Brush-tab watercolor arm (`topPaneTab === 'brush'`, ~:529): stops mounting `WatercolorModuleSection`; mounts `BrushesDocker` + `BrushResponsePanel` (picker first, then response — matches the I-02 "picker plus response" wording).
- Brush-module arm (`BrushModuleSection`) on both tabs is untouched.

## Orphan compile fix (not I-10 adoption)

`RightPanelBrushTab.tsx` (unused, still in `tsconfig` include) imports `AquarelleParamsPanel` today. When that file is deleted, repoint its watercolor branch at `BrushesDocker` + `BrushResponsePanel` so tsc stays green. Do not adopt the orphan into `PhysicsPaintRightPanel` (I-10 owns that later).

## Existing tests that must be updated (not deleted)

- `AquarelleParamsPanel.test.tsx` (+ its `.test.tsx.test.ts` launcher): the label pins (`Load` / `Dry rate` / `Edge` / `Granulation`) and the "Brush response lives in this panel" cases die. Retarget the globals cases at the new label list / order and at `AquarelleGlobalsPanel`; move the response cases to the new `BrushResponsePanel.test.ts`. The record-path commit cases (payload params + toolOverrides) stay — they exercise `aquarelleRecordState`, not the panel DOM.
- `panelSplitShell.test.tsx`: the I-06 pins `expect(source).toMatch(/<AquarelleParamsPanel\b/)` and `/<BrushesDocker\b/` inside `WatercolorModuleSection` die. Rewrite to the post-split shape (section mounts `AquarelleGlobalsPanel`, does not mount `BrushesDocker` or `BrushResponsePanel`). The "no Brush param bag / no PaintModeSelector / Water color label" cases stay green as-is.
- `AquarelleToolRow.test.tsx`: only its comment mentions the old panel name; the materialized `WatercolorModuleSection` cases still pass if the section keeps its SectionLabel. Update any assertion that matches the old `Dry rate` string if present in walked labels.

## New pins (`.test.ts` only — vitest collects `src/**/*.test.ts`)

- `AquarelleGlobalsPanel.test.ts`: 7 labels in playground order; no Size; Reset present; Reset click writes the ×100 defaults through `setAquarelleParam` for the 7 keys and leaves `size` untouched (stub/spy the seam or set `aquarelleParams` then invoke the handler).
- `BrushResponsePanel.test.ts`: placeholder when no tip; toggle reveals the 8 multiplier rows when a tip is selected; multiplier band still 0.5–2.0; effective readout formula unchanged.

## Verify command (inherit — worked on 261017-w4x)

`pnpm --filter efx-motion-editor exec vitest run <paths relative to app/>` from the checkout root. Vitest collects only `*.test.ts` — `.test.tsx` suites go through their `.test.tsx.test.ts` launchers.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: I-01 — watercolor globals single-home in Paint (playground labels + Reset)</name>
  <files>app/src/components/physic-paint/view/AquarelleParamsPanel.tsx, app/src/components/physic-paint/view/WatercolorModuleSection.tsx, app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx, app/src/components/physic-paint/view/AquarelleParamsPanel.test.tsx, app/src/components/physic-paint/view/panelSplitShell.test.tsx</files>
  <behavior>
    - GLOBAL_ROWS is exactly Water/water, Pigment/load, Flow/flow, Bleed/bleed, Edges/edge, Grain/granulation, Dry speed/dry in that order.
    - A Reset control renders after the 7 sliders; activating it writes water 60, load 50, flow 45, bleed 50, edge 50, granulation 45, dry 40 via setAquarelleParam and never writes size.
    - WatercolorModuleSection tree contains the section label and the 7 slider rows plus Reset; it does not contain a brush list or the Brush response block.
    - The Brush-tab watercolor arm no longer mounts WatercolorModuleSection; it mounts BrushesDocker so the picker stays reachable in this commit.
  </behavior>
  <action>I-01 per the locked Paint-tab list (Water, Pigment, Flow, Bleed, Edges, Grain, Dry speed + Reset; no Size, no Hand): (1) rewrite `AquarelleParamsPanel.test.tsx` globals cases to the new label list/order, add a Reset-behavior case (after a non-default write, Reset restores the playground ×100 defaults through `setAquarelleParam` and leaves `aquarelleParams.size` alone), and drop or park the Brush-response describe block so it no longer pins that block inside this panel — run and confirm the failures are exactly the old labels, the missing Reset, and the still-present response block. (2) In `AquarelleParamsPanel.tsx` rewrite `GLOBAL_ROWS` to the seven playground rows (labels Water/Pigment/Flow/Bleed/Edges/Grain/Dry speed, keys water/load/flow/bleed/edge/granulation/dry), add the Reset button after the slider map (data-testid `aquarelle-params-reset`, label `Reset`, playground single-button affordance), deriving the write values from `DEFAULT_PARAMS` imported from `@efxlab/efx-watercolor` scaled to the 0-100 slider band and calling `setAquarelleParam` once per non-size key — never write size. Remove the Brush response block (toggle, placeholder, multiplier rows) from this panel's render; leave `MULTIPLIER_*` / `setAquarelleMultiplier` exports in `aquarelleRecordState.ts` untouched. (3) In `WatercolorModuleSection.tsx` drop the `BrushesDocker` mount so the section is SectionLabel "Water color" + the params panel only. In `PhysicsPaintRightPanel.tsx` change the Brush-tab watercolor arm to mount `BrushesDocker` instead of `WatercolorModuleSection` (picker stays available this commit; response arrives in Task 2). (4) Rewrite the `panelSplitShell.test.tsx` I-06 pins that expect `BrushesDocker` inside the module section to the post-I-01 shape (section has the params panel, not the docker). Preact + @preact/signals only — no useState for selection. Do not touch the left rail, the top bar, I-03/I-04 surfaces, SPECS/, or package manifests. Run the suites to green and commit once as `feat(261017-wmw): I-01 watercolor params paint-only with playground labels and reset`.</action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/AquarelleParamsPanel.test.tsx.test.ts src/components/physic-paint/view/panelSplitShell.test.tsx.test.ts src/components/physic-paint/view/AquarelleToolRow.test.tsx.test.ts</automated>
  </verify>
  <done>All three suites green. GLOBAL_ROWS is the seven playground rows in order with the renamed labels and unchanged keys. Reset is present and writes only the seven non-size globals at the playground defaults on the 0-100 band. WatercolorModuleSection has no BrushesDocker mount and no Brush response block. The Brush-tab watercolor arm mounts BrushesDocker, not WatercolorModuleSection. One atomic commit. No SPECS/ diff, no package.json / vitest.config diff, no left-rail / top-bar diff.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: I-02 — split panels; Brush response single-home in the Brush tab</name>
  <files>app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx, app/src/components/physic-paint/view/BrushResponsePanel.tsx, app/src/components/physic-paint/view/WatercolorModuleSection.tsx, app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx, app/src/components/physic-paint/view/RightPanelBrushTab.tsx, app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts, app/src/components/physic-paint/view/BrushResponsePanel.test.ts, app/src/components/physic-paint/view/panelSplitShell.test.tsx</files>
  <behavior>
    - AquarelleGlobalsPanel renders the 7 renamed sliders + Reset (the Paint tab content) and nothing else.
    - BrushResponsePanel renders the Brush response toggle, the Select-a-brush placeholder when no tip is selected, and the 8 multiplier rows with effective-value readout when a tip is selected and the block is open.
    - WatercolorModuleSection mounts AquarelleGlobalsPanel, not BrushResponsePanel and not BrushesDocker.
    - The Brush-tab watercolor arm mounts BrushesDocker then BrushResponsePanel.
    - AquarelleParamsPanel.tsx does not exist; no wrapper re-exports it.
  </behavior>
  <action>I-02 per the locked Brush-tab target (picker + per-brush response editors) and the one-file-per-visual-unit rule: (1) add `AquarelleGlobalsPanel.test.ts` and `BrushResponsePanel.test.ts` covering the behavior list (globals panel = 7 rows + Reset and no response chrome; response panel = placeholder vs 8 multiplier rows + effective readout; multiplier band unchanged) and rewrite the `panelSplitShell.test.tsx` module-section pins to `AquarelleGlobalsPanel` — run and confirm the new files fail because the components do not exist yet. (2) Create `AquarelleGlobalsPanel.tsx` by moving the globals+Reset half out of `AquarelleParamsPanel.tsx` (same SliderStepper rows, same `setAquarelleParam` seam, `data-testid="aquarelle-globals-panel"`). Create `BrushResponsePanel.tsx` with the Brush response half (toggle + `MULTIPLIER_FIELDS` sliders + `effectiveMultiplierValue` readout + the no-tip placeholder; keep `data-testid` names `brush-response-toggle` / `brush-response-placeholder` / `effective-*`; keep `setAquarelleMultiplier` and the existing band). (3) Point `WatercolorModuleSection.tsx` at `AquarelleGlobalsPanel` only. Point the Brush-tab watercolor arm in `PhysicsPaintRightPanel.tsx` at `BrushesDocker` + `BrushResponsePanel` (picker first). (4) Delete `AquarelleParamsPanel.tsx` and repoint `RightPanelBrushTab.tsx`'s watercolor branch at `BrushesDocker` + `BrushResponsePanel` so the orphan still typechecks (compile fix only — do not adopt the orphan, that is I-10). Do not touch `aquarelleRecordState.ts` multiplier exports, the left rail, the top bar, I-03/I-04 surfaces, SPECS/, or package manifests. Run the suites to green and commit once as `refactor(261017-wmw): I-02 split brush response into the Brush tab`.</action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts src/components/physic-paint/view/BrushResponsePanel.test.ts src/components/physic-paint/view/panelSplitShell.test.tsx.test.ts src/components/physic-paint/view/AquarelleParamsPanel.test.tsx.test.ts</automated>
  </verify>
  <done>All four suites green. Paint watercolor surface is SectionLabel + AquarelleGlobalsPanel only. Brush watercolor surface is BrushesDocker + BrushResponsePanel. The response placeholder and the 8 multiplier rows with effective readout behave as before on the same seams. AquarelleParamsPanel.tsx is deleted and nothing re-exports it. RightPanelBrushTab.tsx still typechecks. One atomic commit. No SPECS/ diff, no package.json / vitest.config diff.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| UI control → aquarelleParams / aquarelleToolOverrides | Sliders and Reset write local Studio paint state through existing seams (no new external input, no package installs) |

## STRIDE Threat Register

Threat IDs are unique within this quick; no prior PLAN files exist in this directory (T-261017-WMW-SC is reserved and kept).

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261017-WMW-01 | Integrity | Reset handler in `AquarelleGlobalsPanel.tsx` — a Reset that also writes `size` would clobber the top-bar Brush size (Q1a) | high | mitigate | Reset writes only the 7 non-size keys via `setAquarelleParam`; pin asserts `aquarelleParams.size` is unchanged after Reset and that the handler never calls the seam with key `size` |
| T-261017-WMW-02 | Integrity | Label rewrite could silently change param keys (`load`/`edge`/`granulation`/`dry`) and corrupt recorded payloads | high | mitigate | Keys are byte-identical in `GLOBAL_ROWS`; record-path pins in `AquarelleParamsPanel.test.tsx` still assert `payload.params['water']` / `toolOverrides` shapes; only the label strings change |
| T-261017-WMW-03 | Availability | Deleting `AquarelleParamsPanel.tsx` could strand importers (`RightPanelBrushTab.tsx` orphan) and break tsc | medium | mitigate | Repoint the orphan's watercolor branch in the same commit as the deletion; verify runs the panel suites that pull the new modules, and the orphan stays un-adopted (I-10) |
| T-261017-WMW-SC | Tampering | npm/pip/cargo installs | high | mitigate | No package installs in this plan — zero install surface, so no legitimacy checkpoint is required |

</threat_model>

<verification>
- I-01 contract: `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/AquarelleParamsPanel.test.tsx.test.ts src/components/physic-paint/view/panelSplitShell.test.tsx.test.ts src/components/physic-paint/view/AquarelleToolRow.test.tsx.test.ts` — playground label list/order, Reset writes the 7 non-size defaults, Paint section has no brush list and no response block, Brush tab keeps the picker.
- I-02 contract: `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts src/components/physic-paint/view/BrushResponsePanel.test.ts src/components/physic-paint/view/panelSplitShell.test.tsx.test.ts src/components/physic-paint/view/AquarelleParamsPanel.test.tsx.test.ts` — two panels, response only in the Brush tab, `AquarelleParamsPanel.tsx` gone.
- Guardrail audit: `git diff SPECS/` empty; `git diff app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx` empty; `git diff app/package.json app/vitest.config.ts` empty; `git diff packages/efx-watercolor/src/playground/` empty; `aquarelleRecordState.ts` multiplier exports unchanged.
- Two atomic commits (I-01, then I-02), each independently UAT-able. Status stays automated-ready until the user judges the live UAT rows (no server started by the executor).
</verification>

<success_criteria>
- Paint tab (watercolor) top-to-bottom: "Water color" label, then Water / Pigment / Flow / Bleed / Edges / Grain / Dry speed, then Reset. No Size, no Hand, no brush list, no Brush response, no tools.
- Reset restores water 60, load 50, flow 45, bleed 50, edge 50, granulation 45, dry 40 and leaves the top-bar size alone.
- Brush tab (watercolor) shows the brush picker plus the Brush response block (8 multipliers, collapsed by default, placeholder when no brush is selected, effective readout per row).
- Param keys and the multiplier set are unchanged; recorded strokes still carry params + toolOverrides.
- `AquarelleParamsPanel.tsx` deleted; `AquarelleGlobalsPanel.tsx` + `BrushResponsePanel.tsx` exist; no third wrapper.
- No SPECS/ edits; no left-rail / top-bar diff; no new dependencies; no vitest config change.
- Two atomic commits (I-01, then I-02).
- Live UAT (user-run, recorded in the SUMMARY):
  1. Open Water color → Paint tab: 7 sliders with the new labels in playground order + Reset. No brush list, no BRUSH RESPONSE block.
  2. Move Pigment / Edges / Grain / Dry speed → the stroke responds (keys load/edge/granulation/dry still drive the engine). Click Reset → the 7 sliders jump to 60/50/45/50/50/45/40 and the top-bar Brush size does not move.
  3. Open the Brush tab: brush picker on top, Brush response under it. With no brush selected the placeholder shows; select a brush and open the response → 8 multipliers with effective values edit that brush.
  4. Paint tab never shows the response block; Brush tab never shows the 7 global sliders. Console clean.
</success_criteria>

<output>
Create `.planning/quick/261017-wmw-i-01-i-02-paint-watercolor-params-brush-/261017-wmw-SUMMARY.md` when done (`status: complete` in SUMMARY frontmatter). Record the live UAT rows in the SUMMARY — do not claim done before UAT.
</output>
