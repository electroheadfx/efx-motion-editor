// ============================================================
//  AquarelleToolRow — the five-tool row (AQUA-02 / D-13, quick
//  261121-mtu).
//
//  Exactly brush | watercolor | water | pen | lift. Dry is NOT a
//  tool (D-15) — it is an action button in WatercolorModuleSection.
//  Selection lives in the click handler (never a deferred effect).
//  Must stay in lockstep with the live rail's WATERCOLOR_RAIL_TOOLS
//  (the lift-contract source pin checks both).
// ============================================================

import { Droplets, Eraser, Paintbrush, Pen } from 'lucide-preact';
import { WatercolorToolIcon } from './WatercolorToolIcon';
import type { ComponentChildren } from 'preact';
import {
  aquarelleActiveTool,
  selectAquarellePaintTool,
} from './aquarelleRecordState';
import { aquarelleSelectMode, setAquarelleSelectMode } from './aquarelleStrokeSelection';
import { aquarelleHasWetPaint } from './aquarelleWetPaintGate';
import type { AquarelleTool } from '@efxlab/efx-watercolor/payload';

const TOOLS: ReadonlyArray<{
  id: AquarelleTool;
  label: string;
  shortcut?: string;
  Icon: (props: { size?: number }) => ComponentChildren;
  /** Overrides the 16px row glyph — the composite mark needs the room. */
  iconSize?: number;
}> = Object.freeze([
  // ORDER IS THE UX: the Paint tab's TOOL dropdown lists these five in this
  // order, so the row and the dropdown can never disagree (2026-11-27).
  // 2026-11-27 (artist's live ruling): the tool reads "Medium" (B unchanged).
  { id: 'brush', label: 'Medium', shortcut: 'B', Icon: Paintbrush },
  // 2026-11-27 (artist's live ruling): Watercolor wears the assembled
  // brush + droplet mark; Water takes the double droplet.
  { id: 'watercolor', label: 'Watercolor', shortcut: 'N', Icon: WatercolorToolIcon, iconSize: 16 },
  { id: 'water', label: 'Water', shortcut: 'W', Icon: Droplets },
  { id: 'pen', label: 'Pen', shortcut: 'P', Icon: Pen },
  { id: 'lift', label: 'Eraser', shortcut: 'E', Icon: Eraser },
]);

/** The Paint-tab TOOL dropdown reads the row's own labels and order. */
export const AQUARELLE_TOOL_ORDER: readonly AquarelleTool[] = Object.freeze(
  TOOLS.map((tool) => tool.id),
);

export const AQUARELLE_TOOL_LABELS: Readonly<Record<AquarelleTool, string>> = Object.freeze(
  Object.fromEntries(TOOLS.map((tool) => [tool.id, tool.label])) as Record<AquarelleTool, string>,
);

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
      {TOOLS.map(({ id, label, shortcut, Icon, iconSize }) => {
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
              // quick 261121-mtu: the ONE tool-pick seam (same as the rail).
              selectAquarellePaintTool(id);
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
            <Icon size={iconSize ?? 16} />
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
