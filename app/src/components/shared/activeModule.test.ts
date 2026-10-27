// 261019-mj2 UAT: closing the Studio DESTROYS its window and reopening BUILDS
// a new webview. sessionStorage dies with that webview, so the chosen module
// reset on every reopen. The module must persist in localStorage.
//
// 261027-klx: @efxlab/efx-watercolor is the only paint engine. Water color is
// the ONLY module, a persisted value from an older build is discarded, and
// every persisted write is the single live module.

import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

/** Force a stale write past the collapsed union — simulates an old build. */
function forceStaleWrite(moduleSignal: unknown, value: string): void {
  (moduleSignal as { value: string }).value = value;
}

describe('activeModule survives a recreated Studio webview', () => {
  it('starts in watercolor and discards a stored legacy value', async () => {
    const getItem = vi.fn(() => 'brush');
    vi.stubGlobal('localStorage', { getItem, setItem: vi.fn() });
    vi.stubGlobal('sessionStorage', { getItem: vi.fn(() => null), setItem: vi.fn() });
    const { activeModule } = await import('./activeModule');
    expect(activeModule.value).toBe('watercolor');
    // The legacy value is read for diagnostics but never trusted.
    expect(getItem).toHaveBeenCalledWith('efx-active-module');
  });

  it('persists only the single live module to localStorage, never sessionStorage', async () => {
    const setItem = vi.fn();
    const sessionSetItem = vi.fn();
    vi.stubGlobal('localStorage', { getItem: vi.fn(() => null), setItem });
    vi.stubGlobal('sessionStorage', { getItem: vi.fn(() => null), setItem: sessionSetItem });
    const { activeModule } = await import('./activeModule');
    // A stale value can only arrive by bypassing the typed setter (old build).
    forceStaleWrite(activeModule, 'brush');
    expect(setItem).toHaveBeenCalledWith('efx-active-module', 'watercolor');
    expect(setItem).not.toHaveBeenCalledWith('efx-active-module', 'brush');
    expect(sessionSetItem).not.toHaveBeenCalled();
  });
});

describe('single-engine module signal (261027-klx)', () => {
  it('resolves watercolor from any stored value and exports no seam constant', async () => {
    vi.stubGlobal('localStorage', { getItem: vi.fn(() => 'brush'), setItem: vi.fn() });
    const mod = await import('./activeModule');
    expect(mod.activeModule.value).toBe('watercolor');
    mod.setActiveModule('watercolor');
    expect(mod.activeModule.value).toBe('watercolor');
    expect('WATERCOLOR_ONLY' in mod).toBe(false);
  });

  it('does not wake subscribers for an unchanged write', async () => {
    vi.stubGlobal('localStorage', { getItem: vi.fn(() => null), setItem: vi.fn() });
    const { activeModule, setActiveModule } = await import('./activeModule');
    const seen: string[] = [];
    const unsubscribe = activeModule.subscribe((value) => {
      seen.push(value);
    });
    try {
      setActiveModule('watercolor');
      setActiveModule('watercolor');
    } finally {
      unsubscribe();
    }
    // Only the initial subscribe delivery — every write was a no-op.
    expect(seen).toEqual(['watercolor']);
  });
});
