---
phase: 261029-lel
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/efx-watercolor/src/playground/wetState.ts
  - packages/efx-watercolor/src/playground/wetState.test.ts
  - packages/efx-watercolor/src/playground/Engine.ts
  - app/src/components/physic-paint/view/aquarelleWetPaintGate.ts
  - app/src/components/physic-paint/view/aquarelleWetPaintGate.test.ts
  - app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx
  - app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx
  - app/src/components/physic-paint/view/AquarelleToolRow.tsx
  - app/src/components/physic-paint/view/AquarelleToolRow.test.tsx
  - app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts
  - app/src/components/physic-paint/view/physicsPaintStudioKeyboard.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
autonomous: true
requirements:
  - WATER-GATE-ENGINE
  - WATER-GATE-SIGNAL
  - WATER-GATE-RAIL
  - WATER-GATE-ROW
  - WATER-GATE-SHORTCUT
  - WATER-FEASIBILITY-NOTE
user_setup: []

estimate:
  # Per-task projection at execution-turn boundaries — each task ends with its
  # own commit and the next task re-reads ONLY its own files:
  #   Task 1 (package wet predicate + Engine getter + build):      12000
  #   Task 2 (host gate + live publisher + rail, end-to-end):      20000
  #   Task 3 (tool row + W shortcut + test updates):               16000
  #   Sum: 48000 < workflow.smart_zone_tokens (100000).
  # Calibration factor 1.0 (estimate-calibration returned no sample data ->
  # confidence low). No large source-scan suite is read whole: the Studio
  # (5.6k+ lines) is edited at named anchors only.
  tokens: 48000
  raw_tokens: 48000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "The Water tool in the left watercolor rail is interactive ONLY while the live sheet holds standing water; Brush, Pen and Eraser keep the exact disabled semantics they have today (the frame/session `disabled` prop only)."
    - "The four-tool row (AquarelleToolRow) applies the same gate: its Water button carries the disabled attribute and refuses the click while the sheet is dry; the other three entries never read the gate."
    - "After a completed Brush/Water/Pen stroke the rail's Water button is enabled within one animation frame of pointer-up; pressing Dry (F) greys it within one frame; the automatic settle-cap dry greys it within one frame of the fix starting."
    - "Navigating to a script key or to a raster key greys Water: the live sheet is cleared on the frame change, so no wet field survives the navigation."
    - "The W shortcut is a silent no-op while the gate is closed and selects Water while it is open; B, E and P are never gated."
    - "The gate can never flip during a stroke: the publisher samples only while no stroke is in flight (`painting === false`). When standing water disappears while Water is the active tool, the active tool falls back to Brush in the same compare-then-write transition."
    - "`Engine.isAwake` is NOT the wet signal (it is also true during the Dry fix bake, the post-stroke min-awake window and an in-flight stroke). The signal is the new `Engine.hasStandingWater` getter: wetPeak above WET_THRESHOLD, not fixing, before wetUntil."
  artifacts:
    - packages/efx-watercolor/src/playground/wetState.ts
    - packages/efx-watercolor/src/playground/Engine.ts
    - app/src/components/physic-paint/view/aquarelleWetPaintGate.ts
    - app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx
    - app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx
    - app/src/components/physic-paint/view/AquarelleToolRow.tsx
    - .planning/quick/261029-lel-grey-out-the-water-aquarelle-tool-whenev/261029-lel-SUMMARY.md
  key_links:
    - "Engine.hasStandingWater -> AquarelleCanvasLayer rAF tick (only when !painting) -> setAquarelleHasWetPaint -> aquarelleHasWetPaint -> rail Water entry `disabled` + tool-row Water entry `disabled` + `canSelectWater()` in the keyboard dispatch"
    - "Dry sink -> engine.fix() -> fixTimer > 0 -> hasStandingWater false -> next tick publishes false -> Water greyed"
    - "Frame change -> engine.clear() -> resetPaintState (wetPeak = 0) -> next tick publishes false -> Water greyed on script and raster keys"
---

<objective>
Grey out the Water (aquarelle) tool on the two paint-tool surfaces and on the W shortcut whenever the live sheet holds no standing water — after an explicit Dry, after the automatic settle-cap dry, and on script keys and raster keys — while Brush/Pen/Eraser keep their current gating unchanged.

Purpose: Water only blends live standing water. Offering it on a settled sheet or on baked script/raster pixels is a dead control: the click can only paint water into a sheet that will never blend it.

Output: a new `Engine.hasStandingWater` getter (package), a host-visible `aquarelleHasWetPaint` signal published by the live canvas layer at stroke boundaries, `disabled` plumbing on the left rail and the four-tool row, a `canSelectWater` gate in the keyboard dispatch, updated unit/render tests, and a `261029-lel-SUMMARY.md` carrying the required feasibility note (why Water cannot act on script/raster/cached pixels without new payload/replay or wet-field seeding).
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md
@.claude/skills/efx-preact-reactivity/SKILL.md

Quick task: 261029-lel — grey out the Water (aquarelle) tool whenever the current sheet has no wet paint. No CONTEXT.md / RESEARCH.md exists for this quick; the description below IS the user decision (verbatim intent):
"Grey out the Water (aquarelle) tool whenever the current sheet has no wet paint — script keys, raster keys, and after Dry (F) or auto-dry. Water only works on live standing water. Apply to the four-tool row (AquarelleToolRow), the left WatercolorRail tools, and the W shortcut; reuse the existing `disabled` plumbing and add a host-visible has-wet-paint signal (adapter already exposes isAwake(); engine tracks wetPeak/wetMask). Guardrails: Brush/Pen/Eraser gating unchanged; the gate must not flip mid-stroke; no script/raster water physics in this quick. Add a short feasibility note to the recap explaining why Water cannot act on script/raster/cached pixels without new payload/replay or wet-field seeding. Native UAT rows: brush stroke → Water enabled; Dry or auto-dry → greyed; script key → greyed; raster key → greyed."

Verified scouting (planning-time, do not re-derive):
- `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx` builds the ONE live `WatercolorEngine` in a callback ref, runs a continuous rAF `tick`, holds the local `painting` flag (set in `onStrokeSample`, cleared in `onStrokeEnd`, also cleared by the frame-change branch), and already publishes a host signal from the same tick with a compare-then-write (`aquarelleLivePaint`, lines ~108 and ~833-835). This is the only place a wetness sample can come from.
- `Engine.isAwake` (packages/efx-watercolor/src/playground/Engine.ts:663-667) is `stroke !== null || fixTimer > 0 || now < minAwakeUntil || now < wetUntil()`. It is NOT "standing water": it is true throughout the Dry fix bake and during the min-awake window. Hence a dedicated getter.
- `createAquarelleEngineAdapter().isAwake()` (packages/efx-watercolor/src/adapter/engineAdapter.ts:259-261) is the BAKE's settle probe, not a host UI signal; the live layer does not use the adapter. Do not touch it.
- `app/src/components/physic-paint/view/AquarelleToolRow.tsx` is currently mounted NOWHERE in app source (only tests and `panelSplitShell.test.tsx` reference it, the latter asserting it stays unmounted). Update it for contract parity as instructed, but the LIVE surface for UAT is the left rail (`WATERCOLOR_RAIL_TOOLS` inside `PhysicsPaintToolRail.tsx`, which passes `disabled` today).
- Disabled styling already exists for both button families: `physicsPaintStudio.css:708-712` (`.physics-paint-icon-button:disabled, .physics-paint-segmented-button:disabled { opacity: .45; cursor: not-allowed }`). No CSS change is needed or wanted.
- Keyboard routing lives in `app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts` (bare B/W/E/P branch at ~line 322). The state object is rebuilt every Studio render, so a boolean peeked in the render body would be stale at keypress — the gate must be a stable function called at dispatch time.
- App `tsconfig.json` has NO path mapping for `@efxlab/efx-watercolor`: `pnpm --filter efx-motion-editor run typecheck` resolves the package through `dist/index.d.ts`. The package MUST be rebuilt after the Engine getter lands. Vite/vitest resolve the app runtime through the `vite.config.ts` alias to source, so the live app needs no rebuild, but typecheck does.
- `app/vitest.config.ts` collects `src/**/*.test.ts` only. The render suite for the tool row is `AquarelleToolRow.test.tsx`, reached through the existing launcher `AquarelleToolRow.test.tsx.test.ts` — run the launcher, never the `.tsx` path.

Locked signal decision (state it verbatim in the SUMMARY): the wet signal is the NEW `Engine.hasStandingWater` getter backed by `wetPeak`/`wetUntil()`, with `fixTimer > 0` excluded; it is sampled once per live rAF tick in `AquarelleCanvasLayer` while `painting === false`; `isAwake()` is explicitly rejected as the wet truth.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Package wet predicate + `Engine.hasStandingWater` getter (rebuilt dist)</name>
  <files>
    packages/efx-watercolor/src/playground/wetState.ts,
    packages/efx-watercolor/src/playground/wetState.test.ts,
    packages/efx-watercolor/src/playground/Engine.ts
  </files>
  <action>
Create `packages/efx-watercolor/src/playground/wetState.ts` — the pure "standing water" truth. It owns the `WET_THRESHOLD = 0.004` constant that currently sits at `Engine.ts:159` (`const WET_THRESHOLD = 0.004;   // below this nothing moves, so the sim can sleep`) and exports one predicate:

`export function isSheetWet(state: { wetPeak: number; wetUntilMs: number; nowMs: number; fixing: boolean }): boolean`

Body: `return !state.fixing && state.wetPeak > WET_THRESHOLD && state.nowMs < state.wetUntilMs;` (any equivalent single-expression form is fine, but keep all three conditions). Doc comment must state: this is the host-visible "the Water tool can act here" truth; `Engine.isAwake` is deliberately NOT reused because it also reports the Dry fix bake (`fixTimer > 0`), the post-stroke min-awake window and an in-flight stroke — those answer "does the sim need frames", not "is there water".

Edit `packages/efx-watercolor/src/playground/Engine.ts`:
- Delete the local `const WET_THRESHOLD = 0.004;` line and add `import { WET_THRESHOLD, isSheetWet } from './wetState';` with the other local imports at the top. Every existing reference (`wetUntil`, the wet-mask shader uniform at ~2074, `step`) keeps compiling unchanged.
- Add a public getter immediately AFTER `get isAwake()` (~line 667), so the two live side by side:

`get hasStandingWater(): boolean { return isSheetWet({ wetPeak: this.wetPeak, wetUntilMs: this.wetUntil(), nowMs: this.clock(), fixing: this.fixTimer > 0 }); }`

Doc comment: "True while the sheet holds standing water the Water tool can act on — the live UI gate's source of truth. False during the Dry fix bake even though `isAwake` is still true." No other member changes; do not expose `wetPeak` or `wetUntil`.

Create `packages/efx-watercolor/src/playground/wetState.test.ts` (vitest) pinning: (a) `fixing: true` with a huge wetPeak -> false; (b) wetPeak exactly 0.004 -> false, 0.005 -> true; (c) `nowMs === wetUntilMs` -> false, `nowMs` one ms below -> true; (d) a fresh/cleared sheet (`wetPeak: 0`, `wetUntilMs: -Infinity`) -> false even with `nowMs: 0`.
  </action>
  <verify>
    <automated>pnpm --filter @efxlab/efx-watercolor exec vitest run src/playground/wetState.test.ts && pnpm --filter @efxlab/efx-watercolor run check && pnpm --filter @efxlab/efx-watercolor build</automated>
  </verify>
  <done>The package exposes `isSheetWet` and `Engine.hasStandingWater`; the new unit test is green; the package typecheck is clean; `dist/` is rebuilt so the app's `tsc --noEmit` can resolve the new getter.</done>
</task>

<task type="tracer">
  <name>Task 2: End-to-end wet gate — engine getter → live rAF publisher → host signal → left rail Water button</name>
  <files>
    app/src/components/physic-paint/view/aquarelleWetPaintGate.ts,
    app/src/components/physic-paint/view/aquarelleWetPaintGate.test.ts,
    app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx,
    app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx
  </files>
  <action>
(This is the plan's tracer: task 1 was a package-only primitive with no user-visible path; this task is the first vertical slice that reaches a surface — engine truth, host signal, publisher, and the visible rail button. Build it for keeps.)

REQUIREMENT WATER-GATE-SIGNAL. Create `app/src/components/physic-paint/view/aquarelleWetPaintGate.ts` — the ONE host-visible wet-paint store:
- `export const aquarelleHasWetPaint = signal(false);` (`signal` from `@preact/signals`), doc-noted as session/live-sheet state, never persisted.
- `export function setAquarelleHasWetPaint(next: boolean): void` — compare-then-write against `aquarelleHasWetPaint.peek()` (efx-preact-reactivity rule 3: a same-value publish must not wake subscribers), then, ONLY on a true -> false transition, if `aquarelleActiveTool.peek() === 'water'` call `setAquarelleTool('brush')` (a Water tool cannot stay active on a sheet with nothing to blend; same precedent as the Select disarm).
- `export function clearAquarelleWetPaint(): void` — compare-then-write to false WITHOUT the tool fallback; used by engine teardown.
- `export function aquarelleWaterAvailable(): boolean` — returns `aquarelleHasWetPaint.peek()`; this stable module-level function is what the keyboard state will hold (never a peeked boolean captured in a render body).
Import `aquarelleActiveTool` and `setAquarelleTool` from `./aquarelleRecordState`. No other imports; no DOM, no engine, no hooks.

REQUIREMENT WATER-GATE-SIGNAL (publisher). In `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx`:
- Import only `{ clearAquarelleWetPaint, setAquarelleHasWetPaint }` from `../view/aquarelleWetPaintGate` (the layer never reads the signal).
- In the rAF `tick`, immediately BEFORE `raf = requestAnimationFrame(tick);`, after the existing `const painted = engine.hasPaint;` block, add exactly this guarded publish: `if (!painting) setAquarelleHasWetPaint(engine.hasStandingWater);`. The `!painting` guard is the "never flip mid-stroke" law — `painting` is the callback-closure flag already set by `onStrokeSample` and cleared by `onStrokeEnd` and by the frame-change branch, so a stroke in flight is never sampled, and a stroke end publishes on the very next frame (the tick is continuous: it always re-schedules).
- In the callback-ref cleanup (`cleanupRef.current`), beside the existing `aquarelleLivePaint.value = false;`, add `clearAquarelleWetPaint();`. No other publication site: do not add an effect, do not publish on pointer events, do not publish from the Studio.

REQUIREMENT WATER-GATE-RAIL. In `app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx`:
- Import `{ aquarelleHasWetPaint }` from `./aquarelleWetPaintGate`.
- In `WatercolorRail`, next to the existing `const active = aquarelleActiveTool.value;` body read, add `const wetAvailable = aquarelleHasWetPaint.value;` (a body read in this leaf component is the sanctioned subscription — the `preact/compat memo` on the outer rail does not block a child's own signal subscription; `aquarelleActiveTool` already relies on this).
- On the mapped tool buttons, replace `disabled={disabled}` with exactly: `disabled={disabled || (id === 'water' && !wetAvailable)}`.
- Gate the click as defense in depth (a programmatic or test-invoked handler must not select Water while dry): at the top of the existing `onClick`, `if (id === 'water' && !aquarelleHasWetPaint.peek()) return;` before `setAquarelleSelectMode(false)`.
- Tooltip: when the gate is closed on the Water entry, `title` becomes exactly `Water (W) — needs standing water`; every other case keeps the existing `${label} (${shortcut})` / `label` expression. Leave `aria-label={label}` and `aria-pressed` untouched. Brush/Pen/Eraser must keep `disabled={disabled}` semantics through the same expression (the `id === 'water'` clause is the only new condition).

REQUIREMENT WATER-GATE-RAIL (tests). Create `app/src/components/physic-paint/view/aquarelleWetPaintGate.test.ts`:
- Store behavior: default false; `setAquarelleHasWetPaint(true)` then `setAquarelleHasWetPaint(false)` flips; a repeated same-value set leaves the value unchanged; `aquarelleWaterAvailable()` mirrors the signal.
- Fallback: `setAquarelleTool('water')` then `setAquarelleHasWetPaint(false)` -> `aquarelleActiveTool.value === 'brush'`; with `'pen'` active the same call leaves `'pen'`; `clearAquarelleWetPaint()` never mutates the tool. Reset the store and the tool in `beforeEach`/`afterEach` so the file is order-independent.
- Wiring contracts (read the sources with `readFileSync(resolve(__dirname, ...))`, the repo's established pin style): `PhysicsPaintToolRail.tsx` contains the exact literal `disabled={disabled || (id === 'water' && !wetAvailable)}` and the literal `aquarelleHasWetPaint.peek()` inside the water click guard; `AquarelleCanvasLayer.tsx` contains `if (!painting) setAquarelleHasWetPaint(engine.hasStandingWater)` and `clearAquarelleWetPaint();` (strip comments before the negative half of any scan you add). Both literals must be authored EXACTLY as written here.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/aquarelleWetPaintGate.test.ts && pnpm --filter efx-motion-editor run typecheck</automated>
  </verify>
  <done>A completed stroke publishes `true` within one frame and the rail's Water button becomes enabled; Dry/auto-dry/frame-change publish `false` and the button greys within one frame; no publication happens while a stroke is in flight; the gate test and the app typecheck are green.</done>
</task>

<task type="auto">
  <name>Task 3: Four-tool row gate + W shortcut gate (and their tests)</name>
  <files>
    app/src/components/physic-paint/view/AquarelleToolRow.tsx,
    app/src/components/physic-paint/view/AquarelleToolRow.test.tsx,
    app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts,
    app/src/components/physic-paint/view/physicsPaintStudioKeyboard.test.ts,
    app/src/components/physic-paint/PhysicsPaintStudio.tsx
  </files>
  <action>
REQUIREMENT WATER-GATE-ROW. In `app/src/components/physic-paint/view/AquarelleToolRow.tsx`:
- Import `{ aquarelleHasWetPaint }` from `./aquarelleWetPaintGate`.
- Read `const wetAvailable = aquarelleHasWetPaint.value;` in the component body beside the existing `active` / `selectActive` reads.
- On each mapped button add `disabled={id === 'water' && !wetAvailable}` — the attribute must be present and true ONLY for Water, false/absent for Brush/Pen/Eraser.
- In the existing `onClick`, before `setAquarelleSelectMode(false)`, add `if (id === 'water' && !aquarelleHasWetPaint.peek()) return;`.
- When the Water entry is gated, `title` becomes exactly `Water (W) — needs standing water`; every other title keeps the current expression. No inline styling changes: the shared `.physics-paint-segmented-button:disabled` rule already supplies the greyed look, and `aria-pressed` keeps its current semantics.

REQUIREMENT WATER-GATE-SHORTCUT. In `app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts`:
- Extend `PhysicsPaintStudioKeyboardState` with `canSelectWater?: () => boolean;` (doc: "Evaluated at keypress time — the live sheet must hold standing water for the W tool. A function, never a captured boolean: the state literal is rebuilt per Studio render and a peeked value would be stale.").
- In the bare B/W/E/P branch (~line 322), keep `event.preventDefault();` first (the key is consumed either way), then add `if (key === 'w' && state.canSelectWater && !state.canSelectWater()) return;` BEFORE the `actions.selectAquarelleTool(...)` call. B/E/P must never consult the function.
- `PhysicsPaintStudio.tsx`: import `{ aquarelleWaterAvailable }` from `./view/aquarelleWetPaintGate`, and add `canSelectWater: aquarelleWaterAvailable,` inside the keyboard state literal passed to `usePhysicsPaintStudioKeyboard` (~line 5155-5168, beside `hasSelectedSoundClip`). Do NOT change `handleSelectAquarelleTool` — the gate lives in the dispatch so the keyboard unit test owns it.

TESTS (update, never delete a case for convenience):
- `app/src/components/physic-paint/view/AquarelleToolRow.test.tsx`: the existing case "selecting a tool sets exactly one active" clicks the Water button and expects `aquarelleActiveTool.value === 'water'` — with the gate closed that click is now refused. Set `setAquarelleHasWetPaint(true)` at the start of that case and restore false in a `finally`. Add a new describe "Water gate (261029-lel)": with the gate false the Water button's `props.disabled === true`, invoking its `onClick` leaves `aquarelleActiveTool` unchanged, and Brush/Pen/Eraser report `disabled` falsy; with the gate true the Water button reports `disabled` falsy and the click selects `'water'`; with the gate true and the tool reset, the gated title is absent (the plain `Water (W)` title explains nothing extra). Reset `aquarelleHasWetPaint` and the active tool between cases.
- `app/src/components/physic-paint/view/physicsPaintStudioKeyboard.test.ts`: in the existing "Studio tool shortcuts (B / W / E / A / D)" describe, add: `dispatch('w', canvas, {}, { canSelectWater: () => false })` -> `selectAquarelleTool` NOT called and `preventDefault` called; `{ canSelectWater: () => true }` -> called once with `'water'`; `dispatch('b', ..., { canSelectWater: () => false })` still selects `'brush'` (and the same for `e`/`p`). Existing W cases keep passing because an absent `canSelectWater` skips the gate — do not add a default to the shared `dispatch` helper. Add one wiring pin (read `../PhysicsPaintStudio.tsx` with `readFileSync`) asserting the literal `canSelectWater: aquarelleWaterAvailable` is present and that the file imports `aquarelleWaterAvailable` from `./view/aquarelleWetPaintGate`.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/AquarelleToolRow.test.tsx.test.ts src/components/physic-paint/view/physicsPaintStudioKeyboard.test.ts src/components/physic-paint/view/aquarelleWetPaintGate.test.ts && pnpm --filter efx-motion-editor run typecheck</automated>
  </verify>
  <done>The four-tool row and the W shortcut both refuse Water while the gate is closed and allow it while open; Brush/Pen/Eraser behavior is unchanged; the render suite (via its launcher), the keyboard suite and the gate suite are green; the app typecheck is clean.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| (none new) | This quick adds a local UI enablement gate fed by in-process engine state. No user input, network, filesystem, IPC or persistence path is added or modified. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261029-lel-01 | Tampering | Engine.hasStandingWater / live rAF publish | low | accept | Read-only arithmetic over private engine fields; no external input reaches it. A wrong value can only grey or enable a tool — the engine's own stroke path remains the authority, and no payload/format changes. |
| T-261029-lel-SC | Tampering | npm/pip/cargo installs | high | mitigate | No dependency is added or upgraded in this quick; the package-legitimacy gate is not triggered (verified at planning time: the change reuses in-repo modules only). |
</threat_model>

<verification>
Run from the checkout root (never watch mode):

1. `pnpm --filter @efxlab/efx-watercolor exec vitest run` — whole package suite green.
2. `pnpm --filter @efxlab/efx-watercolor run check` and `pnpm --filter @efxlab/efx-watercolor build` — package types and dist fresh.
3. `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/aquarelleWetPaintGate.test.ts src/components/physic-paint/view/AquarelleToolRow.test.tsx.test.ts src/components/physic-paint/view/physicsPaintStudioKeyboard.test.ts` — focused suites green.
4. `pnpm --filter efx-motion-editor run typecheck` — clean.
5. Before declaring the quick complete: `pnpm --filter efx-motion-editor exec vitest run` (full app suite, zero failures). This is a long gate — run it in the background and resume on success.

Native UAT rows (report as pending until the user confirms; automated-green is NOT UAT-green):
- UAT-1 Brush stroke on a real/blank key -> the left rail's Water button is enabled within a moment of pointer-up (the wet window is the settle cap: `aquarelleVisibleSettleTicks(dry)` ticks, ~2.75 s at Dry 50 — check promptly after the stroke).
- UAT-2 Press F (Dry) on that wet sheet -> Water greys immediately; repeat with a stroke left untouched until the automatic settle-cap dry -> Water greys at that moment. The active tool falls back to Brush if it was Water.
- UAT-3 Navigate to a key that owns a watercolor script -> Water is greyed (the live sheet was cleared, no wet field survived).
- UAT-4 Navigate to a raster-only key -> Water is greyed.
- UAT-5 With Water greyed, pressing W does nothing (the active tool does not change); with Water enabled, W selects it. B/E/P behave exactly as today. The greyed styling is the existing 45% opacity / not-allowed cursor on both button families.
</verification>

<success_criteria>
- Every one of the four tool surfaces is gated by the SAME host signal: the rail's Water entry, the four-tool row's Water entry, and the W dispatch; Brush/Pen/Eraser are untouched.
- The signal is published only from the live canvas layer's rAF tick while no stroke is in flight; no effect, no per-event publish, no render-body write.
- `Engine.isAwake` is not used as the wet truth; the new getter is the single source and is unit-pinned for threshold, fix and expiry boundaries.
- Gate transitions are compare-then-write, and the water -> brush fallback fires only on a true -> false transition.
- `261029-lel-SUMMARY.md` contains the feasibility note: standing water is engine-internal GPU state (`wetPeak`/`wetMask`) that the recorded payload does not carry; a script key's live sheet is cleared on navigation and its visible paint is the cached raster base, and a raster key is baked pixels, so there is no fluid for Water to act on. Making Water work there needs either a script replay/seek to an arbitrary tick plus wet-field seeding, or a wet-height payload in the script/package format — both engine/format work, explicitly out of scope for this quick.
</success_criteria>

<output>
Create `.planning/quick/261029-lel-grey-out-the-water-aquarelle-tool-whenev/261029-lel-SUMMARY.md` when done. It MUST include, under a `## Feasibility note — why Water cannot act on script/raster/cached pixels` heading, the explanation described in `<success_criteria>` (engine-internal wet field vs. recorded payload, cleared live sheet on navigation, cached raster base, and the two missing capabilities: replay/seek with wet-field seeding, or a wet-height payload). It must also record the locked signal decision (`Engine.hasStandingWater`, not `isAwake`), the sampling point (live rAF tick, `!painting`), the fallback rule, the test commands run, and the five native UAT rows as PENDING (never claim UAT passed).
</output>
