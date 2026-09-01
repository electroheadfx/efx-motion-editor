# Phase 50: Photo/Reference Track - Research

**Researched:** 2026-09-01
**Domain:** EFX Physic Paint document model + Studio UI (Preact Signals, Tauri 2.0) — a durable reference source track excluded from flattened output
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Reuse the Phase 49 asset-picker variant (`BackgroundAssetPickerView`) for the reference source — images-only, multi-select, Confirm/Cancel, full-area region swap. NOT a bare macOS dialog, NOT a port of the main editor's `ImportedView`.
- **D-02:** The reference source is one still image OR one ordered sequence (natural filename sort, Phase 49 D-02 — never asset UUID order). A single image is a cycle of length 1.
- **D-03:** Replaceable source via a row Import control (like the Bg row). Re-opening the picker REPLACES the source; replacement bumps the source revision (REF-04), invalidating dependent Reveal/transformation results. One source at a time.
- **D-04:** Missing source recovery = the same Replace flow. A missing library asset renders the reference absent in Studio + the status-capsule red warning (fail-closed, Phase 48 D-09). No separate recovery surface.
- **D-05:** Segmented control/dropdown on the photo/reference row (or right panel) with the three modes: `reference-only` / `reveal-source` / `masked-transform-source`. Switching is instant and undoable.
- **D-06:** **HARD LOCK (user):** Flag-only in Phase 50. All three modes show the reference overlay identically while painting; the mode is a persisted flag consumed by Phase 52 (Reveal) and the future masked-transform workflow. In ALL THREE modes, reference pixels NEVER reach the flattened raster, main preview, or export — the mode only changes the persisted flag.
- **D-07:** Mode switch is one undoable document mutation (unified 10-level undo by reference, Phase 46) and bumps the photo/reference track revision.
- **D-08:** The reserved `'photo'` fond mode stays absent in Phase 50. Wiring it would draw reference pixels as the document fallback — which IS part of the flattened output (Phase 48) — directly violating the D-06 exclusion lock.
- **D-09:** Ghost overlay + toggle. The reference draws as a semi-transparent ghost on top of the composite while painting (like onion skin, Phase 48 D-06). Never part of the flattened raster.
- **D-10:** The overlay is independent of Paint-track hide/solo — controlled only by its own toggle (matches the Background rule, Phase 48 D-04).
- **D-11:** The overlay toggle is persisted in the document (`visibleInStudio` on the photo/reference track) and survives save/reopen.
- **D-12:** Adjustable opacity slider in the right panel. Live preview as you drag, commit on release (same release-commit pattern as track opacity, Phase 48). It is a persisted display preference on the photo/reference track, NOT an undoable document mutation, and never touches the flattened raster.
- **D-13:** Reference display transform with direct canvas manipulation — position X/Y, scale X/Y, rotation — drag to move, corner handles to scale, rotation handle. Reuses the main editor's TransformOverlay pattern. Lock toggle: locked by default; unlocking enters reference-transform mode; re-lock to paint again. Default = centered at natural size, no rotation. Transform + lock state persist as display properties (not undoable document mutations). Identical transform in all three modes. NEVER affects the flattened raster or export.
- **D-14:** The overlay is visible only while painting/editing on the active track — it hides during playback and export (matches onion-skin behavior, Phase 48 D-06).
- **D-15:** Application frame N → source frame N, 1:1 from frame 0, clamped at the sequence end (last source frame holds). No start offset, no loop.

### Claude's Discretion
- Exact store/function shape for the photo/reference track CRUD ops, the source revision bump, and the reference overlay draw path.
- Exact segmented-control/dropdown placement (row vs right panel) and copy (English).
- Exact TransformOverlay reuse shape for the reference transform.
- Whether the photo/reference row's own `visible` toggle is surfaced in Phase 50 (the overlay toggle D-11 covers it).

### Deferred Ideas (OUT OF SCOPE)
- `'photo'` fond mode wiring — deferred to a later phase (would draw reference pixels as the document fallback, part of flattened output — violates D-06).
- Reveal compositing — Phase 52 (RVL); consumes the `reveal-source` mode and the frame-aligned source resolution.
- Masked-transform workflow — future accepted local transformation result consumes the `masked-transform-source` mode.
- Reference overlay opacity slider — implemented in Phase 50 (D-12), but noted as a display preference, not an undoable mutation.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REF-01 | One photo/reference track per EFX Paint document with stable source identity and revision | Replace `photoReference: null` with a `PhotoReferenceTrack` model (id, source, mode, visibleInStudio, revision); extend parser + revision builder; source identity = ordered `sourceFrameRefs` (natural filename sort) + a source revision term |
| REF-02 | Photo/reference track supports reference-only, reveal-source, and masked-transform-source modes | Persisted `mode` union `'reference-only' \| 'reveal-source' \| 'masked-transform-source'`; flag-only in Phase 50 (D-06); mode switch = one undoable mutation bumping track revision (D-07) |
| REF-03 | Reference-only visibility is excluded from ordinary flattened Paint output | The ghost overlay is monitor paint only; it never enters `getFlattenedFrame` / `previewRenderer.ts` / export (D-06, D-13); `visibleInStudio` toggle never alters flattened output |
| REF-04 | Source revision invalidates dependent Reveal/transformation results; missing source is visible and recoverable | Source revision term (following `_backgroundSourceRevision`); missing asset resolves to null + status-capsule red warning; recovery = Replace flow (D-04) |
| REF-05 | Save/reopen preserves source identity and mode | `serializeRuntimeIntoDocument` / `hydrateRuntimeFromDocument` + `hydrateBackgroundSourceImagesFromLibrary` pattern; `visibleInStudio`, mode, opacity, transform, lock all persisted on the document |
</phase_requirements>

## Summary

Phase 50 adds one durable photo/reference track to the EFX Physic Paint document — a source track used for painting reference, Reveal source (Phase 52), and future masked-transform workflows — without turning it into a main-editor content track. The phase is a **clean-break format change** under the v1.0.0 contract: the current `EfxPaintDocument.photoReference` is `null` and the parser rejects any non-null value; this phase replaces it with a real `PhotoReferenceTrack` model.

The phase is **entirely in-repo reuse — zero new dependencies**. The source import reuses the Phase 49 `BackgroundAssetPickerView`; the ghost overlay draws in the onion-ghost family (Phase 48 D-06); the transform reuses the main editor's `TransformOverlay` pattern; the store CRUD follows the Background clip op pattern; the source resolution follows `hydrateBackgroundSourceImages` / `_backgroundSourceRevision`. The single most important invariant is the **D-06 exclusion lock**: reference pixels NEVER reach the flattened raster, main preview, or export in ANY mode — the mode is a persisted flag only until Phase 52.

The critical architectural distinction the planner must preserve is **document-mutation fields vs display-preference fields**. Source identity and mode are document mutations (undoable, bump the track revision and the document revision counter). `visibleInStudio`, overlay opacity, transform, and lock state are persisted display preferences (survive save/reopen but are NOT undoable and do NOT bump the revision counter). Conflating these two classes is the highest-risk mistake in this phase.

**Primary recommendation:** Extend the existing document model, parser, revision builder, and store by following the Background track's exact seams (source registry → source revision → fail-closed resolution → monitor-only draw), and gate every reference draw path behind the D-06 exclusion lock so the reference never enters `getFlattenedFrame`, `previewRenderer.ts`, or export.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Photo/reference track model (id, source, mode, visibleInStudio, revision) | Database/Storage (document model) | — | The document is the durable store; save/reopen persists it via Tauri filesystem |
| Parser extension (fail-closed `photoReference` → `PhotoReferenceTrack`) | Database/Storage (document model) | — | `efxPaintDocumentParsers.ts` is the single validation gate; clean-break rejection lives here |
| Source import (asset picker, multi-select, Confirm/Cancel) | Browser/Client (UI) | — | `BackgroundAssetPickerView` full-area swap; library asset IDs only |
| Source resolution (frame N → source frame N, clamped) | Browser/Client (store runtime) | — | `physicPaintStore` runtime maps; resolved per cursor frame, never once at import |
| Source revision bump (invalidates dependents) | Database/Storage (document model) | Browser/Client (store) | Revision term feeds dependent cache keys (REF-04) |
| Mode switch (undoable mutation) | Database/Storage (document model) | Browser/Client (store) | One undoable record on the unified 10-level ledger (D-07) |
| Ghost overlay draw (monitor paint) | Browser/Client (canvas) | — | Onion-ghost family; monitor paint only, never the compositor |
| Reference transform (drag/scale/rotate + lock) | Browser/Client (canvas) | — | `TransformOverlay` pattern; display properties, not document mutations |
| Exclusion from flattened output | Browser/Client (compositor boundary) | — | `getFlattenedFrame` / `previewRenderer.ts` receive NO reference input (D-06) |
| Missing-source recovery (fail-closed) | Browser/Client (UI) | Database/Storage (document) | Status capsule + Replace flow; missing asset resolves to null, never placeholder |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| (none new) | — | — | This phase adds **zero new dependencies** — all reuse of existing in-repo code |

### Supporting (in-repo modules reused — not installed)

| Module | Path | Purpose | When to Use |
|--------|------|---------|-------------|
| `BackgroundAssetPickerView` | `app/src/components/physic-paint/view/BackgroundAssetPickerView.tsx` | Reference source import (D-01) | Full-area picker swap, images-only, multi-select, Confirm/Cancel |
| `PhysicsPaintTrackRow` / `PhysicsPaintWorkflowStrip` | `app/src/components/physic-paint/view/` | Photo row + Import/Replace control (D-03) | Extend the `kind="background"` row pattern |
| `TransformOverlay` | `app/src/components/canvas/TransformOverlay.tsx` | Reference display transform (D-13) | Drag-to-move, corner handles, rotation handle, counter-scaled fixed screen-pixel sizes |
| `rotoOnionPreview.ts` | `app/src/components/physic-paint/roto/rotoOnionPreview.ts` | Ghost overlay opacity family (D-09) | `ONION_DEPTH_OPACITY[0] = 0.5` is the default overlay opacity |
| `naturalFilenameSort.ts` | `app/src/efx-paint/utils/naturalFilenameSort.ts` | Source ordering (D-02) | `sortImagesByOriginalFilename` — natural filename sort, never asset UUID |
| `physicPaintStore.ts` | `app/src/stores/physicPaintStore.ts` | Source registry + resolution + flattened seam | `_backgroundSourceImages`, `_backgroundSourceRevision`, `getFlattenedFrame` |
| `efxPaintStore.ts` | `app/src/stores/efxPaintStore.ts` | Document CRUD + serialize/hydrate | `serializeRuntimeIntoDocument`, `hydrateRuntimeFromDocument` |
| `efxPaintDocument.ts` / `efxPaintDocumentParsers.ts` / `efxPaintDocumentRevision.ts` | `app/src/efx-paint/document/` | Model + parser + revision | The three files that must change for the clean-break format change |
| `lucide-preact` | (existing dep) | Camera/image glyph, eye toggle, lock icon | Already imported by the strip |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Reuse `BackgroundAssetPickerView` (D-01) | Port main editor `ImportedView` | `ImportedView` is coupled to sequence/layer/audio intents — forbidden by D-01 |
| Reuse `TransformOverlay` (D-13) | Hand-roll a new canvas transform | Duplicates counter-scaling, handle hit-testing, zoom math — high risk |
| Follow Background source registry | New parallel source registry | Breaks the established fail-closed resolution + revision pattern |

**Installation:** none — no new packages.

**Version verification:** N/A — zero new dependencies. All reused modules are in-repo and were read this session.

## Package Legitimacy Audit

> No new packages are installed in this phase. The audit is trivially satisfied.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (none) | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*No packages are discovered or installed. All functionality reuses existing in-repo modules (`BackgroundAssetPickerView`, `TransformOverlay`, `physicPaintStore`, `efxPaintStore`, `lucide-preact`).*

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│  EFX Physic Paint Studio (Preact Signals, Tauri 2.0)               │
│                                                                     │
│  ┌──────────────────────────┐   ┌───────────────────────────────┐  │
│  │ Photo row (fixed, pinned)│   │ Right panel: Photo Reference  │  │
│  │  camera glyph + "Photo"  │   │  Mode (3-segment)             │  │
│  │  eye toggle (visibleIn   │   │  Overlay opacity slider       │  │
│  │    Studio)               │   │  Lock reference transform     │  │
│  │  Import/Replace control  │   │  source facts                 │  │
│  │  passive muted band      │   └───────────────┬───────────────┘  │
│  └───────────┬──────────────┘                   │                  │
│              │ Import/Replace                   │ mode/opacity/    │
│              ▼                                  │ lock mutations   │
│  ┌──────────────────────────┐                   ▼                  │
│  │ BackgroundAssetPickerView│   ┌───────────────────────────────┐  │
│  │  (full-area swap)        │   │  physicPaintStore /           │  │
│  │  images-only ImportGrid  │   │  efxPaintStore                │  │
│  │  Confirm → REPLACE source│   │  (CRUD + undo ledger)         │  │
│  └───────────┬──────────────┘   └───────────────┬───────────────┘  │
│              │ sourceFrameRefs (natural sort)    │                  │
│              ▼                                   ▼                  │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  EfxPaintDocument (durable model)                             │ │
│  │   photoReference: PhotoReferenceTrack | null                  │ │
│  │    { id, source, mode, visibleInStudio, revision }            │ │
│  │   + display prefs: opacity, transform, lock                   │ │
│  └───────────────┬───────────────────────────────┬───────────────┘ │
│                  │ source revision               │                  │
│                  ▼                               ▼                  │
│  ┌──────────────────────────┐   ┌───────────────────────────────┐ │
│  │ Source resolution        │   │ Ghost overlay (monitor paint) │ │
│  │  frame N → source frame N │   │  onion-ghost family           │ │
│  │  clamped at sequence end  │   │  + TransformOverlay handles   │ │
│  │  missing → null (fail-    │   │  hidden during playback       │ │
│  │    closed)                │   │  NEVER enters compositor      │ │
│  └───────────────┬──────────┘   └───────────────┬───────────────┘ │
│                  │                              │                  │
│                  │        ┌─────────────────────┘                  │
│                  │        │  (D-06 EXCLUSION LOCK)                 │
│                  ▼        ▼                                        │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  getFlattenedFrame / previewRenderer.ts / export               │ │
│  │  (reference pixels NEVER reach this path)                     │ │
│  └───────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure (extensions only — no new top-level dirs)

```
app/src/
├── efx-paint/document/
│   ├── efxPaintDocument.ts          # + PhotoReferenceTrack model (replace photoReference: null)
│   ├── efxPaintDocumentParsers.ts    # + parsePhotoReferenceTrack (fail-closed)
│   └── efxPaintDocumentRevision.ts   # + photo terms (replace 'photo:null;')
├── stores/
│   ├── physicPaintStore.ts           # + reference source registry/resolution/ghost draw
│   └── efxPaintStore.ts              # + photoReference CRUD + serialize/hydrate
└── components/physic-paint/
    ├── view/
    │   ├── PhysicsPaintTrackRow.tsx  # + Photo row (kind="photo-reference")
    │   ├── PhysicsPaintWorkflowStrip.tsx
    │   └── PhysicsPaintPhotoReferenceSection.tsx  # NEW right-panel section
    └── engine/
        └── physicsPaintStudioSettings.ts  # unchanged — 'photo' stays excluded
```

### Pattern 1: Document-mutation vs display-preference field split

**What:** The `PhotoReferenceTrack` carries two distinct field classes. Source identity (`source`) and `mode` are document mutations — undoable, bump the track `revision` and the document `documentRevision` counter. `visibleInStudio`, overlay opacity, transform, and lock state are persisted display preferences — survive save/reopen but are NOT undoable and do NOT bump the revision counter.

**When to use:** Every store setter in this phase must be classified into exactly one of these two classes before implementation. The mode switch (D-07) and source replace (D-03) are mutations; the opacity slider (D-12), transform (D-13), and visibility toggle (D-11) are display preferences.

**Example (revision term — the current null placeholder to replace):**
```typescript
// Source: app/src/efx-paint/document/efxPaintDocumentRevision.ts:117
'photo:null;',
```

### Pattern 2: Fail-closed source resolution (missing → null, never placeholder)

**What:** The reference source resolves through a registry keyed by source asset ID. A missing asset resolves to `null` and surfaces through the status capsule with a red warning triangle — never a placeholder fill, never a throw, never silent transparency (Pitfall M6).

**When to use:** The ghost draw path and the source revision term both consult the registry. The existing Background pattern is the template.

**Example (the registry + revision seam to mirror):**
```typescript
// Source: app/src/stores/physicPaintStore.ts:434
const _backgroundSourceImages = new Map<string, string>();

// Source: app/src/stores/physicPaintStore.ts:1584-1593
function _backgroundSourceRevision(document: EfxPaintDocument): string {
  const refs = new Set<string>();
  for (const clip of document.background.clips) {
    for (const ref of clip.sourceFrameRefs) refs.add(ref);
  }
  return [...refs].sort().map((ref) => {
    const dataUrl = _backgroundSourceImages.get(ref);
    return dataUrl === undefined ? `${ref}:missing` : `${ref}:${dataUrl.length}:${dataUrl.slice(0, 64)}`;
  }).join('|');
}
```

### Pattern 3: Monitor-only ghost draw (the D-06 exclusion lock)

**What:** The reference overlay draws in the program-monitor ghost layer family (above the composite, beneath selection/tool paint) — the same layer seat onion ghosts use. It is monitor paint only; it never enters `getFlattenedFrame`, `previewRenderer.ts`, or export.

**When to use:** The ghost draw path and the transform handles. The exclusion is structural: the compositor and export receive NO reference input, so there is no code path by which reference pixels can leak.

**Example (the onion-ghost opacity family the overlay draws in):**
```typescript
// Source: app/src/components/physic-paint/roto/rotoOnionPreview.ts:34
const ONION_DEPTH_OPACITY = [0.5, 0.25, 0.15] as const;
```

### Pattern 4: Clean-break parser extension (fail-closed)

**What:** The parser currently rejects any non-null `photoReference`. This phase extends it to parse a real `PhotoReferenceTrack`, keeping the fail-closed posture: any malformed track throws, and legacy data (which has `photoReference: null`) is handled by the clean-break rule — no migration, no compatibility branch.

**When to use:** The parser extension is the single validation gate. The revision builder must emit real photo terms in place of the `'photo:null;'` placeholder.

**Example (the current reject to replace):**
```typescript
// Source: app/src/efx-paint/document/efxPaintDocumentParsers.ts:327-329
if (value.photoReference !== null) {
  throw new Error('EfxPaintDocument: photoReference must be null.');
}
```

### Anti-Patterns to Avoid
- **Conflating display preferences with document mutations:** Treating opacity/transform/lock as undoable mutations (or vice versa) breaks the undo ledger and the revision counter. Classify every setter first.
- **Resolving the source once at import:** The frame-aligned law (D-15) requires per-cursor-frame resolution; caching a single resolved frame at import is Pitfall M5.
- **Silent transparency on missing source:** A missing asset must surface through the status capsule, never render as invisible (Pitfall M6).
- **Wiring the `'photo'` fond mode:** It would draw reference pixels as flattened fallback, violating D-06 (D-08).
- **Porting `ImportedView`:** It is coupled to sequence/layer/audio intents and forbidden by D-01.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Reference source import | A new picker/dialog | `BackgroundAssetPickerView` (D-01) | Full-area swap, images-only, multi-select, Confirm/Cancel already built and UAT-passed |
| Reference display transform | A new canvas transform | Main editor `TransformOverlay` (D-13) | Counter-scaled fixed screen-pixel handles, drag/scale/rotate hit-testing, zoom math already solved |
| Natural filename sort | A custom sort | `sortImagesByOriginalFilename` (D-02) | `Intl.Collator` numeric, sensitivity base — the locked ordering law |
| Source registry + revision | A parallel registry | `_backgroundSourceImages` + `_backgroundSourceRevision` | Fail-closed resolution + deterministic revision term already established |
| Ghost overlay opacity | A new opacity model | `ONION_DEPTH_OPACITY` family (D-09) | The onion-ghost family is the locked visual seat |
| Undo/redo | Raster-byte snapshots | Unified 10-level undo by reference (Phase 46) | Metadata + asset references, not PNG bytes |

**Key insight:** Every capability in this phase has an existing in-repo solution that was built and UAT-passed in Phases 46–49. Hand-rolling any of them would duplicate edge cases (counter-scaling, fail-closed resolution, natural sort collation) that are already solved and locked.

## Common Pitfalls

### Pitfall 1: Reference pixels leak into flattened output (the D-06 lock)
**What goes wrong:** The ghost overlay or the `'photo'` fond mode accidentally enters `getFlattenedFrame`, `previewRenderer.ts`, or export, so reference pixels appear in the flattened raster.
**Why it happens:** The reference draw path is added near the compositor, and a shared helper or a fond-mode branch is reused without checking the exclusion.
**How to avoid:** Make the exclusion structural — the compositor and export receive NO reference input. Keep the ghost draw in the monitor-paint layer seat only. Keep `BackgroundSelectorMode = Exclude<BgMode, 'photo'>` unchanged.
**Warning signs:** A code review shows a reference source ref threaded into `_resolveFlattenedFrame` or `previewRenderer.ts`; the `'photo'` fond option appears in the fallback selector.

### Pitfall 2: Frame-aligned resolution done once at import (Pitfall M5)
**What goes wrong:** The source is resolved to a single frame at import time, so the reference does not change over time as the cursor moves.
**Why it happens:** A developer caches the resolved image at import instead of resolving per cursor frame.
**How to avoid:** Resolve `frame N → source frame N` (clamped at sequence end) every time the ghost draws, through the current cursor frame (D-15).
**Warning signs:** The ghost shows the same image on every frame despite a multi-image sequence.

### Pitfall 3: Missing source treated as silent transparency (Pitfall M6)
**What goes wrong:** A missing library asset renders the reference as invisible with no user signal.
**Why it happens:** The resolution returns `null` and the draw path silently skips.
**How to avoid:** Fail-closed — missing asset resolves to `null`, the ghost is absent, and the status capsule reports `Missing reference source — use Replace source to re-link.` with the red warning triangle (D-04).
**Warning signs:** A missing asset produces no capsule report and no band status.

### Pitfall 4: Conflating display preferences with document mutations
**What goes wrong:** The opacity slider, transform, or lock toggle records an undo entry and bumps the revision counter (or the mode switch fails to record undo).
**Why it happens:** The two field classes are not distinguished in the store setter.
**How to avoid:** Classify each setter: source + mode = undoable mutation (bump revision); visibleInStudio + opacity + transform + lock = persisted display preference (no undo, no revision bump). Follow the existing `_setTrackDisplayProperty` vs `setTrackOpacity` split in `efxPaintStore.ts`.
**Warning signs:** Undo history grows on every opacity drag; save/reopen loses the transform.

### Pitfall 5: Source ordering by asset UUID or click order
**What goes wrong:** A multi-image sequence is ordered by asset UUID or selection click order, breaking the frame-aligned law.
**Why it happens:** The picker's confirm path uses the raw selection order instead of natural filename sort.
**How to avoid:** Order `sourceFrameRefs` by `sortImagesByOriginalFilename` of original filenames (`shot_1 < shot_2 < shot_10`), never asset UUID or click order (D-02).
**Warning signs:** A sequence renders out of order; `shot_10` sorts before `shot_2`.

## Code Examples

### The model to introduce (replacing `photoReference: null`)

```typescript
// Source: SPECS/milestone-v1.0.0-plan.md:258-264 (locked model sketch)
interface PhotoReferenceTrack {
  id: string;
  source: PhotoSourceReference;
  mode: 'reference-only' | 'reveal-source' | 'masked-transform-source';
  visibleInStudio: boolean;
  revision: number;
}
```

The current placeholder to replace:
```typescript
// Source: app/src/efx-paint/document/efxPaintDocument.ts:105
readonly photoReference: null;
```

### The locked mode union (persisted flag values)

```typescript
// Source: SPECS/milestone-v1.0.0-plan.md:196-198
// - `reference-only` — visible while painting but excluded from flattened output.
// - `reveal-source` — used as source imagery for a Reveal result.
// - `masked-transform-source` — supplies source imagery for a future accepted local transformation result.
```

Note: the persisted flag values are kebab-case (`reference-only` / `reveal-source` / `masked-transform-source`); the English UI copy is `Reference only` / `Reveal source` / `Masked transform` (50-UI-SPEC Copywriting Contract).

### The reserved `'photo'` fond mode stays excluded

```typescript
// Source: app/src/components/physic-paint/engine/physicsPaintStudioSettings.ts:47
export type BackgroundSelectorMode = Exclude<BgMode, 'photo'>;

// Source: app/src/components/physic-paint/engine/physicsPaintStudioSettings.ts:87
const background = settings.background === 'photo' ? 'transparent' : settings.background;
```

### Serialize/hydrate seam (save/reopen persistence)

```typescript
// Source: app/src/stores/efxPaintStore.ts:1088
void hydrateBackgroundSourceImagesFromLibrary(document);
```

The photo/reference track must be serialized into the document (like `serializeRuntimeIntoDocument`) and hydrated on reopen (like `hydrateRuntimeFromDocument`), with its source images registered through the same library-hydration path.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `photoReference: null` (rejected by parser) | `PhotoReferenceTrack` model (id, source, mode, visibleInStudio, revision) | Phase 50 (this phase) | Clean-break format change; legacy data fails explicitly |
| `'photo:null;'` revision placeholder | Real photo terms in the revision builder | Phase 50 | Source/mode changes now bump the deterministic document revision |
| No reference source | Reused `BackgroundAssetPickerView` + `TransformOverlay` | Phase 50 | Zero new dependencies; established patterns reused |
| Reference pixels unguarded | D-06 exclusion lock (monitor paint only) | Phase 50 | Release stop condition "Reference-only photo pixels leak into output" is structurally prevented |

**Deprecated/outdated:**
- `photoReference: null` — replaced by `PhotoReferenceTrack | null` (clean-break, no migration).
- `'photo:null;'` revision term — replaced by real photo terms.
- Any notion of the reference as a main-editor content track — forbidden by spec §"Forbidden sequence-level assumptions".

## Assumptions Log

> List all claims tagged `[ASSUMED]` in this research.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `PhotoSourceReference` field shape (beyond `sourceFrameRefs: string[]` ordered by natural sort) is illustrative, not locked — the SPECS marks the model sketch as "illustrative, not a locked field-level implementation" | Standard Stack / Code Examples | Low — the planner has discretion over the exact source field shape (Claude's Discretion) |
| A2 | The photo/reference source registry will mirror `_backgroundSourceImages` (a `Map<string, string>` of sourceRef → dataUrl) rather than share it | Architecture Patterns | Low — either a shared or parallel registry satisfies the fail-closed + revision requirements; the exact shape is Claude's Discretion |
| A3 | The display-preference fields (opacity, transform, lock) will be stored on the `PhotoReferenceTrack` alongside `visibleInStudio` (per the spec sketch) rather than in a separate runtime map | Architecture Patterns | Medium — if stored in a runtime map instead, save/reopen persistence must still be wired explicitly |

**If this table is empty:** (not applicable — three assumptions logged above)

## Open Questions

1. **Exact `PhotoSourceReference` field shape**
   - What we know: the SPECS sketch shows `source: PhotoSourceReference` with `sourceFrameRefs: FrameAssetReference[]` on the sibling `FrameLoopClip`; the document model uses `readonly string[]` for `sourceFrameRefs`.
   - What's unclear: whether the reference source is a bare `readonly string[]` of asset IDs (mirroring `FrameLoopClip.sourceFrameRefs`) or a richer object.
   - Recommendation: Use `readonly string[]` of library asset IDs (natural filename sort order), mirroring `FrameLoopClip.sourceFrameRefs` — this is Claude's Discretion and the lowest-risk choice.

2. **Shared vs parallel source registry**
   - What we know: `_backgroundSourceImages` is a module-level `Map<string, string>` keyed by sourceRef.
   - What's unclear: whether the reference source reuses the same map or gets its own.
   - Recommendation: A parallel `_referenceSourceImages` map (or a shared map) both work; prefer a parallel map to keep the reference's fail-closed resolution and revision term independent of the Background track's clip lifecycle.

3. **Where the display-preference fields live**
   - What we know: the spec sketch puts `visibleInStudio` on the track; opacity/transform/lock are "display properties" per D-12/D-13.
   - What's unclear: whether opacity/transform/lock are fields on the track or a separate runtime map.
   - Recommendation: Store them on the `PhotoReferenceTrack` (or a sibling display-preferences object) so save/reopen persistence is automatic via the existing serialize/hydrate path.

## Environment Availability

> This phase has no external dependencies beyond the existing toolchain (all reuse of in-repo code). The toolchain is already in use by Phases 45–49.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build/test | ✓ | v24.15.0 | — |
| pnpm | Package manager | ✓ | (monorepo) | — |
| vitest | Validation | ✓ | ^2.1.9 | — |
| TypeScript | Typecheck | ✓ | ~5.9.3 | — |
| lucide-preact | Icons | ✓ | (existing dep) | — |

**Missing dependencies with no fallback:** none
**Missing dependencies with fallback:** none

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^2.1.9 |
| Config file | `app/vitest.config.ts` |
| Quick run command | `pnpm --filter efx-motion-editor exec vitest run` |
| Full suite command | `pnpm --filter efx-motion-editor exec vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REF-01 | Parser accepts a valid `PhotoReferenceTrack`; rejects malformed track; document model carries stable id + revision | unit | `pnpm --filter efx-motion-editor exec vitest run src/efx-paint/document/` | ❌ Wave 0 (no dedicated parsers test file) |
| REF-02 | Mode switch is one undoable mutation; bumps track revision; three modes persist | unit | `pnpm --filter efx-motion-editor exec vitest run src/stores/` | ❌ Wave 0 |
| REF-03 | `visibleInStudio` toggle never changes `getFlattenedFrame` output; reference never enters flattened raster | unit | `pnpm --filter efx-motion-editor exec vitest run src/stores/` | ❌ Wave 0 |
| REF-04 | Source revision term changes on replace; missing source resolves to null + fail-closed report | unit | `pnpm --filter efx-motion-editor exec vitest run src/stores/` | ❌ Wave 0 |
| REF-05 | Save/reopen (serialize → hydrate) preserves source identity, mode, visibleInStudio, opacity, transform, lock | unit | `pnpm --filter efx-motion-editor exec vitest run src/efx-paint/document/` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter efx-motion-editor exec vitest run` (targeted file)
- **Per wave merge:** `pnpm --filter efx-motion-editor exec vitest run` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `app/src/efx-paint/document/efxPaintDocumentParsers.test.ts` — covers REF-01 (parser extension) and REF-05 (round-trip). Note: no dedicated parsers test file exists today; the existing `efxPaintDocument.test.ts`, `efxPaintCleanBreak.test.ts`, `efxPaintBackgroundFallback.test.ts`, `efxPaintMultiTrackProjection.test.ts` cover the document model but not the new photoReference parser.
- [ ] `app/src/stores/efxPaintStore.photoReference.test.ts` (or extend existing store tests) — covers REF-02 (mode mutation + undo), REF-03 (exclusion), REF-04 (source revision + missing source).
- [ ] Shared fixtures for a valid `PhotoReferenceTrack` and a missing-source document.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — (local desktop app, no auth surface) |
| V3 Session Management | no | — |
| V4 Access Control | no | — (single-user local document) |
| V5 Input Validation | yes | Fail-closed parser (`efxPaintDocumentParsers.ts`) — reject malformed `PhotoReferenceTrack`; library asset IDs only, never external paths |
| V6 Cryptography | no | — (no new crypto; revision hashing reuses existing FNV-1a `hashCanonicalPhysicalValue`) |

### Known Threat Patterns for Preact/Tauri document model

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed/foreign `photoReference` in a loaded document | Tampering | Fail-closed parser throws; clean-break rejection (no partial mutation) |
| External file path injected as a source ref | Tampering | Library asset IDs only (Phase 49 D-09); never external paths |
| Reference pixels leaking into export | Information disclosure (output contract) | D-06 exclusion lock — compositor/export receive no reference input |
| Missing asset silently rendering | Denial of service (silent failure) | Fail-closed resolution + status capsule report (D-04) |

## Sources

### Primary (HIGH confidence — read this session, verbatim quotes cited inline)
- `app/src/efx-paint/document/efxPaintDocument.ts:105` — `readonly photoReference: null;`
- `app/src/efx-paint/document/efxPaintDocumentParsers.ts:327-329` — the fail-closed reject
- `app/src/efx-paint/document/efxPaintDocumentRevision.ts:117` — `'photo:null;'` placeholder
- `app/src/components/physic-paint/engine/physicsPaintStudioSettings.ts:47,87` — `'photo'` fond mode exclusion
- `app/src/components/physic-paint/roto/rotoOnionPreview.ts:34` — `ONION_DEPTH_OPACITY = [0.5, 0.25, 0.15]`
- `app/src/stores/physicPaintStore.ts:434,1584-1593` — source registry + revision seam
- `app/src/stores/efxPaintStore.ts:1039-1062,1088` — serialize/hydrate seam
- `SPECS/milestone-v1.0.0-plan.md:192-200,258-264` — locked modes + `PhotoReferenceTrack` model
- `.planning/phases/50-photo-reference-track/50-CONTEXT.md` — D-01..D-15 locked decisions
- `.planning/phases/50-photo-reference-track/50-UI-SPEC.md` — approved UI contract (discretion resolutions)
- `.planning/REQUIREMENTS.md:62-68` — REF-01..REF-05
- `.planning/config.json` — `nyquist_validation: true`, `tdd_mode: true`, test command

### Secondary (MEDIUM confidence)
- `.planning/research/SUMMARY.md` — Phase 6 milestone research (2026-08-23, HIGH): one photo/reference track, three modes, exclusion, frame-aligned resolution, missing-source recovery
- `.planning/research/PITFALLS.md` — Pitfall 14 (reference leak), M5 (frame-aligned resolution), M6 (missing source silent transparency)

### Tertiary (LOW confidence)
- None — all claims are either read this session (VERIFIED) or explicitly logged as [ASSUMED] in the Assumptions Log.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies; all reused modules read this session
- Architecture: HIGH — locked decisions (D-01..D-15) + approved UI-SPEC + read code seams
- Pitfalls: HIGH — milestone research (Pitfall 14, M5, M6) + D-06 exclusion lock

**Research date:** 2026-09-01
**Valid until:** 2026-09-15 (stable — locked decisions and in-repo reuse; no fast-moving external deps)
