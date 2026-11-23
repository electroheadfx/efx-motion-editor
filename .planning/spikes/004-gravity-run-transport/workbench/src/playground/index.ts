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

export { WatercolorEngine, DEFAULT_PARAMS, DEFAULT_LIGHT, clampDocSize, MIN_DOC_SIDE, MIN_ZOOM, MAX_ZOOM } from './Engine'
export type { Params, Tool, LightSettings, EngineCallbacks, ExportOptions, DocumentSnapshot, DocState, WholeDoc, LayerId, SheetSnapshot } from './Engine'
export {
  BRUSH_PRESETS,
  buildBrush,
  TIP_SIZE,
  brushGroupOrder,
  brushGroupLabels,
  brushGroupOf,
  brushSections,
} from './brushes'
export type { Brush, BrushPreset, BrushGroupSection, Rotation } from './brushes'
export { PAPERS, DEFAULT_PAPER } from './papers'
export type { PaperPreset } from './papers'
export { StrokeWriter, penSpeed } from './StrokeWriter'
export type { Polyline, WriteOptions, WriteCallbacks } from './StrokeWriter'
export { ghostPath, setGhost, hideGhost } from './ghost'
export {
  toEngineParams,
  DEFAULT_CANONICAL_PARAMS,
  sizeToEngineScale,
  LEGACY_SIZE_MAX_PX,
  SIZE_MAX_PX,
  SIZE_SCALE_AT_MAX,
} from './params'
export type { AquarelleCanonicalParams } from './params'
export { MEDIUMS, MEDIUM_IDS, DEFAULT_MEDIUM_ID, mediumById } from './mediums'
export type { MediumId, MediumParamKey, MediumRecord } from './mediums'
export { buildBrushForStroke, strokeTipData } from './brushBridge'
export type { BrushMultiplierOverrides, BrushStrokeOptions } from './brushBridge'
export { pigmentFromHex, hexToRgb, rgbToHex } from './spectral'
export type { Pigment } from './spectral'
export {
  bodyCurve,
  BODY_CURVE_EXPONENT,
  scatteringDeposit,
  SCATTERING_MAX,
  SCATTER_EPSILON,
} from './scattering'
