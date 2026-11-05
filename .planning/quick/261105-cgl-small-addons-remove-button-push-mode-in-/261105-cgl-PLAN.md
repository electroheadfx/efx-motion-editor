---
phase: quick-261105-cgl
plan: 261105-cgl
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts
  - app/src/components/physic-paint/view/physicsPaintFrameGoto.ts
  - app/src/components/physic-paint/view/physicsPaintFrameGoto.test.ts
  - app/src/components/physic-paint/view/physicsPaintHandTool.ts
  - app/src/components/physic-paint/view/physicsPaintHandTool.test.ts
  - app/src/components/physic-paint/view/physicsPaintHandToolWiring.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx
  - app/src/components/physic-paint/view/PhysicsPaintCanvasZoomViewport.tsx
  - app/src/components/physic-paint/physicsPaintStudio.css
  - .planning/STATE.md
  - .planning/quick/261105-cgl-small-addons-remove-button-push-mode-in-/261105-cgl-SUMMARY.md
autonomous: true
requirements: [QUICK-261105-CGL]
user_setup: []

estimate:
  tokens: 52000
  raw_tokens: 52000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "The bottom timeline action row no longer renders a Push mode button; the Studio Tools popover renders one entry with the same MoveHorizontal icon, a visible 'Push mode' label, the armed orange tint, the same guarded tooltip, and the same arm/disarm + Escape + drag behavior."
    - "Clicking the frame readout between Play and Next (the pinned <output class=\"physics-paint-current-frame\">, now wrapped in a trigger button) opens a popover; the popover defaults to Frame, accepts a frame number, and can switch to Seconds where the value is the same position expressed through the project fps; committing either one seeks the timeline through the Studio's existing navigation path, clamped to the last frame."
    - "The vertical left tool rail gains a Hand button (lucide Hand) that is disabled and greyed whenever the sheet has no overflow (Fit), and enabled once the canvas is zoomed past Fit."
    - "Clicking Hand arms a session-only host tool; a primary-button drag on the canvas pans it in all directions through the SAME zoom-store pan path as middle-drag; releasing the drag disarms the hand and the previous paint tool, Select mode, and picker state are untouched, so the next stroke paints normally."
    - "Middle-button pan, wheel/pinch zoom, the Fit/1:1 pill, the pinned mount contract, and every existing keyboard binding are unchanged; no bare-key shortcut is added."
    - "Nothing is persisted or sent: the hand arm and the go-to popover are session-only UI state; no engine, document, persistence, export, or paint-data path is touched."
  artifacts:
    - path: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx"
      provides: "Push mode toggle relocated into the Tools popover (prop-driven, memo-safe); current-frame trigger button + frame go-to popover; static-chrome props for push and frame navigation"
    - path: "app/src/components/physic-paint/view/physicsPaintFrameGoto.ts"
      provides: "Pure frame/seconds parse, convert, round, clamp helpers (one conversion law shared with audioGain)"
    - path: "app/src/components/physic-paint/view/physicsPaintFrameGoto.test.ts"
      provides: "Frame-mode rounding/clamping, seconds conversion at project fps, roundtrip and invalid-input pins"
    - path: "app/src/components/physic-paint/view/physicsPaintHandTool.ts"
      provides: "Session-only hand arm signal with compare-then-write toggle/disarm and peek/subscribing reads"
    - path: "app/src/components/physic-paint/view/physicsPaintHandTool.test.ts"
      provides: "Arm/disarm/idempotence pins; the module never writes the paint tool, Select mode, or picker state"
    - path: "app/src/components/physic-paint/view/physicsPaintHandToolWiring.test.ts"
      provides: "Source pins: Hand rail button disabled by overflow, capture-phase primary-button consumption only while armed, release disarms, no keyboard binding added"
    - path: "app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx"
      provides: "Hand host-tool button beside Picker/Select, greyed when the sheet cannot pan"
    - path: "app/src/components/physic-paint/view/PhysicsPaintCanvasZoomViewport.tsx"
      provides: "Primary-button hand pan sharing the middle-drag drag state, grab/grabbing cursor class, disarm on release and on fit"
    - path: "app/src/components/physic-paint/physicsPaintStudio.css"
      provides: "Frame trigger/button affordance, compact frame popover, hand cursor states, removal of the retired push group rule"
  key_links:
    - "Tools popover button -> togglePushTool() -> physicsPaintPushArmedTool armed signal -> strip tint/data-push-armed -> usePhysicsPaintPushDrag; Escape, lock, and other-tool disarm paths unchanged."
    - "Frame readout click -> popover -> resolveFrameGotoTarget(mode, value, fps, lastFrame) -> static-chrome onGoToFrame -> props.onNavigateToSyncedFrame -> Studio requestRotoFrameNavigation (the same path as clicking a timeline cell)."
    - "Hand rail button -> physicsPaintHandTool armed -> viewport capture pointerdown -> shared drag state -> physicsPaintCanvasZoom.setPan -> panX/panY -> translate-only pan layer."
    - "Hand pointerup/cancel -> disarmHandTool() -> aquarelleActiveTool/select/picker untouched -> previous tool is already installed."
---

<objective>
Three small Studio add-ons delivered in one quick:

1. Move the Push mode toggle out of the bottom timeline action row and into the Studio Tools popover, keeping its icon, its label, its armed tint, its guarded tooltip, and every arm/disarm/drag behavior.
2. Turn the current-frame readout next to Play into the clickable Frame control: a popover that accepts a frame number and switches between Frame and Seconds (Frame default), seeking through the Studio's existing navigation path.
3. Add a Hand host tool to the vertical left tool rail: it pans the canvas in all directions with a primary-button drag, reusing the existing zoom-store pan machinery (the same one middle-drag uses), returns to the previous tool on release, and is greyed out whenever the sheet is at Fit (no overflow, so nothing to pan).

Purpose: the Push toggle no longer belongs in the compact action row now that the Tools popover owns timeline controls; the frame readout is the natural place to jump to an exact frame or time; and the hand gives a discoverable alternative to middle-mouse panning without inventing a second pan system.

Output: one relocated toggle, one pure frame/seconds helper module, one session-only hand-tool module, and the three surfaces wired into the existing strip, rail, and zoom viewport. No engine, document, persistence, export, or paint-data change.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@CLAUDE.md

Planning sources (verified against the live tree at plan time):
@app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
@app/src/components/physic-paint/view/PhysicsPaintCanvasZoomViewport.tsx
@app/src/components/physic-paint/view/physicsPaintCanvasZoom.ts
@app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx
@app/src/components/physic-paint/view/physicsPaintPushArmedTool.ts
@app/src/components/physic-paint/view/physicsPaintCanvasZoomWiring.test.ts
@app/src/components/physic-paint/roto/rotoNavigationActions.ts
@app/src/lib/audioGain.ts
@app/src/components/shared/NumericStepper.tsx
@app/src/components/physic-paint/physicsPaintStudio.css

Ground rules:
- Preact + @preact/signals only. No React patterns. Local popover open/mode/draft state may follow the existing `useState` convention already used by the same static-chrome component (reactivity skill rule 9); shared reactive state stays signals with compare-then-write setters. Narrow signal reads only; never `.value`-read a per-tick playback signal in a large render body.
- Do not run the dev server or the Tauri app. The user runs live UAT; never record a live row as passed.
- Tests: `pnpm --dir app exec vitest run <paths>`, never watch. Vitest collects only `src/**/*.test.ts`; a `.test.tsx` target runs nothing. Typecheck: `pnpm --dir app run typecheck`. No new dependencies. Never push.
- Reuse existing machinery: the zoom store's pan path for the hand, the toolbox popover portal/dismissal helper for the frame popup, `framesToSeconds`/`secondsToFrames` from `app/src/lib/audioGain.ts`, `NumericStepper` for the numeric entry, and the Studio's `onNavigateToSyncedFrame` for seeks.
- Keep every pinned contract intact: the `<output class="physics-paint-current-frame">` element/class/placement, the static-chrome memo, the middle-button capture listener strings pinned by `physicsPaintCanvasZoomWiring.test.ts`, the push armed-tool module API, and every existing test that is not explicitly updated below.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Move the Push mode toggle from the action row into the Tools popover</name>
  <files>app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx, app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts, app/src/components/physic-paint/physicsPaintStudio.css</files>
  <action>
    Relocate the ONE Push mode toggle without changing any arm, disarm, drag, Escape, lock, or commit behavior.

    In `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx`:
    1. Delete the whole `<div class="physics-paint-push-tool-group">` block at the end of the action row: its button, its `roto-key-action-reason-push` sr-only span, and its PhysicsPaintStyledTooltip. Keep the action row's `onClickCapture` disarm guard, but drop the `.physics-paint-push-tool-button` exception and the comment that explains it — with the toggle gone from the row, every row action now disarms unconditionally via `disarmPushTool()`.
    2. Extend `PhysicsPaintWorkflowStaticChromeProps` with `pushArmed: boolean`, `pushArmedClass: string`, `pushToolDisabled: boolean`, `pushToolDisabledReason: string | null`, beside the existing solo props (same naming convention).
    3. In `PhysicsPaintWorkflowStaticChromeImpl`, add a `pushTooltip` from `useStyledTooltip()` beside the other popover tooltip hooks.
    4. As the FIRST child of the `<PhysicsPaintToolboxPopover>` panel (before the Playback section), render a new `physics-paint-toolbox-section` with the heading `Push`. It contains one `physics-paint-roto-key-icon-action` span wrapping a button with class `physics-paint-roto-key-icon-button physics-paint-push-tool-button` plus `props.pushArmedClass`, `aria-label="Push"`, `aria-pressed` from `props.pushArmed`, and `aria-disabled`/`aria-describedby` from `props.pushToolDisabled`/`props.pushToolDisabledReason` exactly as the removed button did. The button content is `<MoveHorizontal size={18} aria-hidden="true" />` followed by `<span class="physics-paint-roto-key-icon-label">Push mode</span>`. Its onClick hides the tooltip, returns when `props.pushToolDisabled`, else calls `togglePushTool()`; its onKeyDown preventDefaults Enter/Space when disabled. Keep the sr-only reason span and the PhysicsPaintStyledTooltip with the exact existing guarded copy. Follow the section with a `physics-paint-toolbox-divider` so the Playback section keeps the popover's divider pattern.
    5. At the `<PhysicsPaintWorkflowStaticChrome ... />` call site, pass `pushArmed={pushArmed}`, `pushArmedClass={pushArmedClass}`, `pushToolDisabled={pushToolDisabled}`, and `pushToolDisabledReason={pushToolDisabledReason}`. `pushArmedClass` stays computed in the strip body exactly as today, so the armed tint and the memoized prop flow are unchanged.

    Do not touch `physicsPaintPushArmedTool.ts`, `usePhysicsPaintPushDrag`, the strip's `data-push-armed`, the armed cursor class, the Studio's Escape/lock disarm effects, or any commit path.

    In `app/src/components/physic-paint/physicsPaintStudio.css`, delete only the `.physics-paint-push-tool-group` rule. Keep `.physics-paint-push-tool-button.physics-paint-push-tool-armed` and its hover/focus rules untouched — the popover toggle reuses them. Do not add a new panel style; the icon+label row reuses the existing popover button classes.

    Then update the source pins in `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts`: drop `aria-label="Push"` and the push-group ordering assertions from the action-row test, assert the action row contains neither `aria-label="Push"` nor `physics-paint-push-tool-group`, and add one positive assertion that the static-chrome/header block contains the Push section heading, the visible `Push mode` label, `MoveHorizontal`, `togglePushTool()`, `aria-pressed`, and the guarded tooltip copy.

    Run the strip, popover, and keyboard suites plus typecheck.
  </action>
  <verify>
    <automated>pnpm --dir app exec vitest run src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts src/components/physic-paint/view/physicsPaintToolboxPopover.test.ts src/components/physic-paint/view/physicsPaintStudioKeyboard.test.ts && pnpm --dir app run typecheck</automated>
  </verify>
  <done>The bottom action row renders no Push button and no push group; the Tools popover renders one Push section entry with the MoveHorizontal icon, the visible "Push mode" label, the armed tint, the guarded tooltip, and the same toggle; arm/disarm, Escape, lock, and drag behavior are byte-identical; the retired group CSS is gone; the updated pins and typecheck are green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Frame readout opens a Frame/Seconds go-to popover</name>
  <files>app/src/components/physic-paint/view/physicsPaintFrameGoto.ts, app/src/components/physic-paint/view/physicsPaintFrameGoto.test.ts, app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx, app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts, app/src/components/physic-paint/physicsPaintStudio.css</files>
  <behavior>
    Pure helper cases pinned by `physicsPaintFrameGoto.test.ts`:
    1. Frame mode: 5.4 resolves to frame 5, -3 resolves to 0, and 999 resolves to lastFrame.
    2. Seconds mode at 12 fps: 2.5 s resolves to frame 30; 0.01 s resolves to frame 0; a value beyond the last frame clamps to lastFrame.
    3. Invalid values: NaN and Infinity resolve to null (no seek), never to a negative or NaN frame.
    4. Display value: frame mode returns the frame unchanged; seconds mode returns `framesToSeconds(frame, fps)`.
    5. Roundtrip at 12 fps: frame 30 -> 2.5 s -> resolveFrameGotoTarget returns 30; `lastFrame` 0 always resolves to 0.
    6. fps of 0 or a negative fps is treated as 1 by the shared `audioGain` conversion law and never divides by zero.
  </behavior>
  <action>
    Create `app/src/components/physic-paint/view/physicsPaintFrameGoto.ts` with a pure, dependency-light API over `framesToSeconds`/`secondsToFrames` from `app/src/lib/audioGain.ts`:
    - `export type FrameGotoMode = 'frame' | 'seconds';`
    - `normalizeFrameGotoFrame(frame: number, lastFrame: number): number | null` — returns null for non-finite input, else rounds and clamps into `[0, Math.max(0, lastFrame)]`.
    - `resolveFrameGotoValue(mode: FrameGotoMode, frame: number, fps: number): number` — frame mode returns the frame; seconds mode returns `framesToSeconds(frame, fps)`.
    - `resolveFrameGotoTarget(mode: FrameGotoMode, value: number, fps: number, lastFrame: number): number | null` — frame mode normalizes directly; seconds mode converts with `secondsToFrames` and then normalizes.
    Write the test file first (RED) using `.test.ts`, then implement (GREEN).

    In `PhysicsPaintWorkflowStrip.tsx`, rework `RotoPlaybackCurrentFrameOutput`:
    - Keep the pinned `<output class="physics-paint-current-frame">` element, class, content, and placement exactly (the 38.1-D-01 pin). Wrap it in a new `<button type="button" class="physics-paint-current-frame-trigger" aria-haspopup="dialog" aria-expanded={open} aria-label={Frame N — open the go-to-frame popup} title="Frame — click to go to a frame">`. The button is the popover anchor; the output remains the visible numeric box.
    - On click: set mode to 'frame', seed the canonical draft frame from the live read (`props.playbackActive ? props.playbackTick?.peek()?.appFrame ?? props.currentFrame.peek() : props.currentFrame.peek()`), and open. The popover never follows playback ticks while open.
    - Render the popover through the existing `PhysicsPaintToolboxPopover`, extended with two optional props: `panelId?: string` (default `'physics-paint-toolbox-popover'`, so the Tools instance keeps its id) and `className?: string` (appended to the panel class). Pass `panelId="physics-paint-frame-goto-popover"`, `className="physics-paint-frame-goto-popover"`, and `ariaLabel="Go to frame"`.
    - Panel content: a two-button unit switch with class `physics-paint-frame-goto-mode` and labels `Frame` and `Seconds`, `aria-pressed` on the active one; then one `NumericStepper` whose value is `resolveFrameGotoValue(mode, draftFrame, fps)`. In frame mode pass `min={0}`, `max={lastFrame}`, no `step` (classic ±1); in seconds mode pass `min={0}`, `max={framesToSeconds(lastFrame, fps)}`, `step={0.1}`, `precision={2}`. Its `onChange` resolves through `resolveFrameGotoTarget(mode, value, fps, lastFrame)` and, when non-null, writes the draft frame and calls `props.onGoToFrame(target)`; the popover stays open for stepping. Label the field `Frame number` or `Time in seconds` per mode.
    - Dismissal: register a window capture `pointerdown` that calls the existing `shouldDismissToolboxPopover(event.target, [anchorRef.current, panelRef.current])` and closes, plus a window capture `keydown` that consumes only Escape via `stopImmediatePropagation()` and closes — registered only while open, removed in cleanup, mirroring the Tools popover's one-layer rule. No backdrop and no focus trap.
    - Extend the child's props with `lastFrame?: number`, `fps?: number`, and `onGoToFrame?: (frame: number) => void`, defaulting `lastFrame` to 0 and `fps` to 1.
    - Extend `PhysicsPaintWorkflowStaticChromeProps` with `lastFrame: number` and `onGoToFrame?: (frame: number) => void`; pass them into `RotoPlaybackCurrentFrameOutput` alongside the existing `projectFps`. At the static-chrome call site pass `lastFrame={Math.max(0, frameCells.length - 1)}` and `onGoToFrame={props.onNavigateToSyncedFrame}`.

    In `physicsPaintStudio.css`: add `.physics-paint-current-frame-trigger` as a zero-chrome inline-flex trigger (no padding/border/background, `cursor: pointer`, inherit font, a subtle hover and `:focus-visible` wash) so the 48x26 output box is unchanged visually; add `.physics-paint-frame-goto-popover` overrides on top of the reused toolbox panel (compact width around 220-232px, padding 12px) plus the mode-switch row (two buttons reusing the Studio selected language: active uses the same blue/orange selected family already used by popover toggles) and the NumericStepper field width. Do not restyle the toolbox panel itself.

    Add source pins to `PhysicsPaintWorkflowStrip.test.ts`: the `physics-paint-current-frame` output literal still exists exactly once inside the trigger button; the trigger carries `aria-haspopup="dialog"`; the popover initializes its mode to `'frame'` on open; the popover calls `resolveFrameGotoTarget` and `props.onGoToFrame`; the static-chrome call passes `onGoToFrame={props.onNavigateToSyncedFrame}` and `lastFrame={Math.max(0, frameCells.length - 1)}`.

    Run the pure-helper suite, the strip suite, and typecheck.
  </action>
  <verify>
    <automated>pnpm --dir app exec vitest run src/components/physic-paint/view/physicsPaintFrameGoto.test.ts src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts && pnpm --dir app run typecheck</automated>
  </verify>
  <done>Clicking the current-frame box opens a compact popover anchored above the strip; it starts in Frame mode, accepts a frame number, switches to Seconds showing the same position through the project fps, and seeks through `onNavigateToSyncedFrame` on every commit, clamped to the last frame; the pinned output element and class are unchanged; dismissal works by outside click and Escape; the helper tests, updated pins, and typecheck are green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Hand tool pans the canvas and returns to the previous tool on release</name>
  <files>app/src/components/physic-paint/view/physicsPaintHandTool.ts, app/src/components/physic-paint/view/physicsPaintHandTool.test.ts, app/src/components/physic-paint/view/physicsPaintHandToolWiring.test.ts, app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx, app/src/components/physic-paint/view/PhysicsPaintCanvasZoomViewport.tsx, app/src/components/physic-paint/physicsPaintStudio.css, .planning/STATE.md, .planning/quick/261105-cgl-small-addons-remove-button-push-mode-in-/261105-cgl-SUMMARY.md</files>
  <behavior>
    Hand module cases pinned by `physicsPaintHandTool.test.ts`:
    1. Starts disarmed; `toggleHandTool()` arms it and returns nothing; a second toggle disarms.
    2. `disarmHandTool()` is idempotent (no signal notification when already disarmed) and never writes the paint tool, Select mode, or picker state.
    3. `isHandToolArmed()` is a subscribing read and `isHandToolArmedPeek()` a dispatch-time peek; a signals effect subscribed to the armed signal does not re-run on a repeated arm.
  </behavior>
  <action>
    Create `app/src/components/physic-paint/view/physicsPaintHandTool.ts` modeled on `physicsPaintPushArmedTool.ts` and `aquarelleColorPicker.ts`: one session-only `signal(false)`, `isHandToolArmed()` (subscribing), `isHandToolArmedPeek()` (peek), `setHandToolArmed(next)` with compare-then-write, `toggleHandTool()`, and `disarmHandTool()`. Document that the hand is a HOST tool: it never enters the `AquarelleTool` union and never writes `aquarelleActiveTool`, select mode, or picker state, so disarming is literally "back to the previous tool". Write the test first (RED), then the module (GREEN).

    In `PhysicsPaintToolRail.tsx`: import `Hand` from `lucide-preact`, the hand module, and `physicsPaintCanvasZoom`. In `WatercolorRail`, immediately after the Select button and before Dry, render a `physics-paint-icon-button` button with `data-testid="aquarelle-hand-toggle"`, `aria-label="Hand"`, `aria-pressed` from the armed read, class `.active` while armed, and `disabled={disabled || !physicsPaintCanvasZoom.hasOverflow.value}`. Its onClick guards on `physicsPaintCanvasZoom.hasOverflow.peek()` and then calls `toggleHandTool()`. Title: enabled copy names the drag-and-release behavior; disabled copy says panning needs the canvas zoomed past Fit. Add the hand-armed state to the paint-tool row's active exclusion (`!selectActive && !pickerActive && !handArmed && active === id`). Do not change any other rail button, order, or disabled rule, and do not add a keyboard shortcut.

    In `PhysicsPaintCanvasZoomViewport.tsx`: import the hand module. On mount (the existing `resetForStudioOpen` effect) also call `disarmHandTool()`. Add one `effect()` subscription (disposed with the enclosing `useEffect` cleanup) that toggles the class `physics-paint-canvas-hand-armed` on the viewport from the armed read, and disarms the hand when it is armed while `physicsPaintCanvasZoom.hasOverflow.value` is false — the termination condition is the compare-then-write disarm (one extra run, then stable). In `onPointerDown`, BEFORE the existing button-1 branch: when `event.button === 0 && isHandToolArmedPeek()` is true, if `!physicsPaintCanvasZoom.hasOverflow.peek()` disarm and return WITHOUT preventDefault/stopPropagation so painting can never be blocked; otherwise preventDefault + stopPropagation, set the shared drag record with a `source: 'hand'` marker, capture the pointer, and set the grabbing cursor. Keep the existing middle-button branch and every pinned listener registration line byte-identical. In `endDrag`, when the drag source is 'hand', preventDefault + stopPropagation the release and call `disarmHandTool()`; middle-drag behavior stays exactly as today. Pointermove/pointercancel already share the drag path and the clamped `setPan` math, so the hand gains the same pan-in-all-directions behavior as middle-drag.

    In `physicsPaintStudio.css`, next to the zoom viewport rules: `.physics-paint-canvas-zoom-viewport.physics-paint-canvas-hand-armed` and its descendants render `cursor: grab`, and the dragging state rendered via the inline grabbing cursor stays as the existing imperative reset. Do not touch the zoom pill, clipping, or pan-transform rules.

    Create `physicsPaintHandToolWiring.test.ts` (`.test.ts`, read-only source pins): the rail renders the `aquarelle-hand-toggle` button using `Hand` and `disabled={disabled || !physicsPaintCanvasZoom.hasOverflow.value}`; the viewport's capture pointerdown consumes primary button only while armed and never consumes it when there is no overflow; `endDrag` disarms the hand; the grazing cursor class is toggled; `physicsPaintStudioKeyboard.ts` gains no hand/pan binding.

    Then write `.planning/quick/261105-cgl-small-addons-remove-button-push-mode-in-/261105-cgl-SUMMARY.md` recording the implementation and these UAT rows as PENDING (never passed): (1) Push mode is gone from the bottom action row and present in the Tools popover with its icon and label; (2) the frame readout opens the popup, defaults to Frame, and seeks on a frame number; (3) Seconds mode shows the same position in seconds and seeks on a seconds entry; (4) the Hand button is greyed at Fit and enabled when zoomed past Fit; (5) hand drag pans in all directions and release returns to the previous paint tool with the next stroke painting normally; (6) middle-drag, wheel/pinch zoom, and painting at 1:1 are unchanged after a hand pan. Append a concise `STATE.md` entry (current quick 261105-cgl, awaiting live UAT). Commit atomically; never push.

    Run the hand module suite, the hand wiring pins, the zoom wiring pins, and typecheck.
  </action>
  <verify>
    <automated>pnpm --dir app exec vitest run src/components/physic-paint/view/physicsPaintHandTool.test.ts src/components/physic-paint/view/physicsPaintHandToolWiring.test.ts src/components/physic-paint/view/physicsPaintCanvasZoomWiring.test.ts && pnpm --dir app run typecheck</automated>
  </verify>
  <done>The left rail renders an enabled-or-greyed Hand button driven by canvas overflow; arming it and dragging with the primary button pans the canvas through the existing zoom-store pan path; releasing (or reaching Fit/resizing out of overflow) disarms it and the previous tool is still installed untouched; middle-drag, wheel/pinch zoom, the zoom pill, the mount contract, and existing tests are unchanged; the SUMMARY and STATE record the quick as awaiting live UAT; nothing is pushed.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| frame popup input -> Studio navigation | A local text/number entry crosses into a timeline seek (frame index) through the shared numeric stepper and the pure conversion helpers. |
| primary/middle pointer input -> zoom store | Local HID events drive display state; the hand branch consumes the primary button before the engine and the picker see it. |
| popover dismissal (window capture Escape/pointerdown) -> Studio dispatcher | Two popovers and the Studio keyboard layer compete for the same Escape. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261105-CGL-01 | Tampering | frame go-to input | low | mitigate | Every entry passes through `resolveFrameGotoTarget`, which rejects non-finite values, rounds to an integer, and clamps into `[0, lastFrame]` before calling the existing guarded navigation path; no raw string, NaN, or out-of-range frame reaches the timeline or document. |
| T-261105-CGL-02 | Denial of service | hand pointer routing | low | mitigate | The capture-phase primary-button consumer runs only while the hand is armed AND the sheet overflows; if overflow disappears (Fit, resize) the effect and the pointerdown self-heal both disarm it, so a canvas click can never be permanently swallowed and painting is never blocked. |
| T-261105-CGL-03 | Tampering | popover Escape layering | low | mitigate | The frame popover registers its window listeners only while open, consumes only Escape, mirrors the toolbox's `stopImmediatePropagation` one-layer rule, and uses the shared `shouldDismissToolboxPopover` classifier so interior/portaled hits never dismiss it. |
| T-261105-CGL-04 | Information disclosure | hand/popover state | low | accept | The armed hand, the popup mode, and the draft frame are session-only UI state; nothing is logged, persisted, exported, or sent. |
| T-261105-CGL-SC | Tampering | dependency installs | high | mitigate | No package installs occur in this quick; no manifest or lockfile change. |
</threat_model>

<verification>
- `pnpm --dir app run typecheck` is clean.
- `pnpm --dir app exec vitest run src/components/physic-paint/view/physicsPaintFrameGoto.test.ts src/components/physic-paint/view/physicsPaintHandTool.test.ts src/components/physic-paint/view/physicsPaintHandToolWiring.test.ts src/components/physic-paint/view/physicsPaintCanvasZoomWiring.test.ts src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts src/components/physic-paint/view/physicsPaintToolboxPopover.test.ts src/components/physic-paint/view/physicsPaintStudioKeyboard.test.ts` passes.
- The full `pnpm --dir app exec vitest run` suite passes as the closing gate (run it in the background if it is slow; resume on the completion notice).
- Only the listed files change (plus the SUMMARY and STATE entry). No engine, document, persistence, export, working-size, paperTextureScale, or paint-data path is modified; no bare-key shortcut is added; middle-mouse pan and wheel/pinch zoom listener contracts are unchanged; nothing is pushed.
- Live UAT stays the user's: the SUMMARY records the six visual rows as pending, never passed.
</verification>

<success_criteria>
- The bottom timeline action row no longer shows Push mode; the Tools popover shows one Push mode entry with its MoveHorizontal icon, its visible label, its armed tint, its guarded tooltip, and the same arm/disarm/drag behavior.
- Clicking the frame readout between Play and Next opens a Frame/Seconds popover: Frame is the default, a frame number seeks directly, Seconds shows the same position through the project fps and seeks on commit, and every value is clamped to the last frame.
- The left tool rail has a Hand button that is greyed at Fit and enabled when the canvas overflows; clicking it arms a temporary pan tool, primary-button drag pans in all directions through the existing zoom-store path, and release restores the untouched previous tool.
- Middle-drag pan, wheel/pinch zoom, Fit/1:1, painting at 1:1, and every existing keyboard binding behave exactly as before.
- The three commits are atomic, tests and typecheck are green, and UAT rows are recorded as pending.
</success_criteria>

<output>
Create .planning/quick/261105-cgl-small-addons-remove-button-push-mode-in-/261105-cgl-SUMMARY.md when done.
</output>
