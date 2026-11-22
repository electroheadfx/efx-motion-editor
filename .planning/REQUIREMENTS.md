# Requirements: EFX-Motion Editor — v2.2.0 Brush Tips & Medium Engine

**Defined:** 2026-11-15
**Core Value:** Users can import key photographs, arrange them into timed sequences with FX layers, preview in real-time, and export as PNG image sequences — the complete stop-motion-to-cinema pipeline must work end-to-end.

**Source of truth:** `SPECS/v2.2.0-brush-tips/` (specs 01–02) and `SPECS/v2.2.0-medium-engine/` (specs 03–08). All eight are **planner inputs for their phase's plans**, not quick dispatches. Specs 01–05 anchors verified against the live tree on 2026-11-15 (minor line drift only); specs 06–08 added/rewritten 2026-11-17, anchors verified the same day.

## v1 Requirements

### Brush Tip Pipeline (Phase 63)

> **Superseded by quick 261116-inu (2026-11-16, UAT-approved).** The imported-texture law moved to a machine-level user library (`~/.config/efx-motion/brushes/` + `catalog.json`) with 512×512 imported masks. These clauses no longer describe the shipped product: TIP-02 (imported mask edge is 512×512; `TIP_SIZE` 192 remains for procedural tips), TIP-06/TIP-17 (machine-scoped catalog; the three built-ins are deleted), TIP-07/TIP-08/TIP-09/TIP-11/TIP-16 (the `.mce` brush carrier and per-project mask assets are removed; a texture missing on another machine replays with the response tip and a warning), TIP-10 (the standing aggregate unavailable-texture warning line was dropped on request), TIP-12 (the machine library is scanned at app start), TIP-13 (built-ins deleted), TIP-14/TIP-15 (script carrier is metadata-only; `buildBrushPackSnapshot` removed). TIP-01, TIP-03, TIP-04 and TIP-05 still describe the shipped law.

- [x] **TIP-01**: User can import a PNG or JPG and the imported image becomes the actual brush tip — selecting it visibly changes the stroke footprint to that texture instead of a round blob
- [x] **TIP-02**: A derived tip is exactly 192 × 192 pixels = 36,864 bytes, one 8-bit value per pixel, produced once at import through the existing `createImageBitmap` / `Image+decode()` path with a high-quality downscale
- [x] **TIP-03**: Mask derivation follows one pinned two-branch rule — alpha when the decoded image carries meaningful transparency (any alpha < 250); otherwise luminance with polarity from mean luminance over opaque pixels (mean < 128 → `mask = luminance` for a light-on-dark stamp, else `mask = 255 − luminance`) — documented in the module header, both branches covered by tests, and shared with the built-in bake
- [x] **TIP-04**: An image whose decoded pixel count exceeds 64 megapixels is refused before decode with the existing named failure and no allocation; a corrupt file with a valid PNG header is refused without crashing
- [x] **TIP-05**: `buildBrushForStroke` is the single tip mapping shared by live paint and bake — a custom tip builds from `CUSTOM_BASE` with its derived mask, so a stroke rasters identically live and baked
- [x] **TIP-06**: An imported tip's mask is registered in a module-level engine registry fed by the brush library's import surface; resetting that catalog and the registry (D-20) leaves no ghost mask behind, so a later stroke with that id falls back cleanly rather than reusing a stale mask
- [x] **TIP-07**: User's imported tip survives save → quit → relaunch → open: the tip is listed and its strokes replay with the texture, reproduced from the `.mce` alone
- [x] **TIP-08**: The mask is stored inside the project package as a lossless WebP asset at `brushes/<sha256>.webp`, content-addressed with a fixed 64-hex name, and decoding the stored artifact is byte-identical to what was encoded; save copies the stored bytes and never re-encodes; the source image is discarded at the end of the import, so only the derived mask is ever stored
- [x] **TIP-09**: No tip depends on any file outside the app bundle or the project — moving, renaming, then deleting the original source image changes nothing on reopen
- [x] **TIP-10**: Both import caps are enforced before read and before decode (`file.size` ≤ 64 MB, decoded pixels ≤ 64 MP), and a stored mask asset that is missing, fails to decode, or is not exactly `TIP_SIZE²` bytes degrades to an unavailable tip, the neutral round fallback, and exactly one aggregate named warning — never a crash and never blank paint; a failed asset never aborts the project open
- [x] **TIP-11**: The brush pack travels in the `.mce` root as `brushPack?: { kind, entries }`, each entry carrying a package-relative asset ref to its mask — not the mask bytes — declared in both the TypeScript model and the Rust struct under the field-diff pin
- [x] **TIP-12**: Masks are decoded and registered inside the project-open await, before the first stroke replay of a loaded project, so painting before registration completes is impossible by construction; the whole brush set decodes in one call and a failing tip never aborts the open
- [x] **TIP-13**: Three textured tips ship without any import — `wc/builtin-bristle` (Bristle fan), `wc/builtin-chalk` (Chalk grain), `wc/builtin-sponge` (Sponge) — as compile-time constants under stable ids, category `texture`, listed in the brush library, resolvable on every install, and never written into a project
- [x] **TIP-14**: A roto script saved with an imported tip carries that tip's mask in its `brushPack` entries and rehydrates on load, so applying it into a project that lacks the tip still paints the texture
- [x] **TIP-15**: `buildBrushPackSnapshot` remains the one place that knows entry shape — stays total and fail-closed on malformed input while carrying the asset ref through
- [x] **TIP-16**: Saving and reopening an untouched project is byte-identical — mask asset bytes included — and copying the project alone to a fresh profile reproduces identical strokes and an identical brush library listing
- [x] **TIP-17**: Opening a project **replaces** — never appends to — the tip catalog and the mask registry with that project's entries plus the three built-ins, so a tip imported in project A is not listed or resolvable in project B; closing the project or starting a New Project resets both to the three built-ins, so no stale custom id resolves

### Medium Engine (Phase 64)

- [ ] **MED-01**: User has a `Viscosity` global on the app's 0..100 slider scale (normalized 0..1 internally) that reduces water motion and suppresses spread, exposed as a row in the existing globals panel
- [ ] **MED-02**: At its neutral default, a project painted before this milestone renders bit-identically after it
- [ ] **MED-03**: Viscosity only ever raises the dissipation coefficient — it never lowers the existing floor and never replaces `flow` — and is applied at exactly those two engine sites and nowhere else
- [ ] **MED-04**: Spread becomes `0.12 × (1 − viscosity × 0.9)`, landing near `0.012` at maximum viscosity
- [x] **MED-05**: A stroke snapshots its viscosity the way it already snapshots `lift`; strokes without the key keep the default, and live pass, bake and replay read the same value
- [ ] **MED-06**: Changing Viscosity after a stroke has settled does not re-process the settled pigment
- [ ] **MED-07**: A medium record `{ id, name, params }` exists as plain serializable data — no functions, no class
- [ ] **MED-08**: `watercolor` ships as today's `DEFAULT_AQUARELLE_PARAMS`, unchanged, and remains the selected medium on a fresh session
- [ ] **MED-09**: Five built-ins ship — `watercolor`, `gouache`, `pastel`, `graphite`, `acrylic` — each a plain record over the fourteen medium keys of the sixteen-key canonical set (`AQUARELLE_GLOBAL_KEYS`: size, water, load, flow, bleed, dry, edge, granulation, lift, viscosity, body, emboss, feather, pickup, refill, wetSeconds — the records carry all but `size` and `lift`), with their tuned numbers recorded explicitly and no other globals invented *(amended 2026-11-22: 64-22 added four keys; the original said "ten medium keys")*
- [ ] **MED-10**: Selecting a medium applies its params to `aquarelleParams` in exactly one store write, with no cascade of per-key setters
- [ ] **MED-11**: Selecting a medium never alters already-recorded strokes — each keeps the values it was painted with; the medium sets values for the next stroke only
- [ ] **MED-12**: A project opened on a machine with different medium defaults replays identically, because the per-stroke params snapshot stays authoritative and the medium id is advisory
- [ ] **MED-13**: The medium selection is surfaced in the existing Studio UI without adding a second parameter panel — the globals panel stays the fine-tuning surface, and a manual global tweak keeps the medium selected
- [ ] **MED-14**: A document-resolution half-float paint-**thickness** channel receives a thickness deposit through each dab's own tip footprint, and deposits accumulate so successive strokes superpose into layered relief
- [ ] **MED-15**: The composite lights the thickness gradient with the same normal-and-light maths the paper relief uses and multiplies the paint colour; at emboss 0 and light intensity 0 the render is byte-identical
- [ ] **MED-16**: Emboss strength is a canonical param carried by the medium and snapshotted with the stroke — no fluid transport of thickness and no height texture asset
- [x] **MED-17**: Light (azimuth, elevation, intensity) is a document setting and a render parameter — never stored in paint, applied anew on every render (live paint, stroke re-render, Play motion, Apply Script, stroke/vector edit), persisted as an optional additive field, and part of the cache content fingerprint
- [ ] **MED-18**: Thickness is captured in the engine snapshot, protected for undo alongside the pigment it sits on, and export matches the screen on every `uMode` path with no shimmer on zoom — where "matches" is measured against the artist's 2026-11-21 darkness-only display derivation (visible alpha = 1 − min(RGB)); the coverage raster is a coverage instrument, not an export channel *(amended 2026-11-22: the parity law is named so the probes measure what ships)*
- [ ] **MED-19**: `Body` is a canonical global on the app's 0..100 scale (normalized 0..1 internally), part of `AquarelleGlobalParams` / `AQUARELLE_GLOBAL_KEYS` / `DEFAULT_AQUARELLE_PARAMS` / `AquarelleCanonicalParams`, carried by the medium records, defaulting to 0, and **has no globals row** — bag-only, Reset-only *(amended 2026-11-22: the artist's ruling in quick 261121-mtu, "body has no row anywhere"; the original required a row in the globals panel)*
- [ ] **MED-20**: At `Body` 0 the engine takes no cover pass at all — a project painted before this milestone renders bit-identically, and a recorded stroke without the key keeps 0
- [ ] **MED-21**: For the **non-bristle** responses, a brush stroke with `Body` above 0 erodes the settled pigment under each dab with the Lift program and the stroke's own tip footprint (aspect, rotation, texture rotation, round), scaled by `Body` and therefore full at the core and partial at the edges, **before** that dab deposits its own pigment. For the **bristle** responses the shipped delivery law applies instead: the dab attenuates ink and fixed by `(1 − a)` inside `bristleInk`, independent of `Body`, with no separate Body cover pass *(amended 2026-11-22: quicks 261119-pod and 261121-umu superseded the bristle D-21 erode; making Body act on the bristle path is an open product decision, not an implementation gap)*
- [x] **MED-22**: The cover pass touches the settled layer and the thickness only — standing water and mobile pigment are untouched, so a light stroke over a still-wet dark area mixes with it (declared behaviour, not a defect), and covering is destructive to the settled sheet while hide/show and undo stay consistent
- [x] **MED-23**: A stroke snapshots its `Body` with its params the way `lift` and `viscosity` are snapshotted; live pass, bake and replay read the same value and produce the same raster, and the medium record carries the value (`watercolor` 0, `pastel` low, `graphite` 0, `gouache` mid, `acrylic` high)
- [ ] **MED-24**: Undo and redo restore both the settled-layer region and the thickness a covering stamp eroded — both pools protected before the cover pass's first draw, verified rather than assumed
- [ ] **MED-25**: `Body` itself adds no render target, no texture allocation and no shader program beyond the thickness channel of MED-14 (the non-bristle cover pass reuses the Lift program), and export matches the screen on both `uMode` paths under MED-18's named parity law *(amended 2026-11-22: the 261119-pod delivery law does add two document-sized pairs — the 2×RGBA16F bristle smear pair and the last-touch ping-pong pair — which belong to the bristle carrier, not to `Body`; the original banned them outright)*
- [ ] **MED-26**: `BrushPreset` carries a compile-time `group` with five values (`watercolor`, `gouache`, `pastel`, `graphite`, `acrylic`); absent reads `watercolor`, nothing is persisted and there is no Rust or format change
- [ ] **MED-27**: The brush library renders one section per group in the fixed order Watercolor · Gouache · Chalk/pastel · Graphite · Acrylic/oil, with no filter and no search; a group with no reachable response is not rendered
- [ ] **MED-28**: Selecting a response applies its group's medium params in exactly one store write, only when the group changes; switching brushes inside the same group keeps the user's manual global tweaks
- [ ] **MED-29**: The 15 existing responses are classified per the spec table (watercolour 11, chalk/pastel 4, the other groups shipping only new responses)
- [ ] **MED-30**: Eight new responses ship with the recorded parameters (`gouache-round`, `gouache-flat`, `pastel-soft`, `conte-hard`, `graphite-pencil`, `graphite-6b`, `bristle-flat`, `bristle-round`); adding is safe and renaming or removing an existing preset id is forbidden
- [ ] **MED-31**: The texture axis is unchanged — a texture replaces the selected response's footprint and applies to every group; a texture never selects a group and a group never selects a texture
- [ ] **MED-32**: The scattering coefficient `S` rides the existing `inkB.a` (mobile) and `fixedB.a` (settled) channels — no render target, texture allocation or pass is added **for `S`** *(amended 2026-11-22: the bristle carrier's 2×RGBA16F smear pair and the last-touch pair, both from the 261119-pod delivery law, exist beyond D-29; they are not scattering channels)*
- [ ] **MED-33**: `Body` derives `S`; the existing ink advection transports it and the settle pass carries it into the settled layer
- [ ] **MED-34**: The composite reconstructs each band with the Kubelka-Munk layer-over-background form; scattering is broadband (one scalar), with no per-band `S`
- [ ] **MED-35**: At `S = 0` the render is bit-identical, verified by a pixel-buffer comparison, with a numerically stable small-argument branch and a recorded epsilon
- [ ] **MED-36**: Scattering and order compose — high `Body` both scatters and erases; low `Body` scatters without erasing, so a semi-opaque glaze lightens without destroying the pigment underneath
- [ ] **MED-37**: The white-gouache channel is retired from the deposit, settle and composite paths, and a check confirms no shipped project writes it
- [ ] **MED-38**: Replay determinism holds for `S` (live = bake = replay) and export matches the screen on every `uMode` path under MED-18's named parity law *(amended 2026-11-22: same darkness-only derivation; the evidence item is the mode-4 export path, not a second display law)*

## v2 Requirements

Deferred to a future release. Tracked but not in the current roadmap.

### Brush Tips

- **TIP-F01**: Tip delete and garbage collection UI — imported tips currently live with the project
- **TIP-F02**: Package/type/signal/`BRUSH_PACK_KIND` rename to a medium-neutral vocabulary — a dedicated format-break pass

### Medium Engine

- **MED-F01**: A real paint height field (true impasto with directional buildup, knife ridges, bristle striations)
- **MED-F02**: Additional medium presets beyond the five built-ins

## Out of Scope

| Feature | Reason |
|---------|--------|
| Studio API/MCP | Own v2.3.0 milestone (Phase 65), designed against the shipped v2.2.0 model |
| Renaming the package, types, signals or `BRUSH_PACK_KIND` | `BRUSH_PACK_KIND` is serialized inside `.mce`; renaming is a format break |
| Tip path references / user-global tip config | Import is pure own-data; a project must reproduce from the `.mce` alone |
| Copying the source image into the project | Only the derived 192×192 mask is stored |
| Re-deriving the mask on open | The stored artifact is authoritative; re-derivation could drift |
| Tip delete / garbage collection UI | Imported tips live with the project |
| TIF/EXR import | Keep the PNG/JPG magic sniff |
| A second import/decode path | Quick 01 owns the decode path; quick 02 must not add another |
| New runtime dependency | Project constraint (v2.1.0 shipped without adding any) |
| A paint height field beyond the ONE thickness channel | MED-14 adds exactly one document-resolution half-float channel; per-band thickness and a height texture asset stay out |
| Directional buildup from a per-tip normal map (knife ridges) | The emboss lights the deposited thickness gradient; a knife's bevel it did not deposit is still out of reach |
| A separate relief-strength control | `emboss` is a canonical param carried by the medium, on the same 0..100 scale as the other globals |
| An alpha/opacity layer for density | Density comes from spread plus pigment concentration per unit area; opacity comes from scatter (`S`, MED-32..38), never from alpha compositing |
| Changing the meaning of `flow`, `water`, `load`, `bleed` or any deposit math | Viscosity is additive to those semantics, not a redefinition |
| `.mce` schema bump beyond the additive `brushPack` root key, entry `mask`, the per-stroke `viscosity`/`body`/`emboss` keys and the optional document `light` field | Additive only; no version bump |

## Traceability

Which phases cover which requirements.

| Requirement | Phase | Status |
|-------------|-------|--------|
| TIP-01 | Phase 63 | Complete |
| TIP-02 | Phase 63 | Complete |
| TIP-03 | Phase 63 | Complete |
| TIP-04 | Phase 63 | Complete |
| TIP-05 | Phase 63 | Complete |
| TIP-06 | Phase 63 | Complete |
| TIP-07 | Phase 63 | Complete |
| TIP-08 | Phase 63 | Complete |
| TIP-09 | Phase 63 | Complete |
| TIP-10 | Phase 63 | Complete |
| TIP-11 | Phase 63 | Complete |
| TIP-12 | Phase 63 | Complete |
| TIP-13 | Phase 63 | Complete |
| TIP-14 | Phase 63 | Complete |
| TIP-15 | Phase 63 | Complete |
| TIP-16 | Phase 63 | Complete |
| TIP-17 | Phase 63 | Complete |
| MED-01 | Phase 64 | Gaps Found |
| MED-02 | Phase 64 | Gaps Found |
| MED-03 | Phase 64 | Gaps Found |
| MED-04 | Phase 64 | Gaps Found |
| MED-05 | Phase 64 | Complete |
| MED-06 | Phase 64 | Gaps Found |
| MED-07 | Phase 64 | Gaps Found |
| MED-08 | Phase 64 | Gaps Found |
| MED-09 | Phase 64 | Gaps Found |
| MED-10 | Phase 64 | Gaps Found |
| MED-11 | Phase 64 | Gaps Found |
| MED-12 | Phase 64 | Gaps Found |
| MED-13 | Phase 64 | Gaps Found |
| MED-14 | Phase 64 | Gaps Found |
| MED-15 | Phase 64 | Gaps Found |
| MED-16 | Phase 64 | Gaps Found |
| MED-17 | Phase 64 | Complete |
| MED-18 | Phase 64 | Gaps Found |
| MED-19 | Phase 64 | Gaps Found |
| MED-20 | Phase 64 | Gaps Found |
| MED-21 | Phase 64 | Gaps Found |
| MED-22 | Phase 64 | Complete |
| MED-23 | Phase 64 | Complete |
| MED-24 | Phase 64 | Gaps Found |
| MED-25 | Phase 64 | Gaps Found |
| MED-26 | Phase 64 | Gaps Found |
| MED-27 | Phase 64 | Gaps Found |
| MED-28 | Phase 64 | Gaps Found |
| MED-29 | Phase 64 | Gaps Found |
| MED-30 | Phase 64 | Gaps Found |
| MED-31 | Phase 64 | Gaps Found |
| MED-32 | Phase 64 | Gaps Found |
| MED-33 | Phase 64 | Gaps Found |
| MED-34 | Phase 64 | Gaps Found |
| MED-35 | Phase 64 | Gaps Found |
| MED-36 | Phase 64 | Gaps Found |
| MED-37 | Phase 64 | Gaps Found |
| MED-38 | Phase 64 | Gaps Found |

**Coverage:**
- v1 requirements: 55 total (17 TIP + 38 MED)
- Mapped to phases: 55 (Phase 63: 17 TIP · Phase 64: 38 MED)
- Unmapped: 0

---
*Requirements defined: 2026-11-15*
*Last updated: 2026-11-15 after v2.2.0 roadmap creation (Phases 63-64; 35/35 mapped)*
