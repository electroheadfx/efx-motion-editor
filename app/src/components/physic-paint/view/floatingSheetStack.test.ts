// ============================================================
//  261029-hy2 — the shared floating-sheet stack (click-to-front).
//
//  One bottom-to-top order owns the three Studio sheets' z-indexes:
//  the Move-edit sheet, the brush catalog and the Settings sheet.
//  This suite mutates the module-global order, so every case resets
//  it on both sides.
// ============================================================

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  SHEET_ID_BRUSHES,
  SHEET_ID_SETTINGS,
  SHEET_ID_STROKE_SETTINGS,
  bringSheetToFront,
  floatingSheetOrder,
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

  it('reset restores the initial order', () => {
    bringSheetToFront(SHEET_ID_STROKE_SETTINGS);
    resetFloatingSheetStack();
    expect(floatingSheetOrder.value).toEqual(['stroke-settings', 'brushes', 'settings']);
    expect(sheetZIndex(SHEET_ID_STROKE_SETTINGS)).toBe(50);
    expect(sheetZIndex(SHEET_ID_BRUSHES)).toBe(51);
    expect(sheetZIndex(SHEET_ID_SETTINGS)).toBe(52);
  });
});
