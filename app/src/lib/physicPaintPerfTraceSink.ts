/**
 * DEV-only perf-trace sink: receives the Studio's rolling performance snapshot
 * (physic-paint:perf-trace, emitted every 2s while profiling is enabled) and
 * rewrites <appdata>/studio-perf-trace.json so a live run can be read straight
 * off disk. The write lives on the parent because the child window holds no
 * fs:* capability (49-04 Pitfall 3 least-privilege contract). Never installed
 * outside DEV; the listener is inert until the child starts emitting.
 */
import { writeTextFile, BaseDirectory } from '@tauri-apps/plugin-fs';
import { PHYSIC_PAINT_PERF_TRACE_EVENT } from '../components/physic-paint/performance/physicsPaintPerformanceTrace';

const PROFILE_TRACE_FILE = 'studio-perf-trace.json';

export async function installPhysicPaintPerfTraceSink(): Promise<void> {
  if (!import.meta.env.DEV) return;
  try {
    const eventApi = await import('@tauri-apps/api/event');
    let inFlight = false;
    await eventApi.listen?.(PHYSIC_PAINT_PERF_TRACE_EVENT, (event) => {
      if (inFlight || typeof event.payload !== 'string') return;
      inFlight = true;
      void writeTextFile(PROFILE_TRACE_FILE, event.payload, { baseDir: BaseDirectory.AppData })
        .catch(() => undefined)
        .finally(() => { inFlight = false; });
    });
  } catch {
    // Non-Tauri runtime — no sink; the console profile API remains available.
  }
}
