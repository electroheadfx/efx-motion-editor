---
phase: quick/261124-gfy
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/physic-paint/hooks/useRotoKeyUtilities.ts
  - app/src/components/physic-paint/hooks/useRotoKeyUtilities.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts
  - app/src/components/physic-paint/physicsPaintStudio.css
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboardActions.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboardActions.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
autonomous: true
requirements: []
estimate:
  # Three focused slices: (1) the hook's raster bypass for Duplicate, (2) the
  # key-actions row surface (group + toggle + mode-aware availability/labels +
  # the stable identity block), (3) the Studio dispatch (session mode signal,
  # four mode-aware wrappers, the script-Cut module with clipboard restore).
  # estimate-calibration: factor 1, sample_count 0, confidence low (no
  # calibration sample for quicks).
  tokens: 80000
  raw_tokens: 80000
  tasks: 3
  confidence: low
must_haves:
  truths:
    - "The Roto key-actions row shows Duplicate, Copy, Paste and Cut inside ONE tonal sub-section, with a two-state Raster|Script segmented toggle at the END of that sub-section (immediately after Cut, before Scissor). Raster is the default on every Studio open; Add / Rail / Insert / Delete and Scissor / All stay outside the group. The shipped buttons, icons and tooltips survive; the toggle is a segmented control (aria-pressed on both options), never a dropdown and never a replacement for a button."
    - "Raster mode is today: Duplicate = plain settle-then-clone (it never consults the script-aware port), Copy/Paste = the session raster clipboard, Cut = today's raster copy + delete. Both the strip buttons and Cmd+C / Cmd+X / Cmd+V reach these actions through the SAME four Studio routing wrappers, so the toggle governs the keyboard identically."
    - "Script mode delegates to the shipped seams: Duplicate = the 261023-cxc script-aware duplicate verbatim (its raster fallback included), Copy = handleCopyScript, Paste = handleApplyScript (0l5 record-first/bake-second), Cut = copyScript then delete the current key, restoring the previous script clipboard on a failed delete. No silent raster fallback exists in script-mode Copy/Paste/Cut. Script-mode Copy/Cut refuse a 2+ key selection with an explicit single-key message; rail-set scopes keep today's routing in both modes."
    - "Availability and refusal copy follow the active mode: raster keeps sessionKeyAvailability exactly as today; script reads rotoScript.availability (canCopy / canApply) plus hasCopiedScript for Paste and reuses the shipped Copy Script / Apply Script messages verbatim. Every tooltip and aria-label names the active kind ('Copy key' vs 'Copy script')."
    - "The Layer name + 'Key N' identity block has a constant footprint: a min-width sized for a three-digit key plus an ellipsized layer label, so stepping keys (1 -> 2 -> 3 digits) or switching layers never displaces the new grouped sub-section or any neighbor. Existing tonal styling and colors are unchanged."
    - "The script seams stay single: one copyAquarelleScriptToFrame( call, three recordAquarelleEventsOnFrame( occurrences, one applyScript('wet', { paste: true }) site, two 'wet' literals. The Scripts panel/Copy Script/Apply Script, Load + Apply, Run Script, PlayScript, +Key and every rail-set operation are untouched."
  artifacts:
    - app/src/components/physic-paint/hooks/useRotoKeyUtilities.ts
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
    - app/src/components/physic-paint/physicsPaintStudio.css
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboardActions.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/hooks/useRotoKeyUtilities.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboardActions.test.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  key_links:
    - from: app/src/components/physic-paint/PhysicsPaintStudio.tsx
      to: app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
      via: "ONE dispatch entry: the four routing wrappers (`duplicateRotoKey`, `copyRotoFrame`, `cutRotoFrame`, `pasteRotoFrame`) serve both the strip buttons (`onCopyRotoFrame` etc.) and the keyboard actions (`copyRotoKey: copyRotoFrame`, `cutRotoKey: cutRotoFrame`, `pasteRotoKey: pasteRotoFrame`) — the strip receives `rotoClipboardMode: rotoClipboardMode.value` + `onRotoClipboardModeChange`, never its own copy of the mode"
    - from: app/src/components/physic-paint/PhysicsPaintStudio.tsx
      to: app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboardActions.ts
      via: "script-mode Cut: `runRotoCutWithScript` snapshots `rotoScript.clipboard.peek()`, runs `rotoScript.copyScript()`, then `rotoPhysicalActions.deleteRotoFrame()`, and restores the snapshot through `rotoScript.clipboard.value` on a failed delete — no ledger entry, no second copy seam"
    - from: app/src/components/physic-paint/PhysicsPaintStudio.tsx
      to: app/src/components/physic-paint/hooks/useRotoKeyUtilities.ts
      via: "mode-aware Duplicate: `duplicateKey({ scriptAware: rotoClipboardMode.peek() === 'script' })` — raster skips the `input.duplicateWithScript` port entirely, script runs the shipped 261023-cxc port verbatim"
---

<objective>
Two user-facing fixes in the Roto key-actions row.

A. Duplicate / Copy / Paste / Cut become ONE visually delineated sub-section of the row, followed by a two-state Raster|Script segmented toggle placed immediately after Cut (before Scissor). The mode is a session-local Studio signal (default `'raster'`, reset on every Studio open, no persistence) and it dispatches all four buttons AND Cmd+C / Cmd+X / Cmd+V: raster is byte-identical to today; script delegates to the shipped Living Script seams (Copy Script, Apply Script/paste, the 261023-cxc script-aware duplicate) with one new irreducible flow — script-mode Cut snapshots the script clipboard before copying and restores it when the delete fails.

B. The "Layer name + Key N" identity block stops resizing: a stable min-width sized for the widest realistic `Key N` plus an ellipsized layer label, so stepping keys and switching layers never displace the grouped sub-section or its neighbors.

Purpose: the four clipboard actions currently look like six unrelated icons and always mean pixels, even though the Studio already ships a complete, editable watercolor-script clipboard; and the identity chip is the first element of a scrollable row, so its width changes shift every neighbor while the artist steps keys.

Output: one session mode signal + four mode-aware Studio wrappers + one pure script-Cut orchestration module (with unit tests), the grouped strip markup with the segmented toggle and mode-derived availability/labels, and the identity CSS stabilization — with every shipped seam count unchanged.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@CLAUDE.md

Skills to load before implementing: `efx-preact-reactivity` (idempotent compare-then-write setters, `.peek()` reads inside handlers, no render-body signal writes, narrow reads, identity-stable effect deps) and `efx-studio-paint` (Living Script clipboard laws: the clipboard is single-key, replace-never-mutate, record-first/bake-second — this quick only routes to those seams, it never rewrites them).

**Project constraints that bind this plan**
- `pnpm` only; `vitest run` ONLY — never watch mode (`app`'s `test` script is watch; always `exec vitest run`). Never start the dev server. Never push. Do not commit `.planning` artifacts.
- Tests live in `.test.ts` files only (vitest collects only `.test.ts`).
- No new script seam: exactly one `copyAquarelleScriptToFrame(` in the Studio, three `recordAquarelleEventsOnFrame(` occurrences, one `applyScript('wet', { paste: true })` call site (inside `handleApplyScript`), two `'wet'` literals. Raster resolvers/history are untouched.
- Do not change the Scripts panel, Copy Script / Apply Script in the sidebar/toolbar, Load + Apply, Run Script, PlayScript, +Key, or any rail-set operation; the toggle governs the single-key path only.
- No document/.mce/schema change, no persistence, no package installs. No new colors: reuse the existing palettes (#161d25 recessed tone, #2a3540 divider, #2f67e8 active segment, existing icon-button colors).
- Preact only: `useSignal` for the mode, `.peek()` in callbacks, compare-then-write setter, no render-body writes.
- Scope guard: 3 tasks / 9 files. Report a gap instead of adding a task or file for verification plumbing.

**Anchors re-verified at HEAD 6c7095bd6 (re-read every one before editing; cite symbols, not lines)**
- `app/src/components/physic-paint/hooks/useRotoKeyUtilities.ts`: `RotoKeyUtilities` interface (`duplicateKey: () => void`), `duplicateKey` implementation (script-port branch `if (input.duplicateWithScript)`, else `runSettleThenClone`), `runSettleThenClone`, `cutKey` (raster snapshot/restore pattern to mirror in message tone, not code).
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx`: `PhysicsPaintWorkflowStripProps` (add the two mode props beside `onCopyScript`/`onDuplicateRotoKey`), `PhysicsPaintWorkflowRotoScriptState` (already `Pick`s `hasCopiedScript`), the action row `<div class="physics-paint-roto-action-row">`, the identity block `physics-paint-roto-key-identity` (layer span + aria-hidden context span), the utilities group `<div class="physics-paint-roto-key-utilities" role="group" ...>`, the Add/Rail/Insert/Delete spans, the Duplicate/Copy/Paste/Cut spans (guarded icon-action pattern: `aria-disabled`, `aria-describedby` reason span, `buildGuardedActionTooltipCopy`, Enter/Space keydown guard), the Scissor/All spans, and the availability block: `canCopyScriptAction` / `copyScriptActionDisabledReason`, `canApplyScriptAction` / `applyScriptActionDisabledReason`, `keyUtilitiesDisabledByBusyState`, `canDuplicateRotoKey` / `canCopyRotoKey` / `canPasteRotoKey` / `canDeleteRotoKey`, `canCutRotoKey = canCopyRotoKey && canDeleteRotoKey;` and its reason chain (keep both literals intact), plus the `buildGuardedActionTooltipCopy` helper.
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`: `selectedKeyIds = useSignal<readonly string[]>([])` (the multi-selection count), the routing wrappers `duplicateRotoKey` (rail-set branch first, then `rotoKeyUtilities.duplicateKey()`), `copyRotoFrame` (rail-set branch first), `cutRotoFrame` (pre-checks `rotoPhysicalActions.canDeleteFrame.value`), `pasteRotoFrame` (rail-set clipboard branch first); the `useRotoNavigationCoordinator` keyUtilities literal holding `duplicateWithScript`; `handleApplyScript` (the SOLE `rotoScript.applyScript('wet', { paste: true })`); `handleCopyScript` (currently declared AFTER the wrappers — it must be hoisted, see Task 3); keyboard wiring `copyRotoKey: copyRotoFrame,` / `cutRotoKey: cutRotoFrame,` / `pasteRotoKey: pasteRotoFrame,`; strip props wiring `onCopyRotoFrame: copyRotoFrame`, `onCutRotoFrame: cutRotoFrame`, `onPasteRotoFrame: pasteRotoFrame`, `onApplyScript: handleApplyScript`, `onCopyScript: handleCopyScript`; the `audioPreviewEnabled: audioPreviewEnabled.value` plain-value prop precedent.
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts`: `clipboard: Signal<RotoPaintScript | null>` (writable — snapshot/restore is legal), `hasCopiedScript: ReadonlySignal<boolean>`, `availability` computed (COPY_REASONS / APPLY_REASONS verbatim; `canApply` already implies a copied script), `copyScript()` (assigns only on success; false return leaves the clipboard untouched), `RotoPaintScript` exported.
- `app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.ts`: the module template to mirror (exported message constants, ports interface, outcome union, one orchestration function; no store/DOM/IPC).
- `app/src/components/physic-paint/physicsPaintStudio.css`: `.physics-paint-roto-key-utilities` (bare 26px group), `.physics-paint-roto-key-layer` / `-context` (10px, tabular-nums on the key), `.physics-paint-roto-key-icon-action` / `-icon-button` (26px, `text-transform: none`), `.physics-paint-roto-action-row` (34px band, gap 4, horizontal scroll), `.physics-paint-roto-key-identity` (bare tonal chip, height 26, radius 8, NO 1px border, NO `#20262d` — existing test pins), `.physics-paint-photo-reference-mode` / `-segment` (the recessed segmented-rail precedent: #161d25 rail, transparent segments, active #2f67e8).
- Test anchors: `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts` helpers `ROW_ICON_ACTIONS`, `getActionAriaLabelToken`, `getButtonBlock`, `getActionRowBlock`, `countOccurrences`; the ordered-action pin, the Paste guarded-block pin, the Cut derivation pins (`canCutRotoKey = canCopyRotoKey && canDeleteRotoKey;`), the visible-label list, and the `expect(source()).not.toMatch(/[^a-zA-Z]Clipboard[^a-zA-Z]/)` pin (do not introduce a standalone capitalized "Clipboard" token — camelCase and lowercase class names are safe). `useRotoKeyUtilities.test.ts` mocked-`preact/hooks` harness (`createHarness`, `flushAsync`, `duplicateWithScript` option). `PhysicsPaintStudio.test.ts` source pins: `copyRotoKey: copyRotoFrame,`, `pasteRotoKey: pasteRotoFrame,`, `onCopyRotoFrame: copyRotoFrame`, `onPasteRotoFrame: pasteRotoFrame`, the 61-24 seam pins (`copyAquarelleScriptToFrame(` count 1, `duplicateWithScript` region to `playback: {`), `countOccurrences(studio, "'wet'") === 2`, and the 0l5 paste pins.

**Anchor discrepancies found while planning (account for them, do not "fix" adjacent code)**
- `handleCopyScript` is declared after the four routing wrappers; referencing it in `copyRotoFrame`'s dependency array would hit the TDZ. Hoist the declaration unchanged above `duplicateRotoKey` (deps `[rotoScript, setLastError]` are already in scope there).
- The identity chip is currently bare (no background) per the 261104 pin; the new clipboard sub-section is the ONLY tonal surface added — do not restore a pill behind the whole utilities group (UAT Gap G-2 stays retired).
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Duplicate raster bypass — the scriptAware option in useRotoKeyUtilities</name>
  <files>
    app/src/components/physic-paint/hooks/useRotoKeyUtilities.ts,
    app/src/components/physic-paint/hooks/useRotoKeyUtilities.test.ts
  </files>
  <behavior>
    RED first, in a new `describe('261124-gfy duplicateKey scriptAware')` at the end of
    `app/src/components/physic-paint/hooks/useRotoKeyUtilities.test.ts`
    (reuse `createHarness` / `flushAsync`; no new ids needed — the harness is per-test):
    - raster bypass: `duplicateKey({ scriptAware: false })` with a
      `duplicateWithScript` mock and a record that already carries bytes — the
      script port is NEVER called, `physicalKeyUtilities.duplicateKey` runs
      exactly once with the source key id, and no error status is published.
    - raster bypass with settle: `duplicateKey({ scriptAware: false })` with a
      record lacking bytes and `resolveDisplayedKeyPaint` returning paint —
      `bakeRotoKeyPaint` runs once, then the clone runs once; the script port
      is never called (the shipped 261023-bxm settle-then-clone).
    - default unchanged: `duplicateKey()` and `duplicateKey({ scriptAware: true })`
      still call the script port exactly once (the shipped 261023-cxc tests
      stay green untouched).
  </behavior>
  <action>
    Change the public signature to
    `duplicateKey: (options?: { scriptAware?: boolean }) => void` in the
    `RotoKeyUtilities` interface and in the implementation. Inside the async
    IIFE, compute `const scriptAware = options?.scriptAware ?? true;` and gate
    the existing branch as `if (scriptAware && input.duplicateWithScript)`;
    the `else` path (and the `'fallback'` continuation) keeps
    `runSettleThenClone` byte-identical. Document the option in the shipped
    261023-cxc comment: quick 261124-gfy — Raster-mode Duplicate must skip the
    script-aware port entirely; Script mode keeps the shipped port and its
    raster fallback. No other behavior, message, or latch changes; the
    `keyActionInFlightRef` guard stays exactly where it is.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/hooks/useRotoKeyUtilities.test.ts</automated>
  </verify>
  <done>
    The new describe is green (raster bypass with and without settle, default
    and explicit-true still consult the port); every pre-existing test in the
    file stays green; `git diff` on the hook is the signature + the gate only.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Key-actions row — grouped clipboard sub-section, Raster|Script toggle, mode-derived availability/labels, stable identity</name>
  <files>
    app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx,
    app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts,
    app/src/components/physic-paint/physicsPaintStudio.css
  </files>
  <behavior>
    Source pins first in
    `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts`
    (string-scanning suite — extend the existing helpers, do not add a second
    test-file style):
    - props: `getWorkflowStripPropsInterface` contains
      `rotoClipboardMode?: 'raster' | 'script'` and
      `onRotoClipboardModeChange?: (mode: 'raster' | 'script') => void`; the
      render body contains `props.rotoClipboardMode ?? 'raster'`.
    - grouping: exactly one `physics-paint-roto-key-clipboard-group` inside the
      `physics-paint-roto-key-utilities` group, opened after the Delete action
      and closed before the Scissor action; its block contains the Duplicate,
      Copy, Paste and Cut action labels in the shipped order; Add / Rail /
      Insert / Delete and Scissor / All are outside it. The four action tooltip
      and aria-label strings come from ONE `clipboardActionLabel(action)`
      helper ('<Action> key' raster / '<Action> script' script).
    - toggle: a `role="group"` segmented control (`physics-paint-roto-key-clipboard-mode`)
      at the END of the group (after Cut, before Scissor) with exactly two
      `<button>` options whose visible labels are `Raster` and `Script`, BOTH
      carrying `aria-pressed` ('true'/'false'), each calling
      `props.onRotoClipboardModeChange?.('<mode>')` with its literal, each with
      an explanatory styled tooltip; no `<select>`, no `<option>`, no native
      title; Raster is pressed when the prop is absent.
    - effective availability: script mode Copy uses
      `canCopyScriptAction` / `copyScriptActionDisabledReason`, Paste uses
      `canApplyScriptAction` + `props.rotoScript?.hasCopiedScript.value` /
      `applyScriptActionDisabledReason`, Cut uses
      `canCopyScriptAction && canDeleteRotoKey` with the reason chain
      `copyScriptActionDisabledReason ?? deleteRotoKeyDisabledReason`; every
      rendered guard/`aria-disabled`/`aria-describedby`/reason span/tooltip
      uses the mode-effective name. The shipped raster literals
      `const canCutRotoKey = canCopyRotoKey && canDeleteRotoKey;` and
      `const cutRotoKeyDisabledReason = canCutRotoKey ? null : (copyRotoKeyDisabledReason ?? deleteRotoKeyDisabledReason);`
      stay untouched.
    - CSS: the group block carries a tonal recessed surface (no 1px outline)
      and `height: 26px`; the toggle options opt out of the global uppercase
      rule (`text-transform: none`) and the active option styles via
      `[aria-pressed='true']`; the identity block gains
      `flex: 0 0 auto` + `min-width: 154px`; the layer span gains
      `flex: 1 1 auto; min-width: 0; max-width: 88px; overflow: hidden; text-overflow: ellipsis`;
      the context span gains `flex: 0 0 auto; min-width: 44px`. The shipped
      identity constraints (no 1px border, no `#20262d`, height 26) stay green.
    - existing pins retargeted: `ROW_ICON_ACTIONS` + `getActionAriaLabelToken`
      resolve the four dynamic labels
      (`aria-label={clipboardActionLabel('Copy')}` etc.); the ordered-action,
      Paste guarded-block and Cut guarded-block tests use the effective names;
      the visible-label list and the no-standalone-`Clipboard`-token pin stay.
  </behavior>
  <action>
    Strip markup. Add
    `rotoClipboardMode?: 'raster' | 'script'` and
    `onRotoClipboardModeChange?: (mode: 'raster' | 'script') => void` to
    `PhysicsPaintWorkflowStripProps` (near the other Roto action ports, with a
    quick 261124-gfy JSDoc: session-local, default raster, reset per Studio
    open). In the render body derive
    `const isScriptClipboardMode = (props.rotoClipboardMode ?? 'raster') === 'script';`
    and the label helper
    `const clipboardActionLabel = (action: string): string => `${action} ${isScriptClipboardMode ? 'script' : 'key'}`;`.

    Insert ONE
    `<span class="physics-paint-roto-key-clipboard-group" role="group" aria-label="Copy and paste actions">`
    inside the utilities group, after the Delete action span and closed before
    the Scissor action span. MOVE the Duplicate, Copy, Paste and Cut action
    spans inside it verbatim (same classes, icons, labels, tooltip hooks,
    Enter/Space guards); change only: their `aria-label`/tooltip first argument
    to `clipboardActionLabel('Duplicate' | 'Copy' | 'Paste' | 'Cut')`, and their
    guard/reason identifiers to the mode-effective constants. Append, still
    inside the group, the segmented toggle:
    `<span class="physics-paint-roto-key-clipboard-mode" role="group" aria-label="Copy and paste kind">`
    holding two `<button type="button" class="physics-paint-roto-key-clipboard-mode-option">`
    options, `aria-pressed` 'true'/'false' derived from
    `isScriptClipboardMode` (Raster pressed when the prop is absent), visible
    text `Raster` / `Script`, each with `useStyledTooltip` pointer/focus
    handlers and a `PhysicsPaintStyledTooltip` (region bottom) explaining
    "Raster — Duplicate, Copy, Paste and Cut move painted keys." and
    "Script — they move the key's watercolor script instead of its pixels.";
    onClick hides the tooltip then
    `props.onRotoClipboardModeChange?.('raster' | 'script')`. Do NOT put Add,
    Rail, Insert, Delete, Scissor or All inside the group.

    Mode-effective availability, computed after the shipped raster block so
    every raster literal above stays byte-identical:
    `const canCopyRotoAction = isScriptClipboardMode ? canCopyScriptAction : canCopyRotoKey;`
    `const copyRotoActionDisabledReason = isScriptClipboardMode ? copyScriptActionDisabledReason : copyRotoKeyDisabledReason;`
    `const canPasteRotoAction = isScriptClipboardMode ? (canApplyScriptAction && Boolean(props.rotoScript?.hasCopiedScript.value)) : canPasteRotoKey;`
    `const pasteRotoActionDisabledReason = isScriptClipboardMode ? applyScriptActionDisabledReason : pasteRotoKeyDisabledReason;`
    `const canCutRotoAction = isScriptClipboardMode ? (canCopyScriptAction && canDeleteRotoKey) : canCutRotoKey;`
    `const cutRotoActionDisabledReason = isScriptClipboardMode ? (canCutRotoAction ? null : (copyScriptActionDisabledReason ?? deleteRotoKeyDisabledReason)) : cutRotoKeyDisabledReason;`
    (Duplicate keeps `canDuplicateRotoKey` in both modes — its eligibility is
    the same single-real-key gate; only its label changes.) Replace the four
    clipboard action blocks' guard/aria-disabled/aria-describedby/reason-span/
    tooltip identifiers with the effective names; leave Scissor/All/Animate
    untouched.

    CSS in `physicsPaintStudio.css` (new rules beside the key-utilities block):
    `.physics-paint-roto-key-clipboard-group` — `display: inline-flex;
    align-items: center; gap: 4px; height: 26px; padding: 0 3px;
    border-radius: 8px; background: #161d25; box-shadow: inset 0 1px 2px rgba(0,0,0,0.35);`
    (recessed tonal group; explicitly NOT a 1px outline). The toggle:
    `.physics-paint-roto-key-clipboard-mode` — inline-flex, gap 2px,
    `margin-left: 2px; padding-left: 4px; border-left: 1px solid #2a3540;`
    (the hairline separates the kind toggle from Cut);
    `.physics-paint-roto-key-clipboard-mode-option` — 20px tall, min-width
    40px, padding 0 6px, transparent background, color #9aa5b1,
    `text-transform: none`, radius 5px, cursor pointer, 9.5px/700; hover
    color #c6cfd8; focus-visible #6f90ff outline like the sibling controls;
    `[aria-pressed='true']` — `background: #2f67e8; color: #ffffff;`.
    Identity stabilization in the EXISTING rule blocks (in place, first-match
    semantics): `.physics-paint-roto-key-identity` add `flex: 0 0 auto;
    min-width: 154px;` (8+8 padding + 88 layer cap + 6 gap + 44 context min —
    constant for 1-3 digit keys); `.physics-paint-roto-key-layer` add
    `flex: 1 1 auto; min-width: 0; max-width: 88px; overflow: hidden;
    text-overflow: ellipsis;`; `.physics-paint-roto-key-context` add
    `flex: 0 0 auto; min-width: 44px;`. Add a short comment naming quick
    261124-gfy above the identity rule. Do not change identity colors,
    radius, height, or add a border/background to it.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts</automated>
  </verify>
  <done>
    The strip suite is green: group containment/order, toggle default + both
    aria-pressed options + mode callbacks, dynamic labels, mode-effective
    availability/reasons, identity/toggle CSS pins, and every pre-existing pin
    (visible labels, utilities group tag, 34px band, no standalone Clipboard
    token, raster Cut derivation literals) after retargeting. `git diff` adds
    only the group wrapper, the toggle, the effective-availability block, the
    label helper, and the CSS.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Studio dispatch — session mode signal, four mode-aware wrappers, script Cut with clipboard restore</name>
  <files>
    app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboardActions.ts,
    app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboardActions.test.ts,
    app/src/components/physic-paint/PhysicsPaintStudio.tsx,
    app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  </files>
  <behavior>
    RED first.

    (a) New unit suite
    `app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboardActions.test.ts`
    over the pure module (no controller, no DOM):
    - constants: copy multi-key refusal names Copy and a single key; cut
      multi-key refusal names Cut and a single key; the restored message states
      the delete failed and the previous script clipboard was restored; the
      copy-failed message states nothing was deleted.
    - multi-key: `getSelectedKeyCount` 2+ -> `refused` with the cut multi-key
      message; `copyScript`/`deleteKey` never called.
    - delete unavailable: -> `refused` with the verbatim
      `deleteDisabledReason`; copy never called.
    - copy unavailable: -> `refused` with the verbatim `copyDisabledReason`;
      delete never called.
    - copy false: -> `aborted` carrying the port's copy error message (or the
      copy-failed constant when null); `deleteKey` never called;
      `restoreScriptClipboard` never called.
    - delete false: `restoreScriptClipboard` called exactly once with the SAME
      snapshot reference captured BEFORE `copyScript` (assert call order:
      snapshot -> copy -> delete -> restore); outcome `restored` with the
      restored message.
    - delete throws: restore once, outcome `aborted` with the restored message
      and the thrown detail.
    - handled: snapshot -> copy -> delete exactly once each, no restore.

    (b) Studio source pins in `PhysicsPaintStudio.test.ts`:
    - `const rotoClipboardMode = useSignal<'raster' | 'script'>('raster');`
      declared beside the other session `useSignal`s; an idempotent
      `handleRotoClipboardModeChange` (`if (rotoClipboardMode.peek() === mode) return;`
      then the write).
    - `duplicateRotoKey` keeps the rail-set branch first and calls
      `rotoKeyUtilities.duplicateKey({ scriptAware: rotoClipboardMode.peek() === 'script' })`.
    - `copyRotoFrame` keeps the rail-set branch first; script branch order:
      2+ selected keys -> publish `ROTO_SCRIPT_COPY_MULTI_KEY_REFUSAL`; then
      `!rotoScript.availability.peek().canCopy` -> publish the verbatim
      `copyDisabledReason`; else `handleCopyScript()`; raster branch ends with
      the unchanged `rotoKeyUtilities.copyKey()`.
    - `pasteRotoFrame` keeps the rail-set clipboard branch first; script
      branch: `!availability.canApply || !rotoScript.hasCopiedScript.peek()` ->
      publish the verbatim `applyDisabledReason`; else `handleApplyScript()`;
      raster branch ends with the unchanged `rotoKeyUtilities.pasteKey()`.
    - `cutRotoFrame` script branch calls `runRotoCutWithScript(` ONCE with the
      ports `getSelectedKeyCount: () => selectedKeyIds.peek().length`,
      `snapshotScriptClipboard: () => rotoScript.clipboard.peek()`,
      `copyScript: () => rotoScript.copyScript()`, delete via
      `rotoPhysicalActions.canDeleteFrame.value` / `deleteDisabledReason.value` /
      `deleteRotoFrame()`, and
      `restoreScriptClipboard: (snapshot) => { rotoScript.clipboard.value = snapshot; }`;
      raster branch byte-identical (delete pre-check + `cutKey(deleteRotoFrame)`).
    - `handleCopyScript` is declared BEFORE `duplicateRotoKey`/`copyRotoFrame`
      and still holds the ONLY `rotoScript.copyScript()` call in the handler
      (the new Cut port is the second call site; no third).
    - strip wiring:
      `rotoClipboardMode: rotoClipboardMode.value, onRotoClipboardModeChange: handleRotoClipboardModeChange`
      on the workflow-strip props.
    - seam counts unchanged: `copyAquarelleScriptToFrame(` = 1,
      `recordAquarelleEventsOnFrame(` = 3, `applyScript('wet', { paste: true })`
      = 1, `countOccurrences(studio, "'wet'")` = 2; keyboard wiring
      `copyRotoKey: copyRotoFrame,` / `cutRotoKey: cutRotoFrame,` /
      `pasteRotoKey: pasteRotoFrame,` unchanged.
  </behavior>
  <action>
    New module
    `app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboardActions.ts`
    modeled on `physicsPaintRotoDuplicateScript.ts` (no store, DOM, or IPC;
    every side effect crosses a port):
    export
    `ROTO_SCRIPT_COPY_MULTI_KEY_REFUSAL = 'Copy script copies one key at a time — select a single key.'`,
    `ROTO_SCRIPT_CUT_MULTI_KEY_REFUSAL = 'Cut script works on one key at a time — select a single key.'`,
    `ROTO_SCRIPT_CUT_COPY_FAILED = 'Cut canceled — the script could not be copied. Nothing was deleted.'`,
    `ROTO_SCRIPT_CUT_DELETE_FAILED = 'Cut canceled — the selected key could not be deleted. The previous script clipboard was restored.'`;
    export
    `RotoScriptCutPorts { getSelectedKeyCount; canCopy; copyDisabledReason; copyErrorMessage?; snapshotScriptClipboard: () => RotoPaintScript | null; copyScript: () => Promise<boolean>; canDelete; deleteDisabledReason; deleteKey: () => Promise<boolean>; restoreScriptClipboard: (snapshot: RotoPaintScript | null) => void }`
    (import `RotoPaintScript` from `./physicsPaintRotoScriptClipboard`) and
    `RotoScriptCutOutcome = { outcome: 'handled' } | { outcome: 'refused'; message } | { outcome: 'restored'; message } | { outcome: 'aborted'; message; detail? }`.
    `runRotoCutWithScript(ports)`: multi-key (2+) refusal -> delete
    availability refusal (verbatim `deleteDisabledReason`, fallback
    'Deleting the selected Roto key is unavailable.') -> copy availability
    refusal (verbatim `copyDisabledReason`, fallback 'Copying the key script is
    unavailable.') -> snapshot -> `await copyScript()` (false -> `aborted` with
    `copyErrorMessage?.() ?? ROTO_SCRIPT_CUT_COPY_FAILED`) -> `await deleteKey()`
    inside try/catch; false -> restore + `restored`; throw -> restore +
    `aborted` (detail = error message); success -> restore never called,
    `handled`. Document the locked order and why the snapshot precedes the copy
    (a failed delete must hand the artist back the clipboard they had).

    Studio wiring in `PhysicsPaintStudio.tsx`:
    - declare `const rotoClipboardMode = useSignal<'raster' | 'script'>('raster');`
      beside `selectedKeyIds` (session-local, no persistence, default raster;
      a fresh component mount/reset per Studio open is the reset) and
      `handleRotoClipboardModeChange` with the compare-then-write guard.
    - HOIST the existing `handleCopyScript` callback (body unchanged, deps
      `[rotoScript, setLastError]`) above `duplicateRotoKey` — it is referenced
      by `copyRotoFrame`. One declaration, no wrapper.
    - update the four wrappers exactly as the behavior block describes; keep
      every rail-set branch first and unchanged; read the mode with
      `.peek()` inside the callbacks; add `rotoClipboardMode`, `selectedKeyIds`,
      `rotoScript`, `handleCopyScript` / `handleApplyScript` to the relevant
      dependency arrays. Publish Studio-side refusals with `setApplyMessage`
      (the shipped wrapper pre-check style); publish `aborted` results with
      `setApplyStatus('error')` + `setApplyMessage` + `setLastError(detail ??
      message)`, `restored` with `setApplyMessage` only, and `handled` silently.
      Wrap the module call in a catch that publishes
      'Could not cut the Roto key.' + the detail (the raster cut's throw
      surface).
    - pass `rotoClipboardMode: rotoClipboardMode.value,
      onRotoClipboardModeChange: handleRotoClipboardModeChange` on the
      workflow-strip props.
    - import the module constants + `runRotoCutWithScript`. Do not touch
      `handleApplyScript`, the keyUtilities/`duplicateWithScript` literal, the
      record seams, the keyboard module, or any rail-set action.

    Do not add a second `copyAquarelleScriptToFrame(`/`recordAquarelleEventsOnFrame(`
    seam, a second `applyScript('wet', { paste: true })`, or any persistence.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/physicsPaintRotoScriptClipboardActions.test.ts</automated>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts</automated>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/hooks/useRotoKeyUtilities.test.ts</automated>
    <automated>pnpm --dir app exec tsc --noEmit</automated>
    <automated>grep -c "runRotoCutWithScript(" app/src/components/physic-paint/PhysicsPaintStudio.tsx</automated>
  </verify>
  <done>
    The new module suite is green (all seven branches, call order, snapshot
    identity); the Studio suite is green with the new pins and every
    pre-existing pin; the hook suite stays green; `tsc --noEmit` is green;
    the Studio holds exactly one `runRotoCutWithScript(` site [HEAD=0,
    EXPECT=1], still one `copyAquarelleScriptToFrame(` [HEAD=1, EXPECT=1],
    three `recordAquarelleEventsOnFrame(` [HEAD=3, EXPECT=3], one
    `applyScript('wet', { paste: true })` and two `'wet'` literals
    [HEAD=2, EXPECT=2].
  </done>
</task>

</tasks>

<threat_model>
No trust boundary is crossed: this quick is session-local UI mode routing (a Preact signal defaulting to `'raster'`) plus clipboard snapshot/restore over an in-memory controller — no document, `.mce`, schema, IPC, network, or package surface changes, so the STRIDE register is not applicable.
</threat_model>

<verification>
- **Per-task gates** are the commands above. `app`'s `test` script is watch mode — always `exec vitest run`.
- **Full gates (checkout root, all green before handover):**
  `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/hooks/useRotoKeyUtilities.test.ts`,
  `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts`,
  `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/physicsPaintRotoScriptClipboardActions.test.ts`,
  `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts`,
  then `pnpm --dir app exec vitest run` (full app suite) and
  `pnpm --dir app exec tsc --noEmit`.
  Never watch mode; never start the dev server; never push; do not commit `.planning` artifacts.
- **Seam-count audit (location-specific, never tree-wide):**
  `grep -c "copyAquarelleScriptToFrame(" app/src/components/physic-paint/PhysicsPaintStudio.tsx` [HEAD=1, EXPECT=1];
  `grep -c "recordAquarelleEventsOnFrame(" app/src/components/physic-paint/PhysicsPaintStudio.tsx` [HEAD=3, EXPECT=3];
  `grep -c "runRotoCutWithScript(" app/src/components/physic-paint/PhysicsPaintStudio.tsx` [HEAD=0, EXPECT=1];
  the `countOccurrences` test pin keeps `'wet'` at 2 [HEAD=2, EXPECT=2] and the handleApplyScript pin keeps the sole `applyScript('wet', { paste: true })`.
- **Untouched-surface diff audit:**
  `git diff --exit-code -- packages/efx-watercolor packages/efx-paint app/src/components/physic-paint/engine app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.ts app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts`
  (only the nine planned files may change).
- **Live UAT rows (artist-run in the Studio; stay pending — report AUTOMATED-READY only):**
  1. Fresh Studio open: Raster is pressed; Duplicate / Copy / Paste / Cut and
     Cmd+C / Cmd+X / Cmd+V behave exactly as before the change.
  2. Toggle Script: Duplicate on a script-carrying key whose next frame is
     empty produces an editable duplicate; on any ineligible destination it
     still clones (the shipped fallback) and the tooltip reads "Duplicate
     script".
  3. Script Copy -> navigate -> Paste: the destination key renders the wash AND
     owns an editable script; one Cmd+Z undoes it.
  4. Script Cut: the key is deleted and the script clipboard holds its script;
     when the delete is refused, the previous script clipboard is restored
     and the explicit restore message appears.
  5. Script mode with 2+ keys selected: Copy and Cut refuse with the
     single-key messages; Paste still applies the copied script to the current
     key; rail-set Copy/Duplicate/Paste keep their shipped routing.
  6. Generated in-between: Copy is refused with the shipped Copy Script
     message, Paste with the shipped Apply Script message.
  7. Identity block: stepping a key through 1 -> 2 -> 3 digits and switching
     layers never moves the clipboard group or any neighbor; a long layer name
     ellipsizes; the chip's tonal styling is unchanged.
</verification>

<success_criteria>
- The four clipboard actions live in one tonal sub-section with a two-state
  Raster|Script segmented toggle after Cut; Raster is the default on every
  Studio open and the mode is never persisted.
- Raster preserves today's behavior byte-for-byte (Duplicate skips the
  script-aware port; Copy/Paste use the raster clipboard; Cut is today's
  raster copy+delete), for both the buttons and Cmd+C / Cmd+X / Cmd+V.
- Script delegates to the shipped seams (261023-cxc duplicate with its
  fallback, handleCopyScript, handleApplyScript) and adds exactly one new
  flow: Cut copies the script, deletes the key, and restores the previous
  script clipboard on a failed delete; Copy/Cut refuse 2+ key selections with
  an explicit message; no silent raster fallback anywhere in script mode.
- Availability and copy follow the active mode, reusing the shipped reasons
  verbatim; labels/tooltips name the active kind; the toggle is a segmented
  control with aria-pressed on both options.
- The identity block keeps a constant footprint (min-width for 3-digit keys,
  ellipsized layer cap) with unchanged styling.
- Every seam count is unchanged (one copy seam, three record-seam occurrences,
  one wet Apply site, two 'wet' literals); Scripts panel/Load+Apply/Run
  Script/PlayScript/+Key/rail-set operations are untouched.
- All gates green; the seven UAT rows handed over as automated-ready.
</success_criteria>

<output>
Create `.planning/quick/261124-gfy-roto-key-actions-group-duplicate-copy-pa/261124-gfy-SUMMARY.md` when done (English, per project convention). Do not commit `.planning` artifacts.
</output>
