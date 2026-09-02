# Phase 51: Read-only Audio Preview - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-02
**Phase:** 51-read-only-audio-preview
**Areas discussed:** Pause & Resume, Scrub audio, Studio audio UI, Primary work

---

## Pause & Resume

| Option | Description | Selected |
|--------|-------------|----------|
| Map pause→stop (Recommended) | No new Studio control. Pause/stop releases audio (monitor.stop()); resume = pressing Play re-anchors audio at the cursor. Keeps Phase 51 read-only-audio scoped — no playback-engine control design. AUD-04's 'pause/resume' is satisfied by the stop→play boundary. | ✓ |
| Add real Studio Pause | Add a real Pause to the Studio playback engine: the frame timer freezes AND the audio anchor freezes (audio clock stops, no release), so resume continues from the exact same frame with audio still in sync. New control + audio freeze semantics — larger scope, touches the playback engine. | |

**User's choice:** Map pause→stop (Recommended)
**Notes:** AUD-04 pause/resume maps to the stop→play boundary; no new Studio Pause control.

---

## Scrub audio

| Option | Description | Selected |
|--------|-------------|----------|
| Wire locked silent scrub (Recommended) | Wire the Phase 41 locked rule into the v1.0 seek path: seek-while-idle re-anchors silently (positionedAt — no sound), seek-while-playing is a full seek-restart. No new monitor rule, no new UI. Matches the locked truth table (D-09). | ✓ |
| Add optional audible scrub | Keep silent scrub as the default, but add an optional audible-scrub mode (a new monitor rule + toggle) so an animator can hear a short audio snippet while scrubbing the playhead — useful for beat-synced animation. New rule + UI surface. | |

**User's choice:** Wire locked silent scrub (Recommended)
**Notes:** The v1.0 ruler seek / cursor navigation is not wired to the audio monitor today (positionedAt has zero production callers); Phase 51 wires the locked silent-scrub rule.

---

## Studio audio UI

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse as-is (Recommended) | Keep the Phase 41 toggle (Volume2/VolumeX in the WorkflowStrip) + capsule notes (fps-mismatch, ownership suppressed/auto-resume) exactly as they are. Phase 51 only re-verifies placement in the new multi-track Studio during UAT. Zero new UI. | ✓ |
| Add audio status readout | Add a small audio status readout (e.g., in the right panel or program-monitor corner) showing the active audio tracks being monitored + a sync/locked indicator. More discoverable in the new Studio, but new UI surface to design and UAT. | |

**User's choice:** Reuse as-is (Recommended)
**Notes:** No new audio UI surface in Phase 51.

---

## Primary work

| Option | Description | Selected |
|--------|-------------|----------|
| Re-audit + targeted re-wire (Recommended) | Plan Phase 51 as: (1) a focused re-audit of the Phase 41 audio path against the v1.0 document/launch/cursor (you run the app to confirm what still works today), (2) targeted re-wiring of the two known gaps (seek→positionedAt/playAtCursor, pause→stop), (3) regression tests + native UAT. Assumes the infra survived but verifies before building. | ✓ |
| Assume intact, wire gaps only | Skip the audit — assume the Phase 41 audio preview is intact after the 45-50 refactor — and go straight to wiring the seek/pause gaps + tests + native UAT. Faster, but risks discovering mid-phase that a v1.0 change silently broke the launch embed or push path. | |

**User's choice:** Re-audit + targeted re-wire (Recommended)
**Notes:** The audit is a verification step, not a rebuild; the user runs the app to confirm current state.

---

## Claude's Discretion

- Exact wiring shape for the v1.0 seek path into the monitor (where positionedAt/playAtCursor are invoked from the ruler seek and cursor-navigation handlers).
- Exact re-audit checklist and which v1.0 seams get contract tests vs. manual verification.
- Whether the re-audit surfaces any v1.0 regression needing a fix beyond the two known gaps.
- The playback-range end / loop-window cap derivation for the multi-track context.

## Deferred Ideas

- Optional audible-scrub mode (new monitor rule + toggle) — future enhancement.
- Real Studio Pause control (freeze frame timer + audio anchor) — additive if ever wanted.
- Audio status readout in the Studio (right panel / monitor corner) — not chosen.
- Independent EFX Paint audio editing or persistence — out of scope (FUT-07).
