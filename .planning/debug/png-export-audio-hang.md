---
status: diagnosed
trigger: "PNG Export with Audio Hangs - export doesn't work and can't be cancelled when Include Audio is checked"
created: 2026-03-23T00:00:00Z
updated: 2026-03-23T00:00:00Z
---

## Current Focus

hypothesis: OfflineAudioContext.startRendering() hangs because no sources are actually scheduled (all buffers are null from audioEngine cache miss), causing a silent infinite-duration render, AND cancel is not checked during the audio pre-render phase
test: Trace the code path for PNG+audio export to identify all blocking points
expecting: Identify why renderMixedAudio hangs and why cancel doesn't work during it
next_action: Document root cause analysis

## Symptoms

expected: PNG frames exported plus audio_mix.wav file alongside them
actual: Export doesn't work and can't be cancelled when Include Audio is checked
errors: No specific error messages reported - it hangs
reproduction: Export as PNG sequence with Include Audio checked while having audio tracks
started: Likely since audio export feature was added

## Eliminated

(none yet)

## Evidence

- timestamp: 2026-03-23T00:01:00Z
  checked: exportEngine.ts lines 182-203 - audio pre-render section for PNG export
  found: Audio pre-render runs AFTER all PNG frames are rendered (line 186), sets status to 'preparing', then awaits renderMixedAudio(). No cancel check before or during audio pre-render.
  implication: Cancel button is shown (status is 'preparing') but pressing it only sets cancelled signal - nothing checks it during the audio await.

- timestamp: 2026-03-23T00:02:00Z
  checked: audioExportMixer.ts renderMixedAudio() - full function analysis
  found: Function creates OfflineAudioContext, loops through tracks calling audioEngine.getBuffer(track.id). getBuffer returns cached AudioBuffer from the live AudioEngine singleton. If buffers exist, sources are scheduled and offline.startRendering() is called. The function is a single monolithic await with no cancel support.
  implication: If startRendering() takes a long time or hangs, there is no way to abort it. OfflineAudioContext has no native abort mechanism in the Web Audio API.

- timestamp: 2026-03-23T00:03:00Z
  checked: exportEngine.ts cancel mechanism vs audio pre-render
  found: Cancel check (line 118) only exists inside the frame rendering loop (line 116). After the loop ends (line 164), the code proceeds to sidecar writing (166-180) and audio pre-render (182-203) with ZERO cancel checks. The audio pre-render is a single `await renderMixedAudio()` with no timeout and no abort signal.
  implication: Once PNG frames finish rendering, pressing Cancel does nothing - the code is stuck in an uninterruptible await.

- timestamp: 2026-03-23T00:04:00Z
  checked: OfflineAudioContext behavior analysis
  found: OfflineAudioContext.startRendering() is supposed to complete quickly (renders at CPU speed, not real-time). For a typical project duration of 10-60 seconds at 48kHz, this should take <1 second. However, if totalDurationSec is very large or NaN, totalSamples could be astronomical or invalid, causing the hang.
  implication: Need to check what happens when totalDurationSec = total/fps and if total or fps could produce problematic values.

- timestamp: 2026-03-23T00:05:00Z
  checked: exportEngine.ts line 189 - totalDurationSec calculation
  found: `const totalDurationSec = total / projectStore.fps.peek()`. If fps is 0 or very small, totalDurationSec would be Infinity/huge. Math.ceil((Infinity + 0.5) * 48000) = Infinity. `new OfflineAudioContext(2, Infinity, 48000)` would likely throw or hang.
  implication: Edge case but unlikely root cause for normal usage since fps should always be valid.

- timestamp: 2026-03-23T00:06:00Z
  checked: exportEngine.ts lines 182-203 - the full audio pre-render block structure
  found: THREE distinct issues identified:
    1. NO CANCEL CHECK before entering renderMixedAudio (line 186-190)
    2. renderMixedAudio is not abortable - no AbortSignal support
    3. Even the try/catch on line 198 only catches errors, not hangs
    4. For PNG export, status is set to 'preparing' (line 187) which shows indeterminate progress bar with no frame counter - user sees frozen "Preparing export..." state
  implication: This is a compound bug - the export appears hung because (a) there's no progress indication during audio render and (b) cancel doesn't work during this phase.

## Resolution

root_cause: Two interacting issues cause the PNG+audio export to appear hung and be uncancellable:

1. **No cancel check during audio pre-render phase** (exportEngine.ts:186-203): After the PNG frame loop completes, the code enters the audio pre-render section. The cancel signal (exportStore.isCancelled()) is never checked before calling renderMixedAudio() or between the audio render and WAV file write. Pressing Cancel during this phase sets the signal but nothing reads it.

2. **OfflineAudioContext.startRendering() is not abortable** (audioExportMixer.ts:119): The renderMixedAudio function calls `offline.startRendering()` which is a single monolithic Promise with no abort mechanism. The Web Audio API's OfflineAudioContext does not support cancellation. If this call takes longer than expected (large project duration, many tracks, or a browser-level issue with OfflineAudioContext), there is no escape path.

3. **UX issue compounds the problem**: During audio pre-render, status is set to 'preparing' (line 187) which shows an indeterminate progress bar saying "Preparing export..." with no indication that audio is being rendered. The user sees what appears to be a frozen export.

The likely actual hang cause: OfflineAudioContext.startRendering() should normally complete very quickly (sub-second for reasonable durations). If it's truly hanging (not just slow), this could be a Tauri/WebView2 specific issue with OfflineAudioContext, or the totalSamples calculation may produce an unreasonably large value. However, the SAME audio pre-render code runs for video export too (line 190 in both paths), confirming this shares root cause with the video export hang.

fix:
verification:
files_changed: []
