import { describe, expect, it, vi } from 'vitest';
import type { PhysicPaintLaunchContext } from '../../../types/physicPaint';
import { buildPhysicPaintRotoPhysicalRevision } from '../roto/physicsPaintRotoPhysicalModel';
import { applyPhysicsPaintLaunchContext, parsePhysicsPaintLaunchContext } from '../bridge/physicsPaintLaunchContext';

function makeLocation(search: string, hash = ''): Location {
  return { search, hash } as Location;
}

const EMPTY_INTERPOLATION = { enabled: false, mode: 'duplicate' } as const;

function makeRotoPhysical(overrides: Record<string, unknown> = {}) {
  return {
    capacity: 12,
    layerEndExclusive: 12,
    records: [],
    interpolationEnabled: EMPTY_INTERPOLATION.enabled,
    interpolationMode: EMPTY_INTERPOLATION.mode,
    scriptMotion: { deformation: 0, position: 0 },
    background: null,
    selectedKeyId: null,
    cursorAppFrame: 4,
    revision: buildPhysicPaintRotoPhysicalRevision([], EMPTY_INTERPOLATION, []),
    ...overrides,
  };
}

function makeLaunchEnvelope(overrides: Record<string, unknown> = {}) {
  const rotoPhysical = makeRotoPhysical();
  return {
    operationId: 'op-1',
    layerId: 'layer-1',
    project: { name: 'Project', saved: true, contextId: 'opaque-context' },
    startFrame: rotoPhysical.cursorAppFrame as number,
    rotoPhysical,
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
      rotoPhysical: makeRotoPhysical({ background: { background: 'canvas2', paperGrain: 'canvas3', grainStrength: 0.6 } }),
    });
    expect(parsePhysicsPaintLaunchContext(makeLocation(`?context=${encode(envelope)}`))).toMatchObject({
      layerId: 'layer-1',
      startFrame: 4,
      rotoPhysical: { background: { background: 'canvas2' } },
    });
    // Flat query-param launch contexts are a retired encoding (canonical physical launch cutover) and must be rejected.
    expect(parsePhysicsPaintLaunchContext(makeLocation('?layer=layer-2&op=op-2&frame=7'))).toBeNull();
    expect(parsePhysicsPaintLaunchContext(makeLocation('?layer=layer-2&frame=7'))).toBeNull();
    // Encoded envelopes missing the parent-owned project or the physical document are incomplete.
    expect(parsePhysicsPaintLaunchContext(makeLocation(`?context=${encode({ operationId: 'op-2', layerId: 'layer-2', startFrame: 7 })}`))).toBeNull();
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
