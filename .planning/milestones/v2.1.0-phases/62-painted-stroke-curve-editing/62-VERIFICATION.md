---
phase: 62-painted-stroke-curve-editing
verified: 2026-11-14T18:24:59Z
status: passed
score: "49/49 must-haves verified (2 passed via approved override)"
covered_files:
  - .planning/phases/62-painted-stroke-curve-editing/62-01-PLAN.md
  - .planning/phases/62-painted-stroke-curve-editing/62-01-SUMMARY.md
  - .planning/phases/62-painted-stroke-curve-editing/62-02-PLAN.md
  - .planning/phases/62-painted-stroke-curve-editing/62-02-SUMMARY.md
  - .planning/phases/62-painted-stroke-curve-editing/62-03-PLAN.md
  - .planning/phases/62-painted-stroke-curve-editing/62-03-SUMMARY.md
  - .planning/phases/62-painted-stroke-curve-editing/62-04-PLAN.md
  - .planning/phases/62-painted-stroke-curve-editing/62-04-SUMMARY.md
  - .planning/phases/62-painted-stroke-curve-editing/62-05-PLAN.md
  - .planning/phases/62-painted-stroke-curve-editing/62-05-SUMMARY.md
  - app/src-tauri/src/models/project.rs
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/engine/AquarelleStrokeOverlay.tsx
  - app/src/components/physic-paint/engine/VectorPathOverlay.test.ts
  - app/src/components/physic-paint/engine/VectorPathOverlay.tsx
  - app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts
  - app/src/components/physic-paint/performance/scriptTimelineCodec.test.ts
  - app/src/components/physic-paint/performance/scriptTimelineCodec.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.vectorDrawn.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts
  - app/src/components/physic-paint/roto/rotoPhysicalOwnership.ts
  - app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx
  - app/src/components/physic-paint/view/aquarelleRecordState.path.test.ts
  - app/src/components/physic-paint/view/aquarelleRecordState.ts
  - app/src/components/physic-paint/view/aquarelleStrokeBand.test.ts
  - app/src/components/physic-paint/view/aquarelleStrokeBand.ts
  - app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts
  - app/src/components/physic-paint/view/aquarelleStrokeSelection.ts
  - app/src/components/physic-paint/view/aquarelleVectorPathCommit.test.ts
  - app/src/components/physic-paint/view/aquarelleVectorPathCommit.ts
  - app/src/components/physic-paint/view/scriptStrokeEdition.ts
  - app/src/components/physic-paint/view/strokeSettingsModel.test.ts
  - app/src/components/physic-paint/view/strokeSettingsModel.ts
  - app/src/components/physic-paint/view/vectorPathCurveBracket.test.ts
  - app/src/components/physic-paint/view/vectorPathCurveBracket.ts
  - app/src/components/physic-paint/view/vectorPathFit.test.ts
  - app/src/components/physic-paint/view/vectorPathFit.ts
  - app/src/components/physic-paint/view/vectorPathHandles.test.ts
  - app/src/components/physic-paint/view/vectorPathHandles.ts
  - app/src/components/physic-paint/view/vectorPathLatches.ts
  - app/src/components/physic-paint/view/vectorPathSession.test.ts
  - app/src/components/physic-paint/view/vectorPathSession.ts
  - app/src/stores/physicPaintStore.rotoLoopClips.test.ts
  - app/src/stores/physicPaintStore.ts
  - app/src/types/project.ts
  - packages/efx-watercolor/src/payload/codec.test.ts
  - packages/efx-watercolor/src/payload/codec.ts
  - packages/efx-watercolor/src/payload/toStudioStroke.ts
covered_digest: "v4:sha256:c47900c30d65054a54e5c2702648ee313ddd58240379fd4d7690826962d8ab8e"
behavior_unverified: 0
overrides_applied: 2
overrides:
  - must_have: "A8: The converting write and the overlay preview resolve the SAME curve mode; the in-app route stores no `curveMode` key."
    reason: "62-UAT row A retargeted the painted entry to preview Spline. The first conversion now passes DEFAULT_VECTOR_PATH_CURVE_MODE ('spline') explicitly, so the write stores curveMode: 'spline' instead of relying on the absent Bézier default. The substantive invariant — the preview mode equals the persisted mode — still holds and is test-pinned on both sides; the retarget was approved with the phase UAT on 2026-11-14 (62-UAT.md row A: 'The entry now also previews in Spline, the mode the first commit stores')."
    accepted_by: "Laurent Marques"
    accepted_at: "2026-11-14T17:25:00Z"
  - must_have: "C5: The held-fit target is drawn in `resolveAquarelleCurveMode(stroke.curveMode)` — the same expression the write persists."
    reason: "The UAT retarget draws the held fit in the shared DEFAULT_VECTOR_PATH_CURVE_MODE constant, which is exactly the mode the first commit now persists. The literal 'resolveAquarelleCurveMode(stroke.curveMode)' expression no longer covers the conversion case, but the same-mode outcome is unchanged and pinned by VectorPathOverlay.test.ts. Approved with the phase UAT on 2026-11-14."
    accepted_by: "Laurent Marques"
    accepted_at: "2026-11-14T17:25:00Z"
re_verification:
  previous_status: human_needed
  previous_score: "42/43"
  gaps_closed:
    - "R2's 'texture is not re-rolled' uncertainty — UAT row D passed (erased regions survive, grain not re-rolled) and the WR-02 tilt decision was recorded as accepted for v1."
    - "All 10 human-verification items (7 native UAT rows + the WR-02/WR-03/WR-04 decisions) are closed by 62-UAT.md, all rows passed 2026-11-14."
  gaps_remaining: []
  regressions: []
---

# Phase 62: Painted-Stroke Curve Editing Verification Report

**Phase Goal:** Users can reshape an already-painted stroke as a curve, and the change re-bakes correctly everywhere that stroke appears.
**Verified:** 2026-11-14T18:24:59Z
**Status:** passed
**Re-verification:** Yes — after the completed UAT round and the UAT-driven source changes.

The prior report declared `passed` in frontmatter but `human_needed` in its body with 10 open human items; the UAT round was opened from those items (62-UAT.md `source: [62-VERIFICATION.md]`), so this run records the effective previous status as `human_needed`. Everything below was checked against the CURRENT tree (the branch that includes `4b26cc5eb`, `84f544d60`, `e6ba5b8b9`, `c1199447a` and the completed UAT record), not against SUMMARY.md claims. The human round is complete: 62-UAT.md records 10/10 rows passed on 2026-11-14, including the three product decisions (WR-02 tilt accepted, WR-03 busy gates accepted, WR-04 refused replay accepted), so those items are closed rather than re-raised.

## Goal Achievement

### Observable Truths — ROADMAP contract (4)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| R1 | Selecting a painted stroke and entering curve mode fits anchors on entry and edits them with the same surface as the vector tool — no forked editor. | ✓ VERIFIED | `enterPaintedCurve` arms the base, calls `beginPaintedCurveSession` → `fitVectorPathAnchors(stroke.points)` and opens the shipped `enterPathEdit` latch (`PhysicsPaintStudio.tsx:10317`); the existing `VectorPathOverlay` resolves the held fit as the edit target (`VectorPathOverlay.tsx:951-1000`); the shipped writer seam admits the painted stroke (`strokeSettingsModel.ts:963`, `PhysicsPaintStudio.tsx:10482`). The canvas entry now routes through the same Studio entrance via `requestPaintedCurveEntrance` (see U1). No second overlay or hit-test exists. |
| R2 | Committing an anchor or handle edit is one ledger entry and re-bakes from the recovered pre-script base rather than deforming cached pixels — erased regions stay erased and the texture is not re-rolled. | ✓ VERIFIED | Mechanism: the durable base is awaited before the write (`PhysicsPaintStudio.tsx:10351`), the ONE commit records one edit id on exactly one route (`:10363-10368` deferred, `:10398` onSuccess; test `treats a second identical commit as a silent no-op that mints no ledger entry`), and the conversion changes only the path — tool/frame/params/seed salt/identity untouched (`aquarelleRecordState.path.test.ts:1059`). The texture clause is now human-verified: UAT row D passed on 2026-11-14 (erased regions stay erased, grain/pigment not re-rolled). The WR-02 tilt exception for fixed-rotation anisotropic stylus brushes is an accepted, recorded v1 decision (62-UAT.md row 8; 62-REVIEW-DISPOSITION.md). |
| R3 | Every loop occurrence of the edited stroke is invalidated together; no stale occurrence keeps the pre-edit pixels. | ✓ VERIFIED | ONE builder `buildRotoRealCacheRevision` (`physicsPaintRotoPhysicalModel.ts:1539`) used by all 7 production call sites (store `:5794,5840,5855`; ownership `:153`; persistence `:297,346,566`); raw `:real:` construction outside the model = 0; store probes pin shared identity, same-transition invalidation and by-reference rendering (`physicPaintStore.rotoLoopClips.test.ts:353,386,434`). UAT row E passed. |
| R4 | Undo cancels or settles an in-flight bake and leaves the stroke at its exact pre-edit state. | ✓ VERIFIED | Token-keyed epoch (`vectorPathSession.ts:120-152`), third terminal in `runAquarelleScriptRebake` (`aquarelleVectorPathCommit.ts:126-154`), undo router cancels then replays the exact `editId`, and awaits a deferred settle before the authoritative undo (`PhysicsPaintStudio.tsx:6368-6392`); pins at `PhysicsPaintStudio.test.ts:8065-8221` and `aquarelleVectorPathCommit.test.ts:247-336`. UAT row G passed. |

### Observable Truths — 62-01 (12)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| A1 | Recorded hand `points` (uv x/y + pressure) carry everything the fit needs; entry fits anchors on paint with no extra capture data; Phase 61 overlay/hit-test reusable. | ✓ VERIFIED | `fitVectorPathAnchors(stroke.points)` reads the record only (`vectorPathFit.ts:189`); `beginPaintedCurveSession` holds `{mutationId, anchors, sourcePoints}` and reads/writes no document (`vectorPathCurveBracket.ts:134-152`); test `fits the stroke's own recorded samples and writes no document state` (`vectorPathCurveBracket.test.ts:115`). |
| A2 | One script write: `anchors` stored, `curveMode` only when non-default, `points` replaced by the anchor spine, exactly one revision bump and one timeline index. | ✓ VERIFIED | `updateAquarellePathInScript` (`aquarelleRecordState.ts:1112`) rewires to `resampleVectorSpineWithPressureLaw`, deletes absent-default `curveMode`, replaces at the same index and calls exactly one `bumpAquarelleStrokesRevision()`; tests `replaces both strokes ... with ONE bump` (`:358`) and `converts a fitted hand stroke in one write` (`:876`). |
| A3 | One undo restores the hand-recorded points exactly (count, coordinates, pressures) and removes the `anchors`/`curveMode` keys. | ✓ VERIFIED | Revision-authoritative `restoreAquarelleEditSnapshot` (`aquarelleStrokeSelection.ts:1178`); test `restores the exact hand samples in one undo and the conversion in one redo` (`aquarelleRecordState.path.test.ts:920`). |
| A4 | Entering and leaving without a committed gesture writes no revision, payload entry or ledger entry. | ✓ VERIFIED | Bracket open/close only touches session signals (bracket `:173-221`); tests `fits the stroke's own recorded samples and writes no document state` and `is a no-op when no bracket is open — no write, no settle` (`vectorPathCurveBracket.test.ts:277`). |
| A5 | Every fitted anchor lies ON a recorded original sample; anchors outside the edited span keep their position. | ✓ VERIFIED | Fit selects original sample indices only (`vectorPathFit.ts:189-221`); `fits the stroke's own recorded samples` and tap-anchor pins in `vectorPathFit.test.ts`. |
| A6 | Fit density is curvature-adaptive with a 40-anchor cap and a floor, deterministic; a long straight run carries no interior anchors and a turn keeps one. | ✓ VERIFIED | DP + turn pass + decimation + doubling cap (`vectorPathFit.ts:30`); deterministic pure function; pinned by `vectorPathFit.test.ts` (35 assertions). |
| A7 | Assumption (CRV-02): the durable pre-script base resolves before the write; if it does not, the shipped `durable-base-unknown` refusal ends with zero surviving writes. | ✓ VERIFIED | `await ensureAquarelleDurableBaseRef.current(playFrame)` precedes `beginAquarellePathEdit` (`PhysicsPaintStudio.tsx:10351-10359`); the publish refusal is the shipped authority (`aquarellaScriptBaseAuthority.ts:20`) and the failure terminal restores the pre-edit snapshot (`PhysicsPaintStudio.tsx:10405-10425`); pins at `PhysicsPaintStudio.test.ts:4906-5028`. |
| A8 | The converting write and the overlay preview resolve the SAME curve mode; the in-app route stores no `curveMode` key. | PASSED (override) | The same-mode half is verified: the Studio conversion passes `DEFAULT_VECTOR_PATH_CURVE_MODE` and the overlay previews the held fit in that same constant (`PhysicsPaintStudio.tsx:10354-10359`, `VectorPathOverlay.tsx:993`, test `draws the held fit in the vector-edit default (Spline)` at `VectorPathOverlay.test.ts:3114`); the writer persists the effective mode (`aquarelleRecordState.ts:1158-1160`). The literal 'stores no `curveMode` key' clause is intentionally superseded: 'spline' differs from the storage default 'bezier', so the first conversion now stores `curveMode: 'spline'`. Approved with the UAT (62-UAT.md row A). |
| A9 | A conversion changes nothing but the path: `tool`, `playFrame`, `params`, any paint-seed salt and identity stay byte-identical and no seed bump runs. | ✓ VERIFIED | Test `changes only the path — tool, frame, params, seed salt and identity are untouched` (`aquarelleRecordState.path.test.ts:1059`); the writer only rewrites `anchors`/`curveMode`/`points` at the same index. |
| A10 | Every path edit redistributes the stroke's EXISTING sample count by arc length, so `ticks`/wet lifetime never change. | ✓ VERIFIED | `resampleVectorSpineWithPressureLaw` returns exactly `sourcePoints.length` stations (`vectorPathHandles.ts:940`); tests `preserves the recorded point count on every path write (D-08)` (`:460`), `through a much longer and a much shorter spine` (`:1118`), `spaces the preserved samples evenly ... by arc length` (`:1143`). |
| A11 | Recorded per-sample pressure is remapped by arc length with first/last pinned; an all-sentinel stroke stays all-sentinel. | ✓ VERIFIED | `vectorPathHandles.ts:940+`; tests `remaps the recorded pressure by arc length with both endpoints pinned` (`:1167`) and `keeps an all-sentinel stroke sentinel through the reshape` (`:1187`). |
| A12 | The curve-mode switch seam re-samples with the same count-preserving law, so switching Bézier/Spline never changes wet lifetime. | ✓ VERIFIED | `updateAquarelleCurveModeInScript` uses the same resampler (`aquarelleRecordState.ts:1003-1070`); test `stores the mode and the spline points in one write, is idempotent and restores on bezier` (`aquarelleRecordState.path.test.ts:701`). |

### Observable Truths — 62-02 (7)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| B1 | One Brush/Water/Pen selection enables the spline-pointer titled with the shipped label; Lift gets a named eraser refusal; degenerate gets a named too-few-points refusal; multi keeps the shipped multi reason. | ✓ VERIFIED | `resolvePaintedCurveEligibility` (`strokeSettingsModel.ts:921`) and `resolvePathEditGate` (`:1004`); fixed constants `PATH_EDIT_LIFT_DISABLED_REASON` / `PATH_EDIT_DEGENERATE_DISABLED_REASON`; tests at `strokeSettingsModel.test.ts:4025-4194`; dialog reads `bundle.readCurveEntry` (`PhysicsPaintStrokeSettingsDialog.tsx:463-471`). |
| B2 | A committed gesture on an eligible anchorless painted stroke passes the ONE writer seam into `commitAquarelleVectorPathEdit`; Lift/degenerate/malformed keep `VECTOR_PATH_REJECTION_MESSAGE`. | ✓ VERIFIED | `admitsPathEditWrite` (`strokeSettingsModel.ts:963`) gates `handleAquarelleVectorPathEdit` (`PhysicsPaintStudio.tsx:10482`); tests `admits exactly readable-anchor and eligible painted strokes to the ONE write seam` (`strokeSettingsModel.test.ts:4115`). |
| B3 | Pressing the spline-pointer fits anchors, snapshots pre-entry wireframe AND Draft, turns the wireframe on and opens the latch — writing nothing. | ✓ VERIFIED | `beginCurveWireframeBracket` captures before `setWireframeMode(true)` (`vectorPathCurveBracket.ts:173-184`), tests `captures the pre-entry values BEFORE turning wireframe on, and never overwrites them` (`:209`); Studio order pinned at `PhysicsPaintStudio.test.ts:6619-6632`. |
| B4 | Entry refuses fail-closed when the durable pre-edit base cannot be armed; no fit is held and no latch opens. | ✓ VERIFIED | `enterPaintedCurve` returns false after publishing `DRAFT_ARM_REFUSAL_MESSAGE` before `beginPaintedCurveSession` (`PhysicsPaintStudio.tsx:10317-10336`); pinned at `PhysicsPaintStudio.test.ts:6619-6632`. |
| B5 | Every exit route funnels through `exitPathEdit` and runs the exit bracket exactly once: held fit dropped, pre-entry wireframe/Draft restored. | ✓ VERIFIED | `exitPathEdit` runs the registered hook only on the open→closed transition (`vectorPathLatches.ts`); tests `runs the registered hook exactly when the latch transitions open -> closed`, `reaches the hook from a shipped sibling exit without a per-site change` (`vectorPathSession.test.ts:327,362`); Studio registers the ONE hook (`PhysicsPaintStudio.tsx:11519-11526`). |
| B6 | Exit with no committed gesture performs no bake and leaves Draft as found; a dirty deferred exit either settles once (pre-wireframe off) or keeps the deferred render behind the user's own wireframe (pre-wireframe on). | ✓ VERIFIED | Pure five-case `resolveCurveExitAction` (`vectorPathCurveBracket.ts:86-95`) + `endCurveBracket` (`:192-221`); teardown tests `vectorPathCurveBracket.test.ts:249-372`, including `never drops the deferred render behind the user's own wireframe` (`:334`). UAT row C passed. |
| B7 | Single-stroke only: the gate stays disabled for any selection size other than one. | ✓ VERIFIED | `resolvePathEditGate` requires `selectionSize === 1` (`strokeSettingsModel.ts:1004-1018`); test `enables the gate for one eligible painted stroke and keeps every shipped result unchanged` (`strokeSettingsModel.test.ts:4130`). |

### Observable Truths — 62-03 (7)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| C1 | The overlay draws the held-anchor stroke through its held anchors — no second editor surface, hit-test or forked gesture law. | ✓ VERIFIED | Edit-target resolution reads record anchors first, held fit second (`VectorPathOverlay.tsx:951-1000`); tests `draws one spine and one marker per fitted anchor for an armed held fit, and turns the surface on` (`:2915`), `leaves an anchorless painted stroke undrawn and inert without an armed fit` (`:2935`). |
| C2 | Fit armed → fitted spine, one marker per anchor, normal chrome; every shipped gesture commits exactly ONE full anchor list through `onPathEdit`, routed through `handleAquarelleVectorPathEdit`. | ✓ VERIFIED | Drag/insert/delete tests commit one `onPathEdit` (`VectorPathOverlay.test.ts:2940,2964,2983`); the seam admits the painted stroke (B2). The select-then-move retarget keeps one commit per gesture (U2). |
| C3 | Drawing and editing the held fit changes no document state until a gesture commits. | ✓ VERIFIED | Test `commits ONE onPathEdit for a fitted-anchor drag and writes no record state` (`:2940`); the drag test asserts `aquarelleStrokesRevision.value` unchanged; bracket tests assert no revision/ledger on entry/exit. |
| C4 | A faint ghost of the original recorded spine draws beneath for the whole session and disappears when the session clears; display-only. | ✓ VERIFIED | Ghost from `curveFitSession.sourcePoints` (`VectorPathOverlay.tsx:1114-1118`); tests `draws the original recorded spine as a ghost beneath the fitted path for the session` (`:3079`) and `removes the ghost the moment the curve session clears` (`:3098`). UAT row A passed. |
| C5 | The held-fit target is drawn in `resolveAquarelleCurveMode(stroke.curveMode)` — the same expression the write persists. | PASSED (override) | The same-mode outcome is verified: the held fit draws in `DEFAULT_VECTOR_PATH_CURVE_MODE` ('spline') whenever the record still carries no anchors, and the first commit persists that same mode (`VectorPathOverlay.tsx:993-1000`, `PhysicsPaintStudio.tsx:10354-10359`; tests at `VectorPathOverlay.test.ts:3114` and `:3133`). The literal expression named in the truth no longer covers the conversion case; the UAT-approved invariant (preview mode equals persisted mode) does. Approved with the UAT (62-UAT.md row A). |
| C6 | D-09: a real recorded pressure profile draws the hand-painted footprint band; a mouse-painted `-1` sentinel stroke keeps the shipped anchor-width envelope (documented exception). | ✓ VERIFIED | `hasRecordedPressureProfile` (`aquarelleStrokeBand.ts:195`) gates `buildStrokeBandCached` (`:222`) and the overlay reads it at `VectorPathOverlay.tsx:1074-1078`; tests `draws the shipped buildStrokeBand footprint and the centreline for a hand-painted stroke` (`VectorPathOverlay.test.ts:1583`), `keeps the wireframe envelope for a uniform profile whatever the switch says` (`:1891`), `aquarelleStrokeBand.test.ts` sentinel pins. UAT row D passed. |
| C7 | The overlay imports no engine/adapter, writes no state and leaves every finished gesture as one `onPathEdit` call. | ✓ VERIFIED | Import scan over `VectorPathOverlay.tsx` (no engine/adapter import; only the bracket/band/selection helpers); tests C2/C3. |

### Observable Truths — 62-04 (7)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| D1 | Assumption (CRV-04): the shipped single-flight latch plus a synchronous session epoch suffices; no async library, AbortController or state machine. | ✓ VERIFIED | Epoch is four signals + token compare-then-write (`vectorPathSession.ts:120-152`); no new dependency (REL-01 scan below); no AbortController/state-machine import in the commit path. |
| D2 | Undo during an in-flight immediate bake cancels the publish: neither terminal, no ledger entry, no error capsule, bake resolves false. | ✓ VERIFIED | Third terminal (`aquarelleVectorPathCommit.ts:126-154`); tests `publishes only the cancellation terminal when cancelled before the work starts` (`:247`), `takes the cancellation terminal when the predicate flips while the apply is pending` (`:265`), `never the failure terminal, when a cancelled apply rejects` (`:283`). UAT row G passed. |
| D3 | That undo restores THIS edit's pre-edit script and sheet through the revision-authoritative replay addressed by the exact `editId`; never the previous history entry, never a blind pop. | ✓ VERIFIED | Undo router (`PhysicsPaintStudio.tsx:6368-6392`); pins `replays the pending record exact editId through runScriptReplay, with one reanchor retry` and `reads the pending record before the history call and cancels its token` (`PhysicsPaintStudio.test.ts:8159,8144`). |
| D4 | A cancelled bake releases every latch it took and leaves the apply status at rest; the next edit commits normally. | ✓ VERIFIED | Latch release in `finally` before any terminal (`aquarelleVectorPathCommit.ts:126-154`); test `releases the in-flight latch before the cancellation terminal and still fails closed when already in flight` (`:336`); `onCancelled` sets status idle only (`PhysicsPaintStudio.tsx:10431-10436`). |
| D5 | When the in-flight work is the deferred Draft/wireframe settle, undo waits for that settle then runs the ordinary authoritative undo. | ✓ VERIFIED | `await draftSettlePromiseRef.current` before `rotoMoveHistoryUndo` (`PhysicsPaintStudio.tsx:6383-6386`); pin `awaits an in-flight deferred settle before the ordinary undo` (`PhysicsPaintStudio.test.ts:8178`). |
| D6 | A stale cancellation token never cancels a newer bake; arm/cancel/clear are token-keyed compare-then-write. | ✓ VERIFIED | Token record + identity checks (`vectorPathSession.ts:120-152`); tests `arms one fresh token per apply and a second arm supersedes the first`, `cancels only the current token`, `clears only the matching record` (`vectorPathSession.test.ts:409,432,468`). |
| D7 | In-app every exit restores the pre-entry wireframe and Draft because the Studio registers the exit hook once from a mount-scoped effect beside `resetForStudioOpen`, re-registers on settle identity change, and clears it on cleanup. | ✓ VERIFIED | `useEffect(..., [settleDraftScript])` with `registerPathEditExitHook` / `(null)` cleanup (`PhysicsPaintStudio.tsx:11519-11526`); exact-shape pin incl. the WR-01 `.catch` (`PhysicsPaintStudio.test.ts:8065-8124`). |

### Observable Truths — 62-05 (6)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| E1 | The source-scoped real cache identity is built in exactly ONE place and all real/defensive/linked/remap/persistence sites call it, producing byte-identical strings. | ✓ VERIFIED | `buildRotoRealCacheRevision` (`physicsPaintRotoPhysicalModel.ts:1539`), 7 production call sites (see R3), raw `:real:` construction outside the model = 0 (`grep -rn ":real:"` excluding tests → no matches); exact-string pins in `physicsPaintRotoPhysicalModel.test.ts`. |
| E2 | Adjacency probe: frames 0..4 resolve A..E, a loop whose placementStart is 5 resolves A under the same source-scoped family, frame 4 resolves E, and the boundary adds no cache entry, key or collision. | ✓ VERIFIED | Store probe `crosses the source/occurrence boundary with the same source identity, no added cache entry and no collision` (`physicPaintStore.rotoLoopClips.test.ts:353`). UAT row E passed. |
| E3 | Ordering probe: two loops over the same source resolve ONE identity; a single source-key re-bake moves every occurrence of both loops in the same transition, with `renderedFrame` the same object reference. | ✓ VERIFIED | Store probe `makes one source re-bake invalidate both loops in the same transition, rendered from the source payload by reference` (`:386`); shared-identity probe at `:223`. |
| E4 | Empty probe: `loop-placeholder` carries no `keyId`/`cacheRevision`; beyond-loop resolves null; neither can become a curve edit target or re-bake source. | ✓ VERIFIED | Store probe `resolves missing-source frames as loop-placeholder with no key identity, and frames beyond every loop as null` (`:463`); placeholder contract at `:491`. |
| E5 | No materialization: after a source-key re-bake the real-key record collection and Loop Clip collection are unchanged. | ✓ VERIFIED | Store probe `materializes no record and no loop change when the single source entry is re-baked` (`:434`). UAT row E passed. |
| E6 | Source-only entry: the painted stroke is selectable only on its recorded source frame; occurrence frames list nothing and report no recorded aquarelle script. | ✓ VERIFIED | `aquarelleStrokeSelection.test.ts` occurrence-frame pin; registry filter on `stroke.playFrame`; T-62-17 closed in `62-SECURITY.md`. UAT row F passed. |

### Observable Truths — UAT-driven additions (6)

These were not in the five plans; they landed from the 2026-11-14 UAT round and are verified against the current tree.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| U1 | The canvas can enter painted curve mode: a double-click on an eligible painted stroke normalises the selection and calls the ONE Studio entrance; an unregistered entrance or an ineligible stroke fails closed with no selection write and no latch. | ✓ VERIFIED | `requestAquarellePathEdit` painted branch (`AquarelleStrokeOverlay.tsx:43-60`) checks `resolvePaintedCurveEligibility().kind === 'painted'`, `hasPaintedCurveEntrance()`, writes the selection, then `requestPaintedCurveEntrance([mutationId])`; the slot is `registerPaintedCurveEntrance` in `vectorPathLatches.ts`, registered once by `PhysicsPaintStudio.tsx:11533-11534`; entrance promise handling is `void Promise.resolve(...).catch(...)` (WR-01 round fix, also at the dialog entrance `PhysicsPaintStrokeSettingsDialog.tsx:1060`). Pins: `routes an eligible painted stroke through the registered painted entrance (62-UAT)` and `fails closed on a painted stroke with no registered entrance (62-UAT)` (`VectorPathOverlay.test.ts:2798,2814`). |
| U2 | Vertex interaction is select-then-move: the first press on an unselected vertex only selects it (no drag, no commit); the second press begins the drag; the release still commits exactly ONE `onPathEdit` and writes no state before release. | ✓ VERIFIED | `VectorPathOverlay.tsx:1293-1346` (`alreadySelected` gate; `additive || !alreadySelected` returns before capture); test presses twice then moves/ups and asserts `onPathEdit` called once with the moved anchors and `aquarelleStrokesRevision.value` unchanged (`VectorPathOverlay.test.ts:3018-3042`). UAT row B records the approved interaction. |
| U3 | `vectorDrawn` vector-pen provenance is persisted and survives every copy/restore path: the AQTL v2 codec flag bit 4 (the bit is the whole marker, no payload byte), payload validation, Studio restore, the script-copy seam (Duplicate / +Key / rail-key) and both MCE mirrors. | ✓ VERIFIED | Flag `VECTOR_FLAG_DRAWN = 1 << 4`, write at `scriptTimelineCodec.ts:615`, read at `:920`, header documents bit 4 at `:40-58`; payload validation `codec.ts:128-129`, projection `toStudioStroke.ts:92,151,201`; restore `aquarelleRecordState.ts:1764-1785`; copy seam `physicsPaintRotoDuplicateScript.ts:210`; MCE `project.ts:365` / `project.rs:511`. Pins: `physicsPaintRotoDuplicateScript.vectorDrawn.test.ts` (carries / keeps absent), `scriptTimelineCodec.test.ts:739-753` (round-trip + absent-key), 62-REVIEW-DISPOSITION CR-01/WR-02/WR-03 fixed in `4b26cc5eb`. |
| U4 | The stroke list names vector provenance: a drawn path is its own `vector` filter category and a converted painted path is `<tool>-vector`; the labels and ordering are stable and painted strokes keep their tool category. | ✓ VERIFIED | `STROKE_VECTOR_FILTER_LABELS` (`strokeSettingsModel.ts:324-331`), `strokeRowFilterValue` (`:338-358`), `STROKE_FILTER_ORDER` (`:414-423`); rows carry `vectorDrawn` from `aquarelleStrokeSelection.ts:546-588` / `vectorPathHandles.ts:1019`; tests `strokeSettingsModel.test.ts:2238-2264` (categories, filtering, labels). |
| U5 | The Curve tab shows a READ-ONLY Vertex colour row for a vector selection: explicit anchor colour else the stroke colour, a Mixed caption when anchors disagree, no edit affordance. | ✓ VERIFIED | `anchorColorReading` (`PhysicsPaintStrokeSettingsDialog.tsx:738-748`), row at `:1489-1515` (`data-testid="stroke-settings-anchor-color"`); pins in `PhysicsPaintStrokeSettingsDialog.test.ts:975-993`. |
| U6 | The dialog's painted entrance (Curve tab) cannot leave an unhandled rejection: the async `enterPaintedCurve` promise is wrapped and failures are caught. | ✓ VERIFIED | `void Promise.resolve(bundle?.enterPaintedCurve?.([target])).catch(...)` (`PhysicsPaintStrokeSettingsDialog.tsx:1060`); 62-REVIEW-DISPOSITION WR-01 records the source pin. |

**Score:** 49/49 truths verified (2 passed via approved override; 0 present, behavior-unverified).

### Approved Overrides

Two plan truths named a mechanism the UAT round intentionally replaced. Both were approved with the phase UAT on 2026-11-14 (62-UAT.md row A) and are recorded in the frontmatter with an attributed acceptance:

1. **A8** — the first conversion now stores `curveMode: 'spline'` instead of omitting the key. The invariant that matters (preview mode equals persisted mode) is unchanged and pinned on both sides.
2. **C5** — the held-fit preview draws in the shared `DEFAULT_VECTOR_PATH_CURVE_MODE` constant rather than `resolveAquarelleCurveMode(stroke.curveMode)`. The same-mode outcome is preserved and pinned.

### Deferred Items

None. Phase 62 is the last phase in ROADMAP.md (roadmap analysis shows 61 and 62 as the final phases; no later phase covers any open item). The review findings that remain open are recorded product decisions in `62-REVIEW-DISPOSITION.md`, not roadmap scope.

### Advisory (New Scope, Unevidenced)

None. The review-round info findings (IN-01..IN-03) are recorded, deferred decisions with disposition entries; nothing new-scope and unevidenced is being carried as a blocker.

## Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `app/src/components/physic-paint/view/vectorPathFit.ts` | Pure interpolating fitter (auto anchors, capped, deterministic) | ✓ VERIFIED | `verify.artifacts` 5/5 for 62-01; read in full; bounded DP + turn pass + decimation, no RNG. |
| `app/src/components/physic-paint/view/vectorPathCurveBracket.ts` | Session-only held fit + wireframe bracket | ✓ VERIFIED | `curveFitSession`, `curveEntrySnapshot`, `resolveCurveExitAction`, CR-01/WR-01 teardown fix present. |
| `app/src/components/physic-paint/view/aquarelleRecordState.ts` | Conversion mode + D-07/D-08 law on the path writer | ✓ VERIFIED | `AquarellePathWriteOptions` at `:1107`, writers at `:1003`/`:1112`; one bump per write; `vectorDrawn` restored at `:1764-1785`. |
| `app/src/components/physic-paint/view/vectorPathHandles.ts` | `resampleVectorSpineWithPressureLaw` | ✓ VERIFIED | `:940`; count-preserving, endpoint-pinned, sentinel-preserving; `DEFAULT_VECTOR_PATH_CURVE_MODE` `:109`; drawn provenance `:1019`. |
| `app/src/components/physic-paint/view/aquarelleStrokeSelection.ts` | Pre/post snapshot pair through the same edit seam; row metadata | ✓ VERIFIED | `beginAquarellePathEdit` `:1075`, `restoreAquarelleEditSnapshot` `:1178`; `vectorDrawn` row metadata `:546-588`. |
| `app/src/components/physic-paint/view/strokeSettingsModel.ts` | Eligibility + gate painted arm + named refusals + vector filter categories | ✓ VERIFIED | 62-02 artifacts 4/4; eligibility `:921`, admits `:963`, gate `:1004`, filter labels `:324-358`. |
| `app/src/components/physic-paint/view/vectorPathLatches.ts` | ONE exit funnel + painted curve entrance slot | ✓ VERIFIED | Read in full; exit hook runs only on the open→closed transition; `registerPaintedCurveEntrance`/`hasPaintedCurveEntrance`/`requestPaintedCurveEntrance` (promise guarded). |
| `app/src/components/physic-paint/PhysicsPaintStudio.tsx` | `readCurveEntry` / `enterPaintedCurve`, widened writer seam, pending-apply arm, undo router, ONE exit-hook + ONE painted-entrance registration | ✓ VERIFIED | `:10305`, `:10317`, `:10345`, `:6368`, `:11519`, `:11533`. |
| `app/src/components/physic-paint/engine/VectorPathOverlay.tsx` | Held-fit fallback, ghost spine, D-09 envelope override, select-then-move | ✓ VERIFIED | 62-03 artifacts 2/2; `:951-1000`, `:1046-1098`, `:1114-1118`, `:1293-1346`. |
| `app/src/components/physic-paint/engine/AquarelleStrokeOverlay.tsx` | Canvas painted-curve entrance request | ✓ VERIFIED | `:43-60`; eligibility + entrance availability + fail-closed ordering. |
| `app/src/components/physic-paint/view/aquarelleStrokeBand.ts` | `hasRecordedPressureProfile` (D-09 predicate) | ✓ VERIFIED | `:195`; `buildStrokeBandCached` `:222`. |
| `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx` | Curve-tab entrance + read-only Vertex colour row | ✓ VERIFIED | Entrance `:1060`; colour reading `:738-748`, row `:1489-1515`. |
| `app/src/components/physic-paint/view/aquarelleVectorPathCommit.ts` | Third terminal `isCancelled`/`onCancelled` | ✓ VERIFIED | 62-04 artifacts 3/3; `:45-47`, `:126-154`. |
| `app/src/components/physic-paint/view/vectorPathSession.ts` | Token-keyed pending path-edit apply epoch | ✓ VERIFIED | `:120-152`; reset clears the pending record (`:210-215`). |
| `app/src/components/physic-paint/performance/scriptTimelineCodec.ts` | AQTL v2 flag bit 4 for `vectorDrawn` | ✓ VERIFIED | Header `:40-58`; flag `:190`; write `:615`; read `:920`. |
| `app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.ts` | Copy seam preserves `vectorDrawn` | ✓ VERIFIED | `aquarelleStrokeFromScriptEvent` `:181`; conditional spread `:210`. |
| `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts` | ONE `buildRotoRealCacheRevision` | ✓ VERIFIED | 62-05 artifacts 6/6; `:1539`. |
| `app/src/components/physic-paint/roto/rotoPhysicalOwnership.ts` | Remap through the builder | ✓ VERIFIED | `:153`. |
| `app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts` | Three persistence projections through the builder (paper suffix) | ✓ VERIFIED | `:297`, `:346`, `:566`. |
| `app/src/stores/physicPaintStore.ts` | Real + defensive-real + linked branches through the builder | ✓ VERIFIED | `:5794`, `:5840`, `:5855`. |
| `app/src/types/project.ts` | MCE `MceAquarelleVectorPath.vectorDrawn` mirror | ✓ VERIFIED | `:365`. |
| `app/src-tauri/src/models/project.rs` | Rust MCE mirror + serde rename | ✓ VERIFIED | `:511`. |
| `packages/efx-watercolor/src/payload/codec.ts` | Payload validation for `vectorDrawn` | ✓ VERIFIED | `:128-129` (only `true` accepted). |
| `packages/efx-watercolor/src/payload/toStudioStroke.ts` | Payload projection of `vectorDrawn` | ✓ VERIFIED | `:92`, `:151`, `:201`. |
| `app/src/stores/physicPaintStore.rotoLoopClips.test.ts` | CRV-03 edge probes | ✓ VERIFIED | 32 tests green; probes at `:353,386,434,463`. |
| `app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.vectorDrawn.test.ts` | CR-01 copy-seam pins | ✓ VERIFIED | 2 tests green: carries the marker, keeps it absent for converted paint. |

Artifact verifier results: 62-01 5/5, 62-02 4/4, 62-03 2/2, 62-04 3/3, 62-05 6/6 — all `all_passed: true`, no issues.

## Key Link Verification

`verify.key-links` returns `total: 0` for these plans because their `key_links` are prose strings, not `{from,to,via}` objects. Every link was therefore verified manually against the current code:

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `beginPaintedCurveSession` | `fitVectorPathAnchors` → `curveFitSession` | session-only fit | ✓ WIRED | Bracket imports the fitter and writes only signals; no document read/write. |
| `beginAquarellePathEdit` | `updateAquarellePathInScript` → `resampleVectorSpineWithPressureLaw` → payload entry → replay | one conversion write | ✓ WIRED | `aquarelleStrokeSelection.ts:1075` → `aquarelleRecordState.ts:1112` → `vectorPathHandles.ts:940`; path test `feeds the new spine to every replay through getAquarelleEventsForFrame` (`:505`). |
| `beginAquarellePathEdit` | `captureAquarelleSnapshot` → `storeAquarelleEdit` → `restoreAquarelleEditSnapshot` | one pre/post pair | ✓ WIRED | Restores points AND anchors (A3 test). |
| Dialog spline-pointer | `bundle.readCurveEntry` → `resolvePaintedCurveEligibility` | one record read | ✓ WIRED | `PhysicsPaintStrokeSettingsDialog.tsx:463-471`; no second store walk. |
| Dialog click (painted) | `enterPaintedCurve` → `armDraftBase` + fit + bracket + latch | ONE entrance | ✓ WIRED | `PhysicsPaintStrokeSettingsDialog.tsx:1060`; `PhysicsPaintStudio.tsx:10317`. |
| Canvas double-click (painted) | `requestAquarellePathEdit` → `requestPaintedCurveEntrance` → Studio `enterPaintedCurve` | ONE registered entrance | ✓ WIRED | `AquarelleStrokeOverlay.tsx:43-60`; `vectorPathLatches.ts`; `PhysicsPaintStudio.tsx:11533`; pins `VectorPathOverlay.test.ts:2798,2814`. |
| Any `exitPathEdit` caller | latch transition → registered hook → `endCurveBracket` | ONE funnel | ✓ WIRED | `vectorPathLatches.ts`; hook registered at `PhysicsPaintStudio.tsx:11519`. |
| `VectorPathOverlay.onPathEdit` | `handleAquarelleVectorPathEdit` → `admitsPathEditWrite` → commit | ONE write route | ✓ WIRED | `PhysicsPaintStudio.tsx:10482`; `strokeSettingsModel.ts:963`. |
| `pathEditMutationId` + `curveFitSession` | edit-target resolution → `drawnPathOf` → interactivity + one gesture commit | held-fit fallback | ✓ WIRED | `VectorPathOverlay.tsx:951-1000`. |
| Held fit + record stroke | `DEFAULT_VECTOR_PATH_CURVE_MODE` / `resolveAquarelleCurveMode(stroke.curveMode)` → `DrawnVectorPath.curveMode` | preview === persisted mode | ✓ WIRED | `VectorPathOverlay.tsx:993`; `PhysicsPaintStudio.tsx:10354-10359`; tests `:3114`, `:3133`. |
| Pointer press on a vertex | selection update → `alreadySelected` gate → drag capture → one commit on release | select-then-move | ✓ WIRED | `VectorPathOverlay.tsx:1293-1346`; test `:3018-3042`. |
| `handleVectorPathEditKey` | record anchors else `getHeldFit` → `deleteAnchorsAt` → one `onPathEdit` | held-fit Delete seam | ✓ WIRED | `VectorPathOverlay.tsx` handler refs; test `:2983`. |
| `curveFitSession.sourcePoints` | `uvToScreen` → ghost polyline | display-only ghost | ✓ WIRED | Test `:3079`/`:3098`. |
| Wireframe/preview switch + `hasRecordedPressureProfile` | `buildStrokeBandCached` → `DrawnVectorPath.envelopePx` → envelope nodes | D-09 band | ✓ WIRED | `VectorPathOverlay.tsx:1074-1078`; band tests. |
| `commitAquarelleVectorPathEdit` | `beginPathEditApply(token)` → `runAquarelleScriptRebake(isCancelled)` → one terminal → `clearPathEditApply(token)` | exactly one terminal | ✓ WIRED | `PhysicsPaintStudio.tsx:10378-10447`; commit tests. |
| `undo` | `pendingPathEditApply.peek()` → cancel → await settled bake → `runScriptReplay({direction:'undo', editId})` → sync | exact-editId replay | ✓ WIRED | `PhysicsPaintStudio.tsx:6368-6392`; router pins. |
| `undo` | `draftSettlePromiseRef.current` → await → `rotoMoveHistoryUndo` | deferred-settle ordering | ✓ WIRED | `PhysicsPaintStudio.tsx:6383-6386`; pin `:8178`. |
| Mount scope | `registerPathEditExitHook(() => endCurveBracket)` beside `resetForStudioOpen` | ONE registration | ✓ WIRED | `PhysicsPaintStudio.tsx:11519-11526`; exact-shape pin `:8065-8124`. |
| Mount scope | `registerPaintedCurveEntrance(enterPaintedCurve)` | ONE registration | ✓ WIRED | `PhysicsPaintStudio.tsx:11533-11534`. |
| Vector pen draw | `vectorPathHandles.ts:1019` → `toStudioStroke` → AQTL bit 4 → restore | persisted provenance | ✓ WIRED | `vectorPathHandles.ts:1019`; `toStudioStroke.ts:201`; `scriptTimelineCodec.ts:615/920`; `aquarelleRecordState.ts:1764-1785`. |
| Script copy/duplicate | `aquarelleStrokeFromScriptEvent` → `vectorDrawn` conditional spread | provenance survives copy | ✓ WIRED | `physicsPaintRotoDuplicateScript.ts:210`; vectorDrawn test. |
| Selection rows → dialog filter | `vectorDrawn` row metadata → `strokeRowFilterValue` → labels | vector filter categories | ✓ WIRED | `aquarelleStrokeSelection.ts:546-588`; `strokeSettingsModel.ts:338-358`; tests `:2238-2264`. |
| Store real/linked branches | `buildRotoRealCacheRevision` → shared display cache identity | source-scoped identity | ✓ WIRED | 7 call sites; zero raw construction sites. |
| Source-key re-bake | new payload bytes → `rasterRevision` → every linked occurrence identity moves together | joint invalidation | ✓ WIRED | Store probe `:386`. |
| Loop resolution | `'linked'` returns the SOURCE record → builder(record.keyId) | one cache entry for all occurrences | ✓ WIRED | Store probe `:223`. |
| `listSelectableAquarelleStrokes(playFrame)` | registry filter on `stroke.playFrame` → occurrence frames list nothing | source-only entry | ✓ WIRED | D-11 pin in `aquarelleStrokeSelection.test.ts`. |

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `VectorPathOverlay.tsx` (held fit) | `curveFitSession` | `beginPaintedCurveSession` ← `getRecordedAquarelleStroke(stroke).points` | Yes — real recorded samples, no mock | ✓ FLOWING |
| `aquarelleRecordState.ts` (conversion) | `nextStroke.points` | `resampleVectorSpineWithPressureLaw(sampledSpine, stroke.points)` | Yes — derived from the edited anchors and the real source pressures | ✓ FLOWING |
| `PhysicsPaintStudio.tsx` (undo router) | `pendingPathEditApply` | `beginPathEditApply` armed by the real commit; replayed via `runScriptReplay({editId})` | Yes — real ledger id | ✓ FLOWING |
| `physicPaintStore.ts` (loop identity) | `cacheRevision` | `buildRotoRealCacheRevision(rasterRevision, record.keyId)` | Yes — real revision + key id; no static fallback | ✓ FLOWING |
| `scriptTimelineCodec.ts` (provenance) | `engine.vectorDrawn` | `vectorPathHandles.ts:1019` on a real draw → payload → AQTL bit 4 → decode | Yes — real stroke provenance, absent for converted paint | ✓ FLOWING |
| `AquarelleStrokeOverlay.tsx` (canvas entry) | `requestPaintedCurveEntrance` | `requestAquarellePathEdit` ← real stroke eligibility and the registered Studio entrance | Yes — real store read and real entrance callback | ✓ FLOWING |

No static return, hardcoded literal or mock ends any of these chains.

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| All phase app suites (fit, bracket, latches, handles, session, path writer, selection, gate, dialog, band, commit, overlay, Studio, roto model, ownership, loop resolver, persistence coordinator, copy seam, vector provenance, store loop clips) | `pnpm --filter efx-motion-editor exec vitest run <23 phase files>` | 23 files passed, 1271 tests passed, exit 0 (this run, current tree) | ✓ PASS |
| Watercolor payload contract (`codec`, `toStudioStroke`, `vectorPath`, …) | `pnpm --filter @efxlab/efx-watercolor exec vitest run <4 payload files>` | 4 files passed, 132 tests passed, exit 0 (this run, current tree) | ✓ PASS |
| Full app + package suites (provided evidence) | Full `vitest run` (orchestrator run, current tree) | App 438 files / 9,221 tests (1 skipped, 96 todo); watercolor 15 files / 306 passed (8 skipped); `pnpm typecheck` and `cargo check` pass | ✓ PASS |
| Artifact existence/substance | `gsd_run query verify.artifacts` × 5 plans | 5/5, 4/4, 2/2, 3/3, 6/6 — all passed | ✓ PASS |
| Commit hashes cited by this round's records exist | `gsd_run query verify.commits 4b26cc5eb a07baf51b 84f544d60 e6ba5b8b9 ce53cad0a 8851c38a7 83387f2ca 52ec2fef0 d4f1c636b b996d4693 c1199447a 2c4df2459 5264dedf4` | valid 13, invalid 0 | ✓ PASS |
| No new runtime dependency (REL-01) | `git diff --name-only 5264dedf4..HEAD \| grep -E 'package.json\|pnpm-lock.yaml\|Cargo.toml\|Cargo.lock'` | no matches since the phase plan was created | ✓ PASS |
| ONE cache-identity builder, no raw literals | `grep -rn ':real:' app/src` excluding tests and the model | no matches; 7 builder call sites | ✓ PASS |
| Debt markers / placeholders in changed files | `grep -E 'TBD\|FIXME\|XXX'` and placeholder/console-only scans over the phase implementation files | no matches | ✓ PASS |
| Skipped / exclusive / todo tests | `grep -E '\.(skip\|only\|todo)\(\|xit\(\|xdescribe\('` over the phase test files | no matches | ✓ PASS |
| Decision coverage | `gsd_run query check.decision-coverage-verify <phase dir> <62-CONTEXT.md>` | 14/14 trackable decisions honored, `not_honored: []`, non-blocking | ✓ PASS |

## Probe Execution

Not applicable — no `scripts/*/tests/probe-*.sh` exist and no probe script is declared in any phase artifact. The plans' "Probe (CRV-03 …)" rows are investigation hypotheses resolved by unit probes in `physicPaintStore.rotoLoopClips.test.ts`, not executable probe scripts.

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| CRV-01 | 62-01, 62-02, 62-03 | User can select a painted stroke and enter curve mode, with anchors fitted on entry | ✓ SATISFIED | R1, A1-A6, B1-B7, C1-C7; gate/entry/overlay/canvas-entrance code + tests green; UAT row A passed. |
| CRV-02 | 62-01, 62-04 | Editing anchors/handles commits as one ledger entry and re-bakes from the recovered pre-script base rather than deforming cached pixels | ✓ SATISFIED | R2/A2/A7/A9/A10/A11; one-write/one-entry/base-arming/identity pins green; UAT rows B/D passed; WR-02 tilt exception accepted for v1 (recorded decision). |
| CRV-03 | 62-05 | Every loop occurrence of the edited stroke is invalidated together | ✓ SATISFIED | R3, E1-E6; single builder + 32 loop-clip probes green; UAT rows E/F passed. |
| CRV-04 | 62-04 | Undo cancels or settles an in-flight bake | ✓ SATISFIED | R4, D1-D7; three-terminal sequence + epoch + router pins green; UAT row G passed. |

REQUIREMENTS.md maps CRV-01..04 to Phase 62 and marks all four `[x]`; every plan's `requirements:` field claims exactly these IDs (62-01: CRV-01/02; 62-02: CRV-01; 62-03: CRV-01; 62-04: CRV-02/04; 62-05: CRV-03). No ORPHANED requirements (Phase 62 = 4 mapped, 4 claimed).

## Anti-Patterns Found

Debt-marker gate: `grep -E "TBD|FIXME|XXX"` over the changed implementation files returns nothing, with or without an issue reference. No `TODO`/`HACK`/`PLACEHOLDER` in the changed files. No placeholder copy or empty-handler stubs in the new modules; the `return null` / `return []` matches are documented fail-closed guards covered by tests. No `.skip`/`.only`/`.todo` in any phase test file; no trivial `expect(true)` assertions.

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `app/src/components/physic-paint/view/aquarelleRecordState.ts` | `1148-1155` (and `1044-1051`) | Conversion stamps `tx: 0, ty: 0`, discarding recorded stylus tilt (WR-02) | ℹ️ Info | Accepted for v1 by recorded decision (62-UAT.md row 8) and deferred in 62-REVIEW-DISPOSITION.md; repaint dab azimuth changes for fixed-rotation anisotropic brushes. |
| `app/src/components/physic-paint/PhysicsPaintStudio.tsx` | `10346-10354` | Busy gates not re-read after `await ensureAquarelleDurableBaseRef…` (WR-03) | ℹ️ Info | Accepted for v1 by recorded decision (62-UAT.md row 9); failure mode stays fail-closed with no half-written terminal. Deferred in 62-REVIEW-DISPOSITION.md. |
| `app/src/components/physic-paint/PhysicsPaintStudio.tsx` | `6368-6392` | Both cancelled-bake undo replays refused → silent `false` (WR-04) | ℹ️ Info | Accepted for v1 by recorded decision (62-UAT.md row 10); fallback restore + refusal copy deferred in 62-REVIEW-DISPOSITION.md. |
| `app/src/components/physic-paint/view/aquarelleStrokeBand.ts` | `191-205` | Doc claims malformed-input fail-closed but a null element would throw (IN-02, new round) | ℹ️ Info | Unreachable through the loader; doc/implementation mismatch only. Deferred in 62-REVIEW-DISPOSITION.md. |
| `app/src/components/physic-paint/view/vectorPathSession.ts` | `210-216` | `resetForStudioOpen` omits `curveFitSession`/`curveEntrySnapshot` (IN-03, prior round) | ℹ️ Info | Latent under the one-mount-per-webview topology. Deferred in 62-REVIEW-DISPOSITION.md. |
| `app/src/components/physic-paint/view/strokeSettingsModel.ts` | `324-331` | `'lift-vector': 'Eraser-Vector'` unreachable label (IN-01, new round) | ℹ️ Info | `ScriptStrokeFilterValue` excludes it and lift rows resolve to `'lift'`; cosmetic. Deferred in 62-REVIEW-DISPOSITION.md. |
| `app/src/components/physic-paint/engine/AquarelleStrokeOverlay.tsx` | `43-60` | `requestAquarellePathEdit` doc says any refusal leaves selection untouched, but the painted branch writes selection before the async entrance can refuse (IN-03, new round) | ℹ️ Info | Doc/implementation mismatch only; the entrance itself fails closed. Deferred in 62-REVIEW-DISPOSITION.md. |

Fixed since the previous run (62-REVIEW-DISPOSITION.md, `4b26cc5eb`): CR-01 (the script-copy seam dropped `vectorDrawn`), WR-01 (unhandled promise at the Curve-tab painted entrance), WR-02 (AQTL v2 header missing flag bit 4), WR-03 (`vectorDrawn` undeclared in the MCE mirrors and the exact-keys pin). The earlier round's CR-01/WR-01 (teardown destroyed a newer capture; no try/finally around the await) remain fixed in `a07baf51b` and are re-verified by the current bracket pins.

## Test Quality Audit

- No skipped, only, or todo tests in any phase test file; no vacuous assertions.
- The UAT-driven pins are behavioral and non-vacuous: the painted entrance test asserts the entrance callback and selection normalization plus the fail-closed case; the select-then-move test presses twice, moves, releases and asserts exactly one `onPathEdit` with unchanged revision; the `vectorDrawn` tests assert presence on copy and absence for converted paint; the codec test asserts the flag round-trips and that an absent marker writes no key.
- The phase mixes behavioral tests (fitter, bracket teardown, writer law, rebake terminals, overlay gestures, loop-clip probes) with the repository's established Studio source-pin pattern for internals that cannot be mounted in vitest (undo router ordering, effect registration shape, deferred-branch order). The source pins assert structure AND are paired with behavioral module tests, so they are not circular.
- `62-VALIDATION.md` per-task map: 15/15 rows automated and green; the manual rows are the UAT gate, now completed.
- Decision coverage gate: 14/14 trackable CONTEXT.md decisions honored, `not_honored: []`.

## Human Verification Required

None. The human-verification round is complete: `62-UAT.md` records 10/10 rows passed on 2026-11-14 — the seven native UAT rows (A-G) and the three recorded product decisions (WR-02, WR-03, WR-04). Each UAT-driven behavior that landed afterwards has deterministic pins (U1-U6). No new human item arises from this run, and no item is re-raised without a new concrete reason.

## Gaps Summary

No blocking gaps. All 26 declared/extended artifacts exist and pass the substantive check; every prose key link is wired in code and covered by tests; no debt markers, no stubs, no skipped tests, and no new runtime dependency. The two must-haves whose literal mechanism the UAT round replaced (A8, C5) carry attributed, approved overrides, and the invariant they exist to protect — the curve mode previewed is the curve mode persisted — is test-pinned on both sides. The remaining review findings are recorded, deferred product decisions, not must-have failures. The phase goal is achieved on the current tree.

---

_Verified: 2026-11-14T18:24:59Z_
_Verifier: Claude (gsd-verifier)_
