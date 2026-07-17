import { describe, expect, it, vi } from 'vitest';
import {
  applyRotoBackgroundMetadataToEngine,
  applyRotoBackgroundMetadataToSettings,
  buildRotoBackgroundMetadata,
  makeInitialPhysicsPaintStudioSettings,
} from './physicsPaintStudioSettings';

describe('Physics Paint Studio settings', () => {
  it('keeps the established painting defaults', () => {
    expect(makeInitialPhysicsPaintStudioSettings()).toMatchObject({
      tool: 'paint', color: '#103c65', size: 6, opacity: 100,
      background: 'canvas1', paperGrain: 'canvas1', grainStrength: 0.45,
      edgeDetail: 4, pickup: 0, eraseStrength: 50, smoothing: 0, spread: 50,
      physicsMode: 'local', activePhysicsAction: null,
    });
  });

  it('preserves Roto paper metadata and maps photo to transparent', () => {
    const settings = makeInitialPhysicsPaintStudioSettings();
    expect(buildRotoBackgroundMetadata({ ...settings, background: 'photo' })).toMatchObject({ background: 'transparent', paperGrain: 'canvas1', grainStrength: 0.45 });
    expect(buildRotoBackgroundMetadata({ ...settings, background: 'white' })).toMatchObject({ background: 'white', color: '#ffffff' });
    expect(applyRotoBackgroundMetadataToSettings({ background: 'white', paperGrain: 'rough', grainStrength: 0.7, color: '#ffffff' })).toMatchObject({ background: 'white', paperGrain: 'rough', grainStrength: 0.7 });
  });

  it('applies Roto background metadata through the engine interface', () => {
    const engine = { setBgMode: vi.fn(), setPaperGrain: vi.fn(), setEmbossStrength: vi.fn() };
    applyRotoBackgroundMetadataToEngine(engine as never, { background: 'transparent', paperGrain: 'canvas2', grainStrength: 0.9 });
    expect(engine.setBgMode).toHaveBeenCalledWith('transparent');
    expect(engine.setPaperGrain).toHaveBeenCalledWith('canvas2');
    expect(engine.setEmbossStrength).toHaveBeenCalledWith(0.9);
  });
});
