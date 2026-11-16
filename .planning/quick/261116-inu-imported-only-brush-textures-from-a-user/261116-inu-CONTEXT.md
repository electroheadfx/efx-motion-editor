# Quick Task 261116-inu: Imported-only brush textures from a user-level library, 512x512 - Context

**Gathered:** 2026-11-16
**Status:** Ready for planning

<domain>
## Task Boundary

Textures become a machine-level user library, not app content and not project content:
no texture ships with the app, imported masks live in `~/.config/efx-motion/brushes/`,
the imported mask is 512x512, the brush size control becomes a true document-pixel
diameter (1-512 px), and a projected-texture rotation rides each stroke.

Authoritative spec: `SPECS/v2.2.0-brush-tips/GSD-QUICK-PROMPT-04-user-texture-library.md`.
Its "law to enforce" block, guardrails and acceptance list are binding. Where this
context is silent, the spec decides.

</domain>

<decisions>
## Implementation Decisions

### Brush size control
- Classic `SliderStepper`, linear 1..512, exactly like the app's other sliders. No logarithmic or any other position mapping.
- The displayed number IS the printed diameter in document pixels. 512 shown = 512 px on canvas. No conversion is ever visible.
- WYSIWYG at both ends of the range. The control always displays document pixels; the internal canonical value is never surfaced.
- Consequence accepted: the internal stored canonical value may leave its 1..800 track bounds at both ends (below 1 at S=1, above 800 at S=512 on small presets). The 1..800 range remains only the legacy stroke-settings slider range. The engine stays the source of truth; the UI never lies. No clamping of the stored value.
- **The engine's size floor is removed.** `sizeToEngineScale` (`packages/efx-watercolor/src/playground/params.ts:60-65`) currently clamps its `sizePx <= 32` branch with `Math.max(0, sizePx / 32)`, so `sizeMult` bottoms at 1/3 and Round could never paint below 28.8 px at a 1080-tall canvas. That single `Math.max(0, ...)` clamp is removed, leaving `return sizePx / 32;`. Negative canonical values never occurred before this task, so every existing recorded stroke (`canonical >= 1`) replays byte-identically and the 32..80 and 80..800 branches are untouched.
- Lift/eraser size is untouched: it keeps its existing 1..80 control and is never written by the paint size control.

### Rotation UI
- The -180..180 rotation stepper lives in the floating Textures modal only, directly under the Brush size control, next to the chip strip.
- The top-bar popover stays a fast picker: chips plus "Open modal". No rotation control there.
- `catalog.json` is written on release / step commit, not per drag tick.

### Retired built-in ids
- No retired-id table, no special case. `wc/builtin-bristle`, `-chalk`, `-sponge` resolve as generic missing textures and take the existing one-aggregate-warning fallback path.
- This follows the spec guardrail "remove every `wc/builtin-*` reference" and the clean-break rule.

### Claude's Discretion
- Everything else follows the spec's law verbatim: the px <-> canonical mapping formulas, the 512 mask edge with `TIP_SIZE` left at 192, mipmapped LINEAR sampling, the AQTL v3 -> v4 bump, the Rust-owned library commands, and the removal of the project/script carriers.
- The exact helper name and module for the px <-> canonical mapping.
- The exact delete-confirmation presentation, provided it is a single confirmation scoped to the Textures surface focus.

</decisions>

<specifics>
## Specific Ideas

- Size law, verified against the engine during discussion:
  `Engine.radius()` (Engine.ts:1757) computes
  `r = (b.size[0] + (b.size[1]-b.size[0])*t) * speedThin * sizeMult(widthFactor) * 0.8`,
  and `sizeMult()` (Engine.ts:1676) is `3^((params.size - 0.5) * 2)`.
  `stampFS` divides tip-space `q` by `uRadius` in aspect-corrected UV units, so a footprint
  radius `r` is `r * dh` document pixels. Therefore `workingHeight` in the spec's law is
  `Engine.dh`, and diameter `S = 2 * r * dh`. The spec's formulas are the exact inverse.
- `sizeToEngineScale` is module-private in `packages/efx-watercolor/src/playground/params.ts`
  and is not injective on 32..80 (both map to 1.0), so its inverse must take the
  `canonical = scale * 32` branch for `scale <= 1`.
- `Engine.scriptScale` also multiplies the footprint when scripting with a `maxRadius` cap;
  the 512 +/- 1 px guarantee is stated for the Round reference at full pressure, zero speed.

</specifics>

<canonical_refs>
## Canonical References

- `SPECS/v2.2.0-brush-tips/GSD-QUICK-PROMPT-04-user-texture-library.md` — the binding spec.
- `SPECS/v2.2.0-brush-tips/GSD-QUICK-PROMPT-03-texture-axis.md` — the texture axis law this builds on.
- `.planning/quick/261116-gcn-*/261116-gcn-SUMMARY.md` — the Textures surfaces (top-bar popover + floating modal) this targets.
- `.planning/quick/261115-oh9-*/261115-oh9-SUMMARY.md` — the texture axis quick.

</canonical_refs>
