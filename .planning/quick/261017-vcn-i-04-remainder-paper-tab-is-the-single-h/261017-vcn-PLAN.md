---
phase: quick-261017-vcn
plan: 261017-vcn
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/physic-paint/view/PaperPicker.tsx
  - app/src/components/physic-paint/view/PaperPicker.test.tsx
  - app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx
  - app/src/components/physic-paint/view/PhysicsPaintTopBar.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx
  - app/src/components/physic-paint/view/physicsPaintRightPanelPaperSingleHome.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
autonomous: true
requirements:
  - I-04

estimate:
  tokens: 48000
  raw_tokens: 32000
  tasks: 2
  confidence: med

must_haves:
  truths:
    - "The Paper tab is the single home for paper + background: Grain strength + Grain scale sit at the TOP of the tab (Q6), then the Transparent + White background arms, then the 13-cell paper grid. Names stay Grain strength + Grain scale."
    - "The PaperPicker bottom Strength/Scale SliderStepper pair is gone — one grain control pair only, and it is the former top-bar widget pair (segmented None/Soft/Med/Hard + grainScaleStep freeEntry SliderStepper)."
    - "Transparent and White stay selectable from the Paper tab (locked Paper-background decision) and route through the existing background change path (setBackground + setBackgroundFallback). A paper cell still routes through the paper-id path."
    - "One grain change writes BOTH the paper-display record and the document fallback / track metadata: physicPaintStore.setPaperStrength|setPaperScale + setGrainStrength|setGrainScale + setRotoBackgroundMetadata + setBackgroundFallback, same turn."
    - "The top bar keeps status pill + ModuleSwitcher + Brush size + Opacity in one row; its Background / Grain strength / Grain scale rows and those props are gone."
    - "physicsPaintRightPanelPaperSingleHome.test.ts stays green (exactly one PaperPicker mount, in the Paper tab). The 13-cell grid (CELL_SIZE=64, GRID_GAP=8, 3 columns, Procedural then Real) is untouched."
  artifacts:
    - app/src/components/physic-paint/view/PaperPicker.tsx
    - app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx
    - app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/view/physicsPaintRightPanelPaperSingleHome.test.ts
    - app/src/components/physic-paint/view/PaperPicker.test.tsx
  key_links:
    - "PaperPicker.tsx becomes the whole Paper-tab content: grain pair at top, Transparent+White arms, then the locked grid; the D-10 bottom pair leaves."
    - "PhysicsPaintStudio.tsx handleGrainStrengthChange / handleGrainScaleChange absorb the paper-display write-through (setPaperStrength / setPaperScale) and replace the paper-only handlers; topBarPropsMemo and rightPanelPropsMemo rewire."
    - "PhysicsPaintTopBar.tsx drops background/grainStrength/grainScale/onBackgroundChange/onGrainStrengthChange/onGrainScaleChange; grainScaleStep moves with the grain widget to PaperPicker.tsx."
    - "PhysicsPaintRightPanel.tsx paper-tab branch passes grain + background ports into the single PaperPicker mount; the Paint shared block is not touched (I-05/I-06 fence)."
---

<objective>
Finish issue I-04 (SPECS/v1.1.0-water-color/phase-55-issues/index.md) — the remainder after quick 261017-fz3 already removed the Paint-tab PaperPicker mount (bf547f76). Three locked moves:

1. **Q6 — grain widgets move into the Paper tab, at the TOP, before the paper grid.** Names stay `Grain strength` + `Grain scale`. These are the current top-bar widgets (segmented None/Soft/Med/Hard + SliderStepper with `grainScaleStep` + `freeEntry`). The PaperPicker bottom `Strength`/`Scale` pair (D-10) is the same state (`settings.grainStrength`/`settings.grainScale`) and becomes a second home — remove it so one pair survives.
2. **Transparent + White arms join the Paper tab** (locked Paper-background decision). They are background, not papers. They sit between the grain controls and the paper grid, reuse the top-bar swatch look (Transparent = checkerboard `repeating-conic-gradient`, White = `#fff`), and call the existing background-change path. A paper cell keeps the paper-id path. The 13-cell grid is UI-SPEC locked.
3. **Top-bar Background + Grain strength + Grain scale rows go away.** Top bar keeps status pill + ModuleSwitcher + Brush size + Opacity (one row). `PhysicsPaintTopBarProps` drops `background` / `grainStrength` / `grainScale` / `onBackgroundChange` / `onGrainStrengthChange` / `onGrainScaleChange`.

The surviving grain pair must write BOTH write-throughs (paper-display record AND document fallback / track metadata) — today the top-bar handlers and the PaperPicker handlers diverge.

Purpose: locked I-04 remainder; the Paint mount is already gone. No research — the three moves and the handler bodies are specified below.

Output: Paper tab owns paper + background; top bar slim; one grain pair with the combined write-through. Pin tests + existing-test updates. Two atomic commits (RED, then GREEN). Live UAT is the user's.

Scope fence (locked):
- Do NOT touch I-05 (Opacity row in the Paint tab), I-06 (tools row), I-01/I-02 (params/response split).
- Do NOT change the 13-cell grid: CELL_SIZE=64, GRID_GAP=8, 3 columns, Procedural then Real (UI-SPEC).
- Do NOT change Q5a (`paper/real-*` → cold preset fallback) or the aquarelle bake / cache fingerprint (261017-fz3).
- Do NOT change the grain default (`settings.grainStrength: 0.45`) — checklist Row 11 is a separate item.
- Do NOT edit SPECS/. Do NOT tick rows in the phase-55 index — the orchestrator does that after UAT.
- No new dependencies (viteBuild 2 MO ceiling). Preact + @preact/signals; no useState for selection state. `pnpm vitest run`, never watch. Local commits only, never push.
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

## State and handlers (PhysicsPaintStudio.tsx)

`settings.grainStrength` / `settings.grainScale` are the single grain state. Two handler pairs currently write it differently:

- `handleGrainStrengthChange` / `handleGrainScaleChange` (~:1436-1460): `setGrainStrength`/`setGrainScale` + `physicPaintStore.setRotoBackgroundMetadata` + `setBackgroundFallback` via `backgroundModeToFallback`.
- `handlePaperStrengthChange` / `handlePaperScaleChange` (~:1469-1478): `physicPaintStore.setPaperStrength`/`setPaperScale` + `setGrainStrength`/`setGrainScale`.

**One surviving pair must write BOTH write-throughs** so the paper-display record and the document fallback / track metadata stay in sync. Fold the paper-display store writes into `handleGrainStrengthChange` / `handleGrainScaleChange`, then drop the paper-only pair. Keep the existing `handleBackgroundChange` for Transparent/White (`setBackground` + `setBackgroundFallback`; `photo` still excluded from the fallback write-through). Keep `handlePaperIdChange` for grid cells.

## Paper tab layout (PaperPicker.tsx)

Order inside the Paper tab (top to bottom):

1. **Grain strength** segmented row (None / Soft / Med / Hard → 0 / 0.35 / 0.65 / 0.95) + **Grain scale** SliderStepper (`grainScaleStep` + `freeEntry`, `GRAIN_SCALE_MIN`/`GRAIN_SCALE_MAX`) — the former top-bar widgets, same look (`physics-paint-segmented-row` / `physics-paint-segmented-button`).
2. **Transparent + White** swatch buttons — port the top-bar swatch look (`physics-paint-swatch-button` + `physics-paint-paper-swatch`; Transparent `repeating-conic-gradient(#777 0% 25%, #d8d8d8 0% 50%) 0 0 / 8px 8px`, White `#fff`). Selecting one calls `onBackgroundChange('transparent' | 'white')`.
3. **13-cell grid** unchanged (Procedural then Real, `CELL_SIZE=64`, `GRID_GAP=8`, 3 columns). Cell click keeps `onPaperIdChange`.

The bottom `Strength`/`Scale` SliderStepper pair (`data-paper-picker-sliders`, ids `paper-strength`/`paper-scale`) leaves. Move `grainScaleStep` from `PhysicsPaintTopBar.tsx` to `PaperPicker.tsx` (keep it exported — the step law is unchanged).

PaperPicker props become: `paperId`, `background`, `grainStrength`, `grainScale`, `onPaperIdChange`, `onBackgroundChange`, `onGrainStrengthChange`, `onGrainScaleChange`, `disabled?`. Use `StudioBackgroundMode` from `engine/physicsPaintStudioSettings` for the background port (same type `handleBackgroundChange` takes). Drop the old strength/scale props.

## Top bar (PhysicsPaintTopBar.tsx)

Keep: status pill, `ModuleSwitcher`, Brush size, Opacity. Drop the Background / Grain strength / Grain scale blocks and the matching `PhysicsPaintTopBarProps` fields. Drop now-unused imports (`BACKGROUND_OPTIONS`, `GRAIN_STRENGTH_OPTIONS`, `GRAIN_SCALE_*`, `grainScaleStep`, `PAPER_TEXTURES` if unused). `TopBarBackgroundMode` can go if nothing else needs it.

## Wiring (PhysicsPaintRightPanel.tsx + PhysicsPaintStudio.tsx)

- `PhysicsPaintRightPanel` paper-tab branch passes `background` / `grainStrength` / `grainScale` / `onBackgroundChange` / `onGrainStrengthChange` / `onGrainScaleChange` into the single `PaperPicker` mount. Extend `PhysicsPaintRightPanelProps` accordingly; replace the old paper strength/scale ports with the grain pair (or alias them to the grain handlers — one pair only).
- `topBarPropsMemo` (~:3579) drops background/grain deps and props.
- `rightPanelPropsMemo` (~:3705) feeds the grain pair + background ports; paper-only handler names leave the memo dep list and the resolve body.
- Keep `physicsPaintRightPanelPaperSingleHome.test.ts` green (one `<PaperPicker` mount, under `topPaneTab === 'paper'`, shared block still has `shared-opacity`).

## Existing tests that must be updated (not deleted)

- `PaperPicker.test.tsx`: the D-10 bottom-pair assertion becomes the new order assertion (grain → Transparent/White → grid, no bottom pair). Keep the 13-cell / Procedural-Real / raw-tile pins.
- `PhysicsPaintTopBar.test.ts`: `baseTopBarProps` slims to brush/opacity/ready; the grain-scale stepper / step-law / grain-button tests move to `PaperPicker.test.tsx` (import `grainScaleStep` from `./PaperPicker`). The topBar-memo `settings.grainScale` expectation flips: that dep belongs on the rightPanel memo now (update the `PhysicsPaintStudio.test.ts` topBar-deps pin around :1409 to the new dep list).
- `PhysicsPaintStudio.test.ts`: the `handleGrainScaleChange` write-through pin stays, extended with the paper-display store write; the topBar deps string pin follows the new memo.

## New pins (extend physicsPaintRightPanelPaperSingleHome.test.ts)

1. PaperPicker source/render: grain pair labels sit before the Procedural group; Transparent + White sit between grain and the grid; the former bottom pair is absent.
2. PhysicsPaintTopBar source: the Background / Grain strength / Grain scale rows are absent and the props interface has no those fields; Brush size + Opacity remain.
3. PhysicsPaintStudio source: the surviving grain handlers each contain the paper-display store write, the settings write, `setRotoBackgroundMetadata`, and `setBackgroundFallback`; the paper-only strength/scale handlers are gone (one pair).
</context>

<tasks>

<task type="auto">
  <name>Task 1: RED — pin the Paper-tab single-home contract</name>
  <files>app/src/components/physic-paint/view/physicsPaintRightPanelPaperSingleHome.test.ts, app/src/components/physic-paint/view/PaperPicker.test.tsx, app/src/components/physic-paint/view/PhysicsPaintTopBar.test.ts, app/src/components/physic-paint/PhysicsPaintStudio.test.ts</files>
  <action>Add failing pin assertions first (project idiom: source-scan + vnode materialize, same as 261017-fz3). Extend `physicsPaintRightPanelPaperSingleHome.test.ts` with the three pins listed in the context (Paper-tab order, top-bar slim, combined grain write-through). Adjust `PaperPicker.test.tsx` / `PhysicsPaintTopBar.test.ts` / `PhysicsPaintStudio.test.ts` expectations to the post-move contract so the suite fails only on the missing implementation (not on stale assertions). Run the suite — it must fail on the new pins. Commit as `test(261017-vcn): pin I-04 remainder paper-tab single home`.</action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/physicsPaintRightPanelPaperSingleHome.test.ts src/components/physic-paint/view/PaperPicker.test.tsx.test.ts src/components/physic-paint/view/PhysicsPaintTopBar.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts</automated>
  </verify>
  <done>New pins fail for the right reason (grain pair still in the top bar / bottom pair still present / combined write-through missing). Existing single-home pin still passes. Vitest collects only `*.test.ts` — PaperPicker goes through its `PaperPicker.test.tsx.test.ts` launcher.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: GREEN — grain + Transparent/White into the Paper tab, slim the top bar, one write-through pair</name>
  <files>app/src/components/physic-paint/view/PaperPicker.tsx, app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx, app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx, app/src/components/physic-paint/PhysicsPaintStudio.tsx</files>
  <behavior>
    - PaperPicker renders Grain strength + Grain scale first, then Transparent + White, then the locked 13-cell grid; the former bottom pair is not rendered.
    - A grain-strength segment click and a grain-scale change each invoke their PaperPicker prop once.
    - A Transparent / White swatch click invokes onBackgroundChange with that mode; a paper cell click invokes onPaperIdChange with the cell id (paths stay separate).
    - handleGrainStrengthChange / handleGrainScaleChange each write: setGrain* + physicPaintStore.setPaper* + setRotoBackgroundMetadata + setBackgroundFallback (no engine visible-background call).
    - PhysicsPaintTopBar renders Brush size + Opacity only among the former top-bar controls.
  </behavior>
  <action>Implement the three locked moves exactly as specified in the context (per Q6 and the Paper-background locked decision): (1) move the top-bar grain widgets to the TOP of the Paper tab and delete the picker's bottom pair — one control pair, `grainScaleStep` moves with the grain widget; (2) add Transparent + White between grain and the grid, reusing the top-bar swatch look, wired to the existing background-change path while paper cells keep the paper-id path; (3) remove the top-bar Background / Grain rows and drop those props. In `PhysicsPaintStudio.tsx`, fold the paper-display store writes into the surviving grain handlers so each change hits settings + paper-display record + track metadata + document fallback in one turn, then remove the paper-only handlers and rewire `topBarPropsMemo` / `rightPanelPropsMemo`. Using Preact + @preact/signals only — no useState for selection. Leave the Paint shared block, the 13-cell grid constants, Q5a, and SPECS/ untouched. Run the Task 1 suite to green, then commit as `feat(261017-vcn): make the Paper tab the single paper+background home`.</action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/physicsPaintRightPanelPaperSingleHome.test.ts src/components/physic-paint/view/PaperPicker.test.tsx.test.ts src/components/physic-paint/view/PhysicsPaintTopBar.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts</automated>
  </verify>
  <done>All four suites green. Paper tab order is grain → Transparent/White → grid. Top bar shows status + ModuleSwitcher + Brush size + Opacity. One grain pair, and each grain change performs the combined write-through. `physicsPaintRightPanelPaperSingleHome.test.ts` still pins exactly one PaperPicker mount in the Paper tab. No SPECS/ diff.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| UI control → studio settings / physicPaintStore | Grain and background clicks write document state (no new external input, no package installs) |

## STRIDE Threat Register

Threat IDs are unique within this quick; no prior PLAN files exist in this directory (T-261017-VCN-SC is reserved and kept).

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261017-VCN-01 | Integrity | Unified grain write-through in `PhysicsPaintStudio.tsx` — a half write leaves the paper-display record and the document fallback disagreeing | high | mitigate | Pin the surviving grain handlers for all four writes (settings + `setPaper*` + `setRotoBackgroundMetadata` + `setBackgroundFallback`) and for a single surviving pair; implementation folds the paper-display store write into the grain handlers before deleting the paper-only pair |
| T-261017-VCN-02 | Tampering | Deleting the wrong grain pair (top-bar widgets instead of the picker's D-10 pair) would strand grain controls | medium | mitigate | Q6 pins the surviving pair as the former top-bar widgets at the TOP of the Paper tab; order pin is grain → Transparent/White → grid and the bottom pair is asserted absent |
| T-261017-VCN-03 | Availability | Dropping Transparent/White would remove the only non-paper background arms | medium | mitigate | Locked Paper-background decision pins both arms between grain and grid, wired to the existing background-change path; swatch look matches the retired top-bar row |
| T-261017-VCN-SC | Tampering | npm/pip/cargo installs | high | mitigate | No package installs in this plan — zero install surface, so no legitimacy checkpoint is required |

</threat_model>

<verification>
- Single-home contract: `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/physicsPaintRightPanelPaperSingleHome.test.ts` — one PaperPicker mount, in the Paper tab; new order + top-bar slim + combined write-through pins green.
- Paper-tab UI contract: `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PaperPicker.test.tsx.test.ts` — grain pair first, Transparent+White next, locked 13-cell grid, no bottom pair; grainScaleStep law unchanged.
- Top bar + studio wiring: `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PhysicsPaintTopBar.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts` — Brush size + Opacity remain; memo dep pins follow the new split (grain on the rightPanel memo).
- Guardrail audit: `git diff SPECS/` empty; `git diff packages/efx-watercolor/src/playground/` empty; `git diff app/package.json app/vitest.config.ts` empty; Paint shared block / I-05 Opacity row untouched.
- Status stays automated-ready until the user judges the live UAT rows (no server started by the executor).
</verification>

<success_criteria>
- Paper tab top-to-bottom: Grain strength + Grain scale, then Transparent + White, then the 13-cell Procedural/Real grid (CELL_SIZE=64, GRID_GAP=8, 3 columns).
- One grain control pair only; each change writes settings + paper-display record + track metadata + document fallback in the same turn.
- Transparent and White select through the existing background-change path; paper cells keep the paper-id path.
- Top bar = status pill + ModuleSwitcher + Brush size + Opacity; Background / Grain rows and those props are gone.
- `physicsPaintRightPanelPaperSingleHome.test.ts` still green; Q5a and the 13-cell grid constants untouched; no SPECS/ edits; no new dependencies.
- Two atomic commits (RED pin, then GREEN implementation).
- Live UAT (user-run, recorded in the SUMMARY):
  1. Open Water color → Paper tab: grain controls at the top, Transparent + White below them, paper grid below that. No Strength/Scale pair under the grid.
  2. Top bar shows only status + module switcher + Brush size + Opacity.
  3. Click Transparent → canvas fond goes checkerboard/transparent; click White → white fond; click a paper cell → that paper's fond. Each choice survives a reopen.
  4. Grain strength None/Soft/Med/Hard and Grain scale (+/− and free entry) change the visible paper tooth; save → reopen keeps both values (paper-display record and fallback agree).
  5. Paint tab still shows Opacity and no paper grid (261017-fz3 behaviour stays). Console clean.
</success_criteria>

<output>
Create `.planning/quick/261017-vcn-i-04-remainder-paper-tab-is-the-single-h/261017-vcn-SUMMARY.md` when done (`status: complete` in SUMMARY frontmatter). Record the live UAT rows in the SUMMARY — do not claim done before UAT.
</output>
