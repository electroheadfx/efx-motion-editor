import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const studio = readFileSync(fileURLToPath(new URL('../components/physic-paint/PhysicsPaintStudio.tsx', import.meta.url)), 'utf8');
const parentBridge = readFileSync(fileURLToPath(new URL('../components/physic-paint/bridge/usePhysicsPaintParentBridge.ts', import.meta.url)), 'utf8');

describe('EFX-local Loop Clip operation ownership', () => {
  it('routes Loop Clip operations locally without specialized child listeners', () => {
    expect(studio).toContain('onOpenRotoLoopEdit: handleOpenRotoLoopEdit');
    expect(studio).toContain('return rotoPlayScript.openLoopEdit(loopId);');

    for (const removed of [
      'usePhysicsPaintOpenLoopEditBridge',
      'usePhysicsPaintLoopOperationBridge',
      'createPhysicsPaintLoopOperationRequestHandler',
      'PHYSIC_PAINT_OPEN_LOOP_EDIT_EVENT',
      'PHYSIC_PAINT_LOOP_OPERATION_REQUEST_EVENT',
    ]) {
      expect(studio).not.toContain(removed);
      expect(parentBridge).not.toContain(removed);
    }
  });
});
