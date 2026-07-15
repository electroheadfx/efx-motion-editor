import { describe, expect, it, vi } from 'vitest';
import { EfxPaintEngine } from './EfxPaintEngine';
import { compositeWetLayer } from '../render/compositor';
import type { BrushOpts, PenPoint, WetBuffers } from '../types';

function makeCanvas() {
  const calls: string[] = [];
  const context = {
    clearRect: vi.fn(),
    drawImage: vi.fn((source: { __name?: string }) => calls.push(source.__name ?? 'unknown')),
  };
  const canvas = { width: 0, height: 0, getContext: () => context, toDataURL: () => 'data:image/png;base64,bGl2ZS1hbHBoYQ==' } as unknown as HTMLCanvasElement;
  return { canvas, calls };
}

describe('EfxPaintEngine live alpha cache boundary', () => {
  it('copies only the already-rendered dry and display paint surfaces', () => {
    const output = makeCanvas();
    vi.stubGlobal('document', { createElement: vi.fn(() => output.canvas) });
    const renderVisibleWetLayer = vi.fn();
    const flushPendingStrokeFinalizations = vi.fn();
    const engine = Object.create(EfxPaintEngine.prototype) as EfxPaintEngine;
    Object.assign(engine as object, {
      width: 12,
      height: 8,
      dualCanvas: {
        dryCanvas: { __name: 'dry' },
        displayCanvas: { __name: 'display' },
        previewBaseCanvas: { __name: 'preview-base' },
      },
      previewBackgroundSeparated: true,
      renderVisibleWetLayer,
      flushPendingStrokeFinalizations,
    });

    const copied = engine.copyLiveAlphaCanvas();

    expect(copied).toBe(output.canvas);
    expect(output.calls).toEqual(['dry', 'display']);
    expect(renderVisibleWetLayer).toHaveBeenCalledOnce();
    expect(flushPendingStrokeFinalizations).not.toHaveBeenCalled();
  });

  it('reports separated snapshot stages with the active mutation id', () => {
    const output = makeCanvas();
    vi.stubGlobal('document', { createElement: vi.fn(() => output.canvas) });
    const samples: Array<{ stage: string; mutationId?: number; branch?: string }> = [];
    const engine = Object.create(EfxPaintEngine.prototype) as EfxPaintEngine;
    Object.assign(engine as object, {
      width: 12,
      height: 8,
      activeMutationId: 17,
      performanceListener: (sample: { stage: string; mutationId?: number; branch?: string }) => samples.push(sample),
      dualCanvas: {
        dryCanvas: { __name: 'dry' },
        displayCanvas: { __name: 'display' },
      },
      previewBackgroundSeparated: true,
      renderVisibleWetLayer: vi.fn(),
    });

    engine.copyLiveAlphaCanvas();

    expect(samples).toEqual(expect.arrayContaining([
      expect.objectContaining({ stage: 'live-alpha-render-wet', mutationId: 17, branch: 'separated' }),
      expect.objectContaining({ stage: 'live-alpha-allocate', mutationId: 17, branch: 'separated' }),
      expect.objectContaining({ stage: 'live-alpha-draw-dry', mutationId: 17, branch: 'separated' }),
      expect.objectContaining({ stage: 'live-alpha-draw-display', mutationId: 17, branch: 'separated' }),
    ]));
  });

  it('reports primitive samples with the active mutation id', () => {
    const samples: Array<{ stage: string; mutationId?: number; durationMs: number }> = [];
    const engine = Object.create(EfxPaintEngine.prototype) as EfxPaintEngine;
    Object.assign(engine as object, {
      activeMutationId: 29,
      performanceListener: (sample: { stage: string; mutationId?: number; durationMs: number }) => samples.push(sample),
    });

    const recordPaintPrimitive = (engine as unknown as { recordPaintPrimitive: (stage: string, durationMs: number) => void }).recordPaintPrimitive;
    recordPaintPrimitive.call(engine, 'paint-transfer-pixel-loop', 12.5);

    expect(samples).toEqual([
      expect.objectContaining({ stage: 'paint-transfer-pixel-loop', mutationId: 29, durationMs: 12.5 }),
    ]);
  });

  it('does not emit performance samples without a listener', () => {
    const output = makeCanvas();
    vi.stubGlobal('document', { createElement: vi.fn(() => output.canvas) });
    const engine = Object.create(EfxPaintEngine.prototype) as EfxPaintEngine;
    Object.assign(engine as object, {
      width: 12,
      height: 8,
      performanceListener: null,
      dualCanvas: {
        dryCanvas: { __name: 'dry' },
        displayCanvas: { __name: 'display' },
      },
      previewBackgroundSeparated: true,
      renderVisibleWetLayer: vi.fn(),
    });

    expect(() => engine.copyLiveAlphaCanvas()).not.toThrow();
  });

  it('preserves displayed wet alpha when local pre-stroke preparation bakes a distant stroke', () => {
    const wet: WetBuffers = {
      r: new Float32Array([120]),
      g: new Float32Array([30]),
      b: new Float32Array([60]),
      alpha: new Float32Array([800]),
      wetness: new Float32Array([100]),
      strokeOpacity: new Float32Array([1]),
    };
    const displayed = new Uint8ClampedArray(4);
    compositeWetLayer({
      createImageData: () => ({ data: displayed }),
      putImageData: vi.fn(),
    } as unknown as CanvasRenderingContext2D, wet, 1, 1, () => 0.5);

    const dryData = new Uint8ClampedArray(4);
    const engine = Object.create(EfxPaintEngine.prototype) as EfxPaintEngine & Record<string, any>;
    const opts: BrushOpts = {
      size: 6, opacity: 100, pressure: 70, waterAmount: 50,
      dryAmount: 30, edgeDetail: 4, pickup: 0, eraseStrength: 50, antiAlias: 0,
    };
    const nextPoint: PenPoint = { x: 100, y: 100, p: 0.5, tx: 0, ty: 0, tw: 0, spd: 0 };
    Object.assign(engine, {
      width: 1,
      height: 1,
      size: 1,
      wet,
      savedWet: {
        r: new Float32Array(1), g: new Float32Array(1), b: new Float32Array(1),
        alpha: new Float32Array(1), strokeOpacity: new Float32Array(1),
      },
      drying: { dryPos: new Float32Array(1) },
      state: { physicsMode: 'local' },
      performanceListener: null,
      stopNaturalDrying: vi.fn(),
      dualCanvas: {
        dryCtx: {
          getImageData: () => ({ data: dryData }),
          putImageData: vi.fn(),
        },
      },
    });

    engine.prepareWetLayerForStroke(nextPoint, opts);

    expect(Array.from(dryData)).toEqual(Array.from(displayed));
    expect(wet.alpha[0]).toBe(0);
  });

  it('publishes finalized Undo only after restored surfaces are ready for automatic cache capture', () => {
    const output = makeCanvas();
    vi.stubGlobal('document', { createElement: vi.fn(() => output.canvas) });
    const dryCanvas = { __name: 'after-latest' };
    const displayCanvas = { __name: 'wet-after-latest' };
    const mutationEvents: Array<{ kind: string; mutationId: number; copiedSurfaces: string[] }> = [];
    const engine = Object.create(EfxPaintEngine.prototype) as EfxPaintEngine;
    Object.assign(engine as object, {
      width: 1,
      height: 1,
      activeMutationId: null,
      lastCompletedMutationId: null,
      performanceListener: null,
      completedMutationListener: null,
      pendingStrokeFinalizations: [],
      activeStrokeFinalization: null,
      strokeFinalizationScheduled: false,
      undoStack: [{
        mutationId: 2,
        actions: [{ mutationId: 2 }],
        deferred: null,
        checkpoint: {
        mutationId: 2,
        canvas: { id: 'before-latest' },
        wet: {
          r: new Float32Array([11]), g: new Float32Array([12]), b: new Float32Array([13]),
          a: new Float32Array([14]), w: new Float32Array([15]), dp: new Float32Array([16]), so: new Float32Array([0.4]),
        },
        saved: {
          r: new Float32Array([17]), g: new Float32Array([18]), b: new Float32Array([19]),
          a: new Float32Array([20]), so: new Float32Array([0.5]),
        },
        },
      }],
      redoStack: [],
      allActions: [{ mutationId: 1 }, { mutationId: 2 }],
      dualCanvas: {
        dryCanvas,
        displayCanvas,
        dryCtx: {
          putImageData: vi.fn((image: { id: string }) => { dryCanvas.__name = image.id; }),
        },
      },
      previewBackgroundSeparated: true,
      wet: {
        r: new Float32Array([91]), g: new Float32Array([92]), b: new Float32Array([93]),
        alpha: new Float32Array([94]), wetness: new Float32Array([95]), strokeOpacity: new Float32Array([0.9]),
      },
      savedWet: {
        r: new Float32Array([97]), g: new Float32Array([98]), b: new Float32Array([99]),
        alpha: new Float32Array([100]), strokeOpacity: new Float32Array([1]),
      },
      drying: { dryPos: new Float32Array([96]) },
      captureUndoSnapshot: vi.fn(() => ({ mutationId: 2 })),
      renderVisibleWetLayer: vi.fn(() => { displayCanvas.__name = `wet-${engine.wet.alpha[0]}`; }),
    });
    engine.setCompletedMutationListener((mutation) => {
      output.calls.length = 0;
      engine.copyLiveAlphaCanvas();
      mutationEvents.push({ ...mutation, copiedSurfaces: [...output.calls] });
    });

    engine.undo();

    expect(mutationEvents).toEqual([{
      kind: 'undo',
      isEmpty: false,
      mutationId: 2,
      copiedSurfaces: ['before-latest', 'wet-14'],
    }]);
  });

  it('publishes finalized Redo after restored surfaces are ready for automatic cache capture', () => {
    const listener = vi.fn();
    const engine = Object.create(EfxPaintEngine.prototype) as EfxPaintEngine & Record<string, any>;
    Object.assign(engine, {
      nextMutationId: 3,
      completedMutationListener: listener,
      undoStack: [],
      redoStack: [{ mutationId: 2, actions: [{ mutationId: 2 }], deferred: null, checkpoint: {
        mutationId: 2, canvas: { id: 'after-latest' },
        wet: { r: new Float32Array([1]), g: new Float32Array([2]), b: new Float32Array([3]), a: new Float32Array([4]), w: new Float32Array([5]), dp: new Float32Array([6]), so: new Float32Array([0.7]) },
        saved: { r: new Float32Array([7]), g: new Float32Array([8]), b: new Float32Array([9]), a: new Float32Array([10]), so: new Float32Array([0.8]) },
      } }],
      allActions: [{ mutationId: 1 }],
      captureUndoSnapshot: vi.fn(() => ({ mutationId: 2 })),
      restoreUndoSnapshot: vi.fn(),
      notifyCompletedMutation: EfxPaintEngine.prototype['notifyCompletedMutation'],
      performanceListener: null,
      lastCompletedMutationId: null,
    });

    expect(engine.redo()).toBe(true);
    expect(listener).toHaveBeenCalledWith({ kind: 'redo', isEmpty: false, mutationId: 2 });
    expect(engine.allActions).toEqual([{ mutationId: 1 }, { mutationId: 2 }]);
  });

  it('does not notify Undo when no visible mutation is available', () => {
    const listener = vi.fn();
    const engine = Object.create(EfxPaintEngine.prototype) as EfxPaintEngine;
    Object.assign(engine as object, {
      completedMutationListener: listener,
      pendingStrokeFinalizations: [],
      strokeFinalizationScheduled: false,
      strokeFinalizationQueuedAt: 0,
      undoStack: [],
      allActions: [],
    });

    engine.undo();
    expect(listener).not.toHaveBeenCalled();
  });
});
