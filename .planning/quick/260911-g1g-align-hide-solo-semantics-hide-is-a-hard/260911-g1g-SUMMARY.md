---
phase: quick-260911-g1g
plan: 260911-g1g
subsystem: compositing
tags: [hide-solo, truth-table, cross-authority-parity, previewRenderer, efxPaintHideSolo, studio-wysiwyg, tml-04, cmp-02]

requires:
  - phase: 47
    provides: "resolvePhysicPaintTrackVisibility (previewRenderer.ts:95) — the Studio live-surface/active-track predicate, with its arming bug"
  - phase: 48
    provides: "participatingPaintTracks (efxPaintHideSolo.ts:30) — the flattened composite/export authority, already law-compliant (visible-only arming at :37)"
provides:
  - "previewRenderer.ts — solo arming now requires visible !== false AND solo === true, identical to efxPaintHideSolo.ts:37"
  - "previewRenderer.test.ts — hidden-only-solo RED discriminator (test A), visible-solo + hidden-solo truth-table case (test B), and the cross-authority parity contract describe"
  - "efxPaintHideSolo.test.ts — visible-solo + hidden-solo combined compositor case"
affects:
  - 53

# Actuals (#2632) — pairs with the plan's `estimate` (40000 tokens, 2 tasks, confidence low) to calibrate future estimates.
actuals:
  tokens: 1337    # chars/4 over the realized diff (5348 changed chars — added/removed diff lines only, headers/context excluded)
  tasks: 2
  commits: 3
  plan_head_before: 7b82ef4370dbdc9b8c9364e4042e6a5b057e0dc7

requirements-completed: [TML-04, CMP-02]

# Metrics
duration: 2min
completed: 2026-09-11
status: complete
---

# Quick 260911-g1g: Align Hide/Solo Semantics — Hide Is a Hard Off-Switch Summary

**Fixed the Studio-path solo-arming predicate so a hidden track's solo flag never arms solo mode — `resolvePhysicPaintTrackVisibility` now matches `participatingPaintTracks` exactly, restoring Studio/composite WYSIWYG and pinning both authorities to one truth table with a cross-authority parity contract.**

## Performance

- **Duration:** 2 min (114 s wall, 2026-09-11T09:37:27Z → 2026-09-11T09:39:21Z)
- **Tasks:** 2/2 completed
- **Files modified:** 3 (`previewRenderer.ts`, `previewRenderer.test.ts`, `efxPaintHideSolo.test.ts`)
- **Commits:** 3 (measured: `git rev-list --count 7b82ef43..HEAD`)

## Accomplishments

- **One production change, exactly as scoped:** `previewRenderer.ts:100` arming predicate went from `candidate.solo === true` to `candidate.visible !== false && candidate.solo === true` — replicating the reference implementation at `efxPaintHideSolo.ts:37`. Fail-closed returns, the `track.visible === false` early exit, and the `track.solo === true` participation result are untouched; a 3-bullet doc-comment addition records the hidden-solo-never-arms rule (CMP-02 adjacency).
- **The audit defect was reproduced before the fix:** pre-fix, test A ("a hidden-only solo does not arm solo filtering") FAILED with `expected false to be true` — the exact divergence where Studio blanks visible non-soloed tracks while the flattened composite still renders them. Full RED output quoted below; the failing run was captured, not skipped.
- **Rule 3 enforced structurally:** the new `hide/solo cross-authority parity (TML-04/CMP-02)` describe binds `resolvePhysicPaintTrackVisibility` to `participatingPaintTracks` track by track on the hidden-only-solo and visible-solo documents, so either authority drifting goes red immediately.
- **Compositor-side gap closed:** `efxPaintHideSolo.test.ts` gained the previously missing combined case (visible solo + hidden solo → `['track-a']`).
- **No consumer edits:** both Studio consumers (`PhysicsPaintStudio.tsx:2373` live surface, `:3546` program monitor) flow through the single fixed predicate — no production-module edit beyond the arming line.

## Task Commits

1. **Task 1 RED: failing hidden-only-solo truth-table cases** — `e72eab5c` (test) — targeted run: `1 failed | 23 passed (24)`
2. **Task 1 GREEN: solo arms only over visible Paint tracks** — `e3db20a7` (fix) — targeted run: `24 passed (24)`
3. **Task 2: cross-authority hide/solo parity contract + compositor combined case** — `12cdee36` (test) — targeted pair: `32 passed (32)`; production modules unchanged by this task

**Plan metadata:** uncommitted — orchestrator handles the docs commit (Step 8).

## RED Proof (pre-fix run for test A)

Command: `pnpm --filter efx-motion-editor exec vitest run src/lib/previewRenderer.test.ts` — run **before** the source change, on commit `e72eab5c`:

```
 FAIL  src/lib/previewRenderer.test.ts > 47-01 hide/solo preview filter (TML-04/M8) > a hidden-only solo does not arm solo filtering
AssertionError: expected false to be true // Object.is equality
- Expected
+ Received
- true
+ false
 ❯ src/lib/previewRenderer.test.ts:577:72
    575|     const trackB: InternalPaintTrack = { ...base, id: 'track-b', name:…
    576|     registerDocument({ ...document, tracks: [trackA, trackB] });
    577|     expect(resolvePhysicPaintTrackVisibility('roto-layer', 'track-a'))…
       |                                                                        ^
    578|     expect(resolvePhysicPaintTrackVisibility('roto-layer', 'track-b'))…
    579|   });
 Test Files  1 failed (1)
      Tests  1 failed | 23 passed (24)
```

At that moment `track-a` (visible, non-soloed) resolved **false** because the hidden track's solo flag armed solo filtering — the audit divergence. Test B passed pre-fix as designed (it pins hide-wins under arming, green on both sides).

## Files Created/Modified

- `app/src/lib/previewRenderer.ts` — arming predicate fixed (line 100) + doc comment bullet added; nothing else touched.
- `app/src/lib/previewRenderer.test.ts` — test A + test B added to the existing `47-01 hide/solo preview filter (TML-04/M8)` describe; new top-level `hide/solo cross-authority parity (TML-04/CMP-02)` describe with `expectTrackByTrackParity` and both discriminator documents.
- `app/src/efx-paint/compositor/efxPaintHideSolo.test.ts` — combined visible-solo + hidden-solo case added to the existing truth-table describe.

## Verification

| Gate | Result |
| ---- | ------ |
| Pre-fix targeted run (RED proof) | `1 failed \| 23 passed (24)` — failure is test A, `expected false to be true` |
| Post-fix targeted `previewRenderer.test.ts` | `24 passed (24)` |
| Targeted pair `previewRenderer.test.ts` + `efxPaintHideSolo.test.ts` | `2 files passed`, `32 passed (32)` |
| Full app suite `pnpm --filter efx-motion-editor exec vitest run` | `194 passed \| 2 skipped (196)` files; `3545 passed \| 1 skipped \| 101 todo (3647)` tests; **0 failed**; exit 0 |
| Types `pnpm --filter efx-motion-editor exec tsc --noEmit` | clean (exit 0, no output) |
| Scope gate `git diff --name-only 7b82ef43..HEAD` | exactly the 3 planned files — no fond/paper, reveal, transform, REQUIREMENTS.md, audit, or Studio consumer edits |
| Law check (by reading the diff) | arming requires `visible !== false && solo === true`, identical to `efxPaintHideSolo.ts:37`; hidden tracks stay excluded before any solo check on both paths |

## Deviations from Plan

None — plan executed exactly as written (RED → GREEN with the prescribed commit messages, parity contract and compositor case as specified; no full-suite/tsc adjustments were needed, so no third scoped commit).

## Native UAT — PENDING (user-run, not claimed)

Native UAT is **PENDING** and has NOT been performed by the executor (project law: the user runs the app). Recorded scenario from the plan's `<human_verification>`:

1. Launch the app and open EFX Paint Studio with a document holding at least three internal tracks.
2. Track A visible (no solo), Track B hidden, Track C hidden + soloed. Expected: Track A renders normally in the Studio live surface, the canvas composite, and an exported frame; Track C never appears anywhere (hide is a hard off-switch).
3. With B and C still hidden, solo Track A: only Track A renders. Then unhide Track B: only Track A still renders (B is visible but not soloed). Track C still never appears (hide wins over solo).
4. Confirm Studio and the composite/export output match (WYSIWYG) at every step.

## Next Phase Readiness

- The audit's hide/solo truth-table divergence (TML-04/CMP-02, `.planning/v1.0.0-MILESTONE-AUDIT.md` lines 49-52, 154, 186) now has a code fix plus a contract that makes future drift red. Phase 53's acceptance run inherits it with native UAT pending.
- Out of scope, untouched, still carried: the fond paper preload-gate warning, reveal, track transforms.

---

*Quick: 260911-g1g-align-hide-solo-semantics-hide-is-a-hard*
*Completed: 2026-09-11*

## Self-Check: PASSED

- `app/src/lib/previewRenderer.ts` exists and carries the fixed arming predicate (commit `e3db20a7`)
- `app/src/lib/previewRenderer.test.ts` exists and carries tests A/B + the parity describe (commits `e72eab5c`, `12cdee36`)
- `app/src/efx-paint/compositor/efxPaintHideSolo.test.ts` exists and carries the combined case (commit `12cdee36`)
- Commits `e72eab5c`, `e3db20a7`, `12cdee36` resolve in git history
- Measured commits: 3 (`git rev-list --count 7b82ef43..HEAD`)
