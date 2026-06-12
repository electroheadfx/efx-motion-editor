import { describe, expect, it, vi } from 'vitest';
import type { SerializedProject } from '@efxlab/efx-physic-paint';
import {
  LOAD_STATE_INVALID_COPY,
  LOAD_STATE_SUCCESS_COPY,
  SAVE_STATE_SUCCESS_COPY,
  downloadPhysicsPaintState,
  parsePhysicsPaintStateFile,
  serializePhysicsPaintState,
} from './physicsPaintSessionFile';

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

  it('downloads editable state JSON through an injected adapter without rendered PNG output', async () => {
    const save = vi.fn().mockResolvedValue(undefined);

    const result = await downloadPhysicsPaintState(editableState, { save });

    expect(result).toBe(SAVE_STATE_SUCCESS_COPY);
    expect(SAVE_STATE_SUCCESS_COPY).toBe('Saved editable JSON state.');
    expect(save).toHaveBeenCalledTimes(1);
    const [{ filename, contents, mimeType }] = save.mock.calls[0];
    expect(filename).toMatch(/^efx-paint-state-.*\.json$/);
    expect(mimeType).toBe('application/json');
    expect(contents).toBe(JSON.stringify(editableState, null, 2));
    expect(contents).not.toContain('data:image/png');
    expect(contents).not.toContain('PhysicPaintRenderedFrame');
    expect(contents).not.toContain('apply-play-canvas');
  });
});
