import { describe, expect, it, vi } from 'vitest';
import {
  applyPlayRenderOptionsSnapshotToSettings,
  applyPlayRenderOptionsToEngine,
  applyRotoBackgroundMetadataToEngine,
  applyRotoBackgroundMetadataToSettings,
  buildPlayRenderOptionsSnapshot,
  buildRotoBackgroundMetadata,
  makeInitialPhysicsPaintStudioSettings,
} from './physicsPaintStudioSettings';

describe('Physics Paint Studio settings', () => {
  it('keeps the established defaults and maps Play tools exactly', () => {
    const settings = makeInitialPhysicsPaintStudioSettings();

    expect(settings).toMatchObject({
      tool: 'paint', color: '#103c65', size: 6, opacity: 100,
      background: 'canvas1', paperGrain: 'canvas1', grainStrength: 0.45,
      edgeDetail: 4, pickup: 0, eraseStrength: 50, smoothing: 0, spread: 50,
      physicsMode: 'local', activePhysicsAction: null,
    });
    expect(buildPlayRenderOptionsSnapshot(settings, { strokeDeformation: 4, strokePosition: 8 }).tool).toBe('physics-paint');
    expect(buildPlayRenderOptionsSnapshot({ ...settings, physicsMode: null }, { strokeDeformation: 4, strokePosition: 8 }).tool).toBe('normal-paint');
    expect(buildPlayRenderOptionsSnapshot({ ...settings, tool: 'erase' }, { strokeDeformation: 4, strokePosition: 8 }).tool).toBe('erase');
  });

  it('preserves Roto paper metadata and maps photo to transparent', () => {
    const settings = makeInitialPhysicsPaintStudioSettings();

    expect(buildRotoBackgroundMetadata({ ...settings, background: 'photo' })).toMatchObject({
      background: 'transparent', paperGrain: 'canvas1', grainStrength: 0.45,
    });
    expect(buildRotoBackgroundMetadata({ ...settings, background: 'white' })).toMatchObject({
      background: 'white', color: '#ffffff',
    });
    expect(applyRotoBackgroundMetadataToSettings({ background: 'white', paperGrain: 'rough', grainStrength: 0.7, color: '#ffffff' })).toMatchObject({
      background: 'white', paperGrain: 'rough', grainStrength: 0.7,
    });
  });

  it('applies Play and Roto options through the unchanged engine API calls', () => {
    const engine = {
      setTool: vi.fn(), setPhysicsMode: vi.fn(), setColorHex: vi.fn(), setBrushOpacity: vi.fn(), setBrushSize: vi.fn(),
      setBgMode: vi.fn(), setPaperGrain: vi.fn(), setEmbossStrength: vi.fn(),
    };

    applyPlayRenderOptionsToEngine(engine as never, {
      tool: 'physics-paint', color: '#123456', opacity: 80, brushSize: 9,
      background: 'white', paperGrain: 'linen', grainStrength: 0.2,
      motion: { strokeDeformation: 0, strokePosition: 0 },
    });
    applyRotoBackgroundMetadataToEngine(engine as never, { background: 'transparent', paperGrain: 'canvas2', grainStrength: 0.9 });

    expect(engine.setTool).toHaveBeenCalledWith('paint');
    expect(engine.setPhysicsMode).toHaveBeenCalledWith('local');
    expect(engine.setColorHex).toHaveBeenCalledWith('#123456');
    expect(engine.setBrushOpacity).toHaveBeenCalledWith(80);
    expect(engine.setBrushSize).toHaveBeenCalledWith(9);
    expect(engine.setBgMode).toHaveBeenNthCalledWith(1, 'white');
    expect(engine.setPaperGrain).toHaveBeenNthCalledWith(1, 'linen');
    expect(engine.setEmbossStrength).toHaveBeenNthCalledWith(1, 0.2);
    expect(engine.setBgMode).toHaveBeenLastCalledWith('transparent');
    expect(engine.setPaperGrain).toHaveBeenLastCalledWith('canvas2');
    expect(engine.setEmbossStrength).toHaveBeenLastCalledWith(0.9);
  });

  it('restores Play option settings without changing the selected mapping', () => {
    expect(applyPlayRenderOptionsSnapshotToSettings({
      tool: 'normal-paint', color: '#abcdef', opacity: 40, brushSize: 12,
      background: 'transparent', paperGrain: 'none', grainStrength: 0,
      motion: { strokeDeformation: 0, strokePosition: 0 },
    })).toMatchObject({ tool: 'paint', physicsMode: null, color: '#abcdef', size: 12 });
  });
});
