// ============================================================
//  Studio paper library — 10 procedural + 3 recovered real
//  (56-05 / PAPER-01 / PAPER-04 / D-09..D-12).
//
//  RED stub: intentionally wrong surface so papers.test.ts fails on
//  assertions, not imports. GREEN replaces this with PAPER_LIBRARY.
// ============================================================

export interface PaperDefinition {
  readonly id: string;
  readonly name: string;
  readonly group: 'procedural' | 'real';
  readonly defaultStrength: number;
  readonly defaultScale: number;
  readonly source: string;
}

export const PAPER_LIBRARY: readonly PaperDefinition[] = [];
