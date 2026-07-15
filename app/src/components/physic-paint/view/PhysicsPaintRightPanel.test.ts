import { describe, expect, it } from 'vitest';
import { getPhysicsPaintSessionControlState } from './PhysicsPaintRightPanel';

describe('Physics Paint right panel session controls', () => {
  it('disables visible Save and Load controls only for the mutation lock duration', () => {
    expect(getPhysicsPaintSessionControlState(true)).toEqual({
      saveDisabled: true,
      loadDisabled: true,
      loadClass: 'physics-paint-text-button physics-paint-load-state disabled-control',
    });
    expect(getPhysicsPaintSessionControlState(false)).toEqual({
      saveDisabled: false,
      loadDisabled: false,
      loadClass: 'physics-paint-text-button physics-paint-load-state',
    });
  });
});
