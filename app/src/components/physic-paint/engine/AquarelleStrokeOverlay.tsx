// ============================================================
//  AquarelleStrokeOverlay — the Water color adapter of the ONE
//  shared script-edition surface (quick 261023-g4p Task 2;
//  multi-select 261024-mz5).
//
//  The gesture implementation moved to ScriptStrokeOverlay; this
//  file only binds the watercolor selection port, the select /
//  held-Cmd mode, the batch callbacks and the watercolor test
//  ids. No gesture logic lives here — the shared file is the only
//  implementation.
// ============================================================

import type { JSX } from 'preact';
import { temporaryMove } from '../view/physicsPaintTemporaryErase';
import {
  aquarelleScriptStrokeEditionPort,
  aquarelleSelectMode,
} from '../view/aquarelleStrokeSelection';
import { ScriptStrokeOverlay } from './ScriptStrokeOverlay';
import type { ScriptStrokeEditionPort } from '../view/scriptStrokeEdition';

export function AquarelleStrokeOverlay(props: {
  width: number;
  height: number;
  getPlayFrame: () => number;
  onDeleteStrokes: (mutationIds: readonly number[]) => void;
  onMoveStrokes: (mutationIds: readonly number[], dxPx: number, dyPx: number) => void;
}): JSX.Element | null {
  const port: ScriptStrokeEditionPort = {
    ...aquarelleScriptStrokeEditionPort,
    isActive: () => aquarelleSelectMode.peek(),
    deleteStrokes: props.onDeleteStrokes,
    moveStrokes: props.onMoveStrokes,
    // 261024-mz5 Task 2: the shared overlay never passes the transform
    // callback here (Task 3 wires the watercolor transform), so this op is
    // unreachable.
    transformStrokes: () => {},
    // The watercolor overlay gestures never call the keyboard port op.
    stepStroke: () => {},
  };
  return (
    <ScriptStrokeOverlay
      width={props.width}
      height={props.height}
      getPlayFrame={props.getPlayFrame}
      port={port}
      selectMode={aquarelleSelectMode.value}
      moveArmed={temporaryMove.value}
      onDeleteStrokes={props.onDeleteStrokes}
      onMoveStrokes={props.onMoveStrokes}
      testId="aquarelle-stroke-overlay"
      badgeTestId="aquarelle-stroke-badge"
      ghostTestId="aquarelle-drag-ghost"
    />
  );
}
