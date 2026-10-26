/**
 * quick-261025-awl (D-01/D-02): pure frame script ownership resolver.
 *
 * Reads the two session script stores plus an optional live Brush ledger
 * sample and reports the frame's single owner. No signal reads, no writes:
 * callers persist the result through frameModuleLock's compare-then-write
 * setter.
 *
 * quick-261026-odd (empty-script gate): ownership is bound to the physical
 * KEY, never to the display. A Brush capture only owns a frame when it is
 * hydratable AND stamped with the CURRENT projection cell's key id. A legacy
 * `keyId:null` row, a row whose key was replaced at the same frame, a partial
 * or edit-cost row, and a missing entry all resolve NO owner — cached pixels
 * keep rendering, but nothing locks a module and nothing reports an editable
 * script. Identity is unprovable for those rows; the next live paint writes a
 * key-stamped capture.
 */
import type { FrameScriptOwner } from '../../shared/frameModuleLock';
import {
  getBrushScriptFrameEntry,
  purgedBrushScriptFrame,
} from './brushScriptRecordState';
import { hasAquarelleScriptForFrame } from './aquarelleRecordState';
import { isBrushScriptFrameHydratable } from './brushScriptHydration';

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

/** One live-ledger sample — the Studio reads it from the engine on refresh. */
export interface LiveBrushScriptSample {
  active: boolean;
  strokeCount: number;
}

export function resolveFrameScriptOwner(
  frame: number,
  cell: FrameScriptCell | null | undefined,
  liveBrush?: LiveBrushScriptSample | null,
): FrameScriptOwner {
  const cellKeyId = cell !== null && cell !== undefined && cell.kind === 'real'
    ? cell.keyId
    : null;
  const realCell = cellKeyId !== null && cellKeyId.length > 0;
  // Stored Brush script: the entry must be the CURRENT key's complete,
  // affordable script. Any other entry is content the engine cannot edit
  // here, so it must never publish an owner.
  const entry = realCell ? getBrushScriptFrameEntry(frame) : undefined;
  const storedBrush =
    entry !== undefined
    && entry.groups.length > 0
    && entry.keyId !== null
    && entry.keyId !== undefined
    && entry.keyId === cellKeyId
    && isBrushScriptFrameHydratable(entry);
  // The live ledger leg stays cell-independent on purpose: the FIRST stroke
  // of a visit makes the frame's owner before any capture exists (the frame
  // may still be mid self-promotion). Move itself stays cell-gated.
  const liveBrushLeg =
    liveBrush !== null &&
    liveBrush !== undefined &&
    liveBrush.active === true &&
    liveBrush.strokeCount > 0 &&
    !purgedBrushScriptFrame(frame);

  const hasBrush = storedBrush || liveBrushLeg;
  // A Water color script only owns a REAL key cell; the aquarelle events are
  // keyed by the live cell identity, same as the Select gate.
  const hasWatercolor = realCell && hasAquarelleScriptForFrame(frame);

  if (hasBrush && hasWatercolor) return 'both';
  if (hasBrush) return 'brush';
  if (hasWatercolor) return 'watercolor';
  return null;
}
