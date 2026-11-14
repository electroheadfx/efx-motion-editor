// ============================================================
//  62-01 — the session-only held fit and the wireframe entry arm.
//
//  Entry fits the stroke's OWN recorded samples into anchors and
//  arms a session signal; nothing crosses into the document, the
//  revision or the ledger until a gesture commits (D-03). The
//  wireframe bracket captures the user's pre-entry values BEFORE
//  the shipped latch forces Draft on, and a repeated arm never
//  overwrites that capture (D-06, compare-then-write).
//
//  62-02 — the exit bracket. ONE pure resolver pins every exit,
//  and `endCurveBracket` is the ONE teardown: drop the held fit
//  first, then restore the pre-entry wireframe/Draft without ever
//  baking behind the user's own construction view (D-06, D-14).
// ============================================================

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AquarellePoint, AquarelleStroke } from '@efxlab/efx-watercolor/payload';
import {
  aquarelleStrokesRevision,
  getRecordedAquarellePayloadTimeline,
  getRecordedAquarelleStroke,
  recordAquarelleStroke,
  resetAquarelleRecordState,
} from './aquarelleRecordState';
import { beginAquarellePathEdit } from './aquarelleStrokeSelection';
import {
  draftMode,
  setDraftMode,
  setDraftPixelsDirty,
  setWireframeMode,
  wireframeMode,
} from './scriptStrokeEdition';
import {
  beginCurveWireframeBracket,
  beginPaintedCurveSession,
  clearCurveFitSession,
  curveFitSession,
} from './vectorPathCurveBracket';
import * as curveBracketSurface from './vectorPathCurveBracket';

/** The widened pre-entry capture 62-02 introduces (superset of 62-01's boolean). */
interface CurveEntrySnapshot {
  readonly wireframe: boolean;
  readonly draft: boolean;
}

/** The pure exit action: restore the wireframe, settle the Draft, or leave Draft. */
interface CurveExitAction {
  readonly restore: boolean;
  readonly settle: boolean;
  readonly leaveDraft: boolean;
}

/**
 * 62-02 symbols are reached through the module namespace so the RED run fails
 * on the missing assertions rather than at module load (TDD gate evidence).
 */
interface CurveBracketExtensions {
  readonly curveEntrySnapshot?: { peek(): CurveEntrySnapshot | null };
  clearCurveEntrySnapshot?: () => void;
  resolveCurveExitAction?: (state: {
    readonly preWireframe: boolean;
    readonly preDraft: boolean;
    readonly dirty: boolean;
  }) => CurveExitAction;
  endCurveBracket?: (options: { readonly settle: () => void | Promise<void> }) => Promise<void>;
}

const bracket = curveBracketSurface as unknown as CurveBracketExtensions;

/** A hand-recorded sample train: 300 samples, monotone-but-varying pressure. */
function handPoints(count = 300): AquarellePoint[] {
  const points: AquarellePoint[] = [];
  for (let index = 0; index < count; index += 1) {
    const t = index / (count - 1);
    points.push({
      x: 0.1 + 0.8 * t,
      y: 0.5 + 0.18 * Math.sin(t * Math.PI * 2),
      p: 0.2 + 0.7 * t,
      tx: 0.5,
      ty: -0.5,
      tw: 0.75,
    });
  }
  return points;
}

function handStroke(
  mutationId: number,
  points: readonly AquarellePoint[] = handPoints(),
): AquarelleStroke {
  return {
    tool: 'brush',
    color: '#103c65',
    params: { size: 12, water: 30 },
    brushId: 'round',
    points,
    mutationId,
    timestamp: mutationId,
    playFrame: 601,
  };
}

beforeEach(() => {
  resetAquarelleRecordState();
  clearCurveFitSession();
  bracket.clearCurveEntrySnapshot?.();
  setWireframeMode(false);
  setDraftPixelsDirty(false);
  setDraftMode(false);
});

describe('62-01 the session-only held fit', () => {
  it('fits the stroke’s own recorded samples and writes no document state', () => {
    const id = 62051;
    recordAquarelleStroke(id, handStroke(id));
    const index = getRecordedAquarellePayloadTimeline().length - 1;
    const before = getRecordedAquarelleStroke(id)!;
    const beforeEntry = getRecordedAquarellePayloadTimeline()[index];
    const revision = aquarelleStrokesRevision.value;

    const session = beginPaintedCurveSession(before);
    expect(session).not.toBeNull();
    expect(session!.mutationId).toBe(id);
    // The fit reads the recorded samples themselves — no copy, no extra data.
    expect(session!.sourcePoints).toBe(before.points);
    expect(session!.anchors.length).toBeGreaterThanOrEqual(2);
    expect(session!.anchors.length).toBeLessThanOrEqual(40);
    for (const anchor of session!.anchors) expect(anchor.kind).toBe('auto');
    expect(curveFitSession.peek()).toBe(session);

    // D-03: arming writes NO document, revision or ledger state.
    expect(aquarelleStrokesRevision.value).toBe(revision);
    expect(getRecordedAquarelleStroke(id)).toBe(before);
    expect(getRecordedAquarellePayloadTimeline()[index]).toBe(beforeEntry);
    expect(getRecordedAquarellePayloadTimeline()).toHaveLength(1);
  });

  it('re-arms idempotently and drops the held fit on exit', () => {
    const id = 62053;
    recordAquarelleStroke(id, handStroke(id));
    const strokeNow = getRecordedAquarelleStroke(id)!;

    const first = beginPaintedCurveSession(strokeNow);
    const second = beginPaintedCurveSession(strokeNow);
    expect(first).not.toBeNull();
    // Compare-then-write: a repeated arm keeps the ONE held session object.
    expect(second).toBe(first);

    clearCurveFitSession();
    expect(curveFitSession.peek()).toBeNull();
    clearCurveFitSession();
    expect(curveFitSession.peek()).toBeNull();
  });

  it('refuses a stroke with fewer than two distinct finite samples', () => {
    expect(beginPaintedCurveSession(handStroke(62055, []))).toBeNull();
    expect(
      beginPaintedCurveSession(
        handStroke(62057, [{ x: Number.NaN, y: 0.5, p: 0.5, tx: 0, ty: 0, tw: 0 }]),
      ),
    ).toBeNull();
    // Consecutive duplicates collapse to one distinct sample.
    expect(
      beginPaintedCurveSession(
        handStroke(62059, [
          { x: 0.4, y: 0.4, p: 0.5, tx: 0, ty: 0, tw: 0 },
          { x: 0.4, y: 0.4, p: 0.5, tx: 0, ty: 0, tw: 0 },
        ]),
      ),
    ).toBeNull();
    expect(curveFitSession.peek()).toBeNull();
  });

  it('refuses an already-vector stroke — the fit is for painted strokes only', () => {
    const id = 62061;
    recordAquarelleStroke(id, {
      ...handStroke(id),
      anchors: [
        { x: 0.1, y: 0.5, kind: 'auto' },
        { x: 0.9, y: 0.5, kind: 'auto' },
      ],
    });
    expect(beginPaintedCurveSession(getRecordedAquarelleStroke(id)!)).toBeNull();
  });

  it('arms a fit the ONE path write then converts end to end', () => {
    const id = 62063;
    recordAquarelleStroke(id, handStroke(id));
    const before = getRecordedAquarelleStroke(id)!;
    const revision = aquarelleStrokesRevision.value;

    const session = beginPaintedCurveSession(before)!;
    expect(session).not.toBeNull();

    const editId = beginAquarellePathEdit(id, session.anchors, { curveMode: 'spline' });
    expect(editId).not.toBeNull();
    const after = getRecordedAquarelleStroke(id)!;
    expect(after.anchors).toEqual(session.anchors);
    expect(after.curveMode).toBe('spline');
    expect(aquarelleStrokesRevision.value).toBe(revision + 1);
    // Arming itself wrote nothing: one commit, one bump.
    expect(getRecordedAquarellePayloadTimeline()).toHaveLength(1);
  });
});

describe('62-01 the wireframe entry bracket', () => {
  it('captures the pre-entry values BEFORE turning wireframe on, and never overwrites them', () => {
    const id = 62071;
    recordAquarelleStroke(id, handStroke(id));
    const index = getRecordedAquarellePayloadTimeline().length - 1;
    const beforeEntry = getRecordedAquarellePayloadTimeline()[index];
    const revision = aquarelleStrokesRevision.value;
    expect(wireframeMode.peek()).toBe(false);

    expect(beginCurveWireframeBracket()).toBe(false);
    expect(bracket.curveEntrySnapshot!.peek()).toEqual({ wireframe: false, draft: false });
    expect(wireframeMode.peek()).toBe(true);
    // The shipped latch generalises Draft: wireframe on implies Draft on.
    expect(draftMode.peek()).toBe(true);

    // A repeated arm never overwrites the capture (compare-then-write).
    expect(beginCurveWireframeBracket()).toBe(false);
    expect(bracket.curveEntrySnapshot!.peek()).toEqual({ wireframe: false, draft: false });

    // D-03/D-16: the bracket is VIEW state — no document, revision or ledger write.
    expect(aquarelleStrokesRevision.value).toBe(revision);
    expect(getRecordedAquarellePayloadTimeline()[index]).toBe(beforeEntry);
    expect(getRecordedAquarellePayloadTimeline()).toHaveLength(1);
  });

  it('captures an already-on wireframe so an exit restores the user’s own setting', () => {
    setWireframeMode(true);
    expect(beginCurveWireframeBracket()).toBe(true);
    expect(bracket.curveEntrySnapshot!.peek()).toEqual({ wireframe: true, draft: true });
    expect(wireframeMode.peek()).toBe(true);
  });

  it('captures a pre-entry Draft the user had on without wireframe', () => {
    setDraftMode(true);
    expect(beginCurveWireframeBracket()).toBe(false);
    expect(bracket.curveEntrySnapshot!.peek()).toEqual({ wireframe: false, draft: true });
    expect(wireframeMode.peek()).toBe(true);
    expect(draftMode.peek()).toBe(true);
  });
});

describe('62-02 the exit action resolver (D-06, D-14)', () => {
  it('keeps a dirty Draft behind the user’s own wireframe — one restore, no settle', () => {
    expect(bracket.resolveCurveExitAction!({ preWireframe: true, preDraft: true, dirty: true }))
      .toEqual({ restore: true, settle: false, leaveDraft: false });
  });

  it('settles a dirty Draft exactly once when the user had no wireframe', () => {
    expect(bracket.resolveCurveExitAction!({ preWireframe: false, preDraft: false, dirty: true }))
      .toEqual({ restore: false, settle: true, leaveDraft: false });
  });

  it('restores a clean pre-entry wireframe without settling', () => {
    expect(bracket.resolveCurveExitAction!({ preWireframe: true, preDraft: true, dirty: false }))
      .toEqual({ restore: true, settle: false, leaveDraft: false });
  });

  it('leaves a clean pre-entry Draft alone', () => {
    expect(bracket.resolveCurveExitAction!({ preWireframe: false, preDraft: true, dirty: false }))
      .toEqual({ restore: false, settle: false, leaveDraft: false });
  });

  it('leaves Draft directly when the user had neither wireframe nor Draft', () => {
    expect(bracket.resolveCurveExitAction!({ preWireframe: false, preDraft: false, dirty: false }))
      .toEqual({ restore: false, settle: false, leaveDraft: true });
  });
});

describe('62-02 the exit bracket teardown', () => {
  it('is a no-op when no bracket is open — no write, no settle', async () => {
    const settle = vi.fn();
    await bracket.endCurveBracket!({ settle });
    expect(settle).not.toHaveBeenCalled();
    expect(bracket.curveEntrySnapshot!.peek()).toBeNull();
    expect(wireframeMode.peek()).toBe(false);
    expect(draftMode.peek()).toBe(false);
  });

  it('drops the held fit FIRST, then applies the action, and clears the capture last', async () => {
    const id = 62101;
    recordAquarelleStroke(id, handStroke(id));
    const session = beginPaintedCurveSession(getRecordedAquarelleStroke(id)!)!;
    expect(session).not.toBeNull();
    // Dirty forces the settle branch (no pre-entry wireframe).
    setDraftPixelsDirty(true);
    expect(beginCurveWireframeBracket()).toBe(false);

    const settle = vi.fn(() => {
      expect(curveFitSession.peek()).toBeNull();
      expect(bracket.curveEntrySnapshot!.peek()).toEqual({ wireframe: false, draft: false });
    });
    await bracket.endCurveBracket!({ settle });
    expect(settle).toHaveBeenCalledTimes(1);
    expect(bracket.curveEntrySnapshot!.peek()).toBeNull();
  });

  it('restores the user’s own wireframe on a clean exit and never settles', async () => {
    setWireframeMode(true);
    expect(beginCurveWireframeBracket()).toBe(true);
    const settle = vi.fn();
    await bracket.endCurveBracket!({ settle });
    expect(settle).not.toHaveBeenCalled();
    expect(wireframeMode.peek()).toBe(true);
    expect(draftMode.peek()).toBe(true);
    expect(bracket.curveEntrySnapshot!.peek()).toBeNull();
  });

  it('stays in a clean pre-entry Draft without settling or forcing wireframe', async () => {
    setDraftMode(true);
    expect(beginCurveWireframeBracket()).toBe(false);
    const settle = vi.fn();
    await bracket.endCurveBracket!({ settle });
    expect(settle).not.toHaveBeenCalled();
    expect(wireframeMode.peek()).toBe(false);
    expect(draftMode.peek()).toBe(true);
  });

  it('leaves Draft entirely when the user had neither wireframe nor Draft', async () => {
    expect(beginCurveWireframeBracket()).toBe(false);
    const settle = vi.fn();
    await bracket.endCurveBracket!({ settle });
    expect(settle).not.toHaveBeenCalled();
    expect(wireframeMode.peek()).toBe(false);
    expect(draftMode.peek()).toBe(false);
  });

  it('never drops the deferred render behind the user’s own wireframe', async () => {
    setWireframeMode(true);
    setDraftPixelsDirty(true);
    expect(beginCurveWireframeBracket()).toBe(true);
    const settle = vi.fn();
    await bracket.endCurveBracket!({ settle });
    expect(settle).not.toHaveBeenCalled();
    expect(wireframeMode.peek()).toBe(true);
    // The dirty Draft may only leave through the shipped settle or stay behind
    // the construction view the user had on before entry (D-14).
    expect(draftMode.peek()).toBe(true);
  });
});
