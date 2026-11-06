// ============================================================
//  59-01 (REL-02) — cross-language canonical parity, TypeScript half.
//
//  `app/src/lib/__fixtures__/railMotionCanonical.golden.json` is the ONLY
//  cross-language authority. Its `expectedSource` / `expectedProject` values
//  are frozen literals produced ONCE from the TypeScript encoder; the Rust
//  parity test consumes the same bytes through `include_str!`.
//
//  Never regenerate this fixture to make a failing parity test pass: a fixture
//  change must name which language moved and why.
// ============================================================

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildPhysicPaintRotoProjectEquality } from '../components/physic-paint/roto/physicsPaintRotoPhysicalModel';

interface GoldenDocument {
  readonly name: string;
  readonly document: unknown;
  readonly expectedSource: string;
  readonly expectedProject: string;
}

interface GoldenFixture {
  readonly version: number;
  readonly documents: readonly GoldenDocument[];
}

const FIXTURE = JSON.parse(
  readFileSync(new URL('./__fixtures__/railMotionCanonical.golden.json', import.meta.url), 'utf8'),
) as GoldenFixture;

describe('rail motion canonical parity (TS half)', () => {
  it('carries the frozen cross-language documents', () => {
    expect(FIXTURE.version).toBe(1);
    expect(FIXTURE.documents.map((entry) => entry.name)).toEqual([
      'rail-kind',
      'untouched',
      'rail-kind-script',
    ]);
  });

  it.each(FIXTURE.documents.map((entry) => [entry.name, entry] as const))(
    'matches the frozen project equality: %s',
    (_name, entry) => {
      expect(buildPhysicPaintRotoProjectEquality(entry.document)).toBe(entry.expectedProject);
    },
  );
});
