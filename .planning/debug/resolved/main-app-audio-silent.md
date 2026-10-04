---
status: resolved
trigger: "Debug: main app audio regression — scrub and play produce no sound."
created: 2026-10-04T00:00:00Z
updated: 2026-10-04T00:00:00Z
---

## Current Focus

hypothesis: (none confirmed — regression did not reproduce under instrumentation)
test: Live instrumentation captured decoded-buffer stats, source.start() outcome, AudioContext state, and transport-advance samples to /tmp/efx-stall-capture-audio-silent.json
expecting: Capture distinguishes (a) no decode buffer, (b) buffer OK but source never started, (c) source started but ctx suspended / gain 0, (d) audio OK but transport stalled
next_action: closed — UAT approved, instrumentation removed

## Symptoms

expected: audible scrub on ruler drag and audible Play-from-cursor (both locked in Phase 51 UAT)
actual: no audio at all from scrub or play in the main app
errors: none reported
reproduction: open a project with an audio track, scrub the ruler, then play from the cursor — no sound in either case
started: Regression; exact breaking point unknown, noticed while testing the latest quick series

### Additional requirements

- First live check must also confirm whether the transport still advances while silent (silent playback vs stalled transport).
- Suggestion (not prescriptive): one targeted live evidence run first; regression-hunt from the last known-good commit only if the trace is inconclusive.
- Measure the symptom's own quantity (decoded buffer / actual audio output state), not whether some code path was entered.

### Guardrails

- User runs the live app — instrument it and write capture files to /tmp for the user to read.
- Live or on-disk evidence is the verdict; unit probes on this path are not admissible.
- Ship ONE fix; user retests immediately; iterate.

## Eliminated

- hypothesis: "isPhysicPaintChildAudioClaimed() gate stuck closed, suppressing both scrub and play"
  evidence: "capture transportStart.childAudioClaimed=false; snippetDispatch dispatched 1/1 tracks, skipped=[]; playDispatch gate=null"

- hypothesis: "decoded buffer missing / silent (decode failed or empty audio)"
  evidence: "playCall.bufferDuration=81 for all 35 calls — buffer present and non-trivial"

- hypothesis: "source.start() never fires (remainingDuration<=0 or offset past buffer end)"
  evidence: "35/35 playCall started=true, 0 skipped, reasons=[]"

- hypothesis: "AudioContext suspended / gain 0 / track muted (output-side silence)"
  evidence: "ctx.state=running, gainValue=1, muted=false, volume=1 on every playCall"

- hypothesis: "stalled transport (playhead not advancing)"
  evidence: "transportTick frames 21→28→35→43→50→58→65→73, transportStop frame=80 — transport advanced normally"

## Evidence

- timestamp: 2026-10-04T00:00:00Z
  checked: "Code map of the main-app audio path (pre-evidence, for probe placement only)"
  found: |
    Audio path is app/src/lib/audioEngine.ts (AudioEngine: ensureContext/decode/play/playDelayed)
    driven by app/src/lib/playbackEngine.ts (PlaybackEngine.startAudioPlayback, startAudioSnippet,
    scrubToFrame). Ruler drag → TimelineInteraction.ts:986 playbackEngine.scrubToFrame.
    Play → CanvasArea.tsx:196 playbackEngine.start() (Play-from-cursor).
  implication: "Probes belong on decode output, source.start() outcome, and the two dispatch gates"

- timestamp: 2026-10-04T00:00:00Z
  checked: "Candidate silence gates in the live path (not yet measured)"
  found: |
    (1) isPhysicPaintChildAudioClaimed() suppresses BOTH scrub (playbackEngine.ts:134)
        and play (playbackEngine.ts:271) — would silence everything while transport advances.
    (2) audioEngine.play early-returns when buffers.get(trackId) is missing (no decode).
    (3) source.start() is skipped when remainingDuration <= 0 or clampedOffset >= buffer.duration.
    (4) AudioContext state 'suspended' (resume() not awaited in ensureContext).
    (5) track.muted / volume === 0 / fade schedule forcing gain to 0.
  implication: "Capture must record each gate's outcome, not just that play() was called"

- timestamp: 2026-10-04T00:00:00Z
  checked: "Instrumentation pass shipped (tag [DEBUG-audio-silent])"
  found: |
    app/src/lib/audioDebugCapture.ts — event log + debounced dump via Rust
    write_debug_capture → /tmp/efx-stall-capture-audio-silent.json.
    Hooks: audioEngine.decode (inputBytes + buffer peak/RMS/duration), audioEngine.play /
    playDelayed (started true/false + reason, gainValue, ctx.state), playbackEngine.scrubToFrame
    (gate outcomes), startAudioPlayback (gate + dispatched/skipped tracks), start/stop
    (transportStart/Stop), tick (transportTick every 300ms = transport advance),
    projectStore hydrate read (fileBytes.byteLength vs arrayBuffer.byteLength).
  implication: "One live run of scrub + play lands a capture that distinguishes silent-vs-stalled and all five gates"

- timestamp: 2026-10-04T14:19:35Z
  checked: "/tmp/efx-stall-capture-audio-silent.json (live run: project open + ruler scrub + play-from-cursor)"
  found: |
    500 events (ring buffer at cap; early decode/hydrate events evicted by the scrub flood).
    scrub=417, snippetDispatch=34, playCall=35, playDispatch=1, transportStart=1,
    transportStop=1, transportTick=8, playEnded=3.
    Decoded buffer: bufferDuration=81 on every playCall — present and non-trivial.
    source.start(): 35/35 started=true, 0 skipped, reasons=[].
    Output side: ctx.state="running", gainValue=1, muted=false, volume=1 on every playCall.
    Transport advance: frames 21→28→35→43→50→58→65→73, stop at 80 — advancing normally.
    Gates: transportStart.childAudioClaimed=false; snippetDispatch dispatched 1/1, skipped=[];
    playDispatch gate=null (not suppressed).
  implication: |
    Not a stalled transport. No silence gate was closed. Every measured quantity on the
    symptom's own axis was healthy: buffer decoded, source started, context running,
    gain 1, transport advancing. The regression did not reproduce under instrumentation.

## Resolution

root_cause: |
  Not isolated. The reported no-sound regression did not reproduce once the app was run
  under live instrumentation: the capture at /tmp/efx-stall-capture-audio-silent.json
  (2026-10-04T14:19Z) shows the full audio path healthy — decoded buffer present
  (81s), source.start() fired 35/35, AudioContext running, gain 1 / unmuted, and the
  transport advancing normally (frames 21→80). All five candidate silence gates were
  open. Consistent with a transient/stale-build state that did not survive a restart;
  no code defect was demonstrated by live evidence.

fix: |
  None required. No product code was changed. The [DEBUG-audio-silent] instrumentation
  pass (audioDebugCapture.ts + hooks in audioEngine/playbackEngine/projectStore/main.tsx)
  was removed after the capture was analysed; working tree left clean.

verification: |
  User ran the instrumented live app (repro: open project with audio track, scrub ruler,
  play from cursor) and reported UAT approved. On-disk capture analysed (see Evidence);
  all measured quantities healthy. Capture file deleted, instrumentation removed,
  typecheck/audio tests clean after removal.

files_changed: []
