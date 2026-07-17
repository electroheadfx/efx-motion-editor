import { useRef } from 'preact/hooks';
import type { Dispatch, StateUpdater } from 'preact/hooks';
import type { EfxPaintEngine } from '@efxlab/efx-physic-paint';
import type { PhysicPaintLaunchContext, PhysicPaintRenderedFrame } from '../../../types/physicPaint';
import { buildPhysicsPaintDebugManifest, buildPhysicsPaintStillExport, type PhysicsPaintDebugManifest, type PhysicsPaintStillExport } from '../engine/physicsPaintDevExport';
import { resizePhysicsPaintState } from '../engine/physicsPaintCanvasSizing';
import { downloadPhysicsPaintState, parsePhysicsPaintStateFile } from '../bridge/physicsPaintSessionFile';

type ApplyStatus = 'idle' | 'applying' | 'success' | 'error';

export interface PhysicsPaintDebugProof {
  still: PhysicsPaintStillExport;
  manifest: PhysicsPaintDebugManifest;
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
  canvasSize: { width: number; height: number };
  launchContext: PhysicPaintLaunchContext | null;
  currentFrame: number;
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
      const editableState = engine.save();
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
        fps: launchContext.fps ?? 12,
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
