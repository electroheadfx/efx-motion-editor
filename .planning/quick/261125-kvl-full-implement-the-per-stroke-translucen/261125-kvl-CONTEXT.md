# Quick Task 261125-kvl: per-stroke translucent stroke layer (Edge transparency) - Context

**Gathered:** 2026-11-25
**Status:** Ready for planning

<domain>
## Task Boundary

Implement the per-stroke translucent stroke layer for Edge transparency exactly as frozen by spike 006 — engine targets, deposit routing, the lateral field, the stroke-end merge, the live display branch, the Studio wiring and the Spec 10 parameter plumbing.

The composite law, the encoder (8 compiled bands `[1,3,5,7,9,10,11,13]`, rank-one Jacobian, 4 LM iterations, seed `mix(base, layer, aEff)`, in-place merge writing `fit − fixed`) and the amount-0 bypass are **FROZEN**. They are not design surface for this task.

In scope: engine + Studio wiring. Out of scope: density/colour falloff, feather-noise work, any sheet-format change, any uniform/global stroke opacity, any display-alpha change, and the two pre-existing engine facts (stroke-start direction inheritance, capture-bbox drift) which must NOT be fixed.

</domain>

<decisions>
## Implementation Decisions

### Mid-stroke interruption
- The layer is **DISCARDED** when a stroke is interrupted before its stroke-end (key leave, tool switch, sheet reset): clear the layer targets and leave the sheet exactly as it was before the stroke began.
- No merge runs on an interrupted stroke. No partial paint lands.

### Layer allocation
- Layer targets are allocated **lazily, on the first stroke whose `edgeTransparency > 0`**, and kept for the engine's lifetime.
- At `edgeTransparency = 0` no layer target is ever allocated and no merge draw is ever submitted — this is gate row G4 and must be proven, not assumed.
- Targets are cleared (not freed) at every stroke end.

### Delivery shape
- **One quick**, staged internally along the design's own four stages, executed as sequential tasks on the main tree (worktrees are disabled in this repo's config).
- The quick ends at **automated-ready**; the live UAT rows are handed to the artist, never claimed here.

### Source commits for the Spec 10 plumbing (factual correction to the brief)
- The brief names `e08e356f9` as the source of the plumbing. Verified: `e08e356f9` carries the **records, UI rows and app tests** (`mediums.ts`, `aquarelleRecordState.ts`, `aquarelleParamVisibility.ts`, `mediumSelection`/`brushGroupMedium`/`AquarelleGlobalsPanel` tests).
- The **canonical params and the engine uniform plumbing** (`params.ts` `edgeFade`/`edgeFalloff`, `Engine.ts` `Params` defaults and `uEdgeStart`/`uEdgeFade`/`uEdgeFalloff` bindings) live in `1c5a27f4b`.
- Therefore the re-application must take **selected hunks from `1c5a27f4b`** (params + uniform bindings only) **plus the whole of `e08e356f9`'s record/UI/test surface**, excluding every film-law hunk (`bristles.ts` `bristleEdgeFilm`, `g.film` in `Gathered`, the `shaders.ts` film term, and the six law commits after `1c5a27f4b`).

### Claude's Discretion
- Probe scenario shape and naming (the design calls it `edge-layer`), the exact target formats and bind points, and the internal task decomposition across the design's four stages.

</decisions>

<specifics>
## Specific Ideas

- **The frozen composite**, per display band `i` over the 16 display bands:
  `u = clamp(MIN over covering dabs of |across| / uFeatherEdge, 0, 1)`, `uFeatherEdge = 0.66`;
  `t = clamp((u - 0.30) / 0.70, 0, 1)`; `e = 2^(2b - 1)`; `A = 1 - amount·t^e`; `A_eff = A · cover_L`;
  `band_out,i = A_eff·band_L,i + (1 - A_eff)·band_S,i`; `S_out` likewise.
  `band_*` is the display band value — Kubelka-Munk reflectance over white when `S > 1e-3`, legacy `exp(-k)` otherwise. Never a transmittance.
- **Cover and relief**: `cover_out = 1 - (1 - cover_sheet)(1 - A·cover_L)`; `relief_out = relief_sheet + A_eff·relief_L`.
- **The merge** samples `ink.read + fixed + cover.read` and writes in place: `ink.write = fit - fixed`, `cover.write = cover_out`, `fixed` untouched. Display reads `ink + fixed = fit`.
- **The amount-0 bypass is a branch, not a value.** At `amount 0`, `A_eff = cover_L` drops the same-visit pickup by 203/255; the shipped path must run instead and be byte-identical to `d509a886d`.
- **Amount-0 reference digest**: `36a3f71d` for the Q4 scene (paper `cold`, seed `0xc0ffee`, strength 1, Body 100, `bristle-round`, two straight strokes on a fresh engine with `lastDir [1,0]` / `lastAngle 0`).
- **The merge runs once, at stroke end, for pointer AND scripted strokes**, before `onStrokeEnd`, inside the stroke's undo transaction (the design's stages 1-4; Q4 gate rows G1-G5).
- **Pickup stays sheet-side** and the layer's own wetness is not simulated — document it and give it a UAT row.

</specifics>

<canonical_refs>
## Canonical References

- `SPECS/v2.2.0-medium-engine/DESIGN-stroke-layer-transparency.md` — the design and the frozen law (§3, §7).
- `SPECS/v2.2.0-medium-engine/SPIKE-stroke-layer-FINDINGS.md` — the measured law; §2.2 (encoder), §2.3 (bypass) and §4.4 (write-back) are FROZEN.
- `.planning/spikes/006-stroke-layer-transparency/RESUME.md` — reuse rules, the amount-0/merged reference digests, and the two pre-existing engine facts.
- `.planning/quick/261124-ujb-read-specs-v2-2-0-medium-engine-gsd-quic/261124-ujb-SUMMARY.md` — the six rejected parameter laws; no parameter-law form may be reintroduced.
- `.planning/spikes/006-stroke-layer-transparency/probe/` — the re-runnable harness (`law.ts`, `sheet.ts`, `bands.ts`, `merge.ts`, `q4.ts`); the GLSL merge pass and the display mirror live here.

</canonical_refs>
