import type { BgMode, EfxPaintEngine, ToolType } from '@efxlab/efx-physic-paint';
import type { AnimationWiggleConfig } from '@efxlab/efx-physic-paint/animation';
import type { PhysicPaintPlayRenderOptionsSnapshot, PhysicPaintRotoBackgroundMetadata } from '../../types/physicPaint';
import { normalizePlayWiggle } from './playFrameTransactions';

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

export function getPhysicsPaintRenderTool(settings: PhysicsPaintStudioSettings): PhysicPaintPlayRenderOptionsSnapshot['tool'] {
  if (settings.tool === 'erase') return 'erase';
  return settings.physicsMode === 'local' ? 'physics-paint' : 'normal-paint';
}

export function buildPlayRenderOptionsSnapshot(settings: PhysicsPaintStudioSettings, motion: AnimationWiggleConfig): PhysicPaintPlayRenderOptionsSnapshot {
  return {
    tool: getPhysicsPaintRenderTool(settings),
    color: settings.color,
    opacity: settings.opacity,
    brushSize: settings.size,
    background: settings.background,
    paperGrain: settings.paperGrain,
    grainStrength: settings.grainStrength,
    motion: normalizePlayWiggle(motion),
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

export function applyPlayRenderOptionsSnapshotToSettings(snapshot: PhysicPaintPlayRenderOptionsSnapshot): PhysicsPaintStudioSettings {
  return {
    ...makeInitialPhysicsPaintStudioSettings(),
    tool: snapshot.tool === 'erase' ? 'erase' : 'paint',
    physicsMode: snapshot.tool === 'physics-paint' ? 'local' : null,
    color: snapshot.color,
    opacity: snapshot.opacity,
    size: snapshot.brushSize,
    background: snapshot.background,
    paperGrain: snapshot.paperGrain,
    grainStrength: snapshot.grainStrength,
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

export function applyPlayRenderOptionsToEngine(engine: EfxPaintEngine, options: PhysicPaintPlayRenderOptionsSnapshot): void {
  engine.setTool(options.tool === 'erase' ? 'erase' : 'paint');
  engine.setPhysicsMode(options.tool === 'physics-paint' ? 'local' : null);
  engine.setColorHex(options.color);
  engine.setBrushOpacity(options.opacity);
  engine.setBrushSize(options.brushSize);
  engine.setBgMode(options.background);
  engine.setPaperGrain(options.paperGrain);
  engine.setEmbossStrength(options.grainStrength);
}
