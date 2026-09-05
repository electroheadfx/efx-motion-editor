---
phase: quick-260905-dso
plan: 260905-dso
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.test.tsx
autonomous: true
requirements: [ACC-01]
estimate:
  tokens: 30000
  raw_tokens: 30000
  tasks: 3
  confidence: med
must_haves:
  truths:
    - The Tools popover renders a third "Actions" section (same heading/divider pattern as Interpolation and Key Spacing) containing the two buffer actions as guarded icon buttons: Apply and Clear.
    - "Apply's tooltip reads exactly \"Apply Action to Frame\" (guarded idiom: \"unavailable: <reason>\" when unavailable); Clear keeps its existing copy \"Clear Action from buffer\". Both use the strip's guarded styled-tooltip idiom (region bottom, aria-disabled, sr-only reason span, Enter/Space guard)."
    - The popover opens whenever EITHER the Interpolation section OR the Actions section has content; the toolbox toggle's aria-label never claims an interpolation-only popover when the interpolation section is absent.
    - The ScriptsPanel toolbar no longer contains Apply/Clear; the remaining buttons (Save, Load + Apply, Create Rail…, Delete, Refresh, Copy) are unchanged.
    - Apply/Clear use the SAME Studio handlers and availability sources as before (rotoScript.availability + the library's actionMutationDisabledReason; same setLastError flows; the PlayScript one-source-cycle Apply refresh is unchanged).
    - The whole app test suite stays green (ACC-01).
  artifacts:
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx (Actions section + onApplyScript/onDiscardScript/rotoScriptActionMutationDisabledReason props + relaxed popover render guard + conditional toolbox aria-label)
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx (handleApplyScript/handleDiscardScript useCallbacks + workflow memo wiring + rightPanel scripts cleanup)
    - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx (Apply/Clear removed; unused props/imports/derivations removed)
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts (popover Actions section tests)
    - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts (updated for the removal)
    - app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.test.tsx (renderScriptsPanel no longer passes the removed props)
  key_links:
    - The strip reads props.rotoScript?.availability.value and props.rotoScriptActionMutationDisabledReason?.value in render (signal reads in render, memo stays cacheable) — the same reactive pattern as physicalActions?.canInsertFrame.value.
    - The Studio passes identity-stable handleApplyScript/handleDiscardScript useCallbacks plus rotoScriptLibrary.actionMutationDisabledReason to the workflow memo.
    - The popover render guard is props.onInterpolationEnabledChange || props.onApplyScript || props.onDiscardScript.
---

<objective>
Post-Phase-52 UI quick on the v1.0.0/reveal-rail branch: move the Actions tab "Apply" / "Clear" buffer buttons out of the ScriptsPanel toolbar and into the Tools popover under a new third "Actions" section, wired from the Studio through identity-stable ports.

Purpose: The buffer Apply/Clear actions currently live in the Scripts panel's Actions tab toolbar, away from the timeline tools the user reaches for while working on frames. This quick relocates them into the Tools popover (the same liquid-glass popover that hosts Interpolation and Key Spacing) as a third "Actions" section, using the strip's established guarded styled-tooltip idiom (region bottom, aria-disabled, sr-only reason, Enter/Space guard). The handlers, availability sources, setLastError flows, and the PlayScript one-source-cycle Apply-refresh contract are all unchanged — only the surface moves.

Output: A third "Actions" section in the Tools popover with guarded Apply ("Apply Action to Frame") and Clear ("Clear Action from buffer") icon buttons; the ScriptsPanel toolbar reduced to Save, Load + Apply, Create Rail…, Delete, Refresh, Copy; the popover render guard relaxed so it opens when either Interpolation or Actions has content; the toolbox toggle aria-label made interpolation-agnostic when the interpolation section is absent; updated + new tests; a green full suite.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md

# Code anchors (read before editing)
@app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
  - lucide import L1 (add ClipboardPen, ClipboardX); @preact/signals import L6 (add type ReadonlySignal)
  - PhysicsPaintWorkflowRotoScriptState L181-190 (already picks 'availability' from RotoScriptClipboardController)
  - PhysicsPaintWorkflowStripProps L208-450 (rotoScript prop L357)
  - buildGuardedActionTooltipCopy L593-595
  - PhysicsPaintWorkflowStaticChromeProps L755-808
  - PhysicsPaintToolboxPopover L901-938 (portal + placement — DO NOT touch)
  - static chrome tooltip hooks L997-1006 (add applyScriptTooltip + clearScriptBufferTooltip)
  - toolbox toggle aria-label L1149 (interpolation-only copy — make conditional)
  - popover render guard L1167 (props.onInterpolationEnabledChange ? — relax)
  - popover sections L1169-1224 (Interpolation L1169-1176, divider L1177, Key Spacing L1178-1224; add Actions after L1224)
  - physicalActions signal-read pattern L1741-1752 (the reactive idiom to mirror)
  - scriptStatus read L1760 (props.rotoScript?.status.value — the existing rotoScript signal read)
  - static chrome props pass L4006-4046 (add the new ports)
@app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - rotoScript callbacks L1046-1074 (add handleApplyScript/handleDiscardScript useCallbacks after L1074)
  - rightPanel scripts props L3099-3123 (onDiscardScript L3119, onApplyScript L3121 — remove in Task 2)
  - workflow memo L3892-4038 (rotoScript L4001 — add the new ports beside it)
@app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx
  - lucide import L1 (ClipboardPen, ClipboardX — remove in Task 2; keep Clipboard)
  - props interface L10-32 (onDiscardScript L29, onApplyScript L30 — remove in Task 2)
  - destructuring L34-50 (remove onDiscardScript/onApplyScript in Task 2)
  - reason ids L72-77, tooltip hooks L78-80, availability derivations L81-86 (remove the Apply/Clear ones in Task 2; keep Copy)
  - toolbar L190-280 (Copy span L196-223 stays; Apply span L224-251 and Clear span L252-279 removed in Task 2)
@app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts
  - source()/css()/studioSource() helpers L17-27; getWorkflowStripPropsInterface L33; getStaticChromePropsInterface L36; getHeaderBlock L659; getCssRuleBlock L666
  - existing popover/section tests L1036-1059, L1121-1137, L1139-1160 (must stay green — the Actions section is additive)
@app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts
  - getGuardedToolbarBlock L54; getScriptsPanelPropsInterface L65; getScriptsToolbarBlock L69
  - Clear Action Buffer contract L186-225; Copy/Apply/Clear toolbar contract L227-296; second-row label contract L298-323; Gap F L325-360; Gap G L362-391; deletion lifecycle aria-disabled list L655-657
@app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.test.tsx
  - renderScriptsPanel L227-250 (passes onDiscardScript L244 + onApplyScript L246 — remove in Task 2)
</context>

<tasks>

<task type="tracer">
  <name>Task 1: Add the "Actions" section to the Tools popover and wire the Studio ports (Apply + Clear guarded buttons, relaxed render guard, conditional toolbox aria-label)</name>
  <files>app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx, app/src/components/physic-paint/PhysicsPaintStudio.tsx</files>
  <action>
    In PhysicsPaintWorkflowStrip.tsx:
    1. Add `ClipboardPen, ClipboardX` to the lucide-preact import (L1) and `type ReadonlySignal` to the `@preact/signals` import (L6).
    2. Add three optional ports to `PhysicsPaintWorkflowStripProps` immediately after the `rotoScript?: PhysicsPaintWorkflowRotoScriptState;` line (L357): `onApplyScript?: () => void;`, `onDiscardScript?: () => void;`, and `rotoScriptActionMutationDisabledReason?: ReadonlySignal<string | null>;` (the library's transaction-phase mutation lock, passed as a signal reference so the workflow memo stays cacheable).
    3. In the main strip body, immediately after the `scriptStatus` read (L1760), derive the buffer availability reactively — mirror the ScriptsPanel derivation (L81-86) exactly, reading the signals in render the same way the strip already reads `physicalActions?.canInsertFrame.value` (L1742):
       - `const scriptActionMutationDisabledReason = props.rotoScriptActionMutationDisabledReason?.value ?? null;`
       - `const scriptAvailability = props.rotoScript?.availability.value;`
       - `const canApplyScriptAction = scriptActionMutationDisabledReason === null && (scriptAvailability?.canApply ?? false);`
       - `const applyScriptActionDisabledReason = scriptActionMutationDisabledReason ?? (canApplyScriptAction ? null : (scriptAvailability?.applyDisabledReason ?? null));`
       - `const canClearScriptBuffer = scriptActionMutationDisabledReason === null && (scriptAvailability?.canDiscard ?? false);`
       - `const clearScriptBufferDisabledReason = scriptActionMutationDisabledReason ?? (canClearScriptBuffer ? null : (scriptAvailability?.discardDisabledReason ?? null));`
    4. Add the same six ports to `PhysicsPaintWorkflowStaticChromeProps` (L755-808): the two optional handlers plus the four derived plain values (`canApplyScriptAction: boolean;`, `applyScriptActionDisabledReason: string | null;`, `canClearScriptBuffer: boolean;`, `clearScriptBufferDisabledReason: string | null;`).
    5. In the static chrome impl, add `const applyScriptTooltip = useStyledTooltip();` and `const clearScriptBufferTooltip = useStyledTooltip();` beside the existing tooltip hooks (L997-1006).
    6. Make the toolbox toggle aria-label (L1149) conditional so it never claims an interpolation-only popover when the interpolation section is absent: when `props.onInterpolationEnabledChange` is present keep the existing interpolation-aware copy ('Timeline tools, interpolation on' / 'Timeline tools, interpolation off'); when absent use the generic 'Timeline tools'.
    7. Relax the popover render guard (L1167) from `props.onInterpolationEnabledChange ? (` to `(props.onInterpolationEnabledChange || props.onApplyScript || props.onDiscardScript) ? (`.
    8. Add the third section after the Key Spacing section (after L1224, before the popover close at L1225): a `physics-paint-toolbox-divider` div, then a `physics-paint-toolbox-section` div with the heading `<div class="physics-paint-toolbox-section-heading">Actions</div>`, then the two guarded icon buttons as `physics-paint-roto-key-icon-action` anchor spans (mirror the Key Spacing guarded idiom at L1184-1222 and the ScriptsPanel Copy button at L196-223):
       - Apply: `aria-label="Apply Action to Frame"`, `aria-disabled={!props.canApplyScriptAction ? 'true' : undefined}`, `aria-describedby={!props.canApplyScriptAction && props.applyScriptActionDisabledReason ? 'roto-key-action-reason-apply' : undefined}`, onFocus/onBlur from `applyScriptTooltip`, onClick that calls `applyScriptTooltip.hide()` then `if (!props.canApplyScriptAction) return;` then `props.onApplyScript?.()`, onKeyDown `if ((event.key === 'Enter' || event.key === ' ') && !props.canApplyScriptAction) event.preventDefault();`, icon `<ClipboardPen size={15} aria-hidden="true" />`, short label `<span class="physics-paint-roto-key-icon-label">Apply</span>`, sr-only reason span `id="roto-key-action-reason-apply"` rendered only when `!props.canApplyScriptAction && props.applyScriptActionDisabledReason`, and `<PhysicsPaintStyledTooltip visible={applyScriptTooltip.visible} region="bottom">{buildGuardedActionTooltipCopy('Apply Action to Frame', props.applyScriptActionDisabledReason)}</PhysicsPaintStyledTooltip>`.
       - Clear: `aria-label="Clear Action Buffer"`, `aria-disabled={!props.canClearScriptBuffer ? 'true' : undefined}`, `aria-describedby={!props.canClearScriptBuffer && props.clearScriptBufferDisabledReason ? 'roto-key-action-reason-clear' : undefined}`, onFocus/onBlur from `clearScriptBufferTooltip`, onClick that calls `clearScriptBufferTooltip.hide()` then `if (!props.canClearScriptBuffer) return;` then `props.onDiscardScript?.()`, onKeyDown `if ((event.key === 'Enter' || event.key === ' ') && !props.canClearScriptBuffer) event.preventDefault();`, icon `<ClipboardX size={15} aria-hidden="true" />`, short label `<span class="physics-paint-roto-key-icon-label">Clear</span>`, sr-only reason span `id="roto-key-action-reason-clear"` rendered only when `!props.canClearScriptBuffer && props.clearScriptBufferDisabledReason`, and `<PhysicsPaintStyledTooltip visible={clearScriptBufferTooltip.visible} region="bottom">{buildGuardedActionTooltipCopy('Clear Action from buffer', props.clearScriptBufferDisabledReason)}</PhysicsPaintStyledTooltip>`.
    9. Pass the six ports to the static chrome (L4006-4046): `onApplyScript={props.onApplyScript}`, `onDiscardScript={props.onDiscardScript}`, `canApplyScriptAction={canApplyScriptAction}`, `applyScriptActionDisabledReason={applyScriptActionDisabledReason}`, `canClearScriptBuffer={canClearScriptBuffer}`, `clearScriptBufferDisabledReason={clearScriptBufferDisabledReason}`.
    In PhysicsPaintStudio.tsx:
    10. Add two identity-stable useCallbacks immediately after `handleSelectedScriptLoadAndApply` (L1074), moving the exact bodies currently inlined in the rightPanel scripts props (L3119-3121) verbatim: `handleApplyScript` (deps `[rotoScript, setLastError]`) and `handleDiscardScript` (deps `[rotoScript, setLastError]`).
    11. In the workflow memo (L3892-4038), beside the existing `rotoScript,` line (L4001), add `onApplyScript: handleApplyScript,`, `onDiscardScript: handleDiscardScript,`, and `rotoScriptActionMutationDisabledReason: rotoScriptLibrary.actionMutationDisabledReason,`.
    Do NOT change what Apply/Clear DO (same handlers, same setLastError flows, same availability sources), do NOT touch the popover dismissal/placement/portal (L901-938), do NOT touch the remaining toolbar buttons' tooltips, and do NOT add useState. The ScriptsPanel still renders Apply/Clear until Task 2 — that duplication is the intended intermediate state.
  </action>
  <verify>
    <automated>pnpm exec vitest run app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts</automated>
  </verify>
  <done>The Tools popover source contains the third "Actions" section with guarded Apply and Clear buttons (region bottom tooltips, aria-disabled, sr-only reasons, Enter/Space guards, guarded onClick before the handler); the popover render guard is relaxed to open when either Interpolation or Actions has content; the toolbox toggle aria-label is conditional; the Studio defines handleApplyScript/handleDiscardScript and passes them plus the library mutation-lock signal to the workflow memo; the existing strip test file passes unchanged.</done>
</task>

<task type="auto">
  <name>Task 2: Remove Apply/Clear from the ScriptsPanel toolbar, clean up the unused props/imports/derivations, and update the ScriptsPanel + LoopClipRail tests</name>
  <files>app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx, app/src/components/physic-paint/PhysicsPaintStudio.tsx, app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts, app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.test.tsx</files>
  <action>
    In PhysicsPaintScriptsPanel.tsx:
    1. Remove the Apply span (L224-251) and the Clear span (L252-279) from the toolbar — the Copy span (L196-223) stays byte-identical.
    2. Remove `onDiscardScript` (L29) and `onApplyScript` (L30) from `PhysicsPaintScriptsPanelProps`, and remove them from the destructuring (L48-49).
    3. Remove the now-unused `applyScriptReasonId`/`clearScriptBufferReasonId` (L76-77), `applyScriptTooltip`/`clearScriptBufferTooltip` (L79-80), and the Apply/Clear availability derivations (L82-86: canApplyRotoScript, applyRotoScriptDisabledReason, canClearScriptBuffer, clearScriptBufferDisabledReason). Keep the Copy derivations (L81, L83) and the Copy tooltip/reason id.
    4. Remove `ClipboardPen, ClipboardX` from the lucide import (L1) — keep `Clipboard`.
    In PhysicsPaintStudio.tsx:
    5. Remove the `onDiscardScript` (L3119) and `onApplyScript` (L3121) lines from the rightPanel scripts props — the handlers now live as the stable useCallbacks wired into the workflow memo (Task 1).
    In PhysicsPaintScriptsPanel.test.ts (update the tests that reference the moved buttons; the remaining-button tests stay):
    6. Replace the "Clear Action Buffer contract" describe block (L186-225) with a relocation contract: assert the panel source no longer contains the ClipboardX icon, the Clear-Action-Buffer aria-label, the Clear-Action-from-buffer tooltip copy, or the onDiscardScript prop; assert the Studio no longer contains the old inline discard handler and now defines the stable handleDiscardScript useCallback and passes it to the workflow memo.
    7. Update the "Copy/Apply/Clear toolbar contract" describe block (L227-296) to the Copy-only reality: the toolbar renders only the guarded Copy Action control (aria-disabled, aria-describedby, sr-only reason, Enter/Space guard, guarded onClick before onCopyScript); the panel no longer declares onApplyScript/onDiscardScript; the Studio wires handleApplyScript/handleDiscardScript to the workflow memo; the guarded second-row count drops from three to one.
    8. Update the "second-row label contract" (L298-323), the "Gap F second-row contract" (L325-360), and the "Gap G toolbar contract" (L362-391) to assert only the Copy label/icon remains in the second row (the CSS rules stay — the toolbar still has six columns and the Copy button still uses the guarded second-row styling).
    9. Update the deletion-lifecycle aria-disabled list (L655-657) to keep only the Copy Action label among the panel controls.
    In PhysicsPaintLoopClipRail.test.tsx:
    10. Remove `onDiscardScript: () => {}` (L244) and `onApplyScript: () => {}` (L246) from `renderScriptsPanel` (L227-250) so the call matches the reduced props interface.
    Do NOT change the remaining toolbar buttons' behavior or tooltips, do NOT touch the CSS, and do NOT add useState.
  </action>
  <verify>
    <automated>pnpm exec vitest run app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.test.tsx.test.ts app/src/components/physic-paint/PhysicsPaintStudio.test.ts</automated>
  </verify>
  <done>The ScriptsPanel toolbar renders only Save, Load + Apply, Create Rail…, Delete, Refresh, Copy; the Apply/Clear spans, the onApplyScript/onDiscardScript props, the ClipboardPen/ClipboardX imports, and the Apply/Clear availability derivations are gone from the panel; the Studio rightPanel scripts props no longer carry the inline handlers; the updated ScriptsPanel, LoopClipRail, and Studio test files pass.</done>
</task>

<task type="auto">
  <name>Task 3: Add the popover Actions section tests and run the full suite + type check</name>
  <files>app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts</files>
  <action>
    In PhysicsPaintWorkflowStrip.test.ts, add a new describe block "PhysicsPaintWorkflowStrip toolbox Actions section (260905-dso)" using the existing source-contract helpers (source(), studioSource(), getWorkflowStripPropsInterface, getStaticChromePropsInterface, getHeaderBlock):
    1. "renders the Actions section with guarded Apply and Clear buffer buttons in the toolbox popover": slice the header block; assert the Actions heading `<div class="physics-paint-toolbox-section-heading">Actions</div>` is present and that the Apply aria-label and the Clear aria-label appear after it in that order; slice the Apply button block and assert it carries aria-disabled (not the disabled attribute), aria-describedby, no title, the Enter/Space guard, and that the header contains the guarded tooltip copy for both buttons plus `region="bottom"`.
    2. "guards activation before the handler and reads availability reactively from the controller ports": assert the source contains the rotoScript.availability reads (canApply, canDiscard) and the rotoScriptActionMutationDisabledReason read; assert the Apply onClick guard `if (!props.canApplyScriptAction) return;` appears before `props.onApplyScript?.()` and the Clear guard before `props.onDiscardScript?.()`.
    3. "opens the popover when the Actions section is present without interpolation and never claims an interpolation-only popover": assert the source contains the relaxed render guard `props.onInterpolationEnabledChange || props.onApplyScript || props.onDiscardScript`; slice the toolbox toggle aria-label expression and assert it contains both interpolation-aware labels and the generic 'Timeline tools' fallback.
    4. "declares the Actions ports on the strip and static chrome props and wires them from the Studio workflow memo": assert getWorkflowStripPropsInterface contains the three new optional ports (including the ReadonlySignal type), getStaticChromePropsInterface contains the two handlers plus the four derived plain values, and studioSource() contains the workflow-memo wiring (onApplyScript: handleApplyScript, onDiscardScript: handleDiscardScript, rotoScriptActionMutationDisabledReason: rotoScriptLibrary.actionMutationDisabledReason).
    Then run the full suite and the type check.
  </action>
  <verify>
    <automated>pnpm exec vitest run && pnpm exec tsc --noEmit</automated>
  </verify>
  <done>The four new popover Actions section tests pass; the full vitest suite is green; tsc --noEmit is clean.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Tools popover → buffer Apply/Clear | The relocated Apply/Clear buttons are guarded icon actions; a disabled button never reaches the Studio handler (aria-disabled + guarded onClick + Enter/Space preventDefault), so the onApplyScript/onDiscardScript ports are only reachable from an eligible buffer state. |
| ScriptsPanel toolbar → remaining actions | The removal touches only the Apply/Clear spans; Save, Load + Apply, Create Rail…, Delete, Refresh, Copy keep their exact behavior and tooltips. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-dso-01 | Tampering | Relocated Apply/Clear gating | low | mitigate | The guarded idiom is preserved verbatim from the ScriptsPanel: aria-disabled (not disabled), `if (!canApplyScriptAction) return;` / `if (!canClearScriptBuffer) return;` before the handler, Enter/Space preventDefault, and the same availability derivation (rotoScript.availability + library actionMutationDisabledReason). |
| T-dso-02 | Spoofing | Tooltip copy | low | mitigate | buildGuardedActionTooltipCopy produces "unavailable: {verbatim controller reason}" from the same controller ports the ScriptsPanel read; the view never re-derives or shortens the reason. |
| T-dso-03 | Denial of Service | Popover render guard relaxation | low | accept | The guard widens to `onInterpolationEnabledChange || onApplyScript || onDiscardScript`; the popover still renders only when a section has content, and dismissal/placement/portal are untouched. |
| T-dso-SC | Tampering | npm/pip/cargo installs | high | accept | No package installs in this plan — no package-legitimacy gate required. |
</threat_model>

<verification>
- `pnpm exec vitest run app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts` — Task 1 (Actions section + Studio wiring; existing strip tests stay green).
- `pnpm exec vitest run app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.test.tsx.test.ts app/src/components/physic-paint/PhysicsPaintStudio.test.ts` — Task 2 (removal + updated tests).
- `pnpm exec vitest run && pnpm exec tsc --noEmit` — Task 3 (new popover tests + full suite + type check).
- Native UAT (user drives): the Tools popover shows an "Actions" section with Apply and Clear icons; hovering Apply reads "Apply Action to Frame" and with an empty buffer both are greyed with the reason in the tooltip; Copy an Action, move to another frame, Apply from the popover → paint applies and the canvas refreshes immediately; Clear empties the buffer (both then greyed); the Actions tab toolbar shows only Save, Load + Apply, Create Rail…, Delete, Refresh, Copy; Interpolation and Key Spacing render and behave exactly as before; the popover closes on outside click and Escape.
</verification>

<success_criteria>
- The Tools popover renders a third "Actions" section with guarded Apply and Clear icon buttons using the strip's guarded styled-tooltip idiom (region bottom, aria-disabled, sr-only reason, Enter/Space guard).
- Apply's tooltip reads exactly "Apply Action to Frame" (or "unavailable: <reason>"); Clear keeps "Clear Action from buffer" (or "unavailable: <reason>").
- The popover opens when either the Interpolation section or the Actions section has content; the toolbox toggle aria-label never claims an interpolation-only popover when interpolation is absent.
- The ScriptsPanel toolbar no longer contains Apply/Clear; the remaining buttons are unchanged.
- Apply/Clear use the same Studio handlers and availability sources as before; the PlayScript one-source-cycle Apply refresh is unchanged.
- The whole app test suite stays green and tsc --noEmit is clean (ACC-01).
</success_criteria>

<output>
Create `.planning/quick/260905-dso-move-the-actions-tab-apply-clear-buffer-/260905-dso-SUMMARY.md` when done
</output>
