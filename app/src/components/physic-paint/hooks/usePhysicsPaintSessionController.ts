import { useRef } from 'preact/hooks';
import type { Dispatch, StateUpdater } from 'preact/hooks';
import type { EfxPaintEngine } from '@efxlab/efx-physic-paint';
import type { PhysicPaintLaunchContext, PhysicPaintRenderedFrame } from '../../../types/physicPaint';
import { buildPhysicsPaintDebugManifest, buildPhysicsPaintStillExport, type PhysicsPaintDebugManifest, type PhysicsPaintStillExport } from '../engine/physicsPaintDevExport';
import { resizePhysicsPaintState } from '../engine/physicsPaintCanvasSizing';
import { downloadPhysicsPaintState, parsePhysicsPaintStateFile } from '../bridge/physicsPaintSessionFile';
import { getPlayFrameCountFromAssignments, getPlayFrameEditAssignments } from '../play/playFrameTransactions';
import type { PhysicsPaintWorkflowMode } from '../view/physicsPaintWorkflowPresentation';

type EditableState = ReturnType<EfxPaintEngine['save']>;
type ApplyStatus = 'idle' | 'applying' | 'success' | 'error';

export interface PhysicsPaintDebugProof {
  still: PhysicsPaintStillExport;
  manifest: PhysicsPaintDebugManifest;
}

export function makeLoadedPlayLaunchContext(context: PhysicPaintLaunchContext, frameCount: number, previewFrame: number): PhysicPaintLaunchContext {
  const next = { ...context };
  delete next.maxPlayFrameCount;
  delete next.maxPlayFrameCountReason;
  return {
    ...next,
    workflowMode: 'play',
    editableSource: 'play',
    playFrameCount: frameCount,
    playCacheStatus: 'stale',
    cachedPlayFrames: [],
    previewFrame,
  };
}

export function buildPhysicsPaintDebugProof(input: {
  frame: PhysicPaintRenderedFrame;
  layerId: string;
  operationId: string;
  fps: number;
}): PhysicsPaintDebugProof {
  const still = buildPhysicsPaintStillExport(input.frame);
  const manifest = buildPhysicsPaintDebugManifest({
    layerId: input.layerId,
    operationId: input.operationId,
    startFrame: input.frame.appFrame,
    frameCount: 1,
    frames: [input.frame],
    fps: input.fps,
  });
  return { still, manifest };
}

export interface PhysicsPaintSessionControllerInput {
  engine: EfxPaintEngine | null;
  workflowMode: PhysicsPaintWorkflowMode;
  framesToApply: number;
  canvasSize: { width: number; height: number };
  launchContext: PhysicPaintLaunchContext | null;
  currentFrame: number;
  previewFps: number;
  capturePendingPlayFrameEdits: () => void;
  annotatePlayState: (state: EditableState) => EditableState;
  restorePlayFrameEdits: (assignments: Map<number, number>, frame: number, strokeCount: number) => void;
  clearLatestPlayFrames: () => void;
  setCachedPlayPreviewUrl: (url: string | null) => void;
  setSavedPlayCacheDirty: (dirty: boolean) => void;
  setLocalPlayPreviewFrame: (frame: number) => void;
  setFramesToApply: Dispatch<StateUpdater<number>>;
  bumpPlayFramesVersion: () => void;
  setLaunchContext: Dispatch<StateUpdater<PhysicPaintLaunchContext | null>>;
  setApplyStatus: Dispatch<StateUpdater<ApplyStatus>>;
  setApplyMessage: Dispatch<StateUpdater<string | null>>;
  setLastError: Dispatch<StateUpdater<string | null>>;
  isMutationLocked?: () => boolean;
}

export interface PhysicsPaintSessionControllerDependencies {
  downloadState?: typeof downloadPhysicsPaintState;
  createFileReader?: () => FileReader;
}

export function createPhysicsPaintSessionController(
  input: PhysicsPaintSessionControllerInput,
  dependencies: PhysicsPaintSessionControllerDependencies = {},
) {
  const setSuccess = (message: string) => {
    input.setApplyStatus('success');
    input.setApplyMessage(message);
    input.setLastError(null);
  };
  const setFailure = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    input.setApplyStatus('error');
    input.setApplyMessage(message);
    input.setLastError(message);
  };
  const mutationLocked = () => input.isMutationLocked?.() ?? false;

  const saveEditableState = async () => {
    const engine = input.engine;
    if (!engine || mutationLocked()) return;
    try {
      if (input.workflowMode === 'play') input.capturePendingPlayFrameEdits();
      const editableState = input.workflowMode === 'play'
        ? input.annotatePlayState(engine.save())
        : engine.save();
      if (input.workflowMode === 'play') engine.load(editableState);
      const result = await (dependencies.downloadState ?? downloadPhysicsPaintState)(editableState);
      if (result.status === 'cancelled') {
        input.setApplyStatus('idle');
        input.setApplyMessage(result.message);
        input.setLastError(null);
        return;
      }
      setSuccess(result.message);
    } catch (error) {
      setFailure(error);
    }
  };

  const applyLoadedState = (contents: string) => {
    const engine = input.engine;
    if (!engine || mutationLocked()) return;
    try {
      const state = resizePhysicsPaintState(
        parsePhysicsPaintStateFile(contents),
        input.canvasSize.width,
        input.canvasSize.height,
      );
      engine.load(state);
      if (input.workflowMode === 'play') {
        const assignments = getPlayFrameEditAssignments(state);
        const frameCount = getPlayFrameCountFromAssignments(assignments, input.framesToApply);
        const previewFrame = assignments.values().next().value ?? 0;
        input.restorePlayFrameEdits(assignments, previewFrame, state.strokes.length);
        input.clearLatestPlayFrames();
        input.setCachedPlayPreviewUrl(null);
        input.setSavedPlayCacheDirty(true);
        input.setLocalPlayPreviewFrame(previewFrame);
        input.setFramesToApply(frameCount);
        input.bumpPlayFramesVersion();
        input.setLaunchContext((current) => current
          ? makeLoadedPlayLaunchContext(current, frameCount, previewFrame)
          : current);
      }
      setSuccess('Loaded editable JSON state.');
    } catch (error) {
      setFailure(error);
    }
  };

  const loadEditableState = (event: Event) => {
    const inputElement = event.target as HTMLInputElement;
    if (mutationLocked()) {
      inputElement.value = '';
      return;
    }
    const file = inputElement.files?.[0];
    inputElement.value = '';
    if (!input.engine || !file) return;

    const reader = dependencies.createFileReader?.() ?? new FileReader();
    reader.onload = () => {
      if (!mutationLocked()) applyLoadedState(String(reader.result ?? ''));
    };
    reader.onerror = () => setFailure(new Error('Could not read editable JSON state.'));
    reader.readAsText(file);
  };

  const exportDebugProof = () => {
    const engine = input.engine;
    const launchContext = input.launchContext;
    if (!engine || !launchContext) return;
    try {
      const canvas = engine.exportCompositeCanvas();
      const frame: PhysicPaintRenderedFrame = {
        frameIndex: 0,
        appFrame: input.currentFrame,
        dataUrl: canvas.toDataURL('image/png'),
        width: canvas.width,
        height: canvas.height,
      };
      const proof = buildPhysicsPaintDebugProof({
        frame,
        layerId: launchContext.layerId,
        operationId: `${launchContext.operationId}:debug:${Date.now()}`,
        fps: input.previewFps,
      });
      setSuccess(`Debug proof ready: ${proof.still.file} and ${proof.manifest.file}.`);
    } catch (error) {
      setFailure(error);
    }
  };

  return { saveEditableState, loadEditableState, exportDebugProof };
}

export function usePhysicsPaintSessionController(input: PhysicsPaintSessionControllerInput) {
  const inputRef = useRef(input);
  inputRef.current = input;
  const controllerRef = useRef<ReturnType<typeof createPhysicsPaintSessionController> | null>(null);
  controllerRef.current ??= createPhysicsPaintSessionController(new Proxy(input, {
    get: (_target, property) => inputRef.current[property as keyof PhysicsPaintSessionControllerInput],
  }));
  return controllerRef.current;
}
