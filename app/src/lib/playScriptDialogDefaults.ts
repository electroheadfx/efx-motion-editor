/**
 * Persisted defaults for the Physics Paint Run Script dialog. Stored in the
 * app-level settings store so the last creation values survive restarts; a
 * stack run keeps seeding from its destination rail instead.
 */
export interface PlayScriptDialogDefaults {
  mode: 'progressive' | 'static';
  countText: string;
  max: boolean;
  repeatText: string;
  infinity: boolean;
  motion: { deformation: number; position: number; rotation: number; scale: number };
  keyScriptEdits: boolean;
  paintSeedVariation: boolean;
  colorize: boolean;
  colorizeMix: number;
  photoWiggle: boolean;
  overrideEnabled: boolean;
  revealCountText: string;
}
