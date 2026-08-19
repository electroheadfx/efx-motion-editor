/**
 * regression-refresh-multi-paint: the completion-paint guard.
 *
 * The acceptance reconcile paint is the FINAL preview-base paint of a
 * multi-stroke completion (Play Script / Group Regenerate / Undo / Redo). Its
 * cache-miss decode is asynchronous; any preview-base invalidation landing
 * inside the decode window makes the engine drop the decode, and without a
 * repair no later paint is issued — the canvas keeps the pre-apply image until
 * an unrelated repaint. The window scales with the committed PNG size, which is
 * why small (2-stroke) completions never miss.
 *
 * The guard arms right after the completion paint is issued. When the guarded
 * request settles 'dropped' (or a different frame applies over the guarded
 * frame while the cursor holds), it re-runs the current-frame load — a
 * synchronous cache-hit apply thanks to the engine's cache-on-drop — and
 * disarms. It stands down when the paint has landed or the cursor moved
 * (navigation owns the canvas from there).
 */

export interface RotoCompletionPaintGuardEngine {
  getAppliedPreviewBaseDataUrl?: () => string | null;
  onPreviewBaseSettled?: (listener: (dataUrl: string, outcome: 'applied' | 'dropped') => void) => () => void;
}

export interface RotoCompletionPaintGuardInput {
  engine: RotoCompletionPaintGuardEngine | null;
  appFrame: number;
  intendedDataUrl: string | null;
  getCurrentAppFrame: () => number;
  reload: (appFrame: number) => void;
  log?: (message: string) => void;
  maxAttempts?: number;
}

const DEFAULT_MAX_ATTEMPTS = 2;

export function armRotoCompletionPaintGuard(input: RotoCompletionPaintGuardInput): void {
  const { engine, appFrame, intendedDataUrl } = input;
  if (!engine || !intendedDataUrl) return;
  const getApplied = engine.getAppliedPreviewBaseDataUrl;
  const onSettled = engine.onPreviewBaseSettled;
  if (!getApplied || !onSettled) return;
  const maxAttempts = input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;

  // Synchronous cache-hit apply already landed — nothing to guard.
  if (getApplied.call(engine) === intendedDataUrl) return;

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
    // A cursor move supersedes the completion intent: navigation owns the canvas.
    if (input.getCurrentAppFrame() !== appFrame) { disarm(); return; }
    if (getApplied.call(engine) === intendedDataUrl) { disarm(); return; }
    if (attempts >= maxAttempts) {
      input.log?.(`Completion paint for frame ${appFrame} did not converge after ${maxAttempts} repairs.`);
      disarm();
      return;
    }
    attempts += 1;
    input.log?.(`Completion paint for frame ${appFrame} was dropped — repairing (attempt ${attempts}/${maxAttempts}).`);
    input.reload(appFrame);
    // The repair lands synchronously on a cache hit; disarm immediately.
    if (getApplied.call(engine) === intendedDataUrl) disarm();
  };
  unsubscribe = onSettled.call(engine, (dataUrl, outcome) => {
    // Re-verify on the guarded request's settle (either outcome) and whenever
    // a DIFFERENT frame applied over the guarded frame; unrelated drops (a
    // superseded duplicate of the same intent has the same dataUrl) are noise.
    if (outcome === 'dropped' && dataUrl !== intendedDataUrl) return;
    verify();
  });
}
