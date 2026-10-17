/**
 * 261017-mdr: the Studio warm-up hook schedules for procedural papers, skips
 * non-procedural ids, and does not re-schedule the same input set.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const hookRuntime = vi.hoisted(() => ({
  refs: [] as Array<{ current: unknown }>,
  effects: [] as Array<() => void>,
  cursor: 0,
  reset() {
    this.refs = [];
    this.effects = [];
    this.cursor = 0;
  },
}));

const warmupRuntime = vi.hoisted(() => ({
  scheduled: [] as Array<{ paperTexture: string; width: number; height: number; grainScale: number }>,
  thumbWarmups: 0,
  reset() {
    this.scheduled = [];
    this.thumbWarmups = 0;
  },
}));

vi.mock('preact/hooks', () => ({
  useEffect: (fn: () => void) => {
    hookRuntime.effects.push(fn);
  },
  useRef: <Value>(initial: Value) => {
    const index = hookRuntime.cursor++;
    hookRuntime.refs[index] ??= { current: initial };
    return hookRuntime.refs[index] as { current: Value };
  },
}));

vi.mock('../../../lib/projectPaperRaster', () => ({
  isProceduralPaperTexture: (id: string) =>
    id.startsWith('paper/') && !(id.startsWith('paper/real-') || id === 'canvas1' || id === 'canvas2' || id === 'canvas3'),
}));

vi.mock('../../../lib/paperSheetWarmup', () => ({
  scheduleProceduralPaperWarmup: (input: { paperTexture: string; width: number; height: number; grainScale: number }) => {
    warmupRuntime.scheduled.push(input);
  },
}));

vi.mock('../view/PaperPicker', () => ({
  warmProceduralReliefThumbs: () => {
    warmupRuntime.thumbWarmups += 1;
  },
}));

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { usePaperSheetWarmup } from './usePaperSheetWarmup';

function mount(input: { paperTexture: string; width: number; height: number; grainScale: number }): void {
  hookRuntime.reset();
  usePaperSheetWarmup(input);
  for (const effect of hookRuntime.effects) effect();
}

beforeEach(() => {
  hookRuntime.reset();
  warmupRuntime.reset();
});

describe('261017-mdr usePaperSheetWarmup', () => {
  it('schedules the sheet warm-up and the picker thumbs for a procedural paper', () => {
    mount({ paperTexture: 'paper/cold-press', width: 64, height: 48, grainScale: 1 });
    expect(warmupRuntime.scheduled).toEqual([
      { paperTexture: 'paper/cold-press', width: 64, height: 48, grainScale: 1 },
    ]);
    expect(warmupRuntime.thumbWarmups).toBe(1);
  });

  it('skips non-procedural papers (jpg arm is decode-cached elsewhere)', () => {
    mount({ paperTexture: 'paper/real-1', width: 64, height: 48, grainScale: 1 });
    mount({ paperTexture: 'canvas1', width: 64, height: 48, grainScale: 1 });
    mount({ paperTexture: 'photo', width: 64, height: 48, grainScale: 1 });
    expect(warmupRuntime.scheduled).toEqual([]);
    expect(warmupRuntime.thumbWarmups).toBe(0);
  });

  it('skips hostile sizes / grain scale', () => {
    mount({ paperTexture: 'paper/cold-press', width: 0, height: 48, grainScale: 1 });
    mount({ paperTexture: 'paper/cold-press', width: 64, height: -1, grainScale: 1 });
    mount({ paperTexture: 'paper/cold-press', width: 64, height: 48, grainScale: 0 });
    expect(warmupRuntime.scheduled).toEqual([]);
    expect(warmupRuntime.thumbWarmups).toBe(0);
  });

  it('a second mount with the same inputs does not re-schedule (no rebuild)', () => {
    // Same hook instance across a re-render: cursor rewinds, refs persist.
    hookRuntime.reset();
    const input = { paperTexture: 'paper/kraft', width: 32, height: 32, grainScale: 2 };
    usePaperSheetWarmup(input);
    hookRuntime.effects[0]();
    hookRuntime.cursor = 0;
    hookRuntime.effects.length = 0;
    usePaperSheetWarmup(input);
    hookRuntime.effects[0]();
    expect(warmupRuntime.scheduled).toHaveLength(1);
    expect(warmupRuntime.thumbWarmups).toBe(1);
  });

  it('a changed input set schedules again', () => {
    hookRuntime.reset();
    usePaperSheetWarmup({ paperTexture: 'paper/cold-press', width: 32, height: 32, grainScale: 1 });
    hookRuntime.effects[0]();
    hookRuntime.cursor = 0;
    hookRuntime.effects.length = 0;
    usePaperSheetWarmup({ paperTexture: 'paper/rough', width: 32, height: 32, grainScale: 1 });
    hookRuntime.effects[0]();
    expect(warmupRuntime.scheduled).toHaveLength(2);
    expect(warmupRuntime.scheduled[1].paperTexture).toBe('paper/rough');
    expect(warmupRuntime.thumbWarmups).toBe(2);
  });

  it('source-scan: PaperPicker grid constants stay locked (CELL_SIZE = 64, GRID_GAP = 8)', () => {
    const pickerPath = resolve(dirname(fileURLToPath(import.meta.url)), '../view/PaperPicker.tsx');
    const source = readFileSync(pickerPath, 'utf8');
    expect(source).toContain('const CELL_SIZE = 64');
    expect(source).toContain('const GRID_GAP = 8');
    expect(source).toContain('gridTemplateColumns: `repeat(3, ${CELL_SIZE}px)`');
    expect(source).toContain('export function warmProceduralReliefThumbs');
  });
});
