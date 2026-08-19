/**
 * regression-refresh-multi-paint: the completion-paint guard (generation-aware).
 *
 * The acceptance reconcile is the FINAL preview-base paint of a multi-stroke
 * completion (Play Script / Group Regenerate / Undo / Redo). Its cache-miss
 * decode is asynchronous; any preview-base invalidation landing inside the
 * decode window makes the engine drop the decode, and without a repair no later
 * paint is issued — the canvas keeps the pre-apply image until an unrelated
 * repaint. The window scales with the committed PNG size, which is why small
 * (2-stroke) completions never miss.
 *
 * The FIRST fix (cache-on-drop + a dataUrl-only guard) INVERTED the race: the
 * repair path re-applied a synchronous cache-hit that could hold STALE (older
 * generation) content, painting it over the correct completion paint. The
 * corrected invariant is MONOTONIC GENERATION ORDERING — every paint request
 * carries a monotonically increasing generation; a settle with an OLDER
 * generation than the last settled paint is a canvas NO-OP (engine-enforced).
 *
 * This guard only repairs when the NEWEST generation's paint failed to land:
 * it arms with the reconcile paint's generation, stands down the moment any
 * generation >= its intent is applied (a newer paint supersedes it), and its
 * repair re-applies ONLY the intended dataUrl with the INTENDED generation — a
 * re-issue the engine's generation gate turns into a no-op if a newer
 * generation has since painted.
 */

export interface RotoCompletionPaintGuardEngine {
  getAppliedPreviewBaseDataUrl?: () => string | null;
  getAppliedPreviewBaseGeneration?: () => number | null;
  onPreviewBaseSettled?: (listener: (dataUrl: string, outcome: 'applied' | 'dropped', generation?: number) => void) => () => void;
}

export interface RotoCompletionPaintGuardInput {
  engine: RotoCompletionPaintGuardEngine | null;
  appFrame: number;
  intendedDataUrl: string | null;
  intendedGeneration?: number;
  getCurrentAppFrame: () => number;
  reload: (appFrame: number, dataUrl: string, generation: number) => void;
  log?: (message: string) => void;
  maxAttempts?: number;
}

const DEFAULT_MAX_ATTEMPTS = 2;

export function armRotoCompletionPaintGuard(input: RotoCompletionPaintGuardInput): void {
  const { engine, appFrame, intendedDataUrl, intendedGeneration } = input;
  if (!engine || !intendedDataUrl) return;
  const getApplied = engine.getAppliedPreviewBaseDataUrl;
  const getAppliedGeneration = engine.getAppliedPreviewBaseGeneration;
  const onSettled = engine.onPreviewBaseSettled;
  if (!getApplied || !onSettled) return;
  const maxAttempts = input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;

  // A synchronous cache-hit apply already landed — nothing to guard.
  if (getApplied.call(engine) === intendedDataUrl) return;

  // The intent is satisfied (or superseded) when the applied paint is either
  // the intended dataUrl OR a NEWER generation than the intended one — a newer
  // generation's paint means the stale write window is closed.
  const newestLanded = () => {
    if (getAppliedGeneration) {
      const appliedGeneration = getAppliedGeneration.call(engine);
      if (appliedGeneration !== null && intendedGeneration !== undefined && appliedGeneration >= intendedGeneration) return true;
    }
    return getApplied.call(engine) === intendedDataUrl;
  };

  let attempts = 0;
  let armed = true;
  let unsubscribe: () => void = () => {};
  const disarm = () => {
    if (!armed) return;
    armed = false;
    unsubscribe();
  };
  const verify = () => {
    if (!armed) return;
    // A cursor move supersedes the repair intent: navigation owns the canvas.
    if (input.getCurrentAppFrame() !== appFrame) { disarm(); return; }
    if (newestLanded()) { disarm(); return; }
    if (attempts >= maxAttempts) {
      input.log?.(`Completion paint for frame ${appFrame} did not converge after ${maxAttempts} repairs.`);
      disarm();
      return;
    }
    attempts += 1;
    input.log?.(`Completion paint for frame ${appFrame} was dropped — repairing (attempt ${attempts}/${maxAttempts}).`);
    // Repair applies ONLY the intended (newest) image at the intended
    // generation. The engine's generation gate turns the re-issue into a
    // no-op if a newer generation painted between arm and repair.
    input.reload(appFrame, intendedDataUrl, intendedGeneration ?? 0);
    // The repair lands synchronously on a cache hit; disarm immediately.
    if (newestLanded()) disarm();
  };
  unsubscribe = onSettled.call(engine, (dataUrl, outcome) => {
    // A dropped settle of a DIFFERENT dataUrl is unrelated noise. Every other
    // settle (applied of any dataUrl, dropped of the intended dataUrl) can
    // change the newest-generation verdict and must re-verify.
    if (outcome === 'dropped' && dataUrl !== intendedDataUrl) return;
    verify();
  });
}
