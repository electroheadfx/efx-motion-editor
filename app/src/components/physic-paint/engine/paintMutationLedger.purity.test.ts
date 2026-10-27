// ============================================================
//  quick 261027-klx — structural purity gate for the NEW modules.
//
//  The behavioural half (watercolor stroke end allocates through the
//  ledger, completion without rasterization) lands in Wave 3 with the
//  Studio wiring. This half proves, structurally, that the new
//  modules never reach engine-1: no package specifier, no
//  EfxPaintEngine reference, no enqueueRecordedStroke call into an
//  engine object.
//
//  Comments are stripped before matching so a comment can never
//  self-invalidate the gate.
// ============================================================

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
}

function readSource(url: URL): string {
  return readFileSync(url, 'utf8');
}

const MODULES = [
  { name: 'paintMutationLedger.ts', url: new URL('./paintMutationLedger.ts', import.meta.url) },
  { name: 'paintMutationRotoPort.ts', url: new URL('../roto/paintMutationRotoPort.ts', import.meta.url) },
  { name: 'rotoFramePersistTruth.ts', url: new URL('../roto/rotoFramePersistTruth.ts', import.meta.url) },
  { name: 'paperConditioning.ts', url: new URL('../../../lib/paperConditioning.ts', import.meta.url) },
] as const;

describe('quick 261027-klx new-module purity (no engine-1 dependency)', () => {
  for (const module of MODULES) {
    it(`${module.name} imports nothing from the engine-1 package`, () => {
      const source = stripComments(readSource(module.url));
      expect(source).not.toContain('@efxlab/efx-physic-paint');
    });

    it(`${module.name} never references EfxPaintEngine`, () => {
      const source = stripComments(readSource(module.url));
      expect(source).not.toContain('EfxPaintEngine');
    });

    it(`${module.name} never calls enqueueRecordedStroke on an engine object`, () => {
      const source = stripComments(readSource(module.url));
      expect(source).not.toMatch(/\.enqueueRecordedStroke\s*\(/);
    });
  }

  it('resolves all four module paths (the gate is not silently empty)', () => {
    for (const module of MODULES) {
      expect(readSource(module.url).length, module.name).toBeGreaterThan(0);
    }
  });
});
