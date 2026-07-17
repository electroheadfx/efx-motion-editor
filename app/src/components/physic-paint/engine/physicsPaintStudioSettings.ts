import type { BgMode, EfxPaintEngine, ToolType } from '@efxlab/efx-physic-paint';
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
