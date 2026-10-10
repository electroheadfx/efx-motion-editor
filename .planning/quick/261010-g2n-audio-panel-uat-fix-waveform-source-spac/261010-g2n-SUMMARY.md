---
phase: quick-261010-g2n
plan: 261010-g2n
subsystem: timeline-audio
tags: [waveform, source-space, audio-trim, slip-offset, fit-to-view, preact-signals, canvas]

# Dependency graph
requires:
  - phase: quick-261010-en9
    provides: soundBandGeometry overlays, slipOffsetBounds law, In-from-left trim
  - phase: quick-261010-bkv
    provides: audioGain dB bridge, SliderStepper unit labels, TRACK/FADES/POSITION layout
  - phase: quick-261009-rko
    provides: never-copy handleReplace disk-reference law
provides:
  - Source-space audio waveform windowing (trim cuts, slip slides, stable tier)
  - computeAudioFitToView crop math + audioStore.fitToView one-undo
  - Fit to view control on AudioProperties POSITION
  - Replace file-row button chrome (verbatim label, spinner kept)
affects: [timeline-rendering, audio-panel, waveform-tiering, audio-undo]

actuals:
  tokens: 8200
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Source-space draw window (mirror getPhysicPaintSoundStainGeometry): peaks live in SOURCE pixels, the clip bar is a viewport"
    - "Tier selection on source-pixel density (sourceScale * totalAudioFrames / tier2Count) instead of barW / full-file peak count"
    - "One-snapshot store setter for multi-field crops (fitToView) instead of chained per-field undos"

key-files:
  created:
    - app/src/lib/audioClipGeometry.ts
    - app/src/lib/audioClipGeometry.test.ts
  modified:
    - app/src/components/timeline/TimelineRenderer.ts
    - app/src/components/timeline/TimelineRenderer.audioPreview.test.ts
    - app/src/stores/audioStore.ts
    - app/src/stores/audioStore.test.ts
    - app/src/components/sidebar/AudioProperties.tsx
    - app/src/components/sidebar/AudioProperties.test.ts

key-decisions:
  - "Peaks are drawn once in SOURCE space and windowed to the clip bar; the old visiblePeakCount rescale-to-bar mapping is deleted"
  - "Tier threshold stays 1-4 px but is measured on source scale so a short zoomed clip on a long file gets tier3"
  - "Fit to view writes inFrame/outFrame/offsetFrame/slipOffset:0 from ONE audioStore snapshot — never chained setIn/setInOut/setSlipOffset"
  - "computeAudioFitToView returns null on full-visible or empty intersection so no store write and no undo entry is created"
  - "handleReplace never-copy region left byte-stable; only the button chrome after the volumePercent anchor changed"

patterns-established:
  - "audioClipGeometry is the pure home of source-window + fit math; drawAudioTrack and AudioProperties stay thin callers"

requirements-completed: [QUICK-261010-G2N]

coverage:
  - id: W1
    description: "Source-space waveform windowing and tier selection (trim cuts, slip slides, short-window detail)"
    requirement: QUICK-261010-G2N
    verification:
      - kind: unit
        ref: "src/lib/audioClipGeometry.test.ts (10 cases: source mapping, slip slide, trim-cut, tiers)"
        status: pass
      - kind: unit
        ref: "src/components/timeline/TimelineRenderer.audioPreview.test.ts (source-space pins reject vi/visiblePeakCount*barW)"
        status: pass
    human_judgment: false
  - id: W2
    description: "Fit to view crop with one undo + AudioProperties POSITION control"
    requirement: QUICK-261010-G2N
    verification:
      - kind: unit
        ref: "src/lib/audioClipGeometry.test.ts#computeAudioFitToView (crop/slip/no-op/min-span/file clamp)"
        status: pass
      - kind: unit
        ref: "src/stores/audioStore.test.ts#fitToView (single history entry, undo restores slip)"
        status: pass
      - kind: unit
        ref: "src/components/sidebar/AudioProperties.test.ts#Fit to view (control wiring, null early-return)"
        status: pass
    human_judgment: false
  - id: W3
    description: "Replace file-row button chrome (verbatim label Replace, spinner while replacing)"
    requirement: QUICK-261010-G2N
    verification:
      - kind: unit
        ref: "src/components/sidebar/AudioProperties.test.ts#Replace file-row button (label, chrome, spinner)"
        status: pass
      - kind: unit
        ref: "src/lib/mainAppAudioSources.test.ts (never-copy handleReplace pins)"
        status: pass
    human_judgment: false
  - id: UAT-ROWS
    description: "Live native UAT rows 1-5 (short-window detail, Out-nudge stability, Offset slide, Fit to view, Replace affordance)"
    verification: []
    human_judgment: true
    rationale: "Native visual UAT stays with the user per project law; automated-ready only until live rows pass."

duration: 11min
completed: 2026-10-10
status: complete
---

# Quick 261010-g2n: Audio panel UAT fix — source-space waveform, Fit to view, Replace

**Source-space waveform windowing (trim cuts, slip slides, stable tier) plus one-undo Fit to view and a real Replace button on the audio file row.**

## Performance

- **Duration:** 11 min
- **Tasks:** 3/3
- **Commits:** 3

## Accomplishments

- Created `audioClipGeometry.ts` with `audioSourceSpaceGeometry` and `selectAudioPeakTier` — source-space draw law mirroring `getPhysicPaintSoundStainGeometry`.
- Rewired `drawAudioTrack` peak drawing to source positions (`sourceX + (pi/fullPeakCount)*sourceW`) clipped to the bar; deleted the `visiblePeakCount` rescale-to-bar mapping that caused spike/blob and swimming.
- Tier selection now measures source-pixel density so a short zoomed window on a long file stays tier3 instead of collapsing to tier1.
- Added `computeAudioFitToView` (partial crop, slip accounting, full-visible and empty no-ops, 1-frame minimum, file-window clamp).
- Added `audioStore.fitToView` writing In/Out/Position/slipOffset:0 in one snapshot/restore undo (single history entry).
- Added a `Fit to view` control in AudioProperties POSITION that reads timelineStore viewport signals and returns early on null before any store call.
- Promoted the file-row Replace affordance to a real small-button (BPM x2 / /2 chrome shape), label verbatim `Replace`, spinner branch kept; `handleReplace` never-copy body byte-stable.

## Deviations from Plan

None - plan executed exactly as written.

## Auth Gates

None.

## Known Stubs

None.

## Threat Flags

None.

## Self-Check: PASSED

- FOUND: app/src/lib/audioClipGeometry.ts
- FOUND: app/src/lib/audioClipGeometry.test.ts
- FOUND: app/src/components/timeline/TimelineRenderer.ts
- FOUND: app/src/components/timeline/TimelineRenderer.audioPreview.test.ts
- FOUND: app/src/stores/audioStore.ts
- FOUND: app/src/stores/audioStore.test.ts
- FOUND: app/src/components/sidebar/AudioProperties.tsx
- FOUND: app/src/components/sidebar/AudioProperties.test.ts
- FOUND: f9ce5ec3 (Task 1)
- FOUND: c42e7538 (Task 2)
- FOUND: 255c5b48 (Task 3)
