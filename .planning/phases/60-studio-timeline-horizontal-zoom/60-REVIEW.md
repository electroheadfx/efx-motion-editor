---
phase: 60-studio-timeline-horizontal-zoom
reviewed: 2026-11-09T16:52:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - app/src/components/physic-paint/physicsPaintStudio.css
  - app/src/components/physic-paint/view/PhysicsPaintTimelineZoomBar.tsx
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.zoomMatrix.test.ts
  - app/src/components/physic-paint/view/physicsPaintTimelineZoom.test.ts
  - app/src/components/physic-paint/view/physicsPaintTimelineZoom.ts
  - app/src/components/physic-paint/view/physicsPaintTimelineZoomWiring.test.ts
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
  necessity: 0
status: issues_found
---

# Phase 60: Code Review Report (incremental)

**Reviewed:** 2026-11-09T16:52:00Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Incremental review of the two commits since the deep-review baseline `c9f73b2f1` (`abfe299a3`, `7c55ea4c4`, +205/−85 across the seven files). Scope: the per-layer zoom persistence path, the deferred anchored-scroll coalescer, the Fit→100% reset conversion, and the strip's new scroller variable and `[props.layerId]` effect dependency.

Both prior criticals verify fixed in this range and are not re-raised: the current-frame marker now takes its width inline from the live cell width and the CSS rule no longer pins 16px (`PhysicsPaintWorkflowStrip.tsx:6049-6057`, `physicsPaintStudio.css:8150-8164`), and the anchored write is deferred one frame through `commitAnchoredScroll` so it lands after Preact's microtask render (`physicsPaintTimelineZoom.ts:298-343`). The prior open findings (WR-01, WR-02, IN-01..IN-04) are unchanged and remain recorded in `60-REVIEW-DISPOSITION.md`; they are deliberately not repeated here.

Focus-area verdicts:

- **localStorage persistence.** Read and write are both inside try/catch, so a throwing access (private mode, disabled storage) degrades to an in-memory session rather than failing the zoom (`physicsPaintTimelineZoom.ts:240-264`). Stored values are filtered to finite numbers and clamped on read (`:247-249`); a non-object root is rejected; `__proto__`/constructor keys cannot pollute because `JSON.parse` and `Object.fromEntries` create own data properties. No cross-layer read leakage: `resetForStudioOpen` sets `activeLayerId` before any write and reads only the new layer's key (`:430-437`). The residual defect is the eviction policy (WR-03).
- **Deferred coalescer.** Newest target wins, one write per animation frame, discarded on `resetForStudioOpen` and on port unregister, and a target of exactly 0 is preserved (`:306-343`). The deferral lands after the scale signal's render microtask, which is what keeps CR-02 fixed. No dropped or duplicated legitimate write was found. The rAF-vs-`setTimeout` cancellation guard asymmetry (`:309-314` vs `:331-333`) is unreachable because `cancelPendingScrollFrame` is only called from `discardPendingScroll`, and no runtime exposes one scheduler without its canceller.
- **100% reset anchoring.** The reset is an epsilon no-op at 100%, anchors on the playhead centre with the viewport-centre fallback, and clamps at 0 (`:409-423`). The 6px gutter cancels exactly in the anchored law: `resolvePlayheadAnchorLocalX` and the playhead itself are both measured in the same gutter-less frame space, so dropping the gutter from `localX` does not move the fixed point. The defect is test coverage, not math (WR-04).
- **Strip `[props.layerId]` effect.** The dep is a string, hence identity-stable; the reset precedes registration; cleanup unregisters and discards the queued write (`PhysicsPaintWorkflowStrip.tsx:2778-2792`). The one-shot open-positioning effect (`:5056-5081`) peeks the metrics signal in the same effect flush after the reset, but on a fresh open it runs before the async launch settle supplies cells (it parks and retries on `props.rotoPhysicalCells.length`), and on a view remount the first render already carries the current module scale, so no inconsistent-geometry path was provable. The wheel coalescer cancels itself independently (`:5541-5547`).
- **CSS.** `--timeline-cell-width` is published once from the live metrics (`:6325`) and matches the per-row value (`framePitch - frameGap`, all five sites receive both live). The ruler and marker consume it correctly. One sub-cell-scale width discrepancy at 0.25x (IN-07).

Findings: 0 critical, 2 warnings, 3 info. Necessity: 0 — the `necessity-review.md` rubric was applied; the new branches are trust-boundary handling (storage access, wheel-event values), type-guard defaults, and dead code (explicitly category 3, not necessity), and the port/store surface exists as the project's test seam (explicitly excluded from necessity).

The three zoom test files pass as written (`vitest run`: 3 files, 125 tests); that is not treated as evidence of the defects below, since every finding here is in behavior the suites do not assert.

## Warnings

### WR-03: Per-layer zoom memory evicts by first-seen order, so actively used layers silently lose their remembered density

**File:** `app/src/components/physic-paint/view/physicsPaintTimelineZoom.ts:237-238` (key, cap), `:257-264` (`writeStoredScales`), `:280-283` (write on change), `:430-437` (restore)
**Issue:** `writeStoredScales` serializes `[...scaleByLayer.entries()].slice(-MAX_REMEMBERED_LAYERS)`. A `Map` keeps a key's original insertion position when that key is re-set, and nothing ever re-inserts a layer on use: `setScaleSignal` calls `scaleByLayer.set(activeLayerId, clamped)` only (`:281`), and `resetForStudioOpen` only reads. The 64-slot window is therefore FIFO by first-ever zoom, not least-recently-used. A layer the artist works in daily but first zoomed long ago drifts toward the tail window as new layers are zoomed and is dropped on the next write; a fresh `resetForStudioOpen` for a layer with no entry also appends that layer (it persists the restored default `1` whenever the session's current scale differs from 1), so newly touched layers consume slots even without a zoom. The map itself is never trimmed, so eviction is invisible for the rest of that Studio session and only surfaces after the next close/reopen — the exact UAT row 5 promise ("returns to the level it was left at") failing silently. The blob is global to every project (layer ids are per-document UUIDs, so no collision, but all projects compete for the same 64 slots), and the cap is untested: no test in `physicsPaintTimelineZoom.test.ts` exercises more than three layers.
**Fix:** Promote on touch and keep memory and storage in agreement:
```ts
scaleSignal.value = clamped;
if (activeLayerId !== null && scaleByLayer.get(activeLayerId) !== clamped) {
  scaleByLayer.delete(activeLayerId);
  scaleByLayer.set(activeLayerId, clamped); // re-insert = newest
  while (scaleByLayer.size > MAX_REMEMBERED_LAYERS) {
    const oldest = scaleByLayer.keys().next();
    if (oldest.done) break;
    scaleByLayer.delete(oldest.value);
  }
  writeStoredScales();
}
```
and add a test that fills 65 layers, re-touches the first, and asserts the first survives a `vi.resetModules()` rebuild while the least-recently-used is gone.

### WR-04: The 100% reset test exercises only the off-screen fallback, and neither test file pins the anchored value

**File:** `app/src/components/physic-paint/view/physicsPaintTimelineZoom.test.ts:386-397`, `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.zoomMatrix.test.ts:630-648`
**Issue:** The store test is named "returns to 100% anchored on the playhead centre", but its fixture (`scrollLeft: 2000`, `playheadFrame: 10`, old scale 3) puts the playhead's content centre at 6 + 540 + 26 = 572px, far outside the visible 2000..2800 window, so `resolvePlayheadAnchorLocalX` takes the viewport-centre fallback and the playhead-centre branch of `resetTo100` is never executed; the only assertion on the written value is `readScrollLeft()).toBeGreaterThan(0)`. The matrix test was rewritten from Fit and now asserts `toHaveBeenCalledTimes(1)` only — the old `toHaveBeenCalledWith(0)` was deleted and no value replaced it. Both suites pass for a wrong anchor: anchoring at localX 0 would write 666.67 in the store fixture and 0 in the matrix fixture. The headline behavior of the new pill control therefore has no regression pin beyond live UAT.
**Fix:** Pin the values the law produces. Store fixture (off-screen fallback): `expect(readScrollLeft()).toBeCloseTo(400, 9)`. Matrix fixture (on-screen playhead at 91.925px): read `const [[written]] = setScrollLeft.mock.calls;` and `expect(written).toBeCloseTo(95.041102, 4)`. Add one store case with an on-screen playhead (e.g. `scrollLeft: 0`, `playheadFrame: 10`, old scale 3) so the playhead-centre branch is pinned too.

## Info

### IN-05: `getFrameCount` died with `fit()` but is still a required port member, still pinned by the wiring test

**File:** `app/src/components/physic-paint/view/physicsPaintTimelineZoom.ts:60`, `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx:2727-2730`, `:2789`, `:3097`, `app/src/components/physic-paint/view/physicsPaintTimelineZoomWiring.test.ts:61`
**Issue:** `fit()` was the only reader of `getFrameCount()`. After the 100% reset replaced it, the interface member, the strip's registration (`:2789`), the `timelineFrameCountRef` declaration (`:2730`) and its per-render assignment (`:3097`) exist only to satisfy the two test stubs, and the wiring test actively enforces the dead registration as a requirement. The declaration comment still says "Fit action reads it". A repository-wide search finds no production read.
**Fix:** Remove `getFrameCount()` from `TimelineZoomScrollPort`, the registration line, the ref and its assignment, and the wiring-test pin; delete the member from the two test ports.

### IN-06: Stale "Fit" documentation where the fourth pill control is now a 100% reset

**File:** `app/src/components/physic-paint/view/PhysicsPaintTimelineZoomBar.tsx:10-11`, `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx:1944`, `:2729`, `:2773`
**Issue:** The bar's contract comment still reads "Fit is a ONE-SHOT action (D-04) — it never re-fits on a later resize, so it carries no aria-pressed and is never a mode", and the strip still lists "Fit" among the port's consumers and says the frame-extent ref exists because the "Fit action reads it". `fit()`, `resolveTimelineFitScale` and the Fit button no longer exist (replaced by `resetTo100`, UAT 2026-11-09), and D-04 is no longer the decision behind this control; a maintainer is pointed at a removed action and decision id. (Line 2671's "Fit to view" is the Studio audio modal's viewport fit and is correct — leave it.)
**Fix:** Reword the bar docstring to the reset semantics ("a one-shot return to 100%, anchored on the playhead centre, never a mode; no aria-pressed") and drop the Fit references at strip lines 1944, 2729 and 2773.

### IN-07: The interp dash is clipped at 0.25x, so the new comment's "75% of the cell" does not hold at the floor

**File:** `app/src/components/physic-paint/physicsPaintStudio.css:8020-8036` (dash), `:7889-7906` (cell box)
**Issue:** The new rule centres the dash (`left: 50%`, `transform: translateX(-50%)`) and sizes it `calc(var(--timeline-cell-width, 16px) * 0.75)`, with a comment claiming it "reads the same at 25% and 400%". The cell is `box-sizing: border-box` with a fixed 1px border and `overflow: hidden`, so its padding box is `cellWidth - 2px`. At 0.25x the cell is 4px but the padding box is 2px while the dash is 3px: the dash is clipped at the padding edge to 2px (50% of the cell), not 3px (75%). Centring is exact at every level (the dash's centre is the border-box centre); only the width claim fails at the floor. 1x (12/16), 0.5x (6/8) and 4x (48/64) are exact.
**Fix:** Either accept the floor and correct the comment, or make the width padding-box-aware:
```css
width: min(calc(var(--timeline-cell-width, 16px) * 0.75), calc(var(--timeline-cell-width, 16px) - 2px));
```
(`min()` leaves 12/16, 6/8 and 48/64 unchanged and clamps 0.25x to the 2px padding box.)

---

_Reviewed: 2026-11-09T16:52:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
