import { describe, expect, it, vi } from 'vitest';
import { defaultTransform, type Layer } from '../types/layer';
import { createPhysicPaintLaunchContext, openPhysicPaintCanvas, PHYSIC_PAINT_LAUNCH_EVENT } from './physicPaintBridge';

function physicLayer(overrides: Partial<Layer> = {}): Layer {
  return {
    id: 'phys-layer-1',
    name: 'Physic Paint',
    type: 'physic-paint',
    visible: true,
    opacity: 1,
    blendMode: 'normal',
    transform: defaultTransform(),
    source: { type: 'physic-paint', layerId: 'phys-layer-1' },
    ...overrides,
  };
}

describe('physicPaintBridge', () => {
  it('creates launch context with layer, frame, operation, and canvas dimensions', () => {
    const context = createPhysicPaintLaunchContext(physicLayer({ name: 'Water smoke' }), 12, { width: 1920, height: 1080 });

    expect(context).toMatchObject({
      layerId: 'phys-layer-1',
      layerName: 'Water smoke',
      startFrame: 12,
      width: 1920,
      height: 1080,
    });
    expect(context.operationId).toMatch(/^physic-paint-/);
  });

  it('rejects non physics paint layers before opening a window', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue({ focus: vi.fn() } as unknown as Window);
    const result = await openPhysicPaintCanvas({ layer: physicLayer({ type: 'paint', source: { type: 'paint', layerId: 'paint-1' } }), frame: 0 });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('physic-paint');
    expect(open).not.toHaveBeenCalled();
    open.mockRestore();
  });

  it('uses browser fallback with encoded launch context when Tauri APIs are unavailable', async () => {
    const focus = vi.fn();
    const open = vi.spyOn(window, 'open').mockReturnValue({ focus } as unknown as Window);

    const result = await openPhysicPaintCanvas({ layer: physicLayer(), frame: 4, canvas: { width: 1280, height: 720 } });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.layerId).toBe('phys-layer-1');
      expect(result.data.startFrame).toBe(4);
    }
    expect(open).toHaveBeenCalledTimes(1);
    const url = String(open.mock.calls[0][0]);
    expect(url).toContain('/physics-paint');
    expect(url).toContain('context=');
    expect(focus).toHaveBeenCalled();
    open.mockRestore();
  });

  it('exports the launch event name for the Tauri path', () => {
    expect(PHYSIC_PAINT_LAUNCH_EVENT).toBe('physic-paint:launch');
  });
});
