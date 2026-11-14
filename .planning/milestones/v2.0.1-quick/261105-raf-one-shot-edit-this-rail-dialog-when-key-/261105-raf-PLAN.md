---
phase: 261105-raf-one-shot-edit-this-rail-dialog-when-key-
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/physic-paint/hooks/useRotoTimelineActions.ts
  - app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintRailConversionDialog.tsx
  - app/src/components/physic-paint/view/PhysicsPaintRailConversionDialog.test.tsx
  - app/src/components/physic-paint/view/PhysicsPaintRailConversionDialog.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx
  - app/src/components/physic-paint/physicsPaintStudio.css
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
autonomous: true
requirements: [QUICK-261105-RAF]
user_setup: []

estimate:
  tokens: 36000
  raw_tokens: 36000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "+ Key or a paint promotion on an empty frame strictly AFTER a scripted Motion, Static or Reveal rail opens exactly ONE floating `Edit this rail?` prompt before anything is committed; `Convert to Standard` then commits today's unmodified 261105-p9i dissolve (clip removed, every source key plus the new key joined, one undo)."
    - "`New rail` leaves the scripted rail and its Loop Clip completely untouched and commits the same edit as a detached key at the destination frame — exactly the `dissolveTarget = null` path, with the painted payload intact and one undo that removes only the new key."
    - "Escape and the header close resolve `New rail` (the non-destructive choice); the primary `Convert to Standard` button is focused on open; there is no backdrop, no focus trap and no third button."
    - "The prompt never appears for a Standard rail's post-end dissolve, an in-rail 58 insert, an overridden or otherwise fail-closed rail, `forceNewSegment` (Create rail → Key), or a destination with no qualifying scripted rail; those keep today's behaviour byte-identically."
    - "At most one conversion is pending: a second dissolve-triggering edit while the prompt is open is refused with a status message, never a second prompt and never a silent commit."
    - "No persisted schema, parser, serializer or resolver change; the pending conversion is transient in-memory UI state (signals + one deferred promise, no timers, no polling), and both existing addEmptyKey call sites stay unchanged."
    - "The prompt copy names the real rail kind: `This Motion rail…` / `This Static rail…` / `This Reveal rail…`."
  artifacts:
    - path: "app/src/components/physic-paint/hooks/useRotoTimelineActions.ts"
      provides: "the rail-conversion state machine (request signal + answer resolver + deferred promise), the prompt gate inside addEmptyKey, and the `railConversionDialog` return bundle"
    - path: "app/src/components/physic-paint/view/PhysicsPaintRailConversionDialog.tsx"
      provides: "the one-shot floating confirmation component (title, rail-kind copy, Convert to Standard / New rail, X/Escape → New rail)"
    - path: "app/src/components/physic-paint/physicsPaintStudio.css"
      provides: "the compact dialog surface styles reusing the Play Script `--ps-*` token shell"
    - path: "app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx"
      provides: "the render site beside the Play Script dialog, riding the existing picker step-aside"
    - path: "app/src/components/physic-paint/PhysicsPaintStudio.tsx"
      provides: "the pass-through of `rotoTimelineActions.railConversionDialog` into the view model"
    - path: "app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts"
      provides: "convert/new-rail dispatch pins per rail kind, the never-prompts matrix and the one-pending-conversion refusal pin"
    - path: "app/src/components/physic-paint/view/PhysicsPaintRailConversionDialog.test.tsx"
      provides: "dialog-level copy, label, button-route and Escape/close pins (collected through the `.test.ts` launcher)"
    - path: "app/src/components/physic-paint/view/PhysicsPaintRailConversionDialog.test.ts"
      provides: "import-only launcher so the repo's `.test.ts`-only vitest collection runs the dialog test"
  key_links:
    - "addEmptyKey -> classifyLoopClipRailKind(dissolveClip): the prompt gate is the existing dissolve target AND a non-Standard kind; Standard rails keep the silent p9i dissolve."
    - "addEmptyKey -> requestRailConversion -> dialog signal -> answer -> joinedByDissolve: the dispatch fields (`dissolveRailGroupId`, `startsNewSegment`, `joinsPreviousRail`) derive ONLY from the chosen answer, so `New rail` reproduces the null-dissolve path exactly."
    - "physicalKeyUtilities.addEmptyKey -> both call sites (paint promotion PhysicsPaintStudio.tsx:3313, +Key useRotoKeyUtilities.ts:434): unchanged signatures; the wait happens inside addEmptyKey."
    - "runPhysicalAction re-reads records/interpolation/capacity/clips and re-resolves the intent, so a stale clip or changed launch after the answer fails closed with no partial write."
---

<objective>
Make the v2.0.1 post-rail dissolve an explicit one-shot choice instead of a silent conversion. A `+ Key` or a paint promotion on an empty frame strictly after a SCRIPTED Motion, Static or Reveal rail must first show a compact floating `Edit this rail?` prompt: `Convert to Standard` keeps the shipped 261105-p9i dissolve, `New rail` keeps the scripted rail and its Loop Clip intact and lands the same edit as a detached key. At most one prompt is pending at a time.

Purpose: quick 261105-p9i widened the dissolve to every canonical lifecycle rail and disclosed that the rail's script/reveal effect is discarded with the clip. That consequence is correct but today it happens with no warning. The decision point is already centralized in `addEmptyKey`, so the fix is a deferred-promise gate around the existing dissolve decision — no resolver, schema, serializer or call-site change.

Output: a `railConversionDialog` bundle exposed by `useRotoTimelineActions` (request signal + answer resolver), the `addEmptyKey` gate implementing Convert/New rail and the one-pending refusal, `PhysicsPaintRailConversionDialog.tsx` plus its CSS and Studio render site, and a pin matrix covering Convert/New rail per rail kind and every never-prompts case.

Scope note: the dissolve predicate (`resolvePhysicPaintRotoRailDissolveTarget`) and the 58 in-rail insert precedence are NOT touched. No new rail kind, no new Loop Clip, no persisted field, no undo granularity change. Project rule: live behaviour change first, then pins (no RED-first cycle); `workflow.tdd_mode` stays on globally. Preact rules: `@preact/signals` only, no `useState`, no render-body signal writes, no `useEffect` for selection. Vitest collects only `.test.ts`, so the dialog test is reached through an import-only launcher.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/quick/261105-p9i-extend-rail-with-key-or-paint-inside-mot/261105-p9i-SUMMARY.md
@.planning/STATE.md
@/Users/lmarques/Dev/efx-motion-editor/CLAUDE.md

Anchors verified at HEAD fc8143f1c:
- `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts`
  - `addEmptyKey` 2462-2562; dissolve target 2536-2542; dispatch fields 2543-2557 (`joinedByDissolve` drives `startsNewSegment` and `joinsPreviousRail`; `dissolveTarget?.loopId ?? null` is the dissolve id). `loopClips` is already in scope (2494).
  - `classifyLoopClipRailKind` already imported (60) from `../view/physicsPaintWorkflowPresentation`; `signal`/`computed`/`ReadonlySignal` already imported (2).
  - Hook input interface `RotoTimelineActionsInput` 1519; `runPhysicalAction` 2008-2080 (re-reads records/clips and re-resolves before dispatch); return object 3560-3620 (`physicalActions`, `physicalKeyUtilities`).
  - `useMemo` is already used for stable holders (`forceSpacingInput` 1923); `input.pendingOperationId` is the one busy authority (1995, guarded by `runPhysicalAction` at 2007).
- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts` 4807-4812: `resolvePhysicPaintRotoRailDissolveTarget` returns only `{ loopId }` for a complete canonical lifecycle clip — Standard merged rails DO qualify today, so the prompt must exclude them explicitly via `classifyLoopClipRailKind(clip) === 'standard'`.
- `app/src/components/physic-paint/view/physicsPaintWorkflowPresentation.ts` 29-51: `RotoRailKind = 'playscript' | 'reveal' | 'standard'`; a scripted Motion/Static clip classifies `playscript` (provenance trio present), a Reveal clip classifies `reveal`, a provenance-free clip classifies `standard`.
- Call sites (do not change): paint promotion `app/src/components/physic-paint/PhysicsPaintStudio.tsx:3313` (`await` inside `startRotoPaintPromotion`, stroke captured after the key lands); `+ Key` `app/src/components/physic-paint/hooks/useRotoKeyUtilities.ts:434` (`void … .catch().finally()`); Create rail → Key `PhysicsPaintStudio.tsx:5078` with `{ forceNewSegment: true }`.
- Dialog language references: `app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx` (root class, header drag, Escape/Enter handling, no backdrop) and `PhysicsPaintPhotoReferenceDialog.tsx` (movable, no backdrop, no focus trap). CSS shell `.physics-paint-play-script-dialog` at `app/src/components/physic-paint/physicsPaintStudio.css:2430` defines the `--ps-*` tokens inherited by descendants.
- View plumbing: `PhysicsPaintStudioView.tsx` props 362-395 (`playScriptDialog` 377), render site 494; `PhysicsPaintStudio.tsx` dialog bundle 7259-7266, view model input 10972-10984.
- Test anchors: `useRotoTimelineActions.test.ts` dissolve describe 1476-1800 (Standard pins must stay silent; scripted Motion 1658, scripted Static 1683, Reveal 1709, `forceNewSegment` 1646, overridden 1729+); harness 126-185 mocks only `useCallback`/`useMemo`; fixtures `standardRail` 1477, `sourceRecords` 1490. Dialog test harness pattern: `view/PhysicsPaintPlayScriptDialog.test.ts` (node environment, mocked `preact/hooks`, `walk`/`findAll` tree helpers). `.test.ts` launcher pattern: `view/AquarelleParamsPanel.test.tsx.test.ts`.

Project skills: `efx-preact-reactivity` applies to the new component and the hook changes (signals only, no render-body writes, stable effect deps, no `useState`). `developing-preact` for the component shape.

Gates: `pnpm --filter efx-motion-editor exec vitest run <file>` (never watch mode) and `pnpm --filter efx-motion-editor run typecheck`. Never start the server; never add test config.
</context>

<tasks>

<task type="tracer">
  <name>Task 1: A post-rail edit asks once and commits the chosen branch end-to-end (hook state machine + deferred promise + dispatch)</name>
  <files>app/src/components/physic-paint/hooks/useRotoTimelineActions.ts, app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts</files>
  <behavior>
    - `useRotoTimelineActions` returns an additive `railConversionDialog` bundle `{ request, answer }`: `request` is a `ReadonlySignal<RotoRailConversionRequest | null>` where the request is `{ railKind: 'motion' | 'static' | 'reveal' }`; `answer(choice)` resolves the pending deferred promise and clears the request signal. `answer` with no pending request is a no-op.
    - `addEmptyKey(8, payload)` over a scripted Motion rail (scripted fixture, destination 8) sets `request.value` to `{ railKind: 'motion' }` synchronously and does not dispatch. `answer('convert')` → the call resolves `true` and dispatches the unchanged p9i dissolve: `intent.dissolveRailGroupId === 'rail-1'`, `railInsertGroupId` undefined, `destinationAppFrame` 8, `proposal.nextLoopClips === []`, mapping k1/k3/k5 at 1/3/5, selected key at 8, `nextIncomingInterpolationBreakKeyIds === null`.
    - The same fixture with `answer('new-rail')` → resolves `true`, dispatches NO dissolve id and NO rail-insert id, the proposal keeps the clip (`nextLoopClips` unchanged), and the new key owns its incoming break (same shape as the `forceNewSegment` pin). This is exactly the `dissolveTarget = null` path.
    - Standard-rail post-end dissolves (fixtures without the provenance trio) never set `request.value` and keep today's silent dissolve; `forceNewSegment` and in-rail destinations never set it either.
    - While a request is pending, a second `addEmptyKey` that would dissolve resolves `false`, publishes the refusal status, dispatches nothing, and leaves the first request pending; answering the first still dispatches exactly once.
    - No timers, no polling, no `useState`, no render-body writes; the deferred resolver lives in a `useMemo` holder so the existing `preact/hooks` mock in the hook test needs no change.
  </behavior>
  <action>
Implement the hook state machine first, then update the pins that the new gate makes hang.

Types (export from `useRotoTimelineActions.ts`, near the other exported types around line 90): `RotoRailConversionChoice = 'convert' | 'new-rail'`; `RotoRailConversionRailKind = 'motion' | 'static' | 'reveal'`; `RotoRailConversionRequest` as a frozen `{ readonly railKind }`; and `RotoRailConversionDialogBundle` as `{ readonly request: ReadonlySignal<RotoRailConversionRequest | null>; readonly answer: (choice: RotoRailConversionChoice) => void }`.

Inside `useRotoTimelineActions` (after `forceSpacingInput`, ~1923): create ONE `useMemo(() => ({ request: signal<...>(null), resolve: null as ((choice: RotoRailConversionChoice) => void) | null }), [])` holder — no `useRef` (the hook test mocks only `useCallback`/`useMemo`). Add `requestRailConversion(railKind)` (useCallback): when `holder.resolve !== null` return `null` (refused, no second prompt); otherwise build a `new Promise<RotoRailConversionChoice>` that stores its `resolve` in the holder, set `holder.request.value` to a frozen `{ railKind }` request, and return the promise. Add `answerRailConversion(choice)` (useCallback): read and clear the holder's resolver BEFORE resolving, set `holder.request.value` to null, then call the resolver; when there is no resolver do nothing. Memoize the returned bundle as `railConversionDialog = useMemo(() => ({ request: holder.request, answer: answerRailConversion }), [holder, answerRailConversion])` and add it to the hook's return object (3560-3620) next to `physicalKeyUtilities`.

In `addEmptyKey` (2462-2562): keep the existing `dissolveTarget` computation untouched. Immediately after it, look the clip up by `dissolveTarget.loopId` in the same `loopClips` array and derive the prompt rail kind: `classifyLoopClipRailKind(clip)` yields `reveal` → `'reveal'`; `playscript` with `clip.mode === 'static'` → `'static'`; `playscript` otherwise → `'motion'`; `standard` (or a null lookup) → no prompt. This is the locked gate: the prompt trigger is `dissolveTarget !== null` AND a non-Standard kind, so Standard rail edits keep today's silent dissolve. Add a comment citing quick 261105-raf and the locked decisions (prompt only for script-generated rails; New rail is the non-destructive Escape/close default).

When a prompt kind exists: if `input.pendingOperationId?.value !== null`, publish `'A Roto physical edit is already in flight.'` and return `false` without prompting (mirror `runPhysicalAction`'s busy guard so the user is never asked and then rejected). Otherwise call `requestRailConversion(kind)`; when it returns `null`, publish `'Resolve the Rail edit prompt first.'` and return `false`; otherwise `await` it and set `joinedByDissolve = (choice === 'convert')`. With no prompt kind, `joinedByDissolve` stays false. Leave the existing dispatch expression unchanged: it already derives `startsNewSegment`, `joinsPreviousRail` and the dissolve id from `joinedByDissolve`, so `new-rail` reproduces the null-dissolve path byte-for-byte and `convert` reproduces the p9i dissolve. Keep `addEmptyKey` returning `Promise<boolean>` and add `requestRailConversion` to its dependency array. Do NOT change `useRotoKeyUtilities.ts`, either Studio call site, the resolver, or the `RotoPhysicalKeyUtilityPort` type.

Then update `useRotoTimelineActions.test.ts` so the suite is green: the three scripted pins at 1658 (scripted Motion), 1683 (scripted Static) and 1709 (Reveal) now hang, so each must capture the pending promise, assert `actions.railConversionDialog.request.value` equals the expected `{ railKind }`, call `actions.railConversionDialog.answer('convert')` and then await the promise before the existing dispatch assertions. Add one scripted Motion `'new-rail'` twin next to the Motion pin with the detached-key assertions from `<behavior>` (no dissolve id, no rail-insert id, clip kept, new key owns the incoming break). Add the re-entrancy pin and the `answer`-with-no-request no-op pin. Extend the existing `forceNewSegment` (1646) and in-rail (1625-ish) pins with a `expect(actions.railConversionDialog.request.value).toBeNull()` assertion; do not change their dispatch assertions. Standard dissolve pins (1500-1615) must run unchanged — if any of them needs an answer, the gate is wrong: stop and fix the gate, not the pin.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/hooks/useRotoTimelineActions.test.ts</automated>
    <automated>pnpm --filter efx-motion-editor run typecheck</automated>
  </verify>
  <done>A scripted Motion post-end `addEmptyKey` exposes one pending request, `answer('convert')` dispatches the unchanged dissolve, `answer('new-rail')` dispatches the untouched-rail detached key, Standard/forceNewSegment/in-rail destinations never prompt, a second dissolve-triggering edit is refused with a status message, and the hook suite plus typecheck pass.</done>
  <reversibility rating="reversible">The gate wraps an existing decision with an in-memory deferred promise; every dispatch field keeps its existing meaning, no persisted state or resolver path changes, and reverting restores the silent dissolve.</reversibility>
</task>

<task type="auto">
  <name>Task 2: The one-shot `Edit this rail?` dialog, its styles and the Studio render site</name>
  <files>app/src/components/physic-paint/view/PhysicsPaintRailConversionDialog.tsx, app/src/components/physic-paint/physicsPaintStudio.css, app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx, app/src/components/physic-paint/PhysicsPaintStudio.tsx</files>
  <behavior>
    - `PhysicsPaintRailConversionDialog` accepts `{ request: ReadonlySignal<RotoRailConversionRequest | null> } & { answer: (choice) => void }` (the hook's `RotoRailConversionDialogBundle`) and renders nothing when the request is null.
    - When a request exists it renders a compact floating card with title `Edit this rail?`, a header close X, and the locked body copy: `This Motion rail is script-generated. Convert it to Standard to keep your edit — Regenerate will no longer rebuild it.` — with the label `Motion`, `Static` or `Reveal` from `railKind`.
    - Footer order and default: secondary ghost `New rail`, primary `Convert to Standard` focused on open; no third button.
    - Clicking the primary answers `convert`; clicking `New rail`, the header X, or pressing Escape answers `new-rail`. The root stops keydown propagation like the Play Script dialog so Studio shortcuts do not fire from the dialog.
    - No dimming backdrop, no full-screen pointer blocker and no focus trap: the viewport root is `pointer-events: none` and only the surface is `pointer-events: auto`, so the rest of the Studio stays interactive (same shell as `PhysicsPaintPlayScriptDialog`).
    - The Studio passes `rotoTimelineActions.railConversionDialog` into the view model and the view renders the dialog beside the Play Script dialog, riding the existing picker step-aside (`!pickerOpen`), so a gallery picker never fights it for space.
  </behavior>
  <action>
Create `app/src/components/physic-paint/view/PhysicsPaintRailConversionDialog.tsx`. Import `useEffect, useRef` from `preact/hooks`, `X` from `lucide-preact`, and `import type { RotoRailConversionChoice, RotoRailConversionDialogBundle } from '../hooks/useRotoTimelineActions'` (type-only, no runtime cycle). Read `props.request.value` in the render body, keep the primary button ref, and focus it in a `useEffect` keyed on the request value when non-null (never write signals in the render body; no `useState`). Map `railKind` to `Motion`/`Static`/`Reveal` and render the locked copy verbatim. Root: `class="physics-paint-play-script-dialog physics-paint-rail-conversion-dialog"`, `role="dialog"`, `aria-labelledby` pointing at the title; `onKeyDown` stops propagation, then Escape → `props.answer('new-rail')` (preventDefault). Surface: `class="physics-paint-rail-conversion-surface"`; header with a title id and the close X button (label `Close`, pointer-down stops propagation, click → `new-rail`); body paragraph; footer `actions` with the two buttons using the existing `physics-paint-play-script-button` / `-ghost` / `-primary` classes. Include a short doc comment stating: one-shot decision for quick 261105-raf, Escape/close is the non-destructive choice, no backdrop/focus trap, signals-only.

Append a new CSS section at the end of `app/src/components/physic-paint/physicsPaintStudio.css` (do not rewrite the existing Play Script block): a comment header naming quick 261105-raf, then `.physics-paint-rail-conversion-surface` (flex column, `box-sizing: border-box`, `width: 420px`, `max-width: 94%`, `height: auto`, `border: 1px solid var(--ps-divider)`, `border-radius: 14px`, `background: var(--ps-shell)`, the same soft shadow as the Play Script surface, `overflow: hidden`, `pointer-events: auto`), plus compact header/body/footer rules that consume the inherited `--ps-*` tokens (`--ps-fg`, `--ps-muted`, `--ps-divider`, `--ps-radius`). Reuse the existing `physics-paint-play-script-*` button classes for the actions — do not redefine them.

Wire the view: in `app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx` import the component, add `railConversionDialog?: RotoRailConversionDialogBundle | null` to `PhysicsPaintStudioViewProps` next to `playScriptDialog` (line 377, keep it optional so existing fixtures stay valid), destructure it at 407, and render `{railConversionDialog && !pickerOpen ? <PhysicsPaintRailConversionDialog {...railConversionDialog} /> : null}` immediately after the Play Script dialog at 494. In `app/src/components/physic-paint/PhysicsPaintStudio.tsx`, read `const railConversionDialog = rotoTimelineActions.railConversionDialog;` beside the `playScriptDialog` bundle (~7266) and pass it into the `usePhysicsPaintStudioViewModel` input beside `playScriptDialog` (~10978). Do not touch either `addEmptyKey` call site, `useRotoKeyUtilities.ts`, or the hook.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor run typecheck</automated>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PhysicsPaintStudioView.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts</automated>
  </verify>
  <done>The dialog component renders the locked title/copy/buttons from a request signal, routes Convert to Standard / New rail / X / Escape correctly with the primary focused, the Studio view renders it beside the Play Script dialog with the picker step-aside, and typecheck plus the view/Studio suites pass.</done>
  <reversibility rating="reversible">A new presentation component plus an additive optional view prop; removing the render site restores the previous Studio surface and the hook gate keeps working headlessly.</reversibility>
</task>

<task type="auto">
  <name>Task 3: Pin the full Convert/New rail matrix per rail kind, the never-prompts cases and the dialog surface</name>
  <files>app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts, app/src/components/physic-paint/view/PhysicsPaintRailConversionDialog.test.tsx, app/src/components/physic-paint/view/PhysicsPaintRailConversionDialog.test.ts, app/src/components/physic-paint/PhysicsPaintStudio.test.ts</files>
  <behavior>
    - Hook pins per rail kind: scripted Motion (`progressive`), scripted Static (`mode: 'static'`) and Reveal (`railKind: 'reveal'`) each expose `{ railKind: 'motion' | 'static' | 'reveal' }`, and each has BOTH an `answer('convert')` pin (p9i dissolve shape) and an `answer('new-rail')` pin (clip untouched, no dissolve id, no rail-insert id, new key owns its incoming break). Task 1 supplies the Motion pair; Task 3 adds the Static and Reveal pairs.
    - Never-prompts matrix: the Standard post-end dissolve pins, the 58 in-rail insert pin, the overridden scripted/Reveal fail-closed pins, the `forceNewSegment` pin, and an ordinary detached destination all keep `request.value === null` from call to resolution.
    - Re-entrancy pin (kept/extended from Task 1): two dissolve-triggering calls while pending produce exactly one dispatch and one refusal status; the request stays for the first call; after the answer the signal is null.
    - Dialog pins in a node-environment harness: null request renders nothing; a Motion request renders the title plus the exact body copy and both button labels; a Reveal request substitutes `Reveal`; clicking the primary answers `convert`; clicking `New rail` and the header close answer `new-rail`; Escape answers `new-rail`; the primary is the first/default action and there is no third button.
    - A static Studio pin proves the new dialog is wired (`railConversionDialog` passed through and rendered beside the Play Script dialog) without changing the existing two-call-site addEmptyKey invariant.
  </behavior>
  <action>
In `app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts`, extend the v2.0.1 dissolve describe (1476-1800) with the Static and Reveal convert/new-rail pairs, following the scripted Motion fixtures already used there (provenance trio for Motion/Static; `railKind: 'reveal'` for Reveal) and the assertion shapes from Task 1. Use the pending-promise → assert `request.value` → `answer(...)` → await pattern. Add explicit `request.value === null` assertions to the never-prompts cases listed in `<behavior>` without changing their dispatch assertions. Keep the overridden scripted/Reveal pins byte-identical apart from the null-request assertion. If an existing Standard pin needs an answer, the gate is wrong: fix the gate instead of the pin.

Create `app/src/components/physic-paint/view/PhysicsPaintRailConversionDialog.test.tsx` modelled on `PhysicsPaintPlayScriptDialog.test.ts`: mock `preact/hooks` with a cursor-based `useRef` and a no-op `useEffect`, import the component, use a plain `{ value }` fake for the request signal, walk the returned vnode tree and assert the copy/answers from `<behavior>`. Create the import-only launcher `PhysicsPaintRailConversionDialog.test.ts` with the repo's standard launcher comment and `import './PhysicsPaintRailConversionDialog.test.tsx';` (`.test.tsx` is not collected on its own; do not add test config). Add one static pin to `PhysicsPaintStudio.test.ts` (same static-source style as the existing Play Script dialog pins at ~1034) proving `PhysicsPaintStudio.tsx` passes `railConversionDialog` into the view model and `PhysicsPaintStudioView.tsx` renders `PhysicsPaintRailConversionDialog` beside the Play Script dialog; leave the existing `physicalKeyUtilities.addEmptyKey(` count-2 invariant untouched.

Then run the targeted suites, the full suite and typecheck. Do not modify `physicsPaintRotoPhysicalResolver.ts`, `physicsPaintRotoPhysicalModel.ts`, the intent serializer/parser, or either addEmptyKey call site; if a change there proves necessary, stop and report instead of widening this quick.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/hooks/useRotoTimelineActions.test.ts src/components/physic-paint/view/PhysicsPaintRailConversionDialog.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts</automated>
    <automated>pnpm --filter efx-motion-editor exec vitest run</automated>
    <automated>pnpm --filter efx-motion-editor run typecheck</automated>
    <automated>git diff --quiet -- app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts</automated>
  </verify>
  <done>Every scripted rail kind has Convert and New rail dispatch pins, every never-prompts case is pinned, the one-pending refusal and the dialog copy/route/Escape pins pass, the Studio wiring is pinned, the full suite is green, typecheck is clean, and the resolver plus persisted model show no diff.</done>
  <reversibility rating="reversible">Test-only additions; every pin targets behaviour that already shipped or is documented in this plan, and no production code changes in this task.</reversibility>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| user choice -> physical edit dispatch | A deferred promise decides whether a destructive-looking clip removal is sent; the wrong resolution would silently discard a scripted rail. |
| transient prompt state -> persisted document | The prompt must never become persisted state or leak into the schema/serializer. |
| second edit -> pending conversion | A second dissolve-triggering edit while the prompt is open must not open a second prompt or commit behind it. |
| child edit realm -> canonical parent resolver | The chosen dissolve id still crosses the coordinator; the resolver revalidates it. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261105-RAF-01 | Tampering | `addEmptyKey` choice dispatch | high | mitigate | `dissolveRailGroupId`, `startsNewSegment` and `joinsPreviousRail` derive only from `joinedByDissolve = choice === 'convert'`; the `new-rail` branch resolves to the existing null-dissolve fields, pinned per rail kind. |
| T-261105-RAF-02 | Repudiation | deferred resolver in `useRotoTimelineActions` | medium | mitigate | The resolver is stored in a `useMemo` holder, cleared before it is called, and `request` is cleared in the same step; `answer` with no request is a no-op; only one request can exist, and the hook tests pin the single dispatch and the null-after-answer state. |
| T-261105-RAF-03 | Denial of Service | second dissolve-triggering edit while pending | medium | mitigate | The guard in `addEmptyKey` returns `false` with the refusal status and dispatches nothing; the existing `pendingOperationId` busy check runs before the prompt so a busy coordinator never shows the dialog. |
| T-261105-RAF-04 | Tampering | Standard rail silent dissolve regression | high | mitigate | The prompt gate explicitly excludes `classifyLoopClipRailKind(clip) === 'standard'`; the existing Standard dissolve pins must pass untouched with `request.value === null`. |
| T-261105-RAF-05 | Information Disclosure | rail-kind copy | low | accept | The prompt names only the rail kind already visible in the Studio UI; no document data is added to the surface. |
| T-261105-RAF-SC | Tampering | pnpm dependency installs | high | accept | No dependency is added, upgraded or installed by this plan; the supply-chain surface is unchanged. |
</threat_model>

<verification>
1. Hook surface (prompt gate, convert/new-rail dispatch per rail kind, never-prompts matrix, one-pending refusal): `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/hooks/useRotoTimelineActions.test.ts`
2. Dialog surface (copy, labels, Convert/New rail/X/Escape routing, null request): `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PhysicsPaintRailConversionDialog.test.ts`
3. View/Studio wiring: `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PhysicsPaintStudioView.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts`
4. Full suite: `pnpm --filter efx-motion-editor exec vitest run` must end with 0 failed. Never run watch mode and never start the server.
5. Typecheck: `pnpm --filter efx-motion-editor run typecheck` reports no errors.
6. Untouched-law tripwire: `git diff --quiet -- app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts` exits 0; the 58 in-rail insert, repeat-occurrence mapping, CR-05 append, boundary-law, ordinary Copy/Paste and PlayScript/stacking pins pass with no assertion edits.
7. Call-site invariant: the two `physicalKeyUtilities.addEmptyKey(` occurrences in `PhysicsPaintStudio.tsx` and the one in `useRotoKeyUtilities.ts` are unchanged, and `RotoPhysicalKeyUtilityPort` keeps `addEmptyKey` as `Promise<boolean>`.
8. Picker interaction: the dialog only renders while no gallery picker is open and returns with its pending request intact when the picker closes.

UAT rows the user will run after execution (live visible UAT; automated-green is not done):
- Scripted Motion rail, + Key on an empty frame after its last key: the `Edit this rail?` prompt appears once with the Motion copy; Convert to Standard produces ONE continuous Key Rail and one Undo restores the rail.
- Same document, + Key again and choose New rail: the scripted Motion rail and its Loop Clip are unchanged, a detached key lands on the clicked frame, and one Undo removes only that key.
- Scripted Static rail beyond its end: same prompt with the Static copy; both choices behave as above.
- Reveal rail beyond its end: same prompt with the Reveal copy; Convert removes the reveal clip, New rail keeps it.
- Paint on an empty frame after any of the three rails: the prompt appears on the first stroke and both outcomes behave as above, with the painted stroke preserved on the new key.
- Escape and the header X resolve New rail (rail untouched).
- + Key inside a rail (58 insert), Standard rail post-end edits, Create rail → Key and Copy/Paste on the same empty frame never show the prompt.
- While the prompt is open, a second + Key on another post-rail frame shows the refusal status and no second prompt.
- The rest of the Studio (palette, panels, playhead) stays interactive while the prompt floats.
</verification>

<success_criteria>
- A post-end edit after a scripted Motion, Static or Reveal rail asks exactly once and commits only after the answer; Convert reproduces the untouched 261105-p9i dissolve, New rail reproduces the untouched null-dissolve detached key.
- Both + Key and the paint promotion reach the prompt through the single centralized gate in `addEmptyKey`; neither call site changes, and painted bytes are preserved on the new key.
- Standard rails, in-rail inserts, overridden/fail-closed rails, `forceNewSegment` and non-rail destinations never prompt.
- At most one prompt is pending; further dissolve-triggering edits are refused with a status message and dispatch nothing.
- The dialog is a compact floating surface with no backdrop, no focus trap and no third button; Escape/close is New rail and the primary is focused.
- No persisted schema, parser, serializer, resolver or model change; no new Loop Clip or rail kind; one undo per outcome.
- Targeted suites, full `vitest run` and typecheck are green; three atomic commits, one per task, each green before the next begins.
</success_criteria>

<output>
Create `.planning/quick/261105-raf-one-shot-edit-this-rail-dialog-when-key-/261105-raf-SUMMARY.md` when done. Record the three task commits, the `railConversionDialog` contract (request signal, answer resolver, refused-when-pending status), the prompt gate (`dissolveTarget` AND non-Standard kind), the exact dialog copy and routing, the never-prompts matrix, the untouched-law list (resolver, 58 insert, CR-05 append, boundary law, ordinary paste, call sites), the picker step-aside behaviour, and the UAT rows handed to the user.
</output>
