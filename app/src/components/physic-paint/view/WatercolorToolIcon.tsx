// ============================================================
//  WatercolorToolIcon — the Watercolor tool's composite mark
//  (artist's ruling, 2026-11-27): the brush upper-right and a
//  large filled droplet lower-left, diagonally arranged.
//
//  One inline SVG so both glyphs share a single stroke weight
//  (1.5 units, the apparent weight of an 18px lucide icon) and
//  the composition holds together at every rendered size. The
//  path data is lucide 1.57 (`paintbrush` + `droplet`, ISC),
//  inlined because the two glyphs need independent transforms.
//
//  `size` is the square mark's edge: the rail renders it at 24
//  (35px button) and the tool row at 16 (17px icon budget).
//  Shared by the live rail and AquarelleToolRow so the rows
//  can never drift.
// ============================================================

import type { ComponentChildren } from 'preact';

const BRUSH_PATHS = [
  'm14.622 17.897-10.68-2.913',
  'M18.376 2.622a1 1 0 1 1 3.002 3.002L17.36 9.643a.5.5 0 0 0 0 .707l.944.944a2.41 2.41 0 0 1 0 3.408l-.944.944a.5.5 0 0 1-.707 0L8.354 7.348a.5.5 0 0 1 0-.707l.944-.944a2.41 2.41 0 0 1 3.408 0l.944.944a.5.5 0 0 0 .707 0z',
  'M9 8c-1.804 2.71-3.97 3.46-6.583 3.948a.507.507 0 0 0-.302.819l7.32 8.883a1 1 0 0 0 1.185.204C12.735 20.405 16 16.792 16 15',
] as const;

const DROP_PATH =
  'M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z';

// Glyph transforms in the 24-unit box: the brush reaches the top-right
// corner and the drop sits below-right of its lower-left bristles, very
// close but never touching (≈1.7 units of clear space between strokes).
// The union of both strokes is centred in the box.
const BRUSH = { x: 6.75, y: 0.3, scale: 0.66 };
const DROP = { x: 0, y: 10.25, scale: 0.55 };
const STROKE_UNITS = 1.5;

export function WatercolorToolIcon({ size = 24 }: { size?: number }): ComponentChildren {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <g
        transform={`translate(${BRUSH.x} ${BRUSH.y}) scale(${BRUSH.scale})`}
        stroke-width={STROKE_UNITS / BRUSH.scale}
      >
        {BRUSH_PATHS.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <g
        transform={`translate(${DROP.x} ${DROP.y}) scale(${DROP.scale})`}
        stroke-width={STROKE_UNITS / DROP.scale}
      >
        <path d={DROP_PATH} fill="currentColor" />
      </g>
    </svg>
  );
}
