---
phase: 261030-cnq
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/physic-paint/view/aquarelleColorPicker.ts
  - app/src/components/physic-paint/view/aquarelleColorPicker.test.ts
  - app/src/components/physic-paint/hooks/useAquarelleColorPicker.ts
  - app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx
  - app/src/components/physic-paint/view/aquarelleRecordState.ts
  - app/src/components/physic-paint/view/aquarelleStrokeSelection.ts
  - app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts
  - app/src/components/physic-paint/view/physicsPaintStudioKeyboard.test.ts
autonomous: true
requirements:
  - PICK-ALT-TEMPORARY
  - PICK-RAIL-TOOL
  - PICK-SAMPLE-COMPOSITE
  - PICK-COMMIT-COLOR
  - PICK-CONSUME-INPUT
  - PICK-SELECT-CARVE
  - PICK-DISARM
user_setup: []

estimate:
  # Per-task projection at execution-turn boundaries — each task ends with its
  # own commit and the next task re-reads ONLY its own files:
  #   Task 1 (picker state + pure color law + Alt hold + stack capture): 26000
  #   Task 2 (rail Picker button + I shortcut + disarm laws + tests):    18000
  #   Sum: 44000 < workflow.smart_zone_tokens (100000).
  # Calibration factor 1.0 (estimate-calibration: no sample data -> low).
  tokens: 44000
  raw_tokens: 44000
  tasks: 2
  confidence: low

must_haves:
  truths:
    - "Holding Alt and clicking the canvas samples the visible color under the cursor and makes it the active foreground color; releasing Alt returns to the paint tool that was active before — the picker never changes the aquarelle tool."
    - "The sample is the straight-alpha composite of the visible stack, bottom to top: paper fond → below program monitor (Background photo + lower tracks) → cached base → live engine sheet (transmittance converted to pigment alpha) → above program monitor."
    - "A pick never paints: while the picker is armed the canvas pointerdown is consumed at the stack capture phase, so neither the aquarelle engine nor the stroke overlay nor the Roto auto-key promotion receives it."
    - "The left watercolor rail gains a Picker button (Pipette icon) that latches the picker; the four paint tool buttons render deselected while it is latched, and a paint tool key (B/W/E/P) or a second click on Picker returns to the previous paint tool."
    - "Move/Edit (Select) mode owns Alt: while select mode is on the picker is inert and Alt+click keeps its existing hit-stroke delete behavior."
    - "A pick writes both color surfaces with ONE normalized lower-case #rrggbb value: the foreground swatch (paintStore.foregroundColor) and the engine color (settings.color), so the next stroke uses it."
    - "Losing window focus or hiding the window while Alt is held disarms the temporary picker, so the next canvas click paints instead of sampling."
  artifacts:
    - app/src/components/physic-paint/view/aquarelleColorPicker.ts
    - app/src/components/physic-paint/view/aquarelleColorPicker.test.ts
    - app/src/components/physic-paint/hooks/useAquarelleColorPicker.ts
    - app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx
    - .planning/quick/261030-cnq-pick-a-color-from-the-photo-background-o/261030-cnq-SUMMARY.md
  key_links:
    - "Alt keydown/keyup (window) → setAquarellePickerAltHeld → aquarellePickerActive + isAquarellePickerArmed() → canvas stack onPointerDownCapture → handleAquarelleColorPick"
    - "Stack capture consumes (preventDefault + stopPropagation) BEFORE onInputIntent(beginRotoFrameEdit) and BEFORE the aquarelle engine / AquarelleStrokeOverlay pointerdown listeners under the capture target"
    - "aquarelleEnginePortRef.exportCanvas('transparent', false) + fond / below-monitor / cached-base / above-monitor canvases → sampleAquarelleStackColor → handleActiveColorChanged(settings.color) + paintStore.setForeground(hex)"
    - "setAquarelleTool and setAquarelleSelectMode(true) → disarmAquarellePicker (one choke point each; the picker module never imports them)"
---

<objective>
Add a color picker (eyedropper) to the Water color Studio: a Picker tool in the left vertical tool rail, an `I` latching shortcut, and a temporary picker armed by holding Alt that samples the visible pixel — photo Background, painted sheet, or any track under the cursor — and makes it the active foreground color without painting anything.

Purpose: today the user must guess a color hex to match the photo Background or existing paint. A picker is the missing bridge between the visible composite and the brush color, and Alt-hold is the industry-standard temporary eyedropper.

Output: a new `aquarelleColorPicker` state + sampling module with unit tests, an Alt-hold window hook, a pointerdown-capture seam on the canvas stack that consumes picks before the engine, a Picker button in the left rail, an `I` shortcut in the Studio keyboard dispatch, and disarm laws on paint-tool picks and Select entry.

This quick is the source of truth for the user decision (no CONTEXT.md exists):
"Pick a color from the photo background or/and the paint with the picker Tool, add a tool in left vertical sidebar tool and a shortcut which active it temporary: 'alt' when I press I can pick color and when I release back to the previous tool."
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md
@.claude/skills/efx-preact-reactivity/SKILL.md

Quick task: 261030-cnq — pick a color from the photo Background and/or the paint, with a left-rail Picker tool and a temporary Alt-hold picker that returns to the previous tool on release.

Verified scouting (planning-time facts, do not re-derive):

- LEFT RAIL: `app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx` — `WatercolorRail` is the left vertical rail. `WATERCOLOR_RAIL_TOOLS` maps the engine union `AquarelleTool` = `'brush' | 'water' | 'pen' | 'lift'` (closed union, exported by `@efxlab/efx-watercolor/payload`). The picker is NOT a paint tool: never add it to `AquarelleTool`, `AQUARELLE_TOOLS`, or `WATERCOLOR_RAIL_TOOLS`. The rail also renders the Select toggle, Dry, Undo/Redo, Re-render, Trash and `ForegroundBackgroundSwatch`. Buttons reuse `physics-paint-icon-button` (+ `.active`) — NO CSS change is needed. `lucide-preact` exports `Pipette`.
- SURFACE LAW: `aquarelleActiveTool` (in `view/aquarelleRecordState.ts`) is the paint tool and stays untouched by the picker, so releasing Alt is naturally "back to the previous tool".
- CANVAS STACK CAPTURE: `app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx` line ~210: `onPointerDownCapture={(event) => props.onInputIntent?.(event)}` on the `.physics-paint-canvas-stack` div. This capture target is an ANCESTOR of the aquarelle live layer and of `AquarelleStrokeOverlay`, so a `stopPropagation()` there prevents every descendant pointerdown listener (engine stroke start, select overlay). The Studio passes `onInputIntent: beginRotoFrameEdit` (auto-key promotion) at `PhysicsPaintStudio.tsx:8517`.
- STUDIO SEAMS: `handleActiveColorChanged` (`PhysicsPaintStudio.tsx:2392`) sets `settings.color` compare-then-write (the engine color). The right-panel color law (`PhysicsPaintStudio.tsx:6148-6151`) is exactly `handleActiveColorChanged(color); paintStore.setForeground(color);` — reuse it verbatim for a pick. `aquarelleEnginePortRef` (`PhysicsPaintStudio.tsx:664-666`) holds the `AquarelleEnginePort`. `isPlaying` is a Studio state (`:667`). The keyboard hook is wired at `:5444`; the canvas-stack props memo is `canvasStackPropsMemo.resolve([...], ...)` at `:8443`.
- ENGINE EXPORT: `port.exportCanvas(background = 'transparent', texture = true)` → `Engine.exportCanvas` (`packages/efx-watercolor/src/playground/Engine.ts:915`) returns an HTMLCanvasElement holding the OPAQUE transmittance sheet (alpha = 255 everywhere; white = no pigment). It is the readable stand-in for the live sheet because `.aquarelle-live-canvas` is a WebGL2 canvas (`getContext('2d')` returns null). Convert a sampled transmittance pixel with the SAME law the display path uses (`app/src/lib/rasterAlpha.ts:114-121`): `min = min(r,g,b); alpha = (255-min)/255; channel = (c-min)*255/(255-min)`; `min === 255` → fully transparent pigment.
- LAYER ORDER (CSS `physicsPaintStudio.css`): `.physics-paint-fond-layer` beneath the tracks group; inside the group `program monitor` z0 → `.aquarelle-cached-base` z3 → `.aquarelle-live-canvas` z4 → `.physics-paint-program-monitor-above` z5. The cached-base canvas already carries STRAIGHT-ALPHA PIGMENT (`AquarelleCachedBaseLayer.tsx:169` draws `pigment ?? image`), so it is sampled as-is. The below-monitor draws the Background photo + lower tracks; the above-monitor draws tracks above the active one.
- SELECT-MODE ALT: `engine/ScriptStrokeOverlay.tsx:183` already implements Alt+click = delete the hit stroke while Move/Edit is armed. That behavior must survive: the picker is inert while `aquarelleSelectMode` is on.
- ASSETS: `aquarelleStrokeSelection.ts` exports `aquarelleSelectMode` / `setAquarelleSelectMode` (line ~275). `setAquarelleTool` is `aquarelleRecordState.ts:204`.
- KEYBOARD: `view/physicsPaintStudioKeyboard.ts` bare-key branch (~354-380) owns B/W/E/P/A/F/C/D. `'i'` is unused in the Studio window (the Studio window does not mount `lib/shortcuts.ts`, which is where the main window's KeyI add-keyframe lives). `dispatchPhysicsPaintStudioKeyDown` is the tested entry point; its test helper builds an `actions()` object of `vi.fn()`s.
- TESTS: `app/vitest.config.ts` collects `src/**/*.test.ts` only, in a node environment (no DOM). Pure math + signal-state tests go in `.test.ts`; wiring is pinned with `readFileSync` literal assertions (the repo's established style).
- Preact reactivity rules apply: compare-then-write setters, no signal writes in a render body, signal reads only in narrow leaves (the rail body already reads `aquarelleActiveTool.value`; that is the sanctioned leaf subscription).
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: End-to-end Alt picker — state + color law + stack capture → foreground color</name>
  <files>
    app/src/components/physic-paint/view/aquarelleColorPicker.ts,
    app/src/components/physic-paint/view/aquarelleColorPicker.test.ts,
    app/src/components/physic-paint/hooks/useAquarelleColorPicker.ts,
    app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx,
    app/src/components/physic-paint/PhysicsPaintStudio.tsx
  </files>
  <behavior>
    - `compositeRgbaOver`: an opaque top replaces the base; a transparent top leaves the base unchanged; 50% white over opaque black → rgb 128 / alpha 1.
    - `compositePickLayers`: bottom→top order is respected (an opaque upper layer wins), null layers are skipped, an all-null / empty list returns alpha 0.
    - `transmittancePixelToPigment`: (255,255,255) → alpha 0; (255,0,0) → alpha 1, rgb (255,0,0); (200,180,180) → alpha 75/255, rgb (255,0,0).
    - `rgbaToHex`: lower-case `#rrggbb`, zero-padded, channels clamped and rounded.
    - Picker state: defaults false/false; `setAquarellePickerAltHeld(true)` then `disarmAquarellePicker()` → both false; a repeated same-value set does not change the value; `toggleAquarellePickerLatched()` twice returns to false.
  </behavior>
  <action>
(This is the plan's tracer: the first vertical slice that reaches a user-visible result — hold Alt, click the canvas, the swatch and the next stroke take the sampled color. Build it for keeps; write the test file FIRST (RED), then the module and the wiring (GREEN).)

REQUIREMENT PICK-SAMPLE-COMPOSITE + PICK-ALT-TEMPORARY. Create `app/src/components/physic-paint/view/aquarelleColorPicker.ts` (module-level signals + pure color law + the ONE DOM sampler; NO imports from the Studio, `aquarelleRecordState`, or `aquarelleStrokeSelection` — those import this module, never the reverse):
- `export const aquarellePickerLatched = signal(false);` and `export const aquarellePickerAltHeld = signal(false);` — session-only UI state, never persisted.
- `export const aquarellePickerActive = computed(() => aquarellePickerLatched.value || aquarellePickerAltHeld.value);` (subscribe with `.value` inside the computed).
- `setAquarellePickerLatched(next)` / `setAquarellePickerAltHeld(next)`: compare-then-write against `.peek()` (efx-preact-reactivity rule 3).
- `toggleAquarellePickerLatched()`: flips the latched signal.
- `disarmAquarellePicker()`: compare-then-write both signals to false.
- `isAquarellePickerArmed(): boolean` → `aquarellePickerActive.peek()` — the stable dispatch-time probe event handlers call (never a value peeked in a render body).
- Color law (all pure, exported for the test):
  - `export interface PickRgba { r: number; g: number; b: number; a: number }` — channels 0..255, `a` 0..1 straight alpha.
  - `export const PICK_MIN_ALPHA = 0.02;`
  - `export function compositeRgbaOver(base: PickRgba, top: PickRgba): PickRgba` — straight-alpha source-over: `a = top.a + base.a*(1-top.a)`; each channel `(top.c*top.a + base.c*base.a*(1-top.a))/a`; `a <= 0` returns `{r:0,g:0,b:0,a:0}`.
  - `export function compositePickLayers(layers: ReadonlyArray<PickRgba | null>): PickRgba` — folds bottom→top with `compositeRgbaOver`, skipping nulls, starting from `{0,0,0,0}`.
  - `export function transmittancePixelToPigment(r: number, g: number, b: number): PickRgba` — the `rasterAlpha.ts` law above (`min === 255` → `{r:0,g:0,b:0,a:0}`; otherwise `alpha = (255-min)/255` and each pigment channel `(c-min)/alpha`, clamped 0..255).
  - `export function rgbaToHex(color: PickRgba): string` — round + clamp each channel, two lower-case hex digits, prefixed `#`.
- DOM sampler:
  - `function sampleCanvasAtUv(canvas: HTMLCanvasElement | null, u: number, v: number): PickRgba | null` — `null` canvas → null; `px = clamp(floor(u*canvas.width), 0, width-1)`, same for `py`; `try { const ctx = canvas.getContext('2d', { willReadFrequently: true }); if (!ctx) return null; const d = ctx.getImageData(px, py, 1, 1).data; return {r:d[0], g:d[1], b:d[2], a:d[3]/255}; } catch { return null; }`. Never log.
  - `export function sampleAquarelleStackColor(input: { stack: HTMLElement; clientX: number; clientY: number; paintCanvas: HTMLCanvasElement | null }): string | null`:
    1. `const shell = stack.querySelector<HTMLElement>('.demo-canvas-shell') ?? stack;` → `getBoundingClientRect()`; width/height <= 0 → null; `u = (clientX-left)/width`, `v = (clientY-top)/height`; outside 0..1 → null.
    2. Build the layer list in THIS exact order: `.physics-paint-fond-layer canvas`; `.physics-paint-program-monitor:not(.physics-paint-program-monitor-above) canvas`; `.demo-canvas-shell .aquarelle-cached-base`; the caller's `paintCanvas` (engine export — convert its pixel with `transmittancePixelToPigment` instead of reading its alpha); `.physics-paint-program-monitor-above canvas`. Query within `stack`.
    3. `const composed = compositePickLayers(layers);` → `composed.a < PICK_MIN_ALPHA ? null : rgbaToHex(composed)`.

REQUIREMENT PICK-ALT-TEMPORARY (hook). Create `app/src/components/physic-paint/hooks/useAquarelleColorPicker.ts`:
- `export function useAquarelleColorPicker(): void` with ONE `useEffect(..., [])`: first `disarmAquarellePicker()`; then `window.addEventListener('keydown', ...)` (`event.key === 'Alt'` → `setAquarellePickerAltHeld(true)`), `'keyup'`, `'blur'` (→ false), and `document.addEventListener('visibilitychange', ...)` (→ false when `visibilityState === 'hidden'`). Cleanup removes every listener and calls `disarmAquarellePicker()`. No state, no signal read, no render-body write.

REQUIREMENT PICK-CONSUME-INPUT (view). In `app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx`:
- Add to `PhysicsPaintCanvasStackViewProps`, beside `onInputIntent`: `onColorPick?: (event: PointerEvent, stack: HTMLElement) => boolean;` with a doc comment: "261030-cnq: the color picker. Returns true when the press was a pick and MUST NOT reach the Roto edit intent or any paint listener under this capture target."
- Replace the stack div's handler with this exact shape (keeping the surrounding attributes unchanged):
```tsx
onPointerDownCapture={(event) => {
  // 261030-cnq: the picker consumes the press at the capture phase — before
  // beginRotoFrameEdit and before the engine/stroke-overlay listeners below.
  if (props.onColorPick?.(event, event.currentTarget as HTMLElement)) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  props.onInputIntent?.(event);
}}
```
- In the shortcuts help aside (~line 456), append to the existing first span: ` · I picker · hold Alt to pick temporarily`.

REQUIREMENT PICK-COMMIT-COLOR (Studio). In `app/src/components/physic-paint/PhysicsPaintStudio.tsx`:
- Import `{ isAquarellePickerArmed, sampleAquarelleStackColor }` from `./view/aquarelleColorPicker` and `{ useAquarelleColorPicker }` from `./hooks/useAquarelleColorPicker`; call `useAquarelleColorPicker();` once in the component body beside the other Studio hooks (near the `usePhysicsPaintStudioKeyboard` call at ~5444, and BELOW the `aquarelleEnginePortRef` declaration at 664).
- Add this handler beside `handleSelectAquarelleTool` (~2401):
  - Guards, in order, returning `false` (do not consume): `!isAquarellePickerArmed() && !event.altKey`; `event.button !== 0`; `aquarelleSelectMode.peek()` (Select owns Alt — the stroke-delete law); `isPlaying`.
  - Resolve the paint canvas in a try/catch: `aquarelleEnginePortRef.current?.exportCanvas('transparent', false) ?? null` (a throwing/unavailable port yields null, never a crash).
  - `const hex = sampleAquarelleStackColor({ stack, clientX: event.clientX, clientY: event.clientY, paintCanvas });`
  - When `hex !== null`: `handleActiveColorChanged(hex); paintStore.setForeground(hex);` — the SAME pair as the right-panel color law. When null: change nothing.
  - Return `true` in every picker-armed case (an empty sample must still never paint).
  - `handleActiveColorChanged` is the only dependency (identity-stable useCallback).
- Pass it into the canvas-stack memo: add `handleAquarelleColorPick` to the `canvasStackPropsMemo.resolve([...], ...)` dependency array (`:8443`) and emit `onColorPick: handleAquarelleColorPick,` in the returned props object beside `onInputIntent: beginRotoFrameEdit`.

TESTS (REQUIREMENT PICK-SAMPLE-COMPOSITE). Create `app/src/components/physic-paint/view/aquarelleColorPicker.test.ts` covering every `<behavior>` bullet (reset both signals in `beforeEach`). Add TWO wiring pins with `readFileSync(resolve(__dirname, ...))`: `PhysicsPaintStudioView.tsx` contains the literal `if (props.onColorPick?.(event, event.currentTarget as HTMLElement))`; `PhysicsPaintStudio.tsx` contains the literal `onColorPick: handleAquarelleColorPick`.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/aquarelleColorPicker.test.ts && pnpm --filter efx-motion-editor run typecheck</automated>
  </verify>
  <done>With the Studio focused, holding Alt and clicking the canvas sets both the rail swatch and the engine color to the visible pixel under the cursor, no stroke and no auto-key is produced by that press, and releasing Alt leaves the previously active paint tool in force; the picker suite and the app typecheck are green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Left-rail Picker button, `I` shortcut, and the disarm laws</name>
  <files>
    app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx,
    app/src/components/physic-paint/view/aquarelleRecordState.ts,
    app/src/components/physic-paint/view/aquarelleStrokeSelection.ts,
    app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts,
    app/src/components/physic-paint/view/physicsPaintStudioKeyboard.test.ts,
    app/src/components/physic-paint/view/aquarelleColorPicker.test.ts
  </files>
  <behavior>
    - Bare `i` calls `toggleAquarellePicker` once and calls `preventDefault`; `Shift+I` and any meta/ctrl chord never call it.
    - `setAquarelleTool(tool)` disarms a latched picker even when `tool` already equals the active tool (the equality early-return must not swallow the disarm), and the active tool value itself stays compare-then-write.
    - `setAquarelleSelectMode(true)` disarms a latched picker; `setAquarelleSelectMode(false)` leaves it untouched.
  </behavior>
  <action>
REQUIREMENT PICK-RAIL-TOOL. In `app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx`:
- Import `{ Pipette }` from `lucide-preact` (extend the existing lucide import line) and `{ aquarellePickerActive, toggleAquarellePickerLatched }` from `./aquarelleColorPicker`.
- In `WatercolorRail`, beside the existing `active` / `selectActive` body reads, add `const pickerActive = aquarellePickerActive.value;` (leaf subscription — same law as `aquarelleActiveTool.value`).
- Change the mapped tool buttons' active law to `const isActive = !selectActive && !pickerActive && active === id;` so the paint tool renders deselected while the picker is armed (it returns on release — "back to the previous tool").
- Render ONE new button AFTER the `WATERCOLOR_RAIL_TOOLS.map(...)` block and BEFORE the Select toggle:
```tsx
<button
  type="button"
  class={`physics-paint-icon-button${pickerActive ? ' active' : ''}`}
  data-testid="aquarelle-picker-toggle"
  disabled={disabled}
  title="Picker (I) — click the canvas to sample the color under the cursor · hold Alt for a temporary picker"
  aria-label="Picker"
  aria-pressed={pickerActive}
  onClick={() => {
    setAquarelleSelectMode(false);
    toggleAquarellePickerLatched();
  }}
>
  <Pipette size={18} />
</button>
```
Do NOT add the picker to `WATERCOLOR_RAIL_TOOLS`, `AquarelleTool`, or any engine union.

REQUIREMENT PICK-DISARM. In `app/src/components/physic-paint/view/aquarelleRecordState.ts`:
- Import `{ disarmAquarellePicker }` from `./aquarelleColorPicker` (one-way import; the picker module never imports this file).
- Rewrite `setAquarelleTool` to call `disarmAquarellePicker();` FIRST, then keep the existing compare-then-write (`if (aquarelleActiveTool.value === tool) return; aquarelleActiveTool.value = tool;`). Doc comment: a paint-tool pick leaves the picker; the disarm precedes the equality return so a same-tool pick still leaves it.

In `app/src/components/physic-paint/view/aquarelleStrokeSelection.ts`:
- Import `{ disarmAquarellePicker }` from `./aquarelleColorPicker`.
- In `setAquarelleSelectMode`, when `on` is true, call `disarmAquarellePicker();` before `setScriptSelectMode(on)` (entering Move/Edit leaves the picker; exiting does not arm it).

REQUIREMENT PICK-RAIL-TOOL (shortcut). In `app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts`:
- Add to `PhysicsPaintStudioKeyboardActions`: `/** Bare I: latch/unlatch the color picker (261030-cnq). */ toggleAquarellePicker?: () => void;`
- In the bare-key branch (the `!meta && !event.altKey && !event.shiftKey && !event.repeat` block, ~line 354), after the B/W/E/P branch add: `if (key === 'i' && actions.toggleAquarellePicker) { event.preventDefault(); actions.toggleAquarellePicker(); return; }`.

In `app/src/components/physic-paint/PhysicsPaintStudio.tsx`:
- Add `const handleToggleAquarellePicker = useCallback(() => { setAquarelleSelectMode(false); toggleAquarellePickerLatched(); }, []);` beside `handleSelectAquarelleTool`, import `toggleAquarellePickerLatched` from `./view/aquarelleColorPicker`, and add `toggleAquarellePicker: handleToggleAquarellePicker,` to the keyboard actions literal (~5496).

TESTS.
- `app/src/components/physic-paint/view/physicsPaintStudioKeyboard.test.ts`: add `toggleAquarellePicker: vi.fn()` to the shared `actions()` helper; add cases for the three `<behavior>` keyboard bullets; keep every existing case untouched.
- `app/src/components/physic-paint/view/aquarelleColorPicker.test.ts`: add the two state law cases from `<behavior>` (tool pick disarm, Select-entry disarm) — import `setAquarelleTool`, `aquarelleActiveTool` from `./aquarelleRecordState` and `setAquarelleSelectMode`, `aquarelleSelectMode` from `./aquarelleStrokeSelection`, resetting them after each case. Add ONE wiring pin: `PhysicsPaintToolRail.tsx` contains the literal `data-testid="aquarelle-picker-toggle"`.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/aquarelleColorPicker.test.ts src/components/physic-paint/view/physicsPaintStudioKeyboard.test.ts && pnpm --filter efx-motion-editor run typecheck</automated>
  </verify>
  <done>The left rail shows a Picker button that latches the picker and deselects the paint tool buttons; pressing I toggles the same latch; B/W/E/P and entering Move/Edit both leave the picker; both focused suites and the app typecheck are green.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| project media canvases → host color readback | The picker reads pixels back from canvases fed by project files (Background photo, photo reference, tracks). Media arrives as same-origin blob URLs produced from disk bytes; no network origin crosses this boundary. |
| sampled pixel → CSS color / engine color | The sampled value becomes a CSS `backgroundColor` and the engine's `settings.color`. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261030-01 | Information Disclosure | `sampleCanvasAtUv` pixel readback | low | accept | Reads only the Studio's own layered canvases, fed by same-origin blob URLs. Any tainted/unreadable canvas throws and is swallowed to `null` — no image data leaves the process and nothing is logged. |
| T-261030-02 | Tampering | sampled value → CSS / engine color | medium | mitigate | The ONLY value that reaches `paintStore.setForeground` / `handleActiveColorChanged` is `rgbaToHex` output: rounded, clamped, lower-case `#rrggbb`. Raw sampled strings never reach a style or the engine. Pinned by unit test. |
| T-261030-03 | Denial of Service | `exportCanvas` readback per click | low | mitigate | The pick runs only on pointerdown (button 0) while the picker is armed — never on pointermove — and is inert during Select mode and playback. |
| T-261030-SC | Tampering | npm/pip/cargo installs | high | mitigate | No dependency is added or upgraded (the `Pipette` icon comes from the already-installed `lucide-preact`); the package-legitimacy gate is not triggered. |
</threat_model>

<verification>
Run from the checkout root (never watch mode):

1. `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/aquarelleColorPicker.test.ts src/components/physic-paint/view/physicsPaintStudioKeyboard.test.ts` — focused suites green.
2. `pnpm --filter efx-motion-editor run typecheck` — clean.
3. Before declaring the quick complete: `pnpm --filter efx-motion-editor exec vitest run` (full app suite, zero failures). Long gate — run in the background and resume on success.

Native UAT rows (report as pending until the user confirms; automated-green is NOT UAT-green):
- UAT-1 Hold Alt over the photo Background, click: the rail swatch and the next Brush stroke take that color; release Alt and a drag paints with the previous tool.
- UAT-2 Hold Alt over a semi-transparent wash painted over the photo: the picked color matches the visible pixel (not the raw pigment, not the bare photo).
- UAT-3 Click the rail Picker button: it lights, the paint tool buttons go unlit, clicks sample without Alt; press B (or click Picker again) and Brush is active again.
- UAT-4 With the picker armed, a press on an EMPTY blank key picks the paper color and creates no Roto key and no stroke.
- UAT-5 In Move/Edit (Select), Alt+click a stroke still deletes it (the picker is inert there).
- UAT-6 Hold Alt and switch away from the Studio (Cmd+Tab): back in the Studio the next click paints, never picks.
- UAT-7 Pick on a track above the active one (above-monitor slice) returns that track's visible color.
</verification>

<success_criteria>
- The picker is a host-level sampling tool: it never enters `AquarelleTool`, `AQUARELLE_TOOLS` or `WATERCOLOR_RAIL_TOOLS`, and never changes `aquarelleActiveTool` — releasing Alt or unlatching is literally "back to the previous tool".
- One sampling law for every pick: fond → below monitor → cached base → live engine export (transmittance→pigment) → above monitor, straight-alpha over bottom→top, empty composite rejected by `PICK_MIN_ALPHA`.
- Every pick is consumed at the canvas-stack CAPTURE phase before `beginRotoFrameEdit` and before the engine/overlay listeners — no stroke, no auto-key.
- Both color surfaces are written with the same normalized hex via the existing right-panel law (`handleActiveColorChanged` + `paintStore.setForeground`).
- The rail Picker button, the `I` shortcut and the Alt hold all drive the same two signals with compare-then-write setters; no signal writes in a render body; no `useState` added.
- Focus loss/hide cannot leave a stuck temporary picker.
- `261030-cnq-SUMMARY.md` records the locked decisions (picker is not a paint tool; Select owns Alt; pointerdown-only sampling; engine export with `texture=false` as the live-sheet readback), the commands run, and the seven native UAT rows as PENDING (never claim UAT passed).
</success_criteria>

<output>
Create `.planning/quick/261030-cnq-pick-a-color-from-the-photo-background-o/261030-cnq-SUMMARY.md` when done. It must record: the two-signal picker state and the disarm choke points (`setAquarelleTool`, `setAquarelleSelectMode(true)`, window blur/hide); the sampling layer order and the transmittance→pigment conversion for the engine export; the captured test commands; and the seven native UAT rows marked PENDING.
</output>
