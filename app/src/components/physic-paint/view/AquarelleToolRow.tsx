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
import type { AquarelleTool } from '@efxlab/efx-watercolor/payload';

const TOOLS: ReadonlyArray<{
  id: AquarelleTool;
  label: string;
  Icon: (props: { size?: number }) => ComponentChildren;
}> = Object.freeze([
  { id: 'brush', label: 'Brush', Icon: Paintbrush },
  { id: 'water', label: 'Water', Icon: Droplet },
  { id: 'pen', label: 'Pen', Icon: Pen },
  { id: 'lift', label: 'Lift', Icon: Eraser },
]);

export function AquarelleToolRow() {
  const active = aquarelleActiveTool.value;

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
      {TOOLS.map(({ id, label, Icon }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            type="button"
            data-testid={`aquarelle-tool-${id}`}
            class={`physics-paint-segmented-button${isActive ? ' active' : ''}`}
            aria-pressed={isActive}
            title={label}
            onClick={() => setAquarelleTool(id)}
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
