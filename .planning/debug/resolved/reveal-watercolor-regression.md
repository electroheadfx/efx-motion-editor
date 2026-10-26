---
status: resolved
trigger: |
  Reveal issue regression with watercolor (not tested with brush. Pendant que tu regardes je test le brush et je reviens vers toi)

  # Reveal creation
  - photo BG is [Image #3] (bunny photo)
  - the paint is [Image #4] (blue watercolor wash)
  - the script saved for reveal is [Image #5], it apply fine
  - when I apply the reveal it give stroke instead paint alpha reveal photo [Image #6] and stroke seem resized horyzontally on the left

  After this operation next operation fails:
  # I got these series of error after to try to create a reveal rail with a photo

  - Tried to delete a key or anything I got error:
    [Error] [PhysicsPaintStudio] physical edit: – "Roto physical edit failed (parent-rejection): Could not apply physics paint output. Keep the standalone open and try again from the curren…"
    "Roto physical edit failed (parent-rejection): Could not apply physics paint output. Keep the standalone open and try again from the current layer/frame. Roto physical revision became stale before commit."

  - here I tried to add a new rail for apply and test my watercolor script: same stale-revision parent-rejection
  - here Tried to apply a new key: same stale-revision parent-rejection
  - When I quit studio I have not more error except if I try to create a reveal rail
created: 2026-10-26
updated: 2026-10-26
goal: find_and_fix
---

# Debug Session: reveal-watercolor-regression

DATA_START

## Symptoms

### Expected behavior

Creating a Reveal rail from a saved watercolor script must bake the photo reference **masked by the script's painted coverage** (paint alpha reveals the photo). After the bake, every normal physical edit in the Studio (delete key, add rail, apply key, etc.) must keep working.

### Actual behavior

1. **Reveal bake renders the recorded guide strokes, not the paint coverage.** The baked keys show the hard black scribbles from the script over the photo instead of the photo showing through the watercolor wash's alpha. Strokes also look horizontally resized/squashed on the left.
2. **Every subsequent physical edit is parent-rejected.** Delete key, add a new rail, apply a new key all fail with the stale-revision error below. Quitting the Studio clears the error; creating another Reveal rail reproduces it.

User confirms:
- Prior to today, Reveal had **never been tested** in this build (not a confirmed previously-working case; "regression" = regression-testing surface).
- The incorrect reveal rail **persists in the main app after closing the Studio**.

### Error messages (verbatim)

```text
[Error] [PhysicsPaintStudio] physical edit: – "Roto physical edit failed (parent-rejection): Could not apply physics paint output. Keep the standalone open and try again from the curren…"
"Roto physical edit failed (parent-rejection): Could not apply physics paint output. Keep the standalone open and try again from the current layer/frame. Roto physical revision became stale before commit."
    logDiagnostic (PhysicsPaintStudio.tsx:1528)
    (anonymous function) (useRotoPhysicalEditCoordinator.ts:823)
    (anonymous function) (useRotoPhysicalEditCoordinator.ts:841)
    consumeBridgeApplyResult (PhysicsPaintStudio.tsx:3187)
    consumeBridgeApplyResult (PhysicsPaintStudio.tsx:719:109)
    (anonymous function) (usePhysicsPaintApplyResultController.ts:83)
    (anonymous function) (usePhysicsPaintParentBridge.ts:306)
    (anonymous function) (user-script:17:272)
    runCallback (user-script:17:284)
    value (user-script:17:366)
    (anonymous function) (physics-paint:1:91)
    Global Code (physics-paint:1:1550)
```

### Timeline

First Reveal attempt with a watercolor script today (2026-10-26). Never validated before in this build. User is testing brush in parallel and will report whether brush scripts behave differently.

### Reproduction

1. Project with a photo reference (bunny photo, Image #3).
2. Paint a watercolor wash (Image #4) and save it as a script (Image #5); normal Apply works fine.
3. In the Physics Paint Studio, Create Rail → Reveal, selecting that watercolor script.
4. Observe the baked reveal: hard guide strokes over the photo, squashed horizontally on the left (Image #6, screenshot `/Users/lmarques/Desktop/Capture d’écran 2026-10-26 à 15.42.51.png`).
5. Any further physical edit (delete key, add rail, apply key) → stale-revision parent rejection.
6. Close Studio → errors stop; the wrong reveal rail remains in the main app; creating another Reveal rail reproduces the cascade.

Screenshots referenced by the user:
- `/Users/lmarques/Desktop/Capture d’écran 2026-10-26 à 15.43.50.png` — photo background
- `/Users/lmarques/Desktop/Capture d’écran 2026-10-26 à 15.43.09.png` — watercolor paint / saved script
- `/Users/lmarques/Desktop/Capture d’écran 2026-10-26 à 15.42.51.png` — reveal output (strokes over photo)

## Code-level leads (NOT prescriptive — verify against live evidence)

L-A. **Reveal bake uses the engine-1 stroke renderer for every script.**
`renderRotoRevealFrames` (`app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts:79`) replays `flattenScriptStrokes(script)` through `EfxPaintEngine.renderProgressiveAlphaFrame`. It never reads `script.engineId` (`'efx-watercolor'`) nor `script.aquarelleEvents`. The script clipboard's own docs (`physicsPaintRotoScriptClipboard.ts:117-122`) state that engine-1 "draws only the guide line, never the wash". That exactly matches a mask made of guide strokes. `commitRevealBake` (`physicPaintStore.ts:1984`) also has no aquarelle branch. Check whether Reveal is supposed to support aquarelle scripts at all, and whether the Create Rail script picker filters by engine.

L-B. **Cross-realm revision carrier divergence for brand-new baked keys.**
The Studio is a separate `/physics-paint` webview (`app/src/main.tsx:37`). Reveal creation runs in the child (`PhysicsPaintStudio.tsx` createReveal port → `createRevealRail` → `commitRevealBake` → `replaceRotoPhysicalRecords`). The document sync projects records to media references and ships new rasters via `changedBytes` (`physicsPaintBridgeTransport.ts` `projectRecordsForSync`). On the parent, `preserveMirroredInlineBytes` (`physicPaintBridge.ts:3481`) can only reconstruct bytes when (a) the parent already holds the same keyId or (b) the digest exists in `bytesByDigest`, which `mirrorSyncedTrackDocuments` builds **only from the parent's existing runtime records** (`physicPaintBridge.ts:3565-3573`), not from the incoming `changedBytes` / bridged frame store. A brand-new baked reveal key therefore stays media-shaped in the parent runtime while the child hashes byte terms (`d<token>;` vs `m<path><digest>;`), and every later physical edit is rejected "Roto physical revision became stale before commit." This is the same documented failure family at `physicPaintBridge.ts:3496-3505`.

L-C. **The horizontal squash is unexplained by L-A alone.** Possible coordinate-space mismatch when aquarelle guide strokes are replayed through engine-1 at working size, or an interaction with `getPhysicsPaintWorkingSize`/reference `zoom` in `compositeRevealMask`. Characterize after L-A/L-B.

Related prior work: `.planning/debug/studio-track-physical-edits.md`; quick 260921-c7x (physical-edit settlement); quick 260920-kov (Reveal WR-02/WR-01); memory `project_phase52_reveal_reorientation.md`.

## Evidence

- timestamp: 2026-10-26 (brush-mode discriminator, user-run)
  - BRUSH script Reveal produces a CORRECT photo mask (Image #8: bunny photo showing through the blue brush coverage) — so `renderRotoRevealFrames` + `compositeRevealMask` work for engine-1 scripts.
  - BRUSH Reveal also shows the left-side horizontal squash/resize of the painted coverage (same artifact family as the watercolor run). The squash is therefore NOT caused by the aquarelle route; it reproduces across both script engines.
  - No stale-revision error was reported during the brush test (user has not reported the post-reveal edit cascade in brush mode yet — unverified whether it also occurs with brush).
- timestamp: 2026-10-26 (user note)
  - User: "I forgot Iam on square format" — the project/canvas is SQUARE. This is the condition under which the bake's size authority matters.
- timestamp: 2026-10-26 (static trace, read-only)
  - `commitRevealBake` (`physicPaintStore.ts:1999-2005`) derives `projectSize = _compositorSizeProvider?.() ?? FALLBACK_COMPOSITE_SIZE` and then `size = getPhysicsPaintWorkingSize(projectSize)`.
  - `FALLBACK_COMPOSITE_SIZE` is 1920×1080 (`physicPaintStore.ts:542`) and `projectStore` width/height start as 1920×1080 (`projectStore.ts:57-58`).
  - The provider is wired ONLY in `projectStore.ts:1226` module body; projectStore hydrates width/height only when a project is loaded/opened in that realm (lines 501-502, 875-884, 921-922).
  - The Studio child (`/physics-paint`, `main.tsx:37`) renders `PhysicsPaintStudio`, whose module graph does not import projectStore (no non-test importer under `components/physic-paint`); its canvas size comes from `launchContext.width/height` (`PhysicsPaintStudio.tsx:1372-1377`).
  - Therefore, in the child where Reveal creation runs, the provider resolves projectStore's untouched defaults → 1920×1080 even when the project is square. The bake's coverage canvas and its reference `zoom` are computed for a landscape canvas while the strokes were recorded on the square Studio canvas; the reference is centered and the coverage is top-left-anchored, producing an off-center intersection that reads as a horizontal squash toward the left. This mechanically explains the cross-engine artifact.

## Eliminated

- hypothesis: L-A alone explains every symptom. A brush script renders a correct mask, so the watercolor guide-stroke result is specifically the missing aquarelle route in the Reveal bake; it does NOT explain the shared left-side squash.
- hypothesis: the left-side squash is watercolor-specific. It reproduces with brush scripts.
- hypothesis (2026-10-26 static trace): the squash is introduced by the child's flattened-compositor size (the child's `_compositorSizeProvider` also resolves to 1920×1080). Eliminated as the visible cause: the monitor draws the track raster into the composite at composite size and then the composite is drawn to the layout canvas at layout size (`efxPaintCompositor.ts:336`, `PhysicsPaintProgramMonitor.tsx:200`) — two drawImage stretches that cancel for any raster. The baked pixels themselves carry the wrong geometry (L-C).
- hypothesis (2026-10-26): the reveal bake already uses the Studio `getSize` authority as its comment claims. Eliminated: `commitRevealBake` reads `_compositorSizeProvider` (`physicPaintStore.ts:2001`), while the PlayScript path really uses `ports.getSize()` = Studio canvas dims (`physicsPaintRotoPlayScriptController.ts:1503`, `PhysicsPaintStudio.tsx:3245`).

## Evidence (cont. — static trace 2026-10-26, read-only)

- L-A CONFIRMED structurally:
  - `renderRotoRevealFrames` (`physicsPaintRotoPlayScriptRenderer.ts:79`) constructs an `EfxPaintEngine`, flattens `script.brushes` (`:100`) and renders via `renderProgressiveAlphaFrame` (`:141`). No `engineId`, no `aquarelleEvents` read anywhere in the file.
  - The only engine dispatch in the app is PlayScript apply: `physicsPaintRotoPlayScriptController.ts:1500-1505` (`snapshot.engineId === 'efx-watercolor' ? bakeAquarelleScript(...) : renderRotoPlayScriptFrames(...)`).
  - Reveal path: `confirmReveal` (`:1319`) → Studio `createReveal` port (`PhysicsPaintStudio.tsx:3282`) → `createRevealRail` (`efxPaintStore.ts:1510`) → `commitRevealBake` (`physicPaintStore.ts:1984`) → `renderRotoRevealFrames`. No engine check at any hop.
  - Script clipboard contract (`physicsPaintRotoScriptClipboard.ts:113-122`): "engine-1 draws only the guide line, never the wash." Matches the user's hard-scribble bake exactly.
  - Aquarelle support is feasible: `createAquarelleBake` frames carry wash alpha with alpha 0 unpainted (`packages/efx-watercolor/src/bake/aquarelleBake.ts:22-23,52`), so the coverage can feed the same `destination-in` composite; the adapter is available in the Studio realm (`createDefaultAquarelleAdapter`, controller `:1857`).
- L-C CONFIRMED:
  - Studio canvas truth: `launchContext.width/height` → `getPhysicsPaintWorkingSize` (`PhysicsPaintStudio.tsx:1372-1376`); PlayScript bake uses `ports.getSize()` = those dims (`:3245`).
  - Reveal bake truth: `projectSize = _compositorSizeProvider?.() ?? FALLBACK_COMPOSITE_SIZE` (`physicPaintStore.ts:2001-2003`). The provider is wired only from projectStore's module body (`projectStore.ts:1226`) to its signals, which are 1920×1080 defaults (`:57-58`) in the Studio child — no project load runs there (`main.tsx` child branch; no projectStore importer under `components/physic-paint`).
  - Consequence for a square project with side < 1920: bake canvas 1920×1080, reference drawn centered in landscape, strokes clipped/stretched; the baked raster is then drawn to the square Studio canvas (compositor stretch, see Eliminated) → horizontally compressed reveal biased to the left. For side > 1920 the axis flips; the mechanism is the same.
- L-B CONFIRMED:
  - Child runtime after reveal: `replaceRotoPhysicalRecords` → byte-shaped records/revision; document projection is byte-shaped (`extractRuntimeStateForDocument`), then `projectEfxPaintDocumentForSync` ships media refs + `changedBytes` (`physicsPaintBridgeTransport.ts:231-263`).
  - Parent listener installs `changedBytes` into `_frameMediaBytes` (`physicPaintBridge.ts:3401-3445`; store `:596,607,620`) and then schedules the mirror (`:3705`).
  - `mirrorSyncedTrackDocuments` builds `bytesByDigest` ONLY from the parent's pre-existing runtime records (`:3565-3575`); `preserveMirroredInlineBytes` falls back only to that map (`:3509`). A brand-new baked keyId has neither → record stays media-shaped while the child hashes byte terms.
  - Next sync hits the guard `getRotoPhysicalContentRevision(parent) === wire.revision` (both media) and skips the mirror entirely (`:3595`) — divergence is permanent for that track. Every later apply sends the child's byte-shaped `expectedRevision`, rejected at `physicPaintBridge.ts:1735-1736`.
  - `awaitPendingPhysicPaintFrameMediaInstalls` exists (`:3367`) but is never called from the mirror path, so even a byte lookup would race the async digest install.
  - No store getter exposes `_frameMediaBytes` (only `hasFrameMediaBytes`), so the installed bytes are unreachable by the preserve step.
  - This is carrier-generic for ANY new byte-carrying key that reaches the parent only via docSync; reveal creation is the first such path (normal applies carry their own payload and install bytes at `:515`).

## Current Focus

hypothesis: Three defects are confirmed, independent: (L-A) Reveal never dispatches on `engineId`/`aquarelleEvents`, so watercolor scripts bake engine-1 guide strokes; (L-C) the reveal bake sizes itself from the parent-only `_compositorSizeProvider` (1920×1080 defaults in the child) instead of the Studio launch dims, so square projects bake a landscape mask; (L-B) new baked keys cannot be reconstructed byte-shaped by the parent mirror because the installed `changedBytes` are never consulted, so the parent revision stays media-shaped and every later physical edit is rejected stale.
test: L-B live UAT PASSED; L-C live UAT PASSED on the square project. L-A first UAT FAILED (whole photo — the aquarelle capture is opaque MODE.transparent transmittance); corrected with `transmittanceToAlpha`, then L-A live UAT PASSED (user: "Work its fixed ! congrats."). Regression tests added (2026-10-26): the reveal store test pins the explicit portrait `projectSize` + `aquarellePaper` plumbing; the renderer suite pins the aquarelle dispatch, the transmittance→pigment-alpha conversion, and the motion wiring (`motion.startFrame` = rail start). Gates: `tsc` clean; 50 focused tests pass (reveal 27 + renderer 21 + leak 2).
expecting: confirmed live — brush and watercolor reveals align on the square project, the wash masks the photo, and the stale-revision cascade stays fixed.
next_action: None — native UAT approved 2026-10-26. The optional motion live check failed (per-deposit poses froze the cumulative sheet); that follow-up was fixed and UAT-approved in `.planning/debug/resolved/watercolor-motion-wiggle.md`. Separate follow-up (not this session's root cause): the saved watercolor script's library thumbnail renders the thin engine-1 guide strokes instead of the wash — schedule separately.

## Resolution

root_cause: >-
  (L-A) Reveal has no engine dispatch: `renderRotoRevealFrames` replays `script.brushes` through engine-1 for every script, so an aquarelle script bakes its guide lines, never the wash.
  (L-C) `commitRevealBake` sizes the bake from `_compositorSizeProvider` — the PARENT projectStore dims — which in the Studio child realm are the untouched 1920×1080 defaults, not the square launch dims the Studio canvas (and the PlayScript bake) use.
  (L-B) `changedBytes` deliver the new baked rasters into `_frameMediaBytes`, but `preserveMirroredInlineBytes`/`mirrorSyncedTrackDocuments` only consult the parent's pre-existing runtime bytes, so the new keys stay media-shaped and the parent revision never matches the child's byte-shaped `expectedRevision`.
fix: >-
  (L-B) APPLIED + LIVE-UAT PASSED (2026-10-26): `getFrameMediaBytes` in physicPaintStore.ts; `await awaitPendingPhysicPaintFrameMediaInstalls()` at the top of `mirrorSyncedTrackDocuments`; `preserveMirroredInlineBytes` now falls back to `getFrameMediaBytes(media.digest)`, so a brand-new key delivered through the document-sync byte channel is mirrored byte-shaped instead of staying media-shaped.
  (L-C) APPLIED (2026-10-26): `projectSize` is required on `RevealBakeInput`, `createRevealRail`, and `replayRevealRail`; `commitRevealBake` no longer reads `_compositorSizeProvider`; the Studio createReveal port passes `launchContextRef.current` width/height with the Studio default fallback, so a square project bakes at the square working size.
  (L-A) SUPPORT APPLIED + CORRECTED (2026-10-26): `renderRotoRevealFrames` dispatches aquarelle scripts to `renderRotoRevealFramesAquarelle`, which bakes the wash via `createAquarelleBake` (progressive growth / static held wash, motion, paper). The capture is opaque transmittance, so each wash frame is converted with `transmittanceToAlpha` before the `destination-in` mask — the first implementation used the transmittance alpha and revealed the whole photo. The Studio paper rides through as `aquarellePaper`.
verification: L-B live UAT passed (brush-mode cascade). L-C live UAT passed on the square project (vertical is ratio-independent by construction — both axes scale from the carried project size). L-A live UAT passed (2026-10-26 — user: "Work its fixed ! congrats.") after the transmittance→pigment-alpha correction. Regression tests added: reveal store (portrait projectSize + aquarellePaper), renderer structural pins (aquarelle dispatch, transmittanceToAlpha, motion startFrame). Automated gates clean — `tsc --noEmit`; 50 focused tests pass (reveal 27 + renderer 21 + leak 2). Follow-up, separate from this session: watercolor script library thumbnails render the engine-1 guide strokes instead of the wash.
files_changed:
  - app/src/stores/physicPaintStore.ts
  - app/src/stores/efxPaintStore.ts
  - app/src/lib/physicPaintBridge.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts
  - app/src/efx-paint/compositor/efxPaintRevealLeakContract.test.ts
  - app/src/stores/efxPaintStore.reveal.test.ts
  - app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts

DATA_END
