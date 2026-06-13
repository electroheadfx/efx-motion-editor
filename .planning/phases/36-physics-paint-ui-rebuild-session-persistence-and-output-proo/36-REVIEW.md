---
phase: 36-physics-paint-ui-rebuild-session-persistence-and-output-proo
reviewed: 2026-06-13T07:07:08Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - app/src/lib/physicPaintBridge.ts
  - app/src/lib/physicPaintBridge.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/PhysicsPaintWorkflowStrip.tsx
  - app/src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts
  - app/src/stores/physicPaintStore.ts
  - app/src/stores/physicPaintStore.test.ts
findings:
  critical: 2
  warning: 1
  info: 0
  total: 3
status: issues_found
---
# Phase 36: Code Review Report

**Reviewed:** 2026-06-13T07:07:08Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Re-reviewed the Phase 36 review-fix scope after commits `bac7be3`, `9e8e4b7`, `659381f`, `d24894f`, and `abde5d7`, focusing on the prior CR-01, CR-02, CR-03, and WR-01 findings plus regressions introduced by the fixes.

CR-02's workflow buttons are now reachable from the UI, but the bridge and save-and-advance fixes still have release-blocking correctness gaps. The browser fallback now delivers the apply payload to the opener, but the parent cannot deliver the apply result back to the standalone, so saves still time out in that mode. The roto save-and-advance flow also records the pending advance too late for synchronous apply-result delivery. WR-01 is only partially addressed because the conversion test still inspects source strings instead of exercising the component behavior.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Browser fallback still cannot return apply results to the standalone

**File:** `app/src/lib/physicPaintBridge.ts:134-147` and `app/src/components/physic-paint/PhysicsPaintStudio.tsx:163-166`

**Issue:** The CR-01 fix restored opener-based apply delivery by calling `window.opener.dispatchEvent(...)` from the standalone, but the result path is still one-way. In the parent browser fallback listener, `installPhysicPaintApplyListener` receives a `CustomEvent` with no `event.source`, then calls `sendBrowserApplyResult(result, undefined)`. `sendBrowserApplyResult` dispatches the result on the parent window and optionally posts to `source` or `window.opener`; for the parent editor, `window.opener` is normally null and `source` is undefined. The standalone `PhysicsPaintStudio` listens for `PHYSIC_PAINT_APPLY_RESULT_EVENT` in its own window, so it never receives the success/failure result and still hits the 5-second timeout after a successful parent-side apply.

**Fix:** Use a bidirectional transport that preserves the child window as the reply target. For the same-origin fallback, send the payload with `postMessage` and have the parent listener reply to `event.source`; alternatively use a same-origin `BroadcastChannel` for both apply and result messages. For example:

```ts
// Standalone
window.opener.postMessage({ type: PHYSIC_PAINT_APPLY_EVENT, payload }, window.location.origin);

// Parent
const listener = (event: MessageEvent) => {
  if (event.origin !== window.location.origin) return;
  if (event.data?.type !== PHYSIC_PAINT_APPLY_EVENT) return;
  const result = applyPhysicPaintPayload(event.data.payload);
  event.source?.postMessage({ type: PHYSIC_PAINT_APPLY_RESULT_EVENT, payload: result }, event.origin);
};
```

Then have the standalone consume the `message` result and/or dispatch it locally to `handleApplyResult`.

### CR-02: Roto save-and-advance can miss successful apply results and never advance

**File:** `app/src/components/physic-paint/PhysicsPaintStudio.tsx:626-733`

**Issue:** The CR-03 fix defers advancement until `handleApplyResult`, but `saveRotoFrameAndAdvance` sets `pendingRotoAdvanceRef.current` only after `await saveRotoFrame()` returns. `saveRotoFrame` sends the payload before returning, and browser-style event delivery can be synchronous (`dispatchEvent`) or otherwise faster than the caller setting the pending advance. If the matching apply result is handled before line 732, `handleApplyResult` sees `pendingRotoAdvanceRef.current === null`, marks the frame saved, does not navigate, and clears no future trigger. The caller then sets `pendingRotoAdvanceRef.current` after the only result has already been consumed, leaving the UI stuck on the saved frame with stale pending state.

**Fix:** Establish the pending advance before sending the apply payload, or pass the requested advance into `saveRotoFrame` so the operation state is complete before any result can arrive. For example:

```ts
const saveRotoFrame = useCallback(async (advanceToFrame?: number) => {
  if (!actionContext || !readyToApply) return null;
  const { launchContext } = actionContext;
  pendingRotoAdvanceRef.current = advanceToFrame ?? null;
  // build operationId, set activeOperationIdRef, send payload, start timeout...
}, [actionContext, readyToApply, startApplyTimeout]);

const saveRotoFrameAndAdvance = useCallback(async () => {
  if (!launchContext) return;
  await saveRotoFrame(launchContext.startFrame + 1);
}, [launchContext, saveRotoFrame]);
```

Also clear `pendingRotoAdvanceRef.current` in the `saveRotoFrame` catch path so failed sends do not leave stale advancement state.

## Warnings

### WR-01: Conversion coverage still relies on source-string inspection instead of behavior

**File:** `app/src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts:91-112`

**Issue:** The previous WR-01 requested replacing the weak source-contract assertion with an interaction test. The updated test is stronger than before, but it still reads `PhysicsPaintWorkflowStrip.tsx` as text and checks snippets. It does not render the component, click the conversion controls, verify the confirmation dialog appears, or assert that `Continue` invokes `onConvertPlayToRoto` / `onConvertRotoToPlay` under real Preact event wiring. This can still pass while the conversion flow is broken by JSX structure, conditional rendering, event propagation, or disabled-state behavior.

**Fix:** Add real component interaction coverage using the project's Preact test setup. Render `PhysicsPaintWorkflowStrip` in play mode, click `Convert Play to Roto`, click `Continue`, and assert `onConvertPlayToRoto` fires; repeat for roto mode and assert missing Play frames disables/prevents the Play-to-Roto callback.

---

_Reviewed: 2026-06-13T07:07:08Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
