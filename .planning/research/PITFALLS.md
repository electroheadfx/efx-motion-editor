# Pitfalls Research

**Domain:** Milestone v1.0.0 — adding multi-track internal Paint frame documents, track-local state/caches, a deterministic internal compositor, a fixed Background track with looping clips, a photo/reference track, a Reveal mask compositor, and read-only audio preview to the shipped EFX Motion Editor (Tauri 2.0 + Preact Signals monorepo)
**Researched:** 2026-08-23
**Confidence:** HIGH — grounded in the locked milestone spec risk register, required truth tables, and forbidden sequence-level assumptions; the v0.7.0/v0.8.0/v0.9.0 post-mortems in PROJECT.md; direct inspection of the affected code seams (`paintStore.ts`, `physicPaintStore.ts`, `rotoCoordinatorPorts.ts`, `efxPaintAudioPreviewContext.ts`, `previewRenderer.ts`, `history.ts`, `physicsPaintRotoPhysicalModel.ts`); and cross-referenced against the parallel ecosystem research (multi-track compositing, loop/background, mask/reveal, audio sync). Spec/codebase-derived claims are HIGH; web-derived patterns are tagged LOW and used only to confirm prevention strategies.

This document verifies and extends the spec's risk register. Every pitfall below is specific to adding THESE features to THIS system; generic advice is intentionally omitted. The clean-break boundary and the forbidden sequence-level assumptions are respected throughout.

## Critical Pitfalls

### Pitfall 1: Track identity via array position or order field

**What goes wrong:**
Reorder, undo/redo, cache invalidation, and Reveal mask references silently retarget to the wrong track. A track moved from index 2 to index 0 suddenly owns the wrong frames; a cache keyed by `tracks[i]` returns another track's raster; a Reveal mask that referenced "track 3" now masks "track 1". This is the spec's risk #2 and the exact failure family that forced the 36.14 canonical physical-frame cutover (stable keyId, direct appFrame).

**Why it happens:**
Every current store is keyed by `layerId` only — `paintStore._frames = Map<layerId, Map<frame, PaintFrame>>`, `physicPaintStore._rotoPhysicalLoopClips = Map<layerId, ...>`. The milestone adds a track dimension, and the path of least resistance is to address tracks by their position in the `tracks` array (or by a mutable `order` field). Position is not identity: reorder rewrites it, undo/redo replays against a different array, and the compositor's stable order becomes ambiguous.

**How to avoid:**
- Stable `trackId` strings allocated at creation, never reused, never rewritten by reorder (spec identity rules). Duplicate creates fresh track, frame-key, cache, and revision identities where required.
- All store maps become `Map<layerId, Map<trackId, ...>>`; every cache key embeds `trackId` (see Pitfall 4).
- Reorder mutates only a persisted `order` field while `trackId` stays constant; the compositor sorts by `order` but never uses it as identity.
- Bridge messages carry `parentLayerId + documentRevision + trackId` (spec identity rules); async operations revalidate all three before commit (Pitfall 3).
- Fail loudly on duplicate track IDs or malformed track references (Phase 1 acceptance).

**Warning signs:**
A track's frames appearing on a different row after reorder; undo restoring the wrong track's content; a Reveal mask revealing the wrong track; cache hits returning another track's pixels.

**Phase to address:** Phase 1 (identity model locked) and Phase 2 (all store addressing)

---

### Pitfall 2: Legacy one-track schema or renderer remains reachable

**What goes wrong:**
A pre-v1.0 Paint project is silently loaded, partially converted, or routed through a legacy renderer instead of failing explicitly. The project carries a documented rule — "No backward compat for old projects: clean break on format changes; no legacy migration code" — and the spec's clean-break section is explicit: no legacy one-track schema reader, no converter, no compatibility shim, no old-project renderer, no second cache/history path. The failure mode is a "temporary" compat branch that becomes permanent dual maintenance (spec risk #3).

**Why it happens:**
`paintStore` and `physicPaintStore` are live, working, single-track paths. Deleting or making them unreachable feels destructive, so teams keep them behind a version check "just in case." The schema-evolution research confirms the worst failure is silent: a field that changes meaning while keeping its name/type passes every validator, and a partial-loading path returns "the subset that happens to be done" — a correctness bug that looks like a relevance problem.

**How to avoid:**
- Delete or make unreachable the old one-track renderer and old Paint persistence path (Phase 1 requirement). Grep for reachable legacy entry points as a contract test.
- Reject pre-v1.0 Paint data explicitly at the load boundary: fail loudly, no partial mutation, no fallback rendering (Phase 1 acceptance + UAT step 2).
- No "temporary" second cache/history path for legacy data — the spec forbids it and the project's clean-break rule forbids it.
- The rejection must be loud and testable: a fixture that asserts the explicit failure, not a silent no-op.

**Warning signs:**
A version check that routes old data to a "compat" branch; a legacy file still referenced by the renderer; a test that loads old project data and "works"; a `// TODO: remove legacy` comment in the load path.

**Phase to address:** Phase 1

---

### Pitfall 3: Stale async commit to wrong track

**What goes wrong:**
An async PlayScript/Reveal/Background-import operation started against track A completes after the user has switched to track B (or deleted/reordered A) and commits its result to B — or to a deleted track, orphaning accepted assets. Data corruption, spec risk #4, and a release stop condition ("Stale work commits to the wrong track").

**Why it happens:**
The current async authority model is layer-scoped: the ownership/lease model and the Phase 41 revision guard (`applyRevisionedEfxPaintAudioPreview` — strict newer-than revision, single application funnel) guard against stale *layer* context. The milestone adds a *track* dimension; an async job that captures `layerId` but not `trackId + documentRevision` at launch time commits against whatever track is active when it lands.

**How to avoid:**
- Async authority checks include parent, document, AND track revision (Phase 2 requirement). Reuse the proven generation-guard idiom from Phase 41 rather than inventing a second mechanism — one staleness idiom for the whole milestone.
- Bridge messages carry `parentLayerId + documentRevision + trackId`; apply updates only when `incoming.revision > applied.revision` AND the track still exists and is still the target.
- Track deletion must fail-closed: an in-flight job targeting a deleted track is rejected, never silently redirected to the active track.
- The spec's "Async PlayScript/Reveal operations revalidate both document and track revision before commit" is a Phase 2 entry artifact, not an implementation afterthought.

**Warning signs:**
A PlayScript application landing on the wrong row after a quick track switch; a Reveal result appearing on a track the user never selected; an undo that removes content from a track the user wasn't editing.

**Phase to address:** Phase 2

---

### Pitfall 4: Track-local cache keys missing trackId (and a single global paintVersion)

**What goes wrong:**
Cross-track cache pollution: editing track A invalidates or returns track B's cached raster. The current `_frameFxCache` is keyed `"layerId:frame"` and `paintVersion` is a single global counter. With multiple tracks, a key that omits `trackId` returns the wrong track's pixels, and a single global `paintVersion` either over-invalidates (correct but wasteful — every row re-renders on any track edit) or, worse, a consumer that assumes "the" track changed misses the real change.

**Why it happens:**
The single-track model has no track dimension, so every key and every reactivity signal is implicitly "the one track." Adding tracks without threading `trackId` through every key and every invalidation path is the natural first draft.

**How to avoid:**
- Every cache key embeds `trackId`: `"layerId:trackId:frame"` for paint frames, `"layerId:trackId:frame:real:<keyId>"` for Roto caches (the physical model already scopes cache revision as `${contentRevision}:real:${sourceKeyId}` — extend the same discipline with trackId).
- Track cache key includes track revision AND composition dependencies (Phase 4 requirement): the flattened parent cache invalidates when any participating internal track, Background clip, source image, or fallback changes.
- Track-aware invalidation: editing one track never changes another track's real keys or caches (Phase 2 acceptance). The `paintVersion` counter must be bumped per-track (or the reactivity model made track-aware) so Studio re-renders the right row.
- Follow the project's proven rule — "Always bump AND subscribe to paintVersion" — but now per-track, and subscribe in render effects keyed to the active track.

**Warning signs:**
Editing track A causing track B's thumbnail to flicker or clear; a cache hit returning another track's pixels; a render effect that re-renders all rows on any track edit.

**Phase to address:** Phase 2 (keys and reactivity), Phase 4 (composition cache)

---

### Pitfall 5: Undo/redo targeting the wrong track (per-track stacks)

**What goes wrong:**
Ctrl+Z undoes the last thing on the *selected* track instead of the last thing the user did. The project's `history.ts` is a global command-pattern stack (pushAction/undo/redo with coalescing) — the correct model. The pitfall is introducing per-track undo stacks "so each track has its own history," which breaks the user's mental model and the existing 100+ level global undo.

**Why it happens:**
With multiple tracks, it feels natural to give each track its own undo history. The undo research is explicit: "One stack, not one per layer — Ctrl+Z must undo the last thing the user did, not the last thing on the selected layer." Per-track stacks also misread the spec's "Undo/redo targets the exact internal track" acceptance — that means the *snapshot* must capture the exact track, not that each track owns a stack.

**How to avoid:**
- Keep ONE global undo stack. Each entry's undo/redo closure captures the exact `layerId + trackId + documentRevision` it mutated (reference-based, not raster bytes — see Pitfall 17).
- Undo snapshots metadata and asset references, not large PNG bytes (spec asset/history rules). The existing snapshot/restore with structuredClone pattern extends to track-scoped state.
- Track CRUD (add/rename/duplicate/delete/reorder) is one atomic history command with exact pre-op selection restore on Undo/Redo — the Phase 43.6 batch-op precedent.
- Deleting a track must not orphan accepted assets silently (Phase 2 acceptance): the delete command's undo restores the track and its references.

**Warning signs:**
Undo requiring two steps to remove one operation; undo restoring a different track's content; a per-track undo button appearing in the UI.

**Phase to address:** Phase 2

---

### Pitfall 6: Parent opacity/blend double-applied (and opacity/blend order divergence)

**What goes wrong:**
The internal compositor applies the parent Paint layer's opacity/blend, and then the main editor's PreviewRenderer applies it again — a double visual effect. The spec is explicit: "Internal track opacity/blend is applied once inside EFX Paint. Parent Paint layer opacity/blend is applied once by the main editor after flattening. Parent opacity/blend must never be copied into internal tracks." Release stop condition: "Parent opacity/blend is double-applied."

**Why it happens:**
The PreviewRenderer composites each outer layer with `globalCompositeOperation = blendModeToCompositeOp(layer.blendMode)` and `globalAlpha = effectiveOpacity` (previewRenderer.ts:457-459, 477-478, etc.). If the internal compositor "helpfully" bakes the parent's opacity/blend into the flattened raster, the parent layer's own opacity/blend is applied a second time downstream. The NLE research confirms the order-of-operations trap: FCP applies opacity before composite mode, Resolve after — the same grade looks different on conform. The internal compositor must lock its opacity/blend order once and never let parent properties leak in.

**How to avoid:**
- The internal compositor produces a FLAT raster with internal track opacity/blend applied once, in a locked order (decide: opacity before blend, AE convention, and document it). Parent opacity/blend/transform are applied by the unchanged main-editor compositor exactly once.
- Contract test: parent 50% opacity + internal track 50% opacity must produce 25% effective — not 12.5% (parent applied internally too) and not 50% (internal opacity lost). The pixel acceptance matrix includes "Parent Paint opacity/blend over other outer main-editor layers."
- Never copy parent properties into internal tracks; the internal compositor reads only document-owned state.

**Warning signs:**
A parent layer whose opacity/blend visibly changes when internal track settings change; a multiply-blend parent that looks squared; a parent at 50% + internal at 50% rendering at ~12.5%.

**Phase to address:** Phase 4

---

### Pitfall 7: Premultiplied alpha double-application (dark halos)

**What goes wrong:**
The flattened parent raster is premultiplied twice (or straight alpha is treated as premultiplied), producing dark halos around semi-transparent edges. The DaVinci Resolve manual calls this "Double Premultiplied RGBA Means Double Trouble" — multiplying gray semi-transparent pixels twice darkens edges. This corrupts the flattened output, transparent gaps, and Reveal soft edges.

**Why it happens:**
The pipeline has multiple alpha-bearing surfaces: per-track caches (PNG alpha encodings), the flattened parent raster, and the outer compositor. Each stage may premultiply or un-premultiply; a mismatch at any seam double-applies the alpha.

**How to avoid:**
- Define the alpha convention once (straight vs premultiplied) at the flattened-raster boundary and enforce it with a pixel test: a 50%-alpha white pixel must composite as 50% white, not a dark gray.
- Reuse the existing Roto PNG alpha encoding unchanged — do not add a "smaller/faster" encoding for loop sources (cache-footprint compression is explicitly deferred debt, not v1.0.0 scope).
- The internal compositor and the outer PreviewRenderer must agree on the alpha state of the flattened raster.

**Warning signs:**
Dark fringes around semi-transparent strokes, gaps, or Reveal soft edges; a 50%-alpha pixel rendering darker than expected; differences between Studio and export at alpha boundaries.

**Phase to address:** Phase 4

---

### Pitfall 8: Studio/main/export divergence (one composition authority)

**What goes wrong:**
The Studio flattened preview, the main-editor preview, and the export produce different pixels. Release stop conditions: "Studio and parent flattened output differ," "Background gaps/fallback differ between Studio, main preview, and export," "Reveal differs between Studio, main preview, and export."

**Why it happens:**
The milestone touches three surfaces (Studio, main preview, export) that historically have separate render paths. If the internal compositor is re-implemented per surface (or the Background resolver is duplicated), the surfaces drift — the exact failure family that forced the "one flattened composition authority" rule.

**How to avoid:**
- One shared internal composition path for Studio preview and flattened output (Phase 4 requirement). No direct internal-track iteration in the main renderer.
- One resolver owns Background effective-duration computation; the filmstrip badge, the interruption label, and the flattened output all DERIVE from it — never compute display duration separately from resolution duration (the v0.9.0 Pitfall 6 lesson, carried forward).
- The pixel acceptance matrix is the gate: Studio flattened pixels, main preview, and export must satisfy the existing pixel tolerance policy for every row of the matrix.

**Warning signs:**
A gap that shows solid fallback in Studio but transparency in export; a Reveal that looks different in the main preview; a Background clip that resolves different source frames on later repeats.

**Phase to address:** Phase 4 (compositor), Phase 5 (Background), Phase 8 (Reveal)

---

### Pitfall 9: Loop repetitions expand into duplicate assets

**What goes wrong:**
A 5-image cycle repeated 3 times stores 15 durable images instead of 5 linked references; editing one source frame updates only some occurrences. Storage growth and broken linked edits — spec risk #6, release stop condition ("Hold or Background repetitions duplicate durable source assets or resolve different source frames on later repeats").

**Why it happens:**
The Phase 43 Hold Loop Clip model already solved this for Hold clips: "one compact derived interval record, lazy per-frame query, no virtual occurrence is ever materialized." The Background track reuses the same linked source-frame reference + modulo resolver. The pitfall is re-implementing Background loops as expanded frame lists "because Background is simpler."

**How to avoid:**
- Repetitions reuse linked source-frame references and never duplicate durable images (spec Background rules). `sourceIndex = (applicationFrame - startFrame) mod cycleLength` with the offset applied BEFORE the modulo.
- Editing one Hold/Background source frame updates every linked occurrence without duplicating assets (Phase 2 acceptance).
- The filmstrip renders the source cycle + a hatched repetition band; expand linked cells only at high zoom and only within the viewport (v0.9.0 M1 lesson).

**Warning signs:**
Disk usage growing with repeat count; a source-frame edit not propagating to all occurrences; the filmstrip materializing per-occurrence cells.

**Phase to address:** Phase 2 (shared Loop Clip resolver), Phase 5 (Background)

---

### Pitfall 10: Next-clip interruption off-by-one

**What goes wrong:**
A finite loop of `cycleLength × repeatCount` overlaps the next clip by one frame, leaves a one-frame gap, or a partial-cycle interruption renders the wrong source frame. Adjacent clips flicker or double-render at the seam; save/reopen shifts boundaries by one. Spec risk #7, release stop condition ("Background clips overlap, ignore the next-clip boundary, mishandle partial cycles").

**Why it happens:**
Loop effective duration is computed in multiple places (resolution, filmstrip, boundary recalculation on next-clip move/remove). If any site mixes inclusive ends with exclusive ends — or computes `start + cycleLength * count` and then compares with `<=` against the next clip start — the seam frame is wrong. The loop research confirms the seam class: Harmony's Transform-Loop skips the first frame on repeat to avoid two identical consecutive frames; Unity requires start/end pose match for smooth next-clip transitions.

**How to avoid:**
- Lock the convention once: all loop regions are half-open `[startFrame, startFrame + effectiveDuration)`; the next clip's start is its first owned frame and has priority; a loop's last resolved frame is `min(nextClipStart, parentEnd, start + requestedDuration) - 1` (spec Background rules).
- Truth-table tests before implementation (the project's proven "truth table before patches" rule): full cycles exactly meeting the next clip, interruption mid-cycle (partial final cycle), interruption at the exact boundary (zero partial), infinite loop to parent end, next-clip removal re-extending to requested/infinity, single-frame cycle (`cycleLength = 1`).
- One resolver function owns effective-duration computation; the filmstrip badge and the interruption label both derive from it.

**Warning signs:**
A one-frame gap visible when scrubbing the seam; a badge showing 15f while resolution produces 14 or 16 frames; overlap only when `cycleLength` does not divide the interruption offset.

**Phase to address:** Phase 5 (convention locked at Phase 3 UI design so the filmstrip and resolver share it)

---

### Pitfall 11: Infinite loop stored as a huge expanded range

**What goes wrong:**
An infinite loop (or a 10,000-frame finite loop) is materialized as an expanded frame range, causing unbounded data, slow saves, and filmstrip blowup. Spec risk #8, release stop condition ("lose requested repeat count after reopen").

**Why it happens:**
The Phase 43 model already stores infinity as metadata and derives effective end — "Requested repeat count is authoritative. Effective end/duration/cycle count are derived from the next clip and parent end rather than stored as independent truth." The pitfall is storing the derived effective range as durable state, which then goes stale when the next clip moves.

**How to avoid:**
- Store `repeat: { mode: 'infinite' }` (or finite count) as metadata; derive effective duration at resolve/render time from `min(nextClipStart, parentEnd, start + requestedDuration)`.
- Moving the next clip later lets the previous loop expand again up to its requested count or indefinitely; deleting the next clip lets an infinite loop continue to parent end — all by re-derivation, never by stored range.
- Requested repeat count remains stored even while effective duration is shortened (spec Background rules).

**Warning signs:**
A save file growing with repeat count; a filmstrip rendering cells for an ∞ loop; a "recalculate effective range" code path that writes back to the document.

**Phase to address:** Phase 5

---

### Pitfall 12: Background track overlaps or moves above Paint

**What goes wrong:**
Background clips overlap (silently stacking instead of rejecting), or the Background track is reordered above Paint tracks, producing ambiguous composition. Spec risk #9, release stop conditions ("Background clips overlap," "Background can be reordered above Paint tracks or is confused with the photo/reference track").

**Why it happens:**
The Background track is "just another track" in the first draft, so it inherits the Paint track reorder/overlap rules. The spec is explicit: exactly one Background track at a fixed position beneath all internal Paint tracks; clips never overlap; move/insert operations reject or snap collisions rather than silently stacking.

**How to avoid:**
- One fixed bottom row with collision rejection (spec Background rules). Move/insert operations reject or snap collisions; never silently stack clips.
- The Background track cannot be reordered above Paint tracks — enforce at the model level, not just the UI.
- Keep Background visually distinct from Paint rows and from the photo/reference track (Phase 3 requirement).

**Warning signs:**
Two clips rendering on top of each other; a Background row that can be dragged above a Paint row; a user confusing Background with the photo/reference track.

**Phase to address:** Phase 3 (timeline), Phase 5 (model)

---

### Pitfall 13: Background gaps differ across outputs

**What goes wrong:**
A gap shows solid fallback in Studio but transparency in export (or vice versa). Spec risk #10, release stop condition ("Background gaps/fallback differ between Studio, main preview, and export").

**Why it happens:**
The fallback (solid color or transparency) is resolved in multiple places. The compositing research confirms the hidden-black-layer trap: multi-track compositors that introduce an implicit opaque black layer make transparency unexportable. If the internal compositor defaults to an opaque background when the fallback is transparent, gaps render black in export.

**How to avoid:**
- One compositor path resolves the document fallback (solid or transparent) and the Background contribution; gaps reveal the fallback consistently across Studio, flattened parent output, main preview, and export (spec Background rules).
- Transparent gaps use a checkerboard in the UI; solid fallback gaps use the configured color swatch — both are VIEW projections of the same fallback state, never a second source of truth.
- The pixel acceptance matrix includes "Background gap over solid fallback and transparency."

**Warning signs:**
A gap that shows checkerboard in Studio but black in export; a fallback color that renders differently across surfaces; a "transparent" gap that exports as opaque.

**Phase to address:** Phase 4 (compositor), Phase 5 (Background)

---

### Pitfall 14: Reference photo leaks into output

**What goes wrong:**
The photo/reference track, visible as a painting reference, accidentally enters the flattened parent output. Spec risk #12, release stop conditions ("Reference-only photo pixels leak into output," "Photo reference visibility alone never leaks into output").

**Why it happens:**
The track-matte research confirms the classic leak: the matte/reference layer's visibility is auto-disabled when used as a source, and re-enabling it (or forgetting to disable it) leaks it into preview AND final render. The spec is explicit: "The photo/reference track must not automatically become visible in the parent output merely because it is visible as a painting reference."

**How to avoid:**
- Explicit source mode (`reference-only` / `reveal-source` / `masked-transform-source`) and exclusion tests (spec Phase 6 requirements). Toggling reference visibility does not alter ordinary flattened output.
- The reference track has separate reference/source visibility semantics from Paint tracks; it never enters the flattened output except through an explicit Reveal result.
- The Reveal mask compositor uses the source BEFORE the mask is applied; the Reveal result is written to an internal Paint/result track, and the source itself stays out of the flattened output.

**Warning signs:**
A reference photo appearing in the main preview or export; toggling reference visibility changing the flattened output; a Reveal that includes the reference overlay.

**Phase to address:** Phase 6 (reference track), Phase 8 (Reveal)

---

### Pitfall 15: Audio preview drift or mutation

**What goes wrong:**
Multi-track Paint playback drifts from main-editor audio, or the read-only audio preview mutates main-editor audio state. Spec risk #14, release stop conditions ("Audio preview mutates main-editor audio or drifts").

**Why it happens:**
The Phase 41 audio preview already solved the single-track case: read-only revisioned context, anchor model, silent scrub, loop-wrap re-seek, 40ms drift correction, doubled-audio ownership guard. The multi-track milestone must not regress it. The audio research confirms the root cause: each AudioContext runs its own clock (currentTime advances per render quantum and falls behind permanently under CPU contention/GC/backgrounding); two contexts in separate WebViews drift apart. The pitfall is re-introducing a second clock or a second engine.

**How to avoid:**
- Reuse the Phase 41 anchor model unchanged: main-editor audio remains authoritative and read-only; EFX Paint receives read-only synchronized preview context; internal track playback and audio preview share the same application-frame cursor.
- On loop wrap, restart sources at the loop-start audio offset — never "rewind" a running AudioBufferSourceNode (the Godot audio self-overlap lesson: a looping animation with an audio track self-overlaps unless the sound is stopped at the end offset).
- Track hide/solo does not alter audio unless a separately explicit monitor rule is locked (Phase 7 requirement).
- Closing Studio releases audio resources; no doubled playback engine (Phase 7 requirement).

**Warning signs:**
Sync correct at frame 0 but late after 30+ seconds; audio continuing after the EFX Paint window closes; a hide/solo change altering audio; two AudioContext instances in the same monitoring session.

**Phase to address:** Phase 7

---

### Pitfall 16: Reveal includes preview overlays (mask source isolation)

**What goes wrong:**
The Reveal mask compositor reads the reference overlay (onion skin, reference visibility, preview base) instead of the isolated source, so the flattened output includes preview-only pixels. Spec risk #16, release stop condition ("Reveal differs between Studio, main preview, and export").

**Why it happens:**
The track-matte research confirms the render-order trap: effects on the matte layer may be computed before the matte is created, and the matte source layer's visibility state leaks into the matte. The spec is explicit: "Preview base/reference overlays remain distinct from durable output" and "Mask source isolation and truth-table tests."

**How to avoid:**
- One offscreen source-plus-mask compositor shared by Studio and flattened output (Phase 8 requirement). The mask reads the isolated source frame, never the composited preview.
- Explicit alpha versus luma interpretation; optional inversion; deterministic feather only if preview/export parity is maintained.
- Stable source-track and mask-track references; revision invalidation; missing source/mask recovery.
- Undo/redo by reference, not raster-byte snapshots (Pitfall 17).
- Truth-table tests: empty mask reveals nothing; full mask reveals the entire source; partial alpha produces expected soft edges; eraser removes revealed coverage; progressive/static behavior matches PlayScript semantics.

**Warning signs:**
A Reveal that includes the onion-skin or reference overlay; a Reveal that changes when reference visibility toggles; soft edges that differ between Studio and export.

**Phase to address:** Phase 8

---

### Pitfall 17: Raster bytes copied into undo

**What goes wrong:**
Undo snapshots store large PNG/canvas bytes instead of references, causing memory growth and slow undo/redo. Spec risk #15, spec asset/history rules: "Undo snapshots metadata and asset references, not large PNG bytes."

**Why it happens:**
The existing history.ts uses snapshot/restore with structuredClone. With multiple tracks and caches, the temptation is to snapshot the flattened raster or the per-track caches "for safety." The undo research confirms the byte-budget lesson: deltas, not snapshots, keep undo memory bounded.

**How to avoid:**
- Undo entries capture metadata and asset references (trackId, frame, element IDs, revisions), not raster bytes. The existing command-pattern undo extends to track-scoped state.
- Track deletion's undo restores the track and its references, not its cached rasters (caches are rebuildable).
- Generated interpolation/caches are rebuildable; durable real keys and accepted local assets are authoritative (spec asset/history rules).

**Warning signs:**
Memory growing with undo depth; undo/redo visibly slow on large frames; a snapshot containing `HTMLCanvasElement` or PNG bytes.

**Phase to address:** Phase 2

---

### Pitfall 18: Scope creep via forbidden sequence-level assumptions

**What goes wrong:**
The milestone grows into a main-editor rewrite: internal tracks appear as main-editor timeline rows, `Sequence.frameTracks` is introduced, multiple key-photo streams appear, internal track offsets determine sequence duration, or the photo/reference/Background tracks become main-editor content tracks. This is the documented project failure pattern: Phases 27-32 died of adapter over-reach; Phase 36.2 died of unbounded ambition.

**Why it happens:**
Each feature legitimately touches a deep seam (paint store, Roto store, compositor, audio bridge), and "while we're in here" refactors present themselves. The spec's Forbidden sequence-level assumptions list exists precisely because these temptations are predictable.

**How to avoid:**
- Enforce the locked ownership boundaries as review gates: the main editor owns sequences/layers/audio and stays unchanged; multi-track means internal Paint frame tracks inside one opened EFX Paint document; all internal tracks share the parent application-frame axis and never change main-editor sequence duration.
- No `Sequence.frameTracks`, no multiple key-photo streams, no main-editor rows for internal tracks, no direct main-renderer iteration over internal Paint tracks, no Reveal result as a new main-editor sequence track.
- Small surface, deep reuse: the milestone's wins come from reusing the deterministic physical-frame model, the atomic commit path, the finalizeProposal authority, the Loop Clip resolver, and the Phase 41 audio anchor model — new code should be thin adapters over proven paths.

**Warning signs:**
Phase plans whose file lists span more than two subsystems; new persisted fields without a spec line; "temporary" parallel implementations flagged for later cleanup; a phase UAT script longer than the feature's user stories.

**Phase to address:** All phases (roadmap-level guard); Phase 9 stop conditions are the enforcement backstop

---

## Moderate Pitfalls

### Pitfall M1: Duplicate track orphaning Reveal/mask relationships
**What goes wrong:** Duplicating a track that is a Reveal mask source leaves an invisible orphaned mask that changes whatever lands beneath it (the AE "duplication time bomb").
**Prevention:** Duplicate creates fresh track, frame-key, cache, and revision identities (spec identity rules); Reveal source/mask references are re-pointed or explicitly broken on duplicate, never silently inherited.
**Phase:** 2

### Pitfall M2: Active-track routing gaps
**What goes wrong:** Paint, Roto, PlayScript, Cut/Copy/Paste, and drag operations read "the" track instead of the active track, mutating the wrong row.
**Prevention:** Route all operations through the active track ID; the active track is always visually unambiguous (Phase 3 acceptance); timeline interactions never mutate another row accidentally.
**Phase:** 3

### Pitfall M3: Compositor order determinism after save/reopen
**What goes wrong:** The internal composition order changes after save/reopen because it was derived from array position or an unpersisted field.
**Prevention:** Persist the order field; reorder changes compositor order but not track identity (Phase 3 acceptance); internal composition order is deterministic and stable after save/reopen (spec opacity/blend rules).
**Phase:** 3-4

### Pitfall M4: Background source-frame revision not invalidating caches
**What goes wrong:** Editing a Background source image (or a Hold source frame) does not invalidate the Background cache, so repeats resolve stale pixels.
**Prevention:** Background resolution cache includes track revision, active clip revision, source-frame revision, fallback, next-clip boundary, and parent end (Phase 4 requirement); source revision invalidates dependent Reveal/transformation results (Phase 6 requirement).
**Phase:** 4-5

### Pitfall M5: Photo/reference frame-aligned source resolution
**What goes wrong:** The reference changes over time but the source frame is resolved once at import, so Reveal uses the wrong frame.
**Prevention:** Frame-aligned source resolution where the reference changes over time (Phase 6 requirement); Reveal uses the exact referenced source frame.
**Phase:** 6

### Pitfall M6: Missing source/asset treated as silent transparency
**What goes wrong:** A missing durable asset renders as transparent instead of an explicit recoverable error, hiding the failure.
**Prevention:** A missing durable asset is an explicit recoverable error, not silent transparency (spec empty-frames rules); missing source/asset states are explicit and recoverable (Phase 4 requirement).
**Phase:** 4

### Pitfall M7: Generated interpolation/cache absence confused with missing real key
**What goes wrong:** A track with no generated interpolation at a frame is treated as a missing real key (or vice versa), producing wrong empty/error states.
**Prevention:** Generated interpolation/cache absence must not be confused with a missing real key (spec empty-frames rules); preserve the real-key/cache boundary per track (spec risk #5).
**Phase:** 2

### Pitfall M8: Hide/solo truth table drift
**What goes wrong:** Studio preview and flattened output apply different hide/solo rules (e.g., hide wins over solo in one, not the other).
**Prevention:** Lock the truth table once (no solo → all visible; one or more solo → only visible+soloed; hide wins over solo) and use it in both Studio and flattened output (spec hide/solo rules).
**Phase:** 3-4

## Minor Pitfalls

### Pitfall m1: Shipping the banned term `clip bloquant`
**Prevention:** UI copy gate: `clip suivant — interrompt la boucle` / `Boucle raccourcie par le clip suivant` only; grep for the banned string in Phase 3 review. (User-facing copy is French; GSD artifacts stay English per project convention.)
**Phase:** 3

### Pitfall m2: Requested vs effective duration hidden from the user
**Prevention:** Badge always shows requested (`Cycle 5f × 3 = 15f` or `× ∞`); the shortened state is a distinct visual + label. Both derive from the single resolver (Pitfall 10).
**Phase:** 3

### Pitfall m3: Background/photo-reference visual confusion
**Prevention:** Keep photo/reference, Background, and audio-preview surfaces visually distinct from editable Paint rows (Phase 3 requirement); the Background row is fixed and labeled.
**Phase:** 3

### Pitfall m4: Shortcut conflicts in the new controls
**Prevention:** Project rule — global shortcuts must check `isPaintEditMode()` and guard input focus (documented S-key debt exists from v0.6.0; do not add a second instance).
**Phase:** 3

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Track identity via array index | No ID allocation | Reorder/history/cache corruption | Never (spec-locked) |
| Legacy one-track path behind a version check | Old projects "still work" | Permanent dual maintenance; silent partial loads | Never (clean-break spec) |
| Per-track undo stacks | "Each track has its own history" | Breaks global undo; wrong-track undo | Never — one global stack |
| Materializing loop repetitions as durable frames | Simpler resolver | Asset duplication, broken linked edits, cache bloat | Never — linked references are the feature |
| Storing derived effective loop range | Faster filmstrip | Goes stale on next-clip move; unbounded data | Never — derive at resolve time |
| Baking parent opacity/blend into the flattened raster | "Simpler" compositor | Double visual effect | Never (spec-locked) |
| Re-implementing the compositor per surface | Faster Studio iteration | Studio/main/export divergence | Never — one composition authority |
| Snapshotting raster bytes in undo | "Safe" undo | Memory growth; slow undo/redo | Never — reference-based history |
| Reusing one EfxPaintEngine across track renders | Faster render | p5.brush module-state bleed → non-determinism | Never — fresh engine per render (current contract) |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Tauri cross-window events (`physic-paint:*`) | Fire-and-forget emits; unawaited unlisten on unmount | Revisioned payloads carrying `parentLayerId + documentRevision + trackId`; identity guards; awaited unlisten (G-01 pattern) |
| Asset transport to child window (Background/photo sources) | Assuming the main window's asset protocol/CSP grants apply | Explicit secure transport; CSP grant guarded by contract test (v0.8.1 `img-src data:` precedent) |
| Web Audio in second WebView | One AudioContext assumption; gesture-less autoplay | Per-window context, resume inside user-gesture handler, close on window close (Phase 41 anchor model) |
| `audioEngine` one-shot sources | Seeking by rewinding a running source | stopAll + restart at offset (existing `playbackEngine` pattern); loop-wrap re-seek |
| `finalizeProposal` authority | Track/Background ops bypassing the single mutation path | Track CRUD and Background clip ops are atomic acknowledged transactions like Phase 37/43.6 group ops |
| `.mce` persistence | Writing migration shims for old projects | Clean break per project rule — but reopen determinism is mandatory |
| PreviewRenderer outer compositing | Internal compositor baking parent opacity/blend | Internal compositor produces a flat raster; parent applies opacity/blend exactly once |
| Loop Clip resolver | Background loops re-implemented separately from Hold loops | One shared resolver for Hold and Background sources (spec: shared linked Loop Clip semantics) |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Per-frame filmstrip cells for long/∞ loops | Timeline jank at high repeat counts | Hatched band + viewport-windowed expansion | Loop beyond a few hundred frames |
| Flattened parent cache invalidated on any track edit | Playback stutter on multi-track documents | Track cache key includes track revision + composition dependencies; per-track invalidation | 3+ tracks with heavy content |
| Single global `paintVersion` over-invalidation | All rows re-render on any track edit | Track-aware reactivity; subscribe keyed to active track | 3+ tracks |
| Raster bytes in undo snapshots | Memory growth with undo depth | Reference-based history | Large frames, deep undo |
| Background source decode per repeat | Slow playback on repeated sequences | Decode source cycle once; repetitions are references | Long sequences |
| Re-rendering the source cycle per occurrence | Flicker and CPU spikes | Only the source cycle is rendered once; repeats resolve by modulo | Any repeat > 1 |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Loosening CSP in the child window to load Background/photo sources "quickly" | Packaged-app XSS surface; repeats the v0.8.1 CSP scramble | Explicit minimal grant + contract test (img-src data: precedent) |
| New IPC/transport command without payload validation | Malformed track/Background payload crashes the child window | Validate revisioned payload at the bridge boundary; reject stale/unknown revisions |
| Background/photo source resolution without provenance checks | Loading arbitrary paths as sources | Secure asset resolution (Phase 6 requirement); provenance-locked transport |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| `clip bloquant` wording | User thinks a clip is an error/obstacle | `clip suivant — interrompt la boucle` explains the mechanism |
| Loop silently shortened | User exports fewer frames than requested | `Boucle raccourcie par le clip suivant` label + diagonal end cap |
| Active track ambiguous | User paints on the wrong row | Active track always visually unambiguous; ensure-active-track visibility on scroll (Phase 3) |
| Background/photo-reference confusion | User thinks the reference is the background | Distinct visual surfaces; fixed labeled Background row |
| Hide/solo behavior inconsistent with expectations | User can't isolate a track | Locked truth table; hide wins over solo; solo is an isolation filter |
| Reference photo leaking into output | User exports a composite with the reference baked in | Explicit source mode; exclusion tests; reference visibility never alters flattened output |

## "Looks Done But Isn't" Checklist

- [ ] **Track identity:** Reorder works — verify track IDs are unchanged after reorder, undo/redo restores the exact track, and Reveal mask references still point at the same track.
- [ ] **Clean break:** New v1.0 document works — verify a pre-v1.0 Paint fixture fails explicitly with no partial mutation and no reachable legacy renderer (grep contract test).
- [ ] **Stale async:** PlayScript/Reveal works on the active track — verify a job started on track A cannot commit to track B after a quick switch (revision + trackId guard test).
- [ ] **Cache isolation:** Editing track A — verify track B's caches and thumbnails are untouched (per-track cache key test).
- [ ] **Parent opacity/blend:** Parent at 50% opacity + internal track at 50% — verify 25% effective, not double-applied (pixel matrix).
- [ ] **Loop seams:** Badge says 15f — verify the resolver produces exactly 15 frames, only 5 durable assets exist, repeat-count edit regenerates nothing, and save/reopen preserves all of it.
- [ ] **Partial-cycle interruption:** Boundary case interrupts mid-cycle — also verify interruption exactly AT a cycle boundary (zero partial) and a 1-frame cycle.
- [ ] **Infinite loop:** Set to ∞ — verify no expanded range is stored, the filmstrip doesn't materialize cells, and moving/deleting the next clip re-derives deterministically.
- [ ] **Background gaps:** Transparent gap — verify checkerboard in Studio AND transparency in export (no hidden black layer).
- [ ] **Reference exclusion:** Reference visible while painting — verify the flattened output is unchanged when reference visibility toggles.
- [ ] **Audio sync:** Correct at frame 0 — verify at 30s+ sustained playback, after a mid-play seek, and across a loop wrap. All three are separate failure modes.
- [ ] **Reveal isolation:** Reveal renders correctly — verify the onion-skin/reference overlay is not in the mask, and Studio/main/export match.
- [ ] **Undo memory:** Undo works — verify no raster bytes in snapshots and memory is bounded with depth.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Track identity corruption post-release | HIGH | Stable IDs are structural — revert to ID-based addressing; persisted regions are trackId-based so no data migration if caught early |
| Legacy path re-enabled | MEDIUM | Re-delete the legacy path; the grep contract test makes the revert safe |
| Stale async commit | HIGH (data corruption) | Revalidate document+track revision before commit; fail-closed on deleted track; restore from undo if the corruption is recent |
| Double-applied parent opacity/blend | MEDIUM | Remove parent-property baking from the internal compositor; pixel-matrix regression gate |
| Loop off-by-one post-release | HIGH | Resolver is pure/derived — fix the one function; persisted regions are physical-frame based so no data migration |
| Reference leak into output | MEDIUM | Explicit source-mode exclusion; the exclusion test catches it before release |
| Audio drift | MEDIUM | Reuse the Phase 41 anchor model; loop-wrap re-seek; drift correction |
| Reveal overlay leak | MEDIUM | Mask source isolation; truth-table tests |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1. Track identity via array position | Phase 1 (model), Phase 2 (addressing) | Stable-ID tests; reorder preserves identity; duplicate-track-ID fail-loud test |
| 2. Legacy schema reachable | Phase 1 | Grep contract test; pre-v1.0 fixture fails explicitly (UAT step 2) |
| 3. Stale async commit | Phase 2 | Revision+trackId guard tests incl. track-switch and track-delete races |
| 4. Cache key missing trackId | Phase 2 (keys), Phase 4 (composition cache) | Per-track cache isolation test; track-aware paintVersion test |
| 5. Undo targeting wrong track | Phase 2 | One global stack; undo restores exact track; track CRUD one-undo test |
| 6. Parent opacity/blend double-applied | Phase 4 | Pixel matrix: parent 50% + internal 50% = 25% |
| 7. Premultiplied alpha | Phase 4 | 50%-alpha pixel test; no dark halos |
| 8. Studio/main/export divergence | Phase 4 (compositor), 5 (Background), 8 (Reveal) | Pixel tolerance across all three surfaces |
| 9. Loop asset duplication | Phase 2 (resolver), Phase 5 (Background) | 5-image × 3 repeat = 5 durable assets test |
| 10. Next-clip off-by-one | Phase 5 (convention locked Phase 3) | Boundary truth-table tests incl. exact-boundary and 1-frame cycle |
| 11. Infinite loop expanded range | Phase 5 | No expanded range stored; re-derivation on next-clip move/delete |
| 12. Background overlap/reorder | Phase 3 (timeline), Phase 5 (model) | Collision rejection test; fixed bottom row test |
| 13. Background gaps differ | Phase 4 (compositor), Phase 5 (Background) | Solid/transparent gap matrix across surfaces |
| 14. Reference leak | Phase 6 | Reference visibility toggle does not alter flattened output |
| 15. Audio drift/mutation | Phase 7 | Sustained-playback, seek, loop-wrap sync tests; read-only authority test |
| 16. Reveal overlay leak | Phase 8 | Mask source isolation; alpha/luma truth table |
| 17. Raster bytes in undo | Phase 2 | Reference-based history; memory-bounded undo test |
| 18. Scope creep | All (roadmap guard) | Phase file-list review; Phase 9 stop conditions |
| M1-M8 moderate pitfalls | Per pitfall (mostly 2/3/4/5) | Per-pitfall tests listed above |

## Sources

- `SPECS/milestone-v1.0.0-plan.md` — risk register (verified and extended here), locked ownership boundaries, required truth tables, forbidden sequence-level assumptions, stop conditions (HIGH confidence — user-approved spec)
- `.planning/PROJECT.md` — Key Decisions and post-mortems: Phases 27-32 adapter failure, Phase 36.2 superseded, 36.14 canonical physical-frame cutover, Phase 41 audio anchor model, Phase 43 Loop Clip resolver, Phase 43.6 batch ops, v0.8.1 CSP fix (HIGH)
- Code inspection: `app/src/stores/paintStore.ts` (single-track `Map<layerId, Map<frame, PaintFrame>>`, global `paintVersion`), `app/src/stores/physicPaintStore.ts` (`Map<layerId, ...>` loop clips, ownership/lease model), `app/src/components/physic-paint/roto/rotoCoordinatorPorts.ts` (Loop Clip snapshot), `app/src/components/physic-paint/audio/efxPaintAudioPreviewContext.ts` (revision guard, frame-to-audio truth table), `app/src/lib/previewRenderer.ts` (per-layer opacity/blend compositing), `app/src/lib/history.ts` (global command-pattern undo), `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts` (stable keyId + appFrame) (HIGH)
- User memory: no-backward-compat clean-break rule, truth-table-before-patches rule, always-bump-and-subscribe paintVersion, guard-shortcuts-in-paint-mode, session-local soloStore precedent, incremental engine integration rule, no-test-config-hacks (HIGH)
- Web research (LOW confidence — cross-referenced patterns only): NLE opacity/blend order divergence (FCP vs Resolve) — https://creativecow.net/forums/thread/composite-mode-and-opacity-interaction/ ; double-premultiplied alpha dark halos — https://www.steakunderwater.com/VFXPedia/__man/Resolve18-6/DaVinciResolve18_Manual_files/part1931.htm ; hidden black V0 layer in multi-track timelines — https://forum.shotcut.org/t/what-is-the-order-of-operations-when-applying-filters-on-both-the-track-and-the-clip/23391 ; AE track-matte leak and duplication time bomb — https://flylib.com/books/en/2.104.1/track_mattes.html ; Harmony Transform-Loop seam handling — https://docs.toonboom.com/help/harmony-24/premium/reference/node/move/transform-loop-node.html ; Godot audio self-overlap on loop — https://github.com/godotengine/godot/issues/75197 ; AudioContext clock drift across WebViews — https://github.com/WebAudio/web-audio-api/issues/2409 ; undo byte-budget/one-stack lesson — https://docs.rs/oxigis-ui/latest/oxigis_ui/edit/stack/index.html ; schema-evolution silent-breakage and partial-loading traps — https://dataengineerhub.blog/articles/data-contracts-schema-brekage-guide

---
*Pitfalls research for: EFX Motion Editor milestone v1.0.0 (multi-track internal Paint frame documents, internal compositor, Background track, photo/reference track, Reveal mask compositor, read-only audio preview)*
*Researched: 2026-08-23*
