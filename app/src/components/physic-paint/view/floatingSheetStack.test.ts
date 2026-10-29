// ============================================================
//  261029-hy2 — the shared floating-sheet stack (click-to-front).
//
//  One bottom-to-top order owns the three Studio sheets' z-indexes:
//  the Move-edit sheet, the brush catalog and the Settings sheet.
//  This suite mutates the module-global order, so every case resets
//  it on both sides.
// ============================================================

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  SHEET_ID_BRUSHES,
  SHEET_ID_SETTINGS,
  SHEET_ID_STROKE_SETTINGS,
  bringSheetToFront,
  closeSheetIfFront,
  floatingSheetOrder,
  isFrontSheet,
  releaseSheet,
  resetFloatingSheetStack,
  sheetZIndex,
  type FloatingSheetId,
} from './floatingSheetStack';

beforeEach(() => {
  resetFloatingSheetStack();
});

afterEach(() => {
  resetFloatingSheetStack();
});

describe('261029-hy2 floating-sheet stack', () => {
  it('starts bottom-to-top at 50 / 51 / 52', () => {
    expect(floatingSheetOrder.value).toEqual(['stroke-settings', 'brushes', 'settings']);
    expect(sheetZIndex(SHEET_ID_STROKE_SETTINGS)).toBe(50);
    expect(sheetZIndex(SHEET_ID_BRUSHES)).toBe(51);
    expect(sheetZIndex(SHEET_ID_SETTINGS)).toBe(52);
  });

  it('raising the bottom sheet moves it to 52 and shifts the others down', () => {
    bringSheetToFront(SHEET_ID_STROKE_SETTINGS);
    expect(floatingSheetOrder.value).toEqual(['brushes', 'settings', 'stroke-settings']);
    expect(sheetZIndex(SHEET_ID_STROKE_SETTINGS)).toBe(52);
    expect(sheetZIndex(SHEET_ID_BRUSHES)).toBe(50);
    expect(sheetZIndex(SHEET_ID_SETTINGS)).toBe(51);
  });

  it('raising the already-front sheet keeps the same array reference', () => {
    const before = floatingSheetOrder.value;
    bringSheetToFront(SHEET_ID_SETTINGS);
    expect(floatingSheetOrder.value, 'a front raise writes nothing').toBe(before);
  });

  it('an unknown id resolves to the base z-index and never enters the order', () => {
    const unknownId = 'unknown' as FloatingSheetId;
    expect(sheetZIndex(unknownId)).toBe(50);
    const before = floatingSheetOrder.value;
    bringSheetToFront(unknownId);
    expect(floatingSheetOrder.value).toBe(before);
  });

  it('releasing a closed sheet hands the front to the next open sheet', () => {
    bringSheetToFront(SHEET_ID_BRUSHES);
    expect(isFrontSheet(SHEET_ID_BRUSHES)).toBe(true);
    releaseSheet(SHEET_ID_BRUSHES);
    expect(floatingSheetOrder.value).not.toContain(SHEET_ID_BRUSHES);
    expect(isFrontSheet(SHEET_ID_SETTINGS)).toBe(true);
  });

  it('a released sheet rejoins at the front when it opens again', () => {
    releaseSheet(SHEET_ID_BRUSHES);
    bringSheetToFront(SHEET_ID_BRUSHES);
    expect(floatingSheetOrder.value[floatingSheetOrder.value.length - 1]).toBe(SHEET_ID_BRUSHES);
    expect(sheetZIndex(SHEET_ID_BRUSHES)).toBeGreaterThan(sheetZIndex(SHEET_ID_SETTINGS));
  });

  it('closeSheetIfFront releases the sheet it closed', () => {
    bringSheetToFront(SHEET_ID_SETTINGS);
    let closed = false;
    expect(closeSheetIfFront(SHEET_ID_SETTINGS, () => { closed = true; })).toBe(true);
    expect(closed).toBe(true);
    expect(floatingSheetOrder.value).not.toContain(SHEET_ID_SETTINGS);
    expect(isFrontSheet(SHEET_ID_BRUSHES)).toBe(true);
  });

  it('reset restores the initial order', () => {
    bringSheetToFront(SHEET_ID_STROKE_SETTINGS);
    resetFloatingSheetStack();
    expect(floatingSheetOrder.value).toEqual(['stroke-settings', 'brushes', 'settings']);
    expect(sheetZIndex(SHEET_ID_STROKE_SETTINGS)).toBe(50);
    expect(sheetZIndex(SHEET_ID_BRUSHES)).toBe(51);
    expect(sheetZIndex(SHEET_ID_SETTINGS)).toBe(52);
  });
});

// 261029-hy2 WR-03: each sheet registers its own window keydown listener and
// same-node listeners ALL run — stopPropagation cannot suppress its siblings.
// Dismissal is therefore front-only, and the winner stops the rest with
// stopImmediatePropagation().
describe('261029-hy2 WR-03 front-only Escape dismissal', () => {
  it('isFrontSheet answers for the top of the order', () => {
    expect(isFrontSheet(SHEET_ID_SETTINGS)).toBe(true);
    expect(isFrontSheet(SHEET_ID_BRUSHES)).toBe(false);
    bringSheetToFront(SHEET_ID_BRUSHES);
    expect(isFrontSheet(SHEET_ID_BRUSHES)).toBe(true);
    expect(isFrontSheet(SHEET_ID_SETTINGS)).toBe(false);
    expect(isFrontSheet(SHEET_ID_STROKE_SETTINGS)).toBe(false);
  });

  it('a background sheet never closes and leaves the key to the front one', () => {
    bringSheetToFront(SHEET_ID_BRUSHES);
    let settingsClosed = false;
    let brushesClosed = false;
    expect(closeSheetIfFront(SHEET_ID_SETTINGS, () => { settingsClosed = true; })).toBe(false);
    expect(settingsClosed).toBe(false);
    expect(closeSheetIfFront(SHEET_ID_BRUSHES, () => { brushesClosed = true; })).toBe(true);
    expect(brushesClosed).toBe(true);
  });

  it('all three sheet handlers gate on the front sheet and stop their siblings', () => {
    const handlers = [
      ['PhysicsPaintBrushModal.tsx', 'SHEET_ID_BRUSHES'],
      ['PhysicsPaintSettingsModal.tsx', 'SHEET_ID_SETTINGS'],
      ['PhysicsPaintStrokeSettingsDialog.tsx', 'SHEET_ID_STROKE_SETTINGS'],
    ] as const;
    for (const [file, id] of handlers) {
      const source = readFileSync(resolve(__dirname, file), 'utf8');
      expect(source, `${file} gates Escape on the front sheet`).toContain(
        `closeSheetIfFront(${id}`,
      );
      expect(source, `${file} stops sibling listeners`).toContain(
        'event.stopImmediatePropagation();',
      );
    }
  });
});
