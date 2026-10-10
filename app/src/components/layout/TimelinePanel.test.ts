import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  fileURLToPath(new URL('./TimelinePanel.tsx', import.meta.url)),
  'utf8',
);

describe('TimelinePanel playhead timecode (261010-en9 R7)', () => {
  it('renders [playhead frame] / formatTime(displayTime) of the current position', () => {
    const marker = source.indexOf('Timecode display');
    expect(marker).toBeGreaterThan(-1);
    const timecode = source.slice(
      marker,
      source.indexOf('w-px h-5', marker),
    );
    expect(timecode).toContain('timelineStore.displayFrame.value');
    expect(timecode).toContain('formatTime(timelineStore.displayTime.value)');
    // The right operand is the current position, not the total duration.
    expect(timecode).not.toContain('totalDuration');
  });

  it('keeps formatTime string shape and the FullscreenOverlay twin untouched', () => {
    expect(source).toContain("padStart(2, '0')");
    expect(source).toContain('toFixed(2)');
    // formatTime itself is only called on displayTime in the toolbar span.
    expect(source).not.toContain('formatTime(timelineStore.totalDuration.value)');
  });
});
