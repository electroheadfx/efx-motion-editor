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
 */
export function PhysicsPaintFilmstripCapsule(props: PhysicsPaintFilmstripCapsuleProps) {
  const { presentation, geometry, repeat, sourceOffsets, cycleLength, cellWidth } = props;
  const expanded = cellWidth >= FILMSTRIP_CELL_EXPAND_THRESHOLD_PX;
  const repeatMarker = repeat === 'infinity' ? '×∞' : `×${repeat}`;
  const repeatCells = [];
  if (expanded) {
    for (let cycle = 0; cycle < presentation.repeatInstanceCount; cycle += 1) {
      for (let cell = 0; cell < sourceOffsets.length; cell += 1) {
        repeatCells.push(
          <span
            key={`${cycle}:${cell}`}
            class="physics-paint-capsule-repeat-cell"
            style={{ left: `${(cycle * cycleLength + sourceOffsets[cell]) * cellWidth}px` }}
          >
            {sourceOffsets[cell]}
          </span>,
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
          >
            {offset}
          </span>
        ))}
      </span>
      <span class="physics-paint-capsule-badge" aria-hidden="true">
        {presentation.cycleLabel}
        <span class="physics-paint-capsule-repeat-marker">{repeatMarker}</span>
      </span>
      {presentation.shortened && presentation.shortenedLabel ? (
        <span class="physics-paint-capsule-shortened-label" aria-hidden="true">
          {presentation.shortenedLabel}
        </span>
      ) : null}
      <span class={bandClass} aria-hidden="true">
        {expanded ? repeatCells : null}
      </span>
    </div>
  );
}
