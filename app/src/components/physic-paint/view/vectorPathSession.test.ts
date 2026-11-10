/**
 * 61-08 Task 1 — the vector pen / path-edit session (VEC-01 / VEC-02,
 * D-05 / D-06).
 *
 * Laws pinned here:
 *   D-05  the vector pen is a HOST tool: a session latch outside the four-item
 *         paint row, and latching it never changes `aquarelleActiveTool`
 *   D-06  draw and edit are two distinct states, never one toggling button
 *   The exclusion matrix runs in every direction (pen -> select/picker/edit,
 *   edit -> pen) and no action writes a sibling module's signal directly
 *   Idempotency: 1000 identical calls notify zero extra times
 */
import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { effect } from '@preact/signals';
import {
  appendVectorDraftAnchor,
  beginVectorDraft,
  clearVectorDraft,
  enterPathEdit,
  enterVectorPen,
  exitPathEdit,
  exitVectorPen,
  pathEditMutationId,
  resetForStudioOpen,
  toggleVectorPen,
  vectorDrawDraft,
  vectorPenActive,
} from './vectorPathSession';
import { aquarelleActiveTool, setAquarelleTool } from './aquarelleRecordState';
import { aquarelleSelectMode, setAquarelleSelectMode } from './aquarelleStrokeSelection';
import { aquarellePickerActive, disarmAquarellePicker, setAquarellePickerLatched } from './aquarelleColorPicker';

/** Count how many times a read runs — an `effect()` re-runs only on a REAL write. */
function countRuns(read: () => unknown): { runs: () => number; dispose: () => void } {
  let runs = 0;
  const dispose = effect(() => {
    void read();
    runs += 1;
  });
  return { runs: () => runs, dispose };
}

afterEach(() => {
  resetForStudioOpen();
  setAquarelleSelectMode(false);
  disarmAquarellePicker();
  setAquarelleTool('brush');
});

describe('vectorPathSession — the vector pen and path-edit session', () => {
  it('starts clean and clears every sibling surface on entry', () => {
    expect(vectorPenActive.peek()).toBe(false);
    expect(pathEditMutationId.peek()).toBeNull();
    expect(vectorDrawDraft.peek()).toBeNull();

    setAquarelleTool('pen');
    setAquarelleSelectMode(true);
    setAquarellePickerLatched(true);
    enterPathEdit('m7');

    enterVectorPen();

    expect(vectorPenActive.value).toBe(true);
    expect(pathEditMutationId.value).toBeNull();
    expect(aquarelleSelectMode.value).toBe(false);
    expect(aquarellePickerActive.value).toBe(false);
    // A host tool: the paint tool is untouched in both directions.
    expect(aquarelleActiveTool.value).toBe('pen');
  });

  it('exits the vector pen without touching the paint tool or arming a sibling', () => {
    setAquarelleTool('brush');
    setAquarellePickerLatched(false);
    enterVectorPen();
    exitVectorPen();

    expect(vectorPenActive.value).toBe(false);
    expect(aquarelleActiveTool.value).toBe('brush');
    expect(aquarelleSelectMode.value).toBe(false);
    expect(aquarellePickerActive.value).toBe(false);
    expect(pathEditMutationId.value).toBeNull();
  });

  it('toggles the pen on and back off', () => {
    toggleVectorPen();
    expect(vectorPenActive.value).toBe(true);
    toggleVectorPen();
    expect(vectorPenActive.value).toBe(false);
  });

  it('enters path edit and clears select, the picker and the pen', () => {
    setAquarelleTool('brush');
    setAquarelleSelectMode(true);
    setAquarellePickerLatched(true);
    enterVectorPen();

    enterPathEdit('m7');

    expect(pathEditMutationId.value).toBe('m7');
    expect(vectorPenActive.value).toBe(false);
    expect(aquarelleSelectMode.value).toBe(false);
    expect(aquarellePickerActive.value).toBe(false);
    expect(aquarelleActiveTool.value).toBe('brush');
  });

  it('clears path edit without re-arming anything', () => {
    enterPathEdit('m7');
    exitPathEdit();
    expect(pathEditMutationId.value).toBeNull();
    expect(vectorPenActive.value).toBe(false);
    expect(aquarelleSelectMode.value).toBe(false);
    expect(aquarellePickerActive.value).toBe(false);
  });

  it('writes each signal once for identical calls (idempotent setters)', () => {
    // Measured one signal at a time: entering path edit legitimately clears a
    // latched pen (the exclusion law pinned above), so a single effect over
    // both signals would count that cross-write as an extra pen write.
    const penRuns = countRuns(() => vectorPenActive.value);
    enterVectorPen();
    enterVectorPen();
    enterVectorPen();
    // 1 initial run + exactly one real write.
    expect(penRuns.runs()).toBe(2);
    penRuns.dispose();

    const editRuns = countRuns(() => pathEditMutationId.value);
    enterPathEdit('m7');
    enterPathEdit('m7');
    expect(editRuns.runs()).toBe(2);
    editRuns.dispose();
  });

  it('builds the draw draft from a first anchor and appends at the cursor', () => {
    beginVectorDraft({ x: 0.1, y: 0.2, kind: 'auto' });
    expect(vectorDrawDraft.peek()?.anchors).toHaveLength(1);
    expect(vectorDrawDraft.peek()?.cursor).toEqual({ x: 0.1, y: 0.2 });

    appendVectorDraftAnchor({ x: 0.3, y: 0.4, kind: 'bezier', in: { x: 0.3, y: 0.4 }, out: { x: 0.3, y: 0.4 } });
    expect(vectorDrawDraft.peek()?.anchors).toHaveLength(2);
    expect(vectorDrawDraft.peek()?.anchors[1]?.kind).toBe('bezier');
    expect(vectorDrawDraft.peek()?.cursor).toEqual({ x: 0.3, y: 0.4 });
  });

  it('begins a draft when the first anchor is appended to an empty session', () => {
    appendVectorDraftAnchor({ x: 0.5, y: 0.5, kind: 'auto' });
    expect(vectorDrawDraft.peek()?.anchors).toHaveLength(1);
  });

  it('keeps the draft across a tool toggle and clears it only explicitly', () => {
    enterVectorPen();
    beginVectorDraft({ x: 0.1, y: 0.2, kind: 'auto' });
    exitVectorPen();
    enterVectorPen();
    // Draft SURVIVES a tool toggle — clearing is Escape / finish / reset only.
    expect(vectorDrawDraft.peek()?.anchors).toHaveLength(1);
    clearVectorDraft();
    expect(vectorDrawDraft.peek()).toBeNull();
    expect(vectorPenActive.peek()).toBe(true);
  });

  it('returns every signal to its initial value on reset, idempotently', () => {
    enterVectorPen();
    appendVectorDraftAnchor({ x: 0.2, y: 0.3, kind: 'auto' });
    enterPathEdit('m9');

    resetForStudioOpen();

    expect(vectorPenActive.peek()).toBe(false);
    expect(pathEditMutationId.peek()).toBeNull();
    expect(vectorDrawDraft.peek()).toBeNull();

    const penRuns = countRuns(() => vectorPenActive.value);
    resetForStudioOpen();
    resetForStudioOpen();
    expect(penRuns.runs()).toBe(1);
    penRuns.dispose();
  });
});

describe('the four paint tools stay closed', () => {
  const railPath = fileURLToPath(new URL('./PhysicsPaintToolRail.tsx', import.meta.url));
  const payloadPath = fileURLToPath(
    new URL('../../../../../packages/efx-watercolor/src/payload/toStudioStroke.ts', import.meta.url),
  );

  it('WATERCOLOR_RAIL_TOOLS still has exactly four entries', () => {
    const rail = readFileSync(railPath, 'utf8');
    const block = rail.slice(rail.indexOf('const WATERCOLOR_RAIL_TOOLS'), rail.indexOf('function WatercolorRail'));
    expect(block.length).toBeGreaterThan(0);
    expect(block.match(/\{ id: '/g) ?? []).toHaveLength(4);
  });

  it('AquarelleTool still has exactly four members', () => {
    const payload = readFileSync(payloadPath, 'utf8');
    const union = /export type AquarelleTool = ([^\n]+)/.exec(payload)?.[1] ?? '';
    expect(union.match(/'[a-z]+'/g) ?? []).toHaveLength(4);
  });
});
