---
phase: quick-260615-iui
status: complete
completed: 2026-06-15
commit: be8f6e8
---

# Quick Task 260615-iui Summary

## Completed

- Fixed the normal Play canvas brush input path so starting a brush stroke no longer clears the selected cached Play preview image.
- Kept dirty-cache behavior intact by still marking the saved Play cache and selected script dirty when brush input begins.
- Added regression coverage ensuring the selected cached Play frame remains visible when normal brush input begins.

## Files Changed

- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`

## Verification

- `pnpm -C /Users/lmarques/Dev/efx-motion-editor/app exec vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts` — passed
- `pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app typecheck` — passed

## Manual Check Needed

In the running app, select a non-last Play frame with a visibly different cached image, draw one normal brush stroke, and confirm the immediate stroke appears over that selected frame image before any re-render correction.
