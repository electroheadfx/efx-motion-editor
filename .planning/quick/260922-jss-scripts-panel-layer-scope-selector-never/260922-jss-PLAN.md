---
phase: quick-260922-jss
plan: 260922-jss
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/physic-paint/hooks/physicsPaintProjectContextSettlement.ts
  - app/src/components/physic-paint/hooks/physicsPaintProjectContextSettlement.test.ts
  - app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.ts
  - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx
  - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts
autonomous: true
requirements: []
estimate:
  tokens: 40000
  raw_tokens: 40000
  tasks: 2
  confidence: low
must_haves:
  truths:
    - "On device, opening the Physics Paint Studio on a project whose Actions come from more than one layer renders the Scripts-panel 'Action scope' selector — the row is no longer permanently absent."
    - "The selector still offers All plus one entry per live layer that owns at least one Action, and choosing one narrows ONLY the rendered list (the quick-260922-al1 contract, unchanged)."
    - "The order in which the mount-time read-only project-context pull and the asynchronous launch settle resolve no longer decides whether the layer list lands: a payload accepted while the launch context is still null is delivered by the next settle, exactly once, and a payload accepted after the settle is applied immediately."
    - "A Studio reopen never writes the stored scope: no mount path, no settle path and no re-pull emits a scope write; the stored filter survives close/reopen (al1 read-only contract)."
    - "The jump from a selected Rail to a linked neighbour reads 'Go to Rail' in BOTH the Rail inspector and the compact list-view Linked Rails section, matching 'Linked Rails — n of N' / 'Previous Rail' / 'Next Rail'."
    - "Nothing else about the panel's render rule changes: a single-option select stays hidden (no dead control), and no provenance/orphan semantics move."
  artifacts:
    - app/src/components/physic-paint/hooks/physicsPaintProjectContextSettlement.ts — the order-independent accept/settle controller
    - app/src/components/physic-paint/hooks/physicsPaintProjectContextSettlement.test.ts — the behavioural legs for both arrival orders (MUST end in .test.ts)
    - app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.ts — the bridge accept and the launch settle routed through the controller
    - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx — the renamed linked-nav label
    - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts — the re-scoped source pin plus one behavioural list-view leg
  key_links:
    - "app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.ts:237-243 — THE BUG. The project-context bridge handler reads input.peekLaunchContext() (PhysicsPaintStudio.tsx:2770 → the render-state `launchContext`, null until the settle publishes) and RETURNS on null with no stash, no retry and no log, so the pull's response is discarded."
    - "app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.ts:114-199 — applySettledLaunchContext is async: it awaits hydrateRotoPhysicalLaunchContext and requestImageLibrary BEFORE applyPhysicsPaintLaunchContext (:177) publishes the context and (:198) calls onSettledLaunchContext. The settle belongs immediately before :177, and the settled context must feed BOTH :177 and :198."
    - "app/src/components/physic-paint/bridge/usePhysicsPaintParentBridge.ts:159-186 — the ONE-SHOT read-only pull `void requestPhysicPaintProjectContext()` (:183, deliberately NO argument) fires once in a mount-only effect. Nothing re-pulls, so the fix must not depend on a second pull, and must never call the argument-carrying form."
    - "app/src/components/physic-paint/PhysicsPaintStudio.tsx:1090 — publishScriptScope is the ONLY caller of the argument-carrying request; that call site is the scope WRITE and is untouched by this plan."
    - "app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts:456-475 (updateProjectContext) → :391-402 (hydrateProjectContext) — the inbound hop writes scriptLayers/scriptScope DIRECTLY before every early return, so the settle path lands there exactly once per context; :377-390 documents the loop-termination contract (never route the inbound write through setScriptScope) and :470 is the once-per-context scan gate (lastAutoHydratedKey)."
    - "app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.test.ts:637 and :654-658 — the existing read-only pin: updateProjectContext calls publishScriptScope ZERO times while setScriptScope calls it exactly once. Must stay green."
    - "app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx:54-60 — the panel reads library.scriptLayers.value in its render body and gates the scope row on scopeEntries.length > 1 (:201); this is why the settle has to reach updateProjectContext for the control to exist at all."
    - "app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx:118-162 (inspector early return) vs :164-231 (list view) — MUTUALLY EXCLUSIVE, so exactly one 'Go to Rail' button exists in either rendering; the inspector already reads it at :154 while the list view reads it wrong at :223."
    - "app/vitest.config.ts — include is `src/**/*.test.ts`; a .test.tsx verify target exits 0 having run nothing (the repo's launcher convention is a sibling X.test.tsx.test.ts). Every test file this plan touches or creates MUST end in .test.ts."
---

<objective>
Fix the two defects reported on the quick-260922-al1 Scripts-panel layer scope, and nothing else:

1. **The layer-scope selector never renders on device.** Deterministic root cause, confirmed from code (no hypothesis left open): the selector is gated on `scopeEntries.length > 1` (`PhysicsPaintScriptsPanel.tsx:201`), which needs `scriptLayers`; `scriptLayers` is written only by `hydrateProjectContext` from `context.project.layers`; the ONLY payload that ever carries layers is the main realm's project context, which the child pulls once, read-only, at mount (`usePhysicsPaintParentBridge.ts:183`). That response arrives while `peekLaunchContext()` is still null (the launch context is published only at the END of the async settle, `usePhysicsPaintLaunchIntegration.ts:177`), and the bridge handler DROPS the payload on null (`:237-243`). A payload arriving after the settle is applied normally — so the bug is a pure arrival-order race, and `scriptLayers` therefore stays `[]` forever. The settle itself carries no layers (the Rust launch payload has no per-layer list).

   **Fix direction: (a), the stash.** Stash the arriving project and apply it once the launch context settles. Chosen over (b) re-issuing the read-only pull because (a) is synchronous, adds no bridge round trip, cannot loop, preserves the read-only contract by construction, and gives the RED test a behavioural target the Node harness can actually reach (the real Tauri/child transport of (b) is unreachable in-process). Both arrival orders then work: before the settle → stashed and delivered by the settle; after the settle → applied immediately as today.

2. **The list-view linked-nav label is wrong.** `PhysicsPaintScriptsPanel.tsx:223` reads "Go to Group" while the same action in the Rail inspector reads "Go to Rail" (`:154`) and its siblings read "Linked Rails — n of N" / "Previous Rail" / "Next Rail". Rename the visible label only — no handler, class or aria rename.

Purpose: the al1 deliverable finally reaches the artist (the selector is the whole point of that quick), and the panel's vocabulary stops contradicting itself.

Output: one small order-independent controller + its behavioural test, the hook rewired through it, the renamed label with a re-scoped and now behavioural pin, and PENDING native UAT rows.

Isolation: TypeScript only. No Rust, no IPC or event-pair change, no package-format change, no new dependency, no package/cache IO, no renderer-fs touch, no signature change to `usePhysicsPaintLaunchIntegration`'s inputs (the Studio call site at `PhysicsPaintStudio.tsx:2753-2777` stays byte-identical).
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md
@app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.ts
@app/src/components/physic-paint/bridge/usePhysicsPaintParentBridge.ts
@app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts
@app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx

Repo rules that bind this plan: `vitest run` only, NEVER watch mode (CLAUDE.md); Preact + @preact/signals only, never `useState`; every loop needs a written termination condition; effect deps must be identity-stable. Read `.claude/skills/efx-preact-reactivity/SKILL.md` before touching the hook and `.claude/skills/efx-async-orchestration/SKILL.md` before touching the order-dependent accept/settle path.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Make the project-context round trip order-independent (RED → refactor → GREEN)</name>
  <files>
    app/src/components/physic-paint/hooks/physicsPaintProjectContextSettlement.ts (new)
    app/src/components/physic-paint/hooks/physicsPaintProjectContextSettlement.test.ts (new)
    app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.ts
  </files>
  <behavior>
    All legs run against the controller directly — no DOM, no Tauri, no child realm. The controller's two ports are the ONLY seams: `peekLaunchContext(): PhysicPaintLaunchContext | null` and `applyContext(context): void`.
    - Leg (i) — payload before the settle (THE RED): given `peekLaunchContext()` returning null, `accept(project)` must NOT call `applyContext`; the following `settle(context)` must return a context whose `.project` IS that project. Today's extraction returns the context with `.project` untouched — that failing assertion IS the bug.
    - Leg (ii) — payload after the settle: given `peekLaunchContext()` returning an existing context, `accept(project)` calls `applyContext` exactly once with the existing context carrying the new project; a later `settle(other)` returns `other` unchanged (no stale re-application).
    - Leg (iii) — passthrough: `settle(ctx)` with nothing stashed returns the SAME object reference and never calls `applyContext`.
    - Leg (iv) — exactly once: one `accept` followed by two `settle` calls → the first carries the project, the second is a passthrough.
    - Leg (v) — only `.project` moves: every other field of the settled context (`document`, `audioPreview`, `operationId`, `layerId`, `startFrame`, `width`, `height`, `fps`) is reference-identical to the input; the input context object is never mutated.
    - Leg (vi) — newest wins: two `accept`s while `peekLaunchContext()` is null deliver the SECOND project at the settle.
  </behavior>
  <action>
    Three steps, three commits — RED, refactor, GREEN.

    STEP A (RED, production behaviour unchanged): create `physicsPaintProjectContextSettlement.ts` exporting the interface `PhysicsPaintProjectContextSettlement` and `createPhysicsPaintProjectContextSettlement(ports)` where ports are `peekLaunchContext: () => PhysicPaintLaunchContext | null` and `applyContext: (context: PhysicPaintLaunchContext) => void`. In THIS first version `accept(project)` reproduces the hook's current branch verbatim — read `peekLaunchContext()`; when null, return without stashing; when a context exists, call `applyContext({ ...current, project })` — and `settle(context)` returns its argument unchanged. Then create `physicsPaintProjectContextSettlement.test.ts` (MUST be `.test.ts`) with legs (i)-(vi). Run the targeted command and RECORD THE RAW OUTPUT in the task notes: legs (i), (iv) and (vi) must fail as ASSERTION failures naming the missing project, while (ii), (iii) and (v) pass as controls. A missing-module import error is NOT an acceptable RED — the module must exist and fail on the assertion, because the point of the RED is to demonstrate a dropped payload, not a missing file.

    STEP B (refactor, no behaviour change): rewire `usePhysicsPaintLaunchIntegration.ts` so the project path runs through the controller. Add a `settlementInputRef = useRef(input)` re-assigned on every render (the file's existing idiom, next to `applySettledLaunchContextRef.current = applySettledLaunchContext` at :210) and a `settlementRef` populated once when null, built with `peekLaunchContext: () => settlementInputRef.current.peekLaunchContext()` and `applyContext: (context) => { settlementInputRef.current.state.setLaunchContext(context); settlementInputRef.current.onSettledLaunchContext?.(context); }`. Replace the bridge handler body (:237-243) with `usePhysicsPaintProjectContextBridge((project) => { settlementRef.current?.accept(project); })` so the drop branch lives in the module. In `applySettledLaunchContext`, immediately BEFORE `applyPhysicsPaintLaunchContext` (:177), compute `const settledContext = settlementRef.current?.settle(hydration.context) ?? hydration.context;` and pass `settledContext` to BOTH `applyPhysicsPaintLaunchContext(...)` (:177) and the final `input.onSettledLaunchContext?.(...)` (:198). Every other use of `hydration.context` and `hydration.document` stays byte-identical, because the settle changes `.project` and nothing else. Do NOT change the hook's input signature, do NOT touch the Studio call site, do NOT add an effect, a signal, a timer, a retry or a re-pull — the replacement-launch coordinator and its six tests must be untouched. Re-run the targeted command: still RED on the same legs, which proves the extraction is behaviour-preserving.

    STEP C (GREEN): change ONLY the module. When `peekLaunchContext()` returns null, stash the project (last write wins — the newest payload is the freshest truth); `settle(context)` consumes the stash EXACTLY ONCE by reading it into a local and immediately clearing the field, returning `{ ...context, project: stashed }`, or the argument unchanged when there is no stash. Re-run the targeted command: all six legs green, plus the six existing coordinator tests.

    In the module, document two things: WHY the order is undefined (the one-shot read-only pull at `usePhysicsPaintParentBridge.ts:183` races the async settle in `applySettledLaunchContext`), and the TERMINATION CONDITION — the stash is consumed exactly once and nothing in this path reacts to what `settle` returns, so the loop cannot re-arm.

    HARD CONSTRAINTS: the inbound write must never route through `setScriptScope` (`physicsPaintRotoScriptLibrary.ts:377-390` is the loop-termination contract) and no mount or re-pull path may emit a scope write — the read-only pin at `physicsPaintRotoScriptLibrary.test.ts:637` must stay green. No new log may ship: if a dev-only log is added while diagnosing the drop branch, it is removed in the same task before the commit. Do not change the panel's render rule, any provenance/orphan semantic, or any package-IO / renderer-fs path.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/hooks/physicsPaintProjectContextSettlement.test.ts src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.test.ts</automated>
  </verify>
  <done>
    - `physicsPaintProjectContextSettlement.test.ts` exists (a `.test.tsx` sibling is never collected by `app/vitest.config.ts`) and all six legs pass.
    - Raw RED output for legs (i)/(iv)/(vi) is recorded, taken against the extracted current behaviour, with the three control legs green in the same run.
    - A payload accepted while `peekLaunchContext()` is null is delivered by the next `settle`, and the same stash is never delivered twice; a payload accepted when a context exists is applied immediately and leaves no stash behind.
    - The hook publishes the settled context through `applyPhysicsPaintLaunchContext` and `onSettledLaunchContext` exactly once per settle; the Studio call site is unchanged.
    - `usePhysicsPaintLaunchIntegration.test.ts` stays 6/6 green.
    - No new effect, signal, timer, re-pull, log or scope write; no Rust, event-pair or package-format change.
  </done>
</task>

<task type="auto">
  <name>Task 2: Rename the compact list-view linked-nav action to "Go to Rail"</name>
  <files>
    app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx
    app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts
  </files>
  <action>
    In `PhysicsPaintScriptsPanel.tsx`, the compact list-view Linked Rails section (`:219-231`) renders a single-link button whose visible text is the two-word label at `:223`. Change ONLY that text node so the button reads "Go to Rail". Do NOT touch the prop `onGoToGroup`, the class `physics-paint-loop-clip-inspector-action`, the surrounding `<section>` / `<strong>` markup or the `total === 1` guard — and leave the inspector's identical action at `:154` byte-identical. The button's accessible name IS its text, so no aria attribute is added or renamed.

    Then fix the pin. `PhysicsPaintScriptsPanel.test.ts:959-960` asserts the OLD two-word label against the WHOLE `panel` source string; after the rename the new label already appears in the inspector path, so a whole-file `toContain` would pass even if this rename were skipped — it would stop being a pin at all. Re-scope it to the `nav` slice the test already computes (the list-view region between `aria-label="Project Actions"` and `physics-paint-scripts-list`, `:944-953`) and assert the button's closing form there. Keep a whole-file guard too, but assert the SPECIFIC list-view line signature (the class plus `onClick={linkedGroupNavigation.onGoToGroup}` followed by the new label) so the assertion cannot be satisfied by the inspector occurrence.

    Add ONE behavioural leg to the same describe block, because a source-string assertion is the weaker half of the evidence: render the LIST view — `renderPanel(createFakePlayScript(), createFakeLibrary(), { linkedGroupNavigation: { currentIndex: 0, total: 1, onPrevious: vi.fn(), onNext: vi.fn(), onGoToGroup } })` with NO `selectedLoopClip`, so the inspector's early `return` at `:122` does not fire — then `findOne(tree, (vnode) => vnode.type === 'button' && textOf(vnode) === 'Go to Rail')` and invoke its `onClick` to assert `onGoToGroup` was called once. The inspector legs at `:791` and `:801` already use that exact predicate over the inspector rendering, and the two renderings are mutually exclusive, so `findOne`'s exactly-one-match contract holds in both.

    No handler, class, aria, CSS or prop rename anywhere; no change to any other test in the file.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts</automated>
  </verify>
  <done>
    - The compact list-view Linked Rails section's single-link button renders the text "Go to Rail"; the inspector's action is untouched.
    - The behavioural list-view leg finds exactly one such button and its click invokes `onGoToGroup`.
    - The re-scoped source assertions cannot be satisfied by the inspector occurrence (verified by mentally deleting the list-view rename: the assertion fails).
    - `onGoToGroup`, the CSS class and the `total === 1` guard are unchanged.
    - The whole `PhysicsPaintScriptsPanel.test.ts` suite is green.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| main webview → child webview (`physic-paint:project-context`) | Unchanged transport, unchanged payload shape and unchanged validator (`acceptPhysicPaintProjectContextPayload`). This plan changes only WHEN an already-validated payload is applied inside the child, never how it is accepted. |
| child webview → main webview (`physic-paint:project-context-request`) | Untouched. No new event, no new argument, no new call site: the argument-carrying (write) form still has exactly one caller, `PhysicsPaintStudio.tsx:1090`. |
| renderer → package / cache / scripts IO (unchanged) | This plan adds no IO, no Rust command and no plugin-fs surface. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-260922-jss-01 | Tampering | `physicsPaintProjectContextSettlement.settle` across a launch boundary | low | mitigate | A stashed project is applied to the NEXT settle, which can cross a launch boundary if hydration fails first. The blast radius is bounded by the existing reset law: `hydrateProjectContext` treats a `contextId` CHANGE as a project rotation and returns the scope to All with an empty layer list, so a cross-project stash cannot silently select another project's scope. The stash carries an already-validated payload (the bridge's `accept` gate) and only ever writes `.project`; all other context fields are reference-identical. |
| T-260922-jss-02 | Tampering | the settle path becoming a scope WRITE | medium | mitigate | A scope write on an inbound path would let a Studio reopen reset the stored filter — the exact regression the al1 read-only contract forbids. The fix touches only the inbound accept/settle; `publishScriptScope` keeps its single caller (`setScriptScope`, `physicsPaintRotoScriptLibrary.ts:374`) and its zero-call pin in `updateProjectContext` (`physicsPaintRotoScriptLibrary.test.ts:637`) must stay green. No re-pull is added, and the pull stays argument-free. |
| T-260922-jss-03 | Denial of service | stash accumulation / re-arm loop | low | mitigate | The stash is a single slot consumed exactly once (read-then-clear), so repeated payloads cannot accumulate; leg (vi) pins last-write-wins and leg (iv) pins the exhaustion. No effect, timer rAF or retry is added, and the module documents its termination condition, so no writer reacts to what `settle` returns. |
| T-260922-jss-04 | Repudiation | silent drop of a payload with no trace | low | accept | Fail-open would have been worse than the current silence: the fix removes the drop entirely for the reachable order, so there is nothing left to trace. No permanent log is added (an interim dev-only log is explicitly scheduled for removal inside Task 1). |
| T-260922-jss-SC | Tampering | npm/pip/cargo installs | n/a | accept | No package is installed, no dependency and no lockfile changes. No legitimacy checkpoint required. |
</threat_model>

<verification>
Quick-level checks, all required before the SUMMARY is written:

1. `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/hooks/physicsPaintProjectContextSettlement.test.ts src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.test.ts src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts` — green. Targeted runs use PACKAGE-relative paths (`src/...`), never `app/src/...`: the `exec` cwd is `<repo>/app`.
2. `pnpm --filter efx-motion-editor exec vitest run` — full suite green; every failure pre-existing at the plan base is named and attributed, never absorbed.
3. `pnpm --filter efx-motion-editor exec tsc --noEmit` — clean.
4. `git diff --name-only` against the plan base contains ONLY `app/src/**` and the `.planning/quick/260922-jss-…/` artifacts: no `app/src-tauri/**`, no `package.json`, no lockfile, no `vitest.config.*`, no plugin-fs allowlist.
5. The RED evidence is recorded in the SUMMARY with the exact command, the raw failing assertions of legs (i)/(iv)/(vi) taken against the extracted current behaviour, and the base commit it was measured at — plus a one-line statement of what each leg now guards. No RED verdict may be taken after the module's semantics change.
6. The read-only contract is re-verified, not assumed: `updateProjectContext` still calls `publishScriptScope` zero times and `setScriptScope` still calls it exactly once.
7. Native UAT rows are carried into the SUMMARY as PENDING — never claimed. The rows: (1) open the Studio on a project with Actions saved from more than one layer → the "Action scope" selector is present and lists All plus each owning layer's live name; (2) pick a layer entry → the list narrows to that layer's Actions, All restores everything; (3) close the Studio and reopen it (same or another layer, same project) → the selector is present again and the previously chosen scope is still selected; (4) on a Rail linked to exactly one other Rail, the compact list-view nav reads "Go to Rail" and clicking it jumps to that Rail, and the Rail inspector for the same selection also reads "Go to Rail".
</verification>

<success_criteria>
- The selector renders in the running app on a project whose Actions span more than one layer — the al1 gate `scopeEntries.length > 1` now passes because `scriptLayers` lands.
- The round trip is order-independent by construction, proven at the controller seam by behavioural legs covering both arrival orders, exactly-once consumption and the no-stash passthrough — no source-shape or textual pin carries the proof.
- The read-only contract survives: no mount, settle or re-pull path writes the stored scope, and the existing zero-call pin stays green.
- The panel's render rule, the provenance/orphan semantics, the al1 fail-open rules and the once-per-context scan gate (`lastAutoHydratedKey`) are unchanged.
- The compact list-view linked-nav action reads "Go to Rail", pinned by a re-scoped source assertion AND a behavioural render leg; no handler, class or aria rename.
- TypeScript only: no Rust, no IPC or event-pair change, no package-format change, no new dependency, no package/cache IO, no permanent log.
</success_criteria>

<output>
Create `.planning/quick/260922-jss-scripts-panel-layer-scope-selector-never/260922-jss-SUMMARY.md` when done, carrying the recorded RED evidence and the PENDING native UAT rows.
</output>
