// @vitest-environment node
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  buildRailMotionEditCss,
  buildRailMotionEditSeatStyle,
} from './PhysicsPaintReferenceTransform';

/**
 * studio-paint-motion-offset regression pin (live native UAT 2026-11-09).
 *
 * The defect was NOT stroke placement: the engine maps pointers through the
 * LIVE `getBoundingClientRect` of the rail-edit–translated sheet, so under a
 * pure Position translation the committed content point already equals the
 * physical pointer (the mirror cancels). The two paint-cursor readouts (the
 * brush ring — the OS cursor is `cursor: none` — and the picker visor) render
 * in sibling seats at LAYOUT bounds while `cursorX/Y` are CONTENT coordinates.
 * Without the shell's rail-edit chain each cursor lagged the sheet — and the
 * correctly-placed stroke — by exactly the rail delta.
 *
 * The pin covers the fix's actual contract:
 *   1. identity (`railEditCss === null`) contributes NO properties, so the seat
 *      style and markup stay byte-identical to the pre-fix render;
 *   2. non-identity adds exactly the shell's `transform` chain plus
 *      `transform-origin: 0 0` (the seats share the shell's layout box);
 *   3. BOTH cursor seats are wired to the one shared helper (no inline fork).
 *
 * Harness note: `PhysicsPaintCanvasStackImpl` is not exported and is hookful,
 * so its seating is pinned at source level (the established Studio contract
 * convention) rather than by mounting the view.
 */

const VIEW_DIR = dirname(fileURLToPath(import.meta.url));

describe('buildRailMotionEditSeatStyle (studio-paint-motion-offset)', () => {
  const railEditCss = buildRailMotionEditCss(
    { translateX: 120, translateY: -40, scale: 1.25, rotationRadians: 0.1, pivotX: 0.5, pivotY: 0.5 },
    1000,
    800,
    0.5,
  );

  it('returns null for an identity rail so the seat contributes no transform', () => {
    expect(buildRailMotionEditSeatStyle(null)).toBeNull();
  });

  it('spreads to a byte-identical identity seat style (no transform keys)', () => {
    const seat = { left: 10, top: 20, width: 300, height: 200, ...buildRailMotionEditSeatStyle(null) };
    expect(seat).toEqual({ left: 10, top: 20, width: 300, height: 200 });
    expect(Object.keys(seat)).toEqual(['left', 'top', 'width', 'height']);
  });

  it('carries the shell transform chain with the layout-box origin for a non-identity rail', () => {
    expect(buildRailMotionEditSeatStyle(railEditCss)).toEqual({
      transform: railEditCss,
      transformOrigin: '0 0',
    });
  });
});

describe('cursor seat wiring (studio-paint-motion-offset)', () => {
  const viewSource = readFileSync(resolve(VIEW_DIR, 'PhysicsPaintStudioView.tsx'), 'utf8');

  it('routes BOTH content-coordinate cursor seats through the shared helper', () => {
    expect(viewSource).toContain('physics-paint-brush-ring-seat');
    expect(viewSource).toContain('physics-paint-picker-visor-seat');
    // One spread per seat: the ring seat and the picker-visor seat. A third
    // content-coordinate overlay would be a new copy of the same defect.
    const wiredSeats = viewSource.match(/\.\.\.buildRailMotionEditSeatStyle\(railEditCss\)/g) ?? [];
    expect(wiredSeats).toHaveLength(2);
  });

  it('keeps no inline fork of the seat transform branch in the view', () => {
    expect(viewSource).not.toMatch(/transformOrigin:\s*'0 0'/);
  });
});
