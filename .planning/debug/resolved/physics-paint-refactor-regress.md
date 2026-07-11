---
status: resolved
trigger: "Run a focused GSD debug for regressions introduced by the Phase 36.13 Debug 01 PhysicsPaintStudio refactor."
created: 2026-07-11
updated: 2026-07-11T14:11:44Z
---

# Physics Paint Refactor Regressions

## Symptoms

### Expected behavior

When playback is stopped, manual timeline clicks and previous/next controls update the canonical selected frame and all projections. Interpolation can be disabled persistently per layer and generated frames disappear. During playback, key utility state is frozen and non-actionable, then recomputed once after Stop.

### Actual behavior

Manual Roto navigation remains stuck at frame 0 while playback advances. The interpolation toggle immediately remains or returns enabled. Key utility controls visibly update on every playback frame.

### Error messages

No reported error messages.

### Timeline

The regressions appeared after the Phase 36.13 Debug 01 refactor that extracted PhysicsPaintStudio ownership into hooks, roto, play, engine, bridge, and view modules.

### Reproduction

Open Physics Paint in Roto mode on branch `phase-36.13-debugs`. Starting at frame 0, click another timeline cell or previous/next; toggle interpolation off; start playback and observe Insert, Duplicate, Copy, Paste, and Delete across playback ticks.

## Scope and Constraints

- Debug 01 regression fix only; do not start Debug 02 or dynamic-spacing work.
- Do not add feature scope.
- Do not restore ownership to `PhysicsPaintStudio.tsx`.
- Do not add Roto internal `useEffect`.
- Do not create compatibility re-exports.
- Do not start the dev server; live UAT is user-owned.
- Preserve the existing uncommitted asset-import correction in `app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx` and include it in the atomic regression commit if still uncommitted.
- Diagnose the manual navigation, playback progression, and interpolation toggle data flows separately before patching.
- Use Preact Signals, computed/selectors, and explicit actions; keep playback preview distinct from editable selection.
- Add behavioral regression tests for canonical navigation, persistent interpolation disable/projection, and playback utility stability.
- Run focused tests, broader Physics Paint tests, `pnpm --dir app typecheck`, `pnpm --dir app build`, and `git diff --check`.
- Commit atomically after automated gates pass, then stop at live UAT. Do not mark fully accepted before user UAT.

## Current Focus

- hypothesis: "The Tauri command boundary strips `rotoBackground` because Rust's `PhysicsPaintLaunchContext` omits the TypeScript field. Physics playback therefore receives no background metadata, never mounts its paper raster, and displays the white canvas shell beneath the transparent cached paint animation."
- test: "Deserialize a realistic TypeScript launch payload containing `rotoBackground` into the Rust launch struct, serialize it back exactly as the child fetch receives it, and assert the metadata object survives unchanged."
- expecting: "Before the native field exists, the round-trip output has no `rotoBackground`; after adding the serde field, the exact background, paperGrain, grainStrength, and color values survive."
- next_action: "Resolved after live Tauri UAT confirmed manual navigation, interpolation, stable playback utilities, clean playback composition/teardown, and correct paper background."
- ranked_hypotheses:
  A: "Confirmed: Rust command deserialization silently drops `rotoBackground` because the native launch struct omits it."
  B: "Texture asset URL fails in the child window after valid metadata arrives."
  C: "Resolved texture does not repaint the mounted playback canvas."
  D: "A later layer covers an otherwise correct paper raster."
- reasoning_checkpoint:
  hypothesis: "The white-only playback is caused at the native transport boundary, before browser rendering: TypeScript sends `rotoBackground`, but Tauri deserializes into a Rust struct without that field and silently discards it."
  confirming_evidence:
    - "`createPhysicPaintLaunchContext` includes `rotoBackground`, while Rust `PhysicsPaintLaunchContext` jumped from `playMotion` to `previewFrame` with no corresponding serde field."
    - "The child fetches and receives the Rust-stored clone, so the dropped field cannot be recovered from the URL or browser state."
    - "Physics playback only mounts its paper composition when `launchContext.rotoBackground` exists; without it, the transparent cached PNG animates over the white shell exactly as seen in live UAT."
    - "The exact native RED test returned `left: None` versus the full expected `rotoBackground` object; adding the serde field makes the same test pass."
  falsification_test: "If a rebuilt Tauri app now delivers `rotoBackground` but playback remains white, capture the child payload and image load result; asset loading becomes the next boundary."
  fix_rationale: "Preserve the existing TypeScript/editor paper renderer and add only the missing native launch-contract field so the child receives the authoritative persisted metadata."
  blind_spots: "Live UAT requires a native rebuild/relaunch; hot browser code alone cannot activate the changed Rust command struct."

- reasoning_checkpoint:
  hypothesis: "66febfa8 caused total paint loss by replacing a live-proven declarative PNG image with an unproven imperative decode/draw canvas; it also coupled paper and paint readiness and used an unverified paper geometry contract."
  confirming_evidence:
    - "The exact pre-66febfa8 `<img src={frame.dataUrl}>` path displayed and advanced paint in live UAT; the exact post-66febfa8 canvas path displays zero paint."
    - "The cached source remains the same validated PNG data URL and has no blob, revocation, or CORS boundary; only the visual decode/draw owner changed."
    - "66febfa8 tests mocked draw calls/source text and never decoded pixels or mounted the async Preact canvas path."
  falsification_test: "If restoring the same declarative image owner still produces zero paint with the same cached data URLs, the owner-change diagnosis is false and the source PNG itself must be inspected from live runtime capture."
  fix_rationale: "Returning paint to the last known-good browser-owned image path removes the new failure mechanism instead of layering retries on it; separating paper keeps paper decode/geometry from gating paint visibility."
  blind_spots: "Automated DOM tests cannot execute the exact Tauri WebKit decoder; live UAT is still mandatory, and exact stopped/editor paper parity must be visually confirmed."
- known_good_boundary: "Before 66febfa8, cached animation paint was visible and correctly registered; only paper geometry was wrong. Preserve that paint path unless runtime evidence proves an equivalent replacement."
- failed_implementation_hypothesis: "66febfa8 project-space shared compositor is rejected by live UAT until its runtime decode/draw lifecycle is proven."
- reasoning_checkpoint:
  hypothesis: "Transparent cached Roto PNGs display wrong paper scale because playback bypasses the persisted-frame/editor PreviewRenderer compositor and delegates paper to CSS, creating a second non-authoritative background owner."
  confirming_evidence:
    - "Roto export forces bgMode transparent, proving cached/persisted PNGs are paint-only alpha at project dimensions."
    - "PreviewRenderer/export draw persisted rotoBackground paper first in project space at fixed 0.18 texture opacity, then draw the alpha PNG."
    - "Playback hides engine canvases and renders the alpha PNG over .paint-canvas CSS background, with no persisted background metadata or project-size compositor input."
  falsification_test: "If the current playback path already invokes the same project-space paper draw primitive with persisted metadata and 1600x900 backing dimensions before alpha, this hypothesis is false."
  fix_rationale: "Move playback composition onto the existing renderer-owned paper draw contract and remove CSS paper ownership during playback, preserving alpha frame geometry and one visual owner."
  blind_spots: "Automated canvas operation tests cannot prove browser texture decode is pixel-identical to live Tauri; live UAT remains required after gates."
- reasoning_checkpoint:
  hypothesis: "Playback paper is enlarged because commit 97571142 hides the engine dry canvas (normal paper renderer) and reveals a different CSS fallback using background-size: cover; paint remains fitted because the cached image overlay uses measured canvas bounds and object-fit: contain."
  confirming_evidence:
    - "The engine loads paper with loadPaperTexture(url, width, height, paperTextureScale), which repeats tiles from origin using intrinsic image dimensions times paperTextureScale."
    - "The active playback selector hides every .paint-canvas direct canvas child, including the dry canvas that contains normal paper and paint."
    - "The surviving .paint-canvas fallback is `center / cover`, exactly predicting one enlarged/cropped texture while shell and overlay geometry remain unchanged."
  falsification_test: "If a red contract shows the fallback already repeats at the engine tile scale, or live geometry uses different shell/overlay bounds rather than a renderer switch, this hypothesis is wrong."
  fix_rationale: "Keep the existing aspect-fitted .paint-canvas element as the playback paper surface, but make its background obey the same repeat, origin, and paperTextureScale contract as the engine instead of cover; this changes no state or playback lifecycle."
  blind_spots: "CSS background decoding/rasterization may differ subtly from canvas drawImage despite identical source size and scale; live Tauri UAT is required for pixel-level visual confirmation."
- reasoning_checkpoint:
  hypothesis: "Commit 520f2bfa causes missing paper by hiding .demo-canvas-shell, the common ancestor of both the .paint-canvas paper/background and editable engine canvases; natural cached playback completion causes post-Stop stacking because it sets isActive/isPlaying false without clearing frame, while the view mounts playback whenever frame remains non-null."
  confirming_evidence:
    - "The .paint-canvas CSS owns the paper background and is nested inside the hidden .demo-canvas-shell."
    - "The new view test fails because canvas-only suppression does not exist and the shell-wide visibility:hidden rule does."
    - "The lifecycle test fails with frame { id: 'last' } after isActive becomes false on the final non-loop tick."
  falsification_test: "If changing suppression to .paint-canvas > canvas still removes paper, or if clearing the transient frame before releasing playback does not make both manual/natural Stop tests immune to later timer advancement, the hypothesis is wrong."
  fix_rationale: "Keep the shared .paint-canvas element visible and hide only editable engine canvas children; use one finalization path that first invalidates future interval callbacks, then clears frame, then releases active/global playback so the view cannot render both owners."
  blind_spots: "The hook test uses fake interval timers and cannot observe browser paint between batched Preact state updates; live Tauri UAT remains required for visual ordering."

- reasoning_checkpoint:
  hypothesis: "The transient playback image composites with frame 1 because the view has no exclusive visual-owner state: it leaves the editable engine canvas/preview base/live alpha and cached reference visible while adding the playback image."
  confirming_evidence:
    - "Live UAT shows the frozen selected blue frame simultaneously with the advancing green playback frame."
    - "Studio always passes cachedRotoReferenceUrl and mounts PhysicsPaintCanvasMount while passing cachedRotoPlaybackUrl."
    - "CanvasStack renders all owners together, and CSS places the second engine canvas at z-index 4 above the z-index 3 overlay."
  falsification_test: "If a focused view contract already suppresses every editable/reference visual owner while playback is active, or if adding that suppression does not eliminate the red composition test, this hypothesis is wrong."
  fix_rationale: "Make playback-active select the transient cached image as the sole Roto visual owner while preserving the mounted engine/session state invisibly; Stop already clears frame/isActive, so the selected editable visual is revealed once without canonical state mutation."
  blind_spots: "DOM/source tests cannot inspect real engine pixel alpha composition; live Tauri UAT remains required after automated gates."

- reasoning_checkpoint:
  hypothesis: "Four extracted-boundary ownership/lifecycle errors caused the regressions: stale launch echoes could replace local selection, playback preview mutated editable selection, interpolation seek raced persistence, and callback churn disposed the async launch listener."
  confirming_evidence:
    - "Each targeted test failed before its corresponding correction and passes after it."
    - "The durable relaunch test observed zero listeners before the callback-ref fix and receives the real launch context afterward."
    - "Focused 236 tests, broad 469 tests, typecheck, build, and diff/debug checks pass."
  falsification_test: "Any original behavioral regression reproducing in the focused tests, durable relaunch test, or live UAT would disprove the complete correction."
  fix_rationale: "Each change restores the canonical owner or external lifecycle boundary rather than mirroring state: editable launch frame stays canonical, playback stays transient, persistence precedes dependent seek, and the bridge listener has stable installation with latest callback dispatch."
  blind_spots: "Automated DOM tests cannot verify the exact real Tauri parent echo multiplicity or visible utility freeze timing; live UAT remains required."
- reasoning_checkpoint:
  hypothesis: "Self-originated stale launch echoes, playback writes, and interpolation message ordering each mutate or overwrite canonical editable state from a transient/stale source."
  confirming_evidence:
    - "Playback onFrame directly writes launchContext.startFrame, which is Studio's canonical currentFrame and key-utility dependency."
    - "Interpolation controller dispatches frame sync before awaiting settings persistence."
    - "Incoming launch handling unconditionally resets Roto session state and replaces launchContext."
  falsification_test: "If removing playback writes, preserving one pending local selection across its stale launch echo, and persisting interpolation before seek do not make the exact behavioral tests pass, the ownership/order hypothesis is wrong."
  fix_rationale: "Keep launchContext.startFrame editable-only, make cached playback transient-only, and serialize interpolation persistence before dependent navigation so stale projections cannot win."
  blind_spots: "Live parent may emit more than one stale launch echo; automated tests cover the one-response bridge contract and live UAT must confirm the real event sequence."
- tdd_checkpoint:
  test_file: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts; app/src/components/physic-paint/hooks/useRotoCachedPlayback.test.ts"
  test_name: "delegates cached Roto playback state and timer ownership to the focused hook; clears the final transient frame before revealing editable state and ignores stale ticks after Stop"
  status: "green"
  failure_output: "RED reproduced independently: view contract expected canvas-only suppression but commit hid .demo-canvas-shell; lifecycle expected null transient frame after natural Stop but received { id: 'last' }. Both focused tests now pass after minimal production edits."

## Evidence

- timestamp: 2026-07-11T23:05:00Z
  checked: Live Tauri UAT after commits 91e8fdfc / d18da3a7
  found: Cached Roto paint animation still works, but Physics playback background is plain white with the paper texture completely absent. The shared renderer's synchronous white base reaches playback, while its asynchronous texture layer does not resolve, invalidate, or repaint there. Stopped Physics Paint and EFX Motion Editor continue to show correct paper.
  implication: The prior duplicate-renderer fix preserved paint and established the shared synchronous base, but automated tests did not exercise the mounted async Image lifecycle. Diagnose metadata, child-window asset URL/load behavior, failed retry state, and subscription cleanup before editing raster appearance.

- timestamp: 2026-07-11T23:08:00Z
  checked: Exact 91e8fdfc shared helper and mounted playback effect
  found: getProjectPaperCanvas registers every supplied callback in a global resolutionListeners Set and never removes it; it returns null while loading, permanently suppresses retries after any image error through failedTextures, and uses root-relative `/img/paper_N.jpg`. Physics playback clears its visible canvas on every render call and only draws when a shared paper canvas exists; cleanup merely sets a local cancelled flag and does not unsubscribe. PreviewRenderer and the child window have separate JavaScript globals/documents, so a texture loaded in the main window cannot populate the child window module cache.
  implication: The callback leak is definite, while causality for white-only output remains unconfirmed. Candidate B predicts child-window URL failure plus permanent suppression; candidate C predicts successful onload but missed/stale visible repaint. A mounted async RED seam is required to distinguish them.

- timestamp: 2026-07-11T23:15:00Z
  checked: Deterministic async lifecycle RED seam
  found: Exact command `pnpm --dir app exec vitest run src/lib/projectPaperRaster.test.ts` fails 1/2 at the new mounted-surface resource seam with `TypeError: subscribeProjectPaperCanvas is not a function`. The test requires immediate base-only visibility, a later textured canvas after fake Image.onload, and no stale repaint after metadata switch/unsubscribe.
  implication: The current API cannot express owned subscription cleanup and the prior pure raster parity test was insufficient. Production must expose one resource lifecycle that returns unsubscribe and drives the visible redraw, then the same command must turn GREEN.

- timestamp: 2026-07-11T23:18:00Z
  checked: Metadata and child-window URL hypothesis differentiation
  found: Physics playback composition passes `launchContext.rotoBackground` unchanged; PreviewRenderer reads the persisted store metadata derived from the same rotoBackground/editable-state contract. The authoritative texture selector for both is `background` (canvas1/canvas2/canvas3), while `paperGrain` is engine emboss metadata. Stopped Physics Paint in the same child window successfully loads the exact root-relative `/img/paper_N.jpg` URLs through EfxPaintCanvas, ruling out invalid child-window URL resolution for this live case. Main and child windows do have separate module/Image caches, so main-window preload cannot satisfy playback, but the child URL itself is proven valid.
  implication: Hypothesis A is contradicted by shared metadata ownership and correct stopped paper; hypothesis B is contradicted for the reported run by the same child window loading the same URLs. Hypothesis C is highest: the shared helper's unowned global callback lifecycle is the remaining divergence. D and E remain downstream checks after textured pixels are proven.

- timestamp: 2026-07-11T23:35:00Z
  checked: Async lifecycle GREEN and full automated gates
  found: `subscribeProjectPaperCanvas` now returns unsubscribe, emits null/base immediately, emits the exact shared textured project canvas on Image.onload, scopes listeners by texture, removes them on cleanup, and does not permanently blacklist an early error. Physics playback returns unsubscribe from its resource effect and redraws the full backing canvas; PreviewRenderer preloads/disposes through the same resource. The exact RED command now passes 2/2. Focused suite passes 109/109; Physics Paint passes 335/335 across 34 files; PreviewRenderer/roto paper suite passes 15/15; typecheck and build pass (1086 modules); diff check and lifecycle/debug scan are clean.
  implication: Hypothesis C is confirmed at the deterministic lifecycle seam. Metadata and URL candidates are ruled out for the reported run; layering and scale are contradicted because the test proves the resolved shared raster reaches the visible draw callback and production dimensions are unchanged. Live Tauri UAT is the remaining acceptance gate.

- timestamp: 2026-07-11T22:00:00Z
  checked: Required deterministic production-path paper pixel differential before production edits
  found: Exact RED command `pnpm --dir app exec vitest run src/lib/projectPaperRaster.test.ts` failed 1/1 because PreviewRenderer had no shared projectPaperRaster import. The fixture models a 2-pixel repeating texture, white base, authoritative 0.18 texture alpha, representative repeat points, 6x3 dimensions, and a registered 50% alpha paint pixel; the pre-fix Physics owner was independently loading `/img/paper_N.jpg`, calling `drawMissingRotoBackground`, and retained a raw CSS paper fallback.
  implication: The feedback loop was red-capable on the reported dark/full-strength paper and identified duplicate paper ownership before production changes.

- timestamp: 2026-07-11T22:05:00Z
  checked: Line-level divergence and ranked falsifiable hypotheses
  found: Hypothesis 1 confirmed. PreviewRenderer lines 673-703 created/cached a project-sized white + repeating texture canvas at alpha 0.18. PhysicsPaintStudioView lines 28-54 separately created an Image, derived `/img/paper_${background.slice(-1)}.jpg`, and invoked `drawMissingRotoBackground`; CSS also directly exposed `/img/paper_1.jpg`. Hypotheses 2-4 were contradicted because fresh deterministic samples diverged before paint, dimensions/registration matched, and the divergence existed in backing raster ownership rather than cache staleness or display geometry.
  implication: Dark full-strength paper came from bypassing the authoritative cached project-paper raster and allowing a second raw texture owner/fallback, not from animation progression or paint alpha.

- timestamp: 2026-07-11T22:20:00Z
  checked: Shared-helper GREEN and full automated gates
  found: `app/src/lib/projectPaperRaster.ts` now solely owns texture URLs, loading, white base fill, source-over composite reset, 0.18 repeated texture raster, project-size cache, resolution notification, and cache clear. PreviewRenderer and Physics playback both call `getProjectPaperCanvas`; playback only copies that exact cached canvas beneath the unchanged declarative cached-frame `<img>`. The same focused command passes 1/1; focused paper/playback suite passes 108/108; Physics Paint matrix passes 335/335 across 34 files; preview/export/paper suite passes 26 with 19 existing todos; typecheck, production build (1086 modules), and git diff --check pass. Dead-path scan finds no production drawMissingRotoBackground playback call, raw playback paper URL, CSS texture fallback, debug logs, or debugger statements.
  implication: Editor and Physics playback paper pixels now originate from one production implementation while established playback/Stop/exclusive-owner behavior remains covered and unchanged.

- timestamp: 2026-07-11T21:08:00Z
  checked: Exact PreviewRenderer and e718c1d3 Physics playback paper paths before hypothesis formation
  found: PreviewRenderer builds and caches a project-sized paper canvas in `getProjectPaperCanvas`: white fill, texture pattern at `globalAlpha = 0.18`, then alpha paint via `drawRotoFrameComposite`. Physics playback independently creates a canvas and calls `drawMissingRotoBackground` with a raw Image; that helper currently also intends white + 0.18, but it bypasses PreviewRenderer's project-paper-canvas owner/cache and has no pixel-level test. Existing tests only record calls or inspect source. The real paper fixture is 420x525 JPEG and ImageMagick is available for deterministic fixture decode.
  implication: A real-pixel differential can be built without running the server by decoding the actual fixture into a deterministic software canvas and invoking both production paths. No production cause is confirmed until that loop goes RED.

- timestamp: 2026-07-11T20:30:00Z
  checked: Focused forward recovery implementation and tests
  found: Physics Paint playback paint is again rendered by the exact declarative `<img src={frame.dataUrl}>` owner that was live-proven before 66febfa8. Paper is a separate project-sized background canvas beneath it, so paper decode can no longer gate or cancel paint visibility. The background effect depends on semantic metadata fields rather than the freshly allocated wrapper object. Focused playback/composition/Stop tests pass 104/104.
  implication: Failed 66febfa8 paint-compositor wiring has been replaced rather than layered with retries. Paint and paper now have distinct runtime owners: cached PNG image for paint, persisted metadata project-space canvas for paper.

- timestamp: 2026-07-11T20:22:00Z
  checked: Cached frame production, alpha registry, and pre-66febfa8 visual owner
  found: Cached Roto frames are validated PNG data URLs with optional intrinsic width/height; save/export produces transparent alpha canvases and registers their live canvases for interpolation. The pre-66febfa8 playback path bound the exact `frame.dataUrl` declaratively to an `<img>`, which live UAT proved visible. No blob URL creation, revocation, or cross-origin URL participates in this path. Paper metadata is separate and belongs outside the cached PNG. 66febfa8 retained the same data URL but moved its decode/draw into an imperative effect.
  implication: Source format, alpha ownership, blob revocation, and cross-origin hypotheses are eliminated for the disappearing paint. The regression is caused by replacing the browser-owned declarative image surface with the new imperative async canvas path. Safest recovery is to restore the proven image owner for paint while assigning paper to a separate precise canvas/background owner, rather than stacking more decode logic into the failed compositor.

- timestamp: 2026-07-11T20:15:00Z
  checked: Concrete composition metadata wiring and current playback lifecycle
  found: Studio supplies paint from `rotoCachedPlayback.frame?.dataUrl`, project dimensions from `launchContext.width/height`, and background from `launchContext.rotoBackground`. Working engine dimensions are separately aspect-fitted by `getPhysicsPaintWorkingSize`, with `paperTextureScale = workingWidth / projectWidth`. The async playback effect is recreated on every `dataUrl`, background object identity, width, or height change; cleanup only flips a local boolean and does not abort decode. Existing playback state clears timer/frame before releasing active state, but the compositor itself has no generation token proving an older image cannot draw into a reused canvas after a newer frame mounts.
  implication: Dimension domains are intentionally distinct, but paint visibility now depends on an untested async decode/effect path. Race safety must be proven at the mounted surface, not inferred from playback timer teardown.

- timestamp: 2026-07-11T20:12:00Z
  checked: Exact 66febfa8 runtime diff and its new tests
  found: 66febfa8 replaced the proven `<img src={cachedRotoPlaybackUrl}>` playback owner with `PhysicsPaintRotoPlaybackCanvas`, which creates fresh paint/paper `Image` objects in a Preact effect and paints only after both report `complete`. The new compositor unit test uses plain object draw sources and records mocked operation order; PreviewRenderer tests assert source text; no test mounts the async canvas path, decodes a PNG, advances frames, reads pixels, or exercises cleanup races.
  implication: Prior green gates could not detect a decoded-pixel failure in the new production path. The regression boundary is exactly the newly introduced async canvas component, while the pre-66febfa8 image playback path is the last known paint-visible owner.

- timestamp: 2026-07-11T20:05:00Z
  checked: Live Tauri UAT after commit 66febfa8
  found: Playback displays a full fitted canvas containing only an incorrectly scaled/coarse gray paper texture. No cached Roto paint or animation pixels are visible at any playback frame. The user identifies this as a major regression. Before 66febfa8, cached animation paint was visible, correctly registered, advanced, and stopped correctly; only paper scale was wrong.
  implication: The shared-compositor implementation hypothesis in 66febfa8 failed in the real runtime. Because paper renders while paint does not, the failure boundary is likely between cached alpha-frame source/decode and the compositor's paint draw/invalidation lifecycle, not playback activation or shell visibility. Production changes from 66febfa8 must be replaced or cleanly forward-reverted unless proven correct by decoded-pixel and race tests.

- timestamp: 2026-07-11T18:08:00Z
  checked: Live UAT after commit 97571142 and current playback suppression CSS
  found: Playback and teardown now work, and cached orange paint remains approximately fitted, but the paper becomes coarse/cropped. The active selector hides every direct canvas child of .paint-canvas, while the surviving .paint-canvas element uses the raw CSS fallback `background: url('/img/paper_1.jpg') center / cover, #fff`. Normal rendering also passes paperTextureScale into the engine, indicating at least one hidden canvas owns the intended scaled paper rendering.
  implication: The new symptom is predicted by exposing the fallback `cover` background after hiding all engine canvases. The paper that looks correct stopped is likely canvas-rendered, not the CSS fallback; identify which canvas owns paper versus editable paint before changing suppression.


- timestamp: 2026-07-11T11:12:00Z
  checked: Manual timeline click/navigation trace
  found: PhysicsPaintWorkflowStrip cell/transport events call requestRotoFrameNavigation through useRotoNavigationCoordinator.requestNavigation. The Roto session updates only its short-lived session.currentFrame, then the configured display port useRotoPersistenceIntegration.openFrame updates launchContext.startFrame, loads/clears the engine, and sends physic-paint:seek-frame. Studio derives currentFrame and all workflow projections exclusively from launchContext.startFrame. Any incoming launch context is passed through usePhysicsPaintLaunchIntegration, which resets persistence/navigation sessions and replaces launch state.
  implication: launchContext.startFrame is the canonical editable selected frame; the session currentFrame is transactional only. A stale parent launch echo after frame sync can overwrite the local selection and reset the session.

- timestamp: 2026-07-11T11:14:00Z
  checked: Playback trace
  found: useRotoCachedPlayback owns transient playback frame/image, but PhysicsPaintStudio playback.onFrame also calls setLaunchContext(...startFrame: appFrame). Because currentFrame is derived from launchContext.startFrame, every playback tick rebuilds the Roto session and workflow/key-utility projection around the preview frame.
  implication: playback preview incorrectly mutates the canonical editable selection. The transient owner must remain useRotoCachedPlayback; launchContext.startFrame and utility dependencies must remain frozen, with utility actions disabled while playback is active.

- timestamp: 2026-07-11T11:16:00Z
  checked: Interpolation toggle trace
  found: The checkbox calls useRotoInterpolationController, which mutates physicPaintStore settings through useRotoTimelineActions, refreshes generated projection, and updates launchContext.rotoInterpolationSettings. When disabling from a generated display frame, transaction.nextCurrentFrame differs and the controller immediately sends frame sync before the interpolation apply payload is acknowledged. Incoming launch contexts hydrate their persisted interpolation settings back into the canonical store and reset the Roto session.
  implication: physicPaintStore is the canonical interpolation owner, but stale launch hydration can overwrite the just-disabled value because frame synchronization races persistence. The action must persist settings before frame synchronization and stale launch echoes must not re-enable local canonical state.

- timestamp: 2026-07-11T11:18:00Z
  checked: Existing uncommitted ToolRail correction
  found: PhysicsPaintToolRail.tsx changes all physics-paint icon imports from ../../assets to the correct ../../../assets path after the view-module move.
  implication: Preserve and include this independent refactor correction in the authorized atomic commit.

- timestamp: 2026-07-11T14:19:00Z
  checked: Red/green regression ownership tests
  found: The three new tests failed before production edits on missing pending frame-sync ownership, playback mutating launchContext, and interpolation seek preceding awaited persistence; all 94 PhysicsPaintStudio contract tests pass after the minimal corrections.
  implication: The ownership/order hypotheses are directly reproduced and corrected at the extracted module boundaries without restoring Studio ownership or adding Roto effects.

- timestamp: 2026-07-11T15:02:00Z
  checked: Remaining durable-core relaunch sequence
  found: The failing test never performs frame navigation before emitting reopenContext; it starts and saves frame 8, persists/reloads the store, then attempts a genuine frame-8 launch. Therefore pendingFrameSyncRef is never populated in this scenario.
  implication: The bare pending marker is not the cause of this failure.

- timestamp: 2026-07-11T15:14:00Z
  checked: Tagged launch/reset observability in the single durable-core test
  found: paintHarness.launchListeners is zero when reopenContext is emitted, and resetRotoSessionForLaunch/resetForLaunch never execute. The test remains on the original editable session, which correctly labels frame 8 Current.
  implication: The relaunch event is being missed before it reaches launch integration.

- timestamp: 2026-07-11T15:25:00Z
  checked: usePhysicsPaintLaunchBridge listener lifecycle against Studio render churn
  found: The effect depends on applyIncomingLaunchContext, whose identity changes with extracted hook input objects. Each render disposes an in-flight async listener installation; when listen resolves, the disposed branch immediately unlistens it. The durable test's zero-listener observation directly matches this mechanism.
  implication: The production bridge listener must be installed independently of callback identity and dispatch through a ref to the latest launch handler.

- timestamp: 2026-07-11T15:31:00Z
  checked: Durable cached-only relaunch after stable listener correction
  found: The unchanged integration test now receives reopenContext, resets the editable session, loads the saved PNG through the preview-base path, clears stale strokes, and passes both durable-core tests.
  implication: Stable external listener ownership fixes the relaunch/reset regression and validates the exact production mechanism.

- timestamp: 2026-07-11T16:05:00Z
  checked: Live Tauri UAT after the first automated-ready checkpoint
  found: Manual navigation, interpolation disable, utility freeze, playback advancement, and tool stability now work. During cached Roto playback, however, the originally selected first-frame blue drawing remains visibly rendered while a green playback frame animates over it, producing additive frame-1-plus-playback composition.
  implication: Canonical editable state freezing is correct, but visual ownership during playback remains wrong. The transient playback frame must visually replace/suppress editable Roto canvas/reference output while playing, and Stop must reveal the selected editable frame once without changing canonical selection.

- timestamp: 2026-07-11T16:18:00Z
  checked: Studio-to-view render ownership and canvas stack CSS
  found: Studio passes rotoCachedPlayback.frame.dataUrl as cachedRotoPlaybackUrl while always passing cachedRotoReferenceUrl and always mounting PhysicsPaintCanvasMount. PhysicsPaintCanvasStack renders the engine canvas first, then the cached reference, Play preview, cached Roto playback image, and onion children together inside one overlay. No prop or class represents exclusive Roto playback composition. CSS places engine canvases at z-index 2/4 and the overlay at z-index 3; cached playback has no distinct z-index, while cached reference is z-index 1 within the overlay.
  implication: The live screenshot is predicted directly by the render tree: playback adds an image but does not hide the editable engine canvas or reference layers, and the upper engine canvas can remain above the playback overlay. The defect is visual-owner selection at the extracted Studio/View boundary, not playback frame advancement or canonical selection state.

- timestamp: 2026-07-11T16:42:00Z
  checked: Red behavioral render-ownership contract
  found: The focused command `pnpm --dir app exec vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts -t "delegates cached Roto playback state"` fails 1/1 because Studio provides no cachedRotoPlaybackActive visual-owner state. The test also requires reference suppression, a dedicated playback image class, and hiding the mounted editable shell while active.
  implication: The regression has a deterministic sub-second red-capable test at the actual Studio/View composition seam before production edits.

- timestamp: 2026-07-11T16:43:00Z
  checked: Minimal exclusive visual-owner fix against focused regression
  found: Studio now passes rotoCachedPlayback.isActive to the view; CanvasStack keeps the engine mounted but hides its shell while active, suppresses cached reference/Play preview/onion children, and renders the transient cached Roto frame with a dedicated top-layer class. The same focused command passes 1/1. Stop already clears frame and isActive synchronously through the playback hook, so the unchanged selected engine/reference visual is revealed without launchContext mutation or reload.
  implication: The fix addresses only rendering ownership, preserves Preact controller state and Stop semantics, and does not restore ownership to Studio or add effects.

- timestamp: 2026-07-11T17:05:00Z
  checked: Second live Tauri UAT after commit 520f2bfa
  found: Cached Roto playback now suppresses the selected editable paint, but playback also loses the normal paper/background. On Stop, the last cached playback frame remains visibly stacked over the original selected editable frame.
  implication: Exclusive ownership is suppressing a shared background layer too broadly, and Stop ordering/lifecycle permits both transient playback and editable owners to be visible after playback ends. Diagnose paper ownership and timer/frame cleanup before editing.

- timestamp: 2026-07-11T17:12:00Z
  checked: Paper/background DOM ownership after commit 520f2bfa
  found: PhysicsPaintCanvasMount renders .demo-canvas-shell containing EfxPaintCanvas.paint-canvas. The .paint-canvas element owns the fallback paper texture/background, while its canvas children own engine paint/reference/live pixels. Commit 520f2bfa applies visibility:hidden to the entire .demo-canvas-shell during cached playback.
  implication: The missing paper is directly caused by hiding the common ancestor. Playback must keep the shell/.paint-canvas visible and suppress only the engine canvas children plus external cached reference, Play preview, and onion overlays.

- timestamp: 2026-07-11T17:14:00Z
  checked: Cached playback Stop and natural-completion lifecycle
  found: Manual stop clears the interval, then queues setIsActive(false), setFrame(null), and setIsPlaying(false). Natural non-loop completion clears the interval and sets activity/global playing false but never clears frame. The view renders the transient image whenever frame is non-null, independently of cachedRotoPlaybackActive.
  implication: Natural completion persistently reveals editable content while retaining the last transient image, exactly producing both owners stacked. Manual Stop also lacks an explicit single lifecycle transition contract and can expose render batching/order ambiguity. The transient frame must be cleared before playback activity/global playing are released, and timer callbacks must be invalidated before any reveal.

- timestamp: 2026-07-11T17:20:00Z
  checked: Red-to-green paper ownership and Stop lifecycle regressions
  found: The paper test failed 1/1 against shell-wide hiding and passes 1/1 after targeting only .paint-canvas > canvas. The Stop test failed 1/1 with the final frame still non-null and passes 1/1 after routing manual Stop, reset, and natural completion through cancellation → frame clear → activity/global playing release.
  implication: Both live-UAT failures are reproduced at their owning boundaries and corrected without changing canonical selection, utilities, Studio ownership, or adding effects.

- timestamp: 2026-07-11T17:28:00Z
  checked: Automated validation after the second live-UAT corrections
  found: Focused playback/view/Stop matrix passes 149/149; broader Physics Paint matrix passes 335/335 across 34 files; app typecheck passes; app production build passes (1086 modules); git diff --check passes. Instrumentation scan found only established dev-export DEBUG identifiers and generated-frame status constants, with no temporary console/debugger instrumentation.
  implication: The minimal view/controller changes are automated-ready for another live Tauri UAT checkpoint.

- timestamp: 2026-07-11T18:20:00Z
  checked: Red-green playback paper geometry contract
  found: The focused playback view test failed 1/1 against the fallback `center / cover` background and missing scale ownership. After passing the existing paperTextureScale through a CSS custom property and changing the retained .paint-canvas background to repeat from origin at 512px times that scale, the same test passes 1/1 while the canvas-child suppression and exclusive playback overlay remain unchanged.
  implication: Root cause is confirmed as a renderer/style-contract switch, not shell aspect-fit, overlay bounds, DPR, transform, or teardown state. The correction is limited to the extracted canvas mount and CSS view layer.

- timestamp: 2026-07-11T18:30:00Z
  checked: Automated validation for playback paper geometry correction
  found: Focused playback/view/teardown suite passes 149/149; Physics Paint component matrix passes 335/335 across 34 files; app typecheck passes; app build passes with 1086 modules; git diff --check passes; instrumentation scan reports no temporary console/debugger markers. A combined command including the durable-core DOM test completed all 337 assertions but exited on its known post-test `window is not defined` bridge timer harness error, so the clean component matrix is the authoritative broader gate for this CSS/view-only change.
  implication: The minimal paper-rendering correction is automated-ready for live Tauri visual UAT; teardown and exclusive playback ownership tests remain green.

- timestamp: 2026-07-11T19:35:00Z
  checked: Red-green authoritative Roto frame composition and automated gates
  found: The new project-space compositor test failed 1/1 because no shared frame compositor existed. A minimal drawRotoFrameComposite primitive now owns paper-before-alpha composition and is used by both PreviewRenderer (therefore editor preview/export) and Physics Paint cached playback. Playback uses a project-sized canvas backing store from launch width/height plus persisted rotoBackground metadata, while retaining exclusive transient ownership and existing Stop/natural-completion teardown. The Physics Paint matrix passes 335/335 across 34 files; editor compositor/export tests pass 25 with 19 existing todos; focused contract/playback tests pass 112/112; typecheck, production build (1086 modules), git diff --check, and instrumentation scan pass.
  implication: Cached playback now follows the persisted frame contract rather than CSS paper emulation. Implementation committed as 66febfa8. Live Tauri UAT is still required before Debug 01 acceptance.

- timestamp: 2026-07-11T19:18:00Z
  checked: Persisted frame, editor preview/export, stopped engine, and cached playback rendering contracts
  found: Roto save explicitly switches the engine to transparent and exports only dry+wet paint alpha at project dimensions; persisted PNGs therefore do not own paper. EFX Motion Editor PreviewRenderer is the authoritative compositor: for every real/generated Roto frame it creates project-sized paper output from persisted rotoBackground metadata, draws white plus the selected intrinsic paper texture at 0.18 opacity, then draws the transparent cached PNG over it into the logical project frame. Export delegates through the same PreviewRenderer. Stopped Physics Paint instead shows the engine dry canvas, whose working size is aspect-preserving and whose paper texture is scaled by workingWidth/projectWidth so its intrinsic texture maps to project-space geometry. Cached playback currently bypasses both contracts by hiding engine canvases and placing the transparent PNG over a CSS-owned paper surface.
  implication: The alpha PNG and persisted metadata are behaving as designed. The mismatch is duplicate background ownership: CSS cannot guarantee parity with the project-sized PreviewRenderer compositor (including texture opacity/rasterization/project-space dimensions), while stopped engine parity depends on its own canvas texture transform. Cached playback must compose the transparent frame through a shared authoritative project-space paper+alpha rendering path, not style the mount background.

- timestamp: 2026-07-11T19:00:00Z
  checked: Live Tauri UAT after commit 27efa329
  found: The stopped/editable EFX Paint frame retains correct paper/background geometry and texture, but cached Roto playback still renders paper at the wrong scale despite the CSS fallback reproducing a 512px tile size and paperTextureScale.
  implication: The CSS renderer-equivalence hypothesis is falsified. The defect must be investigated as a source/compositing contract mismatch: cached playback must reuse the authoritative persisted EFX Paint / EFX Motion Editor frame rendering source or compositor rather than approximate engine paper in CSS.

## Eliminated

- hypothesis: The shared project-space compositor introduced by 66febfa8 is an automated-verified correction suitable for live playback.
  evidence: Live Tauri UAT shows its playback surface contains only coarse paper and zero cached paint, whereas the immediately preceding state displayed and advanced paint correctly. Prior mocked operation/contract tests did not verify decoded frame pixels on the mounted surface.
  timestamp: 2026-07-11T20:05:00Z

- hypothesis: A stale pendingFrameSyncRef survives navigation and overwrites the later durable-core reopen launch.
  evidence: The failing durable-core scenario performs no openFrame/navigation call before the genuine reopen launch, so the only writer of pendingFrameSyncRef is never reached.
  timestamp: 2026-07-11T15:02:00Z

## Resolution

- root_cause: TypeScript correctly included persisted `rotoBackground` metadata in `PhysicPaintLaunchContext`, but Tauri's Rust `PhysicsPaintLaunchContext` omitted the field. Serde silently ignored the unknown incoming property when `open_physics_paint_window` deserialized the command payload. Rust then stored, returned, and emitted a launch context with no `rotoBackground`. Physics Paint cached playback consequently did not mount its paper composition and rendered the transparent cached animation over the white canvas shell. The earlier browser renderer and callback fixes could not solve a field that never reached the child window.
- fix: Added `#[serde(rename = "rotoBackground", skip_serializing_if = "Option::is_none")] roto_background: Option<Value>` to the native launch contract. No paper-renderer values, asset URLs, playback timing, or visual ownership were changed in this correction.
- verification: Exact native RED command `cargo test --manifest-path app/src-tauri/Cargo.toml preserves_roto_background_round_trip -- --nocapture` failed with `left: None` and the full expected metadata object on the right. The same command passes after the field addition. Full native suite passes 14/14. Focused playback/paper tests pass 101/101. Physics Paint component matrix passes 335/335 across 34 files. `pnpm --dir app typecheck` and `pnpm --dir app build` pass; build transforms 1086 modules. `git diff --check` passes. `cargo fmt --check` reports unrelated pre-existing formatting drift across multiple Rust files, so no broad formatting changes were applied. Live Tauri UAT passed after a native rebuild/relaunch: the user confirmed the playback animation and paper background now work. Debug 01 is accepted.
- files_changed:
  - app/src-tauri/src/lib.rs
