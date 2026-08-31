import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEfxPaintDocument } from '../../../efx-paint/document/efxPaintDocument';
import {
  _setEfxPaintMarkDirtyCallback,
  getDocument,
  registerDocument,
  reset,
  setBackgroundFallback,
} from '../../../stores/efxPaintStore';
import {
  applyBackgroundFallbackToEngine,
  applyBackgroundFallbackToSettings,
  applyRotoBackgroundMetadataToEngine,
  applyRotoBackgroundMetadataToSettings,
  backgroundModeToFallback,
  buildRotoBackgroundMetadata,
  makeInitialPhysicsPaintStudioSettings,
  reflectFallbackToBackgroundMode,
  type BackgroundSelectorMode,
} from './physicsPaintStudioSettings';

describe('Physics Paint Studio settings', () => {
  beforeEach(() => {
    _setEfxPaintMarkDirtyCallback(() => {});
    reset();
  });

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

  // 49-03 Task 2 (S6): the Background swatch selector is the document fallback
  // config — write-through mapping + reflection, idempotent same-mode clicks,
  // and the D-11 'photo' absence on the fallback surface.
  it('49-03 T1: each selector mode maps to exactly one document fallback record (write-through)', () => {
    const settings = makeInitialPhysicsPaintStudioSettings();
    expect(backgroundModeToFallback('transparent', settings)).toEqual({ mode: 'transparent' });
    // White maps to the 49-01-gated solid #ffffff (no distinct 'white' literal).
    expect(backgroundModeToFallback('white', settings)).toEqual({ mode: 'solid', color: '#ffffff' });
    // Paper modes carry the current grain controls: paperGrain boolean = the
    // grain texture matches the selected paper; grainStrength carried directly.
    expect(backgroundModeToFallback('canvas1', settings)).toEqual({ mode: 'paper', texture: 'canvas1', paperGrain: true, grainStrength: 0.45 });
    expect(backgroundModeToFallback('canvas2', { paperGrain: 'canvas2', grainStrength: 0.65 })).toEqual({ mode: 'paper', texture: 'canvas2', paperGrain: true, grainStrength: 0.65 });
    expect(backgroundModeToFallback('canvas3', { paperGrain: 'canvas1', grainStrength: 0.35 })).toEqual({ mode: 'paper', texture: 'canvas3', paperGrain: false, grainStrength: 0.35 });
  });

  it('49-03 T2: the active segment resolves unambiguously from the document fallback (reflection)', () => {
    expect(reflectFallbackToBackgroundMode({ mode: 'transparent' })).toBe('transparent');
    expect(reflectFallbackToBackgroundMode({ mode: 'solid', color: '#ffffff' })).toBe('white');
    // Solid non-white colors are not producible by the selector; the closest
    // locked treatment is White — never a blank selector.
    expect(reflectFallbackToBackgroundMode({ mode: 'solid', color: '#112233' })).toBe('white');
    expect(reflectFallbackToBackgroundMode({ mode: 'paper', texture: 'canvas2', paperGrain: true, grainStrength: 0.18 })).toBe('canvas2');
  });

  it('49-03 T3: dispatching the current mode is a revision-stable no-op (no documentRevision bump, no dirty callback)', () => {
    const layerId = 'layer-fallback';
    const document = createEfxPaintDocument(layerId);
    registerDocument(document);
    const settings = makeInitialPhysicsPaintStudioSettings();
    const fallback = backgroundModeToFallback('canvas1', settings);
    const dirty = vi.fn();
    _setEfxPaintMarkDirtyCallback(dirty);

    const first = setBackgroundFallback(layerId, fallback);
    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error('expected ok');
    expect(first.descriptor).not.toBeNull();
    const revisionAfterFirst = getDocument(layerId)!.documentRevision;
    expect(revisionAfterFirst).toBe(document.documentRevision + 1);
    expect(dirty).toHaveBeenCalledTimes(1);

    // Same-mode dispatch → revision-stable no-op (the 1552-1569 lesson).
    const second = setBackgroundFallback(layerId, fallback);
    expect(second.ok).toBe(true);
    if (!second.ok) throw new Error('expected ok');
    expect(second.descriptor).toBeNull();
    expect(getDocument(layerId)!.documentRevision).toBe(revisionAfterFirst);
    expect(dirty).toHaveBeenCalledTimes(1);
  });

  // 49-04 (UAT fix): the document fallback is the single authority on open —
  // the selector mode AND the engine bgMode hydrate from it, so the selector,
  // engine, and monitor fond agree before the first click.
  it('49-04: hydrates the selector mode from the document fallback (transparent/solid/paper)', () => {
    expect(applyBackgroundFallbackToSettings({ mode: 'transparent' })).toMatchObject({ background: 'transparent' });
    expect(applyBackgroundFallbackToSettings({ mode: 'solid', color: '#ffffff' })).toMatchObject({ background: 'white' });
    // The paper arm carries its grain controls (paperGrain boolean → texture name).
    expect(applyBackgroundFallbackToSettings({ mode: 'paper', texture: 'canvas2', paperGrain: true, grainStrength: 0.65 })).toMatchObject({ background: 'canvas2', paperGrain: 'canvas2', grainStrength: 0.65 });
    expect(applyBackgroundFallbackToSettings({ mode: 'paper', texture: 'canvas3', paperGrain: false, grainStrength: 0.35 })).toMatchObject({ background: 'canvas3', paperGrain: '', grainStrength: 0.35 });
  });

  it('49-04: applies the document fallback to the engine bgMode (transparent/solid/paper)', () => {
    const engine = { setBgMode: vi.fn(), setPaperGrain: vi.fn(), setEmbossStrength: vi.fn() };
    applyBackgroundFallbackToEngine(engine as never, { mode: 'transparent' });
    expect(engine.setBgMode).toHaveBeenLastCalledWith('transparent');
    applyBackgroundFallbackToEngine(engine as never, { mode: 'solid', color: '#ffffff' });
    expect(engine.setBgMode).toHaveBeenLastCalledWith('white');
    applyBackgroundFallbackToEngine(engine as never, { mode: 'paper', texture: 'canvas1', paperGrain: true, grainStrength: 0.45 });
    expect(engine.setBgMode).toHaveBeenLastCalledWith('canvas1');
    expect(engine.setPaperGrain).toHaveBeenLastCalledWith('canvas1');
    expect(engine.setEmbossStrength).toHaveBeenLastCalledWith(0.45);
  });

  it('49-04: the fallback round-trip is stable — settings → fallback → settings', () => {
    const settings = makeInitialPhysicsPaintStudioSettings();
    for (const mode of ['transparent', 'white', 'canvas1', 'canvas2', 'canvas3'] as const) {
      const fallback = backgroundModeToFallback(mode, settings);
      const hydrated = applyBackgroundFallbackToSettings(fallback);
      expect(hydrated.background).toBe(mode);
    }
  });

  it('49-03 T4: the fallback surface carries no photo mode — the fixed 5-option map (D-11)', () => {
    const settings = makeInitialPhysicsPaintStudioSettings();
    const modes: readonly BackgroundSelectorMode[] = ['transparent', 'white', 'canvas1', 'canvas2', 'canvas3'];
    const mapped = modes.map((mode) => backgroundModeToFallback(mode, settings));
    // Exactly the fixed five selector modes — the union type excludes 'photo'
    // (BackgroundSelectorMode), and the runtime records stay within the five.
    expect(mapped).toHaveLength(5);
    expect(mapped.map((fallback) => fallback.mode)).toEqual(['transparent', 'solid', 'paper', 'paper', 'paper']);
    // The reflection never yields 'photo' either (typed out of the union).
    expect(reflectFallbackToBackgroundMode({ mode: 'transparent' }) as string).not.toBe('photo');
    expect(reflectFallbackToBackgroundMode({ mode: 'solid', color: '#ffffff' }) as string).not.toBe('photo');
    expect(reflectFallbackToBackgroundMode({ mode: 'paper', texture: 'canvas3', paperGrain: false, grainStrength: 0 }) as string).not.toBe('photo');
  });
});
