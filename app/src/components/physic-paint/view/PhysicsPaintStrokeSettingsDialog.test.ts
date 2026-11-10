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

const dialogSource = readFileSync(
  fileURLToPath(new URL('./PhysicsPaintStrokeSettingsDialog.tsx', import.meta.url)),
  'utf8',
);
const modelSource = readFileSync(
  fileURLToPath(new URL('./strokeSettingsModel.ts', import.meta.url)),
  'utf8',
);
const studioSource = readFileSync(
  fileURLToPath(new URL('../PhysicsPaintStudio.tsx', import.meta.url)),
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
    expect(dialogSource).toContain(
      "import { clearVectorAnchorSelection, enterPathEdit, exitPathEdit, pathEditMutationId, vectorAnchorSelection } from './vectorPathSession';",
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
