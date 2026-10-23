// ============================================================
//  AquarelleStrokeOverlay — the Water color adapter of the ONE
//  shared script-edition surface (quick 261023-g4p Task 2).
//
//  The gesture implementation moved to ScriptStrokeOverlay; this
//  file only binds the watercolor selection port, the select /
//  held-Cmd mode, and the watercolor test ids. No gesture logic
//  lives here — the shared file is the only implementation.
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
  onDeleteStroke: (mutationId: number) => void;
  onMoveStroke: (mutationId: number, dxPx: number, dyPx: number) => void;
}): JSX.Element | null {
  const port: ScriptStrokeEditionPort = {
    ...aquarelleScriptStrokeEditionPort,
    isActive: () => aquarelleSelectMode.peek(),
    deleteStroke: props.onDeleteStroke,
    moveStroke: props.onMoveStroke,
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
      onDeleteStroke={props.onDeleteStroke}
      onMoveStroke={props.onMoveStroke}
      testId="aquarelle-stroke-overlay"
      badgeTestId="aquarelle-stroke-badge"
      ghostTestId="aquarelle-drag-ghost"
    />
  );
}
