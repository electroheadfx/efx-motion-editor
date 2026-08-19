---
slug: regression-refresh-multi-paint
status: awaiting_human_verify
trigger: "At the end of a multi-paint render (Action/Play generating many strokes across frames), the canvas does NOT show the final state — the last strokes are missing until the user clicks anywhere, which forces a repaint. With only 2 strokes the problem never appears; it needs a larger stroke count."
created: 2026-08-19
updated: 2026-08-19
---

# Debug: regression-refresh-multi-paint

## Symptoms

- **Expected behavior:** When a multi-paint render (Motion Action / Play generating many strokes across a frame range) completes, the canvas immediately shows the complete final result with all strokes — no user click needed.
- **Actual behavior:** At completion, the canvas does NOT show the final state — the last strokes are missing until the user clicks anywhere, forcing a repaint.
- **Error messages:** None reported (silent visual staleness).
- **Timeline:** Regression — reproduces only with a large stroke count; a 2-stroke Action is always correct.
- **Reproduction:** Apply a Motion Action with a high stroke count on a frame range; watch the final frame at completion. Compare with a 2-stroke Action (always correct).

## Defect Characterization (from user)

The defect is a **completion-ordering/publication issue, not a render-content issue** — the missing strokes appear after ANY repaint trigger (e.g. a click).

**Prime suspects (verify, don't assume):**
1. `paintVersion` publication timing in `app/src/stores/paintStore.ts` — the final bump may fire BEFORE the last stroke chunk's pixels actually land, so subscribers render a stale frame and no later bump occurs. (Memory: every mutation must bump paintVersion AND subscribers must re-render.)
2. Incremental engine integration — batching the final chunk may skip the incremental publish path used for smaller stroke counts. (Memory: engine integration must stay incremental; batch renderFromStrokes is the known anti-pattern.)
3. Final-frame cache/transport publication racing the completion signal in the parent↔child bridge.

## Requested Approach

Build a tight RED feedback loop first (scripted many-stroke generation asserting canvas/store state right after completion), then fix, then verify natively with a heavy-stroke Action. Use `vitest run` (never watch mode). Do NOT run the dev server — the user runs it on their side.

## Current Focus

```yaml
hypothesis: CONFIRMED (4th native rejection, named via DEBUG-PAINTGEN instrumentation) — the late writer is the PIXEL-CACHE FALLBACK RETRY (PhysicsPaintStudio canvasCompletedMutation → captureLivePixels fails → loadCachedRotoReferenceFrame(appFrame, engine, undefined, true), site=cache-retry). It fires TWICE after completion (ts 67501, 70099), each with replaceDirtyFrame=true → the 662e82fd isPlainRefresh (which required !replaceDirtyFrame) never fired → it reloads the frame from the stale PARTIAL first-stroke render with a FRESH auto-generation (issue-monotonic but content-agnostic) → clobbers the correct completion render (gen 4, accept-reload ts 54349) with the partial. FIXED at the loader seam: a plain refresh (no explicit generation AND no explicitDataUrl) is plain REGARDLESS of replaceDirtyFrame — replaceDirtyFrame is not a mark of authoritativeness; every authoritative repaint passes an explicit generation (reconcile) or clears the base first (navigation).
test: GREEN — Layer 1 (cache-retry no-op, 662e82fd/d5540aa1) + Layer 2 (CONTENT-token ordering, baf7bbfb) + Layer 3 (single post-idle drain, 5d8d8a9e) implemented. Engine 82/82 (5 suites, incl. 14 previewBase-completion + 33 cooperative-finalization), full app 2616 passed (136 files), tsc --noEmit clean both packages.
expecting: native UAT — heavy-stroke Motion Action: ONE final render at completion (no intermediate per-stroke renders, no late revert to the partial first-stroke render); 2-stroke control correct; and a NEW stroke painted on the settled frame must still repaint (safety case).
next_action: native human verification of the Layer 2+3 combined flow. On pass, archive session to resolved/.
```

## Evidence

- timestamp: 2026-08-19 — completion path mapped (child): `physicsPaintRotoPlayScriptController.confirmGeneration` → `ports.commit` (useRotoPlayScriptController.commit) → `useRotoPhysicalEditCoordinator.executePhysicalEdit` (kind `replace-roto-physical-map`) → parent bridge apply → ack → `publishCompleteDocument` (child store replace + `setLaunchContextStartFrame(cursorAppFrame)` + `setLaunchContextCachedFrames` → `syncCurrentPhysicalDocument({preserveRuntimeCaches:true})`) → `finalizeAccepted` → `reference.reconcileCurrentFrame(after.currentAppFrame)` → `loadCachedRotoReferenceFrame(frame, engine, undefined, /*replaceDirtyFrame*/ true)` → `engine.clear()` + `engine.setPreviewBaseImageUrl(newDataUrl)`.
- timestamp: 2026-08-19 — cursor after play-script completion is the RANGE START (`buildPhysicalPublication` sets `selectedAppFrame: affectedStartAppFrame`; coordinator `targetCursorAppFrame = requestedSelectedAppFrame ?? currentAppFrameForEdit`). Clarify in repro which frame is on screen when staleness is observed (user watches the FINAL frame — if the cursor lands on start, the stale final frame is reached via navigation, which itself repaints; so the stale frame is more likely the CURRENT one at completion).
- timestamp: 2026-08-19 — engine race mechanism confirmed in `app/node_modules/@efxlab/efx-physic-paint/src/engine/EfxPaintEngine.ts:544-573`: `setPreviewBaseImageUrl` on cache miss decodes via `new Image()`; onload guard `requestId !== this.previewBaseRequestId || destroyed || animationMode || state.drawing` RETURNS SILENTLY; the dropped image is never inserted into `previewBaseImageCache` (cap 32) and nothing retries — canvas keeps the previous preview base until the next explicit paint (a click/navigation). This is the strongest count-dependent candidate: large multi-stroke PNG dataUrls decode slowly → wide invalidation window; 2-stroke dataUrls are small → decode wins the race → always correct.
- timestamp: 2026-08-19 — parent Preview ELIMINATED as the stale surface with high confidence: `Preview.tsx` render effect subscribes `physicPaintVersion` (bumped by `_notifyVisualChange` inside `replaceRotoPhysicalDocument`), and the roto source is revision-derived (`getRotoPhysicalRenderSource` with `cacheRevision`-keyed cache in previewRenderer.ts:126-148); async image decode self-heals via `renderer.onImageLoaded` re-render. Structural cache (`_resolveRotoPhysicalStructural`, physicPaintStore.ts:244) is identity-keyed on the record map — replaced on every document replacement, so no stale derivation.
- timestamp: 2026-08-19 — the parent apply path for play-script (`physicPaintBridge.ts` ~1608-1690) ends at `replaceRotoPhysicalDocument`; it never writes the legacy `_frames` roto cache, but Preview does not read that cache for physical roto layers, so this is not the defect.
- timestamp: 2026-08-19 — controller post-commit sequence (physicsPaintRotoPlayScriptController.ts:1390-1411): after `ports.commit` resolves, `phase='regenerating'` (status text only — no async regen work child-side), `ports.stopPlayback()`, `phase='complete'`, `confirmationOpen=false`. Any Studio effect/hook reacting to these signal writes that touches the engine canvas (clearPreviewBaseImage / setPreviewBaseImageUrl / resetBackground) between the reconcile paint and the image onload completes the race. Studio-side engine canvas ops found so far live only in `navigateToSyncedPhysicalFrame` and the navigation display port (PhysicsPaintStudio.tsx:1653-1716) — the completion-flow trigger that would reach them is not yet identified.

## Eliminated

- Parent Preview (`Preview.tsx` + `previewRenderer.ts`): reactive subscription and revision-keyed render source are correct; self-heals on image decode.
- Parent store publication ordering (`replaceRotoPhysicalDocument`): records replaced, `rotoPhysicalRevision` and `physicPaintVersion` bumped synchronously before the ack returns.
- Render content of staged frames (`physicsPaintRotoPlayScriptRenderer.ts`): staged frames are complete and validated before commit (per-frame PNG validation in `buildPhysicalPublication`); matches user's "not a render-content issue".
- Flat-paint `paintStore.ts` suspect #1 as literally stated: this flow never touches `paintStore`; the user's paintVersion instinct maps onto the engine preview-base publication instead.

## Evidence (continued — static audit of the post-accept chain, 2026-08-19)

- Exhaustive audit of every preview-base invalidator reachable from the completion path found **no statically identifiable bumper** in the cursor-stays case. Eliminated: `acceptedSignal` (no external consumers), `stopPlayback`/`finishPlayback` (signal writes only), `presentationSignal`/status ports (UI only), dialog (`PhysicsPaintPlayScriptDialog` has zero engine refs), `canvasKey` remount (size-only key), canvas mount (no prop-driven engine ops), engine-lifecycle background effect (`applyRotoBackgroundMetadataToEngine` → `setBgMode`/`setPaperGrain`/`setEmbossStrength` — none bump `previewBaseRequestId`), `seek-frame` self-echo (listener installed parent-only in `main.tsx` else-branch), `AnimationPlayer`/`setAnimationMode` (never invoked on the Studio engine — only the offscreen play-script renderer), `syncPending` → `resetRotoKeySession` (selection signals only), persistence display ports (navigation-driven only), bridge timeouts (UI status only).
- Cursor-move case (selection survives → cursor jumps to range start) **self-heals**: the frame-editing effect (`useRotoFrameEditingController.ts:187-190`) re-loads the new current frame with a fresh lookup → second decode → applies. Cursor-stay case (selection lost → `resolvePublicationSelection` returns null/null → cursor unchanged) has **no** re-load — the reconcile paint is the only paint.
- Engine defect amplifier confirmed at `EfxPaintEngine.ts:544-573`: a superseded/flag-dropped decode is discarded **before** being cached and is never retried; `previewBaseImage` keeps the OLD image; `redrawPreviewBase()` (called by `engine.clear()`) re-composites the OLD image, so the canvas persistently shows the pre-apply frame until any explicit repaint. The decode window scales with PNG size — 2-stroke dataUrls decode inside the window of any invalidation (always correct); many-stroke dataUrls expose the race.
- **Fix strategy (robust without naming the racer — completion-ordering guarantee):** (1) engine caches decoded images even when the apply guard drops them (unless destroyed) so any repair is a synchronous cache-hit; (2) engine tracks the applied dataUrl (`getAppliedPreviewBaseDataUrl`) and emits settle notifications (`onPreviewBaseSettled`); (3) the Studio's `reconcileCurrentFrame` port arms a bounded settlement-aware guard (`armRotoCompletionPaintGuard`) that re-runs the current-frame load if the intended paint did not land. A single repair is deterministic: cache-on-drop makes the repair a synchronous apply with no async window.

## Resolution

root_cause: |
  Two compounding defects on the preview-base apply path:
  1. (2nd rejection) The 60fb8ca5 completion-contract fix inverted the original race:
     dropped decodes were cached and the repair path re-applied a synchronous cache-hit
     whose dataUrl resolved to OLDER content; the requestId-only guard could not catch a
     later-issued-but-older-content write. Fixed by monotonic generation ordering at the
     apply seam.
  2. (3rd rejection — THIS fix) Generation ordering is ISSUE-monotonic but CONTENT-agnostic.
     ~1s after the completion reconcile paints the ACCEPTED (full) render at an EXPLICIT
     session-monotonic generation G, the frame-editing useEffect
     (useRotoFrameEditingController.ts:187-190) re-fires on a launchContext/currentFrame/
     operationId dep change and reloads the SAME frame via loadCachedRotoReferenceFrame
     with NO explicit generation — the engine auto-assigns a generation ABOVE the explicit
     one seen (auto > G), so the generation gate passes. The reload resolves the frame from
     the cached/preview source, which still holds the PARTIAL first-stroke render, and
     paints it over the correct full render. Cursor stays (not navigation). The reload is a
     fresh write of stale content, not a stale settlement of an earlier write — only a
     content-agnostic comparison can reject it.
  3. (4th rejection — THIS fix, NAMED by instrumentation) The late writer is the PIXEL-CACHE
     FALLBACK RETRY: on each completed stroke, canvasCompletedMutation captures live pixels;
     when captureLivePixels FAILS it falls back to loadCachedRotoReferenceFrame(appFrame,
     engine, undefined, /*replaceDirtyFrame*/ true). replaceDirtyFrame=true defeated the
     plain-refresh no-op (which required !replaceDirtyFrame), so the retry reloaded the frame
     from the stale PARTIAL first-stroke render with a FRESH auto-generation (issue-monotonic
     but content-agnostic) and clobbered the settled full render ~13s after completion
     (DEBUG-PAINTGEN: accept-reload gen4 ts54349; cache-retry ts67501 + ts70099 → engine-apply
     gen6 ts70177). The retry fired twice (two failed captures).
fix: |
  1. Loader no-op guard (useRotoReferenceController.ts) — direction (b), EXTENDED for the 4th
     rejection: a PLAIN refresh (no explicit generation AND no explicitDataUrl) is a NO-OP
     when the engine already holds an EXPLICITLY-settled preview base for the SAME appFrame
     with a non-null dataUrl — REGARDLESS of replaceDirtyFrame. replaceDirtyFrame is not a
     mark of authoritativeness: every authoritative repaint already passes an explicit
     generation (reconcile/repair) or clears the base first (navigation). This makes the
     pixel-cache fallback retry (replaceDirtyFrame=true) a no-op when a completion render has
     settled for the frame; the double-fire becomes two inert no-ops. New-stroke repaints are
     unaffected (they carry an explicit generation via the accept/reconcile path).
  2. Engine origin tracking (EfxPaintEngine.ts): getAppliedPreviewBaseDataUrl,
     getAppliedPreviewBaseAppFrame, getAppliedPreviewBaseExplicit (+ existing
     getAppliedPreviewBaseGeneration) on the applied preview base — set on BOTH apply paths
     (synchronous cache-hit and onload), cleared by clearPreviewBaseImage/destroy.
  3. The monotonic generation ordering guard (2nd-rejection fix, 60fb8ca5) is RETAINED: it
     orders async decode/apply settlements by issue time; the loader no-op guard adds the
     content-agnostic gap the generation token cannot cover (a fresh write of stale content).
verification: |
  - RED (4th rejection): the new loader test 'no-ops the pixel-cache fallback retry
    (replaceDirtyFrame=true) when a completion render already settled for the same frame'
    failed pre-fix (returned true, painted the partial over the settled full render); passes
    post-fix. (3rd-rejection RED was the plain-refresh stale-partial test.)
  - GREEN: engine 79/79; loader 12/12 (incl. the cache-retry no-op + the new-stroke
    authoritative-repaint safety case); full app 2611 passed; tsc --noEmit clean in both
    packages.
  - Native UAT PENDING: heavy-stroke Motion Action full final frame stays correct ~1s+ later
    with NO late revert to the partial first-stroke render; 2-stroke control correct; a NEW
    stroke painted on the settled frame must still repaint (safety case).
files_changed:
  - packages/efx-physic-paint/src/engine/EfxPaintEngine.ts
  - packages/efx-physic-paint/src/engine/EfxPaintEngine.previewBaseCompletion.test.ts
  - app/src/components/physic-paint/hooks/useRotoReferenceController.ts
  - app/src/components/physic-paint/hooks/useRotoReferenceController.test.ts
  - app/src/components/physic-paint/hooks/rotoCompletionPaintGuard.ts
  - app/src/components/physic-paint/hooks/rotoCompletionPaintGuard.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx

## Evidence (continued — TDD loop, 2026-08-19)

- RED demo: `git stash push -- packages/efx-physic-paint/src/engine/EfxPaintEngine.ts` → 5/6 completion-contract tests fail against the pre-fix engine (the destroy-path test passes trivially pre-fix); `git stash pop` restored the fix. Guard/chain RED pre-fix = module absent (import failure).
- GREEN: engine 73/73 across 5 suites; guard + chain 10/10; app hook suites 79/79; PhysicsPaintStudio 76/76; `tsc --noEmit` clean in both packages. Engine suites run via the established pattern `cd app && pnpm vitest run --root ../packages/efx-physic-paint src/engine` (per 38.1-07-SUMMARY deviation note; no config changes).
- Prior session-manager turn was interrupted by an API quota error after the static audit; the interrupted debugger turn had already written all three test legs and the full implementation uncommitted. This turn verified RED/GREEN, reviewed the diff, and committed.

## Evidence (continued — native UAT rejection of 60fb8ca5, 2026-08-19)

- timestamp: 2026-08-19 — NATIVE UAT FAILED: the 60fb8ca5 fix did NOT fix the bug — it INVERTED the race. Exact native sequence (user screenshots): (1) strokes drawn, queued outline previews visible; (2) completion → the FINAL render with ALL strokes paints correctly; (3) a LATER re-render overwrites it with a STALE image showing only the FIRST stroke's render; (4) a manual frame refresh restores the correct full render. So a stale async decode/apply now lands AFTER the correct completion paint and clobbers it.
- timestamp: 2026-08-19 — prime suspect = the 60fb8ca5 changes themselves: dropped decodes are now cached and the repair path re-applies a synchronous cache-hit; if the cache holds the stale first-stroke decode, the repair (or the stale onload itself) paints it over the newer settled paint. The completion guard checks whether a paint landed, not whether what landed is the NEWEST generation.
- timestamp: 2026-08-19 — required invariant (actual bug class): MONOTONIC GENERATION ORDERING on the preview-base apply path. Every decode/paint request carries a monotonically increasing generation token; an onload/apply completing with an older generation than the last settled paint is a NO-OP for the canvas (may populate cache, may never paint). The completion-repair guard must compare generations — repair only when the NEWEST generation's paint failed to land, and only ever apply the newest generation's image.
- timestamp: 2026-08-19 — trace the exact ordering that lets the stale image paint last. The user's console may show `[PhysicsPaintStudio] physical edit: Completion paint ... was dropped — repairing` — if the repair fires while the correct paint is visible, that is the smoking gun.
- timestamp: 2026-08-19 — RED test spec: simulate decode A (stale generation, slow) and completion paint B (new generation) → B lands → A's onload completes → canvas must still show B; and repair-guard-fires-after-B-landed must be a no-op. Implement the generation guard at the engine apply seam; fix or remove the cache-apply repair path if it is the stale writer. Keep the 43.x paintVersion discipline: every real mutation bumps, subscribers re-render — but stale async completions never write.
- timestamp: 2026-08-19 — status reset to investigating; previous Resolution block below documents the (now rejected) completion-contract approach — the generation-ordering guard is the corrected fix direction.

## Evidence (continued — generation-ordering fix implemented, 2026-08-19)

- timestamp: 2026-08-19 — mechanism of the inverted race pinned: `applyPreviewBaseImage` (EfxPaintEngine.ts) guarded ONLY on requestId === previewBaseRequestId (issue order). A STALE cache-hit re-issue (the repair reload resolving older content) is a NEW issue with a CURRENT requestId, so it painted synchronously over the correct completion paint; the dataUrl-only guard also reloaded while the correct paint was visible (its `verify` had no notion of newest generation). The requestId guard cannot catch a later-issued-but-older-content write — only a generation token that reflects content newness can.
- timestamp: 2026-08-19 — engine fix (EfxPaintEngine.ts): `setPreviewBaseImageUrl(dataUrl, generation?)`; `appliedPreviewBaseGeneration` gate on BOTH apply paths (cache-hit synchronous and onload) — a settle with generation < applied is a canvas NO-OP but still caches; auto-assigned generations (navigation/editing callers) use a counter that stays above any explicit generation the engine has seen, and above the last applied; `clearPreviewBaseImage` resets the applied generation (a cleared canvas is a fresh generation); `getAppliedPreviewBaseGeneration()` + generation on settle notifications.
- timestamp: 2026-08-19 — guard fix (rotoCompletionPaintGuard.ts): generation-aware. Arms with `intendedGeneration`; `newestLanded()` = applied generation >= intended (or applied dataUrl === intended) → stands down; repair re-applies ONLY the intended dataUrl at the intended generation — the engine gate turns it into a no-op if a newer generation painted between arm and repair. This is the smoking-gun fix: the "repairing" log can no longer fire while the correct (newest) paint is visible.
- timestamp: 2026-08-19 — loader/Studio wiring: `createRotoReferenceLoader` forwards `generation` and accepts `explicitDataUrl` (the repair paints the intended image, never whatever the frame lookup resolves to later); `loadCachedRotoReferenceFrame(..., generation?, explicitDataUrl?)`; the reconcileCurrentFrame port generates a session-monotonic generation = max(last ref, engine applied) + 1 and passes it to the paint + guard.
- timestamp: 2026-08-19 — TDD: RED stash demo — engine stash → 3/76 fail (late-onload gen regression, stale cache-hit re-issue, clear freshness); guard stash → the new generation test fails (pre-fix guard reloads over the newest paint). GREEN — engine 77/77 (5 suites, 7 completion-contract tests incl. explicit/auto interleaving), guard 11/11, loader 6/6, PhysicsPaintStudio 76/76, full app 2605 passed, `tsc --noEmit` clean in both packages (package rebuilt so app sees the new d.ts).
- timestamp: 2026-08-19 — native UAT PENDING: heavy-stroke Motion Action complete final frame at completion with no click; 2-stroke control; console must NOT show the repair log while the correct paint is visible.
- timestamp: 2026-08-19 — 3rd NATIVE REJECTION (user, screenshots + Q&A): the full final render shows correctly at completion, then ~1s later a LAST re-render paints the PREVIOUS render (the PARTIAL first-stroke render of the SAME frame). Cursor stays on the same frame (user-confirmed: NOT navigation). User hypothesis confirmed: the late useEffect reloads the frame from cache, and the cache holds the partial first-stroke render (a decode the previous fix began caching); the generation guard cannot stop it because the reload paints with an AUTO-generation that the engine keeps above the reconcile's explicit generation.
- timestamp: 2026-08-19 — mechanism pinned (static): frame-editing useEffect (useRotoFrameEditingController.ts:187-190) re-fires ~1s after completion on a launchContext/currentFrame/operationId dep change and reloads `input.currentFrame` via `loadCachedRotoReferenceFrame` with NO explicit generation → engine assigns auto-generation = max(counter, appliedGen)+1 (EfxPaintEngine.ts:646-650), and setPreviewBaseImageUrl bumps the auto counter above any explicit generation seen (EfxPaintEngine.ts:567-568). The reconcile's explicit generation G therefore CANNOT gate the effect's reload (auto-gen > G). The reload resolves the frame from the cached/preview source (findCachedRotoReferenceFrame via replaceDirtyFrame=false), which can still hold the PARTIAL render, and paints it over the correct full render.
- timestamp: 2026-08-19 — ROOT CAUSE CLASS: generation ordering is ISSUE-monotonic but CONTENT-agnostic. It correctly orders async decode/apply settlements by issue time, but cannot reject a NEW effect-driven paint whose content is stale yet whose generation (auto, later-issued) is higher. The late useEffect is a fresh write of stale content, not a stale settlement of an earlier write.
- timestamp: 2026-08-19 — FIX DIRECTIONS (from user): (a) never cache a progressive/partial decode as a frame's reference image — or overwrite it when the accepted/full frame settles; and/or (b) make the late effect compare against `getAppliedPreviewBaseDataUrl` and no-op when content is unchanged (the engine already holds the newest content). Keep the generation guard.
- timestamp: 2026-08-19 — 4th NATIVE REJECTION NAMED via DEBUG-PAINTGEN instrumentation (one tagged line per preview-base write seam, engine/app/Studio). User pasted the decisive pair: LAST engine-apply stage=applied gen=6 at ts=70177 appFrame=20; its caller = site=cache-retry (PhysicsPaintStudio canvasCompletedMutation fallback) at ts=70099 with replaceDirtyFrame=true → loader isPlainRefresh=false → the 662e82fd no-op never fired. It fired TWICE (ts=67501, 70099). The correct completion paint was accept-reload at ts=54180 gen=4 applied ts=54349 — 13s BEFORE the cache-retry writes.
- timestamp: 2026-08-19 — ROOT CAUSE (4th): the pixel-cache fallback retry is the late writer. canvasCompletedMutation → captureLivePixels fails → loadCachedRotoReferenceFrame(appFrame, engine, undefined, /*replaceDirtyFrame*/ true). replaceDirtyFrame=true defeated the 662e82fd plain-refresh no-op (which required !replaceDirtyFrame), so the retry reloaded the frame from the stale PARTIAL first-stroke render with a fresh AUTO-generation (issue-monotonic but content-agnostic) and clobbered the settled full render. The retry fired twice because two capture attempts failed.
- timestamp: 2026-08-19 — BYPASS CONFIRMED (answers the earlier question): the 662e82fd no-op fired only when isPlainRefresh = generation===undefined && !replaceDirtyFrame && explicitDataUrl===undefined. It was bypassed by replaceDirtyFrame=true (cache-retry), or by explicitDataUrl:null (strict ===undefined check), or any explicit generation.
- timestamp: 2026-08-19 — FIX (loader seam, direction a): isPlainRefresh no longer requires !replaceDirtyFrame — a plain refresh = no explicit generation AND no explicitDataUrl, REGARDLESS of replaceDirtyFrame. replaceDirtyFrame is not a mark of authoritativeness; every authoritative repaint already passes an explicit generation (reconcile) or clears the base first (navigation). The cache-retry becomes a no-op when the engine holds an explicit settled base for the same appFrame; the double-fire becomes two inert no-ops.
- timestamp: 2026-08-19 — SAFETY CASE covered: a NEW stroke painted on an already-settled frame is still repainted — the authoritative accept passes an explicit generation (reconcile), so it is never 'plain' and never swallowed by the no-op. Regression test added (explicit generation 8 over settled gen 7 paints the new render, clears dirty).
- timestamp: 2026-08-19 — TDD: RED (new cache-retry no-op loader test failed pre-fix, returned true/painted) → GREEN engine 79/79, loader 12/12, full app 2611 passed, tsc --noEmit clean both packages. ALL [DEBUG-PAINTGEN] instrumentation removed before the final commit.

## Evidence (continued — 3rd-rejection fix implemented, 2026-08-19)

- timestamp: 2026-08-19 — direction (b) implemented at the loader (useRotoReferenceController.ts): `createRotoReferenceLoader.load` now reads the engine's applied-preview-base ORIGIN (`getAppliedPreviewBaseDataUrl` / `getAppliedPreviewBaseAppFrame` / `getAppliedPreviewBaseExplicit`) and NO-OPs a PLAIN refresh — `isPlainRefresh = generation === undefined && !replaceDirtyFrame && explicitDataUrl === undefined` — when `appliedExplicit && appliedAppFrame === appFrame && appliedDataUrl !== null && paintDataUrl !== null`. Because the completion reconcile paints at an EXPLICIT generation, the ~1s-late frame-editing-effect reload (auto-gen) cannot re-issue the stale cached PARTIAL render over the settled full render. The no-op still preserves the reference base (`setRepaintBaseFrame` keep-current for the same appFrame) and returns `false` (no paint).
- timestamp: 2026-08-19 — escape analysis verified by tests: navigation legitimately supersedes (calls `clearPreviewBaseImage` first → applied dataUrl/appFrame null → guard passes); a DIFFERENT appFrame load still paints (appliedAppFrame !== appFrame); the reconcile/repair path itself is NOT a plain refresh (replaceDirtyFrame + explicit generation + explicitDataUrl) and always paints. Reference-source invariant covered too: `findCachedRotoReferenceFrame` returns the accepted (full) frame once the accepted render settles — never the lingering progressive partial.
- timestamp: 2026-08-19 — engine origin tracking (EfxPaintEngine.ts): new `appliedPreviewBaseAppFrame` / `appliedPreviewBaseExplicit` fields with getters, set on BOTH apply paths (synchronous cache-hit and onload) via `applyPreviewBaseImage(..., appFrame?, explicit?)`, cleared by `clearPreviewBaseImage()` and `destroy()`. `getAppliedPreviewBaseGeneration` already existed from the generation-ordering fix. The monotonic generation guard is retained.
- timestamp: 2026-08-19 — TDD RED (3rd rejection): loader stale-partial refresh no-op test fails pre-fix (no guard → the partial repaints over the settled full render); engine origin-tracking tests fail pre-fix (mock getters return undefined; the loader guard absent). GREEN: engine 79/79 (5 suites, 9 completion-contract tests incl. appFrame/explicit origin tracking), guard 11/11, loader 10/10, frame-editing 5/5, persistence coordinator 26/26, full app suite 2609 passed, `tsc --noEmit` clean in both packages (efx-physic-paint rebuilt so the app resolves the new d.ts).
- timestamp: 2026-08-19 — native UAT PENDING: heavy-stroke Motion Action full final frame stays correct ~1s+ later with NO late revert to the partial first-stroke render; 2-stroke control correct.

## Evidence (continued — Layer 2 + Layer 3 implemented, 2026-08-19)

- timestamp: 2026-08-19 — LAYER 2 — CONTENT-REVISION ordering at the engine apply seam (the invariant). The preview-base generation gate was ISSUE-monotonic but CONTENT-agnostic: a stale frame (older content revision) re-issued LATER — the pixel-cache fallback retry or the frame-editing effect reloading a PARTIAL first-stroke render — carried a fresh auto-generation above the completion reconcile's explicit generation, so the gate let it clobber the settled accepted render. Layer 2 replaces the generation semantic with a CONTENT token: (a) engine `setPreviewBaseImageUrl(dataUrl, contentToken?, appFrame?)` — a settle whose token is below the applied one is a canvas NO-OP (cache populated, never painted) on BOTH apply paths (synchronous cache-hit and onload); `getAppliedPreviewBaseContentToken()` accessor; auto-assignment renamed `nextPreviewBaseContentToken` (stays above any explicit token seen); `clearPreviewBaseImage` resets the gate. (b) store: session-global monotonic `resolveContentToken()` registry (Map + counter) assigned per distinct physical content revision, cleared on store `reset()`; `getContentToken(layerId)` resolves the accepted document's token. (c) wiring: the completion reconcile paints at the accepted CONTENT token (`Math.max(acceptedToken, applied)` — always paints, never below the gate, idempotent on equal); the loader threads the frame's CONTENT token for navigation/effect/retry paints so a stale frame stays inert even though its request is issued later; coordinator and Studio forward `resolveContentToken`. Navigation still supersedes legitimately by clearing the base first.
- timestamp: 2026-08-19 — LAYER 3 — ONE render after the stroke sequence. During a continuous stroke sequence (Action/Play generating many strokes inside the inactivity window) the engine finalized ONE stroke per post-idle frame, publishing intermediate per-stroke physics renders — the 'last strokes missing until a click' amplifier. Layer 3 makes STROKE_FINALIZATION_IDLE_MS the single rule: `runScheduledStrokeFinalizationFrame` drains the WHOLE pending queue in ONE post-idle `runStrokeFinalizationTurn(true)` when it holds a real burst (queue length > 1 — the pending queue INCLUDES the active stroke, so a single stroke keeps the cooperative one-safe-step-per-visual-frame pacing); the lifecycle flush path (`flushPendingStrokeFinalizations`) is unchanged.
- timestamp: 2026-08-19 — TDD (Layer 2): RED — loader test 'threads the frame CONTENT token' failed pre-wiring (painted with auto-assigned content-agnostic token); GREEN — engine previewBase-completion 14/14, store 52/52, loader 14/14, coordinator 27/27, Studio 76/76.
- timestamp: 2026-08-19 — TDD (Layer 3): RED test 'Layer 3: coalesces a continuous multi-stroke sequence into ONE post-idle drain' failed pre-fix (three separate finalizations); GREEN — engine 82/82 (5 suites), full app 2616 passed, `tsc --noEmit` clean both packages.
- timestamp: 2026-08-19 — COMMITS (separate, RED-first): `baf7bbfb fix(debug): Layer 2 - order preview-base paints by CONTENT token, not issue order`; `5d8d8a9e fix(debug): Layer 3 - coalesce a multi-stroke sequence into ONE post-idle render`. All [DEBUG-PAINTGEN] instrumentation absent.
- timestamp: 2026-08-19 — native UAT PENDING (Layer 2+3): heavy-stroke Motion Action shows ONE complete final render at completion (no intermediate per-stroke renders, no late revert); 2-stroke control correct; a NEW stroke painted on the settled frame still repaints (safety case).
