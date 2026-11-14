---
phase: quick-261023-j5b
plan: 261023-j5b
subsystem: physic-paint brush script navigation
tags: [physic-paint, brush-script, navigation, replay, rebake, dev-probe]
requires:
  - quick-261023-h9v-session-brush-script-rehydration
provides:
  - lazy engine ledger attach over cached pixels (no stroke replay on arrival)
  - faithful live-deposit rebake on the first and every subsequent edit of a visit
  - per-frame paint-settings snapshot carried on the session store entry
  - measured edit-affordability cap replacing the h9v replay budget
affects: [physic-paint navigation, brush Move surface, DEV script-memory probe]
actuals:
  tokens: 29285
  tasks: 3
  commits: 4
tech-stack:
  added: []
  patterns:
    - "Frame-visit replay mode ('live' | 'detached' | 'faithful'), undefined-safe at every read for prototype harnesses"
    - "Lazy attach: navigation installs the ledger silently and never repaints; cached pixels are the display"
    - "Faithful rebake: replay with live deposit semantics (replay:false, one prepareWetLayerForStroke per stroke) on the first AND every later edit of the visit"
    - "Paint globals snapshotted at the first live paint of a visit, applied for the rebake, restored afterwards"
    - "Fail-closed edit affordability: complete + attach cap + zero diffusion frames"
key-files:
  created:
    - packages/efx-physic-paint/src/engine/EfxPaintEngine.attachBaseline.test.ts
    - packages/efx-physic-paint/src/engine/EfxPaintEngine.faithfulRebake.test.ts
  modified:
    - packages/efx-physic-paint/src/engine/EfxPaintEngine.ts
    - packages/efx-physic-paint/src/index.ts
    - app/src/components/physic-paint/view/brushScriptHydration.ts
    - app/src/components/physic-paint/view/brushScriptRecordState.ts
    - app/src/components/physic-paint/view/brushScriptEditionPort.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/performance/scriptMemoryProbe.ts
    - app/src/components/physic-paint/performance/scriptMemorySnapshot.ts
decisions:
  - "Navigation attaches the ledger silently over cached pixels: no redrawAll, no preview-base touch, no repaint"
  - "The faithful rebake runs on the first script edit, not on arrival; the mode stays 'faithful' for the whole frame visit"
  - "A detached visit clears the preview base exactly once at the first rebake; a live visit keeps its pre-existing cached base"
  - "Paint settings (localSpreadStrength, wetPaper, physicsStrength, paperGrain) travel with the store entry; embossStrength is excluded because it is never consumed by the deposit path"
  - "The h9v replay budget (600 points / 10 strokes / 0 diffusion) is removed; navigation is gated on completeness plus a measured O(n) attach cap (200 strokes / 40000 points)"
  - "MAX_EDITABLE_DIFFUSION_FRAMES = 0: one diffusion frame costs ~684-705 ms per faithful rebake at HD, so physics-run frames stay view-only on cached pixels"
  - "The probe's editable verdict calls the exact same predicates as the live navigation policy"
metrics:
  duration: 14min
  completed: 2026-10-23
status: complete
commits: 4
plan_head_before: 716f0d411a68205dc15755d3ae0bf033a1d9c47a
plan_head_after: eefb44934fd7922928912a3bb18622aad6ffeb21
---

# Quick 261023-j5b: Replace Eager Brush Script Replay on Navigation Summary

**Navigating to a retained brush key now loads cached pixels and attaches the ledger in under 2 ms with zero stroke replays; the first edit rebakes the frame with live deposit semantics so overlapping strokes keep their painted look.**

Navigation no longer replays. The expensive faithful reconstruction moved to the first edit of the visit, where it is affordable and invisible. The eager h9v `restoreStrokesBaseline -> redrawAll()` path (233 ms light / 1.1 s heavy, and corrupting because it ran with `{ replay: true }`) is gone from the arrival path.

## Performance

- **Duration:** ~14 min (first to last task commit, 14:00:23 -> 14:14:10 local)
- **Tasks:** 3 completed (plus one follow-up docs commit correcting a measured claim)
- **Commits:** 4
- **Files changed:** 17 files, +1139 / -238 (excluding `.planning/`)

## Accomplishments

1. **Lazy attach on navigation.** `attachStrokesBaseline(groups, settings?)` installs a validated, cloned baseline (same paint order and mutationIds, history cleared, `notifyHistoryAvailability`) without a redraw. The Studio navigation seam loads the cached pixels first (the loader's internal `engine.clear()` can no longer drop the ledger), then attaches. The attached path records no arrival base, so the captured script stays complete.
2. **Faithful rebake on every edit of the visit.** `rebakeStrokesFaithfully(settings?)` switches the visit to `'faithful'`, resets `lastStrokeBounds`, applies the frame's captured paint settings, clears the preview base once when the visit is `'detached'`, replays the ledger with live deposit semantics (`replay:false`, one `prepareWetLayerForStroke` per stroke), restores the prior globals, and renders the wet layer. Move/step/delete/restack and the live-erase rebuild all route through `redrawAfterScriptEdit()`.
3. **Mode lifecycle.** New frame-visit mode `'live' | 'detached' | 'faithful'`, read `?? 'live'` everywhere (prototype harnesses never run the constructor). `redrawAll()` skips replay when `'detached'`; replays with `replay:!==faithful`; `clear()` returns to `'live'` and drops the settings snapshot.
4. **Paint-global fidelity.** `PaintRenderSettings` is captured on the first live `applyStrokeToEngine` of a visit, carried on `BrushScriptFrameEntry.paintSettings` stickily, forwarded by all Studio flush sites, the edition port, and the DEV probe, applied around the rebake, and restored afterwards.
5. **Measured policy.** The 600/10/0 replay budget is replaced by an O(n) attach cap sized from measurement plus a separate diffusion edit-affordability gate; the probe verdict and the live policy share the same constants.
6. **Probe wording.** `window.__EFX_SCRIPT_MEMORY__` now describes silent attach over cached pixels; `complete`/`hydratable` rows keep their h9v meaning.

## Task Commits

1. **Task 1: attach brush scripts lazily over cached pixels** - `f8c5969f` (feat)
2. **Task 2: rebake script edits with live deposit semantics** - `47789f94` (feat)
3. **Task 3: gate brush editability on a measured edit-cost cap** - `c99175b9` (feat)
4. **Follow-up: state the attach-cap headroom accurately** - `eefb4493` (docs)

**Plan metadata:** not committed (explicit task constraint: the orchestrator commits `.planning/` docs).

## The Law: Lazy Attach + Faithful Rebake

**Navigation (arrival at a complete, edit-affordable real brush key):**

1. Flush the outgoing frame into the session store (with its paint settings).
2. `engine.clear()` inside the cached-pixel loader — the ledger is wiped, mode returns to `'live'`.
3. Load the destination's cached pixels; they are the display.
4. `attemptBrushScriptHydration` -> `attachStrokesBaseline(groups, settings)`: install the ledger silently, set mode `'detached'`, mark the composite dirty, request a render. **Zero `renderPaintStroke` calls.**
5. If no cached display frame exists for the destination, run the faithful rebake immediately so the frame is not blank.
6. Move availability re-enables through `notifyHistoryAvailability`; no arrival base is recorded on the attached path, so the entry stays complete.

**First edit (move/delete/step/restack/live-erase) of the visit:**

1. `redrawAfterScriptEdit()`: `'faithful'` -> `redrawAll()`; otherwise `rebakeStrokesFaithfully(framePaintSettings ?? null)`.
2. The rebake (detached visit) clears the preview base once, resets `lastStrokeBounds`, applies the frame's paint globals, replays **every** retained stroke with `replay:false` (so `prepareWetLayerForStroke` runs per stroke — the keep-box/force-dry step h9v skipped), restores the globals, renders the visible wet layer.
3. Mode stays `'faithful'`; every later edit in the same visit replays with `replay:false` too. There is no path back to `replay:true` except `clear()`.

## Measured Cost

Measured 2026-10-23 with a temporary mock-canvas harness driving the real engine ledger and the real `prepareWetLayerForStroke` / deposit path (same style as h9v; harness deleted before commit). Timings are synchronous wall-clock values from the harness run; sub-millisecond attach values are dominated by measurement noise.

### Attach (ledger install only — no replay)

| Fixture | Strokes | Points | 1920x1080 | 100x100 |
|---|---|---|---|---|
| light 10x60 | 10 | 600 | 0.54 ms | 0.06 ms |
| typical 25x90 | 25 | 2250 | 0.21 ms | 0.14 ms |
| heavy 40x180 | 40 | 7200 | 1.84 ms | 0.61 ms |
| one diffusion frame | - | - | 0.09 ms | 0.02 ms |

### First faithful rebake (live deposit semantics, whole ledger)

| Fixture | Strokes | Points | Diffusion frames | 1920x1080 | 100x100 |
|---|---|---|---|---|---|
| light 10x60 | 10 | 600 | 0 | 228.2 ms | 10.2 ms |
| typical 25x90 | 25 | 2250 | 0 | 600.2 ms | 31.2 ms |
| heavy 40x180 | 40 | 7200 | 0 | 1235.7 ms | 57.4 ms |
| diffusion run | - | - | 1 | 683.7 ms | 8.2 ms |

**Reading the numbers:** attach is O(n) cloning and stays in the low milliseconds at HD (the heavy fixture sits ~125x under the h9v light replay). The rebake is the expensive operation and moved to the first edit; it is roughly the same cost class as the old eager replay (h9v: 233 / 601 / 1102 ms), but it now happens once per visit on user action instead of on every arrival, and it preserves the painted look. At 100x100 (unit/prototype surface) both operations are comfortably small; the gate is HD-sized because the working canvas is HD.

## Final Policy

Navigation attaches a destination only when **all** gates pass; every refusal keeps the cached-pixel path and never touches the engine.

| Refusal reason | Meaning |
|---|---|
| `no-entry` | The frame was never captured this session. |
| `empty` | The captured projection has no strokes. |
| `partial` | A cached pixel base sits under the session script (the ledger could never be edited without deleting the base pixels). |
| `generated` | Only a real key may attach (`generated` / `none` / `no-launch` destinations repaint pixels). |
| `watercolor` | The aquarelle sheet owns its own record store. |
| `playback` | A moving playhead must never pause for a synchronous ledger mutation. |
| `scrub` | Same, for an armed ruler scrub. |
| `edit-cost` | The frame exceeds the attach sanity cap, or carries diffusion frames whose faithful rebake is unaffordable (measured ~684-705 ms per diffusion frame at 1920x1080). Such frames stay view-only on cached pixels. |

**Constants** (`app/src/components/physic-paint/view/brushScriptHydration.ts`):

- `MAX_ATTACH_STROKES = 200` and `MAX_ATTACH_POINTS = 40000` — the O(n) clone ceiling. Sized from measurement: 5x the heavy fixture's stroke count and 5.5x its point count; a full-ceiling attach is ~10 ms by linear scaling, still an order of magnitude under the removed 233 ms light replay, while bounding a pathological store.
- `MAX_EDITABLE_DIFFUSION_FRAMES = 0` — the edit-affordability gate. One diffusion frame costs ~684 ms (j5b) / ~705 ms (h9v) per faithful rebake at HD; unaffordable for a synchronous first edit.
- `isBrushScriptFrameHydratable` = `complete && isWithinBrushAttachCap(...) && isWithinBrushEditCostCap(...)`; the live policy and the probe both call these predicates, so they cannot disagree.

The h9v constants `MAX_HYDRATION_POINTS = 600`, `MAX_HYDRATION_STROKES = 10` and `MAX_HYDRATION_DIFFUSION_FRAMES = 0` and the admission gate that used them are deleted.

## `embossStrength` Finding

`embossStrength` is consumed only at serialization / bake-parity boundaries — `buildEfxPaintDocument`'s track settings (`EfxPaintEngine.ts` ~4656), `loadProjectData` restore (~4687), the setter (~1443), and the bake-parity diagnostics record (~3015, `paperStrength`). It is **never** read by `applyStrokeToEngine` or `renderPaintStroke`, so it cannot change a rebake's deposit. `PaintRenderSettings` therefore carries only `localSpreadStrength`, `wetPaper`, `physicsStrength` and `paperGrain`, and the exclusion is documented in the type's JSDoc.

## Threat Model

| Threat ID | Disposition | Mitigation shipped |
|---|---|---|
| T-261023-j5b-01 (tampering, baseline install) | mitigate | `installStrokeBaseline` validates the whole list before any mutation, clones and deep-freezes points, refuses malformed lists; `EfxPaintEngine.attachBaseline.test.ts` pins it. |
| T-261023-j5b-02 (DoS, faithful rebake) | mitigate | `MAX_EDITABLE_DIFFUSION_FRAMES = 0` and the attach cap keep unaffordable frames fail-closed; rebake cost is measured and reported above. |
| T-261023-j5b-03 (tampering, preview base) | mitigate | The preview base is cleared only when the visit mode is `'detached'`; a live visit keeps its pre-existing cached base (dedicated test). |
| T-261023-j5b-04 (info disclosure, DEV probe) | accept | No new surface; the `import.meta.env.DEV` + `typeof window` guards from f9c are unchanged. |
| T-261023-j5b-SC (package install) | mitigate | No dependency added. |

## Verification

| Check | Command | Result |
|---|---|---|
| Engine suites | `vitest run --root ../packages/efx-physic-paint` (attachBaseline, faithfulRebake, restoreBaseline, moveTranslate, erasePointerDelete, strokeReorder) | 6 files, **85 tests passed** |
| App suites | `vitest run` (brushScriptHydration, brushScriptRecordState, brushScriptEditionPort, PhysicsPaintStudio, scriptMemorySnapshot) | 5 files, **322 tests passed** |
| Engine build | `pnpm --filter @efxlab/efx-physic-paint build` | succeeded (ESM + DTS) after the engine edits |
| Typecheck | `pnpm --filter efx-motion-editor run typecheck` | **exactly the 15 documented pre-existing errors in 6 untouched files**; ZERO new errors in touched files |

Typecheck baseline (pre-existing, untouched): `PaperPicker.tsx` (1), `physicPaintBridge.ts` (1), `usePhysicsPaintEngineActions.test.ts` (1), `physicsPaintRotoBackgroundValidatorParity.test.ts` (2), `PhysicsPaintPalette.test.ts` (1), `projectPaperRaster.test.ts` (9).

No app, dev server, or Tauri build was run by the executor; live UAT belongs to the user.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Inverted faithful replay flag in `redrawAll()`**
- **Found during:** Task 2 (RED-first engine suite)
- **Issue:** `redrawAll()` initially passed `this.replayLedger(mode === 'faithful')`, so the FIRST edit was faithful (`replay:false`) but the SECOND and every later edit in the visit fell back to `replay:true` — the exact corrupting behaviour this quick exists to remove. The RED test observed the replay flags `[false, true, true]`.
- **Fix:** `this.replayLedger(mode !== 'faithful')`; the suite now proves `[false, false, false]` across repeated edits.
- **Files modified:** `packages/efx-physic-paint/src/engine/EfxPaintEngine.ts`
- **Commit:** `47789f94`

**2. [Rule 1 - Documentation] Attach-cap headroom overstated**
- **Found during:** SUMMARY preparation
- **Issue:** The constant's header claimed "~10x headroom over the largest measured fixture"; 200/40 strokes and 40000/7200 points are ~5x and ~5.5x.
- **Fix:** Re-stated the accurate ratio and the ~10 ms linear-scaling estimate for a full-ceiling attach.
- **Files modified:** `app/src/components/physic-paint/view/brushScriptHydration.ts`
- **Commit:** `eefb4493`

**3. Minor test-only adjustment:** An unused `continuation` helper introduced in Task 1 briefly added a 16th typecheck error; it was removed to keep the baseline exact and re-added in Task 3 with the diffusion-refusal test that uses it.

**4. Task split note:** Task 1 introduced the named `MAX_ATTACH_STROKES`/`MAX_ATTACH_POINTS` constants (as the plan directed); Task 3 sized them from the measurement harness and replaced the remaining budget gate. No behavioural surprise.

## Visual-Parity Decision Point

**The visual-parity fallback was NOT taken**, because the implementation meets the plan's parity requirement at the code level: every rebake replays with `replay:false`, so `prepareWetLayerForStroke` runs once per replayed stroke exactly as during live painting; `lastStrokeBounds` is reset for determinism; the frame's paint globals are applied for the rebake. The dedicated suite pins the semantics (per-stroke prepare count, `replay:false` on every edit, completeness-driven once-per-visit base clear, settings apply/restore).

**Live UAT closed the decision point on 2026-10-23:** parity passed, so the faithful-rebake path stands and the cached-pixel-uneditable fallback is not taken. The fallback stays documented only as the contingency it always was.

## Follow-up fix (post-UAT, 2026-10-23): Duplicate phantom stroke

The first live UAT found that after Duplicating a key, the first Move/Delete on the duplicate left a phantom copy of the original stroke. Cause: the Duplicate destination is a LIVE visit whose cached preview base already contains the same script, and `rebakeStrokesFaithfully` only cleared the base for DETACHED visits. The replay drew the ledger over the base; the base copy was pixels, so it could not be selected or deleted.

Fix: the base clear is now **completeness-driven**, not visit-mode-driven. `EfxPaintEngine.setScriptBaseClearPending()` is declared by the brush port before every edit; a complete ledger (including a Duplicate-derived live visit) clears the cached base exactly once per visit, while a partial visit keeps its pre-existing base. Attach still marks the clear pending. Committed `3d66fb56`.

Added UAT row:
- **PASSED (2026-10-23) — Duplicate + edit:** Duplicate a brush key, enter Move, drag/delete a stroke: no phantom copy remains, the frame rebakes faithfully, and a partial frame still preserves its pre-existing base.

## Follow-up fix 2 (post-UAT, 2026-10-23): duplicate baked into the cache

The second live UAT found the phantom returning after navigating back to an edited key. The screen was correct right after the edit; the duplication was in the CACHED PIXELS. Cause: the completion capture merges the frame's cached base with the live alpha canvas. Once the faithful rebake has cleared that base to avoid the on-screen duplicate, the live canvas already holds the WHOLE frame content — but the capture still merged the pre-edit cached bytes over it, baking a second copy of every stroke into the cache. Navigation never replays the ledger, so every revisit displayed the duplicated cache ("the re-render is blocked").

Fix: `EfxPaintEngine.isLiveCanvasWholeFrame()` reports that this visit cleared its duplicate base; the engine-1 completion capture then passes `cachedBase = null` and `baseCanvas = null`, encoding the live canvas alone. A live visit (base + session strokes) and a partial visit keep the merge path unchanged. The flag resets with `clear()`, so each visit decides independently. Committed `87686cfa`.

Added UAT row:
- **PASSED (2026-10-23) — Revisit after edit:** Edit a stroke with Move/Delete, navigate away, then return to the key: the frame shows the edited script exactly once (no duplicated/phantom strokes from the cache), and a second edit on the revisit stays clean.

## Follow-up fix 3 (post-UAT, 2026-10-23): Move surface missing after Duplicate

The third live UAT found that Duplicating while already in Move mode lands on the new key with paint but NO Move outlines/badges; a Paint -> Move round-trip "refreshes" it. Cause: the script-aware Duplicate paints the promoted BLANK key through the live engine, but the session store had no entry for the destination frame. Both the overlay listing (`engineHoldsBrushScriptFrame`) and the frame-editing reload gate read the store, so the handles only appeared once the Move-entry flush captured the frame.

Fix: every engine-1 apply now captures its frame at apply settle (`flushBrushScriptAfterApply` for Apply Script and Load & Apply). The Duplicate path adopts the destination with `adoptBrushScriptFrameAsComplete()`: the decision table only reaches that path for an EMPTY cell, so the promoted key is blank and the applied script is the whole frame BY CONSTRUCTION. This is the one sanctioned override of sticky completeness — it also clears any arrival-base mark left by the promoted blank base (which holds no content), so the first edit still clears its base. Committed `be5b3e90`.

The "bolder" look on selection is the shared overlay's intended selected state (a solid colored polyline + solid box, versus the quiet double outline when unselected), not a paint change.

Added UAT row:
- **PASSED (2026-10-23) — Duplicate in Move mode:** Duplicate a brush key while Move is armed; the new key shows Move outlines and badges immediately (no tool refresh). Select a stroke (standard bolder selection), drag it: the faithful rebake renders correctly and the outline tracks the moved stroke.

## Live UAT (ALL PASSED — user approval 2026-10-23)

- [x] **PASSED (2026-10-23) — Navigation parity/speed:** Paint several overlapping multi-color strokes on a brush key; navigate away and back. The key appears instantly with its original look (no growth, no halos) and navigation is noticeably faster than the previous eager replay.
- [x] **PASSED (2026-10-23) — Duplicate + edit:** Duplicate a brush key, enter Move, drag/delete a stroke: no phantom copy remains, the frame rebakes faithfully, and a partial frame still preserves its pre-existing base.
- [x] **PASSED (2026-10-23) — First-edit rebake and repeat consistency:** Enter Move on that key and drag one stroke; the frame rebakes faithfully the first time, and a second move/step/delete in the same visit behaves identically (no fallback look change).
- [x] **PASSED (2026-10-23) — Undo/redo after rebake:** After the rebake, undo/redo still track the retained script and the Move overlay (h9v rows 3 and 7 still hold).
- [x] **PASSED (2026-10-23) — Partial frames unchanged:** A frame with pre-existing cached paint plus new brush strokes stays partial and view-only.
- [x] **PASSED (2026-10-23) — Diffusion frames fail-closed:** Physics-run (diffusion) frames show cached pixels and are reported non-editable in the probe at HD.
- [x] **PASSED (2026-10-23) — Watercolor unchanged:** Watercolor paint/select/move/undo behavior is unchanged.
- [x] **PASSED (2026-10-23) — Heavy frame budget:** A heavy painted frame restores within the measured budget on navigation, and its first-edit rebake cost matches the SUMMARY measurement (no visible freeze beyond the recorded figure).
- [x] **PASSED (2026-10-23) — DEV probe agreement:** `window.__EFX_SCRIPT_MEMORY__.snapshot()` shows complete/editable rows matching what Move lists.

## Self-Check: PASSED

- All 8 listed source/test artifacts exist on disk.
- All task commits (`f8c5969f`, `47789f94`, `c99175b9`, `eefb4493`, `3d66fb56`, `87686cfa`, `be5b3e90`) are ancestors of HEAD.
- Working tree contains no uncommitted code changes; only the untracked `.planning/quick/261023-j5b-.../` docs (orchestrator-owned).
