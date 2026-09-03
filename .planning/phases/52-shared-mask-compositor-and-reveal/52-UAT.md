---
status: testing
phase: 52-shared-mask-compositor-and-reveal
source: [52-VERIFICATION.md]
started: 2026-09-02T19:10:00Z
updated: 2026-09-03T21:55:00Z
---

## Current Test

number: 2
name: Create Rail dialog — Reveal Photo Rail tab flow (RVL-01)
expected: |
  With a script selected in the Action tab, open the Create Rail dialog ("Create Rail…" button), switch to the Reveal Photo Rail tab; the Frames field defaults to the script's natural duration with the "from F{n}" hint; Create Rail bakes the rail onto the current track with the onProgress bar, and the baked keys overlay the reference ghost pixel-perfectly.
awaiting: user response

## Tests

### 1. Abort the reveal bake mid-span
expected: The bake aborts cleanly (Cancel generation in the Create Rail dialog); no baked keys appear; the document revision is not bumped
result: [pending]

### 2. Create Rail dialog — Reveal Photo Rail tab flow (RVL-01)
expected: With a script selected in the Action tab, open the Create Rail dialog ("Create Rail…" button), switch to the Reveal Photo Rail tab; the Frames field defaults to the script's natural duration with the "from F{n}" hint; Create Rail bakes the rail onto the current track with the onProgress bar, and the baked keys overlay the reference ghost pixel-perfectly.
result: issue
reported: "1. BLOCKER — baked keys scaled/offset vs reference ghost: commitRevealBake renders at _compositorSizeProvider (project 1920x1080) while PlayScript bakes at working canvas size (capped 1000px); compositeRevealMask samples wrong region. 2. UI — reveal creation section in Photo Reference modal broken/cramped: REVEAL/MOTION and REVEAL/STATIC variant buttons squashed and wrap badly. 3. UX — frame count invisible at creation: frameCount defaults to script natural duration or 3 with no way to see/adjust before committing."
severity: blocker

### 3. Native UAT: track rail-creation flow (RVL-01)
expected: Create a reveal rail from the track rail-creation flow (Create rail → Reveal) — it opens the Create Rail dialog directly on the Reveal Photo Rail tab and lands baked through the same mutation as the Action-tab path.
result: [pending]

### 4. Native UAT: reveal rail visual look (RVL-04)
expected: The reveal rail shows the green-family color (emerald motion / teal static), the 20x4px status dot, and the tooltip freshness line.
result: [pending]

### 5. Reference guard — reveal creation without a placed reference (D-12)
expected: With NO photo reference placed, entering the Reveal Photo Rail tab (or clicking Create Rail there) opens the Photo Reference modal directly so a source can be imported; the Create Rail dialog stays open behind it; after importing, the reveal tab's guard notice is gone and Create Rail bakes.
result: [pending]

### 6. Reveal rail tooling interop (G-52-4)
expected: On a baked reveal rail: paint and +Key/rail creation work on frames after the rail; a baked key copies and pastes elsewhere; key spacing applies to the rail; the rail drags by its line; the rail deletes. The reveal rail behaves exactly like a motion/static rail.
result: [pending]

## Summary

total: 6
passed: 0
issues: 1
pending: 5
skipped: 0
blocked: 0

## Gaps

- gap_id: G-52-2a
  truth: "With an identity transform, baked reveal keys overlay the reference ghost pixel-perfectly; both creation paths (modal + track flow) bake at the same size authority as the PlayScript path."
  status: failed
  reason: "User reported: commitRevealBake (physicPaintStore.ts:1284) renders at _compositorSizeProvider (project size 1920x1080, wired in projectStore.ts:949) while the PlayScript bake renders at working canvas size (PhysicsPaintStudio.tsx:1773, capped at 1000px long edge by physicsPaintCanvasSizing.ts). Script strokes live in working coordinates, so renderProgressiveAlphaFrame at project size squashes coverage into the up-left quadrant and compositeRevealMask (physicsPaintRotoPlayScriptRenderer.ts:154-180) samples the reference in the wrong region."
  severity: blocker
  test: 2
  artifacts: []
  missing: []
  fix_applied: "2026-09-03 — commitRevealBake now derives the working size via getPhysicsPaintWorkingSize(projectSize) and passes zoom = working/project with the reference; compositeRevealMask reproduces the ghost draw math (image*zoom, center + transform*zoom). Covered by physicsPaintRotoRevealBake.test.ts (zoom ghost-math test) and efxPaintStore.reveal.test.ts (working-size authority test). CONFIRMED WORKING LIVE by the user in the G-52-3 delta report — awaiting the formal Test 2 re-run to close."
- gap_id: G-52-2b
  truth: "The reveal creation surface lays out cleanly: variant buttons, span controls, and Create/Cancel all fit without squashing or bad wrapping."
  status: failed
  reason: "User reported: variant buttons are squashed and wrap badly, CREATE has no room (PhysicsPaintPhotoReferenceDialog.tsx). Widen the modal or restructure the creation section."
  severity: minor
  test: 2
  artifacts: []
  missing: []
  fix_applied: "2026-09-03 — SUPERSEDED by G-52-3: the reveal creation surface left the Photo Reference modal entirely; it now lives as the Reveal Photo Rail tab of the Create Rail dialog (the full-width PlayScript dialog grid, no cramped 252px card). Awaiting re-run of Test 2."
- gap_id: G-52-2c
  truth: "The computed frame span is visible at creation time (e.g. '12 frames from F5') or exposed as an editable field defaulting to the script natural duration; D-20 adjust-afterwards law stays as-is."
  status: failed
  reason: "User reported: frameCount = getScriptNaturalDuration(scriptId) ?? DEFAULT_REVEAL_FRAME_COUNT(3) (physicsPaintPhotoReferenceController.ts:279); script baked 3 frames with no way to see or adjust the value before committing."
  severity: minor
  test: 2
  artifacts: []
  missing: []
  fix_applied: "2026-09-03 — moved to the Reveal Photo Rail tab (G-52-3): the Timing card shows an editable Frames field re-defaulted to the script's natural duration on dialog open and on each tab switch, plus the 'from F{n}' hint (the playhead frame snapshotted at open — canonicalStart). The natural duration port is now wired for real: the selected Action's brushCount (the progressive schedule builds stroke by stroke — one frame per brush is the natural span), falling back to 3. Invalid spans are rejected before the mutation. Covered by physicsPaintRotoPlayScriptController.test.ts (10 new reveal-tab tests) and PhysicsPaintPlayScriptDialog.test.ts (5 new reveal-tab tests). Awaiting re-run of Test 2."
- gap_id: G-52-3
  truth: "Reveal creation lives in the PlayScript Action-tab flow: the Create Rail dialog has two tabs (Paint Rail = the exact previous Create Group interface; Reveal Photo Rail = reveal options minus the script list, plus Repeat/Infinity and Motion wiggle). The Photo Reference modal is a pure reference control surface. User-visible PlayScript creation/regenerate wording says Rail, not Group. Creating from the Reveal tab without a placed reference opens the Photo Reference modal proactively (never a silent disabled state). The reveal tab routes through the same commitRevealBake mutation (creation IS the first bake)."
  status: failed
  reason: "User reported (UAT delta): 'MOVE reveal creation into the PlayScript Action tab flow… The Create Rail dialog gets TWO TABS… RENAME Group → Rail in user-facing PlayScript surfaces… GUARD (proactive, not a refusal)… The mutation is shared.'"
  severity: blocker
  test: 2
  artifacts: []
  missing: []
  fix_applied: "2026-09-03 — commit 1b11e1c0. (1) The Photo Reference modal is back to a pure reference control surface (reveal CTA/surface/controller state machine/CSS removed, revealCreationRequested wiring removed). (2) The PlayScript dialog is now the Create Rail dialog with a Paint Rail / Reveal Photo Rail tab strip (apply mode only; edit/regenerate modes keep their single-surface layout). The Reveal tab carries Rail Type (Reveal Motion/Static with caption helpers), Timing (Frames defaulting to natural duration + 'from F{n}' hint + Repeat/Infinity — the D-08 repeat law now surfaced at creation through createRevealRail's new repeat input), Motion wiggle with Reset defaults (fed to the bake for both variants — D-09), and no Color card. The Requested/Effective summary and the Cancel/Create Rail footer are shared; the reveal bake rides the dialog's phase/abort machinery so Cancel generation aborts mid-span with no keys written. (3) The track flow's Create rail → Reveal item opens the same dialog on the Reveal tab (menu-level disabled guard removed). (4) The D-12 guard: entering or confirming the Reveal tab without a placed reference opens the Photo Reference modal directly and shows an actionable notice ('Place a reference…'); the dialog stays open behind it. (5) The Studio createReveal port records the unified-ledger undo entry (the modal path previously dropped the descriptor). (6) Group → Rail renamed across the PlayScript creation/regenerate/inspector copy (Create Rail…, Rail Type, Edit Rail, Regenerate Rail, Linked Rails, Keep Rails / Delete Action and Rails, 'Rail at F{n}' naming, status/log copy). Full suite green (3373 passed) + tsc clean. Awaiting re-run of Tests 1–5."
- gap_id: G-52-4
  truth: "A baked reveal rail is fully interoperable with the existing rail tooling: paint/create on frames after it, copy/paste its keys, apply key spacing, drag it by its line, delete it — the same contract as motion/static rails."
  status: failed
  reason: "User reported (all four on a baked reveal/motion rail): (a) timeline blocked after the rail — no painting or rail creation on later frames; (b) key copy/paste from the reveal rail broken; (c) key spacing refused; (d) rail drag by the line broken. Traced to two shared roots: (1) cloneLoopClips (useRotoPhysicalEditCoordinator.ts:640-661) rebuilt every clip field-by-field and dropped railKind — a canonical fingerprint term (physicsPaintRotoPhysicalModel.ts:1088) — so every bridge payload on a track carrying a reveal rail failed the parent's canonical re-verification (physicPaintBridge.ts:907/914, :1444-1453) and the edit rejected; (2) the reveal clip was born without the 43-06 lifecycle fields — parse hydrates finite clips (buildDefaultPhysicPaintRotoGroupLifecycle) but never infinity ones, leaving a split-brain shape the group classifier (physicsPaintRotoGroupLifecycle.ts:254-266) and paint-COW proposer reject; an infinity reveal clip additionally derived an UNBOUNDED range (effectiveEnd = capacity), making every later frame resolve linked/render-only."
  severity: blocker
  test: 6
  artifacts: []
  missing: []
  fix_applied: "2026-09-03 — commit 1062e30a. (1) cloneLoopClips round-trips railKind, so the staged payload serializes identically to the canonical clips and the bridge re-verification passes for paste/drag/spacing/paint on a reveal-rail track. (2) createRevealRail stamps the full 43-06 lifecycle at creation (syncState/provenanceState/phaseOrigin/originalEndExclusive/visibleRanges/frameOverrides; infinity pins one cycle and the resolver extends it to capacity — the render-neutral shape the payload normalizer already synthesized), so the reveal clip is a first-class Group from birth and never derives an unbounded range; resizeRevealRail keeps the lifecycle consistent with the surviving cycle. (3) buildDuplicatedLoopClip preserves railKind — a pasted/duplicated reveal rail stays a reveal rail. Regression coverage: coordinator payload round-trip test (mutation-verified — fails without the railKind line), creation + infinity lifecycle stamping tests, shrink lifecycle consistency assertions, reveal rail-set paste kind preservation. Full suite green (3377 passed) + tsc clean. Awaiting re-run of Test 6."
- gap_id: G-52-5
  truth: "A placed photo reference costs zero per-frame/per-mutation image decodes (decode-once cache, handles gated behind !transformLocked), and the unified ledger stays undoable/redoable in a session with a reveal rail: reference placement/replacement records its promised undo entry, display-preference writes (opacity/lock/visibility/transform) never poison the live-authority guard, and undo+redo work for reveal-create/replay/delete/span entries."
  status: failed
  reason: "User reported: (A) PERFORMANCE — drawReferenceGhost (PhysicsPaintReferenceGhost.ts:69) created a new Image() and decoded the reference dataUrl on EVERY draw (the layer effect re-fires on frame/zoom/playback AND both version clocks), and PhysicsPaintReferenceTransformHandles.tsx:78-109 ran a SECOND independent per-effect decode even while transformLocked (handles invisible) — a main-thread decode storm making copy/delete/move/scrub sluggish in any project with a placed reference. (B) UNDO/REDO DEAD once a reveal rail exists — the history failed closed silently."
  severity: blocker
  test: 2
  artifacts: []
  missing: []
  fix_applied: "2026-09-03 — (A) physicPaintStore.getDecodedImage exposes the existing decode-once _compositorDecode cache (dataUrl-keyed, one new Image() per unique source EVER, onload/onerror bump physicPaintVersion so subscriber effects re-fire and draw); drawReferenceGhost now draws synchronously from the cache; the transform-handles effect resolves dimensions from the same cache and skips the resolution entirely while transformLocked. The bake renderer already decodes once per bake (loadRevealReferenceImage reused across frames) — no change needed. Regression: ghost suite — 3 repeated draws with the same dataUrl construct exactly 1 Image. (B) Two ledger poisons found. (1) handleConfirmReferencePicker never recorded the set-photo-reference-source descriptor the 50-03 contract promises — an unrecorded document replacement that broke the chain for every entry recorded before a reference placement/replacement; it now records via rotoMoveHistory.recordBackgroundEdit. (2) The background undo/redo live-authority guards compared object IDENTITY, so any unrecorded display-preference write (reference opacity/visibility/lock/transform — which replace the document object without touching the content fingerprint, D-07 split) poisoned the guard permanently → Cmd+Z/Cmd+Shift+Z dead, fail-closed, silent. The guards now compare by buildEfxPaintDocumentRevision (identity fast path first; parse throw fails closed): display-only divergence is tolerated, unrecorded CONTENT edits (docrev/content rotation) still fail closed — the CR-01 protection is unchanged (covered by a dedicated test). Both reveal creation paths verified to record (the track flow rides the same dialog → same Studio port). The replay/delete/span reveal mutations have no UI call sites yet; their descriptors share the same background branch covered by the create-entry repro. Regression coverage (useRotoPhysicalEditHistory.test.ts, G-52-5 describe): real createRevealRail + real history hook — undo/redo by reference with runtime resync; unrecorded display-preference write after the record → undo+redo still work; unrecorded content write after the record → still fails closed; recorded reference-set chaining below a reveal-create entry (undo×2/redo×2). Store level: serializeRuntimeIntoDocument preserves live document identity after a reveal create (efxPaintStore.reveal.test.ts). Studio wiring assertion for the reference-confirm recording. Full suite green (3384 passed) + tsc clean. Awaiting re-run of the affected checkpoints (undo/redo with a reveal rail; general UI smoothness with a placed reference)."
- gap_id: G-52-6
  truth: "A project with reveal rails opens in ~1-2s and interaction-time syncs (copy/delete/move/spacing/drag) feel identical to paint rails — the canonical fingerprint never concatenates full payload dataUrls."
  status: failed
  reason: "User reported (bisection: 2 paint rails = 1s open; +1 reveal rail = 11s; +1 repeating reveal rail = 23s — ~10-12s per reveal rail at open, plus poisoned interaction-time syncs): encodeValidatedPhysicPaintRotoPhysicalContent (physicsPaintRotoPhysicalModel.ts:1021) encoded encodeCanonicalString(record.payload.dataUrl) — the FULL multi-MB PNG dataUrl of every real-key record — into the canonical content fingerprint. Hand-painted keys are tiny so this never hurt before; reveal baked keys carry photo content (0.5-2MB dataUrls each), and the fingerprint is recomputed at every parse, mutation commit, bridge payload sync + parent canonical re-verification (physicPaintBridge.ts:907/914), twice per undo/redo attempt (G-52-5's liveDocumentMatchesRecorded), and at open."
  severity: blocker
  test: 2
  artifacts: []
  missing: []
  fix_applied: "2026-09-03 — the payload is now fingerprinted by a content TOKEN (encodeCanonicalDataUrlPayload: length + head-64 + tail-64, O(1)) instead of the full dataUrl; head+tail is change-safe for same-encoder PNG output because deflate streams have no resync points — any content change cascades to the tail (mirrors the previewRenderer.ts:114 / _trackContentRevision slice idiom, closing its same-size-PNG-header collision hole). One change point covers records AND group overrides, and every consumer (document revision, project equality, bridge re-verification, undo/redo guards) inherits it. The Rust boundary mirrors the token (script_library.rs canonical_data_url_payload) and the parity pin holds (TS vector project-416-550fa14e recomputed by cargo test). Pinned fixture vectors rotated: TS physicPaint.test.ts and Rust script_library_transaction_contract.rs / script_library_command_contract.rs. Legacy open path: parse accepts a pre-cutover full-dataUrl revision once (the D-29 exact-legacy escape idiom, extended with a modern-clips + legacy-dataUrl candidate) and re-stamps the tokenized revision — the user's pre-fix projects still open (first open pays the legacy hash once per track), the next save is on the fast path; genuinely tampered revisions still fail closed (dedicated test). Regression coverage (physicPaint.test.ts, G-52-6 describe, 6 tests): the canonical encoding never embeds the full payload (mutation-verified), equal content equal revision + tail change rotates, same-length shared-PNG-header payloads distinguish, group overrides tokenized, legacy revision accepted + re-stamped, tampered revision rejected. Full suite green (3390 passed) + tsc clean + cargo test green. NOT in this fix (structural follow-up, already in the deferred Roto cache footprint backlog): baked photo keys arguably belong in the pixel-cache as cachePath refs rather than inline dataUrls in the saved document. Awaiting re-run with the same bisection protocol: the 23s project must open in ~1-2s (after one legacy-acceptance open + re-save), and copy/delete/move/spacing/drag on a reveal rail must feel identical to paint rails."
- gap_id: G-52-7
  truth: "Opening a project with reveal rails decodes the baked PNG keys off the main thread — the Promise.allSettled hydration fan-out parallelizes real decodes, not just waits — so a 15-frame photo-weight reveal rail costs ~1-2s at open, not ~10s."
  status: failed
  reason: "User reported (code-verified): registerRotoAlphaCanvasFrameFromDataUrl (rotoCanvasFrames.ts:40-58) did new Image() → src = dataUrl → await onload → drawImage; in WebKit the onload of a data: URL fires BEFORE the PNG decodes, so the real decode ran synchronously on the main thread at the first drawImage — the Promise.allSettled fan-out in prepareRotoPhysicalRealKeyPngs (rotoCanvasFrames.ts:83-86) parallelized only the waits while 15 multi-MB photo-weight decodes serialized (~600ms each ≈ the observed ~10s). Awaited at launch (hydrateRotoPhysicalLaunchContext, rotoLaunchHydration.ts:83-89) and on every bridge apply (physicPaintBridge.ts:496). Secondary O(payload) waste: isRotoPngDataUrl ran atob over the ENTIRE multi-MB base64 body to check an 8-byte signature. At stroke scale (KB PNGs) both were invisible — the same latent scale assumption as G-52-6."
  severity: blocker
  test: 2
  artifacts: []
  missing: []
  fix_applied: "2026-09-03 — (1) registerRotoAlphaCanvasFrameFromDataUrl now decodes via dataUrl → Blob → createImageBitmap (off-main-thread decode; the existing Promise.allSettled fan-out becomes truly parallel), draws the bitmap into the registered exact-size canvas, and bitmap.close()s it in a finally (no leak on validation failure). If createImageBitmap is unavailable or rejects, the Image fallback forces the async decode with await img.decode() before any drawImage — no draw ever happens on an undecoded image. Kept unchanged: the PNG signature gate, expectedSize integer/match validation, exact-size canvas, throw-on-any-failure error contract ('Canonical Roto PNG could not be decoded.' normalized across both decode paths), and the dataUrl-keyed registry. (2) isRotoPngDataUrl probes only the first 40 base64 chars (~30 decoded bytes ≥ the 8-byte signature, whitespace-tolerant) instead of atob-ing the full body — O(1) per validation call; all consumers (PlayScript controller/bridge/reference gates) are signature-check call sites, so semantics are unchanged. No format, parser, persistence, fingerprint, or Rust-side change: the G-52-6 canonical encoder and parity vectors are untouched. Regression coverage (rotoCanvasFrames.test.ts, G-52-7 describes, 6 tests): bitmap path draws the bitmap and closes it with Image never constructed (mutation-verified — constructor throws); fallback awaits img.decode() — the canvas is not even CREATED while decode is pending and decode precedes drawImage in call order; both-paths-fail throws the canonical decode error with nothing registered; already-registered payloads skip decoding entirely; the signature probe accepts a body with invalid base64 beyond the probe window (the old full-body atob would have thrown) and still rejects non-PNG signatures / in-window invalid base64 / wrong MIME / non-data-URLs. Full suite green (3396 passed) + tsc clean. OUT OF SCOPE (user-noted): lazy/on-demand hydration rejected — the alpha canvas registry feeds the physics engine and interpolation (physicPaintStore.ts:1586, 2493-2510), so opening before canvases exist would change the render contract; the baked-photo-keys-as-cachePath-refs follow-up stays on the deferred Roto cache footprint backlog. Awaiting the native re-run: the 15-frame reveal-rail project (~10s open pre-fix) must open in ~1-2s, then copy/delete/move/spacing/drag on a reveal rail must feel identical to paint rails, plus standing Tests 1-6."
