// ============================================================
//  61-11 — the Stroke settings sheet's vector surfaces.
//
//  SOURCE PINS, in the shipped `PhysicsPaintStudio.test.ts` style: the sheet
//  is a Preact leaf rendered behind the Studio's hooks runtime, so its mount
//  points, its copy and its bindings are pinned by scanning the source
//  (`src/**/*.test.ts` only — the vitest config collects no `.test.tsx`).
//
//  Task 1 pins the `Edit path` button: exactly one mount, sitting inside the
//  Draft strip before the preview-stroke-size control, carrying the shipped
//  22x22 chrome, the two disabled reasons, the aria-pressed binding and the
//  stop-propagation line that keeps its click from starting pointer work above
//  it. Task 2 pins the Anchor width block; task 3 closes the E2/E4 rows
//  (disabled reasons, empty caption, mixed, clamp, fixed geometry).
// ============================================================

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ANCHOR_WIDTH_MAX } from '@efxlab/efx-watercolor/payload';
import {
  ANCHOR_CORNER_OPTIONS,
  ANCHOR_WIDTH_EMPTY_READING,
  ANCHOR_WIDTH_NO_EDIT_REASON,
  AQUARELLE_ANCHOR_WIDTH_DEFAULT,
  AQUARELLE_ANCHOR_WIDTH_MAX,
  AQUARELLE_ANCHOR_WIDTH_MIN,
  AQUARELLE_ANCHOR_WIDTH_SLIDER_MAX,
  AQUARELLE_ANCHOR_WIDTH_STEP,
  CURVE_MODE_OPTIONS,
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
// The button's own region runs from its test id to the next strip control, so
// every attribute, handler and the icon are inside one slice.
const SPLINE_START = SPLINE_TESTID;
const SPLINE_END = 'data-testid="stroke-settings-preview-stroke-size"';

// ── Task 1: the Edit path entrance ──────────────────────────────────

describe('61-11 Edit path Draft-strip button (E2)', () => {
  it('mounts exactly one spline-pointer button in the Draft strip', () => {
    expect(countOf(dialogSource, SPLINE_TESTID)).toBe(1);
    expect(countOf(dialogSource, 'data-testid="stroke-settings-preview-stroke-size"')).toBe(1);
  });

  it('sits inside the Draft strip, before Preview stroke size', () => {
    const headerAt = dialogSource.indexOf('data-testid="stroke-settings-header"');
    const stripAt = dialogSource.indexOf('data-testid="stroke-settings-draft-row"');
    const splineAt = dialogSource.indexOf(SPLINE_TESTID);
    const previewAt = dialogSource.indexOf('data-testid="stroke-settings-preview-stroke-size"');
    const cacheAt = dialogSource.indexOf('data-testid="stroke-settings-cache-visibility"');
    expect(headerAt).toBeGreaterThan(-1);
    expect(stripAt).toBeGreaterThan(headerAt);
    expect(splineAt).toBeGreaterThan(stripAt);
    expect(previewAt).toBeGreaterThan(splineAt);
    expect(cacheAt).toBeGreaterThan(previewAt);
    // 261112-lq4: both moved controls left the header row.
    const header = dialogSource.slice(headerAt, stripAt);
    expect(header).not.toContain(SPLINE_TESTID);
    expect(header).not.toContain('data-testid="stroke-settings-preview-stroke-size"');
  });

  it('carries the shipped 22x22 header chrome and no laid-out text', () => {
    const button = regionOf(dialogSource, SPLINE_START, SPLINE_END);
    expect(button).toContain(
      'class="physics-paint-stroke-settings-header-button physics-paint-stroke-settings-preview-toggle"',
    );
    // The icon is the button's ONLY child — no text node can overflow.
    expect(countOf(button, '<SplinePointer size={16} aria-hidden="true" />')).toBe(1);
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

  it('stops the press so pointer work above never swallows the click', () => {
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
    const guard = regionOf(dialogSource, 'const pathEditActive = pathEditMutationId.value !== null;', 'const open = bundle !== null');
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
  const GUARD_END = 'const open = bundle !== null';

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
    expect(dialogSource).toContain("'Select anchors on the canvas to set their size.'");
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
    expect(button).toMatch(/>\s*<SplinePointer size=\{16\} aria-hidden="true" \/>\s*<\/button>/);
  });

  it('E2 long-text: the reason lives in the native title, never in the DOM', () => {
    const button = regionOf(dialogSource, SPLINE_START, SPLINE_END);
    expect(button).toContain('title={pathEditGate.title}');
    expect(button).not.toContain('{PATH_EDIT_LABEL}');
    expect(button).not.toMatch(/>\s*Edit path\s*</);
    // The whole child list is the glyph — no text node exists to lay out.
    expect(button).toMatch(/>\s*<SplinePointer size=\{16\} aria-hidden="true" \/>\s*<\/button>/);
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
    expect(emptyBranch).toContain('Select anchors on the canvas to set their size.');
    // And the empty branch is defined by the reading's count, not a size guess.
    expect(dialogSource).toContain('const anchorWidthEmpty = anchorWidthReading.count === 0;');
  });

  it('E4 error: the band is bound from the model constants and clamps, never an error UI', () => {
    const block = regionOf(dialogSource, BLOCK_START, BLOCK_END);
    expect(block).toContain('min={AQUARELLE_ANCHOR_WIDTH_MIN}');
    // `max` is the commit/storage ceiling; `sliderMax` (×10) is the TRACK.
    expect(block).toContain('max={AQUARELLE_ANCHOR_WIDTH_MAX}');
    expect(block).toContain('sliderMax={AQUARELLE_ANCHOR_WIDTH_SLIDER_MAX}');
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
    // quick 261112-i6d: the app ceiling is an ALIAS of the package authority.
    expect(AQUARELLE_ANCHOR_WIDTH_MAX).toBe(ANCHOR_WIDTH_MAX);
    expect(AQUARELLE_ANCHOR_WIDTH_SLIDER_MAX).toBe(10);
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
    expect(block).toContain('label="Vertex size"');
    expect(block).toContain('ariaLabel="Vertex size"');
    expect(block).toContain('`→ ${anchorWidthEffectivePx(reading.value, anchorWidthReading.value)} px`');
  });

  it('is NOT an appearance-field registry entry and its bare block stays inside the component body', () => {
    // The registry is the appearance field list; the width factor is not one of
    // its params (it belongs to the anchors, not to `params`).
    expect(WATERCOLOR_SETTINGS_FIELDS.map((field) => field.key)).not.toContain('anchorWidth');
    // quick 261111-vg4: the Paint in-map gate is gone, so the FIRST bare
    // `stroke-settings-anchor-width` occurrence must be the COMPONENT body —
    // the two mounts wrap it under their own testids.
    const declarationAt = dialogSource.indexOf('function AnchorWidthControl(');
    const blockAt = dialogSource.indexOf(BLOCK_START);
    expect(declarationAt).toBeGreaterThan(-1);
    expect(blockAt).toBeGreaterThan(declarationAt);
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
    expect(emptyBranch).toContain('Select anchors on the canvas to set their size.');
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
    expect(ANCHOR_WIDTH_NO_EDIT_REASON).toBe('Open Edit path on this stroke to set vertex sizes.');
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
describe('61-31 Curve row (G-20)', () => {
  const BLOCK_START = 'data-testid="stroke-settings-curve-mode-block"';
  const GROUP = 'data-testid="stroke-settings-curve-mode"';

  function curveBlock(): string {
    // Bounded by the NEXT Geometry row (261112-i6d's Corner block), never the
    // Stack section — a later sibling must not leak into this region.
    return regionOf(dialogSource, BLOCK_START, 'data-testid="stroke-settings-corner-block"');
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
    // 261112-lq4: the Curve section starts after the Geometry section and
    // before Stack; the Curve row sits INSIDE it, after the one Vertex size
    // mount and before the Corner block — never in the Geometry region.
    const curveAt = dialogSource.indexOf('data-testid="stroke-settings-curve"');
    const anchorWidthAt = dialogSource.indexOf('data-testid="stroke-settings-curve-anchor-width"');
    const blockAt = dialogSource.indexOf(BLOCK_START);
    const cornerAt = dialogSource.indexOf('data-testid="stroke-settings-corner-block"');
    const stackAt = dialogSource.indexOf('data-testid="stroke-settings-stack"');
    expect(curveAt).toBeGreaterThan(-1);
    expect(anchorWidthAt).toBeGreaterThan(curveAt);
    expect(blockAt).toBeGreaterThan(anchorWidthAt);
    expect(cornerAt).toBeGreaterThan(blockAt);
    expect(stackAt).toBeGreaterThan(cornerAt);
    const geometryRegion = regionOf(
      dialogSource,
      'data-testid="stroke-settings-geometry"',
      'data-testid="stroke-settings-curve"',
    );
    expect(geometryRegion).not.toContain(BLOCK_START);
    expect(geometryRegion).not.toContain('data-testid="stroke-settings-corner-block"');
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

// ============================================================
describe('261112-i6d Corner row — the per-vertex round/straight switch', () => {
  const BLOCK_START = 'data-testid="stroke-settings-corner-block"';
  const GROUP = 'data-testid="stroke-settings-corner"';

  function cornerBlock(): string {
    return regionOf(dialogSource, BLOCK_START, 'data-testid="stroke-settings-stack"');
  }

  it('mounts the Corner block inside the Curve tab, after the Curve row', () => {
    expect(countOf(dialogSource, BLOCK_START)).toBe(1);
    expect(countOf(dialogSource, GROUP)).toBe(1);
    // The reading shares the ONE path-edit target and anchor selection.
    expect(dialogSource).toContain(
      'const cornerReading = anchorWidthTarget === null || selectedVectorAnchors === null',
    );
    expect(dialogSource).toContain('{cornerAvailable ? (');
    // The gate also requires a REAL anchor selection — the block disappears
    // when no vertex is selected.
    expect(dialogSource).toContain('&& cornerReading.count > 0');
    // 261112-lq4: inside the Curve tab, after the Curve row and before Stack.
    const curveSectionAt = dialogSource.indexOf('data-testid="stroke-settings-curve"');
    const curveAt = dialogSource.indexOf('data-testid="stroke-settings-curve-mode-block"');
    const blockAt = dialogSource.indexOf(BLOCK_START);
    const stackAt = dialogSource.indexOf('data-testid="stroke-settings-stack"');
    expect(curveSectionAt).toBeGreaterThan(-1);
    expect(curveAt).toBeGreaterThan(curveSectionAt);
    expect(blockAt).toBeGreaterThan(curveAt);
    expect(stackAt).toBeGreaterThan(blockAt);
  });

  it('renders one button per corner option, lit only for the agreed state', () => {
    const block = cornerBlock();
    expect(block).toContain('ANCHOR_CORNER_OPTIONS.map((option) => {');
    expect(block).toContain('data-testid={`stroke-settings-corner-option-${option.id}`}');
    expect(block).toContain('aria-pressed={active}');
    // ONE template test id — the two ids come from the two model options.
    expect(countOf(dialogSource, 'stroke-settings-corner-option-')).toBe(1);
    expect(ANCHOR_CORNER_OPTIONS.map((option) => option.id)).toEqual(['round', 'straight']);
    expect(ANCHOR_CORNER_OPTIONS.map((option) => option.label)).toEqual(['Round', 'Straight']);
    expect(block).toContain(
      'const active = !cornerReading.mixed && cornerReading.state === option.state;',
    );
  });

  it('states the empty-selection reason instead of writing an inert value', () => {
    const block = cornerBlock();
    expect(block).toContain('disabled={cornerReading.count === 0}');
    expect(block).toContain('data-testid="stroke-settings-corner-caption"');
    expect(block).toContain('ANCHOR_CORNER_NO_EDIT_REASON');
    expect(block).toContain("'Select vertices on the canvas to set their corner.'");
  });

  it('calls the bundle once for the other state and never for the active one', () => {
    const block = cornerBlock();
    // Pressing the state the selection already holds writes nothing.
    expect(block).toContain('if (active) return;');
    expect(block).toContain('bundle.applyAnchorCorners?.(ids, option.state)');
    expect(countOf(dialogSource, 'bundle.applyAnchorCorners?.(')).toBe(1);
    // A refused commit publishes the ONE fixed line.
    expect(block).toContain('bundle.publishRefusal?.(ANCHOR_CORNER_COMMIT_REFUSED_MESSAGE)');
  });
});

describe('61-22 G-11 — the Anchor width control in the Curve tab', () => {
  const CURVE_WRAPPER = 'data-testid="stroke-settings-curve-anchor-width"';
  const BLOCK_START = 'data-testid="stroke-settings-anchor-width"';
  const BLOCK_END = 'data-testid="stroke-settings-anchor-width-caption"';
  const MOUNT_GATE = '{anchorWidthVisible && anchorWidthSizeReading !== null ? (';

  it('mounts the ONE control inside the Curve tab behind anchorWidthVisible', () => {
    // ONE conditional wrapper: an invisible control leaves no empty node.
    expect(countOf(dialogSource, CURVE_WRAPPER)).toBe(1);
    // 261112-lq4: the list and Geometry wrappers are gone — the sheet has
    // exactly one Anchor width mount, inside the Curve tab.
    expect(dialogSource).not.toContain('data-testid="stroke-settings-list-anchor-width"');
    expect(dialogSource).not.toContain('data-testid="stroke-settings-geometry-anchor-width"');
    expect(countOf(dialogSource, MOUNT_GATE)).toBe(1);
    // The gate also requires a REAL anchor selection, so the block
    // disappears — never mounts inert — when no vertex is selected.
    expect(countOf(
      dialogSource,
      'const anchorWidthVisible = anchorWidthAvailable',
    )).toBe(1);
    expect(dialogSource).toContain('&& anchorWidthReading.count > 0;');
    // Ordered inside the Curve section: after its opening and before the
    // Curve row (the sibling that follows it).
    const curveAt = dialogSource.indexOf('data-testid="stroke-settings-curve"');
    const mountAt = dialogSource.indexOf(CURVE_WRAPPER);
    const blockAt = dialogSource.indexOf('data-testid="stroke-settings-curve-mode-block"');
    expect(curveAt).toBeGreaterThan(-1);
    expect(mountAt).toBeGreaterThan(curveAt);
    expect(blockAt).toBeGreaterThan(mountAt);
    // The wrapper carries the component's whole input surface.
    const mount = regionOf(dialogSource, CURVE_WRAPPER, 'data-testid="stroke-settings-curve-mode-block"');
    expect(mount).toContain('<AnchorWidthControl');
    expect(mount).toContain('bundle={bundle}');
    expect(mount).toContain('ids={ids}');
    expect(mount).toContain('reading={anchorWidthSizeReading}');
    expect(mount).toContain('anchorWidthReading={anchorWidthReading}');
    expect(mount).toContain('anchorWidthTarget={anchorWidthTarget}');
  });

  it('mounts the ONE component once', () => {
    expect(countOf(dialogSource, '<AnchorWidthControl')).toBe(1);
    expect(countOf(dialogSource, 'function AnchorWidthControl(')).toBe(1);
    // ONE root block: the mount wraps the same component and never
    // re-declares the `stroke-settings-anchor-width` element.
    expect(countOf(dialogSource, '<div data-testid="stroke-settings-anchor-width">')).toBe(1);
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
    expect(component).toContain('label="Vertex size"');
    expect(component).toContain('ariaLabel="Vertex size"');
    expect(component).toContain('ANCHOR_WIDTH_CAPTION_STYLE');
    // The shipped region still holds exactly one stepper and no style attribute.
    const block = regionOf(dialogSource, BLOCK_START, BLOCK_END);
    expect(countOf(block, '<SliderStepper')).toBe(1);
    // 61-25 (UI-02): exactly one style — the declared readout constant.
    expect(countOf(block, 'style=')).toBe(1);
    expect(block).toContain('style={ANCHOR_WIDTH_READOUT_STYLE}');
  });

  it('declares the component AFTER the mount wrapper', () => {
    const mountAt = dialogSource.indexOf(CURVE_WRAPPER);
    const declarationAt = dialogSource.indexOf('function AnchorWidthControl(');
    expect(mountAt).toBeGreaterThan(-1);
    expect(declarationAt).toBeGreaterThan(mountAt);
    // The E4 region pins resolve the FIRST bare block occurrence — the
    // component body — so it must stay after the mount too.
    expect(dialogSource.indexOf(BLOCK_START)).toBeGreaterThan(declarationAt);
  });

  it('feeds the Curve mount the Size reading of the SAME ids', () => {
    expect(dialogSource).toContain(
      "const anchorWidthSizeField = numericFields.find((field) => field.key === 'size');",
    );
    expect(dialogSource).toContain(
      'const anchorWidthSizeReading = anchorWidthSizeField === undefined',
    );
    expect(dialogSource).toContain('readNumericField(appearances, ids, anchorWidthSizeField)');
    expect(dialogSource).toContain(
      'const anchorWidthVisible = anchorWidthAvailable',
    );
    // No selected vertex, no block.
    expect(dialogSource).toContain('&& anchorWidthReading.count > 0;');
    const mount = regionOf(dialogSource, '{anchorWidthVisible', ') : null}');
    expect(mount).toContain('reading={anchorWidthSizeReading}');
  });
});

// ============================================================
//  quick 261112-lq4 — the FOUR-TAB sheet.
//
//  The 261111-vg4 two-tab sheet (Geometry | Stack) grew the watercolor
//  LIST and the context-gated CURVE tab, and the 261101-jmm list ↔
//  settings view gate is retired outright. One pinned row: List |
//  Geometry | Stack | Curve. The requested tab is session state; an
//  unavailable tab is never rendered and the derivation falls back
//  without writing (a requested Curve returns after a dip).
// ============================================================

describe('quick 261112-lq4 — the four-tab sheet', () => {
  it('pins the tab union to list | geometry | stack | curve and the registry order', () => {
    expect(dialogSource).toContain(
      "type StrokeSettingsTab = 'list' | 'geometry' | 'stack' | 'curve';",
    );
    const registry = regionOf(
      dialogSource,
      'const STROKE_SETTINGS_TABS:',
      '];',
    );
    // The shipped order IS the rendered order — List first, List default.
    const listAt = registry.indexOf("{ key: 'list', label: 'List' }");
    const geometryAt = registry.indexOf("{ key: 'geometry', label: 'Geometry' }");
    const stackAt = registry.indexOf("{ key: 'stack', label: 'Stack' }");
    const curveAt = registry.indexOf("{ key: 'curve', label: 'Curve' }");
    expect(listAt).toBeGreaterThan(-1);
    expect(geometryAt).toBeGreaterThan(listAt);
    expect(stackAt).toBeGreaterThan(geometryAt);
    expect(curveAt).toBeGreaterThan(stackAt);
    expect(registry).not.toContain('paint');
    // Four ENTRY literals (the type annotation's `{ key: StrokeSettingsTab…`
    // carries no quote, so it is not counted).
    expect(countOf(registry, "{ key: '")).toBe(4);
  });

  it('deletes the list ↔ settings view gate root and branch', () => {
    // No header toggle, no view signal, no invalidation law — grep the whole
    // dialog AND the model: the machinery is gone, not merely unrendered.
    expect(dialogSource).not.toContain('stroke-settings-view-toggle');
    expect(dialogSource).not.toContain('settingsViewRef');
    expect(dialogSource).not.toContain('strokeSettingsViewInvalidated');
    expect(modelSource).not.toContain('resolveStrokeSettingsView');
    expect(modelSource).not.toContain('shouldInvalidateStrokeSettingsView');
    expect(modelSource).not.toContain('StrokeSettingsView');
  });

  it('derives the active tab purely: availability, default, fallback', () => {
    // ONE availability predicate; every rendered tab consults it.
    expect(countOf(dialogSource, 'settingsTabAvailable(tab.key)')).toBe(1);
    expect(dialogSource).toContain(
      'if (key === \'list\') return engineModule === \'watercolor\';',
    );
    expect(dialogSource).toContain('if (key === \'stack\') return stackTabAvailable;');
    expect(dialogSource).toContain("if (key === 'curve') return curveTabAvailable;");
    // The watercolor default is List; brush keeps Geometry.
    expect(dialogSource).toContain(
      "const defaultSettingsTab: StrokeSettingsTab = engineModule === 'watercolor'",
    );
    // The fallback is a DERIVATION, never a write: the request stands.
    expect(dialogSource).toContain(
      'const activeSettingsTab: StrokeSettingsTab = settingsTabAvailable(requestedSettingsTab)',
    );
    expect(dialogSource).toContain('    : defaultSettingsTab;');
    // The tab key is session state on a ref — not a signal write per render.
    expect(dialogSource).toContain('const settingsTabRef = useRef<');
  });

  it('leaves no Paint tab, block, color readout, field map or style behind', () => {
    expect(dialogSource).not.toContain('data-testid="stroke-settings-paint"');
    expect(dialogSource).not.toContain('paintTabAvailable');
    expect(dialogSource).not.toContain('selectionHasLift');
    expect(dialogSource).not.toContain('data-testid="stroke-settings-color"');
    expect(dialogSource).not.toContain('segmentedFields');
    expect(dialogSource).not.toContain('hexToRgba');
  });

  it('deletes the segmented type row — the tool dropdown is the one entry point', () => {
    // quick 261112-lq4: the LIST type filter row (Paint | Eraser | All) and
    // its chrome are gone; the `stroke-settings-tool-filter` select derives
    // its options from the type-filtered rows instead.
    expect(dialogSource).not.toContain('STROKE_TYPE_FILTERS');
    expect(dialogSource).not.toContain('FILTER_ROW_STYLE');
    expect(dialogSource).not.toContain('FILTER_SEGMENT_STYLE');
    expect(dialogSource).not.toContain('FILTER_SEGMENT_ACTIVE_STYLE');
    expect(dialogSource).not.toContain('data-testid="stroke-settings-filter"');
    expect(dialogSource).not.toContain('stroke-settings-filter-paint');
    // The top-bar setter (which prunes the selection) is never imported or
    // called here — the dialog only READS the shared type filter.
    const selectionImport = regionOf(
      dialogSource,
      'import {\n  aquarelleStrokeSettingsDismissed,',
      "} from './aquarelleStrokeSelection';",
    );
    expect(selectionImport).not.toContain('setAquarelleStrokeTypeFilter');
    expect(dialogSource).not.toContain('setAquarelleStrokeTypeFilter(');
    expect(dialogSource).toContain('aquarelleStrokeTypeFilter.value');
    // Exactly ONE filter entry point survives.
    expect(countOf(dialogSource, 'data-testid="stroke-settings-tool-filter"')).toBe(1);
  });

  it('keeps the surviving Geometry rows and the context-gated Curve section', () => {
    // Geometry carries the seed switch, Opacity and the transform rows. The
    // Anchor width mount, the Curve row and the Corner row moved to Curve.
    expect(dialogSource).toContain('data-testid="stroke-settings-geometry"');
    expect(dialogSource).not.toContain('data-testid="stroke-settings-geometry-anchor-width"');
    expect(dialogSource).toContain('data-testid="stroke-settings-curve"');
    expect(dialogSource).toContain('data-testid="stroke-settings-curve-anchor-width"');
    expect(dialogSource).toContain('data-testid="stroke-settings-curve-mode-block"');
    expect(dialogSource).toContain('data-testid="stroke-settings-corner-block"');
    expect(dialogSource).toContain('data-testid="stroke-settings-stack"');
    // The list body keeps its rows and the merged fine filters.
    expect(dialogSource).toContain('data-testid="stroke-settings-list"');
    expect(dialogSource).toContain('data-testid="stroke-settings-fine-filters"');
  });

  it('deletes the Paint-only model color helpers and keeps the survivors', () => {
    expect(modelSource).not.toContain('buildColorPatch');
    expect(modelSource).not.toContain('readColorField');
    expect(modelSource).not.toContain('NEUTRAL_STROKE_COLOR');
    expect(modelSource).not.toContain('ColorFieldReading');
    // The seams the surviving rows ride stay.
    expect(modelSource).toContain('export function buildAppearancePatch(');
    expect(modelSource).toContain('export function readNumericField(');
    expect(modelSource).toContain('readonly applyCurveMode?');
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
    // The Mixed caption declares no weight — its italic red 400 is the only
    // light text the sheet keeps.
    const mixedStyle = regionOf(dialogSource, 'const MIXED_CAPTION_STYLE', '};');
    expect(mixedStyle).not.toContain('fontWeight');
    const weights = [...dialogSource.matchAll(/fontWeight:\s*(\d+)/g)].map((match) => match[1]);
    expect(new Set(weights)).toEqual(new Set(['600']));
  });
});

// 261112-n3f UAT: the cache eye and Draft are view preferences of the OPEN
// sheet. Closing it must never strand the committed sheet hidden (the user
// would paint over invisible strokes) and must settle a dirty Draft.
describe('261112-n3f — closing the sheet restores the surface', () => {
  it('resets the cache eye on the open -> closed edge, before the Draft settle', () => {
    const closeEdge = regionOf(
      dialogSource,
      'const wasOpen = wasOpenRef.current;',
      'if (pathEditExitRequested) {',
    );
    expect(closeEdge).toContain('setFrozenCacheVisible(true);');
    expect(closeEdge).toContain('bundle?.settleDraft?.()');
    // The restore precedes the settle: a closed panel never keeps the sheet
    // hidden while the recompute runs.
    expect(closeEdge.indexOf('setFrozenCacheVisible(true);'))
      .toBeLessThan(closeEdge.indexOf('bundle?.settleDraft?.()'));
  });
});

// ============================================================
//  62-02 (D-03 / D-10) — ONE button, two stroke kinds.
//
//  The shipped spline-pointer reads the single selection's curve entry
//  from the Studio bundle and hands it to the ONE gate. An eligible
//  painted click routes to the Studio entry (which fits lazily on
//  click); a vector click keeps the shipped `enterPathEdit` action.
//  The dialog leaf never fits, never reads the record seam and never
//  writes a signal from its render body.
// ============================================================

describe('62-02 painted-curve entry through the shipped spline-pointer', () => {
  it('reads the single selection’s curve entry and hands it to the gate', () => {
    const read = regionOf(
      dialogSource,
      "const curveEntry = selectedMutationId !== null && engineModule === 'watercolor'",
      'const pathEditGate = resolvePathEditGate({',
    );
    expect(read).toContain('bundle?.readCurveEntry?.([selectedMutationId]) ?? null');
    const gate = regionOf(
      dialogSource,
      'const pathEditGate = resolvePathEditGate({',
      'const pathEditGateEnabled = pathEditGate.enabled;',
    );
    expect(gate).toContain('curveEntry,');
    // The vector arm is untouched: the shipped anchor read still decides it.
    expect(gate).toContain('vectorStrokeCount: selectedVectorAnchors !== null ? 1 : 0,');
  });

  it('routes an eligible painted click to the Studio entry before the shipped vector action', () => {
    const button = regionOf(dialogSource, SPLINE_START, SPLINE_END);
    const paintedAt = button.indexOf("if (curveEntry?.kind === 'painted') {");
    const enterAt = button.indexOf('void bundle?.enterPaintedCurve?.([target]);');
    const vectorAt = button.indexOf('enterPathEdit(String(target));');
    expect(paintedAt).toBeGreaterThan(-1);
    expect(enterAt).toBeGreaterThan(paintedAt);
    expect(vectorAt).toBeGreaterThan(enterAt);
    // One button, one entrance: the leaf never fits and never writes.
    expect(button).not.toContain('beginPaintedCurveSession');
    expect(button).not.toContain('fitVectorPathAnchors');
    expect(button).not.toContain('getRecordedAquarelleStroke');
    expect(countOf(dialogSource, SPLINE_TESTID)).toBe(1);
    // No new lifecycle effect and no new session import: the entry is a
    // bundle action, exactly like every other commit of this sheet.
    expect(countOf(dialogSource, 'useEffect(')).toBe(2);
    expect(dialogSource).toContain(
      "import { enterPathEdit, exitPathEdit, pathEditMutationId, vectorAnchorSelection } from './vectorPathSession';",
    );
  });

  it('declares both optional bundle members and the fixed refusal copy in the model', () => {
    expect(modelSource).toContain(
      'readonly readCurveEntry?: (ids: readonly number[]) => CurveEntryState | null;',
    );
    expect(modelSource).toContain(
      'readonly enterPaintedCurve?: (ids: readonly number[]) => boolean | Promise<boolean>;',
    );
    // The refusal copy is a fixed module constant, never interpolated.
    expect(modelSource).toContain(
      "export const PATH_EDIT_LIFT_DISABLED_REASON = 'Edit path — an eraser stroke cannot be edited';",
    );
    expect(modelSource).toContain(
      'export const PATH_EDIT_DEGENERATE_DISABLED_REASON =',
    );
    const degenerateDeclaration = regionOf(
      modelSource,
      'export const PATH_EDIT_DEGENERATE_DISABLED_REASON =',
      ';',
    );
    expect(degenerateDeclaration).not.toContain('${');
    expect(degenerateDeclaration).not.toContain('`');
  });
});

// 62-UAT: the Curve tab's read-only vertex-colour row.
describe('62-UAT vertex colour row in the Curve tab', () => {
  const COLOR_TESTID = 'data-testid="stroke-settings-anchor-color"';

  it('mounts once, inside the Curve tab after Vertex size, and stays read-only', () => {
    expect(countOf(dialogSource, COLOR_TESTID)).toBe(1);
    const row = regionOf(
      dialogSource,
      COLOR_TESTID,
      'data-testid="stroke-settings-curve-mode-block"',
    );
    expect(row).toContain('data-testid="stroke-settings-anchor-color-swatch"');
    expect(row).toContain('data-testid="stroke-settings-anchor-color-readout"');
    expect(row).toContain('data-testid="stroke-settings-anchor-color-mixed"');
    expect(row).toContain('backgroundColor: anchorColorReading.color');
    // Read-only: the sidebar picker stays the ONE writer, so the row carries
    // no colour input and no commit seam.
    expect(row).not.toContain('<input');
    expect(row).not.toContain('applyAnchorColor');

    // The mount order inside the Curve tab: Vertex size, then Vertex colour,
    // then the Curve row.
    const curveAt = dialogSource.indexOf('data-testid="stroke-settings-curve"');
    const widthAt = dialogSource.indexOf('data-testid="stroke-settings-curve-anchor-width"');
    const colorAt = dialogSource.indexOf(COLOR_TESTID);
    const modeAt = dialogSource.indexOf('data-testid="stroke-settings-curve-mode-block"');
    expect(curveAt).toBeGreaterThan(-1);
    expect(widthAt).toBeGreaterThan(curveAt);
    expect(colorAt).toBeGreaterThan(widthAt);
    expect(modeAt).toBeGreaterThan(colorAt);
  });

  it('reads the effective colour through the model, never the stroke directly', () => {
    expect(modelSource).toContain('export function readAnchorColorReading(');
    expect(dialogSource).toContain('readAnchorColorReading(');
    expect(dialogSource).toContain('selectedStrokeColor');
  });
});
