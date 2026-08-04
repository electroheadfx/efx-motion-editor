# Pitfalls Research

**Domain:** Milestone v0.9.0 — adding hydration fix, macOS icon refresh, build hygiene, cross-window audio preview, and PlayScript static/hold + linked Loop Clips to the shipped EFX Motion Editor (Tauri 2.0 + Preact Signals monorepo)
**Researched:** 2026-08-03
**Confidence:** HIGH — grounded in the milestone spec risk register, the confirmed hydration root-cause diagnosis, the v0.7.0/v0.8.0 post-mortems in PROJECT.md, and direct inspection of the affected code seams (`usePhysicsPaintLaunchIntegration.ts`, `physicsPaintRotoPlayScriptRenderer.ts`, `physicsPaintRotoScriptClipboard.ts`, `audioEngine.ts`, `playbackEngine.ts`, `vite.config.ts`)

This document verifies and extends the spec's risk register. Every pitfall below is specific to adding THESE features to THIS system; generic advice is intentionally omitted.

## Critical Pitfalls

### Pitfall 1: Rereading a stale launch-context getter instead of consuming the event payload

**What goes wrong:**
The Scripts panel mount observes `project.saved === false`, clears rows, and skips the scan. When the later project-context event arrives with `saved=true`, `PhysicsPaintStudio.tsx:945` calls `rotoScriptLibrary.updateProjectContext()` with NO argument, so the controller rereads `getLaunchContext()` through hook ports that have not yet committed the new value. Rows clear a second time; the scan never runs. Manual Refresh "works" only because it runs after the committed render. This is the confirmed shipping regression (`usePhysicsPaintLaunchIntegration.ts:159-166`, `physicsPaintRotoScriptLibrary.ts:111-130`).

**Why it happens:**
The project-context bridge callback wraps the handoff in `setLaunchContext((current) => { ... queueMicrotask(() => onSettledLaunchContext?.(updated)); return updated; })`. The updated context IS available in the closure, but the consumer discards it and re-derives state from a getter whose freshness depends on render commit timing. A "fix" that only retries the getter (another effect, a delay) reintroduces the same race one layer down.

**How to avoid:**
- Pass the exact `updated` `PhysicPaintLaunchContext` payload from the bridge callback into the script-library update path (explicit-context handoff). Keep manual `refresh()` reading the current context.
- If a committed-state effect is used instead, it must key on stable context identity + saved state and prove it cannot double-scan or miss rapid replacements.
- Guard scans by context identity/generation so a stale event for a replaced project/layer cannot populate rows.
- Assert exactly one automatic scan per authoritative context in the owned regression test.

**Warning signs:**
Contradictory UI (Copy/Apply work while Save Script is disabled); a scan-count spy called 0 times automatically but succeeding manually; tests that only pass with `await new Promise(r => setTimeout(r, ...))` before assertions — that is the race wearing a disguise.

**Phase to address:** Phase 0 (blocking hydration fix)

---

### Pitfall 2: Timing-hack "fixes" that mask the race instead of fixing it

**What goes wrong:**
A `setTimeout`, `requestAnimationFrame`, retry loop, or poll makes the panel appear hydrated on a fast dev machine but flakes on a packaged app, a slow disk, or a project-switch. The spec explicitly forbids this; the release stop condition still triggers in native UAT.

**Why it happens:**
The race is timing-dependent, so any delay statistically favors the committed context. It feels fixed because the failure window shrinks, not because it closed. Note the irony: `queueMicrotask` inside the state updater is already a micro-timing hack and is part of the root cause.

**How to avoid:**
- Treat any added timer/poll in the Phase 0 diff as an automatic review rejection.
- The regression test must fail deterministically before the fix (the SPECS prototype repro fails in ~260-330 ms across three runs — convert it into an owned test seam under `app/src/` with the existing Vitest config; per project memory, do not create one-off test configs).
- Also verify no duplicate scan/listener after close/reopen — Tauri `listen()` returns an unlisten promise that must actually be invoked on unmount.

**Warning signs:**
New tests containing `setTimeout`/`vi.advanceTimersByTime` around the hydration path; "it passed on the second run"; UAT steps that say "wait a moment before checking."

**Phase to address:** Phase 0

---

### Pitfall 3: Two audio engines audible at once (main window + EFX Paint window)

**What goes wrong:**
Each Tauri window is a separate WebView with its own JS realm and its own `AudioContext`. The main editor's `playbackEngine.ts` starts audio via `audioEngine.play(...)`/`playDelayed(...)` per track and — critically — RESTARTS audio on every seek when playing (`playbackEngine.ts:99-102, 254-303`: `audioEngine.stopAll(); this.startAudioPlayback()`). The `physic-paint:seek-frame` bridge (G-01, quick 260801-azb) means timeline seeks propagate while EFX Paint is open. If the main-window playback engine and the new EFX Paint preview engine are both live, the user hears doubled, phase-shifted audio.

**Why it happens:**
The main editor's audio subsystem was built single-window; nothing today suppresses it when a child window monitors. Adding a second engine without defining a single preview authority re-creates the classic "two `<audio>` elements" bug in a cross-window form.

**How to avoid:**
- Declare exactly one audible authority at any moment: while EFX Paint audio monitoring is On and Paint playback is active, the main-window preview engine must not be simultaneously playing (the main window is typically paused while the user works in EFX Paint, but do not rely on "typically" — gate it).
- Single owner for the EFX Paint preview engine lifecycle: create on first monitored play, `stop()` all sources + release buffers + close/suspend the `AudioContext` on window close (AUDIO-06). Add a cleanup regression test: close EFX Paint mid-playback, assert silence and zero leaked sources.
- The session-local monitoring toggle (AUDIO-05) must only gate the local engine — never write to `audioStore` (main-editor authority, per the locked ownership boundary and the "Play globals must not overwrite per-stroke props" lesson).

**Warning signs:**
UAT step "seek, play, pause, loop, stop without drift or doubled audio" failing only when the main window was left playing; audio continuing after the EFX Paint window closes; two `AudioContext` instances visible in the same monitoring session inside the child window.

**Phase to address:** Phase 2 (audio preview)

---

### Pitfall 4: Audio/frame drift from mixing clocks and mis-mapped frame domains

**What goes wrong:**
Sustained playback drifts audible-vs-cursor, or a seek lands on the wrong audio time. Two independent causes compound here:
1. **Clock mixing.** The main editor's playback clock is `performance.now()` delta accumulation; `audioEngine` schedules on `ctx.currentTime` (`source.start(0, clampedOffset, remainingDuration)`). In the child window these are DIFFERENT time origins in a DIFFERENT realm. Driving audio position from the frame cursor every frame (or vice versa with `setInterval`) accumulates drift.
2. **Frame-domain confusion.** Four domains must be mapped: EFX Paint app frame → parent Paint layer frame → sequence-local frame → main-editor global frame, then through per-track `timelineOffset`, `trimStart/End`, `slipOffset`. This is the same source/display ambiguity class that caused the recurring Roto timing bugs before the 36.14 canonical physical-frame cutover.

**Why it happens:**
The mapping looks like "just multiply by fps," and each offset individually is small enough that off-by-one-domain bugs survive casual testing. Drift only becomes audible over sustained playback, so quick UAT scrubs pass.

**How to avoid:**
- Before implementation, write the frame/time truth table (per the project's proven "truth table before patches" rule): for each of the four domains, given cursor frame F, what audio time T plays, for a track with each offset/trim/slip combination. Lock it in the phase discussion; test every row.
- Anchor sustained playback to ONE clock: start sources at the computed offset and let the `AudioContext` clock run free; resync only on discrete events (play, seek, pause, loop wrap, stop) using the same stopAll+start-at-offset pattern the main engine already uses.
- Loop playback: on loop wrap, restart sources at the loop-start audio offset — never try to "rewind" a running `AudioBufferSourceNode` (one-shot nodes; `audioEngine.ts` already documents this as pitfall 2 in its header comments).
- Autoplay policy: the child window's `AudioContext` starts suspended until a user gesture; resume it inside the Play button handler, not at bridge-setup time, or the first playback is silently silent.
- Asset transport: audio files must reach the child window via the existing secure asset transport; a missing/unloadable asset is a non-blocking warning (AUDIO-06), never a paint-blocking error. Remember the v0.8.1 CSP precedent — new resource loads in the child window may need explicit CSP grants guarded by a contract test.

**Warning signs:**
Sync that is correct at frame 0 but late after 30+ seconds of playback; seek landing one track-offset early/late; first Play click producing no audio; loop wrap restarting from the track's beginning instead of the loop start.

**Phase to address:** Phase 2 — the truth table is a Phase 2 entry artifact, not an implementation afterthought

---

### Pitfall 5: Stale revisioned bridge updates overwriting newer audio context

**What goes wrong:**
The main editor edits audio (mute, trim, reorder) while EFX Paint is open. Updates arrive over the bridge out of order or a queued older revision lands after a newer one; the child window regresses to stale track state. This is the SAME defect class as Pitfall 1 (stale context wins over fresh), one subsystem over.

**Why it happens:**
Event delivery order across windows plus async decode (`audioEngine.decode` is async) creates interleavings where "last applied" ≠ "latest sent."

**How to avoid:**
- Carry the `revision` field from the `EfxPaintAudioPreviewContext` sketch (AUDIO-02/AUDIO-04) end-to-end; apply updates only when `incoming.revision > applied.revision`; discard otherwise.
- Reuse the identity/generation-guard pattern from the Phase 0 fix rather than inventing a second mechanism — one staleness idiom for the whole milestone.
- Apply track-list changes atomically (swap the whole revisioned context), not per-track patches that can tear mid-update.

**Warning signs:**
Muting a track in the main editor while EFX Paint plays, and the mute arriving late or reverting; a quick sequence of edits leaving the child window showing a middle state.

**Phase to address:** Phase 2 (design the guard in Phase 2; the pattern is proven in Phase 0)

---

### Pitfall 6: Off-by-one and overlap in half-open Loop Clip intervals

**What goes wrong:**
A finite loop of `cycleLength × repeatCount` overlaps the next clip by one frame, leaves a one-frame gap, or a partial-cycle interruption renders the wrong source frame. Adjacent clips flicker or double-render at the seam; save/reopen shifts boundaries by one.

**Why it happens:**
Loop effective duration is computed in at least three places (resolution, timeline filmstrip, boundary recalculation on next-clip move/remove). If any site mixes inclusive ends with exclusive ends — or computes `start + cycleLength * count` and then compares with `<=` against the next clip start — the seam frame is wrong. Partial-cycle truncation (`effectiveLength % cycleLength`) is where modulo indexing mistakes hide: occurrence `i` must resolve `sourceFrameRefs[(startOffset + i) % cycleLength]` with the offset applied BEFORE the modulo.

**How to avoid:**
- Lock the convention once: all loop regions are half-open `[startFrame, startFrame + effectiveDuration)` on canonical physical frames; the next clip's start is its first owned frame and has priority; a loop's last resolved frame is `min(nextClipStart, parentEnd, start + requestedDuration) - 1`.
- Truth-table tests before implementation (same discipline as the Roto timing fix): full cycles exactly meeting the next clip, interruption mid-cycle (partial final cycle), interruption at the exact boundary (zero partial), infinite loop to parent end, next-clip removal re-extending to requested/infinity, single-frame cycle (`cycleLength = 1`).
- One resolver function owns effective-duration computation; the filmstrip badge (`Cycle 5f × 5 = 25f`) and the interruption label (`Boucle raccourcie par le clip suivant`) both DERIVE from it — never compute display duration separately from resolution duration.

**Warning signs:**
UAT step 12 (partial-cycle interruption) passing but a one-frame gap visible when scrubbing the seam; badge showing 25f while resolution produces 24 or 26 frames; overlap only when `cycleLength` does not divide the interruption offset.

**Phase to address:** Phase 4 (convention locked at Phase 3 UI design so the filmstrip and resolver share it)

---

### Pitfall 7: Color override mutating (or appearing to mutate) the reusable source script

**What goes wrong:**
Applying a color override recolors the durable library script itself; the thumbnail and every future application of that script come out in the override color. Library data loss — a release stop condition.

**Why it happens:**
Two concrete shared-reference seams exist in the current code:
1. Scripts are deep-frozen on copy/save (`deepFreezeScript` in `physicsPaintRotoScriptClipboard.ts:890-909` — `Object.freeze` on strokes, params, continuations). In strict mode, mutating frozen params throws; in a sloppy path it silently no-ops, producing "override ignored" bugs instead of corruption — BOTH failure modes ship as user-visible defects.
2. The renderer's progressive path PASSES THROUGH the original stroke reference when `stroke.points.length === 0` (`physicsPaintRotoPlayScriptRenderer.ts:56-58`: `stroke.points.length === 0 ? stroke : transformRecordedStrokeForHeldPose(...)`). Any override applied downstream of that passthrough touches the scheduled clone or — if a schedule was ever built over unfrozen references — the source stroke.

**How to avoid:**
- Recolor at clone time: extend `flattenScriptStrokes`/`cloneStroke` so the override rewrites `params` color on the per-application clones, before scheduling. The frozen source is never in the mutation path.
- Erase strokes must retain erase behavior (PLAY-02): recolor only strokes whose params mark them as paint strokes; add a regression test mixing paint + erase strokes under an override.
- Keep the override strictly application-time: it must NOT be persisted into the script document (spec excludes persisted default overrides) and must not flow into the thumbnail pipeline.
- The override behaves identically in progressive and static/hold modes — one recolor function shared by both paths, not two implementations that can drift.

**Warning signs:**
Thumbnail changes after an overridden application; a second application with "no override" rendering in the last override color; a frozen-object TypeError in console during application.

**Phase to address:** Phase 3

---

### Pitfall 8: Non-determinism in static/hold output across save/reopen and cache regeneration

**What goes wrong:**
A held cycle looks different after reopen, or regeneration of the same script+destination+options produces different pixels. Release stop condition: "Static output changes after reopen/regeneration."

**Why it happens:**
Four candidate leaks, all present in this codebase's history:
1. **Seed drift.** Existing Script Motion determinism comes from `transformRecordedStrokeForHeldPose(stroke, { destinationSourceFrame, strokeIndex, ... })` — seeds derive from destination frame + stroke index. If static mode seeds per-occurrence (repeat index) or per-render-invocation instead, repeats differ from each other and from regeneration.
2. **Engine state bleed.** p5.brush has module-scoped internal state (the reason `vite.config.ts` excludes it from `optimizeDeps`). The current renderer already creates a fresh `EfxPaintEngine` per render and destroys it in `finally` — any static-mode optimization that reuses an engine across renders or across cycles inherits residual state.
3. **Merge-order dependence.** Static mode merges over `existingFrames` (`mergeRotoAlphaCanvases`); regenerating with a different existing-frame baseline yields different pixels — the merge baseline must be part of the deterministic contract.
4. **PNG roundtrip.** Cached frames persist as PNG alpha encodings; any lossy step (premultiplied alpha mishandling, color-space conversion) changes pixels on reopen. The Roto cache path already encodes PNG alpha; reuse it unchanged — do not add a "smaller/faster" encoding for loop sources (cache-footprint compression is explicitly deferred debt, not v0.9.0 scope).

**How to avoid:**
- Repeat occurrences NEVER re-render: they resolve to the linked source-frame references by modulo. Only the source cycle is rendered, once. This makes repeat determinism structural rather than tested-for.
- Source-cycle render must be a pure function of (script, destination start, motion params, size, existing-frame baseline): golden-pixel regression test — render twice, save/reopen, render again, assert identical bytes/alpha.
- Zero-motion static mode must produce byte-identical frames across the cycle (stable held drawing, HOLD-02).

**Warning signs:**
Golden-pixel test passing locally but failing after a cache clear; cycle frame 2 differing from cycle frame 7 when motion is zero; "fixing" a flicker by adding randomness-reducing averaging (treats the symptom).

**Phase to address:** Phase 4

---

### Pitfall 9: Reopening the dual-model seam with a third frame model for Loop Clips

**What goes wrong:**
Loop Clips are persisted and resolved against a new frame coordinate space (or against the legacy source/display seam) instead of the canonical physical-frame model. The project carries explicit debt here: "Legacy source/display model still feeds useRotoTimelineActions.getModel (inert dual-model seam)". Adding a loop-region model beside it converts inert debt into active corruption — the exact failure family that forced the 36.14 cutover and, before that, the Phase 36.2 failure.

**Why it happens:**
Loop clips touch both the EFX Paint Roto timeline (physical frames, `finalizeProposal` authority) and the main-editor timeline visualization (filmstrip capsule). It is tempting to define the loop in display/timeline coordinates because that is where the filmstrip renders.

**How to avoid:**
- Persist the `FrameLoopClip` region in canonical physical frames (`startFrame` = appFrame semantics), resolved through the same authority path as key operations; the filmstrip is a VIEW PROJECTION of the region, never a second source of truth.
- Repeat-count and infinity edits mutate loop metadata only — they must flow through the existing revision/authority guards and one Undo/Redo action (Phase 37/38 group-op precedent: atomic transaction, single pushAction).
- Do not "temporarily" route loop reads through the legacy seam with a cleanup ticket — that is precisely how the current inert seam was born.

**Warning signs:**
A loop boundary that is correct in EFX Paint but off in the main-editor filmstrip; repeat-count edits requiring source regeneration (means the region is not metadata-only); Undo needing two steps to remove one loop application.

**Phase to address:** Phases 3-4 (model decision locked in Phase 3, enforced in Phase 4)

---

### Pitfall 10: Icon pipeline regressions — upscale blur, opaque corners, SPECS-dependent preflight, macOS icon cache fooling UAT

**What goes wrong:**
1. Tauri icon tooling upscales the 794×794 source to the 1024×1024 ICNS representation and the result is soft/blurry — or someone "fixes" it by manually upscaling the source first (spec explicitly forbids), baking in the blur.
2. The rounded-square silhouette loses its alpha (flattened onto white/black during a resize step) → opaque corners on the Dock.
3. Release preflight reads the ignored `SPECS/efxmotioneditor-icon-2.png`, so the build is non-reproducible on any machine without that file (SPECS/ is git-ignored).
4. UAT "passes" or "fails" falsely because macOS caches icons aggressively — Finder/Dock show the OLD icon after replacement (or keep showing the new one after a bad rebuild).

**Why it happens:**
`tauri icon` regenerates the full platform set from one source; intermediate resizing is opaque. Icon caches (`com.apple.dock.iconcache`, IconServices) survive app replacement, especially for same-bundle-ID reinstalls.

**How to avoid:**
- Use the 794×794 alpha source directly; let the tooling generate sizes; verify legibility at 16/32/64/128/256/512 BEFORE packaging (spec checklist).
- Preflight validates only the tracked generated artifacts under `app/src-tauri/icons/` (existence, non-empty, ICNS signature, packaged `.app` icon resource) — grep the release script for `SPECS` as a contract test (currently clean; keep it that way).
- For UAT: flush icon caches or verify on the downloaded artifact (the release already requires downloaded-artifact verification — extend it to icon checks per release-contract memory: generated Tauri icons stay canonical and SPECS-independent).

**Warning signs:**
`scripts/macos-release.sh` (or a preflight helper) referencing `SPECS/`; the 1024 representation visibly softer than the 512; UAT screenshot showing the old icon on a freshly built bundle.

**Phase to address:** Phase 1 (caches/UAT verification in Phase 5)

---

### Pitfall 11: Build-hygiene cleanup breaking runtime guards, lazy chunks, or the fail-closed bundle guard

**What goes wrong:**
Mixed static/dynamic import "cleanup" converts a cycle-breaking dynamic import (stores/bridge modules) into a static one → import cycle → startup failure or undefined-at-init bindings in the packaged app. Or a Tauri/browser runtime guard (`eventApi.listen?.(...)` optional-chaining pattern from G-01) gets "simplified" and the browser fallback path dies. Or a genuine lazy chunk collapses into the entry bundle, inflating startup. Historical landmine: v0.8.0 shipped a bundle with NO `index.html` because of a plugin input interaction — `vite.config.ts` now carries the fail-closed `assertProductionBundle` guard; any build-config edit must keep that guard green and exercised.

**Why it happens:**
Vite's mixed-import warning is a reporter heuristic, not a correctness diagnosis. Mechanically converting every warned import treats a symptom list as a todo list.

**How to avoid:**
- Reproduce and snapshot the exact production warning set BEFORE changes (BUILD-02 requirement) so "fixed" and "regressed" are both measurable.
- Convert an import ONLY when provably ineffective: same module already eagerly imported AND no cycle AND no initialization-timing dependence. Prove each with a targeted build + startup test.
- BUILD-03 contract: resolved `chunkSizeWarningLimit === 1100` exactly; guard against silent re-raises; tests must not depend on content hashes or exact chunk counts.
- Never raise 1100 without measurement; never add `manualChunks`/warning filters to massage reporter output (spec explicit).

**Warning signs:**
Packaged app failing at startup while dev server works (classic cycle symptom); `pnpm build` warning count changing in BOTH directions after cleanup; the bundle guard being edited in the same commit as import changes.

**Phase to address:** Phase 1

---

### Pitfall 12: Scope creep via adapter over-reach (project-history pattern)

**What goes wrong:**
Phase 2 grows into "an audio player inside EFX Paint" (its own persistence, volume UI, track list); Phase 4 grows into "a general clip/loop system" (multi-track paint, arbitrary clip linking); the hydration fix grows into a launch-integration refactor. This is the documented project failure pattern: Phases 27-32 died of adapter over-reach; Phase 36.2 died of unbounded ambition and was superseded by the smallest trustworthy path (36.3).

**Why it happens:**
Each feature legitimately touches a deep seam (audio engine, frame resolver, launch bridge), and "while we're in here" refactors present themselves. The spec's Excluded list exists precisely because these temptations are predictable.

**How to avoid:**
- Enforce the locked ownership boundaries as review gates: EFX Paint must not import/remove/move/trim/mix/persist/export audio (read-only monitoring); no multi-track paint; no combined progressive-plus-hold scheduler (user applies two operations to adjacent ranges); no Reveal masks; no broad store-cycle refactors.
- Read-only audio transport reuses existing audio types (AUDIO-02 note) rather than defining a parallel schema "for later."
- Any dependency inversion discovered during BUILD-02 is REPORTED as separately scoped architecture work, not absorbed (spec explicit).
- Small surface, deep reuse: the milestone's wins come from reusing the deterministic Script Motion model, the atomic commit path, the finalizeProposal authority, and the audio engine scheduling — new code should be thin adapters over proven paths, which is the inverse of the 27-32 mistake.

**Warning signs:**
Phase plans whose file lists span more than two subsystems; new persisted fields without a spec line; "temporary" parallel implementations flagged for later cleanup; a phase UAT script longer than the feature's user stories.

**Phase to address:** All phases (roadmap-level guard); Phase 5 stop conditions are the enforcement backstop

---

## Moderate Pitfalls

### Pitfall M1: Infinite-loop filmstrip rendering blowup
**What goes wrong:** Timeline tries to render cells for an ∞ loop or a 10,000-frame finite loop; virtualization chokes.
**Prevention:** Filmstrip renders the source cycle + a hatched repetition band; expand linked cells only at high zoom and only within the viewport. Never materialize occurrence data per repeated frame — modulo resolution is computed, not stored.
**Phase:** 3

### Pitfall M2: Static-mode staged-render memory mis-budget
**What goes wrong:** Static/hold renders the complete stroke set per cycle frame; someone sizes the budget by requested duration (cycle × repeat) instead of cycle length, tripping `MAX_AGGREGATE_RGBA_BYTES` (512 MB) or — worse — raising the cap.
**Prevention:** Only the source cycle is staged; the existing capacity validation applies to `cycleLength` frames. Do not raise the renderer caps for loops.
**Phase:** 4

### Pitfall M3: Cancellation leaving partial loop metadata
**What goes wrong:** Abort mid-apply commits the staged source cycle but not the loop region (or vice versa) → orphaned assets or a loop resolving missing frames.
**Prevention:** Reuse the existing staged-then-atomic-commit path (HOLD-03): nothing durable until the whole operation commits; cancel/failure leaves the document unchanged; the current renderer already zeroes `staged` on error — keep that discipline through the loop-metadata write.
**Phase:** 4

### Pitfall M4: Audio decode duplication and buffer leaks in the child window
**What goes wrong:** `decodeAudioData` cannot share `AudioBuffer`s across WebViews; the child decodes its own copies (memory doubled per track), and repeated open/close cycles accumulate contexts (browsers cap concurrent AudioContexts).
**Prevention:** Decode lazily only for audible unmuted tracks in range; release buffers and close the context on window close; regression-test open/play/close × N without context-count growth.
**Phase:** 2

### Pitfall M5: Revision-guarded audio updates racing in-flight decodes
**What goes wrong:** A newer context revision is applied while an older track's async decode completes late and starts playback with stale parameters.
**Prevention:** Tag decode jobs with the revision that requested them; on completion, discard if the applied revision has moved on (same generation-guard idiom as Pitfalls 1/5).
**Phase:** 2

### Pitfall M6: Next-clip move/remove not re-resolving loops
**What goes wrong:** Moving the next clip later leaves the loop visually truncated at the old boundary until some unrelated refresh.
**Prevention:** Effective duration is derived (computed from clip positions at resolve/render time), never cached as mutable state; moving/removing the next clip only bumps revision and the loop re-derives. Test: move → expand, remove → extend to parent end, WITHOUT source regeneration.
**Phase:** 4

### Pitfall M7: Monitoring toggle leaking into project data
**What goes wrong:** The session-local Audio Preview On/Off gets persisted into the `.mce` or mutates main-editor mute state.
**Prevention:** Follow the `soloStore` precedent (session-only state, zero persistence); toggle gates only the child-window engine; contract test that main-editor `audioStore` snapshots are byte-identical before/after toggling.
**Phase:** 2

### Pitfall M8: Shortcut conflicts in the new controls
**What goes wrong:** New PlayScript/audio-toggle keybindings fire while typing in inputs or clash with paint-mode keys.
**Prevention:** Project rule — global shortcuts must check `isPaintEditMode()` and guard input focus (documented S-key debt exists from v0.6.0; do not add a second instance).
**Phase:** 3

## Minor Pitfalls

### Pitfall m1: Shipping the banned term `clip bloquant`
**Prevention:** UI copy gate: `clip suivant — interrompt la boucle` / `Boucle raccourcie par le clip suivant` only; grep for the banned string in Phase 3 review. (User-facing copy is French; GSD artifacts stay English per project convention.)
**Phase:** 3

### Pitfall m2: Requested vs effective duration hidden from the user
**Prevention:** Badge always shows requested (`Cycle 5f × 5 = 25f` or `× ∞`); the shortened state is a distinct visual + label. Both derive from the single resolver (Pitfall 6).
**Phase:** 3

### Pitfall m3: ICNS validated only by existence
**Prevention:** Preflight checks the ICNS magic signature and packaged `.app` icon metadata, not just non-zero file size (BUILD/ICON contract tests already pattern this via the bundle guard).
**Phase:** 1, 5

### Pitfall m4: Budget documentation drift
**Prevention:** The 1100 rationale (packaged desktop app, local assets, not a performance claim) lives next to the config value as a comment AND in the build docs; a test pins the resolved value.
**Phase:** 1

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| `setTimeout`/rAF retry on hydration | Panel "works" in dev | Flaky packaged behavior; release stop condition | Never (spec-locked) |
| Rereading `getLaunchContext()` "just once more" | No signature changes | Same stale-read class persists; next consumer repeats the bug | Never — fix the handoff |
| Raising `chunkSizeWarningLimit` past 1100 | Warning silenced | Silent bundle growth | Only with measurement attached |
| Global suppression of mixed-import warnings | Clean reporter output | Real cycle-breaking regressions hidden | Never (spec-locked) |
| Persisting the audio monitoring toggle | Survives restart "for free" | Session-local preview state becomes project data; ownership boundary breached | Never — session-local by spec |
| Materializing loop repetitions as durable frames | Simpler resolver | Asset duplication, inconsistent edits across occurrences, cache bloat | Never — linked references are the feature |
| Raising PlayScript renderer memory caps for static mode | Big cycles succeed | OOM on real projects; masks a sizing bug | Never — budget by cycle length |
| Routing loop reads through the legacy source/display seam | Faster Phase 4 | Third model; repeats the 36.2/36.14 pain | Never — extend canonical model |
| Reusing one EfxPaintEngine across static renders | Faster render | p5.brush module-state bleed → non-determinism | Never — fresh engine per render (current contract) |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Tauri cross-window events (`physic-paint:*`) | Fire-and-forget emits; unawaited unlisten on unmount | Revisioned payloads, identity guards, awaited unlisten; native `listen` branch + browser fallback both preserved (G-01 pattern) |
| Asset transport to child window (audio files) | Assuming the main window's asset protocol/CSP grants apply | Explicit secure transport; CSP grant guarded by contract test (v0.8.1 `img-src data:` precedent) |
| Web Audio in second WebView | One `AudioContext` assumption; gesture-less autoplay | Per-window context, resume inside user-gesture handler, close on window close |
| `audioEngine` one-shot sources | Seeking by rewinding a running source | stopAll + `play(trackId, offset, ...)` restart (existing `playbackEngine` pattern) |
| Deep-frozen script documents | Mutating frozen `params` for overrides | Clone-then-recolor at application time; erase strokes exempt |
| `finalizeProposal` authority | Loop ops bypassing the single mutation path | Loop region edits are atomic acknowledged transactions like Phase 37 group ops |
| `.mce` persistence | Writing migration shims for old projects | Clean break per project rule (no legacy migration code) — but reopen determinism is mandatory |
| Tauri icon tooling | Manual 1024 upscale of the 794 source | Use source as-is; verify generated sizes visually |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Per-frame filmstrip cells for long/∞ loops | Timeline jank at high repeat counts | Hatched band + viewport-windowed expansion | Loop beyond a few hundred frames |
| Decoding all audio tracks eagerly in child window | Slow EFX Paint open with audio-heavy projects | Lazy decode of audible in-range tracks only | Projects with many/long tracks |
| Audio seek-restart churn during scrub | Clicking/garbled audio while dragging the cursor | Throttle/coalesce seek-restart; single pending restart (main engine already restarts per seek — do not worsen it) | Rapid scrubbing |
| Static-mode staging sized by requested duration | RangeError or OOM on long loops | Stage cycle length only; repetitions are references | `cycleLength × repeat` ≫ cycle |
| Bundle guard weakening during import cleanup | Incomplete bundle ships (v0.8.0 repeat) | `assertProductionBundle` untouched; BUILD-03 tests extended not replaced | Any vite.config edit |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Loosening CSP in the child window to load audio "quickly" | Packaged-app XSS surface; repeats the v0.8.1 CSP scramble | Explicit minimal grant + contract test (img-src data: precedent) |
| New IPC/transport command without payload validation | Malformed audio context crashes the child window | Validate revisioned payload at the bridge boundary; reject stale/unknown revisions |
| Preflight reading user-controlled SPECS path | Non-reproducible/tampered release input | Tracked generated icons are the only release authority |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| `clip bloquant` wording | User thinks a clip is an error/obstacle | `clip suivant — interrompt la boucle` explains the mechanism |
| Loop silently shortened | User exports fewer frames than requested | `Boucle raccourcie par le clip suivant` label + diagonal end cap |
| Monitoring toggle indistinguishable from track mute | User fears muting the project | Label it "Audio Preview: On/Off", local scope stated in tooltip |
| Contradictory Scripts panel (Copy/Apply work, Save disabled) | User distrusts the whole panel | Phase 0 fix; contradictory-state regression test |
| Icon legibility only checked at 512px | Unreadable Dock/Finder icon ships again | Multi-size review (16→512) BEFORE packaging |

## "Looks Done But Isn't" Checklist

- [ ] **Hydration:** Works on first open — but is the scan-count exactly one after close/reopen × 3, and does a stale replaced-project event leave rows empty? Verify with the generation-guard test, not just the happy path.
- [ ] **Audio sync:** Correct at frame 0 — verify at 30s+ sustained playback, after a mid-play seek, and across a loop wrap. All three are separate failure modes.
- [ ] **Audio cleanup:** Playback stops on pause — verify sources are released and the context closed on WINDOW close (leak test with repeated open/play/close).
- [ ] **Color override:** Override renders correctly — verify the source script JSON on disk is byte-identical before/after, and erase strokes still erase.
- [ ] **Loop clips:** Badge says 25f — verify the resolver produces exactly 25 frames, only 5 durable assets exist, repeat-count edit regenerates nothing, and save/reopen preserves all of it.
- [ ] **Partial-cycle interruption:** Boundary case interrupts mid-cycle — also verify interruption exactly AT a cycle boundary (zero partial) and a 1-frame cycle.
- [ ] **Determinism:** Two renders match — also verify after cache clear and after save/reopen (three comparisons, not one).
- [ ] **Icon:** New icon in the built bundle — verify in Finder, Dock, App Switcher, DMG on the DOWNLOADED artifact (icon caches lie on dev machines).
- [ ] **Import cleanup:** Warnings gone — verify the packaged app starts (cycles only fail at runtime) and the bundle guard test suite is green unchanged.
- [ ] **Monitoring toggle:** Silences preview — verify main-editor `audioStore` snapshot is untouched and export is unchanged.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Timing-hack hydration merged | MEDIUM | Revert to explicit-payload handoff; the owned regression test (fail-before-fix) makes the revert safe |
| Doubled audio in the field | MEDIUM | Hot-gate: force main-window engine stop while child monitoring active; proper single-authority fix in patch |
| Loop interval off-by-one post-release | HIGH | Resolver is pure/derived — fix the one function; persisted regions are physical-frame based so no data migration |
| Source script mutated by override | HIGH (data loss) | Deep-freeze already throws in strict paths; restore script from project scripts folder backups; ship clone-time recolor fix |
| Non-deterministic static output | HIGH | Re-derive determinism at the seed (destination+strokeIndex); invalidate affected caches; golden-pixel gate before re-release |
| Icon regression after release | MEDIUM | Generated icons are tracked — revert the icon directory, re-run preflight, re-sign (release pipeline already handles this) |
| Import cleanup cycle in packaged app | MEDIUM | Revert the specific import conversion; the pre-change warning snapshot identifies exactly which conversions were made |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1. Stale getter reread | Phase 0 | Owned regression: exact-payload handoff, one scan, rows populate, `canSave === true` |
| 2. Timing hacks | Phase 0 | Diff review rejects timers; test fails deterministically pre-fix |
| 3. Doubled audio engines | Phase 2 | Single-authority gate + close-cleanup leak test; native UAT step 6 |
| 4. Drift / frame-domain mapping | Phase 2 | Locked truth table; sustained-playback, seek, loop-wrap sync tests |
| 5. Stale audio revisions | Phase 2 | Revision-guard tests incl. in-flight decode race (M5) |
| 6. Half-open interval off-by-one | Phase 4 (convention locked Phase 3) | Boundary truth-table tests incl. exact-boundary and 1-frame cycle |
| 7. Source-script mutation via override | Phase 3 | Byte-identical source script assertion; erase-preservation test |
| 8. Static/hold non-determinism | Phase 4 | Golden-pixel × 3 comparisons (rerender, cache-clear, save/reopen) |
| 9. Third frame model | Phases 3-4 | Loop regions in canonical physical frames; one Undo per operation |
| 10. Icon pipeline | Phase 1 (UAT Phase 5) | Multi-size review; preflight greps clean of SPECS; downloaded-artifact check |
| 11. Build hygiene regressions | Phase 1 | Pre-change warning snapshot; packaged-startup test; budget pinned at 1100 |
| 12. Scope creep / adapter over-reach | All (roadmap guard) | Phase file-list review; Phase 5 stop conditions |
| M1-M8 moderate pitfalls | Per pitfall (mostly 2/3/4) | Per-pitfall tests listed above |

## Sources

- `SPECS/milestone-v0.9.0-plan.md` — risk register (verified and extended here), locked ownership boundaries, stop conditions (HIGH confidence — user-approved spec)
- `SPECS/quick-prompts/fix-efx-paint-script-library-auto-hydration.md` — confirmed root-cause diagnosis with file/line references and deterministic repro (HIGH)
- `.planning/PROJECT.md` — Key Decisions and post-mortems: Phases 27-32 adapter failure, Phase 36.2 superseded, 36.14 canonical physical-frame cutover, G-01 Tauri listen branch, v0.8.1 CSP fix, Phase 38.1 canvas-first navigation (HIGH)
- Code inspection: `app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.ts:154-166` (queueMicrotask-in-updater handoff), `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts:50-107` (clone discipline, empty-points passthrough, engine lifecycle, memory caps), `app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts:890-909` (deep-freeze), `app/src/lib/audioEngine.ts` (one-shot sources, ctx.currentTime scheduling), `app/src/lib/playbackEngine.ts:99-102,254-303` (seek-restart pattern), `app/vite.config.ts` (fail-closed bundle guard, p5.brush optimizeDeps exclusion rationale) (HIGH)
- User memory: truth-table-before-patches rule, no backward-compat migrations, no test-config hacks, session-local soloStore precedent, release icon contract, incremental engine integration rule (HIGH)

---
*Pitfalls research for: EFX Motion Editor milestone v0.9.0 (feature-addition pitfalls on a shipped Tauri 2.0 + Preact Signals desktop app)*
*Researched: 2026-08-03*
