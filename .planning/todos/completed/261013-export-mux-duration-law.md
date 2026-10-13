---
id: 261013-export-mux-duration-law
title: "Export mux duration law — audio stream runs 0.5s past video (-shortest or drop the pad)"
status: completed
created: 2026-10-13
completed: 2026-10-13
resolution: "Option 2 landed in quick 261013-ctd (commits 0c234cc6 RED, c27b9428 GREEN) — ffmpeg -shortest on the audio arm; mixer +0.5 pad kept. UAT passed 2026-10-13."
resolves_phase: null
source: 53.1-06 live UAT finding (pre-existing, NOT a 53.1 regression)
severity: major
blocks_release: false
milestone: v1.0.1
---

# Export mux duration law — audio stream runs 0.5s past video

**Finding (2026-10-13, during 53.1-06 live UAT):** the exported container carries an
audio stream 0.5 s longer than the video stream. Pre-existing export-mux behavior,
not a 53.1 regression. 53.1-06 frame-model rows are judged independently and are
NOT blocked by this.

## Measured cause

- `audioExportMixer` renders `totalDurationSec + 0.5` (the pad)
- the ffmpeg encode invoke passes no `-shortest`
- → container audio duration = video duration + 0.5 s

## Visible symptom

Short exports show player divergence: macOS Preview shows the last frame, VLC and
QuickTime do not. The frame is present in the file — this is container/stream
duration disagreement, not a missing frame.

## Fix options (either closes the law)

1. **Drop the pad** — `audioExportMixer` renders exactly `totalDurationSec`
2. **Add `-shortest`** — ffmpeg mux truncates the longer stream to the shorter one

## Disposition

- Rides a SEPARATE quick. Do not fold into 53.1 scope.
- v1.0.1 release stays blocked ONLY on the 53.1 frame-model UAT verdict — this
  quick is NOT a release blocker.
- Milestone: v1.0.1 (debt patch), non-blocking.

## Files

- `app/src/lib/audioExportMixer.ts` (the +0.5 pad)
- the ffmpeg encode invoke (missing `-shortest`) — see `exportEncodeVideo` path
  in `app/src/lib/exportEngine.ts` / the Rust encode side
