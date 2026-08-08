import { signal } from '@preact/signals';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PhysicPaintLaunchContext, PhysicPaintRotoAuthorityResult } from '../../../types/physicPaint';
import type { RotoPaintScript } from './physicsPaintRotoScriptClipboard';
import { createRotoPlayScriptController, type RotoPlayScriptCommitResult, type RotoPlayScriptControllerPorts, type RotoPlayScriptSourceCycleMatchInput } from './physicsPaintRotoPlayScriptController';

// Preact hook shims for the REAL useRotoPhysicalEditHistory hook driven by the
// HOLD-03 one-history-command case below (same idiom as the hook's own spec).
vi.mock('preact/hooks', () => ({
  useCallback: <Value>(callback: Value) => callback,
  useEffect: (setup: () => void | (() => void)) => setup(),
  useRef: <Value>(value: Value) => ({ current: value }),
}));

import type { PhysicPaintRotoRealKeyRecord, PhysicPaintRotoLoopClip } from './physicsPaintRotoPhysicalModel';
import { buildPhysicPaintRotoPhysicalRevision } from './physicsPaintRotoPhysicalModel';
import { derivePhysicPaintRotoLoopRanges } from './physicsPaintRotoPhysicalResolver';
import type {
  RotoPhysicalEditAcceptedOutput,
  RotoPhysicalEditExecuteInput,
  RotoPhysicalEditSnapshot,
} from './rotoCoordinatorPorts';
import { useRotoPhysicalEditHistory } from '../hooks/useRotoPhysicalEditHistory';

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
  let motion = { deformation: 25, position: 40 };
  const getMotion = vi.fn(() => ({ ...motion }));
  let brushColor = '#103c65';
  const getBrushColor = vi.fn(() => brushColor);
  const selectedIdSignal = signal<string | null>(selectedId);
  const selectedSignal = signal<{ id: string } | null>({ id: 'script-1' });
  const library = {
    selectedId: selectedIdSignal, selected: selectedSignal, busy: signal(false), loadSnapshot: vi.fn(async () => script(99)),
    // Write-capable members the Play Script flow must never invoke (PLAY-02).
    saveActiveFrame: vi.fn(), activateAndLoad: vi.fn(), beginRename: vi.fn(), updateRenameDraft: vi.fn(),
    commitRename: vi.fn(), cancelRename: vi.fn(), requestDelete: vi.fn(), confirmDelete: vi.fn(), cancelDelete: vi.fn(),
    select: vi.fn(), updateProjectContext: vi.fn(), enterScripts: vi.fn(), refresh: vi.fn(),
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
    // 43-06: the parent echoes the submitted loopClips collection when present.
    ...(publication.loopClips ? { loopClips: publication.loopClips } : {}),
  }));
  const stopPlayback = vi.fn(); const log = vi.fn();
  const ports: RotoPlayScriptControllerPorts = {
    library, getLaunchContext: () => context, getSelection: () => selection, getMotion,
    getBrushColor,
    getOperationLocked: () => false,
    getSize: () => ({ width: 10, height: 10 }), requestAuthority, commit, stopPlayback, log, ...overrides,
  };
  const controller = createRotoPlayScriptController(ports);
  return { controller, library, requestAuthority, commit, stopPlayback, log, getMotion, setMotion: (next: { deformation: number; position: number }) => { motion = next; }, setBrushColor: (next: string) => { brushColor = next; }, setSelected: (id: string | null) => { selectedId = id; selectedIdSignal.value = id; selectedSignal.value = id ? { id } : null; }, setSelection: (next: typeof selection) => { selection = next; }, setContext: (next: PhysicPaintLaunchContext | null) => { context = next; } };
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

  it('resolves the override color from the getBrushColor port AT CONFIRM TIME — two confirms with different port values render different overrides', async () => {
    const test = harness();
    await test.controller.openConfirmation();
    // Dialog Motion initializes from the Motion defaults port at open (D-06).
    expect(test.controller.dialogMotion.value).toEqual({ deformation: 25, position: 40 });

    test.controller.mode.value = 'static';
    test.controller.countText.value = '4'; // re-set after the Static / Hold first-time default applies
    test.controller.overrideEnabled.value = true;
    test.controller.dialogMotion.value = { deformation: 5, position: 10 };
    test.setMotion({ deformation: 90, position: 90 }); // Motion port changed after open — must NOT be re-read at confirm
    test.setBrushColor('#3366ff');
    expect(await test.controller.confirm()).toBe(true);
    expect(rendered).toHaveBeenCalledWith(expect.objectContaining({ mode: 'static', overrideColor: '#3366ff', motion: { deformation: 5, position: 10 } }));

    rendered.mockClear();
    await test.controller.openConfirmation();
    test.controller.countText.value = '2';
    test.setBrushColor('#aa5500'); // brush color changed after the first Generate — resolved fresh at confirm, never stored
    expect(await test.controller.confirm()).toBe(true);
    expect(rendered).toHaveBeenCalledWith(expect.objectContaining({ overrideColor: '#aa5500' }));
  });

  it('passes progressive defaults and a null override color when options are untouched or the override is disabled (Original colors)', async () => {
    const untouched = harness();
    await untouched.controller.openConfirmation();
    expect(await untouched.controller.confirm()).toBe(true);
    expect(rendered).toHaveBeenCalledWith(expect.objectContaining({ mode: 'progressive', overrideColor: null, motion: { deformation: 25, position: 40 } }));

    rendered.mockClear();
    const disabled = harness();
    await disabled.controller.openConfirmation();
    // Custom color selected then Original colors re-selected — the override is disabled (D-08R).
    disabled.controller.overrideEnabled.value = true;
    disabled.controller.overrideEnabled.value = false;
    expect(await disabled.controller.confirm()).toBe(true);
    expect(rendered).toHaveBeenCalledWith(expect.objectContaining({ mode: 'progressive', overrideColor: null }));
  });

  it('exposes no dialog-side overrideColor signal — the getBrushColor port is the only resolution path', async () => {
    const test = harness();
    await test.controller.openConfirmation();
    // D-08R/D-10: the override color is never stored dialog-side; the port resolves it live.
    expect('overrideColor' in test.controller).toBe(false);
    test.controller.overrideEnabled.value = true;
    test.setBrushColor('#1234ab');
    expect(await test.controller.confirm()).toBe(true);
    expect(rendered).toHaveBeenCalledWith(expect.objectContaining({ overrideColor: '#1234ab' }));
    expect(test.controller.appliedSummary.line1.value).toBe('Progressive · Override #1234ab · Motion 25/40');
  });

  it('falls back to no override (Original-colors behavior) when the port returns a malformed color (T-42-05-01)', async () => {
    const test = harness();
    await test.controller.openConfirmation();
    test.controller.overrideEnabled.value = true;
    test.setBrushColor('red'); // malformed port value — defensive guard mirrors existing input discipline
    expect(await test.controller.confirm()).toBe(true);
    expect(rendered).toHaveBeenCalledWith(expect.objectContaining({ overrideColor: null }));
    expect(test.controller.appliedSummary.line1.value).toBe('Progressive · Original colors · Motion 25/40');
  });

  it('never invokes script-library write ports during confirm and leaves the snapshot deeply unchanged', async () => {
    const test = harness();
    const fixture = script(99);
    const snapshotBefore = structuredClone(fixture);
    vi.mocked(test.library.loadSnapshot).mockResolvedValue(fixture);
    await test.controller.openConfirmation();
    expect(await test.controller.confirm()).toBe(true);

    const writePorts = ['saveActiveFrame', 'activateAndLoad', 'beginRename', 'updateRenameDraft', 'commitRename', 'cancelRename', 'requestDelete', 'confirmDelete', 'cancelDelete', 'select', 'updateProjectContext', 'enterScripts', 'refresh'] as const;
    for (const port of writePorts) expect(test.library[port]).not.toHaveBeenCalled();
    expect(test.library.loadSnapshot).toHaveBeenCalledTimes(1);
    // The reusable source document (brushes, strokes, metadata) stays byte-identical.
    expect(fixture).toEqual(snapshotBefore);
  });

  it.each([
    [''], ['0'], ['-2'], ['1.5'], ['abc'],
  ])('rejects repeat %j with the format error and blocks confirm', async (value) => {
    const test = harness();
    await test.controller.openConfirmation();
    test.controller.repeatText.value = value;
    expect(test.controller.repeatError.value).toBe('Enter a positive integer.');
    expect(await test.controller.confirm()).toBe(false);
    expect(rendered).not.toHaveBeenCalled();
  });

  it('bounds repeat by the safe product floor(Number.MAX_SAFE_INTEGER / cycle) derived before multiplication', async () => {
    const test = harness({ requestAuthority: vi.fn(async () => authority({ canonicalStart: 4, layerEndExclusive: 22, capacity: 18 })) });
    await test.controller.openConfirmation();
    test.controller.countText.value = '5';
    test.controller.repeatText.value = '1801439850948198'; // floor(MAX_SAFE_INTEGER / 5) — accepted
    expect(test.controller.repeatError.value).toBeNull();
    test.controller.repeatText.value = '1801439850948199'; // one above the bound
    expect(test.controller.repeatError.value).toBe('Repeat is too large for this cycle length.');
    test.controller.countText.value = '2';
    test.controller.repeatText.value = '9007199254740991'; // individually safe, but 2 × value is not
    expect(test.controller.repeatError.value).toBe('Repeat is too large for this cycle length.');
    test.controller.repeatText.value = '1'; // repeat 1 always passes format and bound
    expect(test.controller.repeatError.value).toBeNull();
    test.controller.countText.value = '5';
    test.controller.repeatText.value = '1801439850948199';
    expect(await test.controller.confirm()).toBe(false);
    expect(rendered).not.toHaveBeenCalled();
  });

  it('derives requested/effective/truncation from retained authority signals with locked copy', async () => {
    const test = harness({ requestAuthority: vi.fn(async () => authority({ canonicalStart: 4, layerEndExclusive: 22, capacity: 18 })) });
    await test.controller.openConfirmation();
    expect(test.controller.layerEndExclusive.value).toBe(22);
    test.controller.countText.value = '5';
    test.controller.repeatText.value = '5';
    expect(test.controller.loopReadout.value).toBe('Requested: 25f (5f × 5) · Effective: 18f — shortened by the next clip');
    test.controller.repeatText.value = '1';
    expect(test.controller.loopReadout.value).toBe('Requested: 5f (5f × 1) · Effective: 5f');
  });

  it('infinity skips repeat validation, preserves the last valid finite repeat, and renders the literal cycle form', async () => {
    const test = harness({ requestAuthority: vi.fn(async () => authority({ canonicalStart: 4, layerEndExclusive: 22, capacity: 18 })) });
    await test.controller.openConfirmation();
    test.controller.countText.value = '5';
    test.controller.repeatText.value = '1801439850948198'; // large valid value
    test.controller.setInfinity(true);
    expect(test.controller.infinity.value).toBe(true);
    expect(test.controller.repeatText.value).toBe('1801439850948198'); // preserved, never cleared
    expect(test.controller.repeatError.value).toBeNull(); // disabled field is not validated
    expect(test.controller.loopReadout.value).toBe('Cycle 5f × ∞ · Effective: 18f');
    test.controller.setInfinity(false);
    expect(test.controller.infinity.value).toBe(false);
    expect(test.controller.repeatText.value).toBe('1801439850948198'); // restored

    // Toggling on over an invalid draft keeps the last VALID finite repeat.
    test.controller.repeatText.value = 'abc';
    test.controller.setInfinity(true);
    test.controller.setInfinity(false);
    expect(test.controller.repeatText.value).toBe('1801439850948198');
  });

  it('applies first-time Static / Hold defaults (cycle 1, repeat 1, infinity off) only once', async () => {
    const test = harness();
    expect(test.controller.countText.value).toBe('Max'); // progressive defaults untouched
    test.controller.mode.value = 'static';
    expect(test.controller.countText.value).toBe('1');
    expect(test.controller.repeatText.value).toBe('1');
    expect(test.controller.infinity.value).toBe(false);
    // Session memory: later mode switches never re-apply the first-time defaults.
    test.controller.repeatText.value = '7';
    test.controller.mode.value = 'progressive';
    test.controller.mode.value = 'static';
    expect(test.controller.repeatText.value).toBe('7');
    expect(test.controller.countText.value).toBe('1');
  });

  it('keeps loop and option signals across dialog close/reopen within the session', async () => {
    const test = harness();
    await test.controller.openConfirmation();
    test.controller.mode.value = 'static';
    test.controller.repeatText.value = '12';
    test.controller.setInfinity(true);
    test.controller.overrideEnabled.value = true;
    test.controller.closeConfirmation();
    await test.controller.openConfirmation();
    expect(test.controller.mode.value).toBe('static');
    expect(test.controller.repeatText.value).toBe('12');
    expect(test.controller.infinity.value).toBe(true);
    // D-10: the override ENABLED STATE is remembered; the color itself is never stored — it
    // resolves live from the brush-color port (D-08R).
    expect(test.controller.overrideEnabled.value).toBe(true);
  });

  it('generates exactly the cycle value regardless of repeat or infinity', async () => {
    const bigRepeat = harness();
    await bigRepeat.controller.openConfirmation();
    bigRepeat.controller.countText.value = '3';
    bigRepeat.controller.repeatText.value = '999999';
    expect(await bigRepeat.controller.confirm()).toBe(true);
    expect(rendered).toHaveBeenCalledWith(expect.objectContaining({ frameCount: 3 }));

    rendered.mockClear();
    const infinite = harness();
    await infinite.controller.openConfirmation();
    infinite.controller.countText.value = '2';
    infinite.controller.setInfinity(true);
    expect(await infinite.controller.confirm()).toBe(true);
    expect(rendered).toHaveBeenCalledWith(expect.objectContaining({ frameCount: 2 }));
  });

  it('dialog Motion edits trigger zero port writes; only getMotion reads may occur', async () => {
    const test = harness();
    await test.controller.openConfirmation();
    test.getMotion.mockClear();
    test.requestAuthority.mockClear();
    test.stopPlayback.mockClear();
    test.log.mockClear();
    test.controller.dialogMotion.value = { deformation: 5, position: 10 };
    expect(test.getMotion).not.toHaveBeenCalled();
    expect(test.requestAuthority).not.toHaveBeenCalled();
    expect(test.commit).not.toHaveBeenCalled();
    expect(test.stopPlayback).not.toHaveBeenCalled();
    expect(test.log).not.toHaveBeenCalled();
  });

  it('resetDialogMotion re-reads the CURRENT Motion defaults port at call time and writes nowhere', async () => {
    const test = harness();
    await test.controller.openConfirmation();
    test.controller.dialogMotion.value = { deformation: 5, position: 10 };
    test.setMotion({ deformation: 70, position: 15 });
    test.getMotion.mockClear();
    test.controller.resetDialogMotion();
    expect(test.controller.dialogMotion.value).toEqual({ deformation: 70, position: 15 });
    expect(test.getMotion).toHaveBeenCalledTimes(1);
    expect(test.commit).not.toHaveBeenCalled();
    expect(test.requestAuthority).toHaveBeenCalledTimes(1); // only the open call
  });

  it('clears a stale generation error when a new generation starts, and retry succeeds from a clean error state', async () => {
    const commit = vi.fn()
      .mockImplementationOnce(async (): Promise<RotoPlayScriptCommitResult> => ({ ok: false, error: 'rejected' }))
      .mockImplementation(async (publication: RotoPlayScriptPhysicalPublication): Promise<RotoPlayScriptCommitResult> => ({
        ok: true,
        operationId: 'accepted-operation',
        acceptedRevision: 'revision-2',
        records: publication.records,
        interpolationMode: publication.interpolationMode,
        selectedKeyId: publication.selectedKeyId,
        selectedAppFrame: publication.selectedAppFrame,
      }));
    const test = harness({ commit });
    await test.controller.openConfirmation();
    test.controller.countText.value = '1';
    expect(await test.controller.confirm()).toBe(false);
    expect(test.controller.error.value).toBe('rejected');

    let releaseRender!: () => void;
    rendered.mockClear();
    rendered.mockImplementationOnce(async ({ frameCount, canonicalStart }) => new Promise((resolve) => {
      releaseRender = () => resolve(Array.from({ length: frameCount }, (_, index) => ({
        frameIndex: 0,
        appFrame: canonicalStart + index,
        dataUrl: pngDataUrl(`staged-${index}`),
        width: 10,
        height: 10,
      })));
    }));
    const retry = test.controller.confirm();
    await vi.waitFor(() => expect(rendered).toHaveBeenCalled());
    expect(test.controller.error.value).toBeNull(); // stale error cleared at generation start
    releaseRender();
    expect(await retry).toBe(true);
    expect(test.controller.error.value).toBeNull();
    expect(test.controller.phase.value).toBe('complete');
  });

  it('drives the generation-error lifecycle on renderer failure: failed phase, error set, progress hidden, dialog open, inputs enabled, zero mutations', async () => {
    rendered.mockRejectedValueOnce(new Error('render boom'));
    const test = harness();
    await test.controller.openConfirmation();
    test.controller.countText.value = '2';
    expect(await test.controller.confirm()).toBe(false);
    expect(test.controller.phase.value).toBe('failed');
    expect(test.controller.error.value).toBe('render boom');
    expect(test.controller.progress.value).toBeNull(); // progress bar hides
    expect(test.controller.confirmationOpen.value).toBe(true); // dialog stays open
    expect(test.controller.canCancel.value).toBe(false); // inputs re-enable
    expect(test.commit).not.toHaveBeenCalled(); // zero partial destination frames or timeline mutations
  });

  it('normal user cancellation returns phase cancelled with a null error channel and zero mutations', async () => {
    rendered.mockImplementationOnce(async ({ signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError')), { once: true })));
    const test = harness();
    await test.controller.openConfirmation();
    test.controller.countText.value = '1';
    rendered.mockClear();
    const pending = test.controller.confirm();
    await vi.waitFor(() => expect(rendered).toHaveBeenCalled()); // cancel mid-render, not mid-prepare
    test.controller.cancel();
    expect(await pending).toBe(false);
    expect(test.controller.phase.value).toBe('cancelled');
    expect(test.controller.error.value).toBeNull(); // never an error shown on normal cancellation
    expect(test.controller.confirmationOpen.value).toBe(true);
    expect(test.commit).not.toHaveBeenCalled();
  });

  it('composes the applied summary from the committed generation (static + override, layer-end boundary exact)', async () => {
    const test = harness();
    await test.controller.openConfirmation();
    test.controller.mode.value = 'static';
    test.controller.countText.value = '4'; // after the first-time Static / Hold default applies
    test.controller.overrideEnabled.value = true;
    test.setBrushColor('#3366ff');
    expect(await test.controller.confirm()).toBe(true);
    expect(test.controller.appliedSummary.line1.value).toBe('Static / Hold · Override #3366ff · Motion 25/40');
    // end = start + count − 1 = 7 = layerEndExclusive − 1 — exact at the layer-end boundary, no off-by-one
    expect(test.controller.appliedSummary.line2.value).toBe('F4–F7 · 4 frames generated');
  });

  it('keeps the confirm-time snapshot hex in the applied summary even when the port value changes afterwards (D-08R no-retroactive)', async () => {
    const test = harness();
    await test.controller.openConfirmation();
    test.controller.overrideEnabled.value = true;
    test.setBrushColor('#3366ff');
    expect(await test.controller.confirm()).toBe(true);
    expect(test.controller.appliedSummary.line1.value).toBe('Progressive · Override #3366ff · Motion 25/40');
    // Later brush-color changes never retroactively rewrite the success-only summary.
    test.setBrushColor('#ff0000');
    await test.controller.openConfirmation();
    expect(test.controller.appliedSummary.line1.value).toBe('Progressive · Override #3366ff · Motion 25/40');
    expect(test.controller.appliedSummary.line2.value).toBe('F4–F7 · 4 frames generated');
  });

  it('composes the first-open summary line 1 from the CURRENT port value when the override is enabled', async () => {
    const test = harness();
    test.controller.overrideEnabled.value = true;
    test.setBrushColor('#7a8b9c');
    await test.controller.openConfirmation();
    expect(test.controller.appliedSummary.line1.value).toBe('Progressive · Override #7a8b9c · Motion 25/40');
    expect(test.controller.appliedSummary.line2.value).toBe('No frames generated yet');
  });

  it('shows locked first-time defaults before the first successful Generate', async () => {
    const test = harness();
    expect(test.controller.appliedSummary.line1.value).toBe('Progressive · Original colors · Motion 0/0');
    expect(test.controller.appliedSummary.line2.value).toBe('No frames generated yet');
    await test.controller.openConfirmation();
    expect(test.controller.appliedSummary.line1.value).toBe('Progressive · Original colors · Motion 25/40');
    expect(test.controller.appliedSummary.line2.value).toBe('No frames generated yet');
  });

  it('keeps both summary lines byte-identical across unsaved edits, dialog cancel, generation cancellation, and failure', async () => {
    const test = harness();
    await test.controller.openConfirmation();
    test.controller.countText.value = '2';
    expect(await test.controller.confirm()).toBe(true);
    const line1 = test.controller.appliedSummary.line1.value;
    const line2 = test.controller.appliedSummary.line2.value;
    expect(line2).toBe('F4–F5 · 2 frames generated');

    // Unsaved dialog edits after a success.
    await test.controller.openConfirmation();
    test.controller.mode.value = 'static';
    test.controller.overrideEnabled.value = true;
    test.controller.dialogMotion.value = { deformation: 1, position: 2 };
    test.controller.repeatText.value = '9';
    expect(test.controller.appliedSummary.line1.value).toBe(line1);
    expect(test.controller.appliedSummary.line2.value).toBe(line2);

    // Dialog cancel (idle close path).
    test.controller.cancel();
    expect(test.controller.appliedSummary.line1.value).toBe(line1);
    expect(test.controller.appliedSummary.line2.value).toBe(line2);

    // Generation cancellation (mid-render so the held render consumes its abort listener).
    rendered.mockClear();
    rendered.mockImplementationOnce(async ({ signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError')), { once: true })));
    const pending = test.controller.confirm();
    await vi.waitFor(() => expect(rendered).toHaveBeenCalled());
    test.controller.cancel();
    expect(await pending).toBe(false);
    expect(test.controller.appliedSummary.line1.value).toBe(line1);
    expect(test.controller.appliedSummary.line2.value).toBe(line2);

    // Generation failure.
    rendered.mockRejectedValueOnce(new Error('boom'));
    expect(await test.controller.confirm()).toBe(false);
    expect(test.controller.appliedSummary.line1.value).toBe(line1);
    expect(test.controller.appliedSummary.line2.value).toBe(line2);
  });

  it('a second successful Generate replaces both summary lines atomically from the newly committed options', async () => {
    const test = harness();
    await test.controller.openConfirmation();
    test.controller.mode.value = 'static';
    test.controller.countText.value = '4';
    test.controller.overrideEnabled.value = true;
    test.setBrushColor('#3366ff');
    expect(await test.controller.confirm()).toBe(true);
    expect(test.controller.appliedSummary.line1.value).toBe('Static / Hold · Override #3366ff · Motion 25/40');
    expect(test.controller.appliedSummary.line2.value).toBe('F4–F7 · 4 frames generated');

    await test.controller.openConfirmation();
    test.controller.mode.value = 'progressive';
    test.controller.overrideEnabled.value = false;
    test.controller.dialogMotion.value = { deformation: 5, position: 10 };
    test.controller.countText.value = '2';
    expect(await test.controller.confirm()).toBe(true);
    expect(test.controller.appliedSummary.line1.value).toBe('Progressive · Original colors · Motion 5/10');
    expect(test.controller.appliedSummary.line2.value).toBe('F4–F5 · 2 frames generated');
  });
});

// 43-04 Task 2 (HOLD-03): commit-path atomicity for static/hold generations — the
// staged atomic commit is reused verbatim (no second commit path), mid-stage
// cancellation and renderer failure commit zero destination frames, and an accepted
// generation is exactly ONE history command with one-Undo/one-Redo semantics.
// Hardening specs against shipped machinery — expected to PASS on first run; a RED
// result routes through the bounded deviation protocol (never asserted away).
describe('createRotoPlayScriptController HOLD-03 atomic commit', () => {
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

  it('mid-stage cancellation of a static/hold generation commits zero destination keys — the document is byte-identical to before the attempt', async () => {
    // Renderer parks between staged frames so the cancellation lands mid-stage.
    rendered.mockImplementationOnce(async ({ frameCount, canonicalStart, onProgress, signal }) => {
      const staged: Array<{ frameIndex: number; appFrame: number; dataUrl: string; width: number; height: number }> = [];
      for (let index = 0; index < frameCount; index += 1) {
        if (signal.aborted) throw new DOMException('cancelled', 'AbortError');
        staged.push({ frameIndex: 0, appFrame: canonicalStart + index, dataUrl: pngDataUrl(`staged-${index}`), width: 10, height: 10 });
        onProgress?.(index + 1, frameCount);
        if (index < frameCount - 1) {
          await new Promise((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError')), { once: true }));
        }
      }
      return staged;
    });
    const test = harness();
    await test.controller.openConfirmation();
    test.controller.mode.value = 'static';
    test.controller.countText.value = '3';
    const documentBefore = JSON.stringify(authority().physicalRecords);

    const pending = test.controller.confirm();
    await vi.waitFor(() => expect(test.controller.progress.value?.completed).toBe(1)); // one frame staged
    test.controller.cancel();
    expect(await pending).toBe(false);

    expect(test.controller.phase.value).toBe('cancelled');
    expect(test.controller.error.value).toBeNull();
    // The commit port is the ONLY document-mutation channel: never invoked, and the
    // partially staged range was discarded with the rejected render — no partial range.
    expect(test.commit).not.toHaveBeenCalled();
    expect(JSON.stringify(authority().physicalRecords)).toBe(documentBefore);
  });

  it('a static/hold renderer failure mid-generation commits zero destination keys and surfaces the inline error', async () => {
    rendered.mockImplementationOnce(async ({ frameCount, onProgress }) => {
      for (let index = 0; index < 2; index += 1) onProgress?.(index + 1, frameCount); // two frames staged, then boom
      throw new Error('renderer exploded mid-range');
    });
    const test = harness();
    await test.controller.openConfirmation();
    test.controller.mode.value = 'static';
    test.controller.countText.value = '4';

    expect(await test.controller.confirm()).toBe(false);
    expect(test.controller.phase.value).toBe('failed');
    expect(test.controller.error.value).toBe('renderer exploded mid-range');
    expect(test.controller.confirmationOpen.value).toBe(true); // inline error surface
    expect(test.commit).not.toHaveBeenCalled(); // zero committed destination frames — no partial range
  });

  it('a completed static/hold generation is exactly one history command — one Undo removes every generated key, one Redo restores them', async () => {
    const test = harness();
    await test.controller.openConfirmation();
    test.controller.mode.value = 'static';
    test.controller.countText.value = '3';
    expect(await test.controller.confirm()).toBe(true);

    // One atomic commit for the whole generation — no second commit path.
    expect(test.commit).toHaveBeenCalledTimes(1);
    const publication = test.commit.mock.calls[0][0];
    expect(publication.records.map((record) => record.appFrame)).toEqual([1, 4, 5, 6]);
    expect(publication.semanticDelta.kind).toBe('play-script');
    expect(publication.semanticDelta.affectedStartAppFrame).toBe(4);
    expect(publication.semanticDelta.affectedEndAppFrame).toBe(6);
    expect(publication.semanticDelta.freshKeyIds).toHaveLength(3);

    // Drive the REAL accepted-only history hook with the accepted play-script output
    // to prove the one-command Undo/Redo semantics end to end.
    const toRecord = (entry: { keyId: string; appFrame: number; payload: PhysicPaintRotoRealKeyRecord['payload'] }): PhysicPaintRotoRealKeyRecord => ({
      kind: 'real-key',
      keyId: entry.keyId,
      appFrame: entry.appFrame,
      payload: entry.payload,
    });
    const snapshot = (
      records: readonly PhysicPaintRotoRealKeyRecord[],
      selectedKeyId: string | null,
      selectedAppFrame: number | null,
    ): RotoPhysicalEditSnapshot<null> => {
      const interpolation = { enabled: true, mode: 'duplicate' } as const;
      const revision = buildPhysicPaintRotoPhysicalRevision(records, interpolation, []);
      return {
        launchOperationId: 'launch',
        layerId: 'layer-1',
        projectContextId: 'context-1',
        records,
        interpolation,
        loopClips: [],
        capacity: 600,
        expectedRevision: revision,
        stagedRevision: revision,
        selectedKeyId,
        selectedAppFrame,
        currentAppFrame: selectedAppFrame ?? 4,
        dirtyFrames: new Set(),
        editableFrames: records.map((entry) => entry.appFrame),
        liveOverlayActionCounts: new Map(),
        frameStates: new Map(),
        previewFrames: new Map(),
        capturedFrames: new Map(),
        confirmedFrames: new Map(),
        cachedReference: { url: null, cachedRepaintBase: null },
        engineState: null,
      };
    };
    const beforeSnapshot = snapshot([toRecord(physicalRecord('key-1', 1, 'existing'))], 'key-4', 4);
    const afterSnapshot = snapshot(publication.records, publication.selectedKeyId, publication.selectedAppFrame);

    const acceptedOutput = signal<RotoPhysicalEditAcceptedOutput<null> | null>(null);
    const pendingOperationId = signal<string | null>(null);
    const availability = signal({ undo: 0, redo: 0 });
    let current = afterSnapshot; // the committed generation is the live document
    let replayNumber = 0;
    const executePhysicalEdit = vi.fn(async (input: RotoPhysicalEditExecuteInput<never, null>) => {
      const target = input.replayTargetSnapshot;
      if (!target || !input.historyProvenance) return false;
      const source = current;
      current = target;
      replayNumber += 1;
      acceptedOutput.value = {
        before: source,
        after: target,
        acceptedRevision: buildPhysicPaintRotoPhysicalRevision(target.records, target.interpolation, target.loopClips),
        operationId: `replay-${replayNumber}`,
        operationKind: input.operationKind,
        historyProvenance: input.historyProvenance,
      };
      return true;
    });
    const history = useRotoPhysicalEditHistory({
      identity: { launchOperationId: 'launch', layerId: 'layer-1' },
      availability,
      coordinator: {
        executePhysicalEdit: executePhysicalEdit as never,
        pendingOperationId,
        acceptedOutput,
      },
      recordsPort: {
        getRecords: () => current.records,
        getInterpolation: () => current.interpolation,
        getCapacity: () => current.capacity,
        getLoopClips: () => current.loopClips,
        replaceLoopClips: () => ({ ok: true }),
        replaceRecords: () => ({ ok: true }),
      },
      undoPaint: () => false,
      redoPaint: () => false,
    });

    acceptedOutput.value = {
      before: beforeSnapshot,
      after: afterSnapshot,
      acceptedRevision: buildPhysicPaintRotoPhysicalRevision(afterSnapshot.records, afterSnapshot.interpolation, afterSnapshot.loopClips),
      operationId: 'accepted-operation',
      operationKind: 'play-script',
      historyProvenance: null,
    };
    // Exactly ONE history command for the entire 3-frame generation.
    expect(availability.value).toEqual({ undo: 1, redo: 0 });

    expect(await history.undo()).toBe(true);
    expect(current.records.map((record) => record.appFrame)).toEqual([1]); // every generated key removed at once
    expect(current.records).toEqual(beforeSnapshot.records);
    expect(availability.value).toEqual({ undo: 0, redo: 1 });

    expect(await history.redo()).toBe(true);
    expect(current.records).toEqual(afterSnapshot.records); // all three generated keys restored at once
    expect(availability.value).toEqual({ undo: 1, redo: 0 });
    expect(executePhysicalEdit.mock.calls.map(([input]) => input.operationKind)).toEqual(['undo', 'redo']);
  });

  it('re-applying the same static/hold generation to the same inputs produces a byte-identical publication (idempotent commit path)', async () => {
    const test = harness();
    await test.controller.openConfirmation();
    test.controller.mode.value = 'static';
    test.controller.countText.value = '3';
    expect(await test.controller.confirm()).toBe(true);
    const first = test.commit.mock.calls[0][0];

    // The parent accepted: a fresh authority read now reflects the committed records.
    test.requestAuthority.mockImplementation(async () => authority({
      physicalRecords: first.records.map((record) => ({ keyId: record.keyId, appFrame: record.appFrame, payload: record.payload })),
      frames: first.records.map((record) => ({ ...record.payload, source: 'real-key' as const })),
    }));
    await test.controller.openConfirmation();
    test.controller.countText.value = '3';
    expect(await test.controller.confirm()).toBe(true);

    expect(test.commit).toHaveBeenCalledTimes(2);
    const second = test.commit.mock.calls[1][0];
    // Same script + destination + options → the committed record set is byte-identical:
    // existing keyIds are reused and the staged payloads are deterministic.
    expect(JSON.stringify(second.records)).toBe(JSON.stringify(first.records));
    expect(second.semanticDelta.freshKeyIds).toHaveLength(0); // zero new identity on re-application
    expect(second.expectedRevision).toBe(first.expectedRevision);
  });
});

// 43-05 Task 2 (D-06): preflight shorten warning on the confirm path. When the
// pending generation's destination range intersects an existing loop's
// effective range, the controller surfaces the locked line BEFORE the commit
// proceeds; the computation delegates to the 43-02 shared derivation (Pitfall
// 4 — never controller-local boundary math), and the accepted commit plus the
// derived loop shrink remain one history command (43-01 snapshot contract).
describe('createRotoPlayScriptController D-06 loop-shorten preflight', () => {
  const SOURCE_KEY_IDS = ['A', 'B', 'C', 'D', 'E'] as const;

  const loopClip = (
    loopId: string,
    placementStart: number,
    repeat: number | 'infinity',
    sourceKeyIds: readonly string[] = SOURCE_KEY_IDS,
  ): PhysicPaintRotoLoopClip => ({ loopId, placementStart, sourceKeyIds: [...sourceKeyIds], repeat, mode: 'static' });

  // Source cycle A..E at frames 0..4; loop L1 placed at 0 with repeat 6 →
  // requested/effective range [0, 30) before any generation.
  const loopAuthority = (overrides: Partial<PhysicPaintRotoAuthorityResult> = {}): PhysicPaintRotoAuthorityResult => authority({
    canonicalStart: 6,
    layerEndExclusive: 40,
    capacity: 34,
    physicalRecords: SOURCE_KEY_IDS.map((keyId, index) => physicalRecord(keyId, index, `src-${keyId}`)),
    ...overrides,
  });

  const loopHarness = (
    loopClips: readonly PhysicPaintRotoLoopClip[],
    authorityOverrides: Partial<PhysicPaintRotoAuthorityResult> = {},
  ) => {
    const test = harness({
      requestAuthority: vi.fn(async () => loopAuthority(authorityOverrides)),
      getRotoLoopClips: () => loopClips,
    });
    test.setSelection({ kind: 'empty', keyId: null, appFrame: 6 });
    return test;
  };

  const effectiveEndOf = (
    records: readonly PhysicPaintRotoRealKeyRecord[],
    loopClips: readonly PhysicPaintRotoLoopClip[],
    loopId: string,
    parentEndExclusive: number,
  ): number => {
    const context = derivePhysicPaintRotoLoopRanges({
      identities: records.map(({ keyId, appFrame }) => ({ keyId, appFrame })),
      loopClips,
      parentEndExclusive,
      capacity: 600,
    });
    const range = context.ranges.find((entry) => entry.loopId === loopId);
    if (!range) throw new Error(`Loop "${loopId}" missing from derivation.`);
    return range.effectiveEnd;
  };

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

  it('surfaces the locked preflight line with N and F when the destination range intersects a loop', async () => {
    const test = loopHarness([loopClip('L1', 0, 6)]);
    expect(test.controller.loopShortenPreflight.value).toBeNull(); // no authority snapshot before open
    await test.controller.openConfirmation();
    // Default Max count (34) → destination [6, 40) intersects the loop's [0, 30) at frame 6.
    expect(test.controller.loopShortenPreflight.value).toBe('This operation will shorten 1 linked loop(s), starting at frame 6.');
    test.controller.countText.value = '5';
    expect(test.controller.loopShortenPreflight.value).toBe('This operation will shorten 1 linked loop(s), starting at frame 6.');
    test.controller.countText.value = 'garbage';
    expect(test.controller.loopShortenPreflight.value).toBeNull(); // unparseable count → no destination, no warning
  });

  it('reports every affected loop and the earliest truncation frame', async () => {
    // L2 duplicates the cycle at placementStart 20, repeat 3 → [20, 35); L1 is
    // bounded by L2's start → effective [0, 20).
    const test = loopHarness([loopClip('L1', 0, 6), loopClip('L2', 20, 3)]);
    await test.controller.openConfirmation();
    test.controller.countText.value = '16'; // destination [6, 22) → L1 truncates at 6, L2 at 20
    expect(test.controller.loopShortenPreflight.value).toBe('This operation will shorten 2 linked loop(s), starting at frame 6.');
  });

  it('shows no preflight line when no loop is affected', async () => {
    // No loops at all.
    const noLoops = loopHarness([]);
    await noLoops.controller.openConfirmation();
    noLoops.controller.countText.value = '5';
    expect(noLoops.controller.loopShortenPreflight.value).toBeNull();

    // Destination beyond the loop's effective range: loop effective [0, 30), destination [32, 37).
    const beyond = loopHarness([loopClip('L1', 0, 6)], { canonicalStart: 32, layerEndExclusive: 40, capacity: 8 });
    beyond.setSelection({ kind: 'empty', keyId: null, appFrame: 32 });
    await beyond.controller.openConfirmation();
    beyond.controller.countText.value = '5';
    expect(beyond.controller.loopShortenPreflight.value).toBeNull();
  });

  it('regenerating over the loop’s own source cycle shows no preflight (D-24 self-exclusion)', async () => {
    // Destination [0, 5) covers exactly the loop's own source keys — their
    // keyIds are preserved, so the loop never truncates itself.
    const own = loopHarness([loopClip('L1', 0, 6)], { canonicalStart: 0, layerEndExclusive: 40, capacity: 39 });
    own.setSelection({ kind: 'real-key', keyId: 'A', appFrame: 0 });
    await own.controller.openConfirmation();
    own.controller.countText.value = '5';
    expect(own.controller.loopShortenPreflight.value).toBeNull();
  });

  it('the preflight is advisory — confirm proceeds and commits with the warning visible', async () => {
    const test = loopHarness([loopClip('L1', 0, 6)]);
    await test.controller.openConfirmation();
    test.controller.countText.value = '5';
    expect(test.controller.loopShortenPreflight.value).toBe('This operation will shorten 1 linked loop(s), starting at frame 6.');
    expect(await test.controller.confirm()).toBe(true);
    expect(test.commit).toHaveBeenCalledTimes(1);
    expect(test.controller.phase.value).toBe('complete');
  });

  it('the accepted commit and the derived loop shrink are ONE history command — one Undo re-expands, one Redo re-applies', async () => {
    const test = loopHarness([loopClip('L1', 0, 6)]);
    await test.controller.openConfirmation();
    test.controller.countText.value = '5';
    expect(await test.controller.confirm()).toBe(true);

    const loops = [loopClip('L1', 0, 6)];
    const publication = test.commit.mock.calls[0][0];
    const toRecord = (entry: { keyId: string; appFrame: number; payload: PhysicPaintRotoRealKeyRecord['payload'] }): PhysicPaintRotoRealKeyRecord => ({
      kind: 'real-key',
      keyId: entry.keyId,
      appFrame: entry.appFrame,
      payload: entry.payload,
    });
    const snapshot = (
      records: readonly PhysicPaintRotoRealKeyRecord[],
      selectedKeyId: string | null,
      selectedAppFrame: number | null,
    ): RotoPhysicalEditSnapshot<null> => {
      const interpolation = { enabled: true, mode: 'duplicate' } as const;
      const revision = buildPhysicPaintRotoPhysicalRevision(records, interpolation, loops);
      return {
        launchOperationId: 'launch',
        layerId: 'layer-1',
        projectContextId: 'context-1',
        records,
        interpolation,
        loopClips: loops,
        capacity: 600,
        expectedRevision: revision,
        stagedRevision: revision,
        selectedKeyId,
        selectedAppFrame,
        currentAppFrame: selectedAppFrame ?? 6,
        dirtyFrames: new Set(),
        editableFrames: records.map((entry) => entry.appFrame),
        liveOverlayActionCounts: new Map(),
        frameStates: new Map(),
        previewFrames: new Map(),
        capturedFrames: new Map(),
        confirmedFrames: new Map(),
        cachedReference: { url: null, cachedRepaintBase: null },
        engineState: null,
      };
    };
    const beforeSnapshot = snapshot(SOURCE_KEY_IDS.map((keyId, index) => toRecord(physicalRecord(keyId, index, `src-${keyId}`))), null, 6);
    const afterSnapshot = snapshot(publication.records, publication.selectedKeyId, publication.selectedAppFrame);
    // The committed generation truncated the loop at frame 6 (derived).
    expect(effectiveEndOf(afterSnapshot.records, loops, 'L1', 40)).toBe(6);

    const acceptedOutput = signal<RotoPhysicalEditAcceptedOutput<null> | null>(null);
    const pendingOperationId = signal<string | null>(null);
    const availability = signal({ undo: 0, redo: 0 });
    let current = afterSnapshot;
    let replayNumber = 0;
    const executePhysicalEdit = vi.fn(async (input: RotoPhysicalEditExecuteInput<never, null>) => {
      const target = input.replayTargetSnapshot;
      if (!target || !input.historyProvenance) return false;
      const source = current;
      current = target;
      replayNumber += 1;
      acceptedOutput.value = {
        before: source,
        after: target,
        acceptedRevision: buildPhysicPaintRotoPhysicalRevision(target.records, target.interpolation, target.loopClips),
        operationId: `replay-${replayNumber}`,
        operationKind: input.operationKind,
        historyProvenance: input.historyProvenance,
      };
      return true;
    });
    const history = useRotoPhysicalEditHistory({
      identity: { launchOperationId: 'launch', layerId: 'layer-1' },
      availability,
      coordinator: { executePhysicalEdit: executePhysicalEdit as never, pendingOperationId, acceptedOutput },
      recordsPort: {
        getRecords: () => current.records,
        getInterpolation: () => current.interpolation,
        getCapacity: () => current.capacity,
        getLoopClips: () => current.loopClips,
        replaceLoopClips: () => ({ ok: true }),
        replaceRecords: () => ({ ok: true }),
      },
      undoPaint: () => false,
      redoPaint: () => false,
    });

    acceptedOutput.value = {
      before: beforeSnapshot,
      after: afterSnapshot,
      acceptedRevision: buildPhysicPaintRotoPhysicalRevision(afterSnapshot.records, afterSnapshot.interpolation, afterSnapshot.loopClips),
      operationId: 'accepted-operation',
      operationKind: 'play-script',
      historyProvenance: null,
    };
    expect(availability.value).toEqual({ undo: 1, redo: 0 }); // ONE command for commit + shrink

    expect(await history.undo()).toBe(true);
    expect(current.records.map((entry) => entry.keyId)).toEqual([...SOURCE_KEY_IDS]);
    // The loop re-expands automatically with the generated keys gone.
    expect(effectiveEndOf(current.records, current.loopClips, 'L1', 40)).toBe(30);
    expect(availability.value).toEqual({ undo: 0, redo: 1 });

    expect(await history.redo()).toBe(true);
    expect(current.records).toEqual(afterSnapshot.records);
    expect(effectiveEndOf(current.records, current.loopClips, 'L1', 40)).toBe(6);
    expect(availability.value).toEqual({ undo: 1, redo: 0 });
    expect(executePhysicalEdit.mock.calls.map(([input]) => input.operationKind)).toEqual(['undo', 'redo']);
  });
});

// 43-06 Task 1 (D-01/D-02/D-03/D-05/D-10/D-31, audit finding 7): loop-edit and
// source-edit dialog modes, the atomic loop ops (Update/Unlink/Duplicate/
// Repair/Relink) through the ONE existing commit port, apply-time loop
// persistence with the S4 Link/Create matching (Q2), and the resolver-derived
// loop-edit readout (Pitfall 4). Every persistent op is proven through the
// full initial → operation → Undo → Redo transaction cycle.
describe('createRotoPlayScriptController loop modes and loop ops (43-06)', () => {
  const CYCLE_IDS = ['S1', 'S2', 'S3', 'S4', 'S5'] as const; // source cycle at frames 10..14
  const PROVENANCE = { scriptId: 'script-1', motion: { deformation: 0, position: 0 }, overrideColor: null };

  const loopClip = (
    loopId: string,
    placementStart: number,
    repeat: number | 'infinity',
    sourceKeyIds: readonly string[] = CYCLE_IDS,
    withProvenance = true,
  ): PhysicPaintRotoLoopClip => ({
    loopId,
    placementStart,
    sourceKeyIds: [...sourceKeyIds],
    repeat,
    mode: 'static',
    ...(withProvenance
      ? { scriptId: PROVENANCE.scriptId, motion: { ...PROVENANCE.motion }, overrideColor: PROVENANCE.overrideColor }
      : {}),
  });

  // Source cycle S1..S5 at frames 10..14; layer end 40; no foreign keys unless
  // the override adds them.
  const loopAuthority = (overrides: Partial<PhysicPaintRotoAuthorityResult> = {}): PhysicPaintRotoAuthorityResult => authority({
    canonicalStart: 20,
    layerEndExclusive: 40,
    capacity: 20,
    physicalCapacity: 600,
    physicalRecords: CYCLE_IDS.map((keyId, index) => physicalRecord(keyId, 10 + index, `src-${keyId}`)),
    ...overrides,
  });

  const loopOpHarness = (
    loopClips: readonly PhysicPaintRotoLoopClip[],
    authorityOverrides: Partial<PhysicPaintRotoAuthorityResult> = {},
    portOverrides: Partial<RotoPlayScriptControllerPorts> = {},
  ) => {
    const localAuthority = loopAuthority(authorityOverrides);
    const requestAuthority = vi.fn(async () => localAuthority);
    const getLoopEditSnapshot = vi.fn((placementStart: number) => ({
      identities: localAuthority.physicalRecords.map(({ keyId, appFrame }) => ({ keyId, appFrame })),
      physicalCapacity: localAuthority.physicalCapacity,
      layerEndExclusive: localAuthority.layerEndExclusive,
      remainingCapacity: Math.max(0, localAuthority.physicalCapacity - placementStart),
    }));
    const commit = vi.fn(async (publication: RotoPlayScriptPhysicalPublication): Promise<RotoPlayScriptCommitResult> => ({
      ok: true,
      operationId: 'accepted-operation',
      acceptedRevision: 'revision-2',
      records: publication.records,
      interpolationMode: publication.interpolationMode,
      selectedKeyId: publication.selectedKeyId,
      selectedAppFrame: publication.selectedAppFrame,
      ...(publication.loopClips ? { loopClips: publication.loopClips } : {}),
    }));
    const test = harness({ requestAuthority, commit, getRotoLoopClips: () => loopClips, getLoopEditSnapshot, ...portOverrides });
    return { ...test, requestAuthority, getLoopEditSnapshot, commit };
  };

  const asRealKeyRecords = (records: PhysicPaintRotoAuthorityResult['physicalRecords']): PhysicPaintRotoRealKeyRecord[] =>
    records.map((record) => ({ kind: 'real-key', keyId: record.keyId, appFrame: record.appFrame, payload: record.payload }));

  const deriveRange = (
    records: readonly PhysicPaintRotoRealKeyRecord[],
    loopClips: readonly PhysicPaintRotoLoopClip[],
    loopId: string,
    parentEndExclusive = 40,
  ) => {
    const context = derivePhysicPaintRotoLoopRanges({
      identities: records.map(({ keyId, appFrame }) => ({ keyId, appFrame })),
      loopClips,
      parentEndExclusive,
      capacity: 600,
    });
    const range = context.ranges.find((entry) => entry.loopId === loopId);
    if (!range) throw new Error(`Loop "${loopId}" missing from derivation.`);
    return range;
  };

  // Drives the REAL accepted-only history hook across one accepted loop-op
  // output — the same idiom as the Phase 42 one-history-command spec, with
  // loopClips riding every snapshot (43-01 contract).
  const driveLoopHistory = (input: {
    beforeRecords: readonly PhysicPaintRotoRealKeyRecord[];
    beforeLoopClips: readonly PhysicPaintRotoLoopClip[];
    publication: RotoPlayScriptPhysicalPublication;
  }) => {
    const interpolation = { enabled: true, mode: 'duplicate' } as const;
    const snapshot = (
      records: readonly PhysicPaintRotoRealKeyRecord[],
      loopClips: readonly PhysicPaintRotoLoopClip[],
    ): RotoPhysicalEditSnapshot<null> => {
      const revision = buildPhysicPaintRotoPhysicalRevision(records, interpolation, loopClips);
      return {
        launchOperationId: 'launch',
        layerId: 'layer-1',
        projectContextId: 'context-1',
        records,
        interpolation,
        loopClips,
        capacity: 600,
        expectedRevision: revision,
        stagedRevision: revision,
        selectedKeyId: null,
        selectedAppFrame: null,
        currentAppFrame: 0,
        dirtyFrames: new Set(),
        editableFrames: records.map((entry) => entry.appFrame),
        liveOverlayActionCounts: new Map(),
        frameStates: new Map(),
        previewFrames: new Map(),
        capturedFrames: new Map(),
        confirmedFrames: new Map(),
        cachedReference: { url: null, cachedRepaintBase: null },
        engineState: null,
      };
    };
    const beforeSnapshot = snapshot(input.beforeRecords, input.beforeLoopClips);
    const afterSnapshot = snapshot(input.publication.records, input.publication.loopClips ?? input.beforeLoopClips);
    const acceptedOutput = signal<RotoPhysicalEditAcceptedOutput<null> | null>(null);
    const pendingOperationId = signal<string | null>(null);
    const availability = signal({ undo: 0, redo: 0 });
    let current = afterSnapshot;
    let replayNumber = 0;
    const executePhysicalEdit = vi.fn(async (edit: RotoPhysicalEditExecuteInput<never, null>) => {
      const target = edit.replayTargetSnapshot;
      if (!target || !edit.historyProvenance) return false;
      const source = current;
      current = target;
      replayNumber += 1;
      acceptedOutput.value = {
        before: source,
        after: target,
        acceptedRevision: buildPhysicPaintRotoPhysicalRevision(target.records, target.interpolation, target.loopClips),
        operationId: `replay-${replayNumber}`,
        operationKind: edit.operationKind,
        historyProvenance: edit.historyProvenance,
      };
      return true;
    });
    const history = useRotoPhysicalEditHistory({
      identity: { launchOperationId: 'launch', layerId: 'layer-1' },
      availability,
      coordinator: { executePhysicalEdit: executePhysicalEdit as never, pendingOperationId, acceptedOutput },
      recordsPort: {
        getRecords: () => current.records,
        getInterpolation: () => current.interpolation,
        getCapacity: () => current.capacity,
        getLoopClips: () => current.loopClips,
        replaceLoopClips: () => ({ ok: true }),
        replaceRecords: () => ({ ok: true }),
      },
      undoPaint: () => false,
      redoPaint: () => false,
    });
    acceptedOutput.value = {
      before: beforeSnapshot,
      after: afterSnapshot,
      acceptedRevision: buildPhysicPaintRotoPhysicalRevision(afterSnapshot.records, afterSnapshot.interpolation, afterSnapshot.loopClips),
      operationId: 'accepted-operation',
      operationKind: 'play-script',
      historyProvenance: null,
    };
    return { history, availability, beforeSnapshot, afterSnapshot, getCurrent: () => current };
  };

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

  describe('openLoopEdit (D-01)', () => {
    it('opens the dialog in loop-edit mode prefilled from the canonical record — never blank', async () => {
      const test = loopOpHarness([loopClip('L1', 10, 3)]);
      const result = await test.controller.openLoopEdit('L1');
      expect(result).toEqual({ ok: true, reason: null });
      expect(test.controller.dialogMode.value).toBe('loop-edit');
      expect(test.controller.confirmationOpen.value).toBe(true);
      expect(test.controller.loopEditTarget.value?.loopId).toBe('L1');
      expect(test.controller.repeatText.value).toBe('3');
      expect(test.controller.infinity.value).toBe(false);
      // Frames-per-cycle is locked at the cycle length with its value preserved.
      expect(test.controller.countText.value).toBe('5');
      expect(test.controller.loopEditSourceStart.value).toBe(10);
      expect(test.getLoopEditSnapshot).toHaveBeenCalledWith(10);
      expect(test.requestAuthority).not.toHaveBeenCalled();
    });

    it('prefills the infinity state without clearing the last valid finite repeat', async () => {
      const test = loopOpHarness([loopClip('L1', 10, 'infinity')]);
      await test.controller.openLoopEdit('L1');
      expect(test.controller.infinity.value).toBe(true);
      expect(test.controller.repeatText.value).toBe('1'); // preserved finite draft, never cleared
      test.controller.setInfinity(false);
      expect(test.controller.repeatText.value).toBe('1');
      expect(test.controller.repeatError.value).toBeNull();
    });

    it('derives the Requested/Effective readout from the shared 43-02 derivation — a real-key boundary truncates (Pitfall 4)', async () => {
      const withBoundary = loopAuthority({
        physicalRecords: [
          ...CYCLE_IDS.map((keyId, index) => physicalRecord(keyId, 10 + index, `src-${keyId}`)),
          physicalRecord('K', 18, 'foreign'),
        ],
      });
      const test = loopOpHarness([loopClip('L1', 10, 3)], {}, {
        getLoopEditSnapshot: (placementStart) => ({
          identities: withBoundary.physicalRecords.map(({ keyId, appFrame }) => ({ keyId, appFrame })),
          physicalCapacity: withBoundary.physicalCapacity,
          layerEndExclusive: withBoundary.layerEndExclusive,
          remainingCapacity: withBoundary.physicalCapacity - placementStart,
        }),
      });
      await test.controller.openLoopEdit('L1');
      // Controller-local Phase 42 math would read Effective: 15f; the shared
      // derivation sees the non-owned real key at 18 and truncates.
      expect(test.controller.loopReadout.value).toBe('Requested: 15f (5f × 3) · Effective: 8f — shortened by the next clip');
      test.controller.repeatText.value = '2';
      expect(test.controller.loopReadout.value).toBe('Requested: 10f (5f × 2) · Effective: 8f — shortened by the next clip');
    });

    it('derives the infinity readout from the shared derivation bounded by the parent end', async () => {
      const test = loopOpHarness([loopClip('L1', 10, 'infinity')]);
      await test.controller.openLoopEdit('L1');
      expect(test.controller.loopReadout.value).toBe('Cycle 5f × ∞ · Effective: 30f');
    });

    it('rejects an unknown loopId with a reason and never opens the dialog', async () => {
      const test = loopOpHarness([loopClip('L1', 10, 3)]);
      const result = await test.controller.openLoopEdit('nope');
      expect(result.ok).toBe(false);
      expect(result.reason).toBeTruthy();
      expect(test.controller.confirmationOpen.value).toBe(false);
      expect(test.commit).not.toHaveBeenCalled();
    });

    it('fails immediately when the accepted local physical document is unavailable', async () => {
      const requestAuthority = vi.fn(() => new Promise<never>(() => {}));
      const test = loopOpHarness([loopClip('L1', 10, 3)], {}, {
        getLoopEditSnapshot: () => null,
        requestAuthority,
      });
      const result = await test.controller.openLoopEdit('L1');
      expect(result).toEqual({ ok: false, reason: 'The accepted local Roto physical document is unavailable.' });
      expect(test.controller.confirmationOpen.value).toBe(false);
      expect(requestAuthority).not.toHaveBeenCalled();
    });
  });

  describe('updateLoop (D-10)', () => {
    it('commits ONE atomic loop-only operation — records byte-identical, loop repeat replaced', async () => {
      const test = loopOpHarness([loopClip('L1', 10, 3)]);
      await test.controller.openLoopEdit('L1');
      test.controller.repeatText.value = '5';
      expect(await test.controller.confirm()).toBe(true);
      expect(test.requestAuthority).toHaveBeenCalledTimes(1);
      expect(test.commit).toHaveBeenCalledTimes(1);
      expect(rendered).not.toHaveBeenCalled(); // no regeneration on a referential op
      const publication = test.commit.mock.calls[0][0];
      expect(JSON.stringify(publication.records)).toBe(JSON.stringify(asRealKeyRecords(loopAuthority().physicalRecords)));
      expect(publication.loopClips).toHaveLength(1);
      expect(publication.loopClips?.[0]).toMatchObject({ loopId: 'L1', placementStart: 10, repeat: 5, mode: 'static' });
      expect(publication.semanticDelta).toMatchObject({
        kind: 'play-script',
        loopOnly: true,
        affectedStartAppFrame: 10,
        affectedEndAppFrame: 9,
        freshKeyIds: [],
      });
      expect(test.controller.phase.value).toBe('complete');
      expect(test.controller.confirmationOpen.value).toBe(false);
    });

    it('an unchanged repeat closes without a commit (no phantom history entry)', async () => {
      const test = loopOpHarness([loopClip('L1', 10, 3)]);
      await test.controller.openLoopEdit('L1');
      expect(await test.controller.confirm()).toBe(true);
      expect(test.commit).not.toHaveBeenCalled();
      expect(test.controller.confirmationOpen.value).toBe(false);
    });

    it('proves the full initial → operation → Undo → Redo cycle with source keys byte-identical in every state', async () => {
      const loops = [loopClip('L1', 10, 3)];
      const test = loopOpHarness(loops);
      await test.controller.openLoopEdit('L1');
      test.controller.repeatText.value = '5';
      expect(await test.controller.confirm()).toBe(true);
      const publication = test.commit.mock.calls[0][0];
      const beforeRecords = asRealKeyRecords(loopAuthority().physicalRecords);
      const driver = driveLoopHistory({ beforeRecords, beforeLoopClips: loops, publication });
      expect(driver.availability.value).toEqual({ undo: 1, redo: 0 });
      // Operation state: effective end re-derives to the new requested end 35.
      expect(deriveRange(driver.getCurrent().records, driver.getCurrent().loopClips, 'L1').effectiveEnd).toBe(35);

      expect(await driver.history.undo()).toBe(true);
      expect(JSON.stringify(driver.getCurrent().loopClips)).toBe(JSON.stringify(loops)); // prior repeat restored byte-identically
      expect(JSON.stringify(driver.getCurrent().records)).toBe(JSON.stringify(beforeRecords)); // source keys untouched
      expect(deriveRange(driver.getCurrent().records, driver.getCurrent().loopClips, 'L1').effectiveEnd).toBe(25);

      expect(await driver.history.redo()).toBe(true);
      expect(driver.getCurrent().loopClips[0].repeat).toBe(5);
      expect(JSON.stringify(driver.getCurrent().records)).toBe(JSON.stringify(beforeRecords));
      expect(deriveRange(driver.getCurrent().records, driver.getCurrent().loopClips, 'L1').effectiveEnd).toBe(35);
    });
  });

  describe('unlinkLoop (D-03/D-10)', () => {
    it('removes only the loop record; source keys remain ordinary real keys; Undo restores the record byte-identically', async () => {
      const loops = [loopClip('L1', 10, 3)];
      const test = loopOpHarness(loops);
      const result = await test.controller.unlinkLoop('L1');
      expect(result).toEqual({ ok: true, reason: null });
      expect(test.commit).toHaveBeenCalledTimes(1);
      expect(rendered).not.toHaveBeenCalled();
      const publication = test.commit.mock.calls[0][0];
      expect(publication.loopClips).toEqual([]);
      expect(JSON.stringify(publication.records)).toBe(JSON.stringify(asRealKeyRecords(loopAuthority().physicalRecords)));

      const beforeRecords = asRealKeyRecords(loopAuthority().physicalRecords);
      const driver = driveLoopHistory({ beforeRecords, beforeLoopClips: loops, publication });
      expect(await driver.history.undo()).toBe(true);
      expect(JSON.stringify(driver.getCurrent().loopClips)).toBe(JSON.stringify(loops)); // record restored byte-identically
      expect(JSON.stringify(driver.getCurrent().records)).toBe(JSON.stringify(beforeRecords));
      expect(await driver.history.redo()).toBe(true);
      expect(driver.getCurrent().loopClips).toEqual([]);
      expect(JSON.stringify(driver.getCurrent().records)).toBe(JSON.stringify(beforeRecords));
    });

    it('rejects an unknown loopId and commits nothing', async () => {
      const test = loopOpHarness([loopClip('L1', 10, 3)]);
      const result = await test.controller.unlinkLoop('nope');
      expect(result.ok).toBe(false);
      expect(result.reason).toBeTruthy();
      expect(test.commit).not.toHaveBeenCalled();
    });
  });

  describe('duplicateLinkedLoop (D-05/D-14)', () => {
    it('creates a loop at the destination sharing the source cycle with NO regeneration — one atomic commit', async () => {
      const loops = [loopClip('L1', 10, 3)];
      const test = loopOpHarness(loops);
      const result = await test.controller.duplicateLinkedLoop('L1', 30);
      expect(result).toEqual({ ok: true, reason: null });
      expect(test.commit).toHaveBeenCalledTimes(1);
      expect(rendered).not.toHaveBeenCalled(); // no source regeneration
      const publication = test.commit.mock.calls[0][0];
      expect(publication.loopClips).toHaveLength(2);
      const duplicate = publication.loopClips?.find((entry) => entry.loopId !== 'L1');
      expect(duplicate).toMatchObject({
        placementStart: 30, // placement is the chosen destination, independent of the source location
        sourceKeyIds: [...CYCLE_IDS], // shared by id
        repeat: 3,
        mode: 'static',
        scriptId: 'script-1',
      });
      expect(JSON.stringify(publication.records)).toBe(JSON.stringify(asRealKeyRecords(loopAuthority().physicalRecords)));

      const beforeRecords = asRealKeyRecords(loopAuthority().physicalRecords);
      const driver = driveLoopHistory({ beforeRecords, beforeLoopClips: loops, publication });
      expect(await driver.history.undo()).toBe(true);
      expect(JSON.stringify(driver.getCurrent().loopClips)).toBe(JSON.stringify(loops)); // only the duplicate is removed
      expect(await driver.history.redo()).toBe(true);
      expect(driver.getCurrent().loopClips).toHaveLength(2);
      expect(JSON.stringify(driver.getCurrent().records)).toBe(JSON.stringify(beforeRecords));
    });

    it('rejects a same-start collision compared on placementStart', async () => {
      const test = loopOpHarness([loopClip('L1', 10, 3)]);
      const result = await test.controller.duplicateLinkedLoop('L1', 10);
      expect(result.ok).toBe(false);
      expect(result.reason).toContain('10');
      expect(test.commit).not.toHaveBeenCalled();
    });

    it('rejects a destination inside another loop\'s effective range (D-14 overlap)', async () => {
      // L1 effective range is [10, 25) — a destination at 15 lands inside it.
      const test = loopOpHarness([loopClip('L1', 10, 3)]);
      const result = await test.controller.duplicateLinkedLoop('L1', 15);
      expect(result.ok).toBe(false);
      expect(result.reason).toBeTruthy();
      expect(test.commit).not.toHaveBeenCalled();
      // A destination exactly at the effective end is outside the half-open range — allowed.
      const edge = await test.controller.duplicateLinkedLoop('L1', 25);
      expect(edge.ok).toBe(true);
    });

    it.each([-1, 2.5, Number.NaN])('rejects a malformed destination %s', async (destination) => {
      const test = loopOpHarness([loopClip('L1', 10, 3)]);
      const result = await test.controller.duplicateLinkedLoop('L1', destination);
      expect(result.ok).toBe(false);
      expect(test.commit).not.toHaveBeenCalled();
    });
  });

  describe('repairLoop (D-31)', () => {
    const unresolvedLoop = () => loopClip('LU', 50, 2, ['S1', 'S2', 'MISSING', 'S4', 'S5']);
    // The repair destination [50, 55) needs a layer end beyond it.
    const repairAuthority = { layerEndExclusive: 60, capacity: 40 };

    it('opens the prefilled source-edit repair flow targeting the placement start', async () => {
      const test = loopOpHarness([unresolvedLoop()], repairAuthority);
      const result = await test.controller.repairLoop('LU');
      expect(result).toEqual({ ok: true, reason: null });
      expect(test.controller.dialogMode.value).toBe('source-edit');
      expect(test.controller.confirmationOpen.value).toBe(true);
      expect(test.controller.countText.value).toBe('5'); // cycle length from the sourceKeyIds count
      expect(test.controller.destinationRange.value).toBe('F50–F54'); // placement start as destination
      expect(test.controller.mode.value).toBe('static');
    });

    it('rejects when the destination range overlaps real keys not owned by the loop — the unresolved record stays verbatim', async () => {
      const loop = unresolvedLoop();
      const test = loopOpHarness([loop], {
        ...repairAuthority,
        physicalRecords: [
          ...CYCLE_IDS.map((keyId, index) => physicalRecord(keyId, 10 + index, `src-${keyId}`)),
          physicalRecord('K', 52, 'foreign'), // foreign key inside [50, 55)
        ],
      });
      const result = await test.controller.repairLoop('LU');
      expect(result.ok).toBe(false);
      expect(result.reason).toBeTruthy();
      expect(test.controller.confirmationOpen.value).toBe(false);
      expect(test.commit).not.toHaveBeenCalled();
      expect(rendered).not.toHaveBeenCalled();
    });

    it('rejects when the record carries no source-cycle provenance', async () => {
      const test = loopOpHarness([loopClip('LU', 50, 2, ['S1', 'S2', 'MISSING', 'S4', 'S5'], false)], repairAuthority);
      const result = await test.controller.repairLoop('LU');
      expect(result.ok).toBe(false);
      expect(result.reason).toBeTruthy();
      expect(test.controller.confirmationOpen.value).toBe(false);
    });

    it('confirm regenerates the source at the placement start AND retargets sourceKeyIds in ONE atomic commit — Undo restores the unresolved record byte-identically', async () => {
      const loop = unresolvedLoop();
      const test = loopOpHarness([loop], repairAuthority);
      await test.controller.repairLoop('LU');
      expect(await test.controller.confirm()).toBe(true);
      expect(test.commit).toHaveBeenCalledTimes(1);
      const publication = test.commit.mock.calls[0][0];
      // Regenerated source keys land at the placement start range [50, 55).
      const repaired = publication.records.filter((record) => record.appFrame >= 50 && record.appFrame <= 54);
      expect(repaired).toHaveLength(5);
      const repairedIds = repaired.map((record) => record.keyId);
      const repairedLoop = publication.loopClips?.find((entry) => entry.loopId === 'LU');
      expect(repairedLoop).toMatchObject({ placementStart: 50, repeat: 2 });
      expect([...repairedLoop!.sourceKeyIds]).toEqual(repairedIds); // retargeted in the SAME commit
      expect(repairedLoop!.sourceKeyIds).not.toContain('MISSING');
      // The repaired loop resolves: no dangling references remain.
      expect(deriveRange(publication.records, publication.loopClips ?? [], 'LU', 60).unresolved).toBeNull();

      const beforeRecords = asRealKeyRecords(loopAuthority(repairAuthority).physicalRecords);
      const driver = driveLoopHistory({ beforeRecords, beforeLoopClips: [loop], publication });
      expect(await driver.history.undo()).toBe(true);
      // The unresolved record returns byte-identically — dangling reference verbatim.
      expect(JSON.stringify(driver.getCurrent().loopClips)).toBe(JSON.stringify([loop]));
      expect(driver.getCurrent().loopClips[0].sourceKeyIds).toContain('MISSING');
      expect(deriveRange(driver.getCurrent().records, driver.getCurrent().loopClips, 'LU', 60).unresolved?.missingSourceKeyIds).toEqual(['MISSING']);
      expect(await driver.history.redo()).toBe(true);
      expect(driver.getCurrent().loopClips[0].sourceKeyIds).toEqual(repairedIds);
      expect(deriveRange(driver.getCurrent().records, driver.getCurrent().loopClips, 'LU', 60).unresolved).toBeNull();
    });
  });

  describe('relinkLoop (D-31)', () => {
    it('retargets sourceKeyIds to an existing source cycle in one atomic commit — Undo restores the prior references verbatim', async () => {
      // Unresolved LU dangles; the intact cycle S1..S5 at 10..14 is the relink target.
      const loop = loopClip('LU', 50, 2, ['OLD1', 'OLD2', 'OLD3']);
      const loops = [loopClip('L1', 10, 3), loop];
      const test = loopOpHarness(loops);
      const result = await test.controller.relinkLoop('LU', [...CYCLE_IDS]);
      expect(result).toEqual({ ok: true, reason: null });
      expect(test.commit).toHaveBeenCalledTimes(1);
      expect(rendered).not.toHaveBeenCalled(); // relink never regenerates
      const publication = test.commit.mock.calls[0][0];
      expect(publication.loopClips?.find((entry) => entry.loopId === 'LU')?.sourceKeyIds).toEqual([...CYCLE_IDS]);
      expect(JSON.stringify(publication.records)).toBe(JSON.stringify(asRealKeyRecords(loopAuthority().physicalRecords)));
      // The relinked loop re-derives cycle length (5) and requested duration (10f).
      const range = deriveRange(publication.records, publication.loopClips ?? [], 'LU', 40);
      expect(range.unresolved).toBeNull();
      expect(range.cycleLength).toBe(5);
      expect(range.requestedEnd).toBe(60);

      const beforeRecords = asRealKeyRecords(loopAuthority().physicalRecords);
      const driver = driveLoopHistory({ beforeRecords, beforeLoopClips: loops, publication });
      expect(await driver.history.undo()).toBe(true);
      expect(driver.getCurrent().loopClips.find((entry) => entry.loopId === 'LU')?.sourceKeyIds).toEqual(['OLD1', 'OLD2', 'OLD3']);
      expect(JSON.stringify(driver.getCurrent().records)).toBe(JSON.stringify(beforeRecords));
      expect(await driver.history.redo()).toBe(true);
      expect(driver.getCurrent().loopClips.find((entry) => entry.loopId === 'LU')?.sourceKeyIds).toEqual([...CYCLE_IDS]);
    });

    it('rejects an empty target with a reason and leaves the record verbatim', async () => {
      const test = loopOpHarness([loopClip('LU', 50, 2, ['OLD1'])]);
      const result = await test.controller.relinkLoop('LU', []);
      expect(result.ok).toBe(false);
      expect(result.reason).toBeTruthy();
      expect(test.commit).not.toHaveBeenCalled();
    });

    it('rejects dangling or non-real target keyIds (including keys of another authority)', async () => {
      const test = loopOpHarness([loopClip('LU', 50, 2, ['OLD1'])]);
      const dangling = await test.controller.relinkLoop('LU', ['S1', 'GHOST']);
      expect(dangling.ok).toBe(false);
      expect(dangling.reason).toBeTruthy();
      const malformed = await test.controller.relinkLoop('LU', ['']);
      expect(malformed.ok).toBe(false);
      expect(test.commit).not.toHaveBeenCalled();
    });
  });

  describe('findIdenticalSourceCycle (D-05, Q2)', () => {
    const identities = CYCLE_IDS.map((keyId, index) => ({ keyId, appFrame: 10 + index }));
    const baseInput = {
      scriptId: 'script-1',
      mode: 'static' as const,
      cycleLength: 5,
      motion: { deformation: 0, position: 0 },
      overrideColor: null,
      start: 20,
    };
    const find = (
      test: ReturnType<typeof loopOpHarness>,
      input: Omit<RotoPlayScriptSourceCycleMatchInput, 'loopClips' | 'identities'> = baseInput,
      loopClips: readonly PhysicPaintRotoLoopClip[] = [loopClip('L1', 10, 3)],
    ) =>
      test.controller.findIdenticalSourceCycle({ ...input, loopClips, identities });

    it('matches on (scriptId, mode, cycleLength, motion, overrideColor) and reports the linked loop count', () => {
      const test = loopOpHarness([]);
      const loops = [loopClip('L1', 10, 3), loopClip('L2', 30, 2)]; // L2 shares L1's source cycle
      const match = find(test, baseInput, loops);
      expect(match).toMatchObject({ sourceKeyIds: [...CYCLE_IDS], loopCount: 2, sourceStart: 10 });
    });

    it.each([
      ['scriptId', { scriptId: 'script-2' }],
      ['mode', { mode: 'progressive' as const }],
      ['cycleLength', { cycleLength: 4 }],
      ['motion', { motion: { deformation: 5, position: 0 } }],
      ['overrideColor', { overrideColor: '#a1b2c3' }],
    ])('returns null when %s differs', (_field, override) => {
      const test = loopOpHarness([]);
      expect(find(test, { ...baseInput, ...override })).toBeNull();
    });

    it('includes the source start when Motion is nonzero — a cycle at a different start does NOT match', () => {
      const test = loopOpHarness([]);
      const loops = [loopClip('L1', 10, 3)];
      Object.assign(loops[0], { motion: { deformation: 5, position: 0 } });
      const moving = { ...baseInput, motion: { deformation: 5, position: 0 } };
      // Same script+options but a different start: held poses would differ (Pitfall 6).
      expect(find(test, moving, loops)).toBeNull();
      expect(find(test, { ...moving, start: 10 }, loops)).not.toBeNull();
    });

    it('excludes the start when Motion is 0/0 — the held-pose transform is identity', () => {
      const test = loopOpHarness([]);
      expect(find(test, { ...baseInput, start: 33 }, [loopClip('L1', 10, 3)])).not.toBeNull();
    });

    it('never offers a link to an unresolved source cycle', () => {
      const test = loopOpHarness([]);
      const dangling = loopClip('LU', 10, 3, ['S1', 'S2', 'GHOST', 'S4', 'S5']);
      expect(find(test, baseInput, [dangling])).toBeNull();
    });
  });

  describe('apply-time loop persistence + S4 Link/Create (D-05/D-09)', () => {
    const applyHarness = (loopClips: readonly PhysicPaintRotoLoopClip[]) => {
      const test = loopOpHarness(loopClips);
      test.setSelection({ kind: 'empty', keyId: null, appFrame: 20 });
      return test;
    };

    it('persists one Loop Clip record with the committed cycle keyIds when repeat > 1 — generation plus loop creation is ONE commit', async () => {
      const test = applyHarness([]);
      await test.controller.openConfirmation();
      test.controller.mode.value = 'static';
      test.controller.countText.value = '5';
      test.controller.repeatText.value = '3';
      expect(await test.controller.confirm()).toBe(true);
      expect(test.commit).toHaveBeenCalledTimes(1);
      const publication = test.commit.mock.calls[0][0];
      const cycleIds = publication.records
        .filter((record) => record.appFrame >= 20 && record.appFrame <= 24)
        .map((record) => record.keyId);
      expect(cycleIds).toHaveLength(5);
      expect(publication.loopClips).toHaveLength(1);
      expect(publication.loopClips?.[0]).toMatchObject({
        placementStart: 20,
        sourceKeyIds: cycleIds,
        repeat: 3,
        mode: 'static',
        scriptId: 'script-1',
        motion: { deformation: 25, position: 40 },
        overrideColor: null,
      });

      // One history command: Undo removes the generated keys AND the loop together.
      const driver = driveLoopHistory({ beforeRecords: asRealKeyRecords(loopAuthority().physicalRecords), beforeLoopClips: [], publication });
      expect(driver.availability.value).toEqual({ undo: 1, redo: 0 });
      expect(await driver.history.undo()).toBe(true);
      expect(driver.getCurrent().loopClips).toEqual([]);
      expect(driver.getCurrent().records).toHaveLength(5); // only the pre-existing source cycle
      expect(await driver.history.redo()).toBe(true);
      expect(driver.getCurrent().loopClips).toHaveLength(1);
      expect(driver.getCurrent().records).toHaveLength(10);
    });

    it('persists an infinity loop with the explicit infinity state', async () => {
      const test = applyHarness([]);
      await test.controller.openConfirmation();
      test.controller.mode.value = 'static';
      test.controller.countText.value = '5';
      test.controller.setInfinity(true);
      expect(await test.controller.confirm()).toBe(true);
      const publication = test.commit.mock.calls[0][0];
      expect(publication.loopClips?.[0]).toMatchObject({ placementStart: 20, repeat: 'infinity' });
    });

    it('a single-cycle apply (repeat 1, no infinity) carries NO loopClips member', async () => {
      const test = applyHarness([]);
      await test.controller.openConfirmation();
      test.controller.countText.value = '5';
      test.controller.repeatText.value = '1';
      expect(await test.controller.confirm()).toBe(true);
      const publication = test.commit.mock.calls[0][0];
      expect(publication.loopClips).toBeUndefined();
    });

    it('reports an identical source cycle only when loop intent is active (S4 visibility)', async () => {
      const test = applyHarness([loopClip('L1', 10, 3)]);
      await test.controller.openConfirmation();
      test.controller.mode.value = 'static';
      test.controller.countText.value = '5';
      test.controller.dialogMotion.value = { deformation: 0, position: 0 }; // match the cycle provenance
      test.controller.repeatText.value = '1';
      expect(test.controller.identicalSourceCycle.value).toBeNull(); // no loop intent → S4 hidden
      test.controller.repeatText.value = '2';
      expect(test.controller.identicalSourceCycle.value).toMatchObject({
        sourceKeyIds: [...CYCLE_IDS],
        loopCount: 1,
        sourceStart: 10,
      });
    });

    it('Link to existing cycle: ONE loop-only commit, NO render, the new loop shares the existing sourceKeyIds', async () => {
      const test = applyHarness([loopClip('L1', 10, 3)]);
      await test.controller.openConfirmation();
      test.controller.mode.value = 'static';
      test.controller.countText.value = '5';
      test.controller.dialogMotion.value = { deformation: 0, position: 0 };
      test.controller.repeatText.value = '2';
      expect(test.controller.identicalSourceCycle.value).not.toBeNull();
      test.controller.linkChoice.value = 'link';
      expect(await test.controller.confirm()).toBe(true);
      expect(rendered).not.toHaveBeenCalled();
      expect(test.commit).toHaveBeenCalledTimes(1);
      const publication = test.commit.mock.calls[0][0];
      expect(publication.semanticDelta).toMatchObject({ loopOnly: true, freshKeyIds: [] });
      expect(JSON.stringify(publication.records)).toBe(JSON.stringify(asRealKeyRecords(loopAuthority().physicalRecords)));
      const linked = publication.loopClips?.find((entry) => entry.loopId !== 'L1');
      expect(linked).toMatchObject({ placementStart: 20, sourceKeyIds: [...CYCLE_IDS], repeat: 2, mode: 'static' });
    });

    it('Create new cycle: generation proceeds and the new loop references the NEW committed keyIds', async () => {
      const test = applyHarness([loopClip('L1', 10, 3)]);
      await test.controller.openConfirmation();
      test.controller.mode.value = 'static';
      test.controller.countText.value = '5';
      test.controller.dialogMotion.value = { deformation: 0, position: 0 };
      test.controller.repeatText.value = '2';
      test.controller.linkChoice.value = 'create';
      expect(await test.controller.confirm()).toBe(true);
      expect(rendered).toHaveBeenCalled();
      const publication = test.commit.mock.calls[0][0];
      const created = publication.loopClips?.find((entry) => entry.loopId !== 'L1');
      const cycleIds = publication.records
        .filter((record) => record.appFrame >= 20 && record.appFrame <= 24)
        .map((record) => record.keyId);
      expect(created?.sourceKeyIds).toEqual(cycleIds);
      expect(created?.sourceKeyIds).not.toEqual([...CYCLE_IDS]);
    });

    it('rejects the commit when the parent acknowledgement echoes mismatched loopClips', async () => {
      const test = loopOpHarness([loopClip('L1', 10, 3)], {}, {
        commit: vi.fn(async (publication: RotoPlayScriptPhysicalPublication): Promise<RotoPlayScriptCommitResult> => ({
          ok: true,
          operationId: 'accepted-operation',
          acceptedRevision: 'revision-2',
          records: publication.records,
          interpolationMode: publication.interpolationMode,
          selectedKeyId: publication.selectedKeyId,
          selectedAppFrame: publication.selectedAppFrame,
          loopClips: [], // mismatched echo
        })),
      });
      await test.controller.openLoopEdit('L1');
      test.controller.repeatText.value = '5';
      expect(await test.controller.confirm()).toBe(false);
      expect(test.controller.phase.value).toBe('failed');
    });
  });

  describe('Repeat validation in loop-edit (S2)', () => {
    it.each(['0', '-1', '2.5', 'abc', ''])('keeps Update loop disabled for malformed repeat %j', async (value) => {
      const test = loopOpHarness([loopClip('L1', 10, 3)]);
      await test.controller.openLoopEdit('L1');
      test.controller.repeatText.value = value;
      expect(test.controller.repeatError.value).toBe('Enter a positive integer.');
      expect(await test.controller.confirm()).toBe(false);
      expect(test.commit).not.toHaveBeenCalled();
    });

    it('rejects an unsafe cycle × repeat product against the fixed cycle length', async () => {
      const test = loopOpHarness([loopClip('L1', 10, 3)]);
      await test.controller.openLoopEdit('L1');
      // A safe integer beyond floor(MAX_SAFE_INTEGER / 5) trips the product bound.
      test.controller.repeatText.value = '1801439850948199';
      expect(test.controller.repeatError.value).toBe('Repeat is too large for this cycle length.');
      expect(test.controller.loopReadout.value).toBeNull(); // never NaN, never an overflow product
      expect(await test.controller.confirm()).toBe(false);
    });

    it('Infinity toggling preserves and restores the last valid finite value; an invalid draft never overwrites it', async () => {
      const test = loopOpHarness([loopClip('L1', 10, 3)]);
      await test.controller.openLoopEdit('L1');
      test.controller.repeatText.value = '4';
      test.controller.setInfinity(true);
      expect(test.controller.infinity.value).toBe(true);
      test.controller.repeatText.value = 'junk'; // disabled draft edits never overwrite the preserved value
      test.controller.setInfinity(false);
      expect(test.controller.repeatText.value).toBe('4');
      expect(test.controller.repeatError.value).toBeNull();
    });
  });

  describe('openSourceEdit (D-02)', () => {
    it('opens the source-edit mode prefilled from the source cycle provenance with the affected-loop count', async () => {
      const loops = [loopClip('L1', 10, 3), loopClip('L2', 30, 2)]; // two loops share the cycle
      const test = loopOpHarness(loops);
      const result = await test.controller.openSourceEdit('L1');
      expect(result).toEqual({ ok: true, reason: null });
      expect(test.controller.dialogMode.value).toBe('source-edit');
      expect(test.controller.confirmationOpen.value).toBe(true);
      expect(test.controller.mode.value).toBe('static');
      expect(test.controller.countText.value).toBe('5'); // Frames per cycle from the source cycle
      expect(test.controller.destinationRange.value).toBe('F10–F14');
      expect(test.controller.dialogMotion.value).toEqual({ deformation: 0, position: 0 }); // from provenance, not the defaults port
      expect(test.controller.overrideEnabled.value).toBe(false); // overrideColor null
      expect(test.controller.sourceEditSharedLoopCount.value).toBe(2);
      expect(test.controller.repeatText.value).toBe('3'); // the target loop's own repeat, preserved
    });

    it('rejects an unresolved loop — repair is the recovery flow (D-31)', async () => {
      const test = loopOpHarness([loopClip('LU', 50, 2, ['S1', 'S2', 'GHOST', 'S4', 'S5'])]);
      const result = await test.controller.openSourceEdit('LU');
      expect(result.ok).toBe(false);
      expect(result.reason).toBeTruthy();
      expect(test.controller.confirmationOpen.value).toBe(false);
    });

    it('regenerates via the existing staged commit and retargets EVERY linked loop when the cycle length changes', async () => {
      const loops = [loopClip('L1', 10, 3), loopClip('L2', 30, 2)];
      const test = loopOpHarness(loops);
      await test.controller.openSourceEdit('L1');
      test.controller.countText.value = '3'; // shrink the cycle 5 → 3
      expect(await test.controller.confirm()).toBe(true);
      expect(test.commit).toHaveBeenCalledTimes(1);
      expect(rendered).toHaveBeenCalledWith(expect.objectContaining({ frameCount: 3, canonicalStart: 10 }));
      const publication = test.commit.mock.calls[0][0];
      const newCycleIds = publication.records
        .filter((record) => record.appFrame >= 10 && record.appFrame <= 12)
        .map((record) => record.keyId);
      expect(newCycleIds).toEqual(['S1', 'S2', 'S3']); // occupied destinations keep their identities
      for (const loopId of ['L1', 'L2']) {
        const updated = publication.loopClips?.find((entry) => entry.loopId === loopId);
        expect(updated?.sourceKeyIds).toEqual(newCycleIds); // every linked loop retargeted
      }
      // S4/S5 at 13/14 survive as ordinary real keys.
      expect(publication.records.map((record) => record.keyId)).toEqual(['S1', 'S2', 'S3', 'S4', 'S5']);
      // Derived state recomputes from the committed collection: cycle 3, resolved.
      expect(deriveRange(publication.records, publication.loopClips ?? [], 'L2', 40).cycleLength).toBe(3);
      expect(deriveRange(publication.records, publication.loopClips ?? [], 'L2', 40).unresolved).toBeNull();
    });

    it('regeneration is one history command — Undo restores keys AND loop references, Redo re-applies', async () => {
      const loops = [loopClip('L1', 10, 3)];
      const test = loopOpHarness(loops);
      await test.controller.openSourceEdit('L1');
      test.controller.countText.value = '3';
      expect(await test.controller.confirm()).toBe(true);
      const publication = test.commit.mock.calls[0][0];
      const driver = driveLoopHistory({ beforeRecords: asRealKeyRecords(loopAuthority().physicalRecords), beforeLoopClips: loops, publication });
      expect(driver.availability.value).toEqual({ undo: 1, redo: 0 });
      expect(await driver.history.undo()).toBe(true);
      expect(JSON.stringify(driver.getCurrent().loopClips)).toBe(JSON.stringify(loops));
      expect(JSON.stringify(driver.getCurrent().records)).toBe(JSON.stringify(asRealKeyRecords(loopAuthority().physicalRecords)));
      expect(await driver.history.redo()).toBe(true);
      expect(driver.getCurrent().loopClips[0].sourceKeyIds).toEqual(['S1', 'S2', 'S3']);
    });
  });
});
