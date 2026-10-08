import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'PhysicsPaintAudioModalView.tsx'), 'utf8');

describe('PhysicsPaintAudioModalView Gain field (261008-ful)', () => {
  it('renders field 4 as a NumericStepper (step 5, clamped) committing through commitGain', () => {
    const start = source.indexOf('{/* 4.');
    expect(start).toBeGreaterThan(-1);
    const end = source.indexOf('{/* 5-6.', start);
    expect(end).toBeGreaterThan(start);
    const gainField = source.slice(start, end);
    expect(gainField).toContain('<NumericStepper');
    expect(gainField).toContain('step={5}');
    expect(gainField).toContain('min={-100}');
    expect(gainField).toContain('max={100}');
    expect(gainField).toContain('value={previewGain}');
    expect(gainField).toContain('onChange={(value) => commitGain(value)}');
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
    expect(source).toContain('LIST now lives in the sidebar Audio tab');
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
