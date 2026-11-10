// ============================================================
//  RED SCRATCH STUB — 61-15 Task 1.
//
//  Shape-only module so the leaf tests LOAD and fail on their
//  assertions instead of on an unresolvable import (#3770). The
//  GREEN implementation replaces every body below.
// ============================================================

export const VECTOR_PATH_SCRIPT_OFF_MESSAGE =
  'Vector path rejected — Script is off, so the path would not be recorded. Turn Script on and draw it again.';

export interface AquarelleScriptRebakeSequence {
  readonly isInFlight: () => boolean;
  readonly beginInFlight: () => void;
  readonly endInFlight: () => void;
  readonly resetSheet: () => void;
  readonly applyTimeline: () => Promise<boolean>;
  readonly onSuccess?: () => void;
  readonly onFailure?: () => void;
}

export function isVectorAquarelleStroke(_stroke: { anchors?: readonly unknown[] }): boolean {
  return false;
}

export function resolveVectorCommitRoute(_latches: { draft: boolean; wireframe: boolean }): 'defer-pixels' | 'rebake' {
  return 'rebake';
}

export async function runAquarelleScriptRebake(sequence: AquarelleScriptRebakeSequence): Promise<boolean> {
  sequence.resetSheet();
  return false;
}
