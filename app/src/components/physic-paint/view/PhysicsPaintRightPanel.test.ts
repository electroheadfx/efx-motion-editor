import { describe, expect, it, vi } from 'vitest';
import { createPhysicsPaintPaneResizeDrag, getPhysicsPaintSessionControlState } from './PhysicsPaintRightPanel';

class PointerTarget extends EventTarget {
  captured = true;
  released: number[] = [];

  hasPointerCapture() { return this.captured; }
  releasePointerCapture(pointerId: number) { this.released.push(pointerId); this.captured = false; }
}

function pointerEvent(type: string, clientY = 0, pointerId = 7): PointerEvent {
  const event = new Event(type) as PointerEvent;
  Object.defineProperties(event, {
    clientY: { value: clientY },
    pointerId: { value: pointerId },
  });
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

  it('ignores move and end events from another pointer', () => {
    const target = new PointerTarget();
    const resize = vi.fn();
    createPhysicsPaintPaneResizeDrag({ target: target as unknown as HTMLElement, pointerId: 7, resize });

    target.dispatchEvent(pointerEvent('pointermove', 44, 8));
    target.dispatchEvent(pointerEvent('pointerup', 0, 8));
    target.dispatchEvent(pointerEvent('pointermove', 55, 7));

    expect(resize).toHaveBeenCalledOnce();
    expect(resize).toHaveBeenCalledWith(55);
    expect(target.released).toEqual([]);
  });

  it('removes resize listeners and releases capture on lost capture and explicit unmount cleanup', () => {
    const lostTarget = new PointerTarget();
    const lostResize = vi.fn();
    createPhysicsPaintPaneResizeDrag({ target: lostTarget as unknown as HTMLElement, pointerId: 7, resize: lostResize });
    lostTarget.dispatchEvent(new Event('lostpointercapture'));
    lostTarget.dispatchEvent(pointerEvent('pointermove', 44));
    expect(lostResize).not.toHaveBeenCalled();
    expect(lostTarget.released).toEqual([7]);

    const unmountedTarget = new PointerTarget();
    const unmountedResize = vi.fn();
    const cleanup = createPhysicsPaintPaneResizeDrag({ target: unmountedTarget as unknown as HTMLElement, pointerId: 8, resize: unmountedResize });
    cleanup();
    unmountedTarget.dispatchEvent(pointerEvent('pointermove', 55));
    unmountedTarget.dispatchEvent(pointerEvent('pointerup'));
    expect(unmountedResize).not.toHaveBeenCalled();
    expect(unmountedTarget.released).toEqual([8]);
    cleanup();
    expect(unmountedTarget.released).toEqual([8]);
  });

  it('releases the previous drag before a replacement drag captures the same handle', () => {
    const target = new PointerTarget();
    const firstResize = vi.fn();
    const firstCleanup = createPhysicsPaintPaneResizeDrag({ target: target as unknown as HTMLElement, pointerId: 7, resize: firstResize });

    firstCleanup();
    target.captured = true;
    const secondResize = vi.fn();
    createPhysicsPaintPaneResizeDrag({ target: target as unknown as HTMLElement, pointerId: 8, resize: secondResize });
    target.dispatchEvent(pointerEvent('pointermove', 66, 7));
    target.dispatchEvent(pointerEvent('pointermove', 77, 8));
    target.dispatchEvent(pointerEvent('pointercancel', 0, 8));

    expect(target.released).toEqual([7, 8]);
    expect(firstResize).not.toHaveBeenCalled();
    expect(secondResize).toHaveBeenCalledOnce();
    expect(secondResize).toHaveBeenCalledWith(77);
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
