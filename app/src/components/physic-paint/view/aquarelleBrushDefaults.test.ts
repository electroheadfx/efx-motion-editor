// ============================================================
//  quick 261124-tje — the per-response LANDING BAG seam.
//
//  Laws pinned here:
//   1. Applying Gouache's bag (`bristle-round`) is ONE compare-
//      then-write spread: size from 40 px, load 100, pickup 100,
//      dry 0, feather 100 — never lift, never an unnamed key.
//   2. Applying Pen's bag lands size from 10 px, load 100,
//      pickup 0, dry 0, feather 85, and its #373633 pigment lands
//      through the registered colour sink exactly once.
//   3. The colour sink mirrors the lift-preview contract: last
//      registration wins and a stale unregister clears nothing.
//   4. A bagless preset ('round') and an unknown id are TOTAL
//      no-ops — zero bag writes, zero sink calls.
//   5. Order law: the medium record lands FIRST, the bag LAST, so
//      the bag's four keys win; the record alone keeps dry 70 /
//      feather 85.
//   6. The bag is compile-time-only: neither the record snapshot
//      nor the stroke payload exposes a `defaults` property.
//   7. The Studio registers `handleActiveColorChanged` as the sink
//      inside an effect that returns the unregister, and lands the
//      active brush's bag ONE-SHOT after the first positive
//      working-height report.
//
//  Node env, real signals, no DOM. The seam audit reads sources
//  with comments stripped.
// ============================================================

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NEUTRAL_TOOL_OVERRIDES } from '@efxlab/efx-watercolor/brushes';
import {
  DEFAULT_AQUARELLE_PARAMS,
  applyAquarelleBrushDefaults,
  applyAquarelleMedium,
  aquarelleParams,
  aquarellePaintCanonicalFromPx,
  aquarelleSelectedMediumId,
  aquarelleSelectedTextureId,
  aquarelleSelectedTipId,
  aquarelleToolOverrides,
  aquarelleWorkingHeight,
  buildAquarelleStrokePayload,
  registerAquarelleBrushDefaultsColorSink,
  resetAquarelleRecordState,
  snapshotAquarelleRecord,
} from './aquarelleRecordState';

const HERE = dirname(fileURLToPath(import.meta.url));
const STUDIO_PATH = resolve(HERE, '..', 'PhysicsPaintStudio.tsx');

/** The other medium keys a bag never touches. */
const OTHER_MEDIUM_KEYS = [
  'water',
  'flow',
  'bleed',
  'edge',
  'granulation',
  'viscosity',
  'body',
  'emboss',
  'refill',
  'wetSeconds',
] as const;

const unregisters: Array<() => void> = [];

function registerSink(sink: (color: string) => void): () => void {
  const unregister = registerAquarelleBrushDefaultsColorSink(sink);
  unregisters.push(unregister);
  return unregister;
}

/** Count effective writes to the live bag (subscribe fires once on attach). */
function countBagWrites(): { count: () => number; stop: () => void } {
  let count = 0;
  const dispose = aquarelleParams.subscribe(() => {
    count += 1;
  });
  count = 0;
  return { count: () => count, stop: dispose };
}

function resetState(): void {
  resetAquarelleRecordState();
  aquarelleParams.value = { ...DEFAULT_AQUARELLE_PARAMS };
  aquarelleSelectedMediumId.value = 'acrylic';
  aquarelleSelectedTipId.value = 'bristle-round';
  aquarelleSelectedTextureId.value = null;
  aquarelleToolOverrides.value = { ...NEUTRAL_TOOL_OVERRIDES };
  aquarelleWorkingHeight.value = 1080;
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

/** Every non-test view source, comments stripped. */
function viewSources(): Map<string, string> {
  const sources = new Map<string, string>();
  for (const entry of readdirSync(HERE, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (!/\.(ts|tsx)$/.test(entry.name)) continue;
    if (/\.test\.(ts|tsx)$/.test(entry.name)) continue;
    sources.set(
      entry.name,
      stripComments(readFileSync(resolve(HERE, entry.name), 'utf8')),
    );
  }
  return sources;
}

function filesMatching(sources: Map<string, string>, needle: string): string[] {
  return [...sources.entries()]
    .filter(([, source]) => source.includes(needle))
    .map(([name]) => name)
    .sort();
}

function countOf(sources: Map<string, string>, file: string, needle: string): number {
  const source = sources.get(file);
  expect(source, `${file} is a scanned source`).toBeDefined();
  return source!.split(needle).length - 1;
}

beforeEach(() => {
  resetState();
});

afterEach(() => {
  while (unregisters.length > 0) unregisters.pop()!();
  resetState();
});

describe('applyAquarelleBrushDefaults — the Gouache bag', () => {
  it('lands one spread of size/load/pickup/dry/feather and touches nothing else', () => {
    aquarelleParams.value = { ...aquarelleParams.value, lift: 55 };
    const writeCount = countBagWrites();
    applyAquarelleBrushDefaults('bristle-round');
    writeCount.stop();
    expect(writeCount.count(), 'one compare-then-write spread').toBe(1);
    expect(aquarelleParams.value.size).toBe(aquarellePaintCanonicalFromPx(40));
    expect(aquarelleParams.value.load).toBe(100);
    expect(aquarelleParams.value.pickup).toBe(100);
    expect(aquarelleParams.value.dry).toBe(0);
    expect(aquarelleParams.value.feather).toBe(100);
    expect(aquarelleParams.value.lift, 'the bag never moves lift').toBe(55);
    for (const key of OTHER_MEDIUM_KEYS) {
      expect(aquarelleParams.value[key], `bag never writes ${key}`).toBe(
        DEFAULT_AQUARELLE_PARAMS[key],
      );
    }
    // A pick is a pick: the same bag twice is a no-op the second time.
    const second = countBagWrites();
    applyAquarelleBrushDefaults('bristle-round');
    second.stop();
    expect(second.count(), 'a repeated bag writes nothing').toBe(0);
    expect(aquarelleParams.value.dry, 'the bag is still applied').toBe(0);
  });
});

describe('applyAquarelleBrushDefaults — the Pen bag', () => {
  it('lands the pen values and its colour through the registered sink', () => {
    aquarelleSelectedTipId.value = 'pen';
    const colors: string[] = [];
    registerSink((color) => colors.push(color));
    applyAquarelleBrushDefaults('pen');
    expect(aquarelleParams.value.size).toBe(aquarellePaintCanonicalFromPx(10));
    expect(aquarelleParams.value.load).toBe(100);
    expect(aquarelleParams.value.pickup).toBe(0);
    expect(aquarelleParams.value.dry).toBe(0);
    expect(aquarelleParams.value.feather).toBe(85);
    expect(colors, 'the pen pigment lands once').toEqual(['#373633']);
  });

  it('a Gouache application never calls the colour sink', () => {
    const colors: string[] = [];
    registerSink((color) => colors.push(color));
    applyAquarelleBrushDefaults('bristle-round');
    expect(colors, 'the Gouache bag names no colour').toEqual([]);
  });
});

describe('the brush-defaults colour sink lifecycle', () => {
  it('delivers until unregistered', () => {
    const colors: string[] = [];
    const unregister = registerSink((color) => colors.push(color));
    applyAquarelleBrushDefaults('pen');
    unregister();
    applyAquarelleBrushDefaults('pen');
    expect(colors, 'one delivery before the unregister').toEqual(['#373633']);
  });

  it('a second registration replaces the first and the stale unregister clears nothing', () => {
    const first: string[] = [];
    const second: string[] = [];
    const unregisterFirst = registerSink((color) => first.push(color));
    const unregisterSecond = registerSink((color) => second.push(color));
    applyAquarelleBrushDefaults('pen');
    expect(second, 'the last registration wins').toEqual(['#373633']);
    expect(first, 'the replaced sink is silent').toEqual([]);
    unregisterFirst();
    applyAquarelleBrushDefaults('pen');
    expect(second, 'a stale unregister never clears the live sink').toEqual([
      '#373633',
      '#373633',
    ]);
    unregisterSecond();
  });
});

describe('the bagless no-op paths', () => {
  it('a bagless preset and an unknown id write nothing and call no sink', () => {
    const colors: string[] = [];
    registerSink((color) => colors.push(color));
    const writeCount = countBagWrites();
    applyAquarelleBrushDefaults('round');
    applyAquarelleBrushDefaults('wc/does-not-exist');
    applyAquarelleBrushDefaults(null);
    writeCount.stop();
    expect(writeCount.count(), 'a bagless pick is a total no-op').toBe(0);
    expect(colors, 'no sink call without a bag colour').toEqual([]);
  });
});

describe('the ordering law — record first, bag last', () => {
  it('the record alone keeps dry 70 / feather 85; the bag then wins', () => {
    applyAquarelleMedium('acrylic');
    expect(aquarelleParams.value.dry, 'the acrylic record').toBe(70);
    expect(aquarelleParams.value.feather, 'the acrylic record').toBe(85);

    applyAquarelleBrushDefaults('bristle-round');
    expect(aquarelleParams.value.dry, 'the bag lands last').toBe(0);
    expect(aquarelleParams.value.feather, 'the bag lands last').toBe(100);
    expect(aquarelleParams.value.load).toBe(100);
    expect(aquarelleParams.value.pickup).toBe(100);
  });
});

describe('the compile-time-only contract', () => {
  it('neither the record snapshot nor the stroke payload exposes the bag', () => {
    applyAquarelleBrushDefaults('pen');
    const snapshot = snapshotAquarelleRecord();
    const payload = buildAquarelleStrokePayload();
    expect('defaults' in snapshot, 'no defaults on the record').toBe(false);
    expect('defaults' in payload, 'no defaults on the payload').toBe(false);
  });
});

describe('the Studio wiring (quick 261124-tje)', () => {
  it('registers the colour sink inside a useEffect that depends on the setter', () => {
    const studio = stripComments(readFileSync(STUDIO_PATH, 'utf8'));
    const registerAt = studio.indexOf(
      'registerAquarelleBrushDefaultsColorSink(handleActiveColorChanged)',
    );
    expect(registerAt, 'the Studio registers the colour sink').toBeGreaterThan(-1);
    const region = studio.slice(Math.max(0, registerAt - 300), registerAt + 300);
    expect(region, 'registered inside a useEffect').toContain('useEffect(');
    expect(region, 'the effect returns the unregister').toContain(
      'registerAquarelleBrushDefaultsColorSink(handleActiveColorChanged)',
    );
    expect(region, 'the effect depends on the colour setter').toMatch(
      /\[\s*handleActiveColorChanged\s*\]/,
    );
  });

  it('lands the active bag once, after a positive working-height report', () => {
    const studio = stripComments(readFileSync(STUDIO_PATH, 'utf8'));
    expect(
      studio.split('applyAquarelleBrushDefaults(').length - 1,
      'exactly one landing call in the Studio',
    ).toBe(1);
    const landingAt = studio.indexOf('applyAquarelleBrushDefaults(');
    const region = studio.slice(Math.max(0, landingAt - 600), landingAt + 200);
    expect(region, 'inside a useEffect').toContain('useEffect(');
    expect(region, 'one-shot ref').toContain('brushDefaultsLandedRef');
    expect(region, 'positive canvasHeight guard').toMatch(/canvasHeight\s*<=\s*0/);
    expect(region, 're-runs on the working-height report').toMatch(/\[\s*canvasHeight\s*\]/);
    expect(studio, 'lands the SELECTED brush\'s bag').toContain(
      'applyAquarelleBrushDefaults(aquarelleSelectedTipId.value)',
    );
  });

  it('keeps the bag call in exactly three files', () => {
    const sources = viewSources();
    sources.set(
      'PhysicsPaintStudio.tsx',
      stripComments(readFileSync(STUDIO_PATH, 'utf8')),
    );
    expect(filesMatching(sources, 'applyAquarelleBrushDefaults(')).toEqual([
      'PhysicsPaintStudio.tsx',
      'aquarellePaintControls.ts',
      'aquarelleRecordState.ts',
    ]);
    // 3 = the definition + the Brush-tool branch + pickAquarelleMedium.
    expect(countOf(sources, 'aquarelleRecordState.ts', 'applyAquarelleBrushDefaults(')).toBe(3);
    expect(countOf(sources, 'aquarellePaintControls.ts', 'applyAquarelleBrushDefaults(')).toBe(1);
    expect(countOf(sources, 'PhysicsPaintStudio.tsx', 'applyAquarelleBrushDefaults(')).toBe(1);
  });
});
