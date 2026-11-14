---
phase: quick-261018-0ox
plan: 261018-0ox
subsystem: ui
tags: [preact, physic-paint, watercolor, grain-default, module-gate, right-panel, component-split, source-scan]

requires:
  - phase: 56
    provides: I-01..I-07 homes (AquarelleGlobalsPanel, BrushResponsePanel, WatercolorBrushLibrary, PaperPicker single home), PaperPicker Soft segment 0.35, activeModule watercolor branch
provides:
  - Studio grain default is Soft (0.35) — factory + both Paper-tab fallbacks agree
  - I-08 source-scan pin for Brush-mode context gating (watercolor-only mounts stay watercolor-only)
  - I-10 adoption: PhysicsPaintRightPanel mounts RightPanelColorTab / ActionsTab / BrushTab / PaperTab / TrackTab / OnionTab / MotionTab
affects: [phase-55-issues Row 11 I-08 I-10, physic-paint right panel, paper grain fallback, module-gate pins]

actuals:
  tokens: 17408
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Per-component hook frames in the panel/palette test harness — extracted tabs keep useState slots across hand-invocations without colliding with the panel's cursor"
    - "Source-scan pin follows component homes (I-10): Brush-tab arm scans RightPanelBrushTab, Paper single-home scans RightPanelPaperTab"

key-files:
  created:
    - app/src/components/physic-paint/view/physicsPaintRightPanelModuleGate.test.ts
  modified:
    - app/src/components/physic-paint/engine/physicsPaintStudioSettings.ts
    - app/src/components/physic-paint/engine/physicsPaintStudioSettings.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx
    - app/src/components/physic-paint/view/RightPanelColorTab.tsx
    - app/src/components/physic-paint/view/RightPanelActionsTab.tsx
    - app/src/components/physic-paint/view/RightPanelBrushTab.tsx
    - app/src/components/physic-paint/view/RightPanelPaperTab.tsx
    - app/src/components/physic-paint/view/RightPanelOnionMotionTabs.tsx
    - app/src/components/physic-paint/view/physicsPaintRightPanelModuleGate.test.ts
    - app/src/components/physic-paint/view/physicsPaintRightPanelPaperSingleHome.test.ts
    - app/src/components/physic-paint/view/panelSplitShell.test.tsx
    - app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintPalette.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintRightSidebar.test.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts

key-decisions:
  - "Row 11 factory default is 0.35 (PaperPicker Soft); explicit 0.45 fixture inputs left unchanged — they pin round-trip fidelity, not the default"
  - "Actions Undo/Redo stay count-free (260815-bmg) — the orphan's undoCount/redoCount gate was dropped; disable rides `disabled` only"
  - "RightPanelBrushTab watercolor arm retargeted from BrushesDocker to WatercolorBrushLibrary + BrushResponsePanel (I-03 live arm) before adoption"
  - "Motion orphan aligned to SliderStepper (same ids/labels/range as live PanelSlider) so Track + Onion + Motion could all be adopted markup-identical"
  - "Color orphan restructured to sibling hue/input/swatch rows (live markup) instead of nesting them inside physics-paint-color-picker"

patterns-established:
  - "I-10 adoption contract: retarget an orphan to live markup/behavior BEFORE mounting it; fence any block that cannot move without prop drilling"
  - "Mount pins travel with the component home in the same commit (PaperSingleHome, panelSplitShell, ModuleGate)"

requirements-completed: [Row 11, I-08, I-10]

coverage:
  - id: Row 11
    description: "Fresh Studio settings bag and both Paper-tab grainStrength fallbacks use Soft (0.35)"
    requirement: Row 11
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/engine/physicsPaintStudioSettings.test.ts#keeps the established painting defaults"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/engine/physicsPaintStudioSettings.test.ts#the paper fallback write-through carries the grain scale and round-trips 2"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/engine/physicsPaintStudioSettings.test.ts#49-03 T1: each selector mode maps to exactly one document fallback record (write-through)"
        status: pass
    human_judgment: true
    rationale: "Grain look on the live Paper tab must be judged in the Studio"
  - id: I-08
    description: "Watercolor-only surfaces stay behind activeModule === 'watercolor'; Paper tab stays shared; tab row stays Color | Actions | Brush | Paper"
    requirement: I-08
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintRightPanelModuleGate.test.ts#watercolor-only mounts in the Brush tab sit behind the watercolor branch"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintRightPanelModuleGate.test.ts#PhysicsPaintToolRail returns WatercolorRail only from its watercolor branch"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintRightPanelModuleGate.test.ts#Paper tab branch mounts the paper surface with no activeModule gate"
        status: pass
    human_judgment: true
    rationale: "Brush vs Water color live rendering must be confirmed in the Studio"
  - id: I-10
    description: "PhysicsPaintRightPanel mounts the six RightPanel*Tab components (Color / Actions / Brush / Paper / Track / Onion / Motion) instead of inlining those bodies"
    requirement: I-10
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/panelSplitShell.test.tsx#mounts WatercolorBrushLibrary then BrushResponsePanel (I-03 mount swap)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintRightPanelPaperSingleHome.test.ts#mounts PaperPicker exactly once in RightPanelPaperTab.tsx (I-10 adoption)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts#hosts the track options behind the Track tab"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintPalette.test.ts#native-approved Physics Paint palette behavior"
        status: pass
    human_judgment: true
    rationale: "Tab layout, color picker interaction, and Actions disable feel must be judged live"

plan_head_before: 0d19cfb98b13bcb861837c4165fe801f6874b501
plan_head_after: 1b6146bee6c96d30a99ed8aef905aaa24c32cde0

duration: 22min
completed: 2026-10-17
status: complete
---

# Quick 261018-0ox: Row 11 + I-08 + I-10 Summary

**Studio grain default lands on Soft (0.35), Brush-mode watercolor gating is pinned, and the six RightPanel*Tab orphans are adopted into PhysicsPaintRightPanel**

## Performance

- **Duration:** 22 min
- **Started:** 2026-10-17T22:40:24Z
- **Completed:** 2026-10-17T23:02:08Z
- **Tasks:** 3
- **Files modified:** 15

## Accomplishments

- Row 11: `makeInitialPhysicsPaintStudioSettings().grainStrength` is 0.35 (PaperPicker Soft); both `grainStrength ??` fallbacks agree
- I-08: `physicsPaintRightPanelModuleGate.test.ts` source-scan pin proves watercolor-only mounts stay behind `activeModule.value === 'watercolor'`, WatercolorRail is watercolor-only, and the Paper tab stays ungated
- I-10: `PhysicsPaintRightPanel.tsx` is no longer the home of every tab body — Color / Actions / Brush / Paper / Track / Onion / Motion each render through their `RightPanel*Tab` component
- Actions Undo/Redo remain COUNT-FREE (260815-bmg); Brush-tab watercolor arm is `WatercolorBrushLibrary` then `BrushResponsePanel` (I-03)

## Task Commits

Each task was committed atomically:

1. **Task 1: Row 11 — studio grain default is Soft (0.35)** - `91957e31` (fix)
2. **Task 2: I-08 — source-scan pin for Brush-mode context gating** - `a2a13c7f` (test)
3. **Task 3: I-10 — adopt the RightPanel*Tab orphans** - `1b6146be` (refactor)

## Files Created/Modified

- `app/src/components/physic-paint/engine/physicsPaintStudioSettings.ts` - factory grainStrength 0.35
- `app/src/components/physic-paint/engine/physicsPaintStudioSettings.test.ts` - default-asserting cases retargeted to 0.35
- `app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx` - mounts the seven RightPanel*Tab components
- `app/src/components/physic-paint/view/RightPanelColorTab.tsx` - live sibling markup (hue/input/swatch rows)
- `app/src/components/physic-paint/view/RightPanelActionsTab.tsx` - count-free Undo/Redo disable
- `app/src/components/physic-paint/view/RightPanelBrushTab.tsx` - WatercolorBrushLibrary + BrushResponsePanel arm
- `app/src/components/physic-paint/view/RightPanelOnionMotionTabs.tsx` - Motion on SliderStepper (physics-play-deform / physics-play-move)
- `app/src/components/physic-paint/view/physicsPaintRightPanelModuleGate.test.ts` - I-08 pin (new)
- `app/src/components/physic-paint/view/physicsPaintRightPanelPaperSingleHome.test.ts` - PaperPicker single home follows RightPanelPaperTab
- `app/src/components/physic-paint/view/panelSplitShell.test.tsx` - Brush-tab arm follows RightPanelBrushTab
- `app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts` - per-component hook frames + textContent expansion
- `app/src/components/physic-paint/view/PhysicsPaintPalette.test.ts` - same harness follow-through
- `app/src/components/physic-paint/view/PhysicsPaintRightSidebar.test.ts` - lucide import pin follows the new homes
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` - Track-options pin follows RightPanelTrackTab

## Live UAT Checklist

The user will run these one by one in the Studio.

### Row 11 — grain default

1. Open a fresh Studio (new document) → Paper tab → Grain strength segment reads **Soft** (not between Soft and Med).
2. Move Grain strength to Hard, reopen the project → the value persists (round-trip unchanged).
3. Create another fresh Studio → Grain strength is Soft again (factory default, not the last used value).

### I-08 — module gating

4. Module switcher = **Brush** → Brush tab shows the physics param bag (Shape detail / Blending / Spread); no 14-card watercolor grid, no Brush response block.
5. Module switcher = **Water color** → Brush tab shows the 14-card playground grid then Brush response; left rail shows Brush | Water | Pen | Lift | Dry.
6. In **both** modes → Paper tab still shows Grain pair + Transparent/White + the paper grid (shared document fond).
7. Top pane tab row still reads **Color | Actions | Brush | Paper** (no extra tab).

### I-10 — adopted tabs (behavior unchanged)

8. Color tab → HSV box, hue strip, hex input, swatch grid all respond; + adds a favorite; X removes one.
9. Actions tab → Undo / Redo / Clear frame sit enabled whenever the engine is enabled (never greyed out from a count).
10. Brush tab (Brush mode) → Shape detail / Blending / Spread / Erase / Brush smoothing sliders work as before.
11. Track tab → Opacity commits on release; Blend select lists the five modes.
12. Bottom pane → Onion (Previous/Next/frames/value) and Motion (Deform / Move) sliders respond; Motion is the same SliderStepper look as Track Opacity.

## Decisions Made

- Row 11 factory default moves to Soft (0.35); explicit `grainStrength: 0.45` fixture inputs stay — they pin round-trip fidelity, not the default (plan directive).
- Actions Undo/Redo stay COUNT-FREE (260815-bmg): the orphan's `undoCount === 0` / `redoCount === 0` gates were dropped; `disabled` is the only disable source (T-261018-0OX-01).
- All six orphans adopted (Color / Actions / Brush / Paper / Track / Onion / Motion) — Track and Onion already matched live markup; Motion was aligned to `SliderStepper` first so no block hit the leave-inline fence.
- Color orphan restructured so hue / input / swatch rows are siblings of the color box (live markup) rather than nested inside `physics-paint-color-picker`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Panel/palette test harness could not expand extracted tab components safely**
- **Found during:** Task 3 (I-10 adoption)
- **Issue:** `childrenOf` hand-invoked function components through a shared `HookRuntime` cursor. Once color/track/onion hooks moved into `RightPanel*Tab`, expansions collided with the panel's slots (`favoriteColors.map is not a function`) and `textContent` never reached labels inside function components (`expected … to contain 'Paint 1'`).
- **Fix:** Per-component persistent hook frames (Preact-like per-instance slots) + `textContent` expands function components + `renderPanel` expands the tree so `RightPanelColorTab` load effects run before `settleLoads`.
- **Files modified:** `app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts`, `app/src/components/physic-paint/view/PhysicsPaintPalette.test.ts`
- **Verification:** `PhysicsPaintRightPanel.test.ts` 25/25, `PhysicsPaintPalette.test.ts` 4/4
- **Committed in:** `1b6146be` (Task 3 commit)

**2. [Rule 1 - Bug] Three further source pins still pointed at the pre-I-10 homes**
- **Found during:** Task 3 (broader `src/components/physic-paint` run)
- **Issue:** `PhysicsPaintStudio.test.ts` expected `aria-label="Track options"` in the panel source; `PhysicsPaintRightSidebar.test.ts` expected `import { GripHorizontal, X }` in the panel; `panelSplitShell.test.tsx` expected `physics-track-opacity` / `physics-onion-opacity` in the panel source. All three moved with the adoption.
- **Fix:** Pins retargeted to `RightPanelTrackTab.tsx` / `RightPanelColorTab.tsx` / `RightPanelOnionMotionTabs.tsx` in the same commit.
- **Files modified:** `PhysicsPaintStudio.test.ts`, `PhysicsPaintRightSidebar.test.ts`, `panelSplitShell.test.tsx`
- **Verification:** full `src/components/physic-paint` suite 3079/3079
- **Committed in:** `1b6146be` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (2 Rule 1)
**Impact on plan:** Both were adoption fallout on the test harness / source pins — no product behavior change. No scope creep.

## Issues Encountered

- The plan's verify paths `PaperPicker.test.tsx.test.ts` / `panelSplitShell.test.tsx.test.ts` are the project's `.test.tsx` launchers (vitest collects only `*.test.ts`); used as written and they ran the real suites.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register. T-261018-0OX-01 (Actions count-based disable) is mitigated — Undo/Redo disable only via `disabled`. T-261018-0OX-02 (stale BrushesDocker arm) is mitigated — Brush tab mounts `WatercolorBrushLibrary` then `BrushResponsePanel`. T-261018-0OX-03 (grain default / fallback disagreement) is mitigated — factory and both fallbacks move together in Task 1. T-261018-0OX-04 (watercolor leak) is mitigated by the I-08 pin.

## Next Phase Readiness

- I-01..I-07 contracts untouched (AquarelleGlobalsPanel home, BrushResponsePanel home, 14-card library arm, PaperPicker single home, Paint = settings only, top-bar Background gone).
- No package.json / lockfile diff; no SPECS/ diff; no phase-55 index rows ticked.
- Three local commits, one per task.

---
*Phase: quick-261018-0ox*
*Completed: 2026-10-17*

## Self-Check: PASSED

- FOUND: `app/src/components/physic-paint/view/physicsPaintRightPanelModuleGate.test.ts`
- FOUND: `app/src/components/physic-paint/engine/physicsPaintStudioSettings.ts`
- FOUND: `app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx`
- FOUND: `app/src/components/physic-paint/view/RightPanelActionsTab.tsx`
- FOUND: `.planning/quick/261018-0ox-i-08-i-10-row-11-context-gating-orphan-t/261018-0ox-SUMMARY.md`
- FOUND: `91957e31`, `a2a13c7f`, `1b6146be` (all ancestors of HEAD)
- OK: no SPECS / package.json / lockfile / phase-55 index diff
