import { describe, expect, it, vi } from 'vitest';
import type { PhysicPaintLaunchContext } from '../../../types/physicPaint';
import { createEfxPaintDocument, type EfxPaintDocument } from '../../../efx-paint/document/efxPaintDocument';
import { buildPhysicPaintRotoPhysicalRevision, type PhysicPaintRotoPhysicalDocument } from '../roto/physicsPaintRotoPhysicalModel';
import {
  applyPhysicsPaintLaunchContext,
  parseCanonicalPhysicsPaintLaunchValue,
  parsePhysicsPaintLaunchContext,
} from '../bridge/physicsPaintLaunchContext';

function makeLocation(search: string, hash = ''): Location {
  return { search, hash } as Location;
}

const EMPTY_INTERPOLATION = { enabled: false, mode: 'duplicate' } as const;

function makeRotoPhysical(overrides: Partial<PhysicPaintRotoPhysicalDocument> = {}): PhysicPaintRotoPhysicalDocument {
  return {
    capacity: 12,
    realKeyRecords: [],
    groupOverrideRecords: [],
    interpolation: EMPTY_INTERPOLATION,
    scriptMotion: { deformation: 0, position: 0 },
    background: null,
    selectedKeyId: null,
    cursorAppFrame: 4,
    revision: buildPhysicPaintRotoPhysicalRevision([], EMPTY_INTERPOLATION, []),
    loopClips: [],
    incomingInterpolationBreakKeyIds: [],
    ...overrides,
  };
}

function makeLaunchDocument(rotoPhysical: PhysicPaintRotoPhysicalDocument): EfxPaintDocument {
  const document = createEfxPaintDocument('layer-1');
  return {
    ...document,
    tracks: document.tracks.map((track) => track.id === document.activeTrackId
      ? { ...track, rotoPhysical }
      : track),
  };
}

function makeLaunchEnvelope(overrides: Record<string, unknown> = {}) {
  const rotoPhysical = makeRotoPhysical();
  return {
    operationId: 'op-1',
    layerId: 'layer-1',
    project: { name: 'Project', saved: true, contextId: 'opaque-context' },
    startFrame: rotoPhysical.cursorAppFrame as number,
    document: makeLaunchDocument(rotoPhysical),
    ...overrides,
  };
}

function encode(value: unknown): string {
  return encodeURIComponent(JSON.stringify(value));
}

function makeContext(overrides: Partial<PhysicPaintLaunchContext> = {}): PhysicPaintLaunchContext {
  return { layerId: 'layer-1', operationId: 'op-1', startFrame: 4, ...overrides };
}

describe('physicsPaintLaunchContext', () => {
  it('parses canonical encoded Roto launch envelopes while rejecting incomplete or flat input', () => {
    const envelope = makeLaunchEnvelope({
      document: makeLaunchDocument(makeRotoPhysical({ background: { background: 'canvas2', grainStrength: 0.6 } })),
    });
    expect(parsePhysicsPaintLaunchContext(makeLocation(`?context=${encode(envelope)}`))).toMatchObject({
      layerId: 'layer-1',
      startFrame: 4,
      document: {
        version: 1,
        parentLayerId: 'layer-1',
        tracks: [{ rotoPhysical: { background: { background: 'canvas2' } } }],
      },
    });
    // Flat query-param launch contexts are a retired encoding (canonical physical launch cutover) and must be rejected.
    expect(parsePhysicsPaintLaunchContext(makeLocation('?layer=layer-2&op=op-2&frame=7'))).toBeNull();
    expect(parsePhysicsPaintLaunchContext(makeLocation('?layer=layer-2&frame=7'))).toBeNull();
    // Encoded envelopes missing the parent-owned project or the v1.0 document are incomplete.
    expect(parsePhysicsPaintLaunchContext(makeLocation(`?context=${encode({ operationId: 'op-2', layerId: 'layer-2', startFrame: 7 })}`))).toBeNull();
  });

  it('rejects fail-closed document carriers: unknown members and startFrame/cursor mismatch', () => {
    // Unknown document member: parseEfxPaintDocument throws, the carrier is not a launch.
    const unknownMember = makeLaunchEnvelope({
      document: { ...makeLaunchDocument(makeRotoPhysical()), unknownMember: true },
    });
    expect(parsePhysicsPaintLaunchContext(makeLocation(`?context=${encode(unknownMember)}`))).toBeNull();
    // startFrame must equal the carried active-track cursor (canonical cutover contract).
    const mismatchedCursor = makeLaunchEnvelope({ startFrame: 7 });
    expect(parsePhysicsPaintLaunchContext(makeLocation(`?context=${encode(mismatchedCursor)}`))).toBeNull();
  });

  it('parses encoded workflow labels without replacing layer names', () => {
    const encoded = encode(makeLaunchEnvelope({ layerName: 'Ink', workflowLabel: 'PPaint #2' }));
    expect(parsePhysicsPaintLaunchContext(makeLocation(`?context=${encoded}`))).toMatchObject({
      layerId: 'layer-1',
      layerName: 'Ink',
      workflowLabel: 'PPaint #2',
    });
  });

  it('preserves parent-owned project and stable layer display metadata without paths', () => {
    const parsed = parsePhysicsPaintLaunchContext(makeLocation(`?context=${encode(makeLaunchEnvelope({ layerName: 'Ink' }))}`));
    expect(parsed).toMatchObject({ project: { name: 'Project', saved: true, contextId: 'opaque-context' }, layerId: 'layer-1', layerName: 'Ink' });
    expect(JSON.stringify(parsed)).not.toContain('/Users/');
    expect(JSON.stringify(parsed)).not.toContain('authority');
  });

  it('applies launch context and resolved Roto settings only', () => {
    const setters = { setLaunchContext: vi.fn(), setSettings: vi.fn() };
    const settings = { background: 'canvas2' };
    const context = makeContext();
    applyPhysicsPaintLaunchContext(context, setters, () => settings);
    expect(setters.setLaunchContext).toHaveBeenCalledWith(context);
    expect(setters.setSettings).toHaveBeenCalledWith(settings);
  });
});

// ---------------------------------------------------------------------------
// 52.5-01a Task 2 (Q1, T-52.5-08), reshaped (dup-clip-plays-audios-0): the
// closed `documentAudio` launch section — rides ONLY the closed LAUNCH_KEYS,
// validated fail-closed against the exact {revision, clips} set, every entry
// a closed {clipId, assetUrl} ref (unknown key -> null, never a raw payload).
// ---------------------------------------------------------------------------

describe('documentAudio closed launch section (52.5-01a, Q1, T-52.5-08)', () => {
  const DOCUMENT_AUDIO_SECTION = {
    revision: 2,
    clips: [
      { clipId: 'sound-clip-1', assetUrl: 'efxasset://localhost/audio/sound.wav' },
      { clipId: 'sound-clip-2', assetUrl: 'efxasset://localhost/audio/sound.wav' },
    ],
  } as const;
  const AUDIO_PREVIEW_SECTION = { revision: 1, fps: 24, tracks: [] } as const;

  it('accepts a payload carrying documentAudio alongside audioPreview', () => {
    const envelope = makeLaunchEnvelope({
      audioPreview: AUDIO_PREVIEW_SECTION,
      documentAudio: DOCUMENT_AUDIO_SECTION,
    });
    const parsed = parseCanonicalPhysicsPaintLaunchValue(envelope);
    expect(parsed).not.toBeNull();
    expect(parsed?.documentAudio).toEqual(DOCUMENT_AUDIO_SECTION);
  });

  it('rejects a documentAudio section carrying one extra ad-hoc key (fail-closed null)', () => {
    const envelope = makeLaunchEnvelope({
      audioPreview: AUDIO_PREVIEW_SECTION,
      documentAudio: { ...DOCUMENT_AUDIO_SECTION, adHoc: true },
    });
    expect(parseCanonicalPhysicsPaintLaunchValue(envelope)).toBeNull();
  });

  it('keeps a launch without documentAudio unchanged', () => {
    // ONE envelope, parsed twice: each makeLaunchEnvelope call mints fresh
    // document UUIDs, so two envelopes are never byte-comparable.
    const envelope = makeLaunchEnvelope({ audioPreview: AUDIO_PREVIEW_SECTION });
    const parsed = parseCanonicalPhysicsPaintLaunchValue(envelope);
    expect(parsed).not.toBeNull();
    expect(parsed?.documentAudio).toBeUndefined();
    const repeated = parseCanonicalPhysicsPaintLaunchValue(envelope);
    expect(JSON.stringify(parsed)).toBe(JSON.stringify(repeated));
  });
});

// ---------------------------------------------------------------------------
// 261008-ig1 Task 1: the multi-clip `audios[]` list rides INSIDE the document
// carrier (not as a sibling launch key) — a launch envelope carrying two clips
// with a shared sourceId must survive the closed parse, and the retired
// singular `sound` member must fail closed.
// ---------------------------------------------------------------------------

describe('audios list rides the document launch carrier (261008-ig1)', () => {
  function makeAudioClip(id: string): Record<string, unknown> {
    return {
      id,
      sourceId: 'asset-shared-1',
      sourcePath: '/Users/test/Music/sound.wav',
      sourceRevision: 1,
      startFrame: 48,
      inFrame: 12,
      outFrame: 108,
      gain: -10,
      fadeInFrames: 6,
      fadeOutFrames: 12,
      fadeInCurve: 'exponential',
      fadeOutCurve: 'linear',
      enabled: true,
    };
  }

  it('parses a launch document carrying two clips with a shared sourceId, members intact', () => {
    const envelope = makeLaunchEnvelope();
    const document = envelope.document as unknown as Record<string, unknown>;
    document.audios = [makeAudioClip('clip-1'), makeAudioClip('clip-2')];
    const parsed = parseCanonicalPhysicsPaintLaunchValue(envelope);
    expect(parsed).not.toBeNull();
    const audios = (parsed!.document as unknown as { audios?: Record<string, unknown>[] }).audios ?? [];
    expect(audios).toHaveLength(2);
    expect(audios[0].id).toBe('clip-1');
    expect(audios[1].id).toBe('clip-2');
    // Two identities: distinct clip ids, ONE shared imported file.
    expect(audios[0].sourceId).toBe(audios[1].sourceId);
    expect(audios[1].startFrame).toBe(48);
    expect(audios[1].gain).toBe(-10);
    expect(audios[1].fadeOutCurve).toBe('linear');
  });

  it('rejects a launch document carrying the retired singular sound member (fail-closed null)', () => {
    const envelope = makeLaunchEnvelope();
    const document = envelope.document as unknown as Record<string, unknown>;
    document.sound = makeAudioClip('clip-1');
    expect(parseCanonicalPhysicsPaintLaunchValue(envelope)).toBeNull();
  });
});
