import { signal } from '@preact/signals';
import type { ToolType } from '../types/paintCore';

/**
 * quick 261004-dn5 — Cmd/Meta = temporary Move in the Physics Paint Studio
 * window.
 *
 * quick 261027-klx — the Alt = temporary-erase arm is GONE. It existed to
 * apply the engine-1 Brush engine's 'erase' tool for the duration of a key
 * hold; with the Brush engine retired there is no erase tool to arm and no
 * watercolor path ever wrote the erase signal. Only the Move arm survives,
 * and it survives as a SESSION SIGNAL plus its render gate:
 * `AquarelleCanvasLayer` suppresses the watercolor sheet while the arm is up
 * so the select overlay owns the gesture.
 *
 * Session-only arm: while Meta is held (gated — Paint tool selected, Studio
 * shortcut target, engine mounted, not mutation-locked, no key repeat) the
 * NEXT gesture runs through the engine's EXISTING tool contract. The selected
 * tool itself never changes and nothing is persisted.
 *
 * Three invariants (see physicsPaintTemporaryMove.test.ts):
 *
 *  1. Preserved chords: the keydown/keyup/blur/visibility handlers never call
 *     preventDefault or stopPropagation, so every existing Cmd exclusion in
 *     physicsPaintStudioKeyboard.ts (Meta+C/X/V/A, Meta+Z) keeps working
 *     byte-for-byte — that file is never edited.
 *  2. Gesture ownership: the engine reads state.tool LIVE at every gesture
 *     stage, so arm/disarm applies are DEFERRED while a pointer gesture is in
 *     flight; one force-sync at window pointerdown (capture phase, before the
 *     engine's own handler) makes the tool provably correct at every gesture
 *     START — a lost Meta keyup, Cmd+Tab blur, or hidden window can never
 *     leave the Studio stuck in Move.
 *  3. Selected-tool authority: combineEffectiveTool is the ONE combination
 *     rule — moveArmed + selected 'paint' resolves to 'move', a disarmed
 *     selection passes through untouched, a selected 'erase' is never flipped,
 *     and the selected tool is never written by this module.
 *     resolveEffectiveTool (non-subscribing, for the engine sync) and
 *     readEffectiveTool (subscribing, for UI leaves) are its two readers.
 */

/**
 * quick 261004-dn5 — the Cmd/Meta arm: temporary Move. Engine paths read it
 * via .peek() (no subscription). UI leaves read it through readEffectiveTool
 * so a Meta press re-renders only that leaf — never Studio's render body
 * (skill rule 5: a .value read subscribes the whole component, and Studio is a
 * 4.7k-line tree).
 */
export const temporaryMove = signal(false);

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
  /**
   * 261022-pim: Cmd TAP (press + release with no other key in between) toggles
   * the persistent Move/Select mode. The held-Cmd arm above stays byte-for-
   * byte: a tap is a toggle, a hold-with-chord (Cmd+Z, Cmd+C, …) is not.
   */
  onMetaTap?: () => void;
  /**
   * 261022-pim: Move/Select exists only while there is a live script to act
   * on. False greys the rail button AND makes Cmd inert (no arm, no tap) —
   * a cooked/baked sheet with no script has nothing to select.
   */
  isMoveAvailable?: () => boolean;
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
 * The ONE combination rule, move-only since 261027-klx: the held move arm
 * resolves a selected 'paint' to 'move'; a disarmed selection and a selected
 * 'erase' pass through untouched. The second argument defaults to false so a
 * plain selected-tool read stays unchanged. Never mutates its input.
 */
export function combineEffectiveTool(selected: ToolType, moveArmed: boolean = false): ToolType {
  return moveArmed && selected === 'paint' ? 'move' : selected;
}

/** Non-subscribing read — for engine paths (handlers, sync) that must not own a render. */
export function resolveEffectiveTool(selected: ToolType): ToolType {
  return combineEffectiveTool(selected, temporaryMove.peek());
}

/**
 * Subscribing read — for UI leaves (rail button, tool slider row) that must
 * flip their display when the arm state changes. Keep every call site a narrow
 * leaf, never a large container.
 */
export function readEffectiveTool(selected: ToolType): ToolType {
  return combineEffectiveTool(selected, temporaryMove.value);
}

/** True while a pointer gesture is live — arm/disarm applies defer to the boundary. */
let inFlight = false;
/** The (engine, tool) pair this feature last applied — engine identity is part of the key. */
let lastApplied: { engine: TemporaryEraseEngine; tool: ToolType } | null = null;
/**
 * 261022-pim Cmd-tap detection. `metaTapEligible` = the keydown passed the
 * environment gates (shortcut target, engine, not locked) regardless of the
 * selected tool — the Studio callback decides what the tap means (watercolor
 * select, Brush Move). `metaChordUsed` = another key was pressed while Cmd
 * was down — a chord (Cmd+Z) must never toggle the persistent mode.
 */
let metaTapEligible = false;
let metaChordUsed = false;

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
 * in the whole module — the engine's pre-existing branches do all painting,
 * erasing and moving). Skips while a gesture is in flight (unless force) and
 * when the (engine, desired) pair already matches the last applied pair
 * (unless force).
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
 * Arm on a gated Cmd/Meta keydown (261004-dn5). Every gate mirrors the retired
 * erase arm exactly — only the key differs — so a Cmd press behaves like a
 * tool switch that never touches the tool state. Key repeat is ignored (a held
 * Cmd that re-fires keydown adds no extra apply), and arming syncs (deferring
 * to the boundary when a gesture is in flight).
 */
export function handleTemporaryMoveKeyDown(event: KeyboardEvent, deps: TemporaryEraseDeps): void {
  if (event.key !== 'Meta' || event.repeat) return;
  // A fresh Cmd press starts a fresh tap window: no chord yet, not eligible.
  metaTapEligible = false;
  metaChordUsed = false;
  if (!deps.isShortcutTarget(event.target)) return;
  if (deps.getEngine() === null) return;
  if (deps.isMutationLocked()) return;
  // No live script → Move is greyed and Cmd is inert (neither arm nor tap).
  if (deps.isMoveAvailable && !deps.isMoveAvailable()) return;
  // Eligible even when the selected tool is not Paint: tapping Cmd again while
  // Move is the selected tool must toggle back (261022-pim).
  metaTapEligible = true;
  if (deps.getSelectedTool() !== 'paint') return;
  temporaryMove.value = true;
  syncTemporaryErase(deps);
}

/**
 * Meta keyup disarms the move arm UNCONDITIONALLY — no gate may suppress a
 * release (a keyup inside an input, after a tool switch, or while locked still
 * clears), so a stuck arm can never survive a lost key combination. The event
 * is never consumed: every existing Cmd chord keeps working.
 *
 * 261022-pim Cmd TAP: if the armed press never saw another key (no chord), the
 * release toggles the persistent Move/Select mode through `onMetaTap`. A hold
 * with a chord (Cmd+Z, Cmd+C, …) stays exactly the old momentary arm.
 */
export function handleTemporaryMoveKeyUp(event: KeyboardEvent, deps: TemporaryEraseDeps): void {
  if (event.key !== 'Meta') return;
  temporaryMove.value = false;
  syncTemporaryErase(deps);
  if (metaTapEligible && !metaChordUsed) deps.onMetaTap?.();
  metaTapEligible = false;
  metaChordUsed = false;
}

/** Window blur disarms the arm unconditionally (Cmd+Tab to the main window, closed popover…). */
export function handleTemporaryEraseBlur(deps: TemporaryEraseDeps): void {
  temporaryMove.value = false;
  metaTapEligible = false;
  metaChordUsed = false;
  syncTemporaryErase(deps);
}

/** visibilitychange-to-hidden disarms the arm; to-visible does NOT (it never armed anything). */
export function handleTemporaryEraseVisibilityChange(deps: TemporaryEraseDeps, visibilityState: DocumentVisibilityState): void {
  if (visibilityState !== 'hidden') return;
  temporaryMove.value = false;
  metaTapEligible = false;
  metaChordUsed = false;
  syncTemporaryErase(deps);
}

/**
 * Gesture boundary — the deferral machinery:
 *  - 'down' force-syncs FIRST (window capture runs before the engine's own
 *    canvas pointerdown handler) then marks inFlight;
 *  - 'up'/'cancel' clear inFlight then sync, so the deferred arm/disarm
 *    coalesces into exactly ONE apply of the final desired tool — a paint
 *    stroke finishes paint, a move swipe finishes move.
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
  const onKeyDown = (event: Event) => {
    const keyboardEvent = event as KeyboardEvent;
    // Any other key while Cmd is down makes this a chord, never a tap.
    if (keyboardEvent.key !== 'Meta' && keyboardEvent.metaKey) metaChordUsed = true;
    handleTemporaryMoveKeyDown(keyboardEvent, getDeps());
  };
  const onKeyUp = (event: Event) => {
    const keyboardEvent = event as KeyboardEvent;
    handleTemporaryMoveKeyUp(keyboardEvent, getDeps());
  };
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
    temporaryMove.value = false;
    inFlight = false;
  };
}

/** Test-only full reset — the arm signal, the deferral flag and last-applied identity. */
export function resetTemporaryEraseForTests(): void {
  temporaryMove.value = false;
  inFlight = false;
  lastApplied = null;
  metaTapEligible = false;
  metaChordUsed = false;
}
