---
phase: 261029-uoz
plan: 01
subsystem: ui
tags: [preact, canvas, devicepixelratio, brush-thumbnails, regression-pin, watercolor]

# Dependency graph
requires:
  - phase: 261017-xa0
    provides: the painted stroke-thumb cache and WatercolorBrushThumb shared by every brush preview surface
  - phase: 261027-gh9
    provides: the top-bar brush dropdown + floating catalog that reuse the same thumb component
provides:
  - DPR-aware blitStrokeThumb (visible bitmap matched to the cached thumb before the 1:1 copy)
  - Regression pin for dpr 2, dpr 1, and the component ref path
affects: [brush previews, top-bar brush trigger, brush dropdown rows, floating brush catalog, right-panel Brush tab]

# Actuals (#2632) — pairs with the plan's `estimate`.
# Same scale as the plan (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 2494
  tasks: 2
  commits: 2

# Measurement instrument (#3968) — measured with `git rev-list --count`, never narrated.
plan_head_before: 7cbc3a7e257b6bc9eaa8e740c75af09f741bc4b2
plan_head_after: 4007f1442b04fbcf92d3b6d5a5f8f4cb167a9bdc

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Match a visible canvas bitmap to a DPR-scaled cache before a 1:1 drawImage — never downscale the cache"
    - "Window-stub helper with try/finally so a fake devicePixelRatio never leaks across cases"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/view/watercolorStrokeThumb.ts
    - app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts

key-decisions:
  - "Resize the visible bitmap to thumb.width/height (guarded by !==), clear on the new bitmap, then copy 1:1 — the scaling drawImage(thumb, 0, 0, target.width, target.height) variant was rejected because it throws away the Retina resolution the DPR cache exists for"
  - "Fix at the one shared seam: no component, CSS class, or JSX width/height attribute changed; the 150x44 logical contract stays pinned"
  - "The pin reads the ref callback from the Preact vnode (vnode.ref), not props.ref, because Preact extracts ref at createElement time"

patterns-established:
  - "DPR cache <-> visible bitmap equality check at the blit boundary"

requirements-completed: [UOZ-DPR-BLIT, UOZ-ALL-SURFACES, UOZ-REGRESSION-PIN]

# Coverage metadata (#1602) — one entry per shipped deliverable.
coverage:
  - id: D1
    description: "blitStrokeThumb sizes the visible bitmap to the DPR-scaled cache before the 1:1 draw, so a 300x88 cache is never cropped into 150x44"
    requirement: UOZ-DPR-BLIT
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts#at dpr 2 the blit copies the whole cached bitmap"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts#at dpr 1 (no window) the blit is unchanged"
        status: pass
    human_judgment: false
  - id: D2
    description: "The component ref path (WatercolorBrushThumb -> cache -> ref -> blit) lands the full 300x88 bitmap"
    requirement: UOZ-DPR-BLIT
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts#the component ref path lands the full bitmap"
        status: pass
    human_judgment: false
  - id: D3
    description: "All four surfaces show the complete painted stroke in the running app on a Retina display (top-bar trigger, dropdown rows, floating catalog, right-panel Brush tab)"
    requirement: UOZ-ALL-SURFACES
    verification: []
    human_judgment: true
    rationale: "The crop only reproduces at devicePixelRatio > 1 inside the packaged webview; vitest runs under node where prepare() falls back to dpr 1 and no real pixels are rendered. UAT-1..UAT-5 are the only proof."
  - id: D4
    description: "Regression pin fails on the old 1:1 blit and passes on the fix"
    requirement: UOZ-REGRESSION-PIN
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts#blitStrokeThumb is DPR-aware (261029-uoz)"
        status: pass
      - kind: other
        ref: "temporary revert of the blit body: dpr-2 + component-ref cases failed (expected 150 to be 300), dpr-1 case passed; fix restored"
        status: pass
    human_judgment: false

# Metrics
duration: 3min
completed: 2026-10-29
status: complete
---

# Quick Task 261029-uoz: DPR-aware brush thumb blit — Summary

**One three-line blit change restores the full painted stroke on every brush preview surface: the visible canvas bitmap is now matched to the DPR-scaled thumb cache before the 1:1 copy, so Retina no longer crops the cache to its top-left quarter.**

## Performance

- **Duration:** ~3 min (from plan revision `7cbc3a7e` to the last task commit `4007f144`)
- **Started:** 2026-10-29T21:11:35Z
- **Completed:** 2026-10-29T21:14:58Z
- **Tasks:** 2
- **Files modified:** 2 (0 created)

## Root Cause

`prepare()` in `watercolorStrokeThumb.ts` has always DPR-scaled the cached thumb bitmap: `Math.min(devicePixelRatio, 2)` applied to the 150x44 logical box, painting through `setTransform(dpr, ...)`. At dpr 2 the detached cache canvas is therefore **300x88**.

`blitStrokeThumb` copied that cache 1:1 into the visible canvas whose bitmap was the JSX markup size, 150x44. Only the **top-left quarter** of the stroke landed — exactly the reported white box with a faint smear at the bottom edge (the stroke's vertical centre at bitmap y=44 fell on the copied quarter's edge). Deterministic on any dpr > 1; dpr 1 was always correct, which is why the node test suite (no `window`, dpr falls back to 1) could not see it.

## The Fix

Inside `blitStrokeThumb`, after the `getContext('2d')` null guard:

```ts
if (target.width !== thumb.width) target.width = thumb.width;
if (target.height !== thumb.height) target.height = thumb.height;
ctx.clearRect(0, 0, target.width, target.height);
ctx.drawImage(thumb, 0, 0);
```

Resizing a canvas resets its context state but leaves the context object valid, so obtaining `ctx` before the resize is safe; the `!==` guards mean a re-blit of an already-matched canvas never resets it.

**Rejected alternative:** `ctx.drawImage(thumb, 0, 0, target.width, target.height)` would also cure the crop, but it downscales the 300x88 cache into a 150x44 bitmap and throws away the Retina resolution the DPR cache exists for. Matching the bitmap to the cache keeps full crispness.

**Layout is untouched:** each caller's CSS class still pins the display box — `.physics-paint-brush-trigger-thumb` 96x28, `.physics-paint-brush-menu-thumb` 34px tall flex row, `.watercolor-brush-thumb` 150x44 — and the JSX `width`/`height` attributes remain `STROKE_THUMB_WIDTH`/`STROKE_THUMB_HEIGHT` (150x44). Aspect ratio is unchanged (150x44 -> 300x88), so the flex-sized menu rows do not reflow.

**Four surfaces repaired by the one seam** (all render through `WatercolorBrushThumb`):
1. Top-bar brush trigger — `PhysicsPaintTopBar.tsx:116-119`
2. Top-bar dropdown brush list and lift/eraser list — `PhysicsPaintBrushMenu.tsx:140-143`, `:187-190`
3. Floating brush catalog (15 cards) — `PhysicsPaintBrushModal.tsx:254`
4. Right-panel Brush tab grid (15 cards) — `RightPanelBrushTab.tsx:45`

## Regression Pin

New describe `blitStrokeThumb is DPR-aware (261029-uoz)` with three cases:

1. **dpr 2 copies the whole cache** — stub `window.devicePixelRatio = 2`, prove the cache is 300x88, blit into a 150x44 recording canvas, assert the target resized to 300x88, one `clearRect` covering the new bitmap, and exactly one **3-argument** `drawImage(thumb, 0, 0)`.
2. **dpr 1 unchanged** — no window stub, cache stays 150x44, target stays 150x44, same single 3-argument draw.
3. **component ref path** — `WatercolorBrushThumb({ presetId: 'round' })` -> `materialize` -> vnode ref invoked with a recording target -> visible bitmap equals the 300x88 cache.

Value verified live: with the blit body temporarily reverted, cases 1 and 3 failed (`expected 150 to be 300`) and case 2 passed; restoring the fix made all three green.

## Task Commits

1. **Task 1: Make blitStrokeThumb size the target bitmap to the DPR-scaled cache** — `741936eb` (fix)
2. **Task 2: Pin the DPR-aware blit (dpr 2, dpr 1, component ref)** — `4007f144` (test)

**Plan metadata:** not committed by the executor — the orchestrator owns the docs commit for `261029-uoz-PLAN.md` and this SUMMARY.

## Files Created/Modified

- `app/src/components/physic-paint/view/watercolorStrokeThumb.ts` — only `blitStrokeThumb` changed (resize-to-cache guard, clear on the new dimensions, 1:1 copy) plus its doc comment. `prepare()`, `getStrokeThumb()`, `drawStroke()`, the cache map, the painter seam and `paperThumb.ts` are untouched.
- `app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts` — new `makeRecordingCanvas` helper, `withStubbedWindow` helper (try/finally, bracket-access assignment, `Reflect.deleteProperty` restore), and the 3-case DPR describe. No existing case weakened or deleted.

## Decisions Made

- **Resize-then-copy over scaling drawImage** — preserves Retina crispness; the plan's required shape.
- **Fix at the shared seam only** — no component, CSS or JSX attribute edits; the 150x44 contract and the paint-once-per-preset law stay intact.
- **Pin the real ref path** — the component case drives the actual `WatercolorBrushThumb` ref callback, not just the helper, so a future refactor that stops calling the blit fails loudly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Pin reads `vnode.ref`, not `props.ref`**

- **Found during:** Task 2 (first run of the component ref case)
- **Issue:** The plan said to invoke `props.ref(target)` on the materialized canvas node, but Preact's `createElement`/`jsx-runtime` extracts `ref` out of props onto the vnode itself, so `canvas.props['ref']` is `undefined` (assertion failed: "expected 'undefined' to be 'function'").
- **Fix:** Read the callback from `(canvas as { ref?: unknown }).ref` and invoke it with the recording target. Same intent, correct Preact vnode shape; a comment in the test records why.
- **Files modified:** `app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts`
- **Verification:** All 15 cases green; typecheck clean.
- **Committed in:** `4007f144` (Task 2 commit)

No other deviations — Task 1 was executed exactly as written, and the source file matches its committed state byte-for-byte after the temporary revert used to prove the pin.

## Verification

Commands run from the checkout root (never watch mode; dev server never started):

| Command | Result |
|---|---|
| `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/WatercolorBrushLibrary.test.ts` | **15 passed** (12 existing + 3 new) |
| `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PhysicsPaintBrushPicker.test.ts src/components/physic-paint/view/PhysicsPaintTopBar.test.ts` | **52 passed** (16 + 36) |
| `pnpm --filter efx-motion-editor run typecheck` | clean |
| `pnpm --filter efx-motion-editor exec vitest run` (full app gate) | **355 files passed, 2 skipped; 6368 tests passed, 1 skipped, 96 todo — zero failures** |

The 150x44 card assertions (`width === STROKE_THUMB_WIDTH`, `height === STROKE_THUMB_HEIGHT`) still pass untouched.

## Native UAT — PENDING

Automated-green is NOT UAT-green: this bug only reproduces on a Retina display (dpr > 1) in the running app, so all rows are **PENDING** until the user confirms.

- **UAT-1 (PENDING)** Top-bar brush trigger: the thumb shows the full painted stroke (no bottom-edge smear), still 96x28, label and chevron aligned as before.
- **UAT-2 (PENDING)** Top-bar brush dropdown: every row in the brush list AND every row in the lift/eraser list shows the full stroke; rows stay 34px tall with no horizontal reflow of the name column.
- **UAT-3 (PENDING)** Floating brush catalog: all 15 cards show the full stroke inside their 150x44 boxes; selection highlight still works.
- **UAT-4 (PENDING)** Right-panel Brush tab grid: same 15 cards, full strokes, boxes unchanged.
- **UAT-5 (PENDING)** Regression sweep: opening the dropdown/catalog repeatedly does not repaint thumbs (no flicker) and no console errors appear; previews look crisp (not upscaled/blurry) on the Retina display.

## Threat Surface

No new surface. The threat register entries hold: T-261029-uoz-01 (bitmap resize per thumb mount, guarded by `!==`, no per-frame work) accepted; T-261029-uoz-SC not triggered — no dependency was added or upgraded.

## Known Stubs

None — no stub, placeholder, skipped test, or unrun verify was introduced.

## Self-Check: PASSED

- FOUND: app/src/components/physic-paint/view/watercolorStrokeThumb.ts
- FOUND: app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts
- FOUND: .planning/quick/261029-uoz-big-ui-regression-all-the-brush-image-ty/261029-uoz-SUMMARY.md
- FOUND commit: 741936eb (Task 1)
- FOUND commit: 4007f144 (Task 2)
- Commits measured: 2 (`git rev-list --count 7cbc3a7e..HEAD`)
