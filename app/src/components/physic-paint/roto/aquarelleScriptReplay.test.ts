// ============================================================
//  261029-lsr — deterministic orchestration pin (D-05) for the
//  ONE script-replay path.
//
//  Real GPU pixels are out of reach under `vitest run`, so the
//  pin models the two authorities as plain byte arrays: the live
//  sheet — which WINS the display while it still holds pixels,
//  the exact split this task closes — and the published bake.
//  After the replay the two digests must agree; a negative
//  control (a no-op reset) must make them differ, otherwise this
//  file would keep passing after the reset is removed.
// ============================================================

import { describe, expect, it } from 'vitest';
import { digestRenderedFrameBytes } from '../performance/aquarelleRenderSplitCapture';
import {
  runAquarelleScriptReplay,
  type AquarelleReplayDirection,
  type AquarelleReplayPorts,
  type AquarelleReplayStep,
} from './aquarelleScriptReplay';

/** The pre-undo live sheet (what a stale capture would carry). */
const PRE_UNDO_BYTES = new Uint8Array([1, 2, 3, 4, 5, 6]);
/** The post-undo bake. */
const POST_UNDO_BYTES = new Uint8Array([9, 9, 8, 8, 7, 7]);
/** The one revert object `restore` hands back — identity proves the rollback. */
const REVERT_TOKEN: { kind: 'revert' } = { kind: 'revert' };

interface WorldOptions {
  ensureBase?: 'ok' | 'reject';
  prepare?: number | null;
  restore?: 'revert' | 'null' | 'throw';
  reset?: 'clear' | 'noop' | 'throw';
  rebake?: 'ok' | 'false' | 'reject';
  rollback?: 'ok' | 'throw';
  notify?: 'ok' | 'throw';
  publishOwner?: 'ok' | 'throw';
}

interface World {
  ports: AquarelleReplayPorts<{ kind: 'revert' }>;
  /** Port calls for the module's own steps, in call order. */
  steps: string[];
  /** notify / publish-owner, recorded after the bake. */
  tail: string[];
  emitted: AquarelleReplayStep[];
  restoreCalls: Array<{ editId: number; direction: AquarelleReplayDirection }>;
  /** Every `revert` handed to `rollback`, in call order. */
  rollbackArgs: Array<{ kind: 'revert' }>;
  displayBytes: () => Uint8Array | null;
  publishedBytes: () => Uint8Array | null;
}

function createWorld(options: WorldOptions = {}): World {
  const prepareResult = options.prepare === undefined ? 31 : options.prepare;
  let sheetBytes: Uint8Array | null = PRE_UNDO_BYTES;
  let publishedBytes: Uint8Array | null = null;
  const steps: string[] = [];
  const tail: string[] = [];
  const emitted: AquarelleReplayStep[] = [];
  const restoreCalls: Array<{ editId: number; direction: AquarelleReplayDirection }> = [];
  const rollbackArgs: Array<{ kind: 'revert' }> = [];

  const ports: AquarelleReplayPorts<{ kind: 'revert' }> = {
    invalidate: () => {
      steps.push('invalidate');
    },
    ensureBase: async () => {
      steps.push('ensure-base');
      if (options.ensureBase === 'reject') throw new Error('base recovery exploded');
      return true;
    },
    prepare: () => {
      steps.push('prepare');
      return prepareResult;
    },
    restore: (editId, direction) => {
      steps.push('restore');
      restoreCalls.push({ editId, direction });
      if (options.restore === 'throw') throw new Error('restore exploded');
      return options.restore === 'null' ? null : REVERT_TOKEN;
    },
    resetSheet: () => {
      steps.push('reset');
      if (options.reset === 'throw') throw new Error('reset exploded');
      if (options.reset !== 'noop') sheetBytes = null;
    },
    rebake: async () => {
      steps.push('rebake');
      if (options.rebake === 'reject') throw new Error('bake exploded');
      if (options.rebake === 'false') return false;
      publishedBytes = POST_UNDO_BYTES;
      return true;
    },
    rollback: (revert) => {
      steps.push('rollback');
      rollbackArgs.push(revert);
      if (options.rollback === 'throw') throw new Error('rollback exploded');
    },
    notify: () => {
      tail.push('notify');
      if (options.notify === 'throw') throw new Error('notify exploded');
    },
    publishOwner: () => {
      tail.push('publish-owner');
      if (options.publishOwner === 'throw') throw new Error('publish exploded');
    },
  };

  return {
    ports,
    steps,
    tail,
    emitted,
    restoreCalls,
    rollbackArgs,
    // The live sheet wins while it holds pixels — never the bake.
    displayBytes: () => sheetBytes ?? publishedBytes,
    publishedBytes: () => publishedBytes,
  };
}

function run(world: World, editId?: number): Promise<boolean> {
  return runAquarelleScriptReplay({
    direction: 'undo',
    editId,
    ports: world.ports,
    onStep: (step) => world.emitted.push(step),
  });
}

describe('261029-lsr aquarelle script replay orchestration', () => {
  it('runs invalidate -> ensure-base -> prepare -> restore -> reset -> rebake, then publishes', async () => {
    const world = createWorld();
    await expect(run(world)).resolves.toBe(true);

    expect(world.steps.filter((step) => step !== 'ensure-base' && step !== 'prepare'))
      .toEqual(['invalidate', 'restore', 'reset', 'rebake']);
    // The invalidation is the FIRST step — before any await.
    expect(world.steps[0]).toBe('invalidate');
    // Base recovery precedes the build (R-1) and the build precedes the swap.
    expect(world.steps.indexOf('ensure-base')).toBeLessThan(world.steps.indexOf('prepare'));
    expect(world.steps.indexOf('prepare')).toBeLessThan(world.steps.indexOf('restore'));
    // The prepared edit id is the one restored.
    expect(world.restoreCalls).toEqual([{ editId: 31, direction: 'undo' }]);
    expect(world.tail).toEqual(['notify', 'publish-owner']);
    expect(world.emitted).toEqual([
      'invalidate',
      'ensure-base',
      'prepare',
      'restore',
      'reset',
      'rebake',
    ]);
  });

  it('leaves the displayed frame and the published bake on the SAME bytes (and the pin bites)', async () => {
    const world = createWorld();
    await expect(run(world)).resolves.toBe(true);

    expect(world.displayBytes()).toEqual(POST_UNDO_BYTES);
    expect(digestRenderedFrameBytes(world.displayBytes())).not.toBeNull();
    expect(digestRenderedFrameBytes(world.displayBytes()))
      .toBe(digestRenderedFrameBytes(world.publishedBytes()));

    // Negative control: without the sheet reset the live sheet still wins the
    // display and the two digests disagree — removing the reset fails this file.
    const noReset = createWorld({ reset: 'noop' });
    await expect(run(noReset)).resolves.toBe(true);
    expect(noReset.displayBytes()).toEqual(PRE_UNDO_BYTES);
    expect(digestRenderedFrameBytes(noReset.displayBytes()))
      .not.toBe(digestRenderedFrameBytes(noReset.publishedBytes()));
  });

  it('fails closed without resetting or baking when the restore is refused', async () => {
    const world = createWorld({ restore: 'null' });
    await expect(run(world)).resolves.toBe(false);

    expect(world.steps).toContain('invalidate');
    expect(world.steps).not.toContain('reset');
    expect(world.steps).not.toContain('rebake');
    expect(world.tail).toEqual([]);
  });

  it('rolls the script back and returns false when the re-bake refuses or rejects', async () => {
    const refusing = createWorld({ rebake: 'false' });
    await expect(run(refusing)).resolves.toBe(false);
    expect(refusing.steps).toContain('rollback');
    expect(refusing.steps.indexOf('rollback')).toBeGreaterThan(refusing.steps.indexOf('rebake'));
    expect(refusing.tail).toEqual([]);

    const rejecting = createWorld({ rebake: 'reject' });
    await expect(run(rejecting)).resolves.toBe(false);
    expect(rejecting.steps).toContain('rollback');
    expect(rejecting.tail).toEqual([]);
  });

  it('returns false without restoring when nobody can supply an edit id', async () => {
    const world = createWorld({ prepare: null });
    await expect(run(world)).resolves.toBe(false);
    expect(world.steps).toContain('prepare');
    expect(world.steps).not.toContain('restore');
  });

  it('swallows an ensure-base rejection and lets the bake decide on its own', async () => {
    const world = createWorld({ ensureBase: 'reject' });
    await expect(run(world)).resolves.toBe(true);
    expect(world.steps).toContain('rebake');
  });

  it('skips prepare entirely when the caller already owns the edit id', async () => {
    const world = createWorld();
    await expect(runAquarelleScriptReplay({
      direction: 'redo',
      editId: 42,
      ports: world.ports,
      onStep: (step) => world.emitted.push(step),
    })).resolves.toBe(true);

    expect(world.steps).not.toContain('prepare');
    expect(world.restoreCalls).toEqual([{ editId: 42, direction: 'redo' }]);
  });

  // WR-02: "never throws to the caller" is a real contract — every port after
  // the swap is guarded, and a post-bake publish failure cannot undo the undo.
  it('returns false without throwing when the restore itself throws (nothing was swapped)', async () => {
    const world = createWorld({ restore: 'throw' });
    await expect(run(world)).resolves.toBe(false);
    expect(world.steps).not.toContain('reset');
    expect(world.steps).not.toContain('rebake');
    expect(world.steps).not.toContain('rollback');
    expect(world.tail).toEqual([]);
  });

  it('rolls the swap back exactly once with the restore revert when resetSheet throws', async () => {
    const world = createWorld({ reset: 'throw' });
    await expect(run(world)).resolves.toBe(false);
    expect(world.steps).not.toContain('rebake');
    expect(world.steps.filter((step) => step === 'rollback')).toHaveLength(1);
    expect(world.rollbackArgs).toHaveLength(1);
    expect(world.rollbackArgs[0]).toBe(REVERT_TOKEN);
    expect(world.tail).toEqual([]);
  });

  it('never throws when the raw rollback itself throws after a failed bake', async () => {
    const world = createWorld({ rebake: 'false', rollback: 'throw' });
    await expect(run(world)).resolves.toBe(false);
    expect(world.steps).toContain('rollback');
    expect(world.rollbackArgs).toHaveLength(1);
    expect(world.rollbackArgs[0]).toBe(REVERT_TOKEN);
    expect(world.tail).toEqual([]);
  });

  it('still resolves true when notify or publishOwner throws after a successful bake', async () => {
    const notifyThrows = createWorld({ notify: 'throw' });
    await expect(run(notifyThrows)).resolves.toBe(true);
    expect(notifyThrows.steps).not.toContain('rollback');
    expect(notifyThrows.displayBytes()).toEqual(POST_UNDO_BYTES);

    const publishThrows = createWorld({ publishOwner: 'throw' });
    await expect(run(publishThrows)).resolves.toBe(true);
    expect(publishThrows.steps).not.toContain('rollback');
    expect(publishThrows.displayBytes()).toEqual(POST_UNDO_BYTES);
  });
});
