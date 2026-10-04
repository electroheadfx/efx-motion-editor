import { signal } from '@preact/signals';
import type { ToolType } from '@efxlab/efx-physic-paint';

/**
 * quick 261003-vos — Alt = temporary erase in the Physics Paint Studio window.
 *
 * Session-only arm: while Alt is held (gated — Paint tool selected, Studio
 * shortcut target, engine mounted, not mutation-locked, no key repeat) the
 * NEXT gesture erases through the engine's EXISTING erase contract (quicks
 * 261003-hpi/261003-ud9). The selected tool itself never changes and nothing
 * is persisted — the feature's ONLY engine interaction is engine.setTool, so
 * packages/** stays untouched and zero erase logic is forked here.
 *
 * Three invariants (see physicsPaintTemporaryErase.test.ts for the contract):
 *
 *  1. Preserved Alt: the keydown/keyup/blur/visibility handlers never call
 *     preventDefault or stopPropagation, so every existing Alt exclusion in
 *     physicsPaintStudioKeyboard.ts (Meta+Alt+C/X/V/A, Backspace/Delete,
 *     Escape) keeps working byte-for-byte — that file is never edited.
 *  2. Gesture ownership: the engine reads state.tool LIVE at every gesture
 *     stage, so arm/disarm applies are DEFERRED while a pointer gesture is in
 *     flight; one force-sync at window pointerdown (capture phase, before the
 *     engine's own handler) makes the tool provably correct at every gesture
 *     START — a lost Alt keyup, Alt+Tab blur, or hidden window can never leave
 *     the Studio stuck erasing.
 *  3. Selected-tool authority: combineEffectiveTool is the ONE combination
 *     rule — armed + selected 'paint' resolves to 'erase'; an armed 'erase'
 *     selection stays 'erase' (never flips back), and the selected tool is
 *     never written by this module. resolveEffectiveTool (non-subscribing, for
 *     the engine sync) and readEffectiveTool (subscribing, for UI leaves) are
 *     its two readers.
 */

/**
 * The arm state. Engine paths read it via .peek() (no subscription). UI leaves
 * read it through readEffectiveTool so an Alt press re-renders only that leaf —
 * never Studio's render body (skill rule 5: a .value read subscribes the whole
 * component, and Studio is a 4.7k-line tree).
 */
export const temporaryErase = signal(false);

/** The slice of the engine this feature touches — engine.setTool and nothing else. */
export interface TemporaryEraseEngine {
  setTool: (tool: ToolType) => void;
}

/** Injected deps — keeps this module free of PhysicsPaintStudio imports (testable with spies). */
export interface TemporaryEraseDeps {
  getSelectedTool: () => ToolType;
  getEngine: () => TemporaryEraseEngine | null;
  isMutationLocked: () => boolean;
  isShortcutTarget: (target: EventTarget | null) => boolean;
}

export type TemporaryEraseBoundary = 'down' | 'up' | 'cancel';

/** Window/document-shaped targets so node tests mount with fakes — no globals at import time. */
export interface TemporaryEraseEventTargetLike {
  addEventListener(type: string, listener: (event: Event) => void, options?: boolean | { capture?: boolean }): void;
  removeEventListener(type: string, listener: (event: Event) => void, options?: boolean | { capture?: boolean }): void;
}

export interface TemporaryEraseMountTargets {
  window: TemporaryEraseEventTargetLike;
  document: TemporaryEraseEventTargetLike & { visibilityState?: DocumentVisibilityState };
}

/**
 * The ONE combination rule: 'erase' only when armed AND the selected tool is
 * paint. A selected 'erase' wins (no flip-back); a disarmed selection passes
 * through untouched. Never mutates its input.
 */
export function combineEffectiveTool(armed: boolean, selected: ToolType): ToolType {
  return armed && selected === 'paint' ? 'erase' : selected;
}

/** Non-subscribing read — for engine paths (handlers, sync) that must not own a render. */
export function resolveEffectiveTool(selected: ToolType): ToolType {
  return combineEffectiveTool(temporaryErase.peek(), selected);
}

/**
 * Subscribing read — for UI leaves (rail button, tool slider row) that must
 * flip their display when the arm state changes. Keep every call site a narrow
 * leaf, never a large container.
 */
export function readEffectiveTool(selected: ToolType): ToolType {
  return combineEffectiveTool(temporaryErase.value, selected);
}

/** True while a pointer gesture is live — arm/disarm applies defer to the boundary. */
let inFlight = false;
/** The (engine, tool) pair this feature last applied — engine identity is part of the key. */
let lastApplied: { engine: TemporaryEraseEngine; tool: ToolType } | null = null;

interface SyncOptions {
  /**
   * Force: bypass BOTH gates (inFlight deferral AND the last-applied dedupe).
   * Only the pointerdown capture sync and the armed [engine, settings.tool]
   * Studio sync use it — force is the self-healing invariant: whatever
   * happened (lost keyup, external setTool, engine re-create), the tool at the
   * call site is provably the effective one.
   */
  force?: boolean;
}

/**
 * The single writer of the engine tool from this feature: computes the
 * effective tool and applies it through engine.setTool (the ONLY engine call
 * in the whole quick — the engine's pre-existing 'erase' branch does all
 * erasing). Skips while a gesture is in flight (unless force) and when the
 * (engine, desired) pair already matches the last applied pair (unless force).
 */
export function syncTemporaryErase(deps: TemporaryEraseDeps, options?: SyncOptions): void {
  const engine = deps.getEngine();
  if (!engine) return;
  const desired = resolveEffectiveTool(deps.getSelectedTool());
  if (!options?.force) {
    if (inFlight) return;
    if (lastApplied && lastApplied.engine === engine && lastApplied.tool === desired) return;
  }
  engine.setTool(desired);
  lastApplied = { engine, tool: desired };
}

/**
 * Arm on a gated Alt keydown. Gates mirror the Studio dispatcher's own
 * isPhysicsPaintShortcutTarget + selectTool's canMutate family, so arming
 * behaves like a tool switch that never touches the tool state. Key repeat is
 * ignored; a successful arm syncs (deferring to the boundary when in flight).
 */
export function handleTemporaryEraseKeyDown(event: KeyboardEvent, deps: TemporaryEraseDeps): void {
  if (event.key !== 'Alt' || event.repeat) return;
  if (!deps.isShortcutTarget(event.target)) return;
  if (deps.getSelectedTool() !== 'paint') return;
  if (deps.getEngine() === null) return;
  if (deps.isMutationLocked()) return;
  temporaryErase.value = true;
  syncTemporaryErase(deps);
}

/**
 * Alt keyup disarms UNCONDITIONALLY — no gate may suppress a release (a
 * keyup inside an input, after a tool switch, or while locked still clears),
 * so a stuck arm can never survive a lost key combination. The event is never
 * consumed.
 */
export function handleTemporaryEraseKeyUp(event: KeyboardEvent, deps: TemporaryEraseDeps): void {
  if (event.key !== 'Alt') return;
  temporaryErase.value = false;
  syncTemporaryErase(deps);
}

/** Window blur disarms unconditionally (Alt+Tab to the main window, closed popover…). */
export function handleTemporaryEraseBlur(deps: TemporaryEraseDeps): void {
  temporaryErase.value = false;
  syncTemporaryErase(deps);
}

/** visibilitychange-to-hidden disarms; to-visible does NOT (it never armed anything). */
export function handleTemporaryEraseVisibilityChange(deps: TemporaryEraseDeps, visibilityState: DocumentVisibilityState): void {
  if (visibilityState !== 'hidden') return;
  temporaryErase.value = false;
  syncTemporaryErase(deps);
}

/**
 * Gesture boundary — the deferral machinery:
 *  - 'down' force-syncs FIRST (window capture runs before the engine's own
 *    canvas pointerdown handler) then marks inFlight;
 *  - 'up'/'cancel' clear inFlight then sync, so the deferred arm/disarm
 *    coalesces into exactly ONE apply of the final desired tool — a paint
 *    stroke finishes paint, an erase swipe finishes erase.
 */
export function handleTemporaryEraseGestureBoundary(boundary: TemporaryEraseBoundary, deps: TemporaryEraseDeps): void {
  if (boundary === 'down') {
    syncTemporaryErase(deps, { force: true });
    inFlight = true;
    return;
  }
  inFlight = false;
  syncTemporaryErase(deps);
}

/**
 * Mount the window/document listener lifecycle. Takes its targets and a
 * deps getter (the Studio passes a render-body ref read, so the once-installed
 * listeners always see the latest settings/engine/lock — never the first
 * render's closures). Returns a teardown that removes every listener and
 * disarms. Never touches globals at import time.
 */
export function mountPhysicsPaintTemporaryErase(
  targets: TemporaryEraseMountTargets,
  getDeps: () => TemporaryEraseDeps,
): () => void {
  const onKeyDown = (event: Event) => handleTemporaryEraseKeyDown(event as KeyboardEvent, getDeps());
  const onKeyUp = (event: Event) => handleTemporaryEraseKeyUp(event as KeyboardEvent, getDeps());
  const onBlur = () => handleTemporaryEraseBlur(getDeps());
  const onVisibilityChange = () => handleTemporaryEraseVisibilityChange(getDeps(), targets.document.visibilityState ?? 'visible');
  // Capture: true so the force-sync precedes the engine's canvas pointerdown.
  const onPointerDownCapture = (event: Event) => { void event; handleTemporaryEraseGestureBoundary('down', getDeps()); };
  // No capture on the release boundaries — they must run AFTER the engine
  // finalizes the in-flight gesture with the tool it started with.
  const onPointerUp = () => handleTemporaryEraseGestureBoundary('up', getDeps());
  const onPointerCancel = () => handleTemporaryEraseGestureBoundary('cancel', getDeps());

  const pointerDownOptions = { capture: true } as const;
  targets.window.addEventListener('keydown', onKeyDown);
  targets.window.addEventListener('keyup', onKeyUp);
  targets.window.addEventListener('blur', onBlur);
  targets.window.addEventListener('pointerdown', onPointerDownCapture, pointerDownOptions);
  targets.window.addEventListener('pointerup', onPointerUp);
  targets.window.addEventListener('pointercancel', onPointerCancel);
  targets.document.addEventListener('visibilitychange', onVisibilityChange);

  return () => {
    targets.window.removeEventListener('keydown', onKeyDown);
    targets.window.removeEventListener('keyup', onKeyUp);
    targets.window.removeEventListener('blur', onBlur);
    targets.window.removeEventListener('pointerdown', onPointerDownCapture, pointerDownOptions);
    targets.window.removeEventListener('pointerup', onPointerUp);
    targets.window.removeEventListener('pointercancel', onPointerCancel);
    targets.document.removeEventListener('visibilitychange', onVisibilityChange);
    // Unmount never leaves the window armed (Studio reopen always starts as brush).
    temporaryErase.value = false;
    inFlight = false;
  };
}

/** Test-only full reset — signal, deferral flag and last-applied identity. */
export function resetTemporaryEraseForTests(): void {
  temporaryErase.value = false;
  inFlight = false;
  lastApplied = null;
}
