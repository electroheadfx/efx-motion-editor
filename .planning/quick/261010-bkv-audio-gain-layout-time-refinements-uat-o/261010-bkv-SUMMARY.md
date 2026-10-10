---
phase: quick-261010-bkv
plan: 261010-bkv
subsystem: audio-ui
tags: [preact, signals, audio, gain, db, slider-stepper, studio, sidebar]

# Dependency graph
requires:
  - phase: quick-261009-v0s
    provides: AudioProperties SliderStepper re-flow and the Studio document-sound modal field order
  - phase: quick-261009-rko
    provides: never-copy audio import/replace doors and the volumePercent pin anchor
provides:
  - audioGain.ts converters (dB↔linear, Studio gain↔dB, frames↔seconds, audio-max readout)
  - Editor TRACK section with logarithmic Gain (dB -20..+20) + mute
  - Studio Gain speaking dB while stored gain stays integer -100..+100
  - 2-column fades and In/Out layout in the editor sidebar
  - Position sliderMax from the timeline end; In/Out in audio seconds
affects: [audio playback engine mapping, document sound gates, studio audio modal, sidebar audio properties]

actuals:
  tokens: 12728
  tasks: 3
  commits: 5

tech-stack:
  added: [app/src/lib/audioGain.ts]
  patterns:
    - "dB is the only UI amplitude domain; persistence stays linear volume (editor) or integer -100..+100 gain (Studio)"
    - "audioGain.ts is the single bridge — no ad-hoc 10^(x/20) outside it"

key-files:
  created:
    - app/src/lib/audioGain.ts
    - app/src/lib/audioGain.test.ts
  modified:
    - app/src/components/sidebar/AudioProperties.tsx
    - app/src/components/sidebar/AudioProperties.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintAudioModalView.tsx
    - app/src/components/physic-paint/view/PhysicsPaintAudioModalView.test.ts
    - app/src/components/physic-paint/view/physicsPaintAudioController.ts
    - app/src/components/physic-paint/view/physicsPaintAudioController.test.ts
    - app/src/lib/documentSoundGates.ts
    - app/src/lib/documentSoundGates.test.ts
    - app/src/lib/playbackEngine.test.ts
    - app/src/types/audio.ts

key-decisions:
  - "dB domain is perceptually uniform: UI values are dB, persistence unchanged (linear volume / integer gain)"
  - "Studio gain -100..+100 remaps via 10^(gain/100) so gain/5 equals dB and +100 is +20 dB"
  - "In/Out seconds are a view unit only — inFrame/outFrame stay frames from audio file start"
  - "Position sliderMax reads frameMap totalFrames, never the clip trim span"

patterns-established:
  - "audioGain converters as the only dB/amplitude bridge"
  - "pair layout via inline grid matching Studio .physics-paint-audio-pair (minmax(0,1fr) columns)"

requirements-completed: [QUICK-261010-BKV]

coverage:
  - id: UAT-1
    description: "Editor TRACK section holds name + Gain (dB -20..+20, default 0) + mute; no standalone volume section"
    requirement: QUICK-261010-BKV
    verification:
      - kind: unit
        ref: "src/components/sidebar/AudioProperties.test.ts > AudioProperties TRACK section"
        status: pass
    human_judgment: true
    rationale: "Native sidebar layout and mute affordance need live visual UAT"
  - id: UAT-2
    description: "Studio Document-sound Gain is the same -20..+20 dB control; engine receives true linear amplitude"
    requirement: QUICK-261010-BKV
    verification:
      - kind: unit
        ref: "src/lib/documentSoundGates.test.ts > toDocumentSoundAudioTrack maps the document sound"
        status: pass
      - kind: unit
        ref: "src/components/physic-paint/view/physicsPaintAudioController.test.ts > commitGain speaks dB"
        status: pass
    human_judgment: true
    rationale: "Studio modal Gain slider feel needs live UAT"
  - id: UAT-3
    description: "Editor fades render as two side-by-side SliderStepper columns with each curve select under its own bar"
    requirement: QUICK-261010-BKV
    verification:
      - kind: unit
        ref: "src/components/sidebar/AudioProperties.test.ts > wraps the two fades and In/Out each in a 2-column pair"
        status: pass
    human_judgment: true
    rationale: "Sidebar pair geometry needs live visual UAT"
  - id: UAT-4
    description: "Editor In/Out each render as two side-by-side SliderStepper columns under full-width Position"
    requirement: QUICK-261010-BKV
    verification:
      - kind: unit
        ref: "src/components/sidebar/AudioProperties.test.ts > wraps the two fades and In/Out each in a 2-column pair"
        status: pass
    human_judgment: true
    rationale: "Sidebar pair geometry needs live visual UAT"
  - id: UAT-5
    description: "Editor Position sliderMax is the timeline totalFrames end (not the clip trim span)"
    requirement: QUICK-261010-BKV
    verification:
      - kind: unit
        ref: "src/components/sidebar/AudioProperties.test.ts > Position sliderMax reaches the timeline end"
        status: pass
    human_judgment: true
    rationale: "Dragging Position out to the last track end needs live UAT"
  - id: UAT-6
    description: "Editor In/Out display and commit in audio seconds; Out defaults to and is capped by the audio max time"
    requirement: QUICK-261010-BKV
    verification:
      - kind: unit
        ref: "src/components/sidebar/AudioProperties.test.ts > In/Out display and commit in audio seconds"
        status: pass
    human_judgment: true
    rationale: "Seconds feel and Out default need live UAT"
  - id: UAT-7
    description: "Studio In/Out display and commit in audio seconds with Out capped by source max"
    requirement: QUICK-261010-BKV
    verification:
      - kind: unit
        ref: "src/components/physic-paint/view/PhysicsPaintAudioModalView.test.ts > Trim in/out display and commit in audio seconds"
        status: pass
    human_judgment: true
    rationale: "Studio modal seconds feel needs live UAT"
  - id: UAT-8
    description: "TRACK/file meta shows the audio max as seconds plus frames (e.g. 3.5s / 84 frames)"
    requirement: QUICK-261010-BKV
    verification:
      - kind: unit
        ref: "src/lib/audioGain.test.ts > formatAudioMaxTime"
        status: pass
    human_judgment: true
    rationale: "Readout placement and wording need live visual UAT"

duration: 29min
completed: 2026-10-10
status: complete
---

# Quick 261010-bkv: Audio gain/layout/time refinements Summary

**Logarithmic dB Gain in a TRACK section, 2-column fades/In-Out, timeline-end Position range, and In/Out in audio seconds across the editor sidebar and Studio document-sound modal.**

## Performance

- **Duration:** 29 min
- **Tasks:** 3/3
- **Commits:** 5
- **Files:** 12

## Accomplishments

- Created `app/src/lib/audioGain.ts` — the single dB↔linear, Studio gain↔dB, and frames↔seconds bridge (GAIN_DB_MIN/MAX ±20, dbToLinear/linearToDb, gainToDb/dbToGain, framesToSeconds/secondsToFrames, formatAudioMaxTime).
- Reworked the editor sidebar into a TRACK section (name + Gain dB slider + mute) and dropped the standalone volume section and percent readout.
- Studio Gain now speaks dB (-20..+20); `commitGain` converts through `dbToGain` and stores integer -100..+100. Invalid dB never commits.
- `toDocumentSoundAudioTrack` maps gain/5 dB to true linear amplitude (gain 0 → 1, -100 → 0.1, +100 → 10).
- Editor fades and In/Out each sit in a 2-column pair matching the Studio pair geometry; curve selects stay under their own bars.
- Position `sliderMax` reads `frameMap.totalFrames` (floored at `offsetFrame`) so the clip can reach the timeline end.
- Editor and Studio In/Out display and commit in audio seconds while `inFrame`/`outFrame` stay frames; Out floors at in+1 frames and caps at the audio max time.
- TRACK/file meta shows `{seconds}s / {frames} frames` (e.g. 3.5s / 84 frames).

## Deviations from Plan

### Auto-fixed Issues

None — plan executed as written.

### Process notes

**1. [TDD gate] Separate RED commits instead of one atomic commit per TDD task**
- **Found during:** Tasks 1 and 3
- **Issue:** The plan asked for one atomic commit per task; the TDD runtime gate requires a failing-test commit before the implementation step.
- **Fix:** Task 1 and Task 3 each produced a `test(quick-261010-bkv)` RED commit followed by a `feat(quick-261010-bkv)` GREEN commit. Task 2 (non-TDD) stayed one atomic commit.
- **Commits:** 03d8329d + c7ddae7b (Task 1), c5fb4c01 + e451e172 (Task 3)

**2. [Rule 2] types/audio.ts volume comment updated**
- **Found during:** Task 1
- **Issue:** Plan action (2) required the linear-amplitude comment update but `types/audio.ts` was absent from the plan's `files_modified` list.
- **Fix:** Updated the comment only (field name/type unchanged) and included the file in the Task 1 commit.

## Auth Gates

None.

## Known Stubs

None.

## Threat Flags

None beyond the plan's threat model (T-261010-bkv-01 mitigations landed: dB clamped to [-20,20], invalid Studio dB never commits, mapVolume receives finite 0.1..10 only).

## Verification

```
pnpm --filter efx-motion-editor exec vitest run src/lib/audioGain.test.ts src/components/sidebar/AudioProperties.test.ts src/components/physic-paint/view/PhysicsPaintAudioModalView.test.ts src/components/physic-paint/view/physicsPaintAudioController.test.ts src/lib/documentSoundGates.test.ts src/lib/playbackEngine.test.ts src/lib/mainAppAudioSources.test.ts && pnpm --filter efx-motion-editor run typecheck
```

Result: **GREEN** — 133 passed, 7 todo, typecheck clean.

## UAT Status

**Automated-ready.** Status stays automated-ready until the user's live UAT passes rows 1-8 (TRACK+Gain dB, Studio Gain dB, 2-col fades, 2-col In/Out, Position timeline sliderMax, In/Out audio time + default Out max, Studio In/Out audio time, max-time readout). No claim of done before that UAT.

## Self-Check: PASSED

- FOUND: app/src/lib/audioGain.ts
- FOUND: app/src/lib/audioGain.test.ts
- FOUND: 03d8329d
- FOUND: c7ddae7b
- FOUND: afb8f463
- FOUND: c5fb4c01
- FOUND: e451e172
