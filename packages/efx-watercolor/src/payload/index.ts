export * from './toStudioStroke'
export * from './dryEvent'
export * from './codec'
export * from './vectorPath'
// 61-09: the vector spine is a public geometry authority — the handle overlay
// reads `sampleVectorPath` / `resolveAnchorHandles` / `sampleVectorWidths`
// from here rather than re-deriving the curve (spine.ts's reuse contract).
export * from '../vector/spine'
