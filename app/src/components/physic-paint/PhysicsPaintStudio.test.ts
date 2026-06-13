import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const sourcePath = fileURLToPath(new URL('./PhysicsPaintStudio.tsx', import.meta.url));
const source = () => readFileSync(sourcePath, 'utf8');

describe('PhysicsPaintStudio Play relaunch hydration contract', () => {
  it('initializes workflow mode and Play range from launch context metadata instead of hardcoded Roto defaults', () => {
    const text = source();

    expect(text).toContain('launchContext?.workflowMode ?? \'roto\'');
    expect(text).toContain('launchContext?.playFrameCount ?? PHYSIC_PAINT_DEFAULT_APPLY_FRAMES');
    expect(text).toContain('const currentFrame = launchContext?.startFrame ?? 0');
    expect(text).not.toContain("useState<PhysicsPaintWorkflowMode>('roto')");
    expect(text).not.toContain('useState(4)');
  });

  it('accepts saved Play source metadata through the parsed launch context path', () => {
    const text = source();

    expect(text).toContain('workflowMode: workflowMode === \'play\' ? \'play\' : \'roto\'');
    expect(text).toContain('playStartFrame: Number.isInteger(playStartFrame) && playStartFrame >= 0 ? playStartFrame : undefined');
    expect(text).toContain('playFrameCount: Number.isInteger(playFrameCount) && playFrameCount > 0 ? playFrameCount : undefined');
    expect(text).toContain('editableSource: editableSource === \'play\' ? \'play\' : editableSource === \'roto\' ? \'roto\' : undefined');
    expect(text).toContain('const parsed = JSON.parse(encodedContext)');
    expect(text).not.toContain('JSON.parse(decodeURIComponent(encodedContext))');
  });

  it('keeps Play frame conversion availability separate from cleared onion preview state', () => {
    const text = source();

    expect(text).toContain('const [playFramesVersion, setPlayFramesVersion] = useState(0)');
    expect(text).toContain('latestPlayFramesRef.current = frames');
    expect(text).toContain('setLatestPlayFrames([])');
    expect(text).toContain('setPlayFramesVersion((version) => version + 1)');
    expect(text).toContain('new Set(latestPlayFramesRef.current.map((frame) => frame.appFrame))');
    expect(text).toContain('playFramesVersion');
  });
});
