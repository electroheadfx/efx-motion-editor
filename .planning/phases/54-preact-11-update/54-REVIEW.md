---
phase: 54-preact-11-update
reviewed: 2026-11-02T08:46:22Z
depth: deep
files_reviewed: 19
files_reviewed_list:
  - app/src/components/canvas/PaintOverlay.tsx
  - app/src/components/canvas/TransformOverlay.tsx
  - app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx
  - app/src/components/physic-paint/hooks/usePhysicsPaintApplyResultController.ts
  - app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.ts
  - app/src/components/physic-paint/hooks/useRotoFrameEditingController.ts
  - app/src/components/physic-paint/hooks/useRotoPersistenceIntegration.ts
  - app/src/components/physic-paint/view/PhysicsPaintBackgroundClipSection.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintPhotoReferenceDialog.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx
  - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx
  - app/src/components/physic-paint/view/PhysicsPaintStyledTooltip.tsx
  - app/src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
  - app/src/components/sequence/KeyPhotoStrip.tsx
  - app/src/components/shared/NumericStepper.test.tsx
  - app/src/components/shared/NumericStepper.tsx
  - app/src/components/shared/SliderStepper.tsx
  - app/src/paintVersionDisciplineContract.test.ts
findings:
  critical: 2
  warning: 7
  info: 4
  total: 13
status: issues_found
---

# Phase 54: Code Review Report

**Reviewed:** 2026-11-02T08:46:22Z
**Depth:** deep
**Files Reviewed:** 19
**Status:** issues_found

## Summary

This is a re-review of Phase 54 after the prior review (`2026-10-14T16:59:08Z`). The two previous blockers are verified fixed in the current source: the `setRotoPlaybackSettings` pin now binds its early return to the equality compare (`paintVersionDisciplineContract.test.ts:195-207`), and `SUBSCRIBE_READ` now rejects the write forms (`paintVersionDisciplineContract.test.ts:29`). The Preact 10→11 type migration itself remains sound: the production seams are type-only (`RefObject<X | null>`), the signal discipline in `PhysicsPaintWorkflowStrip` (guarded `currentFrameSignal` echo at 2278) and the new lane-positioning effects (4269-4309, written termination conditions) are correct, and the stores' idempotence guards (`physicPaintStore.ts:3497-3532`) are intact.

Because the review was asked to judge the CURRENT state of these files, it also covers pre-existing defects in them, not only the type-only diff. Two are ship blockers: the Play Script dialog's root key handler hijacks Enter meant for focused controls (Enter on Cancel confirms the operation), and both shared steppers can strand the module-global undo coalescing on unmount, silently merging all later history entries. The remaining warnings are a keyboard-focus race in the Scripts panel, two contract pins that can still false-pass the discipline they claim to lock, a test materializer that swallows real component throws, an ineffective FX-sync suppression guard, an unguarded `getImageData` in the eyedropper, and a conditional-hook early return in `TransformOverlay`. No security vulnerabilities were found; no file was modified.

## Critical Issues

### CR-01: Play Script dialog root handler hijacks Enter from focused buttons — Enter on Cancel confirms the operation

**File:** `app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx:269-290` (Cancel button at `534-540`, primary apply at `557-572`)
**Issue:** The dialog root's `onKeyDown` treats every bubbled Enter as the implicit confirm when the controller is idle:

```tsx
if (!regenerateImpact && event.key === 'Enter' && !playScript.canCancel.value) {
  ...
  event.preventDefault();
  void playScript.confirm();
}
```

The handler runs on bubble for key events from any descendant. When focus is on the Cancel button (`playScript.cancel` at 537) and the user presses Enter, the browser's native button activation would normally fire that button's click — but `preventDefault()` on the keydown suppresses the synthesized click, and `playScript.confirm()` runs instead. Keyboard users who Tab to Cancel and press Enter apply/regenerate the script instead of cancelling. The same override hits the `Regenerate Rail` ghost button in loop-edit mode (549-552, whose native activation should open source edit) and any other focused button. Escape is not affected the same way (there is no field-level Escape handler in this dialog's own markup), so the defect is the Enter leg.

**Fix:** Never turn Enter into "confirm" when the key event came from a focused interactive control — let native button activation stand:

```tsx
onKeyDown={(event) => {
  event.stopPropagation();
  if (event.key === 'Escape') {
    event.preventDefault();
    if (regenerateImpact) keepLocalChanges(); else playScript.cancel();
    return;
  }
  if (event.key !== 'Enter' || regenerateImpact || playScript.canCancel.value) return;
  const target = event.target as HTMLElement | null;
  // Buttons keep their own Enter activation (Cancel stays Cancel).
  if (target?.closest('button, input, textarea, select, [role="button"], [contenteditable="true"]')) return;
  if (stackCollision !== null) {
    if (!collisionOffers.includes('truncate')) return;
    event.preventDefault();
    void playScript.confirmStackCollision('truncate');
    return;
  }
  const tabValidationError = revealTab ? playScript.revealValidationError.value : playScript.validationError.value;
  if (tabValidationError || playScript.repeatError.value) return;
  event.preventDefault();
  void playScript.confirm();
}}
```

### CR-02: Shared steppers strand the module-global history coalescing on unmount

**File:** `app/src/components/shared/NumericStepper.tsx:323-326` (cleanup), `362-383` (press bracket), `438-446` (focus bracket); `app/src/components/shared/SliderStepper.tsx:301-304` (cleanup), `395-418` (track drag bracket), `480-488` (focus bracket)
**Issue:** Both steppers bracket gestures with the module globals in `app/src/lib/history.ts:6-7`:

```ts
let coalescing = false;
let coalesceEntry: HistoryEntry | null = null;
```

`startCoalescing()` runs on every button press (`NumericStepper.tsx:371`, `SliderStepper.tsx:344`, track pointerdown `SliderStepper.tsx:400`) and on every input focus (`NumericStepper.tsx:439`, `SliderStepper.tsx:481`). The only stops are pointerup/cancel/leave, blur, and the preset-end path. The unmount cleanups clear timers only and never call `stopCoalescing()`:

```tsx
useEffect(() => () => {
  if (delayTimer.current !== null) clearTimeout(delayTimer.current);
  if (repeatTimer.current !== null) clearInterval(repeatTimer.current);
}, []);
```

If the control unmounts while it owns the session — a global keyboard action removes/rebuilds the containing panel while a stepper input is focused (e.g. Cmd+Z undoing the layer the sidebar field belongs to; removing a focused element does not dispatch `blur` in WebKit), or a dialog closes programmatically mid-press — `coalescing` stays `true` for the rest of the app's lifetime. From then on every `pushAction` outside the dead control either becomes the coalesce anchor or overwrites the stale anchor's `redo` without ever pushing a new entry (`history.ts:17-43`). Unrelated edits silently stop being undoable individually, and undo of the anchor replays a closure that belonged to a closed dialog. The code already acknowledges this exact strand class for the preset-end path (`NumericStepper.tsx:346-351`: "would strand module-global coalescing") but the unmount path is unguarded.

**Fix:** Track ownership and release it in the unmount cleanup of both components (and reset the gesture refs):

```tsx
const ownsCoalescing = useRef(false);
// where startCoalescing() is called:
ownsCoalescing.current = true;
startCoalescing();
// where stopCoalescing() is called:
ownsCoalescing.current = false;
stopCoalescing();
// cleanup:
useEffect(() => () => {
  clearRepeat();
  pressing.current = false;
  dragging.current = false;
  if (ownsCoalescing.current) {
    ownsCoalescing.current = false;
    stopCoalescing();
  }
}, []);
```

## Warnings

### WR-01: Scripts panel focus restoration is cancelled by its own dependency churn

**File:** `app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx:89-121`
**Issue:** The single effect schedules the confirmation's focus with `requestAnimationFrame`, updates `previousConfirmation.current = confirmation` at line 91, and cancels the frame in its cleanup (118-120). Its dependencies include `rows` and `selectedActionId` (121). A delete mutates the library rows and the selection; if either changes after the transition is recorded but before the frame fires, the cleanup cancels the pending focus move, and the re-run sees `confirmation === previousConfirmation.current`, so neither the open-focus nor the restore-focus branch schedules a replacement. The result is the GSD-52 focus-orphan class: focus stays on the removed row/body while the confirmation is open, or is never restored to a surviving row after delete. Close-then-rows-change ordering makes this deterministic rather than rare.

**Fix:** Do not bind the focus frame to dependency churn. Split the two transitions (open vs close) or read the latest values from refs inside the frame and cancel only on unmount:

```tsx
const rowsRef = useRef(rows);
rowsRef.current = rows;
const selectedRef = useRef(selectedActionId);
selectedRef.current = selectedActionId;
useEffect(() => {
  const previous = previousConfirmation.current;
  previousConfirmation.current = confirmation;
  if (!confirmation && !previous) return;
  const frame = requestAnimationFrame(() => {
    if (confirmation) { cancelDeleteRef.current?.focus(); return; }
    // restore, using rowsRef.current / selectedRef.current
  });
  return () => cancelAnimationFrame(frame);
}, [confirmation]);   // transition-only dependency
```

### WR-02: paintVersion contract still accepts a subscribe+write effect — the documented forbidden shape passes

**File:** `app/src/paintVersionDisciplineContract.test.ts:29, 106-115`
**Issue:** The pin's own comment (22-28) says "a write-in-effect is the OOM-loop class D-11 exists to prevent." The subscriber filter is:

```ts
blocks.filter((block) => SUBSCRIBE_READ.test(body) && SUBSCRIBE_READ.test(deps))
```

`SUBSCRIBE_READ` now rejects a body whose *only* paintVersion occurrence is a write, but an effect body that contains the subscribe read **and** a later `paintStore.paintVersion.value++` still matches on the read. Such an effect (a version clock that subscribes and bumps the same clock) is the loop motor the pin claims to exclude, and the pin would stay green. The `deps` check has the same shape: any read occurrence satisfies it.

**Fix:** Require the body to contain a read and no write form, and assert the same for every subscriber candidate:

```ts
const VERSION_WRITE = /paintStore\.paintVersion\.value\s*(?:\+\+|--|[+\-*/%]?=)/;
const subscribers = blocks.filter((block) => {
  const body = effectBody(block);
  return SUBSCRIBE_READ.test(body) && !VERSION_WRITE.test(body) && SUBSCRIBE_READ.test(depArray(block));
});
expect(subscribers.length).toBeGreaterThan(0);
```

(Verified: the only effect-body writes today are the FX re-render helpers at `PaintOverlay.tsx:2117,2139`, which do not read the clock and therefore are not subscriber candidates; this stricter filter passes today and catches the mutation.)

### WR-03: `setRotoBackgroundMetadata` pin locks one of four equality fields

**File:** `app/src/paintVersionDisciplineContract.test.ts:209-252` (asserts `physicPaintStore.ts:3513-3523`)
**Issue:** The store's idempotence guard compares four fields — `background`, `grainStrength`, `color`, `grainScale` — but the pin asserts only `current.background === next.background` (line 231). Deleting the strength/color/scale compares (the multi-field protection that stops the settings-sync effect from bump-looping, per the comment at `physicPaintStore.ts:3508-3512`) keeps the pin green. The ordering assertions are also loose: `body.indexOf('return;')` accepts any bare early return in the sliced body, and the slice boundary depends on the `'\n  get'` heuristic. This is the exact re-entry path to the documented ~65 renders/s OOM incident.

**Fix:** Pin all four comparisons and bind the return to the compare block:

```ts
expect(body).toMatch(/current\.background === next\.background/);
expect(body).toMatch(/current\.grainStrength === grainStrength/);
expect(body).toMatch(/current\.color === next\.color/);
expect(body).toMatch(/\(current\.grainScale \?\? 1\) === \(next\.grainScale \?\? 1\)/);
const guardIdx = body.indexOf('current.background === next.background');
const returnIdx = body.indexOf('return;', guardIdx);
expect(returnIdx).toBeGreaterThan(guardIdx);
expect(body.search(/\.set\(/)).toBeGreaterThan(returnIdx);
expect(body.indexOf('bumpTrackRevision')).toBeGreaterThan(returnIdx);
```

### WR-04: Vnode materializers swallow every component throw as an "opaque leaf"

**File:** `app/src/components/shared/NumericStepper.test.tsx:52-60`; `app/src/components/physic-paint/view/PhysicsPaintBackgroundClipSection.test.ts:128-135`; `app/src/components/physic-paint/view/PhysicsPaintPhotoReferenceDialog.test.ts:146-153`; `app/src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx:109-116`
**Issue:** Each helper wraps the whole function-component invocation in `try { ... } catch { return vnode; }`. The intent is legitimate — lucide-preact 1.57 icons call `useContext` and cannot be invoked outside a hook dispatcher — but the catch is not scoped to icons. A component that throws for a real reason (undefined signal read, malformed props, a hook-order regression) is rendered as an opaque leaf, and downstream structural assertions walk a tree that never executed the failing component. The tests can pass vacuously on the exact regressions they exist to catch.

**Fix:** Rethrow anything that is not a known lucide icon, or assert the opaque-leaf set explicitly:

```ts
try {
  return materialize(vnode.type(vnode.props));
} catch (error) {
  if (isLucideIcon(vnode.type)) return vnode;
  throw error;
}
```

### WR-05: `isSyncingStyle` suppression is cleared before the effects it guards ever run

**File:** `app/src/components/canvas/PaintOverlay.tsx:925-939` (flag), `2082-2177` (guarded effects, writes at `2117/2139`)
**Issue:** `syncStyleToSelection()` sets `isSyncingStyle.current = true`, writes `brushStyle`/`brushFxParams`, then clears the flag in a `queueMicrotask` with the comment "useEffect runs asynchronously." Preact's `useEffect` callbacks are deferred until after paint (the project's own paintVersion comment relies on this: "Preact 11 defers effect cleanups"), i.e. later than the microtask. Both FX effects therefore observe `isSyncingStyle.current === false` and proceed. Because `brushFxParams.value = {...stroke.brushParams}` always assigns a fresh object identity, selecting any FX-applied stroke re-applies its params and calls `reRenderFrameFx` plus a `paintVersion` bump — a full p5.brush re-render per selection, and the documented "skip selection sync" contract does not hold.

**Fix:** Remove the timing dependency. Prefer value-based skipping (no-op when every selected stroke already carries the incoming style/params) or a suppression counter consumed by the effects:

```ts
const pendingSyncs = useRef(0);
// in syncStyleToSelection: pendingSyncs.current = 2;  // one per guarded effect
// at the top of each effect:
if (pendingSyncs.current > 0) { pendingSyncs.current -= 1; return; }
```

### WR-06: Eyedropper `getImageData` is unclamped and uncaught inside the pointerdown handler

**File:** `app/src/components/canvas/PaintOverlay.tsx:1252-1269`
**Issue:** `point` comes from `clientToCanvas` (`coordinateMapper.ts:22-52`), whose output ranges to exactly `[0, projectWidth] × [0, projectHeight]`; the mapper also ignores the canvas wrapper's 2px border, so edge clicks resolve at or slightly past the project bounds. `px = Math.round(point.x * dpr)` can therefore equal `canvas.width` (or exceed it), and `ctx.getImageData(px, py, 1, 1)` throws `IndexSizeError`. A tainted composite or a zero-size canvas throws `SecurityError`/`IndexSizeError` as well. Nothing catches it, so the exception escapes the pointerdown handler and skips the handler tail (`setPointerCapture`/`preventDefault` at 1307-1308); the eyedropper silently fails at the right/bottom edge. The `container.querySelector('canvas')` first-match is also implicit — it happens to select the Preview canvas (dpr-scaled backing store, `previewRenderer.ts:329-341,417`, so the `dpr` mapping is currently correct), but nothing enforces it.

**Fix:**

```ts
const canvas = container.querySelector<HTMLCanvasElement>('canvas');
const ctx = canvas?.getContext('2d');
if (canvas && ctx) {
  const dpr = window.devicePixelRatio || 1;
  const px = Math.min(canvas.width - 1, Math.max(0, Math.round(point.x * dpr)));
  const py = Math.min(canvas.height - 1, Math.max(0, Math.round(point.y * dpr)));
  try {
    const [r, g, b] = ctx.getImageData(px, py, 1, 1).data;
    paintStore.setBrushColor(rgbaToHex(r, g, b));
  } catch {
    // tainted or zero-size canvas — keep the current brush color
  }
}
```

### WR-07: `TransformOverlay` returns before its hooks (conditional hook calls)

**File:** `app/src/components/canvas/TransformOverlay.tsx:114-122` (early `return null`) versus `124`/`130` (`useRef`)
**Issue:** The paint-mode/paint-layer guard returns `null` before the component's only hooks. Renders therefore alternate between zero and two hook calls depending on whether paint mode is on and the selected layer is a paint layer — a routine toggle. Preact happens to tolerate the skip today because the hooks are refs with no ordering-sensitive state, but this violates the hooks contract (the React equivalent throws "Rendered fewer hooks than expected") and is a latent corruption: any `useState`/`useEffect` added to the component will have its slot skipped or shifted when the guard toggles, and effects registered on earlier renders are neither re-run nor cleaned up during a skipped render.

**Fix:** Move the guard below the hook declarations (and every future hook), or split the null-returning case into a wrapper component so the hook-owning component always mounts.

## Info

### IN-01: Contract-test source parsers are heuristic and can mis-slice

**File:** `app/src/paintVersionDisciplineContract.test.ts:36-63, 71-91`
**Issue:** `useEffectBlocks` walks raw parentheses without skipping strings, template literals, comments, or regex literals; `depArray` takes `lastIndexOf('[')`, which assumes the final bracket group is the dependency array. A `useEffect(() => f(')'))` or a nested array literal in the deps mis-slices the block, and the pin then asserts against the wrong text (or silently stops scanning at line 60).
**Fix:** Prefer a real parser (TypeScript AST) for these engineering contracts, or at minimum skip string/comment regions while balancing brackets and locate the dep array by scanning the trailing `, [` before the closing `)`.

### IN-02: `useRotoPersistenceIntegration` is dead code, and its internals are landmines if wired later

**File:** `app/src/components/physic-paint/hooks/useRotoPersistenceIntegration.ts:81-166`
**Issue:** Nothing calls `useRotoPersistenceIntegration`; the only consumer of the file is its test, which imports `clearRotoEngineCanvas` (`useRotoPersistenceIntegration.test.ts:2`). Inside the unused hook, the three `configure*Port` calls run during render (`152-164`), and `persistKeyFrameTransaction` (`126-139`) sets `applying` state and registers the pending apply before an unguarded `await sendPhysicPaintApplyPayload(...)`; a transport rejection would leave the status stuck with no timeout armed.
**Fix:** Delete the unused hook (keep `clearRotoEngineCanvas` wherever it is genuinely needed) or wire it with the port configuration moved into an effect and the send wrapped in try/catch that publishes `error` status.

### IN-03: Canvas mount keeps a stale error and allocates a new size object per observer callback

**File:** `app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx:118-134`
**Issue:** `setMountError(CANVAS_MOUNT_ERROR)` (132) is never cleared: a transient absence of the canvas during the one-shot rAF leaves the "Unable to mount physics paint canvas" banner visible for the rest of the mount even after a later check finds the canvas. `setDisplaySize(getContainedCanvasDisplaySize(...))` (121) always passes a fresh object, so every observer callback re-renders even when the dimensions are unchanged.
**Fix:** Clear the error when `mounted` is true, and skip the state write when width/height are unchanged:

```ts
const next = getContainedCanvasDisplaySize(rect.width, rect.height, props.width, props.height);
setDisplaySize((prev) => prev && prev.width === next.width && prev.height === next.height ? prev : next);
```

### IN-04: `SliderStepper` track range falls back to a value-dependent ceiling

**File:** `app/src/components/shared/SliderStepper.tsx:294-296`
**Issue:** `const trackCeiling = sliderMax ?? max ?? Math.max(value, trackFloor + 1);` — when a caller supplies neither `sliderMax` nor `max`, the knob fraction denominator (`trackSpan`) changes with the current value, so the knob position is not a stable function of the value. All current call sites pass one of the two (verified: `AudioProperties.tsx` and `PhysicsPaintPlayScriptCards.tsx`), so this is latent, but the shared component should not encode a value-dependent scale.
**Fix:** Fail safe — derive the ceiling from `presets?.at(-1)` when present, otherwise require one bound (or fall back to a fixed constant plus the current value only for display), and assert the invariant in the component's tests.

---

_Reviewed: 2026-11-02T08:46:22Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
