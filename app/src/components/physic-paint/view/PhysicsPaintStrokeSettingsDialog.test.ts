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
  ANCHOR_WIDTH_EMPTY_READING,
  ANCHOR_WIDTH_NO_EDIT_REASON,
  AQUARELLE_ANCHOR_WIDTH_DEFAULT,
  AQUARELLE_ANCHOR_WIDTH_MAX,
  AQUARELLE_ANCHOR_WIDTH_MIN,
  AQUARELLE_ANCHOR_WIDTH_STEP,
  CURVE_MODE_OPTIONS,
  RENDER_MODE_OPTIONS,
  SIMPLE_RIBBON_GLOBALS,
  SIMPLE_RIBBON_WET_NOTE,
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
    // 61-27 (WR-04): the dependency tail gained the target-mismatch marker, so
    // this shipped end marker was repointed at the new array (nothing else in
    // the region changed).
    const lifecycle = regionOf(dialogSource, 'const wasOpen = wasOpenRef.current;', '}, [open, bundle, pathEditGateEnabled, pathEditTargetMismatch]);');
    expect(lifecycle).toContain('pathEditExitRequested = false;');
    expect(lifecycle).toContain('exitPathEdit();');
  });
});

// ============================================================
//  61-27 (WR-04) — the exit is TARGET-AWARE.
//
//  The shipped exit predicate only asked "is the gate closed". A one-stroke
//  selection keeps the gate ENABLED, so an open edit on stroke A survived a
//  click on stroke B: the sheet showed B while every canvas drag still wrote
//  A's anchors. The render body now computes the target mismatch and the
//  shipped lifecycle effect gains it as a dependency, so the marker reaches
//  the ONE performer whenever the two ids disagree.
// ============================================================

describe('61-27 WR-04 — selecting another stroke closes the open path edit', () => {
  const GUARD_START = 'const pathEditActive = pathEditMutationId.value !== null;';
  const GUARD_END = 'const effectiveRequest';

  function guardRegion(): string {
    return regionOf(dialogSource, GUARD_START, GUARD_END);
  }

  it('computes the target-mismatch marker in the render body, never a session write', () => {
    const guard = guardRegion();
    expect(guard).toContain('const pathEditTargetMismatch =');
    expect(guard).toContain('pathEditExitRequested = true;');
    expect(guard).not.toContain('exitPathEdit(');
  });

  it('passes both ids to the target-aware exit predicate', () => {
    const guard = guardRegion();
    expect(guard).toContain('shouldExitPathEdit({');
    expect(guard).toContain('selectedMutationId,');
    expect(guard).toContain('pathEditMutationId: pathEditMutationId.value,');
  });

  it('rides the shipped lifecycle effect through the mismatch dependency', () => {
    const lifecycle = regionOf(
      dialogSource,
      'const wasOpen = wasOpenRef.current;',
      '}, [open, bundle, pathEditGateEnabled, pathEditTargetMismatch]);',
    );
    expect(lifecycle).toContain('pathEditExitRequested = false;');
    expect(lifecycle).toContain('exitPathEdit();');
    // Still the ONE shipped effect: the exit added no third useEffect.
    expect(countOf(dialogSource, 'useEffect(')).toBe(2);
  });
});

// ============================================================
//  61-27 (IN-03) — a refused Anchor width commit says so.
//
//  `void bundle.applyAnchorWidths?.(...)` discarded the boolean, so a refusal
//  (wrong target, missing stroke, in-flight lock) was indistinguishable from a
//  success: the knob snapped back with no explanation. The commit now consumes
//  the result and publishes the ONE refusal line through the bundle's optional
//  `publishRefusal` port — absent stays silent, exactly as shipped.
// ============================================================

describe('61-27 IN-03 — a refused Anchor width commit publishes its refusal', () => {
  const CONTROL_START = 'function AnchorWidthControl(props: AnchorWidthControlProps) {';
  const CONTROL_END = 'data-testid="stroke-settings-anchor-width-caption"';

  function anchorWidthRegion(): string {
    return regionOf(dialogSource, CONTROL_START, CONTROL_END);
  }

  it('consumes the commit result and publishes only on an exact false', () => {
    const block = anchorWidthRegion();
    expect(block).toContain('Promise.resolve(bundle.applyAnchorWidths?.(');
    expect(block).toContain('.then((applied) => {');
    const guardAt = block.indexOf('if (applied === false)');
    expect(guardAt, 'the refusal branch is missing').toBeGreaterThan(-1);
    const publishAt = block.indexOf('bundle.publishRefusal?.(ANCHOR_WIDTH_COMMIT_REFUSED_MESSAGE);');
    expect(publishAt, 'the refusal is not published').toBeGreaterThan(guardAt);
    // The dialog is engine-free: the refusal leaves through the bundle port,
    // never through a Studio signal write.
    expect(block).not.toContain('setApplyMessage');
    expect(block).not.toContain('setApplyStatus');
    expect(block).not.toContain('setLastError');
  });

  it('stays silent when the port is absent, and the empty caption and readout are untouched', () => {
    const block = anchorWidthRegion();
    // The optional call IS the shipped silent fallback: no port, no throw.
    expect(block).toContain('bundle.publishRefusal?.(');
    expect(block).not.toContain('bundle.publishRefusal(');
    // The per-vertex readout and the empty-selection caption are unchanged.
    expect(block).toContain('data-testid="stroke-settings-anchor-width-readout"');
    expect(block).toContain('`→ ${anchorWidthEffectivePx(reading.value, anchorWidthReading.value)} px`');
    expect(dialogSource).toContain('? ANCHOR_WIDTH_NO_EDIT_REASON');
    expect(dialogSource).toContain("'Select anchors on the canvas to set their width.'");
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
    // 61-25 (UI-02): the ONE declared style in the region is the readout
    // span's constant — no bespoke geometry, and the shared 46x17 value box
    // and fixed label column still own the gutter.
    expect(countOf(block, 'style=')).toBe(1);
    expect(block).toContain('style={ANCHOR_WIDTH_READOUT_STYLE}');
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

  // ── 61-19 (G-5): the inert state must state WHY it is inert ─────────

  it('61-19 inert: no open path edit reads empty and one caption span serves both reasons', () => {
    const block = regionOf(dialogSource, BLOCK_START, BLOCK_END);
    expect(block).toContain('disabled={anchorWidthEmpty}');
    const emptyBranch = regionOf(dialogSource, '{anchorWidthEmpty ? (', ') : null}');
    // The span references the constant by NAME (the value is asserted in the
    // inert-cause case below); the shipped empty copy stays in the same span.
    expect(emptyBranch).toContain('ANCHOR_WIDTH_NO_EDIT_REASON');
    expect(emptyBranch).toContain('Select anchors on the canvas to set their width.');
  });

  it('61-19 inert cause: the reading is shadowed by the resolved target, never guessed', () => {
    expect(dialogSource).toContain('resolveAnchorWidthTarget({');
    expect(dialogSource).toContain('pathEditMutationId: pathEditMutationId.value');
    expect(dialogSource).toContain('anchorWidthTarget === null');
    expect(dialogSource).toContain('ANCHOR_WIDTH_EMPTY_READING');
    expect(dialogSource).toContain('readAnchorWidthReading(');
    // The two model constants are the ones the block branches on.
    expect(ANCHOR_WIDTH_EMPTY_READING).toEqual({
      value: AQUARELLE_ANCHOR_WIDTH_DEFAULT,
      mixed: false,
      count: 0,
    });
    expect(ANCHOR_WIDTH_NO_EDIT_REASON).toBe('Open Edit path on this stroke to set anchor widths.');
  });

  it('61-19 live: the shipped commit call and clamp are untouched, and no local writer exists', () => {
    const block = regionOf(dialogSource, BLOCK_START, BLOCK_END);
    // 61-27 (IN-03): the shipped call keeps its ONE commit seam and its
    // patch helper; the continuation now consumes the result. Repointed from
    // the bare `void bundle.applyAnchorWidths?.(` literal, never dropped.
    expect(block).toContain('void Promise.resolve(bundle.applyAnchorWidths?.(');
    expect(block).toContain('anchorWidthPatchValue(value)');
    expect(block).not.toContain('beginAquarellePathEdit');
  });

  it('61-19 no new surface: one stepper, and the caption testid still precedes its style', () => {
    const block = regionOf(dialogSource, BLOCK_START, BLOCK_END);
    expect(countOf(block, '<SliderStepper')).toBe(1);
    // 61-25 (UI-02): exactly one style — the declared readout constant.
    expect(countOf(block, 'style=')).toBe(1);
    expect(block).toContain('style={ANCHOR_WIDTH_READOUT_STYLE}');
    // The testid must stay BEFORE the style attribute: the shipped region pin
    // ends at the testid, which is what keeps the block's no-`style=` pin true.
    const caption = regionOf(dialogSource, BLOCK_END, '</span>');
    expect(caption).toContain('style={ANCHOR_WIDTH_CAPTION_STYLE}');
  });
});

// ============================================================
//  61-12 Task 1 — the Render row (VEC-04 / E3).
//
//  Row ledger:
//    E3 partial   — pinned below: the shipped red italic `Mixed` beside the
//                   label, never a third "mixed" segment.
//    E3 overflow  — pinned below: two constant labels in the shipped segment
//                   row inside the fixed 520px sheet.
//    E3 long-text — pinned below: model constants only, zero interpolation, so
//                   no user-supplied text can reach the row.
//
//  The mode is a STROKE property (D-12/D-14): the mount path never consults
//  anchors, so a hand-painted selection still gets the row, and the shipped
//  Eraser rule still closes the whole Paint tab (and therefore the row).
// ============================================================

describe('61-12 Render row (E3)', () => {
  const BLOCK_START = 'data-testid="stroke-settings-render-mode-block"';
  const GROUP = 'data-testid="stroke-settings-render-mode"';
  const NEXT_ROW = 'data-testid="stroke-settings-color"';

  function renderBlock(): string {
    return regionOf(dialogSource, BLOCK_START, NEXT_ROW);
  }

  it('mounts exactly one Render block as the FIRST row of the Paint tab', () => {
    expect(countOf(dialogSource, BLOCK_START)).toBe(1);
    expect(countOf(dialogSource, GROUP)).toBe(1);
    const paintAt = dialogSource.indexOf('data-testid="stroke-settings-paint"');
    const blockAt = dialogSource.indexOf(BLOCK_START);
    const colorLabelAt = dialogSource.indexOf('<span style={PAINT_ROW_LABEL_STYLE}>Color</span>');
    const colorAt = dialogSource.indexOf(NEXT_ROW);
    expect(paintAt).toBeGreaterThan(-1);
    expect(blockAt, 'the Render row mounts inside the Paint tab').toBeGreaterThan(paintAt);
    expect(colorLabelAt, 'the Render row precedes the Color label').toBeGreaterThan(blockAt);
    expect(colorAt, 'the Render row precedes the Color row').toBeGreaterThan(colorLabelAt);
  });

  it('offers exactly the two option ids, both from the model constants', () => {
    const block = renderBlock();
    expect(block).toContain('RENDER_MODE_OPTIONS.map((option) => {');
    expect(block).toContain('data-testid={`stroke-settings-render-mode-option-${option.id}`}');
    expect(block).toContain('{option.label}');
    // ONE template test id — the two ids come from the two model options.
    expect(countOf(dialogSource, 'stroke-settings-render-mode-option-')).toBe(1);
    expect(RENDER_MODE_OPTIONS.map((option) => option.id)).toEqual(['watercolor', 'ribbon']);
    expect(RENDER_MODE_OPTIONS.map((option) => option.label)).toEqual(['Watercolor', 'Ribbon']);
  });

  it('binds the group label, the row label and the shipped Mixed caption', () => {
    const block = renderBlock();
    expect(block).toContain('role="group"');
    expect(block).toContain('aria-label="Render"');
    expect(block).toContain('<span style={PAINT_ROW_LABEL_STYLE}>Render</span>');
    expect(block).toContain('style={MIXED_CAPTION_STYLE}');
    // The caption is the single word, never a value or a second sentence.
    expect(block).toMatch(/>\s*Mixed\s*<\/span>/);
  });

  it('marks an option active only for the selection mode and skips the active press', () => {
    const block = renderBlock();
    expect(block).toContain(
      'const active = !renderModeReading.mixed && renderModeReading.mode === option.mode;',
    );
    expect(block).toContain('aria-pressed={active}');
    // Pressing the mode the selection already holds writes nothing.
    expect(block).toContain('if (active) return;');
    expect(block).toContain('void bundle.applyRenderMode?.(ids, option.mode);');
  });

  it('is gated on the Paint tab and the watercolor module, never on anchors', () => {
    const block = renderBlock();
    // D-12/D-14: the row is a stroke property, so no anchor read can gate it.
    expect(block).not.toContain('readVectorAnchors');
    expect(block).not.toContain('anchorWidth');
    // The module gate is the nearest gate BEFORE the block and sits inside the
    // Paint-tab section (so the Eraser filter that closes the tab closes it).
    const paintAt = dialogSource.indexOf('data-testid="stroke-settings-paint"');
    const blockAt = dialogSource.indexOf(BLOCK_START);
    const mountAt = dialogSource.lastIndexOf("engineModule === 'watercolor' ? (", blockAt);
    expect(mountAt).toBeGreaterThan(paintAt);
    // The Eraser rule that closes the tab (and therefore the row) is unchanged.
    expect(dialogSource).toContain(
      "const paintTabAvailable = strokeTypeFilter !== 'lift' && !selectionHasLift;",
    );
  });

  it('never routes the mode through the numeric field path', () => {
    const block = renderBlock();
    expect(block).not.toContain('readNumericField');
    expect(block).not.toContain('buildAppearancePatch');
    expect(block).not.toContain('segmentedFields');
    expect(WATERCOLOR_SETTINGS_FIELDS.map((field) => field.key)).not.toContain('renderMode');
  });
});

// ============================================================
//  61-31 (G-20) — the Curve row: the per-selection Bezier /
//  Spline switch. Spline is an EVALUATION MODE over the same
//  anchors, so the row mounts only when the selection holds a
//  vector stroke and the bundle can commit — a hand-painted-only
//  selection hides it instead of writing an inert key.
// ============================================================

describe('61-31 Curve row (G-20)', () => {
  const BLOCK_START = 'data-testid="stroke-settings-curve-mode-block"';
  const GROUP = 'data-testid="stroke-settings-curve-mode"';

  function curveBlock(): string {
    return regionOf(dialogSource, BLOCK_START, 'data-testid="stroke-settings-color"');
  }

  it('mounts the Curve block only when a vector stroke is selected and the bundle can commit', () => {
    expect(countOf(dialogSource, BLOCK_START)).toBe(1);
    expect(countOf(dialogSource, GROUP)).toBe(1);
    // The reading is a render-body projection of the hydrated appearances.
    expect(dialogSource).toContain('const curveModeReading = readCurveMode(appearances);');
    // The mount gate: watercolor engine + a vector stroke + a commit seam.
    expect(dialogSource).toContain(
      "{engineModule === 'watercolor' && curveModeReading.available && bundle.applyCurveMode !== undefined ? (",
    );
    // Immediately AFTER the Render block and BEFORE the Color row.
    const renderAt = dialogSource.indexOf('data-testid="stroke-settings-render-mode-block"');
    const curveAt = dialogSource.indexOf(BLOCK_START);
    const colorAt = dialogSource.indexOf('data-testid="stroke-settings-color"');
    expect(renderAt).toBeGreaterThan(-1);
    expect(curveAt).toBeGreaterThan(renderAt);
    expect(colorAt).toBeGreaterThan(curveAt);
  });

  it('renders one button per model option, lit only for the agreed mode', () => {
    const block = curveBlock();
    expect(block).toContain('CURVE_MODE_OPTIONS.map((option) => {');
    expect(block).toContain('data-testid={`stroke-settings-curve-mode-option-${option.id}`}');
    expect(block).toContain('aria-pressed={active}');
    expect(block).toContain('{option.label}');
    // ONE template test id — the two ids come from the two model options.
    expect(countOf(dialogSource, 'stroke-settings-curve-mode-option-')).toBe(1);
    expect(CURVE_MODE_OPTIONS.map((option) => option.id)).toEqual(['bezier', 'spline']);
    expect(CURVE_MODE_OPTIONS.map((option) => option.label)).toEqual(['Bézier', 'Spline']);
    // The agreed mode is the only lit option; a mixed reading lights none.
    expect(block).toContain(
      'const active = !curveModeReading.mixed && curveModeReading.mode === option.mode;',
    );
  });

  it('renders the shipped Mixed caption when the vector strokes disagree', () => {
    const block = curveBlock();
    expect(block).toContain('data-testid="stroke-settings-curve-mode-mixed"');
    expect(block).toContain('style={MIXED_CAPTION_STYLE}');
    expect(block).toMatch(/>\s*Mixed\s*<\/span>/);
    // Mixed means NO lit option — the active expression already refuses it.
    expect(block).toContain('!curveModeReading.mixed &&');
  });

  it('calls the bundle once for the other mode and never for the active one', () => {
    const block = curveBlock();
    // Pressing the mode the selection already holds writes nothing.
    expect(block).toContain('if (active) return;');
    expect(block).toContain('void bundle.applyCurveMode?.(ids, option.mode);');
    // ONE call site in the whole source.
    expect(countOf(dialogSource, 'bundle.applyCurveMode?.(')).toBe(1);
    // A stroke-level mode: no numeric path and no anchor read can gate it.
    expect(block).not.toContain('readVectorAnchors');
    expect(block).not.toContain('anchorWidth');
    expect(block).not.toContain('readNumericField');
  });
});

// ── 61-12 Task 3: the Advanced wet-globals disclosure (D-13 / E5) ────

describe('61-12 Advanced wet-globals disclosure (E5)', () => {
  const BLOCK = 'data-testid="stroke-settings-advanced-wet-globals-block"';
  const ROW = 'data-testid="stroke-settings-advanced-wet-globals"';
  const BODY = 'data-testid="stroke-settings-advanced-wet-globals-body"';
  const NOTE = 'data-testid="stroke-settings-advanced-wet-globals-note"';
  // The block's own close: the paint section's final `</div>` and its
  // `) : null}` — indented less than any closer inside the block.
  const BLOCK_END = '\n            </div>\n          ) : null}';

  function disclosureBlock(): string {
    return regionOf(dialogSource, BLOCK, BLOCK_END);
  }

  it('mounts exactly one collapsed disclosure after the numeric field map', () => {
    expect(countOf(dialogSource, BLOCK)).toBe(1);
    expect(countOf(dialogSource, ROW)).toBe(1);
    expect(countOf(dialogSource, BODY)).toBe(1);
    expect(countOf(dialogSource, NOTE)).toBe(1);

    const paintAt = dialogSource.indexOf('data-testid="stroke-settings-paint"');
    const numericAt = dialogSource.indexOf('{numericFields.map((field) => {');
    const blockAt = dialogSource.indexOf(BLOCK);
    expect(paintAt).toBeGreaterThan(-1);
    expect(numericAt).toBeGreaterThan(paintAt);
    expect(blockAt, 'the disclosure mounts inside the Paint tab').toBeGreaterThan(paintAt);
    expect(blockAt, 'the disclosure sits after the last numeric field').toBeGreaterThan(numericAt);

    // Collapsed by default: the local signal starts false and the body is
    // behind the open branch only.
    expect(dialogSource).toContain(
      'if (!advancedWetOpenRef.current) advancedWetOpenRef.current = signal<boolean>(false);',
    );
    expect(disclosureBlock()).toContain('{advancedWetOpen ? (');
    // Local view state only — no effect, no engine call (T-61-43).
    expect(countOf(dialogSource, 'useEffect(')).toBe(2);
  });

  it('is a simple-ribbon presentation only — watercolor mode mounts nothing', () => {
    const block = disclosureBlock();
    // The mount gate is the NEAREST gate before the block (the block test id
    // is inside the gate's JSX, so the gate line itself is outside the slice).
    const blockAt = dialogSource.indexOf(BLOCK);
    const gateAt = dialogSource.lastIndexOf(
      "engineModule === 'watercolor' && renderModeReading.mode === 'simple-ribbon' ? (",
      blockAt,
    );
    expect(gateAt).toBeGreaterThan(-1);
    expect(blockAt - gateAt).toBeLessThan(200);
    // A mixed selection reads mode null, so it mounts nothing either.
    expect(block).not.toContain('renderModeReading.mixed');
    // The seven rows are ADDITIONAL: the shared field map is untouched.
    expect(block).not.toContain('numericFields');
    expect(block).not.toContain('segmentedFields');
    expect(block).not.toContain("field.key === 'size'");
  });

  it('binds aria-expanded and swaps the two 12px chevrons', () => {
    const block = disclosureBlock();
    expect(block).toContain('aria-expanded={advancedWetOpen}');
    expect(block).toContain('<ChevronDown size={12} aria-hidden="true" />');
    expect(block).toContain('<ChevronRight size={12} aria-hidden="true" />');
    // Open ⇒ ChevronDown, collapsed ⇒ ChevronRight.
    expect(block.indexOf('<ChevronDown')).toBeGreaterThan(-1);
    expect(block.indexOf('<ChevronDown')).toBeLessThan(block.indexOf('<ChevronRight'));
    const rowStyle = regionOf(dialogSource, 'const ADVANCED_ROW_STYLE', '};');
    expect(rowStyle).toContain("height: '24px'");
    expect(block).toContain('<span style={PAINT_ROW_LABEL_STYLE}>Advanced — wet globals</span>');
  });

  it('maps the seven model rows to one SliderStepper each, committing per stroke', () => {
    const block = disclosureBlock();
    expect(block).toContain('{SIMPLE_RIBBON_GLOBALS.map((field) => {');
    expect(block).toContain('const reading = readSimpleRibbonGlobal(appearances, field.key);');
    // ONE template row: the seven rows come from the model list.
    expect(countOf(block, '<SliderStepper')).toBe(1);
    expect(block).toContain('mixed={reading.mixed}');
    expect(block).toContain(
      "buildAppearancePatch('watercolor', field.key, value)",
    );
    expect(block).toContain('void bundle.applyAppearance(');
    // Exactly seven rows, and Size is not one of them.
    expect(SIMPLE_RIBBON_GLOBALS).toHaveLength(7);
    expect(SIMPLE_RIBBON_GLOBALS.map((field) => field.label)).not.toContain('Size');
  });

  it('renders the UI-SPEC note verbatim in one line-height 1.5 element', () => {
    const block = disclosureBlock();
    expect(block).toContain('{SIMPLE_RIBBON_WET_NOTE}');
    // One fixed sentence — never interpolated with a value.
    expect(block).not.toMatch(/\$\{SIMPLE_RIBBON_WET_NOTE\}/);
    expect(SIMPLE_RIBBON_WET_NOTE).toBe(
      'All seven sit at zero for a plain ribbon. Raise any to blend physics back in.',
    );
    const noteStyle = regionOf(dialogSource, 'const ADVANCED_WET_NOTE_STYLE', '};');
    expect(noteStyle).toContain('lineHeight: 1.5');
  });
});

// ============================================================
//  61-22 (G-11) — the Anchor width control reaches the DEFAULT list view.
//
//  The control was correct but discoverable only through the header sliders
//  icon and the SETTINGS view. The fix extracts ONE internal component and
//  mounts it twice: under Size in the Paint tab (the shipped position) and in
//  the list view for exactly one selected vector stroke. The gate reuses
//  `anchorWidthAvailable`, so a multi-selection or an anchorless stroke mounts
//  nothing (T-61-68). The component is DECLARED after the sheet component so
//  the shipped `blockAt > gateAt` region pin keeps its meaning.
// ============================================================

describe('61-22 G-11 — the Anchor width control in the list view', () => {
  const LIST_WRAPPER = 'data-testid="stroke-settings-list-anchor-width"';
  const BLOCK_START = 'data-testid="stroke-settings-anchor-width"';
  const BLOCK_END = 'data-testid="stroke-settings-anchor-width-caption"';
  const GATE = "if (field.key !== 'size' || !anchorWidthAvailable) return row;";

  it('mounts the control in the default list view behind anchorWidthListVisible', () => {
    // ONE conditional wrapper: an invisible control leaves no empty node.
    expect(countOf(dialogSource, LIST_WRAPPER)).toBe(1);
    const mount = regionOf(dialogSource, '{anchorWidthListVisible', ') : null}');
    expect(mount).toContain(LIST_WRAPPER);
    expect(mount).toContain('<AnchorWidthControl');
    // Ordered after the stroke rows, inside the list container.
    const listAt = dialogSource.indexOf('data-testid="stroke-settings-list"');
    const rowsAt = dialogSource.indexOf('listRows.map((stroke, index) => {');
    const mountAt = dialogSource.indexOf(LIST_WRAPPER);
    expect(listAt).toBeGreaterThan(-1);
    expect(rowsAt).toBeGreaterThan(listAt);
    expect(mountAt).toBeGreaterThan(rowsAt);
  });

  it('shares ONE component between the two mounts', () => {
    expect(countOf(dialogSource, '<AnchorWidthControl')).toBe(2);
    expect(countOf(dialogSource, 'function AnchorWidthControl(')).toBe(1);
    // ONE root block: the list mount wraps the same component and never
    // re-declares the `stroke-settings-anchor-width` element.
    expect(countOf(dialogSource, '<div data-testid="stroke-settings-anchor-width">')).toBe(1);
    // The Paint-tab mount replaces the inline block at the shipped gate.
    const gateAt = dialogSource.indexOf(GATE);
    expect(gateAt).toBeGreaterThan(-1);
    expect(dialogSource.indexOf('<AnchorWidthControl', gateAt)).toBeGreaterThan(gateAt);
  });

  it('keeps every shipped E4 identifier inside the component body', () => {
    const component = regionOf(
      dialogSource,
      'function AnchorWidthControl(',
      'export const MemoizedPhysicsPaintStrokeSettingsDialog',
    );
    expect(component).toContain('const anchorWidthEmpty = anchorWidthReading.count === 0;');
    expect(component).toContain('mixed={anchorWidthReading.mixed}');
    // 61-27 (IN-03): same commit seam, now with its result consumed. Repointed
    // from the bare `void bundle.applyAnchorWidths?.(` literal, never dropped.
    expect(component).toContain('void Promise.resolve(bundle.applyAnchorWidths?.(');
    expect(component).toContain('anchorWidthPatchValue(value)');
    expect(component).toContain(
      '`→ ${anchorWidthEffectivePx(reading.value, anchorWidthReading.value)} px`',
    );
    expect(component).toContain('label="Anchor width"');
    expect(component).toContain('ariaLabel="Anchor width"');
    expect(component).toContain('ANCHOR_WIDTH_CAPTION_STYLE');
    // The shipped region still holds exactly one stepper and no style attribute.
    const block = regionOf(dialogSource, BLOCK_START, BLOCK_END);
    expect(countOf(block, '<SliderStepper')).toBe(1);
    // 61-25 (UI-02): exactly one style — the declared readout constant.
    expect(countOf(block, 'style=')).toBe(1);
    expect(block).toContain('style={ANCHOR_WIDTH_READOUT_STYLE}');
  });

  it('declares the component AFTER the Paint-tab gate', () => {
    const gateAt = dialogSource.indexOf(GATE);
    const declarationAt = dialogSource.indexOf('function AnchorWidthControl(');
    expect(gateAt).toBeGreaterThan(-1);
    expect(declarationAt).toBeGreaterThan(gateAt);
    // The shipped `blockAt > gateAt` ordering pin resolves the FIRST block
    // occurrence — the component body — so it must stay after the gate too.
    expect(dialogSource.indexOf(BLOCK_START)).toBeGreaterThan(gateAt);
  });

  it('feeds the list-view mount the Size reading of the SAME ids', () => {
    expect(dialogSource).toContain(
      "const anchorWidthSizeField = numericFields.find((field) => field.key === 'size');",
    );
    expect(dialogSource).toContain(
      'const anchorWidthSizeReading = anchorWidthSizeField === undefined',
    );
    expect(dialogSource).toContain('readNumericField(appearances, ids, anchorWidthSizeField)');
    expect(dialogSource).toContain(
      'const anchorWidthListVisible = anchorWidthAvailable && anchorWidthSizeReading !== null;',
    );
    const mount = regionOf(dialogSource, '{anchorWidthListVisible', ') : null}');
    expect(mount).toContain('reading={anchorWidthSizeReading}');
  });
});

// ============================================================
//  61-25 (UI-02 / UI-05) — the declared typography.
//
//  The `→ n px` readout rendered as a bare string and inherited the sheet's
//  body type; the two explanation strings set no weight. The fix reuses the
//  `BrushResponsePanel` multiplier grammar for the readout and pins both
//  explanations at 600 — the italic red `Mixed` stays the only 400.
// ============================================================

describe('61-25 UI-02/UI-05 — the declared readout and explanation weights', () => {
  const BLOCK_START = 'data-testid="stroke-settings-anchor-width"';
  const BLOCK_END = 'data-testid="stroke-settings-anchor-width-caption"';

  it('renders the readout inside the declared span and nothing beyond the four properties', () => {
    // The span is the `below` slot's only child and carries the SAME template.
    const readout = regionOf(
      dialogSource,
      'data-testid="stroke-settings-anchor-width-readout"',
      '</span>',
    );
    expect(readout).toContain('style={ANCHOR_WIDTH_READOUT_STYLE}');
    expect(readout).toContain(
      '`→ ${anchorWidthEffectivePx(reading.value, anchorWidthReading.value)} px`',
    );
    // Empty still mounts no readout: the null branch stays `undefined`.
    expect(dialogSource).toContain('below={anchorWidthEmpty');
    expect(dialogSource).toContain('? undefined');

    // The constant IS the BrushResponsePanel multiplier grammar — four
    // declared properties, in that order, and nothing else.
    const styleBlock = regionOf(dialogSource, 'const ANCHOR_WIDTH_READOUT_STYLE', '};');
    const keys = [...styleBlock.matchAll(/^\s{2}([A-Za-z]+):/gm)].map((match) => match[1]);
    expect(keys).toEqual(['fontSize', 'fontWeight', 'color', 'fontVariantNumeric']);
    expect(styleBlock).toContain("fontSize: '10px'");
    expect(styleBlock).toContain('fontWeight: 600');
    expect(styleBlock).toContain("color: 'var(--sidebar-text-secondary, #9aa5b1)'");
    expect(styleBlock).toContain("fontVariantNumeric: 'tabular-nums'");
  });

  it('keeps exactly the one declared style in the E4 region, and still no fixed width', () => {
    const block = regionOf(dialogSource, BLOCK_START, BLOCK_END);
    expect(countOf(block, 'style=')).toBe(1);
    expect(block).toContain('style={ANCHOR_WIDTH_READOUT_STYLE}');
    expect(block).not.toContain('width:');
  });

  it('sets both explanation strings at 600 — the italic red Mixed stays the only 400', () => {
    const captionStyle = regionOf(dialogSource, 'const ANCHOR_WIDTH_CAPTION_STYLE', '};');
    expect(captionStyle).toContain('fontWeight: 600');
    expect(countOf(captionStyle, 'fontWeight:')).toBe(1);
    const noteStyle = regionOf(dialogSource, 'const ADVANCED_WET_NOTE_STYLE', '};');
    expect(noteStyle).toContain('fontWeight: 600');
    expect(countOf(noteStyle, 'fontWeight:')).toBe(1);
    // The Mixed caption declares no weight — its italic red 400 is the only
    // light text the sheet keeps.
    const mixedStyle = regionOf(dialogSource, 'const MIXED_CAPTION_STYLE', '};');
    expect(mixedStyle).not.toContain('fontWeight');
    const weights = [...dialogSource.matchAll(/fontWeight:\s*(\d+)/g)].map((match) => match[1]);
    expect(new Set(weights)).toEqual(new Set(['600']));
  });
});
