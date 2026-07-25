import { signal } from '@preact/signals';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PhysicPaintLaunchContext, PhysicPaintRotoAuthorityResult } from '../../../types/physicPaint';
import type { RotoPaintScript } from './physicsPaintRotoScriptClipboard';
import { createRotoPlayScriptController, type RotoPlayScriptCommitResult, type RotoPlayScriptControllerPorts } from './physicsPaintRotoPlayScriptController';

const rendered = vi.hoisted(() => vi.fn());
vi.mock('./physicsPaintRotoPlayScriptRenderer', () => ({ renderRotoPlayScriptFrames: rendered }));

/** Minimal valid PNG data URL (real signature bytes) for canonical payloads. */
const pngDataUrl = (label: string) => `data:image/png;base64,${btoa(`${String.fromCharCode(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)}${label}`)}`;

const physicalRecord = (keyId: string, appFrame: number, label: string) => ({
  keyId,
  appFrame,
  payload: { frameIndex: 0, appFrame, dataUrl: pngDataUrl(label), width: 10, height: 10 },
});

const authority = (overrides: Partial<PhysicPaintRotoAuthorityResult> = {}): PhysicPaintRotoAuthorityResult => ({
  operationId: 'authority',
  ok: true,
  projectContextId: 'context-1',
  layerId: 'layer-1',
  canonicalStart: 4,
  layerEndExclusive: 8,
  capacity: 4,
  physicalCapacity: 600,
  rotoRevision: 'revision-1',
  physicalRevision: 'revision-1',
  physicalRecords: [physicalRecord('key-1', 1, 'existing')],
  interpolationEnabled: true,
  interpolationMode: 'duplicate',
  frames: [{ frameIndex: 0, appFrame: 1, dataUrl: pngDataUrl('existing'), width: 10, height: 10, source: 'real-key' }],
  interpolationSettings: { enabled: true, inBetweenCount: 2, mode: 'duplicate', deform: 0, position: 0 },
  ...overrides,
});

const script = (x = 10): RotoPaintScript => ({ provenance: { sessionId: 'session', layerId: 'layer-1', sourceFrame: 2 }, sourceFrame: 2, sourceDisplayFrame: 2, sourceRevision: 1, brushes: [{ primary: { tool: 'paint', points: [{ x, y: 2, p: 1, tx: 0, ty: 0, tw: 0, spd: 0 }], color: '#123456', params: { size: 5, opacity: 80, pressure: 70, waterAmount: 20, dryAmount: 30, edgeDetail: 4, pickup: 2, eraseStrength: 10, antiAlias: 1 }, timestamp: 1 }, continuations: [] }] });

function harness(overrides: Partial<RotoPlayScriptControllerPorts> = {}) {
  let selectedId: string | null = 'script-1';
  let selection: ReturnType<RotoPlayScriptControllerPorts['getSelection']> = { kind: 'real-key', keyId: 'key-4', appFrame: 4 };
  let context: PhysicPaintLaunchContext | null = { operationId: 'launch', layerId: 'layer-1', startFrame: 4, width: 10, height: 10, project: { name: 'Project', saved: true, contextId: 'context-1' } };
  const selectedIdSignal = signal<string | null>(selectedId);
  const selectedSignal = signal<{ id: string } | null>({ id: 'script-1' });
  const library = {
    selectedId: selectedIdSignal, selected: selectedSignal, busy: signal(false), loadSnapshot: vi.fn(async () => script(99)),
  } as unknown as RotoPlayScriptControllerPorts['library'];
  const requestAuthority = vi.fn(async () => authority());
  const commit = vi.fn(async (publication: RotoPlayScriptPhysicalPublication): Promise<RotoPlayScriptCommitResult> => ({
    ok: true,
    operationId: 'accepted-operation',
    acceptedRevision: 'revision-2',
    records: publication.records,
    interpolationMode: publication.interpolationMode,
    selectedKeyId: publication.selectedKeyId,
    selectedAppFrame: publication.selectedAppFrame,
  }));
  const stopPlayback = vi.fn(); const log = vi.fn();
  const ports: RotoPlayScriptControllerPorts = {
    library, getLaunchContext: () => context, getSelection: () => selection, getMotion: () => ({ deformation: 25, position: 40 }),
    getOperationLocked: () => false,
    getSize: () => ({ width: 10, height: 10 }), requestAuthority, commit, stopPlayback, log, ...overrides,
  };
  const controller = createRotoPlayScriptController(ports);
  return { controller, library, requestAuthority, commit, stopPlayback, log, setSelected: (id: string | null) => { selectedId = id; selectedIdSignal.value = id; selectedSignal.value = id ? { id } : null; }, setSelection: (next: typeof selection) => { selection = next; }, setContext: (next: PhysicPaintLaunchContext | null) => { context = next; } };
}

type RotoPlayScriptPhysicalPublication = Parameters<RotoPlayScriptControllerPorts['commit']>[0];

describe('createRotoPlayScriptController', () => {
  beforeEach(() => {
    rendered.mockReset();
    rendered.mockImplementation(async ({ frameCount, canonicalStart, onProgress }) => {
      const frames = Array.from({ length: frameCount }, (_, index) => ({
        frameIndex: 0,
        appFrame: canonicalStart + index,
        dataUrl: pngDataUrl(`staged-${index}`),
        width: 10,
        height: 10,
      }));
      onProgress?.(frameCount, frameCount);
      return frames;
    });
  });

  it('requires a durable row but permits an empty canonical start and rejects generated starts', () => {
    const test = harness();
    expect(test.controller.disabledReason.value).toBeNull();
    test.setSelection({ kind: 'empty', keyId: null, appFrame: 4 });
    expect(test.controller.disabledReason.value).toBeNull();
    test.setSelection({ kind: 'generated-interpolation', keyId: null, appFrame: 6 });
    // Selection is not a signal; bump the phase signal to re-evaluate availability.
    test.controller.phase.value = 'complete';
    expect(test.controller.disabledReason.value).toContain('render-only');
    test.setSelected(null);
    expect(test.controller.disabledReason.value).toBe('Select a project script first.');
  });

  it.each([
    ['', 'Enter a positive integer or Max.'], ['0', 'Enter a positive integer or Max.'], ['-1', 'Enter a positive integer or Max.'],
    ['1.5', 'Enter a positive integer or Max.'], ['1x', 'Enter a positive integer or Max.'], ['5', 'Maximum available count is 4.'],
  ])('strictly rejects count %j without clamping', async (value, message) => {
    const test = harness(); await test.controller.openConfirmation(); test.controller.countText.value = value;
    expect(test.controller.validationError.value).toBe(message);
    expect(await test.controller.confirm()).toBe(false);
    expect(rendered).not.toHaveBeenCalled();
  });

  it('uses current Max and reloads the selected durable row into the operation snapshot', async () => {
    const test = harness(); await test.controller.openConfirmation();
    expect(test.controller.capacity.value).toBe(4);
    expect(test.controller.destinationRange.value).toBe('F4–F7');
    expect(await test.controller.confirm()).toBe(true);
    expect(test.library.loadSnapshot).toHaveBeenCalledWith('script-1');
    expect(rendered).toHaveBeenCalledWith(expect.objectContaining({ script: expect.objectContaining({ brushes: [expect.objectContaining({ primary: expect.objectContaining({ points: [expect.objectContaining({ x: 99 })] }) })] }), frameCount: 4, canonicalStart: 4, motion: { deformation: 25, position: 40 } }));
    expect(test.requestAuthority).toHaveBeenCalledTimes(3);
  });

  it('commits one complete additive real-key set, then validates the parent acknowledgement and stops playback', async () => {
    const test = harness(); await test.controller.openConfirmation(); test.controller.countText.value = '2';
    expect(await test.controller.confirm()).toBe(true);
    expect(test.commit).toHaveBeenCalledOnce();
    const publication = test.commit.mock.calls[0][0];
    expect(publication.records.map((record) => record.appFrame)).toEqual([1, 4, 5]);
    expect(publication.records[0].payload.dataUrl).toBe(pngDataUrl('existing'));
    expect(publication.records[0].keyId).toBe('key-1');
    expect(publication.semanticDelta).toMatchObject({
      kind: 'play-script',
      affectedStartAppFrame: 4,
      affectedEndAppFrame: 5,
      expectedLayerCapacity: 600,
      expectedLayerEndExclusive: 8,
    });
    expect(publication.semanticDelta.freshKeyIds).toHaveLength(2);
    expect(publication.interpolationEnabled).toBe(true);
    expect(publication.interpolationMode).toBe('duplicate');
    expect(publication.selectedAppFrame).toBe(4);
    expect(publication.selectedKeyId).toBe(publication.records[1].keyId);
    expect(test.stopPlayback).toHaveBeenCalledTimes(3);
    expect(test.controller.phase.value).toBe('complete');
  });

  it('revalidates authority and selection before commit without partial publication', async () => {
    const stale = harness({ requestAuthority: vi.fn().mockResolvedValueOnce(authority()).mockResolvedValueOnce(authority()).mockResolvedValueOnce(authority({ physicalRevision: 'revision-2' })) });
    await stale.controller.openConfirmation(); stale.controller.countText.value = '2';
    expect(await stale.controller.confirm()).toBe(false);
    expect(stale.commit).not.toHaveBeenCalled();

    rendered.mockReset();
    let releaseRender!: () => void;
    rendered.mockImplementationOnce(async ({ frameCount, canonicalStart }) => new Promise((resolve) => {
      releaseRender = () => resolve(Array.from({ length: frameCount }, (_, index) => ({
        frameIndex: 0,
        appFrame: canonicalStart + index,
        dataUrl: pngDataUrl(`staged-${index}`),
        width: 10,
        height: 10,
      })));
    }));
    const changed = harness(); await changed.controller.openConfirmation(); changed.controller.countText.value = '2';
    const confirming = changed.controller.confirm(); await vi.waitFor(() => expect(rendered).toHaveBeenCalled()); changed.setSelected('script-2'); releaseRender();
    expect(await confirming).toBe(false);
    expect(changed.commit).not.toHaveBeenCalled();
  });

  it('does not publish a failed commit or cancelled render', async () => {
    const failed = harness({ commit: vi.fn(async (): Promise<RotoPlayScriptCommitResult> => ({ ok: false, error: 'rejected' })) });
    await failed.controller.openConfirmation(); failed.controller.countText.value = '1';
    expect(await failed.controller.confirm()).toBe(false);
    expect(failed.controller.phase.value).toBe('failed');

    rendered.mockImplementationOnce(async ({ signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError')), { once: true })));
    const cancelled = harness(); await cancelled.controller.openConfirmation(); cancelled.controller.countText.value = '1';
    const pending = cancelled.controller.confirm(); await vi.waitFor(() => expect(cancelled.controller.canCancel.value).toBe(true)); cancelled.controller.cancel();
    expect(await pending).toBe(false);
    expect(cancelled.commit).not.toHaveBeenCalled();
  });
});
