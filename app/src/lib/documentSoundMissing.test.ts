import { describe, expect, it } from 'vitest';
import {
  isSoundSourceMissing,
  collectMissingSoundSourcePaths,
} from './documentSoundMissing';

describe('isSoundSourceMissing (261009-ofk)', () => {
  it('null missing set reports present (not probed yet -> no false-missing flash at boot)', () => {
    expect(isSoundSourceMissing(null, '/Users/test/Music/take.wav')).toBe(false);
  });

  it('is true exactly when the set holds that sourcePath', () => {
    const missing = new Set(['/Users/test/Music/missing.wav']);
    expect(isSoundSourceMissing(missing, '/Users/test/Music/missing.wav')).toBe(true);
    expect(isSoundSourceMissing(missing, '/Users/test/Music/present.wav')).toBe(false);
  });
});

describe('collectMissingSoundSourcePaths (261009-ofk)', () => {
  it('reports a path missing when the probe says it does not resolve, present when it does', async () => {
    const probeMap = new Map<string, boolean>([
      ['/Users/test/Music/present.wav', true],
      ['/Users/test/Music/missing.wav', false],
    ]);
    const result = await collectMissingSoundSourcePaths(
      ['/Users/test/Music/present.wav', '/Users/test/Music/missing.wav'],
      async (p) => probeMap.get(p) ?? false,
    );
    expect(result.has('/Users/test/Music/missing.wav')).toBe(true);
    expect(result.has('/Users/test/Music/present.wav')).toBe(false);
  });

  it('probe failures (throw) count as missing', async () => {
    const result = await collectMissingSoundSourcePaths(
      ['/Users/test/Music/broken.wav'],
      async () => { throw new Error('probe failed'); },
    );
    expect(result.has('/Users/test/Music/broken.wav')).toBe(true);
  });

  it('dedupes the input — one probe per distinct path', async () => {
    const probed: string[] = [];
    await collectMissingSoundSourcePaths(
      ['/Users/test/Music/a.wav', '/Users/test/Music/a.wav', '/Users/test/Music/b.wav'],
      async (p) => { probed.push(p); return true; },
    );
    expect(probed).toEqual(['/Users/test/Music/a.wav', '/Users/test/Music/b.wav']);
  });
});
