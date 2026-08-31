import type { BgMode, EfxPaintEngine, ToolType } from '@efxlab/efx-physic-paint';
import type { BackgroundFallback } from '../../../efx-paint/document/efxPaintDocument';
import type { PhysicPaintRotoBackgroundMetadata } from '../../../types/physicPaint';

export type PhysicsPaintStudioSettings = {
  tool: ToolType;
  color: string;
  size: number;
  opacity: number;
  background: BgMode;
  paperGrain: string;
  grainStrength: number;
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
    size: 6,
    opacity: 100,
    background: 'canvas1',
    paperGrain: 'canvas1',
    grainStrength: 0.45,
    edgeDetail: 4,
    pickup: 0,
    eraseStrength: 50,
    smoothing: 0,
    spread: 50,
    physicsMode: 'local',
    activePhysicsAction: null,
  };
}


/**
 * 49-03 (S6, D-11): the five selector modes. `'photo'` is reserved for the
 * Phase 50 photoReference slot and is structurally impossible on the fallback
 * surface — the engine BgMode union itself is untouched.
 */
export type BackgroundSelectorMode = Exclude<BgMode, 'photo'>;

/**
 * 49-03 (S6): write-through — one selector mode → exactly one document fallback
 * record. White maps to the 49-01-gated solid `#ffffff` (no distinct 'white'
 * literal). Paper modes carry the current grain controls: the paperGrain
 * boolean is true when the current grain texture matches the selected paper
 * (round-trip stable with {@link reflectFallbackToBackgroundMode}), and
 * grainStrength is carried directly. Deterministic: same mode + same settings →
 * the same record, so a same-mode dispatch is a revision-stable no-op through
 * the store's setBackgroundFallback guard (BKG-09, the 1552-1569 lesson).
 */
export function backgroundModeToFallback(
  mode: BackgroundSelectorMode,
  settings: Pick<PhysicsPaintStudioSettings, 'paperGrain' | 'grainStrength'>,
): BackgroundFallback {
  if (mode === 'transparent') return { mode: 'transparent' };
  if (mode === 'white') return { mode: 'solid', color: '#ffffff' };
  return {
    mode: 'paper',
    texture: mode,
    paperGrain: settings.paperGrain === mode,
    grainStrength: settings.grainStrength,
  };
}

/**
 * 49-03 (S6): reflection — the document fallback is authoritative; derive the
 * selector's active segment unambiguously (one-of, never a blank selector).
 * Solid non-white colors are not producible by the selector; if encountered
 * after document edits, the closest locked treatment is White (the selector's
 * only solid arm).
 */
export function reflectFallbackToBackgroundMode(fallback: BackgroundFallback): BackgroundSelectorMode {
  if (fallback.mode === 'transparent') return 'transparent';
  if (fallback.mode === 'solid') return 'white';
  return fallback.texture;
}

export function buildRotoBackgroundMetadata(settings: PhysicsPaintStudioSettings): PhysicPaintRotoBackgroundMetadata {
  const background = settings.background === 'photo' ? 'transparent' : settings.background;
  return {
    background,
    paperGrain: settings.paperGrain,
    grainStrength: settings.grainStrength,
    ...(background === 'white' ? { color: '#ffffff' } : {}),
  };
}

export function applyRotoBackgroundMetadataToSettings(metadata: PhysicPaintRotoBackgroundMetadata): PhysicsPaintStudioSettings {
  return {
    ...makeInitialPhysicsPaintStudioSettings(),
    background: metadata.background,
    paperGrain: metadata.paperGrain,
    grainStrength: metadata.grainStrength,
  };
}

export function applyRotoBackgroundMetadataToEngine(engine: EfxPaintEngine, metadata: PhysicPaintRotoBackgroundMetadata): void {
  engine.setBgMode(metadata.background);
  engine.setPaperGrain(metadata.paperGrain);
  engine.setEmbossStrength(metadata.grainStrength);
}
