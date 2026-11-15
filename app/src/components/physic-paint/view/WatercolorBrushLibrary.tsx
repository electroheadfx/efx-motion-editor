// ============================================================
//  WatercolorBrushLibrary — the project brush catalog
//  (261017-xa0 I-03; chalk added by 261027-gh9; sectioned by 63-06).
//
//  Delivered surface (63-06 D-01 / D-03 / D-05 / D-19):
//   · ONE import toolbar row above the grid — a button plus a
//     hidden PNG/JPEG file input. This is the only new control.
//   · three sections in order: the shipped BRUSH_PRESETS first,
//     then "Texture" (the three compile-time wc/builtin-* tips,
//     immediately after the presets), then "Custom" (the open
//     project's imports, rendered only when the project has any).
//   · every card is a painted stroke thumb (watercolorStrokeThumb,
//     generation-keyed paint-once cache) + name; a preset card also
//     carries its hint as a title tooltip.
//   · an unavailable project tip renders as a greyed, unselectable
//     card, and the library shows exactly ONE aggregate warning
//     line for the whole set (D-19) — never one line per tip.
//   · still absent by design: no category filter, no search field,
//     no wc/ size-variant rows.
//
//  The import row mutates nothing here. It decodes the picked file
//  into one 192×192 mask (importTip), then asks the MAIN realm via
//  requestPhysicPaintBrushImport — that realm owns the project
//  catalog, the mask registry and the stored bytes (63-05). The
//  catalog push lists the new tip below the control; this component
//  never appends to the catalog itself.
//
//  Both mounts (floating brush modal + right-panel Brush tab) render
//  in the Studio child realm, whose aquarelleBrushCatalog instance is
//  filled by plan 63-05's applyBrushCatalogPayload. BrushesDocker
//  stays unmounted and is never revived (D-02).
//
//  Picking a card is a brush-tool variant pick: it runs
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
  BRUSH_PRESETS,
  BUILTIN_TIPS,
  type AquarelleTip,
} from '@efxlab/efx-watercolor';
import {
  IMPORT_TIP_FAILURE_COPY,
  decodeRgbaAtTipSize,
  importTip,
} from '@efxlab/efx-watercolor/brushes';
import { requestPhysicPaintBrushImport } from '../../../lib/physicPaintBridge';
import {
  customBrushTips,
  unavailableTipCount,
  unavailableTipIds,
} from '../../../stores/aquarelleBrushCatalog';
import { aquarelleSelectedTipId } from './aquarelleRecordState';
import {
  aquarelleSelectionEditActive,
  setAquarelleSelectMode,
} from './aquarelleStrokeSelection';
import { pickAquarelleBrush } from './aquarellePaintControls';
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
 * The painted stroke thumbnail, shared by the Brush tab cards and the Studio
 * top bar. `presetId` is the TIP id: a shipped preset id or a mask-backed
 * catalog id — the thumb module resolves either. Paint-once cache fill
 * (module-level Map keyed by tip id + mask generation): first call paints,
 * later renders are a Map hit — no repaint, no toDataURL.
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
 * One card: a painted stroke preview plus the entry's name. `id` is the tip
 * id the pick records — a preset id (`round`, …) or a catalog tip id
 * (`wc/builtin-chalk`, `wc/custom-…`) — and the thumbnail module resolves
 * both. `title` is the hover tooltip (a preset hint, or the name).
 *
 * `unavailable` is the project-catalog degradation (63-06 D-19): the tip's
 * stored mask could not be resolved, so the card is greyed and cannot be
 * picked. The early return in the click handler keeps the law true even when
 * a caller invokes the handler directly (the DOM `disabled` attribute covers
 * the pointer path).
 */
function BrushCard(props: {
  id: string;
  name: string;
  title: string;
  selected: boolean;
  unavailable?: boolean;
}) {
  const unavailable = props.unavailable === true;
  return (
    <button
      type="button"
      class="watercolor-brush-card"
      data-testid={`watercolor-brush-card-${props.id}`}
      data-selected={props.selected ? 'true' : 'false'}
      data-unavailable={unavailable ? 'true' : 'false'}
      aria-pressed={props.selected}
      aria-disabled={unavailable}
      disabled={unavailable}
      title={props.title}
      onClick={() => {
        if (unavailable) return;
        // 261029-eur WR-03, two-part law: leave Edit mode before the pick
        // flips the tool UNLESS a non-empty selection is armed — leaving
        // Select mode clears the selection the pick is about to edit.
        if (!aquarelleSelectionEditActive()) setAquarelleSelectMode(false);
        void pickAquarelleBrush(props.id);
      }}
      style={
        unavailable
          ? { opacity: 0.45, cursor: 'not-allowed' }
          : undefined
      }
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
 * One catalog section (63-06 D-03). The section spans both library columns
 * and lays its own 2-column card grid, so section order is the visual order.
 */
function BrushSection(props: {
  id: 'presets' | 'texture' | 'custom';
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
 * The catalog grid plus its import row. The root keeps its 2-column track set
 * (the CSS contract the card rules were written against) while the toolbar
 * row and every section span both columns; empty sections are skipped,
 * exactly like the category grouping law the retired docker used.
 */
export function WatercolorBrushLibrary() {
  // Narrow signal reads (efx-preact-reactivity rule 5): one read per signal
  // per render, and no signal is written from this body.
  const selectedTipId = aquarelleSelectedTipId.value;
  const customTips: readonly AquarelleTip[] = customBrushTips.value;
  const unavailableIds = unavailableTipIds.value;
  const unavailableCount = unavailableTipCount.value;
  const busy = importInFlight.value;
  const importFailedValue = importFailed.value;
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  /**
   * One import: decode the picked file into a 192×192 mask in THIS realm
   * (importTip owns both caps and the derivation law), then ask the project
   * realm to register it. The answer carries only the catalog entry; the
   * catalog push is the one path that lists it (63-05).
   */
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
      if (!result.ok) setImportFailure(true);
    } catch {
      setImportFailure(true);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div
      data-testid="watercolor-brush-library"
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '8px',
      }}
    >
      {/* 63-06 D-01: the ONE import toolbar row, above the grid. */}
      <div
        data-testid="watercolor-brush-import-row"
        style={{
          gridColumn: '1 / -1',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <button
          type="button"
          data-testid="watercolor-brush-import"
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
          data-testid="watercolor-brush-import-input"
          style={{ display: 'none' }}
          onChange={(event) => onImportFile(event)}
        />
      </div>
      {/* 63-06 D-19: ONE aggregate line for the whole unavailable set. */}
      {unavailableCount > 0 ? (
        <div
          data-testid="watercolor-brush-unavailable-warning"
          role="status"
          style={{
            gridColumn: '1 / -1',
            fontSize: '10px',
            fontWeight: 600,
            lineHeight: 1.2,
            color: 'var(--color-error-text, #FF6666)',
          }}
        >
          {unavailableCount === 1
            ? '1 brush tip unavailable in this project'
            : `${unavailableCount} brush tips unavailable in this project`}
        </div>
      ) : null}
      {importFailedValue ? (
        <div
          data-testid="watercolor-brush-import-failure"
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
      <BrushSection id="presets" title="Presets">
        {BRUSH_PRESETS.map((preset) => (
          <BrushCard
            key={preset.id}
            id={preset.id}
            name={preset.name}
            title={preset.hint}
            selected={preset.id === selectedTipId}
          />
        ))}
      </BrushSection>
      <BrushSection id="texture" title="Texture">
        {BUILTIN_TIPS.map((tip) => (
          <BrushCard
            key={tip.id}
            id={tip.id}
            name={tip.name}
            title={tip.name}
            selected={tip.id === selectedTipId}
          />
        ))}
      </BrushSection>
      {customTips.length > 0 ? (
        <BrushSection id="custom" title="Custom">
          {customTips.map((tip) => (
            <BrushCard
              key={tip.id}
              id={tip.id}
              name={tip.name}
              title={tip.name}
              selected={tip.id === selectedTipId}
              // Project entries only: a built-in mask is compile-time and can
              // never be unavailable, so the built-in cards stay selectable.
              unavailable={unavailableIds.has(tip.id)}
            />
          ))}
        </BrushSection>
      ) : null}
    </div>
  );
}
