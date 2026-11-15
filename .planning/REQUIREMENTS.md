# Requirements: EFX-Motion Editor — v2.2.0 Brush Tips & Medium Engine

**Defined:** 2026-11-15
**Core Value:** Users can import key photographs, arrange them into timed sequences with FX layers, preview in real-time, and export as PNG image sequences — the complete stop-motion-to-cinema pipeline must work end-to-end.

**Source of truth:** `SPECS/v2.2.0-brush-tips/` (quicks 01–02) and `SPECS/v2.2.0-medium-engine/` (quicks 03–05). All five anchors verified against the live tree on 2026-11-15 (minor line drift only).

## v1 Requirements

### Brush Tip Pipeline (Phase 63)

- [ ] **TIP-01**: User can import a PNG or JPG and the imported image becomes the actual brush tip — selecting it visibly changes the stroke footprint to that texture instead of a round blob
- [ ] **TIP-02**: A derived tip is exactly 192 × 192 pixels = 36,864 bytes, one 8-bit value per pixel, produced once at import through the existing `createImageBitmap` / `Image+decode()` path with a high-quality downscale
- [x] **TIP-03**: Mask derivation follows one pinned two-branch rule — alpha when the decoded image carries meaningful transparency (any alpha < 250); otherwise luminance with polarity from mean luminance over opaque pixels (mean < 128 → `mask = luminance` for a light-on-dark stamp, else `mask = 255 − luminance`) — documented in the module header, both branches covered by tests, and shared with the built-in bake
- [ ] **TIP-04**: An image whose decoded pixel count exceeds 64 megapixels is refused before decode with the existing named failure and no allocation; a corrupt file with a valid PNG header is refused without crashing
- [x] **TIP-05**: `buildBrushForStroke` is the single tip mapping shared by live paint and bake — a custom tip builds from `CUSTOM_BASE` with its derived mask, so a stroke rasters identically live and baked
- [ ] **TIP-06**: An imported tip's mask is registered in a module-level engine registry fed by the brush library's import surface; resetting that catalog and the registry (D-20) leaves no ghost mask behind, so a later stroke with that id falls back cleanly rather than reusing a stale mask
- [ ] **TIP-07**: User's imported tip survives save → quit → relaunch → open: the tip is listed and its strokes replay with the texture, reproduced from the `.mce` alone
- [x] **TIP-08**: The mask is stored inside the project package as a lossless WebP asset at `brushes/<sha256>.webp`, content-addressed with a fixed 64-hex name, and decoding the stored artifact is byte-identical to what was encoded; save copies the stored bytes and never re-encodes; the source image is discarded at the end of the import, so only the derived mask is ever stored
- [x] **TIP-09**: No tip depends on any file outside the app bundle or the project — moving, renaming, then deleting the original source image changes nothing on reopen
- [ ] **TIP-10**: Both import caps are enforced before read and before decode (`file.size` ≤ 64 MB, decoded pixels ≤ 64 MP), and a stored mask asset that is missing, fails to decode, or is not exactly `TIP_SIZE²` bytes degrades to an unavailable tip, the neutral round fallback, and exactly one aggregate named warning — never a crash and never blank paint; a failed asset never aborts the project open
- [x] **TIP-11**: The brush pack travels in the `.mce` root as `brushPack?: { kind, entries }`, each entry carrying a package-relative asset ref to its mask — not the mask bytes — declared in both the TypeScript model and the Rust struct under the field-diff pin
- [ ] **TIP-12**: Masks are decoded and registered inside the project-open await, before the first stroke replay of a loaded project, so painting before registration completes is impossible by construction; the whole brush set decodes in one call and a failing tip never aborts the open
- [x] **TIP-13**: Three textured tips ship without any import — `wc/builtin-bristle` (Bristle fan), `wc/builtin-chalk` (Chalk grain), `wc/builtin-sponge` (Sponge) — as compile-time constants under stable ids, category `texture`, listed in the brush library, resolvable on every install, and never written into a project
- [ ] **TIP-14**: A roto script saved with an imported tip carries that tip's mask in its `brushPack` entries and rehydrates on load, so applying it into a project that lacks the tip still paints the texture
- [x] **TIP-15**: `buildBrushPackSnapshot` remains the one place that knows entry shape — stays total and fail-closed on malformed input while carrying the asset ref through
- [x] **TIP-16**: Saving and reopening an untouched project is byte-identical — mask asset bytes included — and copying the project alone to a fresh profile reproduces identical strokes and an identical brush library listing
- [ ] **TIP-17**: Opening a project **replaces** — never appends to — the tip catalog and the mask registry with that project's entries plus the three built-ins, so a tip imported in project A is not listed or resolvable in project B; closing the project or starting a New Project resets both to the three built-ins, so no stale custom id resolves

### Medium Engine (Phase 64)

- [ ] **MED-01**: User has a `Viscosity` global on the app's 0..100 slider scale (normalized 0..1 internally) that reduces water motion and suppresses spread, exposed as a row in the existing globals panel
- [ ] **MED-02**: At its neutral default, a project painted before this milestone renders bit-identically after it
- [ ] **MED-03**: Viscosity only ever raises the dissipation coefficient — it never lowers the existing floor and never replaces `flow` — and is applied at exactly those two engine sites and nowhere else
- [ ] **MED-04**: Spread becomes `0.12 × (1 − viscosity × 0.9)`, landing near `0.012` at maximum viscosity
- [ ] **MED-05**: A stroke snapshots its viscosity the way it already snapshots `lift`; strokes without the key keep the default, and live pass, bake and replay read the same value
- [ ] **MED-06**: Changing Viscosity after a stroke has settled does not re-process the settled pigment
- [ ] **MED-07**: A medium record `{ id, name, params }` exists as plain serializable data — no functions, no class
- [ ] **MED-08**: `watercolor` ships as today's `DEFAULT_AQUARELLE_PARAMS`, unchanged, and remains the selected medium on a fresh session
- [ ] **MED-09**: `dry` (chalk / felt-pen intent) and `opaque` (acrylic intent) ship as built-ins derived from the existing nine globals only, with their tuned numbers recorded explicitly and no new globals invented
- [ ] **MED-10**: Selecting a medium applies its params to `aquarelleParams` in exactly one store write, with no cascade of per-key setters
- [ ] **MED-11**: Selecting a medium never alters already-recorded strokes — each keeps the values it was painted with; the medium sets values for the next stroke only
- [ ] **MED-12**: A project opened on a machine with different medium defaults replays identically, because the per-stroke params snapshot stays authoritative and the medium id is advisory
- [ ] **MED-13**: The medium selection is surfaced in the existing Studio UI without adding a second parameter panel — the globals panel stays the fine-tuning surface, and a manual global tweak keeps the medium selected
- [ ] **MED-14**: Heavy pigment reads with visible body — the composite pass derives a paint-relief term from the local deposited-density gradient and perturbs the lit relief the paper already establishes; the gradient reads **merged** wet areas, so painting over a wet region follows the merged density instead of stamping a hard edge
- [ ] **MED-15**: The perturbation is additive to the existing relief, never a replacement; at strength 0 watercolor renders byte-identical to before this milestone
- [ ] **MED-16**: Relief strength is a per-medium scalar carried by the medium record — `watercolor` uses 0, `opaque` uses a tuned value — with no new global slider
- [ ] **MED-17**: Absorbance, hue and alpha are untouched; only the lit relief term changes, so no paint height field, extra render target or new texture allocation is introduced
- [ ] **MED-18**: Export matches the screen on both `uMode` paths, and zooming in or out produces no shimmer or crawl

## v2 Requirements

Deferred to a future release. Tracked but not in the current roadmap.

### Brush Tips

- **TIP-F01**: Tip delete and garbage collection UI — imported tips currently live with the project
- **TIP-F02**: Package/type/signal/`BRUSH_PACK_KIND` rename to a medium-neutral vocabulary — a dedicated format-break pass

### Medium Engine

- **MED-F01**: A real paint height field (true impasto with directional buildup, knife ridges, bristle striations)
- **MED-F02**: Additional medium presets beyond the three built-ins

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
| Paint height field, extra render target, new texture allocation | A phase, not a quick |
| Directional buildup (knife ridges, bristle striations) | A density-gradient relief deliberately cannot produce these |
| A relief strength global slider | Strength is a per-medium scalar |
| An opacity/alpha term for density | The renderer is absorbance-based (Beer-Lambert); density comes from reduced spread plus pigment concentration per unit area |
| Changing the meaning of `flow`, `water`, `load`, `bleed` or any deposit math | Viscosity is additive to those semantics, not a redefinition |
| `.mce` schema bump beyond the additive `brushPack` root key, entry `mask`, and per-stroke `viscosity` | Additive only; no version bump |

## Traceability

Which phases cover which requirements.

| Requirement | Phase | Status |
|-------------|-------|--------|
| TIP-01 | Phase 63 | Pending |
| TIP-02 | Phase 63 | Pending |
| TIP-03 | Phase 63 | Complete |
| TIP-04 | Phase 63 | Pending |
| TIP-05 | Phase 63 | Complete |
| TIP-06 | Phase 63 | Pending |
| TIP-07 | Phase 63 | Pending |
| TIP-08 | Phase 63 | Complete |
| TIP-09 | Phase 63 | Complete |
| TIP-10 | Phase 63 | Pending |
| TIP-11 | Phase 63 | Complete |
| TIP-12 | Phase 63 | Pending |
| TIP-13 | Phase 63 | Complete |
| TIP-14 | Phase 63 | Pending |
| TIP-15 | Phase 63 | Complete |
| TIP-16 | Phase 63 | Complete |
| TIP-17 | Phase 63 | Pending |
| MED-01 | Phase 64 | Pending |
| MED-02 | Phase 64 | Pending |
| MED-03 | Phase 64 | Pending |
| MED-04 | Phase 64 | Pending |
| MED-05 | Phase 64 | Pending |
| MED-06 | Phase 64 | Pending |
| MED-07 | Phase 64 | Pending |
| MED-08 | Phase 64 | Pending |
| MED-09 | Phase 64 | Pending |
| MED-10 | Phase 64 | Pending |
| MED-11 | Phase 64 | Pending |
| MED-12 | Phase 64 | Pending |
| MED-13 | Phase 64 | Pending |
| MED-14 | Phase 64 | Pending |
| MED-15 | Phase 64 | Pending |
| MED-16 | Phase 64 | Pending |
| MED-17 | Phase 64 | Pending |
| MED-18 | Phase 64 | Pending |

**Coverage:**
- v1 requirements: 35 total (17 TIP + 18 MED)
- Mapped to phases: 35 (Phase 63: 17 TIP · Phase 64: 18 MED)
- Unmapped: 0

---
*Requirements defined: 2026-11-15*
*Last updated: 2026-11-15 after v2.2.0 roadmap creation (Phases 63-64; 35/35 mapped)*
