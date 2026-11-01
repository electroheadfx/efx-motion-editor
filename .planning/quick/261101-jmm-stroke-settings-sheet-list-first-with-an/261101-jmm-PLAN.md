---
phase: 261101-jmm-stroke-settings-sheet-list-first-with-an
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/physic-paint/view/strokeSettingsModel.ts
  - app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx
  - app/src/components/physic-paint/physicsPaintStudio.css
  - app/src/components/physic-paint/view/strokeSettingsModel.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
autonomous: true
requirements:
  - QUICK-261101-JMM
user_setup: []

estimate:
  tokens: 62000
  raw_tokens: 62000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "The watercolor Stroke settings sheet OPENS on the stroke list and the list STAYS visible while strokes are selected; the Geometry/Stack/Paint tab row appears only after the header settings icon is clicked, and that same icon (now a list icon) returns to the list."
    - "Settings entry is explicit and one-shot: once the selection has emptied — after a close/reopen, a leave and re-enter of Move/Select, or a delete that empties it — the next non-empty selection renders the LIST, and the tabs return only on a fresh click of the header settings icon."
    - "The header settings icon is NATIVELY disabled while the selection is empty; the global trash next to it is NATIVELY disabled while fewer than two strokes are selected."
    - "A plain row click replaces the selection, Cmd+click or Ctrl+click toggles one row, and Shift+click selects the inclusive range from the last-clicked row in the DISPLAYED order — all through the one shared scriptSelectedStrokeIds signal; the canvas group drag, transform handles and Geometry X/Y keep moving the whole list selection with no new move mechanism."
    - "A row's trash button deletes ONLY that stroke through the bundle's deleteStrokes (the same path as Backspace/Delete) and never runs a selection setter; the global trash deletes the whole current selection."
    - "A delete that empties the selection while in settings mode renders the list, never an empty settings panel."
    - "The Paint/Eraser/All type filter row, the tool/tip fine filters and the F<n> · N strokes · P paint · E erasers summary render in LIST view only; settings mode shows only the parameter tabs and their content."
    - "The brush sheet is unchanged: no list, no view toggle, no filter chrome, no trash, and its tab row renders as today."
  artifacts:
    - app/src/components/physic-paint/view/strokeSettingsModel.ts
    - app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx
    - app/src/components/physic-paint/physicsPaintStudio.css
    - app/src/components/physic-paint/view/strokeSettingsModel.test.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  key_links:
    - "settingsViewRef (ref-held signal, default 'list') + shouldInvalidateStrokeSettingsView plain marker + resolveStrokeSettingsView(effectiveRequest, selection.size) -> header toggle icon/disabled + list-vs-tabs render branch"
    - "row click -> selectAquarelleStroke / setAquarelleStrokeSelection / toggleAquarelleStrokeSelection -> scriptSelectedStrokeIds -> row is-selected, canvas outline, group drag, Geometry rows"
    - "resolveStrokeListRange(displayedIds, anchorIndex, clickedIndex) -> Shift+click range, anchor held in a plain useRef by displayed row index"
    - "row trash + global trash -> StrokeSettingsDialogBundle.deleteStrokes -> handleAquarelleDeleteStrokes -> beginAquarelleDeleteEdit (one undoable edit, one re-bake) -> clearSelectionIfGone -> derived view falls back to list"
    - ".physics-paint-stroke-settings-list-item:hover / :focus-within / .is-selected -> row trash reveal"
---

<objective>
Turn the watercolor Stroke settings sheet into a list-first surface with an explicit settings mode: the stroke list is the default view and stays visible while strokes are selected, the Geometry/Stack/Paint parameter tabs appear only after the header settings icon is clicked, that icon flips to a list icon to return, and the settings request is invalidated the moment the selection empties so every later non-empty selection lands back on the list. Add list multi-select (plain / Cmd-or-Ctrl / Shift range) on the existing shared selection, a per-row trash and a global trash on the same delete path as Backspace/Delete, and keep every filter and the summary in the list view only.

Purpose: quick 261031-euf made the list an empty-selection-only surface, so selecting a row immediately hid the list and swapped to the tabs. That inversion makes multi-stroke work awkward: you cannot see, compare or grow the selection you are editing. The list must stay put and the parameter panel must become something the user asks for.

Output: three pure model laws (view resolution, range resolution and the settings-request invalidation edge), the optional bundle delete member, the dialog view state and header controls, the restructured row (selectable button + sibling trash) with its CSS, all updated dialog tests plus new behavioural coverage, and the Studio bundle wiring of `handleAquarelleDeleteStrokes`. No persistence, no schema, no engine access from the dialog, no new move mechanism, no dependency change.
</objective>

<coverage_audit>
| SOURCE | ID | Item | Plan/Task | Status |
|--------|----|------|-----------|--------|
| GOAL | — | Stroke settings sheet: list-first with an explicit settings mode | 01 / all tasks | COVERED |
| REQ | R1 | List default and persistent; tabs only via the header settings icon; icon natively disabled when the selection is empty; the request is invalidated as soon as the selection empties, so every later non-empty selection lands on the list | 01 / T1 | COVERED |
| REQ | R2 | Plain / Cmd-or-Ctrl / Shift-range multi-select on the shared selection; existing move mechanisms untouched | 01 / T2 | COVERED |
| REQ | R3 | Per-row trash deletes only that stroke and does not change the selection itself | 01 / T2 | COVERED |
| REQ | R4 | Global trash deletes the whole selection; natively disabled below two | 01 / T2 | COVERED |
| REQ | R5 | Delete emptying the selection falls back to the list | 01 / T1 (derivation) + T2 (test) | COVERED |
| REQ | R6 | Type filter row, fine filters and summary render in list view only | 01 / T1 | COVERED |
| CONTEXT | D-1 | Ref-held @preact/signals view state, default 'list'; never useState | 01 / T1 | COVERED |
| CONTEXT | D-2 | Empty-selection fallback is a pure render derivation; no SIGNAL write, no effect; the empty-selection request invalidation is a plain non-signal module marker written idempotently in the render body (same precedent as `sawEmptySinceDismiss`) | 01 / T1 | COVERED |
| CONTEXT | D-3 | Shift anchor is a useRef holding the DISPLAYED row index, set on plain and Cmd/Ctrl clicks | 01 / T2 | COVERED |
| CONTEXT | D-4 | Row trash testid namespace distinct from the `stroke-settings-stroke-` prefix | 01 / T2 | COVERED |
| CONTEXT | D-5 | Global trash disabled below 2; row trash always enabled for its own row | 01 / T2 | COVERED |
| CONTEXT | D-6 | Both trashes call deleteStrokes, stopPropagation, and run no selection setter | 01 / T2 | COVERED |
| CONTEXT | G-1 | Optional bundle deleteStrokes wired to handleAquarelleDeleteStrokes in the body AND the memo dep array | 01 / T2 + T3 | COVERED |
| CONTEXT | G-2 | Row container restructured (outer div + selectable button + sibling trash); CSS grid anatomy preserved | 01 / T2 | COVERED |
| CONTEXT | G-3 | Header buttons stop pointerdown propagation | 01 / T1 (toggle) + T2 (trash) | COVERED |
| CONTEXT | G-4 | Watercolor only; brush sheet keeps no-list / no-chrome expectations | 01 / T1 | COVERED |
| CONTEXT | G-5 | Update the superseded 261031-euf tests and every test assuming a non-empty selection shows tabs — named fallout: the Stack-tab test (1332-1346), the watercolor field-set test (776), the re-keys-void test (1465), both Paint-tab tests (1628, 1655) — through a settings-entry helper that is idempotent within one test; add behavioural tests incl. the empty-then-non-empty re-entry; no CSS-rule assertions | 01 / T1 + T2 | COVERED |
| CONTEXT | G-6 | vitest run (never watch), no dev server, typecheck | 01 / all tasks | COVERED |
| CONTEXT | G-7 | efx-preact-reactivity: no useState, no render-body signal writes, idempotent setters | 01 / all tasks | COVERED |
</coverage_audit>

<execution_context>
@.claude/gsd-core/workflows/execute-plan.md
@.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md

<required_reading>
- .claude/skills/efx-preact-reactivity/SKILL.md
- app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx
- app/src/components/physic-paint/view/strokeSettingsModel.ts
- app/src/components/physic-paint/view/scriptStrokeEdition.ts (lines 107-167, the shared selection setters)
- app/src/components/physic-paint/view/aquarelleStrokeSelection.ts (lines 179-190, the watercolor aliases)
- app/src/components/sidebar/StrokeList.tsx (lines 106-130, the multi-select reference)
- app/src/components/physic-paint/PhysicsPaintStudio.tsx (lines 8084-8153 the delete handler; 10331-10373 the dialog bundle; 8507-8521 the edition-port registration)
- app/src/components/physic-paint/view/strokeSettingsModel.test.ts (lines 98-290 the harness; 1587-1757 the 261029-eur block; 2198-2612 the 261031-euf list block)
- app/src/components/physic-paint/physicsPaintStudio.css (lines 1499-1574 the stroke-list rules; 2072-2136 the scripts per-row trash precedent; 5654-5709 the header chrome)
- app/src/components/physic-paint/PhysicsPaintStudio.test.ts (lines 4120-4176 the stroke-settings source pins)
</required_reading>

Grounded facts (verified against the live tree — do not re-derive, do not invent APIs):

- The sheet is `PhysicsPaintStrokeSettingsDialog.tsx` (1224 lines). `selectionEmpty = selection.size === 0` currently gates the list-vs-tabs swap; the tab row is at ~793-821, the list block at ~825-896, the tab content at ~897-1205. `settingsTabRef` is a ref-held signal created at ~372-374 (`useRef<Signal<StrokeSettingsTab> | null>(null)` + lazy `signal('geometry')`). `engineModule = bundle?.module ?? 'brush'`. The header is at ~693-722 and already stops pointerdown propagation on the Close button (a comment there explains the drag's `preventDefault()` swallows child clicks).
- The sheet STAYS MOUNTED while closed (`PhysicsPaintStudioView.tsx:453` always renders it unless a picker is open) and returns null at `PhysicsPaintStrokeSettingsDialog.tsx:473`. Every render-body derivation, including the `shouldMarkSawEmpty` plain-flag block at 397-408, runs BEFORE that early return, so a render-body marker placed beside it also runs for a closed sheet. The watercolor close path is `closeMoveMode` -> `toggleAquarelleSelectMode()` (`PhysicsPaintStudio.tsx:10366-10368`) -> `setScriptSelectMode(false)` -> `clearScriptStrokeSelection()`, so a close always empties the selection and produces an empty render; the same holds for a rail toggle off or a delete-to-empty.
- `resetStrokeSettingsDialogLayout` (dialog 122-125) is the exported module-state reset, already called by the dialog test `beforeEach` (test 143-145) and it has NO production call site — the isolation point for module-level view state.
- `sawEmptySinceDismiss` (dialog 169) is the precedent for a plain, NON-signal module flag written idempotently in the render body, gated by the pure law `shouldMarkSawEmpty` (model 418-428). The invalidation marker follows the same shape so no render-body SIGNAL write is introduced.
- The tab row's testid is `stroke-settings-tabs` (dialog 798) and the list's is `stroke-settings-list` (827), so a test helper can decide "already in settings" from the tab row's presence.
- `StrokeSettingsDialogBundle` is at `strokeSettingsModel.ts` line 431; `reorderStroke`, `closeMoveMode` and `keepOpenOnEmpty` are optional members there. The module is Preact-free, signal-free and DOM-free.
- Shared selection (`scriptStrokeEdition.ts` 110-167): `scriptSelectedStrokeIds` (signal), `setScriptStrokeSelection(iterable)` (compare-then-write replace), `selectScriptStroke(id|null)`, `toggleScriptStrokeSelection(id)`. There is no range helper. `aquarelleStrokeSelection.ts` 179-190 re-exports `selectAquarelleStroke`, `setAquarelleStrokeSelection`, `toggleAquarelleStrokeSelection` as the watercolor aliases of the same functions.
- Multi-select reference (`StrokeList.tsx` 106-130): plain click clears + selects and sets the anchor, Cmd+click toggles and sets the anchor, Shift+click with an anchor >= 0 clears and selects the inclusive displayed range; Shift with no anchor falls through to plain. It tests only `e.metaKey`; this task requires Cmd OR Ctrl.
- The delete path: `PhysicsPaintStudio.tsx` `handleAquarelleDeleteStrokes` (8089) is the SAME handler registered as the watercolor edition port's `deleteStrokes` (8516, consumed by Backspace/Delete through `scriptStrokeEdition.ts` 454-462). It filters through `aquarelleStrokesOnFrame`, guards on physical lock / in-flight / real cell, calls `beginAquarelleDeleteEdit` (one undoable edit), then re-bakes and records.
- The dialog bundle is built at `PhysicsPaintStudio.tsx` 10335-10373 inside `strokeSettingsDialogPropsMemo.resolve([...], () => {...})`; the dep array currently ends with `handleAquarellePlaceStroke`. `handleAquarelleDeleteStrokes` is defined earlier (8089) and is therefore in scope at the memo site.
- Existing tests: the dialog harness (`strokeSettingsModel.test.ts`) mocks `preact/hooks` with a ref cursor runtime and keeps the real signals core; `renderDialogTab` (line 233) just clicks the tab and must now enter settings first. `strokeRows()` (249) matches BUTTON nodes whose testid starts with `stroke-settings-stroke-`. `createBundle` defaults to `module: 'brush'`, so the geometry and most Stack tests are brush and are UNAFFECTED by the list-first law; only watercolor bundles need the settings entry. Watercolor fixtures live at lines 586, 778, 1341, 1468, 1590, 1824, 2239.
- Test fallout confirmed by reading (the authoritative list is Task 1's fallout list): `renderDialogTab` and every watercolor call site — `renders the Stack tab for BOTH modules and mounts its section only when opened` (1332-1346, two consecutive watercolor `renderDialogTab` calls), `renders the full water color field set in canonical units` (776-809, two consecutive calls), `re-keys after a void (watercolor) commit too` (1465-1486, `renderDialogTab` then a direct `renderDialog`); `hides the Paint tab in Eraser mode…` (1628) and `hides the Paint tab whenever an eraser stroke is selected` (1655); the two superseded list tests (2292 `clicking a row selects exactly that stroke and brings the tabs back`, 2307 `a non-empty selection renders the tabs and content with no list`); and the fine-filter assertion inversion in `lives inside the app scroll area and keeps the chrome sentence case` (2587-2591).
- Studio source pins: `PhysicsPaintStudio.test.ts` 4168-4175 asserts the `reorderStroke:` wiring and the memo dep slice. Note the string `deleteStrokes: (ids) => handleAquarelleDeleteStrokes(ids),` ALSO exists at the edition-port registration (8516) and is already pinned at 3396/3617/3652 — a new pin for the BUNDLE must therefore be scoped to the bundle slice, not a whole-file `toContain`.
- Test command law: `pnpm --filter efx-motion-editor exec vitest run <app-relative path>` from the checkout root. Never watch (`pnpm … run test` is watch mode). Never start the dev server. Typecheck: `pnpm --filter efx-motion-editor run typecheck`. Vitest collects only `.test.ts` — extend the existing dialog harness, never create a `.test.tsx`.
- Preact law: no `useState`; no SIGNAL writes in a render body; the view state is a ref-held signal like `settingsTabRef`; the empty-selection fallback is derived; the request invalidation is a plain non-signal module marker (the `sawEmptySinceDismiss` precedent, written idempotently in the render body and cleared only from event handlers); setters are compare-then-write. The dialog is already the narrow leaf that reads `scriptSelectedStrokeIds`.
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: End-to-end list-first sheet — a selected stroke stays on the list, the header icon opens settings and returns</name>
  <files>app/src/components/physic-paint/view/strokeSettingsModel.ts, app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx, app/src/components/physic-paint/physicsPaintStudio.css, app/src/components/physic-paint/view/strokeSettingsModel.test.ts</files>
  <behavior>
    - RED first: with a watercolor bundle, select mode on and selection {9}, the rendered sheet shows `stroke-settings-list` with the row for 9 and NO `stroke-settings-tabs`; clicking `stroke-settings-view-toggle` and re-rendering shows `stroke-settings-tabs` plus the Geometry content and no list; clicking the same toggle again returns to the list with the row still visible.
    - `resolveStrokeSettingsView('settings', 0)` is 'list'; `resolveStrokeSettingsView('settings', 1)` and `('settings', 3)` are 'settings'; `resolveStrokeSettingsView('list', n)` is 'list' for every n.
    - `shouldInvalidateStrokeSettingsView({ requested: 'settings', selectionSize: 0 })` is true; it is false for `('list', 0)`, `('settings', 1)` and `('settings', 3)`.
    - Re-entry law (the blocker case): with a watercolor bundle enter settings via the toggle, then empty the selection and re-render (the close/reopen and delete-to-empty shape). The sheet is in LIST view; set a non-empty selection again and re-render — it is STILL the list with no tab row, because the request was invalidated by the empty interval. Only a fresh click on `stroke-settings-view-toggle` returns to the tabs, and a second empty -> non-empty cycle behaves the same way.
    - A non-empty -> non-empty selection change (add or remove a row while already in settings) keeps the current view; it never invalidates the request.
    - On an empty watercolor selection the sheet is open (keepOpenOnEmpty) and the toggle exists with `props.disabled === true`; with a non-empty selection it is `false`.
    - In list view with a non-empty selection the type filter row, the fine filters and the summary are all present; in settings view all three are absent while the tabs are present.
    - A brush bundle with a non-empty selection renders its tab row exactly as today, with no toggle, no list and no filter chrome.
  </behavior>
  <action>
    Model (`app/src/components/physic-paint/view/strokeSettingsModel.ts`): add `export type StrokeSettingsView = 'list' | 'settings';` and the pure law `resolveStrokeSettingsView(requested: StrokeSettingsView, selectionSize: number): StrokeSettingsView` returning `'settings'` only when `requested === 'settings' && selectionSize > 0`, else `'list'`. Document it as the empty-selection fallback: a render-time derivation, never a signal write and never an effect. Add the companion pure law `shouldInvalidateStrokeSettingsView(args: { requested: StrokeSettingsView; selectionSize: number }): boolean` returning true only when `args.requested === 'settings' && args.selectionSize === 0`. It is the staleness gate for the request: a settings request survives a non-empty -> non-empty selection change but never survives the selection being observed empty (the close/reopen and delete-to-empty cycles). Mirror the `SawEmptyArgs` / `shouldMarkSawEmpty` shape so the render-body marker it gates stays a plain non-signal flag. Keep the module Preact-free, signal-free and DOM-free.

    Dialog (`app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx`): import `List` and `Settings2` from `lucide-preact` (keep `SlidersHorizontal` and `X`), and import `resolveStrokeSettingsView`, `shouldInvalidateStrokeSettingsView` plus the `StrokeSettingsView` type from `./strokeSettingsModel`. Beside `settingsTabRef` and BEFORE the `if (!bundle || !open) return null;` early return, create the ref-held view signal exactly like the tab signal: `const settingsViewRef = useRef<Signal<StrokeSettingsView> | null>(null); if (!settingsViewRef.current) settingsViewRef.current = signal<StrokeSettingsView>('list');`.

    Beside the module flag `sawEmptySinceDismiss` (line 169) declare `let strokeSettingsViewInvalidated = false;` — a PLAIN module flag, never a signal, so no render-body signal write is introduced. After `engineModule` and `selection` are read (376-380), and next to the existing `shouldMarkSawEmpty` block (397-408) but still BEFORE the early return, read `const requestedView = settingsViewRef.current.value;` and write the marker idempotently: when `engineModule === 'watercolor'` and `shouldInvalidateStrokeSettingsView({ requested: requestedView, selectionSize: selection.size })` is true, set `strokeSettingsViewInvalidated = true`. The gate only fires on a stale `'settings'` request over an empty selection, so it is inert for brush and for every list-first render. Because it sits before the early return it also runs while the sheet is closed — that is what makes the close/reopen cycle invalidate the request (the close path leaves Move/Select, which clears the selection). Then derive `const effectiveRequest: StrokeSettingsView = strokeSettingsViewInvalidated ? 'list' : requestedView;` and `const view: StrokeSettingsView = engineModule === 'watercolor' ? resolveStrokeSettingsView(effectiveRequest, selection.size) : 'settings';` — pure render-body reads with no signal write.

    Reset the marker in `resetStrokeSettingsDialogLayout` (line 122-125): add `strokeSettingsViewInvalidated = false;` and widen its doc comment to say it resets the module-level dialog session state (layout plus the view-request invalidation marker). That function has no production call site and the dialog test `beforeEach` already calls it, so each test starts at the same fresh state as a mounted dialog. Do NOT reset it anywhere in a render body or an effect.

    Header (~693-722): between the spacer and the Close button, for `engineModule === 'watercolor'` only, render a view-toggle `<button type="button" data-testid="stroke-settings-view-toggle" class="physics-paint-stroke-settings-header-button" aria-pressed={view === 'settings'} aria-label=... title=... disabled={selection.size === 0} onPointerDown={(event) => event.stopPropagation()} onClick={...}>`. The aria-label/title read "Show stroke settings" in list view and "Show stroke list" in settings view. The onClick computes `const next = view === 'settings' ? 'list' : 'settings';`, clears the marker first when entering settings (`if (next === 'settings') strokeSettingsViewInvalidated = false;`) and writes the requested view with compare-then-write (`if (settingsViewRef.current!.value !== next) settingsViewRef.current!.value = next;`) — both are event-handler writes only. That click is the ONE explicit request, so it is also the only clear site for the marker (the same shape as `sawEmptySinceDismiss = false` in `closeSurface`). The child is `<Settings2 size={12} aria-hidden="true" />` in list view and `<List size={12} aria-hidden="true" />` in settings view. Keep the leading decorative `SlidersHorizontal` icon, the title and the Close button unchanged, and keep the drag handlers on the header div.

    Gating: change the type-filter row condition to `engineModule === 'watercolor' && view === 'list'`; change the fine-filters condition to `engineModule === 'watercolor' && view === 'list'` (it currently keys on `selectionEmpty`); change the tab-row condition to `view === 'settings'` (it currently keys on `!selectionEmpty`); change the `SidebarScrollArea` content branch to render the list block when `view === 'list'` and the tab sections otherwise. Do not change the list rows, `activeSettingsTab`, the geometry/stack derivations, the dismissal law or `resolveStrokeSettingsOpen`.

    CSS (`app/src/components/physic-paint/physicsPaintStudio.css`, after the `.physics-paint-photo-reference-close:focus-visible` rule ~5709): add `.physics-paint-stroke-settings-header-button` with the same 22x22 rounded chrome as the close button (`display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; padding: 0; border: 1px solid #3a4652; border-radius: 6px; background: #2a3540; color: #b9c3ce; line-height: 0; cursor: pointer;`), a `:hover:not(:disabled)` variant, the shared `:focus-visible` outline, and `:disabled { opacity: 0.4; cursor: default; }`. Change no existing rule.

    Tests (`app/src/components/physic-paint/view/strokeSettingsModel.test.ts`): add the `resolveStrokeSettingsView` and `shouldInvalidateStrokeSettingsView` pure case sets. Add an IDEMPOTENT `renderSettings(bundle)` helper: render the dialog, and enter settings ONLY when the returned tree has no `stroke-settings-tabs` AND a `stroke-settings-view-toggle` exists whose `disabled` prop is falsy — in that case invoke that toggle's onClick and re-render. When the tab row is already present, do nothing and return the tree as-is, so repeated `renderSettings` calls inside ONE test can never flip settings back to list (the toggle writes the opposite of the resolved view). Rewrite `renderDialogTab` to call `renderSettings` first, then click the tab. Use `renderSettings` for every watercolor tree that must be in settings mode.

    Fallout list — every existing case this change breaks, and nothing else: the `renderDialogTab` helper itself; `renders the Stack tab for BOTH modules and mounts its section only when opened` (1332-1346 — its two watercolor `renderDialogTab` calls must stay in settings through the idempotent helper; its assertions are unchanged); `renders the full water color field set in canonical units` (776-809 — two consecutive watercolor `renderDialogTab` calls); `re-keys after a void (watercolor) commit too` (1465-1486 — `renderDialogTab` then a direct `renderDialog`, which must stay in settings because a non-empty -> non-empty change never invalidates); `hides the Paint tab in Eraser mode and falls a paint request back to Geometry` (1628-1653) and `hides the Paint tab whenever an eraser stroke is selected, even on All` (1655-1672) — every direct `renderDialog` that asserts a tab becomes `renderSettings`; `clicking a row selects exactly that stroke and brings the tabs back` (2292) and `a non-empty selection renders the tabs and content with no list` (2307), both superseded; and the final assertion block of `lives inside the app scroll area and keeps the chrome sentence case` (2587-2591). Brush-module cases (createBundle defaults to `module: 'brush'`, whose view is forced to 'settings') and every 261031-euf list case that renders an EMPTY selection stay green unchanged.

    Rewrite `clicking a row selects exactly that stroke and brings the tabs back` as: the row click sets the selection to exactly {9} through the shared setter, the list STAYS and the tabs remain absent; then the toggle enters settings. Rewrite `a non-empty selection renders the tabs and content with no list` as: a non-empty selection renders the list rows with no tabs, and the toggle reveals the tabs. In `lives inside the app scroll area and keeps the chrome sentence case` invert the final assertion: with a non-empty selection still in list view the fine filters and tool filter ARE present; after entering settings they are absent.

    Add the new behavioural cases: toggle disabled on empty and enabled with a selection; list-to-settings-to-list round trip with the row still listed; the RE-ENTRY law (enter settings with selection {9}, set the selection empty and re-render -> list, then set it back to {9} and re-render -> STILL the list with no tab row; only a fresh toggle click returns to the tabs; repeat the empty -> non-empty -> toggle cycle once more to prove the invalidation is not one-shot); a non-empty -> non-empty selection change in settings keeps the tabs; filters + summary list-only; the brush bundle offers no toggle and keeps its tabs. Do not add CSS-rule assertions. Finish with ONE atomic commit.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/strokeSettingsModel.test.ts && pnpm --filter efx-motion-editor run typecheck</automated>
  </verify>
  <done>A watercolor sheet with any selection opens on the stroke list, keeps the list while strokes are selected, and shows the parameter tabs only after the header settings icon is clicked; the same icon returns to the list; a settings request never survives an empty selection, so after a close/reopen, a leave and re-enter of Move/Select, or a delete-to-empty the next non-empty selection renders the list and only a fresh icon click returns to the tabs (pinned by a behavioural test); the icon is natively disabled on an empty selection; the type filter row, fine filters and summary appear in list view only; the brush sheet is unchanged; the settings-entry test helper is idempotent and the named fallout tests (including the Stack-tab test) are green; the targeted suite plus typecheck are green; one atomic commit.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: List multi-select, per-row trash and global trash on the shared delete path</name>
  <files>app/src/components/physic-paint/view/strokeSettingsModel.ts, app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx, app/src/components/physic-paint/physicsPaintStudio.css, app/src/components/physic-paint/view/strokeSettingsModel.test.ts</files>
  <behavior>
    - `resolveStrokeListRange([9, 7, 8], 0, 2)` returns `[9, 7, 8]` in displayed order; `([9, 7, 8], 2, 0)` also returns `[9, 7, 8]`; `([9, 7, 8], 1, 1)` returns `[7]`; an empty list, a negative index, a non-integer index or an index past the end returns `[]`. Every mutation id in these examples is a NUMBER — the production signature is `readonly number[]` and the strict project typecheck rejects a string-id copy.
    - Plain click on row 9 replaces the selection with {9}; Cmd+click row 7 makes it {7,9}; Ctrl+click row 9 leaves {7}; a Shift+click from the anchor to another displayed index selects the inclusive displayed range; a Shift+click before any plain/Cmd click behaves as a plain click.
    - A row trash click calls `bundle.deleteStrokes` with exactly that row's id, calls `stopPropagation` on the event, and leaves `scriptSelectedStrokeIds` unchanged (no selection setter runs).
    - The global trash is natively disabled with fewer than two strokes selected and enabled with two or more; clicking it calls `bundle.deleteStrokes` with the whole current selection.
    - When a delete leaves the selection empty while the requested view is settings, the next render shows the list and the tabs are absent; selecting another stroke afterwards keeps the list (the delete-to-empty also invalidated the request).
    - A row whose id is in the selection carries the `is-selected` class on its list-item wrapper.
  </behavior>
  <action>
    Model (`app/src/components/physic-paint/view/strokeSettingsModel.ts`): add the optional bundle member `readonly deleteStrokes?: (ids: readonly number[]) => boolean | Promise<boolean> | void;` to `StrokeSettingsDialogBundle` (documented as the same path as Backspace/Delete; absent hides both trash affordances). Add the pure law `resolveStrokeListRange(orderedIds: readonly number[], anchorIndex: number, clickedIndex: number): number[]`: return `[]` when the list is empty or either index is not an integer within `0..orderedIds.length - 1`; otherwise return `orderedIds.slice(Math.min(anchor, clicked), Math.max(anchor, clicked) + 1)`, preserving the displayed order.

    Dialog (`app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx`): import `Trash2` from `lucide-preact`; import `setAquarelleStrokeSelection` and `toggleAquarelleStrokeSelection` from `./aquarelleStrokeSelection` (keep `selectAquarelleStroke`); import `resolveStrokeListRange` from `./strokeSettingsModel`. Add `const rowAnchorRef = useRef<number>(-1);` beside the other refs before the early return. After the early return bind `const deleteStrokes = bundle.deleteStrokes;`.

    Header: immediately before the view-toggle button and only when `engineModule === 'watercolor'` and `deleteStrokes` is present, render the global trash `<button type="button" data-testid="stroke-settings-delete-selection" class="physics-paint-stroke-settings-header-button" aria-label="Delete selected strokes" title="Delete selected strokes" disabled={selection.size < 2} onPointerDown={(event) => event.stopPropagation()} onClick={() => { void deleteStrokes([...selection]); }}>` with `<Trash2 size={12} aria-hidden="true" />`.

    List rows: derive `const displayedIds = listRows.map((stroke) => stroke.mutationId);` once. Map `listRows` with its displayed `index`. Replace the row's `key`-owning button with an outer `<div key={stroke.mutationId} data-testid={`stroke-settings-row-${stroke.mutationId}`} class={`physics-paint-stroke-settings-list-item${selection.has(stroke.mutationId) ? ' is-selected' : ''}`}>` holding the existing selectable `<button>` UNCHANGED (same testid `stroke-settings-stroke-<id>`, same `physics-paint-stroke-settings-list-row` class, inline `textTransform: 'none'`, aria-label and dot/type/serial/meta children) plus, when `deleteStrokes` is present, a SIBLING trash `<button type="button" data-testid={`stroke-settings-row-delete-${stroke.mutationId}`} class="physics-paint-stroke-settings-list-row-delete" aria-label={`Delete stroke #${stroke.serial}`} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); void deleteStrokes([stroke.mutationId]); }}>` with `<Trash2 size={12} aria-hidden="true" />`. The trash runs NO selection setter.

    Row click: replace the row button's onClick with a handler taking `(mutationId, index, event)` that reads `event.shiftKey`, `event.metaKey` and `event.ctrlKey`: when `shiftKey` and `rowAnchorRef.current >= 0`, call `setAquarelleStrokeSelection(resolveStrokeListRange(displayedIds, rowAnchorRef.current, index))` and return; when `metaKey || ctrlKey`, call `toggleAquarelleStrokeSelection(mutationId)` and set `rowAnchorRef.current = index`; otherwise call `selectAquarelleStroke(mutationId)` and set `rowAnchorRef.current = index`. Mirror the StrokeList law, including falling through to plain when a Shift click has no anchor. Do not add any move, drag or transform code: the canvas group drag, transform handles and Geometry rows keep reading the same shared selection and already operate on the whole set.

    CSS (`app/src/components/physic-paint/physicsPaintStudio.css`, after the existing stroke-list rules ~1574): add `.physics-paint-stroke-settings-list-item` as the flex row wrapper (`display: flex; align-items: stretch; gap: 4px;`), give `.physics-paint-stroke-settings-list-row` `flex: 1 1 0; min-width: 0;` while KEEPING its 3-column grid, and add `.physics-paint-stroke-settings-list-row-delete` mirroring the `.physics-paint-script-row-delete` precedent (22x22, transparent background, `opacity: 0; pointer-events: none;`), revealed by `.physics-paint-stroke-settings-list-item:hover`, `:focus-within` and `.is-selected`, with a red-tinted `:hover`, a `:focus-visible` outline, and an optional subtle `.is-selected .physics-paint-stroke-settings-list-row` border/background so the selected state reads. Change no existing row rule beyond the flex addition.

    Tests (`app/src/components/physic-paint/view/strokeSettingsModel.test.ts`): add `resolveStrokeListRange` pure cases. Add a watercolor list test that walks the three gestures end to end on the shared signal: plain replace, Cmd toggle, Ctrl toggle, Shift range forward and backward, and Shift with no anchor acting as plain. Add a row-trash case with a `vi.fn()` bundle `deleteStrokes`: with selection {9}, click `stroke-settings-row-delete-7` passing an event whose `stopPropagation` is a spy; expect `deleteStrokes` called with `[7]`, `stopPropagation` called, and the selection still exactly {9}. Add a global-trash case: one selected -> `disabled === true`; two selected -> `false`; click -> `deleteStrokes([...selection])`; also assert its `onPointerDown` stops propagation. Add the fallback case: enter settings with two selected (via the idempotent `renderSettings`, so the tabs are really up), use a mock `deleteStrokes` that calls `setScriptStrokeSelection([])`, click the global trash, re-render, and expect the list present with no tabs; then select a row again and re-render and expect the LIST to remain (the delete-to-empty also invalidated the pending settings request — no icon click). Assert the `is-selected` class on the selected row's wrapper. Keep every unrelated pin intact and add no CSS-rule assertions. Finish with ONE atomic commit.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/strokeSettingsModel.test.ts && pnpm --filter efx-motion-editor run typecheck</automated>
  </verify>
  <done>Plain click replaces, Cmd or Ctrl toggles, and Shift selects the inclusive displayed range from the last-clicked anchor, all through the one shared selection; each row exposes a trash that deletes only its own stroke through the bundle without selecting it; the header global trash deletes the whole selection and is natively disabled below two strokes; both trash buttons stop pointerdown/click propagation; a delete that empties the selection renders the list instead of an empty settings panel; the targeted suite and typecheck are green; one atomic commit.</done>
</task>

<task type="auto">
  <name>Task 3: Wire the dialog's delete member to the Studio's shared delete handler</name>
  <files>app/src/components/physic-paint/PhysicsPaintStudio.tsx, app/src/components/physic-paint/PhysicsPaintStudio.test.ts</files>
  <action>
    Studio (`app/src/components/physic-paint/PhysicsPaintStudio.tsx`): inside the `strokeSettingsDialogPropsMemo.resolve([...], () => { ... })` bundle body (10335-10373), add `deleteStrokes: (ids) => handleAquarelleDeleteStrokes(ids),` beside `transformStrokes`/`reorderStroke`, with a short comment stating that the sheet's trash uses the SAME handler as Backspace/Delete and that the dialog never touches the engine. Add `handleAquarelleDeleteStrokes` to the memo's dependency array (the list currently ends with `handleAquarellePlaceStroke`); it is a stable `useCallback` defined at 8089 and is in scope. Do not change the handler itself, the edition-port registration at 8512-8521, or any other bundle member.

    Tests (`app/src/components/physic-paint/PhysicsPaintStudio.test.ts`, the stroke-settings source-pin describe around 4168): extend `wires the watercolor bundle callback and the memo dependency` so it still asserts the existing `reorderStroke:` line and `handleAquarellePlaceStroke` in the dep slice, and additionally (a) asserts that the memo dep slice between `strokeSettingsDialogPropsMemo.resolve(` and the following `() => {` contains `handleAquarelleDeleteStrokes`, and (b) asserts that the bundle-body slice from that `() => {` to `const viewModel = usePhysicsPaintStudioViewModel({` contains `deleteStrokes: (ids) => handleAquarelleDeleteStrokes(ids),`. Scope the assertion to that slice because the same string already exists at the edition-port registration and a whole-file check would pass without the bundle wiring. Keep every other pin in the file untouched. Finish with ONE atomic commit.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts src/components/physic-paint/view/strokeSettingsModel.test.ts && pnpm --filter efx-motion-editor run typecheck</automated>
  </verify>
  <done>The Stroke settings bundle exposes `deleteStrokes` wired to `handleAquarelleDeleteStrokes` and the memo dependency array includes that callback; the Studio source pins prove the bundle wiring in the scoped slice; the two targeted suites and typecheck are green; one atomic commit.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

Security enforcement is active (ASVS level 1, block on high). Everything in this quick is in-repo UI state over the existing local document: no network IO, no user text parsing, no persistence or schema change, and no credentials. The boundaries below are recorded so the surface is explicit rather than omitted.

| Boundary | Description |
|----------|-------------|
| recorded document strokes -> row text | Tool/tip/color/serial metadata from the saved document is displayed in rows and aria-labels |
| list row click -> shared selection | A DOM click claims ids in the one `scriptSelectedStrokeIds` signal |
| trash click -> bundle deleteStrokes | A UI control reaches the existing delete edit path (undo ledger + re-bake) |
| view signal -> render | A ref-held signal selects list vs settings on every render |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-quick-261101-jmm-01 | Tampering | row click -> `scriptSelectedStrokeIds` | low | mitigate | Rows exist only for the frame-scoped, non-deleted listing produced by `bundle.listStrokes`; every gesture calls the existing compare-then-write shared setters (`selectAquarelleStroke`, `toggleAquarelleStrokeSelection`, `setAquarelleStrokeSelection`); no id is derived from DOM text or free input, and no second selection source is introduced. |
| T-quick-261101-jmm-02 | Tampering | row/global trash -> `deleteStrokes` | medium | mitigate | Both trashes pass a row's own `mutationId` or the current selection array to the SAME `handleAquarelleDeleteStrokes` used by Backspace/Delete, which re-filters through `aquarelleStrokesOnFrame` and keeps its physical-lock, in-flight and real-cell guards. The dialog gets no engine access and adds no delete implementation. |
| T-quick-261101-jmm-03 | Denial of Service | view signal / render loop | low | mitigate | The view is a ref-held signal written only from click handlers with compare-then-write; the empty-selection fallback and the request-invalidation gate are pure derivations; the ONLY render-body write is a plain (non-signal) idempotent module flag gated by `shouldInvalidateStrokeSettingsView` — the same precedent as `sawEmptySinceDismiss`, so it notifies no subscriber and cannot start a reactive loop; no new effect is added. |
| T-quick-261101-jmm-04 | Information Disclosure | row labels and aria-labels | low | accept | The row shows metadata already visible in the Studio canvas and panel; nothing new is exposed off-device and nothing is persisted. |
| T-quick-261101-jmm-SC | Tampering | pnpm installs | high | mitigate | No dependency is added or upgraded, so no install, legitimacy checkpoint or `dist` rebuild is required; the desktop chunk ceiling is untouched. |
</threat_model>

<verification>
1. Targeted dialog suite (cwd = checkout root): `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/strokeSettingsModel.test.ts` — green, never watch.
2. Targeted Studio suite: `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts` — green.
3. Typecheck: `pnpm --filter efx-motion-editor run typecheck` — clean.
4. Full app suite: `pnpm --filter efx-motion-editor exec vitest run` — zero regressions.
5. Source-level scope pins by inspection: no second selection signal or setter is introduced; `scriptSelectedStrokeIds` remains the only selection source; no move/drag/transform code is added; the dialog imports no engine module; no persistence, schema, bundle-format or package file is touched; the Studio delete handler, the edition-port registration and the script-edition module are unmodified.
6. Updated-pin check: the only intentionally changed existing assertions are the two superseded 261031-euf list tests (2292, 2307), the fine-filter assertion in the chrome test (2587-2591), the `renderDialogTab`/`renderSettings` helpers, and the direct `renderDialog` tab assertions in the two Paint-tab tests (1628-1653, 1655-1672). Every other pin is untouched and green, including `renders the Stack tab for BOTH modules and mounts its section only when opened` (1332-1346), `renders the full water color field set in canonical units` (776), `re-keys after a void (watercolor) commit too` (1465), geometry, resize, close, Escape, dismissal and the Paint seed switch. If any named case besides those needs an assertion edit, add it here with its reason before committing.
7. Re-entry law check: the invalidation marker is the ONLY render-body write, it is a plain non-signal module flag, it is gated by the pure `shouldInvalidateStrokeSettingsView`, it clears only in the toggle's click handler and in `resetStrokeSettingsDialogLayout`, and no effect or signal write was added.
8. Native UAT (human, live Studio — do not claim done before these pass): (1) Move/Edit with an empty selection -> the list; (2) plain click a row -> it selects, the list STAYS, the canvas outlines it; (3) click the header settings icon -> Geometry/Stack/Paint appear; click the list icon -> the list returns with the row still selected; (4) Cmd+click and Ctrl+click add/remove rows; (5) Shift+click selects a range topmost-first, both directions; (6) the per-row trash appears on hover and on a selected row, deletes only that stroke, and the selection of other rows survives (minus the deleted id); (7) select two or more and use the global trash — enabled; with one selected it is disabled; (8) with a delete that empties the selection while in settings mode the sheet shows the list, and selecting a stroke afterwards KEEPS the list (no icon click); (9) the Paint/Eraser/All row, the tool/tip dropdowns and the F<n> summary are visible in the list and absent in settings; (10) the canvas group drag, transform handles and Geometry X/Y still move the whole selection; (11) the brush sheet is unchanged; (12) the close/reopen cycle: enter settings, close the sheet (leaving Move/Select), re-enter Move/Select and select a stroke -> the LIST is shown, never the tabs; only the header icon brings the tabs back.
</verification>

<success_criteria>
- The watercolor Stroke settings sheet is list-first: the list is the default view and stays visible while strokes are selected; the parameter tabs appear only via the header settings icon, and that icon flips to a list icon to return.
- Settings entry is explicit and one-shot: an empty selection invalidates the pending request, so after a close/reopen, a leave and re-enter of Move/Select, or a delete-to-empty the next non-empty selection renders the LIST and the tabs return only on a fresh icon click — pinned by a behavioural test.
- The header settings icon is natively disabled on an empty selection; the global trash is natively disabled below two selected strokes.
- Plain click replaces, Cmd or Ctrl click toggles, Shift click selects the inclusive displayed range from the last-clicked anchor, all through the single shared `scriptSelectedStrokeIds`; the existing canvas drag, transform handles and Geometry X/Y move the whole list selection with no new mechanism.
- Each row has a sibling trash that deletes only that stroke through the bundle's `deleteStrokes`, runs no selection setter and stops propagation; the global trash deletes the whole current selection through the same path.
- A delete that empties the selection while in settings mode renders the list, never an empty settings panel, and a later selection keeps the list until the icon is clicked.
- The Paint/Eraser/All row, the tool/tip fine filters and the F<n> summary render in list view only.
- The brush sheet keeps no list, no toggle, no filters and no trash; all existing geometry/Stack/Paint behaviour is unchanged.
- `resolveStrokeSettingsView`, `resolveStrokeListRange` and `shouldInvalidateStrokeSettingsView` are pure, exported and covered; the bundle's `deleteStrokes` is optional and wired to `handleAquarelleDeleteStrokes` in both the bundle body and the memo dependency array.
- The settings-entry test helper is idempotent within a test, and every newly broken existing test (including the watercolor Stack-tab case) is named in the plan and green.
- No `useState`, no render-body SIGNAL writes (the only render-body write is the plain, non-signal request-invalidation flag, mirroring `sawEmptySinceDismiss`), no new effect; no dependency, persistence or schema change; targeted suites, typecheck and the full app suite are green with one atomic commit per task; Vitest is never run in watch mode and the dev server is never started.
</success_criteria>

<output>
Create `.planning/quick/261101-jmm-stroke-settings-sheet-list-first-with-an/261101-jmm-SUMMARY.md` when done
</output>
