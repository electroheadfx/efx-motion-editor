---
phase: 60-studio-timeline-horizontal-zoom
reviewed: 2026-11-09T20:14:15Z
depth: deep
files_reviewed: 9
files_reviewed_list:
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  - app/src/components/physic-paint/physicsPaintStudio.css
  - app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts
  - app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.test.ts
  - app/src/components/physic-paint/roto/rotoLivePixelCacheTransactions.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintReferenceTransform.ts
  - app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx
  - app/src/components/physic-paint/view/physicsPaintRailEditCursorSeat.test.ts
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
  necessity: 0
status: issues_found
---

# Phase 60: Code Review Report

**Reviewed:** 2026-11-09T20:14:15Z
**Depth:** deep
**Files Reviewed:** 9
**Status:** issues_found

## Summary

**Scope status: `degraded`.** The evaluation scope was resolved from `e88a33204` to HEAD; the phase's own task commits did not delimit it, so the range also contains the interleaved quick-task and debug-session commits that touched these files. The reviewable delta across the nine files is 391 insertions / 8 deletions, produced by four commits: `9f6b0c9e3` (cursor seats on the rail-edit chain), `22662b433` (pending destination capture settle), `26e0e7cd9` (per-identity pending test), `8b1508db8` (capture ink floor 1 → 0.3). Findings are attributed to those commits below. Each file's current state was read at deep depth, including the pre-existing machinery the delta depends on (`buildRailMotionEditCss`, `getRailMotionBounds`, `createRotoReferenceLoader`, `rotoLivePixelCacheTransactions.flush/hasPending`, `findCachedRotoDisplayFrame`).

Two warnings. The cursor-seat fix (`9f6b0c9e3`) is correct for the case it was written for — a pure rail translation — but its stated premise, "`cursorX/Y` are content coordinates", holds only for a translation: the values are measured against the shell's transformed `getBoundingClientRect`, and the ring size is derived from that same transformed height, so the seat's re-application of the chain double-counts rail **scale** (and its AABB-origin arithmetic breaks under rotation). The settle effect (`22662b433`) re-checks `rotoNavigationGeneration` and the propagated `startFrame` after its unbounded await, but not `rotoCachedPlayback.isActive`, which its own comment declares part of the same invariant. Three info items: an unhandled-rejection tail outside the settle effect's try/catch, the residual sub-sample band of the 48×48 ink mean, and two new pins that assert wiring/substrings rather than the geometry or the post-await guard, so neither warning has a failing test.

Verified sound in the delta: the destination arm is sampled before the synchronous cached-base load and a propagation cannot interleave (the nav path from `setCachedRotoReferenceUrl(null)` through the load is synchronous); the arm is consumed before the await so a re-run cannot double-flush; the post-await generation and `startFrame` guards correctly reject superseded navigation; the byte-carrier comparison is a true content identity for committed records; `loadCachedRotoReferenceFrame` mirrors `cachedRotoRepaintBaseFrame` synchronously (`useRotoReferenceController.ts:231`), so the comparison sees the destination record, not the previous frame; group-frame captures never arm because they queue no parent payload (`useRotoFramePersistenceCoordinator.ts:555-559`); the forced reload matches the existing generated post-flush repaint sequence (`PhysicsPaintStudio.tsx:5563-5566`); the ink floor is applied consistently at both gate sites and is well supported by the recorded measurements.

No Critical findings. The previously recorded disposition rows (WR-01, WR-02, IN-01..IN-04 open; CR-01, CR-02, WR-03, WR-04, IN-05..IN-07 fixed) are deliberately not re-raised, and no recorded ID is reused: numbering continues at WR-05 / IN-08 so the disposition gate cannot silently drop an open row on ID collision. The necessity rubric (`necessity-review.md`) was read and applied; it produced zero findings — the new guards defend live states (pending captures, playback runs, superseded navigation), and the seat helper has two real instantiations, so nothing here qualifies as an impossible-state guard, already-defended-elsewhere, cargo cult, lapsed requirement or uninstantiated generality. No `<structural_findings>` payload was supplied, so there is no Structural Findings section.

## Narrative Findings (AI reviewer)

Ordered by severity: Critical (none) → Warnings → Info.

### WR-05: Rail-edit cursor seats re-apply a chain whose result the cursor coordinates and ring size already contain — both overlays detach under rail scale and the ring renders s× too large

**File:** `app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx:425-465` (spreads at `:434` and `:459`); helper `app/src/components/physic-paint/view/PhysicsPaintReferenceTransform.ts:205-209`
**Originating commit:** `9f6b0c9e3` — `fix(physic-paint): seat paint cursors on the rail-edit chain (studio-paint-motion-offset)`
**Issue:** The fix's premise — stated in the new view comment (`PhysicsPaintStudioView.tsx:418-424`), the CSS comment (`physicsPaintStudio.css:8545-8550`) and the new pin's header (`physicsPaintRailEditCursorSeat.test.ts:11-24`) — is that `cursorX/cursorY` are content coordinates. They are not: they are `clientX - rect.left` / `clientY - rect.top` measured against the **transformed** `getBoundingClientRect` of the live layer (`engine/AquarelleCanvasLayer.tsx:905-916`, `:918-927`), i.e. the transformed AABB origin. That origin equals the content origin only when the rail chain is a pure translation. The same transformed rect feeds the ring size: `cursorLayerHeight = rect.height` (`AquarelleCanvasLayer.tsx:906-907`, `:922-924`) → `footprintCssSize` → `2 * radiusDoc * layer` (`engine/aquarelleFootprint.ts:176`), so the ring's CSS size already contains the rail `scale(s)`. The seat (`buildRailMotionEditSeatStyle`, `PhysicsPaintReferenceTransform.ts:205-209`) then applies the full chain `translate(pivot + offset) rotate scale translate(-pivot)` (`:173-191`), which:

1. **Size:** multiplies the ring by `s` a second time — the ring renders `s²` while the composited paint it must match renders `s`, because the seat's `scale` is the same value the shell already applied to the rect the height was read from.
2. **Position:** the pivot term cancels inside the AABB subtraction, so the seat maps a content offset `d` from the shell origin to `s²·d` where the shell maps it to `s·d`; the overlay drifts by `(s² − s)·d` — ≈312 px at `d = 1000 px` with `s = 1.25`. Under rotation the AABB origin is not the content origin at all, so the same subtraction is wrong on both axes.
3. The picker visor shares the defect (`AquarellePickerVisor.tsx:23` places the tip at `left + cursorX`, then the seat re-transforms that point) and additionally has its fixed 20 px glyph rotated/scaled by the rail chain — the tip position is the defect; the glyph transform is a design question.

This is reachable whenever the active rail's evaluated motion at the current frame carries `scale ≠ 1` (or rotation): the producer only excludes playback and identity (`PhysicsPaintStudio.tsx:10063-10076`), so any Position+Scale/Rotation rail exposes it. The new pin cannot catch it: it asserts the CSS string and the two wiring sites only, never the geometry.
**Fix:** Make the overlay coordinates document-space and the footprint transform-free, then let the seat provide the screen mapping.

- Derive the footprint from the untransformed layout height (`(event.currentTarget as HTMLElement).offsetHeight`) instead of `getBoundingClientRect().height` in `AquarelleCanvasLayer.tsx:905-907` and `:922-924`. Under an identity rail this is the same number, so the no-rail path is unchanged.
- Un-project the pointer through the inverse of the rail chain before writing `cursorX/cursorY`. Add one helper next to the chain it inverts (`PhysicsPaintReferenceTransform.ts`):

```ts
/** Screen point (client coords) -> content point of the transformed shell. */
export function projectRailMotionScreenPoint(
  clientX: number,
  clientY: number,
  origin: { left: number; top: number },
  transform: { translateX: number; translateY: number; scale: number; rotationRadians: number; pivotX: number; pivotY: number },
  canvasWidth: number,
  canvasHeight: number,
  zoom: number,
): { x: number; y: number } {
  const px = transform.pivotX * canvasWidth;
  const py = transform.pivotY * canvasHeight;
  const dx = clientX - origin.left - px - transform.translateX * zoom;
  const dy = clientY - origin.top - py - transform.translateY * zoom;
  const cos = Math.cos(-transform.rotationRadians);
  const sin = Math.sin(-transform.rotationRadians);
  const s = transform.scale === 0 ? 1 : transform.scale;
  return { x: px + (dx * cos - dy * sin) / s, y: py + (dx * sin + dy * cos) / s };
}
```

  Wire it at the pointer handlers (the rail transform inputs must reach the mount, or the projection is computed in the view and written to the existing cursor signals). Keep the identity path byte-identical (no transform → today's `clientX - rect.left`).
- Correct the "cursorX/Y are content coords" claims in the view/CSS/pin comments, since that premise is what produced the gap.
- Add a geometry pin: screen→content round-trip through `buildRailMotionEditCss` at `scale` 0.5 / 1 / 1.25 and `rotationRadians` 0.3, including a non-centered pivot.

### WR-06: The settle effect's own "an active run owns the display" guard is read only before an unbounded await, so a playback started mid-flush is overwritten

**File:** `app/src/components/physic-paint/PhysicsPaintStudio.tsx:5603-5606` (pre-await guard) vs `:5609-5633` (post-await tail)
**Originating commit:** `22662b433` — `fix(261109-pwt): settle a cached destination's pending capture after display`
**Issue:** The effect documents the invariant "An active run owns the display" and refuses to settle while `rotoCachedPlayback.isActive` (`:5603-5606`). That read is a render-time closure value — `isActive` is `useState` in the playback hook (`hooks/useRotoCachedPlayback.ts:89`), and the comment itself notes the controller object identity changes every render, which is why it is deliberately not a dependency (`:5601-5602`). The await at `:5612` (`flushLivePixels`, which can wait out a WebP encode plus parent delivery and a bounded retry turn) is unbounded; if the user presses Play during it, the tail still runs `setCachedRotoReferenceUrl(null)` / `clearPreviewBaseImage(true)` / `resetBackground(true)` / `loadCachedRotoReferenceFrame(...)` at `:5629-5632` while the playback run owns the display. The tail re-checks generation (`:5618`) and the propagated `startFrame` (`:5619`) — the two guards that can be re-read live — but not playback. Whether the overwrite is visible depends on playback asset/CSS coverage, which is why this is a warning rather than a blocker; the guard gap itself is provable from the code.
**Fix:** Mirror the controller into a ref updated every render (`rotoCachedPlaybackRef.current = rotoCachedPlayback`, the same pattern as `cachedRotoRepaintBaseFrameRef` / `launchContextRef` already used here) and re-check it after the await, before touching the base:

```ts
if (rotoCachedPlaybackRef.current.isActive) return; // after the flush, before the byte comparison
```

Leave the deps array unchanged (`:5634`) — the ref read preserves the run-time semantics the existing comment asks for.

### IN-08: The settle effect's async IIFE leaves its post-await tail outside the try/catch

**File:** `app/src/components/physic-paint/PhysicsPaintStudio.tsx:5609-5633`
**Issue:** In `void (async () => { try { ...flush... } catch (error) { console.error(...) } ... })()` the `try` covers only the flush. Everything after it — the store lookup at `:5620`, the preview ports and `loadCachedRotoReferenceFrame` at `:5629-5632` — runs outside the handler, and the IIFE's promise is discarded with `void`, so a synchronous throw there becomes an unhandled promise rejection instead of a logged fault.
**Fix:** Attach a terminal handler to the IIFE or move the whole tail inside the existing `try`:

```ts
void (async () => { /* whole body */ })().catch((error) => {
  console.error('[PhysicsPaintStudio] pending destination settle failed', error);
});
```

### IN-09: The 48×48 ink mean leaves a sub-sample band where real marks are still dropped at capture

**File:** `app/src/components/physic-paint/PhysicsPaintStudio.tsx:665-690`; gates at `:2104-2108` and `:9398`
**Originating commit:** `8b1508db8` — `fix(261109-pwt): stop the capture ink gate from dropping faint wet washes`
**Issue:** Lowering the floor from 1 to 0.3 is well supported by the recorded measurements (blank 0.05–0.12 vs live rejected washes 0.71–0.94) and is a strict improvement, but the metric is a mean over a 48×48 downsample (`:678-686`), so one fully-dark sample contributes only ≈0.4 per-mille. On a 2000×2000 sheet a sample covers ≈1736 px², so the 0.3 floor still rejects any mark with less than about one dark sample — e.g. a single ~20 px-radius dab (≈1257 px²) scores ≈0.29 and is discarded when the frame is left, the same silent loss the commit set out to remove, now confined to small marks. This is a residual limit of the metric, not a regression of the change.
**Fix:** Keep the mean floor and add an absolute-coverage clause so a small, genuinely inked mark cannot fall under it — count samples with `248 - luminance >= 32` and accept when `inkedSamples >= 1` (or `>= 2`) in addition to `ink >= AQUARELLE_MIN_CAPTURE_INK`. Blank textured sheets measured 0.05–0.12 mean, so a per-sample threshold well above paper grain will not trip.

### IN-10: The two new pins assert wiring and guard substrings, so neither warning above has a failing test

**File:** `app/src/components/physic-paint/view/physicsPaintRailEditCursorSeat.test.ts:45-76`; `app/src/components/physic-paint/PhysicsPaintStudio.test.ts:6276-6305`
**Issue:** The seat pin verifies the CSS string, the identity no-op and the two `...buildRailMotionEditSeatStyle(railEditCss)` call sites — it cannot observe that the coordinates and height fed to the seat already include the chain, so WR-05 ships green. The settle pin asserts the arm ordering, consume-before-await, the generation/startFrame/playback guard **strings**, and the deps tail — but not the post-await playback re-read (its `not.toContain('rotoCachedPlayback.isActive,')` pins the deps array only, so a ref-based fix keeps it true), so WR-06 also ships green.
**Fix:** Add a pure-function pin for the geometry helper introduced by the WR-05 fix (round-trip through `buildRailMotionEditCss` at scale 0.5/1/1.25 and rotation 0.3 rad with a non-centered pivot), and extend the settle pin to require the playback re-check between the `await flushLivePixels` line and the `setCachedRotoReferenceUrl(null)` force-reload line.

---

_Reviewed: 2026-11-09T20:14:15Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
