---
phase: 261029-hy2
reviewed: 2026-10-29T12:49:27Z
depth: quick
files_reviewed: 11
files_reviewed_list:
  - app/src/components/physic-paint/view/PhysicsPaintBrushModal.tsx
  - app/src/components/physic-paint/view/PhysicsPaintSettingsModal.tsx
  - app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx
  - app/src/components/physic-paint/view/floatingSheetStack.ts
  - app/src/components/physic-paint/physicsPaintStudio.css
  - app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx
  - app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx
  - app/src/components/physic-paint/view/RightPanelBrushTab.tsx
  - app/src/components/physic-paint/view/aquarelleRecordState.ts
  - app/src/components/physic-paint/view/PhysicsPaintBrushMenu.tsx
  - app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx
findings:
  critical: 2
  warning: 3
  info: 1
  total: 6
status: issues_found
---

# Quick task 261029-hy2: Code Review Report

**Reviewed:** 2026-10-29T12:49:27Z
**Depth:** quick
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Scope: the right-pinned Studio settings cluster and unified Brush/Eraser pill, the Settings tab moved into a new floating sheet, the slimmed Brush tab, the shared floating-sheet stack, and the brush-modal Close-button fix. All 11 files were read in full; `LiftShapePicker.tsx` was intentionally deleted and is not reported. Verification run: `vitest run` on the four targeted suites (61 tests) and `tsc --noEmit` both pass, so the findings below are behavioral/contract defects the existing pins do not cover — notably, the stack tests assert that `onPointerDownCapture` exists but never that opening a sheet raises it, and the top-bar tests assert the CSS wrote `flex-end` but never that the leading control survives the squeeze.

The two blockers are feature-breaking: sheets can open completely invisible beneath a sibling (and stay unreachable), and the plan's own UAT row 2 (leading Brush-size control clipped at 720 px, with an explicit Water-hide instruction) is not satisfied.

## Narrative Findings (AI reviewer)

### CR-01 [BLOCKER]: Sheets never raise on open — a newly opened sheet can be invisible and unreachable beneath a sibling

**File:** `app/src/components/physic-paint/view/floatingSheetStack.ts:47-52` (raise only via `bringSheetToFront`), `app/src/components/physic-paint/view/PhysicsPaintBrushMenu.tsx:154-157` (open-modal action), `app/src/components/physic-paint/view/RightPanelBrushTab.tsx:33` (Settings entry point)

**Issue:** `bringSheetToFront` is invoked exclusively from each sheet's root `onPointerDownCapture` (`PhysicsPaintBrushModal.tsx:192`, `PhysicsPaintSettingsModal.tsx:196`, stroke dialog's root). No open path raises. With the initial order `[stroke-settings, brushes, settings]` (`floatingSheetStack.ts:25-29`), z-indexes are 50/51/52. Concrete failure:

1. Open the Settings sheet from the Brush tab (z 52, opaque `rgba(28, 30, 34, 0.9)` surface, `PhysicsPaintSettingsModal.tsx:73`).
2. Click the brush pill → "Open modal". `PhysicsPaintBrushMenu.tsx:154-157` closes the menu and sets the brush modal open without raising it; it mounts at z 51 under the Settings sheet.
3. Both surfaces use the same seat — `top: 12px; right: 12px; width: 372px; height: min(560px, calc(100% - 24px))` (`PhysicsPaintBrushModal.tsx:51-73`, `PhysicsPaintSettingsModal.tsx:56-77`). The Settings sheet covers the brush catalog completely, so the catalog has zero visible and zero clickable pixels. The only raising path (pointerdown capture) can never fire because the covering sheet consumes every press. The user sees "Open modal" do nothing; the dropdown has already closed.
4. Symmetrically, clicking the Brush tab's Settings button while Settings is already open and beneath another sheet is a silent no-op: `setAquarelleSettingsModalOpen(true)` early-returns on the compare-then-write (`aquarelleRecordState.ts`), and nothing calls `bringSheetToFront`, so the button cannot recover its sheet.

This makes UAT row 6 ("with all three sheets open, clicking each brings it above the others") unsatisfiable for the covered sheet and turns the new Settings entry point into a dead button in a reachable state.

**Fix:** raise at every open call site (event handlers only — never a render body, per efx-preact-reactivity rule 6):

```ts
// PhysicsPaintBrushMenu.tsx
import { SHEET_ID_BRUSHES, bringSheetToFront } from './floatingSheetStack';
onClick={() => {
  setAquarelleBrushMenuOpen(false);
  bringSheetToFront(SHEET_ID_BRUSHES);
  setAquarelleBrushModalOpen(true);
}}
```

```ts
// RightPanelBrushTab.tsx
import { SHEET_ID_SETTINGS, bringSheetToFront } from './floatingSheetStack';
onClick={() => {
  bringSheetToFront(SHEET_ID_SETTINGS);
  setAquarelleSettingsModalOpen(true);
}}
```

Apply the same raise at the stroke-settings open seam. Add a regression test that opens two sheets in the adverse order and asserts the newly opened one carries the top z-index.

### CR-02 [BLOCKER]: Right-pinned top-bar cluster clips the leading control into the unscrollable start edge below ~780 px; the Water hide tier does not exist

**File:** `app/src/components/physic-paint/physicsPaintStudio.css:472-482` (`justify-content: flex-end; min-width: 0`), `:543-559` (hide tiers), `:452` (`overflow-x: auto`), `app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx:358`

**Issue:** `.physics-paint-topbar-primary` is `flex: 1 1 auto; min-width: 0` and right-pinned, so when its content exceeds the remaining width the overflow exits the inline-start (left) edge. The header is the scroller (`overflow-x: auto`, line 452), but LTR scroll positions cannot go negative, so the overflowing leftmost control is painted outside the scrollable region and is permanently unreachable — not merely hidden. The hide chain drops only Grain and Edges; `.physics-paint-topbar-optional-water` is applied to the Water slider (`PhysicsPaintTopBar.tsx:358`) but no rule for it exists anywhere in the stylesheet (grep returns only the four Grain/Edges lines).

Measured against the ≤1180 px block (`physicsPaintStudio.css:7206-7239`: bar gap 8, primary column-gap 8, slider `min-width: 115px`):

- Left cluster (`flex: 0 0 auto`, `:460-470`): status pill ~82 px + brush trigger ~200-230 px (15 px margin + 5/9 px padding + 2 px border + 3×8 px gaps + 15 px icon + 96 px thumb + name, `:759-816`) + Script switch ~80 px ≈ 380-395 px.
- Brush cluster needs 3 × 115 + 2 × 8 = 361 px for Size + Pigment + Water after Grain and Edges are hidden.
- At a 720 px viewport the content box is 696 px, leaving roughly 300 px for the primary — a ~60 px shortfall. Brush size (the leftmost control) is clipped and unreachable.
- The Eraser cluster is worse and has no hide chain at all: Size 115 + gap 10 + Eraser strength `min-width: 180px` (`:529-535`) + gap 10 + Edit switch ≈ 390-400 px, so it clips from roughly 800 px downward.

The plan anticipated exactly this (`.planning/quick/261029-hy2-.../261029-hy2-PLAN.md:317`: "the leading Brush size control is never clipped (if it clips, extend the chain with a Water-hide container rule rather than shifting thresholds blindly)"; `261029-hy2-RESEARCH.md:104` repeats the start-edge warning). The implementation shipped `flex-end` without the Water tier, so UAT row 2 fails at 720 px by construction.

**Fix:** add the missing tier, keeping the existing threshold math (three visible controls = 361 px at ≤1180; 3 × 140 + 2 × 10 = 440 px above):

```css
@media (min-width: 1181px) {
  @container (max-width: 439px) {
    .physics-paint-topbar-primary .physics-paint-topbar-optional-water { display: none; }
  }
}
@media (max-width: 1180px) {
  @container (max-width: 360px) {
    .physics-paint-topbar-primary .physics-paint-topbar-optional-water { display: none; }
  }
}
```

The rules must stay below `.physics-paint-topbar-control` (same descendant-selector precedence note as `:541-542`) and inside the existing media blocks. Also protect the Eraser cluster, which has no fold-back: reduce `.physics-paint-topbar-lift-strength`'s 180 px minimum below 1180 px and/or let `.physics-paint-topbar-lift` wrap. Re-verify live at 1440 / 1180 / 861 / 720 px as the UAT row requires.

### WR-01 [WARNING]: Identical default seats leave a fully covered sheet with zero hit area — click-to-front only works after dragging

**File:** `app/src/components/physic-paint/view/PhysicsPaintBrushModal.tsx:51-59`, `app/src/components/physic-paint/view/PhysicsPaintSettingsModal.tsx:56-64`, `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx` (`SURFACE_STYLE`)

**Issue:** All three sheets default to the same top-right seat with the same height formula; the brush catalog and the Settings sheet are pixel-identical at 372 px wide. Click-to-front can only raise a sheet the user can press, so the lower of two identically seated sheets has no pressable pixel — the feature's own premise (UAT row 6) cannot be exercised for it, and CR-01's hidden-open state has no recovery gesture. This is why the stack works only after the user happens to drag one sheet aside.

**Fix:** stagger the initial seats, e.g. cascade `top` by sheet index — stroke `12px`, brushes `28px`, settings `44px` — so a covered sheet always keeps a ~16 px strip of its 38 px header visible and clickable. Alternatively, offset the newly opened sheet by a fixed step per currently-open sheet.

### WR-02 [WARNING]: Settings-sheet Escape handler lacks the editable-input guard the stroke dialog already has

**File:** `app/src/components/physic-paint/view/PhysicsPaintSettingsModal.tsx:107-112`

**Issue:** Any Escape closes the whole sheet, including while the user is typing in a `SliderStepper` number input (`app/src/components/shared/SliderStepper.tsx:453`) inside the eight response multipliers. The capture-phase `preventDefault()` / `stopPropagation()` also swallows the key before the input's native handling. `PhysicsPaintStrokeSettingsDialog.tsx:381-391` solves this exact problem by bailing when an editable inside the dialog is the event target; the new sheet copied the handler without that guard, so the two sheets now behave differently for the same gesture.

**Fix:** port the guard:

```ts
const target = event.target as { closest?: (selector: string) => unknown } | null;
const editable = target?.closest?.('input, textarea, [contenteditable="true"]');
if (editable && (editable as Element).closest?.('[data-testid="physics-settings-modal"]')) return;
setAquarelleSettingsModalOpen(false);
```

### WR-03 [WARNING]: One Escape press closes every open sheet

**File:** `app/src/components/physic-paint/view/PhysicsPaintBrushModal.tsx:109`, `app/src/components/physic-paint/view/PhysicsPaintSettingsModal.tsx:113`, `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx:396`, `app/src/components/physic-paint/view/floatingSheetStack.ts:42-52`

**Issue:** Each sheet registers its own `window.addEventListener('keydown', onKeyDown, true)`. Listeners on the same node in the same phase all run; `stopPropagation()` (used by all three handlers) does not suppress other listeners on that same target — only `stopImmediatePropagation()` would. With two or three sheets open, a single Escape flips every open flag false, so the user cannot dismiss just the front sheet. The stack module knows which sheet is front (`floatingSheetOrder`), but no handler consults it.

**Fix:** centralize dismissal in `floatingSheetStack.ts` (one window listener that closes only the front sheet's flag) or, if the handlers stay separate, have each handler verify it is front before acting:

```ts
const order = floatingSheetOrder.peek();
if (order[order.length - 1] !== SHEET_ID_SETTINGS) return;
```

and use `stopImmediatePropagation()` where a handler wins. Add a pin: open two sheets, press Escape once, assert only the front one closed.

### IN-01 [INFO]: Floating-sheet mechanics are triplicated and already diverging

**File:** `app/src/components/physic-paint/view/PhysicsPaintBrushModal.tsx`, `app/src/components/physic-paint/view/PhysicsPaintSettingsModal.tsx`, `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx`

**Issue:** Drag state/clamps, bottom resize, Escape wiring, the close-button pointerdown guard, `SURFACE_STYLE`, `RESIZE_HANDLE_STYLE` and `CONTENT_STYLE` are near-copies across three files (~150 lines each). The copies have already diverged once (WR-02's Escape guard exists in only one), and the Settings sheet even reuses the brush modal's CSS class (`.physics-paint-brush-modal`) rather than owning a shared surface abstraction. Fixing CR-01/WR-01/WR-03 correctly means changing all three sites in lockstep.

**Fix:** extract a shared `useFloatingSheet(id, { width, background })` hook plus shared style constants (seat staggering, stack raise on open, front-only Escape, drag/resize clamps). Keep the per-sheet body and chrome as the only differences.

---

_Reviewed: 2026-10-29T12:49:27Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
