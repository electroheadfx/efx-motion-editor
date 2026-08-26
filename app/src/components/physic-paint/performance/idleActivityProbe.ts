// TEMPORARY 47 leak-hunt instrumentation (DEV only). Counts what executes in
// the paint window between probe ticks: rAF fires, timer fires, listener
// registrations, observer callbacks, Preact renders, canvas readbacks. If ALL
// counters stay ~0 while RSS climbs, the growth is WebKit-internal with no JS
// on the stack; whichever counter climbs names the driver. Delete after the
// hunt (search IDLE-ACTIVITY-PROBE).

import { options } from 'preact';

const counts = new Map<string, number>();

function bump(name: string, amount = 1): void {
  counts.set(name, (counts.get(name) ?? 0) + amount);
}

export function installIdleActivityProbe(): void {
  if (!import.meta.env.DEV || typeof window === 'undefined') return;
  const w = window as unknown as { __idleActivityProbeInstalled?: boolean };
  if (w.__idleActivityProbeInstalled) return;
  w.__idleActivityProbeInstalled = true;

  try {
    window.localStorage?.setItem('efx.physicsPaint.profile', '1');
  } catch { /* probe must never break the session */ }

  const originalRaf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (callback: FrameRequestCallback): number => (
    originalRaf((time) => { bump('raf.fire'); callback(time); })
  );

  const originalSetInterval = window.setInterval.bind(window);
  window.setInterval = ((handler: TimerHandler, timeout?: number, ...args: unknown[]): number => (
    originalSetInterval(() => {
      bump(`interval.${timeout ?? '?'}ms.fire`);
      if (typeof handler === 'function') handler(...args);
    }, timeout, ...args)
  )) as typeof window.setInterval;

  const originalSetTimeout = window.setTimeout.bind(window);
  window.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]): number => (
    originalSetTimeout(() => {
      bump(`timeout.${timeout ?? '?'}ms.fire`);
      if (typeof handler === 'function') handler(...args);
    }, timeout, ...args)
  )) as typeof window.setTimeout;

  const originalAddEventListener = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (type, listener, options) {
    bump(`listener.add.${type}`);
    return originalAddEventListener.call(this, type, listener, options);
  };

  const OriginalMutationObserver = window.MutationObserver;
  window.MutationObserver = class extends OriginalMutationObserver {
    constructor(callback: MutationCallback) {
      super((records, observer) => {
        bump('mutationObserver.fire', records.length);
        callback(records, observer);
      });
    }
  };

  const OriginalResizeObserver = window.ResizeObserver;
  window.ResizeObserver = class extends OriginalResizeObserver {
    constructor(callback: ResizeObserverCallback) {
      super((entries, observer) => {
        bump('resizeObserver.fire', entries.length);
        callback(entries, observer);
      });
    }
  };

  const internalOptions = options as unknown as { __r?: (vnode: unknown) => void };
  const originalRenderOption = internalOptions.__r;
  internalOptions.__r = (vnode: unknown) => {
    bump('preact.render');
    originalRenderOption?.(vnode);
  };

  const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
  CanvasRenderingContext2D.prototype.getImageData = function (this: CanvasRenderingContext2D, ...args: unknown[]) {
    bump('canvas.getImageData');
    return (originalGetImageData as unknown as (...a: unknown[]) => ImageData).apply(this, args);
  } as typeof CanvasRenderingContext2D.prototype.getImageData;
  const originalPutImageData = CanvasRenderingContext2D.prototype.putImageData;
  CanvasRenderingContext2D.prototype.putImageData = function (this: CanvasRenderingContext2D, ...args: unknown[]) {
    bump('canvas.putImageData');
    return (originalPutImageData as (...a: unknown[]) => void).apply(this, args);
  } as typeof CanvasRenderingContext2D.prototype.putImageData;
  const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
  HTMLCanvasElement.prototype.toDataURL = function (this: HTMLCanvasElement, ...args: unknown[]) {
    bump('canvas.toDataURL');
    return (originalToDataURL as (...a: unknown[]) => string).apply(this, args);
  } as typeof HTMLCanvasElement.prototype.toDataURL;
}

/** Delta since the last snapshot; clears the counters. */
export function snapshotIdleActivity(): Record<string, number> {
  const out = Object.fromEntries(counts);
  counts.clear();
  return out;
}
