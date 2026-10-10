import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(fileURLToPath(new URL('./AudioProperties.tsx', import.meta.url)), 'utf8');
const ruleHeader = readFileSync(
  fileURLToPath(new URL('../shared/RuleSectionHeader.tsx', import.meta.url)),
  'utf8',
);
const studioCss = readFileSync(
  fileURLToPath(new URL('../physic-paint/physicsPaintStudio.css', import.meta.url)),
  'utf8',
);

describe('AudioProperties SliderStepper re-flow (261009-v0s + 261010-bkv)', () => {
  it('renders exactly six SliderStepper fields with the locked labels', () => {
    expect(source.match(/<SliderStepper/g)).toHaveLength(6);
    for (const label of [
      'label="Gain"',
      'label="Fade in (frames)"',
      'label="Fade out (frames)"',
      'label="Position (frames)"',
      'label="In (s)"',
      'label="Out (s)"',
    ]) {
      expect(source).toContain(label);
    }
  });

  it('keeps offsetFrame wired to setOffset and the code identity unchanged', () => {
    expect(source).toContain('value={track.offsetFrame}');
    expect(source).toContain('audioStore.setOffset(track.id, val)');
    // slipOffset / beatOffsetFrames are different fields — never renamed.
    expect(source).toContain('beatOffsetFrames');
    expect(source).not.toContain('slipOffset');
  });

  it('drops NumericInput from Fade in / Fade out / Position / In / Out', () => {
    // The five converted fields never call NumericInput; BPM / Beat Offset may.
    expect(source).not.toContain('label="Offset"');
    expect(source).not.toContain('label="In"');
    expect(source).not.toContain('label="Out"');
    expect(source).toContain('<NumericInput');
    const bpmSection = source.slice(source.indexOf('title="BEAT SYNC"'));
    expect(bpmSection).toContain('label="BPM"');
    expect(bpmSection).toContain('label="Beat Offset"');
  });

  it('passes fade curve selects through SliderStepper below and keeps the 1-frame Out span', () => {
    expect(source.match(/below=\{/g)).toHaveLength(2);
    expect(source).toContain('fadeInCurve');
    expect(source).toContain('fadeOutCurve');
    expect(source).toContain('min={framesToSeconds(track.inFrame + 1, fps)}');
  });

  it('wraps the two fades and In/Out each in a 2-column pair (261010-bkv)', () => {
    expect(source).toContain('data-testid="audio-fades-pair"');
    expect(source).toContain('data-testid="audio-inout-pair"');
    expect(source).toContain("gridTemplateColumns: 'repeat(2, minmax(0, 1fr))'");
    // Each fade keeps its own below-slot curve select under its own bar.
    const fadesPair = source.slice(
      source.indexOf('data-testid="audio-fades-pair"'),
      source.indexOf('data-testid="audio-inout-pair"'),
    );
    expect(fadesPair).toContain('label="Fade in (frames)"');
    expect(fadesPair).toContain('label="Fade out (frames)"');
    expect(fadesPair.match(/below=\{/g)).toHaveLength(2);
    // In/Out sit side by side under full-width Position.
    const inoutPair = source.slice(source.indexOf('data-testid="audio-inout-pair"'));
    expect(inoutPair).toContain('label="In (s)"');
    expect(inoutPair).toContain('label="Out (s)"');
    expect(inoutPair).toContain('secondsToFrames(val, fps)');
  });

  it('Position commit is unbounded (negatives legal) with a track-only slider range below 0', () => {
    const positionField = source.slice(
      source.indexOf('label="Position (frames)"'),
      source.indexOf('label="In'),
    );
    expect(positionField).toContain('value={track.offsetFrame}');
    expect(positionField).toContain('audioStore.setOffset(track.id, val)');
    // No commit min/max on the offset field.
    expect(positionField).not.toContain('min={');
    expect(positionField).not.toContain('max={');
    // Track-only range includes negatives.
    expect(positionField).toContain('sliderMin={Math.min(track.offsetFrame, -1)}');
    expect(positionField).toContain('sliderMax=');
  });
});

describe('AudioProperties TRACK section (261010-bkv)', () => {
  it('groups name + Gain (dB) + mute under a TRACK header; no volume section or percent readout', () => {
    expect(source).toContain('<RuleSectionHeader text="TRACK" />');
    expect(source).not.toContain('TRACK NAME');
    expect(source).not.toContain('text="VOLUME"');
    expect(source).not.toContain('volumePercent}%');
    // Gain is the dB control over linear volume.
    expect(source).toContain('label="Gain"');
    expect(source).toContain('value={linearToDb(track.volume)}');
    expect(source).toContain('audioStore.setVolume(track.id, dbToLinear(val))');
    expect(source).toContain('min={GAIN_DB_MIN}');
    expect(source).toContain('max={GAIN_DB_MAX}');
    // Mute stays on the TRACK header row — one click, same setMuted.
    expect(source).toContain('audioStore.setMuted(track.id, !track.muted)');
  });
});

describe('AudioProperties Studio section headers (261009-v0s)', () => {
  it('uses RuleSectionHeader for the four content section titles', () => {
    expect(source).toContain("from '../shared/RuleSectionHeader'");
    for (const title of ['TRACK', 'FILE', 'FADES', 'POSITION']) {
      expect(source).toContain(`<RuleSectionHeader text="${title}" />`);
    }
    // SectionLabel remains only for AUTO-ARRANGE (not one of the five).
    expect(source).toContain('text="AUTO-ARRANGE"');
  });

  it('RuleSectionHeader is the only home of the section values (CSS rules deleted)', () => {
    expect(ruleHeader).toContain('9.5px');
    expect(ruleHeader).toContain('0.12px');
    expect(ruleHeader).toContain('#ffffff');
    expect(studioCss).not.toContain('.physics-paint-audio-section');
    expect(studioCss).not.toContain('.physics-paint-audio-section-label');
    expect(studioCss).not.toContain('.physics-paint-audio-section-rule');
  });
});

describe('AudioProperties BEAT SYNC accordion (261009-v0s)', () => {
  it('collapses on open via a signal-in-useRef default true', () => {
    expect(source).toContain('<CollapsibleSection title="BEAT SYNC"');
    expect(source).toContain('useRef(signal(true))');
    expect(source).not.toContain('useState(true)');
  });

  it('expands to BPM + x2 /2 + Beat Offset + Re-detect then gated AUTO-ARRANGE', () => {
    const accordion = source.slice(source.indexOf('title="BEAT SYNC"'));
    expect(accordion).toContain('label="BPM"');
    expect(accordion).toContain('x2');
    expect(accordion).toContain('/2');
    expect(accordion).toContain('label="Beat Offset"');
    expect(accordion).toContain('Re-detect BPM');
    // AUTO-ARRANGE stays gated on bpm + beat markers.
    expect(accordion).toContain('track.bpm != null && track.beatMarkers.length > 0');
    expect(accordion).toContain('AutoArrangeSection');
  });
});

describe('AudioProperties never-copy handleReplace stays byte-stable (261009-rko)', () => {
  it('keeps the never-copy region intact through volumePercent', () => {
    const replaceStart = source.indexOf('const handleReplace = async ()');
    const replaceSource = source.slice(replaceStart, source.indexOf('const volumePercent', replaceStart));
    expect(replaceSource.includes('readAudioSourceBytes')).toBe(true);
    expect(replaceSource.includes('buildAudioReplacePatch')).toBe(true);
    expect(replaceSource.includes('mkdir')).toBe(false);
    expect(replaceSource.includes('copyFile')).toBe(false);
    expect(replaceSource.includes('plugin-fs')).toBe(false);
  });
});

describe('AudioProperties time unit and range refinements (261010-bkv)', () => {
  it('Position sliderMax reaches the timeline end (totalFrames), floored at offsetFrame', () => {
    const positionField = source.slice(
      source.indexOf('label="Position (frames)"'),
      source.indexOf('label="In'),
    );
    expect(positionField).toContain('sliderMax={Math.max(totalFrames.value, track.offsetFrame, 1)}');
    expect(positionField).toContain('audioStore.setOffset(track.id, val)');
  });

  it('In/Out display and commit in audio seconds via audioGain converters', () => {
    expect(source).toContain('label="In (s)"');
    expect(source).toContain('label="Out (s)"');
    expect(source).toContain('framesToSeconds(track.inFrame, fps)');
    expect(source).toContain('framesToSeconds(track.outFrame, fps)');
    expect(source).toContain('secondsToFrames(val, fps)');
    expect(source).toContain('audioStore.setInOut(track.id, secondsToFrames(val, fps), track.outFrame)');
    expect(source).toContain('audioStore.setInOut(track.id, track.inFrame, secondsToFrames(val, fps))');
    // 1-frame Out span preserved in frame space.
    expect(source).toContain('min={framesToSeconds(track.inFrame + 1, fps)}');
  });

  it('TRACK/file meta shows the audio max as seconds plus frames', () => {
    expect(source).toContain('formatAudioMaxTime');
    expect(source).toContain('track.duration');
    expect(source).toContain('track.totalFramesInFile');
    expect(source).toContain('data-testid="audio-max-time"');
  });
});
