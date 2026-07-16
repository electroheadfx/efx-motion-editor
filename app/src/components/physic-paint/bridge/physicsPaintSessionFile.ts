import type { SerializedProject } from '@efxlab/efx-physic-paint';
import type { PhysicPaintStateSaveResult } from '../../../types/physicPaint';
import { isSerializedProject } from '../../../types/physicPaint';
import { PHYSIC_PAINT_STATE_SAVE_REQUEST_EVENT, PHYSIC_PAINT_STATE_SAVE_RESULT_EVENT } from '../../../lib/physicPaintBridge';

export const SAVE_STATE_SUCCESS_COPY = 'Saved editable JSON state.';
export const SAVE_STATE_CANCELLED_COPY = 'Save state cancelled.';
export const SAVE_STATE_UNAVAILABLE_COPY = 'Save state is unavailable because the native file dialog could not be opened.';
export const LOAD_STATE_SUCCESS_COPY = 'Loaded editable JSON state.';
export const LOAD_STATE_INVALID_COPY = 'This file is not a valid Physics Paint state JSON. Choose a state file exported from Physics Paint.';

export interface PhysicsPaintStateDownloadRequest {
  filename: string;
  contents: string;
  mimeType: 'application/json';
}

export interface PhysicsPaintStateBrowserDownloadAdapter {
  save: (request: PhysicsPaintStateDownloadRequest) => Promise<void> | void;
}

export type PhysicsPaintRuntimeAdapter = {
  isTauri?: () => boolean;
};

export interface PhysicsPaintStateNativeSaveAdapter {
  saveDialog: (options: { defaultPath: string; filters: { name: string; extensions: string[] }[] }) => Promise<string | null>;
  writeTextFile: (path: string, contents: string) => Promise<void> | void;
}

export type PhysicsPaintStateDownloadAdapter = PhysicsPaintStateBrowserDownloadAdapter | {
  native?: PhysicsPaintStateNativeSaveAdapter | null;
  browser: PhysicsPaintStateBrowserDownloadAdapter;
  runtime?: PhysicsPaintRuntimeAdapter;
};

export type PhysicsPaintStateDownloadResult = {
  status: 'saved' | 'cancelled';
  message: string;
};

export function serializePhysicsPaintState(state: SerializedProject): string {
  return JSON.stringify(state, null, 2);
}

export function parsePhysicsPaintStateFile(contents: string): SerializedProject {
  try {
    const parsed = JSON.parse(contents);
    if (!isSerializedProject(parsed)) throw new Error(LOAD_STATE_INVALID_COPY);
    return parsed;
  } catch {
    throw new Error(LOAD_STATE_INVALID_COPY);
  }
}

export async function downloadPhysicsPaintState(
  state: SerializedProject,
  adapter?: PhysicsPaintStateDownloadAdapter,
): Promise<PhysicsPaintStateDownloadResult> {
  const filename = makePhysicsPaintStateFilename();
  const contents = serializePhysicsPaintState(state);
  const resolvedAdapter = adapter ?? await createDefaultPhysicsPaintStateDownloadAdapter();

  if ('browser' in resolvedAdapter) {
    if (resolvedAdapter.native) {
      pendingNativeContents = contents;
      const selectedPath = await resolvedAdapter.native.saveDialog({
        defaultPath: filename,
        filters: [{ name: 'Physics paint state', extensions: ['json'] }],
      });
      if (!selectedPath) return { status: 'cancelled', message: SAVE_STATE_CANCELLED_COPY };
      await resolvedAdapter.native.writeTextFile(selectedPath, contents);
      return { status: 'saved', message: SAVE_STATE_SUCCESS_COPY };
    }

    if (resolvedAdapter.runtime?.isTauri?.() ?? isTauriRuntime()) throw new Error(SAVE_STATE_UNAVAILABLE_COPY);
    await resolvedAdapter.browser.save({ filename, contents, mimeType: 'application/json' });
    return { status: 'saved', message: SAVE_STATE_SUCCESS_COPY };
  }

  await resolvedAdapter.save({ filename, contents, mimeType: 'application/json' });
  return { status: 'saved', message: SAVE_STATE_SUCCESS_COPY };
}

function makePhysicsPaintStateFilename(): string {
  return `efx-paint-state-${Date.now()}.json`;
}

async function createDefaultPhysicsPaintStateDownloadAdapter(): Promise<PhysicsPaintStateDownloadAdapter> {
  return {
    native: await loadTauriNativeSaveAdapter(),
    browser: browserPhysicsPaintStateDownloadAdapter,
  };
}

async function loadTauriNativeSaveAdapter(): Promise<PhysicsPaintStateNativeSaveAdapter | null> {
  if (!isTauriRuntime()) return null;
  return {
    async saveDialog(options) {
      const operationId = `physics-paint-state-save-${Date.now()}-${crypto.randomUUID()}`;
      const result = new Promise<PhysicPaintStateSaveResult>((resolve, reject) => {
        let unlisten: (() => void) | undefined;
        void import('@tauri-apps/api/event').then(async ({ listen }) => {
          unlisten = await listen(PHYSIC_PAINT_STATE_SAVE_RESULT_EVENT, (event) => {
            const payload = event.payload as PhysicPaintStateSaveResult;
            if (payload?.operationId !== operationId) return;
            unlisten?.();
            resolve(payload);
          });
          await (await import('@tauri-apps/api/event')).emitTo('main', PHYSIC_PAINT_STATE_SAVE_REQUEST_EVENT, {
            operationId,
            filename: options.defaultPath,
            contents: pendingNativeContents,
          });
        }).catch(reject);
      });
      pendingNativeResult = result;
      const response = await result;
      if (response.status === 'error') throw new Error(response.error ?? SAVE_STATE_UNAVAILABLE_COPY);
      return response.status === 'cancelled' ? null : NATIVE_SAVE_SENTINEL;
    },
    async writeTextFile(path, contents) {
      if (path !== NATIVE_SAVE_SENTINEL || contents !== pendingNativeContents || !pendingNativeResult) throw new Error(SAVE_STATE_UNAVAILABLE_COPY);
      const response = await pendingNativeResult;
      pendingNativeResult = null;
      pendingNativeContents = '';
      if (response.status !== 'saved') throw new Error(response.error ?? SAVE_STATE_UNAVAILABLE_COPY);
    },
  };
}

const NATIVE_SAVE_SENTINEL = 'parent-owned-native-save';
let pendingNativeContents = '';
let pendingNativeResult: Promise<PhysicPaintStateSaveResult> | null = null;

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined'
    && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window || 'isTauri' in window);
}

const browserPhysicsPaintStateDownloadAdapter: PhysicsPaintStateBrowserDownloadAdapter = {
  save({ filename, contents, mimeType }) {
    const blob = new Blob([contents], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  },
};
