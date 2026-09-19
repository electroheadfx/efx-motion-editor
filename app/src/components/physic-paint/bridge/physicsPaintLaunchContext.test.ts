import { describe, expect, it, vi } from 'vitest';
import type { PhysicPaintLaunchContext } from '../../../types/physicPaint';
import { createEfxPaintDocument, type EfxPaintDocument } from '../../../efx-paint/document/efxPaintDocument';
import { buildPhysicPaintRotoPhysicalRevision, type PhysicPaintRotoPhysicalDocument } from '../roto/physicsPaintRotoPhysicalModel';
import { applyPhysicsPaintLaunchContext, parsePhysicsPaintLaunchContext } from '../bridge/physicsPaintLaunchContext';

function makeLocation(search: string, hash = ''): Location {
  return { search, hash } as Location;
}

const EMPTY_INTERPOLATION = { enabled: false, mode: 'duplicate' } as const;

function makeRotoPhysical(overrides: Partial<PhysicPaintRotoPhysicalDocument> = {}): PhysicPaintRotoPhysicalDocument {
  return {
    capacity: 12,
    realKeyRecords: [],
    groupOverrideRecords: [],
    interpolation: EMPTY_INTERPOLATION,
    scriptMotion: { deformation: 0, position: 0 },
    background: null,
    selectedKeyId: null,
    cursorAppFrame: 4,
    revision: buildPhysicPaintRotoPhysicalRevision([], EMPTY_INTERPOLATION, []),
    loopClips: [],
    incomingInterpolationBreakKeyIds: [],
    ...overrides,
  };
}

function makeLaunchDocument(rotoPhysical: PhysicPaintRotoPhysicalDocument): EfxPaintDocument {
  const document = createEfxPaintDocument('layer-1');
  return {
    ...document,
    tracks: document.tracks.map((track) => track.id === document.activeTrackId
      ? { ...track, rotoPhysical }
      : track),
  };
}

function makeLaunchEnvelope(overrides: Record<string, unknown> = {}) {
  const rotoPhysical = makeRotoPhysical();
  return {
    operationId: 'op-1',
    layerId: 'layer-1',
    project: { name: 'Project', saved: true, contextId: 'opaque-context' },
    startFrame: rotoPhysical.cursorAppFrame as number,
    document: makeLaunchDocument(rotoPhysical),
    ...overrides,
  };
}

function encode(value: unknown): string {
  return encodeURIComponent(JSON.stringify(value));
}

function makeContext(overrides: Partial<PhysicPaintLaunchContext> = {}): PhysicPaintLaunchContext {
  return { layerId: 'layer-1', operationId: 'op-1', startFrame: 4, ...overrides };
}

describe('physicsPaintLaunchContext', () => {
  it('parses canonical encoded Roto launch envelopes while rejecting incomplete or flat input', () => {
    const envelope = makeLaunchEnvelope({
      document: makeLaunchDocument(makeRotoPhysical({ background: { background: 'canvas2', paperGrain: 'canvas3', grainStrength: 0.6 } })),
    });
    expect(parsePhysicsPaintLaunchContext(makeLocation(`?context=${encode(envelope)}`))).toMatchObject({
      layerId: 'layer-1',
      startFrame: 4,
      document: {
        version: 1,
        parentLayerId: 'layer-1',
        tracks: [{ rotoPhysical: { background: { background: 'canvas2' } } }],
      },
    });
    // Flat query-param launch contexts are a retired encoding (canonical physical launch cutover) and must be rejected.
    expect(parsePhysicsPaintLaunchContext(makeLocation('?layer=layer-2&op=op-2&frame=7'))).toBeNull();
    expect(parsePhysicsPaintLaunchContext(makeLocation('?layer=layer-2&frame=7'))).toBeNull();
    // Encoded envelopes missing the parent-owned project or the v1.0 document are incomplete.
    expect(parsePhysicsPaintLaunchContext(makeLocation(`?context=${encode({ operationId: 'op-2', layerId: 'layer-2', startFrame: 7 })}`))).toBeNull();
  });

  it('rejects fail-closed document carriers: unknown members and startFrame/cursor mismatch', () => {
    // Unknown document member: parseEfxPaintDocument throws, the carrier is not a launch.
    const unknownMember = makeLaunchEnvelope({
      document: { ...makeLaunchDocument(makeRotoPhysical()), unknownMember: true },
    });
    expect(parsePhysicsPaintLaunchContext(makeLocation(`?context=${encode(unknownMember)}`))).toBeNull();
    // startFrame must equal the carried active-track cursor (canonical cutover contract).
    const mismatchedCursor = makeLaunchEnvelope({ startFrame: 7 });
    expect(parsePhysicsPaintLaunchContext(makeLocation(`?context=${encode(mismatchedCursor)}`))).toBeNull();
  });

  it('parses encoded workflow labels without replacing layer names', () => {
    const encoded = encode(makeLaunchEnvelope({ layerName: 'Ink', workflowLabel: 'PPaint #2' }));
    expect(parsePhysicsPaintLaunchContext(makeLocation(`?context=${encoded}`))).toMatchObject({
      layerId: 'layer-1',
      layerName: 'Ink',
      workflowLabel: 'PPaint #2',
    });
  });

  it('preserves parent-owned project and stable layer display metadata without paths', () => {
    const parsed = parsePhysicsPaintLaunchContext(makeLocation(`?context=${encode(makeLaunchEnvelope({ layerName: 'Ink' }))}`));
    expect(parsed).toMatchObject({ project: { name: 'Project', saved: true, contextId: 'opaque-context' }, layerId: 'layer-1', layerName: 'Ink' });
    expect(JSON.stringify(parsed)).not.toContain('/Users/');
    expect(JSON.stringify(parsed)).not.toContain('authority');
  });

  it('applies launch context and resolved Roto settings only', () => {
    const setters = { setLaunchContext: vi.fn(), setSettings: vi.fn() };
    const settings = { background: 'canvas2' };
    const context = makeContext();
    applyPhysicsPaintLaunchContext(context, setters, () => settings);
    expect(setters.setLaunchContext).toHaveBeenCalledWith(context);
    expect(setters.setSettings).toHaveBeenCalledWith(settings);
  });
});
