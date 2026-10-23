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
import { activeModule } from '../../shared/activeModule';
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

/** Which inline confirmation is open. `none` is the two action buttons. */
type MemoryConfirmKind = 'none' | 'frame' | 'rail';

export function RightPanelMemoryTab({ ports, frame }: RightPanelMemoryTabProps) {
  // One signal for the lifetime of the tab — created in a ref (never a fresh
  // signal per render, never useState).
  const snapshotRef = useRef<Signal<ScriptMemorySnapshot | null> | null>(null);
  if (snapshotRef.current === null) snapshotRef.current = signal<ScriptMemorySnapshot | null>(null);
  const snapshotSignal = snapshotRef.current;
  // quick-261023-ors Task 2: the inline confirmation state is a signal in a
  // ref too — a click writes it, the render-body read re-renders this leaf,
  // and the memoized right panel never sees a prop change.
  const confirmRef = useRef<Signal<MemoryConfirmKind> | null>(null);
  if (confirmRef.current === null) confirmRef.current = signal<MemoryConfirmKind>('none');
  const confirmSignal = confirmRef.current;

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

  // Contextual gauge: the Studio runs one module at a time, so only that
  // module's script store is meaningful. Showing both rows always left one
  // side at zero on a real session.
  const isWatercolor = activeModule.value === 'watercolor';
  const scriptLabel = isWatercolor ? 'Watercolor' : 'Brush';
  const totals = isWatercolor ? snapshot.watercolor.totals : snapshot.brush.totals;
  const currentRow = buildStudioScriptMemoryFrameRows(snapshot).find(
    (row) => row.frame === currentFrame,
  );
  const frameStats = (isWatercolor ? currentRow?.watercolor : currentRow?.brush) ?? {
    strokes: 0,
    points: 0,
    approxBytes: 0,
  };
  const confirm = confirmSignal.value;
  // Per-key purge needs a script on the DISPLAYED frame; clear-all needs any
  // script at all on the active rail. Both stay disabled otherwise.
  const hasFrameScript = frameStats.strokes > 0;
  const hasAnyScript = totals.strokes > 0;

  // A successful purge refreshes the gauge IMMEDIATELY (the debounced revision
  // read is the fallback, not the contract), then closes the confirmation.
  const confirmPurge = (removed: boolean) => {
    if (removed) snapshotSignal.value = ports.read();
    confirmSignal.value = 'none';
  };

  return (
    <div class="physics-paint-memory-tab" data-testid="right-panel-memory-tab">
      <div class="physics-paint-memory-scripts">
        <div class="physics-paint-memory-total" data-memory-scripts-total>
          Scripts total · {scriptLabel}: {totals.strokes} strokes · {totals.points} points ·{' '}
          {formatScriptMemoryBytes(totals.approxBytes)}
        </div>
        <div
          class="physics-paint-memory-frame physics-paint-memory-frame-current"
          data-memory-frame-row={currentFrame}
        >
          <span class="physics-paint-memory-frame-label">{`Frame ${currentFrame}`}</span>
          <span class="physics-paint-memory-frame-stats">
            {hasFrameScript
              ? `${scriptLabel} ${frameStats.strokes} strokes · ${frameStats.points} points · ${formatScriptMemoryBytes(frameStats.approxBytes)}`
              : `No ${scriptLabel.toLowerCase()} script on this key`}
          </span>
        </div>
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
      <div class="physics-paint-memory-actions">
        {confirm === 'frame' ? (
          <div
            class="physics-paint-memory-confirm"
            role="group"
            aria-label={`Confirm purge of frame ${currentFrame}`}
            data-memory-confirm="frame"
          >
            <p class="physics-paint-memory-confirm-copy">
              Purge the script of Frame {currentFrame}? The painted pixels stay, but Move, Select
              and replay are lost for that key.
            </p>
            <div class="physics-paint-memory-confirm-actions">
              <button
                type="button"
                class="physics-paint-memory-confirm-cancel"
                onClick={() => {
                  confirmSignal.value = 'none';
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                class="physics-paint-memory-confirm-ok destructive"
                onClick={() => confirmPurge(ports.purgeFrame(currentFrame))}
              >
                Purge frame script
              </button>
            </div>
          </div>
        ) : confirm === 'rail' ? (
          <div
            class="physics-paint-memory-confirm physics-paint-memory-confirm-strong"
            role="group"
            aria-label="Confirm clear all scripts on the active rail"
            data-memory-confirm="rail"
          >
            <p class="physics-paint-memory-confirm-copy">
              Clear every script on the active rail (the track you are editing)? Every key of this
              rail loses its script; the painted pixels stay on every key.
            </p>
            <div class="physics-paint-memory-confirm-actions">
              <button
                type="button"
                class="physics-paint-memory-confirm-cancel"
                onClick={() => {
                  confirmSignal.value = 'none';
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                class="physics-paint-memory-confirm-ok destructive"
                onClick={() => confirmPurge(ports.clearRail())}
              >
                Clear all rail scripts
              </button>
            </div>
          </div>
        ) : (
          <div class="physics-paint-memory-action-row">
            <button
              type="button"
              class="physics-paint-memory-purge-frame"
              disabled={!hasFrameScript}
              onClick={() => {
                confirmSignal.value = 'frame';
              }}
            >
              {`Purge frame ${currentFrame} script`}
            </button>
            <button
              type="button"
              class="physics-paint-memory-clear-rail"
              disabled={!hasAnyScript}
              onClick={() => {
                confirmSignal.value = 'rail';
              }}
            >
              Clear all rail scripts
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
