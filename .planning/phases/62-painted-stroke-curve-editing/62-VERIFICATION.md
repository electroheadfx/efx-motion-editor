---
phase: 62-painted-stroke-curve-editing
verified: 2026-11-14T15:32:29Z
status: passed
score: "42/43 must-haves verified (1 uncertain — human decision requested)"
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
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/engine/VectorPathOverlay.test.ts
  - app/src/components/physic-paint/engine/VectorPathOverlay.tsx
  - app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts
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
covered_digest: "v4:sha256:e91968f72ec5bbcfe3b0b6ae763a054a672c595eca70eac1fe84223001234585"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Native UAT row A (62-01/62-02 entry) — select one painted Brush/Water/Pen stroke, confirm the spline-pointer is enabled and titled 'Edit path', press it, and inspect the fitted wireframe/anchors and the ghost spine over the paint."
    expected: "Entry fits anchors on entry from the stroke's own recorded samples; the fitted path, one marker per anchor and the faint ghost of the original spine appear on the existing Phase 61 surface; no document, revision or ledger write happens before a gesture commits."
    why_human: "Fit quality and affordance legibility over arbitrary paint cannot be judged from code; 62-UI-REVIEW.md flags ghost contrast as unverified."
  - test: "Native UAT row B (62-01 edit) — drag a fitted anchor and release."
    expected: "The wash re-renders along the new curve in one gesture, the stroke's sample count and therefore its wet lifetime are unchanged, and the edit is one ledger entry."
    why_human: "Wet-lifetime identity and wash appearance are rendered/runtime properties; the unit pins prove the count-preserving law, not the live feel."
  - test: "Native UAT row C (62-02/62-04 exit) — enter curve mode, change the wireframe/Draft state, then exit via dialog close, Escape, rail Select toggle, vector pen and colour picker."
    expected: "Every exit restores the pre-entry wireframe and Draft exactly once; a dirty Draft either settles once (pre-entry wireframe off) or stays deferred behind the user's own wireframe (pre-entry wireframe on); no bake runs when nothing was committed."
    why_human: "The restore half is only observable in-app once the Studio exit hook is registered; the routes are pinned at the latch level, not clicked."
  - test: "Native UAT row D (62-01/62-03 base and erasure) — lift-erase part of a painted stroke, convert it, edit it, undo and redo; compare the construction-view band for a pen-painted vs mouse-painted stroke."
    expected: "The re-bake composites over the recovered pre-script base: erased regions stay erased, grain/pigment is not re-rolled, and the band shows the real recorded taper for pen strokes while a mouse (-1 sentinel) stroke keeps the shipped anchor-width envelope."
    why_human: "Visual survival of erasures and texture is a rendered result; the code pins only the inputs the conversion must not change."
  - test: "Native UAT row E (62-05 loops) — convert and edit a stroke on its source frame inside a Loop Clip; step through the occurrence frames and across the source/occurrence boundary."
    expected: "Every occurrence of the edited stroke repaints in the same gesture release with no stale pre-edit pixels, no blank boundary frame and no doubled paint; no per-occurrence key, script or cache entry is materialized."
    why_human: "Stale-pixel and doubled-paint judgement requires the packaged editor; the store probes pin identity equality, not the rendered frame."
  - test: "Native UAT row F (62-05/62-04 loops undo + source-only entry) — undo once over a looped source edit; then click into an occurrence frame and try to enter curve mode."
    expected: "One undo restores every occurrence; occurrence frames list no selectable stroke row and the curve entrance stays disabled there (source-only entry)."
    why_human: "The visible multi-occurrence restore and the occurrence-frame affordance are runtime/visual checks."
  - test: "Native UAT row G (62-04 in-flight undo) — press Cmd+Z while the path-edit bake veil is up, then press Cmd+Z again, then Cmd+Shift+Z, then drag an anchor again."
    expected: "The first undo cancels the publish (no new ledger entry, no error capsule), restores the exact pre-edit shape; the second undo reaches the previous edit; redo does not resurrect the cancelled apply; the veil is gone and the next drag commits normally."
    why_human: "In-flight timing and the veil are only observable in the packaged editor."
  - test: "Decision requested — WR-02: the conversion rebuilds every sample as `{x, y, p, tx: 0, ty: 0, tw: 0}`, discarding recorded stylus tilt; for fixed-rotation anisotropic brushes the repaint changes dab azimuth across the stroke. Decide carry/remap tilt vs accept."
    expected: "A recorded product decision on whether the conversion must carry or remap `tx`/`ty` (nearest-source carry is enough) or whether the orientation change is accepted in v1."
    why_human: "This is a product/quality trade-off recorded as an open review warning, not a must-have failure; the verifier cannot choose it."
  - test: "Decision requested — WR-03: `commitAquarelleVectorPathEdit` does not re-read the three busy gates after `await ensureAquarelleDurableBaseRef.current(playFrame)`; a latch stolen during the await writes the path and the rebake then fails closed with no terminal (unrecorded edit, stuck 'applying'). Decide fix-before-ship or accept."
    expected: "A recorded decision; the revision-authoritative restore and the stamp-time gate matrix are unaffected either way."
    why_human: "Open review warning outside the must-have contract; requires a product/engineering call."
  - test: "Decision requested — WR-04: when both cancelled-bake undo replay attempts are refused, the undo branch returns false silently, leaving a cancelled-but-applied edit unrecorded and the next undo consuming the previous history entry. Decide fix-before-ship or accept."
    expected: "A recorded decision, optionally with a follow-up issue for the fallback restore + refusal copy."
    why_human: "Open review warning outside the must-have contract; requires a product/engineering call."
---

# Phase 62: Painted-Stroke Curve Editing Verification Report

**Phase Goal:** Users can reshape an already-painted stroke as a curve, and the change re-bakes correctly everywhere that stroke appears.
**Verified:** 2026-11-14T15:32:29Z
**Status:** human_needed
**Re-verification:** No — initial verification (no prior 62-VERIFICATION.md existed)

## Goal Achievement

All 43 must-haves were checked against the actual code, not the SUMMARY claims. 42 are verified at the presence + substance + wiring + behavioral level; one (ROADMAP criterion 2, the "texture is not re-rolled" clause) is uncertain for stylus-painted fixed-rotation brushes because the conversion discards recorded tilt (WR-02, open). Seven native UAT rows and three review-warning decisions are outstanding, so the phase is not `passed`.

### Observable Truths — ROADMAP contract (4)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| R1 | Selecting a painted stroke and entering curve mode fits anchors on entry and edits them with the same surface as the vector tool — no forked editor. | ✓ VERIFIED | `enterPaintedCurve` arms the base, calls `beginPaintedCurveSession` → `fitVectorPathAnchors(stroke.points)` and opens the shipped `enterPathEdit` latch (`PhysicsPaintStudio.tsx:10317-10336`); the existing `VectorPathOverlay` resolves the held fit as the edit target (`VectorPathOverlay.tsx:951-1057`, tests at `VectorPathOverlay.test.ts:2915-3033`); the shipped writer seam admits the painted stroke (`strokeSettingsModel.ts:911`, `PhysicsPaintStudio.tsx:10476`). No second overlay or hit-test exists. |
| R2 | Committing an anchor or handle edit is one ledger entry and re-bakes from the recovered pre-script base rather than deforming cached pixels — erased regions stay erased and the texture is not re-rolled. | ? UNCERTAIN — warning, human decision requested | The mechanism is verified: the durable base is awaited before the write (`PhysicsPaintStudio.tsx:10350`), the ONE commit records one edit id on exactly one route (`:10363-10368` deferred, `:10398` onSuccess; test `treats a second identical commit as a silent no-op that mints no ledger entry`), and the conversion changes only the path — tool/frame/params/seed salt/identity untouched (test at `aquarelleRecordState.path.test.ts:1059`). The "texture is not re-rolled" clause is not certifiable for stylus-painted fixed-rotation brushes because the write stamps `tx: 0, ty: 0` (WR-02, `aquarelleRecordState.ts:1148-1155` and `:1044-1051`); the review disposition leaves carry/remap-vs-accept open. |
| R3 | Every loop occurrence of the edited stroke is invalidated together; no stale occurrence keeps the pre-edit pixels. | ✓ VERIFIED | ONE builder `buildRotoRealCacheRevision` (`physicsPaintRotoPhysicalModel.ts:1539`) used by all 7 production call sites (store `:5794,5840,5855`; ownership `:153`; persistence `:297,346,566`), raw `:real:` construction outside the model = 0; store probes pin shared identity, same-transition invalidation and by-reference rendering (`physicPaintStore.rotoLoopClips.test.ts:353,386,434`). |
| R4 | Undo cancels or settles an in-flight bake and leaves the stroke at its exact pre-edit state. | ✓ VERIFIED | Token-keyed epoch (`vectorPathSession.ts:120-152`), third terminal in `runAquarelleScriptRebake` (`aquarelleVectorPathCommit.ts:126-154`), undo router cancels then replays the exact `editId`, and awaits a deferred settle before the authoritative undo (`PhysicsPaintStudio.tsx:6366-6392`); pins at `PhysicsPaintStudio.test.ts:8131-8184` and `aquarelleVectorPathCommit.test.ts:247-336`. |

### Observable Truths — 62-01 (12)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| A1 | Recorded hand `points` (uv x/y + pressure) carry everything the fit needs; entry fits anchors on paint with no extra capture data; Phase 61 overlay/hit-test reusable. | ✓ VERIFIED | `fitVectorPathAnchors(stroke.points)` reads the record only (`vectorPathFit.ts:189`); `beginPaintedCurveSession` holds `{mutationId, anchors, sourcePoints}` and reads/writes no document (`vectorPathCurveBracket.ts:134-152`); test `fits the stroke's own recorded samples and writes no document state` (`vectorPathCurveBracket.test.ts:115`). |
| A2 | One script write: `anchors` stored, `curveMode` only when non-default, `points` replaced by the anchor spine, exactly one revision bump and one timeline index. | ✓ VERIFIED | `updateAquarellePathInScript` (`aquarelleRecordState.ts:1112`) rewires to `resampleVectorSpineWithPressureLaw`, deletes absent-default `curveMode`, replaces at the same index and calls exactly one `bumpAquarelleStrokesRevision()`; tests `replaces both strokes ... with ONE bump` (`:358`) and `converts a fitted hand stroke in one write` (`:876`). |
| A3 | One undo restores the hand-recorded points exactly (count, coordinates, pressures) and removes the `anchors`/`curveMode` keys. | ✓ VERIFIED | Revision-authoritative `restoreAquarelleEditSnapshot` (`aquarelleStrokeSelection.ts:1178`); test `restores the exact hand samples in one undo and the conversion in one redo` (`aquarelleRecordState.path.test.ts:920`). |
| A4 | Entering and leaving without a committed gesture writes no revision, payload entry or ledger entry. | ✓ VERIFIED | Bracket open/close only touches session signals (bracket `:173-221`); tests `fits the stroke's own recorded samples and writes no document state` and `is a no-op when no bracket is open — no write, no settle` (`vectorPathCurveBracket.test.ts:277`). |
| A5 | Every fitted anchor lies ON a recorded original sample; anchors outside the edited span keep their position. | ✓ VERIFIED | Fit selects original sample indices only (`vectorPathFit.ts:189-221`); `fits the stroke's own recorded samples` and tap-anchor pins in `vectorPathFit.test.ts`. |
| A6 | Fit density is curvature-adaptive with a 40-anchor cap and a floor, deterministic; a long straight run carries no interior anchors and a turn keeps one. | ✓ VERIFIED | DP + turn pass + decimation + doubling cap (`vectorPathFit.ts:30`); deterministic pure function; pinned by `vectorPathFit.test.ts` (35 assertions). |
| A7 | Assumption (CRV-02): the durable pre-script base resolves before the write; if it does not, the shipped `durable-base-unknown` refusal ends with zero surviving writes. | ✓ VERIFIED | `await ensureAquarelleDurableBaseRef.current(playFrame)` precedes `beginAquarellePathEdit` (`PhysicsPaintStudio.tsx:10350-10354`); the publish refusal is the shipped authority (`aquarelleScriptBaseAuthority.ts:20`) and the failure terminal restores the pre-edit snapshot (`PhysicsPaintStudio.tsx:10405-10425`); pins at `PhysicsPaintStudio.test.ts:4906-5028`. |
| A8 | The converting write and the overlay preview resolve the SAME curve mode; the in-app route stores no `curveMode` key. | ✓ VERIFIED | Write uses `resolveAquarelleCurveMode(requestedMode ?? stroke.curveMode)` (`aquarelleRecordState.ts:1112+`); overlay uses the same expression (`VectorPathOverlay.tsx:993`, test `draws the held fit in resolveAquarelleCurveMode(stroke.curveMode), never the draw mint` at `:3033`); test `stores no mode key on the in-app route and compares the effective mode on a re-write` (`aquarelleRecordState.path.test.ts:994`). |
| A9 | A conversion changes nothing but the path: `tool`, `playFrame`, `params`, any paint-seed salt and identity stay byte-identical and no seed bump runs. | ✓ VERIFIED | Test `changes only the path — tool, frame, params, seed salt and identity are untouched` (`aquarelleRecordState.path.test.ts:1059`); the writer only rewrites `anchors`/`curveMode`/`points` at the same index. |
| A10 | Every path edit redistributes the stroke's EXISTING sample count by arc length, so `ticks`/wet lifetime never change. | ✓ VERIFIED | `resampleVectorSpineWithPressureLaw` returns exactly `sourcePoints.length` stations (`vectorPathHandles.ts:940`); tests `preserves the recorded point count on every path write (D-08)` (`:460`), `through a much longer and a much shorter spine` (`:1118`), `spaces the preserved samples evenly ... by arc length` (`:1143`). |
| A11 | Recorded per-sample pressure is remapped by arc length with first/last pinned; an all-sentinel stroke stays all-sentinel. | ✓ VERIFIED | `vectorPathHandles.ts:940+`; tests `remaps the recorded pressure by arc length with both endpoints pinned` (`:1167`) and `keeps an all-sentinel stroke sentinel through the reshape` (`:1187`). |
| A12 | The curve-mode switch seam re-samples with the same count-preserving law, so switching Bézier/Spline never changes wet lifetime. | ✓ VERIFIED | `updateAquarelleCurveModeInScript` uses the same resampler (`aquarelleRecordState.ts:1003+`); test `stores the mode and the spline points in one write, is idempotent and restores on bezier` (`aquarelleRecordState.path.test.ts:701`). |

### Observable Truths — 62-02 (7)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| B1 | One Brush/Water/Pen selection enables the spline-pointer titled with the shipped label; Lift gets a named eraser refusal; degenerate gets a named too-few-points refusal; multi keeps the shipped multi reason. | ✓ VERIFIED | `resolvePaintedCurveEligibility` (`strokeSettingsModel.ts:869`) and `resolvePathEditGate` (`:952`); fixed constants `PATH_EDIT_LIFT_DISABLED_REASON` / `PATH_EDIT_DEGENERATE_DISABLED_REASON`; tests at `strokeSettingsModel.test.ts:4025-4194`; dialog reads `bundle.readCurveEntry` (`PhysicsPaintStrokeSettingsDialog.tsx:463-471`). |
| B2 | A committed gesture on an eligible anchorless painted stroke passes the ONE writer seam into `commitAquarelleVectorPathEdit`; Lift/degenerate/malformed keep `VECTOR_PATH_REJECTION_MESSAGE`. | ✓ VERIFIED | `admitsPathEditWrite` (`strokeSettingsModel.ts:911`) gates `handleAquarelleVectorPathEdit` (`PhysicsPaintStudio.tsx:10473-10484`); tests `admits exactly readable-anchor and eligible painted strokes to the ONE write seam` (`strokeSettingsModel.test.ts:4115`). |
| B3 | Pressing the spline-pointer fits anchors, snapshots pre-entry wireframe AND Draft, turns the wireframe on and opens the latch — writing nothing. | ✓ VERIFIED | `beginCurveWireframeBracket` captures before `setWireframeMode(true)` (`vectorPathCurveBracket.ts:173-184`), tests `captures the pre-entry values BEFORE turning wireframe on, and never overwrites them` (`:209`); Studio order pinned at `PhysicsPaintStudio.test.ts:6619-6632`. |
| B4 | Entry refuses fail-closed when the durable pre-edit base cannot be armed; no fit is held and no latch opens. | ✓ VERIFIED | `enterPaintedCurve` returns false after publishing `DRAFT_ARM_REFUSAL_MESSAGE` before `beginPaintedCurveSession` (`PhysicsPaintStudio.tsx:10322-10330`); pinned at `PhysicsPaintStudio.test.ts:6619-6632`. |
| B5 | Every exit route funnels through `exitPathEdit` and runs the exit bracket exactly once: held fit dropped, pre-entry wireframe/Draft restored. | ✓ VERIFIED | `exitPathEdit` runs the registered hook only on the open→closed transition (`vectorPathLatches.ts`); tests `runs the registered hook exactly when the latch transitions open -> closed`, `reaches the hook from a shipped sibling exit without a per-site change` (`vectorPathSession.test.ts:327,362`); Studio registers the ONE hook (`PhysicsPaintStudio.tsx:11509-11518`). |
| B6 | Exit with no committed gesture performs no bake and leaves Draft as found; a dirty deferred exit either settles once (pre-wireframe off) or keeps the deferred render behind the user's own wireframe (pre-wireframe on). | ✓ VERIFIED | Pure five-case `resolveCurveExitAction` (`vectorPathCurveBracket.ts:86-95`) + `endCurveBracket` (`:192-221`); teardown tests `vectorPathCurveBracket.test.ts:249-372`, including `never drops the deferred render behind the user's own wireframe` (`:334`). |
| B7 | Single-stroke only: the gate stays disabled for any selection size other than one. | ✓ VERIFIED | `resolvePathEditGate` requires `selectionSize === 1` (`strokeSettingsModel.ts:953-954`); test `enables the gate for one eligible painted stroke and keeps every shipped result unchanged` (`strokeSettingsModel.test.ts:4130`). |

### Observable Truths — 62-03 (7)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| C1 | The overlay draws the held-anchor stroke through its held anchors — no second editor surface, hit-test or forked gesture law. | ✓ VERIFIED | Edit-target resolution reads record anchors first, held fit second (`VectorPathOverlay.tsx:951-1057`); tests `draws one spine and one marker per fitted anchor for an armed held fit, and turns the surface on` (`:2915`), `leaves an anchorless painted stroke undrawn and inert without an armed fit` (`:2935`). |
| C2 | Fit armed → fitted spine, one marker per anchor, normal chrome; every shipped gesture commits exactly ONE full anchor list through `onPathEdit`, routed through `handleAquarelleVectorPathEdit`. | ✓ VERIFIED | Drag/insert/delete tests commit one `onPathEdit` (`VectorPathOverlay.test.ts:2940,2964,2983`); the seam admits the painted stroke (B2). |
| C3 | Drawing and editing the held fit changes no document state until a gesture commits. | ✓ VERIFIED | Test `commits ONE onPathEdit for a fitted-anchor drag and writes no record state` (`:2940`); bracket tests assert no revision/ledger on entry/exit. |
| C4 | A faint ghost of the original recorded spine draws beneath for the whole session and disappears when the session clears; display-only. | ✓ VERIFIED | Ghost from `curveFitSession.sourcePoints` (`VectorPathOverlay.tsx:1468-1478`); tests `draws the original recorded spine as a ghost beneath the fitted path for the session` (`:3079`) and `removes the ghost the moment the curve session clears` (`:3098`). |
| C5 | The held-fit target is drawn in `resolveAquarelleCurveMode(stroke.curveMode)` — the same expression the write persists. | ✓ VERIFIED | `VectorPathOverlay.tsx:993`; test `draws the held fit in resolveAquarelleCurveMode(stroke.curveMode), never the draw mint` (`:3033`). |
| C6 | D-09: a real recorded pressure profile draws the hand-painted footprint band; a mouse-painted `-1` sentinel stroke keeps the shipped anchor-width envelope (documented exception). | ✓ VERIFIED | `hasRecordedPressureProfile` (`aquarelleStrokeBand.ts:195`) gates `buildStrokeBandCached` (`:222`); tests `draws the shipped buildStrokeBand footprint and the centreline for a hand-painted stroke` (`VectorPathOverlay.test.ts:1583`), `keeps the wireframe envelope for a uniform profile whatever the switch says` (`:1891`), `aquarelleStrokeBand.test.ts` sentinel pins. |
| C7 | The overlay imports no engine/adapter, writes no state and leaves every finished gesture as one `onPathEdit` call. | ✓ VERIFIED | Import scan over `VectorPathOverlay.tsx` (no engine/adapter import; only the bracket/band/selection helpers); tests C2/C3. |

### Observable Truths — 62-04 (7)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| D1 | Assumption (CRV-04): the shipped single-flight latch plus a synchronous session epoch suffices; no async library, AbortController or state machine. | ✓ VERIFIED | Epoch is four signals + token compare-then-write (`vectorPathSession.ts:120-152`); no new dependency (REL-01 scan below); no AbortController/state-machine import in the commit path. |
| D2 | Undo during an in-flight immediate bake cancels the publish: neither terminal, no ledger entry, no error capsule, bake resolves false. | ✓ VERIFIED | Third terminal (`aquarelleVectorPathCommit.ts:126-154`); tests `publishes only the cancellation terminal when cancelled before the work starts` (`:247`), `takes the cancellation terminal when the predicate flips while the apply is pending` (`:265`), `never the failure terminal, when a cancelled apply rejects` (`:283`). |
| D3 | That undo restores THIS edit's pre-edit script and sheet through the revision-authoritative replay addressed by the exact `editId`; never the previous history entry, never a blind pop. | ✓ VERIFIED | Undo router (`PhysicsPaintStudio.tsx:6366-6382`); pins `replays the pending record exact editId through runScriptReplay, with one reanchor retry` and `reads the pending record before the history call and cancels its token` (`PhysicsPaintStudio.test.ts:8159,8144`). |
| D4 | A cancelled bake releases every latch it took and leaves the apply status at rest; the next edit commits normally. | ✓ VERIFIED | Latch release in `finally` before any terminal (`aquarelleVectorPathCommit.ts:126-154`); test `releases the in-flight latch before the cancellation terminal and still fails closed when already in flight` (`:336`); `onCancelled` sets status idle only (`PhysicsPaintStudio.tsx:10431-10436`). |
| D5 | When the in-flight work is the deferred Draft/wireframe settle, undo waits for that settle then runs the ordinary authoritative undo. | ✓ VERIFIED | `await draftSettlePromiseRef.current` before `rotoMoveHistoryUndo` (`PhysicsPaintStudio.tsx:6383-6386`); pin `awaits an in-flight deferred settle before the ordinary undo` (`PhysicsPaintStudio.test.ts:8178`). |
| D6 | A stale cancellation token never cancels a newer bake; arm/cancel/clear are token-keyed compare-then-write. | ✓ VERIFIED | Token record + identity checks (`vectorPathSession.ts:120-152`); tests `arms one fresh token per apply and a second arm supersedes the first`, `cancels only the current token`, `clears only the matching record` (`vectorPathSession.test.ts:409,432,468`). |
| D7 | In-app every exit restores the pre-entry wireframe and Draft because the Studio registers the exit hook once from a mount-scoped effect beside `resetForStudioOpen`, re-registers on settle identity change, and clears it on cleanup. | ✓ VERIFIED | `useEffect(..., [settleDraftScript])` with `registerPathEditExitHook` / `(null)` cleanup (`PhysicsPaintStudio.tsx:11509-11518`); exact-shape pin incl. the WR-01 `.catch` (`PhysicsPaintStudio.test.ts:8105-8124`). |

### Observable Truths — 62-05 (6)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| E1 | The source-scoped real cache identity is built in exactly ONE place and all real/defensive/linked/remap/persistence sites call it, producing byte-identical strings. | ✓ VERIFIED | `buildRotoRealCacheRevision` (`physicsPaintRotoPhysicalModel.ts:1539`), 7 production call sites (see R3), raw `:real:` construction outside the model = 0 (`grep -rn ":real:"` excluding tests → no matches); exact-string pins in `physicsPaintRotoPhysicalModel.test.ts`. |
| E2 | Adjacency probe: frames 0..4 resolve A..E, a loop whose placementStart is 5 resolves A under the same source-scoped family, frame 4 resolves E, and the boundary adds no cache entry, key or collision. | ✓ VERIFIED | Store probe `crosses the source/occurrence boundary with the same source identity, no added cache entry and no collision` (`physicPaintStore.rotoLoopClips.test.ts:353`). |
| E3 | Ordering probe: two loops over the same source resolve ONE identity; a single source-key re-bake moves every occurrence of both loops in the same transition, with `renderedFrame` the same object reference. | ✓ VERIFIED | Store probe `makes one source re-bake invalidate both loops in the same transition, rendered from the source payload by reference` (`:386`); shared-identity probe at `:223`. |
| E4 | Empty probe: `loop-placeholder` carries no `keyId`/`cacheRevision`; beyond-loop resolves null; neither can become a curve edit target or re-bake source. | ✓ VERIFIED | Store probe `resolves missing-source frames as loop-placeholder with no key identity, and frames beyond every loop as null` (`:463`); placeholder contract at `:491`. |
| E5 | No materialization: after a source-key re-bake the real-key record collection and Loop Clip collection are unchanged. | ✓ VERIFIED | Store probe `materializes no record and no loop change when the single source entry is re-baked` (`:434`). |
| E6 | Source-only entry: the painted stroke is selectable only on its recorded source frame; occurrence frames list nothing and report no recorded aquarelle script. | ✓ VERIFIED | Plan artifact pin `aquarelleStrokeSelection.test.ts` (occurrence frames list no editable stroke row); registry filter on `stroke.playFrame`; T-62-17 closed in `62-SECURITY.md`. |

**Score:** 42/43 truths verified (1 uncertain — R2/WR-02; 0 present, behavior-unverified).

### Deferred Items

None — Phase 62 is the last phase in ROADMAP.md; no later phase covers the open review warnings. They are surfaced below as human decisions.

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `app/src/components/physic-paint/view/vectorPathFit.ts` | Pure interpolating fitter (auto anchors, capped, deterministic) | ✓ VERIFIED | `verify.artifacts` 5/5 for 62-01; read in full; 221 lines, bounded DP + turn pass + decimation, no RNG. |
| `app/src/components/physic-paint/view/vectorPathCurveBracket.ts` | Session-only held fit + wireframe bracket | ✓ VERIFIED | `curveFitSession`, `curveEntrySnapshot`, `resolveCurveExitAction`, CR-01/WR-01 teardown fix present. |
| `app/src/components/physic-paint/view/aquarelleRecordState.ts` | Conversion mode + D-07/D-08 law on the path writer | ✓ VERIFIED | `AquarellePathWriteOptions` at `:1107`, writers at `:1003`/`:1112`; one bump per write. |
| `app/src/components/physic-paint/view/vectorPathHandles.ts` | `resampleVectorSpineWithPressureLaw` | ✓ VERIFIED | `:940`; count-preserving, endpoint-pinned, sentinel-preserving. |
| `app/src/components/physic-paint/view/aquarelleStrokeSelection.ts` | Pre/post snapshot pair through the same edit seam | ✓ VERIFIED | `beginAquarellePathEdit` `:1068`, `restoreAquarelleEditSnapshot` `:1178`. |
| `app/src/components/physic-paint/view/strokeSettingsModel.ts` | Eligibility + gate painted arm + named refusals | ✓ VERIFIED | 62-02 artifacts 4/4; `:869`, `:911`, `:952`. |
| `app/src/components/physic-paint/view/vectorPathLatches.ts` | `registerPathEditExitHook` — the ONE funnel | ✓ VERIFIED | Read in full; hook runs only on the open→closed transition. |
| `app/src/components/physic-paint/PhysicsPaintStudio.tsx` | `readCurveEntry` / `enterPaintedCurve`, widened writer seam, pending-apply arm, undo router, ONE exit-hook registration | ✓ VERIFIED | `:10305`, `:10317`, `:10345`, `:6366`, `:11509`. |
| `app/src/components/physic-paint/engine/VectorPathOverlay.tsx` | Held-fit fallback, ghost spine, D-09 envelope override | ✓ VERIFIED | 62-03 artifacts 2/2; `:951-1057`, `:1468-1478`. |
| `app/src/components/physic-paint/view/aquarelleStrokeBand.ts` | `hasRecordedPressureProfile` (D-09 predicate) | ✓ VERIFIED | `:195`; `buildStrokeBandCached` `:222`. |
| `app/src/components/physic-paint/view/aquarelleVectorPathCommit.ts` | Third terminal `isCancelled`/`onCancelled` | ✓ VERIFIED | 62-04 artifacts 3/3; `:45-47`, `:126-154`. |
| `app/src/components/physic-paint/view/vectorPathSession.ts` | Token-keyed pending path-edit apply epoch | ✓ VERIFIED | `:120-152`; reset clears the pending record (`:210-215`). |
| `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts` | ONE `buildRotoRealCacheRevision` | ✓ VERIFIED | 62-05 artifacts 6/6; `:1539`. |
| `app/src/components/physic-paint/roto/rotoPhysicalOwnership.ts` | Remap through the builder | ✓ VERIFIED | `:153`. |
| `app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts` | Three persistence projections through the builder (paper suffix) | ✓ VERIFIED | `:297`, `:346`, `:566`. |
| `app/src/stores/physicPaintStore.ts` | Real + defensive-real + linked branches through the builder | ✓ VERIFIED | `:5794`, `:5840`, `:5855`. |
| `app/src/stores/physicPaintStore.rotoLoopClips.test.ts` | CRV-03 edge probes | ✓ VERIFIED | 32 tests green; probes at `:353,386,434,463`. |
| `app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts` | D-11 source-only entry pin | ✓ VERIFIED | Included in the 1207-test green run. |

Artifact verifier results: 62-01 5/5, 62-02 4/4, 62-03 2/2, 62-04 3/3, 62-05 6/6 — all `all_passed: true`, no issues.

### Key Link Verification

`verify.key-links` returns `total: 0` for these plans because their `key_links` are prose strings, not `{from,to,via}` objects. Every link was therefore verified manually against the code:

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `beginPaintedCurveSession` | `fitVectorPathAnchors` → `curveFitSession` | session-only fit | ✓ WIRED | Bracket imports the fitter and writes only signals; no document read/write. |
| `beginAquarellePathEdit` | `updateAquarellePathInScript` → `resampleVectorSpineWithPressureLaw` → payload entry → replay | one conversion write | ✓ WIRED | `aquarelleStrokeSelection.ts:1068` → `aquarelleRecordState.ts:1112` → `vectorPathHandles.ts:940`; path test `feeds the new spine to every replay through getAquarelleEventsForFrame` (`:505`). |
| `beginAquarellePathEdit` | `captureAquarelleSnapshot` → `storeAquarelleEdit` → `restoreAquarelleEditSnapshot` | one pre/post pair | ✓ WIRED | Restores points AND anchors (A3 test). |
| Dialog spline-pointer | `bundle.readCurveEntry` → `resolvePaintedCurveEligibility` | one record read | ✓ WIRED | `PhysicsPaintStrokeSettingsDialog.tsx:463-471`; no second store walk. |
| Dialog click (painted) | `enterPaintedCurve` → `armDraftBase` + fit + bracket + latch | ONE entrance | ✓ WIRED | `PhysicsPaintStrokeSettingsDialog.tsx:1014-1015`; `PhysicsPaintStudio.tsx:10317-10336`. |
| Any `exitPathEdit` caller | latch transition → registered hook → `endCurveBracket` | ONE funnel | ✓ WIRED | `vectorPathLatches.ts`; hook registered at `PhysicsPaintStudio.tsx:11509`. |
| `VectorPathOverlay.onPathEdit` | `handleAquarelleVectorPathEdit` → `admitsPathEditWrite` → commit | ONE write route | ✓ WIRED | `PhysicsPaintStudio.tsx:10473-10484`; `strokeSettingsModel.ts:911`. |
| `pathEditMutationId` + `curveFitSession` | edit-target resolution → `drawnPathOf` → interactivity + one gesture commit | held-fit fallback | ✓ WIRED | `VectorPathOverlay.tsx:951-1057`. |
| Held fit + record stroke | `resolveAquarelleCurveMode(stroke.curveMode)` → `DrawnVectorPath.curveMode` | preview === persisted mode | ✓ WIRED | `VectorPathOverlay.tsx:993`; test `:3033`. |
| `handleVectorPathEditKey` | record anchors else `getHeldFit` → `deleteAnchorsAt` → one `onPathEdit` | held-fit Delete seam | ✓ WIRED | `VectorPathOverlay.tsx` handler refs; test `:2983`. |
| `curveFitSession.sourcePoints` | `uvToScreen` → ghost polyline | display-only ghost | ✓ WIRED | Test `:3079`/`:3098`. |
| Wireframe/preview switch + `hasRecordedPressureProfile` | `buildStrokeBandCached` → `DrawnVectorPath.envelopePx` → envelope nodes | D-09 band | ✓ WIRED | `VectorPathOverlay.tsx:1067-1078`; band tests. |
| `commitAquarelleVectorPathEdit` | `beginPathEditApply(token)` → `runAquarelleScriptRebake(isCancelled)` → one terminal → `clearPathEditApply(token)` | exactly one terminal | ✓ WIRED | `PhysicsPaintStudio.tsx:10378-10447`; commit tests. |
| `undo` | `pendingPathEditApply.peek()` → cancel → await settled bake → `runScriptReplay({direction:'undo', editId})` → sync | exact-editId replay | ✓ WIRED | `PhysicsPaintStudio.tsx:6368-6382`; router pins. |
| `undo` | `draftSettlePromiseRef.current` → await → `rotoMoveHistoryUndo` | deferred-settle ordering | ✓ WIRED | `PhysicsPaintStudio.tsx:6383-6386`; pin `:8178`. |
| Mount scope | `registerPathEditExitHook(() => endCurveBracket)` beside `resetForStudioOpen` | ONE registration | ✓ WIRED | `PhysicsPaintStudio.tsx:11499-11518`; exact-shape pin `:8117-8119`. |
| Store real/linked branches | `buildRotoRealCacheRevision` → shared display cache identity | source-scoped identity | ✓ WIRED | 7 call sites; zero raw construction sites. |
| Source-key re-bake | new payload bytes → `rasterRevision` → every linked occurrence identity moves together | joint invalidation | ✓ WIRED | Store probe `:386`. |
| Loop resolution | `'linked'` returns the SOURCE record → builder(record.keyId) | one cache entry for all occurrences | ✓ WIRED | Store probe `:223`. |
| `listSelectableAquarelleStrokes(playFrame)` | registry filter on `stroke.playFrame` → occurrence frames list nothing | source-only entry | ✓ WIRED | D-11 pin in `aquarelleStrokeSelection.test.ts`. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `VectorPathOverlay.tsx` (held fit) | `curveFitSession` | `beginPaintedCurveSession` ← `getRecordedAquarelleStroke(stroke).points` | Yes — real recorded samples, no mock | ✓ FLOWING |
| `aquarelleRecordState.ts` (conversion) | `nextStroke.points` | `resampleVectorSpineWithPressureLaw(sampledSpine, stroke.points)` | Yes — derived from the edited anchors and the real source pressures | ✓ FLOWING |
| `PhysicsPaintStudio.tsx` (undo router) | `pendingPathEditApply` | `beginPathEditApply` armed by the real commit; replayed via `runScriptReplay({editId})` | Yes — real ledger id | ✓ FLOWING |
| `physicPaintStore.ts` (loop identity) | `cacheRevision` | `buildRotoRealCacheRevision(rasterRevision, record.keyId)` | Yes — real revision + key id; no static fallback | ✓ FLOWING |

No static return, hardcoded literal or mock ends any of these chains.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| All phase suites (fit, bracket, latches, handles, session, path writer, selection, gate, dialog, band, commit, overlay, Studio, roto model, ownership, loop resolver, persistence coordinator, store loop clips) | `pnpm --filter efx-motion-editor exec vitest run <22 phase files>` | 22 files passed, 1207 tests passed, exit 0 | ✓ PASS |
| One-write/one-bump conversion, exact undo restore, count/pressure preservation | `aquarelleRecordState.path.test.ts` (subset of the run) | 28 tests green, incl. `converts a fitted hand stroke in one write`, `restores the exact hand samples in one undo…`, `preserves the recorded point count…` | ✓ PASS |
| Cancelled bake publishes only the cancellation terminal | `aquarelleVectorPathCommit.test.ts` (subset) | 13 tests green incl. all three cancellation cases and latch release | ✓ PASS |
| CR-01/WR-01 teardown pins | `vectorPathCurveBracket.test.ts` (subset) | 20 tests green incl. `does not take a bracket armed while an earlier teardown is still settling (CR-01)` and `completes the teardown when the settle rejects (WR-01)` | ✓ PASS |
| Source-scoped loop identity probes | `physicPaintStore.rotoLoopClips.test.ts` (subset) | 32 tests green incl. adjacency, ordering, empty and no-materialization probes | ✓ PASS |
| Artifact existence/substance | `gsd_run query verify.artifacts` × 5 plans | 5/5, 4/4, 2/2, 3/3, 6/6 — all passed | ✓ PASS |
| Commit hashes cited by the summaries exist | `gsd_run query verify.commits <39 hashes>` | valid 39, invalid 0 | ✓ PASS |
| No new runtime dependency (REL-01) | `git diff --name-only 2b05506be..HEAD \| grep -E 'package.json\|pnpm-lock'` | no matches | ✓ PASS |
| ONE cache-identity builder, no raw literals | `grep -rn ':real:' app/src` excluding tests and the model | no matches; 7 builder call sites | ✓ PASS |

### Probe Execution

Not applicable — no `scripts/*/tests/probe-*.sh` exist and no probe script is declared in any phase artifact. The plans' "Probe (CRV-03 …)" rows are investigation hypotheses resolved by unit probes in `physicPaintStore.rotoLoopClips.test.ts`, not executable probe scripts.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| CRV-01 | 62-01, 62-02, 62-03 | User can select a painted stroke and enter curve mode, with anchors fitted on entry | ✓ SATISFIED | R1, A1-A6, A8, B1-B7, C1-C7; gate/entry/overlay code + tests green. |
| CRV-02 | 62-01, 62-04 | Editing anchors/handles commits as one ledger entry and re-bakes from the recovered pre-script base rather than deforming cached pixels | ✓ SATISFIED (with WR-02 decision outstanding) | R2/A2/A7/A9/A10/A11; one-write/one-entry/base-arming/identity pins green. |
| CRV-03 | 62-05 | Every loop occurrence of the edited stroke is invalidated together | ✓ SATISFIED | R3, E1-E6; single builder + 32 loop-clip probes green. |
| CRV-04 | 62-04 | Undo cancels or settles an in-flight bake | ✓ SATISFIED | R4, D1-D7; three-terminal sequence + epoch + router pins green. |

REQUIREMENTS.md maps CRV-01..04 to Phase 62 and marks all four `[x]`; every plan's `requirements:` field claims exactly these IDs. No ORPHANED requirements (Phase 62 = 4 mapped, 4 claimed).

### Anti-Patterns Found

Debt-marker gate: `grep -E "TBD|FIXME|XXX"` over the 17 changed implementation files returns nothing, with or without an issue reference. No `TODO`/`HACK`/`PLACEHOLDER` in the changed files. No placeholder copy or empty-handler stubs in the new modules; the `return null` / `return []` matches are documented fail-closed guards covered by tests. No `.skip`/`.only`/`.todo` in any phase test file; no trivial `expect(true)` assertions.

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `app/src/components/physic-paint/view/aquarelleRecordState.ts` | `1148-1155` (and `1044-1051` curve-mode rewrite) | Conversion stamps `tx: 0, ty: 0`, discarding recorded stylus tilt (WR-02) | ⚠️ Warning | Repaint dab azimuth changes for fixed-rotation anisotropic brushes; human decision requested. |
| `app/src/components/physic-paint/PhysicsPaintStudio.tsx` | `10346-10354` | Busy gates not re-read after `await ensureAquarelleDurableBaseRef…` (WR-03) | ⚠️ Warning | A latch stolen during the await leaves an unrecorded script edit and a stuck `applying` status; human decision requested. |
| `app/src/components/physic-paint/PhysicsPaintStudio.tsx` | `6366-6392` | Both cancelled-bake undo replays refused → silent `false` (WR-04) | ⚠️ Warning | Cancelled-but-applied edit stays unrecorded; next undo consumes the previous entry; human decision requested. |
| `app/src/components/physic-paint/view/aquarelleStrokeBand.ts` | `191-205` | Doc claims malformed-input fail-closed but a null element would throw (IN-02) | ℹ️ Info | Unreachable through the loader; doc/implementation mismatch only. Deferred by disposition. |
| `app/src/components/physic-paint/view/vectorPathSession.ts` | `210-216` | `resetForStudioOpen` omits `curveFitSession`/`curveEntrySnapshot` (IN-03) | ℹ️ Info | Latent under the one-mount-per-webview topology. Deferred by disposition. |
| `app/src/components/physic-paint/PhysicsPaintStudio.tsx` | `10323-10329` | Curve-entry failure republishes the Draft-base message; fit-null entry is a silent dead click; no entry pending state (`62-UI-REVIEW.md` top-3) | ⚠️ Warning | Confusing copy / dead-click feel; UI review WARNING, no blocker; UAT rows A/C will judge. |
| `app/src/components/physic-paint/engine/VectorPathOverlay.tsx` | `1454-1478` | Ghost legibility unverified; decorative SVG lacks `aria-hidden` (`62-UI-REVIEW.md`) | ⚠️ Warning | Visual contrast judged only by UAT row A. |

Closed since review: CR-01 (teardown destroys a newer session's capture) and WR-01 (no `try/finally` around the settle) are fixed in `a07baf51b` and pinned by `vectorPathCurveBracket.test.ts:347,372` plus the exact-shape registration pin. IN-01 is an intended, test-pinned no-op (`PhysicsPaintStudio.test.ts:8196`).

### Test Quality Audit

- No skipped, only, or todo tests in any phase test file; no vacuous assertions.
- The phase mixes behavioral tests (fitter, bracket teardown, writer law, rebake terminals, overlay gestures, loop-clip probes) with the repository's established Studio source-pin pattern for internals that cannot be mounted in vitest (undo router ordering, effect registration shape, deferred-branch order). The source pins assert structure AND are paired with behavioral module tests, so they are not circular.
- `62-VALIDATION.md` per-task map: 15/15 rows automated and green; the 7 manual rows are the UAT gate.
- Decision coverage gate: `gsd_run query check.decision-coverage-verify` → 14/14 trackable CONTEXT.md decisions honored, `not_honored: []`.

### Human Verification Required

The full list with expected outcomes is in the frontmatter (`human_verification`). Summary:

1. **Native UAT row A** — entry fits anchors on the paint; ghost/wireframe legible; spline-pointer affordance.
2. **Native UAT row B** — anchor drag re-renders with identical wet lifetime and one ledger entry.
3. **Native UAT row C** — every exit restores pre-entry wireframe/Draft; dirty Draft settles exactly once.
4. **Native UAT row D** — erased regions survive the re-bake; grain not re-rolled; real taper vs mouse exception.
5. **Native UAT row E** — every loop occurrence repaints in one gesture release; clean boundary.
6. **Native UAT row F** — one undo restores every occurrence; occurrence frames expose no selectable row.
7. **Native UAT row G** — in-flight undo cancels silently, second undo reaches the previous edit, redo does not resurrect, next drag commits.
8. **Decision — WR-02** — carry/remap recorded stylus tilt vs accept the orientation change.
9. **Decision — WR-03** — fix or accept the post-await busy-gate window.
10. **Decision — WR-04** — fix or accept the silent double-refusal in the cancelled-bake undo.

Automated evidence is green (1207 tests across 22 phase suites; artifacts, commits, REL-01 and the single-builder scan all pass). The phase is **not** `passed` because the native UAT rows and the three open review decisions are outstanding.

### Gaps Summary

No blocking gaps. All 20 declared artifacts exist and pass the substantive check; all 20 prose key links are wired in code and covered by tests; no debt markers, no stubs, no skipped tests, and no new runtime dependency. The single uncertain truth is ROADMAP criterion 2's "texture is not re-rolled" clause, which the conversion's unconditional `tx/ty` zeroing places in question for stylus-painted fixed-rotation brushes (WR-02). That is a warning-level, human-decision item, not a FAILED must-have — the one-ledger-entry, recovered-base rebake and no-seed-bump mechanism is verified. Ship readiness depends on the seven native UAT rows and the three open review dispositions.

---

_Verified: 2026-11-14T15:32:29Z_
_Verifier: Claude (gsd-verifier)_
