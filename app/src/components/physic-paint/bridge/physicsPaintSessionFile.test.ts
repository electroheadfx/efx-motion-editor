import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createEfxPaintDocument } from '../../../efx-paint/document/efxPaintDocument';
import { parseEfxPaintDocument } from '../../../efx-paint/document/efxPaintDocumentParsers';
import {
  LOAD_STATE_INVALID_COPY,
  LOAD_STATE_SUCCESS_COPY,
  LOAD_STATE_UNSUPPORTED_VERSION_COPY,
  SAVE_STATE_CANCELLED_COPY,
  SAVE_STATE_SUCCESS_COPY,
  downloadPhysicsPaintState,
  parsePhysicsPaintStateFile,
  serializePhysicsPaintState,
} from './physicsPaintSessionFile';

const sourcePath = fileURLToPath(new URL('./physicsPaintSessionFile.ts', import.meta.url));
const source = () => readFileSync(sourcePath, 'utf8');

const document = createEfxPaintDocument('layer-1');

/** Well-formed legacy pre-v1.0 session shape (version: 2, strokes/settings). */
const legacyState = {
  version: 2,
  width: 1000,
  height: 650,
  strokes: [],
  settings: { bgMode: 'canvas1', paperGrain: 'canvas1', embossStrength: 0.45, wetPaper: true },
};

describe('physicsPaintSessionFile', () => {
  it('serializes a session whose payload is a v1.0 document and parses it back with identity intact', () => {
    const serialized = serializePhysicsPaintState(document);

    expect(JSON.parse(serialized)).toEqual(document);
    const parsed = parsePhysicsPaintStateFile(serialized);
    expect(parsed).toEqual(document);
    expect(parsed.version).toBe(1);
    expect(parsed.parentLayerId).toBe('layer-1');
    expect(parsed.tracks[0].id).toBe(document.activeTrackId);
    expect(parsed.background.fallback).toEqual({ mode: 'transparent' });
    expect(parsed).toEqual(parseEfxPaintDocument(JSON.parse(serialized)));
  });

  it('rejects a legacy version:2 session file with the distinct pre-v1.0 unsupported copy', () => {
    expect(() => parsePhysicsPaintStateFile(JSON.stringify(legacyState))).toThrow(LOAD_STATE_UNSUPPORTED_VERSION_COPY);
    expect(LOAD_STATE_UNSUPPORTED_VERSION_COPY).toContain('pre-v1.0');
    expect(LOAD_STATE_UNSUPPORTED_VERSION_COPY).not.toBe(LOAD_STATE_INVALID_COPY);
  });

  it('throws the exact invalid-state copy for malformed or unrecognized JSON', () => {
    expect(() => parsePhysicsPaintStateFile('{bad json')).toThrow(LOAD_STATE_INVALID_COPY);
    expect(() => parsePhysicsPaintStateFile(JSON.stringify({ ...document, version: 99 }))).toThrow(LOAD_STATE_INVALID_COPY);
    expect(LOAD_STATE_INVALID_COPY).toBe('This file is not a valid Physics Paint state JSON. Choose a state file exported from Physics Paint.');
  });

  it('rejects a v1.0-shaped payload with an unknown member fail-closed as invalid', () => {
    expect(() => parsePhysicsPaintStateFile(JSON.stringify({ ...document, extraMember: true }))).toThrow(LOAD_STATE_INVALID_COPY);
  });

  it('names v1.0 session files with the efx-paint-doc- marker', async () => {
    const save = vi.fn().mockResolvedValue(undefined);

    await downloadPhysicsPaintState(document, { save });

    const [{ filename }] = save.mock.calls[0];
    expect(filename).toMatch(/^efx-paint-doc-.*\.json$/);
  });

  it('routes default Tauri Save State through parent-owned typed authority without direct dialog or filesystem imports', () => {
    const text = source();

    expect(text).toContain('PHYSIC_PAINT_STATE_SAVE_REQUEST_EVENT');
    expect(text).toContain('PHYSIC_PAINT_STATE_SAVE_RESULT_EVENT');
    expect(text).toContain("emitTo('main'");
    expect(text).toContain('parent-owned-native-save:${operationId}');
    expect(text).not.toContain("from '@tauri-apps/plugin-dialog'");
    expect(text).not.toContain("from '@tauri-apps/plugin-fs'");
  });

  it('keeps concurrent parent-owned saves operation-local and ignores out-of-order foreign results', () => {
    const text = source();

    expect(text).toContain('const operationId = `physics-paint-state-save-${Date.now()}-${crypto.randomUUID()}`');
    expect(text).toContain('if (payload?.operationId !== operationId) return');
    expect(text).toContain('let pendingResult: Promise<PhysicPaintStateSaveResult> | null = null');
    expect(text).toContain('if (path !== sentinel || writeContents !== contents || !pendingResult)');
    expect(text).toContain('unlisten?.()');
  });

  it('downloads the v1.0 document JSON through an injected adapter without rendered PNG output', async () => {
    const save = vi.fn().mockResolvedValue(undefined);

    const result = await downloadPhysicsPaintState(document, { save });

    expect(result.status).toBe('saved');
    expect(result.message).toBe(SAVE_STATE_SUCCESS_COPY);
    expect(SAVE_STATE_SUCCESS_COPY).toBe('Saved editable JSON state.');
    expect(save).toHaveBeenCalledTimes(1);
    const [{ filename, contents, mimeType }] = save.mock.calls[0];
    expect(filename).toMatch(/^efx-paint-doc-.*\.json$/);
    expect(mimeType).toBe('application/json');
    expect(contents).toBe(JSON.stringify(document, null, 2));
    expect(contents).not.toContain('data:image/png');
    expect(contents).not.toContain('renderedFrame');
    expect(contents).not.toContain('PhysicPaintRenderedFrame');
    expect(contents).not.toContain(['apply', 'play', 'canvas'].join('-'));
  });

  it('writes the v1.0 document JSON to the selected path through an injected native save adapter', async () => {
    const saveDialog = vi.fn().mockResolvedValue('/Users/demo/efx-doc.json');
    const writeTextFile = vi.fn().mockResolvedValue(undefined);

    const result = await downloadPhysicsPaintState(document, {
      native: { saveDialog, writeTextFile },
      browser: { save: vi.fn() },
    });

    expect(result).toEqual({ status: 'saved', message: SAVE_STATE_SUCCESS_COPY });
    expect(saveDialog).toHaveBeenCalledWith({
      defaultPath: expect.stringMatching(/^efx-paint-doc-.*\.json$/),
      filters: [{ name: 'Physics paint state', extensions: ['json'] }],
    });
    expect(writeTextFile).toHaveBeenCalledTimes(1);
    expect(writeTextFile).toHaveBeenCalledWith('/Users/demo/efx-doc.json', JSON.stringify(document, null, 2));
  });

  it('returns clean cancel behavior from native save without writing a file', async () => {
    const saveDialog = vi.fn().mockResolvedValue(null);
    const writeTextFile = vi.fn();

    const result = await downloadPhysicsPaintState(document, {
      native: { saveDialog, writeTextFile },
      browser: { save: vi.fn() },
    });

    expect(result).toEqual({ status: 'cancelled', message: SAVE_STATE_CANCELLED_COPY });
    expect(writeTextFile).not.toHaveBeenCalled();
  });

  it('falls back to browser download when native save APIs are unavailable outside Tauri', async () => {
    const browserSave = vi.fn().mockResolvedValue(undefined);

    const result = await downloadPhysicsPaintState(document, {
      native: null,
      browser: { save: browserSave },
    });

    expect(result).toEqual({ status: 'saved', message: SAVE_STATE_SUCCESS_COPY });
    const [{ filename, contents, mimeType }] = browserSave.mock.calls[0];
    expect(filename).toMatch(/^efx-paint-doc-.*\.json$/);
    expect(contents).toBe(JSON.stringify(document, null, 2));
    expect(mimeType).toBe('application/json');
  });
});
