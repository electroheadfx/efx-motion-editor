# Quick Task 261117-tq7: Cover pass erases pre-stroke wet ink and cached base - Context

**Gathered:** 2026-11-17
**Status:** Ready for planning

<domain>
## Task Boundary

Implement `SPECS/v2.2.0-medium-engine/GSD-QUICK-PROMPT-09-cover-wet-and-cache.md` exactly.

A Brush stamp with `coverAmount > 0` must erase the paint under its solid core in
every layer the underlayer can live in: mobile `ink` of the same engine, settled
`fixed`, and the cached base of a reopened frame (preview + authoritative bake).
The rim keeps mixing, the centre is replaced, `Body 0` stays byte-identical, and
the result survives leave/reopen, export and undo/redo.

</domain>

<decisions>
## Implementation Decisions

### preInk snapshot extent
- **Full document, always.** Two RGBA16F attachments at document size, lazily
  allocated only for a covering Brush stroke, disposed at stroke end, `clear()`,
  history travel and resize.
- Rationale: the engine caps the sheet at `MAX_DOC_LONG = 3072` and
  `MAX_DOC_PIXELS = 4_200_000` (`Engine.ts:267-268`), so the worst case is
  ~67 MB and it exists only for the duration of a covering stroke. Correctness
  beats the memory: the stroke can travel anywhere, so a clip would under-erase.
- No clipping, no threshold, no second size-dependent code path.

### Wet-ink fallback
- **Ship the ink cover and record the advection limitation.** `preInk` does not
  follow the fluid flow, so the subtraction is exact at snapshot positions and
  approximate after diffusion. If UAT shows over- or under-removal, keep the ink
  path and record the limitation rather than dropping to cached-base-only.
- No scope reduction to the cached base is pre-authorized; that would be a
  follow-up decision, not a silent fallback.

### Cooked-frame authority (double erase)
- **Mirror the Lift seam: the engine always emits, the Studio gates.** The engine
  emits one `onCoverDab` per cover draw with no display knowledge; the Studio
  resolves once per stroke whether a cached display needs the punch, exactly as
  `planAquarelleLiftErase` does for lift today.
- The cached-base layer stays a dumb sink: it punches what it is given.

### Bake seam depth
- **The authoritative bake must land in this quick task.** UAT rows 3
  (leave/reopen) and 7 (export) cannot pass without it, so it is in scope with no
  deferral option. If the bake investigation reveals an unexpectedly large
  refactor, stop and report before writing speculative code.

### Claude's Discretion
- Exact shape of the cover-capable sink (extend `AquarelleLiftPreviewSink` with a
  `kind: 'lift' | 'cover'` discriminator vs a sibling bridge) — whichever keeps
  the existing lift contract and its contract tests intact with the least
  disruption.
- How the `core` profile is expressed in `buildLiftCoverage` (new profile value
  vs a shape flag), provided the Lift's tip-shaped erase is untouched.
- Whether the ink subtraction lives in a new `inkCoverFS` program or reuses
  `liftFS` with different blending — provided Law 1's uniforms and profile are
  unchanged.

</decisions>

<specifics>
## Specific Ideas

- Verified anchors at HEAD `fe4b2531e`:
  - `coverPass` `Engine.ts:2278-2298` (writes `fixed` + `relief` only)
  - stroke start `Engine.ts:1931-1941` (`if (!s.started)` branch, before first
    `stampScripted`)
  - `coverAmount` derivation `Engine.ts:2088-2103`, `COVER_GAIN = 2` at `:173`,
    `RELIEF_ERODE = 0.5`
  - lift dab emit `Engine.ts:2446`, callback type `Engine.ts:120`
  - `uCover` core profile `shaders.ts:307-334`
  - settle `shaders.ts:289-298`, applied `Engine.ts:2544-2556`
  - cached base `AquarelleCachedBaseLayer.tsx:60-129`
  - lift bridge `aquarelleLiftPreview.ts:56-80`
  - punch `aquarelleLiftErase.ts:352, 456`
  - forwarding `PhysicsPaintCanvasMount.tsx:230`,
    `AquarelleCanvasLayer.tsx:415, 625`
  - Studio gating precedent `PhysicsPaintStudio.tsx:7972-7993`
- `neutral-identity` probe lives in `probe/medium-engine` (6/6 fields) and must
  stay byte-identical.

</specifics>

<canonical_refs>
## Canonical References

- `SPECS/v2.2.0-medium-engine/GSD-QUICK-PROMPT-09-cover-wet-and-cache.md` — the
  authorizing spec (laws, scope, UAT rows 1-7, non-goals).
- Commit `fe4b2531e` — the post-UAT tuning this spec is written against
  (`SCATTERING_MAX = 1`, `COVER_GAIN = 2`, `EMBOSS_GAIN = 2.3`, acrylic preset
  pigment 100 / body 85 / emboss 40).
- Spec 06 (the cover pass) and spec 08 (scattering) — prior art this builds on.

</canonical_refs>
