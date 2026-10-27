// ============================================================
//  quick 261027-klx — TEMPORARY parity proof (deleted in Wave 1).
//
//  Proves the app-owned copy in ./stackOrder is behaviourally
//  identical to the engine-1 implementation BEFORE the package is
//  deleted. It imports the package on purpose; once
//  `@efxlab/efx-physic-paint` is gone this file is removed and the
//  permanent `stackOrder.test.ts` carries the law.
// ============================================================

import { describe, expect, it } from 'vitest';
import {
  clampStackPosition as packageClampStackPosition,
  reorderForStackPosition as packageReorderForStackPosition,
  targetIndexForStackPosition as packageTargetIndexForStackPosition,
} from '@efxlab/efx-physic-paint';
import {
  clampStackPosition,
  reorderForStackPosition,
  targetIndexForStackPosition,
} from './stackOrder';

const TOTALS = [0, 1, 2, 5, Number.NaN, 2.7] as const;
const POSITIONS = [-3, 0, 1, 2, 5, 99, Number.NaN, 1.5] as const;
const FROM_INDICES = [-1, 0, 2, 5, 1.5, Number.NaN] as const;
const ITEMS = ['A', 'B', 'C', 'D', 'E'] as const;

describe('quick 261027-klx stack-order parity (local copy vs package)', () => {
  it('clampStackPosition matches the package for every total/position pair', () => {
    for (const total of TOTALS) {
      for (const position of POSITIONS) {
        expect(clampStackPosition(position, total), `position ${position} total ${total}`)
          .toBe(packageClampStackPosition(position, total));
      }
    }
  });

  it('targetIndexForStackPosition matches the package for every total/position pair', () => {
    for (const total of TOTALS) {
      for (const position of POSITIONS) {
        expect(targetIndexForStackPosition(position, total), `position ${position} total ${total}`)
          .toBe(packageTargetIndexForStackPosition(position, total));
      }
    }
  });

  it('reorderForStackPosition matches the package on every fromIndex/position pair', () => {
    for (const fromIndex of FROM_INDICES) {
      for (const position of POSITIONS) {
        const local = reorderForStackPosition(ITEMS, fromIndex, position);
        const pkg = packageReorderForStackPosition(ITEMS, fromIndex, position);
        expect(local.changed, `fromIndex ${fromIndex} position ${position}`).toBe(pkg.changed);
        expect(local.items).toEqual(pkg.items);
        // No-op paths must preserve the SAME input reference in both.
        expect(local.items === ITEMS).toBe(pkg.items === ITEMS);
      }
    }
  });

  it('reorderForStackPosition matches the package on empty and single-item arrays', () => {
    const empty: readonly string[] = [];
    const single = ['only'] as const;
    for (const items of [empty, single] as const) {
      for (const fromIndex of FROM_INDICES) {
        for (const position of POSITIONS) {
          const local = reorderForStackPosition(items, fromIndex, position);
          const pkg = packageReorderForStackPosition(items, fromIndex, position);
          expect(local.changed, `items ${items.length} fromIndex ${fromIndex} position ${position}`).toBe(pkg.changed);
          expect(local.items).toEqual(pkg.items);
          expect(local.items === items).toBe(pkg.items === items);
        }
      }
    }
  });
});
