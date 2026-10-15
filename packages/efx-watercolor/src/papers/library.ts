// ============================================================
//  Studio paper library — 10 procedural + 3 recovered real
//  (56-05 / PAPER-01 / PAPER-04 / D-09..D-12).
//
//  ONE library, grouped Procedural / Real (D-12 — never tabs).
//  Stable order: the 10 procedural names in the locked documented
//  sequence, then paper_1 / paper_2 / paper_3 (PAPER-04 — the
//  recovered assets already in app/public/img).
//
//  Real entries point at the shipped jpg paths so the picker can
//  draw the raw scan (D-11) with no engine involvement. Procedural
//  entries wrap the clean-room generators via `source` = the stable
//  paper id (proceduralHeightMap(paperId, seed)).
// ============================================================

export interface PaperDefinition {
  readonly id: string;
  readonly name: string;
  readonly group: 'procedural' | 'real';
  readonly defaultStrength: number;
  readonly defaultScale: number;
  /**
   * Procedural: the stable paper id feeding proceduralHeightMap.
   * Real: the shipped jpg URL under app/public/img.
   */
  readonly source: string;
}

/**
 * Defaults (Claude's Discretion per 56-05): strength Med (0.65) and
 * scale 1 (natural tile) for every paper — the picker's Strength/Scale
 * sliders (D-10) then refine per document. Same starting point keeps
 * the 13 cells comparable at first open.
 */
const DEFAULT_STRENGTH = 0.65;
const DEFAULT_SCALE = 1;

const PROCEDURAL_ENTRIES: readonly PaperDefinition[] = [
  { id: 'paper/cold-press', name: 'cold press', group: 'procedural', defaultStrength: DEFAULT_STRENGTH, defaultScale: DEFAULT_SCALE, source: 'paper/cold-press' },
  { id: 'paper/hot-press', name: 'hot press', group: 'procedural', defaultStrength: DEFAULT_STRENGTH, defaultScale: DEFAULT_SCALE, source: 'paper/hot-press' },
  { id: 'paper/rough', name: 'rough', group: 'procedural', defaultStrength: DEFAULT_STRENGTH, defaultScale: DEFAULT_SCALE, source: 'paper/rough' },
  { id: 'paper/khadi', name: 'khadi', group: 'procedural', defaultStrength: DEFAULT_STRENGTH, defaultScale: DEFAULT_SCALE, source: 'paper/khadi' },
  { id: 'paper/washi', name: 'washi', group: 'procedural', defaultStrength: DEFAULT_STRENGTH, defaultScale: DEFAULT_SCALE, source: 'paper/washi' },
  { id: 'paper/laid', name: 'laid', group: 'procedural', defaultStrength: DEFAULT_STRENGTH, defaultScale: DEFAULT_SCALE, source: 'paper/laid' },
  { id: 'paper/canvas', name: 'canvas', group: 'procedural', defaultStrength: DEFAULT_STRENGTH, defaultScale: DEFAULT_SCALE, source: 'paper/canvas' },
  { id: 'paper/toned-sand', name: 'toned sand', group: 'procedural', defaultStrength: DEFAULT_STRENGTH, defaultScale: DEFAULT_SCALE, source: 'paper/toned-sand' },
  { id: 'paper/kraft', name: 'kraft', group: 'procedural', defaultStrength: DEFAULT_STRENGTH, defaultScale: DEFAULT_SCALE, source: 'paper/kraft' },
  { id: 'paper/student', name: 'student', group: 'procedural', defaultStrength: DEFAULT_STRENGTH, defaultScale: DEFAULT_SCALE, source: 'paper/student' },
];

const REAL_ENTRIES: readonly PaperDefinition[] = [
  { id: 'paper/real-1', name: 'paper 1', group: 'real', defaultStrength: DEFAULT_STRENGTH, defaultScale: DEFAULT_SCALE, source: '/img/paper_1.jpg' },
  { id: 'paper/real-2', name: 'paper 2', group: 'real', defaultStrength: DEFAULT_STRENGTH, defaultScale: DEFAULT_SCALE, source: '/img/paper_2.jpg' },
  { id: 'paper/real-3', name: 'paper 3', group: 'real', defaultStrength: DEFAULT_STRENGTH, defaultScale: DEFAULT_SCALE, source: '/img/paper_3.jpg' },
];

/** The 13-paper Studio library — Procedural group first, then Real (D-12). */
export const PAPER_LIBRARY: readonly PaperDefinition[] = Object.freeze([
  ...PROCEDURAL_ENTRIES,
  ...REAL_ENTRIES,
]);
