---
phase: 51
slug: read-only-audio-preview
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-09-11
---

# Phase 51 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail. Scope: read-only main-editor audio monitoring during EFX Paint playback — no new audio surface, no audio editing, no persistence.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| main editor → child payload (launch) | the `audioPreview` section crosses at child launch; closed-key + type-guard + revision validation rebuilds a canonical plain-data copy | audio track metadata + `efxasset://` URLs (no raw paths, no bytes) |
| main editor → child (push) | revisioned audio-context updates cross repeatedly during a session through the single application funnel | small revisioned metadata sections |
| child → main editor (ownership events) | transient playback-state/claim events cross in both directions; `emitTo` window-label targeting, origin check (fallback), transient-hint semantics only | claim/suppress hints — never main-state mutation |
| child monitor → shared `audioEngine` singleton | the child routes every dispatch through the one per-webview Web Audio engine (D-08); a second context is never created, a closed context is never reused | scheduling instructions (play/playDelayed/stopAll) |
| audio bytes → `efxasset://` CSP grant | audio bytes are fetched through the read-only protocol handler under one CSP token; the monitor never reads files directly | media bytes inbound only; no write surface |
| seek/scrub input → monitor dispatch funnel | the ruler gesture produces a cursor-only frame value that crosses into `navigateToSyncedPhysicalFrame` → `rotoCachedPlayback.seek`/`scrub` → the single monitor funnel gated by the session toggle and the first-player-wins ownership guard | cursor frame numbers |
| close/unmount → engine release | window close / unmount triggers the single `release()` path (stopAll + close context); the AudioContext never outlives the window | lifecycle teardown only |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-51-01 | Tampering | seek-while-playing audio restart (double-dispatch / orphaned audio) | medium | mitigate | The seek method routes through the single audio funnel (`playAtCursor` = stopAll + re-dispatch, `efxPaintAudioMonitor.ts:120`); the monitor's idempotent state machine and the CR-01 audio-session guard prevent double-dispatch or orphaned audio after a stop during navigation — pinned by the seek tests in `app/src/components/physic-paint/hooks/useRotoCachedPlayback.test.ts` and the wiring regression in `app/src/components/physic-paint/audio/efxPaintAudioPreview.test.ts` ("seek wiring regression … stopAll before the new-cursor re-dispatch") | closed |
| T-51-02 | Spoofing | seek target frame | low | mitigate | `seek` validates the target appFrame against the `getFrames()` enumeration; an out-of-range target falls back to the silent `positionedAt` re-anchor — never a wrong-frame dispatch (enumerated negative case pinned in `useRotoCachedPlayback.test.ts`, "seek to an out-of-range appFrame is a silent re-anchor") | closed |
| T-51-03 | Denial of Service | seek-while-playing canvas conflict | low | accept | A brief playback-frame flicker during the navigation await is a UX artifact, not a correctness defect; the `seek` re-anchor settles the canvas at the target frame — accepted in the 260902-cfa threat model 2026-09-02 (AR-51-01) | closed |
| T-51-04 | Elevation of Privilege / Information Disclosure | child audio module importing main-editor audio state (`audioStore` / `timelineStore` / `playbackEngine`) | high | mitigate | Authority-boundary source-scan contract `app/src/components/physic-paint/audio/efxPaintAudioAuthorityContract.test.ts` (2 tests): the production 4-module scan (`efxPaintAudioMonitor.ts`, `efxPaintAudioPreviewContext.ts`, `efxPaintAudioPreviewStore.ts`, `efxPaintAudioOwnership.ts`) fails on any resolving import, with a detector control test proving the scanner is not trivially green (260911 validate-phase gap closure, `e57a0a04`) | closed |
| T-51-05 | Denial of Service | audible-scrub `stopAll` spam / crackle | low | mitigate | `EFX_PAINT_AUDIO_SCRUB_THROTTLE_MS` = 120 ms (`efxPaintAudioMonitor.ts:51`) gates `scrubAt` as a short 4-frame snippet (`EFX_PAINT_AUDIO_SCRUB_SNIPPET_FRAMES`, `:52`) through `playAtCursor` (`:207-217`); the audible-scrub tests in `app/src/components/physic-paint/audio/efxPaintAudioPreview.test.ts` (260902-cfa amendments, `d326b1f5`) pin the throttle and snippet window | closed |
| T-51-06 | Tampering | muted scrub bypassing the locked silent-scrub rule (D-09) | medium | mitigate | The session-toggle check lives inside `scrubAt` (not inside `playAtCursor`) so a muted scrub stays a silent `positionedAt` re-anchor and never sets the D-14 `toggleSilenced` flag (`efxPaintAudioMonitor.ts:207-210`); `efxPaintAudioPreview.test.ts` "scrubAt with the toggle off re-anchors silently — zero engine dispatch (D-09 unchanged)" | closed |
| T-51-07 | Denial of Service | scrub snippet outliving drag release / loop wrap returning to the wrong position | low | mitigate | `scrubEnd` stops the snippet through the single stop funnel and re-anchors at the final frame (`efxPaintAudioMonitor.ts:225-227`); the loop-wrap branch resets to `loopStartIndexRef` (the Play-press cursor index, updated by a mid-playback seek target) — `useRotoCachedPlayback.test.ts` loop-wrap describes + the scrub lifecycle contract in `PhysicsPaintStudio.test.ts` | closed |
| T-51-08 | Tampering | Play re-anchoring at the range start instead of the shared cursor (D-01) | medium | mitigate | `start()` resolves `getCurrentAppFrame` at press time, finds its index in `getFrames()`, begins visual playback there and dispatches `playAtCursor(cursorAppFrame, rangeEnd)`; an out-of-range cursor falls back to the range start (`useRotoCachedPlayback.ts`; test "start honors the current application-frame cursor (D-01)", 260902-cfa amendments `13a98b89`) | closed |
| T-51-09 | Information Disclosure | monitoring toggle leaking into project files / config (source-audio mutation) | low | mitigate | The session-local toggle store has no persistence imports (`app/src/components/physic-paint/audio/efxPaintAudioPreviewStore.ts`, AUDIO-05 prohibition); `efxPaintAudioPreview.test.ts` "the session toggle defaults On and writes no storage (D-13 — never persisted)"; no production code path writes source audio (read-only monitoring by construction) | closed |
| T-51-10 | Spoofing / Tampering | doubled audio across windows (child and main editor playing the same tracks) | medium | mitigate | First-player-wins ownership guard: `efxPaintAudioOwnership.ts` claim/release (`:101-111`), suppression note `EFX_PAINT_AUDIO_SUPPRESSED_NOTE` (`:25`), `canStartAudio()` gate (`:64-73`), origin check on the fallback listener (`:149`), claim release on window close (`:152`); the resume/suppress tests in `efxPaintAudioPreview.test.ts` plus Phase 41 packaged UAT step 5 (doubling guard) approved 2026-08-05 | closed |
| T-51-11 | Denial of Service | audio-resource leak across open/close cycles | medium | mitigate | `release()` (`efxPaintAudioMonitor.ts:333-338`) stops all sources and closes the AudioContext on both close paths (explicit close + the ownership `pagehide` listener, `efxPaintAudioOwnership.ts:152`); release tests (a)-(d) in `efxPaintAudioPreview.test.ts` pin stopAll → close, idempotency, never-created-context safety, and never-reuse-of-a-closed-context | closed |
| T-51-12 | Security misconfiguration | CSP broadening creep beyond the proven grant | high | mitigate | The `connect-src` `efxasset:` single-token grant is pinned by the contract block in `app/src/releaseContract.test.ts` ("Tauri CSP connect-src efxasset contract" — token set exact, `data:`/`blob:` excluded, no other directive gains the scheme); no CSP change shipped in Phase 51 | closed |
| T-51-SC | Tampering | npm/pip/cargo installs | low | accept | no package installs in the phase — no package-legitimacy gate required | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-51-01 | T-51-03 | Playback-frame flicker during the seek await: a UX artifact, not a correctness defect — the `seek` re-anchor settles the canvas at the target frame. Accepted in the 260902-cfa plan threat model. | user (plan approval) | 2026-09-02 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-11 | 13 | 12 | 1 accepted (low, T-51-03 → AR-51-01) | backfill compile from the phase's recorded evidence (documentation-only; no audit or test command executed) |

This record compiles Phase 41's closed register (`41-SECURITY.md`, T-41-01..T-41-15 + T-41-SC), the 260902-cfa plan threat model (T-51-01..T-51-03), the delivered quick evidence (260902-cfa + 260902-cfa-amendments), the 260911 validate-phase authority contract, and the inherited native UAT (Phase 41 8-step packaged UAT 2026-08-05; quick 260905-ibd native UAT 2026-09-05). No new audit run occurred for this backfill.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** compiled 2026-09-11 from recorded evidence
