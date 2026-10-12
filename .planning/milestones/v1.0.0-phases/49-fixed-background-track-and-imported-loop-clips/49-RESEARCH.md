# Phase 49: Fixed Background Track and Imported Loop Clips - Research

**Researched:** 2026-08-31
**Domain:** In-repo EFX Physic Paint Studio authoring surface (no new external dependencies)
**Confidence:** HIGH

## Summary

Phase 49 is almost entirely an **in-repo composition phase**: every foundational mechanism is already built and verified. The document model carries `BackgroundTrack { clips, fallback, visible, revision }` and `FrameLoopClip { id, startFrame, sourceFrameRefs, repeat, sourceKind, revision }` (Phase 45), the compositor fully resolves Background clips through the shared Loop Clip resolver (modulo, finite/infinite repeat, gaps, next-clip interruption — Phase 48), the flattened cache key already covers background clip revisions (Phase 48), the Bg row renders as the fixed muted skeleton (Phase 47), and the rail-drag machinery, undo ledger, status-capsule rejection surface, and repeat-input pattern all exist. What Phase 49 adds is the authoring surface on top: the scoped asset picker, clip CRUD store ops, rail drag on the Bg row, right-panel clip properties, the fond-selector-to-document-fallback re-wiring, and undo/persistence coverage.

The single most important architectural finding: **the fond (paper/white background) is currently derived from per-track roto background metadata — NOT from `document.background.fallback`.** Two derivation sites (`physicPaintStore._resolveDocumentFondInstruction` and the Studio monitor's `fondBackground`, quoted below) walk tracks by order and read `_rotoBackgroundMetadata`. D-11 (fond selector = fallback config) therefore requires (a) extending the `BackgroundFallback` union + parser + canonical encoder, and (b) re-wiring BOTH fond derivation sites to consume the document fallback. The parser and revision encoder are fail-closed on exact-member basis, so the union extension touches three modules in lockstep (`efxPaintDocument.ts`, `efxPaintDocumentParsers.ts`, `efxPaintDocumentRevision.ts`).

The second structural finding: **the Studio is a separate Tauri window with its own JS realm** — its `imageStore` instance starts empty, its capability file grants no `dialog:allow-open` and no `fs:*` permissions, and there is no IPC command to enumerate project images (only `import_images` / `image_get_info` are registered). D-01's "picker refreshes the library on open" and "import new images inside the picker" therefore require a cross-window delivery seam (the established bridge request/result event-pair idiom) and a capability-file extension — both are planner-visible, checkpoint-worthy steps.

**Primary recommendation:** Structure the phase as four plans in dependency order: (1) document model extension (fallback union + parser + encoder) with round-trip tests; (2) clip CRUD store ops + undo recording + natural-sort util (pure/testable); (3) fond re-wire (store instruction + monitor fond + checkerboard) and fallback-config UI; (4) asset picker + import/drag/rail UI + right-panel properties, with the cross-window library seam and the capability extension gated behind a human-verify checkpoint.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Import UX (BKG-02)**
- **D-01:** The Import control on the Bg row opens the **project asset module** — NOT a bare macOS dialog. Clicking Import swaps the Studio canvas region to a **scoped asset-picker variant** (images-only, multi-select, Confirm/Cancel) — the same full-area pattern as the main editor's `ImportedView`, not a floating dialog. Inside it, the user imports new images into the project library OR selects already-imported ones; the chosen images land as clips on the Background row. **Reuse boundary:** build the compact variant from `imageStore` + `ImportGrid` (lean: signals + `importImages`/`assetUrl` IPC). Do **NOT** port `ImportedView` itself into the Studio window — it is coupled to sequence/layer/audio intents from the main editor. **Locks:** the engine stays mounted underneath (paused) and the composite refreshes on return — no canvas recreation. Confirm drops the clip at the current playhead frame (D-03). Cancel returns untouched. The picker refreshes the library on open; no live cross-window sync required in this phase.
- **D-02:** Sequence ordering is **natural filename sort, hard lock**: sort by the ORIGINAL FILENAME (natural/numeric-aware: `shot_1 < shot_2 < shot_10`), **never by the asset UUID**. Asset IDs are random UUID v4 (`image_pool.rs`), so the existing main-editor image-sequence flow's `selectedIds.sort()` produces an effectively arbitrary order today — Phase 49 must **not** copy that pattern.

**Clip placement & edits (BKG-03, BKG-04, BKG-05)**
- **D-03:** **Placement = at the playhead, confirmed.** Confirm drops the clip at the current playhead frame. Rejection (capsule warning) applies ONLY when the playhead sits **strictly inside** an existing clip. A clip longer than the gap that overlaps the NEXT clip downstream is NOT a rejection — the existing interruption law applies.
- **D-04:** **Collision = fail-closed on START collision only, interruption law for downstream extent.** Any import or drag whose landing frame sits strictly inside an existing clip is rejected with the status-capsule red warning. A clip LONGER than the gap is NOT rejected: visual cut at the next clip's start, data preserved. **Same rule for import and drag — no asymmetric snap behavior.**
- **D-05:** **Start-frame editing = drag the rail.** Reuse the Phase 43 rail drag machinery (live preview, release-time commit, collisions reject on start collision per D-04).
- **D-06:** **Repeat input = numeric field + ∞ toggle.** Reuse the PlayScript dialog pattern ("Enter a positive integer") plus an explicit ∞ toggle/checkbox. The badge shows `×N` or `×∞`.
- **D-07:** **Per-clip controls live in the right panel.** Clicking a Bg clip rail selects it; the right-panel section shows its properties (start frame, repeat, source cycle, delete).
- **D-08:** **Deleting a Background clip is a plain undoable delete** — one Undo restores it, no acknowledge dialog.

**Source persistence (BKG-07, BKG-09, CMP-05)**
- **D-09:** **Source model = library asset IDs.** Imported images live in the project library (`imageStore` / `image_pool.rs`); a clip's `sourceFrameRefs` reference library asset IDs, **never external file paths**. Repeats reference the same asset (no durable duplication). Selecting already-imported images reuses existing assets without copying.
- **D-10:** **Missing source = fail-closed only.** A missing library asset renders transparent + the status-capsule red warning (Phase 48 D-09). Re-import/re-link is deferred.
- **D-11:** **Fond selector = fallback, photo mode excluded.** The existing fond selector (transparent / white / canvas1-3 + grain) becomes the Background fallback config, and the document fallback union is extended to carry those modes. The `'photo'` fond mode is NOT part of this mapping — it is reserved for Phase 50 `photoReference`. In Phase 49 the selector drops `'photo'` (acceptable under the clean-break contract).
- **D-12:** **Gap display = row swatch + monitor fond, with one scoped addition.** The Bg row shows the transparent checkerboard or the solid fallback swatch in gaps (Phase 47 D-06); the Studio program monitor draws the fond beneath the composite (Phase 48 UAT-C). **Addition:** when the effective fond is TRANSPARENT, the monitor draws a **transparency checkerboard** instead of the black backdrop. **Monitor-only, never part of the flattened raster or export.**

### Claude's Discretion
- Exact store/function shape for the asset-picker variant (reuse `imageStore` + `ImportGrid`), the Background clip CRUD store ops, and the rail-drag integration for Bg clips.
- Exact document fallback union extension shape (fond modes) and how the compositor's fond draw consumes it.
- Exact right-panel clip-properties section layout and copy (English).
- The ∞ toggle affordance details in the repeat input.
- Whether the Bg row's own `visible` toggle is surfaced in Phase 49.

### Deferred Ideas (OUT OF SCOPE)
- Review/reorder step after import (thumbnail strip drag-reorder) — add later if real usage asks.
- `photoReference` track — **Phase 50** (REF); the `'photo'` fond mode is reserved for it (D-11).
- Re-import/re-link of a missing Background clip — later phase (fail-closed only in Phase 49, D-10).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BKG-01 | Exactly one fixed Background track per document beneath all Paint tracks | Already modeled: `BackgroundTrack` in `efxPaintDocument.ts:61-68`, factory at `:104-122`; Bg row rendered fixed at `PhysicsPaintWorkflowStrip.tsx:3734-3742` with `kind="background"` (locked header, no reorder grab — `PhysicsPaintTrackRow.tsx:457,547-564`). Phase 49 adds only the Import control on that row header. |
| BKG-02 | Import one still or ordered image sequence as a Background clip | `imageStore` (`images` signal, `importFiles`, `getDisplayUrl`) + `ImportGrid` (`multiSelect`/`selectedIds`/`onToggleSelect`/`assetFilter='images-only'` props, verified `ImportGrid.tsx:14-29`). Ordering: natural filename sort via a new util (none exists today — verified by grep); UUID-order anti-pattern confirmed at `image_pool.rs:57` (`uuid::Uuid::new_v4()`). |
| BKG-03 | Sequential, non-overlapping clips; reject collisions | Fail-closed START-collision law (D-04). Resolver already derives non-overlapping ranges (`findOwningRange`, `efxPaintBackgroundResolution.ts:195-215`); collision check = landing frame strictly inside any `[startFrame, resolvedExtent)` of existing clips. |
| BKG-04 | Start frame + finite repeat (1..∞) per clip | `FrameLoopClipRepeat = { mode:'finite'; count } \| { mode:'infinite' }` (`efxPaintDocument.ts:25-27`); parser enforces finite count validation (`efxPaintDocumentParsers.ts:118-133`). Repeat input pattern at `PhysicsPaintPlayScriptDialog.tsx:341,370` (`Enter a positive integer.`). |
| BKG-05 | Loop resolution: cycleLength × repeatCount, bounded by next clip / parent end | Done in Phase 48: `mapFrameLoopClipToResolverClip` maps `FrameLoopClip` → `PhysicPaintRotoLoopClip` (`efxPaintBackgroundResolution.ts:76-84`); the resolver is the single effective-duration authority (ranges carry `cycleLength`, `requestedEnd`, `effectiveEnd`, `truncated`, `partialCycle` — `physicsPaintRotoPhysicalResolver.ts:5338-5358`). |
| BKG-06 | Gaps reveal document fallback (solid or transparency) | Compositor done: `resolveEfxPaintBackgroundFrame` returns `'gap'` → fallback draw (`efxPaintBackgroundResolution.ts:140,157`); UI: fond selector becomes the fallback config (D-11) + monitor checkerboard (D-12). |
| BKG-07 | Linked source refs across repeats; no durable duplication | Model-level: `sourceFrameRefs: readonly string[]` referenced once per clip; resolver repeats map back to the same refs (no per-repeat records). Runtime registry `_backgroundSourceImages` keyed by sourceRef (`physicPaintStore.ts:428-433`). |
| BKG-08 | Undo/redo clip creation/move/repeat/import/deletion/fallback by reference | Unified document-wide 10-level ledger lives in `useRotoPhysicalEditHistory.ts` (by-reference snapshots, raster maps emptied at record per Phase 46 D-03); clip CRUD ops record accepted edits there (planner discretion on the exact kind strings). |
| BKG-09 | Clips, order, IDs, repeats, gaps, fallback survive save/reopen | Documents ride `.mce` as `efx_paint_documents: HashMap<String, Value>` (`project.rs:39-42`); clips+fallback serialize with the document (canonical encoder already has `clips:` + `fallback:` terms, `efxPaintDocumentRevision.ts:92-107`). Library assets ride `MceProject.images` (`project.rs:25`, `MceImageRef` at `types/project.ts:190-198`). Gap: runtime source-byte registry hydration (see Open Questions). |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Image ingestion (copy, thumbnail, UUID allocation) | Rust backend (`image_pool.rs`) | — | File processing is native-only; `import_images` command already exists |
| Project library state (image metadata signals) | Main-editor webview (`imageStore`) | Studio webview (mirror, refreshed on open) | The Studio is a separate JS realm; its `imageStore` instance starts empty |
| Cross-window asset delivery to the Studio picker | Main webview (bridge publisher) | Studio webview (bridge consumer) | Established request/result event-pair idiom in `physicPaintBridge.ts` |
| Clip CRUD + repeat/fallback mutations | Studio webview store (`efxPaintStore` document ops) | — | Pure document ops + revision bump + single dirty callback, mirroring `addTrack`/`renameTrack` |
| Loop resolution (modulo/repeat/gaps/interruption) | Pure resolver module | — | Done (Phase 48); never re-implemented (Pitfall 10) |
| Fond draw beneath composite | Store (`_resolveDocumentFondInstruction`) + monitor | — | Currently track-metadata-derived; D-11 re-wires to document fallback |
| Persistence of clips/fallback | `.mce` document map + `MceProject.images` | — | Done by Phase 45 seams; only the runtime byte registry needs hydration |
| Undo ledger | `useRotoPhysicalEditHistory` hook | — | Unified 10-level ledger, by reference (Phase 46 D-01..D-03) |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| (none new) | — | — | This phase installs **zero** external packages (49-UI-SPEC §Registry Safety: "No new UI dependencies are introduced") |

All reuse is in-repo: `imageStore` + `ImportGrid` (asset picker), Phase 43/47 rail machinery (drag), `PhysicsPaintPlayScriptDialog` (repeat input), unified undo ledger, compositor + resolver (resolution), `lucide-preact ^0.577.0` (icons), `@preact/signals ^2.8.1`, `@tauri-apps/plugin-dialog ^2.6.0` (already a dependency — main window uses `open()` at `ImportedView.tsx:420-424`). [VERIFIED: app/package.json:20-29]

**Natural filename sort (D-02):** no natural-sort utility exists in the codebase today (verified by grep for `naturalSort`, `Intl.Collator`, `numeric: true` — zero hits). Introduce a tiny pure util using `Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })` — platform built-in, no dependency. [ASSUMED — ECMA-402 built-in, universally supported in WKWebView; the absence of an in-repo util is VERIFIED by grep]

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| — | — | — | — | — | — | No external packages installed in this phase |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
Studio window (efx-physic-paint webview)
  Bg row [Import images] ──click──▶ canvas-region swap
                                      ▼
                              Scoped asset picker (imageStore + ImportGrid variant)
                              ├─ library view  ◀── bridge request/result ──▶ Main webview imageStore (authoritative)
                              ├─ [Import] → tauri dialog open() → import_images (Rust image_pool) → library += assets
                              └─ [Confirm] ──▶ natural filename sort (D-02) ──▶ clip CRUD op
                                                                                    ▼
                                          efxPaintStore document mutation
                                          (start collision → REJECT → status capsule; else commit)
                                                    ▼                     ▼
                                          undo ledger record      document revision bump
                                          (by reference)          (single dirty callback)
                                                                                    ▼
                                          compositor: deriveEfxPaintBackgroundResolution (WeakMap memo per record identity)
                                          → resolveEfxPaintBackgroundFrame per frame → content | gap | missing
                                                    ▼
                                          fond draw beneath composite (document fallback per D-11 re-wire)
                                          program monitor: fond + (transparent case → checkerboard, monitor-only)
                                                                                    ▼
                                          save: serializeRuntimeIntoDocument → .mce efx_paint_documents + MceProject.images
```

### Pattern 1: Pure document store mutation (established, reuse verbatim)
**What:** Every document mutation is a pure function on the frozen document: read → validate → build candidate → idempotence compare via canonical revision → single revision bump → `_notifyChange()` exactly once.
**When to use:** All clip CRUD ops, repeat/fallback setters, deletion.
**Example** (the established `addTrack`/`renameTrack` shape — `efxPaintStore.ts:169-222`):
```typescript
// Source: app/src/stores/efxPaintStore.ts:217-220 (renameTrack idempotence guard)
if (buildEfxPaintDocumentRevision(candidate) === buildEfxPaintDocumentRevision(document)) return { ok: true, trackId };
const next: EfxPaintDocument = { ...candidate, documentRevision: document.documentRevision + 1 };
_documents.set(layerId, next);
_notifyChange();
return { ok: true, trackId };
```
[VERIFIED: app/src/stores/efxPaintStore.ts:169-222 — read this session]

### Pattern 2: Clip → resolver mapping (already implemented — consume, never re-derive)
**What:** `mapFrameLoopClipToResolverClip` maps the document record into the resolver's authoritative contract; resolution context is memoized per background record identity (WeakMap).
**Example:**
```typescript
// Source: app/src/efx-paint/compositor/efxPaintBackgroundResolution.ts:76-84 (verbatim)
function mapFrameLoopClipToResolverClip(clip: FrameLoopClip): PhysicPaintRotoLoopClip {
  return {
    loopId: clip.id,
    placementStart: clip.startFrame,
    sourceKeyIds: [...clip.sourceFrameRefs],
    repeat: clip.repeat.mode === 'infinite' ? 'infinity' : clip.repeat.count,
    mode: 'progressive',
  };
}
```
[VERIFIED: app/src/efx-paint/compositor/efxPaintBackgroundResolution.ts:76-84 — read this session]

### Pattern 3: Cross-window request/result transport (established idiom)
**What:** The Studio asks the main window for data via a bridge event pair: `*-request` with an `operationId`, answered by a matching `*-result` event. Existing pairs: `physic-paint:script-library-request/result`, `physic-paint:roto-authority-request/result`, `physic-paint:thumbnail-encode-request/result` (`physicPaintBridge.ts:85-94`).
**When to use:** Fetching the project image library into the Studio's scoped picker (D-01 "refreshes the library on open"), and delivering the project dir needed by `importImages(paths, projectDir)` — the launch context does NOT carry it today (`PhysicPaintProjectContext` = `{ name, saved, contextId, scriptLibraryAuthority? }` only, `types/physicPaint.ts:1670-1676`). [VERIFIED: app/src/lib/physicPaintBridge.ts:85-94 and app/src/types/physicPaint.ts:1670-1676]

### Pattern 4: Fail-closed rejection publication
**What:** Rejections surface through the existing status capsule red warning triangle via `setApplyStatus('error')` (forwarded at `PhysicsPaintWorkflowStrip.tsx:2056`); nothing is written on rejection; prior geometry/selection/focus preserved.
**When to use:** Start-collision rejections (import + drag), missing-source reports, invalid repeat input. [VERIFIED: app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx:2056]

### Anti-Patterns to Avoid
- **Porting `ImportedView` into the Studio (D-01 violation):** `ImportedView.tsx` is coupled to sequence/layer/audio intents, `projectStore.dirPath`, `copyFile`, and intent routing (`ImportedView.tsx:415-435`). Build the compact variant from `imageStore` + `ImportGrid` only.
- **`selectedIds.sort()` ordering (D-02 violation):** asset IDs are UUID v4 (`pub fn process_image` ... `let id = uuid::Uuid::new_v4().to_string();` — `app/src-tauri/src/services/image_pool.rs:57`). The main-editor image-sequence flow's plain sort is effectively arbitrary. Sort by original filename basename (`ImportedImage.original_path`'s last segment — `imageStore.ts:199` uses exactly this for `original_filename`). [VERIFIED: image_pool.rs:57]
- **Re-implementing loop math in the UI (Pitfall 10/m2):** badge/shortened facts come from resolver-derived facts (`range.truncated`, `range.partialCycle`), never recomputed (47 P04 capsule-never-math contract, carried).
- **Re-creating the engine canvas on picker open/close (D-01 lock):** engine stays mounted (paused); swap is paint/visibility only.
- **Optimistic UI facts:** badge, rail width, repeat, fallback update from accepted state only (47-UI-SPEC busy/rejected contract, carried).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Loop effective duration / interruption / gaps | Any clip-extent math in the strip or store | `deriveEfxPaintBackgroundResolution` + `resolveEfxPaintBackgroundFrame` | Single authority; memoized per record identity; fail-closed on malformed clips |
| UUID-stable sort | Home-grown comparator bugs | `Intl.Collator(undefined, {numeric: true})` util over original filename | D-02 hard lock; built-in handles `shot_1 < shot_2 < shot_10` |
| Undo snapshots with raster bytes | Raster-byte history records | Unified by-reference ledger (`useRotoPhysicalEditHistory`) | 10-level ledger, snapshots strip rasters at record (Phase 46 D-03) |
| Rejection UI | A new toast/modal system | Status capsule + `setApplyStatus('error')` + fixed English copy map | Established paste-rejection UX (Phase 46), locked copy in 49-UI-SPEC |
| Asset picker | Porting `ImportedView` | `imageStore` + `ImportGrid` scoped variant | D-01 explicit reuse boundary |

**Key insight:** the compositor and resolver are finished, verified, and carry strong purity/memo contracts. Every temptation to "just compute the clip extent in the UI" or "just sort the IDs" re-derives an authority that exists elsewhere and breaks a locked invariant.

## Common Pitfalls

### Pitfall 1: Fond authority mismatch (D-11 re-wire is two sites, not one)
**What goes wrong:** Extending `BackgroundFallback` and updating the selector UI, then finding the flattened output and monitor still show the OLD fond — because the fond draw reads per-track metadata.
**Why it happens:** The fond instruction is derived from the **lowest-order track's non-transparent paper metadata**, not the document fallback:
```typescript
// Source: app/src/stores/physicPaintStore.ts:845-852 (verbatim — read this session)
const orderedTracks = [...efxDocument.tracks].sort((left, right) => left.order - right.order);
for (const track of orderedTracks) {
  const metadata = _rotoBackgroundMetadata.get(layerId)?.get(track.id);
  if (!metadata || metadata.background === 'transparent') continue;
  const instruction = resolveMissingRotoFrameDraw(layerId, 0, { backgroundState: { mode: 'paper', metadata } });
  if (instruction.kind === 'background-only') return instruction;
}
```
The Studio monitor duplicates this derivation inline (`PhysicsPaintStudio.tsx:3073-3083`, `fondBackground` in the canvas-stack memo). [VERIFIED: both files read this session]
**How to avoid:** One plan step owns the re-wire of BOTH sites to consume `document.background.fallback`; the flattened-cache key must gain a fallback term (today the key has `bg:${background.revision}` — `efxPaintCompositeCache.ts:125` — but NO fond/fallback-content term; a fallback-mode change with unchanged revision would serve a stale fond). The idempotence-guard lesson from `setRotoBackgroundMetadata` (`physicPaintStore.ts:1552-1569`: a no-op metadata write must not bump the revision — the opposite, a 65/s render loop, is the documented OOM incident) applies to the new fallback setter. [VERIFIED: physicPaintStore.ts:1552-1569]
**Warning signs:** selector changes swatch but flattened raster doesn't change; monitor fond and row gap swatches disagree.

### Pitfall 2: Studio window realm isolation (asset picker reads an empty store)
**What goes wrong:** The scoped picker opens and shows "Drag & drop images here or use Import button" even though the project has 100 imported images.
**Why it happens:** The Studio is a separate Tauri window (`PhysicsPaintStudio.tsx:1622-1627` closes via `getCurrentWindow()`); every module — including `imageStore`'s `images` signal — is a separate JS instance, empty at Studio boot.
**How to avoid:** D-01 already anticipates this ("refreshes the library on open; no live cross-window sync"). Plan a delivery seam: a bridge request/result pair (Pattern 3) returning `MceImageRef`-shaped metadata (and the project dir for `importFiles(paths, projectDir)` — the IPC requires `projectDir`, `imageStore.ts:65`; the launch context does not carry it). Alternative: a new Rust enumeration command — but no image-listing command exists today (registered command list: `image::image_get_info`, `image::import_images` only — `lib.rs:810-811`). [VERIFIED: lib.rs:786-816 handler list]
**Warning signs:** picker empty on open; `importFiles` failing with a missing/undefined projectDir.

### Pitfall 3: Studio capability file lacks dialog/fs permissions
**What goes wrong:** The picker's in-picker `Import` button silently does nothing — `open()` from `@tauri-apps/plugin-dialog` is denied.
**Why it happens:** `app/src-tauri/capabilities/physics-paint.json` (windows: `["efx-physic-paint"]`) grants only `core:*`, `store:default`, `notification:*` — NO `dialog:allow-open`, NO `fs:*`. The main window's `default.json` carries `dialog:allow-open`, `fs:allow-read-file`, etc. (lines 15-28). Precedent: 45-02 hit the identical class of failure (capability fs scope not covering `cache/efx-paint`, fixed at 10da700a).
**How to avoid:** Add `dialog:allow-open` (and any fs permission actually required by the chosen byte path) to `physics-paint.json` as an explicit, checkpointed plan step. The custom `efxasset://` protocol is app-wide with CSP including `img-src ... efxasset:` (`tauri.conf.json:38`), so displaying library images in the picker via `assetUrl()` needs no fs permission. [VERIFIED: both capability files + tauri.conf.json read this session]
**Warning signs:** dialog never opens; console shows a capability denial.

### Pitfall 4: ImportGrid's hidden main-editor coupling
**What goes wrong:** The scoped variant drags in usage-scan dependencies or crashes in the Studio realm where `sequenceStore`/`audioStore` are empty.
**Why it happens:** `ImportGrid.tsx:6-12` imports `sequenceStore`, `audioStore`, `getAllAssetUsages`, `cascadeRemoveAsset`, `cascadeDeleteFile`, `UsageBadge`, `UsagePopover`; it also uses `useState` internally (ctx menu/popover) — acceptable in the main editor, but the Studio obeys the strict efx-preact-reactivity rules (no `useState` new code; see Project Constraints).
**How to avoid (Claude's discretion):** build the variant either by (a) extracting a lean grid core (tile + multi-select + `onToggleSelect` + `assetFilter='images-only'`) with the context-menu/usage-badge affordances OFF in the Studio variant, or (b) wrapping `ImportGrid` with a Studio-safe adapter that never triggers popover paths. Do NOT surface "usage"/delete affordances in the picker. [VERIFIED: ImportGrid.tsx:1-29 read this session]
**Warning signs:** Studio renders "unused" badges on every tile; cascade-delete affordances visible in the picker.

### Pitfall 5: Runtime source-byte registry hydration on open (BKG-09 gap)
**What goes wrong:** Save a project with Background clips, reopen, and every clip reports `Source missing` in the flattened output.
**Why it happens:** `_backgroundSourceImages` is a runtime-only module map; `registerBackgroundSourceImage(sourceRef, dataUrl)` has exactly one definition and NO production caller today — the doc comment says "Phase 49's import UI is the production writer" (`physicPaintStore.ts:422-433`). Hydration on project open must register bytes for every asset referenced by any clip's `sourceFrameRefs`, or the resolver's `knownSources` check (`physicPaintStore.ts:1420-1430`) fails closed to `missing` → transparent + capsule.
**How to avoid:** Plan a hydration step on document register/hydrate: for each `background.clips[].sourceFrameRefs`, load the asset bytes (via `efxasset://` URL → image decode, the `_compositorDecode` idiom) and call `registerBackgroundSourceImage`. Note `registerBackgroundSourceImage` clears the flattened memo on new bytes (T-48-07) — batch registration is still safe (memo cleared repeatedly during hydration is harmless). [VERIFIED: physicPaintStore.ts:422-433, 1420-1430]
**Warning signs:** reopen → `Source missing` on every clip; flattened memo churn during open.

### Pitfall 6: Fallback union extension must touch three modules in lockstep
**What goes wrong:** Typecheck passes but save/reopen throws, or revisions change spuriously.
**Why it happens:** `BackgroundFallback` today is exactly `{ mode:'transparent' } | { mode:'solid'; color: string }` (`efxPaintDocument.ts:20-22`); the parser is exact-member fail-closed ("fallback.mode must be transparent or solid.", `efxPaintDocumentParsers.ts:207-227`); the canonical encoder switches on the same union (`efxPaintDocumentRevision.ts:30-33`: `'transparent;'` / `solid:<color>`).
**How to avoid:** One atomic plan step extends type + parser + encoder together, with a round-trip test for every new mode. Current verbatim unions the planner must extend:
```typescript
// Source: app/src/efx-paint/document/efxPaintDocument.ts:20-22 (verbatim)
export type BackgroundFallback =
  | { readonly mode: 'transparent' }
  | { readonly mode: 'solid'; readonly color: string };
```
Fond modes to carry (selector options, `PhysicsPaintTopBar.tsx:26-32`): `Transparent`, `White`, `Paper 1` (`canvas1`), `Paper 2` (`canvas2`), `Paper 3` (`canvas3`) — plus grain (`paperGrain`, `grainStrength`). The engine union is `'transparent' | 'white' | 'canvas1' | 'canvas2' | 'canvas3' | 'photo'` (`packages/efx-physic-paint/src/types.ts:92`); the roto metadata union drops `'photo'` (`types/physicPaint.ts:1629-1636`: `PhysicPaintRotoBackgroundMetadata { background, paperGrain, grainStrength, color? }`). The top-bar dropdown already contains no Photo option (`BACKGROUND_OPTIONS` lines 26-32 list exactly 5 entries) — D-11's "drop photo" is already the current picker surface; the change is persisting selection as the fallback. [VERIFIED: all four files read this session]

### Pitfall 7: Infinite repeats bound by visible window (DoS guard carried)
**What goes wrong:** An `× ∞` clip on a long timeline explodes rail/cell rendering.
**Why it happens / avoid:** Phase 47 T-47-04-03 already locks: infinite repeats are bounded by the visible frame window; fully-outside clips render nothing. Reuse that guard verbatim for Bg clip rails (49-UI-SPEC S3 caries it forward).

## Code Examples

Verified patterns from the codebase (all read this session):

### ImportGrid consumption contract (D-01 variant props)
```tsx
// Source: app/src/components/import/ImportGrid.tsx:14-29 (verbatim interface)
interface ImportGridProps {
  onSelect?: (imageId: string) => void;
  multiSelect?: boolean;
  selectedIds?: string[];
  onToggleSelect?: (imageId: string) => void;
  assetFilter?: 'all' | 'images-only' | 'videos-only' | 'audio-only';
  onVideoSelect?: (videoId: string) => void;
  onAudioSelect?: (audioAssetId: string) => void;
}
```

### Natural filename sort (new util — shape recommendation)
```typescript
// [ASSUMED — ECMA-402 built-in; no in-repo precedent exists (grep-verified absence)]
const naturalFilenameCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
export function sortImagesByOriginalFilename(images: readonly ImportedImage[]): ImportedImage[] {
  return [...images].sort((a, b) =>
    naturalFilenameCollator.compare(
      a.original_path.split('/').pop() ?? a.original_path,
      b.original_path.split('/').pop() ?? b.original_path,
    ));
}
```
(`imageStore.toMceImages` already derives `original_filename` exactly this way — `imageStore.ts:199`)

### Repeat input pattern (D-06)
The PlayScript dialog's validated numeric-input idiom with the hint span `Enter a positive integer.` — `PhysicsPaintPlayScriptDialog.tsx:341` (numeric field) and `:370` (repeat field). Reuse the commit-on-blur/Enter + invalid-input-keeps-prior-value behavior.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Fond from per-track paper metadata (lowest-order track) | Document fallback as the single fond authority | Phase 49 (this phase, D-11) | One surface; flattened output faithful; Phase 50 photoReference slot stays reserved |
| Black backdrop in monitor when no fond | Transparency checkerboard (After Effects convention) | Phase 49 (D-12) | Monitor-only paint; never exported |

**Deprecated/outdated:**
- The `photo`-mode fond selector path: already absent from `BACKGROUND_OPTIONS`; `buildRotoBackgroundMetadata` maps `'photo'` → `'transparent'` (`physicsPaintStudioSettings.ts:42`) — Phase 49 should remove reliance on that branch for the fallback surface (photo is Phase 50). [VERIFIED: physicsPaintStudioSettings.ts:41-49]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `Intl.Collator(undefined, { numeric: true })` is available and numeric-correct in the Tauri WKWebView | Standard Stack / Code Examples | Negligible — it is an ECMA-402 built-in; worst case is a tiny hand comparator |
| A2 | Custom (non-plugin) Tauri commands remain invocable from the `efx-physic-paint` window without capability grants (only plugin APIs are capability-gated) — `import_images` callable from the Studio once `projectDir` is available | Pitfall 3 | If wrong, a capability/IPC grant addition is needed; same checkpoint covers it |
| A3 | `efxasset://` custom protocol responses are reachable from the Studio webview (protocol is registered app-wide in `lib.rs:618`; CSP allows `img-src efxasset:` for all windows) | Pitfalls 2/5 | If wrong, picker thumbnails and source-byte hydration need an fs-plugin path + capability scope instead |
| A4 | The chosen fond-checkerboard paint will sit beneath the monitor's composite layer without affecting the flattened record (the monitor already draws the paper fond on its own layer — `PhysicsPaintProgramMonitor` consumes `fondBackground`, 48-05 design) | Patterns | Paint-layer ordering tweak only; flattened raster path is untouched by construction |

## Open Questions

1. **Library delivery seam shape (request/result event pair vs. extended project-context push)**
   - What we know: the request/result idiom exists (`script-library-request/result` etc.), and the project-context push (`physic-paint:project-context`, `physicPaintBridge.ts:2296`) is a push-on-change precedent.
   - What's unclear: which is cheaper to wire and test; whether image bytes should arrive as dataUrls or be decoded via `efxasset://` URLs in the Studio.
   - Recommendation: request/result pair returning `{ images: MceImageRef[], projectDir: string }`; display via `assetUrl`; decode compositor bytes from `efxasset://` images. Planner decides; both are D-01-compliant.

2. **Fallback union shape for paper modes (D-11, Claude's discretion)**
   - What we know: current union is transparent/solid; selector modes include paper textures + grain params.
   - What's unclear: whether paper modes are `{ mode: 'paper'; texture: 'canvas1'|'canvas2'|'canvas3'; paperGrain; grainStrength }`-style, and whether `'white'` maps to the existing `{ mode:'solid'; color:'#ffffff' }` or a distinct mode.
   - Recommendation: extend with a paper mode; map White to solid `#ffffff` only if the encoder/parser stay total and round-trip clean — decide in the model plan with round-trip tests as the gate.

3. **Bg row `visible` toggle surfaced in Phase 49?** (explicitly Claude's discretion in CONTEXT)
   - Model field exists (`BackgroundTrack.visible`); compositor honors `backgroundParticipates`. Surfacing it is a small header affordance; deferring keeps the locked row surface untouched. Recommend: defer (matches "minimal surface" Phase 47 corrections) unless the planner sees UAT value.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| node | vitest / builds | yes | v24.15.0 | — |
| pnpm | monorepo install/test | yes | 10.27.0 | — |
| Rust toolchain | capability-file change recompile | (repo standard — Rust project exists at app/src-tauri) | — | capability JSON is consumed at runtime; no new Rust code expected unless the enumeration-command option is chosen |

**Missing dependencies with no fallback:** none
**Missing dependencies with fallback:** none

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (app workspace) |
| Config file | `app/vitest.config.ts` [VERIFIED: exists] |
| Quick run command | `pnpm --filter efx-motion-editor exec vitest run` (project config `workflow.test_command`) |
| Full suite command | same (`vitest run` — never watch mode; see Project Constraints) |

### Existing coverage to extend
- `efxPaintDocument.test.ts`, `efxPaintDocumentParsers` tests, `efxPaintMultiTrackProjection.test.ts` (document model + parsers)
- `efxPaintBackgroundResolution.test.ts`, `efxPaintCompositor.test.ts`, `efxPaintCompositeCache.test.ts` (compositor side — Phase 48, already green)
- `usePhysicsPaintCrossTrackDrag.test.ts`, drag hook tests (rail machinery patterns)
- Fixtures dir `efx-paint/document/__fixtures__/` holds `.mce` JSON fixtures for save/reopen tests

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BKG-01 | One fixed Background track | unit | `vitest run efxPaintDocument.test.ts` | ✅ (factory test covers) — extend for Import control presence (UI) |
| BKG-02 | Import still/sequence, natural filename order | unit | `vitest run <new natural-sort util test>` + picker confirm ordering test | ❌ Wave 0 |
| BKG-03 | START-collision rejection; interruption for downstream extent | unit | `vitest run <new clip-CRUD test>` (collision verdicts) | ❌ Wave 0 |
| BKG-04 | Repeat finite 1..∞; ∞ toggle; invalid input hold | unit | clip-CRUD + repeat-setter tests | ❌ Wave 0 |
| BKG-05 | cycleLength × repeat bounded by next clip/parent end | unit | `vitest run efxPaintBackgroundResolution.test.ts` | ✅ (Phase 48) — add BKG-shaped cases for partial-cycle next-clip shorten + deterministic recalculation on neighbor move/delete |
| BKG-06 | Gaps reveal fallback identically (Studio/flatten/preview/export) | unit + native UAT | flattened-with-fallback pixel test + gap verdicts via resolver | partially ✅ — monitor checkerboard + selector wiring new ❌ |
| BKG-07 | Linked refs, no durable duplication | unit | clip-CRUD test asserting same refs across repeats; one registration per sourceRef | ❌ Wave 0 |
| BKG-08 | Undo/redo all clip ops + fallback changes by reference | unit | ledger integration test (record → undo → redo) | ❌ Wave 0 |
| BKG-09 | Save/reopen survives | unit (round-trip) | parser round-trip for extended fallback + clips; `.mce` fixture | partially ✅ (clips round-trip covered by parser tests) — fallback-union round-trip + hydration registration test ❌ |

### Sampling Rate
- **Per task commit:** `pnpm --filter efx-motion-editor exec vitest run <touched test files>`
- **Per wave merge:** `pnpm --filter efx-motion-editor exec vitest run`
- **Phase gate:** full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] New pure clip-CRUD module + test (create/move/repeat/delete/fallback setters, collision verdicts, English reason map)
- [ ] New natural-sort util + test (`shot_1`/`shot_2`/`shot_10` ordering; never UUID)
- [ ] Fallback-union round-trip tests (parser + canonical encoder) for every new fond mode
- [ ] Undo ledger integration test covering all BKG-08 operations
- [ ] Store hydration test: open path registers source bytes for every clip ref (missing → transparent + capsule report)
- [ ] Program-monitor transparent-checkerboard paint test (montage-level) + flattened-raster non-regression (checkerboard must NOT appear in flattened output)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | partial | Capability-file least privilege: `physics-paint.json` extends by exactly one permission (`dialog:allow-open`); never copy the main window's broad `fs:*` grants. The `efxasset://` protocol already enforces allowed roots + extension/MIME allow-list (`lib.rs:375-446`). [VERIFIED: capability files + lib.rs read this session] |
| V5 Input Validation | yes | Parser stays exact-member fail-closed for the extended fallback union; repeat count validated as positive integer (existing parser error strings quoted above); clip CRUD ops reject start collisions and invalid repeat fail-closed; new IPC event payloads validated at the bridge boundary (existing bridge validates unknown payloads — `physicPaintBridge.ts:641` comment) |
| V6 Cryptography | no | — |
| V12 File and Resources | partial | Image import already native (`image_pool.rs` `is_supported_format`, `process_image`); no new file-write surface. If the enumeration-command option is chosen, scope it read-only to the project images dir. No `postMessage` origin auth changes (DF-04 stays deferred, unchanged) |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Crafted clip document field (repeat count, refs) | Tampering | Fail-closed parser + resolver strict validation at derivation (`efxPaintBackgroundResolution.ts:92-96` throws on malformed) |
| Cross-window payload spoofing in a new bridge event pair | Spoofing | Follow the existing operationId-correlated request/result contract; validate payloads (unknown → reject). DF-04 (no origin auth) remains accepted deferred risk — do not regress it |
| Path traversal via asset references | Tampering | Refs are library asset IDs only (D-09), never external paths; `efxasset` allowed-roots enforcement unchanged |
| DoS via infinite repeat rendering | — | Visible-window bound (T-47-04-03) + WeakMap-identity memoized derivation |

## Project Constraints (from CLAUDE.md)

- Use the project-local GSD install from `.claude/gsd-core`; never run the dev server (user runs it).
- Tests: `vitest run` only, never watch mode.
- Preact + `@preact/signals`, never React patterns: consult `efx-preact-reactivity` skill before any component/hook/store work — idempotent store setters, identity-stable effect deps, narrow signal reads, no render-body signal writes, no `useState` (signal in `useRef` if a harness requires), loop termination. `ImportGrid`'s existing internal `useState` must not propagate into new Studio code (see Pitfall 4).
- Keep `.planning` GSD artifacts in English.
- Git index lock recovery: check `lsof .git/index.lock` before removing; remove only the lock file.
- 49-UI-SPEC.md is APPROVED (7/7 dimensions, 2026-08-31): surfaces S1-S8, copy table, and interaction contract are binding for the plan.

## Sources

### Primary (HIGH confidence) — all read in-repo this session
- `app/src/efx-paint/document/efxPaintDocument.ts:20-122` — document model unions, factory
- `app/src/efx-paint/document/efxPaintDocumentParsers.ts:99-255` — fail-closed clip/fallback/track parsing
- `app/src/efx-paint/document/efxPaintDocumentRevision.ts:30-122` — canonical encoder + revision builders
- `app/src/efx-paint/compositor/efxPaintBackgroundResolution.ts:1-215` — resolver adapter (full read)
- `app/src/efx-paint/compositor/efxPaintCompositeCache.ts:61-126` — flattened cache key terms
- `app/src/stores/physicPaintStore.ts:407-433, 841-873, 1380-1569` — registry, fond instruction, flattened seam, metadata setter
- `app/src/stores/efxPaintStore.ts:169-222` — established mutation idiom
- `app/src/stores/imageStore.ts` (full read) — library store surface
- `app/src/components/import/ImportGrid.tsx:1-110` — picker grid contract + coupling
- `app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx:20-32` — selector options (verbatim)
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx:3050-3108` — monitor fond derivation (verbatim partial)
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx:2056, 3692-3742` — capsule port, Bg row mount
- `app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx:447-564` — locked Bg header
- `app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx:341,370` — repeat input pattern
- `app/src/components/physic-paint/engine/physicsPaintStudioSettings.ts` (full read) — fond settings ↔ metadata mapping
- `app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts` (header surface) — undo ledger
- `app/src/lib/physicPaintBridge.ts:62-95, 2296-2310` — transport event pairs
- `app/src/types/physicPaint.ts:1629-1636, 1670-1676, 1722-1736` — metadata, project context, launch context
- `app/src/types/project.ts:190-198` — MceImageRef
- `app/src-tauri/src/models/project.rs:16-42` — MceProject shape
- `app/src-tauri/src/services/image_pool.rs:15-57` — UUID v4 asset IDs
- `app/src-tauri/src/lib.rs:786-816` — registered command list
- `app/src-tauri/capabilities/default.json` / `physics-paint.json` — capability comparison
- `app/src-tauri/tauri.conf.json:38` — CSP with `efxasset:`
- `packages/efx-physic-paint/src/types.ts:92` — BgMode union
- `app/package.json` — dependency versions

### Secondary (MEDIUM confidence)
- `.planning/phases/49-.../49-CONTEXT.md`, `49-UI-SPEC.md` — locked decisions consumed verbatim
- STATE.md decision log (Phases 45-48) — carried semantics (ledger, fond, monitor, capability precedent)

### Tertiary (LOW confidence)
- None. No web sources were used; no external packages were evaluated.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies; all reuse paths read and quoted this session
- Architecture: HIGH — both fond-derivation sites, the realm-isolation finding, and the capability delta are file-verified
- Pitfalls: HIGH — six of seven pitfalls derive from verbatim code reads; the remaining DoS guard is carried from a locked Phase 47 contract

**Research date:** 2026-08-31
**Valid until:** 2026-09-30 (stable in-repo surface; re-probe if Phase 48 lands any post-research fix)
