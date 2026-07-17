import { describe, expect, it, vi } from 'vitest';
import { createPhysicsPaintPaneResizeDrag, getPhysicsPaintSessionControlState } from './PhysicsPaintRightPanel';

class PointerTarget extends EventTarget {
  captured = true;
  released: number[] = [];

  hasPointerCapture() { return this.captured; }
  releasePointerCapture(pointerId: number) { this.released.push(pointerId); this.captured = false; }
}

function pointerEvent(type: string, clientY = 0): PointerEvent {
  const event = new Event(type) as PointerEvent;
  Object.defineProperty(event, 'clientY', { value: clientY });
  return event;
}

describe('Physics Paint right panel session controls', () => {
  it.each(['pointerup', 'pointercancel'] as const)('releases capture and removes resize listeners on %s', (endEvent) => {
    const target = new PointerTarget();
    const resize = vi.fn();
    createPhysicsPaintPaneResizeDrag({ target: target as unknown as HTMLElement, pointerId: 7, resize });

    target.dispatchEvent(pointerEvent('pointermove', 44));
    target.dispatchEvent(pointerEvent(endEvent));
    target.dispatchEvent(pointerEvent('pointermove', 88));

    expect(resize).toHaveBeenCalledOnce();
    expect(resize).toHaveBeenCalledWith(44);
    expect(target.released).toEqual([7]);
  });

  it('removes resize listeners on lost pointer capture and explicit unmount cleanup', () => {
    const lostTarget = new PointerTarget();
    const lostResize = vi.fn();
    createPhysicsPaintPaneResizeDrag({ target: lostTarget as unknown as HTMLElement, pointerId: 7, resize: lostResize });
    lostTarget.dispatchEvent(new Event('lostpointercapture'));
    lostTarget.dispatchEvent(pointerEvent('pointermove', 44));
    expect(lostResize).not.toHaveBeenCalled();

    const unmountedTarget = new PointerTarget();
    const unmountedResize = vi.fn();
    const cleanup = createPhysicsPaintPaneResizeDrag({ target: unmountedTarget as unknown as HTMLElement, pointerId: 8, resize: unmountedResize });
    cleanup();
    unmountedTarget.dispatchEvent(pointerEvent('pointermove', 55));
    unmountedTarget.dispatchEvent(pointerEvent('pointerup'));
    expect(unmountedResize).not.toHaveBeenCalled();
    expect(unmountedTarget.released).toEqual([]);
  });

  it('disables visible Save and Load controls only for the mutation lock duration', () => {
    expect(getPhysicsPaintSessionControlState(true)).toEqual({
      saveDisabled: true,
      loadDisabled: true,
      loadClass: 'physics-paint-text-button physics-paint-load-state disabled-control',
    });
    expect(getPhysicsPaintSessionControlState(false)).toEqual({
      saveDisabled: false,
      loadDisabled: false,
      loadClass: 'physics-paint-text-button physics-paint-load-state',
    });
  });
});
