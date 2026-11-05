import { useEffect, useRef } from 'preact/hooks';
import { X } from 'lucide-preact';
import type {
  RotoRailConversionDialogBundle,
  RotoRailConversionRailKind,
} from '../hooks/useRotoTimelineActions';

const RAIL_KIND_LABEL: Record<RotoRailConversionRailKind, string> = {
  motion: 'Motion',
  static: 'Static',
  reveal: 'Reveal',
};

/**
 * Quick 261105-raf: the one-shot `Edit this rail?` prompt.
 *
 * A + Key or a paint promotion on an empty frame strictly AFTER a
 * script-generated Motion / Static / Reveal rail asks once before anything is
 * committed. `Convert to Standard` reproduces the shipped 261105-p9i dissolve;
 * `New rail` — also the Escape and header-close answer — is the
 * NON-DESTRUCTIVE choice: the scripted rail and its Loop Clip stay untouched
 * and the edit lands as a detached key.
 *
 * The hook owns the transient request signal and the deferred resolver; this
 * component only reads the signal and calls `answer`. Same floating shell as
 * the Play Script dialog: no dimming backdrop, no full-screen pointer blocker,
 * no focus trap — the viewport root is pointer-events:none and only the surface
 * accepts pointer input, so the rest of the Studio stays interactive. Signals
 * only: no useState, no signal writes in the render body.
 */
export function PhysicsPaintRailConversionDialog({
  request,
  answer,
}: RotoRailConversionDialogBundle) {
  const primaryRef = useRef<HTMLButtonElement>(null);
  const pending = request.value;

  // Focus the primary action on open. The effect re-fires only when a NEW
  // request object arrives (identity-stable while the prompt is pending).
  useEffect(() => {
    if (pending !== null) primaryRef.current?.focus();
  }, [pending]);

  if (pending === null) return null;

  const railKind = RAIL_KIND_LABEL[pending.railKind];

  return (
    <div
      class="physics-paint-play-script-dialog physics-paint-rail-conversion-dialog"
      role="dialog"
      aria-labelledby="physics-rail-conversion-title"
      onKeyDown={(event) => {
        // Studio shortcuts must never fire from inside the prompt.
        event.stopPropagation();
        if (event.key !== 'Escape') return;
        event.preventDefault();
        // Escape resolves the NON-destructive choice.
        answer('new-rail');
      }}
    >
      <div class="physics-paint-rail-conversion-surface">
        <div class="physics-paint-rail-conversion-header">
          <strong id="physics-rail-conversion-title">Edit this rail?</strong>
          <button
            type="button"
            class="physics-paint-play-script-close"
            aria-label="Close"
            onPointerDown={(event) => { event.stopPropagation(); }}
            onClick={() => answer('new-rail')}
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
        <p class="physics-paint-rail-conversion-body">
          {`This ${railKind} rail is script-generated. Convert it to Standard to keep your edit — Regenerate will no longer rebuild it.`}
        </p>
        <div class="physics-paint-rail-conversion-actions physics-paint-play-script-actions">
          <button
            type="button"
            class="physics-paint-play-script-button physics-paint-play-script-button-ghost"
            onClick={() => answer('new-rail')}
          >
            New rail
          </button>
          <button
            ref={primaryRef}
            type="button"
            class="physics-paint-play-script-button physics-paint-play-script-button-primary"
            onClick={() => answer('convert')}
          >
            Convert to Standard
          </button>
        </div>
      </div>
    </div>
  );
}
