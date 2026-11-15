/**
 * 63-04 / TIP-11 / TIP-13 — the project brush-tip catalog standing pins.
 *
 * Laws pinned here:
 *   1. The built-ins come from `BUILTIN_TIPS` (63-03) and are always listed
 *      first; a fresh catalog with no project imports resolves them.
 *   2. `replaceUnavailableTipIds` REPLACES the whole set — `[]` clears it and
 *      a second call never appends to the first (D-20).
 *   3. `buildProjectBrushPack` covers CUSTOM entries only and returns `null`
 *      when there are none, so a project with no imports omits the key (D-10).
 *   4. Built-in ids never appear in a project pack.
 *
 * Assertion style: scalar predicates (toHaveLength / toBe) so failures stay
 * one-line, matching the 63-01 corpus.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { BUILTIN_TIPS, type AquarelleTip } from '@efxlab/efx-watercolor';
import {
  addCustomBrushTip,
  brushCatalogGeneration,
  buildProjectBrushPack,
  customBrushTips,
  listAquarelleBrushTips,
  replaceCustomBrushTips,
  replaceUnavailableTipIds,
  resetAquarelleBrushCatalog,
  resolveCatalogTip,
  unavailableTipCount,
  unavailableTipIds,
} from './aquarelleBrushCatalog';

const DIGEST = 'b'.repeat(64);
const ASSET = `brushes/${DIGEST}.webp`;

function customTip(id: string, extra: Partial<AquarelleTip> = {}): AquarelleTip {
  return {
    id,
    category: 'custom',
    name: `Custom ${id}`,
    tip: 1,
    aspect: 1,
    rotation: 1,
    sizeCurve: 1,
    scatter: 1,
    capacity: 1,
    grain: 1,
    wetRound: 1,
    asset: ASSET,
    ...extra,
  };
}

afterEach(() => {
  resetAquarelleBrushCatalog();
});

describe('aquarelleBrushCatalog — built-in baseline (TIP-13)', () => {
  it('a fresh catalog lists exactly the three built-ins from BUILTIN_TIPS', () => {
    const listed = listAquarelleBrushTips();
    expect(listed).toHaveLength(3);
    expect(listed.map((tip) => tip.id)).toEqual([
      'wc/builtin-bristle',
      'wc/builtin-chalk',
      'wc/builtin-sponge',
    ]);
    expect(listed[0]).toBe(BUILTIN_TIPS[0]);
  });

  it('resolves a built-in with no project and returns null for an unknown id', () => {
    expect(resolveCatalogTip('wc/builtin-bristle')?.name).toBe('Bristle fan');
    expect(resolveCatalogTip('wc/custom-missing')).toBe(null);
  });
});

describe('aquarelleBrushCatalog — custom entries', () => {
  it('addCustomBrushTip appends, resolves, and bumps the generation', () => {
    const before = brushCatalogGeneration.value;
    const tip = customTip('wc/custom-11111111');
    addCustomBrushTip(tip);
    expect(customBrushTips.value).toHaveLength(1);
    expect(customBrushTips.value[0]).toBe(tip);
    expect(resolveCatalogTip('wc/custom-11111111')).toBe(tip);
    expect(listAquarelleBrushTips()).toHaveLength(4);
    expect(brushCatalogGeneration.value).toBe(before + 1);
  });

  it('replaceCustomBrushTips replaces the whole list and never appends', () => {
    addCustomBrushTip(customTip('wc/custom-22222222'));
    const replacement = [customTip('wc/custom-33333333'), customTip('wc/custom-44444444')];
    replaceCustomBrushTips(replacement);
    expect(customBrushTips.value).toHaveLength(2);
    expect(customBrushTips.value.map((tip) => tip.id)).toEqual([
      'wc/custom-33333333',
      'wc/custom-44444444',
    ]);
  });

  it('an identical replace is a no-op (generation does not move)', () => {
    const first = customTip('wc/custom-55555555');
    const second = customTip('wc/custom-66666666');
    const replacement = [first, second];
    replaceCustomBrushTips(replacement);
    const settled = brushCatalogGeneration.value;
    replaceCustomBrushTips([first, second]);
    expect(brushCatalogGeneration.value).toBe(settled);
  });

  it('reset clears customs and unavailable ids, and bumps once', () => {
    addCustomBrushTip(customTip('wc/custom-77777777'));
    replaceUnavailableTipIds(['wc/custom-77777777']);
    const before = brushCatalogGeneration.value;
    resetAquarelleBrushCatalog();
    expect(customBrushTips.value).toHaveLength(0);
    expect(unavailableTipIds.value.size).toBe(0);
    expect(brushCatalogGeneration.value).toBe(before + 1);
    expect(listAquarelleBrushTips()).toHaveLength(3);
    // A second reset has nothing left to clear.
    resetAquarelleBrushCatalog();
    expect(brushCatalogGeneration.value).toBe(before + 1);
  });
});

describe('aquarelleBrushCatalog — the replace-only unavailable set (D-20)', () => {
  it('replaceUnavailableTipIds replaces the whole set', () => {
    replaceUnavailableTipIds(['a', 'b']);
    expect([...unavailableTipIds.value].sort()).toEqual(['a', 'b']);
    expect(unavailableTipCount.value).toBe(2);
    replaceUnavailableTipIds(['c']);
    expect([...unavailableTipIds.value]).toEqual(['c']);
    expect(unavailableTipCount.value).toBe(1);
  });

  it('[] clears the set', () => {
    replaceUnavailableTipIds(['a']);
    replaceUnavailableTipIds([]);
    expect(unavailableTipIds.value.size).toBe(0);
    expect(unavailableTipCount.value).toBe(0);
  });

  it('a second call never appends to the first', () => {
    replaceUnavailableTipIds(['a']);
    replaceUnavailableTipIds(['b']);
    expect(unavailableTipIds.value.has('a')).toBe(false);
    expect([...unavailableTipIds.value]).toEqual(['b']);
  });
});

describe('aquarelleBrushCatalog — buildProjectBrushPack (D-10)', () => {
  it('returns null when the project has no imports (the key is then omitted)', () => {
    expect(buildProjectBrushPack()).toBe(null);
  });

  it('carries custom entries with their asset refs and no built-in ids', () => {
    addCustomBrushTip(customTip('wc/custom-88888888'));
    const pack = buildProjectBrushPack();
    expect(pack === null).toBe(false);
    if (pack === null) return;
    expect(pack.kind).toBe('efx-watercolor');
    expect(pack.entries).toHaveLength(1);
    const entry = pack.entries[0] as AquarelleTip;
    expect(entry.id).toBe('wc/custom-88888888');
    expect(entry.asset).toBe(ASSET);
    const builtInIds = BUILTIN_TIPS.map((tip) => tip.id);
    expect(pack.entries.some((raw) => builtInIds.includes((raw as AquarelleTip).id))).toBe(false);
  });

  it('returns null instead of emitting a pack whose entry fails the carrier law', () => {
    // `mask` is the retired inline carrier — refused in the package mode, so
    // the projection refuses rather than writing bytes into the manifest.
    addCustomBrushTip(customTip('wc/custom-99999999', { mask: 'AAAA' } as Partial<AquarelleTip>));
    expect(buildProjectBrushPack()).toBe(null);
  });
});
