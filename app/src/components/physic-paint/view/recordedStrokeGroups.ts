// ============================================================
//  recordedStrokeGroups — the ONE engine-strokes projection
//  (quick 261023-g4p; moved verbatim out of
//  physicsPaintRotoScriptClipboard.ts so the brush script store
//  reuses the same implementation).
//
//  `normalizeLogicalBrushes` drops zero-point strokes unless they
//  are POSITIVE-diffusion continuations of the previous group,
//  clones every point/params, and returns a new array. Callers
//  receive fresh objects they may freeze at capture time.
// ============================================================

import type { PaintStroke } from '@efxlab/efx-physic-paint';

export interface RecordedStrokeGroup {
  primary: Readonly<PaintStroke>;
  continuations?: readonly Readonly<PaintStroke>[];
}

function cloneRecordedStroke(stroke: Readonly<PaintStroke>): PaintStroke {
  return {
    ...stroke,
    points: stroke.points.map((point) => ({ ...point })),
    params: { ...stroke.params },
  };
}

export function normalizeLogicalBrushes(
  strokes: readonly PaintStroke[],
): Readonly<RecordedStrokeGroup>[] {
  const groups: RecordedStrokeGroup[] = [];
  for (const stroke of strokes) {
    if (stroke.points.length > 0) {
      groups.push({ primary: cloneRecordedStroke(stroke), continuations: [] });
      continue;
    }
    // A continuation must carry a POSITIVE diffusion count. A zero here is the
    // engine's `|| 0` round-trip (loadProjectData / serializeProject) stamping
    // the member onto every restored stroke — routing it into `continuations`
    // makes the group unpersistable (serialize drops the zero, the schema then
    // requires a positive count on every continuation).
    if (typeof stroke.diffusionFrames === 'number' && stroke.diffusionFrames > 0 && groups.length > 0) {
      const current = groups[groups.length - 1];
      current.continuations = [...(current.continuations ?? []), cloneRecordedStroke(stroke)];
    }
  }
  return groups.map((group) => ({
    primary: cloneRecordedStroke(group.primary),
    continuations: group.continuations?.map(cloneRecordedStroke),
  }));
}

/**
 * Deep-freeze a normalized group list: every point, points array, params,
 * primary, continuation, continuation array, group, and the groups array.
 * Returns a NEW groups array so a caller's later `push` cannot mutate the
 * retained list. The stroke objects themselves are frozen in place (the same
 * law as deepFreezeScript).
 */
export function freezeRecordedStrokeGroups(
  groups: readonly Readonly<RecordedStrokeGroup>[],
): readonly Readonly<RecordedStrokeGroup>[] {
  const frozen = groups.map((group) => {
    for (const point of group.primary.points) Object.freeze(point);
    Object.freeze(group.primary.points);
    Object.freeze(group.primary.params);
    Object.freeze(group.primary);
    const continuations = group.continuations;
    if (continuations) {
      for (const continuation of continuations) {
        for (const point of continuation.points) Object.freeze(point);
        Object.freeze(continuation.points);
        Object.freeze(continuation.params);
        Object.freeze(continuation);
      }
      Object.freeze(continuations);
    }
    const entry: RecordedStrokeGroup = continuations
      ? { primary: group.primary, continuations }
      : { primary: group.primary };
    return Object.freeze(entry);
  });
  return Object.freeze(frozen);
}
