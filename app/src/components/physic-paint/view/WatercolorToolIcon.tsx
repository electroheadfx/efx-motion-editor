// ============================================================
//  WatercolorToolIcon — the Watercolor tool's composite mark:
//  the lucide Paintbrush stacked over a large solid droplet
//  (artist's ruling, 2026-11-27). The droplet is filled so it
//  stays legible at tool-rail sizes. `size` is the mark's nominal
//  width; the stack is ~1.35× that tall, so callers pick a size
//  their button can hold (rail 20, tool row 13). Shared by the
//  live rail and AquarelleToolRow so the two rows never drift.
// ============================================================

import { Droplet, Paintbrush } from 'lucide-preact';

export function WatercolorToolIcon({ size = 18 }: { size?: number }) {
  const brushSize = Math.round(size * 0.8);
  const dropSize = Math.round(size * 0.7);
  const overlap = Math.max(1, Math.round(size * 0.15));
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
      <Paintbrush size={brushSize} />
      <span style={{ display: 'inline-flex', marginTop: `-${overlap}px` }}>
        <Droplet size={dropSize} fill="currentColor" />
      </span>
    </span>
  );
}
