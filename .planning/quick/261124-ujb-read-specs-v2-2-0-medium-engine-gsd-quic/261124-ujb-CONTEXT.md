# Quick Task 261124-ujb: Edge transparency and falloff for the Brush family - Context

**Gathered:** 2026-11-24
**Status:** Ready for planning

<domain>
## Task Boundary

Implement SPECS/v2.2.0-medium-engine/GSD-QUICK-PROMPT-10-edge-transparency.md exactly.

Two new bristle-only sliders — Edge transparency (amount) and Edge falloff (shape bias) — feeding one lateral `edgeFilm` that scales the whole carried film (coverage + cA/cB/alpha through `featherFade`, plus the scatter S through `g.film`). Neutral at amount 0; rim inert at amount 100. Canonical params, medium records, Studio rows hidden for watercolor/Water. No uniform opacity, no alpha-law change, no Body change. Tests first, probe, UAT rows 1-9.

</domain>

<decisions>
## Implementation Decisions

### Medium record placement
- `edgeFade` and `edgeFalloff` live INSIDE the Gouache/Pen medium records (`mediums.ts`), carrying defaults 0 and 50.
- Reset restores 0 / 50; re-picking a medium resets both (D-03), same as every other medium param.
- The medium record stays the source of truth; update the key pin in `mediums.test.ts` (sixteen keys).

### Falloff direction
- Slider 0 = broad (transparency reaches mid-width), 50 = linear, 100 = rim (fade hugs the silhouette).
- Exponent map stays `edgeFalloffExponent(bias) = 2^(2b - 1)` → 0.5 / 1 / 2.
- Do not invert; do not add a second curve.

### Edge lateral units (research finding 9)
- Normalize the lateral coordinate to the VISIBLE silhouette, not the nominal footprint: `u = clamp(lateral / uFeatherEdge, 0, 1)`.
- The visible rim therefore reaches exactly `1 - amount` (inert at 100), and the spec's landmark table holds in visible units.
- `uEdgeStart` is silhouette-relative too: 0.55 = "55 % of the visible rim", i.e. the fade band is the outer ~45 %.
- Cells beyond the silhouette (`lateral > 0.66`) clamp to `u = 1`, so surviving outer stragglers take the full rim factor — at amount 100 they go inert and the edge narrows. This is the intended look, not a threshold change; state it in the law's comment so a later reader does not "fix" it.
- The pure twin `bristleEdgeFilm(lateral, amount, falloff)` takes `lateral` in SILHOUETTE units (1 = the visible rim); document that.

### Claude's Discretion
- Exact research path for the probe scenario and baseline captures.
- Whether `preInk`-style transient targets are needed (they are not — this is a gather-time factor).
- Test file placement, following existing source-pin patterns.

</decisions>

<specifics>
## Specific Ideas

- The law is frozen: `film(0) = 1` always, `film(rim) = 1 - amount` always, amount 0 inert by construction, non-finite inputs neutral.
- Mirror the caps' pattern (`featherFade` at `shaders.ts:1298-1306`) rather than inventing a new attenuation path.
- The rim at amount 100 must be inert — no deposit, no erase — not an eraser.
- `bristleCoverFS` needs no edit; the cover endpoint carries the factor automatically.
- No second fade in the attenuation half of `bristleDepositFS`.

</specifics>

<canonical_refs>
## Canonical References

- `SPECS/v2.2.0-medium-engine/GSD-QUICK-PROMPT-10-edge-transparency.md` (the law and its anchors, verified against 284b174e8)
- `SPECS/v2.2.0-medium-engine/GSD-QUICK-PROMPT-09-cover-wet-and-cache.md` (delivered by quick 261117-tq7 — do not reopen)
- Project skills: `efx-studio-paint`, `spike-findings-efx-motion-editor`

</canonical_refs>
