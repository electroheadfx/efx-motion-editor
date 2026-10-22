---
phase: quick-261022-cfn
plan: 261022-cfn
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/physic-paint/roto/physicsPaintRotoPreviousKeyBase.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPreviousKeyBase.test.ts
  - app/src/components/physic-paint/hooks/useRotoKeyUtilities.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStripRailCreate.test.tsx
  - app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx
  - app/src/components/physic-paint/view/PhysicsPaintStudioView.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintScriptPickerDialog.tsx
  - app/src/components/physic-paint/view/PhysicsPaintScriptPickerDialog.test.tsx
  - app/src/components/physic-paint/view/PhysicsPaintScriptPickerDialog.test.tsx.test.ts
  - app/src/components/physic-paint/physicsPaintStudio.css
  - app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx
  - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx
  - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintRightSidebar.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx
  - app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts
  - app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.ts
  - app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.tsx
  - app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.test.tsx
  - app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx
  - app/src/components/timeline/TimelineRenderer.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts
  - app/src/components/physic-paint/hooks/useRotoScriptLibraryController.ts
autonomous: true
requirements:
  - CFN-01
  - CFN-02
  - CFN-03

estimate:
  tokens: 62000
  raw_tokens: 44000
  tasks: 3
  confidence: low            # zero calibration samples for quick-task plans; three ordered tasks with independently verifiable seams

must_haves:
  truths:
    - "Auto-paint on a GENERATED/INTERPOLATED frame whose nearest previous real key exists: the promoted key clones that key's paint (cached real-key bytes first, durable payload fallback), JOINS that key's rail, and the resulting key contains previous paint + the new stroke."
    - "Auto-paint on a GENERATED/INTERPOLATED frame when the previous key's bytes are unavailable: the promotion fails closed through the existing promotion failure path (stroke discarded, error surfaced); it never creates a silent blank key."
    - "Auto-paint on an EMPTY frame with a previous real key: the promoted key starts BLANK (only the new stroke) and JOINS the previous real key's rail, so motion stays continuous and the intervening frame becomes interpolated."
    - "Auto-paint with no previous real key (empty or defensive generated): blank payload + a new rail."
    - "+ Key is unchanged: nearest previous real key clone + rail join; blank + new rail only when no previous key exists; fail closed on unavailable bytes."
    - "The timeline action row has no + Rail button and no rail-kind dropdown; the + Key button and its availability law remain."
    - "Motion/Static/Reveal rail creation remains reachable from the sidebar Scripts tab through the Create Rail button -> playScript.openConfirmation() and the Create Rail dialog's own tabs."
    - "Every user-visible Action/Actions string in the Physic Paint Roto script UI reads Script/Scripts; tabs, aria-labels, titles, tooltips, dialog copy, status/error/recovery messages included."
  artifacts:
    - app/src/components/physic-paint/roto/physicsPaintRotoPreviousKeyBase.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoPreviousKeyBase.test.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
    - app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx
    - app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx
    - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx
    - app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.ts
  key_links:
    - "ONE previous-key resolver: resolvePreviousRealKeyBase(records + cachedRotoFrames + destinationAppFrame) returns clone(payload) | blank | unavailable and is called by BOTH useRotoKeyUtilities.addKey and the Studio auto-paint promotion; no duplicated selection/bytes logic."
    - "promoteRotoPaintTargetRef.current resolves the base BEFORE dispatch and pins it on pendingFirstPaintTargetRef.current.blankFrame; both capture paths (repaint base at the accepted-settlement branch and the aquarelle capture) read that base so the created key carries clone + stroke, or stroke only."
    - "pendingFirstPaintTargetRef.baseKind ('clone' | 'blank') is the single discriminator for the aquarelle merge base: a cloned base multiplies the sheet over the previous key's paint; a blank base encodes the sheet alone."
    - "PhysicalKeyUtilities.addEmptyKey(destination, payload, { joinPreviousRail }) is the one rail-join seam; joinPreviousRail is true whenever a previous real key exists."
    - "The Scripts sidebar tab owns motion/static/reveal creation after the timeline dropdown is removed; no other picker entry point remains."
---

<objective>
Implement the three locked quick decisions:

1. **Auto-paint key creation** — painting an empty or generated/interpolated frame no longer always opens a new rail. On a generated frame the promoted key clones the nearest previous real key's paint and joins its rail; on an empty frame it starts blank but joins the previous real key's rail. A blank payload + new rail happens only when no previous real key exists. Unavailable previous-key bytes on a generated frame fail closed exactly like + Key.
2. **Remove the timeline + Rail dropdown** — delete the + Rail button, its rail-kind menu, and every dead prop/handler/picker path it owned. Motion/Static/Reveal stay reachable from the sidebar Scripts tab's Create Rail flow.
3. **Rename Action -> Script in visible UI** — every user-visible label, aria-label, title, tooltip, dialog/status/error string; no code identifiers, file names, classes, attributes, or test ids renamed.

Purpose: make painting on a non-real frame behave like "continue this motion", not "start a new motion", and stop exposing two different rail-creation surfaces with two different naming vocabularies.

Output: one shared previous-key resolver reused by + Key and auto-paint; a promotion base that feeds both capture paths (including the Water color merge base); a timeline action row with Key but no Rail dropdown; renamed visible copy across the Roto script UI; tests pins for each seam and six live UAT rows for the user.

**Scope fences:** no new dependencies; no dev-server runs; no pushes; atomic local commits; Preact + @preact/signals only (no new useState); vitest `run` only (never watch); `pnpm --dir app typecheck` is a comparative gate against the recorded baseline (16 errors at HEAD ef934988, 2026-10-22).
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@./CLAUDE.md

Read before editing:
- `app/src/components/physic-paint/hooks/useRotoKeyUtilities.ts` — `addKey` (~305-342), private `resolvePreviousRealKeyPayload` (~391-428), `toEmptyKeyPayload` (~370), `PREVIOUS_KEY_BYTES_UNAVAILABLE_ERROR`.
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — promotion seam `promoteRotoPaintTargetRef.current` (~2090-2187), `RotoPaintPromotionSuccess`/`PendingRotoFirstPaintTarget` (~184-217), `startRotoPaintPromotion` (~2247-2286), accepted-settlement base pin (~1826-1840 and ~3652-3666), aquarelle capture base (~4646-4677), `handleCreateRotoKeyRail` (~3030-3062), `scriptPickerIntent` (~553-559), `scriptPickerDialogPropsMemo` (~742), picker props (~5915-5950), Studio prop passes (~6000-6013 and ~6056), visible copy (~6189).
- `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts` — `addEmptyKey` (~2340-2401): `joinPreviousRail` is already implemented and derives `startsNewSegment`.
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` — `PhysicsPaintRailCreateMenu` (~1114-1153), rail-create state/effect (~1893-1925), availability law (~2353-2368), tooltip (~2464-2465), action-row JSX (~5120-5231), props (~302-308, ~530-541).
- `app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx` — `scriptPickerDialog` prop/import/render (~13, ~327, ~348, ~402).
- `app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx` — lower tab label (~553).
- `app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx` — all visible copy; the `Create Rail…` button calls `playScript.openConfirmation()`.
- `app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.ts`, `PhysicsPaintLoopClipRail.tsx`, `PhysicsPaintPlayScriptDialog.tsx`, `roto/physicsPaintRotoPlayScriptController.ts`, `roto/physicsPaintRotoScriptLibrary.ts`, `hooks/useRotoScriptLibraryController.ts` — visible Action copy.
- Test environment: `app/vitest.config.ts` collects only `src/**/*.test.ts`; `.test.tsx` files are NOT collected. Source-pin suites use `readFileSync` (see `PhysicsPaintStudio.test.ts`, `PhysicsPaintWorkflowStrip.test.ts`).
</context>

<tasks>

<!-- Literals named by implementation instructions and negative gates appear below; allow them. -->
<!-- planner-discipline-allow: LIT -->

<task type="auto" tdd="true">
  <name>Task 1: One previous-key base resolver + auto-paint clone/join promotion</name>
  <files>
    app/src/components/physic-paint/roto/physicsPaintRotoPreviousKeyBase.ts
    app/src/components/physic-paint/roto/physicsPaintRotoPreviousKeyBase.test.ts
    app/src/components/physic-paint/hooks/useRotoKeyUtilities.ts
    app/src/components/physic-paint/PhysicsPaintStudio.tsx
    app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  </files>
  <behavior>
    Step 0: record the typecheck baseline before editing:
    `pnpm --dir app typecheck > /tmp/cfn-typecheck-baseline.txt 2>&1; grep -c 'error TS' /tmp/cfn-typecheck-baseline.txt`
    Planning-time provenance: 16 errors at HEAD ef934988 on 2026-10-22.

    RED first — new pure suite `physicsPaintRotoPreviousKeyBase.test.ts`:
    - No record strictly earlier than the destination -> `{ kind: 'blank' }`.
    - Records only at/after the destination (destination 0 with a key at 3) -> `blank`.
    - Nearest strictly-earlier record wins; later records are ignored.
    - Cached real-key frame bytes at the previous appFrame are preferred; the returned payload's appFrame is the destination, while frameIndex/width/height are preserved.
    - Durable record payload bytes are the fallback when no usable cached real-key frame exists.
    - Cached frames at other appFrames, generated/`source !== 'real-key'` frames, and zero-length bytes never satisfy the clone.
    - A previous record with missing or empty bytes on both carriers -> `{ kind: 'unavailable' }` (never blank).
    - Returned payloads are frozen (same contract as today's `toEmptyKeyPayload`).

    RED first — extend `PhysicsPaintStudio.test.ts` source pins (the Studio promotion section is extracted by marker `promoteRotoPaintTargetRef.current = async (`):
    - The promotion calls the shared resolver with the launch's real-key records + the cached frames ref + `source.appFrame`; it does not inline its own previous-key search.
    - Generated/interpolated + `unavailable` returns a failure before any `addEmptyKey` dispatch.
    - Generated/interpolated + clone: the base payload is the resolver payload relabeled to `source.appFrame` and `joinPreviousRail: true`; no blank frame is built.
    - Empty + a previous record (clone or unavailable): the base is a blank frame and `joinPreviousRail: true`.
    - Empty + no previous record: blank frame and `joinPreviousRail: false`.
    - `pendingEntry.baseKind` is set before dispatch ('clone' only for a clone base, 'blank' otherwise).
    - The aquarelle capture reads the pending entry's `baseKind` to choose `cachedBase` (clone base -> `pendingFirstPaintTarget.blankFrame`; blank base -> null); the accepted-settlement branch sets the aquarelle merge base the same way.
    - Replace the old pin `expect(promotionHelper).not.toContain("selectionKind === 'generated-interpolation'")` with assertions that both kinds promote and only the base/join differ.
  </behavior>
  <action>
    1. Create `app/src/components/physic-paint/roto/physicsPaintRotoPreviousKeyBase.ts`:
       - Export the resolution type `PreviousRealKeyBaseResolution = { kind: 'clone'; payload: PhysicPaintRotoRealKeyPayload } | { kind: 'blank' } | { kind: 'unavailable' }`.
       - Export `resolvePreviousRealKeyBase(input: { records: readonly PhysicPaintRotoRealKeyRecord[]; cachedRotoFrames?: readonly PhysicPaintRotoCacheFrame[] }, destinationAppFrame: number): PreviousRealKeyBaseResolution`.
       - Move the body of the hook's private previous-key resolver here unchanged in behavior: scan `records` for the greatest integer `appFrame` strictly below the destination; prefer a cached `source === 'real-key'` frame at that appFrame with usable bytes; fall back to the record payload's usable bytes; return `unavailable` when a previous record exists but neither carrier has usable bytes; return `blank` only when no previous record exists.
       - Move `toEmptyKeyPayload` and the `previous key bytes unavailable` constant here. Export `toEmptyKeyPayload` (used for the + Key blank branch and the promotion's blank base) and export the constant so both callers build the same message. Delete the private copies from `useRotoKeyUtilities.ts`.
       - Keep payloads frozen and relabel `appFrame` to the destination while preserving `frameIndex`, `width`, `height`.

    2. `useRotoKeyUtilities.ts`: import the shared resolver/helper and delete the private resolver. `addKey` keeps identical behavior: unavailable -> error status + `previous key bytes unavailable` message and no key; clone -> payload = resolution.payload; blank -> `toEmptyKeyPayload(await buildBlankRotoFrame(currentFrame), currentFrame)`; call `addEmptyKey(currentFrame, payload, { joinPreviousRail: resolution.kind === 'clone' })`. Do not change the + Key availability law or messages.

    3. `PhysicsPaintStudio.tsx` promotion (`promoteRotoPaintTargetRef.current`):
       - After the real-key guard, resolve `records = physicPaintStore.getRotoRealKeyRecords(launch.layerId, studioActiveTrackId())` and `cachedRotoFrames = latestRotoFramesRef.current`, then call `resolvePreviousRealKeyBase(...)` with `source.appFrame`.
       - Generated/interpolated source + `unavailable`: return the existing `fail(...)` failure with branch token `previous-key-bytes-unavailable`; no dispatch, no blank key.
       - Base selection: generated/interpolated + clone -> build a `RenderedFramePayload` from the clone payload relabeled to `source.appFrame` (frameIndex/bytes/width/height preserved) and set `baseKind = 'clone'`; every other case (empty source, generated + blank) -> `buildBlankRotoFrame(canvasWidth, canvasHeight, source.appFrame)` with `baseKind = 'blank'`, keeping the existing blank-frame failure branch.
       - `joinPreviousRail = resolution.kind !== 'blank'` (clone and unavailable-on-empty both join; blank means no previous key).
       - Set the pending entry's `blankFrame` to the chosen base and `baseKind` BEFORE dispatch, then dispatch `addEmptyKey(source.appFrame, payload, { joinPreviousRail })`. Keep the accepted-shape validation and the success result unchanged except that the returned base is the chosen base.
       - Add `readonly baseKind: 'clone' | 'blank'` to `PendingRotoFirstPaintTarget`, initialized `'blank'` in `startRotoPaintPromotion`.
       - Accepted-settlement branch (~3652-3666): keep pinning `cachedRotoRepaintBaseFrame` to `pendingSelfPromotion.blankFrame`; set `aquarelleMergeBaseRef.current` to `{ appFrame, base: pendingSelfPromotion.baseKind === 'clone' ? pendingSelfPromotion.blankFrame : null }`.
       - Aquarelle capture (~4646-4677): replace the hardcoded `cachedBase = null` with `cachedBase = pendingFirstPaintTarget.baseKind === 'clone' ? pendingFirstPaintTarget.blankFrame : null`, and set `aquarelleMergeBaseRef.current` to the same base. Keep the failure policy: a failed promotion persists nothing.
       - Keep the existing failure/undo cleanup path intact; no new promotion path.

    Preact rules: no new `useState`; the promotion reads signals through `.peek()`/refs as today; no render-body signal writes.

    Do not touch the + Rail UI or the visible Action copy in this task.
  </action>
  <verify>
    <automated>pnpm --dir app exec vitest run src/components/physic-paint/roto/physicsPaintRotoPreviousKeyBase.test.ts src/components/physic-paint/hooks/useRotoKeyUtilities.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts</automated>
    <automated>test "$(grep -c 'resolvePreviousRealKeyPayload' app/src/components/physic-paint/hooks/useRotoKeyUtilities.ts)" -eq 0</automated>
    <automated>grep -q 'joinPreviousRail' app/src/components/physic-paint/PhysicsPaintStudio.tsx</automated>
    <automated>grep -q 'resolvePreviousRealKeyBase' app/src/components/physic-paint/hooks/useRotoKeyUtilities.ts && grep -q 'resolvePreviousRealKeyBase' app/src/components/physic-paint/PhysicsPaintStudio.tsx</automated>
    <automated>pnpm --dir app typecheck > /tmp/cfn-typecheck-task1.txt 2>&1; test "$(grep -c 'error TS' /tmp/cfn-typecheck-task1.txt)" -le "$(grep -c 'error TS' /tmp/cfn-typecheck-baseline.txt)"</automated>
  </verify>
  <done>
    The pure resolver suite covers nearest-previous selection, cached-over-durable, blank-only-when-none, unavailable-on-missing-bytes, and payload relabeling (RED witnessed first). `useRotoKeyUtilities.addKey` and the Studio promotion both call the one shared resolver; the promotion sets the clone-or-blank base and `baseKind` before dispatch, joins the previous rail whenever a previous real key exists, fails closed (no dispatch, no blank key) on a generated frame with unavailable bytes, and both capture paths (repaint base + aquarelle merge base) use the chosen base. `useRotoKeyUtilities.test.ts` stays green unchanged; typecheck shows no new errors versus the 16-error baseline.
  </done>
</task>

<task type="auto">
  <name>Task 2: Delete the timeline + Rail dropdown and its dead picker path</name>
  <files>
    app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
    app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts
    app/src/components/physic-paint/view/PhysicsPaintWorkflowStripRailCreate.test.tsx
    app/src/components/physic-paint/PhysicsPaintStudio.tsx
    app/src/components/physic-paint/PhysicsPaintStudio.test.ts
    app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx
    app/src/components/physic-paint/view/PhysicsPaintStudioView.test.ts
    app/src/components/physic-paint/view/PhysicsPaintScriptPickerDialog.tsx
    app/src/components/physic-paint/view/PhysicsPaintScriptPickerDialog.test.tsx
    app/src/components/physic-paint/view/PhysicsPaintScriptPickerDialog.test.tsx.test.ts
    app/src/components/physic-paint/physicsPaintStudio.css
  </files>
  <behavior>
    - The strip action row renders the `Add key` button and no `Create rail` button, no rail-kind group, and no `Rail kind` menu; the `Add key` availability law and tooltip are unchanged.
    - The strip no longer accepts the three rail-create props; no caller passes them.
    - The Studio no longer owns a rail-key handler or a script-picker intent; `PhysicsPaintScriptPickerDialog` is not imported, mounted, or referenced anywhere in `app/src`.
    - The sidebar Scripts tab still exposes `Create Rail…` -> `playScript.openConfirmation()`; the Create Rail dialog's own tab buttons remain the Reveal entry (verified by existing controller/panel tests, not removed).
    - Source pins: `PhysicsPaintWorkflowStrip.test.ts` asserts the row order without a rail entry and asserts the absence literals; the deleted `.test.tsx` file is replaced by those pins (vitest never collected `.test.tsx`).
  </behavior>
  <action>
    1. `PhysicsPaintWorkflowStrip.tsx`:
       - Delete `PhysicsPaintRailCreateMenu` and the action-row group: the rail-create button, its tooltip, its sr-only reason, and the four menu items (Key/Motion/Static/Reveal). Keep the `Add key` block untouched.
       - Delete `railCreateMenuOpen`, `railCreateAnchorRef`, `railCreateMenuPanelRef`, `closeRailCreateMenu`, the dismissal effect, `railCreateTooltip`, `canCreateRail`, and `railCreateDisabledReason`; also delete the now-unused `currentFrameResolution` / `isCurrentFrameGenerated` / `isCurrentFrameLinkedRepeat` derivations and the `isLinkedRepeatFrameResolution` helper if nothing else reads it.
       - Remove the props `onCreateRotoKeyRail`, `onCreatePlayScriptRail`, `onCreateRevealRail` and their comments.
       - Remove imports that become unused; do not remove imports still used by the toolbox popover.

    2. `physicsPaintStudio.css`: delete the `.physics-paint-rail-create-group` rule and every `.physics-paint-rail-create-menu*` rule.

    3. `PhysicsPaintStudio.tsx`:
       - Delete `handleCreateRotoKeyRail` (~3030-3062) and the `onCreateRotoKeyRail` pass (~6056).
       - Delete the `scriptPickerIntent` signal and its comment (~553-559), `scriptPickerDialogPropsMemo` (~742), the `scriptPickerDialog` memo block (~5915-5950), the `onCreatePlayScriptRail`/`onCreateRevealRail` passes (~6000-6013), and the `scriptPickerDialog` input to the view model (~5959).
       - Confirm the picker had no other entry point (grep `scriptPickerIntent` and `PhysicsPaintScriptPickerDialog` across `app/src`); delete it as dead code.
       - Do NOT remove the `openConfirmation({ railTab })` option from the PlayScript controller: it is the controller's public tab-opening API and controller tests exercise it. Only the picker's `onPick` caller disappears.

    4. `PhysicsPaintStudioView.tsx`: remove the picker import, the `scriptPickerDialog` prop, the destructure entry, and the render line (~402). Keep the `pickerOpen` gate for the remaining modals.

    5. Delete `PhysicsPaintScriptPickerDialog.tsx`, its `.test.tsx`, and its `.test.tsx.test.ts` launcher.

    6. Tests:
       - Delete `PhysicsPaintWorkflowStripRailCreate.test.tsx`.
       - In `PhysicsPaintWorkflowStrip.test.ts`: drop the rail token from the action-row order test; delete the three + Rail tests (availability law, menu order, derivation); add one pin asserting no `Create rail` label, no `Rail kind` label, no `physics-paint-rail-create-group`, and that `aria-label="Add key"` still exists in the action row. Keep the unrelated Solo-in-pill test.
       - In `PhysicsPaintStudio.test.ts`: delete the AM-3 picker describe and the reveal-routing test; replace the picker-mount pin with an absence pin; update the promotion pin that counted two `addEmptyKey` call sites to exactly 1 (the promotion); remove the `handleCreateRotoKeyRail` section; update the memo-count pin (`PropsMemo.resolve(` 9 -> 8) and its comment.
       - In `PhysicsPaintStudioView.test.ts`: remove the picker import, the `scriptPickerOpen` fixture field/uses, and the picker assertions from `expectNoParentModals`/`expectAllParentModals`.
       - In `physicsPaintRotoPlayScriptController.test.ts`: reword the WR-03 comment that names the removed Studio picker intent so the app-wide zero gate can pass; keep every behavioral leg and the `openConfirmation({ railTab })` coverage.

    No backward-compatibility shims: remove the props/handlers entirely rather than leaving optional no-ops.
  </action>
  <verify>
    <automated>pnpm --dir app exec vitest run src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts src/components/physic-paint/view/PhysicsPaintStudioView.test.ts src/components/physic-paint/view/PhysicsPaintRightSidebar.test.ts src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts</automated>
    <automated>test "$(grep -rn 'Create rail' app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx | wc -l | tr -d ' ')" -eq 0</automated>
    <automated>test "$(grep -rn 'physics-paint-rail-create' app/src/components/physic-paint/physicsPaintStudio.css | wc -l | tr -d ' ')" -eq 0</automated>
    <automated>test "$(grep -rn 'scriptPickerIntent\|PhysicsPaintScriptPickerDialog\|onCreateRotoKeyRail\|onCreatePlayScriptRail\|onCreateRevealRail' app/src --include='*.ts' --include='*.tsx' | wc -l | tr -d ' ')" -eq 0</automated>
    <automated>test ! -f app/src/components/physic-paint/view/PhysicsPaintScriptPickerDialog.tsx</automated>
    <automated>grep -q 'aria-label="Add key"' app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx</automated>
    <automated>pnpm --dir app typecheck > /tmp/cfn-typecheck-task2.txt 2>&1; test "$(grep -c 'error TS' /tmp/cfn-typecheck-task2.txt)" -le "$(grep -c 'error TS' /tmp/cfn-typecheck-baseline.txt)"</automated>
  </verify>
  <done>
    The timeline action row exposes only Key (no Rail button, no menu, no rail-kind labels, no rail-create CSS). The strip props, Studio handler, picker intent/dialog, Studio view prop, and all tests/harnesses referencing them are deleted; the app-wide grep for those symbols is zero. `Create Rail…` in the Scripts sidebar still opens the Create Rail dialog, whose own tabs keep motion/static/reveal reachable. Typecheck shows no new errors versus the 16-error baseline.
  </done>
</task>

<task type="auto">
  <name>Task 3: Rename visible Action/Actions copy to Script/Scripts</name>
  <files>
    app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx
    app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx
    app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts
    app/src/components/physic-paint/view/PhysicsPaintRightSidebar.test.ts
    app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
    app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts
    app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx
    app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx
    app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts
    app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.ts
    app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.test.ts
    app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.tsx
    app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.test.tsx
    app/src/components/physic-paint/PhysicsPaintStudio.tsx
    app/src/components/physic-paint/PhysicsPaintStudio.test.ts
    app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
    app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts
    app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts
    app/src/components/physic-paint/hooks/useRotoScriptLibraryController.ts
    app/src/components/timeline/TimelineRenderer.test.ts
  </files>
  <behavior>
    - No user-visible string in the Physic Paint Roto script UI contains Action/Actions.
    - Code identifiers, types, file names, CSS classes, data attributes, data-testid values, and comments keep their current names.
    - Tests pinning the renamed visible strings are updated; test descriptions may keep their current prose.
    - Reveal/Motion/Static wording is untouched.
  </behavior>
  <action>
    Rename only string literals rendered or announced to the user. Apply these exact replacements (grammar-aware), then grep the module for any remaining user-visible occurrence.

    A. `PhysicsPaintRightPanel.tsx`: lower tab label `Actions` -> `Scripts`.

    B. `PhysicsPaintWorkflowStrip.tsx`:
       - toolbox section heading `Actions` -> `Scripts`;
       - toolbox tooltip `Open timeline tools — Playback fps, Key Spacing and Actions.` -> `Open timeline tools — Playback fps, Key Spacing and Scripts.`;
       - `Apply Action to Frame` -> `Apply Script to Frame` (aria-label and tooltip);
       - `Clear Action Buffer` -> `Clear Script Buffer`;
       - `Clear Action from buffer` -> `Clear Script from buffer`.

    C. `PhysicsPaintScriptsPanel.tsx`:
       - `Select a project Action first.` -> `Select a project script first.`;
       - `Source Action` -> `Source Script`;
       - `Project Actions` -> `Project Scripts`;
       - toolbar aria-label `Actions` -> `Scripts`;
       - `Save Action` -> `Save Script` (label and title prefix);
       - `Create a Motion or Static Rail from the selected Action` -> `Create a Motion or Static Rail from the selected Script`;
       - `Delete Action` -> `Delete Script`; `Remove the selected project Action` -> `Remove the selected project script`;
       - `Refresh Actions` -> `Refresh Scripts`; `Scan the project Actions folder` -> `Scan the project scripts folder`;
       - `Copy Action` -> `Copy Script` (aria-label and visible text);
       - `Saved Roto Actions` -> `Saved Roto Scripts`;
       - `No project Actions yet.` -> `No project scripts yet.`;
       - `Save the current real Roto frame as an Action to create a Rail.` -> `Save the current real Roto frame as a Script to create a Rail.`;
       - `No Actions from this layer.` -> `No Scripts from this layer.`;
       - `Every project Action is still available under All.` -> `Every project script is still available under All.`;
       - `Show all Actions` -> `Show all Scripts`;
       - `This Action is referenced by ...` -> `This Script is referenced by ...`;
       - `Delete the Action but keep ...` -> `Delete the Script but keep ...`;
       - `Delete Action and Rails` -> `Delete Script and Rails` (aria-label and strong label);
       - `Delete the Action and all ...` -> `Delete the Script and all ...`;
       - `This removes the project Action file ...` -> `This removes the project script file ...`;
       - `Delete Action` (confirmation button) -> `Delete Script`.

    D. `physicsPaintLoopClipPresentation.ts`: `Source Action` -> `Source Script` (both occurrences, including `Source Action unavailable`), `Synchronized with Action.` -> `Synchronized with Script.`, `Modified locally — Regenerate to restore from Action.` -> `Modified locally — Regenerate to restore from Script.`, `Action detached.` -> `Script detached.`, `Regenerate unavailable — Action detached.` -> `Regenerate unavailable — Script detached.`, `Regenerate unavailable — Source Action unavailable.` -> `Regenerate unavailable — Source Script unavailable.`, `Already synchronized with Action.` -> `Already synchronized with Script.`, `Linked to selected Action ...` -> `Linked to selected Script ...` (both helpers).
    E. `PhysicsPaintLoopClipRail.tsx`: `Linked to selected Action ...` -> `Linked to selected Script ...`.

    F. `PhysicsPaintPlayScriptDialog.tsx`: `saved Action` -> `saved Script`; `Synchronized with Action.` -> `Synchronized with Script.`.

    G. `roto/physicsPaintRotoPlayScriptController.ts`: every user-facing status/disabled/rejection message containing Action -> Script (`Already synchronized with Action.`, `Regenerate unavailable — Action detached.`, `Regenerate unavailable — Source Action unavailable.` (all call sites), `Regenerate rejected — saved Action changed.` (all call sites), `Rebuilds the saved Action source cycle ...` (both variants)).

    H. `roto/physicsPaintRotoScriptLibrary.ts`: every user-facing error/recovery message containing Action -> Script (`Action has no attached Groups.`, `Action or physical authority changed during preflight.`, `Referenced Action candidate was rejected: ...`, `Action or Rail references changed. ...`, `Recovery is required before another Action change. Accepted Actions and Groups remain unchanged.`, `Couldn’t delete this Action. ...`, `Recover the pending Action change before starting another operation.`, `Finish the current Action operation.`, `Action transaction recovery failed.`, `Action references changed. ...`, `Committed Action settlement port is unavailable.`, `Committed Action settlement requires recovery.`).
    I. `hooks/useRotoScriptLibraryController.ts`: `Committed Action settlement failed: ...`, `Prepared Action recovery failed.`, `Committed Action recovery failed.`, `Committed Action history settlement failed: ...` -> Script equivalents.

    J. `PhysicsPaintStudio.tsx` (~6189): `The Action is kept.` -> `The Script is kept.`.

    K. `PhysicsPaintStudioView.tsx`: `Applying Action — ... brushes` -> `Applying Script — ... brushes`.

    L. Tests: update every pin to the new copy — `PhysicsPaintScriptsPanel.test.ts` (including the three `Finish the current Action operation.` / `Recover the pending Action change ...` rows and the `Action or Rail references changed. ...` row), `PhysicsPaintRightSidebar.test.ts` (tab order `Actions` -> `Scripts` and the toolbar labels), `PhysicsPaintWorkflowStrip.test.ts`, `PhysicsPaintPlayScriptDialog.test.ts`, `physicsPaintLoopClipPresentation.test.ts`, `PhysicsPaintLoopClipRail.test.tsx`, `PhysicsPaintStudio.test.ts`, `physicsPaintRotoPlayScriptController.test.ts`, `TimelineRenderer.test.ts`. Do not rename test descriptions or identifiers.
  </action>
  <verify>
    <automated>pnpm --dir app exec vitest run src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts src/components/physic-paint/view/PhysicsPaintRightSidebar.test.ts src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts src/components/physic-paint/view/physicsPaintLoopClipPresentation.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts src/components/timeline/TimelineRenderer.test.ts</automated>
    <automated>test "$(grep -rnE 'Save Action|Delete Action|Refresh Actions|Copy Action|Saved Roto Actions|Project Actions|Source Action|Apply Action to Frame|Clear Action Buffer|Clear Action from buffer|Show all Actions|Synchronized with Action|Action detached|No project Actions yet|No Actions from this layer|This Action is referenced|Delete the Action|project Action file|selected project Action|project Actions folder|Applying Action' app/src/components/physic-paint app/src/components/timeline --include='*.ts' --include='*.tsx' | wc -l | tr -d ' ')" -eq 0</automated>
    <automated>! grep -q '>Actions<' app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx</automated>
    <automated>grep -q '>Scripts<' app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx</automated>
    <automated>pnpm --dir app typecheck > /tmp/cfn-typecheck-task3.txt 2>&1; test "$(grep -c 'error TS' /tmp/cfn-typecheck-task3.txt)" -le "$(grep -c 'error TS' /tmp/cfn-typecheck-baseline.txt)"</automated>
  </verify>
  <done>
    The sidebar lower tab reads Scripts, the toolbox section reads Scripts, and every visible label/aria-label/title/tooltip/dialog/status/error/recovery message in the Roto script UI reads Script/Scripts. Code identifiers, class names, data attributes, and test ids are unchanged. All updated test pins pass and typecheck shows no new errors versus the baseline.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| none added | This quick changes local Studio UI/state behavior only: no network, IPC, file-format, persistence, auth, or new input boundary is introduced. Existing physical-edit validation and the promotion failure path are unchanged. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261022-cfn-01 | Tampering | auto-paint promotion base selection | low | mitigate | Base selection reuses the already-audited + Key resolver; payload bytes come only from cached real-key frames or durable real-key records, never from the displayed interpolated pixels; unavailable bytes fail closed before dispatch. |
| T-261022-cfn-SC | Tampering | npm/pip/cargo installs | high | mitigate | No new dependencies are added by this plan. If an executor proposes one, stop and require a package-legitimacy checkpoint. |
</threat_model>

<verification>
Automated gates (cwd = repo root; vitest run only):
- `pnpm --dir app exec vitest run src/components/physic-paint/roto/physicsPaintRotoPreviousKeyBase.test.ts src/components/physic-paint/hooks/useRotoKeyUtilities.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts` — resolver + + Key + promotion pins (Task 1).
- `pnpm --dir app exec vitest run src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts src/components/physic-paint/view/PhysicsPaintStudioView.test.ts src/components/physic-paint/view/PhysicsPaintRightSidebar.test.ts src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts` — + Rail removal and the surviving Create Rail flow (Task 2).
- `pnpm --dir app exec vitest run src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts src/components/physic-paint/view/physicsPaintLoopClipPresentation.test.ts src/components/timeline/TimelineRenderer.test.ts` — rename pins (Task 3).
- `pnpm --dir app exec vitest run` — full app suite green at the end.
- `pnpm --dir app typecheck` — comparative gate against `/tmp/cfn-typecheck-baseline.txt` (16 errors at HEAD ef934988, measured 2026-10-22). No new error file may appear.
- Zero gate: `Create rail`, `Rail kind`, `physics-paint-rail-create`, `onCreateRotoKeyRail`, `onCreatePlayScriptRail`, `onCreateRevealRail`, `scriptPickerIntent`, `PhysicsPaintScriptPickerDialog` across `app/src`.
- Zero gate: the curated visible-Action alternation across `app/src/components/physic-paint` and `app/src/components/timeline`.
- Exactly one `aria-label="Add key"` in the strip; one `>Scripts<` tab label in the right panel.

Notes on evidence quality:
- Unit tests cannot prove live painting behavior. Tauri/WKWebView paint capture, cache merge, and rail derivation are proven only by the live UAT rows below; until they pass, report the work as automated-ready, never "done".

Required live UAT rows (user-run; report action / expected / observed / pass-fail):
1. Timeline with real keys at frames 1 and 5; auto-paint on empty frame 7 -> the new key joins the previous rail, contains only the new stroke (blank base), and frame 6 becomes interpolated.
2. + Key on empty frame 7 -> joins the rail and clones key 5's paint (unchanged behavior).
3. + Key on interpolated frame 3 -> joins the rail and clones key 1's paint (unchanged behavior).
4. Auto-paint on interpolated frame 3 -> joins the rail; the created key equals key 1's paint plus the new stroke.
5. Timeline action row has no + Rail button and no dropdown; the + Key button still creates/joins keys.
6. Sidebar bottom tab reads Scripts; visible Action references read Script/Scripts; Motion/Static/Reveal remain reachable from the Scripts tab's Create Rail flow (dialog tabs).
</verification>

<success_criteria>
- Auto-paint on a generated frame clones + joins when a previous real key exists, fails closed when its bytes are unavailable, and uses blank + new rail only when no previous key exists; auto-paint on an empty frame starts blank + joins when a previous key exists.
- + Key behavior is byte-for-byte unchanged and both call sites share one resolver.
- The timeline has no + Rail button/dropdown; its props, Studio handler, picker intent/dialog, CSS, and tests are deleted with zero remaining references; Motion/Static/Reveal stay reachable from the Scripts tab.
- Every visible Action/Actions string in the Physic Paint Roto script UI reads Script/Scripts; identifiers and test ids are unchanged.
- The focused suites, the full app suite, and the comparative typecheck gate pass; all six live UAT rows are reported with observed results.
</success_criteria>

<output>
Create `.planning/quick/261022-cfn-key-creation-new-behaviour-1-auto-paint-/261022-cfn-SUMMARY.md` when done, including:
- what changed per task and the atomic commits;
- the automated gate results (focused suites, full suite, typecheck baseline vs after);
- the promotion base-kind and rail-join evidence, the removed-picker zero-grep evidence, and the rename inventory;
- the six live UAT rows with observed results and the explicit automated-ready vs live-passed status.
</output>
