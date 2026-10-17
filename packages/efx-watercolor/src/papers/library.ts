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
//  entries ride the vendored WatercolorEngine paper sheet via
//  `source` = the stable paper id (Engine.paperSheet / paperHeight).
// ============================================================

/** Playground sheet-height law (Engine.ts PAPER_UNITS) — features drawn for a sheet this many texels tall. */
export const PAPER_UNITS = 1100;

// ------------------------------------------------------------
// Studio ids (10 procedural papers) — PAPER_PRESETS maps these
// onto playground kinds 0..9 so a preset change cannot drift
// between the fond, the picker thumbs, and the bake tooth.
// ------------------------------------------------------------
export const PROCEDURAL_PAPER_IDS = [
  'paper/cold-press',
  'paper/hot-press',
  'paper/rough',
  'paper/khadi',
  'paper/washi',
  'paper/laid',
  'paper/canvas',
  'paper/toned-sand',
  'paper/kraft',
  'paper/student',
] as const;

export type ProceduralPaperId = (typeof PROCEDURAL_PAPER_IDS)[number];

export interface StudioPaperPreset {
  /** Studio id. */
  readonly id: string;
  /** Playground paperFieldFS kind (0 = coldPress … 9 = student). */
  readonly kind: number;
  /** Relief strength — paperLightFS uBump source (Engine.ts). */
  readonly bump: number;
  /** Cloudiness of the sheet (PAPER_COLOUR uMottle). */
  readonly mottle: number;
  /** Sheet colour (sRGB hex) — PAPER_COLOUR uPaperTint. */
  readonly tint: string;
  /** Dark specks / inclusions (sRGB hex) — PAPER_COLOUR uFleckTint. */
  readonly fleck: string;
}

/**
 * kind + bump + mottle + tint + fleck, unchanged from the playground
 * papers.ts table. Studio id ↔ playground kind: cold-press→0,
 * hot-press→1, rough→2, khadi→3, washi→4, laid→5, canvas→6,
 * toned-sand→7, kraft→8, student→9 (playground id `cellulose`).
 */
export const PAPER_PRESETS: readonly StudioPaperPreset[] = Object.freeze([
  { id: 'paper/cold-press', kind: 0, bump: 1.0, mottle: 0.05, tint: '#f6f3ec', fleck: '#8a8070' },
  { id: 'paper/hot-press', kind: 1, bump: 0.6, mottle: 0.04, tint: '#f8f7f3', fleck: '#8a8478' },
  { id: 'paper/rough', kind: 2, bump: 0.8, mottle: 0.06, tint: '#f5f1e8', fleck: '#857a68' },
  { id: 'paper/khadi', kind: 3, bump: 1.0, mottle: 0.12, tint: '#efe7d6', fleck: '#6d5f4a' },
  { id: 'paper/washi', kind: 4, bump: 0.8, mottle: 0.14, tint: '#f1ece0', fleck: '#7a6a52' },
  { id: 'paper/laid', kind: 5, bump: 1.0, mottle: 0.05, tint: '#f2ebdb', fleck: '#8a7c64' },
  { id: 'paper/canvas', kind: 6, bump: 1.0, mottle: 0.04, tint: '#f3efe6', fleck: '#8a8070' },
  { id: 'paper/toned-sand', kind: 7, bump: 1.0, mottle: 0.06, tint: '#d9c8a6', fleck: '#6e5f45' },
  { id: 'paper/kraft', kind: 8, bump: 0.8, mottle: 0.12, tint: '#b99872', fleck: '#4e3b28' },
  { id: 'paper/student', kind: 9, bump: 1.0, mottle: 0.03, tint: '#f7f7f4', fleck: '#8a8a84' },
]);

export function presetForPaperId(paperId: string): StudioPaperPreset | null {
  for (const preset of PAPER_PRESETS) {
    if (preset.id === paperId) return preset;
  }
  return null;
}

export interface PaperDefinition {
  readonly id: string;
  readonly name: string;
  readonly group: 'procedural' | 'real';
  readonly defaultStrength: number;
  readonly defaultScale: number;
  /**
   * Procedural: the stable paper id feeding the ported playground field.
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
