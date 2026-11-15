/**
 * 63-07 Task 1 — the project-open brush-set loader.
 *
 * Laws pinned here:
 *   1. The whole set is read with ONE native call, whatever its size, and each
 *      healthy tip is paired with its decoded 36,864-byte mask.
 *   2. The set is applied AFTER the close/reset and BEFORE hydrate — the
 *      source-order pin fails if registration moves after hydrate (TIP-12).
 *   3. A project with no `brushPack` asks the native boundary for nothing.
 *   4. A refused batch and a failed entry degrade their tips instead of
 *      throwing (D-18) — the open always proceeds.
 *
 * Assertion style: scalar predicates (lengths, joins, booleans) so failures
 * stay one-line, matching the 63-01/63-06 corpus.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { TIP_MASK_BYTES, type AquarelleTip } from '@efxlab/efx-watercolor';
import type { EfxPaintBrushAssetReadEntry } from './ipc';
import { loadProjectBrushSet, type ProjectBrushSetReadPort } from './efxPaintBrushSet';

const DIGEST_A = 'a'.repeat(64);
const DIGEST_B = 'b'.repeat(64);

function customTip(id: string, digest: string): AquarelleTip {
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
    asset: `brushes/${digest}.webp`,
  };
}

function mask(): Uint8Array {
  return new Uint8Array(TIP_MASK_BYTES).fill(7);
}

function webp(): Uint8Array {
  return new Uint8Array([82, 73, 70, 70, 9, 9, 9, 9]);
}

function snapshot(entries: unknown[]): { kind: string; entries: unknown[] } {
  return { kind: 'efx-watercolor', entries };
}

function digestOf(relativePath: string): string {
  return relativePath.slice('brushes/'.length, -'.webp'.length);
}

describe('loadProjectBrushSet — one native read, decoded before hydrate (63-07)', () => {
  it('reads the whole set with exactly one call and pairs each tip with its mask', async () => {
    const calls: { packageDir: string; entries: readonly { id: string; relativePath: string }[] }[] = [];
    const port: ProjectBrushSetReadPort = async (packageDir, entries) => {
      calls.push({ packageDir, entries });
      return {
        ok: true,
        data: entries.map((entry): EfxPaintBrushAssetReadEntry => ({
          id: entry.id,
          ok: true,
          digest: digestOf(entry.relativePath),
          mask: mask(),
          webp: webp(),
        })),
      };
    };

    const result = await loadProjectBrushSet(
      '/project/pkg',
      snapshot([customTip('wc/custom-a', DIGEST_A), customTip('wc/custom-b', DIGEST_B)]),
      port,
    );

    expect(calls).toHaveLength(1);
    expect(calls[0]!.packageDir).toBe('/project/pkg');
    expect(calls[0]!.entries).toHaveLength(2);
    expect(calls[0]!.entries.map((entry) => entry.id).join(',')).toBe('wc/custom-a,wc/custom-b');
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0]!.tip.id).toBe('wc/custom-a');
    expect(result.entries[0]!.digest).toBe(DIGEST_A);
    expect(result.entries[0]!.mask.length).toBe(TIP_MASK_BYTES);
    expect(result.masks).toHaveLength(2);
    expect(result.assets).toHaveLength(2);
    expect(result.assets[1]!.digest).toBe(DIGEST_B);
    expect(result.unavailableTipIds).toHaveLength(0);
    expect(result.failures).toHaveLength(0);
  });

  it('an absent brushPack asks the native boundary for nothing', async () => {
    const port = vi.fn<ProjectBrushSetReadPort>();

    const result = await loadProjectBrushSet('/project/pkg', undefined, port);

    expect(port).not.toHaveBeenCalled();
    expect(result.entries).toHaveLength(0);
    expect(result.masks).toHaveLength(0);
    expect(result.unavailableTipIds).toHaveLength(0);
    expect(result.assets).toHaveLength(0);
    expect(result.failures).toHaveLength(0);
  });

  it('a refused batch degrades every requested tip instead of throwing', async () => {
    const port: ProjectBrushSetReadPort = async () => ({ ok: false, error: { kind: 'missing' } });

    const result = await loadProjectBrushSet(
      '/project/pkg',
      snapshot([customTip('wc/custom-a', DIGEST_A), customTip('wc/custom-b', DIGEST_B)]),
      port,
    );

    expect(result.entries).toHaveLength(0);
    expect(result.unavailableTipIds.join(',')).toBe('wc/custom-a,wc/custom-b');
    expect(result.failures).toHaveLength(2);
    expect(result.failures[0]!.reason).toBe('batch-failed');
  });

  it('one failed entry degrades alone: its healthy sibling still registers', async () => {
    const port: ProjectBrushSetReadPort = async (_packageDir, entries) => ({
      ok: true,
      data: entries.map((entry): EfxPaintBrushAssetReadEntry =>
        entry.id === 'wc/custom-a'
          ? { id: entry.id, ok: false, reason: 'wrong-size' }
          : {
              id: entry.id,
              ok: true,
              digest: digestOf(entry.relativePath),
              mask: mask(),
              webp: webp(),
            },
      ),
    });

    const result = await loadProjectBrushSet(
      '/project/pkg',
      snapshot([customTip('wc/custom-a', DIGEST_A), customTip('wc/custom-b', DIGEST_B)]),
      port,
    );

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]!.tip.id).toBe('wc/custom-b');
    expect(result.unavailableTipIds.join(',')).toBe('wc/custom-a');
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]!.tipId).toBe('wc/custom-a');
    expect(result.failures[0]!.reason).toBe('wrong-size');
  });

  it('a digest that disagrees with its asset ref never becomes a live mask', async () => {
    const port: ProjectBrushSetReadPort = async (_packageDir, entries) => ({
      ok: true,
      data: entries.map((entry): EfxPaintBrushAssetReadEntry => ({
        id: entry.id,
        ok: true,
        digest: DIGEST_B,
        mask: mask(),
        webp: webp(),
      })),
    });

    const result = await loadProjectBrushSet(
      '/project/pkg',
      snapshot([customTip('wc/custom-a', DIGEST_A)]),
      port,
    );

    expect(result.entries).toHaveLength(0);
    expect(result.unavailableTipIds.join(',')).toBe('wc/custom-a');
    expect(result.failures[0]!.reason).toBe('digest-mismatch');
  });

  it('applies the set after the close/reset and before hydrate (source-order pin)', () => {
    const source = readFileSync(
      fileURLToPath(new URL('../stores/projectStore.ts', import.meta.url)),
      'utf8',
    );
    const openStart = source.indexOf('async openProject(openFilePath: string)');
    const openEnd = source.indexOf('/** Close the current project and reset all stores */');
    expect(openStart).toBeGreaterThanOrEqual(0);
    expect(openEnd).toBeGreaterThan(openStart);
    const body = source.slice(openStart, openEnd);
    const loadAt = body.indexOf('loadProjectBrushSet(');
    const closeAt = body.indexOf('projectStore.closeProject(');
    const applyAt = body.indexOf('applyProjectBrushSet(');
    const hydrateAt = body.indexOf('hydrateFromMce(');
    expect(loadAt).toBeGreaterThanOrEqual(0);
    expect(closeAt).toBeGreaterThanOrEqual(0);
    expect(applyAt).toBeGreaterThanOrEqual(0);
    expect(hydrateAt).toBeGreaterThanOrEqual(0);
    expect(loadAt < closeAt).toBe(true);
    expect(closeAt < applyAt).toBe(true);
    expect(applyAt < hydrateAt).toBe(true);
  });
});
