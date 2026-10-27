// ============================================================
//  quick-261027-k6j — the top-bar "Script" session switch.
//
//  TWO CONTRACTS:
//    1. SESSION DEFAULT/RESET: the switch loads On, the setter is
//       compare-then-write, and resetAquarelleScriptRecording()
//       returns it to On (every Studio launch starts recording).
//    2. OFF WRITES NOTHING: recordAquarelleStrokeWhenEnabled(false, …)
//       appends no timeline event and never bumps the revision, while
//       an existing script stays byte-for-byte intact and editable.
// ============================================================

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';
import type { AquarellePoint, AquarelleStroke } from '@efxlab/efx-watercolor/payload';
import {
  aquarelleScriptRecordingEnabled,
  aquarelleStrokesRevision,
  deleteAquarelleStrokeFromScript,
  getAquarelleStrokeKeyAnchors,
  getRecordedAquarellePayloadTimeline,
  getRecordedAquarelleStroke,
  getRecordedAquarelleStrokeEntries,
  isAquarelleStrokeDeleted,
  recordAquarelleStrokeWhenEnabled,
  resetAquarelleRecordState,
  resetAquarelleScriptRecording,
  setAquarelleScriptRecordingEnabled,
} from './aquarelleRecordState';

const moduleSource = readFileSync(
  fileURLToPath(new URL('./aquarelleRecordState.ts', import.meta.url)),
  'utf8',
);

function point(x: number, y: number): AquarellePoint {
  return { x, y, p: 1, tx: 0, ty: 0, tw: 0 };
}

function stroke(mutationId: number, playFrame: number): AquarelleStroke {
  return {
    tool: 'brush',
    color: '#103c65',
    params: { size: 12 },
    brushId: 'round',
    points: [point(0.1, 0.5), point(0.2, 0.5)],
    mutationId,
    timestamp: mutationId,
    playFrame,
  };
}

function nonDryEvents() {
  return getRecordedAquarellePayloadTimeline().filter((event) => !('kind' in event));
}

beforeEach(() => {
  resetAquarelleRecordState();
  resetAquarelleScriptRecording();
});

describe('261027-k6j Script switch session default', () => {
  it('loads On and resets to On', () => {
    expect(aquarelleScriptRecordingEnabled.value).toBe(true);
    setAquarelleScriptRecordingEnabled(false);
    expect(aquarelleScriptRecordingEnabled.value).toBe(false);
    resetAquarelleScriptRecording();
    expect(aquarelleScriptRecordingEnabled.value).toBe(true);
  });

  it('setter is compare-then-write: a repeated false keeps it false', () => {
    setAquarelleScriptRecordingEnabled(false);
    setAquarelleScriptRecordingEnabled(false);
    expect(aquarelleScriptRecordingEnabled.value).toBe(false);
    setAquarelleScriptRecordingEnabled(true);
    setAquarelleScriptRecordingEnabled(true);
    expect(aquarelleScriptRecordingEnabled.value).toBe(true);
  });

  it('declares the signal On by default (source pin)', () => {
    expect(moduleSource).toContain(
      'export const aquarelleScriptRecordingEnabled = signal(true);',
    );
  });
});

describe('261027-k6j Script On records exactly like before', () => {
  it('records the stroke, its timeline event and its key anchor', () => {
    expect(recordAquarelleStrokeWhenEnabled(true, 9001, stroke(9001, 3), 'key-a')).toBe(true);
    expect(getRecordedAquarelleStroke(9001)).toBeDefined();
    expect(nonDryEvents()).toHaveLength(1);
    expect(getAquarelleStrokeKeyAnchors().get(9001)).toBe('key-a');
  });
});

// ============================================================
//  261027-klx — moved from the deleted brushScriptRecordState.test.ts.
//
//  The Brush store carried an "aquarelle guide proxies are never Brush
//  script content" block: engine-1 guide proxies (the paint-stroke
//  projection of a watercolor stroke) were refused by Brush capture,
//  restore and the overlay through `guideProxy: true` — that marker is
//  still pinned against the surviving projection in
//  engine/aquarelleStrokeBridge.test.ts. The rest of the block exercised
//  Brush-store exports and dies with its subject. What survives, and what
//  this block pins, is the other half of the coexistence contract: the
//  aquarelle registry is the ONLY script authority — a stroke is script
//  content if and only if the aquarelle record path recorded it, with no
//  implicit seeding from raw paint strokes.
// ============================================================
describe('261027-klx aquarelle registry is the only script authority', () => {
  it('records strokes in recording order with their key anchors', () => {
    recordAquarelleStrokeWhenEnabled(true, 9101, stroke(9101, 5), 'key-a');
    recordAquarelleStrokeWhenEnabled(true, 9102, stroke(9102, 5), 'key-a');

    const entries = getRecordedAquarelleStrokeEntries();
    expect([...entries.keys()]).toEqual([9101, 9102]);
    expect(entries.get(9102)!.playFrame).toBe(5);
    expect([...getAquarelleStrokeKeyAnchors().entries()]).toEqual([
      [9101, 'key-a'],
      [9102, 'key-a'],
    ]);
    expect(nonDryEvents()).toHaveLength(2);
  });

  it('an unrecorded mutation id is absent from every script view (no implicit capture)', () => {
    recordAquarelleStrokeWhenEnabled(true, 9101, stroke(9101, 5), 'key-a');

    expect(getRecordedAquarelleStrokeEntries().has(9199)).toBe(false);
    expect(getAquarelleStrokeKeyAnchors().has(9199)).toBe(false);
    expect(getRecordedAquarelleStroke(9199)).toBeUndefined();
    expect(nonDryEvents()).toHaveLength(1);
  });

  it('an unanchored record carries no key identity (never a guessed identity)', () => {
    recordAquarelleStrokeWhenEnabled(true, 9103, stroke(9103, 5));

    expect(getRecordedAquarelleStrokeEntries().has(9103)).toBe(true);
    expect(getAquarelleStrokeKeyAnchors().has(9103)).toBe(false);
  });
});

describe('261027-k6j Script Off writes nothing', () => {
  it('appends no event and never bumps the revision', () => {
    recordAquarelleStrokeWhenEnabled(true, 9001, stroke(9001, 3), 'key-a');
    const timelineBefore = getRecordedAquarellePayloadTimeline().length;
    const revisionBefore = aquarelleStrokesRevision.value;

    expect(recordAquarelleStrokeWhenEnabled(false, 9002, stroke(9002, 3), 'key-a')).toBe(false);

    expect(getRecordedAquarellePayloadTimeline()).toHaveLength(timelineBefore);
    expect(aquarelleStrokesRevision.value).toBe(revisionBefore);
    expect(getRecordedAquarelleStroke(9002)).toBeUndefined();
  });

  it('leaves the existing script intact and editable while Off', () => {
    recordAquarelleStrokeWhenEnabled(true, 9001, stroke(9001, 3), 'key-a');
    const recorded = getRecordedAquarelleStroke(9001);

    expect(recordAquarelleStrokeWhenEnabled(false, 9002, stroke(9002, 3), 'key-a')).toBe(false);

    const after = getRecordedAquarelleStroke(9001);
    expect(after).toBe(recorded);
    expect(aquarelleScriptRecordingEnabled.value).toBe(true);

    setAquarelleScriptRecordingEnabled(false);
    try {
      expect(deleteAquarelleStrokeFromScript(9001)).toBe(true);
      expect(isAquarelleStrokeDeleted(9001)).toBe(true);
      expect(aquarelleScriptRecordingEnabled.value).toBe(false);
    } finally {
      resetAquarelleScriptRecording();
    }
  });
});
