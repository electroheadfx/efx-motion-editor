---
phase: quick/261116-gcn
plan: 01
subsystem: ui
tags: [preact, signals, floating-sheet, watercolor, textures, top-bar, slider-stepper]

# Dependency graph
requires:
  - phase: quick/261027-gh9
    provides: watercolor-only brush pill, top-bar brush Size and the aquarelle texture strip
  - phase: 261029-hy2
    provides: shared floating-sheet stack with front-only Escape dismissal
provides:
  - A second top-bar Textures trigger inside the brush pill opening a viewport-fixed popover
  - The compact texture strip relocated from the brush dropdown into that popover
  - A floating, draggable, height-resizable Textures sheet carrying the full strip plus the shared brush Size
  - A fifth floating-sheet seat (SHEET_ID_TEXTURES) appended last at z 54 / top 76px
affects: [physic-paint-studio, floating-sheet-stack, aquarelle-controls]

actuals:
  tokens: 21346
  tasks: 4
  commits: 4

plan_head_before: 7ace2dbfd5fe5815a5e99ee3f48d64b41a55c586
plan_head_after: a8c6ac7ef75ebabd477837a75beafdb600265e0e

tech-stack:
  added: []
  patterns:
    - Viewport-fixed popover anchors derived from the trigger rect (top bar clips absolute children)
    - Appended-last floating-sheet seat so shipped absolute z-index/top pins stay untouched
    - Shared brush Size reused for a second surface via commitAquarelleSelectionParam('size', value)

key-files:
  created:
    - app/src/components/physic-paint/view/PhysicsPaintTextureMenu.tsx
    - app/src/components/physic-paint/view/PhysicsPaintTextureMenu.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintTextureModal.tsx
    - app/src/components/physic-paint/view/PhysicsPaintTextureModal.test.ts
  modified:
    - app/src/components/physic-paint/view/aquarelleRecordState.ts
    - app/src/components/physic-paint/view/floatingSheetStack.ts
    - app/src/components/physic-paint/view/floatingSheetStack.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintRailMotionModal.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx
    - app/src/components/physic-paint/view/PhysicsPaintTopBar.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintBrushMenu.tsx
    - app/src/components/physic-paint/view/PhysicsPaintBrushPicker.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx
    - app/src/components/physic-paint/view/PhysicsPaintStudioView.test.ts
    - app/src/components/physic-paint/physicsPaintStudio.css

key-decisions:
  - "Textures seats LAST in the shared stack (z 54 / top 76px) so the four shipped absolute pins (50/51/52/53, 12/28/44/60) are untouched."
  - "Both Textures surfaces are viewport-fixed: the top bar is an overflow-x scroller, so absolute children would be clipped."
  - "The sheet's Size row is the SHARED brush Size: onChange streams through the top-bar handler, onCommit writes one commitAquarelleSelectionParam('size', value) patch per release."
  - "The two popovers (brush catalog / textures) are mutually exclusive; opening one closes the other."
  - "A picker-open gate steps both new surfaces aside with every other parent modal."

patterns-established:
  - "Trigger-rect anchoring: TopBarTextureTrigger reports its rect, a narrow signal carries the anchor, the popover positions itself fixed."
  - "Fifth-sheet seating: append the id to INITIAL_ORDER, reuse closeSheetIfFront/releaseSheet/bringSheetToFront verbatim."

requirements-completed: []

coverage:
  - id: D1
    description: "Second top-bar trigger labelled Textures inside the brush pill, after the tool trigger and before the Script switch; opens a viewport-fixed popover whose first action is Open modal, followed by the compact texture strip."
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintTopBar.test.ts#quick 261116-gcn Textures trigger"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintTextureMenu.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "The brush dropdown no longer shows any texture strip: Open modal, separator, preset scroller; the lifted branch is unchanged."
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintBrushPicker.test.ts#never mounts a texture strip and never reads the catalog generation"
        status: pass
    human_judgment: false
  - id: D3
    description: "Opening one popover closes the other in both directions, and both new surfaces stand down while a project file picker is open."
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintTopBar.test.ts#opening one popover closes the other in both directions"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintStudioView.test.ts#picker-open visibility gate"
        status: pass
    human_judgment: false
  - id: D4
    description: "Open modal raises and opens a floating Textures sheet that is draggable, height-resizable, closes via its X; only the front sheet consumes Escape and a close releases its seat."
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintTextureModal.test.ts"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/floatingSheetStack.test.ts#all five sheet handlers gate on the front sheet and stop their siblings"
        status: pass
    human_judgment: false
  - id: D5
    description: "The sheet's Size control reads aquarelleParams.size, streams onChange live, and commits exactly one size patch per release on the selected paint strokes."
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintTextureModal.test.ts#commits exactly one size patch per release to the selected paint strokes"
        status: pass
    human_judgment: false
  - id: D6
    description: "The four shipped sheet seats keep their exact z-index and top inset; Textures seats last at 54 / 76px."
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/floatingSheetStack.test.ts"
        status: pass
    human_judgment: false
  - id: D7
    description: "Visual and ergonomic quality of the Textures popover and floating sheet in the live Studio (cascade position, blur, drag/resize feel)."
    verification: []
    human_judgment: true
    rationale: "Layout fidelity and drag/resize ergonomics are visual judgments that a vnode/source harness cannot prove; they need live Studio UAT."

duration: 27min
completed: 2026-11-16
status: complete
---

# Quick 261116-gcn: Studio Textures axis Summary

**A second Textures trigger joined the Studio brush pill, opening a viewport-fixed popover (Open modal first, then the relocated compact texture strip) plus a fifth floating sheet carrying the full strip and the shared brush Size.**

## Performance

- **Duration:** 27 min
- **Started:** 2026-11-16T11:12:00Z
- **Completed:** 2026-11-16T11:39:00Z
- **Tasks:** 4
- **Files modified:** 15 (4 created, 11 modified)

## Accomplishments

- New `aquarelleTextureMenuOpen` / `aquarelleTextureMenuAnchor` / `aquarelleTextureModalOpen` signals with compare-then-write setters; `SHEET_ID_TEXTURES` appended as the LAST initial seat (z 54, top 76px) leaving the four shipped pins untouched.
- `TopBarTextureTrigger` seated inside the brush pill between the tool trigger and the Script switch, with its own viewport-fixed popover: Open modal, separator, compact strip. The strip no longer renders anywhere in the brush dropdown.
- `PhysicsPaintTextureModal` — draggable header, height-resize handle, front-only Escape via `closeSheetIfFront`, seat released on close, full `WatercolorTextureStrip` plus a `TextureSizeControl` slotted above it.
- The shared brush Size (min 1 / max 80) reads `aquarelleParams.value.size`, streams `onChange` through the top-bar handler, and commits exactly one `commitAquarelleSelectionParam('size', value)` patch per release — one undo entry, never a texture scale.
- Both new surfaces ride the existing picker-open step-aside gate.

## Task Commits

Each task was committed atomically:

1. **Task 1: Textures UI state and the last sheet seat** — `6328f0f4b` (feat)
2. **Task 2: Textures trigger + popover, and the strip leaves the brush dropdown** — `7e8bbd087` (feat)
3. **Task 3: Retire the brush-dropdown texture pins and the dead compact-strip CSS** — `d31588258` (refactor)
4. **Task 4: Floating Textures sheet with the shared brush Size** — `a8c6ac7ef` (feat)

**Plan metadata:** skipped — the orchestrator commits the docs artifacts (PLAN.md / SUMMARY.md / STATE.md).

## Files Created/Modified

- `app/src/components/physic-paint/view/PhysicsPaintTextureMenu.tsx` — the Textures popover: Open modal, separator, compact strip; viewport-fixed at the trigger rect.
- `app/src/components/physic-paint/view/PhysicsPaintTextureMenu.test.ts` — mount/hand-off/label/source pins.
- `app/src/components/physic-paint/view/PhysicsPaintTextureModal.tsx` — the fifth floating sheet + exported `TextureSizeControl`.
- `app/src/components/physic-paint/view/PhysicsPaintTextureModal.test.ts` — seat, z-order, shared-Size commit, drag/close and source laws.
- `app/src/components/physic-paint/view/aquarelleRecordState.ts` — menu/modal signals and setters.
- `app/src/components/physic-paint/view/floatingSheetStack.ts` — appended `SHEET_ID_TEXTURES` seat.
- `app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx` — `TopBarTextureTrigger` + second pill seat.
- `app/src/components/physic-paint/view/PhysicsPaintBrushMenu.tsx` — strip removed from the dropdown.
- `app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx` — mounts the popover and sheet behind the picker gate.
- `app/src/components/physic-paint/physicsPaintStudio.css` — trigger/menu/strip/modal/size rules; dead compact-override CSS deleted.
- Tests updated: `PhysicsPaintTopBar.test.ts`, `PhysicsPaintBrushPicker.test.ts` (absence pin), `PhysicsPaintStudioView.test.ts` (both surfaces in the step-aside gate), `floatingSheetStack.test.ts` (five handlers), `PhysicsPaintRailMotionModal.test.ts`.

## Decisions Made

- Textures seats LAST (54 / 76px) rather than inserting mid-stack: keeps every shipped absolute pin byte-identical; relative assertions now read against Textures.
- Both Textures surfaces are viewport-fixed because the top bar's `overflow-x` scroller clips absolute children.
- The sheet's Size row is the shared brush Size, not a per-texture pattern scale: `onChange` forwards the live handler, `onCommit` writes one `size` patch per release.
- The brush and textures popovers are mutually exclusive, mirroring the anchor signal ownership.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] CSS base-chip lookup matched the scoped override**
- **Found during:** Task 2 (Textures trigger + popover)
- **Issue:** `PhysicsPaintTextureMenu.test.ts` sliced the `.watercolor-texture-chip-canvas` rule with `indexOf`, which matched the substring inside the earlier scoped `.physics-paint-brush-menu-textures …` override (34px) and asserted `width: 44px` against the wrong block.
- **Fix:** Resolve the base rule with `lastIndexOf` and slice its own block before asserting.
- **Files modified:** `app/src/components/physic-paint/view/PhysicsPaintTextureMenu.test.ts`
- **Verification:** Task 2 verify green (`vitest run PhysicsPaintTextureMenu.test.ts`).
- **Committed in:** `7e8bbd087` (part of Task 2 commit)

**2. [Rule 1 - Bug] aria-label asserted on the component vnode instead of its button**
- **Found during:** Task 2 (Textures trigger + popover)
- **Issue:** The new top-bar case read `aria-label` off the `TopBarTextureTrigger` mount vnode, whose props are open/onToggle/disabled — the label lives on the button the component returns.
- **Fix:** Invoke `TopBarTextureTrigger({...})` directly and assert `aria-label`, `aria-expanded` and `data-watercolor-texture-trigger` on the returned button.
- **Files modified:** `app/src/components/physic-paint/view/PhysicsPaintTopBar.test.ts`
- **Verification:** Task 2 verify green (`vitest run PhysicsPaintTopBar.test.ts`).
- **Committed in:** `7e8bbd087` (part of Task 2 commit)

**3. [Rule 3 - Blocking] Stale partial `vi.doMock` in the 261018-f15 case**
- **Found during:** Task 2 (Textures trigger + popover)
- **Issue:** The pre-existing partial mock of `aquarelleRecordState` lacked the new `aquarelleTextureMenuOpen` export read by the top bar, failing the suite with `No "aquarelleTextureMenuOpen" export is defined`.
- **Fix:** Added `aquarelleTextureMenuOpen: { value: false }` and `setAquarelleTextureMenuOpen: vi.fn()` to the mock return.
- **Files modified:** `app/src/components/physic-paint/view/PhysicsPaintTopBar.test.ts`
- **Verification:** Full `PhysicsPaintTopBar.test.ts` green.
- **Committed in:** `7e8bbd087` (part of Task 2 commit)

---

**Total deviations:** 3 auto-fixed (2 test bugs, 1 blocking stale mock)
**Impact on plan:** All three were test-side corrections with no product behavior change. No scope creep; D-1/D-2/D-3 untouched.

## Issues Encountered

- The planned red `PhysicsPaintBrushPicker.test.ts` between Tasks 1–3 was expected and repaired in Task 3 by the plan's absence pin; no early fix was attempted.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan-level verification green: `pnpm --filter efx-motion-editor run typecheck` plus ten named suites → 10 files / 169 tests passed.
- Pending live UAT: the visual cascade position, blur, and drag/resize feel of the Textures popover and sheet in the Studio (coverage D7).

---
*Phase: quick/261116-gcn*
*Completed: 2026-11-16*

## Self-Check: PASSED

- All four created files exist on disk (TextureMenu .tsx/.test.ts, TextureModal .tsx/.test.ts).
- All four task commits are ancestors of HEAD: `6328f0f4b`, `7e8bbd087`, `d31588258`, `a8c6ac7ef`.
