import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const viewDirectory = dirname(fileURLToPath(import.meta.url));
const readSource = (relativePath: string): string => {
  const path = resolve(viewDirectory, relativePath);
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
};

describe('PhysicsPaintLoopClipRail ownership tracer', () => {
  it('integrates Loop Clip ownership through all nine tracer checks', () => {
    const rail = readSource('PhysicsPaintLoopClipRail.tsx');
    const presentation = readSource('physicsPaintLoopClipPresentation.ts');
    const workflow = readSource('PhysicsPaintWorkflowStrip.tsx');
    const scripts = readSource('PhysicsPaintScriptsPanel.tsx');
    const studio = readSource('../PhysicsPaintStudio.tsx');
    const css = readSource('../physicsPaintStudio.css');
    const frameMap = readSource('../../../lib/frameMap.ts');

    expect(css).toMatch(/\.physics-paint-workflow-strip\s*\{[^}]*height:\s*161px/s);
    expect(css).toMatch(/\.physics-paint-lane\s*\{[^}]*height:\s*38px/s);
    expect(css).not.toContain('.physics-paint-loop-clip-lane');

    expect(workflow).toContain("import { PhysicsPaintLoopClipRail } from './PhysicsPaintLoopClipRail';");
    const physicalRowStart = workflow.indexOf('class="physics-paint-lane"');
    const railMount = workflow.indexOf('<PhysicsPaintLoopClipRail');
    const physicalRowEnd = workflow.indexOf('</div>', physicalRowStart);
    expect(physicalRowStart).toBeGreaterThanOrEqual(0);
    expect(railMount).toBeGreaterThan(physicalRowStart);
    expect(railMount).toBeLessThan(physicalRowEnd);
    expect(workflow).not.toContain('PhysicsPaintLoopClipLane');

    expect(rail).toContain('physics-paint-loop-clip-rail-target');
    expect(css).toMatch(/\.physics-paint-loop-clip-rail-segment\s*\{[^}]*height:\s*3px/s);
    expect(css).toMatch(/\.physics-paint-loop-clip-rail-target\s*\{[^}]*height:\s*12px/s);
    expect(workflow).toContain('loopResolutionContext.ranges.length > 0 ?');

    for (const fact of ['displayName', 'cycleLabel', 'effectiveLabel', 'statusLabel']) {
      expect(presentation).toContain(fact);
      expect(rail).toContain(`presentation.${fact}`);
    }
    expect(rail).toContain('PhysicsPaintStyledTooltip');

    expect(rail).toContain('onSelectLoopClip(range.loopId)');
    expect(rail).toContain('event.stopPropagation()');
    expect(rail).not.toContain('setPointerCapture');
    expect(rail).not.toContain('onPointerMove');
    expect(rail).not.toContain('onDrag');

    expect(rail).toContain("event.detail === 2");
    expect(rail).toContain("event.key === 'Enter'");
    expect(rail.match(/onOpenLoopEdit\(range\.loopId\)/g)).toHaveLength(2);

    expect(studio).toContain('const selectedLoopClipId = useSignal<string | null>(null);');
    expect(workflow).toContain('selectedLoopClipId={props.selectedRotoLoopClipId ?? null}');
    expect(scripts).toContain('selectedLoopClip');
    expect(scripts).toContain('Edit Loop Clip');
    for (const fact of ['displayName', 'sourceLabel', 'placementLabel', 'cycleLabel', 'effectiveLabel', 'modeLabel', 'statusLabel']) {
      expect(scripts).toContain(`selectedLoopClip.${fact}`);
    }

    expect(workflow).toContain('roto-linked-loop-badge');
    expect(css).toMatch(/\.physics-paint-roto-cell\.roto-linked-loop-badge\s*\{[^}]*rgba\(45, 91, 227, 0\.9\)/s);
    expect(css).toMatch(/\.physics-paint-roto-cell\.roto-linked-loop-badge::after\s*\{[^}]*width:\s*4px[^}]*height:\s*4px/s);

    expect(frameMap).not.toContain('loopCapsules:');
    expect(frameMap).not.toContain('buildTimelineLoopCapsules');
  });
});
