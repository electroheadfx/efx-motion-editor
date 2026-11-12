// ============================================================
//  AquarelleStrokeOverlay — the Water color adapter of the ONE
//  shared script-edition surface (quick 261023-g4p Task 2;
//  multi-select 261024-mz5).
//
//  The gesture implementation moved to ScriptStrokeOverlay; this
//  file only binds the watercolor selection port, the select
//  mode, the batch callbacks and the watercolor test ids. No
//  gesture logic lives here — the shared file is the only
//  implementation.
// ============================================================

import type { JSX } from 'preact';
import { normaliseAquarelleAnchors } from '@efxlab/efx-watercolor/payload';
import {
  aquarelleScriptStrokeEditionPort,
  aquarelleSelectMode,
} from '../view/aquarelleStrokeSelection';
import { getRecordedAquarelleStroke } from '../view/aquarelleRecordState';
import { isVectorAquarelleStroke } from '../view/aquarelleVectorPathCommit';
import { ScriptStrokeOverlay } from './ScriptStrokeOverlay';
import {
  setScriptStrokeSelection,
  type ScriptStrokeEditionPort,
  type ScriptStrokeTransform,
} from '../view/scriptStrokeEdition';
import { enterPathEdit } from '../view/vectorPathSession';

/**
 * 261112-i6d: the double-click entry — a VECTOR-ONLY gate in front of the ONE
 * session action the sheet's Edit path icon calls. It fails closed twice: an
 * unknown / hand-painted stroke, and anchors that fail the package
 * normalisation (a path an edit could never commit). The selection is
 * normalised down to the double-clicked stroke so `resolvePathEditGate` stays
 * enabled and `shouldExitPathEdit` cannot fire; Select mode is deliberately
 * untouched (path edit lives INSIDE it), and the paint tool is never read.
 */
export function requestAquarellePathEdit(mutationId: number): boolean {
  const stroke = getRecordedAquarelleStroke(mutationId);
  if (stroke === undefined || !isVectorAquarelleStroke(stroke)) return false;
  if (normaliseAquarelleAnchors(stroke.anchors) === undefined) return false;
  setScriptStrokeSelection([mutationId]);
  enterPathEdit(String(mutationId));
  return true;
}

export function AquarelleStrokeOverlay(props: {
  width: number;
  height: number;
  getPlayFrame: () => number;
  onDeleteStrokes: (mutationIds: readonly number[]) => void;
  onMoveStrokes: (mutationIds: readonly number[], dxPx: number, dyPx: number) => void;
  // 261024-mz5: supplied by the Studio — the handles render only when this
  // callback exists, so an adapter that cannot commit never shows them.
  onTransformStrokes: (mutationIds: readonly number[], transform: ScriptStrokeTransform) => void;
}): JSX.Element | null {
  const port: ScriptStrokeEditionPort = {
    ...aquarelleScriptStrokeEditionPort,
    isActive: () => aquarelleSelectMode.peek(),
    deleteStrokes: props.onDeleteStrokes,
    moveStrokes: props.onMoveStrokes,
    transformStrokes: props.onTransformStrokes,
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
      moveArmed={false}
      onDeleteStrokes={props.onDeleteStrokes}
      onMoveStrokes={props.onMoveStrokes}
      onTransformStrokes={props.onTransformStrokes}
      onStrokeDoubleClick={requestAquarellePathEdit}
      testId="aquarelle-stroke-overlay"
      badgeTestId="aquarelle-stroke-badge"
      ghostTestId="aquarelle-drag-ghost"
    />
  );
}
