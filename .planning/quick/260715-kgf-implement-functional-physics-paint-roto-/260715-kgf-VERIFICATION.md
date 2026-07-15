---
phase: quick-260715-kgf
verified: 2026-07-15
status: human_needed
score: 14/14 plan must-have truths verified
coverage_score: 22/22 focused coverage requirements verified
behavior_unverified: 1
re_verification:
  previous_status: gaps_found
  previous_score: 13/14
  gaps_closed:
    - "Focused engine/Motion/controller/Studio regressions, Physics Paint/durable tests, and two consecutive full app suites pass before automation is accepted."
  gaps_remaining: []
  regressions: []
behavior_unverified_items:
  - truth: "Native UAT A-M interaction, timing, visual output, cache visibility, and responsiveness"
    test: "Run all native UAT scenarios A-M listed in this report."
    expected: "Each scenario produces its specified visual, ownership, publication, and lifecycle result."
    why_human: "The automated suites cannot certify native pointer feel, real-host bridge delivery, visible preview/export output, or interactive timing."
human_verification:
  - test: "Run native UAT A-M below in the real Physics Paint Studio."
    expected: "All thirteen scenarios pass and the user explicitly approves them before Phase 36.14 proceeds."
    why_human: "Native visual and interaction approval is the required completion gate."
---

# Quick 260715-kgf: Functional Physics Paint Roto Copy / Apply Verification Report

**Task goal:** Functional Physics Paint Roto Copy Script / Apply Script prerequisite to Phase 36.14.

**Status:** `human_needed`  
**Re-verification:** Completed after closure of the prior full-suite determinism gap.  
**Automated result:** 14/14 plan must-have truths and 22/22 focused coverage requirements verified.

## Verification Result

All automated implementation and regression requirements are verified. The definitive source review returned `## REVIEW PASSED`; no automated blocker remains. The sole remaining gate is the native UAT A-M approval boundary.

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Immutable recorded logical brushes enter the ordinary accepted mutation, history, Redo invalidation, cooperative-finalization, queued-outline, generation-guard, and completion path with fresh IDs and independent history. | VERIFIED | Recorded-stroke engine and Motion contracts pass. |
| 2 | Point-bearing strokes retain ordered trailing diffusion continuations; malformed continuation ownership is rejected. | VERIFIED | Engine acceptance and controller grouping coverage pass. |
| 3 | Motion uses the shared deterministic held-pose transform keyed by the destination real source frame while preserving metadata. | VERIFIED | AnimationPlayer and Roto Apply share the transform; dedicated behavior tests pass. |
| 4 | Copy accepts eligible real editable painted sources only, drains accepted work cooperatively, then snapshots immutably without synchronous flush or accepted-work cancellation. | VERIFIED | Controller lifecycle and engine completion coverage pass. |
| 5 | The clipboard is session-only, immutable, source-bound, refreshed on paint/Undo/Redo, frozen on navigation, resumed on return, and cleared on empty source or disposal. | VERIFIED | Controller lifecycle and session-separation coverage pass. |
| 6 | Apply is reusable, additive, sequential, operation-scoped, and protects interactions until accepted work completes; unrelated, stale, and duplicate completions cannot advance it. | VERIFIED | Controller, Studio, lifecycle, and locking coverage pass. |
| 7 | A true-empty target becomes durable on first accepted replay only; zero acceptance remains empty and later failure retains accepted partial work without success. | VERIFIED | Accepted-target and Phase 36.13 source/display regression coverage pass. |
| 8 | Script completion observation composes with the authoritative live-alpha/cache publication path. | VERIFIED | Studio completion callback observes first, then continues normal pixel capture/publication. |
| 9 | Cached-base and live-overlay output remains additive with latest-write-wins, generated/timeline refresh, parent delivery, reopen, preview, and export baselines. | VERIFIED | Durable, cache, edit-buffer, source/display, session, subtree, and full-suite checks pass. |
| 10 | Copy Script and Apply Script appear after Delete with native disabled reasons and concise status, without Phase 36.14 presentation work. | VERIFIED | Workflow contract and control regression pass. |
| 11 | Mutation locking protects supported mutation and replacement paths while accepted script work is live. | VERIFIED | Controller and mounted lock/lifecycle coverage pass. |
| 12 | Engine disposal and launch replacement drain accepted work cooperatively, reject stale state, and preserve the latest lifecycle destination. | VERIFIED | Disposal and launch-replacement coverage pass. |
| 13 | No synchronous script finalization, replay ownership, server/watch/config/package-install path, or script clipboard serialization/bridge/cache/launch metadata was introduced. | VERIFIED | Source and execution review pass. |
| 14 | Required automation is reliable through focused, subtree, durable, and two consecutive full app-suite proof. | VERIFIED | Final gate evidence below. |

## Explicit Stable Integration Contract

The verified controller exposes an intentional Phase 36.14 contract rather than requiring the UI to derive script state:

- Actions: `copyScript()` and `applyScript()`.
- Availability: `canCopy`, `canApply`, `copyDisabledReason`, and `applyDisabledReason`.
- Copied-script state: `hasCopiedScript`, `copiedSourceFrame`, and `copiedStrokeCount`.
- Apply state: `applying` and `applyProgress`.
- Feedback: concise `status` and structured `error` with `operation`, `code`, `message`, and optional `cause`.
- Protection: `mutationLocked`.
- Lifecycle: `observeCompletedMutation()`, `prepareNavigation()`, `completeNavigation()`, `prepareLaunchReplacement()`, `completeLaunchReplacement()`, `prepareEngineDisposal()`, and `dispose()`.

Studio routes the structured error to the existing `lastError` / LOG boundary. The workflow UI consumes the fields and callbacks; it must not parse status text or reimplement script business rules.

## 22-Focused-Coverage Audit

| Coverage | Result |
| --- | --- |
| Immutable `getStrokes()` script snapshot | VERIFIED |
| Editable-only Copy eligibility | VERIFIED |
| Copy lock only during cooperative drain | VERIFIED |
| Navigation drain, freeze, and transition | VERIFIED |
| Queue/active completion drain | VERIFIED |
| Bound-source refresh after paint, Undo, and Redo | VERIFIED |
| Empty/disposal session cleanup | VERIFIED |
| Fresh recorded-submission identity | VERIFIED |
| FIFO script order and queued outlines | VERIFIED |
| Continuation grouping and order | VERIFIED |
| One expected completion per logical brush | VERIFIED |
| Progress ignores unrelated, stale, and duplicate completion | VERIFIED |
| Apply interaction and navigation protection | VERIFIED |
| Reusable additive Apply | VERIFIED |
| Independent exact Undo/Redo and ten-level cap | VERIFIED |
| Fresh Apply invalidates Redo | VERIFIED |
| Zero acceptance leaves a target empty | VERIFIED |
| First accepted brush claims exact Phase 36.13 target/spacing | VERIFIED |
| Partial failure retains work and reports Failed | VERIFIED |
| Destination-source Motion and metadata retention | VERIFIED |
| Additive cache, revision LWW, timeline/generated/parent/reopen/preview/export | VERIFIED |
| Temporary controls, reasons, and status | VERIFIED |

**Coverage score:** 22/22 focused coverage requirements verified.

## Final Automated Evidence

| Check | Result |
| --- | --- |
| Focused controller / Studio / workflow | PASS — **71 passed** |
| Physics Paint subtree | PASS — **306 passed** |
| Durable suite | PASS — **51 passed, 1 skipped** |
| Full app suite, run 1 | PASS — **77 files passed, 3 skipped; 809 passed, 1 skipped, 101 todo** |
| Full app suite, run 2 | PASS — **77 files passed, 3 skipped; 809 passed, 1 skipped, 101 todo** |
| Physics package check and build | PASS |
| App typecheck | PASS |
| Root build | PASS |
| `git diff --check` | PASS |

The two full application-suite passes were consecutive independent invocations. The earlier publication-determinism gap is closed; matcher-based durable publication waiters register before their triggering action and preserve unrelated publications until the expected one arrives.

The user approved the plan-checker process exception for the missing `VALIDATION.md` artifact. No automated validation, regression, review, or UAT condition was weakened.

## Human Verification Required

Native UAT approval remains mandatory. It is the only remaining gate and is not an automated implementation or verification gap.

### Native UAT Remaining — A-M

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

## Verification Boundary

The quick is **automated-ready / awaiting native UAT** only. It is not complete, and Phase 36.14 remains blocked until the user approves all UAT scenarios A-M.
