import type { ColorGradeParams } from './fxColorGrade';

/** Built-in color grade presets for the preset dropdown */
export const COLOR_GRADE_PRESETS: Record<string, ColorGradeParams> = {
  none: { brightness: 0, contrast: 0, saturation: 0, hue: 0, fade: 0, tintColor: '#D4A574' },
  warm: { brightness: 0.1, contrast: 0.15, saturation: 0.2, hue: 15, fade: 0.15, tintColor: '#D4A574' },
  cool: { brightness: 0, contrast: 0.15, saturation: -0.15, hue: -20, fade: 0.12, tintColor: '#7BA7BC' },
  vintage: { brightness: -0.1, contrast: 0.3, saturation: -0.4, hue: 10, fade: 0.25, tintColor: '#C8A882' },
  bleachBypass: { brightness: 0.15, contrast: 0.5, saturation: -0.5, hue: 0, fade: 0.1, tintColor: '#CCCCCC' },
  cinematic: { brightness: -0.1, contrast: 0.4, saturation: -0.2, hue: -8, fade: 0.2, tintColor: '#2C4A5A' },
  highContrast: { brightness: 0, contrast: 0.6, saturation: 0.3, hue: 0, fade: 0, tintColor: '#D4A574' },
};

/** Preset names for use in UI dropdowns */
export const PRESET_NAMES: string[] = Object.keys(COLOR_GRADE_PRESETS);
