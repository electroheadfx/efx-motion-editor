/**
 * 47-02 Task 2: the acknowledge-and-delete dialog (TML-02, D-17, Phase 46
 * D-14).
 *
 * One Paint track's deletion is committed ONLY with explicit acknowledgment:
 * the strip opens this dialog with the `requestDeleteTrack` preview (frame
 * count, Loop Clip count, Hold reference count, last-track flag — D-17/ASVS
 * V4), the user confirms, and the Confirm button calls the store's
 * `commitDeleteTrack(layerId, trackId, true)` exactly once. Cancelling closes
 * the dialog with no commit (Phase 46 D-14).
 *
 * The dialog is the ONLY delete entry in the strip surface: the header
 * column's trash intent opens it via `requestDeleteTrack`, and no other code
 * path may commit a track deletion (the commit refuses fail-closed without
 * `acknowledged` anyway, D-17).
 *
 * The dialog is presentational and hook-free (the tests invoke it as a plain
 * function). All copy is English (D-14): the title names the exact track, the
 * preview lines carry the destruction surface, and the last-track refusal
 * disables the Confirm button so the document always keeps at least one Paint
 * track.
 */

import { commitDeleteTrack, type TrackDeletePreview } from '../../../stores/efxPaintStore';

export interface PhysicsPaintDeleteTrackDialogProps {
  /** The EFX Paint layer the deleted track belongs to (store key). */
  readonly layerId: string;
  /** The track's display name (from the strip's track list). */
  readonly trackName: string;
  /** The `requestDeleteTrack` preview — the destruction surface shown verbatim. */
  readonly preview: TrackDeletePreview;
  /** Cancel intent — the strip closes the dialog, no commit. */
  readonly onCancel: () => void;
  /** Result channel: `null` on success, the store's rejection error otherwise. */
  readonly onStatus?: (message: string | null) => void;
}

/**
 * One acknowledged-deletion surface: title, destruction preview, an explicit
 * Cancel, and a Confirm that commits through `commitDeleteTrack(layerId,
 * trackId, true)`. The Confirm is disabled for the last surviving Paint track
 * (D-17) and the handler re-guards so even a stray click never commits.
 */
export function PhysicsPaintDeleteTrackDialog(props: PhysicsPaintDeleteTrackDialogProps) {
  const { layerId, trackName, preview, onCancel, onStatus } = props;
  const handleConfirm = () => {
    // D-17 belt: the store refuses the last surviving Paint track anyway, but
    // the dialog must never fire the intent in that state.
    if (preview.isLastTrack) return;
    const result = commitDeleteTrack(layerId, preview.trackId, true);
    onStatus?.(result.ok ? null : result.error);
  };
  const frameCopy = `${preview.frameCount} ${preview.frameCount === 1 ? 'frame' : 'frames'}`;
  const loopClipCopy = `${preview.loopClipCount} ${preview.loopClipCount === 1 ? 'loop clip' : 'loop clips'}`;
  const holdReferenceCopy = `${preview.holdReferenceCount} ${preview.holdReferenceCount === 1 ? 'Hold reference' : 'Hold references'}`;
  return (
    <div class="physics-paint-delete-track-dialog" role="alertdialog" aria-label={`Delete track ${trackName}?`}>
      <div class="physics-paint-delete-track-dialog-title">Delete track {trackName}?</div>
      <p class="physics-paint-delete-track-dialog-detail">
        {`${frameCopy}, ${loopClipCopy}, and ${holdReferenceCopy} will be removed from the timeline.`}
      </p>
      {preview.isLastTrack ? (
        <p class="physics-paint-delete-track-dialog-refusal">At least one Paint track is required.</p>
      ) : null}
      <div class="physics-paint-delete-track-dialog-actions">
        <button
          type="button"
          class="physics-paint-delete-track-cancel"
          aria-label="Cancel delete"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="button"
          class="physics-paint-delete-track-confirm"
          aria-label={`Delete track ${trackName}`}
          aria-disabled={preview.isLastTrack ? 'true' : undefined}
          disabled={preview.isLastTrack}
          onClick={handleConfirm}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
