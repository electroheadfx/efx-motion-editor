---
phase: quick-261004-hwa
plan: 261004-hwa
type: tdd
wave: 1
depends_on: []
files_modified:
  - app/src/stores/paintStore.ts
  - app/src/stores/paintStore.fgBg.test.ts
  - app/src/components/sidebar/ForegroundBackgroundSwatch.tsx
  - app/src/components/layout/LeftPanel.tsx
  - app/src/components/layout/CanvasArea.tsx
  - app/src/lib/shortcuts.ts
autonomous: true
requirements: [QUICK-261004-HWA]

estimate:
  tokens: 45000
  raw_tokens: 22500
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "Opening a paint session shows a Photoshop-style two-square swatch at the bottom of the left sidebar: front (foreground) black, back (background) white."
    - "Picking a color in the existing sidebar InlineColorPicker writes it to the swatch currently stacked on top (the foreground)."
    - "Pressing X while in paint edit mode swaps foreground and background; the sidebar picker and the active paint color update to the new foreground."
    - "Clicking the back (background) swatch brings it to the front; it becomes the active target for the picker and the active paint color."
    - "No new color picker is added — the existing sidebar InlineColorPicker remains the only picker touched by this quick; no new persistence is introduced (swatch state resets to black/white each session)."
  artifacts:
    - app/src/stores/paintStore.ts
    - app/src/components/sidebar/ForegroundBackgroundSwatch.tsx
    - app/src/components/layout/LeftPanel.tsx
    - app/src/lib/shortcuts.ts
  key_links:
    - "paintStore brushColor ← swap/promote actions (picker + hex labels + FX refresh all read brushColor, so one write syncs the whole sidebar)"
    - "InlineColorPicker onChange in CanvasArea → writes foreground swatch signal alongside setBrushColor"
    - "tinykeys 'x' binding gated by shouldSuppressShortcut + isFullscreen + isPaintEditMode"
---

<objective>
Add a Photoshop-style foreground/background color swatch (two overlapping squares) at the bottom of the left vertical tool sidebar. The foreground starts black, the background white. The existing sidebar InlineColorPicker writes to whichever swatch is stacked on top (the foreground); pressing X swaps the two; clicking the back swatch promotes it to the front. The promoted/swapped foreground becomes the active paint color and the sidebar picker's target.

Purpose: gives paint users the industry-standard two-slot color model (swap colors with one key, keep a secondary color ready) without introducing a second picker or any new persistence.
Output: fg/bg signals + swap/promote actions in paintStore, a ForegroundBackgroundSwatch component rendered at the bottom of LeftPanel, sync wiring in CanvasArea's InlineColorPicker onChange, and an X tinykeys binding.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.claude/skills/efx-preact-reactivity/SKILL.md

Key files (read before implementing):
- app/src/stores/paintStore.ts — brushColor signal (line 19), setBrushColor (line 539, writes signal + saveBrushColor persistence + FX refresh), reset() (line 445), showInlineColorPicker (line 38). NOTE: existing paintBgColor signal (line 30) is the layer paint background — NOT the swatch background; do not reuse it.
- app/src/lib/shortcuts.ts — tinykeys map (line 260), isPaintEditMode() (line 34), shouldSuppressShortcut (line 43). Existing paint-gated pattern: 'p' binding (line 459). No bare 'x' binding exists in the main window — X is free (only Cmd+X in physicsPaintStudioKeyboard.ts, a separate Studio window scope).
- app/src/components/layout/LeftPanel.tsx — left vertical sidebar; PROPERTIES CollapsibleSection renders PaintProperties (line 303) when paint layer selected + paint mode. Swatch goes at the bottom of this panel (footer after PROPERTIES), visible while a paint layer is selected in paint mode.
- app/src/components/layout/CanvasArea.tsx — InlineColorPicker rendered at lines 370-405; its onChange calls paintStore.setBrushColor(color) plus live-update of selected strokes. This onChange is the sidebar-picker sync point.
- app/src/components/sidebar/PaintProperties.tsx — color rows (~401-415, ~803-838) open the inline picker via toggleInlineColorPicker and display brushColor.
- app/src/stores/paintStore.test.ts — test harness pattern (mocks ./projectStore and ../lib/brushP5Adapter, beforeEach reset).
- app/vitest.config.ts — include glob is src/**/*.test.ts only; new tests MUST be .test.ts (never .test.tsx).

Constraints honored: Preact + @preact/signals only (no useState — see efx-preact-reactivity skill); vitest run only (never watch); no dev server; no Chrome DevTools MCP (native visual UAT stays with the user); no new persistence for swatch state; no new color picker; PATH FORM (repo-root-relative paths in this plan body).
</context>

<tasks>

<task type="tdd">
  <name>Task 1: paintStore foreground/background swatch state + swap/promote actions</name>
  <files>app/src/stores/paintStore.ts, app/src/stores/paintStore.fgBg.test.ts</files>
  <action>
RED first: create app/src/stores/paintStore.fgBg.test.ts following the harness pattern of app/src/stores/paintStore.test.ts (mock ./projectStore and ../lib/brushP5Adapter, beforeEach(() => paintStore.reset())). Write failing tests asserting: (1) initial foreground signal is '#000000' and background is '#ffffff' after reset; (2) swapFgBg() exchanges the two signals AND sets brushColor to the new foreground (so the picker/hex labels/FX refresh follow automatically); (3) setActiveFromBackground() (back-swatch click) promotes background to front — the old foreground becomes background — and sets brushColor to the new foreground; (4) setForeground(color) updates only the foreground signal without touching brushColor persistence helpers (no new persistence: assert saveBrushColor is NOT called from setForeground/swapFgBg/promote — only the existing setBrushColor path may persist); (5) calling paintStore.reset() returns both swatch signals to the defaults (session-only state). Run the tests and confirm they FAIL for the right reason (signals/actions do not exist yet). Commit: test(quick-261004-hwa): failing tests for fg/bg swatch state.

GREEN: in app/src/stores/paintStore.ts add two signals — foregroundColor = signal('#000000') and backgroundColorSwatch = signal('#ffffff') (name it distinctly from the existing paintBgColor to avoid collision) — plus three exported actions: setForeground(color), swapFgBg(), setActiveFromBackground(). Both swapFgBg and setActiveFromBackground must assign brushColor.value directly and bump paintVersion / invalidate the frame FX cache the same way setBrushColor does for fx-paint layers (mirror lines 539-541), but must NOT call saveBrushColor — swatch state is session-only with no new persistence. Wire reset() to restore both signals to defaults. Run tests until green. Commit: feat(quick-261004-hwa): fg/bg swatch state in paintStore.

Do NOT touch paintBgColor (existing layer background) or paintPreferences persistence.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/stores/paintStore.fgBg.test.ts</automated>
  </verify>
  <done>fg/bg signals exist with black/white defaults, swap and promote actions update brushColor (picker sync path) without persisting, reset restores defaults, all fgBg tests pass.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: ForegroundBackgroundSwatch component + sidebar placement + picker sync</name>
  <files>app/src/components/sidebar/ForegroundBackgroundSwatch.tsx, app/src/components/layout/LeftPanel.tsx, app/src/components/layout/CanvasArea.tsx</files>
  <behavior>
    - Component renders exactly two overlapping squares in Photoshop layout: background square offset behind, foreground square offset front-bottom-right (or PS's classic front top-left / back bottom-right arrangement — match PS: back square sits behind, offset down-right; front square on top, offset up-left). Front square filled with paintStore.foregroundColor, back square filled with paintStore.backgroundColorSwatch, both with a 1px border for visibility on any theme.
    - Clicking the front square opens the existing sidebar picker (paintStore.toggleInlineColorPicker()) — no new picker.
    - Clicking the back square calls paintStore.setActiveFromBackground() (promote) and also opens/toggles the inline picker so the just-promoted color is immediately editable.
    - Hover shows title tooltips "Foreground color" / "Background color".
    - InlineColorPicker onChange in CanvasArea additionally calls paintStore.setForeground(color) when paintStore.activeTool is not relevant — any sidebar picker color pick writes the top (foreground) swatch. Live stroke update behavior already present must be preserved.
    - Swatch renders only when the left sidebar is in paint context (same condition that shows PaintProperties: paint layer selected + paint mode), as a footer at the bottom of the left sidebar.
  </behavior>
  <action>
RED: extend app/src/stores/paintStore.fgBg.test.ts (or a colocated .test.ts — remember vitest only collects *.test.ts) with behavior-adjacent store assertions already covered in Task 1; for the component, the behavioral contract above is verified live by the user's native UAT (Preact component DOM tests are out of scope here — no .test.tsx collection exists). Instead, add one store-level test that setForeground does not clobber background (picker pick → top swatch only).

Create app/src/components/sidebar/ForegroundBackgroundSwatch.tsx per the behavior block, using signals directly in render (paintStore.foregroundColor.value etc.) — no useState, no useEffect for selection/state application (per efx-preact-reactivity skill and project memory: apply state in the click handler). Import icons/styling consistent with the sidebar (follow PaintProperties row styling: rounded borders, var(--color-*) tokens).

Mount it in app/src/components/layout/LeftPanel.tsx as a footer below the PROPERTIES section, rendered under the same paint-context condition that gates PaintProperties (paint layer selected && paintMode). Keep it at the visual bottom of the vertical sidebar.

Wire the picker sync in app/src/components/layout/CanvasArea.tsx InlineColorPicker onChange: alongside the existing paintStore.setBrushColor(color) call, add paintStore.setForeground(color) so every sidebar pick lands on the stacked-on-top swatch. Do not remove the live-update of selected strokes. Per D-guardrail: do NOT add a picker anywhere; do not modify PaintToolbar's ColorPickerModal (out of scope — sidebar picker only).

Commit: feat(quick-261004-hwa): fg/bg swatch UI in left sidebar + picker sync.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/stores/paintStore.fgBg.test.ts && pnpm --filter efx-motion-editor exec tsc --noEmit</automated>
  </verify>
  <done>Two-square swatch renders at the bottom of the left sidebar in paint context; sidebar picker picks write the foreground swatch; clicking back promotes it and updates the picker/active color; no new picker exists; typecheck passes.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: X key swap shortcut, paint-edit-gated</name>
  <files>app/src/lib/shortcuts.ts, app/src/stores/paintStore.fgBg.test.ts</files>
  <behavior>
    - Pressing X (bare, no modifiers) while in paint edit mode calls paintStore.swapFgBg(): foreground and background swap, brushColor becomes the new foreground, sidebar picker target follows.
    - Outside paint edit mode, X does nothing (isPaintEditMode() gate returns early).
    - When focus is in INPUT/TEXTAREA/SELECT/contentEditable, X is suppressed (shouldSuppressShortcut).
    - In fullscreen, X is ignored (isFullscreen gate), matching every other binding in the map.
    - No other keybinding behavior changes.
  </behavior>
  <action>
RED: add a test in app/src/stores/paintStore.fgBg.test.ts asserting swapFgBg swaps and re-points brushColor (already covered by Task 1 — extend if any gap: rapid double-swap returns to original colors and original brushColor).

Add the tinykeys binding in app/src/lib/shortcuts.ts mountShortcuts map, following the 'p' pen-tool pattern exactly: key 'x', first shouldSuppressShortcut(e), then isFullscreen.peek() early return, then if (!isPaintEditMode()) return, then paintStore.swapFgBg(). Gate on isPaintEditMode() per project memory (global shortcuts.ts must check isPaintEditMode) — this is why bare 'x' is safe: it is currently unbound in the main window (verified: only Cmd+X exists, in the separate Physics Paint Studio window scope which has its own keydown handler). Do not bind 'X' with Shift or any modifier variant — Photoshop uses bare X.

Commit: feat(quick-261004-hwa): X swaps foreground/background in paint mode.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/stores/paintStore.fgBg.test.ts && pnpm --filter efx-motion-editor exec tsc --noEmit</automated>
  </verify>
  <done>X swaps fg/bg in paint edit mode only; typing X in inputs still inserts text; no binding regressions elsewhere (typecheck + full quick tests pass).</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| keyboard input → global shortcut map | Untrusted keystrokes reach tinykeys handlers on window; must not fire in text fields or fullscreen |
| user color input → paintStore state | Hex/color strings flow from picker into signals rendered as CSS colors |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation |
|-----------|----------|-----------|----------|-------------|------------|
| T-261004-hwa-01 | Tampering | app/src/lib/shortcuts.ts 'x' binding | low | mitigate | Triple gate: shouldSuppressShortcut → isFullscreen → isPaintEditMode; bare X does nothing outside paint mode, so no cross-context action injection |
| T-261004-hwa-02 | Information Disclosure | swatch state persistence | low | accept | No persistence added by design — session-only signals; nothing sensitive stored or written to disk |
| T-261004-hwa-03 | Denial of Service | swap action FX-cache refresh | low | accept | swapFgBg mirrors the existing setBrushColor refresh path (already proven); single user gesture, no loops |
| T-261004-hwa-SC | Tampering | npm installs | high | mitigate | No new package installs in this plan — zero install surface |
</threat_model>

<verification>
- pnpm --filter efx-motion-editor exec vitest run src/stores/paintStore.fgBg.test.ts (all fg/bg tests pass)
- pnpm --filter efx-motion-editor exec tsc --noEmit (clean)
- grep gate: no bare 'x' duplicate binding introduced; only one 'x': entry in shortcuts.ts
- Native visual UAT by user (no Chrome DevTools MCP): swatch placement, PS layout, X swap, back-click promote, picker sync
</verification>

<success_criteria>
- Swatch visible at the bottom of the left sidebar with front black / back white on a fresh paint session
- Sidebar picker pick updates front swatch; X swaps and updates picker + active color; back click promotes
- No new picker, no new persistence, no changes outside files_modified
- vitest run + tsc --noEmit green
</success_criteria>

<output>
Create .planning/quick/261004-hwa-quick-7-photoshop-foreground-background-/261004-hwa-SUMMARY.md when done
</output>
