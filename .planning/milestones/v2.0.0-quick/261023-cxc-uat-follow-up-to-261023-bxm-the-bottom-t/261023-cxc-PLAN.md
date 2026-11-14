---
phase: quick-261023-cxc
plan: 261023-cxc
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts
  - app/src/components/physic-paint/hooks/useRotoKeyUtilities.ts
  - app/src/components/physic-paint/hooks/useRotoKeyUtilities.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
autonomous: true
requirements: []

estimate:
  tokens: 38000
  raw_tokens: 38000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "When the source key has a live brush script (engine strokes) and source+1 is an empty physical cell inside capacity, Duplicate captures the source strokes, navigates to source+1, waits until that frame is the live script source, and applies the captured script through the shared script-apply seam — so the new key at source+1 is selected, painted, on the source's rail, and Move/Select can edit it."
    - "When the source key has a recorded watercolor script, the duplicate also records the source frame's aquarelle payload timeline onto the duplicate's frame with FRESH mutation ids, so Move, Delete, and stack-step act on the duplicate and editing it never mutates the source key."
    - "When source+1 is occupied (real or generated), outside capacity, or no script resolves, the 261023-bxm settle-then-clone duplicate runs unchanged — including its +1 ripple and its fail-closed source-paint settlement."
    - "A failure before the destination is painted (capture, or a navigation that left the playhead on the source) falls back to the bitmap clone in the same click; a failure after navigation publishes an explicit error and never also runs the clone."
    - "User navigation during the sequence aborts the sequence: no key is created at source+1 and an explicit message is shown; the wait is a bounded signal wait, never an ad-hoc sleep or timer loop."
    - "The promoted destination is always the BLANK key the existing promotion seam creates for an empty cell; the script is never painted onto a raster clone, so no double paint is possible."
    - "Rail-set duplicate, the duplicate destination rule (+1 ripple), the resolver/semantic-delta validator/coordinator/parent bridge, the document schema, the package format, and the 261023-bxm module and tests are untouched."
  artifacts:
    - app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.test.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts
    - app/src/components/physic-paint/hooks/useRotoKeyUtilities.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  key_links:
    - "PhysicsPaintStudio keyUtilities input → useRotoKeyUtilities.duplicateKey → input.duplicateWithScript (Studio port) → runRotoDuplicateWithScript → requestDuplicateNavigationRef → rotoNavigation.requestNavigation → waitForRotoDuplicateSourceFrame(rotoScript.source) → applyProvidedScript / applyAquarelleTimeline."
    - "requestDuplicateNavigationRef is late-bound to rotoNavigation.requestNavigation right after the coordinator call — the keyUtilities literal is an argument to that same call and cannot reference its return value."
    - "Watercolor record copy: getAquarelleEventsForFrame(sourceAppFrame) → copyAquarelleScriptToFrame → engine.enqueueRecordedStroke (fresh id, the same allocator handleAquarelleStrokeEnd uses) → recordAquarelleStroke(id, stroke with playFrame = destinationFrame)."
    - "The decision reads physicPaintStore.getRotoPhysicalProjection(...).cells[destination].kind and getRotoPhysicalCapacity, so the script path can only target an empty cell."
---

<objective>
Make the bottom-timeline Duplicate produce an EDITABLE key when the source key carries a script, instead of a raster-only clone that Move/Select cannot touch.

Concrete defect: quick 261023-bxm settles the source key's displayed pixels into the record and lets the physical duplicate clone the raster. The clone renders correctly but has no engine strokes (brush) and no recorded aquarelle timeline (watercolor), so the Move tool and the watercolor selection/stack operations find nothing to edit.

Locked behavior for this quick:

1. DECISION — script duplicate runs only when the source is a real key, the destination (`source.appFrame + 1`) is an `empty` physical cell, the destination is inside capacity, and a script resolves: for the brush module, the live engine holds strokes; for the watercolor module, the source frame has at least one recorded aquarelle stroke event. Anything else → the 261023-bxm settle-then-clone path runs unchanged.
2. CAPTURE — brush: read the live engine's strokes (logical brush groups, cloned). Watercolor: read `getAquarelleEventsForFrame(sourceAppFrame)` (strokes plus the global Dry events, the same replay list Delete/Move use). The user's script clipboard is never written.
3. NAVIGATE + WAIT — navigate to source+1 through the existing navigation coordinator, then wait on the script controller's source signal until that frame is the source the apply seam will accept. The wait is bounded; a third frame (user navigation) aborts.
4. APPLY — reuse the existing script-apply seam: `dispatchApply` for brush (it promotes the empty cell to a blank key, enqueues the captured strokes into the destination engine so the script is in memory and the dest is editable, paints, and publishes) and `applyAquarelleTimeline` for watercolor (aquarelle bake + publish through the same dispatch). Promotion is the existing `prepareTarget` → `promoteRotoPaintTargetRef` path, which gives an EMPTY cell a BLANK base and joins the previous real key's rail — the script paints the blank key once; no raster clone is involved.
5. WATERCOLOR RE-EDITABILITY — after a successful bake, record the source frame's events for the destination frame with fresh mutation ids into the aquarelle payload timeline via `recordAquarelleStroke`. Dry events are sheet actions and stay global (not copied). The source frame's timeline and records are only read.
6. FALLBACK — a pre-navigation failure (no script, occupied/over-capacity destination, capture failure, or navigation that left the playhead on the source) returns `fallback`, and the hook runs the 261023-bxm settle-then-clone in the same click. A post-navigation failure (superseded, timeout, apply failure, record failure) returns `aborted`, publishes an explicit error, and does NOT also clone.
7. ORCHESTRATION — a focused module plus a thin Studio port; no hand-rolled timer loops, no `useState`, no new `useEffect`, no signal writes in a render body, no clipboard side effects, no new dependencies, no schema changes.

Purpose: the user can build motion by duplicating a scripted key one frame forward and immediately moving or editing the duplicate, and the duplicate starts from the script the user actually authored.
Output: a pure decision + bounded wait + orchestration module with tests, two small script-controller additions, a hook port with the bxm behavior preserved as the fallback, the Studio wiring, and a gate report.

Scope: one quick, three tasks. No resolver/validator/coordinator/bridge edits, no rail-set duplicate changes, no persisted per-key script ownership, no Living Script copy, no app/dev-server run.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@CLAUDE.md
@.claude/skills/efx-preact-reactivity/SKILL.md

WIRING CONTRACT (locked — already traced, do not re-derive):

1. Hook — `app/src/components/physic-paint/hooks/useRotoKeyUtilities.ts`
   - `blocked = keyActionInFlight || input.flushInFlight || input.applyStatus === 'applying'` (:174). `keyActionInFlight` is the in-flight gate the sequence must own.
   - `duplicateKey` (quick 261023-bxm) resolves the source record, calls `resolveRotoDuplicateSourcePaint`, then on `ready`/`cook` runs the unchanged `physicalKeyUtilities.duplicateKey(sourceKeyId)` after an optional `bakeRotoKeyPaint`, and fails closed with `ROTO_DUPLICATE_SOURCE_PAINT_UNAVAILABLE_ERROR`.
   - `RotoKeyUtilitiesInput` already carries the 261023-bxm optional ports `resolveDisplayedKeyPaint` and `bakeRotoKeyPaint`. Add one more optional port; keep the module and its tests untouched.
   - The hook test harness (`useRotoKeyUtilities.test.ts`) mocks `preact/hooks`, exposes `createHarness(options)`, `flushAsync()` (setTimeout 0), and the registered `addEmptyKey` spy; the 261023-bxm duplicate suite (`:486-630`) is the regression bar.

2. Script controller — `app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts`
   - `sourceState = signal<RotoScriptSourceSnapshot>(ports.getSource())` (:262); `updateSource` (:1079) updates it only when identity changes; `sameSourceIdentity` compares kind/layer/keyId/appFrame.
   - `dispatchApply(script, source, engine, options?)` (:890): calls `ports.prepareTarget(source)`, requires the promoted/real target to still be the current source (`targetIsCurrent`), then either the aquarelle branch (`ports.applyAquarelleEvents`) or the engine-1 brush burst (enqueues `script.brushes`). It owns `endOperation`.
   - `applyScript` (:727) gates on `availability.canApply` and the clipboard; `applyCurrentScript` (:745) captures the live engine and resets the clipboard-free path with `beginOperation` + `dispatched` flag; mirror `applyCurrentScript` for a provided-script apply.
   - `applyAquarelleTimeline(events)` (:822) re-bakes a recorded timeline for the CURRENT source through `dispatchApply` with `forceAquarelle` — reuse it verbatim for the watercolor duplicate.
   - `prepareNavigation(targetFrame)` (:1090) rejects while `activeApply || busy`; `requestNavigation` calls it before navigating.
   - `normalizeLogicalBrushes(strokes)` is exported (:1224) and is the one engine-strokes → `RecordedStrokeGroup[]` projection (clones points/params).

3. Navigation — `app/src/components/physic-paint/hooks/useRotoNavigationCoordinator.ts`
   - `requestNavigation` (:102) runs `beforeNavigation` (the script controller's `prepareNavigation`), awaits `navigateToSyncedPhysicalFrame`, and always runs `afterNavigation`. It is returned at :125; the keyUtilities literal is an ARGUMENT to the coordinator call, so the port needs a late-bound ref.
   - `PhysicsPaintStudio.navigateToSyncedPhysicalFrame` (:3261) sets the physical selection synchronously, snapshots/flushes live pixels, clears the engine, and ends with `scheduleRotoStartFramePropagation(frame)` — rAF-BATCHED — plus an awaited frame-sync IPC. Therefore the Studio render that calls `rotoScript.updateSource({ appFrame })` lands AFTER `requestNavigation` resolves. That is exactly why the destination wait exists and why it must be bounded (2000 ms is the budget).

4. Studio — `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
   - `rotoScript = useRotoScriptClipboardController({...})` (:1268-1338); the render body calls `rotoScript.updateEngine(engineRef.current)` and `rotoScript.updateSource({ selectionKind, layerId, keyId, appFrame: currentFrame })` (:1339-1345) — the signal the wait observes.
   - `rotoNavigation = useRotoNavigationCoordinator({...})` (:2450-2550); its `keyUtilities` literal (:2462-2526) is where the new port goes; `rotoKeyUtilities = rotoNavigation.keyUtilities` (:2551).
   - `promoteRotoPaintTargetRef` (:2146): for an EMPTY cell builds a BLANK base (`buildBlankRotoFrame`), sets `joinPreviousRail = resolution.kind !== 'blank'` (a previous real key exists → joins the source's rail), dispatches `addEmptyKey`, returns the accepted created key. Only a GENERATED cell clones the previous key's pixels.
   - `prepareRotoScriptTargetRef` (:2372): requires `source.layerId === launch.layerId && source.appFrame === launch.startFrame`; real-key returns the record; empty promotes. `dispatchApply` then re-checks `targetIsCurrent`.
   - `activeModule` is imported (:166) and is the call-time module router (`activeModule.peek()`), used everywhere as `activeModule.value === 'watercolor'`.
   - Watercolor live record precedent `handleAquarelleStrokeEnd` (:4783-4797): `mutationEngine.enqueueRecordedStroke({ primary: aquarelleStrokeToPaintStroke(stroke, { width, height }) })` returns the id, then `recordAquarelleStroke(id, { ...stroke, mutationId: id })`. The destination record copy must use this exact allocation + record pair (the engine id counter stays authoritative; ids never collide).
   - Watercolor publication gating: `canvasCompletedMutationImplRef.current` (:4586) returns early with `if (activeModule.value === 'watercolor') return;`, so engine-1 guide strokes enqueued at the destination can never overwrite the aquarelle bake.
   - `getAquarellePlayFrame` (:5156) reads `launchContextRef.current.startFrame`; handlers read `getAquarelleEventsForFrame(playFrame)` — the recorded timeline IS the watercolor script.
   - Imports already present: `aquarelleStrokeToPaintStroke` (:104), `getAquarelleEventsForFrame`, `recordAquarelleStroke` (:167). `normalizeLogicalBrushes` must be added.

5. Aquarelle records — `app/src/components/physic-paint/view/aquarelleRecordState.ts`
   - `recordAquarelleStroke(mutationId, stroke)` (:560): sets the registry, assigns the creation serial, advances the record clock, projects with `toStudioStroke`, pushes the entry on `payloadTimeline`. It does not mutate any other frame's entries.
   - `getAquarelleEventsForFrame(playFrame)` (:694): the frame's non-deleted stroke events in recording order PLUS every global Dry event.
   - `translateAquarelleStrokeInScript` (:384) replaces objects, never mutates them — the copy helper must follow the same immutable-replacement posture.
   - `toStudioStroke` (`packages/efx-watercolor/src/payload/toStudioStroke.ts:96`) is the event shape: `pts[{x,y,p,tx,ty,tw,tick}]`, `ticks`, `cuisson`, `brushId`, `toolOverrides`, `recordedOrder`, `playFrame`, `color`, `engine` (tool/color/params/brushId/toolOverrides/mutationId/diffusionFrames/timestamp/playFrame).

6. Physical model (read-only for this quick)
   - `physicPaintStore.getRotoPhysicalProjection(layerId, trackId)?.cells[frame]` is `real | generated | empty` (`physicsPaintRotoPhysicalResolver.ts:230-238`), bounded `0 .. capacity-1`; `getRotoPhysicalCapacity` is the capacity (store :4428).
   - `buildDuplicateCandidate` (:1324-1368) hard-codes destination = source+1 with a +1 ripple and a pixel-identical retargeted payload. The script path never reaches it when it runs (dest is empty); the fallback keeps it unchanged.

GUARDRAILS (locked):
- Preact 11 + @preact/signals only. No React patterns. No `useState`, no new `useEffect`, no render-body signal writes (the one existing `updateSource` render call is pre-existing and idempotent). Use `signal`/`effect` and getters; read live values with `.peek()` inside handlers.
- Tests are `.test.ts` only (vitest never collects `.test.tsx`).
- pnpm only. `vitest run` only — never watch.
- No new dependencies; do not touch `app/package.json` or `pnpm-lock.yaml`.
- Do not run the app or the dev server — the user performs live UAT.
- PATH FORM: every path in this body is repo-root-relative; every `<automated>` command assumes cwd at the checkout root.
- Preserve the 261023-bxm module `physicsPaintRotoDuplicateSourcePaint.ts`, its tests, and the settle-then-clone fallback byte-for-byte except for the hook refactor that makes the sequence awaited.
- Line numbers were read at the 2026-10-23 revision; re-anchor with the quoted symbols if they drift.

SCOPE OUT:
- Rail-set duplicate (`hasEffectiveRailSetScope` routing) and the duplicate destination rule / +1 ripple.
- Persisted per-key script ownership, a shared script reference on the duplicate, the Living Script, Loop Clip references.
- The Move tool internals, the script-target preparation seam, the aquarelle selection/stack semantics.
- Any edit to `physicsPaintRotoPhysicalResolver.ts`, `physicsPaintRotoPhysicalModel.ts`, `useRotoPhysicalEditCoordinator.ts`, `physicPaintBridge.ts`, the document schema, or the package format.
- The hardcoded `flushInFlight: false` in the keyUtilities literal.
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: End-to-end brush script duplicate — one free-next-frame path</name>
  <files>app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.ts, app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.test.ts, app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts, app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts, app/src/components/physic-paint/hooks/useRotoKeyUtilities.ts, app/src/components/physic-paint/hooks/useRotoKeyUtilities.test.ts, app/src/components/physic-paint/PhysicsPaintStudio.tsx</files>
  <behavior>
    RED first (write these before the implementation; capture the failures in the SUMMARY):
    - `resolveRotoDuplicateScriptDecision` table: missing/mismatched source → fallback `source-changed`; destination kind `real` or `generated` → fallback `destination-occupied`; `destinationAppFrame >= capacity` → fallback `destination-out-of-capacity`; brush module with 0 engine strokes → fallback `no-script`; brush with strokes → script decision carrying the destination frame and `brush`; watercolor with 0 stroke events → fallback `no-script`; watercolor with events → script decision `watercolor`.
    - `waitForRotoDuplicateSourceFrame`: resolves `ready` immediately when the signal is already at the target; resolves `ready` when the signal later reaches the target; resolves `superseded` when the signal reports any frame other than the origin or the target; resolves `timeout` when neither happens inside the bound (fake timers).
    - `runRotoDuplicateWithScript` with fake ports: fallback decision ⇒ capture/navigate/apply are never called and it returns `fallback`; brush success order is capture → navigate → wait → applyBrushScript exactly once; capture null ⇒ `fallback` and no navigation; navigate false while the source is still the origin ⇒ `fallback`; navigate false after the source moved ⇒ `aborted`; wait `superseded`/`timeout` ⇒ `aborted` and no apply; apply false ⇒ `aborted`; a thrown port rejects to the caller.
    - Controller: `source` reflects `updateSource`; `applyProvidedScript` dispatches a provided brush script at the current source through `prepareTarget` + the engine, returns true, and leaves `clipboard.value` null; returns false for a generated-interpolation source and while an apply is busy.
    - Hook: `duplicateWithScript` returning `handled` calls neither `bakeRotoKeyPaint` nor `physicalKeyUtilities.duplicateKey`; `fallback` runs the existing settle-then-clone (including the cook bake and the fail-closed branches); `aborted` runs neither; a rejected port publishes the generic duplicate error; `keyActionInFlight` blocks a second invocation and always clears.
    GREEN: every expectation above passes with zero test edits after the implementation, and the existing 261023-bxm duplicate suite passes unchanged.
  </behavior>
  <action>
    Step 0 (once, before any edit): capture the typecheck baseline — `pnpm --filter efx-motion-editor run typecheck > /tmp/cxc-typecheck-baseline-full.txt; grep -c 'error TS' /tmp/cxc-typecheck-baseline-full.txt > /tmp/cxc-typecheck-baseline.txt`. The task is not done if the baseline file is missing or empty.

    RED: create `physicsPaintRotoDuplicateScript.test.ts`; add a `describe('applyProvidedScript')` block to the existing `physicsPaintRotoScriptClipboard.test.ts` using its `harness()`; add a `describe('useRotoKeyUtilities duplicateWithScript (261023-cxc)')` block to `useRotoKeyUtilities.test.ts`, extending `HarnessOptions`/`createHarness` with the new optional port (do not rewrite the harness). Run all three files and record the failures.

    Create `physicsPaintRotoDuplicateScript.ts` — pure decision + bounded wait + orchestration; no store, no DOM, no IPC:
    - Types: `RotoDuplicateScriptModule = 'brush' | 'watercolor'`; `RotoDuplicateScriptDestinationKind = 'empty' | 'real' | 'generated' | 'out-of-capacity'`; `RotoDuplicateScriptFallbackReason = 'source-changed' | 'destination-occupied' | 'destination-out-of-capacity' | 'no-script' | 'capture-failed' | 'navigation-failed'`; `RotoDuplicateScriptDecision = { kind: 'script'; destinationFrame: number; module: RotoDuplicateScriptModule } | { kind: 'fallback'; reason: RotoDuplicateScriptFallbackReason }`; `RotoDuplicateScriptOutcome = { outcome: 'handled' } | { outcome: 'fallback'; reason: RotoDuplicateScriptFallbackReason } | { outcome: 'aborted'; message: string }`.
    - Export the messages `ROTO_DUPLICATE_SCRIPT_NAVIGATION_ABORTED`, `ROTO_DUPLICATE_SCRIPT_SUPERSEDED`, `ROTO_DUPLICATE_SCRIPT_TIMEOUT`, `ROTO_DUPLICATE_SCRIPT_APPLY_FAILED`, `ROTO_DUPLICATE_SCRIPT_RECORD_FAILED` (direct, user-facing sentences; each names Duplicate and the failed step).
    - `resolveRotoDuplicateScriptDecision(input: { source: { keyId: string; appFrame: number } | null; expectedKeyId: string; expectedAppFrame: number; destinationKind: RotoDuplicateScriptDestinationKind; capacity: number; module: RotoDuplicateScriptModule; brushStrokeCount: number; aquarelleStrokeEventCount: number })`. Law in order: source null or key/frame mismatch → `source-changed`; `source.appFrame + 1 >= capacity` or destination kind `out-of-capacity` → `destination-out-of-capacity`; destination kind real/generated → `destination-occupied`; brush requires `brushStrokeCount > 0`, watercolor requires `aquarelleStrokeEventCount > 0`, else `no-script`; otherwise a script decision for `source.appFrame + 1` and the module. Document that only an `empty` cell is eligible so the promoted destination is the blank key, never a raster clone.
    - `waitForRotoDuplicateSourceFrame(source: ReadonlySignal<{ appFrame: number }>, input: { originFrame: number; targetFrame: number; timeoutMs?: number }): Promise<'ready' | 'timeout' | 'superseded'>`. Use `effect` from `@preact/signals`: immediately `ready` when `source.peek().appFrame === targetFrame`; otherwise subscribe and finish `ready` on the target, `superseded` on any frame other than `originFrame`/`targetFrame`, and `timeout` on a single `setTimeout` bound (default 2000 ms). Dispose the effect and clear the timer on every exit. No polling loop, no rAF chain, no sleeps.
    - `runRotoDuplicateWithScript(input: { sourceKeyId: string; sourceAppFrame: number }, ports)` where ports are: `getSource(): { keyId: string; appFrame: number } | null`; `getDestination(destinationFrame): RotoDuplicateScriptDestinationKind`; `getCapacity(): number`; `getModule(): RotoDuplicateScriptModule`; `getBrushStrokeCount(): number`; `getAquarelleStrokeEventCount(appFrame): number`; `captureBrushScript(): RotoPaintScript | null`; `getAquarelleEvents(appFrame): readonly AquarellePayloadEvent[]`; `navigateTo(frame): Promise<boolean>`; `waitForSourceFrame(frame): Promise<'ready' | 'timeout' | 'superseded'>`; `applyBrushScript(script): Promise<boolean>`; `applyAquarelleEvents(events): Promise<boolean>`; `recordAquarelleScriptCopy(sourceFrame, destinationFrame): Promise<boolean>`. Order: re-check the source matches the requested key/frame → decide → capture (brush: `captureBrushScript`, null ⇒ `fallback` `capture-failed`; watercolor: `getAquarelleEvents`, empty ⇒ `fallback` `no-script`) → `navigateTo(destinationFrame)` (false ⇒ `fallback` `navigation-failed` only if `getSource()` is still the original key/frame; otherwise `aborted` with the navigation message) → `waitForSourceFrame` (`superseded`/`timeout` ⇒ `aborted` with the matching message; never apply) → brush: `applyBrushScript(captured)` → `handled`/`aborted`; watercolor: `applyAquarelleEvents(events)` then `recordAquarelleScriptCopy(sourceFrame, destinationFrame)` (each false ⇒ `aborted` with its message; never record after a failed apply) → `handled`. The module must not publish UI state; the caller maps `aborted.message`.

    `physicsPaintRotoScriptClipboard.ts`: add `source: ReadonlySignal<RotoScriptSourceSnapshot>` to `RotoScriptClipboardController` and return `source: sourceState`. Add `applyProvidedScript: (script: RotoPaintScript) => Promise<boolean>` mirroring `applyCurrentScript`'s guards and ownership WITHOUT clipboard or capture gates: false when disposed/disposalRequested, when `engineState.peek()` is null, when the current source is `generated-interpolation`, or when `busy.peek()`; otherwise clear `error`, `beginOperation(engine)`, and return `dispatchApply(script, sourceState.peek(), engine)`; never write `clipboard`. Keep every existing method behavior identical.

    `useRotoKeyUtilities.ts`: export `type RotoDuplicateWithScriptOutcome = 'handled' | 'fallback' | 'aborted'`; add `duplicateWithScript?: (input: { sourceKeyId: string; sourceAppFrame: number }) => Promise<RotoDuplicateWithScriptOutcome>`. Refactor the 261023-bxm settle-then-clone into one awaited callback `runSettleThenClone(sourceKeyId)` (resolve the record, `resolveRotoDuplicateSourcePaint`, fail closed on `unavailable`, `ready` → await `physicalKeyUtilities.duplicateKey`, `cook` → await `bakeRotoKeyPaint`, re-read and re-resolve with `displayed: null`, require `ready`, then await the duplicate). `duplicateKey` keeps the same guards, resolves `sourceKeyId`, and: when `duplicateWithScript` is present, set `keyActionInFlight`, await the port with `{ sourceKeyId, sourceAppFrame }`, run `runSettleThenClone` only on `fallback`, publish `Could not duplicate the Roto key.` with the detail on a thrown port, and always clear the flag; when the port is absent, keep today's behavior via the same callback with today's error messages. Do not change the 261023-bxm module or its messages.

    `PhysicsPaintStudio.tsx`: declare `requestDuplicateNavigationRef` as `useRef<(frame: number) => Promise<boolean>>(async () => false)` before the coordinator; inside the keyUtilities literal add `duplicateWithScript` that builds the ports and awaits `runRotoDuplicateWithScript`: `getSource` reads `rotoScript.source.peek()` (keyId only for a real key); `getDestination(frame)` reads `physicPaintStore.getRotoPhysicalProjection(launchContext.layerId, studioActiveTrackId())?.cells[frame]?.kind` and maps absent → `out-of-capacity`; `getCapacity` reads `getRotoPhysicalCapacity`; `getModule` maps `activeModule.peek() === 'watercolor'`; `getBrushStrokeCount` reads `engineRef.current?.getStrokeCount() ?? 0`; `getAquarelleStrokeEventCount` counts non-Dry events from `getAquarelleEventsForFrame`; `captureBrushScript` returns a script from `normalizeLogicalBrushes(engine.getStrokes())` with the live source/provenance and null when empty; `getAquarelleEvents` returns `getAquarelleEventsForFrame`; `navigateTo` calls `requestDuplicateNavigationRef.current`; `waitForSourceFrame` calls `waitForRotoDuplicateSourceFrame(rotoScript.source, { originFrame: sourceAppFrame, targetFrame: destinationFrame })`; `applyBrushScript` calls `rotoScript.applyProvidedScript`; `applyAquarelleEvents` calls `rotoScript.applyAquarelleTimeline`; `recordAquarelleScriptCopy` is filled in Task 2. On an `aborted` outcome publish `setApplyStatus('error')`, `setApplyMessage(message)`, `setLastError(message)` and return `aborted`. After the coordinator call assign `requestDuplicateNavigationRef.current = rotoNavigation.requestNavigation`. Add the `normalizeLogicalBrushes` import. Do NOT change `duplicateRotoKey`, `promoteRotoPaintTargetRef`, `prepareRotoScriptTargetRef`, the resolver, or any signal declaration.

    Rationale for the file count: this tracer is one vertical slice — one pure module, one controller, one hook, one Studio file, plus their three test files; splitting the path would leave no end-to-end proof. Task 2 adds only the watercolor branch.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.test.ts src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts src/components/physic-paint/hooks/useRotoKeyUtilities.test.ts</automated>
    <automated>pnpm --filter efx-motion-editor run typecheck > /tmp/cxc-typecheck-task1.txt; test -s /tmp/cxc-typecheck-baseline.txt && test "$(grep -c 'error TS' /tmp/cxc-typecheck-task1.txt)" -le "$(cat /tmp/cxc-typecheck-baseline.txt)"</automated>
  </verify>
  <done>All three suites green (including every pre-existing script-clipboard and 261023-bxm duplicate assertion), typecheck within the captured baseline, and the tests prove: the decision table, the bounded wait (ready/superseded/timeout), the orchestrator order and the two abort classes, the controller's clipboard-free provided-script apply, and the hook's handled/fallback/aborted contract with the bxm fallback preserved.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Watercolor duplicate — bake plus a fresh-id recorded timeline copy</name>
  <files>app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.ts, app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.test.ts, app/src/components/physic-paint/PhysicsPaintStudio.tsx</files>
  <behavior>
    RED first:
    - `aquarelleStrokeFromScriptEvent(event, destinationFrame)` returns a raw stroke carrying tool/color/params/brushId/points/toolOverrides/diffusionFrames (`cuisson` when positive)/timestamp/playFrame = destinationFrame, and no mutationId.
    - `copyAquarelleScriptToFrame` skips every Dry event, calls the allocator once per stroke in recording order, records each with its fresh id and the destination playFrame, returns the stroke count, and never mutates or reorders the input array (object identity and values of the source events are unchanged).
    - Orchestrator watercolor: `applyAquarelleEvents` receives the events in timeline order (Dry included) and runs exactly once before any record call; a false apply returns `aborted` and the record port is never called; a successful apply followed by a false record returns `aborted` with the record message; a successful pair returns `handled`.
    - The decision still routes a frame with zero stroke events (only Dry or empty) to `fallback` `no-script`, so no pixels-only watercolor key is produced through this path.
  </behavior>
  <action>
    Add to `physicsPaintRotoDuplicateScript.ts` (pure, immutable):
    - `aquarelleStrokeFromScriptEvent(event: Exclude<AquarellePayloadEvent, AquarelleDryEvent>, destinationFrame: number): AquarelleStroke` projecting the event's `engine` payload plus `pts` (x/y/p/tx/ty/tw only; tick is regenerated by `toStudioStroke`) and `playFrame: destinationFrame`; never carry the source mutationId.
    - `copyAquarelleScriptToFrame(input: { events: readonly AquarellePayloadEvent[]; destinationFrame: number; allocateMutationId: (stroke: AquarelleStroke) => number; record: (mutationId: number, stroke: AquarelleStroke) => void }): number` — iterate in order, `continue` on `isAquarelleDryEvent`, project, allocate, then `record(id, { ...stroke, mutationId: id })`; count and return the recorded strokes. Follow `translateAquarelleStrokeInScript`'s replace-never-mutate posture.
    Run `runRotoDuplicateWithScript` with the watercolor port sequence exactly as specified in Task 1 (apply whole event list, then record the copy); no other orchestration change.

    `PhysicsPaintStudio.tsx`: fill the `recordAquarelleScriptCopy` port — return false when `engineRef.current` or `launchContext` is missing; read `getAquarelleEventsForFrame(sourceFrame)`; call `copyAquarelleScriptToFrame` with `destinationFrame`, an allocator that returns `engineRef.current.enqueueRecordedStroke({ primary: aquarelleStrokeToPaintStroke(stroke, { width: canvasWidth, height: canvasHeight }) })`, and `recordAquarelleStroke` as the record sink; return true only when at least one stroke was recorded. No other Studio change; do not touch the watercolor selection/stack handlers.

    Tests extend `physicsPaintRotoDuplicateScript.test.ts` with the projection/copy table, the Dry-skip and source-immutability checks, and the watercolor orchestrator order/abort cases. Do not add a `.test.tsx`.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.test.ts src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts src/components/physic-paint/view/aquarelleRecordState.move.test.ts src/components/physic-paint/view/aquarelleRecordState.delete.test.ts src/components/physic-paint/view/aquarelleRecordState.reorder.test.ts</automated>
    <automated>pnpm --filter efx-motion-editor run typecheck > /tmp/cxc-typecheck-task2.txt; test -s /tmp/cxc-typecheck-baseline.txt && test "$(grep -c 'error TS' /tmp/cxc-typecheck-task2.txt)" -le "$(cat /tmp/cxc-typecheck-baseline.txt)"</automated>
  </verify>
  <done>The projection/copy tests prove Dry is skipped, ids are fresh per stroke, playFrame is rewritten, and source events are untouched; the orchestrator proves apply-before-record and both abort classes; the aquarelle move/delete/reorder suites stay green; typecheck within baseline.</done>
</task>

<task type="auto">
  <name>Task 3: Adjacent-suite gate, full-suite allowlist, guardrail audit, UAT matrix</name>
  <files>app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.ts, app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts, app/src/components/physic-paint/hooks/useRotoKeyUtilities.ts, app/src/components/physic-paint/PhysicsPaintStudio.tsx</files>
  <action>
    No production edits except fixes strictly required by a failing gate.

    1. Adjacent suites that constrain the untouched law: the resolver, the physical-edit coordinator, the timeline actions, the previous-key-base suite, the play-script controller, and the full script clipboard suite. Any failure means the change reached a fence — fix the change, never the test.
    2. Full app suite once into `/tmp/cxc-full-suite.txt`. Tolerated failing files are the known pre-existing ones only: PhysicsPaintRightSidebar, PhysicsPaintWorkflowStrip.viewport, efxPaintCompositorMatrix, exportEngine, paperPass.frameGuard, and rotoCompletionPaintGuard (2 tests, documented in the 261023-bxm SUMMARY as failing at the base commit). Any other failing file fails this task.
    3. Typecheck again against the Task 1 baseline file.
    4. Guardrail audit: `git diff --stat` must show only this plan's seven files. Confirm empty diffs for `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts`, `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts`, `app/src/components/physic-paint/roto/physicsPaintRotoDuplicateSourcePaint.ts`, `app/src/lib/physicPaintBridge.ts`, `app/package.json`, and `pnpm-lock.yaml`; confirm no `.test.tsx` was added and no `useState`/`useEffect` was introduced in the touched source files; confirm no `renderFromStrokes` usage.
    5. Write the SUMMARY with RED/GREEN evidence, gate counts, the allowlist note, and the live UAT matrix below marked PENDING. Do not mark the quick complete before the user confirms the rows.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.test.ts src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts src/components/physic-paint/hooks/useRotoTimelineActions.test.ts src/components/physic-paint/roto/physicsPaintRotoPreviousKeyBase.test.ts src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts</automated>
    <automated>pnpm --filter efx-motion-editor exec vitest run > /tmp/cxc-full-suite.txt 2>&1; grep -qE '^[[:space:]]*Test Files' /tmp/cxc-full-suite.txt && ! grep -E '^[[:space:]]*FAIL[[:space:]]' /tmp/cxc-full-suite.txt | grep -vE 'PhysicsPaintRightSidebar|PhysicsPaintWorkflowStrip\.viewport|efxPaintCompositorMatrix|exportEngine|paperPass\.frameGuard|rotoCompletionPaintGuard' | grep -q .</automated>
    <automated>pnpm --filter efx-motion-editor run typecheck > /tmp/cxc-typecheck-task3.txt; test -s /tmp/cxc-typecheck-baseline.txt && test "$(grep -c 'error TS' /tmp/cxc-typecheck-task3.txt)" -le "$(cat /tmp/cxc-typecheck-baseline.txt)"</automated>
    <automated>DIFF=$(git diff --stat -- app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts app/src/components/physic-paint/roto/physicsPaintRotoDuplicateSourcePaint.ts app/src/lib/physicPaintBridge.ts app/package.json pnpm-lock.yaml); STATUS=$?; test "$STATUS" = "0" && test -z "$DIFF"</automated>
  </verify>
  <done>Adjacent suites and every non-allowlisted file in the full suite pass; typecheck is within baseline; the untouched-law files show an empty diff; the SUMMARY records the pending live UAT matrix.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| UI gesture → physical edit coordinator | The script path promotes an empty destination cell and paints it; only the existing coordinator-validated promotion may create the key. |
| Script controller → destination engine/persistence | A transient captured script crosses into the destination key's engine and record; the user's script clipboard must not be touched. |
| Aquarelle timeline → per-key records | Source-frame events are projected onto the destination frame; the source frame's records must remain byte-identical. |
| Async sequence → live Studio state | The user can navigate, lock, or dispose mid-sequence; stale work must never paint or create a key. |
| Executor → package manager | No installs in this quick; the 2 MB bundle ceiling stays. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-cxc-01 | Tampering | `runRotoDuplicateWithScript` → destination promotion | high | mitigate | Only an `empty` cell inside capacity is eligible; promotion runs through `prepareTarget` → `promoteRotoPaintTargetRef` → `addEmptyKey`, which builds a BLANK base for an empty cell and validates through the coordinator; the orchestrator never creates a key directly and never reuses a raster clone. |
| T-cxc-02 | Denial of Service | user navigation / re-entrancy during the sequence | high | mitigate | `keyActionInFlight` covers the whole sequence; the destination wait observes `rotoScript.source` with a hard 2000 ms bound and aborts on any third frame; `dispatchApply`'s source/generation gates reject stale applies; a superseded or timed-out wait never applies. |
| T-cxc-03 | Repudiation | watercolor record copy | high | mitigate | The copy skips Dry, allocates fresh ids through the same `enqueueRecordedStroke` + `recordAquarelleStroke` pair the live path uses, rewrites `playFrame`, replaces objects instead of mutating, and reads the source timeline through a filtered getter — the source frame's entries are never written. |
| T-cxc-04 | Elevation of Privilege | `applyProvidedScript` | medium | mitigate | It reuses `dispatchApply` (validation, promotion, publication, operation lease) and never writes `clipboard`; the transient script lives only in the orchestration closure, so no script can be persisted or applied from an unintended source. |
| T-cxc-05 | Information Disclosure | abort messages | low | accept | Messages name the failed step (navigation, timeout, apply, record) and never include stroke contents, ids, or file paths. |
| T-cxc-SC | Tampering | npm/pip/cargo installs | low | accept | No dependency changes; manifests and lockfile must show an empty diff in Task 3. |
</threat_model>

<verification>
Automated gate (executor):
- Task 1, Task 2, and Task 3 `<automated>` commands all pass; typecheck within the captured baseline.
- Untouched-law diff is empty for the resolver, model, the 261023-bxm module, the bridge, and manifests.

Source audit (all four sources covered):
| Source item | Covered by |
|---|---|
| GOAL: source script + free source+1 → duplicate is immediately editable | Task 1 (brush end-to-end), Task 2 (watercolor) |
| GOAL: occupied source+1 or no script → the 261023-bxm clone unchanged | Task 1 decision + hook `fallback`; bxm suite stays green |
| GOAL: watercolor stays re-editable, fresh ids, no source mutation | Task 2 copy helper + aquarelle suites |
| GOAL: apply target is the blank promoted key, no double paint | Task 1 decision (`empty` only) + promotion contract in context |
| GOAL: focused orchestration, bounded wait, no ad-hoc sleeps | Task 1 module (`waitForRotoDuplicateSourceFrame`) + orchestrator tests |
| GOAL: failed capture/navigation fall back; failed apply aborts loudly; user navigation aborts | Task 1/2 orchestrator tests + abort messages |
| GOAL: preserve rail-set duplicate, +1 ripple, selection, schema, deps | Scope fences + Task 3 audit |
| GOAL: preserve the failed quick's fallback and tests | Task 1 hook refactor keeps the bxm module and its suite byte-identical |

Live UAT (user-run — pending; the SUMMARY must mark these PENDING):
| # | Step | Expected |
|---|------|----------|
| 1 | Brush: paint/apply a script on key N where N+1 is a free frame, press bottom-timeline Duplicate | Key N+1 appears selected, renders the same paint, sits on the source's rail; the Move tool selects and moves its strokes; the source key is unchanged |
| 2 | Brush: Duplicate again after moving the duplicate's strokes | The next key carries the MOVED strokes (the duplicate's live script), not the source's original stroke positions |
| 3 | Brush: put a real key at N+1 first, then Duplicate key N | Unchanged ripple clone: the new key lands at N+1, the previous N+1 key shifts to N+2, same rail |
| 4 | Brush: a key with no live strokes (raster-only) on a free next frame, Duplicate | Unchanged 261023-bxm cache/display clone; no error |
| 5 | Watercolor: a key with recorded strokes on a free next frame, Duplicate | Key N+1 appears selected and painted; Move, Alt+click Delete, and stack-step act on the duplicate; the source key is unchanged |
| 6 | Watercolor: Duplicate again after moving the duplicate's strokes | The next key carries the moved watercolor strokes; editing it never changes the previous keys |
| 7 | Watercolor: a key with no recorded events on a free next frame, Duplicate | Cache/display clone (261023-bxm fallback); no pixels-only key is silently presented as re-editable |
| 8 | Any module: start Duplicate and immediately navigate to another frame | No key appears at N+1; an explicit interruption message is shown; the Studio stays usable |
</verification>

<success_criteria>
- With a brush script and a free next frame, Duplicate produces a selected, painted, same-rail key whose strokes Move/Select can edit, and the source key's script and paint are unchanged.
- With a watercolor script and a free next frame, the duplicate carries the recorded timeline for its own frame with fresh ids, so Move/Delete/Step edit only the duplicate.
- With an occupied next frame, over-capacity destination, or no script, the 261023-bxm settle-then-clone duplicate runs unchanged.
- Pre-navigation failures fall back in the same click; post-navigation failures publish an explicit error and never also clone; user navigation aborts without creating a key.
- The destination is always the blank promoted key; the script path and the raster clone never run together.
- Resolver, semantic-delta validator, coordinator, bridge, schema, package manifests, and the 261023-bxm module/tests are untouched.
- All automated gates pass; the quick stays automated-ready until the user's live UAT rows pass.
</success_criteria>

<output>
Create `.planning/quick/261023-cxc-uat-follow-up-to-261023-bxm-the-bottom-t/261023-cxc-SUMMARY.md` when done, with RED/GREEN evidence, gate counts, the guardrail audit, and the live UAT matrix marked PENDING.
</output>
