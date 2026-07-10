import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const sourcePath = fileURLToPath(new URL('./usePhysicsPaintEngineActions.ts', import.meta.url));
const source = () => readFileSync(sourcePath, 'utf8');

describe('Physics Paint engine actions', () => {
  it('owns all setting-to-engine action wiring outside the Studio', () => {
    const text = source();

    expect(text).toContain('const updateSetting = useCallback');
    expect(text).toContain("input.engine.setTool(tool)");
    expect(text).toContain("input.engine.setPhysicsMode(physicsMode)");
    expect(text).toContain("input.engine.setColorHex(color)");
    expect(text).toContain("input.engine.setBrushOpacity(opacity)");
    expect(text).toContain("input.engine?.setBrushSize(size)");
    expect(text).toContain("input.engine?.setBgMode(background)");
    expect(text).toContain("input.engine?.setPaperGrain(paperGrain)");
    expect(text).toContain("input.engine?.setEmbossStrength(grainStrength)");
    expect(text).toContain("input.engine?.setEdgeDetail(edgeDetail)");
    expect(text).toContain("input.engine?.setPickup(pickup)");
    expect(text).toContain("input.engine?.setLocalSpreadStrength(spread)");
    expect(text).toContain("input.engine?.setAntiAlias(smoothing)");
    expect(text).toContain("input.engine?.setEraseStrength(eraseStrength)");
    expect(text).toContain("engine.startPhysics(mode)");
    expect(text).toContain("engine.stopPhysics()");
    expect(text).toContain("activePhysicsAction: mode");
    expect(text).toContain("activePhysicsAction: null");
  });
});
