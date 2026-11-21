---
phase: quick/261121-mtu
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/efx-watercolor/src/payload/toStudioStroke.ts
  - packages/efx-watercolor/src/payload/toStudioStroke.test.ts
  - packages/efx-watercolor/src/adapter/engineAdapter.ts
  - packages/efx-watercolor/src/adapter/engineAdapter.test.ts
  - packages/efx-watercolor/src/playground/mediums.ts
  - packages/efx-watercolor/src/playground/mediums.test.ts
  - packages/efx-watercolor/src/engine/deposit.ts
  - packages/efx-watercolor/src/engine/fluid.test.ts
  - app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx
  - app/src/components/physic-paint/view/aquarelleStrokeBand.ts
  - app/src/components/physic-paint/view/aquarelleRecordState.ts
  - app/src/components/physic-paint/view/brushGroupMedium.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx
  - app/src/components/physic-paint/view/PhysicsPaintRightSidebar.test.ts
  - app/src/components/physic-paint/performance/scriptTimelineCodec.ts
  - app/src/components/physic-paint/performance/scriptTimelineCodec.test.ts
  - app/src/components/physic-paint/view/aquarellePaintControls.ts
  - app/src/components/physic-paint/view/aquarellePaintControls.test.ts
  - app/src/components/physic-paint/view/aquarelleParamVisibility.ts
  - app/src/components/physic-paint/view/aquarelleParamVisibility.test.ts
  - app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx
  - app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts
  - app/src/components/physic-paint/view/AquarelleParamsPanel.test.tsx
  - app/src/components/physic-paint/view/AquarelleToolRow.tsx
  - app/src/components/physic-paint/view/AquarelleToolRow.test.tsx
  - app/src/components/physic-paint/view/aquarelleToolFamily.test.ts
  - app/src/components/physic-paint/view/aquarellePresetSelection.test.ts
  - app/src/components/physic-paint/view/aquarelleLiftTipSelection.test.ts
  - app/src/components/physic-paint/view/aquarelleWetPaintGate.test.ts
  - app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts
  - app/src/components/physic-paint/view/physicsPaintHandToolWiring.test.ts
  - app/src/components/physic-paint/view/mediumSelection.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx
  - app/src/components/physic-paint/view/PhysicsPaintToolRail.test.ts
  - app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts
  - app/src/components/physic-paint/view/physicsPaintStudioKeyboard.test.ts
  - app/src/components/physic-paint/view/physicsPaintShortcutsHelp.ts
  - app/src/components/physic-paint/view/physicsPaintShortcutsHelp.test.ts
  - app/src/components/physic-paint/view/scriptStrokeEdition.ts
  - app/src/components/physic-paint/view/strokeSettingsModel.ts
  - app/src/components/physic-paint/view/strokeSettingsModel.test.ts
  - app/src/components/physic-paint/view/vectorPathSession.test.ts
  - app/src/components/physic-paint/roto/aquarelleLiftEraseContract.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  - SPECS/v2.2.0-medium-engine/parametres-du-pinceau.md
autonomous: true
requirements: []
estimate:
  # Three transactions, each one reviewable commit set. The token weight is in
  # the pin surface, not the production diff: three new test files plus thirteen
  # existing suites that assert the retired flat shape, the blanket brush flip
  # or the flat rail import must be updated deliberately. The plan-checker
  # flagged the file count (38 files, Task 2 above the 15-file threshold); it is
  # kept as three tasks because splitting the tool surfaces from the stroke-list
  # categories would leave the tree red between them (the union widening breaks
  # the closed label maps immediately). Confidence stays low because there is no
  # calibration sample for quick tasks (estimate-calibration: factor 1,
  # sample_count 0).
  tokens: 85000
  raw_tokens: 85000
  tasks: 3
  confidence: low
must_haves:
  truths:
    - "The Refill row is hidden ONLY while the selected medium is acrylic (`aquarelleSelectedMediumId.value === 'acrylic'`) and is shown for watercolor, gouache, pastel and graphite. Nothing outside the acrylic context forces refill to 0: those four media keep 60 through medium apply and through Reset."
    - "In the acrylic context refill is 0 and stays 0 through (a) applying the Acrylic medium, (b) picking a brush whose group is acrylic, and (c) Reset — Reset is one loop over every row key except `lift` plus `body`, with `refill` writing 0 instead of round(DEFAULT_PARAMS.refill × 100) = 60 when the selected medium is acrylic. The same values leave as ONE selection patch. The shared DEFAULT_PARAMS is NOT changed."
    - "The acrylic medium record is feather 85, emboss 3, pickup 100, refill 0, with water 26 / load 100 / flow 60 / bleed 22 / dry 70 / edge 65 / granulation 25 / viscosity 90 / body 100 / wetSeconds 12 unchanged; the obsolete 'full Feather and no Emboss' comment is replaced by one stating the current numbers and why, and spec §5's Acrylic row states Feather 85 and Emboss 3."
    - "`AquarelleTool` is the additive five-member union brush | watercolor | water | pen | lift; `AQUARELLE_TOOLS` lists all five; `Engine.Tool` stays four values. A stored stroke carrying brush, water, pen or lift loads, replays and re-bakes exactly as today with no migration and no legacy shim (the payload codec and the roto schema extend automatically because both read `AQUARELLE_TOOLS`)."
    - "The payload→engine mapping is explicit and pinned: `watercolor` resolves to the engine's `brush`; the unknown-tool fallback stays `brush`; `AquarelleCanvasLayer` no longer casts the active tool into `Engine.Tool`."
    - "The engine's fail-closed tool guard stays closed on exactly the four engine tools through a LOCAL `ENGINE_TOOLS` in `deposit.ts` (not derived from the widened payload list), so `assertAquarelleTool('watercolor')` throws and no fifth engine mode exists; `fluid.test.ts` pins the closure. The Studio script codec (`scriptTimelineCodec.ts`) APPENDS `watercolor` at a new code index (4) so every existing snapshot's positional codes are unchanged, and a round-trip pin proves both the new member and the four legacy codes."
    - "The Watercolor tool keeps the top-bar settings cluster (Size and knobs): `toolOwnsSettings` includes `watercolor`, because it is a paint tool; only Water and Pen remove the cluster."
    - "The tool surfaces (the live rail's `WATERCOLOR_RAIL_TOOLS` and the test-only `AquarelleToolRow`'s `TOOLS`) are Brush · Watercolor · Water · Pen · Eraser, in that order, with lucide-preact icons Paintbrush / Droplet / WavesArrowDown / Pen / Eraser, shortcuts B / A / W / P / E. The Water dry-sheet gate is unchanged."
    - "A brush pick sets the paint tool from the picked brush's group: watercolor group → the Watercolor tool, any other group or no preset → the Brush tool (the hardcoded `setAquarelleTool('brush')` is gone). Picking the Watercolor tool applies the Watercolor medium and, only when the selected tip is outside the watercolor group, selects that group's first preset (`round`) through `selectAquarelleTip`. Picking Brush changes neither tip nor medium. The brush library is NOT filtered — every group stays reachable in all three mounting surfaces."
    - "Bare A is the Watercolor tool and bare M toggles Move/Edit (Select). Shift+A still enters Select and selects/deselects every stroke. The rail's Select tooltip, the shortcuts catalog and the detected-context copy all say M."
    - "The Paint panel renders six groups in the fixed order Medium · Paint & reservoir · Drying · Edge · Watercolor only · Eraser, each heading rendered only when the group has at least one visible row. Visibility is a pure function of (active tool, selected medium) per the matrix below. Body stays row-less and Reset-only; wetSeconds stays row-less; Lift renders only in the Eraser context."
    - "`visibleAquarelleParamGroups` / `visibleAquarelleParamRows` are pure, exported and DOM-free, and a unit suite reproduces the full tool × medium × parameter matrix as scalar pins."
  artifacts:
    - packages/efx-watercolor/src/payload/toStudioStroke.ts
    - packages/efx-watercolor/src/adapter/engineAdapter.ts
    - packages/efx-watercolor/src/playground/mediums.ts
    - app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx
    - app/src/components/physic-paint/view/aquarelleRecordState.ts
    - app/src/components/physic-paint/view/aquarelleParamVisibility.ts
    - app/src/components/physic-paint/view/aquarelleParamVisibility.test.ts
    - app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx
    - app/src/components/physic-paint/view/AquarelleToolRow.tsx
    - app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx
    - app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts
    - app/src/components/physic-paint/view/physicsPaintShortcutsHelp.ts
    - app/src/components/physic-paint/view/strokeSettingsModel.ts
    - app/src/components/physic-paint/view/scriptStrokeEdition.ts
    - SPECS/v2.2.0-medium-engine/parametres-du-pinceau.md
  key_links:
    - from: app/src/components/physic-paint/view/aquarelleParamVisibility.ts
      to: app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx
      via: "visibleAquarelleParamGroups(aquarelleActiveTool.value, aquarelleSelectedMediumId.value) is the ONLY source of rendered rows and group headings"
    - from: app/src/components/physic-paint/view/aquarelleRecordState.ts
      to: packages/efx-watercolor/src/playground/brushes.ts
      via: "selectAquarelleTip resolves the incoming preset's group with brushGroupOf and flips the paint tool to watercolor or brush from that group"
    - from: packages/efx-watercolor/src/payload/toStudioStroke.ts
      to: app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx
      via: "AquarelleTool (five payload members) → engineToolForAquarelleTool → engine.setTool (Engine.Tool, four members)"
    - from: app/src/components/physic-paint/view/aquarellePaintControls.ts
      to: app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx
      via: "a brush pick applies its group's medium (applyAquarelleMedium), which is the same write that decides whether the Refill row exists"
---

<objective>
Refill becomes acrylic-hidden and zero, the acrylic preset gains a soft-but-defined edge (Feather 85) and a light relief pass (Emboss 3), the paint-tool model grows a third paint category (Watercolor, shortcut A, with Move/Edit moving to M), and the Paint tab's flat 12-row list is replaced by six tool/medium-context groups.

Purpose: the artist's five-part correction of the v2.2.0 medium engine's surface. The engine laws do not move — this is exposure, presets and organisation.

Output: one additive payload tool member with an explicit engine mapping, one pure visibility selector with a full matrix pin, three updated tool surfaces, and a spec that states the new contract (with the non-acrylic Refill decision marked DEFERRED).
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/STATE.md
@SPECS/v2.2.0-medium-engine/parametres-du-pinceau.md
@app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx
@app/src/components/physic-paint/view/aquarelleRecordState.ts
@app/src/components/physic-paint/view/aquarellePaintControls.ts
@app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx
@app/src/components/physic-paint/view/AquarelleToolRow.tsx
@app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts
@app/src/components/physic-paint/view/physicsPaintShortcutsHelp.ts
@app/src/components/physic-paint/view/strokeSettingsModel.ts
@app/src/components/physic-paint/view/scriptStrokeEdition.ts
@app/src/components/physic-paint/PhysicsPaintStudio.tsx
@app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx
@app/src/components/physic-paint/engine/aquarelleFootprint.ts
@packages/efx-watercolor/src/payload/toStudioStroke.ts
@packages/efx-watercolor/src/adapter/engineAdapter.ts
@packages/efx-watercolor/src/playground/mediums.ts
@packages/efx-watercolor/src/playground/brushes.ts

Skills to load before implementing: `efx-preact-reactivity` (signals discipline for the panel and the tool seam), `efx-studio-paint` (confirms the guardrail: no engine-law change).

**Project constraints that bind this plan**
- Preact signals only — no useState anywhere. Narrow `.value` reads; no signal writes in a render body; compare-then-write setters.
- `vitest run` only, never watch. Run targeted files, never the whole suite. There is no root vitest binary — every command below uses `pnpm --dir <pkg> exec vitest run <file>`.
- No server, no push. Commit locally.
- Additive payload contract: no migration, no backward-compat shim, no renaming/removing of brush preset ids or brush groups.

**Measured codebase anchors (HEAD 705d931cd — re-read before editing)**
- `mediums.ts` acrylic record: water 26, load 100, flow 60, bleed 22, dry 70, edge 65, granulation 25, viscosity 90, body 100, emboss 0, feather 100, pickup 100, refill 0, wetSeconds 12.
- `Engine.ts` `DEFAULT_PARAMS`: water 0.6, flow 0.45, granulation 0.45, dry 0.4, feather 0, emboss 0, refill 0.6, pickup 1.0, lift 0.22.
- `lucide-preact@1.57.0` is installed at `node_modules/.pnpm/lucide-preact@1.57.0_preact@11.2.0`; `WavesArrowDown` IS exported by its typings — no fallback needed.
- `BRUSH_PRESETS`: the first watercolor-group preset is `round` (`brushes.ts` L368); `brushGroupOrder` and `brushGroupOf` are exported from `@efxlab/efx-watercolor`.
- `resolvePaintedCurveEligibility` allows brush/water/pen today; `lift` is refused.
</context>

<artist_review>
Both tables below are the review surface named in the artist's brief. Nothing in the plan may silently deviate from them; a deviation is a revision request, not an execution choice.

## Matrix 1 — tool → group family (FOR ARTIST REVIEW)

| Tool (row order) | Shortcut | Icon (lucide-preact) | Payload `tool` | Engine `Tool` | Brush family / medium |
|---|---|---|---|---|---|
| Brush | B | `Paintbrush` | `brush` | `brush` | All five groups reachable; picking the tool changes neither tip nor medium |
| Watercolor | A | `Droplet` | `watercolor` | `brush` | Watercolor group; picking applies the Watercolor medium and, if the selected tip is outside the group, selects its first preset (`round`) |
| Water | W | `WavesArrowDown` | `water` | `water` | Wet-blend only, medium-independent, dry-sheet gate unchanged |
| Pen | P | `Pen` | `pen` | `pen` | Follows the active medium (pen footprint, paint rows) |
| Eraser | E | `Eraser` | `lift` | `lift` | Separate lift tip; Lift row only |

Brush-pick → paint tool (the replacement for the hardcoded `setAquarelleTool('brush')`):

| Picked brush's group | Paint tool after the pick |
|---|---|
| `watercolor` | `watercolor` |
| `gouache` / `pastel` / `graphite` / `acrylic` | `brush` |
| No preset (catalog `wc/custom-*`, unknown id, `null`) | `brush` (today's fallback, unchanged) |

Rejected alternative (must be stated in the SUMMARY): hiding non-matching brush-library sections. The library is mounted in three surfaces (`PhysicsPaintBrushModal`, `PhysicsPaintBrushMenu`, `BrushesDocker`) and hiding cards would destroy reachability. The tool constrains via the pick law, never by removing cards.

**Shortcut conflict (FOR ARTIST REVIEW):** bare `A` is today the Move/Edit (Select) toggle and `Shift+A` is select-all. This plan gives `A` to the Watercolor tool and moves Move/Edit to `M`; `Shift+A` is untouched. Veto here if `M` is not acceptable.

## Matrix 2 — tool × medium × parameter visibility (FOR ARTIST REVIEW)

Contexts: **P-A** paint tools (Brush / Watercolor / Pen) with the Acrylic medium; **P-W** paint tools with Watercolor; **P-D** paint tools with Gouache / Chalk / Graphite; **W** the Water tool; **L** the Eraser. ✓ = row rendered, — = row absent.

| Group | Row (bag key, label, band) | P-A | P-W | P-D | W | L |
|---|---|---|---|---|---|---|
| Medium | `viscosity` Viscosity 0–100 | ✓ | ✓ | ✓ | ✓ | — |
| Medium | `emboss` Emboss 0–15 | ✓ | ✓ | ✓ | — | — |
| Paint & reservoir | `load` Pigment 0–100 | ✓ | ✓ | ✓ | — | — |
| Paint & reservoir | `pickup` Pickup 0–100 | ✓ | ✓ | ✓ | — | — |
| Paint & reservoir | `refill` Refill 0–100 | — | ✓ | ✓ | — | — |
| Drying | `water` Water 0–100 | ✓ | ✓ | ✓ | — | — |
| Drying | `dry` Dry speed 0–100 | ✓ | ✓ | ✓ | ✓ | — |
| Edge | `feather` Feather 0–100 | ✓ | — | ✓ | — | — |
| Watercolor only | `flow` Flow 0–100 | — | ✓ | — | ✓ | — |
| Watercolor only | `bleed` Bleed 0–100 | — | ✓ | — | ✓ | — |
| Watercolor only | `edge` Edges 0–100 | — | ✓ | — | ✓ | — |
| Watercolor only | `granulation` Grain 0–100 | — | ✓ | — | ✓ | — |
| Eraser | `lift` Lift 0–100 | — | — | — | — | ✓ |

Row counts: P-A 7 · P-W 11 · P-D 8 · W 6 · L 1.

Laws encoded by the matrix:
- Refill is medium-driven and tool-independent **in paint contexts** (D1): present for every medium except acrylic. It never appears with the Water tool or the Eraser.
- Feather is bristle-only (spec §3): absent for the Watercolor medium, present for the four bristle media.
- The **Water tool row set is the one judgment call**: the Water tool deposits `water: 1` by law (`deposit.ts` L563), so Water / Pigment / Pickup / Refill / Feather / Emboss are dead for it; the fluid sim it feeds reads Flow, Bleed, Edges, Grain, Dry speed and Viscosity. Veto here if the Water tool should instead show no rows at all.
- Pen follows the medium (it is a paint tool with a pen footprint; no rows of its own).
- Body stays row-less and Reset-only; `wetSeconds` stays row-less; group headings render only when non-empty, in the fixed order above.
</artist_review>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Payload union, explicit engine mapping, acrylic preset</name>
  <files>
    packages/efx-watercolor/src/payload/toStudioStroke.ts,
    packages/efx-watercolor/src/payload/toStudioStroke.test.ts,
    packages/efx-watercolor/src/adapter/engineAdapter.ts,
    packages/efx-watercolor/src/adapter/engineAdapter.test.ts,
    packages/efx-watercolor/src/playground/mediums.ts,
    packages/efx-watercolor/src/playground/mediums.test.ts,
    packages/efx-watercolor/src/engine/deposit.ts,
    packages/efx-watercolor/src/engine/fluid.test.ts,
    app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx,
    app/src/components/physic-paint/view/aquarelleStrokeBand.ts,
    app/src/components/physic-paint/roto/aquarelleLiftEraseContract.test.ts,
    SPECS/v2.2.0-medium-engine/parametres-du-pinceau.md
  </files>
  <behavior>
    - `AQUARELLE_TOOLS` equals exactly ['brush', 'watercolor', 'water', 'pen', 'lift'] and `isAquarellePaintTool` is true for brush and watercolor only.
    - `engineToolForAquarelleTool('watercolor')` is 'brush'; every other member maps to itself; an unknown string maps to 'brush'.
    - A payload whose engine slot carries `tool: 'watercolor'` passes `isAquarelleStrokePayload` / the codec shape guard (it is a member of the union) and a `brush`/`water`/`pen`/`lift` payload is byte-identical to today through a JSON round trip.
    - The acrylic record resolves feather 85, emboss 3, pickup 100, refill 0 and every other literal unchanged.
  </behavior>
  <action>
    **1. Widen the payload union (additive only).** In `packages/efx-watercolor/src/payload/toStudioStroke.ts` change `AquarelleTool` to `'brush' | 'watercolor' | 'water' | 'pen' | 'lift'` and `AQUARELLE_TOOLS` to the same five in that order. Rewrite the docblock: the PAYLOAD union is five, the ENGINE union (`Engine.Tool`) is still four, and `'watercolor'` is a paint tool — the distinction is the brush/medium family it exposes, not a new deposit law. Add and export `isAquarellePaintTool(tool: AquarelleTool): boolean` returning true for `'brush'` and `'watercolor'` (the ONE shared predicate that replaces the two inline `brush|water|pen` lists in `PhysicsPaintStudio.tsx`). Do not touch the codec — it reads `AQUARELLE_TOOLS` and extends automatically.

    **2. Make the engine mapping explicit.** In `packages/efx-watercolor/src/adapter/engineAdapter.ts` replace the set-membership `asTool` with a record-driven mapping: a frozen table named `PAYLOAD_TOOL_TO_ENGINE`, typed `Record<AquarelleTool, Tool>`, that states `brush→brush`, `watercolor→brush`, `water→water`, `pen→pen`, `lift→lift`, plus an exported `engineToolForAquarelleTool(raw: string): Tool` that returns the table value or falls back to `'brush'` for anything unknown. `asTool` delegates to it. The intent must be a stated mapping, not the fallback's coincidence — a pin asserts `'watercolor'` resolves through the table, and a second pin asserts an arbitrary unknown string still falls back.

    **2b. Keep the ENGINE's fail-closed tool guard closed on four.** In `packages/efx-watercolor/src/engine/deposit.ts` L39-48, `TOOL_SET` is derived from the payload `AQUARELLE_TOOLS`. Widening the payload union would silently make `assertAquarelleTool('watercolor')` pass and let `stampTool`/`depositStrokeOnSheet` treat a fifth value as a pigment mode (their `default` branch is commented "Unreachable"). Introduce a LOCAL frozen `ENGINE_TOOLS = ['brush', 'water', 'pen', 'lift']` and base `TOOL_SET` on it; keep the error message listing exactly those four. Re-export `ENGINE_TOOLS` for the engine-side pin. This is not an engine-law change — it preserves the existing law while decoupling it from the payload vocabulary. In `packages/efx-watercolor/src/engine/fluid.test.ts` L409-415 rewrite the "tool union exhaustiveness" block: the ENGINE constant is the closed four; `assertAquarelleTool('watercolor' as AquarelleTool)` throws (it is a payload-only member); an unknown tool still throws. State in the test why the payload list is no longer the engine's authority.

    **2c. Widen the stroke-band type, change no law.** `app/src/components/physic-paint/view/aquarelleStrokeBand.ts` L117-119 types `paintRadiusDocFor(tool: 'brush' | 'water' | 'pen', …)` while `buildStrokeBand` L163-172 forwards `stroke.tool` (now five members) after the `'lift'` early return. Widen the parameter to `Exclude<AquarelleTool, 'lift'>` (or add `'watercolor'`); the runtime law already treats it as the brush radius. No behavioural change.

    **3. Remove the raw cast at the live seam.** In `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx`, `applyLiveConfig` currently calls `engine.setTool(aquarelleActiveTool.value as Tool)`. Replace the cast with `engine.setTool(engineToolForAquarelleTool(aquarelleActiveTool.value))` imported from `@efxlab/efx-watercolor` (the package root index already re-exports `./adapter` — no new subpath). While there, leave `toolForSelection()` returning the payload tool: every consumer compares against `'lift'` or forwards the recorded tool, and `'watercolor'` is a legitimate recorded value. Add ONE source pin for the cast removal in `app/src/components/physic-paint/roto/aquarelleLiftEraseContract.test.ts` (it already reads this file's source): the layer must not contain `as Tool` next to `setTool`, and must call `engineToolForAquarelleTool(aquarelleActiveTool.value)`. Task 2 later updates that suite's lift-entry literals; the cast pin stays true there. `app/src/components/physic-paint/engine/aquarelleFootprint.ts` needs NO change — its pen branch tests `'pen'`, its eraser branch tests `'lift'`, its water branch tests `'water'`, and `'watercolor'` therefore falls into the brush footprint by construction.

    **4. Acrylic preset.** In `packages/efx-watercolor/src/playground/mediums.ts` set the acrylic record's `feather` to 85 and `emboss` to 3. Leave pickup 100, refill 0, body 100 and every other number byte-identical. Replace the obsolete comment that begins "2026-11-20 (artist's acrylic brush default)" with one that states the current numbers and why: Feather 85 keeps a soft-but-defined acrylic edge (100 smears the mark's silhouette), Emboss 3 a light relief pass (the row caps at 15), Refill 0 keeps the acrylic mixing bag from washing out, Pickup 100 keeps it taking the sheet's colour.

    **5. Update the spec §5.** In `SPECS/v2.2.0-medium-engine/parametres-du-pinceau.md` change the Acrylic row to Feather **85** and Emboss **3**, and update the paragraph above the table so it no longer claims "Feather 100 … Emboss 0". Add one sentence under the table: the acrylic record writes Refill 0 and the Refill row is hidden in the acrylic context (§3/§8).

    **6. Update and add pins.** `mediums.test.ts`: the acrylic literal block and the D-25 companion assertions move to feather 85 / emboss 3, with a comment naming the reason (artist's acrylic default, quick 261121-mtu). `toStudioStroke.test.ts`: add a pin for the five-member union order and for `isAquarellePaintTool`. `engineAdapter.test.ts`: add the `watercolor → brush` mapping pin and the unknown-tool fallback pin.
  </action>
  <verify>
    <automated>pnpm --dir packages/efx-watercolor exec vitest run src/playground/mediums.test.ts src/payload/toStudioStroke.test.ts src/adapter/engineAdapter.test.ts src/engine/fluid.test.ts && pnpm --dir packages/efx-watercolor build && pnpm --dir app exec vitest run src/components/physic-paint/roto/aquarelleLiftEraseContract.test.ts src/components/physic-paint/view/aquarelleStrokeBand.test.ts</automated>
  </verify>
  <done>
    The union is five members in the stated order; the engine mapping is a table with a pinned `watercolor → brush` entry; `Engine.Tool` and the engine's local `ENGINE_TOOLS` guard are untouched at four; the live canvas layer no longer casts; the stroke-band parameter compiles on five members; the acrylic record is feather 85 / emboss 3 with every other number unchanged; spec §5 states the new numbers; all targeted suites pass.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Watercolor tool, brush-family law, shortcuts, stroke-list categories</name>
  <files>
    app/src/components/physic-paint/view/aquarelleRecordState.ts,
    app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx,
    app/src/components/physic-paint/view/PhysicsPaintToolRail.test.ts,
    app/src/components/physic-paint/view/AquarelleToolRow.tsx,
    app/src/components/physic-paint/view/AquarelleToolRow.test.tsx,
    app/src/components/physic-paint/view/aquarelleToolFamily.test.ts,
    app/src/components/physic-paint/view/aquarellePresetSelection.test.ts,
    app/src/components/physic-paint/view/aquarelleLiftTipSelection.test.ts,
    app/src/components/physic-paint/view/aquarelleWetPaintGate.test.ts,
    app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts,
    app/src/components/physic-paint/view/physicsPaintHandToolWiring.test.ts,
    app/src/components/physic-paint/roto/aquarelleLiftEraseContract.test.ts,
    app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts,
    app/src/components/physic-paint/view/physicsPaintStudioKeyboard.test.ts,
    app/src/components/physic-paint/view/physicsPaintShortcutsHelp.ts,
    app/src/components/physic-paint/view/physicsPaintShortcutsHelp.test.ts,
    app/src/components/physic-paint/view/scriptStrokeEdition.ts,
    app/src/components/physic-paint/view/strokeSettingsModel.ts,
    app/src/components/physic-paint/view/strokeSettingsModel.test.ts,
    app/src/components/physic-paint/view/vectorPathSession.test.ts,
    app/src/components/physic-paint/PhysicsPaintStudio.tsx,
    app/src/components/physic-paint/PhysicsPaintStudio.test.ts,
    app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx,
    app/src/components/physic-paint/view/PhysicsPaintTopBar.test.ts,
    app/src/components/physic-paint/view/brushGroupMedium.test.ts,
    app/src/components/physic-paint/performance/scriptTimelineCodec.ts,
    app/src/components/physic-paint/performance/scriptTimelineCodec.test.ts
  </files>
  <behavior>
    - Picking a watercolor-group brush sets the active tool to `watercolor`; picking a gouache/pastel/graphite/acrylic brush sets it to `brush`; an unknown id still sets `brush`.
    - Picking the Watercolor tool applies the Watercolor medium and selects `round` only when the current tip is outside the watercolor group; picking the Brush tool changes neither the selected tip nor the selected medium.
    - Bare `a` dispatches `selectAquarelleTool('watercolor')` and never `toggleAquarelleSelect`; bare `m` dispatches `toggleAquarelleSelect`; `Shift+A` still dispatches `toggleSelectAllAquarelleStrokes`.
    - The rail renders five paint buttons in the order Brush, Watercolor, Water, Pen, Eraser with titles `Brush (B)`, `Watercolor (A)`, `Water (W) — needs standing water` (or the wireframe reason), `Pen (P)`, `Eraser (E)`.
    - A recorded `'watercolor'` stroke appears in the stroke list under its own category and is eligible for path editing.
  </behavior>
  <action>
    **1. The tool-selection seam (new law, one function).** In `app/src/components/physic-paint/view/aquarelleRecordState.ts` add and export `selectAquarellePaintTool(tool: AquarelleTool): void`:
    - `'watercolor'`: resolve the selected tip's group from `BRUSH_PRESETS` with `brushGroupOf` (import it from `@efxlab/efx-watercolor`; `BRUSH_PRESETS` and `DEFAULT_MEDIUM_ID` are already imported). If the resolved group is not `'watercolor'` (including `null`), call `selectAquarelleTip(<first watercolor-group preset id>)` — derive it from `BRUSH_PRESETS.find((p) => brushGroupOf(p) === 'watercolor')`, which is `round` today; never hardcode an id without that lookup. Then call `applyAquarelleMedium('watercolor')` and `setAquarelleTool('watercolor')`.
    - `'brush'`: `setAquarelleTool('brush')` only — never touch the tip or the medium.
    - anything else: `setAquarelleTool(tool)`.
    Keep the function idempotent (its setters already compare-then-write) and keep every write out of render bodies.

    **2. Make the brush pick family-aware.** In `selectAquarelleTip` replace the hardcoded `if (nextId !== null) setAquarelleTool('brush')` with a module-local `paintToolForTip(nextId)`: resolve the `BRUSH_PRESETS` entry and return `'watercolor'` when `brushGroupOf(preset) === 'watercolor'`, otherwise `'brush'` (catalog tips, unknown ids and `null` included). Document in the comment that this replaces the old blanket flip and that it is what makes the acrylic group return to the Brush tool while the watercolor group returns to the Watercolor tool. `pickAquarelleBrush` keeps its order (live pick, then `applyAquarelleMedium(incomingGroup)`).

    **3. Tool surfaces — update BOTH so they cannot drift.** `app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx` (`WATERCOLOR_RAIL_TOOLS`): five entries in order Brush/Paintbrush/B, Watercolor/Droplet/A, Water/WavesArrowDown/W, Pen/Pen/P, Eraser/Eraser/E. Keep the existing map shape and the Water dry-sheet gate exactly as they are; route the click through `selectAquarellePaintTool(id)` instead of `setAquarelleTool(id)`. Update BOTH rail Select tooltip variants: the wireframe one ("Select (A) — turn wireframe off to select", L204) and the long one ("Select (A) — click or A toggles…", L205) — both say M; the Shift+A clause stays. `app/src/components/physic-paint/view/AquarelleToolRow.tsx` (`TOOLS`): the same five entries, icons and shortcuts, and the same click routing. `Droplet` moves from Water to Watercolor; import `WavesArrowDown` from `lucide-preact`.

    **4. Studio handler and the two paint-tool lists.** In `app/src/components/physic-paint/PhysicsPaintStudio.tsx`: widen `handleSelectAquarelleTool` to the payload `AquarelleTool` and call `selectAquarellePaintTool(tool)`; replace BOTH inline `brush|water|pen` comparisons (the auto-promotion gate and the generated-frame paint guard) with `isAquarellePaintTool(aquarelleActiveTool.value)` imported from `@efxlab/efx-watercolor/payload`. Update the comment above the handler (A = Watercolor, M = Move/Edit).

    **5. Keyboard.** In `app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts`: add `'a'` to the bare-key tool dispatch so it calls `actions.selectAquarelleTool('watercolor')` with no `canSelectWater` probe; move the Select toggle from `'a'` to `'m'` keeping `event.preventDefault()`; leave the `Shift+A` branch untouched. WIDEN the action's parameter type at L47 from the four literal values to the payload `AquarelleTool` (import it) — it is a type, not a comment; vitest does not typecheck, so only `tsc --noEmit` would catch it. Update the action type docblock (`Bare A: the Watercolor tool`, `Bare M: toggle Move/Edit`) and the dispatch comment block.

    **5b. The Studio script codec must encode the new member.** `app/src/components/physic-paint/performance/scriptTimelineCodec.ts` L176 `TOOL_NAMES` is a positional four-member table and L665-666 fails `invalid-tag` for any other tool; a recorded `'watercolor'` stroke (stamped from `aquarelleRecordState.ts` L744) would stop the Studio script snapshot write. APPEND `'watercolor'` at index 4 of `TOOL_NAMES` and add its entry to `TOOL_CODE_BY_NAME` (never insert in the middle — the decoder indexes by position and a middle insert would corrupt every existing snapshot). Add a round-trip pin in `scriptTimelineCodec.test.ts`: encode→decode of a `'watercolor'` payload returns `'watercolor'`, and the four legacy codes keep their existing numeric values.

    **5c. The top bar must keep its settings cluster for the new paint tool.** `app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx` L456 `toolOwnsSettings = activeTool === 'brush' || activeTool === 'lift'` removes the Size/knob cluster from the DOM for Water and Pen. Add `'watercolor'` (it is a paint tool with the brush family; without it the Size slider vanishes while painting watercolor). Update the comment and any TopBar pin in `PhysicsPaintTopBar.test.ts` that enumerates the owning tools.

    **6. Shortcuts catalog.** In `app/src/components/physic-paint/view/physicsPaintShortcutsHelp.ts`: add `{keys: 'A', description: 'Watercolor'}` to the Paint Tools group; change the Move/Edit entry to `{keys: 'M', description: 'Toggle Move/Edit (Select)'}`; change the detected-context copy `'press A for Move/Edit tips…'` to `'press M for Move/Edit tips…'`. Leave `⇧A` in the Move/Edit group.

    **7. Stroke-list categories.** In `app/src/components/physic-paint/view/scriptStrokeEdition.ts` widen `ScriptStrokeTool` to include `'watercolor'` and add `'watercolor-vector'` to `ScriptStrokeFilterValue` (a watercolor stroke can be converted to a path; mapping it onto `brush-vector` would conflate two families). In `app/src/components/physic-paint/view/strokeSettingsModel.ts`: add `watercolor: 'Watercolor'` to `STROKE_TOOL_LABELS`, `'watercolor-vector': 'Watercolor-Vector'` to the vector label map, a `case 'watercolor': return 'watercolor-vector'` in `strokeRowFilterValue`, `'watercolor'` after `'brush'` and `'watercolor-vector'` after `'brush-vector'` in `STROKE_FILTER_ORDER`, and `'watercolor'` to the allowed paint tools in `resolvePaintedCurveEligibility`. The generic `endsWith('-vector')` label path already handles the new suffix.

    **8. Tests — update deliberately, add the new law.** New `app/src/components/physic-paint/view/aquarelleToolFamily.test.ts` pins the family law (watercolor-group pick → `watercolor`; acrylic/gouache/pastel/graphite pick → `brush`; unknown id → `brush`; Watercolor tool applies the watercolor record and selects `round` only when outside the group; Brush tool leaves tip and medium untouched). Update `AquarelleToolRow.test.tsx`: five labels, the lucide mock gains `WavesArrowDown`, and the "selecting a tool sets exactly one active" case must match by `data-testid` (the substring `Water` now matches both Watercolor and Water), with a comment saying so. Update `PhysicsPaintToolRail.test.ts`: the lucide mock gains `WavesArrowDown`, every `slice(0, 4)` becomes `slice(0, 5)`, the expected title arrays gain `'Watercolor (A)'` and the Move/Edit copy becomes `Select (M)`, each with a one-line reason.

    **Suites whose pinned law this task RETIRES — each must be updated in this task, with the reason in the test** (the plan-checker found these; they fail after step 2/3 if left alone):
    - `aquarellePresetSelection.test.ts` L118-124 — "a preset pick issued while water/pen/lift is active flips the tool to brush": the loop asserts `toBe('brush')` for a `round` pick, and `round` is a watercolor-group preset, so that assertion becomes `toBe('watercolor')` (or the loop switches to a non-watercolor preset and a separate case proves the watercolor flip). Do not keep the retired expectation anywhere.
    - `brushGroupMedium.test.ts` L384-436 — the "one tip-pick caller and two medium-handler callers" law counts in-file occurrences: `selectAquarelleTip(` and `applyAquarelleMedium(` in `aquarelleRecordState.ts` each go from 1 to 2 when `selectAquarellePaintTool` lands. Raise both counts and rewrite the law's comment to name the new seam (the file-list assertions are unchanged — no new file gains either symbol).
    - `aquarelleLiftTipSelection.test.ts` L133-138 — "selectAquarelleTip stays the Brush-only seam (it still flips the tool)": same `round` pick; the seam still flips, but to `watercolor` for the watercolor group. Rewrite the title and the expectation.
    - `WatercolorBrushLibrary.test.ts` L539-558 and L560-575 — "picking a card selects the preset and forces the Brush tool" for `round/flat/detail` and `round/hake`: these presets are watercolor-group, so the tool is `watercolor` now. Keep one non-watercolor card case to prove the `brush` flip still happens.
    - `physicsPaintHandToolWiring.test.ts` L37 — the exact rail lucide import string must gain `WavesArrowDown` in alphabetical position.
    - `aquarelleWetPaintGate.test.ts` L99-110 — pins the rail's exact `disabled={railDisabled || wireframeActive || (id === 'water' && !wetAvailable)}`, the water click guard and the `waterGated ? 'Water (W) — needs standing water'` title. The gate strings must be byte-unchanged; only the surrounding tool table grows — if a literal moves, update the pin and say why.
    - `roto/aquarelleLiftEraseContract.test.ts` L585-586 — pins the exact single-line lift entries in both tool surfaces; the entries' shape stays, but re-verify the literals against the five-entry tables and update the pin if its slice indices assumed four.

    Update `vectorPathSession.test.ts`'s "the four paint tools stay closed" block to five members and five rail entries — rename the describe to say the union is additive-ly five while the engine stays four, and state the reason. Update `physicsPaintStudioKeyboard.test.ts`: `a → 'watercolor'` in the tool-key matrix; CONVERT the existing bare-`a` Select case (L749-753) to `m` — do not merely add an `m` case beside it — and add `m` to the "ignores modified/shifted/repeated" list while removing `a`; the Shift+A case is unchanged. Update `physicsPaintShortcutsHelp.test.ts`: the Move/Edit key list expects `'M'`, and the EXISTING exact `toEqual` array for the Paint Tools group ("documents the tool letters the Studio dispatcher owns") gains `'A'` in the intended position — extend that array, do not add a parallel assertion. Update `strokeSettingsModel.test.ts`: the canonical order pin becomes `['brush', 'watercolor', 'water', 'pen', 'lift']` for the flat categories, with a comment naming quick 261121-mtu. Update `PhysicsPaintStudio.test.ts`: the begin-edit source pin now expects `isAquarellePaintTool(aquarelleActiveTool.value)` and the Select tooltip pin expects `Select (M)`.
  </action>
  <verify>
    <automated>pnpm --dir packages/efx-watercolor build && pnpm --dir app exec vitest run src/components/physic-paint/view/aquarelleToolFamily.test.ts src/components/physic-paint/view/AquarelleToolRow.test.tsx.test.ts src/components/physic-paint/view/PhysicsPaintToolRail.test.ts src/components/physic-paint/view/physicsPaintStudioKeyboard.test.ts src/components/physic-paint/view/physicsPaintShortcutsHelp.test.ts src/components/physic-paint/view/strokeSettingsModel.test.ts src/components/physic-paint/view/vectorPathSession.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts src/components/physic-paint/view/aquarellePresetSelection.test.ts src/components/physic-paint/view/aquarelleLiftTipSelection.test.ts src/components/physic-paint/view/aquarelleWetPaintGate.test.ts src/components/physic-paint/view/WatercolorBrushLibrary.test.ts src/components/physic-paint/view/physicsPaintHandToolWiring.test.ts src/components/physic-paint/roto/aquarelleLiftEraseContract.test.ts src/components/physic-paint/performance/scriptTimelineCodec.test.ts src/components/physic-paint/view/brushGroupMedium.test.ts src/components/physic-paint/view/PhysicsPaintTopBar.test.ts</automated>
  </verify>
  <done>
    Both tool surfaces render Brush · Watercolor · Water · Pen · Eraser with the stated icons and shortcuts and route through one seam; a brush pick sets the tool from its group; A picks Watercolor, M toggles Move/Edit, Shift+A is unchanged; a recorded watercolor stroke lists under its own category, is path-editable and survives a script-codec round trip; the top bar keeps its settings cluster for Watercolor; every updated pin names the reason; all targeted suites pass.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Context-driven parameter panel, pure visibility selector, spec §3/§8</name>
  <files>
    app/src/components/physic-paint/view/aquarelleParamVisibility.ts,
    app/src/components/physic-paint/view/aquarelleParamVisibility.test.ts,
    app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx,
    app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts,
    app/src/components/physic-paint/view/AquarelleParamsPanel.test.tsx,
    app/src/components/physic-paint/view/aquarellePaintControls.ts,
    app/src/components/physic-paint/view/aquarellePaintControls.test.ts,
    app/src/components/physic-paint/view/mediumSelection.test.ts,
    app/src/components/physic-paint/view/PhysicsPaintRightSidebar.test.ts,
    SPECS/v2.2.0-medium-engine/parametres-du-pinceau.md
  </files>
  <behavior>
    - `visibleAquarelleParamRows(tool, mediumId)` returns exactly the rows marked ✓ in Matrix 2, in group order, for every one of the five tool values crossed with all five medium ids (plus a `null` medium resolving to `DEFAULT_MEDIUM_ID`).
    - `visibleAquarelleParamGroups(tool, mediumId)` drops empty groups and keeps the fixed order Medium · Paint & reservoir · Drying · Edge · Watercolor only · Eraser.
    - Reset in the acrylic context leaves refill at 0 and the selection patch carries refill 0; Reset in any other medium leaves refill at 60; Reset never writes `size` or `lift`.
    - The panel renders group headings with `data-testid="aquarelle-param-group-<id>"`, keeps `data-testid="aquarelle-globals-panel"` and `aquarelle-params-reset`, and each row keeps the existing slider behaviour and the Emboss 15 cap.
  </behavior>
  <action>
    **1. New pure selector module.** Create `app/src/components/physic-paint/view/aquarelleParamVisibility.ts` (no Preact, no DOM, no signals — pure data + one selector):
    - `AQUARELLE_PARAM_GROUPS` — frozen ordered list `[{id:'medium', label:'Medium'}, {id:'paint', label:'Paint & reservoir'}, {id:'drying', label:'Drying'}, {id:'edge', label:'Edge'}, {id:'watercolor', label:'Watercolor only'}, {id:'eraser', label:'Eraser'}]`.
    - `AquarelleParamRow` = `{key: AquarelleGlobalKey; label: string; group: AquarelleParamGroupId; min?: number; max?: number; paint?: readonly MediumId[] | 'all'; hiddenForMedia?: readonly MediumId[]; water?: boolean; lift?: boolean}`. Semantics: `paint` governs the three paint tools (absent = not a paint row; `'all'` = every medium; an array restricts); `hiddenForMedia` subtracts media inside the paint context only; `water`/`lift` add the Water tool and the Eraser contexts.
    - `AQUARELLE_PARAM_ROWS` — the THIRTEEN rows exactly as Matrix 2 states them (twelve canvas rows + the Eraser-context `lift` row; the 13-key count is what makes the Reset key set reproduce the `RESET_EXPECTED` patch). Keep the literal `{ key: 'load', label: 'Pigment'` token sequence intact (an existing sidebar source pin reads it). Emboss carries `max: 15`.
    - `visibleAquarelleParamRows(tool: AquarelleTool, mediumId: MediumId | null): AquarelleParamRow[]` and `visibleAquarelleParamGroups(...)` — flat list and grouped list (`{id, label, rows}`), computed from the context (lift → lift; water → water; otherwise paint with `mediumId ?? DEFAULT_MEDIUM_ID`). Export both; no side effects.

    **2. Panel rewrite.** In `app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx`: delete `GLOBAL_ROWS`; add narrow reads of `aquarelleActiveTool.value` and keep the existing `aquarelleSelectedMediumId.value` read; compute the groups with `visibleAquarelleParamGroups`; render each group as a wrapper `div` with `data-testid={`aquarelle-param-group-${group.id}`}` and a `RuleSectionHeader text={group.label}` (import from `../../shared/RuleSectionHeader`) followed by the rows. Keep ONE `GlobalSlider` passthrough (`onCommit={props.onCommit}` stays once), keep `GLOBAL_MIN`/`GLOBAL_MAX`/`EMBOSS_MAX`, keep the medium dropdown and its popover contract untouched.
    **Reset law (exact mechanism, D2):** the reset key set is `AQUARELLE_PARAM_ROWS.filter((row) => row.key !== 'lift').map((row) => row.key)` concatenated with `RESET_ONLY_KEYS` (`body`) — `lift` is never written (unchanged law). One loop: `const acrylic = aquarelleSelectedMediumId.value === 'acrylic'`; per key `const value = acrylic && key === 'refill' ? 0 : Math.round(DEFAULT_PARAMS[key] * 100);` then `setAquarelleParam(key, value)` and accumulate `next`; finally ONE `commitAquarelleSelectionParams(next)`. Do NOT modify `DEFAULT_PARAMS` and do NOT scope it per medium — the acrylic zero lives in this expression and nowhere else. Hiding the row never removes the key: `refill` stays in `AQUARELLE_GLOBAL_KEYS`, in the medium records, in the recorded stroke bag and in the Reset write set, so there is NO schema change and NO migration.
    **Lift row commit:** `commitAquarelleSelectionParam` (in `app/src/components/physic-paint/view/aquarellePaintControls.ts`, now a declared file) must edit the strokes of the row's own family. Inside that function choose the filter from the key: `key === 'lift' ? 'lift' : 'paint'` (`'lift'` is a valid `AquarelleStrokeTypeFilter`). Keep its signature `(key, value)` so the existing single-call source pin stays true; the live setter path is unchanged. Add the pin in `aquarellePaintControls.test.ts`: a `lift`-key release forwards `{ filter: 'lift' }`, a paint key keeps `{ filter: 'paint' }`.

    **3. Matrix pins.** Create `app/src/components/physic-paint/view/aquarelleParamVisibility.test.ts` — scalar, DOM-free. Pin per context the exact key list and its order (the five tool values × the five medium ids), the empty-group drop, and that `lift` is the only row in the Eraser context. Then add the Refill/preset pins (here or in `mediumSelection.test.ts`): after `applyAquarelleMedium('acrylic')` refill is 0 and the Refill key is absent from the acrylic paint row list while present for the other four media; after `applyAquarelleMedium('watercolor')` refill is 60; a same-group acrylic brush pick leaves refill 0; Reset with the acrylic medium selected writes 0 and the emitted patch carries 0; Reset with watercolor writes 60; Reset never includes `size` or `lift`.

    **4. Panel tests — update the retired flat pins deliberately.** `AquarelleGlobalsPanel.test.ts`: replace `GLOBAL_LABELS` and the twelve-row pin with the default context (Brush + Watercolor medium) — 11 rows in the order Viscosity, Emboss, Pigment, Pickup, Refill, Water, Dry speed, Flow, Bleed, Edges, Grain, with a comment stating that spec §8's grouping supersedes the old flat playground order (quick 261121-mtu). `RESET_EXPECTED` stays the thirteen-key patch for the default medium (its key set is unchanged); add an acrylic variant asserting refill 0. Keep the group-heading order pin and the "no Body row" pin. The emboss-cap case keeps working because Emboss renders in every medium. `AquarelleParamsPanel.test.tsx`: its seven-label "playground order" pin is now [Pigment, Water, Dry speed, Flow, Bleed, Edges, Grain] — replace the pin and comment why. `PhysicsPaintRightSidebar.test.ts` L38-42 reads `AquarelleGlobalsPanel.tsx` and asserts the exact substring `{ key: 'load', label: 'Pigment' }` — the row moves to `aquarelleParamVisibility.ts` with extra fields, so retarget that read to the new module and match the widened literal (`key: 'load', label: 'Pigment'` without requiring the immediately-closing brace). All three files: the label collectors must not double-count a row when a group heading shares a word.

    **5. Spec §3 and §8.** In `SPECS/v2.2.0-medium-engine/parametres-du-pinceau.md`: §3 Refill UI line becomes "curseur Refill — masqué quand le médium actif est Acrylique (valeur 0 imposée par le préréglage et par Reset) ; visible pour les autres médiums (décision différée)". §8 becomes the organization contract: the six groups in the fixed order, the visibility law driven by the active MEDIUM plus the active TOOL (not the tool alone), Body row-less/Reset-only, `wetSeconds` row-less, Lift only in the Eraser context, and an explicit note that the non-acrylic Refill exposure decision is DEFERRED (the row is shown and keeps 60 until the artist decides), plus the Water-tool row set flagged as the one judgment call.

    **6. SUMMARY obligations.** Mark the other-media Refill decision **DEFERRED**, and record the rejected alternative (filtering the brush-library sections) with its reason (three mount surfaces, reachability loss). Report automated-ready — never "done" — with UAT rows: (a) Paint panel per tool (Brush, Watercolor, Water, Pen, Eraser) and per medium (Acrylic, Watercolor, Gouache, Chalk, Graphite); (b) the tool row (order, icons, A/B/W/P/E, Water greyed on a dry sheet); (c) the acrylic preset (Feather 85, Emboss 3 visibly softer edge + light relief); (d) Refill absent for acrylic only and 0 through medium apply, brush pick and Reset; (e) A picks Watercolor, M toggles Move/Edit, Shift+A still selects all.
  </action>
  <verify>
    <automated>pnpm --dir packages/efx-watercolor build && pnpm --dir app exec vitest run src/components/physic-paint/view/aquarelleParamVisibility.test.ts src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts src/components/physic-paint/view/AquarelleParamsPanel.test.tsx.test.ts src/components/physic-paint/view/aquarellePaintControls.test.ts src/components/physic-paint/view/mediumSelection.test.ts src/components/physic-paint/view/PhysicsPaintRightSidebar.test.ts</automated>
  </verify>
  <done>
    The panel renders the six groups from the pure selector, driven by tool + medium; Refill is absent for acrylic and present for the other four media; the acrylic Reset writes refill 0 while every other medium writes 60 and Reset never touches size or lift; Lift renders only in the Eraser context and commits to lift strokes; the full matrix is pinned DOM-free; spec §3/§5/§8 state the new contract with the non-acrylic decision marked DEFERRED; all five targeted suites pass.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| stored project → payload validator | A `.mce` script can carry an arbitrary `engine.tool` string; the codec and roto schema decide whether it is paint data at all. |
| payload tool → engine tool | The payload union is now five members while the engine's is four; the mapping is the only place the two vocabularies meet. |
| panel render → signals | The panel reads three signals per render; a write in the render body would fan out to every subscriber. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-MTU-01 | Tampering | `engineAdapter.asTool` / `PAYLOAD_TOOL_TO_ENGINE` | medium | mitigate | A record-driven mapping makes `watercolor → brush` an explicit, pinned entry instead of the unknown-tool fallback; the fallback stays `brush` for genuinely unknown strings and is pinned separately so the two intents cannot be confused. |
| T-MTU-02 | Tampering | `AquarelleCanvasLayer.applyLiveConfig` tool write | medium | mitigate | The `as Tool` cast is removed; the engine only ever receives the four-member `Engine.Tool` through `engineToolForAquarelleTool`, so `'watercolor'` can never reach a `tool === 'brush'` branch. |
| T-MTU-03 | Denial of service | `AquarelleGlobalsPanel` render | low | mitigate | The visibility selector is a pure module (no signals, no writes); the panel adds one narrow `.value` read and keeps every write in event handlers (efx-preact-reactivity rules 5 and 6). |
| T-MTU-04 | Repudiation | Reset in the acrylic context | low | accept | The reset expression is the documented mechanism and is pinned by value; there is no user-facing audit trail to preserve for a local UI reset, and the undo entry comes from the existing ONE selection patch. |
| T-MTU-SC | Tampering | package installs | low | mitigate | No new package is installed: `lucide-preact@1.57.0` is already present and `WavesArrowDown` is verified in its typings. No legitimacy checkpoint is required. |
</threat_model>

<verification>
- **Build before any app-side check.** `app/vitest.config.ts` defines no aliases, so `@efxlab/efx-watercolor` resolves through the package's `exports` to the BUILT `dist/*.mjs`. Every app-side verify below is prefixed with `pnpm --dir packages/efx-watercolor build`; without it the app tests read the stale build and the new acrylic numbers / tool members are invisible.
- Targeted suites only (never watch, never the whole suite):
  - `pnpm --dir packages/efx-watercolor exec vitest run src/playground/mediums.test.ts src/payload/toStudioStroke.test.ts src/adapter/engineAdapter.test.ts && pnpm --dir packages/efx-watercolor build && pnpm --dir app exec vitest run src/components/physic-paint/roto/aquarelleLiftEraseContract.test.ts`
  - `pnpm --dir packages/efx-watercolor build && pnpm --dir app exec vitest run src/components/physic-paint/view/aquarelleToolFamily.test.ts src/components/physic-paint/view/AquarelleToolRow.test.tsx.test.ts src/components/physic-paint/view/PhysicsPaintToolRail.test.ts src/components/physic-paint/view/physicsPaintStudioKeyboard.test.ts src/components/physic-paint/view/physicsPaintShortcutsHelp.test.ts src/components/physic-paint/view/strokeSettingsModel.test.ts src/components/physic-paint/view/vectorPathSession.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts src/components/physic-paint/view/aquarellePresetSelection.test.ts src/components/physic-paint/view/aquarelleLiftTipSelection.test.ts src/components/physic-paint/view/aquarelleWetPaintGate.test.ts src/components/physic-paint/view/WatercolorBrushLibrary.test.ts src/components/physic-paint/view/physicsPaintHandToolWiring.test.ts`
  - `pnpm --dir packages/efx-watercolor build && pnpm --dir app exec vitest run src/components/physic-paint/view/aquarelleParamVisibility.test.ts src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts src/components/physic-paint/view/AquarelleParamsPanel.test.tsx.test.ts src/components/physic-paint/view/aquarellePaintControls.test.ts src/components/physic-paint/view/mediumSelection.test.ts src/components/physic-paint/view/PhysicsPaintRightSidebar.test.ts`
- Guardrail audit (grep, run against the final tree): no change under `packages/efx-watercolor/src/playground/` other than `mediums.ts`; `Engine.ts`'s `Tool` type still lists four members; `deposit.ts`'s `ENGINE_TOOLS` is four members and `assertAquarelleTool('watercolor')` throws (pinned); no reference to carrier, compositing, live-seed, capture-merge or seed-parity modules changed.
- Additive-contract audit: a payload fixture carrying each of brush/water/pen/lift round-trips byte-identically (existing codec tests), and a `watercolor` fixture validates.
- `pnpm --dir app exec tsc --noEmit` (typecheck) is optional but recommended after Tasks 1-2 because the closed `Record<ScriptStrokeTool, string>` maps must be complete — and requires a fresh package build first (the `types` field points at `dist/*.d.ts`).
</verification>

<success_criteria>
- Refill: hidden for acrylic, shown and 60 for the other four media; acrylic keeps refill 0 through medium apply, brush pick and Reset; `DEFAULT_PARAMS` untouched; other media never forced to 0.
- Acrylic preset: feather 85, emboss 3, every other number unchanged; the obsolete comment and spec §5 updated.
- Tool model: five-member additive payload union; explicit engine mapping; Brush · Watercolor · Water · Pen · Eraser on both tool surfaces; A/B/W/P/E shortcuts with M for Move/Edit; the tool→group matrix implemented exactly and the rejected library-filter alternative recorded.
- Panel: six groups in the fixed order, visibility driven by tool + medium per Matrix 2, Lift only in the Eraser context, Body/wetSeconds row-less, Reset and stored-bag semantics preserved.
- Pins: the matrix, the preset, the refill behaviour, the union, the icons and the shortcuts are all unit-pinned; every retired flat-list pin names its reason.
- No engine law moved; no migration; no push.
</success_criteria>

<output>
Create `.planning/quick/261121-mtu-refill-acrylic-only-three-paint-tool-cat/261121-mtu-SUMMARY.md` when done, with (a) the DEFERRED note for the non-acrylic Refill decision, (b) the rejected brush-library-filter alternative and its reason, and (c) the UAT rows listed in Task 3 step 6.
</output>
