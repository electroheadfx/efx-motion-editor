// ============================================================
//  quick-261025-awl Task 3 — Raster button availability matrix.
//
//  Priority is load-bearing: the reason shown to the artist must
//  name the FIRST blocker they can act on. Ready is checked first so
//  an idle key is enabled even when no other flag is set; playback
//  outranks the mutation lock because cached playback is the outer
//  envelope around any in-flight edit; the missing-script reason is
//  last because it is a property of the key, not of an operation.
// ============================================================

import { describe, expect, it } from 'vitest';
import { resolveRasterKeyPresentation } from './rasterKeyPresentation';

describe('quick-261025-awl resolveRasterKeyPresentation', () => {
  it('is enabled with a null reason when the key has a script and nothing is in flight', () => {
    expect(
      resolveRasterKeyPresentation({
        hasScript: true,
        ready: true,
        playbackActive: false,
        mutationLocked: false,
      }),
    ).toEqual({ disabled: false, reason: null });
  });

  it('disables with the engine reason when the engine is not ready', () => {
    expect(
      resolveRasterKeyPresentation({
        hasScript: true,
        ready: false,
        playbackActive: false,
        mutationLocked: false,
      }),
    ).toEqual({ disabled: true, reason: 'The engine is not ready yet.' });
  });

  it('disables with the playback reason while cached playback runs', () => {
    expect(
      resolveRasterKeyPresentation({
        hasScript: true,
        ready: true,
        playbackActive: true,
        mutationLocked: false,
      }),
    ).toEqual({ disabled: true, reason: 'Stop cached playback before rastering a key.' });
  });

  it('disables with the mutation reason while a timeline edit is in flight', () => {
    expect(
      resolveRasterKeyPresentation({
        hasScript: true,
        ready: true,
        playbackActive: false,
        mutationLocked: true,
      }),
    ).toEqual({ disabled: true, reason: 'A timeline edit is in progress.' });
  });

  it('disables with the no-script reason on a raster-only key', () => {
    expect(
      resolveRasterKeyPresentation({
        hasScript: false,
        ready: true,
        playbackActive: false,
        mutationLocked: false,
      }),
    ).toEqual({ disabled: true, reason: 'This key has no script to raster.' });
  });

  it('prioritizes not-ready over playback, lock and script', () => {
    expect(
      resolveRasterKeyPresentation({
        hasScript: false,
        ready: false,
        playbackActive: true,
        mutationLocked: true,
      }),
    ).toEqual({ disabled: true, reason: 'The engine is not ready yet.' });
  });

  it('prioritizes playback over the mutation lock and the missing script', () => {
    expect(
      resolveRasterKeyPresentation({
        hasScript: false,
        ready: true,
        playbackActive: true,
        mutationLocked: true,
      }),
    ).toEqual({ disabled: true, reason: 'Stop cached playback before rastering a key.' });
  });

  it('prioritizes the mutation lock over the missing script', () => {
    expect(
      resolveRasterKeyPresentation({
        hasScript: false,
        ready: true,
        playbackActive: false,
        mutationLocked: true,
      }),
    ).toEqual({ disabled: true, reason: 'A timeline edit is in progress.' });
  });
});
