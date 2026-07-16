import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./useRotoScriptLibraryController.ts', import.meta.url)), 'utf8');

describe('persistent Roto script library hook', () => {
  it('redetects bridge mode at action time after initial Unavailable without recreating the controller', () => {
    expect(source).toContain("bridgeModeRef.current === 'Unavailable'");
    expect(source).toContain('await detectPhysicsPaintBridgeMode()');
    expect(source).toContain('sendPhysicPaintScriptLibraryRequest(request, currentBridgeMode)');
    expect(source.indexOf('await detectPhysicsPaintBridgeMode()')).toBeLessThan(source.indexOf('sendPhysicPaintScriptLibraryRequest(request, currentBridgeMode)'));
    expect(source).toContain('if (!controllerRef.current)');
  });

  it('correlates pending results and clears timeout/disposal state', () => {
    expect(source).toContain('pending.current.get(result.operationId)');
    expect(source).toContain('pending.current.delete(result.operationId)');
    expect(source).toContain('clearTimeout(operation.timeout)');
    expect(source).toContain('pending.current.clear()');
    expect(source).toContain('controllerRef.current?.dispose()');
  });
});
