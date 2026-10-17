/**
 * 261017-mz9: the only main-thread door to procedural paper-sheet generation.
 *
 * projectPaperRaster and paperSheetWarmup both go through requestProceduralSheet.
 * The heavy work lives in paperSheet.worker.ts (GPU-first on OffscreenCanvas,
 * CPU field fallback) — this module owns the worker singleton, the in-flight
 * dedup, the resolved cache, and the /tmp capture row writer.
 *
 * Failures resolve null and log a warn — never reject into the Studio.
 */
import { normalizeGrainScale } from './paperSheetField';

export type ProceduralSheetPath = 'worker-gpu' | 'worker-cpu';

export interface ProceduralSheetRequest {
  paperTexture: string;
  width: number;
  height: number;
  grainScale: number;
}

export interface ProceduralSheetResult {
  path: ProceduralSheetPath;
  fieldWidth: number;
  fieldHeight: number;
  durationMs: number;
  pixels: Uint8ClampedArray;
}

export type PaperSheetCapturePath = ProceduralSheetPath | 'cache-hit';

export interface PaperSheetCaptureRow {
  path: PaperSheetCapturePath;
  requestedWidth: number;
  requestedHeight: number;
  fieldWidth: number;
  fieldHeight: number;
  durationMs: number;
}

/** App-writes-/tmp convention (lookDeltaCapture) — exact filename the plan reads. */
export const PAPER_SHEET_CAPTURE_PATH = '/tmp/efx-paper-sheet-capture.json';

interface WorkerResponse {
  requestKey: string;
  path: ProceduralSheetPath;
  fieldWidth: number;
  fieldHeight: number;
  durationMs: number;
  pixels: ArrayBuffer | null;
}

/**
 * Same string shape as the fond cache key (${paperTexture}|1|${width}x${height}|
 * ${normalized}) so request keys and cache keys stay one namespace.
 */
export function proceduralSheetRequestKey(request: ProceduralSheetRequest): string {
  const normalized = normalizeGrainScale(request.grainScale);
  return `${request.paperTexture}|1|${request.width}x${request.height}|${normalized}`;
}

type PendingSettle = {
  request: ProceduralSheetRequest;
  finish: (result: ProceduralSheetResult | null) => void;
};

const inFlight = new Map<string, Promise<ProceduralSheetResult | null>>();
const pendingByKey = new Map<string, PendingSettle>();
const resolved = new Map<string, ProceduralSheetResult | null>();
const loggedCacheHits = new Set<string>();
const captureRows: PaperSheetCaptureRow[] = [];

let worker: Worker | null = null;

function appendCaptureRow(row: PaperSheetCaptureRow): void {
  captureRows.push(row);
  void writeCapture();
}

async function writeCapture(): Promise<void> {
  try {
    const bytes = new TextEncoder().encode(JSON.stringify(captureRows, null, 2));
    const { exportWritePng } = await import('./ipc');
    // export_write_png writes arbitrary bytes to dir/filename (atomic
    // tmp+rename). The filename must stay exact: the plan reads the path verbatim.
    await exportWritePng('/tmp', 'efx-paper-sheet-capture.json', Array.from(bytes));
  } catch (error) {
    console.warn('[paper-sheet] capture write failed', error);
  }
}

function settleRequest(
  requestKey: string,
  request: ProceduralSheetRequest,
  response: WorkerResponse | null,
): ProceduralSheetResult | null {
  if (!response || !response.pixels) {
    resolved.set(requestKey, null);
    return null;
  }
  const result: ProceduralSheetResult = {
    path: response.path,
    fieldWidth: response.fieldWidth,
    fieldHeight: response.fieldHeight,
    durationMs: response.durationMs,
    pixels: new Uint8ClampedArray(response.pixels),
  };
  resolved.set(requestKey, result);
  appendCaptureRow({
    path: result.path,
    requestedWidth: request.width,
    requestedHeight: request.height,
    fieldWidth: result.fieldWidth,
    fieldHeight: result.fieldHeight,
    durationMs: result.durationMs,
  });
  return result;
}

function handleWorkerResponse(response: WorkerResponse | null, requestKey: string): void {
  const pending = pendingByKey.get(requestKey);
  if (!pending) return;
  pendingByKey.delete(requestKey);
  inFlight.delete(requestKey);
  const result = settleRequest(requestKey, pending.request, response);
  pending.finish(result);
}

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./paperSheet.worker.ts', import.meta.url), { type: 'module' });
    worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
      const response = event.data;
      if (!response || typeof response.requestKey !== 'string') return;
      handleWorkerResponse(response, response.requestKey);
    });
    worker.addEventListener('error', (event) => {
      console.warn('[paper-sheet] worker error', event);
      for (const requestKey of [...pendingByKey.keys()]) {
        handleWorkerResponse(null, requestKey);
      }
    });
  }
  return worker;
}

/**
 * Request one procedural sheet. Two concurrent calls with the same key share
 * one worker request; a settled key is a pure cache hit (logged once per key).
 * Never rejects.
 */
export function requestProceduralSheet(
  request: ProceduralSheetRequest,
): Promise<ProceduralSheetResult | null> {
  const requestKey = proceduralSheetRequestKey(request);

  if (resolved.has(requestKey)) {
    const cached = resolved.get(requestKey) ?? null;
    if (!loggedCacheHits.has(requestKey)) {
      loggedCacheHits.add(requestKey);
      appendCaptureRow({
        path: 'cache-hit',
        requestedWidth: request.width,
        requestedHeight: request.height,
        fieldWidth: cached?.fieldWidth ?? 0,
        fieldHeight: cached?.fieldHeight ?? 0,
        durationMs: 0,
      });
    }
    return Promise.resolve(cached);
  }

  const pending = inFlight.get(requestKey);
  if (pending) return pending;

  const promise = new Promise<ProceduralSheetResult | null>((resolve) => {
    let settled = false;
    const finish = (result: ProceduralSheetResult | null) => {
      if (settled) return;
      settled = true;
      inFlight.delete(requestKey);
      resolve(result);
    };

    try {
      pendingByKey.set(requestKey, { request, finish });
      getWorker().postMessage({
        requestKey,
        paperTexture: request.paperTexture,
        width: request.width,
        height: request.height,
        grainScale: request.grainScale,
      });
    } catch (error) {
      console.warn('[paper-sheet] request failed', error);
      pendingByKey.delete(requestKey);
      resolved.set(requestKey, null);
      finish(null);
    }
  });

  inFlight.set(requestKey, promise);
  return promise;
}

/** Test-only deep reset — production keeps the worker and caches for the session. */
export function resetPaperSheetClientForTests(): void {
  inFlight.clear();
  pendingByKey.clear();
  resolved.clear();
  loggedCacheHits.clear();
  captureRows.length = 0;
  if (worker) {
    worker.terminate();
    worker = null;
  }
}
