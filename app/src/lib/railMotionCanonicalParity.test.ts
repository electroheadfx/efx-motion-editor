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
import {
  buildPhysicPaintRotoPhysicalRevision,
  buildPhysicPaintRotoProjectEquality,
  buildPhysicPaintRotoProjectEqualitySource,
} from '../components/physic-paint/roto/physicsPaintRotoPhysicalModel';

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
    'matches the frozen canonical source and project equality: %s',
    (_name, entry) => {
      expect(buildPhysicPaintRotoProjectEqualitySource(entry.document)).toBe(entry.expectedSource);
      expect(buildPhysicPaintRotoProjectEquality(entry.document)).toBe(entry.expectedProject);
    },
  );

  // 261030-ey9 / 260921-c7x: the TS encoder resolves the lifecycle block
  // UNCONDITIONALLY, so a lifecycle-less finite clip and its normalized
  // counterpart are one document. Rust receives the normalized persisted shape
  // — a lifecycle-less raw document deliberately never reaches it, so this pin
  // is TypeScript-only and is NOT a fixture entry.
  it('normalizes a lifecycle-less finite clip to its explicit lifecycle project equality', () => {
    const realKeyRecords = [
      { kind: 'real-key', keyId: 'k1', appFrame: 0, payload: { frameIndex: 0, appFrame: 0, bytes: 'UklGRhgAAABXRUJQVlA4TC8AAAAAAAAA', width: 2, height: 2 } },
      { kind: 'real-key', keyId: 'k2', appFrame: 1, payload: { frameIndex: 1, appFrame: 1, bytes: 'UklGRhwAAABXRUJQVlA4TC8BAAAAAAAAAKo=', width: 2, height: 2 } },
    ];
    const interpolation = { enabled: false, mode: 'duplicate' as const };
    const lifecycleless = {
      loopId: 'loop-c',
      placementStart: 4,
      sourceKeyIds: ['k1', 'k2'],
      repeat: 2,
      mode: 'progressive' as const,
    };
    const explicit = {
      ...lifecycleless,
      syncState: 'synchronized' as const,
      provenanceState: 'attached' as const,
      phaseOrigin: 4,
      originalEndExclusive: 8,
      visibleRanges: [{ start: 4, endExclusive: 8 }],
      frameOverrides: [],
    };
    const documentWith = (loopClips: readonly unknown[]) => ({
      capacity: 24,
      realKeyRecords,
      interpolation,
      scriptMotion: { deformation: 0, position: 0 },
      background: null,
      selectedKeyId: null,
      cursorAppFrame: 0,
      revision: buildPhysicPaintRotoPhysicalRevision(realKeyRecords, interpolation, loopClips),
      loopClips,
    });
    expect(buildPhysicPaintRotoProjectEquality(documentWith([lifecycleless]))).toBe(
      buildPhysicPaintRotoProjectEquality(documentWith([explicit])),
    );
  });
});
