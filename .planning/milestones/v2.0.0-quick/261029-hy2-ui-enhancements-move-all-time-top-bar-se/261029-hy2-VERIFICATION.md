---
phase: 261029-hy2
verified: 2026-10-29T13:07:32Z
status: human_needed
score: 9/10 must-haves verified
covered_files: [".planning/quick/261029-hy2-ui-enhancements-move-all-time-top-bar-se/261029-hy2-PLAN.md", ".planning/quick/261029-hy2-ui-enhancements-move-all-time-top-bar-se/261029-hy2-SUMMARY.md", "app/src/components/physic-paint/physicsPaintStudio.css", "app/src/components/physic-paint/view/PhysicsPaintBrushMenu.tsx", "app/src/components/physic-paint/view/PhysicsPaintBrushModal.tsx", "app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx", "app/src/components/physic-paint/view/PhysicsPaintSettingsModal.tsx", "app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx", "app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx", "app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx", "app/src/components/physic-paint/view/RightPanelBrushTab.tsx", "app/src/components/physic-paint/view/aquarelleRecordState.ts", "app/src/components/physic-paint/view/floatingSheetStack.ts"]
covered_digest: "v3:sha256:96337c16ec2c8ba59d4593b0b0d13a665c774490a397ab2e396847d6479f1030"
behavior_unverified: 1
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 9/10
  gaps_closed:
    - "W-01: front-only Escape went inert after the front sheet closed (a closed sheet's id stayed in the shared stack order). Closed by 690e7b14 — sheets leave the order on close and rejoin at the front on reopen."
  gaps_remaining: []
  regressions: []
behavior_unverified_items:
  - truth: "The Settings sheet is a floating sheet (top-right inset, draggable header, bottom resize, Escape to close, session-scoped layout) whose body is the eight per-brush response multipliers."
    test: "Open Settings, open Brushes, close Brushes, press Escape; then reopen Settings in the lone-sheet state and press Escape again."
    expected: "Each Escape closes the front open sheet; after the front sheet closes the remaining open sheet closes on the next Escape; a lone reopened sheet closes on Escape."
    why_human: "The Settings sheet suite mocks preact/hooks (useEffect is a no-op), so no test executes its keydown listener end-to-end. The stale-front defect is CLOSED — releaseSheet/closeSheetIfFront are behavior-tested in floatingSheetStack.test.ts and every sheet releases in its `!open` lifecycle effect — but the composed keydown → closeSheetIfFront → release transition for this sheet remains source-verified only."
human_verification:
  - test: "Brush catalog: click the top-left Close button in the floating Brushes sheet."
    expected: "The sheet closes (the header drag must not swallow the click)."
    why_human: "Vitest invokes the handlers directly; only the packaged WKWebView proves that a compatibility click follows the pointerdown stopPropagation."
  - test: "Top bar at ~1440 / ~1180 / ~861 / ~720 px: inspect the settings cluster against the right edge."
    expected: "The cluster is flush right at every width; Grain drops first, then Edges, then Water; the leading Brush size control is never clipped or unreachable at the unscrollable start edge."
    why_human: "Right-edge alignment, overflow direction and the hide-chain thresholds are layout behaviors only the packaged window proves."
  - test: "Eraser tool: inspect the left pill and open its dropdown."
    expected: "The pill shows the Eraser icon + eraser-shape thumb + shape name + chevron; the popover lists the 15 shapes with painted thumbs and no 'Open modal'; a pick changes the thumb/name, the active tool stays Eraser, and the Brush pill elsewhere is unchanged."
    why_human: "Tool-lock behavior and painted-thumb rendering are visual/interaction judgments in the live Studio."
  - test: "Switch to Water, then Pen."
    expected: "The entire settings cluster is absent from the top bar (not grayed out) and the brush pill remains and still opens the brush popover."
    why_human: "The DOM condition is pinned in unit tests, but the absence at each tool switch is a live visual check."
  - test: "Brush tab: inspect the top of the tab, then click its Settings button."
    expected: "Settings button flush at the tab top, a 15px gap, then the brush grid; no Brush size slider and no globals block; the button opens the floating Settings sheet with the eight response multipliers."
    why_human: "Spacing fidelity and the live sheet open are visual judgments."
  - test: "Settings sheet: drag its header, resize it from the bottom edge, close it, reopen it, press Escape."
    expected: "It moves, resizes, keeps its layout for the Studio session, and closes on Escape while front."
    why_human: "Pointer capture, session-scoped layout and Escape need the packaged app."
  - test: "Open all three sheets (Stroke settings, Brushes, Settings), then click each in turn; then close the front one and press Escape; then press Escape again."
    expected: "Each pressed sheet comes above the other two and every Close button still works; each Escape closes only the front open sheet, and after the front sheet closes Escape still dismisses the remaining open sheet (the 690e7b14 fix)."
    why_human: "Overlapping z-order and the Escape sequence are runtime behaviors; the stack unit tests assert the module and the inline style, not the live window."
---

# Phase 261029-hy2: UI enhancements — top bar, Settings modal, brush tab, modal stacking — Verification Report

**Phase Goal:** Nine Physics Paint Studio UI changes — right-pinned top-bar settings cluster; Settings tab retired into a floating Settings modal opened from a new brush-tab button (with a 15px gap and the cloned size/globals block removed); the Eraser control restyled as one integrated pill with its own shape dropdown; Water/Pen lose the settings cluster; the brush modal Close button fixed; click-to-front stacking for the three floating sheets.

**Verified:** 2026-10-29T13:07:32Z at `690e7b14`
**Status:** human_needed
**Re-verification:** Yes — after the W-01 stale-front follow-up fix (previous report: `human_needed`, 9/10)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Top-bar settings cluster pinned to the RIGHT edge at every width; Water/Edges/Grain container-query hide chain runs; primary box declares `container-type: inline-size` | ✓ VERIFIED | `physicsPaintStudio.css:472-481` — `justify-content: flex-end`, `flex: 1 1 auto`, `min-width: 0`, `container-type: inline-size`; Water/Edges/Grain tiers at :549-555 (≥1181) and :561-567 (≤1180). Pinned by `PhysicsPaintTopBar.test.ts` (36 tests green) |
| 2 | ONE left pill renders for Brush (Paintbrush icon + painted thumb + name + chevron) and Eraser (Eraser icon + shape thumb + shape name + chevron); clicking it opens that tool's dropdown; Water/Pen keep the brush pill | ✓ VERIFIED | `PhysicsPaintTopBar.tsx:86` exports `TopBarBrushTrigger`; mounts at :285-301 choose the lift/brush target; toggle passes the tool into the open seam. Pinned by `PhysicsPaintTopBar.test.ts` and `PhysicsPaintBrushPicker.test.ts` (16 tests green) |
| 3 | Unified pill preserves the disabled contract: `TopBarBrushTrigger` takes `disabled`; both mounts pass the bar's `disabled`; the Eraser pill is not clickable while the bar is disabled | ✓ VERIFIED | `PhysicsPaintTopBar.tsx:290,299` pass `disabled={disabled}`; the trigger binds it onto the button (:111 area). Pinned by `PhysicsPaintTopBar.test.ts` |
| 4 | Eraser pill opens an anchored popover of the 15 `BRUSH_PRESETS` with painted thumbs and NO "Open modal"; a pick writes `aquarelleLiftTipId` via `setAquarelleLiftTipId`, never flips the tool, never touches the brush selection or multipliers | ✓ VERIFIED | `PhysicsPaintBrushMenu.tsx:116-149` lift branch first (15 presets, painted thumb, no open-modal); `setAquarelleLiftTipId` in `aquarelleRecordState.ts:262-270`. Pinned by `PhysicsPaintBrushPicker.test.ts` (pick isolation + region-scoped negative pin) and `aquarelleLiftEraseContract.test.ts` (27 tests green) |
| 5 | Water/Pen: entire settings cluster absent from the DOM (not disabled); Eraser cluster = Size + Eraser strength + Edit; Brush cluster = Brush size + Pigment + Water + Edges + Grain | ✓ VERIFIED | `PhysicsPaintTopBar.tsx:270` `toolOwnsSettings`, :310-383 conditional render; Eraser branch :312-337; Brush branch :338-381. Pinned by `PhysicsPaintTopBar.test.ts` |
| 6 | Right-sidebar top-pane tabs are Color / Brush / Paper / Memory — Settings tab gone; no stored/persisted tab id can strand it | ✓ VERIFIED | `PhysicsPaintRightPanel.tsx:113-127` union/labels, :209 list; no `settings` branch or import; tab state is component-local. Pinned by `PhysicsPaintRightPanel.test.ts`, `PhysicsPaintRightSidebar.test.ts`, `physicsPaintRightPanelModuleGate.test.ts` (all green) |
| 7 | Brush tab renders a Settings button flush at its top, a 15px gap, then the brush grid — no Brush size slider and no globals panel — and the button opens the floating Settings sheet | ✓ VERIFIED | `RightPanelBrushTab.tsx:31-45` — `physics-paint-brush-tab-body` wrapper, Settings button first child, `WatercolorBrushLibrary` next; `physicsPaintStudio.css:1465-1468` `gap: 15px`; retired `.physics-paint-options-tab-panel-settings` rule absent (grep exit 1). Pinned by `panelSplitShell.test.tsx.test.ts` |
| 8 | Settings sheet is a floating sheet (top-right inset, draggable header, bottom resize, Escape to close, session-scoped layout) whose body is the eight per-brush response multipliers | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Present + wired: `PhysicsPaintSettingsModal.tsx` — 44px cascade seat, header drag with clamps, bottom resize, session-scoped layout signals, Escape capture listener with editable guard and front-only gate, body `RightPanelSettingsTab` → `BrushResponsePanel` (8 fields). The previous stale-front hole is **CLOSED** (see Resolved Warnings); structure/drag/session/z-index are render-tested (`physicsPaintSettingsModal.test.ts`, 12 tests green), but the Escape keydown transition is still source-pinned only — no test executes this sheet's listener |
| 9 | Brush catalog's top-left Close button closes the sheet: its pointerdown stops propagation so the header drag never swallows the click | ✓ VERIFIED | `PhysicsPaintBrushModal.tsx:242-246` — `onPointerDown={(event) => event.stopPropagation()}` before `onClick={close}`; header still calls `preventDefault` (:150). Handler-level behavioural pin in `PhysicsPaintBrushPicker.test.ts`; real WKWebView click remains a human UAT row |
| 10 | Clicking any of the three floating sheets raises it above the others; the three z-index values come from one shared stack module, never from three independent constants | ✓ VERIFIED | `floatingSheetStack.ts` — one signal `['stroke-settings','brushes','settings']`, `sheetZIndex` (50 + index), compare-then-write `bringSheetToFront`, `releaseSheet`, front-only `closeSheetIfFront`; all three sheets spread `zIndex: sheetZIndex(...)` after `SURFACE_STYLE` with `onPointerDownCapture`; no `zIndex: 50` constant remains. Pinned by `floatingSheetStack.test.ts` (11), `PhysicsPaintBrushPicker.test.ts`, `physicsPaintSettingsModal.test.ts` |

**Score:** 9/10 truths verified (1 present, behavior-unverified)
**Behavior-unverified:** 1 (truth 8 — mechanics present and wired; Escape transition not executed by a test)

### Deferred Items

None. The quick task is not a roadmap phase; no later milestone phase claims any part of this scope. IN-01 (extracting a shared `useFloatingSheet` hook) was deliberately deferred by the parent and is not a must-have.

### Advisory (New Scope, Unevidenced)

None. Re-verification ran; no new-scope blocker was raised. The only behavioural item is the carried-forward truth-8 evidence gap, which is routed to human verification rather than advisory.

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx` | right-pinned gated cluster + unified tool pill | ✓ VERIFIED | Exists, substantive; `TopBarBrushTrigger` exported, both mounts, tool-aware copy, `toolOwnsSettings` gate; no `LiftShapePicker` mount |
| `app/src/components/physic-paint/view/PhysicsPaintBrushMenu.tsx` | lift branch first, brush branch second | ✓ VERIFIED | Exists; two `menu-branch:` markers; lift pick writes only the lift tip; raises the brushes sheet before opening the catalog |
| `app/src/components/physic-paint/view/PhysicsPaintSettingsModal.tsx` | floating Settings sheet | ✓ VERIFIED (created) | Exists; dialog, header drag, resize, Escape guard, session layout, `RightPanelSettingsTab` body, pointerdown-guarded Close, release-on-close, raise-on-open entry point |
| `app/src/components/physic-paint/view/floatingSheetStack.ts` | shared stack module | ✓ VERIFIED (created) | Exists; ids, order signal, `sheetZIndex`, `bringSheetToFront`, `releaseSheet`, `isFrontSheet`, `closeSheetIfFront`, reset; release is compare-then-write |
| `app/src/components/physic-paint/view/RightPanelBrushTab.tsx` | Settings button + 15px gap + grid | ✓ VERIFIED | Exists; Settings button first child, then the library; raises the Settings sheet before opening; no size slider/globals |
| `app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx` | four tabs, Settings branch removed | ✓ VERIFIED | Exists; four-id union/list, no settings branch or import |
| `app/src/components/physic-paint/physicsPaintStudio.css` | right pin, Water hide tier, brush-tab gap, pill icon | ✓ VERIFIED | Exists; flex-end + container-type; Water/Edges/Grain tiers in both media blocks; `.physics-paint-brush-tab-body { gap: 15px }`; retired settings panel rule gone |
| `app/src/components/physic-paint/view/LiftShapePicker.tsx` | deleted | ✓ VERIFIED (absent) | Not on disk; no import or JSX mount in the top bar |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| Eraser pill | `setAquarelleLiftTipId` → pill thumb/name | `setAquarelleBrushMenuOpen(true, anchor, 'lift')` → target signal → lift branch | ✓ WIRED | `PhysicsPaintTopBar.tsx:253-254` → `aquarelleRecordState.ts` → `PhysicsPaintBrushMenu.tsx:116-149`; pill reads `aquarelleLiftTipId.value ?? 'filbert'` |
| Brush pill | brush pick setter → pill thumb/name | same open seam with target `'brush'` | ✓ WIRED | Brush branch `PhysicsPaintBrushMenu.tsx:150-197` calls `selectAquarelleTip` |
| `activeTool === 'brush' \|\| 'lift'` | cluster presence → container queries → Water/Edges/Grain visibility | conditional render + CSS rules | ✓ WIRED | `PhysicsPaintTopBar.tsx:270,310`; CSS tiers inside both media blocks |
| Brush-tab Settings button | `setAquarelleMultiplier` | raise + `setAquarelleSettingsModalOpen(true)` → mounted sheet → `RightPanelSettingsTab` → `BrushResponsePanel` | ✓ WIRED | `RightPanelBrushTab.tsx:38-39` → `PhysicsPaintStudioView.tsx:429` → `PhysicsPaintSettingsModal.tsx:265` → `BrushResponsePanel` |
| Sheet root `onPointerDownCapture` | each sheet's inline `zIndex` | `bringSheetToFront` → `floatingSheetOrder` → `sheetZIndex` | ✓ WIRED | All three sheets: `onPointerDownCapture` + `zIndex: sheetZIndex(...)` after `SURFACE_STYLE` |
| Sheet close (Close button or Escape) | stack order entry removed | `!open` lifecycle effect → `releaseSheet(id)`; Escape → `closeSheetIfFront(id, close)` → `releaseSheet(id)` | ✓ WIRED | `PhysicsPaintBrushModal.tsx:114-132`; `PhysicsPaintSettingsModal.tsx:114-143`; `PhysicsPaintStrokeSettingsDialog.tsx:384-392,409`; re-admission on open: `PhysicsPaintBrushMenu.tsx:161`, `RightPanelBrushTab.tsx:38`, stroke effect :391 |
| Brush modal Close `onPointerDown` | `setAquarelleBrushModalOpen(false)` | stopPropagation → header drag never captures → compatibility click → onClick | ✓ WIRED | `PhysicsPaintBrushModal.tsx:245-246`; header `preventDefault` retained (:150); handler-level test passes |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `PhysicsPaintTopBar.tsx` | `aquarelleSelectedTipId` / `aquarelleLiftTipId` / `aquarelleParams` | `aquarelleRecordState` signals + `BRUSH_PRESETS` lookup | Yes — live tool/brush state | ✓ FLOWING |
| `PhysicsPaintBrushMenu.tsx` | preset rows, `selected` | `BRUSH_PRESETS` (15) + selection signals | Yes — the real catalog | ✓ FLOWING |
| `PhysicsPaintSettingsModal.tsx` | overrides → eight rows | `RightPanelSettingsTab` → `BrushResponsePanel` reads tool overrides / selected tip; writes `setAquarelleMultiplier` | Yes — real store, real setter | ✓ FLOWING |
| `RightPanelBrushTab.tsx` | brush catalog | `WatercolorBrushLibrary` | Yes | ✓ FLOWING |
| `floatingSheetStack.ts` | `floatingSheetOrder` | module signal, read narrowly through `sheetZIndex`; mutated only from event handlers and lifecycle effects | Yes — drives each sheet's inline z-index and the front-only Escape gate | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Targeted suites for the quick task | `pnpm --filter efx-motion-editor exec vitest run` on 11 suites | 11 files / 249 tests passed | ✓ PASS |
| Release → next sheet becomes front | `floatingSheetStack.test.ts` — "releasing a closed sheet hands the front to the next open sheet" | Passed | ✓ PASS |
| Released sheet re-admits on reopen | `floatingSheetStack.test.ts` — "a released sheet rejoins at the front when it opens again" | Passed | ✓ PASS |
| `closeSheetIfFront` releases what it closed | `floatingSheetStack.test.ts` — "closeSheetIfFront releases the sheet it closed" | Passed | ✓ PASS |
| Full app suite | `pnpm --filter efx-motion-editor exec vitest run` | 354 files passed, 2 skipped; 6,327 tests passed, 1 skipped, 96 todo; zero failures | ✓ PASS |
| Typecheck | `pnpm --filter efx-motion-editor run typecheck` (`tsc --noEmit`) | Clean, no output | ✓ PASS |
| Brush preset count | `grep -c "id: '" packages/efx-watercolor/src/playground/brushes.ts` | 15 | ✓ PASS |
| Debt markers in changed files | `grep -nE "TBD|FIXME|XXX"` over the 11 implementation files | No matches | ✓ PASS |

### Probe Execution

SKIPPED — no probe is declared by the plan and this is not a migration/CLI/tooling phase.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| UI-TOPBAR | 261029-hy2-01 | Right-pinned cluster; Water/Pen cluster removal | ✓ SATISFIED | CSS `flex-end` + three-tier hide chain; `toolOwnsSettings` conditional render |
| UI-TOOL-PILL | 261029-hy2-01 | One pill (icon+thumb+name+chevron), eraser popover, disabled contract | ✓ SATISFIED | `TopBarBrushTrigger`; lift branch; `setAquarelleLiftTipId` |
| UI-SETTINGS-MODAL | 261029-hy2-01 | Settings tab retired into a floating sheet | ✓ SATISFIED | Four-tab panel; `PhysicsPaintSettingsModal` mounted once behind the picker gate |
| UI-BRUSH-TAB | 261029-hy2-01 | Slim Brush tab: button, 15px gap, catalog | ✓ SATISFIED | `RightPanelBrushTab` + `.physics-paint-brush-tab-body` |
| UI-SHEETS | 261029-hy2-01 | Shared stack + close-button fix | ✓ SATISFIED | `floatingSheetStack` (raise, release, front-only dismissal) wired into all three sheets; brush Close guard |

These five ids are quick-task-local (absent from `.planning/REQUIREMENTS.md`); no orphaned roadmap requirement maps to this quick task.

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
| --------- | ---------- | ------ | ------- | -------- | --------------- | ------- |
| `PhysicsPaintTopBar.test.ts` | UI-TOPBAR, UI-TOOL-PILL | 36 | 0 | No | Value/behavioral (CSS rules, vnode props, handler writes) | ✓ Strong |
| `PhysicsPaintBrushPicker.test.ts` | UI-TOOL-PILL, UI-SHEETS | 16 | 0 | No | Behavioral (pick isolation, close guard, raise-on-open, z-order) | ✓ Strong |
| `physicsPaintSettingsModal.test.ts` | UI-SETTINGS-MODAL | 12 | 0 | No | Behavioral + source pins (Escape only source-pinned) | ✓ Adequate — the behavioral gap is recorded as truth 8, not hidden |
| `floatingSheetStack.test.ts` | UI-SHEETS | 11 | 0 | No | Behavioral (z-order, raise, release → front handoff, re-admission, front-only close) + source scan | ✓ Strong |
| `panelSplitShell.test.tsx.test.ts` | UI-BRUSH-TAB | 12 | 0 | No | Source/CSS pins | ✓ Adequate (layout is visual) |
| `PhysicsPaintRightPanel.test.ts` + `PhysicsPaintRightSidebar.test.ts` + `physicsPaintRightPanelModuleGate.test.ts` | UI-SETTINGS-MODAL, UI-BRUSH-TAB | 57 | 0 | No | Source + render | ✓ Strong |
| `PhysicsPaintStudioView.test.ts` | UI-SETTINGS-MODAL | 4 | 0 | No | Vnode mount/step-aside | ✓ Adequate |
| `aquarelleLiftEraseContract.test.ts` | UI-TOOL-PILL | 27 | 0 | No | Source contract | ✓ Strong |
| `strokeSettingsModel.test.ts` | UI-SHEETS | 74 | 0 | No | Effect harness + real Escape dispatch (raise, release, front gate) | ✓ Strong |

**Disabled tests on requirements:** 0 (grep for `it.skip`/`describe.skip`/`todo` over the linked suites returned no matches).
**Circular patterns detected:** 0.
**Insufficient assertions:** 0 blocking. The Settings sheet's Escape path remains source-pinned because that suite intentionally mocks `preact/hooks`; this is the recorded truth-8 evidence gap.

### Decision Coverage

`gsd_run query check.decision-coverage-verify` returned: **skipped — "No trackable decisions in CONTEXT.md."** (total 0). Manual cross-check of the locked CONTEXT decisions: right pin ✓, container-query chain kept ✓, one pill for both tools ✓, eraser popover without Open modal ✓, lift-tip isolation ✓, Water/Pen keep the pill and lose the cluster ✓, Settings sheet from one entry point ✓, eight multipliers ✓, brush-tab order and 15px gap ✓, click-to-front shared stack ✓, brush Close pointerdown fix ✓.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | None | — | No debt markers (`TBD`/`FIXME`/`XXX`), no placeholder/stub text, no empty handlers, no hardcoded-empty rendering values. The `return null` hits are legitimate conditional mounts (closed sheets, non-watercolor module, filtered tabs) |

### Resolved Warnings

**W-01 (CLOSED in `690e7b14`): front-only Escape went inert after the front sheet closed.**

Previously a closed sheet kept its id in `floatingSheetOrder`; `closeSheetIfFront` would therefore treat the stale top id as front and every remaining open sheet declined Escape. The fix removes the defect at both ends:

1. **On close:** `releaseSheet(id)` (compare-then-write, `floatingSheetStack.ts:62-66`) removes the id. It is invoked by `closeSheetIfFront` (`:84-89`) and by every sheet's `!open` lifecycle effect — `PhysicsPaintBrushModal.tsx:118`, `PhysicsPaintSettingsModal.tsx:118`, `PhysicsPaintStrokeSettingsDialog.tsx:388` — so Close buttons, Escape and surface-driven dismissal all release.
2. **On reopen:** `bringSheetToFront` filters the id out and appends it (`:49-55`), and every open path calls it — brush catalog "Open modal" (`PhysicsPaintBrushMenu.tsx:161`), Settings button (`RightPanelBrushTab.tsx:38`), stroke-settings open transition (`PhysicsPaintStrokeSettingsDialog.tsx:391`).

Traced adversarial sequence: open Settings → open Brushes → close Brushes (effect releases it) → Escape now finds Settings front and closes it. Behaviorally pinned by `floatingSheetStack.test.ts` ("releasing a closed sheet hands the front to the next open sheet", "a released sheet rejoins at the front when it opens again", "closeSheetIfFront releases the sheet it closed"). No regression found: the empty-order state is safe because `sheetZIndex` falls back to the base and every open path re-admits before the sheet can consume Escape.

The remaining gap is evidence, not behavior: the Settings sheet's own keydown listener is not executed by its suite (hooks mocked), so truth 8 stays ⚠️ PRESENT_BEHAVIOR_UNVERIFIED and the live Escape row stays owed.

### Human Verification Required

**(1) Brush catalog Close button (WKWebView).**
**Test:** Click the floating Brushes sheet's top-left Close button.
**Expected:** The sheet closes; the drag header does not swallow the click.
**Why human:** Vitest invokes the handlers directly; only the packaged webview proves compatibility-click dispatch after the pointerdown guard.

**(2) Top bar at ~1440 / ~1180 / ~861 / ~720 px.**
**Test:** Inspect the settings cluster against the right edge at each width.
**Expected:** Flush right at every width; Grain drops, then Edges, then Water; Brush size (leading control) never clipped into the unreachable start edge.
**Why human:** Layout/overflow and hide-chain timing are visual.

**(3) Eraser tool pill.**
**Test:** Switch to Eraser; inspect the pill and open the dropdown; pick a shape.
**Expected:** Eraser icon + eraser thumb + shape name + chevron; 15 painted shapes with no "Open modal"; the pick changes the thumb/name, keeps Eraser active, and leaves the Brush pill unchanged.
**Why human:** Live tool-lock and painted-thumb rendering.

**(4) Water and Pen.**
**Test:** Switch to Water, then Pen.
**Expected:** No settings cluster at all; the brush pill stays and opens the brush popover.
**Why human:** Live tool-switch visual check.

**(5) Brush tab.**
**Test:** Inspect the tab top and click its Settings button.
**Expected:** Settings button flush at the top, 15px gap, brush grid; no Size slider/globals; the floating Settings sheet opens with the eight multipliers.
**Why human:** Spacing fidelity and live sheet open.

**(6) Settings sheet mechanics.**
**Test:** Drag the header, resize from the bottom, close, reopen, press Escape.
**Expected:** Moves, resizes, retains its session layout, closes on Escape while front.
**Why human:** Pointer capture and session layout need the packaged app.

**(7) Click-to-front and the post-close Escape sequence.**
**Test:** Open Stroke settings, Brushes and Settings; click each in turn; close the front one and press Escape; press Escape again.
**Expected:** Each pressed sheet rises above the others; every Close works; each Escape closes only the front open sheet, and after the front sheet closes the remaining open sheet still closes (the W-01 fix, in place at `690e7b14`).
**Why human:** Live z-order and the keydown sequence; the stack module is behavior-tested but the sheet-level Escape listener is source-pinned only.

These rows are **owed by the user and are NOT marked passed**. The phase is automated-ready only.

### Gaps Summary

No blocking gaps. All seven plan artifacts exist and are substantive; all seven key links are wired; the Water/Pen cluster removal, the unified pill, the eraser popover isolation, the four-tab sidebar, the slimmed Brush tab, the shared sheet stack with release-on-close, and the brush Close guard are each pinned by passing tests. The full suite (354 files, 6,327 tests) and typecheck are green on the current tree (`690e7b14`).

The prior W-01 stale-front defect is closed and its replacement behavior is behavior-tested at the stack layer. One evidence gap remains by construction: the Settings sheet's Escape keydown transition is source-pinned only, so truth 8 is present-but-behavior-unverified. Combined with the seven native UAT rows the plan declares, the phase cannot be reported as `passed` until the live pass closes.

---

_Verified: 2026-10-29T13:07:32Z_
_Verifier: Claude (gsd-verifier)_
