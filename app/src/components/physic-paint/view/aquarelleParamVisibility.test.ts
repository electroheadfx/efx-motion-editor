/**
 * quick 261121-mtu — the Paint panel's visibility law (Matrix 2).
 *
 * Laws pinned here:
 *   the visible rows are a function of (active tool, active medium), never
 *     of the tool alone — the full matrix is pinned per context in order
 *   a null medium resolves to DEFAULT_MEDIUM_ID (a fresh session)
 *   empty groups are dropped; the six group ids keep their fixed order
 *   the Eraser context renders the Lift row alone
 *   Refill (decision B): ABSENT for acrylic (record fixes 0) and for
 *     watercolor (the engine reads refill only in the bristle carrier);
 *     PRESENT for gouache / chalk(pastel) / graphite — the DEFERRED item,
 *     whose records keep 60
 *   `body` and `wetSeconds` never have a row; Emboss keeps the 15 cap
 *   the module is pure data: no Preact, no signals, no DOM
 *
 * Assertion style: scalar predicates (joined key lists) so TAP diagnostics
 * stay one-line.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_MEDIUM_ID } from '@efxlab/efx-watercolor';
import type { AquarelleTool } from '@efxlab/efx-watercolor/payload';
import {
  AQUARELLE_PARAM_GROUPS,
  AQUARELLE_PARAM_ROWS,
  visibleAquarelleParamGroups,
  visibleAquarelleParamRows,
  type AquarelleParamRow,
} from './aquarelleParamVisibility';

const PAINT_TOOLS: readonly AquarelleTool[] = ['brush', 'watercolor', 'pen'];
/** The five medium ids in the engine's fixed order. */
const MEDIA = ['watercolor', 'gouache', 'pastel', 'graphite', 'acrylic'] as const;

const P_A = 'viscosity|emboss|load|pickup|water|dry|feather';
// rev 3: Pickup joins Refill as bristle-only — `uPickupRate` (carrier) and
// `uSmear` (gather) are the only bindings, so the fluid row is dead and the
// watercolor context hides it.
const P_W = 'viscosity|emboss|load|water|dry|flow|bleed|edge|granulation';
const P_D = 'viscosity|emboss|load|pickup|refill|water|dry|feather';
const W_KEYS = 'viscosity|dry|flow|bleed|edge|granulation';
const L_KEYS = 'lift';

function keys(rows: readonly AquarelleParamRow[]): string {
  return rows.map((row) => row.key).join('|');
}

function expectedKeys(tool: AquarelleTool, medium: (typeof MEDIA)[number]): string {
  if (tool === 'lift') return L_KEYS;
  if (tool === 'water') return W_KEYS;
  if (medium === 'acrylic') return P_A;
  if (medium === 'watercolor') return P_W;
  return P_D;
}

describe('Matrix 2 — the row set per (tool, medium) context', () => {
  it('pins every paint tool crossed with every medium (P-A / P-W / P-D)', () => {
    for (const tool of PAINT_TOOLS) {
      for (const medium of MEDIA) {
        expect(keys(visibleAquarelleParamRows(tool, medium)), `${tool} + ${medium}`).toBe(
          expectedKeys(tool, medium),
        );
      }
    }
  });

  it('pins the Water tool as medium-independent (W)', () => {
    for (const medium of MEDIA) {
      expect(keys(visibleAquarelleParamRows('water', medium)), `water + ${medium}`).toBe(W_KEYS);
    }
  });

  it('pins the Eraser as the Lift row alone (L)', () => {
    for (const medium of MEDIA) {
      const rows = visibleAquarelleParamRows('lift', medium);
      expect(keys(rows), `lift + ${medium}`).toBe(L_KEYS);
      expect(rows, 'the Eraser context is exactly one row').toHaveLength(1);
      expect(rows[0]!.key, 'and that row is Lift').toBe('lift');
    }
  });

  it('resolves a null medium to DEFAULT_MEDIUM_ID (a fresh session)', () => {
    expect(DEFAULT_MEDIUM_ID).toBe('watercolor');
    for (const tool of PAINT_TOOLS) {
      expect(
        keys(visibleAquarelleParamRows(tool, null)),
        `${tool} + null medium`,
      ).toBe(keys(visibleAquarelleParamRows(tool, DEFAULT_MEDIUM_ID)));
    }
  });

  it('reproduces Matrix 2 row counts: P-A 7, P-W 9, P-D 8, W 6, L 1', () => {
    expect(visibleAquarelleParamRows('brush', 'acrylic'), 'P-A').toHaveLength(7);
    expect(visibleAquarelleParamRows('brush', 'watercolor'), 'P-W').toHaveLength(9);
    expect(visibleAquarelleParamRows('brush', 'gouache'), 'P-D').toHaveLength(8);
    expect(visibleAquarelleParamRows('brush', 'pastel'), 'P-D (chalk)').toHaveLength(8);
    expect(visibleAquarelleParamRows('brush', 'graphite'), 'P-D').toHaveLength(8);
    expect(visibleAquarelleParamRows('water', 'watercolor'), 'W').toHaveLength(6);
    expect(visibleAquarelleParamRows('lift', 'watercolor'), 'L').toHaveLength(1);
  });
});

describe('decision B — Refill visibility per medium', () => {
  it('hides Refill for acrylic and for watercolor (decision B)', () => {
    for (const tool of PAINT_TOOLS) {
      const acrylic = visibleAquarelleParamRows(tool, 'acrylic').map((row) => row.key);
      const watercolor = visibleAquarelleParamRows(tool, 'watercolor').map((row) => row.key);
      expect(acrylic.includes('refill'), `${tool} + acrylic hides Refill`).toBe(false);
      expect(watercolor.includes('refill'), `${tool} + watercolor hides Refill`).toBe(false);
    }
  });

  it('shows Refill for gouache, chalk and graphite — the DEFERRED item', () => {
    // DEFERRED (artist, 2026-11-21): the row is shown and keeps 60 until the
    // artist decides whether the non-acrylic bristle media should lose it too.
    for (const tool of PAINT_TOOLS) {
      for (const medium of ['gouache', 'pastel', 'graphite'] as const) {
        const paintKeys = visibleAquarelleParamRows(tool, medium).map((row) => row.key);
        expect(paintKeys.includes('refill'), `${tool} + ${medium} shows Refill`).toBe(true);
      }
    }
  });

  it('never shows Refill with the Water tool or the Eraser', () => {
    for (const medium of MEDIA) {
      expect(visibleAquarelleParamRows('water', medium).map((row) => row.key)).not.toContain(
        'refill',
      );
      expect(visibleAquarelleParamRows('lift', medium).map((row) => row.key)).not.toContain(
        'refill',
      );
    }
  });
});

describe('groups — fixed order, empty groups dropped', () => {
  it('keeps the six group ids in the spec §8 order', () => {
    expect(AQUARELLE_PARAM_GROUPS.map((group) => group.id).join('|')).toBe(
      'medium|paint|drying|edge|watercolor|eraser',
    );
    expect(AQUARELLE_PARAM_GROUPS.map((group) => group.label).join('|')).toBe(
      'Medium|Paint & reservoir|Drying|Edge|Watercolor only|Eraser',
    );
  });

  it('drops the Edge group for the watercolor medium (Feather is bristle-only)', () => {
    const ids = visibleAquarelleParamGroups('brush', 'watercolor').map((group) => group.id);
    expect(ids.join('|')).toBe('medium|paint|drying|watercolor');
  });

  it('keeps the Edge group for the three bristle media', () => {
    for (const medium of ['gouache', 'pastel', 'graphite', 'acrylic'] as const) {
      const ids = visibleAquarelleParamGroups('brush', medium).map((group) => group.id);
      expect(ids.join('|'), `brush + ${medium}`).toBe('medium|paint|drying|edge');
    }
  });

  it('renders Medium · Drying · Watercolor only for the Water tool', () => {
    const ids = visibleAquarelleParamGroups('water', 'acrylic').map((group) => group.id);
    expect(ids.join('|')).toBe('medium|drying|watercolor');
  });

  it('renders the Eraser group alone for the Eraser', () => {
    const ids = visibleAquarelleParamGroups('lift', 'watercolor').map((group) => group.id);
    expect(ids.join('|')).toBe('eraser');
  });

  it('never emits an empty group and keeps every group heading non-blank', () => {
    for (const tool of ['brush', 'watercolor', 'water', 'pen', 'lift'] as AquarelleTool[]) {
      for (const medium of [...MEDIA, null] as const) {
        for (const group of visibleAquarelleParamGroups(tool, medium)) {
          expect(group.rows.length, `${tool}/${medium}/${group.id} is non-empty`).toBeGreaterThan(0);
          expect(group.label.trim().length, `${group.id} has a heading`).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe('the row table itself', () => {
  it('holds exactly the thirteen Matrix 2 rows in order', () => {
    expect(keys(AQUARELLE_PARAM_ROWS)).toBe(
      [
        'viscosity',
        'emboss',
        'load',
        'pickup',
        'refill',
        'water',
        'dry',
        'feather',
        'flow',
        'bleed',
        'edge',
        'granulation',
        'lift',
      ].join('|'),
    );
  });

  it('never gives body, wetSeconds or size a row', () => {
    const rowKeys = AQUARELLE_PARAM_ROWS.map((row) => row.key) as readonly string[];
    expect(rowKeys.includes('body')).toBe(false);
    expect(rowKeys.includes('wetSeconds')).toBe(false);
    expect(rowKeys.includes('size')).toBe(false);
  });

  it('keeps the Emboss 15 cap and the 0 floor on every other row', () => {
    const emboss = AQUARELLE_PARAM_ROWS.find((row) => row.key === 'emboss')!;
    expect(emboss.max).toBe(15);
    expect(emboss.min).toBeUndefined();
    for (const row of AQUARELLE_PARAM_ROWS.filter((candidate) => candidate.key !== 'emboss')) {
      expect(row.max, `${row.key} keeps the default band`).toBeUndefined();
    }
  });

  it('uses hiddenForMedia on exactly Refill and Pickup', () => {
    // Decision B hides Refill for acrylic (fixed 0) and watercolor; rev 3
    // hides Pickup for watercolor (both laws are bristle-program-only).
    const hidden = AQUARELLE_PARAM_ROWS.filter((row) => row.hiddenForMedia !== undefined);
    // Table order: Pickup precedes Refill.
    expect(hidden.map((row) => row.key).join('|')).toBe('pickup|refill');
    expect(hidden[0]!.hiddenForMedia!.join('|')).toBe('watercolor');
    expect(hidden[1]!.hiddenForMedia!.join('|')).toBe('acrylic|watercolor');
  });

  it('gives the Lift row no paint/water context and the other rows no lift context', () => {
    for (const row of AQUARELLE_PARAM_ROWS) {
      if (row.key === 'lift') {
        expect(row.paint, 'Lift is not a paint row').toBeUndefined();
        expect(row.water, 'Lift is not a Water-tool row').toBeUndefined();
        expect(row.lift, 'Lift is the Eraser row').toBe(true);
      } else {
        expect(row.lift, `${row.key} is not an Eraser row`).toBeUndefined();
      }
    }
  });

  it('is pure data: no Preact, no signals, no DOM in the source', () => {
    const source = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), 'aquarelleParamVisibility.ts'),
      'utf8',
    );
    const imports = source
      .split('\n')
      .filter((line) => line.trimStart().startsWith('import '))
      .join('|');
    expect(imports, 'no Preact import').not.toContain('preact');
    expect(imports, 'no signal import').not.toContain('signal');
    expect(source, 'no signal read').not.toContain('.value');
    expect(source, 'no DOM access').not.toContain('document.');
  });
});
