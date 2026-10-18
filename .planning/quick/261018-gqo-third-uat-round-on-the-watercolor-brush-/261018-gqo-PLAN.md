---
phase: quick-261018-gqo
plan: 261018-gqo
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/physic-paint/view/PaperPicker.tsx
  - app/src/components/physic-paint/view/PaperPicker.test.tsx
  - app/src/components/physic-paint/view/paperThumb.ts
  - app/src/components/physic-paint/view/paperThumb.test.ts
  - app/src/components/physic-paint/physicsPaintStudio.css
  - app/src/components/physic-paint/view/BrushModuleSection.tsx
  - app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx
  - app/src/components/physic-paint/view/BrushResponsePanel.tsx
  - app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx
  - app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx
  - app/src/components/physic-paint/view/PhysicsPaintTopBar.test.ts
autonomous: true
requirements:
  - M1-72
  - M2-74
  - M3-75
  - M4-BORDER
  - M5-77
  - PAPER-04

estimate:
  tokens: 32000
  raw_tokens: 18000
  tasks: 3
  confidence: med

must_haves:
  truths:
    - "Paper cards are large landscape thumbs (~2:1, oracle SWATCH 112x64) in 2 columns, name BELOW in small uppercase — matching the watercolor-playground TEXTURE picker, not 64x64 squares."
    - "The Paper tab's named paper catalog is the oracle's ten papers (COLD PRESS, HOT PRESS, ROUGH, KHADI, WASHI, LAID, CANVAS, TONED SAND, KRAFT, STUDENT) with live texture thumbs; no cell reads as a PAPER 1 / PAPER 2 placeholder."
    - "Real scans (PAPER-04 paper_1/2/3.jpg) stay in the library as scan cells with the same large-card chrome and real jpg texture; Transparent + White stay as background arms."
    - "The oracle's paper-strength Texture control is present (grainStrength -> engine.paperTexture); Grain scale remains the scale control."
    - "Titles, section blocks, and slider rows have consistent vertical breathing room across Paper / Paint / Brush tabs (TEXTURE no longer crammed into its chips; Shape detail / Blending / Spread are not a zero-gap stack)."
    - "Watercolor brush card thumbs use a light gray border (not the dark #2a3340 sidebar border)."
    - "Top bar: Engine ready stays pinned left; Modes (Brush / Water color / Krita) + Brush size + Opacity (+ Water / Edges / Grain in watercolor) form ONE centered group with no overlap at the current window width."
  artifacts:
    - app/src/components/physic-paint/view/PaperPicker.tsx
    - app/src/components/physic-paint/view/paperThumb.ts
    - app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx
    - app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx
    - app/src/components/physic-paint/physicsPaintStudio.css
  key_links:
    - "paperThumb getPaperThumb(id, w, h) already paints sheet+wash / real jpg — larger cells must reuse it (cache key includes size); never toDataURL, never repaint per render."
    - "Named paper data comes from vendored @efxlab/efx-watercolor PAPER_LIBRARY / PAPER_PRESETS (the ten oracle papers already present) — do not invent names; SPECS/ is read-only."
    - "grainStrength already feeds engine.paperTexture via the adapter — the Texture control is that seam, never a second strength store."
    - "Top-bar cluster keeps the existing write-through pair (setAquarelleParam size/load vs setBrushSize/setBrushOpacity); only the DOM grouping changes."
    - "Pin suites move in the same commits as the behavior (PaperPicker CELL_SIZE pin retargets with move 1; top-bar centering pins retarget with move 5)."
---

<objective>
Close the third UAT round (images 72–77) on the watercolor/brush Studio UI. Directed visual fixes only — ride existing machinery, no new dependencies, no SPECS/ edits.

Five moves, each landing as its own atomic commit so the user can UAT independently:

1. **Paper thumbs large landscape (72 vs 73)** — oracle TEXTURE picker geometry: wide ~2:1 cards (112x64), 2 columns, name BELOW in small uppercase.
2. **Spacing / padding pass (74, 76)** — consistent vertical rhythm for titles, section blocks, slider rows on Paper / Paint / Brush tabs.
3. **Paper texture data (75)** — named catalog is the oracle's ten papers with real texture; no PAPER 1 / PAPER 2 placeholder cells; check the oracle Texture strength control.
4. **Brush thumb border** — dark border to light gray on watercolor brush cards.
5. **Top bar responsive (77)** — Modes + settings as ONE centered group between "Engine ready" (left) and the window edge; no overlap.

Purpose: match the UAT screenshots without reopening I-01..I-10 / PAPER-01..04 contracts.
Output: five local commits (one per move), pin suites green after each.

Scope fence (locked):
- Do NOT edit `SPECS/`. The oracle is read-only. Port geometry/data app-side only.
- User's live instruction overrides the old UI-SPEC 13-cell / CELL_SIZE=64 grid lock: cards become large landscape, 2 columns (oracle look).
- Do NOT invent paper names. Named papers come from the oracle list already vendored in `@efxlab/efx-watercolor` (`PAPER_LIBRARY` / `PAPER_PRESETS`). If a name is missing from the vendored table, extend `packages/efx-watercolor/src/papers/library.ts` from `SPECS/v1.1.0-water-color/watercolor-playground/src/engine/papers.ts` — that is in-scope.
- PAPER-04 stands: `paper_1.jpg` / `paper_2.jpg` / `paper_3.jpg` stay usable as recovered real scans. They must not present as placeholder "PAPER N" paper-type names in the named catalog.
- Do NOT add a second paper-strength store. `grainStrength` -> `engine.paperTexture` is the Texture control.
- Do NOT touch `physicsPaintStudioSettings.ts` factory defaults, the top-bar write-through pair, or tick `SPECS/v1.1.0-water-color/phase-55-issues/index.md`.
- Preact + `@preact/signals`. Narrow signal reads; no `useState` for reactive values; selection in click handlers (never `useEffect`); store setters stay compare-then-write. Consult `efx-preact-reactivity` before any component edit.

</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@packages/efx-watercolor/src/papers/library.ts
@SPECS/v1.1.0-water-color/watercolor-playground/src/components/PaperPanel.tsx
@SPECS/v1.1.0-water-color/watercolor-playground/src/engine/papers.ts
@app/src/components/physic-paint/view/PaperPicker.tsx
@app/src/components/physic-paint/view/paperThumb.ts
@app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx
@app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx
@app/src/components/physic-paint/physicsPaintStudio.css
</context>

<tasks>

<task type="auto">
  <name>Task 1: Paper cards large landscape + oracle paper catalog (moves 1 + 3)</name>
  <files>app/src/components/physic-paint/view/PaperPicker.tsx, app/src/components/physic-paint/view/PaperPicker.test.tsx, app/src/components/physic-paint/view/paperThumb.ts, app/src/components/physic-paint/view/paperThumb.test.ts, packages/efx-watercolor/src/papers/library.ts</files>
  <action>
Two commits inside this task (UAT moves 1 and 3 stay separable).

**Commit C1 — move 1: large landscape cards (image 72 vs 73).**
Retarget `PaperPicker.tsx` card geometry to the oracle TEXTURE picker (`PaperPanel.tsx` `SWATCH_W = 112`, `SWATCH_H = 64`, 2 columns, name BELOW):
- Replace the `CELL_SIZE = 64` square idiom with landscape thumb constants matching the oracle (~112x64, ~2:1). Keep a 2-column grid (`gridTemplateColumns: repeat(2, <card-width>px)`). `GRID_GAP` can stay 8 or take the oracle's 6px — pick one and pin it.
- `PaperCard` thumb window becomes the landscape rect (full card width x ~64px thumb), name BELOW in small uppercase (existing 9px / 0.14em pattern is already right).
- `paperThumb.ts` already accepts `(id, width, height)` — paint/cached thumbs at the new landscape size. Keep the paint-once Map cache and never `toDataURL`/`toBlob`. Adjust `THUMB_WINDOW_UNITS` only if the larger window makes the grain unreadable; the wash math is unchanged.
- `warmProceduralReliefThumbs()` warms the new size.
- Retarget the `PaperPicker.test.tsx` pin that currently asserts `const CELL_SIZE = 64` / `GRID_GAP = 8` / the 2-column template (that UI-SPEC lock is overridden by the user's live oracle-look instruction). New pin: landscape card constants + 2 columns + name-below.

**Commit C2 — move 3: paper catalog data (image 75) + Texture control check.**
- The named paper catalog the user sees must be the oracle's ten papers: COLD PRESS, HOT PRESS, ROUGH, KHADI, WASHI, LAID, CANVAS, TONED SAND, KRAFT, STUDENT. These are already in vendored `PAPER_LIBRARY` / `PAPER_PRESETS` (`packages/efx-watercolor/src/papers/library.ts`, kinds 0..9 matching `SPECS/.../engine/papers.ts`). USE that data — do not invent names. If any display name is missing or wrong versus the oracle table, fix `library.ts` names from the oracle (`Cold Press`, `Hot Press`, `Rough`, `Khadi`, `Washi`, `Laid`, `Canvas`, `Toned Sand`, `Kraft`, `Student`).
- Kill the placeholder read of `PAPER 1` / `PAPER 2`. No cell in the named catalog may present as those placeholder paper-type names. The ten oracle papers carry the named catalog and must all be visible with live texture thumbs (procedural arm of `paperThumb`).
- Real scans stay (PAPER-04): `paper/real-1..3` remain as scan cells with the same large-card chrome and real jpg texture (`paintReal`). Transparent + White stay as the background arms leading Real. Do not invent paper-type names for the scans.
- Oracle texture control check (`PaperPanel.tsx` `Slider label="Texture"` -> `engine.paperTexture`): the app's Grain strength already feeds `grainStrength` -> `engine.paperTexture` via the adapter. Ensure that strength control is present under the Texture rule and is the only paper-strength control (no second store). Grain scale stays the scale control. If the segmented Grain strength row is the only strength UI, keep it (or restyle the label to Texture for oracle parity) — do not add a parallel slider writing the same value.
- Pins: all ten oracle names present in the rendered catalog / library source; no `paper 1` / `paper 2` placeholder labels in the named-paper path; procedural thumbs still `data-paper-tile="procedural"`; real scans still `data-paper-tile="real"`.

Preact rules apply (efx-preact-reactivity): card selection stays in the click handler; thumb cache stays module-level Map; no render-body signal writes.

</action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run app/src/components/physic-paint/view/PaperPicker.test.tsx app/src/components/physic-paint/view/paperThumb.test.ts packages/efx-watercolor/src/papers/papers.test.ts</automated>
  </verify>
  <done>
    Paper cards are landscape ~2:1 in 2 columns with name below; the named catalog lists the oracle's ten papers with live texture; PAPER 1 / PAPER 2 placeholder names are gone from that catalog; PAPER-04 scans + Transparent/White still work; paper strength rides grainStrength -> engine.paperTexture only. Pin suites green. Two commits: C1 (cards) then C2 (data).
  </done>
</task>

<task type="auto">
  <name>Task 2: Spacing pass + light gray brush thumb border (moves 2 + 4)</name>
  <files>app/src/components/physic-paint/physicsPaintStudio.css, app/src/components/physic-paint/view/BrushModuleSection.tsx, app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx, app/src/components/physic-paint/view/BrushResponsePanel.tsx, app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx, app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts</files>
  <action>
Two commits (UAT moves 2 and 4 stay separable). CSS-only where possible; ride `physicsPaintStudio.css`.

**Commit C3 — move 2: spacing / padding pass (images 74, 76).**
Consistent vertical breathing room across Paper tab, Paint tab, Brush tab:
- Section titles (`RuleSectionHeader` rows: Texture / Real / Procedural) get real top+bottom margin so the `— TEXTURE —` rule is no longer crammed against the Grain strength chips and Grain scale slider (image 74). Prefer one shared rule (e.g. `.rule-section-header { margin: 12px 0 8px; }` or an equivalent option-group gap) over per-call inline padding.
- Slider rows are not a zero-gap stack: Shape detail / Blending / Spread (and the AquarelleGlobalsPanel seven rows, BrushResponsePanel rows) get a consistent row gap (~10px matches `.physics-paint-option-group`). Cover both the Brush-mode Paint tab (`BrushModuleSection`) and the Watercolor Paint tab (`AquarelleGlobalsPanel`) and the Brush-response block.
- Paper tab grain pair and the card grids keep their internal gaps but sit with the same section rhythm.
- Do not change control order, labels, or write-through seams — spacing only (plus any tiny wrapper class needed to target a block).

**Commit C4 — move 4: brush thumb border light gray.**
- In `WatercolorBrushLibrary.tsx` `BrushCard`, the unselected border is currently `1px solid var(--sidebar-border, #2a3340)` (dark). Change the unselected border to a light gray (e.g. `#c8c8c8` / `#d0d0d0` / a light neutral that reads on the dark Studio chrome). Selected accent border stays.
- Pin in `WatercolorBrushLibrary.test.ts`: unselected card border is the light gray token, not `#2a3340` / `var(--sidebar-border`.

</action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts app/src/components/physic-paint/view/BrushResponsePanel.test.ts</automated>
  </verify>
  <done>
    Titles / section blocks / slider rows have consistent vertical padding on Paper, Paint, and Brush tabs; brush card thumbs use a light gray border. Pin suites green. Two commits: C3 (spacing) then C4 (border).
  </done>
</task>

<task type="auto">
  <name>Task 3: Top bar centered Modes+settings group (move 5)</name>
  <files>app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx, app/src/components/physic-paint/physicsPaintStudio.css, app/src/components/physic-paint/view/PhysicsPaintTopBar.test.ts</files>
  <action>
One commit (UAT move 5). Fix the overlap at the current window width with flex layout (gap + min-width: 0), not absolute positioning.

Target row shape:
- Left: `Engine ready` status pill only (pinned left).
- Center: ONE group = `ModuleSwitcher` (Brush / Water color / Krita) + Brush size + Opacity + (watercolor mode only) Water / Edges / Grain.
- Right: stays clear (keep a balanced flex spacer if needed so the cluster is optically centered).

Changes:
- Move `ModuleSwitcher` out of `.physics-paint-topbar-left` into the centered cluster (`.physics-paint-topbar-primary` or a single center wrapper that holds Modules + sliders together). Status pill stays in the left slot alone.
- Keep `flex-wrap: nowrap`, balanced `flex: 1 1 0` sides, `min-width: 0` on flex children so the cluster can shrink instead of overlapping. Tune `gap` / `min-width` on `.physics-paint-topbar-slider` so Brush size + Opacity + Water/Edges/Grain fit without collision at the width in image 77. If the watercolor cluster is too wide, allow the slider min-width to shrink (keep labels readable) rather than wrapping or absolute-positioning.
- Do NOT change the write-through pair (`onBrushSizeChange` / `onOpacityChange` / `setAquarelleParam`) or the live aquarelle size read. DOM grouping and CSS only.
- Retarget `PhysicsPaintTopBar.test.ts` centering pins: status left, ModuleSwitcher inside the primary cluster, primary still `flex: 0 0 auto` with balanced sides, no `margin-left: auto` push. Assert the tree has Modules + sliders in one group and status is not in that group.

</action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run app/src/components/physic-paint/view/PhysicsPaintTopBar.test.ts</automated>
  </verify>
  <done>
    At the image-77 width, Engine ready is left, Modes + Brush size + Opacity (+ Water/Edges/Grain) form one non-overlapping centered group, right side clear. Write-through handlers unchanged. Pin suites green. One commit: C5.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Studio UI -> studio settings / aquarelle params | slider and card clicks write existing seams only |
| Thumb painter -> cached canvas | module-level Map of HTMLCanvasElement, no serialization |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261018-GQO-01 | Tampering | paperThumb cache | low | mitigate | paint-once Map keyed by (id, size); no toDataURL/toBlob; clearPaperThumbCache test seam unchanged |
| T-261018-GQO-02 | Information Disclosure | real jpg decode | low | accept | images are shipped public assets under app/public/img; decode-once content-keyed cache already in place |
| T-261018-GQO-SC | Tampering | npm/pip/cargo installs | high | mitigate | no new packages this quick; package-legitimacy gate N/A (no install tasks) |
</threat_model>

<verification>
After all five commits, from the checkout root:

`pnpm --filter efx-motion-editor exec vitest run`

Expect at least: `PaperPicker.test.tsx`, `paperThumb.test.ts`, `WatercolorBrushLibrary.test.ts`, `AquarelleGlobalsPanel.test.ts`, `BrushResponsePanel.test.ts`, `PhysicsPaintTopBar.test.ts`, `physicsPaintRightPanelPaperSingleHome.test.ts` green (plus the broader physic-paint suite the prior UAT round used).

Scope fence: no `SPECS/` diff, no package.json / lockfile diff, no phase-55 index row ticks. `packages/efx-watercolor` changes limited to `src/papers/library.ts` name/data alignment with the oracle table.

</verification>

<success_criteria>
- Five commits (C1 cards, C2 paper data, C3 spacing, C4 brush border, C5 top bar) so each UAT move can be judged alone.
- Paper tab matches the oracle TEXTURE picker geometry (large ~2:1 landscape cards, 2 columns, name below).
- Named catalog = the oracle's ten papers with real texture; no PAPER 1 / PAPER 2 placeholder names; PAPER-04 scans + Transparent/White intact.
- Spacing rhythm consistent across Paper / Paint / Brush tabs.
- Brush thumbs light gray border.
- Top bar Modes+settings one centered group, Engine ready left, no overlap.
- Automated pin suites green after each commit.
</success_criteria>

<output>
Create `.planning/quick/261018-gqo-third-uat-round-on-the-watercolor-brush-/261018-gqo-SUMMARY.md` when done
</output>
