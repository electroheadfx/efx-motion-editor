---
status: testing
phase: 52-shared-mask-compositor-and-reveal
source: [52-VERIFICATION.md]
started: 2026-09-02T19:10:00Z
updated: 2026-09-03T00:00:00Z
---

## Current Test

number: 2
name: Native UAT: modal "Reveal with script…" flow (RVL-01)
expected: |
  Place a reference, paint, save a script, run "Reveal with script…" from the photo-reference modal; the reveal rail appears on the current track with baked keys and the onProgress bar runs during the bake.
awaiting: user response

## Tests

### 1. Abort the reveal bake mid-span
expected: The bake aborts cleanly; no baked keys appear; the document revision is not bumped
result: [pending]

### 2. Native UAT: modal "Reveal with script…" flow (RVL-01)
expected: Place a reference, paint, save a script, run "Reveal with script…" from the photo-reference modal; the reveal rail appears on the current track with baked keys and the onProgress bar runs during the bake.
result: issue
reported: "1. BLOCKER — baked keys scaled/offset vs reference ghost: commitRevealBake renders at _compositorSizeProvider (project 1920x1080) while PlayScript bakes at working canvas size (capped 1000px); compositeRevealMask samples wrong region. 2. UI — reveal creation section in Photo Reference modal broken/cramped: REVEAL/MOTION and REVEAL/STATIC variant buttons squashed and wrap badly. 3. UX — frame count invisible at creation: frameCount defaults to script natural duration or 3 with no way to see/adjust before committing."
severity: blocker

### 3. Native UAT: track rail-creation flow (RVL-01)
expected: Create a reveal rail from the track rail-creation flow (Create rail → Reveal) and verify it lands baked through the same mutation as the modal path.
result: [pending]

### 4. Native UAT: reveal rail visual look (RVL-04)
expected: The reveal rail shows the green-family color (emerald motion / teal static), the 20x4px status dot, and the tooltip freshness line.
result: [pending]

## Summary

total: 4
passed: 0
issues: 1
pending: 3
skipped: 0
blocked: 0

## Gaps

- gap_id: G-52-2a
  truth: "With an identity transform, baked reveal keys overlay the reference ghost pixel-perfectly; both creation paths (modal + track flow) bake at the same size authority as the PlayScript path."
  status: failed
  reason: "User reported: commitRevealBake (physicPaintStore.ts:1284) renders at _compositorSizeProvider (project size 1920x1080, wired in projectStore.ts:949) while the PlayScript bake renders at working canvas size (PhysicsPaintStudio.tsx:1773, capped at 1000px long edge by physicsPaintCanvasSizing.ts). Script strokes live in working coordinates, so renderProgressiveAlphaFrame at project size squashes coverage into the up-left quadrant and compositeRevealMask (physicsPaintRotoPlayScriptRenderer.ts:154-180) samples the reference in the wrong region."
  severity: blocker
  test: 2
  artifacts: []
  missing: []
  fix_applied: "2026-09-03 — commitRevealBake now derives the working size via getPhysicsPaintWorkingSize(projectSize) and passes zoom = working/project with the reference; compositeRevealMask reproduces the ghost draw math (image*zoom, center + transform*zoom). Covered by physicsPaintRotoRevealBake.test.ts (zoom ghost-math test) and efxPaintStore.reveal.test.ts (working-size authority test). Awaiting re-run of Test 2."
- gap_id: G-52-2b
  truth: "The reveal creation section in the Photo Reference modal lays out cleanly: script picker, REVEAL/MOTION and REVEAL/STATIC variant buttons, and Create/Cancel all fit without squashing or bad wrapping."
  status: failed
  reason: "User reported: variant buttons are squashed and wrap badly, CREATE has no room (PhysicsPaintPhotoReferenceDialog.tsx). Widen the modal or restructure the creation section."
  severity: minor
  test: 2
  artifacts: []
  missing: []
  fix_applied: "2026-09-03 — the dialog surface widens to 344px only while the reveal-creation surface is open (physics-paint-photo-reference-surface-reveal modifier); the base 252px 50-UAT mockup is untouched. Variant buttons are nowrap with padding. Awaiting re-run of Test 2."
- gap_id: G-52-2c
  truth: "The computed frame span is visible at creation time (e.g. '12 frames from F5') or exposed as an editable field defaulting to the script natural duration; D-20 adjust-afterwards law stays as-is."
  status: failed
  reason: "User reported: frameCount = getScriptNaturalDuration(scriptId) ?? DEFAULT_REVEAL_FRAME_COUNT(3) (physicsPaintPhotoReferenceController.ts:279); script baked 3 frames with no way to see or adjust the value before committing."
  severity: minor
  test: 2
  artifacts: []
  missing: []
  fix_applied: "2026-09-03 — the creation surface now shows an editable Frames field (defaulted to the script's natural duration, re-defaulted on each script pick) plus a 'from F{n}' hint (the playhead frame snapshotted at open). Create is disabled and the mutation is rejected on a non-positive/non-integer count. Covered by PhysicsPaintPhotoReferenceDialog.test.ts (3 new tests). Awaiting re-run of Test 2."
