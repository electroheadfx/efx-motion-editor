// ============================================================
//  aquarelleBake — createBakeHost consumer (56-08, D-21).
//
//  RED SCAFFOLD (intentionally unimplemented): bake() returns
//  zero frames and never submits turns so the pins fail on
//  assertions, not imports. GREEN replaces this body with the
//  real createBakeHost consumer (mode 'flush-survives-navigation').
// ============================================================

import type { EngineAdapter } from '@efxlab/efx-paint-host'
import type { AquarelleStrokePayload } from '../payload/toStudioStroke'
import type { AquarellePayloadEvent } from '../payload/dryEvent'

/** One committed WebP frame from a bake turn. */
export interface AquarelleBakeFrame {
  /** Index of the source event in the baked script timeline. */
  readonly eventIndex: number
  /** Index among stroke turns only (Dry events do not increment). */
  readonly strokeIndex: number
  /** Cuisson tick at capture (0 = post-deposit, before any stepTick). */
  readonly tick: number
  /** WebP bytes — the cache publication unit (AQUA-08: alpha 0 unpainted). */
  readonly bytes: Uint8Array
  readonly width: number
  readonly height: number
}

export type AquarelleBakeEncoder = (
  frame: CanvasImageSource,
  width: number,
  height: number,
) => Promise<Uint8Array> | Uint8Array

export interface AquarelleBakeOptions {
  /** WebP encoder. Defaults to canvas.toDataURL when available. */
  encodeWebp?: AquarelleBakeEncoder
  concurrency?: number
  width?: number
  height?: number
  /** Called only for committed turns — a cancelled turn never reaches this. */
  onCommit?: (frame: AquarelleBakeFrame) => void
}

export type AquarelleBakeResult =
  | { readonly ok: true; readonly frames: readonly AquarelleBakeFrame[] }
  | { readonly ok: false; readonly reason: 'cancelled' | 'failed' }

export interface AquarelleBake {
  bake(events: readonly AquarellePayloadEvent[]): Promise<AquarelleBakeResult>
  /** Resolves after in-flight turns settle; overlapping calls share one drain. */
  flush(): Promise<void>
  /** Forced-flush escape (nav/close/save/export); returns a once-only release. */
  beginFlush(): () => void
  /** Does NOT abort flush-survives-navigation turns (D-21 / AQUA-07). */
  dispose(): void
  /** Cancels every live turn — a cancelled turn never commits. */
  interrupt(): void
  readonly inFlight: number
}

export function createAquarelleBake(
  _adapter: EngineAdapter<AquarelleStrokePayload>,
  _options: AquarelleBakeOptions = {},
): AquarelleBake {
  // RED: never publishes. GREEN wires createBakeHost with
  // mode 'flush-survives-navigation' and one turn per stroke.
  return {
    async bake(_events: readonly AquarellePayloadEvent[]): Promise<AquarelleBakeResult> {
      return { ok: true, frames: [] }
    },
    async flush(): Promise<void> {
      /* RED no-op */
    },
    beginFlush(): () => void {
      return () => undefined
    },
    dispose(): void {
      /* RED no-op */
    },
    interrupt(): void {
      /* RED no-op */
    },
    get inFlight(): number {
      return 0
    },
  }
}
