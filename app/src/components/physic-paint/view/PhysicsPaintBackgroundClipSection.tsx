import { useSignal } from '@preact/signals';
import type { Signal } from '@preact/signals';
import { Trash2 } from 'lucide-preact';
import type { EfxPaintDocument, FrameLoopClip, FrameLoopClipRepeat, FrameLoopClipScale } from '../../../efx-paint/document/efxPaintDocument';
import type { BackgroundClipMutationResult } from '../../../stores/efxPaintStore';

/**
 * 49-06 (Task 1, S5): the right-panel `Background Clip` properties section.
 *
 * Clicking a Bg clip rail selects it (49-05 port: onSelectBackgroundClip →
 * selectedBackgroundClipId); this section reads that selection signal and the
 * document, and renders the selected clip's start frame, repeat (numeric +
 * ∞ toggle), source cycle fact, and dialog-free delete — all from ACCEPTED
 * document state only (no optimistic facts, UI-SPEC busy rule). With no clip
 * selected the section renders nothing and the right panel shows the active
 * Track section as today (mutually exclusive mount, UI-SPEC empty row).
 *
 * The repeat control reuses the PlayScript numeric-input idiom verbatim in
 * behavior (D-06): commit on blur/Enter, invalid input never commits, the
 * prior accepted value stays visible, and the `Enter a positive integer.`
 * hint shows in the error treatment. The ∞ toggle is a button with
 * `aria-pressed` reflecting state (UI-SPEC accessibility).
 *
 * Signals-only state (efx-preact-reactivity): the controller holds the repeat
 * draft, the validation error, and the last finite count in signals; the view
 * reads the selection signal and the document via narrow reads. The section is
 * keyed by clip id at the mount site so a selection change remounts it with
 * fresh draft state (no effect-driven draft sync).
 */

export interface PhysicsPaintBackgroundClipSectionPorts {
  /** Document read — the section never holds its own truth (key_links). */
  getDocument: (layerId: string) => EfxPaintDocument | undefined;
  /** 49-02 store op: setBackgroundClipRepeat(layerId, clipId, repeat). */
  setRepeat: (layerId: string, clipId: string, repeat: FrameLoopClipRepeat) => BackgroundClipMutationResult;
  /** 49-02 store op: deleteBackgroundClip(layerId, clipId) — no dialog (D-08). */
  deleteClip: (layerId: string, clipId: string) => BackgroundClipMutationResult;
  /** 49-06 (UAT round 9): setBackgroundClipScale(layerId, clipId, scale). */
  setScale: (layerId: string, clipId: string, scale: FrameLoopClipScale) => BackgroundClipMutationResult;
  /** 49-06 (UAT round 7): open the picker in replace mode for this clip. */
  replaceSource: (layerId: string, clipId: string) => void;
  /** sourceRef → original filename (D-02: natural order is the stored refs order). */
  resolveFilename: (sourceRef: string) => string | undefined;
}

export interface PhysicsPaintBackgroundClipSectionProps {
  layerId: string;
  /** 49-05 selection port — the section reads the selected clip id from it. */
  selectedBackgroundClipId: Signal<string | null>;
  /** Injectable ports for tests; production defaults hit the real store. */
  ports?: Partial<PhysicsPaintBackgroundClipSectionPorts>;
}

export interface PhysicsPaintBackgroundClipSectionController {
  clip: FrameLoopClip | undefined;
  repeatDraft: Signal<string>;
  repeatError: Signal<string | null>;
  isInfinite: boolean;
  filenames: string[];
  scaleXDraft: Signal<string>;
  scaleYDraft: Signal<string>;
  scaleGlobalDraft: Signal<string>;
  scaleError: Signal<string | null>;
  commitScaleX: () => void;
  commitScaleY: () => void;
  commitScaleGlobal: () => void;
  commitRepeat: () => void;
  toggleInfinity: (enabled: boolean) => void;
  handleDelete: () => void;
  handleReplace: () => void;
}

/** The locked repeat hint copy (UI-SPEC Copywriting Contract). */
export const BACKGROUND_REPEAT_HINT = 'Enter a positive integer.';

/** 49-06 (UAT round 9): the locked scale hint copy. */
export const BACKGROUND_SCALE_HINT = 'Enter a positive number.';

/** PlayScript parseRepeat idiom (D-06): digits only, safe integer >= 1. */
function parsePositiveInteger(text: string): number | null {
  const trimmed = text.trim();
  if (!trimmed || !/^\d+$/.test(trimmed)) return null;
  const count = Number(trimmed);
  if (!Number.isSafeInteger(count) || count <= 0) return null;
  return count;
}

/** 49-06 (UAT round 9): a finite positive percentage (decimals allowed). */
function parsePositiveNumber(text: string): number | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

export function usePhysicsPaintBackgroundClipSectionController({
  layerId,
  selectedBackgroundClipId,
  ports = {},
}: PhysicsPaintBackgroundClipSectionProps): PhysicsPaintBackgroundClipSectionController {
  const getDocument = ports.getDocument ?? defaultPorts.getDocument;
  const setRepeat = ports.setRepeat ?? defaultPorts.setRepeat;
  const setScale = ports.setScale ?? defaultPorts.setScale;
  const deleteClip = ports.deleteClip ?? defaultPorts.deleteClip;
  const replaceSource = ports.replaceSource ?? defaultPorts.replaceSource;
  const resolveFilename = ports.resolveFilename ?? defaultPorts.resolveFilename;

  const selectedClipId = selectedBackgroundClipId.value;
  const document = getDocument(layerId);
  const clip = selectedClipId
    ? document?.background.clips.find((candidate) => candidate.id === selectedClipId)
    : undefined;
  // 49-06 (UAT round 9): the scale is OPTIONAL on the raw clip type (older
  // documents) — the parser and consumers fall back to 100/100.
  const clipScale = clip?.scale ?? { x: 100, y: 100 };

  // Draft state is keyed by clip id at the mount site, so these signals are
  // created fresh per selected clip (no effect-driven sync needed).
  const repeatDraft = useSignal<string>(clip?.repeat.mode === 'finite' ? String(clip.repeat.count) : '');
  const repeatError = useSignal<string | null>(null);
  const lastFiniteCount = useSignal<number>(clip?.repeat.mode === 'finite' ? clip.repeat.count : 1);
  // 49-06 (UAT round 9): the scale drafts — X%, Y%, and the Global % that sets
  // both axes to the same value. Commit on blur/Enter; invalid input never
  // commits and the prior accepted value stays visible.
  const scaleXDraft = useSignal<string>(clip ? String(clipScale.x) : '100');
  const scaleYDraft = useSignal<string>(clip ? String(clipScale.y) : '100');
  const scaleGlobalDraft = useSignal<string>(clip ? String(clipScale.x) : '100');
  const scaleError = useSignal<string | null>(null);

  const commitScaleAxis = (axis: 'x' | 'y', draft: Signal<string>) => {
    if (!clip) return;
    const value = parsePositiveNumber(draft.value);
    if (value === null) {
      scaleError.value = BACKGROUND_SCALE_HINT;
      draft.value = String(axis === 'x' ? clipScale.x : clipScale.y);
      return;
    }
    const next = axis === 'x' ? { x: value, y: clipScale.y } : { x: clipScale.x, y: value };
    const result = setScale(layerId, clip.id, next);
    if (!result.ok) {
      scaleError.value = BACKGROUND_SCALE_HINT;
      draft.value = String(axis === 'x' ? clipScale.x : clipScale.y);
      return;
    }
    scaleError.value = null;
  };

  const commitScaleGlobal = () => {
    if (!clip) return;
    const value = parsePositiveNumber(scaleGlobalDraft.value);
    if (value === null) {
      scaleError.value = BACKGROUND_SCALE_HINT;
      scaleGlobalDraft.value = String(clipScale.x);
      return;
    }
    const result = setScale(layerId, clip.id, { x: value, y: value });
    if (!result.ok) {
      scaleError.value = BACKGROUND_SCALE_HINT;
      scaleGlobalDraft.value = String(clipScale.x);
      return;
    }
    scaleError.value = null;
  };

  const commitRepeat = () => {
    if (!clip) return;
    const count = parsePositiveInteger(repeatDraft.value);
    if (count === null) {
      repeatError.value = BACKGROUND_REPEAT_HINT;
      repeatDraft.value = clip.repeat.mode === 'finite' ? String(clip.repeat.count) : '';
      return;
    }
    const result = setRepeat(layerId, clip.id, { mode: 'finite', count });
    if (!result.ok) {
      if (result.reason === 'invalid-repeat') {
        repeatError.value = BACKGROUND_REPEAT_HINT;
        repeatDraft.value = clip.repeat.mode === 'finite' ? String(clip.repeat.count) : '';
      }
      return;
    }
    repeatError.value = null;
  };

  const toggleInfinity = (enabled: boolean) => {
    if (!clip) return;
    if (enabled) {
      if (clip.repeat.mode === 'finite') lastFiniteCount.value = clip.repeat.count;
      const result = setRepeat(layerId, clip.id, { mode: 'infinite' });
      if (result.ok) repeatError.value = null;
    } else {
      repeatDraft.value = String(lastFiniteCount.value);
      const result = setRepeat(layerId, clip.id, { mode: 'finite', count: lastFiniteCount.value });
      if (result.ok) repeatError.value = null;
    }
  };

  const handleDelete = () => {
    if (!clip) return;
    // D-08: plain undoable delete — no confirmation dialog.
    const result = deleteClip(layerId, clip.id);
    // 49-06 (UAT): deleting the SELECTED clip must clear the selection so the
    // Track section is reachable again (a stale selection id would otherwise
    // blank the Track tab — the section renders null for a missing clip).
    if (result.ok) selectedBackgroundClipId.value = null;
  };

  const handleReplace = () => {
    if (!clip) return;
    // 49-06 (UAT round 7): open the picker in replace mode — the Studio wires
    // this port to target the selected clip; the confirm path swaps the source.
    replaceSource(layerId, clip.id);
  };

  const filenames = clip
    ? clip.sourceFrameRefs
        .map((ref) => resolveFilename(ref))
        .filter((name): name is string => Boolean(name))
    : [];

  return {
    clip,
    repeatDraft,
    repeatError,
    isInfinite: clip?.repeat.mode === 'infinite',
    filenames,
    scaleXDraft,
    scaleYDraft,
    scaleGlobalDraft,
    scaleError,
    commitScaleX: () => commitScaleAxis('x', scaleXDraft),
    commitScaleY: () => commitScaleAxis('y', scaleYDraft),
    commitScaleGlobal,
    commitRepeat,
    toggleInfinity,
    handleDelete,
    handleReplace,
  };
}

export function PhysicsPaintBackgroundClipSection(props: PhysicsPaintBackgroundClipSectionProps) {
  const {
    clip, repeatDraft, repeatError, isInfinite, filenames, commitRepeat, toggleInfinity, handleDelete, handleReplace,
    scaleXDraft, scaleYDraft, scaleGlobalDraft, scaleError, commitScaleX, commitScaleY, commitScaleGlobal,
  } = usePhysicsPaintBackgroundClipSectionController(props);
  if (!clip) return null;
  return (
    <section class="physics-paint-right-section physics-paint-bg-clip-section" aria-label="Background Clip">
      <span class="physics-paint-section-heading">Background Clip</span>
      <div class="physics-paint-option-group">
        <div class="physics-paint-option-row">
          <span class="physics-paint-right-label">Start frame</span>
          <span class="physics-paint-bg-clip-value">{clip.startFrame}</span>
        </div>
        <div class="physics-paint-option-row">
          <span class="physics-paint-right-label">Repeat</span>
          <input
            class="physics-paint-bg-repeat-input"
            aria-label="Repeat"
            aria-invalid={Boolean(repeatError.value)}
            aria-describedby="physics-bg-repeat-hint"
            inputMode="numeric"
            value={repeatDraft.value}
            disabled={isInfinite}
            onInput={(event) => {
              repeatError.value = null;
              repeatDraft.value = (event.currentTarget as HTMLInputElement).value;
            }}
            onBlur={commitRepeat}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commitRepeat();
            }}
          />
          <button
            type="button"
            class="physics-paint-bg-repeat-infinity"
            aria-label="Loop indefinitely"
            aria-pressed={isInfinite}
            onClick={() => toggleInfinity(!isInfinite)}
          >
            ∞
          </button>
        </div>
        <span
          id="physics-bg-repeat-hint"
          class={`physics-paint-bg-repeat-hint${repeatError.value ? ' physics-paint-bg-repeat-hint-error' : ''}`}
        >
          {BACKGROUND_REPEAT_HINT}
        </span>
        <div class="physics-paint-option-row">
          <span class="physics-paint-right-label">Source</span>
          <span class="physics-paint-bg-clip-value" title={filenames.join('\n')}>
            {clip.sourceFrameRefs.length} image(s)
          </span>
        </div>
        {/* 49-06 (UAT round 9): the resize % controls — Global sets both axes,
            X and Y scale each independently (100 = the contain-fit base). */}
        <div class="physics-paint-option-row">
          <span class="physics-paint-right-label">Global %</span>
          <input
            class="physics-paint-bg-scale-input"
            aria-label="Global scale percent"
            aria-invalid={Boolean(scaleError.value)}
            inputMode="decimal"
            value={scaleGlobalDraft.value}
            onInput={(event) => {
              scaleError.value = null;
              scaleGlobalDraft.value = (event.currentTarget as HTMLInputElement).value;
            }}
            onBlur={commitScaleGlobal}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commitScaleGlobal();
            }}
          />
        </div>
        <div class="physics-paint-option-row">
          <span class="physics-paint-right-label">X %</span>
          <input
            class="physics-paint-bg-scale-input"
            aria-label="X scale percent"
            aria-invalid={Boolean(scaleError.value)}
            inputMode="decimal"
            value={scaleXDraft.value}
            onInput={(event) => {
              scaleError.value = null;
              scaleXDraft.value = (event.currentTarget as HTMLInputElement).value;
            }}
            onBlur={commitScaleX}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commitScaleX();
            }}
          />
        </div>
        <div class="physics-paint-option-row">
          <span class="physics-paint-right-label">Y %</span>
          <input
            class="physics-paint-bg-scale-input"
            aria-label="Y scale percent"
            aria-invalid={Boolean(scaleError.value)}
            inputMode="decimal"
            value={scaleYDraft.value}
            onInput={(event) => {
              scaleError.value = null;
              scaleYDraft.value = (event.currentTarget as HTMLInputElement).value;
            }}
            onBlur={commitScaleY}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commitScaleY();
            }}
          />
        </div>
        <span
          class={`physics-paint-bg-repeat-hint${scaleError.value ? ' physics-paint-bg-repeat-hint-error' : ''}`}
        >
          {BACKGROUND_SCALE_HINT}
        </span>
        <div class="physics-paint-bg-clip-actions">
          <button
            type="button"
            class="physics-paint-bg-replace-button"
            aria-label="Replace image"
            title="Replace image"
            onClick={handleReplace}
          >
            Replace
          </button>
          <button
            type="button"
            class="physics-paint-bg-delete-button destructive"
            aria-label="Delete clip"
            title="Delete clip"
            onClick={handleDelete}
          >
            <Trash2 size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}

/** Production ports — the real store ops and the imageStore filename resolver. */
const defaultPorts: PhysicsPaintBackgroundClipSectionPorts = {
  getDocument: () => undefined,
  setRepeat: () => ({ ok: false, reason: 'clip-not-found' }),
  setScale: () => ({ ok: false, reason: 'clip-not-found' }),
  deleteClip: () => ({ ok: false, reason: 'clip-not-found' }),
  replaceSource: () => {},
  resolveFilename: () => undefined,
};
