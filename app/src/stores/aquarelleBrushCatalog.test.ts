/**
 * quick 261116-inu (supersedes 63-04's project-scoped pins) — the
 * MACHINE-scoped brush catalog standing pins.
 *
 * Laws pinned here:
 *   1. There are no compile-time built-ins (quick 261116-inu): a fresh catalog
 *      lists nothing, and only machine-library rows ever appear.
 *   2. `replaceUnavailableTipIds` REPLACES the whole set — `[]` clears it and
 *      a second call never appends to the first (D-20).
 *   3. `replaceLibraryEntries` is replace-only and compare-then-write: a real
 *      replacement bumps `libraryRevision` and `brushCatalogGeneration` once;
 *      an identical replacement writes nothing.
 *   4. The machine library survives a project close: rows, masks and
 *      `libraryRevision` are untouched by `closeProject` (spec 04).
 *   5. `buildBrushCatalogPayload(libraryRevision)` reads the LIBRARY ROWS and
 *      stamps the revision; `applyBrushCatalogPayload` replaces this realm's
 *      rows, masks and unavailable set and adopts the payload's revision.
 *
 * The project-scoped carrier blocks (63-04) are gone with the modules that
 * carried them (quick 261116-inu / Task 4).
 *
 * Assertion style: scalar predicates (toHaveLength / toBe) so failures stay
 * one-line, matching the 63-01 corpus.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  TIP_MASK_BYTES,
  TIP_MASK_EDGE,
  buildBrushForStroke,
  registerMask,
  resetMaskRegistry,
  resolveMask,
  type AquarelleTip,
} from '@efxlab/efx-watercolor';
import { bytesToBase64, decodeBridgeBase64 } from '../lib/webpBytes';
import {
  isPhysicPaintBrushCatalogPayload,
  type PhysicPaintBrushCatalogPayload,
} from '../types/physicPaint';
import {
  _setBrushCatalogPublisher,
  addCustomBrushTip,
  brushCatalogGeneration,
  buildBrushCatalogPayload,
  customBrushTips,
  libraryRevision,
  libraryRows,
  listAquarelleBrushTips,
  publishBrushCatalog,
  replaceCustomBrushTips,
  replaceLibraryEntries,
  replaceUnavailableTipIds,
  resetAquarelleBrushCatalog,
  resolveCatalogTip,
  unavailableTipCount,
  unavailableTipIds,
} from './aquarelleBrushCatalog';

const DIGEST = 'b'.repeat(64);

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
    ...extra,
  };
}

afterEach(() => {
  _setBrushCatalogPublisher(() => {});
  resetAquarelleBrushCatalog();
  resetMaskRegistry();
});

describe('aquarelleBrushCatalog — empty machine-library baseline (quick 261116-inu)', () => {
  it('a fresh catalog lists nothing: there are no compile-time built-ins', () => {
    expect(listAquarelleBrushTips()).toHaveLength(0);
  });

  it('returns null for any id no library row carries', () => {
    // Nothing seeds the catalog: every unlisted id resolves the same way.
    expect(resolveCatalogTip('wc/custom-missing')).toBe(null);
    expect(resolveCatalogTip('wc/unknown-missing')).toBe(null);
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
    expect(listAquarelleBrushTips()).toHaveLength(1);
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
    expect(listAquarelleBrushTips()).toHaveLength(0);
    // A second reset has nothing left to clear.
    resetAquarelleBrushCatalog();
    expect(brushCatalogGeneration.value).toBe(before + 1);
  });
});

describe('aquarelleBrushCatalog — an unavailable library row (spec 04 / Work 3)', () => {
  it('stays listed yet paints with the response tip, never a partial mask', () => {
    const healthyMask = new Uint8Array(TIP_MASK_BYTES).fill(3);
    const unavailable = customTip('wc/custom-missing');
    const healthy = customTip('wc/custom-available');

    registerMask(healthy.id, healthyMask);
    replaceLibraryEntries(
      [
        { tip: unavailable, digest: DIGEST, textureRotation: 0 },
        { tip: healthy, digest: 'c'.repeat(64), textureRotation: 0 },
      ],
      [unavailable.id],
    );

    // The library greys the unavailable entry — it is listed, not deleted.
    expect(customBrushTips.value.map((tip) => tip.id).join(',')).toBe(
      'wc/custom-missing,wc/custom-available',
    );
    expect(unavailableTipCount.value).toBe(1);
    // Only the healthy tip owns a mask; the other takes the response tip
    // rather than a fabricated or partial mask (D-18).
    expect(resolveMask(unavailable.id)).toBe(null);
    // quick-261115-oh9: a catalog tip is a TEXTURE. It never displaces the
    // response — an unavailable texture falls back to the response tip, and a
    // healthy one stamps through the same (response, texture) pair.
    expect(buildBrushForStroke('round').id).toBe('round');
    expect(buildBrushForStroke(healthy.id).id).toBe('round');
    expect(resolveMask(healthy.id)).toBe(healthyMask);
    const healthyBrush = buildBrushForStroke('round', { textureId: healthy.id });
    // A library texture is TIP_MASK_EDGE square (262,144 bytes) — the tip size
    // is derived from the mask, never from the procedural TIP_SIZE (192).
    expect(healthyBrush.tipSize).toBe(TIP_MASK_EDGE);
    expect(healthyBrush.tipData.every((value, index) => value === healthyMask[index])).toBe(true);
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

/**
 * CR-01 / TIP-15 regression pin — the wire projection is the normalizing seam.
 *
 * The machine library's rows are the payload's one source (Task 2). A row
 * whose tip carries stray members and a foreign category must still reach the
 * Studio as a strict wire-valid `custom` entry: one bad shape never refuses
 * the Studio snapshot WHOLE.
 */
describe('aquarelleBrushCatalog — the wire projection of a library row (CR-01 / TIP-15)', () => {
  it('normalizes a stray-member, foreign-category row into a wire-valid custom entry', () => {
    const raw = {
      ...customTip('wc/custom-0123456789ab', { category: 'texture' }),
      strayMember: 'left over',
    } as AquarelleTip;
    const mask = new Uint8Array(TIP_MASK_BYTES).fill(7);
    registerMask(raw.id, mask);
    replaceLibraryEntries([{ tip: raw, digest: DIGEST, textureRotation: 0 }]);

    const payload = buildBrushCatalogPayload(5);

    // No guard relaxation: the payload passes the strict wire law unchanged.
    expect(isPhysicPaintBrushCatalogPayload(payload)).toBe(true);
    expect(payload.libraryRevision).toBe(5);
    expect(payload.entries).toHaveLength(1);
    const entry = payload.entries[0]!;
    expect(entry.tip.id).toBe('wc/custom-0123456789ab');
    expect(entry.tip.category).toBe('custom');
    expect(Object.prototype.hasOwnProperty.call(entry.tip, 'strayMember')).toBe(false);
    expect(entry.digest).toBe(DIGEST);
    expect(entry.textureRotation).toBe(0);
    expect(entry.maskBase64 === undefined).toBe(false);
    expect(decodeBridgeBase64(entry.maskBase64!)).toEqual(mask);
    // A machine-library id is an ordinary row (no reserved ids).
    expect(listAquarelleBrushTips().map((tip) => tip.id)).toEqual(['wc/custom-0123456789ab']);
  });
});

// quick 261127-uxj: the bundled Wootha tips are APP ASSETS this realm loads
// at boot. A catalog payload replaces the mask registry, so the application
// path must union them back in — a Studio layer switch must never blank the
// default textures.
describe('aquarelleBrushCatalog — bundled app assets survive a payload (quick 261127-uxj)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('a payload application keeps the bundled masks registered, and still replaces user masks', async () => {
    const catalog = await import('./aquarelleBrushCatalog');
    const builtin = await import('./builtinBrushTips');
    const watercolor = await import('@efxlab/efx-watercolor');

    // Every bundled file answers one valid 262,144-byte mask.
    const loaded = await builtin.loadBuiltinBrushTips(
      async () => new Uint8Array(TIP_MASK_BYTES).fill(3),
    );
    expect(loaded.loaded).toBe(22);
    const loadedBundled = watercolor.resolveMask('wc/default-wootha-002');
    expect(loadedBundled === null, 'the bundled mask registered at boot').toBe(false);

    const userMask = new Uint8Array(TIP_MASK_BYTES).fill(9);
    catalog.applyBrushCatalogPayload({
      libraryRevision: 3,
      entries: [{
        tip: customTip('wc/custom-payload-bundled'),
        digest: DIGEST,
        textureRotation: 0,
        maskBase64: bytesToBase64(userMask),
      }],
      unavailableTipIds: [],
    });

    // The payload's own mask resolves…
    expect(watercolor.resolveMask('wc/custom-payload-bundled')).toEqual(userMask);
    // …and the bundled masks survive the replacement by IDENTITY.
    expect(watercolor.resolveMask('wc/default-wootha-002')).toBe(loadedBundled);
    expect(watercolor.resolveMask('wc/default-wootha-charcoal-023') === null).toBe(false);
    expect(catalog.customBrushTips.value.map((tip) => tip.id)).toEqual([
      'wc/custom-payload-bundled',
    ]);

    // Replace-not-append still holds for user ids: a second payload without
    // the first id leaves it unresolvable — while the bundled masks stay.
    catalog.applyBrushCatalogPayload({
      libraryRevision: 4,
      entries: [],
      unavailableTipIds: [],
    });
    expect(watercolor.resolveMask('wc/custom-payload-bundled')).toBe(null);
    expect(watercolor.resolveMask('wc/default-wootha-002')).toBe(loadedBundled);
  });
});

describe('aquarelleBrushCatalog — applyBrushCatalogPayload on a FRESH module instance (63-05 / D-20)', () => {
  beforeEach(() => {
    // The Studio webview is a separate JS context whose modules start empty;
    // resetting the registry here is that starting state.
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('populates a fresh instance: catalog, mask and unavailable set', async () => {
    const catalog = await import('./aquarelleBrushCatalog');
    const watercolor = await import('@efxlab/efx-watercolor');

    const mask = new Uint8Array(TIP_MASK_BYTES).fill(9);
    const payload: PhysicPaintBrushCatalogPayload = {
      libraryRevision: 2,
      entries: [{
        tip: customTip('wc/custom-fresh-1'),
        digest: DIGEST,
        textureRotation: 37,
        maskBase64: bytesToBase64(mask),
      }],
      unavailableTipIds: ['wc/custom-gone'],
    };

    catalog.applyBrushCatalogPayload(payload);

    expect(catalog.libraryRows.value).toHaveLength(1);
    expect(catalog.libraryRows.value[0]).toMatchObject({ digest: DIGEST, textureRotation: 37 });
    expect(catalog.libraryRevision.value).toBe(2);
    expect(catalog.customBrushTips.value).toHaveLength(1);
    expect(catalog.customBrushTips.value[0]?.id).toBe('wc/custom-fresh-1');
    expect(catalog.listAquarelleBrushTips()).toHaveLength(1);
    expect(catalog.resolveCatalogTip('wc/custom-fresh-1')?.id).toBe('wc/custom-fresh-1');

    const resolvedMask = watercolor.resolveMask('wc/custom-fresh-1');
    expect(resolvedMask === null).toBe(false);
    expect(resolvedMask?.length).toBe(TIP_MASK_BYTES);
    expect(resolvedMask).toEqual(mask);
    // quick 261116-inu: the payload installs its own rows and nothing else —
    // no other id's mask survives a fresh instance.
    expect(watercolor.resolveMask('wc/unknown-missing')).toBe(null);

    // The payload carries masks only — no WebP bytes leg exists any more
    // (quick 261116-inu / Task 4): the machine library owns the files.
    expect([...catalog.unavailableTipIds.value]).toEqual(['wc/custom-gone']);
  });

  it('replaces rather than appends: a second payload without a prior id leaves it unlisted', async () => {
    const catalog = await import('./aquarelleBrushCatalog');
    const watercolor = await import('@efxlab/efx-watercolor');

    const firstMask = new Uint8Array(TIP_MASK_BYTES).fill(1);
    catalog.applyBrushCatalogPayload({
      libraryRevision: 1,
      entries: [{
        tip: customTip('wc/custom-replaced-1'),
        digest: 'a'.repeat(64),
        textureRotation: 0,
        maskBase64: bytesToBase64(firstMask),
      }],
      unavailableTipIds: [],
    });
    expect(catalog.customBrushTips.value).toHaveLength(1);
    expect(watercolor.resolveMask('wc/custom-replaced-1') === null).toBe(false);

    const secondMask = new Uint8Array(TIP_MASK_BYTES).fill(2);
    catalog.applyBrushCatalogPayload({
      libraryRevision: 2,
      entries: [{
        tip: customTip('wc/custom-replaced-2'),
        digest: 'b'.repeat(64),
        textureRotation: -120,
        maskBase64: bytesToBase64(secondMask),
      }],
      unavailableTipIds: [],
    });

    expect(catalog.customBrushTips.value.map((tip) => tip.id)).toEqual(['wc/custom-replaced-2']);
    expect(catalog.resolveCatalogTip('wc/custom-replaced-1')).toBe(null);
    expect(catalog.listAquarelleBrushTips()).toHaveLength(1);
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
      libraryRevision: 0,
      entries: [],
      unavailableTipIds: [],
    });
    expect(catalog.brushCatalogSynced?.value).toBe(true);
  });

  it('a repeated payload leaves the flag true and bumps no catalog generation for it (WR-03)', async () => {
    const catalog = await import('./aquarelleBrushCatalog');
    catalog.applyBrushCatalogPayload({
      libraryRevision: 0,
      entries: [],
      unavailableTipIds: [],
    });
    const settledGeneration = catalog.brushCatalogGeneration.value;

    catalog.applyBrushCatalogPayload({
      libraryRevision: 0,
      entries: [],
      unavailableTipIds: [],
    });

    expect(catalog.brushCatalogSynced?.value).toBe(true);
    expect(catalog.brushCatalogGeneration.value).toBe(settledGeneration);
  });

  it('a catalog reset never clears the flag behind a delivered empty snapshot (WR-03)', async () => {
    const catalog = await import('./aquarelleBrushCatalog');
    catalog.applyBrushCatalogPayload({
      libraryRevision: 0,
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

describe('aquarelleBrushCatalog — the machine library lifecycle (quick 261116-inu / spec 04)', () => {
  it('a second library replacement replaces the first: only the new row is listed', () => {
    const digestA = 'a'.repeat(64);
    const digestB = 'c'.repeat(64);
    const tipA = customTip('wc/custom-library-a');
    const tipB = customTip('wc/custom-library-b');

    replaceLibraryEntries([{ tip: tipA, digest: digestA, textureRotation: 0 }]);
    replaceLibraryEntries([{ tip: tipB, digest: digestB, textureRotation: 37 }]);

    expect(customBrushTips.value.map((tip) => tip.id).join(',')).toBe('wc/custom-library-b');
    expect(listAquarelleBrushTips()).toHaveLength(1);
    expect(resolveCatalogTip(tipA.id)).toBe(null);
    expect(resolveMask(tipA.id)).toBe(null);
    expect(resolveMask(tipB.id)).toBe(null);
    expect(libraryRows.value.map((row) => row.digest).join(',')).toBe(digestB);
  });

  /**
   * Run the production project-close leg that used to clear the catalog, in
   * the SAME fresh module graph as the catalog these tests inspect (the
   * preceding describe resets the registry, so a dynamic import here builds a
   * new graph and every dynamic import below shares it).
   */
  async function closeProjectNow(): Promise<void> {
    const { projectStore } = await import('./projectStore');
    projectStore.closeProject();
  }

  it('a project close leaves every library row, its mask and the revision intact', async () => {
    const catalog = await import('./aquarelleBrushCatalog');
    const watercolor = await import('@efxlab/efx-watercolor');
    // A fresh graph starts unseeded, but a sibling dynamic test's rows persist
    // across `it` bodies — the file-level afterEach resets the STATIC graph.
    catalog.resetAquarelleBrushCatalog();
    const digest = 'd'.repeat(64);
    const mask = new Uint8Array(watercolor.TIP_MASK_BYTES).fill(3);
    const tip = customTip('wc/custom-machine');
    watercolor.registerMask(tip.id, mask);
    catalog.replaceLibraryEntries([{ tip, digest, textureRotation: 37 }], ['wc/custom-gone']);
    const revision = catalog.libraryRevision.value;
    const rows = catalog.libraryRows.value;

    await closeProjectNow();

    // Machine-scope law (spec 04): a close is not a library event — the rows,
    // the mask registry, the unavailable set and the revision all survive.
    expect(catalog.libraryRows.value).toBe(rows);
    expect(catalog.customBrushTips.value.map((entry) => entry.id)).toEqual([tip.id]);
    expect(catalog.libraryRevision.value).toBe(revision);
    expect(catalog.unavailableTipIds.value.has('wc/custom-gone')).toBe(true);
    expect(watercolor.resolveMask(tip.id)).toBe(mask);
    expect(catalog.listAquarelleBrushTips().map((entry) => entry.id).join(',')).toBe(
      'wc/custom-machine',
    );
  });

  it('a library replacement never publishes by itself; the boot orchestration publishes once', () => {
    const published: number[] = [];
    _setBrushCatalogPublisher(() => {
      published.push(published.length + 1);
    });

    // The machine library's replacement writer is silent: the boot
    // orchestration publishes AFTER it, and only for a REAL change.
    const revision = libraryRevision.value;
    const row = { tip: customTip('wc/custom-row'), digest: DIGEST, textureRotation: 0 };
    replaceLibraryEntries([row]);
    expect(published).toHaveLength(0);
    expect(libraryRevision.value).toBe(revision + 1);
    replaceLibraryEntries([{ tip: row.tip, digest: row.digest, textureRotation: row.textureRotation }]);
    expect(published).toHaveLength(0);
    expect(libraryRevision.value).toBe(revision + 1);

    publishBrushCatalog();
    expect(published).toHaveLength(1);
  });

  it('a script mask is registry-only and survives a project close', async () => {
    const catalog = await import('./aquarelleBrushCatalog');
    const watercolor = await import('@efxlab/efx-watercolor');
    // Same-graph hygiene as the close test above (the static afterEach cannot
    // reach this graph).
    catalog.resetAquarelleBrushCatalog();
    expect(catalog.registerScriptMask, 'catalog must export registerScriptMask').toBeTypeOf('function');
    const mask = new Uint8Array(watercolor.TIP_MASK_BYTES).fill(8);

    expect(catalog.registerScriptMask('wc/custom-script', mask)).toBe(true);
    // The registry paints it, but the project catalog never learns the tip.
    expect(watercolor.resolveMask('wc/custom-script')).toBe(mask);
    // The script mask stamps as a TEXTURE through the response law — the
    // response id never becomes the mask id.
    expect(watercolor.buildBrushForStroke('wc/custom-script').id).toBe('round');
    expect(
      watercolor
        .buildBrushForStroke('round', { textureId: 'wc/custom-script' })
        .tipData.every((value, index) => value === mask[index]),
    ).toBe(true);
    expect(catalog.customBrushTips.value).toHaveLength(0);
    expect(catalog.listAquarelleBrushTips()).toHaveLength(0);
    expect(catalog.resolveCatalogTip('wc/custom-script')).toBe(null);
    expect(catalog.unavailableTipIds.value.size).toBe(0);

    // Fail-closed on a wrong-length mask: refused, never stored.
    expect(catalog.registerScriptMask('wc/custom-script-bad', new Uint8Array(5))).toBe(false);
    expect(watercolor.resolveMask('wc/custom-script-bad')).toBe(null);

    // quick 261116-inu: a project close no longer clears the registry — the
    // script's mask stays resolvable until a real library replacement swaps
    // the registry as a whole.
    await closeProjectNow();
    expect(watercolor.resolveMask('wc/custom-script')).toBe(mask);
  });

  it('the published payload carries the library revision and each row its digest, rotation and mask', () => {
    const digest = 'e'.repeat(64);
    const mask = new Uint8Array(TIP_MASK_BYTES).fill(5);
    const tip = customTip('wc/custom-payload');
    const gone = customTip('wc/custom-payload-gone');

    // Library rows are the payload's ONE source (Task 2); the mask registry
    // supplies the one bytes leg. The machine library owns the WebP files, so
    // the payload carries no stored-WebP leg at all (Task 4).
    registerMask(tip.id, mask);
    replaceLibraryEntries(
      [
        { tip, digest, textureRotation: 37 },
        { tip: gone, digest: 'f'.repeat(64), textureRotation: -90 },
      ],
      [gone.id],
    );

    const payload = buildBrushCatalogPayload(9);

    expect(payload.libraryRevision).toBe(9);
    expect(payload.entries).toHaveLength(2);
    expect(payload.entries[0]).toMatchObject({ digest, textureRotation: 37 });
    expect(payload.entries[0]!.tip.id).toBe('wc/custom-payload');
    expect(payload.entries[0]!.maskBase64 === undefined).toBe(false);
    expect(decodeBridgeBase64(payload.entries[0]!.maskBase64!)).toEqual(mask);
    expect(Object.prototype.hasOwnProperty.call(payload.entries[0], 'webpBase64')).toBe(false);
    // An unavailable tip travels with no mask leg — only its id.
    expect(payload.entries[1]!.maskBase64).toBeUndefined();
    expect(payload.unavailableTipIds.join(',')).toBe('wc/custom-payload-gone');
  });
});
