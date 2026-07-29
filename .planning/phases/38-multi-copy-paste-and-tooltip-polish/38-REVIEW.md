---
phase: 38-multi-copy-paste-and-tooltip-polish
reviewed: 2026-07-29
status: issues_found
depth: standard
files_reviewed: 29
findings:
  critical: 4
  warning: 3
  info: 0
  total: 7
---

# Phase 38 Code Review

## Verdict

The advisory standard-depth review found four critical and three warning-level issues. The review did not modify source files or rerun tests. Phase 38's implemented and native-approved contracts were not reopened; the findings are retained for a separate fix workflow.

## Critical Findings

### CR-01: Malformed authority messages can throw before validation

**Files:** `app/src/lib/physicPaintBridge.ts:232-250,877-895`, `app/src/types/physicPaint.ts:568-573`

The Tauri and browser listeners cast untrusted payloads directly to `PhysicPaintRotoAuthorityRequest`. Null, primitive, or incomplete payloads can throw before a failure result is constructed, and the failure path may query store state with an unvalidated layer ID.

**Recommendation:** Add one strict runtime validator over `unknown` and invoke authority handling only after validation. Invalid requests must not access store state.

### CR-02: Delete shortcut can throw when no Roto key is selected

**Files:** `app/src/components/physic-paint/PhysicsPaintStudio.tsx:995-1004`, `app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts:102-113`, `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts:366-388,830-835`

The Studio always installs the Delete action, while `deleteRotoFrame()` can call a throwing selected-key helper. The keyboard route can invoke it with no valid selection and does not independently honor `mutationLocked`.

**Recommendation:** Make the action fail closed with a false result/status message when no bounded selected key exists, and guard keyboard deletion while mutation is locked.

### CR-03: Press-and-hold physics controls can remain active

**Files:** `app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx:149-167`, `app/src/components/physic-paint/engine/usePhysicsPaintEngineActions.ts:94-103`

The physics-last/all controls stop on `touchend` but not `touchcancel`; interrupted gestures may leave the engine action active. The controls also lack explicit keyboard activation semantics.

**Recommendation:** Use a unified pointer lifecycle with pointer capture and cleanup on pointer-up, pointer-cancel, lost capture, and unmount; add intentional keyboard press/release handling.

### CR-04: Incomplete CSS escaping can break drag focus restoration

**File:** `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx:257-264,950-956,1071-1085`

Opaque bounded key IDs are interpolated into selectors using an escape helper that only handles quotes and backslashes. Other valid CSS string edge cases can make `querySelector()` throw during cancellation or accepted-drag settlement.

**Recommendation:** Avoid selector construction. Query `[data-roto-key-id]` elements and compare `dataset.rotoKeyId` directly.

## Warning Findings

### WR-01: Resolver proposals expose mutable Map instances

**File:** `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts:250-283,1736-1802,1932-1947`

`mapping` and `framesByKeyId` are native `Map` objects cast to `ReadonlyMap`; freezing the containing proposal does not disable `set`, `delete`, or `clear`.

**Recommendation:** Expose a closure-backed lookup without mutators, or make frozen assignments the sole authority.

### WR-02: Select All can display a Delete-specific disabled reason

**File:** `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx:610-619`

The Select All disabled reason is derived through the Delete utility path, which can surface unrelated Delete copy.

**Recommendation:** Use the shared busy-state explanation or a dedicated Select All disabled reason.

### WR-03: Tooltip lifecycle tests do not execute real effects

**File:** `app/src/components/physic-paint/view/PhysicsPaintStyledTooltip.test.ts:17-34,108-143`

The test hook runtime mocks `useEffect` as a no-op, so listener/timer cleanup and unmount behavior are not exercised.

**Recommendation:** Add a small real-Preact harness that verifies timer/listener cleanup on unmount and repeated show/hide cycles.

## Scope Notes

- The approved rigid group-drag behavior, group Copy/Paste behavior, flat borderless `#62666d` tooltip, Cmd/Ctrl+C/V routing, and notification capability change were not reopened.
- No source file was changed by the reviewer.
- These findings are advisory under the active GSD code-review capability and can be addressed with `/gsd-code-review 38 --fix` after phase closure.
