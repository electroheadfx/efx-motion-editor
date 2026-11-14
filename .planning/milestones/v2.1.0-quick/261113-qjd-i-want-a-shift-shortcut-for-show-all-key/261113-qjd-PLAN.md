---
phase: 261113-qjd-i-want-a-shift-shortcut-for-show-all-key
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/overlay/shortcutsHelp.ts
  - app/src/components/overlay/shortcutsHelp.test.ts
  - app/src/components/overlay/ShortcutsOverlay.tsx
  - app/src/components/overlay/shortcutsOverlayContextWiring.test.ts
autonomous: true
requirements: [QUICK-261113-QJD]
user_setup: []

estimate:
  tokens: 45000
  raw_tokens: 45000
  tasks: 2
  confidence: low

must_haves:
  truths:
    - "Pressing Shift+? while paint edit mode is active opens the overlay on the Paint Mode tab and shows the detected-context label (D-01/D-02)."
    - "With paint mode off, the overlay opens on Timeline when the pointer is over the timeline, on Canvas when it is over the canvas, and on the Sections index otherwise; the label always states the detected context (D-01/D-02)."
    - "Every group stays reachable while the overlay is open: tab clicks, Left/Right (and Tab), Up/Down plus Enter from the Sections index, and number keys 1 through 9 (D-02)."
    - "The Paint Mode tab lists only bindings that really exist — select tool, swap foreground/background and leave paint mode are documented, the select-all row names its tool, and the row with no binding is gone. The Timeline tab names Alt+S for solo and makes no bare-S solo claim (D-03)."
    - "Context resolution is a pure module with zero imports (no DOM, no signals), covered by a node .test.ts; the overlay reads paintMode and mouseRegion once at mount with .peek() and writes no signal during render (D-04)."
    - "The Shift+? binding, the overlay mount point, fullscreen suppression and every other shortcut group are unchanged."
  artifacts:
    - path: "app/src/components/overlay/shortcutsHelp.ts"
      provides: "The help catalog (9 groups), ShortcutEntry/ShortcutGroup types, SHORTCUT_TAB_LABELS/SHORTCUT_TAB_COUNT, ShortcutsContextId, resolveShortcutsContext, SHORTCUTS_CONTEXT_GROUP_TITLE, resolveShortcutsInitialTab, resolveShortcutsTabNumber, SHORTCUTS_CONTEXT_COPY — zero imports"
    - path: "app/src/components/overlay/shortcutsHelp.test.ts"
      provides: "Pure pins: resolver precedence, initial-tab mapping, tab label/count shape, context copy completeness, module purity, corrected catalog content, number-key range"
    - path: "app/src/components/overlay/ShortcutsOverlay.tsx"
      provides: "Imports the catalog module, seeds context and activeTab from .peek() reads at mount, renders the always-visible detected-context label, and routes number keys through resolveShortcutsTabNumber"
    - path: "app/src/components/overlay/shortcutsOverlayContextWiring.test.ts"
      provides: "Source pins: the two .peek reads, the single resolver call, the seeded tab, the label tokens, no local catalog, the number-key helper, and the unchanged Shift+? binding"
  key_links:
    - from: "app/src/components/overlay/ShortcutsOverlay.tsx"
      to: "app/src/components/overlay/shortcutsHelp.ts"
      via: "resolveShortcutsContext({paintMode: paintStore.paintMode.peek(), mouseRegion: uiStore.mouseRegion.peek()}) inside the first useState initializer"
    - from: "app/src/components/overlay/ShortcutsOverlay.tsx"
      to: "app/src/components/overlay/shortcutsHelp.ts"
      via: "resolveShortcutsInitialTab(context) seeding the activeTab useState"
    - from: "app/src/components/overlay/ShortcutsOverlay.tsx"
      to: "app/src/components/overlay/shortcutsHelp.ts"
      via: "resolveShortcutsTabNumber(num) in the number-key branch of the capture-phase keydown handler"
    - from: "app/src/lib/shortcuts.ts"
      to: "app/src/stores/uiStore.ts"
      via: "'Shift+?' -> uiStore.toggleShortcutsOverlay() — unchanged binding, must stay the only opener"
    - from: "app/src/components/layout/EditorShell.tsx"
      to: "app/src/components/overlay/ShortcutsOverlay.tsx"
      via: "conditional mount on uiStore.shortcutsOverlayOpen.value — unchanged"
---

<objective>
Make the Shift+? shortcut overlay context-aware: opening it lands on the help group for the surface the user is actually working on, and says so — paint edit mode shows Paint Mode, a pointer over the timeline shows Timeline, a pointer over the canvas shows Canvas, everywhere else shows the Sections index. The user can still browse all nine groups.

Purpose: the overlay already exists and already opens (app/src/lib/shortcuts.ts:369-375 calls uiStore.toggleShortcutsOverlay; app/src/components/layout/EditorShell.tsx:105 mounts it), but it always opens on the Sections index (ShortcutsOverlay.tsx:117) and its content has drifted from the real bindings. The user asked for "the tips for edit stroke" when in stroke editing — the context signals already exist and are read at open time.

Output: one new pure module holding the catalog, the context resolver and the tab mapping (with a .test.ts), plus the overlay wiring (seeded tab, always-visible detected-context label, number keys 1-9) and a source-pin wiring test. No new dependency, no new store field, no new signal.

**Locked behavior (from the quick-task constraints — do not revisit):**
- **D-01:** Resolution precedence is paint edit mode > timeline hover > canvas hover > Sections fallback.
- **D-02:** A subtle context label is always visible regardless of the active tab; every group remains browsable via tabs, arrows and number keys.
- **D-03:** Every key documented in the auto-selectable groups (Paint Mode, Timeline, Canvas) must match a real binding in code.
- **D-04:** Context resolution is a pure unit-testable function in its own .ts module with no DOM and no signals imports, tested by a .test.ts sibling.
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
@app/src/components/overlay/ShortcutsOverlay.tsx
@app/src/lib/shortcuts.ts
@app/src/stores/paintStore.ts
@app/src/stores/uiStore.ts
@app/src/components/layout/CanvasArea.tsx
@app/src/components/canvas/PaintOverlay.tsx
@app/src/components/timeline/TimelineInteraction.ts
@app/src/components/canvas/TransformOverlay.tsx

**Context signals (verified at HEAD):**
- `paintStore.paintMode` is a `signal(false)` exported from the paintStore object (app/src/stores/paintStore.ts:27,113); it is toggled by `togglePaintMode` (paintStore.ts:509) and by the P key when a paint layer is selected (CanvasArea.tsx:248-257), and cleared when the selected layer is not paint (CanvasArea.tsx:368-375) and by Escape (app/src/lib/shortcuts.ts:510-514).
- `uiStore.mouseRegion` is `signal<'canvas' | 'timeline' | 'other'>('other')` (app/src/stores/uiStore.ts:43), written on mouse enter/leave of CanvasArea ('canvas', CanvasArea.tsx:383-384) and of the layout TimelinePanel ('timeline', app/src/components/layout/TimelinePanel.tsx:40-41).
- The overlay mounts only while `uiStore.shortcutsOverlayOpen.value` is true (EditorShell.tsx:105), so a `.peek()` read in a `useState` initializer is frozen for that open — exactly the wanted semantics.
- Fullscreen suppresses the opening key (shortcuts.ts:372); nothing to do.

**Binding evidence for the auto-selectable groups (verified file:line — the executor must not re-derive these):**

| Documented key | Real binding | Evidence |
|---|---|---|
| P — toggle paint edit mode | KeyP when the selected layer is paint -> `togglePaintMode()` | CanvasArea.tsx:248-257 |
| S — select tool | `'s'` -> `paintStore.setTool('select')` (ungated) | lib/shortcuts.ts:452-456 |
| F — flat/FX preview | `f`/`F` -> `toggleFlatPreview()` (only while PaintOverlay mounts) | PaintOverlay.tsx:2265-2270 |
| X — swap foreground/background | `'x'` -> `swapFgBg()`, paint edit mode only | lib/shortcuts.ts:467-472 |
| Esc — leave paint mode | Escape priority 1b -> `paintMode.value = false` | lib/shortcuts.ts:510-514 |
| Cmd/Ctrl+A — select all strokes | select tool only | PaintOverlay.tsx:2244-2263 |
| Delete — delete selected strokes | PaintOverlay Delete/Backspace + handleDelete | PaintOverlay.tsx:2182+, lib/shortcuts.ts:357-366 |
| Click — select stroke, Cmd/Ctrl+Click — toggle selection, Drag — move selected strokes | select-tool pointer path | PaintOverlay.tsx:1009-1035 |
| Corner handle / Rotate handle | resize and rotate transform handles | PaintOverlay.tsx:831, 963 |
| Alt+S — toggle solo | `'Alt+s'` -> `soloStore.toggleSolo()` | lib/shortcuts.ts:475-479 |
| Bare S does NOT solo | the bare key sets the paint select tool instead | lib/shortcuts.ts:452-456 |
| Sequence-overlay toggle | no binding exists anywhere in app/src | grep at HEAD: no match |
| Canvas group (zoom, fit, nudge, fullscreen, Esc deselect, Alt+Click cycle) | all match the current sheet | lib/shortcuts.ts:387-432, 346-354; TransformOverlay.tsx:326 |
| Timeline scroll modifiers (Ctrl zoom, Cmd vertical, Shift vertical, no-modifier horizontal) | match except the solo row | app/src/components/timeline/TimelineInteraction.ts:1329-1388 |

**Project rules that bind this work:**
- Tests: `vitest run` only, NEVER watch. Do not start the dev server or the app — the user runs it.
- Vitest collects only `src/**/*.test.ts`; a `.test.tsx` target silently runs nothing, so both new tests are `.test.ts`.
- Preact + @preact/signals: keep the overlay's existing `useState` style (do not rewrite it into signals/hooks), read the signals with `.peek()` in the initializer, and write no signal during render.
- Out of scope: the Physic Paint Studio's separate `?` aside (`PhysicsPaintStudioView.tsx`). Do not touch it.
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: Open the help on the detected surface — pure resolver, seeded tab, visible context label</name>
  <files>app/src/components/overlay/shortcutsHelp.ts, app/src/components/overlay/shortcutsHelp.test.ts, app/src/components/overlay/ShortcutsOverlay.tsx, app/src/components/overlay/shortcutsOverlayContextWiring.test.ts</files>
  <behavior>
    - resolveShortcutsContext({paintMode: true, mouseRegion: 'timeline'}) -> 'paint'; {true,'canvas'} -> 'paint'; {true,'other'} -> 'paint'.
    - {false,'timeline'} -> 'timeline'; {false,'canvas'} -> 'canvas'; {false,'other'} -> 'sections'.
    - resolveShortcutsInitialTab('paint') equals SHORTCUT_TAB_LABELS.indexOf('Paint Mode'); 'timeline' -> indexOf('Timeline'); 'canvas' -> indexOf('Canvas'); 'sections' -> 0; every result is an integer within [0, SHORTCUT_TAB_COUNT).
    - SHORTCUT_TAB_LABELS is ['Sections', ...the nine group titles in catalog order]; SHORTCUT_TAB_COUNT is 10; the titles are Playback, File, Editing, Navigation, Canvas, Timeline, Blur, Keyframes, Paint Mode.
    - SHORTCUTS_CONTEXT_COPY has a non-empty label and detail for all four ids; the three surface labels differ from each other and from the sections label.
    - shortcutsHelp.ts contains no import statement at all (purity pin, D-04).
    - The overlay source reads paintStore.paintMode.peek() and uiStore.mouseRegion.peek() exactly once each, calls resolveShortcutsContext once, calls resolveShortcutsInitialTab(context) once, renders the token 'Detected:' plus contextCopy.label and contextCopy.detail, declares no local shortcut catalog, and leaves the Shift+? binding in lib/shortcuts.ts as the only opener.
  </behavior>
  <action>
    Create app/src/components/overlay/shortcutsHelp.ts with ZERO imports. Move the existing catalog out of ShortcutsOverlay.tsx verbatim: the two interfaces become exported `ShortcutEntry` and `ShortcutGroup`, and `SHORTCUT_GROUPS` keeps the same nine groups in the same order with the same entries (preserve every `\u....` escape and the existing spacing style). Add, in the same file: `SHORTCUT_TAB_LABELS` derived as 'Sections' plus the group titles; `SHORTCUT_TAB_COUNT` as one plus the group count; `type ShortcutsContextId = 'paint' | 'timeline' | 'canvas' | 'sections'`; `ShortcutsContextInput` as `{paintMode: boolean; mouseRegion: 'canvas' | 'timeline' | 'other'}`; `resolveShortcutsContext` implementing D-01 precedence (paint, then timeline, then canvas, else sections); `SHORTCUTS_CONTEXT_GROUP_TITLE` mapping paint to 'Paint Mode', timeline to 'Timeline', canvas to 'Canvas', sections to null; `resolveShortcutsInitialTab(context)` returning 0 for sections and otherwise the positive index of the mapped title in SHORTCUT_TAB_LABELS (fall back to 0 when the title is absent or at index 0); and `SHORTCUTS_CONTEXT_COPY` with label/detail pairs — paint: 'Paint Mode' / 'shortcuts for editing strokes'; timeline: 'Timeline' / 'shortcuts for this timeline surface'; canvas: 'Canvas' / 'shortcuts for the canvas'; sections: 'All shortcuts' / 'hover the canvas or the timeline for surface help'. Keep the copy sentence fragments lowercase so the rendered line reads naturally after 'Detected: '. Do not edit the entry contents in this task.

    Rewrite ShortcutsOverlay.tsx to consume the module: import SHORTCUT_GROUPS, SHORTCUT_TAB_LABELS, SHORTCUT_TAB_COUNT, SHORTCUTS_CONTEXT_COPY, resolveShortcutsContext and resolveShortcutsInitialTab from './shortcutsHelp', and import paintStore from '../../stores/paintStore'. Delete the local ShortcutEntry/ShortcutGroup interfaces, the local catalog constant and the local tab-label/tab-count constants; use the imported names everywhere the old ones appeared (the tab bar map, the active-tab modulo arithmetic and the group lookup). Declare the context state first with a lazy initializer that calls resolveShortcutsContext with the two .peek() reads, then seed the activeTab state with a lazy initializer calling resolveShortcutsInitialTab(context); leave focusedRow and both existing effects untouched. Compute one render-body constant from SHORTCUTS_CONTEXT_COPY[context] and render it as the subtitle of the header's left column — the h2 stays as-is, the close button stays on the right — as a small muted line beginning with the token 'Detected:' followed by the label, an em dash and the detail. Keep the existing Tailwind token style used elsewhere in the file; add no new dependency and no new signal. Do not touch the number-key branch in this task.

    Create app/src/components/overlay/shortcutsHelp.test.ts covering the behavior cases above (resolver precedence, initial-tab mapping, tab shape, copy completeness) plus a purity case that reads shortcutsHelp.ts with node:fs and asserts no line starts with an import statement.

    Create app/src/components/overlay/shortcutsOverlayContextWiring.test.ts as a node-environment source-pin test (mark it `@vitest-environment node`): read ShortcutsOverlay.tsx and app/src/lib/shortcuts.ts with node:fs; assert the import line from './shortcutsHelp'; assert each .peek read occurs exactly once; assert resolveShortcutsContext( occurs exactly once and resolveShortcutsInitialTab(context) exactly once; assert the overlay contains the 'Detected:' token, the copy constant plus '.label' and '.detail'; assert the overlay declares no local catalog assignment; and assert lib/shortcuts.ts still contains exactly one Shift+? binding and exactly one toggleShortcutsOverlay call.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/overlay/shortcutsHelp.test.ts src/components/overlay/shortcutsOverlayContextWiring.test.ts</automated>
    <automated>test "$(grep -c "resolveShortcutsContext(" app/src/components/overlay/ShortcutsOverlay.tsx)" = "1" # [HEAD=0 EXPECT==1]</automated>
    <automated>test "$(grep -c "ShortcutGroup\[\]" app/src/components/overlay/ShortcutsOverlay.tsx)" = "0" # [HEAD=1 EXPECT==0]</automated>
    <automated>pnpm --prefix app run typecheck</automated>
  </verify>
  <done>
    shortcutsHelp.ts is the single home of the catalog and the context law with zero imports; a Shift+? opened in paint edit mode lands on the Paint Mode tab, hovering the timeline lands on Timeline, hovering the canvas lands on Canvas and anywhere else lands on the Sections index; the header always shows 'Detected: <label> — <detail>'; the tab bar, arrow navigation and all nine groups still work; both new test files are green and the typecheck passes.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Make the auto-selected help truthful — Paint Mode and Timeline entries, number keys 1-9</name>
  <files>app/src/components/overlay/shortcutsHelp.ts, app/src/components/overlay/shortcutsHelp.test.ts, app/src/components/overlay/ShortcutsOverlay.tsx, app/src/components/overlay/shortcutsOverlayContextWiring.test.ts</files>
  <behavior>
    - Paint Mode entries, in order, are exactly: P 'Toggle paint edit mode'; S 'Select tool'; F 'Toggle flat/FX preview'; X 'Swap foreground / background'; Esc 'Leave paint mode'; Cmd/Ctrl+A 'Select all strokes (select tool)'; Delete 'Delete selected strokes'; Click 'Select stroke (select tool)'; Cmd/Ctrl+Click 'Multi-select strokes'; Drag 'Move selected strokes'; Corner handle 'Resize selected strokes'; Rotate handle 'Rotate selected strokes'.
    - No Paint Mode entry has the single-letter key that has no binding, and no Paint Mode description mentions a sequence overlay.
    - Timeline solo entry is {keys: 'Alt+S', description: 'Toggle solo mode (base content only)'}; no Timeline entry has the bare S key; the plain Scroll entry's description is exactly 'Natural two-axis scroll (trackpad); mouse wheel scrolls horizontally'.
    - The Canvas group's keys are unchanged (the ten verified rows).
    - resolveShortcutsTabNumber(1) is 1, (9) is 9, and 0, 10, 1.5 and NaN return null.
    - The overlay source uses resolveShortcutsTabNumber exactly once and carries no hardcoded group-count upper bound in the number-key branch.
  </behavior>
  <action>
    In app/src/components/overlay/shortcutsHelp.ts, repair the two auto-selectable groups against the binding evidence table in the context section (D-03). In the Paint Mode group: after the P row add an S row for the select tool; after the F row add an X row for swapping foreground/background and an Esc row for leaving paint mode; change the Cmd/Ctrl+A description to 'Select all strokes (select tool)'; and delete the row that documents a sequence overlay — no such binding exists anywhere in the main editor. Keep the remaining rows and their order exactly as they are. In the Timeline group: change the solo row's key to 'Alt+S' and keep its description; change the plain Scroll row's description to 'Natural two-axis scroll (trackpad); mouse wheel scrolls horizontally' because the no-modifier path routes a trackpad's deltaX to horizontal scroll and its deltaY to vertical scroll, while a mouse wheel (deltaX === 0) routes deltaY to horizontal scroll (TimelineInteraction.ts:1354-1372). Do not touch the Playback, File, Editing, Navigation, Canvas, Blur or Keyframes groups. Add a pure `resolveShortcutsTabNumber(num)` that returns the number when it is an integer within 1..SHORTCUT_GROUPS.length and null otherwise; keep the module import-free.

    In app/src/components/overlay/ShortcutsOverlay.tsx, replace the number-key branch's hardcoded range check with parse-then-helper: parse the key as an integer, and when it is not NaN ask resolveShortcutsTabNumber for a tab index, jumping and returning only when the helper returns a non-null index; update the branch's comment to state keys 1 through N where N is the group count. Change nothing else in the handler (Escape, arrows, Tab and the catch-all stopPropagation stay exactly as they are).

    Extend app/src/components/overlay/shortcutsHelp.test.ts with content pins: the exact Paint Mode keys array and descriptions above; the absence of the unbound single-letter row and of any sequence-overlay description (use a case-insensitive regex); the exact Timeline solo row, the absence of a bare-S solo row, and the horizontal-scroll description; the unchanged Canvas keys array; and the resolveShortcutsTabNumber cases. Extend app/src/components/overlay/shortcutsOverlayContextWiring.test.ts with: exactly one resolveShortcutsTabNumber call in the overlay; no hardcoded group-count upper bound in the overlay; and a single-source pin proving the Paint Mode group title now lives in shortcutsHelp.ts and no longer in the component.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/overlay/shortcutsHelp.test.ts src/components/overlay/shortcutsOverlayContextWiring.test.ts</automated>
    <automated>test "$(grep -c "resolveShortcutsTabNumber(" app/src/components/overlay/ShortcutsOverlay.tsx)" = "1" # [HEAD=0 EXPECT==1]</automated>
    <automated>test "$(grep -c "Alt+S" app/src/components/overlay/shortcutsHelp.ts)" = "1" # [HEAD=error:2 EXPECT==1]</automated>
    <automated>test "$(grep -c "title: 'Paint Mode'" app/src/components/overlay/shortcutsHelp.ts)" = "1" # [HEAD=error:2 EXPECT==1]</automated>
    <automated>test "$(grep -c "title: 'Paint Mode'" app/src/components/overlay/ShortcutsOverlay.tsx)" = "0" # [HEAD=1 EXPECT==0]</automated>
    <automated>pnpm --prefix app run typecheck</automated>
  </verify>
  <done>
    The Paint Mode tab documents exactly the real bindings (S, X and Esc present, the unbound sequence-overlay row gone, select-all names its tool); the Timeline tab names Alt+S for solo with no bare-S claim and its plain Scroll row states each device's behavior (trackpad two-axis, mouse wheel horizontal); the Canvas group is unchanged; number keys 1 through 9 each jump to their group; both test files are green and the typecheck passes.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Keyboard -> overlay handler | The capture-phase keydown handler in the overlay intercepts every key while open. This plan changes only the number-key range source and nothing about interception. |
| Store signals -> rendering | Two store signals are read once at mount with `.peek()`; no store write is added. The help catalog is static local data with no persistence, IPC or network path. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261113-qjd-01 | Tampering | `ShortcutsOverlay` capture-phase keydown handler | low | accept | The handler's blocking behavior is unchanged: Escape closes, arrows navigate, and every other key still stops propagation. Only the number-key upper bound moves from a literal to the catalog length, pinned by a test and a source pin. |
| T-261113-qjd-02 | Information disclosure | Static help catalog | low | accept | The module holds only static shortcut strings; no user project data, no filesystem, no IPC and no network access is introduced (the zero-import purity pin is the evidence). |
| T-261113-qjd-03 | Elevation of privilege | Context reads (`paintStore.paintMode`, `uiStore.mouseRegion`) | low | accept | Both are read-only `.peek()` reads at mount; the overlay gains no write path to either store and writes no signal during render. |
| T-261113-qjd-SC | Tampering | npm/pip/cargo installs | high | mitigate | Not applicable — no package is added, upgraded or installed and no dependency edge changes. |
</threat_model>

<verification>
Automated (cwd = repo root; `vitest run` only, NEVER watch; test paths are relative to app/, every other path is repo-root-relative):

- `pnpm --filter efx-motion-editor exec vitest run src/components/overlay/shortcutsHelp.test.ts` — resolver precedence, tab mapping, catalog shape, copy, content accuracy, number-key range, module purity.
- `pnpm --filter efx-motion-editor exec vitest run src/components/overlay/shortcutsOverlayContextWiring.test.ts` — the .peek reads, the single resolver call, the seeded tab, the visible label tokens, no local catalog, the number-key helper, and the unchanged Shift+? binding.
- `pnpm --prefix app run typecheck`
- Grep gates (run against the current tree; baselines measured at plan HEAD). `error:2` means the target file does not exist at HEAD, so `grep -c` exits 2 and prints no count:
  - `grep -c "resolveShortcutsContext(" app/src/components/overlay/ShortcutsOverlay.tsx` -> 1 `[HEAD=0 EXPECT==1]`
  - `grep -c "ShortcutGroup\[\]" app/src/components/overlay/ShortcutsOverlay.tsx` -> 0 `[HEAD=1 EXPECT==0]`
  - `grep -c "resolveShortcutsTabNumber(" app/src/components/overlay/ShortcutsOverlay.tsx` -> 1 `[HEAD=0 EXPECT==1]`
  - `grep -c "Alt+S" app/src/components/overlay/shortcutsHelp.ts` -> 1 `[HEAD=error:2 EXPECT==1]`
  - `grep -c "title: 'Paint Mode'" app/src/components/overlay/shortcutsHelp.ts` -> 1 `[HEAD=error:2 EXPECT==1]`
  - `grep -c "title: 'Paint Mode'" app/src/components/overlay/ShortcutsOverlay.tsx` -> 0 `[HEAD=1 EXPECT==0]`

Scope checks (read the diff, do not infer from counts):

- `git diff --name-only` lists exactly the four paths in `files_modified` and nothing else — in particular `app/src/lib/shortcuts.ts`, `app/src/stores/uiStore.ts`, `app/src/stores/paintStore.ts`, `app/src/components/layout/EditorShell.tsx`, `PhysicsPaintStudioView.tsx` and every package/lockfile are untouched.
- The only behavior change in `ShortcutsOverlay.tsx` is the mount-time seeding, the header subtitle, the imported names and the number-key branch; the backdrop, close button, tab bar, content rendering and the entire keydown intercept structure are unchanged.
- No new signal, computed or effect is introduced; both new files are `.test.ts`.

Native UAT rows (the user's side — the executor cannot open the app; report "automated-ready" and hand these over, do NOT claim them):

1. Select a paint layer and enter paint edit mode (P or the pill), then press Shift+? — the overlay opens on the Paint Mode tab and the header reads "Detected: Paint Mode — shortcuts for editing strokes".
2. Leave paint mode, move the pointer over the timeline and press Shift+? — opens on Timeline with the Timeline label.
3. Move the pointer over the canvas and press Shift+? — opens on Canvas with the Canvas label.
4. Move the pointer to the sidebar (or any non-canvas, non-timeline area) and press Shift+? — opens on the Sections index with the All shortcuts label.
5. While the overlay is open, reach all nine groups via tab clicks, Left/Right, Tab, Up/Down + Enter from the Sections index, and number keys 1 through 9; Esc still closes.
6. In the Paint Mode tab, verify the listed keys behave as documented: S selects the select tool, X swaps foreground/background, Esc leaves paint mode, F toggles the flat/FX preview, Cmd/Ctrl+A selects all strokes with the select tool, Delete removes the selected strokes.
7. In the Timeline tab, Alt+S toggles solo; the bare S key does not toggle solo.
8. In fullscreen, Shift+? still does not open the overlay.
</verification>

<success_criteria>
- D-01: Shift+? opens on the matching group with precedence paint edit mode > timeline hover > canvas hover > Sections.
- D-02: A subtle detected-context label is always visible, and all nine groups remain reachable through every existing navigation path plus number keys 1-9.
- D-03: The Paint Mode and Timeline entries match the verified bindings exactly; Canvas was verified unchanged; every documented key in the auto-selectable groups is real.
- D-04: The resolver, mapping and catalog live in a zero-import `.ts` module covered by a `.test.ts`; the overlay reads the two signals once per open with `.peek()`.
- The Shift+? binding, overlay mount, fullscreen suppression and all other groups are byte-unchanged.
- Both new tests are green, the typecheck passes, and the eight native UAT rows are handed to the user rather than claimed.
</success_criteria>

<output>
Create `.planning/quick/261113-qjd-i-want-a-shift-shortcut-for-show-all-key/261113-qjd-SUMMARY.md` when done
</output>
