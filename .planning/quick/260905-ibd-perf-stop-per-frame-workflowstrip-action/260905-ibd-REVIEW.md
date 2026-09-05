---
phase: 260905-ibd-perf-stop-per-frame-workflowstrip-action
reviewed: 2026-09-05T14:30:00Z
depth: quick
files_reviewed: 12
files_reviewed_list:
  - app/src/components/physic-paint/hooks/useRotoTimelineActions.ts
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/performance/physicsPaintPerformanceTrace.ts
  - app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStripRailCreate.test.tsx
  - app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.test.tsx
  - app/src/components/physic-paint/performance/physicsPaintPerformanceTrace.test.ts
findings:
  critical: 0
  warning: 1
  info: 2
  total: 3
status: issues_found
---

# Phase 260905-ibd: Code Review Report

**Reviewed:** 2026-09-05T14:30:00Z
**Depth:** quick
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Reviewed the G-52-9 performance fix (quick-260905-ibd) that stops per-frame WorkflowStrip action-row re-renders during scrub. The change has four parts: (1) `useComputed`-stabilized availability computeds in `useRotoTimelineActions` with a signal-backed classifier input surface; (2) a memo-wrapped `PhysicsPaintRotoActionRow` fed by `ReadonlySignal` props with narrow per-button subscribers; (3) identity-stable action-row handler props via the deferred-ref pattern; (4) a Studio-owned `currentFrameSignal` written via guarded echo in the three startFrame callers.

The design holds under adversarial scrutiny. Key verifications:

- **Availability stays LIVE.** The availability computeds track `currentFrameSignal` transitively via `effectiveInput.getCurrentAppFrame` (`useRotoTimelineActions.ts:1784`). Computed signals only notify when the VALUE changes, so the action-row re-renders at key boundaries, never per scrub frame.
- **No stale closures.** The `@preact/signals` v2.8.1 `useComputed` implementation re-points a ref to the latest factory each render (`r.current = i`), so the computeds always evaluate against the current `effectiveInput` — the first-render-capture concern does not apply. All frame-dependent action handlers use the deferred-ref pattern (`actionRowHandlersRef` in `PhysicsPaintStudio.tsx:1790-1805`) or `useCallback` deps that include `effectiveInput`.
- **Memo props are identity-stable during scrub.** `rotoPhysicalActions` (useMemo bundle), `sessionAvailability` (9-field guarded-echo mirror), `hasCopiedRotoKey` (boolean mirror), `visibleFrameResolutions` and `physicalCellByAppFrame` (both derived from `structuralIndex`, which depends on `currentPhysicalCells` = `rotoTimelineModel.physicalCells.value`, a structural-only signal), and `isCurrentRealRotoKey` (flips only at key boundaries) are all stable between key boundaries. `rotoTimelineModel` is identity-stable during scrub because `useRotoTimelineModel`'s useMemo deps are structural-only (frame/selection deliberately absent per 38.1 D-07).
- **Per-instance scoping holds.** All new signals are `useSignal`/`useMemo` per Studio instance; no module-level signal was added.
- **The 9-field mirror comparison is sufficient.** The action-row reads only `canInsert/canDuplicate/canCopy/canPaste/canDelete/busy/disabledReason/pasteDisabledReason/currentIsGenerated` from `sessionAvailability`; the 5 un-compared fields (`currentIsRealKey`, `hasCopiedRotoKey`, `operationsRequiringRealSource`, `dirtySaveBeforeAction`, `exposes`) are never read by the action-row.
- **Quick-depth grep patterns** (hardcoded secrets, dangerous functions, debug artifacts, empty catch, commented-out code) returned no matches across all 12 files.

No BLOCKER findings. One WARNING (latent Rules-of-Hooks violation) and two Info items.

## Warnings

### WR-01: Conditional hook call in the strip's `currentFrameSignal` fallback

**File:** `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx:702`
**Issue:** `const currentFrameSignal = props.currentFrameSignal ?? useSignal(props.currentFrame);` — the `useSignal` call is skipped whenever `props.currentFrameSignal` is provided. This is a conditional hook call: if a consumer ever passes the prop on some renders and omits it on others, Preact's hook order changes across renders and the component misbehaves (stale state or a hard-to-debug render error). The prop is declared optional (`currentFrameSignal?: ReadonlySignal<number>` at line 361), so the contract permits exactly this. Today it is safe only because the Studio always passes the prop and the test harnesses always omit it — a fragile invariant.
**Fix:** Always call the hook, then prefer the prop:
```ts
const fallbackFrameSignal = useSignal(props.currentFrame);
const currentFrameSignal = props.currentFrameSignal ?? fallbackFrameSignal;
if (!props.currentFrameSignal && fallbackFrameSignal.peek() !== props.currentFrame) {
  fallbackFrameSignal.value = props.currentFrame;
}
```

## Info

### IN-01: Dead `hasCopiedRotoKey` boolean field in `PhysicsPaintWorkflowRotoKeyState`

**File:** `app/src/components/physic-paint/PhysicsPaintStudio.tsx:3565,3567`
**Issue:** The `rotoKeyState` object writes `hasCopiedRotoKey: rotoSession.copiedKey.value !== null` in both branches, but the strip only ever reads `props.rotoKeyState?.actionAvailability` (`PhysicsPaintWorkflowStrip.tsx:2411`). The field is never consumed — dead code that invites a future reader to trust a value that has no effect.
**Fix:** Remove the `hasCopiedRotoKey` field from `PhysicsPaintWorkflowRotoKeyState` and from both object literals, or wire it to a consumer if it was intended to drive the paste button.

### IN-02: Test-harness `renderedCache` can return stale component output

**File:** `app/src/components/physic-paint/view/PhysicsPaintWorkflowStripRailCreate.test.tsx:195-199`
**Issue:** The `childrenOf` walk caches function-component output in a `WeakMap` keyed by vnode. If a future test mutates a signal and re-walks the same vnode tree without re-rendering, the cache returns the pre-mutation output. Today each `render()` call produces fresh vnodes, so the cache only deduplicates repeated references to the same vnode — but the invariant is implicit and a future test that reuses a rendered tree after a signal write will silently assert against stale output.
**Fix:** Document the invariant (cache is valid only within a single render pass) or key the cache by `(vnode, renderEpoch)` so a re-walk after a signal mutation bypasses it.

---

_Reviewed: 2026-09-05T14:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
