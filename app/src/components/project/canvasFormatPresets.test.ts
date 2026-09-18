/**
 * 260918-ovi (D-preset-set / D-control): the shared canvas-format preset table.
 *
 * The New Project dialog (creation-time choice) and SettingsView (post-creation
 * resolution editor) BOTH consume this one table — a future edit cannot
 * silently reintroduce a 4K option in one surface while the other stays clamped
 * (T-260918-ovi-03).
 */
import { describe, expect, it } from 'vitest';
import {
  CANVAS_FORMAT_PRESETS,
  DEFAULT_CANVAS_FORMAT_PRESET_ID,
  clampCustomSize,
} from './canvasFormatPresets';

describe('canvasFormatPresets (260918-ovi)', () => {
  it('exports the HD and HD Vertical presets with platform annotations', () => {
    const hd = CANVAS_FORMAT_PRESETS.find((preset) => preset.id === 'hd');
    expect(hd).toBeDefined();
    expect(hd!.width).toBe(1920);
    expect(hd!.height).toBe(1080);
    expect(hd!.label).toContain('HD');
    expect(hd!.label).toContain('1920x1080');
    expect(hd!.label).toContain('16:9');
    expect(hd!.label).toContain('YouTube');

    const hdVertical = CANVAS_FORMAT_PRESETS.find((preset) => preset.id === 'hd-vertical');
    expect(hdVertical).toBeDefined();
    expect(hdVertical!.width).toBe(1080);
    expect(hdVertical!.height).toBe(1920);
    expect(hdVertical!.label).toContain('HD Vertical');
    expect(hdVertical!.label).toContain('1080x1920');
    expect(hdVertical!.label).toContain('9:16');
    expect(hdVertical!.label).toContain('Story');
    expect(hdVertical!.label).toContain('Reels');
    expect(hdVertical!.label).toContain('Shorts');
  });

  it('the default preset is HD', () => {
    expect(DEFAULT_CANVAS_FORMAT_PRESET_ID).toBe('hd');
  });

  it('clampCustomSize clamps each side to [16, 1920]', () => {
    expect(clampCustomSize(8, 5000)).toEqual({ width: 16, height: 1920 });
    expect(clampCustomSize(1080, 1920)).toEqual({ width: 1080, height: 1920 });
    expect(clampCustomSize(1920, 1920)).toEqual({ width: 1920, height: 1920 });
  });

  it('clampCustomSize rounds non-integer input before clamping', () => {
    expect(clampCustomSize(1080.4, 1919.6)).toEqual({ width: 1080, height: 1920 });
    expect(clampCustomSize(15.6, 1920.4)).toEqual({ width: 16, height: 1920 });
  });
});
