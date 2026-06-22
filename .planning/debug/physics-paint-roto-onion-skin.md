---
status: resolved
trigger: "Physics Paint Roto onion skinning does not display in runtime."
created: "2026-06-22"
updated: "2026-06-22"
---

# Debug Session: Physics Paint Roto onion skinning does not display in runtime

## Symptoms

### Expected behavior

- Onion skinning is disabled by default.
- Next-frame onion skinning is disabled by default.
- When enabled in Physics Paint Roto mode:
  - Onion value 1 shows the nearest previous and/or next real Roto key at about 50% opacity.
  - Onion value 2 shows the nearest two previous and/or next real Roto keys at about 50% and 25% opacity.
  - Onion value 3 shows the nearest three previous and/or next real Roto keys at about 50%, 25%, and 15% opacity.
- "Nearest" means nearest real saved Roto key depth, not raw numeric frame distance.
- Generated interpolation frames must not be onion sources.
- Play frames must not be onion sources.
- Real saved/cached Roto keys should be onion sources.
- Unsaved in-memory pink Roto frames should be onion sources when available.
- No full-canvas blue/yellow tint should appear.

### Actual behavior

- In Physics Paint Roto mode, onion skinning is enabled in the right panel, but no previous/next onion frame appears on the canvas.
- Screenshot state: Roto mode, timeline shows saved/cached green Roto frame(s), current frame selected around frame 2, Onion tab open, Onion skin checked, Previous checked, Next checked, Onion value 1, and no visible ghost/previous frame on canvas.

### Error messages

- No explicit runtime error was reported.
- User reported the feature still shows no visible onion overlay after prior guessed fixes.

### Timeline

- Onion skinning was working or expected before recent fixes around Roto key utilities and canvas/artifact stabilization.
- Multiple persistence/rendering-oriented fixes were attempted and tests passed, but user-visible runtime still fails.

### Reproduction

1. Open Physics Paint Roto mode.
2. Have at least one saved/cached green Roto frame visible in the timeline.
3. Select a nearby current frame, around frame 2 in the reported screenshot.
4. Open the Onion tab.
5. Enable Onion skin, Previous, and Next with count/value 1.
6. Observe that no previous/next onion overlay appears on the canvas.

## Current Focus

- hypothesis: Unknown. First determine whether `buildOnionPreviewFrames()` produces zero frames or whether produced overlays are hidden/mispositioned in runtime.
- test: Inspect or instrument runtime values for onion state, currentFrame, launchContext.layerId, cached Roto sources, store Roto cache frames, preview frame keys, and final onionPreviewFrames.
- expecting: If `onionPreviewFrames.length` is 0, the source/layer/frame selection is wrong; if greater than 0, the DOM/CSS/positioning/opacity path is wrong.
- next_action: gather initial evidence
- reasoning_checkpoint:
- tdd_checkpoint:

## Evidence

- timestamp: "2026-06-22T19:46:00"
  observation: "TDD red test added for PhysicsPaintStudio onion preview layering. It failed because CSS did not explicitly put the base EFX paint canvas below the onion overlay."
  source: "/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/PhysicsPaintStudio.test.ts"
- timestamp: "2026-06-22T19:46:42"
  observation: "Targeted Vitest test passed after adding explicit canvas z-index layering, but user Tauri runtime validation disproved this as a complete fix."
  source: "pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app exec vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts --testNamePattern 'keeps reference overlays above the base canvas'"
- timestamp: "2026-06-22T20:09:03"
  observation: "Screenshot/runtime feedback shows an onion image is visible but wrong/covered. Code inspection found current-frame cached reference has z-index 1 inside the onion overlay while onion frames had no in-overlay z-index, and local preview frames could overwrite durable saved onionDataUrl candidates. Patched onion frames to z-index 2 and only let local previews override saved candidates when their frame is dirty."
  source: "app/src/components/physic-paint/PhysicsPaintStudio.tsx; app/src/components/physic-paint/physicsPaintStudio.css"

## Eliminated

## Resolution

- root_cause: The current-frame cached Roto reference could cover onion frames inside the overlay, and stale local preview frames could overwrite saved transparent onion payload candidates unless the local frame was genuinely dirty.
- fix: Render onion frames above cached references inside the overlay; preserve saved `onionDataUrl` candidates unless a local dirty preview should override them.
- verification: User confirmed the fix works in the Tauri runtime.
- files_changed: /Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/PhysicsPaintStudio.tsx; /Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/physicsPaintStudio.css; /Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/PhysicsPaintStudio.test.ts
