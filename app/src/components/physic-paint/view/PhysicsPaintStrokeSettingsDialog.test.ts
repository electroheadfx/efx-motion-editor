// ============================================================
//  61-11 — the Stroke settings sheet's vector surfaces.
//
//  SOURCE PINS, in the shipped `PhysicsPaintStudio.test.ts` style: the sheet
//  is a Preact leaf rendered behind the Studio's hooks runtime, so its mount
//  points, its copy and its bindings are pinned by scanning the source
//  (`src/**/*.test.ts` only — the vitest config collects no `.test.tsx`).
//
//  Task 1 pins the `Edit path` header button: exactly one mount, sitting
//  between the preview-stroke-size and view-toggle neighbours, carrying the
//  shipped 22x22 header chrome, the two disabled reasons, the aria-pressed
//  binding and the stop-propagation line that keeps it clickable inside the
//  drag handle. Task 2 pins the Anchor width block; task 3 closes the E2/E4
//  rows (disabled reasons, empty caption, mixed, clamp, fixed geometry).
// ============================================================

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  AQUARELLE_ANCHOR_WIDTH_DEFAULT,
  AQUARELLE_ANCHOR_WIDTH_MAX,
  AQUARELLE_ANCHOR_WIDTH_MIN,
  AQUARELLE_ANCHOR_WIDTH_STEP,
  WATERCOLOR_SETTINGS_FIELDS,
} from './strokeSettingsModel';

const dialogSource = readFileSync(
  fileURLToPath(new URL('./PhysicsPaintStrokeSettingsDialog.tsx', import.meta.url)),
  'utf8',
);
const modelSource = readFileSync(
  fileURLToPath(new URL('./strokeSettingsModel.ts', import.meta.url)),
  'utf8',
);
const cssSource = readFileSync(
  fileURLToPath(new URL('../physicsPaintStudio.css', import.meta.url)),
  'utf8',
);

function regionOf(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  expect(start, `missing start marker: ${startMarker}`).toBeGreaterThan(-1);
  const end = source.indexOf(endMarker, start + startMarker.length);
  expect(end, `missing end marker: ${endMarker}`).toBeGreaterThan(start);
  return source.slice(start, end);
}

function countOf(source: string, needle: string): number {
  return source.split(needle).length - 1;
}

const SPLINE_TESTID = 'data-testid="stroke-settings-spline-pointer"';
// The button's own region runs from its test id to the next header button, so
// every attribute, handler and the icon are inside one slice.
const SPLINE_START = SPLINE_TESTID;
const SPLINE_END = 'data-testid="stroke-settings-view-toggle"';

// ── Task 1: the Edit path entrance ──────────────────────────────────

describe('61-11 Edit path header button (E2)', () => {
  it('mounts exactly one spline-pointer button in the header row', () => {
    expect(countOf(dialogSource, SPLINE_TESTID)).toBe(1);
    expect(countOf(dialogSource, 'data-testid="stroke-settings-preview-stroke-size"')).toBe(1);
    expect(countOf(dialogSource, 'data-testid="stroke-settings-view-toggle"')).toBe(1);
  });

  it('sits between the preview-stroke-size and view-toggle neighbours', () => {
    const previewAt = dialogSource.indexOf('data-testid="stroke-settings-preview-stroke-size"');
    const splineAt = dialogSource.indexOf(SPLINE_TESTID);
    const toggleAt = dialogSource.indexOf('data-testid="stroke-settings-view-toggle"');
    expect(previewAt).toBeGreaterThan(-1);
    expect(splineAt).toBeGreaterThan(previewAt);
    expect(toggleAt).toBeGreaterThan(splineAt);
  });

  it('carries the shipped 22x22 header chrome and no laid-out text', () => {
    const button = regionOf(dialogSource, SPLINE_START, SPLINE_END);
    expect(button).toContain(
      'class="physics-paint-stroke-settings-header-button physics-paint-stroke-settings-preview-toggle"',
    );
    // The icon is the button's ONLY child — no text node can overflow.
    expect(countOf(button, '<SplinePointer size={12} aria-hidden="true" />')).toBe(1);
    expect(button).not.toMatch(/>\s*Edit path\s*</);
    expect(button).not.toContain('{PATH_EDIT_LABEL}');
  });

  it('binds aria-pressed, the fixed aria-label and the gate title', () => {
    const button = regionOf(dialogSource, SPLINE_START, SPLINE_END);
    expect(button).toContain('aria-pressed={pathEditGate.pressed}');
    expect(button).toContain('aria-label="Edit path"');
    expect(button).toContain('title={pathEditGate.title}');
    expect(button).toContain('disabled={!pathEditGate.enabled}');
  });

  it('stops the press so the drag-handle header never swallows the click', () => {
    const button = regionOf(dialogSource, SPLINE_START, SPLINE_END);
    expect(button).toContain('onPointerDown={(event) => event.stopPropagation()}');
  });

  it('enters and leaves path edit through the session actions only', () => {
    const button = regionOf(dialogSource, SPLINE_START, SPLINE_END);
    expect(button).toContain('exitPathEdit();');
    expect(button).toContain('enterPathEdit(String(target));');
    // Session actions only: the button never touches the record seam or engine.
    expect(button).not.toContain('getRecordedAquarelleStroke');
    expect(button).not.toContain('beginAquarellePathEdit');
    // The exact session-action surface: `exitPathEdit` owns the anchor-selection
    // clear (no second clearing action), and the Anchor width block reads the
    // overlay's ONE anchor-selection signal.
    expect(dialogSource).toContain(
      "import { enterPathEdit, exitPathEdit, pathEditMutationId, vectorAnchorSelection } from './vectorPathSession';",
    );
  });

  it('declares the two disabled reasons verbatim in the model', () => {
    expect(modelSource).toContain(
      "export const PATH_EDIT_SINGLE_DISABLED_REASON = 'Edit path — select one vector stroke';",
    );
    expect(modelSource).toContain(
      "export const PATH_EDIT_MULTI_DISABLED_REASON = 'Edit path — select a single vector stroke';",
    );
    // The gate is the ONE place the reasons are chosen; title never inlines copy.
    const gate = regionOf(modelSource, 'export function resolvePathEditGate(', '\n}');
    expect(gate).toContain('PATH_EDIT_SINGLE_DISABLED_REASON');
    expect(gate).toContain('PATH_EDIT_MULTI_DISABLED_REASON');
  });

  it('cannot strand the user: close and a closed gate both exit path edit', () => {
    // The explicit close handler ends the edit.
    const closeHandler = regionOf(dialogSource, 'const closeSurface = useCallback(', '}, [closeMoveMode]);');
    expect(closeHandler).toContain('exitPathEdit();');
    // The render-body guard is a PLAIN module marker — never a signal write.
    expect(dialogSource).toContain('let pathEditExitRequested = false;');
    const guard = regionOf(dialogSource, 'const pathEditActive = pathEditMutationId.value !== null;', 'const effectiveRequest');
    expect(guard).toContain('shouldExitPathEdit({');
    expect(guard).toContain('pathEditExitRequested = true;');
    expect(guard).not.toContain('exitPathEdit(');
    // The shipped lifecycle effect consumes the marker (no NEW useEffect).
    expect(countOf(dialogSource, 'useEffect(')).toBe(2);
    const lifecycle = regionOf(dialogSource, 'const wasOpen = wasOpenRef.current;', '}, [open, bundle, pathEditGateEnabled]);');
    expect(lifecycle).toContain('pathEditExitRequested = false;');
    expect(lifecycle).toContain('exitPathEdit();');
  });
});

// ============================================================
//  61-11 Task 3 — close the E2 and E4 UI-consideration rows.
//
//  Row ledger (every applicable row this plan carries):
//    E2 loading      — dismissed: the selection read is synchronous; the
//                      disabled state is immediate, no skeleton exists.
//    E2 error        -> pinned below (0.4 opacity + the reason in `title`).
//    E2 overflow     -> pinned below (shipped 22x22 CSS geometry, no text).
//    E2 long-text    -> pinned below (native `title`, zero rendered text).
//    E4 empty        -> pinned below (disabled at 1.0 + the exact caption).
//    E4 loading      — dismissed: factors are read synchronously.
//    E4 error        -> pinned in both files (clamp both ends, no error UI).
//    E4 partial      -> pinned in the model test (Mixed + per-anchor factors).
//    E4 overflow     -> pinned below (shipped SliderStepper, fixed gutter).
//    E4 long-text    -> pinned below (constant label, numeric readout).
// ============================================================

describe('61-11 E2 rows: the Edit path disabled state', () => {
  it('E2 error: the disabled reason is the model literal and rides title only', () => {
    const button = regionOf(dialogSource, SPLINE_START, SPLINE_END);
    expect(button).toContain('title={pathEditGate.title}');
    expect(button).toContain('disabled={!pathEditGate.enabled}');
    // The 0.4 opacity is the SHIPPED disabled rule every header button wears —
    // the new button adds no state of its own.
    const disabledRule = regionOf(
      cssSource,
      '.physics-paint-stroke-settings-header-button:disabled {',
      '}',
    );
    expect(disabledRule).toContain('opacity: 0.4;');
  });

  it('E2 overflow: the shipped 22x22 chrome is fixed and the icon is the ONLY child', () => {
    const chrome = regionOf(cssSource, '.physics-paint-stroke-settings-header-button {', '}');
    expect(chrome).toContain('width: 22px;');
    expect(chrome).toContain('height: 22px;');
    expect(chrome).toContain('flex: 0 0 auto;');
    const button = regionOf(dialogSource, SPLINE_START, SPLINE_END);
    // Icon-only: the element's whole child list is the glyph, so no text node
    // can be laid out (and therefore none can overflow).
    expect(button).toMatch(/>\s*<SplinePointer size=\{12\} aria-hidden="true" \/>\s*<\/button>/);
  });

  it('E2 long-text: the reason lives in the native title, never in the DOM', () => {
    const button = regionOf(dialogSource, SPLINE_START, SPLINE_END);
    expect(button).toContain('title={pathEditGate.title}');
    expect(button).not.toContain('{PATH_EDIT_LABEL}');
    expect(button).not.toMatch(/>\s*Edit path\s*</);
    // The whole child list is the glyph — no text node exists to lay out.
    expect(button).toMatch(/>\s*<SplinePointer size=\{12\} aria-hidden="true" \/>\s*<\/button>/);
  });
});

describe('61-11 E4 rows: the Anchor width block', () => {
  const BLOCK_START = 'data-testid="stroke-settings-anchor-width"';
  const BLOCK_END = 'data-testid="stroke-settings-anchor-width-caption"';

  it('E4 empty: zero anchors selected reads 1.0, disabled, with the exact caption', () => {
    const block = regionOf(dialogSource, BLOCK_START, BLOCK_END);
    expect(block).toContain('value={anchorWidthEmpty');
    expect(block).toContain('? AQUARELLE_ANCHOR_WIDTH_DEFAULT');
    expect(block).toContain('disabled={anchorWidthEmpty}');
    // The caption and the disabled condition are the SAME branch — never a
    // caption that outlives the disabled state.
    const emptyBranch = regionOf(dialogSource, '{anchorWidthEmpty ? (', ') : null}');
    expect(emptyBranch).toContain(BLOCK_END);
    expect(emptyBranch).toContain('Select anchors on the canvas to set their width.');
    // And the empty branch is defined by the reading's count, not a size guess.
    expect(dialogSource).toContain('const anchorWidthEmpty = anchorWidthReading.count === 0;');
  });

  it('E4 error: the band is bound from the model constants and clamps, never an error UI', () => {
    const block = regionOf(dialogSource, BLOCK_START, BLOCK_END);
    expect(block).toContain('min={AQUARELLE_ANCHOR_WIDTH_MIN}');
    expect(block).toContain('max={AQUARELLE_ANCHOR_WIDTH_MAX}');
    expect(block).toContain('step={AQUARELLE_ANCHOR_WIDTH_STEP}');
    expect(block).toContain('precision={1}');
    expect(block).toContain('allowOutOfRangeEntry');
    expect(block).toContain('commitOnRelease');
    // The clamped value is the ONLY thing the handler emits.
    expect(block).toContain('anchorWidthPatchValue(value)');
    // No error surface: no invalid flag, no error text, no red on this row.
    expect(block).not.toContain('ariaInvalid');
    expect(block).not.toContain('MIXED_CAPTION_STYLE');
    // The constants themselves are the shipped D-09 band.
    expect(AQUARELLE_ANCHOR_WIDTH_MIN).toBe(0.2);
    expect(AQUARELLE_ANCHOR_WIDTH_MAX).toBe(2);
    expect(AQUARELLE_ANCHOR_WIDTH_STEP).toBe(0.1);
    expect(AQUARELLE_ANCHOR_WIDTH_DEFAULT).toBe(1);
  });

  it('E4 partial: the shipped mixed prop is bound from the reading', () => {
    const block = regionOf(dialogSource, BLOCK_START, BLOCK_END);
    expect(block).toContain('mixed={anchorWidthReading.mixed}');
    // Mixed is SliderStepper's shipped red italic caption — this row adds no
    // second Mixed copy of its own.
    expect(block).not.toContain('Mixed');
  });

  it('E4 overflow: the shipped SliderStepper owns the fixed gutter', () => {
    const block = regionOf(dialogSource, BLOCK_START, BLOCK_END);
    expect(block).toContain('<SliderStepper');
    // No bespoke control, no width style: the shared 46x17 value box and the
    // fixed label column are the shipped geometry.
    expect(block).not.toContain('style=');
    expect(block).not.toContain('width:');
  });

  it('E4 long-text: the label is constant and the readout is numeric', () => {
    const block = regionOf(dialogSource, BLOCK_START, BLOCK_END);
    expect(block).toContain('label="Anchor width"');
    expect(block).toContain('ariaLabel="Anchor width"');
    expect(block).toContain('`→ ${anchorWidthEffectivePx(reading.value, anchorWidthReading.value)} px`');
  });

  it('mounts under the Size row and is NOT an appearance-field registry entry', () => {
    // The registry is the appearance field list; the width factor is not one of
    // its params (it belongs to the anchors, not to `params`).
    expect(WATERCOLOR_SETTINGS_FIELDS.map((field) => field.key)).not.toContain('anchorWidth');
    const gateAt = dialogSource.indexOf(
      "if (field.key !== 'size' || !anchorWidthAvailable) return row;",
    );
    const blockAt = dialogSource.indexOf(BLOCK_START);
    expect(gateAt).toBeGreaterThan(-1);
    expect(blockAt).toBeGreaterThan(gateAt);
    // The block commits through the anchor seam, never the appearance patch.
    const block = regionOf(dialogSource, BLOCK_START, BLOCK_END);
    expect(block).toContain('bundle.applyAnchorWidths?.(');
    expect(block).not.toContain('buildAppearancePatch');
    expect(block).not.toContain('readNumericField');
  });
});
