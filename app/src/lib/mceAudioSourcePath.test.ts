import {describe, it, expect} from 'vitest';

// 261009-rko: the load-door parser does not exist yet at RED time. Each test
// body reaches it through a dynamic `await import()` so a missing module fails
// under that test's own name instead of taking the file down as a collection
// failure (documentSoundGates.test.ts idiom).
async function loadParser() {
  const mod = await import('./mceAudioSourcePath');
  return mod.readMceAudioSourcePath;
}

describe('readMceAudioSourcePath (261009-rko clean-break load door)', () => {
  it('returns source_path verbatim for a valid member record', async () => {
    const readMceAudioSourcePath = await loadParser();
    expect(
      readMceAudioSourcePath({id: 'a1', name: 'take.wav', source_path: '/Users/test/Music/take.wav'}, 'audio_assets[]'),
    ).toBe('/Users/test/Music/take.wav');
  });

  it('throws for a member record carrying relative_path', async () => {
    const readMceAudioSourcePath = await loadParser();
    expect(() =>
      readMceAudioSourcePath(
        {id: 'a1', name: 'take.wav', relative_path: 'audio/take.wav', source_path: '/Users/test/Music/take.wav'},
        'audio_assets[]',
      ),
    ).toThrow(/relative_path/);
  });

  it('throws when source_path is missing, empty, or not a string', async () => {
    const readMceAudioSourcePath = await loadParser();
    expect(() => readMceAudioSourcePath({id: 'a1', name: 'take.wav'}, 'audio_tracks[]')).toThrow(/source_path/);
    expect(() => readMceAudioSourcePath({id: 'a1', name: 'take.wav', source_path: ''}, 'audio_tracks[]')).toThrow(/source_path/);
    expect(() => readMceAudioSourcePath({id: 'a1', name: 'take.wav', source_path: 42}, 'audio_tracks[]')).toThrow(/source_path/);
  });

  it('throws for a non-record member', async () => {
    const readMceAudioSourcePath = await loadParser();
    expect(() => readMceAudioSourcePath(null, 'audio_assets[]')).toThrow();
    expect(() => readMceAudioSourcePath('audio/take.wav', 'audio_assets[]')).toThrow();
  });
});
