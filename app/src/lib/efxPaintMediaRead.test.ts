import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveFrameMediaBitmap } from './efxPaintMediaRead';
import type { FrameMediaDecode, FrameMediaLru, FrameMediaResolveInput } from './efxPaintMediaRead';
import type { FrameMediaReference } from './efxPaintPackage';
import { testPngBytes, testWebpBytes } from '../testUtils/testWebpBytes';

/**
 * 52.2-09 Task 1 (D-13, T-52.2-29/31/32): the READ leg of the package media
 * pair (52.2-01 built the writer). The resolver's input is a
 * `FrameMediaReference`, so a real key's media and a group override's media
 * travel the identical path — the owning collection is not a parameter and
 * cannot become a branch.
 */
const ipcEfxPaintReadFrameMedia = vi.hoisted(() => vi.fn());

vi.mock('./ipc', () => ({ ipcEfxPaintReadFrameMedia }));

const PACKAGE_DIR = '/project';
const KEY_PATH = 'frames/layer-1/key-1.webp';
const OVERRIDE_PATH = 'frames/layer-1/group-override-1.webp';

function digestOf(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** A reference recorded over the given bytes' real digest. */
function referenceFor(relativePath: string, bytes: Uint8Array): FrameMediaReference {
  return { relativePath, digest: digestOf(bytes) };
}

/** A structurally-complete `ImageBitmap` stand-in (width/height + close). */
function makeFakeBitmap(width = 4, height = 3): ImageBitmap {
  return { width, height, close: vi.fn() } as unknown as ImageBitmap;
}

interface FakeLru {
  readonly lru: FrameMediaLru;
  readonly puts: Array<{ readonly key: string; readonly bitmap: ImageBitmap }>;
  has(key: string): boolean;
}

function makeFakeLru(): FakeLru {
  const entries = new Map<string, ImageBitmap>();
  const puts: Array<{ readonly key: string; readonly bitmap: ImageBitmap }> = [];
  return {
    lru: {
      get: (key) => entries.get(key),
      put: (key, bitmap) => {
        puts.push({ key, bitmap });
        entries.set(key, bitmap);
      },
    },
    puts,
    has: (key) => entries.has(key),
  };
}

function makeFakeDecode(bitmap: ImageBitmap | null = makeFakeBitmap()): FrameMediaDecode & {
  mock: { calls: Uint8Array[][] };
} {
  return vi.fn(async (_bytes: Uint8Array) => bitmap);
}

/** The native read succeeds and returns the bytes with their real digest. */
function ipcReads(bytes: Uint8Array): void {
  ipcEfxPaintReadFrameMedia.mockResolvedValue({
    ok: true,
    data: { bytes, digest: digestOf(bytes) },
  });
}

/** The native read fails with the given taxonomy member. */
function ipcFails(error: unknown): void {
  ipcEfxPaintReadFrameMedia.mockResolvedValue({ ok: false, error });
}

function resolve(
  reference: FrameMediaReference,
  lru: FakeLru,
  decode: FrameMediaDecode,
): ReturnType<typeof resolveFrameMediaBitmap> {
  const input: FrameMediaResolveInput = { packageDir: PACKAGE_DIR, reference, lru: lru.lru, decode };
  return resolveFrameMediaBitmap(input);
}

describe('efxPaintMediaRead: digest-verified, LRU-backed resolution (52.2-09, D-13)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves a reference whose on-disk digest matches to a bitmap and caches it under the digest', async () => {
    const bytes = testWebpBytes('a');
    const reference = referenceFor(KEY_PATH, bytes);
    const bitmap = makeFakeBitmap(8, 6);
    const decode = makeFakeDecode(bitmap);
    const fake = makeFakeLru();
    ipcReads(bytes);

    const outcome = await resolve(reference, fake, decode);

    expect(outcome).toEqual({ kind: 'bitmap', bitmap, width: 8, height: 6 });
    expect(ipcEfxPaintReadFrameMedia).toHaveBeenCalledTimes(1);
    expect(ipcEfxPaintReadFrameMedia).toHaveBeenCalledWith(PACKAGE_DIR, KEY_PATH);
    expect(decode).toHaveBeenCalledWith(bytes);
    expect(fake.puts).toEqual([{ key: reference.digest, bitmap }]);
    expect(fake.has(reference.digest)).toBe(true);
  });

  it('serves the second resolution of the same digest from the LRU — exactly one IPC read across two resolutions', async () => {
    const bytes = testWebpBytes('b');
    const reference = referenceFor(KEY_PATH, bytes);
    const fake = makeFakeLru();
    const decode = makeFakeDecode();
    ipcReads(bytes);

    const first = await resolve(reference, fake, decode);
    const second = await resolve(reference, fake, decode);

    expect(first.kind).toBe('bitmap');
    expect(second.kind).toBe('bitmap');
    expect(ipcEfxPaintReadFrameMedia).toHaveBeenCalledTimes(1);
    expect(decode).toHaveBeenCalledTimes(1);
  });

  it('decodes once for two different keyIds referencing the same digest — the LRU key is the digest, never the keyId', async () => {
    const bytes = testWebpBytes('shared');
    const referenceA = referenceFor('frames/layer-1/key-a.webp', bytes);
    const referenceB = referenceFor('frames/layer-1/key-b.webp', bytes);
    const fake = makeFakeLru();
    const decode = makeFakeDecode();
    ipcReads(bytes);

    const first = await resolve(referenceA, fake, decode);
    const second = await resolve(referenceB, fake, decode);

    expect(first).toEqual({ kind: 'bitmap', bitmap: expect.anything(), width: 4, height: 3 });
    expect(second).toEqual({ kind: 'bitmap', bitmap: expect.anything(), width: 4, height: 3 });
    expect(decode).toHaveBeenCalledTimes(1);
    expect(ipcEfxPaintReadFrameMedia).toHaveBeenCalledTimes(1);
  });

  it('resolves an absent file to the missing outcome — never an empty bitmap, and nothing is cached', async () => {
    const bytes = testWebpBytes('gone');
    const reference = referenceFor(KEY_PATH, bytes);
    const fake = makeFakeLru();
    const decode = makeFakeDecode();
    ipcFails({ kind: 'missing' });

    const outcome = await resolve(reference, fake, decode);

    expect(outcome).toEqual({ kind: 'missing' });
    expect(decode).not.toHaveBeenCalled();
    expect(fake.puts).toHaveLength(0);
  });

  it('refuses a digest mismatch without decoding and without writing the LRU', async () => {
    const onDisk = testWebpBytes('tampered');
    // The reference records a digest that does NOT match the bytes the file
    // now holds (T-52.2-29 — corruption or substitution, never silently used).
    const reference = referenceFor(KEY_PATH, testWebpBytes('original'));
    const fake = makeFakeLru();
    const decode = makeFakeDecode();
    ipcReads(onDisk);

    const outcome = await resolve(reference, fake, decode);

    expect(outcome).toEqual({ kind: 'refused', reason: 'digest-mismatch' });
    expect(decode).not.toHaveBeenCalled();
    expect(fake.puts).toHaveLength(0);
    expect(fake.has(reference.digest)).toBe(false);
  });

  it('passes a native refusal label through as refused — never as missing', async () => {
    const reference = referenceFor(KEY_PATH, testWebpBytes('escape'));
    const fake = makeFakeLru();
    const decode = makeFakeDecode();
    ipcFails({ kind: 'refused', rejection: 'pathEscape' });

    const outcome = await resolve(reference, fake, decode);

    expect(outcome).toEqual({ kind: 'refused', reason: 'pathEscape' });
    expect(decode).not.toHaveBeenCalled();
    expect(fake.puts).toHaveLength(0);
  });

  it('refuses an io failure (fail closed) and caches nothing', async () => {
    const reference = referenceFor(KEY_PATH, testWebpBytes('io'));
    const fake = makeFakeLru();
    const decode = makeFakeDecode();
    ipcFails({ kind: 'io' });

    const outcome = await resolve(reference, fake, decode);

    expect(outcome).toEqual({ kind: 'refused', reason: 'io' });
    expect(fake.puts).toHaveLength(0);
  });

  it('refuses a decode failure without caching, so a later attempt can retry', async () => {
    const bytes = testWebpBytes('undecodable');
    const reference = referenceFor(KEY_PATH, bytes);
    const fake = makeFakeLru();
    const decode = makeFakeDecode(null);
    ipcReads(bytes);

    const outcome = await resolve(reference, fake, decode);

    expect(outcome).toEqual({ kind: 'refused', reason: 'decode-failed' });
    expect(decode).toHaveBeenCalledTimes(1);
    expect(fake.puts).toHaveLength(0);
    expect(fake.has(reference.digest)).toBe(false);
  });

  it('writes the LRU only for a verified digest — every failure path caches nothing', async () => {
    const verifiedBytes = testWebpBytes('verified');

    // The positive half: a verified digest caches exactly once.
    const verifiedLru = makeFakeLru();
    ipcReads(verifiedBytes);
    await resolve(referenceFor(KEY_PATH, verifiedBytes), verifiedLru, makeFakeDecode());
    expect(verifiedLru.puts).toHaveLength(1);

    // Every failure path: missing, native refusal, io, digest mismatch, decode failure.
    const failures: Array<{ readonly error?: unknown; readonly bytes?: Uint8Array; readonly decode: FrameMediaDecode }> = [
      { error: { kind: 'missing' }, decode: makeFakeDecode() },
      { error: { kind: 'refused', rejection: 'unsafeId' }, decode: makeFakeDecode() },
      { error: { kind: 'io' }, decode: makeFakeDecode() },
      { bytes: testWebpBytes('tampered'), decode: makeFakeDecode() },
      { bytes: verifiedBytes, decode: makeFakeDecode(null) },
    ];
    for (const failure of failures) {
      const fake = makeFakeLru();
      if (failure.error !== undefined) ipcFails(failure.error);
      else ipcReads(failure.bytes as Uint8Array);
      const outcome = await resolve(referenceFor(KEY_PATH, verifiedBytes), fake, failure.decode);
      // `missing` is its own honest outcome (the slate path), the rest are
      // refusals — the invariant shared by all of them is the empty cache.
      expect(outcome.kind).not.toBe('bitmap');
      expect(fake.puts).toHaveLength(0);
    }
  });

  it('resolves a group-override keyId through the identical path — same digest verification, same refusal on mismatch', async () => {
    const bytes = testWebpBytes('override');
    const reference = referenceFor(OVERRIDE_PATH, bytes);
    const bitmap = makeFakeBitmap(16, 9);
    const matchedLru = makeFakeLru();
    ipcReads(bytes);

    const resolved = await resolve(reference, matchedLru, makeFakeDecode(bitmap));

    expect(resolved).toEqual({ kind: 'bitmap', bitmap, width: 16, height: 9 });
    expect(ipcEfxPaintReadFrameMedia).toHaveBeenCalledWith(PACKAGE_DIR, OVERRIDE_PATH);
    expect(matchedLru.puts).toEqual([{ key: reference.digest, bitmap }]);

    // A mismatch on a group override's media file is refused exactly like a real key's.
    const mismatchedLru = makeFakeLru();
    ipcReads(testWebpBytes('tampered'));
    const refused = await resolve(reference, mismatchedLru, makeFakeDecode());

    expect(refused).toEqual({ kind: 'refused', reason: 'digest-mismatch' });
    expect(mismatchedLru.puts).toHaveLength(0);
  });

  it('hands both VP8L and PNG bytes to the injected decode — the module never assumes a format', async () => {
    const webpBytes = testWebpBytes('webp');
    const pngBytes = testPngBytes('png');
    const webpLru = makeFakeLru();
    const pngLru = makeFakeLru();
    const webpDecode = makeFakeDecode(makeFakeBitmap(32, 32));
    const pngDecode = makeFakeDecode(makeFakeBitmap(64, 64));

    ipcReads(webpBytes);
    const webpOutcome = await resolve(referenceFor(KEY_PATH, webpBytes), webpLru, webpDecode);

    ipcReads(pngBytes);
    const pngOutcome = await resolve(referenceFor(KEY_PATH, pngBytes), pngLru, pngDecode);

    expect(webpOutcome).toEqual({ kind: 'bitmap', bitmap: expect.anything(), width: 32, height: 32 });
    expect(pngOutcome).toEqual({ kind: 'bitmap', bitmap: expect.anything(), width: 64, height: 64 });
    // Both byte shapes reach the decode step unchanged — format detection is
    // the decode step's job (the compositor seam's sniff), never the extension's.
    expect(webpDecode).toHaveBeenCalledWith(webpBytes);
    expect(pngDecode).toHaveBeenCalledWith(pngBytes);
  });
});
