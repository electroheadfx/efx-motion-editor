import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  bakePreSplitGoldenFrames,
  comparePreSplitGoldenBake,
  describePreSplitGoldenMismatch,
  loadPreSplitGoldenFixture,
  type PreSplitGoldenBake,
  type PreSplitGoldenBakedFrame,
} from './preSplitGoldenFixture';

/**
 * Standing delta-zero replay parity pin (HOST-03 / R5.2 / D-01..D-04).
 *
 * PINS_GREEN_AT_BIRTH: this pin is green at birth against the unchanged
 * pre-split sources. It is a preservation pin — manufacturing a red by
 * breaking production code would be theater. A future host-split regression
 * flips it the moment animation schedules, held-pose motion, or the
 * traceSeed determinism law drift.
 *
 * D-01: never imports or calls the engine-1 tier-parity metrics helper
 * (`computeTierParityMetrics` family). The oracle is independent.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const PACKAGE_TRACE_SEED = resolve(
  HERE,
  '../../../../packages/efx-physic-paint/src/util/traceSeed.ts',
);

/**
 * PINS_GREEN_AT_BIRTH: this standing pin is green at birth against the
 * unchanged pre-split sources. It is a preservation pin — manufacturing a
 * red by breaking production code would be theater. A future host-split
 * regression flips it the moment animation schedules, held-pose motion, or
 * the traceSeed determinism law drift.
 */
const PINS_GREEN_AT_BIRTH = true as const;

describe('pre-split golden replay parity pin (HOST-03 / R5.2)', () => {
  it('re-bakes every stored frame at delta zero on pre-split code (PINS_GREEN_AT_BIRTH)', () => {
    expect(PINS_GREEN_AT_BIRTH).toBe(true);
    const fixture = loadPreSplitGoldenFixture();
    expect(fixture.bakes.length).toBeGreaterThan(0);

    fixture.bakes.forEach((bake, bakeIndex) => {
      // A wiped/empty golden would false-green the comparator (zero frames to
      // check). The stored capture must carry exactly frameCount frames.
      expect(bake.frames.length, `bake[${bakeIndex}] golden frames must be non-empty`).toBe(
        bake.frameCount,
      );
      const rebaked = bakePreSplitGoldenFrames(fixture.script, bake);
      expect(rebaked.length).toBe(bake.frameCount);
      const mismatch = comparePreSplitGoldenBake(bakeIndex, bake, rebaked);
      if (mismatch) {
        throw new Error(describePreSplitGoldenMismatch(mismatch));
      }
    });
  });

  it('names the drifted frame index and pixel-delta count on a forced expected-pixel mutation', () => {
    const fixture = loadPreSplitGoldenFixture();
    const bakeIndex = 0;
    const bake = fixture.bakes[bakeIndex];
    expect(bake.frames.length).toBeGreaterThan(1);

    // Mutate exactly one expected frame's pixels (frame 1) and assert the
    // comparator names that frame. Restoring is the unmutated pin above.
    const mutatedFrames: PreSplitGoldenBakedFrame[] = bake.frames.map((frame) => {
      if (frame.frameIndex !== 1) return frame;
      const bytes = Buffer.from(frame.rgbaBase64, 'base64');
      bytes[0] = (bytes[0] + 17) % 256; // force a one-byte pixel delta
      return {
        ...frame,
        rgbaBase64: bytes.toString('base64'),
      };
    });
    const mutatedBake: PreSplitGoldenBake = { ...bake, frames: mutatedFrames };

    const rebaked = bakePreSplitGoldenFrames(fixture.script, mutatedBake);
    const mismatch = comparePreSplitGoldenBake(bakeIndex, mutatedBake, rebaked);
    expect(mismatch).not.toBeNull();
    expect(mismatch!.frameIndex).toBe(1);
    expect(mismatch!.pixelDeltaCount).toBeGreaterThan(0);
    expect(describePreSplitGoldenMismatch(mismatch!)).toContain('frame 1');
  });

  it('rejects a wiped golden (empty frames cannot false-green the pin)', () => {
    const fixture = loadPreSplitGoldenFixture();
    const bake = fixture.bakes[0];
    const wiped = { ...bake, frames: [] as typeof bake.frames };
    // The pin's non-empty guard is the assertion inside the main test; this
    // case proves the comparator itself is also a no-op on empty goldens, so
    // the guard is load-bearing rather than decorative.
    expect(comparePreSplitGoldenBake(0, wiped, bakePreSplitGoldenFrames(fixture.script, wiped))).toBeNull();
    expect(wiped.frames.length).toBe(0);
    expect(bake.frames.length).toBe(bake.frameCount);
    expect(bake.frames.length).toBeGreaterThan(0);
  });

  it('keeps the fixture script as RotoPaintScript runtime input (not PersistedRotoScriptV1)', () => {
    const fixture = loadPreSplitGoldenFixture();
    const script = fixture.script as unknown as Record<string, unknown>;
    // Renderer runtime shape: provenance + sourceFrame + brushes. The on-disk
    // PersistedRotoScriptV1 shape carries kind/schemaVersion/thumbnail — those
    // must NOT be the stored golden identity (55-05 cutover leaves these alone).
    expect(script.brushes).toBeInstanceOf(Array);
    expect(script.provenance).toBeTruthy();
    expect(script.kind).toBeUndefined();
    expect(script.schemaVersion).toBeUndefined();
    expect(script.thumbnail).toBeUndefined();

    const brushes = script.brushes as Array<{
      primary: { tool: string; diffusionFrames?: number; points: unknown[] };
      continuations?: Array<{ tool: string; diffusionFrames?: number; points: unknown[] }>;
    }>;
    const all = brushes.flatMap((b) => [b.primary, ...(b.continuations ?? [])]);
    expect(all.some((s) => s.tool === 'paint' && s.points.length > 0)).toBe(true);
    expect(all.some((s) => s.tool === 'erase')).toBe(true);
    expect(all.some((s) => typeof s.diffusionFrames === 'number' && s.diffusionFrames > 0)).toBe(true);
  });

  it('never imports or calls the engine-1 tier-parity metrics helper (D-01)', () => {
    const fixtureSource = readFileSync(join(HERE, 'preSplitGoldenFixture.ts'), 'utf8');
    const pinSource = readFileSync(join(HERE, 'preSplitGoldenParity.test.ts'), 'utf8');
    // Constructed so this scan's own source does not contain the forbidden symbol.
    const forbidden = ['compute', 'Tier', 'Parity', 'Metrics'].join('');
    const forbiddenPattern = new RegExp(forbidden);
    expect(fixtureSource).not.toMatch(forbiddenPattern);
    for (const source of [fixtureSource, pinSource]) {
      // No import of a tier-parity module (the D-01 forbidden oracle family).
      expect(source).not.toMatch(/from\s+['"][^'"]*tierParity[^'"]*['"]/);
    }
  });

  it('keeps the fixture trace-seed mirrors byte-aligned with the package source (D-25)', () => {
    // The package does not export hashMutationId/seededRng. The fixture mirrors
    // the algorithm; this scan keeps the mirror from drifting from the source
    // of truth the host split will move.
    const packageSource = readFileSync(PACKAGE_TRACE_SEED, 'utf8');
    const fixtureSource = readFileSync(join(HERE, 'preSplitGoldenFixture.ts'), 'utf8');

    for (const needle of [
      'hash ^= source.charCodeAt(i)',
      'Math.imul(hash, 16777619)',
      'fnv1a(`mutation:${mutationId ?? 0}`)',
      'a = (a + 0x6d2b79f5) >>> 0',
      'Math.imul(t ^ (t >>> 15), t | 1)',
    ]) {
      expect(packageSource, `package traceSeed missing: ${needle}`).toContain(needle);
      expect(fixtureSource, `fixture mirror missing: ${needle}`).toContain(needle);
    }
  });
});
