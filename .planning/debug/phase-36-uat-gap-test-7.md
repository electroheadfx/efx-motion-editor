---
status: investigating
trigger: "Investigate Phase 36 UAT gap test 7 in /Users/lmarques/Dev/efx-motion-editor. Context: User reported Play works, but Save play ends with a yellow box/overlay bug; after closing and reopening EFX Physics, all edits are lost and the studio reopens in the Roto canvas tab instead of the Play canvas tab. Read the UAT file `.planning/phases/36-physics-paint-ui-rebuild-session-persistence-and-output-proo/36-UAT.md`, relevant phase summaries/specs, and source files around Save play, bridge persistence, PhysicPaintProperties launch context, physicPaintStore, and studio active mode. Do not edit files. Return a concise root-cause diagnosis with: root_cause, artifacts (paths + issue), and missing fix actions."
created: 2026-06-13T00:00:00Z
updated: 2026-06-13T00:01:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: Save play persists only rendered frames plus generic editableState, while the standalone launch/context and store lack workflow mode/range metadata; additionally post-save play frames are reused as onion overlays, causing the yellow overlay.
test: Trace Save play payload/store serialization and relaunch context to confirm missing Play canvas mode/range restore and overlay generation from latestPlayFrames.
expecting: If true, apply-play-canvas stores frames/editableState but no active mode or play range; create launch context returns only editableState; PhysicsPaintStudio defaults workflowMode to roto and builds onion preview from latestPlayFrames after Save play.
next_action: Record root cause diagnosis without editing files.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: Save play should persist EFX Physics edits and reopening EFX Physics should restore the Play canvas tab/context without overlay artifacts.
actual: Play works, but Save play ends with a yellow box/overlay bug; after closing and reopening EFX Physics, all edits are lost and studio reopens in the Roto canvas tab instead of the Play canvas tab.
errors: none provided
reproduction: Phase 36 UAT gap test 7: use EFX Physics Play, then Save play, close and reopen EFX Physics.
started: Phase 36 UAT gap test 7

## Eliminated
<!-- APPEND only - prevents re-investigating -->


## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-06-13T00:02:00Z
  checked: Phase 36 UAT test 7
  found: Save play expected to publish selected range while keeping standalone open and showing saved range summary; actual report says yellow overlay after Save play, edits lost after closing/reopening, and studio reopens in Roto canvas tab instead of Play canvas tab.
  implication: Failure spans both publish visual state and persistence/relaunch context, likely a state management/data shape issue rather than simple rendering only.


## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: Save play path stores only rendered frames and generic editableState, not Play canvas workflow metadata such as active mode/start/range/latest play source. Relaunch context then only passes editableState, while PhysicsPaintStudio initializes workflowMode to 'roto'. The yellow overlay is separately explained by latestPlayFrames being fed into onion preview after Save play with onion next-color styling.
fix: Not applied; diagnose-only/no-edit request.
verification: Static trace only; no server/app run per project instruction and no edits requested.
files_changed: []
