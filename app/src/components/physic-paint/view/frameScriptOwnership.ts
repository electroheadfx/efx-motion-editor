/**
 * quick-261025-awl (D-01/D-02): pure frame script ownership resolver.
 *
 * Reads the session aquarelle script store and reports the frame's single
 * owner. No signal reads, no writes: callers persist the result through
 * frameModuleLock's compare-then-write setter.
 *
 * 261027-klx — single-engine world. @efxlab/efx-watercolor is the only paint
 * engine and the Brush session ledger is gone, so ownership collapses to
 * Water color or none. Ownership is bound to the physical KEY, never to the
 * display: a Water color script only owns a REAL key cell, because the
 * aquarelle events are keyed by the live cell identity.
 */
import type { FrameScriptOwner } from '../../shared/frameModuleLock';
import { hasAquarelleScriptForFrame } from './aquarelleRecordState';

export type { FrameScriptOwner };

/**
 * The key context a resolver call must name. Callers build it from the O(1)
 * physical projection: only a REAL cell carries a physical key id.
 * `keyId` is null for derived/generated/empty cells and for unknown launches.
 */
export interface FrameScriptCell {
  readonly kind: string;
  readonly keyId: string | null;
}

export function resolveFrameScriptOwner(
  frame: number,
  cell: FrameScriptCell | null | undefined,
): FrameScriptOwner {
  const realCell =
    cell !== null
    && cell !== undefined
    && cell.kind === 'real'
    && cell.keyId !== null
    && cell.keyId.length > 0;
  const hasWatercolor = realCell && hasAquarelleScriptForFrame(frame);
  return hasWatercolor ? 'watercolor' : null;
}
