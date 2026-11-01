import type { Ref } from 'preact';
import { SliderStepper } from '../../shared/SliderStepper';
import type {
  RotoPlayScriptController,
  RotoPlayScriptIdenticalSourceCycle,
  RotoPlayScriptMode,
  RotoPlayScriptStackCollision,
  RotoPlayScriptStackRunKind,
} from '../roto/physicsPaintRotoPlayScriptController';
import {
  RUN_SCRIPT_OVERWRITE_COPY,
  type RunScriptCollisionOffer,
  type RunScriptStackReadout,
} from '../roto/physicsPaintRotoRunScriptStacking';

/* The Run Script dialog's cards as standalone views. Creation, a stack run and
   the Reveal tab compose the SAME cards; only the composition chooses which
   cards render. Redesign a card here without touching the dialog's state flow. */

const PLAY_SCRIPT_MODES: ReadonlyArray<{ value: RotoPlayScriptMode; label: string }> = [
  { value: 'progressive', label: 'Motion' },
  { value: 'static', label: 'Static' },
];

const REVEAL_RAIL_TYPES: ReadonlyArray<{ value: RotoPlayScriptMode; label: string }> = [
  { value: 'progressive', label: 'Reveal Motion' },
  { value: 'static', label: 'Reveal Static' },
];

// 261101-1pc (Quick C2): the 2×2 Rail Type grid for a stack RUN. The kind is
// dialog state only — the merged Standard Rail still stores the destination's
// mode, and a Reveal kind renders the run's wash through the document reference.
const STACK_RUN_KINDS: ReadonlyArray<{ value: RotoPlayScriptStackRunKind; label: string }> = [
  { value: 'motion', label: 'Motion' },
  { value: 'static', label: 'Static' },
  { value: 'reveal-motion', label: 'Reveal Motion' },
  { value: 'reveal-static', label: 'Reveal Static' },
];

const PLAY_SCRIPT_SOURCE_CHOICES = [
  { value: 'link' as const, label: 'Link to existing cycle', helper: 'Reuses the existing source cycle. Future source edits update every linked loop.' },
  { value: 'create' as const, label: 'Create new cycle', helper: 'Creates an independent source cycle. Future edits do not affect the existing loops.' },
];

const PLAY_SCRIPT_COLORS: ReadonlyArray<{ value: boolean; label: string }> = [
  { value: false, label: 'Original colors' },
  { value: true, label: 'Custom color' },
];

const ORIGINAL_COLOR_DOTS = ['#d2654d', '#2d9d6c', '#5a7bd4', '#d4699e'];

function clampMotionValue(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.trunc(value)));
}

function dialogIntegerValue(text: string, floor: number): number {
  const trimmed = text.trim();
  const parsed = Number(trimmed);
  return trimmed !== '' && Number.isSafeInteger(parsed) && parsed >= floor ? parsed : floor;
}

// The top-bar Script switch's visuals, compacted for the dialog cards. Inline
// markup (not a component) so this dialog's node-tree tests see the label text.
function dialogSwitch(props: {
  id: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      id={props.id}
      class={`physics-paint-script-switch physics-paint-play-script-switch${props.checked ? ' is-on' : ''}`}
      role="switch"
      aria-checked={props.checked ? 'true' : 'false'}
      disabled={props.disabled}
      onClick={props.onClick}
    >
      <span class="physics-paint-script-switch-track" aria-hidden="true">
        <span class="physics-paint-script-switch-knob" />
      </span>
      <span class="physics-paint-script-switch-label">{props.label}</span>
    </button>
  );
}

// One APG radio group for Rail Type / Color / Source cycle: arrow keys move
// focus AND check with wrap-around, and the checked option is the single Tab stop.
export function DialogRadioGroup<T extends string | boolean,>(props: {
  ariaLabel: string;
  describedBy?: string;
  options: ReadonlyArray<{ readonly value: T; readonly label: string }>;
  value: T;
  /** Keyboard navigation must read the LIVE value; the rendered prop can be stale between renders. */
  getValue?: () => T;
  disabled: boolean;
  onSelect: (value: T) => void;
}) {
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    if (props.disabled) return;
    const current = props.getValue?.() ?? props.value;
    const currentIndex = props.options.findIndex((option) => option.value === current);
    const delta = event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = (currentIndex + delta + props.options.length) % props.options.length;
    props.onSelect(props.options[nextIndex]!.value);
    const radios = (event.currentTarget as HTMLElement | null)?.querySelectorAll?.('[role="radio"]');
    (radios?.[nextIndex] as HTMLElement | undefined)?.focus?.();
  };
  return (
    <div
      class="physics-paint-play-script-mode-group"
      role="radiogroup"
      aria-label={props.ariaLabel}
      aria-describedby={props.describedBy}
      onKeyDown={onKeyDown}
    >
      {props.options.map((option) => {
        const checked = props.value === option.value;
        return (
          <div
            key={String(option.value)}
            class="physics-paint-play-script-mode-option"
            role="radio"
            aria-checked={checked}
            aria-disabled={props.disabled}
            tabIndex={!props.disabled && checked ? 0 : -1}
            onClick={(event) => {
              if (props.disabled) return;
              props.onSelect(option.value);
              (event.currentTarget as HTMLElement | null)?.focus?.();
            }}
          >
            {option.label}
          </div>
        );
      })}
    </div>
  );
}

export function RailTypeCard(props: {
  playScript: RotoPlayScriptController;
  revealTab: boolean;
  busy: boolean;
  locked: boolean;
  stacking: boolean;
  /** 261031-vbo (Quick C1): a merged edit target has no editable rail type —
   *  the stored `mode` is internal and must never render as Motion/Static. */
  standard?: boolean;
}) {
  const options = props.revealTab ? REVEAL_RAIL_TYPES : PLAY_SCRIPT_MODES;
  return (
    <div class={`physics-paint-play-script-card physics-paint-play-script-card-wide physics-paint-play-script-card-mode${props.locked ? ' physics-paint-play-script-locked' : ''}`}>
      <span class="physics-paint-play-script-card-title">Rail Type</span>
      {props.standard ? (
        <span class="physics-paint-play-script-standard-rail-value">Standard</span>
      ) : props.stacking ? (
        /* 261101-1pc (Quick C2): a stack picks the run kind, which derives the
           single bake mode. Creation and the Reveal tab keep their two-option
           group bound to `mode`. */
        <DialogRadioGroup
          ariaLabel="Rail Type"
          options={STACK_RUN_KINDS}
          value={props.playScript.stackRunKind.value}
          getValue={() => props.playScript.stackRunKind.value}
          disabled={props.busy || props.locked}
          onSelect={(value) => { props.playScript.setStackRunKind(value); }}
        />
      ) : (
        <DialogRadioGroup
          ariaLabel="Rail Type"
          options={options}
          value={props.playScript.mode.value}
          getValue={() => props.playScript.mode.value}
          disabled={props.busy || props.locked}
          onSelect={(value) => { props.playScript.mode.value = value; }}
        />
      )}
      {props.stacking ? (
        <span class="physics-paint-play-script-mode-helper">
          This run merges into the rail — the result is one Standard Rail.
        </span>
      ) : null}
    </div>
  );
}

export function ColorCard(props: {
  playScript: RotoPlayScriptController;
  busy: boolean;
  locked: boolean;
  stacking: boolean;
  colorValue: string;
}) {
  return (
    <div class={`physics-paint-play-script-card physics-paint-play-script-card-color${props.locked ? ' physics-paint-play-script-locked' : ''}`}>
      <div class="physics-paint-play-script-card-heading">
        <span class="physics-paint-play-script-card-title">Color</span>
        <span class="physics-paint-play-script-color-dots" aria-hidden="true">
          {ORIGINAL_COLOR_DOTS.map((color) => <i key={color} style={{ background: color }} />)}
        </span>
      </div>
      <DialogRadioGroup
        ariaLabel="Color"
        options={PLAY_SCRIPT_COLORS}
        value={props.playScript.overrideEnabled.value}
        getValue={() => props.playScript.overrideEnabled.value}
        disabled={props.busy || props.locked}
        onSelect={(value) => { props.playScript.overrideEnabled.value = value; }}
      />
      {props.playScript.overrideEnabled.value ? (
        <div class="physics-paint-play-script-color-pane">
          <div class="physics-paint-play-script-color-custom-row">
            <span class="physics-paint-play-script-override-chip" style={{ backgroundColor: props.colorValue }} />
            <div class="physics-paint-play-script-color-meta">
              <span class="physics-paint-play-script-color-hex">{props.colorValue}</span>
              {props.stacking ? (
                <button
                  type="button"
                  class="physics-paint-play-script-heading-link"
                  title="Use the app's current brush color"
                  disabled={props.busy}
                  onClick={props.playScript.useBrushColor}
                >
                  Use brush color
                </button>
              ) : (
                <span class="physics-paint-play-script-color-note">Picked from the app's brush color panel</span>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function MotionWiggleCard(props: {
  playScript: RotoPlayScriptController;
  busy: boolean;
  locked: boolean;
}) {
  const set = (key: 'deformation' | 'position' | 'rotation' | 'scale') => (value: number) => {
    props.playScript.dialogMotion.value = { ...props.playScript.dialogMotion.value, [key]: clampMotionValue(value) };
  };
  const disabled = props.busy || props.locked;
  return (
    <div class={`physics-paint-play-script-card physics-paint-play-script-card-motion${props.locked ? ' physics-paint-play-script-locked' : ''}`}>
      <div class="physics-paint-play-script-card-heading">
        <span class="physics-paint-play-script-card-title">Motion wiggle</span>
        <button
          type="button"
          class="physics-paint-play-script-heading-link"
          disabled={disabled}
          onClick={() => props.playScript.resetDialogMotion()}
        >
          Reset defaults
        </button>
      </div>
      <div class="physics-paint-play-script-motion-rows">
        <SliderStepper
          id="physics-play-script-motion-deformation"
          label="Deformation"
          ariaLabel="Deformation"
          value={props.playScript.dialogMotion.value.deformation}
          onChange={set('deformation')}
          min={0}
          max={100}
          step={1}
          disabled={disabled}
        />
        <SliderStepper
          id="physics-play-script-motion-position"
          label="Position"
          ariaLabel="Position"
          value={props.playScript.dialogMotion.value.position}
          onChange={set('position')}
          min={0}
          max={100}
          step={1}
          disabled={disabled}
        />
        <SliderStepper
          id="physics-play-script-motion-rotation"
          label="Rotation"
          ariaLabel="Rotation"
          value={props.playScript.dialogMotion.value.rotation}
          onChange={set('rotation')}
          min={0}
          max={100}
          step={1}
          disabled={disabled}
        />
        <SliderStepper
          id="physics-play-script-motion-scale"
          label="Scale"
          ariaLabel="Scale"
          value={props.playScript.dialogMotion.value.scale}
          onChange={set('scale')}
          min={0}
          max={100}
          step={1}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

export function ColorizeCard(props: { playScript: RotoPlayScriptController; busy: boolean }) {
  return (
    <div class="physics-paint-play-script-card physics-paint-play-script-card-colorize">
      <div class="physics-paint-play-script-card-heading">
        <span class="physics-paint-play-script-card-title">Colorize</span>
      </div>
      {dialogSwitch({
        id: 'physics-play-script-colorize',
        label: 'Colorize with wash color',
        checked: props.playScript.colorize.value,
        disabled: props.busy,
        onClick: () => props.playScript.setColorize(!props.playScript.colorize.value),
      })}
      <label class="physics-paint-play-script-slider-row" for="physics-play-script-colorize-mix">
        <span>Mix</span>
        <input
          id="physics-play-script-colorize-mix"
          type="range"
          min={0}
          max={100}
          value={props.playScript.colorizeMix.value}
          disabled={props.busy || !props.playScript.colorize.value}
          onInput={(event) => props.playScript.setColorizeMix(Number((event.currentTarget as HTMLInputElement).value))}
        />
        <output>{props.playScript.colorizeMix.value}</output>
      </label>
    </div>
  );
}

export function PhotoWiggleCard(props: { playScript: RotoPlayScriptController; busy: boolean }) {
  return (
    <div class="physics-paint-play-script-card physics-paint-play-script-card-photo-wiggle">
      <div class="physics-paint-play-script-card-heading">
        <span class="physics-paint-play-script-card-title">Photo wiggle</span>
      </div>
      {dialogSwitch({
        id: 'physics-play-script-photo-wiggle',
        label: 'Wiggle photo and wash together',
        checked: props.playScript.photoWiggle.value,
        disabled: props.busy,
        onClick: () => props.playScript.setPhotoWiggle(!props.playScript.photoWiggle.value),
      })}
    </div>
  );
}

export function PaintSeedCard(props: { playScript: RotoPlayScriptController; busy: boolean }) {
  return (
    <div class="physics-paint-play-script-card physics-paint-play-script-card-paint-seed-variation">
      <div class="physics-paint-play-script-card-heading">
        <span class="physics-paint-play-script-card-title">Paint seed variation</span>
      </div>
      {dialogSwitch({
        id: 'physics-play-script-paint-seed-variation',
        label: 'Vary the brush texture per frame',
        checked: props.playScript.paintSeedVariation.value,
        disabled: props.busy,
        onClick: () => props.playScript.setPaintSeedVariation(!props.playScript.paintSeedVariation.value),
      })}
    </div>
  );
}

export function KeyScriptCard(props: { playScript: RotoPlayScriptController; busy: boolean }) {
  return (
    <div class="physics-paint-play-script-card physics-paint-play-script-card-key-script">
      <span class="physics-paint-play-script-card-title">Key Script Editing</span>
      {dialogSwitch({
        id: 'physics-play-script-key-script-edits',
        label: 'Save script on each key',
        checked: props.playScript.keyScriptEdits.value,
        disabled: props.busy,
        onClick: () => props.playScript.setKeyScriptEdits(!props.playScript.keyScriptEdits.value),
      })}
    </div>
  );
}

export function SourceCycleCard(props: {
  playScript: RotoPlayScriptController;
  identicalCycle: RotoPlayScriptIdenticalSourceCycle;
  busy: boolean;
}) {
  const active = PLAY_SCRIPT_SOURCE_CHOICES.find((option) => option.value === props.playScript.linkChoice.value)
    ?? PLAY_SCRIPT_SOURCE_CHOICES[0]!;
  return (
    <div class="physics-paint-play-script-card physics-paint-play-script-card-wide physics-paint-play-script-card-source-choice">
      <span class="physics-paint-play-script-card-title">Source cycle</span>
      <DialogRadioGroup
        ariaLabel="Source cycle"
        describedBy="physics-play-script-source-helper"
        options={PLAY_SCRIPT_SOURCE_CHOICES}
        value={props.playScript.linkChoice.value}
        getValue={() => props.playScript.linkChoice.value}
        disabled={props.busy}
        onSelect={(value) => { props.playScript.linkChoice.value = value; }}
      />
      <span id="physics-play-script-source-helper" class="physics-paint-play-script-mode-helper">
        {active.helper}
        {props.playScript.linkChoice.value === 'link'
          ? ` Source F${props.identicalCycle.sourceStart}–F${props.identicalCycle.sourceStart + props.identicalCycle.sourceKeyIds.length - 1} · ${props.identicalCycle.loopCount} linked loop(s).`
          : ''}
      </span>
    </div>
  );
}

export function PaintTimingCard(props: {
  playScript: RotoPlayScriptController;
  busy: boolean;
  locked: boolean;
  stacking: boolean;
  inputRef: Ref<HTMLInputElement>;
  repeatInputRef: Ref<HTMLInputElement>;
}) {
  const perCycle = props.playScript.mode.value === 'static' || props.locked;
  return (
    <div class="physics-paint-play-script-card physics-paint-play-script-card-timing">
      <span class="physics-paint-play-script-card-title">Timing</span>
      <div class="physics-paint-play-script-timing-grid">
        <div class={`physics-paint-play-script-field${props.locked ? ' physics-paint-play-script-locked' : ''}`}>
          <SliderStepper
            id="physics-play-script-count"
            inputRef={props.inputRef}
            label={perCycle ? 'Frames per cycle' : 'Frames'}
            ariaLabel={perCycle ? 'Frames per cycle' : 'Frames'}
            value={dialogIntegerValue(props.playScript.countText.value, 1)}
            onChange={(value) => { props.playScript.countText.value = String(value); }}
            min={1}
            max={Math.max(1, props.playScript.framesMax.value)}
            sliderMax={Math.max(1, props.playScript.framesMax.value)}
            step={1}
            {...(props.stacking ? { allowOutOfRangeEntry: true } : {})}
            disabled={props.busy || props.locked || props.playScript.max.value}
            ariaInvalid={Boolean(props.playScript.validationError.value)}
            ariaDescribedBy={props.playScript.validationError.value ? 'physics-play-script-error' : undefined}
          />
          <div class="physics-paint-play-script-timing-foot">
            {dialogSwitch({
              id: 'physics-play-script-max',
              label: 'Max',
              checked: props.playScript.max.value,
              disabled: props.busy || props.locked,
              onClick: () => props.playScript.setMax(!props.playScript.max.value),
            })}
          </div>
          {props.playScript.validationError.value ? <span id="physics-play-script-error" class="physics-paint-script-inline-error">{props.playScript.validationError.value}</span> : null}
        </div>
        {props.stacking ? null : (
          <div class="physics-paint-play-script-field">
            <SliderStepper
              id="physics-play-script-repeat"
              inputRef={props.repeatInputRef}
              label="Cycle"
              ariaLabel="Cycle"
              value={dialogIntegerValue(props.playScript.repeatText.value, 1)}
              onChange={(value) => { props.playScript.repeatText.value = String(value); }}
              min={1}
              sliderMax={16}
              step={1}
              disabled={props.busy || props.playScript.infinity.value}
              ariaInvalid={Boolean(props.playScript.repeatError.value)}
              ariaDescribedBy={props.playScript.repeatError.value ? 'physics-play-script-repeat-error' : undefined}
            />
            <div class="physics-paint-play-script-timing-foot">
              {dialogSwitch({
                id: 'physics-play-script-infinity',
                label: 'Infinity',
                checked: props.playScript.infinity.value,
                disabled: props.busy,
                onClick: () => props.playScript.setInfinity(!props.playScript.infinity.value),
              })}
            </div>
            {props.playScript.repeatError.value ? <span id="physics-play-script-repeat-error" class="physics-paint-script-inline-error">{props.playScript.repeatError.value}</span> : null}
          </div>
        )}
      </div>
    </div>
  );
}

export function RevealTimingCard(props: {
  playScript: RotoPlayScriptController;
  busy: boolean;
  inputRef: Ref<HTMLInputElement>;
}) {
  return (
    <div class="physics-paint-play-script-card physics-paint-play-script-card-timing">
      <span class="physics-paint-play-script-card-title">Timing</span>
      <div class="physics-paint-play-script-timing-grid">
        <div class="physics-paint-play-script-field">
          <SliderStepper
            id="physics-play-script-reveal-count"
            inputRef={props.inputRef}
            label="Frames"
            ariaLabel="Frames"
            value={dialogIntegerValue(props.playScript.revealCountText.value, 1)}
            onChange={(value) => { props.playScript.revealCountText.value = String(value); }}
            min={1}
            max={Math.max(1, props.playScript.capacity.value)}
            sliderMax={Math.max(1, props.playScript.capacity.value)}
            step={1}
            disabled={props.busy}
            ariaInvalid={Boolean(props.playScript.revealValidationError.value)}
            ariaDescribedBy={props.playScript.revealValidationError.value ? 'physics-play-script-reveal-error' : undefined}
          />
          <div class="physics-paint-play-script-timing-foot">
            <span class="physics-paint-play-script-hint">from F{props.playScript.canonicalStart.value ?? 0}</span>
          </div>
          {props.playScript.revealValidationError.value ? <span id="physics-play-script-reveal-error" class="physics-paint-script-inline-error">{props.playScript.revealValidationError.value}</span> : null}
        </div>
        <div class="physics-paint-play-script-field">
          <SliderStepper
            id="physics-play-script-repeat"
            label="Cycle"
            ariaLabel="Cycle"
            value={dialogIntegerValue(props.playScript.repeatText.value, 1)}
            onChange={(value) => { props.playScript.repeatText.value = String(value); }}
            min={1}
            sliderMax={16}
            step={1}
            disabled={props.busy || props.playScript.infinity.value}
            ariaInvalid={Boolean(props.playScript.repeatError.value)}
            ariaDescribedBy={props.playScript.repeatError.value ? 'physics-play-script-repeat-error' : undefined}
          />
          <div class="physics-paint-play-script-timing-foot">
            {dialogSwitch({
              id: 'physics-play-script-infinity',
              label: 'Infinity',
              checked: props.playScript.infinity.value,
              disabled: props.busy,
              onClick: () => props.playScript.setInfinity(!props.playScript.infinity.value),
            })}
          </div>
          {props.playScript.repeatError.value ? <span id="physics-play-script-repeat-error" class="physics-paint-script-inline-error">{props.playScript.repeatError.value}</span> : null}
        </div>
      </div>
    </div>
  );
}

export function StackReadoutCard(props: { readout: RunScriptStackReadout }) {
  return (
    <div id="physics-play-script-stack-readout" class="physics-paint-play-script-card physics-paint-play-script-card-stack">
      <span class="physics-paint-play-script-card-title">Run span</span>
      <span class="physics-paint-play-script-stack-span">{props.readout.spanLabel}</span>
      <span class="physics-paint-play-script-stack-meta">{`${props.readout.offsetLabel} · ${props.readout.outcomeLabel}`}</span>
    </div>
  );
}

export function KeepScriptCard(props: {
  playScript: RotoPlayScriptController;
  busy: boolean;
  reason: string | null;
}) {
  return (
    <div class="physics-paint-play-script-card physics-paint-play-script-card-keep-script">
      <span class="physics-paint-play-script-card-title">Keep script</span>
      {dialogSwitch({
        id: 'physics-play-script-keep-script',
        label: 'Keep this rail’s per-key scripts',
        checked: props.playScript.keepScriptEffective.value,
        disabled: props.busy || props.reason !== null,
        onClick: () => props.playScript.setKeepScript(!props.playScript.keepScript.value),
      })}
      {props.reason ? <span id="physics-play-script-keep-script-reason" class="physics-paint-play-script-mode-helper">{props.reason}</span> : null}
    </div>
  );
}

export function CollisionCard(props: {
  playScript: RotoPlayScriptController;
  collision: RotoPlayScriptStackCollision;
  offers: readonly RunScriptCollisionOffer[];
  busy: boolean;
}) {
  return (
    <div id="physics-play-script-collision" class="physics-paint-play-script-card physics-paint-play-script-card-collision">
      <span class="physics-paint-play-script-card-title">Extends past a boundary</span>
      {props.collision.lifecycleOverflow && !props.collision.runCollision ? (
        <span class="physics-paint-play-script-collision-copy">
          {`The rail's repeat span crosses the parent end at F${props.collision.parentEndExclusive ?? props.collision.boundaryExclusive}. Truncate clamps the rail to F${props.collision.parentEndExclusive ?? props.collision.boundaryExclusive} and still writes the whole run.`}
        </span>
      ) : (
        <span class="physics-paint-play-script-collision-copy">
          {`The run reaches past ${props.collision.victimClipId ? 'another rail' : props.collision.blocker === 'parent-end' ? 'the parent range end' : props.collision.blocker === 'real-key' ? 'an existing key' : 'the rail end'} at F${props.collision.boundaryExclusive}. Truncate writes only the free span.`}
        </span>
      )}
      <div class="physics-paint-play-script-actions">
        <button
          id="physics-play-script-collision-cancel"
          type="button"
          class="physics-paint-play-script-button physics-paint-play-script-button-ghost"
          disabled={props.busy}
          onClick={() => { void props.playScript.confirmStackCollision('cancel'); }}
        >
          Cancel
        </button>
        <button
          id="physics-play-script-collision-truncate"
          type="button"
          class="physics-paint-play-script-button physics-paint-play-script-button-primary"
          disabled={props.busy}
          onClick={() => { void props.playScript.confirmStackCollision('truncate'); }}
        >
          Truncate
        </button>
        {props.offers.includes('overwrite') ? (
          <>
            <span id="physics-play-script-collision-overwrite-copy" class="physics-paint-play-script-collision-copy">
              {RUN_SCRIPT_OVERWRITE_COPY}
            </span>
            <button
              id="physics-play-script-collision-overwrite"
              type="button"
              class="physics-paint-play-script-button physics-paint-play-script-button-ghost"
              disabled={props.busy}
              onClick={() => { void props.playScript.confirmStackCollision('overwrite'); }}
            >
              Overwrite
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
