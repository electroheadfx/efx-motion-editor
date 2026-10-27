import type { BgMode, ToolType } from '../types/paintCore';
import type { BackgroundFallback, PaperTexture } from '../../../efx-paint/document/efxPaintDocument';
import type { PhysicPaintRotoBackgroundMetadata } from '../../../types/physicPaint';

/**
 * 56-05 (PAPER-01): the Studio's background field spans the selector's BgMode
 * segments AND the paper library's `paper/<id>` textures. The selector UI
 * still shows only the five legacy segments; library papers are picked via
 * the shared-panel PaperPicker and ride the same settings slot.
 */
export type StudioBackgroundMode = BgMode | PaperTexture;

export type PhysicsPaintStudioSettings = {
  tool: ToolType;
  color: string;
  size: number;
  opacity: number;
  background: StudioBackgroundMode;
  grainStrength: number;
  /** 260923-bcm: paper pattern scale (1 = natural tile) — REQUIRED, default 1. */
  grainScale: number;
  edgeDetail: number;
  pickup: number;
  eraseStrength: number;
  smoothing: number;
  spread: number;
  physicsMode: 'local' | null;
  activePhysicsAction: 'last' | 'all' | null;
};

export function makeInitialPhysicsPaintStudioSettings(): PhysicsPaintStudioSettings {
  return {
    tool: 'paint',
    color: '#103c65',
    size: 11,
    opacity: 100,
    background: 'canvas1',
    grainStrength: 0.35,
    grainScale: 1,
    edgeDetail: 20,
    pickup: 0,
    eraseStrength: 100,
    smoothing: 1,
    spread: 65,
    physicsMode: 'local',
    activePhysicsAction: null,
  };
}


/**
 * 49-03 (S6, D-11): the five selector modes. `'photo'` is reserved for the
 * Phase 50 photoReference slot and is structurally impossible on the fallback
 * surface — the engine BgMode union itself is untouched. 56-05: the selector
 * stays five segments; library papers ride {@link StudioBackgroundMode}.
 */
export type BackgroundSelectorMode = Exclude<BgMode, 'photo'>;

/**
 * 49-03 (S6): write-through — one selector/library mode → exactly one document
 * fallback record. White maps to the 49-01-gated solid `#ffffff` (no distinct
 * 'white' literal). Paper modes carry the current grain controls (grainStrength
 * is carried directly). Deterministic: same mode + same settings →
 * the same record, so a same-mode dispatch is a revision-stable no-op through
 * the store's setBackgroundFallback guard (BKG-09, the 1552-1569 lesson).
 */
export function backgroundModeToFallback(
  mode: StudioBackgroundMode,
  settings: Pick<PhysicsPaintStudioSettings, 'grainStrength' | 'grainScale'>,
): BackgroundFallback {
  if (mode === 'transparent') return { mode: 'transparent' };
  if (mode === 'white') return { mode: 'solid', color: '#ffffff' };
  return {
    mode: 'paper',
    texture: mode as PaperTexture,
    grainStrength: settings.grainStrength,
    grainScale: settings.grainScale,
  };
}

/**
 * 49-03 (S6): reflection — the document fallback is authoritative; derive the
 * active background mode unambiguously (one-of, never a blank selector).
 * Solid non-white colors are not producible by the selector; if encountered
 * after document edits, the closest locked treatment is White (the selector's
 * only solid arm). 56-05: library paper ids reflect verbatim (the PaperPicker
 * owns them; the five-segment selector has no matching segment).
 */
export function reflectFallbackToBackgroundMode(fallback: BackgroundFallback): StudioBackgroundMode {
  if (fallback.mode === 'transparent') return 'transparent';
  if (fallback.mode === 'solid') return 'white';
  return fallback.texture;
}

export function buildRotoBackgroundMetadata(settings: PhysicsPaintStudioSettings): PhysicPaintRotoBackgroundMetadata {
  const background = settings.background === 'photo' ? 'transparent' : settings.background;
  return {
    background,
    grainStrength: settings.grainStrength,
    grainScale: settings.grainScale,
    ...(background === 'white' ? { color: '#ffffff' } : {}),
  };
}

export function applyRotoBackgroundMetadataToSettings(metadata: PhysicPaintRotoBackgroundMetadata): PhysicsPaintStudioSettings {
  return {
    ...makeInitialPhysicsPaintStudioSettings(),
    background: metadata.background,
    grainStrength: metadata.grainStrength,
    grainScale: metadata.grainScale ?? 1,
  };
}

/**
 * 49-04 (UAT fix): hydrate the Studio settings from the DOCUMENT FALLBACK as
 * the single authority on open — the selector mode reflects the fallback arm
 * (reflectFallbackToBackgroundMode) and the paper arm carries its grain
 * controls. This is the open-time counterpart of the click-time write-through
 * (backgroundModeToFallback + setBackgroundFallback): without it the selector
 * and engine ran the old per-track persisted settings while the document
 * fallback stayed transparent, so the monitor fond resolved null (black) until
 * the first click of the session.
 */
export function applyBackgroundFallbackToSettings(fallback: BackgroundFallback): PhysicsPaintStudioSettings {
  const initial = makeInitialPhysicsPaintStudioSettings();
  const background = reflectFallbackToBackgroundMode(fallback);
  if (fallback.mode === 'paper') {
    return {
      ...initial,
      background,
      grainStrength: fallback.grainStrength,
      grainScale: fallback.grainScale ?? 1,
    };
  }
  return { ...initial, background };
}

