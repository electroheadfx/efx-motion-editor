---
phase: 38-multi-copy-paste-and-tooltip-polish
fixed_at: 2026-07-29T18:31:11Z
review_path: .planning/phases/38-multi-copy-paste-and-tooltip-polish/38-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 38: Code Review Fix Report

**Fixed at:** 2026-07-29T18:31:11Z
**Source review:** .planning/phases/38-multi-copy-paste-and-tooltip-polish/38-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 7 (4 critical, 3 warning; fix_scope = critical_warning)
- Fixed: 7
- Skipped: 0

## Fixed Issues

### CR-01: Malformed authority messages can throw before validation

**Files modified:** `app/src/types/physicPaint.ts`, `app/src/lib/physicPaintBridge.ts`
**Commit:** 5215b0ef
**Applied fix:** Added a strict runtime validator `isPhysicPaintRotoAuthorityRequest(value: unknown)` (exact key set, bounded operation id, non-empty context/layer strings, non-negative integer canonicalStart). Added `getPhysicPaintRotoAuthorityFromUnknown(payload: unknown)` in the bridge: validated requests delegate to `getPhysicPaintRotoAuthority`; malformed payloads return a failure result built from best-effort extracted envelope fields with a fixed default interpolation-settings echo and never touch store state. Both the Tauri listener and the postMessage listener now route through the validating entry point instead of casting untrusted payloads.

### CR-02: Delete shortcut can throw when no Roto key is selected

**Files modified:** `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts`, `app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts`
**Commit:** 8cb80e4c
**Applied fix:** `deleteRotoFrame()` no longer calls the throwing `ensureSelectedKeyId` helper on the single-selection path; when no bounded selected key exists it publishes "Select a real Roto key to delete." and resolves `false`. The Backspace/Delete keyboard route now honors `state.mutationLocked` (same guard placement as copy/paste/undo/redo). Group delete (2+ selected keys) and the approved delete routing are unchanged.

### CR-03: Press-and-hold physics controls can remain active

**Files modified:** `app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx`
**Commit:** 095d95a0
**Applied fix:** Extracted a `PhysicsPaintHoldButton` child for the physics-last/physics-all controls with a unified pointer lifecycle: pointer capture on pointerdown, stop on pointerup, pointercancel, lostpointercapture, blur, and unmount (idempotent hold-active ref). Added intentional keyboard press-and-hold semantics: Space/Enter keydown starts (auto-repeat ignored, default prevented), keyup stops. The mouse/touch split handlers (which missed `touchcancel`) were removed.

### CR-04: Incomplete CSS escaping can break drag focus restoration

**Files modified:** `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx`
**Commit:** eeb07ae7
**Applied fix:** Removed the `cssEscape` helper and both `[data-roto-key-id="..."]` selector constructions. Added `findRotoKeyCellByKeyId(scroller, keyId)` which iterates `[data-roto-key-id]` elements and compares `dataset.rotoKeyId` directly, so opaque key IDs can never make `querySelector` throw during cancellation or accepted-drag settlement. The numeric `data-roto-app-frame` fallback lookup is unchanged.

### WR-01: Resolver proposals expose mutable Map instances

**Files modified:** `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts`
**Commit:** c6d319c7
**Applied fix:** Added an `asImmutableMap` helper that copies the source map, replaces `set`/`delete`/`clear` with throwing stubs, and freezes the instance. Both resolver output sites — the proposal `mapping` and the projection `framesByKeyId` — now expose runtime-immutable maps; the `ReadonlyMap` interface and all read-only consumers are unchanged.

### WR-02: Select All can display a Delete-specific disabled reason

**Files modified:** `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx`
**Commit:** 13593330
**Applied fix:** The Select All disabled reason under the shared busy lock now uses the shared busy-state explanation (`ROTO_KEY_BUSY_STATUS_TEMPLATE`) instead of routing through `getRotoKeyUtilityDisabledMessage('delete')`. Non-busy reasons still come verbatim from the `selectAllKeysDisabledReason` controller port.

### WR-03: Tooltip lifecycle tests do not execute real effects

**Files modified:** `app/src/components/physic-paint/view/PhysicsPaintStyledTooltip.test.ts`
**Commit:** 363bb0af
**Applied fix:** Upgraded the test hook runtime so `useEffect` executes real effect semantics (deps comparison, cleanup before re-run, cleanup on unmount via `hookRuntime.unmount()`); each harness render flushes effects. Added a `useStyledTooltip — real effect lifecycle (WR-03)` describe with four tests: pending hover timer cleared on unmount, Escape listener removed when unmounted while visible, no listener accumulation across repeated show/hide cycles, and pending hover cancellation with a later full hover still showing. All pre-existing tooltip tests pass unchanged.

---

_Fixed: 2026-07-29T18:31:11Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
