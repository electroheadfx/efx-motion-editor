# Quick Task 261115-oh9: Texture becomes a setting of the brush response - Context

**Gathered:** 2026-11-15
**Status:** Ready for planning

<domain>
## Task Boundary

Split the conflated "brush" axis into two:

- **Brush response** — the engine-level painting behaviour (footprint size curve,
  spacing, scatter, water/load/flow, roughness, stamp jitter). These are the
  `BRUSH_PRESETS` entries: `round`, `chalk`, `flat`, `dry`, `sponge`, …
- **Texture** — the 192×192 stamp the response stencils through: Default (the
  response's own procedural tip), the three compile-time built-ins
  (`wc/builtin-bristle`, `wc/builtin-chalk`, `wc/builtin-sponge`), or a project
  import (`wc/custom-*`).

Today a registered mask wins the whole brush: `buildBrushForStroke` builds from
`CUSTOM_BASE` for any id with a mask, silently discarding the response the user
picked. Every textured tip therefore paints as a generic watercolor with a
texture. Source spec: `SPECS/v2.2.0-brush-tips/GSD-QUICK-PROMPT-03-texture-axis.md`.

</domain>

<decisions>
## Implementation Decisions

### The law
- The response ALWAYS owns the physics; the texture only replaces the footprint.
- `build(brushId, textureId, overrides)`:
  `base = presetFor(brushId)`; `tip = textureId ? resolveMask(textureId) ?? base.tip : base.tip`;
  `brush = buildBrush({ ...base, tip })`; then apply the 8 multipliers.
- `CUSTOM_BASE` is no longer reachable from any texture path. No UI brush is
  ever built from it (leaf it exported, unused by this path).
- An unknown or unavailable `textureId` falls back to the response's own
  procedural tip — never throws, never changes the response, never blanks.

### Default = no texture
- The Default texture chip means "no texture" and must show the **selected
  response's own procedural tip** through the real-mask pipeline. It repaints
  when the response changes — it must show exactly what will stamp, never a
  static neutral glyph.

### Legacy strokes — clean break, no recovery
- The user abandons phase-63 projects; no recovery, no migration, no legacy
  mapping table additions.
- A legacy stroke whose `brushId` is a texture id replays through today's
  `presetFor` fallback → `round`. Accepted loss, stated in the SUMMARY.
- Existing `TIP_TO_PRESET` entries (`wc/round-medium` → `round`, …) stay as
  they are; do not repurpose or extend them.

### Builder API
- Options object: `buildBrushForStroke(brushId, { textureId?, overrides?, seed? })`.
  Self-documenting at ~50 call sites, impossible to confuse texture with
  overrides, phase 64's extra axes stay additive.

### Selection model
- `aquarelleSelectedTipId` keeps its name; its values become response ids
  (`round`, `chalk`, `flat`, …). Picking a card never sets a texture.
- A new Studio-realm signal `aquarelleSelectedTextureId: string | null`
  (default `null`) sits beside it. Applied in the click handler, never in an
  effect.
- The one live/record binding seam is `aquarelleBrushForActiveTool()`; it
  returns `textureId` too, so live, record and bake can never disagree.
- The Lift (eraser) has NO texture: it keeps its own shape ids and a neutral
  texture (`null`).

### UI
- `WatercolorBrushLibrary`: grid lists responses only (the Texture and Custom
  sections are removed); a texture row sits above the grid — Default chip
  first, then the three built-ins, then project imports; each texture chip
  renders the real 192×192 grayscale mask (dark ground, white footprint), not
  a painted watercolor stroke. Response cards keep their painted-stroke thumbs.
  The "Import tip" control belongs to the texture row; an import selects on
  arrival.
- `PhysicsPaintBrushMenu` (top-bar popover): responses in the list, a texture
  strip pinned below the scrollable list (the spec says "below it"). The
  eraser branch keeps its shape list and gains no texture strip.
- The unavailable-tip behaviour (greyed unselectable chip + exactly one
  aggregate warning line) moves onto the texture chip.

### Payload
- `textureId` rides beside `brushId` on the stroke and in the payload
  (`AquarelleStrokePayload` / `AquarelleStroke`); optional, absent is valid.
- `codec.ts` validates it (string when present) and round-trips it without
  bumping `schemaVersion` (absence is the documented default, the
  anchors/curveMode precedent).
- Roto script events carry it unchanged; `referencedCustomBrushIds` must read
  the textures referenced by the capture so a save refuses only for a texture
  that cannot travel.

</decisions>

<specifics>
## Specific Ideas

- Reference behaviour the user stated directly: "each brush response can have a
  texture — the 3 defaults or new imports; by default no texture (current
  engine); the selected texture defines the brush's shape."
- Texture chips show the real mask (dark ground, white footprint), matching the
  brush-mask art in `SPECS/v2.2.0-brush-tips/assets/`.

</specifics>

<canonical_refs>
## Canonical References

- `SPECS/v2.2.0-brush-tips/GSD-QUICK-PROMPT-03-texture-axis.md` — the source spec
  (law, work items, hard exclusions, acceptance, verification).
- `SPECS/v2.2.0-brush-tips/GSD-QUICK-PROMPT-02-embedded-tips.md` — the shipped
  carriers (package `asset` refs / script inline `maskDataUrl`) this quick must
  not break.
- `packages/efx-watercolor/src/brushes/pack.ts` — the entry law; do not change
  the pack shape.
- `app/src/components/physic-paint/view/aquarelleRecordState.ts` — the one
  live/record binding seam.
- `.claude/skills/` — `efx-preact-reactivity` rules (signals only, no
  `useState`, selection in the click handler, narrow signal reads).

</canonical_refs>
