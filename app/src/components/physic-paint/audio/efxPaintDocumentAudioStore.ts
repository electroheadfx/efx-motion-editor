import { signal } from '@preact/signals';
import type { PhysicPaintDocumentAudioSection } from '../../../types/physicPaint';
import { isPhysicPaintDocumentAudioSection } from '../../../types/physicPaint';

/**
 * 52.5-01a (Q1, T-52.5-08): session-only child-side documentAudio store
 * (soloStore-shaped, same discipline as efxPaintAudioPreviewStore) — holds the
 * currently applied CLOSED documentAudio section {revision, clipId, assetUrl}
 * for this child window, plus the launch identity (layer + project fps) a
 * clip-only session needs to resolve and dispatch the clip.
 *
 * Nothing is persisted; each window load starts empty and hydrates from the
 * launch context / push events. The single write funnel `accept` mirrors
 * handleEfxPaintAudioContextEvent's strict newer-than revision guard —
 * fail-closed closed-key validation, equal/older dropped with ZERO signal
 * churn (idempotent compare-then-write, efx-preact-reactivity rule 3).
 */

/** Fallback project fps for clip-only sessions (launch precedent: context.fps ?? 12). */
const DEFAULT_CLIP_FPS = 12;

const section = signal<PhysicPaintDocumentAudioSection | null>(null);

/**
 * Persistent strict newer-than watermark (T-52.5-08): survives null-clears so
 * a stale replay can NEVER resurrect a removed clip. Monotonic for the child
 * window lifetime, matching main-side nextDocumentAudioRevision ordering
 * across launch embed + post-register pushes.
 */
let appliedRevision = -1;

/** The parent layer whose registered document owns the clip (sound lookup). */
let layerId: string | null = null;

/** Project fps seed — authoritative when no main audioPreview section carries one. */
let launchFps = DEFAULT_CLIP_FPS;

export const efxPaintDocumentAudioStore = {
  /** The section signal (observability / reactivity — read via getSection() in event paths). */
  section,

  getSection(): PhysicPaintDocumentAudioSection | null {
    return section.peek();
  },

  getLayerId(): string | null {
    return layerId;
  },

  /** Project fps for clip dispatch when the main audioPreview section is absent. */
  getFps(): number {
    return launchFps;
  },

  /** Launch identity: the layer that owns the document sound + the project fps. */
  setLaunchIdentity(nextLayerId: string, nextFps?: number | null): void {
    layerId = nextLayerId;
    if (typeof nextFps === 'number' && Number.isFinite(nextFps) && nextFps > 0) {
      launchFps = nextFps;
    }
  },

  /**
   * Single write funnel for pushed/hydrated documentAudio payloads:
   * - `null` clears the section idempotently (revision watermark untouched)
   * - closed-key validation via isPhysicPaintDocumentAudioSection (unknown
   *   member -> dropped, never stored)
   * - strict newer-than: equal/older revision dropped silently, zero churn;
   *   a newer revision replaces the stored section
   */
  accept(incoming: unknown): boolean {
    if (incoming === null) {
      if (section.peek() === null) return false;
      section.value = null;
      return true;
    }
    if (!isPhysicPaintDocumentAudioSection(incoming)) return false;
    if (incoming.revision <= appliedRevision) return false;
    appliedRevision = incoming.revision;
    section.value = {
      revision: incoming.revision,
      clipId: incoming.clipId,
      assetUrl: incoming.assetUrl,
    };
    return true;
  },

  /** Window teardown / test isolation: empty the session state (idempotent). */
  reset(): void {
    section.value = null;
    appliedRevision = -1;
    layerId = null;
    launchFps = DEFAULT_CLIP_FPS;
  },
};
