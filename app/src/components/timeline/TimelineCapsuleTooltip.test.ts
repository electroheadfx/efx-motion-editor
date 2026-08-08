import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const directory = dirname(fileURLToPath(import.meta.url));

describe('Motion Editor Loop Clip ownership removal', () => {
  it('has no Motion Editor Loop Clip tooltip module after ownership removal', () => {
    expect(existsSync(resolve(directory, 'TimelineCapsuleTooltip.tsx'))).toBe(false);
    expect(existsSync(resolve(directory, 'loopCapsuleGeometry.ts'))).toBe(false);

    const canvas = readFileSync(resolve(directory, 'TimelineCanvas.tsx'), 'utf8');
    const interaction = readFileSync(resolve(directory, 'TimelineInteraction.ts'), 'utf8');
    expect(canvas).not.toContain('TimelineCapsuleTooltip');
    expect(interaction).not.toContain('timelineLoopCapsuleTooltipRequest');
    expect(interaction).not.toContain('loopCapsuleGeometry');
  });
});
