/**
 * Persisted defaults for the Physics Paint Run Script dialog. Stored in the
 * app-level settings store so the last creation values survive restarts; a
 * stack run keeps seeding from its destination rail instead.
 *
 * The Frames count is deliberately absent: it is always evaluated from the
 * open location (the rest of the timeline, or the rest of the target rail),
 * so a remembered count would only fight the available span.
 */
export interface PlayScriptDialogDefaults {
  mode: 'progressive' | 'static';
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
