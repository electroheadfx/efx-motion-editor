# Phase 51: Read-only Audio Preview - Context

**Gathered:** 2026-09-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Preserve synchronized listening to main-editor audio while playing the EFX Paint multi-track frame document. While the EFX Paint Studio plays the v1.0 multi-track frame document, the user hears the main-editor audio read-only, synced to the shared application-frame cursor — across seek, loop, pause, resume, and stop — without ever mutating source audio and without doubled playback. The phase delivers: re-audit of the Phase 41 audio-preview path against the v1.0 document/launch/cursor, targeted re-wiring of the two known gaps (seek→audio anchor, pause→stop), regression tests, and native UAT. It does NOT add new audio surface, new playback controls, or any audio editing/persistence.

**Naming contract (locked by user, carried from Phases 45/46/47/48/49/50):** "EFX Paint" = the inline main-editor Basic/FX layer (out of scope, unchanged). "EFX Physic Paint" = the independent module + Studio window — the sole target of v1.0.0 and this phase.

**Copy language (carried from Phase 47):** All user-facing copy is **English**.

**Current state:** The Phase 41 read-only audio monitoring system (`app/src/components/physic-paint/audio/`) is comprehensive, test-encoded, and structurally survived the v1.0 cutover — the launch embed, push-on-change publisher, ownership listener, and child integration are still wired, and the audio monitor is driven by the same `useRotoCachedPlayback` + Program Monitor `playbackTick` that plays the flattened multi-track composite. Two gaps were found by scouting: `positionedAt` (silent scrub) has zero production callers (the v1.0 ruler seek / cursor navigation path is not wired to the audio anchor), and the Studio playback has no pause (Play/Stop only) while AUD-04 explicitly lists pause/resume.

</domain>

<decisions>
## Implementation Decisions

### Carried forward from Phase 41 (LOCKED — do not re-litigate)
The frame→audio truth table (`.planning/milestones/v0.9.0-phases/41-efx-paint-audio-preview-monitoring-toggle/41-FRAME-AUDIO-TRUTH-TABLE.md`) is a locked entry artifact, test-encoded in `efxPaintAudioPreview.test.ts`. Every Phase 51 monitoring behavior derives from it:
- **Frame identity:** Paint `appFrame` IS the main-editor global frame — zero translation, zero offset, zero re-basing between windows.
- **Audible window:** half-open `[track.offsetFrame, track.offsetFrame + (track.outFrame - track.inFrame))`, capped at the Paint playback-range end (`effectiveEnd = min(trackEndOnTimeline, playbackRangeEnd)`), never `totalFrames`.
- **Source-offset math:** mirrors `playbackEngine.ts:192-224` verbatim (Case A immediate / Case B delayed / Case C null), using `projectFps` from the payload, not the child playback fps.
- **Revision discipline:** monotonically increasing integer owned by the main-side publisher; strict newer-than guard; single application funnel; same-revision re-delivery is a defined no-op.
- **Drift policy:** audio free-runs on the Web Audio clock after a seek-aligned start; throttled check (~every 10 ticks); full seek-restart only when `|expected - actual| > 40ms`; any position discontinuity (seek while playing, loop wrap, mid-playback revision update, toggle-On resume) is always a full seek-restart, never a nudge.
- **FPS-mismatch:** sync guaranteed when child playback fps == project fps (the default); otherwise a non-blocking status note, no `playbackRate` scaling, no pitch shift.
- **Ownership:** first-player-wins doubled-audio guard (D-05/D-06) — the child claims on its first audio start; a later main-editor start suppresses itself with a note, and vice versa; auto-resume at the live cursor on re-claim.
- **Toggle:** session-local, default On, resets on each window open; never persisted (AUDIO-05 prohibition).
- **Engine release:** closing Studio stops all sources and closes the AudioContext (D-08); a closed context is never reused.
- **Transport:** audio bytes travel via the `efxasset://` single-token CSP grant (D-04, contract-tested); the child never imports `audioStore`/`timelineStore`/`playbackEngine` (AUDIO-01 authority boundary).
- **Track hide/solo does not alter audio** unless a separately explicit monitor rule is locked (spec §Phase 7) — no such rule is added in Phase 51.

### Pause & Resume (AUD-04)
- **D-01:** **Map pause→stop.** AUD-04's "pause, resume" is satisfied by the stop→play boundary: pause/stop releases audio through the single stop funnel (`efxPaintAudioMonitor.stop()`), and resume = pressing Play re-anchors audio at the cursor (`playAtCursor`). **No new Studio Pause control is added** — the Studio playback engine (`useRotoCachedPlayback`) keeps its Play/Stop/loop/fps surface. — **Reversibility:** reversible — adding a real Pause later is additive (freeze frame timer + audio anchor, resume in place).

### Scrub audio (AUD-04 seek)
- **D-02:** **Wire the locked silent-scrub rule into the v1.0 seek path.** The v1.0 ruler seek / cursor navigation (260827-s52 `onSeek` → `onNavigateToSyncedFrame`) currently has zero audio wiring (`positionedAt` has no production callers). Phase 51 wires it per the locked truth table: seek-while-idle → `positionedAt(cursorAppFrame)` (silent anchor re-position, no sound); seek-while-playing → full seek-restart (`playAtCursor` at the new cursor). No new monitor rule, no new UI. — **Reversibility:** reversible.

### Studio audio UI
- **D-03:** **Reuse the Phase 41 surface as-is.** The monitoring toggle (Volume2/VolumeX in `PhysicsPaintWorkflowStrip`) + capsule notes (fps-mismatch, ownership suppressed/auto-resume via `publishStatus`) are kept exactly as they are. Phase 51 only re-verifies their placement in the new multi-track Studio during native UAT. No new audio status readout, no new UI surface. — **Reversibility:** reversible.

### Primary work / scope
- **D-04:** **Re-audit + targeted re-wire.** Phase 51 is planned as: (1) a focused re-audit of the Phase 41 audio path against the v1.0 document/launch/cursor — the user runs the app to confirm what still works today (launch embed, push-on-change, ownership, release-on-close, playback-driven monitoring); (2) targeted re-wiring of the two known gaps (seek→`positionedAt`/`playAtCursor`; pause→stop); (3) regression tests; (4) native UAT. The audit is a verification step, not a rebuild — the infra is assumed to have survived but must be proven before building on it.

### Claude's Discretion
- Exact wiring shape for the v1.0 seek path into the monitor (where `positionedAt`/`playAtCursor` are invoked from the ruler seek and cursor-navigation handlers).
- Exact re-audit checklist and which v1.0 seams (launch embed fps/cursor, push revision, ownership listener, release-on-close) get contract tests vs. manual verification.
- Whether the re-audit surfaces any v1.0 regression that needs a fix beyond the two known gaps (e.g., launch embed dropped, push path broken) — those become plan tasks.
- The playback-range end / loop-window cap derivation for the multi-track context (getFrames spans the full contiguous `0..playbackEndFrame` range; audio caps at `playbackEndFrame`).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked spec (source of truth)
- `SPECS/milestone-v1.0.0-plan.md` §Phase 7 "Read-only audio preview across internal tracks" — objective, requirements, acceptance (main audio authoritative/read-only; all tracks share one application-frame cursor; audio follows it; local On/Off no mutation; track hide/solo does not alter audio unless an explicit monitor rule is locked; closing releases; no doubled playback engine). Also §"Audio preview" (the four locked rules), §"Ownership boundaries" (Main editor owns audio tracks/assets/offsets/trim/volume/mute/fades/persistence/export mixing), §"Forbidden sequence-level assumptions", §"Release stop conditions" ("Audio preview mutates main-editor audio or drifts"), §"Risk register" ("Audio preview owns copied audio state → Drift and mutation → Read-only revisioned context"), §"Integrated acceptance" (Native UAT step 6: "Play internal tracks with synchronized main-editor audio").

### Locked Phase 41 truth table (entry artifact)
- `.planning/milestones/v0.9.0-phases/41-efx-paint-audio-preview-monitoring-toggle/41-FRAME-AUDIO-TRUTH-TABLE.md` — the LOCKED frame→audio truth table (sections 1-6: frame identity, audible window, source-offset math, revision discipline, drift policy, fps-mismatch policy). Every Phase 51 monitoring behavior derives from it; divergence is a defect.

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` §AUD — AUD-01..AUD-04 mapped to this phase.
- `.planning/ROADMAP.md` §Phase 51 — goal, success criteria, "Depends on: Phase 47 (shared application-frame cursor)".

### Prior phase context
- `.planning/phases/50-photo-reference-track/50-CONTEXT.md` — the v1.0 model state, naming contract, English copy, clean-break format discipline.
- `.planning/phases/49-fixed-background-track-and-imported-loop-clips/49-CONTEXT.md` — Background track / Loop Clip model, library asset IDs, fail-closed missing-source.
- `.planning/phases/48-internal-compositor-and-flattened-parent-result/48-CONTEXT.md` — the flattened composite seam, program monitor, playbackTick resolution during playback.
- `.planning/phases/47-internal-multi-track-timeline-filmstrip-capsules-and-control/47-CONTEXT.md` — the shared application-frame cursor dependency, track identity rules.
- `.planning/phases/46-track-local-paint-roto-playscript-state-loop-clips-and-cache/46-CONTEXT.md` — track-local state, revisions, undo-by-reference.

### Code anchors
- `app/src/components/physic-paint/audio/` — the entire Phase 41 audio preview module: `efxPaintAudioMonitor.ts` (monitor: playAtCursor/positionedAt/notifyLoopWrap/checkDrift/stop/release/toggle funnel), `efxPaintAudioPreviewContext.ts` (payload parse + revision guard + resolveTrackPlayback), `efxPaintAudioPreviewStore.ts` (session-local toggle), `efxPaintAudioOwnership.ts` (first-player-wins guard), `efxPaintAudioPreview.test.ts` (RED suite encoding the truth table).
- `app/src/components/physic-paint/hooks/useRotoCachedPlayback.ts` — the playback hook that drives the audio monitor (prepare/playAtCursor/notifyLoopWrap/checkDrift/stop); the v1.0 multi-track playback still routes through it.
- `app/src/components/physic-paint/hooks/useRotoNavigationCoordinator.ts` — builds `getFrames` (full contiguous `0..playbackEndFrame`), owns the playback session.
- `app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.ts` — child hydration of the audioPreview section + push/ownership listeners.
- `app/src/components/physic-paint/bridge/usePhysicsPaintParentBridge.ts` — `useEfxPaintAudioContextBridge` (push event wiring).
- `app/src/lib/physicPaintBridge.ts` — main side: `buildPhysicPaintAudioPreviewSection`, `publishPhysicPaintAudioContext`, `installPhysicPaintAudioContextPublisher`, `installPhysicPaintAudioOwnershipListener`.
- `app/src/components/physic-paint/bridge/physicsPaintLaunchContext.ts` — launch payload validation incl. the `audioPreview` section.
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` — ruler seek (260827-s52 `onSeek` → `onNavigateToSyncedFrame`), Play/Stop + loop/fps controls, the Audio Preview toggle (Volume2/VolumeX).
- `app/src/components/physic-paint/view/PhysicsPaintProgramMonitor.tsx` — the v1.0 program monitor consuming `playbackTick`.
- `app/src/lib/audioEngine.ts` — the shared Web Audio engine singleton (one per child webview, D-08).
- `app/src/lib/playbackEngine.ts` — main-editor playback; the source-offset math the truth table mirrors.
- `app/src/stores/audioStore.ts` — main-editor audio authority (mute/trim/volume state the payload reflects).
- `app/src/types/physicPaint.ts` — `EfxPaintAudioPreviewContext` / `EfxPaintAudioPreviewTrack` types + guards.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- The entire `app/src/components/physic-paint/audio/` module — the Phase 41 monitor, context parser/revision guard, session toggle, and ownership guard are production-ready and test-encoded; Phase 51 re-uses them, it does not rebuild them.
- `efxPaintAudioPreview.test.ts` — the RED suite encoding the locked truth table; Phase 51 extends it for the v1.0 seek/pause wiring.
- `buildPhysicPaintAudioPreviewSection` + `installPhysicPaintAudioContextPublisher` + `installPhysicPaintAudioOwnershipListener` (physicPaintBridge.ts) — the main-side launch embed + push-on-change + ownership plumbing.
- `useRotoCachedPlayback` + `useRotoNavigationCoordinator` — the playback drive path the audio monitor already hooks.
- The ruler seek (260827-s52) — the v1.0 seek surface to wire into the monitor (D-02).

### Established Patterns
- Read-only revisioned context: the child never owns copied audio state; all track data arrives via the validated payload (AUDIO-01 authority boundary).
- First-player-wins ownership with auto-resume and suppression notes (D-05/D-06).
- Fail-closed validation: `parseEfxPaintAudioPreviewSection` rebuilds a canonical plain-data copy; never throws, never partially applies.
- Session-local toggle (soloStore-shaped, D-13): default On, resets per window open, never persisted.
- `efxasset://` single-token CSP grant (D-04), contract-tested.
- English copy everywhere (Phase 47 correction).
- Signals-only state (efx-preact-reactivity skill): the monitor holds module refs, not signals; the toggle is a signal; playbackTick is a signal written once per tick.

### Integration Points
- `useRotoCachedPlayback.ts` — where `playAtCursor`/`notifyLoopWrap`/`checkDrift`/`stop` are already called; the v1.0 playback drive.
- The v1.0 seek path (`PhysicsPaintWorkflowStrip` ruler seek → `onNavigateToSyncedFrame`) — the D-02 wiring point for `positionedAt`/`playAtCursor`.
- `usePhysicsPaintLaunchIntegration.ts` — the child hydration + push/ownership listener mount.
- `physicPaintBridge.ts` — the main-side publisher; re-audit target for v1.0 fps/cursor correctness.
- Window close → `efxPaintAudioMonitor.release()` — the AUD-03 resource-release seam to re-verify.

</code_context>

<specifics>
## Specific Ideas

- The user's core value: while playing the multi-track animation in the Studio, hear the main-editor audio synced to it — animate to the beat. The Phase 41 system already delivers this; Phase 51 proves it still holds on the v1.0 document and closes the seek/pause gaps.
- The two known gaps found by scouting: `positionedAt` (silent scrub) has zero production callers; the Studio playback has no pause while AUD-04 lists pause/resume.
- The user runs the app (Claude does not run the server) — the re-audit's "what still works today" is confirmed by the user during native UAT, not by Claude.

</specifics>

<deferred>
## Deferred Ideas

- **Optional audible-scrub mode** — a new monitor rule + toggle to hear a short audio snippet while scrubbing (beat-synced animation aid). Not chosen in Phase 51; the locked silent-scrub rule stays. Future enhancement.
- **Real Studio Pause control** — freeze frame timer + audio anchor, resume in place. Not chosen; pause maps to stop (D-01). Additive if ever wanted.
- **Audio status readout in the Studio** (right panel / monitor corner showing active audio tracks + sync state). Not chosen; the Phase 41 toggle + capsule notes are reused (D-03).
- **Independent EFX Paint audio editing or persistence** — already out of scope (REQUIREMENTS.md FUT-07 / Out of Scope: "Audio is read-only main-editor monitoring only").

</deferred>

---

*Phase: 51-read-only-audio-preview*
*Context gathered: 2026-09-02*
