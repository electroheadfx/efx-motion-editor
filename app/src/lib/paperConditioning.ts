// ============================================================
//  quick 261027-klx — app-owned paper height conditioning.
//
//  Ported VERBATIM from engine-1 before its deletion:
//    the retired Brush engine's core/paper.ts:79-92
//    and its util/math.ts:56-58 (clamp)
//
//  The golden fixture (`__fixtures__/paperConditioning.golden.json`)
//  was generated from the engine-1 implementation and
//  `paperConditioning.test.ts` compares BYTES, so NaN and -0 must
//  match exactly. Never import the package here — the point is
//  deletion.
// ============================================================

/**
 * Condition a raw paper height map: mean-centre to 0.5, then clamp contrast to
 * +/-0.40, so the output band is [0.10, 0.90] (260925-dso locked decision —
 * noticeable tooth in deposit adsorption without pixel jitter).
 * Idempotent on its own output.
 *
 * The engine-1 `clamp` is inlined (the plan allows either form) so the port
 * does not add a duplicate copy of the package helper to the Studio chunk.
 */
export function conditionHeightMap(raw: Float32Array): Float32Array {
  let sum = 0;
  for (let i = 0; i < raw.length; i++) sum += raw[i];
  const mean = raw.length > 0 ? sum / raw.length : 0.5;
  const out = new Float32Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    const centered = 0.5 + (raw[i] - mean);
    out[i] = centered < 0.1 ? 0.1 : centered > 0.9 ? 0.9 : centered;
  }
  return out;
}
