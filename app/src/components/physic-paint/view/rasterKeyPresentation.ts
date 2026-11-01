// ============================================================
//  quick-261025-awl Task 3 — the Raster button's availability
//  matrix, kept pure so the strip leaf stays a render-only shell.
//
//  The reasons are ordered by what the artist can act on first:
//  engine readiness, then the session-wide playback envelope, then
//  the per-edit lock, and only then the key's own lack of script.
// ============================================================

export interface RasterKeyPresentation {
  disabled: boolean;
  reason: string | null;
}

export interface RasterKeyPresentationInput {
  hasScript: boolean;
  ready: boolean;
  playbackActive: boolean;
  mutationLocked: boolean;
}

const READY_REASON = 'The engine is not ready yet.';
const PLAYBACK_REASON = 'Stop cached playback before rastering a key.';
const MUTATION_REASON = 'A timeline edit is in progress.';
const NO_SCRIPT_REASON = 'This key has no script to raster.';

const ENABLED: RasterKeyPresentation = { disabled: false, reason: null };

function disabledWith(reason: string): RasterKeyPresentation {
  return { disabled: true, reason };
}

export function resolveRasterKeyPresentation(
  input: RasterKeyPresentationInput,
): RasterKeyPresentation {
  if (!input.ready) return disabledWith(READY_REASON);
  if (input.playbackActive) return disabledWith(PLAYBACK_REASON);
  if (input.mutationLocked) return disabledWith(MUTATION_REASON);
  if (!input.hasScript) return disabledWith(NO_SCRIPT_REASON);
  return ENABLED;
}

// ============================================================
//  quick-261101-f5v — the rail-scoped Raster mode.
//
//  A selected key rail (which already implies no frame key is
//  selected) retargets the same action at every scripted key of
//  that rail. The D-03 order mirrors the key matrix, with two
//  rail-only blockers inserted after the mutation lock: an empty
//  rail and a rail whose keys carry no script.
// ============================================================

export interface RasterRailTarget {
  readonly firstKeyId: string;
  readonly frames: readonly number[];
  readonly hasScript: boolean;
}

export interface RasterRailPresentationInput {
  readonly hasScript: boolean;
  readonly ready: boolean;
  readonly playbackActive: boolean;
  readonly mutationLocked: boolean;
  readonly frameCount: number;
}

const RAIL_PLAYBACK_REASON = 'Stop cached playback before rastering the rail.';
const EMPTY_RAIL_REASON = 'This rail has no keys to raster.';
const NO_RAIL_SCRIPT_REASON = 'No key on this rail has a script to raster.';

export function resolveRasterRailPresentation(
  input: RasterRailPresentationInput,
): RasterKeyPresentation {
  if (!input.ready) return disabledWith(READY_REASON);
  if (input.playbackActive) return disabledWith(RAIL_PLAYBACK_REASON);
  if (input.mutationLocked) return disabledWith(MUTATION_REASON);
  if (input.frameCount === 0) return disabledWith(EMPTY_RAIL_REASON);
  if (!input.hasScript) return disabledWith(NO_RAIL_SCRIPT_REASON);
  return ENABLED;
}

/** The Memory-tab range idiom: one frame reads as itself, never as "12-12". */
export function formatRasterRailRange(frames: readonly number[]): string {
  if (frames.length === 0) return '';
  const first = frames[0]!;
  const last = frames[frames.length - 1]!;
  return frames.length === 1 ? `${first}` : `${first}-${last}`;
}

export interface RasterRailRunSummary {
  readonly rastered: number;
  readonly targeted: number;
  readonly skipped: number;
  readonly stopped: boolean;
}

export function formatRasterRailRunCopy(
  summary: RasterRailRunSummary,
): { readonly message: string; readonly isError: boolean } {
  if (summary.rastered === 0) {
    return summary.stopped
      ? {
        message: 'Rastering the rail stopped before any key was rastered — nothing changed.',
        isError: true,
      }
      : { message: 'No rail key could be rastered — nothing changed.', isError: true };
  }
  if (summary.skipped === 0 && !summary.stopped) {
    return {
      message: `Rastered ${summary.rastered} rail key${summary.rastered === 1 ? '' : 's'}.`,
      isError: false,
    };
  }
  return {
    message: `Rastered ${summary.rastered} of ${summary.targeted} rail keys — ${summary.skipped} skipped${summary.stopped ? '; the run stopped early' : ''}.`,
    isError: summary.stopped,
  };
}
