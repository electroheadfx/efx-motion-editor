---
phase: quick-4
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - Application/src/stores/canvasStore.ts
  - Application/src/components/layout/CanvasArea.tsx
  - Application/src/lib/shortcuts.ts
  - Application/src/components/overlay/ShortcutsOverlay.tsx
autonomous: true
requirements: [QUICK-4]

must_haves:
  truths:
    - "Canvas auto-resizes to fit when fitLocked is on and user resizes the window or goes fullscreen"
    - "Manual zoom/pan actions automatically disengage fit lock"
    - "Fit button visually indicates locked/unlocked state"
    - "F key and Cmd+0 engage fit lock (not just one-shot fit)"
  artifacts:
    - path: "Application/src/stores/canvasStore.ts"
      provides: "fitLocked signal, toggleFitLock method, auto-unlock on manual zoom/pan"
      contains: "fitLocked"
    - path: "Application/src/components/layout/CanvasArea.ts"
      provides: "ResizeObserver calls fitToWindow when fitLocked is true"
  key_links:
    - from: "Application/src/components/layout/CanvasArea.tsx"
      to: "canvasStore.fitLocked"
      via: "ResizeObserver callback checks fitLocked before calling fitToWindow"
      pattern: "fitLocked.*fitToWindow"
    - from: "Application/src/stores/canvasStore.ts"
      to: "canvasStore.fitLocked"
      via: "zoomIn/zoomOut/setSmoothZoom/setPan set fitLocked to false"
      pattern: "fitLocked.value = false"
---

<objective>
Add a fit-lock toggle so the canvas automatically re-fits to the container whenever the window is resized or the app goes fullscreen. When locked, the canvas stays responsive. Manual zoom/pan actions disengage the lock.

Purpose: Users working in "Fit" mode want the canvas to stay fitted as they resize the window, toggle fullscreen, etc., without needing to press F each time.
Output: Updated canvasStore with fitLocked signal, responsive ResizeObserver, updated Fit button with lock indicator.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@Application/src/stores/canvasStore.ts
@Application/src/components/layout/CanvasArea.tsx
@Application/src/lib/shortcuts.ts
@Application/src/components/overlay/ShortcutsOverlay.tsx
@Application/src/main.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add fitLocked signal and auto-unlock to canvasStore</name>
  <files>Application/src/stores/canvasStore.ts</files>
  <action>
Add a `fitLocked` signal (boolean, default false) to canvasStore:

```
const fitLocked = signal(false);
```

Export it on the canvasStore object alongside the other signals.

Add a `toggleFitLock()` method: flips `fitLocked.value`. If turning ON, also call `fitToWindow()` immediately so the canvas snaps to fit.

Modify `fitToWindow()`: at the END of the method (after setting zoom and pan), set `fitLocked.value = true`. This way pressing F or Cmd+0 always engages the lock.

Add auto-unlock: In `zoomIn()`, `zoomOut()`, `setSmoothZoom()`, and `setPan()`, add `fitLocked.value = false;` at the top of each method body (before any other logic). This ensures any manual zoom or pan action disengages the fit lock.

Do NOT change `reset()` or `updateContainerSize()` — those are infrastructure, not user actions.
  </action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor && grep -c "fitLocked" Application/src/stores/canvasStore.ts</automated>
  </verify>
  <done>canvasStore exports fitLocked signal, fitToWindow sets fitLocked=true, zoomIn/zoomOut/setSmoothZoom/setPan set fitLocked=false, toggleFitLock method exists</done>
</task>

<task type="auto">
  <name>Task 2: Make ResizeObserver responsive and update Fit button UI</name>
  <files>Application/src/components/layout/CanvasArea.tsx, Application/src/lib/shortcuts.ts, Application/src/components/overlay/ShortcutsOverlay.tsx</files>
  <action>
**CanvasArea.tsx — ResizeObserver (responsive fit):**

In the ResizeObserver callback (inside `useEffect` around line 89), AFTER calling `canvasStore.updateContainerSize(...)`, add:

```typescript
if (canvasStore.fitLocked.peek()) {
  canvasStore.fitToWindow();
}
```

This makes the canvas auto-refit on every container resize while fit lock is engaged. Use `.peek()` to avoid subscribing the ResizeObserver to signal changes.

**CanvasArea.tsx — Fit button UI (lock toggle):**

Replace the existing Fit button (lines 230-238) with a toggle button that:
- Calls `canvasStore.toggleFitLock()` on click (instead of `canvasStore.fitToWindow()`)
- Shows active/locked state: when `canvasStore.fitLocked.value` is true, use a highlighted style — add `bg-[var(--color-accent)]` background and `text-white` text color (same accent pattern as the Play button). When false, keep the current neutral `bg-[var(--color-bg-settings)]` style with `text-[var(--color-text-secondary)]` text.
- Show a lock icon: Use Unicode lock character. When locked: "Fit \U0001F512" (or just show the lock). When unlocked: "Fit". Actually, keep it simple — just change the button label to include a small lock indicator. Use: locked = `\u{1F512} Fit` and unlocked = `Fit`. ACTUALLY, to keep it visually clean and avoid emoji rendering issues, use a simpler approach: when locked, add a small filled circle indicator `\u25CF` before "Fit" (like `\u25CF Fit`), or better yet, just rely on the color change (accent background = locked, neutral = unlocked) which is clear enough. The button text stays "Fit" in both states.
- Update the title tooltip: "Fit to window — locked (F)" when locked, "Fit to window (F)" when unlocked.

**shortcuts.ts:**

The `KeyF` and `$mod+Digit0` handlers currently call `canvasStore.fitToWindow()`. This is CORRECT — keep them as-is. Since `fitToWindow()` now sets `fitLocked = true` (from Task 1), pressing F will engage fit lock. Users who want to disengage can click the Fit button (toggleFitLock) or simply zoom/pan manually.

Actually, change the `KeyF` handler to call `canvasStore.toggleFitLock()` instead of `canvasStore.fitToWindow()`. This way F acts as a toggle: press F to lock fit, press F again to unlock (going back to whatever zoom you had — well, it stays at current zoom but disengages auto-refit). Keep `$mod+Digit0` calling `fitToWindow()` (always engages lock, consistent with macOS convention).

**ShortcutsOverlay.tsx:**

Update the Canvas shortcuts entries. Change the F key description from "Fit to window" to "Toggle fit lock". Keep Cmd+0 as "Fit to window".
  </action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor && grep -c "fitLocked" Application/src/components/layout/CanvasArea.tsx && grep "toggleFitLock" Application/src/lib/shortcuts.ts</automated>
  </verify>
  <done>ResizeObserver re-fits canvas when fitLocked is true on container resize. Fit button visually toggles between accent (locked) and neutral (unlocked). F key toggles fit lock. Cmd+0 engages fit lock. Shortcuts overlay updated.</done>
</task>

</tasks>

<verification>
1. Open the app, press F — canvas fits to window, Fit button shows accent color (locked state)
2. Resize the window — canvas automatically re-fits (stays fitted)
3. Toggle fullscreen — canvas auto-re-fits
4. Zoom in with = key — Fit button returns to neutral color (unlocked)
5. Press F again — re-engages fit lock, canvas fits and button shows accent
6. Click the Fit button — toggles lock off, button returns to neutral
7. Press Cmd+0 — always engages fit lock
</verification>

<success_criteria>
- fitLocked signal drives auto-refit behavior on window/container resize
- Manual zoom/pan disengages fit lock automatically
- Fit button clearly shows locked vs unlocked state via accent color
- F key toggles, Cmd+0 always engages
- No regressions in existing zoom/pan behavior
</success_criteria>

<output>
After completion, create `.planning/quick/4-create-a-lock-button-for-fit-to-have-res/4-SUMMARY.md`
</output>
