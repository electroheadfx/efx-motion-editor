import { describe, expect, it, vi } from 'vitest';
import {
  SCRIPT_BASE_UNKNOWN_REASON,
  resolveScriptBase,
  type ScriptBaseEntry,
  type ScriptBaseLookup,
  type ScriptBaseResolution,
} from './aquarelleScriptBaseAuthority';

function bytes(label: string): ArrayBuffer {
  const encoded = new TextEncoder().encode(label);
  const buffer = new ArrayBuffer(encoded.byteLength);
  new Uint8Array(buffer).set(encoded);
  return buffer;
}

function decode(buffer: ArrayBuffer): string {
  return new TextDecoder().decode(new Uint8Array(buffer));
}

interface LookupSeed {
  readonly persisted?: ReadonlyMap<string, ScriptBaseEntry>;
  readonly session?: ReadonlyMap<string, ScriptBaseEntry>;
  readonly recordedStrokes?: readonly string[];
  readonly payloads?: ReadonlyMap<string, ArrayBuffer | null | undefined>;
  readonly revealKeys?: readonly string[];
}

function makeLookup(seed: LookupSeed = {}) {
  const recorded = new Set(seed.recordedStrokes ?? []);
  const reveal = new Set(seed.revealKeys ?? []);
  const probes = {
    persisted: vi.fn((keyId: string) => seed.persisted?.get(keyId)),
    session: vi.fn((keyId: string) => seed.session?.get(keyId)),
    recorded: vi.fn((keyId: string) => recorded.has(keyId)),
    payload: vi.fn((keyId: string) => seed.payloads?.get(keyId)),
    reveal: vi.fn((keyId: string) => reveal.has(keyId)),
  };
  const lookup: ScriptBaseLookup = Object.freeze({
    persistedDurableBase: probes.persisted,
    sessionDurableBase: probes.session,
    hasRecordedStrokes: probes.recorded,
    currentPayload: probes.payload,
    isRevealKey: probes.reveal,
  });
  return { lookup, probes };
}

function expectBytes(result: ScriptBaseResolution, label: string, persistPin: boolean): void {
  expect(result.ok).toBe(true);
  if (!result.ok || result.kind !== 'bytes') throw new Error(`expected bytes, got ${JSON.stringify(result)}`);
  expect(decode(result.bytes)).toBe(label);
  expect(result.persistPin).toBe(persistPin);
}

describe('resolveScriptBase resolution order', () => {
  it('returns the persisted bytes and never consults the session map or the payload', () => {
    const base = bytes('persisted-base');
    const { lookup, probes } = makeLookup({
      persisted: new Map([['key-1', { bytes: base }]]),
      session: new Map([['key-1', { bytes: bytes('session-base') }]]),
      payloads: new Map([['key-1', bytes('current-payload')]]),
      recordedStrokes: ['key-1'],
    });

    const result = resolveScriptBase('key-1', lookup);

    expectBytes(result, 'persisted-base', false);
    expect(probes.session).not.toHaveBeenCalled();
    expect(probes.payload).not.toHaveBeenCalled();
    expect(probes.recorded).not.toHaveBeenCalled();
    // The resolved buffer IS the persisted buffer — no copy, no re-encode.
    if (result.ok && result.kind === 'bytes') expect(result.bytes).toBe(base);
  });

  it('returns known-empty for a persisted null entry and ignores a session bytes entry', () => {
    const { lookup, probes } = makeLookup({
      persisted: new Map([['key-1', { bytes: null }]]),
      session: new Map([['key-1', { bytes: bytes('session-base') }]]),
      payloads: new Map([['key-1', bytes('current-payload')]]),
    });

    const result = resolveScriptBase('key-1', lookup);

    expect(result).toEqual({ ok: true, kind: 'known-empty', persistPin: false });
    expect(probes.session).not.toHaveBeenCalled();
    expect(probes.payload).not.toHaveBeenCalled();
  });

  it('uses the session bytes when no persisted entry exists', () => {
    const { lookup } = makeLookup({
      session: new Map([['key-1', { bytes: bytes('recovered-base') }]]),
      payloads: new Map([['key-1', bytes('current-payload')]]),
    });

    expectBytes(resolveScriptBase('key-1', lookup), 'recovered-base', false);
  });

  it('returns known-empty for a session null entry without falling through to the payload', () => {
    const { lookup, probes } = makeLookup({
      session: new Map([['key-1', { bytes: null }]]),
      payloads: new Map([['key-1', bytes('current-payload')]]),
    });

    expect(resolveScriptBase('key-1', lookup)).toEqual({ ok: true, kind: 'known-empty', persistPin: false });
    expect(probes.payload).not.toHaveBeenCalled();
  });

  it('pins the current payload when the key has no recorded strokes and no stored base', () => {
    const payload = bytes('pre-script-pixels');
    const { lookup } = makeLookup({ payloads: new Map([['key-1', payload]]) });

    const result = resolveScriptBase('key-1', lookup);

    expectBytes(result, 'pre-script-pixels', true);
    if (result.ok && result.kind === 'bytes') expect(result.bytes).toBe(payload);
  });

  it('pins known-empty when the key has no recorded strokes and the payload is null', () => {
    const { lookup } = makeLookup({ payloads: new Map([['key-1', null]]) });

    expect(resolveScriptBase('key-1', lookup)).toEqual({ ok: true, kind: 'known-empty', persistPin: true });
  });

  it('pins known-empty when the key has no recorded strokes and no payload entry exists', () => {
    const { lookup } = makeLookup();

    expect(resolveScriptBase('key-1', lookup)).toEqual({ ok: true, kind: 'known-empty', persistPin: true });
  });

  it('fails closed when the key has recorded strokes, even though a payload exists', () => {
    const { lookup, probes } = makeLookup({
      recordedStrokes: ['key-1'],
      payloads: new Map([['key-1', bytes('flattened-composite')]]),
    });

    expect(resolveScriptBase('key-1', lookup)).toEqual({ ok: false, reason: SCRIPT_BASE_UNKNOWN_REASON });
    // The payload is never even read: a scripted key can never supply its own base.
    expect(probes.payload).not.toHaveBeenCalled();
  });

  it('fails closed when the key has recorded strokes and no payload entry', () => {
    const { lookup } = makeLookup({ recordedStrokes: ['key-1'] });

    expect(resolveScriptBase('key-1', lookup)).toEqual({ ok: false, reason: SCRIPT_BASE_UNKNOWN_REASON });
  });

  it('takes the pin path for a Dry-only frame whose strokes-only probe is false', () => {
    // The caller wires `hasRecordedStrokes` to `hasAquarelleScriptForFrame`,
    // which ignores frame-global Dry events. A Dry-only timeline therefore has
    // NO recorded strokes and the current pixels are the pre-script cache.
    const { lookup, probes } = makeLookup({
      recordedStrokes: [],
      payloads: new Map([['key-1', bytes('raster-under-dry')]]),
    });

    expectBytes(resolveScriptBase('key-1', lookup), 'raster-under-dry', true);
    expect(probes.recorded).toHaveBeenCalledWith('key-1');
  });
});

describe('resolveScriptBase source-key mapping', () => {
  it('resolves exactly the given resolution key and performs no id remapping', () => {
    const { lookup, probes } = makeLookup({
      persisted: new Map([['source-key', { bytes: bytes('source-base') }]]),
      payloads: new Map([
        ['source-key', bytes('source-payload')],
        ['override-composite', bytes('composite-payload')],
      ]),
    });

    // The CALLER resolves an occurrence/override to its source key before the
    // walk; the authority must never see (or trust) the composite id.
    expectBytes(resolveScriptBase('source-key', lookup), 'source-base', false);
    expect(probes.persisted).toHaveBeenCalledTimes(1);
    expect(probes.persisted).toHaveBeenCalledWith('source-key');
    expect(probes.payload).not.toHaveBeenCalled();
  });

  it('refuses a composite id with recorded strokes instead of borrowing the source key', () => {
    // The composite carries the SOURCE key's script events, so it can never
    // resolve a payload base; and the authority never remaps the id it was
    // given, so the source key's stored base is not borrowed either.
    const { lookup, probes } = makeLookup({
      persisted: new Map([['source-key', { bytes: bytes('source-base') }]]),
      recordedStrokes: ['override-composite'],
      payloads: new Map([['override-composite', bytes('composite-payload')]]),
    });

    expect(resolveScriptBase('override-composite', lookup)).toEqual({ ok: false, reason: SCRIPT_BASE_UNKNOWN_REASON });
    expect(probes.persisted).toHaveBeenCalledWith('override-composite');
    expect(probes.persisted).not.toHaveBeenCalledWith('source-key');
    expect(probes.payload).not.toHaveBeenCalled();
  });
});

describe('resolveScriptBase reveal axis', () => {
  it('returns the reveal kind before any store or payload probe', () => {
    const { lookup, probes } = makeLookup({
      persisted: new Map([['reveal-key', { bytes: bytes('stale-base') }]]),
      session: new Map([['reveal-key', { bytes: bytes('session-base') }]]),
      payloads: new Map([['reveal-key', bytes('washed-picture')]]),
      revealKeys: ['reveal-key'],
    });

    expect(resolveScriptBase('reveal-key', lookup)).toEqual({ ok: true, kind: 'reveal', persistPin: false });
    expect(probes.reveal).toHaveBeenCalledWith('reveal-key');
    expect(probes.persisted).not.toHaveBeenCalled();
    expect(probes.session).not.toHaveBeenCalled();
    expect(probes.payload).not.toHaveBeenCalled();
    expect(probes.recorded).not.toHaveBeenCalled();
  });

  it('returns the reveal kind over recorded strokes and an otherwise unprovable base', () => {
    const { lookup } = makeLookup({
      recordedStrokes: ['reveal-key'],
      revealKeys: ['reveal-key'],
    });

    expect(resolveScriptBase('reveal-key', lookup)).toEqual({ ok: true, kind: 'reveal', persistPin: false });
  });

  it('never returns the reveal kind for a key that is not reveal-owned', () => {
    const { lookup } = makeLookup({ payloads: new Map([['key-1', null]]) });

    const result = resolveScriptBase('key-1', lookup);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.kind).not.toBe('reveal');
  });
});

describe('resolveScriptBase unknown keys', () => {
  it('fails closed for an empty key id without probing the lookup', () => {
    const { lookup, probes } = makeLookup();

    expect(resolveScriptBase('', lookup)).toEqual({ ok: false, reason: SCRIPT_BASE_UNKNOWN_REASON });
    expect(probes.reveal).not.toHaveBeenCalled();
    expect(probes.persisted).not.toHaveBeenCalled();
  });

  it('fails closed for null and undefined key ids', () => {
    const { lookup, probes } = makeLookup();

    expect(resolveScriptBase(null, lookup)).toEqual({ ok: false, reason: SCRIPT_BASE_UNKNOWN_REASON });
    expect(resolveScriptBase(undefined, lookup)).toEqual({ ok: false, reason: SCRIPT_BASE_UNKNOWN_REASON });
    expect(probes.reveal).not.toHaveBeenCalled();
  });
});

describe('resolveScriptBase write discipline', () => {
  it('is read-only: a frozen lookup is enough for every branch', () => {
    // The lookup object is frozen in makeLookup, and every callback is a getter
    // by contract. Resolving must never attempt a write (strict mode throws).
    const { lookup } = makeLookup({
      persisted: new Map([['known-base', { bytes: bytes('base') }]]),
      payloads: new Map([['pin-me', bytes('pixels')]]),
      recordedStrokes: ['refuse-me'],
      revealKeys: ['reveal-me'],
    });

    expect(() => resolveScriptBase('known-base', lookup)).not.toThrow();
    expect(() => resolveScriptBase('pin-me', lookup)).not.toThrow();
    expect(() => resolveScriptBase('refuse-me', lookup)).not.toThrow();
    expect(() => resolveScriptBase('reveal-me', lookup)).not.toThrow();
  });
});
