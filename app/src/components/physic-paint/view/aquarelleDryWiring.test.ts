// ============================================================
//  aquarelleDryWiring — the Dry event reaches BOTH ends (D-15/D-16).
//
//  Dry is one payload event with two halves:
//    1. LIVE  — sinks fire (the live vendor engine force-dries)
//    2. RECORD — the event lands on the ONE payload timeline so replay
//       re-applies it between strokes (AQUA-06)
//
//  Plus the two fixes the dead-end had: the tick is the Studio record
//  clock (never hardcoded 0), and the button has a real :active state.
// ============================================================

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isAquarelleDryEvent } from '@efxlab/efx-watercolor/payload';
import {
  aquarelleRecordClock,
  emitAquarelleDry,
  getRecordedAquarelleDryEvents,
  getRecordedAquarellePayloadTimeline,
  recordAquarelleStroke,
} from './aquarelleRecordState';

function makeStroke(points: number) {
  return {
    tool: 'brush' as const,
    color: '#2244aa',
    params: { size: 12, water: 50, load: 50, flow: 50, bleed: 50, dry: 50, edge: 50, granulation: 50 },
    brushId: 'wc/round-medium',
    points: Array.from({ length: points }, (_, i) => ({
      x: 0.1 + i * 0.01,
      y: 0.5,
      p: 0.5,
      tx: 0,
      ty: 0,
      tw: 0,
    })),
    mutationId: 9001,
    timestamp: 1000 + points,
  };
}

describe('Dry reaches both ends (D-15 / AQUA-06)', () => {
  it('emitting a Dry fires the LIVE sinks AND appends to the payload timeline', () => {
    const before = getRecordedAquarelleDryEvents().length;
    const dry = emitAquarelleDry(5);

    expect(dry.kind).toBe('dry');
    expect(dry.tick).toBe(5);

    const after = getRecordedAquarelleDryEvents();
    expect(after.length).toBe(before + 1);
    expect(after[after.length - 1]).toEqual(dry);
    expect(isAquarelleDryEvent(after[after.length - 1])).toBe(true);
  });

  it('the Dry event carries no pts and no brush fields (D-16)', () => {
    const dry = emitAquarelleDry(1);
    expect('pts' in dry).toBe(false);
    expect('brushId' in dry).toBe(false);
    expect('tool' in dry).toBe(false);
  });

  it('the tick is the Studio record clock, not hardcoded 0', () => {
    const clockBefore = aquarelleRecordClock();
    recordAquarelleStroke(9001, makeStroke(11));
    const clockAfter = aquarelleRecordClock();

    // A recorded stroke advances the clock by its tick span (pts - 1).
    expect(clockAfter).toBe(clockBefore + 10);

    // A Dry fired now lands at the CURRENT host tick.
    const dry = emitAquarelleDry();
    expect(dry.tick).toBe(clockAfter);
    expect(dry.tick).not.toBe(0);
  });

  it('the payload timeline interleaves strokes and Dry in recording order', () => {
    const timeline = getRecordedAquarellePayloadTimeline();
    expect(timeline.length).toBeGreaterThan(0);
    const drys = getRecordedAquarelleDryEvents();
    for (const dry of drys) {
      expect(timeline).toContain(dry);
    }
  });
});

describe('Dry button has a real pressed state (D-15 UX)', () => {
  it('the Dry button uses the CSS class carrying :active, not inline styles', () => {
    const css = readFileSync(resolve(__dirname, '../physicsPaintStudio.css'), 'utf8');
    expect(css).toContain('.physics-paint-aquarelle-dry');
    expect(css).toContain('.physics-paint-aquarelle-dry:active');
    expect(css).toContain('.physics-paint-aquarelle-dry:hover');

    // 261017-w4x I-06 (Q4): the surviving Dry entry point is the left rail
    // (PhysicsPaintToolRail.tsx WatercolorRail). The module section no longer
    // mounts Dry. The CSS-class rules stay in place for the rail.
    const rail = readFileSync(resolve(__dirname, './PhysicsPaintToolRail.tsx'), 'utf8');
    expect(rail).toContain('data-testid="aquarelle-dry"');
    // The hardcoded 0 tick is gone.
    expect(rail).not.toContain('emitAquarelleDry(0)');
    expect(rail).toContain('emitAquarelleDry(aquarelleRecordClock())');

    // Comment-stripped negative scan: docs naming the rail seam never trip it.
    const moduleSection = readFileSync(resolve(__dirname, './WatercolorModuleSection.tsx'), 'utf8');
    const moduleBody = moduleSection.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(moduleBody, 'module section must not host Dry').not.toContain('emitAquarelleDry');
    expect(moduleBody, 'module section must not host the Dry control').not.toContain('aquarelle-dry');
  });
});

describe('replay re-applies Dry between strokes (AQUA-06)', () => {
  it('the live surface subscribes onAquarelleDry to engine.fix()', () => {
    const src = readFileSync(resolve(__dirname, '../engine/AquarelleCanvasLayer.tsx'), 'utf8');
    expect(src).toContain('onAquarelleDry(');
    expect(src).toContain('engine.fix()');
  });

  it('the PlayScript projection interleaves recorded Dry events into the payload union', () => {
    const src = readFileSync(resolve(__dirname, '../roto/physicsPaintRotoPlayScriptController.ts'), 'utf8');
    expect(src).toContain('getRecordedAquarelleDryEvents');
    expect(src).toContain('AquarellePayloadEvent');
  });
});
