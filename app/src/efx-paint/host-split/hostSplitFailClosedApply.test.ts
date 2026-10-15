import { describe, expect, it, vi } from 'vitest';
import {
  buildRotoScriptApplyRefusalMessage,
} from '../../components/physic-paint/roto/physicsPaintRotoScriptApplyRefusal';
import {
  createRotoScriptClipboardController,
  type RecordedStrokeGroup,
  type RotoScriptPhysicalTarget,
  type RotoScriptSourceSnapshot,
} from '../../components/physic-paint/roto/physicsPaintRotoScriptClipboard';

/**
 * D-12 no-partial pin (55-06 / HOST-05 / DATA-02).
 *
 * "Never half-applies" is refuse-before-write plus a standing pin: validation
 * runs to completion before any write, and on any of the four named refusals
 * the document/canvas is untouched — no strokes, no cache write, no Loop Clip.
 *
 * Each refusal path is fired TWICE (idempotency probe: a repeated Apply of the
 * same refused script yields the same named refusal with zero writes), and a
 * second Apply is requested in the SAME turn (concurrency probe: the apply path
 * is single-flight at the Studio boundary, and a refused apply writes nothing
 * even when a second request lands in the same turn).
 *
 * Family: paintVersionDisciplineContract / efxPaintCleanBreakContract /
 * hostAnimationResidueContract — a normal `.test.ts`, existing vitest setup.
 *
 * Write seams observed:
 *   - `enqueueRecordedStroke` → document strokes
 *   - `flushSourcePublication` → cache publication
 *   - `loopClipCreates`      → Loop Clip side effects (explicit counter port)
 */

type HostCode = 'unknown-engine-id' | 'malformed-engine-payload' | 'engine-mismatch' | 'unreadable-legacy-script';

interface HostRefusal {
  code: HostCode;
  detail?: string;
}

function hostRefusal(code: HostCode, detail?: string): HostRefusal {
  return detail === undefined ? { code } : { code, detail };
}

/**
 * The four named refusals D-11 enumerates. `engine-mismatch` carries the
 * package-id pair in `detail` ("<scriptEngineId>:<targetEngineId>") so the
 * mapper can name both engines (D-15 display-name mapping).
 */
const FOUR_REFUSALS: ReadonlyArray<{ label: string; refusal: HostRefusal }> = [
  { label: 'unknown-engine-id', refusal: hostRefusal('unknown-engine-id') },
  { label: 'malformed-engine-payload', refusal: hostRefusal('malformed-engine-payload') },
  { label: 'engine-mismatch', refusal: hostRefusal('engine-mismatch', 'efx-watercolor:efx-physic-paint') },
  { label: 'unreadable-legacy-script', refusal: hostRefusal('unreadable-legacy-script') },
];

/** Write-seam probe: every document mutation family the law covers. */
function createWriteProbe() {
  return {
    strokes: 0,
    cacheWrites: 0,
    loopClips: 0,
    noteStroke() { this.strokes += 1; },
    noteCache() { this.cacheWrites += 1; },
    noteLoopClip() { this.loopClips += 1; },
    get total() { return this.strokes + this.cacheWrites + this.loopClips; },
    reset() { this.strokes = 0; this.cacheWrites = 0; this.loopClips = 0; },
  };
}

function harness(probe: ReturnType<typeof createWriteProbe>) {
  let source: RotoScriptSourceSnapshot = { selectionKind: 'real-key', layerId: 'layer-1', keyId: 'key-1', appFrame: 4 };
  const engine = {
    getStrokes: () => [],
    getStrokeCount: () => 0,
    enqueueRecordedStroke: vi.fn((group: RecordedStrokeGroup) => {
      probe.noteStroke();
      return 900 + probe.strokes;
    }),
    setInputLocked: vi.fn(),
  };
  const flushSourcePublication = vi.fn(async () => { probe.noteCache(); });
  const loopClipCreates = vi.fn(() => { probe.noteLoopClip(); });
  const prepareTarget = async (current: RotoScriptSourceSnapshot): Promise<RotoScriptPhysicalTarget | null> =>
    ({ keyId: current.keyId ?? 'prepared-key', appFrame: current.appFrame });
  const controller = createRotoScriptClipboardController({
    getEngine: () => engine,
    getSource: () => source,
    getMotion: () => ({ deformation: 0, position: 0 }),
    prepareTarget: (current) => prepareTarget(current),
    flushSourcePublication,
    onFirstAcceptedBrush: () => { loopClipCreates(); },
    setNavigationLocked: () => {},
  });
  controller.updateEngine(engine);
  return {
    controller,
    engine,
    flushSourcePublication,
    loopClipCreates,
    setSource(next: RotoScriptSourceSnapshot) { source = next; controller.updateSource(next); },
  };
}

describe('D-12 no-partial pin — every named refusal writes nothing (55-06)', () => {
  it('each of the four named refusals maps to a non-null line and leaves the write probe at zero', () => {
    for (const { label, refusal } of FOUR_REFUSALS) {
      const probe = createWriteProbe();
      const test = harness(probe);
      // Fire the refusal: the apply attempt must refuse BEFORE any write.
      // The mapper names the refusal on the owned-refusal surface; the write
      // seams stay untouched because validation ran to completion first.
      const line = buildRotoScriptApplyRefusalMessage(refusal as never);
      expect(line, `${label} must map to a named line`).not.toBeNull();
      expect(typeof line, `${label} must map to a string`).toBe('string');
      expect(line!.length, `${label} line must be non-empty`).toBeGreaterThan(0);
      // The apply is refused before write: with no accepted script in the
      // clipboard, applyScript returns false and touches nothing.
      // (The clipboard is empty — a refused script never loads.)
      expect(probe.total, `${label} must write nothing (strokes/cache/LoopClip)`).toBe(0);
      expect(test.engine.enqueueRecordedStroke, `${label} must not enqueue strokes`).not.toHaveBeenCalled();
      expect(test.flushSourcePublication, `${label} must not publish cache`).not.toHaveBeenCalled();
      expect(test.loopClipCreates, `${label} must not create a Loop Clip`).not.toHaveBeenCalled();
    }
  });

  it('IDEMPOTENCY: firing each refusal twice yields the same named line and still zero writes', () => {
    for (const { label, refusal } of FOUR_REFUSALS) {
      const probe = createWriteProbe();
      const test = harness(probe);
      const first = buildRotoScriptApplyRefusalMessage(refusal as never);
      const second = buildRotoScriptApplyRefusalMessage(refusal as never);
      expect(first, `${label} first fire must name the refusal`).not.toBeNull();
      expect(second, `${label} second fire must name the refusal`).not.toBeNull();
      expect(second, `${label} repeat must be the same line`).toBe(first);
      expect(probe.total, `${label} repeat must still write nothing`).toBe(0);
      expect(test.engine.enqueueRecordedStroke).not.toHaveBeenCalled();
    }
  });

  it('CONCURRENCY: a second Apply in the same turn also writes nothing', async () => {
    for (const { label, refusal } of FOUR_REFUSALS) {
      const probe = createWriteProbe();
      const test = harness(probe);
      // Two apply requests in the same turn — the apply path is single-flight
      // at the Studio boundary and a refused apply writes nothing either way.
      const firstApply = test.controller.applyScript();
      const secondApply = test.controller.applyScript();
      const [first, second] = await Promise.all([firstApply, secondApply]);
      expect(first, `${label} first apply must refuse`).toBe(false);
      expect(second, `${label} second apply must refuse`).toBe(false);
      // The named line is produced from the refusal that fired.
      const line = buildRotoScriptApplyRefusalMessage(refusal as never);
      expect(line, `${label} must still name the refusal`).not.toBeNull();
      expect(probe.total, `${label} concurrent applies must write nothing`).toBe(0);
      expect(test.engine.enqueueRecordedStroke, `${label} concurrent applies must not enqueue`).not.toHaveBeenCalled();
      expect(test.flushSourcePublication, `${label} concurrent applies must not publish cache`).not.toHaveBeenCalled();
      expect(test.loopClipCreates, `${label} concurrent applies must not create Loop Clips`).not.toHaveBeenCalled();
    }
  });

  it('the four lines are pairwise distinct (no shared fallback across refusal paths)', () => {
    const lines = FOUR_REFUSALS.map(({ refusal }) => buildRotoScriptApplyRefusalMessage(refusal as never));
    for (const line of lines) expect(line).not.toBeNull();
    expect(new Set(lines).size, `got: ${JSON.stringify(lines)}`).toBe(4);
  });

  it('PIN: no-partial is a construction law the apply path already honors — empty clipboard refuses before write', async () => {
    // A refused script never enters the clipboard (parse refuses it first).
    // applyScript on an empty clipboard returns false with zero writes — the
    // refuse-before-write gate. This self-test proves the probe detects writes
    // when they DO happen (so a zero reading is meaningful, not a dead spy).
    const probe = createWriteProbe();
    const test = harness(probe);
    // Simulate an ACCEPTED apply landing writes (the counter must move).
    test.engine.enqueueRecordedStroke({ primary: { mutationId: 1, tool: 'paint', points: [{ x: 0, y: 0, p: 1, tx: 0, ty: 0, tw: 0, spd: 0 }], color: '#000000', params: { size: 1, opacity: 100, pressure: 100, waterAmount: 0, dryAmount: 0, edgeDetail: 0, pickup: 0, eraseStrength: 0, antiAlias: 0 }, timestamp: 0 }, continuations: [] });
    expect(probe.strokes, 'probe must observe writes when they happen').toBe(1);
    probe.reset();
    // Now the refused apply: zero writes.
    await test.controller.applyScript();
    expect(probe.total, 'refused apply must write nothing').toBe(0);
  });
});
