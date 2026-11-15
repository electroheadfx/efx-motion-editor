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
//  then the three compile-time built-ins in BUILTIN_TIPS order, then
//  the open project's imports in catalog order.
//
//  Every chip paints the engine's real 192x192 grayscale mask
//  (watercolorMaskChip → strokeTipData): live, bake and chip resolve
//  the same bytes, so a chip can never show a footprint the engine
//  would not stamp. The Default chip follows the selected response
//  because the chip cache key carries that response id, and the
//  inline ref identity is fresh on every render.
//
//  A pick writes aquarelleSelectedTextureId ONLY, through its
//  compare-then-write setter. The response selection and the
//  multiplier bag stay untouched; never a signal write in the render
//  body; no useState/useEffect (the write happens in the click
//  handler).
// ============================================================

import { BUILTIN_TIPS, type AquarelleTip } from '@efxlab/efx-watercolor';
import {
  brushCatalogGeneration,
  customBrushTips,
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
 * Default first, then the compile-time built-ins in catalog order, then the
 * project imports. Only a project import can be unavailable: built-in masks
 * ship with the app and never fail to resolve.
 */
function textureEntries(
  imports: readonly AquarelleTip[],
  unavailableIds: ReadonlySet<string>,
): TextureEntry[] {
  return [
    { id: null, name: 'Default', unavailable: false },
    ...BUILTIN_TIPS.map(
      (tip): TextureEntry => ({ id: tip.id, name: tip.name, unavailable: false }),
    ),
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
 * One chip: a 44px mask canvas (the 192px bitmap scaled by CSS) plus the
 * name, which the compact popover variant hides.
 */
function TextureChip(props: {
  entry: TextureEntry;
  responseId: string;
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
          if (el) blitMaskChip(el, props.responseId, textureId);
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
  const responseId = aquarelleSelectedTipId.value ?? 'round';
  const selectedTextureId = aquarelleSelectedTextureId.value;
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
          selected={entry.id === selectedTextureId}
          compact={compact}
        />
      ))}
    </div>
  );
}
