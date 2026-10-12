---
phase: quick-260921-pgd
plan: 260921-pgd
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/lib/physicPaintLayerGestureProbe.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
  - app/src/lib/physicPaintBridge.ts
  - .planning/quick/260921-pgd-physic-paint-layers-beyond-the-first-are/260921-pgd-SUMMARY.md
autonomous: true
requirements: []
estimate:
  tokens: 52000
  raw_tokens: 52000
  tasks: 3
  confidence: low
must_haves:
  truths:
    - "Moving a key, click-positioning onto an interpolated frame, and moving/stretching a rail all work on physic-paint layer 2+ exactly as they do on layer 1 — layer creation order is not an input to any gesture decision."
    - "Every ranked hypothesis is closed by raw evidence read from the real stores or the real launch/child-realm paths — never by plausibility, and never by a harness that reused layer 1's track id."
    - "Zero production code is changed before a written verdict exists. If the verdict is STRUCTURAL, the task changes zero production code and ends with a report plus a probe-instrumentation handoff."
    - "If a fix lands, the failing gesture/gate was pinned RED on layer 2 first (store-level equivalent accepted) and is GREEN after — same assertion, same harness, no throwaway test."
    - "The primary-noun decision for 'the active track id' is stated explicitly in the verdict when the mechanism lands on that seam: which of the two readers is canonical, and what the other becomes."
    - "Native UAT is left explicitly pending — never claimed."
  artifacts:
    - app/src/lib/physicPaintLayerGestureProbe.test.ts — the diagnosis harness: layer 1 vs layer 2+ built through the REAL creation and launch paths with DISTINCT track ids, asserting the gesture-time inputs (key records, drag availability, lease availability, move-member sets, launch range) side by side, with raw output recorded
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx — ONLY under a NON-STRUCTURAL verdict: the stale-carrier guard, the active-track reader, the rail-model invalidation, or the launch adoption at the named seam
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx — ONLY under a NON-STRUCTURAL verdict naming a gesture gate (drag lock, pointerdown gate, drag classification)
    - app/src/lib/physicPaintBridge.ts — ONLY under a NON-STRUCTURAL verdict naming the launch payload, the carried runtime for non-active tracks, or the layer-local range
    - .planning/quick/260921-pgd-physic-paint-layers-beyond-the-first-are/260921-pgd-SUMMARY.md — the per-hypothesis verdict with raw evidence, the non-structural/structural ruling, RED/GREEN output if a fix landed, gates, and the pending native UAT rows
  key_links:
    - "PhysicsPaintWorkflowStrip.tsx:1935,1950-1951 — the single shared drag gate. `keyUtilitiesDisabledByBusyState = props.ready === false || Boolean(props.mutationLocked) || Boolean(props.keyActionInFlight) || Boolean(sessionKeyAvailability?.busy) || Boolean(rotoDragPreview?.pending)`; `physicalDragAvailable = physicalActions?.canDragKey.value ?? false`; `rotoDragLocked = keyUtilitiesDisabledByBusyState || !physicalActions || !physicalDragAvailable`. This ONE flag feeds the key-drag pointerdown gate (:3424), the drag classifier (:3304, :3345), the cell-level `dragEligible` (:3953), and the rail-side busy predicates (:2340, :3191). A single true term here kills key move, rail edit, and push together — which is exactly the reported symptom shape, so this flag is the first thing to read at gesture time."
    - "useRotoTimelineActions.ts:3763-3780 — `computeDragAvailability`, the term inside `canDragKey`. It requires (a) a live launch context, (b) `pendingOperationId === null`, (c) a non-null `selectedKeyId`, and (d) that selected key present in `getRotoKeyRecords()`. Terms (c)/(d) read the Studio's `rotoKeyRecords`, so an empty or stale rail model for layer 2 turns `canDragKey` false and silently locks the whole strip."
    - "PhysicsPaintStudio.tsx:687-693 — `rotoKeyRecords` / `rotoIncomingInterpolationBreakKeyIds` / `rotoInterpolationState` / `rotoLoopClips` memos. Each reads `studioActiveTrackId()` but is keyed only on `[launchContext?.layerId, throttledPaintRevision.value, throttledEfxRevision.value]`. There is no track-id dependency: the ONLY invalidation channel on a track switch is `throttledEfxRevision`, and both throttles are `useTrailingThrottledRevision(physicPaintVersion | efxPaintVersion, 1000)` (:437, :444). A layer switch that does not move the throttled value leaves the previous track's model in place."
    - "PhysicsPaintStudio.tsx:946-956 — the one-slot cached-frames carrier. `latestRotoFramesTrackRef.current !== activeTrackIdNow` is the guard, and the reseed body runs only when `physicPaintStore.getRotoPhysicalDocument(launchContext.layerId, activeTrackIdNow)` is non-null. If the resolved track id has no document, NEITHER the ref NOR the guard ref is updated — the carrier keeps the previous layer's frames permanently and the guard can never recover. That ref is the module's `getStoreRealKeyFrames()` source (:1575) and the `cachedRotoFrames` input to `useRotoTimelineModel` (:959)."
    - "PhysicsPaintStudio.tsx:465-469 — the two readers of 'the active track id'. `studioActiveTrackId()` prefers `getEfxPaintDocument(lc.layerId)?.activeTrackId` and falls back to `trackIdOfLaunch(lc)` = `lc?.document?.activeTrackId ?? ''`. Two readers that can disagree; every store read in the Studio goes through the first, while the launch seed and `latestRotoFramesTrackRef` initialiser use the second."
    - "PhysicPaintStudio.tsx:1095-1114 — `physicalMutationAvailable` = `physicPaintStore.isRotoPhysicalOperationAvailable(projectContextId, launchContext.layerId, studioActiveTrackId())`; `mutationLocked = rotoScript.mutationLocked.value || !physicalMutationAvailable.value`. The store predicate (physicPaintStore.ts:3483-3489) is a plain `!map.has(scope)` against the scope `${len}:${projectContextId}${len}:${layerId}${len}:${trackId}` (:887-889). A lease left held for this exact layer+track locks the strip with no visible owner."
    - "physicPaintBridge.ts:3437-3547 — `createPhysicPaintLaunchContext`, the only producer of the gesture's launch context: track id from `getEfxPaintDocument(layerId)?.activeTrackId ?? ''`, `getLayerLocalTimelineRange(layer)` (:3672-3675 → frameMap `resolveSequenceTimelineRange`, fx branch uses `seq.inFrame`/`seq.outFrame`), `localFrame = Math.trunc(frame) - timelineRange.globalStart`, then a carrier whose active track carries `physical` and every other track carries `extractRuntimeStateForDocument(layerId, track.id)`."
    - "AddFxMenu.tsx:137-161 — the real creation path. `createFxSequence('Physic Paint', physicPaintLayer, totalFrames.peek())` defaults `inFrame: 0`, BUT the isolated branch passes `{ inFrame: isolatedInFrame, outFrame: isolatedOutFrame }` (sequenceStore.ts:241-268). A second layer created while a sub-range is isolated can therefore get a non-zero `inFrame` while its records were authored against a zero-based rail."
---

<objective>
Diagnose — and only then, if the verdict permits, fix — the interaction deadness of physic-paint layers beyond the first: on a physic-paint layer added in the MAIN app (2nd layer onwards), a key cannot be moved and a rail cannot be edited, while the same gestures work on the first layer. Still live after 260921-c7x.

Purpose: this is a singular→plural defect. The codebase was built and UAT-validated with one physic-paint layer; c7x already proved that this class of bug hides in single-slot carriers (its `pendingRef`/`inFlightRef` latch was one shared slot for all layers, and its layer-2 leg was falsified only because it reused layer 1's track id). This plan spends its first task proving WHICH carrier or gate is layer-scoped before touching production code, because every cheap fix in this area is a guess until the failing term is read at gesture time.

Output: a written per-hypothesis verdict with raw evidence, plus either (a) a bounded RED-first fix at the named seam, or (b) a reported structural finding with zero production changes and a probe-instrumentation handoff for the user. Plus a SUMMARY. Native UAT stays pending in both branches.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/260921-c7x-physical-edit-cluster-result-mismatch-ti/260921-c7x-SUMMARY.md

Verified anchors (read these before writing a probe; do not re-grep them):

- app/src/lib/physicPaintBridge.ts:3437-3547 — `createPhysicPaintLaunchContext`, the launch door.
- app/src/lib/physicPaintBridge.ts:3672-3675 — `getLayerLocalTimelineRange`.
- app/src/lib/physicPaintBridge.ts:694, :1633, :2098 — every layer lookup is BY ID (`candidate.id === request.layerId` or the `candidate.source.layerId === request.layerId` form). There is no index-addressed physic-paint access anywhere in the bridge.
- app/src/components/physic-paint/PhysicsPaintStudio.tsx:427-428, :465-469, :522-535, :687-693, :940-969, :1008-1022, :1095-1114, :1573-1636.
- app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx:1770-1791, :1935-1961, :2793-2861, :2875-2877, :3296-3345, :3424, :3953.
- app/src/components/physic-paint/view/PhysicsPaintKeyRail.tsx:131, :136, :174-175 and PhysicsPaintLoopClipRail.tsx:181-185 — `isSetMember` is the orange paint + set tooltip classifier; `isMoveMember` is the pointer-down gate. Law from commit f2424b43: gate drags on move-membership, never on `isSetMember`.
- app/src/components/physic-paint/hooks/useRotoTimelineActions.ts:1838-1839, :3763-3780.
- app/src/lib/physicPaintBridge.test.ts:103-219 — the real-store harness: `TEST_TRACK_ID = 'track-1'`, `makeTrackDocument(layerId, trackId = TEST_TRACK_ID)`, `registerTrackDocument`, `seedPhysicalDocument` (capacity 600), `acquirePhysicalLease(layerId, projectContextId, trackId = TEST_TRACK_ID)`.
- app/src/stores/physicPaintStore.ts:424, :887-889, :3462-3550 — the lease map and scope.
- app/src/stores/efxPaintStore.ts:76-130, :183-207 — `registerDocument` does NOT mount a track runtime; `addTrack` does.
- app/src/components/timeline/AddFxMenu.tsx:137-161 and app/src/stores/sequenceStore.ts:241-268 — the real creation path.

Prior evidence that MUST NOT be re-litigated (c7x, raw output recorded):
`[c7x][layer-2] {"layerOne":{"ok":true,"stagedRevision":"physical-458-d0ee8bee"},"layerTwo":{"ok":true,"stagedRevision":"physical-458-d0ee8bee"}}` — layer identity is NOT misread on the settlement path (H-C falsified), and the c7x latch (one `pendingRef`/`inFlightRef` slot for all layers) is already fixed. Do not re-open either.

Harness fidelity gap to close in Task 1 (this is why c7x's layer-2 leg did not reproduce):
`physicPaintBridge.test.ts` reseeds BOTH layers under the single `TEST_TRACK_ID = 'track-1'` (:103, :108, :196, :213, :256). Live layers get a fresh UUID track id per document (`createEfxPaintDocument` → `crypto.randomUUID()`, efxPaintDocument.ts:164-183). Any probe that models layer 2 under `track-1` cannot see a track-id disagreement — the exact class of defect under suspicion. Task 1's harness MUST give each layer its own track id and MUST run the creation through `createFxSequence` + `registerDocument` + `addTrack` rather than directly seeding a document.

Pre-cleared leads (state them in the verdict as cleared, do not spend budget re-deriving):
- Bridge "wrong layer index": no index-addressed physic-paint access exists (see :694, :1633, :2098). Clear unless a probe contradicts it.
- `frameMap.ts:65` — `owner.layers.find(l => l.type === 'physic-paint')!` is the only literal "the physic-paint layer" singular access, but it is inside the content-empty enumeration branch (`:58 if (entries.length === 0)`) and only feeds passive paint markers. Clear unless a probe contradicts it.
- `createFxSequence` default `inFrame: 0` — a second layer is not different by construction at creation; the isolated branch of AddFxMenu.tsx:137-161 is the live asymmetry worth measuring.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Diagnose — read the real gesture-time inputs for layer 1 vs layer 2 and verdict every hypothesis</name>
  <files>app/src/lib/physicPaintLayerGestureProbe.test.ts</files>
  <read_first>
    app/src/lib/physicPaintBridge.test.ts (the harness to extend: :103-219 real-store helpers, and the layer-2 identity leg c7x added)
    app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts (the injected-port harness pattern, if the gesture predicate is the seam)
    app/src/components/physic-paint/roto/physicsPaintLaunchRevisionParity.test.ts (the `vi.resetModules()` two-realm parent/child pattern — the only existing model of the child realm's store)
    app/src/components/physic-paint/PhysicsPaintStudio.tsx:427-470, :522-535, :687-693, :940-969, :1095-1114, :1573-1636
    app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx:1935-1961, :3296-3345, :3424, :3953
    app/src/stores/physicPaintStore.ts:424, :887-889, :3462-3550
  </read_first>
  <action>
    Change ZERO production code. Create exactly one new file, `app/src/lib/physicPaintLayerGestureProbe.test.ts`, which builds TWO real physic-paint layers through the production paths and prints, side by side, every input the gesture decision reads. Then verdict the hypotheses in writing.

    Harness construction (closing the c7x fidelity gap — this is mandatory, a probe built on `track-1` for both layers is worthless here):
    1. Create layer 1 via the real path: `sequenceStore.createFxSequence('Physic Paint', physicPaintLayer, totalFrames.peek())` with a `crypto.randomUUID()` layer id whose `source` is `{ type: 'physic-paint', layerId }`, then `efxPaintStore.registerDocument(createEfxPaintDocument(layerId))` and `addTrack(layerId, ...)` so the document has a real active track. Repeat for layer 2 as an INDEPENDENT second sequence with its own fresh layer id, its own fresh document, and its own UUID track id. Never reuse a track id across layers.
    2. Seed each layer's records under ITS OWN track id (`seedPhysicalDocument(layerId, records, ...)` with the per-layer track id, not the shared default).
    3. Build each layer's launch context through the real door: `createPhysicPaintLaunchContext(layer, frame, canvas, fps, workflowLabel)`.
    4. For each layer, read and print: `getEfxPaintDocument(layerId)?.activeTrackId`; `launch.document?.activeTrackId` (the `trackIdOfLaunch` value); the launch's `startFrame` / the `getLayerLocalTimelineRange(layer)` result; `physicPaintStore.getRotoRealKeyRecords(layerId, <each of the two candidates above>).length`; `physicPaintStore.getRotoPhysicalDocument(layerId, <each candidate>)` null-or-present; `isRotoPhysicalOperationAvailable(projectContextId, layerId, <candidate>)`; and the full key set of the internal lease map so a lease stranded on any other layer/track is visible.
    5. Assert the gesture predicate directly where it is agent-reachable: call `useRotoTimelineActions` through its injected-port harness (or, if that proves impractical, call the exported/injected equivalent) with `getLaunchContext` / `getSelectedKeyId` / `getRotoKeyRecords` / `pendingOperationId` wired to the layer's real store reads, and print `computeDragAvailability(input).eligible` plus `.reason` for BOTH layers. The reason string is the verdict: it names which of the four terms failed (no launch / pending operation / no selected key / selected key absent from records).

    Verdict these hypotheses in writing, each with raw output and an explicit falsifier. Ranked by yield:

    H-1 (highest yield — one mechanism explains both dead families): the layer-2 rail model is empty or stale, so `canDragKey` is false and `rotoDragLocked` locks the whole strip. Two sub-arms to separate: (a) `rotoKeyRecords` reads zero because `studioActiveTrackId()` resolves to a track with no records — print which of the two candidate ids is non-empty; (b) the memo is stale because it has no track-id dependency (Studio :687-693) and its only invalidation channel on a track switch is `useTrailingThrottledRevision(..., 1000)` (:437, :444) — print the memo's inputs before and after a simulated `setActiveTrackId` and state whether the recompute is guaranteed or merely eventual. If (a): the mechanism is an identity disagreement between the two readers (`studioActiveTrackId()` live-document vs `trackIdOfLaunch(launch)), and the primary-noun decision must be stated explicitly. If (b): the mechanism is a missing dependency, and the two must be distinguished before either fix is proposed.

    H-2: the one-slot cached-frames carrier never reseeds for layer 2. `latestRotoFramesTrackRef.current !== activeTrackIdNow` (Studio :948) with a null `getRotoPhysicalDocument` result leaves BOTH the carrier and the guard untouched, so the carrier keeps the previous layer's frames forever. Probe: seed layer 1, then model the switch to layer 2 with a track id that has no document, and show whether the guard ever recovers. Falsifier: the guard updates on the first layer-2 render.

    H-3: a lease is held for this exact layer+track, so `mutationLocked` is permanently true (Studio :1095-1114, store :3483-3489, scope :887-889). Probe: print the lease map's keys and whether any scope targets the layer-2 track. Falsifier: no lease matches layer 2's scope and `physicalMutationAvailable` is true.

    H-4: layer-local range asymmetry. `createFxSequence` defaults `inFrame: 0`, but the isolated branch of AddFxMenu.tsx:137-161 passes the isolated range, and `getLayerLocalTimelineRange` → `resolveSequenceTimelineRange` feeds `localFrame = Math.trunc(frame) - timelineRange.globalStart`. Probe: build layer 2 with a non-zero `inFrame` and print the launch's `startFrame`, the resolved range, and whether the seeded records still land on populated rail frames. Falsifier: both layers resolve the same range shape and record frames.

    H-5: move-membership flags unpopulated for layer 2. Probe: at gesture time print `railSetMoveMembers.length` (Studio :1008-1022) and the derived `railSetMoveMemberKeyRailIds` / `railSetMoveMemberLoopIds`, plus `effectiveRailSetSelection.members` resolved against `keyRailSegments`. Falsifier: flags populate identically for both layers with the same selection.

    H-6 (structural arm — expect this to be the one that cannot be closed in-process): the child-realm store is never hydrated for layer 2's track. The child webview is a separate JS realm; c7x and the launch-parity suite both show the child re-imports the module graph. Probe: in the two-realm harness, read the child-realm store for layer 2's track right after the launch payload is applied, and print the payload's per-track `physical` presence. If the only reproduction is live/cross-webview, this is STRUCTURAL under this plan's rules.

    H-7 (cheapest discriminator — run it FIRST): does the pointerdown even reach the strip on layer 2? The gate at strip :3424 and the classifier at :3304 both silently return when `rotoDragLocked`. Before attributing anything to a term inside `rotoDragLocked`, establish whether the gesture is being refused by the gate or never arriving. Print the classifier's verdict and reason for a known-good coordinate, and count `document.querySelectorAll('[data-roto-app-frame]')`. If the event never arrives or the cells are absent for layer 2, the defect is upstream of the gate and every gate-internal hypothesis is moot.

    Verdict format (required, per hypothesis): hypothesis, probe, raw output, VERDICT (CONFIRMED / FALSIFIED / UNDECIDABLE-IN-PROCESS), and the falsifier that would have killed it. UNDECIDABLE-IN-PROCESS is a legitimate verdict and must be stated as such rather than upgraded to a fix.

    Then rule on the shape:
    - NON-STRUCTURAL — exactly one named seam, reproduced as a RED assertion inside this harness. State: the file and line of the seam, the single failing term, the RED assertion text, and the primary-noun decision if the seam is the active-track reader. Task 2 proceeds and this file KEEPS that assertion as its RED leg (no throwaway test).
    - STRUCTURAL — the mechanism needs a live two-realm reproduction, or the fix changes an abstraction (identity ownership, launch/carrier model) rather than a term. Then STOP: change zero production code, keep this file as the reproduction record, and hand Task 3 an explicit probe-instrumentation handoff — the exact log lines to add (unique `[pgd-probe]` prefix), which layer to open, which gesture to perform, and what to capture — so the user can produce the live evidence this plan cannot generate in-process.

    Constraints: use only the existing test setup (`vitest run`, never watch, never a one-off config). Do not run the app or the dev server — the user runs it. Do not leave `[pgd-probe]` instrumentation in production files; if a live probe is needed, it is specified in the handoff for the user, not committed.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run app/src/lib/physicPaintLayerGestureProbe.test.ts</automated>
  </verify>
  <done>
    `app/src/lib/physicPaintLayerGestureProbe.test.ts` exists, builds layer 1 and layer 2 through the real creation + launch paths with DISTINCT track ids, and prints the side-by-side gesture-time inputs. Every hypothesis H-1..H-7 carries a written verdict with raw output and a falsifier. A single NON-STRUCTURAL or STRUCTURAL ruling is written, naming the seam and (if applicable) the primary-noun decision — or naming the live evidence the handoff must capture. Zero production files changed. Output recorded verbatim for the SUMMARY.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: [CONDITIONAL — only under a NON-STRUCTURAL verdict] Fix the named seam, single assertion, minimal change</name>
  <files>app/src/lib/physicPaintLayerGestureProbe.test.ts, app/src/components/physic-paint/PhysicsPaintStudio.tsx, app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx, app/src/lib/physicPaintBridge.ts</files>
  <behavior>
    Preconditions this task inherits from Task 1 and must not widen:
    - The failing term is ON RECORD with raw output, and it is a single bounded term (an identity disagreement between the two active-track readers, a missing memo dependency, a non-recovering carrier guard, or a lease that must not be held), not a missing abstraction.
    - If the seam is the active-track reader, the primary-noun decision is already written in Task 1's ruling and this task implements exactly that ruling.
    - If Task 1 ruled STRUCTURAL, this task does not run at all — it is skipped, not narrowed, and Task 3 becomes the report.

    RED (before any production edit):
    - The probe assertion that failed in Task 1 is the RED leg. It MUST be a layer-2 assertion that fails at HEAD and would pass on layer 1 — proven by both sides printing in the same run. If Task 1's failing signal was only a printed value and not an assertion, promote exactly that value to an assertion now, still before the change.
    - Record the exact RED output verbatim for the SUMMARY. A fix without a recorded RED is not acceptable in this plan.

    GREEN (minimal change at the named seam only):
    - Change the failing term and nothing else. No refactor, no rename, no widened acceptance, no defensive fallback that hides the disagreement. If the fix requires a fallback, the fallback must be the named primary noun's value, not a new `??` chain.
    - If the seam is `studioActiveTrackId()` or `trackIdOfLaunch`: make the ruled reader canonical at every site that decides a gesture, including the memo deps at Studio :687-693 and the carrier guard at :948, and leave one comment stating the ruling. The losing reader must either be removed or be provably equal to the winner.
    - If the seam is the memo deps: add the track-identity signal to the dependency array so the layer switch is no longer dependent on the 1000 ms trailing throttle. Keep the throttle for the paint/efx revision channels — it exists for a reason (fresh-frame and readback pressure); do not remove it.
    - If the seam is the carrier guard (:948): the guard must advance even when the document is absent, so the carrier can never keep another layer's frames; the empty carrier is the correct state for a track with no document.
    - If the seam is a lease: release it at its true terminal point only. Do not clear the whole lease map, and do not bypass `isRotoPhysicalOperationAvailable` — a lease that is genuinely held must still lock.

    Guardrails (verify, do not re-litigate):
    - The single-rail drag routing law stays intact: drags gate on move-membership (`isMoveMember` / `railSetMoveMember*`), while `isSetMember` stays the orange paint + set tooltip classifier for a set of one. Do not collapse the two.
    - The cross-type rail ordering authority and the 43.3/43.4 native single-rail ghost/clamp/break path are untouched by this task.
    - No backward compatibility, no format changes, no persistence changes — this is a gesture-availability defect.

    GREEN proof: the same file, same run, the layer-2 assertion passes and the layer-1 assertion still passes. Then re-run the adjacent suites to prove no widening.
  </behavior>
  <action>
    Apply the minimal fix at the single seam named by Task 1's ruling, per the behavior contract above. Do not touch any file outside the named seam. Do not add tests beyond the RED leg already in the probe; if the seam is in the strip, confirm the strip's gate reads the same predicate the probe asserted, rather than introducing a second way to decide the same thing.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run app/src/lib/physicPaintLayerGestureProbe.test.ts app/src/lib/physicPaintBridge.test.ts app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts app/src/components/physic-paint/roto/physicsPaintLaunchRevisionParity.test.ts</automated>
  </verify>
  <done>
    A recorded RED on the layer-2 assertion (same harness, both layers printed in one run) followed by GREEN on the same assertion after the change; layer 1 still green; the four named suites pass; `pnpm --filter efx-motion-editor exec tsc --noEmit` clean. Exactly one production seam changed, with the primary-noun ruling stated in a comment if that was the seam. If Task 1 ruled STRUCTURAL, this task is skipped and its files stay untouched.
  </done>
</task>

<task type="auto">
  <name>Task 3: Gates, SUMMARY, and the pending native UAT rows</name>
  <files>.planning/quick/260921-pgd-physic-paint-layers-beyond-the-first-are/260921-pgd-SUMMARY.md</files>
  <action>
    Close the quick task in both branches.

    1. Run the type gate: `pnpm --filter efx-motion-editor exec tsc --noEmit`.
    2. Run the full suite: `pnpm --filter efx-motion-editor exec vitest run`. Compare against the 9 pre-existing failures recorded in STATE.md and report only the delta. Do not fix unrelated pre-existing failures in this task.
    3. Confirm no `[pgd-probe]` (or equivalent debug tag) instrumentation remains in any production file: `grep -rn "pgd-probe" app/src --include="*.ts" --include="*.tsx"` must return nothing outside the probe test file.
    4. Write `.planning/quick/260921-pgd-physic-paint-layers-beyond-the-first-are/260921-pgd-SUMMARY.md` with: the per-hypothesis verdict table (hypothesis, probe, raw output, verdict, falsifier) for H-1..H-7; the cleared pre-existing leads; the NON-STRUCTURAL/STRUCTURAL ruling and the seam (or the reason the mechanism is out of in-process reach); the primary-noun decision if the active-track reader was implicated; the RED output verbatim and the GREEN output if Task 2 ran; the exact files changed with line ranges; the gates' results including the pre-existing-failure delta; and an explicit statement that native UAT has NOT been performed.
    5. In the STRUCTURAL branch, the SUMMARY additionally carries the probe-instrumentation handoff as a numbered, copy-pasteable set of steps: the exact `[pgd-probe]` log lines (file, insertion point, expression), the layer to open, the gesture to perform, and the artifacts to capture — stated so the user can run it without further interpretation.
    6. List the native UAT rows as the acceptance evidence, marked PENDING, verbatim:
       1. Layer 2: move a key → commits.
       2. Layer 2: click-position onto an interpolated frame → works.
       3. Layer 2: move / stretch / move a rail → commits and persists.
       4. Regression: layer 1 unchanged; reveal rails still per item D state.
    7. Do NOT claim the defect is resolved. State it as "automated-ready, native UAT pending".

    Use the Write tool. Do not run the app or the dev server — the user runs it.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec tsc --noEmit && pnpm --filter efx-motion-editor exec vitest run 2>&1 | tail -25</automated>
  </verify>
  <done>
    `260921-pgd-SUMMARY.md` exists with the verdict table, the ruling, the raw output, the gates with the pre-existing-failure delta, the pending native UAT rows verbatim, and (in the structural branch) the probe-instrumentation handoff. `tsc --noEmit` clean. The full suite shows no new failures beyond the recorded pre-existing set. No debug instrumentation left in production files. The SUMMARY states automated-ready / native UAT pending — never done.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| main webview → Studio child webview | The launch payload carries project runtime state across realms; the child realm's store is a separately-imported module graph. Diagnosis touches this boundary when it models the child store. |
| project file → stores (read-only here) | Diagnosis reads persisted documents/records through the real stores. No new parser, no new input surface is introduced. |
| test harness → process-global store singletons | The probe mutates real store singletons inside a test run; a leaked mutation would corrupt other suites. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-pgd-01 | Information Disclosure | probe test output and any temporary `[pgd-probe]` logs | low | mitigate | Probe output prints counts, ids, booleans, and revision/reason strings only — never frame bytes, data URLs, canvas pixels, or filesystem paths. The probe is a test file, not shipped code; any live probe is specified for the user in the SUMMARY rather than committed, so no diagnostic log reaches a packaged build. |
| T-pgd-02 | Tampering | process-global store singletons (`physicPaintStore`, `efxPaintStore`, `sequenceStore`) during the probe run | low | mitigate | Follow the existing harness discipline in `physicPaintBridge.test.ts` and `physicsPaintLaunchRevisionParity.test.ts`: reset stores between cases, `vi.resetModules()` for the two-realm leg, and never leave a seeded document or an acquired lease across cases — a leaked lease would itself lock a later suite's gesture path and produce a false verdict. |
| T-pgd-03 | Denial of Service | probe suite runtime and the 1000 ms trailing throttles | low | accept | The probe is store-level and synchronous where possible; it must not `waitFor` a trailing throttle to flush (that would make the verdict timing-dependent and the suite slow). Where the throttle is the subject (H-1b), assert the dependency wiring rather than waiting for a flush. Rationale for accepting: worst case is a slow test file, not a shipped-surface failure. |
| T-pgd-04 | Elevation of Privilege | gesture availability gates (`rotoDragLocked`, `isRotoPhysicalOperationAvailable`, `computeDragAvailability`) | medium | mitigate | The fix must not widen acceptance. A lease that is genuinely held must still lock; `isRotoPhysicalOperationAvailable` must not be bypassed; the `pendingOperationId === null` term must stay. Task 2's guardrail requires the RED leg to be a layer-2-only assertion (layer 1 green before and after), so a fix that simply removes a gate fails the layer-1 side. The single-rail move-membership law must not be collapsed into `isSetMember`. |
| T-pgd-SC | Tampering | npm/pip/cargo installs | high | accept | No package-manager installs occur in this task: the probe uses the existing test setup, the existing stores, and the existing harness helpers. Rationale for accepting: with zero dependency changes there is no package-legitimacy surface to gate. Any future task that adds a dependency must reopen the Package Legitimacy Gate. |
</threat_model>

<verification>
- `pnpm --filter efx-motion-editor exec vitest run app/src/lib/physicPaintLayerGestureProbe.test.ts` — the probe runs and prints the layer 1 / layer 2 gesture-time inputs side by side.
- `pnpm --filter efx-motion-editor exec tsc --noEmit` — clean.
- `pnpm --filter efx-motion-editor exec vitest run` — no failures beyond the 9 pre-existing ones recorded in STATE.md.
- `grep -rn "pgd-probe" app/src --include="*.ts" --include="*.tsx"` — no matches outside the probe test file.
- Both branches: the SUMMARY contains a verdict for every hypothesis H-1..H-7 with raw output, and one explicit NON-STRUCTURAL or STRUCTURAL ruling.
- STRUCTURAL branch specific: zero production files changed — `git diff --stat` shows only the probe test file and the SUMMARY.
- NON-STRUCTURAL branch specific: the RED output is recorded verbatim before the fix and the same assertion is GREEN after, with layer 1 green on both sides.
</verification>

<human_verification>
Native UAT is the user's, and is PENDING. These rows are the acceptance evidence; the plan must not be reported as done before they pass.

1. Layer 2: move a key → commits.
2. Layer 2: click-position onto an interpolated frame → works.
3. Layer 2: move / stretch / move a rail → commits and persists.
4. Regression: layer 1 unchanged; reveal rails still per item D state.

In the STRUCTURAL branch, the user additionally runs the probe-instrumentation handoff from the SUMMARY and returns the captured `[pgd-probe]` output, which becomes the evidence for the follow-up task.
</human_verification>

<success_criteria>
- The mechanism is NAMED with raw evidence, or explicitly ruled out of in-process reach with the live evidence path specified — never left as a ranked guess.
- Zero production code changed before a written verdict; zero production code changed at all under a STRUCTURAL verdict.
- Any fix was pinned RED first on layer 2 and is GREEN after, with layer 1 unchanged in the same run.
- The primary-noun decision for "the active track id" is stated if and only if the seam lands there.
- The cleared pre-existing leads are recorded so the next task does not re-spend on them.
- `tsc --noEmit` clean, full suite with no new failures, no debug instrumentation in production files.
- SUMMARY written, native UAT rows listed verbatim as pending, and the defect reported as automated-ready — not done.
</success_criteria>

<output>
Create `.planning/quick/260921-pgd-physic-paint-layers-beyond-the-first-are/260921-pgd-SUMMARY.md` when done
</output>
