# Phase 56: efx-watercolor (engine 2, paint-aquarelle, clean-room) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-15
**Phase:** 56-efx-watercolor-engine-2-paint-aquarelle-clean-room
**Areas discussed:** Module switcher surface, Aquarelle options panel, Paper library picker, Aquarelle tool surface

---

## Module switcher surface

| Option | Description | Selected |
|--------|-------------|----------|
| Segmented 3-slot | Three-position control in the top bar (like a segmented tab). Always visible, one click to switch. Matches the "three slots" wording literally. | ✓ |
| Icon + dropdown menu | Single icon showing the active module; click opens a 3-item menu. Compact, but costs an extra click per switch. | |
| Icon cycle button | One icon that cycles Brush → Water color → Krita on click. Smallest footprint, but Krita-inert makes cycling awkward. | |

**User's choice:** Segmented 3-slot

| Option | Description | Selected |
|--------|-------------|----------|
| Panels drain, doc stays | Panels swap to the selected module's own options/features immediately. The document and timeline stay put. Matches MOD-02. | ✓ |
| Panels + active layer kind | Panels drain AND the active paint layer switches to the module's layer kind. Couples the switcher to layer creation. | |
| Guard on foreign layer | Confirm dialog when the current layer is a different engine. Safer, but adds friction to a frequent action. | |

**User's choice:** Panels drain, doc stays

| Option | Description | Selected |
|--------|-------------|----------|
| Greyed slot + tooltip | Krita appears in the segmented control but is greyed out with a "coming in v2.1.0" tooltip. Visible roadmap promise, zero interaction cost. | ✓ |
| Clickable, shows note | Krita is visible but clicking it shows a small inline note instead of switching. | |
| Hidden until v2.1.0 | Krita slot hidden entirely until v2.1.0. Cleaner bar now, but loses the visible promise. | |

**User's choice:** Greyed slot + tooltip

| Option | Description | Selected |
|--------|-------------|----------|
| Text labels | Text labels "Brush \| Water color \| Krita" (optionally with a small icon). Maximally clear, slightly wider bar. | ✓ |
| Icon-only slots | Icon-only segmented control (brush / droplet / palette icons from lucide-preact). Compact, but Krita icon is abstract. | |
| Icon + text each | Icon + text label on each slot. Clearest and most discoverable, widest footprint. | |

**User's choice:** Text labels

---

## Aquarelle options panel

| Option | Description | Selected |
|--------|-------------|----------|
| Globals first, brush response below | One scrolling panel: globals as primary sliders, per-brush multipliers in a collapsible "Brush response" section below. | ✓ (extended) |
| Two tabs: Paint / Brush | Two tabs inside the aquarelle panel: "Paint" (globals) and "Brush" (tip + properties + multipliers). | |
| Inline multiplier chips | Per-brush multipliers inline beside each global slider (e.g. a small ×1.2 chip on the water row). | |

**User's choice:** Globals first, brush response below — **PLUS a shared-vs-module param split for the right sidebar (all modules):**
- SHARED globals, always visible regardless of active module: Color (engine-specific mixing underneath — spectral for watercolor), Size (one slider for all paints; AQUA-04's "size" maps here, no duplicate size control), Opacity, Paper (id + strength + scale — state lives on the fond per PAPER-03, controls are global because paperPass serves ALL paints per PAPER-02)
- MODULE-ONLY, shown only while that module is active (MOD-02): Water color → water, load, flow, bleed, dry, edge, granulation + tool selector (brush|water|pen|lift) + tip + per-brush multipliers; Brush (Physic) → its own physics param bag; Basic / FX → their own
- Never show watercolor params inside the Brush module panel, and vice versa. Right sidebar is the single home; scope = active module.

| Option | Description | Selected |
|--------|-------------|----------|
| Sliders + readout | Slider for continuous params with a numeric readout; stepper only where integers matter. Matches the existing SliderStepper/NumericStepper pair. | ✓ |
| Steppers everywhere | All params use NumericStepper-style ±1 controls with free entry. | |
| Slider + free entry | Sliders with EU-comma free entry on the readout. | |

**User's choice:** Sliders + readout

| Option | Description | Selected |
|--------|-------------|----------|
| Tip picker popover | A tip picker at the top of the module section (thumbnail grid popover). | |
| Always-visible tip strip | Always-visible horizontal tip strip (14 thumbnails + import tile) above the sliders. | |
| Separate Brushes tab | Tip lives in a separate "Brushes" tab beside the Paint tab. | |

**User's choice:** None of the above — **Krita-style brush panel** (reference: Krita "Brushes" docker layout), NOT a popover and NOT a horizontal strip. Structure, top to bottom: toolbar (add / import custom PNG/JPG tips / view-mode toggles); category filter ("All categories" dropdown) + search field; VERTICAL scrolling list grouped by collapsible CATEGORY, each group with a brush count (e.g. "MB Brushes 2026 — 93"); one row per tip: thumbnail (vignette) + name + favorite star; footer: selected brush preview + total brush count. Categories are part of the data model, not just display: the 14 base tips ship grouped (round / flat / texture / experimental), and custom imported tips land in a user category. This scales to Krita later (v2.1.0) where brushes are category-organized — same panel, no rework. Selecting a tip loads its per-brush multipliers into the Brush response surface below. Custom import lives in the toolbar (+ / folder), not as a tile at the end of the list. (Screenshot attached: Krita "Brushes" docker.)

| Option | Description | Selected |
|--------|-------------|----------|
| 8 ×multiplier sliders | Each of the 8 params gets a ×multiplier slider (0.5–2.0 range) in the collapsible "Brush response" section, showing the computed effective value next to it. | ✓ |
| Per-tip exposed subset | Only expose multipliers for the params a tip actually varies. Shorter list, but the data model still carries all 8. | |
| Merged global+multiplier rows | One row per param: global slider on the left, ×multiplier chip on the right of the same row. | |

**User's choice:** 8 ×multiplier sliders (0.5–2.0 range) with computed effective value shown next to each

---

## Paper library picker

| Option | Description | Selected |
|--------|-------------|----------|
| Thumbnail grid popover | A paper picker in the shared panel opening a thumbnail grid of the 13 papers. Name + small preview swatch per paper. Compact, one click. | ✓ |
| Docker-style list panel | Krita-docker-style vertical list like the Brushes panel. Consistent with the tip picker, but heavier for 13 items. | |
| Always-visible swatch strip | Horizontal swatch strip of the 13 papers above strength/scale. Always visible, but 13 swatches eat width. | |

**User's choice:** Thumbnail grid popover

| Option | Description | Selected |
|--------|-------------|----------|
| Beside the picker | Strength + scale sliders sit in the shared panel directly under the paper picker. State still lives on the fond (PAPER-03). | ✓ |
| Dedicated Fond section | Paper controls live in a dedicated Fond inspector section, separate from the paint panel. | |
| Floating dialog | Paper picker + strength/scale in a small floating dialog (like the camera icon dialog from Phase 50). | |

**User's choice:** Beside the picker

| Option | Description | Selected |
|--------|-------------|----------|
| Raw paper tile | Each grid cell shows the raw paper tile (height-map lit relief for procedural, the jpg for real scans). Fast, deterministic. | ✓ |
| Sample stroke composite | Each cell shows a fixed sample stroke composited over that paper. | |
| Tile + hover preview | Raw tile by default; hovering shows a larger sample-stroke preview. | |

**User's choice:** Raw paper tile

| Option | Description | Selected |
|--------|-------------|----------|
| One library, grouped | The 3 recovered real papers sit in the same grid under a "Real" group header alongside the 10 procedural ones (grouped Procedural / Real). | ✓ |
| Distinct visual section | Real scans get a visually distinct section (divider or different border). | |
| Procedural \| Real tabs | Separate tabs inside the picker: Procedural \| Real. | |

**User's choice:** One library, grouped

---

## Aquarelle tool surface

| Option | Description | Selected |
|--------|-------------|----------|
| Module-scoped tool row | A 4-button tool row (brush \| water \| pen \| lift) inside the aquarelle module section of the right sidebar, above the sliders. Scoped to the module. | ✓ |
| Canvas-toolbar toggle | A grab-any-rail style mode toggle on the canvas toolbar that swaps between the 4 tools. | |
| Shortcuts + indicator | Keyboard shortcuts B/W/P/L swap tools, with a small indicator in the panel. | |

**User's choice:** Module-scoped tool row

| Option | Description | Selected |
|--------|-------------|----------|
| Switcher owns engine, mode stays in Brush | The module switcher owns engine choice (Brush \| Water color \| Krita). The existing PaintModeSelector (Normal/Physics) stays inside the Brush module only. | ✓ |
| Aquarelle gets its own mode toggle | Aquarelle also gets a Normal/Physics-style toggle (e.g. flat vs fluid). | |
| Retire PaintModeSelector | Fold Normal/Physics into the Brush module's own panel as a param. | |

**User's choice:** Switcher owns engine, mode stays in Brush

| Option | Description | Selected |
|--------|-------------|----------|
| Water tool is the wetting tool | No separate Wet/Dry tools. The `water` tool wets the paper; physics evolves per diffusionFrames. Dry tool out of scope. | |
| Dry as an action button | A Dry action button in the module panel (not a paint tool) that forces the current frame's physics to settle immediately. | |
| Water param + Dry action | A Wet slider (already covered by `water`) plus a Dry-now action. | |

**User's choice:** **Dry must exist AND be recorded in the script (AQUA-06 determinism).** Dry is a user action (flash-dry the sheet), NOT a 5th paint tool: AQUA-02's brush|water|pen|lift stay the only tools with pts/brush payload. Dry IS recorded in the script as a timeline event (dry at tick T, same stroke ordering / tick grid), because it changes the wet state of the sheet — without it, replay cannot reproduce the cooked look. Replay fires the dry event in order between strokes → same pixels. This does NOT conflict with "Forced Dry at frame boundaries is prohibited": that lock is about the pipeline auto-drying at boundaries; user-initiated Dry is an explicit, recorded gesture. UX shape (option 2 family): Dry action button in the aquarelle module panel, not a canvas tool. Combines with the existing `water` param / water tool for wetting (option 3's spirit).

| Option | Description | Selected |
|--------|-------------|----------|
| Dry as payload event kind | Dry rides the same per-engine stroke payload as a distinguished event kind (no pts, no brush, just tick + dry). One payload union, one ordering law, one codec. | ✓ |
| Separate events array | A separate script events array beside the strokes array. Two ordering surfaces to keep in tick order. | |
| Flag on next stroke | A dry flag on the following stroke. Compact, but breaks if Dry is the last gesture before Apply. | |

**User's choice:** Dry as payload event kind

---

## Claude's Discretion

- Exact file layout inside `packages/efx-watercolor` (engine / shaders / brushes / papers), as long as the engine is Preact-free and implements `EngineAdapter<P>`.
- The exact category taxonomy names for the 14 base tips (round / flat / texture / experimental are the intended groupings).
- Param default values and slider ranges for the 8 globals (the ×multiplier band 0.5–2.0 is decided).
- Commit sequencing of engine-core / script / bake / paper / switcher tranches.

## Deferred Ideas

- **Text / Shape / Fill / Hand tools** — out of v2.0.0 scope (locked 2026-10-06). Fill is the one plausible later add.
- **Krita module implementation** (libmypaint WASM + `.myb` pack) — v2.1.0 slot (KRT-01).
- **Engine-1 spectral adoption** (KRT-02) — v2.1.0, Q5-gated at milestone close.
- **User-imported paper scans** (PAPR-05) — v2.2+.
- **Fill tool (bucket wash)** (TOOL-01) — own tranche, later release.
- **Export smoke + chunk-budget checks** — release gates (watch the 2000 kB vite ceiling).
- **4th paint layer-kind naming** (Water / Aquarelle / Wash) — UI-SPEC scope (spec Q7).
