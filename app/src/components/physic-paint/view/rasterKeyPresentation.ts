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
