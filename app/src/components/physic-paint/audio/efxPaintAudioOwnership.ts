import { signal } from '@preact/signals';
import { PHYSIC_PAINT_AUDIO_PLAYBACK_STATE_EVENT } from '../../../lib/physicPaintBridge';

/**
 * EFX Paint child-window audio ownership guard (41-04, D-05..D-07, AUDIO-06).
 *
 * First-player-wins arbitration between the main editor and this child
 * window: whichever window starts audio first owns monitoring; a Play in the
 * other window is a no-op for audio while visual playback proceeds, so
 * doubled audio is structurally impossible. Ownership signaling is transient
 * session state on separate lightweight events — never forced through the
 * revision counter (RESEARCH Pattern 5, locked A5).
 *
 * Authority boundary (AUDIO-01): this module imports NOTHING from audioStore,
 * timelineStore, or playbackEngine. The only inbound signal is the main
 * window's playback-state event; the only outbound signals are claim/release
 * events (via the injected sender) and the D-06 status note (via the injected
 * publisher — useRotoCachedPlayback's publishStatus funnel).
 *
 * Session-only (soloStore discipline): module-scope state lives for the
 * window bundle lifetime; nothing is persisted.
 */

/** D-06 suppressed note — the single source of the exact string. */
export const EFX_PAINT_AUDIO_SUPPRESSED_NOTE = 'Audio playing in main editor';

/** Last received main-editor playback state (D-05 guard input). */
const otherWindowPlaying = signal(false);

/** This window currently holds the audio claim (first-player-wins). */
let claimHeld = false;

/**
 * A Play was suppressed by the guard. Set only by a blocked monitor start and
 * cleared by the visual-stop funnel (noteVisualStop) or a main-stop
 * resolution — so `suppressed` implies the child is still visually playing.
 */
let suppressed = false;

type StatusPublisher = (note: string | null) => void;
let statusPublisher: StatusPublisher | null = null;
let claimSender: ((claim: boolean) => void) | null = null;
let resumeHandler: (() => void) | null = null;

export const efxPaintAudioOwnership = {
  otherWindowPlaying,

  /**
   * Inject the session wiring (child-window runtime/tests). Only keys present
   * in the options object are replaced; null clears a slot.
   */
  configure(options: {
    statusPublisher?: StatusPublisher | null;
    claimSender?: ((claim: boolean) => void) | null;
    resumeHandler?: (() => void) | null;
  }): void {
    if ('statusPublisher' in options) statusPublisher = options.statusPublisher ?? null;
    if ('claimSender' in options) claimSender = options.claimSender ?? null;
    if ('resumeHandler' in options) resumeHandler = options.resumeHandler ?? null;
  },

  /**
   * D-05 gate checked at the monitor's play funnel: a start is allowed unless
   * the main editor is playing AND this window does not hold the claim. A
   * claim-holding window keeps monitoring when the main editor starts later —
   * the loser (the late main start) suppresses on its own side.
   */
  canStartAudio(): boolean {
    return claimHeld || !otherWindowPlaying.peek();
  },

  isClaimHeld(): boolean {
    return claimHeld;
  },

  isSuppressed(): boolean {
    return suppressed;
  },

  /**
   * Record a guard-blocked start and publish the D-06 note through the
   * injected status funnel. Idempotent: a repeated suppressed Play does not
   * duplicate the note.
   */
  noteSuppressed(): void {
    if (suppressed) return;
    suppressed = true;
    statusPublisher?.(EFX_PAINT_AUDIO_SUPPRESSED_NOTE);
  },

  /**
   * Visual playback stopped (the monitor's single stop funnel). Drops the
   * suppression state WITHOUT touching the status capsule — the playback stop
   * funnel owns the status line (38.1-D-02 flush discipline).
   */
  noteVisualStop(): void {
    suppressed = false;
  },

  /** Claim audio ownership on a successful start. Idempotent. */
  claimAudio(): void {
    if (claimHeld) return;
    claimHeld = true;
    claimSender?.(true);
  },

  /** Release the claim on stop/close. A release for a non-held claim is a no-op. */
  releaseAudio(): void {
    if (!claimHeld) return;
    claimHeld = false;
    claimSender?.(false);
  },

  /**
   * Main-editor playback-state event (D-05..D-07). On a playing → stopped
   * transition while this window is suppressed (still visually playing), the
   * suppression resolves: the stale note clears and auto-resume is attempted
   * through the monitor funnel. The funnel itself enforces the D-07 toggle
   * condition — with the session toggle Off the resume dispatches nothing.
   */
  noteMainPlaybackState(playing: boolean): void {
    const wasPlaying = otherWindowPlaying.peek();
    otherWindowPlaying.value = playing;
    if (playing || !wasPlaying || !suppressed) return;
    suppressed = false;
    statusPublisher?.(null);
    resumeHandler?.();
  },
};

/**
 * Child-side listener for the main editor's playback-state broadcasts — one
 * listener for PHYSIC_PAINT_AUDIO_PLAYBACK_STATE_EVENT, same triple-transport
 * + origin-check + disposed-guard idiom as useEfxPaintAudioContextBridge.
 * Also releases the audio claim on window close (D-05 lifecycle, best-effort
 * pagehide). Invalid payloads are ignored silently (transient hints, T-41-10).
 */
export function installEfxPaintAudioPlaybackStateListener(): () => void {
  if (typeof window === 'undefined') return () => {};
  let disposed = false;
  let unlisten: (() => void) | undefined;
  const accept = (value: unknown) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return;
    const playing = (value as { playing?: unknown }).playing;
    if (typeof playing === 'boolean') efxPaintAudioOwnership.noteMainPlaybackState(playing);
  };
  const custom = (event: Event) => accept((event as CustomEvent).detail);
  const message = (event: MessageEvent) => {
    if (event.origin !== window.location.origin || event.data?.type !== PHYSIC_PAINT_AUDIO_PLAYBACK_STATE_EVENT) return;
    accept(event.data.payload);
  };
  const pagehide = () => efxPaintAudioOwnership.releaseAudio();
  window.addEventListener(PHYSIC_PAINT_AUDIO_PLAYBACK_STATE_EVENT, custom);
  window.addEventListener('message', message);
  window.addEventListener('pagehide', pagehide);
  void import('@tauri-apps/api/event').then(async (eventApi) => {
    unlisten = await eventApi.listen?.(PHYSIC_PAINT_AUDIO_PLAYBACK_STATE_EVENT, (event) => accept(event.payload));
    if (disposed) unlisten?.();
  }).catch(() => undefined);
  return () => {
    disposed = true;
    unlisten?.();
    window.removeEventListener(PHYSIC_PAINT_AUDIO_PLAYBACK_STATE_EVENT, custom);
    window.removeEventListener('message', message);
    window.removeEventListener('pagehide', pagehide);
  };
}
