/**
 * 260924-ffd: the shared fps preset list — single source for all three fps
 * surfaces (Settings, New Project, Studio workflow strip). Precedent:
 * COLOR_GRADE_PRESETS in fxPresets.ts / CANVAS_FORMAT_PRESETS.
 *
 * Supersedes D-24 (fps step 0.5 → OBSOLETE): preset mode walks this list
 * (next/previous entry), clamps at the ends with visibly disabled buttons,
 * and typed commits snap to the nearest entry (ties toward the lower entry).
 * Ascending order is part of the contract — the direction-of-travel snap and
 * the end detection both rely on it.
 *
 * Two-tier fps law: this list feeds the PROJECT tier (export cadence —
 * Settings, New Project) and the STUDIO tier (preview only — playback strip);
 * neither tier ever writes the other's store.
 */
export const FPS_PRESETS = [6, 12, 15, 24, 25, 50, 60] as const;
