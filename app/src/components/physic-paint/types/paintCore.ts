// ============================================================
//  quick 261027-klx — app-owned paint types (engine-1 removal).
//
//  These declarations are the survivors every engine-1 consumer
//  still imports. They are copied VERBATIM from the package so the
//  existing consumers keep compiling after the package is deleted:
//
//    ToolType / BgMode / BrushOpts / PenPoint / PaintStroke /
//    PhysicsMode            — packages/efx-physic-paint/src/types.ts
//    CompletedPaintMutation /
//    PaintHistoryAvailability — packages/efx-physic-paint/src/engine/EfxPaintEngine.ts
//    PhysicStrokePayload     — packages/efx-physic-paint/src/payload/toStudioStroke.ts
//
//  Pure type declarations only: no runtime values, no package
//  re-exports. Union members and field names are persisted in
//  documents and scripts — never rename or drop a member.
// ============================================================

import type { DocumentSnapshot } from '@efxlab/efx-watercolor';

// === TOOL TYPES ===
// paint / erase are the D-12 drawing tools; 'move' (261004-dn5) is the
// script-backed stroke translation tool — it never paints and never erases.

export type ToolType = 'paint' | 'erase' | 'move';

// === BRUSH OPTIONS ===

export interface BrushOpts {
  size: number; // 1-80 (slider id="sz")
  opacity: number; // 10-100 (slider id="op")
  pressure: number; // 10-100 (slider id="pr")
  waterAmount: number; // 0-100 (slider id="wa")
  dryAmount: number; // 0-100 (slider id="da")
  edgeDetail: number; // 0-100 (slider id="ed")
  pickup: number; // 0-100 paint tool (slider id="pu")
  eraseStrength: number; // 0-100 erase tool (slider id="es")
  antiAlias: number; // 0=off, 1=soft(2 passes), 2=med(4 passes), 3=high(6 passes)
}

// === PEN INPUT ===

export interface PenPoint {
  x: number;
  y: number;
  p: number; // pressure 0-1
  tx: number; // tilt X degrees
  ty: number; // tilt Y degrees
  tw: number; // twist degrees
  spd: number; // speed px/ms
}

// === BACKGROUND MODE ===

export type BgMode = 'transparent' | 'white' | 'canvas1' | 'canvas2' | 'canvas3' | 'photo';

// === STROKE RECORDING ===

export type PhysicsMode = 'local' | 'last' | 'all' | null;

export interface PaintStroke {
  mutationId?: number; // stable in-memory identity for accepted brush history
  tool: ToolType;
  points: PenPoint[];
  color: string | null; // '#rrggbb' or null
  params: BrushOpts;
  timestamp: number;
  hasPenInput?: boolean;
  diffusionFrames?: number; // v2 format: frames of diffusion since last stroke
  playFrame?: number; // optional Play-canvas frame where this stroke starts
  physicsMode?: PhysicsMode; // per-stroke mode for Play-canvas replay
  /** Water color guide proxy: render input for the ledger, never a Brush script. */
  guideProxy?: boolean;
}

// === STACK REORDER ===

export interface StackReorderResult<T> {
  readonly items: readonly T[];
  readonly changed: boolean;
}

// === MUTATION COMPLETION / HISTORY ===

export type CompletedPaintMutation = {
  kind: ToolType | 'undo' | 'redo' | 'clear' | 'physics';
  isEmpty: boolean;
  mutationId: number;
};

export type PaintHistoryAvailability = {
  undo: number;
  redo: number;
};

/** Engine-1 private fields carried in the opaque `engine: P` slot. */
export interface PhysicStrokePayload {
  tool: string;
  color: string | null;
  params: Record<string, number>;
  mutationId?: number;
  hasPenInput?: boolean;
  physicsMode?: string | null;
  diffusionFrames?: number;
  timestamp: number;
  playFrame?: number;
}

// === ROTO EDITABLE STATE ===

/** The Roto editable-state carrier: the watercolor document snapshot. */
export type RotoEditableState = DocumentSnapshot;
