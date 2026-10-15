// ============================================================
//  Height → valley/peak encode (56-05 / PAPER-01 / R2.4).
//
//  The paper-pack twin of app/src/lib/paperPass.ts encodePassTiles:
//  same signed-height model s = (h - 0.5) * 2 * strength, valley
//  floors at the paper's own tint (never black), peak lifts toward
//  the tint, alpha 255 everywhere. Pure — no DOM. Exported so the
//  library can hand paperPass-ready maps (PaperPassTile shape).
//
//  RED stub: intentionally wrong shapes so papers.test.ts fails on
//  assertions, not imports.
// ============================================================

export interface EncodedPassMaps {
  readonly valley: Uint8ClampedArray;
  readonly peak: Uint8ClampedArray;
}

export function encodePassTiles(
  _height: Float32Array,
  _width: number,
  _heightPx: number,
  _strength: number,
  _tint: { r: number; g: number; b: number },
): EncodedPassMaps {
  return { valley: new Uint8ClampedArray(0), peak: new Uint8ClampedArray(0) };
}
