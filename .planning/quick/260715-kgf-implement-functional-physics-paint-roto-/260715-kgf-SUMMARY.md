---
phase: quick-260715-kgf
plan: final
subsystem: physics-paint-roto
status: automated-ready / awaiting native UAT
requires_native_uat: A-M
blocks: phase-36.14
---

# Quick 260715-kgf: Functional Physics Paint Roto Copy / Apply Summary

## Status Boundary

- **Overall status:** automated-ready / awaiting native UAT
- **Automated blockers:** none remain.
- **Completion:** not claimed. Native UAT A-M remains mandatory.
- **Phase 36.14 remains blocked** until the user approves every native UAT scenario below.

The implementation is complete through the ordinary Physics Paint mutation path. Copy Script waits cooperatively for already accepted paint, then snapshots an immutable session-only script. Apply Script replays each copied logical brush sequentially through normal engine acceptance, preserving separate history/completion ownership per brush. It is reusable and additive, retains accepted partial paint on later failure, and only commits true-empty target ownership after the first accepted brush.

Lifecycle closure is complete: source changes refresh a bound clipboard only while it is active; navigation, launch replacement, engine disposal, and Studio disposal drain accepted work without synchronous finalization or cancellation. Mutation locking now protects the interaction surfaces while accepted script work is live. Completion observation remains composed with—not substituted for—the authoritative live-alpha/cache publication path.

## Stable Phase 36.14 Integration Contract

Phase 36.14 consumes this controller contract as first-class view state and actions:

- Actions: `copyScript()` and `applyScript()`.
- Availability: `canCopy`, `canApply`, `copyDisabledReason`, and `applyDisabledReason`.
- Clipboard state: `hasCopiedScript`, `copiedSourceFrame`, and `copiedStrokeCount`.
- Apply state: `applying` and `applyProgress`.
- Feedback: concise `status`, plus structured `error` with `operation`, `code`, `message`, and optional `cause`.
- Mutation protection: `mutationLocked`.
- Lifecycle actions: `observeCompletedMutation()`, `prepareNavigation()`, `completeNavigation()`, `prepareLaunchReplacement()`, `completeLaunchReplacement()`, `prepareEngineDisposal()`, and `dispose()`.

Structured errors are routed through the established `lastError` / LOG boundary. UI consumers must not parse `status` strings or own script business rules; they render this contract and invoke its actions.

## Implementation Commits

All implementation and closure commits, in chronological order:

1. `854e1e71` — `feat(260715-kgf): add recorded stroke engine seams`
2. `5dfcb8fb` — `test(260715-kgf): lock recorded paint and Motion contracts`
3. `1851a481` — `fix(260715-kgf): preserve recorded stroke physics mode`
4. `48f85a42` — `feat(260715-kgf): add Roto script session controller`
5. `6c65b83d` — `feat(260715-kgf): mount Roto script copy and apply`
6. `e16de711` — `fix(260715-kgf): restore mounted Roto regression stability`
7. `87237095` — `fix(260715-kgf): preserve overflow Play frame anchors`
8. `4ad41fee` — `test(260715-kgf): align guarded navigation contract`
9. `628b8827` — `test(260715-kgf): complete mounted durable harness`
10. `5222c049` — `fix(260715-kgf): drain cancelled Roto script work`
11. `2550c498` — `fix(260715-kgf): preserve mounted apply lifecycle`
12. `70551c49` — `fix(260715-kgf): close apply mutation blockers`
13. `d79148b3` — `fix(260715-kgf): close final mutation lifecycle blockers`
14. `58743185` — `fix(260715-kgf): restore automation package boundaries`
15. `4d0843b9` — `fix(260715-kgf): await parent Roto publication`
16. `a92f053f` — `fix(260715-kgf): guard cooperative drains from sync finalization`
17. `74d09ad5` — `fix(260715-kgf): lock Roto interpolation mutations`
18. `008b7f7c` — `fix(260715-kgf): drain Apply before launch replacement`
19. `c385f4d5` — `fix(260715-kgf): await exact Clear publications`
20. `814306df` — `fix(260715-kgf): expose stable Roto script errors`
21. `d4d53ee2` — `fix(260715-kgf): expose reactive Roto script contract`

## Final Automated Evidence

All verification used existing repository configuration and `vitest run` only.

| Gate | Result |
| --- | --- |
| Focused controller / Studio / workflow contract | **71 passed** |
| Physics Paint subtree | **306 passed** |
| Durable suite | **51 passed, 1 skipped** |
| Full app suite, run 1 | **77 files passed, 3 skipped; 809 passed, 1 skipped, 101 todo** |
| Full app suite, run 2 | **77 files passed, 3 skipped; 809 passed, 1 skipped, 101 todo** |
| Physics Paint package check and build | **passed** |
| App typecheck | **passed** |
| Root build | **passed** |
| `git diff --check` | **passed** |

The definitive source review returned `## REVIEW PASSED`. Re-verification reports `human_needed`, with **14/14 plan must-have truths** and **22/22 focused coverage requirements** verified. The only remaining verification category is the user-run native UAT below.

The user approved proceeding past the plan-checker’s process-only missing `VALIDATION.md` artifact. That exception did not weaken any validation, test, review, or native-UAT requirement.

## Native UAT Remaining — A-M

A. On a real editable Roto key with several distinct brushes, choose Copy Script during settled paint; confirm `Copied N`, then Apply on another eligible real key and confirm the same ordered visual script appears additively.
B. Copy while rapid pointer input has queued and actively finalizing brushes; confirm input pauses only for the drain, queued outlines/final paint complete normally, the final copied count includes accepted work, and Copy returns control without a synchronous freeze.
C. Apply a multi-brush script and confirm status advances by completed brushes (`Applying X/N`), input/navigation remain protected, and `Applied N` appears only after the final brush completes.
D. Undo each applied brush individually, then Redo each individually; confirm exact order/pixels, the existing ten-level behavior, and no grouped whole-script Undo.
E. Undo applied paint, add a new native or applied brush, and confirm Redo is invalidated exactly as for normal painting.
F. Reapply the same clipboard to the same or another eligible destination; confirm the clipboard is reusable and paint is additive rather than replacing prior live overlay or cached alpha.
G. Apply over a cached real-key base; confirm the base remains visible, new paint merges once, Undo returns to the unchanged base, Redo restores the overlay, and reopen still shows the correct composite.
H. Set non-zero Motion Move/Deform, apply to destinations with known real source frames, and confirm deterministic two-frame held poses, preserved stroke character/properties, and source-frame rather than generated/display-frame identity.
I. Attempt Copy from generated, cached-only, and true-empty sources and Apply to a generated destination; confirm controls are disabled with useful reasons and no source/destination ownership changes.
J. Apply to a true-empty destination; confirm the first accepted brush creates the durable real key with exact current Phase 36.13 spacing. Cancel/fail before any brush acceptance and confirm the frame remains truly empty.
K. Force or observe a later-brush Apply failure/cancellation after earlier acceptance; confirm accepted partial paint remains independently undoable, status is Failed/not full success, stale completions cannot resume the operation, and no unaccepted ownership is published.
L. After Copy, mutate the bound source with paint, Undo, and Redo; confirm the clipboard refreshes to the accepted source revision, freezes when navigating away, resumes on return, clears if the source becomes empty, and disappears after Studio close/relaunch.
M. Confirm every completed applied brush automatically updates timeline/cache/generated previews and parent output; navigate away/back, close/reopen, preview, and export to verify visibility, then repeat under rapid cooperative activity without stale cache publication or degraded pointer responsiveness.

## Handoff

No automated implementation, review, or verification blocker remains. Run and approve native UAT A-M before treating this quick as complete or beginning Phase 36.14.
