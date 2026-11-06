# Phase 59: Rail Motion Channels & v7 Interface - Context

**Gathered:** 2026-11-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Turn every rail into an animatable object. A rail — Standard, Motion, Static, Reveal, or a bare Key Rail — gains **Motion keys that are independent of its drawing keys**, on four channels (Position, Scale, Rotation, Opacity), evaluated in rail-local time and applied **once at the compositor** so edit view, Play and export show the same frame. The v7 channel lane surface (18px lanes, header cluster, 6×6 keys, selected-rail outline) is the interface for those channels.

This phase delivers the model, the persistence, the compositor transform and the lane surface. It does **not** add timeline zoom (Phase 60), vector painting (Phase 61), painted-stroke curve editing (Phase 62), or the Studio API/MCP (v2.2.0, Phase 63).

</domain>

<decisions>
## Implementation Decisions

### Milestone-locked (carried in, NOT re-asked)

These were settled before this discussion and must not be reopened by research or planning:

- Motion attaches to **any** rail, with no cycle value and no conversion step. Rail identity for a motion-bearing bare Key Rail is **planning work** (Gate B truth table), not a discussion question.
- Channel set is Position, Scale, Rotation, Opacity. **Scale ships** despite its absence from the v7 mockup.
- One evaluator. The user-facing curve set is Hold plus an eased/smoothed interpolation. **No B-spline on motion channels** (an approximating basis misses its keys).
- The persisted field is **not** named `motion` — that name belongs to `PhysicPaintRotoScriptMotionSettings`, a separate system that is never merged with this one.
- Rendering law: one raster per track per frame, content cycles while motion continues, nothing re-bakes for motion.
- Edit view, Play and export must produce the identical frame, including on the active track.
- v7 chrome is authoritative: 18px lanes, 16×18 rounded cells, 1.5px curves, 6×6 keys with the lighter type rim, header cluster (icon, label, "N keys", previous/diamond/next), rounded selected-rail outline, one open rail block at a time, 2px post-block gap, measured reorder offsets.
- Rotation is unbounded (0°/360°/720° are distinct keys); values hold outside the keyed range; three selection scopes (rail / drawing key / motion key) work independently; Ease, Wiggle and Hold attach only to Motion keys; Wiggle is seeded and deterministic at export.

### Starting motion (the first-key entry point)

- **D-01:** A rail with no motion is started from an **action-bar Animate button**, visible in **rail scope only** (selecting a drawing key or a motion key hides it). The v7 grey `minus` stays a truthful passive indicator — it is never clickable, per MUI-01.
- **D-02:** Animate creates **one identity key on the Position channel at the playhead**. It does not create a key on Scale, Rotation or Opacity, does not create a drawing key, and does not move the playhead.
- **D-03:** The channel block **stays collapsed** after Animate. The only feedback is the header glyph changing from grey `minus` to the bright rail-coloured `chevron-right`. This is deliberately consistent with "no lane appears by default".
- **D-04:** Animate is idempotent in spirit: it never writes more than the one Position key, and pressing it again on an already-animated rail is not a second authoring path — the rail's block is what the user expands from there.

### Value authoring

- **D-05:** Values are authored two ways against one truth: an **on-canvas gizmo** and **numeric fields**. The gizmo reuses the existing `PhysicsPaintReferenceTransformHandles.tsx` pattern (drag body, corner scale handles, rotation handle) and the shared `canvas/transformHandles.ts` hit-testing. — **Reversibility:** costly — removing the gizmo later means unwinding the canvas overlay, its gesture settlement and its store actions, and the numeric panel would be the only authoring path left.
- **D-06:** Numeric fields live in the **Studio right-panel inspector**, following the existing `selectedKeyRailInspector` projection pattern. The timeline keeps its 180px header (icon, label, "N keys", nav cluster) and gains no value widgets.
- **D-07:** The gizmo covers **Position, Scale and Rotation**. **Opacity is numeric-only** — an opacity "handle" is invented UI that no reference tool has.
- **D-08:** Dragging the gizmo on a frame with no Motion key **auto-keys, but only inside a channel that already carries motion**. An un-animated channel and an un-animated rail never mutate silently. This is the explicit rejection of "silent auto-key on every transform". — **Reversibility:** costly — the rule lives inside the drag gesture and its settlement, and changing it later changes what saved documents do under the same gesture.
- **D-09:** Channel values display as **Position in px, Scale in %, Rotation in degrees (unbounded, can be negative or > 360), Opacity in %**.

### Channel lanes

- **D-10:** An expanded rail shows **only the channels that carry keys**, plus a `+` row in the block for adding a channel that has none yet. This reconciles MOTN-04's "open on demand, no lane by default" with the v7 mockup, whose three lanes each carry keys.
- **D-11:** Position ships as **one grouped lane backed by two model channels** (`position-x` and `position-y`). Keeping two channels in the model means a Split X/Y toggle can ship later with **no schema change**. — **Reversibility:** one-way — the persisted `.mce` shape is pinned byte-identically by REL-02 in both TS and Rust; collapsing to one model channel later needs a document migration and a dual-language encoder change.
- **D-12:** In grouped mode **X and Y share key frames** — one key at a frame carries both axes. Independent per-axis keys are what the (deferred) Split X/Y mode is for. — **Reversibility:** costly — it defines the writer/reader semantics of the persisted Position channel.
- **D-13:** Lane order is **fixed**: Position, Scale, Rotation, Opacity. No reordering state.
- **D-14:** The add-channel affordance is a **`+` row at the end of the expanded block**, in the same 18px rhythm, opening a menu of channels that have no keys yet.
- **D-15:** Deleting a channel's last key **removes its lane**. If it was the rail's last channel, the chevron returns to the grey `minus` and the block collapses.

### Motion semantics

- **D-16:** **Hold only** ships in v1. Motion plays in rail-local time and holds past its last key on every occurrence. MOTN-06 is satisfied through its hold branch; "fit the full occurrence" is deferred and, when added, must arrive as a per-rail opt-in (an absent-means-default field, the existing `colorize`/`photoWiggle` precedent) rather than a behaviour change.
- **D-17:** Rotation and scale pivot at the **rail content centre** — the union of the rail's key bounds, computed once per rail revision. It is time-invariant by construction because it never reads per-frame raster bounds (which would make a cycling drawing wobble). — **Reversibility:** costly — the pivot formula changes how every already-saved rail rotates and scales, so changing it later silently alters existing documents.
- **D-18:** **Rail motion produces no motion blur in v1.** The transform is applied to the integer content raster and motion blur keeps sampling content changes only. This is a **documented limitation, not a silent omission**; REL-04 ("paint on every frame") is unaffected because it concerns the sub-frame content raster, not the transform's blur.
- **D-19:** Track opacity and the motion Opacity channel **multiply** — final alpha = track opacity × motion opacity.

### Claude's Discretion

- Undo granularity follows the existing law: one state change per completed gesture (a whole gizmo drag is one undo step, not one per pointer move), and every Motion key operation is exactly one undo/redo step.
- Gizmo visibility across the three scopes (rail scope shows the rail box; motion-key scope shows the same box for the selected key's evaluated value) — planner decides the exact scoping, provided the three scopes stay disjoint.
- The exact visual form of the `+` row and its channel menu, within the 18px rhythm and the locked palette.
- Whether the inspector shows all channels' values or only the animated ones, provided Opacity is always numeric.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone authority (read first)

- `SPECS/v2.1.0-motion-channels/CONTEXT.md` — the v2.1.0 milestone context: §3 the finalized v3 rail model (three scopes, independent Motion keys, rail-local time, compositor law), §3.6 Gates A–D, §6 the conflict list, §9 the re-based phase numbering. **Semantics authority.**
- `SPECS/v2.1.0-motion-channels/README.md` — the v7 lane UI contract: §0 the expressibility gate, §2 geometry (18px lanes, 16×18 cells, 6×6 keys, nav-cluster coordinates, outline formula, 2px row rhythm), §3 the toggle state machine, §4 the integration map, §5 the UAT list, §6 the open decisions with defaults. **Visual authority.**
- `SPECS/v2.0.1-timeline-rails/README.md` — the shipped rail surface this phase builds on (rail line width rule, cell matrix, rail types, selection).

### Research

- `.planning/research/ARCHITECTURE.md` — §12 build order (59.1→59.6), the compositor draw sites, the canonical encoders, the 66 pitch consumers, the `trackTransforms` port.
- `.planning/research/PITFALLS.md` — Pitfall 1 (motion invisible to the flattened cache / memo explosion), Pitfall 2 (fractional sub-frames drop the paint raster), Pitfall 3 (active-track preview/export drift), Pitfall 6 (rail identity is drawing-key-derived).
- `.planning/research/SUMMARY.md` — the synthesis, including Open Decisions 1–6 and the "no new runtime dependencies" verdict.
- `.planning/research/FEATURES.md`, `.planning/research/STACK.md` — feature table stakes and the verified installed-package capabilities.

### Design oracles

- `SPECS/v2.1.0-motion-channels/reference/section-01-motion-channels.png` — exported v7 motion-channel surface.
- `SPECS/v2.1.0-motion-channels/reference/v3-rail-animation.png` — the v3 model frame (model only; its chrome is superseded).
- `SPECS/v2.1.0-motion-channels/reference/v2-full-interface.png` — the first draft (superseded).
- `SPECS/v2.1.0-motion-channels/MOTION-CHANNELS.tsx` and `SPECS/v2.1.0-motion-channels/motion-channels.css` — the surface reference implementation.

### Requirements and roadmap

- `.planning/REQUIREMENTS.md` — MOTN-01..12, MUI-01..06, REL-01..04, the "Decisions locked" list, and the Out of Scope table.
- `.planning/ROADMAP.md` — Phase 59 goal, success criteria, build order 59.1–59.6, and the Gates A–D that must be answered in the plan.
- `.planning/STATE.md` — the blockers list (four persistence carriers, the missing paint-field enforcement, the byte-identical round-trip pin).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `app/src/components/physic-paint/view/timelineRailDesign.ts` (258 lines) — the locked v7 palette, surface tokens, geometry (`cellPitch: 18`, `motionLaneHeight: 18`, `outlineWidth: 1.5`, `outlineRadius: 4`), the rail-type classifier, the cell matrix and the rail-line width rule. **The single source for lane geometry and colour; extend it, do not fork it.**
- `app/src/components/physic-paint/view/PhysicsPaintReferenceTransformHandles.tsx` (519 lines) — the complete on-canvas gizmo precedent: drag-to-move body hit, corner scale handles, rotation handle, counter-scaled screen-pixel handles, interaction bracketing via `beginInteraction`/`endInteraction`. **D-05 reuses this pattern.**
- `app/src/components/canvas/transformHandles.ts` — shared `getHandlePositions`, `hitTestHandles`, `getRotationZone`, `pointInPolygon`, `getCursorForHandle`, `HandleType`, `LayerBounds`.
- `app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.ts` — `deriveKeyRailSegments` (the Key Rail is derived from `firstKeyId` + `keyIds`, with no durable identity of its own — this is the Gate B hazard) and `projectSelectedKeyRailInspector` (the right-panel inspector projection that D-06 extends).
- `app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.tsx` (248 lines) — the pinned header band; channel headers must be inserted here in lockstep with the rows region.
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` (6276 lines) — the lanes host; `ROTO_CELL_WIDTH_PX = 18` is referenced ~56 times here alone and pinned by a source-string test.
- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts` (1832 lines) — `PhysicPaintRotoLoopClip` at line 305 (carries `loopId`, `placementStart`, `sourceKeyIds`, `repeat`, `mode`, `railKind`, and the unrelated `motion?: PhysicPaintRotoScriptMotionSettings`), `encodeCanonicalLoopClips` at line 1610, `buildPhysicPaintRotoPhysicalRevision` at line 1460.
- `app/src/stores/physicPaintStore.ts` — `_trackContentRevision`, `_preResolveTrackContent`, `_resolveFlattenedFrame`, `serializeRuntimeIntoDocument`, and the unbounded `_flattenedMemo`.
- `app/src/efx-paint/compositor/efxPaintCompositor.ts` and `app/src/efx-paint/compositor/efxPaintCompositeCache.ts` — the two draw sites (normal and `engineOverlay`) and the cache key.
- `app/src-tauri/src/services/script_library.rs` — `canonical_loop_clips` and `canonical_physical_hash`, the Rust mirror that must emit the new block at the identical ordinal.

### Established Patterns

- **Conditional canonical term** — a field is written only when present/non-default so an untouched rail stays byte-identical (`colorize`/`colorizeMix`, `photoWiggle`, `keyScriptEdits`).
- **Session-only view metrics** — `physicsPaintCanvasZoom.ts` is the model for any session state; nothing view-only enters `.mce`.
- **Prepare-time geometry, composite-time transform** — the background/reference transform is the exact precedent for applying a matrix at the compositor rather than baking pixels.
- **Drag bracketing** — `beginInteraction`/`endInteraction`/`markInteractionActive` around pointer gestures, settling on release.
- **Four persistence carriers move as one change** — `serializeRuntimeIntoDocument`, `encodeValidatedEfxPaintTrackContent`, `buildEfxPaintDocumentSyncFingerprint`, and the layer change token. Missing one silently drops motion; this class already cost PKG-06 and BKG-09.

### Integration Points

- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — the right-panel composition (line ~7159) where the motion inspector slots in.
- `app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx` — the header's motion slot; the v2.0.1 grey slot becomes the interactive chevron.
- The action bar — where the rail-scope `Animate` command joins `Transform` / `Edit` / `Delete`.

</code_context>

<specifics>
## Specific Ideas

- The user's own framing of the feature (milestone notes): animating rails is for "moving a character, a bird, a cloud" — i.e. the pivot must feel local to the object, which is why D-17 chose the rail content centre over the canvas centre.
- "Content cycles, motion continues": a 1 s rail cycled ×3 keeps cycling its drawings while the transform interpolates across the full occurrence.
- No silent document mutation is a standing constraint: the rejection of auto-adopt-into-a-loop-clip and of silent auto-key both trace back to it.
- The v7 mockup is the visual oracle; the v3 frame contributes only its model, never its chrome.

</specifics>

<deferred>
## Deferred Ideas

- **Fit-to-span repeat** — deferred by D-16. When added, it must be an opt-in per-rail field with an absent-means-hold default.
- **Split X/Y Position toggle** — the model keeps two channels so this can ship later with no schema change (D-11); the toggle itself is not in this phase.
- **On-canvas motion path (spatial Bézier) editing** — already listed as a future requirement.
- **Copy/paste of Motion keys across rails** — already listed as a future requirement.
- **Per-key Bézier handles as the primary curve UI (full graph editor)** — future requirement.
- **Skew, 3D and perspective channels** — future requirement.
- **Multiple simultaneously expanded motion blocks** — future requirement; v7 keeps one block.
- **Motion blur on rail motion** — deliberately locked off in v1 by D-18 with a documented limitation.
- **User-placeable pivot** — rejected for v1 (D-17 chose a computed rail-space pivot); revisit only if the local-centre pivot proves insufficient for the character/bird/cloud cases.

### Reviewed Todos (not folded)

- `261024-frame-fade-compositing` — "Frame fade — compositing/export cumulative-frame crossfade (separate from opacity)". Surfaced by the todo matcher on the words frame/export/opacity, but it is a **composite-time crossfade effect**, not rail motion. Reviewed and deliberately left pending; it is a separate capability with its own staleness contract.

</deferred>

---

*Phase: 59-Rail Motion Channels & v7 Interface*
*Context gathered: 2026-11-06*
