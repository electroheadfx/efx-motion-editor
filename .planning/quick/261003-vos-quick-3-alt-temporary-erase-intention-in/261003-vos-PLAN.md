---
phase: quick-261003-vos
plan: 261003-vos
type: tdd
wave: 1
depends_on: []
files_modified:
  - app/src/components/physic-paint/view/physicsPaintTemporaryErase.test.ts
  - app/src/components/physic-paint/view/physicsPaintTemporaryErase.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - .planning/quick/261003-vos-quick-3-alt-temporary-erase-intention-in/261003-vos-SUMMARY.md
autonomous: true
requirements: [QUICK-261003-VOS]

estimate:
  tokens: 33000
  raw_tokens: 28000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "ARM (BOTH STUDIO MODES): in the Physics Paint Studio window with the Paint tool selected — Normal (paint, physicsMode null) OR Physics (paint, physicsMode 'local') — pressing Alt arms temporary erase: the next gesture erases through the engine's existing erase path (hover preview + pointer glyph on fresh strokes, click whole-stroke delete, drag pixel erase), while settings.tool still reads 'paint', the tool rail still highlights Paint, and the right panel still shows the paint pane (the selected tool never changes and nothing is persisted)"
    - "GATED ARM + PRESERVED ALT: Alt does not arm when a tool other than Paint is selected, when the focused element is an input/textarea/select/contentEditable (isPhysicsPaintShortcutTarget — the Studio dispatcher's own gate), when mutations are locked (mirrors selectTool's canMutate gate), when no engine is mounted, or on key repeat; the Alt keydown/keyup are delivered untouched (no preventDefault, no stopPropagation), so every existing Alt behavior in the Studio dispatcher is preserved byte-for-byte: Backspace/Delete stays inert while Alt is held, Meta+Alt+C/X/V still never fires roto clipboard, Meta+Alt+A still never fires Select All, and Escape with Alt held still never collapses the selection — physicsPaintStudioKeyboard.ts itself is never edited"
    - "CONTRACT RIDE-THROUGH: the armed gesture runs the EXISTING engine erase contract from quicks 261003-hpi/261003-ud9 (pointer-delete on fresh strokes, pixel erase with the force law on baked strokes, resolveEraseTargetIds) — the quick's only engine interaction is engine.setTool('erase'|'paint'); it adds zero erase logic and the packages/** diff is EMPTY"
    - "RELEASE + LOST-KEYUP SAFETY: Alt keyup always disarms (no gates — a keyup inside an input, after a tool switch, or while locked still clears), and window blur plus visibilitychange-to-hidden also disarm; the restored tool lands at the gesture boundary, and a force-sync at every pointerdown (window capture) guarantees the correct tool before the engine sees the stroke — so a lost Alt keyup, an Alt+Tab to the main window, or a hidden Studio window can never leave the Studio stuck erasing"
    - "GESTURE OWNERSHIP: arming or disarming mid-stroke never converts the in-flight gesture — the arm/disarm while a pointer gesture is live is deferred to the pointerup/pointercancel boundary, so a paint stroke in progress finishes as paint and an erase swipe in progress finishes as erase; the flip is effective for the next gesture"
    - "NO NEW UI, SIGNALS-ONLY: no button, overlay or indicator is added; the new state is one module-level @preact/signals signal (temporaryErase) plus pure resolver/handlers — zero useState added, the selected tool lives in the existing settings state and is never written; full app vitest + tsc green with zero edits to pre-existing test assertions"
  artifacts:
    - app/src/components/physic-paint/view/physicsPaintTemporaryErase.ts (temporaryErase signal, resolveEffectiveTool, gated handlers, gesture-boundary sync, mount/teardown)
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx (mounts the listener lifecycle with latest-deps ref, armed-guarded sync effect on [engine, settings.tool])
    - app/src/components/physic-paint/view/physicsPaintTemporaryErase.test.ts (RED→GREEN contract cells)
  key_links:
    - "Gate link: the arm gate chain is isPhysicsPaintShortcutTarget (imported from physicsPaintStudioKeyboard.ts) + selected tool === 'paint' + engine present + not mutation-locked + not repeat — the exact gate family the Studio dispatcher and selectTool already use, so arming behaves like a tool switch that never touches the tool state"
    - "Boundary link: ONE sync function is the only writer of the engine tool from this feature; it defers while a pointer gesture is in flight, coalesces arm/disarm into one final apply, and force-syncs from a window pointerdown capture listener so it runs before the engine's own canvas pointerdown handler"
    - "Contract link: the sync only ever calls engine.setTool — the engine's pre-existing state.tool reads (click-delete at onPointerUp, drag erase at applyStrokeToEngine, hover at updateEraseHover, cursor at drawBrushCursor) do all the work; any new erase branch would fork the ud9/hpi contract instead of riding it"
---

<objective>
QUICK vos (Quick 3, REPLANNED) — Alt = temporary erase in the Physics Paint Studio window (`/physics-paint`), in BOTH paint modes. In brush mode (the Paint tool selected — Normal or Physics), holding the Alt key makes the Studio canvas behave as the Erase tool until Alt is released; on release the Paint comes back. The selected tool itself never changes and nothing is persisted.

Surface decision (user correction, verified live at planning time): the target is the STUDIO window, not the main-window inline paint editor. Evidence checked: main.tsx:37 mounts PhysicsPaintStudio for `/physics-paint` and main.tsx:104 mounts shortcuts.ts only in the else branch — the Studio never mounts shortcuts.ts, so `isPaintEditMode()`/shortcuts.ts are N/A here and MUST NOT be edited (nor PaintOverlay.tsx, paintStore.ts, or anything in the main-window paint tree). The Studio's tools are `ToolType = 'paint' | 'erase'` (packages/efx-physic-paint/src/types.ts:59); "Normal" and "Physics" are ONE engine tool `physicsMode = null | 'local'` respectively (PhysicsPaintToolRail.tsx:51-52), so a single `selected === 'paint'` gate covers both modes (guardrail: Alt must work in BOTH). The selected tool lives in the component's existing settings state (PhysicsPaintStudio.tsx:805 useState, physicsPaintStudioSettings.ts) and is pushed to the engine by selectTool (usePhysicsPaintEngineActions.ts:20-25) — new state rides as a module signal beside the Studio's own keyboard module; no parallel fork of the selected tool.

Critical live finding (drives the design): the engine reads `this.state.tool` LIVE at every gesture stage (EfxPaintEngine.ts — preview color :3350, click pointer-delete :3410, acceptStroke :3435, hover gate :3067, cursor :2032/:2115). A naive mid-stroke setTool would convert the in-flight stroke (a paint stroke finalized as 'erase', or an erase swipe finalized as paint). Therefore the arm/disarm apply is DEFERRED to pointer boundaries, with a force-sync at window-pointerdown capture before the engine's handler runs.

Alt-binding audit (guardrail 1 — checked FIRST at planning time; grep `altKey|AltLeft|AltRight|'Alt'` over app/src/components/physic-paint + packages/efx-physic-paint/src returns ONLY the four dispatcher rows; executor re-verifies before editing):

```
BINDING / USE                                     | WHERE                                                | PRESERVED HOW
------------------------------------------------- | ---------------------------------------------------- | -------------
Meta+Alt+C/X/V roto chord exclusion               | physicsPaintStudioKeyboard.ts:154                    | Alt events never suppressed/prevented; file never edited
Backspace/Delete requires !altKey                 | physicsPaintStudioKeyboard.ts:167-174                | untouched — Alt-held Delete stays inert
Meta+Alt+A Select All exclusion                   | physicsPaintStudioKeyboard.ts:196                    | untouched
Escape requires !altKey                           | physicsPaintStudioKeyboard.ts:210-217                | untouched
Alt-click pointer handlers in the Studio canvas   | NONE (grep returns no other altKey in the tree)       | nothing to preserve
Alt usage in the engine (EfxPaintEngine)          | NONE (grep returns no altKey in packages/efx-physic-paint/src) | engine untouched
main-window Alt bindings (Alt+S, dup, uncouple,   | shortcuts.ts / PaintOverlay.tsx / TransformOverlay / | different window — shortcuts.ts is not mounted here;
slip, layer-pick, Alt+P chord)                    | CanvasArea / TimelineInteraction                     | those files untouched by this quick (scope proof pins EMPTY)
```

Conflict verdict: no Alt binding is clobbered — the resolution is to never consume the Alt events and to gate the arm to Paint-tool + Studio shortcut-target only. Known coexistence (preserved, not "fixed"): holding Alt still suppresses the dispatcher's own chords exactly as today (that is existing behavior our untouched events preserve).

Design decisions (planner discretion): (1) arm flips on the Alt KEYDOWN itself (gated); key repeat is ignored and arm is idempotent. (2) Gesture ownership: handlers set a module inFlight flag from window pointerdown(capture)/pointerup/pointercancel; while inFlight, sync defers (pending coalesces to one final apply at the boundary) — this is what keeps a mid-stroke Alt from orphaning a stroke and lets a mid-erase release finish the erase swipe. The pointerdown force-sync (capture, so it precedes the engine's canvas listener) is the self-healing invariant: whatever happened (lost keyup, hidden window, external setTool), the tool at every gesture START is provably correct. (3) State = one module `temporaryErase` signal + pure `resolveEffectiveTool(selected)` — NOT a computed over the selected tool, because the Studio's selected tool is a useState (settings) and mirroring it into a signal would fork state; the resolver is the single combination point. (4) The lifecycle mounts as window-level listeners from PhysicsPaintStudio (the dispatcher is element-level onKeyDown — keydown target can be `body` when the canvas has focus, so Alt must be caught at window level; the Studio window never coexists with shortcuts.ts, so no cross-dispatcher risk).

Source coverage audit (quick = intention + guardrails are the source set):

```
SOURCE     | ITEM                                                       | PLAN | NOTES
---------- | ---------------------------------------------------------- | ---- | ------
INTENTION  | Alt held = temporary erase, release restores brush          | 1,2  | signal + resolver + gated listeners + boundary sync
INTENTION  | erase obeys the existing erase contract (ud9/hpi oracle)    | 1,2  | only writer is engine.setTool; packages/** EMPTY
INTENTION  | works in BOTH Normal and Physics modes                      | 1,2  | both are tool 'paint' — one gate covers both (UAT rows a + c)
GUARD      | audit existing Alt bindings first, preserve them            | audited above | arm gate + no event consumption; dispatcher untouched; re-verified in Task 3
GUARD      | shortcuts.ts / isPaintEditMode() N/A — do not edit          | 3    | scope proof pins EMPTY for shortcuts.ts, PaintOverlay.tsx, paintStore.ts, main-window tree
GUARD      | Preact signals only, no useState; read efx-preact-reactivity | 1,2  | one module signal; latest-deps ref idiom; skill read before Studio.tsx edits
GUARD      | no new UI                                                   | all  | no button/overlay/indicator; settings.tool untouched
GUARD      | erase = 100% existing path, zero new erase logic            | 1,2  | sync only calls setTool; erase branch never touched
GUARD      | vitest run (never watch), no dev server; *.test.ts only     | all  | pnpm --filter efx-motion-editor exec vitest run ...
GUARD      | lost-keyup safety: keyup + blur + visibilitychange disarm   | 1,2  | plus pointer-boundary force-sync (cells KEYUP, LOST FOCUS, RECOVERY)
```

Purpose: holding Alt becomes a painter's ephemeral erase modifier inside the Studio while every existing Alt behavior, the erase contract and the selected tool stay provably untouched.
Output: RED cells -> signal + gated lifecycle + boundary-synced engine tool -> full gates + scope proof -> SUMMARY (automated-ready, native UAT rows pending).
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md

@.planning/quick/261003-ud9-quick-1-erase-pointer-delete-on-fresh-st/261003-ud9-SUMMARY.md
@app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts
@app/src/components/physic-paint/engine/usePhysicsPaintEngineActions.ts
</context>

<tasks>

<task type="tdd">
  <name>Task 1 (RED): temporary-erase cells — state machine, key lifecycle, boundary deferral, preserved-Alt pins</name>
  <files>app/src/components/physic-paint/view/physicsPaintTemporaryErase.test.ts</files>
  <behavior>
  - RESOLVE: resolveEffectiveTool('paint') with temporaryErase armed reads 'erase'; disarmed reads 'paint'; armed with selected 'erase' reads 'erase' (the selected tool wins — no flip-back), and the resolver never mutates its input — FAILS at RED (module missing).
  - ARM: Alt keydown (key 'Alt', repeat false) with every gate passing — shortcut target, selected tool 'paint', engine present, not mutation-locked — sets temporaryErase true and the sync applies engine.setTool('erase') on the idle engine spy; the injected selected-tool getter still returns 'paint' (nothing writes the selection) — FAILS at RED.
  - GATED ARM: no arm when selected tool is 'erase', when the target is an input/textarea/contentEditable, when mutations are locked, when no engine is mounted, on key repeat, or for a non-Alt key — FAILS at RED.
  - KEYUP + LOST FOCUS: the keyup handler disarms unconditionally (every gate may fail — suppressed target, locked, tool 'erase' — and disarm still fires), and when idle it applies the SELECTED tool back to the engine ('paint' normally, 'erase' if that is what is selected); window blur and visibilitychange-to-hidden each disarm unconditionally; visibilitychange-to-visible does NOT disarm; double keyup / double disarm are idempotent — FAILS at RED.
  - EVENT HYGIENE (preserved-Alt pin): the keydown, keyup, blur and visibility handlers never call preventDefault or stopPropagation (spy assertions stay clean) — FAILS at RED (module missing).
  - BOUNDARY DEFERRAL — ARM MID-GESTURE: with inFlight true (a pointerdown boundary seen), arming sets temporaryErase true but does NOT call engine.setTool yet (the paint stroke in progress still reads 'paint'); the subsequent pointerup boundary flushes one deferred apply of 'erase' — FAILS at RED.
  - BOUNDARY DEFERRAL — DISARM MID-ERASE: armed with inFlight true and engine at 'erase'; the keyup disarms but does NOT call setTool yet (the erase swipe in progress finishes as erase); the pointerup boundary applies 'paint' — FAILS at RED.
  - PENDING COALESCE: arm then disarm both while inFlight → exactly ONE apply at the boundary, and it is the final desired tool ('paint'); no intermediate 'erase' apply leaks — FAILS at RED.
  - RECOVERY (lost-keyup safety): simulate a stuck state — disarmed signal, engine spy still holding 'erase', inFlight stuck true — the next pointerdown boundary force-syncs 'paint' BEFORE the gesture starts; a pointercancel boundary also clears inFlight and flushes — FAILS at RED.
  - ENGINE IDENTITY RESYNC: armed with engine A applied ('erase'), then getEngine() returns a NEW engine B → the next sync applies 'erase' to B (lastApplied tracks the engine instance, not just the tool string) — FAILS at RED.
  - MOUNT WIRNING: the mount registers keydown/keyup on the window-like target, blur on the window-like target, visibilitychange on the document-like target, and pointerdown with capture: true (assert the options object), plus pointerup/pointercancel; the returned teardown removes every listener and disarms temporaryErase; handlers installed through the fake targets behave like the direct handlers (one end-to-end: fake Alt keydown through the mounted listener arms the fake engine) — FAILS at RED.
  - DISPATCHER GUARD PIN: cells driving dispatchPhysicsPaintStudioKeyDown prove the existing Alt exclusions — Backspace with altKey never calls deleteRotoKey, Meta+Alt+C never calls copyRotoKey, Escape with altKey never collapses the selection (green at base on their own; at RED the whole file fails collection because the new module import does not exist — record that honestly as the RED evidence) — FAILS at RED (collection), must be GREEN from Task 2 on.
  </behavior>
  <action>Create app/src/components/physic-paint/view/physicsPaintTemporaryErase.test.ts (new file) with the cells above, mirroring the DOM-free harness style of physicsPaintStudioKeyboard.test.ts (fake event objects, spy callbacks, a fake HTMLElement-shaped target where needed — the app vitest runs src/**/*.test.ts in the default node environment, so NO real DOM and no .test.tsx). Drive everything through exported pure handlers with injected deps: { getSelectedTool, getEngine, isMutationLocked, isShortcutTarget } plus arm/disarm/sync entry points — no window/document at module import time (the mount function takes its window-like/document-like targets as parameters precisely so node tests can pass fakes). Header comment: the cell list above as the contract of record. Touch no production file in this task; record which cells fail against current code as the RED evidence (expected: the file fails to collect — module does not exist yet).</action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/physicsPaintTemporaryErase.test.ts</automated>
  </verify>
  <done>Every cell above exists in the file; the run fails at base with the collection error / failing cell names recorded as RED evidence; commit as test(261003-vos): RED cells for Studio Alt temporary erase gating, boundary deferral and preserved-Alt hygiene.</done>
</task>

<task type="tdd" tdd="true">
  <name>Task 2 (GREEN): temporaryErase signal, gated lifecycle, boundary-synced engine tool, Studio mount</name>
  <files>app/src/components/physic-paint/view/physicsPaintTemporaryErase.ts, app/src/components/physic-paint/PhysicsPaintStudio.tsx</files>
  <behavior>
  - MODULE STATE: temporaryErase is a module-level signal(false) (read via .peek() — no component subscribes, so no render paths change); resolveEffectiveTool(selected) returns 'erase' only when armed AND selected === 'paint', else selected — it is the ONE combination point.
  - HANDLERS: handleKeyDown arms on key 'Alt' when !repeat && isShortcutTarget(target) && getSelectedTool() === 'paint' && getEngine() !== null && !isMutationLocked() (idempotent under repeat attempts); handleKeyUp, handleBlur and handleVisibilityChange('hidden') disarm unconditionally; none of them calls preventDefault/stopPropagation; handleGestureBoundary('down') force-syncs first then marks inFlight, ('up'|'cancel') clears inFlight then syncs; sync computes desired = resolveEffectiveTool(selected), skips when inFlight (unless force) and when the (engine, desired) pair equals the last applied pair, otherwise calls engine.setTool(desired) and records engine + tool.
  - MOUNT: mountPhysicsPaintTemporaryErase({ window: windowLike, document: documentLike }, deps) wires keydown/keyup/blur on the window-like target, visibilitychange on the document-like target, pointerdown WITH capture: true plus pointerup/pointercancel on the window-like target, and returns a teardown that removes all of them and disarms; it never touches globals at import time.
  - STUDIO WIRING (PhysicsPaintStudio.tsx): read the efx-preact-reactivity skill FIRST; then (1) a deps ref holding { getSelectedTool: () => settings.tool, getEngine: () => engineRef.current, isMutationLocked: isPhysicalMutationLocked, isShortcutTarget: isPhysicsPaintShortcutTarget } — assigned in the render body following the existing canvasEngineReadyImplRef precedent (PhysicsPaintStudio.tsx:3522); (2) one useEffect installing the mount once with the ref-read deps and tearing down (disarm) on unmount; (3) one armed-guarded sync effect with deps [engine, settings.tool] — when temporaryErase is not armed it does NOTHING (byte-identical behavior for every existing flow, including engine re-creation which force-sets 'paint' at PhysicsPaintCanvasMount.tsx:104), when armed it re-applies the effective tool (covers engine re-create and a rail tool switch while Alt is held). No useState, no new UI, no edit to selectTool, no edit to physicsPaintStudioKeyboard.ts.
  - ZERO ERASE LOGIC: the only engine call in the whole feature is engine.setTool; the engine's existing erase branch performs all erasing (ud9 click pointer-delete at onPointerUp :3410, hpi drag erase at applyStrokeToEngine 'erase' branch, hover preview at updateEraseHover).
  </behavior>
  <action>Read first: the Task 1 test file (it is the contract of record), physicsPaintStudioKeyboard.ts (for isPhysicsPaintShortcutTarget's signature), usePhysicsPaintEngineActions.ts selectTool (the gate family being mirrored), PhysicsPaintStudio.tsx around :805 (settings useState), :1124 (isPhysicalMutationLocked), :1248 (actions wiring), :2761 (the menu:undo useEffect as the listener-mount precedent), :3522 (the render-body ref assignment precedent) and :3663 (input activity), plus EfxPaintEngine.ts setTool :822 and the pointer handlers :3290-3445 as a READ-ONLY reference for why deferral exists. Implement in two moves. (1) Create physicsPaintTemporaryErase.ts with the signal, resolver, private inFlight/lastApplied state, the handlers, the sync function, the mount/teardown, and a reset helper for tests — keep it free of PhysicsPaintStudio imports so the Task 1 tests drive it with spies; import only the ToolType type and isPhysicsPaintShortcutTarget as needed (type-only where possible). (2) Wire PhysicsPaintStudio.tsx exactly as the STUDIO WIRING behavior states — three additions, nothing else in the 4.7k-line file touched. Run Task 1's tests; every cell must turn green with ZERO edits to Task 1 assertions, then run the pre-existing Studio keyboard suite to prove no regression.</action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/physicsPaintTemporaryErase.test.ts src/components/physic-paint/view/physicsPaintStudioKeyboard.test.ts</automated>
  </verify>
  <done>All Task 1 cells green with zero assertion edits; physicsPaintStudioKeyboard.test.ts still green (113 tests); the dispatcher file diff is EMPTY; effective tool flips only Paint→Erase while armed and only at gesture boundaries; commit as feat(261003-vos): Alt holds to temporarily erase in the Physics Paint Studio (both paint modes).</done>
</task>

<task type="auto">
  <name>Task 3: full gates, Studio Alt-binding scope proof, SUMMARY</name>
  <files>.planning/quick/261003-vos-quick-3-alt-temporary-erase-intention-in/261003-vos-SUMMARY.md</files>
  <action>Record HEAD in .git/gsd-plan-head-before-261003-vos BEFORE the first commit of this plan (overwrite any stale value from the abandoned main-window variant) and cite it in the SUMMARY. Run the full app suite and typecheck, then prove scope: the changed-file list must contain ONLY physicsPaintTemporaryErase.test.ts, physicsPaintTemporaryErase.ts, PhysicsPaintStudio.tsx and the SUMMARY (never committed — the orchestrator owns the docs commit), with EMPTY diffs for packages/**, app/src/lib/shortcuts.ts, app/src/components/canvas/**, app/src/stores/paintStore.ts, the timeline, and app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts. Re-run the Alt audit greps (altKey|AltLeft|AltRight|'Alt' over app/src/components/physic-paint + packages/efx-physic-paint/src) and confirm from the diff that the four dispatcher exclusion rows are untouched and no production file outside the two planned source files changed. Write the SUMMARY with status automated-ready, the RED evidence (collection failure / failing cells at base), the exact green commands, the retargeted Alt-binding audit table with its preserved verdicts, a Note that the main-window inline paint editor and shortcuts.ts are OUT OF SCOPE (different window; guardrail 2), and these native UAT rows verbatim as pending: (a) Studio window, Paint tool selected in Normal mode: press and hold Alt — hover previews the fresh stroke with the pointer glyph, the next click whole-stroke-deletes it and dragging pixel-erases baked paint, exactly like choosing the Erase tool, while the rail keeps Paint (Normal) highlighted the whole time. (b) Release Alt: the next gesture paints again and the brush ring returns; a lost Alt keyup never sticks — hold Alt, switch windows (blur) or hide the Studio, come back, the canvas paints, not erases. (c) Physics mode: with "Paint with physics" selected, holding Alt erases identically (fresh strokes whole-stroke, baked strokes pixel-erased with the force slider), releasing paints again, and Physics stays highlighted on the rail throughout. (d) Existing Alt behavior unchanged: with Alt held, Backspace/Delete still don't delete roto keys, Meta+Alt+C/X/V/A still don't fire roto clipboard/select-all, pressing Alt while typing in a rename field doesn't arm, and holding Alt alone changes nothing else. (e) Pressing or releasing Alt mid-stroke never converts the in-flight stroke (paint finishes paint, erase finishes erase), the selected tool never changes and nothing persists across a Studio reopen, and no new UI appears anywhere (no button, no overlay, no indicator). Never push; never commit .planning/**.</action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run && pnpm --filter efx-motion-editor exec tsc --noEmit && CHANGED=$(git diff --name-only "$(cat .git/gsd-plan-head-before-261003-vos)"...HEAD) && test -n "$CHANGED" && ! printf '%s\n' "$CHANGED" | grep -Ev '^(app/src/components/physic-paint/view/physicsPaintTemporaryErase(\.test)?\.ts|app/src/components/physic-paint/PhysicsPaintStudio\.tsx|\.planning/)' && ! printf '%s\n' "$CHANGED" | grep -E '^(packages/|app/src/lib/shortcuts\.ts|app/src/components/canvas/|app/src/stores/paintStore\.ts|app/src/components/physic-paint/view/physicsPaintStudioKeyboard\.ts)'</automated>
  </verify>
  <done>Full app suite green, tsc clean, scope proof shows only the three planned source files changed (empty diffs for packages/**, shortcuts.ts, PaintOverlay/paintStore/main-window, and the Studio dispatcher), SUMMARY written with automated-ready status, the retargeted audit table, the out-of-scope note and the five pending native UAT rows — code commits only (RED + feat), no docs commit.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| keyboard → Studio engine tool state | Window-level key events (possibly OS-chorded, possibly with lost keyup) cross into state that routes destructive pointer actions (stroke removal) inside the Studio webview |
| existing dispatcher exclusions → new modifier | The Alt key already gates the Studio dispatcher's own chords (Meta+Alt+C/X/V/A, Backspace, Escape exclusions) — the new listener must coexist without consuming events |
| cross-window isolation | The Studio window and the main window are separate webviews; only shortcuts.ts's absence in `/physics-paint` (main.tsx:37 vs :104) makes this feature safe from main-window Alt bindings |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-vos-01 | Denial of Service (stuck state) | temporaryErase lifecycle in view/physicsPaintTemporaryErase.ts | high | mitigate | keyup/blur/visibilitychange-hidden disarm unconditionally; apply is deferred to pointerup/pointercancel boundaries; a capture-phase pointerdown force-sync runs before the engine's own handler, so a lost Alt keyup (Alt+Tab, hidden Studio) can never make the next stroke erase; cells: KEYUP + LOST FOCUS, RECOVERY |
| T-vos-02 | Tampering | Studio dispatcher Alt exclusions (Backspace/Delete, Meta+Alt+C/X/V, Meta+Alt+A, Escape) | high | mitigate | Alt events are never suppressed and their default is never prevented (EVENT HYGIENE cell); physicsPaintStudioKeyboard.ts diff is EMPTY (scope proof); DISPATCHER GUARD PIN cells lock the exclusion behavior; arm gated to Paint tool + dispatcher's own isPhysicsPaintShortcutTarget |
| T-vos-03 | Tampering | erase behavior contract (ud9/hpi: pointer-delete fresh, pixel erase baked) | medium | mitigate | the feature's only engine interaction is engine.setTool — zero erase logic added; packages/** diff EMPTY (scope proof); armed path reaches the pre-existing 'erase' branch only |
| T-vos-04 | Elevation of Privilege | ungated arm (typing in a rename field, mutation-locked playback, wrong tool, no engine, key repeat) | medium | mitigate | keydown gate chain: isShortcutTarget + selected === 'paint' + engine present + !isMutationLocked + !repeat (GATED ARM cell); resolver keeps selected 'erase' from ever flipping to paint |
| T-vos-05 | Repudiation | "it works" claims on modifier feel, mid-stroke behavior and mode parity | medium | mitigate | verdict stays automated-ready; five native UAT rows (a)-(e) recorded pending in the SUMMARY — never claim done before live UAT |
| T-vos-SC | Tampering | npm/pip/cargo installs | high | mitigate | no installs in this quick — package-legitimacy gate not applicable |
</threat_model>

<verification>
- RED evidence: Task 1 file fails collection against the pre-change tree (new module does not exist) — recorded in commit + SUMMARY; the dispatcher guard pins are noted honestly as module-missing at RED and must be green from Task 2 onward.
- GREEN: Task 1 cells pass with zero assertion edits; physicsPaintStudioKeyboard.test.ts still green (113 tests); targeted command — pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/physicsPaintTemporaryErase.test.ts src/components/physic-paint/view/physicsPaintStudioKeyboard.test.ts.
- Full gates: pnpm --filter efx-motion-editor exec vitest run (full app suite, NEVER watch) and pnpm --filter efx-motion-editor exec tsc --noEmit (never a dev server, per CLAUDE.md).
- Scope proof vs the base recorded in .git/gsd-plan-head-before-261003-vos: only physicsPaintTemporaryErase.test.ts, physicsPaintTemporaryErase.ts, PhysicsPaintStudio.tsx (+ .planning/) changed; EMPTY for packages/**, app/src/lib/shortcuts.ts, app/src/components/canvas/**, app/src/stores/paintStore.ts, physicsPaintStudioKeyboard.ts, timeline.
- Alt audit re-run: the grep table in the objective still matches HEAD (four dispatcher rows only, all untouched).
- Native UAT (pending, verbatim in SUMMARY): rows (a)-(e) in Task 3.
</verification>

<success_criteria>
Task 1 RED cells exist and fail at base (collection failure recorded with cell list); Task 2 turns them green with zero assertion edits while the dispatcher, the erase contract and every pre-existing Alt exclusion stay byte-identical; full app vitest + tsc green; scope proof shows only the three planned source files (EMPTY for shortcuts.ts, the main-window paint tree, packages/** and the Studio dispatcher); SUMMARY written (uncommitted) with automated-ready status, the retargeted audit table, the out-of-scope note and five pending native UAT rows; commits: test(261003-vos) RED, feat(261003-vos) GREEN.
</success_criteria>

<output>
Create `.planning/quick/261003-vos-quick-3-alt-temporary-erase-intention-in/261003-vos-SUMMARY.md` when done (do not commit it — orchestrator owns the docs commit)
</output>
