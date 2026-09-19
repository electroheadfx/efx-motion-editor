---
status: resolved
trigger: "Playback compositing regression — after hide/show layer toggles, playback shows only the last layer added, not the composite (user-reported, suspected forbidden regression)"
created: 2026-09-11T15:20:00Z
updated: 2026-09-11T17:45:00Z
---

## Current Focus

hypothesis: RESOLVED — an armed per-track Solo on the top paint track (Paint 1), set inside the track row's collapsed ⋯ panel with no row-level indicator, filtered the lower track out of the flattened composite in both surfaces. Not a compositor regression: `participatingPaintTracks` (CMP-02 truth table) applied correctly to a persisted, invisible flag.
test: User native repro (focused steps 1-2, 2026-09-11) — step 1: lower track absent everywhere (plain paper fond where the top layer is empty → dropped from participation, not covered); step 2: 'S' was ARMED on Paint 1's collapsed row panel; un-soloing restored Track 1 immediately.
expecting: n/a — closed.
next_action: none — session closed. Follow-up quick (260911-sli) surfaces armed solo at row level and carries the pending 260911-g1g hide/solo native UAT.
bug_class: state-visibility / UX-affordance (armed persisted flag invisible outside the collapsed panel)
reasoning_checkpoint: "User evidence disproved the compositor paths: un-soloing the top track restored the lower one; hide-disarms-solo explains the hide/restore behavior."
tdd_checkpoint: null

## Symptoms

expected: During playback, all participating paint layers composite (both layers visible).
actual: During playback, only the last layer added is visible — the other layer is missing from the composite. Observed in the Studio with 2 paint layers, right after a hide/show ("deactivate/activate") layer toggle, mid-playback, and after scrubbing back.
errors: none reported
reproduction: Studio, 2 paint layers: paint → play → deactivate/activate a layer → play → scrub back; playback then shows only the last-added layer instead of the composite. (Exact repro to confirm with the user in-session.)
started: Reported 2026-09-11 on branch v1.0.0/modern-runtime-hd. Quick 260911-g1g (hide = hard off-switch / solo over visible Paint tracks, commits e3db20a7 + 12cdee36, UAT still pending) landed the same day at 11:38.

## Reporter Context

- Orchestrator quick check on 260911-g1g: the diff changes `resolvePhysicPaintTrackVisibility` (previewRenderer.ts) to arm solo only over visible tracks. Consumers: `PhysicsPaintStudio.tsx:2373` (editing-surface active-track visibility) and `:3544-3546` (`engineSurfaceHidden` — engine canvases step aside so the program monitor owns the surface). The change is inert unless a hidden+soloed track exists, and its direction RESTORES visibility — it does not drop layers. Not an obvious slip, but it is in the Studio surface-handoff path.
- Composite participation itself is `participatingPaintTracks` (efx-paint/compositor/efxPaintHideSolo.ts) — untouched by g1g; consumers: physicPaintStore.ts:1344/2074, efxPaintCompositor.ts:237, efxPaintCompositeCache.ts:117, exportEngine.ts:98.
- Suggest starting from: the playback composite path, the program-monitor surface/visibility handoff, and hide/show toggle state handling during playback.

## Guardrails

- Native repro run by the USER (project rule: Claude never launches the server/app). Native visual UAT stays with the user; no MCP Chrome DevTools.
- The working tree carries UNCOMMITTED debug state: telemetry-only stall instrumentation (dev-gated counters) plus a just-landed decode-IPC quick fix (raw request body + base64 response leg). Treat these as potential confounds only if evidence points at decoded pixel content; the reported symptom is layer participation, not pixel integrity.
- Tests: `vitest run` only (never watch).

## Eliminated

- **Store composite drops a track on hide/show (flattened record / memo poisoning).** Disproved: scratch repro (moved 2026-09-11 to `.planning/debug/scratch/__repro_playback_layer.test.ts`, out of the tsc/vitest compile path) — 2 roto tracks, flatten frame 5 (2 draws, key `flattened-171-bcfddf4f`) → hide track-b (1 draw, key `flattened-134-c2e4f966`) → show track-b (2 draws, original key/record memo hit).
- **Monitor draw path drops a track on the exact user sequence.** Disproved: scratch repro (moved 2026-09-11 to `.planning/debug/scratch/__repro_playback_monitor.test.ts`) — playback tick frame 5 (2 draws) → tick frame 6 (2) → hide track-b (1, truth table) → show track-b (2) → scrub back to frame 5 (2). Full composite on every playback tick.
- **g1g regression.** `previewRenderer.ts` `resolvePhysicPaintTrackVisibility` change is semantics-parity-pinned with `participatingPaintTracks` (previewRenderer.test.ts hide/solo parity block); direction restores visibility; composite authority untouched.
- **Playback CSS handoff class drop (engine canvases re-occluding the monitor while playing).** Structurally ruled out: `isPlaying` (Studio state) and `isActive` (hook state) are only ever written together by `useRotoCachedPlayback.start()/finishPlayback()` (sole `setIsPlaying` writer is the hook port, PhysicsPaintStudio.tsx:1739); `cachedRotoPlaybackComposition` is non-null whenever launchContext exists; therefore `cached-roto-playback-ready` cannot drop while a monitor playback draw is active.
- **Reference `<img>` overlay (z-index 1, dashed green outline) covering the monitor during playback.** Ruled out: StudioView.tsx:214 renders it only when `!cachedRotoPlaybackActive`.

## Evidence

- timestamp: 2026-09-11T17:35:00Z — DECISIVE user live observation (focused repro step 1, frame 57, both layers hold paint, both eyes ON): only Paint 1 renders; Track 1 (lower) is missing EVERYWHERE — including large areas where Paint 1 has no strokes; those areas show the plain paper fond, not an opaque fill. Hiding Paint 1 restores Track 1 fully. Playback of the broken state plays Paint 1 alone with a noticeable slowdown. Verdict: lower track dropped from participation in BOTH surfaces (preview monitor composite + playback flattened composite), not covered by an opaque raster.
- timestamp: 2026-09-11T17:38:00Z — ROOT CAUSE (focused repro step 2): the 'S' solo toggle was ARMED on Paint 1 inside the row's ⋯ panel; the row carries no armed indicator. Un-soloing restored Track 1 immediately. `participatingPaintTracks` (efxPaintHideSolo.ts:37) excluded Track 1 by the locked truth table; hide-disarms-solo (a hidden track's solo never arms) explains why hiding the top layer restored the lower one; `solo` is a persisted document field (`efxPaintDocument.ts:79`) so the armed state survives save/reopen and recurred as a "regression". Compositor, decode paths, and g1g (e3db20a7) all innocent.
- timestamp: 2026-09-11T16:45:00Z — user live observation (recorded pre-repro): with 2 paint layers, while layer 1 (TOP layer) is visible, the layer BELOW does not render — in the PREVIEW canvas as well as in playback; the lower layer only appears when layer 1 is hidden; user reports transparency/blend modes are involved. This extends the bug surface from playback-only to the always-on preview composite. If the top track's transparent areas composite as opaque, this is a violation of the v1.0 compositor rendering law ("tracks transparent between each other") and shifts the investigation off the runtime-only mechanisms A/B (keep-last-drawn monitor, eye-toggle persistence) toward the track transparency/blend truth in the composite. Focused repro for the 3 discriminator questions (frozen vs animating; which eye; eye off→on restore) scheduled right after the decode-fix commit 3d1cb4d3.

- timestamp: 2026-09-11T15:40:00Z — g1g commits (e72eab5c/e3db20a7/12cdee36) scope verified: only `previewRenderer.ts` + tests changed; `efxPaintHideSolo.ts` untouched; quick summary states the direction restores Studio live-surface visibility for hidden+soloed tracks.
- timestamp: 2026-09-11T16:05:00Z — compositor suites green: 41/41 (HideSolo, CompositeCache, CompositorMatrix) before this session's edits.
- timestamp: 2026-09-11T16:20:00Z — store-level hide/show round trip repro created and PASSED: 2 draws → hide (1 draw, key rotates) → show (2 draws, memo hit returns the original frozen record). Path: `app/src/stores/__repro_playback_layer.test.ts`.
- timestamp: 2026-09-11T17:10:00Z — full path read: `_resolveFlattenedFrame` returns null when ANY participating track's pre-resolve is null (pending decode); flattened key = config term (per-track order/visible/solo/opacity/blend via `buildEfxPaintCompositeRevision`) + participating-only content terms + `excl:`/`fond:0`/`bgsrc:` terms — visibility flips rotate the key, no stale memo hit possible.
- timestamp: 2026-09-11T17:16:00Z — decode latch identified in code: `_compositorDecode` (physicPaintStore.ts:1106) returns null while a token is in `_compositorDecodeLoading`; the `finally` bumps `physicPaintVersion` on success AND failure (failed tokens retry), but a promise that never settles leaves the token in-flight forever → every later flatten touching that payload returns null with no redraw. A failed decode retries indefinitely; only a hung invoke latches.
- timestamp: 2026-09-11T17:22:00Z — monitor-level repro (user's exact sequence) created and PASSED: F5 play 2 draws, F6 play 2 draws, F6 hidden 1 draw, F6 shown again 2 draws, F5 scrub back 2 draws. Path: `app/src/components/physic-paint/view/__repro_playback_monitor.test.ts`.
- timestamp: 2026-09-11T17:25:00Z — suites green on the current tree: 8 files / 113 tests (physicsPaintProgramMonitor, previewRenderer, compositor HideSolo/Cache/Matrix). `vitest run` only.
- timestamp: 2026-09-11T17:26:00Z — surface inventory during playback: engine canvases hidden via `.cached-roto-playback-active.cached-roto-playback-ready ... .paint-canvas > canvas { visibility: hidden }` (selector matches `.demo-canvas-shell` root rendered by PhysicsPaintCanvasMount.tsx:136); reference `<img>` unmounted; onion overlay unmounted; monitor wrapper z-index 0 is the only remaining surface in the isolated tracks group. Uncommitted tree at session time: telemetry-only stall instrumentation + decode-IPC quick fix (raw body in, base64 RGBA out) — flagged confound if the discriminator is FROZEN playback.

## Resolution

root_cause: An armed per-track Solo on the top paint track (Paint 1) filtered the lower track out of `participatingPaintTracks` (locked CMP-02 hide/solo truth table, efxPaintHideSolo.ts) in both the Studio editing surface (program monitor composite) and playback (flattened composite). The 'S' toggle lives only inside the track row's collapsed ⋯ panel and shows no armed state at row level, so the flag was invisible; hiding the top track disarmed solo arming, which is why hiding it restored the lower track. `solo` is a persisted document field, so the armed state survives save/reopen — that is how an earlier invisible arming recurred as a playback compositing regression.
fix: none in this session (diagnosis-only scope). Follow-up quick 260911-sli surfaces armed solo at row level (badge/highlight) and carries the pending 260911-g1g hide/solo native UAT.
verification: User native repro 2026-09-11 (Evidence steps 1-2): un-soloing Paint 1 restored Track 1 immediately; hide/restore behavior matched the truth table in both surfaces. Suites re-confirmed green on the current tree (compositor 41/41; monitor/renderer set 113). g1g scan verified innocent.
oracle_type: user-native-live-observation
files_changed: []
