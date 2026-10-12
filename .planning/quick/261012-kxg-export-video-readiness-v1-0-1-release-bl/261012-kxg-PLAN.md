---
phase: quick-261012-kxg
plan: 261012-kxg
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/lib/previewRenderer.ts
  - app/src/lib/exportRenderer.ts
  - app/src/lib/exportEngine.ts
  - app/src/components/export/ExportPreview.tsx
  - app/src/lib/previewRenderer.videoReadiness.test.ts
  - app/src/lib/exportEngine.test.ts
  - app/src/lib/exportRenderer.test.ts
  - .planning/REQUIREMENTS.md
autonomous: true
requirements: [VID-04]

estimate:
  tokens: 30000
  raw_tokens: 15000
  tasks: 2
  confidence: low

must_haves:
  truths:
    - "An H.264 export of a project with a ready video track produces frames containing the video's pixels — the 'Loading <name>...' box never appears in any exported frame (VID-04)."
    - "Before the export frame loop draws its first frame, every video layer in the exported sequences has an HTMLVideoElement at readyState >= 2, or the export has already stopped with exportStore error status naming that clip (initial readiness, mirroring preloadExportImages)."
    - "Every captured frame — and every motion-blur sub-frame — is drawn only after the video element's 'seeked' event for that frame's target time, so start/middle/end output frames match the timeline instead of a stale pre-seek image."
    - "A video whose source file is missing, renamed, or undecodable stops the export with an errorMessage naming the clip (fail-closed, the same law as SND-02); no placeholder pixels are written to disk."
    - "The export-dialog preview canvas shows the video content at the sample frame instead of the placeholder — its separate render path is closed with the same preload+settle seam."
    - "Cancel during video preload or an in-flight settle settles as status 'cancelled' (never a timeout error), and every video wait is bounded (30s readiness / 5s seek) so a hung file can never stall the export forever."
    - "The live editor preview path stays behavior-untouched: the loadeddata/seeked re-render listeners and readyState check in resolveVideoSource, video asset resolution (mainAppVideoSources / registerPickedVideoSource / readMceVideoLayerPath), and the image logic inside preloadExportImages all keep their current behavior."
  artifacts:
    - app/src/lib/previewRenderer.ts
    - app/src/lib/exportRenderer.ts
    - app/src/lib/exportEngine.ts
    - app/src/components/export/ExportPreview.tsx
    - app/src/lib/previewRenderer.videoReadiness.test.ts
    - app/src/lib/exportEngine.test.ts
    - app/src/lib/exportRenderer.test.ts
    - .planning/REQUIREMENTS.md
  key_links:
    - "previewRenderer.preloadVideos enumerates the SAME sequences exportEngine feeds renderGlobalFrame — the readiness gate covers exactly the draw set (content, content-overlay, and fx sequences alike)."
    - "settleVideoSeeks' didWait result gates a second renderGlobalFrame pass: pass 1 lets the draw itself compute and register every seek target (single source of truth — the local-frame/fps math at exportRenderer.ts:185/:214/:271/:291/:315/:329/:367 is never duplicated), settle awaits those seeks, pass 2 captures — a provisional pass-1 placeholder or stale frame is never the captured image."
    - "cloneForCanvas shares videoElements/videoReadyHandlers/videoLayerNames alongside the existing shared imageCache, so GL-transition clone draws (exportRenderer.ts:213/:220) seek the SAME elements the main renderer settles — the placeholder cannot survive the transition offscreens."
    - "One AbortController spans image preload + video preload + the whole frame loop with the existing 200ms isCancelled poll, cleared by the outer finally on every exit path — mid-wait cancel is observable inside every video wait, and the aborted-vs-failed distinction routes to 'cancelled' vs the named 'error'."
---

<objective>
Close the two export video-readiness gaps so an exported frame can never bake the "Loading <name>..." placeholder: initial readiness (each video layer's element reaches readyState >= 2 before the frame loop draws) and per-frame seek completion (await the 'seeked' event after setting currentTime — including every motion-blur sub-frame) — or the export stops fail-closed with an error naming the clip (VID-04).

Purpose: live code measured on the signed 1.0.1 build — exportEngine.ts:214 creates a fresh PreviewRenderer per export (empty videoElements map, element created lazily at first draw with readyState = 0), preloadExportImages (exportRenderer.ts:472) waits for IMAGES ONLY, and previewRenderer.ts:794-801 sets currentTime and returns the element without awaiting 'seeked'. Every exported frame of a video layer therefore draws the placeholder (previewRenderer.ts:583-598) or a pre-seek stale image. The export-dialog preview (ExportPreview.tsx:57-59) is a separate render path with the same hole.
Output: a PreviewRenderer preloadVideos + settleVideoSeeks seam, an async motion-blur path that settles per sub-frame, exportEngine wiring (preload + two-pass capture + bounded cancel), the dialog preview closed on the same seam, headless regression legs, and VID-04 added to REQUIREMENTS.md.

Scope: v1.0.1 Quick 4, release blocker only. Stop after this quick for native UAT (the Release phase then RE-RUNS from Apple sign/notarize; the 1.0.1 bump stays, no second bump). No backward-compat code, no new packages, no test-config changes, no Rust, no schema change.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@CLAUDE.md
@.claude/skills/efx-async-orchestration/SKILL.md
@.claude/skills/efx-preact-reactivity/SKILL.md

ACCEPTANCE (REQUIREMENTS.md — add during Task 2):
- VID-04: Exported frames never bake the video loading placeholder; video layers await loadeddata and seeked, or the export stops naming the clip.

FIX CONTRACT (from the quick brief, verified live 2026-10-12):
- Gap 1 (initial readiness): exportEngine.ts:214 `new PreviewRenderer(canvas)` starts with an empty videoElements map; preloadExportImages (exportRenderer.ts:472) preloads images/paper/physics frames only — no video equivalent; the frame loop (:243) starts immediately, so pass 1 of every video layer hits previewRenderer.ts:583-598 and draws `Loading ${layer.name}...`.
- Gap 2 (seek completion): previewRenderer.ts:794-796 sets video.currentTime and :799 returns the element at readyState >= 2 WITHOUT awaiting the 'seeked' event — an exported frame can be the pre-seek image even after load. renderFrameWithMotionBlur (exportRenderer.ts:408) calls renderGlobalFrame once per sub-frame (:442), multiplying the hole.
- Fail-closed law (SND-02 sibling): if a video cannot become ready (missing file, decode failure, timeout), the export STOPS with an error naming the clip via the existing exportStore error status (outer catch exportEngine.ts:518-524 → progress.errorMessage rendered by ExportProgress). The "Loading..." box must never appear in a delivered frame.
- Dialog preview: ExportPreview.tsx:57-59 runs preloadExportImages().then(renderGlobalFrame) on its own PreviewRenderer and never re-renders when the video becomes ready — same hole, separate path.

GUARDRAILS (locked):
- Do NOT touch the live preview path: the loadeddata/seeked listeners at previewRenderer.ts:784-788 and the readyState gate at :799 keep byte-identical behavior (the editor is the proof). resolveVideoSource gains at most ONE additive line (layer-name registration, see Task 1).
- Do NOT touch video asset resolution or the never-copy disk-reference law: mainAppVideoSources.ts, registerPickedVideoSource, readMceVideoLayerPath, imageStore.videoAssets shape — untouched (Quick 2 is not the cause).
- Do NOT weaken preloadExportImages for images — its signature, timeout, fail-open semantics, and image/paper/physics logic stay byte-unchanged.
- Do NOT delete the placeholder draw branch (previewRenderer.ts:583-599) — the live preview still needs it while loading; export correctness comes from the gates, not from removing the branch.
- Cancel/abort must work mid-wait: every video wait takes the export AbortSignal and rejects 'Export cancelled'; exportStore.isCancelled() polls drive the signal (existing 200ms pattern).
- Fix-before-tests (project law): this is a live export behavior — implement Task 1 first, then pin it headlessly in Task 2; native UAT is the gate (no claim of done before the user's 4 rows pass). Unit tests below must not substitute for UAT.
- TDD mode is on but the fix-before-tests carve-out applies (live UI bug). vitest run only, NEVER watch (CLAUDE.md). Tests collect only `src/**/*.test.ts` — never author a `.test.tsx`. No test-config hacks (vitest.config.ts untouched). pnpm, not npm. No dev server; no Chrome DevTools MCP (native UAT stays with the user).
- PATH FORM: every path in this body is repo-root-relative; every command assumes cwd at the checkout root. gsd_run lives at .claude/gsd-core/bin/gsd_run (NOT on PATH).

DESIGN (the two-gap architecture — read before coding):
- Two laws, one seam. (1) INITIAL READINESS: `preloadVideos(sequences, signal)` runs where preloadExportImages runs, before the loop — enumerates visible video layers of every sequence, creates their elements through the existing resolveVideoSource, and awaits readyState >= 2 per element. (2) SEEK COMPLETION: the draw computes seek targets (its own local-frame/fps math — never duplicated), so the export uses render → settle → re-render: `renderGlobalFrame` pass 1 registers every seek via the untouched resolveVideoSource; `settleVideoSeeks(signal)` awaits loadeddata/seeked on every not-ready/seeking element and returns didWait; if didWait, a second `renderGlobalFrame` pass draws the settled frames and THAT image is captured. Pass-1 placeholder/stale pixels are never captured. A provisional double render happens only when a wait actually occurred — video-less exports call settle on an empty map, get false, and render exactly once (existing test call-counts stay valid).
- Bounded, cancellable waits. One private `awaitVideoSettled(layerId, video, phase, signal)` helper: listeners attached first ({once:true}), state re-checked, then Promise racing listeners vs a timeout vs signal abort; finally removes listeners and clears the timer (no listener leaks). Constants `VIDEO_READY_TIMEOUT_MS = 30_000` (mirrors the image preload's 30s) and `VIDEO_SEEK_TIMEOUT_MS = 5_000` exported from previewRenderer.ts for tests. On 'error' event, video.error present, or timeout → throw Error with copy `Export blocked — video "${name}" ...` (must contain the layer name — tests assert toContain(name) only). On abort → throw Error('Export cancelled').
- Fail-closed coverage: missing videoAsset row (resolveVideoSource returns before registering the element) → preloadVideos throws naming the clip; load error/timeout → same; mid-loop seek error/timeout → propagates to the outer catch → status 'error' naming the clip; abort → the loop's inner catch routes to status 'cancelled' with resumeFromFrame.
- Clone sharing: cloneForCanvas currently shares ONLY imageCache (:175-177), so GL-transition clones create their OWN video elements at readyState 0 each frame — a placeholder hole inside cross-dissolve offscreens. Share the three video maps the same way the image cache is shared (verified: cloneForCanvas is called only at exportRenderer.ts:213/:220, and clones are never disposed — the only dispose() callers are Preview.tsx:142 and ExportPreview.tsx:62, each disposing its own main renderer).
- Async orchestration verdict (efx-async-orchestration §1): these are one-shot bounded event waits, not a persistent lifecycle — no XState/Effect adoption; named problem answered = bounded cancellation with a settle-through cancel (§6: the frame loop settles into status 'cancelled', never strands). Failures are data (§5): aborted → 'cancelled', broken video → named 'error', never an unhandled rejection.
- Preact verdict (efx-preact-reactivity): ExportPreview gains NO new state, NO signal writes, no useState — one async chain inside the existing useEffect, cleanup aborts a local controller. Deps array unchanged.

LANDMARKS (verified live against the tree, 2026-10-12):
- app/src/lib/previewRenderer.ts — videoElements :147, videoReadyHandlers :148, constructor :156-169 (imageCache shared via 2nd param), cloneForCanvas :175-177, placeholder draw :583-599, resolveVideoSource :764-802 (creation block :772-789: asset lookup :778, src :780, set map :781, listeners :784-788; currentTime math :792-796; readyState gate :799), drawLayer video rasterization :1110-1127 (gated `blendMode !== 'normal'`, uses videoWidth/videoHeight), getSourceWidth instanceof check :1025, renderFrame visible filter :306 (`if (!layer.visible) continue`), video drawable special-case :340-342 (`source !== null || layer.source.type === 'video'`), dispose :1229-1248 (removes the two listeners per element, clears both maps). `Sequence` and `Layer` types already imported.
- app/src/lib/exportRenderer.ts — renderGlobalFrame :134-397 (content local-frame math :185, per-branch renderFrame calls :214/:221/:271/:291/:315/:329/:367/:392 — this is the seek-target authority, do not duplicate it), clone usage :213/:220, renderFrameWithMotionBlur :408-463 (shutter override :427-428, sub-frame loop :436-450, renderGlobalFrame :442, finally-restore :460-462), preloadExportImages :472-551 (MUST stay byte-unchanged).
- app/src/lib/exportEngine.ts — startExport :132, outer try :192, renderer creation :214, preload block :216-231 (preloadAbort + 200ms interval :217-220, inner catch aborted→cancelled :223-230, clearInterval :231), mbSettings :234-237, frame loop :243-298 (cancel check :245-251, MB branch :256-260, normal branch :262, write-fail return :274-281, yield :297), outer catch :518-524 (String(err) → error status + resumeFromFrame), resumeExport :530-534 (delegates to startExport — inherits everything).
- app/src/components/export/ExportPreview.tsx — useEffect :38-64 (renderer :54, sampleFrame :55, preload chain :57-59, cleanup dispose :61-63), no useState anywhere (keep it that way).
- app/src/lib/exportEngine.test.ts — document stub :269 (`tag === 'canvas' ? new TestCanvas() : {}` — extend the video branch), HTMLVideoElement stub :272, exportRenderer module mock :87-91 (renderGlobalFrame / renderFrameWithMotionBlur / preloadExportImages — NO factory change needed: preloadVideos/settleVideoSeeks are real PreviewRenderer methods and the real renderer runs against TestCanvas), imageStore NOT mocked (real — seed imageStore.videoAssets.value in tests, reset in afterEach), ipc mock includes assetUrl :50, existing suites: loops :367-455 assert preloadExportImages not-called on preflight/early-return paths (video preload sits AFTER image preload inside the same try — those assertions keep holding).
- app/src/lib/exportEngine.loops.test.ts / feedback / paintEnumeration — same exportRenderer mock shape (:75/:87); paintEnumeration asserts renderFrameWithMotionBlurMock call counts (:373) — awaiting the async mock is arity-safe.
- app/src/lib/exportRenderer.test.ts — module-scope fixtures (makeSequence :43), per-describe stubbing discipline, imports preloadExportImages + renderGlobalFrame.
- app/src/lib/previewRenderer.test.ts — stub idiom :263-290 (document/Image/HTMLImageElement/HTMLCanvasElement/ImageData/createImageBitmap/Blob via vi.stubGlobal), store mocks :14-30.
- Node environment (vitest.config.ts has no environment key → 'node'): no DOM; EventTarget/Event exist; HTMLVideoElement must be faked AND installed via vi.stubGlobal('HTMLVideoElement', FakeVideo) so the instanceof checks at previewRenderer.ts:1025/:1110 match instances produced by the document stub. assetUrl (ipc.ts:33) is a pure string function — safe in node (previewRenderer.test.ts already imports the module unmocked).
- imageStore (app/src/stores/imageStore.ts): `videoAssets = signal<VideoAsset[]>([])` :27, VideoAsset = {id, name, path} :10-14 — the exact seed shape for tests.
- .planning/REQUIREMENTS.md — VID checklist :16-20 (add VID-04 after :20), traceability table :56-67 (add row after VID-03), coverage counts :69-74 (10 → 11), footer :78.

SCOPE OUT (do not touch):
- Live preview components/bridges (Preview.tsx, previewBridge.ts, PhysicsPaintStudio), audio export (audioExportMixer/exportEngine audio section), mainAppVideoSources.ts / registerPickedVideoSource / readMceVideoLayerPath, imageStore, vitest.config.ts, package.json, Rust/capabilities, .mce schema, the placeholder draw branch, any version bump, any push.
</context>

<tasks>

<task type="auto">
  <name>Task 1: close both video readiness gaps — preloadVideos + settleVideoSeeks + two-pass capture + dialog preview on the same seam</name>
  <files>app/src/lib/previewRenderer.ts, app/src/lib/exportRenderer.ts, app/src/lib/exportEngine.ts, app/src/components/export/ExportPreview.tsx</files>
  <behavior>
    - preloadVideos resolves only when every visible video layer of the given sequences has its element at readyState >= 2; it rejects with an Error whose message CONTAINS the layer name when the asset row is missing, the element fires 'error', or the 30s readiness timeout elapses; it rejects 'Export cancelled' when the signal aborts.
    - settleVideoSeeks returns false immediately (one microtask, no listeners) when every registered element is ready and not seeking; returns true only after awaiting every pending element to readyState >= 2 and seeking === false; rejects naming the clip on error/timeout, 'Export cancelled' on abort.
    - Export frame loop: with motion blur off, each frame does renderGlobalFrame → settleVideoSeeks → a second renderGlobalFrame ONLY when settle returned true; with motion blur on, each sub-frame does the same before its pixels are accumulated. A captured frame is therefore always post-seek (VID-04).
    - cloneForCanvas shares the video maps: a GL-transition clone drawing a video layer reuses the main renderer's element (no fresh readyState-0 element inside the transition offscreens).
    - ExportEngine cancel semantics: image preload, video preload, and frame-loop video waits all observe the single export AbortController; any rejection while the signal is aborted lands as status 'cancelled' (with resumeFromFrame in the loop), never as 'error'; the interval is cleared by a finally on EVERY exit path (preload failure, cancel, write failure, success).
    - ExportPreview: on a ready project the dialog canvas shows the video at the sample frame (pass 1 → settle → pass 2); on a broken source it degrades to a console warning without crashing the component (the export itself is the fail-closed gate); unmount mid-chain aborts the local controller and disposes cleanly.
    - Behavior-untouched proof: the listener block at previewRenderer.ts:784-788, the readyState gate at :799, preloadExportImages (:472-551), mainAppVideoSources.ts, imageStore.ts, previewBridge.ts show no behavior changes (previewRenderer.ts gains only additive lines outside those regions).
    - All pre-existing suites touched by these files stay green: exportEngine, exportEngine.loops, exportEngine.feedback, exportEngine.paintEnumeration, exportRenderer, previewRenderer, previewRenderer.loops (no video fixtures exist in them — preloadVideos is a no-op for their sequences, settle returns false on empty maps, so render call counts are unchanged).
  </behavior>
  <action>Read .claude/skills/efx-async-orchestration/SKILL.md (bounded one-shot waits, cancellation settle-through, failures are data) and .claude/skills/efx-preact-reactivity/SKILL.md (ExportPreview: no new state, no render-body writes) first. Implement (1)-(4) in that order; the file landmarks above are your anchors.

(1) app/src/lib/previewRenderer.ts — the seam.
a. Constants + error copy near the class: `export const VIDEO_READY_TIMEOUT_MS = 30_000;` and `export const VIDEO_SEEK_TIMEOUT_MS = 5_000;`. One private builder `videoBlockedError(name: string, detail: string)` returning `new Error(`Export blocked — video "${name}" ${detail}. Restore the file, then export again.`)` — every fail-closed path routes through it so the clip name is always present (detail examples: 'could not be prepared: its source file is not registered', 'failed to load (file missing or unreadable)', 'did not become ready within 30s', 'did not finish seeking within 5s'). Abort copy is a plain `new Error('Export cancelled')` — matching preloadExportImages' reason so callers can't confuse the two.
b. Add `private videoLayerNames: Map<string, string>;` beside :147/:148; initialize in the constructor. Extend the constructor with an optional third parameter `sharedVideoState?: { elements: Map<string, HTMLVideoElement>; readyHandlers: Map<string, () => void>; layerNames: Map<string, string> }` — when present, adopt all three maps instead of creating new ones; otherwise create. The existing two parameters keep their exact signatures (single-arg call sites elsewhere stay valid).
c. cloneForCanvas (:175-177): pass the third argument with this instance's three video maps — the same sharing pattern as the image cache. Before committing, run `grep -rn "cloneForCanvas\|\.dispose()" app/src --include="*.ts" --include="*.tsx"` and record in the commit body that clones exist only at exportRenderer.ts:213/:220 and are never disposed (only Preview.tsx:142 and ExportPreview.tsx:62 dispose their own main renderers) — a clone disposing a shared map is therefore impossible.
d. resolveVideoSource: ONE additive line only — right after `this.videoElements.set(layer.id, video);` (:781) add `this.videoLayerNames.set(layer.id, layer.name);`. Nothing else in the method changes: :784-788 listeners, :792-796 currentTime math, :799 readyState gate stay byte-identical (guardrail).
e. Private `waitForVideo(video: HTMLVideoElement, name: string, isDone: () => boolean, events: readonly string[], timeoutMs: number, signal: AbortSignal | undefined, detailOnTimeout: string): Promise<void>` — race discipline: if `video.error` already present → throw videoBlockedError immediately; if signal?.aborted → throw cancelled; attach {once:true} listeners for each event (an 'error' listener anywhere in `events` throws videoBlockedError(name, 'failed to load (file missing or unreadable)'); a success event re-checks isDone) + one timeout throwing videoBlockedError(name, detailOnTimeout) + one abort listener throwing cancelled; AFTER attaching, re-check isDone() and settle immediately if satisfied (closes the attach/check race); finally removes every listener and clears the timer on ALL paths. Attach listeners BEFORE the final state check — never the reverse.
f. Private `awaitVideoSettled(layerId: string, video: HTMLVideoElement, signal?: AbortSignal): Promise<void>` — name from `videoLayerNames.get(layerId) ?? layerId`; then in order: signal aborted → throw cancelled; `video.error` → throw named; if `video.readyState < 2` → await waitForVideo(video, name, () => video.readyState >= 2, ['loadeddata', 'error'], VIDEO_READY_TIMEOUT_MS, signal, 'did not become ready within 30s'); re-check video.error → throw named; if `video.seeking` → await waitForVideo(..., () => !video.seeking, ['seeked', 'error'], VIDEO_SEEK_TIMEOUT_MS, signal, 'did not finish seeking within 5s'); final re-check of readyState and error → throw named if violated.
g. Public `async preloadVideos(sequences: readonly Sequence[], signal?: AbortSignal): Promise<void>` — enumerate `seq.visible !== false` sequences, inside each every `layer.visible && layer.source.type === 'video'` layer; for each (in parallel via Promise.all): call `this.resolveVideoSource(layer, 0, seq.fps)` (creation path — frame 0 never initiates a seek, so no wait is needed for it), then `const video = this.videoElements.get(layer.id); if (!video) throw videoBlockedError(layer.name, 'could not be prepared: its source file is not registered');` (the missing-videoAsset arm — resolveVideoSource returned before registering), then `await this.awaitVideoSettled(layer.id, video, signal);`. Doc-comment it as VID-04 initial readiness, the video twin of preloadExportImages (but fail-CLOSED — images stay fail-open, that asymmetry is the law).
h. Public `async settleVideoSeeks(signal?: AbortSignal): Promise<boolean>` — snapshot `[...this.videoElements.entries()]`; filter to elements where `readyState < 2 || seeking`; empty → `return false` synchronously (no listener churn for video-less exports); otherwise `await Promise.all(pending.map(([layerId, video]) => this.awaitVideoSettled(layerId, video, signal)));` then `return true`. Doc-comment the render → settle → re-render contract: pass 1 registered the seeks, the caller re-renders when this returns true, and only that second pass is captured (VID-04).
i. Doc-comment the class header (or the two new methods) stating the export contract and that the live preview path (:784-788) is intentionally untouched.

(2) app/src/lib/exportRenderer.ts — per-sub-frame settle.
renderFrameWithMotionBlur (:408): add `signal?: AbortSignal` as the LAST parameter and make it `async` (return Promise<void>). Inside the sub-frame loop, immediately after the `renderGlobalFrame(...)` call at :442, add: if `await renderer.settleVideoSeeks(signal)` is true → call `renderGlobalFrame(renderer, canvas, subFrame, fm, allSeqs, overlaps, soloActive)` AGAIN with identical arguments, so the getImageData at :445 reads post-seek pixels. Keep the shutter-angle store override, the accumulation math, and the finally-restore (:427-462) otherwise byte-identical. Update the function doc: every sub-frame settles its video seeks before its pixels are read (VID-04). preloadExportImages (:472-551): ZERO changes.

(3) app/src/lib/exportEngine.ts — preload + two-pass capture + cancel lifetime.
a. Replace the preload block (:216-231): delete preloadAbort/preloadCancelCheck; declare `const exportAbort = new AbortController();` and `const cancelCheckInterval = setInterval(() => { if (exportStore.isCancelled()) exportAbort.abort(); }, 200);` immediately BEFORE the outer `try {` at :192 (so the finally below covers every path after creation). Inside the try, keep a nested try/catch exactly like today's: `await preloadExportImages(renderer, fm, exportAbort.signal, allSeqs);` THEN `await renderer.preloadVideos(allSeqs, exportAbort.signal);`; the catch does `if (exportAbort.signal.aborted) { exportStore.updateProgress({ status: 'cancelled' }); return; } throw err;` (a preloadVideos fail-closed rejection falls through to the outer catch → named error status; an abort becomes 'cancelled').
b. Frame loop, motion-blur OFF branch (:262): wrap the render in an inner try/catch: `renderGlobalFrame(renderer, canvas, frame, fm, allSeqs, overlaps, soloStore.soloEnabled.peek());` then `if (await renderer.settleVideoSeeks(exportAbort.signal)) { renderGlobalFrame(same six args again); }` — on catch: `if (exportAbort.signal.aborted) { exportStore.updateProgress({ status: 'cancelled', resumeFromFrame: frame }); return; } throw err;` (seek timeout/video error → outer catch → named error).
c. Frame loop, motion-blur ON branch (:256-260): `await renderFrameWithMotionBlur(renderer, canvas, frame, fm, allSeqs, overlaps, mbSubFrames, mbShutterAngle, soloStore.soloEnabled.peek(), exportAbort.signal);` inside the SAME inner try/catch from (b) — identical cancelled-vs-error routing.
d. Attach `finally { clearInterval(cancelCheckInterval); }` to the existing outer catch (:518) so the interval dies on success, preload failure, cancel, write failure, and thrown errors alike. The audio section and encoding keep their own existing cancel machinery untouched. Double-check with `grep -n "clearInterval" app/src/lib/exportEngine.ts` that no path leaks the interval and no stale preloadCancelCheck reference remains.
e. Comments: name VID-04 / 261012-kxg at the preloadVideos call and the two-pass block, and state WHY pass 2 exists (the draw owns the seek math; pass-1 pixels are provisional and never captured).

(4) app/src/components/export/ExportPreview.tsx — the dialog path on the same seam.
Inside the existing useEffect (:38-64), BEFORE the preload chain, create `const abort = new AbortController();` and add `abort.abort();` to the cleanup (:61-63) alongside renderer.dispose(). Replace :57-59 with an async continuation of the SAME chain: `preloadExportImages(renderer, fm, undefined, allSeqs).then(async () => { ... })` where the body: (i) `try { await renderer.preloadVideos(allSeqs, abort.signal); } catch (err) { console.warn('[ExportPreview] video not ready:', err); }` — a broken source degrades to a warning here because the dialog canvas is not a delivered artifact; the export itself fail-closes with the named error (comment this asymmetry); (ii) `renderGlobalFrame(renderer, canvas, sampleFrame, fm, allSeqs, overlaps, soloStore.soloEnabled.value);`; (iii) `try { if (await renderer.settleVideoSeeks(abort.signal)) { renderGlobalFrame(same args); } } catch (err) { if (!abort.signal.aborted) console.warn('[ExportPreview] video settle:', err); }`. Keep deps `[frames, outWidth, outHeight]` unchanged; no useState, no signal reads/writes (efx-preact-reactivity); preloadExportImages keeps `undefined` signal (unchanged image semantics).

Sanity gates before committing: `grep -rn "cloneForCanvas\|\.dispose()" app/src --include="*.ts" --include="*.tsx"` recorded in the commit body; `git diff app/src/lib/exportRenderer.ts | grep '^-' | grep -v '^---' | grep -c 'imageIds\|preloadPaperTextures\|awaitPhysicPaintDecodes\|isResolved'` returns 0 (image preload untouched); `git diff app/src/lib/previewRenderer.ts | grep '^-' | grep -v '^---' | grep -c "addEventListener('loadeddata'\|addEventListener('seeked'\|readyState < 2"` returns 0 (live listener/gate lines not removed); `git diff --stat` lists ONLY the four Task-1 files.

Commit as `fix(261012-kxg): export video readiness — preload loadeddata, settle seeked, fail-closed naming the clip (VID-04)`.
</action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/lib/exportEngine.test.ts src/lib/exportEngine.loops.test.ts src/lib/exportEngine.feedback.test.ts src/lib/exportEngine.paintEnumeration.test.ts src/lib/exportRenderer.test.ts src/lib/previewRenderer.test.ts src/lib/previewRenderer.loops.test.ts && pnpm --filter efx-motion-editor run typecheck</automated>
  </verify>
  <done>All seven pre-existing suites pass unchanged (no fixture in them has a video layer, so preloadVideos no-ops and settle returns false — render call-count assertions hold), typecheck shows no NEW errors versus the task-start baseline (record the baseline first; pre-existing typecheck failures listed in STATE.md deferred items are out of scope), the sanity greps above pass, git diff is confined to the four Task-1 files, the live listener/readyState lines and preloadExportImages are byte-untouched, and one atomic commit exists.</done>
</task>

<task type="auto">
  <name>Task 2: headless regression legs for VID-04 + add the requirement</name>
  <files>app/src/lib/previewRenderer.videoReadiness.test.ts, app/src/lib/exportEngine.test.ts, app/src/lib/exportRenderer.test.ts, .planning/REQUIREMENTS.md</files>
  <behavior>
    - Leg A1 (initial readiness): a FakeVideo that fires 'loadeddata' on the next macrotask → preloadVideos resolves; the element sits in the renderer's map at readyState 2.
    - Leg A2 (fail-closed, load error): a FakeVideo that fires 'error' → preloadVideos rejects with a message CONTAINING the layer name (RED against pre-fix code only in the sense that preloadVideos does not exist yet — this suite is authored post-fix per fix-before-tests; its value is pinning the contract against future refactors).
    - Leg A3 (fail-closed, missing asset): no row in imageStore.videoAssets for the layer's videoAssetId → preloadVideos rejects naming the clip.
    - Leg B1 (settle no-op): all elements ready and not seeking → settleVideoSeeks resolves false without registering any lasting listener.
    - Leg B2 (settle waits for seeked): an element pushed into seeking → settle's promise does NOT resolve until 'seeked' fires; then it resolves true.
    - Leg B3 (mid-wait cancel): aborting the signal while an element is pending rejects with 'Export cancelled'.
    - Leg B4 (bounded timeout): with fake timers, an element that never becomes ready rejects naming the clip after VIDEO_READY_TIMEOUT_MS (30s) advances — a hung file cannot stall forever.
    - Leg C (export fail-closed end-to-end): startExport on a sequence with a video layer whose FakeVideo errors → progress.status 'error', errorMessage contains the layer name, renderGlobalFrame never called, no PNG written for any frame (exportWritePng mock call count does not include frame writes).
    - Leg D (wiring, no gratuitous double render): startExport on a sequence with a ready video layer → status 'complete' and renderGlobalFrame called EXACTLY fm.length times (settle returned false every frame — the mocked draw registers no seeks).
    - Leg E (motion-blur per-sub-frame settle): a real renderFrameWithMotionBlur with subFrames=3 and a ready video layer → renderer.settleVideoSeeks called exactly 3 times (once per sub-frame, awaited before accumulation) and the FakeVideo's currentTime ends at the last sub-frame target (2/3/fps).
    - Zero pre-existing assertions edited; vitest.config.ts, package.json untouched.
  </behavior>
  <action>Test-only + one docs edit — NO production code changes. Node environment discipline (vitest.config.ts has no environment key): fake the DOM surface with vi.stubGlobal, and install FakeVideo as BOTH document.createElement('video') and the global HTMLVideoElement so the instanceof checks at previewRenderer.ts:1025/:1110 match. Never author a .test.tsx.

Shared harness shape (define locally in each file that needs it — describe closures do not share consts):
- `class FakeVideo extends EventTarget` with: private backing currentTime accessor whose setter stores the value and, when the value actually changes, sets `seeking = true` and schedules `setTimeout(0)` to set `seeking = false` and `dispatchEvent(new Event('seeked'))` (mode 'silent' skips the schedule — used for the timeout/abort legs); fields `readyState = 0`, `seeking = false`, `duration = 10`, `error = null`, `videoWidth = 4`, `videoHeight = 3`, `src = ''`, `preload/muted/playsInline`, and no-op `pause()`, `removeAttribute()`, `load()`; a `set src` (or post-construction kick) that schedules setTimeout(0): mode 'ready' → `readyState = 2; dispatchEvent(new Event('loadeddata'))`; mode 'error' → `dispatchEvent(new Event('error'))`; mode 'silent' → nothing. Controlled per-test through a module-scope `videoMode` variable the document stub reads. Class-field initializers must not run the currentTime setter (initialize the backing field directly) or the element starts out seeking.
- Seed/reset video assets with the REAL imageStore: `imageStore.videoAssets.value = [{ id: 'va-1', name: 'HyperEspaceSUPP.mov', path: '/Movies/HyperEspaceSUPP.mov' }]` in the test, `imageStore.videoAssets.value = []` in afterEach. Layer fixture: `{ id, name: 'Vidéo SUPP', type: 'video', visible: true, opacity: 1, blendMode: 'normal', transform: defaultTransform(), source: { type: 'video', videoAssetId: 'va-1' } }` cast as Layer; Sequence fixture mirrors exportRenderer.test.ts makeSequence (:43) with fps 24 and that layer.
- Timeout legs use `vi.useFakeTimers()` + `await vi.advanceTimersByTimeAsync(VIDEO_READY_TIMEOUT_MS)` and `vi.useRealTimers()` in afterEach; abort legs use real timers with a `setTimeout(0)` that aborts the controller.

(1) NEW app/src/lib/previewRenderer.videoReadiness.test.ts — legs A1-A3, B1-B4. Minimal stubs mirroring previewRenderer.test.ts:263-290 (paintStore, projectStore mocks as there; document stub returning a minimal 2d-context canvas for 'canvas' tags and `new FakeVideo(videoMode)` for 'video'; vi.stubGlobal('HTMLVideoElement', FakeVideo)). Construct a real `new PreviewRenderer(canvas)` — only preloadVideos/settleVideoSeeks are exercised, never a draw, so the context stub stays tiny. Describe name: `261012-kxg export video readiness (VID-04)`. For B2: enter mode 'silent' after preload succeeds (or flip seeking manually: set `video.currentTime = 2.5` via the setter which marks seeking, with mode suppressing the auto-seeked), start `const p = renderer.settleVideoSeeks();`, assert not settled after a microtask flush, then dispatch 'seeked' (seeking = false) and `await expect(p).resolves.toBe(true)`.

(2) app/src/lib/exportEngine.test.ts — legs C and D in a NEW top-level describe `261012-kxg export fail-closed video (VID-04)` (every existing case untouched). Extend the document stub at :269 with a video branch: `tag === 'video' ? new FakeVideo(videoMode) : {}` (existing tests never create video elements — zero impact). Import imageStore and FakeVideo (hoisted or defined above the stubs). Leg C: seed videoAssets, set videoMode 'error', hoisted.sequences = [makeSequence(makeVideoLayer())], hoisted.fm = makeFm(4), exportStore.format stays 'png', `await startExport();` → `expect(exportStore.progress.peek().status).toBe('error')`, `expect(exportStore.progress.peek().errorMessage).toContain('Vidéo SUPP')`, `expect(renderGlobalFrameMock).not.toHaveBeenCalled()`. Leg D: videoMode 'ready', same fixtures → status 'complete' and `expect(renderGlobalFrameMock).toHaveBeenCalledTimes(4)` (= fm.length — pins that settle's false result adds no second pass). afterEach: clear videoAssets and reset videoMode.

(3) app/src/lib/exportRenderer.test.ts — leg E in a NEW describe `261012-kxg motion-blur sub-frame settle (VID-04)` with its own scoped vi.stubGlobal block (document/HTMLVideoElement/FakeVideo + a canvas whose 2d context no-ops translate/rotate/scale/clearRect/drawImage/save/restore and supplies getImageData → `{ data: new Uint8ClampedArray(w * h * 4) }`, createImageData → a plain {data} object, putImageData → no-op — the accumulation loop at exportRenderer.ts:445-458 needs all three). Import renderFrameWithMotionBlur (add it to the existing import at :18). Real PreviewRenderer + videoMode 'ready' + seeded videoAssets + a video sequence + fm content entries for seq-1. Spy the instance: `const settleSpy = vi.spyOn(renderer, 'settleVideoSeeks');` then `await renderFrameWithMotionBlur(renderer, canvas, 0, fm, [seq], [], 3, 180, false);` → `expect(settleSpy).toHaveBeenCalledTimes(3);` and `expect(fakeVideo.currentTime).toBeCloseTo((2 / 3) / 24, 5);` (the LAST sub-frame target — proving each sub-frame sought and settled before accumulation). Make the auto-seeked timer drive the waits so the await completes.

(4) .planning/REQUIREMENTS.md — use Edit only (never Write — the file carries other sections):
- After the VID-03 line (:20), add: `- [ ] **VID-04**: Exported frames never bake the video loading placeholder; video layers await loadeddata and seeked, or the export stops naming the clip`.
- In the traceability table after the VID-03 row (:63), add: `| VID-04 | Quick 4 | Pending |`.
- Coverage block (:69-74): `v1 requirements: 10 total` → `11 total`, `Mapped to quicks/release: 10` → `11`.
- Footer (:78): append a new line (keep the existing one): `*2026-10-12 — VID-04 defined (Quick 4, export video readiness); 11/11 mapped, status Pending until native UAT*`.

Sanity gates: `grep -c "VID-04" .planning/REQUIREMENTS.md` returns 4 (checklist + traceability + footer + this count is self-evident — assert `grep -c 'VID-04'` ≥ 3); `git diff --stat` lists only the four Task-2 files; `git diff app/vitest.config.ts app/package.json` is empty.

Commit as `test(261012-kxg): pin export video readiness legs (VID-04) + define VID-04`.
</action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/lib/previewRenderer.videoReadiness.test.ts src/lib/exportEngine.test.ts src/lib/exportRenderer.test.ts && pnpm --filter efx-motion-editor exec vitest run && pnpm --filter efx-motion-editor run typecheck</automated>
  </verify>
  <done>All eight new legs pass; every pre-existing test in the three touched suites passes with ZERO assertion edits; the full suite shows no NEW failures versus the task-start baseline (record the baseline count first — pre-existing failures documented in STATE.md deferred items are out of scope, note them, do not fix them); typecheck adds no NEW errors; REQUIREMENTS.md carries VID-04 in checklist, traceability (Quick 4 | Pending), updated coverage counts, and footer; vitest.config.ts and package.json untouched; one atomic commit.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| on-disk video file → HTMLVideoElement readiness (preload/settle) | untrusted/missing/slow media crosses here; failure must stop the export by name, never degrade to the placeholder (VID-04) |
| seek registration (pass 1) → captured pixels (pass 2) | a frame captured between currentTime assignment and 'seeked' is a stale-deliverable trust violation the settle gate closes |
| export cancel → async waits | an abort must settle every wait as 'cancelled' without stranding the loop or mis-reporting a user cancel as a video failure |
| clone renderers → shared video maps | GL-transition clones drawing through shared elements must not bypass the main renderer's settle or leak listeners |

## STRIDE Threat Register

Threat IDs are unique within this quick; no prior PLAN files exist in this directory (T-261012-KXG-SC is reserved and kept).

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261012-KXG-01 | Integrity | export frame loop / renderFrameWithMotionBlur — a delivered frame bakes the "Loading..." placeholder or a pre-seek stale image | high | mitigate | Two independent gates: preloadVideos forces readyState >= 2 before the loop starts; settleVideoSeeks awaits 'seeked' after every draw-registered seek (per frame AND per motion-blur sub-frame) with a conditional second render — the captured pixels are always from the settled pass; legs C/D/E + native UAT rows 1/3 pin it |
| T-261012-KXG-02 | Integrity | video source unavailable (missing/renamed/corrupt file) — export silently ships placeholder frames | high | mitigate | Fail-closed: missing videoAsset row, 'error' event, video.error, or timeout each throw `Export blocked — video "<name>" ...` through the existing exportStore error status (same law as SND-02); legs A2/A3/C assert the clip name is in the message and no frames are written |
| T-261012-KXG-03 | Denial of Service | video waits — a file that never fires loadeddata/seeked could stall the export forever | medium | mitigate | Every wait is bounded (VIDEO_READY_TIMEOUT_MS 30_000, VIDEO_SEEK_TIMEOUT_MS 5_000) and every path removes its listeners/timers in finally; leg B4 advances fake timers to the bound and observes the named rejection |
| T-261012-KXG-04 | Denial of Service | cancel mid-wait — user cancel surfaces as an 'error', or the interval leaks past the export | low | mitigate | One AbortController + 200ms isCancelled poll spans preload and frame loop; inner catches route aborted rejections to status 'cancelled' (with resumeFromFrame in the loop); the outer finally clears the interval on every exit; leg B3 pins mid-wait abort |
| T-261012-KXG-SC | Tampering | npm/pip/cargo installs | high | mitigate | No package installs in this plan — zero install surface (EventTarget, AbortController, vi.stubGlobal all native), so no legitimacy checkpoint is required |

</threat_model>

<verification>
- Per-task automated gates (`vitest run` only, NEVER watch, per CLAUDE.md; `pnpm --filter efx-motion-editor run typecheck` after every task — compare against a recorded baseline, no NEW failures/errors).
- Guardrail audit: `git diff` confined to the plan's files; preloadExportImages body, the resolveVideoSource listener/readyState lines, mainAppVideoSources.ts, imageStore.ts, previewBridge.ts, vitest.config.ts, package.json all untouched (greps in Task 1's done criteria).
- Requirements trace: VID-04 = Task 1 (both gates + fail-closed + dialog path) and Task 2 (legs A1-A3, B1-B4, C, D, E + the REQUIREMENTS entry).
- Status stays automated-ready until the user judges the live UAT rows (no Chrome DevTools MCP, no server started by the executor):

| # | Case | Pass condition |
|---|------|----------------|
| 1 | H.264 export, same project + HyperEspaceSUPP.mov as a video track | the OUTPUT video contains the video frames — zero "Loading..." boxes in any frame |
| 2 | Export-dialog preview | the preview canvas shows the video content, not stuck on "Loading" |
| 3 | Seek correctness | frames at start / middle / end of the export match the timeline frame at those positions (not a stale frame) |
| 4 | Missing source | rename the .mov before export → the export stops with an error naming the clip, and no placeholder is baked |

- After UAT pass: the Release phase RE-RUNS from the Apple sign/notarize step (the 1.0.1 bump stays; no second bump).
</verification>

<success_criteria>
- VID-04 passes every automated leg AND the user's native UAT passes all four rows — nothing is claimed done before that (status = automated-ready)
- Both contract gaps are closed: initial readiness enforced by preloadVideos before the loop; per-frame and per-sub-frame seek completion enforced by settleVideoSeeks before capture
- Fail-closed law holds: any unready video stops the export with a message naming the clip; the placeholder can never reach a delivered frame
- Dialog preview closed on the same seam; cancel stays 'cancelled' mid-wait; all waits bounded
- Guardrails held: live preview path behavior-untouched, preloadExportImages byte-unchanged, video asset resolution law untouched, no new packages, no config changes, zero pre-existing assertion edits
</success_criteria>

<output>
Create .planning/quick/261012-kxg-export-video-readiness-v1-0-1-release-bl/261012-kxg-SUMMARY.md when done (commit style: `fix(261012-kxg): …` / `test(261012-kxg): …`)
</output>
