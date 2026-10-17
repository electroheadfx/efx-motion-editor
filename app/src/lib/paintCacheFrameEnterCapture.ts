// paint-cache-empty-frame-on-key: measure-only /tmp JSON capture. The app
// writes JSON to /tmp (established convention — paperFondCapture.ts). Each
// frame-enter display read and cache-write commit records one event so the
// next natural occurrence names which arm ran and whether the write landed
// after the read.

import { physicPaintVersion } from '../stores/physicPaintStore';

export const PAINT_CACHE_FRAME_ENTER_PATH = '/tmp/paint-cache-frame-enter.json';

type PaintCacheCaptureEvent = { at: number; tag: string; [key: string]: unknown };

const events: PaintCacheCaptureEvent[] = [];
let writeTimer: ReturnType<typeof setTimeout> | null = null;

export function capturePaintCacheEvent(tag: string, data: Record<string, unknown>): void {
  events.push({ at: Date.now(), tag, ...data });
  if (events.length > 400) events.splice(0, events.length - 400);
  if (writeTimer !== null) return;
  writeTimer = setTimeout(() => {
    writeTimer = null;
    void writePaintCacheCapture();
  }, 120);
}

/** Snapshot of the paint-version clock at read time (peek — no subscription). */
export function peekPaintVersionForCapture(): number {
  return physicPaintVersion.peek();
}

async function writePaintCacheCapture(): Promise<void> {
  try {
    const bytes = new TextEncoder().encode(JSON.stringify(events, null, 2));
    const { exportWritePng } = await import('./ipc');
    await exportWritePng('/tmp', 'paint-cache-frame-enter.json', Array.from(bytes));
  } catch {
    // Capture must never break the Studio.
  }
}
