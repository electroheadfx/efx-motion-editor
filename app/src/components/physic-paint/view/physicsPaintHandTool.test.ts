// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { effect } from '@preact/signals';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  disarmHandTool,
  isHandToolArmed,
  isHandToolArmedPeek,
  setHandToolArmed,
} from './physicsPaintHandTool';
import { aquarelleActiveTool, setAquarelleTool } from './aquarelleRecordState';
import { aquarelleSelectMode, setAquarelleSelectMode } from './aquarelleStrokeSelection';
import {
  aquarellePickerLatched,
  setAquarellePickerLatched,
} from './aquarelleColorPicker';

/**
 * 261105-cgl Task 3: the session-only Hand host tool.
 *
 * The hand is a HOST tool — it never enters the `AquarelleTool` union and never
 * writes the paint tool, Select mode, or the picker, so disarming is literally
 * "back to the previous tool". 261107-sg3: it is a PRESS-AND-HOLD control —
 * the zoom pill arms it on pointerdown and disarms it on release.
 */

beforeEach(() => {
  disarmHandTool();
});

afterEach(() => {
  disarmHandTool();
  setAquarelleSelectMode(false);
  setAquarellePickerLatched(false);
  setAquarelleTool('brush');
});

describe('arm/disarm law', () => {
  it('starts disarmed and arms/disarms through the compare-then-write setter', () => {
    expect(isHandToolArmed()).toBe(false);
    expect(setHandToolArmed(true)).toBe(true);
    expect(isHandToolArmed()).toBe(true);
    expect(setHandToolArmed(false)).toBe(true);
    expect(isHandToolArmed()).toBe(false);
  });

  it('setHandToolArmed is compare-then-write', () => {
    expect(setHandToolArmed(true)).toBe(true);
    expect(setHandToolArmed(true)).toBe(false);
    expect(isHandToolArmedPeek()).toBe(true);
    expect(setHandToolArmed(false)).toBe(true);
    expect(setHandToolArmed(false)).toBe(false);
  });

  it('disarmHandTool is idempotent — no notification when already disarmed', () => {
    let runs = 0;
    const dispose = effect(() => {
      void isHandToolArmed();
      runs += 1;
    });
    try {
      const before = runs;
      disarmHandTool();
      expect(runs).toBe(before);
      setHandToolArmed(true);
      expect(runs).toBe(before + 1);
      disarmHandTool();
      expect(runs).toBe(before + 2);
      disarmHandTool();
      expect(runs).toBe(before + 2);
    } finally {
      dispose();
    }
  });
});

describe('read surfaces', () => {
  it('isHandToolArmed subscribes; isHandToolArmedPeek reads at dispatch time', () => {
    let runs = 0;
    const dispose = effect(() => {
      void isHandToolArmed();
      runs += 1;
    });
    try {
      const before = runs;
      expect(isHandToolArmedPeek()).toBe(false);
      expect(runs).toBe(before);
      setHandToolArmed(true);
      expect(runs).toBe(before + 1);
      expect(isHandToolArmedPeek()).toBe(true);
      // A repeated arm never re-runs the effect (compare-then-write).
      setHandToolArmed(true);
      expect(runs).toBe(before + 1);
    } finally {
      dispose();
    }
  });
});

describe('host-tool isolation', () => {
  it('never writes the paint tool, Select mode, or the picker', () => {
    setAquarelleTool('pen');
    setAquarelleSelectMode(true);
    setAquarellePickerLatched(true);

    setHandToolArmed(true);
    expect(isHandToolArmed()).toBe(true);
    expect(aquarelleActiveTool.value).toBe('pen');
    expect(aquarelleSelectMode.value).toBe(true);
    expect(aquarellePickerLatched.value).toBe(true);

    disarmHandTool();
    expect(aquarelleActiveTool.value).toBe('pen');
    expect(aquarelleSelectMode.value).toBe(true);
    expect(aquarellePickerLatched.value).toBe(true);
  });

  it('documents the host-tool contract and imports no paint state', () => {
    const moduleSource = readFileSync(
      resolve(__dirname, './physicsPaintHandTool.ts'),
      'utf8',
    );
    expect(moduleSource).toContain('HOST tool');
    // Check the CODE only — the contract comment names the paint surfaces it
    // deliberately never touches.
    const codeOnly = moduleSource
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    expect(codeOnly).not.toContain('aquarelleActiveTool');
    expect(codeOnly).not.toContain('setAquarelleTool');
    expect(codeOnly).not.toContain('aquarelleSelectMode');
    expect(codeOnly).not.toContain('aquarelleColorPicker');
    expect(codeOnly).not.toContain('AquarelleTool');
  });
});
