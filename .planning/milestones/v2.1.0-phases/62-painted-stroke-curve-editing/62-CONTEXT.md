# Phase 62: Painted-Stroke Curve Editing - Context

**Gathered:** 2026-11-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Select an already-painted hand stroke (Brush, Water or Pen), enter curve mode through the **existing spline-pointer control**, edit a fitted anchor path with the **same surface Phase 61 ships**, and have the first committed gesture convert the stroke into a persisted vector path whose edit re-bakes from the **recovered pre-script base**. Every loop occurrence of the source stroke then shows the edited result, and undo during an in-flight bake cancels it.

Delivers:

- Lazy anchor fitting on curve-mode entry (interpolating, curvature-adaptive).
- The conversion: the first committed gesture writes `anchors` (+ `curveMode` when set) and replaces `points` with the re-sampled spine, turning the stroke into a Phase 61 vector stroke.
- Re-bake through the shipped base → script → composite path, one ledger entry per gesture.
- Hand-pressure remap and a count-preserving re-sample.
- The wireframe surface on entry: auto-on with a ghost of the original spine, pressure-derived width envelope.
- Source-only loop semantics with every occurrence invalidated together.
- Undo that cancels an in-flight bake.

Does **not** add:

- Drawing new vector paths (Phase 61), closed paths, fills, or new curve families.
- Editing Lift/eraser strokes.
- Materializing loop occurrences or per-occurrence copies.
- Conversion at paint time or a background pre-fit.
- A second editor surface — "script" and "vector" strokes share one editor.
- Any engine, deposit, paper or compositor change.

</domain>

<decisions>
## Implementation Decisions

### Milestone-locked (carried in, NOT re-asked)

- **CRV-01..04 are the requirement set** (`.planning/REQUIREMENTS.md`).
- **Phase 61's editing model holds:** two anchor kinds (Bézier carrying coupled handles, auto-smooth deriving them), grabbing a derived tangent promotes to Bézier (D-01/D-03); the spline-pointer lives in the Stroke Settings dialog header (D-06); paths are always open (D-07); one engine, one deposit law; conditional canonical terms.
- **Determinism law:** 60 Hz integer ticks, FNV-1a `traceSeed`, no `Math.random()` in deposit or simulation; same script ⇒ same pixels.
- **REL-01 holds:** no new runtime dependencies. `fit-curve` already ships, but D-04 means it is a reference, not the chosen fitter.
- **The pre-script base is the existing durable-base authority**; `durable-base-unknown` fails closed and the caller performs zero writes.
- **REL-02** applies to every persisted field (TS + Rust, byte-identical round trip, pinned).
- **Session-only view state never enters the document** (wireframe law, Phase 61 D-16 / Phase 60).
- **Path edit is single-stroke only** (Phase 61's gate).

### Stroke identity

- **D-01:** The first committed anchor/handle edit **converts the painted stroke into a Phase 61 vector path**. The stroke gains `anchors` (and `curveMode` when it is not the default) and its `points` become the re-sampled spine. From that moment it is a vector stroke in every respect — there is no lingering "converted" mode. — **Reversibility:** one-way — the hand-recorded samples are replaced by the re-sampled spine; only the undo ledger restores them, and re-introducing hand points for a converted stroke would need new fields and a migration.
- **D-02:** **The ROADMAP scope gate is OPENED by this decision.** The roadmap's default ("do not persist Bézier anchors in v1; curve edits are script mutations" and "no new `.mce` field in the default scope") is superseded. REL-02 therefore applies. **No new `.mce` field is invented:** `anchors` and `curveMode` already round-trip through AQTL v2 and both languages since Phase 61; the change is that a previously hand-painted stroke now emits them. — **Reversibility:** costly — the decision can be reversed, but documents saved after conversion would still carry anchors that a reverted build must read.
- **D-03:** **Anchors are fitted lazily, on curve-mode entry.** Never at paint time, never in a background pass. Entering curve mode and leaving without a committed gesture writes nothing (no revision, no ledger entry, no bake). — **Reversibility:** reversible — moving the fit earlier or later is a local change.

### Fit

- **D-04:** **Interpolating anchors on decimated original samples.** Anchors are placed ON original recorded points and evaluated through Phase 61's auto-smooth spline, so the curve passes exactly through every anchor and untouched anchors do not move. This is **not** a least-squares `fit-curve` approximation; the legacy Phase 25 fitter is a reference only. — **Reversibility:** costly — the fit defines the first commit's shape; changing it later re-fits every converted stroke differently and changes stored spines only on re-edit.
- **D-05:** **Curvature-adaptive density with a hard cap (default ~40 anchors).** No fixed count and no dense sampling; long straight runs get no anchors, turns get the anchors. The curvature threshold, decimation algorithm, cap value and minimum-anchor floor are Claude's discretion, measured against real strokes rather than guessed. — **Reversibility:** reversible — local tuning constants.
- **D-06:** **Entry turns the wireframe on for the duration of the edit and restores the user's previous setting on exit.** The fitted path and anchors draw over a **faint ghost of the original recorded spine**, so any deviation between anchors is visible before the first commit. The paint itself is untouched until a gesture commits. — **Reversibility:** reversible — an entry/exit bracket.

### Pressure and cadence

- **D-07:** **The recorded hand pressure is remapped along the new spine by arc length**, endpoints pinned to the original first/last pressure. The hand's heavy/light character survives the reshape. `updateAquarellePathInScript` today stamps the speed sentinel (`vectorSpinePressures`) unconditionally; this decision extends that seam. — **Reversibility:** costly — pressure lives only in the re-sampled `points`, so once a converted stroke is saved the original profile exists only in the undo ledger.
- **D-08:** **Every path edit preserves the stroke's sample count.** The existing number of samples is redistributed along the new spine by arc length, so `ticks` and the wet lifetime never change with path length. This applies to converted strokes **and, deliberately, to Phase 61's drawn vector strokes**, replacing today's length-proportional re-sample (`resampleVectorPaintPoints`). — **Reversibility:** costly — it changes shipped Phase 61 edit timing, so any pin asserting length-proportional sample counts must be retired with a stated reason.
- **D-09:** **A converted stroke's wireframe width is the pressure envelope**, not Phase 61's uniform anchor-width envelope. The band derives from the remapped per-sample pressure so it matches the paint's real taper; the existing hand-painted band builder is the reusable asset. — **Reversibility:** reversible — a render-only substitution over shipped band geometry. **Recorded exception (ratified 2026-11-14):** a mouse-painted stroke records only the `-1` speed sentinel in every sample — the engine derives its pressure from speed at replay — so there is no per-sample pressure to remap (D-07 has nothing to remap) and reproducing the speed law inside a view leaf would cross the one-engine boundary. Such a stroke therefore keeps Phase 61's uniform anchor-width envelope. This is D-09's one documented exception; every stroke carrying a recorded pressure profile (every pen/tablet stroke) shows its real taper.

### Eligibility and reach

- **D-10:** **Brush, Water and Pen strokes are eligible; Lift (eraser) strokes are refused** through the existing path-edit gate with a named reason. Curve mode stays single-stroke. — **Reversibility:** reversible — one predicate plus refusal copy.
- **D-11:** **Loop occurrences are source-only.** Curve mode is offered where the stroke is a real key; the edit re-bakes the source and every linked occurrence presents the new pixels (one source cache entry serves every occurrence — D-26). No materialization at an occurrence, no occurrence-local copy, no projection of source strokes into occurrence frames. — **Reversibility:** costly — per-occurrence edits would later need a materialization path and a "which copy" rule for every subsequent operation.

### Commit and undo

- **D-12:** **One committed gesture = one `aquarelle-script` ledger entry**, through the shipped seam. On the converting gesture the same entry carries the conversion (anchors + re-sampled points), so one undo restores the hand-painted points and the pre-edit bake exactly. — **Reversibility:** reversible.
- **D-13:** **Undo during an in-flight bake cancels the apply**, restores the pre-edit script and sheet, and writes no ledger entry — the stroke returns to its exact pre-edit state immediately. This needs a cancellation token through `runAquarelleScriptRebake` / the apply sequence so a pending apply cannot publish. If the main thread is mid-replay the key lands just after settle; the undo must still target THIS edit, never the previous history entry. — **Reversibility:** costly — cancellation becomes part of the bake contract.
- **D-14:** **Nothing is baked while the wireframe is on.** The commit's re-render is deferred to the Draft/wireframe settle exactly as Phase 61's deferred route does (edit visible only when pixels appear; undoability unchanged). — **Reversibility:** reversible.

### Derived consequences (not separately asked)

- Entry is the existing **spline-pointer toggle in `PhysicsPaintStrokeSettingsDialog`**; `PATH_EDIT_SINGLE_DISABLED_REASON` stops applying to eligible painted strokes, and the existing refusal copy remains for ineligible ones.
- A converted stroke thereafter exposes the full Phase 61 vector surface — insert/delete anchors, handle break, Vertex size, Bézier/Spline evaluation — because it is a vector stroke.
- Escape exits curve mode without writing anything.
- Stroke identity, stack position, selection and Move/Edit behaviour are preserved; only the payload changes.

### Claude's Discretion

- Curvature threshold, decimation algorithm, cap value (default ~40) and minimum-anchor floor.
- The arc-length pressure-remap implementation, and behaviour when the new spine is much longer or shorter.
- How the ghost spine and pressure envelope are drawn inside the shipped overlay palette and `physics-paint-segmented-button` grammar.
- Whether the fit result is held for the duration of an edit session (session-only, never persisted separately).
- The cancellation token's shape and where the abort is observed.
- Refusal copy for Lift and degenerate strokes, following the existing named-refusal pattern.
- Exact placement and wording inside the existing dialog header.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone authority (read first)

- `SPECS/v2.1.0-motion-channels/CONTEXT.md` §5.4 — the Phase 62 boundary as originally noted ("edit a brush-painted script/stroke in curves").
- `SPECS/v2.1.0-motion-channels/CONTEXT.md` §5.3 — the vector painting surface and gates this phase reuses.
- `.planning/ROADMAP.md` §Phase 62 — goal, the four success criteria, the scope gate (**opened by D-02**), the delivery law and the UI hint.
- `.planning/REQUIREMENTS.md` — CRV-01..04 and the REL-01..04 delivery law.

### Prior phase decisions

- `.planning/phases/61-vector-painting-tool/61-CONTEXT.md` — D-01..D-16 and research corrections C-01..C-04: the anchor model, the path-edit surface, the wireframe law, the one-engine rule.
- `.planning/phases/60-studio-timeline-horizontal-zoom/60-CONTEXT.md` — the session-only view-state law that D-06/D-16 inherit.
- `.planning/phases/59-rail-motion-channels-v7-interface/59-CONTEXT.md` — the no-approximating-basis argument (applies to curve families here).

### Code authorities

- `app/src/components/physic-paint/roto/aquarelleScriptBaseAuthority.ts` — the ONE durable pre-script base authority (reveal axis first, fail-closed `durable-base-unknown`).
- `app/src/components/physic-paint/roto/aquarelleScriptReplay.ts` — the fixed undo/redo replay order (invalidate → ensure-base → prepare → restore → reset → rebake).
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptRebake.ts` — the bake composited over the durable base with the pigment-alpha law.
- `app/src/components/physic-paint/view/aquarelleRecordState.ts:1096` — `updateAquarellePathInScript`, the path write seam where the conversion lands.
- `app/src/components/physic-paint/view/aquarelleVectorPathCommit.ts:109` — `runAquarelleScriptRebake`, the latch/veil/apply sequence D-13 extends.
- `app/src/components/physic-paint/view/vectorPathHandles.ts` — `resampleVectorPaintPoints`, `vectorSpinePressures`, `VECTOR_STROKE_BASE_PRESSURE`; the D-07/D-08 seam.
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx:10266` — `commitAquarelleVectorPathEdit`, the ONE path-edit commit seam.
- `app/src/components/physic-paint/view/strokeSettingsModel.ts:770-803` — the path-edit gate and its disabled copy (D-10).
- `app/src/components/physic-paint/engine/VectorPathOverlay.tsx` — the editing overlay (gesture only; never bakes or records).
- `app/src/components/physic-paint/view/vectorPathSession.ts` — `enterPathEdit`, `pathEditMutationId`, `pathEditRebakeActive`.
- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts` — linked occurrence resolution and the D-12/D-13/D-26 laws (one source cache entry serves every occurrence).
- `app/src/components/physic-paint/roto/rotoLivePixelCacheTransactions.ts` — per-key live pixel identity and the commit-time script epoch (the in-flight capture guard).
- `packages/efx-watercolor/src/payload/toStudioStroke.ts` — conditional canonical terms for `anchors`/`curveMode`.
- `packages/efx-watercolor/src/vector/spine.ts` and `packages/efx-watercolor/src/payload/vectorPath.ts` — anchor evaluation, auto-smooth handle derivation, sampling.
- `app/src/lib/bezierPath.ts` — legacy Phase 25 fitter: reference only for tolerance-clamping behaviour; its code does not carry over.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **The Phase 61 path-edit seam is the spine of this phase:** commit → ensure durable base → begin edit → rebake → one ledger entry → rollback on failure. Phase 62 extends it; it must not be forked.
- `VectorPathOverlay.tsx` + `vectorPathHandles.ts` — the complete anchor/handle gesture set (drag capture, handle break, insert, delete, multi-select, screen-pixel chrome).
- `vectorPathSession.ts` — entry/exit latches and the rebake veil (`pathEditRebakeActive`).
- `aquarelleScriptBaseAuthority.ts` — durable-base resolution with fail-closed refusal.
- `aquarelleScriptReplay.ts` — the undo/redo order, including the invalidate-first rule.
- `physicsPaintRotoScriptRebake.ts` — the composite over the durable base.
- The hand-painted band builder and wireframe branch (Phase 61 D-15) for the pressure envelope.
- `fit-curve` (already a dependency) and `app/src/lib/bezierPath.ts` — reference for fit tolerance behaviour only.

### Established Patterns

- One ledger entry per completed gesture; the ledger snapshot is the only rollback source.
- Conditional canonical terms — write a field only when present/non-default.
- Compare-then-write setters so a same-value commit is a no-op.
- Fail-closed parsing and named refusals; never drop data silently.
- Determinism is structural (ticks, seed, no randomness).
- Session-only view state never enters the document, revision or cache key.
- Deferred re-render under Draft/wireframe, with the ledger recorded before the deferred render.
- One source cache entry serves every loop occurrence.

### Integration Points

- `PhysicsPaintStrokeSettingsDialog.tsx` + `strokeSettingsModel.ts` — the path-edit gate for painted strokes.
- `handleAquarelleVectorPathEdit` / `commitAquarelleVectorPathEdit` — the only writer.
- `beginAquarellePathEdit` / `updateAquarellePathInScript` — where conversion is written.
- `toStudioStroke` + the AQTL codec + the `.mce` TS/Rust declarations — the persisted anchors (already exist).
- The re-bake path + live pixel identity/script epoch — occurrence invalidation and in-flight cancellation.
- The Studio's history recorder (`recordAquarelleScriptEdit`) and the undo/redo wiring.

</code_context>

<specifics>
## Specific Ideas

- **"No forked editor."** The ROADMAP is explicit that the same surface edits both stroke kinds; the fitted painted stroke uses exactly Phase 61's overlay and handles.
- **"The texture is not re-rolled."** The seed and deposit parameters stay fixed; the pressure profile and the sample count are preserved by construction (D-07/D-08).
- The user chose **conversion over a transient fit** to have one data model after the edit, and explicitly accepted opening the scope gate.
- **"If it's inefficient, it's the wrong time."** The fit is lazy because the paint pipeline (capture → encode → bake) is the sensitive path; a fit there would compete with the wet-paint feel.
- The user's concern that a painted stroke carries "plenty of points" is answered by curvature-adaptive decimation, not by converting at paint time.
- **The wireframe is the preview.** Entry shows the curve and the ghost of the original spine before anything bakes, so the user sees the fit before taking irreversible control.

</specifics>

<deferred>
## Deferred Ideas

- **Fit at paint time / anchors-at-birth** — rejected: it changes the paint from the first stroke.
- **Pre-fit background cache** — rejected: pays the fit for strokes never edited and adds an invalidation surface.
- **Least-squares `fit-curve` approximation** — rejected in favour of an interpolating fit.
- **Length-proportional re-sampling** — superseded by D-08's count-preserving law.
- **Editing Lift/eraser strokes** — refused this phase.
- **Materializing occurrence copies / per-occurrence curve edits** — not this phase.
- **Multi-stroke curve editing in one session** — Phase 61's single-stroke gate stands.
- **Closed paths and filled vector shapes** — Phase 61 deferred.
- **Persisting a separate pre-conversion pressure baseline field** — rejected; conversion replaces the points and undo is the fallback.

</deferred>

---

*Phase: 62-Painted-Stroke Curve Editing*
*Context gathered: 2026-11-14*
