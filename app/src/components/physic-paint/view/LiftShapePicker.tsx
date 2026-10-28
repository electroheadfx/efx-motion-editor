// ============================================================
//  LiftShapePicker — the ONE Lift (eraser) shape control
//  (261028-k03c D1/D3). Mounted by BOTH the top-bar Lift cluster
//  and the sidebar Brush tab's Lift section; every instance
//  reads and writes the ONE aquarelleLiftTipId signal through
//  setAquarelleLiftTipId, which never flips the active tool and
//  never mutates the Brush selection.
//
//  Native <select> over the 15 BRUSH_PRESETS (the
//  RightPanelTrackTab precedent) plus the painted stroke thumb of
//  the current shape. The component styles its own compact row
//  inline, so no stylesheet is touched; the thumb reuses the
//  existing sized top-bar trigger thumb class.
// ============================================================

import { BRUSH_PRESETS } from '@efxlab/efx-watercolor';
import {
  aquarelleLiftTipId,
  setAquarelleLiftTipId,
} from './aquarelleRecordState';
import { WatercolorBrushThumb } from './WatercolorBrushLibrary';

export function LiftShapePicker(props: { testId: string; disabled?: boolean }) {
  // Narrow signal read (efx-preact-reactivity rule 5).
  const liftTipId = aquarelleLiftTipId.value;
  return (
    <div
      data-testid={props.testId}
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: '6px',
      }}
    >
      <WatercolorBrushThumb
        presetId={liftTipId ?? 'filbert'}
        class="physics-paint-brush-trigger-thumb"
        testId={`${props.testId}-thumb`}
      />
      <select
        data-testid={`${props.testId}-select`}
        aria-label="Lift shape"
        value={liftTipId ?? ''}
        disabled={props.disabled}
        onChange={(event) => setAquarelleLiftTipId(event.currentTarget.value)}
        style={{ maxWidth: '120px', height: '24px' }}
      >
        {BRUSH_PRESETS.map((preset) => (
          <option key={preset.id} value={preset.id}>{preset.name}</option>
        ))}
      </select>
    </div>
  );
}
