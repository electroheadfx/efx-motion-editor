// @efxlab/efx-watercolor — animatable watercolour engine 2 (Preact-free core).
//
// Consumes @efxlab/efx-paint-host (StudioStroke<P> / EngineAdapter<P>) and
// @efxlab/efx-spectral (subtractive pigment mix). NEVER imports engine 1.
//
// The live/bake visual engine is the MIT Watercolor Playground
// simulation (see ./playground/LICENSE.md) — vendored so the look and
// liquid physics match the reference exactly.
export * from './engine'
export * from './brushes'
export * from './payload'
export * from './adapter'
export * from './papers'
export * from './bake'
// LIVE-SEED (2026-11-21): exported from the MAIN entry only — the seed drives
// the live engine through the adapter, so it must not pull the fluid engine
// into the lean `./bake` sub-entry chunk.
export * from './bake/aquarelleSeed'
export * from './playground'
