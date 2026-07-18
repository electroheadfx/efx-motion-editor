import { describe, expect, it } from 'vitest';
import { clearRotoEngineCanvas } from './useRotoPersistenceIntegration';

describe('Roto persistence clear restoration', () => {
  it('clears the preview base before resetting the background and clearing paint', () => {
    const calls: string[] = [];
    const engine = {
      clearPreviewBaseImage: () => { calls.push('clearPreviewBaseImage'); },
      resetBackground: () => { calls.push('resetBackground'); },
      clear: () => { calls.push('clear'); },
    } as unknown as Parameters<typeof clearRotoEngineCanvas>[0];

    clearRotoEngineCanvas(engine);

    expect(calls).toEqual(['clearPreviewBaseImage', 'resetBackground', 'clear']);
  });
});
