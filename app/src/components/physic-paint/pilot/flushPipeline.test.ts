import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createFinalizationLifecycle } from './finalizationMachine';
import { createFinalizationQueue, type FinalizationQueue } from './finalizationQueue';
import { createFlushPipeline, type FlushQueuePort } from './flushPipeline';

/**
 * 52.2-15 (D-16, sensitivity-map rows 2 and 4): the flush pipeline's contract —
 * one serialized drain that (a) waits out the gesture's queued captures, (b)
 * joins a concurrent request onto the same in-flight promise (one drain, one
 * result), (c) preserves the caller's step order, and (d) resolves — never
 * rejects — on failure and interruption.
 *
 * The queue is the REAL plan-14 queue (its lifecycle seam is the §3.8 test
 * seam): a capture submitted mid-gesture parks on the machine's drainable
 * gate, so the mid-gesture case proves the drain waits for it rather than
 * racing it.
 */

const yieldMacrotask = (): Promise<void> => new Promise<void>((resolveTick) => {
  setTimeout(resolveTick, 0);
});

/** The Studio-side shape of the port: a forced drain that opens the gate for the span of the drain. */
function forcedQueuePort(queue: FinalizationQueue): FlushQueuePort {
  return {
    drain: async () => {
      const release = queue.beginFlush();
      try {
        await queue.drain();
      } finally {
        release();
      }
    },
    interrupt: () => queue.interrupt(),
  };
}

function newHarness() {
  const lifecycle = createFinalizationLifecycle();
  const queue = createFinalizationQueue({ lifecycle });
  const pipeline = createFlushPipeline({ lifecycle, queue: forcedQueuePort(queue) });
  return { lifecycle, queue, pipeline };
}

describe('flush pipeline: one serialized drain', () => {
  it('joins a concurrent request onto the in-flight drain — one drain, one push', async () => {
    const { pipeline } = newHarness();
    const calls: string[] = [];
    let releaseStep!: () => void;
    const stepHold = new Promise<void>((resolveHold) => { releaseStep = resolveHold; });
    const first = pipeline.flush({ steps: [async () => { calls.push('drain-start'); await stepHold; }, () => { calls.push('push'); }] });
    expect(pipeline.inFlight).toBe(true);
    const second = pipeline.flush({ steps: [() => { calls.push('second-start'); }, () => { calls.push('second-push'); }] });
    releaseStep();
    const [firstOutcome, secondOutcome] = await Promise.all([first, second]);

    // Count the pushes (never assert a boolean): two overlapping requests
    // produce exactly one drain and one push.
    expect(calls.filter((call) => call === 'push')).toHaveLength(1);
    expect(calls).not.toContain('second-push');
    expect(secondOutcome).toBe(firstOutcome);
    expect(firstOutcome.status).toBe('flushed');
    expect(pipeline.inFlight).toBe(false);
  });

  it('waits out the gesture’s queued captures before starting the drain', async () => {
    const { lifecycle, queue, pipeline } = newHarness();
    const calls: string[] = [];
    let releaseProduce!: () => void;
    const produceHold = new Promise<void>((resolveHold) => { releaseProduce = resolveHold; });
    // A gesture in flight: the capture submitted at its end parks on the gate.
    lifecycle.pointerDown(1);
    lifecycle.pointerUp(0);
    const capture = queue.submit({
      produce: async () => {
        calls.push('capture-produce');
        await produceHold;
        return 'pixels';
      },
      commit: () => {
        calls.push('capture-commit');
      },
    });
    const flushPromise = pipeline.flush({
      steps: [
        () => { calls.push('engine-settle'); },
        () => { calls.push('queued-captures'); },
        () => { calls.push('push'); },
      ],
    });
    await yieldMacrotask();
    await yieldMacrotask();
    // The drain has not started while the gesture's capture is still running.
    expect(calls).not.toContain('engine-settle');
    expect(calls).not.toContain('push');

    releaseProduce();
    await capture;
    const outcome = await flushPromise;

    expect(outcome.status).toBe('flushed');
    expect(calls).toEqual(['capture-produce', 'capture-commit', 'engine-settle', 'queued-captures', 'push']);
  });

  it('preserves the caller’s step order: engine settle, then queued captures, then the push', async () => {
    const { queue, pipeline } = newHarness();
    const order: string[] = [];
    const outcome = await pipeline.flush({
      steps: [
        () => { order.push('engine-settle'); },
        async () => {
          order.push('queued-captures');
          const release = queue.beginFlush();
          try {
            await queue.drain();
          } finally {
            release();
          }
        },
        async () => { order.push('document-sync-push'); },
      ],
    });

    expect(outcome.status).toBe('flushed');
    expect(outcome.completedSteps).toBe(3);
    expect(order).toEqual(['engine-settle', 'queued-captures', 'document-sync-push']);
  });

  it('resolves with a failed outcome when a step throws — never a rejection', async () => {
    const { pipeline } = newHarness();
    const calls: string[] = [];
    const failure = new Error('documentSync push failed');
    const outcome = await pipeline.flush({
      steps: [
        () => { calls.push('engine-settle'); },
        () => { throw failure; },
        () => { calls.push('push'); },
      ],
    });

    expect(outcome.status).toBe('failed');
    expect(outcome.error).toBe(failure);
    expect(outcome.completedSteps).toBe(1);
    expect(calls).toEqual(['engine-settle']);
    expect(pipeline.inFlight).toBe(false);
  });

  it('settles an interrupted drain with the interruption observable in the result', async () => {
    const { pipeline } = newHarness();
    const calls: string[] = [];
    let releaseStep!: () => void;
    const stepHold = new Promise<void>((resolveHold) => { releaseStep = resolveHold; });
    const flushPromise = pipeline.flush({
      steps: [
        async () => {
          calls.push('engine-settle');
          await stepHold;
        },
        () => { calls.push('push'); },
      ],
    });
    await yieldMacrotask();
    pipeline.interrupt();
    releaseStep();

    const outcome = await flushPromise;
    expect(outcome.status).toBe('interrupted');
    expect(calls).toEqual(['engine-settle']);
    expect(pipeline.inFlight).toBe(false);
  });

  it('runs a fresh drain once the in-flight one has settled', async () => {
    const { pipeline } = newHarness();
    const calls: string[] = [];
    const first = await pipeline.flush({ steps: [() => { calls.push('first-push'); }] });
    const second = await pipeline.flush({ steps: [() => { calls.push('second-push'); }] });

    expect(first.status).toBe('flushed');
    expect(second.status).toBe('flushed');
    expect(calls).toEqual(['first-push', 'second-push']);
  });
});

describe('flush pipeline: pilot boundary (D-17, D-19)', () => {
  const APP_ROOT = resolve(__dirname, '../../../..');
  const PILOT_MODULE = resolve(APP_ROOT, 'src/components/physic-paint/pilot/flushPipeline.ts');
  const FLUSH_FACADE = resolve(APP_ROOT, 'src/lib/physicPaintFlush.ts');

  /** Line/block-comment stripper (the clean-break pattern): prose cannot fail the gate, imports can. */
  function stripComments(source: string): string {
    let out = '';
    let index = 0;
    let inBlock = false;
    while (index < source.length) {
      const pair = source.slice(index, index + 2);
      if (inBlock) {
        if (pair === '*/') {
          inBlock = false;
          index += 2;
          continue;
        }
        index += 1;
        continue;
      }
      if (pair === '/*') {
        inBlock = true;
        index += 2;
        continue;
      }
      if (pair === '//') {
        while (index < source.length && source[index] !== '\n') index += 1;
        continue;
      }
      out += source[index];
      index += 1;
    }
    return out;
  }

  function collectSourceFiles(root: string): string[] {
    const found: string[] = [];
    for (const entry of readdirSync(root)) {
      const path = join(root, entry);
      if (statSync(path).isDirectory()) {
        found.push(...collectSourceFiles(path));
        continue;
      }
      if (/\.(ts|tsx)$/.test(entry)) found.push(path);
    }
    return found;
  }

  /** Static (`from '...'`) and dynamic (`import('...')`) specifiers alike. */
  function importedSpecifiers(source: string): string[] {
    return [...source.matchAll(/(?:from\s+|import\s*\(\s*)['"]([^'"]+)['"]/g)].map((match) => match[1]);
  }

  it('keeps the pipeline module free of lib and store imports', () => {
    const source = stripComments(readFileSync(PILOT_MODULE, 'utf8'));
    const importPaths = importedSpecifiers(source);

    expect(importPaths.length).toBeGreaterThan(0);
    expect(importPaths.filter((path) => path.includes('/lib/') || path.includes('/stores/'))).toEqual([]);
    expect(source).not.toContain('physicPaintFlush');
  });

  it('keeps the flush facade library-free — no xstate, no effect, no pilot import', () => {
    const source = readFileSync(FLUSH_FACADE, 'utf8');
    const importPaths = importedSpecifiers(source);

    // The facade may have zero static imports (its Tauri API is dynamic) — the
    // scan proves it read the file, and checks every specifier it does carry.
    expect(source.length).toBeGreaterThan(0);
    expect(importPaths.filter((path) => /^(xstate|effect)(\/|$)/.test(path))).toEqual([]);
    expect(importPaths.filter((path) => path.includes('physic-paint/pilot'))).toEqual([]);
  });

  it('holds the pilot directory out of every lib and store module', () => {
    const scanned: string[] = [];
    const offenders: string[] = [];
    for (const root of [resolve(APP_ROOT, 'src/lib'), resolve(APP_ROOT, 'src/stores')]) {
      for (const path of collectSourceFiles(root)) {
        const source = stripComments(readFileSync(path, 'utf8'));
        scanned.push(relative(APP_ROOT, path));
        if (source.includes('physic-paint/pilot')) offenders.push(relative(APP_ROOT, path));
      }
    }

    // A scan that reads nothing cannot fail, so the scanned list is asserted
    // non-empty before the offenders are (there are none).
    expect(scanned.length).toBeGreaterThan(10);
    expect(offenders).toEqual([]);
  });
});
