import {describe, it, expect, beforeEach, vi} from 'vitest';

// Mock projectStore to break circular import (paintStore -> projectStore -> paintStore)
vi.mock('./projectStore', () => ({
  projectStore: {
    markDirty: vi.fn(),
    width: {peek: () => 1920, value: 1920},
    height: {peek: () => 1080, value: 1080},
  },
}));

// Mock brushP5Adapter (uses DOM/canvas APIs unavailable in test)
vi.mock('../lib/brushP5Adapter', () => ({
  renderFrameFx: vi.fn(() => null),
}));

// Mock paintPreferences: swatch state must never persist (session-only),
// and assertions need a spy to prove setForeground/swap/promote don't write.
vi.mock('../lib/paintPreferences', () => ({
  loadBrushPreferences: vi.fn(async () => ({color: '#5B8BD4', size: 35})),
  saveBrushColor: vi.fn(async () => {}),
  saveBrushSize: vi.fn(async () => {}),
  loadRecentColors: vi.fn(async () => []),
  saveRecentColors: vi.fn(async () => {}),
  loadFavoriteColors: vi.fn(async () => []),
  saveFavoriteColors: vi.fn(async () => {}),
  loadHiddenPaletteColors: vi.fn(async () => []),
  saveHiddenPaletteColors: vi.fn(async () => {}),
  savePaintMode: vi.fn(async () => {}),
  loadPaintMode: vi.fn(async () => 'flat'),
}));

import {paintStore} from './paintStore';
import {saveBrushColor} from '../lib/paintPreferences';

const FG = '#103c65';
const BG = '#ffffff';

beforeEach(() => {
  paintStore.reset();
  vi.mocked(saveBrushColor).mockClear();
});

describe('paintStore fg/bg swatch (quick-261004-hwa)', () => {
  it('starts with the default dark-blue foreground and white background after reset', () => {
    expect(paintStore.foregroundColor.value).toBe(FG);
    expect(paintStore.backgroundColorSwatch.value).toBe(BG);
  });

  it('swapFgBg exchanges the two signals and points brushColor at the new foreground', () => {
    paintStore.swapFgBg();
    expect(paintStore.foregroundColor.value).toBe(BG);
    expect(paintStore.backgroundColorSwatch.value).toBe(FG);
    expect(paintStore.brushColor.value).toBe(BG);
  });

  it('a rapid double swap returns the original swatch colors and re-points brushColor at the foreground', () => {
    paintStore.swapFgBg();
    paintStore.swapFgBg();
    expect(paintStore.foregroundColor.value).toBe(FG);
    expect(paintStore.backgroundColorSwatch.value).toBe(BG);
    // brushColor tracks the active (front) slot after every swap — not the pre-session pref color
    expect(paintStore.brushColor.value).toBe(paintStore.foregroundColor.value);
  });

  it('setActiveFromBackground promotes background to front and keeps the old foreground as background', () => {
    paintStore.setActiveFromBackground();
    expect(paintStore.foregroundColor.value).toBe(BG);
    expect(paintStore.backgroundColorSwatch.value).toBe(FG);
    expect(paintStore.brushColor.value).toBe(BG);
  });

  it('setForeground updates only the foreground swatch without touching brushColor', () => {
    const brushBefore = paintStore.brushColor.value;
    paintStore.setForeground('#ff0000');
    expect(paintStore.foregroundColor.value).toBe('#ff0000');
    expect(paintStore.backgroundColorSwatch.value).toBe(BG);
    expect(paintStore.brushColor.value).toBe(brushBefore);
  });

  it('setForeground does not clobber the background swatch (picker pick targets top only)', () => {
    paintStore.swapFgBg(); // background is now the default foreground
    const bgBefore = paintStore.backgroundColorSwatch.value;
    paintStore.setForeground('#123456');
    expect(paintStore.foregroundColor.value).toBe('#123456');
    expect(paintStore.backgroundColorSwatch.value).toBe(bgBefore);
    expect(paintStore.brushColor.value).not.toBe('#123456');
  });

  it('swatch actions never persist; only setBrushColor writes brushColor preferences', () => {
    paintStore.setForeground('#ff0000');
    paintStore.swapFgBg();
    paintStore.setActiveFromBackground();
    expect(saveBrushColor).not.toHaveBeenCalled();

    paintStore.setBrushColor('#00ff00');
    expect(saveBrushColor).toHaveBeenCalledWith('#00ff00');
  });

  it('reset restores both swatch signals to their defaults (session-only state)', () => {
    paintStore.setForeground('#ff0000');
    paintStore.swapFgBg();
    paintStore.reset();
    expect(paintStore.foregroundColor.value).toBe(FG);
    expect(paintStore.backgroundColorSwatch.value).toBe(BG);
  });
});
