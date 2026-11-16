// ============================================================
//  WatercolorTextureStrip — the TEXTURE axis of the brush surface
//  (quick-261115-oh9).
//
//  A texture is a SETTING of the active brush RESPONSE: it replaces
//  the footprint (tip) and nothing else — never a response scalar,
//  never the multipliers, never the tool. This row is the one pick
//  surface for that axis, shared by the brush library (full) and the
//  top-bar popover (compact).
//
//  Order: Default (no texture — the response's own procedural tip),
//  then the machine library's rows in catalog order. quick 261116-inu:
//  import is the ONLY way to obtain a texture; there are no
//  compile-time built-ins and nothing is project-scoped. A picked
//  texture is a library row, not an "import".
//
//  Every chip paints the engine's real grayscale mask
//  (watercolorMaskChip → strokeTipData): live, bake and chip resolve
//  the same bytes, so a chip can never show a footprint the engine
//  would not stamp. The Default chip follows the selected response
//  because the chip cache key carries that response id, and the
//  inline ref identity is fresh on every render. A chip also previews
//  its library row's rotation (integer DEGREES; 0 for Default) — the
//  one hop that makes the Textures rotation stepper visible here.
//
//  A pick writes aquarelleSelectedTextureId ONLY, through its
//  compare-then-write setter. The response selection and the
//  multiplier bag stay untouched; never a signal write in the render
//  body; no useState/useEffect (the write happens in the click
//  handler).
// ============================================================

import { resolveMask, type AquarelleTip } from '@efxlab/efx-watercolor';
import {
  brushCatalogGeneration,
  customBrushTips,
  libraryRows,
  unavailableTipIds,
} from '../../../stores/aquarelleBrushCatalog';
import {
  aquarelleSelectedTextureId,
  aquarelleSelectedTipId,
  setAquarelleSelectedTextureId,
} from './aquarelleRecordState';
import { blitMaskChip } from './watercolorMaskChip';

interface TextureEntry {
  /** null is the Default chip: no texture, the response's own tip. */
  readonly id: string | null;
  readonly name: string;
  readonly unavailable: boolean;
}

/**
 * Default first, then the machine library's rows in catalog order. A row can
 * be unavailable (its stored file is missing or undecodable on this machine);
 * the Default chip never is.
 */
function textureEntries(
  imports: readonly AquarelleTip[],
  unavailableIds: ReadonlySet<string>,
): TextureEntry[] {
  return [
    { id: null, name: 'Default', unavailable: false },
    ...imports.map(
      (tip): TextureEntry => ({
        id: tip.id,
        name: tip.name,
        unavailable: unavailableIds.has(tip.id),
      }),
    ),
  ];
}

/**
 * One chip: a 44px mask canvas (the mask's own bitmap scaled by CSS) plus the
 * name, which the compact popover variant hides.
 */
function TextureChip(props: {
  entry: TextureEntry;
  responseId: string;
  /** The row's integer-degree rotation; 0 for the Default chip. */
  textureRotation: number;
  selected: boolean;
  compact: boolean;
}) {
  const textureId = props.entry.id;
  return (
    <button
      type="button"
      class="watercolor-texture-chip"
      data-testid={`watercolor-texture-chip-${textureId ?? 'default'}`}
      data-selected={props.selected ? 'true' : 'false'}
      data-unavailable={props.entry.unavailable ? 'true' : 'false'}
      aria-pressed={props.selected}
      aria-disabled={props.entry.unavailable}
      disabled={props.entry.unavailable}
      title={props.entry.name}
      onClick={() => {
        // The early return keeps the law true even when a caller invokes the
        // handler directly (the DOM `disabled` attribute covers the pointer).
        if (props.entry.unavailable) return;
        setAquarelleSelectedTextureId(textureId);
      }}
      style={
        props.entry.unavailable ? { opacity: 0.45, cursor: 'not-allowed' } : undefined
      }
    >
      <canvas
        class="watercolor-texture-chip-canvas"
        width={44}
        height={44}
        ref={(el: HTMLCanvasElement | null) => {
          if (el) blitMaskChip(el, props.responseId, textureId, props.textureRotation);
        }}
      />
      <span
        class="watercolor-texture-chip-name"
        style={props.compact ? { display: 'none' } : undefined}
      >
        {props.entry.name}
      </span>
    </button>
  );
}

export function WatercolorTextureStrip(props: { compact?: boolean }) {
  // Narrow signal reads (efx-preact-reactivity rule 5): one read per signal
  // per render, no signal write in this body.
  const imports = customBrushTips.value;
  const unavailableIds = unavailableTipIds.value;
  // quick 261116-inu / Task 10: one read of the rows this render, so each chip
  // can preview its own integer-degree rotation without a per-chip signal read.
  const rotationById = new Map(
    libraryRows.value.map((row) => [row.tip.id, row.textureRotation] as const),
  );
  const responseId = aquarelleSelectedTipId.value ?? 'round';
  const pinnedTextureId = aquarelleSelectedTextureId.value;
  // IN-03: show what the BINDING law would stamp, not the raw pick. A texture
  // the registry lost resolves to the response's own tip at the seam — the row
  // must agree, or no chip looks selected while the engine paints Default.
  const selectedTextureId = pinnedTextureId !== null && resolveMask(pinnedTextureId) !== null
    ? pinnedTextureId
    : null;
  // Catalog changes (project open / close, import arrival) must re-render and
  // re-measure the row, so the generation is read — and exposed as data.
  const catalogGeneration = brushCatalogGeneration.value;
  const compact = props.compact === true;
  return (
    <div
      class="watercolor-texture-strip"
      data-testid="watercolor-texture-strip"
      data-compact={compact ? 'true' : 'false'}
      data-catalog-generation={catalogGeneration}
    >
      {textureEntries(imports, unavailableIds).map((entry) => (
        <TextureChip
          key={entry.id ?? 'default'}
          entry={entry}
          responseId={responseId}
          textureRotation={entry.id === null ? 0 : rotationById.get(entry.id) ?? 0}
          selected={entry.id === selectedTextureId}
          compact={compact}
        />
      ))}
    </div>
  );
}
