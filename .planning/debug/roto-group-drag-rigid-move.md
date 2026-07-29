---
status: complete
trigger: "Phase 38.1 Plan 18 native UAT failure: fix Physics Paint Roto group drag using the newly locked rigid-translation contract. Add a RED resolver truth-table test first for keys A@0, B@1, D@7, selected {A,B}, grab B and drop on physical frame 6; expected A@5, B@6, D@7. Selected offsets must remain fixed and unselected keys must never ripple. Update the obsolete Phase 37 whole-cell and before/after-caret mappings consistently, including collision, capacity, reverse movement, non-contiguous selection, preview roles, action settlement, one Undo/Redo entry, and selection/focus aftermath. Do not edit Phase 38.1 Plan 18 artifacts until native re-UAT passes."
created: 2026-07-29
updated: 2026-07-29T11:30:40Z
---

# Debug Session: Roto Group Drag Rigid Move

## Symptoms

- Expected behavior: Group drag is a rigid translation in physical-frame space. For A@0, B@1, D@7 with selected {A,B}, grabbing B and dropping on physical frame 6 resolves to A@5, B@6, D@7. Selected offsets remain fixed and unselected keys never ripple.
- Actual behavior: Phase 38.1 Plan 18 native UAT failed because Physics Paint Roto group drag still follows obsolete Phase 37 whole-cell and before/after-caret mappings instead of the locked rigid-translation contract.
- Error messages: No runtime error was reported; this is a behavioral contract failure observed during native UAT.
- Timeline: Discovered during Phase 38.1 Plan 18 native UAT on 2026-07-29 after the rigid-translation contract was locked.
- Reproduction: Create keys A@0, B@1, D@7; select A and B; grab B; drop on physical frame 6; verify the resolver, preview, settlement, history, selection, and focus all produce A@5, B@6, D@7 without moving D.

## Constraints

- Add the resolver truth-table test first and confirm it is RED before implementation changes.
- Preserve rigid selected-key offsets and never ripple unselected keys.
- Update collision, capacity, reverse movement, non-contiguous selection, preview roles, action settlement, one Undo/Redo entry, and selection/focus aftermath consistently.
- Replace obsolete Phase 37 whole-cell and before/after-caret assumptions only where required by this contract.
- Do not edit Phase 38.1 Plan 18 artifacts until native re-UAT passes.
- Do not run the development server.
- Run Vitest only with `vitest run`, never watch mode.

## Current Focus

- hypothesis: Confirmed — `buildMoveGroupCandidate` encoded obsolete Phase 37 source closure and destination ripple rules for whole-cell and caret targets.
- test: The locked A@0/B@1/D@7 public resolver case was captured RED, then expanded across whole-cell, before/after carets, collision, capacity, reverse movement, non-contiguous selection, preview roles, retained-publication settlement, history, and selection aftermath.
- expecting: Confirmed natively — A@5, B@6, D@7 with fixed selected offsets and no unselected ripple.
- next_action: Resume the Phase 38.1 Plan 18 workflow and update its acceptance artifacts only when explicitly requested.
- bug_class: bohrbug
- known_pattern_candidate: none; the knowledge base has no rigid group-drag pattern
- reasoning_checkpoint: Root cause proven at the pure resolver seam; preview, action settlement, history, and selection remained generic and required regression updates rather than new architecture.
- tdd_checkpoint: RED captured before production changes; focused rigid suites are GREEN.

## Evidence

- timestamp: 2026-07-29T00:00:00Z
  checked: .planning/debug/knowledge-base.md
  found: No prior resolved entry matches rigid physical-frame group drag; configured gsd-debugger agent-skills query also returned no injected skills.
  implication: Continue with project-local skill discovery and direct evidence; no known-pattern hypothesis should be privileged.

- timestamp: 2026-07-29T00:00:00Z
  checked: Project skill inventory and available tool namespaces
  found: Local diagnosing-bugs, TDD, codebase reference, and related skill indexes exist; the codebase-memory skill is loaded, but its MCP graph tool namespace is not exposed in this session.
  implication: Apply the loaded graph-first workflow where possible, document the unavailable graph calls, and fall back to Grep/Glob/Read for code discovery.

- timestamp: 2026-07-29T00:00:00Z
  checked: app-local instructions and relevant debugging/TDD skills
  found: app/CLAUDE.md is empty; the debugging skill requires a tight red-capable command, and the TDD skill requires one behavior test at the public resolver seam with literal expected frames before implementation changes.
  implication: Locate the resolver seam first, then add only the locked A@0, B@1, D@7 case and run its exact Vitest file in run mode.

- timestamp: 2026-07-29T00:00:00Z
  checked: Targeted source/test discovery for group drag
  found: physicsPaintRotoPhysicalResolver.test.ts explicitly asserts obsolete GD-1 source-gap closure/unselected ripple and GD-3 caret ripple; physicsPaintRotoPhysicalResolver.ts comments describe the same Phase 37 mapping. useRotoTimelineActions prepares group drag through resolvePhysicPaintRotoPhysicalEdit and WorkflowStrip retains that publication for preview and commit.
  implication: The pure resolver is the correct first RED seam, and current source text directly supports the stale-semantics hypothesis.

- timestamp: 2026-07-29T10:12:18Z
  checked: Exact resolver module discovery
  found: The graph-assisted discovery hook and file glob agree on app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts and its colocated .test.ts module.
  implication: Read these complete files next; no broader code search is needed before writing the single public-seam RED case.

- timestamp: 2026-07-29T10:17:23Z
  checked: Complete resolver and colocated test implementation
  found: buildMoveGroupCandidate physical-cell handling closes every selected source gap before applying a rigid selected-key delta. For A@0, B@1, D@7 and target 6, it computes D@5, A@5, B@6 and rejects duplicate frame 5. The existing GD-1/GD-2 tests explicitly lock this obsolete unselected-ripple behavior.
  implication: The stale Phase 37 source-gap algorithm directly explains the native UAT failure. Add the independent literal rigid mapping as the first RED contract test.

- timestamp: 2026-07-29T10:18:58Z
  checked: RED resolver contract test creation
  found: Added one public-seam test with literal identities A@0, B@1, D@7, selected {A,B}, grabbed B, physical target 6, and literal expected mapping A@5, B@6, D@7 plus grabbed-key selection.
  implication: Run this exact test file now; no production implementation has been changed.

- timestamp: 2026-07-29T10:29:48Z
  checked: `pnpm --dir app exec vitest run src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.test.ts`
  found: The locked tracer failed deterministically at `resolution.ok`: expected true, received false; the other 11 resolver tests passed.
  implication: The feedback loop caught the exact native UAT contract before implementation changed.

- timestamp: 2026-07-29T11:10:55Z
  checked: Rigid resolver, preview, action settlement, history, and selection aftermath
  found: Group Drag now applies one grabbed-key delta only to selected identities; before-caret resolves to target frame minus one, after-caret to target frame plus one; unselected frames never change; collision and capacity reject atomically with structured conflicts. Retained publication commits unchanged, one accepted group move creates one Undo/Redo command, and the moved set remains selected with the grabbed key accepted/current.
  implication: The obsolete Phase 37 mapping is removed consistently without adding another resolver, transaction, history, or selection authority.

- timestamp: 2026-07-29T11:10:55Z
  checked: Focused automated gates
  found: Resolver 15/15, timeline actions 7/7, multi-selection 18/18, history 1/1, and rigid preview roles 3/3 passed; `pnpm --dir app typecheck` passed; `pnpm --dir app build` passed.
  implication: The fix is automated-ready for native re-UAT.

- timestamp: 2026-07-29T11:10:55Z
  checked: Full `pnpm --dir app exec vitest run`
  found: Rigid-drag coverage passed. The suite still has three unrelated pre-existing failures: one untouched WorkflowStrip header-tooltip placement assertion and two untouched status-capsule ambient-baseline assertions.
  implication: Do not broaden this fix into unrelated UI/capsule debt; the focused rigid contract remains green.

- timestamp: 2026-07-29T11:30:40Z
  checked: User-owned native re-UAT of the failed rigid group-drag flow
  found: User reported `work !`; the A@0/B@1/D@7 group drag now behaves correctly after the fix.
  implication: Native acceptance passed; the debug session is complete and the Plan 18 workflow may resume when explicitly requested.

## Eliminated

- Preview role derivation was not a second legality authority; it correctly reprojects the resolver mapping once stale assertions are replaced.
- Action settlement did not recompute the mapping; it already commits the exact retained publication.
- History and selection did not cause the frame error; their generic accepted-operation paths preserve one command and the moved keyId set.
- Phase 38.1 Plan 18 artifacts were not modified.

## Resolution

- root_cause: `buildMoveGroupCandidate` still implemented Phase 37 cut/close/open ripple semantics. In the locked A@0/B@1/D@7 case it moved D to frame 5, collided with translated A@5, and rejected instead of returning A@5/B@6/D@7.
- fix: Replaced group movement with one rigid physical delta anchored by the grabbed key; selected offsets stay fixed, unselected frames stay fixed, before/after carets resolve to adjacent physical frames, and collision/capacity failures remain atomic and structured. Updated resolver, preview, settlement, history, and selection regression coverage.
- verification: Focused rigid suites 44/44 passed, typecheck passed, production build passed, and user-owned native re-UAT passed on 2026-07-29.
- files_changed: `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts`, `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.test.ts`, `app/src/components/physic-paint/view/physicsPaintWorkflowPresentation.test.ts`, `app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts`, `app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts`, `app/src/components/physic-paint/roto/physicsPaintRotoMultiSelection.test.ts`, `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx`, `.planning/debug/roto-group-drag-rigid-move.md`
