// ============================================================
//  RightPanelMemoryTab — the LAST top-pane tab (quick 261023-ors).
//
//  READ-ONLY script-memory gauge plus the purge entry points:
//    - Scripts: watercolor timeline + brush session store
//      ({strokes, points, approxBytes} per frame and total)
//    - Frame caches / LRU: the raster/bitmap footprint, in its
//      OWN section, never folded into a script total
//
//  Motion/Static Rails are derived Loop Clips with no key scripts;
//  the gauge reads only the watercolor and brush stores, so a rail
//  can never appear in a row.
//
//  REACTIVITY (38-11 signal-bypasses-memo): the snapshot lives in a
//  signal created ONCE inside a useRef — never useState, never a
//  fresh useSignal per render. The render body reads `.value` (this
//  leaf re-renders through its own subscription), so the memoized
//  right panel keeps its identity-stable props.
//
//  Cost law (T-261023-ors-03): one read on mount, a 250 ms debounced
//  read after either script revision, and a 2 s interval for the
//  cache stats (plain getters, not signals). Nothing is computed
//  while the tab is unmounted, and the Studio render body never
//  subscribes to a store revision.
// ============================================================

import { useEffect, useRef } from 'preact/hooks';
import { effect, signal, type Signal } from '@preact/signals';
import {
  buildStudioScriptMemoryFrameRows,
  formatScriptMemoryBytes,
  type StudioScriptMemorySectionPorts,
} from '../performance/studioScriptMemoryGauge';
import type { ScriptMemorySnapshot } from '../performance/scriptMemorySnapshot';
import { aquarelleStrokesRevision } from './aquarelleRecordState';
import { brushScriptRevision } from './brushScriptRecordState';

/** Debounce after a script revision before the estimator walks the stores. */
export const MEMORY_GAUGE_DEBOUNCE_MS = 250;
/** Cache stats are plain getters — a slow interval keeps them fresh cheaply. */
export const MEMORY_GAUGE_CACHE_INTERVAL_MS = 2000;

export interface RightPanelMemoryTabProps {
  ports: StudioScriptMemorySectionPorts;
  /** The Studio's current app frame (drives the current-frame marker). */
  frame: Signal<number>;
}

export function RightPanelMemoryTab({ ports, frame }: RightPanelMemoryTabProps) {
  // One signal for the lifetime of the tab — created in a ref (never a fresh
  // signal per render, never useState).
  const snapshotRef = useRef<Signal<ScriptMemorySnapshot | null> | null>(null);
  if (snapshotRef.current === null) snapshotRef.current = signal<ScriptMemorySnapshot | null>(null);
  const snapshotSignal = snapshotRef.current;

  useEffect(() => {
    // Mount read: the first paint already has figures.
    snapshotSignal.value = ports.read();
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let seedRun = true;
    // ONE subscription for both stores. The first run is this effect's own
    // seed read; every later revision schedules one debounced re-read.
    const disposeSubscription = effect(() => {
      aquarelleStrokesRevision.value;
      brushScriptRevision.value;
      if (seedRun) {
        seedRun = false;
        return;
      }
      if (debounceTimer !== null) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        snapshotSignal.value = ports.read();
      }, MEMORY_GAUGE_DEBOUNCE_MS);
    });
    const cacheInterval = setInterval(() => {
      snapshotSignal.value = ports.read();
    }, MEMORY_GAUGE_CACHE_INTERVAL_MS);
    return () => {
      disposeSubscription();
      if (debounceTimer !== null) clearTimeout(debounceTimer);
      clearInterval(cacheInterval);
    };
  }, [ports, snapshotSignal]);

  const snapshot = snapshotSignal.value;
  const currentFrame = frame.value;

  if (snapshot === null) {
    return (
      <div class="physics-paint-memory-tab" data-testid="right-panel-memory-tab">
        <div class="physics-paint-memory-unavailable">
          Script memory is unavailable in this session.
        </div>
      </div>
    );
  }

  const rows = buildStudioScriptMemoryFrameRows(snapshot);
  const scriptsBytes = snapshot.watercolor.totals.approxBytes + snapshot.brush.totals.approxBytes;
  const scriptsStrokes = snapshot.watercolor.totals.strokes + snapshot.brush.totals.strokes;
  const scriptsPoints = snapshot.watercolor.totals.points + snapshot.brush.totals.points;

  return (
    <div class="physics-paint-memory-tab" data-testid="right-panel-memory-tab">
      <div class="physics-paint-memory-scripts">
        <div class="physics-paint-memory-total" data-memory-scripts-total>
          Scripts total: {scriptsStrokes} strokes · {scriptsPoints} points ·{' '}
          {formatScriptMemoryBytes(scriptsBytes)}
        </div>
        <div class="physics-paint-memory-line physics-paint-memory-line-watercolor">
          Watercolor: {snapshot.watercolor.totals.strokes} strokes ·{' '}
          {snapshot.watercolor.totals.points} points ·{' '}
          {formatScriptMemoryBytes(snapshot.watercolor.totals.approxBytes)}
        </div>
        <div class="physics-paint-memory-line physics-paint-memory-line-brush">
          Brush: {snapshot.brush.totals.strokes} strokes · {snapshot.brush.totals.points} points ·{' '}
          {formatScriptMemoryBytes(snapshot.brush.totals.approxBytes)}
        </div>
        {rows.map((row) => (
          <div
            key={row.frame}
            class={`physics-paint-memory-frame${row.frame === currentFrame ? ' physics-paint-memory-frame-current' : ''}`}
            data-memory-frame-row={row.frame}
          >
            <span class="physics-paint-memory-frame-label">{`Frame ${row.frame}`}</span>
            <span class="physics-paint-memory-frame-watercolor">
              Watercolor {row.watercolor.strokes} strokes ·{' '}
              {formatScriptMemoryBytes(row.watercolor.approxBytes)}
            </span>
            <span class="physics-paint-memory-frame-brush">
              Brush {row.brush.strokes} strokes · {formatScriptMemoryBytes(row.brush.approxBytes)}
            </span>
          </div>
        ))}
      </div>
      <div class="physics-paint-memory-caches">
        <div class="physics-paint-memory-cache-total" data-memory-cache-total>
          Frame caches: {formatScriptMemoryBytes(snapshot.frameCache.totalBytes)}
        </div>
        {snapshot.frameCache.caches.map((cache) => (
          <div key={cache.name} class="physics-paint-memory-cache-row">
            <span class="physics-paint-memory-cache-name">{cache.name}</span>
            <span class="physics-paint-memory-cache-bytes">
              {formatScriptMemoryBytes(cache.byteTotalBytes)} · {cache.entryCount} entries
            </span>
          </div>
        ))}
      </div>
      <p class="physics-paint-memory-warning">
        Purging keeps the painted pixels but removes the script — Move, Select and replay are
        lost for that key.
      </p>
    </div>
  );
}
