import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearIoFailureLatch,
  projectIoFailureDetail,
  reportLatchedIoFailure,
  showProjectIoFailureDialog,
} from './projectIoFailureDialog';

/**
 * quick-260913-05k: the save/open failure surface (T-260913-05k-04).
 *
 * The live P0 was a SILENT failure: package saves died on a plugin-fs
 * capability refusal while the only feedback was a console line. These cases
 * pin the replacement — a blocking native modal carrying the raw error text
 * (so "forbidden path ..." reaches the user verbatim), a per-action latch for
 * the unattended autosave path, and a static wiring pin that keeps the number
 * of dialog call sites equal to the number of console.error sites, so no
 * future failure path can quietly add a log-only branch.
 */

const dialogMessage = vi.hoisted(() => vi.fn());

vi.mock('@tauri-apps/plugin-dialog', () => ({ message: dialogMessage }));

const APP_ROOT = resolve(__dirname, '../..');

function readAppFile(relativePath: string): string {
  return readFileSync(resolve(APP_ROOT, relativePath), 'utf8');
}

/** The count of one call shape in a source file. */
function countCalls(source: string, call: string): number {
  return source.split(`${call}(`).length - 1;
}

/** Every call site of the failure surface: direct dialogs plus latched reports. */
function failureSurfaceCalls(source: string): number {
  return countCalls(source, 'showProjectIoFailureDialog') + countCalls(source, 'reportLatchedIoFailure');
}

beforeEach(() => {
  vi.clearAllMocks();
  dialogMessage.mockResolvedValue('Ok');
  clearIoFailureLatch('save');
  clearIoFailureLatch('open');
});

describe('projectIoFailureDetail', () => {
  it("returns an Error's message", () => {
    expect(projectIoFailureDetail(new Error('forbidden path: /p/.efx-paint-package-staging-1')))
      .toBe('forbidden path: /p/.efx-paint-package-staging-1');
  });

  it('returns a raw string unchanged', () => {
    expect(projectIoFailureDetail('scope refused: fs:scope-appdata-recursive'))
      .toBe('scope refused: fs:scope-appdata-recursive');
  });

  it("returns an object's message when present", () => {
    expect(projectIoFailureDetail({ message: 'io error while publishing' })).toBe('io error while publishing');
  });

  it('falls back to String(value) for everything else, and never yields an empty string', () => {
    expect(projectIoFailureDetail(42)).toBe('42');
    for (const value of [undefined, null, '', 0, {}, { message: '' }]) {
      const detail = projectIoFailureDetail(value);
      expect(typeof detail, String(value)).toBe('string');
      expect(detail.trim().length, String(value)).toBeGreaterThan(0);
    }
  });
});

describe('showProjectIoFailureDialog', () => {
  it('awaits a blocking error modal whose body carries the action and the raw detail', async () => {
    await showProjectIoFailureDialog('save', new Error('forbidden path: /p/.efx-paint-package-staging-1'));

    expect(dialogMessage).toHaveBeenCalledTimes(1);
    const [body, options] = dialogMessage.mock.calls[0] as [string, Record<string, unknown>];
    expect(options).toEqual({ title: 'EFX Motion Editor', kind: 'error', buttons: 'Ok' });
    expect(body).toContain('save the project');
    expect(body).toContain('forbidden path: /p/.efx-paint-package-staging-1');
  });

  it('names the open action for an open failure', async () => {
    await showProjectIoFailureDialog('open', 'Error: ENOENT: no such file or directory');

    const [body, options] = dialogMessage.mock.calls[0] as [string, Record<string, unknown>];
    expect(options.kind).toBe('error');
    expect(body).toContain('open the project');
    expect(body).toContain('ENOENT: no such file or directory');
  });
});

describe('reportLatchedIoFailure', () => {
  it('shows at most one dialog per action per failure streak', () => {
    reportLatchedIoFailure('save', new Error('first failure'));
    expect(dialogMessage).toHaveBeenCalledTimes(1);

    // The autosave retries every tick — the user sees one modal, not one per
    // attempt.
    reportLatchedIoFailure('save', new Error('second failure'));
    reportLatchedIoFailure('save', new Error('third failure'));
    expect(dialogMessage).toHaveBeenCalledTimes(1);
    expect((dialogMessage.mock.calls[0] as [string])[0]).toContain('first failure');
  });

  it('latches per action: an open failure still surfaces while save is latched', () => {
    reportLatchedIoFailure('save', new Error('save failure'));
    reportLatchedIoFailure('open', new Error('open failure'));

    expect(dialogMessage).toHaveBeenCalledTimes(2);
    expect((dialogMessage.mock.calls[1] as [string])[0]).toContain('open failure');
  });

  it('lets the next failure show again after clearIoFailureLatch', () => {
    reportLatchedIoFailure('save', new Error('first'));
    expect(dialogMessage).toHaveBeenCalledTimes(1);

    clearIoFailureLatch('save');
    reportLatchedIoFailure('save', new Error('after recovery'));

    expect(dialogMessage).toHaveBeenCalledTimes(2);
    expect((dialogMessage.mock.calls[1] as [string])[0]).toContain('after recovery');
  });
});

describe('wiring pin: no save/open failure path is console-only', () => {
  it.each([
    ['src/lib/shortcuts.ts', 3],
    ['src/components/layout/Toolbar.tsx', 3],
    ['src/components/project/WelcomeScreen.tsx', 2],
    ['src/main.tsx', 3],
  ])('%s carries one dialog site per console.error site', (relativePath, expected) => {
    const source = readAppFile(relativePath);
    expect(countCalls(source, 'console.error'), relativePath).toBe(expected);
    expect(failureSurfaceCalls(source), relativePath).toBe(expected);
  });

  it('autoSave.ts reports a latched failure at BOTH save call sites and clears the latch on a recorded save', () => {
    const source = readAppFile('src/lib/autoSave.ts');
    expect(countCalls(source, 'reportLatchedIoFailure')).toBe(2);
    expect(countCalls(source, 'clearIoFailureLatch')).toBe(1);
    // The clear lives in recordSaved — the only place a save is known to have
    // succeeded — so a later failure can surface again.
    const recordSaved = /function recordSaved\(\): void \{([\s\S]*?)\n\}/.exec(source);
    expect(recordSaved, 'recordSaved must exist').not.toBeNull();
    expect(recordSaved![1]).toContain('clearIoFailureLatch');
  });
});
