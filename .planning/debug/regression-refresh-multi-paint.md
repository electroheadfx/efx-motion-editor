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
hypothesis: CONFIRMED (UPDATED after native UAT rejection of 60fb8ca5) — that fix INVERTED the race: the stale async decode/apply (a cache-hit re-issue resolving older content, or the dataUrl-only guard reloading) lands AFTER the correct completion paint and clobbers it. The completion guard checked whether a paint landed, not whether what landed was the NEWEST generation. FIXED with MONOTONIC GENERATION ORDERING at the engine apply seam: every preview-base request carries a monotonic generation; a settle with an older generation than the last applied paint is a canvas NO-OP (may cache, never paints). The Studio reconcile paints with a session-monotonic generation (strictly above the last applied); the completion guard is generation-aware — it repairs ONLY while the newest generation has not landed, re-applies ONLY the intended image at its intended generation, and stands down the moment any generation >= its intent is applied (the smoking-gun "repairing log while the correct paint is visible" can no longer happen).
test: RED CONFIRMED (stash demo) — 3 new engine tests fail pre-fix (76 engine total, 73 pre-fix; late-onload gen regression, stale cache-hit re-issue, clear resets freshness) + 1 new guard test fails pre-fix (newer-generation-settled is a no-op). GREEN — engine 77/77 (5 suites incl. 7 completion-contract tests), guard 11/11, loader 6/6, PhysicsPaintStudio 76/76, full app suite 2605 passed, tsc --noEmit clean in both packages.
expecting: native UAT — heavy-stroke Motion Action shows the complete final frame at completion with no click; 2-stroke Action remains correct (control); the console guard repair log must NOT fire while the correct paint is already visible.
next_action: native human verification with a heavy-stroke Action (and the 2-stroke control); on pass, archive session to resolved/.
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
  The 60fb8ca5 completion-contract fix INVERTED the original race. The engine's
  preview-base apply seam guarded ONLY on issue-order (requestId === previewBaseRequestId),
  which a STALE cache-hit re-issue defeats: the repair path re-issued a synchronous
  cache-hit whose dataUrl resolved to OLDER content (the first stroke's render), and the
  requestId-only dataUrl guard had no notion of "newest generation" — it reloaded even
  while the correct completion paint was visible, painting the stale image over it. The
  requestId guard cannot catch a later-issued-but-older-content write; only a generation
  token that reflects content newness can. Required invariant: monotonic generation
  ordering on the preview-base apply path.
fix: |
  1. Engine (EfxPaintEngine.ts): MONOTONIC GENERATION ordering at the apply seam —
     setPreviewBaseImageUrl(dataUrl, generation?) with an appliedPreviewBaseGeneration gate
     on BOTH apply paths (synchronous cache-hit and onload): a request settling with a
     generation OLDER than the last applied paint is a canvas NO-OP (still cached for
     repair), so a stale decode/apply can never paint over the newest generation. Auto
     generations (navigation/editing callers) stay above any explicit generation seen and
     above the last applied; clearPreviewBaseImage resets the gate (cleared canvas = fresh).
     getAppliedPreviewBaseGeneration() + generation on settle notifications exposed.
  2. Guard (rotoCompletionPaintGuard.ts): generation-aware — arms with the intended
     generation, repairs ONLY while the newest generation has not landed (newestLanded =
     appliedGeneration >= intended, or the intended dataUrl), re-applies ONLY the intended
     image at its intended generation, and stands down when a newer generation applied
     (the smoking-gun "repairing while the correct paint is visible" cannot occur).
  3. Loader/Studio (useRotoReferenceController.ts, PhysicsPaintStudio.tsx): loader forwards
     generation and accepts explicitDataUrl (the repair paints the intended image, never
     whatever the frame lookup resolves to later); reconcileCurrentFrame generates a
     session-monotonic generation = max(previous ref, engine applied) + 1 for the paint + guard.
  4. The original cache-on-drop + settle-notification machinery is retained (a dropped
     completion decode is still cached so a repair is a synchronous cache-hit), but it is
     now gated by the generation ordering — it repairs, never clobbers.
verification: |
  - RED confirmed (stash demo): engine stash → 3 new tests fail pre-fix (late-onload
    generation regression, stale cache-hit re-issue, clear-resets-freshness); guard stash →
    the newer-generation-settled no-op test fails (pre-fix guard reloads over the newest paint).
  - GREEN: engine 77/77 (5 suites, 7 completion-contract tests); guard 11/11; loader 6/6;
    PhysicsPaintStudio 76/76; full app suite 2605 passed; tsc --noEmit clean in both packages
    (efx-physic-paint rebuilt so the app resolves the new d.ts).
  - Native UAT PENDING: heavy-stroke Motion Action complete final frame at completion with no
    click; 2-stroke control correct; console repair log must NOT fire while the correct paint is visible.
files_changed:
  - packages/efx-physic-paint/src/engine/EfxPaintEngine.ts
  - packages/efx-physic-paint/src/engine/EfxPaintEngine.previewBaseCompletion.test.ts
  - app/src/components/physic-paint/hooks/rotoCompletionPaintGuard.ts
  - app/src/components/physic-paint/hooks/rotoCompletionPaintGuard.test.ts
  - app/src/components/physic-paint/hooks/useRotoReferenceController.ts
  - app/src/components/physic-paint/hooks/useRotoReferenceController.test.ts
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
