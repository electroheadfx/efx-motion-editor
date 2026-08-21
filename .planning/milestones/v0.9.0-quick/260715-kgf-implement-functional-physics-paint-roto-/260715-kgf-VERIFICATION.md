---
phase: quick-260715-kgf
verified: 2026-07-16
status: passed
score: 14/14
coverage_score: 22/22
native_uat: approved
---

# Quick 260715-kgf Verification Report

## Verdict

**PASSED.** All automated requirements are green and the user approved native UAT on 2026-07-16.

## Verified Truths

1. Recorded brushes enter the ordinary cooperative mutation/history/completion path with fresh destination mutation IDs.
2. Logical brushes retain ordered physics continuation data and immutable metadata.
3. Apply uses the shared deterministic held-pose Motion transform keyed by destination real source frame.
4. Copy drains accepted work and creates an immutable deep snapshot.
5. The clipboard is session-only, separate from real-key Copy/Paste, reusable across navigation, and changes only on Copy, Discard, or disposal.
6. Apply is sequential, additive, reusable, operation-scoped, and protected from stale/unrelated/duplicate completions.
7. True empty targets become durable only after first accepted replay; zero acceptance leaves them empty.
8. Empty Apply preserves the selected absolute frame, including distant interpolation spacing, without Insert-style shifting or extra key creation.
9. Cached bases and live overlays remain additive, and first script ownership never resets/redraws the base.
10. Per-brush Undo/Redo and Redo-branch invalidation remain normal engine behavior.
11. One final composite cache/parent publication follows a multi-brush Apply while per-brush history/progress stays independent.
12. Navigation, launch replacement, disposal, and close await accepted finalization and source-bound publication before clearing/reloading.
13. Frame-only context updates do not replace newer local cache arrays; applied pixels reload immediately in-session and after reopen.
14. Temporary Copy, Apply, and Discard controls expose the stable Phase 36.14 contract without final UI redesign.

## Final Contract Corrections

The approved implementation supersedes two earlier draft expectations:

- The clipboard does **not** auto-refresh/grow after source mutations or Apply. It remains the immutable copied snapshot until another Copy, explicit Discard, or Studio disposal.
- Multi-brush Apply does **not** encode/send a full cache frame after every brush. It publishes one final composite while preserving every brush as an independent engine mutation and Undo/Redo transaction.

## Automated Evidence

| Check | Result |
|---|---|
| Focused Apply/Studio/lifecycle/editing regressions | PASS — 79 tests in the combined focused gate |
| Complete app suite | PASS — 254 suites, 919 tests |
| Complete Physics Paint package suite | PASS — 7 files, 85 tests |
| App TypeScript | PASS |
| Package TypeScript | PASS |
| Package and app production builds | PASS |
| `git diff --check` | PASS |

## Human Evidence

The user approved native behavior after verifying:

- reusable clipboard across frames;
- exact empty-frame targeting;
- additive cached repaint;
- in-session cache refresh and reopen persistence;
- single-strength replay rather than doubled rendering;
- visible Roto Deform/Move application;
- distant selected-frame retention;
- Discard behavior; and
- overall GSD quick acceptance.

## Phase Boundary

Quick 260715-kgf is complete. Phase 36.14 is unblocked and remains UI-only.