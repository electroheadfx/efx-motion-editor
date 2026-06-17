export type MissingRotoFrameBackgroundState =
  | { mode: 'transparent' }
  | { mode: 'color'; color: string };

export type MissingRotoFrameDrawInstruction =
  | { kind: 'transparent' }
  | { kind: 'background-only'; color: string };

export function resolveMissingRotoFrameDraw(
  _layerId: string,
  _frame: number,
  backgroundState: MissingRotoFrameBackgroundState,
): MissingRotoFrameDrawInstruction {
  if (backgroundState.mode === 'transparent') return { kind: 'transparent' };
  return { kind: 'background-only', color: backgroundState.color };
}
