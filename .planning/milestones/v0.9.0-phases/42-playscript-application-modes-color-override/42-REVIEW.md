---
phase: 42-playscript-application-modes-color-override
reviewed: 2026-08-06T00:00:00Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - app/src/components/physic-paint/hooks/useRotoPlayScriptController.test.ts
  - app/src/components/physic-paint/hooks/useRotoPlayScriptController.ts
  - app/src/components/physic-paint/physicsPaintStudio.css
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts
  - app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx
  - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx
  - packages/efx-physic-paint/src/animation/index.ts
  - packages/efx-physic-paint/src/animation/staticStrokeSchedule.test.ts
  - packages/efx-physic-paint/src/animation/staticStrokeSchedule.ts
findings:
  critical: 1
  warning: 2
  info: 5
  total: 8
status: issues_found
---

# Phase 42: Code Review Report

**Reviewed:** 2026-08-06
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

Reviewed the Play Script application-mode (progressive/static-hold), color-override, Motion-values, live brush-color feed, panel summary, and draggable dark modal changes. The core controller logic (authority revalidation, commit acknowledgement validation, confirm-time snapshot discipline, summary single-assignment) is well defended and thoroughly tested. The static stroke schedule and renderer changes are clean.

However, one critical keyboard-isolation defect was found: the reworked modal does not stop key events from bubbling to the Studio-level shortcut dispatcher, so arrows/Space/undo and other shortcuts mutate Studio state behind the open modal — and the frame navigation this triggers then makes Generate fail silently. That silent-failure path is compounded by a confirm() guard that surfaces no feedback.

## Critical Issues

### CR-01: Keyboard shortcuts leak through the open Play Script modal and mutate Studio state behind it

**File:** `app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx:120-144, 161-184`

**Issue:** The dialog renders inside the `<section>` that carries the Studio keydown handler (`PhysicsPaintStudioView.tsx:164,179`). The dialog's root `onKeyDown` only handles Escape/Enter/Tab and never calls `stopPropagation`; the new APG radio handlers (`onModeKeyDown`, `onColorKeyDown`) call `event.preventDefault()` but also do not stop propagation. The Studio dispatcher (`physicsPaintStudioKeyboard.ts:62-`) checks neither `event.defaultPrevented` nor whether a `[role="dialog"]` is open — only the Delete shortcut has a dialog gate (`isPhysicsPaintRotoDeleteTarget`). The radio options are `<div role="radio" tabIndex={0}>`, so `isPhysicsPaintShortcutTarget` returns true for them (only input/textarea/select/contentEditable are excluded).

Concretely, with the dialog open and focus on a radio option (which the APG pattern itself requires for arrow navigation) or any dialog button:

- **ArrowLeft/ArrowRight** switches the dialog's mode/color option AND fires `actions.navigateRotoFrame(...)` behind the modal (`physicsPaintStudioKeyboard.ts:151-159`). The frame change alters `getSelection().appFrame`, so the next `confirm()` hits the `startingSelection.appFrame !== start` guard (`physicsPaintRotoPlayScriptController.ts:226`) and silently returns false — Generate appears dead.
- **Space** toggles Roto playback behind the modal, defeating the controller's `stopPlayback()` calls.
- **Cmd/Ctrl+Z / Cmd+Shift+Z / Ctrl+Y** fire undo/redo behind the modal; `g`, `o`, `[`, `]` also dispatch.

**Fix:** Stop keyboard events from leaving the dialog. Minimal fix at the dialog root, alongside the existing handler:

```tsx
onKeyDown={(event) => {
  if (event.key === 'Escape') { event.preventDefault(); playScript.cancel(); return; }
  if (event.key === 'Enter' && !playScript.validationError.value && !playScript.canCancel.value) {
    event.preventDefault();
    void playScript.confirm();
    return;
  }
  if (event.key === 'Tab') {
    // ... existing trap logic ...
    return;
  }
  // Modal isolation: no other key reaches the Studio shortcut dispatcher.
  event.stopPropagation();
}}
```

(The complementary hardening — a `[role="dialog"]` gate in `dispatchPhysicsPaintStudioKeyDown` matching the existing Delete-shortcut precedent — belongs in `physicsPaintStudioKeyboard.ts`, outside this phase's file set.)

## Warnings

### WR-01: confirm() guard rejections are completely silent — no user feedback

**File:** `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts:226`

**Issue:** When any confirm precondition fails (`start === null`, `count === null`, `repeatError`, `disabledReason`, or `startingSelection.appFrame !== start`), `confirm()` returns `false` without setting `error`, `status`, or logging. Combined with CR-01 (arrow keys change the selection behind the modal, tripping the `appFrame !== start` guard) and with the Generate button being disabled only on `validationError` — not `repeatError` (`PhysicsPaintPlayScriptDialog.tsx:392`) — the user can click Generate or press Enter and get literally zero feedback about why nothing happened.

**Fix:** Set an explanatory status/error before returning false, e.g.:

```ts
if (disposed || !selectedId || !context?.project || start === null || count === null || repeatError.peek() !== null || disabledReason.peek()) return false;
if (startingSelection.appFrame !== start) {
  error.value = `The selected frame changed (now F${startingSelection.appFrame}). Close and reopen Play Script to retarget.`;
  status.value = 'Play Script target changed';
  return false;
}
```

### WR-02: rAF-based render yield can stall generation indefinitely in a hidden webview

**File:** `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts:142-154`

**Issue:** `yieldToBrowser` waits on `requestAnimationFrame` with no timeout fallback. In a hidden/backgrounded Tauri webview (or any throttled context) rAF stops firing, so the frame loop between `throwIfAborted` checkpoints hangs forever; only an explicit user Cancel (abort listener) unblocks it. Pre-existing pattern, but the phase-42 static mode multiplies frame counts (repeat=1 cycle rendering), widening exposure.

**Fix:** Race the rAF against a short setTimeout fallback so background throttling degrades to timer-paced rendering instead of a stall:

```ts
function yieldToBrowser(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const abort = () => { cancelAnimationFrame(id); window.clearTimeout(timer); reject(new DOMException('Play Script generation cancelled.', 'AbortError')); };
    const done = () => { signal.removeEventListener('abort', abort); window.clearTimeout(timer); resolve(); };
    const id = requestAnimationFrame(done);
    const timer = window.setTimeout(done, 100);
    signal.addEventListener('abort', abort, { once: true });
  });
}
```

## Info

### IN-01: NaN frameCount produces NaN endFrame in the static schedule builder

**File:** `packages/efx-physic-paint/src/animation/staticStrokeSchedule.ts:20`

**Issue:** `Math.max(1, Math.trunc(frameCount))` returns `NaN` for a `NaN` input (Math.max propagates NaN), yielding `endFrame: NaN`. The app caller validates `frameCount` as an integer before invoking, so this is unreachable today, but the exported package API does not defend itself. A `Number.isFinite(frameCount) ? ... : 1` guard would close it.

### IN-02: getStaticFrameStrokes ignores schedule range metadata and frameIndex bounds

**File:** `packages/efx-physic-paint/src/animation/staticStrokeSchedule.ts:32-48`

**Issue:** The accessor returns every stroke at full `pointCount` for any `frameIndex` — including negative or beyond `endFrame` — and never reads the `startFrame`/`endFrame`/`pointsPerFrame` fields the builder writes. This diverges from `getProgressiveFrameStrokes`, which filters by `entry.startFrame > frameIndex`. The "hold on every frame" contract makes the behavior correct for the current caller, but the dead metadata invites a future consumer to assume range filtering that does not exist. Either honor the range fields or document that they are informational for the static schedule.

### IN-03: Engine teardown in finally can mask the original render/init error

**File:** `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts:103-108`

**Issue:** If `engine.init()` or a frame render throws, the `finally` block unconditionally calls `engine.setInputLocked(false)`, `engine.setAnimationMode(false)`, and `engine.destroy()` on a possibly partially-initialized engine. If any of those throw, the original (diagnostically valuable) error is replaced. Wrapping teardown in its own try/catch preserves the primary failure.

### IN-04: Modal drag clamping uses pointerdown-time geometry and persists across window resizes

**File:** `app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx:68-104, 190`

**Issue:** The clamp rect is captured once at pointerdown and `dragOffset` persists for the component's lifetime (across dialog close/reopen). If the window is resized after a drag, the modal can remain translated against stale viewport bounds with no reset affordance short of reloading the window. Re-clamping the stored offset on open (or on window resize) would keep the modal reachable.

### IN-05: Hook captures ports.library from the first render only

**File:** `app/src/components/physic-paint/hooks/useRotoPlayScriptController.ts:40`

**Issue:** Every dynamic port is proxied through `portsRef.current`, but `library` is captured by value at controller creation. This is safe today because `useRotoScriptLibraryController` returns a stable ref-backed instance (`controllerRef`), but the asymmetry would silently break availability/commit flows if the library controller identity ever changed (e.g., a future reset-for-launch recreation). Passing `getLibrary: () => portsRef.current.library` or documenting the stability requirement on the port would remove the trap.

---

_Reviewed: 2026-08-06_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
