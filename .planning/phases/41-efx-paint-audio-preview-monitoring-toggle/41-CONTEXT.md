# Phase 41: EFX Paint Audio Preview + Monitoring Toggle - Context

**Gathered:** 2026-08-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver read-only, frame-synchronized monitoring of the main editor's audio arrangement inside the EFX Paint standalone window, plus a session-local Audio Preview On/Off toggle. Users hear the main editor's audio tracks at the correct Paint frame cursor position while playing Paint/Roto frames; muted main-editor tracks stay inaudible; seek/pause/resume/loop/stop stay synchronized without drift or doubled audio. EFX Paint creates no independent audio records and never mutates main-editor audio state or export.

Requirements: AUDIO-01..06 (REQUIREMENTS.md). Source spec: `SPECS/milestone-v0.9.0-plan.md` §"Phase 2 — Read-only audio preview inside EFX Paint".

**Entry artifact (locked by roadmap):** frame→audio truth table — paint appFrame == main-editor global frame, covering per-track offset/trim/slip combinations — written and tested BEFORE implementation. Main editor remains sole authority for audio IDs, assets, offset, trim, volume, mute, fades, ordering, persistence, and export mixing.

</domain>

<decisions>
## Implementation Decisions

### Audio context transport (AUDIO-02, AUDIO-04)

- **D-01:** Extend the Phase 39 exact-payload revisioned bridge handoff: the audio preview context (revision, fps, per-track timing/gain state) becomes another section of the launch/session payload. One channel, one revision discipline — no dedicated audio channel or separate revision counter.
- **D-02:** Push on every change: the main editor emits an authoritative context event whenever audio state changes while EFX Paint is open; EFX Paint applies an update only if its revision is newer, and drops stale events silently. No launch-snapshot-only or manual-refresh behavior.
- **D-03:** Mid-playback revisioned updates restart audio at the current Paint cursor using the new context — what the user hears always reflects the latest main-editor state (no "apply on next play" deferral).
- **D-04:** Asset transport uses ONLY the existing secure Tauri asset protocol — **Reversibility:** one-way — the user's directive locks a security boundary: context payloads carry opaque asset IDs or protocol URLs; no absolute filesystem paths and no raw audio bytes cross the bridge; EFX Paint fetches through the established asset-resolution authority and decodes locally via the existing Web Audio path. Explicitly forbidden: base64 or `data:` URLs for audio; reusing the v0.8.1 `img-src data:` grant for audio; speculative CSP broadening; unrestricted filesystem paths. Any CSP adjustment must be the single narrow directive proven necessary by a failing packaged-app test, without changing the existing image CSP contract.

### Doubled-audio guard policy (AUDIO-06)

- **D-05:** First-player wins: whichever window starts playing audio first owns monitoring; starting playback in the other window while one is already audible is a no-op for audio (visual playback still proceeds). Deterministic, no mixing.
- **D-06:** When EFX Paint audio is suppressed by the guard, show a small non-blocking status note (e.g. "Audio playing in main editor") in the playback/status area — never silent suppression.
- **D-07:** Auto-resume on stop: when the main editor stops while EFX Paint is still visually playing and the toggle is On, monitoring resumes at the current Paint cursor and the suppressed status clears.
- **D-08:** Single audio engine instance per EFX Paint window; fully stopped and released on close; re-hydration and revisioned updates reuse the same instance — a second engine is never spawned.

### Scrub/seek audio behavior (AUDIO-03)

- **D-09:** Silent scrub, play-only audio: dragging/scrubbing the Paint cursor produces no audio; each scrub leaves the engine positioned at the cursor, ready for Play. Matches main-editor scrub behavior; no NLE-style scrub auditioning.
- **D-10:** Free-run + drift-threshold correction: audio free-runs on the Web Audio clock after a seek-aligned start; the engine corrects only when measured drift exceeds a small threshold (~40ms / one frame). No per-frame re-sync chatter against the frame-sync architecture.
- **D-11:** Loop wraps re-seek audio: the EFX Paint loop range maps to the corresponding audio time window; each loop wrap re-seeks audio to the mapped start via the normal seek path. Source audio metadata is never touched.

### Toggle placement + default (AUDIO-05)

- **D-12:** The Audio Preview On/Off toggle is a compact speaker/monitor icon button next to the Play/loop controls in the EFX Paint playback area, following the Phase 36.15 approved guarded-icon-with-tooltip pattern.
- **D-13:** Default On per session: session-local state, resets to On on each EFX Paint open; nothing persisted to project data or app config (mirrors soloStore session-only precedent).
- **D-14:** Immediate effect mid-playback: toggling Off silences audio immediately while visual playback continues; toggling On resumes audio at the current Paint cursor without restarting visual playback.

### Claude's Discretion

- Exact drift-measurement mechanics and the precise correction threshold within the ~1-frame budget (D-10).
- Exact visual form of the suppressed-status note within the existing status/capsule conventions (D-06).
- How the existing `app/src/lib/audioEngine.ts` per-track offset/trim/delay math is reused or adapted for the EFX Paint window (researcher/planner territory — reuse rather than rewrite).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Spec + requirements (locked WHAT)
- `SPECS/milestone-v0.9.0-plan.md` §"Phase 2 — Read-only audio preview inside EFX Paint" — locked AUDIO-01..06 spec text, illustrative `EfxPaintAudioPreviewContext` interface, and audio acceptance list
- `.planning/REQUIREMENTS.md` — AUDIO-01..06 requirement statements
- `.planning/ROADMAP.md` §"Phase 41" — goal, success criteria, and the locked frame→audio truth-table entry artifact

### Existing seams to extend (read before editing)
- `app/src/components/physic-paint/bridge/physicsPaintLaunchContext.ts` — Phase 39 exact-payload revisioned handoff idiom that D-01 extends
- `app/src/components/physic-paint/bridge/physicsPaintBridgeTransport.ts` — bridge transport between main editor and EFX Paint window
- `app/src/components/physic-paint/bridge/usePhysicsPaintParentBridge.ts` — parent bridge hook consuming launch/session context
- `app/src/lib/audioEngine.ts` — existing main-editor audio engine (per-track play/playDelayed/stopAll, offset/trim math) — reuse candidate for monitoring
- `app/src/lib/playbackEngine.ts` — main-editor playback↔audio sync (seek-restart pattern, track iteration, max-frame capping)
- `app/src/stores/audioStore.ts` — authoritative AudioTrack signal store (IDs, offsets, trim, volume, mute, fades)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/src/lib/audioEngine.ts`: existing track playback primitives (`play`, `playDelayed`, `stopAll`) with offset/trim/volume handling — the EFX Paint monitor should reuse this math rather than reimplement it
- `app/src/lib/playbackEngine.ts`: proven seek-restart audio pattern (stopAll + restart at new position on seek while playing) — direct template for D-03 mid-playback restarts and D-11 loop-wrap re-seeks
- `app/src/components/physic-paint/bridge/` launch context + transport: the revisioned exact-payload idiom D-01/D-02 build on; PHYSICAL_KEYS/revision guard pattern shows how sections are versioned
- G-01 Tauri listen-branch pattern (`physic-paint:seek-frame`, quick 260801-azb): template for native event delivery of audio context updates between windows

### Established Patterns
- Child windows never present provisional state as accepted (Phase 38.1 canvas-first rule) — audio context applies only when revision is newer, matching the paint-side guard
- Session-local ephemeral state lives in signals, not project data (soloStore precedent) — D-13 toggle follows this
- Native visual UAT is the user's oracle; nothing is "done" until live UAT passes — audio sync quality is inherently a native-UAT judgment
- CSP changes ship only as narrow grants proven by failing packaged-app tests with contract-test guards (v0.8.1 `img-src data:` pattern) — D-04 applies the same discipline to audio

### Integration Points
- Bridge payload: audio context section joins the existing launch/session handoff (D-01); live updates ride the same revision discipline (D-02)
- EFX Paint playback controls area: toggle icon button placement (D-12) and suppressed-status note (D-06)
- EFX Paint window close path: engine stop + release hook (D-08, AUDIO-06)

</code_context>

<specifics>
## Specific Ideas

- User issued a hard asset-transport directive (verbatim in D-04): opaque asset IDs/protocol URLs only; no base64 or `data:` audio; no reuse of the v0.8.1 image CSP grant for audio; no speculative CSP broadening; no filesystem paths; CSP adjustments only when proven by a failing packaged-app test.
- Entry artifact is non-negotiable per roadmap: the frame→audio truth table (paint appFrame == main-editor global frame; per-track offset/trim/slip combinations) is written and tested before implementation begins.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 41-efx-paint-audio-preview-monitoring-toggle*
*Context gathered: 2026-08-04*
