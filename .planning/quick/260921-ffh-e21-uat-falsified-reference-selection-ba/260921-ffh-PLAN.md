---
phase: quick-260921-ffh
plan: 260921-ffh
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/stores/efxPaintStudioOriginSync.scratch.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/bridge/documentSyncPushGuard.ts
  - app/src/lib/physicPaintBridge.ts
  - app/src/components/physic-paint/bridge/physicsPaintBridgeTransport.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  - .planning/quick/260921-ffh-e21-uat-falsified-reference-selection-ba/260921-ffh-RED-EVIDENCE.json
  - .planning/quick/260921-ffh-e21-uat-falsified-reference-selection-ba/260921-ffh-SUMMARY.md
autonomous: true
requirements: []
estimate:
  tokens: 34000
  raw_tokens: 34000
  tasks: 3
  confidence: low
must_haves:
  truths:
    - "A reference image selected in the Studio is present in the PARENT realm's document before the child window is destroyed, so the next Studio launch carries the same active reference (native UAT row 1)."
    - "A background image keyframe placed in the Studio is present in the parent realm's document with its startFrame and source refs, so the reopen renders the clip at the same frame (native UAT row 2)."
    - "Every track added with the Studio's (+) — painted or empty — is present in the parent realm's document with its content, so the reopen shows the track (native UAT row 3)."
    - "The three surfaces survive the .mce roundtrip: the parent save writes them into layers/<layerId>.json (native UAT row 4)."
    - "The 260921-bjm gallery import path still persists (native UAT row 5 / regression row)."
    - "The e21 latent fix is intact and never weakened: DOCUMENT_SYNC_MAX_AUTO_RETRIES, documentSyncPushFailuresRef, the documentSyncPushGuardRef re-arm on failure, the clear-dirty-INSIDE-the-mode-gate placement, and the close-gate hasPending reporting all still exist and still behave (guardrail 1)."
    - "The transfer stays on the pre-existing physic-paint:efx-paint-document pair or the pre-existing applyPayload channel: no new event pair, no new IPC/Rust command, no .mce manifest change; the 52.2 reference-only law holds (guardrail 2)."
    - "Quick 260921-c7x is not re-opened: the canonical loop-clip revision authority and the terminal physical-edit mismatch release behave exactly as shipped (guardrail 5)."
    - "Native UAT is left explicitly pending in the SUMMARY — never claimed (guardrail 6)."
  artifacts:
    - .planning/quick/260921-ffh-.../260921-ffh-RED-EVIDENCE.json — the per-surface (a)/(b)/(c) verdicts, the four fidelity-gap controls, the per-surface probe outputs, the structural booleans S1..S4, the halt decision and the verbatim RED run per pin
    - .planning/quick/260921-ffh-.../260921-ffh-SUMMARY.md — the verdicts, the before/after of the diagnosed seam, the raw RED→GREEN output, the scope + guardrail audit, the gates, and the five native UAT rows marked pending
    - app/src/stores/efxPaintStudioOriginSync.scratch.test.ts — the TWO-REALM chain harness (separate child/parent module instances of efxPaintStore + physicPaintStore) that owns the probes and then the three behavioural pins
  key_links:
    - "app/src/components/physic-paint/PhysicsPaintStudio.tsx:3920-3995 — THE CHILD PUSH. pushLiveProjection runs `documentSyncPushGuard.evaluate(() => serializeRuntimeIntoDocument(layerId), () => efxPaintVersion.peek())` (:3922-3931) and returns null at :3938 when the guard reports a duplicate, then sendEfxPaintDocumentSync (:3967). CALLER CONTRACT: every caller sets documentSyncDirty.value = false BEFORE calling (:4024 close, :4048 debounce, :4081 gesture), so a null return is a mutation consumed with NO send and NO re-mark. Only the .catch (:3976-3986) re-marks. This is the one drop shape e21's behavioural leg never entered."
    - "app/src/stores/efxPaintStore.ts:1708-1734 — THE REAL DOCUMENT SOURCE OF THE PUSH. serializeRuntimeIntoDocument rebuilds EVERY track from the RUNTIME (`{ ...track, frames, rotoPhysical: runtime.rotoPhysical }`, :1714-1725), then WRITES THE RESULT BACK into _documents and bumps documentRevision (:1730-1731). Document-only state the runtime does not carry is overwritten IN PLACE by the push itself, and the bumped revision makes the parent's idempotency guard accept the lossy version. e21's PROBE B sent a HAND-BUILT document; its pin called the serializer but never diffed the document across it."
    - "app/src/components/physic-paint/bridge/documentSyncPushGuard.ts:38-50 — THE GUARD. Fingerprint = buildEfxPaintDocumentRevision; latches lastPushedFingerprint BEFORE the send resolves; returns null on a match. e21 pinned it with a SOURCE-TEXT assertion only; its behavioural leg handed the document straight to sendEfxPaintDocumentSync (:800 of physicsPaintBridgeTransport.test.ts), so the guard was never in a behavioural probe."
    - "app/src/lib/physicPaintBridge.ts:3253-3311 — THE PARENT APPLY. applyDocument parses, applies frame media, then EARLY-RETURNS at :3283 when buildEfxPaintDocumentRevision(current) === buildEfxPaintDocumentRevision(document), else registerEfxPaintDocument (:3284) + the silent per-track runtime mirror (:3296-3307). ANY throw is caught at :3308 and logged as '[physicPaintBridge] Rejected EFX Paint document sync' with ZERO mutation — a whole-document, all-three-surfaces-at-once drop."
    - "app/src/lib/physicPaintBridge.ts:3433-3543 — THE REOPEN CARRIER. createPhysicPaintLaunchContext builds `{ ...baseDocument, tracks }` from the PARENT realm's getEfxPaintDocument(layerId) (:3498-3515) and fails CLOSED at :3541. It can only carry what the parent already holds — it is a mirror of the parent's live document, never a second source of truth."
    - "app/src/components/physic-paint/PhysicsPaintStudio.tsx:1918-1935 + app/src/components/physic-paint/bridge/usePhysicsPaintParentBridge.ts:20-51 — TEARDOWN. The close hook's hasPending gate reads pendingDocumentSyncRef.current() (:1919, assigned :4012 = dirty.peek() || failures > 0); on a true gate it event.preventDefault()s, awaits the 4-step flush (stroke finalization → live pixels → playback settings → document sync, :1924-1929), then window.destroy(). A false gate means the window is destroyed with NO flush at all. No probe has ever driven this sequence."
    - "app/src/components/physic-paint/PhysicsPaintStudio.tsx:2866-2875 / :4209-4285 / :4298-4329 — THE REAL UI HANDLERS. handleAddTrack = addTrack + setActiveTrackId (TWO mutations); handleConfirmBackgroundPicker = addBackgroundClip + hydration + getFlattenedFrame; handleConfirmReferencePicker = setPhotoReferenceSource + rotoMoveHistory.recordBackgroundEdit + hydration. e21's PROBE A drove the bare store functions (:183-206, :692-723, :1129-1176), not these."
    - "THE STROKES CONTRAST (H4). Strokes/physical edits ship EAGERLY per gesture through sendPhysicPaintApplyPayload (app/src/components/physic-paint/bridge/physicsPaintBridgeTransport.ts:420-441) on physic-paint:apply (app/src/lib/physicPaintBridge.ts:89) WITH a result/ack pair (:90), called from PhysicsPaintStudio.tsx:1469 (also :841, :1866) — no dirty flag, no debounce, no close gate. The three surfaces ship ONLY through documentSyncDirty → pushLiveProjection → guard → serialize on physic-paint:efx-paint-document (:97) with NO ack. A stroke is safe the moment its gesture ends; a structural change is safe only if a flush fires AND the guard lets it through AND the parent apply accepts it. That asymmetry is the discriminator."
    - "app/src/components/physic-paint/PhysicsPaintStudio.tsx:359 / :351 — the e21 constants that must survive: DOCUMENT_SYNC_MAX_AUTO_RETRIES = 3, DOCUMENT_SYNC_GESTURE_QUIET_MS = 2500. The retry only works because the debounce effect's deps array reads documentSyncDirty.value at render time (:4057) and the gesture effect's deps read interactionIdle.value (:4090). Narrowing either deps array silently turns the re-arm into a no-op."
    - "app/src/main.tsx:115 — the parent listener IS installed app-lifetime in the main realm; the transport is NOT the suspect shape."
---

<objective>
Find and fix why the three Studio-origin document surfaces — the reference-image selection, the background-image keyframes, and the tracks added with (+) — are still lost on a simple Studio close, after quick 260921-e21's wiring fix shipped and was falsified by native UAT on 2026-09-21.

Purpose: e21 fixed a REAL latent bug and stays, but its causal theory is falsified. Its probes were GREEN at base for exactly the reason the brief names: they drove the STORE APIs and then each downstream link in ISOLATION, so they never entered the composition the real app performs. This plan re-opens the same bisection with the four named FIDELITY GAPS closed, so the probes finally drive the same shape the product drives — and only then pins it RED, behaviourally, and fixes the link the verdict names.

Output: `.planning/quick/260921-ffh-.../260921-ffh-RED-EVIDENCE.json` (per-surface verdicts + the fidelity controls + the verbatim RED run), a two-realm behavioural chain harness with three RED-then-GREEN pins, the fix itself inside the existing transport, and a SUMMARY with the five native UAT rows marked pending.

## What is already established (do NOT re-derive — reproduce, then go past)

These were run or read live and are the plan's starting floor, not its conclusions:

- All three mutations DO write the child document and DO call `_notifyChange()` (`efxPaintStore.ts:67-70`, called at `:205` addTrack, `:723` addBackgroundClip, `:1176` setPhotoReferenceSource). The child is not silent.
- The transport DOES carry all three: `projectEfxPaintDocumentForSync` (`physicsPaintBridgeTransport.ts:271-307`) spreads `{ ...document, tracks }`, preserving `photoReference` / `background.clips` / `activeTrackId`.
- The parent apply DOES accept them, the idempotency guard CANNOT skip a real change (`buildEfxPaintDocumentRevision` covers `tracks`, `clips`, `photo`, `docrev`, `active` — `efxPaintDocumentRevision.ts:119-151`), and the reopen carrier DOES carry them (`createPhysicPaintLaunchContext:3498-3515`).
- The store/package save seam IS correct (`efxPaintChildParentSync.scratch.test.ts`, 3 passed at base).
- `workflowMode` is the constant `'roto'` (`PhysicsPaintStudio.tsx:797`), so the close hook's `workflowMode === 'roto'` term (`:1919`) is ALWAYS true and is exonerated.
- The parent listener IS installed app-lifetime (`main.tsx:115`).

**The remaining gap is the COMPOSITION: what the child's push actually sends, whether it sends at all, and whether the window outlives the send.** Task 1 targets exactly that.

## The four probe-fidelity gaps this plan must close (e21's lesson, made mechanical)

| ID | What e21 drove | What the product does | Why a probe through the old shape is blind |
|---|---|---|---|
| **FG-1** | `sendEfxPaintDocumentSync(document, 'Tauri')` with the document handed straight in (`physicsPaintBridgeTransport.test.ts:800-801`); the guard pinned with a SOURCE-TEXT assertion | `pushLiveProjection` runs `documentSyncPushGuard.evaluate(() => serializeRuntimeIntoDocument(layerId), …)` and **returns null at `:3938` on a duplicate fingerprint** | the guard returning null is a live drop: every caller clears `documentSyncDirty` BEFORE the call (`:4024`, `:4048`, `:4081`), so the change is consumed with no send and no re-mark |
| **FG-2** | a HAND-BUILT document (PROBE B); where the serializer WAS used, the mutation ran in the same realm that then serialized | the push serializes the CHILD's live document — and `serializeRuntimeIntoDocument` (`efxPaintStore.ts:1714-1731`) **rebuilds every track from the RUNTIME and writes the result back over `_documents`, bumping `documentRevision`** | document-only state the runtime does not carry is overwritten IN PLACE by the push itself, and the bumped revision makes the parent accept the lossy version |
| **FG-3** | one module instance; the "parent realm" faked by `resetEfxPaintStore()` mid-test | TWO webview realms, each with its OWN `efxPaintStore` / `physicPaintStore` module instance | module-level state (documents, runtimes, `documentSyncSentDigests`) leaks between the realms, so a probe can pass on state the product never shares |
| **FG-4** | nothing — the close sequence was never driven | `hasPending` gate → `event.preventDefault()` → `await` the 4-step flush → `window.destroy()` (`usePhysicsPaintParentBridge.ts:38-45`) | a false gate destroys the window with NO flush at all; a true gate still only sends if mode, dirty and the guard all pass |

## Hypotheses to verdict (decide by running, not by reading)

- **H1 — the mutation never reaches the push.** The real UI handlers do MORE than the bare store call (`handleAddTrack` :2866 = `addTrack` + `setActiveTrackId`; the picker handlers also hydrate + record undo). Establish per surface whether the change is visible in the document the push would carry AND whether it changes `buildEfxPaintDocumentRevision`.
- **H2 — the push is consumed without being sent.** Either the guard returns null (FG-1) or `serializeRuntimeIntoDocument` reverts the change on the way out (FG-2). Both leave `documentSyncDirty` false with no send and no re-mark.
- **H3 — teardown.** Drive the close gate + the 4-step sequence with the real dirty/mode/push inputs and record whether a change pending at close leaves the child (FG-4). Also record which close paths traverse the hook (`handleWorkflowClose` :1943 → `getCurrentWindow().close()` → `onCloseRequested`).
- **H4 — the strokes contrast (the strongest discriminator).** State concretely, with evidence, which channel a stroke rides (`physic-paint:apply`, eager per gesture, WITH an ack) versus which channel these three ride (`physic-paint:efx-paint-document`, debounced, NO ack, gated on the guard and the close flush). Use that asymmetry to explain exactly why one survives teardown and the other does not.

## Deliverable shape

1. Live diagnosis through the REAL entry points, with FG-1..FG-4 closed, raw JSON evidence in `260921-ffh-RED-EVIDENCE.json`, a per-surface (a)/(b)/(c) verdict, and `halt.fired = true` + STOP if the root is structural.
2. RED first: three BEHAVIOURAL pins in the two-realm harness. Never a textual or source-shape assertion.
3. GREEN: fix the diagnosed link inside the existing transport or the existing applyPayload channel.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/260921-e21-studio-origin-state-never-persists-refer/260921-e21-SUMMARY.md
@.planning/quick/260921-e21-studio-origin-state-never-persists-refer/260921-e21-PLAN.md
@.claude/skills/efx-preact-reactivity/SKILL.md
@.claude/skills/efx-async-orchestration/SKILL.md

# The two channels, side by side — read once, both:
@app/src/components/physic-paint/bridge/physicsPaintBridgeTransport.ts
@app/src/components/physic-paint/bridge/documentSyncPushGuard.ts

# The child wiring and the parent apply:
@app/src/components/physic-paint/PhysicsPaintStudio.tsx
@app/src/lib/physicPaintBridge.ts
@app/src/stores/efxPaintStore.ts
</context>

## The e21 fix is NOT the suspect — it is a GUARDRAIL on your fix

Task 0 of your reading, before anything else: run the e21 pins at base and confirm they are GREEN.

```
cd /Users/lmarques/Dev/efx-motion-editor && pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts src/components/physic-paint/bridge/physicsPaintBridgeTransport.test.ts 2>&1 | tail -20
```

Then, for the rest of this plan, treat the following as untouchable (guardrail 1). Your fix MUST leave every one of them in place and still behaving:

| Invariant | Location | Why it must survive |
|---|---|---|
| `DOCUMENT_SYNC_MAX_AUTO_RETRIES = 3` | `PhysicsPaintStudio.tsx:359` | bounds the auto re-flush so the debounce never becomes an unbounded retry loop (efx-async-orchestration) |
| `documentSyncPushFailuresRef` | `:3919` | the failure streak that keeps a dropped send owed |
| `documentSyncPushGuardRef.current = createDocumentSyncPushGuard()` in the `.catch` | `:3981` | re-arms the pre-resolve fingerprint latch so the same content stays retryable |
| clear-dirty INSIDE the mode gate | `:4023-4026`, `:4047-4050`, `:4080-4083` | a cleared flag must always imply a send was attempted |
| close gate reports a still-owed change | `:4012` + `:1919` | `dirty.peek() \|\| failures > 0` — the last flush of the session is never skipped |
| the deps arrays that make the re-arm reachable | `:4057` reads `documentSyncDirty.value`; `:4090` reads `interactionIdle.value` | **narrowing either deps array silently turns the re-arm into a no-op.** If your fix touches either effect, keep the render-time read. |

## Guardrails

- **No new transport.** No new event pair, no new IPC/Rust command, no `.mce`/manifest format change. Reuse `physic-paint:efx-paint-document` (the document pair) or `physic-paint:apply` (the stroke/applyPayload channel). 52.2 reference-only law holds.
- **No `app/src/efx-paint/document/**` shape change.** The document already carries the three surfaces; only the transfer is in question.
- **c7x is not re-opened.** No revision/identity authority change, no loop-clip lifecycle change.
- **If the root is structural — STOP.** Structural means any of: S1 a manifest/package format change or a 52.2 reference-only-law break; S2 a new independent transport rather than extending an existing pair; S3 c7x revision/identity authority or loop-clip lifecycle territory; S4 a Rust command or capability change. On a structural root: write the verdicts and probes into the evidence JSON, set `halt.fired = true`, write a SUMMARY whose first section is the halt report, commit the evidence, and return WITHOUT production code or pins.
- **Preact, always.** Consult `efx-preact-reactivity` before touching any component/hook/effect/store code: signals only, never `useState`; no render-body signal writes; narrow signal reads; identity-stable effect deps; every effect terminates. Consult `efx-async-orchestration` before touching any async/lifecycle path: every timer terminates, every retry is bounded, every promise has an owner.
- **Tests:** `pnpm --filter efx-motion-editor exec vitest run <path>`. Never watch mode. Never a one-off vitest config. Do not start the dev server or the app — the user runs it and does native UAT.
- **What this plan does NOT prove.** No unit leg can prove a real cross-webview `emitTo` delivery or a real `onCloseRequested`. That boundary is exactly what the five native UAT rows are for. Say so in the SUMMARY; never claim UAT.

<tasks>

<task type="tracer">
  <name>Task 1: Diagnose the three surfaces through the REAL chain with the four fidelity gaps closed, and write the raw evidence</name>
  <files>app/src/stores/efxPaintStudioOriginSync.scratch.test.ts, .planning/quick/260921-ffh-e21-uat-falsified-reference-selection-ba/260921-ffh-RED-EVIDENCE.json</files>
  <behavior>
    - The harness must fail loudly if the two realms share a module instance: the child's document and the parent's document must be independently readable and independently mutable, and the probe must print both side by side.
    - The harness must fail loudly if a probe is driven with a document the product would not build: every push-shaped probe must obtain its document from `serializeRuntimeIntoDocument(layerId)` and route it through `createDocumentSyncPushGuard().evaluate(...)`. A probe that hands a hand-built document to the transport is NOT this plan's probe.
  </behavior>
  <action>
    Build ONE two-realm chain harness and run the diagnosis through it. Do not implement any fix in this task.

    STEP 0 — the realm control (FG-3). In `app/src/stores/efxPaintStudioOriginSync.scratch.test.ts`, obtain TWO independent module instances: `const child = await import('./efxPaintStore')` and, after `vi.resetModules()`, `const parent = await import('./efxPaintStore')` (same for `./physicPaintStore`). Assert `child.getDocument(L) !== parent.getDocument(L)` for the same layerId, and record that assertion's outcome in the evidence as the FG-3 control. e21 faked this with `resetEfxPaintStore()` mid-test — do not repeat that shape.

    STEP 1 — capture the pre-push document per surface. In the CHILD realm, register a base document for the layer (mirror the shape `physicsPaintBridgeTransport.test.ts#baseDocument` builds, but build it in the CHILD realm) and record `buildEfxPaintDocumentRevision(child.getEfxPaintDocument(L))` as `revisionBefore`. Then drive each surface through the SAME call sequence its real UI handler performs — read the handler bodies at `PhysicsPaintStudio.tsx:2866-2875`, `:4209-4285`, `:4298-4329` and reproduce the sequence, not just the first store call: (1) `setPhotoReferenceSource(L, [refs])` (+ the `recordBackgroundEdit` that follows it), (2) `addBackgroundClip(L, { startFrame, sourceFrameRefs, repeat })` (+ the hydration + `getFlattenedFrame` that follow it), (3) `addTrack(L)` THEN `setActiveTrackId(L, trackId)`. Record per surface: the mutation's `ok`, `children.efxPaintVersion` before/after, and `revisionAfterMutation`. **State in the evidence, explicitly, that these are the handler's call sequences reproduced on the child store and not the mounted component** — the component cannot be mounted in vitest (Tauri window/engine deps), and naming that limit is part of the verdict, not a footnote.

    STEP 2 — FG-2, the serialize diff. For each surface: call `child.serializeRuntimeIntoDocument(L)` and record `d1 = buildEfxPaintDocumentRevision(before serialize)`, `d2 = buildEfxPaintDocumentRevision(returned document)`, `d3 = buildEfxPaintDocumentRevision(child.getEfxPaintDocument(L))` AFTER the call, and whether the surface is still present in each. **If d3 shows the surface reverted, or the returned document differs from `child.getEfxPaintDocument(L)` after the write-back at `efxPaintStore.ts:1731`, record that verbatim — it is the FG-2 finding.** Also record the `documentRevision` before and after (`:1730`).

    STEP 3 — FG-1, the guard in the loop. For each surface, run the composition `pushLiveProjection` actually runs: `const guard = createDocumentSyncPushGuard(); const doc = guard.evaluate(() => child.serializeRuntimeIntoDocument(L), () => child.efxPaintVersion.peek());` and record whether `doc` is `null`. Then run it a SECOND time on the same guard (the re-entrant shape: the push's own serialize calls `_notifyChange()`, which re-arms the dirty flag and re-fires the flush) and record whether the second `evaluate` returns `null`. **A `null` on either call, paired with a cleared `documentSyncDirty`, is the H2 drop shape — record the pair as one finding.** If `serializeRuntimeIntoDocument` throws, record the throw AND the `pushLiveProjection` fallback (`getEfxPaintDocument(layerId)`, `:3927`) separately — they are different documents.

    STEP 4 — the crossing, against a LIVE parent (FG-3 second half). Stop using a hand-fed handler. Install the REAL listener in the PARENT realm (`parent`'s `installPhysicPaintEfxPaintDocumentListener()` via `physicPaintBridge`) with the `@tauri-apps/api/event` `emitTo`/`listen` stubs that `physicsPaintBridgeTransport.test.ts:6-12` already establishes, and capture the emitted payload from the child realm's real `sendEfxPaintDocumentSync(doc, 'Tauri')`. Register a REALISTIC parent document BEFORE the dispatch (the shape a second Studio launch would have left), record `parentRevisionBefore = buildEfxPaintDocumentRevision(parent.getEfxPaintDocument(L))`, then dispatch the captured payload through the installed handler and record: `parentRevisionAfter`, whether the parent's document carries each surface, and whether the `:3283` idempotency early-return fired. A skipped apply is a verdict datum — record it as one.

    STEP 5 — the reopen carrier. In the PARENT realm, call the real `createPhysicPaintLaunchContext(...)` on the state STEP 4 left and record whether the carrier's document carries each surface, plus whether `parseCanonicalPhysicsPaintLaunchValue` accepted it (`physicPaintBridge.ts:3540`).

    STEP 6 — FG-4, teardown. Drive the close sequence's decisions with the real inputs and record them: (a) the gate predicate as `PhysicsPaintStudio.tsx:1919` composes it — `workflowMode === 'roto' && Boolean(strokeCount || hasPendingLivePixels || playbackHasPending || (dirty.peek() || failures > 0))` — evaluated for the state left by each surface's mutation; (b) the `flushDocumentSyncRef` body's decisions (`:4013-4027`): dirty state, `mode`, and whether the gate let the push through; (c) whether the push that follows used the guard's `null` path. Record which close paths traverse the hook: `handleWorkflowClose` (`:1943-1947`) routes through `getCurrentWindow().close()` → `onCloseRequested` (`usePhysicsPaintParentBridge.ts:33`), so the header button, the OS close and any parent-driven close all land on the same handler — confirm that by reading and record the confirmation.

    STEP 7 — H4, the strokes contrast, stated with evidence. Trace both channels side by side and record: the event name, the sender function and its call sites, whether an ack exists, and whether a dirty flag / debounce / close flush stands between the mutation and the wire. For strokes: `sendPhysicPaintApplyPayload` (`physicsPaintBridgeTransport.ts:420`), `physic-paint:apply` (`physicPaintBridge.ts:89`) with the `apply-result` pair (`:90`), called from `PhysicsPaintStudio.tsx:1469` (also `:841`, `:1866`). For the three surfaces: `sendEfxPaintDocumentSync` (`:323`), `physic-paint:efx-paint-document` (`:97`), no ack, reached only through the dirty/guard/close chain. **Write the sentence that explains, from this evidence, why a stroke survives teardown and these three do not — or record that the evidence does not support such a sentence.**

    STEP 8 — verdicts, structural check, halt. For EACH surface write one verdict: `a` = the mutation never leaves the child (name the exact link and the file:line), `b` = it leaves but the parent ignores or rejects it, `c` = the parent holds it but the launch drops it. Record the structural booleans S1..S4 from the objective and set `halt.fired`. **If any root is structural: STOP after this step.** Write the evidence, set `halt.fired = true`, write the SUMMARY skeleton with the halt report as its first section, commit the evidence artifact, and return without Task 2 or Task 3.

    STEP 9 — write `260921-ffh-RED-EVIDENCE.json` in the format of `260921-e21-RED-EVIDENCE.json` (same top-level keys where they apply: `task`, `planBase`, `headAtStart`, `command`, `exitCode`, `verdicts`, `structuralCheck`, `pins`, `probes`, `halt`, `gate`) plus two keys e21 had no reason to carry: **`fidelityGaps`** — one entry per FG-1..FG-4 recording what the gap was, how this run closed it, and the observed control result — and **`realmIsolation`** — the STEP 0 assertion's outcome. Raw probe outputs go in verbatim; never summarise a probe you did not run.

    Commit: `test(260921-ffh): diagnose the three Studio-origin surfaces through the real child→parent chain (FG-1..FG-4 closed)`
  </action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor &amp;&amp; pnpm --filter efx-motion-editor exec vitest run src/stores/efxPaintStudioOriginSync.scratch.test.ts 2>&1 | tail -40 ; node -e "const fs=require('fs');const p='/Users/lmarques/Dev/efx-motion-editor/.planning/quick/260921-ffh-e21-uat-falsified-reference-selection-ba/260921-ffh-RED-EVIDENCE.json';const e=JSON.parse(fs.readFileSync(p,'utf8'));const v=e.verdicts||[];const h=e.halt||{};const fg=Object.keys(e.fidelityGaps||{});if(v.length!==3){console.error('need 3 verdicts');process.exit(1)}if(v.some(x=>!['a','b','c'].includes(x.verdict))){console.error('each verdict must be a, b or c');process.exit(1)}if(v.some(x=>typeof x.link!=='string'||x.link.length===0)){console.error('each verdict must name its link');process.exit(1)}for(const id of ['FG-1','FG-2','FG-3','FG-4']){if(!fg.includes(id)){console.error('missing fidelity control '+id);process.exit(1)}}if(!e.realmIsolation||e.realmIsolation.separateInstances!==true){console.error('FG-3 realm isolation control did not pass');process.exit(1)}if(h.fired===true){console.error('HALT: structural root recorded — stop after Task 1 and report');process.exit(2)}if(h.proceedToTask2!==true){console.error('halt decision not recorded');process.exit(1)}console.log('verdicts, fidelity controls and halt decision recorded');"</automated>
  </verify>
  <done>
    The two-realm harness exists with the FG-3 separation control passing; the three surfaces were each driven as their real handler drives them; the evidence JSON carries three verdicts that each name a link, the four FG controls with their observed results, the realm-isolation control, the S1..S4 booleans and the halt decision; the gate exits 0 and would exit 2 on a structural root.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Pin the three surfaces RED, behaviourally, through the real chain</name>
  <files>app/src/stores/efxPaintStudioOriginSync.scratch.test.ts, .planning/quick/260921-ffh-e21-uat-falsified-reference-selection-ba/260921-ffh-RED-EVIDENCE.json</files>
  <behavior>
    - Three pins, one per surface (reference selection, background keyframe, (+) track), each asserting an OBSERVABLE end-state in the PARENT realm, not a property of the child.
    - Every pin must fail at base for a diagnosed reason that names the link — never a missing symbol, never a compile error, never a source-text offset.
    - Positive control: a fourth leg drives a STROKE-shaped mutation through its channel and asserts the parent receives it, so a green stroke leg and a red surface leg sit in the same run and the contrast is executable, not narrated.
    - Negative control: the same pins must pass once the diagnosed link is repaired in Task 3, with no assertion weakened and none deleted.
  </behavior>
  <action>
    Convert Task 1's probes into three BEHAVIOURAL pins in `efxPaintStudioOriginSync.scratch.test.ts`. Each pin drives the full real chain — child-realm mutation (the handler's call sequence) → `serializeRuntimeIntoDocument` → the real `createDocumentSyncPushGuard().evaluate` → the real `sendEfxPaintDocumentSync` → the captured payload dispatched through the REAL listener installed in the parent realm → assert the PARENT realm's document — and, for the reference and background pins, the real `createPhysicPaintLaunchContext` carrier as the reopen half. **No source-text read, no file-offset comparison, no `expect(source).toContain(...)`. If a pin needs a value that only a component closure can produce, get it by driving the real exported function or by extracting the closure into a testable module — never by reading the component's text.**

    Pin each surface on the assertion Task 1's verdict makes RED: reference selection → the parent document's `photoReference` carries the selected refs; background keyframe → the parent document's `background.clips` carries the clip at its `startFrame` with its `sourceFrameRefs`; (+) track → the parent document's `tracks` carries the added track id WITH whatever content the surface added. Where the verdict named a link INSIDE the child wiring (the guard's null path, the serialize write-back, the clear-before-send, the close gate), ALSO pin that link behaviourally: drive the wiring's decision with the real inputs and assert the observable consequence (the change is still owed / no send occurred / the document still carries the surface), so the pin fails at base for the exact reason the verdict named.

    If, and only if, the verdict names a link that lives inside a component-local closure with no exported entry, HOIST that link into a focused, testable module as a PURE MOVE — no behaviour change, no new signal, no new timer, no `useState` — and pin the hoisted function. Contract for the hoist: (a) the component keeps calling the same behaviour at the same points; (b) the four e21 invariants in the objective's table move WITH the code and stay intact, including the two effect deps arrays that make the re-arm reachable; (c) any pre-existing source-shape contract in `PhysicsPaintStudio.test.ts` that reads the hoisted text is re-pointed at the new module in the SAME commit and is never deleted or loosened. Keep the hoist as small as the verified link allows.

    Add the two controls. POSITIVE (the strokes contrast, executable): drive a stroke-shaped payload through `sendPhysicPaintApplyPayload` in the same harness and assert the parent realm's state changed — a green control in the same run is the H4 contrast as evidence rather than narration. NEGATIVE (the e21 guardrail): assert that the four e21 invariants are still present and still behave — a failed send still re-arms the guard under a bounded budget, a cleared dirty flag still implies an attempted push — driven through real calls, not text.

    Capture the verbatim RED run for all three pins into `260921-ffh-RED-EVIDENCE.json` under `pins` (one entry per pin: `surface`, `assertion`, `redObserved`, `failureMessage`, `link`). Do not rewrite a pin to accommodate an unexpected pass: **a pin that is GREEN at base is a verdict datum, not a failure.** Per Task 1's own rule, re-point it at the link the verdict named — and keep the original end-to-end assertion as a permanent green lock rather than dropping it. Recording the replacement, the reason and the kept lock in `replacedPins` is how e21 handled the identical situation.

    Commit: `test(260921-ffh): RED — the three Studio-origin surfaces pinned behaviourally through the real child→parent chain`
  </action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor &amp;&amp; pnpm --filter efx-motion-editor exec vitest run src/stores/efxPaintStudioOriginSync.scratch.test.ts 2>&1 | tail -60 ; node -e "const fs=require('fs');const p='/Users/lmarques/Dev/efx-motion-editor/.planning/quick/260921-ffh-e21-uat-falsified-reference-selection-ba/260921-ffh-RED-EVIDENCE.json';const e=JSON.parse(fs.readFileSync(p,'utf8'));const pins=e.pins||[];if(pins.length!==3){console.error('need 3 pins');process.exit(1)}if(pins.some(x=>x.redObserved!==true)){console.error('all three pins must be observed RED at base');process.exit(1)}if(pins.some(x=>typeof x.failureMessage!=='string'||x.failureMessage.length===0)){console.error('each pin must record its failure message');process.exit(1)}if(pins.some(x=>/toContain|readFileSync|offset|indexOf/.test(x.assertion||''))){console.error('a pin is textual/source-shape — this plan bans that');process.exit(1)}console.log('three behavioural pins observed RED');"</automated>
  </verify>
  <done>
    Three behavioural pins exist, all three observed RED at base for a reason that names the diagnosed link, each recorded with its verbatim failure message in the evidence JSON; the strokes positive control is green in the same run; no pin asserts on source text or a file offset; the e21 guardrail invariants are behaviourally asserted as still holding.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Fix the diagnosed link inside the existing channel, and re-verify the guardrails</name>
  <files>app/src/components/physic-paint/PhysicsPaintStudio.tsx, app/src/components/physic-paint/bridge/documentSyncPushGuard.ts, app/src/lib/physicPaintBridge.ts, app/src/components/physic-paint/bridge/physicsPaintBridgeTransport.ts, app/src/components/physic-paint/PhysicsPaintStudio.test.ts, .planning/quick/260921-ffh-e21-uat-falsified-reference-selection-ba/260921-ffh-SUMMARY.md</files>
  <behavior>
    - All three pins from Task 2 pass with real assertions — none weakened, none deleted.
    - The strokes positive control still passes.
    - The e21 guardrail invariants are still present AND still behave: a failed send still re-arms the guard within a bounded budget; a cleared dirty flag still implies an attempted push.
    - Every touched test file passes and `tsc --noEmit` is clean.
  </behavior>
  <action>
    Fix ONLY the link Task 1 named, inside the file that owns it. Touch no file outside the set that link needs; every file listed in this task's `<files>` is authorized but none is required — modify the minimum.

    Shape the fix by the verdict, not by the hypothesis:
    - If the verdict names the GUARD's null path (H2/FG-1): a duplicate-fingerprint decision must never consume a mutation. Make the composition observable — a `null` from `evaluate` must leave the change owed (still dirty, or explicitly re-marked) rather than cleared by a caller that already set `documentSyncDirty.value = false` before the call. Keep the fingerprint dedupe: it exists to stop the push's own re-entrant re-fire (`PhysicsPaintStudio.tsx:3905-3908` — the push's serialize bumps `efxPaintVersion`, which re-fires the immediate push effect, crossing the bridge twice per gesture), so removing it is a regression, not a fix.
    - If the verdict names the SERIALIZE write-back (H2/FG-2): `serializeRuntimeIntoDocument` (`efxPaintStore.ts:1714-1731`) must not drop document-only state the runtime does not carry. Repair it where the write-back happens, and leave the revision-bump contract intact — the parent's idempotency guard depends on `buildEfxPaintDocumentRevision` being faithful, so a fix that makes the bump lie is not a fix.
    - If the verdict names TEARDOWN (H3/FG-4): a change still owed when the close gate is read must be sent before the window is destroyed. Do not make the gate more permissive to force a flush; make the owed state survive into the gate. Every timer and every await must still terminate (efx-async-orchestration).
    - If the verdict names the PARENT APPLY or the CARRIER (H3/(b)/(c)): repair it in `physicPaintBridge.ts`. Never turn the fail-closed parse into a permissive one: a widened parse without a matching bound is a regression, and the `:3283` idempotency guard must still skip only genuinely identical content.

    **The e21 invariants are a hard constraint, not a suggestion.** After your fix, all six rows of the objective's guardrail table must still hold. If your fix changes a flush path, re-check that the debounce effect's deps still read `documentSyncDirty.value` (`:4057`) and the gesture effect's deps still read `interactionIdle.value` (`:4090`) — narrowing either silently makes the re-arm unreachable. If a pre-existing source-shape contract in `PhysicsPaintStudio.test.ts` reads text your fix moved, re-point it at the new location in the same commit and never delete or loosen it.

    Then write `260921-ffh-SUMMARY.md` with: the per-surface verdicts and the link each names; the four fidelity controls and what each one changed about the conclusion; the before/after of the diagnosed seam; the verbatim RED→GREEN output; the two-channel H4 contrast with its evidence; the scope gate (`git diff --name-only <base>..HEAD`); the guardrail audit, invariant by invariant; the gate results; and the five native UAT rows from the brief marked **PENDING — native UAT is the user's**, never claimed.

    Commit (GREEN and the SUMMARY may be separate commits): `fix(260921-ffh): <the diagnosed link> — the three Studio-origin surfaces reach the save realm before Studio close`
  </action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor &amp;&amp; pnpm --filter efx-motion-editor exec vitest run src/stores/efxPaintStudioOriginSync.scratch.test.ts src/components/physic-paint/bridge/physicsPaintBridgeTransport.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts src/components/physic-paint/bridge/documentSyncPushGuard.test.ts src/stores/efxPaintChildParentSync.scratch.test.ts &amp;&amp; pnpm --filter efx-motion-editor exec tsc --noEmit</automated>
  </verify>
  <done>
    The three pins pass with real assertions and none weakened; the strokes control and the e21 guardrail assertions still pass; the five-file row and `tsc --noEmit` are clean; the SUMMARY records the verdicts, the fidelity controls, the RED→GREEN output, the guardrail audit and the five native UAT rows as PENDING; no new event pair, no IPC/Rust command and no `.mce`/manifest change appears in the diff.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| child Studio webview → main webview | the child→parent document transport; the document is a Tauri event payload crossing a process/webview boundary |
| parent webview → project package | the parent's save writes the layer sub-file; the sheet is written by the realm that owns the save path |
| (none new) | this plan adds no external service, no network surface, no new capability |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-260921-ffh-01 | Tampering | `parseEfxPaintDocument` at the parent apply boundary (`physicPaintBridge.ts:3277`) | high | mitigate | The fail-closed parse is untouched. Any fix must not widen the accepted shape to force an apply through: a widened parse without a matching bound is the regression this row exists to catch. The Task 3 verify row runs the transport and store suites that own this boundary. |
| T-260921-ffh-02 | Tampering | the parent's idempotency / anti-rollback guard (`physicPaintBridge.ts:3283`) | medium | mitigate | The guard must keep skipping only genuinely identical content. A fix that makes the child's revision bump infaithful (e.g. bumping without a content change) would let a stale document overwrite a newer one. Pinned by the e21 guardrail behaviour assertion in Task 2 and by the transport suite. |
| T-260921-ffh-03 | Denial of service | the document push retry path (`PhysicsPaintStudio.tsx:3976-3986`) | medium | mitigate | The retry budget stays bounded by `DOCUMENT_SYNC_MAX_AUTO_RETRIES = 3` (guardrail 1). A fix that re-marks dirty without a bound turns the 2s debounce into an unbounded retry loop — the exact shape `efx-async-orchestration` forbids. Task 2's guardrail assertion drives it. |
| T-260921-ffh-04 | Denial of service | a change owed at close but never sent (`PhysicsPaintStudio.tsx:4012`, `:1919`) | medium | mitigate | A cleared flag must always imply an attempted send (guardrail 1, task 2's negative control). The verified fix must keep the owed state visible to the close gate; a fix that makes the gate fire more often without making the send happen only adds close latency. |
| T-260921-ffh-05 | Information disclosure | the document payload crossing the child→parent event | low | accept | Content and recipients are unchanged: the same event pair, the same payload shape, the same two windows inside one local app. No new recipient, no network, no new logging of document bytes. |
| T-260921-ffh-SC | Tampering | dependency installs | n/a | accept | This plan installs no package: no `package.json`, lockfile or dependency-manifest change appears in the authorized file set, so the package-legitimacy gate does not fire and no human checkpoint is required. |
</threat_model>

<verification>
Overall phase checks, in order, after Task 3:

1. `cd /Users/lmarques/Dev/efx-motion-editor && pnpm --filter efx-motion-editor exec vitest run src/stores/efxPaintStudioOriginSync.scratch.test.ts src/components/physic-paint/bridge/physicsPaintBridgeTransport.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts src/components/physic-paint/bridge/documentSyncPushGuard.test.ts src/stores/efxPaintChildParentSync.scratch.test.ts` — exit 0.
2. `cd /Users/lmarques/Dev/efx-motion-editor && pnpm --filter efx-motion-editor exec tsc --noEmit` — exit 0, no output.
3. Full suite: `cd /Users/lmarques/Dev/efx-motion-editor && pnpm --filter efx-motion-editor exec vitest run` — exit 0, and the passed count equals the base count plus exactly the new legs (state the base count you observed and the delta you added; zero failures, zero absorbed).
4. bjm regression: `vitest run` on `physicsPaintBridgeTransport` + `PhysicsPaintStudio` + `BackgroundAssetPickerView` + `projectStore` + `physicPaintStore` — all present and green.
5. c7x regression: `vitest run src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts src/lib/physicPaintBridge.test.ts` — green, and `comm -12` between the c7x commit's file list and this plan's diff is empty.
6. Scope gate: `git diff --name-only <planBase>..HEAD` — every path is inside this plan's authorized set; no `src-tauri/`, no capability file, no dependency manifest, no `app/src/efx-paint/document/**`, no `app/src/stores/efxPaintStore.ts` unless the verdict named the serialize write-back.
7. Event-pair gate: read the diff and confirm no new event-name string constant is introduced — the transfer stays on the pre-existing `physic-paint:efx-paint-document` (the document pair) or `physic-paint:apply` (the stroke/applyPayload channel), and no `invoke(` call names a Rust command that did not already exist.
</verification>

<success_criteria>
- A two-realm harness exists that cannot pass on shared module state (FG-3 control asserted, not assumed).
- Each of the three surfaces has a verdict that names its link, with raw probe output behind it.
- The four fidelity gaps are each recorded with what the gap was, how this run closed it, and the observed control result — so a future reader can tell what this run saw that e21's could not.
- Three behavioural pins were RED at base for diagnosed reasons and are GREEN after the fix, with no assertion weakened and none deleted.
- The strokes contrast is recorded with evidence, not narrated.
- The fix reuses an existing channel: no new event pair, no IPC/Rust command, no `.mce`/manifest change.
- All six e21 guardrail invariants still hold, verified behaviourally where the fix touched them.
- The SUMMARY records the five native UAT rows as PENDING.
</success_criteria>

<output>
Create `.planning/quick/260921-ffh-e21-uat-falsified-reference-selection-ba/260921-ffh-SUMMARY.md` when done.
</output>
