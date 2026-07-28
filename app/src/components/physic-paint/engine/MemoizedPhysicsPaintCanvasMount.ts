// 38.1-11: keep the plain mount directly callable while StudioView uses a
// dedicated compat boundary. Stable structural props skip the persistent Efx
// child on frame-only Studio renders; canvasKey still controls replacement.
import { memo } from 'preact/compat';
import { PhysicsPaintCanvasMount } from './PhysicsPaintCanvasMount';

export const MemoizedPhysicsPaintCanvasMount = memo(PhysicsPaintCanvasMount);
