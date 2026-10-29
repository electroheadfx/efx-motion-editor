// ============================================================
//  AquarelleToolRow — the four-tool row (AQUA-02 / D-13).
//
//  Exactly brush | water | pen | lift. Dry is NOT a fifth tool
//  (D-15) — it is an action button in WatercolorModuleSection.
//  Selection lives in the click handler (never a deferred effect).
// ============================================================

import { Droplet, Eraser, Paintbrush, Pen } from 'lucide-preact';
import type { ComponentChildren } from 'preact';
import {
  aquarelleActiveTool,
  setAquarelleTool,
} from './aquarelleRecordState';
import { aquarelleSelectMode, setAquarelleSelectMode } from './aquarelleStrokeSelection';
import { aquarelleHasWetPaint } from './aquarelleWetPaintGate';
import type { AquarelleTool } from '@efxlab/efx-watercolor/payload';

const TOOLS: ReadonlyArray<{
  id: AquarelleTool;
  label: string;
  shortcut?: string;
  Icon: (props: { size?: number }) => ComponentChildren;
}> = Object.freeze([
  { id: 'brush', label: 'Brush', shortcut: 'B', Icon: Paintbrush },
  { id: 'water', label: 'Water', shortcut: 'W', Icon: Droplet },
  { id: 'pen', label: 'Pen', shortcut: 'P', Icon: Pen },
  { id: 'lift', label: 'Eraser', shortcut: 'E', Icon: Eraser },
]);

export function AquarelleToolRow() {
  const active = aquarelleActiveTool.value;
  // 261029-lel: Water only acts on live standing water — grey it while the
  // sheet is dry (same gate as the left rail and the W shortcut).
  const wetAvailable = aquarelleHasWetPaint.value;
  // Select/Move owns the active state while select mode is on — the paint tool
  // shows deselected.
  const selectActive = aquarelleSelectMode.value;

  return (
    <div
      data-testid="aquarelle-tool-row"
      role="toolbar"
      aria-label="Aquarelle tools"
      style={{
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'nowrap',
        gap: '4px',
      }}
    >
      {TOOLS.map(({ id, label, shortcut, Icon }) => {
        const isActive = !selectActive && active === id;
        const waterGated = id === 'water' && !wetAvailable;
        return (
          <button
            key={id}
            type="button"
            data-testid={`aquarelle-tool-${id}`}
            class={`physics-paint-segmented-button${isActive ? ' active' : ''}`}
            aria-pressed={isActive}
            disabled={id === 'water' && !wetAvailable}
            title={waterGated ? 'Water (W) — needs standing water' : shortcut ? `${label} (${shortcut})` : label}
            onClick={() => {
              // 261029-lel: a dry sheet has nothing for Water to blend — refuse
              // the pick even on a programmatic/test click.
              if (id === 'water' && !aquarelleHasWetPaint.peek()) return;
              // 261022-pim: picking a paint tool returns the sheet to painting.
              setAquarelleSelectMode(false);
              setAquarelleTool(id);
            }}
            style={{
              width: '32px',
              height: '32px',
              display: 'inline-flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '1px',
              padding: 0,
              overflow: 'hidden',
            }}
          >
            <Icon size={16} />
            <span
              style={{
                fontSize: '10px',
                fontWeight: 600,
                lineHeight: 1.2,
              }}
            >
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
