---
phase: 261031-euf-task-stroke-list-in-the-stroke-settings-
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/physic-paint/view/scriptStrokeEdition.ts
  - app/src/components/physic-paint/view/aquarelleStrokeSelection.ts
  - app/src/components/physic-paint/view/strokeSettingsModel.ts
  - app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx
  - app/src/components/physic-paint/physicsPaintStudio.css
  - app/src/components/physic-paint/view/strokeSettingsModel.test.ts
  - app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts
autonomous: true
requirements:
  - QUICK-261031-EUF
user_setup: []

estimate:
  tokens: 52000
  raw_tokens: 52000
  tasks: 2
  confidence: low

must_haves:
  truths:
    - "With Move/Edit active and an EMPTY watercolor selection, the sheet shows the Paint/Eraser/All toggles in sentence case, the finer-filter dropdown(s), and the stroke list; the Geometry/Stack/Paint tab row and the old 'Select a stroke to edit.' caption are absent."
    - "With a NON-EMPTY selection the sheet shows the tab row and the existing editing content and no list; clicking a row replaces the selection with exactly that mutationId through the one shared setter, so the canvas outline follows and the next render shows the tabs."
    - "The list is every recorded, non-deleted stroke of the current frame, live-filtered by Paint/Eraser/All (the same signal the overlay and hit-test read) and by the tool/tip dropdowns; deleted strokes and strokes from other frames never appear."
    - "Each row shows the type name (Brush/Water/Pen/Eraser, lift = Eraser), the creation serial, the stack position (1 = topmost), the color dot, the recorded tip name via findTip(brushId)?.name with the raw brushId fallback, and a 'Custom response' marker only when any tool-overrides multiplier differs from neutral; rows are ordered stably topmost-first."
    - "Fine filters default to All, reset on a fresh select-mode entry, reset on any actual Paint/Eraser/All change, and reset the tip to All when a tool change makes it unavailable; the dropdowns never offer a combination that yields zero rows "
    - "The tip dropdown renders only when more than one tip is present; the summary reads F<frame> · N strokes · P paint · E erasers; the messages are 'No strokes on this frame.' and 'No strokes match this filter.'"
    - "The list scrolls inside the existing SidebarScrollArea, the sheet drag/resize/close and the brush-module sheet are unchanged, and no rendering, hit-test, selection-semantics, persistence or schema behavior changes."
  artifacts:
    - app/src/components/physic-paint/view/scriptStrokeEdition.ts
    - app/src/components/physic-paint/view/aquarelleStrokeSelection.ts
    - app/src/components/physic-paint/view/strokeSettingsModel.ts
    - app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx
    - app/src/components/physic-paint/physicsPaintStudio.css
    - app/src/components/physic-paint/view/strokeSettingsModel.test.ts
    - app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts
  key_links:
    - "listSelectableAquarelleStrokes -> SelectableScriptStroke.tool/brushId/customResponse -> dialog row anatomy"
    - "aquarelleStrokeTypeFilter (existing) -> dialog list rows AND the overlay/hit-test port (one filter law)"
    - "row click -> selectAquarelleStroke(mutationId) -> scriptSelectedStrokeIds -> canvas outline + dialog tabs return"
    - "setAquarelleSelectMode / setAquarelleStrokeTypeFilter -> resetAquarelleStrokeFineFilters -> aquarelleStrokeToolFilter/aquarelleStrokeTipFilter"
    - "SidebarScrollArea -> stroke list container -> scrollable rows"
---

<objective>
Add the stroke list to the watercolor Stroke settings sheet for the EMPTY Move/Edit selection: keep the Paint/Eraser/All toggles (sentence case), add a tool dropdown and a conditional tip dropdown, then a topmost-first scrollable list of every recorded, non-deleted stroke of the current frame. Clicking a row selects exactly that stroke (the one shared replace setter) so the canvas outlines it and the Geometry/Stack/Paint tabs return in place of the list.

Purpose: today the empty selection shows only the toggles, the tab row and the dead caption "Select a stroke to edit." The user must click the canvas blind to pick a stroke. The list makes every editable stroke discoverable, filterable and one click away without changing rendering, hit-testing or selection semantics.

Output: additive selectable metadata (tool, brushId, custom-response presence), pure list laws (labels, type match, tip-name resolution, topmost-first sort, option derivation, filtering, summary), module fine-filter state with the existing reset choke points, and the dialog list surface plus its CSS. No persistence, no schema, no Studio bundle change, no brush-module change.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md

<required_reading>
- /Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx
- /Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/view/strokeSettingsModel.ts
- /Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/view/aquarelleStrokeSelection.ts
- /Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/view/scriptStrokeEdition.ts
- /Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/PhysicsPaintStudio.tsx (lines 9674-9712, the stroke settings bundle)
- /Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/view/strokeSettingsModel.test.ts (the harness at 1-330 and the 261029-eur dialog block at 1540-1706)
- /Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts
- /Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/physicsPaintStudio.css (global button rule ~174; sheet tabs ~1464; script row ~1974; scope select ~1840)
- /Users/lmarques/Dev/efx-motion-editor/packages/efx-watercolor/src/brushes/tips.ts
- /Users/lmarques/Dev/efx-motion-editor/packages/efx-watercolor/src/payload/toStudioStroke.ts
- /Users/lmarques/Dev/efx-motion-editor/.claude/skills/efx-preact-reactivity/SKILL.md
</required_reading>

Grounded facts (verified against the live tree — do not re-derive, do not invent APIs):

- The Studio's watercolor bundle calls `listStrokes: (frame, size) => listSelectableAquarelleStrokes(frame, size)` (PhysicsPaintStudio.tsx line 9694) with the DEFAULT `'all'` type filter, so the dialog always receives the FULL frame listing (stack positions stay global). The dialog must apply the Paint/Eraser/All filter to the list itself. Do NOT change the Studio bundle.
- `SelectableScriptStroke` (scriptStrokeEdition.ts lines 53-81) carries `kind`, `serial`, `stackPosition`, `stackTotal`, `color`, `bounds`, `pointsPx` — but no tool or brushId. `listSelectableAquarelleStrokes` (aquarelleStrokeSelection.ts lines 386-463) is its ONLY producer; it already filters deleted and other-frame strokes.
- Recorded `AquarelleStroke` objects carry `tool`, `brushId` and optional `toolOverrides` (packages/efx-watercolor/src/payload/toStudioStroke.ts lines 62-73). Lift strokes record their tip in the same `brushId` field (aquarelleRecordState.ts comment at ~105).
- `findTip` is exported from `@efxlab/efx-watercolor/brushes` (tips.ts lines 196-198); `NEUTRAL_TOOL_OVERRIDES` (lines 53-62) and `TOOL_OVERRIDE_FIELDS` (lines 65-74) are exported there too. `aquarelleRecordState.ts` already imports from that subpath.
- The dialog (PhysicsPaintStrokeSettingsDialog.tsx): `selection` read at line 330, `strokes = bundle.listStrokes(...)` at 423, type toggles at 651-674 (labels Paint/Eraser/All), tab row at 676-702, `SidebarScrollArea` at 704, the old `select a stroke to edit` branch at 706-709, resize grip at 1022. `engineModule` = `bundle.module ?? 'brush'` (line 331); `keepOpenOnEmpty` defaults true for watercolor (line 340).
- The existing filter law: `setAquarelleStrokeTypeFilter` (aquarelleStrokeSelection.ts 228-249) reads compare-then-write and prunes the selection; `setAquarelleSelectMode` (278-291) writes the type filter BEFORE delegating because `setScriptSelectMode` early-returns on an unchanged value.
- The shared selection setter is `selectAquarelleStroke(mutationId)` (aquarelleStrokeSelection.ts 142-144) -> `selectScriptStroke` -> `setScriptStrokeSelection` (scriptStrokeEdition.ts 114-127), which REPLACES the set with compare-then-write. The overlay and the dialog both read `scriptSelectedStrokeIds`.
- The global `button` rule sets `text-transform: uppercase` (physicsPaintStudio.css 174-186); the dialog's filter buttons use inline `SEGMENT_STYLE`/`SEGMENT_ACTIVE_STYLE` (dialog 217-233) with no transform, so they render uppercase today.
- Test harness (strokeSettingsModel.test.ts): `createBundle` 268-292, `selectableStroke` 294-309, `stackStrokeFixture` 312-329, `renderDialog` 201-204, `beforeEach` resets module signals at 136-143, and the old caption assertion lives at 1638-1653 in the `261029-eur` block. The harness mocks `preact/hooks` and keeps the real signals core. Vitest collects only `.test.ts`; the dialog harness is a `.test.ts` file — extend it, do not create a `.test.tsx`.
- `aquarelleStrokeSelection.test.ts` fixture `stroke()` uses `brushId: 'round'` (a preset id, not a tip) — `resolveStrokeTipName` must fall back to the raw id. Its `setAquarelleSelectMode is compare-then-write` test observes only `aquarelleSelectMode` (line 316-335), so extra fine-filter resets do not affect it.
- Frame labels in the app use the raw 0-based frame index: `` `F${start}` `` (physicsPaintRotoPlayScriptController.ts lines 507, 934). The summary uses `bundle.playFrame` verbatim.
- Test command law: `pnpm --filter efx-motion-editor exec vitest run <app-relative path>` (the app `test` script is watch mode — never use it). Never start the dev server. No package change is needed, so no `dist` rebuild.
- Preact law (efx-preact-reactivity): no signal writes in a render body; event-handler/setter writes only; identity-stable effect deps; narrow signal reads; compare-then-write setters. The new dialog reads its signals in the dialog render body only (the dialog is already the narrow leaf for selection).
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: End-to-end row — empty Move/Edit lists the frame's strokes, one click selects and the tabs return</name>
  <files>app/src/components/physic-paint/view/scriptStrokeEdition.ts, app/src/components/physic-paint/view/aquarelleStrokeSelection.ts, app/src/components/physic-paint/view/strokeSettingsModel.ts, app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx, app/src/components/physic-paint/view/strokeSettingsModel.test.ts, app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts</files>
  <behavior>
    - RED first: the new dialog end-to-end case fails before the implementation — with an empty watercolor selection, no `stroke-settings-tabs`, no `stroke-settings-empty`, one row button per type-filtered frame stroke in topmost-first order, and clicking the row for id 9 leaves `scriptSelectedStrokeIds.value` equal to exactly `new Set([9])`, after which the next render shows the tab row and no rows.
    - `SelectableScriptStroke` entries carry `tool` ('brush' | 'water' | 'pen' | 'lift'), `brushId` (the recorded string) and `customResponse` (true only when a `toolOverrides` multiplier differs from `NEUTRAL_TOOL_OVERRIDES`; absent or all-neutral is false).
    - `strokeToolLabel` maps brush -> Brush, water -> Water, pen -> Pen, lift -> Eraser. `matchesStrokeTypeFilter` maps all -> true, paint -> kind 'paint', lift -> kind 'lift'. `resolveStrokeTipName('wc/round-medium')` is 'Round medium' and `resolveStrokeTipName('round')` is 'round'.
    - `sortStrokesTopmostFirst` returns a NEW array ordered by `stackPosition` ascending (1 first) with `serial` ascending as the tie-break; the input array and its objects are never mutated.
    - A non-empty selection renders the tab row and the existing content with no row list; a brush bundle with a selection renders no list and no type/dropdown chrome (it can never open empty).
  </behavior>
  <action>
    Shared seam (`app/src/components/physic-paint/view/scriptStrokeEdition.ts`): add `export type ScriptStrokeTool = 'brush' | 'water' | 'pen' | 'lift';` and extend `SelectableScriptStroke` with required `readonly tool: ScriptStrokeTool`, `readonly brushId: string` and `readonly customResponse: boolean`, each documented as quick 261031-euf display metadata (additive only — no hit-test, bounds or selection change).

    Producer (`app/src/components/physic-paint/view/aquarelleStrokeSelection.ts`): in `listSelectableAquarelleStrokes`, populate `tool: stroke.tool`, `brushId: stroke.brushId` and `customResponse: hasCustomToolOverrides(stroke.toolOverrides)` on BOTH the lift branch and the paint branch. Add a module-local `hasCustomToolOverrides(overrides)` that returns false for undefined and otherwise `TOOL_OVERRIDE_FIELDS.some((field) => overrides[field] !== NEUTRAL_TOOL_OVERRIDES[field])`; import the two constants from `@efxlab/efx-watercolor/brushes`. Do not alter the existing frame/deleted filtering, ribbon caching, stack positions or revision reads.

    Pure model (`app/src/components/physic-paint/view/strokeSettingsModel.ts`): add `StrokeListTypeFilter = 'all' | 'paint' | 'lift'`, `strokeToolLabel(tool)`, `matchesStrokeTypeFilter(stroke, filter)` (kind-based, mirroring `matchesAquarelleStrokeFilter`), `resolveStrokeTipName(brushId)` using `findTip` from `@efxlab/efx-watercolor/brushes` with the raw `brushId` fallback, and `sortStrokesTopmostFirst(strokes)` (copy, then sort by stackPosition then serial). Keep the module Preact-free and DOM-free.

    Dialog (`app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx`): compute `selectionEmpty = selection.size === 0`; derive `typeRows = strokes.filter((stroke) => matchesStrokeTypeFilter(stroke, strokeTypeFilter))` and `sortedRows = sortStrokesTopmostFirst(typeRows)`. Render the tab row only when `!selectionEmpty`. Inside the existing `SidebarScrollArea` content, replace the `appearances.length === 0` caption branch with: when `selectionEmpty`, a `div data-testid="stroke-settings-list"` of row buttons; otherwise the existing three tab sections unchanged. Each row is a `type="button"` button with `data-testid={`stroke-settings-stroke-${stroke.mutationId}`}`, an `aria-label` naming type, serial, tip and position, `class="physics-paint-stroke-settings-list-row"`, an inline `textTransform: 'none'`, `onClick={() => selectAquarelleStroke(stroke.mutationId)}`, and children in this order: a color dot span (`data-testid="stroke-settings-stroke-dot"`, `backgroundColor: stroke.color`), a type span (`stroke-settings-stroke-type`, `strokeToolLabel(stroke.tool)`), a serial span (`stroke-settings-stroke-serial`, `#${stroke.serial}`), a position span (`stroke-settings-stroke-position`, `${stroke.stackPosition}/${stroke.stackTotal}`), a tip span (`stroke-settings-stroke-tip`, `resolveStrokeTipName(stroke.brushId)`), and, only when `stroke.customResponse`, a marker span (`stroke-settings-stroke-custom`) reading "Custom response". Import `selectAquarelleStroke` from `./aquarelleStrokeSelection`. Do not add local state, effects or signal writes; the render body only reads.

    Tests (`app/src/components/physic-paint/view/strokeSettingsModel.test.ts`): extend the two fixtures (`selectableStroke`, `stackStrokeFixture`) with `tool`, `brushId` and `customResponse` defaults; add pure cases for the four model helpers (label map, type match, tip-name resolution with the preset fallback, stable topmost-first order without input mutation); add a dialog describe with an empty watercolor bundle whose listing mixes tools/kinds/positions that asserts row testids in order, dot/type/serial/position/tip text, the absence of `stroke-settings-tabs` and `stroke-settings-empty`, and the click -> selection -> tabs loop; add the non-empty and brush cases. Update the existing `keeps the sheet open on an empty water color selection` assertion (lines 1638-1653): the old caption assertion becomes absence-of-caption plus presence-of-list assertions. (`app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts`): add a listing-metadata case that records paint and lift strokes with distinct `brushId`s (one tip id, one preset id) and one custom `toolOverrides` bag, then asserts `tool`, `brushId` and `customResponse` per entry and that a deleted stroke and an other-frame stroke are absent. Run the targeted suites red before implementing, then green. Finish with ONE atomic commit for this task.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/strokeSettingsModel.test.ts src/components/physic-paint/view/aquarelleStrokeSelection.test.ts && pnpm --filter efx-motion-editor run typecheck</automated>
  </verify>
  <done>An empty watercolor select surface lists every type-filtered frame stroke topmost-first with type/serial/position/color/tip and an optional Custom response marker; clicking one row replaces the selection with exactly that id and brings the tabs back; a non-empty selection and the brush module show no list; the listing exposes the additive metadata; the caption is gone; targeted tests and typecheck are green; one atomic commit.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Finer filters, dropdowns, empty states, summary and sentence-case chrome</name>
  <files>app/src/components/physic-paint/view/aquarelleStrokeSelection.ts, app/src/components/physic-paint/view/strokeSettingsModel.ts, app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx, app/src/components/physic-paint/physicsPaintStudio.css, app/src/components/physic-paint/view/strokeSettingsModel.test.ts, app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts</files>
  <behavior>
    - Fine-filter state defaults to All; both setters are compare-then-write (1000 identical writes notify zero times); every `setAquarelleSelectMode` call (entry, re-entry while ON, exit) resets both; `setAquarelleStrokeTypeFilter` resets both only when the type value actually changes.
    - Tool options = "All tools" plus only the tools present in the type-filtered rows, in the canonical Brush, Water, Pen, Eraser order. Tip options = distinct `brushId`s in first-appearance order with resolved names, and the tip select renders only when more than one tip is present.
    - Changing the tool resets the tip filter to All when the current tip is not offered under the new tool; every offered tool/tip combination yields at least one row; a stored filter that the current rows do not offer is rendered as All without any render-body write.
    - The summary reads exactly `F<playFrame> · N strokes · P paint · E erasers` over the full frame listing; the messages are 'No strokes on this frame.' when the full listing is empty and 'No strokes match this filter.' when the filters yield none.
    - Paint/Eraser/All filter the list through the same signal the overlay/hit-test port reads; deleted and other-frame strokes never appear; the list container is inside the `SidebarScrollArea` scroll area.
    - The Paint/Eraser/All toggle buttons and every row button carry an explicit `textTransform: 'none'`; the brush-module sheet renders none of the new chrome.
  </behavior>
  <action>
    State (`app/src/components/physic-paint/view/aquarelleStrokeSelection.ts`): import `type AquarelleTool` from `@efxlab/efx-watercolor/payload`; add `export type AquarelleStrokeToolFilter = AquarelleTool | 'all'`, `export const aquarelleStrokeToolFilter = signal<AquarelleStrokeToolFilter>('all')` and `export const aquarelleStrokeTipFilter = signal<string>('all')` (value is 'all' or a recorded brushId), plus compare-then-write `setAquarelleStrokeToolFilter(next)` and `setAquarelleStrokeTipFilter(next)` and `resetAquarelleStrokeFineFilters()` which returns both to 'all' idempotently. Call `resetAquarelleStrokeFineFilters()` inside `setAquarelleSelectMode` beside the existing type reset and BEFORE `setScriptSelectMode` delegating (the same early-return reason documented there). In `setAquarelleStrokeTypeFilter`, capture the prior value with `.peek()` before the existing compare-then-write and call `resetAquarelleStrokeFineFilters()` only when it actually changed (after the type write). Do not change the type predicate, the selection pruning or the overlay/hit-test port.

    Model (`app/src/components/physic-paint/view/strokeSettingsModel.ts`): add `ALL_TOOL_FILTER_LABEL = 'All tools'`, `ALL_TIP_FILTER_LABEL = 'All tips'`; `listStrokeToolOptions(strokes)` returning the present tools in the canonical `brush, water, pen, lift` order; `listStrokeTipOptions(strokes)` returning distinct `{ brushId, name }` pairs in first-appearance order; `filterStrokeListRows(strokes, { tool, tip })` where 'all' matches everything; `resolveStrokeToolFilter(stored, options)` and `resolveStrokeTipFilter(stored, optionIds)` returning the stored value when offered, else 'all'; and `strokeListSummary(playFrame, strokes)` returning the exact `F{n} · {total} strokes · {paint} paint · {erasers} erasers` string, counting kind 'paint' and kind 'lift'. Keep everything pure.

    Dialog (`app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx`): read `aquarelleStrokeToolFilter.value` and `aquarelleStrokeTipFilter.value`. Compute `toolOptions`, `effectiveTool` (via `resolveStrokeToolFilter`), `toolRows` (`filterStrokeListRows(typeRows, { tool: effectiveTool, tip: 'all' })`), `tipOptions`, `effectiveTip` (via `resolveStrokeTipFilter` on the tip option ids) and `rows = sortStrokesTopmostFirst(filterStrokeListRows(typeRows, { tool: effectiveTool, tip: effectiveTip }))` — all pure render-body derivations, never writes. Render, under the type toggle row and only when `selectionEmpty`, a `div data-testid="stroke-settings-fine-filters"` with native selects: a tool select `data-testid="stroke-settings-tool-filter"` `aria-label="Tool filter"` carrying "All tools" plus `strokeToolLabel(option)`, and a tip select `data-testid="stroke-settings-tip-filter"` `aria-label="Tip filter"` carrying "All tips" plus the tip names, rendered only when `tipOptions.length > 1`; both use `class="physics-paint-stroke-settings-select"` and `value={effectiveTool}` / `value={effectiveTip}`. The tool onChange computes the tip options for the NEW tool from the current `typeRows`, calls `setAquarelleStrokeTipFilter(resolveStrokeTipFilter(currentTip, thoseTipIds))` and then `setAquarelleStrokeToolFilter(next)`; the tip onChange calls `setAquarelleStrokeTipFilter(next)`. Inside the list area, above the rows, render `data-testid="stroke-settings-list-summary"` with `strokeListSummary(bundle.playFrame, strokes)`; when `strokes.length === 0` render `data-testid="stroke-settings-list-empty-frame"` reading "No strokes on this frame."; otherwise when `rows.length === 0` render `data-testid="stroke-settings-list-empty-filter"` reading "No strokes match this filter."; otherwise the rows. Add `textTransform: 'none'` to the type toggle buttons (a filter-specific copy of `SEGMENT_STYLE`/`SEGMENT_ACTIVE_STYLE`; do not change the Stack or Paint segmented styles) and keep it on the row buttons.

    CSS (`app/src/components/physic-paint/physicsPaintStudio.css`): immediately after the `.physics-paint-stroke-settings-tabs .physics-paint-options-tab.active` rule (~line 1474) add sheet-scoped classes: `.physics-paint-stroke-settings-fine-filters` (flex row, 6px gap, `padding: 0 12px 10px`), `.physics-paint-stroke-settings-select` (copy the dark palette of `.physics-paint-scripts-scope-select` at ~1840: `background: #2a3036; color: #c9d1d9; border: 1px solid #3a424a; border-radius: 4px; font-size: 11px; padding: 2px 4px; min-width: 0; flex: 1 1 0; text-transform: none;`), `.physics-paint-stroke-settings-list` (flex column, 6px gap), `.physics-paint-stroke-settings-list-row` (grid `10px minmax(0, 1fr) auto`, 6px gap, width 100%, 5px 6px padding, 1px solid #565b61 border, 6px radius, transparent background, `color: #eef1f4`, left text, `text-transform: none`, pointer cursor, plus hover `border-color: #747b83; background: #414447` and `:focus-visible` outline `2px solid var(--color-accent, #2d5be3)`), and the meta classes for dot/type/serial/position/tip/custom (dot 10x10 rounded 2px with a 1px rgba border; serial/position monospace 10px secondary; type 11px 600 weight; tip 10px secondary with ellipsis; custom 9px italic secondary). Change no existing rule.

    Tests (`app/src/components/physic-paint/view/strokeSettingsModel.test.ts` and `aquarelleStrokeSelection.test.ts`): reset the two new signals in `beforeEach` via `resetAquarelleStrokeFineFilters()`. Add state cases: defaults, compare-then-write notification counts (effect-based, mirroring the existing select-mode test), reset on entry/exit/re-entry, reset only on an actual type change. Add model cases for tool options (presence/order), tip options (dedupe/order/names/fallback), filtering, both resolve helpers and the exact summary string. Add dialog cases with a mixed frame: the tool select lists only present tools; the tip select is hidden with one tip and lists names with two; clicking Eraser filters rows to lift strokes (the same ids the overlay port lists); the tool select narrows rows; a tool change that orphans the tip resets it to All; no option combination yields zero rows; the empty-frame and no-match messages; the summary text; the list container is found inside the `physics-paint-stroke-settings-scroll` scroll area; the toggle buttons and row buttons expose `style.textTransform === 'none'`; the brush module renders no fine filters and no list. Use `childrenOf` to collect all `stroke-settings-stroke-*` row testids in order (there is no findAll helper — filter the traversal by the testid prefix). Keep every other existing pin intact. Finish with ONE atomic commit for this task.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/strokeSettingsModel.test.ts src/components/physic-paint/view/aquarelleStrokeSelection.test.ts src/components/physic-paint/view/scriptStrokeEdition.test.ts src/components/physic-paint/view/aquarelleRecordState.reorder.test.ts && pnpm --filter efx-motion-editor run typecheck</automated>
  </verify>
  <done>The empty watercolor selection shows sentence-case Paint/Eraser/All toggles, an All-tools dropdown limited to the present tools, an All-tips dropdown only when more than one tip exists, a summary line and the topmost-first list with both empty messages; every filter combination offered has at least one row; the tip resets when orphaned; Paint/Eraser/All drive the list and the overlay from one signal; the sheet chrome, scrolling and the brush module are unchanged; targeted tests and typecheck are green; one atomic commit.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| project document -> list rows | Recorded `brushId`/`toolOverrides` strings from a saved document are displayed as row text |
| list row -> selection | A DOM click claims one mutationId as the whole selection |
| filter signals -> render | Render-body reads of module filter signals drive the displayed rows |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-quick-261031-euf-01 | Tampering | row text (`resolveStrokeTipName`, tool label) | low | mitigate | Names are rendered as text only (no innerHTML); `findTip` is fail-closed and an unknown id falls back to the raw recorded string; the tool label is a closed four-way map. |
| T-quick-261031-euf-02 | Tampering | row click -> selection | medium | mitigate | Rows exist only for the frame-scoped, non-deleted listing produced by `listSelectableAquarelleStrokes`; the click calls the existing compare-then-write replace setter `selectAquarelleStroke(id)`. No id is derived from DOM text or free input, and no other selection door is added. |
| T-quick-261031-euf-03 | Denial of Service | long frame listings | low | accept | The rendered row count is bounded by the frame's recorded, non-deleted strokes; rows live in the existing `SidebarScrollArea`; no extra per-frame computation beyond the existing listing call plus one stable sort and pure filter passes. |
| T-quick-261031-euf-04 | Tampering | fine-filter signals | low | mitigate | Compare-then-write setters; resets only at the select-mode choke point and on actual type-filter changes; effective values are derived read-only in the render body (no render-body writes, no effect-driven loops). |
| T-quick-261031-euf-SC | Tampering | pnpm installs | high | mitigate | No dependency is added and no package changes, so no install, legitimacy checkpoint or `dist` rebuild is required; the 2000 kB chunk ceiling is untouched. |
</threat_model>

<verification>
1. Targeted suites (cwd = checkout root): `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/strokeSettingsModel.test.ts src/components/physic-paint/view/aquarelleStrokeSelection.test.ts src/components/physic-paint/view/scriptStrokeEdition.test.ts src/components/physic-paint/view/aquarelleRecordState.reorder.test.ts` — green, never watch.
2. Typecheck: `pnpm --filter efx-motion-editor run typecheck` — clean.
3. Full app suite: `pnpm --filter efx-motion-editor exec vitest run` — zero regressions.
4. No package change: `packages/efx-watercolor/**` and `dist` are untouched (no rebuild).
5. Existing pins: the geometry, stack, tab, resize, close, Escape, dismissal, filter-row and Paint-tab cases pass; only the single `261029-eur` caption assertion is intentionally replaced by the list assertions.
6. Scope pin by inspection: `PhysicsPaintStudio.tsx` bundle (listStrokes default 'all'), `hitTestAquarelleStroke`, the overlay, `beginAquarelle*Edit`, `aquarelleRecordState.ts` and every persistence/schema file are unmodified.
7. Native UAT (human, live Studio): (1) enter Move/Edit with no selection -> the list under Paint/Eraser/All, no tabs; (2) Paint/Eraser/All filtering; (3) the tool dropdown and the tip dropdown; (4) click a row -> canvas selection + tabs, edit Geometry/Stack/Paint, clear the selection -> the list returns; (5) empty-frame and no-match messages; (6) scroll a long list and drag/resize/close the sheet; (7) a rail-key-script frame lists every stroke with its type; (8) labels are sentence case, not uppercase.
</verification>

<success_criteria>
- Empty watercolor Move/Edit: sentence-case Paint/Eraser/All toggles, the tool dropdown (present tools only), the tip dropdown only when more than one tip exists, the summary, and the topmost-first list; no tab row and no old caption.
- The list contains every recorded, non-deleted stroke of the current frame, live-filtered by Paint/Eraser/All and the finer filters; deleted and other-frame strokes never appear; every offered combination has at least one row; the tip filter resets when orphaned.
- Rows show the type name, creation serial, stack position (1 = topmost), color dot, recorded tip name with the raw-id fallback, and a Custom response marker only for non-neutral overrides; order is stable topmost-first.
- A row click selects exactly that mutationId through the shared setter, the canvas outlines it and the tabs return; clearing returns the list; a non-empty selection never shows the list.
- Empty states and the summary read exactly `No strokes on this frame.`, `No strokes match this filter.`, and `F<n> · N strokes · P paint · E erasers`.
- Fine filters default to All, reset on every select-mode entry/exit and on an actual type-filter change; no render-body signal writes.
- The list scrolls in the existing `SidebarScrollArea`; sheet drag/resize/close, the brush-module sheet and all rendering/hit-test/selection/persistence behavior are unchanged; no dependency added; no Vitest watch; no dev server.
- Targeted tests, typecheck and the full app suite are green, with one atomic commit per task.
</success_criteria>

<output>
Create `.planning/quick/261031-euf-task-stroke-list-in-the-stroke-settings-/261031-euf-SUMMARY.md` when done
</output>
