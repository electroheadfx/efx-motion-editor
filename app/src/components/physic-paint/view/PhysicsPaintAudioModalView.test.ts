import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'PhysicsPaintAudioModalView.tsx'), 'utf8');

describe('PhysicsPaintAudioModalView Gain field (261008-ful / 261010-bkv)', () => {
  it('renders field 8 as a dB SliderStepper (step 1, -20..+20) committing through commitGain', () => {
    // 261009-6ee renumbered the step comments: Position is 4, so Gain is 8.
    const start = source.indexOf('{/* 8.');
    expect(start).toBeGreaterThan(-1);
    const end = source.indexOf('{/* 9.', start);
    expect(end).toBeGreaterThan(start);
    const gainField = source.slice(start, end);
    expect(gainField).toContain('<SliderStepper');
    expect(gainField).toContain('step={1}');
    expect(gainField).toContain('min={GAIN_DB_MIN}');
    expect(gainField).toContain('max={GAIN_DB_MAX}');
    expect(gainField).toContain('value={previewGain}');
    expect(gainField).toContain('onChange={(value) => commitGain(value)}');
    // 261010-bkv: the dB unit is the label — no `0 = unity` hint.
    expect(gainField).toContain('{AUDIO_GAIN_LABEL} (dB)');
  });

  it('removes the native range slider and the stale contract wording entirely', () => {
    expect(source).not.toContain('type="range"');
    expect(source).not.toContain('native range');
    expect(source).not.toContain('previewGainInput');
  });

  it('keeps the updated contract comment and drops the redundant signed readout', () => {
    expect(source).toContain('step 1, dB -20..+20');
    expect(source).toContain('AUDIO_GAIN_LABEL');
    expect(source).not.toContain('AUDIO_GAIN_HINT');
    expect(source).not.toContain('0 = unity');
    // 261008-ful UAT: the stepper is the only value display — no extra
    // top-right readout, and no stale readout wording in the contract.
    expect(source).not.toContain('<output>');
    expect(source).not.toContain('signed readout');
    expect(source).not.toContain('readout `');
  });
});

describe('PhysicsPaintAudioModalView Position field (261008-ryq / 261009-6ee)', () => {
  it('renders field 4 as a SliderStepper (step 1, min 0, no upper clamp) committing through commitStartFrame', () => {
    const start = source.indexOf('{/* 4.');
    expect(start).toBeGreaterThan(-1);
    const end = source.indexOf('{/* 5.', start);
    expect(end).toBeGreaterThan(start);
    const positionField = source.slice(start, end);
    expect(positionField).toContain('<SliderStepper');
    expect(positionField).toContain('step={1}');
    expect(positionField).toContain('min={0}');
    expect(positionField).not.toContain('max={');
    expect(positionField).toContain('value={sound.startFrame}');
    expect(positionField).toContain('onChange={(value) => commitStartFrame(value)}');
    expect(positionField).toContain('{AUDIO_POSITION_LABEL} (frames)');
    expect(positionField).toContain('ariaLabel={AUDIO_POSITION_LABEL}');
  });

  it('places the On pill in the header, Remove in the file row, and the fields after TIMING', () => {
    expect(source).toContain("export const AUDIO_POSITION_LABEL = 'Position';");
    // The header contract lists the 261009-6ee 11-step order verbatim.
    const contract = source.slice(source.indexOf('Field order top-to-bottom'), source.indexOf('The component is a thin render shell'));
    expect(contract).toContain('4. `Position`');
    expect(contract).toContain('5. `Trim in`');
    expect(contract).toContain('6. `Trim out`');
    expect(contract).toContain('8. `Gain`');
    expect(contract).toContain('9. `Fade in`');
    expect(contract).toContain('10. `Fade out`');
    expect(contract).toContain('11. Remove confirmation');
    // Placement pins (UAT): the pill is in the header, the icon Remove is in
    // the file row, the fields follow the TIMING header, and the confirmation
    // modal is the LAST block — nothing inline trails the fields.
    const fileIndex = source.indexOf('{/* 2b. File row');
    expect(source.indexOf('data-testid="audio-modal-enabled"')).toBeLessThan(fileIndex);
    const positionIndex = source.indexOf('{/* 4. Position');
    expect(positionIndex).toBeGreaterThan(source.indexOf('{/* 3. TIMING'));
    const fadeIndex = source.indexOf('{/* 10. Fade out');
    expect(fadeIndex).toBeGreaterThan(positionIndex);
    expect(source.indexOf('{/* 11. Remove confirmation')).toBeGreaterThan(fadeIndex);
  });
});

describe('PhysicsPaintAudioModalView trim span law (261009-6ee)', () => {
  it('Trim in caps at out - 1 so a 1-frame minimum span never inverts', () => {
    const start = source.indexOf('{/* 5.');
    expect(start).toBeGreaterThan(-1);
    const end = source.indexOf('{/* 6.', start);
    expect(end).toBeGreaterThan(start);
    const trimIn = source.slice(start, end);
    expect(trimIn).toContain('value={sound.inFrame}');
    expect(trimIn).toContain('max={sound.outFrame - 1}');
    expect(trimIn).toContain('onChange={(value) => commitInFrame(value)}');
    expect(trimIn).toContain('ariaLabel="In frames"');
  });

  it('Trim out floors at in + 1 so a 1-frame minimum span never inverts', () => {
    const start = source.indexOf('{/* 6.');
    expect(start).toBeGreaterThan(-1);
    const end = source.indexOf('{/* 7.', start);
    expect(end).toBeGreaterThan(start);
    const trimOut = source.slice(start, end);
    expect(trimOut).toContain('value={sound.outFrame}');
    expect(trimOut).toContain('min={sound.inFrame + 1}');
    expect(trimOut).toContain('onChange={(value) => commitOutFrame(value)}');
    expect(trimOut).toContain('ariaLabel="Out frames"');
  });
});

describe('PhysicsPaintAudioModalView actions (261009-6ee + UAT move)', () => {
  const header = source.slice(source.indexOf('{/* 1. Header */}'), source.indexOf('{/* 2b. File row'));
  const fileRow = source.slice(source.indexOf('{/* 2b. File row'), source.indexOf('{/* 3. TIMING'));
  const confirm = source.slice(source.indexOf('{/* 11. Remove confirmation'));

  it('the enabled pill is the modal switch and sits in the HEADER beside close', () => {
    expect(header).toContain('data-testid="audio-modal-enabled"');
    expect(header).toContain('aria-pressed={sound.enabled}');
    expect(header).toContain('aria-label="Document sound on/off"');
    expect(header).toContain('{sound.enabled ? <Volume2 size={12} aria-hidden="true" /> : <VolumeX size={12} aria-hidden="true" />}');
    expect(header).toContain('onClick={toggleEnabled}');
    expect(header).toContain('physics-paint-audio-toggle');
    // It is no longer a row of its own anywhere in the field body.
    expect(source).not.toContain('physics-paint-audio-footer');
  });

  it('the FILE section header uses the shared RuleSectionHeader above the file row', () => {
    expect(source).toContain("export const AUDIO_SECTION_FILE = 'FILE';");
    const fileSection = fileRow.slice(0, fileRow.indexOf('physics-paint-audio-file-row'));
    expect(fileSection).toContain('<RuleSectionHeader');
    expect(fileSection).toContain('text={AUDIO_SECTION_FILE}');
    // 261009-v0s: section values live in RuleSectionHeader only — the old
    // physics-paint-audio-section* classes and markup are gone.
    expect(source).not.toContain('physics-paint-audio-section');
    expect(source).toContain("from '../../shared/RuleSectionHeader'");
    // The old plain `File` label is gone.
    expect(fileRow).not.toContain('>File</span>');
  });

  it('Remove is an ICON beside Replace that opens the confirmation modal', () => {
    expect(fileRow).toContain('physics-paint-audio-remove-icon');
    expect(fileRow).toContain('onClick={requestRemove}');
    expect(fileRow).toContain('physics-paint-photo-reference-import');
    // Icon-only: no text label inside the button.
    expect(fileRow).not.toContain('<span>{removeArmed ? AUDIO_REMOVE_ARMED : AUDIO_REMOVE}</span>');
    // The confirmation copy never renders inline in the field body.
    expect(fileRow).not.toContain('AUDIO_REMOVE_CONFIRM_COPY');
  });

  it('the confirmation is a MODAL with Cancel / Remove — never inline', () => {
    expect(confirm).toContain('data-testid="audio-remove-confirm-modal"');
    expect(confirm).toContain('data-testid="audio-remove-confirm-copy"');
    expect(confirm).toContain('{AUDIO_REMOVE_CONFIRM_COPY}');
    expect(confirm).toContain('role="alertdialog"');
    expect(confirm).toContain('onClick={disarmRemove}');
    expect(confirm).toContain('onClick={confirmRemove}');
    expect(confirm).toContain('{AUDIO_REMOVE_CANCEL}');
    // Exactly one occurrence of the confirm copy — the modal's, not an inline one.
    expect(source.match(/data-testid="audio-remove-confirm-copy"/g)).toHaveLength(1);
  });
});

describe('PhysicsPaintAudioModalView one-switch law (261009-6ee)', () => {
  it('the modal carries no preview-toggle props and no header testid', () => {
    expect(source).not.toContain('mainAppAudioEnabled');
    expect(source).not.toContain('onToggleMainAppAudio');
    expect(source).not.toContain('audio-modal-main-app-audio');
    // VolumeX is now the header pill's OFF icon (UAT) — pinned to exactly one
    // element so a second VolumeX surface (the old preview toggle) cannot return.
    expect(source.match(/<VolumeX/g)).toHaveLength(1);
  });

  it('exactly ONE audio-modal-enabled testid exists — the header pill', () => {
    const matches = source.match(/data-testid="audio-modal-enabled"/g) ?? [];
    expect(matches).toHaveLength(1);
  });

  it('the header contract line says title + close ONLY', () => {
    const contract = source.slice(source.indexOf('Field order top-to-bottom'), source.indexOf('The component is a thin render shell'));
    expect(contract).toContain('1. header: AudioWaveform 15px + `Document sound` + close X (title + close');
    expect(contract).toContain('this modal carries no preview button');
  });

  it('the grouped-layout copy constants exist with the locked values', () => {
    expect(source).toContain("export const AUDIO_IN_LABEL = 'Trim in';");
    expect(source).toContain("export const AUDIO_OUT_LABEL = 'Trim out';");
    expect(source).toContain("export const AUDIO_SECTION_TIMING = 'TIMING';");
    expect(source).toContain("export const AUDIO_SECTION_SOUND = 'SOUND';");
    expect(source).not.toContain('AUDIO_GAIN_HINT');
  });
});

describe('PhysicsPaintAudioModalView single-clip editor (261008-ryq)', () => {
  it('pluralizes the header title and keeps the header contract line', () => {
    expect(source).toContain("export const AUDIO_MODAL_TITLE = 'Document sound';");
    expect(source).not.toContain("AUDIO_MODAL_TITLE = 'Document sounds';");
    expect(source).toContain('`Document sound` · `Import sound`');
    expect(source).toContain('1. header: AudioWaveform 15px + `Document sound` + close X');
  });

  it('no longer renders the clip rows — the list moved to the sidebar Audio tab', () => {
    expect(source).not.toContain('data-testid="audio-modal-list"');
    expect(source).not.toContain('key={clip.id}');
    expect(source).not.toContain('selectedSoundId.value === clip.id');
    expect(source).not.toContain('onSelectSoundClip');
    expect(source).toContain('LIST lives in the sidebar Audio tab');
    // The contract comment's step 2 is the file row / empty state only — no
    // clip-list step.
    expect(source).not.toContain('clip list (rows');
  });

  it('gates the empty state on an empty list and the editor on the selected clip', () => {
    expect(source).toContain('audios.length === 0');
    expect(source).toContain('sound !== null ? (');
    // The old singleton gate (`sound === null` chose between empty and editor)
    // must be gone — a list with no selection shows the list, not the empty
    // state.
    expect(source).not.toContain('{sound === null ? (');
  });

  it('handles the modal-open one-shot Delete/Backspace via removeSelected behind the shortcut-target guard', () => {
    const keyDown = source.slice(source.indexOf('onKeyDown={'), source.indexOf('{/* 1. Header */}'));
    expect(keyDown).toContain("(event.key === 'Backspace' || event.key === 'Delete')");
    expect(keyDown).toContain('!event.repeat');
    expect(keyDown).toContain('isPhysicsPaintShortcutTarget(event.target)');
    expect(keyDown).toContain('removeSelected();');
  });

  it('routes Import as append and Replace… as replace through the mode port', () => {
    expect(source).toContain("onImportRequest('append')");
    expect(source).toContain("onImportRequest('replace')");
    expect(source).not.toContain('withDisarm(onImportRequest)');
  });
});
