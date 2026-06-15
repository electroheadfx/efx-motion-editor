---
status: resolved
trigger: "--discuss when I have log it print inside the UI, its not very ux, could you make this log in a toast which appear at top of the canvas and I can close [Image #2]\nThe bug its after the creation of play canvas script, if I re-open, the log no output again but I can change duray to more 1 frame but its no allowed, first time it was not allowed. It should have a verification if I increase duray out of bound, a toast should come one."
created: 2026-06-15
updated: 2026-06-15
---

# Debug Session: play-duration-toast-warning

## Symptoms

- expected_behavior: Duration/out-of-bound Play Paint warnings should appear as a dismissible toast at the top of the canvas instead of inline log text in the timeline UI.
- actual_behavior: The warning currently renders as inline UI text near the Duration controls, which is poor UX; after creating a Play canvas script and reopening, the warning/log no longer appears and the Duration can be increased beyond the allowed one-frame bound.
- error_messages: Inline warning shown in screenshot: "Only frame 0 is available before the next saved script."
- timeline: Happens after creating a Play canvas script and reopening the Physics Paint window/layer.
- reproduction: Create a Play canvas script in Physics Paint, trigger the duration bound warning, save/reopen the Play canvas script, then increase Duration beyond the allowed bound; the warning does not output again and the invalid duration is accepted.

## Current Focus

- hypothesis: Duration-bound validation and warning display are tied to transient inline Play Paint UI state that is not rehydrated/reapplied after reopening saved Play scripts.
- test: Locate the Play Paint duration validation/rendering path, reproduce with focused tests, and verify validation still clamps/rejects out-of-bound duration after reopen while emitting a dismissible top-canvas toast.
- expecting: Reopened Play canvas scripts enforce the same duration bounds as first creation and surface violations through a closable toast above the canvas.
- next_action: gather initial evidence
- reasoning_checkpoint:
- tdd_checkpoint:

## Evidence

- timestamp: 2026-06-15T08:18:56Z
  observation: Saved Play contexts previously omitted `maxPlayFrameCount` when reopening a containing Play range, so the duration input lost the next-script bound after reopen.
  source: /Users/lmarques/Dev/efx-motion-editor/app/src/lib/physicPaintBridge.ts
- timestamp: 2026-06-15T08:18:56Z
  observation: `updatePlayFrameCount` now clamps against `launchContext.maxPlayFrameCount`, and WorkflowStrip emits an out-of-bound callback instead of rendering inline warning text.
  source: /Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/PhysicsPaintStudio.tsx
- timestamp: 2026-06-15T08:18:56Z
  observation: Targeted test run passed: `pnpm --dir app test --run -- PhysicsPaintWorkflowStrip.test.ts PhysicsPaintStudio.test.ts physicPaintBridge.test.ts`.
  source: local test run

## Eliminated

## Resolution

- root_cause: Saved Play script reopen dropped duration limit metadata for the script's original start frame, and later Play edits removed any remaining launch limit, allowing out-of-bound duration changes after reopen.
- fix: Recomputed meaningful Play duration limits for reopened saved scripts while ignoring the current script, clamped Play frame-count updates in the studio, and replaced inline warning text with a dismissible top-canvas toast.
- verification: `pnpm --dir app test --run -- PhysicsPaintWorkflowStrip.test.ts PhysicsPaintStudio.test.ts physicPaintBridge.test.ts` passed.
- files_changed: /Users/lmarques/Dev/efx-motion-editor/app/src/lib/physicPaintBridge.ts; /Users/lmarques/Dev/efx-motion-editor/app/src/lib/physicPaintBridge.test.ts; /Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/PhysicsPaintStudio.tsx; /Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/PhysicsPaintStudio.test.ts; /Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/PhysicsPaintWorkflowStrip.tsx; /Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts; /Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/physicsPaintStudio.css
