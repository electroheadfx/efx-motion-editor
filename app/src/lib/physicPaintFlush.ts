/**
 * 52.1 (flush-before-save/export): a synchronous main→Studio round-trip that
 * drains the Studio's queued post-gesture work (physics settle + Roto capture
 * encode/apply + documentSync push) before the main window serializes the
 * project. Without it, a stroke followed by an immediate Save/Export inside the
 * idle window would persist a stale document/sidecar set.
 *
 * Kept in its own leaf module (not physicPaintBridge.ts) so projectStore can
 * import it without a module-body cycle: physicPaintBridge imports projectStore,
 * so the flush request must not live in the same module as the bridge.
 */

export const PHYSIC_PAINT_FLUSH_REQUEST_EVENT = 'physic-paint:flush-request';
export const PHYSIC_PAINT_FLUSH_RESULT_EVENT = 'physic-paint:flush-result';

/** The Studio window label (mirrors PHYSIC_PAINT_WINDOW_LABEL in physicPaintBridge). */
const PHYSIC_PAINT_WINDOW_LABEL = 'efx-physic-paint';

export interface PhysicPaintFlushResult {
  operationId: string;
  status: 'flushed' | 'unavailable';
}

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined'
    && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window || 'isTauri' in window);
}

/**
 * Main window: request the Studio to flush its queued work, awaiting the result.
 * Resolves true when the Studio flushed, false when it is unavailable or the
 * round-trip times out. The Studio emits the documentSync push BEFORE the flush
 * result, so by the time this resolves the main window's document mirror is
 * current (Tauri delivers events in order).
 */
export async function requestPhysicPaintFlush(): Promise<boolean> {
  const operationId = `physic-paint-flush-${Date.now()}-${crypto.randomUUID()}`;
  if (!isTauriRuntime()) return false;
  const eventApi = await import('@tauri-apps/api/event');
  return new Promise<boolean>((resolve) => {
    let settled = false;
    let unlisten: (() => void) | undefined;
    const timeout = setTimeout(() => finish(false), 5000);
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      unlisten?.();
      resolve(value);
    };
    void eventApi.listen(PHYSIC_PAINT_FLUSH_RESULT_EVENT, (event) => {
      const payload = event.payload as PhysicPaintFlushResult;
      if (payload?.operationId !== operationId) return;
      finish(payload.status === 'flushed');
    }).then((unsub) => {
      unlisten = unsub;
      void eventApi.emitTo(PHYSIC_PAINT_WINDOW_LABEL, PHYSIC_PAINT_FLUSH_REQUEST_EVENT, { operationId });
    });
  });
}

/**
 * Studio: install the flush-request listener. `flush` drains the engine settle,
 * the Roto capture queue, and the documentSync push; the result is emitted only
 * after the flush completes (or fails closed as 'unavailable').
 */
export async function installPhysicPaintFlushRequestListener(
  flush: () => Promise<void>,
): Promise<() => void> {
  if (isTauriRuntime()) {
    const eventApi = await import('@tauri-apps/api/event');
    const unlisten = await eventApi.listen(PHYSIC_PAINT_FLUSH_REQUEST_EVENT, async (event) => {
      const request = event.payload as { operationId?: unknown };
      const operationId = typeof request?.operationId === 'string' ? request.operationId : 'invalid-operation';
      try {
        await flush();
        await eventApi.emitTo('main', PHYSIC_PAINT_FLUSH_RESULT_EVENT, { operationId, status: 'flushed' } satisfies PhysicPaintFlushResult);
      } catch {
        await eventApi.emitTo('main', PHYSIC_PAINT_FLUSH_RESULT_EVENT, { operationId, status: 'unavailable' } satisfies PhysicPaintFlushResult);
      }
    });
    if (unlisten) return unlisten;
  }
  return () => {};
}
