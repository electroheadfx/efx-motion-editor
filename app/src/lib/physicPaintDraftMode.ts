/**
 * 261101-o2m (D-05, T-261101-o2m-01): the cross-realm Draft gate.
 *
 * While the Studio's Draft mode is ON its script is committed but its watercolor
 * pixels are deliberately frozen, so ANY persistence channel that writes in that
 * window would persist a new script against the pre-Draft pixel sidecar. The
 * Studio's own five exits are closed inside the Studio (a settle-then-act law);
 * the channels that live in the MAIN realm — the autosave debounce, the 60s
 * autosave interval, manual save and export — need a gate they can read, and
 * this leaf module is it.
 *
 * Transport mirrors `physicPaintFlush.ts`: a Tauri event from the Studio to
 * `main`, a silent browser no-op, and one cleanup handle. It lives in its own
 * leaf module so `autoSave` and `projectStore` can import it without a cycle
 * (both sit below `physicPaintBridge`, which imports `projectStore`).
 *
 * Fault containment (T-261101-o2m-06): a Studio webview that dies with its
 * window alive can never recompute again and emits no `window-closed` event.
 * A gate stuck ON would block persistence for the rest of the session, so the
 * Studio re-publishes `true` every `PHYSIC_PAINT_DRAFT_HEARTBEAT_MS` while it is
 * active and the main realm clears an active gate after
 * `PHYSIC_PAINT_DRAFT_STALE_MS` of silence. The 20s ceiling sits far above a
 * settle (~1.5s) and the 5s flush budget, so a healthy Studio never trips it.
 */

export const PHYSIC_PAINT_DRAFT_MODE_EVENT = 'physic-paint:draft-mode';
/** The Studio re-publishes an active gate at this cadence (T-06 heartbeat). */
export const PHYSIC_PAINT_DRAFT_HEARTBEAT_MS = 5000;
/** Silence longer than this clears the gate — a dead Studio cannot wedge it. */
export const PHYSIC_PAINT_DRAFT_STALE_MS = 20000;

/**
 * The Studio window's `Destroyed` event. NOT duplicated here for style: the
 * Rust side emits this exact literal (`app/src-tauri/src/lib.rs`), and
 * `physicPaintBridge.ts` listens to it to release the Preview gate.
 */
const PHYSIC_PAINT_WINDOW_CLOSED_EVENT = 'physic-paint:window-closed';

// The Studio emits TO `main` (mirrors `physicPaintFlush.ts`), so the Studio
// window label ('efx-physic-paint' in physicPaintBridge) is not needed here.

export interface PhysicPaintDraftModePayload {
  active: boolean;
}

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined'
    && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window || 'isTauri' in window);
}

/**
 * Accept only the canonical payload. Anything else (a malformed emit, a stale
 * event from another realm) is ignored rather than interpreted — an unvalidated
 * payload must never block or wrongly release persistence (trust boundary).
 */
export function readDraftModePayload(payload: unknown): boolean | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const active = (payload as { active?: unknown }).active;
  return typeof active === 'boolean' ? active : null;
}

let draftModeActive = false;
let releaseHandler: (() => void) | null = null;
let staleTimer: ReturnType<typeof setTimeout> | null = null;

function clearStaleTimer(): void {
  if (staleTimer === null) return;
  clearTimeout(staleTimer);
  staleTimer = null;
}

function armStaleTimer(): void {
  clearStaleTimer();
  staleTimer = setTimeout(() => {
    staleTimer = null;
    // Route through the transition law so the release handler fires exactly
    // like an explicit Studio publish would.
    setStudioDraftModeActive(false);
  }, PHYSIC_PAINT_DRAFT_STALE_MS);
}

export function isStudioDraftModeActive(): boolean {
  return draftModeActive;
}

/**
 * The deferred-work hook: autosave registers `scheduleSave` here so the save
 * that was skipped mid-Draft resumes on the release instead of waiting for the
 * next unrelated edit.
 */
export function setStudioDraftModeReleaseHandler(handler: (() => void) | null): void {
  releaseHandler = handler;
}

/**
 * The transition law: an unchanged value is inert; `true` arms the staleness
 * belt; `true -> false` clears it and fires the release handler exactly once.
 */
export function setStudioDraftModeActive(active: boolean): void {
  if (active === draftModeActive) return;
  draftModeActive = active;
  if (active) {
    armStaleTimer();
    return;
  }
  clearStaleTimer();
  releaseHandler?.();
}

/**
 * The Studio window is gone (destroyed, not merely idle): go inactive, drop the
 * timer and release the deferred work. A repeated clear is inert.
 */
export function clearStudioDraftMode(): void {
  clearStaleTimer();
  setStudioDraftModeActive(false);
}

/**
 * Studio realm: publish the Draft-or-dirty state. Silently a no-op in the
 * browser fallback (no second realm, therefore no gate to feed).
 */
export async function publishStudioDraftMode(active: boolean): Promise<void> {
  if (!isTauriRuntime()) return;
  const eventApi = await import('@tauri-apps/api/event');
  await eventApi.emitTo('main', PHYSIC_PAINT_DRAFT_MODE_EVENT, { active } satisfies PhysicPaintDraftModePayload);
}

/**
 * Main realm: mirror the Studio's gate and clear it on Studio destruction.
 * Returns one cleanup that unlistens both channels and drops the timer; outside
 * Tauri it returns a no-op cleanup. The listeners never throw — a malformed
 * payload is ignored and a failing transport must not break autosave.
 */
export async function installPhysicPaintDraftModeListener(): Promise<() => void> {
  if (!isTauriRuntime()) return () => {};
  const eventApi = await import('@tauri-apps/api/event');
  const unlistenDraft = await eventApi.listen(PHYSIC_PAINT_DRAFT_MODE_EVENT, (event) => {
    try {
      const active = readDraftModePayload(event.payload);
      if (active === null) return;
      // Every payload re-arms the belt — a heartbeat included (#T-06).
      if (active) armStaleTimer();
      setStudioDraftModeActive(active);
    } catch {
      // A listener must never throw into Tauri's event dispatch.
    }
  });
  const unlistenClosed = await eventApi.listen(PHYSIC_PAINT_WINDOW_CLOSED_EVENT, () => {
    try {
      clearStudioDraftMode();
    } catch {
      // Same containment as above.
    }
  });
  return () => {
    unlistenDraft?.();
    unlistenClosed?.();
    clearStaleTimer();
  };
}
