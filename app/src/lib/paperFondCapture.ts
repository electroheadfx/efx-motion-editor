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
