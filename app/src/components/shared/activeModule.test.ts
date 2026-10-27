// 261019-mj2 UAT: closing the Studio DESTROYS its window and reopening BUILDS
// a new webview. sessionStorage dies with that webview, so the chosen module
// reset to Brush on every reopen. The module must persist in localStorage.
//
// 261027-gh9: Water color is the ONLY module behind the WATERCOLOR_ONLY seam.
// A persisted 'brush' is never read, and every write clamps to 'watercolor'.

import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('activeModule survives a recreated Studio webview', () => {
  it('starts in watercolor and ignores a stored brush', async () => {
    const getItem = vi.fn(() => 'brush');
    vi.stubGlobal('localStorage', { getItem, setItem: vi.fn() });
    vi.stubGlobal('sessionStorage', { getItem: vi.fn(() => null), setItem: vi.fn() });
    const { activeModule } = await import('./activeModule');
    expect(activeModule.value).toBe('watercolor');
    // The seam returns before the storage branch is reached at all.
    expect(getItem).not.toHaveBeenCalled();
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

describe('WATERCOLOR_ONLY seam (261027-gh9)', () => {
  it('exports the seam on and clamps every setActiveModule write to watercolor', async () => {
    vi.stubGlobal('localStorage', { getItem: vi.fn(() => 'brush'), setItem: vi.fn() });
    const mod = await import('./activeModule');
    expect(mod.WATERCOLOR_ONLY).toBe(true);
    mod.setActiveModule('brush');
    expect(mod.activeModule.value).toBe('watercolor');
    mod.setActiveModule('watercolor');
    expect(mod.activeModule.value).toBe('watercolor');
  });

  it('does not wake subscribers for a clamped or unchanged write', async () => {
    vi.stubGlobal('localStorage', { getItem: vi.fn(() => null), setItem: vi.fn() });
    const { activeModule, setActiveModule } = await import('./activeModule');
    const seen: string[] = [];
    const unsubscribe = activeModule.subscribe((value) => {
      seen.push(value);
    });
    try {
      setActiveModule('watercolor');
      setActiveModule('brush');
      setActiveModule('watercolor');
      setActiveModule('brush');
    } finally {
      unsubscribe();
    }
    // Only the initial subscribe delivery — every write was a clamped no-op.
    expect(seen).toEqual(['watercolor']);
  });

  it('never persists brush while the seam is on', async () => {
    const setItem = vi.fn();
    vi.stubGlobal('localStorage', { getItem: vi.fn(() => null), setItem });
    const { activeModule } = await import('./activeModule');
    activeModule.value = 'brush';
    expect(setItem).toHaveBeenCalledWith('efx-active-module', 'watercolor');
    expect(setItem).not.toHaveBeenCalledWith('efx-active-module', 'brush');
  });
});
