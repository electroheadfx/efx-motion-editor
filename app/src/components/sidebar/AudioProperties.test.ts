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

describe('AudioProperties SliderStepper re-flow (261009-v0s)', () => {
  it('renders exactly five SliderStepper fields with the locked labels', () => {
    expect(source.match(/<SliderStepper/g)).toHaveLength(5);
    for (const label of [
      'label="Fade in (frames)"',
      'label="Fade out (frames)"',
      'label="Position (frames)"',
      'label="In (frames)"',
      'label="Out (frames)"',
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
    expect(source).toContain('min={track.inFrame + 1}');
  });

  it('Position commit is unbounded (negatives legal) with a track-only slider range below 0', () => {
    const positionField = source.slice(
      source.indexOf('label="Position (frames)"'),
      source.indexOf('label="In (frames)"'),
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

describe('AudioProperties Studio section headers (261009-v0s)', () => {
  it('uses RuleSectionHeader for the five content section titles', () => {
    expect(source).toContain("from '../shared/RuleSectionHeader'");
    for (const title of ['TRACK NAME', 'FILE', 'VOLUME', 'FADES', 'POSITION']) {
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
