---
status: resolved
trigger: |-
  Do a triage of this bugs from verify phase 36.1:
  - why play paint open the first time, show 600 in duration ? why it not just set the duration of maximun physic paint layer in efx motion timeline based on position and in/out layer ?

  - what is difference in play paint between 'Render' and 'save play' button ??? why not just a simple one button ?

  - when I added script animation to physic paint layer and I want open it, the script is there in efx physic paint but the cache is lost, I need to re- save play again for have cache preview with scrubbing in timeline

  - the canvas script animation is not saved with motion options like deform and move

  - motion options should to be more jitter values than a smooth motion/deform variation, I think it need random, and ramdom strength are controled by the value, each frame may have a random value range for position and deform stroke 

  - I want the roto paint button desactived in efx-motion physics paint layer properties when the active sub layer is a PLay paint from timeline

  - I asked ability to delete the roto or play paint script, why not add this delete button in physic paint layer properties under Roto paint and play paint buttons
created: 2026-06-14
updated: 2026-06-14
---

# Debug Session: phase-36-1-verify-bugs

## Symptoms

### Expected behavior
- Play Paint first-open duration should be derived from the maximum relevant physics paint timeline layer duration, using timeline position plus in/out range, not a hard-coded 600.
- Play Paint should expose one clear action for rendering/saving cached playback instead of separate ambiguous `Render` and `Save Play` buttons.
- Reopening an existing physics paint script animation should preserve or restore the cache preview used for scrubbing in the EFX Motion timeline without requiring another Save Play.
- Canvas script animations should persist motion options such as deform and move.
- Motion options should behave like per-frame jitter/randomization, with the value controlling random strength/range for position and deform stroke changes.
- Roto Paint should be disabled in physics paint layer properties when the active timeline sublayer is a Play Paint sublayer.
- Physics paint layer properties should provide delete controls for Roto Paint and Play Paint scripts under their respective buttons.

### Actual behavior
- Play Paint opens the first time with duration `600`.
- The UI shows both `Render` and `Save Play`, making their difference unclear.
- Existing script animation data appears in EFX Physics Paint when reopened, but the cache preview is lost until Save Play is run again.
- Canvas script animation does not save motion options like deform and move.
- Current motion options appear too smooth rather than random/jitter-based.
- Roto Paint remains available even when the active sublayer is Play Paint from the timeline.
- Delete controls for Roto Paint / Play Paint scripts are missing from layer properties.

### Error messages
None reported.

### Timeline
Reported during verify phase 36.1 on 2026-06-14.

### Reproduction
Use physics paint layer properties and timeline Play Paint/Roto Paint flows during Phase 36.1 verification; specific per-bug reproduction paths need confirmation from code and current UI behavior.

## Current Focus

hypothesis: The Phase 36.1 Play Paint/Roto Paint UI and persistence flows have multiple integration gaps around default duration calculation, cache serialization/restoration, motion option serialization, action naming, and sublayer-specific controls.
test: Inspect the physics paint layer properties, Play Paint transport/cache persistence, motion option save path, and timeline active sublayer selection logic.
expecting: Distinct code paths or missing state fields explain each reported symptom; triage should classify which are bugs versus UX/product decisions and identify exact fix surfaces.
next_action: gather initial evidence
reasoning_checkpoint: 
tdd_checkpoint: 

## Evidence
- timestamp: 2026-06-14T00:00:00Z
  source: app/src/lib/physicPaintBridge.ts
  finding: New Play launch sets playFrameCount to physicPaintStore.getMaxPlayFrameCountFromGap(); when there is no next Play script this returns PHYSIC_PAINT_MAX_APPLY_FRAMES (600), without considering the containing timeline sequence in/out range.
- timestamp: 2026-06-14T00:00:00Z
  source: app/src/components/physic-paint/PhysicsPaintWorkflowStrip.tsx
  finding: Play mode renders both a Render button and a Save play button; Render either previews cached frames or saves if stale, while Save play always regenerates/saves, creating the ambiguous duplicate action.
- timestamp: 2026-06-14T00:00:00Z
  source: app/src/lib/physicPaintBridge.ts and app/src/components/physic-paint/PhysicsPaintStudio.tsx
  finding: Saved Play ranges with cacheStatus cached do pass cachedPlayFrames on reopen when the rendered frames are present; if the range is stale after conversion/motion edits the standalone intentionally has no cache until Save Play regenerates it.
- timestamp: 2026-06-14T00:00:00Z
  source: app/src/stores/physicPaintStore.ts and app/src/types/physicPaint.ts
  finding: Play motion settings are serialized in play_script_ranges.motion and play_motion on apply, but unsaved motion slider changes only live in the standalone launch context until Save Play applies them.
- timestamp: 2026-06-14T00:00:00Z
  source: app/node_modules/@efxlab/efx-physic-paint/src/animation/AnimationPlayer.ts
  finding: Motion currently uses deterministic sine/cosine wiggle per frame, explaining the smooth motion/deform look instead of random jitter.
- timestamp: 2026-06-14T00:00:00Z
  source: app/src/components/sidebar/PhysicPaintProperties.tsx
  finding: Properties panel always enables Roto paint and has no delete controls for current Roto frame or active Play range.

## Eliminated

## Specialist Review

- timestamp: 2026-06-14T00:00:00Z
  specialist_hint: typescript
  result: LOOKS_GOOD: The fix direction targets the right TypeScript/Preact surfaces: launch-context duration clamping, ambiguous Play action UI, and layer-properties sublayer controls. Preserve persisted project output when deleting Play by removing both frames and play_script_ranges, and cover timeline limits in tests.

## Resolution

root_cause: Phase 36.1 Play/Roto Paint integration left Play duration tied to the 600-frame engine cap, split Play cache rendering into two confusing actions, and did not expose sublayer-aware Roto/Play controls in physics layer properties; cache/motion persistence mostly existed but stale scripts require regeneration and motion jitter is implemented as smooth deterministic wiggle in the upstream animation player.
fix: Clamped new Play launch duration by the containing timeline layer range, collapsed the Play strip to one Preview / Save Play action, disabled Roto inside active Play ranges, added Delete Roto/Delete Play controls that remove current frames and Play script ranges, and updated source-contract tests.
verification: `pnpm --dir "/Users/lmarques/Dev/efx-motion-editor/app" test --run src/lib/physicPaintBridge.test.ts src/components/sidebar/PhysicPaintProperties.test.ts src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts` passed (57 tests).
files_changed: app/src/lib/physicPaintBridge.ts; app/src/components/physic-paint/PhysicsPaintWorkflowStrip.tsx; app/src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts; app/src/components/sidebar/PhysicPaintProperties.tsx; .planning/debug/phase-36-1-verify-bugs.md
