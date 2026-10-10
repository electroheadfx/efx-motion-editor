---
phase: quick-261010-ht0
plan: 261010-ht0
subsystem: audio
tags: [fade-curves, setValueCurveAtTime, sourceFrames, fit-to-view, preact-signals]

# Dependency graph
requires:
  - phase: quick-261010-g2n
    provides: computeAudioFitToView, slipOffsetBounds law, sound-band overlay geometry
provides:
  - fadeCurves.ts single curve law (mirrored fade-in/out loudness)
  - Sampled setValueCurveAtTime ramps in audioEngine and audioExportMixer
  - DocumentSoundClip.sourceFrames (required positive integer, clean break)
  - Logarithmic import defaults for new audio clips
  - Studio Fit to view control on the audio modal
affects: [audio-export, audio-preview, studio-audio-modal, efx-paint-document]

# Actuals (#2632)
actuals:
  tokens: 14720
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single curve law module (fadeCurves.ts) sampled by overlay and audio scheduling"
    - "Module-level viewport getter registered by strip, read at click time (no per-scroll signal)"

key-files:
  created:
    - app/src/lib/fadeCurves.ts
    - app/src/lib/fadeCurves.test.ts
    - app/src/lib/audioExportMixer.test.ts
  modified:
    - app/src/components/physic-paint/view/soundBandGeometry.ts
    - app/src/components/physic-paint/view/soundBandGeometry.test.ts
    - app/src/lib/audioEngine.ts
    - app/src/lib/audioExportMixer.ts
    - app/src/components/physic-paint/view/physicsPaintAudioController.ts
    - app/src/components/physic-paint/view/physicsPaintAudioController.test.ts
    - app/src/efx-paint/document/efxPaintDocument.ts
    - app/src/efx-paint/document/efxPaintDocumentParsers.ts
    - app/src/efx-paint/document/efxPaintDocumentRevision.ts
    - app/src/lib/documentSoundGates.ts
    - app/src/components/views/ImportedView.tsx
    - app/src/types/audio.ts
    - app/src/components/physic-paint/view/PhysicsPaintAudioModalView.tsx
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx

key-decisions:
  - "fade-in overlay samples fadeLoudnessIn (2t-t^2 for exp) — the true mirror of fade-out; bow-direction pin in t15 updated intentionally"
  - "sourceFrames is a required positive integer (clean break, slipOffset pattern); no legacy defaulting on parse"
  - "Fit to view writes inFrame/outFrame/startFrame/slipOffset: 0 in ONE commitPatch (one undo)"
  - "Timeline viewport port defaults to null; Fit to view is then a no-op/disabled"

patterns-established:
  - "fadeCurves.ts is the only home of f(t); soundBandGeometry and audioEngine/audioExportMixer sample that law"
  - "Module-level getter registration for cross-component DOM reads (no signal bumped per scroll)"

requirements-completed: [QUICK-261010-HT0]

coverage:
  - id: F1
    description: "Fade-in and fade-out with the same curve are true mirrors; exponential both-sides matches without swapping curve names"
    requirement: QUICK-261010-HT0
    verification:
      - kind: unit
        ref: "src/lib/fadeCurves.test.ts — mirror identity + exponential endpoint shapes"
        status: pass
      - kind: unit
        ref: "src/components/physic-paint/view/soundBandGeometry.test.ts — overlay samples the shared law"
        status: pass
    human_judgment: false
  - id: F2
    description: "New audio imports default both fades to logarithmic; stored curves on existing projects are left alone"
    requirement: QUICK-261010-HT0
    verification:
      - kind: unit
        ref: "src/components/physic-paint/view/physicsPaintAudioController.test.ts — fresh import log/log; replace keeps stored curves"
        status: pass
    human_judgment: false
  - id: F3
    description: "Audible fades follow the drawn overlay shape (log sounds log) in preview and export"
    requirement: QUICK-261010-HT0
    verification:
      - kind: unit
        ref: "src/lib/audioEngine.test.ts + src/lib/audioExportMixer.test.ts — setValueCurveAtTime for every curve, no linear-ramp stand-in"
        status: pass
    human_judgment: false
  - id: F4
    description: "Studio Offset (s) moves on a trimmed clip of a long file (negative allowed) instead of parking at zero"
    requirement: QUICK-261010-HT0
    verification:
      - kind: unit
        ref: "src/lib/slipOffsetBounds.test.ts — long-file window min near -79.4s, max 0"
        status: pass
      - kind: unit
        ref: "src/efx-paint/document/efxPaintDocumentParsers.test.ts — sourceFrames required positive integer"
        status: pass
      - kind: unit
        ref: "src/lib/documentSoundGates.test.ts — totalFramesInFile from sourceFrames"
        status: pass
    human_judgment: false
  - id: F5
    description: "Studio Fit to view crops In/Out to the on-screen slice, moves band start, resets slip to 0, one undo"
    requirement: QUICK-261010-HT0
    verification:
      - kind: unit
        ref: "src/components/physic-paint/view/physicsPaintAudioController.test.ts — ONE commitPatch writes in/out/start/slip"
        status: pass
      - kind: unit
        ref: "src/components/physic-paint/view/PhysicsPaintAudioModalView.test.ts — Fit to view control in TIMING"
        status: pass
    human_judgment: false

duration: 13min
completed: 2026-10-10
status: complete
plan_head_before: 3ff6581c29bf3b746564664a9f91a0d0f7a3b6ee
plan_head_after: 3d7b3dc0986db67f80c7f7ca665834edc5455871
commits: 3
---

# Quick 261010-ht0: Audio Fade Curves, Studio Offset, Fit to view Summary

**Mirrored fade curve law from one module, logarithmic import defaults, sourceFrames-persisted Offset bounds, and Studio Fit to view — all with sampled setValueCurveAtTime ramps matching the drawn overlay.**

## Accomplishments

- **Fade curve law (F1/F3):** Created `app/src/lib/fadeCurves.ts` as the single home of f(t) (exponential = t^2, logarithmic = sqrt(t), linear = t). Fade-in loudness = 1 - f(1-t) is the true mirror of fade-out loudness = 1 - f(t). Exponential fade-in is 2t-t^2 (fast start / bows over); exponential fade-out stays the user-liked 1-t^2. Overlay paths sample the shared law (no private shape table). Both `audioEngine.applyRamp` and `audioExportMixer.applyRamp` schedule `setValueCurveAtTime` of the sampled array for every curve — no linear-ramp stand-in for logarithmic. Partial fade-in entry samples the remaining loudness slice.
- **Logarithmic import defaults (F2):** `buildFreshSoundClip` and the editor `ImportedView` AudioTrack construction set both fades to `logarithmic`. `buildReplacedSoundClip` keeps the current clip's stored curves. Stored curves on existing projects are left alone (no migration).
- **sourceFrames Offset bounds (F4):** `DocumentSoundClip.sourceFrames` is a required positive integer (clean break, slipOffset pattern). Parser rejects missing/non-integer/zero/negative. `encodeCanonicalSoundClip` includes `sourceFrames` and `slipOffset` so source-length and slip edits rotate the save/sync tokens. `toDocumentSoundAudioTrack` maps `totalFramesInFile` from `sound.sourceFrames`. Offset bounds and In/Out max read `sound.sourceFrames` first (peaks-cache secondary; trim-out fallback gone). Long-file example (inFrame 0, outFrame 38, sourceFrames 1944 at 24 fps) yields min near -79.4s, max 0.
- **Studio Fit to view (F5):** New control in the audio modal TIMING section (same verbatim label as the editor). Reuses `computeAudioFitToView` with `offsetFrame = sound.startFrame` and `totalFramesInFile = sound.sourceFrames`. One `commitPatch` writes `inFrame`/`outFrame`/`startFrame`/`slipOffset: 0`. No-op when the viewport port returns null or the band is fully visible. Viewport sourced through a controller port `getTimelineViewport` wired from `PhysicsPaintStudio` via a stable getter registered by the WorkflowStrip (module-level read, no per-scroll signal).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Third sourceFrames read in modal file-row display still had trim-out fallback**
- **Found during:** Task 3 verify
- **Issue:** The file-row max-time display (`formatAudioMaxTime`) still used `audioPeaksCache.getSourceFrames(sound.sourceId) ?? sound.outFrame`, the trim-out collapse the plan forbids.
- **Fix:** Changed to `sound.sourceFrames ?? audioPeaksCache.getSourceFrames(sound.sourceId)` (prefer persisted, peaks-cache secondary, no trim-out fallback), matching the Offset and In/Out reads.
- **Files modified:** `app/src/components/physic-paint/view/PhysicsPaintAudioModalView.tsx`
- **Commit:** 3d7b3dc0

### Intentional Test Updates

**2. soundBandGeometry t15 bow-direction pin flipped to the mirrored law**
- **Found during:** Task 1
- **Issue:** The existing t15 pin expected exponential fade-in to bow UNDER (shape = t^2). The new law samples `fadeLoudnessIn` = 2t-t^2 (bows OVER), which is the intentional F1 mirror fix. The pin was updated to assert the new bow directions (exp bows over, log bows under on fade-in).
- **Files modified:** `app/src/components/physic-paint/view/soundBandGeometry.test.ts`
- **Commit:** 3eb775b6

## Constraints Honored

- handleReplace never-copy region in AudioProperties.tsx: byte-stable (untouched)
- No SliderStepper/NumericStepper chrome edits
- No .mce field changes (MceAudioTrack untouched)
- soundGainLineY stays -100..+100 at definition (untouched)
- TimelineInteraction drag/trim geometry untouched
- Existing projects keep their stored fade curves (no migration)
- Clean break on format changes (sourceFrames required, no legacy defaulting)

## Verification

Full plan verify suite: 189 passed, 9 pre-existing todo, 0 failed across 11 test files.

- `pnpm --filter efx-motion-editor exec tsc --noEmit` — clean
- fadeCurves.test.ts — 10 passed (mirror identity, exponential endpoints, sampler)
- soundBandGeometry.test.ts — 17 passed (overlay samples the shared law)
- audioEngine.test.ts — 3 passed (setValueCurveAtTime source contract)
- audioExportMixer.test.ts — 5 passed (export matches preview law)
- physicsPaintAudioController.test.ts — 36 passed (log defaults, sourceFrames, Fit to view one-commitPatch)
- efxPaintDocumentParsers.test.ts — 39 passed (sourceFrames required positive integer)
- efxPaintDocumentRevision.test.ts — 5 passed (sourceFrames + slipOffset rotate tokens)
- documentSoundGates.test.ts — 25 passed (totalFramesInFile from sourceFrames)
- slipOffsetBounds.test.ts — 6 passed (long-file wide negative-to-zero window)
- PhysicsPaintAudioModalView.test.ts — 26 passed (Fit to view control, sourceFrames preference)
- audioClipGeometry.test.ts — 17 passed (261010-g2n pins stay green)

## Known Stubs

None.

## Auth Gates

None.

## Self-Check: PASSED

- fadeCurves.ts: FOUND
- fadeCurves.test.ts: FOUND
- audioExportMixer.test.ts: FOUND
- 3eb775b6: FOUND (Task 1)
- a0c7c2ec: FOUND (Task 2)
- 3d7b3dc0: FOUND (Task 3)

## Status: CLOSED — native UAT PASSED (2026-10-10)

**Quick 261010-ht0 is closed.** All live UAT rows approved by the user 2026-10-10: fade-in and fade-out are true mirrors at every curve (no In=log/Out=exp workaround), the audible fade matches the drawn overlay, exponential is the import default for both fades (user reverted the brief logarithmic default), Studio Offset moves on a trimmed clip of a long file, and Studio Fit to view crops In/Out in one undo. UAT-loop follow-ups also approved: slipOffset store/playback/waveform fixes (e98a6a2d, 327ad773, c76c5369, 5bb42bad, 256e4e38), waveform visual gain x1-x4 + taller stain (5a821a54), and the editor OUT-cut window fix (10172f84).
