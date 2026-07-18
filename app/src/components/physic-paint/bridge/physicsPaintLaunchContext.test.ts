import { describe, expect, it, vi } from 'vitest';
import type { PhysicPaintLaunchContext } from '../../../types/physicPaint';
import { applyPhysicsPaintLaunchContext, parsePhysicsPaintLaunchContext } from '../bridge/physicsPaintLaunchContext';

function makeLocation(search: string, hash = ''): Location {
  return { search, hash } as Location;
}

function makeContext(overrides: Partial<PhysicPaintLaunchContext> = {}): PhysicPaintLaunchContext {
  return { layerId: 'layer-1', operationId: 'op-1', startFrame: 4, ...overrides };
}

describe('physicsPaintLaunchContext', () => {
  it('parses encoded and flat Roto launch contexts while rejecting incomplete input', () => {
    const encoded = encodeURIComponent(JSON.stringify(makeContext({ rotoBackground: { background: 'canvas2', paperGrain: 'canvas3', grainStrength: 0.6 } })));
    expect(parsePhysicsPaintLaunchContext(makeLocation(`?context=${encoded}`))).toMatchObject({ layerId: 'layer-1', startFrame: 4, rotoBackground: { background: 'canvas2' } });
    expect(parsePhysicsPaintLaunchContext(makeLocation('?layer=layer-2&op=op-2&frame=7'))).toMatchObject({ layerId: 'layer-2', operationId: 'op-2', startFrame: 7 });
    expect(parsePhysicsPaintLaunchContext(makeLocation('?layer=layer-2&frame=7'))).toBeNull();
  });

  it('parses encoded and flat workflow labels without replacing layer names', () => {
    const encoded = encodeURIComponent(JSON.stringify(makeContext({ layerName: 'Ink', workflowLabel: 'PPaint #2' })));
    expect(parsePhysicsPaintLaunchContext(makeLocation(`?context=${encoded}`))).toMatchObject({
      layerId: 'layer-1',
      layerName: 'Ink',
      workflowLabel: 'PPaint #2',
    });

    expect(parsePhysicsPaintLaunchContext(makeLocation('?layer=layer-2&op=op-2&frame=7&layerName=Water%20smoke&workflowLabel=PPaint%20%233'))).toMatchObject({
      layerId: 'layer-2',
      layerName: 'Water smoke',
      workflowLabel: 'PPaint #3',
    });
  });

  it('preserves parent-owned project and stable layer display metadata without paths', () => {
    const parsed = parsePhysicsPaintLaunchContext(makeLocation(`?context=${encodeURIComponent(JSON.stringify(makeContext({ project: { name: 'Project', saved: true, contextId: 'opaque-context' }, layerName: 'Ink' })) )}`));
    expect(parsed).toMatchObject({ project: { name: 'Project', saved: true, contextId: 'opaque-context' }, layerId: 'layer-1', layerName: 'Ink' });
    expect(JSON.stringify(parsed)).not.toContain('/Users/');
    expect(JSON.stringify(parsed)).not.toContain('authority');
  });

  it('applies launch context and resolved Roto settings only', () => {
    const setters = { setLaunchContext: vi.fn(), setSettings: vi.fn() };
    const settings = { background: 'canvas2' };
    const context = makeContext({ rotoBackground: { background: 'canvas2', paperGrain: 'canvas3', grainStrength: 0.6 } });
    applyPhysicsPaintLaunchContext(context, setters, () => settings);
    expect(setters.setLaunchContext).toHaveBeenCalledWith(context);
    expect(setters.setSettings).toHaveBeenCalledWith(settings);
  });
});
