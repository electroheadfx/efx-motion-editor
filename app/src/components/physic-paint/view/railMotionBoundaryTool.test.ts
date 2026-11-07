// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * 261107 UAT — the Motion boundaries tool and the animate-mode gate.
 *
 * Laws pinned here:
 *   - the left rail carries the Motion boundaries host toggle;
 *   - deploying a lane alone never arms the canvas boundary; ONE selected
 *     property (highlighted white in the pinned header) does;
 *   - picking a paint/select/picker tool leaves animate mode but keeps the
 *     lane deployed, so painting with the lanes open is the normal path.
 */

const rail = readFileSync(fileURLToPath(new URL('./PhysicsPaintToolRail.tsx', import.meta.url)), 'utf8');
const editing = readFileSync(fileURLToPath(new URL('./railMotionEditingMode.ts', import.meta.url)), 'utf8');
const recordState = readFileSync(fileURLToPath(new URL('./aquarelleRecordState.ts', import.meta.url)), 'utf8');
const selectState = readFileSync(fileURLToPath(new URL('./aquarelleStrokeSelection.ts', import.meta.url)), 'utf8');
const strip = readFileSync(fileURLToPath(new URL('./PhysicsPaintWorkflowStrip.tsx', import.meta.url)), 'utf8');
const hook = readFileSync(fileURLToPath(new URL('../hooks/useRotoTimelineActions.ts', import.meta.url)), 'utf8');

describe('Motion boundaries tool (261107 UAT)', () => {
  it('renders the host toggle in the left rail and mirrors animate mode', () => {
    expect(rail).toContain('data-testid="aquarelle-motion-boundary-toggle"');
    expect(rail).toContain('aria-label="Motion boundaries"');
    expect(rail).toContain('aria-pressed={motionBoundaryActive}');
    expect(rail).toContain('<Scan size={18} />');
    expect(rail).toContain('onClick={onToggleMotionBoundaries}');
    expect(rail).toContain('const motionBoundaryActive = railMotionSelectedChannel.value !== null;');
  });

  it('paint, select and picker picks leave animate mode so the brush is never blocked', () => {
    expect(recordState).toMatch(/export function setAquarelleTool[\s\S]*?exitRailMotionEditing\(\)/);
    expect(selectState).toMatch(/if \(on\) \{\s*disarmAquarellePicker\(\);\s*exitRailMotionEditing\(\);/);
    expect(rail).toContain('if (!pickerActive) exitRailMotionEditing();');
  });

  it('keeps the rail exclusive — animate mode never lights a second tool', () => {
    // The paint row renders deselected while Motion boundaries is active.
    expect(rail).toContain('!selectActive && !pickerActive && !motionBoundaryActive && active === id');
    // Entering animate mode retires Select and the picker on BOTH entry paths:
    // the rail tool (Studio handler) and the property click (strip).
    const studio = readFileSync(fileURLToPath(new URL('../PhysicsPaintStudio.tsx', import.meta.url)), 'utf8');
    expect(studio).toMatch(/setAquarelleSelectMode\(false\);\s*disarmAquarellePicker\(\);\s*selectRailMotionChannel\(channel\);/);
    expect(strip).toMatch(/setAquarelleSelectMode\(false\);\s*disarmAquarellePicker\(\);\s*toggleRailMotionChannelSelection\(channel\);/);
  });

  it('the canvas gizmo needs ONE present draggable channel — an open block alone is not enough', () => {
    // 261107-qgj added the ONE close-path symbol to the same import.
    expect(hook).toContain(
      "import { exitRailMotionEditing, railMotionSelectedChannel } from '../view/railMotionEditingMode';",
    );
    expect(hook).toMatch(/const selectedChannel = railMotionSelectedChannel\.value;/);
    expect(hook).toMatch(/if \(selectedChannel === null \|\| selectedChannel === 'opacity'\) return null;/);
    expect(hook).toContain('if (!resolveMotionChannelPresence(state.record.channels)[selectedChannel]) return null;');
    expect(hook).toContain('selectedChannel,');
  });

  it('the pinned header rows write that same single animate-mode state', () => {
    expect(editing).toContain('export const railMotionSelectedChannel');
    expect(editing).toContain('export const railMotionLastSelectedChannel');
    expect(strip).toContain('const selectedMotionChannel = railMotionSelectedChannel.value;');
    expect(strip).toContain('selectedChannel: selectedMotionChannel');
    expect(strip).toMatch(/onSelectChannel: \(channel\) => \{[\s\S]*?toggleRailMotionChannelSelection\(channel\);/);
  });
});
