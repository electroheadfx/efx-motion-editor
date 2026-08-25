import type {
  PhysicsPaintLoopClipGeometry,
  PhysicsPaintLoopClipPresentation,
} from './physicsPaintLoopClipPresentation';

/**
 * D-13: the repetition band switches from the compact perforated/hatched
 * form to expanded linked cells once the physical-frame pitch reaches this
 * width. Derived from cell width so expansion is gradual and predictable.
 */
export const FILMSTRIP_CELL_EXPAND_THRESHOLD_PX = 12;

/**
 * Approximate glyph widths (px) at the badge's 8px/600 system-ui font, used
 * to decide whether the full cycle label fits the capsule width. Digits are
 * tabular (equal width); the remaining glyphs cover every character that
 * appears in `cycleLabel` / `×N`/`×∞` markers.
 */
const BADGE_GLYPH_WIDTHS: Readonly<Record<string, number>> = {
  ' ': 2.2,
  '0': 4.6, '1': 4.6, '2': 4.6, '3': 4.6, '4': 4.6,
  '5': 4.6, '6': 4.6, '7': 4.6, '8': 4.6, '9': 4.6,
  'C': 5.2, 'y': 4.0, 'c': 3.4, 'l': 2.4, 'e': 3.8, 'f': 3.2,
  '×': 3.2, '∞': 7.0, '=': 4.4,
};

function estimateBadgeTextWidth(text: string): number {
  let width = 0;
  for (const char of text) width += BADGE_GLYPH_WIDTHS[char] ?? 3.8;
  return width;
}

export interface PhysicsPaintFilmstripCapsuleProps {
  /** Task-1 presentation — the ONLY source of copy (badge, shortened label, cut). */
  readonly presentation: PhysicsPaintLoopClipPresentation;
  /** Placement from projectPhysicsPaintLoopClipGeometry (left/width in px). */
  readonly geometry: PhysicsPaintLoopClipGeometry;
  /** Resolver-provided repetition fact; the ×N/×∞ marker mirrors cycleLabel. */
  readonly repeat: number | 'infinity';
  /** Resolver-provided source-cycle facts for the head cells. */
  readonly sourceOffsets: readonly number[];
  readonly sourceFrameCount: number;
  /** Physical frames per source cycle (last normalized source offset + 1). */
  readonly cycleLength: number;
  /** Zoom: physical-frame pitch in px. */
  readonly cellWidth: number;
}

/**
 * Paint-only capsule (pointer-events: none, z-index 7) that evolves the
 * Phase 43 rail surface without touching its selection/drag/spacing/
 * playback semantics (D-11). All facts come from the presentation and the
 * resolver-derived range fields — this component never computes loop math.
 * 47 UAT: cells are pure visual treatments (no numeric labels on frames);
 * the capsule carries AT MOST one compact badge at its head — the full
 * cycle label when it fits the capsule width, else the ×N/×∞ form. All
 * other facts (shortened label, durations) live in the tooltip.
 */
export function PhysicsPaintFilmstripCapsule(props: PhysicsPaintFilmstripCapsuleProps) {
  const { presentation, geometry, repeat, sourceOffsets, cycleLength, cellWidth } = props;
  const expanded = cellWidth >= FILMSTRIP_CELL_EXPAND_THRESHOLD_PX;
  const repeatMarker = repeat === 'infinity' ? '×∞' : `×${repeat}`;
  const badgeFits = estimateBadgeTextWidth(presentation.cycleLabel) <= geometry.width;
  const repeatCells = [];
  if (expanded) {
    for (let cycle = 0; cycle < presentation.repeatInstanceCount; cycle += 1) {
      for (let cell = 0; cell < sourceOffsets.length; cell += 1) {
        repeatCells.push(
          <span
            key={`${cycle}:${cell}`}
            class="physics-paint-capsule-repeat-cell"
            style={{ left: `${(cycle * cycleLength + sourceOffsets[cell]) * cellWidth}px` }}
          />,
        );
      }
    }
  }
  const bandClass = [
    'physics-paint-capsule-repeat-band',
    expanded ? '' : 'compact',
    presentation.partialCycle ? 'partial-cut' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      class={`physics-paint-filmstrip-capsule${presentation.shortened ? ' shortened' : ''}`}
      style={{ left: `${geometry.left}px`, width: `${geometry.width}px` }}
      aria-hidden="true"
    >
      <span class="physics-paint-capsule-source-cells" aria-hidden="true">
        {sourceOffsets.map((offset) => (
          <span
            key={offset}
            class="physics-paint-capsule-source-cell"
            style={{ left: `${offset * cellWidth}px` }}
          />
        ))}
      </span>
      <span
        class={`physics-paint-capsule-badge${badgeFits ? '' : ' marker-only'}`}
        aria-hidden="true"
      >
        {badgeFits ? presentation.cycleLabel : repeatMarker}
      </span>
      <span class={bandClass} aria-hidden="true">
        {expanded ? repeatCells : null}
      </span>
    </div>
  );
}
