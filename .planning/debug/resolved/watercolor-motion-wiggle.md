---
status: resolved
trigger: |
  Follow-up to the resolved reveal-watercolor-regression session.

  User (2026-10-26), Paint Rail Motion tab, watercolor script, single stroke,
  10 frames, Motion wiggle Deformation 62 / Position 85:
  "No work. When animating, the previous part of stroke do not animate and
  stay straight ... No position move or deformation."

  Then: "it need to have wiggle for reveal, motion and static !"
created: 2026-10-26
updated: 2026-10-26
goal: find_and_fix
---

# Debug Session: watercolor-motion-wiggle

DATA_START

## Symptoms

### Expected behavior

Watercolor (engine-2) playback and baked rails must show the Play Script Motion
wiggle in **all** variants:

- Paint Rail · Motion: the already-drawn part of the stroke must animate
  (position move + deformation bend) as the span plays.
- Paint Rail · Static: the complete settled drawing must appear on every frame
  and still wiggle frame to frame.
- Reveal · Motion and Reveal · Static: the revealed photo patch must move with
  the same settings.

### Actual behavior

The aquarelle bake applied the held pose ONCE per stroke at its deposit frame.
The fluid sheet is cumulative, so the pose was frozen into the deposited
pigment: a single-stroke script had exactly one pose and never moved. The
previous part of a progressively drawn stroke stayed straight; only the
freshly deposited part extended it. Paint Static also baked progressive growth
(the controller ignored `renderMode` for engine-2).

## Root Cause

`packages/efx-watercolor/src/bake/aquarelleBake.ts` transformed the timed
stroke points before deposit (`transformRecordedStrokeForHeldPose` at each
stroke's begin frame). Once deposited, the pigment cannot be re-warped by the
fluid sim, so no per-frame motion reached the captured frames. The Play/Apply
rail path (`bakeAquarelleScript` in
`app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts`)
consumed those frozen frames; the Reveal path masked with them.

## Fix

- `packages/efx-watercolor/src/bake/aquarelleBake.ts`: removed the per-deposit
  motion transform. Added a `poseFrame(frame, outputFrameIndex)` seam applied
  to each CAPTURED progressive frame before encoding. The seam is identity when
  not supplied.
- `app/src/components/physic-paint/roto/aquarelleFramePose.ts` (new): shared
  held-pose math. `computeAquarelleSheetPose`/`drawAquarelleSheetPose` provide
  the rigid similarity used by Reveal; `drawAquarelleSheetDeform` applies a
  continuous piecewise-affine band warp (16 bands, top/bottom offsets from a
  vertical shadow stroke run through the same stroke law) so a straight stroke
  actually bends frame to frame.
- Paint frames are opaque MODE.transparent transmittance (white = no pigment):
  both warps fill the posed margins white so `isFullyOpaqueRaster` keeps the
  multiply law. Reveal coverage stays transparent and uses the rigid pose (no
  band seams in the alpha mask).
- `bakeAquarelleScript` now takes `mode`. Motion bakes `count` progressive
  warped frames. Static bakes ONE settled wash (`frameCount: 1`), then derives
  `count` output frames posed per frame — complete drawing on every frame, with
  wiggle (engine-1 static parity). Zero motion reuses the settled bytes.
- Reveal (`physicsPaintRotoPlayScriptRenderer.ts`) keeps its unposed wash bake
  and poses the flattened coverage per output frame via the shared rigid pose;
  this covers Reveal Motion and Reveal Static.

## Current Focus

hypothesis: confirmed; the fix is applied.
test: Native UAT approved 2026-10-26 (all variants). Automated gates: app
`tsc --noEmit` clean; package `tsc --noEmit` clean; 1,126 roto tests pass
(48 files); 130 package tests pass (4 skipped); focused reveal/bake/controller
59 pass.
expecting: confirmed live — Paint Motion/Static and Reveal Motion/Static all
animate with Deformation/Position > 0; existing baked rails require recreation.
next_action: None. Committed with the reveal-watercolor-regression work.

## Resolution

root_cause: >-
  The aquarelle bake applied the held pose once per stroke at its deposit
  frame. The cumulative fluid sheet froze that pose into the pigment, so a
  single-stroke script had one pose and the already-drawn part never moved.
  Paint Static also baked progressive growth because the engine-2 branch
  ignored `renderMode`.
fix: >-
  The bake now exposes a `poseFrame(frame, outputFrameIndex)` seam applied to
  each captured progressive frame; a new `aquarelleFramePose.ts` supplies a
  continuous 16-band piecewise-affine deform warp (paint, white transmittance
  margins) and a rigid sheet pose (reveal coverage, transparent margins). The
  controller passes `mode`: Motion bakes `count` warped progressive frames;
  Static bakes one settled wash and derives `count` posed copies (complete
  drawing on every frame). Reveal poses its flattened coverage per output
  frame, covering Reveal Motion and Reveal Static.
verification: >-
  Native UAT approved 2026-10-26 for Paint Motion, Paint Static, Reveal Motion
  and Reveal Static. App/package typechecks clean; 1,126 roto tests + 130
  watercolor package tests + 59 focused reveal/bake/controller tests pass.
files_changed:
  - packages/efx-watercolor/src/bake/aquarelleBake.ts
  - packages/efx-watercolor/src/bake/aquarelleBake.test.ts
  - app/src/components/physic-paint/roto/aquarelleFramePose.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.test.ts

DATA_END
