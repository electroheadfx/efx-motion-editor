---
phase: 261111-ucf-brush-picks-and-paint-controls-edit-the-
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/physic-paint/view/aquarellePaintControls.ts
  - app/src/components/physic-paint/view/aquarellePaintControls.test.ts
  - app/src/components/physic-paint/view/aquarelleStrokeSelection.ts
  - app/src/components/physic-paint/view/PhysicsPaintBrushMenu.tsx
  - app/src/components/physic-paint/view/PhysicsPaintBrushMenu.test.ts
  - app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx
  - app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts
  - app/src/components/physic-paint/view/BrushesDocker.tsx
  - app/src/components/physic-paint/view/BrushesDocker.test.tsx
  - app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx
  - app/src/components/physic-paint/view/PhysicsPaintTopBar.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx
  - app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts
  - app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx
  - app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts
  - app/src/components/physic-paint/view/BrushResponsePanel.tsx
  - app/src/components/physic-paint/view/BrushResponsePanel.test.ts
autonomous: true
requirements: [QUICK-261111-UCF]
user_setup: []

estimate:
  tokens: 72000
  raw_tokens: 72000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "Picking a brush while Select mode is armed with a selection keeps the live brush behaviour exactly as today (tip selected, tool back to Brush, menu/library closes) AND commits the picked brush id plus the live multiplier bag onto the selected paint strokes through the ONE appearance door — one undo entry, one revision bump, one seed re-roll."
    - "The committed multiplier bag is the bag the live brush carries AFTER the pick (a later brush remembers its own response), never the pre-pick bag: the pick order is selectAquarelleTip first, commit second."
    - "Lift (eraser) strokes are never addressed by a paint control: a mixed selection commits only its non-lift strokes, a lift-only selection is a no-attempt no-op while the live brush still changes, and no lift stroke ever receives a paint param or a multiplier bag from these surfaces."
    - "Every brush pick surface — the top-bar brush dropdown, the brush library cards, the docker rows and the import-success pick — routes through pickAquarelleBrush; the eraser branches keep setAquarelleLiftTipId and commit nothing."
    - "WatercolorBrushLibrary keeps Select mode and the selection armed when a non-empty selection exists, and still disarms Select mode on a pick when it does not (WR-03 preserved), so a pick can never silently clear an armed selection."
    - "A slider release on any of the five top-bar brush sliders (size, pigment, water, edges, grain), the Paint-tab size pair, any of the seven global rows and any Brush response row commits exactly ONE params or multiplier patch onto the selection at that release boundary; the continuous onChange stream, the live setters and every rendered value stay exactly as today."
    - "The globals Reset writes its seven live params as today and then commits ONE 7-key params patch, so a Reset is one undo entry, never seven."
    - "With no selection or with Select mode off every new commit is a no-attempt no-op (the port is never called) and every control behaves byte-identically to HEAD."
  artifacts:
    - path: "app/src/components/physic-paint/view/aquarellePaintControls.ts"
      provides: "pickAquarelleBrush, commitAquarelleSelectionParam, commitAquarelleSelectionParams, commitAquarelleSelectionMultiplier — the one selection seam every pick and paint control calls"
    - path: "app/src/components/physic-paint/view/aquarelleStrokeSelection.ts"
      provides: "The optional filter on commitAquarelleSelectionAppearance, forwarding only ids that match the live type filter and returning null when none remain"
    - path: "app/src/components/physic-paint/view/aquarellePaintControls.test.ts"
      provides: "Behavior fixtures for the pick order, the snapshot bag, the non-lift filtering, the no-attempt laws, the param/multiplier patch shapes, the clamp and the one-call Reset batch"
    - path: "app/src/components/physic-paint/view/PhysicsPaintBrushMenu.tsx"
      provides: "The top-bar dropdown brush branch routed through pickAquarelleBrush, lift branch unchanged"
    - path: "app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx"
      provides: "BrushCard: conditional Select-mode disarm plus pickAquarelleBrush, so an armed selection survives the pick"
    - path: "app/src/components/physic-paint/view/BrushesDocker.tsx"
      provides: "TipRow and the import-success pick routed through pickAquarelleBrush"
    - path: "app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx"
      provides: "TopBarSlider onCommit passthrough (clamped, undefined when absent) and the five brush slider commits; the Eraser cluster untouched"
    - path: "app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx"
      provides: "The Paint-tab brush size pair's release commit"
    - path: "app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx"
      provides: "Per-row release commits and the ONE 7-key Reset batch commit"
    - path: "app/src/components/physic-paint/view/BrushResponsePanel.tsx"
      provides: "Per-row multiplier release commits (one multiplier field per row)"
  key_links:
    - from: "app/src/components/physic-paint/view/aquarellePaintControls.ts"
      to: "app/src/components/physic-paint/view/aquarelleRecordState.ts"
      via: "pickAquarelleBrush calls selectAquarelleTip first and then reads aquarelleToolOverrides.peek(), so the forwarded bag is the bag the live brush now carries"
    - from: "app/src/components/physic-paint/view/aquarellePaintControls.ts"
      to: "app/src/components/physic-paint/view/aquarelleStrokeSelection.ts"
      via: "every commit calls commitAquarelleSelectionAppearance with filter 'paint', which resolves the registered port and snapshots the filtered ids"
    - from: "app/src/components/physic-paint/view/aquarelleStrokeSelection.ts"
      to: "app/src/components/physic-paint/PhysicsPaintStudio.tsx"
      via: "the registered applyAppearance forwards to handleAquarelleAppearanceStrokes and therefore beginAquarelleAppearanceEdit — one ledger edit, one bump, one seed re-roll"
    - from: "app/src/components/shared/SliderStepper.tsx"
      to: "app/src/components/physic-paint/view/aquarellePaintControls.ts"
      via: "the quick 261111-tul onCommit release boundary is the only trigger for a selection commit; onChange never commits"
---

<objective>
Make a brush pick and every paint-control release edit the SELECTED paint strokes, while the live brush and the live sliders keep their shipped behaviour exactly.

Purpose: quick 261111-t74 landed the selection edit port (`setAquarelleSelectionEditPort`, peek-only `aquarelleSelectionEditActive`, `commitAquarelleSelectionAppearance`) and quick 261111-tul landed `SliderStepper.onCommit`, but nothing calls either: a selection exists and every brush pick or slider still edits only the live brush. This quick adds the missing seam — one paint-controls module that every pick surface and every release boundary calls — so a pick or a release rewrites the selected strokes through the SAME one-edit/one-undo appearance door, with lift strokes never addressed and no selection always a no-op.

Output: `app/src/components/physic-paint/view/aquarellePaintControls.ts` with four exports, an optional `filter` on the selection commit, all four pick surfaces routed through the new pick, release commits on the top bar, the Paint tab, the seven global rows plus Reset-as-one-patch, and the eight Brush response rows, plus behavior fixtures and source pins. No Studio change: the port registration from 261111-t74 is already the far end.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.claude/skills/efx-preact-reactivity/SKILL.md

Anchors at HEAD `1ce179f3c` on `gsd/phase-61-vector-painting-tool` (quick 261111-t74 landed at be4118871, quick 261111-tul at 1ce179f3c):

- `app/src/components/physic-paint/view/aquarelleStrokeSelection.ts`
  - 126: `export type AquarelleStrokeTypeFilter = 'all' | 'paint' | 'lift';`
  - 181-188: `matchesAquarelleStrokeFilter(stroke: Pick<AquarelleStroke, 'tool'>, filter)` — 'paint' means "not a lift stroke". Same file, so the filter needs no new import.
  - 82-104: the `./aquarelleRecordState` import block already carries `getRecordedAquarelleStrokeEntries`; 19-33 the brushes import already carries `type AquarelleToolOverrides`. The filter needs no import change at all.
  - 628-683: the t74 selection edit block — `AquarelleSelectionEditPort`, the nullable module variable, `setAquarelleSelectionEditPort`, `aquarelleSelectionEditActive` (peek-only: Select mode on AND non-empty selection) and `commitAquarelleSelectionAppearance(patch)` at 676-683, which forwards `[...scriptSelectedStrokeIds.peek()]` and the patch to the registered port.
  - 332-371: `setAquarelleSelectMode(on, filter)` ends in `setScriptSelectMode(on)`; `app/src/components/physic-paint/view/scriptStrokeEdition.ts:330-340` clears the selection AND the drag/transform on off. That is why the library must not disarm an armed selection.
- `app/src/components/physic-paint/view/aquarelleRecordState.ts`
  - 76: `export type AquarelleGlobalKey = keyof AquarelleGlobalParams;` (size, water, load, flow, bleed, dry, edge, granulation, lift).
  - 78-88: `AQUARELLE_GLOBAL_KEYS` — the door's accepted params keys, INCLUDING `size`.
  - 103-104: `MULTIPLIER_MIN = 0.5`, `MULTIPLIER_MAX = 2.0`.
  - 115: `aquarelleToolOverrides = signal<AquarelleToolOverrides>({...})` — always a complete eight-field bag.
  - 217-222: `setAquarelleParam(key, value)` — compare-then-write, live only.
  - 252-284: `selectAquarelleTip(tipId)` — resolves tip-or-preset, forces the tool back to `brush`, remembers the outgoing bag in `aquarelleBrushResponseMemory` and LOADS the incoming bag into `aquarelleToolOverrides`. Reading `.peek()` after this call is the whole reason the pick order matters.
  - 293-301: `setAquarelleLiftTipId` — the eraser path; it touches no tip, no overrides and no tool. Keep it for every lift branch.
  - 352-361: `setAquarelleMultiplier(field, value)` — clamps to `MULTIPLIER_MIN`/`MULTIPLIER_MAX`, live only.
  - 777-929: `updateAquarelleStrokesInScript` — `params` is accepted and validated key by key against `AQUARELLE_GLOBAL_KEYS` with finite values (789-793), whole-patch refusal before any write, one same-index replacement and one `bumpAquarelleStrokesRevision()` at 929. No record-state change is needed by this quick: `{ params: { water: 55 } }` is already a legal patch.
  - 1578-1582: `recordAquarelleStroke(mutationId, stroke)` — the fixture registration helper the t74 suite already uses.
- Pick surfaces (the exact call sites this quick reroutes):
  - `app/src/components/physic-paint/view/PhysicsPaintBrushMenu.tsx` 184-186: the brush branch `onClick` runs `selectAquarelleTip(preset.id); setAquarelleBrushMenuOpen(false);`. 137-138: the lift branch keeps `setAquarelleLiftTipId(preset.id)`. Imports at 19-28.
  - `app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx` 81-85: `BrushCard` `onClick` runs `setAquarelleSelectMode(false); selectAquarelleTip(preset.id);` — the WR-03 disarm that must become conditional. Imports: `selectAquarelleTip` at 36-39 from `./aquarelleRecordState`, `setAquarelleSelectMode` at line 39 from `./aquarelleStrokeSelection`.
  - `app/src/components/physic-paint/view/BrushesDocker.tsx` 88: `TipRow` `onClick={() => selectAquarelleTip(props.tip.id)}`; 215: the import-success `selectAquarelleTip(result.tip.id)`. Imports at 20-24.
- Slider release surfaces (all read `SliderStepper.onCommit`, quick 261111-tul, documented at `app/src/components/shared/SliderStepper.tsx:32-44`):
  - `app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx` 194-198 `clampTopBarValue`; 200-227 `TopBarSlider` (props-driven, calls `props.onChange(clampTopBarValue(...))`); 312-337 the Eraser cluster (`physics-lift-size`, `physics-lift-strength`, `LiftEditSwitch`) which must stay untouched; 340-379 the five brush sliders (`physics-brush-size`, `physics-aquarelle-pigment` → `onOpacityChange`, `physics-aquarelle-water`, `physics-aquarelle-edges`, `physics-aquarelle-grain`).
  - `app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx` 454-463: `SliderStepper id="paint-tab-brush-size"` with `onChange={onBrushSizeChange}` (the Studio handler writes `setAquarelleParam('size', ...)` at `PhysicsPaintStudio.tsx:7145-7147`; pigment maps to `load` at 7148-7150).
  - `app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx` 27-37 `GLOBAL_ROWS` (water, load, flow, bleed, edge, granulation, dry — never size); 40-56 `GlobalSlider`; 65-70 `onGlobalChange`; 72-77 `onReset` (seven `setAquarelleParam` calls from `DEFAULT_PARAMS × 100`); 80-87 the row mapping and the `aquarelle-params-reset` button.
  - `app/src/components/physic-paint/view/BrushResponsePanel.tsx` 43-77 `MultiplierSlider`; 94-96 `onMultiplierChange` → `setAquarelleMultiplier`; the rows render one `MultiplierSlider` per `MULTIPLIER_FIELDS` entry.
- Far end (UNCHANGED by this quick): `app/src/components/physic-paint/PhysicsPaintStudio.tsx` 9146-9214 `handleAquarelleAppearanceStrokes` and the one render-body port registration at 9218-9226. Do not edit the Studio.
- Test harness facts:
  - `app/vitest.config.ts` collects only `.test.ts` files — `src/**/*.test.ts` plus `../packages/efx-paint-host/src/**/*.test.ts`. Never add a `.test.tsx`; `BrushesDocker.test.tsx` is collected through the import-only launcher `BrushesDocker.test.tsx.test.ts`, so its verify target is the launcher.
  - `app/tsconfig.json` is `strict` with `noUnusedLocals` and `include: ["src"]`: every test is typechecked, and a leftover import after a reroute fails typecheck (do not add unused imports).
  - `WatercolorBrushLibrary.test.ts` materializes vnodes and exposes `renderLibrary()`, `cardNodes(tree)`, `resetSelection()` and a mocked `preact/hooks`; its WR-03 test (411-431) arms Select mode with an EMPTY selection and still expects the disarm.
  - `PhysicsPaintTopBar.test.ts` walks host-only (`childrenOf`, 73-81): nested function components are NOT expanded, so the `TopBarSlider` vnodes themselves ARE present with their props, while `SliderStepper` internals are not. It also has `stripComments(topBarSource())` (38, 52-54) for positive source pins.
  - `PhysicsPaintRightPanel.test.ts` flattens components by hand and `findStepper(tree, id)` (262-269) returns the `SliderStepper` vnode; existing tests read `.props.value` and call `.props.onChange` (650-665), so `.props.onCommit` is callable there.
  - `AquarelleGlobalsPanel.test.ts` and `BrushResponsePanel.test.ts` fully materialize, which EXPANDS `SliderStepper` away; use positive source pins (add a small `readFileSync` + `stripComments` helper like the top-bar file) instead of vnode pokes.
  - `aquarelleStrokeSelection.test.ts` id bands already use 9006-10342; this quick's new fixtures use 10601+ (fresh file, but keep the band distinct anyway).
- Verify convention (grounded, cwd at the checkout root): `pnpm --filter efx-motion-editor run typecheck` and `pnpm --filter efx-motion-editor exec vitest run <app-relative paths>`. `vitest run` only, never watch; never start the dev server or `pnpm tauri dev`.
- WORKING TREE IS ALREADY DIRTY with unrelated paths: `packages/efx-watercolor/probe/vector-spine/result.json` (modified) and many untracked `.planning/phases/61-vector-painting-tool/.red-evidence/**` directories. Stage ONLY the files in `files_modified`.
- `renderMode` does not exist and must not return; no per-vertex colour; no p5.brush engine, compositor or `.mce` change; no stroke mutated in place.
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: The paint-control seam — pickAquarelleBrush through the whole stack, wired at the top-bar menu</name>
  <files>
    app/src/components/physic-paint/view/aquarellePaintControls.ts
    app/src/components/physic-paint/view/aquarellePaintControls.test.ts
    app/src/components/physic-paint/view/aquarelleStrokeSelection.ts
    app/src/components/physic-paint/view/PhysicsPaintBrushMenu.tsx
    app/src/components/physic-paint/view/PhysicsPaintBrushMenu.test.ts
  </files>
  <behavior>
    New file `aquarellePaintControls.test.ts` (node env, real signals, real record state). A file-scope fixture builds paint and lift strokes as fresh `AquarelleStroke` objects — its `tool` is `'brush'` by default and `'lift'` for the eraser case — and registers them with `recordAquarelleStroke(id, stroke)` under ids 10601+. `beforeEach` clears `aquarelleBrushResponseMemory.value = {}`; `afterEach` runs `setAquarelleSelectionEditPort(null)`, `setAquarelleSelectMode(false)`, `clearScriptStrokeSelection()` and `selectAquarelleTip(null)`. Every fake port records its `(ids, patch)` arguments and returns a resolved `true`.
    - Test 1 (pick order + payload): preselect tip `round`, set `aquarelleToolOverrides.value` to a non-neutral bag, then arm Select mode with paint stroke 10601 selected and call `pickAquarelleBrush('chalk')`. The live tip becomes `chalk`, the port is called exactly once, the forwarded ids are `[10601]`, and the forwarded `toolOverrides` equals the bag `selectAquarelleTip('chalk')` just loaded — NOT the pre-pick bag — proving the live pick happens first.
    - Test 2 (snapshot): after Test 1's call, assigning a different bag to `aquarelleToolOverrides.value` leaves the captured patch's `toolOverrides` unchanged.
    - Test 3 (return value): `pickAquarelleBrush` returns the port's promise; with no port it returns null after the live tip update.
    - Test 4 (mixed selection): paint 10602 + lift 10603 both selected; the pick forwards only `[10602]`.
    - Test 5 (lift-only): a selection of only 10603 returns null and calls the port zero times, while `aquarelleSelectedTipId.value` still becomes the picked id.
    - Test 6 (no selection): Select mode off with a non-empty selection, and Select mode on with an empty selection, both return null with zero port calls and still update the live tip.
    - Test 7 (param commit): with paint 10604 selected, `commitAquarelleSelectionParam('water', 55)` makes exactly one call with `{ params: { water: 55 } }`; the live `aquarelleParams.value.water` is unchanged (the caller owns the live write).
    - Test 8 (Reset batch): `commitAquarelleSelectionParams` with the seven Reset keys makes exactly ONE call carrying all seven; an empty object returns null and calls the port zero times.
    - Test 9 (multiplier commit + clamp): with paint 10605 selected, `commitAquarelleSelectionMultiplier('aspect', 2.4)` forwards `{ toolOverrides: { aspect: MULTIPLIER_MAX } }` and `('aspect', 0.4)` forwards `{ toolOverrides: { aspect: MULTIPLIER_MIN } }`; the live `aquarelleToolOverrides.value.aspect` is unchanged.
    - Test 10 (default filter unchanged): a direct `commitAquarelleSelectionAppearance({ brushId: 'chalk' })` with a paint+lift selection forwards BOTH ids in selection order — the option defaults to 'all', so the 261111-t74 contract is untouched.
    Source pins in `PhysicsPaintBrushMenu.test.ts` (existing file; its `SOURCE` is the RAW file text — there is no comment stripping, so every pin must match code-only regions and no comment added to `PhysicsPaintBrushMenu.tsx` may name `pickAquarelleBrush(` or the `./aquarellePaintControls` path): the brush branch region contains `pickAquarelleBrush(` exactly once; the lift branch region still contains `setAquarelleLiftTipId(` exactly once and contains no `pickAquarelleBrush(`; the file imports from `./aquarellePaintControls` once.
  </behavior>
  <action>
    RED FIRST. Create `app/src/components/physic-paint/view/aquarellePaintControls.test.ts` with the behavior block above, importing the four new exports from `./aquarellePaintControls`; `aquarelleSelectionEditActive`/`setAquarelleSelectionEditPort`/`commitAquarelleSelectionAppearance`/`setAquarelleSelectMode` from `./aquarelleStrokeSelection`; `aquarelleSelectedTipId`/`aquarelleToolOverrides`/`aquarelleBrushResponseMemory`/`aquarelleParams`/`selectAquarelleTip`/`recordAquarelleStroke`/`MULTIPLIER_MIN`/`MULTIPLIER_MAX` from `./aquarelleRecordState`; `NEUTRAL_TOOL_OVERRIDES` from `@efxlab/efx-watercolor/brushes`; and `clearScriptStrokeSelection`/`scriptSelectedStrokeIds`/`setScriptStrokeSelection` from `./scriptStrokeEdition` — `aquarelleStrokeSelection.ts` neither defines nor re-exports the first two, and `aquarelleStrokeSelection.test.ts:93-107` already takes exactly these three from `./scriptStrokeEdition`. Add the three source pins to `PhysicsPaintBrushMenu.test.ts` using its existing `sourceRegion` helper. Run `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/aquarellePaintControls.test.ts src/components/physic-paint/view/PhysicsPaintBrushMenu.test.ts` and record that it fails on the missing module and pins.

    GREEN, layer by layer.

    (1) `app/src/components/physic-paint/view/aquarelleStrokeSelection.ts`: add `export interface AquarelleSelectionEditOptions { filter?: AquarelleStrokeTypeFilter; }` above `commitAquarelleSelectionAppearance` and give that function an optional second argument `options?: AquarelleSelectionEditOptions`. Resolve `const filter = options?.filter ?? 'all'`. Keep the two shipped early returns (inactive, no port) and the null-on-no-attempt contract. Snapshot `let ids = [...scriptSelectedStrokeIds.peek()]`; when `filter !== 'all'`, filter those ids through `getRecordedAquarelleStrokeEntries()` (look each id up; keep it only when the stroke exists and `matchesAquarelleStrokeFilter(stroke, filter)` is true), and return null when the filtered list is empty, BEFORE touching the port. Then call `port.applyAppearance(ids, patch)`. Document that the default 'all' preserves the 261111-t74 forwarding exactly and that 'paint' is what keeps lift strokes out of every paint control.

    (2) Create `app/src/components/physic-paint/view/aquarellePaintControls.ts` with a header comment stating the one law: these are the ONLY selection-edit entry points for picks and paint controls; the live setters are the caller's job on `onChange` and are never called here (except the live tip inside the pick). Four exports, each calling `commitAquarelleSelectionAppearance` with `{ filter: 'paint' }` and returning its `Promise<boolean> | null`:
    - `pickAquarelleBrush(presetId: string)`: call `selectAquarelleTip(presetId)` FIRST, then commit `{ brushId: presetId, toolOverrides: aquarelleToolOverrides.peek() }`. Document the order (the tip pick loads the incoming response bag; the commit must carry the bag the live brush now uses) and that an unknown id still updates the live surface as today (the door refuses the patch).
    - `commitAquarelleSelectionParam(key: AquarelleGlobalKey, value: number)`: commit `{ params: { [key]: value } }`.
    - `commitAquarelleSelectionParams(params: Readonly<Record<string, number>>)`: return null when `Object.keys(params).length === 0`, else commit `{ params }` — the Reset batch's ONE call.
    - `commitAquarelleSelectionMultiplier(field: keyof AquarelleToolOverrides, value: number)`: clamp with `Math.max(MULTIPLIER_MIN, Math.min(MULTIPLIER_MAX, value))` to mirror `setAquarelleMultiplier`, then commit `{ toolOverrides: { [field]: clamped } }` typed as `Partial<AquarelleToolOverrides>`. Imports: `type AquarelleToolOverrides` from `@efxlab/efx-watercolor/brushes`; `MULTIPLIER_MAX`, `MULTIPLIER_MIN`, `aquarelleToolOverrides`, `selectAquarelleTip`, `type AquarelleGlobalKey` from `./aquarelleRecordState`; `commitAquarelleSelectionAppearance` from `./aquarelleStrokeSelection`. Import no live param/multiplier setter.

    (3) `app/src/components/physic-paint/view/PhysicsPaintBrushMenu.tsx`: remove `selectAquarelleTip` from the record-state import (19-28) — `noUnusedLocals` enforces that nothing is left behind — add `import { pickAquarelleBrush } from './aquarellePaintControls';`, and change the brush branch `onClick` (184-186) to `void pickAquarelleBrush(preset.id); setAquarelleBrushMenuOpen(false);`. Leave the lift branch's `setAquarelleLiftTipId(preset.id)` and every close/open behaviour untouched.

    Guardrails: no Studio edit (the port registration is already there); no selection state is written by this module; no lift stroke may ever be forwarded through these functions once the filter is in place; do not change `selectAquarelleTip`, `setAquarelleLiftTipId`, `setAquarelleParam` or `setAquarelleMultiplier`; keep the `null`/`false` meaning from 261111-t74.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor run typecheck</automated>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/aquarellePaintControls.test.ts src/components/physic-paint/view/PhysicsPaintBrushMenu.test.ts src/components/physic-paint/view/aquarelleStrokeSelection.test.ts</automated>
  </verify>
  <done>
    A single paint-controls module exists and the top-bar brush dropdown is its first tenant: a pick updates the live brush first and commits the picked id plus the post-pick multiplier bag to the non-lift selected strokes, mixed selections forward only their paint ids, lift-only and empty selections forward nothing, and every commit rides the one registered port with filter 'paint'. The direct `commitAquarelleSelectionAppearance(patch)` path still forwards the whole selection unchanged. Typecheck and all three suites pass.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: The remaining pick surfaces — library cards keep an armed selection, docker rows commit</name>
  <files>
    app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx
    app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts
    app/src/components/physic-paint/view/BrushesDocker.tsx
    app/src/components/physic-paint/view/BrushesDocker.test.tsx
  </files>
  <behavior>
    In `WatercolorBrushLibrary.test.ts`, add one describe (ids 10651+, the file's own registry) with an `afterEach` that clears the port, Select mode and the selection:
    - Test 1 (armed selection survives the pick): register a paint stroke 10651, register a fake port, arm `setAquarelleSelectMode(true)` and `setScriptStrokeSelection([10651])`, render the library and invoke the `watercolor-brush-card-round` card's `onClick`. Select mode is still true, the selection still contains 10651, `aquarelleSelectedTipId.value` is `round`, and the port was called exactly once with `{ brushId: 'round', toolOverrides: <the live bag> }` and ids `[10651]`.
    - Test 2 (WR-03 regression): the existing WR-03 test stays byte-identical and green — with Select mode armed and NO selection, a card pick still disarms Select mode (the probe returns false, so the conditional disarm runs).
    In `BrushesDocker.test.tsx`, add one behavior test and one source pin:
    - Test 3 (row pick commits): register paint stroke 10661, arm Select mode plus the selection, register the fake port, render the docker, find the host node with `data-testid` `brush-row-<a known TIPS id>` and invoke its `onClick`. The live tip becomes that id and the port receives exactly one call with `{ brushId: <id>, toolOverrides: <the live bag> }`.
    - Pin 1: comment-stripped `BrushesDocker.tsx` source contains `pickAquarelleBrush(` exactly twice (the row and the import-success site), and imports from `./aquarellePaintControls` once.
  </behavior>
  <action>
    RED FIRST. Add Tests 1 and 2 to `WatercolorBrushLibrary.test.ts` and Test 3 plus Pin 1 to `BrushesDocker.test.tsx`, then run `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/WatercolorBrushLibrary.test.ts src/components/physic-paint/view/BrushesDocker.test.tsx.test.ts` and record the failures (Test 2 is expected to pass already — it is the regression guard).

    GREEN. (1) `app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx`: extend the `./aquarelleStrokeSelection` import at line 39 with `aquarelleSelectionEditActive`, add `import { pickAquarelleBrush } from './aquarellePaintControls';`, and remove `selectAquarelleTip` from the `./aquarelleRecordState` import (36-39). Change `BrushCard`'s `onClick` (81-85) to `if (!aquarelleSelectionEditActive()) setAquarelleSelectMode(false); void pickAquarelleBrush(preset.id);` with the comment updated to the two-part law: a pick still leaves Edit mode before the tool flips UNLESS a non-empty selection is armed, because leaving Select mode clears the selection the pick is about to edit.

    (2) `app/src/components/physic-paint/view/BrushesDocker.tsx`: remove `selectAquarelleTip` from the `./aquarelleRecordState` import (20-24), add `import { pickAquarelleBrush } from './aquarellePaintControls';`, and route both sites through `void pickAquarelleBrush(...)`: `TipRow`'s `onClick` at line 88 with `props.tip.id`, and the import-success call at line 215 with `result.tip.id`. Change nothing else in the import flow (the `importing`/`importFailure` flags and the tip-list append stay exactly as shipped).

    Guardrails: the library must disarm Select mode when the probe is false (the WR-03 test pins it); no lift branch is touched here; `BrushesDocker.test.tsx` is a `.tsx` file collected only through its launcher — do not add or rename test files, do not add a `.test.ts`.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor run typecheck</automated>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/WatercolorBrushLibrary.test.ts src/components/physic-paint/view/BrushesDocker.test.tsx.test.ts</automated>
  </verify>
  <done>
    Every pick surface now commits to the selection: the library card keeps an armed selection (and still disarms an unarmed Edit mode, proving WR-03), the docker row forwards the picked id and the post-pick bag, and the import-success pick is routed through the same helper. No pick surface calls the raw live setter outside the helper. Typecheck and both suites pass.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Slider release boundaries — top bar, Paint tab, globals + Reset, brush response, full gate</name>
  <files>
    app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx
    app/src/components/physic-paint/view/PhysicsPaintTopBar.test.ts
    app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx
    app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts
    app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx
    app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts
    app/src/components/physic-paint/view/BrushResponsePanel.tsx
    app/src/components/physic-paint/view/BrushResponsePanel.test.ts
  </files>
  <behavior>
    Shared fixture pattern for the three behavior files: register a paint stroke (10701+), arm Select mode plus the selection, register a fake port, exercise the control, assert exactly one call with the expected patch, then clear everything in `afterEach`.
    - Top bar (`PhysicsPaintTopBar.test.ts`, host-only walk): under the Brush tool, the `childrenOf` list contains the five `TopBarSlider` vnodes — find each by `props.id` (`physics-brush-size`, `physics-aquarelle-pigment`, `physics-aquarelle-water`, `physics-aquarelle-edges`, `physics-aquarelle-grain`) and assert `props.onCommit` is a function; calling it forwards exactly one patch per slider with the mapped key — size → `size`, pigment → `load`, water → `water`, edges → `edge`, grain → `granulation`. Under the Lift tool, the `physics-lift-size` and `physics-lift-strength` vnodes have `onCommit` undefined (the Eraser cluster never commits a paint param onto the selection). Source pin on `stripComments(topBarSource())`: `const updateCommit =` appears once and `onCommit={updateCommit}` appears once (the TopBarSlider passthrough), and the file imports from `./aquarellePaintControls` once.
    - Paint tab (`PhysicsPaintRightPanel.test.ts`): `findStepper(tree, 'paint-tab-brush-size').props.onCommit` is a function; calling it forwards exactly one `{ params: { size: 44 } }` patch, while `props.onChange(50)` still calls the `onBrushSizeChange` mock with 50 (the live path is unchanged).
    - Globals (`AquarelleGlobalsPanel.test.ts`, source pins): comment-stripped panel source contains `onCommit={props.onCommit}` once (the GlobalSlider passthrough), `commitAquarelleSelectionParam(key, value)` once, `commitAquarelleSelectionParams(next)` once, and one import from `./aquarellePaintControls`. The existing Reset test stays green and extended so it still proves all seven `setAquarelleParam` writes and the never-size law.
    - Brush response (`BrushResponsePanel.test.ts`, source pins): comment-stripped source contains `onCommit={props.onCommit}` once, `commitAquarelleSelectionMultiplier(field, value)` once, and one import from `./aquarellePaintControls`; the existing 8-row and clamp tests stay green.
    - Full gate: the five committed keys are exactly the ones above and no control commits on `onChange` (the port is silent during a drag — assert in the top-bar case that no call happens until `onCommit` is invoked).
  </behavior>
  <action>
    RED FIRST. Add the behavior tests and source pins above, run the four targeted files, and record the failures (the existing tests are the regression guards and must already pass).

    GREEN. (1) `app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx`: add `onCommit?: (value: number) => void` to `TopBarSlider`'s props; inside, build `const updateCommit = props.onCommit === undefined ? undefined : (value: unknown) => props.onCommit!(clampTopBarValue(value, props.min, props.max));` and pass `onCommit={updateCommit}` to the inner `SliderStepper` (so an absent prop stays absent). Add `import { commitAquarelleSelectionParam } from './aquarellePaintControls';` and give the five brush sliders (340-379) an `onCommit` that calls `void commitAquarelleSelectionParam(<key>, value)` with this exact five-key mapping, one key per slider id: `physics-brush-size` → `'size'`; `physics-aquarelle-pigment` → `'load'`; `physics-aquarelle-water` → `'water'`; `physics-aquarelle-edges` → `'edge'`; `physics-aquarelle-grain` → `'granulation'`. The live setters already agree with it (`onBrushSizeChange` → `setAquarelleParam('size', ...)` and `onOpacityChange` → `setAquarelleParam('load', ...)` in `PhysicsPaintStudio.tsx:7145-7150`; water/edge/granulation inline at 356, 366, 376). Do not touch the Eraser cluster (312-337) — neither lift slider gets an `onCommit`.

    (2) `app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx`: add `import { commitAquarelleSelectionParam } from './aquarellePaintControls';` and on the `paint-tab-brush-size` SliderStepper (454-463) add `onCommit={(value) => { void commitAquarelleSelectionParam('size', value); }}`. Leave `onChange={onBrushSizeChange}` untouched.

    (3) `app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx`: add the paint-controls import; give `GlobalSlider` an optional `onCommit` prop passed straight to `SliderStepper`; add `const onGlobalCommit = (key: AquarelleGlobalKey) => (value: number) => { void commitAquarelleSelectionParam(key, value); };` beside `onGlobalChange` and wire it on each row. In `onReset` (72-77), accumulate the seven computed defaults into a local `Record<string, number>` while still calling `setAquarelleParam(row.key, value)` for each (live behaviour and order unchanged), then call `void commitAquarelleSelectionParams(next)` ONCE after the loop. Never include `size` (the rows do not carry it).

    (4) `app/src/components/physic-paint/view/BrushResponsePanel.tsx`: add the paint-controls import; give `MultiplierSlider` an optional `onCommit` prop passed to `SliderStepper`; add `const onMultiplierCommit = (field: keyof AquarelleToolOverrides) => (value: number) => { void commitAquarelleSelectionMultiplier(field, value); };` beside `onMultiplierChange` and wire one per row. Keep `onChange` → `setAquarelleMultiplier` exactly as shipped.

    (5) Run the full gate: typecheck, the four targeted files, then the whole `pnpm --filter efx-motion-editor exec vitest run`. If a pin or behavior test fails, fix the production wiring rather than weakening the assertion. Never commit on `onChange`; a drag must produce zero commits and a release exactly one.

    Guardrails: every live setter call stays at its current site and value; no new signal subscriptions in any render body (the commits are event-time closures); no `.test.tsx` added; stage only the eight files in `files_modified` for this task (the probe `result.json` and `.red-evidence` directories stay untouched).
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor run typecheck</automated>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PhysicsPaintTopBar.test.ts src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts src/components/physic-paint/view/BrushResponsePanel.test.ts</automated>
    <automated>pnpm --filter efx-motion-editor exec vitest run</automated>
  </verify>
  <done>
    Every paint control now commits exactly once at its release boundary: the five top-bar brush sliders (size, pigment, water, edges, grain — with the Eraser cluster silent), the Paint-tab size pair, each of the seven global rows, and each Brush response row (one clamped multiplier field). Reset commits ONE seven-key params patch after its seven live writes. With no selection every commit is a no-attempt no-op, drags produce no commits, and every existing onChange/live behaviour is unchanged. Typecheck, the four targeted suites and the full vitest run are green.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| live selection to committed ids | ids are snapshotted from session state at the release boundary; a stale, deleted or lift id must not receive a paint patch |
| live brush bag to per-stroke multipliers | the pick forwards a complete live bag; it must be the post-pick bag and a snapshot, never a live reference |
| slider gesture to script writes | only the release boundary may write; a continuous drag must never grow the undo ledger |
| repeat Reset to undo ledger | seven live writes plus ONE patch call — seven edits would split one click into seven undos |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-UCF-01 | Tampering | commitAquarelleSelectionAppearance filter | high | mitigate | 'paint' resolves each peeked id against the live recorded-stroke map through `matchesAquarelleStrokeFilter`, drops ids with no recorded entry, and returns null when none remain; tombstones are dropped at the far end by `aquarelleStrokesOnFrame` (`aquarelleStrokeSelection.ts:216`, `isAquarelleStrokeDeleted`) before any write, so a deleted id can never receive a patch; lift strokes can never carry a paint param or a multiplier bag from these surfaces. |
| T-UCF-02 | Repudiation | undo ledger integrity | high | mitigate | Every commit goes through the single registered port to `handleAquarelleAppearanceStrokes` / `beginAquarelleAppearanceEdit`; each release and each pick issues exactly one call, and Reset issues one 7-key call after its live writes. |
| T-UCF-03 | Denial of service | drag vs release commits | medium | mitigate | Selection writes are bound only to `SliderStepper.onCommit` (quick 261111-tul's once-per-gesture boundary); `onChange` never commits, so a drag cannot produce a write storm. |
| T-UCF-04 | Spoofing | live brush ordering | low | mitigate | `pickAquarelleBrush` selects the live tip before reading `aquarelleToolOverrides.peek()`, so the committed bag is the bag the live brush actually uses; an unresolvable id is refused by the shipped door, never coerced. |
| T-UCF-SC | Tampering | package installs | high | mitigate | No package is added and no dependency edge changes; every import is an existing local module or the already-used `@efxlab/efx-watercolor/brushes` entry. |
</threat_model>

<verification>
Automated:
- `pnpm --filter efx-motion-editor run typecheck`
- `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/aquarellePaintControls.test.ts src/components/physic-paint/view/PhysicsPaintBrushMenu.test.ts src/components/physic-paint/view/aquarelleStrokeSelection.test.ts src/components/physic-paint/view/WatercolorBrushLibrary.test.ts src/components/physic-paint/view/BrushesDocker.test.tsx.test.ts src/components/physic-paint/view/PhysicsPaintTopBar.test.ts src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts src/components/physic-paint/view/BrushResponsePanel.test.ts`
- `pnpm --filter efx-motion-editor exec vitest run` (full suite; `vitest run` only, never watch)
- No `.test.tsx` is added; no dev server and no `pnpm tauri dev` is started.

Scope checks:
- `PhysicsPaintStudio.tsx` is not modified; the one port registration and `handleAquarelleAppearanceStrokes` remain the far end.
- Every pick surface (menu brush branch, library card, docker row, docker import) calls `pickAquarelleBrush`; the lift branches (`PhysicsPaintBrushMenu` 137-138, `setAquarelleLiftTipId`) are untouched.
- Every commit is event-time and filtered to 'paint'; no selection write exists in this quick and no render body gains a subscription.
- The Eraser cluster sliders carry no `onCommit`; Reset produces exactly one params call with seven keys.
- The working tree still shows `packages/efx-watercolor/probe/vector-spine/result.json` modified and the pre-existing `.red-evidence` directories untracked; none of them is staged.

No native UAT row is required to close this plan's automated rows. A live UAT row IS required before calling the feature shipped: select a painted stroke, pick another brush from the top-bar dropdown, and confirm the selected stroke repaints while the live brush also changes; then drag and release Size/Water and confirm one undo step per release.
</verification>

<success_criteria>
- `app/src/components/physic-paint/view/aquarellePaintControls.ts` exports `pickAquarelleBrush`, `commitAquarelleSelectionParam`, `commitAquarelleSelectionParams` and `commitAquarelleSelectionMultiplier`; the first selects the live tip before committing the post-pick bag, and all four commit with filter 'paint'.
- `commitAquarelleSelectionAppearance` accepts an optional filter, forwards only non-lift ids for 'paint', returns null when none remain, and keeps the default 'all' path unchanged.
- All four pick sites (menu, library card, docker row, docker import) route through `pickAquarelleBrush`; the library disarms Select mode only when no selection is armed (WR-03 preserved) and keeps an armed selection.
- The five top-bar brush sliders, the Paint-tab size pair, the seven global rows and the eight Brush response rows commit exactly once per release with the mapped keys; the Eraser cluster and every `onChange`/live setter are unchanged.
- Globals Reset commits ONE 7-key params patch after its seven live writes.
- No selection or Select mode off ⇒ every new commit is a no-attempt no-op; with `onCommit` absent nothing renders differently.
- Typecheck, the targeted suites and the full `vitest run` pass; only the listed files are staged.
</success_criteria>

<output>
Create .planning/quick/261111-ucf-brush-picks-and-paint-controls-edit-the-/261111-ucf-SUMMARY.md when done.
</output>
