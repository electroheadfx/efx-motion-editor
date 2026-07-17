import { computed, signal, type ReadonlySignal, type Signal } from '@preact/signals';
import type { PhysicPaintApplyResult, PhysicPaintLaunchContext, PhysicPaintRotoAuthorityResult, PhysicPaintRotoCacheFrame } from '../../../types/physicPaint';
import type { RotoScriptLibraryController } from './physicsPaintRotoScriptLibrary';
import type { RotoTimelineSelectionKind } from './rotoTimelineSelectors';
import { renderRotoPlayScriptFrames } from './physicsPaintRotoPlayScriptRenderer';

export type RotoPlayScriptPhase = 'idle' | 'preparing' | 'rendering' | 'committing' | 'regenerating' | 'complete' | 'cancelled' | 'failed';

export interface RotoPlayScriptControllerPorts {
  library: RotoScriptLibraryController;
  getLaunchContext: () => PhysicPaintLaunchContext | null;
  getSelection: () => { kind: RotoTimelineSelectionKind; sourceFrame: number; displayFrame: number };
  getMotion: () => { deformation: number; position: number };
  getOperationLocked: () => boolean;
  getSize: () => { width: number; height: number };
  requestAuthority: (operationId: string, start: number) => Promise<PhysicPaintRotoAuthorityResult>;
  commit: (payload: {
    operationId: string; projectContextId: string; layerId: string; startFrame: number; frameCount: number;
    expectedLayerEndExclusive: number; expectedRotoRevision: string; frames: PhysicPaintRotoCacheFrame[];
    rotoInterpolationSettings: PhysicPaintRotoAuthorityResult['interpolationSettings'];
  }) => Promise<PhysicPaintApplyResult>;
  mirrorAccepted: (frames: PhysicPaintRotoCacheFrame[], firstSourceFrame: number) => void;
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
    if (!ports.library.selected.value) return 'Select a project script first.';
    if (ports.library.busy.value) return 'Finish the current script library operation.';
    if (ports.getOperationLocked() || isBusyPhase(phase.value)) return 'Finish the current Roto operation.';
    const context = ports.getLaunchContext();
    if (!context?.project?.saved) return 'Save the project first.';
    const selection = ports.getSelection();
    if (selection.kind === 'generated-interpolation') return `Generated frame ${selection.displayFrame} is render-only. Select an empty frame or a real Roto key to generate a Play Script.`;
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
      const authority = await ports.requestAuthority(operationId, selected.sourceFrame);
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
    if (disposed || !selectedId || !context?.project || start === null || count === null || disabledReason.peek()) return false;

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
      const existingFrames = new Map(authority.frames.map((frame) => [frame.sourceFrame ?? frame.appFrame, frame]));
      phase.value = 'rendering'; progress.value = { completed: 0, total: count }; status.value = `Rendering 0 / ${count}`;
      const staged = await renderRotoPlayScriptFrames({
        script: snapshot, frameCount: count, canonicalStart: start, motion, existingFrames, size: ports.getSize(), signal: abortController.signal,
        onProgress: (completed, total) => { if (generation === acceptedGeneration) { progress.value = { completed, total }; status.value = `Rendering ${completed} / ${total}`; } },
      });
      assertCurrent(acceptedGeneration);
      const commitAuthority = await ports.requestAuthority(nextOperationId('commit-check'), start);
      assertCurrent(acceptedGeneration);
      if (!commitAuthority.ok || commitAuthority.capacity < count || commitAuthority.rotoRevision !== authority.rotoRevision || commitAuthority.layerEndExclusive !== authority.layerEndExclusive) throw new Error('Roto authority changed before commit.');
      const currentSelection = ports.getSelection();
      if (ports.library.selectedId.peek() !== selectedId || currentSelection.kind === 'generated-interpolation' || currentSelection.sourceFrame !== start) throw new Error('Play Script start or selected preset changed before commit.');
      const completeFrames = mergeCompleteRealKeys(commitAuthority.frames, staged);
      phase.value = 'committing'; status.value = 'Committing Play Script…'; abortController = null;
      const operationId = nextOperationId('commit');
      const result = await ports.commit({
        operationId, projectContextId: context.project.contextId, layerId: context.layerId, startFrame: start, frameCount: count,
        expectedLayerEndExclusive: commitAuthority.layerEndExclusive, expectedRotoRevision: commitAuthority.rotoRevision,
        frames: completeFrames, rotoInterpolationSettings: commitAuthority.interpolationSettings,
      });
      assertCurrent(acceptedGeneration);
      if (!result.ok || result.operationId !== operationId) throw new Error(result.error ?? 'Parent rejected the Play Script batch.');
      phase.value = 'regenerating'; status.value = 'Regenerating interpolation…';
      ports.mirrorAccepted(completeFrames, start);
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

function mergeCompleteRealKeys(existing: readonly PhysicPaintRotoCacheFrame[], staged: readonly (PhysicPaintRotoCacheFrame & { sourceFrame: number })[]): PhysicPaintRotoCacheFrame[] {
  const frames = new Map(existing.filter((frame) => frame.source === 'real-key').map((frame) => [frame.sourceFrame ?? frame.appFrame, frame]));
  for (const frame of staged) frames.set(frame.sourceFrame, { ...frame, appFrame: frame.sourceFrame, source: 'real-key' });
  return [...frames.values()].sort((a, b) => (a.sourceFrame ?? a.appFrame) - (b.sourceFrame ?? b.appFrame));
}
function isBusyPhase(phase: RotoPlayScriptPhase): boolean { return phase === 'preparing' || phase === 'rendering' || phase === 'committing' || phase === 'regenerating'; }
function isAbort(error: unknown): boolean { return error instanceof DOMException && error.name === 'AbortError'; }
