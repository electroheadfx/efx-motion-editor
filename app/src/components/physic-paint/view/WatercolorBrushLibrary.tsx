// ============================================================
//  WatercolorBrushLibrary — the project brush surface
//  (261017-xa0 I-03; split into the two axes by quick-261115-oh9).
//
//  A brush has TWO independent axes:
//   · the RESPONSE — a preset id that owns every Brush field
//     (physics, size, spacing, rotation, grain…). The grid below is
//     the response axis: TWO sections over BRUSH_PRESETS, one per
//     medium group in the fixed order Watercolor, Gouache (quick
//     261124-iq9), always expanded. A group with no member renders
//     nothing. A response card is never a texture and never a
//     project import.
//   · the TEXTURE — an optional mask that replaces the footprint and
//     nothing else. The WatercolorTextureStrip texture row above the
//     grid is that axis: Default first (the response's own tip), then
//     the three compile-time built-ins, then the project imports, each
//     chip painting the engine's real grayscale mask.
//
//  The texture row also owns the import controls: one import button
//  plus a hidden PNG/JPEG file input. An import selects on arrival:
//  the new texture becomes the selection, so the next stroke stamps
//  it without a second click; a refused import keeps the existing
//  copy and leaves the selection untouched.
//
//  Every response card is a painted stroke thumb (watercolorStrokeThumb,
//  generation-keyed paint-once cache) + name; a card also carries its
//  hint as a title tooltip. An unavailable project texture renders as a
//  greyed, unselectable chip, and the library shows exactly ONE
//  aggregate warning line for the whole set (63-06 D-19) — never one
//  line per tip.
//
//  Still absent by design: no category filter, no search field, no
//  collapse state, no wc/ size-variant rows.
//
//  The import row mutates nothing here. It decodes the picked file
//  into one 192×192 mask (importTip), then asks the MAIN realm via
//  requestPhysicPaintBrushImport — that realm owns the project
//  catalog, the mask registry and the stored bytes (63-05). The
//  catalog push lists the new tip in the texture row; this component
//  never appends to the catalog itself.
//
//  Both mounts (floating brush modal + right-panel Brush tab) render
//  in the Studio child realm, whose aquarelleBrushCatalog instance is
//  filled by plan 63-05's applyBrushCatalogPayload. BrushesDocker
//  stays unmounted and is never revived (D-02).
//
//  Picking a response card is a brush-tool variant pick: it runs
//  selectAquarelleTip(id), which keeps the id and forces
//  aquarelleActiveTool to 'brush'. Selection is the existing
//  aquarelleSelectedTipId signal — applied in the click handler,
//  never via useEffect.
//
//  261029-eur WR-03: a pick also leaves Edit (select) mode FIRST,
//  UNLESS a non-empty selection is armed — leaving Select mode
//  clears the selection the pick is about to edit.
// ============================================================

import type { ComponentChildren } from 'preact';
import { useRef } from 'preact/hooks';
import { signal } from '@preact/signals';
import { FolderOpen } from 'lucide-preact';
import {
  brushGroupLabels,
} from '@efxlab/efx-watercolor'
import type { MediumId } from '@efxlab/efx-watercolor';
import {
  IMPORT_TIP_FAILURE_COPY,
  decodeRgbaAtTipSize,
  importTip,
} from '@efxlab/efx-watercolor/brushes';
import { requestPhysicPaintBrushImport } from '../../../lib/physicPaintBridge';
import {
  aquarelleActiveTool,
  aquarelleSelectedTipId,
  setAquarelleSelectedTextureId,
} from './aquarelleRecordState';
import { brushSectionsForTool } from './brushToolFamily';
import {
  aquarelleSelectionEditActive,
  setAquarelleSelectMode,
} from './aquarelleStrokeSelection';
import { pickAquarelleBrush } from './aquarellePaintControls';
import { WatercolorTextureStrip } from './WatercolorTextureStrip';
import {
  STROKE_THUMB_HEIGHT,
  STROKE_THUMB_WIDTH,
  blitStrokeThumb,
  getStrokeThumb,
} from './watercolorStrokeThumb';

/**
 * Import-row state (63-06 D-01 / T-63-17). Module-scope signals, not
 * `useState`: the library is mounted twice and both mounts must agree on the
 * in-flight / failure state. Writes happen only in the change handler.
 */
const importInFlight = signal(false);
const importFailed = signal(false);

/** Read-only surface for the pins (the setters below are the only writers). */
export const watercolorBrushImporting = importInFlight;
export const watercolorBrushImportFailure = importFailed;

/** Compare-then-write (efx-preact-reactivity rule 3): a repeat writes nothing. */
function setImporting(next: boolean): void {
  if (importInFlight.peek() !== next) importInFlight.value = next;
}

function setImportFailure(next: boolean): void {
  if (importFailed.peek() !== next) importFailed.value = next;
}

/**
 * 63-06 D-01 / quick 261116-gcn: the ONE import control. Extracted so the brush
 * catalog's texture row and the floating Textures sheet share a single decode +
 * register path — importTip derives the 192×192 mask in this realm, then
 * requestPhysicPaintBrushImport asks the MAIN realm to register it (that realm
 * owns the catalog, the mask registry and the stored bytes). A successful
 * import selects the new texture on arrival, so the next stroke stamps it.
 *
 * `testIdPrefix` keeps the two mounted surfaces addressable without sharing a
 * DOM testid: the catalog keeps the shipped `watercolor-brush-import*` names.
 */
export function WatercolorTextureImport(props: { testIdPrefix?: string }) {
  const prefix = props.testIdPrefix ?? 'watercolor-brush-import';
  // Narrow signal reads: the module-scope signals make both mounts agree on the
  // in-flight / failure state.
  const busy = importInFlight.value;
  const importFailedValue = importFailed.value;
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const onImportFile = async (event: Event): Promise<void> => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    setImporting(true);
    setImportFailure(false);
    try {
      const result = await importTip(file, {
        decode: decodeRgbaAtTipSize,
        register: async ({ mask, name }) => {
          const answer = await requestPhysicPaintBrushImport(mask, name);
          return answer.ok && answer.entry ? answer.entry : null;
        },
      });
      if (result.ok) {
        setAquarelleSelectedTextureId(result.tip.id);
      } else {
        setImportFailure(true);
      }
    } catch {
      setImportFailure(true);
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <button
          type="button"
          data-testid={prefix}
          title="Import brush tip (PNG/JPG)"
          aria-label="Import brush tip (PNG/JPG)"
          disabled={busy}
          onClick={() => fileInputRef.current?.click()}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            height: '24px',
            padding: '0 8px',
            border: '1px solid var(--sidebar-border-unselected, rgba(159, 165, 174, 0.55))',
            borderRadius: '3px',
            background: 'transparent',
            cursor: busy ? 'default' : 'pointer',
            opacity: busy ? 0.5 : 1,
            color: 'var(--sidebar-text-primary, #eceff2)',
            fontSize: '10px',
            fontWeight: 600,
          }}
        >
          <FolderOpen size={14} />
          Import tip
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg"
          data-testid={`${prefix}-input`}
          style={{ display: 'none' }}
          onChange={(event) => onImportFile(event)}
        />
      </div>
      {/* 261116-inu: no aggregate "unavailable" line. A missing texture is a
          machine-library fact, not a project error, and it is already visible
          where it matters — the chip that owns it renders data-unavailable, and
          the delete confirmation names the fallback before the gesture commits.
          A standing red line here only restated a state the artist had just
          chosen. */}
      {importFailedValue ? (
        <div
          data-testid={`${prefix}-import-failure`}
          style={{
            gridColumn: '1 / -1',
            fontSize: '10px',
            fontWeight: 600,
            lineHeight: 1.2,
            color: 'var(--color-error-text, #FF6666)',
          }}
        >
          {IMPORT_TIP_FAILURE_COPY}
        </div>
      ) : null}
    </>
  );
}

/**
 * The painted stroke thumbnail, shared by the response cards and the Studio
 * top bar. `presetId` is the RESPONSE id — the thumb module resolves a
 * preset or a legacy catalog id to the response's procedural tip. Paint-once
 * cache fill (module-level Map keyed by id + mask generation): first call
 * paints, later renders are a Map hit — no repaint, no bitmap serialization.
 */
export function WatercolorBrushThumb(props: {
  presetId: string;
  class?: string;
  testId?: string;
}) {
  getStrokeThumb(props.presetId);
  return (
    <canvas
      class={props.class ?? 'watercolor-brush-thumb'}
      data-testid={props.testId}
      width={STROKE_THUMB_WIDTH}
      height={STROKE_THUMB_HEIGHT}
      ref={(el: HTMLCanvasElement | null) => {
        if (el) blitStrokeThumb(el, props.presetId);
      }}
    />
  );
}

/**
 * One RESPONSE card: a painted stroke preview plus the preset name and its
 * hint as the hover tooltip. The pick runs `pickAquarelleBrush(id)`, which
 * selects the response AND records the appearance on an armed selection.
 * A response is never a project asset, so this card has no unavailable
 * state.
 */
function BrushCard(props: {
  id: string;
  name: string;
  title: string;
  selected: boolean;
}) {
  return (
    <button
      type="button"
      class="watercolor-brush-card"
      data-testid={`watercolor-brush-card-${props.id}`}
      data-selected={props.selected ? 'true' : 'false'}
      aria-pressed={props.selected}
      title={props.title}
      onClick={() => {
        // 261029-eur WR-03, two-part law: leave Edit mode before the pick
        // flips the tool UNLESS a non-empty selection is armed — leaving
        // Select mode clears the selection the pick is about to edit.
        if (!aquarelleSelectionEditActive()) setAquarelleSelectMode(false);
        void pickAquarelleBrush(props.id);
      }}
    >
      <WatercolorBrushThumb
        presetId={props.id}
        testId={`watercolor-brush-thumb-${props.id}`}
      />
      <span class="watercolor-brush-name">
        {props.name}
      </span>
    </button>
  );
}

/**
 * One section (63-06 D-03, widened by 64-11 MED-27). The section spans both
 * library columns and lays its own 2-column card grid, so section order is the
 * visual order. `id` is the medium group and doubles as the testid suffix.
 */
function BrushSection(props: {
  id: MediumId;
  title: string;
  children?: ComponentChildren;
}) {
  return (
    <section
      data-testid={`watercolor-brush-section-${props.id}`}
      style={{
        gridColumn: '1 / -1',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}
    >
      <div
        class="watercolor-brush-section-title"
        style={{
          fontSize: '10px',
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--sidebar-text-secondary, #9aa5b1)',
        }}
      >
        {props.title}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
        }}
      >
        {props.children}
      </div>
    </section>
  );
}

/**
 * The response grid below the shared texture row. The root keeps its
 * 2-column track set (the CSS contract the card rules were written against)
 * while the texture row and the section span both columns.
 */
export function WatercolorBrushLibrary() {
  // Narrow signal reads (efx-preact-reactivity rule 5): one read per signal
  // per render, and no signal is written from this body.
  const selectedTipId = aquarelleSelectedTipId.value;
  // quick 261121-mtu (rev 2): the tool selects the brush FAMILY — Brush shows
  // every non-watercolor group, Watercolor shows the watercolor group alone,
  // and the utility tools (Water / Pen / Eraser) expose the whole table.
  const activeTool = aquarelleActiveTool.value;

  return (
    <div
      data-testid="watercolor-brush-library"
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '8px',
      }}
    >
      {/* The texture axis above the grid: the shared strip plus the ONE
          import control (63-06 D-01). */}
      <div
        data-testid="watercolor-brush-import-row"
        style={{
          gridColumn: '1 / -1',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}
      >
        <WatercolorTextureStrip />
        <WatercolorTextureImport />
      </div>
      {brushSectionsForTool(activeTool).map((section) => (
        <BrushSection
          key={section.group}
          id={section.group}
          title={brushGroupLabels[section.group]}
        >
          {section.presets.map((preset) => (
            <BrushCard
              key={preset.id}
              id={preset.id}
              name={preset.name}
              title={preset.hint}
              selected={preset.id === selectedTipId}
            />
          ))}
        </BrushSection>
      ))}
    </div>
  );
}
