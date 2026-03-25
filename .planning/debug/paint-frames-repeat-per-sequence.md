---
status: awaiting_human_verify
trigger: "Paint applied to first N frames repeats at the start of every sequence instead of playing only on the absolute timeline frames where it was painted."
created: 2026-03-25T10:00:00Z
updated: 2026-03-25T10:10:00Z
---

## Current Focus

hypothesis: CONFIRMED - Paint is stored keyed by global frame (via timelineStore.currentFrame) but retrieved using sequence-local frame index in renderFrame, causing paint to repeat at every sequence boundary
test: TypeScript compiles, tests pass (no regressions)
expecting: User confirms paint layers only render on the global frames where they were painted
next_action: Await human verification

## Symptoms

expected: Paint on frames 0-2 should only render on absolute timeline frames 0-2, regardless of sequence boundaries.
actual: Paint on frames 0-2 repeats at the start of every sequence. If the project has 3 sequences, the paint appears 3 times -- once at the beginning of each sequence.
errors: No console errors
reproduction: 1. Create a project with multiple sequences. 2. Paint on the first 3 frames (frame 0, 1, 2). 3. Play the timeline or export -- observe paint repeating at each sequence start.
started: Never worked correctly. First time testing paint across sequences.

## Eliminated

## Evidence

- timestamp: 2026-03-25T10:05:00Z
  checked: TypeScript compilation after fix
  found: No new errors (2 pre-existing unrelated errors in SidebarProperties.tsx and glslRuntime.test.ts)
  implication: Fix is type-safe and backward compatible.

- timestamp: 2026-03-25T10:05:30Z
  checked: Test suite after fix
  found: No new test failures (4 pre-existing failures in audioWaveform.test.ts and projectStore.test.ts)
  implication: Fix does not regress existing functionality.

- timestamp: 2026-03-25T10:01:00Z
  checked: PaintOverlay.tsx - how paint data is stored
  found: Paint elements are added via paintStore.addElement(layerId, frame, element) where frame = timelineStore.currentFrame.peek() (lines 251, 301). timelineStore.currentFrame is a global timeline frame number (0..totalFrames-1).
  implication: Paint data is keyed by GLOBAL frame number in the paintStore._frames map.

- timestamp: 2026-03-25T10:02:00Z
  checked: exportRenderer.ts renderGlobalFrame() - how frame index is computed
  found: Line 111: localFrame = globalFrame - seqStart. This localFrame is passed to renderer.renderFrame() on lines 228, 242, 256. For each sequence, localFrame starts at 0 again.
  implication: PreviewRenderer receives a LOCAL frame number, not the global frame number.

- timestamp: 2026-03-25T10:03:00Z
  checked: previewRenderer.ts renderFrame() - how paint is retrieved
  found: Line 270: paintStore.getFrame(layer.id, frame) where frame is the localFrame passed from renderGlobalFrame. When rendering sequence 2 at its first frame, localFrame=0, so paintStore returns paint data stored at global frame 0.
  implication: This is the root cause. Local frame 0 of every sequence maps to the same paint data as global frame 0.

- timestamp: 2026-03-25T10:04:00Z
  checked: Preview.tsx live preview path
  found: Preview.tsx calls renderGlobalFrame with timelineStore.currentFrame (global). renderGlobalFrame computes localFrame and passes it to renderer.renderFrame(). Same bug affects live preview playback.
  implication: Bug affects both live preview playback and export.

- timestamp: 2026-03-25T10:04:30Z
  checked: paintStore.getFrame signature and _frames structure
  found: _frames is Map<string, Map<number, PaintFrame>> keyed as layerId -> frameNumber -> PaintFrame. The frame number used at storage time is the global frame. At retrieval time, localFrame is used instead.
  implication: Fix needs to ensure retrieval uses the same global frame number that was used at storage time.

## Resolution

root_cause: In exportRenderer.ts renderGlobalFrame(), the function computes localFrame = globalFrame - seqStart and passes it to renderer.renderFrame(). PreviewRenderer.renderFrame() uses this frame parameter to look up paint data via paintStore.getFrame(layer.id, frame). But paint data is stored by PaintOverlay.tsx using the global frame number (timelineStore.currentFrame). So when rendering sequence 2 starting at global frame 10, localFrame=0 matches paint stored at global frame 0 -- causing paint to repeat at every sequence boundary.
fix: Added optional globalFrame parameter (7th arg) to PreviewRenderer.renderFrame(). Paint layer lookups now use this global frame when provided, falling back to the local frame parameter when omitted (backward compatible). Updated all 8 call sites in exportRenderer.ts to pass globalFrame through.
verification: TypeScript compiles with no new errors (2 pre-existing). Test suite passes with no new failures (4 pre-existing). Awaiting human verification.
files_changed: [Application/src/lib/previewRenderer.ts, Application/src/lib/exportRenderer.ts]
