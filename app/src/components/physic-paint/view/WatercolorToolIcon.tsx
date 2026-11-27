// ============================================================
//  WatercolorToolIcon — the Watercolor tool's composite mark:
//  the lucide Paintbrush with a solid droplet assembled at its
//  lower-right tip (artist's ruling, 2026-11-27). The droplet is
//  filled so it stays legible at 16–18 px and cleanly masks the
//  bristle tip it sits on. Shared by the live rail and the
//  AquarelleToolRow so the two rows can never drift.
// ============================================================

import { Droplet, Paintbrush } from 'lucide-preact';

export function WatercolorToolIcon({ size = 18 }: { size?: number }) {
  const dropSize = Math.max(8, Math.round(size * 0.55));
  return (
    <span
      style={{
        position: 'relative',
        display: 'inline-flex',
        width: `${size}px`,
        height: `${size}px`,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Paintbrush size={size} />
      <span
        style={{
          position: 'absolute',
          right: '-2px',
          bottom: '-2px',
          display: 'inline-flex',
        }}
      >
        <Droplet size={dropSize} fill="currentColor" />
      </span>
    </span>
  );
}
