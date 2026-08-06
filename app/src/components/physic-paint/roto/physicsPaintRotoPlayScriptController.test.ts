import { signal } from '@preact/signals';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PhysicPaintLaunchContext, PhysicPaintRotoAuthorityResult } from '../../../types/physicPaint';
import type { RotoPaintScript } from './physicsPaintRotoScriptClipboard';
import { createRotoPlayScriptController, type RotoPlayScriptCommitResult, type RotoPlayScriptControllerPorts } from './physicsPaintRotoPlayScriptController';

// Preact hook shims for the REAL useRotoPhysicalEditHistory hook driven by the
// HOLD-03 one-history-command case below (same idiom as the hook's own spec).
vi.mock('preact/hooks', () => ({
  useCallback: <Value>(callback: Value) => callback,
  useEffect: (setup: () => void | (() => void)) => setup(),
  useRef: <Value>(value: Value) => ({ current: value }),
}));

import type { PhysicPaintRotoRealKeyRecord } from './physicsPaintRotoPhysicalModel';
import { buildPhysicPaintRotoPhysicalRevision } from './physicsPaintRotoPhysicalModel';
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
