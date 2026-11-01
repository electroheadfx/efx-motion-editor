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

// 261101-cd5: the Reveal tab supplies the Reveal context, so the rail kinds
// read Motion / Static exactly like the Paint tab.
const REVEAL_RAIL_TYPES: ReadonlyArray<{ value: RotoPlayScriptMode; label: string }> = [
  { value: 'progressive', label: 'Motion' },
  { value: 'static', label: 'Static' },
];

// 261101-cd5: the Rail Type subheader's one-line helper per creation variant.
const RAIL_TYPE_HELPERS: Record<RotoPlayScriptMode, { paint: string; reveal: string }> = {
  progressive: {
    paint: 'Builds the paint stroke by stroke',
    reveal: 'Reveals the photo progressively',
  },
  static: {
    paint: 'Holds one painted pose per cycle',
    reveal: 'Reveals with per-frame variation',
  },
};

// 261101-1pc (Quick C2): the 2×2 Rail Type grid for a stack RUN. The kind is
// dialog state only — the merged Standard Rail still stores the destination's
// mode, and a Reveal kind renders the run's wash through the document reference.
const STACK_RUN_KINDS: ReadonlyArray<{ value: RotoPlayScriptStackRunKind; label: string }> = [
  { value: 'motion', label: 'Motion' },
  { value: 'static', label: 'Static' },
  { value: 'reveal-motion', label: 'Reveal Motion' },
  { value: 'reveal-static', label: 'Reveal Static' },
];

// 261101-cd5: the compact Source cycle card carries short segment labels; the
// full sentence stays in the helper + `title` (and the hidden described-by node).
const PLAY_SCRIPT_SOURCE_CHOICES = [
  { value: 'link' as const, label: 'Link', helper: 'Reuses the existing source cycle. Future source edits update every linked loop.' },
  { value: 'create' as const, label: 'Create', helper: 'Creates an independent source cycle. Future edits do not affect the existing loops.' },
];

const PLAY_SCRIPT_COLORS: ReadonlyArray<{ value: boolean; label: string }> = [
  { value: false, label: 'Original' },
  { value: true, label: 'Custom' },
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
// 261101-cd5: compact global cards keep the visible copy in their subline, so
// the switch can drop the visible label and carry it as its accessible name.
function dialogSwitch(props: {
  id: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
  onClick: () => void;
  hideLabel?: boolean;
  ariaLabel?: string;
}) {
  const accessibleName = props.hideLabel ? (props.ariaLabel ?? props.label) : props.ariaLabel;
  return (
    <button
      type="button"
      id={props.id}
      class={`physics-paint-script-switch physics-paint-play-script-switch${props.checked ? ' is-on' : ''}`}
      role="switch"
      aria-checked={props.checked ? 'true' : 'false'}
      aria-label={accessibleName}
      disabled={props.disabled}
      onClick={props.onClick}
    >
      <span class="physics-paint-script-switch-track" aria-hidden="true">
        <span class="physics-paint-script-switch-knob" />
      </span>
      {props.hideLabel ? null : <span class="physics-paint-script-switch-label">{props.label}</span>}
    </button>
  );
}

// One APG radio group for Rail Type / Color / Source cycle: arrow keys move
// focus AND check with wrap-around, and the checked option is the single Tab stop.
export function DialogRadioGroup<T extends string | boolean,>(props: {
  ariaLabel: string;
  describedBy?: string;
  /** 261101-cd5: lets callers add a variant skin (e.g. the 2 × 2 stack grid). */
  class?: string;
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
      class={`physics-paint-play-script-mode-group${props.class ? ` ${props.class}` : ''}`}
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
  /** 261101-cd5: the Reveal creation guard rides this row as a compact chip. */
  showReferenceChip?: boolean;
}) {
  const options = props.revealTab ? REVEAL_RAIL_TYPES : PLAY_SCRIPT_MODES;
  const helper = props.stacking
    ? 'This run merges into the rail — the result is one Standard Rail.'
    : props.standard
      ? null
      : RAIL_TYPE_HELPERS[props.playScript.mode.value][props.revealTab ? 'reveal' : 'paint'];
  return (
    <div class={`physics-paint-play-script-card-mode physics-paint-play-script-rail-row${props.locked ? ' physics-paint-play-script-locked' : ''}`}>
      <span class="physics-paint-play-script-rail-label">RAIL TYPE</span>
      {props.standard ? (
        <span class="physics-paint-play-script-standard-rail-value">Standard</span>
      ) : props.stacking ? (
        /* 261101-1pc (Quick C2): a stack picks the run kind, which derives the
           single bake mode. Creation and the Reveal tab keep their two-option
           group bound to `mode`. */
        <DialogRadioGroup
          class="physics-paint-play-script-mode-group-stack"
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
      {helper ? <span class="physics-paint-play-script-rail-helper">{helper}</span> : null}
      {props.showReferenceChip && !props.playScript.revealReferencePlaced.value ? (
        <span class="physics-paint-play-script-ref-chip">
          <i class="physics-paint-play-script-ref-dot" aria-hidden="true" />
          <span class="physics-paint-play-script-ref-label">No photo reference</span>
          <button
            type="button"
            class="physics-paint-play-script-ref-action"
            disabled={props.busy}
            onClick={() => props.playScript.requestPhotoReference()}
          >
            Place
          </button>
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
  const custom = props.playScript.overrideEnabled.value;
  return (
    <div class={`physics-paint-play-script-card physics-paint-play-script-card-global physics-paint-play-script-card-color${props.locked ? ' physics-paint-play-script-locked' : ''}`}>
      <div class="physics-paint-play-script-card-heading">
        <span class="physics-paint-play-script-card-title">Color</span>
        {custom ? (
          /* 261101-cd5: Custom shows the live swatch with the hex underneath. */
          <span class="physics-paint-play-script-color-custom-chip">
            <span class="physics-paint-play-script-override-chip" style={{ backgroundColor: props.colorValue }} />
            <span class="physics-paint-play-script-color-hex">{props.colorValue}</span>
          </span>
        ) : (
          <span class="physics-paint-play-script-color-dots" aria-hidden="true">
            {ORIGINAL_COLOR_DOTS.map((color) => <i key={color} style={{ background: color }} />)}
          </span>
        )}
      </div>
      <DialogRadioGroup
        ariaLabel="Color"
        class="physics-paint-play-script-mode-group-mini"
        options={PLAY_SCRIPT_COLORS}
        value={props.playScript.overrideEnabled.value}
        getValue={() => props.playScript.overrideEnabled.value}
        disabled={props.busy || props.locked}
        onSelect={(value) => { props.playScript.overrideEnabled.value = value; }}
      />
      {props.stacking && custom ? (
        <button
          type="button"
          class="physics-paint-play-script-heading-link physics-paint-play-script-card-subline-action"
          title="Use the app's current brush color"
          disabled={props.busy}
          onClick={props.playScript.useBrushColor}
        >
          Use brush color
        </button>
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
    <div class={`physics-paint-play-script-motion-section physics-paint-play-script-card-motion${props.locked ? ' physics-paint-play-script-locked' : ''}`}>
      <div class="physics-paint-play-script-motion-heading">
        <span class="physics-paint-play-script-motion-title">Motion wiggle</span>
        <button
          type="button"
          class="physics-paint-play-script-heading-link"
          disabled={disabled}
          onClick={() => props.playScript.resetDialogMotion()}
        >
          Reset defaults
        </button>
      </div>
      <div class="physics-paint-play-script-motion-grid">
        <SliderStepper
          id="physics-play-script-motion-deformation"
          class="physics-paint-play-script-slim-stepper"
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
          class="physics-paint-play-script-slim-stepper"
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
          class="physics-paint-play-script-slim-stepper"
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
          class="physics-paint-play-script-slim-stepper"
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
    <div class="physics-paint-play-script-card physics-paint-play-script-card-global physics-paint-play-script-card-colorize">
      <div class="physics-paint-play-script-card-heading">
        <span class="physics-paint-play-script-card-title">Colorize</span>
        {dialogSwitch({
          id: 'physics-play-script-colorize',
          label: 'Colorize with wash color',
          hideLabel: true,
          checked: props.playScript.colorize.value,
          disabled: props.busy,
          onClick: () => props.playScript.setColorize(!props.playScript.colorize.value),
        })}
      </div>
      {/* 261101-cd5: sub and Mix are two stacked rows, as in the design. */}
      <span class="physics-paint-play-script-card-subline" title="Tint with the wash color">Tint with the wash color</span>
      <label class="physics-paint-play-script-slider-row physics-paint-play-script-slider-row-colorize" for="physics-play-script-colorize-mix">
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
    <div class="physics-paint-play-script-card physics-paint-play-script-card-global physics-paint-play-script-card-photo-wiggle">
      <div class="physics-paint-play-script-card-heading">
        <span class="physics-paint-play-script-card-title">Photo Wiggle</span>
        {dialogSwitch({
          id: 'physics-play-script-photo-wiggle',
          label: 'Wiggle photo and wash together',
          hideLabel: true,
          checked: props.playScript.photoWiggle.value,
          disabled: props.busy,
          onClick: () => props.playScript.setPhotoWiggle(!props.playScript.photoWiggle.value),
        })}
      </div>
      <span class="physics-paint-play-script-card-subline" title="Move photo and wash together">Move photo and wash together</span>
    </div>
  );
}

export function PaintSeedCard(props: { playScript: RotoPlayScriptController; busy: boolean }) {
  return (
    <div class="physics-paint-play-script-card physics-paint-play-script-card-global physics-paint-play-script-card-paint-seed-variation">
      <div class="physics-paint-play-script-card-heading">
        <span class="physics-paint-play-script-card-title">Paint Seed</span>
        {dialogSwitch({
          id: 'physics-play-script-paint-seed-variation',
          label: 'Vary the brush texture per frame',
          hideLabel: true,
          checked: props.playScript.paintSeedVariation.value,
          disabled: props.busy,
          onClick: () => props.playScript.setPaintSeedVariation(!props.playScript.paintSeedVariation.value),
        })}
      </div>
      <span class="physics-paint-play-script-card-subline" title="Vary the brush texture each frame">Vary the brush texture each frame</span>
    </div>
  );
}

export function KeyScriptCard(props: { playScript: RotoPlayScriptController; busy: boolean }) {
  return (
    <div class="physics-paint-play-script-card physics-paint-play-script-card-global physics-paint-play-script-card-key-script">
      <div class="physics-paint-play-script-card-heading">
        <span class="physics-paint-play-script-card-title">Key Script</span>
        {dialogSwitch({
          id: 'physics-play-script-key-script-edits',
          label: 'Save script on each key',
          hideLabel: true,
          checked: props.playScript.keyScriptEdits.value,
          disabled: props.busy,
          onClick: () => props.playScript.setKeyScriptEdits(!props.playScript.keyScriptEdits.value),
        })}
      </div>
      <span class="physics-paint-play-script-card-subline" title="Save a script on each key">Save a script on each key</span>
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
  const helperText = `${active.helper}${props.playScript.linkChoice.value === 'link'
    ? ` Source F${props.identicalCycle.sourceStart}–F${props.identicalCycle.sourceStart + props.identicalCycle.sourceKeyIds.length - 1} · ${props.identicalCycle.loopCount} linked loop(s).`
    : ''}`;
  return (
    <div class="physics-paint-play-script-card physics-paint-play-script-card-global physics-paint-play-script-card-source-choice">
      <span class="physics-paint-play-script-card-title">Source cycle</span>
      <DialogRadioGroup
        ariaLabel="Source cycle"
        describedBy="physics-play-script-source-helper"
        class="physics-paint-play-script-mode-group-mini"
        options={PLAY_SCRIPT_SOURCE_CHOICES}
        value={props.playScript.linkChoice.value}
        getValue={() => props.playScript.linkChoice.value}
        disabled={props.busy}
        onSelect={(value) => { props.playScript.linkChoice.value = value; }}
      />
      {/* 261101-cd5: one-line subline; the full copy stays in `title` and the
          hidden described-by node so screen readers never lose it. */}
      <span class="physics-paint-play-script-card-subline" title={helperText}>{helperText}</span>
      <span id="physics-play-script-source-helper" class="physics-paint-play-script-visually-hidden">{helperText}</span>
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
      <div class="physics-paint-play-script-timing-header">
        <span class="physics-paint-play-script-card-title">Timing</span>
        <span class="physics-paint-play-script-timing-meta">{`${Math.max(1, props.playScript.framesMax.value)} frames available`}</span>
      </div>
      <div class="physics-paint-play-script-timing-body">
        <div class={`physics-paint-play-script-field${props.locked ? ' physics-paint-play-script-locked' : ''}`}>
          <SliderStepper
            id="physics-play-script-count"
            class="physics-paint-play-script-hero-stepper physics-paint-play-script-count"
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
        {props.stacking ? null : (<>
          <span class="physics-paint-play-script-timing-divider" aria-hidden="true" />
          <div class="physics-paint-play-script-field physics-paint-play-script-cycle-field">
            <SliderStepper
              id="physics-play-script-repeat"
              class="physics-paint-play-script-compact-stepper"
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
        </>)}
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
      <div class="physics-paint-play-script-timing-header">
        <span class="physics-paint-play-script-card-title">Timing</span>
        <span class="physics-paint-play-script-timing-meta">{`from F${props.playScript.canonicalStart.value ?? 0}`}</span>
      </div>
      <div class="physics-paint-play-script-timing-body">
        <div class="physics-paint-play-script-field">
          <SliderStepper
            id="physics-play-script-reveal-count"
            class="physics-paint-play-script-hero-stepper"
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
          {props.playScript.revealValidationError.value ? <span id="physics-play-script-reveal-error" class="physics-paint-script-inline-error">{props.playScript.revealValidationError.value}</span> : null}
        </div>
        <span class="physics-paint-play-script-timing-divider" aria-hidden="true" />
        <div class="physics-paint-play-script-field physics-paint-play-script-cycle-field">
          <SliderStepper
            id="physics-play-script-repeat"
            class="physics-paint-play-script-compact-stepper"
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
