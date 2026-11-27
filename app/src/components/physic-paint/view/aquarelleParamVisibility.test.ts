/**
 * quick 261121-mtu — the Paint panel's visibility law (Matrix 2).
 *
 * Laws pinned here:
 *   the visible rows are a function of (active tool, active medium), never
 *     of the tool alone — the full matrix is pinned per context in order
 *   a null medium resolves to DEFAULT_MEDIUM_ID (a fresh session)
 *   empty groups are dropped; the six group ids keep their fixed order
 *   the Eraser context renders the Lift row alone
 *   quick 261124-iq9: Viscosity and Water are ABSENT for the Gouache
 *     (acrylic) paint context — the opaque medium reads neither — and
 *     PRESENT for Watercolor; the Water tool keeps Viscosity under every
 *     medium (the paint-context law never reaches its fluid set)
 *   Refill (decision B): ABSENT for acrylic (record fixes 0) and for
 *     watercolor (the engine reads refill only in the bristle carrier)
 *   `body` and `wetSeconds` never have a row; Emboss is the ONE signed
 *     row (-15..15, quick 261123-hr5) — every other row keeps 0..100
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
  isAquarelleParamRowVisible,
  visibleAquarelleParamGroups,
  visibleAquarelleParamRows,
  type AquarelleParamRow,
} from './aquarelleParamVisibility';

const PAINT_TOOLS: readonly AquarelleTool[] = ['brush', 'watercolor', 'pen'];
/** The two medium ids in the engine's fixed order. */
const MEDIA = ['watercolor', 'acrylic'] as const;

// 2026-11-23: Emboss is gated off — hidden in every context until a new
// display renderer replaces the first-order heightmap shade (see RELIEF_BUMP).
// The ROW survives in AQUARELLE_PARAM_ROWS; only its visibility went.
// quick 261124-iq9: Viscosity and Water leave the Gouache (acrylic) context,
// and Pickup/Refill leave it too (bristle-program keys), leaving four rows.
// Spec 10: Edge transparency and Edge falloff join the bristle context.
// Spec 11: Feather noise and Feather falloff follow them, so the Gouache
// paint context renders eight rows.
const P_A = 'load|pickup|dry|feather|edgeFade|edgeFalloff|featherNoise|featherFalloff';
// rev 3: Pickup joins Refill as bristle-only — `uPickupRate` (carrier) and
// `uSmear` (gather) are the only bindings, so the fluid row is dead and the
// watercolor context hides it.
const P_W = 'viscosity|load|water|dry|flow|bleed|edge|granulation';
const W_KEYS = 'viscosity|dry|flow|bleed|edge|granulation';
const L_KEYS = 'lift';

function keys(rows: readonly AquarelleParamRow[]): string {
  return rows.map((row) => row.key).join('|');
}

function expectedKeys(tool: AquarelleTool, medium: (typeof MEDIA)[number]): string {
  if (tool === 'lift') return L_KEYS;
  if (tool === 'water') return W_KEYS;
  if (medium === 'acrylic') return P_A;
  return P_W;
}

describe('Matrix 2 — the row set per (tool, medium) context', () => {
  it('pins every paint tool crossed with every medium (P-A / P-W)', () => {
    for (const tool of PAINT_TOOLS) {
      for (const medium of MEDIA) {
        expect(keys(visibleAquarelleParamRows(tool, medium)), `${tool} + ${medium}`).toBe(
          expectedKeys(tool, medium),
        );
      }
    }
  });

  it('pins the Water tool as medium-independent (W) and keeps Viscosity there', () => {
    for (const medium of MEDIA) {
      expect(keys(visibleAquarelleParamRows('water', medium)), `water + ${medium}`).toBe(W_KEYS);
      // quick 261124-iq9: `hiddenForMedia` is a PAINT-context law — the Water
      // tool's fluid set deliberately ignores it and keeps Viscosity.
      expect(
        visibleAquarelleParamRows('water', medium).map((row) => row.key),
        `water + ${medium} keeps Viscosity`,
      ).toContain('viscosity');
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

  it('reproduces the gated row counts: P-A 8, P-W 8, W 6, L 1', () => {
    expect(visibleAquarelleParamRows('brush', 'acrylic'), 'P-A').toHaveLength(8);
    expect(visibleAquarelleParamRows('brush', 'watercolor'), 'P-W').toHaveLength(8);
    expect(visibleAquarelleParamRows('water', 'watercolor'), 'W').toHaveLength(6);
    expect(visibleAquarelleParamRows('water', 'acrylic'), 'W (acrylic)').toHaveLength(6);
    expect(visibleAquarelleParamRows('lift', 'watercolor'), 'L').toHaveLength(1);
    expect(visibleAquarelleParamRows('lift', 'acrylic'), 'L (acrylic)').toHaveLength(1);
  });

  it('keeps Emboss out of EVERY context while the display emboss is gated', () => {
    // Hidden everywhere, for every medium, but still a row: the medium record,
    // the Reset key set and the recorded thickness keep their shape.
    for (const tool of PAINT_TOOLS) {
      for (const medium of MEDIA) {
        expect(
          visibleAquarelleParamRows(tool, medium).map((row) => row.key).includes('emboss'),
          `${tool}/${medium} must not render the Emboss row`,
        ).toBe(false);
      }
    }
    expect(AQUARELLE_PARAM_ROWS.find((row) => row.key === 'emboss')?.hidden).toBe(true);
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

  it('shows Refill under NO surviving paint medium (the deferred class is gone)', () => {
    // quick 261124-iq9: the gouache / chalk / graphite media that carried the
    // deferred exposure are retired, so both surviving records hide the row.
    for (const tool of PAINT_TOOLS) {
      for (const medium of MEDIA) {
        const paintKeys = visibleAquarelleParamRows(tool, medium).map((row) => row.key);
        expect(paintKeys.includes('refill'), `${tool} + ${medium} hides Refill`).toBe(false);
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

  it('drops the Medium group for the only bristle medium (Viscosity is hidden there)', () => {
    const ids = visibleAquarelleParamGroups('brush', 'acrylic').map((group) => group.id);
    expect(ids.join('|'), 'brush + acrylic').toBe('paint|drying|edge');
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
  it('holds exactly the seventeen Matrix 2 rows in order', () => {
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
        'edgeFade',
        'edgeFalloff',
        'featherNoise',
        'featherFalloff',
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

  it('keeps the Emboss signed band -15..15 and the 0..100 band on every other row', () => {
    const emboss = AQUARELLE_PARAM_ROWS.find((row) => row.key === 'emboss')!;
    expect(emboss.min, 'the signed Emboss floor').toBe(-15);
    expect(emboss.max, 'the signed Emboss ceiling').toBe(15);
    for (const row of AQUARELLE_PARAM_ROWS.filter((candidate) => candidate.key !== 'emboss')) {
      expect(row.max, `${row.key} keeps the default ceiling`).toBeUndefined();
      expect(row.min, `${row.key} keeps the default floor`).toBeUndefined();
    }
  });

  it('uses hiddenForMedia on exactly Viscosity, Pickup, Refill and Water', () => {
    // Decision B hides Refill for acrylic (fixed 0) and watercolor; rev 3
    // hides Pickup for watercolor (both laws are bristle-program-only).
    // quick 261124-iq9 hides Viscosity and Water for the Gouache (acrylic)
    // paint context — the opaque medium reads neither.
    const hidden = AQUARELLE_PARAM_ROWS.filter((row) => row.hiddenForMedia !== undefined);
    // Table order: Viscosity, Pickup, Refill, Water.
    expect(hidden.map((row) => row.key).join('|')).toBe('viscosity|pickup|refill|water');
    expect(hidden[0]!.hiddenForMedia!.join('|')).toBe('acrylic');
    expect(hidden[1]!.hiddenForMedia!.join('|')).toBe('watercolor');
    expect(hidden[2]!.hiddenForMedia!.join('|')).toBe('acrylic|watercolor');
    expect(hidden[3]!.hiddenForMedia!.join('|')).toBe('acrylic');
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

// quick 261124-iq9: the panel and the Studio top bar share ONE law. The top
// bar gates its Water slider through this selector, so the two surfaces cannot
// drift; a hand-rolled medium comparison in the bar would fail this pin.
describe('the shared row selector — isAquarelleParamRowVisible', () => {
  it('answers for Water exactly as the row law does', () => {
    for (const tool of ['brush', 'watercolor'] as AquarelleTool[]) {
      expect(isAquarelleParamRowVisible(tool, 'watercolor', 'water'), `${tool} + watercolor`).toBe(
        true,
      );
      expect(isAquarelleParamRowVisible(tool, 'acrylic', 'water'), `${tool} + acrylic`).toBe(false);
    }
  });

  it('keeps the Eraser-only Lift row out of every other tool context', () => {
    for (const tool of ['brush', 'watercolor', 'pen', 'water'] as AquarelleTool[]) {
      expect(isAquarelleParamRowVisible(tool, 'watercolor', 'lift'), `${tool} hides Lift`).toBe(
        false,
      );
      expect(isAquarelleParamRowVisible(tool, 'acrylic', 'lift'), `${tool} hides Lift`).toBe(false);
    }
    expect(isAquarelleParamRowVisible('lift', 'watercolor', 'lift'), 'the Eraser shows Lift').toBe(
      true,
    );
    expect(isAquarelleParamRowVisible('lift', 'acrylic', 'lift'), 'the Eraser shows Lift').toBe(true);
  });

  it('hides Viscosity for Brush + acrylic and keeps it for Brush + watercolor and the Water tool', () => {
    expect(isAquarelleParamRowVisible('brush', 'acrylic', 'viscosity')).toBe(false);
    expect(isAquarelleParamRowVisible('brush', 'watercolor', 'viscosity')).toBe(true);
    for (const medium of MEDIA) {
      expect(isAquarelleParamRowVisible('water', medium, 'viscosity'), `water + ${medium}`).toBe(
        true,
      );
    }
  });

  // Spec 10 / Spec 11: the four edge knobs are bristle-only. The paint branch
  // plus the bristle medium is the whole law, so the fluid paint context and
  // the Water tool never see them.
  it('shows the edge rows on Brush + acrylic only (bristle-only rows)', () => {
    for (const key of ['edgeFade', 'edgeFalloff', 'featherNoise', 'featherFalloff'] as const) {
      expect(isAquarelleParamRowVisible('brush', 'acrylic', key), `brush + acrylic ${key}`).toBe(
        true,
      );
      expect(isAquarelleParamRowVisible('brush', 'watercolor', key), `watercolor ${key}`).toBe(
        false,
      );
      expect(isAquarelleParamRowVisible('water', 'acrylic', key), `water tool ${key}`).toBe(false);
      expect(isAquarelleParamRowVisible('lift', 'acrylic', key), `eraser ${key}`).toBe(false);
    }
  });

  it('resolves a null medium to DEFAULT_MEDIUM_ID (watercolor)', () => {
    expect(isAquarelleParamRowVisible('brush', null, 'water')).toBe(true);
    expect(isAquarelleParamRowVisible('brush', null, 'viscosity')).toBe(true);
  });
});
