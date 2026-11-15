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
 *   5. `applyBrushCatalogPayload` populates a FRESH module instance — the
 *      Studio realm's starting state — and REPLACES rather than appends
 *      (63-05 / D-20): a second payload without a prior id leaves that id
 *      unlisted and its mask unresolvable.
 *
 * Assertion style: scalar predicates (toHaveLength / toBe) so failures stay
 * one-line, matching the 63-01 corpus.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BUILTIN_TIPS,
  TIP_MASK_BYTES,
  buildBrushForStroke,
  resetMaskRegistry,
  resolveMask,
  type AquarelleTip,
} from '@efxlab/efx-watercolor';
import { bytesToBase64 } from '../lib/webpBytes';
import { brushAssetBytes, pendingBrushAssets, resetBrushAssets } from '../lib/efxPaintBrushAssets';
import type { ProjectBrushSet } from '../lib/efxPaintBrushSet';
import type { PhysicPaintBrushCatalogPayload } from '../types/physicPaint';
import {
  addCustomBrushTip,
  applyProjectBrushSet,
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
  resetBrushAssets();
  resetMaskRegistry();
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

describe('aquarelleBrushCatalog — applyProjectBrushSet (63-07 / D-17 / D-20)', () => {
  function projectSet(tip: AquarelleTip, mask: Uint8Array): ProjectBrushSet {
    return {
      entries: [{ tip, digest: DIGEST, mask }],
      masks: [{ id: tip.id, mask }],
      unavailableTipIds: ['wc/custom-unavailable'],
      assets: [{ digest: DIGEST, webp: new Uint8Array([82, 73, 70, 70, 5]) }],
      failures: [],
    };
  }

  it('replaces customs, registry and unavailable set from ONE open and marks its assets written', () => {
    const mask = new Uint8Array(TIP_MASK_BYTES).fill(9);
    const tip = customTip('wc/custom-open');
    addCustomBrushTip(customTip('wc/custom-previous'));

    applyProjectBrushSet(projectSet(tip, mask), '/project/brush-package');

    expect(customBrushTips.value).toHaveLength(1);
    expect(customBrushTips.value[0]!.id).toBe('wc/custom-open');
    expect(listAquarelleBrushTips()).toHaveLength(4);
    expect(resolveCatalogTip('wc/custom-previous')).toBe(null);
    expect(resolveMask(tip.id)).toBe(mask);
    expect(resolveMask('wc/custom-previous')).toBe(null);
    expect(resolveMask('wc/builtin-bristle') === null).toBe(false);
    expect(unavailableTipIds.value.size).toBe(1);
    expect(unavailableTipIds.value.has('wc/custom-unavailable')).toBe(true);
    expect(brushAssetBytes(DIGEST)?.length).toBe(5);
    expect(pendingBrushAssets('/project/brush-package')).toHaveLength(0);
  });

  it('an empty set restores exactly the three built-ins and drops the prior project', () => {
    applyProjectBrushSet(
      projectSet(customTip('wc/custom-open'), new Uint8Array(TIP_MASK_BYTES).fill(9)),
      '/project/brush-package',
    );

    applyProjectBrushSet(
      { entries: [], masks: [], unavailableTipIds: [], assets: [], failures: [] },
      '/project/brush-package',
    );

    expect(listAquarelleBrushTips()).toHaveLength(3);
    expect(resolveMask('wc/custom-open')).toBe(null);
    expect(unavailableTipIds.value.size).toBe(0);
  });

  it('an unavailable custom stays listed yet paints with the neutral round fallback, never a partial mask', () => {
    const healthyMask = new Uint8Array(TIP_MASK_BYTES).fill(3);
    const unavailable = customTip('wc/custom-missing');
    const healthy = customTip('wc/custom-available');

    applyProjectBrushSet(
      {
        entries: [
          { tip: unavailable, digest: null, mask: null },
          { tip: healthy, digest: DIGEST, mask: healthyMask },
        ],
        masks: [{ id: healthy.id, mask: healthyMask }],
        unavailableTipIds: [unavailable.id],
        assets: [],
        failures: [],
      },
      '/project/brush-package',
    );

    // The library greys the unavailable entry — it is listed, not deleted.
    expect(customBrushTips.value.map((tip) => tip.id).join(',')).toBe(
      'wc/custom-missing,wc/custom-available',
    );
    expect(unavailableTipCount.value).toBe(1);
    // Only the healthy tip owns a mask; the other takes the neutral round
    // preset rather than a fabricated or partial mask (D-18).
    expect(resolveMask(unavailable.id)).toBe(null);
    expect(buildBrushForStroke(unavailable.id).id).toBe('round');
    expect(resolveMask(healthy.id)).toBe(healthyMask);
    expect(buildBrushForStroke(healthy.id).id).toBe(healthy.id);
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

/**
 * Minimal well-formed lossless VP8L header declaring the given frame size —
 * the 25 bytes `isTipSizedBrushWebp` reads. Duplicated from the 63-05 bridge
 * suite on purpose: this file pins the STORE half with no bridge import.
 */
function brushWebp(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(25);
  bytes.set([0x52, 0x49, 0x46, 0x46], 0);
  bytes.set([0x57, 0x45, 0x42, 0x50], 8);
  bytes.set([0x56, 0x50, 0x38, 0x4c], 12);
  bytes[16] = 5;
  bytes[20] = 0x2f;
  const w = width - 1;
  const h = height - 1;
  bytes[21] = w & 0xff;
  bytes[22] = ((w >> 8) & 0x3f) | ((h & 0x03) << 6);
  bytes[23] = (h >> 2) & 0xff;
  bytes[24] = (h >> 10) & 0x0f;
  return bytes;
}

describe('aquarelleBrushCatalog — applyBrushCatalogPayload on a FRESH module instance (63-05 / D-20)', () => {
  beforeEach(() => {
    // The Studio webview is a separate JS context whose modules start empty;
    // resetting the registry here is that starting state.
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('populates a fresh instance: catalog, mask, unavailable set and stored WebP', async () => {
    const catalog = await import('./aquarelleBrushCatalog');
    const watercolor = await import('@efxlab/efx-watercolor');
    const assets = await import('../lib/efxPaintBrushAssets');

    const mask = new Uint8Array(TIP_MASK_BYTES).fill(9);
    const webp = brushWebp(192, 192);
    const payload: PhysicPaintBrushCatalogPayload = {
      contextId: 'ctx-63-05-fresh',
      entries: [{
        tip: customTip('wc/custom-fresh-1'),
        maskBase64: bytesToBase64(mask),
        webpBase64: bytesToBase64(webp),
      }],
      unavailableTipIds: ['wc/custom-gone'],
    };

    catalog.applyBrushCatalogPayload(payload);

    expect(catalog.customBrushTips.value).toHaveLength(1);
    expect(catalog.customBrushTips.value[0]?.id).toBe('wc/custom-fresh-1');
    expect(catalog.listAquarelleBrushTips()).toHaveLength(4);
    expect(catalog.resolveCatalogTip('wc/custom-fresh-1')?.id).toBe('wc/custom-fresh-1');

    const resolvedMask = watercolor.resolveMask('wc/custom-fresh-1');
    expect(resolvedMask === null).toBe(false);
    expect(resolvedMask?.length).toBe(TIP_MASK_BYTES);
    expect(resolvedMask).toEqual(mask);
    // The registry replacement carries the built-ins first — a fresh
    // instance still resolves every built-in mask.
    expect(watercolor.resolveMask('wc/builtin-bristle') === null).toBe(false);

    expect([...catalog.unavailableTipIds.value]).toEqual(['wc/custom-gone']);

    const stored = assets.brushAssetBytes(DIGEST);
    expect(stored === undefined).toBe(false);
    expect(stored).toEqual(webp);
  });

  it('replaces rather than appends: a second payload without a prior id leaves it unlisted', async () => {
    const catalog = await import('./aquarelleBrushCatalog');
    const watercolor = await import('@efxlab/efx-watercolor');

    const firstMask = new Uint8Array(TIP_MASK_BYTES).fill(1);
    catalog.applyBrushCatalogPayload({
      contextId: 'ctx-63-05-first',
      entries: [{ tip: customTip('wc/custom-replaced-1'), maskBase64: bytesToBase64(firstMask) }],
      unavailableTipIds: [],
    });
    expect(catalog.customBrushTips.value).toHaveLength(1);
    expect(watercolor.resolveMask('wc/custom-replaced-1') === null).toBe(false);

    const secondMask = new Uint8Array(TIP_MASK_BYTES).fill(2);
    catalog.applyBrushCatalogPayload({
      contextId: 'ctx-63-05-second',
      entries: [{ tip: customTip('wc/custom-replaced-2'), maskBase64: bytesToBase64(secondMask) }],
      unavailableTipIds: [],
    });

    expect(catalog.customBrushTips.value.map((tip) => tip.id)).toEqual(['wc/custom-replaced-2']);
    expect(catalog.resolveCatalogTip('wc/custom-replaced-1')).toBe(null);
    expect(catalog.listAquarelleBrushTips()).toHaveLength(4);
    expect(watercolor.resolveMask('wc/custom-replaced-1')).toBe(null);
    expect(watercolor.resolveMask('wc/custom-replaced-2')).toEqual(secondMask);
  });
});
