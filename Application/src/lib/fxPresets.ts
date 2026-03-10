import type { ColorGradeParams } from './fxColorGrade';

/** Built-in color grade presets for the preset dropdown */
export const COLOR_GRADE_PRESETS: Record<string, ColorGradeParams> = {
  none: { brightness: 0, contrast: 0, saturation: 1, hue: 0, fade: 0, tintColor: '#D4A574' },
  warm: { brightness: 0.02, contrast: 0.05, saturation: 1.1, hue: 10, fade: 0.08, tintColor: '#D4A574' },
  cool: { brightness: 0, contrast: 0.05, saturation: 0.9, hue: -15, fade: 0.06, tintColor: '#7BA7BC' },
  vintage: { brightness: -0.03, contrast: 0.1, saturation: 0.7, hue: 5, fade: 0.15, tintColor: '#C8A882' },
  bleachBypass: { brightness: 0.05, contrast: 0.2, saturation: 0.5, hue: 0, fade: 0.05, tintColor: '#CCCCCC' },
  cinematic: { brightness: -0.02, contrast: 0.15, saturation: 0.85, hue: -5, fade: 0.1, tintColor: '#2C4A5A' },
  highContrast: { brightness: 0, contrast: 0.3, saturation: 1.2, hue: 0, fade: 0, tintColor: '#D4A574' },
};

/** Preset names for use in UI dropdowns */
export const PRESET_NAMES: string[] = Object.keys(COLOR_GRADE_PRESETS);
