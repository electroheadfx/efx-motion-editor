import { computed, signal, type ReadonlySignal, type Signal } from '@preact/signals';
import type {
  PhysicPaintLaunchContext,
  PhysicPaintRotoAuthorityResult,
  PhysicPaintRotoCacheFrame,
  PhysicPaintRotoPhysicalEditRecord,
  PhysicPaintRotoPhysicalEditSemanticDelta,
} from '../../../types/physicPaint';
import type { RotoScriptLibraryController } from './physicsPaintRotoScriptLibrary';
import {
  createPhysicPaintRotoKeyId,
  type PhysicPaintRotoRealKeyRecord,
} from './physicsPaintRotoPhysicalModel';
import type { RotoTimelineSelectionKind } from './rotoTimelineSelectors';
import { renderRotoPlayScriptFrames } from './physicsPaintRotoPlayScriptRenderer';
import { isRotoPngDataUrl } from './rotoCanvasFrames';

export type RotoPlayScriptPhase = 'idle' | 'preparing' | 'rendering' | 'committing' | 'regenerating' | 'complete' | 'cancelled' | 'failed';

export type RotoPlayScriptSemanticDelta = Extract<
  PhysicPaintRotoPhysicalEditSemanticDelta,
  { readonly kind: 'play-script' }
>;

export interface RotoPlayScriptPhysicalPublication {
  readonly expectedLaunch: { readonly operationId: string; readonly layerId: string };
  readonly expectedRevision: string;
  readonly records: readonly PhysicPaintRotoRealKeyRecord[];
  readonly interpolationEnabled: boolean;
  readonly semanticDelta: RotoPlayScriptSemanticDelta;
  readonly selectedKeyId: string;
  readonly selectedAppFrame: number;
}

export type RotoPlayScriptCommitResult =
  | {
      readonly ok: true;
      readonly operationId: string;
      readonly acceptedRevision: string;
      readonly records: readonly PhysicPaintRotoRealKeyRecord[];
      readonly selectedKeyId: string;
      readonly selectedAppFrame: number;
    }
  | { readonly ok: false; readonly error: string };

export interface RotoPlayScriptControllerPorts {
  library: RotoScriptLibraryController;
  getLaunchContext: () => PhysicPaintLaunchContext | null;
  getSelection: () => { kind: RotoTimelineSelectionKind; keyId: string | null; appFrame: number };
  getMotion: () => { deformation: number; position: number };
  getOperationLocked: () => boolean;
  getSize: () => { width: number; height: number };
  availabilityRevision?: ReadonlySignal<number>;
  requestAuthority: (operationId: string, start: number) => Promise<PhysicPaintRotoAuthorityResult>;
  commit: (publication: RotoPlayScriptPhysicalPublication) => Promise<RotoPlayScriptCommitResult>;
  stopPlayback: () => void;
  log: (message: string, error?: boolean) => void;
}

export interface RotoPlayScriptController {
  confirmationOpen: Signal<boolean>;
  countText: Signal<string>;
  capacity: Signal<number>;
  destinationRange: ReadonlySignal<string | null>;
  validationError: ReadonlySignal<string | null>;
  disabledReason: ReadonlySignal<string | null>;
  phase: Signal<RotoPlayScriptPhase>;
  progress: Signal<{ completed: number; total: number } | null>;
  status: Signal<string | null>;
  error: Signal<string | null>;
  canCancel: ReadonlySignal<boolean>;
  openConfirmation: () => Promise<void>;
  closeConfirmation: () => void;
  confirm: () => Promise<boolean>;
  cancel: () => void;
  dispose: () => void;
}

export function createRotoPlayScriptController(ports: RotoPlayScriptControllerPorts): RotoPlayScriptController {
  const confirmationOpen = signal(false);
  const countText = signal('Max');
  const capacity = signal(0);
  const canonicalStart = signal<number | null>(null);
  const phase = signal<RotoPlayScriptPhase>('idle');
  const progress = signal<{ completed: number; total: number } | null>(null);
  const status = signal<string | null>(null);
  const error = signal<string | null>(null);
  let generation = 0;
  let abortController: AbortController | null = null;
  let disposed = false;

  const disabledReason = computed(() => {
    ports.availabilityRevision?.value;
    if (!ports.library.selected.value) return 'Select a project script first.';
    if (ports.library.busy.value) return 'Finish the current script library operation.';
    if (ports.getOperationLocked() || isBusyPhase(phase.value)) return 'Finish the current Roto operation.';
    const context = ports.getLaunchContext();
    if (!context?.project?.saved) return 'Save the project first.';
    const selection = ports.getSelection();
    if (selection.kind === 'generated-interpolation') return `Generated frame ${selection.appFrame} is render-only. Select an empty frame or a real Roto key to generate a Play Script.`;
    return null;
  });
  const parsedCount = computed(() => parseCount(countText.value, capacity.value));
  const validationError = computed(() => parsedCount.value.error);
  const destinationRange = computed(() => {
    const start = canonicalStart.value;
    const count = parsedCount.value.count;
    return start === null || count === null ? null : `F${start}–F${start + count - 1}`;
  });
  const canCancel = computed(() => phase.value === 'preparing' || phase.value === 'rendering');

  async function openConfirmation(): Promise<void> {
    if (disposed || disabledReason.peek()) return;
    ports.stopPlayback();
    const selected = ports.getSelection();
    const operationId = nextOperationId('authority');
    phase.value = 'preparing'; status.value = 'Preparing Play Script…'; error.value = null;
    try {
      const authority = await ports.requestAuthority(operationId, selected.appFrame);
      if (!authority.ok) throw new Error(authority.error ?? 'Parent authority is unavailable.');
      canonicalStart.value = authority.canonicalStart;
      capacity.value = authority.capacity;
      countText.value = 'Max';
      confirmationOpen.value = true;
      phase.value = 'idle'; status.value = `Max ${authority.capacity} · F${authority.canonicalStart}–F${authority.layerEndExclusive - 1}`;
    } catch (cause) { fail(cause); }
  }

  async function confirm(): Promise<boolean> {
    const selectedId = ports.library.selectedId.peek();
    const context = ports.getLaunchContext();
    const start = canonicalStart.peek();
    const count = parsedCount.peek().count;
    const startingSelection = ports.getSelection();
    if (disposed || !selectedId || !context?.project || start === null || count === null || disabledReason.peek() || startingSelection.appFrame !== start) return false;

    const acceptedGeneration = ++generation;
    abortController = new AbortController();
    ports.stopPlayback();
    phase.value = 'preparing'; progress.value = null; status.value = 'Preparing Play Script…'; error.value = null;
    try {
      const authority = await ports.requestAuthority(nextOperationId('confirm'), start);
      assertCurrent(acceptedGeneration);
      if (!authority.ok || count > authority.capacity) throw new Error(authority.error ?? 'Requested frame count exceeds current capacity.');
      const snapshot = await ports.library.loadSnapshot(selectedId);
      assertCurrent(acceptedGeneration);
      if (!snapshot || ports.library.selectedId.peek() !== selectedId) throw new Error('Selected script changed or could not be reloaded.');
      const motion = { ...ports.getMotion() };
      const existingFrames = new Map(authority.frames.map((frame) => [frame.appFrame, frame]));
      phase.value = 'rendering'; progress.value = { completed: 0, total: count }; status.value = `Rendering 0 / ${count}`;
      const staged = await renderRotoPlayScriptFrames({
        script: snapshot, frameCount: count, canonicalStart: start, motion, existingFrames, size: ports.getSize(), signal: abortController.signal,
        onProgress: (completed, total) => { if (generation === acceptedGeneration) { progress.value = { completed, total }; status.value = `Rendering ${completed} / ${total}`; } },
      });
      assertCurrent(acceptedGeneration);
      const commitAuthority = await ports.requestAuthority(nextOperationId('commit-check'), start);
      assertCurrent(acceptedGeneration);
      if (!commitAuthority.ok
        || commitAuthority.capacity < count
        || commitAuthority.physicalRevision !== authority.physicalRevision
        || commitAuthority.physicalCapacity !== authority.physicalCapacity
        || commitAuthority.layerEndExclusive !== authority.layerEndExclusive) throw new Error('Roto authority changed before commit.');
      const currentSelection = ports.getSelection();
      if (
        ports.library.selectedId.peek() !== selectedId
        || currentSelection.kind === 'generated-interpolation'
        || currentSelection.appFrame !== start
        || currentSelection.keyId !== startingSelection.keyId
      ) throw new Error('Play Script start, physical key identity, or selected preset changed before commit.');
      const publication = buildPhysicalPublication({
        authority: commitAuthority,
        staged,
        start,
        count,
        expectedLaunch: { operationId: context.operationId, layerId: context.layerId },
      });
      phase.value = 'committing'; status.value = 'Committing Play Script…'; abortController = null;
      const result = await ports.commit(publication);
      assertCurrent(acceptedGeneration);
      if (!result.ok) throw new Error(result.error || 'Parent rejected the Play Script batch.');
      if (result.selectedKeyId !== publication.selectedKeyId
        || result.selectedAppFrame !== publication.selectedAppFrame
        || !samePhysicalRecords(result.records, publication.records)) throw new Error('Parent returned a mismatched Play Script acknowledgement.');
      phase.value = 'regenerating'; status.value = 'Regenerating interpolation…';
      ports.stopPlayback();
      phase.value = 'complete'; progress.value = { completed: count, total: count }; status.value = `Play Script complete · ${count} frames`;
      confirmationOpen.value = false; ports.log(status.value); return true;
    } catch (cause) {
      if (isAbort(cause)) { phase.value = 'cancelled'; status.value = 'Play Script cancelled'; error.value = null; ports.log(status.value); }
      else fail(cause);
      return false;
    } finally { if (generation === acceptedGeneration) abortController = null; }
  }

  function closeConfirmation(): void { if (!isBusyPhase(phase.peek())) confirmationOpen.value = false; }
  function cancel(): void { if (canCancel.peek()) { generation += 1; abortController?.abort(); abortController = null; } else closeConfirmation(); }
  function fail(cause: unknown): void { const message = cause instanceof Error ? cause.message : String(cause); phase.value = 'failed'; status.value = 'Play Script failed'; error.value = message; ports.log(message, true); }
  function assertCurrent(expected: number): void { if (disposed || generation !== expected) throw new DOMException('Play Script generation cancelled.', 'AbortError'); }
  function nextOperationId(kind: string): string { return `roto-play-script-${kind}-${Date.now()}-${crypto.randomUUID()}`; }

  return { confirmationOpen, countText, capacity, destinationRange, validationError, disabledReason, phase, progress, status, error, canCancel, openConfirmation, closeConfirmation, confirm, cancel, dispose: () => { disposed = true; generation += 1; abortController?.abort(); abortController = null; } };
}

function parseCount(value: string, capacity: number): { count: number | null; error: string | null } {
  const text = value.trim();
  if (!text) return { count: null, error: 'Enter a positive integer or Max.' };
  if (/^max$/i.test(text)) return capacity > 0 ? { count: capacity, error: null } : { count: null, error: 'No real-key capacity remains.' };
  if (!/^\d+$/.test(text)) return { count: null, error: 'Enter a positive integer or Max.' };
  const count = Number(text);
  if (!Number.isSafeInteger(count) || count <= 0) return { count: null, error: 'Enter a positive integer or Max.' };
  if (count > capacity) return { count: null, error: `Maximum available count is ${capacity}.` };
  return { count, error: null };
}

function buildPhysicalPublication(input: {
  readonly authority: PhysicPaintRotoAuthorityResult;
  readonly staged: readonly PhysicPaintRotoCacheFrame[];
  readonly start: number;
  readonly count: number;
  readonly expectedLaunch: RotoPlayScriptPhysicalPublication['expectedLaunch'];
}): RotoPlayScriptPhysicalPublication {
  const { authority, staged, start, count, expectedLaunch } = input;
  const affectedEndAppFrame = start + count - 1;
  if (count <= 0
    || affectedEndAppFrame >= authority.layerEndExclusive
    || affectedEndAppFrame >= authority.physicalCapacity
    || staged.length !== count) throw new Error('Rendered Play Script range does not match current physical capacity.');

  const currentByFrame = new Map<number, PhysicPaintRotoRealKeyRecord>();
  const currentKeyIds = new Set<string>();
  for (const record of authority.physicalRecords) {
    if (currentByFrame.has(record.appFrame) || currentKeyIds.has(record.keyId)) throw new Error('Parent authority returned duplicate physical Roto identity.');
    currentKeyIds.add(record.keyId);
    currentByFrame.set(record.appFrame, {
      kind: 'real-key',
      keyId: record.keyId,
      appFrame: record.appFrame,
      payload: clonePhysicalPayload(record.payload),
    });
  }

  const stagedByFrame = new Map<number, PhysicPaintRotoCacheFrame>();
  for (const frame of staged) {
    if (!Number.isInteger(frame.appFrame)
      || frame.appFrame < start
      || frame.appFrame > affectedEndAppFrame
      || stagedByFrame.has(frame.appFrame)
      || !isRotoPngDataUrl(frame.dataUrl)) throw new Error('Rendered Play Script output is incomplete or is not a valid PNG.');
    stagedByFrame.set(frame.appFrame, frame);
  }

  const freshKeyIds: string[] = [];
  for (let appFrame = start; appFrame <= affectedEndAppFrame; appFrame += 1) {
    const frame = stagedByFrame.get(appFrame);
    if (!frame) throw new Error(`Rendered Play Script output is missing frame ${appFrame}.`);
    const existing = currentByFrame.get(appFrame);
    const keyId = existing?.keyId ?? createPhysicPaintRotoKeyId();
    if (!existing) {
      if (currentKeyIds.has(keyId)) throw new Error('Fresh Play Script identity collides with an existing physical key.');
      currentKeyIds.add(keyId);
      freshKeyIds.push(keyId);
    }
    currentByFrame.set(appFrame, {
      kind: 'real-key',
      keyId,
      appFrame,
      payload: {
        frameIndex: frame.frameIndex,
        appFrame,
        dataUrl: frame.dataUrl,
        ...(frame.width !== undefined ? { width: frame.width } : {}),
        ...(frame.height !== undefined ? { height: frame.height } : {}),
      },
    });
  }

  const records = [...currentByFrame.values()].sort((left, right) => left.appFrame - right.appFrame);
  const selected = currentByFrame.get(start);
  if (!selected) throw new Error('Play Script start destination is missing from the physical proposal.');
  const proposedRecords = records.map(toPhysicalEditRecord);
  return {
    expectedLaunch,
    expectedRevision: authority.physicalRevision,
    records,
    interpolationEnabled: authority.interpolationEnabled,
    semanticDelta: {
      kind: 'play-script',
      affectedStartAppFrame: start,
      affectedEndAppFrame,
      expectedLayerCapacity: authority.physicalCapacity,
      expectedLayerEndExclusive: authority.layerEndExclusive,
      proposedRecords,
      freshKeyIds,
    },
    selectedKeyId: selected.keyId,
    selectedAppFrame: start,
  };
}

function clonePhysicalPayload(payload: PhysicPaintRotoPhysicalEditRecord['payload']): PhysicPaintRotoPhysicalEditRecord['payload'] {
  return {
    frameIndex: payload.frameIndex,
    appFrame: payload.appFrame,
    dataUrl: payload.dataUrl,
    ...(payload.width !== undefined ? { width: payload.width } : {}),
    ...(payload.height !== undefined ? { height: payload.height } : {}),
  };
}

function toPhysicalEditRecord(record: PhysicPaintRotoRealKeyRecord): PhysicPaintRotoPhysicalEditRecord {
  return {
    keyId: record.keyId,
    appFrame: record.appFrame,
    payload: clonePhysicalPayload(record.payload),
  };
}

function samePhysicalRecords(
  left: readonly PhysicPaintRotoRealKeyRecord[],
  right: readonly PhysicPaintRotoRealKeyRecord[],
): boolean {
  return left.length === right.length && left.every((record, index) => {
    const candidate = right[index];
    return candidate !== undefined
      && record.keyId === candidate.keyId
      && record.appFrame === candidate.appFrame
      && record.payload.frameIndex === candidate.payload.frameIndex
      && record.payload.appFrame === candidate.payload.appFrame
      && record.payload.dataUrl === candidate.payload.dataUrl
      && record.payload.width === candidate.payload.width
      && record.payload.height === candidate.payload.height;
  });
}

function isBusyPhase(phase: RotoPlayScriptPhase): boolean { return phase === 'preparing' || phase === 'rendering' || phase === 'committing' || phase === 'regenerating'; }
function isAbort(error: unknown): boolean { return error instanceof DOMException && error.name === 'AbortError'; }
