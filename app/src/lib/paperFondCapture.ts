// studio-reopen-paper-washout: measure-only capture. The app writes JSON to
// /tmp (established convention — never console-copy). Each event rewrites the
// whole file so the disk state is always the latest, even mid-repro.
export const PAPER_FOND_CAPTURE_PATH = '/tmp/studio-reopen-paper-washout.json';

type PaperFondCaptureEvent = { at: number; tag: string; [key: string]: unknown };

const events: PaperFondCaptureEvent[] = [];
let writeTimer: ReturnType<typeof setTimeout> | null = null;

export function capturePaperFond(tag: string, data: Record<string, unknown>): void {
  events.push({ at: Date.now(), tag, ...data });
  if (events.length > 400) events.splice(0, events.length - 400);
  if (writeTimer !== null) return;
  writeTimer = setTimeout(() => {
    writeTimer = null;
    void writePaperFondCapture();
  }, 120);
}

async function writePaperFondCapture(): Promise<void> {
  try {
    const bytes = new TextEncoder().encode(JSON.stringify(events, null, 2));
    const { exportWritePng } = await import('./ipc');
    await exportWritePng('/tmp', 'studio-reopen-paper-washout.json', Array.from(bytes));
  } catch {
    // Capture must never break the Studio.
  }
}

/**
 * Measure-only: dump the layer-stack computed styles so a covering layer is
 * visible in the capture (the fond canvas is proven dense — the wash-out is
 * whatever sits on top of it).
 */
export function captureLayerStack(root: HTMLElement | null): void {
  if (!root) return;
  const describe = (selector: string): Record<string, string> | null => {
    const element = root.querySelector(selector) ?? document.querySelector(selector);
    if (!element) return { missing: 'true' };
    const style = getComputedStyle(element);
    return {
      className: element.className,
      display: style.display,
      visibility: style.visibility,
      opacity: style.opacity,
      zIndex: style.zIndex,
      mixBlendMode: style.mixBlendMode,
      isolation: style.isolation,
      backgroundColor: style.backgroundColor,
      position: style.position,
    };
  };
  capturePaperFond('layer-stack', {
    fondLayer: describe('.physics-paint-fond-layer'),
    fondCanvas: describe('.physics-paint-cached-roto-playback-background'),
    tracksGroup: describe('.physics-paint-tracks-group'),
    shell: describe('.demo-canvas-shell'),
    paintCanvas: describe('.paint-canvas'),
    engineSurface: describe('.physics-paint-engine-surface'),
    aquarelleLayer: describe('.aquarelle-live-layer'),
    aquarelleCanvas: describe('.aquarelle-live-canvas'),
    programMonitor: describe('.physics-paint-program-monitor'),
  });
}
