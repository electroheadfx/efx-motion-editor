/**
 * quick 261127-uxj — the bundled Wootha tips: the 22 shipped app assets.
 *
 * Laws pinned here:
 *   1. The manifest carries 22 unique `wc/default-*` tips in SLUG order with
 *      clean names (`Wootha 002` … `Wootha Charcoal 023`); no id reuses the
 *      machine library's `wc/custom-*` prefix.
 *   2. A load registers every 262,144-byte mask under its bundled id (the
 *      registry returns the IDENTICAL array) and lists the tips in manifest
 *      order with `category: 'custom'` and all-1 multipliers.
 *   3. A wrong-length or null asset skips only that tip and never throws; a
 *      port that throws for every file resolves zero tips and leaves the
 *      signal's frozen empty identity untouched.
 *   4. The loader is single-flight + session-idempotent: concurrent calls
 *      share one port pass, and a later call loads nothing.
 *   5. The strip's ONE ordering law: Default -> the 22 bundled tips -> the
 *      user's machine-library imports (the exported `textureEntries`).
 *   6. Both boot branches await `loadBuiltinBrushTips` before the first render.
 *
 * Node-safe by construction: the loader takes an injected port, so no fetch,
 * Blob or DOM is touched here.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  TIP_MASK_BYTES,
  resetMaskRegistry,
  resolveMask,
  type AquarelleTip,
} from '@efxlab/efx-watercolor';
import { NEUTRAL_TOOL_OVERRIDES } from '@efxlab/efx-watercolor/brushes';
import manifest from '../assets/brush-tips/manifest.json';
import {
  builtinBrushTips,
  builtinMaskEntries,
  loadBuiltinBrushTips,
  resetBuiltinBrushTips,
  type BuiltinTipMaskPort,
} from './builtinBrushTips';
import {
  addCustomBrushTip,
  customBrushTips,
  resetAquarelleBrushCatalog,
} from './aquarelleBrushCatalog';
import {
  textureEntries,
  textureSections,
} from '../components/physic-paint/view/WatercolorTextureStrip';

beforeEach(() => {
  resetBuiltinBrushTips();
  resetMaskRegistry();
  resetAquarelleBrushCatalog();
});

afterEach(() => {
  resetBuiltinBrushTips();
  resetMaskRegistry();
  resetAquarelleBrushCatalog();
});

interface FakePort {
  readonly port: BuiltinTipMaskPort;
  readonly calls: string[];
  readonly masks: Map<string, Uint8Array>;
}

/**
 * A fake port: one distinct, non-zero mask per file (or the caller's override).
 * The map keeps the exact arrays so registration identity is assertable.
 */
function makeFakePort(overrides: Record<string, Uint8Array | null> = {}): FakePort {
  const calls: string[] = [];
  const masks = new Map<string, Uint8Array>();
  const port: BuiltinTipMaskPort = async (file) => {
    calls.push(file);
    if (Object.prototype.hasOwnProperty.call(overrides, file)) return overrides[file] ?? null;
    let mask = masks.get(file);
    if (mask === undefined) {
      mask = new Uint8Array(TIP_MASK_BYTES);
      mask[0] = (calls.length % 251) + 1;
      masks.set(file, mask);
    }
    return mask;
  };
  return { port, calls, masks };
}

describe('builtinBrushTips — the bundled manifest laws', () => {
  it('carries 22 unique wc/default-* tips in slug order with clean names', () => {
    const tips = manifest.tips;
    expect(tips).toHaveLength(22);
    expect(new Set(tips.map((tip) => tip.id)).size).toBe(22);
    expect(new Set(tips.map((tip) => tip.name)).size).toBe(22);
    for (const tip of tips) {
      expect(tip.id.startsWith('wc/default-'), `${tip.id} is a bundled asset id`).toBe(true);
      expect(tip.id.startsWith('wc/custom-'), `${tip.id} never reuses the library prefix`).toBe(false);
      expect(tip.name).toMatch(/^Wootha( Charcoal)? [0-9]{3}$/);
    }
    expect(tips[0]).toMatchObject({ id: 'wc/default-wootha-002', name: 'Wootha 002' });
    const last = tips[tips.length - 1]!;
    expect(last).toMatchObject({ id: 'wc/default-wootha-charcoal-023', name: 'Wootha Charcoal 023' });
    // Slug order — ids share the prefix, so their lexicographic order is it.
    const ids = tips.map((tip) => tip.id);
    expect(ids).toEqual([...ids].sort());
    const files = tips.map((tip) => tip.file);
    expect(files).toEqual([...files].sort());
  });
});

describe('builtinBrushTips — the load', () => {
  it('registers every bundled mask and lists the tips in manifest order', async () => {
    const { port, calls, masks } = makeFakePort();
    const result = await loadBuiltinBrushTips(port);

    expect(result.loaded).toBe(22);
    expect(result.skipped).toEqual([]);
    expect(calls).toEqual(manifest.tips.map((tip) => tip.file));
    expect(builtinBrushTips.value.map((tip) => tip.id)).toEqual(
      manifest.tips.map((tip) => tip.id),
    );

    for (const [index, tip] of builtinBrushTips.value.entries()) {
      const source = manifest.tips[index]!;
      expect(tip.category).toBe('custom');
      expect(tip.name).toBe(source.name);
      // All-1 multipliers — a bundled tip is a neutral texture, never a brush.
      expect(tip).toMatchObject({ ...NEUTRAL_TOOL_OVERRIDES });
      expect(tip.rotation).toBe(1);
      // The registry returns the IDENTICAL array that was registered.
      const registered = resolveMask(tip.id);
      expect(registered).toBe(masks.get(source.file));
      expect(registered).toBe(builtinMaskEntries()[index]!.mask);
      expect(builtinMaskEntries()[index]!.id).toBe(tip.id);
    }
    expect(builtinMaskEntries()).toHaveLength(22);
  });

  it('a wrong-length asset skips only that tip and never throws', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const bad = manifest.tips[3]!;
      const { port } = makeFakePort({ [bad.file]: new Uint8Array(TIP_MASK_BYTES - 1) });
      const result = await loadBuiltinBrushTips(port);

      expect(result.loaded).toBe(21);
      expect(result.skipped).toEqual([bad.id]);
      expect(resolveMask(bad.id)).toBe(null);
      expect(builtinBrushTips.value).toHaveLength(21);
      expect(builtinBrushTips.value.some((tip) => tip.id === bad.id)).toBe(false);
      expect(builtinMaskEntries()).toHaveLength(21);
    } finally {
      warn.mockRestore();
    }
  });

  it('a null answer for one file skips only that tip', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const bad = manifest.tips[7]!;
      const { port } = makeFakePort({ [bad.file]: null });
      const result = await loadBuiltinBrushTips(port);
      expect(result.loaded).toBe(21);
      expect(result.skipped).toEqual([bad.id]);
      expect(resolveMask(bad.id)).toBe(null);
    } finally {
      warn.mockRestore();
    }
  });

  it('a port that throws for every file resolves zero tips and keeps the empty signal', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const before = builtinBrushTips.value;
      const port: BuiltinTipMaskPort = async () => {
        throw new Error('asset missing');
      };
      const result = await loadBuiltinBrushTips(port);

      expect(result.loaded).toBe(0);
      expect(result.skipped).toHaveLength(22);
      expect(builtinBrushTips.value).toBe(before);
      expect(builtinBrushTips.value).toHaveLength(0);
      expect(builtinMaskEntries()).toHaveLength(0);
    } finally {
      warn.mockRestore();
    }
  });

  it('is single-flight: concurrent callers share one port pass', async () => {
    const { port, calls } = makeFakePort();
    const [first, second] = await Promise.all([
      loadBuiltinBrushTips(port),
      loadBuiltinBrushTips(port),
    ]);
    expect(first).toBe(second);
    expect(calls).toHaveLength(22);
  });

  it('is session-idempotent: a second call loads nothing and keeps the signal identity', async () => {
    const { port, calls } = makeFakePort();
    const first = await loadBuiltinBrushTips(port);
    const tipsAfterFirst = builtinBrushTips.value;
    const entriesAfterFirst = builtinMaskEntries();

    const second = await loadBuiltinBrushTips(port);

    expect(second).toBe(first);
    expect(calls, 'one port call per manifest file in total').toHaveLength(22);
    expect(builtinBrushTips.value).toBe(tipsAfterFirst);
    expect(builtinMaskEntries()).toBe(entriesAfterFirst);
  });
});

describe('builtinBrushTips — the strip ordering law (tracer slice)', () => {
  it('yields Default, then the 22 bundled tips in manifest order, then user imports', async () => {
    const { port } = makeFakePort();
    await loadBuiltinBrushTips(port);
    const custom: AquarelleTip = {
      id: 'wc/custom-tracer-fixture',
      category: 'custom',
      name: 'Tracer import',
      ...NEUTRAL_TOOL_OVERRIDES,
    };
    addCustomBrushTip(custom);
    try {
      const entries = textureEntries(builtinBrushTips.value, customBrushTips.value, new Set());
      expect(entries).toHaveLength(24);
      expect(entries[0]).toEqual({ id: null, name: 'Default', unavailable: false });
      expect(entries.slice(1, 23).map((entry) => entry.id)).toEqual(
        manifest.tips.map((tip) => tip.id),
      );
      expect(entries[23]).toEqual({
        id: 'wc/custom-tracer-fixture',
        name: 'Tracer import',
        unavailable: false,
      });
      // A bundled chip is never unavailable: its mask is either loaded or the
      // chip does not exist at all.
      expect(entries.slice(1, 23).every((entry) => entry.unavailable === false)).toBe(true);
    } finally {
      resetAquarelleBrushCatalog();
    }
  });

  it('splits the strip into a labelled app section and a labelled user section', async () => {
    const { port } = makeFakePort();
    await loadBuiltinBrushTips(port);
    const custom: AquarelleTip = {
      id: 'wc/custom-section-fixture',
      category: 'custom',
      name: 'Section import',
      ...NEUTRAL_TOOL_OVERRIDES,
    };
    addCustomBrushTip(custom);
    try {
      const sections = textureSections(
        builtinBrushTips.value,
        customBrushTips.value,
        new Set(['wc/custom-section-fixture']),
      );
      expect(sections.map((section) => section.key)).toEqual(['app', 'user']);
      expect(sections.map((section) => section.label)).toEqual(['Built-in', 'Your tips']);
      // The app section owns the Default chip and every bundled tip.
      expect(sections[0]!.entries).toHaveLength(23);
      expect(sections[0]!.entries[0]).toEqual({ id: null, name: 'Default', unavailable: false });
      expect(sections[0]!.entries.slice(1).map((entry) => entry.id)).toEqual(
        manifest.tips.map((tip) => tip.id),
      );
      // The user section carries the imports, unavailable flag included.
      expect(sections[1]!.entries).toEqual([
        { id: 'wc/custom-section-fixture', name: 'Section import', unavailable: true },
      ]);
    } finally {
      resetAquarelleBrushCatalog();
    }
  });

  it('omits the user section while the machine library is empty', async () => {
    const { port } = makeFakePort();
    await loadBuiltinBrushTips(port);
    const sections = textureSections(builtinBrushTips.value, customBrushTips.value, new Set());
    expect(sections.map((section) => section.key)).toEqual(['app']);
    expect(sections[0]!.entries[0]!.id).toBeNull();
    expect(sections[0]!.entries).toHaveLength(23);
  });

  it('both boot branches await loadBuiltinBrushTips before the first render', () => {
    const source = readFileSync(resolve(__dirname, '../main.tsx'), 'utf8');
    // Once in the Studio branch, once in the main-window branch.
    expect(source.split('await loadBuiltinBrushTips();').length - 1).toBe(2);
    const studioAwait = source.indexOf('await loadBuiltinBrushTips();');
    const mainAwait = source.lastIndexOf('await loadBuiltinBrushTips();');
    expect(studioAwait, 'a Studio-branch await exists').toBeGreaterThanOrEqual(0);
    expect(
      source.indexOf('render(<PhysicsPaintStudio />, root)'),
      'the Studio render follows its await',
    ).toBeGreaterThan(studioAwait);
    expect(
      source.indexOf('render(<App />, root)'),
      'the main render follows its await',
    ).toBeGreaterThan(mainAwait);
  });
});
