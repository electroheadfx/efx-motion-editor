---
phase: quick-260920-kov
plan: 260920-kov
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/stores/efxPaintStore.ts
  - app/src/stores/physicPaintStore.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts
  - app/src/stores/efxPaintStore.reveal.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoRevealBake.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoRegistryOwnership.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
autonomous: true
requirements: []
estimate:
  tokens: 48000
  raw_tokens: 48000
  tasks: 3
  confidence: low
must_haves:
  truths:
    - "A reveal-creation entry never hijacks a later legitimate action: after the reveal flow is opened and then completed or cancelled, a plain photo-reference add opens the photo dialog (never a reveal surface), and a plain Create Rail open lands on the Paint tab."
    - "A reveal rail bound to a MULTI-image reference bakes frame-aligned: baked key at application frame N carries the reference image that resolves at frame N (D-15), for every frame of the span — not one image repeated across the span."
    - "The bake fails closed on ANY unresolved span frame: a reference missing for even one frame of the span writes no keys and returns 'missing reference source' — never a clamped or substituted image (D-12)."
    - "Stretching a reveal rail's span extends the rail's DERIVED extent to the requested new end, so what is stored matches what is shown (D-07) — no success reported for an extent that never moved."
    - "A stretch never deletes baked keys and never bakes the new frames: existing keys survive, the new frames stay empty until a voluntary Replay (D-07)."
    - "A resize to the rail's current span is a no-op: no document revision bump, no undo-ledger entry (mirrors setPhotoReferenceSource's same-source no-op)."
    - "Untouched by construction: the bake output record shape, the rail rendering, the photo reference dialog's controls, the key/break pruning semantics, and the infinity lifecycle pin (one cycle; the resolver extends it to capacity)."
    - "Native UAT is left explicitly pending — never claimed."
  artifacts:
    - app/src/stores/physicPaintStore.ts — commitRevealBake resolves the reference per span frame (fail-closed on any unresolved frame) and hands the renderer a per-frame bytes map
    - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts — RotoRevealRenderInput.reference carries per-frame bytes; one decode per distinct image, picked per frame inside the bake loop
    - app/src/stores/efxPaintStore.ts — resizeRevealRail's finite extent follows the requested span in both directions; identical-span resize is a no-op
    - app/src/stores/efxPaintStore.reveal.test.ts — the WR-02 per-frame legs (multi-image, fail-closed, single-image control) and the WR-01 stretch/no-op legs + derived-extent assertion
    - app/src/components/physic-paint/roto/physicsPaintRotoRevealBake.test.ts — the renderer-level per-frame reference draw leg (frame N draws image N) and the updated input helpers
    - app/src/components/physic-paint/roto/physicsPaintRotoRegistryOwnership.test.ts — the revealInput helper updated to the per-frame reference contract
    - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts — the WR-03 behavioural lock: a reveal open never changes what a later plain open shows
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts — the WR-03 structural lock: the photo reference dialog receives no reveal input
    - .planning/quick/260920-kov-phase-52-reveal-warnings-wr-03-wr-02-wr-/260920-kov-SUMMARY.md — the WR-03 obsolescence evidence, RED/GREEN raw output, gates, guardrail audit, pending native UAT rows
  key_links:
    - "app/src/stores/physicPaintStore.ts:1780-1817 — `commitRevealBake`. Line 1793 (`_resolveReferenceSourceImage(document, input.canonicalStart)`) resolves the source ONCE and line 1814 hands that single `verdict.bytes` to `renderRotoRevealFrames` for every frame of the span. That one call site is the whole WR-02 defect: the comment three lines above it already claims 'Frame-aligned reference resolution (D-15)'."
    - "app/src/stores/physicPaintStore.ts:1739-1747 — `_resolveReferenceSourceImage(document, frame)`: `index = min(frame, sourceFrameRefs.length - 1)` (clamped at the last source frame), bytes looked up in `_referenceSourceImages` by ref, null when absent. Frame-aligned by construction; the bake just never walks the frames. `registerReferenceSourceImage` (:582) is the per-ref registration seam the tests use."
    - "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts:40-59 — `RotoRevealRenderInput.reference` (single `bytes` + transform + zoom) and :90 `loadRevealReferenceImage(input.reference.bytes)` — ONE decode for the whole span, before the frame loop at :99. The loop computes `destination = canonicalStart + frameIndex` (:101) and never revisits the reference. That is the second half of the WR-02 surface."
    - "app/src/stores/efxPaintStore.ts:1570-1641 — `resizeRevealRail`. :1602-1614 derives `resizedEnd = placementStart + survivingKeyIds.length × (repeat === 'infinity' ? 1 : repeat)` and stamps it into `originalEndExclusive` + `visibleRanges`. On a STRETCH every key survives, so `resizedEnd` equals the pre-stretch extent: the clip is rewritten identically, `documentRevision` bumps (:1629) and a `'reveal-span'` undo descriptor is returned (:1636) for a span the rail never gained. Verified live: `resizeRevealRail` has NO production caller (only the export, `efxPaintStore.reveal.test.ts`, and the exported-name list in `efxPaintRevealLeakContract.test.ts`) — the user-facing rail stretch rides the generic Group drag path. Only `createRevealRail` is wired in the Studio (PhysicsPaintStudio.tsx:14,1994)."
    - "app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts:5540-5562,5596-5623 — the extent authority. With a stamped lifecycle (`phaseOrigin` + `originalEndExclusive` + `visibleRanges` all present) and a finite repeat, `naturalEnd = requestedEnd = clip.originalEndExclusive` and `effectiveEnd = max(fragment.start, min(naturalEnd, fragment.endExclusive, boundary.frame))`. Both `originalEndExclusive` AND the single `visibleRanges` entry must move together or the band is clipped by whichever is smaller. Infinity clips keep the pinned one-cycle lifecycle (:5556-5560 extends it to the natural end at read time)."
    - "app/src/stores/physicPaintStore.ts:4011-4018 `getTrackRotoResolutionContext(layerId, trackId)` → `context.ranges[i].effectiveEnd` — the exported derived-extent accessor the WR-01 assertion reads (the same `derivePhysicPaintRotoLoopRanges` call the store itself serves the timeline from, :1057)."
    - "app/src/stores/efxPaintStore.reveal.test.ts:43-108 — the harness (`vi.mock` of the renderer module at :47-49 exposing `harness.renderReveal`, `stagedFrames`, `createRail`), the resize test at :607-644 (the shrink control leg that must stay green), and :295-298 (`expect.objectContaining({ reference: ... zoom })` — `zoom` stays on `reference`, so this assertion survives the contract change)."
    - "app/src/components/physic-paint/roto/physicsPaintRotoRevealBake.test.ts:118-130 (`input()` helper), :164-185 (`setupDom`: `URL.createObjectURL` currently returns the constant 'blob:reveal-ref' the mask-op log labels the reference draw by), :218-254 (the reference-draw order/transform assertions). The per-frame leg needs a per-payload blob label — extend the existing mock, do not invent a harness."
    - "WR-03 live-verified at plan base (2026-09-20, base commit 5774c725): `revealCreationRequested` exists NOWHERE in app/src (grep: only .planning docs). The reveal creation moved to the Create Rail dialog in 1b11e1c0 'feat(52): move reveal creation into the Create Rail dialog (G-52-3)' (recorded in 52-UAT.md:90: 'the Photo Reference modal is back to a pure reference control surface … revealCreationRequested wiring removed'). The photo dialog's props are `{ open, layerId, ports, onClose, onImportSource }`; the Studio's `referenceDialog` memo inputs (PhysicsPaintStudio.tsx:4284-4293) carry no reveal term; the replacement one-shot `scriptPickerIntent` is cleared on BOTH exits (:4319 on pick, :4327 onClose); the controller resets `railTab` on every open (:633 `options?.railTab ?? 'paint'`, :687 edit modes). The hijack the review described no longer exists — Task 1 pins the guarantee and records the evidence; it does NOT re-introduce a flag."
    - "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts:3209-3235 (the existing Reveal-tab describe, incl. :3229 asserting a plain open lands on 'paint') + the harness at :123-162 (`harness(overrides)` returns the controller with `cancel`/`closeConfirmation` and spy ports incl. `openPhotoReference`). Task 1's lock legs extend THIS describe."
---

<objective>
Close the three remaining Phase 52 Reveal warnings that block v1.0.0 acceptance — the Reveal rail is the milestone's named feature and each unclosed item is user-visible dishonesty (WR-02 bakes the wrong image, WR-01 reports a span it never stored).

Two of the three are live defects confirmed against the plan-base code; the third is not:

- **WR-02 (LIVE)** — `commitRevealBake` resolves the reference ONCE at `canonicalStart` and reuses those bytes for every frame of the span, while a single-image renderer decode backs the whole bake. For a multi-image reference the baked keys are frame-agnostic: the D-15 frame-aligned law ("application frame N resolves to source frame N") is violated silently, and the bake's own comment claims otherwise.
- **WR-01 (LIVE)** — `resizeRevealRail`'s stretch derives the new extent from the surviving key count, which a stretch never changes: the clip is rewritten to the same span, `documentRevision` bumps, an undo entry is recorded, and `ok: true` is returned for an extent that did not move. D-07 says what is shown and what is stored may not diverge silently.
- **WR-03 (ALREADY RESOLVED — surface removed)** — `revealCreationRequested` does not exist in the codebase. The flag's consumer (the reveal creation surface inside the photo reference dialog) was removed in `1b11e1c0`, which moved reveal creation into the Create Rail dialog; that dialog's one-shot intent is cleared on both exits and its tab resets on every open. The described hijack cannot occur at the plan base. This task therefore does NOT invent a fix: it pins the guarantee the review was protecting with behavioural lock legs, and records the obsolescence evidence. If a lock leg comes out RED, the hijack is live again — then, and only then, apply the review's prescribed fix (reset the state on both exits).

Purpose: leave the Reveal feature truthful on every path a user can reach, so the milestone does not ship a named feature with known lies.
Output: per-frame reference resolution in the bake, a stretch that extends the derived extent (and a same-span resize that stops lying), a locked WR-03 guarantee, RED-then-green tests for each, and the pending native UAT rows.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/52-shared-mask-compositor-and-reveal/52-REVIEW.md
@.planning/phases/53-integrated-v1-0-0-acceptance/53-CONTEXT.md
@app/src/stores/efxPaintStore.ts
@app/src/stores/physicPaintStore.ts
@app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts
@app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts

Verified code facts (live reads, 2026-09-20, base commit 5774c725). The review's cited line numbers have all drifted — the symbols below are the authority:

- WR-02: `commitRevealBake` at `physicPaintStore.ts:1780`; the single resolution at `:1793`; the single-bytes handoff at `:1814`; `_resolveReferenceSourceImage` at `:1739` (clamped index `min(frame, len-1)`); the renderer's one-shot decode at `physicsPaintRotoPlayScriptRenderer.ts:90`; the frame loop at `:99-101`; the input contract at `:40-59`.
- WR-01: `resizeRevealRail` at `efxPaintStore.ts:1570`; the key-count extent formula at `:1607-1608`; the clip stamp at `:1609-1614`; the revision bump at `:1629`; the `'reveal-span'` descriptor at `:1636`. No production caller (verified by grep: export + two test files only).
- WR-03: no `revealCreationRequested` anywhere in `app/src`; removal commit `1b11e1c0`; photo dialog props at `PhysicsPaintPhotoReferenceDialog.tsx:42-53`; the Studio's `referenceDialog` memo at `PhysicsPaintStudio.tsx:4284-4293`; `scriptPickerIntent` cleared at `:4319` + `:4327`; `railTab` reset at `physicsPaintRotoPlayScriptController.ts:633` and `:687`.
- Extent authority: `physicsPaintRotoPhysicalResolver.ts:5540-5562` (lifecycle-derived `requestedEnd`/`naturalEnd`) and `:5596-5623` (`effectiveEnd` = min of natural end, fragment end, boundary). Derived-extent accessor for tests: `physicPaintStore.getTrackRotoResolutionContext(layerId, trackId).context.ranges[i].effectiveEnd`.
- Test conventions to reuse (never invent a harness or a config — project rule): `efxPaintStore.reveal.test.ts:43-108` (mocked renderer + `createRail` + `stagedFrames`), `:607-644` (the shrink control leg), `:295-298` (`objectContaining({ reference: { zoom } })` survives the contract change because `zoom` stays on `reference`); `physicsPaintRotoRevealBake.test.ts:118-130` + `:164-185` + `:218-254`; `physicsPaintRotoRegistryOwnership.test.ts:128-140`; `physicsPaintRotoPlayScriptController.test.ts:123-162` + `:3209-3235`; `PhysicsPaintStudio.test.ts:1930-1972` (the existing source-shape lock convention for the picker/dialog wiring).
- Commands (project rule, inherited verbatim): `pnpm --filter efx-motion-editor exec vitest run <paths>` — vitest run only, NEVER watch; types via `pnpm --filter efx-motion-editor exec tsc --noEmit`; full suite `pnpm --filter efx-motion-editor exec vitest run`.
- Preact/signals discipline applies to any component/store-signal touch (efx-preact-reactivity): no new signal writes in a render body, no useState, keep store setters idempotent. This quick's production edits are store/renderer logic only — no new signal, no new effect.
- Native app runs are the user's side only — do NOT launch the app or the dev server; native UAT is owed, never claimed (project rule).
- Scope guardrails (verbatim intent): touch only the three named surfaces. No change to the bake output record shape, no change to rail rendering, no change to the photo reference dialog beyond a flag reset (which this plan does not need — the flag does not exist), no re-architecture of the reference pipeline.
</context>

<tasks>

<task type="auto">
  <name>Task 1: WR-03 — pin "a reveal entry never hijacks a later plain open" and record why the flag is gone</name>
  <files>app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts, app/src/components/physic-paint/PhysicsPaintStudio.test.ts</files>
  <behavior>
    Read the plan-base facts first: `revealCreationRequested` does not exist (grep `app/src`), the photo dialog is a pure reference control surface (props `{ open, layerId, ports, onClose, onImportSource }` — no reveal input), and the reveal creation's replacement one-shot (`scriptPickerIntent`) is cleared on both exits. The defect the review described is therefore already resolved by removal (commit 1b11e1c0). These legs are a REGRESSION LOCK, not a defect reproduction: they are expected GREEN at the plan base, and a green run is the evidence the finding is recorded with. If any leg comes out RED, the hijack is LIVE again — then apply the review's prescribed fix (reset the one-shot on both exits) and keep the lock.

    In `physicsPaintRotoPlayScriptController.test.ts`, extend the existing `createRotoPlayScriptController Reveal Photo Rail tab (52-05, G-52-3)` describe (its own `harness(overrides)`; ports under test include `openPhotoReference`, `hasPhotoReference`, `getScriptNaturalDuration`):
    - Leg A — reveal-then-plain open: `openConfirmation({ railTab: 'reveal' })` → `cancel()` (or `closeConfirmation()` when not busy) → a plain `openConfirmation()` must land on `railTab.value === 'paint'` with `confirmationOpen.value === true`. A reveal open must not change what a later plain Create Rail open shows.
    - Leg B — a completed reveal flow leaves nothing sticky: drive the reveal flow to success (`createReveal: vi.fn(async () => ({ ok: true as const }))`, `revealReferencePlaced` true, a valid `revealCountText`) through `openConfirmation({ railTab: 'reveal' })` → `confirm()`/the reveal confirm path → `railTab.value` and the dialog state must not carry over into the next plain open (`openConfirmation()` → `'paint'`).
    - Leg C — the failed/cancelled guard path is clean: `hasPhotoReference: false` + `setRailTab('reveal')` (this fires `openPhotoReference` — the D-12 guard, intended) then `cancel()`; the next plain `openConfirmation()` must be `'paint'` and must NOT fire `openPhotoReference` a second time. The guard opens the photo dialog on purpose; it must not make the next legitimate open behave differently.
    - Leg D — the plain photo-reference request is untouched by reveal state: after a reveal open + close, `requestPhotoReference()` calls the `openPhotoReference` port exactly once and leaves `confirmationOpen.value === false` (the Create Rail dialog does not reopen itself), with `railTab.value` unchanged by the call.

    In `PhysicsPaintStudio.test.ts`, add the structural lock in the file's existing source-shape convention (one assertion pair, no new harness): the `referenceDialog` memo's input list carries no reveal term and `<PhysicsPaintPhotoReferenceDialog {...referenceDialog} />` is fed from that bundle — i.e. the photo dialog cannot receive reveal state without the test failing. Assert on the memo input array as it exists at the plan base (`[referenceDialogOpen.value, launchContext?.layerId, efxPaintVersion.value, photoReferenceSectionPortsRef.current, referencePicker]`) and on the reveal-creation intent being consumed only by the Create Rail script picker.

    Do NOT re-introduce a `revealCreationRequested`-style flag, do NOT add a prop to the photo dialog, and do NOT change the D-12 guard's intended behaviour (entering the Reveal tab without a placed reference still opens the photo dialog). Record in the SUMMARY: the grep evidence, the removal commit, the four lock legs with their actual (green) output, and the explicit statement that item 1 required no production change.
  </behavior>
  <action>
    Write the legs against the real controller factory and the real Studio source text; reuse each file's own harness and assertion idioms. Capture the actual run output verbatim for the SUMMARY. If a leg is RED: stop and report it as a live re-introduction of WR-03, then apply the minimal two-exit reset at the surface the leg names (the review's fix: reset when the flow completes or is cancelled) and keep the leg as the lock. Commit: `test(260920-kov): WR-03 lock — a reveal entry never hijacks a later plain open`.
  </action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor &amp;&amp; pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts</automated>
  </verify>
  <done>The four controller legs and the structural leg exist and pass; the SUMMARY records the WR-03 obsolescence evidence (grep, removal commit, dialog prop surface, memo inputs, both-exit clearing) and that no production change was required — or, if a leg was red, the applied two-exit reset and the leg's red-then-green output.</done>
</task>

<task type="auto">
  <name>Task 2: WR-02 — the bake resolves the reference per span frame (RED then GREEN)</name>
  <files>app/src/stores/physicPaintStore.ts, app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts, app/src/stores/efxPaintStore.reveal.test.ts, app/src/components/physic-paint/roto/physicsPaintRotoRevealBake.test.ts, app/src/components/physic-paint/roto/physicsPaintRotoRegistryOwnership.test.ts</files>
  <behavior>
    RED first, against the real stores and the real renderer (no re-implementation, no mock of the module under test, no new test config).

    In `efxPaintStore.reveal.test.ts` (its own harness: `harness.renderReveal` is the mocked `renderRotoRevealFrames`, `createRail(layerId, startFrame, frameCount)`):
    - Leg A — the defect (RED): `setPhotoReferenceSource(layerId, ['ref-0','ref-1','ref-2'])` and `registerReferenceSourceImage('ref-0'|'ref-1'|'ref-2', testWebpBytes('ref-0'|'ref-1'|'ref-2'))` (distinct seeds produce distinct payloads); create the rail at `startFrame: 0, frameCount: 3` — the span where frame-alignment and single-resolution actually diverge (a span starting at or after the last source frame clamps identically either way, so it cannot express the defect). The mocked renderer must have received `reference.bytesByAppFrame` resolving frame 0 → bytes('ref-0'), frame 1 → bytes('ref-1'), frame 2 → bytes('ref-2'). At the plan base there is a single `reference.bytes` and no per-frame map → RED.
    - Leg B — fail-closed (RED): register only `ref-0` and `ref-2` (leave `ref-1` unregistered) and bake a 3-frame span; the bake must return `{ ok: false, error: 'missing reference source' }` and write NO keys (`physicPaintStore.getRotoRealKeyRecords(...)` unchanged) and no rail clip. Today only `canonicalStart` is validated, so the bake succeeds on a clamped image → RED. This is the D-12 fail-closed law applied to every frame, not just the span's first.
    - Leg C — control, GREEN before and after: a single-image reference (`['ref-a']`) over a 3-frame span resolves every frame to ref-a's bytes (the clamped-repeat case stays legal).
    - Leg D — control on the existing assertion: the working-size/zoom leg at :283-299 keeps passing (`zoom` stays on `reference`).

    In `physicsPaintRotoRevealBake.test.ts` (its own `input()` helper, `setupDom`, the `RecordingContext` mask-op log):
    - Leg E — the renderer draws per frame (RED): 3 frames × 3 distinct reference payloads must draw image N on frame N. Extend the existing `URL.createObjectURL` mock so distinct payloads get distinct labels (the mask-op log labels a reference draw by the image's `src` — a constant label cannot tell the images apart), then assert the per-frame sequence of reference draws against the frame boundaries. At the base the input contract carries one payload for the whole span, so the leg cannot even express the law → RED (a type error alongside the runtime failure is acceptable during RED; the task's done-state requires `tsc --noEmit` clean).
    - Leg F — one decode per distinct image (GREEN after the fix): repeated identical payloads across frames must not trigger a fresh `createObjectURL` per frame (decode-once — the project's decode-storm lesson). Assert the object-URL call count equals the number of DISTINCT payloads, not the frame count.
    - Keep the existing abort legs (`:359-396`) green — the abort check stays the FIRST statement of the loop body, before any await.

    Then the fix (minimal, two files):
    - `physicPaintStore.commitRevealBake`: compute `projectSize` → `size` → `referenceZoom` BEFORE the resolution, then walk the span once — for `index` in `[0, frameCount)`, `_resolveReferenceSourceImage(document, input.canonicalStart + index)`; ANY null returns `{ ok: false, error: 'missing reference source' }` before any render and before any write (strictly stronger than today, which validated only `canonicalStart`). Build `bytesByAppFrame: Map<number, Uint8Array>` and pass `reference: { bytesByAppFrame, transform: track.transform, zoom: referenceZoom }`. Do not change the staged-record shape, the span replacement, the break pruning, or the capacity guard.
    - `physicsPaintRotoPlayScriptRenderer.renderRotoRevealFrames`: `RotoRevealRenderInput.reference` becomes `{ bytesByAppFrame: ReadonlyMap<number, Uint8Array>; transform; zoom }` (one place for bytes — never two sources). Drop the pre-loop `loadRevealReferenceImage` call. Inside the frame loop, after `throwIfAborted(input.signal)`, resolve `bytesByAppFrame.get(destination)` (a missing entry throws a clear error — fail closed; the store pre-validates), then decode through a per-render identity-keyed cache (`Map<Uint8Array, HTMLImageElement>`) so each distinct payload decodes once and clamped repeats reuse the decoded image. Draw the reference with the same transform math as today. Update the input's doc comment to state the D-15 frame-aligned law.
    - Ripple (mechanical, no behaviour assertions lost): update the two renderer test helpers to the new contract — `physicsPaintRotoRevealBake.test.ts`'s `input()` and its two inline `reference:` overrides, and `physicsPaintRotoRegistryOwnership.test.ts`'s `revealInput()`.

    Out of scope, deliberately untouched: `renderRotoPlayScriptFrames`, the PlayScript (non-reveal) bake, the mask/composite semantics, the reference transform/zoom math, `_resolveReferenceSourceImage` itself (it is already frame-aligned — the bake just has to call it per frame), and `_referenceSourceImages` registration.
  </behavior>
  <action>
    Run the RED legs first and capture the raw failing output verbatim (including any type error) — that output is the SUMMARY's ground truth for WR-02. Then apply the fix and re-run the same files. Record the final `bytesByAppFrame` contract, the fail-closed walk, and the decode-once count in the SUMMARY. Commit: `test(260920-kov): RED — the reveal bake resolves the reference once at the span start`, then `fix(260920-kov): WR-02 — the reveal bake resolves the reference per span frame (D-15)`.
  </action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor &amp;&amp; pnpm --filter efx-motion-editor exec vitest run src/stores/efxPaintStore.reveal.test.ts src/components/physic-paint/roto/physicsPaintRotoRevealBake.test.ts src/components/physic-paint/roto/physicsPaintRotoRegistryOwnership.test.ts &amp;&amp; pnpm --filter efx-motion-editor exec tsc --noEmit</automated>
  </verify>
  <done>Legs A/B/E are green after the fix (raw RED output recorded); control legs C/D/F are green; the single-image path still bakes every frame from its one image; an unregistered middle frame fails the bake closed with no keys written; each distinct reference payload decodes once per bake; the abort legs are unchanged; `tsc --noEmit` is clean; no bake output record shape change.</done>
</task>

<task type="auto">
  <name>Task 3: WR-01 — the stretch extends the derived extent; the same-span resize stops lying (RED then GREEN), then gates + SUMMARY</name>
  <files>app/src/stores/efxPaintStore.ts, app/src/stores/efxPaintStore.reveal.test.ts, .planning/quick/260920-kov-phase-52-reveal-warnings-wr-03-wr-02-wr-/260920-kov-SUMMARY.md</files>
  <behavior>
    RED first, in `efxPaintStore.reveal.test.ts` (same harness; `physicPaintStore.getTrackRotoResolutionContext` is the derived-extent accessor — import it if the file does not already):

    - Leg A — the stretch (RED): `createRail(layerId, 10, 2)` (span [10,12)) → `resizeRevealRail(layerId, loopId, 15)` → `ok: true`; the clip's `originalEndExclusive === 15` and `visibleRanges === [{ start: 10, endExclusive: 15 }]`; the DERIVED extent `getTrackRotoResolutionContext(layerId, TEST_TRACK_ID)!.context.ranges[0].effectiveEnd === 15`; and the baked keys are PRESERVED (`getRotoRealKeyRecords` frames `[10, 11]` — a stretch never deletes and never bakes the new frames, D-07). Assert the derived extent, not just the raw field: the field alone can be stamped while the resolver still clips the band.
    - Leg B — the same-span no-op (RED): a second `resizeRevealRail(layerId, loopId, <current end>)` must not bump `documentRevision` and must return `{ ok: true, descriptor: null }` (mirrors `setPhotoReferenceSource`'s same-source no-op). Today it rewrites the clip, bumps the revision and records a `'reveal-span'` undo entry for nothing — the other half of the WR-01 lie text ("still bumps documentRevision and records a 'reveal-span' undo entry").
    - Leg C — the shrink control, stays GREEN: the existing shrink leg at :607-644 keeps its exact expectations (`originalEndExclusive` 12, `visibleRanges` `[{start:10,endExclusive:12}]`, keys `[10,11]`, and the undo-by-reference restore). The shrink and the stretch must land on the same law: the finite extent equals the requested span end.
    - Leg D — an invalid span still fails closed: `newEndExclusive <= placementStart` (and a non-integer) returns `{ ok: false, reason: 'invalid-span' }` with no revision bump (unchanged from the base guard).

    Then the fix in `resizeRevealRail` (one function body, nothing else):
    - Finite repeat → `resizedEnd = newEndExclusive` (the requested span IS the extent — no key-count proxy). Apply it to BOTH `originalEndExclusive` and the single `visibleRanges` entry: with a stamped lifecycle the resolver takes `naturalEnd = originalEndExclusive` AND clips by `fragment.endExclusive`, so moving only one leaves the band at the smaller value.
    - `repeat === 'infinity'` → unchanged from today (the G-52-4 pin: one cycle, extended to capacity at read time).
    - Same-span no-op → detect that the requested end already equals the derived/extent end AND the surviving key set is unchanged, then return `{ ok: true, descriptor: null }` BEFORE any write (no records replacement, no clip rewrite, no revision bump) — the `setPhotoReferenceSource` precedent, and `descriptor: null` is already part of the result contract.
    - Untouched: the key pruning (`record.appFrame < newEndExclusive`), the AM-4 break pruning and its ordering, the records replacement, the capacity/interpolation reads, and the descriptor's by-reference `before`/`after` shape. Update the function's doc comment to state the extent law in both directions (D-07) and why the key-count proxy is gone.

    Then the gates and the SUMMARY (required — the user reads it before running native UAT):
    - Regression gates in order: the three reveal-relevant files; the leak contract `src/efx-paint/compositor/efxPaintRevealLeakContract.test.ts` (it pins the exported reveal mutation names and their no-compositor-leak shape); `pnpm --filter efx-motion-editor exec tsc --noEmit`; then the full suite `pnpm --filter efx-motion-editor exec vitest run` (background it if the runtime allows; resume only on completion). Attribute any failure by name — including any pre-existing failure already recorded in `.planning/STATE.md` — never absorb one silently.
    - Guardrail audit by READING `git diff 5774c725..HEAD -- app/src` (base commit 5774c725): (1) the staged bake record shape is unchanged (no key/payload field added or moved); (2) rail rendering files are not in the diff; (3) the photo reference dialog and its controller are not in the diff (WR-03 needed no production change); (4) the key/break pruning and the infinity lifecycle pin are not in the diff; (5) the only resize behaviour added is the extent rule + the same-span no-op.
    - SUMMARY at `.planning/quick/260920-kov-phase-52-reveal-warnings-wr-03-wr-02-wr-/260920-kov-SUMMARY.md`: WR-03 obsolescence evidence (grep, removal commit 1b11e1c0, the four lock legs, "no production change required"); WR-02 before/after (one resolution at canonicalStart vs per-frame bytesByAppFrame, fail-closed walk, decode-once count) with the raw RED output; WR-01 before/after (key-count proxy vs requested-span extent, same-span no-op) with the raw RED output and the derived-extent values; the guardrail audit checklist; the gate results; and the three native UAT rows marked explicitly PENDING — never claimed.
  </behavior>
  <action>
    Run the RED legs first and capture the raw failing output verbatim (the actual `originalEndExclusive`, `effectiveEnd`, revision and descriptor for a stretch — that is the SUMMARY's ground truth for WR-01). Then apply the fix, re-run, and complete the gates + SUMMARY. Note for the SUMMARY (verified at plan base): `resizeRevealRail` has NO production caller — only `createRevealRail` is wired in the Studio, and the user-facing rail stretch rides the generic Group drag path. The store-level law this task restores is therefore verified by the tests plus native row 3, which exercises the rail-stretch gesture end to end. Commit: `fix(260920-kov): WR-01 — the reveal rail stretch extends the derived extent`, then `docs(260920-kov): Phase 52 WR-03/WR-02/WR-01 — evidence, fix, gates, native UAT pending`.
  </action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor &amp;&amp; pnpm --filter efx-motion-editor exec vitest run src/stores/efxPaintStore.reveal.test.ts src/efx-paint/compositor/efxPaintRevealLeakContract.test.ts &amp;&amp; pnpm --filter efx-motion-editor exec tsc --noEmit</automated>
  </verify>
  <done>Legs A/B are green with the raw RED output recorded; legs C/D are green (the shrink control and the fail-closed guards are unchanged); `resizeRevealRail`'s finite extent equals the requested span end in both directions and an identical-span resize writes nothing; the infinity pin and every pruning semantics are untouched; the leak contract and `tsc --noEmit` are clean; the full-suite result is recorded with any failure attributed by name; the SUMMARY carries the WR-03 evidence, both before/after tables, the guardrail audit, and the three native UAT rows marked pending.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| reference source registry → reveal bake | The bake consumes reference image bytes by ref; an unresolved ref at any span frame crosses from "input present" to "input absent" and must fail closed. |
| document/lifecycle state → derived rail extent | The stored lifecycle is the only extent input; the resize mutation writes it, the resolver reads it — a mismatch between the two is the WR-01 lie. |
| user gesture → resize mutation | The requested end is user-chosen and validated (`Number.isInteger`, `> placementStart`); it now becomes the extent verbatim. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-260920-kov-01 | Tampering | `commitRevealBake` reference resolution | low | mitigate | The span is walked frame by frame; ANY unresolved frame returns `{ ok: false, error: 'missing reference source' }` before any render and before any write — no placeholder, no clamped substitution, no partial key set (D-12/T-52-01, fail-closed preserved and strengthened). |
| T-260920-kov-02 | Denial of service | renderer reference decode | low | mitigate | One decode per DISTINCT payload per bake, cached by payload identity; clamped repeats reuse the decoded image. No per-frame `new Image()` / `createObjectURL` (the project's documented decode-storm/OOM lesson). Leg F asserts the call count. |
| T-260920-kov-03 | Tampering | `resizeRevealRail` span write | low | mitigate | The span guard (`Number.isInteger`, `> placementStart`) stays; the extent is written to both `originalEndExclusive` and the single `visibleRanges` entry so the resolver cannot clip the band to a stale smaller value; the same-span case writes nothing at all. |
| T-260920-kov-04 | Information disclosure | offline desktop app | low | accept | No new I/O, no network, no persisted-format change — the diff is store/renderer logic plus tests. |
| T-260920-kov-SC | Tampering | pnpm installs | low | accept | No dependency changes in this plan — no package-legitimacy gate required. |
</threat_model>

<verification>
- WR-03 evidence gate: the SUMMARY states the live-verified obsolescence (no `revealCreationRequested` in `app/src`, the removal commit `1b11e1c0`, the photo dialog's prop surface, the memo input list, the both-exit clearing of the replacement intent) and whether any lock leg came out red.
- RED proof per item: the failing run before each fix, captured verbatim (WR-02: the single-`bytes` handoff / the clamped middle frame; WR-01: the stretch leaving `originalEndExclusive` and `effectiveEnd` at the old span).
- Per-frame law: a multi-image reference over a 3-frame span resolves frame N → source frame N at both levels — the store hands a per-frame bytes map (leg A) and the renderer DRAWS image N on frame N (leg E).
- Fail-closed: an unregistered middle frame fails the bake with no keys written (leg B).
- Extent law: the stretch's DERIVED extent equals the requested end (`context.ranges[0].effectiveEnd`) while the baked keys survive; the same-span resize writes nothing; the shrink control and the invalid-span guard are unchanged.
- Guardrail audit (by reading the diff, not by grep alone): no bake output record shape change, no rail rendering change, no photo dialog/controller change, no pruning or infinity-pin change.
- Regression: the three reveal-relevant suites + the leak contract + `tsc --noEmit` green; the full suite with 0 new failures (any pre-existing failure attributed by name).
- Scope gate: `git diff --name-only 5774c725..HEAD` lists only this plan's files plus `.planning/` artifacts.
- Native UAT: the three rows are listed in the SUMMARY as pending, never claimed (the executor does not launch the app).
</verification>

<human_verification>
Native UAT — OWED BY THE USER after execution; the executor leaves these pending and never claims them (the executor does not launch the app; the user runs the dev server).
1. Reveal creation → cancel → add a plain photo reference → the photo dialog opens normally (no reveal surface, and the camera icon still reaches the opacity/lock/source controls).
2. Multi-image reference rail (3 images, ≥3 frames) → frames 0/1/2 each show their own image, with the same result in a short PNG export.
3. Stretch a reveal rail → the span and the baked content persist across save and reopen.
</human_verification>

<success_criteria>
- WR-02: the bake resolves the reference per span frame (D-15) and fails closed on any unresolved frame; the renderer decodes each distinct image once and draws the right one per frame; the single-image path is unchanged.
- WR-01: stretching a reveal rail extends the derived extent to the requested end with the keys preserved and the new frames left empty (D-07); an identical-span resize writes nothing (no revision bump, no undo entry); the shrink control, the invalid-span guard, the pruning semantics and the infinity pin are untouched.
- WR-03: the guarantee "a reveal entry never hijacks a later plain open" is locked by behavioural tests and the obsolescence is on record with evidence — no production change, no re-introduced flag.
- Guardrails held: no bake output format, rail rendering, or photo-dialog change beyond the (unneeded) flag-reset allowance.
- Targeted suites, the leak contract, `tsc --noEmit` and the full suite green; scope gate clean; the three native UAT rows left explicitly pending.
</success_criteria>

<output>
Create `.planning/quick/260920-kov-phase-52-reveal-warnings-wr-03-wr-02-wr-/260920-kov-SUMMARY.md` when done — carrying the WR-03 obsolescence evidence with its lock legs, the WR-02 and WR-01 before/after tables with the raw RED output, the guardrail audit checklist, the gate results, and the three native UAT rows marked pending.
</output>
