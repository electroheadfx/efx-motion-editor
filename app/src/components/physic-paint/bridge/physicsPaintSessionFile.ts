/**
 * v1.0 EFX Paint session-file contract (Phase 45-06 Task 1).
 *
 * The session payload IS the 45-01 EfxPaintDocument: save serializes the
 * document (fetched from efxPaintStore by the session controller) and load
 * validates inbound payloads fail-closed through parseEfxPaintDocument.
 * Recognized legacy pre-v1.0 session files (version: 2 or the old
 * strokes/settings top-level shape) reject with the distinct
 * LOAD_STATE_UNSUPPORTED_VERSION_COPY (Pitfall F5, D-03 clean break); genuinely
 * malformed files keep the generic LOAD_STATE_INVALID_COPY. No legacy field is
 * ever converted or partially read.
 */

import type { EfxPaintDocument } from '../../../efx-paint/document/efxPaintDocument';
import { parseEfxPaintDocument } from '../../../efx-paint/document/efxPaintDocumentParsers';
import type { PhysicPaintStateSaveResult } from '../../../types/physicPaint';
import { PHYSIC_PAINT_STATE_SAVE_REQUEST_EVENT, PHYSIC_PAINT_STATE_SAVE_RESULT_EVENT } from '../../../lib/physicPaintBridge';

export const SAVE_STATE_SUCCESS_COPY = 'Saved editable JSON state.';
export const SAVE_STATE_CANCELLED_COPY = 'Save state cancelled.';
export const SAVE_STATE_UNAVAILABLE_COPY = 'Save state is unavailable because the native file dialog could not be opened.';
export const LOAD_STATE_SUCCESS_COPY = 'Loaded editable JSON state.';
export const LOAD_STATE_INVALID_COPY = 'This file is not a valid Physics Paint state JSON. Choose a state file exported from Physics Paint.';
export const LOAD_STATE_UNSUPPORTED_VERSION_COPY = 'This file is a pre-v1.0 Physics Paint session, which v1.0.0 does not support. Choose a state file exported from the current version of Physics Paint.';

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

export function serializePhysicsPaintState(document: EfxPaintDocument): string {
  return JSON.stringify(document, null, 2);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * Recognized legacy pre-v1.0 session shape: version: 2 or the old
 * strokes/settings top-level members. Detection only — no legacy field is
 * read for conversion or partial hydration (Pitfall F5).
 */
function matchesLegacyV2SessionShape(value: unknown): boolean {
  if (!isPlainRecord(value)) return false;
  if (value.version === 2) return true;
  return Array.isArray(value.strokes) && isPlainRecord(value.settings);
}

export function parsePhysicsPaintStateFile(contents: string): EfxPaintDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch {
    throw new Error(LOAD_STATE_INVALID_COPY);
  }
  if (matchesLegacyV2SessionShape(parsed)) {
    throw new Error(LOAD_STATE_UNSUPPORTED_VERSION_COPY);
  }
  try {
    return parseEfxPaintDocument(parsed);
  } catch {
    throw new Error(LOAD_STATE_INVALID_COPY);
  }
}

export async function downloadPhysicsPaintState(
  document: EfxPaintDocument,
  adapter?: PhysicsPaintStateDownloadAdapter,
): Promise<PhysicsPaintStateDownloadResult> {
  const filename = makePhysicsPaintStateFilename();
  const contents = serializePhysicsPaintState(document);
  const resolvedAdapter = adapter ?? await createDefaultPhysicsPaintStateDownloadAdapter(contents);

  if ('browser' in resolvedAdapter) {
    if (resolvedAdapter.native) {
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
  return `efx-paint-doc-${Date.now()}.json`;
}

async function createDefaultPhysicsPaintStateDownloadAdapter(contents: string): Promise<PhysicsPaintStateDownloadAdapter> {
  return {
    native: await loadTauriNativeSaveAdapter(contents),
    browser: browserPhysicsPaintStateDownloadAdapter,
  };
}

async function loadTauriNativeSaveAdapter(contents: string): Promise<PhysicsPaintStateNativeSaveAdapter | null> {
  if (!isTauriRuntime()) return null;
  const operationId = `physics-paint-state-save-${Date.now()}-${crypto.randomUUID()}`;
  const sentinel = `parent-owned-native-save:${operationId}`;
  let pendingResult: Promise<PhysicPaintStateSaveResult> | null = null;

  return {
    async saveDialog(options) {
      const result = new Promise<PhysicPaintStateSaveResult>((resolve, reject) => {
        let unlisten: (() => void) | undefined;
        void import('@tauri-apps/api/event').then(async ({ listen, emitTo }) => {
          unlisten = await listen(PHYSIC_PAINT_STATE_SAVE_RESULT_EVENT, (event) => {
            const payload = event.payload as PhysicPaintStateSaveResult;
            if (payload?.operationId !== operationId) return;
            unlisten?.();
            resolve(payload);
          });
          await emitTo('main', PHYSIC_PAINT_STATE_SAVE_REQUEST_EVENT, {
            operationId,
            filename: options.defaultPath,
            contents,
          });
        }).catch((error) => {
          unlisten?.();
          reject(error);
        });
      });
      pendingResult = result;
      const response = await result;
      if (response.status === 'error') throw new Error(response.error ?? SAVE_STATE_UNAVAILABLE_COPY);
      return response.status === 'cancelled' ? null : sentinel;
    },
    async writeTextFile(path, writeContents) {
      if (path !== sentinel || writeContents !== contents || !pendingResult) throw new Error(SAVE_STATE_UNAVAILABLE_COPY);
      const response = await pendingResult;
      pendingResult = null;
      if (response.status !== 'saved') throw new Error(response.error ?? SAVE_STATE_UNAVAILABLE_COPY);
    },
  };
}

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
