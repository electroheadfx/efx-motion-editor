# Quick Task 261029-hy2: UI enhancements (top bar, Settings modal, brush tab, sheet stacking) — Research

**Researched:** 2026-10-29
**Domain:** Preact + signals UI refactor inside Physics Paint Studio (no new packages)
**Confidence:** HIGH on code facts; MEDIUM on narrow-width layout consequences (no live run this session)

## Summary

All nine changes are reachable without new dependencies, new stores, or persistence. The blast radius is almost entirely **source-pin tests** (tests that `readFileSync` a component and assert literal strings/ordering) rather than behavioral tests: `physicsPaintRightPanelModuleGate.test.ts`, `panelSplitShell.test.tsx`, `PhysicsPaintRightSidebar.test.ts`, `PhysicsPaintTopBar.test.ts`, `PhysicsPaintRightPanel.test.ts:843`. Removing the Settings tab needs **no migration** — the active top tab is component-local `useState('color')`, never persisted.

Three real hidden couplings to plan around:

1. **Top-bar right-pinning interacts with the container-query hide chain.** `container-type: inline-size` on `.physics-paint-topbar-primary` makes its width content-independent; `flex-end` moves overflow to the *start* edge, which an LTR scroll container cannot reach. Thresholds assume the centered layout and stop at 3 visible controls (~440 px). Verify at narrow widths or the leading `Brush size` control can clip.
2. **The eraser dropdown must not reuse `selectAquarelleTip`.** That function forces `aquarelleActiveTool = 'brush'` (`aquarelleRecordState.ts:200`) and mutates the brush multiplier memory. Lift picks must go through `setAquarelleLiftTipId` (`:233-241`). For the same reason the brush menu's "Open modal" action must be hidden in eraser mode — the modal body (`WatercolorBrushLibrary`) picks brushes through `selectAquarelleTip`.
3. **`stackOrder.ts` already exists** for paint-layer ordering. Do not reuse that name for modal z-order; use a distinct module (`floatingSheetStack.ts`).

**Primary recommendation:** do it in five atomic commits — (1) top-bar right-pin + tool trigger/eraser popover + settings-cluster gating, (2) tab removal + Settings modal + Brush-tab button/gap, (3) brush-modal close fix, (4) shared sheet stack order, (5) test-pin rewrites — each with `pnpm --filter efx-motion-editor exec vitest run`, then a live UAT row for the close-button bug (vitest cannot prove a WKWebView click-suppression fix).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Top-bar alignment:** the settings cluster is pinned to the right edge at every width (never centered). The existing container-query rules that hide Water / Edges / Grain as the bar narrows stay in force.
- **Tool-settings trigger:** only Brush and Eraser own top-bar settings. When Water or Pen is the active tool, the entire settings cluster is removed from the top bar (not just disabled). The left trigger becomes ONE pill: tool icon + painted thumb + name + chevron. Brush tool: Paintbrush icon (lucide) + brush thumb + brush name. Eraser tool: Eraser icon (lucide) + eraser-shape thumb + shape name. Clicking the pill opens that tool's dropdown.
- **Eraser dropdown:** reuse the brush-menu popover pattern (same anchored popover, painted thumbs, 15 BRUSH_PRESETS shapes). No native `<select>`. Picking a shape writes `aquarelleLiftTipId` through `setAquarelleLiftTipId` (never flips the active tool, never touches the brush selection or multipliers).
- **Settings modal:** content is exactly the old Settings tab — the 8 per-brush response multipliers (Tip, Aspect, Rotation, SizeCurve, Scatter, Capacity, Grain, Wet round) via `BrushResponsePanel`. Opened from ONE entry point: a button at the top of the right-sidebar Brush tab. Follows the floating-sheet mechanics of the brush modal (anchored top-right inset, draggable header, bottom resize, Escape to close, session-scoped layout).
- **Brush tab cleanup and padding:** the Brush tab keeps the brush grid (`WatercolorBrushLibrary`) and the new Settings button only. The cloned settings block is removed: the Brush size slider and the `AquarelleGlobalsPanel`. Layout order: Settings button flush at the tab top, then a 15 px gap, then the brush grid.
- **Modal stacking:** click-to-front applies to the three floating sheets: Stroke settings, Brushes, and the new Settings modal. A shared stack-order mechanism raises the clicked sheet above the others; z-index values must stop being three independent constants.
- **Brush modal Close button:** root cause is the modal header drag handle; its `pointerdown` calls `setPointerCapture` + `preventDefault`, which suppresses the Close button's click. The stroke-settings dialog already solves this with `onPointerDown={(event) => event.stopPropagation()}` on the Close button — apply the same fix.

### Claude's Discretion

- Exact Settings modal dimensions, inset, and default height (mirror the brush modal family).
- Whether the Settings modal resets its drag/resize layout on close or keeps it for the Studio session (mirror the existing sheets).
- Implementation shape of the shared stack-order store (signal-based registry vs. explicit ordered ids).
- Test updates required by the tab removal and the trigger restyle.
- Any CSS naming for the new cluster/button (follow existing `physics-paint-*` conventions).

### Deferred Ideas (OUT OF SCOPE)

None recorded in CONTEXT.md.
</user_constraints>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Top-bar cluster alignment | CSS (`physicsPaintStudio.css`) | Component markup | Pure layout; the hide chain is already CSS container queries |
| Trigger pill / eraser dropdown | Preact leaf (`PhysicsPaintTopBar.tsx` + `PhysicsPaintBrushMenu.tsx`) | Signal store (`aquarelleRecordState.ts`) | Signal reads stay in leaves (memo bypass), writes in event handlers |
| Settings tab → modal | Preact composition (`PhysicsPaintRightPanel.tsx`, new modal, `PhysicsPaintStudioView.tsx`) | Existing `BrushResponsePanel` | Content unchanged; only the host changes |
| Sheet stacking | Signal store (new module) + inline style | Sheet components | One ordered signal replaces three hardcoded 50s |
| Close-button fix | Component event handler | — | DOM event ordering, not state |

## Standard Stack

No new packages. Everything needed is already in the tree:

| Library | Already used | Purpose here |
|---------|--------------|--------------|
| `@preact/signals` | yes | sheet stack order signal, settings-modal open signal |
| `lucide-preact` | yes (`Eraser` at `PhysicsPaintTopBar.tsx:4`, `Paintbrush` in `PhysicsPaintBrushModal.tsx:18` / `PhysicsPaintToolRail.tsx`) | trigger icons |
| `@efxlab/efx-watercolor` | yes | `BRUSH_PRESETS` (15 shapes) for both dropdowns |
| vitest | yes | `app/vitest.config.ts` includes **only** `src/**/*.test.ts` |

**Package Legitimacy Audit:** not applicable — no installs.

## Findings

### 1. Top-bar structure and CSS

Facts (verified in source):

- Markup: `PhysicsPaintTopBar.tsx:246-349` — `header.physics-paint-topbar` → `.physics-paint-topbar-left` (status pill + trigger + Script switch, lines 248-269) and `.physics-paint-topbar-primary` (lines 276-347).
  - Left slot: Eraser branch mounts `<LiftShapePicker testId="physics-lift-shape">` (`:257-267`); every other tool (including **Water and Pen**) falls into `<TopBarBrushTrigger>` — that fallthrough is the bug behind change #7.
  - Primary cluster: Eraser branch = Size + Strength + `LiftEditSwitch` (`:277-302`); everything else = Brush size + Pigment + Water + Edges + Grain (`:303-346`), again including Water/Pen.
- CSS base (`physicsPaintStudio.css`):
  - `.physics-paint-topbar` `:441-453` — flex, `gap: 14px`, `padding: 7px 12px`, `overflow-x: auto`.
  - `.physics-paint-topbar-left` `:459-469` — `flex: 0 0 auto; gap: 0`.
  - `.physics-paint-topbar-primary` `:471-481` — `flex: 1 1 auto; justify-content: center; container-type: inline-size`.
  - Container queries `:542-558` — Grain hides at 739 px (wide) / 606 px (≤1180), Edges at 589 / 483; descendant selectors so they out-rank `.physics-paint-topbar-control { display: flex }` (comment at `:536-541`).
  - Narrow block `:7203-7213` — topbar gap 8, primary gap `6px 8px`, slider `min-width: 115px`.
- Comments that pin centered behavior and must be rewritten: `PhysicsPaintTopBar.tsx:38-50` (gqo move 5 / gh9g "center = sliders only"), CSS `:455-458` ("the cluster centers in the space AFTER the left cluster").

Minimal change:

```css
/* physicsPaintStudio.css:471-481 */
.physics-paint-topbar-primary {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: flex-end;   /* was center */
  flex: 1 1 auto;
  gap: 8px 10px;
  min-width: 0;
  container-type: inline-size; /* KEEP — the hide chain measures this box */
}
```

- Do **not** remove `container-type` or `flex: 1 1 auto`; the @container rules measure the primary's inline size, which stays "remaining width after the left cluster". Right-alignment does not change that math.
- Do **not** add a `@media` block before line 542: `PhysicsPaintTopBar.test.ts:107` computes the "base CSS" as `styles.slice(0, styles.indexOf('@media'))`.
- Water/Pen: render **no** `.physics-paint-topbar-primary` element (not an empty one) — CONTEXT says "removed", and an empty `flex: 1 1 auto` div would still consume space. Decide the trigger too: the same "no brush chrome" law (`PhysicsPaintTopBar.tsx:255-256`) argues the pill also disappears for Water/Pen; CONTEXT explicitly mandates only the settings cluster removal, so treat the trigger as an open question (below) unless the screen mock shows otherwise.
- Risk to verify live at ~1180 / 861 / 720 px: with `justify-content: flex-end`, overflow of the control row exits the **start** (left) edge, which an LTR scroller cannot scroll back to. Today's centered layout overflowed symmetrically. Thresholds stop at 3 visible controls (~440 px) and never hide Water ("Water and the primary Pigment control stay", `:536-541`). If the leading `Brush size` clips, extend the chain with a Water-hide rule rather than changing thresholds blindly.

### 2. Settings tab removal — blast radius

- Tab list, labels union, state union and branch all live in `PhysicsPaintRightPanel.tsx`:
  - `TOP_PANE_TAB_LABELS` `:114-125` typed `Record<'color' | 'brush' | 'settings' | 'paper' | 'memory', string>` — the Record key union must drop `'settings'` or TS reports an excess property.
  - `topPaneTabs` `:209-211`; `useState<…>` `:213-215`; `effectiveTopPaneTab` annotation `:215`.
  - Settings branch `:326-329` (imports `RightPanelSettingsTab` at `:16`).
- **`RightPanelSettingsTab` is referenced nowhere else.** `grep RightPanelSettingsTab app/src` → only `PhysicsPaintRightPanel.tsx:16,328` and the two source-scan tests (`panelSplitShell.test.tsx:305`, `physicsPaintRightPanelModuleGate.test.ts:37`). Recommended: **keep the file** and mount it inside the new Settings modal (project precedent: `BrushesDocker.tsx` was retained on disk after retirement — `panelSplitShell.test.tsx:301-302`). That keeps `physicsPaintRightPanelModuleGate.test.ts:118-123` valid.
- **Persistence/coercion: none.** `topPaneTab` is a component-local `useState('color')` (`:213-215`); no localStorage/sessionStorage in the panel or tab components (grep clean). Deleting a union member cannot strand a stored `'settings'` value. No migration task.
- Unused CSS after removal: `.physics-paint-options-tab-panel-settings { padding-top: 10px }` (`physicsPaintStudio.css:1446-1448`) is pinned by `panelSplitShell.test.tsx:200-209`. Delete the rule and repoint/delete that test.
- The map-driven tab row means source counts don't change: `PhysicsPaintRightSidebar.test.ts` asserts `role="tab"` occurrences = 8 (source literal count) — unaffected. Only its union/label string pins at `:54` and `:92` change.

### 3. Brush tab restructure

- `RightPanelBrushTab.tsx:25-53` renders, in order: `WatercolorBrushLibrary`, a `physics-paint-option-group` wrapping the `brush-tab-brush-size` `SliderStepper` (`:33-46`), then `<AquarelleGlobalsPanel />` (`:48`). Remove `:33-48`; add the Settings button as the FIRST child.
- The panel's wrapper class `.physics-paint-options-tab-panel-brush` exists only in markup (`PhysicsPaintRightPanel.tsx:323`) — **no CSS rule matches it today** (grep of the stylesheet). The 15 px gap therefore needs a new rule. Recommended shape (keeps the button flush, the panel is already `-flat` = 0 top padding via `:1441-1444`):

```tsx
// RightPanelBrushTab.tsx (inside the watercolor branch)
<div data-testid="right-panel-brush-tab" data-module="watercolor">
  <div class="physics-paint-brush-tab-body">
    <button type="button" class="physics-paint-text-button physics-paint-brush-tab-settings"
            data-testid="brush-tab-open-settings"
            onClick={() => setAquarelleSettingsModalOpen(true)}>
      <SlidersHorizontal size={13} aria-hidden="true" /> Settings
    </button>
    <WatercolorBrushLibrary />
  </div>
</div>
```

```css
.physics-paint-brush-tab-body { display: flex; flex-direction: column; gap: 15px; min-width: 0; }
```

`.physics-paint-text-button` already exists (`physicsPaintStudio.css:566-579`) — reuse it, no new chrome.
- `AquarelleGlobalsPanel` is **not** deleted: it stays mounted by `WatercolorModuleSection` (`panelSplitShell.test.tsx:179`, `physicsPaintRightPanelModuleGate.test.ts:145-151`). Only its Brush-tab mount is removed, so `AquarelleGlobalsPanel.test.ts` / `AquarelleParamsPanel.test.tsx` remain valid.
- Tests that pin the old contents: `physicsPaintRightPanelModuleGate.test.ts:103-104` (library + globals behind the gate) and `panelSplitShell.test.tsx:288-300` (library + globals, no `BrushResponsePanel`, no `LiftShapePicker`). No test pins the `brush-tab-brush-size` id (grep clean) — the size-slider removal is unguarded.

### 4. Trigger pill + eraser dropdown

Current mechanics (all verified):

- Trigger: `TopBarBrushTrigger` (`PhysicsPaintTopBar.tsx:78-107`) — button `.physics-paint-brush-trigger`, carries `data-watercolor-brush-trigger` (`:90`), thumb + name + `ChevronDown`.
- Open/close: `toggleBrushMenu` `:225-232` calls `setAquarelleBrushMenuOpen(true, { left: rect.left, top: rect.bottom + 6 })`.
- Outside-dismiss: `PhysicsPaintBrushMenu.tsx:57-78` — window `pointerdown` capture, ignores clicks inside the menu and clicks on `[data-watercolor-brush-trigger]` (`:63`), so the trigger's own click never races the close. Escape is a window `keydown` capture with `preventDefault + stopPropagation` (`:66-71`).
- Menu content: `Open modal` first (`:105-116`) then 15 rows, each `selectAquarelleTip(preset.id)` + close (`:120-143`). Fixed positioning (topbar is an `overflow-x` scroller), width clamp `viewportWidth - 308`, measured definite height (`:45-55`, `:82-94`).
- Setup writes: `setAquarelleBrushMenuOpen` compare-then-writes anchor and open state (`aquarelleRecordState.ts:127-136`).
- Lift writes: `setAquarelleLiftTipId` compare-then-writes, never flips tool (`aquarelleRecordState.ts:233-241`). `selectAquarelleTip` **does** flip the tool (`:200`) — forbidden in the eraser popover.

Recommended parameterization (minimal duplication, signal-safe):

1. Extend the open-state seam with a target captured at open time, e.g. a new `aquarelleBrushMenuTarget = signal<'brush' | 'lift'>('brush')` plus `setAquarelleBrushMenuOpen(open, anchor?, target?)` updated to compare-then-write the target. Capturing at open avoids content flicker if the tool changes underneath.
2. One component, two modes: `PhysicsPaintBrushMenu` reads the target; brush mode = today's list + "Open modal"; lift mode = the same 15 rows with `selected = aquarelleLiftTipId.value ?? 'filbert'`, `onClick = setAquarelleLiftTipId(preset.id)` + close, **no "Open modal" and no separator**.
3. One trigger: rename/generalize `TopBarBrushTrigger` to accept `tool: 'brush' | 'lift'`; render `Paintbrush` (brush) or `Eraser` (lift, already imported) before the thumb, keep `data-watercolor-brush-trigger` so the outside-dismiss guard keeps working. Eraser thumb reuses `.physics-paint-brush-trigger-thumb` (`LiftShapePicker.tsx:38-42` already does), name from `BRUSH_PRESETS` (fallback 'Filbert').
4. Delete `LiftShapePicker.tsx` (single mount is the top bar) or leave it on disk untouched if deletion churn is unwanted; either way the top-bar mount must go.

Constraints:
- No `useState` in the top bar — `PhysicsPaintTopBar.test.ts:476-482` pin `not.toContain('useState')`.
- No render-body writes; target/anchor writes happen in the click handler only (`efx-preact-reactivity` rules 3, 6).
- Keep `aria-haspopup="menu"`, `aria-expanded`, and a tool-aware `aria-label` (`PhysicsPaintTopBar.tsx:92-94`).

### 5. Modal Close bug + stacking

Close bug — confirmed at source:

- `PhysicsPaintBrushModal.tsx:196-203` — the header owns `onPointerDown={onHeaderPointerDown}`; that handler (`:117-130`) calls `event.currentTarget.setPointerCapture(...)` (`:128`) then `event.preventDefault()` (`:129`).
- The Close button (`:211-220`) has **only** `onClick`; no pointerdown guard — its press bubbles into the header, `preventDefault` suppresses the compatibility click (WKWebView), so it never closes.
- Reference fix already exists: `PhysicsPaintStrokeSettingsDialog.tsx:605-618`, guard at `:614` with the explanatory comment at `:611-613`. Copy it:

```tsx
// PhysicsPaintBrushModal.tsx close button, before onClick
onPointerDown={(event) => event.stopPropagation()}
```

- Test gap: `PhysicsPaintBrushPicker.test.ts:211-216` invokes `onClick` directly and passes today. The new pin must call the button's `onPointerDown` and assert the header drag did not start / the close still fires — mirror `strokeSettingsModel.test.ts:1611-1614`.

Stacking:

- Hardcoded constants: `PhysicsPaintBrushModal.tsx:62` (`zIndex: 50`), `PhysicsPaintStrokeSettingsDialog.tsx:159` (`zIndex: 50`). Brush menu is CSS `z-index: 80` (`physicsPaintStudio.css:888`); other app dialogs use 70/72 — the sheet family at 50-52 stays clear of both.
- Naming trap: `stackOrder.ts` is the paint-layer ordering law (`stackOrder.ts:1-15`). New module name must differ — `floatingSheetStack.ts`.
- Smallest mechanism that satisfies the project rules:

```ts
// floatingSheetStack.ts
import { signal } from '@preact/signals';
export type FloatingSheetId = 'stroke-settings' | 'brushes' | 'settings';
const BASE = 50;
// bottom -> top
const order = signal<readonly FloatingSheetId[]>(['stroke-settings', 'brushes', 'settings']);
export function sheetZIndex(id: FloatingSheetId): number {
  const index = order.value.indexOf(id);
  return BASE + (index < 0 ? 0 : index);
}
export function bringSheetToFront(id: FloatingSheetId): void {
  const current = order.value;
  if (current[current.length - 1] === id) return;   // compare-then-write: no bump, no render
  order.value = [...current.filter((entry) => entry !== id), id];
}
```

- Each sheet: narrow read `const z = sheetZIndex('brushes')` in the render body, spread **after** `SURFACE_STYLE` so it overrides nothing else; root gets `onPointerDownCapture={() => bringSheetToFront('brushes')}` — capture is required because the Close button stops pointerdown propagation (`:614`) and must not defeat raise-on-click. Handler write only (rule 6); no `stopPropagation` on the sheet root.
- Tradeoff to note: all three sheets read the same `order` signal, so one raise re-renders the three sheet trees. They are small and their bodies read their own stores; acceptable, but do not extend this pattern to per-frame state.
- Session reset: `resetBrushModalLayout()` (`PhysicsPaintBrushModal.tsx:43-46`) and `resetStrokeSettingsDialogLayout()` (`PhysicsPaintStrokeSettingsDialog.tsx:95-98`) only reset drag/resize — stacking can keep its last order for the session (CONTEXT discretion), no reset needed.
- New Settings modal: mirror the brush modal (module-scope drag/resize signals, `SURFACE_INSET_PX = 12`, top/right inset, `width` ~360-372 px, `height: min(560px, calc(100% - 24px))`, Escape capture listener, bottom resize handle, `role="dialog"`, `data-testid="physics-settings-modal"`). Body = `<RightPanelSettingsTab />` (or `BrushResponsePanel` directly if the wrapper is dropped). Mount in `PhysicsPaintStudioView.tsx` inside the canvas region next to the brush modal (`:419-424`) behind the same `!pickerOpen` step-aside, and add open state to `aquarelleRecordState.ts` beside `aquarelleBrushModalOpen` (`:112-114`) with a compare-then-write setter.

### 6. Tests and gates

Runner: `pnpm --filter efx-motion-editor exec vitest run` (never watch — CLAUDE.md). New tests must be `*.test.ts`; `app/vitest.config.ts` includes only `src/**/*.test.ts` (a lone `.test.tsx` runs nothing — launcher idiom `.test.tsx.test.ts`).

| Test file | Assertion to change | Triggered by |
|---|---|---|
| `view/PhysicsPaintTopBar.test.ts:105-117` | "centers the tool cluster" — `justify-content: center`, `not.toContain('margin-left: auto')` | right-pin |
| `view/PhysicsPaintTopBar.test.ts:119-137` | hide-chain thresholds + ordering vs `.physics-paint-topbar-control` | keep green (do not move rules) |
| `view/PhysicsPaintTopBar.test.ts:143-170`, `:190-206` | trigger found by `props.onToggle`, left-slot order, `presetId` | trigger generalization |
| `view/PhysicsPaintTopBar.test.ts:208-220` | trigger CSS `margin-left: 15px`, thumb 96×28, `gap: 0`, `overflow-x: auto` | keep unless pill restyle changes metrics |
| `view/PhysicsPaintTopBar.test.ts:503-521` | Eraser branch swaps cluster; no Brush size/Pigment | Water/Pen gating adds a third arm |
| `view/PhysicsPaintTopBar.test.ts:610-638` | `LiftShapePicker` mount, `flexDirection: 'row'`, `maxWidth: '120px'` | eraser pill replaces native select |
| `view/physicsPaintRightPanelModuleGate.test.ts:198-219` | exact array literal, `useState<…>` union string, `settings: 'Settings'` | tab removal |
| `view/physicsPaintRightPanelModuleGate.test.ts:103-104` | Brush tab mounts `AquarelleGlobalsPanel` behind gate | globals clone removal |
| `view/physicsPaintRightPanelModuleGate.test.ts:118-123` | Settings tab mounts `BrushResponsePanel` | stays green if `RightPanelSettingsTab` is kept |
| `view/panelSplitShell.test.tsx:200-209` | `.physics-paint-options-tab-panel-settings { padding-top: 10px }` | CSS rule deletion |
| `view/panelSplitShell.test.tsx:278-340` | brush-tab contents; settings branch mounts `RightPanelSettingsTab` + panel class | tab removal + brush tab restructure |
| `view/PhysicsPaintRightSidebar.test.ts:54`, `:92` | union/label literal strings | tab removal |
| `view/PhysicsPaintRightPanel.test.ts:843` | `['Color','Brush','Settings','Paper','Memory']` → `['Color','Brush','Paper','Memory']` | tab removal |
| `view/PhysicsPaintBrushPicker.test.ts:211-216` | click-only close test (passes today) — add pointerdown guard pin | close fix |
| `view/PhysicsPaintBrushPicker.test.ts:167-183` | modal background/close/resize presence (keep) | new inline zIndex spread must not displace `background` |
| `view/strokeSettingsModel.test.ts:1611-1614` | stopPropagation idiom to copy | reference only |
| `view/PhysicsPaintStudioView.test.ts:118-155` | enumerates hidden parent modals under `pickerOpen` | add the Settings modal to the step-aside (optional pin) |

New tests to add: `view/floatingSheetStack.test.ts` (raise order, already-front no-op = same array reference, invalid id), `view/physicsPaintSettingsModal.test.ts` (mounts `BrushResponsePanel`/`RightPanelSettingsTab`, Escape closes, close button pointerdown stopPropagation, z-index comes from the shared stack), and a source pin that the eraser menu path never contains `selectAquarelleTip` (mirror `PhysicsPaintTopBar.test.ts:624-634`).

Gates: `pnpm --filter efx-motion-editor exec vitest run` before each commit; live UAT for (a) close button actually closing, (b) trigger pill at 1180/861/720 px, (c) click-to-front ordering, (d) Water/Pen with no cluster.

## Common Pitfalls

1. **Reusing `selectAquarelleTip` in the eraser dropdown** — silently flips the tool to Brush and persists brush multipliers. Always `setAquarelleLiftTipId`.
2. **Offering "Open modal" in eraser mode** — the catalog's card click runs `selectAquarelleTip`, same trap.
3. **Removing `container-type: inline-size` while right-pinning** — destroys the hide chain silently (all tests pass, knobs overflow live).
4. **Adding a `@media` block above line 542** — `PhysicsPaintTopBar.test.ts:107` slices "base CSS" at the first `@media`; new base rules must stay above it.
5. **Deleting `RightPanelSettingsTab.tsx` outright** — three source-scan tests read it by path at import time (`moduleGate.test.ts:36-39`, `panelSplitShell.test.tsx:304-307`); mount it in the modal instead.
6. **Header pointerdown guard on the Close button** — the fix is `stopPropagation` on the *button's* pointerdown, not removing `preventDefault` from the header (that would break drag capture).
7. **Render-body sheet raise** — never call `bringSheetToFront` during render; only pointerdown capture.
8. **Naming the stack module `stackOrder`** — collides with the paint-order law.
9. **Trusting vitest for the close fix** — the harness calls handlers directly; WKWebView click suppression is only provable live.

## Code Examples

Right-pin (see Finding 1). Close guard (see Finding 5). Stack module (see Finding 5). Settings-modal open state:

```ts
// aquarelleRecordState.ts — beside aquarelleBrushModalOpen (:112-114)
export const aquarelleSettingsModalOpen = signal(false);
export function setAquarelleSettingsModalOpen(open: boolean): void {
  if (aquarelleSettingsModalOpen.value === open) return;
  aquarelleSettingsModalOpen.value = open;
}
```

## Runtime State Inventory

Not a rename/refactor phase. No stored keys, service config, OS state, secrets, or build artifacts carry the removed `'settings'` tab id (tab state is component-local `useState`, never persisted).

## Environment Availability

None — code/CSS-only changes, no external tools beyond the existing pnpm/vitest setup.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (workspace) |
| Config file | `app/vitest.config.ts` — `include: ['src/**/*.test.ts', '../packages/efx-paint-host/src/**/*.test.ts']` |
| Quick run command | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view` |
| Full suite command | `pnpm --filter efx-motion-editor exec vitest run` |

### Phase Requirements → Test Map
| Behavior | Test type | Automated command | File exists? |
|---|---|---|---|
| Cluster pinned right, hide chain intact | unit (CSS source pin) | `vitest run src/components/physic-paint/view/PhysicsPaintTopBar.test.ts` | ✅ rewrite |
| No Settings tab | unit (render + source pin) | `…PhysicsPaintRightPanel.test.ts …physicsPaintRightPanelModuleGate.test.ts` | ✅ rewrite |
| Brush tab = button + 15 px gap + grid | unit (source pin) | `…panelSplitShell.test.tsx.test.ts` | ✅ rewrite |
| Eraser pill opens shape menu, writes lift tip only | unit (render + source pin) | `…PhysicsPaintTopBar.test.ts` (+ new menu test) | ❌ Wave 0 |
| Close button survives header pointerdown | unit (handler) **+ live UAT** | `…PhysicsPaintBrushPicker.test.ts` | ❌ Wave 0 assertion |
| Click-to-front ordering | unit | new `floatingSheetStack.test.ts` | ❌ Wave 0 |
| Settings modal mounts response multipliers, Escape, close | unit | new `physicsPaintSettingsModal.test.ts` | ❌ Wave 0 |

### Sampling Rate
- Per commit: targeted `vitest run` on the view directory.
- Per wave/merge: full suite.
- Phase gate: full suite green + live UAT rows listed in Finding 6.

### Wave 0 Gaps
- [ ] `view/floatingSheetStack.test.ts`
- [ ] `view/physicsPaintSettingsModal.test.ts`
- [ ] close-button pointerdown assertion in `PhysicsPaintBrushPicker.test.ts`
- [ ] eraser menu target test (brush vs lift selection seam)

## Security Domain

No authentication, session, access-control, crypto, or new input surfaces (all controls are existing local UI). ASVS V2-V6: not applicable. V5: no user-supplied data is parsed; dropdown values are validated by `findTip` / `BRUSH_PRESETS` inside the existing setters (`aquarelleRecordState.ts:192-241`), which normalize unknown ids to `null` — continue routing picks through those setters rather than writing signals directly.

## Open Questions

1. **Does the pill disappear for Water/Pen, or only the settings cluster?**
   - What we know: CONTEXT mandates the cluster removal; the pill represents a shape selection that Water/Pen don't have, and the codebase's own comment says the eraser "never shows brush chrome".
   - Recommendation: hide the pill for Water/Pen as well; confirm against the supplied screenshot during UAT.

2. **Does the eraser dropdown need the "Open modal" action?**
   - What we know: CONTEXT lists only the 15 shapes; the modal's picks flip the tool to Brush.
   - Recommendation: omit it in lift mode.

3. **Right-pin overflow at narrow widths** — verify live; add a Water-hide container rule only if the leading Brush size control clips.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Water/Pen should also lose the trigger pill | Finding 1 / Open Q1 | Extra UI change beyond CONTEXT wording; user may want the pill retained |
| A2 | The eraser menu omits "Open modal" | Finding 4 / Open Q2 | Users lose a direct path to the full catalog from the eraser |
| A3 | Keeping `RightPanelSettingsTab.tsx` (mounted in the modal) is preferred over deleting it | Findings 2/3 | More test churn and a dead-looking file if the planner chooses deletion |
| A4 | Settings modal dimensions mirror the brush modal (~372 px wide) | Finding 5 | Cosmetic only |

## Sources

### Primary (HIGH)
- `app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx`, `RightPanelBrushTab.tsx`, `RightPanelSettingsTab.tsx`, `PhysicsPaintRightPanel.tsx`, `PhysicsPaintBrushMenu.tsx`, `LiftShapePicker.tsx`, `PhysicsPaintBrushModal.tsx`, `PhysicsPaintStrokeSettingsDialog.tsx`, `aquarelleRecordState.ts`, `PhysicsPaintStudioView.tsx`, `PhysicsPaintToolRail.tsx`, `WatercolorBrushLibrary.tsx`, `stackOrder.ts`
- `app/src/components/physic-paint/physicsPaintStudio.css:441-558, 758-900, 997-1002, 1074-1083, 1427-1449, 7203-7221`
- Test files listed in Finding 6; `app/vitest.config.ts`
- `.claude/skills/efx-preact-reactivity` (rules 3, 5, 6 consulted for the stack design)

### Secondary (MEDIUM)
- `packages/efx-watercolor/src/payload/toStudioStroke.ts:42` — `AquarelleTool = 'brush' | 'water' | 'pen' | 'lift'`

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — nothing added.
- Architecture: HIGH — all seams read at source; one design choice (stack signal shape) is a recommendation.
- Pitfalls: HIGH on test pins; MEDIUM on narrow-width clipping (not run live).

**Research date:** 2026-10-29
**Valid until:** 2026-11-28 (fast-moving view directory — re-verify line numbers before editing)
