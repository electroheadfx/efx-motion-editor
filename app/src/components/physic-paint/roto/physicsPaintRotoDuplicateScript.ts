import { effect, type ReadonlySignal } from '@preact/signals';
import type { AquarellePayloadEvent } from '@efxlab/efx-watercolor/payload';
import type { RotoPaintScript } from './physicsPaintRotoScriptClipboard';

/**
 * Quick 261023-cxc: the script-aware Duplicate path.
 *
 * Quick 261023-bxm settled the SOURCE key's displayed pixels into the record
 * and let the physical duplicate clone the raster. The clone renders correctly
 * but carries no engine strokes (brush) and no recorded aquarelle timeline
 * (watercolor), so Move / Select / stack-step find nothing to edit.
 *
 * This module is the pure decision + bounded wait + orchestration half of the
 * fix:
 *   - only a real source key whose NEXT cell is EMPTY and inside capacity is
 *     eligible (so the promoted destination is always the blank key the
 *     existing promotion seam creates — never a raster clone, no double paint);
 *   - the destination wait is a bounded signal subscription (never a sleep or
 *     an ad-hoc timer loop), so user navigation aborts instead of painting a
 *     stale key;
 *   - pre-navigation failures return `fallback` so the caller can run the
 *     unchanged 261023-bxm settle-then-clone in the same click; post-navigation
 *     failures return `aborted` with an explicit message and never clone.
 *
 * The module owns no store, DOM, or IPC state and publishes no UI state.
 */

export type RotoDuplicateScriptModule = 'brush' | 'watercolor';

/**
 * The physical kind of `source.appFrame + 1`. `out-of-capacity` is the
 * absent-cell answer: the projection has no cell there (or the caller has no
 * projection at all), so the script path can never target an unbounded frame.
 */
export type RotoDuplicateScriptDestinationKind = 'empty' | 'real' | 'generated' | 'out-of-capacity';

export type RotoDuplicateScriptFallbackReason =
  | 'source-changed'
  | 'destination-occupied'
  | 'destination-out-of-capacity'
  | 'no-script'
  | 'capture-failed'
  | 'navigation-failed';

export type RotoDuplicateScriptDecision =
  | { readonly kind: 'script'; readonly destinationFrame: number; readonly module: RotoDuplicateScriptModule }
  | { readonly kind: 'fallback'; readonly reason: RotoDuplicateScriptFallbackReason };

export type RotoDuplicateScriptOutcome =
  | { readonly outcome: 'handled' }
  | { readonly outcome: 'fallback'; readonly reason: RotoDuplicateScriptFallbackReason }
  | { readonly outcome: 'aborted'; readonly message: string };

/**
 * Direct, user-facing abort sentences. Each names Duplicate and the failed
 * step; none carries stroke contents, ids, or file paths.
 */
export const ROTO_DUPLICATE_SCRIPT_NAVIGATION_ABORTED = 'Duplicate could not reach the next frame — the navigation was interrupted.';
export const ROTO_DUPLICATE_SCRIPT_SUPERSEDED = 'Duplicate was interrupted — the frame changed before the new key could be painted.';
export const ROTO_DUPLICATE_SCRIPT_TIMEOUT = 'Duplicate timed out waiting for the next frame to become the script source.';
export const ROTO_DUPLICATE_SCRIPT_APPLY_FAILED = 'Duplicate could not paint the script onto the new key.';
export const ROTO_DUPLICATE_SCRIPT_RECORD_FAILED = 'Duplicate could not record the watercolor script onto the new key.';

/** The destination wait budget (261023-bxm routing contract: 2000 ms). */
export const ROTO_DUPLICATE_SCRIPT_WAIT_TIMEOUT_MS = 2000;

export type RotoDuplicateSourceFrameWaitOutcome = 'ready' | 'timeout' | 'superseded';

export interface RotoDuplicateScriptDecisionInput {
  /** The live script-controller source, or null when no real key is mounted. */
  readonly source: { readonly keyId: string; readonly appFrame: number } | null;
  readonly expectedKeyId: string;
  readonly expectedAppFrame: number;
  readonly destinationKind: RotoDuplicateScriptDestinationKind;
  readonly capacity: number;
  readonly module: RotoDuplicateScriptModule;
  readonly brushStrokeCount: number;
  readonly aquarelleStrokeEventCount: number;
}

/**
 * The one decision table. Order is the law:
 *   1. the source must still be the requested real key on the requested frame;
 *   2. `source + 1` must be inside capacity;
 *   3. only an EMPTY destination is eligible — a real or generated cell keeps
 *      the 261023-bxm duplicate (which owns the +1 ripple);
 *   4. the source must carry a script (live brush strokes, or recorded
 *      aquarelle stroke events for the source frame).
 * Only an `empty` cell reaches the script path, so the promoted destination is
 * the blank key `promoteRotoPaintTargetRef` builds for an empty cell.
 */
export function resolveRotoDuplicateScriptDecision(
  input: RotoDuplicateScriptDecisionInput,
): RotoDuplicateScriptDecision {
  const source = input.source;
  if (!source || source.keyId !== input.expectedKeyId || source.appFrame !== input.expectedAppFrame) {
    return { kind: 'fallback', reason: 'source-changed' };
  }
  const destinationFrame = source.appFrame + 1;
  if (input.destinationKind === 'out-of-capacity' || destinationFrame >= input.capacity) {
    return { kind: 'fallback', reason: 'destination-out-of-capacity' };
  }
  if (input.destinationKind === 'real' || input.destinationKind === 'generated') {
    return { kind: 'fallback', reason: 'destination-occupied' };
  }
  const hasScript = input.module === 'brush'
    ? input.brushStrokeCount > 0
    : input.aquarelleStrokeEventCount > 0;
  if (!hasScript) return { kind: 'fallback', reason: 'no-script' };
  return { kind: 'script', destinationFrame, module: input.module };
}

/**
 * Wait until the script controller's source reports the destination frame.
 *
 * `effect` is the subscription (no polling loop, no rAF chain, no sleep): the
 * first evaluation covers the already-arrived case, then one `setTimeout`
 * bounds the wait. A third frame means the user navigated elsewhere — the
 * sequence must abort, never paint. Every exit disposes the effect and clears
 * the timer.
 */
export function waitForRotoDuplicateSourceFrame(
  source: ReadonlySignal<{ appFrame: number }>,
  input: { originFrame: number; targetFrame: number; timeoutMs?: number },
): Promise<RotoDuplicateSourceFrameWaitOutcome> {
  const timeoutMs = input.timeoutMs ?? ROTO_DUPLICATE_SCRIPT_WAIT_TIMEOUT_MS;
  return new Promise<RotoDuplicateSourceFrameWaitOutcome>((resolve) => {
    let settled = false;
    let stop: (() => void) | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const finish = (outcome: RotoDuplicateSourceFrameWaitOutcome): void => {
      if (settled) return;
      settled = true;
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      const dispose = stop;
      stop = null;
      dispose?.();
      resolve(outcome);
    };

    const evaluate = (appFrame: number): void => {
      if (appFrame === input.targetFrame) finish('ready');
      else if (appFrame !== input.originFrame) finish('superseded');
    };

    evaluate(source.peek().appFrame);
    if (settled) return;

    timer = setTimeout(() => finish('timeout'), timeoutMs);
    const dispose = effect(() => {
      evaluate(source.value.appFrame);
    });
    if (settled) dispose();
    else stop = dispose;
  });
}

/**
 * Ports the Studio fills. The orchestrator never touches the store, the
 * engine, the clipboard, or IPC directly — every side effect crosses a port.
 */
export interface RotoDuplicateWithScriptPorts {
  getSource: () => { keyId: string; appFrame: number } | null;
  getDestination: (destinationFrame: number) => RotoDuplicateScriptDestinationKind;
  getCapacity: () => number;
  getModule: () => RotoDuplicateScriptModule;
  getBrushStrokeCount: () => number;
  getAquarelleStrokeEventCount: (appFrame: number) => number;
  captureBrushScript: () => RotoPaintScript | null;
  getAquarelleEvents: (appFrame: number) => readonly AquarellePayloadEvent[];
  navigateTo: (frame: number) => Promise<boolean>;
  waitForSourceFrame: (frame: number) => Promise<RotoDuplicateSourceFrameWaitOutcome>;
  applyBrushScript: (script: RotoPaintScript) => Promise<boolean>;
  applyAquarelleEvents: (events: readonly AquarellePayloadEvent[]) => Promise<boolean>;
  recordAquarelleScriptCopy: (sourceFrame: number, destinationFrame: number) => Promise<boolean>;
}

export interface RotoDuplicateWithScriptInput {
  readonly sourceKeyId: string;
  readonly sourceAppFrame: number;
}

/**
 * Orchestrate one Duplicate click through the script path.
 *
 * Order (locked): re-check the source → decide → capture → navigate → wait →
 * apply (brush) or apply + record the timeline copy (watercolor). A thrown
 * port rejects to the caller — the caller owns the error surface.
 */
export async function runRotoDuplicateWithScript(
  input: RotoDuplicateWithScriptInput,
  ports: RotoDuplicateWithScriptPorts,
): Promise<RotoDuplicateScriptOutcome> {
  const module = ports.getModule();
  const decision = resolveRotoDuplicateScriptDecision({
    source: ports.getSource(),
    expectedKeyId: input.sourceKeyId,
    expectedAppFrame: input.sourceAppFrame,
    destinationKind: ports.getDestination(input.sourceAppFrame + 1),
    capacity: ports.getCapacity(),
    module,
    brushStrokeCount: module === 'brush' ? ports.getBrushStrokeCount() : 0,
    aquarelleStrokeEventCount: module === 'watercolor' ? ports.getAquarelleStrokeEventCount(input.sourceAppFrame) : 0,
  });
  if (decision.kind === 'fallback') return { outcome: 'fallback', reason: decision.reason };

  const navigateAndWait = async (destinationFrame: number): Promise<RotoDuplicateScriptOutcome | null> => {
    const navigated = await ports.navigateTo(destinationFrame);
    if (!navigated) {
      // Pre-navigation failure: nothing was created, so the caller may safely
      // run the 261023-bxm settle-then-clone in the same click — unless the
      // playhead already left the source, in which case a clone would land on
      // the wrong frame and the sequence aborts loudly instead.
      const current = ports.getSource();
      if (current && current.keyId === input.sourceKeyId && current.appFrame === input.sourceAppFrame) {
        return { outcome: 'fallback', reason: 'navigation-failed' };
      }
      return { outcome: 'aborted', message: ROTO_DUPLICATE_SCRIPT_NAVIGATION_ABORTED };
    }
    const waited = await ports.waitForSourceFrame(destinationFrame);
    if (waited === 'superseded') return { outcome: 'aborted', message: ROTO_DUPLICATE_SCRIPT_SUPERSEDED };
    if (waited === 'timeout') return { outcome: 'aborted', message: ROTO_DUPLICATE_SCRIPT_TIMEOUT };
    return null;
  };

  if (module === 'brush') {
    const script = ports.captureBrushScript();
    if (!script) return { outcome: 'fallback', reason: 'capture-failed' };
    const interrupted = await navigateAndWait(decision.destinationFrame);
    if (interrupted) return interrupted;
    const applied = await ports.applyBrushScript(script);
    return applied ? { outcome: 'handled' } : { outcome: 'aborted', message: ROTO_DUPLICATE_SCRIPT_APPLY_FAILED };
  }

  const events = ports.getAquarelleEvents(input.sourceAppFrame);
  if (events.length === 0) return { outcome: 'fallback', reason: 'no-script' };
  const interrupted = await navigateAndWait(decision.destinationFrame);
  if (interrupted) return interrupted;
  const applied = await ports.applyAquarelleEvents(events);
  if (!applied) return { outcome: 'aborted', message: ROTO_DUPLICATE_SCRIPT_APPLY_FAILED };
  // The bake creates the pixels; the record copy is what keeps the duplicate
  // re-editable (Move / Delete / stack-step). Never record after a failed apply.
  const recorded = await ports.recordAquarelleScriptCopy(input.sourceAppFrame, decision.destinationFrame);
  if (!recorded) return { outcome: 'aborted', message: ROTO_DUPLICATE_SCRIPT_RECORD_FAILED };
  return { outcome: 'handled' };
}
