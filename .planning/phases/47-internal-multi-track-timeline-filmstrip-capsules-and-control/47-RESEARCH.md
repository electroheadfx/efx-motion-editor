# Phase 47: Internal Multi-track Timeline, Filmstrip Capsules, and Controls - Research

**Researched:** 2026-08-24
**Domain:** Preact + Signals multi-row timeline UI, drag gestures, filmstrip capsule visualization
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Row layout & header column (TML-01, TML-03, TML-07)
- **D-01:** The multi-row timeline uses an **NLE structure**: a fixed-width header column (~140px, user-resizable) listing every track, with the frame cells extending to the right. The existing header/action row stays on top as the global toolbar. Every row is always visible with its identity. — **Reversibility:** costly — the single-row strip (`PhysicsPaintWorkflowStrip.tsx`, ~2400 lines) is generalized into a row-based model; reverting to single-row means unwinding that refactor.
- **D-02:** Track names are **truncated with an ellipsis** when too long (full name on hover tooltip). Auto-generated names stay short: "Paint 1", "Paint 2", ... The **timeline frame area never depends on name length**.
- **D-03:** Rename is **edit-in-place on double-click** in the header column.
- **D-04:** The active track is marked with an **accent-colored left border + subtle row background tint + bold track name** — always visually unambiguous (TML-03), distinct from rail selection colors (orange selection line, purple/cyan loop rails).
- **D-05:** Vertical scrolling: the **header column stays pinned** while the frame rows scroll beneath it; a slim vertical scrollbar on the right. The **active row auto-scrolls into view** when it changes (track switch, undo auto-activation per Phase 46 D-04, keyboard navigation).
- **D-06:** The fixed Background row is labeled **"Bg"** (short label that fits the fixed-width header column without truncation) with a **muted tone** (darker/desaturated vs Paint rows) and a **lock indicator** (fixed position, cannot reorder above Paint rows — Pitfall 12). Gaps show the transparent checkerboard or solid fallback swatch.

#### Track CRUD interactions (TML-02, TML-08)
- **D-07:** Add/duplicate/delete controls: **per-row hover actions** (duplicate, delete icon buttons) in the header column; a **'+' button at the bottom of the header column** adds a track. Everything track-related lives with the track — no global toolbar clutter.
- **D-08:** Reorder = **drag the row header** with a live insertion indicator. The header drag has a **distinct grab area + cursor** from content drag so the two never conflict.
- **D-09:** Duplicate = **full deep copy with fresh identities** (the Phase 46 paste rule, D-05): Paint frames, Roto keys, Loop Clips all copied self-contained, editable with zero effect on the source. Duplicate name gets a short suffix (e.g., " copie") — exact suffix is Claude's discretion.
- **D-10:** Track CRUD survives save/reopen; reorder changes compositor order but never track identity (stable UUIDs, Phase 45 — Pitfall 1, Pitfall M3).

#### Filmstrip capsules (TML-06, TML-07)
- **D-11:** The filmstrip capsule **evolves the existing Loop Clip rail** (`PhysicsPaintLoopClipRail.tsx` + `physicsPaintLoopClipPresentation.ts`), it does not replace it. The Phase 43 rail semantics stay locked: selection, drag, spacing, playback, purple/cyan rails, passive markers, white endpoint cuts. The capsule adds the spec elements around the rail: source-cycle cells at the capsule head, ×N/∞ + requested/effective badges, diagonal cut on partial cycles, high-zoom expansion.
- **D-12:** A **compact badge on the capsule** shows the requested duration (`Cycle 5f × 3 = 15f`, `Cycle 1f × 20`, or `Cycle 5f × ∞`). When a next clip shortens the loop, the badge switches to the **distinct shortened visual + "Loop shortened by next clip"** label (Pitfall m2: badge always shows requested; shortened state is a distinct visual + label). Full detail (repeat instance, source-frame index, source asset, provenance) stays in the **tooltip**.
- **D-13:** High-zoom expansion: below a zoom threshold, repetitions show as the **compact perforated/hatched band**; above it, each repeated occurrence **expands into lighter linked cells** (same source-frame mapping, lighter tone). The threshold is **derived from cell width** so the expansion is gradual and predictable.
- **D-14:** The following-clip label is **"next clip — interrupts the loop"** (English, per the copy-language correction). Never "clip bloquant".

#### Cross-track drag (TML-05, Phase 46 D-08/D-09)
- **D-15:** **All existing draggables can cross track rows**: real keys, Key Rails, Loop Clip Rails, rail sets. The drag starts on the source row and crosses into the destination row.
- **D-16:** **Plain drag crosses rows** — no modifier key. Crossing a row boundary automatically becomes a cross-track move: the destination row highlights as the drop target and a **live insertion preview** shows exactly where the dragged content will land in the destination row (frame position).
- **D-17:** On release, the move commits with the Phase 46 D-09 semantics (exactly copy-paste-delete: fresh identities in the destination, source items removed, Hold refs re-pointed fail-closed). Rejections surface through the **existing status capsule with the red warning triangle** — identical to the Phase 46 paste rejection UX.
- **D-18:** The row-reorder drag (D-08) and the content cross-track drag (D-15/D-16) are distinct interactions: different grab areas and cursors, so timeline interactions never mutate another row accidentally (TML-05 acceptance).

### Claude's Discretion
- Exact store/function shape for the multi-row strip refactor (generalize `PhysicsPaintWorkflowStrip.tsx` into a row-based model vs. a new multi-row container instantiating per-track strips — research recommends the former; researcher finalizes).
- Background row scope in Phase 47: the Bg row renders Background clips **when present** (display surface via the shared capsule, D-11); the import/repeat/fallback-config UI is Phase 49 (BKG). With no clips yet, the row shows the fallback display.
- Hide/solo Studio reflection: Phase 47 applies the **hide/solo truth table to the Studio preview** (visibility filter on the existing preview path, Pitfall M8); opacity/blend application is Phase 48 (CMP-03).
- No placeholder rows for photo/reference or audio surfaces in Phase 47 — they arrive with Phases 50/51; the row model should anticipate them but not render them.
- Keyboard shortcuts for track CRUD: guard against conflicts per the existing `isPaintEditMode()` shortcut-guard pattern (Pitfall m4).
- Duplicate name suffix (D-09), exact delete-confirmation copy (English, per Phase 46 D-14 acknowledge-and-delete), exact badge/tooltip copy wording.

### Deferred Ideas (OUT OF SCOPE)
- Background clip import, repeat-count, and fallback-config UI — **Phase 49** (BKG); Phase 47 only renders the Bg row and clips when present.
- Internal opacity/blend application in the flattened composite — **Phase 48** (CMP-03); Phase 47 only reflects hide/solo in the Studio preview.
- Photo/reference and audio-preview row surfaces — **Phases 50/51**; the row model anticipates them but renders no placeholders in Phase 47.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description (REQUIREMENTS.md) | Research Support |
|----|-------------|------------------|
| TML-01 | EFX Paint Studio shows a vertically scrollable multi-row Paint timeline with internal Paint track rows | Multi-row strip generalization of `PhysicsPaintWorkflowStrip.tsx`; pinned header column + vertical scrollbar (D-05); geometry from UI-SPEC (rows region 141px, row height 48px, strip 264px). Store-op gap: the store already models `InternalPaintTrack` rows; no new row-op is needed to render. |
| TML-02 | User can add, rename, duplicate, delete, and reorder internal Paint tracks | **Store-op gap (critical):** `efxPaintStore` exports only `setActiveTrackId` / `requestDeleteTrack` / `commitDeleteTrack`; add/rename/duplicate/reorder ops and the track-array insertion/removal/reorder mutations MUST be built. Delete reuses `requestDeleteTrack`/`commitDeleteTrack` (acknowledge-and-delete, Phase 46 D-14/D-15/D-16). Duplicate reuses `duplicateTrackFrames` + Loop Clip deep-copy with fresh identities. |
| TML-03 | User can select the active Paint track; the active track is always visually unambiguous | `setActiveTrackId(layerId, trackId)` already exists in `efxPaintStore`; row click calls it and the Studio re-reads via `efxPaintVersion`. Visual marking (accent border/tint/bold name, D-04) is pure CSS; distinct from selection orange `#F59E0B` and rail purple `#8B5CF6` / cyan `#06B6D4`. |
| TML-04 | User can hide/solo Paint tracks and set internal track opacity and blend mode | **Store-op gap:** `setTrackVisible` / `setTrackSolo` / `setTrackOpacity` / `setTrackBlend` do NOT exist — must be built; each bumps the track `revision` (`bumpTrackRevision` exists). Hide/solo toggles live in the header column; opacity slider + blend select for the active track live in the right panel (UI-SPEC S1f). Studio preview reflects hide/solo only (visibility filter in `previewRenderer.ts`); opacity/blend application is Phase 48. |
| TML-05 | Frame keys/caches show on the correct row; Paint/Roto/PlayScript/Cut/Copy/Paste/drag route to the active track | Active-track routing is ALREADY centralized: `PhysicsPaintStudio.tsx` routes all store reads/writes via `studioActiveTrackId()`; `previewRenderer.ts` uses `getActiveTrackId(layerId)`. Multi-row adds per-row data (each row reads its own trackId) while all gestures keep routing through `studioActiveTrackId()`. Cross-track drag (D-15..D-18) extends existing prepare/commit drag machinery with a destination trackId and commits via `moveTrackItems`. |
| TML-06 | Hold Loop Clips show as adaptive filmstrip capsules (source cycle, linked repetition band, ×N/∞, requested/effective duration, partial-cycle interruption) | Evolve `physicsPaintLoopClipPresentation.ts` + `PhysicsPaintLoopClipRail.tsx` around the locked rail (D-11). Resolver facts come from `derivePhysicPaintRotoLoopRanges` in `physicsPaintRotoPhysicalResolver.ts` (range carries `cycleLength`, `repeat`, `requestedEnd`, `effectiveEnd`, `truncated`, `partialCycle`, `unresolved`). **Path drift:** CONTEXT.md says `physicsPaintRotoLoopClips.ts` — the actual resolver file is `physicsPaintRotoPhysicalResolver.ts`. |
| TML-07 | One visually distinct fixed Background row sits beneath Paint rows with imported clips, gaps/fallback, and "clip suivant — interrompt la boucle" label | Label is **"next clip — interrupts the loop"** (English, per user copy correction D-14); "Bg" row header, muted tone, lock indicator (D-06). Phase 47 renders Background clips when present via the shared capsule; import/repeat/fallback-config UI is Phase 49. Gaps show checkerboard/solid fallback (`BackgroundFallback` = `transparent` or `solid`). |
| TML-08 | Track CRUD survives save/reopen; reorder changes compositor order but not track identity | Persistence flows through `serializeRuntimeIntoDocument` / `hydrateRuntimeFromDocument`; reorder writes the `order` field, never the stable UUID `id` (D-10, Pitfall 1/M3). Track-add/rename/duplicate/reorder store ops must write through the same serialize/hydrate path so CRUD survives save/reopen. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Preact-native patterns, not React idioms:** this is Preact + `@preact/signals`. Use `signal`/`computed`/`effect` for shared reactive state (track list, active track, hide/solo, row models); do not introduce `useState`/`useEffect` to mirror state that lives in signals. The strip already uses signals heavily — the multi-row generalization must keep that.
- **Always bump AND subscribe to `paintVersion`:** every track mutation (add/rename/duplicate/reorder/hide/solo/opacity/blend) bumps the track `revision`; consumers subscribe via `getTrackPaintVersion`/`getTrackRotorRevision`. Per-track `revision` bump + subscribe is the established pattern (Pitfall 4).
- **Use pnpm, not npm.** Run `pnpm --filter efx-motion-editor exec vitest run` for tests; never launch Vitest watch mode.
- **Do not run the server** — local dev server stays on the user's side.
- **GSD artifacts in English** — all planning and tracking output in English (shipped UI copy is English per the user copy correction).

## Summary

Phase 47 is the **UI + gesture layer** that consumes the Phase 46 data layer. The phase delivers: N Paint track rows + one fixed Background row, track CRUD (add/rename/duplicate/delete/reorder), active-track selection, hide/solo/opacity/blend controls, filmstrip Loop Clip capsules, vertical scrolling with ensure-active-row visibility, and the cross-track drag deferred from Phase 46. The internal compositor (opacity/blend application) is Phase 48; Phase 47 only reflects hide/solo in the Studio preview. Zero new dependencies — this is a refactor + store-op extension phase on the existing Preact/Signals stack.

The **most important research finding is a store-op gap**: CONTEXT.md states "Phase 46 built the data layer (track CRUD + hide/solo/opacity/blend store ops)", but codebase verification shows `efxPaintStore.ts` exports only `setActiveTrackId`, `requestDeleteTrack`, `commitDeleteTrack`, and `takePendingTrackDeletions` (plus register/serialize/hydrate/reset). There are **no add/rename/duplicate/reorder track ops and no `setTrackVisible`/`setTrackSolo`/`setTrackOpacity`/`setTrackBlend` ops anywhere in `app/src`**. Phase 47 must build these store ops (each bumping the track `revision`) before the UI can call them. The underlying document model is ready: `InternalPaintTrack` already carries `name`, `order`, `visible`, `solo`, `opacity`, `blendMode`, `revision`.

The second finding is that **active-track routing is already centralized and needs only a one-line-per-event extension**. `PhysicsPaintStudio.tsx` routes every store read/write through `studioActiveTrackId()` (derived from `launchContext.document.activeTrackId`), and `previewRenderer.ts` already resolves the active track via `getActiveTrackId(layerId)`. Row click calls `setActiveTrackId(layerId, trackId)`; the hide/solo Studio reflection is a visibility filter inside `resolvePhysicPaintFrameSource` (return `null` → empty frame when the active track is hidden or not in the solo set). Per-row data rendering is the new work: each row reads its own trackId from the document.

The third finding concerns the **filmstrip capsule**: it evolves `physicsPaintLoopClipPresentation.ts` (badge/tooltip foundation) + `PhysicsPaintLoopClipRail.tsx` (rail rendering) around the locked Phase 43 rail semantics. All requested/effective/partial-cycle facts come from the single resolver `derivePhysicPaintRotoLoopRanges` — **note the canonical-ref path drift**: the resolver lives in `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts` (262 KB), NOT `physicsPaintRotoLoopClips.ts` as CONTEXT.md's canonical refs state.

**Primary recommendation:** Build Phase 47 in this order — (1) track CRUD + hide/solo/opacity/blend store ops in `efxPaintStore.ts`/`physicPaintStore.ts` (fills the gap, each op bumps track revision and writes through serialize/hydrate for TML-08), (2) multi-row strip generalization of `PhysicsPaintWorkflowStrip.tsx` (row-based model + pinned header column + vertical scroll + per-row data reading), (3) track CRUD UI + hide/solo toggles in the header column + opacity/blend right-panel section, (4) hide/solo preview visibility filter in `previewRenderer.ts`, (5) filmstrip capsule evolution of the Loop Clip rail, (6) cross-track drag extension of the existing prepare/commit machinery.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Multi-row timeline rendering (rows, cells, ruler, scroll) | Browser / Client | — | Pure DOM/CSS rendering over the document model; no server involvement |
| Track CRUD state (add/rename/duplicate/reorder) | API / Backend (state/store layer) | Browser / Client | `efxPaintStore`/`physicPaintStore` own track-array mutations; UI components call store ops. In this SPA the "backend" is the store layer, and the ops do NOT exist yet — they must be built |
| Active-track selection & routing | API / Backend (state/store layer) | Browser / Client | `setActiveTrackId` + `getActiveTrackId`; all Paint/Roto/PlayScript/Cut/Copy/Paste/drag ops route through the active trackId |
| Hide/solo/opacity/blend state | API / Backend (state/store layer) | Browser / Client | Document track fields (`visible`, `solo`, `opacity`, `blendMode`) mutated via store ops + `bumpTrackRevision` |
| Hide/solo Studio preview reflection | Browser / Client (preview render path) | — | `previewRenderer.ts` `resolvePhysicPaintFrameSource` returns `null` (empty frame) for hidden/not-soloed active track — visibility filter, NOT the Phase 48 compositor |
| Filmstrip capsule presentation | Browser / Client | — | Derived presentation (`projectPhysicsPaintLoopClipPresentation`) from resolver ranges; pure client rendering |
| Cross-track drag gesture | Browser / Client | API / Backend (state/store layer) | Gesture lives in the strip; commit routes through `moveTrackItems(layerId, from, to, keys)` |
| Track CRUD persistence (save/reopen) | API / Backend (state/store layer) | Database / Storage (serialization) | `serializeRuntimeIntoDocument` / `hydrateRuntimeFromDocument`; reorder writes `order`, never `id` (TML-08) |

## Standard Stack

### Core (existing, unchanged — zero new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| preact | ^10.28.4 | UI framework | Existing Studio/strip/rail stack; the multi-row generalization must stay Preact-native |
| @preact/signals | ^2.8.1 | Reactive state | Existing signal/computed/effect patterns for shared state (active track, hide/solo, row models) |
| lucide-preact | ^0.577.0 | Icons | Existing icon set (`Eye`, `EyeOff`, `Copy`, `Trash2`, `Plus`, `GripVertical`, `Lock`, `ChevronUp/Down`) for header-column controls |
| vitest | ^2.1.9 | Tests | Existing test runner; `pnpm --filter efx-motion-editor exec vitest run` |

**This phase introduces NO new packages.** The multi-row timeline, filmstrip capsule, cross-track drag, and track CRUD are built entirely from the existing stack. No package legitimacy audit entries are required (see Package Legitimacy Audit).

**Version verification:** confirmed from `app/package.json` (lines 20, 29, 32, 48) this session. Preact 10.x and signals 2.x are stable; no version drift concerns for this phase.

## Package Legitimacy Audit

> No external packages are installed by this phase. The phase is a refactor + store-op extension over the existing stack (preact, @preact/signals, lucide-preact, vitest — all already in `app/package.json`). The Package Legitimacy Gate protocol was not invoked because there are zero new dependencies to audit.

**Packages removed due to [SLOP] verdict:** none (no new packages proposed).
**Packages flagged as suspicious [SUS]:** none.
**Packages tagged [ASSUMED]:** none — every library referenced in this research already exists in the repository and was verified against `app/package.json` this session.

## Architecture Patterns

### System Architecture Diagram

```mermaid
flowchart LR
    subgraph Store["State layer (stores)"]
        ED["efxPaintStore.ts\n(document tracks, activeTrackId,\ntrack CRUD ops — add/rename/dup/reorder\nMUST BE BUILT, setTrackVisible/Solo/Opacity/Blend\nMUST BE BUILT)"]
        PS["physicPaintStore.ts\n(getFrame/getRotoPhysicalRenderSource,\nmoveTrackItems, duplicateTrackFrames,\nbumpTrackRevision, mount/removeTrackRuntime)"]
    end

    subgraph UI["Studio UI (Preact + Signals)"]
        C["PhysicsPaintStudio.tsx\n(controller — studioActiveTrackId()\nroutes ALL ops to active track)"]
        S["PhysicsPaintWorkflowStrip.tsx\nMULTI-ROW generalization\n(header column pinned + rows region)"]
        H["Header column per-row\n(name, hide/solo, hover dup/delete,\nreorder grab, active accent)"]
        R["Per-row frame cells + rails\n(Key Rails, Loop Clip Rails)"]
        CAP["Filmstrip capsule\n(presentation + rail evolution)"]
        RT["PhysicsPaintRightPanel.tsx\n(opacity slider + blend select\nfor active track)"]
    end

    subgraph Preview["Preview path"]
        PR["previewRenderer.ts\nresolvePhysicPaintFrameSource\n→ getActiveTrackId(layerId)\n+ hide/solo visibility filter\n(Phase 47 — returns null when hidden/soloed-out)"]
        REND["Canvas render"]
    end

    C -->|row click → setActiveTrackId| ED
    C -->|all reads/writes via activeTrackId| PS
    S -->|per-row reads trackId| PS
    S -->|gesture commits| PS
    CAP -->|range facts from derivePhysicPaintRotoLoopRanges| PS
    RT -->|setTrackOpacity / setTrackBlend (to build)| ED
    PS -->|getRotoPhysicalRenderSource / getFrame| PR
    ED -->|activeTrackId + visible/solo| PR
    PR --> REND
```

**Reading the diagram:** the controller (`PhysicsPaintStudio.tsx`) is the single routing authority — every store call goes through `studioActiveTrackId()`. The multi-row strip adds per-row reads (each row reads its own trackId) while gestures keep committing through the active-track path. The preview path (`previewRenderer.ts`) is where Phase 47's hide/solo Studio reflection lands. Store ops in red (MUST BE BUILT) are the Phase 47 store-layer gap this research surfaced.

### Recommended Project Structure (new/modified files)

```
app/src/
├── stores/
│   ├── efxPaintStore.ts            # MODIFY: addTrack, renameTrack, duplicateTrack,
│   │                               #   reorderTrack, setTrackVisible, setTrackSolo,
│   │                               #   setTrackOpacity, setTrackBlend (each bumps revision,
│   │                               #   writes through serialize/hydrate for TML-08)
│   └── physicPaintStore.ts         # MODIFY (already has moveTrackItems/duplicateTrackFrames)
├── components/physic-paint/
│   ├── view/
│   │   ├── PhysicsPaintWorkflowStrip.tsx   # REFACTOR: multi-row row-based model
│   │   │                                   #   (generalize the single-row strip, D-01)
│   │   ├── physicsPaintTrackHeaderColumn.tsx   # NEW: pinned header column (name, hide/solo,
│   │   │                                       #   hover dup/delete, reorder grab, '+', "Bg" row)
│   │   ├── PhysicsPaintTrackRow.tsx           # NEW: one row (cells + rails), 48px
│   │   ├── physicsPaintFilmstripCapsule.tsx   # NEW: capsule elements around the rail
│   │   ├── PhysicsPaintLoopClipRail.tsx       # MODIFY: capsule integration (rail semantics locked)
│   │   ├── physicsPaintLoopClipPresentation.ts# MODIFY: badge/tooltip copy (English), shortened visual
│   │   └── physicsPaintStudioKeyboard.ts      # MODIFY: track CRUD shortcuts (isPaintEditMode guard)
│   ├── view/PhysicsPaintRightPanel.tsx        # MODIFY: opacity slider + blend select section
│   └── hooks/useRotoTimelineActions.ts        # MODIFY: cross-track drag destination trackId
├── lib/previewRenderer.ts                     # MODIFY: hide/solo visibility filter
└── components/physic-paint/physicsPaintStudio.css  # MODIFY: 161px → 264px strip, 48px rows,
                                                    #   pinned header column, active accent, muted Bg
```

### Pattern 1: Multi-row strip generalization (D-01)

**What:** Generalize `PhysicsPaintWorkflowStrip.tsx` (single-row, ~3400 lines) into a row-based model: one pinned header column + N Paint rows + 1 Background row sharing the horizontal scroller. The existing header/action row becomes the global toolbar; ruler, cells, rails, and the horizontal scrollbar live in a shared scrolling pane.

**When to use:** This is the locked approach (D-01 + Claude's discretion: research recommends generalizing the existing strip over instantiating per-track strips, because the strip already owns the ruler, horizontal scrollbar, zoom, playback, onion, selection, and drag machinery — duplicating those per row would fork behavior).

**Implementation notes (verified from code):**
- `ROTO_CELL_WIDTH_PX = 18` (`PhysicsPaintWorkflowStrip.tsx:341`); `rotoLaneWidthPx = frameCells.length * ROTO_CELL_WIDTH_PX` (line 1067). Row width is shared; per-row content is the same `frameCells` mapping with a per-row `trackId`.
- Each row's cells map with the existing `getRotoCellDerivation(frame)` per-cell — pass the row's trackId through so cell state (real/linked/gap/empty) resolves per track.
- CSS: `.physics-paint-studio` grid is `grid-template-rows: minmax(58px, auto) minmax(0, 1fr) 161px` (`physicsPaintStudio.css:412`); `.physics-paint-workflow-strip` is `height: 161px` (line 1964-1972). Target: **264px** strip total, **141px** rows region, **48px** row height, **140px** header column, **18px** frame pitch (UI-SPEC S2 geometry, lines 68-76).
- Roving rail keyboard navigation (`physicsPaintRailKeyboardNavigation.ts`) uses `.physics-paint-lane` / `.physics-paint-rail-target` selectors — must be scoped per-row (each row's lane gets a `data-track-id`, and roving operates within the active row's lane).

### Pattern 2: Active-track routing (TML-03, TML-05)

**What:** The Studio controller already centralizes routing: `trackIdOfLaunch = (lc) => lc?.document?.activeTrackId ?? ''` and `studioActiveTrackId = () => trackIdOfLaunch(launchContextRef.current)` (`PhysicsPaintStudio.tsx:243-244`). All store reads/writes already go through `studioActiveTrackId()`.

**When to use:** Every interaction in the multi-row timeline.

**Implementation notes:**
- Row click → `efxPaintStore.setActiveTrackId(layerId, trackId)` (already exists). The Studio must re-read on `efxPaintVersion` change (bump it in `setActiveTrackId` — verify; the store's existing ops already bump `efxPaintVersion`).
- Undo auto-activation (Phase 46 D-04) must also trigger the ensure-active-row-visible scroll (D-05) — subscribe to the active track change in the strip.
- Hide/solo preview filter: `resolvePhysicPaintFrameSource` (`previewRenderer.ts:132`) already calls `physicPaintStore.getRotoPhysicalRenderSource(layerId, getActiveTrackId(layerId), frame)` (line 134) and `getFrame(layerId, getActiveTrackId(layerId), frame)` (line 146). Insert the truth table before these: if the active track is `visible === false`, or `solo` is armed anywhere and the active track is not soloed → return `null` (empty frame). Do NOT touch the `'loop-placeholder'` path (lines 135-138).

### Pattern 3: Filmstrip capsule evolution (TML-06, D-11..D-14)

**What:** Add the capsule elements around the locked Phase 43 rail inside the 48px row. The rail stays untouchable (selection, drag, spacing, playback, purple/cyan, passive markers, white endpoint cuts). The capsule adds: source-cycle cells at the capsule head, a requested-duration badge, the distinct shortened visual + "Loop shortened by next clip", the following-clip label "next clip — interrupts the loop", and high-zoom expansion into lighter linked cells (threshold derived from cell width, D-13).

**When to use:** For every Hold Loop Clip on every row.

**Implementation notes (verified):**
- Facts come from the single resolver `derivePhysicPaintRotoLoopRanges` in `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts` (NOT `physicsPaintRotoLoopClips.ts` — path drift). The `PhysicPaintRotoLoopRange` carries `cycleLength`, `sourceFrameCount`, `sourceKeyIds`, `sourceOffsets`, `repeat: number | 'infinity'`, `requestedEnd`, `effectiveEnd`, `boundary`, `truncated`, `partialCycle`, `unresolved` (resolver lines 5338-5364).
- `projectPhysicsPaintLoopPresentation(range, clip, sourceActionName, options)` already produces `cycleLabel` (`Cycle {N}f × {R} = {T}f` or `Cycle {N}f × ∞`), `effectiveLabel` (`Effective {E}f`), `tooltipLines`, `accessibleName`, and lifecycle statuses. Extend it for the capsule badge/shortened visual; keep `cycleLabel` (requested) in the badge at all times (Pitfall m2).
- Geometry projection comes from `projectPhysicsPaintLoopClipGeometry(range, visibleFrameWindow, framePitch)` already used by `PhysicsPaintLoopClipRail.tsx`.

### Pattern 4: Cross-track drag (TML-05, D-15..D-18)

**What:** Extend the existing drag prepare/commit machinery (single-key drag, rigid group drag, rail-set move, push — all with release-time rejection publication) so a plain drag crossing a row boundary becomes a cross-track move.

**When to use:** All draggables (real keys, Key Rails, Loop Clip Rails, rail sets) crossing rows.

**Implementation notes (verified):**
- The existing drag actions in `useRotoTimelineActions.ts` are track-agnostic (they operate on the active track). Cross-track needs a destination trackId captured at boundary-crossing, and the commit routes through `physicPaintStore.moveTrackItems(layerId, fromTrackId, toTrackId, keys): RotoTrackPasteResult` (exists, `physicPaintStore.ts:2711`) which implements the Phase 46 D-09 copy-paste-delete semantics (fresh identities, fail-closed Hold re-pointing).
- Rejections publish to the existing status capsule with the red warning triangle (Phase 46 paste UX) — reuse the same publication path.
- Row-reorder drag (D-08) is a separate gesture: different grab area (`GripVertical` region in the header column) + cursor, so it can never conflict with content drag (D-18).

### Anti-Patterns to Avoid

- **Per-track strip instantiation:** building a new multi-row container that mounts N independent copies of the current single-row strip forks the ruler/scrollbar/zoom/selection machinery N times and breaks shared-horizontal-scroll semantics. Generalize the existing strip into a row-based model instead (D-01, research recommendation).
- **Array-index track identity:** any reorder/add/delete implementation that keys tracks by array position breaks stable UUID identity (Pitfall 1, Pitfall M3). Reorder writes `order`, never `id`.
- **Bypassing the active-track routing authority:** the multi-row timeline must NOT route gestures directly to a clicked row's trackId except for the explicit cross-track drag; all non-cross gestures keep routing through `studioActiveTrackId()`. Otherwise TML-05's "frame keys show on correct row but ops route to active track" contract breaks.
- **Applying opacity/blend in Phase 47:** opacity/blend state is stored now, but application belongs to the Phase 48 compositor. The preview filter must only handle hide/solo (Pitfall M8).
- **Hand-rolled copy:** the French labels from the spec are a recorded v0.9 divergence. Shipped copy is English — "Loop shortened by next clip" and "next clip — interrupts the loop" (D-14). Never ship `clip suivant` / `clip bloquant` / `Boucle raccourcie`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Loop Clip duration / partial-cycle facts | A second resolver or manual modulo math | `derivePhysicPaintRotoLoopRanges` (single resolver, `physicsPaintRotoPhysicalResolver.ts`) | Pitfall m2: requested vs effective, truncation, partial-cycle, unresolved — one source of truth so every capsule label agrees with the data layer |
| Loop Clip badge/tooltip text | New label strings | `projectPhysicsPaintLoopClipPresentation` (extend it for capsule visuals) | `cycleLabel`/`effectiveLabel`/`tooltipLines` already encode the requested-duration and effective semantics |
| Cross-track move commit logic | Re-implementing copy-paste-delete in the UI | `physicPaintStore.moveTrackItems` | Phase 46 D-09 semantics (fresh identities, fail-closed Hold re-pointing) are already implemented and tested |
| Frame deep-copy on duplicate | New copy logic | `physicPaintStore.duplicateTrackFrames` + Loop Clip fresh-identity copy | Phase 46 D-05 paste rule — copied content editable with zero effect on the source |
| Track delete semantics | A naive splice | `efxPaintStore.requestDeleteTrack` / `commitDeleteTrack` | Acknowledge-and-delete, cached sidecar removal, Hold ref severing, last-Paint-track refusal — all built in Phase 46 |
| Hide/solo truth table | Ad-hoc visibility in each row | Single filter in `resolvePhysicPaintFrameSource` | Pitfall M8: no solo → all visible; solo → visible+soloed only; hide wins over solo. One place, tested |
| Track revision propagation | Manual invalidation | `bumpTrackRevision` + `getTrackPaintVersion` / `getTrackRotorRevision` | Per-track `paintVersion` bump + subscribe is the established cache-invalidation pattern (Pitfall 4) |

**Key insight:** Phase 47 is a UI layer over a deliberately prepared data layer. The Phase 46 store ops (move, duplicate-frames, delete, mount/remove runtime, revision bump) already exist — the UI must call them, not re-derive their semantics. The one exception is the store-op gap (track add/rename/duplicate/reorder + hide/solo/opacity/blend setters), which genuinely must be built before the UI can bind to it.

## Runtime State Inventory

> This phase generalizes the single-row strip into a multi-row timeline and adds document-track mutations. The inventory covers runtime state that could persist the old single-row assumption or break if track identity/order semantics change.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `EfxPaintDocument` persisted via `serializeRuntimeIntoDocument` / `hydrateRuntimeFromDocument`. Fields affected by this phase: `tracks[]` (name/order/visible/solo/opacity/blendMode), `activeTrackId`, `documentRevision`. Track identity is stable UUIDs; reorder changes `order` only. | **No data migration.** New track CRUD ops must write through the same serialize/hydrate path so saved documents reopen with the new track set (TML-08). Existing saved documents (single track "Track 1", `createDefaultPaintTrack` names it `'Track 1'`) reopen unchanged. |
| Live service config | None — no external services. | None. |
| OS-registered state | None — no task scheduler, launchd, systemd, or OS registrations reference the strip/tracks. | None. |
| Secrets/env vars | None — no secrets reference track state. | None. |
| Build artifacts | None — source-level refactor; no installed packages, no compiled artifacts carry the single-row assumption. | None. |

**Nothing found in category:** Live service config, OS-registered state, secrets/env vars, build artifacts — verified via repo inspection this session (no external service/OS integration exists for the strip or tracks).

## Common Pitfalls

### Pitfall 1: Track identity via array position
**What goes wrong:** Reorder/add/delete implemented with array indices corrupts undo, caches, and Hold references.
**Why it happens:** Array positions are convenient but unstable.
**How to avoid:** Always mutate the `tracks` array by stable `id`; reorder writes the `order` field; new ops generate fresh UUIDs (`duplicateTrackFrames` path already does). TML-08 acceptance checks save/reopen with reordered tracks.
**Warning signs:** Any reducer keyed on `index`; any `tracks[index]` in a store op.

### Pitfall 2: The store-op gap (CRITICAL, this phase's #1 risk)
**What goes wrong:** The planner assigns UI work that calls `addPaintTrack`, `setTrackVisible`, etc., which do not exist — the executor hits a `parse()`/typecheck failure at the most expensive place.
**Why it happens:** CONTEXT.md claims Phase 46 built "track CRUD + hide/solo/opacity/blend store ops", but verification shows only `setActiveTrackId`, `requestDeleteTrack`, `commitDeleteTrack`, `moveTrackItems`, `duplicateTrackFrames` exist.
**How to avoid:** Plan the store ops as the first wave of tasks: `addTrack`, `renameTrack`, `duplicateTrack`, `reorderTrack`, `setTrackVisible`, `setTrackSolo`, `setTrackOpacity`, `setTrackBlend`. Each bumps `efxPaintVersion` + the track `revision` and writes through serialize/hydrate.
**Warning signs:** A task description that calls a track mutation op not listed in this research.

### Pitfall 3: Active-track routing drift
**What goes wrong:** The multi-row timeline routes a gesture to the row under the cursor instead of the active track.
**Why it happens:** With many rows visible, it is tempting to make each row "own" its interactions.
**How to avoid:** Keep ALL non-cross gestures routed via `studioActiveTrackId()`. Per-row reads are data reads only (each row resolves its own cells); mutations go through the active-track path. Only the explicit cross-track drag (D-15/D-16) targets a destination trackId.
**Warning signs:** A row component that calls a mutating store op directly.

### Pitfall 4: Hide/solo truth table drift (Pitfall M8)
**What goes wrong:** The Studio preview ignores hide/solo or implements a different rule than the locked truth table.
**Why it happens:** The truth table lives in the spec; a per-component ad-hoc check drifts.
**How to avoid:** Single visibility filter in `resolvePhysicPaintFrameSource` returning `null` for hidden/not-soloed active track. Rule (locked): no solo → all visible; solo → visible+soloed only; hide wins over solo. Do NOT apply opacity/blend here (Phase 48).
**Warning signs:** Any opacity/blend math in the preview render path this phase.

### Pitfall 5: Resolver path drift
**What goes wrong:** The executor follows CONTEXT.md's canonical ref `physicsPaintRotoLoopClips.ts` and reads the wrong file (that path does not exist).
**Why it happens:** The resolver was reorganized/renamed; the canonical refs are stale.
**How to avoid:** Use `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts` (single resolver: `derivePhysicPaintRotoLoopRanges`, `PhysicPaintRotoLoopRange`, `PhysicPaintRotoFrameResolution`).
**Warning signs:** A Read of `physicsPaintRotoLoopClips.ts` returns ENOENT.

### Pitfall 6: French copy shipped
**What goes wrong:** The spec's French labels (`clip suivant`, `Boucle raccourcie`, `clip bloquant`) ship.
**Why it happens:** The locked spec still contains them; they are a recorded v0.9 divergence, not shipped copy.
**How to avoid:** English only: "Loop shortened by next clip", "next clip — interrupts the loop", "Add track", "Delete track {name}?", "A document must always have at least one Paint track."
**Warning signs:** Any `clip suivant` / `bloquant` / `Boucle` string in a new component.

### Pitfall 7: Row reorder drag vs content drag conflict
**What goes wrong:** Dragging a row header accidentally starts a content drag (or vice versa), mutating the wrong row (TML-05 acceptance).
**Why it happens:** Both are pointer drags in the same strip.
**How to avoid:** Distinct grab area (header-column `GripVertical` region) + distinct cursor + a reorder-drag state machine that never falls through to content drag (D-08, D-18).
**Warning signs:** Shared pointer-down handler without a grab-area discriminator.

### Pitfall 8: Cache keys missing per-track identity (Pitfall 4)
**What goes wrong:** Multi-row cache keys collide across tracks — frame cache/rendered data for track A shows on track B.
**Why it happens:** The single-row strip's keys never needed a trackId component.
**How to avoid:** All per-row cache keys, `getTrackPaintVersion` subscriptions, and render-source lookups include the row's trackId. `getRotoPhysicalRenderSource(layerId, trackId, frame)` already takes trackId — the multi-row strip must pass each row's own.
**Warning signs:** A row rendering another row's frames after switching active track.

## Code Examples

Verified patterns from the repository (read this session):

### 1. Document track model — the fields the CRUD/hide/solo/opacity/blend ops mutate
```typescript
// Source: app/src/efx-paint/document/efxPaintDocument.ts:47-59 (verbatim)
export interface InternalPaintTrack {
  readonly id: string;
  readonly name: string;
  readonly order: number;
  readonly visible: boolean;
  readonly solo: boolean;
  readonly opacity: number;
  readonly blendMode: BlendMode;
  readonly revision: number;
  readonly frames: Readonly<Record<number, CachedFrameReference>>;
  readonly rotoPhysical: PhysicPaintRotoPhysicalDocument | null;
  readonly loopClips: readonly FrameLoopClip[];
}
```
```typescript
// Source: app/src/efx-paint/document/efxPaintDocument.ts:62-68 (verbatim)
export interface BackgroundTrack {
  readonly id: string;
  readonly clips: readonly FrameLoopClip[];
  readonly fallback: BackgroundFallback;
  readonly visible: boolean;
  readonly revision: number;
}
```
```typescript
// Source: app/src/efx-paint/document/efxPaintDocument.ts:71-80 (verbatim)
export interface EfxPaintDocument {
  readonly version: number;
  readonly parentLayerId: string;
  readonly documentRevision: number;
  readonly activeTrackId: string;
  readonly tracks: readonly InternalPaintTrack[];
  readonly background: BackgroundTrack;
  readonly photoReference: null;
  readonly compositeRevision: number;
}
```
```typescript
// Source: app/src/efx-paint/document/efxPaintDocument.ts:17 (verbatim)
export type BlendMode = 'normal' | 'screen' | 'multiply' | 'overlay' | 'add';
```
```typescript
// Source: app/src/efx-paint/document/efxPaintDocument.ts:20-22 (verbatim)
export type BackgroundFallback =
  | { readonly mode: 'transparent' }
  | { readonly mode: 'solid'; readonly color: string };
```
Note: `createDefaultPaintTrack` (line 82-96) names the default track `'Track 1'` — the UI-SPEC auto-generated naming `Paint 1`, `Paint 2`, ... applies to NEW tracks added in Phase 47; the Phase 45 default name is unchanged.

### 2. The active-track routing authority and the preview filter point
```typescript
// Source: app/src/components/physic-paint/PhysicsPaintStudio.tsx:243-244 (verbatim)
const trackIdOfLaunch = (lc: LaunchContext | null) => lc?.document?.activeTrackId ?? '';
const studioActiveTrackId = () => trackIdOfLaunch(launchContextRef.current);
```
```typescript
// Source: app/src/lib/previewRenderer.ts:132-146 (verbatim, excerpt)
function resolvePhysicPaintFrameSource(layerId: string, frame: number): PreviewPhysicPaintFrameSource | null {
  if (isPhysicalRotoWorkflowLayer(layerId)) {
    const source = physicPaintStore.getRotoPhysicalRenderSource(layerId, getActiveTrackId(layerId), frame);
    // Phase 43 (D-28): the 'loop-placeholder' variant carries no payload ...
    if (!source || source.kind === 'loop-placeholder' || source.layerId !== layerId || source.appFrame !== frame) return null;
    return { layerId, frame, cacheKey: `physic-paint:${layerId}:physical:${source.cacheRevision}`, renderedFrame: source.renderedFrame };
  }
  const renderedFrame = physicPaintStore.getFrame(layerId, getActiveTrackId(layerId), frame);
  if (!renderedFrame) return null;
  ...
}
```
**Phase 47 insertion point:** the hide/solo truth-table filter goes at the top of `resolvePhysicPaintFrameSource` (return `null` when the active track is hidden or not in the solo set), before either store call. Do not modify the `'loop-placeholder'` branch.

### 3. The store ops that already exist (Phase 46) — the ones the UI must call
```typescript
// Source: app/src/stores/efxPaintStore.ts (export list, lines 47-283, verbatim)
// takePendingTrackDeletions, registerDocument, getDocument, hasDocument, removeDocument,
// getActiveTrackId, setActiveTrackId, requestDeleteTrack, commitDeleteTrack,
// reset, serializeRuntimeIntoDocument, hydrateRuntimeFromDocument
```
```typescript
// Source: app/src/stores/physicPaintStore.ts (track-related exports, verbatim)
export function getTrackPaintVersion(_layerId: string, trackId: string): ReadonlySignal<number> { ... }   // line 71
export function getTrackRotorRevision(_layerId: string, trackId: string): ReadonlySignal<number> { ... }  // line 76
export function bumpTrackRevision(...) { ... }                                                            // line 89
export function mountTrackRuntime(layerId: string, trackId: string): void { ... }                          // line 117
export function removeTrackRuntime(layerId: string, trackId: string): boolean { ... }                      // line 148
export function severTrackHoldReferences(layerId: string, deletedTrackId: string): number { ... }          // line 206
// physicPaintStore object members (lines 2646, 2711, verbatim):
duplicateTrackFrames(layerId: string, trackId: string, frames: readonly number[]): RotoTrackPasteResult
moveTrackItems(layerId: string, fromTrackId: string, toTrackId: string, keys: readonly string[]): RotoTrackPasteResult
```

### 4. The Loop Clip resolver facts (filmstrip capsule source)
```typescript
// Source: app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts:5338-5364 (verbatim excerpt)
// PhysicPaintRotoLoopRange carries: placementStart, effectiveEnd (half-open), cycleLength,
// sourceFrameCount, sourceKeyIds, sourceOffsets, repeat: number | 'infinity',
// requestedEnd, effectiveEnd, boundary, truncated, partialCycle, unresolved
// Per-frame resolution union (5391-5435): 'real' | 'linked' | 'linked-generated'
//   | 'linked-gap' | 'linked-unresolved' | 'empty'
// Single resolver: derivePhysicPaintRotoLoopRanges (5478)
```

### 5. The capsule presentation foundation (badge/tooltip)
```typescript
// Source: app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.ts (240 lines, read this session)
// projectPhysicsPaintLoopPresentation(range, clip, sourceActionName, options) → {
//   cycleLabel: "Cycle {N}f × {R} = {T}f" | "Cycle {N}f × ∞",
//   effectiveLabel: "Effective {E}f", fragmentLabel, linkedDescription,
//   tooltipLines, accessibleName, lifecycle statuses }
```

### 6. The copy contract (verbatim from UI-SPEC §Copywriting Contract, lines 203-218)
```
Primary CTA:                     Add track
Auto-generated names:            Paint 1, Paint 2, Paint 3, ...
Duplicate suffix:                Copy  —  first duplicate `Paint 1 Copy`,
                                 subsequent `Paint 1 Copy 2`, `Paint 1 Copy 3`
Delete confirmation title:       Delete track {name}?
Delete confirm button:           Delete track
Last-track delete refusal:       A document must always have at least one Paint track. (blocked, no dialog — Phase 46 D-17)
Shortened status:                Loop shortened by next clip
Following-clip label:            next clip — interrupts the loop (D-14)
Accessibility:                   aria-label="Duplicate track {name}" / "Delete track {name}" / "Add track"
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single-row Roto strip (`PhysicsPaintWorkflowStrip.tsx`, 161px) | Multi-row NLE timeline (pinned header column + N Paint rows + Bg row, 264px) | Phase 47 (this phase) | One document renders many tracks; active-track routing becomes explicit |
| Loop Clip rail only (purple/cyan, passive markers, white cuts) | Filmstrip capsule around the rail (source-cycle cells, ×N/∞ + requested badge, shortened visual, high-zoom expansion) | Phase 47 | Requested/effective duration visible at a glance; tooltip holds full detail (Pitfall m2) |
| Active track implicit (single strip) | Active track explicit (accent border + tint + bold name, D-04); row click calls `setActiveTrackId` | Phase 47 | TML-03/TML-05: unambiguous active-track selection; all ops route through it |
| Cross-track drag deferred (Phase 46 D-08/D-09) | Plain-drag cross-row move with live insertion preview + paste-rejection UX | Phase 47 | Reuses Phase 46 `moveTrackItems` copy-paste-delete semantics |
| Hide/solo only in spec | Hide/solo truth table applied to Studio preview via `resolvePhysicPaintFrameSource` filter | Phase 47 | TML-04 visible immediately; opacity/blend state stored but applied in Phase 48 |

**Deprecated/outdated:**
- `physicsPaintRotoLoopClips.ts` as a canonical ref: the resolver was reorganized into `physicsPaintRotoPhysicalResolver.ts`. CONTEXT.md's canonical refs still point at the old name — treat the resolver path as `physicsPaintRotoPhysicalResolver.ts`.
- Spec French copy gate (`clip suivant — interrompt la boucle`, `Boucle raccourcie par le clip suivant`, `clip bloquant`): superseded by the user's English-copy correction (D-14). Recorded v0.9 divergence, never shipped.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `setActiveTrackId` bumps `efxPaintVersion` (so the Studio re-reads the active track). The function exists at `efxPaintStore.ts:97`; the bump behavior was not read this session. | Architecture Patterns / Pattern 2 | If it does not bump, the multi-row strip won't react to row clicks until another version bump occurs. Executor should verify the bump in the same task that wires row clicks. |
| A2 | New track-add naming follows the UI-SPEC sequence `Paint 1`, `Paint 2`, ... starting at the next free number, and duplicate suffixes follow ` Paint 1 Copy`, ` Paint 1 Copy 2`. Exact first-free-number and suffix logic is not specified beyond the copy contract. | Code Examples / Copy contract | Wrong auto-name sequence fails UAT; the planner should lock the naming algorithm in the plan. |
| A3 | The Bg row's filmstrip display for Background clips can reuse `derivePhysicPaintRotoLoopRanges` / the Paint Loop Clip presentation without modification. Background `FrameLoopClip` (`startFrame`, `sourceFrameRefs`, `repeat`, `sourceKind`) differs from the Paint Hold resolver inputs; the exact projection was not verified this session. | Pattern 3 / TML-07 | If the Background capsule needs a different resolver call, that is small additional work — planner should keep it as a sub-task, not assume zero. |
| A4 | `getRotoPhysicalRenderSource(layerId, trackId, frame)` and `getFrame(layerId, trackId, frame)` already accept an explicit trackId and the multi-row strip can pass each row's own. Signatures confirmed by usage in `previewRenderer.ts` (they pass `getActiveTrackId(layerId)`); the full signatures were not re-read this session. | Pattern 1 / Pitfall 8 | If either is active-track-only, per-row reads need a small store extension. Low risk — `moveTrackItems`/`duplicateTrackFrames` already take explicit trackIds. |
| A5 | Opacity slider range (0-1 float) and blend options map 1:1 to the document `opacity: number` and `BlendMode` union — the right-panel Track section UI copy/labels are Claude's discretion per CONTEXT. | Pattern 1 / TML-04 | Cosmetic divergence only; the data contract is the `BlendMode` union (verified). |
| A6 | The vertical-scroll ensure-active-row-visible can hook the existing active-track change signal(s) (Phase 46 undo auto-activation included) without new plumbing. The undo auto-activation signal name was not verified this session. | Pattern 2 / D-05 | Minor plumbing if a distinct signal exists; planner should reference Phase 46 D-04's mechanism. |

## Open Questions

1. **Does `setActiveTrackId` bump `efxPaintVersion`?**
   - What we know: the op exists (`efxPaintStore.ts:97`); all other store mutations bump `efxPaintVersion`.
   - What's unclear: the exact bump behavior (not read this session — A1).
   - Recommendation: first Wave-0 task reads the op; if it does not bump, add the bump in the same task that wires row-click selection.

2. **What is the exact undo auto-activation signal for ensure-active-row-visible?**
   - What we know: Phase 46 D-04 auto-activates the target track on undo; D-05 requires the active row to auto-scroll into view on that event.
   - What's unclear: the signal/notification name in the Phase 46 store layer.
   - Recommendation: planner adds a "subscribe to active-track change (incl. undo auto-activation) → scrollIntoView" task and references Phase 46 D-04's mechanism.

3. **Background capsule projection reuse (A3) — confirmed at implementation?**
   - What we know: Phase 47 renders Bg clips when present via the shared capsule (D-11); `BackgroundTrack.clips` are `FrameLoopClip[]`.
   - What's unclear: whether `derivePhysicPaintRotoLoopRanges` accepts the Background clip shape directly.
   - Recommendation: keep Bg-capsule rendering a sub-task with a verification step; the primary Bg deliverable is the row surface + fallback display, which is independent of the capsule reuse question.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| node | build/test toolchain | ✓ | v24.15.0 | — |
| pnpm | package manager (CLAUDE.md: use pnpm, not npm) | ✓ | 10.27.0 | — |
| vitest | tests (run only, never watch) | ✓ | ^2.1.9 (app/package.json:48) | — |
| preact | UI | ✓ | ^10.28.4 (app/package.json:32) | — |
| @preact/signals | reactive state | ✓ | ^2.8.1 (app/package.json:20) | — |
| lucide-preact | icons | ✓ | ^0.577.0 (app/package.json:29) | — |

**Missing dependencies with no fallback:** none. This phase has no external services, CLIs, or runtimes beyond the existing project toolchain. All dependencies verified installed this session (`command -v` + version checks).

## Validation Architecture

> `workflow.nyquist_validation` is `true` in `.planning/config.json` — include this section. Test command: `pnpm --filter efx-motion-editor exec vitest run` (config.json `test_command`).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^2.1.9 |
| Config file | `app/vite.config.*` (project test setup — reuse existing; no one-off configs per CLAUDE.md feedback) |
| Quick run command | `pnpm --filter efx-motion-editor exec vitest run app/src/stores/efxPaintStore.test.ts` (store-op wave) |
| Full suite command | `pnpm --filter efx-motion-editor exec vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TML-02 | Track add/rename/duplicate/reorder store ops mutate `tracks[]`, bump revision, write through serialize/hydrate | unit | `vitest run app/src/stores/efxPaintStore.test.ts` | ✅ existing file — new cases | 
| TML-02 | Duplicate deep-copies frames + Loop Clips with fresh identities | unit | `vitest run app/src/stores/physicPaintStore.test.ts` | ✅ existing file — new cases |
| TML-02 | Delete path reuses `requestDeleteTrack`/`commitDeleteTrack`; last Paint track refused | unit | `vitest run app/src/stores/efxPaintStore.test.ts` | ✅ existing file — new cases |
| TML-04 | Hide/solo/opacity/blend ops set fields + bump revision | unit | `vitest run app/src/stores/efxPaintStore.test.ts` | ✅ existing file — new cases |
| TML-04 | Hide/solo truth table applied in `resolvePhysicPaintFrameSource` (no solo→all; solo→soloed only; hide wins) | unit (previewRenderer) | `vitest run app/src/lib/previewRenderer.test.ts` | ❓ existing renderer tests — verify file |
| TML-06 | Capsule badge shows requested duration; shortened state distinct + "Loop shortened by next clip" | unit | `vitest run app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.test.ts` | ✅ existing — new capsule cases |
| TML-05 | Cross-track drag commits via `moveTrackItems`; rejection publishes paste-rejection UX | integration | `vitest run app/src/stores/physicPaintStore.test.ts` (move semantics) + gesture test | ✅ store test exists; gesture test new |
| TML-01 | Multi-row strip renders N rows + Bg row; vertical scroll; pinned header column | component | `vitest run app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.viewport.test.ts` | ✅ existing — multi-row cases new |
| TML-08 | Reorder survives save/reopen; identity stable | unit | serialize/hydrate round-trip in `efxPaintStore.test.ts` | ✅ existing — new cases |

### Sampling Rate
- **Per task commit:** `pnpm --filter efx-motion-editor exec vitest run <affected test file> -t <case>`
- **Per wave merge:** `pnpm --filter efx-motion-editor exec vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `app/src/stores/efxPaintStore.test.ts` — track CRUD + hide/solo/opacity/blend store-op cases (add/rename/duplicate/reorder/set*), revision bumps, serialize/hydrate round-trip (TML-02/04/08). Existing file covers delete; the new ops need cases.
- [ ] `app/src/lib/previewRenderer.test.ts` (or nearest existing renderer test) — hide/solo truth-table filter cases for `resolvePhysicPaintFrameSource` (TML-04). Verify the exact existing test file name in Wave 0.
- [ ] Multi-row strip component tests — N rows + Bg row render, vertical scroll, pinned header, ensure-active-row-visible (TML-01/03).
- [ ] Cross-track drag gesture test — boundary-crossing → destination row highlight → `moveTrackItems` commit; rejection → status capsule publication (TML-05).

*(If the referenced test files above already exist with relevant coverage, the Wave-0 gap is the missing multi-row/capsule/cross-track cases only.)*

## Security Domain

> `security_enforcement` is not explicitly `false` in config — include this section.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Local desktop canvas editor; no auth |
| V3 Session Management | no | No sessions |
| V4 Access Control | no | Single-user local app |
| V5 Input Validation | yes | Track-name rename input: trim + length cap + reject empty / control chars; guard against names colliding with UI-SPEC reserved behavior. Rely on the existing `isPhysicsPaintShortcutTarget` guard (returns false for input/textarea/select/contenteditable) so typing a rename never triggers track CRUD shortcuts |
| V6 Cryptography | no | No secrets handled in this phase |

### Known Threat Patterns for {stack}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Shortcut conflict during inline rename (typed keys firing track CRUD shortcuts) | Tampering (unintended state mutation) | Route track CRUD shortcuts through the existing `dispatchPhysicsPaintStudioKeyDown` guard that bails on input/textarea/select/contenteditable (`physicsPaintStudioKeyboard.ts`), plus the `isPaintEditMode()` shortcut-guard pattern (Pitfall m4) |
| Drag gesture mutating the wrong row (header-drag vs content-drag ambiguity) | Tampering (unintended state mutation) | Distinct grab areas + cursors (D-18); cross-track move only commits on release with a validated destination and publishes rejections fail-closed to the status capsule |
| XSS via track name / tooltip text | Injection | Preact escapes text by default; never set track-name tooltips via `dangerouslySetInnerHTML`; render names as text nodes |

## Sources

### Primary (HIGH confidence)
- [VERIFIED: in-repo] `app/src/efx-paint/document/efxPaintDocument.ts` — `InternalPaintTrack` (47-59), `BackgroundTrack` (62-68), `EfxPaintDocument` (71-80), `BlendMode` (17), `BackgroundFallback` (20-22), `createDefaultPaintTrack` default name `'Track 1'` (85). Read this session.
- [VERIFIED: in-repo] `app/src/stores/efxPaintStore.ts` — export list (26-283): `setActiveTrackId`, `requestDeleteTrack`/`commitDeleteTrack`, `serializeRuntimeIntoDocument`, `hydrateRuntimeFromDocument`, `reset`. Confirmed NO add/rename/duplicate/reorder/set* track ops.
- [VERIFIED: in-repo] `app/src/stores/physicPaintStore.ts` — `getTrackPaintVersion` (71), `getTrackRotorRevision` (76), `bumpTrackRevision` (89), `mountTrackRuntime` (117), `removeTrackRuntime` (148), `severTrackHoldReferences` (206), `duplicateTrackFrames` (2646), `moveTrackItems` (2711). Confirmed NO setTrackVisible/Solo/Opacity/Blend ops anywhere in `app/src` (grep, this session).
- [VERIFIED: in-repo] `app/src/lib/previewRenderer.ts` — `resolvePhysicPaintFrameSource` (132-154) uses `getActiveTrackId(layerId)` at lines 134/146; `'loop-placeholder'` branch (135-138). Hide/solo filter insertion point.
- [VERIFIED: in-repo] `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — `trackIdOfLaunch`/`studioActiveTrackId` (243-244). Active-track routing authority.
- [VERIFIED: in-repo] `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts` — `PhysicPaintRotoLoopRange` (5338-5364), resolution union (5391-5435), `derivePhysicPaintRotoLoopRanges` (5478). Single Loop Clip resolver.
- [VERIFIED: in-repo] `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` — `ROTO_CELL_WIDTH_PX = 18` (341), `rotoLaneWidthPx` (1067), drag coordinate mapping (1446).
- [VERIFIED: in-repo] `app/src/components/physic-paint/physicsPaintStudio.css` — `.physics-paint-studio` grid rows `minmax(58px, auto) minmax(0, 1fr) 161px` (412); `.physics-paint-workflow-strip` height 161px (1964-1972).
- [VERIFIED: in-repo] `app/package.json` — preact ^10.28.4 (32), @preact/signals ^2.8.1 (20), lucide-preact ^0.577.0 (29), vitest ^2.1.9 (48). Read this session.
- [VERIFIED: in-repo] `.planning/phases/47-.../47-CONTEXT.md` — D-01..D-18, Claude's Discretion, Deferred Ideas (read this session; quoted verbatim above).
- [VERIFIED: in-repo] `.planning/phases/47-.../47-UI-SPEC.md` — copy contract (203-218), geometry (68-76, 127-133), hide/solo placement (269), edge-state coverage (341-350). Read this session.

### Secondary (MEDIUM confidence)
- [CITED] `SPECS/milestone-v1.0.0-plan.md` — §Phase 3, truth tables, Timeline visualization (referenced via CONTEXT.md canonical refs; the French copy gate is superseded by the user's English correction).
- [CITED] `.planning/research/PITFALLS.md`, `ARCHITECTURE.md`, `SUMMARY.md` — milestone research (Pitfall 1/4/12/M2/M3/M8/m1-m4, Pattern 2 track-local addressing).
- [CITED] `.planning/REQUIREMENTS.md` — TML-01..TML-08 (lines 32-39) and traceability (145-152).

### Tertiary (LOW confidence)
- None — all claims verified in-repo this session or cited from the phase's own locked documents.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies; every library verified in `app/package.json` this session.
- Architecture: HIGH — store-op gap, active-track routing, resolver path, and capsule extension points all verified against source files read this session.
- Pitfalls: HIGH — each pitfall grounded in a verified code fact (export lists, line numbers, verbatim copy strings).
- Assumptions (A1-A6): flagged in the Assumptions Log; none are load-bearing architectural decisions, but A1 and A2 should be locked by the planner.

**Research date:** 2026-08-24
**Valid until:** 2026-09-23 (30 days — stable, self-contained refactor phase with zero new external dependencies)
