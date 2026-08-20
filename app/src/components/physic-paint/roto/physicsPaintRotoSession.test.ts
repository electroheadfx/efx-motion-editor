import { describe, expect, it } from 'vitest';
import type { PhysicPaintRotoCacheFrame } from '../../../types/physicPaint';
import {
  createRotoSession,
  isRotoSessionCopiedKeyGroup,
  type RotoSessionCopiedGroupEntry,
  type RotoSessionCopiedKeyGroup,
  type RotoSessionInput,
} from './physicsPaintRotoSession';

/**
 * Post-UAT regression anchors for the group clipboard contract approved in
 * the user-owned 38-06 UAT: D-01 capture, D-02 shared slot, D-03 immutability.
 */

function buildCacheFrame(appFrame: number): PhysicPaintRotoCacheFrame {
  return {
    frameIndex: 0,
    appFrame,
    dataUrl: 'data:image/png;base64,AAAA',
    width: 2,
    height: 2,
    source: 'real-key',
  };
}

function buildGroupEntries(): readonly RotoSessionCopiedGroupEntry[] {
  return [
    {
      payload: { frameIndex: 0, appFrame: 1, dataUrl: 'data:image/png;base64,AAAA', width: 2, height: 2 },
      sourceAppFrame: 1,
      sourceKeyId: 'A',
    },
    {
      payload: { frameIndex: 0, appFrame: 5, dataUrl: 'data:image/png;base64,AAAA', width: 2, height: 2 },
      sourceAppFrame: 5,
      sourceKeyId: 'C',
    },
  ];
}

function buildSession(overrides: Partial<RotoSessionInput> = {}) {
  return createRotoSession({
    currentFrame: 1,
    realKeyFrames: [buildCacheFrame(1)],
    buildBlankRotoFrame: (appFrame) => buildCacheFrame(appFrame),
    ...overrides,
  });
}

describe('copyKeyGroup — group clipboard capture (D-01/D-03)', () => {
  it('captures a frozen group in input order with verbatim feedback', () => {
    const session = buildSession();
    const entries = buildGroupEntries();

    expect(session.copyKeyGroup(entries)).toEqual({
      action: 'copyKeyGroup',
      ok: true,
      message: 'Copied 2 keys',
      effects: [],
    });
    const copied = session.copiedKey.value;
    expect(isRotoSessionCopiedKeyGroup(copied)).toBe(true);
    if (!isRotoSessionCopiedKeyGroup(copied)) throw new Error('group copy must populate the group clipboard shape');
    expect(copied.entries).toEqual(entries);
    expect(copied.entries[0].payload).toBe(entries[0].payload);
    expect(copied.entries.map(({ sourceAppFrame, sourceKeyId }) => ({ sourceAppFrame, sourceKeyId }))).toEqual([
      { sourceAppFrame: 1, sourceKeyId: 'A' },
      { sourceAppFrame: 5, sourceKeyId: 'C' },
    ]);
    expect(Object.isFrozen(copied)).toBe(true);
    expect(Object.isFrozen(copied.entries)).toBe(true);
  });

  it('fails closed for an empty group without replacing the prior clipboard', () => {
    const session = buildSession();
    session.copyKeyGroup(buildGroupEntries());
    const previous = session.copiedKey.value;

    expect(session.copyKeyGroup([])).toMatchObject({
      action: 'copyKeyGroup',
      ok: false,
      message: 'Select at least two real Roto keys to copy.',
      effects: [],
    });
    expect(session.copiedKey.value).toBe(previous);
  });

  it('fails closed for a one-entry group without replacing the prior clipboard', () => {
    const session = buildSession();
    const entries = buildGroupEntries();
    session.copyKeyGroup(entries);
    const previous = session.copiedKey.value;

    expect(session.copyKeyGroup([entries[0]])).toMatchObject({
      action: 'copyKeyGroup',
      ok: false,
      message: 'Select at least two real Roto keys to copy.',
      effects: [],
    });
    expect(session.copiedKey.value).toBe(previous);
  });
});

describe('clipboard slot overwrite — one shared slot (D-02)', () => {
  it('replaces a single-key clipboard with a group clipboard', () => {
    const session = buildSession();
    expect(session.copyKey().ok).toBe(true);
    expect(isRotoSessionCopiedKeyGroup(session.copiedKey.value)).toBe(false);

    expect(session.copyKeyGroup(buildGroupEntries()).ok).toBe(true);
    expect(isRotoSessionCopiedKeyGroup(session.copiedKey.value)).toBe(true);
  });

  it('replaces a group clipboard with the single-key shape', () => {
    const session = buildSession();
    expect(session.copyKeyGroup(buildGroupEntries()).ok).toBe(true);

    expect(session.copyKey().ok).toBe(true);
    const copied = session.copiedKey.value;
    expect(isRotoSessionCopiedKeyGroup(copied)).toBe(false);
    expect(copied).toEqual({ frame: 1, cachedFrame: buildCacheFrame(1) });
  });
});

describe('isRotoSessionCopiedKeyGroup — union narrowing', () => {
  it('distinguishes null, single, and group clipboard values', () => {
    const entries = buildGroupEntries();
    const group: RotoSessionCopiedKeyGroup = { kind: 'group', entries };

    expect(isRotoSessionCopiedKeyGroup(null)).toBe(false);
    expect(isRotoSessionCopiedKeyGroup({ frame: 1, cachedFrame: buildCacheFrame(1) })).toBe(false);
    expect(isRotoSessionCopiedKeyGroup(group)).toBe(true);
  });
});

describe('createRotoSession — group clipboard input normalization', () => {
  it('passes a well-formed group through unchanged', () => {
    const group: RotoSessionCopiedKeyGroup = { kind: 'group', entries: buildGroupEntries() };
    const session = buildSession({ copiedKey: group });

    expect(session.copiedKey.value).toBe(group);
  });

  it('normalizes a one-entry group to null', () => {
    const group: RotoSessionCopiedKeyGroup = { kind: 'group', entries: [buildGroupEntries()[0]] };

    expect(buildSession({ copiedKey: group }).copiedKey.value).toBeNull();
  });

  it('normalizes a group with a fractional source appFrame to null', () => {
    const entries = buildGroupEntries();
    const group: RotoSessionCopiedKeyGroup = {
      kind: 'group',
      entries: [{ ...entries[0], sourceAppFrame: 1.5 }, entries[1]],
    };

    expect(buildSession({ copiedKey: group }).copiedKey.value).toBeNull();
  });
});

describe('actionAvailability — shape-agnostic paste availability', () => {
  it('derives the same paste availability from single and group clipboard shapes', () => {
    const singleSession = buildSession();
    const groupSession = buildSession();
    singleSession.copyKey();
    groupSession.copyKeyGroup(buildGroupEntries());

    expect(groupSession.actionAvailability.value.hasCopiedRotoKey).toBe(true);
    expect(groupSession.actionAvailability.value.canPaste).toBe(singleSession.actionAvailability.value.canPaste);
    expect(groupSession.actionAvailability.value.pasteDisabledReason)
      .toBe(singleSession.actionAvailability.value.pasteDisabledReason);
  });
});

describe('rail-set clipboard — copyRailSet variant (quick 260820-bjw)', () => {
  // Structural guard (Task 2 exposes the real isRotoSessionCopiedRailSet export;
  // RED keeps the file importable with the feature absent).
  const isRailSetVariant = (value: unknown): boolean => (
    typeof value === 'object' && value !== null
    && (value as { kind?: unknown }).kind === 'rail-set'
  );

  const buildRailPayload = () => ({
    anchorAppFrame: 0,
    members: [{
      kind: 'key-rail' as const,
      firstKeyId: 'k0',
      firstKeyFrame: 0,
      firstKeyOwnsIncomingBreak: false,
      entries: [{
        sourceKeyId: 'k0',
        sourceAppFrame: 0,
        ownsIncomingBreak: false,
        payload: { frameIndex: 0, appFrame: 0, dataUrl: 'data:image/png;base64,AAAA', width: 2, height: 2 },
      }],
    }],
  });

  it('RED: copyRailSet stores the rail-set payload as a third clipboard variant', () => {
    const session = buildSession();
    const payload = buildRailPayload();
    const result = session.copyRailSet(payload);
    expect(result.ok).toBe(true);
    const copied = session.copiedKey.value;
    expect(copied).not.toBeNull();
    expect(isRailSetVariant(copied)).toBe(true);
    if (!isRailSetVariant(copied)) throw new Error('rail-set copy must populate the rail variant');
    expect(copied.payload).toEqual(payload);
  });

  it('RED: a rail-set copy overwrites the shared clipboard slot (one slot contract)', () => {
    const session = buildSession();
    session.copyKey();
    expect(session.copyRailSet(buildRailPayload()).ok).toBe(true);
    expect(isRailSetVariant(session.copiedKey.value)).toBe(true);
  });

  it('RED: the rail-set clipboard survives normalization (normalizeCopiedKey rail branch)', () => {
    const payload = buildRailPayload();
    const rebuilt = buildSession({ copiedKey: { kind: 'rail-set', payload } });
    const copied = rebuilt.copiedKey.value;
    expect(isRailSetVariant(copied)).toBe(true);
    if (!isRailSetVariant(copied)) throw new Error('rail clipboard must survive normalization');
    expect(copied.payload).toEqual(payload);
  });
});
