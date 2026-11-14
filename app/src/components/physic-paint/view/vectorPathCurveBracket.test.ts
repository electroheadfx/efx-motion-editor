// ============================================================
//  62-01 — the session-only held fit and the wireframe entry arm.
//
//  Entry fits the stroke's OWN recorded samples into anchors and
//  arms a session signal; nothing crosses into the document, the
//  revision or the ledger until a gesture commits (D-03). The
//  wireframe bracket captures the user's pre-entry value BEFORE
//  the shipped latch forces Draft on, and a repeated arm never
//  overwrites that capture (D-06, compare-then-write).
// ============================================================

import { beforeEach, describe, expect, it } from 'vitest';
import type { AquarellePoint, AquarelleStroke } from '@efxlab/efx-watercolor/payload';
import {
  aquarelleStrokesRevision,
  getRecordedAquarellePayloadTimeline,
  getRecordedAquarelleStroke,
  recordAquarelleStroke,
  resetAquarelleRecordState,
} from './aquarelleRecordState';
import { beginAquarellePathEdit } from './aquarelleStrokeSelection';
import { draftMode, setDraftMode, setWireframeMode, wireframeMode } from './scriptStrokeEdition';
import {
  beginCurveWireframeBracket,
  beginPaintedCurveSession,
  clearCurveFitSession,
  clearCurveWireframeRestore,
  curveFitSession,
  curveWireframeRestore,
} from './vectorPathCurveBracket';

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
  clearCurveWireframeRestore();
  setWireframeMode(false);
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
  it('captures the pre-entry value BEFORE turning wireframe on, and never overwrites it', () => {
    const id = 62071;
    recordAquarelleStroke(id, handStroke(id));
    const index = getRecordedAquarellePayloadTimeline().length - 1;
    const beforeEntry = getRecordedAquarellePayloadTimeline()[index];
    const revision = aquarelleStrokesRevision.value;
    expect(wireframeMode.peek()).toBe(false);

    expect(beginCurveWireframeBracket()).toBe(false);
    expect(curveWireframeRestore.peek()).toBe(false);
    expect(wireframeMode.peek()).toBe(true);
    // The shipped latch generalises Draft: wireframe on implies Draft on.
    expect(draftMode.peek()).toBe(true);

    // A repeated arm never overwrites the capture (compare-then-write).
    expect(beginCurveWireframeBracket()).toBe(false);
    expect(curveWireframeRestore.peek()).toBe(false);

    // D-03/D-16: the bracket is VIEW state — no document, revision or ledger write.
    expect(aquarelleStrokesRevision.value).toBe(revision);
    expect(getRecordedAquarellePayloadTimeline()[index]).toBe(beforeEntry);
    expect(getRecordedAquarellePayloadTimeline()).toHaveLength(1);
  });

  it('captures an already-on wireframe so an exit restores the user’s own setting', () => {
    setWireframeMode(true);
    expect(beginCurveWireframeBracket()).toBe(true);
    expect(curveWireframeRestore.peek()).toBe(true);
    expect(wireframeMode.peek()).toBe(true);
  });
});
