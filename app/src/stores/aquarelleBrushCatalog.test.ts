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
import { bytesToBase64, decodeBridgeBase64 } from '../lib/webpBytes';
import { brushAssetBytes, pendingBrushAssets, resetBrushAssets } from '../lib/efxPaintBrushAssets';
import {
  loadProjectBrushSet,
  type ProjectBrushSet,
  type ProjectBrushSetReadPort,
} from '../lib/efxPaintBrushSet';
import {
  isPhysicPaintBrushCatalogPayload,
  type PhysicPaintBrushCatalogPayload,
} from '../types/physicPaint';
import {
  _setBrushCatalogPublisher,
  addCustomBrushTip,
  applyProjectBrushSet,
  brushCatalogGeneration,
  buildBrushCatalogPayload,
  buildProjectBrushPack,
  customBrushTips,
  listAquarelleBrushTips,
  replaceCustomBrushTips,
  replaceUnavailableTipIds,
  resetAquarelleBrushCatalog,
  resetAquarelleBrushState,
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
  _setBrushCatalogPublisher(() => {});
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
  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  it('keeps every valid tip when one entry fails the carrier law, logging the dropped id (WR-07)', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    addCustomBrushTip(customTip('wc/custom-valid'));
    addCustomBrushTip(customTip('wc/custom-invalid', { mask: 'AAAA' } as Partial<AquarelleTip>));

    const pack = buildProjectBrushPack();

    expect(pack === null).toBe(false);
    if (pack === null) return;
    expect(pack.entries).toHaveLength(1);
    expect((pack.entries[0] as AquarelleTip).id).toBe('wc/custom-valid');
    const logged = errorSpy.mock.calls.map((call) => call.map(String).join(' ')).join('\n');
    expect(logged).toContain('wc/custom-invalid');
    expect(logged).toContain('invalid');
  });

  it('keeps the first entry of a duplicate id and logs the duplicate (WR-07)', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    addCustomBrushTip(customTip('wc/custom-dup'));
    addCustomBrushTip(customTip('wc/custom-dup', { name: 'Duplicate' }));

    const pack = buildProjectBrushPack();

    expect(pack === null).toBe(false);
    if (pack === null) return;
    expect(pack.entries).toHaveLength(1);
    expect((pack.entries[0] as AquarelleTip).id).toBe('wc/custom-dup');
    expect((pack.entries[0] as AquarelleTip).name).toBe('Custom wc/custom-dup');
    const logged = errorSpy.mock.calls.map((call) => call.map(String).join(' ')).join('\n');
    expect(logged).toContain('wc/custom-dup');
    expect(logged.toLowerCase()).toContain('duplicate');
  });
});

/**
 * CR-01 / WR-07 regression pins — the open half and the save half agree.
 *
 * The package carrier accepts shapes the cross-realm wire guard refuses (all
 * five categories, unknown extra members). Before 63-10 one such accepted tip
 * refused the Studio snapshot WHOLE. These pins prove the normalization law:
 * the tip the open accepted still reaches the Studio as a `custom` entry, one
 * bad tip costs exactly one tip on save, and a built-in id is refused by name.
 */
describe('aquarelleBrushCatalog — the one project-tip normalization law (CR-01 / TIP-15 / T-63-25)', () => {
  function okPort(asked: string[]): ProjectBrushSetReadPort {
    return async (_packageDir, entries) => {
      asked.push(...entries.map((entry) => entry.id));
      return {
        ok: true,
        data: entries.map((entry) => ({
          id: entry.id,
          ok: true,
          digest: entry.relativePath.slice('brushes/'.length, -'.webp'.length),
          mask: new Uint8Array(TIP_MASK_BYTES).fill(7),
          webp: brushWebp(192, 192),
        })),
      };
    };
  }

  it('normalizes a stray-member tip with a foreign category into a wire-valid custom entry', async () => {
    const raw = { ...customTip('wc/custom-stray', { category: 'texture' }), strayMember: 'left over' };
    const set = await loadProjectBrushSet(
      '/project/pkg',
      { kind: 'efx-watercolor', entries: [raw] },
      okPort([]),
    );
    expect(set.entries).toHaveLength(1);
    applyProjectBrushSet(set, '/project/pkg');

    const payload = buildBrushCatalogPayload('ctx-63-10-stray');

    // No guard relaxation: the payload passes the strict wire law unchanged.
    expect(isPhysicPaintBrushCatalogPayload(payload)).toBe(true);
    expect(payload.entries).toHaveLength(1);
    const entry = payload.entries[0]!;
    expect(entry.tip.id).toBe('wc/custom-stray');
    expect(entry.tip.category).toBe('custom');
    expect(Object.prototype.hasOwnProperty.call(entry.tip, 'strayMember')).toBe(false);
    expect(entry.maskBase64 === undefined).toBe(false);
    expect(decodeBridgeBase64(entry.maskBase64!)).toEqual(new Uint8Array(TIP_MASK_BYTES).fill(7));
  });

  it('pins a foreign-category-only tip to custom so it still reaches the Studio', async () => {
    const raw = customTip('wc/custom-texture', { category: 'texture' });
    const set = await loadProjectBrushSet(
      '/project/pkg',
      { kind: 'efx-watercolor', entries: [raw] },
      okPort([]),
    );
    applyProjectBrushSet(set, '/project/pkg');

    const payload = buildBrushCatalogPayload('ctx-63-10-category');

    expect(isPhysicPaintBrushCatalogPayload(payload)).toBe(true);
    expect(payload.entries.map((entry) => entry.tip.id)).toEqual(['wc/custom-texture']);
    expect(payload.entries[0]!.tip.category).toBe('custom');
    expect(payloadMaskLegsValid(payload)).toBe(true);
  });

  it('refuses a built-in id at the open by name and never re-emits it', async () => {
    const asked: string[] = [];
    const builtinRaw = { ...customTip('wc/builtin-chalk', { category: 'texture' }) };
    const customRaw = customTip('wc/custom-sibling');

    const set = await loadProjectBrushSet(
      '/project/pkg',
      { kind: 'efx-watercolor', entries: [builtinRaw, customRaw] },
      okPort(asked),
    );

    // Refused BEFORE the record is validated: the read port never asks for it
    // and the set never lists or registers it.
    expect(asked.join(',')).toBe('wc/custom-sibling');
    expect(set.entries.map((entry) => entry.tip.id).join(',')).toBe('wc/custom-sibling');
    expect(set.masks.map((mask) => mask.id).join(',')).toBe('wc/custom-sibling');
    expect(set.failures).toContainEqual({ tipId: 'wc/builtin-chalk', reason: 'builtin-id' });

    applyProjectBrushSet(set, '/project/pkg');
    const payload = buildBrushCatalogPayload('ctx-63-10-builtin');

    expect(isPhysicPaintBrushCatalogPayload(payload)).toBe(true);
    expect(payload.entries.map((entry) => entry.tip.id)).toEqual(['wc/custom-sibling']);
    // Each built-in is still listed exactly once, from BUILTIN_TIPS alone.
    expect(listAquarelleBrushTips().map((tip) => tip.id)).toEqual([
      'wc/builtin-bristle',
      'wc/builtin-chalk',
      'wc/builtin-sponge',
      'wc/custom-sibling',
    ]);
    expect(listAquarelleBrushTips().filter((tip) => tip.id === 'wc/builtin-chalk')).toHaveLength(1);
  });
});

/** Every entry of a payload carries a decode-length-valid mask leg. */
function payloadMaskLegsValid(payload: PhysicPaintBrushCatalogPayload): boolean {
  return payload.entries.every(
    (entry) => entry.maskBase64 !== undefined
      && decodeBridgeBase64(entry.maskBase64).length === TIP_MASK_BYTES,
  );
}

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

  // WR-03: an empty `customBrushTips` is ambiguous — a project that imported
  // nothing looks exactly like a realm whose catalog payload never arrived. The
  // flag records the second fact, so the save leg can refuse by name instead of
  // writing a script whose custom masks silently vanished.
  it('records that a catalog payload arrived: false on a fresh instance, true after any payload (WR-03)', async () => {
    const catalog = await import('./aquarelleBrushCatalog');

    expect(catalog.brushCatalogSynced?.value).toBe(false);

    // An EMPTY payload is still a delivered catalog: this realm now knows the
    // project has no imports, which is a known-empty state, not an unknown one.
    catalog.applyBrushCatalogPayload({
      contextId: 'ctx-63-11-synced-empty',
      entries: [],
      unavailableTipIds: [],
    });
    expect(catalog.brushCatalogSynced?.value).toBe(true);
  });

  it('a repeated payload leaves the flag true and bumps no catalog generation for it (WR-03)', async () => {
    const catalog = await import('./aquarelleBrushCatalog');
    catalog.applyBrushCatalogPayload({
      contextId: 'ctx-63-11-repeat-1',
      entries: [],
      unavailableTipIds: [],
    });
    const settledGeneration = catalog.brushCatalogGeneration.value;

    catalog.applyBrushCatalogPayload({
      contextId: 'ctx-63-11-repeat-2',
      entries: [],
      unavailableTipIds: [],
    });

    expect(catalog.brushCatalogSynced?.value).toBe(true);
    expect(catalog.brushCatalogGeneration.value).toBe(settledGeneration);
  });

  it('a catalog reset never clears the flag behind a delivered empty snapshot (WR-03)', async () => {
    const catalog = await import('./aquarelleBrushCatalog');
    catalog.applyBrushCatalogPayload({
      contextId: 'ctx-63-11-reset',
      entries: [],
      unavailableTipIds: [],
    });

    catalog.resetAquarelleBrushCatalog();

    // Clearing the customs is legitimate; forgetting that the catalog was
    // DELIVERED is not — a post-close save still knows the catalog is empty.
    expect(catalog.brushCatalogSynced?.value).toBe(true);
    expect(catalog.customBrushTips.value).toHaveLength(0);
  });
});

describe('aquarelleBrushCatalog — replace on open, reset on close, publish (63-07 / D-20 / TIP-17)', () => {
  it('opening B replaces open A: only B is listed, resolvable and remembered', () => {
    const digestA = 'a'.repeat(64);
    const digestB = 'c'.repeat(64);
    const maskA = new Uint8Array(TIP_MASK_BYTES).fill(1);
    const maskB = new Uint8Array(TIP_MASK_BYTES).fill(2);
    const webpB = new Uint8Array([82, 73, 70, 70, 8]);
    const tipA = customTip('wc/custom-project-a', { asset: `brushes/${digestA}.webp` });
    const tipB = customTip('wc/custom-project-b', { asset: `brushes/${digestB}.webp` });

    applyProjectBrushSet(
      {
        entries: [{ tip: tipA, digest: digestA, mask: maskA }],
        masks: [{ id: tipA.id, mask: maskA }],
        unavailableTipIds: [],
        assets: [{ digest: digestA, webp: new Uint8Array([82, 73, 70, 70, 6]) }],
        failures: [],
      },
      '/project/brush-package',
    );
    applyProjectBrushSet(
      {
        entries: [{ tip: tipB, digest: digestB, mask: maskB }],
        masks: [{ id: tipB.id, mask: maskB }],
        unavailableTipIds: [],
        assets: [{ digest: digestB, webp: webpB }],
        failures: [],
      },
      '/project/brush-package',
    );

    expect(customBrushTips.value.map((tip) => tip.id).join(',')).toBe('wc/custom-project-b');
    expect(listAquarelleBrushTips()).toHaveLength(4);
    expect(resolveCatalogTip(tipA.id)).toBe(null);
    expect(resolveMask(tipA.id)).toBe(null);
    expect(resolveMask(tipB.id)).toBe(maskB);
    expect(brushAssetBytes(digestB)).toEqual(webpB);
    expect(pendingBrushAssets('/project/brush-package')).toHaveLength(0);
  });

  it('close resets to exactly the three built-ins and empties the asset cache', () => {
    const digest = 'd'.repeat(64);
    const mask = new Uint8Array(TIP_MASK_BYTES).fill(3);
    const tip = customTip('wc/custom-open', { asset: `brushes/${digest}.webp` });
    applyProjectBrushSet(
      {
        entries: [
          { tip, digest, mask },
          { tip: customTip('wc/custom-gone'), digest: null, mask: null },
        ],
        masks: [{ id: tip.id, mask }],
        unavailableTipIds: ['wc/custom-gone'],
        assets: [{ digest, webp: new Uint8Array([82, 73, 70, 70, 9]) }],
        failures: [],
      },
      '/project/brush-package',
    );
    expect(brushAssetBytes(digest) === undefined).toBe(false);

    resetAquarelleBrushState();

    expect(customBrushTips.value).toHaveLength(0);
    expect(unavailableTipCount.value).toBe(0);
    expect(listAquarelleBrushTips().map((entry) => entry.id).join(',')).toBe(
      'wc/builtin-bristle,wc/builtin-chalk,wc/builtin-sponge',
    );
    expect(resolveCatalogTip('wc/custom-open')).toBe(null);
    expect(resolveMask('wc/custom-open')).toBe(null);
    expect(resolveMask('wc/custom-gone')).toBe(null);
    expect(resolveMask('wc/builtin-bristle') === null).toBe(false);
    expect(brushAssetBytes(digest)).toBeUndefined();
    expect(pendingBrushAssets('/project/brush-package')).toHaveLength(0);
    // A New Project starts neutral for any former custom id, not blank.
    expect(buildBrushForStroke('wc/custom-open').id).toBe('round');
  });

  it('every apply and every reset publishes exactly one snapshot', () => {
    const published: number[] = [];
    _setBrushCatalogPublisher(() => {
      published.push(published.length + 1);
    });
    const mask = new Uint8Array(TIP_MASK_BYTES).fill(4);
    const tip = customTip('wc/custom-publish');
    const set: ProjectBrushSet = {
      entries: [{ tip, digest: DIGEST, mask }],
      masks: [{ id: tip.id, mask }],
      unavailableTipIds: [],
      assets: [{ digest: DIGEST, webp: new Uint8Array([82, 73, 70, 70, 3]) }],
      failures: [],
    };

    applyProjectBrushSet(set, '/project/brush-package');
    expect(published).toHaveLength(1);

    resetAquarelleBrushState();
    expect(published).toHaveLength(2);

    // A repeated reset publishes too: every close is a lifecycle event the
    // Studio mirrors, even when the state was already empty.
    resetAquarelleBrushState();
    expect(published).toHaveLength(3);
  });

  it('a script mask is registry-only and never survives a project reset', async () => {
    // Dynamic import: the module-cache instance is the one the static imports
    // above use (this describe never calls vi.resetModules), so the registry
    // checks read the same graph the function writes.
    const catalog = await import('./aquarelleBrushCatalog');
    const watercolor = await import('@efxlab/efx-watercolor');
    expect(catalog.registerScriptMask, 'catalog must export registerScriptMask').toBeTypeOf('function');
    const mask = new Uint8Array(watercolor.TIP_MASK_BYTES).fill(8);

    expect(catalog.registerScriptMask('wc/custom-script', mask)).toBe(true);
    // The registry paints it, but the project catalog never learns the tip.
    expect(watercolor.resolveMask('wc/custom-script')).toBe(mask);
    expect(watercolor.buildBrushForStroke('wc/custom-script').id).toBe('wc/custom-script');
    expect(catalog.customBrushTips.value).toHaveLength(0);
    expect(catalog.listAquarelleBrushTips()).toHaveLength(3);
    expect(catalog.resolveCatalogTip('wc/custom-script')).toBe(null);
    expect(catalog.unavailableTipIds.value.size).toBe(0);

    // Fail-closed on a wrong-length mask: refused, never stored.
    expect(catalog.registerScriptMask('wc/custom-script-bad', new Uint8Array(5))).toBe(false);
    expect(watercolor.resolveMask('wc/custom-script-bad')).toBe(null);

    // T-63-23: a close / New Project clears every session mask.
    catalog.resetAquarelleBrushState();
    expect(watercolor.resolveMask('wc/custom-script')).toBe(null);
  });

  it('the published payload carries each custom tip mask and its stored WebP bytes', () => {
    const digest = 'e'.repeat(64);
    const mask = new Uint8Array(TIP_MASK_BYTES).fill(5);
    const webp = new Uint8Array([82, 73, 70, 70, 11, 12]);
    const tip = customTip('wc/custom-payload', { asset: `brushes/${digest}.webp` });
    const gone = customTip('wc/custom-payload-gone', { asset: `brushes/${'f'.repeat(64)}.webp` });

    applyProjectBrushSet(
      {
        entries: [
          { tip, digest, mask },
          { tip: gone, digest: null, mask: null },
        ],
        masks: [{ id: tip.id, mask }],
        unavailableTipIds: [gone.id],
        assets: [{ digest, webp }],
        failures: [],
      },
      '/project/brush-package',
    );

    const payload = buildBrushCatalogPayload('ctx-63-07-payload');

    expect(payload.contextId).toBe('ctx-63-07-payload');
    expect(payload.entries).toHaveLength(2);
    expect(payload.entries[0]!.tip.id).toBe('wc/custom-payload');
    expect(payload.entries[0]!.maskBase64 === undefined).toBe(false);
    expect(decodeBridgeBase64(payload.entries[0]!.maskBase64!)).toEqual(mask);
    expect(payload.entries[0]!.webpBase64 === undefined).toBe(false);
    expect(decodeBridgeBase64(payload.entries[0]!.webpBase64!)).toEqual(webp);
    // An unavailable tip travels with neither leg — only its id.
    expect(payload.entries[1]!.maskBase64).toBeUndefined();
    expect(payload.entries[1]!.webpBase64).toBeUndefined();
    expect(payload.unavailableTipIds.join(',')).toBe('wc/custom-payload-gone');
  });
});
