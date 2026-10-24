// ============================================================
//  BrushScriptOverlay — the Brush adapter of the ONE shared
//  script-edition surface (quick 261023-g4p Task 3).
//
//  The gesture implementation lives in ScriptStrokeOverlay; this
//  file only binds the engine-backed brush port and the brush test
//  ids. Mounted only while the Brush Move tool is armed, so the
//  held-Cmd temporary move keeps its existing engine behavior
//  (moveArmed stays false here).
// ============================================================

import type { JSX } from 'preact';
import { brushScriptEditionPort } from '../view/brushScriptEditionPort';
import { ScriptStrokeOverlay } from './ScriptStrokeOverlay';

export function BrushScriptOverlay(props: {
  width: number;
  height: number;
  getPlayFrame: () => number;
  active: boolean;
}): JSX.Element | null {
  return (
    <ScriptStrokeOverlay
      width={props.width}
      height={props.height}
      getPlayFrame={props.getPlayFrame}
      port={brushScriptEditionPort}
      selectMode={props.active}
      moveArmed={false}
      onDeleteStrokes={(mutationIds) => brushScriptEditionPort.deleteStrokes(mutationIds)}
      onMoveStrokes={(mutationIds, dxPx, dyPx) =>
        brushScriptEditionPort.moveStrokes(mutationIds, dxPx, dyPx)}
      onTransformStrokes={(mutationIds, transform) =>
        brushScriptEditionPort.transformStrokes(mutationIds, transform)}
      testId="brush-script-overlay"
      badgeTestId="brush-stroke-badge"
      ghostTestId="brush-drag-ghost"
    />
  );
}
