// ============================================================
//  aquarelleWetPaintGate (261029-lel) — the Water tool is
//  available only while the live sheet holds standing water.
//
//  The store is published by the live canvas layer's rAF tick;
//  the rail, the four-tool row and the W shortcut all read it.
//  These tests pin the store contract and the wiring literals so
//  a future edit cannot quietly drop a surface from the gate.
// ============================================================

import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { aquarelleActiveTool, setAquarelleTool } from './aquarelleRecordState';
import {
  aquarelleHasWetPaint,
  aquarelleWaterAvailable,
  clearAquarelleWetPaint,
  setAquarelleHasWetPaint,
} from './aquarelleWetPaintGate';

beforeEach(() => {
  clearAquarelleWetPaint();
  setAquarelleTool('brush');
});

describe('aquarelleHasWetPaint store', () => {
  it('starts closed', () => {
    expect(aquarelleHasWetPaint.peek()).toBe(false);
    expect(aquarelleWaterAvailable()).toBe(false);
  });

  it('declares `false` as the module default (never persisted)', () => {
    const src = readFileSync(resolve(__dirname, './aquarelleWetPaintGate.ts'), 'utf8');
    expect(src).toContain('export const aquarelleHasWetPaint = signal(false);');
  });

  it('flips on a set and mirrors the value through aquarelleWaterAvailable()', () => {
    setAquarelleHasWetPaint(true);
    expect(aquarelleHasWetPaint.peek()).toBe(true);
    expect(aquarelleWaterAvailable()).toBe(true);

    setAquarelleHasWetPaint(false);
    expect(aquarelleHasWetPaint.peek()).toBe(false);
    expect(aquarelleWaterAvailable()).toBe(false);
  });

  it('a repeated same-value set leaves the value unchanged', () => {
    setAquarelleHasWetPaint(true);
    setAquarelleHasWetPaint(true);
    expect(aquarelleHasWetPaint.peek()).toBe(true);

    setAquarelleHasWetPaint(false);
    setAquarelleHasWetPaint(false);
    expect(aquarelleHasWetPaint.peek()).toBe(false);
  });

  it('only notifies subscribers when the value actually changes', () => {
    const seen: boolean[] = [];
    const unsubscribe = aquarelleHasWetPaint.subscribe((value) => seen.push(value));
    try {
      setAquarelleHasWetPaint(true);
      setAquarelleHasWetPaint(true);
      setAquarelleHasWetPaint(false);
      setAquarelleHasWetPaint(false);
    } finally {
      unsubscribe();
    }
    // Preact signals calls the subscriber once on subscribe, then only on
    // real changes — the repeated sets added nothing.
    expect(seen).toEqual([false, true, false]);
  });
});

describe('aquarelleHasWetPaint tool fallback', () => {
  it('drops an active Water tool to Brush on the true -> false transition', () => {
    setAquarelleHasWetPaint(true);
    setAquarelleTool('water');
    setAquarelleHasWetPaint(false);
    expect(aquarelleActiveTool.peek()).toBe('brush');
  });

  it('leaves any other active tool alone', () => {
    setAquarelleHasWetPaint(true);
    setAquarelleTool('pen');
    setAquarelleHasWetPaint(false);
    expect(aquarelleActiveTool.peek()).toBe('pen');
  });

  it('clearAquarelleWetPaint() never mutates the tool', () => {
    setAquarelleHasWetPaint(true);
    setAquarelleTool('water');
    clearAquarelleWetPaint();
    expect(aquarelleHasWetPaint.peek()).toBe(false);
    expect(aquarelleActiveTool.peek()).toBe('water');
  });
});

describe('wiring contracts (261029-lel)', () => {
  it('the left rail disables only the Water entry and guards its click', () => {
    const rail = readFileSync(resolve(__dirname, './PhysicsPaintToolRail.tsx'), 'utf8');
    expect(rail).toContain('disabled={disabled || (id === \'water\' && !wetAvailable)}');
    expect(rail).toContain('if (id === \'water\' && !aquarelleHasWetPaint.peek()) return;');
    expect(rail).toContain("title={waterGated ? 'Water (W) — needs standing water'");
    // Brush / Pen / Eraser must keep the plain frame/session `disabled`.
    const body = rail.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(body).not.toContain('id === \'brush\' && !wetAvailable');
    expect(body).not.toContain('id === \'pen\' && !wetAvailable');
    expect(body).not.toContain('id === \'lift\' && !wetAvailable');
  });

  it('the live canvas layer publishes from the rAF tick only while no stroke is in flight', () => {
    const src = readFileSync(resolve(__dirname, '../engine/AquarelleCanvasLayer.tsx'), 'utf8');
    expect(src).toContain('if (!painting) setAquarelleHasWetPaint(engine.hasStandingWater)');
    expect(src).toContain('clearAquarelleWetPaint();');
    // The wet truth is the dedicated getter — never isAwake (also true during
    // the Dry fix bake and the post-stroke min-awake window).
    const body = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(body).not.toContain('setAquarelleHasWetPaint(engine.isAwake)');
  });
});
