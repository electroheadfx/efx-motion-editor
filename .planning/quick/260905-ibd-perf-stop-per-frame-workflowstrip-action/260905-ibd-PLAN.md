---
phase: quick-260905-ibd
plan: 260905-ibd
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/physic-paint/hooks/useRotoTimelineActions.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
  - app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts
autonomous: true
requirements: [G-52-9]
estimate:
  tokens: 45000
  raw_tokens: 45000
  tasks: 3
  confidence: low
must_haves:
  truths:
    - During a scrub, the workflow strip's action-row buttons no longer re-render every frame: the action-row is a memo-wrapped component whose props (signals, scalars, handlers) are identity-stable across Studio renders.
    - Availability stays LIVE (HARD CONSTRAINT): after scrubbing to frame N and releasing, +Key/Delete/Scissor/Paste immediately reflect frame N's availability — no stale enabled/disabled state.
    - The availability computeds are identity-stable across renders (useComputed) and re-evaluate when their signal-tracked inputs change (every classifier input port reads a signal or a deferred ref).
    - The action-row buttons read ReadonlySignal props in narrow per-button subscribers; the strip's internal currentFrame mirror is replaced by the Studio-owned signal prop.
    - The whole app test suite stays green and tsc --noEmit is clean.
  artifacts:
    - app/src/components/physic-paint/hooks/useRotoTimelineActions.ts (useComputed availability computeds + currentFrameSignal hook argument + effectiveInput override)
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx (Studio-owned currentFrameSignal + signal mirrors + useComputed selection signals + memoized hook input)
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx (memo-wrapped PhysicsPaintRotoActionRow + currentFrameSignal prop, internal mirror removed)
    - app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts (updated harness + re-evaluation test + source-scan contract)
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts (updated source-scan assertions + new action-row contract test)
  key_links:
    - effectiveInput in the hook overrides getCurrentAppFrame to read currentFrameSignal.value — the single point where the frame becomes signal-tracked.
    - The Studio-owned currentFrameSignal is written via guarded echo in the three startFrame callers (scheduleRotoStartFramePropagation, setCurrentAppFrame, setLaunchContextStartFrame) — never inside the setLaunchContextState updater.
    - The memoized hook input (stable deps) is what makes rotoPhysicalActions identity-stable, which is what lets the memo-wrapped action-row skip re-renders during scrub.
---

<objective>
Perf quick on the v1.0.0/reveal-rail branch: stop the per-frame WorkflowStrip action-row re-renders during scrub (G-52-9). Scrub is rAF-capped by design (38.1) — each animation frame re-renders the Studio root once, and every heavy subtree is behind a 38-11 identity memo EXCEPT the workflow strip, whose action-row buttons visibly refresh every frame. Root cause: useRotoTimelineActions (PhysicsPaintStudio.tsx:1446) re-runs per Studio render, its ~26 availability classifiers are plain computed() (new instances per render, each re-running its classifier on first read), its frame getter closes over the render-scoped number, and the strip is exported unmemoized with its props literal rebuilt inline per render.

The fix narrows the RENDER SCOPE of the action-row while keeping availability LIVE (HARD CONSTRAINT — do NOT freeze or gate the buttons during scrub; +Key joins a rail strictly inside a segment span, Delete scope label follows the target kind, Scissor splits mid-interpolation). Three moves: (1) stabilize the availability computeds' identity with useComputed from @preact/signals and signal-back every classifier input port so the computeds stay live; (2) extract the action-row into a memo-wrapped component fed by ReadonlySignal props with narrow per-button subscribers; (3) stabilize the frame-dependent handler props via input memoization + the deferred-ref pattern.

Purpose: eliminate the visible per-frame action-row refresh during scrub without any availability regression, no visual/DOM/class/tooltip/disabled-logic change, rails grid and RotoTimelineCellButton untouched, no full-strip memo wall unless the extraction proves insufficient (report, don't expand).

Output: useComputed-stabilized availability computeds, a signal-tracked classifier input surface, a memo-wrapped PhysicsPaintRotoActionRow with narrow per-button subscribers, stable action-row handler props, updated test harnesses, and a green full suite.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md

# Reactivity rules (mandatory before touching any reactivity code)
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/skills/efx-preact-reactivity/SKILL.md
  - Rule 3 (idempotent store setters), Rule 5 (version-signal reads subscribe whole component — keep narrow), Rule 6 (no signal writes during render except the sanctioned guarded echo `if (sig.peek() !== next) sig.value = next`).

# Code anchors (read before editing)
@app/src/components/physic-paint/hooks/useRotoTimelineActions.ts
  - L2 import `{ computed, signal, type ReadonlySignal } from '@preact/signals'` (add useComputed)
  - L1783 `export function useRotoTimelineActions(input: RotoTimelineActionsInput)` (add currentFrameSignal arg)
  - L1818-1854 the ~26 plain `computed()` availability computeds (convert to useComputed)
  - L1855 `pendingOperationIdSignal = input.pendingOperationId ?? signal<string | null>(null)`
  - L3318-3366 bundle useMemo (deps end `input.publishStatus, input.setApplyStatus`)
@app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - L2 imports `useComputed, useSignal` from '@preact/signals' (already present)
  - L351-380 useSignal cluster (add currentFrameSignal here)
  - L381-383 launchContext useState + launchContextRef (ref updated each render at L383)
  - L492-509 setLaunchContext startFrame-change branch (do NOT write the signal here — render-phase risk)
  - L539-543 scheduleRotoStartFramePropagation (rAF scrub path — write the signal here)
  - L620/625/626 rotoKeyRecords / rotoInterpolationState / rotoLoopClips useMemos (throttled)
  - L635-641/650-652/883-889 keyRailSegments / orderedRotoLoopClipIds / orderedRailSetIdentities useMemos
  - L642-649/653-663/895-901/906-913 effectiveSelectedRotoKeyRail / effectiveRotoLoopClipSelection / effectiveRailSetSelection / effectiveRailSetMembers (plain derived)
  - L676 `const currentFrame = launchContext?.startFrame ?? 0;`
  - L1293-1297 setCurrentAppFrame / L1356 setLaunchContextStartFrame (write the signal here too)
  - L1470-1532 useRotoTimelineActions input literal (getRotoKeyRecords L1483, getRotoInterpolationState L1484, getSelectedKeyRail L1490, getSelectedLoopClipIds L1491, getRailSetMembers L1492, getSelectedLoopRailDisplayName L1493-1501, getRotoSpacingSelection L1499-1507, getCurrentAppFrame L1508, getLaunchContext L1509, pendingOperationId L1523, publishStatus/setApplyStatus L1528-1529)
  - L1658-1660 rotoKeyUtilities = rotoNavigation.keyUtilities; addRotoKey = rotoKeyUtilities.addKey
  - L1682-1723 duplicateRotoKey / copyRotoFrame / cutRotoFrame / pasteRotoFrame useCallbacks (deps include rotoKeyUtilities — UNSTABLE)
  - L3443-3463 effectiveRotoKeyState plain object (rotoSession.actionAvailability.value + rail-set overlay)
  - L3915-3984 workflow props literal (onCreatePlayScriptRail L3930-3934, onCreateRevealRail L3935-3937)
@app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
  - L4 `memo` from 'preact/compat' (already imported), L6 `useSignal, ReadonlySignal, Signal` from '@preact/signals'
  - L255-290 handler props (onAddRotoKey, onDuplicateRotoKey, onInsertRotoFrame, onDeleteRotoFrame, onSelectAllRotoKeys, onCopyRotoFrame, onCutRotoFrame, onScissorKeyRail, onPasteRotoFrame)
  - L356 rotoKeyState prop / L1827 sessionKeyAvailability = props.rotoKeyState?.actionAvailability
  - L1412 unmemoized export / L1446-1447 internal currentFrameSignal mirror (REMOVE)
  - L1829-1920 availability `.value` reads (move into extracted component)
  - L1857 keyUtilitiesDisabledByBusyState (includes rotoDragPreview?.pending — pass as dragPending scalar)
  - L1927 pushToolDisabled / L1994 soloToolDisabled (STAY in strip — shared with drag/pill)
  - L3108-3118 getRotoKeyUtilityDisabledMessage (move into extracted component)
  - L4103 RotoPlaybackCurrentFrameOutput / L4293 PhysicsPaintPlayheadBar (already accept `currentFrame: Signal<number>` — pass the new prop through)
  - L4301-4670 the `physics-paint-roto-action-row` div (extract into PhysicsPaintRotoActionRow, SAME file)
  - L4312-4316 key identity div reads props.currentFrame (read currentFrameSignal.value in a narrow subscriber)
@app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts
  - L4-7 `vi.mock('preact/hooks', () => ({ useCallback, useMemo }))` (useComputed internally calls useRef — must mock @preact/signals)
  - L178 `const actions = useRotoTimelineActions(input);` (must pass signal(...) second arg)
@app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts
  - L39-45 getActionRowBlock helper (anchored at `class="physics-paint-roto-action-row"`)
  - L173 / L464 / L534 source-scan assertions pinning availability reads (MUST be retargeted to the extracted component)
  - L1754-1755 / L1816-1817 / L1873 rail-drag assertions (STAY in strip — unchanged)
@app/src/components/physic-paint/view/BackgroundAssetPickerView.test.ts
  - L24-31 the `vi.mock('@preact/signals', ...)` pattern mapping useComputed → computed (copy for the hook harness)
@app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx
  - L74-99 PhysicsPaintHistoryActionButton narrow-subscriber pattern (copy for per-button subscribers)
  - L263 memo pattern
@app/src/components/physic-paint/hooks/useRotoKeyUtilities.ts
  - L308-328 addKey useCallback with `[blocked, input, session]` deps — UNSTABLE (input is a fresh object each render)
@app/src/components/physic-paint/roto/physicsPaintRotoSession.ts
  - L96/L126 `actionAvailability: Signal<RotoKeyUtilityActionState>` — IS a signal (pass the raw signal to the action-row)
</context>

<tasks>

<task type="tracer">
  <name>Task 1: Stabilize availability computeds (useComputed) + signal-back every classifier input port + memoize the hook input</name>
  <files>app/src/components/physic-paint/hooks/useRotoTimelineActions.ts, app/src/components/physic-paint/PhysicsPaintStudio.tsx, app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts</files>
  <action>
    In useRotoTimelineActions.ts:
    1. L2: add `useComputed` to the `@preact/signals` import.
    2. L1783: change the signature to `export function useRotoTimelineActions(input: RotoTimelineActionsInput, currentFrameSignal: ReadonlySignal<number>) {`.
    3. Immediately after the signature, add `const effectiveInput = useMemo(() => ({ ...input, getCurrentAppFrame: () => currentFrameSignal.value }), [input, currentFrameSignal]);`.
    4. Replace every `input` reference in the hook body with `effectiveInput` — including the `[input]` dep arrays (→ `[effectiveInput]`) and the bundle useMemo deps at L3318-3366 (ending `input.publishStatus, input.setApplyStatus`). `pendingOperationIdSignal = input.pendingOperationId ?? signal<string | null>(null)` (L1855) becomes `effectiveInput.pendingOperationId`.
    5. L1818-1854: convert the ~26 plain `computed(() => ...)` availability computeds to `useComputed(() => ...)` — classifier logic byte-identical (insertTarget, canInsertFrame, insertDisabledReason, insertTooltipDescription, deleteTarget, canDeleteFrame, deleteDisabledReason, deleteScopeLabel, scissorTarget, canScissor, scissorDisabledReason, scissorTooltipDescription, canDragKey, dragDisabledReason, canApplyForceSpacing, forceSpacingDisabledReason, canAddEmptyKey, addEmptyKeyDisabledReason, canSelectAllKeys, selectAllKeysDisabledReason, canCopyRailSet, copyRailSetDisabledReason, canPasteRailSet, pasteRailSetDisabledReason, canDuplicateRailSet, duplicateRailSetDisabledReason).

    In PhysicsPaintStudio.tsx:
    6. Create `const currentFrameSignal = useSignal(launchContext?.startFrame ?? 0);` in the useSignal cluster (L351-380). Write it via guarded echo in the three startFrame callers — `scheduleRotoStartFramePropagation` (L539-543, the rAF scrub path), `setCurrentAppFrame` (L1293-1297), `setLaunchContextStartFrame` (L1356): `if (currentFrameSignal.peek() !== next) currentFrameSignal.value = next;`. Do NOT write inside the setLaunchContextState updater (L492-509) — a signal write inside a state updater is a render-phase write risk (Rule 6).
    7. Add guarded-echo signal mirrors after the throttled useMemos (reference comparison — correct for useMemo outputs): `rotoKeyRecordsSignal` (L620), `rotoInterpolationStateSignal` (L625), `rotoLoopClipsSignal` (L626), `keyRailSegmentsSignal` (L635-641), `orderedRotoLoopClipIdsSignal` (L650-652), `orderedRailSetIdentitiesSignal` (L883-889). Form: `if (rotoKeyRecordsSignal.peek() !== rotoKeyRecords) rotoKeyRecordsSignal.value = rotoKeyRecords;`.
    8. Convert the plain derived selection values into useComputed signals that read the mirrors + selection signals, and keep render-scoped consts reading `.value`: `effectiveSelectedRotoKeyRailSignal` (reads rotoKeyRecordsSignal.value, keyRailSegmentsSignal.value, selectedKeyId.value), `effectiveSelectedLoopClipIdsSignal` (reads orderedRotoLoopClipIdsSignal.value, rotoLoopClipsSignal.value, selectedLoopClipIds.value), `effectiveRailSetMembersSignal` (reads effectiveRailSetSelection, rotoKeyRecordsSignal.value). Then `const effectiveSelectedRotoKeyRail = effectiveSelectedRotoKeyRailSignal.value;` etc. so existing Studio usages keep working.
    9. Update the useRotoTimelineActions call (L1470-1532): pass `currentFrameSignal` as the second argument; change the classifier ports to signal reads — `getRotoKeyRecords: () => rotoKeyRecordsSignal.value`, `getRotoInterpolationState: () => rotoInterpolationStateSignal.value`, `getSelectedKeyRail: () => effectiveSelectedRotoKeyRailSignal.value`, `getSelectedLoopClipIds: () => effectiveSelectedLoopClipIdsSignal.value`, `getRailSetMembers: () => effectiveRailSetMembersSignal.value`, `getSelectedLoopRailDisplayName` reads `rotoScriptLibrary.rows.value` + `rotoLoopClipsSignal.value` (not the render-scoped loopScriptRows/rotoLoopClips), `getRotoSpacingSelection` reads `rotoSpacingSelection.value` (not `.peek()`), and remove `getCurrentAppFrame: () => currentFrame` (effectiveInput supplies the signal-backed version).
    10. Memoize the input object: wrap the literal in `useMemo(() => ({ ... }), [stable deps])`. Ports that close over the render-scoped `launchContext` (getStoreRealKeyFrames, getCurrentSettings, setInterpolationSettings, getStoreRotoFrames, getFailureStatus, getRotoLoopClips, getCapacity, getParentEndExclusive, getIncomingInterpolationBreakKeyIds) must read `launchContextRef.current` at call time (deferred ref read, same as getLaunchContext at L1509). Deps: every referenced signal/ref/stable value (rotoTimelineModel, launchContextRef, physicPaintStore, studioActiveTrackId, latestRotoFramesRef, selectedKeyId, selectedKeyIds, the six mirrors, the three selection signals, rotoSpacingSelection, rotoScriptLibrary, physicalEditCoordinator, the five deferred refs, handleRequestSoleOccurrenceDeleteWarning, setApplyMessage, setApplyStatus) plus canvasWidth/canvasHeight (the input re-creates only on resize — acceptable).

    In useRotoTimelineActions.test.ts:
    11. Add the `@preact/signals` mock mapping `useComputed → computed` (copy the BackgroundAssetPickerView.test.ts:24-31 pattern verbatim).
    12. Update the `renderActions` helper (L178) to pass `signal(options.currentAppFrame ?? 3)` as the second argument; accept an optional `currentFrameSignal` parameter so the re-evaluation test can hold the signal reference.
    13. Add a hook-level test: with a fixed real key record at frame 5, assert a frame-dependent computed (e.g., canAddEmptyKey) re-evaluates when currentFrameSignal flips 5 → 6 (false → true).
    14. Add a source-scan contract test asserting the hook source contains `useComputed(` and `effectiveInput` (identity stability cannot be asserted at runtime — the harness mocks useMemo as `(factory) => factory()`, so the source-scan is the identity contract).
    Do NOT change any classifier logic, any runner behavior, the bundle shape, or the strip's consumption of the bundle. No new window-level listeners. No useState additions.
  </action>
  <verify>
    <automated>pnpm exec vitest run app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts</automated>
  </verify>
  <done>The hook takes currentFrameSignal, its availability computeds are useComputed-stabilized, every classifier input port is signal-tracked or deferred-ref, the Studio input object is memoized with stable deps, and the updated hook test file passes (harness + re-evaluation + source-scan).</done>
</task>

<task type="auto">
  <name>Task 2: Extract the action-row into a memo-wrapped narrow-subscriber component fed by ReadonlySignal props</name>
  <files>app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx, app/src/components/physic-paint/PhysicsPaintStudio.tsx, app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts</files>
  <action>
    In PhysicsPaintWorkflowStrip.tsx:
    1. Add `currentFrameSignal: ReadonlySignal<number>` to PhysicsPaintWorkflowStripProps; delete the internal mirror (L1446-1447). The leaves RotoPlaybackCurrentFrameOutput (L4103) and PhysicsPaintPlayheadBar (L4293) already accept `currentFrame: Signal<number>` — pass the new prop through unchanged.
    2. Extract the `physics-paint-roto-action-row` div (L4301-4670) into a new `PhysicsPaintRotoActionRow` component defined in the SAME file (so the getActionRowBlock source-scan helper keeps working), wrapped in `memo` (preact/compat, already imported at L4).
    3. Prop contract (all identity-stable during scrub): `rotoPhysicalActions` bundle (stable after Task 1), `sessionAvailability: ReadonlySignal<RotoKeyUtilityActionState>` (the raw rotoSession.actionAvailability signal — NOT the plain effectiveRotoKeyState object), `hasEffectiveRailSetScope: boolean`, `hasCopiedRotoKey: ReadonlySignal<boolean>`, `ready`/`mutationLocked`/`keyActionInFlight` scalars, `dragPending: boolean` (rotoDragPreview?.pending), `currentFrameSignal: ReadonlySignal<number>`, `visibleFrameResolutions` + `physicalCellByAppFrame` (stable maps), `rotoScript` + `rotoScriptActionMutationDisabledReason` signals, and the handler props (onAddRotoKey, onDuplicateRotoKey, onInsertRotoFrame, onDeleteRotoFrame, onSelectAllRotoKeys, onCopyRotoFrame, onCutRotoFrame, onScissorKeyRail, onPasteRotoFrame, onCreatePlayScriptRail, onCreateRevealRail).
    4. Move the availability derivations consumed ONLY by the action-row (L1829-1920) into the component's render body, re-derived from the signal props (the effective availability is `hasEffectiveRailSetScope ? { ...sessionAvailability.value, canCopy: rotoPhysicalActions.canCopyRailSet.value, canDuplicate: rotoPhysicalActions.canDuplicateRailSet.value, canPaste: rotoPhysicalActions.canPasteRailSet.value, pasteDisabledReason: rotoPhysicalActions.pasteRailSetDisabledReason.value ?? sessionAvailability.value.pasteDisabledReason } : sessionAvailability.value`). Derivations shared with drag/rail-grid logic (keyUtilitiesDisabledByBusyState, rotoDragLocked, pushToolDisabled, soloToolDisabled) STAY in the strip; pass the resulting scalars to the component. Move the guarded-icon reason helper (getRotoKeyUtilityDisabledMessage, L3108-3118) into the component, re-derived from the signal props.
    5. Narrow per-button subscribers (PhysicsPaintHistoryActionButton pattern, PhysicsPaintToolRail.tsx:74-99): each button reads the availability signals' `.value` in its own render body; onClick guards read the signals live (no frozen closures — Gap 8). The + Rail button's canCreateRail derivation reads `currentFrameSignal.value` in its narrow subscriber (not a number prop). The key identity div (L4312-4316) reads `currentFrameSignal.value` in a narrow subscriber.

    In PhysicsPaintStudio.tsx:
    6. Pass `currentFrameSignal` to the strip; pass `sessionAvailability={rotoSession.actionAvailability}` (raw signal) + `hasEffectiveRailSetScope` + `hasCopiedRotoKey={rotoSession.copiedKey}`. Keep passing `rotoKeyState` only if a non-action-row consumer still needs it (verify each usage; the action-row no longer receives the plain object).

    In PhysicsPaintWorkflowStrip.test.ts:
    7. Update the three source-scan assertions (L173, L464, L534) to target the extracted component's render body — add a helper anchored at the PhysicsPaintRotoActionRow definition (e.g., `getActionRowComponentBlock`). Keep the rail-drag assertions (L1754-1755, L1816-1817, L1873) unchanged (they stay in the strip).
    8. Add a source-scan contract test: assert `PhysicsPaintRotoActionRow` is memo-wrapped and its buttons read ReadonlySignal props (`.value` reads in narrow subscribers).
    Do NOT change any visual/DOM/class/tooltip/disabled-logic, the rails grid, RotoTimelineCellButton, the drag mechanics, or the playback pill. No new window-level listeners. No useState additions.
  </action>
  <verify>
    <automated>pnpm exec vitest run app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts</automated>
  </verify>
  <done>The action-row is a memo-wrapped component in the same file fed by ReadonlySignal props + stable scalars + stable handlers; the strip's internal currentFrame mirror is gone; the strip test file passes with updated assertions + the new contract test.</done>
</task>

<task type="auto">
  <name>Task 3: Stabilize the frame-dependent action-row handler props via deferred-ref + final wiring + full-suite verification</name>
  <files>app/src/components/physic-paint/PhysicsPaintStudio.tsx, app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx</files>
  <action>
    In PhysicsPaintStudio.tsx:
    1. The five frame-dependent handler props depend on `rotoKeyUtilities` (UNSTABLE — useRotoKeyUtilities' input is a fresh object each render; addKey/duplicateKey/copyKey/cutKey/pasteKey deps `[blocked, input, session]`). Apply the deferred-ref pattern (groupLifecycleDeleteExecuteRef precedent): `const actionRowHandlersRef = useRef({ onAddRotoKey: addRotoKey, onDuplicateRotoKey: duplicateRotoKey, onCopyRotoFrame: copyRotoFrame, onCutRotoFrame: cutRotoFrame, onPasteRotoFrame: pasteRotoFrame }); actionRowHandlersRef.current = { ... };` then five stable useCallbacks reading `actionRowHandlersRef.current.X(...args)` at call time.
    2. Convert the inline onCreatePlayScriptRail/onCreateRevealRail arrows (L3930-3937) to stable useCallbacks (they only write to the stable scriptPickerIntent signal): `useCallback((mode) => { scriptPickerIntent.value = { kind: 'paint', mode }; }, [])` and `useCallback(() => { scriptPickerIntent.value = { kind: 'reveal' }; }, [])`.
    3. The bundle-derived handlers (onInsertRotoFrame, onDeleteRotoFrame, onScissorKeyRail, onSelectAllRotoKeys) are stable after Task 1 (rotoPhysicalActions identity-stable) — verify, and route through the deferred-ref only if any still re-creates.
    4. Wire the workflow props literal (L3915-3984) to pass the stable handlers + currentFrameSignal + the raw signals to the strip.

    In PhysicsPaintWorkflowStrip.tsx:
    5. Forward the stable handler props to PhysicsPaintRotoActionRow.

    Then run the full suite and the type check.
    Do NOT change any runner behavior, the bundle shape, the drag mechanics, or the playback pill. No new window-level listeners. No useState additions.
  </action>
  <verify>
    <automated>pnpm exec vitest run && pnpm exec tsc --noEmit</automated>
  </verify>
  <done>onAddRotoKey/onDuplicateRotoKey/onCopyRotoFrame/onCutRotoFrame/onPasteRotoFrame are identity-stable via deferred-ref; onCreatePlayScriptRail/onCreateRevealRail are stable useCallbacks; every action-row handler prop is stable; the memo-wrapped action-row skips re-renders during scrub; the full vitest suite is green and tsc --noEmit is clean.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| action-row → availability computeds | The memoized action-row's enabled/disabled state derives from signal-tracked availability; a stale read would ship a wrong enabled state on release (HARD CONSTRAINT violation). |
| Studio render → signal writes | The frame signal must be written in event/effect context (the three startFrame callers), never during render. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-ibd-01 | Tampering | availability computeds | high | mitigate | Every classifier input port is signal-tracked (the six mirrors + three selection signals + currentFrameSignal) or deferred-ref (launchContextRef); useComputed re-evaluates on tracked deps, so availability stays live after scrub release. |
| T-ibd-02 | Tampering | memoized action-row onClick guards | high | mitigate | Narrow per-button subscribers read the availability signals' `.value` in their own render bodies; onClick guards read the live signal, never a frozen closure (Gap 8). |
| T-ibd-03 | Denial of Service | currentFrameSignal write | medium | mitigate | Guarded echo (`if (sig.peek() !== next) sig.value = next`) in the three startFrame callers (event/effect context); never inside the setLaunchContextState updater (Rule 6). |
| T-ibd-SC | Tampering | npm/pip/cargo installs | high | accept | No package installs in this plan — no package-legitimacy gate required. |
</threat_model>

<verification>
- `pnpm exec vitest run app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts` — Task 1 (hook stabilization + harness + re-evaluation + source-scan).
- `pnpm exec vitest run app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts` — Task 2 (action-row extraction + updated assertions + new contract test).
- `pnpm exec vitest run && pnpm exec tsc --noEmit` — Task 3 (handler stabilization + full suite + type check).
- Native UAT (user drives): scrub through dense reveal rails — the action-row buttons no longer visibly refresh every frame; after release, +Key/Delete/Scissor/Paste land exactly on the released frame with the correct enabled/disabled state and tooltip.
</verification>

<success_criteria>
- The action-row stops re-rendering per frame during scrub (memo-wrapped + identity-stable props).
- Availability stays LIVE: no stale enabled/disabled state on release; +Key joins a rail strictly inside a segment span, Delete scope label follows the target kind, Scissor splits mid-interpolation.
- No visual/DOM/class/tooltip/disabled-logic change; rails grid and RotoTimelineCellButton untouched; no full-strip memo wall.
- The whole app test suite stays green and tsc --noEmit is clean.
</success_criteria>

<output>
Create `.planning/quick/260905-ibd-perf-stop-per-frame-workflowstrip-action/260905-ibd-SUMMARY.md` when done
</output>
