export const COLLAPSE_THRESHOLD = 32;
export const MIN_RESTORED = 80;

interface PanelSizes {
  seqHeight: number;
  layHeight: number;
  totalAvailable: number;
}

type ResizerId = 'seq-lay' | 'lay-prop';

interface ResizeResult {
  seqHeight: number;
  layHeight: number;
}

/**
 * Calculate new panel heights after a resize drag.
 * - 'seq-lay' resizer: adjusts sequences (above) and layers (below)
 * - 'lay-prop' resizer: adjusts layers height; properties takes remaining (flex-1)
 * If a panel goes below COLLAPSE_THRESHOLD, it collapses to 0.
 * If a panel is restored from 0, it gets at least MIN_RESTORED.
 */
export function calcResize(current: PanelSizes, deltaY: number, resizer: ResizerId): ResizeResult {
  let { seqHeight, layHeight } = current;

  if (resizer === 'seq-lay') {
    let newSeq = seqHeight + deltaY;
    let newLay = layHeight - deltaY;

    // Restore from zero (must run before collapse check)
    if (seqHeight === 0 && newSeq > 0 && newSeq < MIN_RESTORED) newSeq = MIN_RESTORED;
    if (layHeight === 0 && newLay > 0 && newLay < MIN_RESTORED) newLay = MIN_RESTORED;

    // Collapse-to-zero (only when NOT restoring from zero)
    if (seqHeight !== 0 && newSeq > 0 && newSeq < COLLAPSE_THRESHOLD) newSeq = 0;
    if (layHeight !== 0 && newLay > 0 && newLay < COLLAPSE_THRESHOLD) newLay = 0;

    // Clamp: neither can go negative
    newSeq = Math.max(0, newSeq);
    newLay = Math.max(0, newLay);

    // Don't exceed total
    const max = current.totalAvailable;
    if (newSeq + newLay > max) {
      if (deltaY > 0) newLay = max - newSeq;
      else newSeq = max - newLay;
    }

    return { seqHeight: newSeq, layHeight: newLay };
  }

  // lay-prop resizer: only adjusts layers height
  let newLay = layHeight + deltaY;
  if (layHeight === 0 && newLay > 0 && newLay < MIN_RESTORED) newLay = MIN_RESTORED;
  if (layHeight !== 0 && newLay > 0 && newLay < COLLAPSE_THRESHOLD) newLay = 0;
  newLay = Math.max(0, newLay);

  return { seqHeight, layHeight: newLay };
}
