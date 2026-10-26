---
phase: quick-261026-odd
plan: 261026-odd
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/shared/frameModuleLock.ts
  - app/src/components/shared/frameModuleLock.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx
  - app/src/components/physic-paint/view/physicsPaintTemporaryMove.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
autonomous: true
requirements: []
estimate:
  tokens: 26000
  raw_tokens: 26000
  tasks: 2
  confidence: low
must_haves:
  truths:
    - "The Move tool is enabled on a key only when that key owns a Brush stroke script ('brush' or 'both' in frameScriptOwner); a Motion/Static/Reveal rail key that baked pixels only is greyed."
    - "Move cannot be activated from any path while the current key's Brush script is empty: rail click, Cmd tap, held-Cmd arm and programmatic reselect are all refused."
    - "If Move is active and the current key's Brush script empties (a bake replaced the span's key identities, a delete, or an explicit navigation to a pixel-only key), the tool exits Move and restores the last non-Move tool with labels and cursor."
    - "The Move gate, the Raster button and the module lock all read the same frameScriptOwner truth; no engine stroke count gates Move."
    - "A closed Move gate never renders the active highlight: the icon is visibly greyed, never blue."
    - "An accepted physical edit (including a Play Script Motion/Static apply) and a successful Reveal rail creation republish the current key's owner in the same transition."
  artifacts:
    - path: "app/src/components/shared/frameModuleLock.ts"
      provides: "brushMoveAvailable computed — the ONE Move enable gate derived from frameScriptOwner."
    - path: "app/src/components/shared/frameModuleLock.test.ts"
      provides: "truth-table tests for brushMoveAvailable (null/watercolor false, brush/both true, value-change-only notifications)."
    - path: "app/src/components/physic-paint/PhysicsPaintStudio.tsx"
      provides: "brushMoveAvailable consumers (Cmd tap, held-Cmd, rail memo), the selectTool activation guard, the force-exit effect, the gated engine re-create re-apply, and the accepted-edit / reveal-create owner republish."
    - path: "app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx"
      provides: "moveAvailable prop, moveDisabled from the owner gate, and active-highlight suppression while disabled."
    - path: "app/src/components/physic-paint/view/physicsPaintTemporaryMove.test.ts"
      provides: "updated source pins for the owner-derived gate and the retired engine-ledger writer."
    - path: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts"
      provides: "updated Cmd-gate pins plus the new activation-boundary / stale-Move exit pins."
  key_links:
    - from: "frameScriptOwner"
      to: "brushMoveAvailable"
      via: "computed in frameModuleLock.ts — 'brush' or 'both' opens Move, everything else closes it"
    - from: "brushMoveAvailable"
      to: "PhysicsPaintToolRail moveDisabled + selectTool guard + onMetaTap + isMoveAvailable"
      via: "the same one-way gate at every activation boundary"
    - from: "accepted physical edit / createReveal success"
      to: "applyFrameModuleState(currentFrame)"
      via: "the existing ownership funnel — republishes frameScriptOwner in the same transition"
    - from: "settings.tool === 'move' and a closed gate"
      to: "selectTool(lastNonMoveToolRef.current, settings.physicsMode)"
      via: "the force-exit effect — restores labels and cursor through the existing Move-exit branch"
---

<objective>
Enforce the decided law on the Roto/Play Script Studio surface: a key with an empty stroke script has no Move. Motion, Static and Reveal rails bake pixels only and add no stroke script, so the Move tool must be greyed and unactivatable on their keys; any already-active Move must leave when the current key's script empties.

Purpose: today the Move gate is `strokeScriptInMemory`, written from the engine's history listener (`getStrokeCount() > 0`). That is the engine ledger, not the key's script truth: it can stay true on a pixel-only baked key, the rail renders Move `active` even while disabled, nothing exits `settings.tool === 'move'` when the script empties, and the engine re-create path re-enters Move ungated. The Studio already publishes the canonical per-key truth — `frameScriptOwner`, fed by `resolveFrameScriptOwner` and shared with the Raster button and the module lock — so Move must derive from it.

Output: a `brushMoveAvailable` computed over `frameScriptOwner`, wired into the rail, the Cmd tap, the held-Cmd arm, the activation funnel and the engine re-create path, with a force-exit effect and owner republishes on accepted physical edits and Reveal creation. The old engine-ledger signal and its writer are retired.

Locked decisions (from the quick contract — never revisit):
- D-01: the law is "if the script is empty on a key, no Move (tool greyed)". The key's stroke-script ownership is the source of truth — never the rail kind alone, and never the engine stroke count.
- D-02: Motion/Static/Reveal rails write pixels only and carry no stroke script; Move must be greyed on their keys. Adding a script to these rails is a later option, not this fix.
- D-03: the law applies to ACTIVATION, not only the button visual: keyboard shortcut, held-Cmd arm and every programmatic path must refuse Move on an empty script, and an active Move must exit when the script empties.
- D-04: Preact + @preact/signals only. No useState; idempotent compare-then-write setters; narrow leaf signal reads; no signal writes in a render body; identity-stable effect deps; the established `useEffect(() => { const dispose = effect(...); return dispose; }, [stableDeps])` idiom.
- D-05: pnpm only; gate with `vitest run` (never watch mode); never start the dev server. Native visual UAT is the user's. Validate the live fix first; regression pins go on existing test surfaces only.

Verified at planning time (evidence, not assumptions):
- Move visual gate: PhysicsPaintToolRail.tsx:167 (`strokeScriptInMemory` prop), :254 (`const moveDisabled = !strokeScriptInMemory.value;`), :279-287 (`active` computed independently of `disabled`, so a disabled Move still renders `.active`; physicsPaintStudio.css `.active` and `:disabled` are independent and `:disabled` only lowers opacity).
- Gate writer: PhysicsPaintStudio.tsx:1228 (`const strokeScriptInMemory = useSignal(false);`) and :5421 (`strokeScriptInMemory.value = readyEngine.getStrokeCount() > 0;` inside the history listener).
- Cmd paths: PhysicsPaintStudio.tsx:1713-1725 (`onMetaTap` gates Move entry on `strokeScriptInMemory.peek()`), :1728-1730 (`isMoveAvailable` Brush arm), physicsPaintTemporaryMove.ts (held-Cmd arm consumes `isMoveAvailable`).
- Activation and programmatic paths: the ONE `selectTool` funnel at PhysicsPaintStudio.tsx:1938-1960 has no Move guard; the engine re-create block at :5457-5469 re-applies `setTool('move')` ungated.
- Canonical truth: frameModuleLock.ts:18-23 (`frameScriptOwner` + compare-then-write `setFrameScriptOwner`), frameScriptOwnership.ts:21-40 (`resolveFrameScriptOwner` reads the session stores plus an optional live ledger sample). It already drives the Raster button (`resolveRasterKeyPresentation({ hasScript: owner !== null })`) and the module lock.
- Owner publishers: `applyFrameModuleState` (PhysicsPaintStudio.tsx:1746-1755) on navigation (:3903), completed mutations (:5498-5503), purges (:5253), raster (:6356-6357). The accepted physical-edit transition (:4438-4465) does NOT republish, and Reveal creation (:3317-3320) does NOT republish.
- Bake identity drop: Play Script bakes replace the span's records with new keyIds; `applyScriptRecordRemaps` (:2026-2035) → `remapBrushScriptsForRecords` drops session entries whose keyIds no longer map (keyIdentityFrameMap leaves no mapping for replaced identities). Motion/Static apply dispatches through `executePhysicalEdit` (useRotoPlayScriptController.ts:129); Reveal creation calls `createRevealRail` directly (:3298-3322).
- Rail mode scope: the Brush rail (and therefore its Move button) renders only when `activeModule.value !== 'watercolor'` (PhysicsPaintToolRail.tsx:236-247); Water color keeps its own Select toggle.
- Existing source pins that must change: physicsPaintTemporaryMove.test.ts:61-62, :687-718; PhysicsPaintStudio.test.ts:2975-2982 (`: strokeScriptInMemory.peek()),`) and :3080 (`if (settings.tool === 'paint' && strokeScriptInMemory.peek()) {`).

Accepted scope (do not expand):
- The gate is per current key as published by the existing explicit-selection funnel. Playback and mid-drag scrubs intentionally do not republish the owner (PhysicsPaintStudio.tsx:3903); this quick does not add a playback publisher.
- Do not touch the Water color select overlay, the aquarelle stroke-selection model, or the module lock rule.
- Do not add a second owner resolver or a second script store: `frameScriptOwner` is the one truth.
- No new framework state, no new memo family, no CSS redesign: the existing `.active` / `:disabled` classes carry the greyed visual once `active` is suppressed.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md
@app/src/components/shared/frameModuleLock.ts
@app/src/components/shared/frameModuleLock.test.ts
@app/src/components/physic-paint/view/frameScriptOwnership.ts
@app/src/components/physic-paint/view/frameScriptOwnership.test.ts
@app/src/components/physic-paint/PhysicsPaintStudio.tsx
@app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx
@app/src/components/physic-paint/view/physicsPaintTemporaryMove.ts
@app/src/components/physic-paint/view/physicsPaintTemporaryMove.test.ts
@app/src/components/physic-paint/PhysicsPaintStudio.test.ts
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Derive the one Move gate from the frame's script owner</name>
  <files>app/src/components/shared/frameModuleLock.ts, app/src/components/shared/frameModuleLock.test.ts</files>
  <behavior>
    - RED first: the new `brushMoveAvailable` import does not exist, so the truth-table tests fail before the computed is added (record the failing output in the SUMMARY).
    - A null owner (pixel-only key: Motion/Static/Reveal bake, empty key) reports false.
    - A 'watercolor' owner reports false — Move is the Brush script tool; Water color keeps its own Select toggle.
    - A 'brush' owner reports true; a 'both' owner reports true.
    - The computed tracks `setFrameScriptOwner` transitions inside one `effect` and notifies only when the boolean value actually changes (brush -> both stays true and does not rerun the effect).
    - The existing compare-then-write owner test and every existing frameModuleLock test stay green.
  </behavior>
  <action>
    Work test-first in app/src/components/shared/frameModuleLock.test.ts, then add the computed in app/src/components/shared/frameModuleLock.ts.

    frameModuleLock.ts:
    1. Change the signal import to `import { computed, signal } from '@preact/signals';`.
    2. After `clearFrameScriptOwner()` (line 27), add exactly:
       export const brushMoveAvailable = computed(
         () => frameScriptOwner.value === 'brush' || frameScriptOwner.value === 'both',
       );
       Above it, add a doc comment: quick-261026-odd — the Move tool's ONE enable gate. Move translates a stroke script, so only a Brush-owned key can enter it; a Water color-only key and a scriptless key (Motion/Static/Reveal rails bake pixels only) have nothing to move. Derived from frameScriptOwner so the rail, the Cmd tap, the held-Cmd arm and every programmatic activation read the same truth.
    3. Do not change `FrameScriptOwner`, `frameScriptOwner`, `setFrameScriptOwner`, `clearFrameScriptOwner`, `lockedModuleForOwner` or `lockedModuleTooltip`.

    frameModuleLock.test.ts:
    4. Add `brushMoveAvailable` to the existing import from './frameModuleLock'.
    5. Add a `describe('brushMoveAvailable', ...)` after the `frameScriptOwner signal` describe with two tests:
       (a) "opens only for a Brush-owned key": start null -> false; setFrameScriptOwner('watercolor') -> false; 'brush' -> true; 'both' -> true; clearFrameScriptOwner() -> false.
       (b) "tracks owner transitions in one effect and notifies only on a value change": subscribe with `effect(() => { seen.push(brushMoveAvailable.value); })` in try/finally dispose; then setFrameScriptOwner('brush'), 'both', 'watercolor', null in that order. Expect `seen` to equal `[false, true, false]` — the 'both' step keeps true (no effect rerun) and the null step keeps false after 'watercolor' (no rerun). The beforeEach/afterEach in the file already reset the owner.
    6. Do not weaken or edit any existing assertion.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/shared/frameModuleLock.test.ts src/components/physic-paint/view/frameScriptOwnership.test.ts</automated>
  </verify>
  <done>frameModuleLock exports `brushMoveAvailable`, a computed that is true only for 'brush'/'both'; the truth-table and value-change tests pass; the resolver suite and every existing frameModuleLock test pass unchanged.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Gate Move on the current key at every activation boundary and exit a stale Move</name>
  <files>app/src/components/physic-paint/PhysicsPaintStudio.tsx, app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx, app/src/components/physic-paint/view/physicsPaintTemporaryMove.test.ts, app/src/components/physic-paint/PhysicsPaintStudio.test.ts</files>
  <behavior>
    - The Brush rail passes `moveAvailable: brushMoveAvailable`; `moveDisabled = !moveAvailable.value`.
    - A disabled Move never carries the `active` class: the icon is greyed, never blue, even if `settings.tool` is still 'move' for a render.
    - The Cmd tap enters Move only when `settings.tool === 'paint' && brushMoveAvailable.peek()`; the held-Cmd arm's Brush `isMoveAvailable` reads `brushMoveAvailable.peek()`.
    - The `selectTool` funnel refuses `tool === 'move'` in Brush mode when the gate is closed, BEFORE the no-engine / physical-lock early return — so the law holds for rail clicks, Cmd taps, held-Cmd and programmatic reselects.
    - When `settings.tool === 'move'` and the current key's gate closes, an effect exits Move through `selectTool(lastNonMoveToolRef.current, settings.physicsMode)`; it retries after a mutation lock clears and never writes a signal in the render body.
    - A re-created engine never re-applies `setTool('move')` when the gate is closed; it restores the last non-Move tool in the engine and in settings.
    - An accepted physical edit republishes the current key's owner in the same accepted transition; a successful Reveal rail creation does the same immediately after `createRevealRail` returns ok.
    - The engine-ledger gate (`strokeScriptInMemory`) and its history-listener writer are gone; no other behavior of that listener changes.
  </behavior>
  <action>
    Work test-first: update the existing source pins and add the new law pins, run them RED, then wire the Studio and the rail.

    PhysicsPaintToolRail.tsx:
    1. Rename the prop `strokeScriptInMemory` to `moveAvailable: ReadonlySignal<boolean>` (line 167) and update its doc comment to: quick-261026-odd — gates the Move icon; Move needs a Brush script on the current key.
    2. Rename the destructured field in `PhysicsPaintToolRailImpl` (line 225) to `moveAvailable`.
    3. Replace the gate at line 252-254 with the comment and line:
       const moveDisabled = !moveAvailable.value;
       (comment: quick-261026-odd: the Move icon is enabled only while the current key owns a Brush script — the same narrow-leaf signal precedent as readEffectiveTool above.)
    4. Inside the map (line 279-280) add `moveBlocked` and suppress the active highlight while blocked, exactly:
       const moveBlocked = item.id === 'move' && moveDisabled;
       const active = isItemActive(item, displayTool, physicsMode) && !moveBlocked;
       const className = `physics-paint-icon-button${active ? ' active' : ''}`;
    5. Replace the button's disabled expression (line 287) with `disabled={disabled || moveBlocked}`. Do not touch the WatercolorRail branch, the history buttons, `isItemActive`, `runAction` or the CSS.

    PhysicsPaintStudio.tsx:
    6. Extend the frameModuleLock import (line 189) to include `brushMoveAvailable`.
    7. Delete the `strokeScriptInMemory` signal and its 4-line comment (lines 1223-1228, from "quick 261004-dn5" through `const strokeScriptInMemory = useSignal(false);`).
    8. In `onMetaTap` (line 1722) replace the gate with:
       if (settings.tool === 'paint' && brushMoveAvailable.peek()) {
       In `isMoveAvailable` (line 1728-1730) replace the Brush arm with `: brushMoveAvailable.peek()),`.
    9. Add the activation guard as the FIRST statement of the `selectTool` useCallback (line 1938), before `const activeEngine = engineRef.current;`, exactly:
       if (tool === 'move' && activeModule.peek() === 'brush' && !brushMoveAvailable.peek()) return;
       Above it add a comment: quick-261026-odd: the activation boundary — a scriptless Brush key refuses Move from the rail, the Cmd tap, the held-Cmd arm and every programmatic reselect. The greyed icon is not the only gate.
    10. Immediately after the `selectTool` useCallback (line 1960) add the force-exit effect exactly:
       useEffect(() => {
         const dispose = effect(() => {
           if (activeModule.value !== 'brush' || settings.tool !== 'move') return;
           if (brushMoveAvailable.value || mutationLocked) return;
           selectTool(lastNonMoveToolRef.current, settings.physicsMode);
         });
         return dispose;
       }, [selectTool, settings.tool, settings.physicsMode, mutationLocked]);
       Above it add a comment: quick-261026-odd: the Move law on the EXIT side. When the current key's Brush script empties — a Motion/Static/Reveal bake replaced its records, a delete, or an explicit navigation to a pixel-only key — a persistent Move must leave the tool too. One gate: brushMoveAvailable. mutationLocked keeps the effect alive so an exit refused mid-operation retries when the lock clears. Signal reads/writes happen inside effect(), never the render.
    11. In the accepted physical-edit transition (line 4438, the first `if (transition === 'accepted' && accepted) {` inside `consumeBridgeApplyResult`), insert as its first statement:
        applyFrameModuleState(currentFrame);
        Add the comment: quick-261026-odd: Motion/Static/Reveal bakes REPLACE the span's key identities, so applyScriptRecordRemaps drops their session scripts. Republish the current key's owner from the stores in the same accepted transition so the Move gate closes without waiting for a navigation.
    12. In the `createReveal` port (line 3317-3319), inside `if (result.ok) {` and before the return, add:
        applyFrameModuleState(launchContextRef.current?.startFrame ?? 0);
        Add the comment: quick-261026-odd: the Reveal bake wrote pixel-only keys; republish the current key's owner so a prior Brush owner cannot keep Move open.
    13. In the history listener (line 5415-5422) delete only the 3-line `strokeScriptInMemory` comment and the writer line `strokeScriptInMemory.value = readyEngine.getStrokeCount() > 0;`. Keep `rotoMoveHistory.reconcilePaintBarriers(availability);` and `rotoScript.notifySourceRevision();` exactly.
    14. In the tool-rail memo (line 5058-5069) replace `strokeScriptInMemory` with `brushMoveAvailable` in the resolve deps array and `moveAvailable: brushMoveAvailable,` in the returned object in place of `strokeScriptInMemory,`.
    15. In the engine re-create block (line 5457-5469) keep the outer `if (activeModule.peek() === 'brush' && settingsRef.current.tool === 'move') {` and branch on the gate:
        if (brushMoveAvailable.peek()) { ...the existing setTool('move'), label/cursor suppression and guarded flush unchanged... }
        else { readyEngine.setTool(lastNonMoveToolRef.current); readyEngine.setPhysicsMode(settingsRef.current.physicsMode); setSettings((current) => ({ ...current, tool: lastNonMoveToolRef.current, physicsMode: settingsRef.current.physicsMode })); }
        Add the comment on the else: quick-261026-odd: a fresh engine must never resurrect Move on a scriptless key. Restore the last non-Move tool in both the engine and settings.

    physicsPaintTemporaryMove.test.ts:
    16. Update the header comment pins at lines 61-62 to name `brushMoveAvailable` (the owner-derived gate) instead of `strokeScriptInMemory`.
    17. Rewrite the rail test at lines 687-697 (rename it "the rail highlights the move item, dispatches its selection and gates it on the key's Brush script") to keep the two existing dispatch/highlight pins and replace the gate pins with:
        expect(railSource).toContain('moveAvailable');
        expect(railSource).toContain('const moveDisabled = !moveAvailable.value;');
        expect(railSource).toContain("const moveBlocked = item.id === 'move' && moveDisabled;");
        expect(railSource).toContain('const active = isItemActive(item, displayTool, physicsMode) && !moveBlocked;');
        expect(railSource).toContain('disabled={disabled || moveBlocked}');
    18. Replace the history-writer test at lines 699-706 with a test named "the Studio derives the Move gate from the frame owner, never the engine ledger": assert `studioSource` contains `brushMoveAvailable.peek()`, does not contain `strokeScriptInMemory`, and the `readyEngine.setHistoryAvailabilityListener(` slice up to the next `});` does not contain `getStrokeCount()`.
    19. In the memo test at lines 708-718 replace the two `strokeScriptInMemory` memo pin lines with:
        expect(memo).toContain('brushMoveAvailable');
        expect(memo).toContain('moveAvailable: brushMoveAvailable,');
        Keep the armed-guard pin and the `not.toContain('const [strokeScriptInMemory')` Preact-signals pin.

    PhysicsPaintStudio.test.ts:
    20. Line 2978: change `': strokeScriptInMemory.peek()),'` to `': brushMoveAvailable.peek()),'`.
    21. Line 3080: change `"if (settings.tool === 'paint' && strokeScriptInMemory.peek()) {"` to `"if (settings.tool === 'paint' && brushMoveAvailable.peek()) {"`.
    22. Add one new `it` in the same describe (next to the Cmd-tap pins) named "applies the empty-script Move law to activation and exits a stale Move" with these exact pins:
        expect(studio).toContain("if (tool === 'move' && activeModule.peek() === 'brush' && !brushMoveAvailable.peek()) return;");
        expect(studio).toContain("if (activeModule.value !== 'brush' || settings.tool !== 'move') return;");
        expect(studio).toContain('if (brushMoveAvailable.value || mutationLocked) return;');
        expect(studio).toContain('selectTool(lastNonMoveToolRef.current, settings.physicsMode);');
        expect(studio).toContain("if (activeModule.peek() === 'brush' && settingsRef.current.tool === 'move') {");
        expect(studio).toContain('if (brushMoveAvailable.peek()) {');
        const acceptanceAnchor = studio.indexOf('const beforeKeyIds = new Set(');
        const acceptanceStart = studio.lastIndexOf("if (transition === 'accepted' && accepted) {", acceptanceAnchor);
        expect(studio.slice(acceptanceStart, acceptanceAnchor)).toContain('applyFrameModuleState(currentFrame);');
        const revealStart = studio.indexOf('createReveal: async (input) => {');
        const revealEnd = studio.indexOf('mapRevealRailRejectionReason', revealStart);
        expect(studio.slice(revealStart, revealEnd)).toContain('applyFrameModuleState(launchContextRef.current?.startFrame ?? 0);');
    23. Do not weaken any existing assertion, including the PropsMemo count and the ownership-republish funnel tests.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts src/components/physic-paint/view/physicsPaintTemporaryMove.test.ts src/components/physic-paint/view/frameScriptOwnership.test.ts src/components/shared/frameModuleLock.test.ts && pnpm --filter efx-motion-editor run typecheck</automated>
  </verify>
  <done>The rail, the Cmd tap, the held-Cmd arm, the selectTool funnel and the engine re-create path all read brushMoveAvailable; a closed gate suppresses the active highlight and exits a stale Move to the last non-Move tool; accepted physical edits and Reveal creation republish the owner; the engine-ledger signal and writer are gone; the Studio, temporary-Move, ownership and frameModuleLock suites pass; the app typechecks.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Frame script stores → Move enable gate | The gate is UI state derived from local session stores and the live engine ledger; no external or network input. |
| Physical edit acceptance → frame owner signal | The parent-accepted Roto document is the authority for key identities; the child Studio republishes its owner from its stores after the remap. |
| Keyboard / programmatic tool dispatch → engine tool | Shortcut and reselect paths cross the same activation boundary as the rail button and must not bypass the gate. |
| npm/pip/cargo installs | No dependency is added by this quick. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-quick-261026-odd-01 | Tampering | Move enable gate (rail + Cmd + engine re-create) | medium | mitigate | The gate derives from the ONE `frameScriptOwner` signal (same truth as the Raster button and module lock). The history-listener writer is retired; accepted physical edits and Reveal creation republish the owner. Pinned by the new frameModuleLock and Studio tests. |
| T-quick-261026-odd-02 | Elevation of Privilege | `selectTool` programmatic activation | medium | mitigate | A hard guard at the top of the ONE selectTool funnel refuses Move on a scriptless Brush key before the no-engine/lock early return, so no shortcut or programmatic path can bypass the greyed icon. Pinned by the activation-boundary test. |
| T-quick-261026-odd-03 | Denial of Service | force-exit effect loop | medium | mitigate | The inner effect early-returns unless the active module is brush and the tool is exactly 'move'; it writes only through the existing selectTool path, and the outer deps are identity-stable primitives. Once the tool leaves Move, the effect returns without writing. No state or signal write occurs in the render body. |
| T-quick-261026-odd-04 | Repudiation | stale active highlight on a disabled Move | low | mitigate | `moveBlocked` suppresses the `active` class for Move while the gate is closed, so the UI never claims an unactivatable Move is selected. Pinned by the rail source test. |
| T-quick-261026-odd-SC | Tampering | npm/pip/cargo installs | high | mitigate | No package is added by this quick. If one becomes necessary, run the Package Legitimacy Gate and insert a blocking human-verification checkpoint for any [ASSUMED]/[SUS] package; never install [SLOP]. |
</threat_model>

<verification>
## Automated

- `pnpm --filter efx-motion-editor exec vitest run src/components/shared/frameModuleLock.test.ts src/components/physic-paint/view/frameScriptOwnership.test.ts`
- `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts src/components/physic-paint/view/physicsPaintTemporaryMove.test.ts src/components/physic-paint/view/frameScriptOwnership.test.ts src/components/shared/frameModuleLock.test.ts`
- `pnpm --filter efx-motion-editor run typecheck`

## Native UAT (live Studio, user-driven — never start the dev server for it)

| # | Action | Expected |
|---|--------|----------|
| 1 | Create a rail with Motion from Play Script, then select one of its baked keys | The Move icon is greyed; clicking it does nothing; no blue active highlight appears |
| 2 | Create a rail with Static, select a baked key, press Cmd | Cmd is inert: the tool does not enter Move, and holding Cmd does not arm the Move overlay |
| 3 | Create a rail with Reveal, select a baked key | Move is greyed on every baked key of the rail; Reveal playback itself is unchanged |
| 4 | Paint a real Brush key, then click Move and press Cmd | Move is enabled and both entries work exactly as today (select, drag, handles) |
| 5 | From Move on that scripted key, navigate to a pixel-only baked key | The tool exits Move to the previous Paint (or Erase) tool; labels and the brush cursor are restored |
| 6 | From Move on a scripted key, run a Play Script Motion/Static apply that replaces the key | On the accepted edit the tool leaves Move without needing a frame navigation |
| 7 | Raster a scripted key from the timeline header | After the raster, Move is greyed on that key in the same step |
| 8 | Water color mode on an aquarelle key | The Water color rail's Select toggle behaves exactly as before; the Brush Move gate does not alter it |

</verification>

<success_criteria>
- A key with an empty stroke script has no Move: the icon is greyed, never blue, and no activation path can enter Move.
- Motion, Static and Reveal rail keys (pixel-only bakes) are greyed on the current key, and a Move that was active exits when the key's script empties.
- Move remains fully functional on Brush-scripted keys through the rail and the Cmd tap.
- The Move gate, the Raster button and the module lock read the same `frameScriptOwner` truth; the engine-ledger gate and its writer are retired.
- Accepted physical edits and Reveal creation republish the owner in the same transition; no stale owner survives a bake.
- The listed suites pass, the app typechecks, and the native UAT rows are ready for the user's live run.
</success_criteria>

<output>
Create `.planning/quick/261026-odd-fix-actually-create-a-rail-with-motion-r/261026-odd-SUMMARY.md` when done
</output>
