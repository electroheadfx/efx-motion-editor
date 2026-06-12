import type { SerializedProject } from '@efxlab/efx-physic-paint';
import { isSerializedProject } from '../../types/physicPaint';

export const SAVE_STATE_SUCCESS_COPY = 'Saved editable JSON state.';
export const LOAD_STATE_SUCCESS_COPY = 'Loaded editable JSON state.';
export const LOAD_STATE_INVALID_COPY = 'This file is not a valid Physics Paint state JSON. Choose a state file exported from Physics Paint.';

export interface PhysicsPaintStateDownloadRequest {
  filename: string;
  contents: string;
  mimeType: 'application/json';
}

export interface PhysicsPaintStateDownloadAdapter {
  save: (request: PhysicsPaintStateDownloadRequest) => Promise<void> | void;
}

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
  adapter: PhysicsPaintStateDownloadAdapter = browserPhysicsPaintStateDownloadAdapter,
): Promise<string> {
  await adapter.save({
    filename: makePhysicsPaintStateFilename(),
    contents: serializePhysicsPaintState(state),
    mimeType: 'application/json',
  });

  return SAVE_STATE_SUCCESS_COPY;
}

function makePhysicsPaintStateFilename(): string {
  return `efx-paint-state-${Date.now()}.json`;
}

const browserPhysicsPaintStateDownloadAdapter: PhysicsPaintStateDownloadAdapter = {
  save({ filename, contents, mimeType }) {
    const blob = new Blob([contents], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  },
};
