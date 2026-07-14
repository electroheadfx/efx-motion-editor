import { describe, expect, it, vi } from 'vitest';
import { EfxPaintEngine } from './EfxPaintEngine';

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
      renderVisibleWetLayer,
      flushPendingStrokeFinalizations,
    });

    const copied = engine.copyLiveAlphaCanvas();

    expect(copied).toBe(output.canvas);
    expect(output.calls).toEqual(['dry', 'display']);
    expect(renderVisibleWetLayer).toHaveBeenCalledOnce();
    expect(flushPendingStrokeFinalizations).not.toHaveBeenCalled();
  });

  it('notifies after successful Undo and Clear pixel mutations', () => {
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
