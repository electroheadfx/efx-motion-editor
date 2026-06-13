---
phase: 36-physics-paint-ui-rebuild-session-persistence-and-output-proo
fixed_at: 2026-06-13T00:00:00Z
review_path: .planning/phases/36-physics-paint-ui-rebuild-session-persistence-and-output-proo/36-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---
# Phase 36: Code Review Fix Report

**Fixed at:** 2026-06-13T00:00:00Z
**Source review:** .planning/phases/36-physics-paint-ui-rebuild-session-persistence-and-output-proo/36-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4
- Fixed: 4
- Skipped: 0

## Fixed Issues

### CR-01: Browser fallback opens with `noopener`, then relies on `window.opener` for apply delivery

**Files modified:** `app/src/lib/physicPaintBridge.ts`, `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
**Commit:** bac7be3
**Applied fix:** Removed `noopener,noreferrer` from the same-origin browser fallback window launch and made standalone browser fallback detection/apply delivery fail closed unless `window.opener` is available.

### CR-02: Play/Roto conversion callbacks are wired but unreachable

**Files modified:** `app/src/components/physic-paint/PhysicsPaintWorkflowStrip.tsx`
**Commit:** 9e8e4b7
**Applied fix:** Added explicit Play-to-Roto and Roto-to-Play conversion controls that open the existing confirmation flow, with mode/readiness disabled states.

### CR-03: Roto save advances and marks frames saved before the editor confirms apply success

**Files modified:** `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
**Commit:** 659381f
**Applied fix:** Deferred saved roto frame marking and save-and-advance navigation until the matching successful apply result arrives; failures/timeouts clear pending advancement.

### WR-01: Source-string tests allow unreachable workflow code to pass

**Files modified:** `app/src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts`
**Commit:** d24894f
**Applied fix:** Replaced the weak label-only conversion source assertion with checks that conversion controls are wired to handlers, disabled for invalid states, and reach the confirmation callbacks.

## Skipped Issues

None.

---

_Fixed: 2026-06-13T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
