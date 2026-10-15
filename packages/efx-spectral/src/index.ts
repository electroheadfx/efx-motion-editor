// @efxlab/efx-spectral — subtractive spectral pigment mixing (Preact-free).
//
// Shared by efx-watercolor (engine 2) now and efx-physic-paint (engine 1)
// in v1.2.0. Consumed per D-29 — never duplicate this mixing code inside
// an engine. See NOTICE for the MIT provenance of the vendored data.
export { mixSpectral } from './mix'
export type { Rgb } from './mix'
export { SPECTRAL_BANDS } from './spectralData'
