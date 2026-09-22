import { describe, expect, it } from 'vitest';
import {
  ROTO_SCRIPT_SCOPE_ALL,
  buildScriptScopeEntries,
  filterScriptRows,
  resolveScriptProvenance,
  type RotoScriptScopeRow,
} from './physicsPaintRotoScriptScope';

/** Same idiom as the library test's row() factory: a structural row, no clipboard. */
const scopeRow = (id: string, layerId: string, layerName: string): RotoScriptScopeRow => ({
  id,
  source: { layerId, layerName },
});

const layer = (id: string, name: string) => ({ id, name });

describe('buildScriptScopeEntries', () => {
  it('offers All alone when no row exists', () => {
    expect(buildScriptScopeEntries([], [layer('layer-1', 'Character')]))
      .toEqual([{ id: ROTO_SCRIPT_SCOPE_ALL, label: 'All' }]);
  });

  it('offers All plus one entry per live layer that owns at least one row', () => {
    const rows = [scopeRow('a', 'layer-1', 'Ink'), scopeRow('b', 'layer-2', 'Hair')];
    expect(buildScriptScopeEntries(rows, [layer('layer-1', 'Character'), layer('layer-2', 'Hair')]))
      .toEqual([
        { id: ROTO_SCRIPT_SCOPE_ALL, label: 'All' },
        { id: 'layer-1', label: 'Character' },
        { id: 'layer-2', label: 'Hair' },
      ]);
  });

  it('omits a live layer that owns no row and an orphan layer id alike', () => {
    const rows = [scopeRow('a', 'layer-1', 'Ink'), scopeRow('ghost', 'layer-gone', 'Ghost')];
    expect(buildScriptScopeEntries(rows, [layer('layer-1', 'Character'), layer('layer-2', 'Empty')]))
      .toEqual([
        { id: ROTO_SCRIPT_SCOPE_ALL, label: 'All' },
        { id: 'layer-1', label: 'Character' },
      ]);
  });

  it('keeps both entries when two live layers share a name (ids stay distinct)', () => {
    const rows = [scopeRow('a', 'layer-1', 'Ink'), scopeRow('b', 'layer-2', 'Ink')];
    expect(buildScriptScopeEntries(rows, [layer('layer-1', 'Paint'), layer('layer-2', 'Paint')]))
      .toEqual([
        { id: ROTO_SCRIPT_SCOPE_ALL, label: 'All' },
        { id: 'layer-1', label: 'Paint' },
        { id: 'layer-2', label: 'Paint' },
      ]);
  });

  it('orders entries by the live layer list, and never invents an entry for the current scope', () => {
    const rows = [scopeRow('a', 'layer-1', 'Ink'), scopeRow('b', 'layer-2', 'Hair')];
    const layers = [layer('layer-2', 'Hair'), layer('layer-1', 'Character')];
    expect(buildScriptScopeEntries(rows, layers).map((entry) => entry.id)).toEqual(['all', 'layer-2', 'layer-1']);
    // A current scope that is hidden or unknown adds nothing — the <select>
    // falls back to All rather than rendering a phantom option.
    expect(buildScriptScopeEntries(rows, layers, 'layer-dead').map((entry) => entry.id)).toEqual(['all', 'layer-2', 'layer-1']);
  });
});

describe('filterScriptRows', () => {
  const rows = [scopeRow('a', 'layer-1', 'Ink'), scopeRow('b', 'layer-2', 'Hair'), scopeRow('ghost', 'layer-gone', 'Ghost')];

  it('returns the same list for all — identity projection, controller order preserved', () => {
    expect(filterScriptRows(rows, ROTO_SCRIPT_SCOPE_ALL)).toEqual(rows);
  });

  it('returns only the matching layer rows', () => {
    expect(filterScriptRows(rows, 'layer-2').map((row) => row.id)).toEqual(['b']);
  });

  it('fails open to every row for an unknown or dead scope id — never an empty list', () => {
    expect(filterScriptRows(rows, 'layer-dead')).toEqual(rows);
    expect(filterScriptRows(rows, '').length).toBe(3);
  });

  it('shows an orphan row under All only', () => {
    expect(filterScriptRows(rows, ROTO_SCRIPT_SCOPE_ALL).map((row) => row.id)).toContain('ghost');
    expect(filterScriptRows(rows, 'layer-1').map((row) => row.id)).toEqual(['a']);
    expect(filterScriptRows(rows, 'layer-2').map((row) => row.id)).toEqual(['b']);
  });

  it('mutates nothing: the input array and its rows are untouched', () => {
    const input = [scopeRow('a', 'layer-1', 'Ink'), scopeRow('b', 'layer-2', 'Hair')];
    const before = JSON.stringify(input);
    filterScriptRows(input, 'layer-1');
    expect(JSON.stringify(input)).toBe(before);
    expect(input).toHaveLength(2);
  });
});

describe('resolveScriptProvenance', () => {
  it('resolves the live layer CURRENT name so a rename is reflected', () => {
    const row = scopeRow('a', 'layer-1', 'Ink (snapshotted)');
    expect(resolveScriptProvenance(row, [layer('layer-1', 'Character')]))
      .toEqual({ layerId: 'layer-1', layerName: 'Character', unavailable: false });
  });

  it('falls back to the snapshotted name and flags unavailable for an orphan', () => {
    const row = scopeRow('ghost', 'layer-gone', 'Ghost');
    expect(resolveScriptProvenance(row, [layer('layer-1', 'Character')]))
      .toEqual({ layerId: 'layer-gone', layerName: 'Ghost', unavailable: true });
  });

  it('flags every row unavailable when the live list is empty (a degraded render, never a crash)', () => {
    const row = scopeRow('a', 'layer-1', 'Ink');
    expect(resolveScriptProvenance(row, [])).toEqual({ layerId: 'layer-1', layerName: 'Ink', unavailable: true });
  });
});
