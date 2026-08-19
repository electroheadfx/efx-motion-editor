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
hypothesis: CONFIRMED mechanism — the acceptance reconcile paint (engine.clear + setPreviewBaseImageUrl of the committed frame) is the FINAL paint; if its cache-miss decode is superseded before onload, the engine drops it silently (never cached, never retried) and the canvas keeps the pre-apply image until the next explicit paint. The exact in-production invalidator is not statically identifiable (audit exhausted); count-dependence enters via decode duration. Fix = guaranteed-completion contract: cache-on-drop + applied-state tracking + settle notification in the engine, plus a bounded settlement-aware repair guard armed by the Studio reconcile port.
test: RED CONFIRMED — 5/6 engine tests fail against the pre-fix engine (stash demo); guard/chain RED = module absent pre-fix → GREEN — engine 73/73 (5 suites), guard+chain 10/10, app hooks 79/79, PhysicsPaintStudio 76/76, tsc clean in both packages
expecting: native UAT — heavy-stroke Motion Action shows the complete final frame at completion with no click; 2-stroke Action remains correct (control)
next_action: native human verification with a heavy-stroke Action (watch console for the guard repair log `[PhysicsPaintStudio] physical edit: Completion paint ... was dropped — repairing` to name the racer); on pass, archive session to resolved/
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
  The acceptance reconcile paint (engine.clear + setPreviewBaseImageUrl of the committed
  frame) is the FINAL preview-base paint of a multi-stroke completion. On a cache miss the
  engine decodes via `new Image()`; if any invalidation lands inside the decode window, the
  onload guard (requestId/destroyed/animationMode/drawing) dropped the decode BEFORE caching
  it and nothing retried — the canvas kept the pre-apply image until the next explicit
  repaint (a click). The decode window scales with PNG size, which is why 2-stroke Actions
  always win the race and many-stroke Actions expose it. The exact in-production invalidator
  is not statically identifiable (audit exhausted); the fix is a completion-ordering
  guarantee that repairs the drop regardless of which invalidator fired.
fix: |
  1. Engine (EfxPaintEngine.ts): cache-on-drop — a decoded image is inserted into
     previewBaseImageCache even when the apply guard drops the request (unless destroyed),
     converting any repair re-request into a synchronous cache-hit apply.
  2. Engine: applied-state tracking (getAppliedPreviewBaseDataUrl) and settle notification
     (onPreviewBaseSettled, 'applied'|'dropped' per cache-miss decode and on decode error).
  3. New guard module (rotoCompletionPaintGuard.ts): armRotoCompletionPaintGuard arms after
     the completion paint; on a dropped settle of the intended dataUrl (or a different frame
     applying over the guarded frame while the cursor holds) it re-runs the current-frame
     load — a synchronous cache-hit apply — and disarms. Bounded (default 2 attempts), stands
     down when the paint landed or the cursor moved.
  4. Studio wiring (PhysicsPaintStudio.tsx reconcileCurrentFrame port): arms the guard with
     the accepted reference frame's dataUrl (findAcceptedRotoReferenceFrame exported from
     useRotoReferenceController) and logs repairs to the console for racer identification.
verification: |
  - RED confirmed: 5/6 new engine tests fail against the pre-fix engine (git stash demo);
    guard/chain RED = module absent pre-fix.
  - GREEN: engine 73/73 (5 suites, incl. 6 new completion-contract tests);
    guard + loader/guard/engine chain 10/10; app hooks 79/79 (reference controller,
    cached playback, physical edit coordinator); PhysicsPaintStudio 76/76.
  - tsc --noEmit clean in packages/efx-physic-paint and app.
  - Native UAT PENDING: heavy-stroke Motion Action must show the complete final frame at
    completion with no click; watch console for the guard repair log line.
files_changed:
  - packages/efx-physic-paint/src/engine/EfxPaintEngine.ts
  - packages/efx-physic-paint/src/engine/EfxPaintEngine.previewBaseCompletion.test.ts
  - app/src/components/physic-paint/hooks/rotoCompletionPaintGuard.ts
  - app/src/components/physic-paint/hooks/rotoCompletionPaintGuard.test.ts
  - app/src/components/physic-paint/hooks/useRotoReferenceController.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx

## Evidence (continued — TDD loop, 2026-08-19)

- RED demo: `git stash push -- packages/efx-physic-paint/src/engine/EfxPaintEngine.ts` → 5/6 completion-contract tests fail against the pre-fix engine (the destroy-path test passes trivially pre-fix); `git stash pop` restored the fix. Guard/chain RED pre-fix = module absent (import failure).
- GREEN: engine 73/73 across 5 suites; guard + chain 10/10; app hook suites 79/79; PhysicsPaintStudio 76/76; `tsc --noEmit` clean in both packages. Engine suites run via the established pattern `cd app && pnpm vitest run --root ../packages/efx-physic-paint src/engine` (per 38.1-07-SUMMARY deviation note; no config changes).
- Prior session-manager turn was interrupted by an API quota error after the static audit; the interrupted debugger turn had already written all three test legs and the full implementation uncommitted. This turn verified RED/GREEN, reviewed the diff, and committed.
