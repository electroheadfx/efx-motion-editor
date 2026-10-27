// ============================================================
//  AquarelleEnginePort — the narrow, typed surface Roto and the
//  Studio are allowed to hold (quick 261027-klx, Wave 3, Option A).
//
//  The watercolor engine is the ONLY paint engine after engine-1
//  removal. Roto code must never reach `WatercolorEngine`
//  internals: it reads and writes document state through this
//  port, and the port is published by `AquarelleCanvasLayer` when
//  a live engine exists (null on cleanup).
//
//  Do NOT widen this interface. Every member here is a member
//  Roto or the Studio provably needs; anything else belongs to
//  app-owned state (aquarelleRecordState, the cached reference
//  frame, the durable base), never to the engine.
//
//  `WatercolorEngine` is imported as a TYPE only — this module
//  never re-exports the engine class.
// ============================================================

import type { DocumentSnapshot, WatercolorEngine } from '@efxlab/efx-watercolor';

/**
 * Mirrors the watercolor engine's `ExportBackground` union. The package barrel
 * does not re-export the type, and this port is deliberately self-contained —
 * the union is stated here so Roto never imports the vendored engine module.
 */
export type AquarelleExportBackground = 'transparent' | 'paper' | 'white';

/**
 * The narrow engine surface. `snapshot`/`restore` carry the whole paint
 * document; `exportCanvas` is the read side of the frame snapshot path and
 * is a PURE readback (no history, no wet-state change).
 *
 * `undo`/`redo` return whether the engine actually moved: the Roto editing
 * controller gates its overlay/dirty bookkeeping on that answer, so a
 * no-history call must report `false` rather than silently doing nothing.
 * (Deviation from the plan's `void` signature — same member set, no new
 * capability; the engine's own `undo()` is void and has no return value.)
 */
export interface AquarelleEnginePort {
  snapshot: () => DocumentSnapshot;
  restore: (snapshot: DocumentSnapshot) => void;
  exportCanvas: (background?: AquarelleExportBackground, texture?: boolean) => HTMLCanvasElement;
  undo: () => boolean;
  redo: () => boolean;
  clear: () => void;
}

/** Raised when a caller holds a live port but the engine has gone away. */
export class AquarelleEngineUnavailableError extends Error {
  constructor() {
    super('AquarelleEnginePort used after the watercolor engine was destroyed');
    this.name = 'AquarelleEngineUnavailableError';
  }
}

function requireEngine(
  getEngine: () => WatercolorEngine | null,
): WatercolorEngine {
  const engine = getEngine();
  if (!engine) throw new AquarelleEngineUnavailableError();
  return engine;
}

/**
 * Build a port over an injected live-engine accessor.
 *
 * The layer creates ONE port per engine instance and publishes it through
 * `onEnginePortReady`; consumers must hold that single object — the Roto
 * clipboard keys its accepted-target WeakMap by port identity, so a second
 * port over the same engine would read every accepted target as null.
 */
export function createAquarelleEnginePort(
  getEngine: () => WatercolorEngine | null,
): AquarelleEnginePort {
  return {
    snapshot: () => requireEngine(getEngine).snapshot(),
    restore: (snapshot) => requireEngine(getEngine).restore(snapshot),
    exportCanvas: (background = 'transparent', texture = true) =>
      requireEngine(getEngine).exportCanvas(background, texture),
    undo: () => {
      const engine = getEngine();
      if (!engine || !engine.canUndo) return false;
      engine.undo();
      return true;
    },
    redo: () => {
      const engine = getEngine();
      if (!engine || !engine.canRedo) return false;
      engine.redo();
      return true;
    },
    clear: () => getEngine()?.clear(),
  };
}
