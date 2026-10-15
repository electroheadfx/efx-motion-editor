// @efxlab/efx-paint-host -- Studio-law paint host entry (Preact-free, D-17)
//
// Host-owned determinism surface (D-25). The seededRng(strokeSeed, streamKey)
// signature is the determinism law engine-1 deposit paths depend on — keep it
// byte-stable across the move.
export {
  fnv1a,
  hashMutationId,
  seededRng,
  arcSlot,
  seededDraw,
  seededRange,
  traceShapeNoise,
} from './util/traceSeed'
