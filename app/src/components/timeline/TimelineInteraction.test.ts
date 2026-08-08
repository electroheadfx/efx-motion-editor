import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const interaction = readFileSync(fileURLToPath(new URL('./TimelineInteraction.ts', import.meta.url)), 'utf8');
const canvas = readFileSync(fileURLToPath(new URL('./TimelineCanvas.tsx', import.meta.url)), 'utf8');

describe('Motion Editor passive Loop Clip marker interaction contract', () => {
  it('ignores former Loop Clip coordinates and keys in the Motion Editor', () => {
    for (const removed of [
      'LoopCapsuleHit',
      'getLoopCapsuleHitRegions',
      'hitTestLoopCapsule',
      'dispatchLoopCapsuleHit',
      'dispatchFocusedLoopCapsuleKey',
      'loopCapsuleHitTest',
      'selectedTimelineLoopClipId',
      'focusedTimelineLoopClipId',
      'hoveredTimelineLoopClipId',
      'timelineLoopCapsuleTooltipRequest',
      'openPhysicPaintLoopEdit',
      'requestPhysicPaintLoopOperation',
    ]) expect(interaction).not.toContain(removed);

    expect(canvas).not.toContain('TimelineCapsuleTooltip');
    expect(canvas).not.toContain('selectedLoopClipId');
    expect(canvas).not.toContain('hoveredLoopClipId');
    expect(canvas).not.toContain('focusedLoopClipId');
  });
});
