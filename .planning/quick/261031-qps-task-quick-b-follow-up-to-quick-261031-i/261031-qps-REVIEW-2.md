---
phase: 261031-qps
reviewed: 2026-10-31T20:15:40Z
depth: quick
files_reviewed: 6
files_reviewed_list:
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  - app/src/components/physic-paint/hooks/useRotoPlayScriptController.ts
  - app/src/components/physic-paint/hooks/useRotoPlayScriptController.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts
findings:
  critical: 0
  warning: 0
  info: 1
  total: 1
status: issues_found
---

# Quick 261031-qps: Re-Review of Remediation Commits

**Reviewed:** 2026-10-31T20:15:40Z
**Depth:** quick
**Scope:** 219cada2d..HEAD (18a1f93cc, 375dd26b8, fd8511de5, f75c82f8c, 307010cbd)
**Files Reviewed:** 6
**Status:** All five original findings fixed; no regression found (one INFO residual).

## Summary

Verified every original finding against the remediated source and ran the three targeted suites: 553/553 tests pass (`physicsPaintRotoPlayScriptController.test.ts`, `useRotoPlayScriptController.test.ts`, `PhysicsPaintStudio.test.ts`). No persisted schema/format change (only 3 source + 3 test files changed), no `keyScriptEdits` write on any stack path (read-only at `physicsPaintRotoPlayScriptController.ts:2420`), and no Preact signals violation (the new state is a run-scoped ref written only from async port/event paths and an effect reset; no render-body writes, no new effect deps).

### Finding verification

- **CR-01 — FIXED.** `physicsPaintRotoPlayScriptController.ts:2544-2546` throws for `!isRevealTarget && slices.length === 0`, before `ports.commit` (`:2625`) and before `recordRailKeyScripts` (`:2639`). The reveal path keeps its own refusal (`:2552-2554`). Cannot wrongly block a legitimate run: the bake reports every non-Dry stroke (`aquarelleBake.ts:900-903`), and `sliceRailKeyScripts` returns one non-empty slice per frame whenever anchors exist (`physicsPaintRotoRailKeyScripts.ts:55-88`), so an empty slice list is exactly the Dry-only case. Keep ON and Keep OFF abort tests pin zero union/composite/commit/record (`physicsPaintRotoPlayScriptController.test.ts:4528`, `:4549`).
- **WR-01 — FIXED.** Fresh pins are staged in `pendingStackedScriptBasePinsRef` with bytes copied from the pre-run picture (`PhysicsPaintStudio.tsx:4066-4078`, `.slice(0)`), never written to the live map during the bake (`:4030-4110` contains no map/recovered/markDirty write). The stage clears at bake start (`:4037-4040`), on both refusals (`:4090-4092`, `:4104-4106`), at reveal-tail start (`:4174-4176`), and on a missing launch (`:4260-4263`). Live-map writes happen only via `pinScriptBase` from the append recording (`:4282-4285`), after the controller's commit (`:2625`), then the stage is cleared (`:4287`). A later run resolves the base before its publication overwrites the payload, so no stale/double pin can be applied.
- **WR-02 — FIXED.** The hook forwards `recordRailKeyScripts` only when supplied (`useRotoPlayScriptController.ts:81-83`), and the controller fails closed before commit when `recordMode !== 'none'` and the port is absent (`physicsPaintRotoPlayScriptController.ts:2617-2623`); `recordMode: 'none'` still completes (`:2632`). Covered by `physicsPaintRotoPlayScriptController.test.ts:4650` and `:4669`, and `useRotoPlayScriptController.test.ts:348-364`.
- **IN-01 — FIXED.** `PhysicsPaintStudio.tsx:2021` now checks `revealFrame.appFrame !== frame.appFrame` (reason `reveal-frame-missing`) before publishing, consistent with `renderRevealTailFrames` absolute app frames (`physicPaintStore.ts:2200-2205`) and the stack slow path (`:4230`).
- **IN-02 — FIXED.** The reveal-tail pin now asserts neither `incomingInterpolationBreak` nor `commitRevealBake` appears in the port (`PhysicsPaintStudio.test.ts:5173-5180`).

## Narrative Findings (AI reviewer)

### Info

#### IN-03: Staged stack pins are not cleared on a controller-side abort after a successful union bake

**File:** `app/src/components/physic-paint/PhysicsPaintStudio.tsx:4037-4040`; controller aborts at `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts:2621`, `:2625-2627`
**Severity:** Info

**Issue:** WR-01's "cleared on every abort" is not literal. If the union bake succeeds and the run then aborts before recording (WR-02 gate, a failed `ports.commit`, or a cancel during commit), the stage keeps the copied pre-run frame buffers until the next stack bake, reveal-tail bake, or launch change. This is not currently misapplied: the only `append` consumer (`:2639`) always follows a union bake (`:2593`) or reveal-tail bake (`:2555`), both of which clear the stage first; the CR-01 throw itself precedes the union bake. No double pin or wrong base is reachable today, but the invariant is latent and copied pixel buffers linger after a failed run.

**Fix:** Add an optional controller-driven clear seam (e.g. `discardStackedScriptBasePins`) invoked from the stack confirm's `catch`/pre-commit exit when no commit succeeded, so the stage is emptied on every abort path; or clear the stage at the top of `recordRailKeyScripts` for the non-append modes as a belt-and-braces guard.

---

_Reviewed: 2026-10-31T20:15:40Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
