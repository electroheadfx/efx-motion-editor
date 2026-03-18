/**
 * Pure helper: get the top-most layer ID for a sequence.
 * Top-most = last in the layers array (highest in visual stack).
 */
export function getTopLayerId(seq: { layers: { id: string }[] } | null | undefined): string | null {
  if (!seq || seq.layers.length === 0) return null;
  return seq.layers[seq.layers.length - 1].id;
}
