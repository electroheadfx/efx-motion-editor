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
import {
  formatRasterRailRange,
  formatRasterRailRunCopy,
  resolveRasterKeyPresentation,
  resolveRasterRailPresentation,
} from './rasterKeyPresentation';

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

// ============================================================
//  quick-261101-f5v — the rail-scoped Raster matrix.
//
//  Same actionable-first order as the key matrix, with the two
//  rail-only blockers inserted after the mutation lock: an empty
//  rail outranks a rail whose keys simply carry no script.
// ============================================================

describe('quick-261101-f5v resolveRasterRailPresentation', () => {
  const ready = { hasScript: true, ready: true, playbackActive: false, mutationLocked: false };

  it('is enabled with a null reason for a one-key and a multi-key rail', () => {
    expect(resolveRasterRailPresentation({ ...ready, frameCount: 1 }))
      .toEqual({ disabled: false, reason: null });
    expect(resolveRasterRailPresentation({ ...ready, frameCount: 2 }))
      .toEqual({ disabled: false, reason: null });
  });

  it('disables with the engine reason when the engine is not ready', () => {
    expect(resolveRasterRailPresentation({ ...ready, ready: false, frameCount: 2 }))
      .toEqual({ disabled: true, reason: 'The engine is not ready yet.' });
  });

  it('disables with the rail playback reason while cached playback runs', () => {
    expect(resolveRasterRailPresentation({ ...ready, playbackActive: true, frameCount: 2 }))
      .toEqual({ disabled: true, reason: 'Stop cached playback before rastering the rail.' });
  });

  it('disables with the mutation reason while a timeline edit is in flight', () => {
    expect(resolveRasterRailPresentation({ ...ready, mutationLocked: true, frameCount: 2 }))
      .toEqual({ disabled: true, reason: 'A timeline edit is in progress.' });
  });

  it('disables with the empty-rail reason when no key resolves', () => {
    expect(resolveRasterRailPresentation({ ...ready, frameCount: 0 }))
      .toEqual({ disabled: true, reason: 'This rail has no keys to raster.' });
  });

  it('disables with the no-rail-script reason when no key carries a script', () => {
    expect(resolveRasterRailPresentation({ ...ready, hasScript: false, frameCount: 2 }))
      .toEqual({ disabled: true, reason: 'No key on this rail has a script to raster.' });
  });

  it('prioritizes readiness over playback, lock, empty and missing script', () => {
    expect(
      resolveRasterRailPresentation({
        hasScript: false,
        ready: false,
        playbackActive: true,
        mutationLocked: true,
        frameCount: 0,
      }),
    ).toEqual({ disabled: true, reason: 'The engine is not ready yet.' });
  });

  it('prioritizes playback over the mutation lock, the empty rail and the missing script', () => {
    expect(
      resolveRasterRailPresentation({
        hasScript: false,
        ready: true,
        playbackActive: true,
        mutationLocked: true,
        frameCount: 0,
      }),
    ).toEqual({ disabled: true, reason: 'Stop cached playback before rastering the rail.' });
  });

  it('prioritizes the mutation lock over the empty rail and the missing script', () => {
    expect(
      resolveRasterRailPresentation({
        hasScript: false,
        ready: true,
        playbackActive: false,
        mutationLocked: true,
        frameCount: 0,
      }),
    ).toEqual({ disabled: true, reason: 'A timeline edit is in progress.' });
  });

  it('prioritizes the empty rail over the missing script', () => {
    expect(
      resolveRasterRailPresentation({
        hasScript: false,
        ready: true,
        playbackActive: false,
        mutationLocked: false,
        frameCount: 0,
      }),
    ).toEqual({ disabled: true, reason: 'This rail has no keys to raster.' });
  });
});

describe('quick-261101-f5v formatRasterRailRange', () => {
  it('renders an empty list as an empty string', () => {
    expect(formatRasterRailRange([])).toBe('');
  });

  it('renders one frame as itself, never as a range', () => {
    expect(formatRasterRailRange([12])).toBe('12');
  });

  it('renders a multi-key rail as first-last', () => {
    expect(formatRasterRailRange([12, 14])).toBe('12-14');
  });
});

describe('quick-261101-f5v formatRasterRailRunCopy', () => {
  it('renders the all-rastered sentence with the matching singular and plural', () => {
    expect(formatRasterRailRunCopy({ rastered: 1, targeted: 1, skipped: 0, stopped: false }))
      .toEqual({ message: 'Rastered 1 rail key.', isError: false });
    expect(formatRasterRailRunCopy({ rastered: 3, targeted: 3, skipped: 0, stopped: false }))
      .toEqual({ message: 'Rastered 3 rail keys.', isError: false });
  });

  it('renders the ratio sentence when keys were skipped', () => {
    expect(formatRasterRailRunCopy({ rastered: 2, targeted: 5, skipped: 3, stopped: false }))
      .toEqual({ message: 'Rastered 2 of 5 rail keys — 3 skipped.', isError: false });
  });

  it('marks the stopped ratio sentence as an error', () => {
    expect(formatRasterRailRunCopy({ rastered: 2, targeted: 5, skipped: 3, stopped: true }))
      .toEqual({
        message: 'Rastered 2 of 5 rail keys — 3 skipped; the run stopped early.',
        isError: true,
      });
  });

  it('renders the nothing-rastered sentence as an error', () => {
    expect(formatRasterRailRunCopy({ rastered: 0, targeted: 5, skipped: 5, stopped: false }))
      .toEqual({ message: 'No rail key could be rastered — nothing changed.', isError: true });
  });

  it('renders the stopped-before-any-key sentence as an error', () => {
    expect(formatRasterRailRunCopy({ rastered: 0, targeted: 5, skipped: 5, stopped: true }))
      .toEqual({
        message: 'Rastering the rail stopped before any key was rastered — nothing changed.',
        isError: true,
      });
  });
});
