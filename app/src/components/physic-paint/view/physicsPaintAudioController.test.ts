import { signal } from '@preact/signals';
import { describe, expect, it, vi } from 'vitest';
import type { DocumentSoundClip } from '../../../efx-paint/document/efxPaintDocument';
import { createEfxPaintDocument } from '../../../efx-paint/document/efxPaintDocument';
import type { DocumentSoundResult } from '../../../stores/efxPaintStore';
import {
  buildDuplicatedSoundClip,
  buildFreshSoundClip,
  buildReplacedSoundClip,
  isValidFadeFrames,
  isValidGain,
  isValidGainDb,
  usePhysicsPaintAudioController,
  type ImportedSoundSource,
} from './physicsPaintAudioController';

// The controller is a plain function over signals (no component lifecycle
// beyond useSignal) — map useSignal to a real signal so it runs outside a
// Preact render (same idiom as the workflow-strip viewport harness).
vi.mock('@preact/signals', async () => {
  const actual = await vi.importActual<typeof import('@preact/signals')>('@preact/signals');
  return { ...actual, useSignal: <Value,>(initial: Value) => actual.signal(initial) };
});

/**
 * 52.5 UAT round 2 — the Document sound field laws. Pure validators + import
 * builders (the controller's commit path is `isValid*` then the selection-
 * scoped store ports, whose own `_isValidSoundClip` accepts any non-negative
 * integer fade). 261008-ig1 Task 2 adds the selection-scoped behavior legs:
 * every commit targets the SELECTED clip, never the list head.
 */

const SOURCE: ImportedSoundSource = {
  sourceId: 'asset-1',
  sourcePath: '/Users/test/Music/sound.wav',
  sourceRevision: 1,
  durationSec: 10,
};

describe('isValidFadeFrames (T-52.5-12 — frames, integer >= 0, NO 99 cap)', () => {
  it('accepts multi-digit frame counts the UAT report could not enter', () => {
    expect(isValidFadeFrames(99)).toBe(true);
    expect(isValidFadeFrames(100)).toBe(true);
    expect(isValidFadeFrames(250)).toBe(true);
    expect(isValidFadeFrames(0)).toBe(true);
  });

  it('rejects fractional and negative entries — the prior value stays', () => {
    expect(isValidFadeFrames(-1)).toBe(false);
    expect(isValidFadeFrames(1.5)).toBe(false);
    expect(isValidFadeFrames(Number.NaN)).toBe(false);
  });
});

describe('isValidGain (signed integer -100..100 store domain)', () => {
  it('accepts the full stored gain range and rejects the edges outside it', () => {
    expect(isValidGain(-100)).toBe(true);
    expect(isValidGain(0)).toBe(true);
    expect(isValidGain(100)).toBe(true);
    expect(isValidGain(101)).toBe(false);
    expect(isValidGain(-101)).toBe(false);
    expect(isValidGain(10.5)).toBe(false);
  });
});

describe('isValidGainDb (261010-bkv UI dB domain)', () => {
  it('accepts integer dB on -20..+20 and rejects off-grid / out-of-range', () => {
    expect(isValidGainDb(-20)).toBe(true);
    expect(isValidGainDb(0)).toBe(true);
    expect(isValidGainDb(20)).toBe(true);
    expect(isValidGainDb(21)).toBe(false);
    expect(isValidGainDb(-21)).toBe(false);
    expect(isValidGainDb(0.5)).toBe(false);
    expect(isValidGainDb(Number.NaN)).toBe(false);
  });
});

describe('import defaults (fresh + replace-with-clamp)', () => {
  it('fresh import spans the source at project fps (10s x 24 = 240 frames)', () => {
    const clip = buildFreshSoundClip(SOURCE, 24);
    expect(clip.startFrame).toBe(0);
    expect(clip.inFrame).toBe(0);
    expect(clip.outFrame).toBe(240);
    expect(clip.slipOffset).toBe(0);
    expect(clip.gain).toBe(0);
    expect(clip.enabled).toBe(true);
    // 261010-ht0 F2/F4: store the already-computed source length; log defaults.
    expect(clip.sourceFrames).toBe(240);
    expect(clip.fadeInCurve).toBe('logarithmic');
    expect(clip.fadeOutCurve).toBe('logarithmic');
  });

  it('replace keeps the current clip stored curves and records the new sourceFrames', () => {
    const current = {
      id: 'sound-clip-1',
      sourceId: 'asset-1',
      sourcePath: '/Users/test/Music/sound.wav',
      sourceRevision: 1,
      startFrame: 0,
      inFrame: 0,
      outFrame: 240,
      sourceFrames: 240,
      slipOffset: 0,
      gain: 0,
      fadeInFrames: 6,
      fadeOutFrames: 12,
      fadeInCurve: 'exponential' as const,
      fadeOutCurve: 'logarithmic' as const,
      enabled: true,
    };
    const clip = buildReplacedSoundClip(current, { ...SOURCE, durationSec: 2 }, 24);
    expect(clip.fadeInCurve).toBe('exponential');
    expect(clip.fadeOutCurve).toBe('logarithmic');
    expect(clip.sourceFrames).toBe(48);
  });

  it('replace keeps position/in-out and clamps outFrame to a shorter source', () => {
    const current = {
      id: 'sound-clip-1',
      sourceId: 'asset-1',
      sourcePath: '/Users/test/Music/sound.wav',
      sourceRevision: 1,
      startFrame: 48,
      inFrame: 12,
      outFrame: 200,
      sourceFrames: 240,
      slipOffset: 0,
      gain: 0,
      fadeInFrames: 0,
      fadeOutFrames: 0,
      fadeInCurve: 'linear' as const,
      fadeOutCurve: 'linear' as const,
      enabled: true,
    };
    const shorter: ImportedSoundSource = { ...SOURCE, durationSec: 2 };
    const clip = buildReplacedSoundClip(current, shorter, 24);
    expect(clip.startFrame).toBe(48);
    expect(clip.inFrame).toBe(12);
    expect(clip.outFrame).toBe(48);
  });

  it('replace preserves slipOffset when the new source can host it, else resets to 0 (261010-en9 R6)', () => {
    const current = {
      id: 'sound-clip-1',
      sourceId: 'asset-1',
      sourcePath: '/Users/test/Music/sound.wav',
      sourceRevision: 1,
      startFrame: 0,
      inFrame: 12,
      outFrame: 200,
      sourceFrames: 240,
      slipOffset: -12,
      gain: 0,
      fadeInFrames: 0,
      fadeOutFrames: 0,
      fadeInCurve: 'linear' as const,
      fadeOutCurve: 'linear' as const,
      enabled: true,
    };
    // 2s x 24 = 48 frames; in 12 / out 48 -> slip window [-12, 0] hosts -12.
    const kept = buildReplacedSoundClip(current, { ...SOURCE, durationSec: 2 }, 24);
    expect(kept.slipOffset).toBe(-12);
    // 0.5s x 24 = 12 frames; the folded tail span cannot host -12 -> 0.
    const reset = buildReplacedSoundClip(current, { ...SOURCE, durationSec: 0.5 }, 24);
    expect(reset.slipOffset).toBe(0);
  });

  it('replace on a source shorter than the in point folds to a 1-frame tail span', () => {
    const current = {
      id: 'sound-clip-1',
      sourceId: 'asset-1',
      sourcePath: '/Users/test/Music/sound.wav',
      sourceRevision: 1,
      startFrame: 0,
      inFrame: 100,
      outFrame: 120,
      sourceFrames: 240,
      slipOffset: 0,
      gain: 0,
      fadeInFrames: 0,
      fadeOutFrames: 0,
      fadeInCurve: 'linear' as const,
      fadeOutCurve: 'linear' as const,
      enabled: true,
    };
    const shorter: ImportedSoundSource = { ...SOURCE, durationSec: 1 };
    const clip = buildReplacedSoundClip(current, shorter, 24);
    expect(clip.inFrame).toBe(23);
    expect(clip.outFrame).toBe(24);
  });
});

/* ---------------------------------------------------------------------------
 * 261008-ig1 Task 2 — selection-scoped controller behavior. The controller
 * resolves the edited clip by `selectedSoundId` (never the list head) and
 * routes every mutation through the per-clip ports. Faked ports + a real
 * selection signal: the legs assert the ROUTING, not the store internals
 * (the store door is pinned in efxPaintStore.test.ts).
 * ------------------------------------------------------------------------- */

const CLIP_A: DocumentSoundClip = {
  id: 'clip-a',
  sourceId: 'src-a',
  sourcePath: '/Users/test/Music/a.wav',
  sourceRevision: 0,
  startFrame: 0,
  inFrame: 0,
  outFrame: 48,
  sourceFrames: 240,
  slipOffset: 0,
  gain: 0,
  fadeInFrames: 0,
  fadeOutFrames: 0,
  fadeInCurve: 'linear',
  fadeOutCurve: 'linear',
  enabled: true,
};

const CLIP_B: DocumentSoundClip = {
  ...CLIP_A,
  id: 'clip-b',
  // D-02: the second placed clip of the SAME imported file.
  startFrame: 96,
  outFrame: 144,
  gain: -25,
  enabled: false,
};

function makeController(options: {
  selection: string | null;
  clips?: readonly DocumentSoundClip[] | null;
  getTimelineViewport?: () => { visStart: number; visEnd: number } | null;
}) {
  const clips = options.clips === undefined ? [CLIP_A, CLIP_B] : options.clips;
  const document = clips === null
    ? undefined
    : { ...createEfxPaintDocument('layer-1'), audios: clips };
  const selectedSoundId = signal<string | null>(options.selection);
  const addSound = vi.fn((_layerId: string, _clip: DocumentSoundClip): DocumentSoundResult => ({ ok: true }));
  const patchSound = vi.fn((_layerId: string, _clipId: string, _patch: Partial<DocumentSoundClip>): DocumentSoundResult => ({ ok: true }));
  const removeSound = vi.fn((_layerId: string, _clipId: string): DocumentSoundResult => ({ ok: true }));
  const getTimelineViewport = options.getTimelineViewport ?? (() => null);
  const controller = usePhysicsPaintAudioController({
    layerId: 'layer-1',
    selectedSoundId,
    ports: {
      getDocument: () => document,
      addSound,
      patchSound,
      removeSound,
      getFps: () => 24,
      isSoundMissing: () => false,
      getTimelineViewport,
    },
  });
  return { controller, selectedSoundId, addSound, patchSound, removeSound };
}

describe('usePhysicsPaintAudioController — selection-scoped commits (261008-ig1 Task 2)', () => {
  it('resolves the editor clip from the selection, never the list head', () => {
    const second = makeController({ selection: 'clip-b' });
    expect(second.controller.sound?.id).toBe('clip-b');
    expect(second.controller.audios.map((clip) => clip.id)).toEqual(['clip-a', 'clip-b']);

    const none = makeController({ selection: null });
    expect(none.controller.sound).toBeNull();
    // The list stays visible even with no selection (the modal list chooser).
    expect(none.controller.audios).toHaveLength(2);
  });

  it('(261009-ofk) the controller exposes isSoundMissing wired to the port and the port default is false', () => {
    // Default port: always false (not probed -> present).
    const defaultController = makeController({ selection: 'clip-a' });
    expect(defaultController.controller.isSoundMissing).toBeTypeOf('function');
    expect(defaultController.controller.isSoundMissing(CLIP_A)).toBe(false);
    expect(defaultController.controller.isSoundMissing(CLIP_B)).toBe(false);
  });

  it('commitGain speaks dB and patches ONLY the selected clip with integer gain', () => {
    const { controller, patchSound } = makeController({ selection: 'clip-b' });
    // +10 dB -> stored gain +50 (dbToGain).
    controller.commitGain(10);
    expect(patchSound).toHaveBeenCalledTimes(1);
    expect(patchSound).toHaveBeenCalledWith('layer-1', 'clip-b', { gain: 50 });
  });

  it('commitGain rejects dB outside -20..+20 and non-grid values — the prior value stays', () => {
    for (const bad of [21, -21, 0.5, Number.NaN]) {
      const { controller, patchSound } = makeController({ selection: 'clip-a' });
      controller.commitGain(bad);
      expect(patchSound).not.toHaveBeenCalled();
    }
  });

  it('previewGain shows dB for the stored integer gain', () => {
    const { controller } = makeController({ selection: 'clip-b' });
    // CLIP_B.gain = -25 -> -5 dB.
    expect(controller.previewGain).toBe(-5);
  });

  it('commitStartFrame patches { startFrame } on the SELECTED clip through the per-clip door (261008-ryq)', () => {
    const { controller, patchSound } = makeController({ selection: 'clip-b' });
    controller.commitStartFrame(42);
    expect(patchSound).toHaveBeenCalledTimes(1);
    expect(patchSound).toHaveBeenCalledWith('layer-1', 'clip-b', { startFrame: 42 });
  });

  it('commitStartFrame rejects negative, fractional, and NaN entries — the prior value stays (261008-ryq)', () => {
    for (const bad of [-1, 2.5, Number.NaN]) {
      const { controller, patchSound } = makeController({ selection: 'clip-a' });
      controller.commitStartFrame(bad);
      expect(patchSound).not.toHaveBeenCalled();
    }
  });

  it('commitStartFrame fails closed with null/unknown selection and has NO upper clamp (261008-ryq)', () => {
    const none = makeController({ selection: null });
    none.controller.commitStartFrame(42);
    expect(none.patchSound).not.toHaveBeenCalled();

    const unknown = makeController({ selection: 'clip-zzz' });
    unknown.controller.commitStartFrame(42);
    expect(unknown.patchSound).not.toHaveBeenCalled();

    const big = makeController({ selection: 'clip-a' });
    big.controller.commitStartFrame(1000000);
    expect(big.patchSound).toHaveBeenCalledTimes(1);
    expect(big.patchSound).toHaveBeenCalledWith('layer-1', 'clip-a', { startFrame: 1000000 });
  });

  it('commitSlipOffset patches { slipOffset } clamped to the source window (261010-en9 R6)', () => {
    const { controller, patchSound } = makeController({ selection: 'clip-a' });
    // CLIP_A in 0 / out 48; sourceFrames falls back to outFrame -> slip window [0, 0].
    controller.commitSlipOffset(-12);
    expect(patchSound).toHaveBeenCalledWith('layer-1', 'clip-a', { slipOffset: 0 });
  });

  it('commitSlipOffset rejects non-integer entries and fails closed with no selection', () => {
    for (const bad of [1.5, Number.NaN]) {
      const { controller, patchSound } = makeController({ selection: 'clip-a' });
      controller.commitSlipOffset(bad);
      expect(patchSound).not.toHaveBeenCalled();
    }
    const none = makeController({ selection: null });
    none.controller.commitSlipOffset(3);
    expect(none.patchSound).not.toHaveBeenCalled();
  });

  it('commitFitToView writes in/out/start/slip in ONE commitPatch (261010-ht0 F5)', () => {
    // CLIP_A: start 0, in 0, out 48, sourceFrames 240. Visible slice [10, 30]
    // crops the bar to that intersection: new in = 10, new out = 30,
    // new start = 10, slip resets to 0.
    const { controller, patchSound } = makeController({
      selection: 'clip-a',
      getTimelineViewport: () => ({ visStart: 10, visEnd: 30 }),
    });
    controller.commitFitToView();
    expect(patchSound).toHaveBeenCalledTimes(1);
    expect(patchSound).toHaveBeenCalledWith('layer-1', 'clip-a', {
      inFrame: 10,
      outFrame: 30,
      startFrame: 10,
      slipOffset: 0,
    });
  });

  it('commitFitToView is a no-op when the viewport port returns null or the band is fully visible', () => {
    const nullPort = makeController({
      selection: 'clip-a',
      getTimelineViewport: () => null,
    });
    nullPort.controller.commitFitToView();
    expect(nullPort.patchSound).not.toHaveBeenCalled();

    // Bar spans 0..48; a viewport covering 0..100 is fully visible -> null fit.
    const fullyVisible = makeController({
      selection: 'clip-a',
      getTimelineViewport: () => ({ visStart: 0, visEnd: 100 }),
    });
    fullyVisible.controller.commitFitToView();
    expect(fullyVisible.patchSound).not.toHaveBeenCalled();

    // Empty intersection (viewport entirely past the bar) -> no write.
    const empty = makeController({
      selection: 'clip-a',
      getTimelineViewport: () => ({ visStart: 100, visEnd: 200 }),
    });
    empty.controller.commitFitToView();
    expect(empty.patchSound).not.toHaveBeenCalled();
  });

  it('commitFitToView fails closed with no selection', () => {
    const { controller, patchSound } = makeController({
      selection: null,
      getTimelineViewport: () => ({ visStart: 0, visEnd: 10 }),
    });
    controller.commitFitToView();
    expect(patchSound).not.toHaveBeenCalled();
  });

  it('field commits fail closed with no selection — no port call, no mutation', () => {
    const { controller, patchSound, removeSound } = makeController({ selection: null });
    controller.commitGain(10);
    controller.commitFadeIn(12);
    controller.toggleEnabled();
    controller.confirmRemove();
    expect(patchSound).not.toHaveBeenCalled();
    expect(removeSound).not.toHaveBeenCalled();
  });

  it('field commits fail closed when the selection points at an unknown clip', () => {
    const { controller, patchSound } = makeController({ selection: 'clip-zzz' });
    controller.commitGain(10);
    expect(patchSound).not.toHaveBeenCalled();
  });

  it('confirmRemove removes only the selected entry and clears the selection', () => {
    const { controller, selectedSoundId, removeSound } = makeController({ selection: 'clip-b' });
    controller.requestRemove();
    controller.confirmRemove();
    expect(removeSound).toHaveBeenCalledTimes(1);
    expect(removeSound).toHaveBeenCalledWith('layer-1', 'clip-b');
    expect(selectedSoundId.value).toBeNull();
  });

  it('confirmRemove deletes the ARMED clip, not whatever is selected at confirm time', () => {
    // HIGH-01: the no-backdrop dialog lets a band press re-target selection
    // mid-arm. Arm A, select B, confirm -> nothing is deleted (fail closed),
    // and B survives.
    const { controller, selectedSoundId, removeSound } = makeController({ selection: 'clip-a' });
    controller.requestRemove();
    expect(controller.removeArmed).toBe(true);

    // Selection moves mid-arm (band press in the strip, modal row click, …).
    selectedSoundId.value = 'clip-b';
    controller.confirmRemove();
    expect(removeSound).not.toHaveBeenCalled();

    // A mismatched confirm consumes the arm outright — no stale arm left.
    selectedSoundId.value = 'clip-a';
    controller.confirmRemove();
    expect(removeSound).not.toHaveBeenCalled();
  });

  it('confirmRemove still removes the armed clip when the selection is unchanged', () => {
    const { controller, selectedSoundId, removeSound } = makeController({ selection: 'clip-a' });
    controller.requestRemove();
    controller.confirmRemove();
    expect(removeSound).toHaveBeenCalledTimes(1);
    expect(removeSound).toHaveBeenCalledWith('layer-1', 'clip-a');
    expect(selectedSoundId.value).toBeNull();
  });

  it('removeSelected one-shots the selected clip — one removeSound, selection and arm cleared, no arm involved (261008-ryq)', () => {
    const { controller, selectedSoundId, removeSound } = makeController({ selection: 'clip-b' });
    expect(controller.removeArmed).toBe(false);
    controller.removeSelected();
    expect(removeSound).toHaveBeenCalledTimes(1);
    expect(removeSound).toHaveBeenCalledWith('layer-1', 'clip-b');
    expect(selectedSoundId.value).toBeNull();
    expect(controller.removeArmed).toBe(false);
  });

  it('removeSelected no-ops with a null or unknown selection — no port call (261008-ryq)', () => {
    const none = makeController({ selection: null });
    none.controller.removeSelected();
    expect(none.removeSound).not.toHaveBeenCalled();
    expect(none.selectedSoundId.value).toBeNull();

    const unknown = makeController({ selection: 'clip-zzz' });
    unknown.controller.removeSelected();
    expect(unknown.removeSound).not.toHaveBeenCalled();
  });

  it('requestRemove arms the LIVE selection written after render — list-row select + arm in one click (261008-ryq)', () => {
    // Render with null selection (the render-time `sound` snapshot is null),
    // then the row handler writes the selection and arms in the SAME click.
    const { controller, selectedSoundId, removeSound } = makeController({ selection: null });
    selectedSoundId.value = 'clip-b';
    controller.requestRemove();
    expect(controller.removeArmed).toBe(true);
    controller.confirmRemove();
    expect(removeSound).toHaveBeenCalledTimes(1);
    expect(removeSound).toHaveBeenCalledWith('layer-1', 'clip-b');
    expect(selectedSoundId.value).toBeNull();
  });

  it('requestRemove still fails closed with a null or unknown live selection (261008-ryq)', () => {
    const none = makeController({ selection: null });
    none.controller.requestRemove();
    expect(none.controller.removeArmed).toBe(false);
    none.controller.confirmRemove();
    expect(none.removeSound).not.toHaveBeenCalled();

    const unknown = makeController({ selection: 'clip-zzz' });
    unknown.controller.requestRemove();
    expect(unknown.controller.removeArmed).toBe(false);
  });

  it('applyImportedSource appends a fresh clip and selects it', () => {
    const { controller, selectedSoundId, addSound } = makeController({ selection: 'clip-a' });
    const result = controller.applyImportedSource({
      sourceId: 'asset-9',
      sourcePath: '/Users/test/Music/new.wav',
      sourceRevision: 2,
      durationSec: 10,
    });
    expect(result.ok).toBe(true);
    expect(addSound).toHaveBeenCalledTimes(1);
    const added = addSound.mock.calls[0][1];
    expect(added.id).not.toBe(CLIP_A.id);
    expect(added.id).not.toBe(CLIP_B.id);
    expect(added.sourceId).toBe('asset-9');
    expect(added.outFrame).toBe(240); // 10s x 24fps
    expect(selectedSoundId.value).toBe(added.id);
  });

  it('applyReplacedSource swaps only the selected clip, preserving position and in/out', () => {
    const { controller, patchSound, addSound } = makeController({ selection: 'clip-a' });
    const result = controller.applyReplacedSource({
      sourceId: 'asset-new',
      sourcePath: '/Users/test/Music/new.wav',
      sourceRevision: 3,
      durationSec: 10, // longer than the clip span — clamps keep 0..48
    });
    expect(result.ok).toBe(true);
    expect(addSound).not.toHaveBeenCalled();
    expect(patchSound).toHaveBeenCalledTimes(1);
    expect(patchSound).toHaveBeenCalledWith('layer-1', 'clip-a', {
      sourceId: 'asset-new',
      sourcePath: '/Users/test/Music/new.wav',
      sourceRevision: 3,
      inFrame: 0,
      outFrame: 48,
    });
  });

  it('fails closed with no document — no port call', () => {
    const { controller, addSound, patchSound, removeSound } = makeController({
      selection: 'clip-a',
      clips: null,
    });
    expect(controller.sound).toBeNull();
    expect(controller.audios).toEqual([]);
    controller.commitGain(10);
    controller.confirmRemove();
    expect(controller.applyImportedSource(SOURCE).ok).toBe(false);
    expect(patchSound).not.toHaveBeenCalled();
    expect(removeSound).not.toHaveBeenCalled();
    expect(addSound).not.toHaveBeenCalled();
  });
});

/* ---------------------------------------------------------------------------
 * 261008-ig1 Task 3 — D-03 alt+drag duplication: the duplicate builder mints a
 * fresh id and SHARES the source identity (sourceId/sourcePath verbatim —
 * peaks + gallery stay source-keyed, so no second decode, bytes copy, gallery
 * row, or audio/ path is created), copies every setting, and never mutates the
 * origin (T-261008-IG1-05). The shared-source render itself is pinned by the
 * Task 2 multi-clip leg (two stains, ONE audioPeaksCache entry).
 * ------------------------------------------------------------------------- */

describe('buildDuplicatedSoundClip (261008-ig1 Task 3 — fresh id, shared source, copied settings)', () => {
  it('mints a fresh id and copies every other member byte-for-byte', () => {
    const duplicate = buildDuplicatedSoundClip(CLIP_A);
    expect(duplicate.id).not.toBe(CLIP_A.id);
    // Round-trip: identical to the origin once the fresh id is put back.
    expect({ ...duplicate, id: CLIP_A.id }).toEqual(CLIP_A);
    // D-02/D-03: source identity is SHARED, never overloaded onto the id.
    expect(duplicate.sourceId).toBe(CLIP_A.sourceId);
    expect(duplicate.sourcePath).toBe(CLIP_A.sourcePath);
    expect(duplicate.sourceRevision).toBe(CLIP_A.sourceRevision);
    // Geometry + settings are value copies.
    expect(duplicate.startFrame).toBe(CLIP_A.startFrame);
    expect(duplicate.inFrame).toBe(CLIP_A.inFrame);
    expect(duplicate.outFrame).toBe(CLIP_A.outFrame);
    expect(duplicate.gain).toBe(CLIP_A.gain);
    expect(duplicate.fadeInFrames).toBe(CLIP_A.fadeInFrames);
    expect(duplicate.fadeOutFrames).toBe(CLIP_A.fadeOutFrames);
    expect(duplicate.fadeInCurve).toBe(CLIP_A.fadeInCurve);
    expect(duplicate.fadeOutCurve).toBe(CLIP_A.fadeOutCurve);
    expect(duplicate.enabled).toBe(CLIP_A.enabled);
  });

  it('never mutates the origin and never collides across calls (T-261008-IG1-05)', () => {
    const before = JSON.stringify(CLIP_A);
    const first = buildDuplicatedSoundClip(CLIP_A);
    const second = buildDuplicatedSoundClip(CLIP_A);
    expect(JSON.stringify(CLIP_A)).toBe(before);
    expect(first.id).not.toBe(second.id);
    expect(first.id).not.toBe(CLIP_A.id);
    expect(second.id).not.toBe(CLIP_A.id);
  });
});
