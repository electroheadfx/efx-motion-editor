---
phase: quick-261010-en9
plan: 261010-en9
subsystem: audio-ui
tags: [preact, signals, audio, timeline, studio, slip-offset, section-headers]

# Dependency graph
requires:
  - phase: quick-261010-bkv
    provides: Gain dB bridge (audioGain.ts), SliderStepper In/Out seconds, RuleSectionHeader as the single header home
  - phase: quick-261009-rko
    provides: never-copy audio source law (handleReplace byte-stable region, mainAppAudioSources pins)
provides:
  - "Section headers draw rule + label in rgb(205, 201, 201) (editor + Studio)"
  - "TRACK opens with the filename + Replace row (FILE section retired)"
  - "Editor timeline clips draw Studio-style gain line + diagonal fade paths"
  - "In-from-left trim keeps the clip end fixed (audioStore.setIn)"
  - "Offset (s) slip control in editor sidebar and Studio TIMING section"
  - "DocumentSoundClip.slipOffset (engine sign) on the fail-closed allowlist"
  - "Playhead timecode reads [frame] / [HH:MM:SS.FF of now]"
affects: [audio-panel, timeline-render, physic-paint-audio, efx-paint-document, document-sound-gates]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 15151
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "slipOffsetBounds.ts is the single home of the Offset sign law (UI seconds bounds + engine-frame clamp)"
    - "soundBandGeometry overlays reused on the editor timeline via a barH / SOUND_BAND_HEIGHT_PX scaleY fit"

key-files:
  created:
    - app/src/lib/slipOffsetBounds.ts
    - app/src/lib/slipOffsetBounds.test.ts
    - app/src/components/shared/RuleSectionHeader.test.ts
    - app/src/components/timeline/TimelineRenderer.audioPreview.test.ts
    - app/src/components/layout/TimelinePanel.test.ts
  modified:
    - app/src/components/shared/RuleSectionHeader.tsx
    - app/src/components/sidebar/AudioProperties.tsx
    - app/src/stores/audioStore.ts
    - app/src/components/timeline/TimelineRenderer.ts
    - app/src/components/layout/TimelinePanel.tsx
    - app/src/components/physic-paint/view/PhysicsPaintAudioModalView.tsx
    - app/src/components/physic-paint/view/physicsPaintAudioController.ts
    - app/src/efx-paint/document/efxPaintDocument.ts
    - app/src/efx-paint/document/efxPaintDocumentParsers.ts
    - app/src/lib/documentSoundGates.ts
    - app/src/stores/efxPaintStore.ts

key-decisions:
  - "Offset (s) sign law: UI positive = earlier source; engine slipOffset is the inverse (display framesToSeconds(-slip), commit -secondsToFrames)"
  - "DocumentSoundClip.slipOffset is a clean-break required integer (no legacy default on parse); MceAudioTrack.slip_offset untouched"
  - "setIn is a separate store door from setInOut so the clip-end invariant writes inFrame AND offsetFrame in one undo action"

patterns-established:
  - "slipOffsetBoundsSeconds / clampSlipOffsetFrames: one bounds source for both UI surfaces"
  - "dbToGain(linearToDb(volume)) maps editor linear volume onto soundGainLineY's -100..+100 contract at the call site"

requirements-completed: [QUICK-261010-EN9]

coverage:
  - id: R1
    description: "Section headers (editor sidebar and Studio modal) draw rule + label in rgb(205, 201, 201)"
    requirement: QUICK-261010-EN9
    verification:
      - kind: unit
        ref: "src/components/shared/RuleSectionHeader.test.ts"
        status: pass
    human_judgment: true
    rationale: "Color literal is pinned by unit test; the softer tone itself is a live visual judgment for the user."
  - id: R2
    description: "TRACK section starts with the filename + Replace row; the separate FILE block is gone"
    requirement: QUICK-261010-EN9
    verification:
      - kind: unit
        ref: "src/components/sidebar/AudioProperties.test.ts#opens TRACK with the filename + Replace row"
        status: pass
    human_judgment: false
  - id: R3
    description: "Editor timeline audio clips show a gain line and diagonal fade paths (Studio waveform preview)"
    requirement: QUICK-261010-EN9
    verification:
      - kind: unit
        ref: "src/components/timeline/TimelineRenderer.audioPreview.test.ts"
        status: pass
    human_judgment: true
    rationale: "Overlay draw language is source-pinned; the visual read (no more dark gradients) is a live UAT judgment."
  - id: R4
    description: "Raising In moves the clip left edge right while the clip end stays fixed; minimum span 1 frame"
    requirement: QUICK-261010-EN9
    verification:
      - kind: unit
        ref: "src/stores/audioStore.test.ts#setIn"
        status: pass
    human_judgment: false
  - id: R5
    description: "Offset (s) slips audio content in the editor with the user sign and file-window bounds"
    requirement: QUICK-261010-EN9
    verification:
      - kind: unit
        ref: "src/lib/slipOffsetBounds.test.ts + src/components/sidebar/AudioProperties.test.ts#Offset"
        status: pass
    human_judgment: true
    rationale: "Sign and bounds are unit-pinned; the slip feel on a real clip is a live UAT judgment."
  - id: R6
    description: "Studio audio modal TIMING section has the same Offset (s) control; DocumentSoundClip.slipOffset round-trips"
    requirement: QUICK-261010-EN9
    verification:
      - kind: unit
        ref: "src/components/physic-paint/view/PhysicsPaintAudioModalView.test.ts#Offset + src/efx-paint/document/efxPaintDocumentParsers.test.ts#slipOffset"
        status: pass
    human_judgment: true
    rationale: "Parser and control are unit-pinned; Studio modal parity is a live UAT judgment."
  - id: R7
    description: "Timeline timecode reads [playhead frame integer] / [HH:MM:SS.FF of the current position]"
    requirement: QUICK-261010-EN9
    verification:
      - kind: unit
        ref: "src/components/layout/TimelinePanel.test.ts"
        status: pass
    human_judgment: false
  - id: R8
    description: "Section content wrappers use 10px top and bottom margin"
    requirement: QUICK-261010-EN9
    verification:
      - kind: unit
        ref: "src/components/sidebar/AudioProperties.test.ts#content wrappers use 10px"
        status: pass
    human_judgment: true
    rationale: "Margins are source-pinned; the breathing room itself is a live visual judgment."

# Metrics
duration: 14min
completed: 2026-10-10
status: complete
plan_head_before: 186ed01536e3069b965f0b4c53a85c55220e12f2
plan_head_after: e0851a5d3aae03ffecce4a1d7c1856f1abd635ff
---

# Quick 261010-en9: Audio panel UAT refinements Summary

**Eight UAT refinements (R1–R8) on the audio panel: softer rgb(205, 201, 201) headers, FILE merged into TRACK, Studio gain/fade overlays on editor clips, In-from-left trim, Offset (s) slip in editor + Studio, and playhead timecode.**

## Accomplishments

- RuleSectionHeader rule + label now share `rgb(205, 201, 201)` (R1); the harsh white bars are gone on both the editor sidebar and the Studio modal.
- The FILE section is retired (R2): TRACK opens with the filename + `Replace...` row (handleReplace never-copy region byte-stable), then name, Gain, and the max-time readout.
- Content wrappers under RuleSectionHeader breathe at 10px/10px (R8).
- `drawAudioTrack` strokes the Studio overlay language — gain line via `soundGainLineSpan` + `Path2D` fade curves via `soundFadeInPathD`/`soundFadeOutPathD` (R3). The two `createLinearGradient` fade fills are gone. Editor linear volume maps through `dbToGain(linearToDb(volume))` at the call site; `soundGainLineY` stays on its -100..+100 contract.
- `audioStore.setIn` (R4) writes inFrame AND offsetFrame in one undo action so `offsetFrame + (outFrame - inFrame)` is invariant — raising In moves the left edge right while the clip end stays fixed. Out still trims from the right via `setInOut`. Minimum span is 1 frame.
- `slipOffsetBounds.ts` owns the Offset sign law (R5/R6): UI positive = earlier source, engine `slipOffset` is the inverse. `slipOffsetBoundsSeconds` returns the UI-second window; `clampSlipOffsetFrames` keeps `[inFrame+slip, outFrame+slip]` inside `[0, totalFramesInFile]`.
- Editor POSITION gains `Offset (s)` (R5) under Position; In commits through `setIn`.
- Studio TIMING gains the same `Offset (s)` control (R6). `DocumentSoundClip.slipOffset` (engine sign, frames) joins the fail-closed `SOUND_KEYS` allowlist as a required integer (clean break — no legacy default). `MceAudioTrack.slip_offset` is untouched.
- `documentSoundGates` maps `sound.slipOffset` into `resolveClipPlayback` / `toDocumentSoundAudioTrack` instead of a hardcoded zero.
- Timeline timecode reads `[displayFrame] / formatTime(displayTime)` (R7) — playhead frame integer and current position, not total duration. FullscreenOverlay twin untouched.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] DocumentSoundClip.slipOffset fixtures retargeted across the suite**
- **Found during:** Task 3
- **Issue:** The clean-break field add left six test files constructing `DocumentSoundClip` without `slipOffset`, failing typecheck (`PhysicsPaintWorkflowStrip.viewport.test.ts`, `efxPaintDocumentRevision.test.ts`, `documentSoundPeaks.test.ts`, `documentSoundMultiClip.test.ts`, `playbackEngine.test.ts`, `efxPaintStudioOriginSync.scratch.test.ts`).
- **Fix:** Added `slipOffset: 0` to each fixture; `playbackEngine.test.ts` and `documentSoundGates.test.ts` pins retargeted to assert the non-zero mapping.
- **Files modified:** the six fixture test files above
- **Commit:** e0851a5d

**2. [Rule 1 - Bug] clampSlipOffsetFrames returned -0 at the lower edge**
- **Found during:** Task 3
- **Issue:** `Math.max(min, ...)` with `min = -0` produced `-0`, failing `Object.is` equality against `0`.
- **Fix:** Normalize a zero result to plain `0` in `clampSlipOffsetFrames`.
- **Files modified:** app/src/lib/slipOffsetBounds.ts
- **Commit:** e0851a5d

**3. [Rule 3 - Blocking] Position-field source pins retargeted around the new Offset block**
- **Found during:** Task 3
- **Issue:** Existing Position slices in `AudioProperties.test.ts` and `PhysicsPaintAudioModalView.test.ts` ran through the new Offset (s) block and picked up its `min=`/`max=`.
- **Fix:** Slice ends retargeted to `label="Offset (s)"` / `{/* 4b.`.
- **Files modified:** app/src/components/sidebar/AudioProperties.test.ts, app/src/components/physic-paint/view/PhysicsPaintAudioModalView.test.ts
- **Commit:** e0851a5d

## Auth Gates

None.

## Known Stubs

None — no empty values, placeholder copy, or unwired data sources in the plan's files.

## Threat Flags

None — no new network endpoints, auth paths, or trust-boundary schema changes beyond the plan's `<threat_model>` (T-en9-01/02 mitigations landed as unit pins on `setIn`/`setSlipOffset` clamps and the fail-closed `slipOffset` allowlist).

## Verification

Plan-level suite (all green, 188 tests in the 12 named files):

```
pnpm --filter efx-motion-editor exec vitest run src/components/shared/RuleSectionHeader.test.ts src/components/sidebar/AudioProperties.test.ts src/components/timeline/TimelineRenderer.audioPreview.test.ts src/components/layout/TimelinePanel.test.ts src/stores/audioStore.test.ts src/lib/slipOffsetBounds.test.ts src/lib/mainAppAudioSources.test.ts src/lib/audioGain.test.ts src/components/physic-paint/view/PhysicsPaintAudioModalView.test.ts src/components/physic-paint/view/physicsPaintAudioController.test.ts src/efx-paint/document/efxPaintDocumentParsers.test.ts src/lib/documentSoundGates.test.ts
```

Extended regression (playbackEngine, documentSoundPeaks, documentSoundMultiClip, efxPaintDocumentRevision): 229 tests green.

`pnpm exec tsc --noEmit` clean.

Live native UAT (rows 1–8) remains with the user.

## Commits

| Hash | Message |
|------|---------|
| 4ed40975 | feat(quick-261010-en9): section header color + TRACK file/Replace merge + 10px padding |
| 4be41eb2 | feat(quick-261010-en9): timeline gain line + diagonal fades, playhead timecode |
| e0851a5d | feat(quick-261010-en9): In-from-left trim + Offset (s) slip in editor and Studio |

## Self-Check: PASSED

All 17 listed files found on disk. Commits 4ed40975, 4be41eb2, e0851a5d are ancestors of HEAD.

## Status: CLOSED — native UAT PASSED (2026-10-10)

**Quick 261010-en9 is closed.** All live UAT rows approved by the user 2026-10-10: section header rgb(205,201,201), FILE merged into TRACK with file/Replace first, editor timeline gain line + diagonal fades, In-from-left trim (clip end fixed), Offset (s) slip in editor + Studio, playhead timecode `[frame | second]`, 10px section padding. Offset follow-ups landed in e98a6a2d / 327ad773 / 5bb42bad / 256e4e38.
