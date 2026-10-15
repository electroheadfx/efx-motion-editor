// ============================================================
//  Height → valley/peak encode (56-05 / PAPER-01 / R2.4).
//
//  The paper-pack twin of app/src/lib/paperPass.ts encodePassTiles:
//  same signed-height model s = (h - 0.5) * 2 * strength, valley
//  floors at the paper's own tint (never black — the locked hole-color
//  semantics), peak lifts toward the tint, alpha 255 everywhere
//  (straight-alpha D-02). Pure — no DOM. Exported so the library can
//  hand paperPass-ready maps (PaperPassTile shape).
// ============================================================

export interface EncodedPassMaps {
  readonly valley: Uint8ClampedArray;
  readonly peak: Uint8ClampedArray;
}

/** WR-01 mirror: strength > 1 walks the valley PAST the tint toward black. */
function clampStrength(strength: number): number {
  if (!Number.isFinite(strength)) return 0;
  return strength < 0 ? 0 : strength > 1 ? 1 : strength;
}

/**
 * Encode the signed height field into the valley (multiply) and peak
 * (lighten) maps. Per pixel: s = (h - 0.5) * 2 * strength;
 * v = max(0, -s); u = max(0, s);
 * valley = round(255 - v * (255 - tint)) — the floor is the paper's own tone;
 * peak = round(u * tint) — the lift rides the paper's own tone;
 * alpha 255 everywhere.
 */
export function encodePassTiles(
  height: Float32Array,
  width: number,
  heightPx: number,
  strength: number,
  tint: { r: number; g: number; b: number },
): EncodedPassMaps {
  const k = clampStrength(strength);
  const count = width * heightPx;
  const valley = new Uint8ClampedArray(count * 4);
  const peak = new Uint8ClampedArray(count * 4);
  for (let i = 0; i < count; i++) {
    const s = (height[i] - 0.5) * 2 * k;
    const v = s < 0 ? -s : 0;
    const u = s > 0 ? s : 0;
    const offset = i * 4;
    valley[offset] = Math.round(255 - v * (255 - tint.r));
    valley[offset + 1] = Math.round(255 - v * (255 - tint.g));
    valley[offset + 2] = Math.round(255 - v * (255 - tint.b));
    valley[offset + 3] = 255;
    peak[offset] = Math.round(u * tint.r);
    peak[offset + 1] = Math.round(u * tint.g);
    peak[offset + 2] = Math.round(u * tint.b);
    peak[offset + 3] = 255;
  }
  return { valley, peak };
}
