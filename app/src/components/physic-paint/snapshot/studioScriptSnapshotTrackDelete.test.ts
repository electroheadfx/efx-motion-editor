// ============================================================
//  studioScriptSnapshotTrackDelete.test.ts — the rail-deletion
//  cascade laws (quick-261023-ors Task 3).
//
//  Scope law: exactly one track's two snapshot legs, never another
//  rail, never a preset. Order law: when the deleted track is the
//  bound one, the binding is cleared BEFORE the delete is dispatched.
//  Failure law: one capsule report, no throw, no blocked delete.
// ============================================================

import { describe, expect, it, vi } from 'vitest';
import type { StudioScriptSnapshotIdentity } from '../performance/studioScriptSnapshotCodec';
import {
  createStudioScriptSnapshotTrackDelete,
  studioScriptSnapshotTrackDeleteFailureMessage,
  type StudioScriptSnapshotTrackDeleteDeps,
} from './studioScriptSnapshotTrackDelete';

const IDENTITY: StudioScriptSnapshotIdentity = {
  projectId: 'project-1',
  layerId: 'layer-1',
  trackId: 'track-1',
};

type Events = string[];

function harness(overrides: Partial<StudioScriptSnapshotTrackDeleteDeps> = {}) {
  let identity: StudioScriptSnapshotIdentity | null = IDENTITY;
  let authority: string | null = 'vault-token';
  const events: Events = [];
  const report = vi.fn();
  const remove = vi.fn<StudioScriptSnapshotTrackDeleteDeps['remove']>(
    async (
      key: StudioScriptSnapshotIdentity,
      token: string | null,
      scope: 'cache' | 'both',
    ) => {
      events.push(`remove:${key.layerId}:${key.trackId}:${scope}:${token ?? 'null'}`);
      return { ok: true, data: { cacheRemoved: true, packageRemoved: true } };
    },
  );
  const clearBinding = vi.fn(() => {
    events.push('clearBinding');
    identity = null;
  });
  const cascade = createStudioScriptSnapshotTrackDelete({
    getIdentity: () => identity,
    getAuthority: () => authority,
    clearBinding,
    remove,
    report,
    ...overrides,
  });
  return {
    cascade,
    remove,
    clearBinding,
    report,
    events,
    setIdentity: (next: StudioScriptSnapshotIdentity | null) => {
      identity = next;
    },
    setAuthority: (next: string | null) => {
      authority = next;
    },
  };
}

/** Let the fire-and-forget async branch settle. */
async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('createStudioScriptSnapshotTrackDelete', () => {
  it('does nothing without a bound identity (fail closed, no guessed key)', () => {
    const { cascade, remove, clearBinding, report, setIdentity } = harness();
    setIdentity(null);
    cascade('layer-1', 'track-9');
    expect(remove).not.toHaveBeenCalled();
    expect(clearBinding).not.toHaveBeenCalled();
    expect(report).not.toHaveBeenCalled();
  });

  it('ignores deletions on another layer', () => {
    const { cascade, remove, clearBinding, report } = harness();
    cascade('layer-2', 'track-1');
    expect(clearBinding).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(report).not.toHaveBeenCalled();
  });

  it('clears the binding BEFORE dispatching the delete of the bound track', async () => {
    const { cascade, remove, clearBinding, report, events } = harness();
    cascade('layer-1', 'track-1');
    await settle();

    expect(clearBinding).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith(
      { projectId: 'project-1', layerId: 'layer-1', trackId: 'track-1' },
      'vault-token',
      'both',
    );
    // Order law: bind invalidation lands before the delete is dispatched.
    expect(events).toEqual(['clearBinding', 'remove:layer-1:track-1:both:vault-token']);
    expect(report).not.toHaveBeenCalled();
  });

  it('deletes exactly the committed rail when a different rail is bound', async () => {
    const { cascade, remove, clearBinding, events } = harness();
    cascade('layer-1', 'track-9');
    await settle();

    // The binding belongs to another track and stays intact.
    expect(clearBinding).not.toHaveBeenCalled();
    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove.mock.calls[0]![0]).toEqual({
      projectId: 'project-1',
      layerId: 'layer-1',
      trackId: 'track-9',
    });
    expect(events).toEqual(['remove:layer-1:track-9:both:vault-token']);
  });

  it('passes a null authority through (unbound project -> cache leg only)', async () => {
    const { cascade, remove, setAuthority } = harness();
    setAuthority(null);
    cascade('layer-1', 'track-9');
    await settle();
    expect(remove.mock.calls[0]![1]).toBeNull();
    expect(remove.mock.calls[0]![2]).toBe('both');
  });

  it('reports a failed delete ONCE and never throws', async () => {
    const { cascade, remove, report } = harness();
    remove.mockResolvedValue({ ok: false, error: { kind: 'refused' } });

    expect(() => cascade('layer-1', 'track-1')).not.toThrow();
    await settle();

    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith(studioScriptSnapshotTrackDeleteFailureMessage('refused'));
    expect(report.mock.calls[0]![0]).toContain('could not be removed (refused)');
  });

  it('absorbs a rejecting delete as one io report', async () => {
    const { cascade, remove, report } = harness();
    remove.mockRejectedValue(new Error('boom'));

    cascade('layer-1', 'track-1');
    await settle();

    expect(report).toHaveBeenCalledTimes(1);
    expect(report.mock.calls[0]![0]).toContain('(io)');
  });
});
