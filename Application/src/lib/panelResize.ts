// --- Legacy pixel-based API (kept for backward compatibility / tests) ---

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
 * Calculate new panel heights after a resize drag (legacy pixel API).
 * Kept for backward compatibility. New code should use calcFlexResize.
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

// --- New flex-based API ---

export const COLLAPSE_FLEX_THRESHOLD = 0.15;
export const MIN_RESTORED_FLEX = 0.3;

export interface FlexSizes {
  seqFlex: number;
  layFlex: number;
  propFlex: number;
  totalPixelHeight: number;
}

export interface FlexResizeResult {
  seqFlex: number;
  layFlex: number;
  propFlex: number;
}

/**
 * Calculate new panel flex values after a resize drag.
 * Converts pixel delta to flex-grow adjustments.
 *
 * - 'seq-lay' resizer: seqFlex += delta, layFlex -= delta
 * - 'lay-prop' resizer: layFlex += delta, propFlex -= delta
 *
 * Panels below COLLAPSE_FLEX_THRESHOLD snap to 0 (collapsed).
 * Panels restored from 0 get at least MIN_RESTORED_FLEX.
 */
export function calcFlexResize(
  current: FlexSizes,
  deltaY: number,
  resizer: ResizerId,
): FlexResizeResult {
  const totalFlex = current.seqFlex + current.layFlex + current.propFlex;
  if (totalFlex === 0 || current.totalPixelHeight === 0) {
    return { seqFlex: current.seqFlex, layFlex: current.layFlex, propFlex: current.propFlex };
  }

  const pxPerUnit = current.totalPixelHeight / totalFlex;
  const deltaFlex = deltaY / pxPerUnit;

  let { seqFlex, layFlex, propFlex } = current;

  if (resizer === 'seq-lay') {
    seqFlex += deltaFlex;
    layFlex -= deltaFlex;
  } else {
    layFlex += deltaFlex;
    propFlex -= deltaFlex;
  }

  // Restore from zero (must run before collapse check)
  if (current.seqFlex === 0 && seqFlex > 0 && seqFlex < MIN_RESTORED_FLEX) seqFlex = MIN_RESTORED_FLEX;
  if (current.layFlex === 0 && layFlex > 0 && layFlex < MIN_RESTORED_FLEX) layFlex = MIN_RESTORED_FLEX;
  if (current.propFlex === 0 && propFlex > 0 && propFlex < MIN_RESTORED_FLEX) propFlex = MIN_RESTORED_FLEX;

  // Collapse: snap to 0 below threshold (only when NOT restoring from zero)
  if (current.seqFlex !== 0 && seqFlex > 0 && seqFlex < COLLAPSE_FLEX_THRESHOLD) seqFlex = 0;
  if (current.layFlex !== 0 && layFlex > 0 && layFlex < COLLAPSE_FLEX_THRESHOLD) layFlex = 0;
  if (current.propFlex !== 0 && propFlex > 0 && propFlex < COLLAPSE_FLEX_THRESHOLD) propFlex = 0;

  // Clamp: no negative flex
  seqFlex = Math.max(0, seqFlex);
  layFlex = Math.max(0, layFlex);
  propFlex = Math.max(0, propFlex);

  return { seqFlex, layFlex, propFlex };
}

// --- 2-panel flex API (seq + prop, no lay) ---

export interface FlexSizes2 {
  seqFlex: number;
  propFlex: number;
  totalPixelHeight: number;
}

export interface FlexResizeResult2 {
  seqFlex: number;
  propFlex: number;
}

/**
 * Calculate new panel flex values after a resize drag (2-panel layout).
 * Converts pixel delta to flex-grow adjustments for seq/prop only.
 */
export function calcFlexResize2(
  current: FlexSizes2,
  deltaY: number,
): FlexResizeResult2 {
  const totalFlex = current.seqFlex + current.propFlex;
  if (totalFlex === 0 || current.totalPixelHeight === 0) {
    return { seqFlex: current.seqFlex, propFlex: current.propFlex };
  }

  const pxPerUnit = current.totalPixelHeight / totalFlex;
  const deltaFlex = deltaY / pxPerUnit;

  let { seqFlex, propFlex } = current;
  seqFlex += deltaFlex;
  propFlex -= deltaFlex;

  // Restore from zero (must run before collapse check)
  if (current.seqFlex === 0 && seqFlex > 0 && seqFlex < MIN_RESTORED_FLEX) seqFlex = MIN_RESTORED_FLEX;
  if (current.propFlex === 0 && propFlex > 0 && propFlex < MIN_RESTORED_FLEX) propFlex = MIN_RESTORED_FLEX;

  // Collapse: snap to 0 below threshold (only when NOT restoring from zero)
  if (current.seqFlex !== 0 && seqFlex > 0 && seqFlex < COLLAPSE_FLEX_THRESHOLD) seqFlex = 0;
  if (current.propFlex !== 0 && propFlex > 0 && propFlex < COLLAPSE_FLEX_THRESHOLD) propFlex = 0;

  // Clamp: no negative flex
  seqFlex = Math.max(0, seqFlex);
  propFlex = Math.max(0, propFlex);

  return { seqFlex, propFlex };
}
