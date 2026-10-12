import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type {AudioTrack} from '../types/audio';
import {audioEngine} from './audioEngine';

describe('audioEngine', () => {
  it('exports audioEngine object', () => {
    expect(audioEngine).toBeDefined();
  });

  it('has expected methods', () => {
    expect(typeof audioEngine.ensureContext).toBe('function');
    expect(typeof audioEngine.decode).toBe('function');
    expect(typeof audioEngine.getBuffer).toBe('function');
    expect(typeof audioEngine.play).toBe('function');
    expect(typeof audioEngine.stop).toBe('function');
    expect(typeof audioEngine.stopAll).toBe('function');
    expect(typeof audioEngine.setVolume).toBe('function');
    expect(typeof audioEngine.removeTrack).toBe('function');
  });

  describe('ensureContext', () => {
    it.todo('creates AudioContext lazily on first call');
    it.todo('resumes suspended AudioContext');
  });

  describe('decode', () => {
    it.todo('decodes ArrayBuffer into AudioBuffer');
    it.todo('caches decoded buffer by trackId');
  });

  describe('AUDIO-04: volume', () => {
    it.todo('setVolume updates GainNode gain value');
  });

  describe('play / stop', () => {
    it.todo('creates new AudioBufferSourceNode per play call (one-shot)');
    it.todo('connects source -> GainNode -> destination');
    it.todo('stop disconnects and removes source');
    it.todo('stopAll stops all active sources');
  });

  describe('AUDIO-06: applyFadeSchedule (261010-ht0 F3)', () => {
    it('schedules every curve via setValueCurveAtTime of the sampled fadeCurves law', () => {
      const source = readFileSync(
        fileURLToPath(new URL('./audioEngine.ts', import.meta.url)),
        'utf8',
      );
      expect(source).toContain("from './fadeCurves'");
      expect(source).toContain('sampleFadeCurve');
      expect(source).toContain('setValueCurveAtTime');
      // No linear-ramp stand-in for logarithmic (or any curve).
      expect(source).not.toContain('linearRampToValueAtTime');
      expect(source).not.toContain('exponentialRampToValueAtTime');
      // Partial fade-in entry samples the remaining loudness slice.
      expect(source).toContain("sampleFadeCurve(track.fadeInCurve, 'in'");
    });
  });
});

// ---------------------------------------------------------------------------
// 261012-exn Task 1 (RED): decode-readiness regressions (SND-01).
//
// The visible diagnostic channel (audioDecodeErrors / addAudioDecodeError /
// clearAudioDecodeErrors) does not exist yet — every leg reaches it through
// ONE duck-typed loader so each assertion fails under its own test name and
// typecheck stays green before the fix lands.
//
// Web Audio harness: a REAL FakeAudioContext class installed on globalThis
// (audioEngine constructs `new AudioContext()` itself), with controllable
// decodeAudioData deferreds and source spies recorded on `handle`.
// ---------------------------------------------------------------------------

interface FakeSourceNode {
  buffer: AudioBuffer | null;
  connect: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  onended: null | (() => void);
}

const handle = {
  sources: [] as FakeSourceNode[],
  decodes: [] as Array<{resolve: (b: unknown) => void; reject: (e: unknown) => void}>,
};

class FakeAudioContext {
  state = 'running';
  currentTime = 0;
  destination = {};
  resume = vi.fn(async () => {});
  close = vi.fn(async () => {
    this.state = 'closed';
  });
  decodeAudioData = vi.fn(
    () =>
      new Promise<unknown>((resolve, reject) => {
        handle.decodes.push({resolve, reject});
      }),
  );
  createBufferSource = vi.fn((): FakeSourceNode => {
    const source: FakeSourceNode = {
      buffer: null,
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      disconnect: vi.fn(),
      onended: null,
    };
    handle.sources.push(source);
    return source;
  });
  createGain = vi.fn(() => ({
    gain: {
      value: 1,
      cancelScheduledValues: vi.fn(),
      setValueAtTime: vi.fn(),
      setValueCurveAtTime: vi.fn(),
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
  }));
}

function makeAudioTrack(id: string, name: string): AudioTrack {
  return {
    id,
    name,
    offsetFrame: 0,
    inFrame: 0,
    outFrame: 48,
    slipOffset: 0,
    muted: false,
    volume: 1,
    fadeInFrames: 0,
    fadeOutFrames: 0,
    fadeInCurve: 'linear',
    fadeOutCurve: 'linear',
  } as unknown as AudioTrack;
}

type AudioDecodeChannel = {
  audioDecodeErrors?: {value: string[]};
  addAudioDecodeError?: (message: string) => void;
  clearAudioDecodeErrors?: () => void;
};

/** Duck-typed access to the not-yet-existing decode-diagnostic exports. */
async function loadDecodeChannel(): Promise<AudioDecodeChannel> {
  return (await import('./audioEngine')) as unknown as AudioDecodeChannel;
}

beforeEach(async () => {
  vi.stubGlobal('AudioContext', FakeAudioContext);
  await audioEngine.closeContext();
  audioEngine.stopAll();
  audioEngine.removeTrack('t1');
  handle.sources.length = 0;
  handle.decodes.length = 0;
  (await loadDecodeChannel()).clearAudioDecodeErrors?.();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('261012-exn decode readiness (SND-01)', () => {
  it('leg (a): play with no buffer and no pending decode records a named refusal', async () => {
    await audioEngine.play('t1', 0, makeAudioTrack('t1', 'Beat Loop.wav'), 24);

    const channel = await loadDecodeChannel();
    const errors = channel.audioDecodeErrors?.value ?? [];
    expect(
      errors.join('\n'),
      'audioDecodeErrors must name the track play refused to start',
    ).toContain('Beat Loop.wav');
  });

  it('leg (a): playDelayed with no buffer and no pending decode records a named refusal', async () => {
    await audioEngine.playDelayed('t1', 0.5, 0, makeAudioTrack('t1', 'Delayed Clip.wav'), 24);

    const channel = await loadDecodeChannel();
    const errors = channel.audioDecodeErrors?.value ?? [];
    expect(
      errors.join('\n'),
      'audioDecodeErrors must name the delayed clip play refused to start',
    ).toContain('Delayed Clip.wav');
  });

  it('leg (b): play awaits an in-flight decode and starts exactly once after it lands', async () => {
    void audioEngine.decode('t1', new ArrayBuffer(8));
    const playPromise = audioEngine.play('t1', 0, makeAudioTrack('t1', 'Race Track.wav'), 24);

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    const startCalls = handle.sources.reduce((n, s) => n + s.start.mock.calls.length, 0);
    expect(startCalls, 'source.start must not fire while the decode is in flight').toBe(0);

    handle.decodes[0].resolve({duration: 10});
    await playPromise;

    expect(handle.sources, 'exactly one source after the decode lands').toHaveLength(1);
    expect(handle.sources[0].start).toHaveBeenCalledTimes(1);
    expect(handle.sources[0].start).toHaveBeenCalledWith(0, 0, expect.any(Number));
  });

  it('leg (b2): a rejected in-flight decode resolves play (never rejects) and records the refusal', async () => {
    void audioEngine.decode('t1', new ArrayBuffer(8)).catch(() => {});
    const playPromise = audioEngine.play('t1', 0, makeAudioTrack('t1', 'Rejected Clip.wav'), 24);

    await Promise.resolve();
    await Promise.resolve();
    handle.decodes[0].reject(new Error('decode boom'));

    await expect(playPromise, 'play must never reject').resolves.toBeUndefined();

    const channel = await loadDecodeChannel();
    const errors = channel.audioDecodeErrors?.value ?? [];
    expect(
      errors.join('\n'),
      'the refusal must name the clip whose decode failed',
    ).toContain('Rejected Clip.wav');
  });

  it('addAudioDecodeError dedupes identical messages (idempotent setter)', async () => {
    const channel = await loadDecodeChannel();
    channel.addAudioDecodeError?.('Audio "dup.wav" not played: no decoded buffer.');
    channel.addAudioDecodeError?.('Audio "dup.wav" not played: no decoded buffer.');

    const errors = channel.audioDecodeErrors?.value ?? [];
    expect(errors.filter(e => e.includes('dup.wav'))).toHaveLength(1);
  });

  it('audioStore.reset() clears the refusal list (project close wipes stale refusals)', async () => {
    const channel = await loadDecodeChannel();
    channel.addAudioDecodeError?.('Audio "stale.wav" not played: no decoded buffer.');

    const {audioStore} = await import('../stores/audioStore');
    audioStore.reset();

    expect(channel.audioDecodeErrors?.value ?? []).toHaveLength(0);
  });
});
