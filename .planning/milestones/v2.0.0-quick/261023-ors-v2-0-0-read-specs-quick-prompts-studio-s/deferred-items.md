# Deferred items — quick-261023-ors

Out-of-scope discoveries found while executing this quick. None was introduced by
this plan; each is verified present at the start commit `3757640c`.

## Pre-existing stale pins in `PhysicsPaintRightSidebar.test.ts`

Both failures exist at HEAD and fail for reasons unrelated to the Memory tab
(confirmed with `git show HEAD:...`):

1. `keeps full-row load-only activation and contextual Actions behavior` — expects
   `label="Delete Script"` in `PhysicsPaintScriptsPanel.tsx`, but quick 261022-o2a
   moved Delete/Copy out of the toolbar (`<strong>Delete Script and Rails</strong>`
   in the delete confirmation remains; the exact `label="Delete Script"` token is
   gone).
2. `keeps desktop, narrow, and stacked layouts horizontally bounded` — expects
   `.physics-paint-scripts-toolbar { grid-template-columns: repeat(6, auto) }`, but
   the 261022-o2a one-row toolbar is `repeat(4, auto)`.

Neither assertion is part of this quick's scope. The quick's own additions to that
file (Memory in the tab union, both mode arrays, the unchanged `role="tab"` literal
count) pass.

## Plan deviation — `role="tab"` count

The plan predicted the sidebar pin's `role="tab"` source count would go 8 -> 9. The
live source renders every top-pane tab from ONE literal inside the mode-derived
map, so adding `memory` changes the rendered button count, not the literal count.
The pin stays at 8 with the reason recorded inline; the rendered lists are pinned
in `PhysicsPaintRightPanel.test.ts`.
