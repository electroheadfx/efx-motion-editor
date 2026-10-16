// ============================================================
//  Vendored Watercolor Playground engine (MIT).
//  Source: SPECS/v1.1.0-water-color/watercolor-playground
//  License: MIT (see LICENSE.md). Third-party notices: the
//  Navier-Stokes passes follow WebGL-Fluid-Simulation (MIT,
//  Pavel Dobryakov) as recorded in that project's
//  THIRD_PARTY_NOTICES.md.
//
//  Used as-is: the simulation and rendering are UI-independent.
//  This is the reference watercolor engine (look + liquid physics).
// ============================================================

export { WatercolorEngine, DEFAULT_PARAMS, clampDocSize, MIN_DOC_SIDE, MIN_ZOOM, MAX_ZOOM } from './Engine'
export type { Params, Tool, EngineCallbacks, ExportOptions, DocumentSnapshot, DocState, WholeDoc, LayerId } from './Engine'
export { BRUSH_PRESETS, buildBrush, TIP_SIZE } from './brushes'
export type { Brush, BrushPreset, Rotation } from './brushes'
export { PAPERS, DEFAULT_PAPER } from './papers'
export type { PaperPreset } from './papers'
export { StrokeWriter, penSpeed } from './StrokeWriter'
export type { Polyline, WriteOptions, WriteCallbacks } from './StrokeWriter'
export { ghostPath, setGhost, hideGhost } from './ghost'
export { toEngineParams, DEFAULT_CANONICAL_PARAMS } from './params'
export type { AquarelleCanonicalParams } from './params'
export { buildBrushForStroke } from './brushBridge'
export type { BrushMultiplierOverrides } from './brushBridge'
export { pigmentFromHex, hexToRgb, rgbToHex } from './spectral'
export type { Pigment } from './spectral'
