export interface KeyframeNavResult {
  prevFrame: number | null;
  nextFrame: number | null;
  isOnKf: boolean;
  canPrev: boolean;
  canNext: boolean;
}

/**
 * Pure function: given an array of keyframes (with .frame property) and the current
 * sequence-local frame, returns navigation info.
 */
export function getKeyframeNav(
  keyframes: ReadonlyArray<{ frame: number }>,
  currentFrame: number,
): KeyframeNavResult {
  if (keyframes.length === 0) {
    return { prevFrame: null, nextFrame: null, isOnKf: false, canPrev: false, canNext: false };
  }

  const sorted = [...keyframes].sort((a, b) => a.frame - b.frame);
  const isOnKf = sorted.some(k => k.frame === currentFrame);
  const prevFrame = sorted.filter(k => k.frame < currentFrame).pop()?.frame ?? null;
  const nextFrame = sorted.find(k => k.frame > currentFrame)?.frame ?? null;

  return {
    prevFrame,
    nextFrame,
    isOnKf,
    canPrev: prevFrame !== null,
    canNext: nextFrame !== null,
  };
}
