// 261019-mj2 UAT: closing the Studio DESTROYS its window and reopening BUILDS
// a new webview. sessionStorage dies with that webview, so the chosen module
// reset to Brush on every reopen. The module must persist in localStorage.

import { afterEach, describe, expect, it, vi } from 'vitest';

describe('activeModule survives a recreated Studio webview', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('restores watercolor from localStorage at module load', async () => {
    const getItem = vi.fn((key: string) => (key === 'efx-active-module' ? 'watercolor' : null));
    vi.stubGlobal('localStorage', { getItem, setItem: vi.fn() });
    vi.stubGlobal('sessionStorage', { getItem: vi.fn(() => null), setItem: vi.fn() });
    const { activeModule } = await import('./activeModule');
    expect(activeModule.value).toBe('watercolor');
    expect(getItem).toHaveBeenCalledWith('efx-active-module');
  });

  it('persists module changes to localStorage, never sessionStorage', async () => {
    const setItem = vi.fn();
    const sessionSetItem = vi.fn();
    vi.stubGlobal('localStorage', { getItem: vi.fn(() => null), setItem });
    vi.stubGlobal('sessionStorage', { getItem: vi.fn(() => null), setItem: sessionSetItem });
    const { activeModule } = await import('./activeModule');
    activeModule.value = 'watercolor';
    expect(setItem).toHaveBeenCalledWith('efx-active-module', 'watercolor');
    expect(sessionSetItem).not.toHaveBeenCalled();
  });
});
