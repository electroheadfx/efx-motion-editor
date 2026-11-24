import { describe, expect, it, vi } from 'vitest';
import type { RotoPaintScript } from './physicsPaintRotoScriptClipboard';
import {
  ROTO_SCRIPT_COPY_MULTI_KEY_REFUSAL,
  ROTO_SCRIPT_CUT_COPY_FAILED,
  ROTO_SCRIPT_CUT_DELETE_FAILED,
  ROTO_SCRIPT_CUT_MULTI_KEY_REFUSAL,
  runRotoCutWithScript,
  type RotoScriptCutPorts,
} from './physicsPaintRotoScriptClipboardActions';

/**
 * Quick 261124-gfy: Script-mode Cut is the ONE new clipboard flow — copy the
 * current key's script, delete the key, and hand the previous script clipboard
 * back when the delete fails. The module is pure orchestration over ports.
 */

function createSnapshot(sourceFrame: number): RotoPaintScript {
  return {
    provenance: { sessionId: 'session-a', layerId: 'layer-a', sourceFrame },
    sourceFrame,
    sourceDisplayFrame: sourceFrame,
    sourceRevision: 1,
    brushes: [],
  };
}

interface HarnessOptions {
  selectedKeyCount?: number;
  canCopy?: boolean;
  copyDisabledReason?: string | null;
  /** Omitted = the port does not expose copyErrorMessage at all. */
  copyErrorMessage?: string | null;
  canDelete?: boolean;
  deleteDisabledReason?: string | null;
  copyResult?: boolean;
  deleteResult?: boolean | Error;
}

function createHarness(options: HarnessOptions = {}) {
  const calls: string[] = [];
  const snapshot = createSnapshot(7);
  const restoreScriptClipboard = vi.fn((_restored: RotoPaintScript | null) => {
    calls.push('restore');
  });
  const ports: RotoScriptCutPorts = {
    getSelectedKeyCount: () => options.selectedKeyCount ?? 1,
    canCopy: () => options.canCopy ?? true,
    copyDisabledReason: () => options.copyDisabledReason ?? null,
    copyErrorMessage: options.copyErrorMessage === undefined
      ? undefined
      : () => options.copyErrorMessage ?? null,
    snapshotScriptClipboard: () => {
      calls.push('snapshot');
      return snapshot;
    },
    copyScript: async () => {
      calls.push('copy');
      return options.copyResult ?? true;
    },
    canDelete: () => options.canDelete ?? true,
    deleteDisabledReason: () => options.deleteDisabledReason ?? null,
    deleteKey: async () => {
      calls.push('delete');
      if (options.deleteResult instanceof Error) throw options.deleteResult;
      return options.deleteResult ?? true;
    },
    restoreScriptClipboard,
  };
  return { ports, calls, snapshot, restoreScriptClipboard };
}

describe('261124-gfy script clipboard message constants', () => {
  it('names the operation and the single-key rule in both refusals', () => {
    expect(ROTO_SCRIPT_COPY_MULTI_KEY_REFUSAL).toContain('Copy');
    expect(ROTO_SCRIPT_COPY_MULTI_KEY_REFUSAL).toContain('single key');
    expect(ROTO_SCRIPT_CUT_MULTI_KEY_REFUSAL).toContain('Cut');
    expect(ROTO_SCRIPT_CUT_MULTI_KEY_REFUSAL).toContain('single key');
  });

  it('states the clipboard restore and the nothing-deleted guarantees', () => {
    expect(ROTO_SCRIPT_CUT_DELETE_FAILED).toContain('could not be deleted');
    expect(ROTO_SCRIPT_CUT_DELETE_FAILED).toContain('previous script clipboard was restored');
    expect(ROTO_SCRIPT_CUT_COPY_FAILED).toContain('Nothing was deleted');
  });
});

describe('261124-gfy runRotoCutWithScript', () => {
  it('refuses a 2+ key selection before touching the script or the key', async () => {
    const { ports, calls } = createHarness({ selectedKeyCount: 2 });
    const outcome = await runRotoCutWithScript(ports);
    expect(outcome).toEqual({ outcome: 'refused', message: ROTO_SCRIPT_CUT_MULTI_KEY_REFUSAL });
    expect(calls).toEqual([]);
  });

  it('refuses with the verbatim delete reason before copying anything', async () => {
    const { ports, calls } = createHarness({
      canDelete: false,
      deleteDisabledReason: 'Deleting the selected Roto key is unavailable.',
    });
    const outcome = await runRotoCutWithScript(ports);
    expect(outcome).toEqual({
      outcome: 'refused',
      message: 'Deleting the selected Roto key is unavailable.',
    });
    expect(calls).toEqual([]);
  });

  it('refuses with the verbatim copy reason without deleting anything', async () => {
    const { ports, calls } = createHarness({
      canCopy: false,
      copyDisabledReason: 'Copying the key script is unavailable.',
    });
    const outcome = await runRotoCutWithScript(ports);
    expect(outcome).toEqual({
      outcome: 'refused',
      message: 'Copying the key script is unavailable.',
    });
    expect(calls).toEqual([]);
  });

  it('aborts on a failed copy with the port message and never deletes or restores', async () => {
    const { ports, calls, restoreScriptClipboard } = createHarness({
      copyResult: false,
      copyErrorMessage: 'The script capture failed.',
    });
    const outcome = await runRotoCutWithScript(ports);
    expect(outcome).toEqual({ outcome: 'aborted', message: 'The script capture failed.' });
    expect(calls).toEqual(['snapshot', 'copy']);
    expect(restoreScriptClipboard).not.toHaveBeenCalled();
  });

  it('falls back to the copy-failed constant when the port exposes no message', async () => {
    const { ports, calls, restoreScriptClipboard } = createHarness({ copyResult: false });
    const outcome = await runRotoCutWithScript(ports);
    expect(outcome).toEqual({ outcome: 'aborted', message: ROTO_SCRIPT_CUT_COPY_FAILED });
    expect(calls).toEqual(['snapshot', 'copy']);
    expect(restoreScriptClipboard).not.toHaveBeenCalled();
  });

  it('restores the pre-copy snapshot when the delete reports false', async () => {
    const { ports, calls, snapshot, restoreScriptClipboard } = createHarness({ deleteResult: false });
    const outcome = await runRotoCutWithScript(ports);
    expect(outcome).toEqual({ outcome: 'restored', message: ROTO_SCRIPT_CUT_DELETE_FAILED });
    // Locked order: snapshot -> copy -> delete -> restore.
    expect(calls).toEqual(['snapshot', 'copy', 'delete', 'restore']);
    expect(restoreScriptClipboard).toHaveBeenCalledTimes(1);
    expect(restoreScriptClipboard.mock.calls[0][0]).toBe(snapshot);
  });

  it('restores the same snapshot and reports the thrown detail when the delete throws', async () => {
    const { ports, calls, snapshot, restoreScriptClipboard } = createHarness({
      deleteResult: new Error('physical delete rejected'),
    });
    const outcome = await runRotoCutWithScript(ports);
    expect(outcome).toEqual({
      outcome: 'aborted',
      message: ROTO_SCRIPT_CUT_DELETE_FAILED,
      detail: 'physical delete rejected',
    });
    expect(calls).toEqual(['snapshot', 'copy', 'delete', 'restore']);
    expect(restoreScriptClipboard).toHaveBeenCalledTimes(1);
    expect(restoreScriptClipboard.mock.calls[0][0]).toBe(snapshot);
  });

  it('handles a successful cut without ever restoring the previous clipboard', async () => {
    const { ports, calls, restoreScriptClipboard } = createHarness();
    const outcome = await runRotoCutWithScript(ports);
    expect(outcome).toEqual({ outcome: 'handled' });
    expect(calls).toEqual(['snapshot', 'copy', 'delete']);
    expect(restoreScriptClipboard).not.toHaveBeenCalled();
  });
});
