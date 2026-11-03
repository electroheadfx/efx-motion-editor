---
phase: 55-efx-paint-host-engine-1-host-split
reviewed: 2026-10-15T11:19:17Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - app/src/lib/playbackEngine.ts
  - app/src/lib/playbackEngine.test.ts
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 55: Code Review Report

**Reviewed:** 2026-10-15T11:19:17Z
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Summary

Gap-closure review of plan 55-10 (GAP-55-01, UAT row A2): `startAudioSnippet` now dispatches paint document-sound clips through the shared `collectEnabledDocumentClips` / `collectEnabledDocumentClipsAt` enumerator, single-sourced with `startAudioPlayback`'s immediate arm.

The core wiring is correct. Traced against the pre-change play arm (`git diff bd8166f4^..HEAD`), the extraction is a faithful move: membership (`collectDocumentSoundClips`), the D-12/D-13 gate (`mainPlaybackClipEnabled` + owner/sequence visibility), the effective-end clamp, the source-offset formula (`inFrame + slipOffset + framesIntoClip`) / fps, and `remainingFrames` are all identical on both legs. The 4-frame snippet cap (`min(remainingFrames, TIMELINE_SCRUB_AUDIO_SNIPPET_FRAMES)`) matches the main-track snippet law. The snippet arm calls only `audioEngine.play` — no `playDelayed` (future-clip scheduling stays play-leg-only at playbackEngine.ts:404-409). The D-05 child-claim guard and the 120ms throttle remain in `scrubToFrame` before any dispatch. Suite green: 38 passed / 7 todo in `playbackEngine.test.ts`.

No blocker-level defect found in the new dispatch. Findings are two test-reliability/coverage gaps that can let this exact regression class ship silently again, plus three residual drift/coverage notes.

## Warnings

### WR-01: D-13 owner-layer visibility gate branch is unpinned on both legs

**File:** `app/src/lib/playbackEngine.ts:188-194`
**Issue:** `collectEnabledDocumentClips` folds owner-layer visibility into the composite gate:

```typescript
const owner = sequence.layers.find((layer) =>
  layer.type === 'physic-paint' && layer.source.type === 'physic-paint'
    ? layer.source.layerId === entry.layerId
    : layer.id === entry.layerId,
);
const sequenceVisible = sequence.visible !== false && owner?.visible !== false;
```

A hidden physic-paint layer must silence its clip ("sound follows the composite exactly like the layer's pixels"), and a missing owner fails open (`owner?.visible !== false` is true when `owner` is undefined). Neither branch is covered anywhere: the play family's (c6) hides only the *sequence* (`makeFxSequence({visible: false})`), and the scrub family's (p5) does the same. No test constructs `makeFxLayer(CLIP_LAYER, {visible: false})`, and no test covers owner-absent. A regression that drops the owner check (or inverts it to fail-closed) would change audible behavior with the whole suite green — the same silent-drift class GAP-55-01 just closed.

**Fix:** Add a scrub-family case (and ideally a play-family twin) that hides the owner layer:

```typescript
it('(p5b) a hidden physic-paint layer silences the paint snippet (D-13 owner gate)', () => {
  seed(makeSound(), makeFxSequence({layers: [makeFxLayer(CLIP_LAYER, {visible: false})]}));
  playbackEngine.scrubToFrame(96);
  expect(mockedAudio.play).not.toHaveBeenCalled();
  expect(mockedAudio.playDelayed).not.toHaveBeenCalled();
});
```

Optionally pin the owner-absent fail-open separately if that contract is intentional.

### WR-02: (s4)/(s1) source-contract end-bound can go vacuous and stop pinning

**File:** `app/src/lib/playbackEngine.test.ts:778-779, 818-821`
**Issue:** Both source-contract pins bound the function-body slice with an unanchored `indexOf` for the *end* marker:

```typescript
// (s4)
const fnAt = source.indexOf('private startAudioSnippet');
const fnBody = source.slice(fnAt, source.indexOf('private stepForward'));
```

If `private stepForward` is ever renamed or removed, `indexOf` returns `-1` and `source.slice(fnAt, -1)` returns nearly the whole file — which still contains `startAudioPlayback`'s call to `collectEnabledDocumentClipsAt` (playbackEngine.ts:399). The (s4) pin would then pass even if the snippet's clip leg were deleted entirely, which is exactly the regression (s4) exists to catch (and the same latent shape exists in (s1) with `private tick`). This is a pin that can silently stop pinning.

**Fix:** Anchor the end search at `fnAt` and assert the bound is valid before slicing:

```typescript
const fnAt = source.indexOf('private startAudioSnippet');
const fnEnd = source.indexOf('private stepForward', fnAt);
expect(fnAt >= 0 && fnEnd > fnAt).toBe(true);
const fnBody = source.slice(fnAt, fnEnd);
```

Apply the same guard to (s1) (`private tick`, anchored at `startAudioPlayback`'s `fnAt`).

## Info

### IN-01: Scrub family never exercises the sequence-rebased clip window

**File:** `app/src/lib/playbackEngine.test.ts:663-761`
**Issue:** The frame-space law (`timelineStartFrame = sequence.inFrame + sound.startFrame`) is pinned on the play path by (c3) (`makeFxSequence({inFrame: 50})`, clip audible at global 98), but the GAP-55-01 family only ever uses `inFrame: 0` sequences. Single-sourcing makes drift unlikely today, but the scrub contract states "same frame-space law" and nothing would catch a future snippet-local reimplementation that reads `sound.startFrame` directly.
**Fix:** Add a scrub analog of (c3): seed `makeFxSequence({inFrame: 50})` with `startFrame: 48`, scrub at 98 and at 48, assert dispatch only at 98.

### IN-02: effectiveEnd ceiling clamp is unpinned on both legs

**File:** `app/src/lib/playbackEngine.ts:202-204`
**Issue:** `effectiveEnd = Math.min(clipEndOnTimeline, sequenceOut, maxFrames)` can trim a clip at the overlay-out (`getTimelineOverlaySequenceOutFrame`) or the timeline ceiling. (p2b) only pins the *trim-end* cap (`outFrame - inFrame`). Neither the play family nor the scrub family constructs a clip that extends past `maxFrames` / the overlay-out, so a dropped `Math.min` would over-extend clip audio past the composite with a green suite. Pre-existing gap, now shared by both arms via the extraction.
**Fix:** Seed a clip whose trim end runs past the mocked `totalFrames` (300) and assert `maxPlaySeconds` is capped at the ceiling on both a play dispatch and a scrub dispatch.

### IN-03: Main-track snippet loop still duplicates the play-path track math

**File:** `app/src/lib/playbackEngine.ts:238-250` vs `365-382`
**Issue:** Plan 55-10 single-sourced only the *clip* leg. The main-track membership/offset math remains a second copy inside `startAudioSnippet` (same shape as `startAudioPlayback`'s immediate arm, plus the 4-frame cap). A future edit to the play-path track math (e.g. another slipOffset-class fix) will not reach the snippet and vice versa — the same drift class the extraction was meant to kill, just on the track leg.
**Fix:** When convenient, extract a `collectEnabledTracksAt(frame)` sibling so both arms ride one track enumerator; not required for GAP-55-01 closure.

---

_Reviewed: 2026-10-15T11:19:17Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
