# Phase 43: Hold Loop Clips + Filmstrip Capsule - Research

**Researched:** 2026-08-06
**Domain:** In-repo physical-frame document extension (linked Loop Clips), canonical per-frame resolver extension, Canvas 2D timeline capsule, Tauri parent/child bridge
**Confidence:** HIGH (all load-bearing claims verified against source files read this session; zero external dependencies)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Editing loops after creation**
- **D-01:** Clicking the capsule badge reopens the Play Script dialog in a loop-edit mode targeting that loop. Loop edit mode exposes ONLY Repeat + Infinity plus the Requested/Effective readout; primary action is `Update loop`. Frames-per-cycle and all source fields stay locked in this mode.
- **D-02:** The loop-edit dialog provides a secondary action `Edit source cycle…` that opens the full Play Script dialog in a separate source-edit mode, prefilled with the source cycle's current mode, Frames per cycle, color, and Motion values. The source-edit dialog must clearly state that confirming regenerates the source cycle and updates every linked Loop Clip referencing it; if multiple loops share the source, it shows how many loops are affected. Confirmation button: `Regenerate source cycle`. Regeneration uses the existing staged atomic commit, capacity, authority, cancellation, Undo, and Redo protections; Cancel changes nothing; after success all linked loops re-resolve requested/effective duration and next-clip truncation.
- **D-03:** Deleting a loop clip is unlink-only: the loop link is removed and the source cycle's real keys remain as ordinary Roto keys. Loops are pure references, so deletion is non-destructive by construction.
- **D-04:** A loop is anchored to its source cycle keys — no independent loop drag. The existing rigid group drag (Phase 37) moves the source keys and the loop with them. Single source of position truth.
- **D-05:** Source-cycle sharing between loops is decided at apply time: applying Play Script when an identical source cycle exists (same script + options) offers `Link to existing cycle` vs `Create new cycle`. Additionally, the capsule offers an explicit `Duplicate linked loop` action: pick a destination start frame and a new Loop Clip is created sharing the same source cycle — validated for same-start collision and overlap per D-14, with no regeneration. `Duplicate linked loop` is one atomic undoable operation: one Undo removes only the duplicate Loop Clip, Redo restores it, and no source keys or source assets are regenerated.

**Loops vs other Roto operations**
- **D-06:** Uniform shrink policy: ANY content-producing operation (manual insert/paste/drag of real keys, Play Script apply, Roto interpolation) landing inside a loop's effective range shortens the loop's effective duration to that point. The loop object survives; canonical Requested duration is unchanged; only Effective is derived. Before a batch generation operation confirms, preflight reports when its destination will shorten an existing loop: `This operation will shorten {N} linked loop(s), starting at frame {F}.` The generated-key commit and the resulting derived loop shrink remain one coherent undoable outcome — Undo removes the generated keys and the loop re-expands automatically.
- **D-07:** Source-cycle key deletion is REJECTED while any loop references the cycle, with a clear reason; the user unlinks first. Fail-closed, matching the approved Cut-tool precedent.
- **D-08:** A loop shrunk to Effective = 0f SURVIVES as an object (see D-25 for its zero-effective representation). If the blocking content later moves away, the loop re-expands automatically — no regeneration, consistent with HOLD-05 re-expansion.
- **D-09:** Copy/paste never carries loop identity. Copied source-cycle keys paste as ordinary real keys (Phase 38 reusable-clipboard contract unchanged). New loops are created only via Play Script Apply (+ optional Link) or `Duplicate linked loop`.
- **D-10:** `Update loop` and `Unlink loop` are each one atomic undoable operation (Phase 36.14 atomic-transaction model) — one Undo restores the prior state.
- **D-11:** Linked source-cycle keys are rigid: single-key drag (ripple) on a linked source key is rejected with a reason; Force Spacing rejects selections containing linked source keys. One uniform contract: a linked cycle's internal spacing IS the loop rhythm; keys move only via rigid group drag.
- **D-12:** Painting or erasing on a linked repetition frame materializes a new local real key at that frame: the loop's resolved pixels become its base plus the new stroke. The new key becomes the next-clip boundary and the loop shortens (D-06). Canvas and playhead stay at the current frame; one Undo removes the new key and the loop re-expands.
- **D-13:** Clear vs Delete on a linked repetition frame keep their distinct existing meanings. **Clear** materializes a local empty real key (source untouched, frame becomes the boundary, loop shortens, atomic undoable, one Undo re-expands). **Delete-key** is rejected because no local real key exists — it never touches the modulo-resolved source key and never unlinks — showing: `No real key exists at this linked frame. Use Clear to create an empty real key, or select the Loop Clip capsule to delete the loop.` A materialized empty key can later be deleted normally, re-expanding the loop. `Delete loop` remains the separate unlink-only operation on the selected capsule (D-03).
- **D-14:** Loop-loop priority: Requested ranges may overlap; resolved Effective ranges never overlap. Timeline order (NOT creation order) determines priority. Loop B (later canonical start) begins at its canonical start B; B's start acts as loop A's next-clip boundary; A's effective end = min(A requested end, B start, parent end); B is NOT pushed after A and is independently truncated by the next content or loop after B. An infinite earlier loop ends effectively at the later loop's start; moving or deleting the later loop re-expands the earlier automatically. Two loops cannot share a canonical start — same-start collisions are rejected or handled through an explicit replace/update flow, never by hidden creation-order priority.

**Filmstrip capsule presentation**
- **D-15:** Source-cycle cells show real thumbnails (downscaled cached PNGs from the existing cache path).
- **D-16:** Repetitions are zoom-adaptive: default zoom renders the compact perforated/hatched band (per spec); high zoom expands repetitions into visually lighter ghost linked cells (no thumbnails); low zoom collapses to band + badge only.
- **D-17:** Clicking a repeated occurrence reveals its repeat instance and source-frame index via tooltip (e.g. `Repeat 3 · Source frame 2 of 5`, flat-multiline Phase 38 convention) PLUS a separate seek action that moves to the modulo-resolved source frame.
- **D-18:** The Physics Paint Studio workflow strip also visualizes loops: linked repetition cells keep their existing cell-state semantics (empty/cached/generated/etc.) and gain an ADDITIVE link badge/border that changes neither cell geometry nor the Phase 36.15 legend/status palette. Source-cycle cells keep real-key diamonds. No new first-class cell state.
- **D-19:** Badge text is compact math only: `Cycle 5f × 5 = 25f` (finite), `Cycle 5f × ∞` (infinity), `Cycle 5f × 1 = 5f` (single cycle). Requested vs Effective values, truncation status, and mode (Progressive / Static-Hold) live in the tooltip. Truncation never changes the badge.
- **D-20:** Capsule copy is English only: `Loop shortened by next clip`. HOLD-06's earlier French truncation label is SUPERSEDED and must not ship; the term `clip bloquant` remains prohibited in every language.
- **D-21:** Truncation presentation: a diagonal cut slices the capsule's trailing corner (top-right, leaning forward in playback direction) across the whole capsule outline including the band, in an amber/warning-toned stroke distinct from source-cell and ghost-cell colors. The diagonal's position encodes partial vs complete truncation: at normal/high zoom it lands mid-ghost-cell for a partial cycle and exactly on a cycle boundary for complete cycles; the tooltip states `(partial cycle)` vs `(complete cycles)`. At low zoom the diagonal still draws on the band end.
- **D-22:** Zero-effective loop (Effective = 0f): a slim greyed anchor flag (~6px pill) pinned at the loop's canonical start frame with a compact `0f` marker; full tooltip (`Cycle 5f × 5 = 25f · Effective 0f — fully shortened by the next clip`); clickable, selectable, keyboard-focusable, with badge-edit, unlink, and delete-loop access intact. Never invisible; re-expands into the full capsule when the blocker moves.
- **D-23:** Capsule interaction states follow existing timeline idioms: hover = raise + tooltip; selected = accent outline around the whole capsule (selection unit = the loop object); keyboard-focus = visible focus ring in timeline keyboard nav; disabled/stale = reduced opacity + reason tooltip; error (unresolvable source refs) = red-toned outline + error tooltip — the capsule never silently disappears. Ghost cells, interpolated frames, and ordinary clips keep their current visuals; only source keys keep diamonds; ghost cells are never key-selectable.

**Next-clip boundary definition**
- **D-24:** The next-boundary query is scoped to the same parent Paint authority and explicitly excludes every entity owned by the Loop Clip being resolved — **a loop never truncates itself**. For loop L, boundary candidates exclude: every source-cycle keyId referenced by L; every virtual linked occurrence produced by L; L's own canonical start; caches, previews, interpolated render-only frames, and content from other layers. Valid boundaries are exactly three: a real key not owned by L's source cycle (including empty real keys), another Loop Clip's canonical start, and parentEndExclusive. A valid boundary landing exactly at L's start produces Effective = 0f (the zero-effective case of D-08/D-22). **Canonical start** is the frame of L's first source-cycle key — the beginning of the whole capsule presentation: the detailed source cycle renders first, then the linked repetition region, which begins at canonical start + cycleLength. Resolver and TimelineRenderer share this single definition; neither may interpret canonical start as the repetition-region start. The boundary model is purely key-based, matching the physical-frame document authority.
- **D-25:** Infinite loops track parent end dynamically: extending the parent sequence grows the loop's effective range, shrinking the parent shortens it — no regeneration either way. Finite loops never grow past their requested duration.

**Resolver, caching, and parity**
- **D-26:** Loop resolution EXTENDS the existing physical resolver (`physicsPaintRotoPhysicalResolver.ts`): loop records live in the physical-frame document and the resolver gains a virtual-resolution rule mapping a destination frame to its modulo source keyId. Real keys always win over virtual frames — this implements materialize-local-key (D-12) and shrink semantics (D-06) for free. Linked occurrences never receive their own raster/cache entries: one source cache entry serves every occurrence, and a source-frame Paint edit invalidates that single entry so every occurrence reflects it. Cache weight scales with source cycles, never with repetition count.
- **D-27:** One canonical resolver everywhere: main editor preview, playback/scrub, Physics Paint Studio frame display, filmstrip/thumbnails, PNG sequence export, and save/reopen cache regeneration all read the same physical-resolver output. The same project frame resolves to the same Paint raster on every surface; export never differs from preview; Infinity is bounded by the current parent end at export time. No adapters, no surface-specific resolution logic.
- **D-28:** Unavailable source frame policy: preview/playback show a marked placeholder frame (visible, non-blocking); export is BLOCKED with a clear error naming the affected loop and frame — a deliverable never silently contains placeholder frames.

**Persistence and backward compatibility**
- **D-29:** Loop Clips persist as additive records inside the physical-frame document — the single persistence authority; no sidecar file. The document gains an optional `loopClips` collection; v0.8.1 documents without it load as an empty collection with no migration and no format break. Locked minimum semantic record: stable Loop Clip id; canonical start frame; ordered stable source-cycle keyId references (stable Phase 36.14 keyIds); finite Repeat count or explicit Infinity state; source-cycle provenance required by the approved UI, including Progressive vs Static/Hold if not derivable from existing key metadata.
- **D-30:** Requested duration is derived (cycle length × Repeat/Infinity). Effective duration, next-clip boundary, parent-end truncation, repeat-instance mappings, and resolved destination frames are NEVER persisted — always recomputed by the canonical resolver. No persisted source revision acts as an invalidation authority: editing a source key remains valid and propagates immediately to linked occurrences (existing document/key revision mechanisms may still serve cache invalidation).
- **D-31:** Missing or stale source keyId references are preserved VERBATIM in the canonical record — never dropped silently, never rewritten at load. The Loop Clip is marked unresolved/error; its capsule or zero/error marker is retained (D-23); the tooltip lists the missing references; preview uses placeholders and affected exports are blocked (D-28); explicit repair, relink, unlink, and delete-loop actions are offered. Save/reopen preserves the unresolved record exactly so repair stays possible. Save As copies Loop Clip records and their stable references atomically with the physical document. Exact TypeScript field names and the integration seam are implementation research; the semantic fields, additive/no-migration approach, Effective-derived rule, and no-silent-data-loss behavior are locked.

**Performance**
- **D-32:** Virtual resolution invariant: O(1) modulo per frame; Infinity never materializes a frame list; only the requested frame/view resolves. The timeline draws only visible cells (TimelineRenderer is canvas — ghost cells are paint calls, zero DOM nodes). Export resolves incrementally per frame with the existing progress/cancellation. No per-repetition rasters. Moving/removing a boundary re-resolves derived ranges in O(keys + loops in range) with no cache rebuild. No artificial loop-count or cycle-size caps beyond existing key/capacity limits.

### Claude's Discretion

- Exact TypeScript field names and document-schema seam for `loopClips` (semantics locked in D-29..D-31).
- Determinism hardening mechanics for HOLD-02 (proving zero jitter across save/reopen and cache regeneration) — reuse `transformRecordedStrokeForHeldPose`; exact test strategy is planner territory.
- Exact ghost-cell/hatch/diagonal/anchor-flag drawing code within the locked presentation semantics (D-16, D-21, D-22) and TimelineRenderer conventions.
- Thumbnail downscale dimensions for source-cycle cells (existing cache path provides the source imagery).
- Exact tooltip copy phrasing within the locked content requirements (English only, `clip bloquant` prohibited).

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope. (Ping-pong loop mode LOOP-01 and combined progressive-plus-hold scheduler LOOP-02 remain roadmap-deferred future requirements, unchanged.)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HOLD-01 | Every static/hold destination frame receives the complete script stroke set | Already shipped in Phase 42: `buildStaticStrokeSchedule` maps every stroke to `startFrame: 0, endFrame: usableFrames - 1` (`staticStrokeSchedule.ts:16-29`). Phase 43 work is hardening + tests, not new schedule logic. |
| HOLD-02 | Deterministic static/hold across save/reopen and cache regeneration | `transformRecordedStrokeForHeldPose` is already pure hash-based (FNV seed + integer-math `poseNoise`; zero variation returns the stroke unchanged) — `recordedStrokeMotion.ts:14-92`. Phase 43 adds regression proof, not new determinism machinery. |
| HOLD-03 | Reuse existing commit path; no partial destination ranges; one Undo/Redo | The Play Script staged commit (`physicsPaintRotoPlayScriptController.ts` `confirm()` + `buildPhysicalPublication`, lines 220-438) and snapshot-based Undo/Redo (`useRotoPhysicalEditHistory.ts:83-92`) already provide this; loop records must JOIN the snapshot/revision contract (see Pitfall 2). |
| HOLD-04 | Generated keys remain parent Paint layer content; one resolved raster per frame | Existing: real-key records persist in `roto_physical` and the main editor resolves via `physicPaintStore.getRotoPhysicalRenderSource` (`physicPaintStore.ts:1405-1453`). Loop occurrences reuse this path with a modulo-resolved source keyId. |
| HOLD-05 | Linked Loop Clips: modulo resolution, half-open intervals, next-clip priority, re-expansion, edit propagation | New virtual cell kind in the physical projection (`projectPhysicPaintRotoPhysicalTimeline`, resolver:2057-2085) + additive `loopClips` document collection threading four strict allowlists (see Standard Stack / Persistence seam). |
| HOLD-06 | Filmstrip capsule: source cycle, repetition band, badges, requested vs effective, English truncation label | New Canvas 2D drawing in `TimelineRenderer.ts` fed by a new `fxTrackLayouts` projection field (the existing `playScriptMarkers` field is DEAD — never populated); main-editor tooltip surface does not exist yet (see Pitfall 5). |
</phase_requirements>

## Summary

Phase 43 is almost entirely an **in-repo extension** of seams that already exist and were verified this session. The physical-frame document authority (`physicsPaintRotoPhysicalModel.ts`), the acknowledged atomic commit path (`replace-roto-physical-map`), the snapshot-based Undo/Redo history, the deterministic held-pose transform, and the single per-frame render-source resolution (`physicPaintStore.getRotoPhysicalRenderSource`, consumed by preview, Studio display, persistence coordinator, and export via `PreviewRenderer`) are all in place. Loop Clips add: (1) an additive optional `loopClips` collection on the physical document, (2) a virtual cell kind in the shared physical projection so "real keys always win" is emergent, (3) loop-aware store read APIs and timeline projection, and (4) a pure Canvas 2D filmstrip capsule on the main editor timeline.

The three highest-risk integration facts the planner must design around: **(a) four strict allowlist parsers** (model document keys, persistence document keys, `types/project.ts` document type, and the `parsePersistedPhysicalDocument` guard) all reject unknown members — `loopClips` must be threaded through every one or save/load breaks; **(b) the canonical revision fingerprint covers only realKeyRecords + interpolation** and history snapshot equality is record-scoped — a loop-only edit (Update/Unlink/Duplicate) is invisible to revision checks and Undo unless the planner extends the snapshot/revision contract or adds a parallel loop-revision; **(c) the filmstrip capsule's two interaction dependencies do not exist on the main editor timeline today**: there is no tooltip surface (the Phase 38 flat-multiline tooltip lives only inside the Studio child window) and there is no parent→child bridge message to reopen the Play Script dialog in loop-edit mode (the bridge catalog is child→parent plus `physic-paint:seek-frame`).

No new packages, no new external services, no Rust changes: the Tauri-side `roto_physical` field is an opaque `serde_json::Value` (`project.rs:37`), so additive persistence is pure TypeScript.

**Primary recommendation:** Extend the existing physical projection with a `linked-loop` virtual cell kind and thread an optional `loopClips` collection through the four persistence allowlists; include `loopClips` in the Undo/Redo snapshot and revision inputs so every loop operation rides the existing atomic commit path unchanged.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Loop record persistence (`loopClips`) | Physical document model (`physicsPaintRotoPhysicalModel.ts` + `physicPaintPersistence.ts`) | `types/project.ts` schema type | D-29: single persistence authority, additive optional collection, no sidecar |
| Modulo virtual resolution (frame → source keyId) | Physical projection/resolver (`physicsPaintRotoPhysicalResolver.ts`) | Store read seam (`getRotoPhysicalRenderSource`) | D-26: resolver extension; real-key precedence is emergent from cell kinds |
| Requested/Effective/truncation derivation | Resolver (pure derivation from document + parent end) | — | D-24/D-30: derived, never persisted; one definition shared by resolver and TimelineRenderer |
| Per-frame raster for preview/export/Studio | Store `getRotoPhysicalRenderSource` (existing canonical seam) | `previewRenderer.ts` / `exportRenderer.ts` consumers | D-27: already one canonical path; linked occurrence returns the SOURCE key's render source |
| Filmstrip capsule rendering | Main editor timeline (`TimelineRenderer.ts`, Canvas 2D) | `frameMap.ts` `fxTrackLayouts` projection feed | HOLD-06; capsule is a pure view of resolver outputs (roadmap boundary note) |
| Capsule tooltip + hit regions | Main editor timeline interaction layer (`TimelineInteraction.ts` + new tooltip surface) | Studio `PhysicsPaintStyledTooltip` as copy/idiom reference | Gap: main timeline has hit-testing but NO tooltip component today (Pitfall 5) |
| Loop-edit / source-edit dialog modes | Studio child window (`PhysicsPaintPlayScriptDialog.tsx` + controller) | Parent→child bridge message to open loop-edit mode (NEW) | D-01/D-02; dialog lives in the child window; badge click originates in the parent |
| Loop ops Undo/Redo | Existing snapshot history (`useRotoPhysicalEditHistory.ts`) + `replace-roto-physical-map` commit | `physicPaint.ts` apply-payload allowlists | D-06/D-10: snapshot + revision must cover loopClips (Pitfall 2) |
| Source-cycle regeneration | Existing Play Script staged commit (`physicsPaintRotoPlayScriptController.ts` / Renderer) | — | D-02: reuse verbatim, no new commit path |
| Studio strip link badge | `PhysicsPaintWorkflowStrip.tsx` + `physicsPaintWorkflowPresentation.ts` | — | D-18: additive badge on existing cell semantics, no new first-class state |

## Standard Stack

### Core

**No new packages.** The 43-UI-SPEC Registry Safety section locks: "zero new dependencies in this phase". All work extends existing in-repo modules.

| Module | Role | Why Standard |
|--------|------|--------------|
| `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts` | Physical document authority; strict allowlist parsers; canonical revision fingerprint | D-29 target; fail-closed validation discipline already established |
| `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts` | Edit intents + shared read-only projection (`projectPhysicPaintRotoPhysicalTimeline`) | D-26 target; the one projection reused by store, selectors, ports |
| `app/src/stores/physicPaintStore.ts` | Canonical per-frame render-source resolution (`getRotoPhysicalRenderSource`) | D-27: preview/Studio/persistence-coordinator/export all consume it |
| `app/src/lib/physicPaintPersistence.ts` | Save/load hydration with sidecar PNG cache files | Additive `loopClips` rides the existing `roto_physical` payload |
| `@efxlab/efx-physic-paint/animation` (workspace) | `buildStaticStrokeSchedule`, `transformRecordedStrokeForHeldPose` | Phase 42 exports; unchanged this phase |

### Supporting

| Module | Purpose | When to Use |
|--------|---------|-------------|
| `app/src/components/timeline/TimelineRenderer.ts` | Canvas capsule host (physic-paint FX row) | S1 surface: band/ghost cells/badge/diagonal/anchor flag |
| `app/src/lib/frameMap.ts` (`fxTrackLayouts`) | Feeds timeline layout data from stores | New loop-capsule projection field threads here |
| `app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx` + `physicsPaintRotoPlayScriptController.ts` | Dialog extended with loop-edit and source-edit modes | D-01/D-02 (S2/S3/S4 surfaces) |
| `app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts` | Snapshot Undo/Redo | Extend `RotoPhysicalEditSnapshot` coverage to loopClips |
| `app/src/components/physic-paint/bridge/physicsPaintBridgeTransport.ts` | Tauri event + postMessage bridge | NEW parent→child "open loop-edit dialog" message |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Virtual cell kind in the physical projection | Materialize per-repeat cache entries (like generated interpolation cells) | REJECTED by D-26/D-32: duplicates rasters, breaks cache-weight invariant, breaks one-source-edit propagation |
| Additive `loopClips` inside `roto_physical` | Sidecar loop file per project | REJECTED by D-29: no sidecar; sidecar would break atomic Save As and reopen |
| Extend revision fingerprint to cover loopClips | Parallel loop-revision tracked beside content revision | Both viable — see Open Question Q1; extending the existing fingerprint keeps one authority check, at the cost of touching every `buildPhysicPaintRotoPhysicalRevision(records, interpolation)` call site |

**Installation:** none.

**Version verification:** not applicable — no external packages. Workspace package `@efxlab/efx-physic-paint` is `workspace:*` [VERIFIED: app/package.json:16] `"@efxlab/efx-physic-paint": "workspace:*"`.

## Package Legitimacy Audit

No external packages are installed in this phase (43-UI-SPEC Registry Safety: "zero new dependencies in this phase"). The Package Legitimacy Gate has nothing to check.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
Play Script Apply / loop ops (Studio child window)
   │  confirm() → staged render (Renderer) → atomic commit
   ▼
replace-roto-physical-map commit path (parent, physicPaintBridge.ts)
   │  validates expectedRevision, applies complete records (+ loopClips) snapshot
   ▼
physicPaintStore  ── owns ──►  realKeyRecords + loopClips (document authority)
   │
   │  _resolveRotoPhysicalStructural → projectPhysicPaintRotoPhysicalTimeline
   ▼
Physical projection: cells 0..capacity-1  = real | generated | empty | linked-loop (NEW)
   │                                        (real always wins; linked-loop = modulo ref)
   ├─► getRotoPhysicalRenderSource(layerId, appFrame)  ──► previewRenderer (main editor preview)
   │                                                     ──► exportRenderer (PNG export; D-28 block check)
   │                                                     ──► PhysicsPaintStudio frame display
   │                                                     ──► useRotoFramePersistenceCoordinator (live cache)
   ├─► rotoPhysicalTimelinePorts / selectors            ──► Studio workflow strip (D-18 badge)
   └─► frameMap.fxTrackLayouts (NEW loop capsule field) ──► TimelineRenderer capsule (S1)
                                                                        │ badge click
                                                                        ▼
                                              NEW parent→child bridge msg → Studio dialog loop-edit mode (D-01)
```

### Recommended Project Structure (files touched, by seam)

```
app/src/
├── components/physic-paint/roto/
│   ├── physicsPaintRotoPhysicalModel.ts        # + PhysicPaintRotoLoopClip record, guards, parser, document keys
│   ├── physicsPaintRotoPhysicalResolver.ts     # + 'linked-loop' virtual cell kind in projection
│   ├── physicsPaintRotoPlayScriptController.ts # + loop-edit/source-edit modes, Link/Create choice, preflight (D-06)
│   └── rotoTimelineSelectors.ts                # + loop-aware cell view models
├── stores/physicPaintStore.ts                  # + loopClips state, virtual render-source branch, loop-aware end frame
├── lib/
│   ├── physicPaintPersistence.ts               # + loopClips in PERSISTED_DOCUMENT_KEYS, save/hydrate mapping
│   ├── physicPaintBridge.ts                    # + loopClips in apply payload validation + acceptance
│   └── frameMap.ts                             # + capsule projection field on FxTrackLayout
├── types/
│   ├── physicPaint.ts                          # + apply-payload/result allowlist keys for loopClips; semantic-delta kinds
│   ├── project.ts                              # + loopClips on McePhysicPaintRotoPhysicalDocument
│   └── timeline.ts                             # + capsule layout type on FxTrackLayout
└── components/
    ├── timeline/TimelineRenderer.ts            # + capsule drawing (band, ghosts, badge, diagonal, anchor flag)
    ├── timeline/TimelineInteraction.ts         # + capsule hit regions + selection + keyboard focus unit
    └── physic-paint/view/
        ├── PhysicsPaintPlayScriptDialog.tsx    # + loop-edit / source-edit modes (S2/S3/S4)
        └── PhysicsPaintWorkflowStrip.tsx       # + additive link badge (S5)
```

### Pattern 1: Virtual linked-loop cell in the shared projection

**What:** Add a fourth cell kind to the closed `PhysicPaintRotoPhysicalCell` union so frames inside a loop's effective range resolve to a modulo source keyId — without persisting anything per repeat.
**When to use:** This is THE resolver extension D-26 mandates.
**Verified current union** [VERIFIED: app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts:193-201]:

```typescript
export type PhysicPaintRotoPhysicalCell =
  | { readonly kind: 'real'; readonly appFrame: number; readonly keyId: string }
  | {
      readonly kind: 'generated';
      readonly appFrame: number;
      readonly leftKeyId: string;
      readonly rightKeyId: string;
    }
  | { readonly kind: 'empty'; readonly appFrame: number };
```

**Example (extension shape — field names are Claude's Discretion per D-31):**

```typescript
// Source: in-repo extension of the verified union above; exact names are D-31 discretion [ASSUMED]
export type PhysicPaintRotoPhysicalCell =
  | { readonly kind: 'real'; readonly appFrame: number; readonly keyId: string }
  | { readonly kind: 'generated'; readonly appFrame: number; readonly leftKeyId: string; readonly rightKeyId: string }
  | { readonly kind: 'empty'; readonly appFrame: number }
  | {
      readonly kind: 'linked-loop';              // NEW — virtual, never persisted
      readonly appFrame: number;
      readonly loopId: string;
      readonly sourceKeyId: string;              // modulo-resolved: sourceKeyIds[(appFrame - canonicalStart) % cycleLength]
      readonly repeatIndex: number;              // (appFrame - canonicalStart) / cycleLength, floored
    };
```

"Real keys always win" falls out for free if virtual cells are only assigned where no real cell exists — the projection already builds real cells first from the validated identity mapping [VERIFIED: resolver:2075-2084 builds `mapping` from identities then calls `buildProjectionFromMapping`].

### Pattern 2: Additive optional document collection with absent-means-default

**What:** `loopClips` is an OPTIONAL member of the physical document; absent on load = empty collection. This is how v0.8.1 projects open with no migration (D-29).
**When to use:** Persistence task.
**The four allowlists that MUST all be extended** (missing any one breaks save or load):

1. [VERIFIED: app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts:269-278] —
```typescript
const PHYSIC_PAINT_ROTO_PHYSICAL_DOCUMENT_KEYS = new Set([
  'capacity',
  'realKeyRecords',
  'interpolation',
  'scriptMotion',
  'background',
  'selectedKeyId',
  'cursorAppFrame',
  'revision',
]);
```
`parsePhysicPaintRotoPhysicalDocument` throws `'PhysicPaintRotoPhysicalDocument: unknown or missing document members.'` on any key outside this set [VERIFIED: model:653-656]. It also recomputes the canonical revision and throws `'PhysicPaintRotoPhysicalDocument: canonical revision mismatch.'` [VERIFIED: model:687-690].

2. [VERIFIED: app/src/lib/physicPaintPersistence.ts:18] —
```typescript
const PERSISTED_DOCUMENT_KEYS = new Set(['capacity', 'realKeyRecords', 'interpolation', 'scriptMotion', 'background', 'selectedKeyId', 'cursorAppFrame', 'revision']);
```
with `parsePersistedPhysicalDocument` throwing `'Persisted physical Roto document has unknown or missing members.'` [VERIFIED: persistence:216-219]. The save mapping at [VERIFIED: persistence:180-189] constructs the persisted document field-by-field — `loopClips` must be added there and in hydration at [VERIFIED: persistence:255-264].

3. [VERIFIED: app/src/types/project.ts:68-77] —
```typescript
export interface McePhysicPaintRotoPhysicalDocument {
  readonly capacity: number;
  readonly realKeyRecords: readonly McePhysicPaintRotoPhysicalRecord[];
  readonly interpolation: PhysicPaintRotoInterpolationState;
  readonly scriptMotion: PhysicPaintRotoScriptMotionSettings;
  readonly background: PhysicPaintRotoBackgroundMetadata | null;
  readonly selectedKeyId: string | null;
  readonly cursorAppFrame: number;
  readonly revision: string;
}
```

4. The bridge apply-payload allowlists [VERIFIED: app/src/types/physicPaint.ts:330]:
```typescript
if (!hasOnlyKeys(value, ['kind', 'operationId', 'operationKind', 'layerId', 'startFrame', 'launchOperationId', 'projectContextId', 'expectedRevision', 'records', 'interpolationEnabled', 'interpolationMode', 'selectedKeyId', 'selectedAppFrame', 'semanticDelta', 'historyProvenance'])) return false;
```
(plus the matching result allowlist at line 367). If loop state rides the commit payload, these key sets grow too.

**Rust side needs nothing** [VERIFIED: app/src-tauri/src/models/project.rs:37]: `pub roto_physical: Option<Value>,` — the document is opaque JSON to Tauri.

**No-migration load path:** the parser must treat absent `loopClips` as `[]` rather than requiring the key. Note the existing parsers use `hasOnlyAllowedKeys` (subset check), NOT exact-key-set equality — an optional member is therefore compatible with the current guard style [VERIFIED: model:322-324 `hasOnlyAllowedKeys` checks `Object.keys(value).every((key) => allowed.has(key))` — absence of an allowed key is not an error]. The document parser DOES require every currently-listed member via explicit field checks (e.g. capacity/revision checks at model:657-690), so `loopClips` must be the first genuinely optional member: `value.loopClips === undefined ? [] : parse(value.loopClips)`.

### Pattern 3: Snapshot-based atomic Undo/Redo (extend snapshot coverage)

**What:** History commands store complete immutable before/after snapshots; Undo replays `before` through the same commit path with `operationKind: 'undo'`.
**When to use:** Every loop operation (Update, Unlink, Duplicate, Clear-materialize, generation-with-shrink per D-06/D-10).
[VERIFIED: app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts:83-92]:
```typescript
interface RotoPhysicalEditCommand<EngineState> {
  readonly kind: 'physical';
  readonly operationId: string;
  readonly operationKind: RotoPhysicalEditOrdinaryOperationKind;
  readonly before: RotoPhysicalEditSnapshot<EngineState>;
  readonly after: RotoPhysicalEditSnapshot<EngineState>;
  readonly acceptedRevision: string;
  readonly selectedKeyId: string | null;
  readonly selectedAppFrame: number | null;
}
```
Snapshot equality is record+interpolation+selection scoped [VERIFIED: history:138-159 `snapshotRecordsEqual` compares records, interpolation, selectedKeyId, selectedAppFrame — nothing else]. The revision used for replay provenance is `buildPhysicPaintRotoPhysicalRevision(snapshot.records, snapshot.interpolation)` [VERIFIED: history:161-163]. **LoopClips must join the snapshot, its equality, and its revision** or loop-only operations are invisible to Undo and to authority checks (see Pitfall 2 / Open Question Q1).

### Pattern 4: One canonical per-frame render source (loop occurrences reuse the source entry)

**What:** `getRotoPhysicalRenderSource` is the single per-frame resolution consumed by every surface.
**When to use:** D-26/D-27 implementation — linked occurrence branch returns the source key's payload with a source-scoped cache revision.
[VERIFIED: app/src/stores/physicPaintStore.ts:1405-1453] — current branches:
```typescript
getRotoPhysicalRenderSource(layerId: string, appFrame: number): PhysicPaintRotoPhysicalRenderSource | null {
  if (!Number.isInteger(appFrame) || appFrame < 0) return null;
  const projection = this.getRotoPhysicalProjection(layerId);
  const contentRevision = this.getRotoPhysicalContentRevision(layerId);
  if (!projection || !contentRevision) return null;
  const cell = projection.cells[appFrame];
  if (!cell || cell.appFrame !== appFrame || cell.kind === 'empty') return null;
  if (cell.kind === 'real') {
    const record = this.getRotoRealKeyRecord(layerId, cell.keyId);
    if (!record || record.appFrame !== appFrame || record.payload.appFrame !== appFrame) return null;
    return {
      kind: 'real',
      layerId,
      appFrame,
      keyId: record.keyId,
      contentRevision,
      cacheRevision: `${contentRevision}:real:${record.keyId}`,
      renderedFrame: record.payload,
    };
  }
  // … 'generated' branch renders duplicate/blend interpolation …
```
The NEW `linked-loop` branch resolves `cell.sourceKeyId`'s record and returns ITS payload. Cache identity stays source-scoped (`${contentRevision}:real:${sourceKeyId}` or a `:loop:` variant keyed by the SOURCE keyId) so one source edit invalidates every occurrence at once (D-26). Consumers verified this session: main-editor preview (`previewRenderer.ts:127`), Studio display (`PhysicsPaintStudio.tsx:808,1077`), live-cache coordinator (`useRotoFramePersistenceCoordinator.ts:134`), and PNG export via `PreviewRenderer` [VERIFIED: app/src/lib/exportRenderer.ts:1 `import {getPreviewPhysicPaintFrameCacheKey, PreviewRenderer, type PreviewPhysicPaintFrameSource} from './previewRenderer';`].

### Pattern 5: Deterministic held pose (already pure — harden with tests, not new code)

[VERIFIED: packages/efx-physic-paint/src/animation/recordedStrokeMotion.ts:14-43]:
```typescript
export function transformRecordedStrokeForHeldPose(
  stroke: Readonly<PaintStroke>,
  pose: Readonly<RecordedStrokeHeldPose>,
): PaintStroke {
  const deformation = clampPercent(pose.deformation) / 100
  const position = clampPercent(pose.position) / 100

  if (deformation === 0 && position === 0) return stroke as PaintStroke

  const seed = hashStroke(stroke, pose.strokeIndex)
  const poseFrame = quantizeStopMotionFrame(pose.destinationSourceFrame)
  // …
```
The seed is an FNV-1a hash of `` `${strokeIndex}:${stroke.timestamp}:${stroke.color ?? ''}:${stroke.points.length}` `` [VERIFIED: recordedStrokeMotion.ts:50-58] and `poseNoise` is integer-only math [VERIFIED: recordedStrokeMotion.ts:87-92]. Zero variation returns the input stroke unchanged — the stable held drawing is structural, not accidental. HOLD-02 work is regression proof: same script + destination + options ⇒ byte-identical `dataUrl`s across save/reopen and cache regeneration.

### Anti-Patterns to Avoid

- **Per-repeat cache or raster entries:** violates D-26/D-32 and the one-source-cache invariant; also re-opens the deferred "cache footprint" debt. Use virtual cells only.
- **Feeding linked occurrences through `_rotoCacheMetadata`:** that is the legacy display model (source/displayFrame projection); the physical path is the authority. Polluting it would create a third resolution source, violating D-27.
- **Normalizing or dropping stale source keyIds at load:** D-31 requires verbatim preservation and an unresolved/error state. The existing parsers throw on malformed input — loop parsing must distinguish "structurally malformed" (throw) from "well-formed but dangling reference" (preserve verbatim + mark unresolved). These are different outcomes; do not collapse them into one throw.
- **A second tooltip or dialog system:** reuse the Studio flat-multiline idiom and the Phase 42 `--ps-*` modal; the main-timeline tooltip surface is new code but must follow the existing convention, not invent a parallel one.
- **Re-deriving canonical start in TimelineRenderer:** D-24 locks one shared definition (first source-cycle key frame); the renderer consumes the resolver's derived capsule model, never recomputes.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Deterministic per-frame variation | New RNG / jitter for hold frames | `transformRecordedStrokeForHeldPose` (hash-seeded, pure) | D-30/HOLD-02; already regression-locked in Phase 42 |
| Atomic multi-frame commit with cancel/undo | New commit/transaction path for loops or regeneration | `replace-roto-physical-map` + `useRotoPhysicalEditHistory` snapshot replay | HOLD-03/D-02/D-10; a second path doubles the authority surface |
| Document validation | Loose `JSON.parse` + cast for `loopClips` | Strict allowlist guards mirroring the existing model parsers | Every existing parser is fail-closed; loose parsing would silently violate D-31 |
| Timeline thumbnails | New image-loading pipeline | `ThumbnailCache` lazy `HTMLImageElement` pattern [VERIFIED: app/src/components/timeline/ThumbnailCache.ts:7-22 `get(imageId, thumbnailUrl)` returns cached image or null] | Existing convention; capsule source thumbnails are dataUrls from real-key payloads, downscaled via `drawImage` at draw time |
| Zoom-adaptive canvas text | New truncation utility | `TimelineRenderer.truncateText` + the 18px label minimum (existing marker convention) | UI-SPEC Spacing section locks reuse |

**Key insight:** every "hard" part of this phase (atomicity, determinism, validation discipline, per-frame resolution, canvas rendering) already has exactly one in-repo owner. The phase fails only if a task builds a second one.

## Common Pitfalls

### Pitfall 1: The four-allowlist persistence gauntlet
**What goes wrong:** `loopClips` is added to the model parser but not to `PERSISTED_DOCUMENT_KEYS` (or vice versa): saving works but reopening throws `'Persisted physical Roto document has unknown or missing members.'`, or the field is dropped silently at save because the save mapping constructs the persisted document field-by-field [VERIFIED: persistence:180-189 builds `rotoPhysical = { capacity, realKeyRecords, interpolation, scriptMotion, background, selectedKeyId, cursorAppFrame, revision }` — an unlisted field is LOST at save].
**Why it happens:** The persistence layer does not spread the runtime document; it whitelists every key.
**How to avoid:** One task owns all four seams (model keys, persistence keys + save mapping + hydration, `types/project.ts`, bridge payload allowlists) with a save→reopen round-trip test asserting `loopClips` survives byte-identically.
**Warning signs:** Reopen throws unknown-member errors; or saved `.mce` JSON lacks `loopClips`.

### Pitfall 2: Loop-only edits invisible to revision checks and Undo
**What goes wrong:** `Update loop` changes only Repeat — no real-key record changes — so `buildPhysicPaintRotoPhysicalRevision(records, interpolation)` [VERIFIED: model:595-601 takes exactly `(records, interpolation)`] returns the SAME revision. Authority's `expectedRevision` check passes vacuously, `snapshotRecordsEqual` reports no change, and the history entry collapses to a no-op: Undo cannot restore the prior Repeat, violating D-10.
**Why it happens:** The revision/snapshot contract predates non-record document state.
**How to avoid:** The planner picks one: (a) extend the revision fingerprint and snapshot to include loopClips (touches every `buildPhysicPaintRotoPhysicalRevision` call site — store:136, store:746, history:162, model:687, persistence save path via `buildPhysicPaintRotoProjectEquality`), or (b) carry loopClips as a parallel snapshot member with its own equality and a composite revision. Either way, D-06's "generation commit + derived loop shrink = one undoable outcome" requires keys and loops in ONE snapshot.
**Warning signs:** `Update loop` succeeds but Undo reports nothing to undo; authority accepts a commit built on stale loop state.

### Pitfall 3: Infinite loops clipped by real-key-derived timeline length
**What goes wrong:** Main-editor timeline length derives from the LAST REAL KEY: [VERIFIED: app/src/stores/physicPaintStore.ts:1399-1402]
```typescript
getRotoPhysicalEndFrame(layerId: string): number | null {
  const records = this.getRotoRealKeyRecords(layerId);
  return records.length === 0 ? null : records[records.length - 1].appFrame + 1;
}
```
consumed by `getTimelineRequiredFrameCount`/`getTimelineOverlaySequenceOutFrame` [VERIFIED: app/src/lib/frameMap.ts:124-153]. An infinite loop (or any loop whose effective end exceeds the last real key) is visually clipped — the capsule and resolved frames never appear past the last real key.
**Why it happens:** The end-frame read predates virtual content.
**How to avoid:** The end-frame computation must become loop-aware (max of last real key and max effective loop end, bounded by parent end per D-25). This is also where D-25's "infinite loops track parent end dynamically" lands on the main timeline.
**Warning signs:** Native UAT: infinity loop renders only up to the source cycle's last key frame.

### Pitfall 4: Phase 42 dialog readout vs Phase 43 resolver divergence
**What goes wrong:** The Phase 42 controller computes its own Requested/Effective readout inline — [VERIFIED: app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts:144-158] `loopReadout` computes `boundary = layerEndExclusive - start` and `effective = Math.min(requested, boundary)`. Phase 43's resolver implements the full D-24 boundary model (real keys not owned by the loop, other loops' canonical starts, parentEndExclusive — a real-key boundary is NOT considered by the 42 readout). If the dialog keeps its local computation while the resolver computes real effective ranges, the pre-apply readout and the post-apply capsule disagree.
**Why it happens:** D-14 (Phase 42) made the readout informational-only; Phase 43 makes it authoritative.
**How to avoid:** The loop-edit mode's Requested/Effective readout (D-01) must come from the canonical resolver, and the apply-time preview should route through the same boundary query the resolver uses. Planner should make the shared boundary computation a resolver export consumed by both.
**Warning signs:** Dialog says `Effective: 25f` but the capsule truncates at 18f because a real key sits at frame 18.

### Pitfall 5: Main-editor timeline has no tooltip surface and no capsule→dialog bridge message
**What goes wrong:** D-01 (badge click reopens dialog in loop-edit mode), D-17/D-19/D-21/D-22 (tooltips) assume machinery that exists only in the Studio child window: the flat-multiline tooltip component is `app/src/components/physic-paint/view/PhysicsPaintStyledTooltip.tsx` (Studio-only — grep confirms no tooltip module under `app/src/components/timeline/`), and the bridge transport catalog [VERIFIED: app/src/components/physic-paint/bridge/physicsPaintBridgeTransport.ts] contains child→parent events and `physic-paint:seek-frame` only — no parent→child "open dialog in mode X" message. The Studio may also be CLOSED when the badge is clicked.
**Why it happens:** The capsule is the first main-timeline element that needs rich hover/click affordances and cross-window dialog control.
**How to avoid:** Plan explicit tasks for (a) a main-timeline tooltip host following the Phase 38 flat-multiline idiom, (b) a new parent→child bridge message (launch/focus Studio + open Play Script dialog in loop-edit mode with target loopId), and (c) capsule hit-testing in `TimelineInteraction.ts` (which already hit-tests keyframes [CITED: TimelineInteraction.ts:353 "Only hit-test if we have active keyframes"]).
**Warning signs:** Plan tasks cover capsule drawing but nothing owns tooltip rendering or the badge-click path.

### Pitfall 6: Source-cycle Motion seeding depends on absolute destination frame
**What goes wrong:** The renderer passes `destinationSourceFrame: destination` (the absolute appFrame) into the held-pose transform [VERIFIED: app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts:66-71]. With nonzero Motion, the SAME script applied at a different start frame produces different pixels. D-05's "identical source cycle exists (same script + options)" matching is therefore start-sensitive when Motion ≠ 0/0: a cycle generated at F10 is not pixel-identical to one generated at F40.
**Why it happens:** Determinism is seeded by destination, deliberately (stable per frame).
**How to avoid:** The Link/Create matching key should include canonical start (or compare rendered source-key payloads) whenever Motion is nonzero; with Motion 0/0 the transform is the identity and start does not matter. This is a controller-side matching-rule decision — flag for the planner, semantics of "identical" are locked but the comparison inputs are discretion.
**Warning signs:** User is offered `Link to existing cycle` for a cycle whose held poses visibly differ from what Generate would have produced at the new start.

### Pitfall 7: Ghost cells leaking into key-selectable surfaces
**What goes wrong:** Virtual linked cells appear in the shared projection consumed by selectors, ports, the Studio strip, and drag/drop logic. Any consumer that treats non-empty cells as keys would make ghost cells selectable/draggable, violating D-23 ("ghost cells are never key-selectable") and D-11.
**Why it happens:** The cell union is consumed by many modules (`rotoTimelineSelectors.ts`, `rotoPhysicalTimelinePorts.ts`, `physicsPaintWorkflowPresentation.ts`, `useRotoTimelineModel.ts` — all verified consumers of `PhysicPaintRotoPhysicalCell`).
**How to avoid:** Audit every `cell.kind ===` / `cell.kind !==` site when the new kind lands; selection and drag ports must explicitly exclude `linked-loop`. A type-level exhaustiveness check (switch with `never` fallback) per consumer is the cheap guard.
**Warning signs:** Clicking a repetition frame selects a "key"; single-key drag on a ghost frame produces a resolver error instead of the locked D-13 rejection copy.

### Pitfall 8: Unresolved-loop placeholder leaking into export
**What goes wrong:** D-28 splits policy: preview shows marked placeholders; export is BLOCKED. If the export path just resolves frames through the render-source seam, a missing source key yields `null` → blank frame in the deliverable, silently.
**Why it happens:** Export consumes the same per-frame seam as preview (via `PreviewRenderer`); nothing today distinguishes "unresolvable loop" from "empty frame".
**How to avoid:** Export needs a preflight loop-resolution check (all loops resolvable across the export range) that fails fast with the locked copy: `Export blocked — Loop Clip at frame {S} references a missing source frame ({F}). Repair or unlink the loop, then export again.` (UI-SPEC Copywriting Contract).
**Warning signs:** Export completes with blank frames where a loop should be.

## Code Examples

### Loop Clip record shape (semantics locked by D-29; field names are discretion)

```typescript
// Source: semantics from 43-CONTEXT D-29/D-31; exact names are Claude's Discretion [ASSUMED]
export interface PhysicPaintRotoLoopClip {
  readonly loopId: string;                          // stable id, allocated like createPhysicPaintRotoKeyId
  readonly canonicalStart: number;                  // frame of first source-cycle key (D-24)
  readonly sourceKeyIds: readonly string[];         // ordered stable keyIds; length IS the cycle length
  readonly repeat: number | 'infinity';             // finite positive int or explicit infinity state
  readonly mode: 'progressive' | 'static';          // provenance for the tooltip (D-19); matches RotoPlayScriptMode
}
```
`RotoPlayScriptMode` is verified as `'progressive' | 'static'` [VERIFIED: physicsPaintRotoPlayScriptController.ts:20].

### Modulo resolution (D-26/D-32 O(1) per frame)

```typescript
// Source: derived from D-24/D-26 semantics; implementation sketch [ASSUMED]
function resolveLoopSourceKeyId(
  loop: PhysicPaintRotoLoopClip,
  appFrame: number,
): string {
  const cycleLength = loop.sourceKeyIds.length;         // >= 1
  const offset = appFrame - loop.canonicalStart;        // >= 0 within effective range
  return loop.sourceKeyIds[offset % cycleLength];
}
// repeatIndex = Math.floor(offset / cycleLength) — feeds the D-17 tooltip `Repeat {n} · Source frame {i} of {N}`
```

### Effective-range derivation (D-14/D-24 half-open intervals)

```typescript
// Source: derived from locked D-14/D-24 algebra; implementation sketch [ASSUMED]
// effectiveEnd = min(requestedEnd, nextBoundary, parentEndExclusive), all half-open [start, end)
// requestedEnd = canonicalStart + cycleLength * repeat   (finite)
// requestedEnd = parentEndExclusive                       (infinity, D-25 dynamic tracking)
// nextBoundary = min over:
//   - appFrame of any real key NOT in loop.sourceKeyIds and > canonicalStart   (D-24 valid boundary 1)
//   - canonicalStart of any OTHER loop > this loop's canonicalStart            (D-24 valid boundary 2 / D-14)
//   - parentEndExclusive                                                       (D-24 valid boundary 3)
// Boundary AT canonicalStart ⇒ Effective = 0f (D-08/D-22 zero-effective anchor flag)
// partial cycle: (effectiveEnd - canonicalStart) % cycleLength !== 0 ⇒ tooltip `(partial cycle)` (D-21)
```

### Badge + readout copy (locked verbatim forms)

```typescript
// Source: 43-CONTEXT D-19/D-22 + 43-UI-SPEC Copywriting Contract [VERIFIED: planning documents]
const badgeFinite   = `Cycle ${cycleLength}f × ${repeat} = ${cycleLength * repeat}f`; // e.g. `Cycle 5f × 5 = 25f`
const badgeInfinity = `Cycle ${cycleLength}f × ∞`;                                    // never `Infinityf`
const badgeSingle   = `Cycle ${cycleLength}f × 1 = ${cycleLength}f`;
const zeroEffectiveTooltip = `${badgeFinite} · Effective 0f — fully shortened by the next clip`;
const truncatedTooltip =
  `${badge} · Requested ${requested}f · Effective ${effective}f · Loop shortened by next clip (${partial ? 'partial cycle' : 'complete cycles'}) · ${mode === 'static' ? 'Static / Hold' : 'Progressive'}`;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Phase 42: Repeat/Infinity informational only; loop readout computed locally in the dialog | Phase 43: Repeat/Infinity become persisted loop intent; one canonical boundary derivation shared by dialog, resolver, capsule | This phase | Dialog readout must migrate to the resolver's boundary query (Pitfall 4) |
| `playScriptMarkers` on `FxTrackLayout` | Dead — never populated by `frameMap.ts`; acknowledged as deferred debt in STATE.md ("dead playScriptMarkers") | Pre-existing | Do NOT build the capsule on this field; add a new loop-capsule projection field fed by the resolver |
| Cells: real/generated/empty | Cells gain virtual `linked-loop` | This phase | Exhaustiveness audit across all cell-kind consumers (Pitfall 7) |

**Deprecated/outdated:**
- `FxTrackLayout.playScriptMarkers` [VERIFIED: app/src/types/timeline.ts:56 `playScriptMarkers?: TimelinePlayScriptMarker[]; // saved Play ranges nested inside physic-paint FX bars`] — no producer exists in `frameMap.ts`; planner should not reuse it for the capsule.
- The French truncation label — superseded at the requirement source 2026-08-06; `Loop shortened by next clip` only; `clip bloquant` prohibited in every language (D-20).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Loop record field names (`loopId`, `canonicalStart`, `sourceKeyIds`, `repeat`, `mode`) | Code Examples | Low — D-31 explicitly leaves names to discretion; semantics are locked |
| A2 | The `linked-loop` virtual cell kind is the best extension point vs a parallel per-frame function | Pattern 1 | Medium — a parallel function could satisfy D-26 without touching the closed union; the cell-kind approach gives "real wins" for free but requires the Pitfall-7 exhaustiveness audit |
| A3 | Revision fingerprint extension (vs parallel loop snapshot) is the recommended Undo/Redo integration | Pitfall 2 / Q1 | Medium — both are viable; the planner may choose the parallel route to minimize blast radius on regression-locked call sites |
| A4 | Parent→child loop-edit dialog message is a new bridge event following existing transport idioms | Pitfall 5 | Low — transport module verified; message shape is discretion |
| A5 | D-05 "identical source cycle" matching should include canonical start when Motion ≠ 0 | Pitfall 6 | Medium — semantics of "same script + options" are locked; comparison inputs are discretion; user may intend payload-equality matching instead |

## Open Questions

1. **Revision coverage for loopClips — extend or parallel?** (RESOLVED — 43-01: loopClips join the single canonical revision fingerprint; the parallel-snapshot route was rejected. See 43-01-PLAN.md.)
   - What we know: the canonical revision covers `(records, interpolation)` only [VERIFIED: model:595-601]; history snapshots and authority checks are built on it; `buildPhysicPaintRotoProjectEquality` (persisted equality) also exists [VERIFIED: model:635-646].
   - What's unclear: whether loopClips join the fingerprint (one authority, more call-site churn) or ride as a parallel snapshot member with composite checking (less churn, two authorities to keep coherent).
   - Recommendation: planner decides explicitly in Wave 0/1; either is defensible, but D-06/D-10 atomicity is broken if NEITHER covers loops. Extending the single fingerprint is architecturally cleaner; parallel is less invasive to regression-locked paths.

2. **Where does the apply-time `Link to existing cycle` match run?** (RESOLVED — 43-06: controller-side `findIdenticalSourceCycle` matching on (scriptId, mode, cycleLength, motion, overrideColor) plus canonical start when Motion ≠ 0, per the recommendation. See 43-06-PLAN.md Task 1.)
   - What we know: D-05 locks the UX; the controller holds script snapshot + options at confirm time [VERIFIED: controller:236-247].
   - What's unclear: the matching key (script id + mode + frames-per-cycle + Motion + override + color? + canonical start per Pitfall 6).
   - Recommendation: match on (scriptId, mode, cycleLength, motion, overrideColor) and include canonical start when Motion ≠ 0; surface the match count for the S4 helper copy.

3. **Studio-closed badge click behavior** (RESOLVED — 43-06: launch-or-focus — a closed Studio is launched via the existing `openPhysicPaintCanvas` path, then the open-loop-edit message is delivered once ready. See 43-06-PLAN.md Task 3.)
   - What we know: D-01 says the badge click "reopens the Play Script dialog in a loop-edit mode"; the Studio is a separate Tauri window [VERIFIED: app/src/lib/physicPaintBridge.ts:1304-1342 `openPhysicPaintCanvas` — `tryOpenTauriPhysicPaintWindow` branch] that may not be open.
   - What's unclear: whether badge click launches/focuses the Studio window when closed (likely yes — "reopens"), and which existing launch guards apply.
   - Recommendation: planner adds an explicit task for the launch-or-focus + open-loop-edit flow; confirm with user if the window-closed case should launch Studio automatically.

4. **Parent-end source for D-25 on the main timeline** (RESOLVED — 43-02: capacity-bounded — an infinity loop's effective end is min(parentEndExclusive, PHYSIC_PAINT_MAX_APPLY_FRAMES = 600), per the recommendation. See 43-02-PLAN.md.)
   - What we know: the controller's `layerEndExclusive` comes from parent authority; the main timeline's required frame count comes from content frames and roto end [VERIFIED: frameMap.ts:128-142].
   - What's unclear: which value is "parent end" for an infinity loop's effective range on the main timeline when the parent sequence extends beyond the physical capacity (600).
   - Recommendation: cap effective range at physical capacity (PHYSIC_PAINT_MAX_APPLY_FRAMES = 600 [VERIFIED: app/src/types/physicPaint.ts:13 `export const PHYSIC_PAINT_MAX_APPLY_FRAMES = 600;`]) since cells are capacity-bounded; the capsule beyond capacity is out of scope (D-32 says no caps beyond existing capacity limits).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| pnpm | All gates (`pnpm --dir app exec vitest run`, build) | ✓ | 10.27.0 | — |
| Node.js | Vitest, Vite build | ✓ | v24.15.0 | — |
| cargo | REL-01 cargo tests (phase-adjacent) | ✓ | 1.93.1 | — |
| `@efxlab/efx-physic-paint` workspace package | Static schedule + held-pose transform | ✓ | workspace:* | — |
| External search providers (brave/exa/firecrawl) | Research only | ✗ | — | Not needed — all research targets are in-repo |

**Missing dependencies with no fallback:** none
**Missing dependencies with fallback:** none

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^2.1.9 [VERIFIED: app/package.json:48 `"vitest": "^2.1.9"`] |
| Config file | `app/vitest.config.ts` [VERIFIED: file exists this session] |
| Quick run command | `pnpm --dir app exec vitest run <file>` (CLAUDE.md: `vitest run`, NEVER watch mode) |
| Full suite command | `pnpm --dir app exec vitest run` (REL-01 gate) |

Tests are colocated as `*.test.ts` beside sources (20 existing roto test files verified, e.g. `physicsPaintRotoPhysicalResolver.test.ts`, `physicsPaintRotoPlayScriptController.test.ts`). Config `workflow.tdd_mode: true` in `.planning/config.json` — plans should be test-first.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HOLD-01 | Static schedule puts every stroke on every frame | unit | `pnpm --dir app exec vitest run physicsPaintRotoPlayScriptRenderer` | ✅ (Phase 42 `physicsPaintRotoPlayScriptRenderer.test.ts`); add progressive-then-hold adjacent-range case |
| HOLD-02 | Identical inputs → identical output across save/reopen + cache regen; zero-variation stable | unit | `pnpm --dir app exec vitest run <new determinism spec>` | ❌ Wave 0 |
| HOLD-03 | Commit path reuse; no partial range on cancel/fail; one Undo/Redo | unit | `pnpm --dir app exec vitest run physicsPaintRotoPlayScriptController` | ✅ extend existing controller test |
| HOLD-04 | Generated keys composite as one raster per frame via canonical seam | unit (store-level) | `pnpm --dir app exec vitest run physicPaintStore` | ✅ extend (`physicPaintStore.rotoPhysicalStructuralCache.test.ts` pattern) |
| HOLD-05 | Modulo resolution, half-open boundaries, next-clip priority, re-expansion, edit propagation, loop-loop priority, zero-effective | unit (resolver/projection) | `pnpm --dir app exec vitest run <new loop resolver spec>` | ❌ Wave 0 |
| HOLD-05 | loopClips persistence round-trip; v0.8.1 docs load (absent = empty); stale refs preserved verbatim | unit | `pnpm --dir app exec vitest run <new loopClips persistence spec>` | ❌ Wave 0 |
| HOLD-06 | Capsule geometry/badges/zoom bands/truncation diagonal; loop-edit/source-edit dialog modes; guards (D-07/D-11/D-13) | unit (geometry/copy) + native UAT (visual) | `pnpm --dir app exec vitest run TimelineRenderer` | ✅ extend existing `TimelineRenderer.test.ts`; visual states verified by user native UAT |

### Sampling Rate

- **Per task commit:** `pnpm --dir app exec vitest run <changed-area spec>`
- **Per wave merge:** `pnpm --dir app exec vitest run`
- **Phase gate:** Full suite green + typecheck before `/gsd-verify-work`; native visual UAT (user-run) is the final oracle per project convention

### Wave 0 Gaps

- [ ] New resolver spec for loop projection: modulo mapping, real-wins precedence, next-clip boundary (3 valid kinds per D-24), loop-loop priority (D-14), zero-effective, re-expansion, half-open intervals — covers HOLD-05
- [ ] New persistence spec: loopClips round-trip save/reopen, absent-field v0.8.1 load, stale keyId verbatim preservation (D-31), Save As atomic copy — covers HOLD-05/D-29..D-31
- [ ] New determinism spec: byte-identical dataUrls across regeneration for zero and nonzero Motion — covers HOLD-02
- [ ] History/Undo spec extension: loop-only op snapshot, generation+shrink one-undo coherence (D-06/D-10) — covers HOLD-03
- [ ] No framework install needed — infrastructure exists

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Desktop app, no auth surface |
| V3 Session Management | no | No sessions |
| V4 Access Control | no | Single-user desktop |
| V5 Input Validation | yes | Strict allowlist parsers for all untrusted project-file data — the established in-repo control (`hasOnlyAllowedKeys` + throw-on-malformed). Loop Clip parsing MUST follow it; dangling references are preserved verbatim + marked unresolved (D-31), never normalized |
| V6 Cryptography | no | No crypto; determinism hashes (FNV) are fingerprints, not security primitives |
| V8 Files/Resources | yes (partial) | Project files are local user data; cache sidecar path discipline (`isSafePhysicPaintCachePath` [VERIFIED: persistence:85-89] rejects `\`, absolute, `\0`, `.`/`..` segments) is unchanged — loopClips carry no paths, so no new path surface |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed project file crashes or corrupts editor state | Tampering / DoS | Fail-closed parse: throw on malformed, preserve-but-mark-unresolved on dangling refs (D-31); never silent-drop |
| Crafted `loopClips` with huge repeat counts → memory/CPU blowup | DoS | D-32: O(1) modulo per frame, no materialized frame lists; capacity bounded at 600; safe-product validation already exists for Repeat (`parseRepeat` [VERIFIED: controller:340-353] bounds `cycleLength × repeat` to `Number.MAX_SAFE_INTEGER`) |
| Cache-path injection via project file | Tampering | Not applicable — loopClips reference keyIds, not paths; existing path guard unchanged |

## Project Constraints (from CLAUDE.md)

- **Use the project-local GSD install** from `.claude/gsd-core`; do not run the dev server (user runs it).
- **Tests:** `vitest run` only; NEVER watch mode.
- **Preact, not React:** prefer Signals (`@preact/signals`: `signal`, `computed`, `effect`) over `useState`/`useEffect`; no effect-dependency control flow; consult the `developing-preact` skill before new shared-state abstractions. Loop/dialog state should follow the existing controller-signal pattern (the Play Script controller is already signal-based [VERIFIED: controller:1 `import { computed, effect, signal, type ReadonlySignal, type Signal } from '@preact/signals';`]).
- **pnpm**, monorepo; app code in `app/`; engine in `packages/efx-physic-paint/`.
- **Engine integration must be incremental** — no batch `renderFromStrokes` (standing feedback).
- **Git index lock recovery:** `lsof .git/index.lock` check, remove only the stale lock file, stop and ask if unclear.
- **Guard shortcuts in paint mode:** `shortcuts.ts` uses `isPaintEditMode()` guards [VERIFIED: app/src/lib/shortcuts.ts:32, 422, 439, 455] — any new global shortcut for capsule actions must follow the same guard.
- **No backward compat break for old projects in v0.9.0** — additive only (memory: clean multi-track break reserved for v1.0.0; consistent with D-29).
- **Native visual UAT is the user's oracle** — plans end "automated-ready", not "done", until live UAT passes. Do not use MCP Chrome DevTools for visual checks.
- **GSD artifacts in English**; user-facing execution-chat comms in English.

## Sources

### Primary (HIGH confidence)
- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts` (read in full) — document authority, allowlists, revision fingerprint, parsers
- `app/src/lib/physicPaintPersistence.ts` (read in full) — persisted allowlists, save/hydrate mapping, sidecar path discipline
- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts` (lines 1-400, 1950-2130) — cell union, projection seam, intent union
- `app/src/stores/physicPaintStore.ts` (lines 100-160, 600-760, 1395-1503) — structural cache, render-source seam, end-frame derivation, toMceOutputs
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` (read in full) — commit path, loop readout, repeat validation
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts` (read in full) — staged render, Motion seeding, mode dispatch
- `packages/efx-physic-paint/src/animation/staticStrokeSchedule.ts` + `recordedStrokeMotion.ts` (read in full) — HOLD-01/HOLD-02 bases
- `app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts` (lines 70-200) — snapshot Undo/Redo contract
- `app/src/lib/frameMap.ts` (read in full) — fxTrackLayouts feed, dead playScriptMarkers, timeline length derivation
- `app/src/types/physicPaint.ts` (lines 55-175, 330) + `app/src/types/project.ts` (lines 30-93) — apply-payload allowlists, persisted document type
- `app/src-tauri/src/models/project.rs` (`roto_physical: Option<Value>`) — no Rust change needed
- `.planning/phases/43-*/43-CONTEXT.md`, `43-UI-SPEC.md`, `42-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md` (all read in full this session)

### Secondary (MEDIUM confidence)
- None — no external documentation was required; the phase extends in-repo seams exclusively.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies; every module path verified by direct read
- Architecture: HIGH — all four integration seams (persistence, projection, render-source, history) read at the exact line ranges cited
- Pitfalls: HIGH — each pitfall is grounded in a verified code fact quoted in this document

**Research date:** 2026-08-06
**Valid until:** 2026-09-05 (30 days; in-repo seams are stable — regression-locked by project convention)
