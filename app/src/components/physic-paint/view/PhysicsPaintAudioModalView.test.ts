import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'PhysicsPaintAudioModalView.tsx'), 'utf8');

describe('PhysicsPaintAudioModalView Gain field (261008-ful)', () => {
  it('renders field 8 as a NumericStepper (step 5, clamped) committing through commitGain', () => {
    // 261009-6ee renumbered the step comments: Position is 4, so Gain is 8.
    const start = source.indexOf('{/* 8.');
    expect(start).toBeGreaterThan(-1);
    const end = source.indexOf('{/* 9.', start);
    expect(end).toBeGreaterThan(start);
    const gainField = source.slice(start, end);
    expect(gainField).toContain('<NumericStepper');
    expect(gainField).toContain('step={5}');
    expect(gainField).toContain('min={-100}');
    expect(gainField).toContain('max={100}');
    expect(gainField).toContain('value={previewGain}');
    expect(gainField).toContain('onChange={(value) => commitGain(value)}');
    // 261009-6ee grouped layout: the `0 = unity` hint sits under the label.
    expect(gainField).toContain('{AUDIO_GAIN_HINT}');
  });

  it('removes the native range slider and the stale contract wording entirely', () => {
    expect(source).not.toContain('type="range"');
    expect(source).not.toContain('native range');
    expect(source).not.toContain('previewGainInput');
  });

  it('keeps the updated contract comment and drops the redundant signed readout', () => {
    expect(source).toContain('NumericStepper step 5');
    expect(source).toContain('AUDIO_GAIN_LABEL');
    // 261008-ful UAT: the stepper is the only value display — no extra
    // top-right readout, and no stale readout wording in the contract.
    expect(source).not.toContain('<output>');
    expect(source).not.toContain('signed readout');
    expect(source).not.toContain('readout `');
  });
});

describe('PhysicsPaintAudioModalView Position field (261008-ryq / 261009-6ee)', () => {
  it('renders field 4 as a NumericStepper (step 1, min 0, no upper clamp) committing through commitStartFrame', () => {
    const start = source.indexOf('{/* 4.');
    expect(start).toBeGreaterThan(-1);
    const end = source.indexOf('{/* 5.', start);
    expect(end).toBeGreaterThan(start);
    const positionField = source.slice(start, end);
    expect(positionField).toContain('<NumericStepper');
    expect(positionField).toContain('step={1}');
    expect(positionField).toContain('min={0}');
    expect(positionField).not.toContain('max={');
    expect(positionField).toContain('value={sound.startFrame}');
    expect(positionField).toContain('onChange={(value) => commitStartFrame(value)}');
    expect(positionField).toContain('{AUDIO_POSITION_LABEL} (frames)');
    expect(positionField).toContain('ariaLabel={AUDIO_POSITION_LABEL}');
  });

  it('places Position after the file row and the footer AFTER the fades, contract renumbered to the locked order', () => {
    expect(source).toContain("export const AUDIO_POSITION_LABEL = 'Position';");
    // The header contract lists the new 261009-6ee 11-step order verbatim.
    const contract = source.slice(source.indexOf('Field order top-to-bottom'), source.indexOf('The component is a thin render shell'));
    expect(contract).toContain('4. `Position`');
    expect(contract).toContain('5. `Trim in`');
    expect(contract).toContain('6. `Trim out`');
    expect(contract).toContain('8. `Gain`');
    expect(contract).toContain('9. `Fade in`');
    expect(contract).toContain('10. `Fade out`');
    expect(contract).toContain('11. footer');
    // Placement pin: the Position block sits after the file row; the footer
    // comes AFTER both fade rows (nothing trailing them).
    const positionIndex = source.indexOf('{/* 4. Position');
    expect(positionIndex).toBeGreaterThan(source.indexOf('{/* 2b. File row'));
    const footerIndex = source.indexOf('{/* 11.');
    expect(footerIndex).toBeGreaterThan(source.indexOf('{/* 10. Fade out'));
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

describe('PhysicsPaintAudioModalView footer (261009-6ee)', () => {
  const footer = source.slice(source.indexOf('{/* 11.'));

  it('the enabled pill is the modal switch — aria-pressed, Volume2 when on, On/Off span', () => {
    expect(footer).toContain('physics-paint-audio-footer');
    expect(footer).toContain('data-testid="audio-modal-enabled"');
    expect(footer).toContain('aria-pressed={sound.enabled}');
    expect(footer).toContain('aria-label="Document sound on/off"');
    expect(footer).toContain('{sound.enabled ? <Volume2 size={12} aria-hidden="true" /> : null}');
    expect(footer).toContain('onClick={toggleEnabled}');
  });

  it('Remove stays two-step (request → confirm) with the confirm copy at the footer', () => {
    expect(footer).toContain('physics-paint-audio-remove-armed');
    expect(footer).toContain('if (removeArmed) confirmRemove();');
    expect(footer).toContain('else requestRemove();');
    expect(footer).toContain('data-testid="audio-remove-confirm-copy"');
    expect(footer).toContain('{AUDIO_REMOVE_CONFIRM_COPY}');
  });
});

describe('PhysicsPaintAudioModalView one-switch law (261009-6ee)', () => {
  it('the modal carries no preview-toggle props, no header testid, no VolumeX', () => {
    expect(source).not.toContain('mainAppAudioEnabled');
    expect(source).not.toContain('onToggleMainAppAudio');
    expect(source).not.toContain('audio-modal-main-app-audio');
    expect(source).not.toContain('VolumeX');
  });

  it('exactly ONE audio-modal-enabled testid exists — the footer pill', () => {
    const matches = source.match(/data-testid="audio-modal-enabled"/g) ?? [];
    expect(matches).toHaveLength(1);
  });

  it('the header contract line says title + close ONLY', () => {
    const contract = source.slice(source.indexOf('Field order top-to-bottom'), source.indexOf('The component is a thin render shell'));
    expect(contract).toContain('1. header: AudioWaveform 15px + `Document sounds` + close X (title + close');
    expect(contract).toContain('this modal carries no preview button');
  });

  it('the grouped-layout copy constants exist with the locked values', () => {
    expect(source).toContain("export const AUDIO_IN_LABEL = 'Trim in';");
    expect(source).toContain("export const AUDIO_OUT_LABEL = 'Trim out';");
    expect(source).toContain("export const AUDIO_GAIN_HINT = '0 = unity';");
    expect(source).toContain("export const AUDIO_SECTION_TIMING = 'TIMING';");
    expect(source).toContain("export const AUDIO_SECTION_SOUND = 'SOUND';");
  });
});

describe('PhysicsPaintAudioModalView single-clip editor (261008-ryq)', () => {
  it('pluralizes the header title and keeps the header contract line', () => {
    expect(source).toContain("export const AUDIO_MODAL_TITLE = 'Document sounds';");
    expect(source).not.toContain("AUDIO_MODAL_TITLE = 'Document sound';");
    expect(source).toContain('`Document sounds` · `Import sound`');
    expect(source).toContain('1. header: AudioWaveform 15px + `Document sounds` + close X');
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
