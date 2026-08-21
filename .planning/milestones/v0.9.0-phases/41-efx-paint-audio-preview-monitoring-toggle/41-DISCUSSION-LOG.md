# Phase 41: EFX Paint Audio Preview + Monitoring Toggle - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-04
**Phase:** 41-efx-paint-audio-preview-monitoring-toggle
**Areas discussed:** Audio context transport, Doubled-audio guard policy, Scrub/seek audio behavior, Toggle placement + default

---

## Audio context transport

| Option | Description | Selected |
|--------|-------------|----------|
| Extend launch bridge payload | Audio context becomes another section of the Phase 39 exact-payload revisioned handoff; one channel, one revision discipline | ✓ |
| Dedicated audio channel | Own bridge channel/event stream with its own revision counter | |

**User's choice:** Extend launch bridge payload

| Option | Description | Selected |
|--------|-------------|----------|
| Push on every change | Main editor emits authoritative context event on every audio change; stale revisions dropped silently | ✓ |
| Launch snapshot + manual refresh | Audio context only at launch; user closes/reopens or hits Refresh for updates | |

**User's choice:** Push on every change

| Option | Description | Selected |
|--------|-------------|----------|
| Restart at cursor | Mid-playback revisioned update restarts audio at the current Paint cursor with the new context | ✓ |
| Apply on next play/seek | New context stored; takes effect on next play/seek | |

**User's choice:** Restart at cursor

| Option | Description | Selected |
|--------|-------------|----------|
| Existing asset protocol | Bytes served via existing Tauri asset protocol; no file paths cross the bridge | ✓ |
| Raw file paths in payload | Payload carries absolute paths; EFX Paint reads/decodes itself | |

**User's choice:** Existing asset protocol — with an expanded hard directive: opaque asset IDs or protocol URLs only; no absolute filesystem paths; no raw audio bytes across the bridge; decode locally via existing Web Audio path. Forbidden: base64/`data:` URLs for audio, reusing the v0.8.1 `img-src data:` grant for audio, speculative CSP broadening, unrestricted filesystem paths. CSP adjustments only as the narrow directive proven by a failing packaged-app test, without touching the image CSP contract.

---

## Doubled-audio guard policy

| Option | Description | Selected |
|--------|-------------|----------|
| First-player wins | Whichever window starts audio first owns monitoring; other window's playback is audio no-op (visual continues) | ✓ |
| Last-play wins | Most recent Play silences the other window | |
| Main editor mutes preview | Both can play; EFX Paint monitoring suspended while main editor plays | |

**User's choice:** First-player wins

| Option | Description | Selected |
|--------|-------------|----------|
| Show suppressed status | Small non-blocking note (e.g. "Audio playing in main editor") while suppressed | ✓ |
| Silent suppression | No message; EFX Paint just stays silent | |

**User's choice:** Show suppressed status

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-resume on stop | Main editor stops → suppressed EFX Paint monitoring resumes at current cursor if toggle On | ✓ |
| Resume on next seek/play | Stays silent until user seeks or restarts playback | |

**User's choice:** Auto-resume on stop

**Notes:** Engine lifecycle covered inline: single audio engine per EFX Paint window, released on close, revisioned updates reuse the same instance (AUDIO-06 no-duplicate-engines).

---

## Scrub/seek audio behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Silent scrub, play-only audio | Scrubbing is silent; engine left positioned at cursor; matches main-editor behavior | ✓ |
| Audible scrub snippets | NLE-style scrub auditioning; more code, stutter risk | |

**User's choice:** Silent scrub, play-only audio

| Option | Description | Selected |
|--------|-------------|----------|
| Free-run + drift threshold correction | Web Audio clock free-runs after seek-aligned start; correct only past ~40ms/one-frame threshold | ✓ |
| Per-frame re-sync | Every Paint frame tick re-asserts audio position | |

**User's choice:** Free-run + drift threshold correction

| Option | Description | Selected |
|--------|-------------|----------|
| Loop wraps re-seek audio | Loop range maps to audio time window; each wrap re-seeks via normal seek path | ✓ |
| Audio plays through once | No audio loop; desyncs from visuals on second pass | |

**User's choice:** Loop wraps re-seek audio

---

## Toggle placement + default

| Option | Description | Selected |
|--------|-------------|----------|
| Next to playback controls | Compact speaker/monitor icon button beside Play/loop controls; Phase 36.15 guarded-icon-with-tooltip pattern | ✓ |
| Header/status bar switch | Labeled On/Off switch in header/status bar | |
| Sidebar settings section | Inside a settings/preferences sidebar section | |

**User's choice:** Next to playback controls

| Option | Description | Selected |
|--------|-------------|----------|
| Default On per session | Session-local; resets to On each open; nothing persisted | ✓ |
| Default Off per session | Starts silent; user opts in per session | |

**User's choice:** Default On per session

| Option | Description | Selected |
|--------|-------------|----------|
| Immediate effect mid-playback | Off silences immediately; On resumes at current cursor; visual playback uninterrupted | ✓ |
| Apply on next play cycle | Changes take effect on next Play/Stop cycle | |

**User's choice:** Immediate effect mid-playback

---

## Claude's Discretion

- Drift-measurement mechanics and precise correction threshold within the ~1-frame budget
- Exact visual form of the suppressed-status note within existing status/capsule conventions
- How `app/src/lib/audioEngine.ts` offset/trim/delay math is reused or adapted for the EFX Paint window

## Deferred Ideas

None — discussion stayed within phase scope.
