import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { SerializedProject } from '@efxlab/efx-physic-paint';
import {
  LOAD_STATE_INVALID_COPY,
  LOAD_STATE_SUCCESS_COPY,
  SAVE_STATE_CANCELLED_COPY,
  SAVE_STATE_SUCCESS_COPY,
  downloadPhysicsPaintState,
  parsePhysicsPaintStateFile,
  serializePhysicsPaintState,
} from './physicsPaintSessionFile';

const sourcePath = fileURLToPath(new URL('./physicsPaintSessionFile.ts', import.meta.url));
const source = () => readFileSync(sourcePath, 'utf8');

const editableState: SerializedProject = {
  version: 2,
  width: 1000,
  height: 650,
  strokes: [],
  settings: { bgMode: 'canvas1', paperGrain: 'canvas1', embossStrength: 0.45, wetPaper: true },
};

describe('physicsPaintSessionFile', () => {
  it('serializes editable physics paint state as pretty JSON', () => {
    const serialized = serializePhysicsPaintState(editableState);

    expect(serialized).toContain('"version": 2');
    expect(serialized).toContain('"strokes"');
    expect(serialized).toContain('"settings"');
    expect(JSON.parse(serialized)).toEqual(editableState);
    expect(serialized).toBe(JSON.stringify(editableState, null, 2));
  });

  it('parses valid editable state JSON', () => {
    const parsed = parsePhysicsPaintStateFile(JSON.stringify(editableState));

    expect(parsed).toEqual(editableState);
    expect(LOAD_STATE_SUCCESS_COPY).toBe('Loaded editable JSON state.');
  });

  it('throws exact invalid-state copy for malformed or invalid state JSON', () => {
    expect(() => parsePhysicsPaintStateFile('{bad json')).toThrow(LOAD_STATE_INVALID_COPY);
    expect(() => parsePhysicsPaintStateFile(JSON.stringify({ ...editableState, version: undefined }))).toThrow(LOAD_STATE_INVALID_COPY);
    expect(() => parsePhysicsPaintStateFile(JSON.stringify({ ...editableState, strokes: {} }))).toThrow(LOAD_STATE_INVALID_COPY);
    expect(LOAD_STATE_INVALID_COPY).toBe('This file is not a valid Physics Paint state JSON. Choose a state file exported from Physics Paint.');
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

  it('downloads editable state JSON through an injected adapter without rendered PNG output', async () => {
    const save = vi.fn().mockResolvedValue(undefined);

    const result = await downloadPhysicsPaintState(editableState, { save });

    expect(result.status).toBe('saved');
    expect(result.message).toBe(SAVE_STATE_SUCCESS_COPY);
    expect(SAVE_STATE_SUCCESS_COPY).toBe('Saved editable JSON state.');
    expect(save).toHaveBeenCalledTimes(1);
    const [{ filename, contents, mimeType }] = save.mock.calls[0];
    expect(filename).toMatch(/^efx-paint-state-.*\.json$/);
    expect(mimeType).toBe('application/json');
    expect(contents).toBe(JSON.stringify(editableState, null, 2));
    expect(contents).not.toContain('data:image/png');
    expect(contents).not.toContain('renderedFrame');
    expect(contents).not.toContain('frames');
    expect(contents).not.toContain('PhysicPaintRenderedFrame');
    expect(contents).not.toContain('apply-play-canvas');
  });

  it('writes editable JSON to the selected path through an injected native save adapter', async () => {
    const saveDialog = vi.fn().mockResolvedValue('/Users/demo/efx-state.json');
    const writeTextFile = vi.fn().mockResolvedValue(undefined);

    const result = await downloadPhysicsPaintState(editableState, {
      native: { saveDialog, writeTextFile },
      browser: { save: vi.fn() },
    });

    expect(result).toEqual({ status: 'saved', message: SAVE_STATE_SUCCESS_COPY });
    expect(saveDialog).toHaveBeenCalledWith({
      defaultPath: expect.stringMatching(/^efx-paint-state-.*\.json$/),
      filters: [{ name: 'Physics paint state', extensions: ['json'] }],
    });
    expect(writeTextFile).toHaveBeenCalledTimes(1);
    expect(writeTextFile).toHaveBeenCalledWith('/Users/demo/efx-state.json', JSON.stringify(editableState, null, 2));
  });

  it('returns clean cancel behavior from native save without writing a file', async () => {
    const saveDialog = vi.fn().mockResolvedValue(null);
    const writeTextFile = vi.fn();

    const result = await downloadPhysicsPaintState(editableState, {
      native: { saveDialog, writeTextFile },
      browser: { save: vi.fn() },
    });

    expect(result).toEqual({ status: 'cancelled', message: SAVE_STATE_CANCELLED_COPY });
    expect(writeTextFile).not.toHaveBeenCalled();
  });

  it('falls back to browser download when native save APIs are unavailable outside Tauri', async () => {
    const browserSave = vi.fn().mockResolvedValue(undefined);

    const result = await downloadPhysicsPaintState(editableState, {
      native: null,
      browser: { save: browserSave },
    });

    expect(result).toEqual({ status: 'saved', message: SAVE_STATE_SUCCESS_COPY });
    const [{ filename, contents, mimeType }] = browserSave.mock.calls[0];
    expect(filename).toMatch(/^efx-paint-state-.*\.json$/);
    expect(contents).toBe(JSON.stringify(editableState, null, 2));
    expect(mimeType).toBe('application/json');
  });
});
